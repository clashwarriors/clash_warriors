// --- Constants ---
export const PHASES = {
  COOLDOWN: 'cooldown',
  SELECTION: 'selection',
  BATTLE: 'battle',
  FINISHED: 'finished',
}

export const ROUND_DURATION_MS = {
  COOLDOWN: 5000,
  SELECTION: 5000,
  BATTLE: 3000,
}

export const TOTAL_ROUNDS = 5

export const ROUND_TOTAL_TIME =
  ROUND_DURATION_MS.SELECTION + ROUND_DURATION_MS.BATTLE

export const FIRST_ROUND_TOTAL_TIME =
  ROUND_DURATION_MS.COOLDOWN +
  ROUND_DURATION_MS.SELECTION +
  ROUND_DURATION_MS.BATTLE

export const MATCH_TOTAL_TIME =
  FIRST_ROUND_TOTAL_TIME + (TOTAL_ROUNDS - 1) * ROUND_TOTAL_TIME

// --- Time + Phase Manager ---

export const getCurrentPhase = (startTime) => {
  const now = Date.now()
  const elapsed = now - startTime

  if (elapsed >= MATCH_TOTAL_TIME) return PHASES.FINISHED

  if (elapsed < ROUND_DURATION_MS.COOLDOWN) return PHASES.COOLDOWN

  const postCooldownElapsed = elapsed - ROUND_DURATION_MS.COOLDOWN

  const fullRoundIndex = Math.floor(postCooldownElapsed / ROUND_TOTAL_TIME)
  const roundTime = postCooldownElapsed % ROUND_TOTAL_TIME

  if (roundTime < ROUND_DURATION_MS.SELECTION) {
    return PHASES.SELECTION
  }

  return PHASES.BATTLE
}

export const getCurrentRound = (startTime) => {
  const now = Date.now()
  const elapsed = now - startTime

  if (elapsed < ROUND_DURATION_MS.COOLDOWN) return 0

  const postCooldownElapsed = elapsed - ROUND_DURATION_MS.COOLDOWN
  return Math.min(
    Math.floor(postCooldownElapsed / ROUND_TOTAL_TIME),
    TOTAL_ROUNDS - 1
  )
}

export const getRemainingPhaseTime = (startTime) => {
  const now = Date.now()
  const elapsed = now - startTime

  if (elapsed < ROUND_DURATION_MS.COOLDOWN) {
    return Math.ceil((ROUND_DURATION_MS.COOLDOWN - elapsed) / 1000)
  }

  const postCooldownElapsed = elapsed - ROUND_DURATION_MS.COOLDOWN
  const roundTime = postCooldownElapsed % ROUND_TOTAL_TIME

  if (roundTime < ROUND_DURATION_MS.SELECTION) {
    return Math.ceil((ROUND_DURATION_MS.SELECTION - roundTime) / 1000)
  }

  return Math.ceil(
    (ROUND_DURATION_MS.SELECTION + ROUND_DURATION_MS.BATTLE - roundTime) / 1000
  )
}

// --- Match Finalization Control ---
export const shouldFinalizeMatch = (startTime) => {
  const now = Date.now()
  const elapsed = now - startTime
  return elapsed > MATCH_TOTAL_TIME + 10000 // 10s after match ends
}

// --- In-Memory Backend Store ---
export const roundDataStore = {} // matchID: { rounds, totalSynergy, botTimer, botDeck }

// --- Logic Utilities ---
export const selectRandomCard = (deck) => {
  if (!Array.isArray(deck) || deck.length === 0) return null
  const index = Math.floor(Math.random() * deck.length)
  return deck[index]
}

// --- Core Battle Logic ---
export const initializeMatchStore = (matchID, userDeck, botDeck) => {
  roundDataStore[matchID] = {
    rounds: Array(TOTAL_ROUNDS)
      .fill(null)
      .map(() => ({
        userCard: null,
        botCard: null,
        userAbility: null,
        botAbility: null,
        usedCards: [],
      })),
    totalSynergy: { user: 0, bot: 0 },
    botTimer: Array(TOTAL_ROUNDS).fill(null),
    botDeck: userDeck || [],
    usedCardsGlobal: [],
  }
  if (botDeck) {
    autoScheduleAllBotMoves(matchID)
  }
}

export const autoScheduleAllBotMoves = (matchID) => {
  const store = roundDataStore[matchID]
  if (!store) return

  for (let round = 0; round < TOTAL_ROUNDS; round++) {
    const baseDelay = ROUND_DURATION_MS.COOLDOWN + round * ROUND_TOTAL_TIME
    const randomDelay = 2000 + Math.floor(Math.random() * 3000)

    store.botTimer[round] = setTimeout(() => {
      if (!store.rounds[round].botCard) {
        const botCard = selectRandomCard(store.botDeck)
        store.rounds[round].botCard = botCard
        store.totalSynergy.bot += botCard?.synergy || 0

        console.log(
          `🤖 Bot auto-selected (round ${round}) from its deck with synergy: ${botCard?.synergy || 0}`
        )
      }
    }, baseDelay + randomDelay)
  }
}

export const scheduleBotMove = (matchID, round) => {
  const store = roundDataStore[matchID]
  if (store.botTimer[round]) return

  const delay = 2000 + Math.floor(Math.random() * 3000)
  store.botTimer[round] = setTimeout(() => {
    const botCard = selectRandomCard(store.botDeck)

    // ✅ Ensure bot never picks a used card
    if (store.usedCardsGlobal.includes(botCard.cardID)) return

    store.rounds[round].botCard = botCard
    store.usedCardsGlobal.push(botCard.cardID) // mark global
    store.totalSynergy.bot += botCard?.synergy || 0

    console.log(
      `🤖 Round ${round + 1} | BOT selected card: ${botCard.name} (ID: ${botCard.cardID}, synergy: ${botCard.synergy})`
    )
  }, delay)
}

export const scheduleBotAbility = (matchID, round) => {
  const store = roundDataStore[matchID]
  if (!store || store.rounds[round].botAbility) return

  const delay = 2000 + Math.floor(Math.random() * 3000)
  setTimeout(() => {
    const randomAbility =
      ATTACK_ABILITIES[Math.floor(Math.random() * ATTACK_ABILITIES.length)]
    handleAbilitySelection(matchID, randomAbility, 'bot')
    console.log(
      `🤖 Round ${round + 1} | BOT selected ability: ${randomAbility}`
    )
  }, delay)
}

export const handleCardSelection = (matchID, selectedCard, player = 'user') => {
  const store = roundDataStore[matchID]
  if (!store) return false

  const round = getCurrentRound(store.startTime)
  const roundData = store.rounds[round]

  const cardKey = selectedCard.cardID

  // Block if card already used in any previous round
  if (store.usedCardsGlobal.includes(cardKey)) {
    console.log(
      `⚠️ ${player} attempted to select a card already used in this match: ${cardKey}`
    )
    return false // selection blocked
  }

  // Save selection
  roundData.userCard = selectedCard
  roundData.usedCards.push(cardKey) // round-specific tracking
  store.usedCardsGlobal.push(cardKey) // match-wide tracking
  store.totalSynergy[player] += selectedCard.synergy || 0

  // ✅ Log card selection
  console.log(
    `🃏 Round ${round + 1} | ${player.toUpperCase()} selected card: ${selectedCard.name} (ID: ${cardKey}, synergy: ${selectedCard.synergy})`
  )

  return true
}

export const handleAbilitySelection = (
  matchID,
  abilityKey,
  player = 'user'
) => {
  const store = roundDataStore[matchID]
  if (!store) return

  const round = getCurrentRound(store.startTime || Date.now())
  const roundData = store.rounds[round]

  const abilityField = player === 'user' ? 'userAbility' : 'botAbility'
  if (!roundData[abilityField]) {
    roundData[abilityField] = abilityKey

    // Calculate synergy from abilityWeights
    let abilitySynergy = 0
    if (abilityWeights[abilityKey.toLowerCase()]) {
      const weights = abilityWeights[abilityKey.toLowerCase()]
      abilitySynergy = Object.values(weights).reduce((a, b) => a + b, 0)
      store.totalSynergy[player] += abilitySynergy
    }

    // ✅ Log ability selection
    console.log(
      `⚡ Round ${round + 1} | ${player.toUpperCase()} selected ability: ${abilityKey} (synergy: ${abilitySynergy})`
    )
  }
}

export const autoScheduleAllBotAbilities = (matchID) => {
  const store = roundDataStore[matchID]
  if (!store) return

  for (let round = 0; round < TOTAL_ROUNDS; round++) {
    scheduleBotAbility(matchID, round)
  }
}

export const autoHandleBotSelection = (matchID, startTime) => {
  const round = getCurrentRound(startTime)
  initializeMatchStore(matchID)

  const store = roundDataStore[matchID]
  const roundData = store.rounds[round]

  if (!roundData.botCard && !store.botTimer[round]) {
    scheduleBotMove(matchID, round)
  }
}

export const evaluateCurrentRound = (matchID, startTime) => {
  const round = getCurrentRound(startTime)
  const match = roundDataStore[matchID]
  if (!match || !match.rounds[round]) return null

  const { userCard, botCard } = match.rounds[round]
  if (!userCard || !botCard) return null

  return evaluateCardBattle(userCard, botCard)
}

export const evaluateCardBattle = (userCard, botCard) => {
  const userSynergy = userCard.synergy || 0
  const botSynergy = botCard.synergy || 0

  if (userSynergy > botSynergy) return 'user'
  if (botSynergy > userSynergy) return 'bot'
  return 'tie'
}

export const getBattleHistory = (matchID) => {
  return roundDataStore[matchID]?.rounds || []
}

export const getSynergyTotals = (matchID) => {
  return roundDataStore[matchID]?.totalSynergy || { user: 0, bot: 0 }
}

export const manualEndRound = (matchID, round) => {
  const store = roundDataStore[matchID]
  if (!store || !store.rounds[round]) return

  store.rounds[round].userEndedRound = true

  // Check if both user and bot have ended
  if (store.rounds[round].botCard && store.rounds[round].userCard) {
    store.rounds[round].bothEnded = true
    console.log(`✅ Both players ended round ${round}. Ready to start battle.`)
    return true // signal frontend to proceed to BATTLE
  }

  return false // wait for bot or user
}

/**
 * Logs the current round's card and ability selections for both user and bot
 * @param {string} matchID - The ID of the current match
 */
export const logCurrentRoundSelections = (matchID) => {
  const store = roundDataStore[matchID]
  if (!store) return console.warn('No match store found for', matchID)

  const round = getCurrentRound(store.startTime || Date.now())
  const roundData = store.rounds[round]
  if (!roundData) return console.warn('No round data found for round', round)

  const userCard = roundData.userCard
  const botCard = roundData.botCard
  const userAbility = roundData.userAbility
  const botAbility = roundData.botAbility

  console.log(`🎯 Round ${round + 1} Selections:`)
  console.log('User Card:', userCard ? userCard.name : 'Not selected yet')
  console.log('User Ability:', userAbility || 'Not selected yet')
  console.log('Bot Card:', botCard ? botCard.name : 'Not selected yet')
  console.log('Bot Ability:', botAbility || 'Not selected yet')
}
