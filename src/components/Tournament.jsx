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
import {
  getUserData,
  storeUserData,
  getCards,
  getUserDeck,
} from '../utils/indexedDBService'
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
import { syncUser } from '../utils/firebaseSyncService' // Ensure this is imported
import {
  TonConnectButton,
  useTonAddress,
  useTonConnectUI,
  useTonWallet,
} from '@tonconnect/ui-react'
import confetti from 'canvas-confetti'

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

  const [balance, setBalance] = useState(0)
  const [isRewardClaimed, setIsRewardClaimed] = useState(true) // Default true to avoid flash
  const userFriendlyAddress = useTonAddress()
  const [mapBalance, setMapBalance] = useState(0)
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const [withdrawInput, setWithdrawInput] = useState('')
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  const handleButtonClick = () => {
    if (wallet) {
      // If already connected, disconnect (or open a profile menu)
      tonConnectUI.disconnect()
    } else {
      // If not connected, open the standard TonConnect modal
      tonConnectUI.openModal()
    }
  }

  // -------------------- Check Claim Status --------------------
  useEffect(() => {
    const checkClaimStatus = async () => {
      const data = await getUserData()
      if (data) {
        // Check if 'tournamentWelcome' is in claimed rewards or a specific flag
        // Adjust 'tournamentWelcome' to whatever key you prefer
        setIsRewardClaimed(!!data.tournamentWelcomeClaimed)
        setBalance(data.coins || 0) // Initialize balance from local data first
      } else {
        setIsRewardClaimed(false)
      }
    }
    checkClaimStatus()
  }, [user])

  // -------------------- Handle Claim 50K --------------------
  const handleClaimReward = async () => {
    triggerHapticFeedback()

    // 1. Ensure Wallet is Connected
    if (!userFriendlyAddress) {
      alert('⚠️ Please connect your TON wallet to claim!')
      return
    }

    try {
      // 2. Call Backend to Trigger Airdrop
      const response = await fetch('http://localhost:8080/claim-airdrop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: userFriendlyAddress }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed')
      }

      // 3. Success - Update Local Data to hide button
      // We don't add local 'coins' here because they are now sent to the On-Chain Wallet
      const data = await getUserData()
      if (data) {
        const updatedUser = {
          ...data,
          tournamentWelcomeClaimed: true, // Flag to hide button
        }

        await storeUserData(updatedUser)
        syncUser(updatedUser)
      }

      setIsRewardClaimed(true)

      // 4. Celebration
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      })

      alert(
        `🎉 50,000 WARS Sent to ${userFriendlyAddress.slice(0, 4)}...${userFriendlyAddress.slice(-4)}!`
      )
    } catch (e) {
      console.error('Claim failed', e)
      alert(`❌ Claim Failed: ${e.message}`)
    }
  }

  // -------------------- Fetch Wallet Balance --------------------
  useEffect(() => {
    if (!userFriendlyAddress) {
      setMapBalance(0)
      return
    }

    const fetchMapBalance = async () => {
      try {
        const response = await fetch('http://localhost:8080/balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: userFriendlyAddress }),
        })

        if (!response.ok) throw new Error('Backend error')

        const data = await response.json()

        // 1. Get raw value
        const rawAmount = Number(data.amount) || 0

        // 2. ✅ Divide by 10^9 (1,000,000,000) to convert Nano -> Standard
        const humanReadableAmount = rawAmount / 1_000_000_000

        setMapBalance(humanReadableAmount)
      } catch (err) {
        console.error('❌ Error fetching wallet balance:', err)
        setMapBalance(0)
      }
    }

    fetchMapBalance()
  }, [userFriendlyAddress])

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
  } = state

  // -------------------- Memoized Styles --------------------
  const logoWrapperStyle = useMemo(
    () => ({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      width: '60%',
      position: 'relative',
      marginTop: '10px', // Reduced margin to fit header
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
      const allCards = await getCards()
      const deckData = (await getUserDeck('default')) || {
        cards: [],
        totalSynergy: 0,
      }

      const defaultDeckCards = deckData.cards
        .map((id) => allCards.find((c) => c.cardId === id))
        .filter(Boolean)
        .slice(0, 10)

      const totalSynergy = deckData.totalSynergy || 0
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
    if (!user?.userId) return

    const socket = initSocket(user.userId, (data) => {
      if (!data?.matchId) return
      navigate(`/battle/${data.matchId}`)
    })

    return () => {
      disconnectSocket()
    }
  }, [user, navigate])

  // -------------------------
  // 1️⃣ Setup animations DB + cache
  // -------------------------
  useEffect(() => {
    setupAnimationsDB()
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

  const handleMultiplayerBattle = useCallback(
    async (mode = 'normal') => {
      await runSafe(async () => {
        triggerHapticFeedback()

        if (!userFriendlyAddress) {
          return setState((prev) => ({
            ...prev,
            alertMessage: 'Please connect your TON wallet to play!',
          }))
        }

        const idbUser = await getCachedUserFromIDB()
        if (!idbUser) {
          return setState((prev) => ({
            ...prev,
            alertMessage: 'User data not found!',
          }))
        }

        const { cards: defaultDeckCards, totalSynergy } =
          await fetchDefaultDeckCards()
        if (defaultDeckCards.length !== 10) {
          return setState((prev) => ({
            ...prev,
            alertMessage:
              'You must have exactly 10 cards in your default deck!',
          }))
        }

        const tutorialCompleted =
          localStorage.getItem('tutorialCompleted') === 'true'

        const userQueueData = {
          ...idbUser,
          totalSynergy,
          mode,
          walletId: userFriendlyAddress, // ✅ always use connected wallet
        }

        const added = tutorialCompleted
          ? await joinQueue(userQueueData)
          : await joinTutorialQueue(userQueueData)

        if (!added) return

        setState((prev) => ({
          ...prev,
          isMatchmaking: true,
          activeModal: 'matchmaking',
        }))
      })
    },
    [getCachedUserFromIDB, runSafe, userFriendlyAddress]
  )

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
      '/new/tournament/claimBTN.png',
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

  // Withdraw Modal State

  // 1. Open the Modal
  const openWithdrawModal = () => {
    triggerHapticFeedback()
    if (!userFriendlyAddress) {
      alert('⚠️ Please connect your wallet first!')
      return
    }
    setWithdrawInput('') // Reset input
    setIsWithdrawModalOpen(true)
  }

  // 2. Execute the Transaction
  const executeWithdraw = async () => {
    triggerHapticFeedback()

    const amount = parseFloat(withdrawInput)

    // Validation
    if (isNaN(amount) || amount <= 0) {
      alert('❌ Invalid amount entered.')
      return
    }

    if (amount > mapBalance) {
      alert(
        `❌ Insufficient Balance! You have ${mapBalance.toLocaleString()} WARS.`
      )
      return
    }

    setIsWithdrawing(true)

    try {
      // Backend Call
      const response = await fetch('http://localhost:8080/withdraw-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount.toString() }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate transaction')
      }

      // Construct Transaction
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: data.transaction.to,
            amount: data.transaction.value,
            payload: data.transaction.payload,
          },
        ],
      }

      // Send to Wallet
      await tonConnectUI.sendTransaction(transaction)

      setIsWithdrawModalOpen(false) // Close modal on success
      alert('✅ Withdraw Request Sent! Check your wallet for confirmation.')
    } catch (err) {
      console.error('Withdraw failed:', err)
      if (!err.message.includes('User rejected')) {
        alert(`❌ Failed: ${err.message}`)
      }
    } finally {
      setIsWithdrawing(false)
    }
  }

  // -------------------- Render --------------------
  if (error) return <h2>{error}</h2>

  return (
    <div className="tournamentHome-container">
      {/* ✅ Features 2 & 3: Header (Wallet & Balance) */}

      {/* Logo */}
      <div style={logoWrapperStyle}>
        <img
          src="/new/tournament/tournamentLogo.png"
          alt="Tournament Header"
          style={logoImageStyle}
        />
      </div>

      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between', // Left and right alignment
          alignItems: 'center',
          width: '100%',
          paddingTop: '8px',
          paddingLeft: '5px',
          paddingRight: '5px',
        }}
      >
        {/* ✅ Withdraw Button (Left) */}
        <div
          onClick={openWithdrawModal} // ✅ Updated to open modal
          style={{
            backgroundImage: "url('/new/tournament/tournamentBtnTemp.png')",
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            width: '120px',
            height: '40px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            color: '#f1e19f',
            fontWeight: 'bold',
            fontSize: '1rem',
            textShadow: '0 2px 2px rgba(0,0,0,0.8)',
          }}
        >
          WITHDRAW
        </div>

        {/* Balance Display (Right) */}

        <div
          style={{
            backgroundImage: "url('/new/tournament/t3e.png')",
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            width: '120px',
            height: '40px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#f1e19f',
            fontWeight: 'bold',
            fontSize: '1.2rem',
            paddingRight: '20px',
            textShadow: '0 2px 2px rgba(0,0,0,0.8)',
          }}
        >
          {mapBalance?.toLocaleString() ?? 0}
        </div>
      </div>

      {/* Buttons */}
      <div className="tournamentHome-matchmaking-container">
        {/* ✅ Feature 1: Claim 50K Button (Conditional) */}
        {!isRewardClaimed && (
          <img
            src="/new/tournament/claimBTN.png"
            style={{
              dropShadow: '0 0 10px gold',
              cursor: 'pointer',
              marginBottom: '10px',
            }}
            onClick={handleClaimReward}
            alt="Claim 50K Reward"
          />
        )}

        <img
          src="/new/tournament/startbattleBtn.png"
          onClick={handlePlayNow}
          alt="Start Battle"
          style={{ cursor: 'pointer' }}
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
        <button
          onClick={handleButtonClick}
          style={{
            backgroundImage: "url('/new/tournament/tournamentBtnTemp.png')",
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundColor: 'transparent',
            width: '200px',
            height: '60px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#f1e19f',
            fontSize: '16px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            fontFamily: 'MedievalSharpBold, sans-serif',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
          }}
          className="walletConnectBTN"
        >
          {/* Text Overlay */}
          {wallet ? 'Disconnect' : 'Connect Wallet'}
        </button>

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

      {/* ----------------- WITHDRAW MODAL ----------------- */}
      {isWithdrawModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            fontFamily: 'MedievalSharp, cursive', // ✅ Feature: Medieval Font
          }}
          onClick={() => setIsWithdrawModalOpen(false)} // Close on background click
        >
          {/* Modal Content */}
          <div
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
            style={{
              backgroundImage: "url('/new/tournament/modalBg.png')", // ✅ Feature: Background
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              width: '320px',
              height: '300px', // Adjusted height for content
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              position: 'relative',
              color: '#f1e19f',
            }}
          >
            {/* Title */}
            <h2
              style={{
                margin: '0 0 20px 0',
                textShadow: '0 2px 4px black',
                fontSize: '1.5rem',
              }}
            >
              WITHDRAW WARS
            </h2>

            {/* Balance Info */}
            <p
              style={{ margin: '0 0 15px 0', fontSize: '0.9rem', opacity: 0.9 }}
            >
              Available: {mapBalance.toLocaleString()}
            </p>

            {/* Input Wrapper (using t3e.png) */}
            <div
              style={{
                backgroundImage: "url('/new/tournament/t3e.png')", // ✅ Feature: Input Background
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                width: '200px',
                height: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
              }}
            >
              <input
                type="number"
                value={withdrawInput}
                onChange={(e) => setWithdrawInput(e.target.value)}
                placeholder="Enter Amount"
                style={{
                  width: '90%',
                  height: '90%',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1.2rem',
                  textAlign: 'center',
                  fontFamily: 'MedievalSharp, cursive',
                  outline: 'none',
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '15px' }}>
              {/* Cancel Button */}
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #f1e19f',
                  color: '#f1e19f',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontFamily: 'MedievalSharp, cursive',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                CANCEL
              </button>

              {/* Confirm Button */}
              <button
                onClick={executeWithdraw}
                disabled={isWithdrawing}
                style={{
                  backgroundImage:
                    "url('/new/tournament/tournamentBtnTemp.png')",
                  backgroundSize: '100% 100%',
                  backgroundColor: 'transparent',
                  width: '100px',
                  height: '40px',
                  border: 'none',
                  color: '#f1e19f',
                  fontFamily: 'MedievalSharp, cursive',
                  fontWeight: 'bold',
                  cursor: isWithdrawing ? 'wait' : 'pointer',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isWithdrawing ? 0.7 : 1,
                }}
              >
                {isWithdrawing ? '...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(Tournament)
