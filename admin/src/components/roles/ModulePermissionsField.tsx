import { Button, Checkbox, Col, Row, Space, Tag, Typography } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import { useMemo } from "react";
import type { Permission } from "../../api/roles";
import { PERMISSIONS, PERMISSION_COLORS } from "../../config/roles";
import { formatPermission } from "../../utils/roles";

const { Text } = Typography;

interface ModulePermissionsFieldProps {
  value?: Permission[];
  onChange?: (value: Permission[]) => void;
  moduleLabel: string;
  readOnly?: boolean;
}

/**
 * Check if all permissions are selected
 */
const areAllPermissionsSelected = (
  selectedPermissions: Permission[] | undefined,
  allPermissions: Permission[]
): boolean => {
  if (!selectedPermissions || selectedPermissions.length === 0) {
    return false;
  }
  return selectedPermissions.length === allPermissions.length;
};

/**
 * Get indeterminate state (some but not all selected)
 */
const isIndeterminate = (
  selectedPermissions: Permission[] | undefined,
  allPermissions: Permission[]
): boolean => {
  if (!selectedPermissions || selectedPermissions.length === 0) {
    return false;
  }
  return (
    selectedPermissions.length > 0 &&
    selectedPermissions.length < allPermissions.length
  );
};

/**
 * Module permissions field with Select All functionality
 * Reusable component following DRY principles
 */
export const ModulePermissionsField = ({
  value = [],
  onChange,
  readOnly = false,
}: ModulePermissionsFieldProps) => {
  const allSelected = useMemo(
    () => areAllPermissionsSelected(value, PERMISSIONS),
    [value]
  );

  const indeterminate = useMemo(
    () => isIndeterminate(value, PERMISSIONS),
    [value]
  );

  /**
   * Handle Select All toggle
   */
  const handleSelectAll = () => {
    if (onChange) {
      if (allSelected) {
        // Deselect all
        onChange([]);
      } else {
        // Select all
        onChange([...PERMISSIONS]);
      }
    }
  };

  /**
   * Handle individual permission change
   */
  const handlePermissionChange = (checkedValues: Permission[]) => {
    if (onChange) {
      onChange(checkedValues);
    }
  };

  return (
    <div>
      {/* Select All Header */}
      <div
        style={{
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Space align="center" style={{ width: "100%", justifyContent: "space-between" }}>
          <Checkbox
            checked={allSelected}
            indeterminate={indeterminate}
            onChange={handleSelectAll}
            disabled={readOnly}
            style={{ fontWeight: 500 }}
          >
            <Text strong style={{ fontSize: 13 }}>
              Select All Permissions
            </Text>
          </Checkbox>
          {!readOnly && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={handleSelectAll}
              style={{
                padding: 0,
                height: "auto",
                fontSize: 12,
                color: allSelected ? "#1890ff" : "#8c8c8c",
              }}
            >
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
          )}
        </Space>
        {value.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 24, display: "block", marginTop: 4 }}>
            {value.length} of {PERMISSIONS.length} permissions selected
          </Text>
        )}
      </div>

      {/* Permission Checkboxes */}
      <Checkbox.Group 
        value={value} 
        onChange={handlePermissionChange}
        disabled={readOnly}
      >
        <Row gutter={[12, 8]}>
          {PERMISSIONS.map((perm: Permission) => (
            <Col key={perm} xs={12} sm={8} md={6} lg={6}>
              <Checkbox value={perm} disabled={readOnly}>
                <Tag
                  color={PERMISSION_COLORS[perm]}
                  style={{
                    margin: 0,
                    fontSize: 12,
                    padding: "2px 8px",
                  }}
                >
                  {formatPermission(perm)}
                </Tag>
              </Checkbox>
            </Col>
          ))}
        </Row>
      </Checkbox.Group>
    </div>
  );
};

