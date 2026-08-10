import { App, Card, Form, Space, Typography } from "antd";
import { PlusOutlined, SafetyOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { ModulePermissions, Role } from "../api/roles";
import {
  useCreateRole,
  useDeleteRole,
  useRoles,
  useUpdateRole,
} from "../api/roles";
import PermissionButton from "../components/PermissionButton";
import { RoleForm } from "../components/roles/RoleForm";
import { RoleTable } from "../components/roles/RoleTable";
import { useModulePermissions } from "../hooks/useModulePermissions";
import { MODULE_NAMES } from "../config/roles";
import { transformFormFieldsToPermissions } from "../utils/roles";

const { Title, Text } = Typography;

/**
 * Roles Management Page
 *
 * Main page component for managing roles and permissions.
 * Handles role creation, editing, deletion, and displays role information.
 */
const Roles = () => {
  const { message, modal } = App.useApp();
  const { data: roles, isLoading } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  // Permission checks
  const permissions = useModulePermissions("roleManagement");
  const showActionsColumn = permissions.canUpdate || permissions.canDelete;

  // State management
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();

  /**
   * Handle create new role
   */
  const handleCreate = () => {
    setEditingRole(null);
    form.resetFields();
    setDrawerVisible(true);
  };

  /**
   * Handle edit existing role
   */
  const handleEdit = (role: Role) => {
    setEditingRole(role);

    // Transform permissions object to form field format
    const formFields: Record<string, unknown> = {
      name: role.name,
      description: role.description,
    };

    MODULE_NAMES.forEach((module) => {
      const modulePerms = role.permissions[module.key];
      if (modulePerms && modulePerms.length > 0) {
        formFields[`permissions_${module.key}`] = modulePerms;
      }
    });

    form.setFieldsValue(formFields);
    setDrawerVisible(true);
  };

  /**
   * Handle delete role
   */
  const handleDelete = (role: Role) => {
    if (role.isSystemRole) {
      message.error("Cannot delete system roles");
      return;
    }

    modal.confirm({
      title: "Delete Role",
      content: `Are you sure you want to delete "${role.name}"? This action cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      onOk: () => {
        deleteRole.mutate(role._id, {
          onSuccess: () => {
            message.success("Role deleted successfully");
          },
          onError: (err: unknown) => {
            const error = err as { response?: { data?: { error?: string } } };
            message.error(
              error.response?.data?.error || "Failed to delete role"
            );
          },
        });
      },
    });
  };

  /**
   * Check if permissions object has at least one permission
   */
  const hasAnyPermission = (permissions: ModulePermissions): boolean => {
    return Object.values(permissions).some(
      (modulePerms) => modulePerms && modulePerms.length > 0
    );
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const permissions: ModulePermissions =
        transformFormFieldsToPermissions(values);

      // Validate that at least one module has at least one permission
      if (!hasAnyPermission(permissions)) {
        message.error(
          "Please select at least one permission in at least one module. Users with this role won't be able to see anything without permissions."
        );
        return;
      }

      if (editingRole) {
        updateRole.mutate(
          {
            id: editingRole._id,
            data: {
              name: values.name,
              description: values.description,
              permissions,
            },
          },
          {
            onSuccess: () => {
              message.success("Role updated successfully");
              handleCloseDrawer();
            },
            onError: (err: unknown) => {
              const error = err as { response?: { data?: { error?: string } } };
              message.error(
                error.response?.data?.error || "Failed to update role"
              );
            },
          }
        );
      } else {
        createRole.mutate(
          {
            name: values.name,
            description: values.description,
            permissions,
          },
          {
            onSuccess: () => {
              message.success("Role created successfully");
              handleCloseDrawer();
            },
            onError: (err: unknown) => {
              const error = err as { response?: { data?: { error?: string } } };
              message.error(
                error.response?.data?.error || "Failed to create role"
              );
            },
          }
        );
      }
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };

  /**
   * Handle drawer close
   */
  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    form.resetFields();
    setEditingRole(null);
  };

  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* Header Section */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <Title
                level={3}
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <SafetyOutlined style={{ color: "#1890ff" }} />
                Role Management
              </Title>
              <Text
                type="secondary"
                style={{ fontSize: 14, marginTop: 4, display: "block" }}
              >
                Create and manage roles with granular permissions. Assign roles
                to users to control access.
              </Text>
            </div>
            <PermissionButton
              module="roleManagement"
              permission="create"
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              style={{
                height: 40,
                borderRadius: 6,
                fontWeight: 500,
                boxShadow: "0 2px 4px rgba(24,144,255,0.2)",
              }}
            >
              Create Role
            </PermissionButton>
          </div>

          {/* Table Section */}
          <RoleTable
            roles={roles}
            isLoading={isLoading}
            showActionsColumn={showActionsColumn}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </Space>
      </Card>

      {/* Form Drawer */}
      <RoleForm
        open={drawerVisible}
        editingRole={editingRole}
        form={form}
        loading={createRole.isPending || updateRole.isPending}
        onClose={handleCloseDrawer}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default Roles;
