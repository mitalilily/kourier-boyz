import { Request, Response } from 'express'
import mongoose from 'mongoose'
import CategoryExtensionRequest from '../models/CategoryExtensionRequest'
import BrandCategoryScope from '../models/BrandCategoryScope'
import Brand from '../models/Brand'
import Category from '../models/Category'
import User from '../models/User'
import Product from '../models/Product'
import { io } from '../server'
import { emailTemplates, sendEmail } from '../utils/email'

// Get all category extension requests (admin)
export const getAllCategoryExtensionRequests = async (req: Request, res: Response) => {
  try {
    const { status, seller_id, brand_id } = req.query

    const query: any = {}

    if (status) {
      query.status = status
    }
    if (seller_id) {
      query.seller_id = seller_id
    }
    if (brand_id) {
      query.brand_id = brand_id
    }

    const requests = await CategoryExtensionRequest.find(query)
      .populate('seller_id', 'name email businessName')
      .populate('brand_id', 'brand_name brand_type status')
      .populate('category_id', 'name slug')
      .populate('reference_product_id', 'name slug status')
      .populate('reviewed_by', 'name email')
      .sort({ created_at: -1 })
      .lean()

    res.json(requests)
  } catch (error) {
    console.error('Error fetching category extension requests:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get single category extension request
export const getCategoryExtensionRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const request = await CategoryExtensionRequest.findById(id)
      .populate('seller_id', 'name email businessName')
      .populate('brand_id', 'brand_name brand_type status')
      .populate('category_id', 'name slug')
      .populate('reference_product_id', 'name slug status')
      .populate('reviewed_by', 'name email')
      .lean()

    if (!request) {
      return res.status(404).json({ error: 'Category extension request not found' })
    }

    res.json(request)
  } catch (error) {
    console.error('Error fetching category extension request:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Update category extension request status (approve/reject/need more docs)
export const updateCategoryExtensionRequestStatus = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    const { id } = req.params
    const { status, rejection_reason } = req.body

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!['APPROVED', 'REJECTED', 'NEED_MORE_DOCS'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    if (status === 'REJECTED' && !rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required for rejection' })
    }

    const request = await CategoryExtensionRequest.findById(id)
      .populate('seller_id', 'name email businessName')
      .populate('brand_id', 'brand_name brand_type status')
      .populate('category_id', 'name slug')
      .lean()

    if (!request) {
      return res.status(404).json({ error: 'Category extension request not found' })
    }

    const brand = request.brand_id as any
    const seller = request.seller_id as any
    const category = request.category_id as any

    // Verify brand is still approved
    if (brand.status !== 'APPROVED') {
      return res.status(400).json({
        error: `Brand "${brand.brand_name}" is not approved. Cannot approve category extension.`,
      })
    }

    // Update request status
    request.status = status as any
    request.reviewed_by = adminId as any
    request.reviewed_at = new Date()

    if (status === 'REJECTED') {
      request.rejection_reason = rejection_reason
    } else if (status === 'APPROVED') {
      request.rejection_reason = undefined
    }

    await (request as any).save()

    // If approved, create/update BrandCategoryScope
    if (status === 'APPROVED') {
      await BrandCategoryScope.findOneAndUpdate(
        {
          seller_id: request.seller_id,
          brand_id: request.brand_id,
          category_id: request.category_id,
        },
        {
          seller_id: request.seller_id,
          brand_id: request.brand_id,
          category_id: request.category_id,
          status: 'APPROVED',
          approved_by_admin_id: adminId,
          rejection_reason: undefined,
        },
        { upsert: true, new: true },
      )

      // Auto-unblock ALL products under this brand + category (seller-scoped)
      await Product.updateMany(
        {
          seller: request.seller_id,
          brand_id: request.brand_id,
          category: request.category_id,
          status: 'pending_category_approval',
        },
        { $set: { status: 'pending_approval' } }, // Move to pending_approval for admin review
      )
    }

    // Send email notification to seller
    try {
      if (seller && seller.email) {
        const sellerName = seller.businessName || seller.name || 'Seller'
        const brandName = brand.brand_name || ''
        const categoryName = category.name || ''
        const sellerPanelUrl = process.env.SELLER_PANEL_URL
        const sellerDashboardUrl = sellerPanelUrl ? `${sellerPanelUrl}/products` : null

        let emailSubject = ''
        let emailHtml = ''

        switch (status) {
          case 'APPROVED':
            emailSubject = `Category Approval: ${brandName} - ${categoryName}`
            emailHtml = emailTemplates.categoryExtensionApproved(
              sellerName,
              brandName,
              categoryName,
              sellerDashboardUrl,
            )
            break
          case 'REJECTED':
            emailSubject = `Category Request Rejected: ${brandName} - ${categoryName}`
            emailHtml = emailTemplates.categoryExtensionRejected(
              sellerName,
              brandName,
              categoryName,
              rejection_reason || 'No reason provided',
              sellerDashboardUrl,
            )
            break
          case 'NEED_MORE_DOCS':
            emailSubject = `Additional Information Required: ${brandName} - ${categoryName}`
            emailHtml = emailTemplates.categoryExtensionNeedsMoreDocs(
              sellerName,
              brandName,
              categoryName,
              rejection_reason || 'No specific reason provided. Please check your request details.',
              sellerDashboardUrl,
            )
            break
        }

        if (emailSubject && emailHtml) {
          await sendEmail(seller.email, emailSubject, emailHtml)
        }

        // Real-time notification via Socket.IO
        try {
          io.to(`user:${seller._id.toString()}`).emit('category-extension:status-updated', {
            requestId: id,
            brandName,
            categoryName,
            status,
            rejectionReason: rejection_reason,
            triggeredAt: new Date().toISOString(),
          })
        } catch (socketError) {
          console.error('Error sending socket notification:', socketError)
        }
      }
    } catch (notificationError) {
      console.error('Error sending category extension status notification:', notificationError)
      // Don't fail the request if notifications fail
    }

    const updatedRequest = await CategoryExtensionRequest.findById(id)
      .populate('seller_id', 'name email businessName')
      .populate('brand_id', 'brand_name brand_type status')
      .populate('category_id', 'name slug')
      .populate('reviewed_by', 'name email')
      .lean()

    res.json(updatedRequest)
  } catch (error) {
    console.error('Error updating category extension request status:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Revoke category scope (admin only)
export const revokeCategoryScope = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    const { brand_id, category_id } = req.body
    const { rejection_reason } = req.body

    if (!adminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!brand_id || !category_id) {
      return res.status(400).json({ error: 'Brand ID and Category ID are required' })
    }

    if (!rejection_reason) {
      return res.status(400).json({ error: 'Rejection reason is required for revocation' })
    }

    // Get seller_id from brand
    const brand = await Brand.findById(brand_id).select('seller_id')
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' })
    }
    const sellerId = brand.seller_id

    // Find and revoke the category scope
    const scope = await BrandCategoryScope.findOne({
      seller_id: sellerId,
      brand_id,
      category_id,
      status: 'APPROVED',
    })

    if (!scope) {
      return res.status(404).json({ error: 'Category scope not found or not approved' })
    }

    // Revoke the scope
    scope.status = 'REVOKED'
    scope.rejection_reason = rejection_reason
    await scope.save()

    // Pause all live products under this brand + category (seller-scoped)
    await Product.updateMany(
      {
        seller: sellerId,
        brand_id,
        category: category_id,
        status: { $in: ['active', 'inactive'] },
      },
      { $set: { status: 'inactive' } },
    )

    // Move pending_category_approval products to inactive as well (seller-scoped)
    await Product.updateMany(
      {
        seller: sellerId,
        brand_id,
        category: category_id,
        status: 'pending_category_approval',
      },
      { $set: { status: 'inactive' } },
    )

    res.json({
      message: 'Category scope revoked successfully',
      scope,
    })
  } catch (error) {
    console.error('Error revoking category scope:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

