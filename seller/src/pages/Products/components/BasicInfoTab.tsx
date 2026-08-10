import { Alert, Card, Checkbox, Col, Form, Input, Row, Select, type FormInstance } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { Category } from '../../../api/categories'
import { useApprovedBrands } from '../../../api/brandQueries'
import { useMyCertificates } from '../../../api/certificates'
import { generateSku } from '../../../api/products'
import { useProfile } from '../../../api/profileQueries'
import CertificateRequirementAlert from '../../../components/CertificateRequirementAlert'
import CertificateUploadModal from '../../../components/CertificateUploadModal'
import HierarchicalCategorySelect from '../../../components/HierarchicalCategorySelect'
import { useAuthStore } from '../../../store/authStore'

const { TextArea } = Input
const { Option } = Select

// Allowed GST rates
const ALLOWED_GST_RATES = [0, 5, 12, 18, 28]

// Country of origin options (India first for local sellers, then alphabetical by country name)
const COUNTRY_OPTIONS = [
  'India',
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Ivory Coast',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
  'Other',
]

interface BasicInfoTabProps {
  form: FormInstance
  categories: Category[]
}

const BasicInfoTab = ({ form, categories }: BasicInfoTabProps) => {
  const [isGeneratingSku, setIsGeneratingSku] = useState(false)
  const { data: profile } = useProfile()
  const user = useAuthStore((state) => state.user)
  const isGstRegistered =
    profile && typeof profile === 'object' && 'gstNumber' in profile
      ? (profile as { gstNumber?: boolean }).gstNumber
      : false

  const hasVariants = !!form.getFieldValue('hasVariants')
  const isGstApplicable = Form.useWatch('isGstApplicable', form) || false
  const productStatus = Form.useWatch('status', form) || 'draft'
  const isDraft = productStatus === 'draft'

  // Brand state
  const { data: approvedBrands, isLoading: brandsLoading } = useApprovedBrands()
  const isKycApproved =
    user?.kycStatus === 'APPROVED' || (user?.isApproved === true && user?.kycSubmitted === true)

  // Certificate state
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>()
  const [certificateModalOpen, setCertificateModalOpen] = useState(false)
  const { data: sellerCertificates, refetch: refetchCertificates } = useMyCertificates()

  useEffect(() => {
    const initialCategoryId = form.getFieldValue('category') as string | undefined
    if (initialCategoryId) {
      setSelectedCategory(categories.find((cat) => cat._id === initialCategoryId) || undefined)
    }
  }, [categories, form])

  const handleCategoryChange = useCallback(
    (categoryId: string | undefined) => {
      // Update selected category state for certificate checking
      setSelectedCategory(
        categoryId ? categories.find((cat) => cat._id === categoryId) || undefined : undefined,
      )
    },
    [categories],
  )

  /**
   * Handle certificate upload success
   * Refreshes certificate list and keeps category selected
   */
  const handleCertificateUploaded = useCallback(async () => {
    await refetchCertificates()
    // Keep the category selected so user can continue
  }, [refetchCertificates])

  const effectiveCertificates =
    selectedCategory?.effectiveRequiredCertificates ?? selectedCategory?.requiredCertificates ?? []
  const inheritedCertificates = selectedCategory?.inheritedRequiredCertificates ?? []
  const inheritsParentRule = selectedCategory?.inheritsParentCertificateRule ?? false

  return (
    <>
      <Card
        title={<span style={{ fontSize: '14px', fontWeight: 600 }}>Basic Information</span>}
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '12px' }}
        size="small"
      >
        <Row gutter={[12, 8]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label={<span style={{ fontSize: '12px' }}>Product Name</span>}
              rules={[{ required: true, message: 'Please enter product name' }]}
              style={{ marginBottom: 12 }}
            >
              <Input
                size="small"
                placeholder="Enter product name"
                onBlur={async () => {
                  const nameVal = form.getFieldValue('name') as string
                  const skuVal = form.getFieldValue('sku') as string | undefined
                  const productId = form.getFieldValue('_id') as string | undefined

                  if (nameVal && !skuVal && !hasVariants) {
                    setIsGeneratingSku(true)
                    try {
                      const { sku } = await generateSku({
                        productName: nameVal,
                        productId,
                      })
                      form.setFieldsValue({ sku })
                    } catch (error) {
                      console.error('Failed to generate SKU:', error)
                    } finally {
                      setIsGeneratingSku(false)
                    }
                  }
                }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="sku"
              label={<span style={{ fontSize: '12px' }}>SKU</span>}
              extra={
                hasVariants ? (
                  <span style={{ fontSize: '11px' }}>
                    SKU is controlled by the default variant when variants are enabled.
                  </span>
                ) : undefined
              }
              style={{ marginBottom: 12 }}
            >
              <Input
                size="small"
                placeholder={
                  isGeneratingSku ? 'Generating SKU...' : 'Enter SKU (auto-generated if empty)'
                }
                disabled={hasVariants || isGeneratingSku}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="category"
              label={<span style={{ fontSize: '12px' }}>Category</span>}
              rules={[{ required: true, message: 'Please select category' }]}
              style={{ marginBottom: 12 }}
            >
              <HierarchicalCategorySelect
                categories={categories}
                placeholder="Select category"
                showSubcategories={true}
                size="small"
                onChange={(value) => {
                  const categoryId = value as string | undefined
                  // Update form field value first
                  form.setFieldValue('category', categoryId)
                  // Then update selected category for certificate checking
                  handleCategoryChange(categoryId)
                }}
              />
              {!isDraft && form.getFieldValue('brand_id') && (
                <Alert
                  type="info"
                  message="Category Approval"
                  description="The selected brand must be approved for this category. If not approved, a category extension request will be created automatically."
                  showIcon
                  style={{ marginTop: 8, fontSize: '11px' }}
                />
              )}
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            {!isKycApproved ? (
              <Form.Item
                label={<span style={{ fontSize: '12px' }}>Brand</span>}
                style={{ marginBottom: 12 }}
              >
                <Alert
                  type="warning"
                  message="Complete KYC to unlock brand approval and product listing."
                  showIcon
                  style={{ fontSize: '12px' }}
                />
              </Form.Item>
            ) : !approvedBrands || approvedBrands.length === 0 ? (
              <Form.Item
                label={<span style={{ fontSize: '12px' }}>Brand</span>}
                style={{ marginBottom: 12 }}
              >
                <Alert
                  type="info"
                  message="You need at least one approved brand to list products. Request brand approval."
                  showIcon
                  style={{ fontSize: '12px' }}
                  action={
                    <a href="/brands" style={{ fontSize: '12px' }}>
                      Go to Brands
                    </a>
                  }
                />
              </Form.Item>
            ) : (
              <Form.Item
                name="brand_id"
                label={
                  <span style={{ fontSize: '12px' }}>
                    Brand {!isDraft && <span style={{ color: '#ff4d4f' }}>*</span>}
                  </span>
                }
                rules={
                  !isDraft
                    ? [{ required: true, message: 'Brand is required for product listing' }]
                    : []
                }
                style={{ marginBottom: 12 }}
              >
                <Select
                  size="small"
                  placeholder="Select brand"
                  loading={brandsLoading}
                  showSearch
                  optionFilterProp="label"
                  options={approvedBrands.map((brand) => ({
                    value: brand._id,
                    label: brand.brand_name,
                  }))}
                />
              </Form.Item>
            )}
          </Col>

          <Col xs={24}>
            <Form.Item
              name="description"
              label={<span style={{ fontSize: '12px' }}>Description</span>}
              rules={[{ required: true, message: 'Please enter description' }]}
              style={{ marginBottom: 12 }}
            >
              <TextArea rows={3} size="small" placeholder="Enter detailed product description" />
            </Form.Item>
          </Col>

          <Col xs={24}>
            <Form.Item
              name="shortDescription"
              label={<span style={{ fontSize: '12px' }}>Short Description</span>}
              style={{ marginBottom: 0 }}
            >
              <TextArea rows={2} size="small" placeholder="Enter short description (optional)" />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* GST/HSN Section - Only show if seller is GST registered */}
      {isGstRegistered && !hasVariants ? (
        <Card
          title={
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              GST/HSN Information <span style={{ color: '#ff4d4f' }}>*</span>
            </span>
          }
          style={{ marginBottom: 12 }}
          bodyStyle={{ padding: '12px' }}
          size="small"
        >
          <Row gutter={[12, 8]}>
            <Col xs={24}>
              <Form.Item
                name="isGstApplicable"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
                tooltip="Enable this if GST is applicable to this product. When enabled, GST will be included in the effective price (inclusive pricing)."
              >
                <Checkbox>
                  <span style={{ fontSize: '12px' }}>Is GST Applicable</span>
                </Checkbox>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="hsnSacCode"
                label={
                  <span style={{ fontSize: '12px' }}>
                    HSN/SAC Code <span style={{ color: '#ff4d4f' }}>*</span>
                  </span>
                }
                rules={[
                  {
                    validator: (_, value) => {
                      // If GST is not applicable, skip validation entirely
                      if (!isGstApplicable) {
                        return Promise.resolve()
                      }
                      if (!value || typeof value !== 'string' || value.trim().length === 0) {
                        return Promise.reject(
                          new Error('HSN Code is required for simple products.'),
                        )
                      }
                      if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(value)) {
                        return Promise.reject(new Error('HSN Code must be 4, 6, or 8 digits.'))
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
                style={{ marginBottom: 12 }}
                tooltip="Harmonized System of Nomenclature (HSN) or Service Accounting Code (SAC). Must be numeric and 4, 6, or 8 digits."
              >
                <Input
                  size="small"
                  placeholder="e.g., 8517"
                  maxLength={8}
                  disabled={!isGstApplicable}
                  onKeyPress={(e) => {
                    if (!/[0-9]/.test(e.key)) {
                      e.preventDefault()
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="igstRatePercent"
                label={
                  <span style={{ fontSize: '12px' }}>
                    IGST Rate (%) <span style={{ color: '#ff4d4f' }}>*</span>
                  </span>
                }
                rules={[
                  {
                    validator: (_, value) => {
                      if (!isGstApplicable) {
                        return Promise.resolve()
                      }
                      if (value === undefined || value === null) {
                        return Promise.reject(
                          new Error('IGST Rate is required when GST is applicable.'),
                        )
                      }
                      if (!ALLOWED_GST_RATES.includes(value)) {
                        return Promise.reject(new Error('IGST Rate must be 0, 5, 12, 18, or 28.'))
                      }
                      // Auto-calculate CGST and SGST as half of IGST
                      const cgst = value / 2
                      const sgst = value / 2
                      form.setFieldsValue({
                        cgstRatePercent: cgst,
                        sgstRatePercent: sgst,
                      })
                      return Promise.resolve()
                    },
                  },
                ]}
                style={{ marginBottom: 12 }}
                tooltip="Integrated GST rate. CGST and SGST will be auto-calculated as half of this rate."
              >
                <Select size="small" placeholder="Select IGST rate" disabled={!isGstApplicable}>
                  {ALLOWED_GST_RATES.map((rate) => (
                    <Option key={rate} value={rate}>
                      {rate}%
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="cgstRatePercent"
                label={
                  <span style={{ fontSize: '12px' }}>
                    CGST Rate (%) <span style={{ color: '#ff4d4f' }}>*</span>
                  </span>
                }
                rules={[
                  {
                    validator: (_, value) => {
                      if (!isGstApplicable) {
                        return Promise.resolve()
                      }
                      if (value === undefined || value === null || value === '') {
                        return Promise.reject(
                          new Error('CGST Rate is required when GST is applicable.'),
                        )
                      }
                      const numValue = typeof value === 'string' ? parseFloat(value) : value

                      // Validate that CGST + SGST = IGST
                      const sgst = form.getFieldValue('sgstRatePercent')
                      const igst = form.getFieldValue('igstRatePercent')
                      const sgstNum = typeof sgst === 'string' ? parseFloat(sgst) : sgst
                      const igstNum = typeof igst === 'string' ? parseFloat(igst) : igst
                      if (
                        sgstNum !== undefined &&
                        sgstNum !== null &&
                        !isNaN(sgstNum) &&
                        igstNum !== undefined &&
                        igstNum !== null &&
                        !isNaN(igstNum) &&
                        numValue + sgstNum !== igstNum
                      ) {
                        return Promise.reject(
                          new Error(
                            `CGST + SGST (${numValue + sgstNum}%) must equal IGST (${igstNum}%).`,
                          ),
                        )
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
                style={{ marginBottom: 12 }}
                tooltip="Central GST rate. Must be half of IGST. You can edit this, but CGST + SGST must equal IGST."
              >
                <Input
                  size="small"
                  type="number"
                  placeholder="Enter CGST rate"
                  disabled={!isGstApplicable}
                  suffix="%"
                  min={0}
                  max={28}
                  step={0.01}
                  onKeyPress={(e) => {
                    if (!/[0-9.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                      e.preventDefault()
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="sgstRatePercent"
                label={
                  <span style={{ fontSize: '12px' }}>
                    SGST Rate (%) <span style={{ color: '#ff4d4f' }}>*</span>
                  </span>
                }
                rules={[
                  {
                    validator: (_, value) => {
                      if (!isGstApplicable) {
                        return Promise.resolve()
                      }
                      if (value === undefined || value === null || value === '') {
                        return Promise.reject(
                          new Error('SGST Rate is required when GST is applicable.'),
                        )
                      }
                      const numValue = typeof value === 'string' ? parseFloat(value) : value
                      if (isNaN(numValue)) {
                        return Promise.reject(new Error('SGST Rate must be a valid number.'))
                      }
                      // Validate that CGST + SGST = IGST
                      const cgst = form.getFieldValue('cgstRatePercent')
                      const igst = form.getFieldValue('igstRatePercent')
                      const cgstNum = typeof cgst === 'string' ? parseFloat(cgst) : cgst
                      const igstNum = typeof igst === 'string' ? parseFloat(igst) : igst
                      if (
                        cgstNum !== undefined &&
                        cgstNum !== null &&
                        !isNaN(cgstNum) &&
                        igstNum !== undefined &&
                        igstNum !== null &&
                        !isNaN(igstNum) &&
                        cgstNum + numValue !== igstNum
                      ) {
                        return Promise.reject(
                          new Error(
                            `CGST + SGST (${cgstNum + numValue}%) must equal IGST (${igstNum}%).`,
                          ),
                        )
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
                style={{ marginBottom: 0 }}
                tooltip="State GST rate. Must be half of IGST. You can edit this, but CGST + SGST must equal IGST."
              >
                <Input
                  size="small"
                  type="number"
                  placeholder="Enter SGST rate"
                  disabled={!isGstApplicable}
                  suffix="%"
                  min={0}
                  max={28}
                  step={0.01}
                  onKeyPress={(e) => {
                    if (!/[0-9.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                      e.preventDefault()
                    }
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      ) : isGstRegistered && hasVariants ? (
        <Card
          title={
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              Default GST/HSN (Optional - Can be added at variant level)
            </span>
          }
          style={{ marginBottom: 12 }}
          bodyStyle={{ padding: '12px' }}
          size="small"
        >
          <Row gutter={[12, 8]}>
            <Col xs={24}>
              <Form.Item
                name="isGstApplicable"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
                tooltip="Enable this if GST is applicable to variants. When enabled, GST will be included in the effective price (inclusive pricing)."
              >
                <Checkbox>
                  <span style={{ fontSize: '12px' }}>Is GST Applicable</span>
                </Checkbox>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="defaultHsnSacCode"
                label={<span style={{ fontSize: '12px' }}>Default HSN/SAC Code</span>}
                rules={[
                  {
                    pattern: /^\d{4}$|^\d{6}$|^\d{8}$/,
                    message: 'HSN/SAC code must be 4, 6, or 8 digits',
                  },
                ]}
                style={{ marginBottom: 12 }}
                tooltip="Optional default HSN/SAC code for variants to inherit. Variants can override this."
              >
                <Input
                  size="small"
                  placeholder="e.g., 8517 (optional)"
                  maxLength={8}
                  disabled={!isGstApplicable}
                  onKeyPress={(e) => {
                    if (!/[0-9]/.test(e.key)) {
                      e.preventDefault()
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="defaultIgstRatePercent"
                label={<span style={{ fontSize: '12px' }}>Default IGST Rate (%)</span>}
                rules={[
                  {
                    validator: (_, value) => {
                      if (!isGstApplicable) {
                        return Promise.resolve()
                      }
                      if (!value && value !== 0) {
                        return Promise.resolve() // Optional
                      }
                      if (!ALLOWED_GST_RATES.includes(value)) {
                        return Promise.reject(
                          new Error(`IGST rate must be one of: ${ALLOWED_GST_RATES.join(', ')}%`),
                        )
                      }
                      // Auto-calculate default CGST and SGST as half of IGST
                      const defaultCgst = value / 2
                      const defaultSgst = value / 2
                      form.setFieldsValue({
                        defaultCgstRatePercent: defaultCgst,
                        defaultSgstRatePercent: defaultSgst,
                      })
                      return Promise.resolve()
                    },
                  },
                ]}
                style={{ marginBottom: 12 }}
                tooltip="Optional default IGST rate for variants. Default CGST and SGST will be auto-calculated as half of this rate."
              >
                <Select
                  size="small"
                  placeholder="Select default IGST rate (optional)"
                  disabled={!isGstApplicable}
                >
                  <Option value={undefined}>None</Option>
                  {ALLOWED_GST_RATES.map((rate) => (
                    <Option key={rate} value={rate}>
                      {rate}%
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="defaultCgstRatePercent"
                label={<span style={{ fontSize: '12px' }}>Default CGST Rate (%)</span>}
                rules={[
                  {
                    validator: (_, value) => {
                      if (!isGstApplicable) {
                        return Promise.resolve()
                      }
                      if (!value && value !== 0 && value !== '') {
                        return Promise.resolve() // Optional
                      }
                      const numValue = typeof value === 'string' ? parseFloat(value) : value

                      // Validate that default CGST + default SGST = default IGST
                      const defaultSgst = form.getFieldValue('defaultSgstRatePercent')
                      const defaultIgst = form.getFieldValue('defaultIgstRatePercent')
                      const defaultSgstNum =
                        typeof defaultSgst === 'string' ? parseFloat(defaultSgst) : defaultSgst
                      const defaultIgstNum =
                        typeof defaultIgst === 'string' ? parseFloat(defaultIgst) : defaultIgst
                      if (
                        defaultSgstNum !== undefined &&
                        defaultSgstNum !== null &&
                        !isNaN(defaultSgstNum) &&
                        defaultIgstNum !== undefined &&
                        defaultIgstNum !== null &&
                        !isNaN(defaultIgstNum) &&
                        numValue + defaultSgstNum !== defaultIgstNum
                      ) {
                        return Promise.reject(
                          new Error(
                            `Default CGST + Default SGST (${
                              numValue + defaultSgstNum
                            }%) must equal Default IGST (${defaultIgstNum}%).`,
                          ),
                        )
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
                style={{ marginBottom: 12 }}
                tooltip="Optional default CGST rate for variants. Must be half of default IGST. You can edit this, but default CGST + default SGST must equal default IGST."
              >
                <Input
                  size="small"
                  type="number"
                  placeholder="Enter default CGST rate (optional)"
                  disabled={!isGstApplicable}
                  suffix="%"
                  min={0}
                  max={28}
                  step={0.01}
                  onKeyPress={(e) => {
                    if (!/[0-9.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                      e.preventDefault()
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                name="defaultSgstRatePercent"
                label={<span style={{ fontSize: '12px' }}>Default SGST Rate (%)</span>}
                rules={[
                  {
                    validator: (_, value) => {
                      if (!isGstApplicable) {
                        return Promise.resolve()
                      }
                      if (!value && value !== 0 && value !== '') {
                        return Promise.resolve() // Optional
                      }
                      const numValue = typeof value === 'string' ? parseFloat(value) : value
                      if (
                        numValue !== undefined &&
                        numValue !== null &&
                        numValue !== '' &&
                        isNaN(numValue)
                      ) {
                        return Promise.reject(
                          new Error('Default SGST Rate must be a valid number.'),
                        )
                      }
                      // Validate that default CGST + default SGST = default IGST
                      const defaultCgst = form.getFieldValue('defaultCgstRatePercent')
                      const defaultIgst = form.getFieldValue('defaultIgstRatePercent')
                      const defaultCgstNum =
                        typeof defaultCgst === 'string' ? parseFloat(defaultCgst) : defaultCgst
                      const defaultIgstNum =
                        typeof defaultIgst === 'string' ? parseFloat(defaultIgst) : defaultIgst
                      if (
                        defaultCgstNum !== undefined &&
                        defaultCgstNum !== null &&
                        !isNaN(defaultCgstNum) &&
                        defaultIgstNum !== undefined &&
                        defaultIgstNum !== null &&
                        !isNaN(defaultIgstNum) &&
                        defaultCgstNum + numValue !== defaultIgstNum
                      ) {
                        return Promise.reject(
                          new Error(
                            `Default CGST + Default SGST (${
                              defaultCgstNum + numValue
                            }%) must equal Default IGST (${defaultIgstNum}%).`,
                          ),
                        )
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
                style={{ marginBottom: 0 }}
                tooltip="Optional default SGST rate for variants. Must be half of default IGST. You can edit this, but default CGST + default SGST must equal default IGST."
              >
                <Input
                  size="small"
                  type="number"
                  placeholder="Enter default SGST rate (optional)"
                  disabled={!isGstApplicable}
                  suffix="%"
                  min={0}
                  max={28}
                  step={0.01}
                  onKeyPress={(e) => {
                    if (!/[0-9.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                      e.preventDefault()
                    }
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      ) : null}

      <Card
        title={
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            Manufacturer & Importer Information
          </span>
        }
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '12px' }}
        size="small"
      >
        <Row gutter={[12, 8]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="manufacturerName"
              label={<span style={{ fontSize: '12px' }}>Manufacturer Name</span>}
              rules={[{ required: true, message: 'Please enter manufacturer name' }]}
              style={{ marginBottom: 12 }}
            >
              <Input size="small" placeholder="Enter manufacturer name" />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="countryOfOrigin"
              label={<span style={{ fontSize: '12px' }}>Country of Origin</span>}
              rules={[{ required: true, message: 'Please select country of origin' }]}
              style={{ marginBottom: 12 }}
            >
              <Select
                size="small"
                placeholder="Select country of origin"
                showSearch
                allowClear
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                options={COUNTRY_OPTIONS.map((c) => ({ value: c, label: c }))}
              />
            </Form.Item>
          </Col>

          <Col xs={24}>
            <Form.Item
              name="manufacturerAddress"
              label={<span style={{ fontSize: '12px' }}>Manufacturer Address</span>}
              rules={[{ required: true, message: 'Please enter manufacturer address' }]}
              style={{ marginBottom: 12 }}
            >
              <TextArea rows={2} size="small" placeholder="Enter complete manufacturer address" />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="importerName"
              label={<span style={{ fontSize: '12px' }}>Importer Name (Optional)</span>}
              style={{ marginBottom: 12 }}
            >
              <Input size="small" placeholder="Enter importer name (if applicable)" />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="importerAddress"
              label={<span style={{ fontSize: '12px' }}>Importer Address (Optional)</span>}
              style={{ marginBottom: 0 }}
            >
              <TextArea
                rows={2}
                size="small"
                placeholder="Enter importer address (if applicable)"
              />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Certificate Requirement Alert */}
      {effectiveCertificates.length > 0 && (
        <Card style={{ marginBottom: 12 }} bodyStyle={{ padding: '12px' }} size="small">
          <CertificateRequirementAlert
            requiredCertificates={effectiveCertificates}
            inheritedCertificates={inheritedCertificates}
            inheritsParentRule={inheritsParentRule}
            sellerCertificates={sellerCertificates}
            onUploadClick={() => setCertificateModalOpen(true)}
          />
        </Card>
      )}

      {/* Certificate Upload Modal */}
      {effectiveCertificates.length > 0 && (
        <CertificateUploadModal
          open={certificateModalOpen}
          onClose={() => setCertificateModalOpen(false)}
          requiredCertificates={effectiveCertificates}
          inheritedCertificates={inheritedCertificates}
          onUploaded={handleCertificateUploaded}
        />
      )}
    </>
  )
}

export default BasicInfoTab
