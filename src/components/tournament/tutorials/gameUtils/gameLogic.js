// --- Constants ---
export const PHASES = {
  COOLDOWN: 'cooldown',
  SELECTION: 'selection',
  BATTLE: 'battle',
  FINISHED: 'finished',
}

export const ROUND_DURATION_MS = {
  COOLDOWN: 5000,
  SELECTION: 10000,
  BATTLE: 10000,
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
const roundDataStore = {} // matchID: { rounds, totalSynergy, botTimer, botDeck }

// --- Logic Utilities ---
export const selectRandomCard = (deck) => {
  if (!Array.isArray(deck) || deck.length === 0) return null
  const index = Math.floor(Math.random() * deck.length)
  return deck[index]
}

// --- Core Battle Logic ---
export const initializeMatchStore = (matchID, userDeck, botDeck) => {
  if (!roundDataStore[matchID]) {
    roundDataStore[matchID] = {
      rounds: Array(TOTAL_ROUNDS)
        .fill(null)
        .map(() => ({ userCard: null, botCard: null })),
      totalSynergy: { user: 0, bot: 0 },
      botTimer: Array(TOTAL_ROUNDS).fill(null),
      botDeck: botDeck || [],
    }

    if (botDeck) {
      autoScheduleAllBotMoves(matchID)
    }
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
    store.rounds[round].botCard = botCard
    store.totalSynergy.bot += botCard?.synergy || 0

    console.log(
      `🤖 Bot auto-selected (round ${round}) from its deck with synergy: ${botCard?.synergy || 0}`
    )
  }, delay)
}

export const handleCardSelection = (
  matchID,
  selectedCard,
  userDeck,
  startTime
) => {
  const round = getCurrentRound(startTime)
  initializeMatchStore(matchID)

  const store = roundDataStore[matchID]
  const roundData = store.rounds[round]

  if (!roundData.userCard) {
    roundData.userCard = selectedCard
    store.totalSynergy.user += selectedCard.synergy || 0

    console.log(
      `🧠 User selected for round ${round} with synergy: ${selectedCard.synergy || 0}`
    )
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
