import { UploadOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Radio,
  Upload,
  message,
} from 'antd'
import type { UploadFile } from 'antd'
import type { RadioChangeEvent } from 'antd'
import { useState } from 'react'
import { type DocumentType, useCreateBrand } from '../api/brandQueries'
import { useAuthStore } from '../store/authStore'

// Typography components not used in this component

interface BrandRequestModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const BrandRequestModal = ({ open, onClose, onSuccess }: BrandRequestModalProps) => {
  const [form] = Form.useForm()
  const [brandType, setBrandType] = useState<'OWN' | 'OTHER'>('OWN')
  const [fileList, setFileList] = useState<Record<DocumentType, UploadFile[]>>({
    TM_CERTIFICATE: [],
    TM_APPLICATION: [],
    SALE_INVOICE: [],
    AUTHORIZATION_LETTER: [],
  })
  const createBrand = useCreateBrand()
  const user = useAuthStore((state) => state.user)

  // Check if KYC is approved
  const isKycApproved =
    user?.kycStatus === 'APPROVED' || (user?.isApproved === true && user?.kycSubmitted === true)

  const handleBrandTypeChange = (e: RadioChangeEvent) => {
    setBrandType(e.target.value)
    // Clear file lists when switching types
    setFileList({
      TM_CERTIFICATE: [],
      TM_APPLICATION: [],
      SALE_INVOICE: [],
      AUTHORIZATION_LETTER: [],
    })
  }

  const handleFileChange = (documentType: DocumentType, fileList: UploadFile[]) => {
    setFileList((prev) => ({
      ...prev,
      [documentType]: fileList,
    }))
  }

  const handleSubmit = async () => {
    try {
      // Check KYC approval first
      if (!isKycApproved) {
        message.error('Please complete KYC verification before requesting brand approval.')
        return
      }

      const values = await form.validateFields()

      // Validate documents based on brand type
      if (brandType === 'OWN') {
        const hasRequiredDoc =
          fileList.TM_CERTIFICATE.length > 0 || fileList.TM_APPLICATION.length > 0
        if (!hasRequiredDoc) {
          message.error(
            'For OWN brands, at least one of the following is required: Trademark Registration Certificate or Trademark Application',
          )
          return
        }
      } else if (brandType === 'OTHER') {
        const missingDocs: string[] = []
        if (fileList.SALE_INVOICE.length === 0) missingDocs.push('Sale Invoice from Brand Owner')
        if (fileList.TM_CERTIFICATE.length === 0) missingDocs.push('Trademark Registration Certificate')
        if (fileList.AUTHORIZATION_LETTER.length === 0) missingDocs.push('Brand Authorization Letter')

        if (missingDocs.length > 0) {
          message.error(`For OTHER brands, all of the following are required: ${missingDocs.join(', ')}`)
          return
        }
      }

      // Prepare FormData with files
      const formData = new FormData()
      formData.append('brand_name', values.brand_name.trim())
      formData.append('brand_type', brandType)
      
      const documentTypes: string[] = []
      const files: File[] = []

      // Collect all files and their types
      for (const [docType, filesList] of Object.entries(fileList) as [DocumentType, UploadFile[]][]) {
        for (const file of filesList) {
          if (file.originFileObj) {
            files.push(file.originFileObj)
            documentTypes.push(docType)
          }
        }
      }

      // Append files and document types
      files.forEach((file) => {
        formData.append('files', file)
      })
      formData.append('document_types', documentTypes.join(','))

      // Create brand request with files
      await createBrand.mutateAsync(formData)
      
      form.resetFields()
      setFileList({
        TM_CERTIFICATE: [],
        TM_APPLICATION: [],
        SALE_INVOICE: [],
        AUTHORIZATION_LETTER: [],
      })
      setBrandType('OWN')
      onSuccess()
    } catch (error: unknown) {
      if ((error as { errorFields?: unknown })?.errorFields) {
        // Form validation errors
        return
      }
      console.error('Failed to create brand:', error)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setFileList({
      TM_CERTIFICATE: [],
      TM_APPLICATION: [],
      SALE_INVOICE: [],
      AUTHORIZATION_LETTER: [],
    })
    setBrandType('OWN')
    onClose()
  }

  return (
    <Modal
      title="Request Brand Approval"
      open={open}
      onCancel={handleCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={createBrand.isPending}
          onClick={handleSubmit}
          disabled={!isKycApproved}
        >
          Submit Request
        </Button>,
      ]}
    >
      {!isKycApproved && (
        <Alert
          type="warning"
          showIcon
          message="KYC Approval Required"
          description="Please complete your KYC verification before requesting brand approval."
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" type="link" href="/submit-kyc">
              Complete KYC
            </Button>
          }
        />
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          name="brand_name"
          label="Brand Name"
          rules={[{ required: true, message: 'Brand name is required' }]}
        >
          <Input placeholder="Enter brand name" />
        </Form.Item>

        <Form.Item
          name="brand_type"
          label="Brand Type"
          rules={[{ required: true, message: 'Brand type is required' }]}
        >
          <Radio.Group value={brandType} onChange={handleBrandTypeChange}>
            <Radio value="OWN">Own Brand</Radio>
            <Radio value="OTHER">Other Brand</Radio>
          </Radio.Group>
        </Form.Item>

        {brandType === 'OWN' && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Own Brand Requirements"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Trademark Registration Certificate</li>
                <li>Trademark Application / Registration Form</li>
              </ul>
            }
          />
        )}

        {brandType === 'OTHER' && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Other Brand Requirements"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Sale Invoice from Brand Owner</li>
                <li>Trademark Registration Certificate</li>
                <li>Brand Authorization Letter</li>
              </ul>
            }
          />
        )}

        {brandType === 'OWN' && (
          <>
            <Form.Item label="Trademark Registration Certificate">
              <Upload
                fileList={fileList.TM_CERTIFICATE}
                onChange={({ fileList }) => handleFileChange('TM_CERTIFICATE', fileList)}
                beforeUpload={() => false}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Upload</Button>
              </Upload>
            </Form.Item>

            <Form.Item label="Trademark Application / Registration Form">
              <Upload
                fileList={fileList.TM_APPLICATION}
                onChange={({ fileList }) => handleFileChange('TM_APPLICATION', fileList)}
                beforeUpload={() => false}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Upload</Button>
              </Upload>
            </Form.Item>
          </>
        )}

        {brandType === 'OTHER' && (
          <>
            <Form.Item
              label="Sale Invoice from Brand Owner"
              required
              tooltip="Required for OTHER brands"
            >
              <Upload
                fileList={fileList.SALE_INVOICE}
                onChange={({ fileList }) => handleFileChange('SALE_INVOICE', fileList)}
                beforeUpload={() => false}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Upload</Button>
              </Upload>
            </Form.Item>

            <Form.Item
              label="Trademark Registration Certificate"
              required
              tooltip="Required for OTHER brands"
            >
              <Upload
                fileList={fileList.TM_CERTIFICATE}
                onChange={({ fileList }) => handleFileChange('TM_CERTIFICATE', fileList)}
                beforeUpload={() => false}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Upload</Button>
              </Upload>
            </Form.Item>

            <Form.Item
              label="Brand Authorization Letter"
              required
              tooltip="Required for OTHER brands"
            >
              <Upload
                fileList={fileList.AUTHORIZATION_LETTER}
                onChange={({ fileList }) => handleFileChange('AUTHORIZATION_LETTER', fileList)}
                beforeUpload={() => false}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Upload</Button>
              </Upload>
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  )
}

export default BrandRequestModal

