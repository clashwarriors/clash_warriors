import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { realtimeDB } from '../firebase';
import { ref, get } from 'firebase/database';
import './style/collector.css';
import Modal from './Modal';

const CollectorPage = ({ user }) => {
  const location = useLocation();
  const { category, collection: collectionName } = location.state || {};

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coins, setCoins] = useState(0);
  const [selectedCard, setSelectedCard] = useState(null);

  const userId = user.userId;

  useEffect(() => {
    const fetchCards = async () => {
      if (category && collectionName) {
        try {
          const cardCollectionPath = `${category}/${collectionName}`;
          const cardsRef = ref(realtimeDB, cardCollectionPath);
          const snapshot = await get(cardsRef);

          if (snapshot.exists()) {
            const fetchedCards = Object.entries(snapshot.val()).map(
              ([id, data]) => ({
                ...data,
                id: id,
                collection: collectionName,
                category: category,
              })
            );
            setCards(fetchedCards);
          }
        } catch (error) {
          console.error('Error fetching cards:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchCards();
  }, [category, collectionName]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userRef = ref(realtimeDB, `users/${userId}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setCoins(data.coins);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [userId]);

  const formatNumber = (num) => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toString();
  };

  const handleCardClick = useCallback((card) => {
    setSelectedCard(card);
  }, []);

  const cardList = useMemo(() => (
    cards.length > 0 ? (
      <ul className="collector-container">
        {cards.map((card) => (
          <li
            key={card.id}
            className="collector-nft-card"
            onClick={() => handleCardClick(card)}
          >
            <img src={card.image} alt={card.name} />
          </li>
        ))}
      </ul>
    ) : (
      <p>No cards available</p>
    )
  ), [cards, handleCardClick]);

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="collector-container">
      <header className="collection-header">
        <div className="collection-header-left">
          Unleash your <br />
          <span className="highlighted-text">Superheroes NFT</span>
        </div>
        <div className="collection-header-right">
          <img
            src="/assets/crypto-coin.png"
            alt="Crypto Coin"
            className="crypto-icon"
          />
          <span className="total-crypto">{formatNumber(coins)}</span>
        </div>
      </header>

      {cardList}

      {selectedCard && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCard(null)}
          user={user}
          card={selectedCard}
          cardId={selectedCard.id}
          category={selectedCard.category}
          collection={selectedCard.collection}
        />
      )}
    </div>
  );
};

export default CollectorPage;
