import { Space, Table, Tag, Typography } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { useMemo } from "react";
import type { Role } from "../../api/roles";
import PermissionButton from "../PermissionButton";
import { PermissionsColumn } from "./PermissionsColumn";

const { Text } = Typography;

interface RoleTableProps {
  roles: Role[] | undefined;
  isLoading: boolean;
  showActionsColumn: boolean;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

/**
 * Role table component
 */
export const RoleTable = ({
  roles,
  isLoading,
  showActionsColumn,
  onEdit,
  onDelete,
}: RoleTableProps) => {
  const columns = useMemo(
    () => [
      {
        title: "Role Name",
        dataIndex: "name",
        key: "name",
        width: 200,
        render: (name: string, record: Role) => (
          <Space>
            <SafetyOutlined style={{ color: "#1890ff" }} />
            <Text strong>{name}</Text>
            {record.isSystemRole && (
              <Tag color="red">
                System
              </Tag>
            )}
          </Space>
        ),
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        width: 250,
        ellipsis: true,
        render: (desc: string) => (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {desc || <Text type="secondary" italic>No description</Text>}
          </Text>
        ),
      },
      {
        title: "Permissions",
        key: "permissions",
        width: 300,
        render: (_: unknown, record: Role) => (
          <PermissionsColumn role={record} />
        ),
      },
      ...(showActionsColumn
        ? [
            {
              title: "Actions",
              key: "actions",
              width: 150,
              fixed: "right" as const,
              render: (_: unknown, record: Role) => (
                <Space>
                  <PermissionButton
                    module="roleManagement"
                    permission="update"
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => onEdit(record)}
                    disabled={record.isSystemRole}
                  >
                    Edit
                  </PermissionButton>
                  <PermissionButton
                    module="roleManagement"
                    permission="delete"
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(record)}
                    disabled={record.isSystemRole}
                  >
                    Delete
                  </PermissionButton>
                </Space>
              ),
            },
          ]
        : []),
    ],
    [showActionsColumn, onEdit, onDelete]
  );

  return (
    <Table
      rowKey="_id"
      columns={columns}
      dataSource={roles || []}
      loading={isLoading}
      pagination={{
        showSizeChanger: true,
        showTotal: (total) => `Total ${total} role${total !== 1 ? "s" : ""}`,
        pageSizeOptions: ["10", "20", "50", "100"],
      }}
      scroll={{ x: 1000 }}
      style={{
        borderRadius: 6,
      }}
    />
  );
};

