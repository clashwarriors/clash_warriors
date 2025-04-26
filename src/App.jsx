import React, { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { realtimeDB } from "./firebase";
import { ref, set, get, onDisconnect, update } from "firebase/database";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

// Lazy Loaded Pages
const Dashboard = lazy(() => import("./components/Dashboard"));
const Footer = lazy(() => import("./components/Footer"));
const Tournament = lazy(() => import("./components/Tournament"));
const Airdrop = lazy(() => import("./components/Airdrop"));
const Collections = lazy(() => import("./components/Collections"));
const Friends = lazy(() => import("./components/Friends"));
const DailyRewards = lazy(() => import("./components/DashComp/Daily/dailyRewards"));
const DailyMissions = lazy(() => import("./components/DashComp/Daily/dailyMissions"));
const DailyBattle = lazy(() => import("./components/DashComp/Daily/dailyBattle"));
const Collector = lazy(() => import("./components/collector"));
const MyCollection = lazy(() => import("./components/MyCollection"));
const BuildDeck = lazy(() => import("./components/tournament/BuildDeck"));
const Battle = lazy(() => import("./components/tournament/Battle"));
const LeaderBoard = lazy(() => import("./components/tournament/LeaderBoard"));
const Settings = lazy(() => import("./components/Settings"));
const Premium = lazy(() => import("./components/Premium"));

function App() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("Loading... Please wait.");
  const [isDataFetched, setIsDataFetched] = useState(false);

  useEffect(() => {
    const tg = window.Telegram.WebApp;
    if (tg) {
      tg.expand();
      tg.setHeaderColor("#000000");
      tg.BackButton.show();
      tg.BackButton.onClick(() => window.history.back());

      tg.SettingsButton.show().onClick(() => {
        window.location.href = "/settings";
      });

      const telegramUser = tg.initDataUnsafe?.user;
      if (telegramUser) {
        setStatus("Verifying user...");
        verifyUserAndStartSession(telegramUser, telegramUser.id.toString());
      } else {
        setStatus("Failed to verify user.");
      }
    }
  }, []);

  const verifyUserAndStartSession = async (telegramUser, userId) => {
    const userRef = ref(realtimeDB, `users/${userId}`);
    const userStatusRef = ref(realtimeDB, `users/${userId}/status`);
    const userOffTimeRef = ref(realtimeDB, `users/${userId}/offTime`);
    const userCardsRef = ref(realtimeDB, `users/${userId}/cards`);
    const freeCardsRef = ref(realtimeDB, `free/`);

    try {
      const snapshot = await get(userRef);
      const existingUser = snapshot.exists() ? snapshot.val() : null;
      const now = new Date();

      const userData = {
        first_name: telegramUser.first_name || "Unknown",
        last_name: telegramUser.last_name || "",
        username: telegramUser.username || "",
        photo_url: telegramUser.photo_url || "",
        userId: userId,
        coins: existingUser?.coins ?? 100000,
        coinAdd: existingUser?.coinAdd ?? 20,
        tapped: existingUser?.tapped ?? 100,
        taps: existingUser?.taps ?? 100,
        totalSynergy: existingUser?.totalSynergy ?? 0,
        level: existingUser?.level ?? 1,
        xp: existingUser?.xp ?? 0,
        league: existingUser?.league ?? "bronze",
        pph: existingUser?.pph ?? 1500,
        registration_timestamp: existingUser?.registration_timestamp ?? now.toISOString(),
        maxRefills: existingUser?.maxRefills ?? 2,
        elo: existingUser?.elo ?? 1200,
        usedRefills: existingUser?.usedRefills ?? 0,
        userTimeZone: existingUser?.userTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        lastResetUTC: existingUser?.lastResetUTC ?? null,
        streak: existingUser?.streak ?? 0,
        tutorialDone: existingUser?.tutorialDone ?? false,
        wins: existingUser?.wins ?? 0,
      };

      if (!existingUser) {
        await set(userRef, userData);
      } else {
        await update(userRef, userData);
      }

      if (!existingUser?.cards) {
        const freeCardsSnapshot = await get(freeCardsRef);
        if (freeCardsSnapshot.exists()) {
          const freeCards = freeCardsSnapshot.val();
          const userCards = {};

          for (const category in freeCards) {
            for (const cardId in freeCards[category]) {
              userCards[cardId] = freeCards[category][cardId];
            }
          }
          await set(userCardsRef, userCards);
        }
      }

      localStorage.setItem("userId", userId);
      setUser(userData);
      setIsDataFetched(true);

      await set(userStatusRef, "online");
      onDisconnect(userStatusRef).set("offline");
      onDisconnect(userOffTimeRef).set(Date.now());
    } catch (error) {
      console.error("❌ Error verifying user:", error);
      setStatus("Failed to verify user.");
    }
  };

  const mainContent = useMemo(() => (
    <MainContent user={user} status={status} />
  ), [user, status]);

  if (!isDataFetched) {
    return (
      <div>
        <img
          src="/loading.png"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            position: "absolute",
            top: 0,
          }}
          alt="Loading"
        />
      </div>
    );
  }

  return (
    <TonConnectUIProvider manifestUrl="https://clashwarriors.tech/tonconnect-manifest.json">
      <Router>
        <Suspense fallback={<div>Loading...</div>}>
          {mainContent}
        </Suspense>
      </Router>
    </TonConnectUIProvider>
  );
}

const MainContent = React.memo(({ user, status }) => {
  const location = useLocation();
  const hideFooterPages = ["/tournament", "/builddeck", "/test-dashboard", "/battle", "/leaderboard"];
  const shouldHideFooter = hideFooterPages.some(page => location.pathname.startsWith(page));

  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard user={user} status={status} />} />
        <Route path="/airdrop" element={<Airdrop user={user} status={status} />} />
        <Route path="/collections" element={<Collections user={user} status={status} />} />
        <Route path="/friends" element={<Friends user={user} status={status} />} />
        <Route path="/tournament" element={<Tournament user={user} status={status} />} />
        <Route path="/daily-rewards" element={<DailyRewards user={user} status={status} />} />
        <Route path="/daily-missions" element={<DailyMissions user={user} status={status} />} />
        <Route path="/daily-battle" element={<DailyBattle user={user} status={status} />} />
        <Route path="/collector" element={<Collector user={user} status={status} />} />
        <Route path="/mycollection" element={<MyCollection user={user} status={status} />} />
        <Route path="/builddeck" element={<BuildDeck user={user} status={status} />} />
        <Route path="/battle/:matchID" element={<Battle user={user} status={status} />} />
        <Route path="/leaderboard" element={<LeaderBoard user={user} status={status} />} />
        <Route path="/settings" element={<Settings user={user} status={status} />} />
        <Route path="/premium" element={<Premium user={user} />} />
      </Routes>
      {!shouldHideFooter && <Footer />}
    </>
  );
});

export default App;
