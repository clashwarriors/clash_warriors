// src/components/tournament/BattleModal.jsx
import React from 'react'
import '../tournament/style/tournament.style.css'

const BattleModal = ({
  code,
  setCode,
  alertMessage,
  handleMultiplayerBattle,
  handleFriendlyChallenge,
  handleJoinFriendlyMatch,
  closeModal,
}) => {
  return (
    <div className="battle-mode-overlay" onClick={closeModal}>
      <div
        className="battle-mode-container"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Choose your Battle Mode</h2>
        <button
          className="battle-mode-button battle-mode-multiplayer"
          onClick={handleMultiplayerBattle}
        >
          Multiplayer Battle
        </button>
        <button
          className="battle-mode-button battle-mode-challenge"
          onClick={handleFriendlyChallenge}
        >
          Challenge Friend
        </button>

        <div className="battle-code-wrapper">
          <input
            type="text"
            placeholder="Enter 6-char code"
            className="battle-code-input"
            maxLength={6}
            autoCorrect="off"
            autoCapitalize="characters"
            inputMode="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            type="button"
            className={`battle-code-submit ${code.length === 6 ? 'active' : ''}`}
            onClick={() => handleJoinFriendlyMatch(code)}
            disabled={code.length !== 6}
          >
            ✔
          </button>
        </div>

        {alertMessage && (
          <div className="battle-code-alert-message">{alertMessage}</div>
        )}
      </div>
    </div>
  )
}

export default BattleModal
