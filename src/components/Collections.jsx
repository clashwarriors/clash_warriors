import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Modal from './Modal'
import CachedImage from './Shared/CachedImage'
import './style/collection.css'
import {
  fetchAndStoreAllCards,
  getAllCardsByRarity,
} from '../utils/cardsStorer'
import { triggerHapticFeedback } from './tournament/utils/haptic'

// ----- Card Component -----
const Card = React.memo(({ card, onClick }) => (
  <div
    className={`new-collection-character-list-item rarity-${card.rarity}`}
    onClick={() => (onClick(card), triggerHapticFeedback())}
    style={{ cursor: 'pointer' }}
  >
    <img
      src={card.image}
      alt={card.character}
      style={{ width: '100%', height: '160px', borderRadius: '10px' }}
      loading="lazy"
    />
  </div>
))

// ----- Collection Component -----
const Collection = React.memo(({ user }) => {
  const [selectedRarity, setSelectedRarity] = useState(null)
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)

  const rarities = useMemo(
    () => ['common', 'uncommon', 'rare', 'mythical', 'legendary'],
    []
  )
  const characters = useMemo(
    () => ['frostguard', 'stormscaller', 'starivya', 'xalgrith'],
    []
  )

  // ----- Load Cards -----
  useEffect(() => {
    if (!user?.userId) return

    let cancelled = false
    setLoading(true)

    const loadCards = async () => {
      // Fetch from IndexedDB
      const allCardsByRarity = await Promise.all(
        rarities.map((r) => getAllCardsByRarity(r))
      )
      const allCardsFlat = allCardsByRarity.flat()

      if (allCardsFlat.length > 0) {
        // Dedupe cards by unique key: cardId + rarity + character
        const uniqueMap = new Map()
        allCardsFlat.forEach((c) => {
          const key = `${c.cardId}-${c.rarity}-${c.character}`
          if (!uniqueMap.has(key)) uniqueMap.set(key, c)
        })

        // Batch render to prevent freeze
        const batchSize = 20
        const uniqueCards = Array.from(uniqueMap.values())
        for (let i = 0; i < uniqueCards.length; i += batchSize) {
          if (cancelled) return
          setCards((prev) => [...prev, ...uniqueCards.slice(i, i + batchSize)])
          await new Promise((r) => setTimeout(r, 0)) // yield
        }
        setLoading(false)
        return
      }

      // If DB empty, fetch from backend
      await fetchAndStoreAllCards(
        user.userId,
        (card) => {
          setCards((prev) => {
            const key = `${card.cardId}-${card.rarity}-${card.character}`
            if (
              prev.find((c) => `${c.cardId}-${c.rarity}-${c.character}` === key)
            )
              return prev
            return [...prev, card]
          })
        },
        false
      )

      setLoading(false)
    }

    loadCards()
    return () => {
      cancelled = true
    }
  }, [user?.userId])

  // ----- Filter Cards -----
  const filteredByRarity = useMemo(() => {
    if (!selectedRarity) return cards
    return cards.filter((c) => c.rarity === selectedRarity)
  }, [cards, selectedRarity])

  const filteredCards = useMemo(() => {
    if (!selectedCharacter) return filteredByRarity
    return filteredByRarity.filter((c) => c.character === selectedCharacter)
  }, [filteredByRarity, selectedCharacter])

  // ----- Deduplicate for rendering -----
  const uniqueFilteredCards = useMemo(() => {
    const map = new Map()
    filteredCards.forEach((c) => {
      const key = `${c.cardId}-${c.rarity}-${c.character}`
      if (!map.has(key)) map.set(key, c)
    })
    return Array.from(map.values())
  }, [filteredCards])

  // ----- Handlers -----
  const handleCardClick = useCallback((card) => {
    setSelectedCard(card)
    setIsModalOpen(true)
    triggerHapticFeedback()
  }, [])

  const closeFilters = () => {
    setSelectedRarity(null)
    setSelectedCharacter(null)
    triggerHapticFeedback()
  }

  // ----- Render -----
  return (
    <div className="new-collection-container">
      <div className="new-collection-title-wrapper">
        <CachedImage
          src="/new/collectionpage/plates/cardshop-title.png"
          alt="Card Shop Title"
          className="new-collection-title"
        />
      </div>

      {!selectedRarity && (
        <div
          className="new-collection-rarity-scroll"
          style={{ paddingTop: '20px' }}
        >
          {rarities.map((rarity) => (
            <div
              key={rarity}
              className="new-collection-rarity-item"
              onClick={() => setSelectedRarity(rarity)}
            >
              <CachedImage
                src={`/new/collectionpage/plates/${rarity}-plate.png`}
                alt={rarity}
              />
              <span>{rarity.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}

      {selectedRarity && (
        <div
          className="new-collection-rarity-scroll"
          style={{ paddingTop: '20px' }}
        >
          <button
            className="new-collection-close-button0"
            onClick={closeFilters}
          >
            <CachedImage src="/new/x-close.png" alt="Close" />
          </button>
          {characters.map((char) => (
            <div
              key={char}
              className="new-collection-rarity-item"
              onClick={() => setSelectedCharacter(char)}
            >
              <CachedImage
                src={`/new/collectionpage/characters/${char}-plate.png`}
                alt={char}
              />
            </div>
          ))}
        </div>
      )}

      <div className="new-collection-cards-container">
        {loading ? (
          <div className="loading-message">Loading cards...</div>
        ) : uniqueFilteredCards.length > 0 ? (
          uniqueFilteredCards.map((card) => (
            <Card
              key={`${card.cardId}-${card.rarity}-${card.character}`}
              card={card}
              onClick={handleCardClick}
            />
          ))
        ) : (
          <div>No cards match the selected filters.</div>
        )}
      </div>

      {isModalOpen && selectedCard && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          user={user}
          cardId={selectedCard.cardId}
          category={selectedCard.rarity}
          collection={selectedCard.character}
        />
      )}
    </div>
  )
})

export default Collection
