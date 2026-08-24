import crypto from 'crypto'
import { Request, Response } from 'express'
import Notification from '../models/Notification'
import PromotionalEmail from '../models/PromotionalEmail'
import Subscriber from '../models/Subscriber'
import User from '../models/User'
import { promotionalEmailTemplates, sendBulkEmailViaSMTP } from '../services/email.service'
import { deleteFromR2, uploadToR2 } from '../utils/r2Upload'

// Get all promotional emails with filters
export const getPromotionalEmails = async (req: Request, res: Response) => {
  try {
    const { status, search, page = '1', limit = '10' } = req.query

    const query: any = {}

    if (status) {
      query.status = status
    }

    if (search) {
      query.$text = { $search: search as string }
    }

    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum

    const emails = await PromotionalEmail.find(query)
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    const total = await PromotionalEmail.countDocuments(query)

    res.json({
      emails,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get single promotional email
export const getPromotionalEmail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const email = await PromotionalEmail.findById(id).populate('author', 'name email').lean()

    if (!email) {
      return res.status(404).json({ error: 'Promotional email not found' })
    }

    res.json(email)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Create promotional email
export const createPromotionalEmail = async (req: Request, res: Response) => {
  try {
    const { subject, content, excerpt, status, targetAudience, previewText } = req.body
    const sendNow = req.body.sendNow === 'true' || req.body.sendNow === true
    const scheduledAt = req.body.scheduledAt

    const authorId = req.user?.userId
    if (!authorId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Upload featured image if provided
    const imageFile = (req as any).file
    let featuredImageUrl: string | undefined

    if (imageFile) {
      featuredImageUrl = await uploadToR2(
        imageFile.buffer,
        imageFile.originalname,
        imageFile.mimetype,
        'promotional-emails',
      )
    }

    const emailData: any = {
      subject,
      content,
      excerpt,
      author: authorId,
      status: status || 'draft',
      targetAudience: targetAudience || 'subscribers',
      previewText,
    }

    if (featuredImageUrl) {
      emailData.featuredImage = featuredImageUrl
    }

    // Handle scheduling
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt)
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' })
      }
      emailData.scheduledAt = scheduledDate
      // When scheduled, status is locked to draft (as per frontend requirement)
      emailData.status = 'draft'
    } else if (sendNow) {
      // If send now is checked, ensure status is published
      emailData.status = 'published'
      emailData.publishedAt = new Date()
    } else if (status === 'published') {
      emailData.publishedAt = new Date()
    }

    const email = await PromotionalEmail.create(emailData)
    const populatedEmail = await PromotionalEmail.findById(email._id).populate(
      'author',
      'name email',
    )

    // Send immediately if sendNow is true and status is published
    if (sendNow && email.status === 'published') {
      // Send in background to not block the response
      executeSendPromotionalEmail(email).catch((err) => {
        console.error('Error sending promotional email immediately:', err)
      })
    }

    res.status(201).json(populatedEmail)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Update promotional email
export const updatePromotionalEmail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { subject, content, excerpt, status, targetAudience, previewText } = req.body

    const email = await PromotionalEmail.findById(id)
    if (!email) {
      return res.status(404).json({ error: 'Promotional email not found' })
    }

    // Upload new featured image if provided
    const imageFile = (req as any).file
    if (imageFile) {
      // Delete old image if exists
      if (email.featuredImage) {
        await deleteFromR2(email.featuredImage)
      }

      const featuredImageUrl = await uploadToR2(
        imageFile.buffer,
        imageFile.originalname,
        imageFile.mimetype,
        'promotional-emails',
      )
      email.featuredImage = featuredImageUrl
    }

    // Update fields
    email.subject = subject || email.subject
    email.content = content || email.content
    email.excerpt = excerpt !== undefined ? excerpt : email.excerpt
    email.status = status || email.status
    email.targetAudience = targetAudience || email.targetAudience
    email.previewText = previewText !== undefined ? previewText : email.previewText

    // Set publishedAt if status is published and not already set
    if (status === 'published' && !email.publishedAt) {
      email.publishedAt = new Date()
    }

    await email.save()

    const updatedEmail = await PromotionalEmail.findById(email._id).populate('author', 'name email')

    res.json(updatedEmail)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Delete promotional email
export const deletePromotionalEmail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const email = await PromotionalEmail.findById(id)
    if (!email) {
      return res.status(404).json({ error: 'Promotional email not found' })
    }

    // Delete featured image if exists
    if (email.featuredImage) {
      await deleteFromR2(email.featuredImage)
    }

    await PromotionalEmail.findByIdAndDelete(id)

    res.json({ message: 'Promotional email deleted successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Process scheduled promotional emails (called by scheduler)
export const processScheduledPromotionalEmails = async () => {
  try {
    const now = new Date()
    // Find emails that are scheduled and ready to send
    // Include both 'draft' and 'published' status as scheduled emails can be in either state
    const scheduledEmails = await PromotionalEmail.find({
      scheduledAt: { $lte: now, $exists: true },
      sentAt: { $exists: false }, // Not yet sent
    }).populate('author', 'name email')

    // Get all admin users for notifications
    const adminUsers = await User.find({ role: 'super-admin' }).select('_id').lean()

    for (const email of scheduledEmails) {
      try {
        const result = await executeSendPromotionalEmail(email)
        console.log(`Scheduled promotional email "${email.subject}" sent successfully`)

        // Notify all admins about successful send
        if (adminUsers.length > 0) {
          await Promise.all(
            adminUsers.map((admin) =>
              Notification.create({
                userId: admin._id,
                title: 'Scheduled Email Sent Successfully',
                message: `Promotional email "${email.subject}" has been sent successfully to ${result.totalRecipients} recipients (${result.sent} sent, ${result.failed} failed).`,
                type: 'system',
                read: false,
                link: `/promotional-emails/${email._id}`,
              }),
            ),
          )
        }
      } catch (err: any) {
        console.error(`Error sending scheduled promotional email "${email.subject}":`, err)

        // Notify all admins about failure
        if (adminUsers.length > 0) {
          await Promise.all(
            adminUsers.map((admin) =>
              Notification.create({
                userId: admin._id,
                title: 'Scheduled Email Failed',
                message: `Failed to send scheduled promotional email "${email.subject}". Error: ${
                  err.message || 'Unknown error'
                }`,
                type: 'system',
                read: false,
                link: `/promotional-emails/${email._id}`,
              }),
            ),
          )
        }
      }
    }
  } catch (err) {
    console.error('Error processing scheduled promotional emails:', err)
  }
}

// Helper function to actually send promotional email (reusable for immediate and scheduled sending)
const executeSendPromotionalEmail = async (
  email: any,
): Promise<{ sent: number; failed: number; totalRecipients: number }> => {
  // Get recipients based on target audience
  let recipients: Array<{ email: string; name?: string; unsubscribeToken?: string }> = []

  if (email.targetAudience === 'subscribers' || email.targetAudience === 'all') {
    const subscribers = await Subscriber.find({ isActive: true }).lean()
    recipients.push(
      ...subscribers.map((s) => ({
        email: s.email,
        name: s.name,
        unsubscribeToken: s.unsubscribeToken,
      })),
    )
  }

  if (email.targetAudience === 'all') {
    // Get customers who haven't explicitly opted out of promotional emails
    const customers = await User.find({
      role: 'customer',
      'notificationPreferences.promotionalEmails': { $ne: false },
    }).lean()

    // Get existing subscribers to check for unsubscribe tokens
    const existingSubscribers = await Subscriber.find({
      email: { $in: customers.map((c) => c.email.toLowerCase()) },
    }).lean()
    const subscriberMap = new Map(
      existingSubscribers.map((s) => [s.email.toLowerCase(), s.unsubscribeToken]),
    )

    // Add customers that aren't already in subscribers list
    const existingEmails = new Set(recipients.map((r) => r.email.toLowerCase()))

    // Create subscriber records for customers who don't have one (for proper unsubscribe tracking)
    const customersToCreateSubscriberFor = customers.filter(
      (c) =>
        !existingEmails.has(c.email.toLowerCase()) && !subscriberMap.has(c.email.toLowerCase()),
    )

    if (customersToCreateSubscriberFor.length > 0) {
      const newSubscribers = await Promise.all(
        customersToCreateSubscriberFor.map(async (c) => {
          try {
            return await Subscriber.create({
              email: c.email.toLowerCase(),
              name: c.name,
              source: 'manual',
              isActive: true,
              user: c._id,
              unsubscribeToken: crypto.randomBytes(32).toString('hex'),
            })
          } catch (err: any) {
            if (err.code === 11000) {
              return await Subscriber.findOne({ email: c.email.toLowerCase() })
            }
            throw err
          }
        }),
      )

      newSubscribers.forEach((s) => {
        if (s) {
          subscriberMap.set(s.email.toLowerCase(), s.unsubscribeToken)
        }
      })
    }

    customers.forEach((c) => {
      if (!existingEmails.has(c.email.toLowerCase())) {
        const unsubscribeToken = subscriberMap.get(c.email.toLowerCase())
        if (unsubscribeToken) {
          recipients.push({
            email: c.email,
            name: c.name,
            unsubscribeToken,
          })
        }
      }
    })
  }

  if (recipients.length === 0) {
    throw new Error('No recipients found')
  }

  // Prepare base template options
  const frontendUrl = process.env.FRONTEND_URL
  const baseTemplateOptions = {
    previewText: email.previewText || email.excerpt,
    brandName: 'Kourier Boyz',
  }

  // Prepare email content with featured image if available
  const emailContent = promotionalEmailTemplates.addFeaturedImageToContent(
    email.content,
    email.featuredImage,
  )

  // Wrap content in email template (will be personalized per recipient)
  const baseHtmlContent = promotionalEmailTemplates.wrapInTemplate(emailContent, {
    ...baseTemplateOptions,
    unsubscribeUrl: '{{unsubscribeUrl}}',
    frontendUrl,
  })

  // Send emails
  const result = await sendBulkEmailViaSMTP({
    recipients,
    subject: email.subject,
    html: baseHtmlContent,
    frontendUrl,
  })

  // Update email stats and set status to published after sending
  email.status = 'published'
  email.sentAt = new Date()
  email.sentCount = (email.sentCount || 0) + result.sent
  email.scheduledAt = undefined // Clear scheduled time after sending
  if (!email.publishedAt) {
    email.publishedAt = new Date()
  }
  await email.save()

  return {
    sent: result.sent,
    failed: result.failed,
    totalRecipients: recipients.length,
  }
}

// Send promotional email to subscribers
export const sendPromotionalEmail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const email = await PromotionalEmail.findById(id)
    if (!email) {
      return res.status(404).json({ error: 'Promotional email not found' })
    }

    if (email.status !== 'published') {
      return res.status(400).json({ error: 'Can only send published emails' })
    }

    const result = await executeSendPromotionalEmail(email)

    res.json({
      message: 'Promotional email sent successfully',
      sent: result.sent,
      failed: result.failed,
      totalRecipients: result.totalRecipients,
    })
  } catch (err: any) {
    console.error(err)
    if (err.message === 'No recipients found') {
      let message = 'No recipients found. '
      const email = await PromotionalEmail.findById(req.params.id)
      if (email?.targetAudience === 'subscribers') {
        message += 'Add subscribers in the Subscribers tab first.'
      } else {
        message += 'Add subscribers or wait for customers to register.'
      }
      return res.status(400).json({ error: message })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Get promotional email statistics
export const getPromotionalEmailStats = async (req: Request, res: Response) => {
  try {
    const totalEmails = await PromotionalEmail.countDocuments()
    const publishedEmails = await PromotionalEmail.countDocuments({ status: 'published' })
    const draftEmails = await PromotionalEmail.countDocuments({ status: 'draft' })
    const totalSent = await PromotionalEmail.aggregate([
      { $group: { _id: null, total: { $sum: '$sentCount' } } },
    ])

    const activeSubscribers = await Subscriber.countDocuments({ isActive: true })

    res.json({
      total: totalEmails,
      published: publishedEmails,
      draft: draftEmails,
      totalSent: totalSent[0]?.total || 0,
      activeSubscribers,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
