import React, { useState, useEffect } from 'react'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import './style/leaderboard.style.css'
import { getFromDB, saveToDB } from '../../utils/leaderboardHelper' // import the helpers

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
    const fetchFromFirestore = async () => {
      const db = getFirestore()
      try {
        const leaderboardDoc = await getDoc(doc(db, 'leaderboard_meta', 'top100'))
        if (!leaderboardDoc.exists()) {
          console.warn('❌ No leaderboard document found.')
          setLoading(false)
          return null
        }
        return leaderboardDoc.data().users || []
      } catch (error) {
        console.error('❌ Error loading leaderboard:', error)
        return null
      }
    }

    const loadLeaderboard = async () => {
      setLoading(true)

      // Try to get leaderboard from IndexedDB first
      let cachedUsers = await getFromDB(KEY)

      if (cachedUsers && cachedUsers.length) {
        console.log('🗄️ Loaded leaderboard from IndexedDB cache.')
      } else {
        // No cached data, fetch from Firestore
        console.log('📡 Fetching leaderboard from Firestore...')
        cachedUsers = await fetchFromFirestore()

        if (cachedUsers && cachedUsers.length) {
          // Save fetched data to IndexedDB
          await saveToDB(KEY, cachedUsers)
          console.log('💾 Leaderboard saved to IndexedDB.')
        }
      }

      if (!cachedUsers) {
        setLeaderboard([])
        setLoading(false)
        return
      }

      // Sort by elo descending just in case
      const sortedUsers = cachedUsers
        .filter(u => u.first_name || u.last_name)
        .sort((a, b) => b.elo - a.elo)

      setLeaderboard(sortedUsers)

      if (user?.userId) {
        const index = sortedUsers.findIndex(u => u.userId === user.userId)
        if (index >= 0) {
          setUserRank(index + 1)
          setUserData(sortedUsers[index])
        } else {
          // Fallback: fetch user from Firestore if not in top100
          const db = getFirestore()
          const userDoc = await getDoc(doc(db, 'users', user.userId))
          if (userDoc.exists()) {
            setUserData({ userId: user.userId, ...userDoc.data() })
            setUserRank(null)
          }
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
                  className={`leaderboard-row ${
                    player.userId === user?.userId ? 'leaderboard-highlight' : ''
                  }`}
                >
                  <td className="leaderboard-rank">{index + 4}</td>
                  <td className="leaderboard-photo">
                    <img
                      src={getSafeImage(player.photo_url)}
                      alt="User Profile"
                      className="leaderboard-avatar"
                      loading="lazy"
                      onError={e => (e.target.src = defaultPhotoUrl)}
                    />
                  </td>
                  <td className="leaderboard-username">
                    {player.first_name} {player.last_name}
                  </td>
                  <td className="leaderboard-points">{player.elo}</td>
                </tr>
              ))}

              {userData && !leaderboard.some(u => u.userId === user?.userId) && (
                <tr className="leaderboard-row leaderboard-sticky">
                  <td className="leaderboard-rank">{userRank || '--'}</td>
                  <td className="leaderboard-photo">
                    <img
                      src={getSafeImage(userData.photo_url)}
                      alt="User Profile"
                      className="leaderboard-avatar"
                      loading="lazy"
                      onError={e => (e.target.src = defaultPhotoUrl)}
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
