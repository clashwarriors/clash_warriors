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
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('cards')) {
        db.createObjectStore('cards', { keyPath: 'cardId' })
      }
    }
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

async function saveCardsBatch(idb, cards) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction('cards', 'readwrite')
    const store = tx.objectStore('cards')
    cards.forEach((card) => store.put(card))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject('❌ Failed to save cards batch')
  })
}

export async function initializeCardImages() {
  try {
    const idb = await openIndexedDB()
    const localCards = await getAllCards(idb)

    if (localCards.length === 0) {
      console.log('Fetching all cards for first time...')
      const allCards = []

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

          cardDocs.docs.forEach((cardDoc) => {
            const data = cardDoc.data()
            allCards.push({
              cardId: cardDoc.id,
              name: cardNameDoc.id,
              rarity,
              photo: data.image || null,
            })
          })
        }
      }

      // Save all cards in one batch
      await saveCardsBatch(idb, allCards)
      console.log('✅ IndexedDB initialized with all cards')
      localStorage.setItem('cardsInitialized', 'true')
    } else {
      console.log('Fetching missing images only...')
      const missingCards = localCards.filter((c) => !c.photo)

      // Limit concurrency to avoid freezing low-end phones
      const CONCURRENCY = 3
      let index = 0

      async function fetchNextBatch() {
        if (index >= missingCards.length) return
        const batch = missingCards.slice(index, index + CONCURRENCY)
        index += CONCURRENCY

        await Promise.all(
          batch.map(async (card) => {
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
                    break
                  }
                }
              } catch (err) {
                console.warn(
                  `Error fetching ${card.name} (${card.cardId})`,
                  err
                )
              }
            }
          })
        )

        // Save updated batch
        await saveCardsBatch(idb, batch)
        await fetchNextBatch()
      }

      await fetchNextBatch()
      console.log('✅ Missing card images updated')
    }
  } catch (err) {
    console.error('💥 initializeCardImages error:', err)
  }
}
