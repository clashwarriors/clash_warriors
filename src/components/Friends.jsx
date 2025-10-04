import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { firestoreDB } from '../firebase'
import './style/Friends.css'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import CachedImage from './Shared/CachedImage'
import { collection, onSnapshot } from 'firebase/firestore'

const Friends = React.memo(({ user }) => {
  const [invitedFriends, setInvitedFriends] = useState([])

  const referralLink = useMemo(() => {
    const backendUrl = import.meta.env.VITE_API_BASE_URL
    return user?.userId ? `${backendUrl}/invite/${user.userId}` : ''
  }, [user?.userId])

  const totalReferrals = invitedFriends.length

  useEffect(() => {
    if (!user?.userId) return

    // Reference to the "friends" subcollection under the user document
    const friendsColRef = collection(
      firestoreDB,
      `users/${user.userId}/friends`
    )

    // Listen for real-time updates
    const unsubscribe = onSnapshot(friendsColRef, (snapshot) => {
      if (snapshot.empty) {
        setInvitedFriends([])
        return
      }

      const friendNames = snapshot.docs.map((doc) => {
        const data = doc.data()
        return data.first_name && data.last_name
          ? `${data.first_name} ${data.last_name}`
          : 'Unknown User'
      })

      setInvitedFriends(friendNames)
    })

    return () => unsubscribe()
  }, [user?.userId])

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(referralLink)
    triggerHapticFeedback()
    alert('Referral link copied!')
  }, [referralLink])

  const shareOnTelegram = useCallback(() => {
    triggerHapticFeedback()
    const message = encodeURIComponent(
      `🔥 Start Clash Wars & Earn Rewards! 🎉\n\nUse my referral link: ${referralLink}`
    )
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${message}`
    window.open(telegramUrl, '_blank')
  }, [referralLink])

  const friendsList = useMemo(() => {
    const list = invitedFriends.length > 0 ? invitedFriends : ['Invite More']
    return list.map((friend, index) => (
      <div key={index} className="friend-item" style={{ paddingLeft: '30px' }}>
        {friend}
      </div>
    ))
  }, [invitedFriends])

  return (
    <div className="friends-page">
      <div className="friends-content">
        <div className="invite-box">
          <p>
            <strong>Total Referrals:</strong> {totalReferrals}
          </p>

          <div className="invite-section">
            <div className="invite-link">
              <span>{referralLink}</span>
            </div>

            <div className="invite-buttons">
              <div className="invite-button" onClick={copyToClipboard}>
                <CachedImage
                  src="/new/refer/smallBtn.png"
                  alt="Copy"
                  className="button-image"
                />
                <span className="button-text">Copy Link</span>
              </div>

              <div className="invite-button" onClick={shareOnTelegram}>
                <CachedImage
                  src="/new/refer/smallBtn.png"
                  alt="Telegram Share"
                  className="button-image"
                />
                <span className="button-text">Telegram Share</span>
              </div>
            </div>
          </div>
        </div>

        <div className="referral-list">
          <div className="friend-list" style={{ marginRight: '-10px' }}>
            {friendsList}
          </div>
        </div>
      </div>
    </div>
  )
})

export default Friends
