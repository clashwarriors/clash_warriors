import React, { useState, useEffect, useRef, useCallback } from 'react'
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

const Modal = React.memo(({ user, isOpen, onClose, cardId, category }) => {
  const [cardDetails, setCardDetails] = useState(null)
  const [isCardPurchased, setIsCardPurchased] = useState(false)
  const modalContentRef = useRef(null)

  // Fetch card details from IndexedDB only
  useEffect(() => {
    if (!isOpen || !cardId) return

    setCardDetails(null)
    setIsCardPurchased(false)

    const fetchCard = async () => {
      const userCards = await getCards() // all cards user owns
      let localCard = userCards.find((c) => c.cardId === cardId)

      // Determine if card is purchased
      const purchased = !!localCard

      // Fetch master JSON to get latest image / data
      try {
        const BACKEND_URL = import.meta.env.VITE_API_BASE_URL
        const res = await fetch(`${BACKEND_URL}/api/cards`)
        const allCards = await res.json()
        const jsonCard = allCards.find((c) => c.cardId === cardId)

        if (jsonCard) {
          if (localCard) {
            // Update image if changed
            if (localCard.photo !== jsonCard.image) {
              localCard.photo = jsonCard.image
              await storeCards([localCard])
            }
          } else {
            localCard = { ...jsonCard }
          }
        }
      } catch (err) {
        console.error('❌ Failed to fetch card from JSON backend:', err)
      }

      if (localCard) {
        setCardDetails(localCard)
        setIsCardPurchased(purchased) // only true if user actually owns it
      }
    }

    fetchCard()
  }, [isOpen, cardId])

  // Click outside modal to close
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

  const purchaseCard = useCallback(async () => {
    if (!user?.userId || !cardDetails) return

    triggerHapticFeedback('medium')

    try {
      const userData = await getUserData()
      const currentCoins = userData.coins || 0
      const xp = userData.xp || 0
      const pph = userData.pph || 0
      const price = cardDetails.price || 0

      if (currentCoins < price) {
        alert('Not enough coins!')
        return
      }

      const cardData = {
        cardId,
        name: cardDetails.name,
        description: cardDetails.description,
        photo: cardDetails.image,
        stats: cardDetails.stats,
        price,
      }

      await storeCards([cardData])

      const updatedUserData = {
        ...userData,
        coins: currentCoins - price,
        xp: xp + (xpMap[category] || 0),
        pph: pph + (pphMap[category] || 0),
      }

      await storeUserData(updatedUserData)
      setIsCardPurchased(true)
      await syncUser(updatedUserData)
      console.log('Card purchased and stored in IndexedDB:', cardData)
    } catch (error) {
      console.error('❌ Error purchasing card:', error)
    }
  }, [user?.userId, cardDetails, cardId, category])

  if (!isOpen) return null

  return (
    <div className="new-modal">
      <div className="new-modal-content" ref={modalContentRef}>
        <div className="new-modal-body">
          <div className={`new-modal-card-frame modal-rarity-${category}`}>
            <img
              src={cardDetails?.image ?? cardDetails?.photo ?? '/fallback.png'} // remove fallback to photo
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

            <div className="new-modal-stats-row">
              <div>
                <CachedImage src="/new/collectionpage/stats/attack.png" />{' '}
                {cardDetails?.stats?.attack ?? '-'}
              </div>
              <div>
                <CachedImage src="/new/collectionpage/stats/armour.png" />{' '}
                {cardDetails?.stats?.armor ?? '-'}
              </div>
              <div>
                <CachedImage src="/new/collectionpage/stats/vitality.png" />{' '}
                {cardDetails?.stats?.vitality ?? '-'}
              </div>
            </div>

            <div className="new-modal-stats-row">
              <div>
                <CachedImage src="/new/collectionpage/stats/agility.png" />{' '}
                {cardDetails?.stats?.agility ?? '-'}
              </div>
              <div>
                <CachedImage src="/new/collectionpage/stats/intelligence.png" />{' '}
                {cardDetails?.stats?.intelligence ?? '-'}
              </div>
              <div>
                <CachedImage src="/new/collectionpage/stats/power.png" />{' '}
                {cardDetails?.stats?.powers ?? '-'}
              </div>
            </div>

            <div className="new-modal-price-buy">
              {!isCardPurchased && (
                <>
                  <div className="price-display">
                    <CachedImage
                      src="/new/coins.png"
                      alt="Coins"
                      style={{ width: 20, height: 20, marginRight: 5 }}
                    />{' '}
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default Modal
