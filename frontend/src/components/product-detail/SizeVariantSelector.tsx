import React, { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Ruler } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getProductSizeChart } from "@/api/sizeCharts";

import SizeChartModal from "./SizeChartModal";
import { ProductVariant } from "./utils";

interface SizeOption {
  sizeValue: string;
  variant: ProductVariant | null;
  stock: number;
  price: number | undefined;
}

interface SizeVariantSelectorProps {
  variants: ProductVariant[];
  selectedColor: string | null;
  selectedSize: string | null;
  onSizeSelect: (sizeValue: string) => void;
  colorAttributeKey: string | null;
  sizeAttributeKey: string | null;
  productId?: string;
}

const SizeVariantSelector: React.FC<SizeVariantSelectorProps> = ({
  variants,
  selectedColor,
  selectedSize,
  onSizeSelect,
  colorAttributeKey,
  sizeAttributeKey,
  productId,
}) => {
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false);

  // Check if this is actually a "size" attribute (not custom-size, volume, etc.)
  const isActualSizeAttribute = useMemo(() => {
    if (!sizeAttributeKey) return false;
    // Only show for exact "size" attribute (case-insensitive)
    return sizeAttributeKey.toLowerCase() === "size";
  }, [sizeAttributeKey]);

  // Check if size chart exists for this product
  const { data: sizeChartData } = useQuery({
    queryKey: ["sizeChart", productId],
    queryFn: () => getProductSizeChart(productId!),
    enabled: !!productId && isActualSizeAttribute,
    retry: false, // Don't retry if 404 (no size chart)
  });

  const hasSizeChart = !!sizeChartData?.data;
  // Get all unique size values
  const allSizeOptions = useMemo(() => {
    if (!sizeAttributeKey) return [];

    const sizes = new Set<string>();
    variants.forEach((variant) => {
      const sizeValue = variant.attributes?.[sizeAttributeKey];
      if (sizeValue) sizes.add(sizeValue);
    });

    return Array.from(sizes);
  }, [variants, sizeAttributeKey]);

  // Get size options with availability based on selected color
  const sizeOptions = useMemo<SizeOption[]>(() => {
    if (!sizeAttributeKey) return [];

    return allSizeOptions.map((sizeValue) => {
      // Find variant matching the selected color and this size
      const matchingVariant = variants.find((v) => {
        const matchesSize = v.attributes?.[sizeAttributeKey] === sizeValue;
        const matchesColor =
          !colorAttributeKey ||
          !selectedColor ||
          v.attributes?.[colorAttributeKey] === selectedColor;
        return matchesSize && matchesColor;
      });

      return {
        sizeValue,
        variant: matchingVariant || null,
        stock: matchingVariant?.stock ?? 0,
        price: matchingVariant?.price,
      };
    });
  }, [
    variants,
    allSizeOptions,
    selectedColor,
    colorAttributeKey,
    sizeAttributeKey,
  ]);

  // Don't render if no size attribute exists or no sizes available
  if (!sizeAttributeKey || sizeOptions.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header: Size label with size chart button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 capitalize">{sizeAttributeKey}:</span>
          <span className="font-semibold text-gray-900">
            {selectedSize || "—"}
          </span>
        </div>
        {/* Only show Size Guide button if:
            1. It's actually a "size" attribute (not custom-size, volume, etc.)
            2. A size chart exists for this product */}
        {productId && isActualSizeAttribute && hasSizeChart && (
          <button
            onClick={() => setIsSizeChartOpen(true)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
            aria-label="View size chart"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Size Guide</span>
          </button>
        )}
      </div>

      {/* Size Options */}
      <div className="flex flex-wrap gap-2">
        {sizeOptions.map((option) => {
          const isActive = selectedSize === option.sizeValue;
          const isOutOfStock = option.stock === 0;

          return (
            <button
              key={option.sizeValue}
              onClick={() => !isOutOfStock && onSizeSelect(option.sizeValue)}
              disabled={isOutOfStock}
              className={cn(
                "relative px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all duration-200",
                isActive
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : isOutOfStock
                  ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 cursor-pointer"
              )}
              aria-label={`Select size ${option.sizeValue}`}
            >
              {option.sizeValue}
              {/* Out of stock indicator */}
              {isOutOfStock && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-gray-300 rounded-full flex items-center justify-center">
                  <svg
                    className="w-2 h-2 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </span>
              )}
              {/* Active checkmark */}
              {isActive && !isOutOfStock && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center shadow-sm">
                  <svg
                    className="w-2.5 h-2.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Size Chart Modal - Only render if size chart exists */}
      {productId && isActualSizeAttribute && hasSizeChart && (
        <SizeChartModal
          productId={productId}
          isOpen={isSizeChartOpen}
          onClose={() => setIsSizeChartOpen(false)}
          selectedSize={selectedSize}
        />
      )}
    </div>
  );
};

export default SizeVariantSelector;
