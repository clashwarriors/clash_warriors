import React, { useEffect, useState, useMemo } from 'react';
import { ref, get } from 'firebase/database';
import { realtimeDB } from '../firebase';
import './style/collector.css';

const MyCollection = ({ user }) => {
  const [cards, setCards] = useState([]);
  const [coins, setCoins] = useState(0);
  const [loading, setLoading] = useState(true);

  const userId = user.userId;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cardsSnapshot, userSnapshot] = await Promise.all([
          get(ref(realtimeDB, `users/${userId}/cards`)),
          get(ref(realtimeDB, `users/${userId}`)),
        ]);

        if (cardsSnapshot.exists()) {
          const fetchedCards = Object.entries(cardsSnapshot.val()).map(([id, data]) => ({
            ...data,
            id: id,
          }));
          setCards(fetchedCards);
        }

        if (userSnapshot.exists()) {
          const data = userSnapshot.val();
          setCoins(data.coins ?? 0);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const formatNumber = (num) => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toString();
  };

  const cardsList = useMemo(() => (
    cards.length > 0 ? (
      <ul className="collector-container">
        {cards.map((card) => (
          <li key={card.id} className="collector-nft-card">
            <img src={card.photo} alt={card.name} />
          </li>
        ))}
      </ul>
    ) : (
      <p>No cards available</p>
    )
  ), [cards]);

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
            src="/assets/crypto-coin.avif"
            alt="Crypto Coin"
            className="crypto-icon"
          />
          <span className="total-crypto">{formatNumber(coins)}</span>
        </div>
      </header>

      {cardsList}
    </div>
  );
};

export default MyCollection;
