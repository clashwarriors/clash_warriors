import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'
import {
  TwaAnalyticsProvider,
  TrackGroups,
} from '@tonsolutions/telemetree-react'
import { updateUserCardsFromMaster } from './utils/updater'
import { initializeUser } from './utils/firebaseSyncService'
import imageList from './assets/imageList.json'
import { preloadImagesToIDB } from './utils/imagePreloader'

// Lazy loaded pages
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

// Full Screen Loader
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
      />
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

// Main App (Local Mock)
const App = () => {
  const [user, setUser] = useState(null)
  const [cards, setCards] = useState([])
  const [status, setStatus] = useState('Loading... Please wait.')
  const [ready, setReady] = useState({
    timer: false,
    assets: false,
    data: false,
  })

  // Minimal splash timer
  useEffect(() => {
    const timer = setTimeout(
      () => setReady((prev) => ({ ...prev, timer: true })),
      1500
    )
    return () => clearTimeout(timer)
  }, [])

  // Preload assets
  useEffect(() => {
    const preloadAssets = async () => {
      try {
        await preloadImagesToIDB(imageList)
        const img = new Image()
        img.src = '/loading.png'
        await new Promise((res) => {
          img.onload = res
          img.onerror = res
        })
        setReady((prev) => ({ ...prev, assets: true }))
      } catch (err) {
        console.error('Asset preload error:', err)
      }
    }
    preloadAssets()
  }, [])

  // Initialize real Firestore user locally
  useEffect(() => {
    const initUser = async () => {
      try {
        // ✅ Replace this with your real Firestore userId
        const realUserId = '6845597761'

        // Initialize user & cards using firebaseSyncService
        const { user: finalUser, cards: finalCards } =
          await initializeUser(realUserId)
        if (!finalUser) return setStatus('Failed to initialize user.')

        setUser(finalUser)
        setCards(finalCards)
        setReady((prev) => ({ ...prev, data: true }))
      } catch (err) {
        console.error('Error initializing user:', err)
        setStatus('Initialization failed.')
      }
    }

    initUser()
  }, [])

  const isReady = ready.timer && ready.assets && ready.data
  const mainContent = useMemo(
    () => <MainContent user={user} cards={cards} status={status} />,
    [user, cards, status]
  )
  useEffect(() => {
    updateUserCardsFromMaster()
  })
  return (
    <TwaAnalyticsProvider
      projectId="51c55184-0159-4632-9cbb-740dd8fcb14c"
      apiKey="7de1cdbb-494c-40df-acd2-ec4d89c97072"
      trackGroup={TrackGroups.MEDIUM}
    >
      <Router>
        {!isReady ? (
          <FullScreenLoading />
        ) : (
          <Suspense fallback={<FullScreenLoading />}>{mainContent}</Suspense>
        )}
      </Router>
    </TwaAnalyticsProvider>
  )
}

// Routes / Main Content
const MainContent = React.memo(({ user, cards, status }) => {
  const location = useLocation()
  const hideFooterRoutes = [
    '/tournament',
    '/builddeck',
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
          element={
            <pages.Dashboard user={user} cards={cards} status={status} />
          }
        />
        <Route
          path="/airdrop"
          element={<pages.Airdrop user={user} cards={cards} status={status} />}
        />
        <Route
          path="/collections"
          element={
            <pages.Collections user={user} cards={cards} status={status} />
          }
        />
        <Route
          path="/friends"
          element={<pages.Friends user={user} cards={cards} status={status} />}
        />
        <Route
          path="/tournament"
          element={
            <pages.Tournament user={user} cards={cards} status={status} />
          }
        />
        <Route
          path="/tournament/:code"
          element={
            <pages.Tournament user={user} cards={cards} status={status} />
          }
        />
        <Route
          path="/daily-rewards"
          element={
            <pages.DailyRewards user={user} cards={cards} status={status} />
          }
        />
        <Route
          path="/daily-missions"
          element={
            <pages.DailyMissions user={user} cards={cards} status={status} />
          }
        />
        <Route
          path="/builddeck"
          element={
            <pages.BuildDeck user={user} cards={cards} status={status} />
          }
        />
        <Route
          path="/battle/:matchID"
          element={<pages.Battle user={user} cards={cards} status={status} />}
        />
        <Route
          path="/leaderboard"
          element={
            <pages.LeaderBoard user={user} cards={cards} status={status} />
          }
        />
        <Route
          path="/settings"
          element={<pages.Settings user={user} cards={cards} status={status} />}
        />
        <Route
          path="/premium"
          element={<pages.Premium user={user} cards={cards} />}
        />
      </Routes>
      {!hideFooter && <pages.Footer />}
    </>
  )
})

export default App
