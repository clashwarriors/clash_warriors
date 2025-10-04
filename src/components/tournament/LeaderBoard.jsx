import React, { useState, useEffect } from 'react'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import './style/leaderboard.style.css'
import { getFromDB, saveToDB } from '../../utils/leaderboardHelper'

const KEY = 'top100Users'

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

      // Step 1: Check IndexedDB
      let cachedUsers = await getFromDB(KEY)

      if (!cachedUsers || cachedUsers.length === 0) {
        // Step 2: Only fetch from Firestore if IndexedDB is empty
        console.log(
          '📡 No leaderboard in IndexedDB, fetching from Firestore...'
        )
        try {
          const db = getFirestore()
          const leaderboardDoc = await getDoc(
            doc(db, 'leaderboard_meta', 'top100')
          )
          cachedUsers = leaderboardDoc.exists()
            ? leaderboardDoc.data().users || []
            : []

          if (cachedUsers.length > 0) {
            await saveToDB(KEY, cachedUsers)
            console.log('💾 Leaderboard saved to IndexedDB.')
          }
        } catch (err) {
          console.error('❌ Error fetching leaderboard from Firestore:', err)
          cachedUsers = []
        }
      } else {
        console.log('🗄️ Loaded leaderboard from IndexedDB cache.')
      }

      // Step 3: Sort and render from IndexedDB
      const sortedUsers = cachedUsers.sort((a, b) => b.elo - a.elo)
      setLeaderboard(sortedUsers)

      if (user?.userId) {
        const index = sortedUsers.findIndex((u) => u.userId === user.userId)
        if (index >= 0) {
          setUserRank(index + 1)
          setUserData(sortedUsers[index])
        } else {
          setUserData(null)
          setUserRank(null)
        }
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
                    <img
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
                    <img
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
                    <img
                      src="/new/leaderboard/Rank3.png"
                      alt="Rank 3"
                      className="top3-frame"
                    />
                    <div className="top3-avatar">
                      <img
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
