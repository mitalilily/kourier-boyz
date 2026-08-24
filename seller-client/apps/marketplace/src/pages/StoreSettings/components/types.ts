import type { FormInstance, UploadFile } from 'antd'
import type { StoreBanner } from '../../../api/store'
import type { PackagingStandard, PickupAddress } from '../../../api/storeQueries'

export interface StoreSettingsTabProps {
  form: FormInstance
  onSubmit: (values: StoreSettingsFormValues) => Promise<void>
  isLoading?: boolean
}

export interface GeneralTabProps extends StoreSettingsTabProps {
  logoFileList: UploadFile[]
  bannerFileList: UploadFile[]
  onLogoChange: (fileList: UploadFile[]) => void
  onBannerChange: (fileList: UploadFile[]) => void
  reviewStats?: {
    overallRating: number
    totalReviews: number
    averageRating: number
    ratingDistribution: {
      5: number
      4: number
      3: number
      2: number
      1: number
    }
    recentReviews: unknown[]
    topRatedProducts: unknown[]
  } | null
  isLoadingReviewStats?: boolean
}

export interface StorefrontTabProps extends StoreSettingsTabProps {
  storefrontBanners?: StoreBanner[]
  onStorefrontBannersChange?: (banners: StoreBanner[]) => void
  onStorefrontBannersWithFilesChange?: (
    banners: Array<StoreBanner & { file?: File; tempId?: string }>,
  ) => void
  videoUrl?: string
  videoFile?: UploadFile | null
  onVideoUrlChange?: (url: string) => void
  onVideoFileChange?: (file: UploadFile | null) => void
}

export type StoreSettingsFormValues = {
  storeDescription?: string
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
  sellerAgreementSignature?: string | File | null // Base64 string or File
  returnRefundPolicyAccepted?: boolean
  prohibitedItemsDeclared?: boolean
  prohibitedItemsDeclaration?: string
  dataPrivacyConsent?: boolean
  holidays?: [unknown, unknown]
  // Business hours fields for each day
  mondayClosed?: boolean
  mondayOpen?: unknown
  mondayClose?: unknown
  tuesdayClosed?: boolean
  tuesdayOpen?: unknown
  tuesdayClose?: unknown
  wednesdayClosed?: boolean
  wednesdayOpen?: unknown
  wednesdayClose?: unknown
  thursdayClosed?: boolean
  thursdayOpen?: unknown
  thursdayClose?: unknown
  fridayClosed?: boolean
  fridayOpen?: unknown
  fridayClose?: unknown
  saturdayClosed?: boolean
  saturdayOpen?: unknown
  saturdayClose?: unknown
  sundayClosed?: boolean
  sundayOpen?: unknown
  sundayClose?: unknown
}
