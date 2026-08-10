import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
  type Announcement,
} from '../api/announcements'
import AddAnnouncementDrawer from '../components/announcements/AddAnnouncementDrawer'
import PermissionButton from '../components/PermissionButton'
import { useModulePermissions } from '../hooks/useModulePermissions'

const { Title } = Typography

const AnnouncementsPage = () => {
  const { modal } = App.useApp()
  const permissions = useModulePermissions('announcements')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: announcements, isLoading } = useAnnouncements({
    isActive: statusFilter ? statusFilter === 'active' : undefined,
  })

  const createAnnouncement = useCreateAnnouncement()
  const updateAnnouncement = useUpdateAnnouncement()
  const deleteAnnouncement = useDeleteAnnouncement()

  const filteredAnnouncements = announcements || []

  const handleToggleStatus = (announcement: Announcement) => {
    const willActivate = !announcement.isActive

    if (willActivate) {
      modal.confirm({
        title: 'Activate Announcement',
        content:
          'Activating this announcement will automatically deactivate all other active announcements. Do you want to continue?',
        okText: 'Activate',
        okType: 'primary',
        cancelText: 'Cancel',
        onOk: () => {
          updateAnnouncement.mutate(
            {
              id: announcement._id,
              data: { isActive: true },
            },
            {
              onSuccess: () => {
                toast.success('Announcement activated! Other announcements have been deactivated.')
              },
              onError: () => toast.error('Failed to activate announcement'),
            },
          )
        },
      })
    } else {
      updateAnnouncement.mutate(
        {
          id: announcement._id,
          data: { isActive: false },
        },
        {
          onSuccess: () => {
            toast.success('Announcement deactivated successfully!')
          },
          onError: () => toast.error('Failed to deactivate announcement'),
        },
      )
    }
  }

  const handleDelete = (id: string) => {
    modal.confirm({
      title: 'Delete Announcement',
      content: 'Are you sure you want to delete this announcement?',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        deleteAnnouncement.mutate(id, {
          onSuccess: () => toast.success('Announcement deleted!'),
          onError: () => toast.error('Failed to delete announcement'),
        })
      },
    })
  }

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setDrawerOpen(true)
  }

  const handleAddOrUpdate = (values: Partial<Announcement>) => {
    if (editingAnnouncement) {
      updateAnnouncement.mutate(
        { id: editingAnnouncement._id, data: values },
        {
          onSuccess: () => {
            toast.success('Announcement updated successfully!')
            setDrawerOpen(false)
            setEditingAnnouncement(null)
          },
          onError: () => toast.error('Failed to update announcement'),
        },
      )
    } else {
      createAnnouncement.mutate(values, {
        onSuccess: () => {
          toast.success('Announcement created successfully!')
          setDrawerOpen(false)
        },
        onError: () => toast.error('Failed to create announcement'),
      })
    }
  }

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (title: string, record: Announcement) => (
        <div>
          <div className="font-medium">{title}</div>
          {record.message && (
            <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">{record.message}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: unknown, record: Announcement) => (
        <Space>
          <Tag color={record.isActive ? 'green' : 'default'}>
            {record.isActive ? 'Active' : 'Inactive'}
          </Tag>
          <Switch
            checked={record.isActive}
            onChange={() => handleToggleStatus(record)}
            disabled={!permissions.canUpdate}
            size="small"
          />
        </Space>
      ),
    },
    {
      title: 'Date Status',
      key: 'dateStatus',
      width: 140,
      render: (_: unknown, record: Announcement) => {
        // Use valueOf() for timezone-independent comparison (milliseconds since epoch)
        const nowMs = Date.now()
        const startMs = record.startDate ? new Date(record.startDate).getTime() : null
        const endMs = record.endDate ? new Date(record.endDate).getTime() : null

        // Format dates for display (dayjs handles ISO strings correctly)
        const start = record.startDate ? dayjs(record.startDate) : null
        const end = record.endDate ? dayjs(record.endDate) : null

        if (!start && !end) {
          return <Tag color="blue">Always Active</Tag>
        }

        // Compare using epoch milliseconds (timezone-independent)
        if (startMs && nowMs < startMs && start) {
          return (
            <Tooltip title={`Starts: ${start.format('MMM DD, YYYY HH:mm:ss')} (Your local time)`}>
              <Tag color="orange">Upcoming</Tag>
            </Tooltip>
          )
        }

        if (endMs && nowMs > endMs && end) {
          return (
            <Tooltip title={`Ended: ${end.format('MMM DD, YYYY HH:mm:ss')} (Your local time)`}>
              <Tag color="red">Expired</Tag>
            </Tooltip>
          )
        }

        return (
          <Tooltip
            title={`Active until: ${
              end ? end.format('MMM DD, YYYY HH:mm:ss') + ' (Your local time)' : 'No end date'
            }`}
          >
            <Tag color="green">Active Now</Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Target',
      dataIndex: 'targetAudience',
      key: 'targetAudience',
      width: 120,
      render: (target: string) => {
        const colors: Record<string, string> = {
          all: 'blue',
          authenticated: 'green',
          guest: 'orange',
        }
        return (
          <Tag color={colors[target] || 'default'}>
            {target?.charAt(0).toUpperCase() + target?.slice(1)}
          </Tag>
        )
      },
    },
    {
      title: 'Date Range',
      key: 'dates',
      width: 200,
      render: (_: unknown, record: Announcement) => {
        if (!record.startDate && !record.endDate)
          return <span className="text-gray-400">Always</span>
        return (
          <div className="text-xs space-y-1">
            {record.startDate && (
              <div>
                <strong>Start:</strong>{' '}
                <Tooltip title={dayjs(record.startDate).format('YYYY-MM-DD HH:mm:ss')}>
                  <span className="cursor-help">
                    {dayjs(record.startDate).format('MMM DD, YYYY HH:mm')}
                  </span>
                </Tooltip>
              </div>
            )}
            {record.endDate && (
              <div>
                <strong>End:</strong>{' '}
                <Tooltip title={dayjs(record.endDate).format('YYYY-MM-DD HH:mm:ss')}>
                  <span className="cursor-help">
                    {dayjs(record.endDate).format('MMM DD, YYYY HH:mm')}
                  </span>
                </Tooltip>
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Preview',
      key: 'preview',
      width: 150,
      render: (_: unknown, record: Announcement) => (
        <div
          className="px-3 py-1.5 rounded text-xs font-medium text-center"
          style={{
            backgroundColor: record.backgroundColor || '#FFE14B',
            color: record.textColor || '#000000',
          }}
        >
          {record.title}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: Announcement) => (
        <Space>
          {permissions.canUpdate && (
            <Tooltip title="Edit">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              />
            </Tooltip>
          )}
          {permissions.canDelete && (
            <Tooltip title="Delete">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record._id)}
                className="hover:bg-red-50"
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="p-6">
      <Card className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <Title level={2} style={{ margin: 0 }}>
            Announcements Management
          </Title>
          <Space>
            <Select
              placeholder="All Announcements"
              style={{ width: 180 }}
              value={statusFilter || 'all'}
              onChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
              options={[
                { label: 'All Announcements', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
              ]}
            />
            <PermissionButton
              module="announcements"
              permission="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingAnnouncement(null)
                setDrawerOpen(true)
              }}
              size="large"
            >
              Add Announcement
            </PermissionButton>
          </Space>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredAnnouncements}
          rowKey="_id"
          loading={isLoading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} announcements`,
          }}
        />
      </Card>

      <AddAnnouncementDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditingAnnouncement(null)
        }}
        onAdd={handleAddOrUpdate}
        editingAnnouncement={editingAnnouncement}
      />
    </div>
  )
}

export default AnnouncementsPage
