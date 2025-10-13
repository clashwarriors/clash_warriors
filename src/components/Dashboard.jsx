import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import { useNavigate } from 'react-router-dom'
import './style/dashboard.style.css'
import { getUserData, storeUserData } from '../utils/indexedDBService'
import CachedImage from './shared/CachedImage'

const formatNumber = (num) => {
  if (num >= 1_000_000_000) return Math.floor(num / 1_000_000_000) + 'B'
  if (num >= 1_000_000) return Math.floor(num / 1_000_000) + 'M'
  if (num >= 1_000) return Math.floor(num / 1_000) + 'K'
  return num.toString()
}

const calculateLevel = (xp) => {
  if (xp <= 100) return 1
  if (xp <= 250) return 2
  if (xp <= 500) return 3
  if (xp <= 1000) return 4
  if (xp <= 2000) return 5
  return Math.floor(Math.log(xp) * 10)
}

const getProgressColor = (percentage) => {
  if (percentage <= 10) return '#ff0000'
  if (percentage <= 30) return '#ff6600'
  if (percentage <= 50) return '#ffcc00'
  if (percentage <= 70) return '#4caf50'
  if (percentage <= 90) return '#2196f3'
  return '#9c27b0'
}

const calculateProgress = (xp, level) => {
  const levels = [
    { min: 0, max: 100 },
    { min: 101, max: 250 },
    { min: 251, max: 500 },
    { min: 501, max: 1000 },
    { min: 1001, max: 2000 },
  ]
  const { min, max } = levels[level - 1] || { min: 2001, max: xp }
  return Math.min(((xp - min) / (max - min)) * 100, 100)
}

const calculateRank = (level) => {
  const ranks = [
    'Bronze I',
    'Bronze II',
    'Bronze III',
    'Silver I',
    'Silver II',
    'Silver III',
    'Gold I',
    'Gold II',
    'Gold III',
    'Platinum',
    'Emerald',
    'Sapphire',
    'Ruby',
    'Diamond',
    'Master',
    'Grandmaster',
    'Immortal',
  ]
  const levelsPerRank = 5
  return ranks[
    Math.min(Math.floor((level - 1) / levelsPerRank), ranks.length - 1)
  ]
}

const Dashboard = ({ user }) => {
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const userId = user.userId
  const [tapped, setTapped] = useState(0)
  const [coins, setCoins] = useState(0)
  const [taps, setTaps] = useState(10) // Maximum taps allowed
  const [coinAdd, setCoinAdd] = useState(10)
  const [isMatchmakingModalOpen, setIsMatchmakingModalOpen] = useState(false)
  const [showDeckErrorModal, setShowDeckErrorModal] = useState(false)

  const handleNavigation = useCallback(
    (path) => {
      triggerHapticFeedback()
      navigate(path)
    },
    [navigate]
  )

  useEffect(() => {
    const initData = async () => {
      const localUser = await getUserData()
      if (localUser) {
        setUserData(localUser)
        setTapped(localUser.tapped || 0) // Start from 0 taps if not available
        setCoins(localUser.coins || 0) // Default to 0 coins if not set
        setCoinAdd(localUser.coinAdd || 10) // Default coinAdd value if not set
        setTaps(localUser.taps || 10) // Fetch the max taps from IndexedDB, default to 10 if not set
      } else {
        console.error('No user data found in IndexedDB')
      }
    }
    initData()
  }, [])

  useEffect(() => {
    const resetDailyTaps = async () => {
      try {
        const localUser = await getUserData()
        if (!localUser) return

        const today = new Date().toDateString()
        const lastReset = localUser.lastReset || null

        // If the last reset is not today, reset taps
        if (lastReset !== today) {
          const updatedUser = {
            ...localUser,
            tapped: 0, // Reset tap count
            lastReset: today, // Update last reset date to today
          }
          await storeUserData(updatedUser)
          setUserData(updatedUser)
          setTapped(0) // Reset taps in state
          console.log('🔁 Daily tap reset completed.')
        } else {
          console.log('🔄 No reset needed today.')
        }
      } catch (error) {
        console.error('❌ Error during daily reset:', error)
      }
    }

    resetDailyTaps()
  }, []) // Empty dependency array to ensure this runs once when the component mounts

  const handleTap = useCallback(async () => {
    try {
      const today = new Date().toDateString()
      let localUser = await getUserData()

      if (!localUser) return

      // 🧠 Reset tapped count if it's a new day
      if (localUser.lastReset !== today) {
        localUser = {
          ...localUser,
          tapped: 0, // Reset tap count
          lastReset: today, // Update last reset date to today
        }
        await storeUserData(localUser)
        setTapped(0) // Reset taps in state
        setUserData(localUser)
        console.log('🔁 New day: tapped reset to 0')
      }

      // 🛑 Check if maximum taps have been reached
      if (localUser.tapped >= localUser.taps) {
        console.log('⛔ Maximum taps reached. User cannot tap anymore.')
        return // Prevent further taps if max taps are reached
      }

      // If not at max taps, increment tapped and coins
      const newTapped = localUser.tapped + 1
      const newCoins = (localUser.coins || 0) + coinAdd

      // Update state for taps and coins
      setTapped(newTapped)
      setCoins(newCoins)

      // Store updated user data
      const updatedUser = {
        ...localUser,
        tapped: newTapped,
        coins: newCoins,
      }
      await storeUserData(updatedUser)
      setUserData(updatedUser)

      // UI Feedback for tapping
      const tapButton = document.getElementById('tap-button')
      if (tapButton) {
        tapButton.classList.add('tap-active')
        setTimeout(() => tapButton.classList.remove('tap-active'), 100)
      }

      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50)
      window?.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')
      window?.webkit?.messageHandlers?.hapticFeedback?.postMessage({
        type: 'medium',
      })
    } catch (error) {
      console.error('❌ Error during tap handling:', error)
    }
  }, [coinAdd])

  useEffect(() => {
    const fetchCoins = async () => {
      const localUser = await getUserData()
      if (localUser) {
        setCoins(localUser.coins) // Always fetch the latest coins value from IndexedDB
      }
    }

    fetchCoins()
  }, [userData])

  useEffect(() => {
    if (!navigator.onLine || !userData?.pph) return

    const coinsPerSecond = Math.floor(userData.pph / 3600)
    if (coinsPerSecond < 1) return // Skip if pph is too low

    const interval = setInterval(async () => {
      setCoins((prev) => {
        const updated = prev + coinsPerSecond

        const updatedUserData = {
          ...userData,
          coins: updated,
        }

        // Store in IndexedDB
        storeUserData(updatedUserData)

        // ✅ Update state to trigger re-render
        setUserData(updatedUserData)

        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [userData])

  const {
    xp,
    level,
    progress,
    progressColor,
    formattedPPH,
    userRank,
    formattedCoins,
  } = useMemo(() => {
    const xp = userData?.xp || 0
    const level = calculateLevel(xp)
    const progress = calculateProgress(xp, level)
    const progressColor = getProgressColor(progress)
    const formattedPPH = formatNumber(userData?.pph || 0)
    const formattedCoins = formatNumber(userData?.coins || 0)
    const userRank = calculateRank(level)
    return {
      xp,
      level,
      progress,
      progressColor,
      formattedPPH,
      userRank,
      formattedCoins,
    }
  }, [userData])

  return (
    <div className="new-homescreen-scroll-wrapper">
      <div className="new-homescreen">
        <div className="rain-layer" id="rain-layer"></div>

        <div className="new-homescreen-mist-container">
          <div className="mist-patch"></div>
          <div className="mist-patch"></div>
          <div className="mist-patch"></div>
          <div className="mist-patch"></div>
          <div className="mist-patch"></div>
        </div>

        <div className="new-homescreen-top-header">
          <div className="new-homescreen-username-container">
            <CachedImage
              src="/new/usernameframe.png"
              alt="Username Frame"
              className="new-homescreen-username-frame"
            />
            <div className="new-homescreen-username-textbox">
              <span className="new-homescreen-username-text">
                {user.username}
              </span>
            </div>
          </div>
        </div>

        <div className="new-homescreen-header">
          <div className="new-homescreen-header-left">
            <div className="new-homescreen-photo-frame">
              <img
                src={user.photo_url}
                alt="User Avatar"
                className="new-homescreen-user-img"
              />
              <CachedImage
                src="/new/photoframe.png"
                alt="Frame"
                className="new-homescreen-frame-img"
              />
            </div>
          </div>

          <div className="new-homescreen-header-right">
            <div className="new-homescreen-header-background">
              <div className="new-homescreen-header-lines">
                <div className="new-homescreen-header-left-side">
                  <div className="new-homescreen-header-item">
                    <CachedImage
                      src="/new/leaderboard.png"
                      alt="Level Icon"
                      className="new-homescreen-header-icon"
                    />
                    <span>Level: {level}</span>
                  </div>
                  <div className="new-homescreen-header-item">
                    <CachedImage
                      src="/new/league.png"
                      alt="League Icon"
                      className="new-homescreen-header-icon"
                    />
                    <span>{userRank}</span>
                  </div>
                </div>

                <div className="new-homescreen-header-right-side">
                  <div className="new-homescreen-header-item">
                    <CachedImage
                      src="/new/coins.png"
                      alt="Coins Icon"
                      className="new-homescreen-header-icon"
                    />
                    <span>{formattedCoins}</span>
                  </div>
                  <div className="new-homescreen-header-item">
                    <CachedImage
                      src="/new/light.png"
                      alt="PPH Icon"
                      className="new-homescreen-header-icon"
                    />
                    <span>{formattedPPH} / Hr</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="new-homescreen-daily-section">
          <CachedImage
            src="/new/daily-rewards.png"
            alt="Daily Rewards"
            className="new-homescreen-daily-icon"
            onClick={() => handleNavigation('/daily-rewards')}
          />
          <CachedImage
            src="/new/daily-missions.png"
            alt="Daily Missions"
            className="new-homescreen-daily-icon"
            onClick={() => handleNavigation('/daily-missions')}
          />
          <CachedImage
            src="/new/daily-battle.png"
            alt="Daily Battle"
            className="new-homescreen-daily-icon"
          />
        </div>

        {/* Summoning Section */}
        <div className="new-homescreen-summoning-wrapper">
          {/* Summoning Circle */}
          <div className="new-homescreen-summoning-circle">
            <div className="new-homescreen-ring-outer"></div>
            <div className="new-homescreen-ring-dashed"></div>
            <div className="new-homescreen-ring-inner"></div>
            <CachedImage
              src="/new/circle.png"
              className="new-homescreen-summoning-circle-img"
              alt="Summon Ring"
            />
          </div>

          {/* Character */}
          <div className="new-homescreen-character-wrapper">
            <CachedImage
              src="/new/frostguard.png"
              className="new-homescreen-character-img"
              alt="Character"
              onPointerDown={handleTap}
            />
          </div>
        </div>
      </div>

      {isMatchmakingModalOpen && (
        <div className="tournamentHome-modal">
          <div className="tournamentHome-modal-content">
            <CachedImage
              src="/new/tournament/cancel2.png"
              className="tournamentHome-cancel-button"
            />
          </div>
        </div>
      )}

      {showDeckErrorModal && (
        <div
          className="deck-error-modal-overlay"
          onClick={() => setShowDeckErrorModal(false)} // ⬅️ close when background clicked
        >
          <div
            className="deck-error-modal-content"
            onClick={(e) => e.stopPropagation()} // ⛔ prevent closing when modal content is clicked
          >
            <CachedImage
              onClick={noCardsError}
              src="/new/tournament/builddeckBtn.png"
              alt="OK"
              style={{ cursor: 'pointer' }}
              className="deck-error-modal-button"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
