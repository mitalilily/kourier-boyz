import { Request, Response } from 'express'
import Announcement from '../models/Announcement'
import { scheduleAnnouncement, cancelAnnouncementSchedule } from '../services/announcementScheduler'
import { io } from '../server'

// Get active announcements for frontend (public)
export const getActiveAnnouncements = async (req: Request, res: Response) => {
  try {
    const { targetAudience } = req.query
    const now = new Date()

    const query: any = {
      isActive: true,
      $and: [
        {
          $or: [
            // No date range - always active
            { startDate: { $exists: false }, endDate: { $exists: false } },
            // Currently within date range
            { startDate: { $lte: now }, endDate: { $gte: now } },
            // Started but no end date - ongoing
            { startDate: { $lte: now }, endDate: { $exists: false } },
            // No start date but has end date in future - active until end
            { startDate: { $exists: false }, endDate: { $gte: now } },
          ],
        },
      ],
    }

    // Add target audience filter if specified
    if (targetAudience) {
      query.$and.push({
        $or: [
          { targetAudience: 'all' },
          { targetAudience },
        ],
      })
    }

    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .select('-createdBy')

    res.json({ announcements })
  } catch (err) {
    console.error('Error fetching active announcements:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get all announcements (admin)
export const getAllAnnouncements = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query

    const query: any = {}
    if (isActive !== undefined) {
      query.isActive = isActive === 'true'
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [announcements, total] = await Promise.all([
      Announcement.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email'),
      Announcement.countDocuments(query),
    ])

    res.json({
      announcements,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err) {
    console.error('Error fetching announcements:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get single announcement (admin)
export const getAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const announcement = await Announcement.findById(id).populate('createdBy', 'name email')

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' })
    }

    res.json(announcement)
  } catch (err) {
    console.error('Error fetching announcement:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Create announcement (admin)
export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const {
      title,
      message,
      link,
      linkText,
      backgroundColor,
      textColor,
      isActive,
      startDate,
      endDate,
      dismissible,
      targetAudience,
    } = req.body

    const userId = (req as any).user?.userId

    // Validate date range - ensure end time is after start time (allowing same date if different times)
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (end <= start) {
        return res.status(400).json({ error: 'End date/time must be after start date/time' })
      }
    }

    // Prevent manual activation if start date is in the future (will auto-activate)
    // Compare in UTC (both Date objects are UTC-based)
    if (isActive === true && startDate) {
      const start = new Date(startDate) // Parse ISO string to UTC Date
      const now = new Date() // Current UTC time
      // Add a small buffer (1 second) to account for any timing discrepancies
      if (start.getTime() > now.getTime() + 1000) {
        return res.status(400).json({
          error: 'Cannot manually activate an announcement with a future start date. It will be automatically activated when the scheduled time arrives.',
        })
      }
    }

    // If activating this announcement, deactivate all others
    if (isActive === true) {
      // Get list of announcements that will be deactivated
      const activeAnnouncements = await Announcement.find({ isActive: true })
      
      // Deactivate them
      await Announcement.updateMany({ isActive: true }, { isActive: false })
      
      // Emit socket events for deactivated announcements (will exclude the one we're creating)
      for (const ann of activeAnnouncements) {
        if (ann._id) {
          io.emit('announcement:deactivated', {
            announcementId: String(ann._id),
          })
        }
      }
    }

    const announcement = await Announcement.create({
      title,
      message,
      link,
      linkText: linkText || 'Learn More',
      backgroundColor: backgroundColor || '#FFE14B',
      textColor: textColor || '#000000',
      isActive: isActive === true, // Default to false
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      dismissible: dismissible !== false,
      targetAudience: targetAudience || 'all',
      createdBy: userId,
    })

    const populated = await Announcement.findById(announcement._id).populate(
      'createdBy',
      'name email',
    )

    // Schedule activation/deactivation if dates are set
    if (announcement._id) {
      await scheduleAnnouncement(String(announcement._id))
    }

    res.status(201).json(populated)
  } catch (err: any) {
    console.error('Error creating announcement:', err)
    if (err.message?.includes('End date must be after start date')) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Update announcement (admin)
export const updateAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const {
      title,
      message,
      link,
      linkText,
      backgroundColor,
      textColor,
      isActive,
      startDate,
      endDate,
      dismissible,
      targetAudience,
    } = req.body

    const announcement = await Announcement.findById(id)

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' })
    }

    // Validate date range
    const start = startDate !== undefined ? (startDate ? new Date(startDate) : null) : announcement.startDate
    const end = endDate !== undefined ? (endDate ? new Date(endDate) : null) : announcement.endDate
    
    if (start && end && end <= start) {
      return res.status(400).json({ error: 'End date/time must be after start date/time' })
    }

    // Prevent manual activation if start date is in the future (will auto-activate)
    // But allow activation if dates are being removed (set to null/undefined)
    // Compare in UTC (both Date objects are UTC-based)
    const effectiveStartDate = startDate !== undefined ? (startDate ? new Date(startDate) : null) : announcement.startDate
    const isRemovingDates = (startDate === null || startDate === undefined) && announcement.startDate
    
    // Only prevent activation if there's a future start date (not if dates are being removed)
    if (isActive === true && effectiveStartDate && !isRemovingDates) {
      const now = new Date() // Current UTC time
      // Add a small buffer (1 second) to account for any timing discrepancies
      if (effectiveStartDate.getTime() > now.getTime() + 1000) {
        return res.status(400).json({
          error: 'Cannot manually activate an announcement with a future start date. It will be automatically activated when the scheduled time arrives.',
        })
      }
    }
    
    // If dates are being removed and announcement is being activated, allow it
    // This means the announcement will be "Always Active" (no date restrictions)

    // If activating this announcement, deactivate all others (except this one)
    if (isActive === true && !announcement.isActive) {
      // Get list of announcements that will be deactivated
      const activeAnnouncements = await Announcement.find({ 
        _id: { $ne: id }, 
        isActive: true 
      })
      
      // Deactivate them
      await Announcement.updateMany({ _id: { $ne: id }, isActive: true }, { isActive: false })
      
      // Emit socket events for deactivated announcements
      for (const ann of activeAnnouncements) {
        if (ann._id) {
          io.emit('announcement:deactivated', {
            announcementId: String(ann._id),
          })
        }
      }
    }

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (message !== undefined) updateData.message = message
    if (link !== undefined) updateData.link = link
    if (linkText !== undefined) updateData.linkText = linkText
    if (backgroundColor !== undefined) updateData.backgroundColor = backgroundColor
    if (textColor !== undefined) updateData.textColor = textColor
    if (isActive !== undefined) updateData.isActive = isActive
    // Handle date removal: if explicitly set to null/undefined, remove the dates
    if (startDate !== undefined) {
      updateData.startDate = startDate ? new Date(startDate) : null
    }
    if (endDate !== undefined) {
      updateData.endDate = endDate ? new Date(endDate) : null
    }
    if (dismissible !== undefined) updateData.dismissible = dismissible
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience

    const updated = await Announcement.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('createdBy', 'name email')

    // Cancel old schedule and create new one with updated dates
    cancelAnnouncementSchedule(id)
    await scheduleAnnouncement(id)

    // Emit socket event if status changed
    if (updated && isActive !== undefined && isActive !== announcement.isActive) {
      if (isActive) {
        io.emit('announcement:activated', {
          announcement: updated.toObject(),
        })
      } else {
        io.emit('announcement:deactivated', {
          announcementId: id,
        })
      }
    }

    res.json(updated)
  } catch (err: any) {
    console.error('Error updating announcement:', err)
    if (err.message?.includes('End date must be after start date')) {
      return res.status(400).json({ error: err.message })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Delete announcement (admin)
export const deleteAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const announcement = await Announcement.findById(id)

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' })
    }

    // Cancel any scheduled timers before deleting
    cancelAnnouncementSchedule(id)

    await Announcement.findByIdAndDelete(id)

    res.json({ message: 'Announcement deleted successfully' })
  } catch (err) {
    console.error('Error deleting announcement:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Scheduled task: Auto-activate/deactivate announcements based on dates
export const processScheduledAnnouncements = async () => {
  try {
    const now = new Date()
    let activatedCount = 0
    let deactivatedCount = 0

    // Step 1: Deactivate announcements that have expired (endDate has passed)
    const expired = await Announcement.find({
      isActive: true,
      endDate: { $exists: true, $lt: now },
    })

    if (expired.length > 0) {
      await Announcement.updateMany(
        { _id: { $in: expired.map((a) => a._id) } },
        { isActive: false },
      )
      deactivatedCount += expired.length
      console.log(
        `[Announcements] Auto-deactivated ${expired.length} expired announcement(s): ${expired.map((a) => `"${a.title}"`).join(', ')}`,
      )
    }

    // Step 2: Check currently active announcement - deactivate if invalid
    const currentlyActive = await Announcement.findOne({ isActive: true })
    if (currentlyActive) {
      const isValid =
        (!currentlyActive.startDate || currentlyActive.startDate <= now) &&
        (!currentlyActive.endDate || currentlyActive.endDate >= now)

      if (!isValid) {
        await Announcement.findByIdAndUpdate(currentlyActive._id, { isActive: false })
        deactivatedCount++
        console.log(
          `[Announcements] Deactivated invalid active announcement: "${currentlyActive.title}"`,
        )
      }
    }

    // Step 3: Find announcements eligible to be active (startDate has arrived, not expired)
    // Only consider ones with startDate that has arrived (for auto-activation)
    const eligibleToActivate = await Announcement.find({
      isActive: false,
      startDate: { $exists: true, $lte: now }, // StartDate has arrived
      $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }], // Not expired
    }).sort({ startDate: 1, createdAt: 1 }) // Sort by earliest startDate, then creation date

    // Step 4: If no active announcement exists and we have eligible ones, activate the first one
    const stillActive = await Announcement.findOne({ isActive: true })
    if (!stillActive && eligibleToActivate.length > 0) {
      const toActivate = eligibleToActivate[0]
      await Announcement.findByIdAndUpdate(toActivate._id, { isActive: true })
      activatedCount++
      console.log(
        `[Announcements] Auto-activated announcement: "${toActivate.title}" (startDate: ${toActivate.startDate?.toISOString()})`,
      )
    }

    return {
      activated: activatedCount,
      deactivated: deactivatedCount,
    }
  } catch (err) {
    console.error('Error processing scheduled announcements:', err)
    throw err
  }
}

