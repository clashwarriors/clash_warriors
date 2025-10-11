// ./battleComp/DeckSection.jsx
import React, { memo, useCallback } from 'react'
import { PHASES } from '../utils/battleModifiers'
import { triggerHapticFeedback } from '../../tournament/utils/haptic'

const DeckSection = memo(
  ({
    playerDeck = [],
    usedCardIds = [],
    currentRound = {},
    isPlayer1,
    phase,
    handleCardClick,
  }) => {
    // Memoized click handler for performance
    const onCardClick = useCallback(
      (card, isBlocked) => {
        if (!isBlocked) handleCardClick(card)
        triggerHapticFeedback()
      },
      [handleCardClick]
    )

    return (
      <div className="deck-section">
        {playerDeck.map((card) => {
          const isBlocked =
            usedCardIds.includes(card.cardId) ||
            (currentRound?.player1?.cardId === card.cardId && isPlayer1) ||
            (currentRound?.player2?.cardId === card.cardId && !isPlayer1)

          return (
            <img
              key={card.cardId}
              src={card.photo || card.image}
              alt={card.name}
              className={`deck-card 
              ${phase !== PHASES.SELECTION ? 'disabled' : ''} 
              ${isBlocked ? 'used' : ''}`}
              onClick={() => onCardClick(card, isBlocked)}
              loading="lazy" // defer offscreen images
              draggable={false} // improve touch performance
            />
          )
        })}
      </div>
    )
  }
)

export default DeckSection
