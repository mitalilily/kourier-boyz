import type { DrawerProps } from 'antd'
import {
  Alert,
  Button,
  ColorPicker,
  DatePicker,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Switch,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo } from 'react'
import type { Announcement } from '../../api/announcements'
import { useAnnouncements } from '../../api/announcements'

interface AddAnnouncementDrawerProps extends DrawerProps {
  onAdd: (values: Partial<Announcement>) => void
  editingAnnouncement?: Announcement | null
}

const { TextArea } = Input
const { RangePicker } = DatePicker

const AddAnnouncementDrawer: React.FC<AddAnnouncementDrawerProps> = ({
  open,
  onClose,
  onAdd,
  editingAnnouncement,
}) => {
  const [form] = Form.useForm()
  const isEditing = !!editingAnnouncement
  const { data: allAnnouncements = [] } = useAnnouncements({})

  // Watch for date range changes to detect conflicts and future dates
  const dateRange = Form.useWatch('dateRange', form)
  const startDate = dateRange?.[0]

  // Check if start date is in the future
  // Compare using epoch milliseconds to ensure timezone-independent comparison
  const isFutureDate = useMemo(() => {
    if (!startDate) return false
    const now = Date.now()
    // Convert dayjs to UTC ISO string then to milliseconds for accurate comparison
    const startMs = new Date(startDate.toISOString()).getTime()
    return startMs > now
  }, [startDate])

  // Auto-set isActive to false if start date is in the future
  // This runs whenever the date changes or when drawer opens
  useEffect(() => {
    if (isFutureDate) {
      // Force isActive to false when date is in the future
      form.setFieldsValue({ isActive: false })
    }
  }, [isFutureDate, form, open])

  // Find conflicting announcements (same start date/time) - compare by second precision
  const conflictingAnnouncements = useMemo(() => {
    if (!startDate || !open) return []

    // Get the ISO string of the selected date (converts to UTC automatically)
    const selectedStartISO = startDate.toISOString()
    // Round to second precision for comparison
    const selectedStartRounded = new Date(
      Math.floor(new Date(selectedStartISO).getTime() / 1000) * 1000,
    ).toISOString()

    return allAnnouncements.filter((ann) => {
      if (isEditing && ann._id === editingAnnouncement?._id) return false // Exclude current announcement
      if (!ann.startDate) return false

      // Round to second precision for comparison
      const annStartRounded = new Date(
        Math.floor(new Date(ann.startDate).getTime() / 1000) * 1000,
      ).toISOString()

      return annStartRounded === selectedStartRounded
    })
  }, [startDate, allAnnouncements, isEditing, editingAnnouncement?._id, open])

  useEffect(() => {
    if (editingAnnouncement) {
      const editingStartDate = editingAnnouncement.startDate
        ? dayjs(editingAnnouncement.startDate)
        : null
      const editingIsFutureDate = editingStartDate
        ? new Date(editingStartDate.toISOString()).getTime() > Date.now()
        : false

      form.setFieldsValue({
        title: editingAnnouncement.title,
        message: editingAnnouncement.message,
        link: editingAnnouncement.link,
        linkText: editingAnnouncement.linkText || 'Learn More',
        backgroundColor: editingAnnouncement.backgroundColor || '#FFE14B',
        textColor: editingAnnouncement.textColor || '#000000',
        // Force inactive if start date is in the future (will auto-activate)
        isActive: editingIsFutureDate ? false : editingAnnouncement.isActive,
        dismissible: editingAnnouncement.dismissible,
        targetAudience: editingAnnouncement.targetAudience || 'all',
        dateRange:
          editingAnnouncement.startDate || editingAnnouncement.endDate
            ? [
                editingAnnouncement.startDate ? dayjs(editingAnnouncement.startDate) : null,
                editingAnnouncement.endDate ? dayjs(editingAnnouncement.endDate) : null,
              ]
            : null,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        backgroundColor: '#FFE14B',
        textColor: '#000000',
        isActive: false, // Default to inactive - admin must explicitly activate
        dismissible: true,
        targetAudience: 'all',
        linkText: 'Learn More',
      })
    }
  }, [editingAnnouncement, form, open])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      // Validate date range
      if (values.dateRange?.[0] && values.dateRange?.[1]) {
        if (values.dateRange[1].isBefore(values.dateRange[0])) {
          return // Form validation will handle this
        }
      }

      // Determine if start date is in the future (timezone-independent check)
      const hasFutureStartDate =
        values.dateRange?.[0] && new Date(values.dateRange[0].toISOString()).getTime() > Date.now()

      const submitData: Partial<Announcement> = {
        title: values.title,
        message: values.message,
        link: values.link,
        linkText: values.linkText,
        backgroundColor:
          typeof values.backgroundColor === 'string'
            ? values.backgroundColor
            : values.backgroundColor?.toHexString(),
        textColor:
          typeof values.textColor === 'string' ? values.textColor : values.textColor?.toHexString(),
        // Force inactive if start date is in the future (will auto-activate)
        // But allow activation if dates are being removed (no date range)
        isActive: hasFutureStartDate ? false : values.isActive,
        dismissible: values.dismissible,
        targetAudience: values.targetAudience,
        // Convert to ISO string with UTC timezone - preserves exact date and time
        // If dateRange is null/undefined or empty, explicitly set to null to remove dates
        startDate: values.dateRange?.[0] ? values.dateRange[0].toISOString() : null,
        endDate: values.dateRange?.[1] ? values.dateRange[1].toISOString() : null,
      }
      onAdd(submitData)
    } catch (error) {
      console.error('Form validation failed:', error)
    }
  }

  return (
    <Drawer
      title={isEditing ? 'Edit Announcement' : 'Add New Announcement'}
      placement="right"
      size="large"
      onClose={onClose}
      open={open}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit}>
            {isEditing ? 'Update' : 'Create'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" className="space-y-4">
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: 'Please enter a title' }]}
        >
          <Input placeholder="e.g., Flash Sale - 50% Off!" />
        </Form.Item>

        <Form.Item name="message" label="Message (Optional)">
          <TextArea
            rows={3}
            placeholder="Additional message or description"
            showCount
            maxLength={200}
          />
        </Form.Item>

        <Form.Item name="link" label="Link URL (Optional)">
          <Input placeholder="https://example.com/sale" />
        </Form.Item>

        <Form.Item name="linkText" label="Link Text">
          <Input placeholder="Learn More" />
        </Form.Item>

        <Form.Item label="Colors">
          <Space direction="vertical" className="w-full">
            <Form.Item
              name="backgroundColor"
              label="Background Color"
              rules={[{ required: true }]}
              style={{ marginBottom: 0 }}
            >
              <ColorPicker showText format="hex" />
            </Form.Item>
            <Form.Item
              name="textColor"
              label="Text Color"
              rules={[{ required: true }]}
              style={{ marginBottom: 0 }}
            >
              <ColorPicker showText format="hex" />
            </Form.Item>
          </Space>
        </Form.Item>

        <Form.Item label="Preview" className="mt-4">
          <div
            className="px-4 py-3 rounded-lg text-center"
            style={{
              backgroundColor: form.getFieldValue('backgroundColor') || '#FFE14B',
              color: form.getFieldValue('textColor') || '#000000',
            }}
          >
            <div className="font-semibold">{form.getFieldValue('title') || 'Title'}</div>
            {form.getFieldValue('message') && (
              <div className="text-sm mt-1">{form.getFieldValue('message')}</div>
            )}
            {form.getFieldValue('link') && (
              <div className="text-sm underline mt-2">
                {form.getFieldValue('linkText') || 'Learn More'} →
              </div>
            )}
          </div>
        </Form.Item>

        <Form.Item name="targetAudience" label="Target Audience" rules={[{ required: true }]}>
          <Select>
            <Select.Option value="all">All Users</Select.Option>
            <Select.Option value="authenticated">Authenticated Users Only</Select.Option>
            <Select.Option value="guest">Guest Users Only</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="dateRange"
          label="Active Date Range (Optional)"
          rules={[
            {
              validator: (_, value) => {
                if (!value || !value[0] || !value[1]) {
                  return Promise.resolve()
                }
                if (value[1].isBefore(value[0])) {
                  return Promise.reject(new Error('End date must be after start date'))
                }
                // Check if end date is same as start date (must have different times)
                if (value[1].isSame(value[0], 'day') && value[1].isSame(value[0], 'minute')) {
                  return Promise.reject(new Error('End time must be different from start time'))
                }
                return Promise.resolve()
              },
            },
          ]}
          tooltip="Set the exact date and time when this announcement should start and end. Time is displayed in your local timezone and will be converted to UTC for storage."
        >
          <RangePicker
            className="w-full"
            showTime={{
              format: 'HH:mm:ss',
              defaultValue: [dayjs().startOf('day'), dayjs().endOf('day')],
            }}
            format="YYYY-MM-DD HH:mm:ss"
            placeholder={['Start date & time', 'End date & time']}
            needConfirm={false}
            // Important: Keep dates in local timezone when selecting, convert to UTC when saving
            // dayjs handles this automatically when using toISOString()
          />
        </Form.Item>

        {/* Conflict Warning */}
        {conflictingAnnouncements.length > 0 && startDate && (
          <Alert
            message="Schedule Conflict Detected"
            description={
              <div className="mt-2">
                <p className="mb-2">
                  <strong>{conflictingAnnouncements.length}</strong> other announcement(s) are
                  scheduled to start at the same date/time:
                </p>
                <ul className="list-disc list-inside mb-3 space-y-1">
                  {conflictingAnnouncements.map((ann) => (
                    <li key={ann._id} className="text-sm">
                      <strong>"{ann.title}"</strong>
                      {ann.endDate &&
                        ` (ends ${dayjs(ann.endDate).format('MMM DD, YYYY HH:mm:ss')})`}
                    </li>
                  ))}
                </ul>
                <div className="bg-blue-50 p-3 rounded-lg mb-3">
                  <p className="text-sm font-semibold mb-2 text-blue-900">
                    ⚠️ What happens at the scheduled time?
                  </p>
                  <p className="text-sm text-blue-800 mb-2">
                    Since multiple announcements share the same start date/time,{' '}
                    <strong>only one will be automatically activated</strong> - the one that was{' '}
                    <strong>created first</strong>.
                  </p>
                  <p className="text-sm text-blue-800">
                    The other announcement(s) will remain <strong>inactive</strong> until the active
                    one expires or is manually deactivated.
                  </p>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  💡 <strong>Tip:</strong> Schedule announcements at different times (even just a
                  few seconds apart) to avoid conflicts and ensure both can activate.
                </p>
              </div>
            }
            type="warning"
            showIcon
            className="mb-4"
          />
        )}

        <Form.Item name="dismissible" valuePropName="checked" label="Dismissible">
          <Switch />
          <div className="text-xs text-gray-500 mt-1">Allow users to dismiss this announcement</div>
        </Form.Item>

        <Form.Item
          name="isActive"
          valuePropName="checked"
          label="Status"
          tooltip={
            isFutureDate
              ? 'Announcements with future start dates will be automatically activated at the scheduled time. You cannot manually activate them.'
              : 'Only one announcement can be active at a time. Activating this will deactivate all others.'
          }
          dependencies={['dateRange']}
        >
          <Switch checkedChildren="Active" unCheckedChildren="Inactive" disabled={isFutureDate} />
        </Form.Item>

        {/* Future date auto-activation message */}
        {isFutureDate && (
          <Alert
            message="Scheduled Announcement"
            description={
              <div className="mt-1">
                <p className="mb-2">
                  This announcement has a <strong>future start date</strong> and will be{' '}
                  <strong>automatically activated</strong> when the scheduled time arrives.
                </p>
                <p className="text-sm mb-1">
                  <strong>Start:</strong> {startDate?.format('MMM DD, YYYY HH:mm:ss')}
                </p>
                {dateRange?.[1] && (
                  <p className="text-sm mb-2">
                    <strong>End:</strong> {dateRange[1].format('MMM DD, YYYY HH:mm:ss')}
                  </p>
                )}
                <p className="text-xs text-gray-600">
                  💡 This announcement will be <strong>automatically activated</strong> at the exact
                  scheduled time. No manual intervention needed!
                </p>
              </div>
            }
            type="info"
            showIcon
            className="mb-4"
          />
        )}

        {/* Manual activation warning (only show if not future date) */}
        {!isFutureDate && form.getFieldValue('isActive') && (
          <Alert
            message="Activation Notice"
            description="Activating this announcement will automatically deactivate all other active announcements."
            type="warning"
            showIcon
            className="mb-4"
          />
        )}
      </Form>
    </Drawer>
  )
}

export default AddAnnouncementDrawer
