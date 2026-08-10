import { DeleteOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { RcFile } from 'antd/es/upload'
import type { UploadFile } from 'antd/es/upload/interface'
import type { Product, ProductFormData, VariantPayload } from '../../api/products'

import { markNoticeAddressed } from '@/api/products'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useCreateVariant,
  useDeleteVariant,
  useProduct,
  useProductVariants,
  useSetProductStock,
  useUpdateLowStockThreshold,
  useUpdateProduct,
  useUpdateVariant,
} from '../../api/productQueries'
import { useProfile } from '../../api/profileQueries'
import type { PickupAddress } from '../../api/storeQueries'
import AttributeSelector from '../../components/variants/AttributeSelector'
import SmartAttributeSelector from '../../components/variants/SmartAttributeSelector'
import VariantGenerator from '../../components/variants/VariantGenerator'
import type { AttributeConfig } from '../../utils/categoryAttributes'
import { GENERAL_ATTRIBUTES } from '../../utils/categoryAttributes'
import WarehouseInventoryAdjustModal from './components/WarehouseInventoryAdjustModal'

const { Title } = Typography

// Extended product interface for additional fields
interface ExtendedProduct {
  metaTitle?: string
  metaDescription?: string
  seoKeywords?: string[]
  requiresShipping?: boolean
  freeShipping?: boolean
  shippingWeight?: number
  shippingDimensions?: {
    length: number
    width: number
    height: number
  }
  shippingCharge?: number
  fulfillmentType?: 'self-ship' | 'marketplace-fulfilled'
  trackInventory?: boolean
  minOrderQuantity?: number
  maxOrderQuantity?: number
  discountPercent?: number
  discountStart?: string
  discountEnd?: string
  taxClass?: string
  taxRate?: number
  returnable?: boolean
  returnDays?: number
  warranty?: boolean
  warrantyDays?: number
  payOnDelivery?: boolean
  nextDayDelivery?: boolean
  securePayment?: boolean
  effectivePrice?: number
  exclusivePrice?: number
  exclusiveTaxAmount?: number
  profit?: number
  warehouseInventory?: WarehouseInventoryItem[]
  imageMeta?: Array<{
    url: string
    alt?: string
    isCover?: boolean
    sort?: number
  }>
}

interface WarehouseInventoryItem {
  warehouseId: string
  warehouseName: string
  quantity: number
  lowStockThreshold?: number
}

type GeneratedVariantRow = {
  id: string
  name: string
  sku: string
  attributes: Record<string, string>
  price: number
  costPrice: number
  comparePrice: number
  discountPercent: number
  stock: number
  lowStockThreshold: number
  warehouseInventory?: WarehouseInventoryItem[]
  mainImage: { url?: string; uid: string; originFileObj?: RcFile } | null
  images: { url?: string; uid: string; originFileObj?: RcFile }[]
}

type InputGeneratedVariant = {
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
  mainImage?: string | null
  images?: string[]
  status?: string
}

type ProductVariantRow = {
  _id: string
  name: string
  sku: string
  price: number
  costPrice?: number
  comparePrice?: number
  discountPercent?: number
  stock: number
  lowStockThreshold?: number
  warehouseInventory?: WarehouseInventoryItem[]
  attributes: Record<string, string>
  isDefault?: boolean
  mainImage?: string
  images?: string[]
  // GST/HSN fields
  hsnSacCode?: string | null
  cgstRatePercent?: number | null
  sgstRatePercent?: number | null
  igstRatePercent?: number | null
}

const ProductView = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [isSetOpen, setIsSetOpen] = useState(false)
  const [isThresholdOpen, setIsThresholdOpen] = useState(false)

  const { data: productData, isLoading, refetch: refetchProduct } = useProduct(id || '')
  const { data: productVariants, refetch: refetchVariants } = useProductVariants(id || '')
  const { data: profile } = useProfile()
  const pickupAddresses: PickupAddress[] = (profile?.pickupAddresses as PickupAddress[]) || []

  const setMutation = useSetProductStock()
  const thresholdMutation = useUpdateLowStockThreshold()
  const createVariantMutation = useCreateVariant()
  const updateVariantMutation = useUpdateVariant()
  const deleteVariantMutation = useDeleteVariant()
  const updateProductMutation = useUpdateProduct()

  useEffect(() => {
    if (id) {
      refetchVariants()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const product = productData

  const handleWarehouseInventoryAdjust = async (warehouseInventory: WarehouseInventoryItem[]) => {
    if (!id || !product) return
    try {
      // Calculate total stock from warehouse inventory
      const totalStock = warehouseInventory.reduce((sum, wi) => sum + (wi.quantity || 0), 0)

      // Clean warehouse inventory - remove any _id fields that shouldn't be sent
      const cleanedWarehouseInventory = warehouseInventory.map((wi) => ({
        warehouseId: wi.warehouseId,
        warehouseName: wi.warehouseName,
        quantity: wi.quantity,
        lowStockThreshold: wi.lowStockThreshold,
      }))

      await updateProductMutation.mutateAsync({
        id,
        data: {
          name: product.name,
          description: product.description,
          price: product.price,
          category: typeof product.category === 'object' ? product.category._id : product.category,
          stock: totalStock,
          status: product.status,
          warehouseInventory: cleanedWarehouseInventory,
          // Include existing images to pass validation (existingImages should be JSON string)
          existingMainImage: product.mainImage,
          existingImages: product.images || [],
        } as ProductFormData,
      })
      message.success('Stock adjusted successfully')
      setIsAdjustOpen(false)
      // Refetch product data and logs to update UI
      if (refetchProduct) {
        refetchProduct()
      }
    } catch (error: unknown) {
      const errorMessage =
        (
          error as {
            response?: { data?: { error?: string }; message?: string }
            message?: string
          }
        )?.response?.data?.error ||
        (error as { message?: string })?.message ||
        'Failed to adjust stock'
      message.error(errorMessage)
    }
  }

  const handleSet = async (values: { stock: number; reason?: string }) => {
    if (!id) return
    try {
      await setMutation.mutateAsync({
        id,
        stock: values.stock,
        reason: values.reason,
      })
      message.success('Stock updated')
      setIsSetOpen(false)
      // Refetch product data to update UI
      if (refetchProduct) {
        refetchProduct()
      }
    } catch (error: unknown) {
      // Error message is already handled by the mutation, but ensure it's displayed
      const errorMessage =
        (
          error as {
            response?: { data?: { error?: string }; message?: string }
            message?: string
          }
        )?.response?.data?.error ||
        (error as { message?: string })?.message ||
        'Failed to set stock'
      message.error(errorMessage)
    }
  }

  const handleThreshold = async (values: { threshold: number }) => {
    if (!id) return
    await thresholdMutation.mutateAsync({ id, threshold: values.threshold })
    message.success('Low stock threshold updated')
    setIsThresholdOpen(false)
  }

  // Variant state and handlers (matching VariantsTab approach)
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false)
  const [isEditVariantModalOpen, setIsEditVariantModalOpen] = useState(false)
  const [isEditGstModalOpen, setIsEditGstModalOpen] = useState(false)
  const [isEditProductGstModalOpen, setIsEditProductGstModalOpen] = useState(false)
  const [editingGstVariant, setEditingGstVariant] = useState<ProductVariantRow | null>(null)
  const [gstForm] = Form.useForm()
  const [productGstForm] = Form.useForm()
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([])
  const [customAttributes, setCustomAttributes] = useState<AttributeConfig[]>([])
  const [attributeValues, setAttributeValues] = useState<Record<string, string[]>>({})
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariantRow[]>([])
  const [editingVariant, setEditingVariant] = useState<{
    _id: string
    name: string
    sku: string
    price: number
    costPrice?: number
    comparePrice?: number
    discountPercent?: number
    stock: number
    lowStockThreshold?: number
    attributes: Record<string, string>
  } | null>(null)

  // Always use general attributes - no category dependency
  const availableAttributes = GENERAL_ATTRIBUTES

  const openCreateVariant = () => {
    setIsVariantModalOpen(true)
  }

  const closeVariantModal = () => {
    setIsVariantModalOpen(false)
    setSelectedAttributes([])
    setAttributeValues({})
    setGeneratedVariants([])
  }

  const openEditVariant = (variant: {
    _id: string
    name: string
    sku: string
    price: number
    costPrice?: number
    comparePrice?: number
    discountPercent?: number
    stock: number
    lowStockThreshold?: number
    warehouseInventory?: WarehouseInventoryItem[]
    attributes: Record<string, string>
    mainImage?: string
    images?: string[]
  }) => {
    setEditingVariant(variant)

    // Extract attributes from variant
    const variantAttributes = Object.keys(variant.attributes || {})
    const attributeValues: Record<string, string[]> = {}

    // Set up attribute values for each attribute
    variantAttributes.forEach((attr) => {
      attributeValues[attr] = [variant.attributes[attr]]
    })

    // Set up the variant data for editing
    const editVariantData = {
      id: variant._id,
      name: variant.name,
      sku: variant.sku,
      attributes: variant.attributes,
      price: variant.price,
      costPrice: variant.costPrice || 0,
      comparePrice: variant.comparePrice || 0,
      discountPercent: variant.discountPercent || 0,
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold || 5,
      warehouseInventory: variant.warehouseInventory || [],
      mainImage: variant.mainImage ? { url: variant.mainImage, uid: 'existing-main' } : null,
      images: variant.images
        ? variant.images.map((img: string, index: number) => ({
            url: img,
            uid: `existing-${index}`,
          }))
        : [],
    } as GeneratedVariantRow

    setSelectedAttributes(variantAttributes)
    setAttributeValues(attributeValues)
    setGeneratedVariants([editVariantData])
    setIsEditVariantModalOpen(true)
  }

  const closeEditVariantModal = () => {
    setIsEditVariantModalOpen(false)
    setEditingVariant(null)
    setSelectedAttributes([])
    setAttributeValues({})
    setGeneratedVariants([])
  }

  const handleAttributesChange = useCallback((attributes: string[]) => {
    setSelectedAttributes(attributes)
    // Clear variants when changing attributes
    setGeneratedVariants([])
  }, [])

  const handleAttributeValuesChange = useCallback((attrKey: string, values: string[]) => {
    setAttributeValues((prev) => ({
      ...prev,
      [attrKey]: values,
    }))
  }, [])

  const handleVariantsChange = useCallback((generatedVariants: unknown[]) => {
    // Convert variants to the expected format
    const convertedVariants: GeneratedVariantRow[] = (generatedVariants || []).map((v) => {
      const variant = v as Partial<InputGeneratedVariant>
      const imgs = Array.isArray(variant.images) ? (variant.images as string[]) : []
      const mainImg =
        typeof variant.mainImage === 'string' || variant.mainImage == null
          ? (variant.mainImage as string | null)
          : null
      return {
        id: String(variant.id),
        name: String(variant.name),
        sku: String(variant.sku),
        attributes: (variant.attributes as Record<string, string>) || {},
        price: Number(variant.price ?? 0),
        costPrice: Number(variant.costPrice ?? 0),
        comparePrice: Number(variant.comparePrice ?? 0),
        discountPercent: Number(variant.discountPercent ?? 0),
        stock: Number(variant.stock ?? 0),
        lowStockThreshold: Number(variant.lowStockThreshold ?? 5),
        warehouseInventory:
          (variant as { warehouseInventory?: WarehouseInventoryItem[] }).warehouseInventory || [],
        mainImage: mainImg ? { url: mainImg, uid: 'converted-main' } : null,
        images: imgs.map((img: string, index: number) => ({
          url: img,
          uid: `converted-${index}`,
        })),
      }
    })
    setGeneratedVariants(convertedVariants)
  }, [])

  const submitVariants = async () => {
    if (!id || generatedVariants.length === 0) return

    try {
      // Create all variants
      for (const variant of generatedVariants) {
        // Build media payload compatible with variants API mappers
        const mediaMain = variant.mainImage
          ? variant.mainImage.originFileObj
            ? { originFileObj: variant.mainImage.originFileObj }
            : variant.mainImage.url
            ? { url: variant.mainImage.url }
            : undefined
          : undefined

        const mediaImages = (variant.images || []).map((img) =>
          img.originFileObj ? { originFileObj: img.originFileObj } : { url: img.url },
        )

        // Pass the variant data with warehouse inventory
        const payload = {
          name: variant.name,
          sku: variant.sku,
          attributes: variant.attributes,
          price: variant.price ?? 0,
          costPrice: variant.costPrice ?? 0,
          comparePrice: variant.comparePrice ?? 0,
          discountPercent: variant.discountPercent ?? 0,
          stock: variant.stock ?? 0,
          lowStockThreshold: variant.lowStockThreshold ?? 5,
          warehouseInventory: variant.warehouseInventory || undefined,
          mainImage: mediaMain,
          images: mediaImages,
        }

        await createVariantMutation.mutateAsync({
          productId: id,
          payload,
        })
      }

      message.success(`${generatedVariants.length} variants created successfully`)
      closeVariantModal()
      refetchVariants()
    } catch (error) {
      console.error('Error creating variants:', error)
      message.error('Failed to create variants')
    }
  }

  // Helper function to get unique identifier for a pickup address
  interface PickupAddressWithId extends PickupAddress {
    _id?: string
    courierCartPickupAddressId?: string
  }

  const getWarehouseId = (addr: PickupAddressWithId, index?: number): string => {
    if (addr._id) return String(addr._id)
    if (addr.courierCartPickupAddressId) return String(addr.courierCartPickupAddressId)
    if (index !== undefined) return `warehouse-${index}-${addr.warehouseName}-${addr.postalCode}`
    return `${addr.warehouseName}-${addr.postalCode}-${addr.addressLine1 || ''}`
  }

  const findPickupAddressById = (warehouseId: string): PickupAddressWithId | undefined => {
    return (pickupAddresses as PickupAddressWithId[]).find((addr, index) => {
      if (addr._id && String(addr._id) === warehouseId) return true
      if (
        addr.courierCartPickupAddressId &&
        String(addr.courierCartPickupAddressId) === warehouseId
      )
        return true
      if (warehouseId.startsWith('warehouse-')) {
        const expectedId = getWarehouseId(addr, index)
        return expectedId === warehouseId
      }
      return `${addr.warehouseName}-${addr.postalCode}-${addr.addressLine1 || ''}` === warehouseId
    })
  }

  // Inline editors for Add Variant modal (pricing + media)
  const updateGeneratedVariant = (
    variantId: string,
    updates: Partial<{
      name: string
      sku: string
      price: number
      costPrice: number
      comparePrice: number
      discountPercent: number
      stock: number
      lowStockThreshold: number
      warehouseInventory?: WarehouseInventoryItem[]
      mainImage: { url?: string; uid: string; originFileObj?: RcFile } | null
      images: { url?: string; uid: string; originFileObj?: RcFile }[]
    }>,
  ) => {
    setGeneratedVariants((prev) => {
      const updated = prev.map((v) => {
        if (v.id === variantId) {
          const newVariant = { ...v, ...updates }
          // If warehouseInventory is updated, recalculate total stock
          if (updates.warehouseInventory !== undefined) {
            const totalStock = updates.warehouseInventory.reduce(
              (sum, wi) => sum + (wi.quantity || 0),
              0,
            )
            newVariant.stock = totalStock
          }
          return newVariant
        }
        return v
      })
      return updated
    })
  }

  const deleteVariant = async (variantId: string) => {
    if (!id) return
    await deleteVariantMutation.mutateAsync({ productId: id, variantId })
    message.success('Variant deleted')
  }

  const openEditGst = (variant: ProductVariantRow) => {
    setEditingGstVariant(variant)
    gstForm.setFieldsValue({
      hsnSacCode: variant.hsnSacCode || '',
      igstRatePercent: variant.igstRatePercent ?? undefined,
      cgstRatePercent: variant.cgstRatePercent ?? undefined,
      sgstRatePercent: variant.sgstRatePercent ?? undefined,
    })
    setIsEditGstModalOpen(true)
  }

  const closeEditGstModal = () => {
    setIsEditGstModalOpen(false)
    setEditingGstVariant(null)
    gstForm.resetFields()
  }

  const handleGstUpdate = async (values: {
    hsnSacCode?: string
    cgstRatePercent?: number
    sgstRatePercent?: number
    igstRatePercent?: number
  }) => {
    if (!id || !editingGstVariant) return

    try {
      const payload: {
        hsnSacCode?: string | null
        cgstRatePercent?: number | null
        sgstRatePercent?: number | null
        igstRatePercent?: number | null
      } = {}

      // Always include all GST fields in payload to ensure they're sent
      // Handle HSN/SAC
      payload.hsnSacCode = values.hsnSacCode?.trim() || null

      // Handle GST rates - convert to numbers, include 0 as valid value
      payload.igstRatePercent =
        values.igstRatePercent !== undefined && values.igstRatePercent !== null
          ? Number(values.igstRatePercent)
          : null

      payload.cgstRatePercent =
        values.cgstRatePercent !== undefined && values.cgstRatePercent !== null
          ? Number(values.cgstRatePercent)
          : null

      payload.sgstRatePercent =
        values.sgstRatePercent !== undefined && values.sgstRatePercent !== null
          ? Number(values.sgstRatePercent)
          : null

      await updateVariantMutation.mutateAsync({
        productId: id,
        variantId: editingGstVariant._id,
        payload: payload as Partial<
          VariantPayload & {
            hsnSacCode?: string | null
            cgstRatePercent?: number | null
            sgstRatePercent?: number | null
            igstRatePercent?: number | null
          }
        >,
      })

      message.success('GST data updated successfully')
      closeEditGstModal()
      refetchVariants()
      refetchProduct()
    } catch (error) {
      console.error('Error updating GST data:', error)
      message.error('Failed to update GST data')
    }
  }

  const openEditProductGst = () => {
    productGstForm.setFieldsValue({
      hsnSacCode: product?.hsnSacCode || '',
      igstRatePercent: product?.igstRatePercent ?? undefined,
      cgstRatePercent: product?.cgstRatePercent ?? undefined,
      sgstRatePercent: product?.sgstRatePercent ?? undefined,
    })
    setIsEditProductGstModalOpen(true)
  }

  const closeEditProductGstModal = () => {
    setIsEditProductGstModalOpen(false)
    productGstForm.resetFields()
  }

  const handleProductGstUpdate = async (values: {
    hsnSacCode?: string
    cgstRatePercent?: number
    sgstRatePercent?: number
    igstRatePercent?: number
  }) => {
    if (!id || !product) return

    try {
      const updateData: ProductFormData = {
        name: product.name,
        description: product.description,
        price: product.price,
        category: typeof product.category === 'object' ? product.category._id : product.category,
        stock: product.stock,
        status: product.status as 'draft' | 'active' | 'inactive',
        shortDescription: product.shortDescription,
        comparePrice: product.comparePrice,
        costPrice: product.costPrice,
        brand: product.brand,
        sku: product.sku,
        isFeatured: product.isFeatured,
        specifications: product.specifications,
        tags: product.tags,
        existingMainImage: product.mainImage,
        existingImages: product.images,
        // GST fields
        hsnSacCode: values.hsnSacCode?.trim() || null,
        cgstRatePercent:
          values.cgstRatePercent !== undefined && values.cgstRatePercent !== null
            ? Number(values.cgstRatePercent)
            : null,
        sgstRatePercent:
          values.sgstRatePercent !== undefined && values.sgstRatePercent !== null
            ? Number(values.sgstRatePercent)
            : null,
        igstRatePercent:
          values.igstRatePercent !== undefined && values.igstRatePercent !== null
            ? Number(values.igstRatePercent)
            : null,
      }

      await updateProductMutation.mutateAsync({
        id,
        data: updateData,
      })

      message.success('GST data updated successfully')
      closeEditProductGstModal()
      refetchProduct()
    } catch (error) {
      console.error('Error updating product GST data:', error)
      message.error('Failed to update GST data')
    }
  }

  const handlePublishProduct = async () => {
    if (!id || !product) return

    // Check if required fields are present
    const missingFields = []
    if (!product.description) missingFields.push('Description')
    if (!product.price) missingFields.push('Price')
    if (!product.category) missingFields.push('Category')
    if (!product.mainImage) missingFields.push('Main Image')

    if (missingFields.length > 0) {
      message.error(`Cannot publish: Missing required fields: ${missingFields.join(', ')}`)
      return
    }

    try {
      // Create a minimal update payload with just the status change
      const updateData = {
        name: product.name,
        description: product.description,
        price: product.price,
        category: typeof product.category === 'object' ? product.category._id : product.category,
        stock: product.stock,
        status: 'active' as const,
        // Include other required fields with current values
        shortDescription: product.shortDescription,
        comparePrice: product.comparePrice,
        costPrice: product.costPrice,
        brand: product.brand,
        sku: product.sku,
        isFeatured: product.isFeatured,
        specifications: product.specifications,
        tags: product.tags,
        existingMainImage: product.mainImage,
        existingImages: product.images,
      }

      await updateProductMutation.mutateAsync({
        id,
        data: updateData,
      })
      message.success('Product published successfully!')
    } catch {
      message.error('Failed to publish product')
    }
  }

  // Check if product can be published (all required fields present)
  const canPublish =
    product &&
    product.status === 'draft' &&
    product.description &&
    product.price &&
    product.category &&
    product.mainImage

  const handleMarkAddressed = async () => {
    if (!id) return

    await markNoticeAddressed(id)
    message.success('Marked as addressed')
    refetchProduct()
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {Array.isArray(product?.objections) &&
        product!.objections.some((o: { resolved?: boolean }) => !o.resolved) && (
          <Alert
            type="warning"
            showIcon
            message={<span className="font-medium">Admin Notice</span>}
            description={(() => {
              const arr = [
                ...(product!.objections as Array<NonNullable<Product['objections']>[number]>),
              ]
              const latest = arr.reverse().find((o) => !o.resolved)! as {
                reason: string
                createdAt: string
              }
              return (
                <div className="space-y-1">
                  <div className="font-medium text-gray-800">{latest.reason}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(latest.createdAt).toLocaleString()}
                  </div>
                </div>
              )
            })()}
            action={(() => {
              const arr = [
                ...(product!.objections as Array<NonNullable<Product['objections']>[number]>),
              ]
              const latest = arr.reverse().find((o) => !o.resolved)!
              return !latest!.addressedBySeller && !latest!.resolved ? (
                <Button size="small" className="!px-3" onClick={handleMarkAddressed}>
                  Mark as addressed
                </Button>
              ) : undefined
            })()}
            className="rounded-md"
          />
        )}
      {/* Hero Header */}
      <Card bodyStyle={{ padding: 16 }} style={{ border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} md={6}>
            <div
              style={{
                width: '100%',
                aspectRatio: '1/1',
                background: '#f5f5f5',
                border: '1px solid #eee',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {product?.mainImage ? (
                <img
                  src={product.mainImage}
                  alt={product?.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Typography.Text type="secondary">No Image</Typography.Text>
              )}
            </div>
          </Col>
          <Col xs={24} md={18}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                <Title level={3} style={{ margin: 0 }}>
                  {product?.name || 'Product Details'}{' '}
                  {product && product.status === 'draft' && (
                    <Tag color="gold" style={{ marginLeft: 8 }}>
                      DRAFT
                    </Tag>
                  )}
                </Title>
                <Space>
                  {product && product.status === 'draft' && (
                    <Button
                      type="primary"
                      onClick={handlePublishProduct}
                      disabled={!canPublish}
                      loading={updateProductMutation.isPending}
                    >
                      Publish Product
                    </Button>
                  )}
                </Space>
              </Space>
              <Space wrap>
                <Tag color="blue">
                  SKU: {product?.sku || '-'}
                  <Button
                    size="small"
                    type="text"
                    onClick={() => {
                      if (product?.sku) navigator.clipboard.writeText(product.sku)
                      message.success('SKU copied')
                    }}
                    style={{ marginLeft: 8, padding: 0 }}
                  >
                    Copy
                  </Button>
                </Tag>
                <Tag color="purple">{product?.hasVariants ? 'Variants' : 'Simple'}</Tag>
                <Tag color={product?.isFeatured ? 'geekblue' : 'default'}>
                  {product?.isFeatured ? 'Featured' : 'Standard'}
                </Tag>
                <Tag
                  color={
                    product?.status === 'active'
                      ? 'green'
                      : product?.status === 'out_of_stock'
                      ? 'red'
                      : 'default'
                  }
                >
                  {(product?.status || 'draft').toUpperCase()}
                </Tag>
                {product?.category?.name && (
                  <Tag>
                    {(() => {
                      const category = product.category
                      if (!category) return ''
                      const categoryName =
                        typeof category === 'string' ? category : category.name || ''
                      const parent =
                        typeof category === 'object' && category.parent
                          ? typeof category.parent === 'string'
                            ? null
                            : category.parent
                          : null
                      const parentName = parent?.name || null
                      return parentName ? `${parentName} > ${categoryName}` : categoryName
                    })()}
                  </Tag>
                )}
              </Space>
              {!product?.hasVariants ? (
                <Space size={16} wrap>
                  <Tag color="cyan">Price: ₹{product?.price?.toFixed(2) || '0.00'}</Tag>
                  <Tag color="processing">Stock: {product?.stock || 0}</Tag>
                </Space>
              ) : (
                <Space size={16} wrap>
                  <Tag color="cyan">
                    Total Stock: {(product as { totalStock?: number }).totalStock || 0}
                  </Tag>
                  <Tag color="warning">
                    Low Stock Variants:{' '}
                    {(product as { lowStockVariants?: number }).lowStockVariants || 0}
                  </Tag>
                </Space>
              )}
            </Space>
            {/* Thumbnails */}
            {product?.images && product.images.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  {product.images.slice(0, 6).map((img: string, i: number) => (
                    <img
                      key={i}
                      src={img}
                      alt={`thumb-${i}`}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        objectFit: 'cover',
                        border: '1px solid #eee',
                      }}
                    />
                  ))}
                </Space>
              </div>
            )}
          </Col>
        </Row>
      </Card>

      {/* Divider */}
      <Divider style={{ margin: '8px 0' }} />
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
        <Title level={3} style={{ margin: 0 }}>
          Product Details{' '}
          {product && product.status === 'draft' && (
            <Tag color="gold" style={{ marginLeft: 8 }}>
              DRAFT
            </Tag>
          )}
        </Title>
        <Space>
          <Button onClick={() => navigate('/products')}>Back</Button>
          {product && product.status === 'draft' && (
            <Button
              type="primary"
              onClick={handlePublishProduct}
              disabled={!canPublish}
              loading={updateProductMutation.isPending}
            >
              Publish Product
            </Button>
          )}
          {id && (
            <Button type="primary" onClick={() => navigate(`/products/${id}/edit`)}>
              Edit
            </Button>
          )}
        </Space>
      </Space>

      {product && product.status === 'draft' && (
        <Alert
          type="warning"
          showIcon
          message="This product is in Draft and not visible to customers."
          description={
            canPublish
              ? 'All required fields are present. You can publish this product to make it live.'
              : 'Complete the required fields (Description, Price, Category, Main Image) to publish this product.'
          }
          style={{ marginBottom: 12 }}
        />
      )}

      <Card loading={isLoading} title="Product Information" bordered>
        {product && (
          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="Name" span={2}>
              <Typography.Text strong>{product.name}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="SKU">{product.sku}</Descriptions.Item>
            <Descriptions.Item label="Category">
              {product.category?.name || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Brand">{product.brand || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag
                color={
                  product.status === 'active'
                    ? 'green'
                    : product.status === 'draft'
                    ? 'gold'
                    : product.status === 'out_of_stock'
                    ? 'red'
                    : 'default'
                }
              >
                {product.status?.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            {!product.hasVariants ? (
              <>
                <Descriptions.Item label="Price">
                  ₹{((product as ExtendedProduct).effectivePrice ?? product.price)?.toFixed(2) || '0.00'}
                </Descriptions.Item>
                <Descriptions.Item label="Compare Price">
                  {product.comparePrice ? `₹${product.comparePrice.toFixed(2)}` : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Cost Price">
                  {product.costPrice ? `₹${product.costPrice.toFixed(2)}` : 'N/A'}
                </Descriptions.Item>
                {(product as ExtendedProduct).effectivePrice !== undefined && (
                  <Descriptions.Item label="Effective Price">
                    <Typography.Text strong style={{ color: '#1890ff' }}>
                      ₹{(product as ExtendedProduct).effectivePrice!.toFixed(2)}
                    </Typography.Text>
                  </Descriptions.Item>
                )}
                {(product as ExtendedProduct).exclusivePrice !== undefined && (
                  <Descriptions.Item label="Exclusive Price (Without GST)">
                    ₹{(product as ExtendedProduct).exclusivePrice!.toFixed(2)}
                  </Descriptions.Item>
                )}
                {(product as ExtendedProduct).exclusiveTaxAmount !== undefined && (
                  <Descriptions.Item label="GST Amount">
                    ₹{(product as ExtendedProduct).exclusiveTaxAmount!.toFixed(2)}
                  </Descriptions.Item>
                )}
                {(product as ExtendedProduct).profit !== undefined && (
                  <Descriptions.Item label="Profit">
                    <Typography.Text
                      strong
                      style={{
                        color: (product as ExtendedProduct).profit! >= 0 ? '#52c41a' : '#ff4d4f',
                      }}
                    >
                      ₹{(product as ExtendedProduct).profit!.toFixed(2)}
                    </Typography.Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Stock">{product.stock || 0}</Descriptions.Item>
                <Descriptions.Item label="Low Stock Threshold">
                  {product.lowStockThreshold ?? 5}
                </Descriptions.Item>
              </>
            ) : (
              <>
                <Descriptions.Item label="Price Range" span={2}>
                  <Typography.Text type="secondary">
                    Prices vary by variant - see variants table below
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Total Stock (All Variants)">
                  {(product as { totalStock?: number }).totalStock || 0}
                </Descriptions.Item>
                <Descriptions.Item label="Low Stock Variants">
                  {(product as { lowStockVariants?: number }).lowStockVariants || 0}
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="Featured">
              <Tag color={product.isFeatured ? 'blue' : 'default'}>
                {product.isFeatured ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Has Variants">
              <Tag color={product.hasVariants ? 'purple' : 'default'}>
                {product.hasVariants ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
            {product.hasVariants && (
              <Descriptions.Item label="Variant Attributes" span={2}>
                {product.variantAttributes?.length ? (
                  <Space wrap>
                    {product.variantAttributes.map((attr: string) => (
                      <Tag key={attr} color="cyan">
                        {attr}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  'None'
                )}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Description" span={2}>
              <Typography.Paragraph
                style={{ margin: 0 }}
                ellipsis={{ rows: 4, expandable: true, symbol: 'Read more' }}
              >
                {product.description || 'No description provided'}
              </Typography.Paragraph>
            </Descriptions.Item>
            {product.shortDescription && (
              <Descriptions.Item label="Short Description" span={2}>
                <Typography.Text>{product.shortDescription}</Typography.Text>
              </Descriptions.Item>
            )}
            {product.specifications && product.specifications.length > 0 && (
              <Descriptions.Item label="Specifications & Features" span={2}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {product.specifications.map(
                    (spec: { key?: string; value: string }, index: number) => {
                      // Display as key-value if key exists, otherwise as simple feature
                      if (spec.key && spec.key.trim()) {
                        return (
                          <Row key={index} gutter={16}>
                            <Col span={8}>
                              <Typography.Text strong>{spec.key}:</Typography.Text>
                            </Col>
                            <Col span={16}>
                              <Typography.Text>{spec.value}</Typography.Text>
                            </Col>
                          </Row>
                        )
                      } else {
                        return (
                          <div key={index} style={{ marginLeft: 0 }}>
                            <Typography.Text>• {spec.value}</Typography.Text>
                          </div>
                        )
                      }
                    },
                  )}
                </Space>
              </Descriptions.Item>
            )}
            {product.tags && product.tags.length > 0 && (
              <Descriptions.Item label="Tags" span={2}>
                <Space wrap>
                  {product.tags.map((tag: string) => (
                    <Tag key={tag} color="blue">
                      {tag}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            {product.manufacturerName && (
              <Descriptions.Item label="Manufacturer Name" span={2}>
                <Typography.Text>{product.manufacturerName}</Typography.Text>
              </Descriptions.Item>
            )}
            {product.manufacturerAddress && (
              <Descriptions.Item label="Manufacturer Address" span={2}>
                <Typography.Text>{product.manufacturerAddress}</Typography.Text>
              </Descriptions.Item>
            )}
            {product.countryOfOrigin && (
              <Descriptions.Item label="Country of Origin">
                <Typography.Text strong>{product.countryOfOrigin}</Typography.Text>
              </Descriptions.Item>
            )}
            {product.importerName && (
              <Descriptions.Item label="Importer Name">
                <Typography.Text>{product.importerName}</Typography.Text>
              </Descriptions.Item>
            )}
            {product.importerAddress && (
              <Descriptions.Item label="Importer Address" span={2}>
                <Typography.Text>{product.importerAddress}</Typography.Text>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Main Image" span={2}>
              {product.mainImage ? (
                <img
                  src={product.mainImage}
                  alt={product.name}
                  style={{ maxWidth: 200, maxHeight: 200, objectFit: 'cover' }}
                />
              ) : (
                <Typography.Text type="secondary">No main image</Typography.Text>
              )}
            </Descriptions.Item>
            {product.images && product.images.length > 0 && (
              <Descriptions.Item label="Additional Images" span={2}>
                <Space wrap>
                  {product.images.map((image: string, index: number) => (
                    <img
                      key={index}
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      style={{
                        maxWidth: 100,
                        maxHeight: 100,
                        objectFit: 'cover',
                      }}
                    />
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Created At">
              {product.createdAt ? new Date(product.createdAt).toLocaleString() : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {product.updatedAt ? new Date(product.updatedAt).toLocaleString() : 'N/A'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      {/* SEO Information */}
      {((product as ExtendedProduct)?.metaTitle ||
        (product as ExtendedProduct)?.metaDescription ||
        ((product as ExtendedProduct)?.seoKeywords?.length ?? 0) > 0) && (
        <Card title="SEO Information" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={1} size="middle">
            {(product as ExtendedProduct).metaTitle && (
              <Descriptions.Item label="Meta Title">
                <Typography.Text>{(product as ExtendedProduct).metaTitle}</Typography.Text>
              </Descriptions.Item>
            )}
            {(product as ExtendedProduct).metaDescription && (
              <Descriptions.Item label="Meta Description">
                <Typography.Text>{(product as ExtendedProduct).metaDescription}</Typography.Text>
              </Descriptions.Item>
            )}
            {(product as ExtendedProduct).seoKeywords &&
              (product as ExtendedProduct).seoKeywords!.length > 0 && (
                <Descriptions.Item label="SEO Keywords">
                  <Space wrap>
                    {(product as ExtendedProduct).seoKeywords!.map((keyword: string) => (
                      <Tag key={keyword} color="blue">
                        {keyword}
                      </Tag>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
          </Descriptions>
        </Card>
      )}

      {/* Shipping Information */}
      <Card title="Shipping Information" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2} size="middle">
          <Descriptions.Item label="Requires Shipping">
            <Tag color={(product as ExtendedProduct)?.requiresShipping ? 'green' : 'red'}>
              {(product as ExtendedProduct)?.requiresShipping ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Free Shipping">
            <Tag color={(product as ExtendedProduct)?.freeShipping ? 'green' : 'default'}>
              {(product as ExtendedProduct)?.freeShipping ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>
          {(product as ExtendedProduct)?.shippingCharge !== undefined && (
            <Descriptions.Item label="Shipping Charge">
              <Typography.Text strong>
                ₹{(product as ExtendedProduct).shippingCharge!.toFixed(2)}
              </Typography.Text>
            </Descriptions.Item>
          )}
          {(product as ExtendedProduct)?.fulfillmentType && (
            <Descriptions.Item label="Fulfillment Type">
              <Tag color="blue">
                {(product as ExtendedProduct).fulfillmentType === 'self-ship'
                  ? 'Self Ship'
                  : 'Marketplace Fulfilled'}
              </Tag>
            </Descriptions.Item>
          )}
          {(product as ExtendedProduct)?.shippingWeight && (
            <Descriptions.Item label="Shipping Weight">
              {(product as ExtendedProduct).shippingWeight} kg
            </Descriptions.Item>
          )}
          {(product as ExtendedProduct)?.shippingDimensions && (
            <Descriptions.Item label="Shipping Dimensions">
              {(product as ExtendedProduct).shippingDimensions!.length} ×{' '}
              {(product as ExtendedProduct).shippingDimensions!.width} ×{' '}
              {(product as ExtendedProduct).shippingDimensions!.height} cm
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Product Physical Attributes */}
      {product && (product.weight || product.dimensions) && (
        <Card title="Product Physical Attributes" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={2} size="middle">
            {product.weight && (
              <Descriptions.Item label="Weight">{product.weight} kg</Descriptions.Item>
            )}
            {product.dimensions && (
              <Descriptions.Item label="Dimensions (L×W×H)">
                {product.dimensions.length} × {product.dimensions.width} ×{' '}
                {product.dimensions.height} cm
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {/* Warehouse Inventory for Simple Products */}
      {product &&
        !product.hasVariants &&
        (product as ExtendedProduct).warehouseInventory &&
        Array.isArray((product as ExtendedProduct).warehouseInventory) &&
        (product as ExtendedProduct).warehouseInventory!.length > 0 && (
          <Card title="Warehouse Inventory" style={{ marginBottom: 16 }}>
            <Table
              rowKey={(record: WarehouseInventoryItem, index) => `${record.warehouseId}-${index}`}
              size="small"
              dataSource={(product as ExtendedProduct).warehouseInventory}
              pagination={false}
              columns={[
                { title: 'Warehouse ID', dataIndex: 'warehouseId' },
                { title: 'Warehouse Name', dataIndex: 'warehouseName' },
                {
                  title: 'Quantity',
                  dataIndex: 'quantity',
                  render: (v: number) => v.toLocaleString(),
                },
                {
                  title: 'Low Stock Threshold',
                  dataIndex: 'lowStockThreshold',
                  render: (v?: number) => (v !== undefined ? v : '-'),
                },
              ]}
            />
          </Card>
        )}

      {/* Image Metadata */}
      {product &&
        (product as ExtendedProduct).imageMeta &&
        Array.isArray((product as ExtendedProduct).imageMeta) &&
        (product as ExtendedProduct).imageMeta!.length > 0 && (
          <Card title="Image Metadata" style={{ marginBottom: 16 }}>
            <Table
              rowKey={(
                record: { url: string; alt?: string; isCover?: boolean; sort?: number },
                index,
              ) => `${record.url}-${index}`}
              size="small"
              dataSource={(product as ExtendedProduct).imageMeta}
              pagination={false}
              columns={[
                {
                  title: 'Image',
                  dataIndex: 'url',
                  render: (url: string) => (
                    <img
                      src={url}
                      alt="Product"
                      style={{
                        width: 60,
                        height: 60,
                        objectFit: 'cover',
                      }}
                    />
                  ),
                },
                { title: 'Alt Text', dataIndex: 'alt' },
                {
                  title: 'Is Cover',
                  dataIndex: 'isCover',
                  render: (v: boolean) => (
                    <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>
                  ),
                },
                {
                  title: 'Sort Order',
                  dataIndex: 'sort',
                  render: (v?: number) => (v !== undefined ? v : '-'),
                },
              ]}
            />
          </Card>
        )}

      {/* Product Policies */}
      <Card title="Product Policies" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2} size="middle">
          <Descriptions.Item label="Returnable">
            <Tag color={(product as ExtendedProduct)?.returnable !== false ? 'green' : 'red'}>
              {(product as ExtendedProduct)?.returnable !== false ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>
          {(product as ExtendedProduct)?.returnDays && (
            <Descriptions.Item label="Return Period">
              {(product as ExtendedProduct).returnDays} days
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Warranty">
            <Tag color={(product as ExtendedProduct)?.warranty !== false ? 'green' : 'red'}>
              {(product as ExtendedProduct)?.warranty !== false ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>
          {(product as ExtendedProduct)?.warrantyDays && (
            <Descriptions.Item label="Warranty Period">
              {(() => {
                const days = (product as ExtendedProduct).warrantyDays!
                if (days >= 365) {
                  const years = Math.floor(days / 365)
                  const remainingDays = days % 365
                  if (remainingDays > 0) {
                    const months = Math.floor(remainingDays / 30)
                    if (months > 0) {
                      return `${years} year${years > 1 ? 's' : ''} ${months} month${
                        months > 1 ? 's' : ''
                      }`
                    }
                    return `${years} year${years > 1 ? 's' : ''}`
                  }
                  return `${years} year${years > 1 ? 's' : ''}`
                } else if (days >= 30) {
                  const months = Math.floor(days / 30)
                  const remainingDays = days % 30
                  if (remainingDays > 0) {
                    return `${months} month${months > 1 ? 's' : ''} ${remainingDays} day${
                      remainingDays > 1 ? 's' : ''
                    }`
                  }
                  return `${months} month${months > 1 ? 's' : ''}`
                }
                return `${days} day${days > 1 ? 's' : ''}`
              })()}
            </Descriptions.Item>
          )}
          {(product as ExtendedProduct)?.payOnDelivery !== undefined && (
            <Descriptions.Item label="Pay on Delivery">
              <Tag color={(product as ExtendedProduct)?.payOnDelivery ? 'green' : 'red'}>
                {(product as ExtendedProduct)?.payOnDelivery ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
          )}
          {(product as ExtendedProduct)?.nextDayDelivery !== undefined && (
            <Descriptions.Item label="Next Day Delivery">
              <Tag color={(product as ExtendedProduct)?.nextDayDelivery ? 'green' : 'default'}>
                {(product as ExtendedProduct)?.nextDayDelivery ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
          )}
          {(product as ExtendedProduct)?.securePayment !== undefined && (
            <Descriptions.Item label="Secure Payment">
              <Tag color={(product as ExtendedProduct)?.securePayment ? 'green' : 'default'}>
                {(product as ExtendedProduct)?.securePayment ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Inventory Policy */}
      <Card title="Inventory Policy" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2} size="middle">
          <Descriptions.Item label="Track Inventory">
            <Tag color={(product as ExtendedProduct)?.trackInventory ? 'green' : 'red'}>
              {(product as ExtendedProduct)?.trackInventory ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Min Order Quantity">
            {(product as ExtendedProduct)?.minOrderQuantity || 1}
          </Descriptions.Item>
          <Descriptions.Item label="Max Order Quantity">
            {(product as ExtendedProduct)?.maxOrderQuantity || 'No limit'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Discount Information */}
      {((product as ExtendedProduct)?.discountPercent ||
        (product as ExtendedProduct)?.discountStart ||
        (product as ExtendedProduct)?.discountEnd) && (
        <Card title="Discount Information" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={2} size="middle">
            {(product as ExtendedProduct).discountPercent && (
              <Descriptions.Item label="Discount Percentage">
                {(product as ExtendedProduct).discountPercent}%
              </Descriptions.Item>
            )}
            {(product as ExtendedProduct).discountStart && (
              <Descriptions.Item label="Discount Start">
                {new Date((product as ExtendedProduct).discountStart!).toLocaleDateString()}
              </Descriptions.Item>
            )}
            {(product as ExtendedProduct).discountEnd && (
              <Descriptions.Item label="Discount End">
                {new Date((product as ExtendedProduct).discountEnd!).toLocaleDateString()}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {/* Tax Information */}
      {((product as ExtendedProduct)?.taxClass || (product as ExtendedProduct)?.taxRate) && (
        <Card title="Tax Information" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={2} size="middle">
            {(product as ExtendedProduct).taxClass && (
              <Descriptions.Item label="Tax Class">
                {(product as ExtendedProduct).taxClass}
              </Descriptions.Item>
            )}
            {(product as ExtendedProduct).taxRate && (
              <Descriptions.Item label="Tax Rate">
                {(product as ExtendedProduct).taxRate}%
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {/* GST Information */}
      {(product?.isGstApplicable ||
        product?.hsnSacCode ||
        product?.cgstRatePercent !== undefined ||
        product?.sgstRatePercent !== undefined ||
        product?.igstRatePercent !== undefined ||
        product?.defaultHsnSacCode ||
        product?.defaultCgstRatePercent !== undefined ||
        product?.defaultSgstRatePercent !== undefined ||
        product?.defaultIgstRatePercent !== undefined) && (
        <Card
          title="GST Information"
          style={{ marginBottom: 16 }}
          extra={
            <Space>
              {!product?.hasVariants && (
                <Button size="small" onClick={openEditProductGst}>
                  Edit GST
                </Button>
              )}
            </Space>
          }
        >
          <Descriptions bordered column={2} size="middle">
            <Descriptions.Item label="GST Applicable">
              <Tag color={product?.isGstApplicable ? 'green' : 'default'}>
                {product?.isGstApplicable ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
            {!product?.hasVariants ? (
              <>
                {product?.hsnSacCode && (
                  <Descriptions.Item label="HSN/SAC Code">
                    <Typography.Text code>{product.hsnSacCode}</Typography.Text>
                  </Descriptions.Item>
                )}
                {product?.cgstRatePercent !== undefined && product.cgstRatePercent !== null && (
                  <Descriptions.Item label="CGST Rate">
                    {product.cgstRatePercent}%
                  </Descriptions.Item>
                )}
                {product?.sgstRatePercent !== undefined && product.sgstRatePercent !== null && (
                  <Descriptions.Item label="SGST Rate">
                    {product.sgstRatePercent}%
                  </Descriptions.Item>
                )}
                {product?.igstRatePercent !== undefined && product.igstRatePercent !== null && (
                  <Descriptions.Item label="IGST Rate">
                    {product.igstRatePercent}%
                  </Descriptions.Item>
                )}
              </>
            ) : (
              <>
                {product?.defaultHsnSacCode && (
                  <Descriptions.Item label="Default HSN/SAC Code">
                    <Typography.Text code>{product.defaultHsnSacCode}</Typography.Text>
                    <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      (Default for variants)
                    </Typography.Text>
                  </Descriptions.Item>
                )}
                {product?.defaultCgstRatePercent !== undefined &&
                  product.defaultCgstRatePercent !== null && (
                    <Descriptions.Item label="Default CGST Rate">
                      {product.defaultCgstRatePercent}%
                      <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                        (Default for variants)
                      </Typography.Text>
                    </Descriptions.Item>
                  )}
                {product?.defaultSgstRatePercent !== undefined &&
                  product.defaultSgstRatePercent !== null && (
                    <Descriptions.Item label="Default SGST Rate">
                      {product.defaultSgstRatePercent}%
                      <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                        (Default for variants)
                      </Typography.Text>
                    </Descriptions.Item>
                  )}
                {product?.defaultIgstRatePercent !== undefined &&
                  product.defaultIgstRatePercent !== null && (
                    <Descriptions.Item label="Default IGST Rate">
                      {product.defaultIgstRatePercent}%
                      <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                        (Default for variants)
                      </Typography.Text>
                    </Descriptions.Item>
                  )}
              </>
            )}
          </Descriptions>
        </Card>
      )}

      {product?.hasVariants && (
        <Card
          title="Product Variants"
          extra={
            <Space>
              <Button type="primary" onClick={openCreateVariant} disabled={!id}>
                Add Variant
              </Button>
            </Space>
          }
        >
          {(!productVariants || productVariants.length === 0) && (
            <Alert
              type="info"
              showIcon
              message="No variants yet"
              description="Create variants using the Add Variant button."
              style={{ marginBottom: 12 }}
            />
          )}
          <Table
            rowKey="_id"
            dataSource={productVariants || []}
            pagination={false}
            scroll={{ x: 1600 }}
            bordered
            size="small"
            rowClassName={(record) =>
              (record as { isDefault?: boolean })?.isDefault ? 'ant-table-row-selected' : ''
            }
            columns={[
              {
                title: 'Image',
                dataIndex: 'mainImage',
                width: 80,
                render: (image: string) =>
                  image ? (
                    <img
                      src={image}
                      alt="Variant"
                      style={{
                        width: 50,
                        height: 50,
                        objectFit: 'cover',
                        borderRadius: 4,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        background: '#f0f0f0',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        No Image
                      </Typography.Text>
                    </div>
                  ),
              },
              // Default switch moved into Actions column
              {
                title: 'Name',
                dataIndex: 'name',
                width: 120,
                render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
              },
              {
                title: 'SKU',
                dataIndex: 'sku',
                width: 150,
                render: (sku: string) => <Typography.Text code>{sku}</Typography.Text>,
              },
              {
                title: 'Attributes',
                dataIndex: 'attributes',
                width: 200,
                render: (attrs: Record<string, string>) => (
                  <Space wrap>
                    {Object.entries(attrs || {}).map(([k, v]) => (
                      <Tag key={k} color="cyan">
                        {k}: {v}
                      </Tag>
                    ))}
                  </Space>
                ),
              },
              {
                title: 'Price',
                dataIndex: 'price',
                width: 100,
                render: (p: number) => <Typography.Text strong>₹{p.toFixed(2)}</Typography.Text>,
              },
              {
                title: 'Compare Price',
                dataIndex: 'comparePrice',
                width: 120,
                render: (p: number) => (p ? `₹${p.toFixed(2)}` : '-'),
              },
              {
                title: 'Cost Price',
                dataIndex: 'costPrice',
                width: 120,
                render: (p: number) => (p ? `₹${p.toFixed(2)}` : '-'),
              },
              {
                title: 'Stock',
                dataIndex: 'stock',
                width: 80,
                render: (stock: number) => <Tag color={stock > 0 ? 'green' : 'red'}>{stock}</Tag>,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                width: 100,
                render: (status: string) => (
                  <Tag
                    color={
                      status === 'active' ? 'green' : status === 'out_of_stock' ? 'red' : 'default'
                    }
                  >
                    {status?.toUpperCase()}
                  </Tag>
                ),
              },
              {
                title: 'HSN/SAC',
                dataIndex: 'hsnSacCode',
                width: 100,
                render: (hsnSacCode: string | null | undefined) =>
                  hsnSacCode ? (
                    <Typography.Text code>{hsnSacCode}</Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">-</Typography.Text>
                  ),
              },
              {
                title: 'CGST %',
                dataIndex: 'cgstRatePercent',
                width: 90,
                render: (cgst: number | null | undefined) =>
                  cgst !== undefined && cgst !== null ? (
                    <Typography.Text>{cgst}%</Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">-</Typography.Text>
                  ),
              },
              {
                title: 'SGST %',
                dataIndex: 'sgstRatePercent',
                width: 90,
                render: (sgst: number | null | undefined) =>
                  sgst !== undefined && sgst !== null ? (
                    <Typography.Text>{sgst}%</Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">-</Typography.Text>
                  ),
              },
              {
                title: 'IGST %',
                dataIndex: 'igstRatePercent',
                width: 90,
                render: (igst: number | null | undefined) =>
                  igst !== undefined && igst !== null ? (
                    <Typography.Text>{igst}%</Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">-</Typography.Text>
                  ),
              },
              {
                title: 'Actions',
                width: 210,
                fixed: 'right',
                render: (_: unknown, rec: unknown) => {
                  const record = rec as { _id: string; isDefault?: boolean }
                  return (
                    <Space>
                      <Switch
                        checked={!!record.isDefault}
                        onChange={async (checked) => {
                          if (!id) return
                          modal.confirm({
                            title: checked
                              ? 'Make this the default variant?'
                              : 'Unset default variant?',
                            content: checked
                              ? 'This will mark this variant as default and unset the previous default variant.'
                              : 'Unsetting default will automatically assign another variant as default to keep one default variant at all times.',
                            okText: checked ? 'Set as default' : 'Unset default',
                            cancelText: 'Cancel',
                            onOk: async () => {
                              await updateVariantMutation.mutateAsync({
                                productId: id,
                                variantId: record._id,
                                payload: { isDefault: checked },
                              })
                              message.success(checked ? 'Default variant updated' : 'Default unset')
                              refetchVariants()
                              refetchProduct()
                            },
                          })
                        }}
                        size="small"
                      />
                      <Button
                        size="small"
                        onClick={() => openEditVariant(rec as ProductVariantRow)}
                      >
                        Edit
                      </Button>
                      <Button size="small" onClick={() => openEditGst(rec as ProductVariantRow)}>
                        Edit GST
                      </Button>
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        loading={deleteVariantMutation.isPending}
                        onClick={() => deleteVariant(record._id)}
                      />
                    </Space>
                  )
                },
              },
            ]}
          />
        </Card>
      )}

      <Card title="Product Statistics" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small">
              <Typography.Text type="secondary">Rating</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                {product?.rating || 0} ⭐
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Typography.Text type="secondary">Reviews</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                {product?.reviewCount || 0}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Typography.Text type="secondary">Sold</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#fa8c16' }}>
                {product?.soldCount || 0}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Typography.Text type="secondary">Views</Typography.Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#722ed1' }}>
                {product?.viewCount || 0}
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      {!product?.hasVariants && (
        <Card
          title="Inventory Management"
          extra={
            <Space>
              <Typography.Text strong style={{ fontSize: 14 }}>
                Total Stock:{' '}
                <span style={{ color: '#1890ff' }}>
                  {(() => {
                    const warehouseInventory =
                      (
                        product as Product & {
                          warehouseInventory?: WarehouseInventoryItem[]
                        }
                      )?.warehouseInventory || []
                    return warehouseInventory.reduce((sum, wi) => sum + (wi.quantity || 0), 0)
                  })()}
                </span>
              </Typography.Text>
              <Button onClick={() => setIsAdjustOpen(true)}>Adjust Stock</Button>
            </Space>
          }
        >
          {(() => {
            const warehouseInventory =
              (
                product as Product & {
                  warehouseInventory?: WarehouseInventoryItem[]
                }
              )?.warehouseInventory || []

            if (warehouseInventory.length === 0) {
              return (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <Typography.Text type="secondary">
                    No warehouse inventory assigned yet.
                  </Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Click "Adjust Stock" to add inventory to warehouses.
                  </Typography.Text>
                </div>
              )
            }

            return (
              <Table
                rowKey={(record, index) => record.warehouseId || `warehouse-${index}`}
                dataSource={warehouseInventory}
                pagination={false}
                columns={[
                  {
                    title: 'Warehouse',
                    key: 'warehouseName',
                    render: (_: unknown, record: WarehouseInventoryItem) => {
                      // Try to find the warehouse details from pickup addresses
                      const warehouse = pickupAddresses.find((addr: PickupAddress) => {
                        const addrWithId = addr as PickupAddress & {
                          _id?: string
                          courierCartPickupAddressId?: string
                        }
                        return (
                          (addrWithId._id && String(addrWithId._id) === record.warehouseId) ||
                          (addrWithId.courierCartPickupAddressId &&
                            String(addrWithId.courierCartPickupAddressId) === record.warehouseId)
                        )
                      })

                      const addrWithProps = warehouse as
                        | (PickupAddress & {
                            city?: string
                            state?: string
                          })
                        | undefined

                      return (
                        <div>
                          <Typography.Text strong>{record.warehouseName}</Typography.Text>
                          {addrWithProps && (addrWithProps.city || addrWithProps.state) && (
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {[addrWithProps.city, addrWithProps.state]
                                  .filter(Boolean)
                                  .join(', ')}
                              </Typography.Text>
                            </div>
                          )}
                        </div>
                      )
                    },
                  },
                  {
                    title: 'Quantity',
                    dataIndex: 'quantity',
                    align: 'right',
                    render: (quantity: number) => (
                      <Typography.Text strong style={{ fontSize: 16 }}>
                        {quantity || 0}
                      </Typography.Text>
                    ),
                  },
                  {
                    title: 'Low Stock Threshold',
                    dataIndex: 'lowStockThreshold',
                    align: 'right',
                    render: (threshold: number) => (
                      <Typography.Text>{threshold || 5}</Typography.Text>
                    ),
                  },
                  {
                    title: 'Status',
                    key: 'status',
                    render: (_: unknown, record: WarehouseInventoryItem) => {
                      const qty = record.quantity || 0
                      const threshold = record.lowStockThreshold || 5

                      if (qty === 0) {
                        return <Tag color="red">Out of Stock</Tag>
                      } else if (qty <= threshold) {
                        return <Tag color="orange">Low Stock</Tag>
                      } else {
                        return <Tag color="green">In Stock</Tag>
                      }
                    },
                  },
                ]}
              />
            )
          })()}
        </Card>
      )}

      <WarehouseInventoryAdjustModal
        open={isAdjustOpen}
        onCancel={() => setIsAdjustOpen(false)}
        onSave={handleWarehouseInventoryAdjust}
        loading={updateProductMutation.isPending}
        currentWarehouseInventory={
          (
            product as Product & {
              warehouseInventory?: WarehouseInventoryItem[]
            }
          )?.warehouseInventory || []
        }
        pickupAddresses={pickupAddresses}
      />

      <Modal
        title="Add Product Variants"
        open={isVariantModalOpen}
        onCancel={closeVariantModal}
        footer={null}
        destroyOnHidden
        width={1500}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Smart Attribute Selector */}
          <SmartAttributeSelector
            selectedAttributes={selectedAttributes}
            onAttributesChange={handleAttributesChange}
            onCustomAttributesChange={setCustomAttributes}
            customAttributes={customAttributes}
          />

          {/* Attribute Value Selectors */}
          {selectedAttributes.length > 0 && (
            <div>
              <Title level={5} style={{ marginBottom: 16 }}>
                Select Attribute Values
              </Title>
              {selectedAttributes.map((attrKey: string) => {
                const allAttributes = [...availableAttributes, ...customAttributes]
                const config = allAttributes.find((a: AttributeConfig) => a.key === attrKey)
                if (!config) return null

                return (
                  <AttributeSelector
                    key={attrKey}
                    config={config}
                    selectedValues={attributeValues[attrKey] || []}
                    onChange={(values: string[]) => handleAttributeValuesChange(attrKey, values)}
                  />
                )
              })}
            </div>
          )}

          {/* Variant Generator */}
          {selectedAttributes.length > 0 && (
            <div>
              <VariantGenerator
                selectedAttributes={selectedAttributes}
                attributeValues={attributeValues}
                basePrice={product?.price || 0}
                baseSku={product?.sku || 'SKU'}
                baseName={product?.name || ''}
                manualDefault={true}
                onVariantsChange={handleVariantsChange}
              />
            </div>
          )}

          {/* Inline pricing and images table for generated variants */}
          {generatedVariants.length > 0 && (
            <Card title="Variant Details" size="small" style={{ borderRadius: 8 }}>
              <Table
                dataSource={generatedVariants}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
                columns={[
                  {
                    title: 'Variant',
                    dataIndex: 'name',
                    width: 220,
                    render: (name: string, record: GeneratedVariantRow) => (
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Input
                          value={name}
                          onChange={(e) =>
                            updateGeneratedVariant(record.id, {
                              name: e.target.value,
                            })
                          }
                        />
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          SKU
                        </Typography.Text>
                        <Input
                          value={record.sku}
                          onChange={(e) =>
                            updateGeneratedVariant(record.id, {
                              sku: e.target.value,
                            })
                          }
                        />
                      </Space>
                    ),
                  },
                  {
                    title: 'Price (₹)',
                    dataIndex: 'price',
                    width: 120,
                    render: (price: number, record: GeneratedVariantRow) => (
                      <InputNumber
                        value={price || 0}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(v) => updateGeneratedVariant(record.id, { price: v || 0 })}
                      />
                    ),
                  },
                  {
                    title: 'Cost (₹)',
                    dataIndex: 'costPrice',
                    width: 120,
                    render: (cost: number, record: GeneratedVariantRow) => (
                      <InputNumber
                        value={cost || 0}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          updateGeneratedVariant(record.id, {
                            costPrice: v || 0,
                          })
                        }
                      />
                    ),
                  },
                  {
                    title: 'Compare (₹)',
                    dataIndex: 'comparePrice',
                    width: 130,
                    render: (cp: number, record: GeneratedVariantRow) => (
                      <InputNumber
                        value={cp || 0}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          updateGeneratedVariant(record.id, {
                            comparePrice: v || 0,
                          })
                        }
                      />
                    ),
                  },
                  {
                    title: 'Discount %',
                    dataIndex: 'discountPercent',
                    width: 120,
                    render: (dp: number, record: GeneratedVariantRow) => (
                      <InputNumber
                        value={dp || 0}
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          updateGeneratedVariant(record.id, {
                            discountPercent: v || 0,
                          })
                        }
                      />
                    ),
                  },
                  {
                    title: 'Stock',
                    dataIndex: 'stock',
                    width: 100,
                    render: (stock: number, record: GeneratedVariantRow) => (
                      <InputNumber
                        value={stock || 0}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(v) => updateGeneratedVariant(record.id, { stock: v || 0 })}
                      />
                    ),
                  },
                  {
                    title: 'Low Stock Threshold',
                    dataIndex: 'lowStockThreshold',
                    width: 160,
                    render: (lst: number, record: GeneratedVariantRow) => (
                      <InputNumber
                        value={lst ?? 5}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          updateGeneratedVariant(record.id, {
                            lowStockThreshold: v ?? 5,
                          })
                        }
                      />
                    ),
                  },

                  {
                    title: 'Main Image',
                    dataIndex: 'mainImage',
                    width: 160,
                    render: (
                      mainImage: GeneratedVariantRow['mainImage'],
                      record: GeneratedVariantRow,
                    ) => {
                      const fileList: UploadFile[] = mainImage
                        ? [
                            {
                              uid: mainImage.uid || 'main-1',
                              name: 'main-image',
                              status: 'done',
                              url: mainImage.url,
                              originFileObj: mainImage.originFileObj as RcFile | undefined,
                            } as UploadFile,
                          ]
                        : []
                      return (
                        <Upload
                          listType="picture-card"
                          fileList={fileList}
                          beforeUpload={() => false}
                          maxCount={1}
                          onChange={(info) => {
                            const f = info.fileList[0]
                            if (!f) {
                              updateGeneratedVariant(record.id, {
                                mainImage: null,
                              })
                              return
                            }
                            updateGeneratedVariant(record.id, {
                              mainImage: {
                                uid: f.uid,
                                url: (f as UploadFile).url,
                                originFileObj: f.originFileObj as RcFile | undefined,
                              },
                            })
                          }}
                        >
                          {(!fileList || fileList.length === 0) && '+ Upload'}
                        </Upload>
                      )
                    },
                  },
                  {
                    title: 'Images',
                    dataIndex: 'images',
                    width: 220,
                    render: (
                      images: GeneratedVariantRow['images'],
                      record: GeneratedVariantRow,
                    ) => {
                      const fileList: UploadFile[] = (images || []).map(
                        (img: GeneratedVariantRow['images'][number], idx: number) => ({
                          uid: img.uid || `img-${idx}`,
                          name: `image-${idx}`,
                          status: 'done',
                          url: img.url,
                          originFileObj: img.originFileObj,
                        }),
                      )
                      return (
                        <Upload
                          listType="picture-card"
                          multiple
                          beforeUpload={() => false}
                          fileList={fileList}
                          onChange={(info) => {
                            const mapped: GeneratedVariantRow['images'] = info.fileList.map(
                              (f) => ({
                                uid: f.uid,
                                url: f.url,
                                originFileObj: f.originFileObj as RcFile | undefined,
                              }),
                            )
                            updateGeneratedVariant(record.id, {
                              images: mapped,
                            })
                          }}
                        >
                          + Upload
                        </Upload>
                      )
                    },
                  },
                ]}
              />
            </Card>
          )}

          {/* Warehouse Inventory Section */}
          {generatedVariants.length > 0 && (
            <Card title="Warehouse Stock Distribution" size="small" style={{ borderRadius: 8 }}>
              {pickupAddresses.length === 0 ? (
                <Alert
                  message="No Warehouses Configured"
                  description="Please add pickup addresses (warehouses) in Store Settings before assigning inventory."
                  type="warning"
                  showIcon
                />
              ) : (
                generatedVariants.map((variant) => {
                  const variantWarehouseInventory = variant.warehouseInventory || []
                  const availableWarehouses = (pickupAddresses as PickupAddressWithId[]).filter(
                    (addr, addrIndex) => {
                      const warehouseId = getWarehouseId(addr, addrIndex)
                      return !variantWarehouseInventory.some((wi) => wi.warehouseId === warehouseId)
                    },
                  )

                  return (
                    <div key={variant.id} style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          marginBottom: 12,
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {variant.name}
                      </div>
                      {availableWarehouses.length > 0 && (
                        <Card
                          size="small"
                          style={{
                            marginBottom: 16,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                          }}
                          bodyStyle={{ padding: '16px' }}
                        >
                          <Row gutter={16} align="middle">
                            <Col flex="auto">
                              <div style={{ color: '#fff' }}>
                                <div
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    marginBottom: 4,
                                  }}
                                >
                                  Add Stock to Warehouse
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.9 }}>
                                  Select a warehouse from the dropdown to add stock
                                </div>
                              </div>
                            </Col>
                            <Col>
                              <Select
                                className="warehouse-select"
                                placeholder="Select warehouse..."
                                style={{ width: 300, background: '#fff' }}
                                size="large"
                                showSearch
                                optionFilterProp="children"
                                filterOption={(input, option) => {
                                  const label = String(option?.label || option?.children || '')
                                  return label.toLowerCase().includes(input.toLowerCase())
                                }}
                                onChange={(value: string) => {
                                  const selectedWarehouse = findPickupAddressById(value)
                                  if (selectedWarehouse && value) {
                                    const updated = [
                                      ...variantWarehouseInventory,
                                      {
                                        warehouseId: value,
                                        warehouseName: selectedWarehouse.warehouseName,
                                        quantity: 0,
                                        lowStockThreshold: 5,
                                      },
                                    ]
                                    updateGeneratedVariant(variant.id, {
                                      warehouseInventory: updated,
                                    })
                                  }
                                }}
                                value={null}
                              >
                                {availableWarehouses.map((addr, addrIndex) => {
                                  const warehouseId = getWarehouseId(addr, addrIndex)
                                  return (
                                    <Select.Option key={warehouseId} value={warehouseId}>
                                      {addr.warehouseName} ({addr.city}, {addr.state})
                                    </Select.Option>
                                  )
                                })}
                              </Select>
                            </Col>
                          </Row>
                        </Card>
                      )}
                      {variantWarehouseInventory.length > 0 ? (
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#262626',
                              marginBottom: 12,
                            }}
                          >
                            Assigned Warehouses ({variantWarehouseInventory.length})
                          </div>
                          <Row gutter={[16, 16]}>
                            {variantWarehouseInventory.map((wi, entryIdx) => {
                              const addr = findPickupAddressById(wi.warehouseId)
                              if (!addr) return null

                              return (
                                <Col xs={24} sm={12} md={8} lg={6} key={wi.warehouseId}>
                                  <Card
                                    size="small"
                                    style={{
                                      border: '2px solid #1890ff',
                                      background: '#f0f7ff',
                                    }}
                                    bodyStyle={{ padding: '12px' }}
                                  >
                                    <div style={{ marginBottom: 8 }}>
                                      <div
                                        style={{
                                          fontWeight: 600,
                                          fontSize: 13,
                                          marginBottom: 4,
                                        }}
                                      >
                                        {wi.warehouseName || addr.warehouseName}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 11,
                                          color: '#8c8c8c',
                                        }}
                                      >
                                        {addr.city}, {addr.state}
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{ marginBottom: 8 }}>
                                        <div
                                          style={{
                                            fontSize: 11,
                                            color: '#595959',
                                            marginBottom: 4,
                                          }}
                                        >
                                          Quantity
                                        </div>
                                        <InputNumber
                                          min={0}
                                          value={wi.quantity ?? 0}
                                          style={{ width: '100%' }}
                                          size="small"
                                          onChange={(value) => {
                                            const numValue = value ?? 0
                                            const updated = [...variantWarehouseInventory]
                                            updated[entryIdx] = {
                                              ...updated[entryIdx],
                                              quantity: numValue,
                                            }
                                            updateGeneratedVariant(variant.id, {
                                              warehouseInventory: updated,
                                            })
                                          }}
                                        />
                                      </div>
                                      <div style={{ marginBottom: 8 }}>
                                        <div
                                          style={{
                                            fontSize: 11,
                                            color: '#595959',
                                            marginBottom: 4,
                                          }}
                                        >
                                          Low Stock Threshold
                                        </div>
                                        <InputNumber
                                          min={0}
                                          value={wi.lowStockThreshold || 5}
                                          style={{ width: '100%' }}
                                          size="small"
                                          onChange={(value) => {
                                            const updated = [...variantWarehouseInventory]
                                            updated[entryIdx] = {
                                              ...updated[entryIdx],
                                              lowStockThreshold: value || 5,
                                            }
                                            updateGeneratedVariant(variant.id, {
                                              warehouseInventory: updated,
                                            })
                                          }}
                                        />
                                      </div>
                                      <Button
                                        type="link"
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() => {
                                          const updated = variantWarehouseInventory.filter(
                                            (_: WarehouseInventoryItem, i: number) =>
                                              i !== entryIdx,
                                          )
                                          updateGeneratedVariant(variant.id, {
                                            warehouseInventory: updated,
                                          })
                                        }}
                                        style={{ padding: 0, height: 'auto' }}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </Card>
                                </Col>
                              )
                            })}
                          </Row>
                        </div>
                      ) : (
                        <Alert
                          message="No Warehouses Assigned"
                          description="Select a warehouse from the dropdown above to add stock for this variant."
                          type="info"
                          showIcon
                        />
                      )}
                    </div>
                  )
                })
              )}
            </Card>
          )}

          {selectedAttributes.length === 0 && (
            <Alert
              message="Select Attributes"
              description="Choose one or more attributes (color, size, material, etc.) to create variants for your product."
              type="warning"
              showIcon
            />
          )}

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={closeVariantModal}>Cancel</Button>
            <Button
              type="primary"
              onClick={submitVariants}
              loading={createVariantMutation.isPending}
              disabled={generatedVariants.length === 0}
            >
              Create {generatedVariants.length} Variants
            </Button>
          </Space>
        </Space>
      </Modal>

      <Modal
        title="Set Exact Stock"
        open={isSetOpen}
        onCancel={() => setIsSetOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form layout="vertical" onFinish={handleSet}>
          <Form.Item
            label="Stock"
            name="stock"
            rules={[{ required: true, message: 'Enter stock' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={1000000} />
          </Form.Item>
          <Form.Item label="Reason" name="reason">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space>
            <Button onClick={() => setIsSetOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={setMutation.isPending}>
              Save
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="Set Low Stock Threshold"
        open={isThresholdOpen}
        onCancel={() => setIsThresholdOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form layout="vertical" onFinish={handleThreshold}>
          <Form.Item
            label="Threshold"
            name="threshold"
            rules={[{ required: true, message: 'Enter threshold' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={1000000} />
          </Form.Item>
          <Space>
            <Button onClick={() => setIsThresholdOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={thresholdMutation.isPending}>
              Save
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* Edit Variant Modal */}
      <Modal
        title="Edit Variant"
        open={isEditVariantModalOpen}
        onCancel={closeEditVariantModal}
        footer={null}
        destroyOnHidden
        width={1000}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Inline pricing and images for editing */}
          {generatedVariants.length > 0 && (
            <Card title="Variant Details" size="small" style={{ borderRadius: 8 }}>
              <Table
                dataSource={generatedVariants}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
                columns={[
                  {
                    title: 'Variant',
                    dataIndex: 'name',
                    width: 220,
                    render: (name: string, record) => (
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Input
                          value={name}
                          onChange={(e) =>
                            updateGeneratedVariant(record.id, {
                              name: e.target.value,
                            })
                          }
                        />
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          SKU
                        </Typography.Text>
                        <Input
                          value={record.sku}
                          onChange={(e) =>
                            updateGeneratedVariant(record.id, {
                              sku: e.target.value,
                            })
                          }
                        />
                      </Space>
                    ),
                  },
                  {
                    title: 'Price (₹)',
                    dataIndex: 'price',
                    width: 120,
                    render: (price: number, record) => (
                      <InputNumber
                        value={price || 0}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(v) => updateGeneratedVariant(record.id, { price: v || 0 })}
                      />
                    ),
                  },
                  {
                    title: 'Cost (₹)',
                    dataIndex: 'costPrice',
                    width: 120,
                    render: (cost: number, record) => (
                      <InputNumber
                        value={cost || 0}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          updateGeneratedVariant(record.id, {
                            costPrice: v || 0,
                          })
                        }
                      />
                    ),
                  },
                  {
                    title: 'Compare (₹)',
                    dataIndex: 'comparePrice',
                    width: 130,
                    render: (cp: number, record) => (
                      <InputNumber
                        value={cp || 0}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          updateGeneratedVariant(record.id, {
                            comparePrice: v || 0,
                          })
                        }
                      />
                    ),
                  },
                  {
                    title: 'Discount %',
                    dataIndex: 'discountPercent',
                    width: 120,
                    render: (dp: number, record) => (
                      <InputNumber
                        value={dp || 0}
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          updateGeneratedVariant(record.id, {
                            discountPercent: v || 0,
                          })
                        }
                      />
                    ),
                  },
                  {
                    title: 'Stock',
                    dataIndex: 'stock',
                    width: 100,
                    render: (stock: number, record) => (
                      <InputNumber
                        value={stock || 0}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(v) => updateGeneratedVariant(record.id, { stock: v || 0 })}
                      />
                    ),
                  },
                  {
                    title: 'Low Stock Threshold',
                    dataIndex: 'lowStockThreshold',
                    width: 160,
                    render: (lst: number, record) => (
                      <InputNumber
                        value={lst ?? 5}
                        min={0}
                        style={{ width: '100%' }}
                        onChange={(v) =>
                          updateGeneratedVariant(record.id, {
                            lowStockThreshold: v ?? 5,
                          })
                        }
                      />
                    ),
                  },
                  {
                    title: 'Main Image',
                    dataIndex: 'mainImage',
                    width: 160,
                    render: (mainImage, record) => {
                      const fileList: UploadFile[] = mainImage
                        ? [
                            {
                              uid: mainImage.uid || 'main-1',
                              name: 'main-image',
                              status: 'done',
                              url: mainImage.url,
                              originFileObj: mainImage.originFileObj,
                            } as UploadFile,
                          ]
                        : []
                      return (
                        <Upload
                          listType="picture-card"
                          fileList={fileList}
                          beforeUpload={() => false}
                          maxCount={1}
                          onChange={(info) => {
                            const f = info.fileList[0]
                            if (!f) {
                              updateGeneratedVariant(record.id, {
                                mainImage: null,
                              })
                              return
                            }
                            updateGeneratedVariant(record.id, {
                              mainImage: {
                                uid: f.uid,
                                url: f?.url,
                                originFileObj: f.originFileObj as RcFile | undefined,
                              },
                            })
                          }}
                        >
                          {(!fileList || fileList.length === 0) && '+ Upload'}
                        </Upload>
                      )
                    },
                  },
                  {
                    title: 'Images',
                    dataIndex: 'images',
                    width: 220,
                    render: (images, record) => {
                      const fileList: UploadFile[] = (images || []).map(
                        (
                          img: {
                            uid?: string
                            url?: string
                            originFileObj?: RcFile
                          },
                          idx: number,
                        ) => ({
                          uid: img.uid || `img-${idx}`,
                          name: `image-${idx}`,
                          status: 'done',
                          url: img.url,
                          originFileObj: img.originFileObj,
                        }),
                      )
                      return (
                        <Upload
                          listType="picture-card"
                          multiple
                          beforeUpload={() => false}
                          fileList={fileList}
                          onChange={(info) => {
                            const mapped = info.fileList.map((f) => ({
                              uid: f.uid,
                              url: f?.url,
                              originFileObj: f.originFileObj as RcFile | undefined,
                            }))
                            updateGeneratedVariant(record.id, {
                              images: mapped,
                            })
                          }}
                        >
                          + Upload
                        </Upload>
                      )
                    },
                  },
                ]}
              />
            </Card>
          )}

          {/* Warehouse Inventory Section */}
          {generatedVariants.length > 0 && (
            <Card title="Warehouse Stock Distribution" size="small" style={{ borderRadius: 8 }}>
              {pickupAddresses.length === 0 ? (
                <Alert
                  message="No Warehouses Configured"
                  description="Please add pickup addresses (warehouses) in Store Settings before assigning inventory."
                  type="warning"
                  showIcon
                />
              ) : (
                generatedVariants.map((variant) => {
                  const variantWarehouseInventory = variant.warehouseInventory || []
                  const availableWarehouses = (pickupAddresses as PickupAddressWithId[]).filter(
                    (addr, addrIndex) => {
                      const warehouseId = getWarehouseId(addr, addrIndex)
                      return !variantWarehouseInventory.some((wi) => wi.warehouseId === warehouseId)
                    },
                  )

                  return (
                    <div key={variant.id} style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          marginBottom: 12,
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {variant.name}
                      </div>
                      {availableWarehouses.length > 0 && (
                        <Card
                          size="small"
                          style={{
                            marginBottom: 16,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                          }}
                          bodyStyle={{ padding: '16px' }}
                        >
                          <Row gutter={16} align="middle">
                            <Col flex="auto">
                              <div style={{ color: '#fff' }}>
                                <div
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    marginBottom: 4,
                                  }}
                                >
                                  Add Stock to Warehouse
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.9 }}>
                                  Select a warehouse from the dropdown to add stock
                                </div>
                              </div>
                            </Col>
                            <Col>
                              <Select
                                className="warehouse-select"
                                placeholder="Select warehouse..."
                                style={{ width: 300, background: '#fff' }}
                                size="large"
                                showSearch
                                optionFilterProp="children"
                                filterOption={(input, option) => {
                                  const label = String(option?.label || option?.children || '')
                                  return label.toLowerCase().includes(input.toLowerCase())
                                }}
                                onChange={(value: string) => {
                                  const selectedWarehouse = findPickupAddressById(value)
                                  if (selectedWarehouse && value) {
                                    const updated = [
                                      ...variantWarehouseInventory,
                                      {
                                        warehouseId: value,
                                        warehouseName: selectedWarehouse.warehouseName,
                                        quantity: 0,
                                        lowStockThreshold: 5,
                                      },
                                    ]
                                    updateGeneratedVariant(variant.id, {
                                      warehouseInventory: updated,
                                    })
                                  }
                                }}
                                value={null}
                              >
                                {availableWarehouses.map((addr, addrIndex) => {
                                  const warehouseId = getWarehouseId(addr, addrIndex)
                                  return (
                                    <Select.Option key={warehouseId} value={warehouseId}>
                                      {addr.warehouseName} ({addr.city}, {addr.state})
                                    </Select.Option>
                                  )
                                })}
                              </Select>
                            </Col>
                          </Row>
                        </Card>
                      )}
                      {variantWarehouseInventory.length > 0 ? (
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#262626',
                              marginBottom: 12,
                            }}
                          >
                            Assigned Warehouses ({variantWarehouseInventory.length})
                          </div>
                          <Row gutter={[16, 16]}>
                            {variantWarehouseInventory.map((wi, entryIdx) => {
                              const addr = findPickupAddressById(wi.warehouseId)
                              if (!addr) return null

                              return (
                                <Col xs={24} sm={12} md={8} lg={6} key={wi.warehouseId}>
                                  <Card
                                    size="small"
                                    style={{
                                      border: '2px solid #1890ff',
                                      background: '#f0f7ff',
                                    }}
                                    bodyStyle={{ padding: '12px' }}
                                  >
                                    <div style={{ marginBottom: 8 }}>
                                      <div
                                        style={{
                                          fontWeight: 600,
                                          fontSize: 13,
                                          marginBottom: 4,
                                        }}
                                      >
                                        {wi.warehouseName || addr.warehouseName}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 11,
                                          color: '#8c8c8c',
                                        }}
                                      >
                                        {addr.city}, {addr.state}
                                      </div>
                                    </div>
                                    <div>
                                      <div style={{ marginBottom: 8 }}>
                                        <div
                                          style={{
                                            fontSize: 11,
                                            color: '#595959',
                                            marginBottom: 4,
                                          }}
                                        >
                                          Quantity
                                        </div>
                                        <InputNumber
                                          min={0}
                                          value={wi.quantity ?? 0}
                                          style={{ width: '100%' }}
                                          size="small"
                                          onChange={(value) => {
                                            const numValue = value ?? 0
                                            const updated = [...variantWarehouseInventory]
                                            updated[entryIdx] = {
                                              ...updated[entryIdx],
                                              quantity: numValue,
                                            }
                                            updateGeneratedVariant(variant.id, {
                                              warehouseInventory: updated,
                                            })
                                          }}
                                        />
                                      </div>
                                      <div style={{ marginBottom: 8 }}>
                                        <div
                                          style={{
                                            fontSize: 11,
                                            color: '#595959',
                                            marginBottom: 4,
                                          }}
                                        >
                                          Low Stock Threshold
                                        </div>
                                        <InputNumber
                                          min={0}
                                          value={wi.lowStockThreshold || 5}
                                          style={{ width: '100%' }}
                                          size="small"
                                          onChange={(value) => {
                                            const updated = [...variantWarehouseInventory]
                                            updated[entryIdx] = {
                                              ...updated[entryIdx],
                                              lowStockThreshold: value || 5,
                                            }
                                            updateGeneratedVariant(variant.id, {
                                              warehouseInventory: updated,
                                            })
                                          }}
                                        />
                                      </div>
                                      <Button
                                        type="link"
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() => {
                                          const updated = variantWarehouseInventory.filter(
                                            (_: WarehouseInventoryItem, i: number) =>
                                              i !== entryIdx,
                                          )
                                          updateGeneratedVariant(variant.id, {
                                            warehouseInventory: updated,
                                          })
                                        }}
                                        style={{ padding: 0, height: 'auto' }}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </Card>
                                </Col>
                              )
                            })}
                          </Row>
                        </div>
                      ) : (
                        <Alert
                          message="No Warehouses Assigned"
                          description="Select a warehouse from the dropdown above to add stock for this variant."
                          type="info"
                          showIcon
                        />
                      )}
                    </div>
                  )
                })
              )}
            </Card>
          )}

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={closeEditVariantModal}>Cancel</Button>
            <Button
              type="primary"
              onClick={async () => {
                if (!id || !editingVariant || generatedVariants.length === 0) return

                try {
                  for (const v of generatedVariants) {
                    // Build media payload compatible with variants API mappers
                    const mediaMain = v.mainImage
                      ? v.mainImage.originFileObj
                        ? { originFileObj: v.mainImage.originFileObj }
                        : v.mainImage.url
                        ? { url: v.mainImage.url }
                        : undefined
                      : undefined

                    const mediaImages = (v.images || []).map((img) =>
                      img.originFileObj ? { originFileObj: img.originFileObj } : { url: img.url },
                    )

                    const mappedPayload = {
                      name: v.name,
                      sku: v.sku,
                      attributes: v.attributes,
                      price: v.price ?? 0,
                      costPrice: v.costPrice ?? 0,
                      comparePrice: v.comparePrice ?? 0,
                      discountPercent: v.discountPercent ?? 0,
                      stock: v.stock ?? 0,
                      lowStockThreshold: v.lowStockThreshold ?? 5,
                      warehouseInventory: v.warehouseInventory || undefined,
                      mainImage: mediaMain,
                      images: mediaImages,
                    }

                    if (v.id === editingVariant._id) {
                      await updateVariantMutation.mutateAsync({
                        productId: id,
                        variantId: editingVariant._id,
                        payload: mappedPayload,
                      })
                    } else {
                      await createVariantMutation.mutateAsync({
                        productId: id,
                        payload: mappedPayload,
                      })
                    }
                  }

                  message.success(
                    generatedVariants.length > 1
                      ? 'Variant updated and new variants added'
                      : 'Variant updated successfully',
                  )
                  closeEditVariantModal()
                  refetchVariants()
                  refetchProduct()
                } catch (error) {
                  console.error('Error updating/creating variants:', error)
                  message.error('Failed to save variant changes')
                }
              }}
              loading={updateVariantMutation.isPending}
              disabled={generatedVariants.length === 0}
            >
              Update Variant
            </Button>
          </Space>
        </Space>
      </Modal>

      {/* Edit GST Modal */}
      <Modal
        title="Edit GST Information"
        open={isEditGstModalOpen}
        onCancel={closeEditGstModal}
        footer={null}
        destroyOnClose
        width={600}
      >
        {editingGstVariant && (
          <div style={{ marginBottom: 16 }}>
            <Typography.Text strong>Variant: </Typography.Text>
            <Typography.Text>{editingGstVariant.name}</Typography.Text>
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              SKU: {editingGstVariant.sku}
            </Typography.Text>
          </div>
        )}
        <Form
          form={gstForm}
          layout="vertical"
          onFinish={handleGstUpdate}
          initialValues={{
            hsnSacCode: '',
            igstRatePercent: undefined,
            cgstRatePercent: undefined,
            sgstRatePercent: undefined,
          }}
        >
          <Form.Item
            label="HSN/SAC Code"
            name="hsnSacCode"
            tooltip="Harmonized System of Nomenclature (HSN) or Service Accounting Code (SAC). Must be 4, 6, or 8 digits."
            rules={[
              {
                pattern: /^\d{4}$|^\d{6}$|^\d{8}$|^$/,
                message: 'HSN/SAC code must be 4, 6, or 8 digits',
              },
            ]}
          >
            <Input
              placeholder="e.g., 8517"
              maxLength={8}
              onKeyPress={(e) => {
                if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
                  e.preventDefault()
                }
              }}
            />
          </Form.Item>
          <Form.Item
            label="IGST Rate (%)"
            name="igstRatePercent"
            tooltip="Integrated GST rate for inter-state transactions. Selecting a value will auto-split it equally into CGST and SGST (which you can still edit)."
          >
            <Select
              placeholder="Select IGST rate"
              allowClear
              onChange={(value) => {
                // Auto-split IGST into CGST and SGST (equal split)
                if (value !== undefined && value !== null) {
                  const splitValue = value / 2
                  gstForm.setFieldsValue({
                    cgstRatePercent: splitValue,
                    sgstRatePercent: splitValue,
                  })
                } else {
                  // Clear CGST and SGST if IGST is cleared
                  gstForm.setFieldsValue({
                    cgstRatePercent: undefined,
                    sgstRatePercent: undefined,
                  })
                }
              }}
            >
              <Select.Option value={0}>0%</Select.Option>
              <Select.Option value={5}>5%</Select.Option>
              <Select.Option value={12}>12%</Select.Option>
              <Select.Option value={18}>18%</Select.Option>
              <Select.Option value={28}>28%</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="CGST Rate (%)"
            name="cgstRatePercent"
            tooltip="Central GST rate for intra-state transactions. Auto-filled from IGST but can be edited."
            rules={[
              {
                type: 'number',
                min: 0,
                max: 100,
                message: 'CGST rate must be between 0 and 100',
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Enter CGST rate"
              min={0}
              max={100}
              precision={2}
            />
          </Form.Item>

          <Form.Item
            label="SGST Rate (%)"
            name="sgstRatePercent"
            tooltip="State GST rate for intra-state transactions. Auto-filled from IGST but can be edited."
            rules={[
              {
                type: 'number',
                min: 0,
                max: 100,
                message: 'SGST rate must be between 0 and 100',
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Enter SGST rate"
              min={0}
              max={100}
              precision={2}
            />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={closeEditGstModal}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updateVariantMutation.isPending}>
                Update GST Data
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Product GST Modal (for simple products) */}
      <Modal
        title="Edit GST Information"
        open={isEditProductGstModalOpen}
        onCancel={closeEditProductGstModal}
        footer={null}
        destroyOnClose
        width={600}
      >
        <Form
          form={productGstForm}
          layout="vertical"
          onFinish={handleProductGstUpdate}
          initialValues={{
            hsnSacCode: '',
            igstRatePercent: undefined,
            cgstRatePercent: undefined,
            sgstRatePercent: undefined,
          }}
        >
          <Form.Item
            label="HSN/SAC Code"
            name="hsnSacCode"
            tooltip="Harmonized System of Nomenclature (HSN) or Service Accounting Code (SAC). Must be 4, 6, or 8 digits."
            rules={[
              {
                pattern: /^\d{4}$|^\d{6}$|^\d{8}$|^$/,
                message: 'HSN/SAC code must be 4, 6, or 8 digits',
              },
            ]}
          >
            <Input
              placeholder="e.g., 8517"
              maxLength={8}
              onKeyPress={(e) => {
                if (!/[0-9]/.test(e.key) && e.key !== 'Backspace') {
                  e.preventDefault()
                }
              }}
            />
          </Form.Item>
          <Form.Item
            label="IGST Rate (%)"
            name="igstRatePercent"
            tooltip="Integrated GST rate for inter-state transactions. Selecting a value will auto-split it equally into CGST and SGST (which you can still edit)."
          >
            <Select
              placeholder="Select IGST rate"
              allowClear
              onChange={(value) => {
                // Auto-split IGST into CGST and SGST (equal split)
                if (value !== undefined && value !== null) {
                  const splitValue = value / 2
                  productGstForm.setFieldsValue({
                    cgstRatePercent: splitValue,
                    sgstRatePercent: splitValue,
                  })
                } else {
                  // Clear CGST and SGST if IGST is cleared
                  productGstForm.setFieldsValue({
                    cgstRatePercent: undefined,
                    sgstRatePercent: undefined,
                  })
                }
              }}
            >
              <Select.Option value={0}>0%</Select.Option>
              <Select.Option value={5}>5%</Select.Option>
              <Select.Option value={12}>12%</Select.Option>
              <Select.Option value={18}>18%</Select.Option>
              <Select.Option value={28}>28%</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="CGST Rate (%)"
            name="cgstRatePercent"
            tooltip="Central GST rate for intra-state transactions. Auto-filled from IGST but can be edited."
            rules={[
              {
                type: 'number',
                min: 0,
                max: 100,
                message: 'CGST rate must be between 0 and 100',
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Enter CGST rate"
              min={0}
              max={100}
              precision={2}
            />
          </Form.Item>

          <Form.Item
            label="SGST Rate (%)"
            name="sgstRatePercent"
            tooltip="State GST rate for intra-state transactions. Auto-filled from IGST but can be edited."
            rules={[
              {
                type: 'number',
                min: 0,
                max: 100,
                message: 'SGST rate must be between 0 and 100',
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Enter SGST rate"
              min={0}
              max={100}
              precision={2}
            />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={closeEditProductGstModal}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updateProductMutation.isPending}>
                Update GST Data
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default ProductView
