import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Empty,
  Image,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useState } from "react";
import { toast } from "sonner";
import { useBlogs, useDeleteBlog, useNewsletterSubscribers } from "../api/blogs";
import AddBlogDrawer from "../components/blogs/AddBlogDrawer";
import PermissionButton from "../components/PermissionButton";
import type { Blog } from "../types/blog";
import { BLOG_STATUSES } from "../types/blog";

const { Title, Text } = Typography;
const { Search } = Input;

const Blogs = () => {
  const { modal } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [activeTab, setActiveTab] = useState("blogs");
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [subscriberPagination, setSubscriberPagination] = useState({ page: 1, limit: 10 });

  const { data, isLoading } = useBlogs({
    status: statusFilter || undefined,
    search: searchQuery || undefined,
    page: pagination.page,
    limit: pagination.limit,
  });

  const deleteBlog = useDeleteBlog();

  const blogs = data?.blogs || [];
  const total = data?.pagination?.total || 0;

  // Newsletter subscribers
  const { data: subscribersData, isLoading: subscribersLoading } = useNewsletterSubscribers({
    search: subscriberSearch || undefined,
    page: subscriberPagination.page,
    limit: subscriberPagination.limit,
  });

  const subscribers = subscribersData?.subscribers || [];
  const totalSubscribers = subscribersData?.pagination?.total || 0;

  // Edit button click
  const handleEdit = (blog: Blog) => {
    setEditingBlog(blog);
    setDrawerOpen(true);
  };

  // Delete blog
  const handleDelete = (id: string) => {
    if (!id) {
      toast.error("Invalid blog ID");
      return;
    }

    modal.confirm({
      title: "Delete Blog",
      content:
        "Are you sure you want to delete this blog? This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        deleteBlog.mutate(id, {
          onSuccess: () => toast.success("Blog deleted!"),
          onError: () => toast.error("Failed to delete blog"),
        });
      },
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      published: "green",
      draft: "orange",
      archived: "default",
    };
    return colors[status] || "default";
  };

  const columns = [
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
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text: string, record: Blog) => (
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
      render: (author: Blog["author"]) =>
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
      title: "Views",
      dataIndex: "views",
      key: "views",
      width: 80,
      render: (views: number) => <Text>{views || 0}</Text>,
    },
    {
      title: "Published",
      dataIndex: "publishedAt",
      key: "publishedAt",
      width: 120,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString() : "-",
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_: unknown, record: Blog) => (
        <Space>
          <Tooltip title="View">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() =>
                window.open(`/blog/${record.slug || record._id}`, "_blank")
              }
            />
          </Tooltip>

          <PermissionButton
            module="blogs"
            permission="update"
            type="text"
            onClick={() => handleEdit(record)}
          >
            <Tooltip title="Edit">
              <EditOutlined />
            </Tooltip>
          </PermissionButton>
          <PermissionButton
            module="blogs"
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
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: any) => name || record.user?.name || "-",
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (email: string) => email,
    },
    {
      title: "Subscribed",
      dataIndex: "subscribedAt",
      key: "subscribedAt",
      width: 150,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString() : "-",
    },
  ];

  return (
    <div className="p-6">
      {/* Header Card */}
      <Card className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <Title level={2} style={{ margin: 0 }}>
            Blog Management
          </Title>
          {activeTab === "blogs" && (
            <Space>
              <Search
                placeholder="Search blogs..."
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
                options={BLOG_STATUSES.map((status) => ({
                  label: status.label,
                  value: status.value,
                }))}
              />
              <PermissionButton
                module="blogs"
                permission="create"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingBlog(null);
                  setDrawerOpen(true);
                }}
                size="large"
              >
                Add Blog
              </PermissionButton>
            </Space>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "blogs",
              label: "Blogs",
              children: (
                <>
                  {isLoading ? (
                    <div className="text-center py-12">
                      <Spin size="large" />
                    </div>
                  ) : blogs.length === 0 ? (
                    <Empty
                      description={
                        <Text type="secondary">
                          No blogs found. Click "Add Blog" to create your first blog post.
                        </Text>
                      }
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <Table
                      columns={columns}
                      dataSource={blogs}
                      rowKey="_id"
                      pagination={{
                        current: pagination.page,
                        pageSize: pagination.limit,
                        total,
                        showSizeChanger: true,
                        showTotal: (total) => `Total ${total} blogs`,
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
              label: (
                <Space>
                  <UserOutlined />
                  Newsletter Subscribers
                </Space>
              ),
              children: (
                <>
                  <div className="mb-4">
                    <Search
                      placeholder="Search subscribers..."
                      allowClear
                      style={{ width: 300 }}
                      onSearch={(value) => {
                        setSubscriberSearch(value);
                        setSubscriberPagination({ page: 1, limit: 10 });
                      }}
                    />
                  </div>
                  {subscribersLoading ? (
                    <div className="text-center py-12">
                      <Spin size="large" />
                    </div>
                  ) : subscribers.length === 0 ? (
                    <Empty
                      description={
                        <Text type="secondary">
                          No newsletter subscribers found.
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
      <AddBlogDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingBlog(null);
        }}
        editingBlog={editingBlog}
      />
    </div>
  );
};

export default Blogs;
