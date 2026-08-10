import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddressForm } from "./AddressForm";
import type { Address, AddressFormData } from "@/types/address";

interface AddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: Address | null;
  isNewAddress?: boolean;
  onSubmit: (data: AddressFormData, shouldSave: boolean) => void | Promise<void>;
  isLoading?: boolean;
}

export const AddressDialog = ({
  open,
  onOpenChange,
  address,
  isNewAddress = false,
  onSubmit,
  isLoading = false,
}: AddressDialogProps) => {
  const handleSubmit = async (data: AddressFormData, shouldSave: boolean) => {
    await onSubmit(data, shouldSave);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {address ? "Edit Address" : "Add New Address"}
          </DialogTitle>
          <DialogDescription>
            {address
              ? "Update your address details below"
              : "Fill in the details to add a new delivery address"}
          </DialogDescription>
        </DialogHeader>
        <AddressForm
          defaultValues={
            address
              ? {
                  fullName: address.fullName,
                  phone: address.phone,
                  addressLine1: address.addressLine1,
                  addressLine2: address.addressLine2,
                  city: address.city,
                  state: address.state,
                  postalCode: address.postalCode,
                  country: address.country,
                  isDefault: address.isDefault,
                  addressType: address.addressType,
                  landmark: address.landmark,
                }
              : undefined
          }
          onSubmit={handleSubmit}
          isLoading={isLoading}
          submitLabel={address ? "Update Address" : "Enter Address"}
          onCancel={handleCancel}
          isNewAddress={isNewAddress}
        />
      </DialogContent>
    </Dialog>
  );
};
