import { useShouldAskFeedback } from "@/api/feedback";
import { useAuthStore } from "@/store/authStore";
import { useCallback, useEffect, useRef, useState } from "react";

// Local storage keys
const STORAGE_KEYS = {
  LAST_DISMISS: "feedback_last_dismiss",
  SESSION_SHOWN: "feedback_session_shown",
  PAGE_VIEWS: "feedback_page_views",
  LAST_CHECK: "feedback_last_check",
};

// Configuration
const CONFIG = {
  MIN_PAGE_VIEWS: 5, // Minimum pages viewed before asking
  MIN_SESSION_TIME: 60, // Minimum seconds in session before asking
  CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes between API checks
  DISMISS_COOLDOWN_HOURS: 24, // Hours to wait after local dismiss
  TRIGGER_EVENTS: [
    "after_purchase",
    "after_login",
    "session_active",
    "route_change",
  ] as const,
};

type TriggerEvent = (typeof CONFIG.TRIGGER_EVENTS)[number];

interface UseFeedbackOptions {
  enabled?: boolean;
}

interface UseFeedbackReturn {
  isOpen: boolean;
  openFeedback: () => void;
  closeFeedback: () => void;
  triggerFeedback: (event: TriggerEvent) => void;
  shouldShowFeedback: boolean;
  isFirstTime: boolean;
}

export const useFeedback = (
  options: UseFeedbackOptions = {}
): UseFeedbackReturn => {
  const { enabled = true } = options;
  const { isAuthenticated } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const sessionStartTime = useRef(Date.now());
  const hasTriggeredThisSession = useRef(false);

  // Only check API if user is authenticated and we haven't shown this session
  const shouldCheckApi =
    enabled && isAuthenticated && !hasTriggeredThisSession.current && !isOpen;

  const { data: feedbackStatus } = useShouldAskFeedback(shouldCheckApi);

  // Track page views in session storage
  useEffect(() => {
    const views = parseInt(
      sessionStorage.getItem(STORAGE_KEYS.PAGE_VIEWS) || "0",
      10
    );
    sessionStorage.setItem(STORAGE_KEYS.PAGE_VIEWS, String(views + 1));
  }, []);

  // Check local dismiss cooldown
  const isLocallyDismissed = useCallback(() => {
    const lastDismiss = localStorage.getItem(STORAGE_KEYS.LAST_DISMISS);
    if (!lastDismiss) return false;

    const dismissTime = parseInt(lastDismiss, 10);
    const hoursSinceDismiss = (Date.now() - dismissTime) / (1000 * 60 * 60);
    return hoursSinceDismiss < CONFIG.DISMISS_COOLDOWN_HOURS;
  }, []);

  // Check if we've already shown feedback this session
  const hasShownThisSession = useCallback(() => {
    return sessionStorage.getItem(STORAGE_KEYS.SESSION_SHOWN) === "true";
  }, []);

  // Calculate if conditions are met to show feedback
  const shouldShowFeedback = useCallback(() => {
    // Must be authenticated
    if (!isAuthenticated) return false;

    // Don't show if already shown this session
    if (hasShownThisSession()) return false;

    // Check local dismiss cooldown
    if (isLocallyDismissed()) return false;

    // Check minimum page views
    const pageViews = parseInt(
      sessionStorage.getItem(STORAGE_KEYS.PAGE_VIEWS) || "0",
      10
    );
    if (pageViews < CONFIG.MIN_PAGE_VIEWS) return false;

    // Check minimum session time
    const sessionSeconds = (Date.now() - sessionStartTime.current) / 1000;
    if (sessionSeconds < CONFIG.MIN_SESSION_TIME) return false;

    // Check API response
    if (!feedbackStatus?.shouldAsk) return false;

    return true;
  }, [
    isAuthenticated,
    hasShownThisSession,
    isLocallyDismissed,
    feedbackStatus,
  ]);

  // Trigger feedback based on event
  const triggerFeedback = useCallback(
    (event: TriggerEvent) => {
      if (!enabled || hasTriggeredThisSession.current) return;

      // After purchase should ALWAYS show (if authenticated and not already shown)
      // This is the best moment to ask for feedback
      if (event === "after_purchase") {
        if (isAuthenticated && !hasShownThisSession()) {
          setIsFirstTime(feedbackStatus?.isFirstTime ?? true);
          setIsOpen(true);
          hasTriggeredThisSession.current = true;
          sessionStorage.setItem(STORAGE_KEYS.SESSION_SHOWN, "true");
        }
        return;
      }

      // Other events use probability + full conditions
      const eventWeights: Record<TriggerEvent, number> = {
        after_purchase: 0.8, // High chance after purchase
        after_login: 0.2, // Low chance on login
        session_active: 0.1, // Very low for passive triggers
        route_change: 0.05, // Minimal for route changes
      };

      const shouldTrigger = Math.random() < (eventWeights[event] || 0.1);

      if (shouldTrigger && shouldShowFeedback()) {
        setIsFirstTime(feedbackStatus?.isFirstTime ?? false);
        setIsOpen(true);
        hasTriggeredThisSession.current = true;
        sessionStorage.setItem(STORAGE_KEYS.SESSION_SHOWN, "true");
      }
    },
    [
      enabled,
      shouldShowFeedback,
      feedbackStatus,
      isAuthenticated,
      hasShownThisSession,
    ]
  );

  // Open feedback manually
  const openFeedback = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Close feedback
  const closeFeedback = useCallback(() => {
    setIsOpen(false);
    // Set local dismiss timestamp
    localStorage.setItem(STORAGE_KEYS.LAST_DISMISS, String(Date.now()));
    hasTriggeredThisSession.current = true;
    sessionStorage.setItem(STORAGE_KEYS.SESSION_SHOWN, "true");
  }, []);

  // Auto-trigger after some activity
  useEffect(() => {
    if (!enabled || !isAuthenticated || hasTriggeredThisSession.current) return;

    // Check after 2 minutes of session
    const timer = setTimeout(() => {
      triggerFeedback("session_active");
    }, 2 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [enabled, isAuthenticated, triggerFeedback]);

  return {
    isOpen,
    openFeedback,
    closeFeedback,
    triggerFeedback,
    shouldShowFeedback: shouldShowFeedback(),
    isFirstTime,
  };
};

export default useFeedback;
