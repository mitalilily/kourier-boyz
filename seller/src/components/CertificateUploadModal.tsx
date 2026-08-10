import { UploadOutlined } from '@ant-design/icons'
import { Alert, Button, DatePicker, Form, Input, Modal, Select, Upload, message } from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useEffect, useMemo, useState } from 'react'
import type { CertificateType } from '../api/categories'
import { useCertificateTypes, useMyCertificates, useUploadCertificate } from '../api/certificates'

interface CertificateUploadModalProps {
  open: boolean
  onClose: () => void
  requiredCertificates?: CertificateType[]
  forcedCertificates?: CertificateType[]
  inheritedCertificates?: CertificateType[]
  initialCertificateType?: CertificateType
  lockCertificateType?: boolean
  onUploaded?: () => void
}

const CertificateUploadModal = ({
  open,
  onClose,
  requiredCertificates,
  forcedCertificates,
  inheritedCertificates,
  initialCertificateType,
  lockCertificateType = false,
  onUploaded,
}: CertificateUploadModalProps) => {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const { data: certificateTypes } = useCertificateTypes()
  const { data: myCertificates } = useMyCertificates()
  const uploadCertificate = useUploadCertificate()

  const handleUpload = async () => {
    try {
      const values = await form.validateFields()
      if (!fileList[0]?.originFileObj) {
        message.error('Please select a certificate document')
        return
      }

      await uploadCertificate.mutateAsync({
        certificateType: values.certificateType,
        certificateNumber: values.certificateNumber,
        // If expiryDate is not selected, send undefined to clear it (for reuploads)
        expiryDate: values.expiryDate ? values.expiryDate.toISOString() : undefined,
        document: fileList[0].originFileObj,
      })

      message.success('Certificate uploaded successfully! It will be reviewed by admin.')
      form.resetFields()
      setFileList([])
      onUploaded?.()
      onClose()
    } catch (error) {
      console.error('Error uploading certificate:', error)
    }
  }

  const now = new Date()

  const normalizedRequired = requiredCertificates ?? []
  const forcedList = useMemo(
    () => (forcedCertificates ? [...forcedCertificates] : []),
    [forcedCertificates],
  )
  const allCertificateTypeValues =
    certificateTypes?.map((type) => type.value as CertificateType) ?? []

  const effectiveTargets =
    forcedList.length > 0 || normalizedRequired.length > 0
      ? Array.from(new Set<CertificateType>([...forcedList, ...normalizedRequired]))
      : allCertificateTypeValues

  const actionableCertificates = effectiveTargets.filter((reqCert) => {
    if (forcedList.includes(reqCert)) {
      return true
    }
    const cert = myCertificates?.find((existing) => existing.certificateType === reqCert)
    if (!cert) return true
    if (cert.status !== 'approved') return true
    if (cert.expiryDate && new Date(cert.expiryDate) <= now) return true
    return false
  })

  const availableTypes = certificateTypes?.filter((type) => {
    if (lockCertificateType && forcedList.length > 0) {
      return forcedList.includes(type.value as CertificateType)
    }
    if (effectiveTargets.length === 0) {
      return true
    }
    return effectiveTargets.includes(type.value as CertificateType)
  })

  const selectOptions = useMemo(() => {
    if (availableTypes && availableTypes.length > 0) {
      return availableTypes
    }
    return (
      certificateTypes?.filter((type) =>
        lockCertificateType && forcedList.length > 0
          ? forcedList.includes(type.value as CertificateType)
          : true,
      ) ?? []
    )
  }, [availableTypes, certificateTypes, lockCertificateType, forcedList])

  const firstSelectableOption = useMemo(
    () => (selectOptions.length === 1 ? selectOptions[0]?.value : undefined),
    [selectOptions],
  )

  const singleForcedValue = useMemo(
    () => (forcedList.length === 1 ? forcedList[0] : undefined),
    [forcedList],
  )

  const shouldDisableUpload =
    !lockCertificateType && effectiveTargets.length > 0 && actionableCertificates.length === 0

  const modalTitle =
    forcedList.length > 0 && lockCertificateType
      ? 'Update Certificate'
      : 'Upload Required Certificate'

  useEffect(() => {
    if (!open) {
      form.resetFields()
      setFileList([])
      return
    }

    if (initialCertificateType) {
      form.setFieldsValue({ certificateType: initialCertificateType })
      return
    }

    if (lockCertificateType && singleForcedValue) {
      form.setFieldsValue({ certificateType: singleForcedValue })
      return
    }

    const currentValue = form.getFieldValue('certificateType')
    if (!currentValue && firstSelectableOption) {
      form.setFieldsValue({ certificateType: firstSelectableOption })
    }
  }, [
    open,
    initialCertificateType,
    lockCertificateType,
    singleForcedValue,
    firstSelectableOption,
    form,
  ])

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onClose}
      onOk={handleUpload}
      okText="Upload"
      okButtonProps={{
        loading: uploadCertificate.isPending,
        disabled: shouldDisableUpload,
      }}
      width={600}
    >
      <Form form={form} layout="vertical">
        {inheritedCertificates && inheritedCertificates.length > 0 && (
          <Form.Item>
            <Alert
              type="info"
              message="Note"
              description="This category inherits some certificate requirements from its parent. Uploading here will satisfy all inherited requirements as well."
              showIcon
            />
          </Form.Item>
        )}

        {shouldDisableUpload && (
          <Form.Item>
            <Alert
              type="success"
              message="All certificates approved"
              description="All required certificates for this category are already approved. No further uploads are necessary."
              showIcon
            />
          </Form.Item>
        )}

        <Form.Item
          name="certificateType"
          label="Certificate Type"
          rules={[{ required: true, message: 'Please select certificate type' }]}
        >
          <Select
            placeholder="Select certificate type"
            disabled={lockCertificateType || shouldDisableUpload}
          >
            {selectOptions.map((type) => (
              <Select.Option key={type.value} value={type.value}>
                {type.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="certificateNumber" label="Certificate Number (Optional)">
          <Input placeholder="Enter certificate number if available" />
        </Form.Item>

        <Form.Item name="expiryDate" label="Expiry Date (Optional)">
          <DatePicker style={{ width: '100%' }} placeholder="Select expiry date" />
        </Form.Item>

        <Form.Item
          label="Certificate Document"
          required
          rules={[{ required: true, message: 'Please upload certificate document' }]}
        >
          <Upload
            fileList={fileList}
            onChange={({ fileList }) => setFileList(fileList as UploadFile[])}
            beforeUpload={() => false}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
            maxCount={1}
            disabled={shouldDisableUpload}
          >
            <Button icon={<UploadOutlined />}>Select File</Button>
          </Upload>
          <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            Accepted formats: PDF, JPG, PNG, GIF, WebP (Max 10MB)
          </p>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default CertificateUploadModal
