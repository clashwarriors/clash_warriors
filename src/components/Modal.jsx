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

const xpMap = {
  common: 15,
  uncommon: 25,
  rare: 35,
  mythical: 50,
  legendary: 75,
}
const pphMap = {
  common: 150,
  uncommon: 500,
  rare: 800,
  mythical: 1000,
  legendary: 1200,
}

// Memoized stats row
const StatsRow = memo(({ stats, icons }) => (
  <div className="new-modal-stats-row">
    {icons.map(({ src, key }) => (
      <div key={key}>
        <CachedImage src={src} /> {stats?.[key] ?? '-'}
      </div>
    ))}
  </div>
))

const Modal = memo(({ user, isOpen, onClose, cardId, category }) => {
  const [cardDetails, setCardDetails] = useState(null)
  const [isCardPurchased, setIsCardPurchased] = useState(false)
  const modalContentRef = useRef(null)

  // Fetch master cards once ever
  const fetchMasterCards = useCallback(async () => {
    if (!window.__ALL_CARDS__) {
      const stored = localStorage.getItem('masterCardUpdateV1')
      if (stored) {
        const parsed = JSON.parse(stored)
        window.__ALL_CARDS__ = Array.isArray(parsed)
          ? parsed
          : (parsed.cards ?? [])
      } else {
        try {
          const BACKEND_URL = import.meta.env.VITE_API_BASE_URL
          const res = await fetch(`${BACKEND_URL}/api/cards`)
          const data = await res.json()
          window.__ALL_CARDS__ = Array.isArray(data) ? data : (data.cards ?? [])
          localStorage.setItem(
            'masterCardUpdateV1',
            JSON.stringify(window.__ALL_CARDS__)
          )
        } catch (err) {
          console.error('❌ Failed to fetch master cards:', err)
          window.__ALL_CARDS__ = []
        }
      }
    }
    return window.__ALL_CARDS__
  }, [])

  // Fetch card details
  useEffect(() => {
    if (!isOpen || !cardId) return

    setCardDetails(null)
    setIsCardPurchased(false)

    const fetchCard = async () => {
      const userCards = await getCards()
      let localCard = userCards.find((c) => c.cardId === cardId)
      const masterSynced = localStorage.getItem('masterCardUpdateV1')

      // Only sync once ever
      if (!masterSynced) {
        const allCards = await fetchMasterCards()
        const jsonCard = allCards.find((c) => c.cardId === cardId)
        if (jsonCard) {
          localCard = localCard
            ? { ...localCard, ...jsonCard }
            : { ...jsonCard }
          await storeCards([localCard])
        }
        localStorage.setItem(
          'masterCardUpdateV1',
          JSON.stringify(window.__ALL_CARDS__)
        )
      }

      if (localCard) setCardDetails(localCard)
    }

    fetchCard()
  }, [isOpen, cardId, fetchMasterCards])

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      triggerHapticFeedback('medium')
      if (
        modalContentRef.current &&
        !modalContentRef.current.contains(e.target)
      ) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Purchase card
  const purchaseCard = useCallback(async () => {
    if (!user?.userId || !cardDetails) return
    triggerHapticFeedback('medium')

    try {
      const userData = await getUserData()
      if ((userData.coins || 0) < (cardDetails.price || 0)) {
        alert('Not enough coins!')
        return
      }

      const cardData = {
        cardId,
        name: cardDetails.name,
        description: cardDetails.description,
        photo: cardDetails.image,
        stats: cardDetails.stats,
        price: cardDetails.price,
        syncedWithMaster: true,
      }

      await storeCards([cardData])
      const updatedUserData = {
        ...userData,
        coins: userData.coins - cardDetails.price,
        xp: (userData.xp || 0) + (xpMap[category] || 0),
        pph: (userData.pph || 0) + (pphMap[category] || 0),
      }

      await storeUserData(updatedUserData)
      setIsCardPurchased(true)
      await syncUser(updatedUserData)
      console.log('Card purchased:', cardData)
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
      <div className="new-modal-content" ref={modalContentRef}>
        <div className="new-modal-body">
          <div className={`new-modal-card-frame modal-rarity-${category}`}>
            <img
              src={cardDetails?.image ?? cardDetails?.photo ?? '/fallback.png'}
              alt={cardDetails?.name || 'Card Image'}
              className="new-modal-card-image"
            />
          </div>

          <div className="new-modal-card-details">
            <h2 className="new-modal-title">
              {cardDetails?.name || 'Loading...'}
            </h2>
            <p className="new-modal-description">
              {cardDetails?.description || 'No description.'}
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
