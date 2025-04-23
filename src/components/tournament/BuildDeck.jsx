import React, { useState, useEffect, useMemo, useRef } from 'react'
import { getDatabase, ref, get, update } from 'firebase/database'
import './style/builddeck.style.css'
import frostGuard from './assets/frostguard.png'
import starivya from './assets/starviya.png'
import stormscaller from './assets/stormscaller.png'
import xalgrith from './assets/xalgrith.png'
import steeltitan from './assets/steeltitan.png'
import {
  triggerHapticFeedback,
  dropHapticFeedback,
} from '../tournament/utils/haptic'

const BuildDeck = ({ user }) => {
  const [defaultCards, setDefaultCards] = useState([])
  const [userCards, setUserCards] = useState([])
  const [selectedCharacter, setSelectedCharacter] = useState('Select Character')
  const [isOpen, setIsOpen] = useState(false)
  const selectorRef = useRef(null)

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

  const fetchCards = async () => {
    if (!user) return
    const db = getDatabase()
    const cardsRef = ref(db, `users/${user.userId}/cards`)
    const snapshot = await get(cardsRef)
    if (snapshot.exists()) {
      const cardsData = snapshot.val()
      const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '')
      const defaultDeckCards = []
      const availableCards = []

      Object.entries(cardsData).forEach(([id, card]) => {
        const cardWithStats = {
          id,
          ...card,
          totalStats: Object.values(card.stats || {}).reduce(
            (a, b) => a + b,
            0
          ),
        }

        if (card.defaultDeck) {
          defaultDeckCards.push(cardWithStats)
        } else if (
          selectedCharacter === 'Select Character' ||
          normalize(card.name).includes(normalize(selectedCharacter))
        ) {
          availableCards.push(cardWithStats)
        }
      })

      setDefaultCards(defaultDeckCards)
      setUserCards(availableCards)
    } else {
      setDefaultCards([])
      setUserCards([])
    }
  }

  useEffect(() => {
    fetchCards()
  }, [user, selectedCharacter])

  const updateTotalSynergy = async (updatedCards) => {
    const newTotalSynergy = updatedCards.reduce((sum, card) => {
      return (
        sum +
        (card.stats ? Object.values(card.stats).reduce((a, b) => a + b, 0) : 0)
      )
    }, 0)

    const db = getDatabase()
    await update(ref(db, `users/${user.userId}`), {
      totalSynergy: newTotalSynergy,
    })
  }

  const handleCardSelect = async (card) => {
    if (defaultCards.length >= 10) {
      alert('You can only have 10 cards in your deck.')
      return
    }

    const db = getDatabase()
    await update(ref(db, `users/${user.userId}/cards/${card.id}`), {
      defaultDeck: true,
    })

    triggerHapticFeedback()
    await fetchCards()
  }

  const handleRemoveCard = async (card, index) => {
    const db = getDatabase()
    await update(ref(db, `users/${user.userId}/cards/${card.id}`), {
      defaultDeck: false,
    })

    dropHapticFeedback()
    await fetchCards()
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="defaultDeck-container">
      <div className="selector-header">
        <button className="selector-toggle" onClick={() => setIsOpen(!isOpen)}>
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
            {userCards.map((card) => (
              <div
                key={card.id}
                className="defaultDeck-card"
                onClick={() => handleCardSelect(card)}
              >
                <img
                  src={card.photo}
                  alt={card.name}
                  className="defaultDeck-image"
                />
                <span className="defaultDeck-stats">{card.totalStats}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="defaultDeck-noCards">Select your Category</p>
        )}
      </div>
      <div className="defaultDeck-bottom">
        <div className="defaultDeck-grid">
          {[...defaultCards, ...Array(10 - defaultCards.length).fill(null)].map(
            (card, index) =>
              card ? (
                <div key={card.id} className="defaultDeck-card">
                  <img
                    src={card.photo}
                    alt={card.name}
                    className="defaultDeck-image"
                  />
                  <span className="defaultDeck-stats">{card.totalStats}</span>
                  <button
                    onClick={() => handleRemoveCard(card, index)}
                    className="defaultDeck-remove-card-btn"
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
    </div>
  )
}

export default BuildDeck
