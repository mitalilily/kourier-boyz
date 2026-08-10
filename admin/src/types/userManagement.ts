export interface UserManagementUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  roles?: Array<{ _id: string; name: string; description?: string }>;
  isEmailVerified?: boolean;
  isBlocked?: boolean;
  blockedAt?: string;
  blockedReason?: string;
  createdAt: string;
}

export interface UserStats {
  totalAdmins: number;
  superAdmins: number;
  withCustomRoles: number;
  availableRoles: number;
}
