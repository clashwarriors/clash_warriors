import { getCards } from '../../../utils/indexedDBService'

/**
 * Fetches default deck cards (exactly 10)
 * Normalizes defaultDeck values to boolean
 * Logs info for debugging
 * @returns {Promise<Array>} Array of default deck cards
 */
export const fetchDefaultDeckCards = async () => {
  const cards = await getCards()

  // Log all cards from IDB
  console.log(
    '🧠 All Cards Snapshot:',
    (cards || []).map(c => ({
      id: c.cardId || c.id,
      name: c.name,
      defaultDeck: c.defaultDeck
    }))
  )

  // Normalize defaultDeck (true boolean or string 'true')
  const defaultDeckCards = (cards || []).filter(
    c => c.defaultDeck === true || c.defaultDeck === 'true'
  )

  // Log the ones counted as default
  console.log(
    '🎯 Default Deck Card IDs:',
    defaultDeckCards.map(c => c.cardId || c.id)
  )
  console.log('🎯 Default Deck Count:', defaultDeckCards.length)

  return defaultDeckCards
}
