import { Request, Response } from 'express'
import Blog from '../models/Blog'
import Subscriber from '../models/Subscriber'
import User from '../models/User'
import { deleteFromR2, uploadToR2 } from '../utils/r2Upload'
import { sendBulkEmailViaSMTP, promotionalEmailTemplates } from '../services/email.service'

// Helper function to send blog notification emails to subscribers
const sendBlogNotificationToSubscribers = async (blog: any) => {
  try {
    // Get all active subscribers
    const subscribers = await Subscriber.find({ isActive: true }).lean()

    // Get customers who opted in for newsletter
    const customers = await User.find({
      role: 'customer',
      isEmailVerified: true,
      'notificationPreferences.newsletter': true,
    }).lean()

    // Combine recipients (avoid duplicates) and include unsubscribe tokens
    const recipients: Array<{ email: string; name?: string; unsubscribeToken?: string }> = []
    const emailSet = new Set<string>()

    // Add subscribers with their unsubscribe tokens
    subscribers.forEach((s) => {
      if (!emailSet.has(s.email.toLowerCase())) {
        emailSet.add(s.email.toLowerCase())
        recipients.push({ 
          email: s.email, 
          name: s.name,
          unsubscribeToken: s.unsubscribeToken 
        })
      }
    })

    // For customers, try to find their subscriber record to get unsubscribe token
    const customerEmails = customers.map((c) => c.email.toLowerCase())
    const customerSubscribers = await Subscriber.find({
      email: { $in: customerEmails }
    }).lean()

    const subscriberTokenMap = new Map(
      customerSubscribers.map((s) => [s.email.toLowerCase(), s.unsubscribeToken])
    )

    customers.forEach((c) => {
      const emailLower = c.email.toLowerCase()
      if (!emailSet.has(emailLower)) {
        emailSet.add(emailLower)
        recipients.push({ 
          email: c.email, 
          name: c.name,
          unsubscribeToken: subscriberTokenMap.get(emailLower)
        })
      }
    })

    if (recipients.length === 0) {
      console.log('No subscribers to notify about new blog post')
      return
    }

    const frontendUrl = process.env.FRONTEND_URL
    const blogUrl = `${frontendUrl}/blog/${blog.slug || blog._id}`

    const emailContent = promotionalEmailTemplates.newBlogPost(
      blog.title,
      blog.excerpt || blog.content.substring(0, 200) + '...',
      blogUrl,
      blog.featuredImage,
    )

    // Use placeholder for unsubscribe URL that will be personalized per recipient
    const htmlContent = promotionalEmailTemplates.wrapInTemplate(emailContent, {
      previewText: blog.excerpt || `New blog post: ${blog.title}`,
      unsubscribeUrl: '{{unsubscribeUrl}}', // Will be replaced during personalization
      brandName: 'Kourier Boyz',
      frontendUrl, // Pass frontend URL for account settings link
    })

    const result = await sendBulkEmailViaSMTP({
      recipients,
      subject: `📝 New Blog Post: ${blog.title}`,
      html: htmlContent,
      frontendUrl,
      personalize: true, // Enable personalization to replace unsubscribe URLs
    })

    console.log(`Blog notification sent to ${result.sent} subscribers (${result.failed} failed)`)
  } catch (error) {
    console.error('Error sending blog notification emails:', error)
  }
}

// Get all blogs with filters
export const getBlogs = async (req: Request, res: Response) => {
  try {
    const { status, author, tag, category, search, page = '1', limit = '10' } = req.query

    const query: any = {}

    // Filter by status (default to published for public, all for admin)
    if (status) {
      query.status = status
    } else if (!req.user || req.user.role !== 'super-admin') {
      // Public users only see published blogs
      query.status = 'published'
      query.publishedAt = { $lte: new Date() }
    }

    if (author) {
      query.author = author
    }

    if (tag) {
      query.tags = { $in: [tag] }
    }

    if (category) {
      query.categories = { $in: [category] }
    }

    if (search) {
      query.$text = { $search: search as string }
    }

    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum

    const blogs = await Blog.find(query)
      .populate('author', 'name email')
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    const total = await Blog.countDocuments(query)

    res.json({
      blogs,
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

// Get single blog by ID or slug
export const getBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({ error: 'Blog ID or slug is required' })
    }

    let blog = null

    // Check if id is a valid MongoDB ObjectId (24 hex characters)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id)

    if (isValidObjectId) {
      // Try to find by ID first if it looks like an ObjectId
      try {
        blog = await Blog.findById(id).populate('author', 'name email').lean()
      } catch (err) {
        // If findById fails, continue to slug lookup
        console.log('findById failed, trying slug lookup:', err)
      }
    }

    // If not found by ID, try to find by slug
    if (!blog) {
      blog = await Blog.findOne({ slug: id }).populate('author', 'name email').lean()
    }

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' })
    }

    // Only show published blogs to non-admin users
    const isAdmin = req.user && req.user.role === 'super-admin'
    if (blog.status !== 'published' && !isAdmin) {
      return res.status(404).json({ error: 'Blog not found' })
    }

    // Increment views for published blogs (only for non-admin users to avoid inflating views)
    if (blog.status === 'published' && !isAdmin) {
      await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } })
      blog.views = (blog.views || 0) + 1
    }

    res.json(blog)
  } catch (err) {
    console.error('Error in getBlog:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Create blog
export const createBlog = async (req: Request, res: Response) => {
  try {
    const {
      title,
      slug,
      content,
      excerpt,
      status,
      publishedAt,
      tags,
      categories,
      metaTitle,
      metaDescription,
      seoKeywords,
    } = req.body

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
        'blogs',
      )
    }

    // Parse tags and categories if they are strings
    let parsedTags = tags
    let parsedCategories = categories
    let parsedSeoKeywords = seoKeywords

    if (typeof tags === 'string') {
      try {
        parsedTags = JSON.parse(tags)
      } catch {
        parsedTags = tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      }
    }

    if (typeof categories === 'string') {
      try {
        parsedCategories = JSON.parse(categories)
      } catch {
        parsedCategories = categories.split(',').map((c: string) => c.trim()).filter(Boolean)
      }
    }

    if (typeof seoKeywords === 'string') {
      try {
        parsedSeoKeywords = JSON.parse(seoKeywords)
      } catch {
        parsedSeoKeywords = seoKeywords.split(',').map((k: string) => k.trim()).filter(Boolean)
      }
    }

    const blogData: any = {
      title,
      slug,
      content,
      excerpt,
      author: authorId,
      status: status || 'draft',
      tags: parsedTags || [],
      categories: parsedCategories || [],
      metaTitle,
      metaDescription,
      seoKeywords: parsedSeoKeywords || [],
    }

    if (featuredImageUrl) {
      blogData.featuredImage = featuredImageUrl
    }

    // Set publishedAt if status is published
    if (status === 'published') {
      blogData.publishedAt = publishedAt ? new Date(publishedAt) : new Date()
    }

    const blog = await Blog.create(blogData)

    const populatedBlog = await Blog.findById(blog._id).populate('author', 'name email')

    // Send notification to subscribers if blog is published
    if (status === 'published') {
      // Run in background to not block the response
      sendBlogNotificationToSubscribers(populatedBlog).catch(console.error)
    }

    res.status(201).json(populatedBlog)
  } catch (err: any) {
    console.error(err)
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Blog with this slug already exists' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Update blog
export const updateBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const {
      title,
      slug,
      content,
      excerpt,
      status,
      publishedAt,
      tags,
      categories,
      metaTitle,
      metaDescription,
      seoKeywords,
    } = req.body

    const blog = await Blog.findById(id)
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' })
    }

    // Track if blog was previously not published (for notification)
    const wasNotPublished = blog.status !== 'published'

    // Check if user is the author or admin
    const authorId = req.user?.userId
    if (blog.author.toString() !== authorId && req.user?.role !== 'super-admin') {
      return res.status(403).json({ error: 'Not authorized to update this blog' })
    }

    // Upload new featured image if provided
    const imageFile = (req as any).file
    if (imageFile) {
      // Delete old image if exists
      if (blog.featuredImage) {
        await deleteFromR2(blog.featuredImage)
      }

      const featuredImageUrl = await uploadToR2(
        imageFile.buffer,
        imageFile.originalname,
        imageFile.mimetype,
        'blogs',
      )
      ;(blog as any).featuredImage = featuredImageUrl
    }

    // Parse tags and categories if they are strings
    let parsedTags = tags
    let parsedCategories = categories
    let parsedSeoKeywords = seoKeywords

    if (typeof tags === 'string') {
      try {
        parsedTags = JSON.parse(tags)
      } catch {
        parsedTags = tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      }
    }

    if (typeof categories === 'string') {
      try {
        parsedCategories = JSON.parse(categories)
      } catch {
        parsedCategories = categories.split(',').map((c: string) => c.trim()).filter(Boolean)
      }
    }

    if (typeof seoKeywords === 'string') {
      try {
        parsedSeoKeywords = JSON.parse(seoKeywords)
      } catch {
        parsedSeoKeywords = seoKeywords.split(',').map((k: string) => k.trim()).filter(Boolean)
      }
    }

    // Update fields
    blog.title = title || blog.title
    blog.slug = slug || blog.slug
    blog.content = content || blog.content
    blog.excerpt = excerpt !== undefined ? excerpt : blog.excerpt
    blog.status = status || blog.status
    blog.tags = parsedTags || blog.tags
    blog.categories = parsedCategories || blog.categories
    blog.metaTitle = metaTitle !== undefined ? metaTitle : blog.metaTitle
    blog.metaDescription = metaDescription !== undefined ? metaDescription : blog.metaDescription
    blog.seoKeywords = parsedSeoKeywords || blog.seoKeywords

    // Set publishedAt if status is published and not already set
    if (status === 'published' && !blog.publishedAt) {
      blog.publishedAt = publishedAt ? new Date(publishedAt) : new Date()
    } else if (publishedAt) {
      blog.publishedAt = new Date(publishedAt)
    }

    await blog.save()

    const updatedBlog = await Blog.findById(blog._id).populate('author', 'name email')

    // Send notification to subscribers if blog was just published
    if (wasNotPublished && status === 'published') {
      // Run in background to not block the response
      sendBlogNotificationToSubscribers(updatedBlog).catch(console.error)
    }

    res.json(updatedBlog)
  } catch (err: any) {
    console.error(err)
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Blog with this slug already exists' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Delete blog
export const deleteBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const blog = await Blog.findById(id)
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' })
    }

    // Check if user is the author or admin
    const authorId = req.user?.userId
    if (blog.author.toString() !== authorId && req.user?.role !== 'super-admin') {
      return res.status(403).json({ error: 'Not authorized to delete this blog' })
    }

    // Delete featured image if exists
    if (blog.featuredImage) {
      await deleteFromR2(blog.featuredImage)
    }

    await Blog.findByIdAndDelete(id)

    res.json({ message: 'Blog deleted successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get blog statistics (for admin)
export const getBlogStats = async (req: Request, res: Response) => {
  try {
    const totalBlogs = await Blog.countDocuments()
    const publishedBlogs = await Blog.countDocuments({ status: 'published' })
    const draftBlogs = await Blog.countDocuments({ status: 'draft' })
    const archivedBlogs = await Blog.countDocuments({ status: 'archived' })
    const totalViews = await Blog.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: null, total: { $sum: '$views' } } },
    ])

    res.json({
      total: totalBlogs,
      published: publishedBlogs,
      draft: draftBlogs,
      archived: archivedBlogs,
      totalViews: totalViews[0]?.total || 0,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get newsletter subscribers (users with newsletter preference enabled)
export const getNewsletterSubscribers = async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '10' } = req.query

    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum

    // Build query for users with newsletter preference enabled
    const query: any = {
      role: 'customer',
      'notificationPreferences.newsletter': true,
    }

    // Apply search filter
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ]
    }

    // Fetch users with newsletter enabled
    const users = await User.find(query)
      .select('name email notificationPreferences createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    const total = await User.countDocuments(query)

    // Format response to match subscriber structure
    const subscribers = users.map((user) => ({
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      subscribedAt: user.createdAt || new Date(),
      createdAt: user.createdAt,
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    }))

    res.json({
      subscribers,
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

