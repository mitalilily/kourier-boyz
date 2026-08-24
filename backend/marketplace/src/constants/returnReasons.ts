/**
 * Return and Replacement Reasons
 * These are the valid reasons customers can select when requesting a return or replacement
 */

export const RETURN_REASONS = {
  // Product Quality Issues
  DEFECTIVE: 'defective',
  DAMAGED: 'damaged',
  DEFECTIVE_ON_ARRIVAL: 'defective_on_arrival',
  POOR_QUALITY: 'poor_quality',
  QUALITY_ISSUE: 'quality_issue',
  BROKEN: 'broken',
  NOT_WORKING: 'not_working',
  FAULTY: 'faulty',
  
  // Wrong/Missing Items
  WRONG_ITEM: 'wrong_item',
  WRONG_PRODUCT: 'wrong_product',
  MISSING_ITEMS: 'missing_items',
  PARTIALLY_MISSING: 'partially_missing',
  WRONG_QUANTITY: 'wrong_quantity',
  
  // Product Condition Issues
  EXPIRED: 'expired',
  EXPIRED_PRODUCT: 'expired_product',
  NEAR_EXPIRY: 'near_expiry',
  OPENED_DAMAGED: 'opened_damaged',
  SEAL_BROKEN: 'seal_broken',
  USED_ITEM: 'used_item',
  
  // Product Description Issues
  NOT_AS_DESCRIBED: 'not_as_described',
  SIZE_ISSUE: 'size_issue',
  COLOR_ISSUE: 'color_issue',
  WRONG_SIZE: 'wrong_size',
  WRONG_COLOR: 'wrong_color',
  DIMENSION_ISSUE: 'dimension_issue',
  MATERIAL_ISSUE: 'material_issue',
  SPECIFICATION_MISMATCH: 'specification_mismatch',
  
  // Delivery Issues
  LATE_DELIVERY: 'late_delivery',
  DELAYED_DELIVERY: 'delayed_delivery',
  PACKAGE_DAMAGED: 'package_damaged',
  DAMAGED_PACKAGING: 'damaged_packaging',
  
  // Customer Preference (typically don't require photos)
  CHANGE_OF_MIND: 'change_of_mind',
  NO_LONGER_NEEDED: 'no_longer_needed',
  FOUND_BETTER_PRICE: 'found_better_price',
  UNWANTED_GIFT: 'unwanted_gift',
  
  // Other
  OTHER: 'other',
} as const

export const REPLACEMENT_REASONS = {
  // Damaged/Defective Product - Same Product Replacement
  DAMAGED_PRODUCT: 'damaged_product',
  DEFECTIVE_PRODUCT: 'defective_product',
  DAMAGED_ON_ARRIVAL: 'damaged_on_arrival',
  BROKEN_ITEM: 'broken_item',
  FAULTY_PRODUCT: 'faulty_product',
  QUALITY_ISSUE: 'quality_issue',
  POOR_QUALITY: 'poor_quality',
  NOT_WORKING: 'not_working',

  // Size Issues
  WRONG_SIZE: 'wrong_size',
  SIZE_ISSUE: 'size_issue',
  SIZE_DOESNT_FIT: 'size_doesnt_fit',
  PREFER_DIFFERENT_SIZE: 'prefer_different_size',
  SIZE_TOO_SMALL: 'size_too_small',
  SIZE_TOO_LARGE: 'size_too_large',

  // Color Issues
  WRONG_COLOR: 'wrong_color',
  COLOR_ISSUE: 'color_issue',
  COLOR_DOESNT_MATCH: 'color_doesnt_match',
  PREFER_DIFFERENT_COLOR: 'prefer_different_color',
  COLOR_NOT_AS_SHOWN: 'color_not_as_shown',

  // Wrong Item Issues
  WRONG_ITEM: 'wrong_item',
  WRONG_PRODUCT: 'wrong_product',
  WRONG_VARIANT: 'wrong_variant',

  // Other
  OTHER: 'other',
} as const

export type ReturnReason = typeof RETURN_REASONS[keyof typeof RETURN_REASONS]
export type ReplacementReason = typeof REPLACEMENT_REASONS[keyof typeof REPLACEMENT_REASONS]

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  // Product Quality Issues
  [RETURN_REASONS.DEFECTIVE]: 'Product is defective',
  [RETURN_REASONS.DAMAGED]: 'Product arrived damaged',
  [RETURN_REASONS.DEFECTIVE_ON_ARRIVAL]: 'Defective on arrival',
  [RETURN_REASONS.POOR_QUALITY]: 'Poor quality',
  [RETURN_REASONS.QUALITY_ISSUE]: 'Quality issue',
  [RETURN_REASONS.BROKEN]: 'Product is broken',
  [RETURN_REASONS.NOT_WORKING]: 'Product not working',
  [RETURN_REASONS.FAULTY]: 'Faulty product',
  
  // Wrong/Missing Items
  [RETURN_REASONS.WRONG_ITEM]: 'Wrong item received',
  [RETURN_REASONS.WRONG_PRODUCT]: 'Wrong product received',
  [RETURN_REASONS.MISSING_ITEMS]: 'Missing items',
  [RETURN_REASONS.PARTIALLY_MISSING]: 'Partially missing items',
  [RETURN_REASONS.WRONG_QUANTITY]: 'Wrong quantity',
  
  // Product Condition Issues
  [RETURN_REASONS.EXPIRED]: 'Product is expired',
  [RETURN_REASONS.EXPIRED_PRODUCT]: 'Expired product',
  [RETURN_REASONS.NEAR_EXPIRY]: 'Near expiry date',
  [RETURN_REASONS.OPENED_DAMAGED]: 'Package opened/damaged',
  [RETURN_REASONS.SEAL_BROKEN]: 'Seal broken',
  [RETURN_REASONS.USED_ITEM]: 'Item appears used',
  
  // Product Description Issues
  [RETURN_REASONS.NOT_AS_DESCRIBED]: 'Product not as described',
  [RETURN_REASONS.SIZE_ISSUE]: 'Size issue',
  [RETURN_REASONS.COLOR_ISSUE]: 'Color issue',
  [RETURN_REASONS.WRONG_SIZE]: 'Wrong size ordered',
  [RETURN_REASONS.WRONG_COLOR]: 'Wrong color ordered',
  [RETURN_REASONS.DIMENSION_ISSUE]: 'Dimension issue',
  [RETURN_REASONS.MATERIAL_ISSUE]: 'Material issue',
  [RETURN_REASONS.SPECIFICATION_MISMATCH]: 'Specification mismatch',
  
  // Delivery Issues
  [RETURN_REASONS.LATE_DELIVERY]: 'Late delivery',
  [RETURN_REASONS.DELAYED_DELIVERY]: 'Delayed delivery',
  [RETURN_REASONS.PACKAGE_DAMAGED]: 'Package damaged',
  [RETURN_REASONS.DAMAGED_PACKAGING]: 'Damaged packaging',
  
  // Customer Preference
  [RETURN_REASONS.CHANGE_OF_MIND]: 'Change of mind',
  [RETURN_REASONS.NO_LONGER_NEEDED]: 'No longer needed',
  [RETURN_REASONS.FOUND_BETTER_PRICE]: 'Found better price elsewhere',
  [RETURN_REASONS.UNWANTED_GIFT]: 'Unwanted gift',
  
  // Other
  [RETURN_REASONS.OTHER]: 'Other',
}

export const REPLACEMENT_REASON_LABELS: Record<ReplacementReason, string> = {
  // Damaged/Defective Product
  [REPLACEMENT_REASONS.DAMAGED_PRODUCT]: 'Product arrived damaged (replace with same product)',
  [REPLACEMENT_REASONS.DEFECTIVE_PRODUCT]: 'Product is defective (replace with same product)',
  [REPLACEMENT_REASONS.DAMAGED_ON_ARRIVAL]: 'Damaged on arrival (replace with same product)',
  [REPLACEMENT_REASONS.BROKEN_ITEM]: 'Item is broken (replace with same product)',
  [REPLACEMENT_REASONS.FAULTY_PRODUCT]: 'Faulty product (replace with same product)',
  [REPLACEMENT_REASONS.QUALITY_ISSUE]: 'Quality issue (replace with same product)',
  [REPLACEMENT_REASONS.POOR_QUALITY]: 'Poor quality (replace with same product)',
  [REPLACEMENT_REASONS.NOT_WORKING]: 'Product not working (replace with same product)',

  // Size Issues
  [REPLACEMENT_REASONS.WRONG_SIZE]: 'Wrong size ordered',
  [REPLACEMENT_REASONS.SIZE_ISSUE]: 'Size issue',
  [REPLACEMENT_REASONS.SIZE_DOESNT_FIT]: "Size doesn't fit",
  [REPLACEMENT_REASONS.PREFER_DIFFERENT_SIZE]: 'Prefer different size',
  [REPLACEMENT_REASONS.SIZE_TOO_SMALL]: 'Size too small',
  [REPLACEMENT_REASONS.SIZE_TOO_LARGE]: 'Size too large',

  // Color Issues
  [REPLACEMENT_REASONS.WRONG_COLOR]: 'Wrong color ordered',
  [REPLACEMENT_REASONS.COLOR_ISSUE]: 'Color issue',
  [REPLACEMENT_REASONS.COLOR_DOESNT_MATCH]: "Color doesn't match",
  [REPLACEMENT_REASONS.PREFER_DIFFERENT_COLOR]: 'Prefer different color',
  [REPLACEMENT_REASONS.COLOR_NOT_AS_SHOWN]: 'Color not as shown',

  // Wrong Item Issues
  [REPLACEMENT_REASONS.WRONG_ITEM]: 'Wrong item received',
  [REPLACEMENT_REASONS.WRONG_PRODUCT]: 'Wrong product received',
  [REPLACEMENT_REASONS.WRONG_VARIANT]: 'Wrong variant received',

  // Other
  [REPLACEMENT_REASONS.OTHER]: 'Other',
}

// Reasons that allow replacing with the exact same variant (damaged/defective/quality issues)
export const SAME_VARIANT_REPLACEMENT_REASONS = [
  REPLACEMENT_REASONS.DAMAGED_PRODUCT,
  REPLACEMENT_REASONS.DEFECTIVE_PRODUCT,
  REPLACEMENT_REASONS.DAMAGED_ON_ARRIVAL,
  REPLACEMENT_REASONS.BROKEN_ITEM,
  REPLACEMENT_REASONS.FAULTY_PRODUCT,
  REPLACEMENT_REASONS.QUALITY_ISSUE,
  REPLACEMENT_REASONS.POOR_QUALITY,
  REPLACEMENT_REASONS.NOT_WORKING,
] as const

// Reasons that require photos/videos for validation
// These are reasons where visual evidence is typically necessary
export const REASONS_REQUIRING_MEDIA = [
  // Return reasons requiring media
  RETURN_REASONS.DEFECTIVE,
  RETURN_REASONS.DAMAGED,
  RETURN_REASONS.DEFECTIVE_ON_ARRIVAL,
  RETURN_REASONS.POOR_QUALITY,
  RETURN_REASONS.QUALITY_ISSUE,
  RETURN_REASONS.BROKEN,
  RETURN_REASONS.NOT_WORKING,
  RETURN_REASONS.FAULTY,
  RETURN_REASONS.WRONG_ITEM,
  RETURN_REASONS.WRONG_PRODUCT,
  RETURN_REASONS.NOT_AS_DESCRIBED,
  RETURN_REASONS.EXPIRED,
  RETURN_REASONS.EXPIRED_PRODUCT,
  RETURN_REASONS.NEAR_EXPIRY,
  RETURN_REASONS.OPENED_DAMAGED,
  RETURN_REASONS.SEAL_BROKEN,
  RETURN_REASONS.USED_ITEM,
  RETURN_REASONS.PACKAGE_DAMAGED,
  RETURN_REASONS.DAMAGED_PACKAGING,
  RETURN_REASONS.MISSING_ITEMS,
  RETURN_REASONS.PARTIALLY_MISSING,
  RETURN_REASONS.WRONG_QUANTITY,
  RETURN_REASONS.DIMENSION_ISSUE,
  RETURN_REASONS.MATERIAL_ISSUE,
  RETURN_REASONS.SPECIFICATION_MISMATCH,
  
  // Replacement reasons requiring media
  REPLACEMENT_REASONS.DAMAGED_PRODUCT,
  REPLACEMENT_REASONS.DEFECTIVE_PRODUCT,
  REPLACEMENT_REASONS.DAMAGED_ON_ARRIVAL,
  REPLACEMENT_REASONS.BROKEN_ITEM,
  REPLACEMENT_REASONS.FAULTY_PRODUCT,
  REPLACEMENT_REASONS.QUALITY_ISSUE,
  REPLACEMENT_REASONS.POOR_QUALITY,
  REPLACEMENT_REASONS.NOT_WORKING,
  REPLACEMENT_REASONS.WRONG_ITEM,
  REPLACEMENT_REASONS.WRONG_PRODUCT,
  REPLACEMENT_REASONS.WRONG_VARIANT,
  REPLACEMENT_REASONS.COLOR_NOT_AS_SHOWN,
] as const

export const ALL_RETURN_REASONS = Object.values(RETURN_REASONS)
export const ALL_REPLACEMENT_REASONS = Object.values(REPLACEMENT_REASONS)

