import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import './style/collection.css';
import { ref, get, onValue } from 'firebase/database';
import { realtimeDB } from '../firebase';
import SlideShow from './SlideShow';
import Modal from './Modal';
import { useNavigate } from 'react-router-dom';
import { triggerHapticFeedback } from './tournament/utils/haptic';

const Collections = ({ user }) => {
  const [cardsData, setCardsData] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('common');
  const [selectedCollection, setSelectedCollection] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [coins, setCoins] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCards, setFilteredCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cachedCards, setCachedCards] = useState({});

  const searchResultsRef = useRef(null);
  const searchInputRef = useRef(null);
  const filterDropdownRef = useRef(null);
  const navigate = useNavigate();
  const userId = user.userId;

  useEffect(() => {
    const userRef = ref(realtimeDB, `users/${userId}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCoins(data.coins);
      }
    });
    return () => unsubscribe();
  }, [userId]);

  const collectionOptions = useMemo(() => ({
    common: ['Xalgrith', 'Stormscaller', 'Starivya', 'Frostguard'],
    uncommon: ['Xalgrith', 'Stormscaller', 'Starivya', 'Frostguard'],
    rare: ['Xalgrith', 'Stormscaller', 'Starivya', 'Frostguard'],
    mythical: ['Xalgrith', 'Stormscaller', 'Starivya', 'Frostguard'],
    legendary: ['Xalgrith', 'Stormscaller', 'Starivya', 'Frostguard'],
  }), []);

  const formatNumber = (num) => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toString();
  };

  useEffect(() => {
    if (cachedCards[selectedCategory]) {
      setCardsData(cachedCards[selectedCategory]);
      return;
    }

    const fetchCards = async () => {
      try {
        const categoryRef = ref(realtimeDB, selectedCategory);
        const snapshot = await get(categoryRef);
        if (snapshot.exists()) {
          const categoryData = snapshot.val();
          setCardsData(categoryData);
          setCachedCards(prev => ({
            ...prev,
            [selectedCategory]: categoryData,
          }));
        }
      } catch (error) {
        console.error('Error fetching cards:', error);
      }
    };

    if (selectedCategory) {
      fetchCards();
    }
  }, [selectedCategory, cachedCards]);

  const fetchSearchedCards = useCallback(async (term) => {
    try {
      const allFilteredCards = [];

      for (let category of Object.keys(collectionOptions)) {
        for (let collectionName of collectionOptions[category]) {
          const cardCollectionPath = `categories/${category}/${collectionName}/cards`;
          const snapshot = await get(ref(realtimeDB, cardCollectionPath));
          if (snapshot.exists()) {
            const cardsList = snapshot.val();
            const matchingCards = Object.values(cardsList).filter(card =>
              card.tags?.some(tag => tag.toLowerCase().includes(term))
            );
            if (matchingCards.length > 0) {
              allFilteredCards.push({
                category,
                collectionName,
                cards: matchingCards,
              });
            }
          }
        }
      }

      setFilteredCards(allFilteredCards);
    } catch (error) {
      console.error('Error searching cards:', error);
    }
  }, [collectionOptions]);

  const handleSearch = useCallback((e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    if (!term) {
      setFilteredCards([]);
      return;
    }

    fetchSearchedCards(term);
  }, [fetchSearchedCards]);

  const handleSelectedCardClick = useCallback((category, collectionName, card) => {
    triggerHapticFeedback();
    setSelectedCard({
      ...card,
      category,
      collection: collectionName,
      cardId: card.cardId,
    });
  }, []);

  const handleExploreClick = useCallback((category, collection) => {
    triggerHapticFeedback();
    navigate('/collector', { state: { category, collection } });
  }, [navigate]);

  const cardsSections = useMemo(() => {
    return Object.entries(cardsData).map(([collectionName, collectionData]) => {
      if (!selectedCollection || selectedCollection === collectionName) {
        const cardsArray = Object.entries(collectionData).map(([cardId, card]) => ({
          ...card,
          cardId,
        }));

        return (
          <div key={collectionName} className="collection-section">
            <div className="group-title">{collectionName}</div>

            <div className="slideshow-wrapper">
              <SlideShow
                collections={cardsArray}
                totalSteps={cardsArray.length}
                onCardClick={(card) =>
                  handleSelectedCardClick(selectedCategory, collectionName, card)
                }
              />
              <button
                className="explore-btn"
                onClick={() => handleExploreClick(selectedCategory, collectionName)}
              >
                Explore {collectionName}
              </button>
            </div>
          </div>
        );
      }
      return null;
    });
  }, [cardsData, selectedCollection, handleExploreClick, handleSelectedCardClick, selectedCategory]);

  return (
    <div className="collections-container">
      <header className="collection-header">
        <div className="collection-header-left">
          Unleash your <br />
          <span className="highlighted-text">Superheroes NFT</span>
        </div>
        <div className="collection-header-right">
          <img
            src="./assets/crypto-coin.png"
            alt="Crypto Coin"
            className="crypto-icon"
          />
          <span className="total-crypto">{formatNumber(coins)}</span>
        </div>
      </header>

      <div className="collection-filter-search">
        <div className="filter-container" ref={filterDropdownRef}>
          <img
            src="/assets/filterIcon.png"
            alt="Filter Icon"
            className="filter-icon"
            onClick={() => setShowFilters(prev => !prev)}
          />

          {showFilters && (
            <div className="filter-options">
              <div className="dropdown">
                <div className="category-selector">
                  {selectedCategory || 'Select Category'}
                </div>
                <ul className="dropdown-list">
                  {Object.keys(collectionOptions).map((category, index) => (
                    <li
                      key={category}
                      style={{ '--delay': `${index * 0.1}s` }}
                      onClick={() => {
                        setSelectedCategory(category);
                        setSelectedCollection('');
                      }}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="collection-search-container">
          <button
            onClick={() => {
              navigate('/premium')
              triggerHapticFeedback()
            }}
            style={{
              background: 'linear-gradient(135deg, #f5b942, #f0a500)',
              color: '#fff',
              fontWeight: 'bold',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              marginRight: '10px',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)'
            }}
          >
            Premium
          </button>
        </div>
      </div>

      <div>{cardsSections}</div>

      {selectedCard && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCard(null)}
          user={user}
          card={selectedCard}
          cardId={selectedCard.cardId}
          category={selectedCard.category}
          collection={selectedCard.collection}
        />
      )}
    </div>
  );
};

export default Collections;
