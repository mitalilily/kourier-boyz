import { Button, Drawer, Form, Space } from "antd";
import type { FormInstance } from "antd/es/form";
import { SafetyOutlined } from "@ant-design/icons";
import type { Role } from "../../api/roles";
import PermissionButton from "../PermissionButton";
import PermissionGate from "../PermissionGate";
import { useModulePermissions } from "../../hooks/useModulePermissions";
import { ROLE_UI_CONFIG } from "../../config/roles";
import { RoleFormFields } from "./RoleFormFields";

interface RoleFormProps {
  open: boolean;
  editingRole: Role | null;
  form: FormInstance;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export const RoleForm = ({
  open,
  editingRole,
  form,
  loading,
  onClose,
  onSubmit,
}: RoleFormProps) => {
  const roleManagementPermissions = useModulePermissions("roleManagement");
  const isReadOnly = editingRole 
    ? !roleManagementPermissions.canUpdate 
    : !roleManagementPermissions.canCreate;

  return (
    <Drawer
      title={
        <Space>
          <SafetyOutlined style={{ color: "#1890ff" }} />
          <span>{editingRole ? "Edit Role" : "Create Role"}</span>
        </Space>
      }
      width={ROLE_UI_CONFIG.drawerWidth}
      open={open}
      onClose={onClose}
      footer={
        <Space style={{ float: "right" }}>
          <Button onClick={onClose} size="large">
            {isReadOnly ? "Close" : "Cancel"}
          </Button>
          <PermissionGate 
            module="roleManagement" 
            permission={editingRole ? "update" : "create"}
          >
            <PermissionButton
              module="roleManagement"
              permission={editingRole ? "update" : "create"}
              type="primary"
              onClick={onSubmit}
              loading={loading}
              size="large"
            >
              {editingRole ? "Update Role" : "Create Role"}
            </PermissionButton>
          </PermissionGate>
        </Space>
      }
      styles={{
        body: {
          padding: 24,
        },
      }}
    >
      <Form form={form} layout="vertical">
        <RoleFormFields 
          isSystemRole={editingRole?.isSystemRole} 
          readOnly={isReadOnly}
        />
      </Form>
    </Drawer>
  );
};
