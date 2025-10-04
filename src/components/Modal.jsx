import React, { useState, useEffect, useRef, useCallback } from 'react'
import './style/modal.css'
import CachedImage from './Shared/CachedImage'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { firestoreDB } from '../firebase'
import {
  storeCards,
  storeUserData,
  getCards,
  getUserData,
} from '../utils/indexedDBService' // Adjust the import based on your actual file
import { updateOnline } from '../utils/syncService'
import { getAllCardsByRarity } from '../utils/cardsStorer'

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

const Modal = React.memo(
  ({ user, isOpen, onClose, cardId, category, collection }) => {
    const [cardDetails, setCardDetails] = useState(null)
    const [isCardPurchased, setIsCardPurchased] = useState(false)
    const modalContentRef = useRef(null)

    // Fetch card details from Firestore
    useEffect(() => {
      if (!isOpen || !cardId) return

      const fetchCard = async () => {
        const localCards = await getCards() // IndexedDB
        const localCard = localCards.find((c) => c.cardId === cardId)

        if (localCard) {
          setCardDetails(localCard)
          setIsCardPurchased(true)
        } else {
          // Fallback: fetch from Firestore only if not in IndexedDB
          try {
            const docRef = doc(
              firestoreDB,
              category,
              collection,
              'cards',
              cardId
            )
            const snapshot = await getDoc(docRef)
            if (snapshot.exists()) {
              setCardDetails(snapshot.data())
            }
          } catch (err) {
            console.error('❌ Error fetching card from Firestore:', err)
          }
        }
      }

      fetchCard()
    }, [isOpen, cardId, category, collection])

    // Click outside modal to close
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (
          modalContentRef.current &&
          !modalContentRef.current.contains(e.target)
        ) {
          onClose()
        }
      }

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        return () =>
          document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isOpen, onClose])

    // Check if card is already purchased from Firestore
    useEffect(() => {
      if (!isOpen || !user?.userId || !cardId) return

      const checkPurchase = async () => {
        try {
          const userCardRef = doc(
            firestoreDB,
            `users/${user.userId}/cards`,
            cardId
          )
          const userCardSnapshot = await getDoc(userCardRef)
          setIsCardPurchased(userCardSnapshot.exists())
        } catch (error) {
          console.error(
            '❌ Error checking purchase status from Firestore:',
            error
          )
        }
      }

      checkPurchase()
    }, [isOpen, user?.userId, cardId])

    useEffect(() => {
      if (!isOpen || !cardId) return

      const checkPurchase = async () => {
        const localCards = await getCards()
        setIsCardPurchased(localCards.some((c) => c.cardId === cardId))
      }

      checkPurchase()
    }, [isOpen, cardId])

    const purchaseCard = useCallback(async () => {
      if (!user?.userId || !cardDetails) return

      try {
        // Fetch user data from IndexedDB
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

        // 1. Store the card in IndexedDB
        await storeCards([cardData])

        // 2. Update user data in IndexedDB (coins, xp, pph)
        const updatedUserData = {
          ...userData,
          coins: currentCoins - price,
          xp: xp + (xpMap[category] || 0),
          pph: pph + (pphMap[category] || 0),
        }
        await storeUserData(updatedUserData)

        setIsCardPurchased(true) // Set state to indicate the card is purchased

        await updateOnline(updatedUserData)

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
                src={
                  cardDetails?.image || cardDetails?.photo || '/fallback.png'
                }
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
                <div className="price-display">
                  <CachedImage
                    src="/new/coins.png"
                    alt="Coins"
                    style={{
                      width: '20px',
                      height: '20px',
                      marginRight: '5px',
                    }}
                  />{' '}
                  {cardDetails?.price ?? 0}
                </div>

                {!isCardPurchased && (
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
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

export default Modal
