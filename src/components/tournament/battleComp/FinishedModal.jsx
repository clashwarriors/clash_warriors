// ./battleComp/FinishedModal.jsx
import React, { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const FinishedModal = memo(
  ({ show, finalResult, user, showRewardedInterstitialAd10K }) => {
    const navigate = useNavigate()
    if (!show) return null

    const getTitle = (result) => {
      switch (result) {
        case 'user':
          return '🏆 You Win!'
        case 'bot':
          return '💀 You Lose!'
        default:
          return '⚖️ It’s a Tie!'
      }
    }

    const getRewardText = (result) => {
      if (result === 'user') return '💰 You earned 30,000 Coins!'
      if (result === 'tie') return '🎁 You earned 5,000 Coins!'
      return ''
    }

    const handleAdReward = useCallback(async () => {
      const success = await showRewardedInterstitialAd10K(user.userId)
      if (!success) alert('Ad not completed. No reward granted.')
      navigate('/tournament')
    }, [user.userId, showRewardedInterstitialAd10K, navigate])

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
            Earn 10K Coins
          </button>
        </div>
      </div>
    )
  }
)

export default FinishedModal
