import multer from 'multer'

// Use memory storage for Cloudflare R2
// Files are stored in memory as buffers and then uploaded to R2
const storage = multer.memoryStorage()

// File filter for images only
const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ]
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and AVIF are allowed.'), false)
  }
}

// Generic upload instance for reuse
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit per file
  },
})

// Category-specific upload configuration
export const uploadCategoryImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
}).fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'hoverImage', maxCount: 1 },
  { name: 'banners', maxCount: 10 },
])

// File filter for KYC documents (images + PDFs)
const kycFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'application/pdf',
  ]
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, AVIF, and PDF are allowed.'), false)
  }
}

// KYC documents upload configuration
export const uploadKYCDocuments = multer({
  storage,
  fileFilter: kycFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit for documents
  },
}).fields([
  { name: 'storeLogo', maxCount: 1 },
  { name: 'gstCertificate', maxCount: 1 },
  { name: 'idProof', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'cancelledCheque', maxCount: 1 },
  { name: 'certificateOfIncorporation', maxCount: 1 },
  { name: 'trustDeed', maxCount: 1 },
])

// Upload middleware for store logo (single file) - backward compatibility
export const uploadStoreLogo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
}).single('storeLogo')

// Upload middleware for profile photo (single file)
export const uploadProfilePhoto = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile photos
  },
}).single('profilePhoto')

// File filter for videos
const videoFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo', // .avi
  ]
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only MP4, WebM, OGG, QuickTime, and AVI are allowed.'), false)
  }
}

// Combined file filter for store settings (images + videos)
const storeSettingsFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedImageMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ]
  const allowedVideoMimes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo', // .avi
  ]

  // Check if field is storeVideo - allow videos
  if (file.fieldname === 'storeVideo') {
    if (allowedVideoMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(
        new Error('Invalid video file type. Only MP4, WebM, OGG, QuickTime, and AVI are allowed.'),
        false,
      )
    }
  } else {
    // For other fields (logo, banners, signature) - allow images
    if (allowedImageMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and AVIF are allowed.'), false)
    }
  }
}

// Upload middleware for store settings (logo + store banner + storefront banners + video + signature)
export const uploadStoreSettings = multer({
  storage,
  fileFilter: storeSettingsFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit per file (supports large videos and banners)
  },
}).fields([
  { name: 'storeLogo', maxCount: 1 },
  { name: 'storeBanner', maxCount: 1 }, // Single banner for header (General tab)
  { name: 'storefrontBanners', maxCount: 10 }, // Multiple banners for home page (Storefront tab)
  { name: 'storeVideo', maxCount: 1 }, // Video file upload (Storefront tab)
  { name: 'sellerAgreementSignature', maxCount: 1 },
])

// Upload middleware for video files
export const uploadVideo = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for video files
  },
}).single('storeVideo')

// Combined file filter for product uploads (images + videos)
// Allows videos only for the 'videos' field, images for all other fields
const productFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedImageMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ]
  const allowedVideoMimes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo', // .avi
  ]

  // Allow videos for the 'videos' field and variant video fields (variantVideos_*)
  if (file.fieldname === 'videos' || file.fieldname.startsWith('variantVideos_')) {
    if (allowedVideoMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(
        new Error('Invalid video file type. Only MP4, WebM, OGG, QuickTime, and AVI are allowed.'),
        false,
      )
    }
  } else {
    // For all other fields (mainImage, images, variantMainImage_*, variantImages_*, etc.) - allow images only
    if (allowedImageMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and AVIF are allowed.'), false)
    }
  }
}

// Upload middleware for products (images + videos)
// Uses .any() to support dynamic variant field names like variantMainImage_0, variantImages_0
export const uploadProductFiles = multer({
  storage,
  fileFilter: productFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit per file (supports large videos)
  },
}).any()

const reviewMediaFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedImageMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ]
  const allowedVideoMimes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
  ]

  if (file.fieldname === 'images') {
    if (allowedImageMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid image type. Allowed: JPEG, PNG, GIF, WebP, AVIF.'), false)
    }
    return
  }

  if (file.fieldname === 'videos') {
    if (allowedVideoMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid video type. Allowed: MP4, WebM, OGG, QuickTime, AVI.'), false)
    }
    return
  }

  cb(new Error('Unsupported field for review media upload.'), false)
}

export const uploadReviewMedia = multer({
  storage,
  fileFilter: reviewMediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file to accommodate short videos
  },
}).fields([
  { name: 'images', maxCount: 6 },
  { name: 'videos', maxCount: 2 },
])

// File filter for CSV / Excel imports (used for settlement order imports, etc.)
const settlementImportFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only CSV or Excel files are allowed.'), false)
  }
}

// Upload middleware for settlement imports (single file, stored in memory)
export const uploadSettlementImport = multer({
  storage,
  fileFilter: settlementImportFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file (sufficient for large CSVs)
  },
}).single('file')

// File filter for ticket attachments (images + PDFs, same as KYC)
// Use kycFileFilter since it already allows images + PDFs
export const uploadTicketAttachments = multer({
  storage,
  fileFilter: kycFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
}).array('attachments', 5) // Allow up to 5 attachments

// Upload middleware for brand documents (images + PDFs, same as KYC)
export const uploadBrandDocuments = multer({
  storage,
  fileFilter: kycFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
}).array('files', 10) // Allow up to 10 files

// Combined file filter for return uploads (images + videos)
const returnMediaFileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedImageMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ]
  const allowedVideoMimes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo', // .avi
  ]

  if (file.fieldname === 'images') {
    // Allow both images and videos for the 'images' field
    if (allowedImageMimes.includes(file.mimetype) || allowedVideoMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(
        new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP, AVIF) and videos (MP4, WebM, OGG, QuickTime, AVI) are allowed.'),
        false,
      )
    }
    return
  }

  cb(new Error('Unsupported field for return media upload.'), false)
}

// Upload middleware for return requests (images + videos)
export const uploadReturnMedia = multer({
  storage,
  fileFilter: returnMediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file to accommodate videos
  },
}).array('images', 5) // Allow up to 5 files (images or videos)
