import {
  DeleteOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Table,
  Typography,
  message,
  Image,
  Tag,
  Upload,
  Row,
  Col,
  Divider,
} from "antd";
import type { UploadFile } from "antd";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { SizeChart } from "../../../api/sizeCharts";
import { useUpdateSizeChart } from "../../../api/sizeChartQueries";
import { getProductsWithSizeCharts } from "../../../api/sizeCharts";
import type { ProductWithSizeChart } from "../../../api/sizeCharts";

const { TextArea } = Input;
const { Option } = Select;

interface SizeChartFormModalProps {
  open: boolean;
  productId: string;
  editingChart?: SizeChart | null;
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
  onSizeChartChange?: (data: SizeChartFormModalProps["sizeChartData"]) => void;
  onCancel: () => void;
  onSuccess: () => void;
}

interface Measurement {
  name: string;
  unit: "cm" | "inch";
}

interface SizeRow {
  size: string;
  measurements: Array<{ name: string; value: number | string }>;
}

const SizeChartFormModal: React.FC<SizeChartFormModalProps> = ({
  open,
  productId,
  editingChart,
  variants = [],
  variantAttributes = [],
  sizeChartData,
  onSizeChartChange,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [rows, setRows] = useState<SizeRow[]>([]);
  const [productsWithCharts, setProductsWithCharts] = useState<
    ProductWithSizeChart[]
  >([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [imageFile, setImageFile] = useState<UploadFile | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const isEditing = !!editingChart;

  const updateMutation = useUpdateSizeChart();
  const loading = updateMutation.isPending;

  const loadProductsWithSizeCharts = useCallback(
    async (search?: string) => {
      setLoadingProducts(true);
      try {
        const response = await getProductsWithSizeCharts({
          limit: 100,
          search: search || undefined,
        });

        // Filter out current product
        const filtered = response.data.filter((p) => p._id !== productId);

        setProductsWithCharts(filtered);
      } catch (error) {
        console.error("Failed to load products with size charts:", error);
        setProductsWithCharts([]);
      } finally {
        setLoadingProducts(false);
      }
    },
    [productId]
  );

  // Load products with size charts when modal opens
  useEffect(() => {
    if (open && !isEditing) {
      loadProductsWithSizeCharts();
    }
  }, [open, isEditing, loadProductsWithSizeCharts]);

  // Get size attribute key (case-insensitive)
  const sizeAttributeKey = variantAttributes.find(
    (attr) => attr.toLowerCase() === "size"
  );

  // Get unique size values from variants
  const variantSizes = useMemo(() => {
    if (!sizeAttributeKey) return [];
    return Array.from(
      new Set(
        variants
          .map((v) => v.attributes?.[sizeAttributeKey])
          .filter((s): s is string => !!s && typeof s === "string")
      )
    ).sort();
  }, [sizeAttributeKey, variants]);

  // Initialize form data when editing or creating
  useEffect(() => {
    if (open) {
      if (editingChart) {
        form.setFieldsValue({
          title: editingChart.title,
          description: editingChart.description,
          measurementType: editingChart.measurementType,
          isActive: editingChart.isActive,
        });
        setMeasurements(editingChart.measurements || []);
        setRows(editingChart.rows || []);
        // Set image preview if exists
        if (editingChart.image) {
          setImagePreview(editingChart.image);
          setImageFile(null);
        } else {
          setImagePreview(null);
          setImageFile(null);
        }
      } else if (sizeChartData) {
        // Load from form state if available
        form.setFieldsValue({
          title: sizeChartData.title,
          description: sizeChartData.description,
          measurementType: sizeChartData.measurementType,
          isActive: sizeChartData.isActive,
        });
        setMeasurements(sizeChartData.measurements || []);
        setRows(sizeChartData.rows || []);
        // Set image preview if exists
        if (sizeChartData.image) {
          setImagePreview(sizeChartData.image);
          setImageFile(null);
        } else {
          setImagePreview(null);
          setImageFile(null);
        }
      } else {
        form.resetFields();
        form.setFieldsValue({
          measurementType: "IN",
          isActive: true,
        });
        setMeasurements([]);
        setImagePreview(null);
        setImageFile(null);
        // Prefill rows with variant sizes if available
        if (variantSizes.length > 0) {
          setRows(
            variantSizes.map((size) => ({
              size,
              measurements: [],
            }))
          );
        } else {
          setRows([]);
        }
      }
    }
  }, [open, editingChart, sizeChartData, form, variantSizes]);

  const handleAddMeasurement = () => {
    setMeasurements([...measurements, { name: "", unit: "cm" }]);
  };

  const handleRemoveMeasurement = (index: number) => {
    const newMeasurements = measurements.filter((_, i) => i !== index);
    setMeasurements(newMeasurements);
    // Remove this measurement from all rows
    const newRows = rows.map((row) => ({
      ...row,
      measurements: row.measurements.filter(
        (m) => m.name !== measurements[index].name
      ),
    }));
    setRows(newRows);
  };

  const handleMeasurementChange = (
    index: number,
    field: "name" | "unit",
    value: string
  ) => {
    const newMeasurements = [...measurements];
    const oldName = newMeasurements[index].name;
    newMeasurements[index] = { ...newMeasurements[index], [field]: value };

    // Update measurement names in rows if name changed
    if (field === "name" && oldName) {
      const newRows = rows.map((row) => ({
        ...row,
        measurements: row.measurements.map((m) =>
          m.name === oldName ? { ...m, name: value } : m
        ),
      }));
      setRows(newRows);
    }

    setMeasurements(newMeasurements);
  };

  const handleAddRow = () => {
    const newRow: SizeRow = {
      size: "",
      measurements: measurements.map((m) => ({ name: m.name, value: "" })),
    };
    setRows([...rows, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleRowChange = (
    index: number,
    field: "size" | "measurement",
    measurementIndexOrValue?: number | string,
    value?: number | string
  ) => {
    const newRows = [...rows];
    if (field === "size") {
      newRows[index] = {
        ...newRows[index],
        size: measurementIndexOrValue as string,
      };
    } else if (field === "measurement") {
      const measurementIndex = measurementIndexOrValue as number;
      const measurementValue = value;
      const measurementName = measurements[measurementIndex]?.name;
      if (measurementName) {
        const existingMeasurementIndex = newRows[index].measurements.findIndex(
          (m) => m.name === measurementName
        );
        if (existingMeasurementIndex >= 0) {
          newRows[index].measurements[existingMeasurementIndex] = {
            name: measurementName,
            value: measurementValue as number | string,
          };
        } else {
          newRows[index].measurements.push({
            name: measurementName,
            value: measurementValue as number | string,
          });
        }
      }
    }
    setRows(newRows);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Validate measurements
      if (measurements.length === 0) {
        message.error("Please add at least one measurement");
        return;
      }

      const invalidMeasurements = measurements.filter(
        (m) => !m.name || !m.name.trim()
      );
      if (invalidMeasurements.length > 0) {
        message.error("Please provide names for all measurements");
        return;
      }

      // Validate rows
      if (rows.length === 0) {
        message.error("Please add at least one size row");
        return;
      }

      const invalidRows = rows.filter((r) => !r.size || !r.size.trim());
      if (invalidRows.length > 0) {
        message.error("Please provide size values for all rows");
        return;
      }

      // Ensure all rows have all measurements
      const validatedRows = rows.map((row) => ({
        size: row.size.trim(),
        measurements: measurements.map((m) => {
          const existing = row.measurements.find((rm) => rm.name === m.name);
          return {
            name: m.name,
            value: existing?.value ?? "",
          };
        }),
      }));

      // Check for empty measurement values
      const hasEmptyValues = validatedRows.some((row) =>
        row.measurements.some(
          (m) => m.value === "" || m.value === null || m.value === undefined
        )
      );
      if (hasEmptyValues) {
        message.error("Please fill in all measurement values for all sizes");
        return;
      }

      const sizeChartFormData = {
        title: values.title,
        description: values.description,
        measurementType: values.measurementType,
        measurements: measurements.map((m) => ({
          name: m.name.trim(),
          unit: m.unit,
        })),
        rows: validatedRows,
        image: imagePreview || undefined,
        isActive: values.isActive !== undefined ? values.isActive : true,
      };

      // If editing and product exists, update via API
      if (isEditing && editingChart && productId) {
        const updateData = {
          ...sizeChartFormData,
        };
        await updateMutation.mutateAsync({
          id: editingChart._id,
          data: updateData,
          imageFile: imageFile?.originFileObj || null,
        });
        message.success("Size chart updated successfully");
      } else {
        // Store in form state (will be saved when product is saved)
        if (onSizeChartChange) {
          onSizeChartChange({
            ...sizeChartFormData,
            imageFile: imageFile?.originFileObj || null,
          });
        }
        message.success(
          "Size chart saved. It will be created when you save the product."
        );
      }

      onSuccess();
      form.resetFields();
      setMeasurements([]);
      setRows([]);
      setImageFile(null);
      setImagePreview(null);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errorFields" in error) {
        // Form validation errors
        return;
      }
      const err = error as { response?: { data?: { error?: string } } };
      message.error(err?.response?.data?.error || "Failed to save size chart");
    }
  };

  const handleCopyFromProduct = (productIdWithChart: string) => {
    const productWithChart = productsWithCharts.find(
      (p) => p._id === productIdWithChart
    );
    if (!productWithChart?.sizeChart) {
      message.warning("Size chart not found");
      return;
    }

    const sourceChart = productWithChart.sizeChart;
    // Copy the size chart data
    form.setFieldsValue({
      title: sourceChart.title,
      description: sourceChart.description,
      measurementType: sourceChart.measurementType,
      isActive: sourceChart.isActive,
    });
    setMeasurements(sourceChart.measurements || []);
    setRows(sourceChart.rows || []);
    // Set image preview if exists
    if (sourceChart.image) {
      setImagePreview(sourceChart.image);
      setImageFile(null);
    } else {
      setImagePreview(null);
      setImageFile(null);
    }
    message.success(`Size chart copied from "${productWithChart.name}"`);
  };

  const handleCancel = () => {
    form.resetFields();
    setMeasurements([]);
    setRows([]);
    setImageFile(null);
    setImagePreview(null);
    onCancel();
  };

  const measurementColumns = [
    {
      title: "Measurement Name",
      dataIndex: "name",
      key: "name",
      render: (_: unknown, record: Measurement, index: number) => (
        <Input
          placeholder="e.g., Chest, Waist, Length"
          value={record.name}
          onChange={(e) =>
            handleMeasurementChange(index, "name", e.target.value)
          }
        />
      ),
    },
    {
      title: "Unit",
      dataIndex: "unit",
      key: "unit",
      width: 120,
      render: (_: unknown, record: Measurement, index: number) => (
        <Select
          value={record.unit}
          onChange={(value) => handleMeasurementChange(index, "unit", value)}
          style={{ width: "100%" }}
        >
          <Option value="cm">cm</Option>
          <Option value="inch">inch</Option>
        </Select>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 80,
      render: (_: unknown, __: Measurement, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveMeasurement(index)}
          disabled={measurements.length === 1}
        />
      ),
    },
  ];

  const rowColumns = [
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      width: 120,
      render: (_: unknown, record: SizeRow, index: number) => (
        <Input
          placeholder="e.g., S, M, L, XL"
          value={record.size}
          onChange={(e) => handleRowChange(index, "size", e.target.value)}
        />
      ),
    },
    ...measurements.map((measurement, mIndex) => ({
      title: `${measurement.name} (${measurement.unit})`,
      key: measurement.name,
      dataIndex: ["measurements", measurement.name],
      render: (_: unknown, record: SizeRow, rowIndex: number) => {
        const measurementValue = record.measurements.find(
          (m) => m.name === measurement.name
        )?.value;
        return (
          <Input
            placeholder="e.g., 36 or 36-38"
            value={measurementValue || ""}
            onChange={(e) => {
              const value = e.target.value;
              // Allow numbers, ranges (e.g., "36-38"), and empty string
              if (value === "" || /^[\d.-]+$/.test(value)) {
                handleRowChange(rowIndex, "measurement", mIndex, value);
              }
            }}
          />
        );
      },
    })),
    {
      title: "Action",
      key: "action",
      width: 80,
      render: (_: unknown, __: SizeRow, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveRow(index)}
        />
      ),
    },
  ];

  return (
    <Modal
      title={isEditing ? "Edit Size Chart" : "Create Size Chart"}
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText={isEditing ? "Update" : "Create"}
      cancelText="Cancel"
      width={900}
      confirmLoading={loading}
      style={{ top: 20 }}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        {/* Basic Information Section */}
        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              name="title"
              label="Title"
              rules={[{ required: true, message: "Please enter a title" }]}
              style={{ marginBottom: 16 }}
            >
              <Input placeholder="e.g., Men's T-Shirt Size Chart" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="measurementType"
              label="Measurement Standard"
              rules={[
                {
                  required: true,
                  message: "Please select a measurement standard",
                },
              ]}
              initialValue="IN"
              style={{ marginBottom: 16 }}
            >
              <Select>
                <Option value="US">US</Option>
                <Option value="UK">UK</Option>
                <Option value="EU">EU</Option>
                <Option value="IN">IN (India)</Option>
                <Option value="custom">Custom</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label="Description"
          style={{ marginBottom: 16 }}
        >
          <TextArea
            rows={2}
            placeholder="Optional description for the size chart"
            maxLength={500}
            showCount
          />
        </Form.Item>

        {/* Image and Settings Row */}
        <Row gutter={16} align="bottom">
          <Col span={16}>
            <Form.Item
              name="image"
              label="Size Chart Image (Optional)"
              style={{ marginBottom: 16 }}
            >
              <Upload
                listType="picture-card"
                maxCount={1}
                fileList={
                  imagePreview && !imageFile
                    ? [
                        {
                          uid: "-1",
                          name: "existing-image",
                          status: "done",
                          url: imagePreview,
                        } as UploadFile,
                      ]
                    : imageFile
                    ? [imageFile]
                    : []
                }
                beforeUpload={(file) => {
                  setImageFile({
                    uid: file.uid,
                    name: file.name,
                    status: "done",
                    originFileObj: file,
                  } as UploadFile);
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    setImagePreview(e.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                  return false;
                }}
                onRemove={() => {
                  setImageFile(null);
                  setImagePreview(null);
                  form.setFieldValue("image", undefined);
                }}
                onChange={(info) => {
                  // Handle file list changes
                  if (info.fileList.length === 0) {
                    setImageFile(null);
                    setImagePreview(null);
                  }
                }}
                accept="image/*"
                showUploadList={{
                  showPreviewIcon: true,
                  showRemoveIcon: true,
                }}
              >
                {!imagePreview && !imageFile && (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>Upload</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="isActive"
              label="Status"
              valuePropName="checked"
              initialValue={true}
              style={{ marginBottom: 16 }}
            >
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Col>
        </Row>

        {/* Copy from Product (only when creating) */}
        {!isEditing && (
          <Form.Item
            label="Copy from Another Product"
            style={{ marginBottom: 16 }}
          >
            <Select
              placeholder="Search and select a product..."
              style={{ width: "100%" }}
              loading={loadingProducts}
              showSearch
              filterOption={false}
              onSearch={(value) => loadProductsWithSizeCharts(value)}
              notFoundContent={
                loadingProducts ? (
                  <div style={{ textAlign: "center", padding: "12px" }}>
                    <Typography.Text type="secondary">
                      Loading...
                    </Typography.Text>
                  </div>
                ) : productsWithCharts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "12px" }}>
                    <Typography.Text type="secondary">
                      No products found
                    </Typography.Text>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px" }}>
                    <Typography.Text type="secondary">
                      No matches
                    </Typography.Text>
                  </div>
                )
              }
              onChange={handleCopyFromProduct}
              value={undefined}
              allowClear
              optionLabelProp="label"
            >
              {productsWithCharts.map((product) => (
                <Select.Option
                  key={product._id}
                  value={product._id}
                  label={product.name}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "2px 0",
                    }}
                  >
                    <Image
                      src={product.mainImage || "/store/brand/kourier-boyz-mark.png"}
                      alt={product.name}
                      width={32}
                      height={32}
                      style={{
                        objectFit: "cover",
                        borderRadius: "4px",
                        border: "1px solid #e5e7eb",
                        flexShrink: 0,
                      }}
                      fallback="/store/brand/kourier-boyz-mark.png"
                      preview={false}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          marginBottom: "2px",
                        }}
                      >
                        <Typography.Text strong style={{ fontSize: "13px" }}>
                          {product.name}
                        </Typography.Text>
                        <Tag
                          color="green"
                          style={{ margin: 0, fontSize: "11px" }}
                        >
                          {product.sizeChart.measurementType}
                        </Tag>
                      </div>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: "11px" }}
                      >
                        {product.sizeChart.measurements?.length || 0}{" "}
                        measurement
                        {product.sizeChart.measurements?.length !== 1
                          ? "s"
                          : ""}{" "}
                        • {product.sizeChart.rows?.length || 0} size
                        {product.sizeChart.rows?.length !== 1 ? "s" : ""}
                      </Typography.Text>
                    </div>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Divider style={{ margin: "16px 0" }} />

        {/* Measurements Section */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Typography.Text strong style={{ fontSize: 14 }}>
              Measurements
            </Typography.Text>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddMeasurement}
            >
              Add
            </Button>
          </div>
          {measurements.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "16px",
                color: "#999",
                fontSize: "12px",
              }}
            >
              No measurements added. Click "Add" to get started.
            </div>
          ) : (
            <Table
              columns={measurementColumns}
              dataSource={measurements.map((m, i) => ({ ...m, key: i }))}
              pagination={false}
              size="small"
              style={{ marginBottom: 0 }}
            />
          )}
        </div>

        <Divider style={{ margin: "16px 0" }} />

        {/* Size Rows Section */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Typography.Text strong style={{ fontSize: 14 }}>
              Size Rows
            </Typography.Text>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddRow}
              disabled={measurements.length === 0}
            >
              Add
            </Button>
          </div>
          {rows.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "16px",
                color: "#999",
                fontSize: "12px",
              }}
            >
              {measurements.length === 0
                ? "Add measurements first, then add size rows."
                : 'No size rows added. Click "Add" to get started.'}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table
                columns={rowColumns}
                dataSource={rows.map((r, i) => ({ ...r, key: i }))}
                pagination={false}
                size="small"
                scroll={{ x: "max-content" }}
              />
            </div>
          )}
        </div>
      </Form>
    </Modal>
  );
};

export default SizeChartFormModal;
