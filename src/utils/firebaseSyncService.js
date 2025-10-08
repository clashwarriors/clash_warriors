// firebaseSyncService.js
import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL
const API_BASE = `${BACKEND_URL}/api`

// ---------------------------
// Fetch user cards
// ---------------------------
export const fetchUserCardsFromFirestore = async (userId) => {
  try {
    const res = await axios.get(`${API_BASE}/user-cards/${userId}`)
    return res.data // array of cards
  } catch (error) {
    console.error('Error fetching user cards from backend:', error)
    throw error
  }
}

// ---------------------------
// Upload user cards
// ---------------------------
export const uploadCardsToFirestore = async (userId, cards) => {
  try {
    const res = await axios.post(`${API_BASE}/user-cards/${userId}`, { cards })
    return res.data
  } catch (error) {
    console.error('Error uploading cards to backend:', error)
    throw error
  }
}

// ---------------------------
// Fetch user data
// ---------------------------
export const fetchUserFromFirestore = async (userId) => {
  try {
    const res = await axios.get(`${API_BASE}/user/${userId}`)
    return res.data
  } catch (error) {
    console.error('Error fetching user data from backend:', error)
    throw error
  }
}

// ---------------------------
// Upload user data
// ---------------------------
export const uploadUserToFirestore = async (userData) => {
  try {
    const res = await axios.post(`${API_BASE}/user/${userData.userId}`, {
      userData,
    })
    return res.data
  } catch (error) {
    console.error('Error uploading user data to backend:', error)
    throw error
  }
}

// ---------------------------
// Manual sync (IndexedDB -> backend)
// ---------------------------
export const manualSyncToFirestore = async () => {
  try {
    const userData = await getUserData() // assumes getUserData() fetches from IndexedDB
    if (!userData) {
      console.log('No user data found in IndexedDB.')
      return
    }

    const res = await axios.post(`${API_BASE}/manual-sync/${userData.userId}`, {
      userData,
    })
    console.log('User data successfully synced to backend.', res.data)
  } catch (error) {
    console.error('Error syncing data to backend:', error)
  }
}
