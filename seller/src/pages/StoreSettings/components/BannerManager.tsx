import {
  DeleteOutlined,
  DownOutlined,
  PictureOutlined,
  UpOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Typography,
  Upload,
} from 'antd'
import type { UploadFile } from 'antd'
import { useEffect, useState } from 'react'
import { getActiveCategories, type Category } from '../../../api/categories'
import type { StoreBanner } from '../../../api/store'

const { Title, Text } = Typography

interface BannerWithFile extends StoreBanner {
  file?: File
  tempId?: string
}

interface BannerManagerProps {
  value?: StoreBanner[]
  onChange?: (banners: StoreBanner[]) => void
  onBannersWithFilesChange?: (banners: BannerWithFile[]) => void
  videoUrl?: string
  videoFile?: UploadFile | null
  onVideoUrlChange?: (url: string) => void
  onVideoFileChange?: (file: UploadFile | null) => void
}

const BannerManager = ({
  value = [],
  onChange,
  onBannersWithFilesChange,
  videoUrl = '',
  videoFile = null,
  onVideoUrlChange,
  onVideoFileChange,
}: BannerManagerProps) => {
  const { message } = App.useApp()
  const [banners, setBanners] = useState<BannerWithFile[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [videoInputMode, setVideoInputMode] = useState<'url' | 'upload'>(videoFile ? 'upload' : 'url')

  const stripBannerFile = (banner: BannerWithFile): StoreBanner => {
    const { file, tempId, ...rest } = banner
    void file
    void tempId
    return rest
  }

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true)
      try {
        const cats = await getActiveCategories()
        setCategories(cats)
      } catch (err) {
        console.error('Error loading categories:', err)
        message.error('Failed to load categories')
      } finally {
        setLoadingCategories(false)
      }
    }
    loadCategories()
  }, [message])

  // Sync with value prop when it changes (especially when data loads from API)
  useEffect(() => {
    // Only sync if value actually has banners
    if (value && value.length > 0) {
      // Update banners, preserving any file references if imageUrl matches
      setBanners((prevBanners) => {
        // Check if the value is actually different from current state
        const prevImageUrls = prevBanners.map((b) => b.imageUrl).filter(Boolean).sort().join(',')
        const newImageUrls = value.map((b) => b.imageUrl).filter(Boolean).sort().join(',')
        
        // Only update if different
        if (prevImageUrls !== newImageUrls) {
          return value.map((banner) => {
            const existingBanner = prevBanners.find((b) => b.imageUrl === banner.imageUrl)
            return {
              ...banner,
              file: existingBanner?.file, // Preserve file if imageUrl matches
            }
          })
        }
        return prevBanners // No change needed
      })
    } else if (value && value.length === 0) {
      // Clear banners if value is empty
      setBanners([])
    }
  }, [value]) // Sync whenever value changes

  // Update video input mode when videoFile or videoUrl changes externally
  useEffect(() => {
    if (videoFile) {
      setVideoInputMode('upload')
    } else if (videoUrl) {
      setVideoInputMode('url')
    }
  }, [videoFile, videoUrl])

  const handleAddBanner = () => {
    const newBanner: BannerWithFile = {
      imageUrl: '',
      category: undefined,
      order: banners.length,
      gridSpan: 4,
      tempId: `temp-${Date.now()}`,
    }
    const updatedBanners = [...banners, newBanner]
    setBanners(updatedBanners)
    // Call both callbacks to ensure parent state updates
    const bannersWithoutFiles = updatedBanners.map(stripBannerFile)
    onChange?.(bannersWithoutFiles)
    onBannersWithFilesChange?.(updatedBanners)
    console.log('Added banner:', newBanner, 'Total banners:', updatedBanners.length)
  }

  const handleRemoveBanner = (index: number) => {
    const updatedBanners = banners.filter((_, i) => i !== index)
    // Reorder remaining banners
    const reorderedBanners = updatedBanners.map((banner, i) => ({
      ...banner,
      order: i,
    }))
    setBanners(reorderedBanners)
    onChange?.(reorderedBanners.map(stripBannerFile))
    onBannersWithFilesChange?.(reorderedBanners)
  }

  // Group banners into rows (each row should total 12 columns)
  const groupBannersIntoRows = (bannersList: typeof banners): Array<Array<{ banner: typeof banners[0]; index: number }>> => {
    const rows: Array<Array<{ banner: typeof banners[0]; index: number }>> = []
    let currentRow: Array<{ banner: typeof banners[0]; index: number }> = []
    let currentRowTotal = 0

    bannersList.forEach((banner, i) => {
      const gridSpan = banner.gridSpan || 1
      
      if (currentRowTotal + gridSpan > 12) {
        // Start a new row
        rows.push(currentRow)
        currentRow = [{ banner, index: i }]
        currentRowTotal = gridSpan
      } else {
        // Add to current row
        currentRow.push({ banner, index: i })
        currentRowTotal += gridSpan
      }
    })

    // Add the last row
    if (currentRow.length > 0) {
      rows.push(currentRow)
    }

    return rows
  }

  const validateGridSpan = (index: number, newGridSpan: number): { valid: boolean; message?: string } => {
    // Check if grid span is within valid range
    if (newGridSpan < 1 || newGridSpan > 12) {
      return {
        valid: false,
        message: 'Grid span must be between 1 and 12 columns.',
      }
    }

    // Check if grid span is not a decimal
    if (!Number.isInteger(newGridSpan)) {
      return {
        valid: false,
        message: 'Grid span must be a whole number.',
      }
    }

    // Create a temporary banners array with the new grid span
    const tempBanners = banners.map((banner, i) => ({
      ...banner,
      gridSpan: i === index ? newGridSpan : (banner.gridSpan || 1),
    }))

    // Group banners into rows
    const rows = groupBannersIntoRows(tempBanners)

    // Find which row the current banner belongs to
    let currentBannerRow: Array<{ banner: typeof banners[0]; index: number }> | null = null
    for (const row of rows) {
      if (row.some(item => item.index === index)) {
        currentBannerRow = row
        break
      }
    }

    if (currentBannerRow) {
      // Calculate total for the row containing this banner
      const rowTotal = currentBannerRow.reduce((sum, item) => {
        if (item.index === index) {
          return sum + newGridSpan
        }
        return sum + (item.banner.gridSpan || 1)
      }, 0)

      if (rowTotal > 12) {
        return {
          valid: false,
          message: `This would make the row total ${rowTotal} columns. Each row must total exactly 12 columns.`,
        }
      }

      if (rowTotal < 12) {
        return {
          valid: false,
          message: `This would make the row total ${rowTotal} columns. Each row must total exactly 12 columns.`,
        }
      }
    }

    return { valid: true }
  }

  const handleBannerChange = <K extends keyof StoreBanner>(
    index: number,
    field: K,
    newValue: StoreBanner[K],
    showToasts = false,
  ) => {
    // Validate grid span if it's being changed
    if (field === 'gridSpan' && showToasts) {
      const validation = validateGridSpan(index, newValue as number)
      if (!validation.valid) {
        message.error(validation.message || 'Invalid grid span value.')
        return
      }
      if (validation.message) {
        message.warning(validation.message, 4)
      }
    }

    const updatedBanners = [...banners]
    // Allow null temporarily for gridSpan to allow deletion while typing
    updatedBanners[index] = { ...updatedBanners[index], [field]: newValue }
    setBanners(updatedBanners)
    // When calling onChange, ensure gridSpan has a valid value (default to 1 if null/0)
    const bannersForParent = updatedBanners.map((banner) => ({
      ...stripBannerFile(banner),
      gridSpan:
        banner.gridSpan === null || banner.gridSpan === undefined || banner.gridSpan === 0
          ? 1
          : banner.gridSpan,
    }))
    onChange?.(bannersForParent)
    onBannersWithFilesChange?.(updatedBanners)
  }

  // Calculate recommended width based on grid span
  const getRecommendedWidth = (gridSpan: number | null | undefined): number => {
    // Default to 4 if gridSpan is null/undefined
    const span = gridSpan && gridSpan >= 1 && gridSpan <= 12 ? gridSpan : 4
    // Max container width: 1600px, padding: 32px (16px each side), gap: 16px
    // Available width: 1600 - 32 = 1568px
    // Each column = 1568 / 12 ≈ 130.67px
    const containerWidth = 1600
    const padding = 32
    const gap = 16
    const availableWidth = containerWidth - padding
    const columnWidth = availableWidth / 12
    const bannerWidth = columnWidth * span - (gap * (span - 1))
    return Math.round(bannerWidth)
  }

  const handleBannerUpload = (index: number, file: File) => {
    // Validate image dimensions
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    
    img.onload = () => {
      const recommendedWidth = getRecommendedWidth(banners[index]?.gridSpan || 4)
      const recommendedHeight = 500
      const width = img.width
      const height = img.height

      // Check if dimensions are close to recommended (allow 10% tolerance)
      const widthTolerance = recommendedWidth * 0.1
      const heightTolerance = recommendedHeight * 0.1
      
      const widthMatch = Math.abs(width - recommendedWidth) <= widthTolerance
      const heightMatch = Math.abs(height - recommendedHeight) <= heightTolerance

      if (!widthMatch || !heightMatch) {
        message.warning(
          `Recommended dimensions for grid span ${banners[index]?.gridSpan || 4}: ${recommendedWidth}px × 500px. ` +
          `Your image is ${width}px × ${height}px. The image may be cropped or not fill the space properly.`,
          5
        )
      }

      // Clean up object URL
      URL.revokeObjectURL(objectUrl)

      const reader = new FileReader()
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string
        const updatedBanners = [...banners]
        updatedBanners[index] = {
          ...updatedBanners[index],
          imageUrl,
          file,
        }
        setBanners(updatedBanners)
        // Call onChange with the updated banners (without file reference)
        onChange?.(updatedBanners.map(stripBannerFile))
        onBannersWithFilesChange?.(updatedBanners)
      }
      reader.readAsDataURL(file)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      message.error('Failed to load image. Please try another file.')
    }
    img.src = objectUrl
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const updatedBanners = [...banners]
    ;[updatedBanners[index], updatedBanners[index - 1]] = [
      updatedBanners[index - 1],
      updatedBanners[index],
    ]
    // Update orders
    updatedBanners.forEach((banner, i) => {
      banner.order = i
    })
    setBanners(updatedBanners)
    onChange?.(updatedBanners.map(stripBannerFile))
    onBannersWithFilesChange?.(updatedBanners)
  }

  const handleMoveDown = (index: number) => {
    if (index === banners.length - 1) return
    const updatedBanners = [...banners]
    ;[updatedBanners[index], updatedBanners[index + 1]] = [
      updatedBanners[index + 1],
      updatedBanners[index],
    ]
    // Update orders
    updatedBanners.forEach((banner, i) => {
      banner.order = i
    })
    setBanners(updatedBanners)
    onChange?.(updatedBanners.map(stripBannerFile))
    onBannersWithFilesChange?.(updatedBanners)
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={5}>Store Banners</Title>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
          Add multiple banners with different categories. Set the order and grid span (1-12 columns)
          for each banner.
        </Text>
      </div>

      {banners.map((banner, index) => (
        <Card
          key={banner.tempId || index}
          size="small"
          title={
            <Space>
              <Text strong>Banner {index + 1}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                (Order: {banner.order}, Grid: {banner.gridSpan}/12)
              </Text>
            </Space>
          }
          extra={
            <Space>
              <Button
                type="text"
                size="small"
                icon={<UpOutlined />}
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                title="Move up"
              />
              <Button
                type="text"
                size="small"
                icon={<DownOutlined />}
                onClick={() => handleMoveDown(index)}
                disabled={index === banners.length - 1}
                title="Move down"
              />
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveBanner(index)}
                title="Remove banner"
              />
            </Space>
          }
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Banner Image" required>
                <Upload
                  listType="picture-card"
                  maxCount={1}
                  accept="image/*"
                  beforeUpload={(file) => {
                    const maxSize = 50 * 1024 * 1024 // 50MB
                    if (file.size > maxSize) {
                      message.error('File size exceeds 50MB. Please choose a smaller file.')
                      return false
                    }
                    handleBannerUpload(index, file)
                    return false
                  }}
                  fileList={
                    banner.imageUrl
                      ? [
                          {
                            uid: `${index}`,
                            name: `banner-${index}`,
                            status: 'done',
                            url: banner.imageUrl,
                          } as UploadFile,
                        ]
                      : []
                  }
                  onRemove={() => {
                    handleBannerChange(index, 'imageUrl', '')
                  }}
                >
                  {!banner.imageUrl && (
                    <div>
                      <PictureOutlined />
                      <div style={{ marginTop: 8 }}>Upload</div>
                    </div>
                  )}
                </Upload>
                <Text 
                  type="secondary" 
                  style={{ fontSize: 12, display: 'block', marginTop: 8, color: '#1890ff' }}
                >
                  <strong>Recommended:</strong> {getRecommendedWidth(banner.gridSpan || 4)}px × 500px
                </Text>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  PNG or JPG (Max: 50MB). Images will be displayed at 500px height. Width should match your grid span to avoid cropping.
                </Text>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Form.Item label="Category (Optional)">
                  <Select
                    placeholder="Select category to link"
                    allowClear
                    loading={loadingCategories}
                    value={banner.category}
                    onChange={(value) => handleBannerChange(index, 'category', value)}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={categories.map((cat) => ({
                      value: cat._id,
                      label: cat.name,
                    }))}
                  />
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    Clicking this banner will filter products by this category
                  </Text>
                </Form.Item>
                <Form.Item 
                  label="Grid Span (1-12 columns)"
                  required
                  validateStatus={
                    banner.gridSpan && (banner.gridSpan < 1 || banner.gridSpan > 12)
                      ? 'error'
                      : undefined
                  }
                  help={
                    banner.gridSpan && (banner.gridSpan < 1 || banner.gridSpan > 12)
                      ? 'Grid span must be between 1 and 12'
                      : undefined
                  }
                >
                  <InputNumber
                    min={0}
                    max={12}
                    value={banner.gridSpan}
                    onChange={(value) => {
                      // Allow empty/null/0 values while typing - don't show toasts
                      // This allows users to delete the value completely
                      if (value === null || value === undefined || value === 0) {
                        handleBannerChange(index, 'gridSpan', 0, false)
                        return
                      }
                      
                      const numValue = Number(value)
                      
                      // Update value without showing toasts while typing
                      handleBannerChange(index, 'gridSpan', numValue, false)
                    }}
                    onBlur={() => {
                      const value = banner.gridSpan
                      // Validate on blur (when user finishes typing) - show toasts now
                      if (value === null || value === undefined || value === 0 || value < 1 || value > 12) {
                        const finalValue = 1
                        handleBannerChange(index, 'gridSpan', finalValue, false)
                        message.error('Grid span must be between 1 and 12 columns.')
                      } else if (!Number.isInteger(value)) {
                        const finalValue = Math.floor(value)
                        handleBannerChange(index, 'gridSpan', finalValue, false)
                        message.error('Grid span must be a whole number.')
                      } else {
                        // Validate row total equals 12
                        const validation = validateGridSpan(index, value)
                        if (!validation.valid) {
                          message.error(validation.message || 'Invalid grid span value.')
                          // Try to find a valid grid span that makes the row total 12
                          const rows = groupBannersIntoRows(banners)
                          let currentBannerRow: Array<{ banner: typeof banners[0]; index: number }> | null = null
                          for (const row of rows) {
                            if (row.some(item => item.index === index)) {
                              currentBannerRow = row
                              break
                            }
                          }
                          if (currentBannerRow) {
                            const otherBannersTotal = currentBannerRow
                              .filter(item => item.index !== index)
                              .reduce((sum, item) => sum + (item.banner.gridSpan || 1), 0)
                            const suggestedSpan = 12 - otherBannersTotal
                            if (suggestedSpan >= 1 && suggestedSpan <= 12) {
                              handleBannerChange(index, 'gridSpan', suggestedSpan, false)
                              message.info(`Row must total 12 columns. Set to ${suggestedSpan} columns.`, 4)
                            }
                          }
                        }
                      }
                    }}
                    parser={(value) => {
                      // Allow empty string
                      if (!value || value === '') return 0
                      // Remove any non-numeric characters and convert to number
                      const parsed = value?.replace(/[^\d]/g, '') || '0'
                      return Number.parseInt(parsed, 10) || 0
                    }}
                    formatter={(value) => {
                      // Allow empty display
                      if (value === null || value === undefined || (typeof value === 'number' && value === 0)) return ''
                      // Only show integer values
                      return Math.floor(Number(value)).toString()
                    }}
                    controls={true}
                    style={{ width: '100%' }}
                    status={
                      banner.gridSpan && banner.gridSpan !== null && (banner.gridSpan < 1 || banner.gridSpan > 12)
                        ? 'error'
                        : undefined
                    }
                  />
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    How many grid columns this banner takes (12 = full width, 6 = half, 4 = third,
                    etc.)
                  </Text>
                  {banner.gridSpan && banner.gridSpan >= 1 && banner.gridSpan <= 12 && (
                    <>
                      <Text 
                        type="secondary" 
                        style={{ fontSize: 11, display: 'block', marginTop: 4, color: '#1890ff' }}
                      >
                        Current grid span: {banner.gridSpan} → Recommended width: {getRecommendedWidth(banner.gridSpan)}px
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                        Valid range: 1-12 columns
                      </Text>
                    </>
                  )}
                </Form.Item>
              </Space>
            </Col>
          </Row>
        </Card>
      ))}

      <Button type="dashed" onClick={handleAddBanner} block icon={<PictureOutlined />}>
        Add Banner
      </Button>

      {/* Video Section */}
      <div style={{ marginTop: 24 }}>
        <Title level={5}>Store Introduction Video</Title>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
          Add a video introduction for your store. You can either provide a YouTube/Vimeo URL or upload a video file (not both).
        </Text>

        <Card size="small">
          <Radio.Group
            value={videoInputMode}
            onChange={(e) => {
              setVideoInputMode(e.target.value)
              // Clear the other option when switching modes
              if (e.target.value === 'url') {
                onVideoFileChange?.(null)
              } else {
                onVideoUrlChange?.('')
              }
            }}
            buttonStyle="solid"
            style={{ marginBottom: 16 }}
          >
            <Radio.Button value="url">Video URL</Radio.Button>
            <Radio.Button value="upload">Upload Video</Radio.Button>
          </Radio.Group>

          {videoInputMode === 'url' ? (
            <Form.Item label="Video URL (YouTube, Vimeo, etc.)">
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => {
                  onVideoUrlChange?.(e.target.value)
                  if (e.target.value) {
                    onVideoFileChange?.(null) // Clear file if URL is provided
                  }
                }}
                prefix={<VideoCameraOutlined />}
              />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                Provide a YouTube or Vimeo video URL
              </Text>
            </Form.Item>
          ) : (
            <Form.Item label="Upload Video File">
              <Upload
                maxCount={1}
                accept="video/*"
                beforeUpload={(file) => {
                  const maxSize = 500 * 1024 * 1024 // 500MB
                  if (file.size > maxSize) {
                    message.error('File size exceeds 500MB. Please choose a smaller file.')
                    return false
                  }
                  const uploadFile: UploadFile = {
                    uid: file.uid,
                    name: file.name,
                    status: 'done',
                    originFileObj: file,
                  }
                  onVideoFileChange?.(uploadFile)
                  onVideoUrlChange?.('') // Clear URL if file is uploaded
                  return false
                }}
                fileList={videoFile ? [videoFile] : []}
                onRemove={() => {
                  onVideoFileChange?.(null)
                }}
              >
                <Button icon={<VideoCameraOutlined />}>Upload Video</Button>
              </Upload>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                Max: 500MB (MP4, WebM, OGG, etc.)
              </Text>
            </Form.Item>
          )}
        </Card>
      </div>
    </Space>
  )
}

export default BannerManager

