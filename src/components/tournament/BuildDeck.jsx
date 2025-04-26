import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ref, get, update } from 'firebase/database';
import { realtimeDB } from '../../firebase';
import frostGuard from './assets/frostguard.png';
import starivya from './assets/starviya.png';
import stormscaller from './assets/stormscaller.png';
import xalgrith from './assets/xalgrith.png';
import steeltitan from './assets/steeltitan.png';
import { triggerHapticFeedback, dropHapticFeedback } from '../tournament/utils/haptic';
import './style/builddeck.style.css';

const BuildDeck = ({ user }) => {
  const [defaultCards, setDefaultCards] = useState([]);
  const [userCards, setUserCards] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState('Select Character');
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // ⬅️ New!
  const selectorRef = useRef(null);

  const characters = useMemo(() => [
    { name: 'Frostguard', image: frostGuard },
    { name: 'Starivya', image: starivya },
    { name: 'Stormscaller', image: stormscaller },
    { name: 'Xalgrith the Void', image: xalgrith },
    { name: 'Steel Titan', image: steeltitan },
  ], []);

  const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  const fetchCards = useCallback(async () => {
    if (!user?.userId) return;

    try {
      const cardsRef = ref(realtimeDB, `users/${user.userId}/cards`);
      const snapshot = await get(cardsRef);

      if (snapshot.exists()) {
        const cardsData = snapshot.val();
        const tempDefault = [];
        const tempAvailable = [];

        Object.entries(cardsData).forEach(([id, card]) => {
          const totalStats = Object.values(card.stats || {}).reduce((a, b) => a + b, 0);
          const cardWithStats = { id, ...card, totalStats };

          if (card.defaultDeck) {
            tempDefault.push(cardWithStats);
          } else if (
            selectedCharacter === 'Select Character' ||
            normalize(card.name).includes(normalize(selectedCharacter))
          ) {
            tempAvailable.push(cardWithStats);
          }
        });

        setDefaultCards(tempDefault.slice(0, 10)); // Limit 10
        setUserCards(tempAvailable);
      } else {
        setDefaultCards([]);
        setUserCards([]);
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  }, [user?.userId, selectedCharacter]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleCardSelect = async (card) => {
    if (!user?.userId || isProcessing) return;
    if (defaultCards.length >= 10) {
      alert('You can only have 10 cards.');
      return;
    }
  
    setIsProcessing(true);
    try {
      triggerHapticFeedback();
  
      // Update card defaultDeck true
      await update(ref(realtimeDB, `users/${user.userId}/cards/${card.id}`), {
        defaultDeck: true,
      });
  
      // Fetch current totalSynergy
      const synergyRef = ref(realtimeDB, `users/${user.userId}/totalSynergy`);
      const synergySnap = await get(synergyRef);
      const currentSynergy = synergySnap.exists() ? synergySnap.val() : 0;
  
      // Update synergy by adding this card's totalStats
      const newSynergy = currentSynergy + (card.totalStats || 0);
      await update(ref(realtimeDB, `users/${user.userId}`), {
        totalSynergy: newSynergy,
      });
  
      await fetchCards(); // Refresh
    } catch (error) {
      console.error('Error selecting card:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleRemoveCard = async (card) => {
    if (!user?.userId || isProcessing) return;
  
    setIsProcessing(true);
    try {
      dropHapticFeedback();
  
      // Update card defaultDeck false
      await update(ref(realtimeDB, `users/${user.userId}/cards/${card.id}`), {
        defaultDeck: false,
      });
  
      // Fetch current totalSynergy
      const synergyRef = ref(realtimeDB, `users/${user.userId}/totalSynergy`);
      const synergySnap = await get(synergyRef);
      const currentSynergy = synergySnap.exists() ? synergySnap.val() : 0;
  
      // Update synergy by subtracting this card's totalStats
      const newSynergy = Math.max(0, currentSynergy - (card.totalStats || 0)); // avoid negative
      await update(ref(realtimeDB, `users/${user.userId}`), {
        totalSynergy: newSynergy,
      });
  
      await fetchCards(); // Refresh
    } catch (error) {
      console.error('Error removing card:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="defaultDeck-container">
      {/* Character Selector */}
      <div className="selector-header">
        <button className="selector-toggle" onClick={() => setIsOpen((prev) => !prev)}>
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
                <img src={char.image} alt={char.name} className="selector-icon" loading="lazy" />
                <span className="selector-name">{char.name}</span>
              </div>
            ))}
          </div>
        )}

        <span className="selector-selected-name">{selectedCharacter}</span>
      </div>

      {/* Available Cards */}
      <div className="defaultDeck-allCards">
        {userCards.length > 0 ? (
          <div className="defaultDeck-grid">
            {userCards.map((card) => (
              <div key={card.id} className="defaultDeck-card" onClick={() => handleCardSelect(card)}>
                <img src={card.photo} alt={card.name} className="defaultDeck-image" loading="lazy" />
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
          {[...defaultCards, ...Array(10 - defaultCards.length).fill(null)].map((card, index) =>
            card ? (
              <div key={card.id} className="defaultDeck-card">
                <img src={card.photo} alt={card.name} className="defaultDeck-image" loading="lazy" />
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
              <div key={`placeholder-${index}`} className="defaultDeck-placeholder">
                <span>Empty Slot</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(BuildDeck);
