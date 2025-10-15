// indexedDBService.js
import { openDB } from 'idb'

const DB_NAME = 'ClashDB'
const DB_VERSION = 3

// ✅ Global memory caches for ultra-fast reads
export const memoryCache = {
  users: new Map(),
  cards: new Map(),
  images: new Map(),
  leaderboard: new Map(),
  meta: new Map(),
}

// ----- Initialize DB -----
export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('user'))
        db.createObjectStore('user', { keyPath: 'userId' })
      if (!db.objectStoreNames.contains('cards'))
        db.createObjectStore('cards', { keyPath: 'cardId' })
      if (!db.objectStoreNames.contains('images'))
        db.createObjectStore('images') // ✅ added images store
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
      if (!db.objectStoreNames.contains('leaderboard'))
        db.createObjectStore('leaderboard', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('userDecks'))
        db.createObjectStore('userDecks', { keyPath: 'deckId' })
    },
  })
}

// ----- User Data -----
export const storeUserData = async (userData) => {
  const db = await initDB()
  await db.put('user', userData)
  memoryCache.users.set(userData.userId, userData)
}

export const getUserData = async (userId) => {
  if (memoryCache.users.has(userId)) return memoryCache.users.get(userId)
  const db = await initDB()
  const user = userId
    ? await db.get('user', userId)
    : (await db.getAll('user'))[0] || null
  if (user) memoryCache.users.set(user.userId, user)
  return user
}

// ----- Cards -----
export const storeCards = async (cards) => {
  if (!cards || !cards.length) return
  const db = await initDB()
  const tx = db.transaction('cards', 'readwrite')

  for (const card of cards) {
    const existing = await tx.store.get(card.cardId)
    const merged = { ...existing, ...card }
    await tx.store.put(merged)
  }

  await tx.done
}

export const getCards = async () => {
  const db = await initDB()
  const cards = await db.getAll('cards')
  return cards
}

// ----- Images -----
export const storeImage = async (url, blobOrBase64) => {
  const db = await initDB()
  await db.put('images', blobOrBase64, url)
  memoryCache.images.set(url, blobOrBase64)
}

export const getImage = async (url) => {
  if (memoryCache.images.has(url)) return memoryCache.images.get(url)
  const db = await initDB()
  const img = await db.get('images', url)
  if (img) memoryCache.images.set(url, img)
  return img
}

// ----- Meta Data -----
export const setLastUpdate = async (timestamp) => {
  const db = await initDB()
  await db.put('meta', timestamp, 'lastUpdate')
  memoryCache.meta.set('lastUpdate', timestamp)
}

export const getLastUpdate = async () => {
  if (memoryCache.meta.has('lastUpdate'))
    return memoryCache.meta.get('lastUpdate')
  const db = await initDB()
  const ts = await db.get('meta', 'lastUpdate')
  if (ts) memoryCache.meta.set('lastUpdate', ts)
  return ts
}

export const setLocalLastOnline = (timestamp) =>
  localStorage.setItem('lastOnlineTimestamp', timestamp)
export const getLocalLastOnline = () =>
  localStorage.getItem('lastOnlineTimestamp')

// ----- Leaderboard -----
export const storeLeaderboard = async (list) => {
  if (!list || !list.length) return
  const db = await initDB()
  const tx = db.transaction('leaderboard', 'readwrite')
  await tx.store.clear()
  for (const user of list) {
    await tx.store.put(user)
    memoryCache.leaderboard.set(user.id, user)
  }
  await tx.done
}

export const getLeaderboard = async () => {
  if (memoryCache.leaderboard.size > 0)
    return Array.from(memoryCache.leaderboard.values())
  const db = await initDB()
  const data = await db.getAll('leaderboard')
  data.forEach((u) => memoryCache.leaderboard.set(u.id, u))
  return data
}

// ----- User Decks -----
export const storeUserDeck = async (deck) => {
  if (!deck || !deck.deckId) return
  const db = await initDB()
  await db.put('userDecks', deck)
}

export const getUserDeck = async (deckId = 'default') => {
  const db = await initDB()
  const deck = await db.get('userDecks', deckId)
  return deck || { deckId, cards: [], totalSynergy: 0 }
}

export const clearUserDecks = async () => {
  const db = await initDB()
  await db.clear('userDecks')
}

// ----- Clear All Data -----
export const clearAllData = async () => {
  const db = await initDB()
  await Promise.all([
    db.clear('user'),
    db.clear('cards'),
    db.clear('images'),
    db.clear('meta'),
    db.clear('leaderboard'),
  ])
  memoryCache.users.clear()
  memoryCache.cards.clear()
  memoryCache.images.clear()
  memoryCache.meta.clear()
  memoryCache.leaderboard.clear()
}
