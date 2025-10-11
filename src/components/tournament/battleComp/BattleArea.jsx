// ./battleComp/BattleArea.jsx
import React, { memo } from 'react'

const BattleArea = memo(
  ({
    selectedCard,
    player2SelectedCard,
    cardHolder,
    summonLeft,
    summonRight,
  }) => {
    return (
      <div className="battle-area">
        {/* Left Player */}
        <div
          className="summon-wrapper summon-left"
          style={{ position: 'relative' }}
        >
          <img
            src={selectedCard?.src || cardHolder}
            alt="Player Card"
            className="card-img"
            style={{ position: 'relative', zIndex: 2 }}
          />
          <img
            src={summonLeft}
            alt="Summon Ring Left"
            className="summon-img glow-orange"
          />
        </div>

        {/* Right Player */}
        <div
          className="summon-wrapper summon-right"
          style={{ position: 'relative' }}
        >
          <img
            src={player2SelectedCard?.src || cardHolder}
            className="card-img"
            style={{ marginLeft: 10 }}
            alt="Player2 Card"
          />
          <img
            src={summonRight}
            alt="Summon Ring Right"
            className="summon-img glow-blue tilt-up"
          />
        </div>
      </div>
    )
  }
)

export default BattleArea
