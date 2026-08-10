import { getProductSizeChart } from "@/api/sizeCharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Ruler } from "lucide-react";
import React from "react";

interface SizeChartModalProps {
  productId: string;
  isOpen: boolean;
  onClose: () => void;
  selectedSize?: string | null;
}

const SizeChartModal: React.FC<SizeChartModalProps> = ({
  productId,
  isOpen,
  onClose,
  selectedSize,
}) => {
  const { data: sizeChartResponse, isLoading } = useQuery({
    queryKey: ["sizeChart", productId],
    queryFn: () => getProductSizeChart(productId),
    enabled: isOpen && !!productId,
  });

  const sizeChart = sizeChartResponse?.data;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="w-5 h-5" />
            {sizeChart?.title || "Size Chart"}
          </DialogTitle>
          {sizeChart?.description && (
            <p className="text-sm text-gray-500 mt-1">
              {sizeChart.description}
            </p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : !sizeChart ? (
          <div className="text-center py-12 text-gray-500">
            Size chart not available for this product
          </div>
        ) : (
          <div className="space-y-6">
            {/* Size Chart Image (if available) */}
            {sizeChart.image && (
              <div className="rounded-lg overflow-hidden border bg-gray-50 flex items-center justify-center">
                <img
                  src={sizeChart.image}
                  alt={sizeChart.title}
                  className="max-w-full max-h-[600px] w-auto h-auto object-contain"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "600px",
                    width: "auto",
                    height: "auto",
                  }}
                />
              </div>
            )}

            {/* Size Chart Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">
                      Size
                    </th>
                    {sizeChart.measurements.map((measurement) => (
                      <th
                        key={measurement.name}
                        className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900 capitalize"
                      >
                        {measurement.name} ({measurement.unit})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sizeChart.rows.map((row, rowIndex) => {
                    const isSelected = selectedSize === row.size;

                    return (
                      <tr
                        key={rowIndex}
                        className={cn(
                          "hover:bg-gray-50 transition-colors",
                          isSelected && "bg-blue-50 border-2 border-blue-500"
                        )}
                      >
                        <td className="border border-gray-300 px-4 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {row.size}
                            {isSelected && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                                Selected
                              </span>
                            )}
                          </div>
                        </td>
                        {sizeChart.measurements.map((measurement) => {
                          const rowMeasurement = row.measurements.find(
                            (m) => m.name === measurement.name
                          );
                          return (
                            <td
                              key={measurement.name}
                              className="border border-gray-300 px-4 py-3 text-center text-gray-700"
                            >
                              {rowMeasurement?.value || "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Measurement Type Info */}
            <div className="text-xs text-gray-500">
              <p>
                Measurement standard:{" "}
                <span className="font-medium">{sizeChart.measurementType}</span>
              </p>
              {sizeChart.description && (
                <p className="mt-1">{sizeChart.description}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SizeChartModal;
