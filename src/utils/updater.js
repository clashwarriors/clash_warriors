// updater.js
import { getCards, storeCards } from './indexedDBService'
import { getAllCardsByRarity } from './cardsStorer'

/**
 * Wait until all user cards are stored, then log them
 * and update image paths if they changed in master cards
 */
export const updateUserCardsFromMaster = async () => {
  try {
    const userCards = await getCards()
    if (!userCards || userCards.length === 0) {
      console.log('⚠️ No user cards found in IndexedDB yet.')
      return
    }

    console.log(`✅ Found ${userCards.length} user cards in IndexedDB:`)
    console.table(userCards.map(c => ({ cardId: c.cardId, name: c.name, photo: c.photo })))

    const updatedCards = []
    const rarities = ['common','uncommon','rare','mythical','legendary']

    for (const rarity of rarities) {
      const masterCards = await getAllCardsByRarity(rarity)
      for (const masterCard of masterCards) {
        const userCardIndex = userCards.findIndex(c => c.cardId === masterCard.cardId)
        if (userCardIndex !== -1) {
          // Compare user's photo with master card's image
          if (userCards[userCardIndex].photo !== masterCard.image) {
            userCards[userCardIndex].photo = masterCard.image // update key
            updatedCards.push(userCards[userCardIndex])
          }
        }
      }
    }

    if (updatedCards.length > 0) {
      await storeCards(updatedCards)
      console.log(`✅ Updated ${updatedCards.length} card(s) with new image paths.`)
    } else {
      console.log('✅ All user card images are up-to-date.')
    }

  } catch (error) {
    console.error('❌ Failed to update user cards:', error)
  }
}
