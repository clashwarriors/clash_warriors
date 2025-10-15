import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import CachedImage from '../Shared/CachedImage'
import { getUserDeck, getCards } from '../../utils/indexedDBService'
import './style/defaultDeckModal.style.css'

const categories = [
  'common',
  'uncommon',
  'rare',
  'mythical',
  'legendary',
  'premium',
  'free',
]

const DefaultDeckModal = ({ isOpen, onClose, categoryData }) => {
  const [defaultDeck, setDefaultDeck] = useState([])
  const modalContentRef = useRef(null)
  const navigate = useNavigate()

  // ---------------- Fetch default deck once per open ----------------
  const fetchDefaultDeck = useCallback(async () => {
    try {
      // Get all cards and user deck
      const allCards = await getCards()
      const deckData = await getUserDeck('default') // deckData.cards is array of cardIds

      // Map deck cardIds to actual card objects
      const deckCards = deckData.cards
        .map((id) => allCards.find((c) => c.cardId === id))
        .filter(Boolean) // remove missing cards
        .slice(0, 10)

      // Map deck to include category
      const deckWithCategory = deckCards.map((card) => {
        const matchedCategory = categories.find((category) => {
          const data = categoryData?.[category]
          return data && Object.prototype.hasOwnProperty.call(data, card.id)
        })
        return { ...card, category: matchedCategory || null }
      })

      setDefaultDeck(deckWithCategory)
    } catch (err) {
      console.error('❌ Failed to fetch default deck:', err)
    }
  }, [categoryData, categories])

  useEffect(() => {
    if (isOpen) fetchDefaultDeck()
  }, [isOpen, fetchDefaultDeck])

  // ---------------- Close modal on outside click ----------------
  const handleClickOutside = useCallback(
    (e) => {
      if (
        modalContentRef.current &&
        !modalContentRef.current.contains(e.target)
      ) {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, handleClickOutside])

  if (!isOpen) return null

  // ---------------- Render 10 slots efficiently ----------------
  const slots = Array.from({ length: 10 }, (_, index) => {
    const card = defaultDeck[index]
    return (
      <div
        key={index}
        className={`default-deck-modal-card ${card?.category ? `card-${card.category}` : ''}`}
      >
        {card ? (
          <div className="card-image-wrapper">
            <CachedImage
              src={card.photo || card.image}
              alt={card.name}
              className="default-deck-modal-card-image"
            />
            {card.category && card.category !== 'free' && (
              <CachedImage
                src={`/new/tournament/frames/${card.category}-frame.png`}
                alt={`${card.category} frame`}
                className="card-frame-overlay"
              />
            )}
          </div>
        ) : (
          <div className="default-deck-modal-placeholder">Empty Slot</div>
        )}
      </div>
    )
  })

  return (
    <div className="default-deck-modal-overlay">
      <div className="default-deck-modal-content" ref={modalContentRef}>
        <div className="default-deck-modal-grid">{slots}</div>
        <div className="default-deck-modal-footer">
          <CachedImage
            src="/new/tournament/builddeckBtn.png"
            alt="Build Deck"
            className="go-to-builddeck-button-modal"
            onClick={() => navigate('/builddeck')}
          />
        </div>
      </div>
    </div>
  )
}

export default React.memo(DefaultDeckModal)
