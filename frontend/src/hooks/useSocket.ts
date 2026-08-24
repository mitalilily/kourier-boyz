import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

let globalSocket: Socket | null = null

export const useSocket = () => {
  const { isAuthenticated, user } = useAuthStore()
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !user?.userId) {
      // Disconnect if not authenticated
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setIsConnected(false)
      }
      return
    }

    // Reuse global socket if available
    if (!globalSocket) {
      globalSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })

      globalSocket.on('connect', () => {
        console.log('[Socket] Connected')
        setIsConnected(true)
        // Register user
        if (user?.userId) {
          globalSocket?.emit('register', {
            userId: user.userId,
            role: user.role,
          })
        }
      })

      globalSocket.on('disconnect', () => {
        console.log('[Socket] Disconnected')
        setIsConnected(false)
      })

      globalSocket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error)
        setIsConnected(false)
      })
    }

    socketRef.current = globalSocket

    // Register user when socket is ready
    if (globalSocket.connected && user?.userId) {
      globalSocket.emit('register', {
        userId: user.userId,
        role: user.role,
      })
    }

    return () => {
      // Don't disconnect on unmount - keep connection alive
      // Only disconnect when user logs out (handled by auth store)
    }
  }, [isAuthenticated, user?.userId, user?.role])

  // Cleanup on logout
  useEffect(() => {
    if (!isAuthenticated && globalSocket) {
      globalSocket.disconnect()
      globalSocket = null
      socketRef.current = null
      setIsConnected(false)
    }
  }, [isAuthenticated])

  return {
    socket: socketRef.current,
    isConnected,
  }
}

// Cleanup function for app-wide disconnect
export const disconnectSocket = () => {
  if (globalSocket) {
    globalSocket.disconnect()
    globalSocket = null
  }
}

