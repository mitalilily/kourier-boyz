import { Request, Response } from 'express'
import crypto from 'crypto'
import Subscriber from '../models/Subscriber'
import User from '../models/User'

// Subscribe to newsletter (public endpoint)
export const subscribe = async (req: Request, res: Response) => {
  try {
    const { email, name, source = 'website' } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Check if user exists with this email
    const user = await User.findOne({ email: email.toLowerCase(), role: 'customer' })

    // Check if already subscribed
    const existing = await Subscriber.findOne({ email: email.toLowerCase() })

    if (existing) {
      if (existing.isActive) {
        return res.status(400).json({ error: 'Email is already subscribed' })
      }

      // Reactivate subscription
      existing.isActive = true
      existing.subscribedAt = new Date()
      existing.unsubscribedAt = undefined
      existing.unsubscribeToken = crypto.randomBytes(32).toString('hex')
      if (name) existing.name = name
      if (user && !existing.user) {
        existing.user = user._id
      }
      await existing.save()

      // Update user notification preferences if user exists
      if (user) {
        if (!user.notificationPreferences) {
          user.notificationPreferences = {
            orderUpdates: true,
            promotionalEmails: true,
            newsletter: true,
          }
        } else {
          user.notificationPreferences.promotionalEmails = true
          user.notificationPreferences.newsletter = true
        }
        await user.save()
      }

      return res.json({ message: 'Successfully resubscribed to newsletter' })
    }

    // Create new subscriber
    const subscriber = await Subscriber.create({
      email: email.toLowerCase(),
      name: name || user?.name,
      source,
      user: user?._id,
      unsubscribeToken: crypto.randomBytes(32).toString('hex'),
    })

    // Update user notification preferences if user exists
    if (user) {
      if (!user.notificationPreferences) {
        user.notificationPreferences = {
          orderUpdates: true,
          promotionalEmails: true,
          newsletter: true,
        }
      } else {
        user.notificationPreferences.promotionalEmails = true
        user.notificationPreferences.newsletter = true
      }
      await user.save()
    }

    res.status(201).json({ message: 'Successfully subscribed to newsletter' })
  } catch (err: any) {
    console.error(err)
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email is already subscribed' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Unsubscribe from newsletter (public endpoint)
export const unsubscribe = async (req: Request, res: Response) => {
  try {
    const { token, email } = req.query

    let subscriber

    if (token) {
      subscriber = await Subscriber.findOne({ unsubscribeToken: token })
    } else if (email) {
      subscriber = await Subscriber.findOne({ email: (email as string).toLowerCase() })
    }

    if (!subscriber) {
      // If no subscriber found but email provided, create an inactive subscriber record
      // and update user preferences if user exists
      if (email) {
        const user = await User.findOne({ email: (email as string).toLowerCase() })
        if (user) {
          // Update user notification preferences
          if (!user.notificationPreferences) {
            user.notificationPreferences = {
              orderUpdates: true,
              promotionalEmails: false,
              newsletter: false,
            }
          } else {
            user.notificationPreferences.promotionalEmails = false
          }
          await user.save()

          // Create inactive subscriber record for tracking
          await Subscriber.create({
            email: (email as string).toLowerCase(),
            name: user.name,
            isActive: false,
            unsubscribedAt: new Date(),
            source: 'manual',
            unsubscribeToken: crypto.randomBytes(32).toString('hex'),
          })

          return res.json({ message: 'Successfully unsubscribed from promotional emails' })
        }
      }

      return res.status(404).json({ error: 'Subscription not found' })
    }

    if (!subscriber.isActive) {
      return res.json({ message: 'Already unsubscribed' })
    }

    subscriber.isActive = false
    subscriber.unsubscribedAt = new Date()
    await subscriber.save()

    // Also update user notification preferences if user exists
    if (subscriber.user) {
      const user = await User.findById(subscriber.user)
      if (user) {
        if (!user.notificationPreferences) {
          user.notificationPreferences = {
            orderUpdates: true,
            promotionalEmails: false,
            newsletter: false,
          }
        } else {
          user.notificationPreferences.promotionalEmails = false
        }
        await user.save()
      }
    } else {
      // Try to find user by email
      const user = await User.findOne({ email: subscriber.email })
      if (user) {
        if (!user.notificationPreferences) {
          user.notificationPreferences = {
            orderUpdates: true,
            promotionalEmails: false,
            newsletter: false,
          }
        } else {
          user.notificationPreferences.promotionalEmails = false
        }
        await user.save()
      }
    }

    res.json({ message: 'Successfully unsubscribed from promotional emails' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get all subscribers (admin only)
// Returns both Subscriber records and Users with promotionalEmails enabled
export const getSubscribers = async (req: Request, res: Response) => {
  try {
    const { status, search, page = '1', limit = '10' } = req.query

    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum

    // Build subscriber query
    const subscriberQuery: any = {}
    if (status === 'active') {
      subscriberQuery.isActive = true
    } else if (status === 'inactive') {
      subscriberQuery.isActive = false
    }

    // Build user query for promotional emails
    const userQuery: any = {
      role: 'customer',
      'notificationPreferences.promotionalEmails': true,
    }

    // Apply search to both queries
    if (search) {
      subscriberQuery.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ]
      userQuery.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ]
    }

    // Fetch subscribers and users in parallel
    const [subscribersFromModel, usersWithPromoEmails] = await Promise.all([
      Subscriber.find(subscriberQuery)
        .populate('user', 'name email')
        .lean(),
      User.find(userQuery).select('name email notificationPreferences').lean(),
    ])

    // Combine and deduplicate by email
    const subscriberMap = new Map<string, any>()

    // Add subscribers from Subscriber model
    subscribersFromModel.forEach((sub) => {
      const email = sub.email.toLowerCase()
      subscriberMap.set(email, {
        _id: sub._id.toString(),
        email: sub.email,
        name: sub.name,
        isActive: sub.isActive,
        subscribedAt: sub.subscribedAt,
        unsubscribedAt: sub.unsubscribedAt,
        source: sub.source,
        user: sub.user,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      })
    })

    // Add users with promotional emails enabled (if not already in subscriber map)
    usersWithPromoEmails.forEach((user) => {
      const email = user.email.toLowerCase()
      if (!subscriberMap.has(email)) {
        subscriberMap.set(email, {
          _id: user._id.toString(),
          email: user.email,
          name: user.name,
          isActive: true, // Users with promotionalEmails enabled are considered active
          subscribedAt: user.createdAt || new Date(),
          source: 'website', // Users with promotionalEmails enabled via their account preferences
          user: {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
          },
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
      }
    })

    // Convert map to array and sort
    let allSubscribers = Array.from(subscriberMap.values())

    // Apply status filter after combining
    if (status === 'active') {
      allSubscribers = allSubscribers.filter((s) => s.isActive === true)
    } else if (status === 'inactive') {
      allSubscribers = allSubscribers.filter((s) => s.isActive === false)
    }

    // Sort by subscribedAt
    allSubscribers.sort((a, b) => {
      const dateA = a.subscribedAt ? new Date(a.subscribedAt).getTime() : 0
      const dateB = b.subscribedAt ? new Date(b.subscribedAt).getTime() : 0
      return dateB - dateA
    })

    const total = allSubscribers.length
    const paginatedSubscribers = allSubscribers.slice(skip, skip + limitNum)

    res.json({
      subscribers: paginatedSubscribers,
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

// Add subscriber manually (admin only)
export const addSubscriber = async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Check if user exists with this email
    const user = await User.findOne({ email: email.toLowerCase(), role: 'customer' })

    // Check if already exists
    const existing = await Subscriber.findOne({ email: email.toLowerCase() })
    if (existing) {
      if (existing.isActive) {
        return res.status(400).json({ error: 'Email is already subscribed' })
      }

      // Reactivate
      existing.isActive = true
      existing.subscribedAt = new Date()
      existing.unsubscribedAt = undefined
      existing.unsubscribeToken = crypto.randomBytes(32).toString('hex')
      if (name) existing.name = name
      if (user && !existing.user) {
        existing.user = user._id
      }
      await existing.save()

      // Update user notification preferences if user exists
      if (user) {
        if (!user.notificationPreferences) {
          user.notificationPreferences = {
            orderUpdates: true,
            promotionalEmails: true,
            newsletter: true,
          }
        } else {
          user.notificationPreferences.promotionalEmails = true
          user.notificationPreferences.newsletter = true
        }
        await user.save()
      }

      return res.json(existing)
    }

    const subscriber = await Subscriber.create({
      email: email.toLowerCase(),
      name,
      source: 'manual',
      user: user?._id,
      unsubscribeToken: crypto.randomBytes(32).toString('hex'),
    })

    // Update user notification preferences if user exists
    if (user) {
      if (!user.notificationPreferences) {
        user.notificationPreferences = {
          orderUpdates: true,
          promotionalEmails: true,
          newsletter: true,
        }
      } else {
        user.notificationPreferences.promotionalEmails = true
        user.notificationPreferences.newsletter = true
      }
      await user.save()
    }

    res.status(201).json(subscriber)
  } catch (err: any) {
    console.error(err)
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email is already subscribed' })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Delete subscriber (admin only)
export const deleteSubscriber = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const subscriber = await Subscriber.findByIdAndDelete(id)
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' })
    }

    res.json({ message: 'Subscriber deleted successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Toggle subscriber status (admin only)
export const toggleSubscriberStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const subscriber = await Subscriber.findById(id)
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' })
    }

    subscriber.isActive = !subscriber.isActive
    if (!subscriber.isActive) {
      subscriber.unsubscribedAt = new Date()
    } else {
      subscriber.unsubscribedAt = undefined
      subscriber.subscribedAt = new Date()
    }

    await subscriber.save()

    res.json(subscriber)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get subscriber stats (admin only)
// Includes both Subscriber records and Users with promotionalEmails enabled
export const getSubscriberStats = async (req: Request, res: Response) => {
  try {
    // Get subscriber emails to avoid double counting
    const subscriberEmails = await Subscriber.find({ isActive: true })
      .select('email')
      .lean()
      .then((subs) => new Set(subs.map((s) => s.email.toLowerCase())))

    // Count users with promotional emails enabled who aren't already in subscribers
    const usersWithPromoEmails = await User.find({
      role: 'customer',
      'notificationPreferences.promotionalEmails': true,
    })
      .select('email')
      .lean()

    const uniqueActiveUsers = new Set(subscriberEmails)
    usersWithPromoEmails.forEach((user) => {
      uniqueActiveUsers.add(user.email.toLowerCase())
    })

    // Calculate stats
    const subscriberTotal = await Subscriber.countDocuments()
    const subscriberActive = await Subscriber.countDocuments({ isActive: true })
    const subscriberInactive = await Subscriber.countDocuments({ isActive: false })
    const usersWithPromoCount = usersWithPromoEmails.length
    const usersNotInSubscribers = usersWithPromoEmails.filter(
      (u) => !subscriberEmails.has(u.email.toLowerCase()),
    ).length

    const active = uniqueActiveUsers.size
    const total = subscriberTotal + usersNotInSubscribers

    // Get bySource from subscribers only (source breakdown only includes Subscriber model records)
    const bySource = await Subscriber.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ])

    const sourceMap = bySource.reduce(
      (acc, item) => {
        acc[item._id] = item.count
        return acc
      },
      {} as Record<string, number>,
    )

    // Users with promotional emails enabled (but no subscriber record) are included in active count
    // but not broken down by source since they don't have a source field

    res.json({
      total,
      active,
      inactive: subscriberInactive,
      bySource: sourceMap,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

