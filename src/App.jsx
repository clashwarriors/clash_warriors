import React, { useState, useEffect, Suspense, lazy } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { initializeUser } from './utils/firebaseSyncService'
import {
  TrackGroups,
  TwaAnalyticsProvider,
} from '@tonsolutions/telemetree-react'
import { clearGameMemory } from './utils/clearMemory'

import Dashboard from './components/Dashboard'
import Footer from './components/Footer'
import Tournament from './components/Tournament'
import Premium from './components/Premium'
import FirebaseImage from './components/new'

// Lazy load
const Airdrop = lazy(() => import('./components/Airdrop'))
const Collections = lazy(() => import('./components/Collections'))
const Friends = lazy(() => import('./components/Friends'))
const DailyRewards = lazy(
  () => import('./components/DashComp/Daily/dailyRewards')
)
const DailyMissions = lazy(
  () => import('./components/DashComp/Daily/dailyMissions')
)
const BuildDeck = lazy(() => import('./components/tournament/BuildDeck'))
const Battle = lazy(() => import('./components/tournament/Battle'))
const LeaderBoard = lazy(() => import('./components/tournament/LeaderBoard'))
const Settings = lazy(() => import('./components/Settings'))

// ==============================
// App Component (Mock User)
// ==============================
function App() {
  const [user, setUser] = useState({
    userId: '6845597761',
  })
  const [status, setStatus] = useState('Ready!')

  // Telegram WebApp config (optional)
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.setHeaderColor('#000000')
      tg.BackButton.show()
      tg.BackButton.onClick(() => {
        if (window.history.length > 1) window.history.back()
        else tg.close()
      })
    }
  }, [])

  // Clear old cache once
  useEffect(() => {
    if (!localStorage.getItem('cacheClearM1')) {
      clearGameMemory()
      localStorage.setItem('cacheClearM1', 'true')
    }
  }, [])

  return (
    <TwaAnalyticsProvider
      projectId="51c55184-0159-4632-9cbb-740dd8fcb14c"
      apiKey="7de1cdbb-494c-40df-acd2-ec4d89c97072"
      trackGroup={TrackGroups.MEDIUM}
    >
      <TonConnectUIProvider manifestUrl="https://clashtesting.netlify.app/tonconnect-manifest.json">
        <Router>
          <Suspense fallback={<div>Loading...</div>}>
            <MainContent user={user} status={status} />
          </Suspense>
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
  const navigate = useNavigate()

  // Telegram Settings Button (mock)
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    tg?.ready()
    tg?.SettingsButton.show().onClick(() => navigate('/settings'))
    return () => tg?.SettingsButton.offClick?.()
  }, [navigate])

  const hideFooterPages = [
    '/tournament',
    '/builddeck',
    '/test-dashboard',
    '/battle',
    '/leaderboard',
    '/tutorial-battle',
  ]
  const shouldHideFooter = hideFooterPages.some((path) =>
    location.pathname.startsWith(path)
  )

  return (
    <div>
      <Routes>
        <Route path="/" element={<Dashboard user={user} status={status} />} />
        <Route
          path="/airdrop"
          element={<Airdrop user={user} status={status} />}
        />
        <Route
          path="/builddeck"
          element={<BuildDeck user={user} status={status} />}
        />
        <Route
          path="/collections"
          element={<Collections user={user} status={status} />}
        />
        <Route
          path="/friends"
          element={<Friends user={user} status={status} />}
        />
        <Route
          path="/tournament"
          element={<Tournament user={user} status={status} />}
        />
        <Route path="/tournament/:code" element={<Tournament user={user} />} />
        <Route
          path="/daily-rewards"
          element={<DailyRewards user={user} status={status} />}
        />
        <Route
          path="/daily-missions"
          element={<DailyMissions user={user} status={status} />}
        />
        <Route
          path="/battle/:matchID"
          element={<Battle user={user} status={status} />}
        />
        <Route
          path="/leaderboard"
          element={<LeaderBoard user={user} status={status} />}
        />
        <Route
          path="/premium"
          element={<Premium user={user} status={status} />}
        />
        <Route
          path="/settings"
          element={<Settings user={user} status={status} />}
        />
        <Route path="/new" element={<FirebaseImage />} />
      </Routes>
      {!shouldHideFooter && <Footer />}
    </div>
  )
})

export default App
