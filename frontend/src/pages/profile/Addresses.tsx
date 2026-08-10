import {
  useCreateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
  useUpdateAddress,
  useAddresses,
} from "@/api/addresses";
import { AddressCard } from "@/components/addresses/AddressCard";
import { AddressDialog } from "@/components/addresses/AddressDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Address, AddressFormData } from "@/types/address";
import { MapPin, Plus } from "lucide-react";
import { useState } from "react";

const ProfileAddress = () => {
  const { data: addressesData, isLoading } = useAddresses();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();
  const setDefaultAddress = useSetDefaultAddress();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(
    null
  );
  const [settingDefaultAddressId, setSettingDefaultAddressId] = useState<
    string | null
  >(null);

  const addresses = addressesData?.addresses || [];

  const handleAddNew = () => {
    setEditingAddress(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (data: AddressFormData, shouldSave: boolean) => {
    // In profile page, always save to DB
    if (editingAddress) {
      await updateAddress.mutateAsync({
        id: editingAddress._id,
        data,
      });
    } else {
      await createAddress.mutateAsync(data);
    }
    setIsDialogOpen(false);
    setEditingAddress(null);
  };

  const handleDelete = async (addressId: string) => {
    if (window.confirm("Are you sure you want to delete this address?")) {
      setDeletingAddressId(addressId);
      try {
        await deleteAddress.mutateAsync(addressId);
      } finally {
        setDeletingAddressId(null);
      }
    }
  };

  const handleSetDefault = async (addressId: string) => {
    setSettingDefaultAddressId(addressId);
    try {
      await setDefaultAddress.mutateAsync(addressId);
    } finally {
      setSettingDefaultAddressId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Saved Addresses</CardTitle>
          <CardDescription>Manage your delivery addresses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Saved Addresses</CardTitle>
              <CardDescription>Manage your delivery addresses</CardDescription>
            </div>
            <Button variant="primary" onClick={handleAddNew}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Address
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {addresses.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Saved Addresses
              </h3>
              <p className="text-gray-600 mb-6">
                Add your delivery addresses for faster checkout
              </p>
              <Button variant="primary" onClick={handleAddNew}>
                <MapPin className="w-4 h-4 mr-2" />
                Add New Address
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((address) => (
                <AddressCard
                  key={address._id}
                  address={address}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSetDefault={handleSetDefault}
                  isDeleting={deletingAddressId === address._id}
                  isSettingDefault={settingDefaultAddressId === address._id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddressDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        address={editingAddress}
        onSubmit={handleSubmit}
        isLoading={createAddress.isPending || updateAddress.isPending}
      />
    </>
  );
};

export default ProfileAddress;
