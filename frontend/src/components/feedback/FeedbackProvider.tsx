import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import useFeedback from "@/hooks/useFeedback";
import { FeedbackContext } from "./FeedbackContext";
import FeedbackModal from "./FeedbackModal";

interface FeedbackProviderProps {
  children: ReactNode;
}

export const FeedbackProvider = ({ children }: FeedbackProviderProps) => {
  const location = useLocation();
  const { isOpen, openFeedback, closeFeedback, triggerFeedback, isFirstTime } =
    useFeedback();

  const hasCheckedLoginFlag = useRef(false);

  // Check for just_logged_in flag (set by auth hooks)
  useEffect(() => {
    if (hasCheckedLoginFlag.current) return;

    const justLoggedIn = sessionStorage.getItem("just_logged_in");
    if (justLoggedIn === "true") {
      sessionStorage.removeItem("just_logged_in");
      hasCheckedLoginFlag.current = true;

      // Trigger after a delay to let the user settle in
      const timer = setTimeout(() => {
        triggerFeedback("after_login");
      }, 10000); // 10 seconds after login

      return () => clearTimeout(timer);
    }
  }, [triggerFeedback]);

  // Trigger on route change (with very low probability)
  useEffect(() => {
    // Small delay to not interfere with page load
    const timer = setTimeout(() => {
      triggerFeedback("route_change");
    }, 3000);

    return () => clearTimeout(timer);
  }, [location.pathname, triggerFeedback]);

  return (
    <FeedbackContext.Provider value={{ openFeedback, triggerFeedback }}>
      {children}
      <FeedbackModal
        isOpen={isOpen}
        onClose={closeFeedback}
        isFirstTime={isFirstTime}
      />
    </FeedbackContext.Provider>
  );
};

export default FeedbackProvider;
