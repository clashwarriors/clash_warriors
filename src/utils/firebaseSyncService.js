// firebaseSyncService.js
import axios from 'axios'
import {
  getUserData,
  storeUserData,
  getCards,
  storeCards,
  getLastUpdate,
  setLastUpdate,
} from './indexedDBService'

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL
const API_BASE = `${BACKEND_URL}/api`

// ---------------------------
// Backend API helpers
// ---------------------------
export const fetchUserFromBackend = async (userId) => {
  try {
    const res = await axios.get(`${API_BASE}/user/${userId}`)
    return res.data
  } catch (error) {
    console.error('Error fetching user from backend:', error)
    return null
  }
}

export const uploadUserToBackend = async (userData) => {
  try {
    const res = await axios.post(`${API_BASE}/user/${userData.userId}`, {
      userData,
    })
    return res.data
  } catch (error) {
    console.error('Error uploading user to backend:', error)
    return null
  }
}

export const fetchUserCardsFromBackend = async (userId) => {
  try {
    const res = await axios.get(`${API_BASE}/user-cards/${userId}`)
    return res.data
  } catch (error) {
    console.error('Error fetching user cards from backend:', error)
    return []
  }
}

export const uploadCardsToBackend = async (userId, cards) => {
  try {
    const res = await axios.post(`${API_BASE}/user-cards/${userId}`, { cards })
    return res.data
  } catch (error) {
    console.error('Error uploading cards to backend:', error)
    return null
  }
}

// ---------------------------
// Merge cards helper
// ---------------------------
const mergeCards = (localCards, backendCards) => {
  const cardMap = {}
  ;[...(localCards || []), ...(backendCards || [])].forEach((card) => {
    cardMap[card.cardId] = card // optionally, compare timestamps for latest
  })
  return Object.values(cardMap)
}

// ---------------------------
// Initialize user + cards
// Handles Telegram data, IndexedDB, backend, and merges
// ---------------------------
export const initializeUser = async (userId, telegramData) => {
  try {
    // 1️⃣ Load local IndexedDB
    const localUser = await getUserData()
    const localCards = (await getCards()) || []
    const localLastUpdate = (await getLastUpdate()) || 0

    // 2️⃣ Fetch backend
    const backendUser = await fetchUserFromBackend(userId)
    const backendCards = await fetchUserCardsFromBackend(userId)

    let finalUser = null
    let finalCards = []

    // 3️⃣ Handle all existence cases
    if (!localUser && !backendUser) {
      // New user → Telegram data
      finalUser = {
        userId,
        first_name: telegramData.first_name || '',
        last_name: telegramData.last_name || '',
        username: telegramData.username || '',
        photo_url: telegramData.photo_url || '',
        coins: 1000000,
        xp: 0,
        pph: 1500,
        level: 1,
        streak: 0,
        tutorialDone: false,
        registration_timestamp: new Date().toISOString(),
        lastUpdate: Date.now(),
      }
      finalCards = [] // no cards yet
      await storeUserData(finalUser)
      await storeCards(finalCards)
      await uploadUserToBackend(finalUser)
    } else if (!localUser && backendUser) {
      finalUser = backendUser
      finalCards = backendCards
      await storeUserData(finalUser)
      await storeCards(finalCards)
      await setLastUpdate(finalUser.lastUpdate || Date.now())
    } else if (localUser && !backendUser) {
      finalUser = { ...localUser, lastUpdate: Date.now() }
      finalCards = localCards
      await storeUserData(finalUser)
      await storeCards(finalCards)
      await uploadUserToBackend(finalUser)
      await uploadCardsToBackend(userId, finalCards)
      await setLastUpdate(finalUser.lastUpdate)
    } else {
      // Both exist → merge based on lastUpdate
      if ((backendUser.lastUpdate || 0) > (localLastUpdate || 0)) {
        finalUser = backendUser
        finalCards = mergeCards(localCards, backendCards)
      } else {
        finalUser = { ...localUser, lastUpdate: Date.now() }
        finalCards = mergeCards(localCards, backendCards)
      }
      await storeUserData(finalUser)
      await storeCards(finalCards)
      await setLastUpdate(finalUser.lastUpdate || Date.now())
      await uploadUserToBackend(finalUser)
      await uploadCardsToBackend(userId, finalCards)
    }

    console.log('✅ User & cards initialized and synced.')
    return { user: finalUser, cards: finalCards }
  } catch (err) {
    console.error('❌ Failed to initialize user:', err)
    return { user: null, cards: [] }
  }
}

// ---------------------------
// Manual sync trigger
// ---------------------------
export const syncUser = async (userData) => {
  try {
    if (!userData?.userId) return
    userData.lastUpdate = Date.now()
    await storeUserData(userData)
    await uploadUserToBackend(userData) // ✅ directly upload without initializeUser
    console.log('🔄 Manual sync complete.')
  } catch (err) {
    console.error('⚠️ Failed to sync:', err)
  }
}
