import { getCards } from '../../../../utils/indexedDBService.js'

export const createOfflineMatch = async () => {
  console.log('✅ matchMaker triggered (IndexedDB version)')

  // Remove old matches from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('match-')) {
      console.log(`🗑️ Removing old match: ${key}`)
      localStorage.removeItem(key)
    }
  })

  try {
    // Fetch cards from IndexedDB
    const allCards = await getCards()

    // Filter default deck cards and map to {src, synergy}
    const defaultDeck = allCards
      .filter((card) => card.defaultDeck === true)
      .map((card) => ({
        cardID: card.cardId,
        src: card.photo, // use 'photo' not 'photo_url'
        stats: card.stats, // use 'totalStats' for synergy value
      }))

    // Verify there are exactly 10 defaultDeck cards
    if (defaultDeck.length !== 10) {
      console.warn(`⚠️ You must have exactly 10 default deck cards. Found: ${defaultDeck.length}`)
      throw new Error('Your army is incomplete! 10 warriors required to march into battle!')
    }

    // Shuffle deck array randomly
    const shuffledDeck = [...defaultDeck].sort(() => Math.random() - 0.5)

    // Create match object
    const matchID = `offline-${Date.now()}`
    const match = {
      matchID,
      player1: 'USER',
      playerName: 'You',
      player1Deck: shuffledDeck,
      botDeck: shuffledDeck,
      isOffline: true,
      startTime: Date.now(),
    }

    // Save match to localStorage
    localStorage.setItem(`match-${matchID}`, JSON.stringify(match))
    console.log('✅ Offline match created and stored:', match)

    return match
  } catch (error) {
    console.error('❌ createOfflineMatch error:', error)
    throw error
  }
}
