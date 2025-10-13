import React, { useState, useEffect, Suspense, lazy } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { getUserData } from './utils/indexedDBService'
import imageList from './assets/imageList'
import { preloadImagesToIDB } from './utils/imagePreloader'

import Dashboard from './components/Dashboard'
import Footer from './components/Footer'
import Tournament from './components/Tournament'
import Premium from './components/Premium'
import FirebaseImage from './components/new'
import {
  TrackGroups,
  TwaAnalyticsProvider,
} from '@tonsolutions/telemetree-react'

// Lazy load components
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

function App() {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('Loading... Please wait.')
  const [assetsReady, setAssetsReady] = useState(false)

  // ✅ MOCK USER LOADING FROM INDEXEDDB / FIRESTORE
  useEffect(() => {
    const MOCK_USER_ID = '6845597761' // your real userId
    const loadUser = async () => {
      try {
        const userData = await getUserData(MOCK_USER_ID) // directly fetch by userId
        if (userData) {
          setUser(userData)
          setStatus('Data loaded from local DB.')
        } else {
          setStatus('User not found locally.')
        }
      } catch (err) {
        console.error('Failed to load user:', err)
        setStatus('Error loading user data.')
      }
    }

    loadUser()
  }, [])

  // Coin generator logic
  useEffect(() => {
    const handleOnline = () => startCoinGenerator()
    const handleOffline = () => stopCoinGenerator()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Telegram WebApp config (optional, can leave as mock)
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp
    tg.setHeaderColor('#000000')
    tg.BackButton.show()
    tg.BackButton.onClick(() => {
      if (window.history.length > 1) window.history.back()
      else tg.close()
    })
  }

  useEffect(() => {
    const loadAssets = async () => {
      try {
        await preloadImagesToIDB(imageList)
        setAssetsReady(true)
      } catch (error) {
        console.error('Error preloading assets:', error)
        setStatus('Error loading assets.')
      }
    }
    loadAssets()
  }, [])

  if (!user || !assetsReady) {
    return (
      <div>
        <img
          src="/loading.png"
          alt="Loading"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            position: 'absolute',
            top: 0,
          }}
        />
      </div>
    )
  }

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

const MainContent = React.memo(({ user, status }) => {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    tg?.ready()
    tg?.SettingsButton.show().onClick(() => navigate('/settings'))
    return () => tg?.SettingsButton.offClick()
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
