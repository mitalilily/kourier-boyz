import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAddresses } from '../../api/addresses'
import { useAuthStore } from '../../store/authStore'
import type { Address } from '../../types/address'
import {
  clearStoredDeliveryLocation,
  readStoredDeliveryLocation,
  writeStoredDeliveryLocation,
} from '../../utils/deliveryLocationStorage'

export type HeaderLocationSource = 'address' | 'preset' | 'detected' | 'custom'

export type HeaderLocation = {
  id: string
  label: string
  detail: string
  postalCode?: string
  type?: string
  source: HeaderLocationSource
  ownerUserId?: string
}

export type AddressLocationPair = {
  address: Address
  location: HeaderLocation
}

const haversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusKm * c
}

export interface UseHeaderLocationResult {
  addressesLoading: boolean
  addressLocationPairs: AddressLocationPair[]
  selectedLocation: HeaderLocation | null
  isLocationPopoverOpen: boolean
  setIsLocationPopoverOpen: (open: boolean) => void
  showAllAddresses: boolean
  toggleShowAllAddresses: () => void
  handleAddressSelect: (address: Address) => void
  handleManualPinSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  pinInput: string
  handlePinInputChange: (value: string) => void
  locationError: string | null
  isDetectingLocation: boolean
  handleUseCurrentLocation: () => void
}

export const useHeaderLocation = (): UseHeaderLocationResult => {
  const userId = useAuthStore((state) => state.user?.userId)
  const { data: addressesData, isLoading: addressesLoading } = useAddresses()
  const addresses = useMemo(() => addressesData?.addresses ?? [], [addressesData?.addresses])

  const [isLocationPopoverOpen, setIsLocationPopoverOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<HeaderLocation | null>(null)
  const [showAllAddresses, setShowAllAddresses] = useState(false)
  const [addressCoordinates, setAddressCoordinates] = useState<
    Record<string, { lat: number; lon: number }>
  >({})
  const addressCoordsInFlight = useRef<Record<string, boolean>>({})
  const initialLocationSelected = useRef(false)
  const activeUserId = useRef(userId)

  useEffect(() => {
    if (activeUserId.current === userId) return
    activeUserId.current = userId
    clearStoredDeliveryLocation()
    setSelectedLocation(null)
    initialLocationSelected.current = false
  }, [userId])

  const createLocationFromAddress = useCallback(
    (address: Address): HeaderLocation => ({
      id: address._id,
      label: `${
        address.addressType === 'work' ? 'Work' : address.addressType === 'other' ? 'Other' : 'Home'
      } · ${address.city}`,
      detail: `${address.fullName} · ${address.addressLine1}${
        address.addressLine2 ? ', ' + address.addressLine2 : ''
      }, ${address.city}, ${address.state} ${address.postalCode}`,
      postalCode: address.postalCode,
      type: address.addressType,
      source: 'address',
    }),
    [],
  )

  const addressLocationPairs = useMemo(
    () =>
      addresses.map((address) => ({
        address,
        location: createLocationFromAddress(address),
      })),
    [addresses, createLocationFromAddress],
  )

  const fetchAddressCoordinates = useCallback(
    async (address: Address) => {
      if (addressCoordinates[address._id] || addressCoordsInFlight.current[address._id]) return

      const storageKey = `kourier_boyz_address_coords_${address._id}`
      addressCoordsInFlight.current[address._id] = true

      try {
        const cached = localStorage.getItem(storageKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed?.lat && parsed?.lon) {
            setAddressCoordinates((prev) => ({ ...prev, [address._id]: parsed }))
            return
          }
        }

        const query = encodeURIComponent(
          `${address.addressLine1} ${address.addressLine2 || ''} ${address.city} ${address.state} ${
            address.postalCode
          } ${address.country}`,
        )
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
          {
            headers: {
              'Accept-Language': 'en',
            },
          },
        )

        if (response.ok) {
          const results = await response.json()
          if (Array.isArray(results) && results.length > 0) {
            const { lat, lon } = results[0]
            if (lat && lon) {
              const coords = { lat: parseFloat(lat), lon: parseFloat(lon) }
              localStorage.setItem(storageKey, JSON.stringify(coords))
              setAddressCoordinates((prev) => ({ ...prev, [address._id]: coords }))
            }
          }
        }
      } catch (err) {
        console.warn('Unable to geocode address', address._id, err)
      } finally {
        delete addressCoordsInFlight.current[address._id]
      }
    },
    [addressCoordinates],
  )

  const commitLocation = useCallback(
    (locationData: HeaderLocation, options?: { persist?: boolean; closePopover?: boolean }) => {
      const committedLocation =
        options?.persist === false
          ? locationData
          : writeStoredDeliveryLocation(locationData, userId)
      setSelectedLocation(committedLocation)
      // Notify other parts of the app (cart, checkout, product pages) that location has changed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<HeaderLocation>('kourier-boyz-location-changed', {
            detail: committedLocation,
          }),
        )
      }
      if (options?.closePopover !== false) {
        setIsLocationPopoverOpen(false)
      }
      setLocationError(null)
    },
    [userId],
  )

  const handleAddressSelect = useCallback(
    (address: Address) => {
      commitLocation(createLocationFromAddress(address))
    },
    [commitLocation, createLocationFromAddress],
  )

  const handlePinInputChange = useCallback((value: string) => {
    setLocationError(null)
    setPinInput(value)
  }, [])

  const validatePincode = useCallback(async (pincode: string): Promise<{
    isValid: boolean
    location?: { city?: string; state?: string; district?: string }
    error?: string
  }> => {
    try {
      // Indian pincode validation (6 digits) - using postalpincode.in API
      if (/^\d{6}$/.test(pincode)) {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
          headers: {
            'Accept': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data) && data.length > 0 && data[0].Status === 'Success') {
            const postOffices = data[0].PostOffice || []
            if (postOffices.length > 0) {
              const location = postOffices[0]
              return {
                isValid: true,
                location: {
                  city: location.Block || location.Division,
                  state: location.State,
                  district: location.District,
                },
              }
            }
          }
          return {
            isValid: false,
            error: 'Invalid pincode. Please enter a valid 6-digit Indian pincode.',
          }
        }
      }

      // ZIP code validation (5 digits for US) - basic format validation
      if (/^\d{5}$/.test(pincode)) {
        // For US ZIP codes, we can use a simple format check
        // For more detailed validation, you could use APIs like zippopotam.us (requires CORS handling)
        return {
          isValid: true,
          location: {
            city: 'Location',
            state: 'US',
          },
        }
      }

      // For other formats (alphanumeric ZIP codes like UK, Canada)
      if (/^[A-Z0-9\s-]{3,10}$/i.test(pincode)) {
        // Basic validation - accepts alphanumeric codes
        return {
          isValid: true,
          location: {
            city: 'Location',
          },
        }
      }

      return {
        isValid: false,
        error: 'Invalid format. Please enter a valid PIN or ZIP code.',
      }
    } catch (error) {
      console.error('Pincode validation error:', error)
      // Fallback: accept the pincode if API fails (network issues)
      return {
        isValid: true,
        location: {},
      }
    }
  }, [])

  const handleManualPinSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmed = pinInput.trim()
      
      if (trimmed.length < 4) {
        setLocationError('Enter a valid PIN or ZIP code.')
        return
      }

      setLocationError(null)
      setIsDetectingLocation(true)

      try {
        const validation = await validatePincode(trimmed)
        
        if (!validation.isValid) {
          setLocationError(validation.error || 'Invalid PIN or ZIP code.')
          setIsDetectingLocation(false)
          return
        }

        const { location } = validation
        const locationParts = [
          location?.city,
          location?.district,
          location?.state,
        ].filter(Boolean)

        const manualLocation: HeaderLocation = {
          id: `manual_${trimmed}`,
          label: locationParts.length > 0 
            ? `${locationParts[0]}${locationParts[1] ? `, ${locationParts[1]}` : ''} · ${trimmed}`
            : `Pinned ${trimmed}`,
          detail: locationParts.length > 0
            ? `${locationParts.join(', ')} · PIN: ${trimmed}`
            : `Deliveries tailored to PIN ${trimmed}`,
          postalCode: trimmed,
          source: 'custom',
        }
        
        commitLocation(manualLocation)
        setPinInput('')
      } catch (error) {
        console.error('Failed to validate pincode:', error)
        setLocationError('Unable to validate pincode. Please try again.')
      } finally {
        setIsDetectingLocation(false)
      }
    },
    [pinInput, commitLocation, validatePincode],
  )

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported on this device.')
      return
    }

    setLocationError(null)
    setIsDetectingLocation(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          let detectedPostal: string | undefined
          let label = `Near (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`
          let detail = 'Based on your current coordinates.'

          const readyPairs = addressLocationPairs
            .map((pair) => ({ ...pair, coords: addressCoordinates[pair.address._id] }))
            .filter((entry) => entry.coords)

          if (readyPairs.length > 0) {
            const nearest = readyPairs.reduce(
              (best: { pair: (typeof readyPairs)[number]; distance: number } | null, current) => {
                const coords = current.coords!
                const distance = haversineDistanceKm(latitude, longitude, coords.lat, coords.lon)
                if (!best || distance < best.distance) {
                  return { pair: current, distance }
                }
                return best
              },
              null,
            )

            if (nearest) {
              commitLocation(nearest.pair.location)
              setIsDetectingLocation(false)
              return
            }
          }

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
              {
                headers: {
                  'Accept-Language': 'en',
                },
              },
            )
            if (response.ok) {
              const data = await response.json()
              const address = data.address || {}
              detectedPostal = address.postcode
              const city = address.city || address.town || address.village
              const state = address.state
              label = [city, state].filter(Boolean).join(', ') || label
              detail = data.display_name || detail
            }
          } catch (reverseErr) {
            console.warn('Reverse geocoding failed', reverseErr)
          }

          if (detectedPostal) {
            const matchingAddress = addresses.find((addr) => addr.postalCode === detectedPostal)
            if (matchingAddress) {
              commitLocation(createLocationFromAddress(matchingAddress))
              setIsDetectingLocation(false)
              return
            }
          }

          commitLocation(
            {
              id: `detected_${Date.now()}`,
              label,
              detail,
              postalCode: detectedPostal,
              source: 'detected',
            },
            { closePopover: true },
          )
        } catch (err) {
          console.error('Failed to detect location', err)
          setLocationError('Unable to determine current location. Try again later.')
        } finally {
          setIsDetectingLocation(false)
        }
      },
      (error) => {
        console.error('Geolocation error', error)
        setLocationError('Location access denied. You can manually choose an address.')
        setIsDetectingLocation(false)
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
      },
    )
  }, [
    addresses,
    addressLocationPairs,
    addressCoordinates,
    commitLocation,
    createLocationFromAddress,
  ])

  useEffect(() => {
    if (addressesLoading) return
    addresses.forEach((address) => {
      if (!addressCoordinates[address._id]) {
        fetchAddressCoordinates(address)
      }
    })
  }, [addressesLoading, addresses, addressCoordinates, fetchAddressCoordinates])

  useEffect(() => {
    if (addressLocationPairs.length <= 3) {
      setShowAllAddresses(false)
    }
  }, [addressLocationPairs])

  useEffect(() => {
    if (addressesLoading) return
    if (selectedLocation && selectedLocation.ownerUserId !== userId) {
      clearStoredDeliveryLocation()
      setSelectedLocation(null)
      initialLocationSelected.current = false
      return
    }
    if (initialLocationSelected.current) return

    if (!selectedLocation) {
      const stored = readStoredDeliveryLocation(userId) as HeaderLocation | null
      if (stored) {
        commitLocation(stored, { closePopover: false, persist: false })
        initialLocationSelected.current = true
        return
      }

      if (addressLocationPairs.length > 0) {
        const defaultPair =
          addressLocationPairs.find(({ address }) => address.isDefault) || addressLocationPairs[0]
        commitLocation(defaultPair.location, { closePopover: false })
        initialLocationSelected.current = true
        return
      }
    }

    initialLocationSelected.current = true
  }, [addressesLoading, addressLocationPairs, selectedLocation, commitLocation, userId])

  useEffect(() => {
    if (addressesLoading || selectedLocation?.source !== 'address') return
    if (addresses.some((address) => address._id === selectedLocation.id)) return

    clearStoredDeliveryLocation()
    setSelectedLocation(null)
    initialLocationSelected.current = false
  }, [addressesLoading, addresses, selectedLocation])

  const toggleShowAllAddresses = useCallback(() => {
    setShowAllAddresses((prev) => !prev)
  }, [])

  return {
    addressesLoading,
    addressLocationPairs,
    selectedLocation,
    isLocationPopoverOpen,
    setIsLocationPopoverOpen,
    showAllAddresses,
    toggleShowAllAddresses,
    handleAddressSelect,
    handleManualPinSubmit,
    pinInput,
    handlePinInputChange,
    locationError,
    isDetectingLocation,
    handleUseCurrentLocation,
  }
}
