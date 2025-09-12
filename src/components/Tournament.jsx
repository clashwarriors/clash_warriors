import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { realtimeDB } from '../firebase'
import {
  ref,
  query,
  orderByChild,
  equalTo,
  onChildAdded,
  off,
  onValue,
  get,
} from 'firebase/database'
import DefaultDeckModal from './tournament/DefaultDeckModal'
import './tournament/style/tournament.style.css'
import {
  getFrames,
  saveAllFramesToIndexedDB,
  countStoredFrames,
  loadFramesIntoMemory,
} from './tournament/utils/indexedDBHelper'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import CachedImage from './Shared/CachedImage'
import { getAllCardsByRarity } from '../utils/cardsStorer'
import { getUserData } from '../utils/indexedDBService'

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
  // const [onlineCount, setOnlineCount] = useState(0)
  const [showDeckErrorModal, setShowDeckErrorModal] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [showTutorial, setShowTutorial] = useState(false)
  // const [soundEnabled, setSoundEnabled] = useState(
  //   JSON.parse(localStorage.getItem('soundEnabled')) ?? true
  // )
  const [alertMessage, setAlertMessage] = useState(null)

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

  const handlePlayNow = async () => {
    try {
      const userData = await getUserData()
      if (!userData) return setAlertMessage('User data not found!')

      const response = await fetch(
        'http://localhost:5000/api/matchmaking/addToQueue',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userData.userId,
            userName: userData.username,
            synergy: userData.totalSynergy,
          }),
        }
      )

      const data = await response.json()
      if (!data.success) {
        console.log('User already in queue or failed to add:', data.message)
        return
      }
      console.log('User added to matchmaking queue:', data.queueId)

      // Listen for battle creation for this user
      const battlesRef = ref(realtimeDB, 'battles')
      const userQuery = query(
        battlesRef,
        orderByChild('player1/playerId'),
        equalTo(userData.userId)
      )

      const listener = onChildAdded(userQuery, (snapshot) => {
        const battle = snapshot.val()
        console.log('Match found:', battle.matchId)

        // Navigate to tournament page with matchId
        navigate(`/battle/${battle.matchId}`, {
          state: { matchId: battle.matchId },
        })

        // Stop listening after match is found
        off(userQuery, 'child_added', listener)
      })
    } catch (error) {
      console.error(error)
    }
  }

  if (error) return <h2></h2>

  return (
    <div className={`tournamentHome-container`}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          width: '60%',
          position: 'relative',
          marginTop: '30px',
        }}
      >
        <CachedImage
          src="/new/tournament/tournamentLogo.png"
          alt="Tournament Header"
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
            filter: 'brightness(1.3)',
          }}
        />
      </div>

      <div className="tournamentHome-matchmaking-container">
        <CachedImage
          src="/new/tournament/startbattleBtn.png"
          onClick={handlePlayNow}
          alt="Start Battle"
          style={{ background: 'transparent' }}
        />

        <Link to="/leaderboard">
          <CachedImage
            src="/new/tournament/leaderboardBtn.png"
            alt="Leaderboard"
          />
        </Link>

        <CachedImage
          src="/new/tournament/mydeckBtn.png"
          onClick={handleOpenModal}
          alt="My Deck"
        />

        <CachedImage
          src="/new/tournament/backBtn.png"
          onClick={handleBack}
          alt="Back Button"
        />

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
                className="deck-error-modal-button"
              />
            </div>
          </div>
        )}

        {!framesExist && (
          <div>
            <CachedImage
              src="/new/tournament/downloadBtn.png"
              alt="Refresh"
              style={{ display: 'block' }}
              onClick={handleDownload}
            />

            <div>
              <p>📥 {Math.round((progress / 390) * 100)}% Downloaded</p>
            </div>
          </div>
        )}
      </div>

      <DefaultDeckModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={user}
      />

      {isMatchmakingModalOpen && (
        <div className="tournamentHome-modal">
          <div className="tournamentHome-modal-content">
            <CachedImage
              src="/new/tournament/cancel2.png"
              className="tournamentHome-cancel-button"
              onClick={handleCancelMatchmaking}
            />
          </div>
        </div>
      )}

      {alertMessage && (
        <CustomAlert
          message={alertMessage}
          onClose={() => setAlertMessage(null)}
        />
      )}
    </div>
  )
}

export default Tournament
