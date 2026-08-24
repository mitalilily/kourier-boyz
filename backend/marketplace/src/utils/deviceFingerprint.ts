import crypto from 'crypto'

/**
 * Generate a device fingerprint from IP address and User-Agent
 * This creates a consistent identifier for a device/browser combination
 */
export const generateDeviceFingerprint = (ipAddress?: string, userAgent?: string): string => {
  const input = `${ipAddress || 'unknown'}|${userAgent || 'unknown'}`
  return crypto.createHash('sha256').update(input).digest('hex')
}

/**
 * Check if a device is trusted based on its fingerprint
 */
export const isDeviceTrusted = (
  deviceFingerprint: string,
  trustedDevices?: Array<{ deviceFingerprint: string }>,
): boolean => {
  if (!trustedDevices || trustedDevices.length === 0) {
    return false
  }
  
  return trustedDevices.some((device) => device.deviceFingerprint === deviceFingerprint)
}

/**
 * Add a device to trusted devices list
 */
export const addTrustedDevice = (
  deviceFingerprint: string,
  userAgent?: string,
  ipAddress?: string,
  trustedDevices?: Array<{
    deviceFingerprint: string
    lastUsedAt: Date
    userAgent?: string
    ipAddress?: string
  }>,
): Array<{
  deviceFingerprint: string
  lastUsedAt: Date
  userAgent?: string
  ipAddress?: string
}> => {
  const devices = trustedDevices || []
  
  // Remove existing device if present and add it with updated timestamp
  const filteredDevices = devices.filter((d) => d.deviceFingerprint !== deviceFingerprint)
  
  // Add the device (keep max 10 trusted devices)
  const updatedDevices = [
    ...filteredDevices.slice(0, 9), // Keep max 9 old devices
    {
      deviceFingerprint,
      lastUsedAt: new Date(),
      userAgent,
      ipAddress,
    },
  ]
  
  return updatedDevices
}

