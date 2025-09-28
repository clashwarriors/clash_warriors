import {
  ref,
  set,
  get,
  query,
  orderByChild,
  equalTo,
  remove,
  getDatabase,
  child,
} from 'firebase/database'
import { realtimeDB } from '../../firebase'

// Check if user is already in an ongoing battle
const isUserInBattle = async (userId) => {
  const battlesRef = ref(realtimeDB, 'ongoingBattles')

  const q1 = query(battlesRef, orderByChild('player1/userId'), equalTo(userId))
  const q2 = query(battlesRef, orderByChild('player2/userId'), equalTo(userId))

  const [snap1, snap2] = await Promise.all([get(q1), get(q2)])

  return snap1.exists() || snap2.exists()
}

// Join normal matchmaking queue
export const joinQueue = async (userData) => {
  const inBattle = await isUserInBattle(userData.userId)
  if (inBattle) {
    console.log('Cannot join queue: user is already in a battle')
    return false
  }

  const queueRef = ref(realtimeDB, `matchmakingQueue/${userData.userId}`)
  const existing = await get(queueRef)
  if (existing.exists()) {
    console.log('User already in matchmaking queue')
    return false
  }

  await set(queueRef, {
    userId: userData.userId,
    userName: userData.username,
    synergy: userData.totalSynergy,
    inititalSynergy: userData.totalSynergy,
    joinedAt: Date.now(),
  })

  console.log('User added to matchmaking queue:', userData.userId)
  return true
}

export const leaveQueue = async (userId) => {
  // References for both queues
  const queueRef = ref(realtimeDB, `matchmakingQueue/${userId}`)
  const tutorialQueueRef = ref(realtimeDB, `tutorialQueue/${userId}`)

  try {
    // Check normal matchmaking queue
    const existing = await get(queueRef)
    if (existing.exists()) {
      await remove(queueRef)
      console.log('User removed from matchmaking queue:', userId)
      return true
    }

    // Check tutorial queue
    const tutorialExisting = await get(tutorialQueueRef)
    if (tutorialExisting.exists()) {
      await remove(tutorialQueueRef)
      console.log('User removed from tutorial queue:', userId)
      return true
    }

    console.log('User not in any queue:', userId)
    return false
  } catch (error) {
    console.error('Error removing user from queues:', error)
    return false
  }
}

// Join tutorial queue
export const joinTutorialQueue = async (userData) => {
  const inBattle = await isUserInBattle(userData.userId)
  if (inBattle) {
    console.log('Cannot join tutorial queue: user is already in a battle')
    return false
  }

  const queueRef = ref(realtimeDB, `tutorialQueue/${userData.userId}`)
  const existing = await get(queueRef)
  if (existing.exists()) {
    console.log('User already in tutorial queue')
    return false
  }

  await set(queueRef, {
    userId: userData.userId,
    userName: userData.username,
    synergy: userData.totalSynergy,
    initialSynergy: userData.totalSynergy,
    joinedAt: Date.now(),
  })

  console.log('User added to tutorial queue:', userData.userId)
  return true
}
