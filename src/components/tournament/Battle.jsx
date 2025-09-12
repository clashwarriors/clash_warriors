import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { ref, onValue, off } from 'firebase/database'
import {
  showRewardedInterstitialAd1K,
  showRewardedInterstitialAd10K,
} from './utils/adsUtility'
import './style/battle.css'
import { getCards } from '../../utils/indexedDBService'
import cardHolder from '/assets/gameLogo.avif'
import summonLeft from './assets/leftSummon.png'
import summonRight from './assets/rightSummon.png'
import { playStoredAudio } from './utils/audioUtils'
import { dropHapticFeedback } from './utils/haptic'
import { realtimeDB } from '../../firebase'
import { getFrames } from './utils/indexedDBHelper'
import CachedImage from '../shared/CachedImage'

const PHASES = {
  COOLDOWN: 'cooldown',
  SELECTION: 'selection',
  BATTLE: 'battle',
  CANCELLED: 'cancelled',
}

const PHASE_TIMERS = {
  cooldown: 5000,
  selection: 1000000,
  battle: 10000,
}

const ABILITIES = {
  AEGIS_WARD: 'Aegis Ward',
  ARCANE_OVERCHARGE: 'Arcane Overcharge',
  BERSERKERS_FURY: 'Berserkers Fury',
  CELESTIAL_REJUVENATION: 'Celestial Rejuvenation',
  FURY_UNLEASHED: 'Fury Unleashed',
  GUARDIANS_BULWARK: "Guardian's Bulwark",
  MINDWRAP: 'Mind Wrap',
  SOUL_LEECH: 'Soul Leech',
  TITAN_STRIKE: "Titan's Strike",
  TWIN_STRIKE: 'Twin Strike',
}

const Battle = ({ user }) => {
  const { matchID } = useParams()
  const navigate = useNavigate()
  const userId = user?.userId
  const [match, setMatch] = useState(null)
  const [phase, setPhase] = useState(PHASES.COOLDOWN)
  const [remainingTime, setRemainingTime] = useState(0)
  const [selectedCard, setSelectedCard] = useState(null)
  const [player2SelectedCard, setPlayer2SelectedCard] = useState(null)
  const [dropFrames, setDropFrames] = useState([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [player2Animating, setPlayer2Animating] = useState(false)
  const [player2FrameIndex, setPlayer2FrameIndex] = useState(0)
  const [showFinishedModal, setShowFinishedModal] = useState(false)
  const [animationDirection, setAnimationDirection] = useState(null)
  const [directionalFrames, setDirectionalFrames] = useState([])
  const [directionFrameIndex, setDirectionFrameIndex] = useState(0)
  const [player1Name, setPlayer1Name] = useState('')
  const [player2Name, setPlayer2Name] = useState('maybe')
  const [showAbilityPopup, setShowAbilityPopup] = useState(false)
  const [selectedAbility, setSelectedAbility] = useState(null)
  const [finalResult, setFinalResult] = useState(null)
  const [playerDeck, setPlayerDeck] = useState([])
  const [player1Hp, setPlayer1Hp] = useState(0)
  const [player2Hp, setPlayer2Hp] = useState(0)
  const [player1Role, setPlayer1Role] = useState('attack')
  const [player2Role, setPlayer2Role] = useState('defense')
  const [isPlayer1, setIsPlayer1] = useState(null)
  const [player1Ability, setPlayer1Ability] = useState(null)
  const [player2Ability, setPlayer2Ability] = useState(null)
  const [currentRound, setCurrentRound] = useState({ player1: {}, player2: {} })
  const [previousRounds, setPreviousRounds] = useState({
    player1: [],
    player2: [],
  })
  const [usedCardIds, setUsedCardIds] = useState([])
  const [cardSelected, setCardSelected] = useState(false)
  const [usedAbilities, setUsedAbilities] = useState([])
  const [hasEndedTurn, setHasEndedTurn] = useState(false)

  const containerRef = useRef(null)
  const intervalRef = useRef(null)

  const phaseBadges = {
    [PHASES.COOLDOWN]: '/new/battle/assets/phase/cooldown.png',
    [PHASES.SELECTION]: '/new/battle/assets/phase/selection.png',
    [PHASES.BATTLE]: '/new/battle/assets/phase/battle.png',
    [PHASES.CANCELLED]: '/new/battle/assets/phase/cancelled.png',
    [PHASES.FINISHED]: '/new/battle/assets/phase/cancelled.png', // reuse cancelled
  }

  // Match Fetching and Setup
  useEffect(() => {
    if (!matchID || !userId) return

    const matchRef = ref(realtimeDB, `battles/${matchID}`)
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) return console.log('No match data found in Realtime DB')

      setMatch(data)

      const playerKey =
        data.player1?.playerId === userId ? 'player1' : 'player2'
      const opponentKey = playerKey === 'player1' ? 'player2' : 'player1'

      // 🔹 Extract HP
      setPlayer1Hp(data.player1?.hp || 0)
      setPlayer2Hp(data.player2?.hp || 0)

      // 🔹 Current round
      const currentRoundData = data[playerKey]?.currentRound || {}
      setCurrentRound((prev) => ({
        ...prev,
        [playerKey]: currentRoundData,
      }))

      // 🔹 Reset selection flags for new round
      setCardSelected(false)
      setSelectedAbility(null)
      setSelectedCard(
        currentRoundData.cardId ? { src: currentRoundData.cardPhotoSrc } : null
      )
      setPlayer2SelectedCard(
        data[opponentKey]?.currentRound?.cardId
          ? { src: data[opponentKey].currentRound.cardPhotoSrc }
          : null
      )

      // 🔹 Names & roles
      setPlayer1Name(data.player1?.userName || 'Player1')
      setPlayer2Name(data.player2?.userName || 'Player2')
      setPlayer1Role(currentRoundData.role || 'attack')
      setPlayer2Role(data[opponentKey]?.currentRound?.role || 'defense')

      // 🔹 Is logged-in user player1?
      setIsPlayer1(playerKey === 'player1')

      // 🔹 Current phase
      if (data.currentPhase) setPhase(data.currentPhase)

      // 🔹 Remaining time
      if (data.currentPhase && data.phaseStartTime) {
        const duration = PHASE_TIMERS[data.currentPhase] || 0
        const updateRemainingTime = () => {
          const elapsed = Date.now() - data.phaseStartTime
          setRemainingTime(Math.max(0, Math.ceil((duration - elapsed) / 1000)))
        }
        updateRemainingTime()
        if (window._phaseTimer) clearInterval(window._phaseTimer)
        window._phaseTimer = setInterval(updateRemainingTime, 1000)
      }

      // 🔹 Used cards & abilities
      const previousRoundsObj = data[playerKey]?.previousRounds || {}

      // Convert object to array
      const previousRoundsArr = Object.values(previousRoundsObj)

      const currentRoundAbility = currentRoundData.abilitySelected || null

      // Combine previous rounds abilities + current round ability
      const allUsedAbilities = [
        ...previousRoundsArr.map((r) => r.ability).filter(Boolean),
        currentRoundAbility,
      ]

      setUsedAbilities(allUsedAbilities)

      // Only previous rounds → block cards used in past rounds, not current round
      const usedCards = previousRoundsArr.map((r) => r.cardId).filter(Boolean)
      const usedAbilities = previousRoundsArr
        .map((r) => r.ability)
        .filter(Boolean)

      setPreviousRounds({ [playerKey]: previousRoundsObj })
      setUsedCardIds(usedCards)
      setUsedAbilities(usedAbilities)
    })

    return () => {
      off(matchRef)
      if (window._phaseTimer) clearInterval(window._phaseTimer)
    }
  }, [matchID, userId])

  // Deck Managment
  useEffect(() => {
    const fetchDefaultDeck = async () => {
      try {
        const allCards = await getCards()
        // Filter only defaultDeck cards
        const defaultDeckCards = allCards.filter((card) => card.defaultDeck)
        setPlayerDeck(defaultDeckCards)
      } catch (err) {
        console.error('Failed to fetch cards:', err)
      }
    }

    fetchDefaultDeck()
  }, [])

  // Card Selection Handler
  const handleCardClick = async (card) => {
    if (phase !== PHASES.SELECTION || cardSelected) return // block extra clicks

    try {
      const res = await fetch(
        `http://localhost:5000/api/battle/${matchID}/select-card`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: userId,
            cardId: card.cardId,
            photo: card.photo,
            stats: card.stats,
          }),
        }
      )

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to select card')

      console.log('Card selected successfully:', data)
      setShowAbilityPopup(true)
      setCardSelected(true) // prevent re-select until next round
    } catch (err) {
      console.error('Failed to select card:', err)
    }
  }

  const handleAbilityClick = async (abilityKey) => {
    if (phase !== PHASES.SELECTION) return
    if (!match || !userId) return console.error('No match or userId available')

    try {
      const isPlayer1 = match.player1.playerId === userId
      const playerKey = isPlayer1 ? 'player1' : 'player2'

      const res = await fetch(
        `http://localhost:5000/api/battle/${matchID}/select-ability`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: userId, abilityKey }),
        }
      )

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to select ability')

      console.log(`Ability ${abilityKey} selected successfully:`, data)

      // ✅ Update local state for UI
      if (isPlayer1) setPlayer1Ability(abilityKey)
      else setPlayer2Ability(abilityKey)

      // ✅ Also update selectedAbility for button enable
      setSelectedAbility(abilityKey)

      setShowAbilityPopup(false)
    } catch (err) {
      console.error('Failed to select ability:', err)
    }
  }

  // End Round
  const handleEndRound = async () => {
    console.log('End Round clicked')

    if (!matchID || !user.userId) return

    try {
      const res = await fetch('http://localhost:5000/api/battle/endTurn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchID, playerId: user.userId }),
      })

      const data = await res.json()
      if (data.success) console.log('Turn ended successfully!')
    } catch (err) {
      console.error('Failed to end turn:', err)
    }
  }

  // Cancel Match
  const cancelMatch = async () => {
    if (!matchID || !user.userId) return

    try {
      await fetch('http://localhost:5000/api/battle/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchID, playerId: user.userId }),
      })

      console.log('Match cancelled, leaving tournament')
      localStorage.removeItem('currentMatchId')
      navigate('/tournament') // redirect to tournament page
    } catch (err) {
      console.error('Failed to cancel match:', err)
    }
  }

  return (
    <div className="battle-container" ref={containerRef}>
      <div className="battle-header">
        <div className="battle-header-left">
          <img src={user.photo_url} alt="Player Avatar" className="avatar" />
          <p>{player1Name} HP</p>
          <p>{player1Hp}</p>
          <p>{player1Role}</p>
        </div>
        <div className="battle-header-center">
          <p className="battle-timer">{remainingTime}s</p>
        </div>
        <div className="battle-header-right">
          <p>{player2Name}</p>
          <p>{player2Hp}</p>
          <p>{player2Role}</p>
          <img src="/assets/gameLogo.avif" className="avatar" />
        </div>
      </div>

      <div className="battle-area">
        <div
          className="summon-wrapper summon-left"
          style={{ position: 'relative' }}
        >
          {selectedCard && animating && dropFrames.length > 0 && (
            <img
              src={dropFrames[frameIndex]}
              alt="Drop Animation"
              className="drop-animation-frame"
              style={{
                position: 'absolute',
                top: '-50%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 430,
                height: 420,
                zIndex: 2,
                pointerEvents: 'none',
              }}
            />
          )}
          <img
            src={selectedCard ? selectedCard.src : cardHolder}
            alt="Player Card"
            className="card-img"
            style={{ position: 'relative', zIndex: 2 }}
          />
          <img
            src={summonLeft}
            alt="Summon Ring Left"
            className="summon-img glow-orange"
          />
        </div>
        <div
          className="summon-wrapper summon-right"
          style={{ position: 'relative' }}
        >
          {player2SelectedCard && player2Animating && dropFrames.length > 0 && (
            <img
              src={dropFrames[player2FrameIndex]}
              alt="Player2 Drop Animation"
              className="drop-animation-frame"
              style={{
                position: 'absolute',
                top: '-50%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 430,
                height: 440,
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />
          )}
          <img
            src={player2SelectedCard ? player2SelectedCard.src : cardHolder}
            className="card-img"
            style={{ marginLeft: 10 }}
            alt="Player2 Card"
          />
          <img
            src={summonRight}
            alt="Summon Ring Right"
            className="summon-img glow-blue tilt-up"
          />
        </div>
        {directionalFrames.length > 0 && (
          <img
            src={directionalFrames[directionFrameIndex]}
            alt="Battle Direction Animation"
            className="directional-animation"
            style={{ marginTop: 30 }}
          />
        )}
      </div>

      <div className="deck-section">
        {playerDeck.map((card) => {
          // Block if used in previous rounds OR currently selected in this round
          const isBlocked =
            usedCardIds.includes(card.cardId) ||
            (currentRound?.player1?.cardId === card.cardId && isPlayer1) ||
            (currentRound?.player2?.cardId === card.cardId && !isPlayer1)

          return (
            <img
              key={card.cardId}
              src={card.photo}
              alt={card.name}
              className={`deck-card 
          ${phase !== PHASES.SELECTION ? 'disabled' : ''} 
          ${isBlocked ? 'used' : ''}`}
              onClick={() => !isBlocked && handleCardClick(card)}
            />
          )
        })}
      </div>

      <div className="battle-footer">
        <CachedImage
          src="/new/battle/assets/endBattleBtn.png"
          alt="End Battle Button"
          className="footer-btn"
          onClick={cancelMatch}
        />
        <CachedImage
          src={phaseBadges[phase]}
          alt={`Phase: ${phase}`}
          className="phase-badge"
        />
        <CachedImage
          src="/new/battle/assets/endRoundBtn.png"
          alt="End Round Button"
          className="footer-btn"
          onClick={handleEndRound}
          style={{
            opacity: selectedCard && selectedAbility ? 1 : 0.5,
            pointerEvents: selectedCard && selectedAbility ? 'auto' : 'none',
          }}
          title={
            selectedCard && selectedAbility
              ? 'End Round'
              : 'Select card and ability first'
          }
        />
      </div>

      {showAbilityPopup && (
        <div className="ability-popup">
          <h3>Select an Ability</h3>
          <div className="abilities-grid">
            {Object.entries(ABILITIES)
              .filter(([key, ability]) => {
                const ATTACK_ABILITIES = [
                  'TITAN_STRIKE',
                  'BERSERKERS_FURY',
                  'MINDWRAP',
                  'TWIN_STRIKE',
                  'SOUL_LEECH',
                  'FURY_UNLEASHED',
                ]
                const DEFENSE_ABILITIES = [
                  'AEGIS_WARD',
                  'CELESTIAL_REJUVENATION',
                  'GUARDIANS_BULWARK',
                  'ARCANE_OVERCHARGE',
                ]

                if (player1Role === 'attack')
                  return ATTACK_ABILITIES.includes(key)
                if (player1Role === 'defense')
                  return DEFENSE_ABILITIES.includes(key)
                return false
              })
              .map(([key, ability]) => {
                const abilityImages = {
                  AEGIS_WARD: '/new/battle/assets/ability/Aegis_Wards.png',
                  FURY_UNLEASHED:
                    '/new/battle/assets/ability/Fury_Unleashed.png',
                  ARCANE_OVERCHARGE:
                    '/new/battle/assets/ability/Archane_Overcharged.png',
                  BERSERKERS_FURY:
                    '/new/battle/assets/ability/Berserkers_Fury.png',
                  CELESTIAL_REJUVENATION:
                    '/new/battle/assets/ability/Celestial_Rejuvenation.png',
                  GUARDIANS_BULWARK:
                    '/new/battle/assets/ability/Guardian_s_Bulwark.png',
                  MINDWRAP: '/new/battle/assets/ability/Mind_Wrap.png',
                  SOUL_LEECH: '/new/battle/assets/ability/Soul_Leech.png',
                  TITAN_STRIKE: '/new/battle/assets/ability/Titans_Strike.png',
                  TWIN_STRIKE: '/new/battle/assets/ability/Twin_Strike.png',
                }

                // ✅ Disable button if ability already used
                const isUsed = usedAbilities.includes(ability)

                return (
                  <button
                    key={ability}
                    className={`ability-btn ${selectedAbility === ability ? 'selected' : ''} ${isUsed ? 'disabled' : ''}`}
                    onClick={() => !isUsed && handleAbilityClick(ability)}
                    type="button"
                  >
                    <CachedImage
                      src={abilityImages[key]}
                      alt={ability}
                      className="ability-img"
                    />
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {showFinishedModal && (
        <div className="newGame-modal">
          <div className="newGame-modal-slab">
            <h2 style={{ fontFamily: '"MedievalSharpBold", sans-serif' }}>
              {finalResult === 'user'
                ? '🏆 You Win!'
                : finalResult === 'bot'
                  ? '💀 You Lose!'
                  : '⚖️ It’s a Tie!'}
            </h2>
            {(finalResult === 'user' || finalResult === 'tie') && (
              <p className="reward-text" style={{ marginTop: '-10px' }}>
                {finalResult === 'user'
                  ? '💰 You earned 10,000 Coins!'
                  : '🎁 You earned 5,000 Coins!'}
              </p>
            )}
            <p style={{ marginTop: '15px' }}>
              Thanks for playing. Redirecting to Tournament...
            </p>
            <button onClick={() => navigate('/tournament')}>
              Return Tournament
            </button>
            <button
              onClick={async () => {
                const success = await showRewardedInterstitialAd10K(user.userId)
                if (success) {
                  navigate('/tournament')
                } else {
                  alert('Ad not completed. No reward granted.')
                  navigate('/tournament')
                }
              }}
              style={{ marginTop: 10 }}
              type="button"
            >
              Earn 10K Coins
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Battle
