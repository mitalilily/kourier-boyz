import { UploadOutlined } from '@ant-design/icons'
import type { DrawerProps, UploadFile } from 'antd'
import { DatePicker, Drawer, Form, Input, Radio, Select, Upload, message } from 'antd'
import dayjs from 'dayjs'
import React, { useEffect, useRef, useState } from 'react'
import type { Banner } from '../../types/banner'
import { BANNER_POSITIONS } from '../../types/banner'

interface AddBannerDrawerProps extends DrawerProps {
  onAdd: (formData: FormData, form: { resetFields: () => void }) => void
  editingBanner?: Banner | null
}

interface ImageInfo {
  width: number
  height: number
  ratio: string
  desktopDisplay: string
  mobileDisplay: string
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

const AddBannerDrawer: React.FC<AddBannerDrawerProps> = ({
  open,
  onClose,
  onAdd,
  editingBanner,
}) => {
  const [form] = Form.useForm()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const prevBlobRef = useRef<string | null>(null)
  const [drawerWidth, setDrawerWidth] = useState<number | string>('100%')

  const isEditing = !!editingBanner

  // gcd helper for ratio
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

  // compute rendered display sizes (we assume full width hero width 1920 as before)
  const desktopHeight = 510
  const mobileHeight = 400
  const renderWidth = 1920
  const watchedTitle = Form.useWatch('title', form)
  const watchedSubtitle = Form.useWatch('subtitle', form)
  const watchedLinkText = Form.useWatch('linkText', form)

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDrawerWidth('100%')
      return
    }

    const updateWidth = () => {
      const viewport = window.innerWidth
      if (viewport >= 1440) {
        setDrawerWidth(1280)
      } else if (viewport >= 1200) {
        setDrawerWidth(1100)
      } else if (viewport >= 1024) {
        setDrawerWidth(960)
      } else {
        setDrawerWidth('100%')
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // fetch info from URL (used for editing prefill)
  const fetchImageInfoFromURL = (url: string) => {
    if (!url) return
    const img = new Image()
    img.onload = () => {
      if (img.height === 0) return
      const naturalWidth = img.width
      const naturalHeight = img.height
      const divisor = gcd(naturalWidth, naturalHeight)
      const ratio = `${naturalWidth / divisor}:${naturalHeight / divisor}`

      setImageInfo({
        width: naturalWidth,
        height: naturalHeight,
        ratio,
        desktopDisplay: `${renderWidth}×${desktopHeight}`,
        mobileDisplay: `${renderWidth}×${mobileHeight}`,
      })
    }
    img.onerror = () => {
      // ignore
    }
    img.src = url
  }

  // cleanup blob URLs when they were used as preview
  useEffect(() => {
    return () => {
      if (prevBlobRef.current) {
        try {
          URL.revokeObjectURL(prevBlobRef.current)
        } catch (error) {
          console.warn('Failed to revoke preview URL', error)
        }
        prevBlobRef.current = null
      }
    }
  }, [])

  // prefill form + image when editingBanner or drawer open changes
  useEffect(() => {
    if (isEditing && editingBanner) {
      form.setFieldsValue({
        title: editingBanner.title,
        subtitle: editingBanner.subtitle,
        link: editingBanner.link,
        linkText: editingBanner.linkText,
        position: editingBanner.position,
        active: editingBanner.active,
        dateRange:
          editingBanner.startDate && editingBanner.endDate
            ? [dayjs(editingBanner.startDate), dayjs(editingBanner.endDate)]
            : undefined,
      })

      // set file list and preview from existing image url
      if (editingBanner.image) {
        setFileList([
          {
            uid: '-1',
            name: 'Current Image',
            status: 'done',
            url: editingBanner.image,
          },
        ])
        setPreviewUrl(editingBanner.image)
        fetchImageInfoFromURL(editingBanner.image)
      } else {
        setFileList([])
        setPreviewUrl(null)
        setImageInfo(null)
      }
    } else {
      // when not editing or drawer reopened for new banner
      form.resetFields()
      setFileList([])
      setPreviewUrl(null)
      setImageInfo(null)
      setImageFile(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingBanner, isEditing, open])

  // handle file before upload (validate + read natural size + create preview blob)
  const handleBeforeUpload = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      message.error('Invalid file type. Only JPEG, PNG, GIF, WebP, and AVIF are allowed.')
      return false
    }

    if (file.size > MAX_FILE_SIZE) {
      message.error('File too large. Maximum size is 10MB.')
      return false
    }

    // create object URL for preview
    const fileURL = URL.createObjectURL(file)

    // revoke previous blob (if any)
    if (prevBlobRef.current) {
      try {
        URL.revokeObjectURL(prevBlobRef.current)
      } catch (error) {
        console.warn('Failed to revoke preview URL', error)
      }
      prevBlobRef.current = null
    }

    prevBlobRef.current = fileURL
    setPreviewUrl(fileURL)

    // read natural size
    const img = new Image()
    img.onload = () => {
      if (img.height === 0) {
        message.error('Invalid image dimensions.')
        return
      }
      const naturalWidth = img.width
      const naturalHeight = img.height
      const divisor = gcd(naturalWidth, naturalHeight)
      const ratio = `${naturalWidth / divisor}:${naturalHeight / divisor}`

      setImageInfo({
        width: naturalWidth,
        height: naturalHeight,
        ratio,
        desktopDisplay: `${renderWidth}×${desktopHeight}`,
        mobileDisplay: `${renderWidth}×${mobileHeight}`,
      })

      // optional user hint about closeness to 16:9
      const ar = naturalWidth / naturalHeight
      if (ar < 1.6 || ar > 1.9) {
        message.warning(
          `Image: ${naturalWidth}×${naturalHeight} (${ratio}). Recommended ~16:9 for best fit.`,
        )
      } else {
        message.success(`Image: ${naturalWidth}×${naturalHeight} (${ratio}) - good fit`)
      }
    }
    img.onerror = () => {
      message.error('Could not read image dimensions.')
      // revoke the created blob
      if (prevBlobRef.current) {
        try {
          URL.revokeObjectURL(prevBlobRef.current)
        } catch (error) {
          console.warn('Failed to revoke preview URL', error)
        }
        prevBlobRef.current = null
      }
      setPreviewUrl(null)
      setImageInfo(null)
    }
    img.src = fileURL

    const uniqueUid = `${Date.now()}-${file.name}`

    setImageFile(file)
    setFileList([
      {
        uid: uniqueUid,
        name: file.name,
        status: 'done',
        url: fileURL,
      },
    ])

    return false // prevent auto upload
  }

  const handleRemove = () => {
    setFileList([])
    setImageFile(null)
    setImageInfo(null)
    if (prevBlobRef.current) {
      try {
        URL.revokeObjectURL(prevBlobRef.current)
      } catch (error) {
        console.warn('Failed to revoke preview URL', error)
      }
      prevBlobRef.current = null
    }
    setPreviewUrl(null)
  }

  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        const formData = new FormData()
        formData.append('title', values.title)
        if (values.subtitle) formData.append('subtitle', values.subtitle)
        if (values.link) formData.append('link', values.link)
        if (values.linkText) formData.append('linkText', values.linkText)
        formData.append('position', values.position)
        formData.append('active', values.active ? 'true' : 'false')

        if (values.dateRange && values.dateRange[0] && values.dateRange[1]) {
          formData.append('startDate', values.dateRange[0].toISOString())
          formData.append('endDate', values.dateRange[1].toISOString())
        }

        if (imageFile) formData.append('image', imageFile)

        onAdd(formData, form)
      })
      .catch(() => message.error('Please fill in all required fields'))
  }

  return (
    <>
      {/* responsive styles so preview height matches your actual banner heights:
          default 400px, >= 768px -> 460px */}
      <style>{`
        .banner-preview-box {
          width: 100%;
          height: 400px;
        }
        @media (min-width: 768px) {
          .banner-preview-box {
            height: 510px;
          }
        }
        .banner-preview-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        @media (min-width: 1024px) {
          .banner-preview-wrapper {
            flex-direction: row;
            align-items: flex-start;
          }
        }
        .banner-preview-frame {
          width: 100%;
          height: 100%;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .banner-preview-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.25) 100%);
        }
        .banner-preview-content {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          padding: 18px;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .banner-preview-content {
            padding: 32px 48px;
          }
        }
        .banner-preview-title {
          font-size: clamp(20px, 2vw + 12px, 40px);
          font-weight: 700;
          color: #fff;
          margin: 0;
          line-height: 1.2;
          max-width: clamp(220px, 60%, 640px);
          text-shadow: 0 6px 24px rgba(0,0,0,0.35);
        }
        .banner-preview-subtitle {
          font-size: clamp(14px, 1.2vw + 10px, 22px);
          color: rgba(255,255,255,0.9);
          margin: 0;
          line-height: 1.45;
          max-width: clamp(220px, 50%, 520px);
        }
        .banner-preview-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 22px;
          background: #fff;
          color: #111;
          font-weight: 600;
          border-radius: 999px;
          font-size: 14px;
          box-shadow: 0 12px 28px -18px rgba(15,23,42,0.45);
        }
        .banner-preview-stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .banner-preview-mobile {
          width: min(320px, 90%);
          height: 400px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 40px -24px rgba(15,23,42,0.45);
        }
        .banner-preview-desktop {
          flex: 1 1 auto;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 28px 50px -24px rgba(15,23,42,0.5);
        }
        .banner-preview-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
        }
        .banner-preview-badge {
          position: absolute;
          right: 10px;
          bottom: 8px;
          background: rgba(0,0,0,0.5);
          color: #fff;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
        }
        .banner-preview-outline-good {
          border: 2px solid #52c41a;
          border-radius: 8px;
          overflow: hidden;
        }
        .banner-preview-outline-warn {
          border: 2px solid #faad14;
          border-radius: 8px;
          overflow: hidden;
        }
      `}</style>

      <Drawer
        title={isEditing ? 'Edit Banner' : 'Add Banner'}
        placement="right"
        onClose={onClose}
        open={open}
        width={drawerWidth}
        bodyStyle={{ padding: '0 32px 32px', maxWidth: 1440, margin: '0 auto' }}
        styles={{ header: { padding: '16px 32px' } }}
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 24px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              style={{
                padding: '6px 24px',
                border: 'none',
                borderRadius: '6px',
                background: '#1890ff',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              {isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ active: true }}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input placeholder="Enter banner title" />
          </Form.Item>

          <Form.Item name="subtitle" label="Subtitle">
            <Input placeholder="Enter subtitle (optional)" />
          </Form.Item>

          <Form.Item
            label={isEditing ? 'Change Image (optional)' : 'Image'}
            rules={isEditing ? [] : [{ required: true, message: 'Please upload an image' }]}
          >
            <Upload
              beforeUpload={handleBeforeUpload}
              maxCount={1}
              listType="picture-card"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
              fileList={fileList}
              onRemove={() => {
                handleRemove()
                return false
              }}
            >
              {fileList.length === 0 && (
                <div
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                >
                  <UploadOutlined />
                  <span>Upload</span>
                </div>
              )}
            </Upload>

            <p style={{ fontSize: 12, color: '#555', marginTop: 12, lineHeight: 1.6 }}>
              <strong>Recommended banner size:</strong> 1920×460&nbsp;px (desktop) and
              1920×400&nbsp;px (mobile). Keep key visuals centred so they stay visible across
              breakpoints.
            </p>

            {imageInfo && (
              <p style={{ fontSize: 12, color: '#555', marginTop: 8, lineHeight: 1.6 }}>
                <strong>Original:</strong> {imageInfo.width}×{imageInfo.height}px &nbsp;|&nbsp;
                <strong>Ratio:</strong> {imageInfo.ratio}
                <br />
                <strong>Displays as:</strong> {imageInfo.desktopDisplay} (desktop) ·{' '}
                {imageInfo.mobileDisplay} (mobile)
              </p>
            )}

            {previewUrl && (
              <div className="banner-preview-wrapper" style={{ marginTop: 16 }}>
                <div
                  className={`banner-preview-desktop ${
                    imageInfo
                      ? (() => {
                          const closeAr = imageInfo.width / imageInfo.height
                          if (closeAr >= 1.65 && closeAr <= 1.85)
                            return 'banner-preview-outline-good'
                          return 'banner-preview-outline-warn'
                        })()
                      : ''
                  }`}
                >
                  <div className="banner-preview-box">
                    <div className="banner-preview-frame">
                      <img src={previewUrl} alt="Desktop preview" />
                      <div className="banner-preview-overlay" />
                      <div className="banner-preview-content">
                        <h3 className="banner-preview-title">
                          {watchedTitle || 'Your banner headline'}
                        </h3>
                        {(watchedSubtitle || !watchedTitle) && (
                          <p className="banner-preview-subtitle">
                            {watchedSubtitle ||
                              'Use this area to highlight the most compelling copy for your promotion or seasonal campaign.'}
                          </p>
                        )}
                        <span className="banner-preview-cta">
                          {watchedLinkText || 'Shop Now'} →
                        </span>
                      </div>
                      <div className="banner-preview-badge">Desktop · h-[400px] → md:h-[460px]</div>
                    </div>
                  </div>
                </div>

                <div className="banner-preview-stack">
                  <div
                    className={`banner-preview-mobile ${
                      imageInfo
                        ? (() => {
                            const closeAr = imageInfo.width / imageInfo.height
                            if (closeAr >= 1.65 && closeAr <= 1.85)
                              return 'banner-preview-outline-good'
                            return 'banner-preview-outline-warn'
                          })()
                        : ''
                    }`}
                  >
                    <div className="banner-preview-frame">
                      <img src={previewUrl} alt="Mobile preview" />
                      <div className="banner-preview-overlay" />
                      <div className="banner-preview-content" style={{ padding: 20 }}>
                        <h3 className="banner-preview-title" style={{ fontSize: 22 }}>
                          {watchedTitle || 'Your banner headline'}
                        </h3>
                        {(watchedSubtitle || !watchedTitle) && (
                          <p className="banner-preview-subtitle" style={{ fontSize: 14 }}>
                            {watchedSubtitle ||
                              'Secondary message to entice shoppers on smaller screens.'}
                          </p>
                        )}
                        <span
                          className="banner-preview-cta"
                          style={{ padding: '8px 18px', fontSize: 13 }}
                        >
                          {watchedLinkText || 'Shop Now'} →
                        </span>
                      </div>
                      <div className="banner-preview-badge">Mobile · h-[400px]</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              Max size: 10MB. Formats: JPEG, PNG, GIF, WebP, AVIF
            </p>
          </Form.Item>

          <Form.Item name="link" label="Link (optional)">
            <Input placeholder="e.g., /shop-by-category or https://example.com" />
          </Form.Item>

          <Form.Item name="linkText" label="Link Text (optional)">
            <Input placeholder="Default: Shop Now" />
          </Form.Item>

          <Form.Item
            name="position"
            label="Position"
            rules={[{ required: true, message: 'Please select a position' }]}
          >
            <Select placeholder="Select banner position">
              {BANNER_POSITIONS.map((pos) => (
                <Select.Option key={pos.value} value={pos.value}>
                  {pos.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="active" label="Status">
            <Radio.Group>
              <Radio value={true}>Active</Radio>
              <Radio value={false}>Inactive</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="dateRange" label="Active Date Range (optional)">
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}

export default AddBannerDrawer
