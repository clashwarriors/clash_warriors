import { ref, set, get, remove } from 'firebase/database'
import { realtimeDB } from '../../firebase'

export const joinQueue = async (userData) => {
  const queueRef = ref(realtimeDB, `matchmakingQueue/${userData.userId}`)

  // check if already in queue
  const existing = await get(queueRef)
  if (existing.exists()) {
    console.log('User already in matchmaking queue')
    return false
  }

  // add user to queue
  await set(queueRef, {
    userId: userData.userId,
    userName: userData.username,
    synergy: userData.totalSynergy,
    joinedAt: Date.now(),
  })

  console.log('User added to matchmaking queue:', userData.userId)
  return true
}

export const leaveQueue = async (userId) => {
  const queueRef = ref(realtimeDB, `matchmakingQueue/${userId}`)

  try {
    const existing = await get(queueRef)
    if (!existing.exists()) {
      console.log('User not in matchmaking queue:', userId)
      return false
    }

    await remove(queueRef)
    console.log('User removed from matchmaking queue:', userId)
    return true
  } catch (error) {
    console.error('Error removing user from matchmaking queue:', error)
    return false
  }
}
