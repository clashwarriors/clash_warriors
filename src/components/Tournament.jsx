// src/components/Tournament.jsx
import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Suspense,
  useState,
  lazy,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestoreDB } from '../firebase'
import axios from 'axios'
import './tournament/style/tournament.style.css'
import CachedImage from './shared/CachedImage'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import { getUserData, getCards, getUserDeck } from '../utils/indexedDBService'
import {
  joinQueue,
  leaveQueue,
  joinTutorialQueue,
  createFriendlyMatch,
  joinFriendlyQueue,
  cancelFriendlyMatch,
} from './shared/joinQueue'
import { setupAnimationsDB, setupSoundsDB } from '../utils/AnimationUtility'
import { initSocket, disconnectSocket } from '../socketConfig'
import { logUserData } from './shared/uploadUser'

// Lazy-load modals
const BattleModal = lazy(() => import('./shared/BattleModal'))
const FriendlyModal = lazy(() => import('./shared/FriendlyModal'))

// -------------------- Lazy-loaded Modals --------------------
const DefaultDeckModal = React.lazy(
  () => import('./tournament/DefaultDeckModal')
)

// Backend URL
const backend = import.meta.env.VITE_API_BASE_URL

// -------------------- In-memory session cache --------------------
const inMemory = {
  indexedUser: null,
  indexedCards: null,
  firestoreUser: null,
}

// -------------------- Utility Functions --------------------
const runWhenIdle = (fn) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn, { timeout: 2000 })
  } else {
    setTimeout(fn, 500)
  }
}

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
  const runSafe = useRef(createSafeActionRunner()).current

  // -------------------- Combined State --------------------
  const [state, setState] = useState({
    userData: null,
    loading: true,
    error: null,
    isModalOpen: false,
    activeModal: null,
    alertMessage: null,
    code: '',
    friendUsername: '',
    friendlyChallenge: null,
    showDeckErrorModal: false,
    isMatchmaking: false,
    matchData: null,
  })

  useEffect(() => {
    if (!user) return

    const fetchAndLogUser = async () => {
      await logUserData(user)
    }

    fetchAndLogUser()
  }, [user])

  const {
    userData,
    loading,
    error,
    isModalOpen,
    activeModal,
    alertMessage,
    code,
    friendUsername,
    friendlyChallenge,
    showDeckErrorModal,
    isMatchmaking,
    matchData,
  } = state

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

  // -------------------- IndexedDB Helpers --------------------
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

  // ----------------------
  // Get user's default deck (exactly 10 cards)
  // ----------------------
  const fetchDefaultDeckCards = async () => {
    try {
      const allCards = await getCards() // all owned cards
      const deckData = (await getUserDeck('default')) || {
        cards: [],
        totalSynergy: 0,
      }

      const defaultDeckCards = deckData.cards
        .map((id) => allCards.find((c) => c.cardId === id))
        .filter(Boolean)
        .slice(0, 10)

      // ✅ Use existing totalSynergy from deckData
      const totalSynergy = deckData.totalSynergy || 0

      // Return both deck cards and synergy
      return { cards: defaultDeckCards, totalSynergy }
    } catch (err) {
      console.error('❌ Failed to fetch default deck cards:', err)
      return { cards: [], totalSynergy: 0 }
    }
  }

  const fetchFirestoreUserDoc = useCallback(async (uid) => {
    if (!uid) return null
    if (inMemory.firestoreUser && inMemory.firestoreUser._uid === uid)
      return inMemory.firestoreUser.data
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

  // -------------------- Socket --------------------
  useEffect(() => {
    if (!user?.userId) {
      console.warn('⚠️ No userId found, skipping socket init')
      return
    }

    console.log('🔌 Initializing socket for user:', user.userId)

    const socket = initSocket(user.userId, (data) => {
      console.log('📨 Match data received from socket:', data)

      if (!data?.matchId) {
        console.error('❌ Match data missing matchId, cannot navigate:', data)
        return
      }

      console.log('➡️ Navigating to battle page with matchId:', data.matchId)
      navigate(`/battle/${data.matchId}`)
    })

    return () => {
      console.log('🛑 Disconnecting socket')
      disconnectSocket()
    }
  }, [user, navigate])

  // -------------------------
  // 1️⃣ Setup animations DB + cache
  // -------------------------
  useEffect(() => {
    setupAnimationsDB()
  }, [])

  useEffect(() => {
    setupSoundsDB()
  }, [])

  // -------------------- Initialization --------------------
  useEffect(() => {
    let mounted = true
    const init = async () => {
      if (!user?.userId) {
        setState((prev) => ({ ...prev, loading: false }))
        return
      }

      setState((prev) => ({ ...prev, loading: true }))

      try {
        const data = await fetchFirestoreUserDoc(user.userId)
        if (mounted) setState((prev) => ({ ...prev, userData: data }))
      } catch (err) {
        console.error('User fetch error:', err)
        if (mounted)
          setState((prev) => ({
            ...prev,
            error: 'Failed to fetch user details',
          }))
      } finally {
        if (mounted) setState((prev) => ({ ...prev, loading: false }))
      }
    }
    init()
    return () => {
      mounted = false
    }
  }, [user?.userId, fetchFirestoreUserDoc])

  // -------------------- URL Join Code --------------------
  useEffect(() => {
    if (!urlCode) return
    if (!userData && loading) return
    if (urlCode?.length === 6) {
      runSafe(async () => {
        await handleJoinFriendlyMatch(urlCode)
      })
    }
  }, [urlCode, userData, loading])

  // -------------------- Event Handlers --------------------
  const handleOpenModal = useCallback(() => {
    triggerHapticFeedback()
    setState((prev) => ({ ...prev, isModalOpen: true }))
  }, [])

  const handleBack = useCallback(() => {
    triggerHapticFeedback()
    navigate('/')
  }, [navigate])

  const noCardsError = useCallback(() => {
    triggerHapticFeedback()
    setState((prev) => ({ ...prev, showDeckErrorModal: false }))
    navigate('/builddeck')
  }, [navigate])

  const handlePlayNow = useCallback(() => {
    triggerHapticFeedback()
    try {
      const saved = localStorage.getItem('friendlyChallenge')
      if (saved) {
        const chal = JSON.parse(saved)
        setState((prev) => ({
          ...prev,
          friendlyChallenge: chal,
          activeModal: 'friendly',
        }))
      } else {
        setState((prev) => ({
          ...prev,
          friendlyChallenge: null,
          activeModal: 'battle',
        }))
      }
    } catch {
      setState((prev) => ({ ...prev, activeModal: 'battle' }))
    }
  }, [])

  const handleMultiplayerBattle = useCallback(async () => {
    await runSafe(async () => {
      triggerHapticFeedback()
      const idbUser = await getCachedUserFromIDB()
      if (!idbUser)
        return setState((prev) => ({
          ...prev,
          alertMessage: 'User data not found!',
        }))

      const { cards: defaultDeckCards, totalSynergy } =
        await fetchDefaultDeckCards()
      if (defaultDeckCards.length !== 10) {
        setState((prev) => ({
          ...prev,
          alertMessage: 'You must have exactly 10 cards in your default deck!',
        }))
        return
      }

      const tutorialCompleted =
        localStorage.getItem('tutorialCompleted') === 'true'
      const added = tutorialCompleted
        ? await joinQueue({ ...idbUser, totalSynergy })
        : await joinTutorialQueue({ ...idbUser, totalSynergy })

      if (!added) return

      setState((prev) => ({
        ...prev,
        isMatchmaking: true,
        activeModal: 'matchmaking',
      }))
    })
  }, [getCachedUserFromIDB, runSafe])

  const handleFriendlyChallenge = useCallback(async () => {
    await runSafe(async () => {
      triggerHapticFeedback()
      const idbUser = await getCachedUserFromIDB()
      if (!idbUser)
        return setState((prev) => ({
          ...prev,
          alertMessage: 'User data not found!',
        }))

      const { cards: defaultDeckCards, totalSynergy } =
        await fetchDefaultDeckCards()
      if (defaultDeckCards.length !== 10) {
        setState((prev) => ({
          ...prev,
          alertMessage: 'You must have exactly 10 cards in your default deck!',
        }))
        return
      }

      const result = await createFriendlyMatch({ ...idbUser, totalSynergy })
      if (result?.success) {
        const challengeData = {
          code: result.uniqueId,
          playerId: idbUser.userId,
          createdAt: Date.now(),
        }
        localStorage.setItem('friendlyChallenge', JSON.stringify(challengeData))
        setState((prev) => ({
          ...prev,
          friendlyChallenge: challengeData,
          activeModal: 'friendly',
        }))
      } else {
        setState((prev) => ({
          ...prev,
          alertMessage: 'Failed to create friendly match',
        }))
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
        if (!idbUser)
          return setState((prev) => ({
            ...prev,
            alertMessage: 'User data not loaded yet!',
          }))

        const { cards: defaultDeckCards, totalSynergy } =
          await fetchDefaultDeckCards()
        if (defaultDeckCards.length !== 10) {
          setState((prev) => ({
            ...prev,
            alertMessage:
              'You must have exactly 10 cards in your default deck!',
          }))
          return
        }

        try {
          const result = await joinFriendlyQueue(
            { ...idbUser, totalSynergy },
            joinCodeToUse
          )
          if (result?.success) {
            const challengeData = {
              code: joinCodeToUse,
              playerId: idbUser.userId,
              createdAt: Date.now(),
            }
            setState((prev) => ({
              ...prev,
              friendlyChallenge: challengeData,
              activeModal: 'friendly',
            }))
          } else {
            setState((prev) => ({
              ...prev,
              alertMessage: 'Invalid code or match already full!',
            }))
          }
        } catch {
          setState((prev) => ({
            ...prev,
            alertMessage: 'Something went wrong. Try again!',
          }))
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
        alert(
          res.data?.success
            ? `✅ Challenge sent to ${friendUsername}`
            : `❌ Failed: ${res.data?.error || 'unknown'}`
        )
      } catch {
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
        localStorage.removeItem('friendlyChallenge')
        setState((prev) => ({
          ...prev,
          friendlyChallenge: null,
          friendUsername: '',
          activeModal: null,
        }))
      }
    })
  }, [friendlyChallenge, getCachedUserFromIDB, runSafe])

  const handleCancelMatchmaking = useCallback(async () => {
    await runSafe(async () => {
      triggerHapticFeedback()
      const idbUser = await getCachedUserFromIDB()
      if (!idbUser) return
      await leaveQueue(idbUser.userId)
      setState((prev) => ({ ...prev, isMatchmaking: false, activeModal: null }))
    })
  }, [getCachedUserFromIDB, runSafe])

  // -------------------- Preload Images --------------------
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

  return (
    <div className="tournamentHome-container">
      {/* Logo */}
      <div style={logoWrapperStyle}>
        <img
          src="/new/tournament/tournamentLogo.png"
          alt="Tournament Header"
          style={logoImageStyle}
        />
      </div>

      {/* Buttons */}
      <div className="tournamentHome-matchmaking-container">
        <img
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
            onClick={() =>
              setState((prev) => ({ ...prev, showDeckErrorModal: false }))
            }
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
            onClose={() =>
              setState((prev) => ({ ...prev, isModalOpen: false }))
            }
            user={user}
          />
        )}

        {/* Battle Modal */}
        {activeModal === 'battle' && (
          <BattleModal
            code={code}
            alertMessage={alertMessage}
            setCode={(c) => setState((prev) => ({ ...prev, code: c }))}
            handleMultiplayerBattle={handleMultiplayerBattle}
            handleFriendlyChallenge={handleFriendlyChallenge}
            handleJoinFriendlyMatch={handleJoinFriendlyMatch}
            setState={setState}
            closeModal={() =>
              setState((prev) => ({ ...prev, activeModal: null }))
            }
          />
        )}

        {/* Friendly Modal */}
        {activeModal === 'friendly' && friendlyChallenge && (
          <FriendlyModal
            backend={backend}
            friendlyChallenge={friendlyChallenge}
            friendUsername={friendUsername}
            setFriendUsername={(val) =>
              setState((prev) => ({ ...prev, friendUsername: val }))
            }
            sendChallenge={sendChallenge}
            cancelChallenge={handleCancelFriendlyChallenge}
            closeModal={() =>
              setState((prev) => ({ ...prev, activeModal: null }))
            }
          />
        )}
      </Suspense>

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

export default React.memo(Tournament)
