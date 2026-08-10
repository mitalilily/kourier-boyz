import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import {
  useAdminActivityLogs,
  useChangeSuperAdminPassword,
  useForceLogoutUser,
  type ActivityLogEntry,
} from "../api/profile";
import { useAllUsers } from "../api/users";
import {
  filterAdminUsers,
  filterActiveSessions,
  getUserLastLogin,
  getRoleDisplayName,
} from "../utils/userManagement";
import type { UserManagementUser } from "../types/userManagement";
import { useAuthStore } from "../store/authStore";

const { Title, Paragraph, Text } = Typography;

const SuperAdminProfile = () => {
  const { message, modal } = App.useApp();
  const role = useAuthStore((state) => state.role);
  const currentUserId = useAuthStore((state) => state.userId);
  const {
    data: activityLogs,
    isLoading: isLoadingLogs,
    refetch,
  } = useAdminActivityLogs({ limit: 100 }, { enabled: role === "super-admin" });
  const { data: users } = useAllUsers();

  // Get all admin users including current user
  const allAdminUsers = useMemo(() => {
    const filtered = filterAdminUsers(
      users as UserManagementUser[] | undefined,
      currentUserId
    );
    // Add current user if they exist in users list
    if (users && currentUserId) {
      const currentUser = (users as UserManagementUser[]).find(
        (u) => u._id === currentUserId
      );
      if (currentUser && !filtered.find((u) => u._id === currentUserId)) {
        return [currentUser, ...filtered];
      }
    }
    return filtered;
  }, [users, currentUserId]);

  // Filter to show only users with active sessions
  const adminUsers = useMemo(
    () => filterActiveSessions(allAdminUsers, activityLogs, currentUserId),
    [allAdminUsers, activityLogs, currentUserId]
  );

  const [form] = Form.useForm<{
    currentPassword: string;
    newPassword: string;
    confirm: string;
  }>();
  const changePassword = useChangeSuperAdminPassword();
  const forceLogout = useForceLogoutUser();

  const handlePasswordSubmit = async () => {
    try {
      const values = await form.validateFields();
      const result = await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      
      // Check if verification is required
      if (result.requiresVerification) {
        modal.warning({
          title: "Device Verification Required",
          content: (
            <div>
              <p style={{ marginBottom: 16 }}>
                <strong>A password change request was initiated from an unrecognized device.</strong>
              </p>
              <p style={{ marginBottom: 8 }}>
                Verify via email.
              </p>
              <p style={{ fontSize: 14, color: "#666" }}>
                We've sent a verification link to your email. Please check your inbox and click the link to complete your password change.
              </p>
            </div>
          ),
          okText: "OK",
          width: 500,
        });
        form.resetFields();
        void refetch();
        return;
      }
      
      message.success("Password updated successfully");
      form.resetFields();
      void refetch();
    } catch {
      // validation handled by form
    }
  };

  const confirmForceLogout = (user: UserManagementUser) => {
    modal.confirm({
      title: `Force logout ${user.name}?`,
      content:
        "This will invalidate all of their active sessions. They will need to sign in again to regain access.",
      okText: "Force Logout",
      okButtonProps: { danger: true, loading: forceLogout.isPending },
      onOk: async () => {
        try {
          await forceLogout.mutateAsync({ userId: user._id });
          message.success(`${user.name} has been logged out from all sessions`);
          void refetch();
        } catch (err: unknown) {
          console.error(err);
          message.error("Failed to force logout user");
        }
      },
    });
  };

  const activityColumns: ColumnsType<ActivityLogEntry> = [
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      render: (value: string) => (
        <Text strong className="capitalize">
          {value.replace(/_/g, " ")}
        </Text>
      ),
    },
    {
      title: "User",
      key: "user",
      render: (_, record) => (
        <div>
          <div className="font-medium">
            {record.user?.name || record.email || "Unknown"}
          </div>
          <div className="text-xs text-gray-500">
            {record.user?.email || record.email || "—"}{" "}
            {record.user?.role && `• ${record.user.role}`}
          </div>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: ActivityLogEntry["status"]) => (
        <Tag color={status === "success" ? "green" : "red"}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "IP Address",
      dataIndex: "ipAddress",
      key: "ipAddress",
      render: (ip?: string) => ip || "-",
    },
    {
      title: "Device / Agent",
      dataIndex: "userAgent",
      key: "userAgent",
      ellipsis: true,
      render: (ua?: string) => ua || "-",
    },
    {
      title: "Details",
      key: "metadata",
      render: (_, record) => {
        const reason = record.metadata?.reason;
        if (reason) {
          return <Tag color="orange">{reason.replace(/_/g, " ")}</Tag>;
        }
        return "-";
      },
    },
    {
      title: "Time",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (value: string) => new Date(value).toLocaleString(),
    },
  ];

  const sessionColumns: ColumnsType<UserManagementUser> = [
    {
      title: "Admin",
      key: "user",
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.name}</div>
          <div className="text-xs text-gray-500">{record.email}</div>
        </div>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      render: (_, record) => {
        const lastLogin = getUserLastLogin(record._id, activityLogs);
        if (!lastLogin) {
          return <Tag color="default">Inactive</Tag>;
        }
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const isActive = lastLogin > sevenDaysAgo;
        return (
          <Tag color={isActive ? "green" : "default"}>
            {isActive ? "Active" : "Expired"}
          </Tag>
        );
      },
    },
    {
      title: "Last Active",
      key: "lastActive",
      width: 180,
      render: (_, record) => {
        const lastLogin = getUserLastLogin(record._id, activityLogs);
        if (!lastLogin) return <Text type="secondary">Never</Text>;
        const now = new Date();
        const diffMs = now.getTime() - lastLogin.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeAgo = "";
        if (diffMins < 60) {
          timeAgo = `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
        } else if (diffHours < 24) {
          timeAgo = `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
        } else {
          timeAgo = `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
        }

        return (
          <div>
            <div className="text-sm">{timeAgo}</div>
            <div className="text-xs text-gray-500">
              {lastLogin.toLocaleString()}
            </div>
          </div>
        );
      },
    },
    {
      title: "Roles",
      dataIndex: "role",
      key: "role",
      render: (_: string, record) => (
        <div>
          <Tag color={record.role === "super-admin" ? "red" : "blue"}>
            {getRoleDisplayName(record.role)}
          </Tag>
          {record.roles && record.roles.length > 0 ? (
            <Space wrap size={[4, 4]} className="mt-1">
              {record.roles.map((assignedRole) => (
                <Tag key={assignedRole._id} color="cyan">
                  {assignedRole.name}
                </Tag>
              ))}
            </Space>
          ) : (
            <div className="text-xs text-gray-500 mt-1">No custom roles</div>
          )}
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      render: (_, user) => (
        <Button
          danger
          size="small"
          disabled={forceLogout.isPending || user._id === currentUserId}
          loading={
            forceLogout.isPending && forceLogout.variables?.userId === user._id
          }
          onClick={() => confirmForceLogout(user)}
        >
          Force Logout
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Title level={2}>Super Admin Profile</Title>
        <Paragraph type="secondary">
          Monitor security activity, manage your credentials, and control admin
          sessions from one place.
        </Paragraph>
      </div>

      <Card
        title="Activity Log"
        extra={<Button onClick={() => refetch()}>Refresh</Button>}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Recent admin logins, password changes, and suspicious attempts are captured here."
        />
        <Table<ActivityLogEntry>
          rowKey="_id"
          columns={activityColumns}
          dataSource={activityLogs}
          loading={isLoadingLogs}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Card title="Change Password">
        <Form form={form} layout="vertical" onFinish={handlePasswordSubmit}>
          <Form.Item
            label="Current Password"
            name="currentPassword"
            rules={[{ required: true, message: "Enter your current password" }]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Form.Item
            label="New Password"
            name="newPassword"
            rules={[
              { required: true, message: "Enter a new password" },
              { min: 8, message: "Password must be at least 8 characters" },
            ]}
          >
            <Input.Password placeholder="Minimum 8 characters" />
          </Form.Item>
          <Form.Item
            label="Confirm Password"
            name="confirm"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Confirm your new password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Repeat new password" />
          </Form.Item>
          <Space>
            <Button
              type="primary"
              loading={changePassword.isPending}
              onClick={handlePasswordSubmit}
            >
              Update Password
            </Button>
            <Button onClick={() => form.resetFields()}>Reset</Button>
          </Space>
        </Form>
      </Card>

      <Card
        title="Admin Session Control"
        extra={
          <Tag color="green">
            {adminUsers.length} Active Session
            {adminUsers.length !== 1 ? "s" : ""}
          </Tag>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Showing only admins with currently active sessions (logged in within last 7 days)."
        />
        {adminUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No active admin sessions found.
          </div>
        ) : (
          <Table<UserManagementUser>
            rowKey="_id"
            columns={sessionColumns}
            dataSource={adminUsers}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>
    </div>
  );
};

export default SuperAdminProfile;
