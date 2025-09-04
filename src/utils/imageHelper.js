import { doc, getDoc } from "firebase/firestore";
import { firestoreDB } from "../firebase";

const RARITIES = [
  "free",
  "common",
  "uncommon",
  "rare",
  "premium",
  "mythical",
  "legendary"
];

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ClashDB");
    request.onerror = () => reject("❌ Failed to open IndexedDB");
    request.onsuccess = () => resolve(request.result);
  });
}

async function getAllCards(idb) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction("cards", "readonly");
    const store = tx.objectStore("cards");
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject("❌ Failed to read cards");
  });
}

async function updateCard(idb, updatedCard) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction("cards", "readwrite");
    const store = tx.objectStore("cards");
    const req = store.put(updatedCard);

    req.onsuccess = () => resolve();
    req.onerror = () => reject("❌ Failed to update card");
  });
}

export async function updateFreeCardImages() {
  try {
    const idb = await openIndexedDB();
    const cards = await getAllCards(idb);

    for (const card of cards) {
      const { cardId, name: cardName } = card;
      if (!cardId || !cardName) continue;

      let updated = false;

      for (const rarity of RARITIES) {
        try {
          const docRef = doc(firestoreDB, rarity, cardName.toLowerCase(), "cards", cardId);
          const snapshot = await getDoc(docRef);

          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.image) {
              if (card.photo !== data.image) {
                card.photo = data.image;
                await updateCard(idb, card);
             //   console.log(`✅ Updated: ${cardName} (${cardId}) [${rarity}]`);
              } else {
             //   console.log(`ℹ️ No change for: ${cardName} (${cardId}) [${rarity}]`);
              }
              updated = true;
              break; // stop checking other rarities once found
            } else {
            //  console.warn(`⚠️ No 'image' field in ${rarity}/${cardName}/${cardId}`);
            }
          }
        } catch (err) {
        //  console.error(`🔥 Error checking ${rarity}/${cardName}/${cardId}:`, err);
        }
      }

      if (!updated) {
       // console.warn(`❌ No matching document found for ${cardName} (${cardId}) in any rarity.`);
      }
    }

    //console.log("🎉 Finished updating all cards from all rarities.");

  } catch (err) {
    //console.error("💥 updateFreeCardImages error:", err);
  }
}
