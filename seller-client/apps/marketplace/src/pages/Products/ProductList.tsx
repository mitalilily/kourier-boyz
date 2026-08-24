import {
  // CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  LockOutlined,
  PlusOutlined,
  SearchOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Category } from '../../api/categories'
import {
  useAdjustProductStock,
  useBulkDeleteProducts,
  useBulkUpdateProductStatus,
  useDeleteProduct,
  // useDuplicateProduct,
  useExportProductsCSV,
  useImportProductsCSV,
  useLowStockProducts,
  useProducts,
} from '../../api/productQueries'
import type { Product } from '../../api/products'
import RequirementsAlert from '../../components/RequirementsAlert'
import { useAuthStore } from '../../store/authStore'
import { getCategoryPath } from '../../utils/categoryUtils'

const { Title, Text } = Typography

const ProductList = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isLowStockView = searchParams.get('lowStock') === 'true'

  const { message } = App.useApp()
  const user = useAuthStore((state) => state?.user)
  const adjustMutation = useAdjustProductStock()
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustingProduct, setAdjustingProduct] = useState<{
    id: string
    name: string
    stock: number
  } | null>(null)
  const [deltaValue, setDeltaValue] = useState<number>(0)

  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState<'all' | 'drafts'>('all')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // Fetch products - disabled when viewing low stock
  const { data, isLoading } = useProducts({
    page,
    limit,
    search: search || undefined,
    status: statusFilter,
    enabled: !isLowStockView,
  })

  // Fetch low stock products - only when in low stock view
  const { data: lowStockData, isLoading: isLoadingLowStock } = useLowStockProducts({
    page,
    limit,
    enabled: isLowStockView,
  })

  // Use the appropriate data source
  const productsData = isLowStockView ? lowStockData : data
  const isLoadingProducts = isLowStockView ? isLoadingLowStock : isLoading

  // Reset page when entering/exiting low stock view
  useEffect(() => {
    if (isLowStockView && page !== 1) {
      setPage(1)
    }
  }, [isLowStockView, page])

  // Clear low stock view when filters change (except pagination)
  useEffect(() => {
    if (isLowStockView && (search || statusFilter)) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('lowStock')
      navigate(`/products?${newParams.toString()}`, { replace: true })
    }
  }, [search, statusFilter, isLowStockView, searchParams, navigate])

  const deleteProductMutation = useDeleteProduct()
  const bulkDeleteMutation = useBulkDeleteProducts()
  const bulkUpdateStatusMutation = useBulkUpdateProductStatus()
  // const duplicateProductMutation = useDuplicateProduct()
  const exportCsvMutation = useExportProductsCSV()
  const importCsvMutation = useImportProductsCSV()
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)

  // Check if user is approved
  const isApproved = (user && user?.isApproved) || false
  const canManageProducts = isApproved

  const products = productsData?.products || []
  const total = productsData?.pagination?.total || 0

  // Helper function to check if a product is out of stock
  const isOutOfStock = (product: Product): boolean => {
    if (product.hasVariants) {
      // For variant products, check if total stock is 0
      return (product.totalStock || 0) === 0
    } else {
      // For simple products, check if stock is 0
      return (product.stock || 0) === 0
    }
  }

  // Helper function to check if a product is low stock (but not out of stock)
  const isLowStock = (product: Product): boolean => {
    if (isOutOfStock(product)) return false // Don't mark as low stock if out of stock

    const defaultThreshold = 5

    if (product.hasVariants) {
      // For variant products, check if any variants are low stock
      return (product.lowStockVariants || 0) > 0
    } else {
      // For simple products, check if stock <= threshold
      const threshold = product.lowStockThreshold ?? defaultThreshold
      return (product.stock || 0) <= threshold
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProductMutation.mutateAsync(id)
      message.success('Product deleted successfully')
    } catch {
      message.error('Failed to delete product')
    }
  }

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteMutation.mutateAsync(selectedRowKeys as string[])
      message.success(`${selectedRowKeys.length} products deleted successfully`)
      setSelectedRowKeys([])
    } catch {
      message.error('Failed to delete products')
    }
  }

  const handleBulkStatusUpdate = async (status: 'active' | 'inactive' | 'draft') => {
    try {
      await bulkUpdateStatusMutation.mutateAsync({
        productIds: selectedRowKeys as string[],
        status,
      })
      message.success(`${selectedRowKeys.length} products updated successfully`)
      setSelectedRowKeys([])
    } catch {
      message.error('Failed to update products')
    }
  }

  const columns: ColumnsType<Product> = [
    {
      title: 'Image',
      dataIndex: 'mainImage',
      key: 'mainImage',
      width: 80,
      render: (image: string | undefined, record: Product) =>
        image ? (
          <Image
            src={image}
            alt={record.name}
            width={50}
            height={50}
            style={{ objectFit: 'cover' }}
            placeholder
          />
        ) : (
          <div
            style={{
              width: 50,
              height: 50,
              background: '#f5f5f5',
              border: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: 10,
            }}
          >
            No Image
          </div>
        ),
    },
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string, record: Product) => {
        const outOfStock = isOutOfStock(record)
        const lowStock = isLowStock(record)
        const hasAdminNotice =
          Array.isArray(record?.objections) &&
          record?.objections.some((o: { resolved?: boolean }) => !o.resolved)

        return (
          <Space size="small">
            <Button type="link" onClick={() => navigate(`/products/${record._id}`)}>
              <span className="text-sm font-medium truncate inline-block max-w-[150px]">
                {name}
              </span>
            </Button>
            {outOfStock && (
              <Tooltip
                title={
                  record.hasVariants ? 'All variants are out of stock' : 'Product is out of stock'
                }
              >
                <Tag color="red" style={{ margin: 0 }}>
                  Out of Stock
                </Tag>
              </Tooltip>
            )}
            {!outOfStock && lowStock && (
              <Tooltip
                title={
                  record.hasVariants
                    ? `${record.lowStockVariants || 0} variant(s) with low stock`
                    : `Low stock - only ${record.stock} remaining`
                }
              >
                <Tag color="orange" icon={<ExclamationCircleOutlined />} style={{ margin: 0 }}>
                  Low Stock
                </Tag>
              </Tooltip>
            )}
            {hasAdminNotice && (
              <Tooltip title="There is an admin notice for this product">
                <Tag color="red" style={{ margin: 0 }}>
                  Notice
                </Tag>
              </Tooltip>
            )}
          </Space>
        )
      },
    },

    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 180,
      render: (category: Product['category']) => {
        // Handle category which might be populated as object or just id string
        const categoryPath = category
          ? typeof category === 'string'
            ? category
            : getCategoryPath({
                ...category,
                mainImage: '',
                hoverImage: '',
                banners: [],
                status: 'active',
                createdAt: '',
                updatedAt: '',
              } as Category)
          : '-'
        return (
          <Tooltip title={categoryPath}>
            <Text ellipsis style={{ maxWidth: 180 }}>
              {categoryPath || '-'}
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'success',
          inactive: 'default',
          draft: 'warning',
          out_of_stock: 'error',
          pending_approval: 'warning',
          pending_category_approval: 'orange',
        }
        const labelMap: Record<string, string> = {
          pending_category_approval: 'Awaiting Category Approval',
        }
        return (
          <Tag color={colorMap[status] || 'default'}>
            {labelMap[status] || status.replace('_', ' ').toUpperCase()}
          </Tag>
        )
      },
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      render: (stock: number, record: Product) => {
        if (record.hasVariants) {
          const totalStock = record.totalStock || 0
          const lowStockVariants = record.lowStockVariants || 0
          return (
            <div>
              <Tag color={totalStock === 0 ? 'red' : lowStockVariants > 0 ? 'orange' : 'green'}>
                {totalStock} total
              </Tag>
              {lowStockVariants > 0 && (
                <div style={{ fontSize: '10px', color: '#ff4d4f', marginTop: '2px' }}>
                  {lowStockVariants} low stock
                </div>
              )}
            </div>
          )
        } else {
          return (
            <Tag
              color={
                stock === 0 ? 'red' : stock <= (record.lowStockThreshold || 5) ? 'orange' : 'green'
              }
            >
              {stock}
            </Tag>
          )
        }
      },
    },
    {
      title: 'Price (₹)',
      key: 'price',
      width: 120,
      render: (_: unknown, record: Product) => {
        if (record.hasVariants) {
          return <Text type="secondary">Variants</Text>
        }
        const price = record.price || 0
        const comparePrice = record.comparePrice || 0
        const discountPercent = record.discountPercent || 0

        // Calculate effective price
        let effectivePrice: number
        if (comparePrice > 0) {
          // If compare price exists, effective price is the selling price (price)
          effectivePrice = price
        } else if (discountPercent > 0) {
          effectivePrice = Math.max(0, price - (price * discountPercent) / 100)
        } else {
          effectivePrice = price
        }

        return (
          <div>
            <Text
              strong={effectivePrice !== price}
              style={{ color: effectivePrice !== price ? '#B78115' : undefined }}
            >
              ₹{effectivePrice.toFixed(2)}
            </Text>
            {effectivePrice !== price && (
              <div style={{ fontSize: '10px', color: '#999' }}>
                <Text delete>₹{price.toFixed(2)}</Text>
              </div>
            )}
            {comparePrice && comparePrice > price && (
              <div style={{ fontSize: '10px', color: '#999' }}>
                <Text delete>₹{comparePrice.toFixed(2)}</Text>
              </div>
            )}
          </div>
        )
      },
    },
    // Removed product approval column - products don't need admin approval
    {
      title: 'Actions',
      key: 'actions',
      width: 210,
      fixed: 'right' as const,
      render: (_: unknown, record: Product) => (
        <Space>
          <Tooltip title="View product">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/products/${record._id}`)}
            />
          </Tooltip>
          <Tooltip title={!canManageProducts ? 'KYC approval required' : 'Edit product'}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/products/${record._id}/edit`)}
              title="Edit"
              disabled={!canManageProducts}
            />
          </Tooltip>
          <Tooltip
            title={
              !canManageProducts
                ? 'KYC approval required'
                : record.hasVariants
                ? 'Stock managed at variant level'
                : 'Adjust stock'
            }
          >
            <Button
              type="text"
              icon={<ToolOutlined />}
              onClick={() => {
                setAdjustingProduct({ id: record._id, name: record.name, stock: record.stock })
                setDeltaValue(0)
                setAdjustOpen(true)
              }}
              disabled={!canManageProducts || record.hasVariants}
            />
          </Tooltip>
          {/* <Tooltip title={!canManageProducts ? 'KYC approval required' : 'Duplicate product'}>
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={async () => {
                try {
                  await duplicateProductMutation.mutateAsync(record._id)
                  message.success('Product duplicated')
                } catch {
                  message.error('Failed to duplicate product')
                }
              }}
              disabled={!canManageProducts}
            />
          </Tooltip> */}
          <Tooltip title={!canManageProducts ? 'KYC approval required' : 'Delete product'}>
            <Popconfirm
              title="Are you sure you want to delete this product?"
              onConfirm={() => handleDelete(record._id)}
              okText="Yes"
              cancelText="No"
              disabled={!canManageProducts}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteProductMutation.isPending}
                title="Delete"
                disabled={!canManageProducts}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  const rowSelection = canManageProducts
    ? {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
      }
    : undefined

  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Low Stock Alert Banner */}
          {isLowStockView && (
            <Alert
              message="Low Stock Products"
              description={`Showing ${total} product${
                total !== 1 ? 's' : ''
              } with low stock. These products need attention as their inventory is running low.`}
              type="warning"
              icon={<WarningOutlined />}
              showIcon
              closable
              onClose={() => {
                const newParams = new URLSearchParams(searchParams)
                newParams.delete('lowStock')
                navigate(`/products?${newParams.toString()}`)
              }}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* KYC Approval Required Alert */}
          {!canManageProducts && (
            <Alert
              message="Product Management Locked"
              description={
                <div>
                  {!user?.kycSubmitted ? (
                    <>
                      <p>
                        Your KYC is not submitted. Please complete your KYC verification to add and
                        manage products.
                      </p>
                      <Button
                        type="primary"
                        icon={<WarningOutlined />}
                        onClick={() => navigate('/submit-kyc')}
                      >
                        Submit KYC Now
                      </Button>
                    </>
                  ) : (
                    <>
                      <p>
                        Your KYC is under admin review. You can view your products but cannot add,
                        edit, or delete products until your account is approved.
                      </p>
                      <Button type="default" onClick={() => navigate('/profile')}>
                        View KYC Status
                      </Button>
                    </>
                  )}
                </div>
              }
              type="warning"
              showIcon
              icon={<LockOutlined />}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Requirements Alert - Show missing store info and contact info */}
          {canManageProducts && <RequirementsAlert />}

          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Title level={2} style={{ margin: 0 }}>
                Products
              </Title>
              <Text type="secondary">Manage your catalog, inventory and CSV imports/exports.</Text>
            </div>
            <Space wrap>
              <Button
                disabled
                onClick={async () => {
                  try {
                    const blob = await exportCsvMutation.mutateAsync()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'products.csv'
                    a.click()
                    URL.revokeObjectURL(url)
                  } catch {
                    message.error('Failed to export CSV')
                  }
                }}
              >
                Export CSV
              </Button>
              <Button disabled type="default" onClick={() => setImportOpen(true)}>
                Import CSV
              </Button>
              <Tooltip
                title={
                  !canManageProducts
                    ? 'Complete KYC verification to add products'
                    : 'Add new product'
                }
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="large"
                  onClick={() => navigate('/products/new')}
                  disabled={!canManageProducts}
                  data-tour="add-product-btn"
                >
                  Add Product
                </Button>
              </Tooltip>
            </Space>
          </div>

          {/* Sub-tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={(key) => {
              const k = key as 'all' | 'drafts'
              setActiveTab(k)
              // tie into existing status filter
              if (k === 'drafts') {
                setStatusFilter('draft')
              } else {
                setStatusFilter(undefined)
              }
              setPage(1)
            }}
            items={[
              { key: 'all', label: 'All' },
              { key: 'drafts', label: 'Drafts' },
            ]}
          />

          {/* Filters */}
          <Space wrap size="middle">
            <Input
              placeholder="Search products..."
              prefix={<SearchOutlined />}
              style={{ width: 250 }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              allowClear
            />
            <Select
              placeholder="Filter by status"
              style={{ width: 180 }}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value)
                setPage(1)
                // keep tab in sync
                setActiveTab(value === 'draft' ? 'drafts' : 'all')
              }}
              allowClear
            >
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="inactive">Inactive</Select.Option>
              <Select.Option value="draft">Draft</Select.Option>
              <Select.Option value="out_of_stock">Out of Stock</Select.Option>
            </Select>
          </Space>

          {/* Bulk Actions */}
          {selectedRowKeys.length > 0 && canManageProducts && (
            <Space wrap>
              <span>Selected {selectedRowKeys.length} items</span>
              <Button
                size="small"
                onClick={() => handleBulkStatusUpdate('active')}
                disabled={!canManageProducts}
              >
                Set Active
              </Button>
              <Button
                size="small"
                onClick={() => handleBulkStatusUpdate('inactive')}
                disabled={!canManageProducts}
              >
                Set Inactive
              </Button>
              <Button
                size="small"
                onClick={() => handleBulkStatusUpdate('draft')}
                disabled={!canManageProducts}
              >
                Set Draft
              </Button>
              <Popconfirm
                title={`Are you sure you want to delete ${selectedRowKeys.length} products?`}
                onConfirm={handleBulkDelete}
                okText="Yes"
                cancelText="No"
                disabled={!canManageProducts}
              >
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  loading={bulkDeleteMutation.isPending}
                  disabled={!canManageProducts}
                >
                  Delete Selected
                </Button>
              </Popconfirm>
            </Space>
          )}

          {/* Table */}
          <Table
            tableLayout="fixed"
            rowSelection={rowSelection}
            columns={columns}
            dataSource={products}
            rowKey="_id"
            loading={isLoadingProducts}
            scroll={{ x: 'max-content' }}
            rowClassName={(record) => {
              if (isOutOfStock(record)) return 'out-of-stock-row'
              if (isLowStock(record)) return 'low-stock-row'
              return ''
            }}
            pagination={{
              current: page,
              pageSize: limit,
              total: total,
              onChange: (newPage) => setPage(newPage),
              showSizeChanger: false,
              showTotal: (total) =>
                `Total ${total} product${total !== 1 ? 's' : ''}${
                  isLowStockView ? ' with low stock' : ''
                }`,
            }}
          />

          <Modal
            title="Import Products via CSV"
            open={importOpen}
            onCancel={() => setImportOpen(false)}
            onOk={async () => {
              if (!importFile) return message.warning('Select a CSV file')
              try {
                const res = await importCsvMutation.mutateAsync(importFile)
                message.success(`Imported ${res.created}, skipped ${res.skipped}`)
                setImportOpen(false)
                setImportFile(null)
              } catch {
                message.error('Failed to import CSV')
              }
            }}
            okButtonProps={{ loading: importCsvMutation.isPending }}
          >
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Text>Follow these rules for smooth imports:</Text>
                <ul className="list-disc pl-5 mt-2 text-sm text-gray-600">
                  <li>Use UTF-8 CSV with a header row.</li>
                  <li>Images can be URLs; multiple images separated by |</li>
                  <li>Allowed status: draft, active, inactive</li>
                  <li>Unknown columns are ignored; missing required fields cause row skips.</li>
                </ul>
                <div className="mt-3">
                  <Button
                    size="small"
                    onClick={() => {
                      const header = [
                        'name',
                        'description',
                        'price',
                        'comparePrice',
                        'costPrice',
                        'sku',
                        'stock',
                        'lowStockThreshold',
                        'category',
                        'brand',
                        'status',
                        'tags',
                        'mainImage',
                        'images',
                      ]
                      const sample = [
                        'Chair Classic',
                        'A comfy wooden chair',
                        '1499',
                        '1999',
                        '900',
                        'CHAIR-001',
                        '25',
                        '5',
                        'Furniture',
                        'Acme',
                        'active',
                        'chair|wood',
                        'https://example.com/main.jpg',
                        'https://example.com/1.jpg|https://example.com/2.jpg',
                      ]
                      const csv =
                        header.join(',') +
                        '\n' +
                        sample.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'products-sample.csv'
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    Download sample CSV
                  </Button>
                </div>
              </div>

              <Upload.Dragger
                accept=".csv,text/csv"
                multiple={false}
                beforeUpload={(file) => {
                  setImportFile(file)
                  return false
                }}
                onDrop={(e) => {
                  const f = e.dataTransfer.files?.[0]
                  if (f) setImportFile(f)
                }}
                fileList={
                  importFile
                    ? [
                        {
                          uid: '-1',
                          name: importFile.name,
                          status: 'done' as const,
                        },
                      ]
                    : []
                }
                onRemove={() => {
                  setImportFile(null)
                }}
              >
                <p className="ant-upload-drag-icon">📄</p>
                <p className="ant-upload-text">Click or drag CSV file to this area to upload</p>
                <p className="ant-upload-hint">Only .csv files are supported</p>
              </Upload.Dragger>
            </Space>
          </Modal>

          <Modal
            title={adjustingProduct ? `Adjust Stock: ${adjustingProduct.name}` : 'Adjust Stock'}
            open={adjustOpen}
            onCancel={() => setAdjustOpen(false)}
            footer={null}
            destroyOnClose
          >
            {adjustingProduct && (
              <div className="mb-3 text-sm text-gray-600">
                Current stock: <b>{adjustingProduct.stock}</b>
                {typeof deltaValue === 'number' && (
                  <span>
                    {' '}
                    → New stock:{' '}
                    <b>
                      {Math.max(
                        0,
                        adjustingProduct.stock + (Number.isFinite(deltaValue) ? deltaValue : 0),
                      )}
                    </b>
                  </span>
                )}
              </div>
            )}
            <Form
              layout="vertical"
              initialValues={{ delta: 0, reason: '' }}
              onFinish={async (values: { delta: number; reason?: string }) => {
                if (!adjustingProduct) return
                try {
                  await adjustMutation.mutateAsync({
                    id: adjustingProduct.id,
                    delta: values.delta,
                    reason: values.reason,
                  })
                  message.success('Stock adjusted')
                  setAdjustOpen(false)
                } catch {
                  message.error('Failed to adjust stock')
                }
              }}
            >
              <Form.Item
                label="Delta (+/-)"
                name="delta"
                rules={[{ required: true, message: 'Enter change amount' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={-100000}
                  max={100000}
                  onChange={(v) => setDeltaValue(Number(v || 0))}
                />
              </Form.Item>
              <Form.Item label="Reason" name="reason">
                <Input.TextArea rows={3} placeholder="e.g., Stock audit adjustment" />
              </Form.Item>
              <Space>
                <Button onClick={() => setAdjustOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" loading={adjustMutation.isPending}>
                  Save
                </Button>
              </Space>
            </Form>
          </Modal>
        </Space>
      </Card>
    </div>
  )
}

export default ProductList
