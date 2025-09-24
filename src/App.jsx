import React, { useState, useEffect, Suspense, lazy } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { preloadImagesToIDB } from './utils/imagePreloader'
import { getUserData } from './utils/indexedDBService'
import { initializeLocalData } from './utils/syncService'
import { startCoinGenerator, stopCoinGenerator } from './utils/pphScript'
import { updateFreeCardImages } from './utils/imageHelper'
import imageList from './assets/imageList.json'

import Dashboard from './components/Dashboard'
import Footer from './components/Footer'
import Tournament from './components/Tournament'
import Premium from './components/Premium'
import FirebaseImage from './components/new'

import TutorialBattle from './components/tournament/tutorials/tutorialBattle'

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

  useEffect(() => {
    const mockUserId = '6845597761'

    // Update free card images in IndexedD

    const initializeApp = async () => {
      try {
        await initializeLocalData(mockUserId, false)
        const userData = await getUserData() // Load from IndexedDB
        setUser(userData)
        setStatus('Data initialized.')
      } catch (err) {
        console.error('Initialization failed:', err)
        setStatus('Error during initialization.')
      }
    }

    initializeApp()
  }, [])

  useEffect(() => {
    updateFreeCardImages()
  }, [])

  useEffect(() => {
    if (navigator.onLine) startCoinGenerator()

    const handleOnline = () => startCoinGenerator()
    const handleOffline = () => stopCoinGenerator()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      stopCoinGenerator()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Telegram WebApp initialization and configuration
  if (window.Telegram?.WebApp?.initData) {
    const tg = window.Telegram.WebApp

    // Set Telegram header color
    tg.setHeaderColor('#000000')

    // Show the Telegram Back Button
    tg.BackButton.show()

    // Handle Telegram Back Button Click
    tg.BackButton.onClick(() => {
      if (window.history.length > 1) {
        window.history.back() // Go back if there's history
      } else {
        tg.close() // Close the WebApp if no history is available
      }
    })
  }

  // Load and preload assets
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

  // Render loading screen while user data or assets are not ready
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
    <TonConnectUIProvider manifestUrl="https://clashtesting.netlify.app/tonconnect-manifest.json">
      <Router>
        <Suspense fallback={<div>Loading...</div>}>
          <MainContent user={user} status={status} />
        </Suspense>
      </Router>
    </TonConnectUIProvider>
  )
}

const MainContent = React.memo(({ user, status }) => {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const tg = window.Telegram.WebApp

    tg.ready()

    // Show "Settings" in ⋯ menu and handle click
    tg.SettingsButton.show().onClick(() => {
      console.log('Settings button clicked')
      navigate('/settings')
    })

    // Clean up on unmount
    return () => {
      tg.SettingsButton.offClick()
    }
  }, [navigate])

  // Determine whether to hide footer
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
        <Route path="/tutorial-battle" element={<TutorialBattle />} />
        <Route path="/new" element={<FirebaseImage />} />
      </Routes>

      {/* Conditionally hide the footer based on the page */}
      {!shouldHideFooter && <Footer />}
    </div>
  )
})

export default App
