import { Badge, Space, Tag, Tooltip, Typography } from "antd";
import type { ModulePermissions, Permission, Role } from "../../api/roles";
import { MODULE_NAMES, PERMISSION_COLORS } from "../../config/roles";
import {
  formatPermission,
  getModulesWithPermissions,
  getPermissionsSummary,
} from "../../utils/roles";

const { Text } = Typography;

interface PermissionsColumnProps {
  role: Role;
}

const PermissionsTooltip = ({ role }: { role: Role }) => {
  const modulesWithPerms = MODULE_NAMES.filter(
    (module: { key: keyof ModulePermissions; label: string }) =>
      (role.permissions?.[module.key]?.length ?? 0) > 0
  );

  if (modulesWithPerms.length === 0) {
    return (
      <div style={{ color: "#000" }}>
        <Text style={{ color: "#000" }}>No permissions assigned</Text>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, color: "#000" }}>
      <Text
        strong
        style={{
          display: "block",
          marginBottom: 8,
          color: "#000",
          fontSize: 14,
        }}
      >
        Permissions:
      </Text>
      {modulesWithPerms.map(
        (module: { key: keyof ModulePermissions; label: string }) => {
          const perms = role.permissions[module.key] || [];
          return (
            <div key={module.key} style={{ marginBottom: 8 }}>
              <Text
                strong
                style={{ fontSize: 13, color: "#000", display: "block" }}
              >
                {module.label}:
              </Text>
              <div style={{ marginTop: 4 }}>
                <Space wrap size={[4, 4]}>
                  {perms.map((perm: Permission) => (
                    <Tag
                      key={perm}
                      color={PERMISSION_COLORS[perm]}
                      style={{ margin: 0, fontSize: 11 }}
                    >
                      {formatPermission(perm)}
                    </Tag>
                  ))}
                </Space>
              </div>
            </div>
          );
        }
      )}
    </div>
  );
};

export const PermissionsColumn = ({ role }: PermissionsColumnProps) => {
  const summary = getPermissionsSummary(role);
  const modulesWithPerms = getModulesWithPermissions(role);

  return (
    <Tooltip
      title={<PermissionsTooltip role={role} />}
      placement="topLeft"
      overlayInnerStyle={{
        backgroundColor: "#fff",
        color: "#000",
        padding: "12px",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
      overlayStyle={{
        maxWidth: "450px",
      }}
    >
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        <Text style={{ fontSize: 13 }}>{summary}</Text>
        {modulesWithPerms.length > 0 && (
          <Space wrap size={[4, 4]}>
            {modulesWithPerms.slice(0, 3).map((moduleKey) => {
              const module = MODULE_NAMES.find((m) => m.key === moduleKey);
              const perms =
                role.permissions?.[
                  moduleKey as keyof typeof role.permissions
                ] || [];
              return (
                <Tag
                  key={moduleKey}
                  color="blue"
                  style={{ margin: 0, fontSize: 11 }}
                >
                  {module?.label || moduleKey}
                  {perms.length > 0 && (
                    <Badge
                      count={perms.length}
                      style={{
                        backgroundColor: "#52c41a",
                        marginLeft: 4,
                      }}
                    />
                  )}
                </Tag>
              );
            })}
            {modulesWithPerms.length > 3 && (
              <Tag color="default" style={{ fontSize: 11 }}>
                +{modulesWithPerms.length - 3} more
              </Tag>
            )}
          </Space>
        )}
      </Space>
    </Tooltip>
  );
};
