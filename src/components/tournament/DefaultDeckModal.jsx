import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDatabase, ref, get } from 'firebase/database';
import './style/defaultDeckModal.style.css';

const DefaultDeckModal = ({ isOpen, onClose, user }) => {
  const [defaultDeck, setDefaultDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalSynergy, setTotalSynergy] = useState(0);
  const navigate = useNavigate();
  const modalContentRef = useRef(null); // Only content, not overlay

  const fetchDeckData = useCallback(async () => {
    if (!user?.userId) return;

    setLoading(true);
    setError(null);

    try {
      const db = getDatabase();
      const [synergySnap, cardsSnap] = await Promise.all([
        get(ref(db, `users/${user.userId}/totalSynergy`)),
        get(ref(db, `users/${user.userId}/cards`)),
      ]);

      setTotalSynergy(synergySnap.exists() ? synergySnap.val() : 0);

      if (cardsSnap.exists()) {
        const cardsData = cardsSnap.val();
        const deck = Object.entries(cardsData)
          .filter(([, cardInfo]) => cardInfo.defaultDeck)
          .map(([id, cardInfo]) => ({
            id,
            ...cardInfo,
          }));

        setDefaultDeck(deck.slice(0, 10)); // Always 10 max
      } else {
        setDefaultDeck([]);
      }
    } catch (err) {
      console.error('Error loading deck:', err);
      setError('Failed to load default deck.');
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    if (isOpen) {
      fetchDeckData();
    }
  }, [isOpen, fetchDeckData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalContentRef.current && !modalContentRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="default-deck-modal-overlay">
      <div
        className="default-deck-modal-content"
        ref={modalContentRef}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <p>Loading deck...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <>
            <div className="default-deck-modal-grid">
              {Array.from({ length: 10 }, (_, index) => {
                const card = defaultDeck[index];
                return (
                  <div key={index} className="default-deck-modal-card">
                    {card ? (
                      <img
                        src={card.photo}
                        alt={card.name}
                        className="default-deck-modal-card-image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="default-deck-modal-placeholder">
                        Add Card
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer with Total Synergy */}
            <div className="default-deck-modal-footer">
              <button
                className="go-to-builddeck-button"
                onClick={() => navigate('/builddeck')}
              >
                Build Deck (Synergy: {totalSynergy})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(DefaultDeckModal);
