import {
  ref,
  set,
  get,
  query,
  orderByChild,
  equalTo,
  remove,
  update,
} from 'firebase/database'
import { realtimeDB } from '../../firebase'

/**
 * Generate a random alphanumeric unique ID
 * @param {number} [length=6] - Length of the generated ID
 * @returns {string} Randomly generated ID
 */
function generateUniqueId(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Check if a user is currently in any ongoing battle
 * @param {string} userId - ID of the user to check
 * @returns {Promise<boolean>} True if user is in battle, else false
 */
export const isUserInBattle = async (userId) => {
  const battlesRef = ref(realtimeDB, 'ongoingBattles')
  const q1 = query(battlesRef, orderByChild('player1/userId'), equalTo(userId))
  const q2 = query(battlesRef, orderByChild('player2/userId'), equalTo(userId))
  const [snap1, snap2] = await Promise.all([get(q1), get(q2)])
  return snap1.exists() || snap2.exists()
}

/**
 * Join the normal matchmaking queue
 * @param {Object} userData - User data object
 * @param {string} userData.userId - User ID
 * @param {string} userData.username - Username
 * @param {number} userData.totalSynergy - User's total synergy value
 * @param {string} userData.photo_url - User's avatar URL
 * @returns {Promise<boolean>} True if successfully added, false otherwise
 */
export const joinQueue = async (userData) => {
  const inBattle = await isUserInBattle(userData.userId)
  if (inBattle) return false

  const queueRef = ref(realtimeDB, `matchmakingQueue/${userData.userId}`)
  const existing = await get(queueRef)
  if (existing.exists()) return false

  await set(queueRef, {
    userId: userData.userId,
    userName: userData.username,
    synergy: userData.totalSynergy,
    initialSynergy: userData.totalSynergy,
    joinedAt: Date.now(),
    photoDP: userData.photo_url,
    walletId: userData.walletId || null, // ✅ Add wallet info
    mode: userData.mode || 'normal', // ✅ Store battle mode
  })

  return true
}

/**
 * Join the tutorial matchmaking queue
 * @param {Object} userData - User data object
 * @param {string} userData.userId - User ID
 * @param {string} userData.username - Username
 * @param {number} userData.totalSynergy - User's total synergy value
 * @returns {Promise<boolean>} True if successfully added, false otherwise
 */
export const joinTutorialQueue = async (userData) => {
  const inBattle = await isUserInBattle(userData.userId)
  if (inBattle) return false

  const queueRef = ref(realtimeDB, `tutorialQueue/${userData.userId}`)
  const existing = await get(queueRef)
  if (existing.exists()) return false

  await set(queueRef, {
    userId: userData.userId,
    userName: userData.username,
    synergy: userData.totalSynergy,
    initialSynergy: userData.totalSynergy,
    joinedAt: Date.now(),
  })

  return true
}

/**
 * Create a friendly match
 * @param {Object} userData - Player 1 data
 * @param {string} userData.userId - User ID
 * @param {string} userData.username - Username
 * @param {number} userData.totalSynergy - User's total synergy value
 * @param {string} userData.photo_url - User's avatar URL
 * @returns {Promise<{success: boolean, uniqueId?: string}>} Object containing match code if successful
 */
export const createFriendlyMatch = async (userData) => {
  const inBattle = await isUserInBattle(userData.userId)
  if (inBattle) return { success: false }

  const uniqueId = generateUniqueId()
  const matchRef = ref(realtimeDB, `friendlyQueue/${uniqueId}`)
  const matchSnap = await get(matchRef)
  if (matchSnap.exists()) return { success: false }

  await set(matchRef, {
    player1: {
      userId: userData.userId,
      userName: userData.username,
      synergy: userData.totalSynergy,
      initialSynergy: userData.totalSynergy,
      joinedAt: Date.now(),
      photoDP: userData.photo_url,
    },
    player2: null,
  })

  return { success: true, uniqueId }
}

/**
 * Join an existing friendly match as Player 2
 * @param {Object} userData - Player 2 data
 * @param {string} userData.userId - User ID
 * @param {string} userData.username - Username
 * @param {string} userData.photo_url - Avatar URL
 * @param {string} uniqueId - Match ID to join
 * @returns {Promise<{success: boolean}>} True if joined successfully
 */
export const joinFriendlyQueue = async (userData, uniqueId) => {
  const matchRef = ref(realtimeDB, `friendlyQueue/${uniqueId}`)
  const matchSnap = await get(matchRef)
  if (!matchSnap.exists()) return { success: false }

  const matchData = matchSnap.val()
  if (matchData.player2) return { success: false }

  const player2Data = {
    userId: userData.userId,
    userName: userData.username,
    synergy: userData.totalSynergy,
    initialSynergy: userData.totalSynergy,
    joinedAt: Date.now(),
    photoDP: userData.photo_url,
  }

  await update(matchRef, { player2: player2Data })
  return { success: true }
}

/**
 * Cancel a friendly match
 * @param {string} userId - User cancelling the match
 * @param {string} matchId - Match ID
 * @returns {Promise<boolean>} True if successfully removed, false otherwise
 */
export const cancelFriendlyMatch = async (userId, matchId) => {
  try {
    const matchRef = ref(realtimeDB, `friendlyQueue/${matchId}`)
    const matchSnap = await get(matchRef)
    if (!matchSnap.exists()) return false

    const match = matchSnap.val()
    if (match.player1?.userId === userId) {
      await remove(matchRef)
      return true
    }
    if (match.player2?.userId === userId) {
      await update(matchRef, { player2: null })
      return true
    }
    return false
  } catch (error) {
    console.error(error)
    return false
  }
}

/**
 * Leave any queue (normal or tutorial)
 * @param {string} userId - User leaving
 * @returns {Promise<boolean>} True if successfully removed
 */
export const leaveQueue = async (userId) => {
  try {
    const queueRef = ref(realtimeDB, `matchmakingQueue/${userId}`)
    if ((await get(queueRef)).exists()) {
      await remove(queueRef)
      return true
    }

    const tutorialQueueRef = ref(realtimeDB, `tutorialQueue/${userId}`)
    if ((await get(tutorialQueueRef)).exists()) {
      await remove(tutorialQueueRef)
      return true
    }

    return false
  } catch (error) {
    console.error(error)
    return false
  }
}
