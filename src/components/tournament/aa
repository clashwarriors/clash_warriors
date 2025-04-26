import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getDatabase,
  ref,
  get,
  onValue,
  remove,
  update,
} from 'firebase/database'
import './style/battle.style.css'
import { getFrames } from '../tournament/utils/indexedDBHelper'
import {
  triggerHapticFeedback,
  dropHapticFeedback,
} from '../tournament/utils/haptic'
import { playStoredAudio } from '../tournament/utils/audioUtils'
import { showRewardedAd, showAdsgramInterstitial } from './utils/showRewardedAd'

const PlayerInfo = React.memo(({ photoUrl, isLeft }) => {
  const avatarSrc = photoUrl ? photoUrl : '/assets/defultPlayer.svg' // efault image if photoUrl doesn't exist

  return (
    <div
      className={`player-info ${
        isLeft ? 'battle-avatar-left' : 'battle-avatar-right'
      }`}
    >
      <img
        src={avatarSrc}
        alt="Player Avatar"
        className="player-avatar"
        onError={(e) => (e.target.src = '/assets/defultPlayer.svg')} // aFallback if image fails to load
      />
    </div>
  )
})

const Timer = ({ gamePhase, className }) => {
  const [phaseTime, setPhaseTime] = useState(0)

  useEffect(() => {
    let time = 0

    if (gamePhase === 'cooldown') {
      time = 5 // Cooldown should always be 5s
    } else if (gamePhase === 'selection') {
      time = 20 // Selection should always be 20s
    } else if (gamePhase === 'battle') {
      time = 10 // Battle should always be 10s
    }

    setPhaseTime(time)

    const interval = setInterval(() => {
      setPhaseTime((prev) => Math.max(prev - 1, 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [gamePhase])

  return (
    <div>
      <p className={`battle-timer ${className}`}> {phaseTime}s </p>
    </div>
  )
}

const SelectedCardArea = React.memo(({ player, isLeft, gamePhase }) => {
  const [cardPhoto, setCardPhoto] = useState(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [animationStarted, setAnimationStarted] = useState(false)
  const [animationFrame, setAnimationFrame] = useState(0)
  const [preloadedImages, setPreloadedImages] = useState([])

  useEffect(() => {
    const frames = getFrames('dropSeq')
    if (frames.length > 0) {
      setPreloadedImages(frames)
      console.log(`✅ Loaded ${frames.length} DropSeq frames from IndexedDB.`)
    } else {
      console.warn('⚠️ DropSeq frames might still be loading. Retrying...')
      setTimeout(() => {
        const retryFrames = getFrames('dropSeq')
        if (retryFrames.length > 0) {
          setPreloadedImages(retryFrames)
          console.log(
            `🔄 Retried: Loaded ${retryFrames.length} DropSeq frames.`
          )
        } else {
          console.error('❌ DropSeq frames missing in IndexedDB.')
        }
      }, 500)
    }
  }, [])

  useEffect(() => {
    if (!player.selectedCard) {
      setCardPhoto(null)
      setImageLoaded(false)
      setAnimationStarted(false)
      setAnimationFrame(0)
      return
    }

    const db = getDatabase()

    // Check for user card first
    let cardRef = ref(
      db,
      `users/${player.id}/cards/${player.selectedCard}/photo`
    )

    get(cardRef)
      .then((snapshot) => {
        if (snapshot.exists() && snapshot.val()) {
          const img = new Image()
          img.src = snapshot.val()

          img.onload = () => {
            setCardPhoto(snapshot.val())
            setImageLoaded(true)
          }
        } else {
          // If user card doesn't exist, check for bot's card
          cardRef = ref(
            db,
            `bot/${player.id}/cards/${player.selectedCard}/photo`
          )

          get(cardRef)
            .then((snapshot) => {
              if (snapshot.exists() && snapshot.val()) {
                const img = new Image()
                img.src = snapshot.val()

                img.onload = () => {
                  setCardPhoto(snapshot.val())
                  setImageLoaded(true)
                }
              } else {
                setCardPhoto(null)
                setImageLoaded(false)
                setAnimationStarted(false)
                setAnimationFrame(0)
              }
            })
            .catch((error) => {
              console.error('❌ Error fetching bot card photo:', error)
              setCardPhoto(null)
              setImageLoaded(false)
              setAnimationStarted(false)
              setAnimationFrame(0)
            })
        }
      })
      .catch((error) => {
        console.error('❌ Error fetching user card photo:', error)
        setCardPhoto(null)
        setImageLoaded(false)
        setAnimationStarted(false)
        setAnimationFrame(0)
      })
  }, [player.selectedCard])

  useEffect(() => {
    if (imageLoaded && preloadedImages.length > 0 && gamePhase === 'battle') {
      setAnimationStarted(true)
      setAnimationFrame(0)
      playStoredAudio('gameDropSound')
      dropHapticFeedback()
    }
  }, [imageLoaded, preloadedImages, gamePhase])

  useEffect(() => {
    if (!animationStarted || preloadedImages.length === 0) return

    const interval = setInterval(() => {
      setAnimationFrame((prev) => {
        if (prev < preloadedImages.length - 1) {
          return prev + 1
        } else {
          clearInterval(interval)
          return prev
        }
      })
    }, 30)

    return () => clearInterval(interval)
  }, [animationStarted, preloadedImages])

  return (
    <div
      className={`selected-card-area ${isLeft ? 'left-card' : 'right-card'} ${player.selectedCard ? 'card-selected' : ''}`}
    >
      {gamePhase !== 'battle' ? (
        player.selectedCard ? (
          <div
            className="black-card-placeholder"
            onLoad={() => triggerHapticFeedback()}
          ></div>
        ) : (
          <div className="no-card-placeholder"></div>
        )
      ) : (
        cardPhoto && (
          <img
            src={cardPhoto}
            alt="Selected Card"
            className="selected-card-image"
          />
        )
      )}

      {animationStarted && preloadedImages.length > 0 && (
        <img
          src={preloadedImages[animationFrame]}
          alt="Selection Animation"
          className="selection-animation"
        />
      )}
    </div>
  )
})

// CardList Component
const CardList = ({
  cards,
  onCardClick,
  selectedCard,
  previousCards,
  gamePhase,
  tutorialHighlightCard, // Accept the tutorialHighlightCard prop
}) => {
  return (
    <div className="card-list-container">
      {cards.length === 0 ? (
        <div className="no-cards-placeholder">No Cards Available</div>
      ) : (
        <ul className="card-list">
          {cards.map((card) => {
            const isDisabled =
              selectedCard === card.id ||
              previousCards.includes(card.id) ||
              gamePhase !== 'selection' // Disable click if not in selection phase

            // Check if this card should be highlighted
            const isHighlighted = card.id === tutorialHighlightCard

            return (
              <li
                key={card.id}
                onClick={() => !isDisabled && onCardClick(card.id)}
                className={`card-item ${isDisabled ? 'disabled' : ''} ${isHighlighted ? 'battle-tut-highlight-border' : ''}`} // Add highlight class if needed
              >
                <div className="card-photo-container">
                  {card.photo ? (
                    <img
                      src={card.photo}
                      alt={card.name}
                      className="card-photo"
                    />
                  ) : (
                    <div className="card-photo-placeholder">No Image</div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// Main Battle Component
const Battle = ({ user }) => {
  const { matchID } = useParams()
  const navigate = useNavigate()

  const [gamePhase, setGamePhase] = useState('waiting')
  const [matchStatus, setMatchStatus] = useState(null)
  const [timer, setTimer] = useState(0)
  const [currentPlayer, setCurrentPlayer] = useState(null)
  const [enemyPlayer, setEnemyPlayer] = useState(null)
  const [selectedCard, setSelectedCard] = useState(null)
  const [previousCards, setPreviousCards] = useState([])
  const [userCards, setUserCards] = useState([])
  const [hasEndedTurn, setHasEndedTurn] = useState(false)
  const [error, setError] = useState(null)
  const [currentPlayerPhoto, setCurrentPlayerPhoto] = useState(null)
  const [enemyPlayerPhoto, setEnemyPlayerPhoto] = useState(null)
  const [finalResults, setFinalResults] = useState(null)
  const [winAmount, setWinAmount] = useState(0)
  const [attackDirection, setAttackDirection] = useState(null)
  const [currentAttackFrame, setCurrentAttackFrame] = useState(null)
  const [adLoaded, setAdLoaded] = useState(false)
  const [ads, setAds] = useState(user.ads || 0)
  const [coins, setCoins] = useState(user.coins || 0)
  const [showAnnouncement, setShowAnnouncement] = useState(false)
  const [message, setMessage] = useState('')
  const [isFetchingResults, setIsFetchingResults] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [hasFinished, setHasFinished] = useState(false) // Track if the user manually finishes the tutorial

  const [remainingSynergy, setRemainingSynergy] = useState({
    currentPlayer: 0, // Dynamic remaining synergy for current player
    enemyPlayer: 0, // Dynamic remaining synergy for enemy player
  })

  const selectedCardRef = useRef(null)

  const backendURL = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    if (!matchID) return
    const db = getDatabase()
    const matchRef = ref(db, `currentGames/${matchID}`)

    const unsubscribe = onValue(matchRef, (snapshot) => {
      if (!snapshot.exists()) {
        console.warn('⚠️ Match deleted. Redirecting...')
        navigate('/tournament')
      }
    })

    return () => unsubscribe()
  }, [matchID, navigate])

  useEffect(() => {
    if (currentPlayer && enemyPlayer) {
      setRemainingSynergy({
        currentPlayer: currentPlayer.totalSynergy,
        enemyPlayer: enemyPlayer.totalSynergy,
      })
    }
  }, [currentPlayer, enemyPlayer])

  useEffect(() => {
    if (!matchID) return

    const fetchPhotos = async () => {
      const db = getDatabase()
      const matchRef = ref(db, `currentGames/${matchID}`)
      const snapshot = await get(matchRef)

      if (!snapshot.exists()) return
      const matchData = snapshot.val()

      const p1Id = matchData.player1?.id || 'Unknown'
      const p2Id = matchData.player2?.id || 'Unknown'

      const p1Data = await fetchPlayerData(p1Id)
      const p2Data = await fetchPlayerData(p2Id)

      setCurrentPlayerPhoto(
        user.userId === p1Id ? p1Data.photoUrl : p2Data.photoUrl
      )
      setEnemyPlayerPhoto(
        user.userId === p1Id ? p2Data.photoUrl : p1Data.photoUrl
      )
    }

    fetchPhotos()
  }, [matchID, user.userId])

  const fetchPlayerData = useCallback(async (userId) => {
    if (!userId || userId === 'Unknown')
      return { name: 'Unknown Player', photoUrl: '/default-avatar.png' }

    const db = getDatabase()
    const userRef = ref(db, `users/${userId}`)

    try {
      const snapshot = await get(userRef)
      if (snapshot.exists()) {
        const userData = snapshot.val()
        return {
          name: `${userData.first_name} ${userData.last_name}`,
          photoUrl: userData.photo_url?.startsWith('http')
            ? userData.photo_url
            : '/default-avatar.png',
        }
      }
    } catch (err) {
      console.error(`❌ Error fetching data for user ${userId}:`, err)
    }
    return { name: 'Unknown Player', photoUrl: '/default-avatar.png' }
  }, [])

  useEffect(() => {
    if (!matchID) return

    const db = getDatabase()
    const matchRef = ref(db, `currentGames/${matchID}`)

    const phaseUnsub = onValue(matchRef, (snapshot) => {
      const matchData = snapshot.val()
      if (!matchData) return

      setGamePhase(matchData.gamePhase || 'unknown')
      setMatchStatus(matchData.matchStatus || 'waiting')
      setHasEndedTurn(false)

      if (matchData.player1?.id === user.userId) {
        setCurrentPlayer((prev) => ({
          ...prev,
          totalSynergy: matchData.player1?.totalSynergy || 0,
          selectedCard: matchData.player1?.selectedCard || null,
        }))
        setEnemyPlayer((prev) => ({
          ...prev,
          totalSynergy: matchData.player2?.totalSynergy || 0,
          selectedCard: matchData.player2?.selectedCard || null,
        }))
      } else if (matchData.player2?.id === user.userId) {
        setCurrentPlayer((prev) => ({
          ...prev,
          totalSynergy: matchData.player2?.totalSynergy || 0,
          selectedCard: matchData.player2?.selectedCard || null,
        }))
        setEnemyPlayer((prev) => ({
          ...prev,
          totalSynergy: matchData.player1?.totalSynergy || 0,
          selectedCard: matchData.player1?.selectedCard || null,
        }))
      }
    })

    return () => phaseUnsub()
  }, [matchID, user.userId])

  useEffect(() => {
    if (!matchID) return
    const db = getDatabase()
    const matchRef = ref(db, `currentGames/${matchID}`)
    const userCardsRef = ref(db, `users/${user.userId}/cards`)

    const phaseUnsub = onValue(matchRef, (snapshot) => {
      const matchData = snapshot.val()
      if (!matchData) return

      setGamePhase(matchData.gamePhase || 'unknown')
      setMatchStatus(matchData.matchStatus || 'waiting')
      setHasEndedTurn(false)

      if (matchData.player1?.id === user.userId) {
        setCurrentPlayer(matchData.player1)
        setEnemyPlayer(matchData.player2)
        setSelectedCard(matchData.player1?.selectedCard || null)
        setPreviousCards(matchData.player1?.previousCards || [])
      } else if (matchData.player2?.id === user.userId) {
        setCurrentPlayer(matchData.player2)
        setEnemyPlayer(matchData.player1)
        setSelectedCard(matchData.player2?.selectedCard || null)
        setPreviousCards(matchData.player2?.previousCards || [])
      } else {
        navigate('/tournament')
      }

      if (matchData.phaseEndTime) {
        setTimer(
          Math.max(Math.floor((matchData.phaseEndTime - Date.now()) / 1000), 0)
        )
      }
    })

    onValue(userCardsRef, (snapshot) => {
      if (snapshot.exists()) {
        const allCards = snapshot.val()
        const defaultDeckCards = Object.entries(allCards)
          .filter(([_, card]) => card.defaultDeck === true)
          .map(([cardId, cardData]) => ({ id: cardId, ...cardData }))
        setUserCards(defaultDeckCards)
      }
    })

    return () => phaseUnsub()
  }, [matchID, user.userId, navigate])

  useEffect(() => {
    if (timer > 0) {
      const countdown = setInterval(() => {
        setTimer((prev) => Math.max(prev - 1, 0))
      }, 1000)

      return () => clearInterval(countdown)
    }
  }, [timer])

  useEffect(() => {
    console.log('Current Game Phase:', gamePhase) // Debugging the phase value
  }, [gamePhase])

  const handleCardClick = async (cardId) => {
    triggerHapticFeedback()
    // Debugging the game phase
    console.log('Game Phase on Card Click:', gamePhase) // Add this line to debug

    // Ensure the game is in the selection phase before allowing card selection
    if (gamePhase !== 'selection') {
      //setError('You can only select cards during the selection phase')
      return // Prevent card selection if it's not the selection phase
    }

    if (!matchID || selectedCard || previousCards.includes(cardId)) return

    try {
      const response = await fetch(`${backendURL}/api/battle/selectCard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: matchID,
          userId: user.userId,
          cardId,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setSelectedCard(cardId)
        setTutorialStep(2)
        setPreviousCards(data.previousCards || [])
        selectedCardRef.current = cardId // Store selected card in ref to avoid re-rendering
      } else {
        setError(data.error || 'Failed to select card')
      }
    } catch (error) {
      console.error('Error selecting card:', error)
      setError('Error selecting card')
    }
  }

  const handleEndTurn = async () => {
    setHasEndedTurn(true) // Disable the button once clicked
    triggerHapticFeedback()
    setTutorialStep(4)
    try {
      const response = await fetch(
        `${backendURL}/api/matches/${matchID}/endRound`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.userId }),
        }
      )

      const data = await response.json()

      if (response.ok) {
        console.log(data.message) // Show success message
      } else {
        setError(data.error || 'Failed to end turn')
      }
    } catch (error) {
      console.error('Error ending turn:', error)
      setError('Error ending turn')
    }
  }

  // Leave Game
  const handleLeaveGame = async () => {
    triggerHapticFeedback()

    if (!matchID) {
      console.error('Match data is not available.')
      return
    }

    try {
      const response = await fetch(
        `${backendURL}/api/game/cancelMatch/${matchID}`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()
      console.log(data.message)

      // Navigate to the tournament screen after cancellation
      navigate('/tournament')
      showAdsgramInterstitial()
    } catch (error) {
      console.error('Error canceling match:', error)
    }
  }

  const fetchFinalResults = async () => {
    setIsFetchingResults(true)
    try {
      const response = await fetch(
        `${backendURL}/api/game/getFinalResults/${matchID}`
      )
      const data = await response.json()

      if (response.ok) {
        setFinalResults(data)
      } else {
        setError(data.error || 'Failed to fetch final results')
      }
    } catch (error) {
      console.error('Error fetching final results:', error)
      setError('Error fetching final results')
    } finally {
      setIsFetchingResults(false)
    }
  }

  const { gameOutcome, baseWinAmount } = useMemo(() => {
    if (!finalResults || !user?.userId) {
      return { gameOutcome: 'Game Over!', baseWinAmount: 0 }
    }

    if (user.userId === finalResults.winner) {
      return { gameOutcome: 'You Won! 🎉', baseWinAmount: 10000 }
    } else if (user.userId === finalResults.loser) {
      return { gameOutcome: 'You Lost! 😢', baseWinAmount: 0 }
    } else {
      return { gameOutcome: 'Draw! 🤝', baseWinAmount: 5000 }
    }
  }, [finalResults, user?.userId])

  useEffect(() => {
    setWinAmount(baseWinAmount)
  }, [baseWinAmount, finalResults])

  useEffect(() => {
    if (gamePhase === 'finished') {
      fetchFinalResults()

      const timer = setTimeout(async () => {
        try {
          await showAdsgramInterstitial()
        } catch (error) {
          console.error('Error in handleWatchAd:', error)
          navigate('/tournament') // Navigate if ad fails
        }
      }, 10000)

      return () => clearTimeout(timer)
    }
  }, [gamePhase, navigate])

  useEffect(() => {
    if (finalResults) {
      setShowDialog(true)
    }
  }, [finalResults])

  // Attack Animations

  useEffect(() => {
    if (
      gamePhase === 'selection' &&
      currentPlayer?.selectedCard &&
      enemyPlayer?.selectedCard
    ) {
      const currentSynergy = currentPlayer?.totalSynergy || 0
      const enemySynergy = enemyPlayer?.totalSynergy || 0

      console.log(`⚡ Both players have selected a card!`)
      console.log(`🔹 Current Player Synergy: ${currentSynergy}`)
      console.log(`🔹 Enemy Player Synergy: ${enemySynergy}`)

      if (currentSynergy > enemySynergy) {
        console.log(
          `🔥 Current Player has HIGHER synergy. Attack → Left to Right`
        )
        setAttackDirection('ltr') // Store direction, don't run animation yet
      } else if (enemySynergy > currentSynergy) {
        console.log(
          `🔥 Enemy Player has HIGHER synergy. Attack → Right to Left`
        )
        setAttackDirection('rtl') // Store direction
      } else {
        console.log(`⚖️ Both players have EQUAL synergy. No attack animation.`)
        setAttackDirection(null)
      }
    } else {
      console.log("⚠️ One or both players haven't selected a card yet.")
      setAttackDirection(null) // Don't run animation if cards are not selected
    }
  }, [gamePhase, currentPlayer?.selectedCard, enemyPlayer?.selectedCard])

  useEffect(() => {
    if (gamePhase === 'battle' && attackDirection) {
      console.log(
        `🎬 Running Attack Animation: ${attackDirection.toUpperCase()}`
      )
      runAttackAnimation(attackDirection)
      playStoredAudio('gameAttackMusic')
    }
  }, [gamePhase, attackDirection])

  const runAttackAnimation = (direction) => {
    // ✅ Get preloaded frames from IndexedDB
    const preloadedFrames = getFrames(direction)

    if (preloadedFrames.length === 0) {
      console.error(`❌ No frames found for ${direction} animation.`)
      return
    }

    let frameIndex = 0
    const animationInterval = setInterval(() => {
      if (frameIndex >= preloadedFrames.length) {
        clearInterval(animationInterval) // Stop animation
        console.log('✅ Attack animation finished')

        // Reset the attack frame after the animation ends
        setCurrentAttackFrame(null)
        return
      }

      // Set the current frame from IndexedDB (preloaded)
      setCurrentAttackFrame(preloadedFrames[frameIndex])
      frameIndex++
    }, 58) // ~58ms per frame

    console.log(`🎬 Running ${direction.toUpperCase()} Attack Animation`)
  }

  // End of Attack Animation

  const handleWatchAd = async () => {
    if (timer > 0) return
    await showRewardedAd(user?.userId)
  }

  useEffect(() => {
    let announcementText = ''

    if (gamePhase === 'cooldown') {
      announcementText = 'Cooldown Phase!'
    } else if (gamePhase === 'selection') {
      announcementText = 'Selection Phase'
    } else if (gamePhase === 'battle') {
      announcementText = 'Battle'
    }

    if (announcementText) {
      setMessage(announcementText)
      setShowAnnouncement(true)

      setTimeout(() => {
        setShowAnnouncement(false)
      }, 1000) // Hide after 1 second
    }
  }, [gamePhase])

  // Tutorials

  useEffect(() => {
    const tutorialComplete = localStorage.getItem('battleTutorialEnds')
    if (tutorialComplete === 'true') {
      setHasFinished(true) // If completed, don't start the tutorial
      setTutorialStep(6) // Skip tutorial steps and directly go to the next phase (step 6 or game phase)
    }
  }, [])

  useEffect(() => {
    if (hasFinished) return // Don't run the tutorial logic if it's already finished

    if (tutorialStep === 0) {
      const timer = setTimeout(() => {
        setTutorialStep(1) // Move to card selection step
      }, 6000) // Wait 6 seconds before transitioning to step 1

      return () => clearTimeout(timer)
    }
  }, [tutorialStep, hasFinished]) // Run effect only if tutorial is not finished

  useEffect(() => {
    if (hasFinished) return // Skip tutorial steps if finished

    if (tutorialStep === 2) {
      const timeout = setTimeout(() => {
        setTutorialStep(3) // Move to the next step (Step 3)
      }, 5000) // Transition after 5 seconds

      return () => clearTimeout(timeout)
    }
  }, [tutorialStep, hasFinished])

  useEffect(() => {
    if (hasFinished) return // Skip tutorial steps if finished

    if (tutorialStep === 4) {
      const timer = setTimeout(() => {
        setTutorialStep(5) // Move to step 5 after 11 seconds
      }, 11000)

      return () => clearTimeout(timer)
    }
  }, [tutorialStep, hasFinished])

  useEffect(() => {
    if (hasFinished) return // Skip tutorial steps if finished

    if (tutorialStep === 5) {
      const timer = setTimeout(() => {
        if (!hasFinished) {
          finishTutorial() // Automatically finish the tutorial after 7 seconds
        }
      }, 7000) // After 7 seconds, finish the tutorial automatically if the user hasn't clicked "Finish"

      return () => clearTimeout(timer)
    }
  }, [tutorialStep, hasFinished])

  const handleFinishTutorial = () => {
    setHasFinished(true)
    finishTutorial()
  }

  // Save to localStorage and mark the tutorial as complete
  const finishTutorial = () => {
    localStorage.setItem('battleTutorialEnds', 'true') // Mark the tutorial as finished in localStorage
    setTutorialStep(6) // Proceed to the next tutorial step or game phase
  }

  // End

  if (!currentPlayer || !enemyPlayer) return <div>Loading...</div>

  return (
    <div className="battlePage-container">
      <div className="battle-header">
        <div className="player-container battle-left">
          <PlayerInfo photoUrl={currentPlayerPhoto} isLeft={true} />
        </div>

        <Timer
          timer={timer}
          gamePhase={gamePhase}
          className={tutorialStep === 2 ? 'battle-tut-highlight-border' : ''} // Pass class when tutorialStep is 2
        />

        <div className="player-container battle-right">
          <PlayerInfo photoUrl={enemyPlayerPhoto} isLeft={false} />
        </div>
      </div>

      <div
        className={`selected-card-container ${tutorialStep === 4 ? 'battle-tut-highlight-border' : ''}`} // Apply border highlight on Step 4
      >
        <SelectedCardArea
          player={currentPlayer}
          isLeft={true}
          gamePhase={gamePhase}
        />
        <div className="vs-text"></div>
        <SelectedCardArea
          player={enemyPlayer}
          isLeft={false}
          gamePhase={gamePhase}
        />
        {currentAttackFrame && (
          <img
            src={currentAttackFrame}
            alt="Attack Animation"
            className="attack-animation"
          />
        )}
      </div>

      <div
        style={{
          display: showAnnouncement ? 'block' : 'none',
          color: 'white',
          fontSize: '24px',
          zIndex: 999,
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <h2>{message}</h2>
      </div>

      <div className="cards-container">
        <CardList
          cards={userCards}
          onCardClick={handleCardClick}
          selectedCard={selectedCard}
          previousCards={previousCards}
          gamePhase={gamePhase}
          tutorialHighlightCard={tutorialStep === 1 ? userCards[0]?.id : null} // Highlight the first card
        />
      </div>

      {tutorialStep === 1 && (
        <div className="battle-tut-message battle-tut-step2-message">
          Now, select a card to play this round.
        </div>
      )}

      {showDialog && (
        <div className="battlePageGO-game-over-modal">
          <div className="battlePageGO-modal-content">
            <h2>{gameOutcome}</h2>

            <p className="battlePageGO-win-amount">
              Win Amount: {winAmount.toLocaleString()}
            </p>

            <div className="battlePageGO-button-group">
              <button
                className="battlePageGO-return-btn"
                onClick={() => navigate('/tournament')}
              >
                Return to Tournament
              </button>

              {baseWinAmount > 0 && (
                <button
                  className="battlePageGO-watch-ad-btn"
                  onClick={handleWatchAd}
                >
                  🎥 Watch Ad & Get 2X Rewards
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="battlePage-footer">
        <div>
          {/* Step 5 Button */}
          <button
            className={`battlePage-leave-button ${tutorialStep === 5 ? 'battle-tut-highlight-border-button' : ''}`} // Highlight button on Step 5
            onClick={handleLeaveGame}
          >
            🌀
          </button>

          {/* Step 5 Tutorial Message */}
          {tutorialStep === 5 && (
            <div className="step-5-tutorial-message">
              <p>Click here to leave the match early.</p>

              {/* Finish Button */}
              <button
                className="finish-tutorial-button"
                onClick={handleFinishTutorial}
              >
                Finish Tutorial
              </button>
            </div>
          )}
        </div>

        <div className="battle-tut-phase-name-wrapper">
          <div
            className={`battlePage-phase-name ${tutorialStep === 0 ? 'battle-tut-highlight-border' : ''}`}
          >
            {gamePhase}
          </div>

          {tutorialStep === 0 && (
            <div className="battle-tut-message">
              Here you can check the current phase of the battle.
            </div>
          )}
        </div>

        {tutorialStep === 3 && (
          <div className="step-3-tutorial-message">
            It's your turn! Click on the End Turn button when you're ready.
          </div>
        )}
        <button
          onClick={handleEndTurn}
          disabled={hasEndedTurn}
          className={`battlePage-lock-button ${tutorialStep === 3 ? 'battle-tut-highlight-border-button' : ''}`}
        >
          💠
        </button>
      </div>

      {error && <p style={{ color: 'red' }}></p>}
    </div>
  )
}

export default Battle
