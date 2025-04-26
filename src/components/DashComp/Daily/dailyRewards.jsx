import React, { useState, useEffect, useCallback } from 'react';
import { ref, get, set } from 'firebase/database';
import { realtimeDB } from '../../../firebase';
import Header from '../Header';
import './style/dailyRewards.style.css';

const dailyRewards = [
  { day: 'Day 1', reward: '500 $WARS', description: 'Start strong!' },
  { day: 'Day 2', reward: '1000 $WARS', description: 'Double the fun!' },
  { day: 'Day 3', reward: '2500 $WARS', description: 'Boost your journey!' },
  { day: 'Day 4', reward: '5000 $WARS', description: 'Level up!' },
  { day: 'Day 5', reward: '7500 $WARS', description: 'Massive bonus!' },
  { day: 'Day 6', reward: '10000 $WARS', description: 'Exclusive prize!' },
  { day: 'Day 7', reward: '25000 $WARS', description: 'Epic reward!' },
];

const DailyRewards = ({ user }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [claimedToday, setClaimedToday] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStreak = useCallback(async () => {
    if (!user?.userId) return;

    const today = new Date().toISOString().split('T')[0];
    const userBaseRef = ref(realtimeDB, `users/${user.userId}`);
    const streakRef = ref(realtimeDB, `users/${user.userId}/streak`);
    const lastClaimedRef = ref(realtimeDB, `users/${user.userId}/lastClaimed`);

    try {
      const [streakSnap, lastClaimedSnap] = await Promise.all([
        get(streakRef),
        get(lastClaimedRef),
      ]);

      if (streakSnap.exists() && lastClaimedSnap.exists()) {
        const streak = streakSnap.val();
        const lastClaimed = lastClaimedSnap.val();

        if (lastClaimed === today) {
          setClaimedToday(true);
          setCurrentIndex(Math.min(streak, 6));
        } else {
          const lastDate = new Date(lastClaimed);
          const diffDays = Math.floor(
            (new Date(today) - lastDate) / (1000 * 60 * 60 * 24)
          );

          if (diffDays === 1) {
            setCurrentIndex(Math.min(streak, 6));
          } else {
            await set(streakRef, 0);
            await set(lastClaimedRef, today);
            setCurrentIndex(0);
          }
        }
      } else {
        await set(streakRef, 0);
        await set(lastClaimedRef, today);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Error fetching streak:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  const handleClaim = useCallback(async () => {
    if (!user?.userId || claimedToday) return;

    setLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const streakRef = ref(realtimeDB, `users/${user.userId}/streak`);
    const lastClaimedRef = ref(realtimeDB, `users/${user.userId}/lastClaimed`);

    try {
      const snapshot = await get(streakRef);

      if (snapshot.exists()) {
        let streak = snapshot.val();

        streak = streak >= 7 ? 0 : streak + 1;

        await Promise.all([
          set(streakRef, streak),
          set(lastClaimedRef, today),
        ]);

        setCurrentIndex(Math.min(streak, 6));
        setClaimedToday(true);
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.userId, claimedToday]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  return (
    <div className="dailyRewards-containerMain">
      <Header user={user} />
      {loading ? (
        <p>Loading rewards...</p>
      ) : (
        <div className="dailyRewards-container">
          <div key={currentIndex} className="dailyRewards-centerClock dailyRewards-animate">
            <p>{dailyRewards[currentIndex]?.day || 'Day ?'}</p>
            <h2>{dailyRewards[currentIndex]?.reward || '???'}</h2>
            <p className="dailyRewards-rewardDescription">
              {dailyRewards[currentIndex]?.description || 'Keep going!'}
            </p>
            <button
              className="dailyRewards-claimButton"
              onClick={handleClaim}
              disabled={claimedToday || loading}
            >
              {claimedToday ? 'Already Claimed' : 'Claim Reward'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(DailyRewards);
