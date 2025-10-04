import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { preloadImagesToIDB } from './utils/imagePreloader'
import imageList from './assets/imageList.json'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collectionGroup,
  getDocs,
  collection,
} from 'firebase/firestore'
import { firestoreDB } from './firebase'
import { initializeLocalData } from './utils/syncService'
import { getUserData } from './utils/indexedDBService'
import { updateFreeCardImages } from './utils/imageHelper'
import {
  TrackGroups,
  TwaAnalyticsProvider,
} from '@tonsolutions/telemetree-react'
// ✅ Lazy Load Pages
const pages = {
  Dashboard: lazy(() => import('./components/Dashboard')),
  Footer: lazy(() => import('./components/Footer')),
  Tournament: lazy(() => import('./components/Tournament')),
  Airdrop: lazy(() => import('./components/Airdrop')),
  Collections: lazy(() => import('./components/Collections')),
  Friends: lazy(() => import('./components/Friends')),
  DailyRewards: lazy(() => import('./components/DashComp/Daily/dailyRewards')),
  DailyMissions: lazy(
    () => import('./components/DashComp/Daily/dailyMissions')
  ),
  BuildDeck: lazy(() => import('./components/tournament/BuildDeck')),
  Battle: lazy(() => import('./components/tournament/Battle')),
  LeaderBoard: lazy(() => import('./components/tournament/LeaderBoard')),
  Settings: lazy(() => import('./components/Settings')),
  Premium: lazy(() => import('./components/Premium')),
}

const App = () => {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('Loading... Please wait.')
  const [readyState, setReadyState] = useState({
    data: false,
    assets: false,
    timer: false,
  })

  useEffect(() => {
    const timer = setTimeout(
      () => setReadyState((prev) => ({ ...prev, timer: true })),
      2000
    )
    preloadAll()
    initializeTelegram()
    return () => clearTimeout(timer)
  }, [])

  const preloadAll = async () => {
    await preloadImagesToIDB(imageList)
    await Promise.all(Object.values(pages).map((p) => p.preload?.()))
    const loadingImg = new Image()
    loadingImg.src = '/loading.png'
    await new Promise((res) => {
      loadingImg.onload = res
      loadingImg.onerror = res
    })
    setReadyState((prev) => ({ ...prev, assets: true }))
  }

  const initializeTelegram = async () => {
    const tg = window.Telegram.WebApp
    if (!tg) return

    if (window.TelegramWebviewProxy?.postEvent) {
      const data = JSON.stringify({ is_visible: true })
      window.TelegramWebviewProxy.postEvent('web_app_setup_back_button', data)

      // Request fullscreen mode
      window.TelegramWebviewProxy.postEvent('web_app_request_fullscreen', '{}')
      window.TelegramWebviewProxy.postEvent(
        'web_app_setup_swipe_behavior',
        JSON.stringify({ allow_vertical_swipe: false })
      )
    }

    tg.disableClosingConfirmation()
    tg.expand()
    tg.setHeaderColor('#000000')
    tg.BackButton.show()
    tg.BackButton.onClick(() => window.history.back())
    tg.SettingsButton.show().onClick(() => {
      window.location.href = '/settings'
    })

    const telegramUser = tg.initDataUnsafe?.user
    if (telegramUser) {
      setStatus('Verifying user...')
      await handleUserSession(telegramUser, telegramUser.id.toString())
    } else {
      setStatus('Failed to verify user.')
    }
  }

  const handleUserSession = async (telegramUser, userId) => {
    try {
      const userRef = doc(firestoreDB, 'users', userId)
      const userSnap = await getDoc(userRef)

      const now = new Date()
      const existing = userSnap.exists() ? userSnap.data() : null

      const newUser = {
        userId,
        first_name: telegramUser.first_name || '',
        last_name: telegramUser.last_name || '',
        username: telegramUser.username || '',
        photo_url: telegramUser.photo_url || '',
        coins: existing?.coins ?? 1000000,
        coinAdd: existing?.coinAdd ?? 20,
        tapped: existing?.tapped ?? 100,
        taps: existing?.taps ?? 100,
        totalSynergy: existing?.totalSynergy ?? 0,
        level: existing?.level ?? 1,
        xp: existing?.xp ?? 0,
        league: existing?.league ?? 'bronze',
        pph: existing?.pph ?? 1500,
        registration_timestamp:
          existing?.registration_timestamp ?? now.toISOString(),
        maxRefills: existing?.maxRefills ?? 2,
        elo: existing?.elo ?? 1200,
        usedRefills: existing?.usedRefills ?? 0,
        userTimeZone:
          existing?.userTimeZone ??
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        lastResetUTC: existing?.lastResetUTC ?? null,
        streak: existing?.streak ?? 0,
        tutorialDone: existing?.tutorialDone ?? false,
        wins: existing?.wins ?? 0,
      }

      if (!existing) {
        await setDoc(userRef, newUser)

        // ✅ Step 1: Get all free cards ONLY from free/**
        const freeCardsSnap = await getDocs(
          collectionGroup(firestoreDB, 'cards')
        )

        const freeCards = freeCardsSnap.docs.filter((doc) =>
          doc.ref.path.startsWith('free/')
        )

        const userCards = []
        let count = 0

        for (const docSnap of freeCards) {
          if (count >= 10) break // ✅ Only store first 10 cards

          const cardData = docSnap.data()
          const cardId = docSnap.id

          // ✅ Step 2: Save to Firestore under user
          const userCardRef = doc(
            firestoreDB,
            `users/${userId}/cards/${cardId}`
          )
          await setDoc(userCardRef, cardData)

          // ✅ Step 3: Add to array for IndexedDB
          userCards.push({ id: cardId, ...cardData })

          count++
        }
      } else {
        await updateDoc(userRef, newUser)
      }

      if (existing) {
        // Check if user has < 10 cards
        const userCardsSnap = await getDocs(
          collection(firestoreDB, `users/${userId}/cards`)
        )

        if (userCardsSnap.size < 10) {
          // Fetch free cards to top up from free/**
          const freeCardsSnap = await getDocs(
            collectionGroup(firestoreDB, 'cards')
          )

          // Filter to only free cards and exclude cards already owned
          const userOwnedCardIds = new Set(
            userCardsSnap.docs.map((doc) => doc.id)
          )
          const freeCards = freeCardsSnap.docs.filter(
            (doc) =>
              doc.ref.path.startsWith('free/') && !userOwnedCardIds.has(doc.id)
          )

          let count = 0
          for (const docSnap of freeCards) {
            if (count >= 10 - userCardsSnap.size) break

            const cardData = docSnap.data()
            const cardId = docSnap.id

            const userCardRef = doc(
              firestoreDB,
              `users/${userId}/cards/${cardId}`
            )
            await setDoc(userCardRef, cardData)

            count++
          }
        }
      }

      // ✅ Final steps
      await initializeLocalData(userId)
      const userData = await getUserData()
      localStorage.setItem('userId', userId)
      setUser(userData)
      setReadyState((prev) => ({ ...prev, data: true }))
    } catch (err) {
      console.error('User verification failed:', err)
      setStatus('User session error.')
    }
  }

  // useEffect(() => {
  //   updateFreeCardImages()
  // }, [])

  const isReady = readyState.data && readyState.assets && readyState.timer
  const mainContent = useMemo(
    () => <MainContent user={user} status={status} />,
    [user, status]
  )

  return (
    <TwaAnalyticsProvider
      projectId="51c55184-0159-4632-9cbb-740dd8fcb14c"
      apiKey="7de1cdbb-494c-40df-acd2-ec4d89c97072"
      trackGroup={TrackGroups.MEDIUM}
    >
      <TonConnectUIProvider manifestUrl="https://play.clashwarriors.tech/tonconnect-manifest.json">
        <Router>
          {!isReady ? (
            <FullScreenLoading />
          ) : (
            <Suspense fallback={<FullScreenLoading />}>{mainContent}</Suspense>
          )}
        </Router>
      </TonConnectUIProvider>
    </TwaAnalyticsProvider>
  )
}

const MainContent = React.memo(({ user, status }) => {
  const location = useLocation()
  const hideFooterRoutes = [
    '/tournament',
    '/builddeck',
    '/test-dashboard',
    '/battle',
    '/leaderboard',
    '/airdrop',
    '/premium',
  ]
  const hideFooter = hideFooterRoutes.some((path) =>
    location.pathname.startsWith(path)
  )

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={<pages.Dashboard user={user} status={status} />}
        />
        <Route
          path="/airdrop"
          element={<pages.Airdrop user={user} status={status} />}
        />
        <Route
          path="/collections"
          element={<pages.Collections user={user} status={status} />}
        />
        <Route
          path="/friends"
          element={<pages.Friends user={user} status={status} />}
        />
        <Route
          path="/tournament"
          element={<pages.Tournament user={user} status={status} />}
        />
        <Route
          path="/tournament"
          element={<pages.Tournament user={user} status={status} />}
        />
        <Route
          path="/tournament/:code"
          element={<pages.Tournament user={user} status={status} />}
        />

        <Route
          path="/daily-rewards"
          element={<pages.DailyRewards user={user} status={status} />}
        />
        <Route
          path="/daily-missions"
          element={<pages.DailyMissions user={user} status={status} />}
        />
        <Route
          path="/builddeck"
          element={<pages.BuildDeck user={user} status={status} />}
        />
        <Route
          path="/battle/:matchID"
          element={<pages.Battle user={user} status={status} />}
        />
        <Route
          path="/leaderboard"
          element={<pages.LeaderBoard user={user} status={status} />}
        />
        <Route
          path="/settings"
          element={<pages.Settings user={user} status={status} />}
        />
        <Route path="/premium" element={<pages.Premium user={user} />} />
      </Routes>
      {!hideFooter && <pages.Footer />}
    </>
  )
})

const FullScreenLoading = () => (
  <div
    style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000',
      position: 'relative',
    }}
  >
    <img
      src="/loading.png"
      alt="Loading..."
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        position: 'absolute',
        zIndex: 1,
      }}
    />
    <div
      style={{
        position: 'absolute',
        bottom: '50px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '70%',
        height: '6px',
        background: '#444',
        borderRadius: '5px',
        overflow: 'hidden',
        zIndex: 2,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, #00f0ff, #00ff73)',
          animation: 'railAnimation 2s infinite',
        }}
      ></div>
    </div>
    <style>{`
      @keyframes railAnimation {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(0%); }
        100% { transform: translateX(100%); }
      }
    `}</style>
  </div>
)

export default App
