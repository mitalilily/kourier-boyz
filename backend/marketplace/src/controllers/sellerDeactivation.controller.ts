import { Request, Response } from 'express'
import mongoose from 'mongoose'
import AuditLog from '../models/AuditLog'
import Notification from '../models/Notification'
import Order from '../models/Order'
import Product from '../models/Product'
import Return from '../models/Return'
import SellerLedgerEntry from '../models/SellerLedgerEntry'
import SellerSettlementBatch from '../models/SellerSettlementBatch'
import User from '../models/User'
import { io } from '../server'
import { createAuditLog } from '../utils/auditLog'
import { emailTemplates, sendEmail } from '../utils/email'

/**
 * Check if seller is eligible for deactivation
 * Returns blocking reasons if not eligible
 */
export const checkDeactivationEligibility = async (
  sellerId: mongoose.Types.ObjectId,
): Promise<{ eligible: boolean; blockingReasons: string[] }> => {
  const blockingReasons: string[] = []

  // Check for open orders (pending, processing, shipped, in_transit, out_for_delivery)
  const openOrderStatuses: string[] = [
    'pending',
    'confirmed',
    'processing',
    'ready_to_ship',
    'shipped',
    'in_transit',
    'out_for_delivery',
  ]

  const openOrders = await Order.countDocuments({
    'sellerShipments.seller': sellerId,
    status: { $in: openOrderStatuses },
  })

  if (openOrders > 0) {
    blockingReasons.push(`You have ${openOrders} open order(s) that need to be completed or cancelled`)
  }

  // Check for active returns or replacements
  // Check Return model for pending/active returns (not completed or rejected)
  const activeReturnStatuses = [
    'REQUESTED',
    'APPROVED_BY_SELLER',
    'APPROVED_BY_ADMIN',
    'REVERSE_PICKUP_CREATED',
    'REVERSE_PICKUP_IN_TRANSIT',
    'REVERSE_PICKUP_COMPLETED',
    'RETURN_RECEIVED_BY_SELLER',
    'REFUND_INITIATED',
  ]
  const activeReturns = await Return.countDocuments({
    seller: sellerId,
    status: { $in: activeReturnStatuses },
  })

  if (activeReturns > 0) {
    blockingReasons.push(`You have ${activeReturns} active return(s) that need to be completed`)
  }

  // Check ledger closing balance
  const allLedgerEntries = await SellerLedgerEntry.find({ seller: sellerId })
    .sort({ createdAt: 1 })
    .lean()

  if (allLedgerEntries.length > 0) {
    // Calculate running balance
    let runningBalance = 0
    for (const entry of allLedgerEntries) {
      if (entry.entryType === 'CREDIT') {
        runningBalance += entry.amount || 0
      } else {
        runningBalance -= entry.amount || 0
      }
    }

    // Check if balance is zero (with small tolerance for floating point)
    if (Math.abs(runningBalance) > 0.01) {
      blockingReasons.push(
        `Your ledger balance is ₹${runningBalance.toFixed(2)}. Please settle all outstanding amounts before deactivating.`,
      )
    }
  }

  // Check for pending settlements
  const pendingSettlements = await SellerSettlementBatch.countDocuments({
    seller: sellerId,
    status: { $in: ['PENDING', 'PROCESSING'] },
  })

  if (pendingSettlements > 0) {
    blockingReasons.push(`You have ${pendingSettlements} pending settlement(s) in progress`)
  }

  return {
    eligible: blockingReasons.length === 0,
    blockingReasons,
  }
}

/**
 * GET /seller/deactivation/check-eligibility
 * Check if seller is eligible for deactivation
 */
export const checkEligibility = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const eligibility = await checkDeactivationEligibility(new mongoose.Types.ObjectId(sellerId))
    res.json(eligibility)
  } catch (error: any) {
    console.error('Error checking deactivation eligibility:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

/**
 * POST /seller/deactivation/request
 * Seller requests account deactivation
 */
export const requestDeactivation = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const seller = await User.findById(sellerId)
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    // Check if already deactivated or requested
    if (seller.sellerLifecycleStatus === 'DEACTIVATED') {
      return res.status(400).json({ error: 'Account is already deactivated' })
    }

    if (seller.sellerLifecycleStatus === 'DEACTIVATION_REQUESTED') {
      return res.status(400).json({ error: 'Deactivation request is already pending review' })
    }

    // Check eligibility
    const eligibility = await checkDeactivationEligibility(new mongoose.Types.ObjectId(sellerId))
    if (!eligibility.eligible) {
      return res.status(400).json({
        error: 'Cannot request deactivation',
        blockingReasons: eligibility.blockingReasons,
      })
    }

    const { deactivationReason } = req.body

    // Update seller status
    seller.sellerLifecycleStatus = 'DEACTIVATION_REQUESTED'
    seller.deactivationRequestedAt = new Date()
    if (deactivationReason) {
      seller.deactivationReason = deactivationReason
    }
    seller.storeStatus = 'inactive'
    await seller.save()

    // Unlist all products (set status to inactive)
    await Product.updateMany(
      { seller: sellerId },
      { status: 'inactive' },
    )

    // Create audit log
    await createAuditLog({
      action: 'SELLER_DEACTIVATION_REQUESTED',
      performedBy: new mongoose.Types.ObjectId(sellerId),
      performedByEmail: seller.email,
      performedByName: seller.name || seller.businessName,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent'),
      entityType: 'SELLER',
      entityId: seller._id,
      metadata: {
        sellerId: sellerId.toString(),
        oldStatus: 'ACTIVE',
        newStatus: 'DEACTIVATION_REQUESTED',
        reason: deactivationReason || 'No reason provided',
      },
    })

    // Notify all admins via socket and database notification
    try {
      const admins = await User.find({ role: 'super-admin' }).select('_id').lean()
      const notificationDocs = admins.map((admin) => ({
        userId: admin._id,
        title: 'New Deactivation Request',
        message: `${seller.businessName || seller.name} (${seller.email}) has requested account deactivation.`,
        type: 'system' as const,
        link: `/sellers/deactivation-requests`,
      }))

      if (notificationDocs.length > 0) {
        await Notification.insertMany(notificationDocs)
      }

      // Real-time notification via Socket.IO (super-admin room)
      try {
        io.to('super-admin').emit('notification:new', {
          title: 'New Deactivation Request',
          message: `${seller.businessName || seller.name} (${seller.email}) has requested account deactivation.`,
          type: 'system',
          link: `/sellers/deactivation-requests`,
        })
      } catch {
        // Ignore socket errors
      }
    } catch (notifyError) {
      console.error('Error sending admin notifications:', notifyError)
      // Don't fail the request if notification fails
    }

    // Send email to seller confirming request received
    try {
      await sendEmail(
        seller.email,
        'Deactivation Request Received',
        emailTemplates.deactivationRequested(seller.name || 'Seller', seller.businessName),
      )
    } catch (emailError) {
      console.error('Error sending email to seller:', emailError)
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Deactivation request submitted successfully. Admin will review your request.',
      status: seller.sellerLifecycleStatus,
    })
  } catch (error: any) {
    console.error('Error requesting deactivation:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

/**
 * GET /admin/sellers/deactivation-requests
 * Get all pending deactivation requests
 */
export const getDeactivationRequests = async (req: Request, res: Response) => {
  try {
    const sellers = await User.find({
      role: 'seller',
      sellerLifecycleStatus: 'DEACTIVATION_REQUESTED',
    })
      .select(
        'name email businessName gstNumber panNumber isApproved kycSubmitted bankVerified sellerLifecycleStatus deactivationRequestedAt deactivationReason',
      )
      .lean()

    // Get additional info for each seller
    const requests = await Promise.all(
      sellers.map(async (seller) => {
        const sellerId = seller._id

        // Count pending orders
        const pendingOrders = await Order.countDocuments({
          'sellerShipments.seller': sellerId,
          status: { $in: ['pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'in_transit', 'out_for_delivery'] },
        })

        // Calculate ledger balance
        const allLedgerEntries = await SellerLedgerEntry.find({ seller: sellerId })
          .sort({ createdAt: 1 })
          .lean()

        let ledgerBalance = 0
        for (const entry of allLedgerEntries) {
          if (entry.entryType === 'CREDIT') {
            ledgerBalance += entry.amount || 0
          } else {
            ledgerBalance -= entry.amount || 0
          }
        }

        return {
          _id: seller._id,
          name: seller.name,
          email: seller.email,
          businessName: seller.businessName,
          gstNumber: seller.gstNumber,
          panNumber: seller.panNumber,
          isApproved: seller.isApproved,
          kycSubmitted: seller.kycSubmitted,
          bankVerified: seller.bankVerified,
          deactivationRequestedAt: seller.deactivationRequestedAt,
          deactivationReason: seller.deactivationReason,
          pendingOrders,
          ledgerBalance,
        }
      }),
    )

    res.json({ requests })
  } catch (error: any) {
    console.error('Error fetching deactivation requests:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

/**
 * POST /admin/sellers/:id/approve-deactivation
 * Admin approves deactivation request
 */
export const approveDeactivation = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { id } = req.params
    const seller = await User.findById(id)

    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    if (seller.sellerLifecycleStatus !== 'DEACTIVATION_REQUESTED') {
      return res.status(400).json({
        error: `Seller is not in DEACTIVATION_REQUESTED status. Current status: ${seller.sellerLifecycleStatus}`,
      })
    }

    // Update seller status
    seller.sellerLifecycleStatus = 'DEACTIVATED'
    seller.deactivatedAt = new Date()
    seller.deactivationReviewedBy = new mongoose.Types.ObjectId(adminId)
    seller.storeStatus = 'inactive'
    await seller.save()

    // Ensure all products are inactive
    await Product.updateMany(
      { seller: id },
      { status: 'inactive' },
    )

    // Get admin info for audit log
    const admin = await User.findById(adminId).select('name email').lean()

    // Create audit log
    await createAuditLog({
      action: 'SELLER_DEACTIVATION_APPROVED',
      performedBy: new mongoose.Types.ObjectId(adminId),
      performedByEmail: admin?.email,
      performedByName: admin?.name,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent'),
      entityType: 'SELLER',
      entityId: seller._id,
      metadata: {
        sellerId: id,
        oldStatus: 'DEACTIVATION_REQUESTED',
        newStatus: 'DEACTIVATED',
        reviewedBy: adminId.toString(),
      },
    })

    // Notify seller via socket and database notification
    try {
      await Notification.create({
        userId: seller._id,
        title: 'Account Deactivation Approved',
        message: 'Your account deactivation request has been approved. Your account is now deactivated.',
        type: 'system',
        link: '/profile?tab=account',
      })

      // Real-time notification via Socket.IO
      try {
        io.to(`user:${id}`).emit('notification:new', {
          title: 'Account Deactivation Approved',
          message: 'Your account deactivation request has been approved.',
          type: 'system',
          link: '/profile?tab=account',
        })
      } catch {
        // Ignore socket errors
      }
    } catch (notifyError) {
      console.error('Error sending seller notification:', notifyError)
      // Don't fail the request if notification fails
    }

    // Send email to seller
    try {
      await sendEmail(
        seller.email,
        'Account Deactivation Approved',
        emailTemplates.deactivationApproved(seller.name || 'Seller', seller.businessName),
      )
    } catch (emailError) {
      console.error('Error sending email to seller:', emailError)
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Seller deactivation approved successfully',
      seller: {
        _id: seller._id,
        sellerLifecycleStatus: seller.sellerLifecycleStatus,
        deactivatedAt: seller.deactivatedAt,
      },
    })
  } catch (error: any) {
    console.error('Error approving deactivation:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

/**
 * POST /admin/sellers/:id/reject-deactivation
 * Admin rejects deactivation request
 */
export const rejectDeactivation = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { id } = req.params
    const { rejectionReason } = req.body

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' })
    }

    const seller = await User.findById(id)

    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    if (seller.sellerLifecycleStatus !== 'DEACTIVATION_REQUESTED') {
      return res.status(400).json({
        error: `Seller is not in DEACTIVATION_REQUESTED status. Current status: ${seller.sellerLifecycleStatus}`,
      })
    }

    // Revert to ACTIVE status
    seller.sellerLifecycleStatus = 'ACTIVE'
    seller.deactivationRequestedAt = undefined
    // Store rejection reason in deactivationReason field
    seller.deactivationReason = `Rejected: ${rejectionReason}`
    seller.deactivationReviewedBy = new mongoose.Types.ObjectId(adminId)
    // storeStatus remains 'inactive' - seller must re-enable manually
    await seller.save()

    // Get admin info for audit log
    const admin = await User.findById(adminId).select('name email').lean()

    // Create audit log
    await createAuditLog({
      action: 'SELLER_DEACTIVATION_REJECTED',
      performedBy: new mongoose.Types.ObjectId(adminId),
      performedByEmail: admin?.email,
      performedByName: admin?.name,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent'),
      entityType: 'SELLER',
      entityId: seller._id,
      metadata: {
        sellerId: id,
        oldStatus: 'DEACTIVATION_REQUESTED',
        newStatus: 'ACTIVE',
        rejectionReason,
        reviewedBy: adminId.toString(),
      },
    })

    // Notify seller via socket and database notification
    try {
      await Notification.create({
        userId: seller._id,
        title: 'Deactivation Request Rejected',
        message: `Your deactivation request has been rejected. Reason: ${rejectionReason}`,
        type: 'system',
        link: '/profile?tab=account',
      })

      // Real-time notification via Socket.IO
      try {
        io.to(`user:${id}`).emit('notification:new', {
          title: 'Deactivation Request Rejected',
          message: 'Your deactivation request has been rejected. Please check your email for details.',
          type: 'system',
          link: '/profile?tab=account',
        })
      } catch {
        // Ignore socket errors
      }
    } catch (notifyError) {
      console.error('Error sending seller notification:', notifyError)
      // Don't fail the request if notification fails
    }

    // Send email to seller
    try {
      await sendEmail(
        seller.email,
        'Deactivation Request Rejected',
        emailTemplates.deactivationRejected(seller.name || 'Seller', rejectionReason, seller.businessName),
      )
    } catch (emailError) {
      console.error('Error sending email to seller:', emailError)
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Deactivation request rejected successfully',
      seller: {
        _id: seller._id,
        sellerLifecycleStatus: seller.sellerLifecycleStatus,
      },
    })
  } catch (error: any) {
    console.error('Error rejecting deactivation:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

/**
 * POST /admin/sellers/:id/reactivate
 * Admin reactivates a deactivated seller
 */
export const reactivateSeller = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { id } = req.params
    const seller = await User.findById(id)

    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    if (seller.sellerLifecycleStatus !== 'DEACTIVATED') {
      return res.status(400).json({
        error: `Seller is not deactivated. Current status: ${seller.sellerLifecycleStatus}`,
      })
    }

    // Reactivate seller
    const oldStatus = seller.sellerLifecycleStatus
    seller.sellerLifecycleStatus = 'ACTIVE'
    seller.deactivatedAt = undefined
    seller.deactivationRequestedAt = undefined
    // storeStatus remains 'inactive' - seller must re-enable manually
    // Optional: require re-KYC or bank re-verification based on admin settings
    await seller.save()

    // Get admin info for audit log
    const admin = await User.findById(adminId).select('name email').lean()

    // Create audit log
    await createAuditLog({
      action: 'SELLER_REACTIVATED',
      performedBy: new mongoose.Types.ObjectId(adminId),
      performedByEmail: admin?.email,
      performedByName: admin?.name,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent'),
      entityType: 'SELLER',
      entityId: seller._id,
      metadata: {
        sellerId: id,
        oldStatus,
        newStatus: 'ACTIVE',
        reactivatedBy: adminId.toString(),
      },
    })

    // Notify seller via socket and database notification
    try {
      await Notification.create({
        userId: seller._id,
        title: 'Account Reactivated',
        message: 'Your seller account has been reactivated by admin. You can now access the seller panel.',
        type: 'system',
        link: '/profile?tab=account',
      })

      // Real-time notification via Socket.IO
      try {
        io.to(`user:${id}`).emit('notification:new', {
          title: 'Account Reactivated',
          message: 'Your seller account has been reactivated. Please re-enable your store to start receiving orders.',
          type: 'system',
          link: '/profile?tab=account',
        })
      } catch {
        // Ignore socket errors
      }
    } catch (notifyError) {
      console.error('Error sending seller notification:', notifyError)
      // Don't fail the request if notification fails
    }

    // Send email to seller
    try {
      await sendEmail(
        seller.email,
        'Account Reactivated',
        emailTemplates.sellerReactivated(seller.name || 'Seller', seller.businessName),
      )
    } catch (emailError) {
      console.error('Error sending email to seller:', emailError)
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Seller reactivated successfully',
      seller: {
        _id: seller._id,
        sellerLifecycleStatus: seller.sellerLifecycleStatus,
      },
    })
  } catch (error: any) {
    console.error('Error reactivating seller:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

