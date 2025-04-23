
import React, { useState, useEffect, Suspense, lazy } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { realtimeDB } from './firebase'
import { ref, onValue, set, onDisconnect } from 'firebase/database'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import Dashboard from './components/Dashboard'
import Footer from './components/Footer'
import Tournament from './components/Tournament'
import Premium from './components/Premium'
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
const DailyBattle = lazy(
  () => import('./components/DashComp/Daily/dailyBattle')
)
const Collector = lazy(() => import('./components/collector'))
const MyCollection = lazy(() => import('./components/MyCollection'))
const BuildDeck = lazy(() => import('./components/tournament/BuildDeck'))
const Battle = lazy(() => import('./components/tournament/Battle'))
const LeaderBoard = lazy(() => import('./components/tournament/LeaderBoard'))
const Settings = lazy(() => import('./components/Settings'))
function App() {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('Loading... Please wait.')

  useEffect(() => {
    const mockUserId = '1029871417' // Mock user ID

    const fetchUserData = async (userId) => {
      try {
        const realtimeUserRef = ref(realtimeDB, `users/${userId}`)
        onValue(realtimeUserRef, (snapshot) => {
          if (snapshot.exists()) {
            const realtimeData = snapshot.val()
            setUser(realtimeData)
            setStatus('User data loaded.')
          } else {
            setStatus('User not found.')
          }
        })

        // Track user online status at `users/{userId}/status`
        const userStatusRef = ref(realtimeDB, `users/${userId}/status`)
        const offTimeRef = ref(realtimeDB, `users/${userId}/offTime`)

        set(userStatusRef, 'online') // Set user status as online

        // Ensure user status goes to offline when they disconnect
        const disconnectTime = Date.now() // Get the current timestamp for offTime

        onDisconnect(userStatusRef).set('offline')

        // Directly set the last offline timestamp
        onDisconnect(offTimeRef).set(disconnectTime) // Store the current time as offTime

        console.log('User offline time tracking set.')
      } catch (error) {
        console.error('Error fetching user data: ', error)
        setStatus('Failed to fetch user data.')
      }
    }

    fetchUserData(mockUserId)
  }, [])

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

    //console.log("Telegram WebApp detected. UI elements updated.");
  } else {
    //console.warn("Not running inside Telegram WebApp.");
  }


  if (!user) {
    return (
      <div>
        <img
          src="/loading.png"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            position: 'absolute',
            top: 0,
          }}
          alt="Loading"
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
  const navigate = useNavigate();

  useEffect(() => {
    const tg = window.Telegram.WebApp;

    tg.ready();

    // Show "Settings" in ⋯ menu and handle click
    tg.SettingsButton
      .show()
      .onClick(() => {
        console.log("Settings button clicked");
        navigate("/settings");
      });

    // Clean up on unmount
    return () => {
      tg.SettingsButton.offClick();
    };
  }, [navigate]);

  // Using a more generic way to determine the pages that should not show the footer
  const hideFooterPages = [
    '/tournament',
    '/builddeck',
    '/test-dashboard',
    '/battle',
    '/leaderboard',
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
          path="/daily-battle"
          element={<DailyBattle user={user} status={status} />}
        />
        <Route
          path="/collector"
          element={<Collector user={user} status={status} />}
        />
        <Route
          path="/mycollection"
          element={<MyCollection user={user} status={status} />}
        />
        <Route
          path="/builddeck"
          element={<BuildDeck user={user} status={status} />}
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
      </Routes>

      {!shouldHideFooter && <Footer />}
    </div>
  )
})

export default App
