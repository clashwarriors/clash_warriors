import React, { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { rewardUserAd } from '../../../utils/adsUtility'

const FinishedModal = memo(({ show, finalResult, user }) => {
  // 🔹 Always call hooks first
  const navigate = useNavigate()

  const handleAdReward = useCallback(async () => {
    const { success } = await rewardUserAd(user) // pass entire user object
    if (!success) alert('Ad not completed. No reward granted.')
    navigate('/tournament')
  }, [user, navigate])

  const getTitle = useCallback((result) => {
    switch (result) {
      case 'user':
        return '🏆 You Win!'
      case 'bot':
        return '💀 You Lose!'
      default:
        return '⚖️ It’s a Tie!'
    }
  }, [])

  const getRewardText = useCallback((result) => {
    if (result === 'user') return '💰 You earned 30,000 Coins!'
    if (result === 'tie') return '🎁 You earned 5,000 Coins!'
    return ''
  }, [])

  // 🔹 Only after hooks: conditional rendering
  if (!show) return null

  return (
    <div className="newGame-modal">
      <div className="newGame-modal-slab">
        <h2 style={{ fontFamily: '"MedievalSharpBold", sans-serif' }}>
          {getTitle(finalResult)}
        </h2>

        {(finalResult === 'user' || finalResult === 'tie') && (
          <p className="reward-text" style={{ marginTop: '-10px' }}>
            {getRewardText(finalResult)}
          </p>
        )}

        <p style={{ marginTop: '15px' }}>
          Thanks for playing. Redirecting to Tournament...
        </p>

        <button onClick={() => navigate('/tournament')}>
          Return Tournament
        </button>

        <button
          onClick={handleAdReward}
          style={{ marginTop: 10 }}
          type="button"
        >
          Earn 30K Coins
        </button>
      </div>
    </div>
  )
})

export default FinishedModal
