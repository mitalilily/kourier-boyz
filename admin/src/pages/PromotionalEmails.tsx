import {
  DeleteOutlined,
  EditOutlined,
  MailOutlined,
  PlusOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  App,
  Card,
  Empty,
  Image,
  Input,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useState } from "react";
import { toast } from "sonner";
import {
  usePromotionalEmails,
  useDeletePromotionalEmail,
  useSendPromotionalEmail,
  usePromotionalEmailStats,
  useSubscribers,
  useSubscriberStats,
  useDeleteSubscriber,
  useToggleSubscriberStatus,
  useAddSubscriber,
} from "../api/promotionalEmails";
import AddPromotionalEmailDrawer from "../components/promotionalEmails/AddPromotionalEmailDrawer";
import PermissionButton from "../components/PermissionButton";
import type { PromotionalEmail, Subscriber } from "../types/promotionalEmail";
import { PROMOTIONAL_EMAIL_STATUSES } from "../types/promotionalEmail";

const { Title, Text } = Typography;
const { Search } = Input;

const PromotionalEmails = () => {
  const { modal } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<PromotionalEmail | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [activeTab, setActiveTab] = useState("emails");

  // Subscriber state
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [subscriberStatus, setSubscriberStatus] = useState<string>("active");
  const [subscriberPagination, setSubscriberPagination] = useState({ page: 1, limit: 10 });
  const [newSubscriberEmail, setNewSubscriberEmail] = useState("");
  const [newSubscriberName, setNewSubscriberName] = useState("");

  // Email queries
  const { data: emailsData, isLoading: emailsLoading } = usePromotionalEmails({
    status: statusFilter || undefined,
    search: searchQuery || undefined,
    page: pagination.page,
    limit: pagination.limit,
  });
  const { data: statsData } = usePromotionalEmailStats();
  const deleteEmail = useDeletePromotionalEmail();
  const sendEmail = useSendPromotionalEmail();

  // Subscriber queries
  const { data: subscribersData, isLoading: subscribersLoading } = useSubscribers({
    status: subscriberStatus || "active",
    search: subscriberSearch || undefined,
    page: subscriberPagination.page,
    limit: subscriberPagination.limit,
  });
  const { data: subscriberStatsData } = useSubscriberStats();
  const deleteSubscriber = useDeleteSubscriber();
  const toggleSubscriberStatus = useToggleSubscriberStatus();
  const addSubscriber = useAddSubscriber();

  const emails = emailsData?.emails || [];
  const totalEmails = emailsData?.pagination?.total || 0;
  const subscribers = subscribersData?.subscribers || [];
  const totalSubscribers = subscribersData?.pagination?.total || 0;

  // Edit button click
  const handleEdit = (email: PromotionalEmail) => {
    setEditingEmail(email);
    setDrawerOpen(true);
  };

  // Delete email
  const handleDelete = (id: string) => {
    if (!id) {
      toast.error("Invalid email ID");
      return;
    }

    modal.confirm({
      title: "Delete Promotional Email",
      content:
        "Are you sure you want to delete this email? This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        deleteEmail.mutate(id, {
          onSuccess: () => toast.success("Promotional email deleted!"),
          onError: () => toast.error("Failed to delete promotional email"),
        });
      },
    });
  };

  // Send email
  const handleSend = (email: PromotionalEmail) => {
    if (!email._id) {
      toast.error("Invalid email ID");
      return;
    }

    if (email.status !== "published") {
      toast.error("Only published emails can be sent");
      return;
    }

    modal.confirm({
      title: "Send Promotional Email",
      content: `Are you sure you want to send "${email.subject}" to ${email.targetAudience === 'all' ? 'all subscribers and customers' : 'subscribers only'}?`,
      okText: "Send",
      okType: "primary",
      cancelText: "Cancel",
      onOk: () => {
        sendEmail.mutate(email._id!, {
          onSuccess: (data) => toast.success(`Email sent to ${data.sent} recipients!`),
          onError: () => toast.error("Failed to send promotional email"),
        });
      },
    });
  };

  // Add subscriber manually
  const handleAddSubscriber = () => {
    if (!newSubscriberEmail) {
      toast.error("Please enter an email address");
      return;
    }

    addSubscriber.mutate(
      { email: newSubscriberEmail, name: newSubscriberName || undefined },
      {
        onSuccess: () => {
          toast.success("Subscriber added successfully!");
          setNewSubscriberEmail("");
          setNewSubscriberName("");
        },
        onError: (error: any) => {
          toast.error(error.response?.data?.error || "Failed to add subscriber");
        },
      }
    );
  };

  // Delete subscriber
  const handleDeleteSubscriber = (id: string) => {
    modal.confirm({
      title: "Delete Subscriber",
      content: "Are you sure you want to delete this subscriber?",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        deleteSubscriber.mutate(id, {
          onSuccess: () => toast.success("Subscriber deleted!"),
          onError: () => toast.error("Failed to delete subscriber"),
        });
      },
    });
  };

  // Toggle subscriber status
  const handleToggleSubscriber = (id: string) => {
    toggleSubscriberStatus.mutate(id, {
      onSuccess: () => toast.success("Subscriber status updated!"),
      onError: () => toast.error("Failed to update subscriber status"),
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      published: "green",
      draft: "orange",
    };
    return colors[status] || "default";
  };

  const getAudienceLabel = (audience: string) => {
    const labels: Record<string, string> = {
      all: "All",
      subscribers: "Subscribers",
      customers: "Customers",
    };
    return labels[audience] || audience;
  };

  const emailColumns = [
    {
      title: "Featured Image",
      dataIndex: "featuredImage",
      key: "featuredImage",
      width: 120,
      render: (image: string) =>
        image ? (
          <Image
            src={image}
            alt="Featured"
            width={80}
            height={60}
            className="object-cover rounded"
          />
        ) : (
          <div className="w-20 h-15 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">
            No Image
          </div>
        ),
    },
    {
      title: "Subject",
      dataIndex: "subject",
      key: "subject",
      render: (text: string, record: PromotionalEmail) => (
        <div>
          <div className="font-medium">{text}</div>
          {record.excerpt && (
            <Text type="secondary" className="text-xs">
              {record.excerpt.substring(0, 60)}...
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Author",
      dataIndex: "author",
      key: "author",
      render: (author: PromotionalEmail["author"]) =>
        typeof author === "object" ? author.name : "Unknown",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
      ),
    },
    {
      title: "Audience",
      dataIndex: "targetAudience",
      key: "targetAudience",
      render: (audience: string) => (
        <Tag icon={<UserOutlined />}>{getAudienceLabel(audience)}</Tag>
      ),
    },
    {
      title: "Sent",
      dataIndex: "sentCount",
      key: "sentCount",
      width: 80,
      render: (count: number, record: PromotionalEmail) => (
        <div>
          <Text>{count || 0}</Text>
          {record.sentAt && (
            <div className="text-xs text-gray-400">
              {new Date(record.sentAt).toLocaleDateString()}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_: unknown, record: PromotionalEmail) => (
        <Space>
          {record.status === "published" && (
            <PermissionButton
              module="promotional-emails"
              permission="create"
              type="text"
              onClick={() => handleSend(record)}
              loading={sendEmail.isPending}
            >
              <Tooltip title="Send Email">
                <SendOutlined />
              </Tooltip>
            </PermissionButton>
          )}

          <PermissionButton
            module="promotional-emails"
            permission="update"
            type="text"
            onClick={() => handleEdit(record)}
          >
            <Tooltip title="Edit">
              <EditOutlined />
            </Tooltip>
          </PermissionButton>

          <PermissionButton
            module="promotional-emails"
            permission="delete"
            type="text"
            danger
            onClick={() => handleDelete(record._id!)}
          >
            <Tooltip title="Delete">
              <DeleteOutlined />
            </Tooltip>
          </PermissionButton>
        </Space>
      ),
    },
  ];

  const subscriberColumns = [
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (email: string, record: Subscriber) => (
        <div>
          <div className="font-medium">{email}</div>
          {record.name && (
            <Text type="secondary" className="text-xs">
              {record.name}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (isActive: boolean) => (
        <Tag color={isActive ? "green" : "default"}>
          {isActive ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Source",
      dataIndex: "source",
      key: "source",
      render: (source: string) => (
        <Tag>{source.charAt(0).toUpperCase() + source.slice(1)}</Tag>
      ),
    },
    {
      title: "Subscribed",
      dataIndex: "subscribedAt",
      key: "subscribedAt",
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString() : "-",
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_: unknown, record: Subscriber) => (
        <Space>
          <PermissionButton
            module="promotional-emails"
            permission="update"
            type="text"
            onClick={() => handleToggleSubscriber(record._id)}
          >
            <Tooltip title={record.isActive ? "Deactivate" : "Activate"}>
              <UserOutlined />
            </Tooltip>
          </PermissionButton>

          <PermissionButton
            module="promotional-emails"
            permission="delete"
            type="text"
            danger
            onClick={() => handleDeleteSubscriber(record._id)}
          >
            <Tooltip title="Delete">
              <DeleteOutlined />
            </Tooltip>
          </PermissionButton>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header Card */}
      <Card className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <Title level={2} style={{ margin: 0 }}>
            <MailOutlined className="mr-2" />
            Promotional Emails
          </Title>
          <PermissionButton
            module="promotional-emails"
            permission="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingEmail(null);
              setDrawerOpen(true);
            }}
            size="large"
          >
            Create Email
          </PermissionButton>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <Statistic
            title="Total Emails"
            value={statsData?.total || 0}
            prefix={<MailOutlined />}
          />
        </Card>
        <Card>
          <Statistic
            title="Published"
            value={statsData?.published || 0}
            valueStyle={{ color: "#52c41a" }}
          />
        </Card>
        <Card>
          <Statistic
            title="Total Sent"
            value={statsData?.totalSent || 0}
            prefix={<SendOutlined />}
          />
        </Card>
        <Card>
          <Statistic
            title="Active Subscribers"
            value={subscriberStatsData?.active || statsData?.activeSubscribers || 0}
            prefix={<UserOutlined />}
            valueStyle={{ color: "#1890ff" }}
          />
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "emails",
              label: "Promotional Emails",
              children: (
                <>
                  {/* Filters */}
                  <div className="flex flex-wrap gap-4 mb-4">
                    <Search
                      placeholder="Search emails..."
                      allowClear
                      style={{ width: 250 }}
                      onSearch={(value) => {
                        setSearchQuery(value);
                        setPagination({ page: 1, limit: 10 });
                      }}
                    />
                    <Select
                      placeholder="Filter by status"
                      style={{ width: 150 }}
                      allowClear
                      onChange={(value) => {
                        setStatusFilter(value || "");
                        setPagination({ page: 1, limit: 10 });
                      }}
                      options={PROMOTIONAL_EMAIL_STATUSES.map((status) => ({
                        label: status.label,
                        value: status.value,
                      }))}
                    />
                  </div>

                  {/* Table */}
                  {emailsLoading ? (
                    <div className="text-center py-12">
                      <Spin size="large" />
                    </div>
                  ) : emails.length === 0 ? (
                    <Empty
                      description={
                        <Text type="secondary">
                          No promotional emails found. Click "Create Email" to create your first one.
                        </Text>
                      }
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <Table
                      columns={emailColumns}
                      dataSource={emails}
                      rowKey="_id"
                      pagination={{
                        current: pagination.page,
                        pageSize: pagination.limit,
                        total: totalEmails,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} emails`,
                        onChange: (page, pageSize) => {
                          setPagination({ page, limit: pageSize });
                        },
                      }}
                    />
                  )}
                </>
              ),
            },
            {
              key: "subscribers",
              label: `Subscribers (${subscriberStatsData?.active || 0} active)`,
              children: (
                <>
                  {/* Add Subscriber */}
                  <div className="flex flex-wrap gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <Input
                      placeholder="Email address"
                      value={newSubscriberEmail}
                      onChange={(e) => setNewSubscriberEmail(e.target.value)}
                      style={{ width: 250 }}
                    />
                    <Input
                      placeholder="Name (optional)"
                      value={newSubscriberName}
                      onChange={(e) => setNewSubscriberName(e.target.value)}
                      style={{ width: 200 }}
                    />
                    <PermissionButton
                      module="promotional-emails"
                      permission="create"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleAddSubscriber}
                      loading={addSubscriber.isPending}
                    >
                      Add Subscriber
                    </PermissionButton>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-4 mb-4">
                    <Search
                      placeholder="Search subscribers..."
                      allowClear
                      style={{ width: 250 }}
                      onSearch={(value) => {
                        setSubscriberSearch(value);
                        setSubscriberPagination({ page: 1, limit: 10 });
                      }}
                    />
                    <Select
                      placeholder="Filter by status"
                      style={{ width: 150 }}
                      value={subscriberStatus || "active"}
                      onChange={(value) => {
                        setSubscriberStatus(value || "active");
                        setSubscriberPagination({ page: 1, limit: 10 });
                      }}
                      options={[
                        { label: "Active", value: "active" },
                        { label: "Inactive", value: "inactive" },
                      ]}
                    />
                  </div>

                  {/* Table */}
                  {subscribersLoading ? (
                    <div className="text-center py-12">
                      <Spin size="large" />
                    </div>
                  ) : subscribers.length === 0 ? (
                    <Empty
                      description={
                        <Text type="secondary">
                          No subscribers found. Add subscribers manually or wait for users to subscribe.
                        </Text>
                      }
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <Table
                      columns={subscriberColumns}
                      dataSource={subscribers}
                      rowKey="_id"
                      pagination={{
                        current: subscriberPagination.page,
                        pageSize: subscriberPagination.limit,
                        total: totalSubscribers,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} subscribers`,
                        onChange: (page, pageSize) => {
                          setSubscriberPagination({ page, limit: pageSize });
                        },
                      }}
                    />
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* Add/Edit Drawer */}
      <AddPromotionalEmailDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingEmail(null);
        }}
        editingEmail={editingEmail}
      />
    </div>
  );
};

export default PromotionalEmails;

