import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { initSocket, disconnectSocket } from '../../socketConfig'

const MatchListner = ({ user }) => {
  const navigate = useNavigate()

  useEffect(() => {
    if (!user?.userId) return

    const socket = initSocket(user.userId, (match) => {
      console.log('Match received in MatchLister:', match)
      navigate(`/battle/${match.matchId}`)
    })

    return () => disconnectSocket()
  }, [user, navigate])

  return <div>Listening for matches...</div>
}

export default MatchListner
