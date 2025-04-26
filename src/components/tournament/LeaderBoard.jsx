import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get, query, orderByChild, limitToLast } from 'firebase/database';
import './style/leaderboard.style.css';

const LeaderBoard = ({ user }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getDatabase();

    const leaderboardQuery = query(
      ref(db, 'users'),
      orderByChild('elo'),
      limitToLast(100)
    );

    get(leaderboardQuery)
      .then(async (snapshot) => {
        if (snapshot.exists()) {
          const usersData = Object.values(snapshot.val())
            .filter((user) => user.first_name || user.last_name)
            .sort((a, b) => (b.elo || 0) - (a.elo || 0));

          setLeaderboard(usersData);

          if (user?.userId) {
            const foundUser = usersData.find((u) => u.userId === user.userId);

            if (foundUser) {
              // User inside Top 100
              setUserRank(usersData.findIndex((u) => u.userId === user.userId) + 1);
              setUserData(foundUser);
            } else {
              // 🔥 User not inside Top 100 → Fetch entire user list
              const fullUsersSnapshot = await get(ref(db, 'users'));
              if (fullUsersSnapshot.exists()) {
                const allUsers = Object.values(fullUsersSnapshot.val())
                  .filter((u) => u.first_name || u.last_name)
                  .sort((a, b) => (b.elo || 0) - (a.elo || 0)); // Sort descending

                const fullRank = allUsers.findIndex((u) => u.userId === user.userId) + 1;
                const fullUserData = allUsers.find((u) => u.userId === user.userId);

                setUserRank(fullRank);
                setUserData(fullUserData);
              }
            }
          }
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error loading leaderboard:', error);
        setLoading(false);
      });
  }, [user?.userId]);

  const top3 = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);

  return (
    <div className="leaderboard-container">
      {loading ? (
        <p className="leaderboard-loading">Loading...</p>
      ) : (
        <>
          {/* Top 3 Section */}
          <div className="leaderboard-top3">
            {top3.length > 0 && (
              <>
                <div className="top3 top3-2">
                  <div className="top3-avatar" style={{ backgroundImage: `url(${top3[1]?.photo_url || 'default.jpg'})` }} />
                  <p className="top3-name">{top3[1]?.first_name} {top3[1]?.last_name}</p>
                  <span className="top3-rank">2</span>
                </div>
                <div className="top3 top3-1">
                  <div className="top3-avatar" style={{ backgroundImage: `url(${top3[0]?.photo_url || 'default.jpg'})` }} />
                  <p className="top3-name">{top3[0]?.first_name} {top3[0]?.last_name}</p>
                  <span className="top3-rank">1</span>
                </div>
                <div className="top3 top3-3">
                  <div className="top3-avatar" style={{ backgroundImage: `url(${top3[2]?.photo_url || 'default.jpg'})` }} />
                  <p className="top3-name">{top3[2]?.first_name} {top3[2]?.last_name}</p>
                  <span className="top3-rank">3</span>
                </div>
              </>
            )}
          </div>

          {/* Full Leaderboard */}
          <table className="leaderboard-table">
            <thead className="leaderboard-thead">
              <tr className="leaderboard-header-row">
                <th className="leaderboard-th">Rank</th>
                <th className="leaderboard-th">Username</th>
                <th className="leaderboard-th">Points</th>
              </tr>
            </thead>
            <tbody className="leaderboard-tbody">
              {remaining.map((player, index) => (
                <tr
                  key={player.userId}
                  className={`leaderboard-row ${player.userId === user?.userId ? 'leaderboard-highlight' : ''}`}
                >
                  <td className="leaderboard-rank">{index + 4}</td>
                  <td className="leaderboard-username">{player.first_name} {player.last_name}</td>
                  <td className="leaderboard-points">{player.elo || 0}</td>
                </tr>
              ))}

              {/* Show yourself separately if not in top 100 */}
              {userData && !leaderboard.some((u) => u.userId === user?.userId) && (
                <tr className="leaderboard-row leaderboard-sticky">
                  <td className="leaderboard-rank">{userRank || '--'}</td>
                  <td className="leaderboard-username">{userData.first_name} {userData.last_name}</td>
                  <td className="leaderboard-points">{userData.elo || 0}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default LeaderBoard;
