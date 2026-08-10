import { ReturnRecord, useCustomerReturnsInfinite } from "@/api/returns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfiniteScrollContainer } from "@/components/ui/InfiniteScrollContainer";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  MessageCircle,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const mapReturnStatusForCustomer = (status?: string): string | null => {
  if (!status) return null;
  const normalized = status.toUpperCase();
  switch (normalized) {
    case "REQUESTED":
      return "Return request submitted";
    case "APPROVED_BY_SELLER":
      return "Seller approved your return";
    case "APPROVED_BY_ADMIN":
      return "Return approved by support team";
    case "REJECTED":
      return "Return request rejected";
    case "REVERSE_PICKUP_CREATED":
      return "Item will be picked up soon";
    case "REVERSE_PICKUP_IN_TRANSIT":
      return "Return package in transit";
    case "REVERSE_PICKUP_COMPLETED":
      return "Return package delivered to seller";
    case "RETURN_RECEIVED_BY_SELLER":
      return "Seller received your return";
    case "REFUND_INITIATED":
      return "Refund initiated";
    case "REFUND_COMPLETED":
      return "Refund completed";
    default:
      return status.replace(/_/g, " ");
  }
};

const getStatusColor = (status: string): string => {
  const normalized = status.toUpperCase();
  if (normalized.includes("REJECTED")) {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (
    normalized.includes("COMPLETED") ||
    normalized.includes("REFUND_COMPLETED")
  ) {
    return "bg-green-100 text-green-800 border-green-200";
  }
  if (normalized.includes("INITIATED") || normalized.includes("APPROVED")) {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  return "bg-yellow-100 text-yellow-800 border-yellow-200";
};

const getStatusIcon = (status: string) => {
  const normalized = status.toUpperCase();
  if (normalized.includes("REJECTED")) {
    return XCircle;
  }
  if (
    normalized.includes("COMPLETED") ||
    normalized.includes("REFUND_COMPLETED")
  ) {
    return CheckCircle2;
  }
  if (normalized.includes("PICKUP") || normalized.includes("TRANSIT")) {
    return Truck;
  }
  return Clock;
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString: string | undefined | null): string => {
  if (!dateString) {
    return "N/A";
  }
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return "N/A";
    }
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
};

const Returns: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useCustomerReturnsInfinite({ limit: 20 });
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(
    null
  );
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const returns = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data || []);
  }, [data]);

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-0 bg-white shadow-sm">
        <CardHeader>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
              >
                <Card className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-64" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="rounded-3xl bg-white shadow-sm">
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-2xl font-bold text-gray-900">Returns & Refunds</CardTitle>
          <CardDescription className="mt-1 text-sm text-slate-500">
            Track the status of your return requests and refunds
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {returns.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <RotateCcw className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            </motion.div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No returns yet</h3>
            <p className="text-gray-600 mb-6">
              You haven't initiated any returns. When you need to return an item, you can do so from
              your order details.
            </p>
            <Link to="/profile/orders">
              <Button>View Orders</Button>
            </Link>
          </motion.div>
        ) : (
          <>

      <InfiniteScrollContainer
        contentClassName="space-y-3"
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage ?? false}
        onLoadMore={fetchNextPage}
        threshold={200}
        useIntersectionObserver={false}
        loadingIndicator={
          <div className="flex items-center justify-center py-4 text-slate-500">
            <span className="text-sm">Loading more returns…</span>
          </div>
        }
        endIndicator={
          <div className="py-4 text-center text-sm text-slate-400">
            You've seen all your returns
          </div>
        }
      >
        {returns.map((returnRecord, index) => {
          const statusLabel = mapReturnStatusForCustomer(returnRecord.status);
          const StatusIcon = getStatusIcon(returnRecord.status);
          const orderId =
            typeof returnRecord.order === "object" && returnRecord.order?._id
              ? returnRecord.order._id
              : typeof returnRecord.order === "string"
              ? returnRecord.order
              : "N/A";

          const animationDelay = Math.min(index * 0.05, 0.3);

          return (
            <motion.div
              key={returnRecord._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: animationDelay,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              whileHover={{ y: -2 }}
              layout
            >
              <Card
                className="group relative cursor-pointer bg-white transition-all duration-300 hover:shadow-lg hover:border-slate-300 rounded-xl border border-gray-200 overflow-hidden"
                onClick={() => setSelectedReturn(returnRecord)}
              >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex items-center gap-3">
                      {returnRecord.images &&
                      returnRecord.images.length > 0 &&
                      !imageErrors.has(returnRecord._id) ? (
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm"
                        >
                          <img
                            src={returnRecord.images[0]}
                            alt="Return item"
                            className="h-full w-full object-cover"
                            onError={() => {
                              setImageErrors((prev: Set<string>) =>
                                new Set(prev).add(returnRecord._id)
                              );
                            }}
                          />
                          {returnRecord.images.length > 1 && (
                            <div className="absolute bottom-0 right-0 bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white rounded-tl-lg">
                              +{returnRecord.images.length - 1}
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 shadow-sm">
                          <RotateCcw className="h-6 w-6 text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-slate-900 mb-1">
                          Return #{returnRecord._id.slice(-8).toUpperCase()}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Order: {orderId.slice(-8).toUpperCase()} •{" "}
                          {formatDate(returnRecord.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="pl-[76px] space-y-1.5">
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        <span className="font-semibold text-slate-700">
                          Reason:
                        </span>{" "}
                        {returnRecord.reason}
                      </p>
                      {returnRecord.refundAmount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          <p className="text-xs font-semibold text-green-600">
                            Refund: ₹
                            {returnRecord.refundAmount.toLocaleString("en-IN")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border shadow-sm",
                        getStatusColor(returnRecord.status)
                      )}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span className="whitespace-nowrap">{statusLabel}</span>
                    </Badge>
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </div>
              </CardContent>
            </Card>
            </motion.div>
          );
        })}
          </InfiniteScrollContainer>
          </>
        )}
      </CardContent>
      </Card>

      {/* Return Details Modal */}
      <Dialog
        open={!!selectedReturn}
        onOpenChange={(open) => !open && setSelectedReturn(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedReturn && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl font-semibold text-slate-900">
                      Return #{selectedReturn._id.slice(-8).toUpperCase()}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 mt-1">
                      Return request details and timeline
                    </DialogDescription>
                  </div>
                  <Badge
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 text-xs font-medium",
                      getStatusColor(selectedReturn.status)
                    )}
                  >
                    {(() => {
                      const StatusIcon = getStatusIcon(selectedReturn.status);
                      return (
                        <>
                          <StatusIcon className="h-3 w-3" />
                          <span className="whitespace-nowrap">
                            {mapReturnStatusForCustomer(selectedReturn.status)}
                          </span>
                        </>
                      );
                    })()}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                      Return Information
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">
                          Return ID
                        </p>
                        <p className="text-sm font-medium text-slate-900">
                          {selectedReturn._id.slice(-8).toUpperCase()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">
                          Order ID
                        </p>
                        <p className="text-sm font-medium text-slate-900">
                          {(() => {
                            const orderId =
                              typeof selectedReturn.order === "object" &&
                              selectedReturn.order?._id
                                ? selectedReturn.order._id
                                : typeof selectedReturn.order === "string"
                                ? selectedReturn.order
                                : "N/A";
                            return orderId.slice(-8).toUpperCase();
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">
                          Created Date
                        </p>
                        <p className="text-sm font-medium text-slate-900">
                          {formatDateTime(selectedReturn.createdAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">
                          Last Updated
                        </p>
                        <p className="text-sm font-medium text-slate-900">
                          {formatDateTime(selectedReturn.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Return Reason */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                      Return Reason
                    </h3>
                    <p className="text-sm text-slate-900">
                      {selectedReturn.reason}
                    </p>
                    {selectedReturn.description && (
                      <p className="text-xs text-slate-600 mt-1.5">
                        {selectedReturn.description}
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Refund Information */}
                  {selectedReturn.refundAmount > 0 && (
                    <>
                      <div>
                        <h3 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                          Refund Details
                        </h3>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-slate-600 mb-1">
                                Refund Amount
                              </p>
                              <p className="text-2xl font-bold text-green-600">
                                ₹
                                {selectedReturn.refundAmount.toLocaleString(
                                  "en-IN"
                                )}
                              </p>
                            </div>
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                          </div>
                          {selectedReturn.reverseCharges &&
                            selectedReturn.reverseCharges > 0 && (
                              <p className="text-xs text-slate-500 mt-2">
                                Reverse charges: ₹
                                {selectedReturn.reverseCharges.toLocaleString(
                                  "en-IN"
                                )}
                              </p>
                            )}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Tracking Information */}
                  {selectedReturn.courierReverseAwb && (
                    <>
                      <div>
                        <h3 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                          Return Tracking
                        </h3>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-slate-600" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">
                                AWB: {selectedReturn.courierReverseAwb}
                              </p>
                              {selectedReturn.courierPartner && (
                                <p className="text-xs text-slate-500 mt-1">
                                  Courier: {selectedReturn.courierPartner}
                                </p>
                              )}
                              {selectedReturn.courierReverseId && (
                                <p className="text-xs text-slate-500">
                                  Tracking ID: {selectedReturn.courierReverseId}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Timeline */}
                  {selectedReturn.timeline &&
                    selectedReturn.timeline.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700 mb-4">
                          Return Timeline
                        </h3>
                        <div className="relative pl-1">
                          {/* Timeline vertical line */}
                          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-linear-to-b from-blue-200 via-slate-200 to-slate-200" />
                          <div className="space-y-4">
                            {selectedReturn.timeline.map((entry, index) => {
                              const isLast =
                                index === selectedReturn.timeline.length - 1;
                              const statusNormalized =
                                entry.status.toUpperCase();
                              const isCompleted =
                                statusNormalized.includes("COMPLETED") ||
                                statusNormalized.includes("REFUND_COMPLETED");
                              const isRejected =
                                statusNormalized.includes("REJECTED");
                              const isApproved =
                                statusNormalized.includes("APPROVED") ||
                                statusNormalized.includes("INITIATED");

                              // Determine dot color based on status
                              let dotColor = "border-slate-300 bg-slate-50";
                              let dotIconColor = "text-slate-400";
                              let dotBg = "bg-white";

                              if (isLast) {
                                if (isCompleted) {
                                  dotColor = "border-green-500 bg-green-50";
                                  dotIconColor = "text-green-600";
                                  dotBg = "bg-green-50";
                                } else if (isRejected) {
                                  dotColor = "border-red-500 bg-red-50";
                                  dotIconColor = "text-red-600";
                                  dotBg = "bg-red-50";
                                } else if (isApproved) {
                                  dotColor = "border-blue-500 bg-blue-50";
                                  dotIconColor = "text-blue-600";
                                  dotBg = "bg-blue-50";
                                } else {
                                  dotColor = "border-yellow-500 bg-yellow-50";
                                  dotIconColor = "text-yellow-600";
                                  dotBg = "bg-yellow-50";
                                }
                              } else if (isCompleted) {
                                dotColor = "border-green-400 bg-green-50";
                                dotIconColor = "text-green-500";
                              } else if (isRejected) {
                                dotColor = "border-red-400 bg-red-50";
                                dotIconColor = "text-red-500";
                              } else if (isApproved) {
                                dotColor = "border-blue-400 bg-blue-50";
                                dotIconColor = "text-blue-500";
                              }

                              const Icon = getStatusIcon(entry.status);

                              return (
                                <div
                                  key={index}
                                  className="relative flex items-start gap-4"
                                >
                                  {/* Timeline dot with pulse effect for current status */}
                                  <div className="relative z-10 shrink-0">
                                    {isLast && (
                                      <div
                                        className={cn(
                                          "absolute inset-0 rounded-full animate-ping opacity-20",
                                          dotBg.replace("bg-", "bg-")
                                        )}
                                        style={{
                                          animationDuration: "2s",
                                        }}
                                      />
                                    )}
                                    <div
                                      className={cn(
                                        "relative flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-sm transition-all",
                                        dotColor
                                      )}
                                    >
                                      <Icon
                                        className={cn("h-4 w-4", dotIconColor)}
                                      />
                                    </div>
                                  </div>
                                  {/* Timeline content */}
                                  <div className="flex-1 pb-1.5 min-w-0">
                                    <div
                                      className={cn(
                                        "rounded-lg border p-3 transition-all",
                                        isLast
                                          ? "border-blue-200 bg-blue-50/50 shadow-sm"
                                          : "border-slate-200 bg-white"
                                      )}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <p
                                            className={cn(
                                              "text-sm font-medium text-slate-900",
                                              isLast && "text-blue-900"
                                            )}
                                          >
                                            {entry.status}
                                          </p>
                                          {entry.message && (
                                            <p
                                              className={cn(
                                                "mt-1 text-xs leading-relaxed",
                                                isLast
                                                  ? "text-blue-700"
                                                  : "text-slate-600"
                                              )}
                                            >
                                              {entry.message}
                                            </p>
                                          )}
                                        </div>
                                        {isLast && (
                                          <Badge
                                            className={cn(
                                              "shrink-0 text-[10px] px-1.5 py-0.5 font-medium",
                                              isCompleted
                                                ? "bg-green-100 text-green-800 border-green-200"
                                                : isRejected
                                                ? "bg-red-100 text-red-800 border-red-200"
                                                : isApproved
                                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                                : "bg-yellow-100 text-yellow-800 border-yellow-200"
                                            )}
                                          >
                                            Current
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                          {formatDateTime(entry.timestamp)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </div>

              <div className="flex justify-between gap-3 mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    const orderId = typeof selectedReturn.order === "object" && selectedReturn.order?._id
                      ? selectedReturn.order._id
                      : typeof selectedReturn.order === "string"
                      ? selectedReturn.order
                      : null;
                    const returnId = selectedReturn._id.slice(-8).toUpperCase();
                    navigate('/help/tickets/new', {
                      state: {
                        category: 'refund',
                        subject: `Return query for ${returnId}`,
                        description: `I have a question regarding this return:\n\nReturn ID: ${selectedReturn._id}\nOrder: ${orderId ? orderId.slice(-8).toUpperCase() : 'N/A'}\nReason: ${selectedReturn.reason}\nRefund Amount: ₹${selectedReturn.refundAmount?.toLocaleString('en-IN') || '0.00'}\nStatus: ${mapReturnStatusForCustomer(selectedReturn.status)}\n\nPlease provide clarification.`,
                        orderId: orderId || undefined,
                      },
                    });
                  }}
                  className="gap-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  Raise Query
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedReturn(null)}
                  >
                    Close
                  </Button>
                  {typeof selectedReturn.order === "object" && selectedReturn.order?._id ? (
                    <Link to={`/profile/orders?orderId=${selectedReturn.order._id}`}>
                      <Button>View Order Details</Button>
                    </Link>
                  ) : (
                    <Link to="/profile/orders">
                      <Button>View Orders</Button>
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Returns;
