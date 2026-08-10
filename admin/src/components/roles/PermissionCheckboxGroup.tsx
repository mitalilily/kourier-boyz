import { Checkbox, Col, Row, Tag } from "antd";
import type { Permission } from "../../api/roles";
import { PERMISSIONS, PERMISSION_COLORS } from "../../config/roles";
import { formatPermission } from "../../utils/roles";

interface PermissionCheckboxGroupProps {
  value?: Permission[];
  onChange?: (value: Permission[]) => void;
}

/**
 * Checkbox group component for selecting permissions
 */
export const PermissionCheckboxGroup = ({
  value,
  onChange,
}: PermissionCheckboxGroupProps) => {
  return (
    <Checkbox.Group value={value} onChange={onChange}>
      <Row gutter={[12, 8]}>
        {PERMISSIONS.map((perm: Permission) => (
          <Col key={perm} xs={12} sm={8} md={6} lg={6}>
            <Checkbox value={perm}>
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
  );
};
