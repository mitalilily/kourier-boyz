import Announcement from '../models/Announcement'

// Import io lazily to avoid circular dependency
let ioInstance: any = null

export const setIOInstance = (io: any) => {
  ioInstance = io
}

const getIO = () => {
  if (!ioInstance) {
    // Lazy import if not set
    const { io } = require('../server')
    ioInstance = io
  }
  return ioInstance
}

// Map to store active timers: announcementId -> { startTimer, endTimer }
const activeTimers = new Map<string, { startTimer?: NodeJS.Timeout; endTimer?: NodeJS.Timeout }>()

/**
 * Schedule activation/deactivation timers for an announcement
 */
export const scheduleAnnouncement = async (announcementId: string) => {
  try {
    // Clear existing timers for this announcement
    cancelAnnouncementSchedule(announcementId)

    const announcement = await Announcement.findById(announcementId)
    if (!announcement) {
      console.log(`[Announcement Scheduler] Announcement ${announcementId} not found`)
      return
    }

    const now = Date.now()
    const timers: { startTimer?: NodeJS.Timeout; endTimer?: NodeJS.Timeout } = {}

    // Schedule activation if startDate is in the future
    if (announcement.startDate && !announcement.isActive) {
      const startMs = announcement.startDate.getTime()
      const delay = startMs - now

      if (delay > 0 && delay < 365 * 24 * 60 * 60 * 1000) {
        // Only schedule if less than 1 year in the future
        timers.startTimer = setTimeout(async () => {
          await activateAnnouncement(announcementId)
        }, delay)

        console.log(
          `[Announcement Scheduler] Scheduled activation for "${
            announcement.title
          }" at ${announcement.startDate.toISOString()} (in ${Math.round(delay / 1000)}s)`,
        )
      }
    }

    // Schedule deactivation if endDate is in the future
    if (announcement.endDate && announcement.isActive) {
      const endMs = announcement.endDate.getTime()
      const delay = endMs - now

      if (delay > 0 && delay < 365 * 24 * 60 * 60 * 1000) {
        // Only schedule if less than 1 year in the future
        timers.endTimer = setTimeout(async () => {
          await deactivateAnnouncement(announcementId)
        }, delay)

        console.log(
          `[Announcement Scheduler] Scheduled deactivation for "${
            announcement.title
          }" at ${announcement.endDate.toISOString()} (in ${Math.round(delay / 1000)}s)`,
        )
      }
    }

    // Also schedule end timer for inactive announcements (in case they get activated later)
    if (announcement.endDate && !announcement.isActive && announcement.startDate) {
      const endMs = announcement.endDate.getTime()
      const startMs = announcement.startDate.getTime()
      const delay = endMs - now

      // Only schedule if start date has already passed or will pass before end date
      if (delay > 0 && delay < 365 * 24 * 60 * 60 * 1000 && startMs <= endMs) {
        if (!timers.endTimer) {
          // Don't override if we already set an endTimer above
          timers.endTimer = setTimeout(async () => {
            // Check if announcement is active before deactivating
            const ann = await Announcement.findById(announcementId)
            if (ann?.isActive) {
              await deactivateAnnouncement(announcementId)
            }
          }, delay)
        }
      }
    }

    // Store timers
    if (timers.startTimer || timers.endTimer) {
      activeTimers.set(announcementId, timers)
    }
  } catch (error) {
    console.error(
      `[Announcement Scheduler] Error scheduling announcement ${announcementId}:`,
      error,
    )
  }
}

/**
 * Cancel scheduled timers for an announcement
 */
export const cancelAnnouncementSchedule = (announcementId: string) => {
  const timers = activeTimers.get(announcementId)
  if (timers) {
    if (timers.startTimer) {
      clearTimeout(timers.startTimer)
    }
    if (timers.endTimer) {
      clearTimeout(timers.endTimer)
    }
    activeTimers.delete(announcementId)
  }
}

/**
 * Activate an announcement
 */
const activateAnnouncement = async (announcementId: string) => {
  try {
    const now = new Date()
    const announcement = await Announcement.findById(announcementId)

    if (!announcement) {
      console.log(
        `[Announcement Scheduler] Announcement ${announcementId} not found for activation`,
      )
      return
    }

    // Check if start date has actually arrived
    if (announcement.startDate && announcement.startDate > now) {
      // Reschedule if not yet time
      await scheduleAnnouncement(announcementId)
      return
    }

    // Check if already active
    if (announcement.isActive) {
      return
    }

    // Deactivate all other active announcements first (only one can be active)
    // Get list of announcements that will be deactivated before updating
    const activeAnnouncements = await Announcement.find({
      _id: { $ne: announcementId },
      isActive: true,
    })

    // Deactivate them
    await Announcement.updateMany(
      { _id: { $ne: announcementId }, isActive: true },
      { isActive: false },
    )

    // Emit socket events and cancel timers for deactivated announcements
    for (const ann of activeAnnouncements) {
      if (ann._id) {
        const annId = String(ann._id)
        getIO().emit('announcement:deactivated', {
          announcementId: annId,
        })
        cancelAnnouncementSchedule(annId)
      }
    }

    // Activate this announcement
    announcement.isActive = true
    await announcement.save()

    console.log(`[Announcement Scheduler] Auto-activated announcement: "${announcement.title}"`)

    // Emit socket event to notify clients
    getIO().emit('announcement:activated', {
      announcement: announcement.toObject(),
    })

    // Schedule deactivation if endDate exists
    if (announcement.endDate) {
      await scheduleAnnouncement(announcementId)
    }
  } catch (error) {
    console.error(
      `[Announcement Scheduler] Error activating announcement ${announcementId}:`,
      error,
    )
  }
}

/**
 * Deactivate an announcement
 */
const deactivateAnnouncement = async (announcementId: string) => {
  try {
    const announcement = await Announcement.findById(announcementId)

    if (!announcement) {
      console.log(
        `[Announcement Scheduler] Announcement ${announcementId} not found for deactivation`,
      )
      return
    }

    if (!announcement.isActive) {
      return
    }

    // Deactivate
    announcement.isActive = false
    await announcement.save()

    console.log(`[Announcement Scheduler] Auto-deactivated announcement: "${announcement.title}"`)

    // Emit socket event to notify clients
    getIO().emit('announcement:deactivated', {
      announcementId: announcementId,
    })

    // Cancel remaining timers
    cancelAnnouncementSchedule(announcementId)

    // Check if there are any "always active" announcements that should be reactivated
    // This handles the case where a scheduled announcement ends and we should fall back to always-active ones
    const alwaysActive = await Announcement.findOne({
      isActive: false,
      startDate: { $exists: false },
      endDate: { $exists: false },
    })

    if (alwaysActive && alwaysActive._id) {
      // Activate the always-active announcement
      alwaysActive.isActive = true
      await alwaysActive.save()

      console.log(
        `[Announcement Scheduler] Reactivated always-active announcement: "${alwaysActive.title}"`,
      )

      getIO().emit('announcement:activated', {
        announcement: alwaysActive.toObject(),
      })
    }
  } catch (error) {
    console.error(
      `[Announcement Scheduler] Error deactivating announcement ${announcementId}:`,
      error,
    )
  }
}

/**
 * Initialize scheduler - schedule all announcements with future dates on server startup
 */
export const initializeAnnouncementScheduler = async () => {
  try {
    console.log('[Announcement Scheduler] Initializing...')

    // Schedule all announcements with future start/end dates
    const announcements = await Announcement.find({
      $or: [
        { startDate: { $exists: true, $gt: new Date() } },
        { endDate: { $exists: true, $gt: new Date() } },
      ],
    })

    for (const announcement of announcements) {
      if (announcement._id) {
        await scheduleAnnouncement(String(announcement._id))
      }
    }

    console.log(
      `[Announcement Scheduler] Initialized. Scheduled ${announcements.length} announcement(s)`,
    )
  } catch (error) {
    console.error('[Announcement Scheduler] Error initializing:', error)
  }
}

/**
 * Get count of active timers (for debugging)
 */
export const getActiveTimerCount = () => {
  return activeTimers.size
}
