import {
  CloseCircleOutlined,
  CopyOutlined,
  EyeOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminOrders, useCancelOrder } from "../../api/orderQueries";
import type {
  AdminOrder,
  AdminSellerShipment,
  SellerShipmentStatus,
} from "../../api/orders";
import RequestPickupModal from "../../components/orders/RequestPickupModal";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  pending: "default",
  confirmed: "cyan",
  processing: "blue",
  ready_to_ship: "gold",
  shipped: "blue",
  in_transit: "purple",
  out_for_delivery: "orange",
  delivered: "green",
  cancelled: "red",
  refunded: "purple",
};

const sellerStatusColor: Record<SellerShipmentStatus, string> = {
  pending: "default",
  processing: "blue",
  ready_to_ship: "gold",
  shipped: "blue",
  in_transit: "purple",
  pickup_requested: "purple",
  out_for_delivery: "orange",
  delivered: "green",
  cancelled: "red",
};

const OrdersList = () => {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [filters, setFilters] = useState({
    search: "",
    status: undefined as string | undefined,
    paymentStatus: undefined as string | undefined,
    seller: "",
    dateRange: [null, null] as [dayjs.Dayjs | null, dayjs.Dayjs | null],
    page: 1,
    limit: 20,
  });

  // Pickup modal state
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [selectedShipment, setSelectedShipment] =
    useState<AdminSellerShipment | null>(null);

  const { data, isLoading } = useAdminOrders({
    status: filters.status,
    paymentStatus: filters.paymentStatus,
    seller: filters.seller || undefined,
    fromDate: filters.dateRange[0]?.startOf("day").toISOString(),
    toDate: filters.dateRange[1]?.endOf("day").toISOString(),
    search: filters.search,
    page: filters.page,
    limit: filters.limit,
  });

  const cancelOrder = useCancelOrder();

  const orders = data?.data || [];

  const handleCancelOrder = (order: AdminOrder) => {
    modal.confirm({
      title: "Cancel Order?",
      content: `Are you sure you want to cancel order #${
        order.orderNumber || order._id
      }? This action cannot be undone.`,
      okText: "Cancel Order",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await cancelOrder.mutateAsync(order._id);
          message.success("Order cancelled successfully");
        } catch (error) {
          message.error((error as Error)?.message || "Failed to cancel order");
        }
      },
    });
  };

  // Refunds are now handled via the order detail screen using the manual refund flow.

  const handleRequestPickup = (
    order: AdminOrder,
    shipment: AdminSellerShipment
  ) => {
    setSelectedOrder(order);
    setSelectedShipment(shipment);
    setPickupModalOpen(true);
  };

  const canRequestPickup = (shipment: AdminSellerShipment) => {
    return ["pending", "processing"].includes(shipment.status);
  };

  const canCancelOrder = (order: AdminOrder) => {
    // Can cancel if not already shipped/delivered/cancelled
    return ![
      "shipped",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "refunded",
    ].includes(order.status);
  };

  // Get the first eligible shipment for pickup
  const getEligibleShipmentForPickup = (
    order: AdminOrder
  ): AdminSellerShipment | null => {
    return (
      order.sellerShipments.find((shipment) => canRequestPickup(shipment)) ||
      null
    );
  };

  const handleCopyMongooseId = async (mongooseId: string) => {
    try {
      await navigator.clipboard.writeText(mongooseId);
      message.success("Mongoose ID copied to clipboard");
    } catch (error) {
      message.error("Failed to copy Mongoose ID");
    }
  };

  const handleCopyOrderNumber = async (orderNumber: string) => {
    try {
      await navigator.clipboard.writeText(orderNumber);
      message.success("Order Number copied to clipboard");
    } catch (error) {
      message.error("Failed to copy Order Number");
    }
  };

  const columns: ColumnsType<AdminOrder> = [
    {
      title: "Order",
      dataIndex: "orderNumber",
      render: (_, record) => {
        const orderNumber = record.orderNumber || "N/A";
        const mongooseId = record._id;
        return (
          <Space direction="vertical" size={2}>
            <Space size={4}>
              <Text
                strong
                className="text-blue-600 cursor-pointer"
                onClick={() => navigate(`/orders/${record._id}`)}
              >
                {orderNumber}
              </Text>
              <Tooltip title="Copy Order Number">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyOrderNumber(orderNumber);
                  }}
                />
              </Tooltip>
            </Space>
            <Space size={4}>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                ID: {mongooseId}
              </Text>
              <Tooltip title="Copy Mongoose ID">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyMongooseId(mongooseId);
                  }}
                />
              </Tooltip>
            </Space>
          </Space>
        );
      },
    },
    {
      title: "Buyer",
      dataIndex: "buyer",
      render: (buyer: AdminOrder["buyer"]) => (
        <div>
          <div className="font-medium">{buyer?.name}</div>
          <div className="text-xs text-gray-500">{buyer?.email}</div>
        </div>
      ),
    },
    {
      title: "Sellers",
      dataIndex: "sellerShipments",
      render: (shipments: AdminOrder["sellerShipments"]) => (
        <Space direction="vertical" size={4}>
          {shipments.map((shipment) => (
            <Tag key={shipment._id} color={sellerStatusColor[shipment.status]}>
              {shipment.seller?.businessName ||
                shipment.seller?.name ||
                shipment.seller?._id}{" "}
              – {shipment.status.replace(/_/g, " ")}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (value: string) => (
        <Tag color={statusColors[value] || "default"}>{value}</Tag>
      ),
    },
    {
      title: "Payment",
      dataIndex: "paymentStatus",
      render: (value: string) => (
        <Tag color={statusColors[value] || "default"}>{value}</Tag>
      ),
    },
    {
      title: "Total",
      dataIndex: "total",
      render: (value: number) => `₹${value.toFixed(2)}`,
    },
    {
      title: "Ordered At",
      dataIndex: "orderedAt",
      render: (value: string) => dayjs(value).format("DD MMM YYYY, HH:mm"),
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      fixed: "right" as const,
      render: (_, record) => {
        const eligibleShipment = getEligibleShipmentForPickup(record);
        return (
          <Space size={4} style={{ whiteSpace: "nowrap" }}>
            <Tooltip title="View Details">
              <Button
                type="primary"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => navigate(`/orders/${record._id}`)}
              />
            </Tooltip>
            {eligibleShipment && (
              <Tooltip
                title={`Request Pickup for ${
                  eligibleShipment.seller?.businessName ||
                  eligibleShipment.seller?.name ||
                  "Seller"
                }`}
              >
                <Button
                  type="default"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={() => handleRequestPickup(record, eligibleShipment)}
                />
              </Tooltip>
            )}
            {canCancelOrder(record) && (
              <Tooltip title="Cancel Order">
                <Button
                  type="default"
                  danger
                  size="small"
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleCancelOrder(record)}
                  loading={cancelOrder.isPending}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card>
      <Space direction="vertical" size="large" className="w-full">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Title level={4} className="mb-0">
              Orders
            </Title>
            <Text type="secondary">Overview of marketplace orders</Text>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input.Search
            placeholder="Search order ID or buyer"
            allowClear
            style={{ width: 220 }}
            onSearch={(value) =>
              setFilters((prev) => ({
                ...prev,
                search: value,
                page: 1,
              }))
            }
          />
          <Select
            placeholder="Order status"
            allowClear
            style={{ width: 180 }}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                status: value,
                page: 1,
              }))
            }
            options={[
              { value: "pending", label: "Pending" },
              { value: "processing", label: "Processing" },
              { value: "ready_to_ship", label: "Ready to Ship" },
              { value: "shipped", label: "Shipped" },
              { value: "in_transit", label: "In Transit" },
              { value: "out_for_delivery", label: "Out for Delivery" },
              { value: "delivered", label: "Delivered" },
              { value: "cancelled", label: "Cancelled" },
              { value: "refunded", label: "Refunded" },
            ]}
          />
          <Select
            placeholder="Payment status"
            allowClear
            style={{ width: 160 }}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                paymentStatus: value,
                page: 1,
              }))
            }
            options={[
              { value: "paid", label: "Paid" },
              { value: "pending", label: "Pending" },
              { value: "failed", label: "Failed" },
              { value: "refunded", label: "Refunded" },
            ]}
          />
          <Input
            placeholder="Seller ID"
            allowClear
            style={{ width: 180 }}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                seller: event.target.value,
                page: 1,
              }))
            }
          />
          <RangePicker
            onChange={(values) =>
              setFilters((prev) => ({
                ...prev,
                dateRange: values || [null, null],
                page: 1,
              }))
            }
          />
        </div>

        <Table<AdminOrder>
          rowKey={(record) => record._id}
          loading={isLoading}
          columns={columns}
          dataSource={orders}
          scroll={{ x: 1200 }}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: data?.pagination.total ?? 0,
            showSizeChanger: true,
            onChange: (page, pageSize) =>
              setFilters((prev) => ({
                ...prev,
                page,
                limit: pageSize,
              })),
          }}
          locale={{ emptyText: <Empty description="No orders found" /> }}
        />
      </Space>

      {/* Request Pickup Modal */}
      <RequestPickupModal
        open={pickupModalOpen}
        onClose={() => {
          setPickupModalOpen(false);
          setSelectedOrder(null);
          setSelectedShipment(null);
        }}
        order={selectedOrder || undefined}
        shipment={selectedShipment || undefined}
        onSuccess={() => {
          setPickupModalOpen(false);
          setSelectedOrder(null);
          setSelectedShipment(null);
        }}
      />
    </Card>
  );
};

export default OrdersList;
