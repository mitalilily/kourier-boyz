import { SearchOutlined } from "@ant-design/icons";
import { Card, Checkbox, Divider, Form, Input, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import {
  MODULE_NAMES,
  PERMISSION_COLORS,
  ROLE_FORM_RULES,
  ROLE_UI_CONFIG,
} from "../../config/roles";
import { ModulePermissionsField } from "./ModulePermissionsField";

const { Title, Text } = Typography;

interface RoleFormFieldsProps {
  isSystemRole?: boolean;
  readOnly?: boolean;
}

/**
 * Form fields component for role creation/editing
 * Uses ModulePermissionsField which includes Select All functionality
 */
export const RoleFormFields = ({
  isSystemRole,
  readOnly = false,
}: RoleFormFieldsProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter modules based on search term
  const filteredModules = useMemo(() => {
    if (!searchTerm.trim()) return MODULE_NAMES;
    const term = searchTerm.toLowerCase();
    return MODULE_NAMES.filter((module) =>
      module.label.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  return (
    <>
      <Form.Item
        name="name"
        label={
          <Text strong>
            Role Name <Text type="danger">*</Text>
          </Text>
        }
        rules={readOnly ? [] : ROLE_FORM_RULES.name}
      >
        <Input
          size="large"
          placeholder="e.g., Content Moderator"
          disabled={isSystemRole || readOnly}
          readOnly={readOnly}
        />
      </Form.Item>

      <Form.Item
        name="description"
        label={<Text strong>Description</Text>}
        tooltip="Optional description explaining the role's purpose"
        rules={readOnly ? [] : ROLE_FORM_RULES.description}
      >
        <Input.TextArea
          rows={3}
          size="large"
          placeholder="Describe the role and its purpose..."
          maxLength={ROLE_UI_CONFIG.maxDescriptionLength}
          showCount
          disabled={readOnly}
          readOnly={readOnly}
        />
      </Form.Item>

      <Divider style={{ margin: "24px 0" }} />

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div>
            <Title level={4} style={{ marginBottom: 4 }}>
              Permissions
            </Title>
            <Text type="secondary" style={{ display: "block", fontSize: 13 }}>
              Select permissions for each module.
            </Text>
          </div>
          <Input
            placeholder="Search modules..."
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
        </div>

        {filteredModules.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "#8c8c8c",
            }}
          >
            <Text type="secondary">
              No modules found matching "{searchTerm}"
            </Text>
          </div>
        ) : (
          <div
            style={{
              maxHeight: ROLE_UI_CONFIG.permissionsMaxHeight,
              overflowY: "auto",
              paddingRight: 8,
            }}
          >
            {filteredModules.map((module) => (
              <Card
                key={module.key}
                size="small"
                style={{
                  marginBottom: 12,
                  border: "1px solid #e8e8e8",
                }}
                title={
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text strong style={{ fontSize: 14 }}>
                      {module.label}
                    </Text>
                    {module.viewOnly && (
                      <Tag color="default" style={{ fontSize: 11, margin: 0 }}>
                        Read Only
                      </Tag>
                    )}
                  </div>
                }
              >
                {module.viewOnly ? (
                  // View-only module - just show a single "view" checkbox
                  <Form.Item
                    name={`permissions_${module.key}`}
                    style={{ marginBottom: 0 }}
                    valuePropName="checked"
                    getValueFromEvent={(e) => (e ? ["view"] : [])}
                    getValueProps={(value) => ({
                      checked: Array.isArray(value) && value.includes("view"),
                    })}
                  >
                    <Checkbox disabled={readOnly}>
                      <Tag
                        color={PERMISSION_COLORS.view}
                        style={{
                          margin: 0,
                          fontSize: 12,
                          padding: "2px 8px",
                        }}
                      >
                        View
                      </Tag>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, marginLeft: 8 }}
                      >
                        Allow viewing this module (read-only access)
                      </Text>
                    </Checkbox>
                  </Form.Item>
                ) : (
                  // Regular module with all permissions
                  <Form.Item
                    name={`permissions_${module.key}`}
                    style={{ marginBottom: 0 }}
                  >
                    <ModulePermissionsField
                      moduleLabel={module.label}
                      readOnly={readOnly}
                    />
                  </Form.Item>
                )}
              </Card>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            background: "#fafafa",
            borderRadius: 6,
            fontSize: 12,
            color: "#8c8c8c",
          }}
        >
          Showing {filteredModules.length} of {MODULE_NAMES.length} modules
        </div>
      </div>
    </>
  );
};
