import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  storeCards,
  getCards,
  storeUserData,
  getUserData,
} from '../../utils/indexedDBService' // Adjusted import for IndexedDB service
import frostGuard from './assets/frostguard.png'
import starivya from './assets/starviya.png'
import stormscaller from './assets/stormscaller.png'
import xalgrith from './assets/xalgrith.png'
import steeltitan from './assets/steeltitan.png'
import {
  triggerHapticFeedback,
  dropHapticFeedback,
} from '../tournament/utils/haptic'
import './style/builddeck.style.css'

const BuildDeck = ({ user }) => {
  const [defaultCards, setDefaultCards] = useState([])
  const [userCards, setUserCards] = useState([])
  const [selectedCharacter, setSelectedCharacter] = useState('Select Character')
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false) // ⬅️ New!
  const [showWarning, setShowWarning] = useState(true)
  const selectorRef = useRef(null)
  const navigate = useNavigate() // React Router's navigate hook

  const characters = useMemo(
    () => [
      { name: 'Frostguard', image: frostGuard },
      { name: 'Starivya', image: starivya },
      { name: 'Stormscaller', image: stormscaller },
      { name: 'Xalgrith the Void', image: xalgrith },
      { name: 'Steel Titan', image: steeltitan },
    ],
    []
  )

  const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '')

  // Fetch cards from IndexedDB
  const fetchCards = useCallback(async () => {
    if (!user?.userId) return

    try {
      const cardsData = await getCards() // Fetch all cards from IndexedDB
      const tempDefault = []
      const tempAvailable = []

      cardsData.forEach((card) => {
        const totalStats = Object.values(card.stats || {}).reduce(
          (a, b) => a + b,
          0
        )
        const cardWithStats = { ...card, totalStats }

        if (card.defaultDeck) {
          tempDefault.push(cardWithStats)
        } else if (
          selectedCharacter === 'Select Character' ||
          normalize(card.name).includes(normalize(selectedCharacter))
        ) {
          tempAvailable.push(cardWithStats)
        }
      })

      setDefaultCards(tempDefault.slice(0, 10)) // Limit 10
      setUserCards(tempAvailable)
    } catch (error) {
      console.error('Error fetching cards:', error)
    }
  }, [user?.userId, selectedCharacter])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  const handleCardSelect = async (card) => {
    if (!user?.userId || isProcessing) return
    if (defaultCards.length >= 10) {
      alert('You can only have 10 cards.')
      return
    }

    setIsProcessing(true)
    try {
      triggerHapticFeedback()

      // 1. Update card defaultDeck to true in IndexedDB
      card.defaultDeck = true
      await storeCards([card]) // Update the card in IndexedDB

      // 2. Fetch user data and current synergy
      const userData = await getUserData()
      const currentSynergy = userData?.totalSynergy || 0

      // 3. Update synergy in IndexedDB
      const newSynergy = currentSynergy + (card.totalStats || 0)
      const updatedUserData = { ...userData, totalSynergy: newSynergy }
      await storeUserData(updatedUserData)

      await fetchCards() // Refresh cards
    } catch (error) {
      console.error('Error selecting card:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRemoveCard = async (card) => {
    if (!user?.userId || isProcessing) return

    setIsProcessing(true)
    try {
      dropHapticFeedback()

      // 1. Update card defaultDeck to false in IndexedDB
      card.defaultDeck = false
      await storeCards([card]) // Update the card in IndexedDB

      // 2. Fetch user data and current synergy
      const userData = await getUserData()
      const currentSynergy = userData?.totalSynergy || 0

      // 3. Update synergy in IndexedDB (subtract card's stats)
      const newSynergy = Math.max(0, currentSynergy - (card.totalStats || 0)) // avoid negative
      const updatedUserData = { ...userData, totalSynergy: newSynergy }
      await storeUserData(updatedUserData)

      await fetchCards() // Refresh cards
    } catch (error) {
      console.error('Error removing card:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Detect navigation (leave page)

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      // Custom logic when the user leaves the page
      console.log('User is leaving the page!')
      // Optionally, trigger a save or cleanup here
      // event.returnValue = 'Are you sure you want to leave?'; // Uncomment for confirmation
    }

    // Attach the beforeunload event listener
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Cleanup when the component is unmounted or when the event listener is no longer needed
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      console.log('Component unmounted or user navigated away.')
    }
  }, [])

  return (
    <div className="defaultDeck-container">
      {/* Character Selector */}
      <div className="selector-header">
        <button
          className="selector-toggle"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <img src="/right.png" alt="Toggle" className="selector-toggle-icon" />
        </button>

        {isOpen && (
          <div className="selector-container" ref={selectorRef}>
            {characters.map((char) => (
              <div
                key={char.name}
                className="selector-character"
                onClick={() => setSelectedCharacter(char.name)}
              >
                <img
                  src={char.image}
                  alt={char.name}
                  className="selector-icon"
                  loading="lazy"
                />
                <span className="selector-name">{char.name}</span>
              </div>
            ))}
          </div>
        )}

        <span className="selector-selected-name">{selectedCharacter}</span>
      </div>

      <div className="defaultDeck-allCards">
        {userCards.length > 0 ? (
          <div className="defaultDeck-grid">
            {userCards.map((card, index) => (
              <div
                key={card.id || `card-${index}`} // Use card.id or fallback to index
                className="defaultDeck-card"
                onClick={() => handleCardSelect(card)}
              >
                <img
                  src={card.photo}
                  alt={card.name}
                  className="defaultDeck-image"
                  loading="lazy"
                />
                <span className="defaultDeck-stats">{card.totalStats}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="defaultDeck-noCards">Select your Category</p>
        )}
      </div>

      {/* Default Deck Cards */}
      <div className="defaultDeck-bottom">
        <div className="defaultDeck-grid">
          {[...defaultCards, ...Array(10 - defaultCards.length).fill(null)].map(
            (card, index) =>
              card ? (
                <div
                  key={card.id || `card-${index}`}
                  className="defaultDeck-card"
                >
                  <img
                    src={card.photo}
                    alt={card.name}
                    className="defaultDeck-image"
                    loading="lazy"
                  />
                  <span className="defaultDeck-stats">{card.totalStats}</span>
                  <button
                    className="defaultDeck-remove-card-btn"
                    onClick={() => handleRemoveCard(card)}
                    disabled={isProcessing}
                  >
                    X
                  </button>
                </div>
              ) : (
                <div
                  key={`placeholder-${index}`} // Use index for the placeholder key
                  className="defaultDeck-placeholder"
                >
                  <span>Empty Slot</span>
                </div>
              )
          )}
        </div>
      </div>

      {defaultCards.length + userCards.length < 10 && (
        <div className="builddeck-overlay">
          <div className="deck-warning-modal">
            <p>You need at least 10 cards to complete your deck.</p>
            <div className="deck-warning-actions">
              <button
                className="buy-cards-btn"
                onClick={() => navigate('/Collections')}
              >
                Buy Cards
              </button>
              <button
                className="cancel-btn"
                onClick={() => navigate(-1)} // 👈 go back
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(BuildDeck)
