import {
  Button,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  BlockOutlined,
  DeleteOutlined,
  EyeOutlined,
  KeyOutlined,
  SafetyOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import { memo, useMemo } from "react";
import type { UserManagementUser } from "../../types/userManagement";
import PermissionButton from "../PermissionButton";
import PermissionGate from "../PermissionGate";
import { getRoleColor, getRoleDisplayName } from "../../utils/userManagement";
import { USER_MANAGEMENT_UI_CONFIG } from "../../config/userManagement";
import { useModulePermissions } from "../../hooks/useModulePermissions";

const { Text } = Typography;

interface UserTableProps {
  users: UserManagementUser[];
  isLoading: boolean;
  onViewPermissions: (user: UserManagementUser) => void;
  onAssignRoles: (user: UserManagementUser) => void;
  onResetPassword: (user: UserManagementUser) => void;
  onDelete: (id: string, name: string) => void;
  onBlock: (user: UserManagementUser, isBlocked: boolean) => void;
  isDeleting: boolean;
  isBlocking: boolean;
}

export const UserTable = memo(
  ({
    users,
    isLoading,
    onViewPermissions,
    onAssignRoles,
    onResetPassword,
    onDelete,
    onBlock,
    isDeleting,
    isBlocking,
  }: UserTableProps) => {
    const userManagementPermissions = useModulePermissions("userManagement");
    const hasAnyAction = userManagementPermissions.canView || 
                         userManagementPermissions.canUpdate || 
                         userManagementPermissions.canDelete || 
                         userManagementPermissions.canBlock ||
                         userManagementPermissions.canAssign;
    
    const columns = useMemo(
      () => [
        {
          title: "User",
          key: "user",
          width: 250,
          render: (_: unknown, record: UserManagementUser) => (
            <Space>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                {record.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 500 }}>{record.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.email}
                </Text>
              </div>
            </Space>
          ),
        },
        {
          title: "Base Role",
          dataIndex: "role",
          key: "role",
          width: 140,
          render: (role: string) => (
            <Tag color={getRoleColor(role)} style={{ fontWeight: 500 }}>
              {getRoleDisplayName(role)}
            </Tag>
          ),
        },
        {
          title: "Assigned Roles",
          key: "assignedRoles",
          width: 300,
          render: (_: unknown, record: UserManagementUser) => {
            if (!record.roles || record.roles.length === 0) {
              return (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  No custom roles
                </Text>
              );
            }
            return (
              <Space wrap size={[4, 4]}>
                {record.roles.map((r) => (
                  <Tag key={r._id} color="cyan" style={{ margin: 0 }}>
                    {r.name}
                  </Tag>
                ))}
              </Space>
            );
          },
        },
        {
          title: "Status",
          key: "status",
          width: 150,
          render: (_: unknown, record: UserManagementUser) => (
            <Space direction="vertical" size={4}>
              <Tag color={record.isEmailVerified ? "green" : "orange"}>
                {record.isEmailVerified ? "Verified" : "Unverified"}
              </Tag>
              {record.isBlocked && (
                <Tag color="red">Blocked</Tag>
              )}
            </Space>
          ),
        },
        {
          title: "Created",
          dataIndex: "createdAt",
          key: "createdAt",
          width: 120,
          render: (date: string) => (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {new Date(date).toLocaleDateString()}
            </Text>
          ),
        },
        ...(hasAnyAction
          ? [
              {
                title: "Actions",
                key: "actions",
                width: 300,
                fixed: "right" as const,
                render: (_: unknown, record: UserManagementUser) => (
                  <Space>
                    <PermissionGate module="userManagement" permission="view">
                      <Tooltip title="View Permissions">
                        <Button
                          type="text"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => onViewPermissions(record)}
                        />
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate module="userManagement" permission="assign">
                      <Tooltip title="Assign Roles">
                        <PermissionButton
                          module="userManagement"
                          permission="assign"
                          type="text"
                          size="small"
                          icon={<SafetyOutlined />}
                          onClick={() => onAssignRoles(record)}
                        >
                          <span />
                        </PermissionButton>
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate module="userManagement" permission="update">
                      <Tooltip title="Reset Password">
                        <PermissionButton
                          module="userManagement"
                          permission="update"
                          type="text"
                          size="small"
                          icon={<KeyOutlined />}
                          onClick={() => onResetPassword(record)}
                        >
                          <span />
                        </PermissionButton>
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate module="userManagement" permission="block">
                      <Tooltip title={record.isBlocked ? "Unblock User" : "Block User"}>
                        <PermissionButton
                          module="userManagement"
                          permission="block"
                          type="text"
                          danger={!record.isBlocked}
                          size="small"
                          icon={record.isBlocked ? <UnlockOutlined /> : <BlockOutlined />}
                          onClick={() => onBlock(record, !record.isBlocked)}
                          loading={isBlocking}
                        >
                          <span />
                        </PermissionButton>
                      </Tooltip>
                    </PermissionGate>
                    <PermissionGate module="userManagement" permission="delete">
                      <Tooltip title="Delete User">
                        <PermissionButton
                          module="userManagement"
                          permission="delete"
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => onDelete(record._id, record.name)}
                          loading={isDeleting}
                        >
                          <span />
                        </PermissionButton>
                      </Tooltip>
                    </PermissionGate>
                  </Space>
                ),
              },
            ]
          : []),
      ],
      [onViewPermissions, onAssignRoles, onDelete, onBlock, isDeleting, isBlocking, hasAnyAction, userManagementPermissions]
    );

    return (
      <Table<UserManagementUser>
        rowKey="_id"
        columns={columns}
        dataSource={users}
        loading={isLoading}
        pagination={{
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} admin users`,
          pageSizeOptions: Array.from(USER_MANAGEMENT_UI_CONFIG.table.pageSizeOptions) as (string | number)[],
          style: { marginTop: 16 },
        }}
        scroll={{ x: USER_MANAGEMENT_UI_CONFIG.table.scrollX }}
        style={{ borderRadius: 6 }}
      />
    );
  }
);

UserTable.displayName = "UserTable";

