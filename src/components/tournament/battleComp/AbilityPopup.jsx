// ./battleComp/AbilityPopup.jsx
import React, { useMemo } from 'react'
import CachedImage from '../../shared/CachedImage'

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

const ABILITY_IMAGES = {
  AEGIS_WARD: '/new/battle/assets/ability/Aegis_Wards.png',
  FURY_UNLEASHED: '/new/battle/assets/ability/Fury_Unleashed.png',
  ARCANE_OVERCHARGE: '/new/battle/assets/ability/Archane_Overcharged.png',
  BERSERKERS_FURY: '/new/battle/assets/ability/Berserkers_Fury.png',
  CELESTIAL_REJUVENATION:
    '/new/battle/assets/ability/Celestial_Rejuvenation.png',
  GUARDIANS_BULWARK: '/new/battle/assets/ability/Guardian_s_Bulwark.png',
  MINDWRAP: '/new/battle/assets/ability/Mind_Wrap.png',
  SOUL_LEECH: '/new/battle/assets/ability/Soul_Leech.png',
  TITAN_STRIKE: '/new/battle/assets/ability/Titans_Strike.png',
  TWIN_STRIKE: '/new/battle/assets/ability/Twin_Strike.png',
}

const AbilityPopup = React.memo(
  ({
    show,
    playerRole,
    selectedAbility,
    usedAbilities = [],
    handleAbilityClick,
    ABILITIES = {},
  }) => {
    if (!show) return null

    // Memoized filtered abilities for performance
    const filteredAbilities = useMemo(() => {
      const allowedAbilities =
        playerRole === 'attack'
          ? ATTACK_ABILITIES
          : playerRole === 'defense'
            ? DEFENSE_ABILITIES
            : []

      return Object.entries(ABILITIES).filter(([key]) =>
        allowedAbilities.includes(key)
      )
    }, [playerRole, ABILITIES])

    return (
      <div className="ability-popup">
        <h3>Select an Ability</h3>
        <div className="abilities-grid">
          {filteredAbilities.map(([key, ability]) => {
            const isUsed = usedAbilities.includes(ability)
            return (
              <button
                key={ability}
                className={`ability-btn ${selectedAbility === ability ? 'selected' : ''} ${isUsed ? 'disabled' : ''}`}
                onClick={() => !isUsed && handleAbilityClick(ability)}
                type="button"
              >
                <CachedImage
                  src={ABILITY_IMAGES[key]}
                  alt={ability}
                  className="ability-img"
                />
              </button>
            )
          })}
        </div>
      </div>
    )
  }
)

export default AbilityPopup
