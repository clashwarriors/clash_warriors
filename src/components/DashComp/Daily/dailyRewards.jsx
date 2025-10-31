import React, { useState, useEffect, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import './style/dailyRewards.style.css'
import CachedImage from '../../Shared/CachedImage'
import { getUserData, storeUserData } from '../../../utils/indexedDBService'
import { syncUser } from '../../../utils/firebaseSyncService'

// ✅ Helper: get local date string (timezone-safe)
const getLocalDateString = () => {
  const now = new Date()
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return local.toISOString().split('T')[0]
}

const DailyRewards = React.memo(({ user }) => {
  const [streak, setStreak] = useState(0)
  const [claimedToday, setClaimedToday] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showSparkle, setShowSparkle] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  // ----------------------
  // Reward config
  // ----------------------
  const dayImages = useMemo(
    () => [
      '/new/rewards/day1.png',
      '/new/rewards/day2.png',
      '/new/rewards/day3.png',
      '/new/rewards/day4.png',
      '/new/rewards/day5.png',
      '/new/rewards/day6.png',
      '/new/rewards/day7.png',
    ],
    []
  )

  const rewardsByDay = useMemo(
    () => [7500, 12500, 20000, 30000, 50000, 75000, 100000],
    []
  )

  // ----------------------
  // Fetch streak from IndexedDB
  // ----------------------
  const fetchStreak = useCallback(async () => {
    if (!user?.userId) return

    const today = getLocalDateString()

    try {
      const userData = await getUserData()
      const data = userData || {
        userId: user.userId,
        streak: 0,
        lastClaimed: '',
        coins: 0,
      }

      if (data.lastClaimed) {
        const lastDate = new Date(data.lastClaimed)
        const lastLocal = new Date(
          lastDate.getFullYear(),
          lastDate.getMonth(),
          lastDate.getDate()
        )
        const todayLocal = new Date()
        const diffDays = Math.floor(
          (todayLocal - lastLocal) / (1000 * 60 * 60 * 24)
        )

        if (data.lastClaimed === today) {
          setClaimedToday(true)
          setStreak(data.streak)
        } else if (diffDays === 1) {
          setClaimedToday(false)
          setStreak(data.streak)
        } else {
          // Missed day → reset streak
          data.streak = 0
          data.lastClaimed = ''
          await storeUserData(data)
          setStreak(0)
          setClaimedToday(false)
        }
      } else {
        await storeUserData(data)
        setStreak(0)
        setClaimedToday(false)
      }
    } catch (err) {
      console.error('❌ Error fetching streak:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.userId])

  // ----------------------
  // Confetti trigger
  // ----------------------
  const triggerConfetti = useCallback(() => {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
  }, [])

  // ----------------------
  // Claim reward handler
  // ----------------------
  const handleClaim = useCallback(async () => {
    if (!user?.userId || claimedToday) return

    const today = getLocalDateString()

    try {
      const userData = await getUserData()
      const data = userData || {
        userId: user.userId,
        streak: 0,
        lastClaimed: '',
        coins: 0,
      }

      const currentStreak = data.streak || 0
      const newStreak = currentStreak + 1
      const currentCoins = data.coins || 0

      // Determine reward for current day
      let reward = rewardsByDay[Math.min(currentStreak, 6)]
      const isDay7 = currentStreak === 6

      if (isDay7) {
        setShowBanner(true)
        setTimeout(() => setShowBanner(false), 3000)
      }

      const updatedUserData = {
        ...data,
        coins: currentCoins + reward,
        streak: isDay7 ? 0 : newStreak,
        lastClaimed: today,
        totalStreaks: isDay7
          ? (data.totalStreaks || 0) + 1
          : data.totalStreaks || 0,
      }

      // Local store + sync
      await storeUserData(updatedUserData)
      syncUser(updatedUserData)

      // UI updates
      triggerConfetti()
      setClaimedToday(true)
      setShowSparkle(true)
      setStreak(updatedUserData.streak)
    } catch (err) {
      console.error('❌ Error claiming reward:', err)
    }
  }, [user?.userId, claimedToday, rewardsByDay, triggerConfetti])

  // ----------------------
  // Sparkle positions
  // ----------------------
  const getRandomPosition = useCallback(() => {
    const x = Math.floor(Math.random() * 80) + 10
    const y = Math.floor(Math.random() * 80) + 10
    return { top: `${y}%`, left: `${x}%`, transform: 'translate(-50%, -50%)' }
  }, [])

  // ----------------------
  // Init
  // ----------------------
  useEffect(() => {
    fetchStreak()
  }, [fetchStreak])

  // ----------------------
  // Render
  // ----------------------
  return (
    <div className="dailyRewards-background">
      {loading ? (
        <p className="dailyRewards-loading">Loading rewards...</p>
      ) : (
        <>
          <div className="dailyRewards-title">
            <CachedImage
              src="/new/rewards/daily-rewards-plate.png"
              alt="Daily Rewards"
              className="dailyRewards-titleImage"
            />
          </div>

          <div className="dailyRewards-grid">
            {dayImages.map((src, index) => {
              const isActive = !claimedToday && streak === index
              const isClaimed = claimedToday && streak - 1 === index
              const isFaded = index < streak
              const isDay7 = index === 6

              const handleClick = () => {
                if (isActive) handleClaim()
              }

              return (
                <div
                  key={index}
                  className={`dailyRewards-dayWrapper ${isDay7 ? 'day7-wrapper' : ''}`}
                >
                  <CachedImage
                    src={src}
                    alt={`Day ${index + 1}`}
                    className={`dailyRewards-dayImage ${isDay7 ? 'day7-image' : ''} ${isFaded ? 'faded' : ''} ${isActive ? 'active' : ''} ${isClaimed ? 'claimed' : ''}`}
                    onClick={handleClick}
                    style={{ cursor: isActive ? 'pointer' : 'default' }}
                    onAnimationEnd={() => setShowSparkle(false)}
                  />

                  {isDay7 && showBanner && (
                    <CachedImage
                      src="/new/rewards/coinCollectBg.png"
                      alt="Mystery Box Banner"
                      className="day7-banner-image"
                    />
                  )}

                  {isClaimed && showSparkle && (
                    <div className="sparkleOverlay" style={getRandomPosition()}>
                      ✨
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
})

export default DailyRewards
