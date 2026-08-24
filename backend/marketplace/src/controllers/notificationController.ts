import { Request, Response } from "express";
import Notification from "../models/Notification";
import User from "../models/User";
import Subscriber from "../models/Subscriber";
import mongoose from "mongoose";
import crypto from "crypto";

// Get all notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { page = 1, limit = 100, read } = req.query;

    // Build query
    const query: any = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    // Filter by read status if provided
    if (read !== undefined) {
      query.read = read === "true";
    }

    // Calculate pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch notifications with pagination
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for filtered results
    const total = await Notification.countDocuments(query);

    // Get unread count (all unread notifications, not just filtered)
    const unreadCount = await Notification.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      read: false,
    });

    res.json({
      success: true,
      data: notifications,
      unreadCount,
      total,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch notifications" });
  }
};

// Get unread notification count
export const getUnreadNotificationCount = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const unreadCount = await Notification.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      read: false,
    });

    res.json({
      success: true,
      count: unreadCount,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch unread count" });
  }
};

// Mark notification as read
export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { id } = req.params;

    // Verify notification belongs to user and update
    const notification = await Notification.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res
        .status(404)
        .json({ success: false, error: "Notification not found" });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to mark notification as read" });
  }
};

// Mark all notifications as read
export const markAllNotificationsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Update all unread notifications for the user
    const result = await Notification.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        read: false,
      },
      { read: true }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to mark all notifications as read",
      });
  }
};

// Get notification preferences
export const getNotificationPreferences = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const user = await User.findById(userId).select("notificationPreferences");

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Return preferences or defaults
    const preferences = user.notificationPreferences || {
      orderUpdates: true,
      promotionalEmails: true,
      newsletter: false,
    };

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to fetch notification preferences",
      });
  }
};

// Update notification preferences
export const updateNotificationPreferences = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { orderUpdates, promotionalEmails, newsletter } = req.body;

    // Build update object
    const updateData: any = {};
    if (orderUpdates !== undefined) {
      updateData["notificationPreferences.orderUpdates"] = orderUpdates;
    }
    if (promotionalEmails !== undefined) {
      updateData["notificationPreferences.promotionalEmails"] =
        promotionalEmails;
    }
    if (newsletter !== undefined) {
      updateData["notificationPreferences.newsletter"] = newsletter;
    }

    // If notificationPreferences doesn't exist, initialize it
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (!user.notificationPreferences) {
      user.notificationPreferences = {
        orderUpdates: true,
        promotionalEmails: true,
        newsletter: false,
      };
    }

    // Update preferences
    if (orderUpdates !== undefined) {
      user.notificationPreferences.orderUpdates = orderUpdates;
    }
    if (promotionalEmails !== undefined) {
      user.notificationPreferences.promotionalEmails = promotionalEmails;
    }
    if (newsletter !== undefined) {
      user.notificationPreferences.newsletter = newsletter;
    }

    await user.save();

    // Sync subscriber record with notification preferences
    // If promotionalEmails is true, ensure subscriber is active
    // If promotionalEmails is false, deactivate subscriber
    if (promotionalEmails !== undefined || newsletter !== undefined) {
      const subscriber = await Subscriber.findOne({ email: user.email.toLowerCase() });
      if (subscriber) {
        // If either promotionalEmails or newsletter is true, activate subscriber
        // Only deactivate if both are explicitly false
        const shouldBeActive = 
          user.notificationPreferences.promotionalEmails === true || 
          user.notificationPreferences.newsletter === true;
        
        if (shouldBeActive && !subscriber.isActive) {
          subscriber.isActive = true;
          subscriber.subscribedAt = new Date();
          subscriber.unsubscribedAt = undefined;
          await subscriber.save();
        } else if (!shouldBeActive && subscriber.isActive) {
          subscriber.isActive = false;
          subscriber.unsubscribedAt = new Date();
          await subscriber.save();
        }
      } else if ((promotionalEmails === true || newsletter === true) && user.role === 'customer') {
        // Create subscriber record if it doesn't exist and user wants to receive emails
        try {
          await Subscriber.create({
            email: user.email.toLowerCase(),
            name: user.name,
            source: 'manual',
            isActive: true,
            user: user._id,
            unsubscribeToken: crypto.randomBytes(32).toString('hex'),
          });
        } catch (err: any) {
          // Ignore duplicate key errors (race condition)
          if (err.code !== 11000) {
            console.error('Error creating subscriber record:', err);
          }
        }
      }
    }

    res.json({
      success: true,
      data: user.notificationPreferences,
    });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "Failed to update notification preferences",
      });
  }
};
