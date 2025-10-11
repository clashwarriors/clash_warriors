// src/components/battle/PlayerHeader.jsx
import React, { memo } from 'react'

const PlayerHeader = memo(({ name, role, dp, hp, side }) => {
  const isLeft = side === 'left'
  const roleIcon = role === 'attack' ? '⚔️' : '🛡️'

  return (
    <div className={`battle-header-${side}`}>
      {isLeft && role && (
        <div className="avatar-container">
          <img src={dp} alt="Player Avatar" className="avatar" />
          <span className={`role-badge ${side}`}>{roleIcon}</span>
        </div>
      )}

      <div className="player-info">
        <p className="player-name">{name}</p>
        <div className="synergy-bar">
          <div className="synergy-fill" style={{ width: `${hp}%` }}>
            <span className="synergy-text">{hp}%</span>
          </div>
        </div>
      </div>

      {!isLeft && role && (
        <div className="avatar-container">
          <img src={dp} alt="Player Avatar" className="avatar" />
          <span className={`role-badge ${side}`}>{roleIcon}</span>
        </div>
      )}
    </div>
  )
})

export default PlayerHeader
