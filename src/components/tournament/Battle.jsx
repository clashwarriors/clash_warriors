import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { ref, onValue, off } from 'firebase/database'
import { showRewardedInterstitialAd10K } from './utils/adsUtility'
import './style/battle.css'
import { getCards } from '../../utils/indexedDBService'
import cardHolder from '/assets/gameLogo.avif'
import summonLeft from './assets/leftSummon.png'
import summonRight from './assets/rightSummon.png'
import { realtimeDB } from '../../firebase'
import CachedImage from '../shared/CachedImage'
import { getUserData, storeUserData } from '../../utils/indexedDBService'
import { PHASES, PHASE_TIMERS, ABILITIES } from './utils/battleModifiers'
import { fetchAbilityFrames } from '../../utils/AnimationUtility'
import { abilityConfig, abilityWeights } from './weights/abilites' // your ability JSON

const Battle = ({ user }) => {
  const { matchID } = useParams()
  const navigate = useNavigate()
  const userId = user?.userId
  const [match, setMatch] = useState(null)
  const [phase, setPhase] = useState(PHASES.COOLDOWN)
  const [remainingTime, setRemainingTime] = useState(0)
  const [selectedCard, setSelectedCard] = useState(null)
  const [player2SelectedCard, setPlayer2SelectedCard] = useState(null)
  const [showFinishedModal, setShowFinishedModal] = useState(false)
  const [player1Name, setPlayer1Name] = useState('')
  const [player2Name, setPlayer2Name] = useState('maybe')
  const [showAbilityPopup, setShowAbilityPopup] = useState(false)
  const [selectedAbility, setSelectedAbility] = useState(null)
  const [finalResult, setFinalResult] = useState(null)
  const [playerDeck, setPlayerDeck] = useState([])
  const [player1Hp, setPlayer1Hp] = useState(0)
  const [player2Hp, setPlayer2Hp] = useState(0)
  const [player1Role, setPlayer1Role] = useState('')
  const [player2Role, setPlayer2Role] = useState('')
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
  const [phaseAnnouncement, setPhaseAnnouncement] = useState(null)

  const [currentAbilityDecision, setCurrentAbilityDecision] = useState({
    attack: null,
    defense: null,
  })
  const containerRef = useRef(null)
  const intervalRef = useRef(null)

  const phaseBadges = {
    [PHASES.COOLDOWN]: '/new/battle/assets/phase/cooldown.png',
    [PHASES.SELECTION]: '/new/battle/assets/phase/selection.png',
    [PHASES.BATTLE]: '/new/battle/assets/phase/battle.png',
    [PHASES.CANCELLED]: '/new/battle/assets/phase/cancelled.png',
  }

  useEffect(() => {
    if (!matchID || !userId) return

    const matchRef = ref(realtimeDB, `ongoingBattles/${matchID}`)
    let finishTimeout = null
    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) return console.log('No match data found in Realtime DB')

      setMatch(data)

      const playerKey = 'player1'
      const opponentKey = 'player2'

      // Extract raw HP
      const rawP1Hp = data.player1?.synergy || 0
      const rawP2Hp = data.player2?.synergy || 0
      const maxHP = Math.max(rawP1Hp, rawP2Hp, 100)
      const toPercent = (synergy) => Math.round((synergy / maxHP) * 100)

      setPlayer1Hp(toPercent(rawP1Hp))
      setPlayer2Hp(toPercent(rawP2Hp))

      // Current round
      const currentRoundData = data.player1?.currentRound || {}
      setCurrentRound((prev) => ({
        ...prev,
        [playerKey]: currentRoundData,
      }))

      // Reset selections
      setCardSelected(false)
      setSelectedAbility(null)
      setSelectedCard(
        currentRoundData.cardId ? { src: currentRoundData.cardPhotoSrc } : null
      )
      setPlayer2SelectedCard(
        data.player2?.currentRound?.cardId
          ? { src: data.player2.currentRound.cardPhotoSrc }
          : null
      )

      // Names & roles
      setPlayer1Name(data.player1?.userName || 'Player1')
      setPlayer2Name(data.player2?.userName || 'Player2')
      setPlayer1Role(data.player1?.currentRole || 'attack')
      setPlayer2Role(data.player2?.currentRole || 'defense')

      setIsPlayer1(true)

      if (data.currentPhase) setPhase(data.currentPhase)

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

      if (data.currentPhase) {
        setPhase(data.currentPhase)

        // Trigger announcement
        setPhaseAnnouncement(data.currentPhase)

        // Clear it after ~2s
        setTimeout(() => setPhaseAnnouncement(null), 2000)
      }

      // Used cards & abilities
      const previousRoundsObj = data.player1?.previousRounds || {}
      const previousRoundsArr = Object.values(previousRoundsObj)
      const currentRoundAbility = currentRoundData.abilitySelected || null
      const allUsedAbilities = [
        ...previousRoundsArr.map((r) => r.ability).filter(Boolean),
        currentRoundAbility,
      ]
      setUsedAbilities(allUsedAbilities)

      const usedCards = previousRoundsArr.map((r) => r.cardId).filter(Boolean)
      const usedAbilities = previousRoundsArr
        .map((r) => r.ability)
        .filter(Boolean)
      setPreviousRounds({ [playerKey]: previousRoundsObj })
      setUsedCardIds(usedCards)

      // Abilities selected this round

      const p1Ability = data.player1?.currentRound?.abilitySelected
      const p2Ability = data.player2?.currentRound?.abilitySelected

      const player1Role = data.player1?.currentRole || 'attack'
      const player2Role = data.player2?.currentRole || 'defense'

      // Initialize
      const abilityDecision = { attack: null, defense: null }

      // Both selected
      if (p1Ability && p2Ability) {
        // Assign defender first (animation runs on defender)
        if (player1Role === 'defense')
          abilityDecision.defense = { side: 'left', ability: p1Ability }
        if (player2Role === 'defense')
          abilityDecision.defense = { side: 'right', ability: p2Ability }

        // Then assign attacker
        if (player1Role === 'attack')
          abilityDecision.attack = { side: 'left', ability: p1Ability }
        if (player2Role === 'attack')
          abilityDecision.attack = { side: 'right', ability: p2Ability }

        // Only player1 selected
      } else if (p1Ability) {
        if (player1Role === 'attack')
          abilityDecision.attack = { side: 'left', ability: p1Ability }
        if (player1Role === 'defense')
          abilityDecision.defense = { side: 'left', ability: p1Ability }

        // Only player2 selected
      } else if (p2Ability) {
        if (player2Role === 'attack')
          abilityDecision.attack = { side: 'right', ability: p2Ability }
        if (player2Role === 'defense')
          abilityDecision.defense = { side: 'right', ability: p2Ability }

        // None selected → leave both null
      }

      setCurrentAbilityDecision(abilityDecision)
      console.log('⚡ Ability decision this round:', abilityDecision)
      if (data.currentPhase === PHASES.BATTLE) {
        runAnimation(abilityDecision)
      }

      // End of match
      if (
        data.currentPhase === 'finished' ||
        data.currentPhase === 'cancelled'
      ) {
        if (data.winnerId === userId) {
          setFinalResult('user')
          setShowFinishedModal(true)
          ;(async () => {
            const user = await getUserData()
            if (user && user.userId === userId) {
              const updatedUser = { ...user, coins: (user.coins || 0) + 30000 }
              await storeUserData(updatedUser)
              console.log('✅ Winner reward: +30,000 coins')
            }
          })()
        } else if (data.loserId === userId) {
          setFinalResult('bot')
          setShowFinishedModal(true)
        } else {
          setFinalResult('tie')
          setShowFinishedModal(true)
        }

        finishTimeout = setTimeout(() => {
          navigate('/tournament')
          setShowFinishedModal(false)
        }, 10000)
      }
    })

    return () => {
      off(matchRef)
      if (window._phaseTimer) clearInterval(window._phaseTimer)
      if (finishTimeout) clearTimeout(finishTimeout)
    }
  }, [matchID, userId])

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

  const handleCardClick = async (card) => {
    if (phase !== PHASES.SELECTION || cardSelected) return // block extra clicks

    try {
      const res = await fetch(
        `http://localhost:3000/api/battle/${matchID}/select-card`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            useId: userId,
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
        `http://localhost:3000/api/battle/${matchID}/select-ability`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userId, abilityKey }),
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

  const handleEndRound = async () => {
    console.log('End Round clicked')

    if (!matchID || !user?.userId) return

    try {
      const res = await fetch(
        `http://localhost:3000/api/battle/${matchID}/endTurn`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: user.userId }),
        }
      )

      const data = await res.json()

      if (data.success) {
        console.log('Turn ended successfully!')
        // Optionally, update local state to reflect player has ended turn
        // e.g., setPlayerEnded(true);
      } else {
        console.warn('Failed to end turn:', data.error)
      }
    } catch (err) {
      console.error('Failed to end turn:', err)
    }
  }

  const cancelMatch = async () => {
    if (!matchID || !user.userId) return

    try {
      await fetch(`http://localhost:3000/api/battle/${matchID}/cancelMatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: matchID, playerId: user.userId }),
      })

      console.log('Match cancelled, leaving tournament')
      localStorage.removeItem('currentMatchId')

      setTimeout(() => {
        navigate('/tournament')
      }, 10000)
    } catch (err) {
      console.error('Failed to cancel match:', err)
    }
  }

  // Animation Part

  const playAbility = async (abilityName, side) => {
    const config = abilityConfig[abilityName]
    if (!config) {
      console.warn(`⚠️ No config found for ability: ${abilityName}`)
      return
    }

    const wrapper = containerRef.current?.querySelector(`.summon-${side}`)
    if (!wrapper) return

    const playPart = async (storeKey) => {
      const frames = await fetchAbilityFrames(storeKey)
      if (!frames || frames.length === 0) {
        console.warn(`⚠️ No frames found for ${storeKey}`)
        return
      }

      let overlay = document.createElement('img')
      overlay.className = `ability-overlay ability-${storeKey.toLowerCase()} ability-${side}`
      overlay.style.position = 'absolute'
      overlay.style.top = '0'
      overlay.style.left = '0'
      //overlay.style.width = '100%'
      //overlay.style.height = '100%'
      overlay.style.zIndex = 5
      wrapper.appendChild(overlay)

      // Each part runs max 3s
      const totalDuration = 5000
      const frameDelay = totalDuration / frames.length

      for (let i = 0; i < frames.length; i++) {
        overlay.src = frames[i]
        await new Promise((res) => setTimeout(res, frameDelay))
      }

      wrapper.removeChild(overlay)
    }

    // Launch all parts with delay rules
    for (const part of config.parts) {
      setTimeout(() => {
        playPart(part.key)
      }, part.delay)
    }
  }

  const lastPlayedRef = useRef(null)

  const runAnimation = async (abilityDecision, round) => {
    if (!abilityDecision) return

    // Build a unique key (round + abilities)
    const decisionKey = `${round}-${abilityDecision.attack?.ability || 'none'}-${abilityDecision.defense?.ability || 'none'}`

    // Prevent re-running if already played
    if (lastPlayedRef.current === decisionKey) {
      console.log(`⏭️ Animation for round ${round} already played, skipping`)
      return
    }
    lastPlayedRef.current = decisionKey

    const { attack, defense } = abilityDecision

    // Case 1: Both selected
    if (attack && defense) {
      await playAbility(defense.ability, defense.side)
      await playAbility(attack.ability, defense.side)
    }
    // Case 2: Only attack
    else if (attack && !defense) {
      const targetSide = attack.side === 'left' ? 'right' : 'left'
      await playAbility(attack.ability, targetSide)
    }
    // Case 3: Only defense
    else if (!attack && defense) {
      await playAbility(defense.ability, defense.side)
    }
    // Case 4: Neither
    else {
      console.log('🚫 No animations this round')
    }
  }

  return (
    <div className="battle-container" ref={containerRef}>
      <div className="battle-header">
        {/* Left Player */}
        <div className="battle-header-left">
          <img src={user.photo_url} alt="Player Avatar" className="avatar" />
          <div className="player-info">
            <p className="player-name">
              {player1Name}{' '}
              {player1Role === 'attack' && (
                <span className="role-icon">⚔️</span>
              )}
              {player1Role === 'defense' && (
                <span className="role-icon">🛡️</span>
              )}
            </p>
            {/* <div className="hp-bar-container">
              <div className="hp-bar" style={{ width: `${player1Hp}%` }} />
            </div> */}
          </div>
        </div>

        <div className="timer-text">
          {remainingTime > 0 ? `${remainingTime}s` : ''}
        </div>

        {/* Right Player */}
        <div className="battle-header-right">
          <div className="player-info">
            <p className="player-name">
              {player2Role === 'attack' && (
                <span className="role-icon">⚔️</span>
              )}
              {player2Role === 'defense' && (
                <span className="role-icon">🛡️</span>
              )}
              {'    '}
              {'    '}
              {player2Name}
            </p>
            {/* <div className="hp-bar-container">
              <div className="hp-bar" style={{ width: `${player2Hp}%` }} />
            </div> */}
          </div>
          <img src="/assets/gameLogo.avif" className="avatar" />
        </div>
      </div>

      <div className="battle-area">
        {/* Left Player */}
        <div
          className="summon-wrapper summon-left"
          style={{ position: 'relative' }}
        >
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

        {/* Right Player */}
        <div
          className="summon-wrapper summon-right"
          style={{ position: 'relative' }}
        >
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

      {phaseAnnouncement && (
        <div className="phase-announcement">
          {phaseAnnouncement.toUpperCase()}
        </div>
      )}
    </div>
  )
}

export default Battle
