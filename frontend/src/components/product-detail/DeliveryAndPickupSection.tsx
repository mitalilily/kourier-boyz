import { AnimatePresence, motion } from 'framer-motion'
import React, { useEffect, useMemo, useState } from 'react'

import { useAddresses, useDefaultAddress } from '@/api/addresses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { readStoredDeliveryLocation } from '@/utils/deliveryLocationStorage'
import { CheckCircle2, Loader2, MapPin, XCircle } from 'lucide-react'

import type { DeliveryStatus } from './utils'

interface DeliveryAndPickupSectionProps {
  deliveryPin: string
  deliveryStatus: DeliveryStatus
  onDeliveryCheck: (event: React.FormEvent<HTMLFormElement>) => void
  onDeliveryPinChange: (value: string, options?: { autoCheck?: boolean }) => void
  isCheckingServiceability?: boolean
  isFreeShipping?: boolean
  allowsPayOnDelivery?: boolean
}

const DeliveryAndPickupSection: React.FC<DeliveryAndPickupSectionProps> = ({
  deliveryPin,
  deliveryStatus,
  onDeliveryCheck,
  onDeliveryPinChange,
  isCheckingServiceability = false,
  isFreeShipping = false,
  allowsPayOnDelivery = false,
}) => {
  const { isAuthenticated } = useAuthStore()
  const { data: defaultAddressData } = useDefaultAddress()
  const { data: addressesData } = useAddresses()
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [useManualPin, setUseManualPin] = useState(false)
  const [showAddressSelector, setShowAddressSelector] = useState(false)

  const defaultAddress = defaultAddressData?.address
  const addresses = useMemo(() => addressesData?.addresses || [], [addressesData?.addresses])

  // Align selected address with stored header location (if any), otherwise fallback to defaults
  useEffect(() => {
    if (useManualPin || selectedAddressId) return
    if (!addresses.length && !defaultAddress) return

    const applyAddressSelection = (address?: (typeof addresses)[number]) => {
      if (!address) return false
      setSelectedAddressId(address._id)
      if (address.postalCode && address.postalCode !== deliveryPin) {
        onDeliveryPinChange(address.postalCode, { autoCheck: true })
      }
      setUseManualPin(false)
      return true
    }

    const tryApplyStoredLocation = () => {
      const location = readStoredDeliveryLocation()
      if (!location) {
        return false
      }

      if (location.source === 'address' && location.id) {
        const addressFromLocation = addresses.find((addr) => addr._id === location.id)
        if (addressFromLocation && applyAddressSelection(addressFromLocation)) {
          return true
        }
      }

      if (location.postalCode) {
        const addressByPostal = addresses.find((addr) => addr.postalCode === location.postalCode)
        if (addressByPostal && applyAddressSelection(addressByPostal)) {
          return true
        }

        if (location.postalCode !== deliveryPin) {
          onDeliveryPinChange(location.postalCode, { autoCheck: true })
        }
        setUseManualPin(true)
        setSelectedAddressId('')
        return true
      }
      return false
    }

    if (tryApplyStoredLocation()) {
      return
    }

    if (defaultAddress && applyAddressSelection(defaultAddress)) {
      return
    }

    if (deliveryPin) {
      const matchingAddress = addresses.find((addr) => addr.postalCode === deliveryPin)
      if (matchingAddress && applyAddressSelection(matchingAddress)) {
        return
      }
    }

    if (addresses.length > 0) {
      applyAddressSelection(addresses[0])
    }
  }, [addresses, defaultAddress, deliveryPin, onDeliveryPinChange, selectedAddressId, useManualPin])

  // Handle address selection
  const handleAddressSelect = (addressId: string) => {
    if (addressId === 'manual') {
      setUseManualPin(true)
      setSelectedAddressId('')
      setShowAddressSelector(false)
      onDeliveryPinChange('')
      return
    }

    const selectedAddress = addresses.find((addr) => addr._id === addressId)
    if (selectedAddress) {
      setSelectedAddressId(addressId)
      setUseManualPin(false)
      setShowAddressSelector(false)
      onDeliveryPinChange(selectedAddress.postalCode, { autoCheck: true })
    }
  }

  const getCurrentAddressLabel = () => {
    if (!selectedAddressId && defaultAddress) {
      return `Delivering to ${
        defaultAddress.addressType
          ? defaultAddress.addressType.charAt(0).toUpperCase() + defaultAddress.addressType.slice(1)
          : 'Home'
      }`
    }
    if (selectedAddressId && selectedAddressId !== 'manual') {
      const address = addresses.find((a) => a._id === selectedAddressId)
      if (address) {
        return `Delivering to ${
          address.addressType
            ? address.addressType.charAt(0).toUpperCase() + address.addressType.slice(1)
            : 'Home'
        }`
      }
    }
    return 'Select delivery address'
  }

  const currentSelectedAddress = selectedAddressId
    ? addresses.find((a) => a._id === selectedAddressId)
    : defaultAddress

  const primaryServiceOption = deliveryStatus?.serviceabilityData?.courier || null
  const showFreeDeliveryBadge = Boolean(isFreeShipping && primaryServiceOption?.rate === 0)
  const showCodAvailable = Boolean(allowsPayOnDelivery && primaryServiceOption?.cod_available)

  return (
    <div className="space-y-3">
      {/* Current Delivery Address Display - Minimal */}
      {isAuthenticated && currentSelectedAddress && !useManualPin && !showAddressSelector && (
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">{getCurrentAddressLabel()}</p>
              <p className="text-xs text-gray-500">PIN: {currentSelectedAddress.postalCode}</p>
            </div>
          </div>
          <Button
            variant={'link'}
            type="button"
            onClick={() => {
              setShowAddressSelector(true)
            }}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Change
          </Button>
        </div>
      )}

      {/* Address Selection or Manual Input */}
      {(!isAuthenticated ||
        addresses.length === 0 ||
        showAddressSelector ||
        !currentSelectedAddress ||
        useManualPin) && (
        <div className="space-y-2">
          {isAuthenticated && addresses.length > 0 && (
            <Select
              value={selectedAddressId || defaultAddress?._id || ''}
              onValueChange={handleAddressSelect}
            >
              <SelectTrigger className="h-10 rounded-md border-gray-300 bg-white text-sm">
                <SelectValue placeholder="Select delivery address">
                  {selectedAddressId === 'manual'
                    ? 'Enter PIN manually'
                    : (() => {
                        const addr = selectedAddressId
                          ? addresses.find((a) => a._id === selectedAddressId)
                          : defaultAddress
                        return addr
                          ? `${
                              addr.addressType
                                ? addr.addressType.charAt(0).toUpperCase() +
                                  addr.addressType.slice(1)
                                : 'Home'
                            } - ${addr.postalCode}`
                          : 'Select delivery address'
                      })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {defaultAddress && (
                  <SelectItem value={defaultAddress._id}>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">
                          {defaultAddress.addressType
                            ? defaultAddress.addressType.charAt(0).toUpperCase() +
                              defaultAddress.addressType.slice(1)
                            : 'Home'}
                        </p>
                        <p className="text-xs text-gray-500">PIN: {defaultAddress.postalCode}</p>
                      </div>
                    </div>
                  </SelectItem>
                )}
                {addresses
                  .filter((addr) => addr._id !== defaultAddress?._id)
                  .map((address) => (
                    <SelectItem key={address._id} value={address._id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">
                            {address.addressType
                              ? address.addressType.charAt(0).toUpperCase() +
                                address.addressType.slice(1)
                              : 'Home'}
                          </p>
                          <p className="text-xs text-gray-500">PIN: {address.postalCode}</p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500 border-t border-gray-100 mt-1">
                  Other Options
                </div>
                <SelectItem value="manual">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">Enter PIN manually</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Manual PIN Input */}
          {(useManualPin || !isAuthenticated || addresses.length === 0) && (
            <form onSubmit={onDeliveryCheck} className="flex gap-2">
              <Input
                value={deliveryPin}
                onChange={(event) => {
                  const newPin = event.target.value
                  onDeliveryPinChange(newPin)
                  if (newPin && isAuthenticated && addresses.length > 0) {
                    const matchingAddress = addresses.find((addr) => addr.postalCode === newPin)
                    if (!matchingAddress) {
                      setUseManualPin(true)
                      setSelectedAddressId('')
                    } else {
                      setUseManualPin(false)
                      setSelectedAddressId(matchingAddress._id)
                    }
                  }
                }}
                placeholder="Enter PIN / ZIP code"
                maxLength={6}
                inputMode="numeric"
                className="h-10 rounded-md border-gray-300 bg-white flex-1 text-sm"
              />
              <Button variant="secondary" type="submit" className="h-10 px-4 text-sm">
                Check
              </Button>
            </form>
          )}

          {/* Check availability button when address is selected */}
          {isAuthenticated && currentSelectedAddress && !useManualPin && !showAddressSelector && (
            <Button
              variant="secondary"
              onClick={(e) => {
                e.preventDefault()
                const fakeEvent = {
                  preventDefault: () => {},
                } as React.FormEvent<HTMLFormElement>
                onDeliveryCheck(fakeEvent)
              }}
              className="w-full h-10 text-sm"
            >
              Check availability
            </Button>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {isCheckingServiceability && !deliveryStatus ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-blue-700">Checking delivery availability...</p>
            </div>
          </motion.div>
        ) : deliveryStatus ? (
          <motion.div
            key="delivery-status"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={cn(
              'rounded-lg border overflow-hidden',
              deliveryStatus.status === 'success'
                ? 'border-emerald-200 bg-emerald-50/30'
                : 'border-gray-200 bg-gray-50/50',
            )}
          >
            <div className="p-3">
              {deliveryStatus.status === 'success' && deliveryStatus.serviceabilityData ? (
                <div className="flex items-start gap-3 rounded-2xl bg-white/60 p-3 shadow-[0_8px_30px_rgba(16,185,129,0.08)]">
                  <div className="rounded-2xl bg-emerald-100/80 p-2 text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-600">
                      Great news!
                    </p>
                    <p className="text-sm font-semibold text-gray-900">
                      {deliveryStatus.message || 'Delivery available'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {showFreeDeliveryBadge && (
                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-600">
                          Free delivery
                        </span>
                      )}
                      {showCodAvailable && (
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-700">
                          COD available
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5">
                  <div className="rounded-full bg-gray-100 p-1.5 shrink-0">
                    <XCircle className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900">
                      {deliveryStatus.status === 'error'
                        ? 'Delivery not available to this location'
                        : deliveryStatus.message}
                    </p>
                    {deliveryStatus.status === 'error' && (
                      <p className="text-xs text-gray-600 mt-1">{deliveryStatus.message}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.p
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-gray-500"
          >
            {isAuthenticated && addresses.length > 0
              ? 'Select an address or enter PIN to check delivery availability.'
              : 'Enter your delivery PIN to get real-time availability and delivery estimates.'}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DeliveryAndPickupSection
