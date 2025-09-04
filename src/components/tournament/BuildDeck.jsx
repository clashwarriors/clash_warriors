import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  storeCards,
  getCards,
  storeUserData,
  getUserData,
} from '../../utils/indexedDBService'
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
  const fetchCards = useCallback(async () => {
    if (!user?.userId) return
    try {
      const cardsData = await getCards()
      const tempDefault = []
      const tempAvailable = []

      cardsData.forEach((card) => {
        const totalStats = Object.values(card.stats || {}).reduce(
          (a, b) => a + b,
          0
        )
        const cardWithStats = { ...card, totalStats }

        if (card.defaultDeck) tempDefault.push(cardWithStats)
        else if (
          selectedCharacter === 'Select Character' ||
          normalize(card.name).includes(normalize(selectedCharacter))
        ) {
          tempAvailable.push(cardWithStats)
        }
      })

      setDefaultCards(tempDefault.slice(0, 10))
      setUserCards(tempAvailable)
    } catch (error) {
      console.error('Error fetching cards:', error)
    }
  }, [user?.userId, selectedCharacter])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  // Handle card selection
  const handleCardSelect = async (card) => {
    if (!user?.userId || isProcessing) return
    if (defaultCards.length >= 10) {
      alert('You can only have 10 cards.')
      return
    }

    setIsProcessing(true)
    try {
      triggerHapticFeedback()
      card.defaultDeck = true
      await storeCards([card])

      const userData = await getUserData()
      const currentSynergy = userData?.totalSynergy || 0
      const newSynergy = currentSynergy + (card.totalStats || 0)
      await storeUserData({ ...userData, totalSynergy: newSynergy })

      await fetchCards()
    } catch (error) {
      console.error('Error selecting card:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Tutorial-aware card selection
  const handleCardSelectTutorial = async (card, index) => {
    // 1️⃣ Select the card normally
    await handleCardSelect(card)

    // 2️⃣ Stop the tutorial if step 4
    if (tutorialStep === 4) {
      setTutorialStep(0) // hide the overlay
      localStorage.setItem('builddeck-tut', 'true') // mark tutorial done
      console.log('Tutorial completed!')
    }
  }

  const handleRemoveCard = async (card) => {
    if (!user?.userId || isProcessing) return
    setIsProcessing(true)
    try {
      dropHapticFeedback()
      card.defaultDeck = false
      await storeCards([card])

      const userData = await getUserData()
      const currentSynergy = userData?.totalSynergy || 0
      const newSynergy = Math.max(0, currentSynergy - (card.totalStats || 0))
      await storeUserData({ ...userData, totalSynergy: newSynergy })

      await fetchCards()
    } catch (error) {
      console.error('Error removing card:', error)
    } finally {
      setIsProcessing(false)
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
          <img
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
                  src={card.photo}
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
