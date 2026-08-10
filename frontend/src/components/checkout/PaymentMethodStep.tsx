import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHODS, type PaymentMethod } from "@/config/checkout.config";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";

export interface CardDetails {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  nameOnCard: string;
}

interface PaymentMethodStepProps {
  selectedPaymentMethod: PaymentMethod | null;
  selectedUPI: string | null;
  onUPISelect: (upiId: string) => void;
  onUPIIdChange?: (upiId: string) => void;
  onPaymentMethodSelect: (method: PaymentMethod) => void;
  cardDetails?: CardDetails;
  onCardDetailsChange?: (details: CardDetails) => void;
  razorpayMethod?: "card" | "upi" | "wallet" | "paylater" | null;
  onRazorpayMethodChange?: (
    method: "card" | "upi" | "wallet" | "paylater"
  ) => void;
}

export const PaymentMethodStep = (props: PaymentMethodStepProps) => {
  const {
    selectedPaymentMethod,
    // selectedUPI,
    // onUPISelect,
    // onUPIIdChange,
    onPaymentMethodSelect,
    cardDetails,
    onCardDetailsChange,
  } = props;
  const [localCardDetails, setLocalCardDetails] = useState<CardDetails>({
    cardNumber: cardDetails?.cardNumber || "",
    expiryDate: cardDetails?.expiryDate || "",
    cvv: cardDetails?.cvv || "",
    nameOnCard: cardDetails?.nameOnCard || "",
  });

  // Auto-select COD if no payment method is selected
  useEffect(() => {
    if (!selectedPaymentMethod) {
      const codMethod = PAYMENT_METHODS.find((m) => m.id === "cod");
      if (codMethod) {
        onPaymentMethodSelect(codMethod);
      }
    }
  }, [selectedPaymentMethod, onPaymentMethodSelect]);

  const handleCardNumberChange = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, "");
    // Format as XXXX XXXX XXXX XXXX
    let formatted = cleaned;
    if (cleaned.length > 0) {
      formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    }
    // Limit to 19 characters (16 digits + 3 spaces)
    if (formatted.length <= 19) {
      const updated = { ...localCardDetails, cardNumber: formatted };
      setLocalCardDetails(updated);
      onCardDetailsChange?.(updated);
    }
  };

  const handleExpiryChange = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, "");
    let formatted = cleaned;
    // Format as MM/YY
    if (cleaned.length >= 2) {
      formatted = cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4);
    }
    // Limit to 5 characters (MM/YY)
    if (formatted.length <= 5) {
      const updated = { ...localCardDetails, expiryDate: formatted };
      setLocalCardDetails(updated);
      onCardDetailsChange?.(updated);
    }
  };

  const handleCVVChange = (value: string) => {
    // Only allow digits, max 3 characters
    if (/^\d*$/.test(value) && value.length <= 3) {
      const updated = { ...localCardDetails, cvv: value };
      setLocalCardDetails(updated);
      onCardDetailsChange?.(updated);
    }
  };

  const handleNameChange = (value: string) => {
    const updated = { ...localCardDetails, nameOnCard: value };
    setLocalCardDetails(updated);
    onCardDetailsChange?.(updated);
  };

  const renderCardForm = () => {
    if (selectedPaymentMethod?.type !== "card") {
      return null;
    }

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 sm:mt-4 space-y-3 sm:space-y-4"
        >
          <Card className="border-2 border-blue/20 bg-blue/5">
            <CardContent className="p-4 sm:p-6">
              <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-blue" />
                Card Details
              </h4>
              <div className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="cardNumber" className="text-xs sm:text-sm">
                    Card Number
                  </Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={localCardDetails.cardNumber}
                    onChange={(e) => handleCardNumberChange(e.target.value)}
                    maxLength={19}
                    className="w-full text-sm sm:text-base h-9 sm:h-10"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="nameOnCard" className="text-xs sm:text-sm">
                    Name on Card
                  </Label>
                  <Input
                    id="nameOnCard"
                    placeholder="John Doe"
                    value={localCardDetails.nameOnCard}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full text-sm sm:text-base h-9 sm:h-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="expiryDate" className="text-xs sm:text-sm">
                      Expiry Date
                    </Label>
                    <Input
                      id="expiryDate"
                      placeholder="MM/YY"
                      value={localCardDetails.expiryDate}
                      onChange={(e) => handleExpiryChange(e.target.value)}
                      maxLength={5}
                      className="w-full text-sm sm:text-base h-9 sm:h-10"
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label htmlFor="cvv" className="text-xs sm:text-sm">
                      CVV
                    </Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      type="password"
                      value={localCardDetails.cvv}
                      onChange={(e) => handleCVVChange(e.target.value)}
                      maxLength={3}
                      className="w-full text-sm sm:text-base h-9 sm:h-10"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[10px] sm:text-xs text-gray-600 pt-2">
                  <div className="flex items-center gap-1">
                    <div className="w-7 h-4 sm:w-8 sm:h-5 border border-gray-300 rounded bg-white flex items-center justify-center">
                      <span className="text-[9px] sm:text-[10px] font-bold text-blue-600">
                        VISA
                      </span>
                    </div>
                    <div className="w-7 h-4 sm:w-8 sm:h-5 border border-gray-300 rounded bg-white flex items-center justify-center">
                      <span className="text-[9px] sm:text-[10px] font-bold text-orange-600">
                        MC
                      </span>
                    </div>
                    <div className="w-7 h-4 sm:w-8 sm:h-5 border border-gray-300 rounded bg-white flex items-center justify-center">
                      <span className="text-[9px] sm:text-[10px] font-bold text-blue-500">
                        RP
                      </span>
                    </div>
                  </div>
                  <span className="leading-relaxed">
                    We accept Visa, Mastercard, and RuPay
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    );
  };

  const renderCODInfo = () => {
    if (selectedPaymentMethod?.type !== "cod") {
      return null;
    }

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-700"
        >
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-emerald-600">
            Cash on delivery
          </p>
          <p className="leading-relaxed">
            Pay in cash when your order is delivered. Our delivery partner will
            collect the amount mentioned in your order summary.
          </p>
          <ul className="list-disc space-y-1 pl-4 sm:pl-5 text-[10px] sm:text-xs text-gray-600 leading-relaxed">
            <li>Have the exact amount ready to ensure a quicker handover.</li>
            <li>
              For safety, we may call you to confirm large COD orders before
              dispatch.
            </li>
            <li>Subject to serviceability at your pincode.</li>
          </ul>
        </motion.div>
      </AnimatePresence>
    );
  };

  const renderOnlinePaymentInfo = () => {
    if (selectedPaymentMethod?.id !== "razorpay") {
      return null;
    }

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-700"
        >
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-blue-600">
            Online Payment
          </p>
          <p className="leading-relaxed">
            Pay securely using UPI, credit/debit cards, or digital wallets. Your
            payment is processed through our secure payment gateway.
          </p>
          <ul className="list-disc space-y-1 pl-4 sm:pl-5 text-[10px] sm:text-xs text-gray-600 leading-relaxed">
            <li>All transactions are encrypted and secure.</li>
            <li>Supports UPI, cards, wallets, and pay later options.</li>
            <li>Instant payment confirmation and order processing.</li>
          </ul>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <Card className="border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm">
      <CardContent className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-1 sm:gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1 sm:space-y-1.5">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-gray-50 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-medium text-gray-600">
              <span className="inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-blue/10 text-[9px] sm:text-[10px] font-semibold text-blue">
                2
              </span>
              Payment
              <span className="h-0.5 w-4 sm:w-6 rounded-full bg-gray-200" />
              Secure checkout
            </div>
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
              Choose how you&apos;d like to pay
            </h3>
            <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">
              All payments are encrypted and processed securely. You can still
              review your order on the next step.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)]">
          <div className="space-y-2 sm:space-y-3">
            <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Payment options
            </p>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((method) => {
                const isSelected = selectedPaymentMethod?.id === method.id;
                const Icon = method.icon;

                return (
                  <motion.button
                    key={method.id}
                    onClick={() =>
                      method.available && onPaymentMethodSelect(method)
                    }
                    disabled={!method.available}
                    className={`group flex w-full items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl border px-2.5 sm:px-3.5 py-2.5 sm:py-3 text-left text-xs sm:text-sm transition-all ${
                      isSelected
                        ? "border-blue bg-blue/5 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    } ${
                      !method.available
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    whileHover={method.available ? { scale: 1.01 } : undefined}
                    whileTap={method.available ? { scale: 0.98 } : undefined}
                    type="button"
                  >
                    <div
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg shrink-0 ${
                        isSelected
                          ? "bg-blue text-white"
                          : "bg-gray-100 text-gray-600 group-hover:bg-gray-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </div>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                          {method.name}
                        </span>
                        {isSelected && (
                          <div className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-blue text-white shrink-0">
                            <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-gray-500 line-clamp-1">
                        {method.description}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4 rounded-lg sm:rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-3 sm:p-3.5 md:p-4">
            {!selectedPaymentMethod && (
              <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">
                Select a payment method on the left to see more details here.
              </p>
            )}

            {renderCODInfo()}
            {renderOnlinePaymentInfo()}
            {renderCardForm()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
