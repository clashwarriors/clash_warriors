import React, { useState, useEffect, useRef } from 'react'
import './style/modal.css'
import { get, ref, set, update } from 'firebase/database'
import { realtimeDB } from '../firebase'

const Modal = ({ user, isOpen, onClose, cardId, category, collection }) => {
  const [cardDetails, setCardDetails] = useState(null)
  const [isCardPurchased, setIsCardPurchased] = useState(false)
  const [flipped, setFlipped] = useState(false)
  // eslint-disable-next-line no-unused-vars
  const [userCoins, setUserCoins] = useState(0)
  const [, setUser] = useState({})
  const modalContentRef = useRef(null)

  useEffect(() => {
    const fetchCardDetails = async () => {
      if (!cardId || !category || !collection) return

      try {
        const cardRef = ref(realtimeDB, `${category}/${collection}/${cardId}`)
        const cardSnapshot = await get(cardRef)

        if (cardSnapshot.exists()) {
          const cardData = cardSnapshot.val()
          setCardDetails(cardData)
        } else {
          console.log('Card not found')
        }
      } catch (error) {
        console.error('Error fetching card details:', error)
      }
    }

    if (isOpen) {
      fetchCardDetails()
    }
  }, [cardId, category, collection, isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      if (
        modalContentRef.current &&
        !modalContentRef.current.contains(e.target)
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  useEffect(() => {
    const userId = user?.userId

    const checkCardPurchaseStatus = async () => {
      try {
        const cardRef = ref(realtimeDB, `users/${userId}/cards/${cardId}`)
        const snapshot = await get(cardRef)

        if (snapshot.exists()) {
          setIsCardPurchased(true)
        } else {
          setIsCardPurchased(false)
        }
      } catch (error) {
        console.error('Error checking card purchase status:', error)
        setIsCardPurchased(false)
      }
    }

    if (userId && cardId) {
      checkCardPurchaseStatus()
    }
  }, [user, cardId])

  const purchaseCard = async () => {
    if (!user?.userId || !cardDetails) return

    try {
      const userId = user.userId
      const userRef = ref(realtimeDB, `users/${userId}`)
      const userSnapshot = await get(userRef)

      if (!userSnapshot.exists()) {
        console.error('User not found in database.')
        return
      }

      const userData = userSnapshot.val()
      const userCoins = userData.coins || 0
      const userXp = userData.xp || 0
      const userPph = userData.pph || 0

      if (userCoins < cardDetails.price) {
        alert('Not enough coins!')
        return
      }

      const cardData = {
        name: cardDetails.name,
        description: cardDetails.description,
        photo: cardDetails.image,
        stats: cardDetails.stats,
      }

      let xpToAdd = 0
      if (category === 'common') xpToAdd = 15
      else if (category === 'uncommon') xpToAdd = 25
      else if (category === 'rare') xpToAdd = 35
      else if (category === 'mythical') xpToAdd = 50
      else if (category === 'legendary') xpToAdd = 75

      let pphToAdd = 0
      if (category === 'common') pphToAdd = 150
      else if (category === 'uncommon') pphToAdd = 500
      else if (category === 'rare') pphToAdd = 800
      else if (category === 'mythical') pphToAdd = 1000
      else if (category === 'legendary') pphToAdd = 1200

      const userCardRef = ref(realtimeDB, `users/${userId}/cards/${cardId}`)
      await set(userCardRef, cardData)

      const newBalance = userCoins - cardDetails.price
      const newXp = userXp + xpToAdd
      const newPph = userPph + pphToAdd

      await update(userRef, { coins: newBalance, xp: newXp, pph: newPph })

      // ✅ Update UI instantly
      setIsCardPurchased(true)
      setUserCoins(newBalance)
      setUser((prevUser) => ({
        ...prevUser,
        coins: newBalance,
        xp: newXp,
        pph: newPph,
      }))

      console.log(`Card "${cardDetails.name}" purchased successfully!`)
    } catch (error) {
      console.error('Error purchasing card:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal">
      <div className="modal-content" ref={modalContentRef}>
        <span className="close-btn" onClick={onClose}>
          &times;
        </span>

        <div className="modal-body">
          {/* Flip Card Container */}
          <div className="flip-card" onClick={() => setFlipped(!flipped)}>
            <div className={`flip-card-inner ${flipped ? 'flipped' : ''}`}>
              {/* Front of the card */}
              <div className="flip-card-front">
                <img
                  src={cardDetails?.image}
                  alt={cardDetails?.name}
                  className="card-image"
                />
              </div>

              {/* Back of the card */}
              <div className="flip-card-back">
                <div className="card-details">
                  <h2>{cardDetails?.name}</h2>
                  <p>{cardDetails?.description}</p>
                  <div className="card-stats">
                    <p>
                      <strong>Armor:</strong> {cardDetails?.stats?.armor}
                    </p>
                    <p>
                      <strong>Agility:</strong> {cardDetails?.stats?.agility}
                    </p>
                    <p>
                      <strong>Ability:</strong> {cardDetails?.stats?.attack}
                    </p>
                    <p>
                      <strong>Intelligence:</strong>{' '}
                      {cardDetails?.stats?.intelligence}
                    </p>
                    <p>
                      <strong>Vitality:</strong> {cardDetails?.stats?.vitality}
                    </p>
                    <p>
                      <strong>Powers:</strong> {cardDetails?.stats?.powers}
                    </p>
                  </div>
                  <button
                    className="purchase-btn"
                    disabled={isCardPurchased}
                    onClick={purchaseCard}
                  >
                    {isCardPurchased
                      ? 'Card Purchased!'
                      : `Purchase for ${cardDetails?.price} Coins`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Modal
