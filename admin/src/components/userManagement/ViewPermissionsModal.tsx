import { Button, Card, Collapse, Descriptions, Modal, Space, Tag, Typography } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { memo, useMemo } from "react";
import type { UserManagementUser } from "../../types/userManagement";
import type { ModulePermissions, Permission, Role } from "../../api/roles";
import { getRoleColor, getRoleDisplayName, formatModuleName } from "../../utils/userManagement";
import { USER_MANAGEMENT_UI_CONFIG, MODULE_DISPLAY_NAMES } from "../../config/userManagement";

const { Title, Text } = Typography;

interface ViewPermissionsModalProps {
  open: boolean;
  user: UserManagementUser | null;
  userRoles?: Role[];
  aggregatedPermissions: ModulePermissions | null;
  onCancel: () => void;
}

export const ViewPermissionsModal = memo(
  ({
    open,
    user,
    userRoles,
    aggregatedPermissions,
    onCancel,
  }: ViewPermissionsModalProps) => {
    const collapseItems = useMemo(() => {
      if (!aggregatedPermissions) return [];
      
      return Object.entries(aggregatedPermissions).map(([module, perms]) => {
        const formattedModule = MODULE_DISPLAY_NAMES[module] || formatModuleName(module);
        return {
          key: module,
          label: (
            <Space>
              <Text strong>{formattedModule}</Text>
              <Tag color="blue">{perms?.length || 0} permissions</Tag>
            </Space>
          ),
          children: (
            <Space wrap>
              {perms?.map((perm: Permission) => (
                <Tag
                  key={perm}
                  color="green"
                  style={{ padding: "4px 12px" }}
                >
                  {perm.charAt(0).toUpperCase() + perm.slice(1)}
                </Tag>
              ))}
            </Space>
          ),
        };
      });
    }, [aggregatedPermissions]);

    if (!user) return null;

    const isSuperAdmin = user.role === "super-admin";
    const hasCustomRoles = userRoles && userRoles.length > 0;

    return (
      <Modal
        title={
          <Space>
            <EyeOutlined />
            <span>User Permissions</span>
          </Space>
        }
        open={open}
        onCancel={onCancel}
        footer={[
          <Button key="close" onClick={onCancel} size="large">
            Close
          </Button>,
        ]}
        width={USER_MANAGEMENT_UI_CONFIG.modalWidths.viewPermissions}
      >
        <div style={{ marginTop: 24 }}>
          <Descriptions
            column={1}
            bordered
            size="small"
            style={{ marginBottom: 24 }}
          >
            <Descriptions.Item label="User">
              <Text strong>{user.name}</Text> ({user.email})
            </Descriptions.Item>
            <Descriptions.Item label="Base Role">
              <Tag color={getRoleColor(user.role)}>
                {getRoleDisplayName(user.role)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Assigned Roles">
              {user.roles && user.roles.length > 0 ? (
                <Space wrap>
                  {user.roles.map((r) => (
                    <Tag key={r._id} color="cyan">
                      {r.name}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">No custom roles assigned</Text>
              )}
            </Descriptions.Item>
          </Descriptions>

          {isSuperAdmin ? (
            <Card
              size="small"
              style={{ background: "#fff7e6", border: "1px solid #ffd591" }}
            >
              <Text strong>
                Super Admin has all permissions across all modules.
              </Text>
            </Card>
          ) : hasCustomRoles ? (
            <div>
              <Title level={5} style={{ marginBottom: 8 }}>
                Aggregated Permissions
              </Title>
              <Text
                type="secondary"
                style={{ display: "block", marginBottom: 16, fontSize: 13 }}
              >
                Permissions from all assigned roles are combined below:
              </Text>
              <Collapse items={collapseItems} />
            </div>
          ) : (
            <Card size="small" style={{ background: "#fafafa" }}>
              <Text type="secondary">
                No custom roles assigned. User has no special permissions
                beyond base role.
              </Text>
            </Card>
          )}
        </div>
      </Modal>
    );
  }
);

ViewPermissionsModal.displayName = "ViewPermissionsModal";

