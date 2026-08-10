import API from './axiosInstance'

export interface ShippingZone {
  zone: string
  rate: number
}

export interface RtoAddress {
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface PickupAddress {
  warehouseName: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
  contactName: string
  contactPhone: string
  isDefault?: boolean
  rtoSameAsPickup?: boolean
  rtoAddress?: RtoAddress
}

export interface PackagingStandard {
  type: 'fragile' | 'perishable' | 'hazardous' | 'standard' | 'custom'
  description?: string
}

export interface StoreBanner {
  imageUrl: string
  category?: string
  order: number
  gridSpan: number
}

export interface UpdateStoreData {
  // Store Information
  storeLogo?: File
  storeBanner?: File // Single banner for header (General tab)
  storefrontBanners?: File[] | StoreBanner[] // Multiple banners for home page (Storefront tab) - can be File[] for upload or StoreBanner[] for metadata
  storefrontBannerFiles?: File[]
  storeVideo?: string // Video URL (YouTube, Vimeo, etc.) - mutually exclusive with storeVideoFile
  storeVideoFile?: File // Uploaded video file - mutually exclusive with storeVideo
  storeDescription?: string
  storeStatus?: 'active' | 'inactive'
  storeSlug?: string // Unique URL-friendly identifier for seller microsite
  storeTheme?: string // Theme identifier for seller microsite
  // Store Policies
  shippingPolicy?: string
  returnPolicy?: string
  refundPolicy?: string
  cancellationPolicy?: string
  warrantyPolicy?: string
  // Shipping Settings
  defaultShippingRate?: number
  shippingZones?: ShippingZone[]
  // Social Media & Links
  website?: string
  facebook?: string
  instagram?: string
  twitter?: string
  youtube?: string
  linkedin?: string
  // SEO Settings
  storeMetaTitle?: string
  storeMetaDescription?: string
  storeKeywords?: string[]
  // Store Preferences
  lowStockNotification?: boolean
  newOrderNotification?: boolean
  // Contact Information
  storeEmail?: string
  storePhone?: string
  supportEmail?: string

  // Storefront & Catalog
  brandNames?: string[]
  // Product Categories handled separately

  // Shipping & Logistics
  pickupAddresses?: PickupAddress[]
  preferredCouriers?: string[]
  packagingStandards?: PackagingStandard[]

  // Return & Replacement
  replacementPolicy?: string

  // Compliance & Agreements
  marketplaceTermsAccepted?: boolean
  sellerAgreementSigned?: boolean
  sellerAgreementSignature?: File | string | null // File, base64 string, or null
  returnRefundPolicyAccepted?: boolean
  prohibitedItemsDeclared?: boolean
  prohibitedItemsDeclaration?: string
  dataPrivacyConsent?: boolean
}

export const updateStoreInfo = async (data: UpdateStoreData) => {
  const formData = new FormData()

  // Handle file uploads
  if (data.storeLogo) {
    formData.append('storeLogo', data.storeLogo)
  }

  // Handle store banner (single banner for header - General tab)
  if (data.storeBanner) {
    formData.append('storeBanner', data.storeBanner)
  }

  // Handle storefront banners (multiple banners for home page - Storefront tab)
  // Files and metadata are sent separately
  const storefrontBannerFiles = data.storefrontBannerFiles
  if (
    storefrontBannerFiles &&
    Array.isArray(storefrontBannerFiles) &&
    storefrontBannerFiles.length > 0
  ) {
    // Append files for upload
    storefrontBannerFiles.forEach((file) => {
      formData.append('storefrontBanners', file)
    })
  }

  // Handle storefront banners metadata (order, gridSpan, category)
  if (data.storefrontBanners) {
    if (Array.isArray(data.storefrontBanners) && data.storefrontBanners.length > 0) {
      // Check if first item is a File (shouldn't be, but check to be safe)
      const firstItem = data.storefrontBanners[0]
      if (!(firstItem instanceof File)) {
        // It's StoreBanner[] - append metadata as JSON
        formData.append('storefrontBanners', JSON.stringify(data.storefrontBanners))
      }
    }
  }

  // Handle video file upload (mutually exclusive with video URL)
  if (data.storeVideoFile) {
    formData.append('storeVideo', data.storeVideoFile) // Multer field name is 'storeVideo'
  }
  // Handle signature - if it's a File, append as file, if it's a base64 string, append as string
  if (data.sellerAgreementSignature) {
    if (data.sellerAgreementSignature instanceof File) {
      formData.append('sellerAgreementSignature', data.sellerAgreementSignature)
    } else if (typeof data.sellerAgreementSignature === 'string') {
      // Base64 string - append as string
      formData.append('sellerAgreementSignature', data.sellerAgreementSignature)
    }
  }

  // Handle text fields
  if (data.storeDescription !== undefined) {
    formData.append('storeDescription', data.storeDescription)
  }
  if (data.storeStatus !== undefined) {
    formData.append('storeStatus', data.storeStatus)
  }
  if (data.storeSlug !== undefined) {
    formData.append('storeSlug', data.storeSlug.toLowerCase().trim())
  }
  if (data.storeTheme !== undefined) {
    formData.append('storeTheme', data.storeTheme)
  }

  // Handle video URL (mutually exclusive with video file)
  if (data.storeVideo !== undefined) {
    formData.append('storeVideo', data.storeVideo)
  }

  // Store Policies
  if (data.shippingPolicy !== undefined) {
    formData.append('shippingPolicy', data.shippingPolicy)
  }
  if (data.returnPolicy !== undefined) {
    formData.append('returnPolicy', data.returnPolicy)
  }
  if (data.refundPolicy !== undefined) {
    formData.append('refundPolicy', data.refundPolicy)
  }
  if (data.cancellationPolicy !== undefined) {
    formData.append('cancellationPolicy', data.cancellationPolicy)
  }
  if (data.warrantyPolicy !== undefined) {
    formData.append('warrantyPolicy', data.warrantyPolicy)
  }

  // Shipping Settings
  if (data.defaultShippingRate !== undefined) {
    formData.append('defaultShippingRate', String(data.defaultShippingRate))
  }
  if (data.shippingZones !== undefined) {
    formData.append('shippingZones', JSON.stringify(data.shippingZones))
  }

  // Social Media & Links
  if (data.website !== undefined) formData.append('website', data.website)
  if (data.facebook !== undefined) formData.append('facebook', data.facebook)
  if (data.instagram !== undefined) formData.append('instagram', data.instagram)
  if (data.twitter !== undefined) formData.append('twitter', data.twitter)
  if (data.youtube !== undefined) formData.append('youtube', data.youtube)
  if (data.linkedin !== undefined) formData.append('linkedin', data.linkedin)

  // SEO Settings
  if (data.storeMetaTitle !== undefined) formData.append('storeMetaTitle', data.storeMetaTitle)
  if (data.storeMetaDescription !== undefined) {
    formData.append('storeMetaDescription', data.storeMetaDescription)
  }
  if (data.storeKeywords !== undefined) {
    formData.append('storeKeywords', JSON.stringify(data.storeKeywords))
  }

  // Store Preferences

  if (data.lowStockNotification !== undefined) {
    formData.append('lowStockNotification', String(data.lowStockNotification))
  }
  if (data.newOrderNotification !== undefined) {
    formData.append('newOrderNotification', String(data.newOrderNotification))
  }

  // Contact Information
  if (data.storeEmail !== undefined) formData.append('storeEmail', data.storeEmail)
  if (data.storePhone !== undefined) formData.append('storePhone', data.storePhone)
  if (data.supportEmail !== undefined) formData.append('supportEmail', data.supportEmail)

  // Storefront & Catalog
  if (data.brandNames !== undefined) {
    formData.append('brandNames', JSON.stringify(data.brandNames))
  }

  // Shipping & Logistics
  if (data.pickupAddresses !== undefined) {
    formData.append('pickupAddresses', JSON.stringify(data.pickupAddresses))
  }
  if (data.preferredCouriers !== undefined) {
    formData.append('preferredCouriers', JSON.stringify(data.preferredCouriers))
  }
  if (data.packagingStandards !== undefined) {
    formData.append('packagingStandards', JSON.stringify(data.packagingStandards))
  }

  // Return & Replacement
  if (data.replacementPolicy !== undefined) {
    formData.append('replacementPolicy', data.replacementPolicy)
  }

  // Compliance & Agreements
  if (data.marketplaceTermsAccepted !== undefined) {
    formData.append('marketplaceTermsAccepted', String(data.marketplaceTermsAccepted))
  }
  if (data.sellerAgreementSigned !== undefined) {
    formData.append('sellerAgreementSigned', String(data.sellerAgreementSigned))
  }
  // Signature is handled above in file uploads section
  if (data.returnRefundPolicyAccepted !== undefined) {
    formData.append('returnRefundPolicyAccepted', String(data.returnRefundPolicyAccepted))
  }
  if (data.prohibitedItemsDeclared !== undefined) {
    formData.append('prohibitedItemsDeclared', String(data.prohibitedItemsDeclared))
  }
  if (data.prohibitedItemsDeclaration !== undefined) {
    formData.append('prohibitedItemsDeclaration', data.prohibitedItemsDeclaration)
  }
  if (data.dataPrivacyConsent !== undefined) {
    formData.append('dataPrivacyConsent', String(data.dataPrivacyConsent))
  }

  const response = await API.put('/auth/update-store', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}
