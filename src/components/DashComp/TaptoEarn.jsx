import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ref, get, update, onValue } from 'firebase/database';
import { realtimeDB } from '../../firebase';
import ArcReactor from './Reactor';
import './style/taptoearn.style.css';
import { triggerHapticFeedback } from '../tournament/utils/haptic';

const TapToEarn = ({ user }) => {
  const userId = user.userId;
  const [userData, setUserData] = useState(null);
  const [tapped, setTapped] = useState(0);
  const [taps, setTaps] = useState(0);
  const [coins, setCoins] = useState(0);
  const [coinAdd, setCoinAdd] = useState(10);
  const [coinAddLevel, setCoinAddLevel] = useState(1);
  const [coinAddCost, setCoinAddCost] = useState(500);
  const [coinAddUpdates, setCoinAddUpdates] = useState(0);
  const [usedRefills, setUsedRefills] = useState(0);
  const [maxRefills, setMaxRefills] = useState(0);
  const [refillCost, setRefillCost] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const userRef = ref(realtimeDB, `users/${userId}`);
    get(userRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setUserData(data);
        setTapped(data.tapped);
        setTaps(data.taps);
        setCoinAdd(data.coinAdd || 10);
        setCoins(data.coins);
        setUsedRefills(data.usedRefills);
        setMaxRefills(data.maxRefills);
        setRefillCost(data.refillCost || 100);
        setCoinAddLevel(data.coinAddLevel || 1);
        setCoinAddCost(data.coinAddCost || 500);
        setCoinAddUpdates(data.coinAddUpdates || 0);
      }
    });
  }, [userId]);

  useEffect(() => {
    const coinsRef = ref(realtimeDB, `users/${userId}/coins`);
    const unsubscribe = onValue(coinsRef, (snapshot) => {
      const value = snapshot.val();
      if (value !== null) setCoins(value);
    });

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTap = useCallback(async () => {
    triggerHapticFeedback();

    if (tapped <= 0) return;

    const newTapped = tapped - 1;
    const newCoins = coins + coinAdd;

    setTapped(newTapped);
    setCoins(newCoins);

    try {
      await update(ref(realtimeDB, `users/${userId}`), {
        tapped: newTapped,
        coins: newCoins,
      });

      const tapButton = document.getElementById('tap-button');
      if (tapButton) {
        tapButton.classList.add('tap-active');
        setTimeout(() => tapButton.classList.remove('tap-active'), 100);
      }

      if (navigator.vibrate) navigator.vibrate(50);
      window?.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
      window?.webkit?.messageHandlers?.hapticFeedback?.postMessage({ type: 'medium' });

    } catch (error) {
      console.error('Error updating coins/taps:', error);
    }
  }, [tapped, coins, coinAdd, userId]);

  const toggleDropdown = useCallback(() => {
    triggerHapticFeedback();
    setShowDropdown((prev) => !prev);
  }, []);

  const handleIncreaseCoinAdd = useCallback(async () => {
    triggerHapticFeedback();

    if (coinAddLevel >= 20 || coins < coinAddCost) return;

    const newCoinAdd = coinAdd + 750;
    const newLevel = coinAddLevel + 1;
    const newCost = Math.floor(coinAddCost * 1.5);
    const newCoins = coins - coinAddCost;

    setCoinAdd(newCoinAdd);
    setCoinAddLevel(newLevel);
    setCoinAddCost(newCost);
    setCoins(newCoins);
    setCoinAddUpdates(coinAddUpdates + 1);

    await update(ref(realtimeDB, `users/${userId}`), {
      coinAdd: newCoinAdd,
      coinAddLevel: newLevel,
      coinAddCost: newCost,
      coins: newCoins,
      coinAddUpdates: coinAddUpdates + 1,
    });
  }, [coinAdd, coinAddLevel, coinAddCost, coins, userId, coinAddUpdates]);

  const handleRefill = useCallback(async () => {
    triggerHapticFeedback();
    if (usedRefills >= maxRefills || tapped === taps) return;

    const newUsed = usedRefills + 1;

    setUsedRefills(newUsed);
    setTapped(taps);

    await update(ref(realtimeDB, `users/${userId}`), {
      usedRefills: newUsed,
      tapped: taps,
    });
  }, [usedRefills, maxRefills, tapped, taps, userId]);

  const upgradeRefills = useCallback(async () => {
    triggerHapticFeedback();
    if (maxRefills >= 10 || coins < refillCost) return;

    const newMaxRefills = maxRefills + 1;
    const newCoins = coins - refillCost;
    const newCost = Math.floor(refillCost * 1.5);

    setMaxRefills(newMaxRefills);
    setCoins(newCoins);
    setRefillCost(newCost);

    await update(ref(realtimeDB, `users/${userId}`), {
      maxRefills: newMaxRefills,
      coins: newCoins,
      refillCost: newCost,
    });
  }, [maxRefills, coins, refillCost, userId]);

  if (!userData) return <p className="taptoearn-loading"></p>;

  return (
    <div className="taptoearn-container">
      <p className="taptoearn-coins">
        <img src="/assets/crypto-coin.png" alt="Crypto Coin" className="tte-coin-icon" loading="lazy" />
        {coins}
      </p>

      <ArcReactor user={user} onClick={handleTap} />

      <div className="tte-tapped-container">
        <p className="taptoearn-tapped">{tapped}/{taps}</p>
        <button className="tte-boost-button" onClick={toggleDropdown}>
          Boost
        </button>
      </div>

      <div style={{ marginTop: '60px', color: 'transparent' }}>.</div>

      {showDropdown && (
        <div className="te-boost-menu" ref={dropdownRef}>
          <button
            className="tte-refill-button"
            onClick={handleRefill}
            disabled={usedRefills >= maxRefills}
          >
            {usedRefills >= maxRefills ? 'MAX REFILLS' : `Refills: ${usedRefills}/${maxRefills}`}
          </button>

          <button
            className="tte-increase-coinadd-button"
            onClick={handleIncreaseCoinAdd}
            disabled={coinAddLevel >= 20 || coins < coinAddCost}
          >
            {coinAddLevel >= 20 ? 'MAX' : `Multiplier Lv ${coinAddLevel} - Cost: ${coinAddCost}`}
          </button>

          <button
            className="tte-upgrade-refills-button"
            onClick={upgradeRefills}
            disabled={maxRefills >= 10}
          >
            {maxRefills >= 10 ? 'MAX LEVEL' : `Refill Upgrade - Cost: ${refillCost}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(TapToEarn);
