import React, { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { ref, set, remove, onValue, get } from 'firebase/database'
import { realtimeDB } from '../firebase'
import DefaultDeckModal from './tournament/DefaultDeckModal'
import './tournament/style/tournament.style.css'
import {
  getFrames,
  saveAllFramesToIndexedDB,
  countStoredFrames,
  loadFramesIntoMemory,
} from './tournament/utils/indexedDBHelper'
import { triggerHapticFeedback } from './tournament/utils/haptic'

const Tournament = ({ user }) => {
  // eslint-disable-next-line no-unused-vars
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMatchmaking, setIsMatchmaking] = useState(false)
  const [isMatchmakingModalOpen, setIsMatchmakingModalOpen] = useState(false)
  // eslint-disable-next-line no-unused-vars
  const [totalDeckSynergy, setTotalDeckSynergy] = useState(0)
  const [hasNavigated, setHasNavigated] = useState(false)
  const [canStartDailyBattle, setCanStartDailyBattle] = useState(false)
  const [isPreloading, setIsPreloading] = useState(true)
  const [framesLoaded, setFramesLoaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const [framesExist, setFramesExist] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const [showDeckErrorModal, setShowDeckErrorModal] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [showTutorial, setShowTutorial] = useState(false)
  // const [soundEnabled, setSoundEnabled] = useState(
  //   JSON.parse(localStorage.getItem('soundEnabled')) ?? true
  // )

  const navigate = useNavigate()

  useEffect(() => {
    if (user?.userId) {
      setLoading(true)

      const userRef = ref(realtimeDB, `users/${user.userId}`)

      get(userRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            setUserData(snapshot.val())
          } else {
            console.warn('⚠️ User data not found in Firebase')
            setUserData(null)
          }
        })
        .catch((err) => {
          console.error('❌ Error fetching user details:', err)
          setError('Failed to fetch user details')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [user])

  useEffect(() => {
    if (!user?.userId) return

    const gameRef = ref(realtimeDB, 'currentGames')

    const unsubscribe = onValue(gameRef, (snapshot) => {
      if (!snapshot.exists()) return

      const games = snapshot.val()
      for (let matchID in games) {
        const matchData = games[matchID]
        if (!matchData) continue

        const { player1, player2, matchStatus } = matchData

        if (
          (matchStatus === 'cooldown' || matchStatus === 'in-progress') &&
          (player1?.id === user.userId || player2?.id === user.userId) &&
          !hasNavigated
        ) {
          console.log(`✅ Match found! Redirecting to: /battle/${matchID}`)
          setHasNavigated(true)
          navigate(`/battle/${matchID}`, { state: { matchID } })
          return
        }
      }
    })

    return () => unsubscribe()
  }, [user, navigate, hasNavigated])

  const handleMatchmaking = async (isDailyBattle = false) => {
    triggerHapticFeedback()
    try {
      // ✅ Fetch user details from Firebase
      const userRef = ref(realtimeDB, `users/${user.userId}`)
      const userSnapshot = await get(userRef)

      if (!userSnapshot.exists()) {
        console.log('❌ User not found in Firebase.')
        return
      }

      const userDetails = userSnapshot.val()

      // ✅ Fetch user's cards from Firebase
      const cardsRef = ref(realtimeDB, `users/${user.userId}/cards`)
      const cardsSnapshot = await get(cardsRef)

      if (!cardsSnapshot.exists()) {
        console.log('❌ No cards found.')
        return
      }

      const allCards = cardsSnapshot.val()
      const defaultDeck = Object.values(allCards).filter(
        (card) => card.defaultDeck === true
      )

      if (defaultDeck.length < 7) {
        setShowDeckErrorModal(true)
        return
      }

      // ✅ Add to matchmaking queue
      const matchmakingRef = ref(realtimeDB, `matchmakingQueue/${user.userId}`)
      await set(matchmakingRef, {
        inQueue: true,
        totalSynergy: userDetails?.totalSynergy || 0, // Optional to keep for now
        rating: userDetails?.rating || 1000,
        isDailyBattle,
      })

      if (isDailyBattle) {
        const todayDate = new Date().toISOString().split('T')[0]
        const dailyBattleRef = ref(
          realtimeDB,
          `users/${user.userId}/dailyBattleDate`
        )
        await set(dailyBattleRef, todayDate)
      }

      setIsMatchmaking(true)
      setIsMatchmakingModalOpen(true)
      console.log(
        `✅ Matchmaking started! (${isDailyBattle ? 'Daily Battle' : 'Regular Battle'})`
      )
    } catch (error) {
      console.error('❌ Error during matchmaking:', error)
    }
  }

  const handleCancelMatchmaking = () => {
    setIsMatchmaking(false)
    setIsMatchmakingModalOpen(false)
    triggerHapticFeedback()

    const matchmakingRef = ref(realtimeDB, `matchmakingQueue/${user.userId}`)
    remove(matchmakingRef).catch((error) => {
      console.error('Error removing from matchmaking queue:', error)
      setIsMatchmaking(true)
    })
  }

  useEffect(() => {
    if (!user?.userId) return

    const dailyBattleRef = ref(
      realtimeDB,
      `users/${user.userId}/dailyBattleDate`
    )

    const unsubscribe = onValue(dailyBattleRef, (snapshot) => {
      const lastBattleDate = snapshot.val()
      const todayDate = new Date().toISOString().split('T')[0] // Format YYYY-MM-DD

      if (!lastBattleDate || lastBattleDate !== todayDate) {
        setCanStartDailyBattle(true) // Show button if no battle today
      } else {
        setCanStartDailyBattle(false) // Hide button if battle already done
      }
    })

    return () => unsubscribe() // Cleanup listener on unmount
  }, [user])

  // Audios

  const saveMultipleAudiosToLocalStorage = async (audioFiles) => {
    for (const { key, url } of audioFiles) {
      console.log(`Fetching ${url} from public directory...`)

      try {
        const response = await fetch(url)
        if (!response.ok)
          throw new Error(
            `Failed to fetch ${url}: ${response.status} ${response.statusText}`
          )

        const blob = await response.blob()
        console.log(`${url} fetched successfully, converting to Base64...`)

        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onloadend = () => {
          localStorage.setItem(key, reader.result) // Store with unique key
          console.log(`${url} saved to LocalStorage as ${key}!`)
        }
      } catch (error) {
        console.error(`Error saving ${url}:`, error)
      }
    }
  }

  const audioFiles = [
    { key: 'gameAttackMusic', url: '/attackMusic.mp3' },
    { key: 'gameDropSound', url: '/dropSound.mp3' },
  ]

  audioFiles.forEach(({ key, url }) => {
    if (!localStorage.getItem(key)) {
      saveMultipleAudiosToLocalStorage([{ key, url }]) // Pass as array
    }
  })

  // Save all frames to IndexedDB

  useEffect(() => {
    const checkAndLoadFrames = async () => {
      console.log('⏳ Checking frames in IndexedDB...')

      // Step 1: Count stored frames
      const ltrCount = await countStoredFrames('ltr', 165)
      const rtlCount = await countStoredFrames('rtl', 165)
      const dropSeqCount = await countStoredFrames('dropSeq', 60)

      const localSavedFrames = ltrCount + rtlCount + dropSeqCount
      setProgress((prev) =>
        prev !== localSavedFrames ? localSavedFrames : prev
      ) // Update only if changed

      if (localSavedFrames >= 390) {
        console.log('✅ All frames are stored in IndexedDB.')

        if (!framesExist) {
          setFramesExist(true) // Update only if needed
        }

        // Step 2: Check if frames are in memory
        await preloadAndLoadFrames()
      } else {
        console.warn(
          `⚠️ ${390 - localSavedFrames} frames missing! Click "Download Frames" to start.`
        )
      }

      setIsPreloading(false)
    }

    checkAndLoadFrames()
  }, [])

  const handleDownload = async () => {
    setLoading(true)
    await saveAllFramesToIndexedDB(setProgress) // Download frames

    // Step 3: Re-check frame count after download
    const ltrCount = await countStoredFrames('ltr', 165)
    const rtlCount = await countStoredFrames('rtl', 165)
    const dropSeqCount = await countStoredFrames('dropSeq', 60)
    const totalSavedFrames = ltrCount + rtlCount + dropSeqCount

    setProgress(totalSavedFrames) // Update progress
    if (totalSavedFrames >= 390) {
      setFramesExist(true) // Hide button only after all frames are saved
    }

    // Step 4: Preload and load frames into memory after download
    await preloadAndLoadFrames()

    setLoading(false)
  }

  // ✅ Function to preload and load frames into memory after download
  const preloadAndLoadFrames = async () => {
    console.log('⏳ Preloading frames into memory...')

    const ltrFrames = getFrames('ltr')
    const rtlFrames = getFrames('rtl')
    const dropSeqFrames = getFrames('dropSeq')

    if (
      ltrFrames.length > 0 &&
      rtlFrames.length > 0 &&
      dropSeqFrames.length > 0
    ) {
      console.log('✅ Frames are already in memory.')
      setFramesLoaded(true)
    } else {
      console.warn('⚠️ Frames missing in memory! Loading into memory...')
      await loadFramesIntoMemory('ltr')
      await loadFramesIntoMemory('rtl')
      await loadFramesIntoMemory('dropSeq')
      setFramesLoaded(true)
    }
  }

  const handleOpenModal = () => {
    setIsModalOpen(true)
    triggerHapticFeedback()
  }

  const handleBack = () => {
    navigate('/')
    triggerHapticFeedback()
  }

  useEffect(() => {
    const usersRef = ref(realtimeDB, 'users')

    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (!snapshot.exists()) {
        setOnlineCount(0)
        return
      }

      const users = snapshot.val()
      const onlineUsers = Object.values(users).filter(
        (user) => user.status === 'online'
      )

      setOnlineCount(onlineUsers.length)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const tutorialDone = localStorage.getItem('TournamentTutorial')
    if (!tutorialDone) {
      setShowTutorial(true)
    }
  }, [])

  const nextStep = () => {
    if (tutorialStep < 5) {
      setTutorialStep(tutorialStep + 1)
    } else {
      localStorage.setItem('TournamentTutorial', 'true')
      setShowTutorial(false)
    }
  }

  const noCardsError = () => {
    triggerHapticFeedback()
    setShowDeckErrorModal(false)
    navigate('/builddeck')
  }

  // const handleToggleSound = () => {
  //   const newSoundState = !soundEnabled
  //   setSoundEnabled(newSoundState)
  //   localStorage.setItem('soundEnabled', JSON.stringify(newSoundState)) // Save the preference to localStorage
  // }

  if (error) return <h2></h2>

  return (
    <div
      className={`tournamentHome-container ${showTutorial ? 'tutorial-active' : ''}`}
    >
      <div className="tournamentHome-header">
        <button className="tournamentHome-back-button" onClick={handleBack}>
          Back
        </button>
      </div>

      {showTutorial && <div className="tutorial-overlay"></div>}

      {/* Step 1: Highlight Users Online */}
      <h2
        className={`users-online ${showTutorial && tutorialStep === 0 ? 'highlight' : ''}`}
      >
        {onlineCount} <br /> Users Online
      </h2>
      {showTutorial && tutorialStep === 0 && (
        <p className="tutorial-text">This shows how many users are online.</p>
      )}

      <div className="tournamentHome-matchmaking-container">
        {/* Step 2: Highlight Daily Battle */}
        {canStartDailyBattle && (
          <button
            className={`tournamentHome-main-button ${showTutorial && tutorialStep === 1 ? 'highlight' : ''}`}
            onClick={() => handleMatchmaking(true)}
            disabled={isMatchmaking || loading}
          >
            Daily Battle
          </button>
        )}
        {showTutorial && tutorialStep === 1 && (
          <p className="tutorial-text">
            Click here to start your daily battle.
          </p>
        )}

        {/* Step 3: Highlight Start Battle */}
        <button
          className={`tournamentHome-main-button ${showTutorial && tutorialStep === 2 ? 'highlight' : ''}`}
          onClick={() => handleMatchmaking(false)}
          disabled={isMatchmaking || loading}
        >
          Start Battle
        </button>
        {showTutorial && tutorialStep === 2 && (
          <p className="tutorial-text">Click here for a regular battle.</p>
        )}

        {/* Step 4: Highlight My Deck */}
        <button
          className={`tournamentHome-main-button ${showTutorial && tutorialStep === 3 ? 'highlight' : ''}`}
          onClick={handleOpenModal}
        >
          My Deck
        </button>
        {showTutorial && tutorialStep === 3 && (
          <p className="tutorial-text">Click here to manage your deck.</p>
        )}

        {showTutorial && (
          <div className="tutorial-navigation">
            <button onClick={nextStep} className="tour-tt-next-btn">
              {tutorialStep < 5 ? 'Next →' : 'Finish'}
            </button>
          </div>
        )}

        {showDeckErrorModal && (
          <div className="deck-error-modal-overlay">
            <div className="deck-error-modal-content">
              <h3>Not Enough Cards</h3>
              <p>You need at least 7 cards in your deck to start a battle.</p>
              <button onClick={noCardsError}>Build Deck</button>
            </div>
          </div>
        )}

        {!framesExist && (
          <div>
            <button
              onClick={handleDownload}
              style={{ padding: '10px', fontSize: '16px' }}
              className={`tournamentHome-main-button ${showTutorial && tutorialStep === 4 ? 'highlight' : ''}`}
            >
              {'Download Assets'}
            </button>
            {showTutorial && tutorialStep === 4 && (
              <p className="tutorial-text">
                Click Here to Download Your Game Assets
              </p>
            )}
            <p>📥 {Math.round((progress / 390) * 100)}% Downloaded</p>
            {showTutorial && tutorialStep === 5 && (
              <p className="tutorial-text">
                This shows the download progress of your game assets. Make sure
                to complete it for a smooth experience!
              </p>
            )}
          </div>
        )}
      </div>

      {/* <div className="sound-toggle-container">
        <label className="sound-toggle-label">
          Sound Effects
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={handleToggleSound}
            className="sound-toggle-input"
          />
          <span className="sound-toggle-slider"></span>
        </label>
      </div> */}

      <DefaultDeckModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={user}
      />
      {isMatchmakingModalOpen && (
        <div className="tournamentHome-modal">
          <div className="tournamentHome-modal-content">
            <h2>🔍 Searching for a Match...</h2>
            <p>Please wait while we find an opponent.</p>
            <button
              className="tournamentHome-cancel-button"
              onClick={handleCancelMatchmaking}
            >
              ❌ Cancel Matchmaking
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Tournament
