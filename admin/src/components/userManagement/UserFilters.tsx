import { Button, Card, Col, Input, Row, Select, Space } from "antd";
import { FilterOutlined, SearchOutlined } from "@ant-design/icons";
import { memo, useCallback } from "react";
import type { AllUserFilters } from "../../api/users";
import type { Role } from "../../api/roles";

interface UserFiltersProps {
  filters: AllUserFilters;
  selectedRoles: string[];
  allRoles?: Role[];
  onFiltersChange: (filters: AllUserFilters) => void;
  onRolesChange: (roles: string[]) => void;
}

export const UserFilters = memo(
  ({
    filters,
    selectedRoles,
    allRoles,
    onFiltersChange,
    onRolesChange,
  }: UserFiltersProps) => {
    const handleSearchChange = useCallback(
      (value: string) => {
        onFiltersChange({ ...filters, search: value });
      },
      [filters, onFiltersChange]
    );

    const handleReset = useCallback(() => {
      onFiltersChange({});
      onRolesChange([]);
    }, [onFiltersChange, onRolesChange]);

    const filterOptions = [
      { label: "Super Admin", value: "super-admin" },
      { label: "Admin User", value: "user" },
      ...(allRoles?.map((role) => ({
        label: role.name,
        value: role.name,
      })) || []),
    ];

    return (
      <Card
        size="small"
        style={{
          background: "#fafafa",
          border: "1px solid #e8e8e8",
          borderRadius: 6,
          marginBottom: 24,
        }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} lg={8}>
            <Input
              placeholder="Search by name, email, phone..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              allowClear
              size="large"
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ borderRadius: 6 }}
            />
          </Col>
          <Col xs={24} sm={12} lg={10}>
            <Select
              mode="multiple"
              placeholder="Filter by roles (multi-select)"
              allowClear
              size="large"
              style={{ width: "100%", borderRadius: 6 }}
              value={selectedRoles}
              onChange={onRolesChange}
              options={filterOptions}
              maxTagCount="responsive"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Space style={{ width: "100%" }}>
              <Button
                onClick={handleReset}
                size="large"
                style={{ flex: 1, borderRadius: 6 }}
              >
                <FilterOutlined /> Reset
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
    );
  }
);

UserFilters.displayName = "UserFilters";

