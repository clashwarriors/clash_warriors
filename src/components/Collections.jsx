import React, { useEffect, useState, useRef, useMemo } from 'react'
import './style/collection.css'
import { ref, get, onValue } from 'firebase/database'
import { realtimeDB } from '../firebase'
import SlideShow from './SlideShow'
import Modal from './Modal'
import { useNavigate } from 'react-router-dom'
import { triggerHapticFeedback } from './tournament/utils/haptic'

const Collections = ({ user }) => {
  const [cardsData, setCardsData] = useState({})
  const [selectedCategory, setSelectedCategory] = useState('common')
  const [selectedCollection, setSelectedCollection] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [coins, setCoins] = useState(0)
  const searchResultsRef = useRef(null)
  const searchInputRef = useRef(null)
  const filterDropdownRef = useRef(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCards, setFilteredCards] = useState([])
  const userId = user.userId
  const [selectedCard, setSelectedCard] = useState(null)
  const navigate = useNavigate()
  const [cachedCards, setCachedCards] = useState({})

  useEffect(() => {
    const userRef = ref(realtimeDB, `users/${userId}`)

    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        setCoins(data.coins)
      } else {
        console.log('No user found in Realtime Database')
      }
    })

    // Cleanup listener when the component unmounts
    return () => unsubscribe()
  }, [userId]) // No need to include `userId` here, since it doesn't change

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target)
      ) {
        setShowFilters(false)
      }

      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target)
      ) {
        setFilteredCards([])
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const collectionOptions = useMemo(
    () => ({
      common: ['Xalgrith', 'Stormscaller', 'Starivya', 'Frostguard'],
      uncommon: ['Xalgrith', 'Stormscaller', 'Starivya', 'Frostguard'],
      rare: ['Xalgrith', 'Stormscaller', 'Starivya', 'Frostguard'],
      mythical: ['Xalgrith', 'Stormscaller', 'Starivya', 'Frostguard'],
      legendary: ['Xalgrith', 'Stormscaller', 'Starivya', 'Frostguard'],
    }),
    []
  )

  const formatNumber = (num) => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
    return num.toString()
  }

  useEffect(() => {
    if (cachedCards[selectedCategory]) {
      // Use cached data if available
      setCardsData(cachedCards[selectedCategory])
      return
    }

    const fetchCards = async () => {
      try {
        const categoryRef = ref(realtimeDB, selectedCategory)
        const snapshot = await get(categoryRef)
        if (snapshot.exists()) {
          const categoryData = snapshot.val()
          setCardsData(categoryData)
          setCachedCards((prev) => ({
            ...prev,
            [selectedCategory]: categoryData,
          }))
        } else {
          console.log(`No collections found under '${selectedCategory}'.`)
        }
      } catch (error) {
        console.error('Error fetching cards:', error)
        alert('Failed to fetch cards. Please try again.')
      }
    }

    if (selectedCategory) {
      fetchCards()
    }
  }, [selectedCategory, cachedCards]) // Only fetch if category is not cached

  const fetchSearchedCards = async (term) => {
    try {
      console.log('Searching cards for term:', term)

      const allFilteredCards = []

      for (let category of Object.keys(collectionOptions)) {
        for (let collectionName of collectionOptions[category]) {
          const cardCollectionPath = `categories/${category}/${collectionName}/cards`
          const snapshot = await get(ref(realtimeDB, cardCollectionPath))
          if (snapshot.exists()) {
            const cardsList = snapshot.val()
            const matchingCards = Object.values(cardsList).filter(
              (card) =>
                card.tags &&
                card.tags.some((tag) => tag.toLowerCase().includes(term))
            )
            if (matchingCards.length > 0) {
              allFilteredCards.push({
                category,
                collectionName,
                cards: matchingCards,
              })
            }
          }
        }
      }

      console.log('Filtered cards with categories:', allFilteredCards)
      setFilteredCards(allFilteredCards)
    } catch (error) {
      console.error('Error searching cards:', error)
      alert('Failed to search cards. Please try again.')
    }
  }

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase()
    setSearchTerm(term)
    console.log('Search term:', term)

    if (!term) {
      setFilteredCards([])
      return
    }

    fetchSearchedCards(term)
  }

  const handleSelectedCardClick = (category, collectionName, card) => {
    triggerHapticFeedback()
    console.log('Category:', category)
    console.log('Collection:', collectionName)
    console.log('Card clicked:', card)

    setSelectedCard({
      ...card,
      category,
      collection: collectionName,
      cardId: card.cardId,
    })
  }

  const handleExploreClick = (category, collection) => {
    triggerHapticFeedback()
    navigate('/collector', { state: { category, collection } })
  }

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
            onClick={() => setShowFilters(!showFilters)}
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
                        setSelectedCategory(category)
                        setSelectedCollection('')
                        console.log('Category selected:', category)
                      }}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </li>
                  ))}
                </ul>
              </div>

              {/* {selectedCategory && (
                <div className="dropdown">
                  <div className="category-selector">
                    {selectedCollection || 'Select Collection'}
                  </div>
                  <ul className="dropdown-list">
                    {collectionOptions[selectedCategory].map((collection) => (
                      <li
                        key={collection}
                        onClick={() => {
                          setSelectedCollection(collection)
                          console.log('Collection selected:', collection)
                        }}
                      >
                        {collection}
                      </li>
                    ))}
                  </ul>
                </div>
              )} */}
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

      <div>
        {Object.entries(cardsData).map(([collectionName, collectionData]) => {
          if (!selectedCollection || selectedCollection === collectionName) {
            return (
              <div key={collectionName} className="collection-section">
                <div className="group-title">{`${collectionName}`}</div>

                <div className="slideshow-wrapper">
                  <SlideShow
                    collections={Object.entries(collectionData).map(
                      ([cardId, card]) => ({
                        ...card,
                        cardId,
                      })
                    )}
                    totalSteps={Object.keys(collectionData).length}
                    onCardClick={(card) =>
                      handleSelectedCardClick(
                        selectedCategory,
                        collectionName,
                        card
                      )
                    }
                  />
                  <button
                    className="explore-btn"
                    onClick={() =>
                      handleExploreClick(selectedCategory, collectionName)
                    }
                  >
                    Explore {collectionName}
                  </button>
                </div>
              </div>
            )
          }
          return null
        })}
      </div>

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
  )
}

export default Collections
