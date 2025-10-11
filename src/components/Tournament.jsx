// src/components/Tournament.jsx
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  Suspense,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestoreDB } from '../firebase'
import axios from 'axios'
import './tournament/style/tournament.style.css'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import CachedImage from './shared/CachedImage'
import { getUserData, getCards } from '../utils/indexedDBService'
import {
  joinQueue,
  leaveQueue,
  joinTutorialQueue,
  createFriendlyMatch,
  joinFriendlyQueue,
  cancelFriendlyMatch,
} from './shared/joinQueue'
import MatchListner from './shared/matchListner'
import {
  setupAnimationsDB,
  fetchAbilityFrames,
} from '../utils/AnimationUtility'
import { initSocket, disconnectSocket } from '../socketConfig'
import { fetchDefaultDeckCards } from './tournament/utils/deckUtils'

// Lazy-load the modal to reduce initial bundle size
const DefaultDeckModal = React.lazy(
  () => import('./tournament/DefaultDeckModal')
)

const backend = 'https://share.clashwarriors.tech'

// ---------- In-memory caches (singletons for the session) ----------
const inMemory = {
  indexedUser: null,
  indexedCards: null,
  firestoreUser: null,
}

// Safe wrapper for requestIdleCallback (fallback to setTimeout)
const runWhenIdle = (fn) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn, { timeout: 2000 })
  } else {
    setTimeout(fn, 500)
  }
}

// Small helper to avoid duplicate clicks/actions
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

const Tournament = ({ user }) => {
  const navigate = useNavigate()
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

  const { code: urlCode } = useParams()
  // Safe action runner refs to prevent double runs
  const runSafe = useRef(createSafeActionRunner()).current

  // ---------- CACHED getters (use in handlers to avoid repeated IDB reads) ----------
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

  useEffect(() => {
    if (!user?.userId) return

    const socket = initSocket(user.userId, (data) => {
      setMatchData(data)
      navigate(`/battle/${data.matchId}`)
    })

    return () => disconnectSocket()
  }, [user, navigate])

  // ---------- Firestore user doc fetch — cached in-memory to avoid repeated reads ----------
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

  // ---------- Component mount: preload animations in idle, fetch user doc ----------
  useEffect(() => {
    let mounted = true
    const init = async () => {
      if (!user?.userId) {
        setLoading(false)
        return
      }

      setLoading(true)

      // Firestore user fetch (fast, cached)
      try {
        const data = await fetchFirestoreUserDoc(user.userId)
        if (mounted) setUserData(data)
      } catch (err) {
        console.error('User fetch error:', err)
        if (mounted) setError('Failed to fetch user details')
      } finally {
        if (mounted) setLoading(false)
      }

      // Preload heavy assets when idle (will not block the UI)
      runWhenIdle(async () => {
        try {
          await setupAnimationsDB()
          // dont await fetchAbilityFrames fully if it's heavy — prefetch but allow other UI
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

  // ---------- Handle url code param (join friendly if present) ----------
  useEffect(() => {
    if (!urlCode) return
    // Wait until we have at least tried to fetch firestore user
    if (!userData && loading) return
    // If userData available (or not required), try to join
    if (urlCode?.length === 6) {
      // run safe to avoid race
      runSafe(async () => {
        await handleJoinFriendlyMatch(urlCode)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode, userData, loading])

  // ---------- Handlers (fast, stable) ----------
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

  const handleMultiplayerBattle = useCallback(
    async (ev) => {
      // run via safe runner to avoid multi-clicks
      await runSafe(async () => {
        triggerHapticFeedback()
        try {
          const idbUser = await getCachedUserFromIDB()
          if (!idbUser) {
            setAlertMessage('User data not found!')
            return
          }

          // cached cards
          const defaultDeckCards = await fetchDefaultDeckCards()
          if (defaultDeckCards.length !== 10) {
            setAlertMessage(
              'You must have exactly 10 cards in your default deck!'
            )
            return
          }

          const tutorialCompleted =
            localStorage.getItem('tutorialCompleted') === 'true'
          const queueFunction = tutorialCompleted
            ? joinQueue
            : joinTutorialQueue
          const added = await queueFunction(idbUser)
          if (!added) return

          setIsMatchmaking(true)
          setActiveModal('matchmaking')
        } catch (err) {
          console.error('handleMultiplayerBattle error', err)
          setAlertMessage('Something went wrong. Please try again!')
        }
      })
    },
    [getCachedUserFromIDB, getCachedCardsFromIDB, navigate, runSafe]
  )

  const handleFriendlyChallenge = useCallback(
    async (ev) => {
      await runSafe(async () => {
        triggerHapticFeedback()
        try {
          const idbUser = await getCachedUserFromIDB()
          if (!idbUser) return setAlertMessage('User data not found!')

          const defaultDeckCards = await fetchDefaultDeckCards()
          if (defaultDeckCards.length !== 10) {
            setAlertMessage(
              'You must have exactly 10 cards in your default deck!'
            )
            return
          }

          const result = await createFriendlyMatch(idbUser)
          if (result?.success) {
            const challengeData = {
              code: result.uniqueId,
              playerId: idbUser.userId,
              createdAt: Date.now(),
            }
            localStorage.setItem(
              'friendlyChallenge',
              JSON.stringify(challengeData)
            )
            setFriendlyChallenge(challengeData)
            setActiveModal('friendly')
          } else {
            setAlertMessage('Failed to create friendly match')
          }
        } catch (err) {
          console.error('handleFriendlyChallenge error', err)
          setAlertMessage('Something went wrong. Try again!')
        }
      })
    },
    [getCachedUserFromIDB, getCachedCardsFromIDB, navigate, runSafe]
  )

  const handleJoinFriendlyMatch = useCallback(
    async (joinCodeParam) => {
      await runSafe(async () => {
        triggerHapticFeedback()
        const joinCodeToUse = (joinCodeParam || code || '').toUpperCase()
        if (!joinCodeToUse || joinCodeToUse.length !== 6) return

        const idbUser = await getCachedUserFromIDB()
        if (!idbUser) {
          setAlertMessage('User data not loaded yet!')
          return
        }

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
          console.error('handleJoinFriendlyMatch error', err)
          setAlertMessage('Something went wrong. Try again!')
        }
      })
    },
    [code, getCachedUserFromIDB, getCachedCardsFromIDB, navigate, runSafe]
  )

  const sendChallenge = useCallback(async () => {
    await runSafe(async () => {
      triggerHapticFeedback()
      const idbUser = await getCachedUserFromIDB()
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

  // ---------- Render ----------
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

      {/* DefaultDeckModal (lazy) */}
      <Suspense fallback={null}>
        {isModalOpen && (
          <DefaultDeckModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            user={user}
          />
        )}
      </Suspense>

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

            <input
              type="text"
              placeholder="Enter friend's username"
              className="friendly-username-input"
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              style={{ marginTop: '10px' }}
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
