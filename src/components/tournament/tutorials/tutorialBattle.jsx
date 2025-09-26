import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import '../style/battle.css'
import botNames from './gameUtils/botName.json'
import { getUserData, storeUserData } from '../../../utils/indexedDBService'

import cardHolder from '/assets/gameLogo.avif'
import summonLeft from '../assets/leftSummon.png'
import summonRight from '../assets/rightSummon.png'

import endBattleBtn from '../assets/endBattleBtn.png'
import endRoundBtn from '../assets/endRoundBtn.png'

import {
  getCurrentPhase,
  getCurrentRound,
  PHASES,
  ROUND_DURATION_MS,
  ROUND_TOTAL_TIME,
  MATCH_TOTAL_TIME,
  selectRandomCard,
  manualEndRound,
  handleCardSelection,
  logCurrentRoundSelections,
  roundDataStore,
  initializeMatchStore,
} from './gameUtils/gameLogic'

import { ABILITIES, abilityWeights, abilityConfig } from './gameUtils/abilites'

import CachedImage from '../../shared/CachedImage'

const roundStore = {}
const TOTAL_ROUNDS = 5
const BattleTutorial = ({ user }) => {
  const { matchID } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [phase, setPhase] = useState(PHASES.COOLDOWN)
  const [remainingTime, setRemainingTime] = useState(0)
  const [selectedCard, setSelectedCard] = useState(null)
  const [botSelectedCard, setBotSelectedCard] = useState(null)
  const [showFinishedModal, setShowFinishedModal] = useState(false)
  const [totalSynergy, setTotalSynergy] = useState({ user: 0, bot: 0 })
  const [finalResult, setFinalResult] = useState(null)
  const [botName, setBotName] = useState('user123')
  const containerRef = useRef(null)
  const intervalRef = useRef(null)
  const [showAbilityPopup, setShowAbilityPopup] = useState(false)
  const [selectedAbility, setSelectedAbility] = useState(null)
  const [usedAbilities, setUsedAbilities] = useState([])
  const [usedCards, setUsedCards] = useState([])

  const player1Role = match?.player1Role || 'attack' // Default to 'attack' if undefined
  const phaseBadges = {
    [PHASES.COOLDOWN]: '/new/battle/assets/phase/cooldown.png',
    [PHASES.SELECTION]: '/new/battle/assets/phase/selection.png',
    [PHASES.BATTLE]: '/new/battle/assets/phase/battle.png',
    [PHASES.CANCELLED]: '/new/battle/assets/phase/cancelled.png',
    [PHASES.FINISHED]: '/new/battle/assets/phase/finished.png',
  }
  useEffect(() => {
    if (!match) return

    if (!roundDataStore[matchID]) {
      roundDataStore[matchID] = {
        rounds: Array(TOTAL_ROUNDS)
          .fill(null)
          .map(() => ({
            userCard: null,
            botCard: null,
            userAbility: null,
            botAbility: null,
            usedCards: [], // ✅ initialize here
          })),
        totalSynergy: { user: 0, bot: 0 },
        botTimer: Array(TOTAL_ROUNDS).fill(null),
        botDeck: match.player1Deck || [],
        usedCardsGlobal: [],
      }
    }
  }, [match])

  useEffect(() => {
    const matchData = localStorage.getItem(`match-${matchID}`)
    if (matchData) {
      const parsed = JSON.parse(matchData)
      if (parsed.cancelled) navigate('/tournament')
      else setMatch(parsed)
    } else {
      navigate('/tournament')
    }
  }, [matchID])

  useEffect(() => {
    if (!match?.startTime) return
    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const elapsed = now - match.startTime

      const currentPhase = getCurrentPhase(match.startTime)
      setPhase(currentPhase)

      let remaining = 0

      if (elapsed < ROUND_DURATION_MS.COOLDOWN) {
        // First 5s = cooldown
        remaining = Math.ceil((ROUND_DURATION_MS.COOLDOWN - elapsed) / 1000)
      } else {
        const postCooldownElapsed = elapsed - ROUND_DURATION_MS.COOLDOWN
        const roundTime = postCooldownElapsed % ROUND_TOTAL_TIME

        if (roundTime < ROUND_DURATION_MS.SELECTION) {
          remaining = Math.ceil(
            (ROUND_DURATION_MS.SELECTION - roundTime) / 1000
          )
        } else {
          remaining = Math.ceil(
            (ROUND_DURATION_MS.SELECTION +
              ROUND_DURATION_MS.BATTLE -
              roundTime) /
              1000
          )
        }
      }

      setRemainingTime(remaining)

      if (elapsed > MATCH_TOTAL_TIME) {
        setPhase(PHASES.FINISHED)
        setShowFinishedModal(true)
        clearInterval(intervalRef.current)
        setTimeout(async () => {
          localStorage.removeItem(`match-${matchID}`)
          navigate('/tournament')
        }, 10000)
      }
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [match?.startTime])

  const cancelMatch = () => {
    clearInterval(intervalRef.current)

    const updatedMatch = {
      ...match,
      cancelled: true,
      cancelledAt: Date.now(),
      phase: PHASES.CANCELLED,
    }

    localStorage.setItem(`match-${matchID}`, JSON.stringify(updatedMatch))
    setMatch(updatedMatch)
    setPhase(PHASES.CANCELLED)

    setTimeout(() => {
      localStorage.removeItem(`match-${matchID}`)
      navigate('/tournament')

      // ⬇️ Show ad after navigating
    }, 1500)
  }

  useEffect(() => {
    if (botNames?.length > 0) {
      const random = botNames[Math.floor(Math.random() * botNames.length)]
      setBotName(random)
    }
  }, [])

  const handleCardClick = (card) => {
    const round = Math.min(getCurrentRound(match.startTime), TOTAL_ROUNDS - 1)
    const store = roundDataStore[matchID]
    if (!store) return console.error('Match store not initialized')

    const roundData = store.rounds[round]
    if (!roundData) return console.error('Round data not initialized')

    if (!roundData.usedCards) roundData.usedCards = []

    const cardKey = card.cardID

    // ❌ Check if card was used in THIS round
    if (roundData.usedCards.includes(cardKey)) {
      alert('You have already used this card in this round!')
      return
    }

    // ❌ Check if card was used in ANY previous round of this match
    if (store.usedCardsGlobal.includes(cardKey)) {
      alert('You have already used this card in this match!')
      return
    }

    // Save card
    roundData.userCard = card
    roundData.usedCards.push(cardKey)
    store.usedCardsGlobal.push(cardKey) // ✅ add to global used list

    setSelectedCard(card)
    setUsedCards((prev) => [...prev, cardKey])

    handleCardSelection(matchID, card, 'user')

    setTotalSynergy((prev) => ({
      ...prev,
      user: prev.user + (card.synergy || 0),
    }))

    setShowAbilityPopup(true)
  }

  const handleAbilityClick = (abilityKey) => {
    if (phase !== PHASES.SELECTION || !selectedCard) return
    if (!match) return console.error('No match available')

    const round = getCurrentRound(match.startTime)

    // Save ability in round store
    if (!roundStore[matchID].rounds[round])
      roundStore[matchID].rounds[round] = {}
    roundStore[matchID].rounds[round].userAbility = abilityKey

    // Update selectedAbility for UI & disable used abilities
    setSelectedAbility(abilityKey)
    setUsedAbilities((prev) => [...prev, abilityKey])

    // Map UI key to abilityConfig key
    // Map UI key to abilityConfig key using displayName
    const configKey = Object.keys(abilityConfig).find(
      (k) => abilityConfig[k].displayName === abilityKey
    )

    if (!configKey)
      return console.warn('Ability not found in abilityConfig:', abilityKey)

    // Calculate synergy from weights
    const weights = abilityWeights[configKey] || {}
    const abilitySynergy = Object.values(weights).reduce((a, b) => a + b, 0)

    setTotalSynergy((prev) => ({
      ...prev,
      user: prev.user + abilitySynergy,
    }))

    // Close popup
    setShowAbilityPopup(false)
  }

  useEffect(() => {
    if (phase === PHASES.SELECTION) {
      const round = getCurrentRound(match.startTime)
      setSelectedCard(null)
      setBotSelectedCard(null)
      setUsedCards(roundDataStore[matchID].rounds[round].usedCards || [])
      if (!roundStore[matchID]) roundStore[matchID] = { rounds: [] }
      if (!roundStore[matchID].rounds[round])
        roundStore[matchID].rounds[round] = {}

      const botAlreadyPlayed = roundStore[matchID].rounds[round].botCard
      roundStore[matchID].rounds[round].botEndedRound = true

      if (!botAlreadyPlayed) {
        const delay = 2000 + Math.floor(Math.random() * 3000)
        setTimeout(() => {
          const botCard = selectRandomCard(match.player1Deck)
          roundStore[matchID].rounds[round].botCard = botCard
          setBotSelectedCard(botCard)

          // Update synergy for the bot
          setTotalSynergy((prev) => {
            const updated = { ...prev, bot: prev.bot + (botCard.synergy || 0) }
            return updated
          })
        }, delay)
      }
    }
  }, [phase, match?.startTime])

  useEffect(() => {
    if (phase !== PHASES.FINISHED || !user?.userId) return

    const rounds = roundStore[matchID]?.rounds || []
    let finalUserSynergy = 0
    let finalBotSynergy = 0

    for (const r of rounds) {
      finalUserSynergy += r.userCard?.synergy || 0
      finalBotSynergy += r.botCard?.synergy || 0
    }

    console.log(
      '🏁 Final Totals — User:',
      finalUserSynergy,
      'Bot:',
      finalBotSynergy
    )

    let result = 'tie'
    let rewardCoins = 5000

    if (finalUserSynergy > finalBotSynergy) {
      console.log('🎉 Final Result: User wins! (right-to-left animation)')
      result = 'user'
      rewardCoins = 10000
    } else if (finalBotSynergy > finalUserSynergy) {
      console.log('🤖 Final Result: Bot wins! (left-to-right animation)')
      result = 'bot'
      rewardCoins = 0
    } else {
      console.log('⚖️ Final Result: Tie!')
    }

    setFinalResult(result)

    if (rewardCoins > 0) {
      // Use your indexedDBService functions here:
      getUserData(user.userId)
        .then((data) => {
          const currentCoins = data?.coins || 0
          return storeUserData(user.userId, currentCoins + rewardCoins)
        })
        .then(() => {
          console.log(`✅ ${rewardCoins} coins awarded to user locally.`)
        })
        .catch((err) => {
          console.error('❌ Error updating local coins:', err)
        })
    }
  }, [phase])

  useEffect(() => {
    if (phase === PHASES.BATTLE) {
      if (!roundDataStore[matchID]) {
        console.warn(
          'No match store found, creating temporary store for',
          matchID
        )
        initializeMatchStore(
          matchID,
          match?.player1Deck || [],
          match?.player1Deck || []
        )
      }
      logCurrentRoundSelections(matchID)
    }
  }, [phase, matchID])

  if (!match) return <div>Loading battle...</div>

  return (
    <div className="battle-container" ref={containerRef}>
      <div className="battle-header">
        <div className="battle-header-left">
          <img
            src="/assets/gameLogo.avif"
            alt="Player Avatar"
            className="avatar"
          />
          <p>{match.playerName}</p>
        </div>
        <div className="battle-header-center">
          <p className="battle-timer">{remainingTime}s</p>
        </div>
        <div className="battle-header-right">
          <p>{botName}</p>
          <img src="/assets/gameLogo.avif" className="avatar" />
        </div>
      </div>

      <div className="battle-area">
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

        <div
          className="summon-wrapper summon-right"
          style={{ position: 'relative' }}
        >
          <img
            src={botSelectedCard ? botSelectedCard.src : cardHolder}
            className="card-img"
            style={{ marginLeft: '10px' }}
          />
          <div className="glow-perspective">
            <img
              src={summonRight}
              alt="Summon Ring Right"
              className="summon-img glow-blue tilt-up"
            />
          </div>
        </div>
      </div>

      <div className="deck-section">
        {match.player1Deck.map((card, i) => {
          const store = roundDataStore[matchID]
          const isUsedGlobal = store?.usedCardsGlobal?.includes(card.cardID)
          const isDisabled = phase !== PHASES.SELECTION || isUsedGlobal

          return (
            <img
              key={i}
              src={card.src}
              alt={`Card ${i + 1}`}
              className={`deck-card ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && handleCardClick(card)}
              style={{
                opacity: isDisabled ? 0.4 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            />
          )
        })}
      </div>

      <div className="battle-footer">
        <CachedImage
          src={endBattleBtn}
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
          src={endRoundBtn}
          alt="End Round Button"
          className="footer-btn"
        />
      </div>

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
              style={{ marginTop: '10px' }}
            >
              Earn 10K Coins
            </button>
          </div>
        </div>
      )}

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
    </div>
  )
}

export default BattleTutorial
