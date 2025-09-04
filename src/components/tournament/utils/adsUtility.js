// src/utils/adsUtility.js
import { getUserData, storeUserData } from '../../../utils/indexedDBService.js'

// Rewarded Interstitial Ad (10K)
export const showRewardedInterstitialAd10K = async () => {
  try {
    await show_9130916()
    console.log('✅ Rewarded Interstitial Ad (10K) completed.')

    // Get user from IndexedDB
    let user = await getUserData()

    if (!user) {
      // If no user found, create a default user object with 0 coins
      user = { userId: 'defaultUser', coins: 0 }
    }

    // Add 10,000 coins
    user.coins = (user.coins || 0) + 10000

    // Save back to IndexedDB
    await storeUserData(user)

    console.log(`💰 10,000 Coins added. New total: ${user.coins}`)

    return true
  } catch (e) {
    console.warn('⚠️ Error during rewarded interstitial (10K):', e)
    return false
  }
}

// Rewarded Interstitial Ad (1K)
export const showRewardedInterstitialAd1K = async () => {
  try {
    await show_9130916()
    console.log('✅ Rewarded Interstitial Ad (1K) completed.')

    // Get user from IndexedDB
    let user = await getUserData()

    if (!user) {
      // If no user found, create a default user object with 0 coins
      user = { userId: 'defaultUser', coins: 0 }
    }

    // Add 1,000 coins
    user.coins = (user.coins || 0) + 1000

    // Save back to IndexedDB
    await storeUserData(user)

    console.log(`💰 1,000 Coins added. New total: ${user.coins}`)

    return true
  } catch (e) {
    console.warn('⚠️ Error during rewarded interstitial (1K):', e)
    return false
  }
}
