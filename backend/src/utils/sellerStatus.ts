import mongoose from 'mongoose'
import User from '../models/User'

/**
 * Check if seller is operationally active
 * A seller is operationally active only if:
 * - sellerLifecycleStatus = 'ACTIVE'
 * - isBlocked = false
 * - isApproved = true
 * - storeStatus = 'active'
 */
export const isSellerOperationallyActive = (seller: {
  sellerLifecycleStatus?: string
  isBlocked?: boolean
  isApproved?: boolean
  storeStatus?: string
}): boolean => {
  return (
    seller.sellerLifecycleStatus === 'ACTIVE' &&
    !seller.isBlocked &&
    seller.isApproved === true &&
    seller.storeStatus === 'active'
  )
}

/**
 * Get seller operational status with reason if inactive
 */
export const getSellerOperationalStatus = (seller: {
  sellerLifecycleStatus?: string
  isBlocked?: boolean
  isApproved?: boolean
  storeStatus?: string
}): { active: boolean; reason?: string } => {
  if (seller.sellerLifecycleStatus !== 'ACTIVE') {
    return {
      active: false,
      reason: `Account status: ${seller.sellerLifecycleStatus || 'UNKNOWN'}`,
    }
  }

  if (seller.isBlocked) {
    return {
      active: false,
      reason: 'Account is blocked by admin',
    }
  }

  if (!seller.isApproved) {
    return {
      active: false,
      reason: 'Account is not approved',
    }
  }

  if (seller.storeStatus !== 'active') {
    return {
      active: false,
      reason: 'Store is inactive',
    }
  }

  return { active: true }
}

/**
 * Check if seller can receive new orders
 */
export const canSellerReceiveOrders = async (
  sellerId: mongoose.Types.ObjectId,
): Promise<{ allowed: boolean; reason?: string }> => {
  const seller = await User.findById(sellerId)
    .select('sellerLifecycleStatus isBlocked isApproved storeStatus')
    .lean()

  if (!seller) {
    return { allowed: false, reason: 'Seller not found' }
  }

  const status = getSellerOperationalStatus(seller)
  return {
    allowed: status.active,
    reason: status.reason,
  }
}

