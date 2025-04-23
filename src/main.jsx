import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import telegramAnalytics from "@telegram-apps/analytics";
import * as buffer from 'buffer'
window.Buffer = buffer.Buffer

// Check if running inside Telegram WebApp
const isTelegramWebApp = window.Telegram?.WebApp?.initData;

if (isTelegramWebApp) {
  //console.log("Running inside Telegram WebApp. Initializing analytics...");
  telegramAnalytics.init({
    token: import.meta.env.VITE_TELEGRAM_ANALYTICS_TOKEN,
    appName: import.meta.env.VITE_TELEGRAM_APP_NAME,
  });
} else {
  //console.warn("Not running inside Telegram WebApp. Skipping analytics initialization.");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

