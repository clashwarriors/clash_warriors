import React, { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import telegramAnalytics from "@telegram-apps/analytics";
import * as buffer from 'buffer';

window.Buffer = buffer.Buffer;

// Telegram Analytics Initialization
const isTelegramWebApp = window.Telegram?.WebApp?.initData;

if (isTelegramWebApp) {
  telegramAnalytics.init({
    token: import.meta.env.VITE_TELEGRAM_ANALYTICS_TOKEN,
    appName: import.meta.env.VITE_TELEGRAM_APP_NAME,
  });
}

// Render App
ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
