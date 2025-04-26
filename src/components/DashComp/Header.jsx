import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getDatabase, ref, onValue, get, update } from 'firebase/database';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { triggerHapticFeedback } from '../tournament/utils/haptic';
import './style/header.style.css';

// Utility functions
const formatNumber = (num) => {
  if (num >= 1_000_000_000) return Math.floor(num / 1_000_000_000) + 'B';
  if (num >= 1_000_000) return Math.floor(num / 1_000_000) + 'M';
  if (num >= 1_000) return Math.floor(num / 1_000) + 'K';
  return num.toString();
};

const getProgressColor = (percentage) => {
  if (percentage <= 10) return '#ff0000';
  if (percentage <= 30) return '#ff6600';
  if (percentage <= 50) return '#ffcc00';
  if (percentage <= 70) return '#4caf50';
  if (percentage <= 90) return '#2196f3';
  return '#9c27b0';
};

const calculateLevel = (xp) => {
  if (xp <= 100) return 1;
  if (xp <= 250) return 2;
  if (xp <= 500) return 3;
  if (xp <= 1000) return 4;
  if (xp <= 2000) return 5;
  return Math.floor(Math.log(xp) * 10);
};

const calculateProgress = (xp, level) => {
  const levels = [
    { min: 0, max: 100 },
    { min: 101, max: 250 },
    { min: 251, max: 500 },
    { min: 501, max: 1000 },
    { min: 1001, max: 2000 },
  ];
  const { min, max } = levels[level - 1] || { min: 2001, max: xp };
  return Math.min(((xp - min) / (max - min)) * 100, 100);
};

const calculateRank = (level) => {
  const ranks = [
    'Bronze I', 'Bronze II', 'Bronze III', 'Bronze IV',
    'Silver I', 'Silver II', 'Silver III', 'Silver IV',
    'Gold I', 'Gold II', 'Gold III', 'Gold IV',
    'Platinum', 'Emerald', 'Sapphire', 'Ruby',
    'Diamond', 'Master', 'Grandmaster', 'Immortal',
  ];
  const levelsPerRank = 5;
  return ranks[Math.min(Math.floor((level - 1) / levelsPerRank), ranks.length - 1)];
};

const Header = ({ user }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConnectedPopup, setShowConnectedPopup] = useState(false);
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();

  useEffect(() => {
    if (!user?.userId) return;
    const db = getDatabase();
    const userRef = ref(db, `users/${user.userId}`);

    const unsubscribe = onValue(userRef, (snapshot) => {
      setUserData(snapshot.exists() ? snapshot.val() : {});
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.userId]);

  const handleWalletClick = useCallback(() => {
    if (wallet?.account?.address) {
      setShowDropdown(true);
      setTimeout(() => setShowDropdown(false), 3000);
    } else {
      tonConnectUI.openModal();
    }
  }, [wallet, tonConnectUI]);

  useEffect(() => {
    if (wallet?.account?.address && user?.userId) {
      const db = getDatabase();
      const walletRef = ref(db, `users/${user.userId}/wallet`);

      get(walletRef).then((snapshot) => {
        if (!snapshot.exists() || !snapshot.val()?.[1]) {
          update(walletRef, { 1: wallet.account.address })
            .then(() => {
              console.log('✅ Wallet saved');
              setShowConnectedPopup(true);
              setTimeout(() => setShowConnectedPopup(false), 3000);
            })
            .catch((err) => console.error('❌ Error saving wallet:', err));
        }
      });
    }
  }, [wallet, user?.userId]);

  const handleLeaderboardClick = useCallback(() => {
    window.location.href = '/leaderboard';
    triggerHapticFeedback();
  }, []);

  const { xp, level, progress, progressColor, formattedPPH, userRank } = useMemo(() => {
    const xp = userData?.xp || 0;
    const level = calculateLevel(xp);
    const progress = calculateProgress(xp, level);
    const progressColor = getProgressColor(progress);
    const formattedPPH = formatNumber(userData?.pph || 0);
    const userRank = calculateRank(level);
    return { xp, level, progress, progressColor, formattedPPH, userRank };
  }, [userData]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="dash-header">
      {/* Left */}
      <div className="dash-header__left">
        <img
          src={userData?.photo_url || 'default-avatar.png'}
          alt="Avatar"
          className="dash-header__avatar"
          loading="lazy"
        />
        <div className="dash-header__details">
          <div className="dash-header__name">
            {userData?.username || `${userData?.first_name || ''} ${userData?.last_name || ''}`}
          </div>
          <div className="dash-header__level">Level: {level}</div>
          <div className="dash-header__level-bar">
            <div
              className="dash-header__level-progress"
              style={{
                width: `${progress}%`,
                backgroundColor: progressColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="dash-header__right">
        <div className="dash-header__profit">
          <span onClick={handleWalletClick} role="button" tabIndex={0}>
            <img
              src="/assets/walletIcon.png"
              alt="Wallet"
              className="wallet-icon"
              loading="lazy"
            />
            PPH: {formattedPPH} / Hr
          </span>
          {showDropdown && (
            <div className="wallet-dropdown">
              <p>Wallet Connected ✅</p>
              <p>{wallet.account.address.slice(0, 6)}...{wallet.account.address.slice(-4)}</p>
            </div>
          )}
        </div>

        <div className="dash-header__leaderboard" onClick={handleLeaderboardClick} role="button" tabIndex={0}>
          <span>{userRank}</span>
          <img
            src="/assets/leaderboardIcon.png"
            alt="Leaderboard"
            className="leaderboard-icon"
            loading="lazy"
          />
        </div>
      </div>

      {showConnectedPopup && (
        <div className="connected-popup">
          <p>Wallet Connected Successfully! ✅</p>
        </div>
      )}
    </div>
  );
};

export default React.memo(Header);
