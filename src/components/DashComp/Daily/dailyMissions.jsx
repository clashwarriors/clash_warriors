import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { realtimeDB } from '../../../firebase';
import { ref, get } from 'firebase/database';
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';
import Header from '../Header';
import { triggerHapticFeedback } from '../../tournament/utils/haptic';
import { showRewardedAd } from '../../tournament/utils/showRewardedAd';
import './style/dailymissions.style.css';

const storage = getStorage();

const DailyMission = ({ user }) => {
  const [socialTasks, setSocialTasks] = useState([]);
  const [lastAdAttemptTime, setLastAdAttemptTime] = useState(0);

  const fetchSocialTasks = useCallback(async () => {
    try {
      const socialRef = ref(realtimeDB, 'socialTasks');
      const snapshot = await get(socialRef);
      if (snapshot.exists()) {
        const tasksArray = Object.values(snapshot.val());
        const tasksWithLogos = await Promise.all(
          tasksArray.map(async (task) => {
            try {
              const logoUrl = await getDownloadURL(storageRef(storage, task.logoPath));
              return { ...task, logoUrl };
            } catch {
              return { ...task, logoUrl: '' };
            }
          })
        );
        setSocialTasks(tasksWithLogos);
      }
    } catch (error) {
      console.error('Error fetching social tasks:', error);
    }
  }, []);

  useEffect(() => {
    fetchSocialTasks();
  }, [fetchSocialTasks]);

  const handleAdClick = useCallback(async () => {
    const now = Date.now();
    const secondsSinceLast = (now - lastAdAttemptTime) / 1000;

    if (secondsSinceLast < 10) {
      alert(`⏳ Wait ${Math.ceil(10 - secondsSinceLast)}s before watching again`);
      return;
    }

    setLastAdAttemptTime(now);

    const success = await showRewardedAd(user?.userId);
    if (success) triggerHapticFeedback();
  }, [lastAdAttemptTime, user?.userId]);

  const renderSocialTasks = useMemo(() => (
    socialTasks.map((task, index) => (
      <li
        key={index}
        className="daily-mission-social-item"
        onClick={triggerHapticFeedback}
      >
        <a
          href={task.link}
          target="_blank"
          rel="noopener noreferrer"
          className="daily-mission-social-card"
        >
          {task.logoUrl && (
            <img
              src={task.logoUrl}
              alt={task.title}
              className="daily-mission-social-logo"
            />
          )}
          <div className="daily-mission-social-text-container">
            <span className="daily-mission-social-title">{task.title}</span>
            <span className="daily-mission-social-coins">💰 {task.coins} Coins</span>
          </div>
          <img
            src="/assets/right.png"
            alt="Right Icon"
            className="daily-mission-social-right-logo"
          />
        </a>
      </li>
    ))
  ), [socialTasks]);

  return (
    <div className="daily-mission-container">
      <Header user={user} />

      <div className="daily-mission-image-section">
        <h3 className="daily-mission-subtitle" style={{ marginBottom: '20px' }}>
          Watch Ads & Earn Coins
        </h3>

        <div className="daily-mission-image-wrapper">
          <img
            src="./assets/ad-bg.avif"
            alt="Watch Ad"
            onClick={handleAdClick}
            className="daily-mission-ad-image"
            style={{
              cursor: (Date.now() - lastAdAttemptTime) / 1000 < 10 ? 'not-allowed' : 'pointer',
            }}
          />
          <p className="daily-mission-overlay-text">Click to Earn!</p>
        </div>
      </div>

      <div className="daily-mission-social-section">
        <h3 className="daily-mission-subtitle">Follow, Subscribe, Earn!</h3>
        <ul className="daily-mission-social-list">{renderSocialTasks}</ul>
      </div>
    </div>
  );
};

export default React.memo(DailyMission);
