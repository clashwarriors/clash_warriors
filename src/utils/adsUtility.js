// adsRewardService.js
import { getUserData, storeUserData, setLastUpdate } from './indexedDBService'
import { uploadUserToBackend } from './firebaseSyncService'

const AD_REWARD_AMOUNT = 30000 // 30K coins per ad

/**
 * Reward user for watching an ad
 * @param {Object} user - optional, defaults to IndexedDB user
 * @returns {Promise<{ success: boolean, newCoins: number }>}
 */
export const rewardUserAd = async (user = null) => {
  try {
    // 1️⃣ Get user from IndexedDB if not passed
    const currentUser = user || (await getUserData())
    if (!currentUser?.userId) {
      alert('User not found!')
      return { success: false, newCoins: 0 }
    }

    // 2️⃣ Check if running inside Telegram Mini App
    if (!window.Telegram?.WebApp) {
      console.warn(
        '⚠️ Ads tracking only works inside Telegram Mini App. Simulating ad...'
      )
      // simulate ad delay
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } else {
      // 3️⃣ Show rewarded interstitial ad
      await show_9130916() // your Monetag rewarded ad
    }

    // 4️⃣ Reward user after ad completes
    const newCoins = (currentUser.coins || 0) + AD_REWARD_AMOUNT
    const updatedUser = {
      ...currentUser,
      coins: newCoins,
      lastUpdate: Date.now(),
    }

    // 5️⃣ Store locally
    await storeUserData(updatedUser)
    await setLastUpdate(updatedUser.lastUpdate)

    // 6️⃣ Sync with backend
    await uploadUserToBackend(updatedUser)

    // Optional feedback
    if (navigator.vibrate) navigator.vibrate(100)
    alert(`🎉 You earned 30,000 coins! Total: ${newCoins}`)

    console.log(
      `🎉 User ${currentUser.userId} rewarded ${AD_REWARD_AMOUNT} coins. Total: ${newCoins}`
    )
    return { success: true, newCoins }
  } catch (err) {
    console.error('❌ Failed to reward ad coins:', err)
    return { success: false, newCoins: 0 }
  }
}
