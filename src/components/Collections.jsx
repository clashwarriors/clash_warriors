import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Modal from './Modal'
import CachedImage from './Shared/CachedImage'
import './style/collection.css'
import {
  fetchAndStoreAllCards,
  getAllCardsByRarity,
  ensureCardsFetchedV1,
} from '../utils/cardsStorer'

const Card = React.memo(({ card, onClick }) => (
  <div
    className={`new-collection-character-list-item rarity-${card.rarity}`}
    onClick={() => onClick(card)}
    style={{ cursor: 'pointer' }}
  >
    <img
      src={card.image}
      alt={card.character}
      style={{ width: '100%', height: '160px', borderRadius: '10px' }}
    />
  </div>
))

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

  useEffect(() => {
    const updateCards = async () => {
      await ensureCardsFetchedV1((card) => {
        console.log('Card loaded:', card.cardId)
      })
    }
    updateCards()
  }, [])

  useEffect(() => {
    const loadInitialAndProgressive = async () => {
      // Load COMMON first
      const commonCards = await getAllCardsByRarity('common')
      setCards(commonCards)
      setLoading(false)

      // Now fetch all and progressively add
      await fetchAndStoreAllCards((card) => {
        setCards((prev) => {
          const exists = prev.find((c) => c.cardId === card.cardId)
          return exists ? prev : [...prev, card]
        })
      })
    }

    loadInitialAndProgressive()
  }, [])

  useEffect(() => {
    const loadAllCards = async () => {
      const allCards = []
      for (const rarity of rarities) {
        const cardsByRarity = await getAllCardsByRarity(rarity)
        allCards.push(...cardsByRarity)
      }
      setCards(allCards)
      setLoading(false)

      // Fetch latest from Firestore & update progressively
      await fetchAndStoreAllCards((card) => {
        setCards((prev) => {
          const exists = prev.find((c) => c.cardId === card.cardId)
          return exists ? prev : [...prev, card]
        })
      })
    }

    loadAllCards()
  }, [rarities])

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchRarity = selectedRarity ? card.rarity === selectedRarity : true
      const matchCharacter = selectedCharacter
        ? card.character === selectedCharacter
        : true
      return matchRarity && matchCharacter
    })
  }, [cards, selectedRarity, selectedCharacter])

  const handleCardClick = useCallback((card) => {
    setSelectedCard(card)
    setIsModalOpen(true)
  }, [])

  return (
    <div className="new-collection-container">
      <div className="new-collection-title-wrapper">
        <img
          src="/new/collectionpage/plates/cardshop-title.png"
          alt="Card Shop Title"
          className="new-collection-title"
        />
      </div>

      <div className="new-collection-rarity-container">
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
      </div>

      <div className="new-collection-rarity-container">
        {selectedRarity && (
          <div
            className="new-collection-rarity-scroll"
            style={{ paddingTop: '20px' }}
          >
            <button
              className="new-collection-close-button0"
              onClick={() => {
                setSelectedRarity(null)
                setSelectedCharacter(null)
              }}
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
      </div>

      <div className="new-collection-cards-container">
        {loading ? (
          <div className="loading-message">Loading cards...</div>
        ) : filteredCards.length > 0 ? (
          filteredCards.map((card) => (
            <Card key={card.cardId} card={card} onClick={handleCardClick} />
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
