import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './style/daily.style.css';
import { triggerHapticFeedback } from '../tournament/utils/haptic';

const DailyTasks = () => {
  const navigate = useNavigate();

  const handleNavigation = useCallback((path) => {
    triggerHapticFeedback();
    navigate(path);
  }, [navigate]);

  return (
    <div className="daily-tasks-container">
      {/* Rewards Icon */}
      <div
        className="daily-task"
        role="button"
        tabIndex={0}
        onClick={() => handleNavigation('/daily-rewards')}
      >
        <img
          src="./assets/daily/daily-rewards.avif"
          alt="Daily Rewards"
          className="task-icon"
          loading="lazy"
        />
        <span>Daily Rewards</span>
      </div>

      {/* Missions Icon */}
      <div
        className="daily-task"
        role="button"
        tabIndex={0}
        onClick={() => handleNavigation('/daily-missions')}
      >
        <img
          src="./assets/daily/daily-missions.avif"
          alt="Daily Missions"
          className="task-icon"
          loading="lazy"
        />
        <span>Daily Missions</span>
      </div>

      {/* Battle Icon */}
      <div
        className="daily-task"
        role="button"
        tabIndex={0}
        onClick={() => handleNavigation('/tournament')}
      >
        <img
          src="./assets/daily/daily-battle.avif"
          alt="Daily Battle"
          className="task-icon"
          loading="lazy"
        />
        <span>Daily Battle</span>
      </div>
    </div>
  );
};

export default React.memo(DailyTasks);
