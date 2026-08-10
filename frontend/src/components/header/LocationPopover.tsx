import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { Address } from "../../types/address";
import type { AddressLocationPair, HeaderLocation } from "./useHeaderLocation";

interface LocationPopoverProps {
  isLightBg: boolean;
  selectedLocation: HeaderLocation | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  addressesLoading: boolean;
  addressLocationPairs: AddressLocationPair[];
  showAllAddresses: boolean;
  onToggleShowAllAddresses: () => void;
  onSelectAddress: (address: Address) => void;
  onUseCurrentLocation: () => void;
  isDetectingLocation: boolean;
  pinInput: string;
  onPinInputChange: (value: string) => void;
  onManualPinSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  locationError: string | null;
}

export const LocationPopover: React.FC<LocationPopoverProps> = ({
  isLightBg,
  selectedLocation,
  isOpen,
  onOpenChange,
  addressesLoading,
  addressLocationPairs,
  showAllAddresses,
  onToggleShowAllAddresses,
  onSelectAddress,
  onUseCurrentLocation,
  isDetectingLocation,
  pinInput,
  onPinInputChange,
  onManualPinSubmit,
  locationError,
}) => {
  const navigate = useNavigate();
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={`group flex h-11 w-11 items-center justify-center gap-2 overflow-hidden rounded-sm px-0 text-xs font-medium transition-all duration-300 sm:w-[142px] sm:justify-start sm:px-3 xl:w-[154px] ${
            isLightBg
              ? "border border-black/8 bg-white/46 text-gray-900 hover:border-black/14 hover:bg-white/72"
              : "bg-white/10 text-white hover:bg-white/20 border border-white/20 hover:border-white/30 backdrop-blur-sm"
          }`}
        >
          <MapPin 
            size={14} 
            className={`flex-shrink-0 ${!isLightBg ? 'text-primary' : 'text-blue-600'}`}
          />
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            {selectedLocation?.postalCode ? (
              <span className={`text-sm font-bold ${
                !isLightBg ? 'text-white' : 'text-gray-900'
              }`}>
                {selectedLocation.postalCode}
              </span>
            ) : selectedLocation?.label ? (
              <span className={`text-xs font-semibold truncate max-w-[140px] ${
                !isLightBg ? 'text-white' : 'text-gray-900'
              }`}>
                {selectedLocation.label.split("·")[0]?.trim()}
              </span>
            ) : (
              <span className={`text-xs font-medium ${
                !isLightBg ? 'text-white/70' : 'text-gray-500'
              }`}>
                Select location
              </span>
            )}
          </div>
          <span className="hidden truncate text-xs font-semibold sm:inline md:hidden">
            {selectedLocation?.postalCode ?? selectedLocation?.label?.split("·")[0]?.trim() ?? "Location"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={12}
        className="w-[320px] sm:w-[360px] p-0"
      >
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
              Saved addresses
            </p>
            {addressesLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, index) => (
                  <Skeleton key={index} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  Delivery options and speeds may vary for different locations.
                </p>
                {addressLocationPairs.length > 0 ? (
                  <div className="space-y-2">
                    {(showAllAddresses
                      ? addressLocationPairs
                      : addressLocationPairs.slice(0, 3)
                    ).map(({ address, location }) => {
                      const isActive = selectedLocation?.id === location.id;
                      return (
                        <button
                          key={location.id}
                          onClick={() => onSelectAddress(address)}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                            isActive
                              ? "border-gray-900 bg-gray-900/5"
                              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                              {(address.addressType || "home").toUpperCase()}
                            </span>
                            {address.isDefault ? (
                              <span className="text-[10px] font-semibold text-emerald-600">
                                Default
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                            {address.fullName}
                          </p>
                          <p className="text-xs text-gray-500 line-clamp-1">
                            {address.addressLine1}
                            {address.addressLine2
                              ? `, ${address.addressLine2}`
                              : ""}
                            , {address.city},{address.state}{" "}
                            {address.postalCode}
                          </p>
                        </button>
                      );
                    })}
                    {addressLocationPairs.length > 3 && (
                      <button
                        onClick={onToggleShowAllAddresses}
                        className="w-full text-xs font-semibold text-purple-600 hover:text-purple-700"
                      >
                        {showAllAddresses
                          ? "Collapse addresses"
                          : `See all ${addressLocationPairs.length}`}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-500">
                    You have no saved addresses yet. Add one from your{" "}
                    <Link
                      to="/profile/addresses"
                      className="font-semibold text-purple-600 hover:text-purple-700"
                      onClick={() => onOpenChange(false)}
                    >
                      address book
                    </Link>{" "}
                    to personalise delivery estimates.
                  </div>
                )}
                <Button
                  variant="link"
                  onClick={() => navigate("/profile/addresses")}
                  disabled={isDetectingLocation}
                  className="w-full justify-center text-xs rounded-full text-blue m-0 p-0 h-5 underline"
                >
                  {isDetectingLocation
                    ? "Detecting location…"
                    : "Manage Address Book"}
                </Button>
              </>
            )}
          </div>

          <div className="space-y-3 border-t border-gray-200 pt-4">
            <Button
              variant="outline"
              onClick={onUseCurrentLocation}
              disabled={isDetectingLocation}
              className="w-full justify-center rounded-full"
            >
              {isDetectingLocation
                ? "Detecting location…"
                : "Use current location"}
            </Button>
            <form onSubmit={onManualPinSubmit} className="flex gap-2">
              <Input
                value={pinInput}
                onChange={(event) => onPinInputChange(event.target.value)}
                placeholder="Enter PIN / ZIP"
                maxLength={10}
                disabled={isDetectingLocation}
                className="flex-1"
              />
              <Button 
                type="submit" 
                className="rounded-full"
                disabled={isDetectingLocation || !pinInput.trim()}
              >
                {isDetectingLocation ? "Validating..." : "Save"}
              </Button>
            </form>
            {locationError ? (
              <p className="text-xs text-red-500">{locationError}</p>
            ) : null}
          </div>

          <div className="border-t border-gray-200 pt-3">
            <p className="text-xs text-gray-500">
              Currently delivering to:
              <span className="ml-1 font-semibold text-gray-900">
                {selectedLocation?.label ?? "Not set"}
              </span>
            </p>
            <p className="text-xs text-gray-400">{selectedLocation?.detail}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
