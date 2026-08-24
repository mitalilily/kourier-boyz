import { Request, Response } from 'express'
import Announcement from '../models/Announcement'
import Coupon from '../models/Coupon'
import Notification from '../models/Notification'
import Order from '../models/Order'
import Product from '../models/Product'
import User from '../models/User'
import { cancelAnnouncementSchedule, scheduleAnnouncement } from '../services/announcementScheduler'
import { io } from '../server'
import { emailTemplates, sendEmail } from '../utils/email'

// --------------------
// Helper: Find affected sellers for a coupon
// --------------------
const getAffectedSellers = async (coupon: any): Promise<any[]> => {
  const sellers = new Set<string>()

  if (coupon.applicableTo === 'all') {
    // If applicable to all, notify all sellers
    const allSellers = await User.find({ role: 'seller', isApproved: true }).select('_id email name')
    allSellers.forEach((seller) => {
      if (seller._id) sellers.add(String(seller._id))
    })
    return allSellers
  } else if (coupon.applicableTo === 'products' && coupon.applicableProducts?.length > 0) {
    // Find sellers of applicable products
    const products = await Product.find({
      _id: { $in: coupon.applicableProducts },
    }).select('seller')
    products.forEach((product) => {
      if (product.seller) sellers.add(String(product.seller))
    })
  } else if (coupon.applicableTo === 'categories' && coupon.applicableCategories?.length > 0) {
    // Find sellers with products in applicable categories
    const products = await Product.find({
      category: { $in: coupon.applicableCategories },
    }).select('seller')
    products.forEach((product) => {
      if (product.seller) sellers.add(String(product.seller))
    })
  }

  // Get seller details
  const sellerIds = Array.from(sellers)
  if (sellerIds.length === 0) return []

  const sellerDocs = await User.find({
    _id: { $in: sellerIds },
    role: 'seller',
    isApproved: true,
  }).select('_id email name')

  return sellerDocs
}

// --------------------
// Helper: Notify sellers about coupon changes
// --------------------
const notifySellersAboutCoupon = async (
  sellers: any[],
  action: 'created' | 'updated' | 'deleted',
  coupon: any,
) => {
  const sellerPanelUrl = process.env.SELLER_PANEL_URL
  const dashboardUrl = sellerPanelUrl ? `${sellerPanelUrl}/coupons` : null
  
  // Format coupon details for email
  const formatCouponDetails = (coupon: any): string => {
    const details: string[] = []
    if (coupon.type) {
      details.push(`<li><strong>Type:</strong> ${coupon.type === 'percentage' ? 'Percentage' : 'Fixed Amount'}</li>`)
    }
    if (coupon.value) {
      details.push(
        `<li><strong>Discount:</strong> ${coupon.type === 'percentage' ? `${coupon.value}%` : `₹${coupon.value}`}</li>`,
      )
    }
    if (coupon.validFrom && coupon.validTo) {
      details.push(
        `<li><strong>Valid Period:</strong> ${new Date(coupon.validFrom).toLocaleDateString()} - ${new Date(coupon.validTo).toLocaleDateString()}</li>`,
      )
    }
    if (coupon.minPurchaseAmount) {
      details.push(`<li><strong>Min Purchase:</strong> ₹${coupon.minPurchaseAmount}</li>`)
    }
    if (coupon.applicableTo) {
      let applicableText = 'All Products'
      if (coupon.applicableTo === 'categories') {
        applicableText = 'Specific Categories'
      } else if (coupon.applicableTo === 'products') {
        applicableText = 'Specific Products'
      }
      details.push(`<li><strong>Applicable To:</strong> ${applicableText}</li>`)
    }
    return details.join('')
  }

  for (const seller of sellers) {
    try {
      // Create in-app notification
      const notificationTitle =
        action === 'created'
          ? 'New Coupon Created'
          : action === 'updated'
          ? 'Coupon Updated'
          : 'Coupon Deleted'
      
      const notificationMessage =
        action === 'created'
          ? `A new coupon "${coupon.code}" has been created that may affect your products.`
          : action === 'updated'
          ? `The coupon "${coupon.code}" has been updated by an admin.`
          : `The coupon "${coupon.code}" has been deleted and is no longer available.`

      await Notification.create({
        userId: seller._id,
        title: notificationTitle,
        message: notificationMessage,
        type: 'system',
        read: false,
        link: dashboardUrl,
      })

      // Send email notification
      const couponDetails = formatCouponDetails(coupon)
      let emailSubject = ''
      let emailHtml = ''

      if (action === 'created') {
        emailSubject = `New Coupon Created: ${coupon.code}`
        emailHtml = emailTemplates.couponCreated(seller.name || 'Seller', coupon.code, couponDetails, dashboardUrl)
      } else if (action === 'updated') {
        emailSubject = `Coupon Updated: ${coupon.code}`
        emailHtml = emailTemplates.couponUpdated(seller.name || 'Seller', coupon.code, couponDetails, dashboardUrl)
      } else {
        emailSubject = `Coupon Deleted: ${coupon.code}`
        emailHtml = emailTemplates.couponDeleted(seller.name || 'Seller', coupon.code, dashboardUrl)
      }

      await sendEmail(seller.email, emailSubject, emailHtml)
    } catch (error) {
      console.error(`Error notifying seller ${seller._id} about coupon ${action}:`, error)
      // Continue with other sellers even if one fails
    }
  }
}

// --------------------
// GET all coupons with search and filters
// --------------------
export const getCoupons = async (req: Request, res: Response) => {
  try {
    const { search, status, type, page = 1, limit = 20 } = req.query

    // Build query
    const query: any = {}

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ]
    }

    if (status) {
      query.status = status
    }

    if (type) {
      query.type = type
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [coupons, total] = await Promise.all([
      Coupon.find(query)
        .populate('createdBy', 'name email')
        .populate('applicableCategories', 'name slug')
        .populate('applicableProducts', 'name slug')
        .populate('linkedAnnouncement', 'title isActive startDate endDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Coupon.countDocuments(query),
    ])

    // Auto-update expired coupons
    const now = new Date()
    const expiredCoupons = coupons.filter(
      (coupon) => coupon.validTo < now && coupon.status !== 'expired',
    )
    if (expiredCoupons.length > 0) {
      await Coupon.updateMany(
        { _id: { $in: expiredCoupons.map((c) => c._id) } },
        { $set: { status: 'expired' } },
      )
    }

    res.json({
      coupons,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err: unknown) {
    console.error('Error fetching coupons:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// GET single coupon by ID
// --------------------
export const getCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const coupon = await Coupon.findById(id)
      .populate('createdBy', 'name email')
      .populate('applicableCategories', 'name slug')
      .populate('applicableProducts', 'name slug')
      .populate('linkedAnnouncement', 'title isActive startDate endDate')

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    res.json(coupon)
  } catch (err: unknown) {
    console.error('Error fetching coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// CREATE new coupon
// --------------------
export const createCoupon = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const {
      code,
      type,
      value,
      minPurchaseAmount,
      maxDiscountAmount,
      usageLimit,
      perUserLimit,
      validFrom,
      validTo,
      status,
      applicableTo,
      applicableCategories,
      applicableProducts,
      firstTimeUserOnly,
      description,
      // Announcement fields
      createAnnouncement,
      announcementTitle,
      announcementMessage,
      announcementLink,
      announcementLinkText,
      announcementBackgroundColor,
      announcementTextColor,
      announcementDismissible,
      announcementTargetAudience,
      announcementStartDate,
      announcementEndDate,
    } = req.body

    // Validate required fields
    if (!code || !type || !value || !validTo) {
      return res.status(400).json({ error: 'Code, type, value, and validTo are required' })
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() })
    if (existingCoupon) {
      return res.status(400).json({ error: 'Coupon code already exists' })
    }

    // Validate dates
    const fromDate = validFrom ? new Date(validFrom) : new Date()
    const toDate = new Date(validTo)
    if (toDate <= fromDate) {
      return res.status(400).json({ error: 'ValidTo date must be after ValidFrom date' })
    }

    // Validate value based on type
    if (type === 'percentage' && (value <= 0 || value > 100)) {
      return res.status(400).json({ error: 'Percentage must be between 1 and 100' })
    }
    if (type === 'fixed' && value <= 0) {
      return res.status(400).json({ error: 'Fixed amount must be greater than 0' })
    }

    // Validate applicableTo
    if (
      applicableTo === 'categories' &&
      (!applicableCategories || applicableCategories.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: 'Applicable categories are required when applicableTo is categories' })
    }
    if (applicableTo === 'products' && (!applicableProducts || applicableProducts.length === 0)) {
      return res
        .status(400)
        .json({ error: 'Applicable products are required when applicableTo is products' })
    }

    const coupon = new Coupon({
      code: code.toUpperCase().trim(),
      type,
      value,
      minPurchaseAmount,
      maxDiscountAmount,
      usageLimit,
      perUserLimit,
      validFrom: fromDate,
      validTo: toDate,
      status: status || 'active',
      applicableTo: applicableTo || 'all',
      applicableCategories: applicableTo === 'categories' ? applicableCategories : undefined,
      applicableProducts: applicableTo === 'products' ? applicableProducts : undefined,
      firstTimeUserOnly: firstTimeUserOnly || false,
      description,
      createdBy: userId,
    })

    await coupon.save()

    // Create linked announcement if requested
    let announcementId = null
    if (createAnnouncement && announcementTitle) {
      try {
        // Use custom announcement dates if provided, otherwise use coupon dates
        const annFromDate = announcementStartDate ? new Date(announcementStartDate) : fromDate
        const annToDate = announcementEndDate ? new Date(announcementEndDate) : toDate

        // Validate announcement date range (end must be after start)
        if (annToDate <= annFromDate) {
          return res.status(400).json({ error: 'Announcement end date/time must be after start date/time' })
        }

        // Check for conflicting announcements (same start date/time)
        // Round to second precision for comparison
        const annFromDateRounded = new Date(Math.floor(annFromDate.getTime() / 1000) * 1000)
        const conflictingAnnouncements = await Announcement.find({
          startDate: {
            $gte: annFromDateRounded,
            $lt: new Date(annFromDateRounded.getTime() + 1000), // Within same second
          },
        })

        if (conflictingAnnouncements.length > 0) {
          return res.status(400).json({
            error: `Schedule conflict: ${conflictingAnnouncements.length} other announcement(s) are scheduled to start at the same date/time. Please choose a different start time.`,
            conflictingAnnouncements: conflictingAnnouncements.map((a) => ({
              id: a._id,
              title: a.title,
              startDate: a.startDate,
            })),
          })
        }

        // Prevent manual activation if start date is in the future (will auto-activate)
        const now = new Date()
        const isFutureDate = annFromDate.getTime() > now.getTime() + 1000 // 1 second buffer
        const shouldBeActive = !isFutureDate && annFromDate <= now

        // Deactivate all other active announcements first (only one can be active)
        // Only if we're activating this one
        if (shouldBeActive) {
        await Announcement.updateMany({ isActive: true }, { isActive: false })

        // Emit socket events for deactivated announcements
        const deactivated = await Announcement.find({ isActive: false })
        for (const ann of deactivated) {
          if (ann._id) {
            io.emit('announcement:deactivated', {
              announcementId: String(ann._id),
            })
            }
          }
        }

        // Create announcement with custom dates or coupon's validity dates
        const announcement = await Announcement.create({
          title: announcementTitle,
          message: announcementMessage,
          link: announcementLink || `/coupon/${coupon.code}`,
          linkText: announcementLinkText || 'Use Now',
          backgroundColor: announcementBackgroundColor || '#FFE14B',
          textColor: announcementTextColor || '#000000',
          isActive: shouldBeActive, // Active only if start date has passed
          startDate: annFromDate, // Use custom date or coupon's validFrom
          endDate: annToDate, // Use custom date or coupon's validTo
          dismissible: announcementDismissible !== false,
          targetAudience: announcementTargetAudience || 'all',
          linkedCoupon: coupon._id,
          createdBy: userId,
        })

        // Link announcement to coupon
        if (announcement._id) {
          coupon.linkedAnnouncement = announcement._id as any
          await coupon.save()
        }

        // Schedule announcement activation/deactivation
        if (announcement._id) {
          await scheduleAnnouncement(String(announcement._id))
          announcementId = announcement._id
        }

        // Emit socket event if activated
        if (announcement.isActive) {
          io.emit('announcement:activated', {
            announcement: announcement.toObject(),
          })
        }

        console.log(
          `[Coupon] Created linked announcement "${announcementTitle}" for coupon ${coupon.code}`,
        )
      } catch (announcementError) {
        console.error('Error creating linked announcement:', announcementError)
        // Don't fail coupon creation if announcement creation fails
      }
    }

    const populatedCoupon = await Coupon.findById(coupon._id)
      .populate('createdBy', 'name email')
      .populate('applicableCategories', 'name slug')
      .populate('applicableProducts', 'name slug')
      .populate('linkedAnnouncement', 'title isActive startDate endDate')

    // Notify affected sellers (async, don't block response)
    try {
      const affectedSellers = await getAffectedSellers(coupon)
      if (affectedSellers.length > 0) {
        // Run in background - don't await
        notifySellersAboutCoupon(affectedSellers, 'created', coupon.toObject()).catch((err) => {
          console.error('Error notifying sellers about coupon creation:', err)
        })
      }
    } catch (error) {
      console.error('Error getting affected sellers for coupon creation:', error)
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      message: 'Coupon created successfully',
      coupon: populatedCoupon,
      announcementCreated: !!announcementId,
    })
  } catch (err: unknown) {
    console.error('Error creating coupon:', err)
    if ((err as any).code === 11000) {
      return res.status(400).json({ error: 'Coupon code already exists' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// UPDATE coupon
// --------------------
export const updateCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const {
      code,
      type,
      value,
      minPurchaseAmount,
      maxDiscountAmount,
      usageLimit,
      perUserLimit,
      validFrom,
      validTo,
      status,
      applicableTo,
      applicableCategories,
      applicableProducts,
      firstTimeUserOnly,
      description,
      // Announcement fields
      createAnnouncement,
      announcementTitle,
      announcementMessage,
      announcementLink,
      announcementLinkText,
      announcementBackgroundColor,
      announcementTextColor,
      announcementDismissible,
      announcementTargetAudience,
      updateExistingAnnouncement,
      announcementStartDate,
      announcementEndDate,
    } = req.body

    const coupon = await Coupon.findById(id)
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    // Check if code is being changed and if it already exists
    if (code && code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() })
      if (existingCoupon) {
        return res.status(400).json({ error: 'Coupon code already exists' })
      }
      coupon.code = code.toUpperCase().trim()
    }

    // Update fields
    if (type !== undefined) coupon.type = type
    if (value !== undefined) coupon.value = value
    if (minPurchaseAmount !== undefined) coupon.minPurchaseAmount = minPurchaseAmount
    if (maxDiscountAmount !== undefined) coupon.maxDiscountAmount = maxDiscountAmount
    if (usageLimit !== undefined) coupon.usageLimit = usageLimit
    if (perUserLimit !== undefined) coupon.perUserLimit = perUserLimit
    if (validFrom !== undefined) coupon.validFrom = new Date(validFrom)
    if (validTo !== undefined) coupon.validTo = new Date(validTo)
    if (status !== undefined) coupon.status = status
    if (applicableTo !== undefined) coupon.applicableTo = applicableTo
    if (firstTimeUserOnly !== undefined) coupon.firstTimeUserOnly = firstTimeUserOnly
    if (description !== undefined) coupon.description = description

    // Update applicable categories/products
    if (applicableTo === 'categories') {
      coupon.applicableCategories = applicableCategories || []
      coupon.applicableProducts = []
    } else if (applicableTo === 'products') {
      coupon.applicableProducts = applicableProducts || []
      coupon.applicableCategories = []
    } else if (applicableTo === 'all') {
      coupon.applicableCategories = []
      coupon.applicableProducts = []
    }

    // Validate dates
    if (coupon.validTo <= coupon.validFrom) {
      return res.status(400).json({ error: 'ValidTo date must be after ValidFrom date' })
    }

    // Validate value
    if (coupon.type === 'percentage' && (coupon.value <= 0 || coupon.value > 100)) {
      return res.status(400).json({ error: 'Percentage must be between 1 and 100' })
    }
    if (coupon.type === 'fixed' && coupon.value <= 0) {
      return res.status(400).json({ error: 'Fixed amount must be greater than 0' })
    }

    await coupon.save()

    // Handle announcement creation/update
    let announcementId: any = coupon.linkedAnnouncement
    if (createAnnouncement && announcementTitle) {
      try {
        const couponFromDate = validFrom ? new Date(validFrom) : coupon.validFrom
        const couponToDate = validTo ? new Date(validTo) : coupon.validTo

        // Use custom announcement dates if provided, otherwise use coupon dates
        const annFromDate = announcementStartDate
          ? new Date(announcementStartDate)
          : couponFromDate
        const annToDate = announcementEndDate ? new Date(announcementEndDate) : couponToDate

        // Validate announcement date range (end must be after start)
        if (annToDate <= annFromDate) {
          return res.status(400).json({ error: 'Announcement end date/time must be after start date/time' })
        }

        // If coupon already has a linked announcement, update it; otherwise create new
        if (coupon.linkedAnnouncement && updateExistingAnnouncement) {
          // Cancel old schedule
          cancelAnnouncementSchedule(String(coupon.linkedAnnouncement))

          // Check for conflicting announcements (same start date/time) - exclude current one
          const annFromDateRounded = new Date(Math.floor(annFromDate.getTime() / 1000) * 1000)
          const conflictingAnnouncements = await Announcement.find({
            _id: { $ne: coupon.linkedAnnouncement },
            startDate: {
              $gte: annFromDateRounded,
              $lt: new Date(annFromDateRounded.getTime() + 1000), // Within same second
            },
          })

          if (conflictingAnnouncements.length > 0) {
            return res.status(400).json({
              error: `Schedule conflict: ${conflictingAnnouncements.length} other announcement(s) are scheduled to start at the same date/time. Please choose a different start time.`,
              conflictingAnnouncements: conflictingAnnouncements.map((a) => ({
                id: a._id,
                title: a.title,
                startDate: a.startDate,
              })),
            })
          }

          // Update existing announcement
          const existingAnnouncement = await Announcement.findById(coupon.linkedAnnouncement)
          if (existingAnnouncement) {
            existingAnnouncement.title = announcementTitle
            if (announcementMessage !== undefined) existingAnnouncement.message = announcementMessage
            if (announcementLink !== undefined) existingAnnouncement.link = announcementLink
            if (announcementLinkText !== undefined)
              existingAnnouncement.linkText = announcementLinkText
            if (announcementBackgroundColor !== undefined)
              existingAnnouncement.backgroundColor = announcementBackgroundColor
            if (announcementTextColor !== undefined)
              existingAnnouncement.textColor = announcementTextColor
            if (announcementDismissible !== undefined)
              existingAnnouncement.dismissible = announcementDismissible
            if (announcementTargetAudience !== undefined)
              existingAnnouncement.targetAudience = announcementTargetAudience

            // Update dates (use custom announcement dates if provided, otherwise use coupon dates)
            const newFromDate = annFromDate
            const newToDate = annToDate

            // If dates changed, need to reschedule
            if (newFromDate.getTime() !== existingAnnouncement.startDate?.getTime()) {
              existingAnnouncement.startDate = newFromDate
            }
            if (newToDate.getTime() !== existingAnnouncement.endDate?.getTime()) {
              existingAnnouncement.endDate = newToDate
            }

            // Prevent manual activation if start date is in the future (will auto-activate)
            const now = new Date()
            const isFutureDate = newFromDate.getTime() > now.getTime() + 1000 // 1 second buffer
            const shouldBeActive = !isFutureDate && newFromDate <= now

            // Auto-deactivate if coupon is expired
            if (coupon.status === 'expired' || newToDate < now) {
              existingAnnouncement.isActive = false
            } else if (shouldBeActive) {
              // Auto-activate if start date has passed
              // Deactivate all others first
              await Announcement.updateMany(
                { _id: { $ne: existingAnnouncement._id }, isActive: true },
                { isActive: false },
              )

              // Emit socket events for deactivated announcements
              const deactivated = await Announcement.find({
                _id: { $ne: existingAnnouncement._id },
                isActive: false,
              })
              for (const ann of deactivated) {
                if (ann._id) {
                  io.emit('announcement:deactivated', {
                    announcementId: String(ann._id),
                  })
                }
              }

              existingAnnouncement.isActive = true
            } else {
              // Future date - ensure inactive
              existingAnnouncement.isActive = false
            }

            await existingAnnouncement.save()

            // Reschedule
            await scheduleAnnouncement(String(existingAnnouncement._id))

            // Emit socket event if activated
            if (existingAnnouncement.isActive) {
              io.emit('announcement:activated', {
                announcement: existingAnnouncement.toObject(),
              })
            }

            console.log(
              `[Coupon] Updated linked announcement "${announcementTitle}" for coupon ${coupon.code}`,
            )
          }
        } else if (!coupon.linkedAnnouncement) {
          // Create new announcement (same logic as create)
          // Check for conflicting announcements (same start date/time)
          const annFromDateRounded = new Date(Math.floor(annFromDate.getTime() / 1000) * 1000)
          const conflictingAnnouncements = await Announcement.find({
            startDate: {
              $gte: annFromDateRounded,
              $lt: new Date(annFromDateRounded.getTime() + 1000), // Within same second
            },
          })

          if (conflictingAnnouncements.length > 0) {
            return res.status(400).json({
              error: `Schedule conflict: ${conflictingAnnouncements.length} other announcement(s) are scheduled to start at the same date/time. Please choose a different start time.`,
              conflictingAnnouncements: conflictingAnnouncements.map((a) => ({
                id: a._id,
                title: a.title,
                startDate: a.startDate,
              })),
            })
          }

          // Prevent manual activation if start date is in the future (will auto-activate)
          const now = new Date()
          const isFutureDate = annFromDate.getTime() > now.getTime() + 1000 // 1 second buffer
          const shouldBeActive = !isFutureDate && annFromDate <= now

          // Deactivate all other active announcements first (only one can be active)
          // Only if we're activating this one
          if (shouldBeActive) {
          await Announcement.updateMany({ isActive: true }, { isActive: false })

          // Emit socket events for deactivated announcements
          const deactivated = await Announcement.find({ isActive: false })
          for (const ann of deactivated) {
            if (ann._id) {
              io.emit('announcement:deactivated', {
                announcementId: String(ann._id),
              })
              }
            }
          }

          const announcement = await Announcement.create({
            title: announcementTitle,
            message: announcementMessage,
            link: announcementLink || `/coupon/${coupon.code}`,
            linkText: announcementLinkText || 'Use Now',
            backgroundColor: announcementBackgroundColor || '#FFE14B',
            textColor: announcementTextColor || '#000000',
            isActive: shouldBeActive, // Active only if start date has passed
            startDate: annFromDate, // Use custom date or coupon's validFrom
            endDate: annToDate, // Use custom date or coupon's validTo
            dismissible: announcementDismissible !== false,
            targetAudience: announcementTargetAudience || 'all',
            linkedCoupon: coupon._id,
            createdBy: req.user?.userId,
          })

          if (announcement._id) {
            coupon.linkedAnnouncement = announcement._id as any
            await coupon.save()
            await scheduleAnnouncement(String(announcement._id))
            if (announcement._id) {
              announcementId = announcement._id
            }
          }

          if (announcement.isActive) {
            io.emit('announcement:activated', {
              announcement: announcement.toObject(),
            })
          }

          console.log(
            `[Coupon] Created linked announcement "${announcementTitle}" for coupon ${coupon.code}`,
          )
        }
      } catch (announcementError) {
        console.error('Error handling linked announcement:', announcementError)
      }
    } else if (
      !createAnnouncement &&
      coupon.linkedAnnouncement &&
      updateExistingAnnouncement === false
    ) {
      // Delete linked announcement if admin unchecked the option
      try {
        const linkedAnn = await Announcement.findById(coupon.linkedAnnouncement)
        if (linkedAnn) {
          cancelAnnouncementSchedule(String(coupon.linkedAnnouncement))
          await Announcement.findByIdAndDelete(coupon.linkedAnnouncement)
          coupon.linkedAnnouncement = undefined as any
          await coupon.save()

          io.emit('announcement:deactivated', {
            announcementId: String(coupon.linkedAnnouncement),
          })

          console.log(
            `[Coupon] Deleted linked announcement for coupon ${coupon.code}`,
          )
        }
      } catch (announcementError) {
        console.error('Error deleting linked announcement:', announcementError)
      }
    } else if (coupon.linkedAnnouncement && validFrom && validTo) {
      // Update announcement dates if coupon dates changed
      try {
        const linkedAnn = await Announcement.findById(coupon.linkedAnnouncement)
        if (linkedAnn) {
          const newFromDate = new Date(validFrom)
          const newToDate = new Date(validTo)

          if (
            linkedAnn.startDate?.getTime() !== newFromDate.getTime() ||
            linkedAnn.endDate?.getTime() !== newToDate.getTime()
          ) {
            linkedAnn.startDate = newFromDate
            linkedAnn.endDate = newToDate

            // Auto-deactivate if coupon expired
            if (coupon.status === 'expired' || newToDate < new Date()) {
              linkedAnn.isActive = false
            }

            await linkedAnn.save()
            cancelAnnouncementSchedule(String(coupon.linkedAnnouncement))
            await scheduleAnnouncement(String(coupon.linkedAnnouncement))
          }
        }
      } catch (announcementError) {
        console.error('Error updating announcement dates:', announcementError)
      }
    }

    // Auto-deactivate announcement if coupon expires (handled in post-save hook, but also check here)
    if (coupon.status === 'expired' && coupon.linkedAnnouncement) {
      try {
        const linkedAnn = await Announcement.findById(coupon.linkedAnnouncement)
        if (linkedAnn && linkedAnn.isActive) {
          linkedAnn.isActive = false
          await linkedAnn.save()
          cancelAnnouncementSchedule(String(coupon.linkedAnnouncement))

          io.emit('announcement:deactivated', {
            announcementId: String(coupon.linkedAnnouncement),
          })

          console.log(
            `[Coupon] Auto-deactivated announcement for expired coupon ${coupon.code}`,
          )
        }
      } catch (announcementError) {
        console.error('Error deactivating announcement for expired coupon:', announcementError)
      }
    }

    // Also check if validTo date has passed (may happen before status changes)
    if (coupon.validTo < new Date() && coupon.linkedAnnouncement) {
      try {
        const linkedAnn = await Announcement.findById(coupon.linkedAnnouncement)
        if (linkedAnn && linkedAnn.isActive) {
          linkedAnn.isActive = false
          await linkedAnn.save()
          cancelAnnouncementSchedule(String(coupon.linkedAnnouncement))

          io.emit('announcement:deactivated', {
            announcementId: String(coupon.linkedAnnouncement),
          })

          console.log(
            `[Coupon] Auto-deactivated announcement for expired coupon ${coupon.code} (via validTo check)`,
          )
        }
      } catch (announcementError) {
        console.error('Error deactivating announcement for expired coupon:', announcementError)
      }
    }

    const populatedCoupon = await Coupon.findById(coupon._id)
      .populate('createdBy', 'name email')
      .populate('applicableCategories', 'name slug')
      .populate('applicableProducts', 'name slug')
      .populate('linkedAnnouncement', 'title isActive startDate endDate')

    res.json({
      message: 'Coupon updated successfully',
      coupon: populatedCoupon,
    })
  } catch (err: unknown) {
    console.error('Error updating coupon:', err)
    if ((err as any).code === 11000) {
      return res.status(400).json({ error: 'Coupon code already exists' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// DELETE coupon
// --------------------
export const deleteCoupon = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const coupon = await Coupon.findById(id)
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' })
    }

    // Check if coupon has linked announcement
    if (coupon.linkedAnnouncement) {
      try {
        const linkedAnn = await Announcement.findById(coupon.linkedAnnouncement)
        if (linkedAnn) {
          // Cancel scheduled timers
          cancelAnnouncementSchedule(String(coupon.linkedAnnouncement))

          // Delete the announcement
          await Announcement.findByIdAndDelete(coupon.linkedAnnouncement)

          // Emit socket event
          io.emit('announcement:deactivated', {
            announcementId: String(coupon.linkedAnnouncement),
          })

          console.log(
            `[Coupon] Deleted linked announcement "${linkedAnn.title}" for coupon ${coupon.code}`,
          )
        }
      } catch (announcementError) {
        console.error('Error deleting linked announcement:', announcementError)
        // Continue with coupon deletion even if announcement deletion fails
      }
    }

    // Notify affected sellers before deleting (async, don't block response)
    try {
      const affectedSellers = await getAffectedSellers(coupon)
      if (affectedSellers.length > 0) {
        // Run in background - don't await
        notifySellersAboutCoupon(affectedSellers, 'deleted', coupon.toObject()).catch((err) => {
          console.error('Error notifying sellers about coupon deletion:', err)
        })
      }
    } catch (error) {
      console.error('Error getting affected sellers for coupon deletion:', error)
      // Don't fail the request if notification fails
    }

    await Coupon.findByIdAndDelete(id)

    res.json({
      message: 'Coupon deleted successfully',
      announcementDeleted: !!coupon.linkedAnnouncement,
    })
  } catch (err: unknown) {
    console.error('Error deleting coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// VALIDATE coupon code (for frontend use)
// --------------------
export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { code, cartTotal, userId, cartItems } = req.body

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' })
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() })
    if (!coupon) {
      return res.status(404).json({ error: 'Invalid coupon code' })
    }

    // Check if coupon is active
    if (coupon.status !== 'active') {
      return res.status(400).json({ error: 'Coupon is not active' })
    }

    // Check if coupon is expired
    const now = new Date()
    if (coupon.validTo < now) {
      await Coupon.findByIdAndUpdate(coupon._id, { status: 'expired' })
      return res.status(400).json({ error: 'Coupon has expired' })
    }

    // Check if coupon has started
    if (coupon.validFrom > now) {
      return res.status(400).json({ error: 'Coupon is not yet valid' })
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.status(400).json({ error: 'Coupon usage limit reached' })
    }

    // Check minimum purchase amount
    // NOTE: cartTotal should be subtotal (order total WITHOUT shipping)
    if (coupon.minPurchaseAmount && cartTotal < coupon.minPurchaseAmount) {
      return res.status(400).json({
        error: `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required`,
      })
    }

    // Check if applicable to cart items
    if (coupon.applicableTo === 'categories' && cartItems && cartItems.length > 0) {
      // Fetch product categories from product IDs
      const productIds = cartItems
        .map((item: any) => item.product?._id)
        .filter((id: string) => id)
      
      if (productIds.length === 0) {
        return res.status(400).json({ error: 'Invalid cart items' })
      }

      const products = await Product.find({ _id: { $in: productIds } }).select('category')
      const cartCategoryIds = products
        .map((p) => p.category?.toString())
        .filter((id: string) => id)
      
      const applicableCategoryIds = coupon.applicableCategories?.map((id) => id.toString())
      const hasApplicableCategory = cartCategoryIds.some((id: string) =>
        applicableCategoryIds?.includes(id),
      )
      if (!hasApplicableCategory) {
        return res.status(400).json({ error: 'Coupon is not applicable to items in your cart' })
      }
    }

    if (coupon.applicableTo === 'products' && cartItems && cartItems.length > 0) {
      const cartProductIds = cartItems
        .map((item: any) => item.product?._id?.toString())
        .filter((id: string) => id)
      const applicableProductIds = coupon.applicableProducts?.map((id) => id.toString())
      const hasApplicableProduct = cartProductIds.some((id: string) =>
        applicableProductIds?.includes(id),
      )
      if (!hasApplicableProduct) {
        return res.status(400).json({ error: 'Coupon is not applicable to items in your cart' })
      }
    }

    // Calculate discount
    // NOTE: cartTotal should be subtotal (order total WITHOUT shipping)
    // Coupons are applied on order subtotal, not on total with shipping
    let discount = 0
    if (coupon.type === 'percentage') {
      discount = (cartTotal * coupon.value) / 100
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount
      }
    } else {
      discount = coupon.value
      if (discount > cartTotal) {
        discount = cartTotal
      }
    }

    res.json({
      valid: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount,
        description: coupon.description,
      },
    })
  } catch (err: unknown) {
    console.error('Error validating coupon:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// --------------------
// GET applicable coupons for cart
// --------------------
export const getApplicableCoupons = async (req: Request, res: Response) => {
  try {
    const { cartTotal, cartItems, userId } = req.query

    const cartTotalNum = cartTotal ? Number(cartTotal) : 0
    const cartItemsArray = cartItems ? JSON.parse(cartItems as string) : []
    const userIdStr = userId ? String(userId) : undefined

    const now = new Date()

    // Find active coupons that are currently valid
    const coupons = await Coupon.find({
      status: 'active',
      validFrom: { $lte: now },
      validTo: { $gte: now },
    })
      .select('code type value minPurchaseAmount maxDiscountAmount description termsAndConditions applicableTo applicableCategories applicableProducts firstTimeUserOnly validFrom validTo')
      .sort({ createdAt: -1 })
      .limit(20)

    const applicableCoupons = []
    const almostApplicableCoupons = []

    for (const coupon of coupons) {
      // Check minimum purchase amount
      // NOTE: cartTotalNum should be subtotal (order total WITHOUT shipping)
      // Coupons are applicable on order subtotal, not on total with shipping
      const isApplicable = !coupon.minPurchaseAmount || cartTotalNum >= coupon.minPurchaseAmount
      
      // Check if "almost applicable" - within 30% of minPurchaseAmount or ₹200, whichever is smaller
      let isAlmostApplicable = false
      let amountNeeded = 0
      if (!isApplicable && coupon.minPurchaseAmount && cartTotalNum > 0) {
        const difference = coupon.minPurchaseAmount - cartTotalNum
        const threshold = Math.min(coupon.minPurchaseAmount * 0.3, 200) // 30% or ₹200, whichever is smaller
        if (difference > 0 && difference <= threshold) {
          isAlmostApplicable = true
          amountNeeded = Math.ceil(difference)
        }
      }

      // Skip if not applicable and not almost applicable
      if (!isApplicable && !isAlmostApplicable) {
        continue
      }

      // Check if first-time user only
      if (coupon.firstTimeUserOnly && userIdStr) {
        const user = await User.findById(userIdStr)
        if (user) {
          const orderCount = await Order.countDocuments({ user: userIdStr })
          if (orderCount > 0) {
            continue // Not a first-time user
          }
        }
      }

      // Check if applicable to cart items
      if (coupon.applicableTo === 'categories' && cartItemsArray.length > 0) {
        const productIds = cartItemsArray
          .map((item: any) => item.product?._id)
          .filter((id: string) => id)
        
        if (productIds.length > 0) {
          const products = await Product.find({ _id: { $in: productIds } }).select('category')
          const cartCategoryIds = products
            .map((p) => p.category?.toString())
            .filter((id: string) => id)
          
          const applicableCategoryIds = coupon.applicableCategories?.map((id) => id.toString()) || []
          const hasApplicableCategory = cartCategoryIds.some((id: string) =>
            applicableCategoryIds.includes(id),
          )
          
          if (!hasApplicableCategory) {
            continue // Not applicable to cart categories
          }
        }
      }

      if (coupon.applicableTo === 'products' && cartItemsArray.length > 0) {
        const productIds = cartItemsArray
          .map((item: any) => item.product?._id)
          .filter((id: string) => id)
        
        const applicableProductIds = coupon.applicableProducts?.map((id) => id.toString()) || []
        const hasApplicableProduct = productIds.some((id: string) =>
          applicableProductIds.includes(id),
        )
        
        if (!hasApplicableProduct) {
          continue // Not applicable to cart products
        }
      }

      // Calculate discount amount for display
      // NOTE: cartTotalNum should be subtotal (order total WITHOUT shipping)
      // Coupons are applied on order subtotal, not on total with shipping
      // For almost applicable coupons, calculate discount based on minPurchaseAmount
      const baseAmount = isApplicable ? cartTotalNum : coupon.minPurchaseAmount || cartTotalNum
      let discountAmount = 0
      if (coupon.type === 'percentage') {
        discountAmount = (baseAmount * coupon.value) / 100
        if (coupon.maxDiscountAmount) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount)
        }
      } else {
        discountAmount = coupon.value
      }

      const couponData = {
        _id: String(coupon._id),
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount: discountAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        description: coupon.description,
        termsAndConditions: coupon.termsAndConditions,
        minPurchaseAmount: coupon.minPurchaseAmount,
        validFrom: coupon.validFrom,
        validTo: coupon.validTo,
        isApplicable: isApplicable,
        isAlmostApplicable: isAlmostApplicable,
        amountNeeded: isAlmostApplicable ? amountNeeded : undefined,
      }

      if (isApplicable) {
        applicableCoupons.push(couponData)
      } else if (isAlmostApplicable) {
        almostApplicableCoupons.push(couponData)
      }
    }

    // Sort applicable coupons by discount amount (highest first)
    applicableCoupons.sort((a, b) => b.discount - a.discount)
    
    // Sort almost applicable coupons by amount needed (lowest first - closest to being applicable)
    almostApplicableCoupons.sort((a, b) => (a.amountNeeded || 0) - (b.amountNeeded || 0))

    // Return applicable coupons first, then almost applicable ones
    res.json({ 
      coupons: [...applicableCoupons, ...almostApplicableCoupons]
    })
  } catch (err: unknown) {
    console.error('Error fetching applicable coupons:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
