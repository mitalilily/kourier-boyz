import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  DollarOutlined,
  FileTextOutlined,
  PictureOutlined,
  SearchOutlined,
  TruckOutlined,
  TableOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Form,
  Modal,
  Result,
  Space,
  Spin,
  Tabs,
  Typography,
  type UploadFile,
} from "antd";
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCreateProduct,
  useProduct,
  useUpdateProduct,
} from "../../api/productQueries";
import { useProfile } from "../../api/profileQueries";
import RequirementsAlert from "../../components/RequirementsAlert";
import { useAuthStore } from "../../store/authStore";
import BasicInfoTab from "./components/BasicInfoTab";
import type { FilterMetadataEntry } from "./components/filterMetadataUtils";
import MediaTab from "./components/MediaTab";
import PricingInventoryTab from "./components/PricingInventoryTab";
import ProductFormFooter from "./components/ProductFormFooter";
import SEOAttributesTab from "./components/SEOAttributesTab";
import ShippingPoliciesTab from "./components/ShippingPoliciesTab";
import SizeChartTab from "./components/SizeChartTab";
import VariantsTab from "./components/VariantsTab";
import type { VariantState } from "./productFormUtils";
import useEditProductInitializer from "./useEditProductInitializer";
import useProductCategories from "./useProductCategories";
import useProductSubmit from "./useProductSubmit";
import useTabErrorHighlight, { getTabErrors } from "./useTabErrorHighlight";

const { Title, Text } = Typography;

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const user = useAuthStore((state) => state.user);

  const isEdit = !!id;
  const canManageProducts = user?.isApproved || false;

  // State
  const categories = useProductCategories();
  const [mainImageList, setMainImageList] = useState<UploadFile[]>([]);
  const [imagesList, setImagesList] = useState<UploadFile[]>([]);
  const [videosList, setVideosList] = useState<UploadFile[]>([]);
  const [savingAsDraft, setSavingAsDraft] = useState(false);
  const [specifications, setSpecifications] = useState<
    Array<{ key?: string; value: string }>
  >([]);
  const [tags, setTags] = useState<string[]>([]);
  const [filterMetadata, setFilterMetadata] = useState<FilterMetadataEntry[]>(
    []
  );
  const [activeTab, setActiveTab] = useState<string>("basic-info");
  const [validationErrorModalOpen, setValidationErrorModalOpen] = useState(false);
  const [validationTabErrors, setValidationTabErrors] = useState<
    { tabKey: string; tabLabel: string; errors: { message: string }[] }[]
  >([]);

  // Centralized variant state management
  const [variants, setVariants] = useState<VariantState[]>([]);
  const [variantAttributes, setVariantAttributes] = useState<string[]>([]);
  const [hasVariants, setHasVariants] = useState<boolean>(false);

  // Size chart state
  const [sizeChartData, setSizeChartData] = useState<{
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
  } | null>(null);
  // Centralized variant management functions
  const setVariantsData = useCallback(
    (newVariants: typeof variants) => {
      console.log("newVariants", newVariants);
      console.log("=== SETTING VARIANTS DATA ===");
      console.log("New variants:", newVariants);
      setVariants(newVariants);
      // Also update form state
      form.setFieldsValue({ variants: newVariants });
      console.log("=== END SETTING VARIANTS DATA ===");
    },
    [form]
  );

  const setVariantAttributesData = useCallback(
    (newAttributes: string[]) => {
      setVariantAttributes(newAttributes);
      form.setFieldsValue({ variantAttributes: newAttributes });
    },
    [form]
  );

  const setHasVariantsData = useCallback(
    (newHasVariants: boolean) => {
      setHasVariants(newHasVariants);
      form.setFieldsValue({ hasVariants: newHasVariants });
    },
    [form]
  );

  const { data: product, isLoading: productLoading } = useProduct(id || "");
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const { data: profile } = useProfile();
  const isGstRegistered = Boolean(profile?.gstNumber);

  // Load product data for editing
  useEditProductInitializer({
    product: product || null,
    isEdit,
    form,
    setMainImageList,
    setImagesList,
    setVideosList,
    setSpecifications,
    setTags,
    setFilterMetadata,
    setVariantsData,
    setVariantAttributesData,
    setHasVariantsData,
  });

  const tabHasError = useTabErrorHighlight(form, mainImageList, imagesList);

  // Image handlers
  const handleMainImageChange = (info: { fileList: UploadFile[] }) => {
    setMainImageList(info.fileList);
  };

  const handleImagesChange = (info: { fileList: UploadFile[] }) => {
    setImagesList(info.fileList);
  };

  const handleVideosChange = (info: { fileList: UploadFile[] }) => {
    setVideosList(info.fileList);
  };

  const onFinish = useProductSubmit({
    form,
    isEdit,
    id,
    isGstRegistered,
    variants,
    variantAttributes,
    hasVariants,
    filterMetadata,
    specifications,
    tags,
    mainImageList,
    imagesList,
    videosList,
    product,
    sizeChartData,
    savingAsDraft,
    setSavingAsDraft,
    createMutation,
    updateMutation,
    navigate,
    message,
  });

  if (!canManageProducts) {
    return (
      <Result
        status="warning"
        title="KYC Verification Required"
        subTitle="Please complete your KYC verification to add products."
        extra={
          <Button type="primary" onClick={() => navigate("/profile")}>
            Complete KYC
          </Button>
        }
      />
    );
  }

  if (productLoading) {
    return (
      <Spin size="large" style={{ display: "block", margin: "50px auto" }} />
    );
  }

  return (
    <div>
      {/* Requirements Alert - Show missing store info and contact info */}
      {canManageProducts && <RequirementsAlert />}

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Professional Header */}
        <Card
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow:
              "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
            background: "#ffffff",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "16px" }}
              >
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/products")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "40px",
                    height: "40px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#374151",
                  }}
                />
                <div>
                  <Title
                    level={2}
                    style={{
                      margin: 0,
                      fontSize: "24px",
                      fontWeight: 600,
                      color: "#111827",
                      lineHeight: "32px",
                    }}
                  >
                    {isEdit ? "Edit Product" : "Add New Product"}
                  </Title>
                  <Text
                    style={{
                      color: "#6b7280",
                      fontSize: "14px",
                      lineHeight: "20px",
                    }}
                  >
                    {isEdit
                      ? "Update your product details and settings"
                      : "Create a new product for your store"}
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Professional Form Container */}
        <Card
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow:
              "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
            background: "#ffffff",
          }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            onFinishFailed={(errorInfo) => {
              const tabErrors = getTabErrors(errorInfo.errorFields);
              setValidationTabErrors(tabErrors);
              setValidationErrorModalOpen(true);
            }}
            size="small"
          >
            {/* Admin Notice Banner */}
            {isEdit &&
              Array.isArray(product?.objections) &&
              product!.objections.some(
                (o: { resolved?: boolean }) => !o.resolved
              ) && (
                <Alert
                  type="warning"
                  showIcon
                  message={<span className="font-medium">Admin Notice</span>}
                  description={(() => {
                    const latest = [...product!.objections]
                      .reverse()
                      .find(
                        (o: {
                          reason: string;
                          createdAt: string;
                          resolved?: boolean;
                        }) => !o.resolved
                      ) as { reason: string; createdAt: string } | undefined;
                    return latest ? (
                      <div className="space-y-2">
                        <div className="font-medium text-gray-800">
                          {latest.reason}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(latest.createdAt).toLocaleString()}
                        </div>
                        <Collapse ghost className="mt-2">
                          <Collapse.Panel
                            header="View active notices"
                            key="all"
                          >
                            <Space direction="vertical" className="w-full">
                              {[...product!.objections]
                                .reverse()
                                .filter(
                                  (o: {
                                    reason: string;
                                    createdAt: string;
                                    resolved?: boolean;
                                  }) => !o.resolved
                                )
                                .map(
                                  (
                                    o: { reason: string; createdAt: string },
                                    idx: number
                                  ) => (
                                    <div
                                      key={`${o.createdAt}-${idx}`}
                                      className="space-y-0.5"
                                    >
                                      <div className="font-medium text-gray-800">
                                        {o.reason}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {new Date(o.createdAt).toLocaleString()}
                                      </div>
                                    </div>
                                  )
                                )}
                            </Space>
                          </Collapse.Panel>
                        </Collapse>
                      </div>
                    ) : null;
                  })()}
                  className="mb-4 rounded-md"
                />
              )}

            {/* Footer - Moved to top above tabs */}
            <ProductFormFooter
              form={form}
              isEdit={isEdit}
              createMutation={createMutation}
              updateMutation={updateMutation}
              setSavingAsDraft={setSavingAsDraft}
            />

            <Tabs
              defaultActiveKey="basic-info"
              activeKey={activeTab}
              onChange={setActiveTab}
              style={
                {
                  "--ant-tabs-ink-bar-color": "#4F5552",
                  "--ant-tabs-item-active-color": "#4F5552",
                  "--ant-tabs-item-hover-color": "#414644",
                  "--ant-tabs-item-color": "#6b7280",
                  "--ant-tabs-content-padding": "12px",
                } as React.CSSProperties
              }
              tabBarStyle={{
                marginBottom: 10,
                borderBottom: "1px solid #e5e7eb",
                background: "#f9fafb",
                padding: "0 24px",
                margin: "0 -24px 0 -24px",
              }}
              items={[
                {
                  key: "basic-info",
                  label: (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: tabHasError["basic-info"]
                          ? "#dc2626"
                          : "#374151",
                        fontWeight: 500,
                      }}
                    >
                      <FileTextOutlined style={{ fontSize: "16px" }} />
                      <span>Basic Info</span>
                      {tabHasError["basic-info"] && (
                        <span style={{ color: "#dc2626" }}>•</span>
                      )}
                    </span>
                  ),
                  children: (
                    <BasicInfoTab form={form} categories={categories} />
                  ),
                },
                {
                  key: "variants",
                  label: (
                    <span
                      className={`flex items-center ${
                        tabHasError["variants"]
                          ? "text-red-500"
                          : "text-gray-700"
                      }`}
                    >
                      <AppstoreOutlined className="mr-2 text-lg" />
                      <span className="font-medium">Variants</span>
                      {tabHasError["variants"] && (
                        <span className="ml-1 text-red-500">•</span>
                      )}
                    </span>
                  ),
                  children: (
                    <VariantsTab
                      form={form}
                      isEdit={isEdit}
                      variants={variants}
                      variantAttributes={variantAttributes}
                      hasVariants={hasVariants}
                      onVariantsChange={setVariantsData}
                      onVariantAttributesChange={setVariantAttributesData}
                      onHasVariantsChange={setHasVariantsData}
                    />
                  ),
                },
                // Show Size Chart tab only when editing, has variants, and "size" is selected as variant attribute
                ...(hasVariants &&
                variantAttributes.some((attr) => attr.toLowerCase() === "size")
                  ? [
                      {
                        key: "size-chart",
                        label: (
                          <span
                            className={`flex items-center ${
                              tabHasError["size-chart"]
                                ? "text-red-500"
                                : "text-gray-700"
                            }`}
                          >
                            <TableOutlined className="mr-2 text-lg" />
                            <span className="font-medium">Size Chart</span>
                            {tabHasError["size-chart"] && (
                              <span className="ml-1 text-red-500">•</span>
                            )}
                          </span>
                        ),
                        children: (
                          <SizeChartTab
                            form={form}
                            productId={id}
                            isEdit={isEdit}
                            variants={variants}
                            variantAttributes={variantAttributes}
                            sizeChartData={sizeChartData}
                            onSizeChartChange={(data) =>
                              setSizeChartData(data || null)
                            }
                          />
                        ),
                      },
                    ]
                  : []),
                {
                  key: "pricing-inventory",
                  label: (
                    <span
                      className={`flex items-center ${
                        tabHasError["pricing-inventory"]
                          ? "text-red-500"
                          : "text-gray-700"
                      }`}
                    >
                      <DollarOutlined className="mr-2 text-lg" />
                      <span className="font-medium">Pricing & Inventory</span>
                      {tabHasError["pricing-inventory"] && (
                        <span className="ml-1 text-red-500">•</span>
                      )}
                    </span>
                  ),
                  children: (
                    <PricingInventoryTab
                      form={form}
                      variants={variants}
                      onVariantsChange={setVariantsData}
                    />
                  ),
                },
                {
                  key: "media",
                  label: (
                    <span
                      className={`flex items-center ${
                        tabHasError["media"] ? "text-red-500" : "text-gray-700"
                      }`}
                    >
                      <PictureOutlined className="mr-2 text-lg" />
                      <span className="font-medium">Media</span>
                      {tabHasError["media"] && (
                        <span className="ml-1 text-red-500">•</span>
                      )}
                    </span>
                  ),
                  children: (
                    <MediaTab
                      form={form}
                      mainImageList={mainImageList}
                      imagesList={imagesList}
                      videosList={videosList}
                      handleMainImageChange={handleMainImageChange}
                      handleImagesChange={handleImagesChange}
                      handleVideosChange={handleVideosChange}
                      variants={variants}
                      onVariantsChange={setVariantsData}
                    />
                  ),
                },
                {
                  key: "shipping-policies",
                  label: (
                    <span
                      className={`flex items-center ${
                        tabHasError["shipping-policies"]
                          ? "text-red-500"
                          : "text-gray-700"
                      }`}
                    >
                      <TruckOutlined className="mr-2 text-lg" />
                      <span className="font-medium">Shipping & Policies</span>
                      {tabHasError["shipping-policies"] && (
                        <span className="ml-1 text-red-500">•</span>
                      )}
                    </span>
                  ),
                  children: <ShippingPoliciesTab form={form} />,
                },
                {
                  key: "seo-attributes",
                  label: (
                    <span
                      className={`flex items-center ${
                        tabHasError["seo-attributes"]
                          ? "text-red-500"
                          : "text-gray-700"
                      }`}
                    >
                      <SearchOutlined className="mr-2 text-lg" />
                      <span className="font-medium">SEO & Attributes</span>
                      {tabHasError["seo-attributes"] && (
                        <span className="ml-1 text-red-500">•</span>
                      )}
                    </span>
                  ),
                  children: (
                    <SEOAttributesTab
                      form={form}
                      categories={categories}
                      specifications={specifications}
                      setSpecifications={setSpecifications}
                      filterMetadata={filterMetadata}
                      setFilterMetadata={setFilterMetadata}
                      tags={tags}
                      setTags={setTags}
                    />
                  ),
                },
              ]}
            />
          </Form>
        </Card>

        <Modal
          title="Please fix the following errors"
          open={validationErrorModalOpen}
          onCancel={() => setValidationErrorModalOpen(false)}
          footer={[
            <Button key="close" onClick={() => setValidationErrorModalOpen(false)}>
              Close
            </Button>,
          ]}
          width={520}
          destroyOnClose
        >
          <div style={{ marginTop: 8 }}>
            {validationTabErrors.map(({ tabKey, tabLabel, errors }) => (
              <div
                key={tabKey}
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: "#f9fafb",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <Text strong style={{ fontSize: 14, color: "#111827" }}>
                    {tabLabel}
                  </Text>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, fontWeight: 600, color: "#4F5552" }}
                    onClick={() => {
                      setActiveTab(tabKey);
                      setValidationErrorModalOpen(false);
                    }}
                  >
                    Go to {tabLabel} →
                  </Button>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, color: "#6b7280", fontSize: 13 }}>
                  {errors.map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Modal>
      </Space>
    </div>
  );
};

export default ProductForm;
