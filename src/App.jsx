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
import { firestoreDB } from './firebase'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collectionGroup,
  getDocs,
  writeBatch,
} from 'firebase/firestore'
import { initializeLocalData } from './utils/syncService'
import { getUserData } from './utils/indexedDBService'
import { updateUserCardsFromMaster } from './utils/updater'
import {
  TrackGroups,
  TwaAnalyticsProvider,
} from '@tonsolutions/telemetree-react'

// ✅ Lazy loaded pages
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

// ==============================
// Main App Component
// ==============================
const App = () => {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('Loading... Please wait.')
  const [ready, setReady] = useState({
    timer: false,
    assets: false,
    data: false,
  })

  // 1️⃣ Timer for minimal splash delay
  useEffect(() => {
    const timer = setTimeout(
      () => setReady((prev) => ({ ...prev, timer: true })),
      2000
    )
    return () => clearTimeout(timer)
  }, [])

  // 2️⃣ Preload images & essential assets
  useEffect(() => {
    const preloadAssets = async () => {
      try {
        await preloadImagesToIDB(imageList) // IndexedDB caching
        // Preload main loading image
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

  // 3️⃣ Initialize Telegram WebApp + User Session
  useEffect(() => {
    const initTelegram = async () => {
      const tg = window.Telegram?.WebApp
      if (!tg) return

      // Telegram Setup
      tg.disableClosingConfirmation()
      tg.expand()
      tg.setHeaderColor('#000000')
      tg.BackButton.show()
      tg.BackButton.onClick(() => window.history.back())
      tg.SettingsButton.show().onClick(
        () => (window.location.href = '/settings')
      )

      const telegramUser = tg.initDataUnsafe?.user
      if (telegramUser) await handleUserSession(telegramUser)
    }

    initTelegram()
  }, [])

  // 4️⃣ Handle User Session + Firestore + IndexedDB
  const handleUserSession = async (tgUser) => {
    try {
      const userId = tgUser.id.toString()
      const userRef = doc(firestoreDB, 'users', userId)
      const userSnap = await getDoc(userRef)
      const existing = userSnap.exists() ? userSnap.data() : null

      const now = new Date()
      const newUser = {
        userId,
        first_name: tgUser.first_name || '',
        last_name: tgUser.last_name || '',
        username: tgUser.username || '',
        photo_url: tgUser.photo_url || '',
        coins: existing?.coins ?? 1000000,
        xp: existing?.xp ?? 0,
        pph: existing?.pph ?? 1500,
        level: existing?.level ?? 1,
        streak: existing?.streak ?? 0,
        tutorialDone: existing?.tutorialDone ?? false,
        registration_timestamp:
          existing?.registration_timestamp ?? now.toISOString(),
      }

      if (!existing) {
        await setDoc(userRef, newUser)
        await seedFreeCards(userId) // batch seed first 10 free cards
      } else {
        await updateDoc(userRef, newUser)
      }

      // Initialize IndexedDB + user cards
      await initializeLocalData(userId)
      await updateUserCardsFromMaster()
      const userData = await getUserData()
      setUser(userData)
      localStorage.setItem('userId', userId)
      setReady((prev) => ({ ...prev, data: true }))
    } catch (err) {
      console.error('User session failed:', err)
      setStatus('User verification error.')
    }
  }

  // 5️⃣ Seed Free Cards for New Users (Batch Write)
  const seedFreeCards = async (userId) => {
    try {
      const freeCardsSnap = await getDocs(collectionGroup(firestoreDB, 'cards'))
      const freeCards = freeCardsSnap.docs
        .filter((d) => d.ref.path.startsWith('free/'))
        .slice(0, 10)

      const batch = writeBatch(firestoreDB)
      freeCards.forEach((cardDoc) => {
        const userCardRef = doc(
          firestoreDB,
          `users/${userId}/cards/${cardDoc.id}`
        )
        batch.set(userCardRef, cardDoc.data())
      })
      await batch.commit()
    } catch (err) {
      console.error('Failed to seed free cards:', err)
    }
  }

  const isReady = ready.timer && ready.assets && ready.data
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
