import { PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import {
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import { useEffect, useMemo, useState } from 'react'
import { useCategories } from '../../api/category'
import { useCertificateTypes } from '../../api/certificates'
import type { Category } from '../../types/category'

interface AddCategoryDrawerProps {
  open: boolean
  onClose: () => void
  onAdded: (formData: FormData, form: { resetFields: () => void }) => void
  category?: Category | null
  loading?: boolean
}

const AddCategoryDrawer = ({
  open,
  onClose,
  onAdded,
  category,
  loading,
}: AddCategoryDrawerProps) => {
  const [form] = Form.useForm()
  const [mainFile, setMainFile] = useState<UploadFile<RcFile>[]>([])
  const [hoverFile, setHoverFile] = useState<UploadFile<RcFile>[]>([])
  const [bannerFiles, setBannerFiles] = useState<UploadFile<RcFile>[]>([])
  const { data: allCategoriesData } = useCategories({
    includeSubcategories: true,
  })
  const allCategories = useMemo(
    () => allCategoriesData?.categories || [],
    [allCategoriesData?.categories],
  )
  const { data: certificateTypes } = useCertificateTypes()
  const [ownCertificates, setOwnCertificates] = useState<string[]>([])
  const [inheritedCertificates, setInheritedCertificates] = useState<string[]>([])
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const overrideParent = Form.useWatch('overrideParentCertificateRule', form)

  const parentCategory = useMemo(() => {
    if (!selectedParentId) return null
    return allCategories.find((cat) => (cat._id || cat.id) === selectedParentId)
  }, [selectedParentId, allCategories])

  useEffect(() => {
    if (parentCategory?.effectiveRequiredCertificates) {
      setInheritedCertificates(parentCategory.effectiveRequiredCertificates)
    } else if (!selectedParentId) {
      setInheritedCertificates([])
    }
  }, [parentCategory, selectedParentId])

  const effectiveCertificates = useMemo(() => {
    if (overrideParent) {
      return ownCertificates
    }
    const combined = new Set<string>(ownCertificates)
    inheritedCertificates.forEach((cert) => combined.add(cert))
    return Array.from(combined)
  }, [overrideParent, ownCertificates, inheritedCertificates])

  // Pre-fill form in edit mode
  useEffect(() => {
    if (category) {
      // Get parent ID from category
      const parentId = category.parent
        ? typeof category.parent === 'string'
          ? category.parent
          : category.parent._id || category.parent.id || null
        : null

      form.setFieldsValue({
        name: category.name,
        slug: category.slug,
        description: category.description,
        top: category.top ?? false,
        status: category.status || 'active',
        parent: parentId || null,
        requiredCertificates: category.requiredCertificates || [],
        overrideParentCertificateRule: category.overrideParentCertificateRule || false,
      })
      setSelectedParentId(parentId || null)
      setOwnCertificates(category.requiredCertificates || [])
      setInheritedCertificates(category.inheritedRequiredCertificates || [])

      setMainFile(
        category.mainImage
          ? [
              {
                uid: '-1',
                name: 'main',
                status: 'done',
                url: category.mainImage,
              },
            ]
          : [],
      )

      setHoverFile(
        category.hoverImage
          ? [
              {
                uid: '-2',
                name: 'hover',
                status: 'done',
                url: category.hoverImage,
              },
            ]
          : [],
      )

      setBannerFiles(
        category.banners?.map((b, idx) => ({
          uid: `${idx}`,
          name: `banner-${idx}`,
          status: 'done',
          url: b,
        })) || [],
      )
    } else {
      form.resetFields()
      setMainFile([])
      setHoverFile([])
      setBannerFiles([])
      setOwnCertificates([])
      setInheritedCertificates([])
      setSelectedParentId(null)
    }
  }, [category, form, open])

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    if (!category) {
      // Only auto-generate for new categories
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      form.setFieldValue('slug', slug)
    }
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ]

  const beforeUpload = (file: RcFile) => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      window.alert(
        `Invalid file type. Only JPEG, PNG, GIF, WebP, and AVIF are allowed. File type: ${file.type}`,
      )
      return false
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      window.alert(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`)
      return false
    }

    return false // Prevent auto upload, we'll handle it manually
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      console.log('Form values:', values)
      console.log('Top value:', values.top)

      // Check if we have images (either uploaded files or existing URLs)
      const hasMainImage = mainFile[0] && (mainFile[0].originFileObj || mainFile[0].url)
      const hasHoverImage = hoverFile[0] && (hoverFile[0].originFileObj || hoverFile[0].url)

      if (!hasMainImage || !hasHoverImage) {
        return void window.alert('Please upload main and hover images!')
      }

      const formData = new FormData()
      formData.append('name', values.name)
      formData.append('slug', values.slug)
      if (values.description) formData.append('description', values.description)
      formData.append('top', values.top ? 'true' : 'false')
      formData.append('status', values.status || 'active')
      if (values.parent && values.parent !== 'null' && values.parent !== '') {
        formData.append('parent', values.parent)
        setSelectedParentId(values.parent)
        const parentCategory = allCategories.find((cat) => (cat._id || cat.id) === values.parent)
        setInheritedCertificates(parentCategory?.effectiveRequiredCertificates || [])
      } else {
        formData.append('parent', 'null')
        setSelectedParentId(null)
        setInheritedCertificates([])
      }

      console.log('FormData top:', formData.get('top'))

      // Handle main image - send file if new upload, or URL if existing
      if (mainFile[0]?.originFileObj) {
        formData.append('mainImage', mainFile[0].originFileObj)
      } else if (mainFile[0]?.url) {
        // Send URL if it's an existing image (e.g., from category request)
        formData.append('mainImageUrl', mainFile[0].url)
      }

      // Handle hover image - send file if new upload, or URL if existing
      if (hoverFile[0]?.originFileObj) {
        formData.append('hoverImage', hoverFile[0].originFileObj)
      } else if (hoverFile[0]?.url) {
        // Send URL if it's an existing image (e.g., from category request)
        formData.append('hoverImageUrl', hoverFile[0].url)
      }

      // Handle banner images - send files if new uploads, or URLs if existing
      const bannerUrls: string[] = []
      for (const file of bannerFiles) {
        if (file.originFileObj) {
          formData.append('banners', file.originFileObj)
        } else if (file.url) {
          bannerUrls.push(file.url)
        }
      }
      // Send banner URLs as JSON string (backend will parse it)
      if (bannerUrls.length > 0) {
        formData.append('bannerUrls', JSON.stringify(bannerUrls))
      }

      // Handle certificate requirements - always send, even if empty (for updates)
      const certificates = values.requiredCertificates || []
      formData.append('requiredCertificates', JSON.stringify(certificates))
      formData.append(
        'overrideParentCertificateRule',
        values.overrideParentCertificateRule ? 'true' : 'false',
      )

      onAdded(formData, {
        resetFields: () => {
          form.resetFields()
          setMainFile([])
          setHoverFile([])
          setBannerFiles([])
          setOwnCertificates([])
          setInheritedCertificates([])
          setSelectedParentId(null)
        },
      })
    } catch (err) {
      console.error('Validation error:', err)
    }
  }

  const uploadButton = (label: string) => (
    <div className="flex flex-col items-center justify-center">
      <PlusOutlined className="text-2xl text-gray-400" />
      <span className="text-sm text-gray-500 mt-2">{label}</span>
    </div>
  )

  return (
    <Drawer
      title={category ? 'Edit Category' : 'Add New Category'}
      placement="right"
      width={720}
      onClose={onClose}
      open={open}
      footer={
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="primary" onClick={handleSave} loading={loading}>
            {category ? 'Update' : 'Create'} Category
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-900 border-b pb-2">Basic Information</h3>

          <Form.Item
            name="name"
            label="Category Name"
            rules={[{ required: true, message: 'Please enter category name' }]}
          >
            <Input
              placeholder="e.g., Electronics, Fashion, Home & Garden"
              size="large"
              onChange={handleNameChange}
            />
          </Form.Item>

          <Form.Item
            name="slug"
            label="URL Slug"
            rules={[
              { required: true, message: 'Please enter URL slug' },
              {
                pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: 'Slug must be lowercase with hyphens only',
              },
            ]}
            tooltip="This will be used in the URL (e.g., /categories/electronics)"
          >
            <Input placeholder="electronics" size="large" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea
              placeholder="Brief description of this category..."
              rows={3}
              showCount
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            name="parent"
            label="Parent Category"
            tooltip="Leave empty for root category, or select a parent to create a subcategory"
          >
            <Select
              size="large"
              allowClear
              placeholder="Select parent category (optional)"
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={[
                { label: 'None (Root Category)', value: null },
                ...allCategories
                  .filter(
                    (cat) => !category || (cat._id || cat.id) !== (category._id || category.id),
                  )
                  .map((cat) => {
                    const parent = cat.parent
                      ? typeof cat.parent === 'string'
                        ? null
                        : cat.parent
                      : null
                    const parentName = parent?.name || null
                    const label = parentName ? `${cat.name} (${parentName})` : cat.name
                    return {
                      label,
                      value: cat._id || cat.id || '',
                    }
                  }),
              ]}
              onChange={(value) => {
                if (value) {
                  setSelectedParentId(value)
                  const parentCategory = allCategories.find((cat) => (cat._id || cat.id) === value)
                  setInheritedCertificates(parentCategory?.effectiveRequiredCertificates || [])
                } else {
                  setSelectedParentId(null)
                  setInheritedCertificates([])
                }
              }}
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="status" label="Status" initialValue="active">
              <Select
                size="large"
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Inactive', value: 'inactive' },
                ]}
              />
            </Form.Item>

            <Form.Item name="top" label="Top Category" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
            <p className="text-xs text-gray-500 -mt-2">Featured on homepage</p>
          </div>
        </div>

        {/* Certificate Requirements Section */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-900 border-b pb-2">
            Certificate Requirements
          </h3>

          <Form.Item
            name="requiredCertificates"
            label="Required Certificates"
            tooltip="Select which certificates are required for products in this category"
          >
            <Select
              mode="multiple"
              placeholder="Select required certificates (optional)"
              size="large"
              allowClear
              options={certificateTypes?.map((type) => ({
                label: type.label,
                value: type.value,
              }))}
              onChange={(value) => setOwnCertificates(value as string[])}
            />
          </Form.Item>

          <Form.Item
            name="overrideParentCertificateRule"
            valuePropName="checked"
            initialValue={false}
          >
            <Checkbox>
              Override parent certificate rule (subcategories won't inherit parent's certificate
              requirements)
            </Checkbox>
          </Form.Item>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <SafetyCertificateOutlined style={{ color: '#1677ff' }} />
              Effective Compliance Requirements
            </h4>
            {effectiveCertificates.length === 0 ? (
              <Tag color="default">No certificates required</Tag>
            ) : (
              <Space direction="vertical" size={4}>
                {!overrideParent && inheritedCertificates.length > 0 && (
                  <div>
                    <Typography.Text type="secondary">Inherited from Parent</Typography.Text>
                    <Space size={[4, 4]} wrap>
                      {inheritedCertificates.map((cert) => (
                        <Tag key={`inherited-${cert}`} color="blue">
                          {cert.replace(/_/g, ' ')}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )}
                {ownCertificates.length > 0 && (
                  <div>
                    <Typography.Text type="secondary">Category Specific</Typography.Text>
                    <Space size={[4, 4]} wrap>
                      {ownCertificates.map((cert) => (
                        <Tag key={`own-${cert}`} color="purple">
                          {cert.replace(/_/g, ' ')}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )}
                <div>
                  <Typography.Text type="secondary">Resulting Requirement</Typography.Text>
                  <Space size={[4, 4]} wrap>
                    {effectiveCertificates.map((cert) => (
                      <Tag key={`effective-${cert}`} color="green">
                        {cert.replace(/_/g, ' ')}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </Space>
            )}
          </div>
        </div>

        {/* Images Section */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-900 border-b pb-2">Images</h3>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Main Image <span className="text-red-500">*</span>
              </label>
              <Upload
                listType="picture-card"
                fileList={mainFile}
                onChange={({ fileList }) => setMainFile(fileList.slice(-1))}
                beforeUpload={beforeUpload}
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
                className="category-upload"
              >
                {mainFile.length >= 1 ? null : uploadButton('Upload')}
              </Upload>
              <p className="text-xs text-gray-500 mt-1">
                Recommended: 500x500px. Max size: 10MB. Formats: JPEG, PNG, GIF, WebP, AVIF
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hover Image <span className="text-red-500">*</span>
              </label>
              <Upload
                listType="picture-card"
                fileList={hoverFile}
                onChange={({ fileList }) => setHoverFile(fileList.slice(-1))}
                beforeUpload={beforeUpload}
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
                className="category-upload"
              >
                {hoverFile.length >= 1 ? null : uploadButton('Upload')}
              </Upload>
              <p className="text-xs text-gray-500 mt-1">
                Shown on hover. Max size: 10MB. Formats: JPEG, PNG, GIF, WebP, AVIF
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Banner Images <span className="text-gray-500">(Optional)</span>
            </label>
            <Upload
              listType="picture-card"
              multiple
              fileList={bannerFiles}
              onChange={({ fileList }) => setBannerFiles(fileList)}
              beforeUpload={beforeUpload}
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
              className="category-upload"
            >
              {bannerFiles.length >= 10 ? null : uploadButton('Add Banner')}
            </Upload>
            <p className="text-xs text-gray-500 mt-1">
              Upload up to 10 banner images (1200x400px recommended). Max size: 10MB per image.
              Formats: JPEG, PNG, GIF, WebP, AVIF
            </p>
          </div>
        </div>
      </Form>
    </Drawer>
  )
}

export default AddCategoryDrawer
