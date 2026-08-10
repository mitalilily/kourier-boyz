import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Address } from "@/types/address";
import {
  Edit,
  Home,
  MapPin,
  Trash2,
  Building2,
  Check,
  Building,
} from "lucide-react";

interface AddressCardProps {
  address: Address;
  onEdit: (address: Address) => void;
  onDelete: (addressId: string) => void;
  onSetDefault: (addressId: string) => void;
  isDeleting?: boolean;
  isSettingDefault?: boolean;
  // Selection props for checkout
  isSelected?: boolean;
  onSelect?: (address: Address) => void;
  showSelection?: boolean;
}

export const AddressCard = ({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  isDeleting = false,
  isSettingDefault = false,
  isSelected = false,
  onSelect,
  showSelection = false,
}: AddressCardProps) => {
  const getAddressTypeIcon = () => {
    switch (address.addressType) {
      case "home":
        return <Home className="w-4 h-4" />;
      case "work":
        return <Building className="w-4 h-4" />;
      case "other":
        return <Building2 className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  return (
    <Card
      className={`relative transition-all duration-200 hover:shadow-md h-full flex flex-col ${
        isSelected
          ? "border-2 border-blue bg-blue/5 cursor-pointer"
          : showSelection && onSelect
          ? "border border-gray-200 cursor-pointer hover:border-gray-300"
          : address.isDefault
          ? "border-2 border-blue bg-blue-light/5"
          : "border border-gray-200"
      }`}
      onClick={showSelection && onSelect ? () => onSelect(address) : undefined}
    >
      <CardContent className="p-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 flex-1">
          {/* Left: Icon and Address Info */}
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <div className="p-1.5 bg-blue-light text-white rounded-full shrink-0">
              {getAddressTypeIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm text-gray-900 truncate">
                  {address.fullName}
                </h3>
                {address.isDefault && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-primary text-black rounded-full shrink-0">
                    <Check className="w-3 h-3" /> Default
                  </span>
                )}
              </div>
              <div className="space-y-0.5 text-xs text-gray-600">
                <p className="font-medium truncate">{address.addressLine1}</p>
                {address.addressLine2 && (
                  <p className="truncate">{address.addressLine2}</p>
                )}
                <p className="truncate">
                  {address.city}, {address.state} - {address.postalCode}
                </p>
                <p className="truncate">{address.country}</p>
                {address.landmark && (
                  <p className="text-[10px] text-gray-500 truncate">
                    {address.landmark}
                  </p>
                )}
                <p className="text-[10px] text-gray-500 truncate">
                  {address.phone}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Selection indicator or Action Icons */}
          {showSelection && isSelected ? (
            <div className="shrink-0">
              <div className="w-6 h-6 rounded-full bg-blue flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            </div>
          ) : showSelection ? (
            // Checkout mode: Only show Edit button
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(address);
                }}
                className="h-7 w-7 rounded-full hover:bg-primary/10"
              >
                <Edit className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            // Normal mode: Show all action buttons
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(address);
                }}
                className="h-7 w-7 rounded-full hover:bg-primary/10"
              >
                <Edit className="w-3.5 h-3.5" />
              </Button>
              {!address.isDefault && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDefault(address._id);
                  }}
                  disabled={isSettingDefault}
                  className="h-7 w-7 rounded-full hover:bg-primary/10"
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(address._id);
                }}
                disabled={isDeleting}
                className="h-7 w-7 rounded-full hover:bg-red-50 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
