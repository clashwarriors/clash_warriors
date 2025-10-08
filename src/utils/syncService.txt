// syncService.js

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

import { initCardDB, getAllCardsByRarity } from './cardsStorer' // your IndexedDB card setup

/**
 * Initialize local IndexedDB data from Firestore for new device
 */
export const initializeLocalData = async (userId) => {
  const localUser = await getUserData()
  const localCards = await getCards()

  if (!localUser || !localCards || localCards.length === 0) {
    console.log('♻️ No local data, fetching from Firestore...')
    const firestoreUser = await fetchUserFromFirestore(userId)
    const firestoreCards = await fetchUserCardsFromFirestore(userId)

    if (firestoreUser) {
      await storeUserData(firestoreUser)
      if (firestoreCards && firestoreCards.length > 0) {
        await storeCards(firestoreCards)
      }
      await setLastUpdate(firestoreUser.lastUpdate || Date.now())
      console.log('✅ IndexedDB initialized from Firestore.')
    } else {
      console.warn('⚠️ No user found in Firestore.')
    }
  } else {
    console.log('✅ Local data exists. Skipping Firestore init.')
  }
}

/**
 * Single source of truth: merge local IndexedDB with Firestore
 * Handles multi-device coins/cards updates
 */
export const updateOnline = async (userData) => {
  if (!userData || !userData.userId) {
    console.warn('⚠️ No valid user data to sync.')
    return
  }

  const userId = userData.userId
  const localUser = (await getUserData()) || { coins: 0 }
  const localCards = (await getCards()) || []

  const firestoreUser = await fetchUserFromFirestore(userId)
  const firestoreCards = (await fetchUserCardsFromFirestore(userId)) || []

  // ----------------------------
  // 1️⃣ Coins / User Merge
  // ----------------------------
  let mergedUser = { ...localUser }
  if (firestoreUser) {
    // Use lastUpdate to decide
    if ((firestoreUser.lastUpdate || 0) > (localUser.lastUpdate || 0)) {
      mergedUser.coins = firestoreUser.coins
      mergedUser.lastUpdate = firestoreUser.lastUpdate
    } else {
      mergedUser.coins = localUser.coins
      mergedUser.lastUpdate = localUser.lastUpdate
    }
  } else {
    mergedUser.lastUpdate = Date.now()
  }

  // ----------------------------
  // 2️⃣ Cards Merge by cardId
  // ----------------------------
  const cardDB = await initCardDB() // IndexedDB card store

  // Map for easy lookup
  const localCardMap = {}
  for (const card of localCards) localCardMap[card.cardId] = card
  const firestoreCardMap = {}
  for (const card of firestoreCards) firestoreCardMap[card.cardId] = card

  const mergedCards = []

  // Add all unique cards from both sources
  const allCardIds = new Set([
    ...Object.keys(localCardMap),
    ...Object.keys(firestoreCardMap),
  ])
  for (const cardId of allCardIds) {
    if (localCardMap[cardId] && firestoreCardMap[cardId]) {
      // Both exist, choose latest if you have timestamp per card (optional)
      mergedCards.push(localCardMap[cardId])
    } else if (localCardMap[cardId]) {
      mergedCards.push(localCardMap[cardId])
      // upload missing card to Firestore
      await uploadCardsToFirestore(userId, [localCardMap[cardId]])
    } else if (firestoreCardMap[cardId]) {
      mergedCards.push(firestoreCardMap[cardId])
      // add missing card to IndexedDB
      await storeCards([firestoreCardMap[cardId]])
    }
  }

  // ----------------------------
  // 3️⃣ Save merged data locally
  // ----------------------------
  await storeUserData(mergedUser)
  await storeCards(mergedCards)
  await setLastUpdate(Date.now())

  // ----------------------------
  // 4️⃣ Push merged data to Firestore
  // ----------------------------
  await uploadUserToFirestore(mergedUser)
  await uploadCardsToFirestore(userId, mergedCards)

  console.log('✅ Online sync complete. Local & Firestore are consistent.')
}

/**
 * Trigger sync manually or after specific actions
 * e.g., after battle win, referral bonus, or card collection
 */
export const triggerSync = async (userData) => {
  try {
    await updateOnline(userData)
  } catch (err) {
    console.error('⚠️ Failed to sync:', err)
  }
}
