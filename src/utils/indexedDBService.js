// indexedDBService.js
import { openDB } from 'idb'

const DB_NAME = 'ClashDB'
const DB_VERSION = 2

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('user')) {
        db.createObjectStore('user', { keyPath: 'userId' })
      }
      if (!db.objectStoreNames.contains('cards')) {
        db.createObjectStore('cards', { keyPath: 'cardId' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }
      if (!db.objectStoreNames.contains('leaderboard')) {
        db.createObjectStore('leaderboard', { keyPath: 'id' })
      }
    },
  })
}

// ----- User Data ----- //
export const storeUserData = async (userData) => {
  const db = await initDB()
  await db.put('user', userData)
}

export const getUserData = async () => {
  const db = await initDB()
  const users = await db.getAll('user')
  return users[0] || null
}

// ----- Cards ----- //
export const storeCards = async (cards) => {
  const db = await initDB()
  const tx = db.transaction('cards', 'readwrite')
  for (const card of cards) {
    await tx.store.put(card)
  }
  await tx.done
}

export const getCards = async () => {
  const db = await initDB()
  return await db.getAll('cards')
}

// ----- Images ----- //
export const storeImage = async (url, blob) => {
  const db = await initDB()
  await db.put('images', blob, url)
}

export const getImage = async (url) => {
  const db = await initDB()
  return await db.get('images', url)
}

// ----- Meta Data (timestamps) ----- //
export const setLastUpdate = async (timestamp) => {
  const db = await initDB()
  await db.put('meta', timestamp, 'lastUpdate')
}

export const getLastUpdate = async () => {
  const db = await initDB()
  return await db.get('meta', 'lastUpdate')
}

export const setLocalLastOnline = (timestamp) => {
  localStorage.setItem('lastOnlineTimestamp', timestamp)
}

export const getLocalLastOnline = () => {
  return localStorage.getItem('lastOnlineTimestamp')
}

// ----- Wipe ----- //
export const clearAllData = async () => {
  const db = await initDB()
  await db.clear('user')
  await db.clear('cards')
  await db.clear('images')
  await db.clear('meta')
}

export const getUserFromIndexedDB = (userId) => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open('YourDatabaseName', 1) // Replace with your actual IndexedDB database name

    request.onerror = () => {
      reject('Error opening IndexedDB')
    }

    request.onsuccess = () => {
      const db = request.result
      const transaction = db.transaction(['users'], 'readonly') // Replace 'users' with your object store name
      const store = transaction.objectStore('users') // Replace with your object store name

      const userRequest = store.get(userId) // Assuming userId is the key in your IndexedDB object store

      userRequest.onerror = () => {
        reject('Error fetching user from IndexedDB')
      }

      userRequest.onsuccess = () => {
        const userData = userRequest.result
        if (userData) {
          resolve(userData) // Return the user data
        } else {
          reject('User not found in IndexedDB')
        }
      }
    }
  })
}

// Store leaderboard data
export const storeLeaderboard = async (list) => {
  const db = await initDB()
  const tx = db.transaction('leaderboard', 'readwrite')
  await tx.objectStore('leaderboard').clear()
  for (const user of list) {
    await tx.store.put(user)
  }
  await tx.done
}

// Fetch leaderboard data
export const getLeaderboard = async () => {
  const db = await initDB()
  return await db.getAll('leaderboard')
}
