import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestoreDB } from '../firebase'
import axios from 'axios'
import DefaultDeckModal from './tournament/DefaultDeckModal'
import './tournament/style/tournament.style.css'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import CachedImage from './shared/CachedImage'
import { getUserData } from '../utils/indexedDBService'
import {
  joinQueue,
  leaveQueue,
  joinTutorialQueue,
  createFriendlyMatch,
  joinFriendlyQueue,
  cancelFriendlyMatch,
} from './shared/joinQueue'
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
  // const [onlineCount, setOnlineCount] = useState(0)
  const [showDeckErrorModal, setShowDeckErrorModal] = useState(false)
  // const [soundEnabled, setSoundEnabled] = useState(
  //   JSON.parse(localStorage.getItem('soundEnabled')) ?? true
  // )
  const [alertMessage, setAlertMessage] = useState(null)
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [friendUsername, setFriendUsername] = useState('')
  const [friendlyChallenge, setFriendlyChallenge] = useState(null)
  const [isBattleModeOpen, setIsBattleModeOpen] = useState(false) // Main battle mode modal
  const [isFriendlyModalOpen, setIsFriendlyModalOpen] = useState(false) // Friendly challenge modal
  const [activeModal, setActiveModal] = useState(null) // 'battle', 'friendly', null
  const backend = 'https://share.clashwarriors.tech'
  const { code: urlCode } = useParams()

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

  useEffect(() => {
    console.log('URL code from params:', urlCode)

    if (urlCode && urlCode.length === 6 && userData) {
      console.log('Valid code and userData found. Joining friendly match...')
      setCode(urlCode) // fill input with URL code
      handleJoinFriendlyMatch(urlCode)
    } else {
      console.log('Either URL code is invalid or userData not ready yet.')
    }
  }, [urlCode, userData])

  const handleOpenModal = () => {
    setIsModalOpen(true)
    triggerHapticFeedback()
  }

  const handleBack = () => {
    navigate('/')
    triggerHapticFeedback()
  }

  const noCardsError = () => {
    triggerHapticFeedback()
    setShowDeckErrorModal(false)
    navigate('/builddeck')
  }

  const handlePlayNow = () => {
    const savedChallenge = localStorage.getItem('friendlyChallenge')
    if (savedChallenge) {
      const challengeData = JSON.parse(savedChallenge)
      setFriendlyChallenge(challengeData)
      setActiveModal('friendly') // open friendly modal
    } else {
      setFriendlyChallenge(null)
      setActiveModal('battle') // open battle modal
    }
  }

  // Close functions
  const closeBattleMode = () => setIsBattleModeOpen(false)
  const closeFriendlyModal = () => setIsFriendlyModalOpen(false)

  const handleMultiplayerBattle = async () => {
    triggerHapticFeedback()
    try {
      const userData = await getUserData()
      if (!userData) return setAlertMessage('User data not found!')

      // Check if tutorial already completed in localStorage
      const tutorialCompleted =
        localStorage.getItem('tutorialCompleted') === 'true'

      const isTutorial = !tutorialCompleted // true only if tutorial not done

      //     // Decide which queue to join
      const queueFunction = isTutorial ? joinTutorialQueue : joinQueue
      const added = await queueFunction(userData)
      if (!added) return

      setIsMatchmaking(true)
      setIsMatchmakingModalOpen(true)
      setActiveModal('matchmaking')
      // Listen for match and pass tutorial flag
      listenForMatch(userData.userId, navigate, isTutorial)
    } catch (error) {
      console.error(error)
    }
  }

  // When creating a friendly challenge
  const handleFriendlyChallenge = async () => {
    const freshUserData = await getUserData()
    if (!freshUserData) return setAlertMessage('User data not found!')

    try {
      const result = await createFriendlyMatch(freshUserData)

      if (result.success) {
        const challengeData = {
          code: result.uniqueId,
          playerId: freshUserData.userId,
          createdAt: Date.now(),
        }

        setFriendlyChallenge(challengeData)
        localStorage.setItem('friendlyChallenge', JSON.stringify(challengeData))
        listenForMatch(freshUserData.userId, navigate)
        setActiveModal('friendly')
      } else {
        console.log('Failed to create friendly match. Try again.')
      }
    } catch (err) {
      console.error('Error creating friendly match:', err)
    }
  }

  // Define this function inside your Tournament component
  const handleJoinFriendlyMatch = async (joinCode) => {
    const joinCodeToUse = joinCode || code
    if (!joinCodeToUse || joinCodeToUse.length !== 6) return

    const freshUserData = await getUserData()
    if (!freshUserData) {
      setAlertMessage('User data not loaded yet!')
      return
    }

    try {
      const result = await joinFriendlyQueue(freshUserData, joinCodeToUse)
      if (result.success) {
        console.log('Joined friendly match:', joinCodeToUse)

        const challengeData = {
          code: joinCodeToUse,
          playerId: freshUserData.userId,
          createdAt: Date.now(),
        }
        setFriendlyChallenge(challengeData)
        listenForMatch(freshUserData.userId, navigate)
        setActiveModal('friendly')
      } else {
        setAlertMessage('Invalid code or match already full!')
      }
    } catch (err) {
      console.error('Error joining friendly match:', err)
      setAlertMessage('Something went wrong. Try again!')
    }
  }

  const sendChallenge = async () => {
    if (!friendUsername) {
      alert("Enter your friend's username first!")
      return
    }

    if (!friendlyChallenge) {
      alert('Create a friendly match first!')
      return
    }

    try {
      const res = await axios.post(`${backend}/send-invite`, {
        fromUser: user.userId,
        toUsername: friendUsername,
        matchCode: friendlyChallenge.code,
      })

      if (res.data.success) {
        alert(`✅ Challenge sent to ${friendUsername}`)
      } else {
        alert(`❌ Failed: ${res.data.error}`)
      }
    } catch (err) {
      console.error('Send challenge error:', err)
      alert('Something went wrong while sending challenge')
    }
  }

  // To cancel friendly challenge
  const handleCancelFriendlyChallenge = async () => {
    if (friendlyChallenge) {
      // Remove from DB
      await cancelFriendlyMatch(user.userId, friendlyChallenge.code)

      // Clear local state
      setFriendlyChallenge(null)
      setFriendUsername('')
      localStorage.removeItem('friendlyChallenge')

      // Go back to battle modal
      setActiveModal(null)
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
      setActiveModal(null)
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

      {/* Main Battle Modal */}
      {activeModal === 'battle' && (
        <div
          className="battle-mode-overlay"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="battle-mode-container"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Choose your Battle Mode</h2>

            <button
              className="battle-mode-button battle-mode-multiplayer"
              onClick={handleMultiplayerBattle}
            >
              Multiplayer Battle
            </button>

            <button
              className="battle-mode-button battle-mode-challenge"
              onClick={handleFriendlyChallenge}
            >
              Challenge Friend
            </button>

            <div className="battle-code-wrapper">
              <input
                type="text"
                name="code"
                placeholder="Enter 6-char code"
                className="battle-code-input"
                maxLength={6}
                autoCorrect="off"
                autoCapitalize="characters"
                inputMode="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <button
                type="button"
                className={`battle-code-submit ${code.length === 6 ? 'active' : ''}`}
                onClick={() => handleJoinFriendlyMatch(code)}
                disabled={code.length !== 6}
              >
                ✔
              </button>

              {alertMessage && (
                <div className="alert-message">{alertMessage}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Friendly Challenge Modal */}
      {activeModal === 'friendly' && friendlyChallenge && (
        <div
          className="friendly-modal-overlay"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="friendly-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Friendly Challenge Created</h2>

            {/* Code Input */}
            <div className="friendly-code-wrapper">
              <input
                type="text"
                value={friendlyChallenge.code}
                readOnly
                className="friendly-code-input"
              />
              <button
                className="friendly-code-copy"
                onClick={() =>
                  navigator.clipboard.writeText(friendlyChallenge.code)
                }
              >
                ✔
              </button>
            </div>

            {/* Link Input */}
            <div
              className="friendly-link-wrapper"
              style={{ marginTop: '10px' }}
            >
              <input
                type="text"
                value={`${backend}/battle-invite/${friendlyChallenge.code}`}
                readOnly
                className="friendly-link-input"
              />
              <button
                className="friendly-link-copy"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `${backend}/battle-challenge/${friendlyChallenge.code}`
                  )
                }
              >
                Copy Link
              </button>
            </div>

            {/* Friend Username */}
            <input
              type="text"
              placeholder="Enter friend's username"
              className="friendly-username-input"
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              style={{ marginTop: '10px' }}
            />

            {/* Buttons */}
            <button className="friendly-send-btn" onClick={sendChallenge}>
              Send Challenge
            </button>
            <button
              className="friendly-send-btn"
              onClick={handleCancelFriendlyChallenge}
            >
              Cancel Challenge
            </button>
          </div>
        </div>
      )}

      {activeModal === 'matchmaking' && (
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
