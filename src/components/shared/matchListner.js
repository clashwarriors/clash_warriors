import {
  ref,
  query,
  orderByChild,
  equalTo,
  onChildAdded,
  off,
} from 'firebase/database'
import { realtimeDB } from '../../firebase'

export const listenForMatch = (userId, navigate) => {
  const battlesRef = ref(realtimeDB, 'ongoingBattles')

  // listen if user is player1 or player2 in any new match
  const listener1 = onChildAdded(
    query(battlesRef, orderByChild('player1/userId'), equalTo(userId)),
    (snapshot) => {
      const battle = snapshot.val()
      console.log('Match found (as player1):', battle.matchId)
      navigate(`/battle/${battle.matchId}`, {
        state: { matchId: battle.matchId },
      })
      off(battlesRef) // stop listening
    }
  )

  const listener2 = onChildAdded(
    query(battlesRef, orderByChild('player2/userId'), equalTo(userId)),
    (snapshot) => {
      const battle = snapshot.val()
      console.log('Match found (as player2):', battle.matchId)
      navigate(`/battle/${battle.matchId}`, {
        state: { matchId: battle.matchId },
      })
      off(battlesRef) // stop listening
    }
  )

  return () => {
    off(battlesRef, 'child_added', listener1)
    off(battlesRef, 'child_added', listener2)
  }
}
