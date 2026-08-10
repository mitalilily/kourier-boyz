import {
  Alert,
  Button,
  ColorPicker,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
} from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useAnnouncements } from '../../api/announcements'
import { useCategories } from '../../api/category'
import { useAdminProducts } from '../../api/products'
import type { Coupon } from '../../api/coupons'

interface AddCouponDrawerProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Coupon>) => void
  coupon?: Coupon | null
  loading?: boolean
}

const AddCouponDrawer = ({
  open,
  onClose,
  onSave,
  coupon,
  loading,
}: AddCouponDrawerProps) => {
  const [form] = Form.useForm()
  const [applicableTo, setApplicableTo] = useState<'all' | 'categories' | 'products'>('all')
  const [createAnnouncement, setCreateAnnouncement] = useState(false)
  const [useCustomAnnouncementDates, setUseCustomAnnouncementDates] = useState(false)
  const validFrom = Form.useWatch('validFrom', form)
  const validTo = Form.useWatch('validTo', form)
  const announcementStartDate = Form.useWatch('announcementStartDate', form)
  const announcementEndDate = Form.useWatch('announcementEndDate', form)

  // Fetch all announcements to check for conflicts
  const { data: allAnnouncementsData = [] } = useAnnouncements({})
  const allAnnouncements = Array.isArray(allAnnouncementsData) ? allAnnouncementsData : []

  // Determine which dates to use for announcement (custom or coupon dates)
  const announcementFromDate = useMemo(() => {
    if (!createAnnouncement) return null
    return useCustomAnnouncementDates && announcementStartDate
      ? announcementStartDate
      : validFrom
  }, [createAnnouncement, useCustomAnnouncementDates, announcementStartDate, validFrom])

  const announcementToDate = useMemo(() => {
    if (!createAnnouncement) return null
    return useCustomAnnouncementDates && announcementEndDate
      ? announcementEndDate
      : validTo
  }, [createAnnouncement, useCustomAnnouncementDates, announcementEndDate, validTo])

  // Check if start date is in the future (for announcement auto-activation)
  const isFutureDate = useMemo(() => {
    if (!announcementFromDate || !createAnnouncement) return false
    const now = Date.now()
    const startMs = new Date(announcementFromDate.toISOString()).getTime()
    return startMs > now
  }, [announcementFromDate, createAnnouncement])

  // Find conflicting announcements (same start date/time) - compare by second precision
  const conflictingAnnouncements = useMemo(() => {
    if (!announcementFromDate || !createAnnouncement || !form) return []

    // Exclude the current coupon's linked announcement if editing
    const currentLinkedAnnouncementId = coupon?.linkedAnnouncement
      ? typeof coupon.linkedAnnouncement === 'string'
        ? coupon.linkedAnnouncement
        : (coupon.linkedAnnouncement as any)?._id
      : null

    // Get the ISO string of the selected date (converts to UTC automatically)
    const selectedStartISO = announcementFromDate.toISOString()
    // Round to second precision for comparison
    const selectedStartRounded = new Date(
      Math.floor(new Date(selectedStartISO).getTime() / 1000) * 1000,
    ).toISOString()

    return allAnnouncements.filter((ann: any) => {
      // Exclude current coupon's linked announcement
      if (currentLinkedAnnouncementId && ann._id === currentLinkedAnnouncementId) return false
      if (!ann.startDate) return false

      // Round to second precision for comparison
      const annStartRounded = new Date(
        Math.floor(new Date(ann.startDate).getTime() / 1000) * 1000,
      ).toISOString()

      return annStartRounded === selectedStartRounded
    })
  }, [announcementFromDate, allAnnouncements, createAnnouncement, coupon, form])

  // Fetch categories and products for selection
  const { data: categoriesData } = useCategories({ includeSubcategories: true })
  const categories = categoriesData?.categories || []

  const { data: productsData } = useAdminProducts({ page: 1, limit: 1000 })
  const products = productsData?.products || []

  // Pre-fill form in edit mode
  useEffect(() => {
    if (coupon) {
      const validFrom = dayjs(coupon.validFrom)
      const validTo = dayjs(coupon.validTo)

      form.setFieldsValue({
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minPurchaseAmount: coupon.minPurchaseAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        usageLimit: coupon.usageLimit,
        perUserLimit: coupon.perUserLimit,
        validFrom,
        validTo,
        status: coupon.status || 'active',
        applicableTo: coupon.applicableTo || 'all',
        applicableCategories: coupon.applicableCategories?.map((c: any) =>
          typeof c === 'string' ? c : c._id,
        ),
        applicableProducts: coupon.applicableProducts?.map((p: any) =>
          typeof p === 'string' ? p : p._id,
        ),
        firstTimeUserOnly: coupon.firstTimeUserOnly || false,
        description: coupon.description,
        termsAndConditions: Array.isArray((coupon as any).termsAndConditions) 
          ? (coupon as any).termsAndConditions 
          : (coupon as any).termsAndConditions 
            ? [(coupon as any).termsAndConditions] // Convert old string format to array
            : [],
        // Announcement fields
        createAnnouncement: !!coupon.linkedAnnouncement,
        announcementTitle: (coupon.linkedAnnouncement as any)?.title || '',
        announcementMessage: (coupon.linkedAnnouncement as any)?.message || '',
        announcementLink: (coupon.linkedAnnouncement as any)?.link || '',
        announcementLinkText: (coupon.linkedAnnouncement as any)?.linkText || 'Use Now',
        announcementBackgroundColor: (coupon.linkedAnnouncement as any)?.backgroundColor || '#FFE14B',
        announcementTextColor: (coupon.linkedAnnouncement as any)?.textColor || '#000000',
        announcementDismissible: (coupon.linkedAnnouncement as any)?.dismissible ?? true,
        announcementTargetAudience: (coupon.linkedAnnouncement as any)?.targetAudience || 'all',
        updateExistingAnnouncement: !!coupon.linkedAnnouncement,
        // Announcement dates - use custom if different from coupon dates, otherwise use coupon dates
        useCustomAnnouncementDates: (() => {
          const linkedAnn = coupon.linkedAnnouncement as any
          if (!linkedAnn?.startDate) return false
          const annStartTime = new Date(linkedAnn.startDate).getTime()
          const annEndTime = new Date(linkedAnn.endDate || linkedAnn.startDate).getTime()
          const couponStartTime = new Date(coupon.validFrom).getTime()
          const couponEndTime = new Date(coupon.validTo).getTime()
          return annStartTime !== couponStartTime || annEndTime !== couponEndTime
        })(),
        announcementStartDate: (coupon.linkedAnnouncement as any)?.startDate
          ? dayjs((coupon.linkedAnnouncement as any).startDate)
          : validFrom,
        announcementEndDate: (coupon.linkedAnnouncement as any)?.endDate
          ? dayjs((coupon.linkedAnnouncement as any).endDate)
          : validTo,
      })

      setApplicableTo(coupon.applicableTo || 'all')
      setCreateAnnouncement(!!coupon.linkedAnnouncement)
      setUseCustomAnnouncementDates(
        (() => {
          const linkedAnn = coupon.linkedAnnouncement as any
          if (!linkedAnn?.startDate) return false
          const annStartTime = new Date(linkedAnn.startDate).getTime()
          const annEndTime = new Date(linkedAnn.endDate || linkedAnn.startDate).getTime()
          const couponStartTime = new Date(coupon.validFrom).getTime()
          const couponEndTime = new Date(coupon.validTo).getTime()
          return annStartTime !== couponStartTime || annEndTime !== couponEndTime
        })(),
      )

      // Check if announcement start date is in future and force inactive
      const editingAnnouncement = coupon.linkedAnnouncement as any
      if (editingAnnouncement?.startDate) {
        const editingStartDate = dayjs(editingAnnouncement.startDate)
        const editingIsFutureDate = new Date(editingStartDate.toISOString()).getTime() > Date.now()
        if (editingIsFutureDate) {
          // Don't set isActive for announcements - it's handled separately
        }
      }
    } else {
      form.resetFields()
      setApplicableTo('all')
      // Set default dates
      form.setFieldsValue({
        validFrom: dayjs(),
        validTo: dayjs().add(30, 'day'),
        status: 'active',
        applicableTo: 'all',
        firstTimeUserOnly: false,
        createAnnouncement: false,
        announcementDismissible: true,
        announcementTargetAudience: 'all',
        announcementBackgroundColor: '#FFE14B',
        announcementTextColor: '#000000',
        announcementLinkText: 'Use Now',
        useCustomAnnouncementDates: false,
      })
      setCreateAnnouncement(false)
      setUseCustomAnnouncementDates(false)
    }
  }, [coupon, form, open])

  // Sync announcement dates with coupon dates when not using custom dates
  useEffect(() => {
    if (createAnnouncement && !useCustomAnnouncementDates && validFrom && validTo) {
      form.setFieldsValue({
        announcementStartDate: validFrom,
        announcementEndDate: validTo,
      })
    }
  }, [validFrom, validTo, createAnnouncement, useCustomAnnouncementDates, form])

  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        // Client-side validation: Check for announcement conflicts before submitting
        if (values.createAnnouncement && conflictingAnnouncements.length > 0) {
          const fieldName = values.useCustomAnnouncementDates
            ? 'announcementStartDate'
            : 'validFrom'
          form.setFields([
            {
              name: fieldName,
              errors: [
                `Schedule conflict: ${conflictingAnnouncements.length} other announcement(s) are scheduled at this time. Please choose a different start time.`,
              ],
            },
          ])
          return
        }

        // Client-side validation: Ensure end date is after start date for announcement
        if (values.createAnnouncement) {
          const annStartDate = values.useCustomAnnouncementDates
            ? values.announcementStartDate
            : values.validFrom
          const annEndDate = values.useCustomAnnouncementDates
            ? values.announcementEndDate
            : values.validTo

          if (annStartDate && annEndDate) {
            if (annEndDate.isBefore(annStartDate) || annEndDate.isSame(annStartDate)) {
              const fieldName = values.useCustomAnnouncementDates
                ? 'announcementEndDate'
                : 'validTo'
              form.setFields([
                {
                  name: fieldName,
                  errors: ['End date/time must be after start date/time'],
                },
              ])
              return
            }
          }
        }

        const data: Partial<Coupon> & {
          createAnnouncement?: boolean
          announcementTitle?: string
          announcementMessage?: string
          announcementLink?: string
          announcementLinkText?: string
          announcementBackgroundColor?: string
          announcementTextColor?: string
          announcementDismissible?: boolean
          announcementTargetAudience?: string
          updateExistingAnnouncement?: boolean
        } = {
          code: values.code,
          type: values.type,
          value: values.value,
          minPurchaseAmount: values.minPurchaseAmount,
          maxDiscountAmount: values.maxDiscountAmount,
          usageLimit: values.usageLimit,
          perUserLimit: values.perUserLimit,
          validFrom: values.validFrom.toISOString(),
          validTo: values.validTo.toISOString(),
          status: values.status,
          applicableTo: values.applicableTo,
          applicableCategories:
            values.applicableTo === 'categories' ? values.applicableCategories : undefined,
          applicableProducts:
            values.applicableTo === 'products' ? values.applicableProducts : undefined,
          firstTimeUserOnly: values.firstTimeUserOnly || false,
          description: values.description,
          ...(values.termsAndConditions && values.termsAndConditions.length > 0
            ? { termsAndConditions: values.termsAndConditions.filter((term: string) => term && term.trim()) }
            : {}),
        }

        // Add announcement fields if createAnnouncement is checked
        if (values.createAnnouncement) {
          data.createAnnouncement = true
          data.announcementTitle = values.announcementTitle
          data.announcementMessage = values.announcementMessage
          data.announcementLink = values.announcementLink
          data.announcementLinkText = values.announcementLinkText || 'Use Now'
          data.announcementBackgroundColor =
            typeof values.announcementBackgroundColor === 'string'
              ? values.announcementBackgroundColor
              : values.announcementBackgroundColor?.toHexString()
          data.announcementTextColor =
            typeof values.announcementTextColor === 'string'
              ? values.announcementTextColor
              : values.announcementTextColor?.toHexString()
          data.announcementDismissible = values.announcementDismissible !== false
          data.announcementTargetAudience = values.announcementTargetAudience || 'all'
          // Use custom dates if specified, otherwise use coupon dates
          if (values.useCustomAnnouncementDates && values.announcementStartDate && values.announcementEndDate) {
            (data as any).announcementStartDate = values.announcementStartDate.toISOString()
            (data as any).announcementEndDate = values.announcementEndDate.toISOString()
          }
          if (coupon?.linkedAnnouncement) {
            data.updateExistingAnnouncement = true
          }
        } else if (coupon?.linkedAnnouncement) {
          // If unchecking and coupon has linked announcement, mark for deletion
          data.createAnnouncement = false
          data.updateExistingAnnouncement = false
        }

        onSave(data)
      })
      .catch((error) => {
        console.error('Validation failed:', error)
      })
  }

  return (
    <Drawer
      title={coupon ? 'Edit Coupon' : 'Add New Coupon'}
      open={open}
      onClose={onClose}
      width={600}
      footer={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            {coupon ? 'Update' : 'Create'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" className="space-y-4">
        <Form.Item
          label="Coupon Code"
          name="code"
          rules={[
            { required: true, message: 'Please enter coupon code' },
            {
              pattern: /^[A-Z0-9]+$/,
              message: 'Code must contain only uppercase letters and numbers',
            },
            { min: 3, message: 'Code must be at least 3 characters' },
            { max: 20, message: 'Code must be at most 20 characters' },
          ]}
        >
          <Input placeholder="e.g., SAVE20" className="uppercase" />
        </Form.Item>

        <Form.Item
          label="Description"
          name="description"
          rules={[{ max: 500, message: 'Description must be at most 500 characters' }]}
        >
          <Input.TextArea rows={3} placeholder="Optional description" />
        </Form.Item>

        <Form.Item
          label="Terms & Conditions"
          tooltip="Optional terms and conditions for this coupon. Will be displayed as a list in the coupon details modal."
        >
          <Form.List name="termsAndConditions">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name]}
                      rules={[
                        { required: true, message: 'Please enter a term or condition' },
                        { max: 500, message: 'Each term must be at most 500 characters' },
                      ]}
                      style={{ marginBottom: 0, flex: 1 }}
                    >
                      <Input placeholder="Enter a term or condition" />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Term or Condition
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Form.Item
          label="Discount Type"
          name="type"
          rules={[{ required: true, message: 'Please select discount type' }]}
        >
          <Radio.Group>
            <Radio value="percentage">Percentage (%)</Radio>
            <Radio value="fixed">Fixed Amount (₹)</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label={form.getFieldValue('type') === 'percentage' ? 'Discount Percentage' : 'Discount Amount'}
          name="value"
          rules={[
            { required: true, message: 'Please enter discount value' },
            {
              validator: (_, value) => {
                const type = form.getFieldValue('type')
                if (type === 'percentage') {
                  if (!value || value <= 0 || value > 100) {
                    return Promise.reject(new Error('Percentage must be between 1 and 100'))
                  }
                } else {
                  if (!value || value <= 0) {
                    return Promise.reject(new Error('Amount must be greater than 0'))
                  }
                }
                return Promise.resolve()
              },
            },
          ]}
        >
          <InputNumber
            min={0}
            max={form.getFieldValue('type') === 'percentage' ? 100 : undefined}
            style={{ width: '100%' }}
            prefix={form.getFieldValue('type') === 'percentage' ? '%' : '₹'}
            placeholder={form.getFieldValue('type') === 'percentage' ? 'e.g., 20' : 'e.g., 100'}
          />
        </Form.Item>

        {form.getFieldValue('type') === 'percentage' && (
          <Form.Item
            label="Maximum Discount Amount (₹)"
            name="maxDiscountAmount"
            tooltip="Optional: Limit the maximum discount amount for percentage coupons"
          >
            <InputNumber min={0} style={{ width: '100%' }} prefix="₹" placeholder="e.g., 500" />
          </Form.Item>
        )}

        <Form.Item
          label="Minimum Purchase Amount (₹)"
          name="minPurchaseAmount"
          tooltip="Optional: Minimum order amount required to use this coupon"
        >
          <InputNumber min={0} style={{ width: '100%' }} prefix="₹" placeholder="e.g., 1000" />
        </Form.Item>

        <Form.Item
          label="Valid Period"
          required
          tooltip="Select the start and end date for the coupon validity"
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="validFrom"
              rules={[{ required: true, message: 'Please select start date' }]}
              style={{ margin: 0, width: '50%' }}
            >
              <DatePicker
                style={{ width: '100%' }}
                placeholder="Start Date"
                showTime
                format="YYYY-MM-DD HH:mm"
              />
            </Form.Item>
            <Form.Item
              name="validTo"
              rules={[
                { required: true, message: 'Please select end date' },
                {
                  validator: (_, value) => {
                    const validFrom = form.getFieldValue('validFrom')
                    if (validFrom && value && value.isBefore(validFrom)) {
                      return Promise.reject(new Error('End date must be after start date'))
                    }
                    return Promise.resolve()
                  },
                },
              ]}
              style={{ margin: 0, width: '50%' }}
            >
              <DatePicker
                style={{ width: '100%' }}
                placeholder="End Date"
                showTime
                format="YYYY-MM-DD HH:mm"
              />
            </Form.Item>
          </Space.Compact>
        </Form.Item>

        <Form.Item
          label="Usage Limit"
          name="usageLimit"
          tooltip="Total number of times this coupon can be used. Leave empty for unlimited."
        >
          <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g., 100 (leave empty for unlimited)" />
        </Form.Item>

        <Form.Item
          label="Per User Limit"
          name="perUserLimit"
          tooltip="How many times a single user can use this coupon. Leave empty for unlimited."
        >
          <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g., 1 (leave empty for unlimited)" />
        </Form.Item>

        <Form.Item
          label="Applicable To"
          name="applicableTo"
          rules={[{ required: true, message: 'Please select applicable scope' }]}
        >
          <Radio.Group
            onChange={(e) => {
              setApplicableTo(e.target.value)
              form.setFieldsValue({
                applicableCategories: undefined,
                applicableProducts: undefined,
              })
            }}
          >
            <Radio value="all">All Products</Radio>
            <Radio value="categories">Specific Categories</Radio>
            <Radio value="products">Specific Products</Radio>
          </Radio.Group>
        </Form.Item>

        {applicableTo === 'categories' && (
          <Form.Item
            label="Select Categories"
            name="applicableCategories"
            rules={[
              {
                required: true,
                message: 'Please select at least one category',
                type: 'array',
                min: 1,
              },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="Select categories"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={categories.map((cat) => ({
                label: cat.name,
                value: cat._id,
              }))}
            />
          </Form.Item>
        )}

        {applicableTo === 'products' && (
          <Form.Item
            label="Select Products"
            name="applicableProducts"
            rules={[
              {
                required: true,
                message: 'Please select at least one product',
                type: 'array',
                min: 1,
              },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="Select products"
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={products.map((prod: { _id: string; name: string }) => ({
                label: prod.name,
                value: prod._id,
              }))}
            />
          </Form.Item>
        )}

        <Form.Item label="Status" name="status" rules={[{ required: true }]}>
          <Select>
            <Select.Option value="active">Active</Select.Option>
            <Select.Option value="inactive">Inactive</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="First Time Users Only"
          name="firstTimeUserOnly"
          valuePropName="checked"
          tooltip="If enabled, only first-time customers can use this coupon"
        >
          <Switch />
        </Form.Item>

        {/* Announcement Section */}
        <div className="border-t pt-4 mt-4">
          <Form.Item
            name="createAnnouncement"
            valuePropName="checked"
            label="Create Announcement for this Coupon?"
            tooltip="Create a promotional banner announcement that will be displayed to users. The announcement will automatically use the coupon's validity dates."
          >
            <Switch
              onChange={(checked) => {
                setCreateAnnouncement(checked)
                if (!checked && coupon?.linkedAnnouncement) {
                  // Show warning if unchecking with existing announcement
                  form.setFieldValue('updateExistingAnnouncement', false)
                }
              }}
            />
          </Form.Item>

          {createAnnouncement && (
            <>
              <Alert
                message="Announcement Settings"
                description={
                  <div className="mt-2">
                    <p className="mb-2 text-sm">
                      By default, the announcement will use the coupon's <strong>Valid Period</strong> dates.
                      You can customize the announcement dates below if needed.
                    </p>
                    {announcementFromDate && announcementToDate && (
                      <p className="text-xs text-gray-600">
                        Announcement will be active from{' '}
                        <strong>{announcementFromDate.format('MMM DD, YYYY HH:mm:ss')}</strong> to{' '}
                        <strong>{announcementToDate.format('MMM DD, YYYY HH:mm:ss')}</strong>
                      </p>
                    )}
                  </div>
                }
                type="info"
                showIcon
                className="mb-4"
              />

              <Form.Item
                name="useCustomAnnouncementDates"
                valuePropName="checked"
                label="Use Custom Announcement Dates?"
                tooltip="Enable this to set different start/end dates for the announcement than the coupon's validity period"
              >
                <Switch
                  onChange={(checked) => {
                    setUseCustomAnnouncementDates(checked)
                    if (!checked) {
                      // Reset to coupon dates
                      form.setFieldsValue({
                        announcementStartDate: validFrom,
                        announcementEndDate: validTo,
                      })
                    }
                  }}
                />
              </Form.Item>

              {useCustomAnnouncementDates && (
                <Form.Item
                  label="Announcement Active Period"
                  required
                  tooltip="Set custom start and end dates for the announcement (independent of coupon validity)"
                >
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item
                      name="announcementStartDate"
                      rules={[
                        { required: true, message: 'Please select announcement start date' },
                        {
                          validator: (_, value) => {
                            if (!value) return Promise.resolve()
                            const annEndDate = form.getFieldValue('announcementEndDate')
                            if (annEndDate && annEndDate.isBefore(value)) {
                              return Promise.reject(new Error('End date must be after start date'))
                            }
                            return Promise.resolve()
                          },
                        },
                      ]}
                      style={{ margin: 0, width: '50%' }}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        placeholder="Announcement Start Date"
                        showTime
                        format="YYYY-MM-DD HH:mm"
                      />
                    </Form.Item>
                    <Form.Item
                      name="announcementEndDate"
                      rules={[
                        { required: true, message: 'Please select announcement end date' },
                        {
                          validator: (_, value) => {
                            if (!value) return Promise.resolve()
                            const annStartDate = form.getFieldValue('announcementStartDate')
                            if (annStartDate && value.isBefore(annStartDate)) {
                              return Promise.reject(new Error('End date must be after start date'))
                            }
                            return Promise.resolve()
                          },
                        },
                      ]}
                      style={{ margin: 0, width: '50%' }}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        placeholder="Announcement End Date"
                        showTime
                        format="YYYY-MM-DD HH:mm"
                      />
                    </Form.Item>
                  </Space.Compact>
                </Form.Item>
              )}

              {coupon?.linkedAnnouncement && (
                <Alert
                  message="Existing Announcement"
                  description="An announcement already exists for this coupon. Updating the coupon will update the announcement as well."
                  type="warning"
                  showIcon
                  className="mb-4"
                />
              )}

              {/* Conflict Warning */}
              {conflictingAnnouncements.length > 0 && announcementFromDate && (
                <Alert
                  message="Schedule Conflict Detected"
                  description={
                    <div className="mt-2">
                      <p className="mb-2">
                        <strong>{conflictingAnnouncements.length}</strong> other announcement(s) are
                        scheduled to start at the same date/time:
                      </p>
                      <ul className="list-disc list-inside mb-3 space-y-1">
                        {conflictingAnnouncements.map((ann: any) => (
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

              {/* Future date auto-activation message */}
              {isFutureDate && announcementFromDate && (
                <Alert
                  message="Scheduled Announcement"
                  description={
                    <div className="mt-1">
                      <p className="mb-2">
                        This announcement has a <strong>future start date</strong> and will be{' '}
                        <strong>automatically activated</strong> when the scheduled time arrives.
                      </p>
                      <p className="text-sm mb-1">
                        <strong>Start:</strong> {announcementFromDate.format('MMM DD, YYYY HH:mm:ss')}
                      </p>
                      {announcementToDate && (
                        <p className="text-sm mb-2">
                          <strong>End:</strong> {announcementToDate.format('MMM DD, YYYY HH:mm:ss')}
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
              {!isFutureDate && (
                <Alert
                  message="Activation Notice"
                  description="This announcement will be activated immediately when the coupon is saved (if the start date has passed). Only one announcement can be active at a time - activating this will deactivate all others."
                  type="warning"
                  showIcon
                  className="mb-4"
                />
              )}

              <Form.Item
                label="Announcement Title"
                name="announcementTitle"
                rules={[
                  { required: true, message: 'Please enter announcement title' },
                  { max: 100, message: 'Title must be at most 100 characters' },
                ]}
              >
                <Input
                  placeholder={
                    form.getFieldValue('type') === 'percentage'
                      ? `Get ${form.getFieldValue('value')}% OFF!`
                      : `Save ₹${form.getFieldValue('value')}!`
                  }
                />
              </Form.Item>

              <Form.Item
                label="Announcement Message (Optional)"
                name="announcementMessage"
                rules={[{ max: 200, message: 'Message must be at most 200 characters' }]}
              >
                <Input.TextArea
                  rows={2}
                  placeholder="Additional details about the coupon offer"
                  showCount
                  maxLength={200}
                />
              </Form.Item>

              <Form.Item label="Link URL (Optional)" name="announcementLink">
                <Input
                  placeholder={`Auto: /coupon/${form.getFieldValue('code') || 'COUPONCODE'}`}
                />
              </Form.Item>

              <Form.Item label="Link Text" name="announcementLinkText">
                <Input placeholder="Use Now" />
              </Form.Item>

              <Form.Item label="Colors">
                <Space direction="vertical" className="w-full">
                  <Form.Item
                    name="announcementBackgroundColor"
                    label="Background Color"
                    rules={[{ required: true }]}
                    style={{ marginBottom: 0 }}
                  >
                    <ColorPicker showText format="hex" />
                  </Form.Item>
                  <Form.Item
                    name="announcementTextColor"
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
                    backgroundColor:
                      typeof form.getFieldValue('announcementBackgroundColor') === 'string'
                        ? form.getFieldValue('announcementBackgroundColor')
                        : form.getFieldValue('announcementBackgroundColor')?.toHexString() ||
                          '#FFE14B',
                    color:
                      typeof form.getFieldValue('announcementTextColor') === 'string'
                        ? form.getFieldValue('announcementTextColor')
                        : form.getFieldValue('announcementTextColor')?.toHexString() || '#000000',
                  }}
                >
                  <div className="font-semibold">
                    {form.getFieldValue('announcementTitle') || 'Announcement Title'}
                  </div>
                  {form.getFieldValue('announcementMessage') && (
                    <div className="text-sm mt-1">{form.getFieldValue('announcementMessage')}</div>
                  )}
                  {form.getFieldValue('announcementLink') && (
                    <div className="text-sm underline mt-2">
                      {form.getFieldValue('announcementLinkText') || 'Use Now'} →
                    </div>
                  )}
                </div>
              </Form.Item>

              <Form.Item
                name="announcementTargetAudience"
                label="Target Audience"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="all">All Users</Select.Option>
                  <Select.Option value="authenticated">Authenticated Users Only</Select.Option>
                  <Select.Option value="guest">Guest Users Only</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="announcementDismissible"
                valuePropName="checked"
                label="Dismissible"
              >
                <Switch />
                <div className="text-xs text-gray-500 mt-1">
                  Allow users to dismiss this announcement
                </div>
              </Form.Item>
            </>
          )}
        </div>
      </Form>
    </Drawer>
  )
}

export default AddCouponDrawer

