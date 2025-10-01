// // fixUserCards.js
// import { getDocs, collection, doc, updateDoc } from 'firebase/firestore'
// import { firestoreDB } from '../firebase' // adjust path to your firebase.js

// // Cache master map to avoid repeated fetches
// let masterCardMap = null

// // Build master card map: cardId -> correct image path
// export const buildMasterCardMap = async () => {
//   if (masterCardMap) return masterCardMap

//   masterCardMap = {}
//   const rarities = ['common', 'uncommon', 'rare', 'mythical', 'legendary']
//   const characters = ['frostguard', 'stormscaller', 'starivya', 'xalgrith']

//   for (const rarity of rarities) {
//     for (const character of characters) {
//       const cardsRef = collection(firestoreDB, rarity, character, 'cards')
//       const snapshot = await getDocs(cardsRef)

//       snapshot.forEach((docSnap) => {
//         const data = docSnap.data()
//         if (data && data.image) {
//           masterCardMap[docSnap.id] = data.image
//         }
//       })
//     }
//   }

//   console.log(`✅ Master card map built with ${Object.keys(masterCardMap).length} cards`)
//   return masterCardMap
// }

// // Fix user card photos for a single user
// export const fixUserCardPhotos = async (userId) => {
//   try {
//     if (!userId) throw new Error('No userId provided')

//     const masterMap = await buildMasterCardMap()

//     const userCardsRef = collection(firestoreDB, 'users', userId, 'cards')
//     const snapshot = await getDocs(userCardsRef)

//     if (snapshot.empty) {
//       console.log(`ℹ️ User ${userId} has no cards to update`)
//       return
//     }

//     const updates = []

//     snapshot.forEach((docSnap) => {
//       const card = docSnap.data()

//       // Skip invalid cards
//       if (!card || !card.cardId) return

//       const correctPath = masterMap[card.cardId]
//       if (!correctPath) {
//         console.warn(`⚠️ Master card not found for cardId ${card.cardId}`)
//         return
//       }

//       if (!card.photo || card.photo !== correctPath) {
//         updates.push(
//           updateDoc(doc(firestoreDB, 'users', userId, 'cards', docSnap.id), {
//             photo: correctPath,
//           })
//         )
//         console.log(`✅ Updated card ${card.cardId} for user ${userId}`)
//       }
//     })

//     if (updates.length > 0) {
//       await Promise.all(updates)
//       console.log(`✅ All applicable cards updated for user ${userId}`)
//     } else {
//       console.log(`ℹ️ No cards needed updating for user ${userId}`)
//     }
//   } catch (err) {
//     console.error(`❌ Error fixing user cards for user ${userId}:`, err)
//   }
// }

// // Example: call for a single user (in App.jsx or wherever)
// export const fixCardsForActiveUser = async (userId) => {
//   await fixUserCardPhotos(userId)
// }
