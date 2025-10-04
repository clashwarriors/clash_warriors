import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { firestoreDB } from '../firebase'

const RARITIES = [
  'free',
  'common',
  'uncommon',
  'rare',
  'premium',
  'mythical',
  'legendary',
]

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ClashDB')
    request.onerror = () => reject('❌ Failed to open IndexedDB')
    request.onsuccess = () => resolve(request.result)
  })
}

async function getAllCards(idb) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('cards', 'readonly')
    const store = tx.objectStore('cards')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject('❌ Failed to read cards')
  })
}

async function saveCard(idb, card) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('cards', 'readwrite')
    const store = tx.objectStore('cards')
    const req = store.put(card)
    req.onsuccess = () => resolve()
    req.onerror = () => reject('❌ Failed to save card')
  })
}

export async function initializeCardImages() {
  try {
    const idb = await openIndexedDB()
    const localCards = await getAllCards(idb)

    if (localCards.length === 0) {
      // 🟢 First time: fetch all cards from Firestore
      console.log('Fetching all cards for first time...')
      for (const rarity of RARITIES) {
        const colRef = collection(firestoreDB, rarity)
        const cardNameDocs = await getDocs(colRef)

        for (const cardNameDoc of cardNameDocs.docs) {
          const cardIdCol = collection(
            firestoreDB,
            rarity,
            cardNameDoc.id,
            'cards'
          )
          const cardDocs = await getDocs(cardIdCol)

          for (const cardDoc of cardDocs.docs) {
            const data = cardDoc.data()
            const card = {
              cardId: cardDoc.id,
              name: cardNameDoc.id,
              rarity,
              photo: data.image || null,
            }
            await saveCard(idb, card)
          }
        }
      }
      console.log('✅ IndexedDB initialized with all cards')
      localStorage.setItem('cardsInitialized', 'true')
    } else {
      // 🔹 Subsequent runs: fetch only missing images
      console.log('Fetching missing images only...')
      for (const card of localCards) {
        if (card.photo) continue // already has image

        for (const rarity of RARITIES) {
          try {
            const docRef = doc(
              firestoreDB,
              rarity,
              card.name.toLowerCase(),
              'cards',
              card.cardId
            )
            const snapshot = await getDoc(docRef)
            if (snapshot.exists()) {
              const data = snapshot.data()
              if (data.image) {
                card.photo = data.image
                await saveCard(idb, card)
                break
              }
            }
          } catch (err) {
            console.warn(`Error fetching ${card.name} (${card.cardId})`, err)
          }
        }
      }
      console.log('✅ Missing card images updated')
    }
  } catch (err) {
    console.error('💥 initializeCardImages error:', err)
  }
}
