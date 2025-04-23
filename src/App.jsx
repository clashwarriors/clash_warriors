import React, { useState, useEffect } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'
import { realtimeDB } from './firebase'
import { ref, set, get, onDisconnect, update } from 'firebase/database'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import Dashboard from './components/Dashboard'
import Footer from './components/Footer'
import Tournament from './components/Tournament'
import Airdrop from './components/Airdrop'
import Collections from './components/Collections'
import Friends from './components/Friends'
import DailyRewards from './components/DashComp/Daily/dailyRewards'
import DailyMissions from './components/DashComp/Daily/dailyMissions'
import DailyBattle from './components/DashComp/Daily/dailyBattle'
import Collector from './components/collector'
import MyCollection from './components/MyCollection'
import BuildDeck from './components/tournament/BuildDeck'
import Battle from './components/tournament/Battle'
import LeaderBoard from './components/tournament/LeaderBoard'
import Settings from './components/Settings'
import Premium from './components/Premium'
import Stars from './components/Stars'

function App() {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('Loading... Please wait.')
  const [isDataFetched, setIsDataFetched] = useState(false)

  // useEffect(() => {
  //   // Check if the user is inside Telegram Webview
  //   const isTelegramWebview = /Telegram/.test(navigator.userAgent);

  //   // If not in Webview, redirect the user to another link
  //   if (!isTelegramWebview) {
  //     window.location.href = "https://share.clashwarriors.tech/invite/1029871417"; // Replace with your desired URL
  //   }
  // }, []);

  useEffect(() => {
    const tg = window.Telegram.WebApp
    if (tg) {
      tg.expand()
      tg.setHeaderColor('#000000')
      tg.BackButton.show()
      // Handle back button click
      tg.BackButton.onClick(() => {
        window.history.back()
      })

      const swipeBehaviorEvent = {
        eventType: 'web_app_setup_swipe_behavior',
        eventData: {
          allow_vertical_swipe: false,
        },
      };
      
      window.parent.postMessage(JSON.stringify(swipeBehaviorEvent), 'https://web.telegram.org');
      
      tg.SettingsButton.show().onClick(() => {
        // Your in-app settings logic here
        // Navigate to settings page or open modal
        window.location.href = '/settings' // Or use a router if you have one
      })

      const telegramUser = tg.initDataUnsafe?.user
      if (telegramUser) {
        setStatus('Verifying user...')
        console.log('Telegram User Info:', telegramUser)
        verifyUserAndStartSession(telegramUser, telegramUser.id.toString())
      } else {
        setStatus('Failed to verify user.')
        console.log('Telegram user is undefined or not found.')
      }
    }
  }, [])

  const verifyUserAndStartSession = async (telegramUser, userId) => {
    const realtimeUserRef = ref(realtimeDB, `users/${userId}`)
    const userStatusRef = ref(realtimeDB, `users/${userId}/status`)
    const userOffTimeRef = ref(realtimeDB, `users/${userId}/offTime`) // Ref for offTime
    const userCardsRef = ref(realtimeDB, `users/${userId}/cards`)
    const freeCardsRef = ref(realtimeDB, `free/`)

    try {
      setStatus('Checking user in Firebase...')
      console.log('Verifying user with ID:', userId)

      const snapshot = await get(realtimeUserRef)
      let existingUserData = snapshot.exists() ? snapshot.val() : null
      const now = new Date()

      let newUserData = {
        first_name: telegramUser.first_name || 'Unknown',
        last_name: telegramUser.last_name || '',
        username: telegramUser.username || '',
        photo_url: telegramUser.photo_url || '',
        userId: userId || 'Unknown',
        coins: existingUserData?.coins ?? 100000,
        coinAdd: existingUserData?.coinAdd ?? 20,
        tapped: existingUserData?.tapped ?? 100,
        taps: existingUserData?.taps ?? 100,
        totalSynergy: existingUserData?.totalSynergy ?? 0,
        level: existingUserData?.level ?? 1,
        xp: existingUserData?.xp ?? 0,
        league: existingUserData?.league ?? 'bronze',
        pph: existingUserData?.pph ?? 1500,
        registration_timestamp:
          existingUserData?.registration_timestamp ?? now.toISOString(),
        maxRefills: existingUserData?.maxRefills ?? 2,
        elo: existingUserData?.elo ?? 1200,
        usedRefills: existingUserData?.usedRefills ?? 0,
        userTimeZone:
          existingUserData?.userTimeZone ??
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        lastResetUTC: existingUserData?.lastResetUTC ?? null,
        streak: existingUserData?.streak ?? 0,
        tutorialDone: existingUserData?.tutorialDone ?? false,
        wins: existingUserData?.wins ?? 0,
      }

      if (!existingUserData || Object.keys(existingUserData).length === 0) {
        console.log('❌ No user found. Creating new user...')
        await set(realtimeUserRef, newUserData)
        console.log('✅ New user data saved successfully.')
      } else {
        console.log('✅ User found, updating missing fields...')
        await update(realtimeUserRef, newUserData)
      }

      if (!existingUserData || !existingUserData.cards) {
        console.log('📦 Checking for free cards...')
        const freeCardsSnapshot = await get(freeCardsRef)

        if (freeCardsSnapshot.exists()) {
          console.log('✅ Free cards found. Assigning to user...')
          const freeCardsData = freeCardsSnapshot.val()
          let userCards = {}
          Object.keys(freeCardsData).forEach((category) => {
            Object.keys(freeCardsData[category]).forEach((cardId) => {
              userCards[cardId] = freeCardsData[category][cardId]
            })
          })

          await set(userCardsRef, userCards)
          console.log('✅ Free cards assigned to new user.')
        } else {
          console.log('❌ No free cards found.')
        }
      }

      localStorage.setItem('userId', userId)
      setUser(newUserData)
      setIsDataFetched(true)

      console.log('🔄 Setting user status to online...')
      await set(userStatusRef, 'online')
      onDisconnect(userStatusRef).set('offline')

      // Track offTime using onDisconnect to ensure it's set properly when the user disconnects
      const offTime = Date.now()
      onDisconnect(userOffTimeRef).set(offTime) // Set offTime when the user disconnects

      console.log('✅ User status set to online and offTime set.')
    } catch (error) {
      console.error('❌ Error verifying user:', error)
      setStatus('Failed to verify user.')
    }
  }

  if (!isDataFetched) {
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
    <TonConnectUIProvider manifestUrl="https://clashwarriors.tech/tonconnect-manifest.json">
      <Router>
        <MainContent user={user} status={status} />
      </Router>
    </TonConnectUIProvider>
  )
}

const MainContent = React.memo(({ user, status }) => {
  const location = useLocation()

  const hideFooterPages = [
    '/tournament',
    '/builddeck',
    '/test-dashboard',
    '/battle',
    '/leaderboard',
  ]
  const shouldHideFooter = hideFooterPages.some((page) =>
    location.pathname.startsWith(page)
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
          path="/settings"
          element={<Settings user={user} status={status} />}
        />
        <Route path="/stars" element={<Stars user={user} status={status} />} />
        <Route
          path="/premium"
          element={<Premium user={user} status={status} />}
        />
      </Routes>

      {!shouldHideFooter && <Footer />}
    </div>
  )
})

export default App
