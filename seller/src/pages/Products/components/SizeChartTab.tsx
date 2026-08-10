import { EditOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Empty,
  Image,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
} from "antd";
import { useState } from "react";
import type { FormInstance } from "antd/es/form";
import type { SizeChart } from "../../../api/sizeCharts";
import {
  useSizeCharts,
  useDeleteSizeChart,
} from "../../../api/sizeChartQueries";
import SizeChartFormModal from "./SizeChartFormModal";

const { Title, Text } = Typography;

interface SizeChartTabProps {
  form: FormInstance;
  productId?: string;
  isEdit: boolean;
  variants?: Array<{
    id: string;
    attributes: Record<string, string>;
  }>;
  variantAttributes?: string[];
  sizeChartData?: {
    title: string;
    description?: string;
    measurementType: "US" | "UK" | "EU" | "IN" | "custom";
    measurements: Array<{ name: string; unit: "cm" | "inch" }>;
    rows: Array<{
      size: string;
      measurements: Array<{ name: string; value: number | string }>;
    }>;
    image?: string;
    isActive?: boolean;
    imageFile?: File | null;
  } | null;
  onSizeChartChange?: (data: SizeChartTabProps["sizeChartData"]) => void;
}

const SizeChartTab: React.FC<SizeChartTabProps> = ({
  productId,
  isEdit,
  variants = [],
  variantAttributes = [],
  sizeChartData,
  onSizeChartChange,
}) => {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<SizeChart | null>(null);

  const {
    data: sizeChartsResponse,
    isLoading,
    refetch,
  } = useSizeCharts(productId || undefined);
  const deleteMutation = useDeleteSizeChart();

  // Use existing size chart from API if editing, otherwise use form state
  const sizeChart =
    isEdit && productId
      ? sizeChartsResponse?.data?.[0] || null
      : sizeChartData
      ? ({
          ...sizeChartData,
          _id: "draft",
          chartType: "product" as const,
          createdAt: "",
          updatedAt: "",
        } as SizeChart)
      : null;

  const handleCreate = () => {
    setEditingChart(null);
    setFormModalOpen(true);
  };

  const handleEdit = () => {
    setEditingChart(sizeChart);
    setFormModalOpen(true);
  };

  const handleDelete = async () => {
    if (!sizeChart?._id) return;

    try {
      await deleteMutation.mutateAsync(sizeChart._id);
      message.success("Size chart deleted successfully");
      refetch();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      message.error(
        err?.response?.data?.error || "Failed to delete size chart"
      );
    }
  };

  const handleFormSuccess = () => {
    setFormModalOpen(false);
    setEditingChart(null);
    if (isEdit && productId) {
      refetch();
    }
  };

  if (!productId && isEdit) {
    return (
      <Card>
        <Empty description="Size charts can only be managed for existing products. Please save the product first." />
      </Card>
    );
  }

  if (isLoading && productId) {
    return (
      <Card>
        <Spin size="large" style={{ display: "block", margin: "50px auto" }} />
      </Card>
    );
  }

  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Size Chart
              </Title>
              <Text type="secondary" style={{ fontSize: "14px" }}>
                Add a size chart to help customers choose the right size for
                your product
              </Text>
            </div>
            {!sizeChart ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                Create Size Chart
              </Button>
            ) : (
              <Space>
                <Button icon={<EditOutlined />} onClick={handleEdit}>
                  Edit
                </Button>
                <Popconfirm
                  title="Delete Size Chart"
                  description="Are you sure you want to delete this size chart? This action cannot be undone."
                  onConfirm={handleDelete}
                  okText="Yes, Delete"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            )}
          </div>

          {sizeChart ? (
            <div>
              <Card size="small" style={{ marginBottom: 16 }}>
                <Space
                  direction="vertical"
                  size="middle"
                  style={{ width: "100%" }}
                >
                  <div>
                    <Text strong>Title: </Text>
                    <Text>{sizeChart.title}</Text>
                  </div>
                  {sizeChart.description && (
                    <div>
                      <Text strong>Description: </Text>
                      <Text>{sizeChart.description}</Text>
                    </div>
                  )}
                  <div>
                    <Text strong>Measurement Standard: </Text>
                    <Tag>{sizeChart.measurementType}</Tag>
                  </div>
                  <div>
                    <Text strong>Status: </Text>
                    <Tag color={sizeChart.isActive ? "green" : "default"}>
                      {sizeChart.isActive ? "Active" : "Inactive"}
                    </Tag>
                  </div>
                </Space>
              </Card>

              {sizeChart.image && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ display: "block", marginBottom: 8 }}>
                    Size Chart Image:
                  </Text>
                  <Image
                    src={sizeChart.image}
                    alt={sizeChart.title}
                    style={{ maxWidth: "100%", borderRadius: 4 }}
                    preview
                  />
                </div>
              )}

              {sizeChart.measurements && sizeChart.measurements.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ display: "block", marginBottom: 8 }}>
                    Measurements:
                  </Text>
                  <Space wrap>
                    {sizeChart.measurements.map((m, index: number) => (
                      <Tag key={index}>
                        {m.name} ({m.unit})
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}

              {sizeChart.rows && sizeChart.rows.length > 0 && (
                <div>
                  <Text strong style={{ display: "block", marginBottom: 8 }}>
                    Size Chart Table:
                  </Text>
                  <Table
                    dataSource={sizeChart.rows.map((row, index: number) => ({
                      ...row,
                      key: index,
                    }))}
                    columns={[
                      {
                        title: "Size",
                        dataIndex: "size",
                        key: "size",
                        width: 100,
                      },
                      ...(sizeChart.measurements || []).map((measurement) => ({
                        title: `${measurement.name} (${measurement.unit})`,
                        key: measurement.name,
                        dataIndex: ["measurements", measurement.name],
                        render: (
                          _: unknown,
                          record: {
                            measurements?: Array<{
                              name: string;
                              value: number | string;
                            }>;
                          }
                        ) => {
                          const measurementValue = record.measurements?.find(
                            (m) => m.name === measurement.name
                          )?.value;
                          return measurementValue || "-";
                        },
                      })),
                    ]}
                    pagination={false}
                    size="small"
                    scroll={{ x: "max-content" }}
                  />
                </div>
              )}
            </div>
          ) : (
            <Empty
              description="No size chart created yet. Click 'Create Size Chart' to add one."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Space>
      </Card>

      <SizeChartFormModal
        open={formModalOpen}
        productId={productId || ""}
        editingChart={editingChart}
        variants={variants}
        variantAttributes={variantAttributes}
        sizeChartData={sizeChartData}
        onSizeChartChange={onSizeChartChange}
        onCancel={() => {
          setFormModalOpen(false);
          setEditingChart(null);
        }}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
};

export default SizeChartTab;
