import { openDB } from 'idb'
import { collection, getDocs } from 'firebase/firestore'
import { firestoreDB } from '../firebase'

const DB_NAME = 'all_cards_db'
const DB_VERSION = 1

const RARITIES = ['common', 'uncommon', 'rare', 'mythical', 'legendary']
const CHARACTERS = ['frostguard', 'stormscaller', 'starivya', 'xalgrith']

// Initialize DB with rarity-based object stores
export const initCardDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      for (const rarity of RARITIES) {
        const storeName = `cards_${rarity}`
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'cardId' })
        }
      }
    },
  })
}

export const getCardByIdFromRarity = async (rarity, cardId) => {
  const db = await initCardDB()
  return db.get(`cards_${rarity}`, cardId)
}

// Get all cards of a specific rarity
export const getAllCardsByRarity = async (rarity) => {
  const db = await initCardDB()
  return db.getAll(`cards_${rarity}`)
}

// Fetch from Firestore & store in appropriate object store
export const fetchAndStoreAllCards = async (
  onCardLoaded,
  forceRefresh = false
) => {
  const db = await initCardDB()

  if (!forceRefresh) {
    // Only skip if not forcing
    const existing = await db.getAll(`cards_common`)
    if (existing.length > 0) {
      console.log('✅ Cards already cached, skipping Firestore fetch')
      return
    }
  }

  // Otherwise fetch from Firestore...
  for (const rarity of RARITIES) {
    for (const character of CHARACTERS) {
      const cardsRef = collection(firestoreDB, rarity, character, 'cards')
      const snapshot = await getDocs(cardsRef)

      const tx = db.transaction(`cards_${rarity}`, 'readwrite')
      const store = tx.objectStore(`cards_${rarity}`)

      snapshot.forEach((doc) => {
        const card = {
          ...doc.data(),
          rarity,
          character,
          cardId: doc.id,
        }
        store.put(card)
        if (typeof onCardLoaded === 'function') {
          onCardLoaded(card)
        }
      })

      await tx.done
    }
  }

  console.log('✅ All cards fetched and stored by rarity')
}

// ------------------------
// TEMP: Force full refresh for v1
// ------------------------
export const ensureCardsFetchedV1 = async (onCardLoaded) => {
  const db = await initCardDB()

  if (localStorage.getItem('cardsFetchedV2')) {
    console.log('✅ Cards already updated for v2.')
    return
  }

  console.log('♻️ Clearing all cards from IndexedDB for v2 refresh...')

  // Delete all object stores' content
  for (const rarity of RARITIES) {
    const tx = db.transaction(`cards_${rarity}`, 'readwrite')
    const store = tx.objectStore(`cards_${rarity}`)
    await store.clear()
    await tx.done
  }

  console.log('♻️ All old cards removed, fetching fresh cards...')

  // Force fetch ignoring cache
  await fetchAndStoreAllCards(onCardLoaded, true)

  // Set localStorage flag so it doesn’t rerun
  localStorage.setItem('cardsFetchedV2', 'true')
  console.log('✅ Cards IndexedDB fully refreshed and v2 flag set.')
}
