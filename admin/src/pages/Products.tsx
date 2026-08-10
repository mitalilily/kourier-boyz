import {
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  FilterOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  DatePicker,
  Image,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import API from "../api/axiosInstance";
import { useCategories } from "../api/category";
import {
  type AdminProduct,
  type ProductFilters,
  downloadProductsCSV,
  useAdminProducts,
  useBulkDelete,
  useBulkUpdateStatus,
  useLowStock,
  useRaiseObjection,
  useToggleFeatured,
  useUpdateProductStatus,
} from "../api/products";
import { useUsers } from "../api/users";
import ProductCertificateApprovalModal from "../components/products/ProductCertificateApprovalModal";
import PermissionButton from "../components/PermissionButton";
import PermissionGate from "../components/PermissionGate";
import { useModulePermissions } from "../hooks/useModulePermissions";

//

export default function ProductsPage() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isLowStockView =
    searchParams.get("lowStock") === "true" ||
    searchParams.get("stockStatus") === "low_or_oos";

  // Permission checks - single hook call for better performance
  const permissions = useModulePermissions("products");

  // Only show Actions column if user has at least one action permission
  const showActionsColumn =
    permissions.canApprove ||
    permissions.canReject ||
    permissions.canUpdate ||
    permissions.canDelete;

  // Get active tab from URL or default to 'all'
  const activeTab = searchParams.get("tab") || "all";

  // Initialize filters from URL params
  const initialFilters: ProductFilters = {
    page: parseInt(searchParams.get("page") || "1", 10),
    limit: parseInt(searchParams.get("limit") || "10", 10),
  };

  const [filters, setFilters] = useState<ProductFilters>(initialFilters);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  // Update filters based on active tab
  useEffect(() => {
    if (activeTab === "pending") {
      setFilters((prev) => ({ ...prev, status: "pending_approval", page: 1 }));
    } else if (activeTab === "all") {
      setFilters((prev) => {
        const next = { ...prev };
        delete next.status;
        return { ...next, page: 1 };
      });
    }
  }, [activeTab]);

  // Use low stock hook when viewing low stock products
  const { data: lowStockData, isLoading: isLoadingLowStock } = useLowStock({
    page: filters.page || 1,
    limit: filters.limit || 10,
  });

  // Use regular products hook for normal view
  const { data, isLoading } = useAdminProducts(filters);

  // Determine which data source to use
  const productsData = isLowStockView ? lowStockData : data;
  const isLoadingProducts = isLowStockView ? isLoadingLowStock : isLoading;
  const updateStatus = useUpdateProductStatus();
  const toggleFeatured = useToggleFeatured();
  const bulkStatus = useBulkUpdateStatus();
  const bulkDelete = useBulkDelete();
  const raiseObjection = useRaiseObjection();

  // Fetch categories and sellers for filters
  const { data: categoriesData } = useCategories({
    status: "active",
    includeSubcategories: true,
  });
  const { data: sellersData } = useUsers({ role: "seller" });

  const products: AdminProduct[] = productsData?.products || [];
  const total = productsData?.pagination?.total || 0;

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [productToApprove, setProductToApprove] = useState<AdminProduct | null>(
    null
  );
  const [remindLoading, setRemindLoading] = useState(false);

  // Clear low stock view when filters change (except pagination)
  useEffect(() => {
    if (
      isLowStockView &&
      (filters.search || filters.status || filters.category || filters.seller)
    ) {
      // Remove lowStock param if user starts filtering manually
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("lowStock");
      newParams.delete("stockStatus");
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?${newParams.toString()}`
      );
    }
  }, [
    filters.search,
    filters.status,
    filters.category,
    filters.seller,
    isLowStockView,
    searchParams,
  ]);

  const categories = categoriesData?.categories || [];
  const sellers = sellersData || [];

  const handleFilterChange = (
    key: keyof ProductFilters,
    value: string | number | boolean | undefined | null
  ) => {
    if (value === undefined || value === null || value === "") {
      const newFilters = { ...filters };
      delete newFilters[key];
      setFilters({ ...newFilters, page: 1 });
    } else {
      setFilters({ ...filters, [key]: value, page: 1 });
    }
  };

  const handleDateRangeChange = (
    dates: [Dayjs | null, Dayjs | null] | null
  ) => {
    if (!dates || !dates[0] || !dates[1]) {
      const newFilters = { ...filters };
      delete newFilters.dateFrom;
      delete newFilters.dateTo;
      setFilters({ ...newFilters, page: 1 });
    } else {
      setFilters({
        ...filters,
        dateFrom: dates[0].startOf("day").toISOString(),
        dateTo: dates[1].endOf("day").toISOString(),
        page: 1,
      });
    }
  };

  const clearAllFilters = () => {
    setFilters({ page: 1, limit: filters.limit || 10 });
    setAdvancedFiltersOpen(false);
  };

  const hasActiveFilters = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { page, limit, ...rest } = filters;
    return Object.keys(rest).length > 0;
  };

  const columns: ColumnsType<AdminProduct> = [
    {
      title: "Product",
      dataIndex: "name",
      render: (_: unknown, r) => (
        <Space>
          <Image
            src={r.mainImage}
            width={48}
            height={48}
            style={{ objectFit: "cover" }}
            fallback=""
          />
          <span className="inline-block max-w-[150px] truncate">
            <Link to={`/products/${r._id}`}>{r.name}</Link>
            <div style={{ fontSize: 12, color: "#888" }}>SKU: {r.sku}</div>
          </span>
        </Space>
      ),
    },
    {
      title: "Seller",
      dataIndex: ["seller", "name"],
      width: 180,
      render: (_: unknown, r) =>
        r.seller?._id ? (
          <Link to={`/sellers/${r.seller._id}`}>{r.seller.name}</Link>
        ) : (
          r.seller?.name || "-"
        ),
    },
    {
      title: "Category",
      dataIndex: "category",
      width: 180,
      render: (category: AdminProduct["category"]) => {
        if (!category) return "-";
        const categoryName =
          typeof category === "string" ? category : category.name || "";
        const parent =
          typeof category === "object" && category.parent
            ? typeof category.parent === "string"
              ? null
              : category.parent
            : null;
        const parentName = parent?.name || null;
        const displayText = parentName
          ? `${parentName} > ${categoryName}`
          : categoryName;
        return (
          <span
            title={displayText}
            style={{ maxWidth: 180, display: "inline-block" }}
          >
            {displayText}
          </span>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 160,
      render: (status: string, r) => {
        if (status === "pending_approval") {
          return (
            <Tag color="orange" style={{ margin: 0 }}>
              Pending Approval
            </Tag>
          );
        }
        return (
          <Select
            size="small"
            value={status}
            style={{ width: 150 }}
            onChange={(v) =>
              modal.confirm({
                title: "Change product status?",
                icon: <ExclamationCircleOutlined />,
                content:
                  "Changing status will switch the product to Manual status mode. To resume automatic updates later, switch mode to Auto.",
                okText: "Change Status",
                onOk: () => updateStatus.mutate({ id: r._id, status: v }),
              })
            }
            options={[
              { value: "draft", label: "Draft" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "out_of_stock", label: "Out of stock" },
              { value: "pending_approval", label: "Pending Approval" },
            ]}
          />
        );
      },
    },
    // Only include Actions column if user has at least one action permission
    ...(showActionsColumn
      ? [
          {
            title: "Actions",
            key: "actions",
            width: 180,
            render: (_: unknown, r: AdminProduct) => {
              if (r.status === "pending_approval") {
                return (
                  <Space size="small">
                    <PermissionButton
                      module="products"
                      permission="approve"
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => setProductToApprove(r)}
                    >
                      Approve
                    </PermissionButton>
                    <PermissionButton
                      module="products"
                      permission="reject"
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => {
                        let rejectionReason = "";
                        modal.confirm({
                          title: "Reject Product",
                          icon: <ExclamationCircleOutlined />,
                          content: (
                            <div>
                              <p style={{ marginBottom: 16 }}>
                                Are you sure you want to reject "{r.name}"? The
                                product will be moved to draft status.
                              </p>
                              <Input.TextArea
                                rows={3}
                                placeholder="Optional: Add rejection reason (will be saved as objection)..."
                                onChange={(e) =>
                                  (rejectionReason = e.target.value)
                                }
                              />
                            </div>
                          ),
                          okText: "Reject",
                          okType: "danger",
                          onOk: () => {
                            const promises: Array<Promise<unknown>> = [
                              updateStatus.mutateAsync({
                                id: r._id,
                                status: "draft",
                              }),
                            ];
                            if (rejectionReason?.trim()) {
                              promises.push(
                                raiseObjection.mutateAsync({
                                  id: r._id,
                                  reason: rejectionReason.trim(),
                                })
                              );
                            }
                            return Promise.all(promises)
                              .then(() => {
                                message.success(
                                  rejectionReason?.trim()
                                    ? "Product rejected and notice sent to seller"
                                    : "Product rejected"
                                );
                              })
                              .catch((err: unknown) => {
                                const apiError =
                                  typeof err === "object" &&
                                  err !== null &&
                                  "response" in err &&
                                  typeof (
                                    err as {
                                      response?: { data?: { error?: string } };
                                    }
                                  ).response?.data === "object"
                                    ? (
                                        err as {
                                          response?: {
                                            data?: { error?: string };
                                          };
                                        }
                                      ).response?.data?.error
                                    : undefined;
                                message.error(
                                  apiError ?? "Failed to reject product"
                                );
                              });
                          },
                        });
                      }}
                    >
                      Reject
                    </PermissionButton>
                  </Space>
                );
              }
              return null;
            },
          },
        ]
      : []),
    {
      title: "Featured",
      dataIndex: "isFeatured",
      width: 120,
      render: (v: boolean, r) => (
        <Tag
          color={v ? "gold" : "default"}
          style={{ cursor: "pointer" }}
          onClick={() => toggleFeatured.mutate({ id: r._id, isFeatured: !v })}
        >
          {v ? "Yes" : "No"}
        </Tag>
      ),
    },
    {
      title: "Stock",
      dataIndex: "stock",
      width: 100,
      render: (v, r) => v ?? r.stock ?? 0,
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  const handleApproveProduct = async () => {
    if (!productToApprove) return;
    try {
      await updateStatus.mutateAsync({
        id: productToApprove._id,
        status: "active",
      });
      message.success(
        `Product "${productToApprove.name}" approved successfully`
      );
      setProductToApprove(null);
    } catch (err: unknown) {
      const apiMessage =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (
          err as { response?: { data?: { message?: string; error?: string } } }
        ).response?.data === "object"
          ? (
              err as {
                response?: { data?: { message?: string; error?: string } };
              }
            ).response?.data?.message ??
            (
              err as {
                response?: { data?: { message?: string; error?: string } };
              }
            ).response?.data?.error
          : undefined;
      message.error(apiMessage ?? "Failed to approve product");
    }
  };

  const handleRemindCertificates = async (missingCertificates: string[]) => {
    if (!productToApprove) return;
    try {
      setRemindLoading(true);
      await API.post(
        `/admin/products/${productToApprove._id}/remind-missing-certificates`,
        {
          missingCertificates,
        }
      );
      message.success("Reminder sent to seller");
    } catch (err: unknown) {
      const apiMessage =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response
          ?.data === "object"
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      message.error(apiMessage ?? "Failed to send reminder");
    } finally {
      setRemindLoading(false);
    }
  };

  const onExport = async () => {
    const blob = await downloadProductsCSV(filters);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmBulkDelete = () => {
    if (selectedRowKeys.length === 0) return;
    modal.confirm({
      title: "Delete selected products?",
      icon: <ExclamationCircleOutlined />,
      okText: "Delete",
      okType: "danger",
      onOk: () =>
        bulkDelete.mutate(selectedRowKeys as string[], {
          onSuccess: () => {
            message.success("Deleted");
            setSelectedRowKeys([]);
          },
        }),
    });
  };

  const doBulkStatus = (status: string) => {
    if (selectedRowKeys.length === 0) return;
    bulkStatus.mutate(
      { productIds: selectedRowKeys as string[], status },
      {
        onSuccess: () => {
          message.success("Updated");
          setSelectedRowKeys([]);
        },
      }
    );
  };

  const getDateRangeValue = (): [Dayjs | null, Dayjs | null] | null => {
    if (filters.dateFrom && filters.dateTo) {
      return [dayjs(filters.dateFrom), dayjs(filters.dateTo)];
    }
    return null;
  };

  // Count pending approval products
  const { data: pendingData } = useAdminProducts(
    useMemo(
      () => ({
        status: "pending_approval" as const,
        limit: 1,
      }),
      []
    )
  );
  const pendingCount = pendingData?.pagination?.total || 0;

  const ProductsContent = (
    <Card>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Low Stock Alert Banner */}
        {isLowStockView && (
          <Alert
            message="Low Stock Products"
            description={`Showing ${total} product${
              total !== 1 ? "s" : ""
            } with low stock. These products need attention as their inventory is running low.`}
            type="warning"
            icon={<WarningOutlined />}
            showIcon
            closable
            onClose={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.delete("lowStock");
              navigate(`/products?${newParams.toString()}`);
            }}
          />
        )}

        <Card size="small" style={{ background: "#fafafa" }}>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={12} md={6}>
                <Input
                  placeholder="Search name, SKU, brand..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Status"
                  value={filters.status}
                  onChange={(v) => handleFilterChange("status", v)}
                  allowClear
                  style={{ width: "100%" }}
                  options={[
                    { value: "draft", label: "Draft" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "out_of_stock", label: "Out of stock" },
                    { value: "pending_approval", label: "Pending Approval" },
                  ]}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Category"
                  value={filters.category}
                  onChange={(v) => handleFilterChange("category", v)}
                  allowClear
                  style={{ width: "100%" }}
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={categories.map((c) => {
                    const parent = c.parent
                      ? typeof c.parent === "string"
                        ? null
                        : c.parent
                      : null;
                    const parentName = parent?.name || null;
                    const label = parentName
                      ? `${parentName} > ${c.name}`
                      : c.name;
                    return {
                      value: c._id || c.id,
                      label,
                    };
                  })}
                />
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Select
                  placeholder="Seller"
                  value={filters.seller}
                  onChange={(v) => handleFilterChange("seller", v)}
                  allowClear
                  style={{ width: "100%" }}
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={sellers.map(
                    (s: { _id: string; name?: string; email?: string }) => ({
                      value: s._id,
                      label: s.name || s.email,
                    })
                  )}
                />
              </Col>
            </Row>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={24} md={12}>
                <Space wrap size="small">
                  <Button
                    icon={<FilterOutlined />}
                    onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
                    type={advancedFiltersOpen ? "primary" : "default"}
                    size="small"
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      Filters{" "}
                      {hasActiveFilters() && (
                        <Tag color="blue" style={{ margin: 0 }}>
                          Active
                        </Tag>
                      )}
                    </span>
                  </Button>
                  {hasActiveFilters() && (
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={clearAllFilters}
                      size="small"
                    >
                      Clear
                    </Button>
                  )}
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={onExport}
                    size="small"
                  >
                    Export
                  </Button>
                </Space>
              </Col>
              <PermissionGate
                module="products"
                permission={["approve", "update", "delete"]}
                requireAll={false}
              >
                {selectedRowKeys.length > 0 && (
                  <Col xs={24} sm={24} md={12}>
                    <Space wrap size="small">
                      <Tag color="blue">{selectedRowKeys.length} selected</Tag>
                      {/* Check if any selected products are pending approval */}
                      {products.some(
                        (p) =>
                          selectedRowKeys.includes(p._id) &&
                          p.status === "pending_approval"
                      ) && (
                        <>
                          <PermissionButton
                            module="products"
                            permission="approve"
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={() => {
                              const pendingIds = products
                                .filter(
                                  (p) =>
                                    selectedRowKeys.includes(p._id) &&
                                    p.status === "pending_approval"
                                )
                                .map((p) => p._id);
                              if (pendingIds.length === 0) return;
                              modal.confirm({
                                title: "Approve Selected Products",
                                icon: <ExclamationCircleOutlined />,
                                content: `Are you sure you want to approve ${pendingIds.length} product(s)?`,
                                okText: "Approve",
                                onOk: () =>
                                  bulkStatus.mutate(
                                    {
                                      productIds: pendingIds,
                                      status: "active",
                                    },
                                    {
                                      onSuccess: (result: {
                                        modified?: number;
                                        failed?: number;
                                      }) => {
                                        if (
                                          result.failed &&
                                          result.failed > 0
                                        ) {
                                          message.warning(
                                            `Approved ${
                                              result.modified ?? 0
                                            } product(s). ${
                                              result.failed
                                            } failed due to missing certificates.`
                                          );
                                        } else {
                                          message.success(
                                            `Approved ${
                                              result.modified ??
                                              pendingIds.length
                                            } product(s)`
                                          );
                                        }
                                        setSelectedRowKeys([]);
                                      },
                                      onError: (err: unknown) => {
                                        const apiError =
                                          typeof err === "object" &&
                                          err !== null &&
                                          "response" in err &&
                                          typeof (
                                            err as {
                                              response?: {
                                                data?: { error?: string };
                                              };
                                            }
                                          ).response?.data === "object"
                                            ? (
                                                err as {
                                                  response?: {
                                                    data?: { error?: string };
                                                  };
                                                }
                                              ).response?.data?.error
                                            : undefined;
                                        message.error(
                                          apiError ??
                                            "Failed to approve products"
                                        );
                                      },
                                    }
                                  ),
                              });
                            }}
                            size="small"
                          >
                            Approve Selected
                          </PermissionButton>
                          <PermissionButton
                            module="products"
                            permission="reject"
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => {
                              const pendingIds = products
                                .filter(
                                  (p) =>
                                    selectedRowKeys.includes(p._id) &&
                                    p.status === "pending_approval"
                                )
                                .map((p) => p._id);
                              if (pendingIds.length === 0) return;
                              modal.confirm({
                                title: "Reject Selected Products",
                                icon: <ExclamationCircleOutlined />,
                                content: `Are you sure you want to reject ${pendingIds.length} product(s)? They will be moved to draft status.`,
                                okText: "Reject",
                                okType: "danger",
                                onOk: () =>
                                  bulkStatus.mutate(
                                    { productIds: pendingIds, status: "draft" },
                                    {
                                      onSuccess: (result: {
                                        modified?: number;
                                      }) => {
                                        message.success(
                                          `Rejected ${
                                            result.modified ?? pendingIds.length
                                          } product(s)`
                                        );
                                        setSelectedRowKeys([]);
                                      },
                                    }
                                  ),
                              });
                            }}
                            size="small"
                          >
                            Reject Selected
                          </PermissionButton>
                        </>
                      )}
                      <PermissionButton
                        module="products"
                        permission="update"
                        onClick={() => doBulkStatus("active")}
                        size="small"
                      >
                        Activate
                      </PermissionButton>
                      <PermissionButton
                        module="products"
                        permission="update"
                        onClick={() => doBulkStatus("inactive")}
                        size="small"
                      >
                        Deactivate
                      </PermissionButton>
                      <PermissionButton
                        module="products"
                        permission="update"
                        onClick={() => doBulkStatus("draft")}
                        size="small"
                      >
                        Draft
                      </PermissionButton>
                      <PermissionButton
                        module="products"
                        permission="delete"
                        danger
                        onClick={confirmBulkDelete}
                        size="small"
                      >
                        Delete
                      </PermissionButton>
                    </Space>
                  </Col>
                )}
              </PermissionGate>
            </Row>
            {advancedFiltersOpen && (
              <Collapse
                activeKey={["1"]}
                items={[
                  {
                    key: "1",
                    label: "Advanced Filters",
                    children: (
                      <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={8}>
                          <Space direction="vertical" style={{ width: "100%" }}>
                            <strong>Price Range</strong>
                            <Input.Group compact>
                              <InputNumber
                                style={{ width: "50%" }}
                                placeholder="Min Price"
                                value={
                                  filters.minPrice
                                    ? Number(filters.minPrice)
                                    : undefined
                                }
                                onChange={(v) =>
                                  handleFilterChange("minPrice", v ?? undefined)
                                }
                                min={0}
                                formatter={(value) =>
                                  `₹ ${value ?? ""}`.replace(
                                    /\B(?=(\d{3})+(?!\d))/g,
                                    ","
                                  )
                                }
                                parser={(value) =>
                                  Number(
                                    value?.replace(/₹\s?|(,*)/g, "") ?? ""
                                  ) || 0
                                }
                              />
                              <InputNumber
                                style={{ width: "50%" }}
                                placeholder="Max Price"
                                value={
                                  filters.maxPrice
                                    ? Number(filters.maxPrice)
                                    : undefined
                                }
                                onChange={(v) =>
                                  handleFilterChange("maxPrice", v ?? undefined)
                                }
                                min={0}
                                formatter={(value) =>
                                  `₹ ${value ?? ""}`.replace(
                                    /\B(?=(\d{3})+(?!\d))/g,
                                    ","
                                  )
                                }
                                parser={(value) =>
                                  Number(
                                    value?.replace(/₹\s?|(,*)/g, "") ?? ""
                                  ) || 0
                                }
                              />
                            </Input.Group>
                          </Space>
                        </Col>
                        <Col xs={24} sm={12} md={8}>
                          <Space direction="vertical" style={{ width: "100%" }}>
                            <strong>Stock Range</strong>
                            <Input.Group compact>
                              <InputNumber
                                style={{ width: "50%" }}
                                placeholder="Min Stock"
                                value={
                                  filters.minStock
                                    ? Number(filters.minStock)
                                    : undefined
                                }
                                onChange={(v) =>
                                  handleFilterChange("minStock", v ?? undefined)
                                }
                                min={0}
                              />
                              <InputNumber
                                style={{ width: "50%" }}
                                placeholder="Max Stock"
                                value={
                                  filters.maxStock
                                    ? Number(filters.maxStock)
                                    : undefined
                                }
                                onChange={(v) =>
                                  handleFilterChange("maxStock", v ?? undefined)
                                }
                                min={0}
                              />
                            </Input.Group>
                          </Space>
                        </Col>
                        <Col xs={24} sm={12} md={8}>
                          <Space direction="vertical" style={{ width: "100%" }}>
                            <strong>Date Range</strong>
                            <DatePicker.RangePicker
                              style={{ width: "100%" }}
                              value={getDateRangeValue()}
                              onChange={handleDateRangeChange}
                              allowClear
                            />
                            <Select
                              placeholder="Date Field"
                              value={filters.dateField || "createdAt"}
                              onChange={(v) =>
                                handleFilterChange("dateField", v)
                              }
                              style={{ width: "100%" }}
                              options={[
                                { value: "createdAt", label: "Created Date" },
                                { value: "updatedAt", label: "Updated Date" },
                              ]}
                            />
                          </Space>
                        </Col>
                        <Col xs={24} sm={12} md={8}>
                          <Space direction="vertical" style={{ width: "100%" }}>
                            <strong>Sort By</strong>
                            <Select
                              placeholder="Sort Field"
                              value={filters.sortBy || "createdAt"}
                              onChange={(v) => handleFilterChange("sortBy", v)}
                              style={{ width: "100%" }}
                              options={[
                                { value: "createdAt", label: "Created Date" },
                                { value: "updatedAt", label: "Updated Date" },
                                { value: "name", label: "Name" },
                                { value: "price", label: "Price" },
                                { value: "stock", label: "Stock" },
                              ]}
                            />
                            <Select
                              placeholder="Order"
                              value={filters.order || "desc"}
                              onChange={(v) => handleFilterChange("order", v)}
                              style={{ width: "100%" }}
                              options={[
                                { value: "desc", label: "Descending" },
                                { value: "asc", label: "Ascending" },
                              ]}
                            />
                          </Space>
                        </Col>
                        <Col xs={24} sm={12} md={8}>
                          <Space direction="vertical" style={{ width: "100%" }}>
                            <strong>Options</strong>
                            <Checkbox
                              checked={
                                filters.isFeatured === true ||
                                filters.isFeatured === "true"
                              }
                              onChange={(e) =>
                                handleFilterChange(
                                  "isFeatured",
                                  e.target.checked || undefined
                                )
                              }
                            >
                              Featured Only
                            </Checkbox>
                            <Checkbox
                              checked={
                                filters.hasVariants === true ||
                                filters.hasVariants === "true"
                              }
                              onChange={(e) =>
                                handleFilterChange(
                                  "hasVariants",
                                  e.target.checked || undefined
                                )
                              }
                            >
                              Has Variants
                            </Checkbox>
                          </Space>
                        </Col>
                      </Row>
                    ),
                  },
                ]}
              />
            )}
          </Space>
        </Card>

        <Table<AdminProduct>
          rowKey="_id"
          columns={columns}
          dataSource={products}
          loading={isLoadingProducts}
          rowSelection={rowSelection}
          scroll={{ x: "max-content" }}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total,
            showSizeChanger: true,
            responsive: true,
            onChange: (p, ps) => {
              setFilters({ ...filters, page: p, limit: ps });
              // Update URL to reflect pagination when in low stock view
              if (isLowStockView) {
                const newParams = new URLSearchParams(searchParams);
                newParams.set("page", String(p));
                newParams.set("limit", String(ps));
                window.history.replaceState(
                  {},
                  "",
                  `${window.location.pathname}?${newParams.toString()}`
                );
              }
            },
          }}
        />
      </Space>
    </Card>
  );

  const params = new URLSearchParams(window.location.search);
  const defaultKey = params.get("tab") === "pending" ? "pending" : "all";

  return (
    <>
      <Tabs
        defaultActiveKey={defaultKey}
        onChange={(key) => {
          const newParams = new URLSearchParams(searchParams);
          if (key === "all") {
            newParams.delete("tab");
          } else {
            newParams.set("tab", key);
          }
          navigate(`/products?${newParams.toString()}`);
        }}
        items={[
          {
            key: "all",
            label: "All Products",
            children: ProductsContent,
          },
          {
            key: "pending",
            label: `Pending Approval ${
              pendingCount > 0 ? `(${pendingCount})` : ""
            }`,
            children: ProductsContent,
          },
        ]}
      />
      <ProductCertificateApprovalModal
        open={!!productToApprove}
        product={productToApprove}
        onCancel={() => setProductToApprove(null)}
        onApprove={handleApproveProduct}
        onRemind={handleRemindCertificates}
        remindLoading={remindLoading}
        approveLoading={updateStatus.isPending}
      />
    </>
  );
}
