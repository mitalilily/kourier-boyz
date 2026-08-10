import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import type { TableProps } from "antd";
import { Badge, Image, Space, Table, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useMemo } from "react";
import PermissionButton from "../PermissionButton";
import { useModulePermissions } from "../../hooks/useModulePermissions";
import type { Category } from "../../types/category";

dayjs.extend(relativeTime);

const { Text } = Typography;

type TableCategory = Category & { __depth: number };

const getCategoryId = (
  cat: Category | null | undefined
): string | undefined => {
  if (!cat) return undefined;
  return cat._id || (cat as unknown as { id?: string }).id;
};

const getParentId = (cat: Category): string | undefined => {
  const parent = cat.parent;
  if (!parent) return undefined;
  if (typeof parent === "string") return parent;
  return parent._id || (parent as unknown as { id?: string }).id;
};

const buildFlattenedCategories = (categories: Category[]): TableCategory[] => {
  const childrenMap = new Map<string, Category[]>();
  const orderMap = new Map<string, number>();

  categories.forEach((cat, index) => {
    const parentId = getParentId(cat);
    if (parentId) {
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(cat);
    }
    const id = getCategoryId(cat);
    if (id && !orderMap.has(id)) {
      orderMap.set(id, index);
    }
  });

  const roots = categories.filter((cat) => !getParentId(cat));

  const result: TableCategory[] = [];
  const visited = new Set<string>();

  const appendWithChildren = (cat: Category, depth: number) => {
    const id = getCategoryId(cat);
    if (id) {
      if (visited.has(id)) return;
      visited.add(id);
    }

    result.push({ ...cat, __depth: depth });
    if (!id) return;

    const children = childrenMap.get(id);
    if (!children) return;

    children.forEach((child) => appendWithChildren(child, depth + 1));
  };

  roots.forEach((root) => appendWithChildren(root, 0));

  return result;
};

interface CategoryTableProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
  selectedRowKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const CategoryTable = ({
  categories,
  onEdit,
  onDelete,
  loading,
  selectedRowKeys,
  onSelectionChange,
}: CategoryTableProps) => {
  const flattenedCategories = useMemo(
    () => buildFlattenedCategories(categories),
    [categories]
  );
  const permissions = useModulePermissions("categories");

  // Only show Actions column if user has at least one action permission
  const showActionsColumn = permissions.canUpdate || permissions.canDelete;

  const columns: TableProps<TableCategory>["columns"] = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, record: TableCategory) => {
        const isChild = record.__depth > 0;
        return (
          <div
            className={
              isChild
                ? "pl-4 border-l-2 border-blue-100 rounded-sm bg-blue-50/10"
                : undefined
            }
            style={{ paddingLeft: isChild ? record.__depth * 16 : 0 }}
          >
            <Space direction="vertical" size={2}>
              <Text className="font-medium text-gray-900">{name}</Text>

              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.slug}
              </Text>
            </Space>
          </div>
        );
      },
    },
    {
      title: "Images",
      key: "images",
      width: 160,
      render: (_: unknown, record: TableCategory) => (
        <div className="flex gap-2 items-center">
          <div className="relative group">
            <Image
              src={record.mainImage}
              alt="Main"
              width={50}
              height={50}
              className="rounded-lg object-cover border border-gray-200"
              style={{ width: 50, height: 50 }}
              preview={{
                mask: (
                  <div className="flex items-center justify-center">
                    <EyeOutlined className="text-white" />
                  </div>
                ),
              }}
            />
          </div>
          <div className="relative group">
            <Image
              src={record?.hoverImage}
              alt="Hover"
              width={50}
              height={50}
              className="rounded-lg object-cover border border-gray-200"
              style={{ width: 50, height: 50 }}
              preview={{
                mask: (
                  <div className="flex items-center justify-center">
                    <EyeOutlined className="text-white" />
                  </div>
                ),
              }}
            />
          </div>
          {record?.banners && record?.banners.length > 0 && (
            <Tooltip title={`${record.banners?.length} banner(s)`}>
              <div className="w-6 h-6 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg border border-blue-200 text-xs font-medium">
                +{record.banners.length}
              </div>
            </Tooltip>
          )}
        </div>
      ),
    },
    // {
    //   title: 'Description',
    //   dataIndex: 'description',
    //   key: 'description',
    //   ellipsis: true,
    //   render: (desc: string) => (
    //     <Tooltip title={desc}>
    //       <span className="text-gray-600 text-sm">{desc || '-'}</span>
    //     </Tooltip>
    //   ),
    // },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      filters: [
        { text: "Active", value: "active" },
        { text: "Inactive", value: "inactive" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: string) => (
        <Tag color={status === "active" ? "green" : "red"}>
          {status?.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Certificate Rules",
      key: "certificateRules",
      width: 260,
      render: (_: unknown, record: TableCategory) => {
        const ownCertificates = record.requiredCertificates || [];
        const effectiveCertificates =
          record.effectiveRequiredCertificates || ownCertificates;
        const inheritedCertificates =
          record.inheritedRequiredCertificates || [];
        const overridesParent = record.overrideParentCertificateRule;
        const inheritsParent = record.inheritsParentCertificateRule;

        if (effectiveCertificates.length === 0) {
          return <Tag color="default">No Certificate Needed</Tag>;
        }

        const renderCertificateTags = (
          certificates: string[],
          color: string
        ) => (
          <Space size={[4, 4]} wrap>
            {certificates.map((cert) => (
              <Tag key={cert} color={color}>
                {cert.replace(/_/g, " ")}
              </Tag>
            ))}
          </Space>
        );

        return (
          <Space direction="vertical" size={4}>
            <Space align="center" size={6}>
              <SafetyCertificateOutlined style={{ color: "#1677ff" }} />
              <Text strong>Compliance Required</Text>
            </Space>
            {overridesParent ? (
              <>
                <Tag color="volcano">Overrides Parent Rule</Tag>
                {renderCertificateTags(ownCertificates, "purple")}
              </>
            ) : (
              <>
                {ownCertificates.length > 0 && (
                  <div>
                    <Text type="secondary">Category Specific</Text>
                    {renderCertificateTags(ownCertificates, "purple")}
                  </div>
                )}
                {inheritsParent && inheritedCertificates.length > 0 && (
                  <div>
                    <Text type="secondary">Inherited from Parent</Text>
                    {renderCertificateTags(inheritedCertificates, "blue")}
                  </div>
                )}
                {!overridesParent &&
                  ownCertificates.length === 0 &&
                  inheritedCertificates.length === 0 && (
                    <Tag color="default">No Certificate Needed</Tag>
                  )}
              </>
            )}
          </Space>
        );
      },
    },
    // {
    //   title: 'Products',
    //   dataIndex: 'productCount',
    //   key: 'productCount',
    //   width: 100,
    //   align: 'center',
    //   sorter: (a, b) => (a.productCount || 0) - (b.productCount || 0),
    //   render: (count: number) => (
    //     <Badge count={count || 0} showZero style={{ backgroundColor: '#1890ff' }} />
    //   ),
    // },
    {
      title: "Subcategories",
      key: "subcategories",
      width: 120,
      align: "center",
      render: (_: unknown, record: TableCategory) => {
        const subcategoryCount = record.subcategories?.length || 0;
        return subcategoryCount > 0 ? (
          <Badge
            count={subcategoryCount}
            style={{ backgroundColor: "#52c41a" }}
            title={`${subcategoryCount} subcategory(ies)`}
          />
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      title: "Top",
      dataIndex: "top",
      key: "top",
      width: 80,
      align: "center",
      filters: [
        { text: "Top", value: true },
        { text: "Regular", value: false },
      ],
      onFilter: (value, record) => record.top === value,
      render: (top: boolean) =>
        top ? <span className="text-2xl">⭐</span> : "-",
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      render: (date: string) => (
        <Tooltip title={dayjs(date).format("YYYY-MM-DD HH:mm")}>
          <span className="text-gray-600 text-sm">{dayjs(date).fromNow()}</span>
        </Tooltip>
      ),
    },
    // Only include Actions column if user has at least one action permission
    ...(showActionsColumn
      ? [
          {
            title: "Actions",
            key: "actions",
            width: 120,
            fixed: "right" as const,
            render: (_: unknown, record: TableCategory) => (
              <div className="flex gap-2">
                <PermissionButton
                  module="categories"
                  permission="update"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => onEdit(record)}
                  className="text-blue-600 hover:text-blue-700"
                  title="Edit"
                >
                  <span />
                </PermissionButton>
                <PermissionButton
                  module="categories"
                  permission="delete"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDelete(record._id || record.id || "")}
                  title="Delete"
                >
                  <span />
                </PermissionButton>
              </div>
            ),
          },
        ]
      : []),
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      onSelectionChange(selectedKeys as string[]);
    },
  };

  return (
    <Table<TableCategory>
      rowSelection={rowSelection}
      columns={columns}
      dataSource={flattenedCategories}
      rowKey={(record) =>
        record._id || (record as unknown as { id?: string }).id || ""
      }
      loading={loading}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total, range) =>
          `${range[0]}-${range[1]} of ${total} categories`,
      }}
      scroll={{ x: 1200 }}
    />
  );
};

export default CategoryTable;
