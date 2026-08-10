import { useAddresses, useCreateAddress, useUpdateAddress } from '@/api/addresses'
import { AddressDialog } from '@/components/addresses/AddressDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/store/authStore'
import type { Address, AddressFormData } from '@/types/address'
import { readStoredDeliveryLocation } from '@/utils/deliveryLocationStorage'
import { AnimatePresence, motion } from 'framer-motion'
import { Edit, Info, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

interface AddressSelectionStepProps {
  selectedAddress: Address | null
  onAddressSelect: (address: Address) => void
  deliveryInstructions: string
  onDeliveryInstructionsChange: (instructions: string) => void
}

const getAddressDisplayName = (address: Address): string => {
  // For guest addresses (temporary addresses), show full address
  if (address._id?.startsWith('temp-')) {
    const parts: string[] = []
    if (address.addressLine1) parts.push(address.addressLine1)
    if (address.addressLine2) parts.push(address.addressLine2)
    if (address.city) parts.push(address.city)
    if (address.state) parts.push(address.state)
    if (address.postalCode) parts.push(address.postalCode)

    // If we have address parts, show them; otherwise fallback to type - pincode
    if (parts.length > 0) {
      return parts.join(', ')
    }
  }

  // For saved addresses, show type - pincode format
  const type = address.addressType || 'home'
  const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1)
  return `${typeCapitalized} - ${address.postalCode}`
}

export const AddressSelectionStep = ({
  selectedAddress,
  onAddressSelect,
  deliveryInstructions,
  onDeliveryInstructionsChange,
}: AddressSelectionStepProps) => {
  const { data: addressesData, isLoading } = useAddresses()
  const createAddress = useCreateAddress()
  const updateAddress = useUpdateAddress()
  const { isAuthenticated } = useAuthStore()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [isNewAddress, setIsNewAddress] = useState(false)
  const [showDeliveryInstructions, setShowDeliveryInstructions] = useState(false)

  // For guests, addresses will be empty (useAddresses is disabled)
  // They can still add temporary addresses for checkout
  // After login, include guest address from localStorage if it exists
  const addresses = useMemo(() => {
    const savedAddresses = addressesData?.addresses || []

    // If user just logged in, check for guest address in localStorage
    if (isAuthenticated) {
      try {
        const guestAddressStr = localStorage.getItem('checkout_selected_address')
        if (guestAddressStr) {
          const guestAddress = JSON.parse(guestAddressStr) as Address
          // Check if it's a temporary address (starts with 'temp-')
          if (guestAddress._id?.startsWith('temp-')) {
            // Check if this address is not already in saved addresses
            const isDuplicate = savedAddresses.some(
              (addr) =>
                addr.postalCode === guestAddress.postalCode &&
                addr.addressLine1 === guestAddress.addressLine1 &&
                addr.city === guestAddress.city,
            )
            if (!isDuplicate) {
              // Add guest address to the list so user can see and use it
              return [guestAddress, ...savedAddresses]
            }
          }
        }
      } catch (err) {
        console.warn('Error reading guest address from localStorage:', err)
      }
    }

    return savedAddresses
  }, [addressesData?.addresses, isAuthenticated])

  // Show delivery instructions if there are existing instructions on mount
  useEffect(() => {
    if (deliveryInstructions && deliveryInstructions.trim().length > 0) {
      setShowDeliveryInstructions(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Auto-select address based on guest address, kourier_boyz_selected_location, or default/first address
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddress) {
      // FIRST: Check for guest address in localStorage (for users who just logged in)
      if (isAuthenticated) {
        try {
          const guestAddressStr = localStorage.getItem('checkout_selected_address')
          if (guestAddressStr) {
            const guestAddress = JSON.parse(guestAddressStr) as Address
            // If it's a temporary address, try to find it in the addresses list
            if (guestAddress._id?.startsWith('temp-')) {
              const matchingGuestAddress = addresses.find((addr) => addr._id === guestAddress._id)
              if (matchingGuestAddress) {
                onAddressSelect(matchingGuestAddress)
                return
              }
            } else {
              // If it's a saved address, try to find it by ID
              const matchingAddress = addresses.find((addr) => addr._id === guestAddress._id)
              if (matchingAddress) {
                onAddressSelect(matchingAddress)
                return
              }
            }
          }
        } catch (err) {
          console.warn('Error reading guest address from localStorage:', err)
        }
      }

      // SECOND: Try to find address from kourier_boyz_selected_location
      const location = readStoredDeliveryLocation()
      if (location) {
          // If location source is 'address', use the id to find the address
          if (location.source === 'address' && location.id) {
            const addressFromLocation = addresses.find((addr) => addr._id === location.id)
            if (addressFromLocation) {
              onAddressSelect(addressFromLocation)
              return
            }
          }
          // If location has postalCode, try to match by postal code
          if (location.postalCode) {
            const addressByPostal = addresses.find(
              (addr) => addr.postalCode === location.postalCode,
            )
            if (addressByPostal) {
              onAddressSelect(addressByPostal)
              return
            }
          }
      }

      // Fallback to default address or first address
      const defaultAddress = addresses.find((addr) => addr.isDefault) || addresses[0]
      onAddressSelect(defaultAddress)
    }
  }, [addresses, selectedAddress, onAddressSelect, isAuthenticated])

  const handleAddNew = () => {
    setEditingAddress(null)
    setIsNewAddress(true)
    setIsDialogOpen(true)
  }

  const handleEdit = () => {
    if (selectedAddress) {
      setEditingAddress(selectedAddress)
      setIsNewAddress(false)
      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async (data: AddressFormData, shouldSave: boolean) => {
    if (editingAddress) {
      // Always save when editing (updating existing address)
      await updateAddress.mutateAsync({
        id: editingAddress._id,
        data,
      })
      // Update selected address after edit
      const updatedAddress = {
        ...editingAddress,
        ...data,
      }
      onAddressSelect(updatedAddress as Address)
    } else if (shouldSave) {
      // Only save to DB if checkbox is checked
      const newAddress = await createAddress.mutateAsync(data)
      if (newAddress?.address) {
        onAddressSelect(newAddress.address)
      }
    } else {
      // Use address for checkout without saving to DB
      const tempAddress: Address = {
        _id: `temp-${Date.now()}`,
        user: '',
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      onAddressSelect(tempAddress)
    }
    setIsDialogOpen(false)
    setEditingAddress(null)
    setIsNewAddress(false)
  }

  const handleSelectChange = (addressId: string) => {
    const address = addresses.find((addr) => addr._id === addressId)
    if (address) {
      onAddressSelect(address)
    }
  }

  const handleAddDeliveryInstructions = () => {
    setShowDeliveryInstructions(true)
  }

  const handleCancelDeliveryInstructions = () => {
    onDeliveryInstructionsChange('')
    setShowDeliveryInstructions(false)
  }

  // Get the current location info from selected address or header location
  const currentLocationInfo = useMemo(() => {
    // ALWAYS prioritize selectedAddress (even if it's a temporary guest address)
    if (selectedAddress) {
      return {
        label: getAddressDisplayName(selectedAddress),
        postalCode: selectedAddress.postalCode,
      }
    }

    // Only fallback to localStorage if no address is selected AND user is authenticated
    // For guests, don't show localStorage location - they should add an address
    if (isAuthenticated && typeof window !== 'undefined') {
      // FIRST: Check the account-validated header location.
      const location = readStoredDeliveryLocation()
      if (location?.postalCode) {
            // Extract city/area from label (e.g., "Home · Kharar" or "Kharar, Punjab")
            let displayLabel = location.label || ''
            // If label contains "·", take the part after it (city name)
            if (displayLabel.includes('·')) {
              displayLabel = displayLabel.split('·')[1]?.trim() || displayLabel
            }
            // If we have a detail, try to extract city from there (e.g., "Kharar, Kharar Tahsil, ...")
            if (location.detail) {
              // Try to extract city name from detail string - it's usually the first part
              const parts = location.detail.split(',')
              if (parts.length > 0 && parts[0].trim()) {
                displayLabel = parts[0].trim()
              }
            }
        return {
          label: displayLabel
            ? `${displayLabel} - ${location.postalCode}`
            : `Other - ${location.postalCode}`,
          postalCode: location.postalCode,
        }
      }
    }
    // For guests without selected address, return null (don't show localStorage location)
    return null
  }, [selectedAddress, isAuthenticated])

  // Only show loading for authenticated users (guests won't have addresses loading)
  if (isLoading && isAuthenticated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Delivering to</h3>
          {currentLocationInfo && (
            <p className="text-sm text-gray-600 mt-0.5">{currentLocationInfo.label}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="flex-1 w-full">
          {addresses.length > 0 ? (
            <Select value={selectedAddress?._id || ''} onValueChange={handleSelectChange}>
              <SelectTrigger className="w-full text-sm sm:text-base h-9 sm:h-10">
                <SelectValue placeholder="Select an address">
                  {selectedAddress ? getAddressDisplayName(selectedAddress) : 'Select an address'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {addresses.map((address) => (
                  <SelectItem key={address._id} value={address._id}>
                    {getAddressDisplayName(address)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="px-3 py-2 text-xs sm:text-sm text-gray-500 border border-gray-200 rounded-xl sm:rounded-2xl bg-gray-50">
              {isAuthenticated
                ? 'No saved addresses. Click "New Address" to add one.'
                : 'Add a delivery address to continue. Click "New Address" to enter your address.'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {selectedAddress && addresses.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="shrink-0 flex-1 sm:flex-initial text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-3"
            >
              <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Edit Address</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleAddNew}
            className="shrink-0 flex-1 sm:flex-initial text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-3"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">New Address</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Add Delivery Instructions Button */}
      {!showDeliveryInstructions && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddDeliveryInstructions}
            className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            Add Delivery Instructions
          </Button>
        </motion.div>
      )}

      {/* Delivery Instructions */}
      <AnimatePresence>
        {showDeliveryInstructions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="space-y-2 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="delivery-instructions"
                className="text-xs sm:text-sm font-medium text-gray-700"
              >
                Delivery Instructions (Optional)
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelDeliveryInstructions}
                className="h-7 sm:h-8 px-2 text-[10px] sm:text-xs text-gray-500 hover:text-gray-700 shrink-0"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1" />
                <span className="hidden sm:inline">Cancel</span>
              </Button>
            </div>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="relative"
            >
              <Textarea
                id="delivery-instructions"
                placeholder="E.g., Leave at door, Call before delivery, Gate code: 1234, etc."
                value={deliveryInstructions}
                onChange={(e) => onDeliveryInstructionsChange(e.target.value)}
                className="min-h-[80px] sm:min-h-[100px] resize-none text-sm sm:text-base"
                maxLength={500}
              />
              <div className="absolute bottom-2 right-2 text-[10px] sm:text-xs text-gray-400">
                {deliveryInstructions.length}/500
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.15 }}
              className="space-y-1.5 sm:space-y-2"
            >
              <div className="flex items-start gap-2 text-[10px] sm:text-xs text-gray-500 bg-blue-50 p-2 sm:p-3 rounded-lg">
                <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 shrink-0 text-blue-600" />
                <p className="leading-relaxed">
                  Add special instructions for the delivery person, such as gate codes, building
                  access, or preferred delivery times.
                </p>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 italic leading-relaxed">
                Your instructions help us deliver your packages according to your preferences and
                will be followed whenever possible.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delivery Details */}
      {/* <AnimatePresence>
        {selectedAddress && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <DeliveryDetails selectedAddress={selectedAddress} />
          </motion.div>
        )}
      </AnimatePresence> */}

      <AddressDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setEditingAddress(null)
            setIsNewAddress(false)
          }
        }}
        address={editingAddress}
        isNewAddress={isNewAddress}
        onSubmit={handleSubmit}
        isLoading={createAddress.isPending || updateAddress.isPending}
      />
    </div>
  )
}
