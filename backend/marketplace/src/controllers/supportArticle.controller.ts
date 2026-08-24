import { Request, Response } from 'express'
import SupportArticle from '../models/SupportArticle'

// Get all published articles (public)
export const getPublishedArticles = async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query as { category?: string; search?: string }
    const query: any = { published: true }

    if (category) {
      query.category = category
    }

    if (search) {
      query.$text = { $search: search }
    }

    const articles = await SupportArticle.find(query)
      .select('-content') // Exclude full content in list view
      .populate('createdBy', 'name email')
      .sort({ priority: -1, createdAt: -1 })

    res.json(articles)
  } catch (err) {
    console.error('Error getting published articles:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get single article by ID (public)
export const getArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const article = await SupportArticle.findById(id).populate('createdBy', 'name email')

    if (!article) {
      return res.status(404).json({ error: 'Article not found' })
    }

    // Increment views
    article.views += 1
    await article.save()

    res.json(article)
  } catch (err) {
    console.error('Error getting article:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Get all articles (including unpublished)
export const getAllArticles = async (req: Request, res: Response) => {
  try {
    const { category, published, search } = req.query as {
      category?: string
      published?: string
      search?: string
    }
    const query: any = {}

    if (category && category.trim()) query.category = category.trim()
    if (published !== undefined && published !== '') {
      query.published = published === 'true'
    }
    
    // Use regex search instead of $text for more reliable results
    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { content: { $regex: search.trim(), $options: 'i' } },
        { tags: { $in: [new RegExp(search.trim(), 'i')] } },
      ]
    }

    const articles = await SupportArticle.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ priority: -1, createdAt: -1 })

    res.json(articles)
  } catch (err) {
    console.error('Error getting all articles:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Create article
export const createArticle = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { title, content, category, tags, published, priority } = req.body as {
      title: string
      content: string
      category: string
      tags?: string[]
      published?: boolean
      priority?: number
    }

    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Title, content, and category are required' })
    }

    const article = await SupportArticle.create({
      title,
      content,
      category,
      tags: tags || [],
      published: published !== undefined ? published : true,
      priority: priority || 0,
      createdBy: userId,
      updatedBy: userId,
    })

    const populatedArticle = await SupportArticle.findById(article._id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')

    res.status(201).json(populatedArticle)
  } catch (err) {
    console.error('Error creating article:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Update article
export const updateArticle = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params
    const { title, content, category, tags, published, priority } = req.body as {
      title?: string
      content?: string
      category?: string
      tags?: string[]
      published?: boolean
      priority?: number
    }

    const article = await SupportArticle.findById(id)
    if (!article) {
      return res.status(404).json({ error: 'Article not found' })
    }

    if (title) article.title = title
    if (content) article.content = content
    if (category) article.category = category as any
    if (tags) article.tags = tags
    if (published !== undefined) article.published = published
    if (priority !== undefined) article.priority = priority
    article.updatedBy = userId as any

    await article.save()

    const populatedArticle = await SupportArticle.findById(article._id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')

    res.json(populatedArticle)
  } catch (err) {
    console.error('Error updating article:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Delete article
export const deleteArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const article = await SupportArticle.findByIdAndDelete(id)

    if (!article) {
      return res.status(404).json({ error: 'Article not found' })
    }

    res.json({ message: 'Article deleted successfully' })
  } catch (err) {
    console.error('Error deleting article:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Public: Mark article as helpful/not helpful
export const rateArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { helpful } = req.body as { helpful: boolean }

    const article = await SupportArticle.findById(id)
    if (!article) {
      return res.status(404).json({ error: 'Article not found' })
    }

    if (helpful) {
      article.helpful += 1
    } else {
      article.notHelpful += 1
    }

    await article.save()
    res.json({ message: 'Rating recorded', helpful: article.helpful, notHelpful: article.notHelpful })
  } catch (err) {
    console.error('Error rating article:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

