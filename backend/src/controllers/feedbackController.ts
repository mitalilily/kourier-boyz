import { Request, Response } from "express";
import {
  Feedback,
  FeedbackPromptStatus,
  FeedbackType,
  FeedbackSource,
} from "../models/Feedback";
import User from "../models/User";

// Constants for feedback timing (in days)
const DAYS_AFTER_FEEDBACK = 60; // 2 months - if user gave feedback
const DAYS_AFTER_NO_FEEDBACK = 15; // 15 days - if user hasn't given feedback
const DAYS_AFTER_DISMISS = 7; // Wait 7 days after dismiss before asking again
const MAX_DISMISS_COUNT = 3; // After 3 dismisses, wait longer
const DAYS_AFTER_MAX_DISMISS = 30; // Wait 30 days after max dismisses

export const shouldAskFeedback = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.json({ shouldAsk: false, reason: "not_authenticated" });
    }

    // Get or create prompt status
    let status = await FeedbackPromptStatus.findOne({ user: userId });

    if (!status) {
      // New user - create status and allow prompt after some activity
      status = await FeedbackPromptStatus.create({
        user: userId,
        totalFeedbackCount: 0,
        dismissCount: 0,
        promptCount: 0,
        optedOut: false,
      });

      // Don't prompt brand new users immediately
      return res.json({
        shouldAsk: false,
        reason: "new_user",
        nextCheckAfter: DAYS_AFTER_NO_FEEDBACK,
      });
    }

    // Check if user opted out
    if (status.optedOut) {
      return res.json({ shouldAsk: false, reason: "opted_out" });
    }

    const now = new Date();

    // Check dismiss cooldown
    if (status.lastDismissDate) {
      const daysSinceDismiss = Math.floor(
        (now.getTime() - status.lastDismissDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // If dismissed too many times, use longer cooldown
      const dismissCooldown =
        status.dismissCount >= MAX_DISMISS_COUNT
          ? DAYS_AFTER_MAX_DISMISS
          : DAYS_AFTER_DISMISS;

      if (daysSinceDismiss < dismissCooldown) {
        return res.json({
          shouldAsk: false,
          reason: "dismiss_cooldown",
          daysRemaining: dismissCooldown - daysSinceDismiss,
        });
      }
    }

    // Check last feedback date
    if (status.lastFeedbackDate) {
      const daysSinceFeedback = Math.floor(
        (now.getTime() - status.lastFeedbackDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (daysSinceFeedback < DAYS_AFTER_FEEDBACK) {
        return res.json({
          shouldAsk: false,
          reason: "recent_feedback",
          daysRemaining: DAYS_AFTER_FEEDBACK - daysSinceFeedback,
        });
      }
    } else {
      // No feedback given yet - check if enough time since last prompt
      if (status.lastPromptDate) {
        const daysSincePrompt = Math.floor(
          (now.getTime() - status.lastPromptDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysSincePrompt < DAYS_AFTER_NO_FEEDBACK) {
          return res.json({
            shouldAsk: false,
            reason: "recent_prompt",
            daysRemaining: DAYS_AFTER_NO_FEEDBACK - daysSincePrompt,
          });
        }
      }
    }

    // Random factor - don't ask every single time (30% chance)
    const randomChance = Math.random();
    if (randomChance > 0.3) {
      return res.json({
        shouldAsk: false,
        reason: "random_skip",
        // This helps prevent asking on every page load
      });
    }

    // Update prompt tracking
    await FeedbackPromptStatus.updateOne(
      { user: userId },
      {
        $set: { lastPromptDate: now },
        $inc: { promptCount: 1 },
      }
    );

    res.json({
      shouldAsk: true,
      feedbackCount: status.totalFeedbackCount,
      // Personalize the ask based on history
      isFirstTime: status.totalFeedbackCount === 0,
    });
  } catch (error) {
    console.error("Error checking feedback status:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { rating, comment, type, source, metadata } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Create feedback
    const feedback = await Feedback.create({
      user: userId,
      rating,
      comment: comment?.trim().slice(0, 2000),
      type: type || "general",
      source: source || "modal",
      metadata: {
        page: metadata?.page,
        userAgent: req.headers["user-agent"],
        device: metadata?.device,
        orderId: metadata?.orderId,
        productId: metadata?.productId,
        sessionDuration: metadata?.sessionDuration,
      },
    });

    // Update prompt status
    await FeedbackPromptStatus.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          lastFeedbackDate: new Date(),
          dismissCount: 0, // Reset dismiss count after feedback
        },
        $inc: { totalFeedbackCount: 1 },
      },
      { upsert: true }
    );

    res.status(201).json({
      success: true,
      message: "Thank you for your feedback!",
      feedback: {
        _id: feedback._id,
        rating: feedback.rating,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const dismissFeedback = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { reason } = req.body; // Optional: 'later', 'not_now', 'dont_ask'

    const updateData: any = {
      lastDismissDate: new Date(),
      $inc: { dismissCount: 1 },
    };

    // If user says "don't ask again", opt them out
    if (reason === "dont_ask") {
      updateData.optedOut = true;
      updateData.optedOutAt = new Date();
    }

    await FeedbackPromptStatus.findOneAndUpdate({ user: userId }, updateData, {
      upsert: true,
    });

    res.json({
      success: true,
      message:
        reason === "dont_ask"
          ? "You won't be asked for feedback again"
          : "We'll ask you later",
    });
  } catch (error) {
    console.error("Error dismissing feedback:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getUserFeedback = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const feedback = await Feedback.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("rating comment type createdAt metadata");

    const status = await FeedbackPromptStatus.findOne({ user: userId }).select(
      "totalFeedbackCount lastFeedbackDate optedOut"
    );

    res.json({
      feedback,
      stats: {
        totalCount: status?.totalFeedbackCount || 0,
        lastFeedbackDate: status?.lastFeedbackDate,
        optedOut: status?.optedOut || false,
      },
    });
  } catch (error) {
    console.error("Error getting user feedback:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const optInFeedback = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    await FeedbackPromptStatus.findOneAndUpdate(
      { user: userId },
      {
        optedOut: false,
        $unset: { optedOutAt: 1 },
        dismissCount: 0,
      },
      { upsert: true }
    );

    res.json({ success: true, message: "You'll now receive feedback prompts" });
  } catch (error) {
    console.error("Error opting in feedback:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getAllFeedback = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      rating,
      type,
      isRead,
    } = req.query;

    const filter: any = {};
    if (rating) filter.rating = Number(rating);
    if (type) filter.type = type;
    if (isRead !== undefined) filter.isRead = isRead === "true";

    const skip = (Number(page) - 1) * Number(limit);

    const [feedback, total] = await Promise.all([
      Feedback.find(filter)
        .populate("user", "name email role businessName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Feedback.countDocuments(filter),
    ]);

    // Get aggregate stats
    const stats = await Feedback.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalCount: { $sum: 1 },
          ratingDistribution: {
            $push: "$rating",
          },
        },
      },
    ]);

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats[0]?.ratingDistribution) {
      stats[0].ratingDistribution.forEach((r: number) => {
        ratingCounts[r as keyof typeof ratingCounts]++;
      });
    }

    res.json({
      feedback,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
      stats: {
        averageRating: stats[0]?.averageRating?.toFixed(1) || 0,
        totalCount: stats[0]?.totalCount || 0,
        ratingDistribution: ratingCounts,
      },
    });
  } catch (error) {
    console.error("Error getting all feedback:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const markFeedbackRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking feedback read:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Seller-specific feedback submission with rate limiting
export const submitSellerFeedback = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Verify user is a seller
    const seller = await User.findById(userId);
    if (!seller || seller.role !== 'seller') {
      return res.status(403).json({ error: "Only sellers can submit feedback here" });
    }

    const { rating, comment } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Validate comment (required, max 1000 chars)
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: "Feedback message is required" });
    }

    const sanitizedComment = comment.trim().slice(0, 1000);

    // Rate limiting: Check if seller submitted feedback today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const recentFeedback = await Feedback.findOne({
      user: userId,
      type: 'general',
      source: 'modal',
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    if (recentFeedback) {
      return res.status(429).json({
        error: "You can only submit feedback once per day. Please try again tomorrow.",
      });
    }

    // Create feedback
    const feedback = await Feedback.create({
      user: userId,
      rating,
      comment: sanitizedComment,
      type: 'general' as FeedbackType,
      source: 'modal' as FeedbackSource,
      metadata: {
        page: 'seller-panel',
        userAgent: req.headers["user-agent"],
        storeId: seller._id.toString(), // Store seller ID as storeId in metadata
      },
    });

    // Update prompt status (optional, for tracking)
    await FeedbackPromptStatus.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          lastFeedbackDate: new Date(),
        },
        $inc: { totalFeedbackCount: 1 },
      },
      { upsert: true }
    );

    res.status(201).json({
      success: true,
      message: "Thank you for your feedback!",
    });
  } catch (error) {
    console.error("Error submitting seller feedback:", error);
    res.status(500).json({ error: "Server error" });
  }
};
