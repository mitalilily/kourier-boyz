import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  StarOutlined,
} from "@ant-design/icons";
import { App, Card, Input, Select, Statistic, Tabs } from "antd";
import { useState } from "react";
import { toast } from "sonner";
import {
  useBulkDeleteCategories,
  useBulkUpdateStatus,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "../api/category";
import AddCategoryDrawer from "../components/categories/AddCategoryDrawer";
import CategoryTable from "../components/categories/CategoryTable";
import type { Category } from "../types/category";
import { useModulePermissions } from "../hooks/useModulePermissions";
import PermissionButton from "../components/PermissionButton";
import PermissionGate from "../components/PermissionGate";
import Requests from "./Requests";

const CategoryPage = () => {
  const { modal } = App.useApp();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [topFilter, setTopFilter] = useState<string>("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // Permission checks - single hook call for better performance
  const permissions = useModulePermissions("categories");
  const requestsPermissions = useModulePermissions("requests");

  // Queries
  const { data, isLoading } = useCategories({
    search: searchTerm,
    status: statusFilter,
    top: topFilter,
    includeSubcategories: true, // Include subcategories in the list
  });
  const categories = data?.categories || [];
  const stats = data?.stats || { total: 0, active: 0, inactive: 0, top: 0 };

  // Mutations
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const bulkDelete = useBulkDeleteCategories();
  const bulkUpdateStatus = useBulkUpdateStatus();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Add or Update category
  const handleAddOrUpdate = (
    formData: FormData,
    form: { resetFields: () => void }
  ) => {
    if (editingCategory) {
      updateCategory.mutate(
        { id: editingCategory._id!, formData },
        {
          onSuccess: () => {
            toast.success("Category updated successfully!");
            setDrawerOpen(false);
            form.resetFields();
            setEditingCategory(null);
          },
          onError: () => toast.error("Failed to update category"),
        }
      );
    } else {
      createCategory.mutate(formData, {
        onSuccess: () => {
          toast.success("Category created successfully!");
          setDrawerOpen(false);
          form.resetFields();
        },
        onError: () => toast.error("Failed to create category"),
      });
    }
  };

  // Edit button click
  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setDrawerOpen(true);
  };

  // Delete category
  const handleDelete = (id: string) => {
    if (!id) {
      toast.error("Invalid category ID");
      return;
    }

    modal.confirm({
      title: "Delete Category",
      content: "Are you sure you want to delete this category?",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        deleteCategory.mutate(id, {
          onSuccess: () => toast.success("Category deleted!"),
          onError: (error) => {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to delete category";
            toast.error(message);
          },
        });
      },
    });
  };

  // Bulk delete
  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      toast.error("Please select categories to delete");
      return;
    }

    modal.confirm({
      title: "Delete Selected Categories",
      content: `Are you sure you want to delete ${selectedRowKeys.length} categories?`,
      okText: "Delete",
      okType: "danger",
      onOk: () => {
        bulkDelete.mutate(selectedRowKeys, {
          onSuccess: () => {
            toast.success(`${selectedRowKeys.length} categories deleted!`);
            setSelectedRowKeys([]);
          },
          onError: (error) => {
            const message =
              error instanceof Error
                ? error.message
                : "Failed to delete categories";
            toast.error(message);
          },
        });
      },
    });
  };

  // Bulk activate
  const handleBulkActivate = () => {
    if (selectedRowKeys.length === 0) {
      toast.error("Please select categories");
      return;
    }

    bulkUpdateStatus.mutate(
      { ids: selectedRowKeys, status: "active" },
      {
        onSuccess: () => {
          toast.success(`${selectedRowKeys.length} categories activated!`);
          setSelectedRowKeys([]);
        },
        onError: () => toast.error("Failed to activate categories"),
      }
    );
  };

  // Bulk deactivate
  const handleBulkDeactivate = () => {
    if (selectedRowKeys.length === 0) {
      toast.error("Please select categories");
      return;
    }

    bulkUpdateStatus.mutate(
      { ids: selectedRowKeys, status: "inactive" },
      {
        onSuccess: () => {
          toast.success(`${selectedRowKeys.length} categories deactivated!`);
          setSelectedRowKeys([]);
        },
        onError: () => toast.error("Failed to deactivate categories"),
      }
    );
  };

  const CategoriesContent = (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <Statistic
            title="Total Categories"
            value={stats.total}
            prefix={<AppstoreOutlined />}
            valueStyle={{ color: "#1890ff" }}
          />
        </Card>
        <Card>
          <Statistic
            title="Active"
            value={stats.active}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: "#52c41a" }}
          />
        </Card>
        <Card>
          <Statistic
            title="Inactive"
            value={stats.inactive}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: "#ff4d4f" }}
          />
        </Card>
        <Card>
          <Statistic
            title="Top Categories"
            value={stats.top}
            prefix={<StarOutlined />}
            valueStyle={{ color: "#faad14" }}
          />
        </Card>
      </div>

      {/* Actions Bar */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
            <Input.Search
              placeholder="Search categories..."
              allowClear
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
            <Select
              placeholder="Status"
              allowClear
              onChange={(value) => setStatusFilter(value || "")}
              className="w-32"
              options={[
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
              ]}
            />
            <Select
              placeholder="Top"
              allowClear
              onChange={(value) => setTopFilter(value || "")}
              className="w-32"
              options={[
                { label: "Top Only", value: "true" },
                { label: "Non-Top", value: "false" },
              ]}
            />
          </div>
          <PermissionButton
            module="categories"
            permission="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingCategory(null);
              setDrawerOpen(true);
            }}
          >
            Add Category
          </PermissionButton>
        </div>

        {/* Bulk Actions */}
        <PermissionGate
          module="categories"
          permission={["update", "delete"]}
          requireAll={false}
        >
          {selectedRowKeys.length > 0 && (
            <div className="mt-4 pt-4 border-t flex gap-2 flex-wrap items-center">
              <span className="text-gray-600 font-medium">
                {selectedRowKeys.length} selected
              </span>
              <PermissionButton
                module="categories"
                permission="update"
                size="small"
                onClick={handleBulkActivate}
                loading={bulkUpdateStatus.isPending}
              >
                Activate
              </PermissionButton>
              <PermissionButton
                module="categories"
                permission="update"
                size="small"
                onClick={handleBulkDeactivate}
                loading={bulkUpdateStatus.isPending}
              >
                Deactivate
              </PermissionButton>
              <PermissionButton
                module="categories"
                permission="delete"
                size="small"
                danger
                onClick={handleBulkDelete}
                loading={bulkDelete.isPending}
              >
                Delete Selected
              </PermissionButton>
            </div>
          )}
        </PermissionGate>
      </Card>

      {/* Table */}
      <Card>
        <CategoryTable
          categories={categories}
          onEdit={handleEdit}
          onDelete={handleDelete}
          loading={isLoading}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={setSelectedRowKeys}
          canEdit={permissions.canUpdate}
          canDelete={permissions.canDelete}
        />
      </Card>

      {/* Add/Edit Drawer */}
      <AddCategoryDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditingCategory(null);
        }}
        onAdded={handleAddOrUpdate}
        category={editingCategory}
        loading={createCategory.isPending || updateCategory.isPending}
      />
    </div>
  );

  const params = new URLSearchParams(window.location.search);
  const defaultKey =
    params.get("tab") === "requests" ? "requests" : "categories";

  // Build tab items conditionally based on permissions
  const tabItems = [
    { key: "categories", label: "Categories", children: CategoriesContent },
  ];

  // Only add Requests tab if user has view permission
  if (requestsPermissions.canView) {
    tabItems.push({
      key: "requests",
      label: "Requests",
      children: <Requests />,
    });
  }

  return <Tabs defaultActiveKey={defaultKey} items={tabItems} />;
};

export default CategoryPage;
