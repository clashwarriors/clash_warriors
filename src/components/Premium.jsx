import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getDatabase, ref as rtdbRef, get } from 'firebase/database'
import AOS from 'aos'
import 'aos/dist/aos.css'
import './style/premium.css'
import { TonConnectButton, useTonConnectUI } from '@tonconnect/ui-react'
import { realtimeDB } from '../firebase'

const Premium = ({ user }) => {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [cards, setCards] = useState([])
  const [selectedCard, setSelectedCard] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [isBuying, setIsBuying] = useState(false)

  const [tonConnectUI] = useTonConnectUI()

  const categories = useMemo(
    () => ['all', 'frostguard', 'stormscaller', 'starviya', 'xalgrith'],
    []
  )

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: false,
      mirror: true,
      offset: 80,
      easing: 'ease-in-out',
    })
  }, [])

  const fetchCards = useCallback(async () => {
    try {
      const db = getDatabase()
      const userCardsRef = rtdbRef(db, `users/${user.userId}/cards`)
      const userCardsSnap = await get(userCardsRef)
      const ownedCardIds = userCardsSnap.exists()
        ? Object.keys(userCardsSnap.val())
        : []

      const isOwned = (cardId) => ownedCardIds.includes(cardId)

      if (selectedCategory === 'all') {
        const allPromises = categories
          .filter((cat) => cat !== 'all')
          .map(async (cat) => {
            const refPath = rtdbRef(db, `premium/${cat}/`)
            const snap = await get(refPath)
            return snap.exists()
              ? Object.entries(snap.val())
                  .filter(([key]) => !isOwned(key))
                  .map(([key, value]) => ({
                    id: key,
                    ...value,
                  }))
              : []
          })

        const results = await Promise.all(allPromises)
        setCards(results.flat())
      } else {
        const cardsRef = rtdbRef(db, `premium/${selectedCategory}/`)
        const snapshot = await get(cardsRef)
        if (snapshot.exists()) {
          const data = snapshot.val()
          const formattedCards = Object.entries(data)
            .filter(([key]) => !isOwned(key))
            .map(([key, value]) => ({
              id: key,
              ...value,
            }))
          setCards(formattedCards)
        } else {
          setCards([])
        }
      }
    } catch (error) {
      console.error('Error fetching cards:', error)
    }
  }, [user.userId, selectedCategory, categories])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  const handleCardSelect = useCallback((card) => {
    setSelectedCard(card)
  }, [])

  const handleModalClose = useCallback(() => {
    setSelectedCard(null)
  }, [])

  const handlePreviewOpen = useCallback((image) => {
    setPreviewImage(image)
  }, [])

  const handlePreviewClose = useCallback(() => {
    setPreviewImage(null)
  }, [])

  const cardsList = useMemo(
    () =>
      cards.length > 0 ? (
        cards.map((card) => (
          <div
            key={card.id}
            className="premium-card"
            data-aos={Math.random() > 0.5 ? 'fade-up-right' : 'fade-up-left'}
            onClick={() => handleCardSelect(card)}
          >
            <div className="premium-limited-badge">Limited Edition</div>
            <div className="premium-card-count">{card.sold}/1000</div>
            <img src={card.image} alt={card.name} />
            <div className="premium-card-details">
              <h3>{card.name}</h3>
              <p>{card.price} ✨</p>
            </div>
          </div>
        ))
      ) : (
        <p>No cards available for this category.</p>
      ),
    [cards, handleCardSelect]
  )

  return (
    <div className="premium-container">
      <div className="premium-header">
        <div
          className="premium-header-top"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '20px',
          }}
        >
          <img
            src="/logo.png"
            alt="Clash Warriors"
            style={{ height: '40px' }}
          />
          <TonConnectButton />
        </div>
      </div>

      <div className="premium-category-tabs">
        {categories.map((category) => (
          <button
            key={category}
            className={`premium-tab-button ${selectedCategory === category ? 'premium-active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="premium-cards-grid">{cardsList}</div>

      {/* Card Modal */}
      {selectedCard && (
        <div className="premium-card-modal-overlay" onClick={handleModalClose}>
          <div
            className="premium-card-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="premium-modal-close" onClick={handleModalClose}>
              ×
            </button>

            <img
              src={selectedCard.image}
              alt={selectedCard.name}
              className="premium-modal-image-full"
              onClick={() => handlePreviewOpen(selectedCard.image)}
              style={{ cursor: 'zoom-in' }}
            />

            {previewImage && (
              <div
                className="image-preview-overlay"
                onClick={handlePreviewClose}
              >
                <div
                  className="image-preview-modal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="image-preview-close"
                    onClick={handlePreviewClose}
                  >
                    ×
                  </button>
                  <img src={previewImage} alt="Preview" />
                </div>
              </div>
            )}

            <div className="premium-modal-content">
              <h2>{selectedCard.name}</h2>
              <p className="premium-description">{selectedCard.description}</p>

              <div className="premium-modal-section">
                <h3 className="premium-section-heading">Stats</h3>
                <div className="premium-stats-split">
                  <div className="premium-stats-column">
                    <p>🛡️ Armor: {selectedCard.stats?.armor}</p>
                    <p>⚔️ Attack: {selectedCard.stats?.attack}</p>
                    <p>⚡ Agility: {selectedCard.stats?.agility}</p>
                  </div>
                  <div className="premium-stats-column">
                    <p>🧠 Intelligence: {selectedCard.stats?.intelligence}</p>
                    <p>🔥 Powers: {selectedCard.stats?.powers}</p>
                    <p>❤️ Vitality: {selectedCard.stats?.vitality}</p>
                  </div>
                </div>

                <hr className="premium-stats-divider" />

                <div className="premium-xp-pph-row">
                  <p>💥 PPH: {selectedCard.pph}/H</p>
                  <p>
                    <img src="/l32.png" alt="WARS" /> 10,000 WARS
                  </p>
                  <p>XP: {selectedCard.xp || '0'}</p>
                </div>
              </div>

              <button className="premium-buy-button" disabled={isBuying}>
                {isBuying
                  ? 'Processing...'
                  : `Buy for ${selectedCard.price} Stars ✨`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Success Modal */}
      {purchaseSuccess && (
        <div className="premium-success-modal">
          <div className="premium-success-box" data-aos="zoom-in">
            <h2>Purchase Successful!</h2>
            <p>You now own this card 🎉</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Premium
