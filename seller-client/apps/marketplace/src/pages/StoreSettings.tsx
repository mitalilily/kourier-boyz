import {
  EditOutlined,
  FileTextOutlined,
  LinkOutlined,
  MailOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TagsOutlined,
  TruckOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { Alert, App, Button, Form, Space, Tabs, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from '../api/profileQueries'
import { useSellerReviewStats } from '../api/reviewQueries'
import type { PackagingStandard, PickupAddress, UpdateStoreData } from '../api/storeQueries'
import { useUpdateStore } from '../api/storeQueries'
import { useAuthStore } from '../store/authStore'
import StoreSettingsTutorial from '../components/StoreSettingsTutorial'
import ComplianceTab from './StoreSettings/components/ComplianceTab'
import ContactTab from './StoreSettings/components/ContactTab'
import GeneralTab from './StoreSettings/components/GeneralTab'
import PoliciesTab from './StoreSettings/components/PoliciesTab'
import PreferencesTab from './StoreSettings/components/PreferencesTab'
import SEOTab from './StoreSettings/components/SEOTab'
import ShippingLogisticsTab from './StoreSettings/components/ShippingLogisticsTab'
import SocialLinksTab from './StoreSettings/components/SocialLinksTab'
import StorefrontTab from './StoreSettings/components/StorefrontTab'
import type { StoreSettingsFormValues } from './StoreSettings/components/types'

const normalizePickupAddressesForForm = (addresses?: PickupAddress[]): PickupAddress[] => {
  if (!Array.isArray(addresses)) return []

  return addresses.map((address, index) => {
    const warehouseName =
      typeof address.warehouseName === 'string' && address.warehouseName.trim().length > 0
        ? address.warehouseName
        : `Warehouse ${index + 1}`

    const toStringValue = (value?: string | number) => {
      if (typeof value === 'number') {
        return value.toString()
      }
      return value || ''
    }

    const rtoSameAsPickup = address.rtoSameAsPickup === false ? false : true
    const normalizedRtoAddress =
      rtoSameAsPickup || !address.rtoAddress
        ? undefined
        : {
            contactName: address.rtoAddress.contactName || '',
            contactPhone: toStringValue(address.rtoAddress.contactPhone),
            contactEmail: address.rtoAddress.contactEmail || '',
            addressLine1: address.rtoAddress.addressLine1 || '',
            addressLine2: address.rtoAddress.addressLine2 || '',
            city: address.rtoAddress.city || '',
            state: address.rtoAddress.state || '',
            postalCode: toStringValue(address.rtoAddress.postalCode),
            country: address.rtoAddress.country || 'India',
          }

    return {
      ...address,
      warehouseName,
      addressLine1: address.addressLine1 || '',
      addressLine2: address.addressLine2 || '',
      city: address.city || '',
      state: address.state || '',
      postalCode: toStringValue(address.postalCode),
      country: address.country || 'India',
      contactName: address.contactName || '',
      contactPhone: toStringValue(address.contactPhone),
      isDefault: address.isDefault || false,
      rtoSameAsPickup,
      rtoAddress: normalizedRtoAddress,
    }
  })
}

const sanitizePickupAddressesForSubmit = (addresses?: PickupAddress[]) => {
  if (!Array.isArray(addresses)) return []

  return addresses.map((address) => {
    const toTrimmedString = (value?: string | number) => {
      if (typeof value === 'number') {
        return value.toString()
      }
      return value?.trim() || ''
    }

    const toPhoneDigits = (value?: string | number) => {
      const trimmed = toTrimmedString(value)
      return trimmed.replace(/\D/g, '')
    }

    const warehouseName = address.warehouseName?.trim() || ''
    const rtoSameAsPickup = address.rtoSameAsPickup === false ? false : true

    const normalizedRtoAddress =
      rtoSameAsPickup || !address.rtoAddress
        ? undefined
        : {
            contactName: address.rtoAddress.contactName?.trim() || '',
            contactPhone: toPhoneDigits(address.rtoAddress.contactPhone),
            contactEmail: address.rtoAddress.contactEmail?.trim() || '',
            addressLine1: address.rtoAddress.addressLine1?.trim() || '',
            addressLine2: address.rtoAddress.addressLine2?.trim() || '',
            city: address.rtoAddress.city?.trim() || '',
            state: address.rtoAddress.state?.trim() || '',
            postalCode: toTrimmedString(address.rtoAddress.postalCode),
            country: address.rtoAddress.country?.trim() || 'India',
          }

    return {
      ...address,
      warehouseName,
      addressLine1: address.addressLine1?.trim() || '',
      addressLine2: address.addressLine2?.trim() || '',
      city: address.city?.trim() || '',
      state: address.state?.trim() || '',
      postalCode: toTrimmedString(address.postalCode),
      country: address.country?.trim() || 'India',
      contactName: address.contactName?.trim() || '',
      contactPhone: toPhoneDigits(address.contactPhone),
      isDefault: address.isDefault || false,
      rtoSameAsPickup,
      rtoAddress: normalizedRtoAddress,
    }
  })
}

interface ProfileData {
  storeDescription?: string
  storeLogo?: string
  storeBanner?: string // Single banner for header
  storefrontBanners?: Array<{
    imageUrl: string
    category?: string
    order: number
    gridSpan: number
  }> // Multiple banners for home page
  storeVideo?: string
  storeVideoFile?: string
  storeStatus?: 'active' | 'inactive'
  storeSlug?: string
  storeTheme?: string
  shippingPolicy?: string
  returnPolicy?: string
  refundPolicy?: string
  cancellationPolicy?: string
  warrantyPolicy?: string
  defaultShippingRate?: number
  website?: string
  facebook?: string
  instagram?: string
  twitter?: string
  youtube?: string
  linkedin?: string
  storeMetaTitle?: string
  storeMetaDescription?: string
  storeKeywords?: string[]
  lowStockNotification?: boolean
  newOrderNotification?: boolean
  storeEmail?: string
  storePhone?: string
  supportEmail?: string
  brandNames?: string[]
  pickupAddresses?: PickupAddress[]
  preferredCouriers?: string[]
  packagingStandards?: PackagingStandard[]
  replacementPolicy?: string
  marketplaceTermsAccepted?: boolean
  sellerAgreementSigned?: boolean
  sellerAgreementSignature?: string // Base64 string or URL
  returnRefundPolicyAccepted?: boolean
  prohibitedItemsDeclared?: boolean
  prohibitedItemsDeclaration?: string
  dataPrivacyConsent?: boolean
}

const { Title, Paragraph } = Typography

const StoreSettings = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const { data: profileData } = useProfile()
  const updateStoreMutation = useUpdateStore()
  const { data: reviewStats, isLoading: isLoadingReviewStats } = useSellerReviewStats()

  const [form] = Form.useForm()
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>([])
  const [bannerFileList, setBannerFileList] = useState<UploadFile[]>([]) // Single banner for header (General tab)
  const [storefrontBanners, setStorefrontBanners] = useState<
    Array<{
      imageUrl: string
      category?: string
      order: number
      gridSpan: number
      file?: File
      tempId?: string
    }>
  >([]) // Multiple banners for home page (Storefront tab)
  const [videoUrl, setVideoUrl] = useState<string>('')
  const [videoFile, setVideoFile] = useState<UploadFile | null>(null)

  // Get tab from URL query parameter
  const getTabFromUrl = () => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    return tab || 'general'
  }

  const [activeTab, setActiveTab] = useState(getTabFromUrl())
  const [runStoreSettingsTour, setRunStoreSettingsTour] = useState(false)

  // Update active tab when URL query parameter changes
  useEffect(() => {
    const tab = getTabFromUrl()
    setActiveTab(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  // Initialize form with default values
  useEffect(() => {
    const currentStatus = form.getFieldValue('storeStatus')
    if (!currentStatus) {
      form.setFieldValue('storeStatus', 'active')
    }
  }, [form])

  // Initialize form with profile data
  useEffect(() => {
    if (profileData) {
      const data = profileData as ProfileData

      const formValues: Record<string, unknown> = {
        storeDescription: data.storeDescription || '',
        storeStatus:
          data.storeStatus && (data.storeStatus === 'active' || data.storeStatus === 'inactive')
            ? data.storeStatus
            : 'active', // Ensure it's always 'active' or 'inactive'
        storeSlug: data.storeSlug || '',
        storeTheme: data.storeTheme || 'modern',
        // Policies
        shippingPolicy: data.shippingPolicy || '',
        returnPolicy: data.returnPolicy || '',
        refundPolicy: data.refundPolicy || '',
        cancellationPolicy: data.cancellationPolicy || '',
        warrantyPolicy: data.warrantyPolicy || '',
        // Shipping
        defaultShippingRate: data.defaultShippingRate || 0,
        // Social Media
        website: data.website || '',
        facebook: data.facebook || '',
        instagram: data.instagram || '',
        twitter: data.twitter || '',
        youtube: data.youtube || '',
        linkedin: data.linkedin || '',
        // SEO
        storeMetaTitle: data.storeMetaTitle || '',
        storeMetaDescription: data.storeMetaDescription || '',
        storeKeywords: data.storeKeywords || [],
        // Preferences
        lowStockNotification: data.lowStockNotification !== false,
        newOrderNotification: data.newOrderNotification !== false,
        // Contact
        storeEmail: data.storeEmail || '',
        storePhone: data.storePhone || '',
        supportEmail: data.supportEmail || '',
        brandNames: data.brandNames || [],
        preferredCouriers: data.preferredCouriers || [],
        packagingStandards: data.packagingStandards || [],
        replacementPolicy: data.replacementPolicy || '',
        marketplaceTermsAccepted: data.marketplaceTermsAccepted ?? false,
        marketplaceTermsPdfUrl:
          'marketplaceTermsPdfUrl' in data ? (data.marketplaceTermsPdfUrl as string) || '' : '',
        sellerAgreementSigned: data.sellerAgreementSigned ?? false,
        sellerAgreementSignature: data.sellerAgreementSignature ?? null,
        sellerAgreementPdfUrl:
          'sellerAgreementPdfUrl' in data ? (data.sellerAgreementPdfUrl as string) || '' : '',
        returnRefundPolicyAccepted: data.returnRefundPolicyAccepted ?? false,
        returnRefundPolicyPdfUrl:
          'returnRefundPolicyPdfUrl' in data ? (data.returnRefundPolicyPdfUrl as string) || '' : '',
        prohibitedItemsDeclared: data.prohibitedItemsDeclared ?? false,
        prohibitedItemsDeclaration: data.prohibitedItemsDeclaration ?? '',
        prohibitedItemsPdfUrl:
          'prohibitedItemsPdfUrl' in data ? (data.prohibitedItemsPdfUrl as string) || '' : '',
        dataPrivacyConsent: data.dataPrivacyConsent ?? false,
        dataPrivacyPdfUrl:
          'dataPrivacyPdfUrl' in data ? (data.dataPrivacyPdfUrl as string) || '' : '',
        pickupAddresses: normalizePickupAddressesForForm(data.pickupAddresses),
      }

      form.setFieldsValue(formValues)

      if (profileData.storeLogo) {
        setLogoFileList([
          {
            uid: '-1',
            name: 'logo',
            status: 'done',
            url: profileData.storeLogo,
          },
        ])
      }

      if (data.storeBanner) {
        setBannerFileList([
          {
            uid: '-1',
            name: 'banner',
            status: 'done',
            url: data.storeBanner,
          },
        ])
      }

      // Load storefront banners
      if (data.storefrontBanners && Array.isArray(data.storefrontBanners)) {
        setStorefrontBanners(data.storefrontBanners.map((banner) => ({ ...banner })))
      }

      // Load video
      if (data.storeVideo) {
        setVideoUrl(data.storeVideo)
      }
      if (data.storeVideoFile) {
        setVideoFile({
          uid: '-1',
          name: 'video',
          status: 'done',
          url: data.storeVideoFile,
        })
      }

      // Load signature if it exists as URL (after save)
      if (data.sellerAgreementSignature && typeof data.sellerAgreementSignature === 'string') {
        // Signature is already a URL from backend - it will be loaded by SignaturePad component
        // Just ensure it's set in form
        form.setFieldValue('sellerAgreementSignature', data.sellerAgreementSignature)
      }
    }
  }, [profileData, form])

  // Check if user is approved
  if (!user?.isApproved) {
    return (
      <div>
        <Alert
          message="Store Settings Unavailable"
          description={
            <div>
              <Paragraph style={{ marginBottom: 12 }}>
                Your account must be approved before you can configure store settings. Complete your
                KYC verification to get started.
              </Paragraph>
              <Space>
                <Button type="primary" onClick={() => navigate('/submit-kyc')}>
                  Complete KYC
                </Button>
                <Button onClick={() => navigate('/profile')}>View Profile</Button>
              </Space>
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      </div>
    )
  }

  const handleSubmit = async (values: StoreSettingsFormValues) => {
    try {
      // Get current form values to preserve compliance fields if not being changed
      const currentMarketplaceTerms = form.getFieldValue('marketplaceTermsAccepted') ?? false
      const currentSellerAgreement = form.getFieldValue('sellerAgreementSigned') ?? false
      const currentSellerSignature = form.getFieldValue('sellerAgreementSignature') ?? null
      const currentReturnRefund = form.getFieldValue('returnRefundPolicyAccepted') ?? false
      const currentProhibitedItems = form.getFieldValue('prohibitedItemsDeclared') ?? false
      const currentProhibitedDeclaration = form.getFieldValue('prohibitedItemsDeclaration') ?? ''
      const currentDataPrivacy = form.getFieldValue('dataPrivacyConsent') ?? false

      const updateData: UpdateStoreData = {
        storeDescription: values.storeDescription,
        storeStatus: values.storeStatus || 'active', // Default to active if not set
        storeSlug: values.storeSlug,
        storeTheme: values.storeTheme || 'modern',
        shippingPolicy: values.shippingPolicy,
        returnPolicy: values.returnPolicy,
        refundPolicy: values.refundPolicy,
        cancellationPolicy: values.cancellationPolicy,
        warrantyPolicy: values.warrantyPolicy,
        defaultShippingRate: values.defaultShippingRate || 0,
        website: values.website,
        facebook: values.facebook,
        instagram: values.instagram,
        twitter: values.twitter,
        youtube: values.youtube,
        linkedin: values.linkedin,
        storeMetaTitle: values.storeMetaTitle,
        storeMetaDescription: values.storeMetaDescription,
        storeKeywords: values.storeKeywords || [],
        lowStockNotification: values.lowStockNotification !== false,
        newOrderNotification: values.newOrderNotification !== false,
        storeEmail: values.storeEmail,
        storePhone: values.storePhone,
        supportEmail: values.supportEmail,
        brandNames: values.brandNames || [],
        preferredCouriers: values.preferredCouriers || [],
        packagingStandards: values.packagingStandards || [],
        replacementPolicy: values.replacementPolicy,
        // Preserve compliance fields - use provided values if available, otherwise keep current values
        marketplaceTermsAccepted:
          values.marketplaceTermsAccepted !== undefined
            ? values.marketplaceTermsAccepted
            : currentMarketplaceTerms,
        sellerAgreementSigned:
          values.sellerAgreementSigned !== undefined
            ? values.sellerAgreementSigned
            : currentSellerAgreement,
        sellerAgreementSignature:
          values.sellerAgreementSignature !== undefined
            ? values.sellerAgreementSignature
            : currentSellerSignature,
        returnRefundPolicyAccepted:
          values.returnRefundPolicyAccepted !== undefined
            ? values.returnRefundPolicyAccepted
            : currentReturnRefund,
        prohibitedItemsDeclared:
          values.prohibitedItemsDeclared !== undefined
            ? values.prohibitedItemsDeclared
            : currentProhibitedItems,
        prohibitedItemsDeclaration:
          values.prohibitedItemsDeclaration !== undefined
            ? values.prohibitedItemsDeclaration
            : currentProhibitedDeclaration,
      dataPrivacyConsent:
        values.dataPrivacyConsent !== undefined ? values.dataPrivacyConsent : currentDataPrivacy,
      }

      // Only include pickupAddresses if we're on the shipping tab
      // This prevents accidentally deleting pickup addresses when submitting from other tabs
      // If on shipping tab, allow both empty and non-empty arrays (user may intentionally clear all addresses)
      if (activeTab === 'shipping' && values.pickupAddresses !== undefined) {
        updateData.pickupAddresses = sanitizePickupAddressesForSubmit(values.pickupAddresses)
      }

      // Handle file uploads
      if (logoFileList.length > 0 && logoFileList[0].originFileObj) {
        updateData.storeLogo = logoFileList[0].originFileObj as File
      }

      // Handle store banner (single banner for header - General tab)
      if (bannerFileList.length > 0 && bannerFileList[0].originFileObj) {
        updateData.storeBanner = bannerFileList[0].originFileObj as File
      }

      // Handle storefront banners (multiple banners for home page - Storefront tab)
      if (storefrontBanners.length > 0) {
        // Collect banner files that need to be uploaded
        const bannerFiles = storefrontBanners
          .map((banner) => banner.file)
          .filter((file): file is File => file !== undefined)

        // Send banner metadata (order, gridSpan, category) - always send metadata
        // Files will be sent separately by the API layer
        updateData.storefrontBanners = storefrontBanners.map((banner) => {
          const { file, ...rest } = banner
          void file
          return rest
        })

        // If there are new files to upload, we need to send them separately
        // The API layer will handle appending files to FormData
        if (bannerFiles.length > 0) {
          // Store files separately - the API layer will handle this
          updateData.storefrontBannerFiles = bannerFiles
        }
      }

      // Handle video (mutually exclusive - either file or URL)
      if (videoFile?.originFileObj) {
        updateData.storeVideoFile = videoFile.originFileObj as File
        updateData.storeVideo = undefined // Clear URL if file is uploaded
      } else if (videoUrl) {
        updateData.storeVideo = videoUrl
        updateData.storeVideoFile = undefined // Clear file if URL is provided
      }

      // Handle signature - if it's a File, send as file, if it's a base64 string, send as string
      if (values.sellerAgreementSignature) {
        if (values.sellerAgreementSignature instanceof File) {
          updateData.sellerAgreementSignature = values.sellerAgreementSignature
        } else if (typeof values.sellerAgreementSignature === 'string') {
          // Base64 string - send as is
          updateData.sellerAgreementSignature = values.sellerAgreementSignature
        }
      }

      await updateStoreMutation.mutateAsync(updateData)
      message.success('Store settings updated successfully!')

      // Profile will be automatically refetched via useUpdateStore's onSuccess callback
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } }
      message.error(err.response?.data?.error || 'Failed to update store settings')
    }
  }

  // Tab order: Identity → Contact → Look → Policies → Fulfillment → Social → Discovery → Preferences → Legal
  const tabItems = [
    {
      key: 'general',
      label: (
        <span data-tour="store-settings-tab-general">
          <ShopOutlined /> General
        </span>
      ),
      children: (
        <GeneralTab
          form={form}
          onSubmit={handleSubmit}
          isLoading={updateStoreMutation.isPending}
          logoFileList={logoFileList}
          bannerFileList={bannerFileList}
          onLogoChange={setLogoFileList}
          onBannerChange={setBannerFileList}
          reviewStats={reviewStats}
          isLoadingReviewStats={isLoadingReviewStats}
        />
      ),
    },
    {
      key: 'contact',
      label: (
        <span data-tour="store-settings-tab-contact">
          <MailOutlined /> Contact
        </span>
      ),
      children: (
        <ContactTab form={form} onSubmit={handleSubmit} isLoading={updateStoreMutation.isPending} />
      ),
    },
    {
      key: 'storefront',
      label: (
        <span data-tour="store-settings-tab-storefront">
          <TagsOutlined /> Storefront & Catalog
        </span>
      ),
      children: (
        <StorefrontTab
          form={form}
          onSubmit={handleSubmit}
          isLoading={updateStoreMutation.isPending}
          storefrontBanners={storefrontBanners.map((banner) => {
            const { file, ...rest } = banner
            void file
            return rest
          })}
          onStorefrontBannersChange={(newBanners) => {
            setStorefrontBanners((prev) => {
              // Preserve file references when updating banners
              return newBanners.map((banner) => {
                const bannerWithTempId = banner as typeof banner & { tempId?: string }
                const prevBanner =
                  prev.find(
                    (p) => p.tempId === bannerWithTempId.tempId || p.imageUrl === banner.imageUrl,
                  ) || prev[newBanners.indexOf(banner)]
                return {
                  ...banner,
                  file: prevBanner?.file,
                  tempId: prevBanner?.tempId,
                }
              })
            })
          }}
          onStorefrontBannersWithFilesChange={(bannersWithFiles) => {
            setStorefrontBanners(bannersWithFiles)
          }}
          videoUrl={videoUrl}
          videoFile={videoFile}
          onVideoUrlChange={setVideoUrl}
          onVideoFileChange={setVideoFile}
        />
      ),
    },
    {
      key: 'policies',
      label: (
        <span data-tour="store-settings-tab-policies">
          <EditOutlined /> Policies
        </span>
      ),
      children: (
        <PoliciesTab
          form={form}
          onSubmit={handleSubmit}
          isLoading={updateStoreMutation.isPending}
        />
      ),
    },
    {
      key: 'shipping',
      label: (
        <span data-tour="store-settings-tab-shipping">
          <TruckOutlined /> Shipping & Logistics
        </span>
      ),
      children: (
        <ShippingLogisticsTab
          form={form}
          onSubmit={handleSubmit}
          isLoading={updateStoreMutation.isPending}
        />
      ),
    },
    {
      key: 'social',
      label: (
        <span data-tour="store-settings-tab-social">
          <LinkOutlined /> Social & Links
        </span>
      ),
      children: (
        <SocialLinksTab
          form={form}
          onSubmit={handleSubmit}
          isLoading={updateStoreMutation.isPending}
        />
      ),
    },
    {
      key: 'seo',
      label: (
        <span data-tour="store-settings-tab-seo">
          <SearchOutlined /> SEO
        </span>
      ),
      children: (
        <SEOTab form={form} onSubmit={handleSubmit} isLoading={updateStoreMutation.isPending} />
      ),
    },
    {
      key: 'preferences',
      label: (
        <span data-tour="store-settings-tab-preferences">
          <SettingOutlined /> Preferences
        </span>
      ),
      children: (
        <PreferencesTab
          form={form}
          onSubmit={handleSubmit}
          isLoading={updateStoreMutation.isPending}
        />
      ),
    },
    {
      key: 'compliance',
      label: (
        <span data-tour="store-settings-tab-compliance">
          <FileTextOutlined /> Compliance & Agreements
        </span>
      ),
      children: (
        <ComplianceTab
          form={form}
          onSubmit={handleSubmit}
          isLoading={updateStoreMutation.isPending}
        />
      ),
    },
  ]

  return (
    <div>
      <StoreSettingsTutorial
        run={runStoreSettingsTour}
        onComplete={() => setRunStoreSettingsTour(false)}
      />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
              Store Settings
            </Title>
            <Paragraph style={{ fontSize: 16, color: '#666', marginBottom: 0 }}>
              Manage your store information, policies, shipping, and preferences.
            </Paragraph>
          </div>
          <Button
            type="default"
            icon={<QuestionCircleOutlined />}
            onClick={() => setRunStoreSettingsTour(true)}
          >
            Tour
          </Button>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key)
          // Update URL without reloading the page
          navigate(`/store-settings?tab=${key}`, { replace: true })
        }}
        items={tabItems}
        size="large"
      />
    </div>
  )
}

export default StoreSettings
