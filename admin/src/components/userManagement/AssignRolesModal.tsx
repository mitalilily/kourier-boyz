import {
  Card,
  Descriptions,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { SafetyOutlined } from "@ant-design/icons";
import { memo, useCallback } from "react";
import type { UserManagementUser } from "../../types/userManagement";
import type { Role } from "../../api/roles";
import { useModulePermissions } from "../../hooks/useModulePermissions";
import { getRoleColor, getRoleDisplayName } from "../../utils/userManagement";
import { USER_MANAGEMENT_UI_CONFIG } from "../../config/userManagement";

const { Text } = Typography;

interface AssignRolesModalProps {
  open: boolean;
  user: UserManagementUser | null;
  selectedRoleIds: string[];
  allRoles?: Role[];
  loading: boolean;
  onCancel: () => void;
  onOk: () => void;
  onRoleIdsChange: (roleIds: string[]) => void;
}

export const AssignRolesModal = memo(
  ({
    open,
    user,
    selectedRoleIds,
    allRoles,
    loading,
    onCancel,
    onOk,
    onRoleIdsChange,
  }: AssignRolesModalProps) => {
    const userManagementPermissions = useModulePermissions("userManagement");
    const isReadOnly = !userManagementPermissions.canAssign;
    
    const handleCancel = useCallback(() => {
      onCancel();
    }, [onCancel]);

    if (!user) return null;

    return (
      <Modal
        title={
          <Space>
            <SafetyOutlined />
            <span>Assign Roles to User</span>
          </Space>
        }
        open={open}
        onOk={onOk}
        onCancel={handleCancel}
        okText="Assign Roles"
        okButtonProps={{ 
          loading, 
          size: "large",
          style: { display: isReadOnly ? "none" : "block" }
        }}
        cancelButtonProps={{ size: "large" }}
        cancelText={isReadOnly ? "Close" : "Cancel"}
        width={USER_MANAGEMENT_UI_CONFIG.modalWidths.assignRoles}
      >
        <div style={{ marginTop: 24 }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Card size="small" style={{ background: "#fafafa" }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="User">
                  <Text strong>{user.name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {user.email}
                </Descriptions.Item>
                <Descriptions.Item label="Base Role">
                  <Tag color={getRoleColor(user.role)}>
                    {getRoleDisplayName(user.role)}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <div>
              <Text
                strong
                style={{ fontSize: 14, display: "block", marginBottom: 8 }}
              >
                Select Roles (Multiple Allowed)
              </Text>
              <Select
                mode="multiple"
                style={{ width: "100%" }}
                placeholder="Select roles to assign"
                size="large"
                value={selectedRoleIds}
                onChange={onRoleIdsChange}
                disabled={isReadOnly}
                options={allRoles?.map((role) => ({
                  label: role.name,
                  value: role._id,
                  description: role.description,
                }))}
                optionRender={(option) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{option.label}</div>
                    {option.data.description && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {option.data.description}
                      </Text>
                    )}
                  </div>
                )}
              />
            </div>

            {selectedRoleIds.length > 0 && (
              <div>
                <Text
                  strong
                  style={{ fontSize: 13, display: "block", marginBottom: 8 }}
                >
                  Selected Roles:
                </Text>
                <Space wrap>
                  {selectedRoleIds.map((roleId) => {
                    const role = allRoles?.find((r) => r._id === roleId);
                    return role ? (
                      <Tag
                        key={roleId}
                        color="cyan"
                        style={{ padding: "4px 12px", fontSize: 13 }}
                      >
                        {role.name}
                      </Tag>
                    ) : null;
                  })}
                </Space>
              </div>
            )}

            <div
              style={{
                padding: 16,
                background: "#e6f7ff",
                borderRadius: 6,
                border: "1px solid #91d5ff",
              }}
            >
              <Text style={{ fontSize: 13 }}>
                <strong>💡 Tip:</strong> Permissions from all assigned roles
                will be combined. The user will have access to all modules and
                actions granted by any of their assigned roles.
              </Text>
            </div>
          </Space>
        </div>
      </Modal>
    );
  }
);

AssignRolesModal.displayName = "AssignRolesModal";
