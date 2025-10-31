// indexedDBService.js
import { openDB } from 'idb'

const DB_NAME = 'ClashDB'
const DB_VERSION = 4

// ✅ Persistent connection cache
let dbInstance = null

// ✅ Ultra-fast memory cache (for hot reloads)
export const memoryCache = {
  users: new Map(),
  cards: new Map(),
  images: new Map(),
  meta: new Map(),
  decks: new Map(),
}

// =======================
// ⚙️ Init DB (singleton)
// =======================
export const initDB = async () => {
  if (dbInstance) return dbInstance
  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('user'))
          db.createObjectStore('user', { keyPath: 'userId' })
        if (!db.objectStoreNames.contains('cards'))
          db.createObjectStore('cards', { keyPath: 'cardId' })
        if (!db.objectStoreNames.contains('images'))
          db.createObjectStore('images')
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
        if (!db.objectStoreNames.contains('userDecks'))
          db.createObjectStore('userDecks', { keyPath: 'deckId' })
      },
    })
    return dbInstance
  } catch (err) {
    console.error('⚠️ IndexedDB init failed — resetting DB', err)
    await indexedDB.deleteDatabase(DB_NAME)
    dbInstance = await openDB(DB_NAME, DB_VERSION)
    return dbInstance
  }
}

// =======================
// 👤 User
// =======================
export const storeUserData = async (userData) => {
  if (!userData?.userId) return
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

// =======================
// 🃏 Cards
// =======================
export const storeCards = async (cards) => {
  if (!cards?.length) return
  const db = await initDB()
  const tx = db.transaction('cards', 'readwrite')
  await Promise.all(
    cards.map(async (card) => {
      const existing = await tx.store.get(card.cardId)
      const merged = { ...existing, ...card }
      memoryCache.cards.set(card.cardId, merged)
      await tx.store.put(merged)
    })
  )
  await tx.done
}

export const getCards = async () => {
  if (memoryCache.cards.size) return Array.from(memoryCache.cards.values())
  const db = await initDB()
  const cards = await db.getAll('cards')
  cards.forEach((c) => memoryCache.cards.set(c.cardId, c))
  return cards
}

// =======================
// 🖼️ Images
// =======================
export const storeImage = async (url, blobOrBase64) => {
  if (!url || !blobOrBase64) return
  const db = await initDB()
  memoryCache.images.set(url, blobOrBase64)
  await db.put('images', blobOrBase64, url)
}

export const getImage = async (url) => {
  if (memoryCache.images.has(url)) return memoryCache.images.get(url)
  const db = await initDB()
  const img = await db.get('images', url)
  if (img) memoryCache.images.set(url, img)
  return img
}

// =======================
// 🧠 Meta
// =======================
export const setLastUpdate = async (timestamp) => {
  const db = await initDB()
  memoryCache.meta.set('lastUpdate', timestamp)
  await db.put('meta', timestamp, 'lastUpdate')
}

export const getLastUpdate = async () => {
  if (memoryCache.meta.has('lastUpdate'))
    return memoryCache.meta.get('lastUpdate')
  const db = await initDB()
  const ts = await db.get('meta', 'lastUpdate')
  if (ts) memoryCache.meta.set('lastUpdate', ts)
  return ts
}

export const setLocalLastOnline = (ts) =>
  localStorage.setItem('lastOnlineTimestamp', ts)
export const getLocalLastOnline = () =>
  localStorage.getItem('lastOnlineTimestamp')

// =======================
// 🧩 User Decks
// =======================
export const storeUserDeck = async (deck) => {
  if (!deck?.deckId) return
  const db = await initDB()
  memoryCache.decks.set(deck.deckId, deck)
  await db.put('userDecks', deck)
}

export const getUserDeck = async (deckId = 'default') => {
  if (memoryCache.decks.has(deckId)) return memoryCache.decks.get(deckId)
  const db = await initDB()
  const deck = await db.get('userDecks', deckId)
  memoryCache.decks.set(deckId, deck || { deckId, cards: [], totalSynergy: 0 })
  return deck || { deckId, cards: [], totalSynergy: 0 }
}

export const clearUserDecks = async () => {
  const db = await initDB()
  await db.clear('userDecks')
  memoryCache.decks.clear()
}

// =======================
// 🧹 Clear All
// =======================
export const clearAllData = async () => {
  const db = await initDB()
  await Promise.all([
    db.clear('user'),
    db.clear('cards'),
    db.clear('images'),
    db.clear('meta'),
    db.clear('userDecks'),
  ])
  Object.values(memoryCache).forEach((map) => map.clear())
  console.log('🧹 Local DB + memory cache fully cleared.')
}
