import { createContext, useContext } from "react";

export interface FeedbackContextType {
  openFeedback: () => void;
  triggerFeedback: (
    event: "after_purchase" | "after_login" | "session_active" | "route_change"
  ) => void;
}

export const FeedbackContext = createContext<FeedbackContextType | null>(null);

export const useFeedbackContext = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedbackContext must be used within FeedbackProvider");
  }
  return context;
};

