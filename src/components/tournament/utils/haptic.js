// ✅ Global Haptic & Vibration Function
export const triggerHapticFeedback = (event) => {
  try {
    // ✅ Android: Standard vibration API
    if (navigator.vibrate) {
      navigator.vibrate(50) // Vibrate for 50ms
    }

    // ✅ iOS: Try Telegram WebApp Haptic Feedback API
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium') // Options: "light", "medium", "heavy"
    }

    // ✅ iOS: Alternative WebKit method (may work in WebView)
    if (window?.webkit?.messageHandlers?.hapticFeedback) {
      window.webkit.messageHandlers.hapticFeedback.postMessage({
        type: 'medium',
      })
    }

    // ✅ iOS: CSS Button Animation (Fallback for Safari)
    if (event?.target) {
      event.target.classList.add('tap-active')
      setTimeout(() => event.target.classList.remove('tap-active'), 100)
    }
  } catch (error) {
    console.error('Error triggering haptic feedback:', error)
  }
}

export const dropHapticFeedback = (event) => {
  try {
    // ✅ Android: Standard vibration API
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 150, 50, 200]) // feel like a thud, then minor shake
    }

    // ✅ iOS: Try Telegram WebApp Haptic Feedback API
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy') // Stronger impact
    }

    // ✅ iOS: Alternative WebKit method (may work in WebView)
    if (window?.webkit?.messageHandlers?.hapticFeedback) {
      window.webkit.messageHandlers.hapticFeedback.postMessage({
        type: 'heavy',
      })
    }

    // ✅ iOS: CSS Button Animation (Fallback for Safari)
    if (event?.target) {
      event.target.classList.add('tap-active')
      setTimeout(() => event.target.classList.remove('tap-active'), 300) // Slightly longer effect
    }
  } catch (error) {
    console.error('Error triggering drop haptic feedback:', error)
  }
}
