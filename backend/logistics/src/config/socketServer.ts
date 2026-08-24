import { Server as HttpServer } from 'http'
import { Socket, Server as SocketIOServer } from 'socket.io'
import { setEmployeeOnlineStatus } from '../models/services/employee.service'
import { corsOriginCallback } from './cors'

let io: SocketIOServer
const configuredServers = new WeakSet<SocketIOServer>()

// Track active connections per user (supports multiple tabs)
const activeConnections: Record<string, Set<string>> = {}

export const registerLogisticsSocketHandlers = (socketServer: SocketIOServer) => {
  io = socketServer
  if (configuredServers.has(io)) return io
  configuredServers.add(io)

  io.on('connection', (socket: Socket) => {
    let currentUserId: string | null = null

    socket.on('register', async (userId: string | { role?: string; userId?: string }) => {
      if (typeof userId !== 'string' || !userId) return
      currentUserId = userId
      socket.join(userId)
      console.log(`User ${userId} joined room`)

      if (!activeConnections[userId]) activeConnections[userId] = new Set()
      activeConnections[userId].add(socket.id)
      console.log('active connections', userId, activeConnections[userId].size)

      await setEmployeeOnlineStatus(userId, true)
      socket.on('employee_ping', () => {
        console.log(`Ping received from ${userId}`)
      })
    })

    socket.on('disconnect', async () => {
      if (currentUserId && activeConnections[currentUserId]) {
        activeConnections[currentUserId].delete(socket.id)

        if (activeConnections[currentUserId].size === 0) {
          await setEmployeeOnlineStatus(currentUserId, false)
          delete activeConnections[currentUserId]
        }
      }
    })
  })
  return io
}

export const initSocketServer = (server: HttpServer) => {
  const socketServer = new SocketIOServer(server, {
    cors: {
      origin: corsOriginCallback,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })
  return registerLogisticsSocketHandlers(socketServer)
}

// Emit notification to a specific user
export const sendNotification = (userId: string, notification: any) => {
  if (io) io.to(userId).emit('new_notification', notification)
}
