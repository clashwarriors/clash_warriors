// socketManager.js
import { io } from 'socket.io-client'

let socket = null

/**
 * Initialize Socket.IO and register user
 * @param {string} userId
 */
export const initSocket = (userId, onMatchFound) => {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_BASE_URL, {
      transports: ['websocket'], // force websocket transport
    })

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      if (userId) socket.emit('register', userId)
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    socket.on('match-found', (matchData) => {
      console.log('Match found:', matchData)
      if (typeof onMatchFound === 'function') {
        onMatchFound(matchData)
      }
    })
  }
  return socket
}

/**
 * Clean up socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.off('match-found')
    socket.disconnect()
    socket = null
  }
}

/**
 * Reuse socket instance
 */
export const getSocket = () => socket
