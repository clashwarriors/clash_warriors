import { useParams, useNavigate } from 'react-router-dom'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { ref, onValue, off, update } from 'firebase/database'
import { showRewardedInterstitialAd10K } from './utils/adsUtility'
import './style/battle.css'
import { getUserDeck, getCards } from '../../utils/indexedDBService'
import cardHolder from '/assets/gameLogo.avif'
import summonLeft from './assets/leftSummon.png'
import summonRight from './assets/rightSummon.png'
import { realtimeDB } from '../../firebase'
import { getUserData, storeUserData } from '../../utils/indexedDBService'
import { PHASES, PHASE_TIMERS, ABILITIES } from './utils/battleModifiers'
import {
  fetchAbilityFrames,
  fetchSoundEffects,
} from '../../utils/AnimationUtility'
import { abilityConfig } from './weights/abilites'
import Joyride from 'react-joyride'
import { triggerHapticFeedback } from '../tournament/utils/haptic'
import PlayerHeader from './battleComp/BattleHeader'
import DeckSection from './battleComp/DeckSection'
import BattleFooter from './battleComp/BattleFooter'
import AbilityPopup from './battleComp/AbilityPopup'
import FinishedModal from './battleComp/FinishedModal'
import PhaseAnnouncement from './battleComp/PhaseAnnouncement'
import BattleArea from './battleComp/BattleArea'
import { rewardUserAd } from '../../utils/adsUtility'

const MemoizedPlayerHeader = React.memo(PlayerHeader)
const MemoizedBattleArea = React.memo(BattleArea)
const MemoizedDeckSection = React.memo(DeckSection)
const MemoizedBattleFooter = React.memo(BattleFooter)
const MemoizedAbilityPopup = React.memo(AbilityPopup)
const MemoizedFinishedModal = React.memo(FinishedModal)
const MemoizedPhaseAnnouncement = React.memo(PhaseAnnouncement)

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
  const [player1DP, setPlayer1DP] = useState(cardHolder)
  const [player2DP, setPlayer2DP] = useState(cardHolder)
  const [showAbilityPopup, setShowAbilityPopup] = useState(false)
  const [selectedAbility, setSelectedAbility] = useState(null)
  const [finalResult, setFinalResult] = useState(null)
  const [playerDeck, setPlayerDeck] = useState([])
  const [player1Hp, setPlayer1Hp] = useState(0)
  const [player2Hp, setPlayer2Hp] = useState(0)
  const rawP1Synergy = match?.player1?.currentSynergy || 100
  const rawP2Synergy = match?.player2?.currentSynergy || 100
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
  const [botDeckUploaded, setBotDeckUploaded] = useState(false)
  const [currentRoundNumber, setCurrentRoundNumber] = useState(0)
  const [currentAbilityDecision, setCurrentAbilityDecision] = useState({
    attack: null,
    defense: null,
  })
  const containerRef = useRef(null)
  const intervalRef = useRef(null)
  const finishTimeoutRef = useRef(null)

  const botDeckUploadedRef = useRef(false)

  const phaseBadges = {
    [PHASES.COOLDOWN]: '/new/battle/assets/phase/cooldown.png',
    [PHASES.SELECTION]: '/new/battle/assets/phase/selection.png',
    [PHASES.BATTLE]: '/new/battle/assets/phase/battle.png',
    [PHASES.CANCELLED]: '/new/battle/assets/phase/cancelled.png',
  }

  const [runTutorial, setRunTutorial] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [steps, setSteps] = useState([])
  //for tutorial
  const [tutRound, setTutRound] = useState(0)
  const [tutPhase, setTutPhase] = useState(0)

  const backend = import.meta.env.VITE_API_BASE_URL
  //const backend = 'http://localhost:3000'

  useEffect(() => {
    if (!matchID || !userId) return

    const matchRef = ref(realtimeDB, `ongoingBattles/${matchID}`)
    let finishTimeout = null

    const unsubscribe = onValue(matchRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) return console.log('No match data found in Realtime DB')

      setMatch(data)

      // Round Number

      const currentRoundNumber = data.round || 0
      setCurrentRoundNumber(currentRoundNumber)
      const tutRound = data.numericRound || 0
      setTutRound(tutRound)

      // ✅ Determine if current user is player1 or player2
      const isUserPlayer1 = data.player1?.userId === userId

      if (isUserPlayer1) {
        // Self on left
        setPlayer1Name(data.player1?.userName || 'Player1')
        setPlayer2Name(data.player2?.userName || 'Player2')
        setPlayer1Role(data.player1?.currentRole || 'attack')
        setPlayer2Role(data.player2?.currentRole || 'defense')
        setPlayer1DP(data.player1?.photoDP || cardHolder)
        setPlayer2DP(data.player2?.photoDP || cardHolder)
        setIsPlayer1(true)
      } else {
        // Self is player2 → swap sides
        setPlayer1Name(data.player2?.userName || 'Player1')
        setPlayer2Name(data.player1?.userName || 'Player2')
        setPlayer1Role(data.player2?.currentRole || 'attack')
        setPlayer2Role(data.player1?.currentRole || 'defense')
        setPlayer1DP(data.player2?.photoDP || cardHolder)
        setPlayer2DP(data.player1?.photoDP || cardHolder)
        setIsPlayer1(false)
      }

      // HP logic
      const rawP1Synergy = data.player1?.synergy || 0
      const rawP2Synergy = data.player2?.synergy || 0

      // reference synergy (max or initial)
      const referenceSynergy =
        data.maxSynergy ||
        Math.max(
          data.player1?.initialSynergy || rawP1Synergy,
          data.player2?.initialSynergy || rawP2Synergy
        ) ||
        1 // prevent division by zero

      // Compute percentages
      const p1Percent = Math.round((rawP1Synergy / referenceSynergy) * 100)
      const p2Percent = Math.round((rawP2Synergy / referenceSynergy) * 100)

      // ✅ Assign HP based on which side the logged-in user is
      if (isUserPlayer1) {
        setPlayer1Hp(p1Percent) // user = player1 in DB
        setPlayer2Hp(p2Percent)
      } else {
        setPlayer1Hp(p2Percent) // user = player2 in DB → show their HP on left
        setPlayer2Hp(p1Percent)
      }

      // Current round (always store left-side player’s round)
      const currentRoundData = isUserPlayer1
        ? data.player1?.currentRound || {}
        : data.player2?.currentRound || {}
      setCurrentRound((prev) => ({
        ...prev,
        player1: currentRoundData,
      }))

      // Reset selections
      setCardSelected(false)
      setSelectedAbility(null)
      setSelectedCard(
        currentRoundData.cardId ? { src: currentRoundData.cardPhotoSrc } : null
      )
      setPlayer2SelectedCard(
        (isUserPlayer1 ? data.player2 : data.player1)?.currentRound?.cardId
          ? {
              src: (isUserPlayer1 ? data.player2 : data.player1).currentRound
                .cardPhotoSrc,
            }
          : null
      )

      if (data.currentPhase) setPhase(data.currentPhase)

      // Timer
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

      // Phase announcement
      if (data.currentPhase) {
        setPhase(data.currentPhase)
        setPhaseAnnouncement(data.currentPhase)
        setTimeout(() => setPhaseAnnouncement(null), 2000)
      }

      // Previous rounds & abilities
      const prevRoundsObj =
        (isUserPlayer1 ? data.player1 : data.player2)?.previousRounds || {}
      const prevRoundsArr = Object.values(prevRoundsObj)

      const currentRoundAbility = currentRoundData.abilitySelected || null
      const allUsedAbilities = [
        ...prevRoundsArr.map((r) => r.ability).filter(Boolean),
        currentRoundAbility,
      ]
      setUsedAbilities(allUsedAbilities)

      const usedCards = prevRoundsArr.map((r) => r.cardId).filter(Boolean)
      setPreviousRounds({ player1: prevRoundsObj })
      setUsedCardIds(usedCards)

      // Abilities selected this round
      const p1Ability = data.player1?.currentRound?.abilitySelected
      const p2Ability = data.player2?.currentRound?.abilitySelected
      const p1Role = data.player1?.currentRole || 'attack'
      const p2Role = data.player2?.currentRole || 'defense'

      const abilityDecision = { attack: null, defense: null }
      if (p1Ability && p2Ability) {
        if (p1Role === 'defense')
          abilityDecision.defense = {
            side: isUserPlayer1 ? 'left' : 'right',
            ability: p1Ability,
          }
        if (p2Role === 'defense')
          abilityDecision.defense = {
            side: isUserPlayer1 ? 'right' : 'left',
            ability: p2Ability,
          }
        if (p1Role === 'attack')
          abilityDecision.attack = {
            side: isUserPlayer1 ? 'left' : 'right',
            ability: p1Ability,
          }
        if (p2Role === 'attack')
          abilityDecision.attack = {
            side: isUserPlayer1 ? 'right' : 'left',
            ability: p2Ability,
          }
      } else if (p1Ability) {
        if (p1Role === 'attack')
          abilityDecision.attack = {
            side: isUserPlayer1 ? 'left' : 'right',
            ability: p1Ability,
          }
        if (p1Role === 'defense')
          abilityDecision.defense = {
            side: isUserPlayer1 ? 'left' : 'right',
            ability: p1Ability,
          }
      } else if (p2Ability) {
        if (p2Role === 'attack')
          abilityDecision.attack = {
            side: isUserPlayer1 ? 'right' : 'left',
            ability: p2Ability,
          }
        if (p2Role === 'defense')
          abilityDecision.defense = {
            side: isUserPlayer1 ? 'right' : 'left',
            ability: p2Ability,
          }
      }

      setCurrentAbilityDecision(abilityDecision)
      console.log('⚡ Ability decision this round:', abilityDecision)
      if (data.currentPhase === PHASES.BATTLE) {
        lastPlayedRef.current = null

        runAnimation(abilityDecision, tutRound)
        setShowAbilityPopup(false)
      }

      playSound(abilityDecision, data.currentPhase)

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

        setPlayer1DP(null)
        setPlayer2DP(null)
        setSelectedCard(null)
        setPlayer2SelectedCard(null)

        finishTimeout = setTimeout(async () => {
          try {
            await rewardUserAd() // run ad reward first
          } catch (err) {
            console.error('Failed to run ad reward:', err)
          }

          setShowFinishedModal(false)
          navigate('/tournament')
        }, 10000)
      }
    })

    return () => {
      off(matchRef)
      if (window._phaseTimer) clearInterval(window._phaseTimer)
      if (finishTimeoutRef.current) {
        clearTimeout(finishTimeoutRef.current)
        finishTimeoutRef.current = null
      }
    }
  }, [matchID, userId])

  useEffect(() => {
    if (!matchID || !match || botDeckUploadedRef.current) return

    const fetchDefaultDeck = async () => {
      try {
        // 1️⃣ Get all cards and user deck
        const allCards = await getCards()
        const deckData = await getUserDeck('default') // { deckId, cards: [], totalSynergy }

        // 2️⃣ Map deck cardIds to actual card objects
        const defaultDeckCards = deckData.cards
          .map((id) => allCards.find((c) => c.cardId === id))
          .filter(Boolean) // remove missing cards
          .slice(0, 10) // ensure max 10 cards

        setPlayerDeck(defaultDeckCards)

        // 3️⃣ Prepare minimal deck for bot
        const minimalDeck = defaultDeckCards.map((card) => ({
          cardId: card.cardId,
          cardPhotoSrc: card.photo || card.image,
          stats: card.stats || {},
        }))

        // 4️⃣ Upload to AI if needed
        let botRef = null
        if (match.player1?.userId.startsWith('AIBOTPLAYER_')) {
          botRef = ref(realtimeDB, `ongoingBattles/${matchID}/player1`)
        } else if (match.player2?.userId.startsWith('AIBOTPLAYER_')) {
          botRef = ref(realtimeDB, `ongoingBattles/${matchID}/player2`)
        }

        if (botRef) {
          await update(botRef, { availableCards: minimalDeck })
          console.log('Uploaded deck to AI')
          botDeckUploadedRef.current = true
        }
      } catch (err) {
        console.error('❌ Failed to fetch cards or upload to AI:', err)
      }
    }

    fetchDefaultDeck()
  }, [matchID, match])

  const handleCardClick = useCallback(
    async (card) => {
      triggerHapticFeedback()
      if (phase !== PHASES.SELECTION || cardSelected) return

      try {
        const res = await fetch(
          `${backend}/api/battle/${matchID}/select-card`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: userId,
              cardId: card.cardId,
              photo: card.photo || card.image,
              stats: card.stats,
            }),
          }
        )

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to select card')

        console.log('Card selected successfully:', data)
        setShowAbilityPopup(true)
        setCardSelected(true)
      } catch (err) {
        console.error('Failed to select card:', err)
      }
    },
    [phase, cardSelected, backend, matchID, userId]
  )

  const handleAbilityClick = useCallback(
    async (abilityKey) => {
      triggerHapticFeedback()
      if (phase !== PHASES.SELECTION) return
      if (!match || !userId)
        return console.error('No match or userId available')

      try {
        const isPlayer1 = match.player1.playerId === userId
        const playerKey = isPlayer1 ? 'player1' : 'player2'

        const res = await fetch(
          `${backend}/api/battle/${matchID}/select-ability`,
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
    },
    [phase, match, userId, backend, matchID]
  )

  const handleEndRound = useCallback(async () => {
    triggerHapticFeedback()
    console.log('End Round clicked')

    if (!matchID || !user?.userId) return

    try {
      const res = await fetch(`${backend}/api/battle/${matchID}/endTurn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: user.userId }),
      })

      const data = await res.json()

      if (data.success) {
        console.log('Turn ended successfully!')
        // e.g., setPlayerEnded(true);
      } else {
        console.warn('Failed to end turn:', data.error)
      }
    } catch (err) {
      console.error('Failed to end turn:', err)
    }
  }, [matchID, user?.userId, backend])

  const cancelMatch = useCallback(async () => {
    triggerHapticFeedback()
    if (!matchID || !user?.userId) return

    try {
      await fetch(`${backend}/api/battle/${matchID}/cancelMatch`, {
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
  }, [matchID, user?.userId, backend, navigate])

  // Animation Part

  const playAbility = async (abilityName, side) => {
    const config = Object.values(abilityConfig).find(
      (c) => c.displayName === abilityName
    )
    if (!config) {
      //console.warn(`⚠️ No config found for ability: ${abilityName}`)
      return
    }

    const wrapper = containerRef.current?.querySelector(`.summon-${side}`)
    if (!wrapper) return

    const playPart = async (storeKey) => {
      const frames = await fetchAbilityFrames(storeKey)
      if (!frames || frames.length === 0) {
        //console.warn(`⚠️ No frames found for ${storeKey}`)
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
      //console.log(`⏭️ Animation for round ${round} already played, skipping`)
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

  // Play Sounds

  // Canonical ability names
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

  // Map abilities to sound keys
  const attackAbilities = {
    [ABILITIES.BERSERKERS_FURY]: 'berserkersFury',
    [ABILITIES.FURY_UNLEASHED]: 'furyUnleashed',
    [ABILITIES.MINDWRAP]: 'mindWrap',
    [ABILITIES.SOUL_LEECH]: 'soulLeech',
    [ABILITIES.TITAN_STRIKE]: 'titanStrike',
    [ABILITIES.TWIN_STRIKE]: 'twinStrike',
  }

  const defenseAbilities = {
    [ABILITIES.ARCANE_OVERCHARGE]: 'arcaneOvercharge',
    [ABILITIES.AEGIS_WARD]: 'aegisWard',
    [ABILITIES.CELESTIAL_REJUVENATION]: 'celestialRejuvenation',
    [ABILITIES.GUARDIANS_BULWARK]: 'guardianBulwark',
  }

  // Track all active Audio objects
  const activeSoundsRef = useRef([])

  const playSound = (abilityDecision, currentPhase) => {
    if (!abilityDecision) return
    const { attack, defense } = abilityDecision

    console.log('🔊 PlaySound triggered!', { currentPhase, abilityDecision })

    // ----- SELECTION PHASE -----
    if (currentPhase === PHASES.SELECTION) {
      fetchSoundEffects.stopAll() // stop all ongoing battle sounds

      // Play defense sound during selection (no auto-stop)
      if (defense && defenseAbilities[defense.ability]) {
        const soundKey = defenseAbilities[defense.ability]
        fetchSoundEffects.play(soundKey).then((audio) => {
          if (!audio) return
          audio.volume = 0.5
          activeSoundsRef.current.push(audio)
        })
      }

      return
    }

    // ----- BATTLE PHASE -----
    if (currentPhase === PHASES.BATTLE) {
      fetchSoundEffects.stopAll() // stop any existing battle sounds

      // ---- Defense Sound ----
      if (defense && defenseAbilities[defense.ability]) {
        const soundKey = defenseAbilities[defense.ability]
        fetchSoundEffects.play(soundKey, 5000).then((audio) => {
          if (!audio) return
          audio.volume = 0.5
          activeSoundsRef.current.push(audio)
        })
      }

      // ---- Attack Sound ----
      if (attack && attackAbilities[attack.ability]) {
        const soundKey = attackAbilities[attack.ability]
        fetchSoundEffects.play(soundKey, 5000).then((audio) => {
          if (!audio) return
          audio.volume = 0.5
          activeSoundsRef.current.push(audio)
        })
      }
    }
  }

  // tutorial

  const cooldownSteps = [
    {
      id: 1,
      target: '.phase-badge',
      content: (
        <div>
          <strong>Phase Badge:</strong> <br />
          This mystical emblem shows the <em>current phase</em> of the battle.{' '}
          <br />
          Now we are in the <strong>Cooldown Phase</strong>, where warriors
          regain their strength.
        </div>
      ),
      disableBeacon: true,
      duration: 4000,
      showCloseButton: false,
    },
    {
      id: 2,
      target: '.timer-text',
      content: (
        <div>
          <strong>Cooldown Timer:</strong> <br />
          Watch the sands of time carefully; the next round begins when it runs
          out!
        </div>
      ),
      disableBeacon: true,
      duration: 3000,
      showCloseButton: false,
    },
    {
      id: 3,
      target: '.role-badge.left',
      content: (
        <div>
          <strong>
            Your Role Badge:{' '}
            {player1Role === 'attack' ? 'Attack ⚔️' : 'Defence 🛡️'}
          </strong>{' '}
          <br />
          This shows your mystical role for this round: <em>{player1Role}</em>
        </div>
      ),
      disableBeacon: true,
      duration: 3000,
      showCloseButton: false,
    },
    {
      id: 4,
      target: '.role-badge.right',
      content: (
        <div>
          <strong>
            Opponent’s Role:{' '}
            {player2Role === 'attack' ? 'Attack ⚔️' : 'Defence 🛡️'}
          </strong>{' '}
          <br />
          Observe your foe’s role carefully; anticipate their next move!
        </div>
      ),
      disableBeacon: true,
      duration: 3000,
      showCloseButton: false,
    },
    {
      id: 5,
      target: '.synergy-bar',
      content: (
        <div>
          <strong>Synergy Bar:</strong> <br />
          This magical gauge shows your remaining HP and energy for abilities
          this round.
        </div>
      ),
      disableBeacon: true,
      duration: 3000,
      showCloseButton: false,
    },
  ]

  const selection1Steps = [
    {
      id: 1,
      target: '.phase-badge',
      content: (
        <div>
          <strong>Phase Badge:</strong> <br />
          You have entered the <strong>Selection Phase</strong>! <br />
          Here, you choose your card for the upcoming battle. Choose wisely,
          brave warrior!
        </div>
      ),
      disableBeacon: true,
      duration: 3000,
      showNextButton: false,
      showCloseButton: false,
    },
    {
      id: 2,
      target: '.deck-section',
      content: (
        <div>
          <strong>Deck Section:</strong> <br />
          Behold your deck of mystical warriors! They are your allies. Each
          warrior carries unique powers.
        </div>
      ),
      disableBeacon: true,
      duration: 5000,
      showCloseButton: false,
    },
    {
      id: 3,
      target: '.deck-card', // highlights the first card
      content: (
        <div>
          <strong>Select Your First Warriors ⚔️</strong> <br />
          Click this warrior to choose your champion for the round. Only one can
          be chosen!
        </div>
      ),
      disableBeacon: true,
      spotlightClicks: true, // user must click to proceed
      showNextButton: false, // hides next button
      duration: 5000,
      showCloseButton: false,
    },
    {
      id: 4,
      target: '.ability-popup',
      content: (
        <div>
          <strong>
            Ability for {player1Role === 'attack' ? 'Attack ⚔️' : 'Defence 🛡️'}
          </strong>{' '}
          <br />
          This is the magical popup that appears when you choose a warrior.{' '}
          <br />
          Here, you select a special ability to empower your champion for the
          round.
        </div>
      ),
      disableBeacon: true,
      spotlightClicks: true, // user must click to proceed
      showNextButton: false, // hides next button
      duration: 5000,
      showCloseButton: false,
    },
    {
      id: 5,
      target: '.footer-btn.end-round-btn',
      content: (
        <div>
          <strong>End Round Button:</strong> <br />
          Once you have chosen your warrior and ability, click this button to
          lock in your choices and prepare for battle!
        </div>
      ),
      disableBeacon: true,
      duration: 4000,
      spotlightClicks: true, // user must click to proceed
      showNextButton: false,
      showCloseButton: false,
    },
  ]

  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorialCompleted')
    if (tutorialCompleted) {
      setRunTutorial(false)
      setStepIndex(-1)
      return
    }

    if (tutRound === 0) {
      if (phase === 'cooldown') setSteps(cooldownSteps)
      else if (phase === 'selection') setSteps(selection1Steps)

      setRunTutorial(phase === 'cooldown' || phase === 'selection')
      setStepIndex(0) // start from first step
    } else {
      setRunTutorial(false)
      setStepIndex(-1)
    }
  }, [tutRound, phase])

  useEffect(() => {
    if (!runTutorial || stepIndex < 0 || stepIndex >= steps.length) return

    const timer = setTimeout(() => {
      const nextStep = stepIndex + 1

      if (nextStep >= steps.length) {
        // Tutorial finished
        localStorage.setItem('tutorialCompleted', 'true')
        console.log('Tutorial completed, flag set')

        setRunTutorial(false)
        setStepIndex(-1)
      } else {
        setStepIndex(nextStep)
      }
    }, steps[stepIndex].duration)

    return () => clearTimeout(timer)
  }, [stepIndex, runTutorial, steps])

  useEffect(() => {
    // Step 3 = first card selection
    if (runTutorial && stepIndex === 2) {
      const firstCard = playerDeck[0] // assuming playerDeck array
      if (!cardSelected && firstCard) {
        const autoSelectTimer = setTimeout(() => {
          handleCardClick(firstCard) // auto-click
          setStepIndex((prev) => prev + 1) // move tutorial forward
        }, 5000) // 5s delay

        return () => clearTimeout(autoSelectTimer)
      }
    }
  }, [stepIndex, runTutorial, cardSelected])

  return (
    <div className="battle-container" ref={containerRef}>
      {match && phase !== 'finished' && phase !== 'cancelled' && (
        <>
          <div className="battle-header">
            <MemoizedPlayerHeader
              name={player1Name}
              role={player1Role}
              dp={player1DP}
              hp={player1Hp}
              side="left"
            />

            <div className="timer-text">
              {remainingTime > 0 ? `${remainingTime}s` : ''}
            </div>

            <MemoizedPlayerHeader
              name={player2Name}
              role={player2Role}
              dp={player2DP}
              hp={player2Hp}
              side="right"
            />
          </div>

          <MemoizedBattleArea
            selectedCard={selectedCard}
            player2SelectedCard={player2SelectedCard}
            cardHolder={cardHolder}
            summonLeft={summonLeft}
            summonRight={summonRight}
          />

          <MemoizedDeckSection
            playerDeck={playerDeck}
            usedCardIds={usedCardIds}
            currentRound={currentRound}
            isPlayer1={isPlayer1}
            phase={phase}
            handleCardClick={handleCardClick}
          />

          <MemoizedBattleFooter
            cancelMatch={cancelMatch}
            handleEndRound={handleEndRound}
            phase={phase}
            phaseBadges={phaseBadges}
            selectedCard={selectedCard}
            selectedAbility={selectedAbility}
          />

          <MemoizedAbilityPopup
            show={showAbilityPopup}
            playerRole={player1Role}
            selectedAbility={selectedAbility}
            usedAbilities={usedAbilities}
            handleAbilityClick={handleAbilityClick}
            ABILITIES={ABILITIES}
          />

          <MemoizedPhaseAnnouncement text={phaseAnnouncement} />
        </>
      )}
      {showFinishedModal && (
        <MemoizedFinishedModal
          show={showFinishedModal}
          finalResult={finalResult}
          user={user}
          showRewardedInterstitialAd10K={showRewardedInterstitialAd10K}
        />
      )}

      <Joyride
        steps={steps} // renamed array for clarity
        run={runTutorial} // controlled by useEffect
        stepIndex={stepIndex} // auto-advance index
        continuous={false} // we control next via timer
        showProgress={false} // hide progress bar
        showSkipButton={false} // no skip button
        showCloseButton={false} // no close button
        disableOverlayClose={true} // prevent click-away
        scrollToFirstStep={true} // scroll to highlighted element
        styles={{
          options: { zIndex: 2000 },
          beacon: { display: 'none' }, // hide initial dot
          buttonClose: { display: 'none' }, // hides "X" close button
          buttonBack: { display: 'none' }, // hides "Back" button
          tooltipFooter: { display: 'none' }, // hides bottom bar that contains buttons
        }}
        callback={({ status }) => {
          if (status === 'finished' || status === 'skipped') {
            setRunTutorial(false) // stop tutorial when finished
            setStepIndex(-1)
          }
        }}
      />
    </div>
  )
}

export default Battle
