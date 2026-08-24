import { Card, Col, Form, Input, Row, type FormInstance } from "antd";
import { useCallback, useEffect, useState } from "react";
import type { Category } from "../../../api/categories";
import { useMyCertificates } from "../../../api/certificates";
import CertificateRequirementAlert from "../../../components/CertificateRequirementAlert";
import CertificateUploadModal from "../../../components/CertificateUploadModal";
import HierarchicalCategorySelect from "../../../components/HierarchicalCategorySelect";

const { TextArea } = Input;

interface ProductInfoTabProps {
  form: FormInstance;
  categories: Category[];
}

const ProductInfoTab = ({ form, categories }: ProductInfoTabProps) => {
  const generateSkuFromName = (name: string) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const hasVariants = !!form.getFieldValue("hasVariants");

  // Certificate state
  const [selectedCategory, setSelectedCategory] = useState<
    Category | undefined
  >();
  const [certificateModalOpen, setCertificateModalOpen] = useState(false);
  const { data: sellerCertificates, refetch: refetchCertificates } =
    useMyCertificates();

  useEffect(() => {
    const initialCategoryId = form.getFieldValue("category") as
      | string
      | undefined;
    if (initialCategoryId) {
      setSelectedCategory(
        categories.find((cat) => cat._id === initialCategoryId) || undefined
      );
    }
  }, [categories, form]);

  const handleCategoryChange = useCallback(
    (categoryId: string | undefined) => {
      // Update selected category state for certificate checking
      setSelectedCategory(
        categoryId
          ? categories.find((cat) => cat._id === categoryId) || undefined
          : undefined
      );
    },
    [categories]
  );

  /**
   * Handle certificate upload success
   * Refreshes certificate list and keeps category selected
   */
  const handleCertificateUploaded = useCallback(async () => {
    await refetchCertificates();
    // Keep the category selected so user can continue
  }, [refetchCertificates]);

  const effectiveCertificates =
    selectedCategory?.effectiveRequiredCertificates ??
    selectedCategory?.requiredCertificates ??
    [];
  const inheritedCertificates =
    selectedCategory?.inheritedRequiredCertificates ?? [];
  const inheritsParentRule =
    selectedCategory?.inheritsParentCertificateRule ?? false;

  return (
    <>
      <Card title="Basic Information" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label="Product Name"
              rules={[{ required: true, message: "Please enter product name" }]}
            >
              <Input
                placeholder="Enter product name"
                onBlur={() => {
                  const nameVal = form.getFieldValue("name") as string;
                  const skuVal = form.getFieldValue("sku") as
                    | string
                    | undefined;
                  if (nameVal && !skuVal) {
                    form.setFieldsValue({ sku: generateSkuFromName(nameVal) });
                  }
                }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="sku"
              label="SKU"
              extra={
                hasVariants
                  ? "SKU is controlled by the default variant when variants are enabled."
                  : undefined
              }
            >
              <Input
                placeholder="Enter SKU (auto-generated if empty)"
                disabled={hasVariants || !!form.getFieldValue("name")}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="category"
              label="Category"
              rules={[{ required: true, message: "Please select category" }]}
            >
              <HierarchicalCategorySelect
                categories={categories}
                placeholder="Select category"
                showSubcategories={true}
                onChange={(value) => {
                  const categoryId = value as string | undefined;
                  // Update form field value first
                  form.setFieldValue("category", categoryId);
                  // Then update selected category for certificate checking
                  handleCategoryChange(categoryId);
                }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="brand" label="Brand">
              <Input placeholder="Enter brand name" />
            </Form.Item>
          </Col>

          <Col xs={24}>
            <Form.Item
              name="description"
              label="Description"
              rules={[{ required: true, message: "Please enter description" }]}
            >
              <TextArea
                rows={4}
                placeholder="Enter detailed product description"
              />
            </Form.Item>
          </Col>

          <Col xs={24}>
            <Form.Item name="shortDescription" label="Short Description">
              <TextArea
                rows={2}
                placeholder="Enter short description (optional)"
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Certificate Requirement Alert */}
      {effectiveCertificates.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <CertificateRequirementAlert
            requiredCertificates={effectiveCertificates}
            inheritedCertificates={inheritedCertificates}
            inheritsParentRule={inheritsParentRule}
            sellerCertificates={sellerCertificates}
            onUploadClick={() => setCertificateModalOpen(true)}
          />
        </Card>
      )}

      {/* Certificate Upload Modal */}
      {effectiveCertificates.length > 0 && (
        <CertificateUploadModal
          open={certificateModalOpen}
          onClose={() => setCertificateModalOpen(false)}
          requiredCertificates={effectiveCertificates}
          inheritedCertificates={inheritedCertificates}
          onUploaded={handleCertificateUploaded}
        />
      )}
    </>
  );
};

export default ProductInfoTab;
