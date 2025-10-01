import React, { useState, useCallback, useMemo } from 'react'
import { triggerHapticFeedback } from '../../tournament/utils/haptic'
import CachedImage from '../../Shared/CachedImage'
import './style/dailymissions.style.css'

const DailyMission = ({ user }) => {
  const [lastAdAttemptTime, setLastAdAttemptTime] = useState(0)

  // Hardcoded offline social tasks
  const socialTasks = [
    {
      title: 'Follow Clash Warriors on X',
      link: 'https://twitter.com/Clash_Warriors_',
      logoUrl: '/assets/social/x.png',
      coins: 500000,
    },
    {
      title: 'Join our Telegram Channel',
      link: 'https://t.me/clash_warriors_announcement',
      logoUrl: '/assets/social/telegram.png',
      coins: 500000,
    },
    {
      title: 'Follow us on Instagram',
      link: 'https://www.instagram.com/clash_warriors_official/',
      logoUrl: '/assets/social/instagram.png',
      coins: 500000,
    },
  ]

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
      await show_9130916() // keep your ad call here

      // ✅ Reward logic after ad completes
      if (!user?.userId) return

      // Replace Firestore coins logic with local storage
      const currentCoins = parseInt(localStorage.getItem('coins') || '0', 10)
      const updatedCoins = currentCoins + 500000
      localStorage.setItem('coins', updatedCoins)

      triggerHapticFeedback()
      alert('🎉 You earned 5,00,000 coins!')
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
                style={{ paddingLeft: '10px' }}
              />
            )}
            <div className="daily-mission-social-text-container">
              <span
                className="daily-mission-social-title"
                style={{ margin: '0 auto' }}
              >
                {task.title}
              </span>
              <br />
              <span
                className="daily-mission-social-coins"
                style={{ margin: '0 auto' }}
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
