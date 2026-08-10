import { DeleteOutlined, EditOutlined, MenuOutlined, PlusOutlined } from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  App,
  Badge,
  Button,
  Card,
  Image,
  Select,
  Space,
  Tag,
  Typography,
  Tooltip,
  Empty,
  Spin,
  Row,
  Col,
} from 'antd'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import {
  useBanners,
  useCreateBanner,
  useDeleteBanner,
  useUpdateBanner,
  useUpdateBannerOrders,
} from '../api/banners'
import AddBannerDrawer from '../components/banners/AddBannerDrawer'
import PermissionButton from '../components/PermissionButton'
import { useModulePermissions } from '../hooks/useModulePermissions'
import type { Banner } from '../types/banner'
import { BANNER_POSITIONS } from '../types/banner'

const { Title, Text } = Typography

// Sortable banner card component
interface SortableBannerCardProps {
  banner: Banner
  onEdit: (banner: Banner) => void
  onDelete: (id: string) => void
  canEdit?: boolean
  canDelete?: boolean
}

const SortableBannerCard = ({ banner, onEdit, onDelete, canEdit = true, canDelete = true }: SortableBannerCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: banner._id!,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="mb-3 hover:shadow-md transition-shadow"
      bodyStyle={{ padding: '16px' }}
    >
      <Row gutter={16} align="middle">
        <Col span={2}>
          <div
            {...attributes}
            {...listeners}
            className="flex items-center justify-center cursor-grab active:cursor-grabbing h-full"
          >
            <MenuOutlined className="text-gray-400 text-lg" />
          </div>
        </Col>
        <Col span={6}>
          <Image
            src={banner.image}
            alt={banner.title}
            width={120}
            height={80}
            className="object-cover rounded-lg border border-gray-200"
            preview={{
              mask: 'Preview',
            }}
          />
        </Col>
        <Col span={8}>
          <div>
            <Title level={5} style={{ margin: 0, marginBottom: 4 }}>
              {banner.title}
            </Title>
            {banner.subtitle && (
              <Text type="secondary" className="text-sm" ellipsis>
                {banner.subtitle}
              </Text>
            )}
          </div>
        </Col>
        <Col span={3}>
          <Tag color={banner.active ? 'green' : 'default'} className="font-medium">
            {banner.active ? 'Active' : 'Inactive'}
          </Tag>
        </Col>
        <Col span={2}>
          <div className="text-center">
            <Badge
              count={banner.order}
              showZero
              style={{
                backgroundColor: '#1890ff',
                fontSize: '12px',
                minWidth: '28px',
                height: '28px',
                lineHeight: '28px',
                borderRadius: '14px',
              }}
            />
          </div>
        </Col>
        <Col span={3}>
          <Space>
            {canEdit && (
              <Tooltip title="Edit Banner">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => onEdit(banner)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                />
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete Banner">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDelete(banner._id!)}
                  className="hover:bg-red-50"
                />
              </Tooltip>
            )}
            {!canEdit && !canDelete && (
              <span className="text-gray-400 text-sm">No actions</span>
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

const BannersPage = () => {
  const { modal } = App.useApp()

  // Permission checks - single hook call for better performance
  const permissions = useModulePermissions('banners')

  const [positionFilter, setPositionFilter] = useState<string>('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)

  // Queries
  const { data: banners, isLoading } = useBanners({
    position: positionFilter,
  })

  // Mutations
  const createBanner = useCreateBanner()
  const updateBanner = useUpdateBanner()
  const deleteBanner = useDeleteBanner()
  const updateBannerOrders = useUpdateBannerOrders()

  // Group banners by position
  const bannersByPosition = useMemo(() => {
    const grouped: Record<string, Banner[]> = {}
    const sortedBanners = [...(banners || [])].sort((a, b) => {
      // First sort by position
      const positionOrder = BANNER_POSITIONS.map((p) => p.value)
      const positionDiff = positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position)
      if (positionDiff !== 0) return positionDiff
      // Then sort by order within position
      return a.order - b.order
    })

    sortedBanners.forEach((banner) => {
      if (!grouped[banner.position]) {
        grouped[banner.position] = []
      }
      grouped[banner.position].push(banner)
    })

    return grouped
  }, [banners])

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Handle drag end for a specific position
  const handleDragEnd = (event: DragEndEvent, position: string) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const positionBanners = bannersByPosition[position] || []
    const oldIndex = positionBanners.findIndex((b) => b._id === active.id)
    const newIndex = positionBanners.findIndex((b) => b._id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const newBanners = arrayMove(positionBanners, oldIndex, newIndex)
    const updatedOrders = newBanners.map((banner, index) => ({
      id: banner._id!,
      order: index,
    }))

    // Update orders in the backend
    updateBannerOrders.mutate(updatedOrders, {
      onSuccess: () => {
        toast.success('Banner order updated successfully!')
      },
      onError: () => {
        toast.error('Failed to update banner order')
      },
    })
  }

  // Add or Update banner
  const handleAddOrUpdate = (formData: FormData, form: { resetFields: () => void }) => {
    if (editingBanner) {
      updateBanner.mutate(
        { id: editingBanner._id!, formData },
        {
          onSuccess: () => {
            toast.success('Banner updated successfully!')
            setDrawerOpen(false)
            form.resetFields()
            setEditingBanner(null)
          },
          onError: () => toast.error('Failed to update banner'),
        },
      )
    } else {
      createBanner.mutate(formData, {
        onSuccess: () => {
          toast.success('Banner created successfully!')
          setDrawerOpen(false)
          form.resetFields()
        },
        onError: () => toast.error('Failed to create banner'),
      })
    }
  }

  // Edit button click
  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner)
    setDrawerOpen(true)
  }

  // Delete banner
  const handleDelete = (id: string) => {
    if (!id) {
      toast.error('Invalid banner ID')
      return
    }

    modal.confirm({
      title: 'Delete Banner',
      content: 'Are you sure you want to delete this banner?',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        deleteBanner.mutate(id, {
          onSuccess: () => toast.success('Banner deleted!'),
          onError: () => toast.error('Failed to delete banner'),
        })
      },
    })
  }

  const getPositionLabel = (position: string) => {
    return BANNER_POSITIONS.find((p) => p.value === position)?.label || position.toUpperCase()
  }

  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = {
      hero: 'blue',
      deals: 'orange',
      fashion: 'pink',
      trending: 'red',
      featured: 'purple',
      newsletter: 'cyan',
    }
    return colors[position] || 'default'
  }

  return (
    <div className="p-6">
      {/* Header Card */}
      <Card className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <Title level={2} style={{ margin: 0 }}>
            Banner Management
          </Title>
          <Space>
            <Select
              placeholder="Filter by position"
              style={{ width: 200 }}
              allowClear
              onChange={(value) => setPositionFilter(value || '')}
              options={BANNER_POSITIONS.map((pos) => ({
                label: pos.label,
                value: pos.value,
              }))}
            />
            <PermissionButton
              module="banners"
              permission="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingBanner(null)
                setDrawerOpen(true)
              }}
              size="large"
            >
              Add Banner
            </PermissionButton>
          </Space>
        </div>
      </Card>

      {/* Position Groups */}
      {BANNER_POSITIONS.map((positionOption) => {
        const positionBanners = bannersByPosition[positionOption.value] || []
        const positionId = positionOption.value

        if (positionFilter && positionFilter !== positionId) return null

        return (
          <Card
            key={positionId}
            className="mb-6"
            title={
              <div className="flex items-center gap-3">
                <Tag color={getPositionColor(positionId)} className="text-base px-3 py-1">
                  {getPositionLabel(positionId)}
                </Tag>
                <Badge
                  count={positionBanners.length}
                  showZero
                  style={{ backgroundColor: '#1890ff' }}
                />
              </div>
            }
            extra={
              <Text type="secondary" className="text-sm">
                {positionBanners.length === 0
                  ? 'No banners'
                  : `${positionBanners.length} banner${positionBanners.length !== 1 ? 's' : ''}`}
              </Text>
            }
          >
            {isLoading ? (
              <div className="text-center py-12">
                <Spin size="large" />
              </div>
            ) : positionBanners.length === 0 ? (
              <Empty
                description={
                  <Text type="secondary">No banners in this position yet. Click "Add Banner" to create one.</Text>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(e, positionId)}
              >
                <SortableContext
                  items={positionBanners.map((b) => b._id!)}
                  strategy={verticalListSortingStrategy}
                >
                  <div>
                    {positionBanners.map((banner) => (
                      <SortableBannerCard
                        key={banner._id}
                        banner={banner}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        canEdit={permissions.canUpdate}
                        canDelete={permissions.canDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </Card>
        )
      })}

      {/* Add/Edit Drawer */}
      <AddBannerDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditingBanner(null)
        }}
        onAdd={handleAddOrUpdate}
        editingBanner={editingBanner}
      />
    </div>
  )
}

export default BannersPage
