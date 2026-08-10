import {
  BlockOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import type { AdminCustomer, CustomerFilters } from "../api/customers";
import {
  useCustomers,
  useDeactivateBuyer,
  useHardDeleteBuyer,
  useReactivateBuyer,
  useUpdateCustomerStatus,
} from "../api/customers";
import PermissionButton from "../components/PermissionButton";
import { useActionPermissions } from "../hooks/useActionPermissions";

const { Title, Text } = Typography;

const Customers = () => {
  const { message, modal } = App.useApp();
  const updateStatus = useUpdateCustomerStatus();
  const deactivateBuyer = useDeactivateBuyer();
  const reactivateBuyer = useReactivateBuyer();
  const hardDeleteBuyer = useHardDeleteBuyer();
  const actionPermissions = useActionPermissions("customerManagement");

  const [activeTab, setActiveTab] = useState("all");
  const [filters, setFilters] = useState<CustomerFilters>({});

  // Build filters based on active tab
  const activeFilters = useMemo(() => {
    const baseFilters = { ...filters };

    switch (activeTab) {
      case "blocked":
        return { ...baseFilters, isBlocked: "true" };
      case "active":
        return { ...baseFilters, isBlocked: "false" };
      case "verified":
        return { ...baseFilters, status: "verified" };
      case "unverified":
        return { ...baseFilters, status: "unverified" };
      default:
        return baseFilters;
    }
  }, [filters, activeTab]);

  const { data: customers, isLoading } = useCustomers(activeFilters);

  const handleBlock = (customer: AdminCustomer, block: boolean) => {
    if (block) {
      let blockedReason = "";
      modal.confirm({
        title: "Block Customer",
        icon: <BlockOutlined />,
        content: (
          <div>
            <p style={{ marginBottom: 16 }}>
              Are you sure you want to block {customer.name}?
            </p>
            <Input.TextArea
              rows={3}
              placeholder="Reason for blocking (optional)..."
              onChange={(e) => (blockedReason = e.target.value)}
            />
          </div>
        ),
        okText: "Block",
        okType: "danger",
        onOk: () => {
          updateStatus.mutate(
            { id: customer._id, isBlocked: true, blockedReason },
            {
              onSuccess: () => message.success("Customer blocked successfully"),
              onError: () => message.error("Failed to block customer"),
            }
          );
        },
      });
    } else {
      modal.confirm({
        title: "Unblock Customer",
        icon: <UnlockOutlined />,
        content: `Are you sure you want to unblock ${customer.name}?`,
        onOk: () => {
          updateStatus.mutate(
            { id: customer._id, isBlocked: false },
            {
              onSuccess: () =>
                message.success("Customer unblocked successfully"),
              onError: () => message.error("Failed to unblock customer"),
            }
          );
        },
      });
    }
  };

  const handleDeactivate = (customer: AdminCustomer) => {
    let deactivationReason = "";
    modal.confirm({
      title: "Deactivate Buyer Account",
      icon: <StopOutlined />,
      content: (
        <div>
          <p style={{ marginBottom: 16 }}>
            Are you sure you want to deactivate the account for <strong>{customer.name}</strong>?
          </p>
          <p style={{ marginBottom: 16, color: "#666", fontSize: "13px" }}>
            This will mask their personal information, prevent login, and block new orders. Order history and invoices will be preserved.
          </p>
          <Input.TextArea
            rows={3}
            placeholder="Reason for deactivation (optional)..."
            onChange={(e) => (deactivationReason = e.target.value)}
          />
        </div>
      ),
      okText: "Deactivate",
      okType: "danger",
      onOk: () => {
        deactivateBuyer.mutate(
          { id: customer._id, reason: deactivationReason || undefined },
          {
            onSuccess: () => message.success("Buyer account deactivated successfully"),
            onError: (error: unknown) => {
              const errorMessage =
                error && typeof error === "object" && "response" in error
                  ? (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error ||
                    (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message
                  : undefined;
              message.error(errorMessage || "Failed to deactivate buyer account");
            },
          }
        );
      },
    });
  };

  const handleReactivate = (customer: AdminCustomer) => {
    modal.confirm({
      title: "Reactivate Buyer Account",
      icon: <ReloadOutlined />,
      content: (
        <div>
          <p style={{ marginBottom: 16 }}>
            Are you sure you want to reactivate the account for <strong>{customer.name}</strong>?
          </p>
          <p style={{ marginBottom: 16, color: "#666", fontSize: "13px" }}>
            This will restore their account access and allow them to log in again.
          </p>
        </div>
      ),
      okText: "Reactivate",
      onOk: () => {
        reactivateBuyer.mutate(customer._id, {
          onSuccess: () => message.success("Buyer account reactivated successfully"),
          onError: (error: unknown) => {
            const errorMessage =
              error && typeof error === "object" && "response" in error
                ? (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error ||
                  (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message
                : undefined;
            message.error(errorMessage || "Failed to reactivate buyer account");
          },
        });
      },
    });
  };

  const handleHardDelete = (customer: AdminCustomer) => {
    modal.confirm({
      title: "Permanently Delete Buyer Account",
      icon: <DeleteOutlined />,
      content: (
        <div>
          <p style={{ marginBottom: 16, color: "#ff4d4f", fontWeight: "bold" }}>
            ⚠️ Warning: This action cannot be undone!
          </p>
          <p style={{ marginBottom: 16 }}>
            Are you sure you want to permanently delete the account for <strong>{customer.name}</strong>?
          </p>
          <p style={{ marginBottom: 16, color: "#666", fontSize: "13px" }}>
            Hard deletion is only allowed if the buyer has:
          </p>
          <ul style={{ marginBottom: 16, paddingLeft: 20, color: "#666", fontSize: "13px" }}>
            <li>No orders</li>
            <li>No payments</li>
            <li>No invoices</li>
          </ul>
          <p style={{ color: "#ff4d4f", fontSize: "13px", fontWeight: "bold" }}>
            If this buyer has any order history, hard deletion will fail and soft deactivation will be used instead.
          </p>
        </div>
      ),
      okText: "Delete Permanently",
      okType: "danger",
      onOk: () => {
        hardDeleteBuyer.mutate(customer._id, {
          onSuccess: () => message.success("Buyer account permanently deleted"),
          onError: (error: unknown) => {
            const errorMessage =
              error && typeof error === "object" && "response" in error
                ? (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error ||
                  (error as { response?: { data?: { error?: string; message?: string } } }).response?.data?.message
                : undefined;
            message.error(errorMessage || "Failed to delete buyer account. This buyer may have orders, payments, or invoices.");
          },
        });
      },
    });
  };

  const columns: ColumnsType<AdminCustomer> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 200,
      render: (_: unknown, r: AdminCustomer) => (
        <Link to={`/customers/${r._id}`}>{r.name}</Link>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 250,
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
      width: 150,
      render: (phone: string) => phone || "-",
    },
    {
      title: "Status",
      key: "status",
      width: 200,
      render: (_: unknown, record: AdminCustomer) => (
        <Space direction="vertical" size="small">
          <Tag color={record.isBlocked ? "red" : "green"}>
            {record.isBlocked ? "Blocked" : "Active"}
          </Tag>
          {record.buyerLifecycleStatus === "DEACTIVATED" && (
            <Tag color="red">Account Deactivated</Tag>
          )}
          {record.buyerLifecycleStatus === "DEACTIVATION_REQUESTED" && (
            <Tag color="orange">Deactivation Requested</Tag>
          )}
          {(!record.buyerLifecycleStatus || record.buyerLifecycleStatus === "ACTIVE") && (
            <Tag color="blue">Account Active</Tag>
          )}
          <Tag color={record.isEmailVerified ? "blue" : "default"}>
            {record.isEmailVerified ? "Email Verified" : "Email Unverified"}
          </Tag>
          {record.isPhoneVerified && <Tag color="cyan">Phone Verified</Tag>}
        </Space>
      ),
    },
    {
      title: "Joined",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date: string) => (date ? dayjs(date).format("YYYY-MM-DD") : "-"),
    },
    ...(actionPermissions.hasAnyAction
      ? [
          {
            title: "Actions",
            key: "actions",
            width: 150,
            fixed: "right" as const,
            render: (_: unknown, record: AdminCustomer) => (
              <Space>
                {record.buyerLifecycleStatus === "DEACTIVATED" ? (
                  <Tooltip title="Reactivate Buyer Account">
                    <PermissionButton
                      module="customerManagement"
                      permission="update"
                      type="primary"
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => handleReactivate(record)}
                      loading={reactivateBuyer.isPending}
                    >
                      Reactivate
                    </PermissionButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Deactivate Buyer Account">
                    <PermissionButton
                      module="customerManagement"
                      permission="update"
                      danger
                      size="small"
                      icon={<StopOutlined />}
                      onClick={() => handleDeactivate(record)}
                      loading={deactivateBuyer.isPending}
                    >
                      Deactivate
                    </PermissionButton>
                  </Tooltip>
                )}
                {record.isBlocked ? (
                  <Tooltip title="Unblock Customer">
                    <PermissionButton
                      module="customerManagement"
                      permission="block"
                      type="default"
                      size="small"
                      icon={<UnlockOutlined />}
                      onClick={() => handleBlock(record, false)}
                      loading={updateStatus.isPending}
                    >
                      Unblock
                    </PermissionButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Block Customer">
                    <PermissionButton
                      module="customerManagement"
                      permission="block"
                      danger
                      size="small"
                      icon={<BlockOutlined />}
                      onClick={() => handleBlock(record, true)}
                      loading={updateStatus.isPending}
                    >
                      Block
                    </PermissionButton>
                  </Tooltip>
                )}
                <Tooltip title="Permanently Delete (only if no orders)">
                  <PermissionButton
                    module="customerManagement"
                    permission="delete"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleHardDelete(record)}
                    loading={hardDeleteBuyer.isPending}
                  >
                    Delete
                  </PermissionButton>
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ];

  // Get all customers for counts (not filtered)
  const { data: allCustomers } = useCustomers({});

  const blockedCount = useMemo(
    () => allCustomers?.filter((c) => c.isBlocked).length || 0,
    [allCustomers]
  );
  const activeCount = useMemo(
    () => allCustomers?.filter((c) => !c.isBlocked).length || 0,
    [allCustomers]
  );
  const verifiedCount = useMemo(
    () => allCustomers?.filter((c) => c.isEmailVerified).length || 0,
    [allCustomers]
  );
  const unverifiedCount = useMemo(
    () => allCustomers?.filter((c) => !c.isEmailVerified).length || 0,
    [allCustomers]
  );

  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* Filters */}
          <Card size="small" style={{ background: "#fafafa" }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12} lg={8}>
                <Input
                  placeholder="Search by name, email, phone..."
                  prefix={<SearchOutlined />}
                  allowClear
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  style={{ width: "100%" }}
                />
              </Col>
              <Col xs={24} sm={12} lg={4}>
                <Button
                  onClick={() => setFilters({})}
                  block
                  style={{ width: "100%" }}
                >
                  Clear Filters
                </Button>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Text type="secondary" style={{ fontSize: "13px" }}>
                  {customers?.length || 0} customer
                  {customers?.length !== 1 ? "s" : ""} found
                </Text>
              </Col>
            </Row>
          </Card>

          {/* Tabs for filtering */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: "all",
                label: "All Customers",
                children: null,
              },
              {
                key: "active",
                label: (
                  <Badge count={activeCount} offset={[10, 0]}>
                    <span>Active</span>
                  </Badge>
                ),
                children: null,
              },
              {
                key: "blocked",
                label: (
                  <Badge count={blockedCount} offset={[10, 0]} color="red">
                    <span>Blocked</span>
                  </Badge>
                ),
                children: null,
              },
              {
                key: "verified",
                label: (
                  <Badge count={verifiedCount} offset={[10, 0]}>
                    <span>Verified</span>
                  </Badge>
                ),
                children: null,
              },
              {
                key: "unverified",
                label: (
                  <Badge
                    count={unverifiedCount}
                    offset={[10, 0]}
                    color="orange"
                  >
                    <span>Unverified</span>
                  </Badge>
                ),
                children: null,
              },
            ]}
          />

          {/* Table */}
          <Table<AdminCustomer>
            rowKey="_id"
            columns={columns}
            dataSource={customers || []}
            loading={isLoading}
            scroll={{ x: 1200 }}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} customers`,
            }}
            expandable={{
              expandedRowRender: (record) => (
                <Card size="small" style={{ background: "#fafafa" }}>
                  <Title level={5}>Complete Customer Details</Title>

                  {/* Personal Information */}
                  <Descriptions
                    column={2}
                    size="small"
                    title="Personal Information"
                    bordered
                    style={{ marginBottom: 16 }}
                  >
                    <Descriptions.Item label="Full Name">
                      {record.name}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      {record.email}
                    </Descriptions.Item>
                    <Descriptions.Item label="Phone">
                      {record.phone || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email Verified">
                      <Tag
                        color={record.isEmailVerified ? "success" : "default"}
                      >
                        {record.isEmailVerified ? "Yes" : "No"}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Phone Verified">
                      <Tag
                        color={record.isPhoneVerified ? "success" : "default"}
                      >
                        {record.isPhoneVerified ? "Yes" : "No"}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Joined">
                      {record.createdAt
                        ? dayjs(record.createdAt).format("YYYY-MM-DD HH:mm")
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Updated">
                      {record.updatedAt
                        ? dayjs(record.updatedAt).format("YYYY-MM-DD HH:mm")
                        : "-"}
                    </Descriptions.Item>
                  </Descriptions>

                  {/* Address Information */}
                  {(record.addressLine1 ||
                    record.city ||
                    record.state ||
                    record.postalCode) && (
                    <Descriptions
                      column={2}
                      size="small"
                      title="Address Information"
                      bordered
                      style={{ marginBottom: 16 }}
                    >
                      <Descriptions.Item label="Address Line 1">
                        {record.addressLine1 || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Address Line 2">
                        {record.addressLine2 || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="City">
                        {record.city || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="State">
                        {record.state || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Postal Code">
                        {record.postalCode || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Country">
                        {record.country || "-"}
                      </Descriptions.Item>
                    </Descriptions>
                  )}

                  {/* Account Status */}
                  {record.isBlocked && (
                    <>
                      <Descriptions
                        column={2}
                        size="small"
                        title="Account Status"
                        bordered
                        style={{ marginBottom: 16 }}
                      >
                        <Descriptions.Item label="Status" span={2}>
                          <Tag color="red">Blocked</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Blocked At">
                          {record.blockedAt
                            ? dayjs(record.blockedAt).format("YYYY-MM-DD HH:mm")
                            : "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Block Reason" span={2}>
                          {record.blockedReason || "-"}
                        </Descriptions.Item>
                      </Descriptions>
                    </>
                  )}
                </Card>
              ),
            }}
          />
        </Space>
      </Card>
    </div>
  );
};

export default Customers;
