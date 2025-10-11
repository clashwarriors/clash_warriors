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
import { initializeUser } from './utils/firebaseSyncService'
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
  const [userInitialized, setUserInitialized] = useState(false)

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
  // useEffect(() => {
  //   const initTelegram = async () => {
  //     try {
  //       const tg = window.Telegram?.WebApp
  //       if (!tg) {
  //         console.warn(
  //           'Telegram WebApp not detected — app runs only inside Telegram.'
  //         )
  //         return
  //       }

  //       // Fullscreen & swipe setup
  //       if (window.TelegramWebviewProxy?.postEvent) {
  //         window.TelegramWebviewProxy.postEvent(
  //           'web_app_setup_back_button',
  //           JSON.stringify({ is_visible: true })
  //         )
  //         window.TelegramWebviewProxy.postEvent(
  //           'web_app_request_fullscreen',
  //           '{}'
  //         )
  //         window.TelegramWebviewProxy.postEvent(
  //           'web_app_setup_swipe_behavior',
  //           JSON.stringify({ allow_vertical_swipe: false })
  //         )
  //       }

  //       // Telegram setup
  //       tg.ready()
  //       tg.expand()
  //       tg.disableClosingConfirmation()
  //       tg.setHeaderColor('#000000')

  //       if (tg.BackButton) {
  //         tg.BackButton.show()
  //         tg.BackButton.onClick(() => {
  //           try {
  //             window.history.back()
  //           } catch {
  //             tg.BackButton.hide()
  //           }
  //         })
  //       }

  //       if (tg.SettingsButton) {
  //         tg.SettingsButton.show()
  //         tg.SettingsButton.onClick(() => {
  //           window.location.href = '/settings'
  //         })
  //       }

  //       // Fetch Telegram user
  //       const telegramUser = tg.initDataUnsafe?.user
  //       if (!telegramUser?.id) {
  //         console.warn('⚠️ Telegram user not found.')
  //         setStatus('Unable to fetch Telegram user.')
  //         return
  //       }

  //       setStatus('Syncing user data...')
  //       const { user } = await handleUserSession(telegramUser)
  //       setUser(user)
  //       localStorage.setItem('userId', user.userId)
  //       setReady((prev) => ({ ...prev, data: true }))
  //       setStatus('Ready!')
  //     } catch (err) {
  //       console.error('❌ Telegram init failed:', err)
  //       setStatus('Initialization error.')
  //     }
  //   }

  //   initTelegram()
  // }, [])

  useEffect(() => {
    const initTelegram = async () => {
      if (userInitialized) return // ✅ already initialized, skip

      try {
        const tg = window.Telegram?.WebApp
        if (!tg) {
          console.warn(
            'Telegram WebApp not detected — app runs only inside Telegram.'
          )
          return
        }

        // Fullscreen & swipe setup (keep your existing code)
        if (window.TelegramWebviewProxy?.postEvent) {
          window.TelegramWebviewProxy.postEvent(
            'web_app_setup_back_button',
            JSON.stringify({ is_visible: true })
          )
          window.TelegramWebviewProxy.postEvent(
            'web_app_request_fullscreen',
            '{}'
          )
          window.TelegramWebviewProxy.postEvent(
            'web_app_setup_swipe_behavior',
            JSON.stringify({ allow_vertical_swipe: false })
          )
        }

        tg.ready()
        tg.expand()
        tg.disableClosingConfirmation()
        tg.setHeaderColor('#000000')

        if (tg.BackButton) {
          tg.BackButton.show()
          tg.BackButton.onClick(() => {
            try {
              window.history.back()
            } catch {
              tg.BackButton.hide()
            }
          })
        }

        if (tg.SettingsButton) {
          tg.SettingsButton.show()
          tg.SettingsButton.onClick(() => {
            window.location.href = '/settings'
          })
        }

        const telegramUser = tg.initDataUnsafe?.user
        if (!telegramUser?.id) {
          console.warn('⚠️ Telegram user not found.')
          setStatus('Unable to fetch Telegram user.')
          return
        }

        setStatus('Syncing user data...')
        const { user } = await handleUserSession(telegramUser)
        setUser(user)
        localStorage.setItem('userId', user.userId)
        setReady((prev) => ({ ...prev, data: true }))
        setStatus('Ready!')

        setUserInitialized(true) // ✅ mark as initialized
      } catch (err) {
        console.error('❌ Telegram init failed:', err)
        setStatus('Initialization error.')
      }
    }

    initTelegram()
  }, [userInitialized])

  // 4️⃣ Handle User Session
  const handleUserSession = async (telegramUser) => {
    try {
      const userId = telegramUser.id.toString()
      const result = await initializeUser(userId, telegramUser)

      if (!result?.user) throw new Error('User initialization failed')

      // ✅ Optional: seed free cards if brand-new user
      if (
        (result.user.coins || 0) === 1000000 &&
        (!result.cards || result.cards.length === 0)
      ) {
        await seedFreeCards(userId)
      }

      console.log('✅ User session initialized:', result.user)
      return result
    } catch (err) {
      console.error('❌ User session error:', err)
      setStatus('User sync failed.')
      return { user: null, cards: [] }
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
