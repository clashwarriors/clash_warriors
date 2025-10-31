import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { initializeUser } from './utils/firebaseSyncService'
import {
  TrackGroups,
  TwaAnalyticsProvider,
} from '@tonsolutions/telemetree-react'
import { clearGameMemory } from './utils/clearMemory'
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

// ==============================
// Full Screen Loader
// ==============================
const FullScreenLoading = () => (
  <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
    <img
      src="/loading.png"
      alt="Loading..."
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  </div>
)

// ==============================
// Main App Component
// ==============================
const App = () => {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('Loading... Please wait.')
  const [userInitialized, setUserInitialized] = useState(false)

  // Initialize Telegram + user session immediately
  useEffect(() => {
    const initTelegram = async () => {
      if (userInitialized) return
      try {
        const tg = window.Telegram?.WebApp
        if (!tg) return

        window.TelegramWebviewProxy?.postEvent(
          'web_app_request_fullscreen',
          '{}'
        )
        window.TelegramWebviewProxy?.postEvent(
          'web_app_setup_swipe_behavior',
          JSON.stringify({ allow_vertical_swipe: false })
        )

        tg.ready()
        tg.expand()
        tg.disableClosingConfirmation()
        tg.setHeaderColor('#000000')

        tg.BackButton?.show()
        tg.BackButton?.onClick(() => window.history.back())
        tg.SettingsButton?.show()
        tg.SettingsButton?.onClick(() => (window.location.href = '/settings'))

        const telegramUser = tg.initDataUnsafe?.user
        if (!telegramUser?.id) {
          console.warn('Telegram user not found')
          setStatus('Unable to fetch Telegram user.')
          return
        }

        setStatus('Syncing user data...')
        const { user } = await initializeUser(
          telegramUser.id.toString(),
          telegramUser,
          { skipStorage: true }
        )
        setUser(user)
        localStorage.setItem('userId', user.userId)

        setUserInitialized(true)
        setStatus('Ready!')
      } catch (err) {
        console.error('Telegram init failed:', err)
        setStatus('Initialization error.')
      }
    }
    initTelegram()
  }, [userInitialized])

  // Clear old cache once
  useEffect(() => {
    if (!localStorage.getItem('cacheClearM1')) {
      clearGameMemory()
      localStorage.setItem('cacheClearM1', 'true')
    }
  }, [])

  // Render Dashboard immediately if user not loaded yet
  const mainContent = useMemo(
    () => <MainContent user={user} status={status} />,
    [user, status]
  )

  if (!user) {
    return <FullScreenLoading />
  }

  return (
    <TwaAnalyticsProvider
      projectId="51c55184-0159-4632-9cbb-740dd8fcb14c"
      apiKey="7de1cdbb-494c-40df-acd2-ec4d89c97072"
      trackGroup={TrackGroups.MEDIUM}
    >
      <TonConnectUIProvider manifestUrl="https://play.clashwarriors.tech/tonconnect-manifest.json">
        <Router>
          <Suspense fallback={<FullScreenLoading />}>{mainContent}</Suspense>
        </Router>
      </TonConnectUIProvider>
    </TwaAnalyticsProvider>
  )
}

// ==============================
// Main Content / Routes
// ==============================
const MainContent = React.memo(({ user, status }) => {
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

  if (!user) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000',
          color: '#fff',
        }}
      >
        <img
          src="/loading.png"
          alt="Loading..."
          style={{ width: '200px', marginBottom: '20px' }}
        />
        <p>{status}</p>
      </div>
    )
  }

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

export default App
