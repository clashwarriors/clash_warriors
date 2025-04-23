import React, { useState, useEffect } from 'react'
import {
  getDatabase,
  ref as rtdbRef,
  get,
  set as rtdbSet,
  update,
  child,
  onValue,
  off,
} from 'firebase/database'
import AOS from 'aos'
import 'aos/dist/aos.css'
import './style/premium.css'
import {
  TonConnectButton,
  useTonConnectUI,
  useTonWallet,
} from '@tonconnect/ui-react'
import { db, realtimeDB } from '../firebase'

const Premium = ({ user }) => {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [cards, setCards] = useState([])
  const [selectedCard, setSelectedCard] = useState(null)
  const [tonConnectUI] = useTonConnectUI()
  const [previewImage, setPreviewImage] = useState(null)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [justBoughtCardId, setJustBoughtCardId] = useState(null)
  const [isBuying, setIsBuying] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [cardInfo, setCardInfo] = useState(null)

  const categories = [
    'all',
    'frostguard',
    'stormscaller',
    'starviya',
    'xalgrith',
  ]

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: false,
      mirror: true,
      offset: 80,
      easing: 'ease-in-out',
    })
  }, [])

  const waitForPurchase = async (cardId) => {
    const maxTries = 10
    let tries = 0

    const userCardsRef = rtdbRef(getDatabase(), `users/${user.userId}/cards`)

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        const snap = await get(userCardsRef)
        const owned = snap.exists() ? Object.keys(snap.val()) : []

        if (owned.includes(cardId) || tries >= maxTries) {
          clearInterval(interval)
          resolve(owned.includes(cardId))
        }

        tries++
      }, 3000) // Poll every 3 seconds
    })
  }

  const fetchCards = async () => {
    try {
      const db = getDatabase()

      // 1️⃣ Get list of user's owned card IDs
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
      console.error('Error fetching data:', error)
    }
  }

  useEffect(() => {
    fetchCards()
  }, [selectedCategory]) // This ensures cards are fetched when category changes

  const handleBuy = async () => {
    setIsBuying(true)

    if (!selectedCard || !selectedCard.price) {
      alert('❌ Card not selected or invalid price.')
      setIsBuying(false)
      return
    }

    if (selectedCard.sold >= 1000) {
      alert('❌ This card is sold out!')
      setIsBuying(false)
      return
    }

    const safeCardId = selectedCard?.id || 'unknown_card'
    const safePrice =
      typeof selectedCard?.price === 'number' ? selectedCard.price : 0
    const cardName = selectedCard?.name || 'Unknown Card'

    console.log('🧾 Purchase Attempt:', {
      Name: cardName,
      Price: safePrice,
      UserID: user.userId,
      CardID: safeCardId,
    })

    try {
      const response = await fetch(
        'https://cw-backend-571881437561.us-central1.run.app/api/createInvoiceLink',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payload: JSON.stringify({
              userId: user.userId,
              cardId: safeCardId,
              cardName,
              price: safePrice,
            }),
            currency: 'XTR',
            prices: [{ amount: safePrice }],
          }),
        }
      )

      const data = await response.json()

      if (!data.success || !data.invoiceLink) {
        alert('❌ Failed to generate invoice.')
        setIsBuying(false)
        return
      }

      // ✅ Open via Telegram's safe API
      if (window.Telegram?.WebApp?.openInvoice) {
        Telegram.WebApp.openInvoice(data.invoiceLink)
      } else {
        // Fallback
        window.open(data.invoiceLink, '_blank')
      }

      // After invoice is opened, wait for the purchase to be confirmed
      const paid = await waitForPurchase(safeCardId)

      if (paid) {
        setPurchaseSuccess(true) // Show success modal
        setSelectedCard(null) // Close the card modal
        fetchCards() // ⬅️ Refresh the cards list

        setTimeout(() => {
          setPurchaseSuccess(false) // Hide the success modal after 5 seconds
        }, 5000)
      }
    } catch (error) {
      console.error('❗ Error creating invoice link:', error)
      alert('Something went wrong. Try again later.')
    } finally {
      setIsBuying(false)
    }
  }

  return (
    <div className="premium-container">
      <div className="premium-header">
        <div
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

      <div className="premium-cards-grid">
        {cards.length > 0 ? (
          cards.map((card) => (
            <div
              key={card.id}
              className="premium-card"
              data-aos={Math.random() > 0.5 ? 'fade-up-right' : 'fade-up-left'}
              onClick={() => setSelectedCard(card)}
            >
              <div className="premium-limited-badge">Limited Edition</div>
              <div className="premium-card-count">{card.sold}/1000</div>
              <img src={card.image} alt={card.name} />
              <div className="premium-card-details">
                <h3>{card.name || 'Unknown'}</h3>
                <p>{card.price} ✨</p>
              </div>
            </div>
          ))
        ) : (
          <p>No cards available for this category.</p>
        )}
      </div>

      {/* Modal for Card Details */}
      {selectedCard && (
        <div
          className="premium-card-modal-overlay"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="premium-card-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="premium-modal-close"
              onClick={() => setSelectedCard(null)}
            >
              ×
            </button>

            <img
              src={selectedCard.image}
              alt={selectedCard.name}
              className="premium-modal-image-full"
              onClick={() => setPreviewImage(selectedCard.image)}
              style={{ cursor: 'zoom-in' }}
            />

            {previewImage && (
              <div
                className="image-preview-overlay"
                onClick={() => setPreviewImage(null)}
              >
                <div
                  className="image-preview-modal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="image-preview-close"
                    onClick={() => setPreviewImage(null)}
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
                  <p>✨ XP: {selectedCard.xp || '0'}</p>
                </div>
              </div>

              <button
                className="premium-buy-button"
                onClick={handleBuy}
                disabled={isBuying}
              >
                {isBuying
                  ? 'Processing...'
                  : `Buy for ${selectedCard.price} Stars ✨`}
              </button>
            </div>
          </div>
        </div>
      )}

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
