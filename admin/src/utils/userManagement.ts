import type { UserManagementUser } from "../types/userManagement";
import type { ActivityLogEntry } from "../api/profile";
import { ROLE_COLORS } from "../config/userManagement";

export const filterAdminUsers = (
  users: UserManagementUser[] | undefined,
  currentUserId: string | null
): UserManagementUser[] => {
  if (!users) return [];
  return users.filter(
    (u) =>
      u._id !== currentUserId &&
      (u.role === "super-admin" || u.role === "user" || !u.role)
  );
};

export const applyRoleFilters = (
  users: UserManagementUser[],
  selectedRoles: string[]
): UserManagementUser[] => {
  if (!selectedRoles || selectedRoles.length === 0) return users;

  return users.filter((u) => {
    if (selectedRoles.includes(u.role)) return true;
    if (u.roles && u.roles.some((r) => selectedRoles.includes(r.name)))
      return true;
    return false;
  });
};

export const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    "super-admin": "Super Admin",
    user: "Admin User",
    customer: "Customer",
    seller: "Seller",
  };
  return roleMap[role] || role;
};

export const getRoleColor = (role: string): string => {
  return ROLE_COLORS[role] || "default";
};

export const formatModuleName = (module: string): string => {
  return module
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

export const calculateUserStats = (
  users: UserManagementUser[],
  availableRolesCount: number
) => {
  return {
    totalAdmins: users.length,
    superAdmins: users.filter((u) => u.role === "super-admin").length,
    withCustomRoles: users.filter((u) => u.roles && u.roles.length > 0).length,
    availableRoles: availableRolesCount,
  };
};

/**
 * Session activity tracking data for a user
 */
interface UserSessionData {
  lastLogin: Date | null;
  lastActivity: Date | null;
  lastLogout: Date | null;
}

/**
 * Configuration for active session detection
 */
interface SessionConfig {
  loginValidityDays: number;
  activityValidityHours: number;
}

const DEFAULT_SESSION_CONFIG: SessionConfig = {
  loginValidityDays: 7, // Refresh token expiry
  activityValidityHours: 24, // Recent activity window
};

/**
 * Extracts session data from activity logs for all users
 */
function extractSessionData(
  activityLogs: ActivityLogEntry[]
): Map<string, UserSessionData> {
  const sessionMap = new Map<string, UserSessionData>();

  activityLogs.forEach((log) => {
    const userId = log.user?._id;
    const userEmail = log.user?.email || log.email;
    const identifiers = [userId, userEmail].filter(Boolean) as string[];

    if (identifiers.length === 0) return;

    const logDate = new Date(log.createdAt);
    const isLogin = log.action === "login" && log.status === "success";
    const isLogout = log.action === "force_logout" && log.status === "success";

    identifiers.forEach((id) => {
      if (!sessionMap.has(id)) {
        sessionMap.set(id, {
          lastLogin: null,
          lastActivity: null,
          lastLogout: null,
        });
      }

      const session = sessionMap.get(id)!;

      if (isLogin) {
        if (!session.lastLogin || logDate > session.lastLogin) {
          session.lastLogin = logDate;
        }
      }

      if (isLogout) {
        if (!session.lastLogout || logDate > session.lastLogout) {
          session.lastLogout = logDate;
        }
      }

      // Track any activity
      if (!session.lastActivity || logDate > session.lastActivity) {
        session.lastActivity = logDate;
      }
    });
  });

  return sessionMap;
}

/**
 * Gets session data for a specific user by checking both ID and email
 */
function getUserSessionData(
  user: UserManagementUser,
  sessionMap: Map<string, UserSessionData>
): UserSessionData {
  const byId = sessionMap.get(user._id);
  const byEmail = user.email ? sessionMap.get(user.email) : null;

  if (!byId && !byEmail) {
    return { lastLogin: null, lastActivity: null, lastLogout: null };
  }

  // Merge data from both identifiers, taking the most recent
  const mergeDate = (a: Date | null, b: Date | null): Date | null => {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
  };

  return {
    lastLogin: mergeDate(byId?.lastLogin || null, byEmail?.lastLogin || null),
    lastActivity: mergeDate(
      byId?.lastActivity || null,
      byEmail?.lastActivity || null
    ),
    lastLogout: mergeDate(
      byId?.lastLogout || null,
      byEmail?.lastLogout || null
    ),
  };
}

/**
 * Determines if a user has an active session based on their activity
 */
function hasActiveSession(
  sessionData: UserSessionData,
  config: SessionConfig,
  hasActivityLogs: boolean
): boolean {
  const now = new Date();
  const loginThreshold = new Date(
    now.getTime() - config.loginValidityDays * 24 * 60 * 60 * 1000
  );
  const activityThreshold = new Date(
    now.getTime() - config.activityValidityHours * 60 * 60 * 1000
  );

  // If no activity logs available, assume active (handles loading/empty states)
  if (!hasActivityLogs) {
    return true;
  }

  // Check if user was force logged out after their last activity
  if (sessionData.lastLogout) {
    const lastAction = sessionData.lastActivity || sessionData.lastLogin;
    if (lastAction && sessionData.lastLogout > lastAction) {
      return false;
    }
  }

  // Active if recent activity (within activity window)
  if (
    sessionData.lastActivity &&
    sessionData.lastActivity > activityThreshold
  ) {
    return true;
  }

  // Active if recent login (within login validity period)
  if (sessionData.lastLogin && sessionData.lastLogin > loginThreshold) {
    return true;
  }

  return false;
}

/**
 * Filters admin users to show only those with active sessions
 *
 * @param users - List of admin users to filter
 * @param activityLogs - Activity logs to determine session status
 * @param currentUserId - ID of currently logged-in user (always included)
 * @param config - Optional session configuration
 * @returns Filtered list of users with active sessions
 */
export function filterActiveSessions(
  users: UserManagementUser[],
  activityLogs: ActivityLogEntry[] | undefined,
  currentUserId: string | null,
  config: Partial<SessionConfig> = {}
): UserManagementUser[] {
  if (!users.length) return [];

  const sessionConfig = { ...DEFAULT_SESSION_CONFIG, ...config };
  const hasActivityLogs = Boolean(activityLogs && activityLogs.length > 0);
  const sessionMap = hasActivityLogs
    ? extractSessionData(activityLogs!)
    : new Map<string, UserSessionData>();

  return users.filter((user) => {
    // Always include current user
    if (user._id === currentUserId) {
      return true;
    }

    const sessionData = getUserSessionData(user, sessionMap);
    return hasActiveSession(sessionData, sessionConfig, hasActivityLogs);
  });
}

/**
 * Gets the last login timestamp for a user from activity logs
 */
export function getUserLastLogin(
  userId: string,
  activityLogs: ActivityLogEntry[] | undefined
): Date | null {
  if (!activityLogs) return null;

  const userLogs = activityLogs.filter(
    (log) =>
      (log.user?._id === userId ||
        log.user?.email === userId ||
        log.email === userId) &&
      log.action === "login" &&
      log.status === "success"
  );

  if (userLogs.length === 0) return null;

  const latest = userLogs.reduce((latest, current) => {
    const currentDate = new Date(current.createdAt);
    const latestDate = new Date(latest.createdAt);
    return currentDate > latestDate ? current : latest;
  });

  return new Date(latest.createdAt);
}
