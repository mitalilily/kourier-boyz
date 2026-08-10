import { useEffect, useState } from 'react'

/**
 * Custom hook to detect if the current viewport is mobile (< 768px)
 * @returns boolean indicating if the screen is mobile
 */
export const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Check on mount
    checkMobile()

    // Listen for resize events
    window.addEventListener('resize', checkMobile)

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  return isMobile
}

