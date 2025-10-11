// src/components/Tournament.jsx
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  Suspense,
  useMemo,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestoreDB } from '../firebase'
import axios from 'axios'
import './tournament/style/tournament.style.css'
import CachedImage from './shared/CachedImage'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import { getUserData, getCards } from '../utils/indexedDBService'
import {
  joinQueue,
  leaveQueue,
  joinTutorialQueue,
  createFriendlyMatch,
  joinFriendlyQueue,
  cancelFriendlyMatch,
} from './shared/joinQueue'
import {
  setupAnimationsDB,
  fetchAbilityFrames,
} from '../utils/AnimationUtility'
import { initSocket, disconnectSocket } from '../socketConfig'
import { fetchDefaultDeckCards } from './tournament/utils/deckUtils'
import FullScreenLoading from './LoadingScreen'

// -------------------- Lazy-loaded Modals --------------------
const DefaultDeckModal = React.lazy(
  () => import('./tournament/DefaultDeckModal')
)

// Backend URL
const backend = 'https://share.clashwarriors.tech'

// -------------------- In-memory session cache --------------------
const inMemory = {
  indexedUser: null,
  indexedCards: null,
  firestoreUser: null,
}

// -------------------- Utility Functions --------------------

// Safe wrapper for requestIdleCallback fallback
const runWhenIdle = (fn) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn, { timeout: 2000 })
  } else {
    setTimeout(fn, 500)
  }
}

// Safe action runner to prevent double clicks / multi-execution
const createSafeActionRunner = () => {
  const ref = { running: false }
  return async (fn) => {
    if (ref.running) return
    ref.running = true
    try {
      await fn()
    } finally {
      ref.running = false
    }
  }
}

// -------------------- Main Component --------------------
const Tournament = ({ user }) => {
  const navigate = useNavigate()
  const { code: urlCode } = useParams()

  // -------------------- State --------------------
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeModal, setActiveModal] = useState(null) // 'battle' | 'friendly' | 'matchmaking' | null
  const [alertMessage, setAlertMessage] = useState(null)
  const [code, setCode] = useState('')
  const [friendUsername, setFriendUsername] = useState('')
  const [friendlyChallenge, setFriendlyChallenge] = useState(null)
  const [showDeckErrorModal, setShowDeckErrorModal] = useState(false)
  const [isMatchmaking, setIsMatchmaking] = useState(false)
  const [matchData, setMatchData] = useState(null)

  // -------------------- Refs --------------------
  const runSafe = useRef(createSafeActionRunner()).current

  // -------------------- Memoized Styles --------------------
  const logoWrapperStyle = useMemo(
    () => ({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      width: '60%',
      position: 'relative',
      marginTop: '30px',
    }),
    []
  )

  const logoImageStyle = useMemo(
    () => ({
      display: 'block',
      maxWidth: '100%',
      height: 'auto',
      filter: 'brightness(1.3)',
    }),
    []
  )

  // -------------------- IndexedDB Cache Helpers --------------------
  const getCachedUserFromIDB = useCallback(async () => {
    if (inMemory.indexedUser) return inMemory.indexedUser
    try {
      const u = await getUserData()
      inMemory.indexedUser = u
      return u
    } catch (err) {
      console.warn('Failed to read cached user:', err)
      return null
    }
  }, [])

  const getCachedCardsFromIDB = useCallback(async () => {
    if (inMemory.indexedCards) return inMemory.indexedCards
    try {
      const c = await getCards()
      inMemory.indexedCards = c
      return c
    } catch (err) {
      console.warn('Failed to read cached cards:', err)
      return []
    }
  }, [])

  // -------------------- Firestore User Fetch --------------------
  const fetchFirestoreUserDoc = useCallback(async (uid) => {
    if (!uid) return null
    if (inMemory.firestoreUser && inMemory.firestoreUser._uid === uid) {
      return inMemory.firestoreUser.data
    }
    try {
      const userRef = doc(firestoreDB, 'users', uid)
      const snap = await getDoc(userRef)
      const data = snap.exists() ? snap.data() : null
      inMemory.firestoreUser = { _uid: uid, data }
      return data
    } catch (err) {
      console.error('Error fetching user doc:', err)
      return null
    }
  }, [])

  // -------------------- Socket Initialization --------------------
  useEffect(() => {
    if (!user?.userId) return
    const socket = initSocket(user.userId, (data) => {
      setMatchData(data)
      navigate(`/battle/${data.matchId}`)
    })
    return () => disconnectSocket()
  }, [user, navigate])

  // -------------------- Component Init --------------------
  useEffect(() => {
    let mounted = true
    const init = async () => {
      if (!user?.userId) {
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const data = await fetchFirestoreUserDoc(user.userId)
        if (mounted) setUserData(data)
      } catch (err) {
        console.error('User fetch error:', err)
        if (mounted) setError('Failed to fetch user details')
      } finally {
        if (mounted) setLoading(false)
      }

      // Preload assets & animations
      runWhenIdle(async () => {
        try {
          await setupAnimationsDB()
          await fetchAbilityFrames()
        } catch (err) {
          console.warn('Animation preload error:', err)
        }
      })
    }

    init()
    return () => {
      mounted = false
    }
  }, [user?.userId, fetchFirestoreUserDoc])

  // -------------------- Handle URL Join Code --------------------
  useEffect(() => {
    if (!urlCode) return
    if (!userData && loading) return
    if (urlCode?.length === 6) {
      runSafe(async () => {
        await handleJoinFriendlyMatch(urlCode)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode, userData, loading])

  // -------------------- Event Handlers --------------------
  const handleOpenModal = useCallback(() => {
    triggerHapticFeedback()
    setIsModalOpen(true)
  }, [])

  const handleBack = useCallback(() => {
    triggerHapticFeedback()
    navigate('/')
  }, [navigate])

  const noCardsError = useCallback(() => {
    triggerHapticFeedback()
    setShowDeckErrorModal(false)
    navigate('/builddeck')
  }, [navigate])

  const handlePlayNow = useCallback(() => {
    triggerHapticFeedback()
    try {
      const saved = localStorage.getItem('friendlyChallenge')
      if (saved) {
        const chal = JSON.parse(saved)
        setFriendlyChallenge(chal)
        setActiveModal('friendly')
      } else {
        setFriendlyChallenge(null)
        setActiveModal('battle')
      }
    } catch (err) {
      console.warn('handlePlayNow parse error', err)
      setActiveModal('battle')
    }
  }, [])

  const handleMultiplayerBattle = useCallback(async () => {
    await runSafe(async () => {
      triggerHapticFeedback()
      const idbUser = await getCachedUserFromIDB()
      if (!idbUser) return setAlertMessage('User data not found!')

      const defaultDeckCards = await fetchDefaultDeckCards()
      if (defaultDeckCards.length !== 10) {
        setAlertMessage('You must have exactly 10 cards in your default deck!')
        return
      }

      const tutorialCompleted =
        localStorage.getItem('tutorialCompleted') === 'true'
      const added = tutorialCompleted
        ? await joinQueue(idbUser)
        : await joinTutorialQueue(idbUser)
      if (!added) return

      setIsMatchmaking(true)
      setActiveModal('matchmaking')
    })
  }, [getCachedUserFromIDB, runSafe])

  const handleFriendlyChallenge = useCallback(async () => {
    await runSafe(async () => {
      triggerHapticFeedback()
      const idbUser = await getCachedUserFromIDB()
      if (!idbUser) return setAlertMessage('User data not found!')

      const defaultDeckCards = await fetchDefaultDeckCards()
      if (defaultDeckCards.length !== 10) {
        setAlertMessage('You must have exactly 10 cards in your default deck!')
        return
      }

      const result = await createFriendlyMatch(idbUser)
      if (result?.success) {
        const challengeData = {
          code: result.uniqueId,
          playerId: idbUser.userId,
          createdAt: Date.now(),
        }
        localStorage.setItem('friendlyChallenge', JSON.stringify(challengeData))
        setFriendlyChallenge(challengeData)
        setActiveModal('friendly')
      } else {
        setAlertMessage('Failed to create friendly match')
      }
    })
  }, [getCachedUserFromIDB, runSafe])

  const handleJoinFriendlyMatch = useCallback(
    async (joinCodeParam) => {
      await runSafe(async () => {
        triggerHapticFeedback()
        const joinCodeToUse = (joinCodeParam || code || '').toUpperCase()
        if (!joinCodeToUse || joinCodeToUse.length !== 6) return

        const idbUser = await getCachedUserFromIDB()
        if (!idbUser) return setAlertMessage('User data not loaded yet!')

        const defaultDeckCards = await fetchDefaultDeckCards()
        if (defaultDeckCards.length !== 10) {
          setAlertMessage(
            'You must have exactly 10 cards in your default deck!'
          )
          return
        }

        try {
          const result = await joinFriendlyQueue(idbUser, joinCodeToUse)
          if (result?.success) {
            const challengeData = {
              code: joinCodeToUse,
              playerId: idbUser.userId,
              createdAt: Date.now(),
            }
            setFriendlyChallenge(challengeData)
            setActiveModal('friendly')
          } else {
            setAlertMessage('Invalid code or match already full!')
          }
        } catch (err) {
          console.error('handleJoinFriendlyMatch error:', err)
          setAlertMessage('Something went wrong. Try again!')
        }
      })
    },
    [code, getCachedUserFromIDB, runSafe]
  )

  const sendChallenge = useCallback(async () => {
    await runSafe(async () => {
      triggerHapticFeedback()
      const idbUser = await getCachedUserFromIDB()
      if (!friendUsername) return alert("Enter your friend's username first!")
      if (!friendlyChallenge) return alert('Create a friendly match first!')

      try {
        const res = await axios.post(`${backend}/send-invite`, {
          fromUser: idbUser?.userId ?? user?.userId,
          toUsername: friendUsername,
          matchCode: friendlyChallenge.code,
        })
        if (res.data?.success) alert(`✅ Challenge sent to ${friendUsername}`)
        else alert(`❌ Failed: ${res.data?.error || 'unknown'}`)
      } catch (err) {
        console.error('Send challenge error:', err)
        alert('Something went wrong while sending challenge')
      }
    })
  }, [friendUsername, friendlyChallenge, getCachedUserFromIDB, runSafe, user])

  const handleCancelFriendlyChallenge = useCallback(async () => {
    await runSafe(async () => {
      triggerHapticFeedback()
      const idbUser = await getCachedUserFromIDB()
      if (friendlyChallenge && idbUser) {
        await cancelFriendlyMatch(idbUser.userId, friendlyChallenge.code)
        setFriendlyChallenge(null)
        setFriendUsername('')
        localStorage.removeItem('friendlyChallenge')
        setActiveModal(null)
      }
    })
  }, [friendlyChallenge, getCachedUserFromIDB, runSafe])

  const handleCancelMatchmaking = useCallback(async () => {
    await runSafe(async () => {
      triggerHapticFeedback()
      const idbUser = await getCachedUserFromIDB()
      if (!idbUser) return
      await leaveQueue(idbUser.userId)
      setIsMatchmaking(false)
      setActiveModal(null)
    })
  }, [getCachedUserFromIDB, runSafe])

  // -------------------- Preload Images for Performance --------------------
  useEffect(() => {
    const images = [
      '/new/tournament/tournamentLogo.png',
      '/new/tournament/startbattleBtn.png',
      '/new/tournament/leaderboardBtn.png',
      '/new/tournament/mydeckBtn.png',
      '/new/tournament/backBtn.png',
      '/new/tournament/builddeckBtn.png',
      '/new/tournament/cancel2.png',
    ]
    images.forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [])

  // -------------------- Render --------------------
  if (error) return <h2>{error}</h2>
  if (loading) return <FullScreenLoading />

  return (
    <div className="tournamentHome-container">
      {/* Logo */}
      <div style={logoWrapperStyle}>
        <CachedImage
          src="/new/tournament/tournamentLogo.png"
          alt="Tournament Header"
          style={logoImageStyle}
        />
      </div>

      {/* Buttons */}
      <div className="tournamentHome-matchmaking-container">
        <CachedImage
          src="/new/tournament/startbattleBtn.png"
          onClick={handlePlayNow}
          alt="Start Battle"
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

        {/* Deck Error Modal */}
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

      {/* Default Deck Modal */}
      <Suspense fallback={null}>
        {isModalOpen && (
          <DefaultDeckModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            user={user}
          />
        )}
      </Suspense>

      {/* Battle Modal */}
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
            </div>
            {alertMessage && (
              <div className="battle-code-alert-message">{alertMessage}</div>
            )}
          </div>
        </div>
      )}

      {/* Friendly Modal */}
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

            <div className="friendly-link-wrapper">
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

            <input
              type="text"
              placeholder="Enter friend's username"
              className="friendly-username-input"
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
            />
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

      {/* Matchmaking Modal */}
      {activeModal === 'matchmaking' && (
        <div className="tournamentHome-modal">
          <div className="tournamentHome-modal-content">
            <CachedImage
              src="/new/tournament/cancel2.png"
              className="tournamentHome-cancel-button"
              onClick={handleCancelMatchmaking}
              alt="Cancel Button"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default Tournament
