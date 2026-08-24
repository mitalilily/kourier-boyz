import { ClearOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { Button, Card, Radio, Space, Upload } from 'antd'
import { useEffect, useRef, useState } from 'react'

interface SignaturePadProps {
  value?: string | File | null // Can be base64 string or File
  onChange?: (value: string | File | null) => void
  onClear?: () => void
}

const SignaturePad = ({ value, onChange, onClear }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw')
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([])

  // Detect if value is a URL and set appropriate mode
  useEffect(() => {
    if (
      typeof value === 'string' &&
      (value.startsWith('http://') || value.startsWith('https://'))
    ) {
      // If it's a URL from server, show in upload mode
      setSignatureMode('upload')
    }
  }, [value])

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    let x: number, y: number

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    let x: number, y: number

    if ('touches' in e) {
      e.preventDefault()
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    const canvas = canvasRef.current
    if (!canvas) return

    // Get the signature as base64
    const base64 = canvas.toDataURL('image/png')
    onChange?.(base64)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange?.(null)
    onClear?.()
  }

  // Load existing signature into upload file list if it's a URL
  useEffect(() => {
    if (
      typeof value === 'string' &&
      (value.startsWith('http://') || value.startsWith('https://'))
    ) {
      setUploadFileList([
        {
          uid: '-1',
          name: 'signature',
          status: 'done',
          url: value,
        },
      ])
    } else if (!value || (typeof value !== 'string' && !(value instanceof File))) {
      setUploadFileList([])
    } else if (value instanceof File) {
      // If it's a File object, add it to file list
      setUploadFileList([
        {
          uid: '-1',
          name: value.name || 'signature',
          status: 'done' as const,
          originFileObj: value,
        } as UploadFile,
      ])
    }
  }, [value])

  const handleUploadChange: UploadProps['onChange'] = (info) => {
    const fileList = info.fileList
    setUploadFileList(fileList)

    if (fileList.length > 0 && fileList[0].originFileObj) {
      onChange?.(fileList[0].originFileObj)
    } else if (fileList.length === 0) {
      onChange?.(null)
    }
  }

  const handleRemoveUpload = () => {
    setUploadFileList([])
    onChange?.(null)
  }

  // Initialize canvas and load existing signature
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = 600
    canvas.height = 200

    // Set drawing style
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Load existing signature if it's a base64 string or URL
    if (typeof value === 'string') {
      if (value.startsWith('data:image')) {
        // Base64 string
        const img = new Image()
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        }
        img.src = value
      } else if (value.startsWith('http://') || value.startsWith('https://')) {
        // URL - load from server
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        }
        img.src = value
      }
    } else if (!value) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [value])

  return (
    <div>
      <Radio.Group
        value={signatureMode}
        onChange={(e) => {
          setSignatureMode(e.target.value)
          if (e.target.value === 'draw') {
            setUploadFileList([])
          } else {
            clearSignature()
          }
        }}
        style={{ marginBottom: 16 }}
      >
        <Radio value="draw">Draw Signature</Radio>
        <Radio value="upload">Upload Signature</Radio>
      </Radio.Group>

      {signatureMode === 'draw' ? (
        <Card
          style={{
            border: '2px dashed #d9d9d9',
            borderRadius: 8,
            background: '#fafafa',
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{
              width: '100%',
              maxWidth: 600,
              height: 200,
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              cursor: 'crosshair',
              background: '#fff',
              touchAction: 'none',
            }}
          />
          <Space style={{ marginTop: 12 }}>
            <Button icon={<ClearOutlined />} onClick={clearSignature}>
              Clear
            </Button>
            <span style={{ fontSize: 12, color: '#666' }}>
              Sign in the box above using your mouse or touch screen
            </span>
          </Space>
          {typeof value === 'string' && value.startsWith('http') && (
            <div style={{ marginTop: 12, padding: 8, background: '#f0f0f0', borderRadius: 4 }}>
              <span style={{ fontSize: 12, color: '#666' }}>
                Existing signature loaded from server. Switch to "Upload Signature" mode to view.
              </span>
            </div>
          )}
        </Card>
      ) : (
        <Card
          style={{
            border: '2px dashed #d9d9d9',
            borderRadius: 8,
            background: '#fafafa',
          }}
        >
          <Upload
            fileList={uploadFileList}
            onChange={handleUploadChange}
            beforeUpload={() => false}
            maxCount={1}
            accept="image/*"
            listType="picture-card"
          >
            {uploadFileList.length === 0 && (
              <div>
                <UploadOutlined style={{ fontSize: 24, color: '#B78115' }} />
                <div style={{ marginTop: 8 }}>Upload Signature</div>
              </div>
            )}
          </Upload>
          {uploadFileList.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Button icon={<DeleteOutlined />} danger onClick={handleRemoveUpload} size="small">
                Remove Signature
              </Button>
            </div>
          )}
          <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
            Upload an image file of your signature (PNG, JPG, etc.)
          </div>
        </Card>
      )}
    </div>
  )
}

export default SignaturePad
