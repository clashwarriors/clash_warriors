import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { ref, set as dbSet, update, get } from 'firebase/database'
import { realtimeDB } from '../../firebase'
import {
  showRewardedInterstitialAd1K,
  showRewardedInterstitialAd10K,
} from './utils/adsUtility'
import './style/battle.css'
import botNames from './gameUtils/botName.json'
import { getUserData, storeUserData } from '../../utils/indexedDBService'

import cardHolder from '/assets/gameLogo.avif'
import summonLeft from './assets/leftSummon.png'
import summonRight from './assets/rightSummon.png'

import endBattleBtn from './assets/endBattleBtn.png'
import endRoundBtn from './assets/endRoundBtn.png'

import cooldownBadge from './assets/phase/cooldown.png'
import selectionBadge from './assets/phase/selection.png'
import battleBadge from './assets/phase/battle.png'
import cancelledBadge from './assets/phase/cancelled.png'

import { playStoredAudio } from './utils/audioUtils'
import { dropHapticFeedback } from './utils/haptic'
import {
  getCurrentPhase,
  getCurrentRound,
  PHASES,
  ROUND_DURATION_MS,
  ROUND_TOTAL_TIME,
  MATCH_TOTAL_TIME,
  selectRandomCard,
  manualEndRound,
} from './gameUtils/gameLogic'
import { set } from 'idb-keyval'
import { getFrames } from './utils/indexedDBHelper'

import CachedImage from '../shared/CachedImage'

const roundStore = {} // Local memory store for user and bot card selections

const Battle = ({ user }) => {
  const { matchID } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [phase, setPhase] = useState(PHASES.COOLDOWN)
  const [remainingTime, setRemainingTime] = useState(0)
  const [selectedCard, setSelectedCard] = useState(null)
  const [botSelectedCard, setBotSelectedCard] = useState(null)
  const [dropFrames, setDropFrames] = useState([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [botAnimating, setBotAnimating] = useState(false)
  const [botFrameIndex, setBotFrameIndex] = useState(0)
  const [showFinishedModal, setShowFinishedModal] = useState(false)
  const [totalSynergy, setTotalSynergy] = useState({ user: 0, bot: 0 })
  const [animationDirection, setAnimationDirection] = useState(null)
  const [finalResult, setFinalResult] = useState(null)
  const [directionalFrames, setDirectionalFrames] = useState([])
  const [directionFrameIndex, setDirectionFrameIndex] = useState(0)
  const [botName, setBotName] = useState('user123')

  const containerRef = useRef(null)
  const intervalRef = useRef(null)

  const phaseBadges = {
    [PHASES.COOLDOWN]: cooldownBadge,
    [PHASES.SELECTION]: selectionBadge,
    [PHASES.BATTLE]: battleBadge,
    [PHASES.CANCELLED]: cancelledBadge,
    [PHASES.FINISHED]: cancelledBadge,
  }

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
          await showRewardedInterstitialAd1K(user.userId)
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
      showRewardedInterstitialAd1K(user.userId)
    }, 1500)
  }

  useEffect(() => {
    const request = indexedDB.open('AnimationDB', 1)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('frames', 'readonly')
      const store = tx.objectStore('frames')
      const frames = []
      store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result
        if (cursor && cursor.key.startsWith('7200')) {
          frames.push({ key: cursor.key, src: cursor.value })
          cursor.continue()
        } else {
          const sorted = frames
            .sort((a, b) => a.key.localeCompare(b.key))
            .map((f) => f.src)
          setDropFrames(sorted)
        }
      }
    }
  }, [])

  useEffect(() => {
    if (animating) {
      const interval = setInterval(() => {
        setFrameIndex((prev) => {
          if (prev >= dropFrames.length - 1) {
            clearInterval(interval)
            setAnimating(false)
            return prev
          }
          return prev + 1
        })
      }, 40)
      return () => clearInterval(interval)
    }
  }, [animating, dropFrames])

  useEffect(() => {
    if (botNames?.length > 0) {
      const random = botNames[Math.floor(Math.random() * botNames.length)]
      setBotName(random)
    }
  }, [])

  useEffect(() => {
    if (botAnimating) {
      const interval = setInterval(() => {
        setBotFrameIndex((prev) => {
          if (prev >= dropFrames.length - 1) {
            clearInterval(interval)
            setBotAnimating(false)
            return prev
          }
          return prev + 1
        })
      }, 40)
      return () => clearInterval(interval)
    }
  }, [botAnimating, dropFrames])

  const handleCardClick = (card) => {
    if (phase !== PHASES.SELECTION || selectedCard) return

    const round = getCurrentRound(match.startTime)
    if (!roundStore[matchID]) roundStore[matchID] = { rounds: [] }
    if (!roundStore[matchID].rounds[round])
      roundStore[matchID].rounds[round] = {}

    roundStore[matchID].rounds[round].userCard = card
    setSelectedCard(card)
    setFrameIndex(0)
    setAnimating(true)
    playStoredAudio('gameDropSound')
    dropHapticFeedback()

    // Update synergy for the user
    setTotalSynergy((prev) => {
      const updated = { ...prev, user: prev.user + (card.synergy || 0) }
      return updated
    })

    // We no longer trigger the bot card selection here. It will be handled in the useEffect.
  }

  useEffect(() => {
    if (phase === PHASES.SELECTION) {
      const round = getCurrentRound(match.startTime)
      setSelectedCard(null)
      setBotSelectedCard(null)
      setDirectionFrameIndex(0)
      setAnimationDirection(null)
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
          setBotFrameIndex(0)
          setBotAnimating(true)
          playStoredAudio('gameDropSound')
          dropHapticFeedback()

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
    if (phase !== PHASES.BATTLE) return

    const round = getCurrentRound(match.startTime)
    const data = roundStore[matchID]?.rounds?.[round]

    if (data?.userCard && data?.botCard) {
      const userSynergy = data.userCard.synergy || 0
      const botSynergy = data.botCard.synergy || 0

      if (userSynergy > botSynergy) {
        setAnimationDirection('rtl')
        playStoredAudio('gameAttackMusic')
        console.log(
          `📊 Round ${round} direction:`,
          userSynergy,
          'vs',
          botSynergy,
          '→ rtl'
        )
      } else if (botSynergy > userSynergy) {
        setAnimationDirection('ltr')
        playStoredAudio('gameAttackMusic')
        console.log(
          `📊 Round ${round} direction:`,
          userSynergy,
          'vs',
          botSynergy,
          '→ ltr'
        )
      } else {
        setAnimationDirection('neutral')
        setDirectionalFrames([]) // clear previous frames just in case
        setDirectionFrameIndex(0)
      }
    }
  }, [phase])

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

  const handleEndRound = () => {
    if (phase !== PHASES.SELECTION || !selectedCard) return

    const round = getCurrentRound(match.startTime)

    // Mark user as ended in backend store
    const shouldStartBattle = manualEndRound(matchID, round)

    // Update frontend store too (optional, for UI)
    if (!roundStore[matchID]?.rounds[round]) return
    roundStore[matchID].rounds[round].userEndedRound = true

    // Transition to BATTLE phase only if both ended
    if (shouldStartBattle) {
      setPhase(PHASES.BATTLE)
    } else {
      console.log('🕒 Waiting for bot to finish selection...')
    }
  }

  useEffect(() => {
    if (
      phase !== PHASES.BATTLE ||
      !animationDirection ||
      animationDirection === 'neutral'
    )
      return

    const frames =
      animationDirection === 'rtl' ? getFrames('rtl') : getFrames('ltr')

    if (frames.length > 0) {
      console.log(
        `[MEMORY] Loaded ${frames.length} frames from ${animationDirection.toUpperCase()} cache`
      )
      setDirectionalFrames(frames)
      setDirectionFrameIndex(0)
    } else {
      console.warn(
        `[MEMORY] No frames found for direction: ${animationDirection}`
      )
    }
  }, [animationDirection, phase])

  useEffect(() => {
    if (!directionalFrames.length || phase !== PHASES.BATTLE) return

    const interval = setInterval(() => {
      setDirectionFrameIndex((prev) => {
        if (prev >= directionalFrames.length - 1) {
          clearInterval(interval)
          // Reset frame data after animation ends
          setDirectionalFrames([])
          return 0 // reset frame index to 0 to prevent stuck on last frame
        }
        return prev + 1
      })
    }, 60)

    return () => clearInterval(interval)
  }, [directionalFrames, phase])

  if (!match) return <div>Loading battle...</div>

  return (
    <div className="battle-container" ref={containerRef}>
      <div className="battle-header">
        <div className="battle-header-left">
          <img src={user.photo_url} alt="Player Avatar" className="avatar" />
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
                width: '430px',
                height: '420px',
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
          {botSelectedCard && botAnimating && dropFrames.length > 0 && (
            <img
              src={dropFrames[botFrameIndex]}
              alt="Bot Drop Animation"
              className="drop-animation-frame"
              style={{
                position: 'absolute',
                top: '-50%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '430px',
                height: '440px',
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />
          )}
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
        {directionalFrames.length > 0 && (
          <img
            src={directionalFrames[directionFrameIndex]}
            alt="Battle Direction Animation"
            className="directional-animation"
            style={{ marginTop: '30px' }}
          />
        )}
      </div>

      <div className="deck-section">
        {match.player1Deck.map((card, i) => (
          <img
            key={i}
            src={card.src}
            alt={`Card ${i + 1}`}
            className={`deck-card ${phase !== PHASES.SELECTION ? 'disabled' : ''}`}
            onClick={() => handleCardClick(card)}
          />
        ))}
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
                  navigate('/tournament') // Optional: remove if you only want to navigate on success
                }
              }}
              style={{ marginTop: '10px' }}
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
