import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { firestoreDB } from '../../../firebase'
import { triggerHapticFeedback } from '../../tournament/utils/haptic'
import CachedImage from '../../Shared/CachedImage'
import './style/dailymissions.style.css'
import { doc, getDoc } from 'firebase/firestore'

const DailyMission = ({ user }) => {
  const [socialTasks, setSocialTasks] = useState([])
  const [lastAdAttemptTime, setLastAdAttemptTime] = useState(0)

  const fetchSocialTasks = useCallback(async () => {
    try {
      const docRef = doc(firestoreDB, 'social', 'socialPages')
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        const tasksArray = Object.values(data)

        setSocialTasks(tasksArray)
      } else {
        console.warn('❌ No socialPages document found in Firestore.')
      }
    } catch (error) {
      console.error('❌ Error fetching social tasks from Firestore:', error)
    }
  }, [])

  useEffect(() => {
    fetchSocialTasks()
  }, [fetchSocialTasks])

  const handleAdClick = useCallback(async () => {
    const now = Date.now()
    const secondsSinceLast = (now - lastAdAttemptTime) / 1000

    if (secondsSinceLast < 10) {
      alert(
        `⏳ Wait ${Math.ceil(10 - secondsSinceLast)}s before watching again`
      )
      return
    }

    setLastAdAttemptTime(now)

    try {
      // Monetag Rewarded Interstitial Call
      await show_9130916()

      // ✅ Reward logic after ad completes
      if (!user?.userId) return

      const coinsRef = ref(firestoreDB, `users/${user.userId}/coins`)
      const snapshot = await get(coinsRef)
      const currentCoins = snapshot.exists() ? snapshot.val() : 0
      const updatedCoins = currentCoins + 10000
      await set(coinsRef, updatedCoins)

      triggerHapticFeedback()
      alert('🎉 You earned 10,000 coins!')
    } catch (error) {
      console.error('❌ Ad failed or user skipped:', error)
    }
  }, [lastAdAttemptTime, user?.userId])

  const renderSocialTasks = useMemo(
    () =>
      socialTasks.map((task, index) => (
        <li
          key={index}
          className="daily-mission-social-item"
          onClick={triggerHapticFeedback}
        >
          <a
            href={task.link}
            target="_blank"
            rel="noopener noreferrer"
            className="daily-mission-social-card"
          >
            {task.logoUrl && (
              <img
                src={task.logoUrl}
                alt={task.title}
                className="daily-mission-social-logo"
                style={{
                  paddingLeft: '10px',
                }}
              />
            )}
            <div className="daily-mission-social-text-container">
              <span
                className="daily-mission-social-title"
                style={{
                  margin: '0 auto',
                }}
              >
                {task.title}
              </span>
              <br />
              <span
                className="daily-mission-social-coins"
                style={{
                  margin: '0 auto',
                }}
              >
                💰 {task.coins} Coins
              </span>
            </div>
          </a>
        </li>
      )),
    [socialTasks]
  )

  const adCooldown = (Date.now() - lastAdAttemptTime) / 1000 < 10

  return (
    <div className="daily-mission-container">
      <div className="daily-mission-header">
        <CachedImage
          src="/new/refer/daily-mission-plate.png"
          alt="Header"
          className="daily-mission-plate"
        />
      </div>

      <div className="daily-mission-image-section">
        <div className="daily-mission-image-wrapper">
          <CachedImage
            src="/new/refer/watchearn.png"
            alt="Watch Ad"
            onClick={handleAdClick}
            className={`daily-mission-ad-image ${adCooldown ? 'cooldown' : ''}`}
          />
        </div>

      </div>

      <div className="daily-mission-social-section">
        <h3 className="daily-mission-subtitle">Follow, Subscribe, Earn!</h3>
        <ul className="daily-mission-social-list">{renderSocialTasks}</ul>
      </div>
    </div>
  )
}

export default React.memo(DailyMission)
