// firebaseSyncService.js
import {
  getDoc,
  doc,
  collection,
  getDocs,
  query,
  writeBatch,
  setDoc,
} from 'firebase/firestore'
import { firestoreDB } from '../firebase'

// Fetch user cards from Firestore
export const fetchUserCardsFromFirestore = async (userId) => {
  const cardsRef = collection(firestoreDB, `users/${userId}/cards`)
  const q = query(cardsRef)

  try {
    const querySnapshot = await getDocs(q)
    const cards = []
    querySnapshot.forEach((doc) => {
      cards.push({ cardId: doc.id, ...doc.data() })
    })
    return cards
  } catch (error) {
    console.error('Error fetching cards from Firestore:', error)
    throw error
  }
}

// Upload cards to Firestore
export const uploadCardsToFirestore = async (userId, cards) => {
  const batch = writeBatch(firestoreDB)

  cards.forEach((card) => {
    const cardRef = doc(firestoreDB, `users/${userId}/cards`, card.cardId)
    batch.set(cardRef, card)
  })

  try {
    await batch.commit()
    console.log('Cards uploaded successfully!')
  } catch (error) {
    console.error('Error uploading cards to Firestore:', error)
    throw error
  }
}

// Fetch user data from Firestore
export const fetchUserFromFirestore = async (userId) => {
  const userDocRef = doc(firestoreDB, 'users', userId)
  try {
    const userDoc = await getDoc(userDocRef)
    if (userDoc.exists()) {
      return userDoc.data()
    } else {
      throw new Error('User not found')
    }
  } catch (error) {
    console.error('Error fetching user data from Firestore:', error)
    throw error
  }
}

// Upload user data to Firestore
export const uploadUserToFirestore = async (userData) => {
  const userDocRef = doc(firestoreDB, 'users', userData.userId)
  try {
    await setDoc(userDocRef, userData, { merge: true })
    console.log('User data uploaded successfully!')
  } catch (error) {
    console.error('Error uploading user data to Firestore:', error)
    throw error
  }
}
// Sync data from IndexedDB to Firestore
export const manualSyncToFirestore = async () => {
  try {
    // Step 1: Fetch user data from IndexedDB
    const userData = await getUserData() // Assuming getUserData is a function that retrieves user data from IndexedDB

    // Step 2: Upload user data to Firestore
    if (userData) {
      await uploadUserToFirestore(userData)
      console.log(
        'User data successfully uploaded to Firestore from IndexedDB.'
      )
    } else {
      console.log('No user data found in IndexedDB.')
    }
  } catch (error) {
    console.error('Error syncing data to Firestore:', error)
  }
}
