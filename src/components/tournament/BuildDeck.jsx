import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  storeCards,
  getCards,
  storeUserData,
  getUserData,
  storeUserDeck,
  getUserDeck,
  clearUserDecks,
} from '../../utils/indexedDBService'
import frostGuard from './assets/frostguard.png'
import starivya from './assets/starviya.png'
import stormscaller from './assets/stormscaller.png'
import xalgrith from './assets/xalgrith.png'
import steeltitan from './assets/steeltitan.png'
import './style/builddeck.style.css'
import CachedImage from '../Shared/CachedImage'

const BuildDeck = ({ user }) => {
  const [defaultCards, setDefaultCards] = useState([])
  const [userCards, setUserCards] = useState([])
  const [selectedCharacter, setSelectedCharacter] = useState('Select Character')
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showWarning, setShowWarning] = useState(true)
  const [tutorialStep, setTutorialStep] = useState(0)
  const selectorRef = useRef(null)
  const navigate = useNavigate()

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

  // Fetch cards
  const fetchCardsAndDeck = useCallback(async () => {
    if (!user?.userId) return

    try {
      // Fetch all cards and the user's deck in parallel
      const [cardsData, deckData] = await Promise.all([
        getCards(), // all cards in the DB
        getUserDeck('default'), // user's saved deck
      ])

      const allCards = cardsData.map((card) => {
        const totalStats = Object.values(card.stats || {}).reduce(
          (a, b) => a + b,
          0
        )
        return { ...card, totalStats }
      })

      // Split into cards that are in deck and available cards
      const deckCards = allCards.filter((c) =>
        deckData.cards.includes(c.cardId)
      )
      const availableCards = allCards.filter(
        (c) => !deckData.cards.includes(c.cardId)
      )

      setDefaultCards(deckCards)
      setUserCards(availableCards)
    } catch (err) {
      console.error('❌ Error fetching cards and deck:', err)
    }
  }, [user?.userId])

  useEffect(() => {
    fetchCardsAndDeck()
  }, [fetchCardsAndDeck])

  // -------------------------------
  // Add card to user's default deck
  // -------------------------------
  const handleCardSelect = async (card) => {
    if (!user?.userId || isProcessing) return
    setIsProcessing(true)

    try {
      // Get current deck
      const deck = await getUserDeck('default')

      // Already in deck?
      if (deck.cards.includes(card.cardId)) {
        alert('Card is already in default deck')
        return
      }

      // Limit max 10 cards
      if (deck.cards.length >= 10) {
        alert('You can only have 10 cards in default deck.')
        return
      }

      // Update deck
      const newDeck = {
        ...deck,
        cards: [...deck.cards, card.cardId],
        totalSynergy: (deck.totalSynergy || 0) + (card.totalStats || 0),
      }

      await storeUserDeck(newDeck)
      await fetchCardsAndDeck() // refresh state
    } catch (err) {
      console.error('❌ Error adding card to deck:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  // -------------------------------
  // Remove card from user's default deck
  // -------------------------------
  const handleRemoveCard = async (card) => {
    if (!user?.userId || isProcessing) return
    setIsProcessing(true)

    try {
      const deck = await getUserDeck('default')

      // Remove card from deck
      const newDeck = {
        ...deck,
        cards: deck.cards.filter((id) => id !== card.cardId),
        totalSynergy: Math.max(
          0,
          (deck.totalSynergy || 0) - (card.totalStats || 0)
        ),
      }

      await storeUserDeck(newDeck)
      await fetchCardsAndDeck() // refresh state
    } catch (err) {
      console.error('❌ Error removing card from deck:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCardSelectTutorial = async (card, index) => {
    try {
      await handleCardSelect(card)

      if (tutorialStep === 4) {
        setTutorialStep(0) // Hide overlay

        try {
          localStorage.setItem('builddeck-tut', 'true') // Mark tutorial done
        } catch (err) {
          console.warn('⚠️ localStorage blocked or unavailable:', err)
        }

        console.log('✅ Tutorial completed!')
      }
    } catch (err) {
      console.error('❌ Error in handleCardSelectTutorial:', err)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target))
        setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      console.log('User is leaving the page!')
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    // Check if tutorial has been completed
    const tutDone = localStorage.getItem('builddeck-tut')
    if (!tutDone) {
      setTutorialStep(1) // start tutorial
    } else {
      setTutorialStep(0) // skip tutorial
    }
  }, [])

  // Tutorial overlay component
  const TutorialOverlay = ({ message, onNext }) => (
    <div className="tutorial-overlay">
      <div className="tutorial-box">
        <p className="tutorial-message">{message}</p>
        <div className="tutorial-next-wrapper" onClick={onNext}>
          <CachedImage
            src="/new/tournament/tournamentBtnTemp.png"
            alt="Next"
            className="tutorial-next-img"
          />
          <span className="tutorial-next-text">Next</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="defaultDeck-container">
      {/* Character Selector */}
      <div className="selector-header">
        <button
          className="selector-toggle"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <CachedImage
            src="/right.png"
            alt="Toggle"
            className="selector-toggle-icon"
          />
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

      {/* User Cards Section */}
      <div
        className={`defaultDeck-allCards ${
          tutorialStep === 1 ? 'tutorial-highlight' : ''
        }`}
      >
        {userCards.length > 0 ? (
          <div
            className={`defaultDeck-grid ${
              tutorialStep === 2 ? 'tutorial-step2' : ''
            } ${tutorialStep === 3 ? 'tutorial-step3' : ''} ${
              tutorialStep === 4 ? 'tutorial-step4' : ''
            }`}
          >
            {userCards.map((card, index) => (
              <div
                key={card.id || `card-${index}`}
                className={`defaultDeck-card ${
                  tutorialStep === 2 || tutorialStep === 3 || tutorialStep === 4
                    ? index === 0
                      ? 'tutorial-single-card-step2'
                      : 'tutorial-dim-card'
                    : ''
                }`}
                onClick={() => {
                  if (tutorialStep === 4 && index === 0) {
                    handleCardSelectTutorial(card, index)
                  } else if (tutorialStep === 0) {
                    handleCardSelect(card)
                  }
                }}
              >
                <img
                  src={card.photo || card.image}
                  alt={card.name}
                  className="defaultDeck-image"
                  loading="lazy"
                />
                <span
                  className={`defaultDeck-stats ${
                    tutorialStep === 3 && index === 0
                      ? 'tutorial-card-stats'
                      : ''
                  }`}
                >
                  {card.totalStats}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="defaultDeck-noCards">Select your Category</p>
        )}
      </div>

      {/* Tutorial Overlay */}
      {tutorialStep > 0 && tutorialStep < 4 && (
        <TutorialOverlay
          message={
            tutorialStep === 1
              ? 'Commander, here stands your Army of Warriors! Each brave fighter is ready to march into battle.'
              : tutorialStep === 2
                ? 'Focus on this warrior, noble leader. Its strength and skills will turn the tide of war.'
                : tutorialStep === 3
                  ? 'These are the warrior’s battle stats. Know their power, for it will guide your strategy.'
                  : 'Select this warrior to enlist it into your Army of Warriors and prepare for glorious conquest!'
          }
          onNext={() => {
            if (tutorialStep < 4) setTutorialStep((prev) => prev + 1)
          }}
        />
      )}

      {/* Default Deck */}
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
                    src={card.photo || card.image}
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
                  key={`placeholder-${index}`}
                  className="defaultDeck-placeholder"
                >
                  <span>Empty Slot</span>
                </div>
              )
          )}
        </div>
      </div>

      {/* Warning Overlay */}
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
              <button className="cancel-btn" onClick={() => navigate(-1)}>
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
