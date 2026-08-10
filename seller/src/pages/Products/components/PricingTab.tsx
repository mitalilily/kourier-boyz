import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Row,
  Table,
  Typography,
  type FormInstance,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useState } from "react";

const { Text } = Typography;

type VariantType = {
  id: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  price?: number;
  costPrice?: number;
  comparePrice?: number;
  discountPercent?: number;
  stock?: number;
  lowStockThreshold?: number;
  mainImage: UploadFile | string | null;
  images: Array<UploadFile | string>;
  isDefault: boolean;
  status: string;
};

interface PricingTabProps {
  form: FormInstance;
  variants: Array<VariantType>;
  onVariantsChange: (variants: Array<VariantType>) => void;
}

const PricingTab = ({ form, variants, onVariantsChange }: PricingTabProps) => {
  const [price, setPrice] = useState(form.getFieldValue("price") || 0);
  const [costPrice, setCostPrice] = useState(
    form.getFieldValue("costPrice") || 0
  );
  const [discountPercent, setDiscountPercent] = useState(
    form.getFieldValue("discountPercent") || 0
  );
  const [isBulkModalVisible, setIsBulkModalVisible] = useState(false);
  const [bulkForm] = Form.useForm();
  const hasVariants = form.getFieldValue("hasVariants") || false;

  const effectivePrice = price - (price * discountPercent) / 100;
  const profit = effectivePrice - costPrice;
  // Use gross margin percentage: profit as a percentage of selling price
  const margin = effectivePrice > 0 ? (profit / effectivePrice) * 100 : 0;

  // Watch for form changes to update local state
  useEffect(() => {
    const currentPrice = form.getFieldValue("price") || 0;
    const currentCostPrice = form.getFieldValue("costPrice") || 0;
    const currentDiscountPercent = form.getFieldValue("discountPercent") || 0;

    setPrice(currentPrice);
    setCostPrice(currentCostPrice);
    setDiscountPercent(currentDiscountPercent);
  }, [form]);

  // Update variant pricing
  const updateVariantPricing = (
    variantId: string,
    field: string,
    value: unknown
  ) => {
    const updatedVariants = variants.map((variant) =>
      variant.id === variantId ? { ...variant, [field]: value } : variant
    );
    onVariantsChange(updatedVariants);
  };

  // Bulk update all variants
  const handleBulkUpdate = () => {
    bulkForm.validateFields().then((values) => {
      const updatedVariants = variants.map((variant) => ({
        ...variant,
        price:
          values.price !== undefined && values.price !== null
            ? values.price
            : variant.price,
        costPrice:
          values.costPrice !== undefined && values.costPrice !== null
            ? values.costPrice
            : variant.costPrice,
        discountPercent:
          values.discountPercent !== undefined &&
          values.discountPercent !== null
            ? values.discountPercent
            : variant.discountPercent,
      }));
      onVariantsChange(updatedVariants);
      setIsBulkModalVisible(false);
      bulkForm.resetFields();
    });
  };

  // Variant pricing table columns
  const variantColumns = [
    {
      title: "Variant",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: VariantType) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: "#666" }}>{record.sku}</div>
        </div>
      ),
    },
    {
      title: "Price (₹)",
      dataIndex: "price",
      key: "price",
      width: 120,
      render: (price: number, record: VariantType) => (
        <InputNumber
          value={price || 0}
          min={0}
          style={{ width: "100%" }}
          onChange={(value) =>
            updateVariantPricing(record.id, "price", value || 0)
          }
        />
      ),
    },
    {
      title: "Cost Price (₹)",
      dataIndex: "costPrice",
      key: "costPrice",
      width: 120,
      render: (costPrice: number, record: VariantType) => (
        <InputNumber
          value={costPrice || 0}
          min={0}
          style={{ width: "100%" }}
          onChange={(value) =>
            updateVariantPricing(record.id, "costPrice", value || 0)
          }
        />
      ),
    },
    {
      title: "Compare at Price (₹)",
      dataIndex: "comparePrice",
      key: "comparePrice",
      width: 140,
      render: (comparePrice: number, record: VariantType) => (
        <InputNumber
          value={comparePrice || 0}
          min={0}
          style={{ width: "100%" }}
          onChange={(value) =>
            updateVariantPricing(record.id, "comparePrice", value || 0)
          }
        />
      ),
    },
    {
      title: "Discount (%)",
      dataIndex: "discountPercent",
      key: "discountPercent",
      width: 120,
      render: (_discountPercent: number, record: VariantType) => (
        <InputNumber
          value={record.discountPercent ?? 0}
          min={0}
          max={100}
          style={{ width: "100%" }}
          onChange={(value) =>
            updateVariantPricing(record.id, "discountPercent", value || 0)
          }
        />
      ),
    },
    {
      title: "Effective Price",
      key: "effectivePrice",
      width: 120,
      render: (_: unknown, record: VariantType) => {
        const variantPrice = record.price || 0;
        const variantDiscount = record.discountPercent || 0;
        const effectivePrice =
          variantPrice - (variantPrice * variantDiscount) / 100;
        return <Text strong>₹{effectivePrice.toFixed(2)}</Text>;
      },
    },
    {
      title: "Profit",
      key: "profit",
      width: 100,
      render: (_: unknown, record: VariantType) => {
        const variantPrice = record.price || 0;
        const variantCost = record.costPrice || 0;
        const variantDiscount = record.discountPercent || 0;
        const effectivePrice =
          variantPrice - (variantPrice * variantDiscount) / 100;
        const profit = effectivePrice - variantCost;
        return (
          <Text style={{ color: profit >= 0 ? "#52c41a" : "#ff4d4f" }}>
            ₹{profit.toFixed(2)}
          </Text>
        );
      },
    },
  ];

  return (
    <Card title="Pricing" style={{ marginBottom: 16 }}>
      {hasVariants ? (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Alert
              message="Variant Pricing Management"
              description="Set individual prices, cost prices, and discounts for each variant. Use the button on the right to apply the same price, cost price, and discount to all variants at once."
              type="info"
              showIcon
              style={{ flex: 1, marginRight: 16 }}
            />
            {variants.length > 0 && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsBulkModalVisible(true)}
                style={{ flexShrink: 0 }}
              >
                Set for All
              </Button>
            )}
          </div>

          {variants.length > 0 ? (
            <Table
              key={variants.length}
              columns={variantColumns}
              dataSource={variants}
              rowKey="id"
              pagination={false}
              size="small"
              style={{ marginBottom: 16 }}
            />
          ) : (
            <Alert
              message="No variants yet"
              description="Generate variants in the Variants tab to edit pricing here."
              type="warning"
              showIcon
            />
          )}

          {/* Removed default settings for new variants as per requirements */}
        </div>
      ) : (
        <div>
          {/* Simple Product Pricing */}
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="price"
                label="Price (₹)"
                rules={[{ required: true, message: "Please enter price" }]}
              >
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  placeholder="0.00"
                  onChange={(value) => setPrice(value || 0)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="comparePrice"
                label="Compare at Price (₹)"
                tooltip="Used for strikethrough pricing"
              >
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="costPrice"
                label="Cost Price (₹)"
                tooltip="Your cost to produce/acquire this product"
              >
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  placeholder="0.00"
                  onChange={(value) => setCostPrice(value || 0)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="discountPercent"
                label="Discount (%)"
                tooltip="Applied on price"
              >
                <InputNumber
                  min={0}
                  max={100}
                  style={{ width: "100%" }}
                  placeholder="0"
                  onChange={(value) => setDiscountPercent(value || 0)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="discountStartDate" label="Discount Start Date">
                <DatePicker
                  style={{ width: "100%" }}
                  placeholder="Select start date"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="discountEndDate" label="Discount End Date">
                <DatePicker
                  style={{ width: "100%" }}
                  placeholder="Select end date"
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Live Pricing Insights for Simple Products */}
          {(price > 0 || costPrice > 0) && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                backgroundColor: "#f6ffed",
                border: "1px solid #b7eb8f",
                borderRadius: 8,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <Text strong style={{ color: "#389e0d", fontSize: 16 }}>
                💰 Live Pricing Insights
              </Text>
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#e6f7ff",
                    borderRadius: 6,
                    border: "1px solid #91d5ff",
                  }}
                >
                  <Text style={{ color: "#1890ff", fontWeight: 500 }}>
                    Effective Price: ₹{effectivePrice.toFixed(2)}
                  </Text>
                </div>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: profit >= 0 ? "#f6ffed" : "#fff2f0",
                    borderRadius: 6,
                    border: `1px solid ${profit >= 0 ? "#b7eb8f" : "#ffccc7"}`,
                  }}
                >
                  <Text
                    style={{
                      color: profit >= 0 ? "#52c41a" : "#ff4d4f",
                      fontWeight: 600,
                    }}
                  >
                    Profit: ₹{profit.toFixed(2)}
                  </Text>
                </div>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: margin >= 0 ? "#f6ffed" : "#fff2f0",
                    borderRadius: 6,
                    border: `1px solid ${margin >= 0 ? "#b7eb8f" : "#ffccc7"}`,
                  }}
                >
                  <Text
                    style={{
                      color: margin >= 0 ? "#52c41a" : "#ff4d4f",
                      fontWeight: 600,
                    }}
                  >
                    Margin: {margin.toFixed(1)}%
                  </Text>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        title="Set Pricing for All Variants"
        open={isBulkModalVisible}
        onOk={handleBulkUpdate}
        onCancel={() => {
          setIsBulkModalVisible(false);
          bulkForm.resetFields();
        }}
        okText="Apply to All Variants"
        cancelText="Cancel"
        width={500}
      >
        <Form
          form={bulkForm}
          layout="vertical"
          initialValues={{
            price: undefined,
            costPrice: undefined,
            discountPercent: undefined,
          }}
        >
          <Form.Item
            name="price"
            label="Price (₹)"
            tooltip="Set price for all variants. Leave empty to keep existing values."
          >
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              placeholder="Enter price"
            />
          </Form.Item>
          <Form.Item
            name="costPrice"
            label="Cost Price (₹)"
            tooltip="Set cost price for all variants. Leave empty to keep existing values."
          >
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              placeholder="Enter cost price"
            />
          </Form.Item>
          <Form.Item
            name="discountPercent"
            label="Discount (%)"
            tooltip="Set discount percentage for all variants. Leave empty to keep existing values."
          >
            <InputNumber
              min={0}
              max={100}
              style={{ width: "100%" }}
              placeholder="Enter discount percentage"
            />
          </Form.Item>
          <Alert
            message={`This will update ${variants.length} variant(s)`}
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>
    </Card>
  );
};

export default PricingTab;
