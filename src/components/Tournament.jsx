import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { realtimeDB } from '../firebase'
import { ref, onValue, get } from 'firebase/database'
import DefaultDeckModal from './tournament/DefaultDeckModal'
import './tournament/style/tournament.style.css'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import CachedImage from './Shared/CachedImage'
import { getUserData } from '../utils/indexedDBService'
import { joinQueue, leaveQueue } from './shared/joinQueue'
import { listenForMatch } from './shared/matchListner'
import {
  setupAnimationsDB,
  fetchAbilityFrames,
} from '../utils/AnimationUtility'

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
      setupAnimationsDB()
      fetchAbilityFrames()
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

      const added = await joinQueue(userData)
      if (!added) return

      setIsMatchmaking(true)
      setIsMatchmakingModalOpen(true)
      listenForMatch(userData.userId, navigate)
    } catch (error) {
      console.error(error)
    }
  }

  const handleCancel = async () => {
    try {
      const userData = await getUserData()
      if (!userData) return setAlertMessage('User data not found!')

      const removed = await leaveQueue(userData.userId)
      if (!removed) return

      setIsMatchmaking(false)
      setIsMatchmakingModalOpen(false)
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
              onClick={handleCancel}
              alt="Cancel Button"
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
