import React, { useState, useEffect, useCallback, useMemo } from 'react'
import confetti from 'canvas-confetti'
import './style/dailyRewards.style.css'
import CachedImage from '../../shared/CachedImage'
import { getUserData, storeUserData } from '../../../utils/indexedDBService'
import { syncUser } from '../../../utils/firebaseSyncService'

const getLocalDateString = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDateLocal = (dateStr) => {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const DailyRewards = React.memo(({ user }) => {
  const [streak, setStreak] = useState(0)
  const [claimedToday, setClaimedToday] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showSparkle, setShowSparkle] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

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

  const fetchStreak = useCallback(async () => {
    if (!user?.userId) return

    const todayStr = getLocalDateString()

    try {
      const userData = await getUserData()
      const data = userData || {
        userId: user.userId,
        streak: 0,
        lastClaimed: '',
        coins: 0,
      }

      if (!data.lastClaimed) {
        await storeUserData(data)
        setStreak(0)
        setClaimedToday(false)
        setLoading(false)
        return
      }

      const lastDateObj = parseDateLocal(data.lastClaimed)
      const todayDateObj = parseDateLocal(todayStr)

      const diffTime = todayDateObj - lastDateObj
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        setClaimedToday(true)
        setStreak(data.streak)
      } else if (diffDays === 1) {
        setClaimedToday(false)
        setStreak(data.streak)
      } else {
        const resetData = { ...data, streak: 0 }
        await storeUserData(resetData)
        setStreak(0)
        setClaimedToday(false)
      }
    } catch (err) {
      console.error('❌ Error fetching streak:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.userId])

  const triggerConfetti = useCallback(() => {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
  }, [])

  const handleClaim = useCallback(async () => {
    if (!user?.userId || claimedToday) return

    const todayStr = getLocalDateString()

    try {
      const userData = await getUserData()
      const data = userData || {
        userId: user.userId,
        streak: 0,
        lastClaimed: '',
        coins: 0,
      }

      const lastDateObj = parseDateLocal(data.lastClaimed)
      const todayDateObj = parseDateLocal(todayStr)
      let currentStreak = data.streak || 0

      if (lastDateObj) {
        const diffTime = todayDateObj - lastDateObj
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays > 1) {
          currentStreak = 0
        }
      }

      const newStreak = currentStreak + 1
      const currentCoins = data.coins || 0

      let rewardIndex = Math.min(newStreak - 1, 6)
      if (rewardIndex < 0) rewardIndex = 0

      let reward = rewardsByDay[rewardIndex]

      const isDay7 = newStreak === 7

      if (isDay7) {
        setShowBanner(true)
        setTimeout(() => setShowBanner(false), 3000)
      }

      const updatedUserData = {
        ...data,
        coins: currentCoins + reward,
        streak: isDay7 ? 0 : newStreak,
        lastClaimed: todayStr,
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

  const getRandomPosition = useCallback(() => {
    const x = Math.floor(Math.random() * 80) + 10
    const y = Math.floor(Math.random() * 80) + 10
    return { top: `${y}%`, left: `${x}%`, transform: 'translate(-50%, -50%)' }
  }, [])

  useEffect(() => {
    fetchStreak()
  }, [fetchStreak])

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
              const displayIndex = index

              const isActive = !claimedToday && streak === displayIndex

              const isClaimed =
                (claimedToday && displayIndex < streak) ||
                (!claimedToday && displayIndex < streak)

              const isFaded =
                displayIndex > streak ||
                (isActive === false && isClaimed === false)

              let className = 'dailyRewards-dayImage '
              if (index === 6) className += 'day7-image '

              if (isActive) className += 'active'
              else if (isClaimed) className += 'claimed'
              else className += 'faded'

              const handleClick = () => {
                if (isActive) handleClaim()
              }

              return (
                <div
                  key={index}
                  className={`dailyRewards-dayWrapper ${index === 6 ? 'day7-wrapper' : ''}`}
                >
                  <CachedImage
                    src={src}
                    alt={`Day ${index + 1}`}
                    className={className}
                    onClick={handleClick}
                    style={{ cursor: isActive ? 'pointer' : 'default' }}
                    onAnimationEnd={() => setShowSparkle(false)}
                  />

                  {index === 6 && showBanner && (
                    <CachedImage
                      src="/new/rewards/coinCollectBg.png"
                      alt="Mystery Box Banner"
                      className="day7-banner-image"
                    />
                  )}

                  {isClaimed && showSparkle && streak - 1 === index && (
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
