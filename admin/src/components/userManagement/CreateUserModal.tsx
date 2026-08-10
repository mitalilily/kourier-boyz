import {
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined, SafetyOutlined } from "@ant-design/icons";
import { memo, useCallback } from "react";
import type { FormInstance } from "antd/es/form";
import type { Role } from "../../api/roles";
import {
  USER_FORM_RULES,
  USER_MANAGEMENT_UI_CONFIG,
} from "../../config/userManagement";

const { Text } = Typography;

interface CreateUserModalProps {
  open: boolean;
  form: FormInstance;
  allRoles?: Role[];
  loading: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export const CreateUserModal = memo(
  ({
    open,
    form,
    allRoles,
    loading,
    onCancel,
    onSubmit,
  }: CreateUserModalProps) => {
    const handleCancel = useCallback(() => {
      form.resetFields();
      onCancel();
    }, [form, onCancel]);

    return (
      <Modal
        title={
          <Space>
            <PlusOutlined />
            <span>Create New Admin User</span>
          </Space>
        }
        open={open}
        onOk={onSubmit}
        onCancel={handleCancel}
        okText="Create User"
        okButtonProps={{ loading, size: "large" }}
        cancelButtonProps={{ size: "large" }}
        width={USER_MANAGEMENT_UI_CONFIG.modalWidths.create}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
          initialValues={{ role: "user" }}
        >
          <Form.Item name="name" label="Full Name" rules={USER_FORM_RULES.name}>
            <Input size="large" placeholder="John Doe" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email Address"
            rules={USER_FORM_RULES.email}
          >
            <Input size="large" placeholder="john.doe@example.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={USER_FORM_RULES.password}
          >
            <Input.Password size="large" placeholder="Minimum 8 characters" />
          </Form.Item>

          <Form.Item name="phone" label="Phone Number (Optional)">
            <Input size="large" placeholder="+1 234 567 8900" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Base Role"
            rules={USER_FORM_RULES.role}
            tooltip="Determines the base access level for this account"
          >
            <Select
              size="large"
              options={[
                { label: "Admin User", value: "user" },
                { label: "Super Admin", value: "super-admin" },
              ]}
            />
          </Form.Item>

          <Divider style={{ margin: "16px 0" }} />

          <Form.Item
            name="roleIds"
            label={
              <Space>
                <SafetyOutlined />
                <span>
                  Assign Roles <Text type="danger">*</Text>
                </span>
              </Space>
            }
            rules={USER_FORM_RULES.roleIds}
            help="Select roles to assign to this admin user. Permissions from all roles will be combined. This user will be created as an admin user."
          >
            <Select
              mode="multiple"
              size="large"
              placeholder="Select roles to assign"
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
          </Form.Item>

          {/* Selected Roles Display - Always visible when roles are selected */}
          <Form.Item
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.roleIds !== currentValues.roleIds
            }
            noStyle
          >
            {({ getFieldValue }) => {
              const selectedRoleIds = getFieldValue("roleIds") || [];
              return selectedRoleIds.length > 0 ? (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    background: "#f0f7ff",
                    borderRadius: 6,
                    border: "1px solid #91d5ff",
                  }}
                >
                  <Text
                    strong
                    style={{
                      fontSize: 13,
                      display: "block",
                      marginBottom: 8,
                      color: "#1890ff",
                    }}
                  >
                    Selected Roles ({selectedRoleIds.length}):
                  </Text>
                  <Space wrap>
                    {selectedRoleIds.map((roleId: string) => {
                      const role = allRoles?.find((r) => r._id === roleId);
                      return role ? (
                        <Tag
                          key={roleId}
                          color="cyan"
                          style={{
                            padding: "4px 12px",
                            fontSize: 13,
                            marginBottom: 4,
                          }}
                        >
                          {role.name}
                        </Tag>
                      ) : null;
                    })}
                  </Space>
                </div>
              ) : (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    background: "#fff7e6",
                    borderRadius: 6,
                    border: "1px solid #ffd591",
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    No roles selected. Please select at least one role above.
                  </Text>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    );
  }
);

CreateUserModal.displayName = "CreateUserModal";
