import React, { useState, useEffect } from 'react'
import './style/leaderboard.style.css'
import CachedImage from '../shared/CachedImage'

const backend = import.meta.env.VITE_API_BASE_URL

const LeaderBoard = ({ user }) => {
  const [leaderboard, setLeaderboard] = useState([])
  const [userRank, setUserRank] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

  const defaultPhotoUrl = '/assets/defaultPlayer.svg'
  const getSafeImage = (url) =>
    url && url.startsWith('http') ? url : defaultPhotoUrl

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true)

      try {
        // Step 1: Fetch top 100 from Postgres backend
        const response = await fetch(`${backend}/api/global-top100`)
        const data = await response.json()

        // Step 2: Sort by ELO just in case backend didn't
        const sortedUsers = data.sort((a, b) => b.elo - a.elo)

        // Step 3: Set leaderboard state
        setLeaderboard(sortedUsers)

        // Step 4: Set current user's rank if available
        if (user?.userId) {
          const index = sortedUsers.findIndex((u) => u.user_id === user.userId)
          if (index >= 0) {
            setUserRank(index + 1)
            setUserData(sortedUsers[index])
          } else {
            setUserRank(null)
            setUserData(null)
          }
        }
      } catch (err) {
        console.error('❌ Error fetching leaderboard from PG:', err)
        setLeaderboard([])
        setUserRank(null)
        setUserData(null)
      }

      setLoading(false)
    }

    loadLeaderboard()
  }, [user?.userId])

  const top3 = leaderboard.slice(0, 3)
  const remaining = leaderboard.slice(3)

  return (
    <div className="leaderboard-container">
      {loading ? (
        <div className="leaderboard-loading">
          <p>Loading leaderboard...</p>
        </div>
      ) : (
        <>
          <div className="leaderboard-top3">
            {top3.length > 0 && (
              <>
                {/* Rank 2 */}
                <div className="top3 top3-2">
                  <div className="top3-frame-wrapper">
                    <CachedImage
                      src="/new/leaderboard/Rank2.png"
                      alt="Rank 2"
                      className="top2-frame"
                      style={{ marginTop: '6px', marginLeft: '-10px' }}
                    />
                    <div className="top3-avatar">
                      <img
                        src={top3[1]?.photo_url || defaultPhotoUrl}
                        alt="Rank 2 User"
                        style={{ height: '100px', marginRight: '10px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Rank 1 */}
                <div className="top3 top3-1">
                  <div className="top3-frame-wrapper">
                    <CachedImage
                      src="/new/leaderboard/Rank1.png"
                      alt="Rank 1"
                      className="top1-frame"
                    />
                    <div className="top3-avatar">
                      <img
                        src={top3[0]?.photo_url || defaultPhotoUrl}
                        alt="Rank 1"
                        style={{ height: '100px', marginTop: '-10px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Rank 3 */}
                <div className="top3 top3-3">
                  <div className="top3-frame-wrapper">
                    <CachedImage
                      src="/new/leaderboard/Rank3.png"
                      alt="Rank 3"
                      className="top3-frame"
                    />
                    <div className="top3-avatar">
                      <CachedImage
                        src={top3[2]?.photo_url || defaultPhotoUrl}
                        alt="Rank 3 User"
                        style={{ height: '90px', marginTop: '-5px' }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <table className="leaderboard-table">
            <tbody className="leaderboard-tbody">
              {remaining.map((player, index) => (
                <tr
                  key={player.userId}
                  className={`leaderboard-row ${player.userId === user?.userId ? 'leaderboard-highlight' : ''}`}
                >
                  <td className="leaderboard-rank">{index + 4}</td>
                  <td className="leaderboard-photo">
                    <img
                      src={getSafeImage(player.photo_url)}
                      alt="User Profile"
                      className="leaderboard-avatar"
                      loading="lazy"
                      onError={(e) => (e.target.src = defaultPhotoUrl)}
                    />
                  </td>
                  <td className="leaderboard-username">
                    {player.first_name} {player.last_name}
                  </td>
                  <td className="leaderboard-points">{player.elo}</td>
                </tr>
              ))}

              {userData &&
                !leaderboard.some((u) => u.userId === user?.userId) && (
                  <tr className="leaderboard-row leaderboard-sticky">
                    <td className="leaderboard-rank">{userRank || '--'}</td>
                    <td className="leaderboard-photo">
                      <img
                        src={getSafeImage(userData.photo_url)}
                        alt="User Profile"
                        className="leaderboard-avatar"
                        loading="lazy"
                        onError={(e) => (e.target.src = defaultPhotoUrl)}
                      />
                    </td>
                    <td className="leaderboard-username">
                      {userData.first_name} {userData.last_name}
                    </td>
                    <td className="leaderboard-points">{userData.elo || 0}</td>
                  </tr>
                )}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

export default LeaderBoard
