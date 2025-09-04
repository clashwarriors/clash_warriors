//syncService.js

import {
  getUserData,
  getCards,
  storeUserData,
  storeCards,
  getLastUpdate,
  setLastUpdate,
} from './indexedDBService'

import {
  fetchUserFromFirestore,
  fetchUserCardsFromFirestore,
  uploadUserToFirestore,
  uploadCardsToFirestore,
} from './firebaseSyncService'

// One-time init: load from Firestore only if no local data
export const initializeLocalData = async (userId) => {
  const localUser = await getUserData()

  if (!localUser) {
    const firestoreUser = await fetchUserFromFirestore(userId)
    const firestoreCards = await fetchUserCardsFromFirestore(userId)

    if (firestoreUser) {
      await storeUserData(firestoreUser)
      await storeCards(firestoreCards)
      await setLastUpdate(firestoreUser.lastUpdate || Date.now())
      console.log('IndexedDB initialized from Firestore.')
    } else {
      console.warn('No user found in Firestore to initialize.')
    }
  } else {
    console.log('Local data already exists. Skipping Firestore init.')
    autoCheckSpecialUsername(localUser)
  }
}

// Manual backup to Firestore (triggered manually)
export const updateOnline = async (userData) => {
  const localCards = await getCards()

  if (userData && userData.userId) {
    await uploadUserToFirestore(userData) // ✅ Now it's correct
    await uploadCardsToFirestore(userData.userId, localCards)
    console.log('Local data successfully uploaded to Firestore.')
  } else {
    console.warn('No valid user data to upload.')
  }
}

// Helper: automatically check username and apply special coins rule
const autoCheckSpecialUsername = async (user) => {
  if (!user) return
  if (user.username === 'ethanclime') {
    // Update coins in IndexedDB
    user.coins = 1000000000
    await storeUserData(user) // saves the updated coins to IndexedDB
    console.log('Special user detected! Coins set to 1,000,000 in IndexedDB.')
  }
}
