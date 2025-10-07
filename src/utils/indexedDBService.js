// indexedDBService.js
import { openDB } from 'idb'

const DB_NAME = 'ClashDB'
const DB_VERSION = 2

let cachedDB = null

// ----- Initialize / Get Cached DB ----- //
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
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images') // key = url
      }
    },
  })
}

const getDB = async () => {
  if (!cachedDB) cachedDB = await initDB()
  return cachedDB
}

// ----- User Data ----- //
export const storeUserData = async (userData) => {
  const db = await getDB()
  await db.put('user', userData)
}

export const getUserData = async () => {
  const db = await getDB()
  const users = await db.getAll('user')
  return users[0] || null
}

// Fetch user by ID
export const getUserFromIndexedDB = async (userId) => {
  const db = await getDB()
  return await db.get('user', userId)
}

// ----- Cards ----- //
export const storeCards = async (cards) => {
  const db = await getDB()
  const tx = db.transaction('cards', 'readwrite')
  const store = tx.objectStore('cards')
  for (const card of cards) {
    store.put(card) // batch without await inside loop
  }
  await tx.done
}

export const getCards = async () => {
  const db = await getDB()
  return await db.getAll('cards')
}

// ----- Images ----- //
export const storeImage = async (url, blob) => {
  const db = await getDB()
  await db.put('images', blob, url)
}

export const getImage = async (url) => {
  const db = await getDB()
  return await db.get('images', url)
}

// ----- Meta Data (timestamps) ----- //
export const setLastUpdate = async (timestamp) => {
  const db = await getDB()
  await db.put('meta', timestamp, 'lastUpdate')
}

export const getLastUpdate = async () => {
  const db = await getDB()
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
  const db = await getDB()
  await db.clear('user')
  await db.clear('cards')
  await db.clear('images')
  await db.clear('meta')
  await db.clear('leaderboard')
}

// ----- Leaderboard ----- //
export const storeLeaderboard = async (list) => {
  const db = await getDB()
  const tx = db.transaction('leaderboard', 'readwrite')
  const store = tx.objectStore('leaderboard')
  await store.clear() // clear previous top 100
  for (const user of list) {
    store.put(user) // batch without await
  }
  await tx.done
}

export const getLeaderboard = async () => {
  const db = await getDB()
  return await db.getAll('leaderboard')
}
