import { getUserData, storeUserData } from './indexedDBService';

let intervalId = null;

export const startCoinGenerator = () => {
  if (!navigator.onLine || intervalId !== null) return;

  intervalId = setInterval(async () => {
    try {
      const userData = await getUserData();
      if (!userData?.userId) return;

      const updatedCoins = (userData.coins || 0) + 1;
      const updatedUserData = {
        ...userData,
        coins: updatedCoins,
      };

      await storeUserData(updatedUserData);
      // REMOVE updateOnline here, do not sync every second
    } catch (error) {
      console.error('Coin generator error:', error);
    }
  }, 1000);
};


export const stopCoinGenerator = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};
