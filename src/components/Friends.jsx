import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { realtimeDB } from '../firebase';
import './style/Friends.css';
import Header from './DashComp/Header';
import { triggerHapticFeedback } from './tournament/utils/haptic';

const Friends = ({ user }) => {
  const [invitedFriends, setInvitedFriends] = useState([]);

  const referralLink = useMemo(() => 
    `https://share.clashwarriors.tech/invite/${user.userId}`, 
  [user.userId]);

  const totalReferrals = invitedFriends.length;

  useEffect(() => {
    if (!user?.userId) return;

    const friendsRef = ref(realtimeDB, `users/${user.userId}/friends`);

    const unsubscribe = onValue(friendsRef, async (snapshot) => {
      const friendIds = snapshot.val();
      if (!friendIds) {
        setInvitedFriends([]);
        return;
      }

      const friendNamesPromises = Object.values(friendIds).map(async (friendId) => {
        const userRef = ref(realtimeDB, `users/${friendId}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();
        return userData
          ? `${userData.first_name} ${userData.last_name}`
          : 'Unknown User';
      });

      const friendNames = await Promise.all(friendNamesPromises);
      setInvitedFriends(friendNames);
    });

    return () => unsubscribe();
  }, [user?.userId]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(referralLink);
    triggerHapticFeedback();
    alert('Referral link copied!');
  }, [referralLink]);

  const shareOnTelegram = useCallback(() => {
    triggerHapticFeedback();
    const message = encodeURIComponent(
      `🔥 Start Clash Wars & Earn Rewards! 🎉\n\nUse my referral link: ${referralLink}`
    );
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${message}`;
    window.open(telegramUrl, '_blank');
  }, [referralLink]);

  const friendsList = useMemo(() => (
    invitedFriends.length > 0 ? (
      invitedFriends.map((friend, index) => (
        <div key={index} className="friend-item">
          {friend}
        </div>
      ))
    ) : (
      <p>No referrals yet.</p>
    )
  ), [invitedFriends]);

  return (
    <div className="friends-page">
      <Header user={user} />
      <div className="friends-content">
        <div className="invite-box">
          <h2>Refer & Earn</h2>
          <p>
            <strong>Total Referrals:</strong> {totalReferrals}
          </p>

          <div className="invite-section">
            <div className="invite-link">
              <span>{referralLink}</span>
            </div>
            <div className="invite-buttons">
              <button className="copy-button" onClick={copyToClipboard}>
                Copy
              </button>
              <button className="telegram-button" onClick={shareOnTelegram}>
                Share on Telegram
              </button>
            </div>
          </div>
        </div>

        <div className="referral-list">
          <h3>Your Referrals</h3>
          {friendsList}
        </div>
      </div>
    </div>
  );
};

export default Friends;
