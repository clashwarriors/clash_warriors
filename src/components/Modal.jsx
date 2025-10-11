import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import './style/modal.css'
import CachedImage from './Shared/CachedImage'
import {
  storeCards,
  storeUserData,
  getCards,
  getUserData,
} from '../utils/indexedDBService'
import { syncUser } from '../utils/firebaseSyncService'
import { triggerHapticFeedback } from './tournament/utils/haptic'

const XP_MAP = {
  common: 15,
  uncommon: 25,
  rare: 35,
  mythical: 50,
  legendary: 75,
}
const PPH_MAP = {
  common: 150,
  uncommon: 500,
  rare: 800,
  mythical: 1000,
  legendary: 1200,
}

const StatsRow = memo(({ stats, icons }) => (
  <div className="new-modal-stats-row">
    {icons.map(({ key, src }) => (
      <div key={key} className="stats-cell">
        <CachedImage src={src} alt={key} /> {stats?.[key] ?? '-'}
      </div>
    ))}
  </div>
))

const Modal = memo(({ user, isOpen, onClose, cardId, category }) => {
  const [cardDetails, setCardDetails] = useState(null)
  const [isCardPurchased, setIsCardPurchased] = useState(false)
  const modalRef = useRef(null)

  const fetchMasterCards = useCallback(async () => {
    if (window.__ALL_CARDS__) return window.__ALL_CARDS__

    // Try localStorage
    const cached = localStorage.getItem('masterCardUpdateV1')
    if (cached) {
      const parsed = JSON.parse(cached)
      window.__ALL_CARDS__ = Array.isArray(parsed)
        ? parsed
        : (parsed.cards ?? [])
      // Normalize cards
      window.__ALL_CARDS__ = window.__ALL_CARDS__.map((c) => ({
        ...c,
        image: c.image || c.photo || '/fallback.png',
        name: c.name || c.title || 'Unknown Card',
        cardId: c.cardId || c.id,
      }))
      return window.__ALL_CARDS__
    }

    // Fetch from API
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/cards`)
      const data = await res.json()
      const cardsArray = Array.isArray(data) ? data : (data.cards ?? [])
      window.__ALL_CARDS__ = cardsArray.map((c) => ({
        ...c,
        image: c.image || c.photo || '/fallback.png',
        name: c.name || c.title || 'Unknown Card',
        cardId: c.cardId || c.id,
      }))
      localStorage.setItem(
        'masterCardUpdateV1',
        JSON.stringify(window.__ALL_CARDS__)
      )
      return window.__ALL_CARDS__
    } catch (err) {
      console.error('❌ Failed to fetch master cards:', err)
      return []
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !cardId) return

    setCardDetails(null)
    setIsCardPurchased(false)

    const fetchCard = async () => {
      const userCards = await getCards()
      let localCard = userCards.find((c) => c.cardId === cardId)

      // Set purchased flag if user already owns it
      if (localCard) setIsCardPurchased(true)

      // Sync master cards once
      const allCards = await fetchMasterCards()
      const masterCard = allCards.find((c) => c.cardId === cardId)

      if (masterCard) {
        localCard = localCard ? { ...localCard, ...masterCard } : masterCard
        await storeCards([localCard])
      }

      setCardDetails(localCard)
    }

    fetchCard()
  }, [isOpen, cardId, fetchMasterCards])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        triggerHapticFeedback('medium')
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  const purchaseCard = useCallback(async () => {
    if (!user?.userId || !cardDetails) return
    triggerHapticFeedback('medium')

    try {
      const userData = await getUserData()
      if ((userData.coins || 0) < (cardDetails.price || 0)) {
        alert('Not enough coins!')
        return
      }

      const updatedCard = {
        cardId,
        name: cardDetails.name,
        description: cardDetails.description,
        photo: cardDetails.image,
        stats: cardDetails.stats,
        price: cardDetails.price,
        syncedWithMaster: true,
      }

      await storeCards([updatedCard])
      const newUserData = {
        ...userData,
        coins: userData.coins - (cardDetails.price || 0),
        xp: (userData.xp || 0) + (XP_MAP[category] || 0),
        pph: (userData.pph || 0) + (PPH_MAP[category] || 0),
      }

      await storeUserData(newUserData)
      setIsCardPurchased(true)
      await syncUser(newUserData)
      console.log('✅ Card purchased', updatedCard)
    } catch (err) {
      console.error('❌ Error purchasing card:', err)
    }
  }, [user?.userId, cardDetails, cardId, category])

  if (!isOpen) return null

  const statsIcons = [
    { key: 'attack', src: '/new/collectionpage/stats/attack.png' },
    { key: 'armor', src: '/new/collectionpage/stats/armour.png' },
    { key: 'vitality', src: '/new/collectionpage/stats/vitality.png' },
    { key: 'agility', src: '/new/collectionpage/stats/agility.png' },
    { key: 'intelligence', src: '/new/collectionpage/stats/intelligence.png' },
    { key: 'powers', src: '/new/collectionpage/stats/power.png' },
  ]

  return (
    <div className="new-modal">
      <div className="new-modal-content" ref={modalRef}>
        <div className="new-modal-body">
          <div className={`new-modal-card-frame modal-rarity-${category}`}>
            <img
              src={cardDetails?.image || cardDetails?.photo}
              alt={cardDetails?.name ?? 'Card'}
              className="new-modal-card-image"
            />
          </div>

          <div className="new-modal-card-details">
            <h2 className="new-modal-title">
              {cardDetails?.name ?? 'Loading...'}
            </h2>
            <p className="new-modal-description">
              {cardDetails?.description ?? 'No description.'}
            </p>

            <StatsRow
              stats={cardDetails?.stats}
              icons={statsIcons.slice(0, 3)}
            />
            <StatsRow
              stats={cardDetails?.stats}
              icons={statsIcons.slice(3, 6)}
            />

            {!isCardPurchased && (
              <div className="new-modal-price-buy">
                <div className="price-display">
                  <CachedImage
                    src="/new/coins.png"
                    alt="Coins"
                    style={{ width: 20, height: 20, marginRight: 5 }}
                  />
                  {cardDetails?.price ?? 0}
                </div>
                <button
                  className="new-modal-purchase-btn"
                  onClick={purchaseCard}
                >
                  <CachedImage
                    src="/new/collectionpage/stats/buy-button.png"
                    alt="BUY"
                    className="buy-image"
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default Modal
