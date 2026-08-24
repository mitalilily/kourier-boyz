import { CopyOutlined, DownOutlined, UploadOutlined, VideoCameraOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Dropdown,
  message,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  type FormInstance,
  type MenuProps,
  type UploadFile,
} from 'antd'
import type { UploadRequestFile } from 'rc-upload/lib/interface'
import { useMemo } from 'react'
import { deleteProductMedia, getProductMediaPresign } from '../../../api/products'
import { getUniqueAttributeValues } from '../productFormUtils'

type RcFile = Parameters<NonNullable<Parameters<typeof Upload>[0]['beforeUpload']>>[0]
type UploadRequestOption = Parameters<NonNullable<Parameters<typeof Upload>[0]['customRequest']>>[0]

interface MediaTabProps {
  form: FormInstance
  mainImageList: UploadFile[]
  imagesList: UploadFile[]
  videosList?: UploadFile[]
  handleMainImageChange: (info: { fileList: UploadFile[] }) => void
  handleImagesChange: (info: { fileList: UploadFile[] }) => void
  handleVideosChange?: (info: { fileList: UploadFile[] }) => void
  variants: Array<{
    id: string
    name: string
    sku: string
    attributes: Record<string, string>
    price?: number
    costPrice?: number
    comparePrice?: number
    discountPercent?: number
    stock?: number
    lowStockThreshold?: number
    mainImage: UploadFile | string | null
    images: Array<UploadFile | string>
    videos?: Array<UploadFile | string>
    isDefault: boolean
    status: string
  }>
  onVariantsChange: (
    variants: Array<{
      id: string
      name: string
      sku: string
      attributes: Record<string, string>
      price?: number
      costPrice?: number
      comparePrice?: number
      discountPercent?: number
      stock?: number
      lowStockThreshold?: number
      mainImage: UploadFile | string | null
      images: Array<UploadFile | string>
      videos?: Array<UploadFile | string>
      isDefault: boolean
      status: string
    }>,
  ) => void
}

const MediaTab = ({
  form,
  mainImageList,
  imagesList,
  videosList = [],
  handleMainImageChange,
  handleImagesChange,
  handleVideosChange,
  variants,
  onVariantsChange,
}: MediaTabProps) => {
  const hasVariants = form.getFieldValue('hasVariants') || false

  // Image limits and recommendations
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
  const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB
  const MAX_VIDEO_DURATION = 120 // 2 minutes in seconds
  const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ]
  const ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/avi',
    'video/x-matroska', // MKV files
    'video/3gpp', // 3GP files
  ]
  const RECOMMENDED_IMAGE_DIMENSIONS = '1200x1200px (1:1 aspect ratio)'
  const RECOMMENDED_VIDEO_DIMENSIONS = '1920x1080px (16:9 aspect ratio) or 1080x1080px (1:1)'

  const validateImageFile = (file: RcFile): boolean => {
    // Check file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      message.error(
        `Invalid file type. Only JPEG, PNG, GIF, WebP, and AVIF are allowed. File type: ${file.type}`,
      )
      return false
    }

    // Check file size
    if (file.size > MAX_IMAGE_SIZE) {
      message.error(`File too large. Maximum size is ${MAX_IMAGE_SIZE / (1024 * 1024)}MB.`)
      return false
    }

    return true
  }

  const validateVideoFile = (file: RcFile): boolean => {
    // Check file extension first (most reliable method)
    const fileName = file.name.toLowerCase()
    const fileExtension = fileName.split('.').pop()
    const validVideoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv', '3gp']
    const isValidVideoExtension = fileExtension
      ? validVideoExtensions.includes(fileExtension)
      : false

    // If extension is valid, allow it (ignore MIME type as browsers can be unreliable)
    if (isValidVideoExtension) {
      // Check file size
      if (file.size > MAX_VIDEO_SIZE) {
        message.error(`File too large. Maximum size is ${MAX_VIDEO_SIZE / (1024 * 1024)}MB.`)
        return false
      }
      return true
    }

    // If extension is not valid, check MIME type as fallback
    if (file.type) {
      // Reject image files explicitly
      if (file.type.startsWith('image/')) {
        message.error(
          `Invalid file type. Videos only. Expected video file but got image (${file.type}). Please select a video file (MP4, WebM, MOV, AVI, MKV, or 3GP).`,
        )
        return false
      }

      // Check if it's a valid video MIME type
      if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
        // Check file size
        if (file.size > MAX_VIDEO_SIZE) {
          message.error(`File too large. Maximum size is ${MAX_VIDEO_SIZE / (1024 * 1024)}MB.`)
          return false
        }
        return true
      }
    }

    // If neither extension nor MIME type is valid, reject
    message.error(
      `Invalid file type. Only MP4, WebM, MOV, AVI, MKV, and 3GP video files are allowed. File: ${
        file.name
      }${file.type ? ` (detected type: ${file.type})` : ' (no type detected)'}`,
    )
    return false
  }

  const getRemoteUrl = (file: UploadFile | string | null | undefined): string | null => {
    if (!file) return null
    if (typeof file === 'string') return file
    if (typeof file === 'object' && file.url && !('originFileObj' in file && file.originFileObj)) {
      return file.url
    }
    return null
  }

  const isNewUpload = (file: UploadFile | string | null | undefined): boolean => {
    if (!file || typeof file === 'string') return false
    return Boolean((file as { __isNewUpload?: boolean }).__isNewUpload)
  }

  const deleteRemovedMedia = async (
    previous: Array<UploadFile | string>,
    next: Array<UploadFile | string>,
  ) => {
    const nextUrls = new Set(
      next.map((item) => getRemoteUrl(item)).filter(Boolean) as string[],
    )
    const removed = previous
      .filter((item) => isNewUpload(item))
      .map((item) => getRemoteUrl(item))
      .filter((url): url is string => Boolean(url))
      .filter((url) => !nextUrls.has(url))

    if (removed.length > 0) {
      try {
        await deleteProductMedia({ urls: removed })
      } catch (error) {
        console.error('Failed to delete removed media:', error)
        message.error('Failed to delete some media from storage')
      }
    }
  }

  const uploadViaPresign = async (options: UploadRequestOption, scope: 'product' | 'variant') => {
    const { file, onError, onSuccess, onProgress } = options
    const uploadFile = file as RcFile

    try {
      const { uploadUrl, publicUrl } = await getProductMediaPresign({
        fileName: uploadFile.name,
        contentType: uploadFile.type || 'application/octet-stream',
        scope,
      })

      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress?.({ percent })
        }
      }
      xhr.onerror = () => {
        onError?.(new Error('Upload failed'))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const fileRef = file as UploadFile & {
            __isNewUpload?: boolean
            __replaceUrl?: string
            __publicUrl?: string
          }
          fileRef.url = publicUrl
          fileRef.__publicUrl = publicUrl
          fileRef.__isNewUpload = true
          if ('originFileObj' in fileRef) {
            delete (fileRef as { originFileObj?: unknown }).originFileObj
          }
          const replaceUrl = fileRef.__replaceUrl
          if (replaceUrl) {
            void deleteProductMedia({ url: replaceUrl })
            delete fileRef.__replaceUrl
          }
          onSuccess?.({ url: publicUrl }, uploadFile as unknown as UploadRequestFile)
        } else {
          onError?.(new Error('Upload failed'))
        }
      }
      xhr.open('PUT', uploadUrl)
      if (uploadFile.type) {
        xhr.setRequestHeader('Content-Type', uploadFile.type)
      }
      xhr.send(uploadFile)
    } catch (error) {
      console.error('Presigned upload failed:', error)
      onError?.(error as Error)
    }
  }

  // const validateFile = validateImageFile

  // Update variant media
  const updateVariantMedia = (
    variantId: string,
    field: string,
    value: UploadFile | UploadFile[] | null,
  ) => {
    const updatedVariants = variants.map((variant) => {
      if (variant.id !== variantId) return variant

      if ((field === 'images' || field === 'videos') && Array.isArray(value)) {
        const previousList = (variant as { images?: Array<UploadFile | string>; videos?: Array<UploadFile | string> })[
          field as 'images' | 'videos'
        ] || []
        void deleteRemovedMedia(previousList, value as Array<UploadFile | string>)
        return { ...variant, [field]: value as Array<UploadFile | string> }
      }

      if (field === 'mainImage') {
        const previousMain = (variant as { mainImage?: UploadFile | string | null }).mainImage
        const previousRemote = getRemoteUrl(previousMain)
        const nextUpload = value && typeof value === 'object' ? (value as UploadFile) : null
        const nextRemote = getRemoteUrl(nextUpload || (value as UploadFile | string | null))

        if (
          previousRemote &&
          isNewUpload(previousMain) &&
          !nextRemote &&
          nextUpload &&
          'originFileObj' in nextUpload
        ) {
          ;(nextUpload as { __replaceUrl?: string }).__replaceUrl = previousRemote
        }
        return { ...variant, [field]: value as UploadFile | string | null }
      }

      return { ...variant, [field]: value }
    })

    onVariantsChange(updatedVariants)
  }

  // Get unique attribute values for copy dropdown options
  const attributeValues = useMemo(() => getUniqueAttributeValues(variants), [variants])

  // Copy media from one variant to others (all or filtered by attribute)
  const copyMediaToVariants = (
    sourceVariantId: string,
    targetAttribute?: string,
    targetValue?: string,
  ) => {
    const sourceVariant = variants.find((v) => v.id === sourceVariantId)
    if (!sourceVariant) return

    // Check if source has any media to copy
    if (
      !sourceVariant.mainImage &&
      (!sourceVariant.images || sourceVariant.images.length === 0) &&
      (!sourceVariant.videos || sourceVariant.videos.length === 0)
    ) {
      message.warning(`"${sourceVariant.name}" has no media to copy`)
      return
    }

    let copiedCount = 0
    const updatedVariants = variants.map((variant) => {
      // Skip source variant
      if (variant.id === sourceVariantId) return variant

      // If filtering by attribute, only copy to variants matching that attribute value
      if (targetAttribute && targetValue) {
        if (variant.attributes[targetAttribute] !== targetValue) return variant
      }

      copiedCount++
      return {
        ...variant,
        mainImage: sourceVariant.mainImage,
        images: [...(sourceVariant.images || [])],
        videos: [...(sourceVariant.videos || [])],
      }
    })

    if (copiedCount === 0) {
      message.info('No matching variants to copy to')
      return
    }

    onVariantsChange(updatedVariants)
    const targetDesc =
      targetAttribute && targetValue
        ? `all "${targetValue}" (${targetAttribute}) variants`
        : 'all other variants'
    message.success(`Media copied from "${sourceVariant.name}" to ${targetDesc} (${copiedCount})`)
  }

  // Build dropdown menu items for copy options
  const getCopyMenuItems = (variantId: string): MenuProps['items'] => {
    const items: MenuProps['items'] = [
      {
        key: 'all',
        label: 'All Variants',
        onClick: () => copyMediaToVariants(variantId),
      },
    ]

    // Add attribute-based options
    Object.entries(attributeValues).forEach(([attribute, values]) => {
      if (values.length > 1) {
        items.push({
          type: 'divider',
        })
        items.push({
          key: `header-${attribute}`,
          label: (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              By {attribute}
            </Typography.Text>
          ),
          disabled: true,
        })
        values.forEach((value) => {
          // Count matching variants (excluding source)
          const matchCount = variants.filter(
            (v) => v.id !== variantId && v.attributes[attribute] === value,
          ).length
          items.push({
            key: `${attribute}-${value}`,
            label: `${value} (${matchCount})`,
            onClick: () => copyMediaToVariants(variantId, attribute, value),
            disabled: matchCount === 0,
          })
        })
      }
    })

    return items
  }

  // Clear all media for all variants
  const clearAllVariantMedia = () => {
    const updatedVariants = variants.map((variant) => ({
      ...variant,
      mainImage: null,
      images: [],
      videos: [],
    }))

    onVariantsChange(updatedVariants)
    message.success('All variant media cleared')
  }

  // Check if there are multiple attribute values (enables dropdown vs simple button)
  const hasMultipleAttributeValues = useMemo(() => {
    return Object.values(attributeValues).some((values) => values.length > 1)
  }, [attributeValues])

  // Variant media table columns
  const variantColumns = [
    {
      title: 'Variant Details',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (
        name: string,
        record: { id: string; sku: string; attributes: Record<string, string> },
      ) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>SKU: {record.sku}</div>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>
            {record.attributes && Object.keys(record.attributes).length > 0
              ? Object.entries(record.attributes)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ')
              : 'No attributes'}
          </div>
          {hasMultipleAttributeValues ? (
            <Dropdown menu={{ items: getCopyMenuItems(record.id) }} trigger={['click']}>
              <Button size="small" icon={<CopyOutlined />} style={{ fontSize: 11 }}>
                Copy to <DownOutlined style={{ fontSize: 10 }} />
              </Button>
            </Dropdown>
          ) : (
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyMediaToVariants(record.id)}
              style={{ fontSize: 11 }}
            >
              Copy to All
            </Button>
          )}
        </div>
      ),
    },
    {
      title: 'Main Image',
      dataIndex: 'mainImage',
      key: 'mainImage',
      width: 120,
      render: (mainImage: UploadFile | string | null, record: { id: string }) => {
        const fileList: UploadFile[] = mainImage
          ? [
              typeof mainImage === 'string'
                ? ({
                    uid: mainImage,
                    name: mainImage.split('/').pop() || 'image',
                    url: mainImage,
                  } as UploadFile)
                : (mainImage as UploadFile),
            ]
          : []
        return (
          <div style={{ textAlign: 'center' }}>
            <Upload
              name="mainImage"
              listType="picture-card"
              fileList={fileList}
              customRequest={(options) => uploadViaPresign(options, 'variant')}
              onChange={(info) => {
                // Use info.file which contains originFileObj for newly added files
                if (info.file.status !== 'removed') {
                  updateVariantMedia(record.id, 'mainImage', info.file as UploadFile)
                } else {
                  updateVariantMedia(record.id, 'mainImage', null)
                }
              }}
              beforeUpload={(file) => {
                if (!validateImageFile(file)) {
                  return Upload.LIST_IGNORE
                }
                return true
              }}
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
              maxCount={1}
              showUploadList={{ showPreviewIcon: true, showRemoveIcon: true }}
              style={{ width: '100%' }}
            >
              {!mainImage && (
                <div>
                  <UploadOutlined style={{ fontSize: 16, color: '#B78115' }} />
                  <div style={{ marginTop: 8, fontSize: 11 }}>Main Image</div>
                </div>
              )}
            </Upload>
          </div>
        )
      },
    },
    {
      title: 'Additional Images',
      dataIndex: 'images',
      key: 'images',
      width: 200,
      render: (images: Array<UploadFile | string>, record: { id: string }) => {
        const fileList: UploadFile[] = (images || []).map((img) =>
          typeof img === 'string'
            ? ({ uid: img, name: img.split('/').pop() || 'image', url: img } as UploadFile)
            : (img as UploadFile),
        )
        return (
          <div>
            <Upload
              name="images"
              listType="picture-card"
              fileList={fileList}
              customRequest={(options) => uploadViaPresign(options, 'variant')}
              onChange={(info) => {
                // info.fileList entries include originFileObj for newly added files
                updateVariantMedia(record.id, 'images', info.fileList as UploadFile[])
              }}
              beforeUpload={(file) => {
                if (!validateImageFile(file)) {
                  return Upload.LIST_IGNORE
                }
                return true
              }}
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
              multiple
              maxCount={10}
              showUploadList={{
                showPreviewIcon: true,
                showRemoveIcon: true,
                showDownloadIcon: false,
              }}
            >
              {fileList.length < 10 && (
                <div>
                  <UploadOutlined style={{ fontSize: 16, color: '#B78115' }} />
                  <div style={{ marginTop: 8, fontSize: 11 }}>Add Images</div>
                </div>
              )}
            </Upload>
            {fileList && fileList.length > 0 && (
              <div style={{ marginTop: 8, textAlign: 'center' }}>
                <Tag color="processing" style={{ fontSize: '11px' }}>
                  {fileList.length}/10 images
                </Tag>
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Videos',
      dataIndex: 'videos',
      key: 'videos',
      width: 200,
      render: (videos: Array<UploadFile | string> | undefined, record: { id: string }) => {
        const fileList: UploadFile[] = (videos || []).map((vid) =>
          typeof vid === 'string'
            ? ({ uid: vid, name: vid.split('/').pop() || 'video', url: vid } as UploadFile)
            : (vid as UploadFile),
        )
        return (
          <div>
            <Upload
              name="videos"
              listType="picture-card"
              fileList={fileList}
              customRequest={(options) => uploadViaPresign(options, 'variant')}
              onChange={(info) => {
                updateVariantMedia(record.id, 'videos', info.fileList as UploadFile[])
              }}
              beforeUpload={(file) => {
                if (!validateVideoFile(file)) {
                  return Upload.LIST_IGNORE
                }
                return true
              }}
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/avi,video/x-matroska,video/3gpp,.mp4,.webm,.mov,.avi,.mkv,.3gp"
              multiple
              maxCount={5}
              iconRender={() => <VideoCameraOutlined style={{ fontSize: 16, color: '#B78115' }} />}
              showUploadList={{
                showPreviewIcon: true,
                showRemoveIcon: true,
                showDownloadIcon: false,
              }}
            >
              {fileList.length < 5 && (
                <div>
                  <VideoCameraOutlined style={{ fontSize: 16, color: '#B78115' }} />
                  <div style={{ marginTop: 8, fontSize: 11 }}>Add Videos</div>
                </div>
              )}
            </Upload>
            {fileList && fileList.length > 0 && (
              <div style={{ marginTop: 8, textAlign: 'center' }}>
                <Tag color="purple" style={{ fontSize: '11px' }}>
                  {fileList.length}/5 videos
                </Tag>
              </div>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <Card
      title={
        <Space size={6} wrap>
          <Typography.Text strong style={{ fontSize: '14px' }}>
            Media
          </Typography.Text>
          {!hasVariants ? (
            <Tag
              color="blue"
              style={{ fontSize: '10px', padding: '0 6px', height: '20px', lineHeight: '20px' }}
            >
              Main: {mainImageList.length}/1
            </Tag>
          ) : null}
          {!hasVariants ? (
            <>
              <Tag
                style={{ fontSize: '10px', padding: '0 6px', height: '20px', lineHeight: '20px' }}
              >
                Images: {imagesList.length}
              </Tag>
              {handleVideosChange && (
                <Tag
                  style={{ fontSize: '10px', padding: '0 6px', height: '20px', lineHeight: '20px' }}
                >
                  Videos: {videosList?.length || 0}
                </Tag>
              )}
            </>
          ) : (
            <Tag style={{ fontSize: '10px', padding: '0 6px', height: '20px', lineHeight: '20px' }}>
              Variants: {variants.length}
            </Tag>
          )}
        </Space>
      }
      extra={
        !hasVariants ? (
          <Space size={4}>
            <Button
              size="small"
              onClick={() => handleMainImageChange({ fileList: [] })}
              style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
            >
              Clear Main
            </Button>
            <Button
              size="small"
              onClick={() => handleImagesChange({ fileList: [] })}
              style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
            >
              Clear Gallery
            </Button>
          </Space>
        ) : null
      }
      style={{ marginBottom: 12 }}
      bodyStyle={{ padding: '12px' }}
      size="small"
    >
      {hasVariants && variants.length > 0 ? (
        <div>
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: 4,
              marginBottom: 12,
              fontSize: '11px',
              color: '#B78115',
            }}
          >
            💡 Upload images and videos per variant. Use 'Copy to All' to duplicate media
          </div>

          {/* Recommended Dimensions & Limits Info for Variants */}
          <Alert
            message="Recommended Dimensions & Limits"
            description={
              <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                <div style={{ marginBottom: 4 }}>
                  <strong>Images:</strong> {RECOMMENDED_IMAGE_DIMENSIONS} | Max{' '}
                  {MAX_IMAGE_SIZE / (1024 * 1024)}MB per file | Up to 10 images per variant
                </div>
                <div>
                  <strong>Videos:</strong> {RECOMMENDED_VIDEO_DIMENSIONS} | Max{' '}
                  {MAX_VIDEO_SIZE / (1024 * 1024)}MB per file | Max {MAX_VIDEO_DURATION} seconds |
                  Up to 5 videos per variant
                </div>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 12, fontSize: '11px' }}
          />

          {/* Bulk Actions */}
          <div
            style={{
              marginBottom: 12,
              padding: '8px 10px',
              background: '#f5f5f5',
              borderRadius: 4,
            }}
          >
            <Space size={6}>
              <span style={{ fontWeight: 500, color: '#666', fontSize: '11px' }}>
                Bulk Actions:
              </span>
              <Button
                size="small"
                onClick={clearAllVariantMedia}
                style={{
                  color: '#ff4d4f',
                  borderColor: '#ff4d4f',
                  fontSize: '11px',
                  height: '24px',
                  padding: '0 8px',
                }}
              >
                Clear All Media
              </Button>
              <span style={{ fontSize: '10px', color: '#999' }}>
                💡 Use "Copy to All" button on any variant to copy its media to all other variants
              </span>
            </Space>
          </div>

          {/* Variant Media Table */}
          <Table
            key={variants.length}
            columns={variantColumns}
            dataSource={variants}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginBottom: 16 }}
          />

          {/* Removed default media settings for new variants as per requirements */}
        </div>
      ) : (
        <div>
          {/* Simple Product Media */}
          {/* Recommended Dimensions & Limits Info */}
          <Alert
            message="Recommended Dimensions & Limits"
            description={
              <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                <div style={{ marginBottom: 4 }}>
                  <strong>Images:</strong> {RECOMMENDED_IMAGE_DIMENSIONS} | Max{' '}
                  {MAX_IMAGE_SIZE / (1024 * 1024)}MB per file | Up to 10 images
                </div>
                <div>
                  <strong>Videos:</strong> {RECOMMENDED_VIDEO_DIMENSIONS} | Max{' '}
                  {MAX_VIDEO_SIZE / (1024 * 1024)}MB per file | Max {MAX_VIDEO_DURATION} seconds |
                  Up to 5 videos
                </div>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16, fontSize: '11px' }}
          />
          <div style={{ marginBottom: 0 }}>
            <Space size={12} direction="vertical" style={{ width: '100%' }}>
              <Space size={12} style={{ width: '100%' }} align="start">
                {/* Main Image */}
                <div style={{ width: 280 }}>
                  <Typography.Title level={5} style={{ marginBottom: 6, fontSize: '13px' }}>
                    Main Image *
                  </Typography.Title>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginBottom: 10, fontSize: '11px' }}
                  >
                    This is the primary image customers see first.
                  </Typography.Paragraph>
                  <Upload
                    name="mainImage"
                    listType="picture-card"
                    fileList={mainImageList}
                    customRequest={(options) => uploadViaPresign(options, 'product')}
                    onChange={(info) => {
                      const previousRemote = getRemoteUrl(mainImageList[0])
                      const nextFile = info.fileList[0]
                      const nextRemote = getRemoteUrl(nextFile)
                      if (
                        previousRemote &&
                        isNewUpload(mainImageList[0]) &&
                        !nextRemote &&
                        nextFile &&
                        'originFileObj' in nextFile
                      ) {
                        ;(nextFile as { __replaceUrl?: string }).__replaceUrl = previousRemote
                      }
                      handleMainImageChange(info)
                    }}
                    beforeUpload={(file) => {
                      if (!validateImageFile(file)) {
                        return Upload.LIST_IGNORE
                      }
                      return true
                    }}
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
                    maxCount={1}
                    showUploadList={{
                      showPreviewIcon: true,
                      showRemoveIcon: true,
                      showDownloadIcon: false,
                    }}
                  >
                    {mainImageList.length >= 1 ? null : (
                      <div>
                        <UploadOutlined style={{ fontSize: 24, color: '#B78115' }} />
                        <Typography.Paragraph style={{ marginBottom: 4 }}>
                          Upload main image
                        </Typography.Paragraph>
                      </div>
                    )}
                  </Upload>
                </div>

                {/* Gallery Images */}
                <div style={{ flex: 1 }}>
                  <Typography.Title level={5} style={{ marginBottom: 6, fontSize: '13px' }}>
                    Gallery Images
                  </Typography.Title>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginBottom: 10, fontSize: '11px' }}
                  >
                    Add more images to showcase your product from different angles.
                  </Typography.Paragraph>
                  <Upload
                    name="images"
                    listType="picture-card"
                    fileList={imagesList}
                    customRequest={(options) => uploadViaPresign(options, 'product')}
                    onChange={(info) => {
                      void deleteRemovedMedia(imagesList, info.fileList)
                      handleImagesChange(info)
                    }}
                    beforeUpload={(file) => {
                      if (!validateImageFile(file)) {
                        return Upload.LIST_IGNORE
                      }
                      return true
                    }}
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
                    multiple
                    maxCount={10}
                    showUploadList={{
                      showPreviewIcon: true,
                      showRemoveIcon: true,
                      showDownloadIcon: false,
                    }}
                  >
                    {imagesList.length < 10 && (
                      <div>
                        <UploadOutlined style={{ fontSize: 20, color: '#B78115' }} />
                        <div style={{ marginTop: 4 }}>Upload</div>
                      </div>
                    )}
                  </Upload>
                  {imagesList && imagesList.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Space size={6} wrap>
                        <Tag
                          color="processing"
                          style={{
                            fontSize: '10px',
                            padding: '0 6px',
                            height: '20px',
                            lineHeight: '20px',
                          }}
                        >
                          {imagesList.length}/10 images
                        </Tag>
                        <Button
                          size="small"
                          onClick={() => handleImagesChange({ fileList: [] })}
                          style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                        >
                          Clear All
                        </Button>
                      </Space>
                    </div>
                  )}
                </div>
              </Space>

              {/* Videos Section */}
              {handleVideosChange && (
                <div style={{ width: '100%', marginTop: 16 }}>
                  <Typography.Title level={5} style={{ marginBottom: 6, fontSize: '13px' }}>
                    Product Videos
                  </Typography.Title>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginBottom: 10, fontSize: '11px' }}
                  >
                    Add videos to showcase your product in action. Recommended: MP4 format,{' '}
                    {RECOMMENDED_VIDEO_DIMENSIONS}.
                  </Typography.Paragraph>
                  <Upload
                    name="videos"
                    listType="picture-card"
                    fileList={videosList}
                    customRequest={(options) => uploadViaPresign(options, 'product')}
                    onChange={(info) => {
                      void deleteRemovedMedia(videosList, info.fileList)
                      handleVideosChange(info)
                    }}
                    beforeUpload={(file) => {
                      if (!validateVideoFile(file)) {
                        return Upload.LIST_IGNORE
                      }
                      return true
                    }}
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/avi,video/x-matroska,video/3gpp,.mp4,.webm,.mov,.avi,.mkv,.3gp"
                    multiple
                    maxCount={5}
                    iconRender={() => (
                      <VideoCameraOutlined style={{ fontSize: 24, color: '#B78115' }} />
                    )}
                    showUploadList={{
                      showPreviewIcon: true,
                      showRemoveIcon: true,
                      showDownloadIcon: false,
                    }}
                  >
                    {videosList.length < 5 && (
                      <div>
                        <VideoCameraOutlined style={{ fontSize: 24, color: '#B78115' }} />
                        <div style={{ marginTop: 4, fontSize: '11px' }}>Upload Video</div>
                      </div>
                    )}
                  </Upload>
                  {videosList && videosList.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Space size={6} wrap>
                        <Tag
                          color="purple"
                          style={{
                            fontSize: '10px',
                            padding: '0 6px',
                            height: '20px',
                            lineHeight: '20px',
                          }}
                        >
                          {videosList.length}/5 videos
                        </Tag>
                        <Button
                          size="small"
                          onClick={() => handleVideosChange({ fileList: [] })}
                          style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                        >
                          Clear All
                        </Button>
                      </Space>
                    </div>
                  )}
                </div>
              )}
            </Space>
          </div>
        </div>
      )}
    </Card>
  )
}

export default MediaTab
