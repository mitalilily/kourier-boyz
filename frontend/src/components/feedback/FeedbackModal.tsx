import { useDismissFeedback, useSubmitFeedback } from "@/api/feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  MessageSquare,
  Send,
  Star,
  ThumbsUp,
} from "lucide-react";
import { useCallback, useState } from "react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFirstTime?: boolean;
}

const RATING_LABELS = [
  { rating: 1, label: "Poor", color: "text-red-500" },
  { rating: 2, label: "Fair", color: "text-orange-500" },
  { rating: 3, label: "Good", color: "text-amber-500" },
  { rating: 4, label: "Great", color: "text-emerald-500" },
  { rating: 5, label: "Excellent", color: "text-blue-600" },
];

const QUICK_FEEDBACK_OPTIONS = [
  { id: "easy", label: "Easy to use" },
  { id: "fast", label: "Fast delivery" },
  { id: "quality", label: "Great products" },
  { id: "support", label: "Helpful support" },
  { id: "prices", label: "Fair prices" },
  { id: "variety", label: "Good variety" },
];

export const FeedbackModal = ({
  isOpen,
  onClose,
  isFirstTime = false,
}: FeedbackModalProps) => {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [step, setStep] = useState<"rating" | "details" | "success">("rating");

  const submitMutation = useSubmitFeedback();
  const dismissMutation = useDismissFeedback();

  const handleRatingClick = (value: number) => {
    setRating(value);
    setTimeout(() => setStep("details"), 400);
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async () => {
    // Validate comment minimum length
    if (comment.trim() && comment.trim().length < 10) {
      return; // Don't submit if comment is less than 10 characters
    }

    const tagLabels = selectedTags
      .map((id) => QUICK_FEEDBACK_OPTIONS.find((o) => o.id === id)?.label)
      .filter(Boolean);

    const fullComment = [
      tagLabels.length > 0 ? `What I liked: ${tagLabels.join(", ")}` : "",
      comment,
    ]
      .filter(Boolean)
      .join("\n\n");

    await submitMutation.mutateAsync({
      rating,
      comment: fullComment || undefined,
      type: "general",
      source: "modal",
      metadata: {
        page: window.location.pathname,
        device: window.innerWidth < 768 ? "mobile" : "desktop",
      },
    });

    setStep("success");
  };

  const handleClose = useCallback(() => {
    if (step !== "success") {
      dismissMutation.mutate("later");
    }
    onClose();
    setTimeout(() => {
      setRating(0);
      setComment("");
      setSelectedTags([]);
      setStep("rating");
    }, 300);
  }, [step, dismissMutation, onClose]);

  const handleDontAskAgain = () => {
    dismissMutation.mutate("dont_ask");
    onClose();
  };

  const currentRatingInfo = RATING_LABELS.find(
    (r) => r.rating === (hoveredRating || rating)
  );

  const displayRating = hoveredRating || rating;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[420px] overflow-hidden border border-gray-200 bg-white p-0 shadow-xl sm:rounded-xl">
        <div className="relative">
          {/* Header gradient bar */}

          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === "rating" && (
                <motion.div
                  key="rating"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <DialogHeader className="space-y-2 text-center">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, duration: 0.3 }}
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50"
                    >
                      <ThumbsUp className="h-7 w-7 text-blue-600" />
                    </motion.div>
                    <DialogTitle className="text-xl font-semibold text-gray-900 text-center">
                      {isFirstTime
                        ? "How's your experience?"
                        : "We'd love your feedback!"}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-500 text-center">
                      {isFirstTime
                        ? "Help us improve by sharing your thoughts"
                        : "Your opinion helps us serve you better"}
                    </DialogDescription>
                  </DialogHeader>

                  {/* Star Rating */}
                  <div className="space-y-3">
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((value, index) => (
                        <motion.button
                          key={value}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: 0.15 + index * 0.05,
                            duration: 0.3,
                          }}
                          onMouseEnter={() => setHoveredRating(value)}
                          onMouseLeave={() => setHoveredRating(0)}
                          onClick={() => handleRatingClick(value)}
                          className="group relative p-1.5 focus:outline-none"
                        >
                          <motion.div
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 17,
                            }}
                          >
                            <Star
                              className={cn(
                                "h-10 w-10 transition-colors duration-150",
                                value <= displayRating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-gray-200 group-hover:text-amber-200"
                              )}
                              strokeWidth={1.5}
                            />
                          </motion.div>
                        </motion.button>
                      ))}
                    </div>

                    {/* Rating Label */}
                    <div className="h-6 flex items-center justify-center">
                      <AnimatePresence mode="wait">
                        {currentRatingInfo && (
                          <motion.span
                            key={currentRatingInfo.rating}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.15 }}
                            className={cn(
                              "text-sm font-medium",
                              currentRatingInfo.color
                            )}
                          >
                            {currentRatingInfo.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Skip option */}
                  <div className="flex justify-center">
                    <button
                      onClick={handleClose}
                      className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Maybe later
                    </button>
                  </div>
                </motion.div>
              )}

              {step === "details" && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <DialogHeader className="space-y-3 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          className={cn(
                            "h-5 w-5",
                            value <= rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-200"
                          )}
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                    <DialogTitle className="text-lg font-semibold text-gray-900 text-center">
                      {rating >= 4
                        ? "Awesome! What did you like?"
                        : rating >= 3
                        ? "Thanks! What could be better?"
                        : "Sorry to hear that. How can we improve?"}
                    </DialogTitle>
                  </DialogHeader>

                  {/* Quick feedback tags */}
                  {rating >= 3 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 text-center">
                        What did you like?
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {QUICK_FEEDBACK_OPTIONS.map((option) => (
                          <motion.button
                            key={option.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleTagToggle(option.id)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                              selectedTags.includes(option.id)
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/50"
                            )}
                          >
                            {option.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comment textarea */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Additional comments (optional)</span>
                    </div>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={
                        rating >= 4
                          ? "Tell us what made your experience great..."
                          : "Tell us how we can improve..."
                      }
                      className="min-h-[90px] resize-none rounded-xl border-gray-200 bg-gray-50/50 text-sm focus:border-blue-300 focus:ring-blue-200 placeholder:text-gray-400"
                      maxLength={500}
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>
                        {comment.trim() &&
                        comment.trim().length < 10 &&
                        comment.trim().length > 0
                          ? `Minimum 10 characters required (${
                              comment.trim().length
                            }/10)`
                          : comment.trim().length >= 10
                          ? "✓ Valid length"
                          : ""}
                      </span>
                      <span>{comment.length}/500</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep("rating")}
                      className="flex-1 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={
                        submitMutation.isPending ||
                        (comment.trim().length > 0 &&
                          comment.trim().length < 10)
                      }
                      className="text-white flex-1 rounded-xl bg-black hover:bg-gray-800"
                    >
                      {submitMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Submit
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5 py-4 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                      delay: 0.1,
                    }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50"
                  >
                    <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                  </motion.div>

                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold text-gray-900">
                      Thank you!
                    </h3>
                    <p className="text-sm text-gray-500">
                      Your feedback helps us create a better experience.
                    </p>
                  </div>

                  <Button
                    onClick={handleClose}
                    className="text-white rounded-xl bg-black px-8 hover:bg-gray-800"
                  >
                    Continue Shopping
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Don't ask again link */}
            {step !== "success" && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleDontAskAgain}
                  className="text-xs text-gray-400 hover:text-gray-500 transition-colors"
                >
                  Don't ask me again
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackModal;
