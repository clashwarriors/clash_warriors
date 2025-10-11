// ./battleComp/BattleFooter.jsx
import React, { memo } from 'react'
import CachedImage from '../../shared/CachedImage'

const BattleFooter = memo(({
  cancelMatch,
  handleEndRound,
  phase,
  phaseBadges = {},
  selectedCard,
  selectedAbility,
}) => {
  const canEndRound = !!selectedCard && !!selectedAbility

  return (
    <div className="battle-footer">
      <CachedImage
        src="/new/battle/assets/endBattleBtn.png"
        alt="End Battle Button"
        className="footer-btn"
        onClick={cancelMatch}
      />

      <CachedImage
        src={phaseBadges[phase]}
        alt={`Phase: ${phase}`}
        className="phase-badge"
      />

      <CachedImage
        src="/new/battle/assets/endRoundBtn.png"
        alt="End Round Button"
        className="footer-btn end-round-btn"
        onClick={handleEndRound}
        style={{ opacity: canEndRound ? 1 : 0.5 }}
        title={canEndRound ? 'End Round' : 'Select card and ability first'}
      />
    </div>
  )
})

export default BattleFooter
