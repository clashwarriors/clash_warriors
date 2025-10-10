import { openDB } from 'idb'

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
  userId,
  onCardLoaded,
  forceRefresh = false,
  onComplete // NEW: callback when all cards are done
) => {
  const db = await initCardDB()

  // ----- ONE-TIME CLEAR PER USER -----
  if (userId) {
    const flagKey = `cards_db_cleared_for_user_${userId}`
    if (!localStorage.getItem(flagKey)) {
      for (const store of db.objectStoreNames) {
        const tx = db.transaction(store, 'readwrite')
        tx.objectStore(store).clear()
        await tx.done
      }
      localStorage.setItem(flagKey, 'true')
      console.log(`✅ Card DB cleared once for user ${userId}`)
    } else {
      console.log(`✅ Card DB already cleared for user ${userId}`)
    }
  }

  // ----- SKIP FETCH IF ALREADY CACHED -----
  if (!forceRefresh) {
    let anyCardsExist = false
    for (const rarity of RARITIES) {
      const existing = await db.getAll(`cards_${rarity}`)
      if (existing.length > 0) {
        anyCardsExist = true
        break
      }
    }

    if (anyCardsExist) {
      console.log(
        '✅ Cards already cached in IndexedDB, skipping backend fetch'
      )
      if (typeof onComplete === 'function') onComplete()
      return
    }
  }

  try {
    // Fetch all cards from backend JSON
    const BACKEND_URL = import.meta.env.VITE_API_BASE_URL
    const res = await fetch(`${BACKEND_URL}/api/cards`)
    let allCards = await res.json()

    // ----- SORTING -----
    const rarityOrder = ['common', 'uncommon', 'rare', 'mythical', 'legendary']
    allCards.sort((a, b) => {
      const rarityDiff =
        rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
      if (rarityDiff !== 0) return rarityDiff
      const charDiff = a.character.localeCompare(b.character)
      if (charDiff !== 0) return charDiff
      return a.cardId.localeCompare(b.cardId)
    })

    // ----- STORE CARDS -----
    for (const rarity of RARITIES) {
      for (const character of CHARACTERS) {
        const tx = db.transaction(`cards_${rarity}`, 'readwrite')
        const store = tx.objectStore(`cards_${rarity}`)
        allCards
          .filter(
            (card) => card.rarity === rarity && card.character === character
          )
          .forEach((card) => {
            store.put(card)
            if (typeof onCardLoaded === 'function') onCardLoaded(card)
          })
        await tx.done
      }
    }

    console.log(
      '✅ All cards fetched, sorted, and stored by rarity & character'
    )

    // ----- TRIGGER REFRESH -----
    if (typeof onComplete === 'function') onComplete()
  } catch (err) {
    console.error('❌ Failed to fetch cards from Admin backend:', err)
  }
}
