import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestoreDB } from '../firebase'
import DefaultDeckModal from './tournament/DefaultDeckModal'
import './tournament/style/tournament.style.css'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import CachedImage from './shared/CachedImage'
import { getUserData } from '../utils/indexedDBService'
import { joinQueue, leaveQueue, joinTutorialQueue } from './shared/joinQueue'
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

      const userDocRef = doc(firestoreDB, 'users', user.userId) // Firestore doc reference

      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data())
          } else {
            console.warn('⚠️ User data not found in Firestore')
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
    triggerHapticFeedback()
    try {
      const userData = await getUserData()
      if (!userData) return setAlertMessage('User data not found!')

      // Check if tutorial already completed in localStorage
      const tutorialCompleted =
        localStorage.getItem('tutorialCompleted') === 'true'

      const isTutorial = !tutorialCompleted // true only if tutorial not done

      // Decide which queue to join
      const queueFunction = isTutorial ? joinTutorialQueue : joinQueue
      const added = await queueFunction(userData)
      if (!added) return

      setIsMatchmaking(true)
      setIsMatchmakingModalOpen(true)

      // Listen for match and pass tutorial flag
      listenForMatch(userData.userId, navigate, isTutorial)
    } catch (error) {
      console.error(error)
    }
  }

  const handleCancel = async () => {
    triggerHapticFeedback()
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
            onClick={() => setShowDeckErrorModal(false)}
          >
            <div
              className="deck-error-modal-content"
              onClick={(e) => e.stopPropagation()}
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
    </div>
  )
}

export default Tournament
