// abilities.js

export const abilityConfig = {
  berserkers_fury: {
    displayName: 'Berserkers Fury',
    parts: [
      { key: 'BERSERKERS_FURY_HOR', delay: 0 },
      { key: 'BERSERKERS_FURY_MAIN', delay: 300 },
    ],
  },
  aegis_ward: {
    displayName: 'Aegis Ward',
    parts: [{ key: 'AEGIS_WARD', delay: 0 }],
  },
  arcane_overcharge: {
    displayName: 'Arcane Overcharge',
    parts: [{ key: 'ARCANE_OVERCHARGE', delay: 0 }],
  },
  celestial_rejuvenation: {
    displayName: 'Celestial Rejuvenation',
    parts: [{ key: 'CELESTIAL_REJUVENATION', delay: 0 }],
  },
  guardians_bulwark: {
    displayName: "Guardian's Bulwark",
    parts: [{ key: 'GUARDIANS_BULWARK', delay: 0 }],
  },
  mindwrap: {
    displayName: 'Mind Wrap',
    parts: [{ key: 'MINDWRAP', delay: 0 }],
  },
  soul_leech: {
    displayName: 'Soul Leech',
    parts: [{ key: 'SOUL_LEECH', delay: 0 }],
  },
  titans_strike: {
    displayName: "Titan's Strike",
    parts: [{ key: 'TITAN_STRIKE', delay: 0 }],
  },
  twin_strike: {
    displayName: 'Twin Strike',
    parts: [{ key: 'TWIN_STRIKE', delay: 0 }],
  },
  fury_unleashed: {
    displayName: 'Fury Unleashed',
    parts: [{ key: 'FURY_UNLEASHED', delay: 0 }],
  },
  drop_animation: {
    displayName: 'Drop Animation',
    parts: [{ key: 'DROP_ANIMATION', delay: 0 }],
  },
}

// Weight factors for damage calculation
export const abilityWeights = {
  berserkers_fury: {
    attack: 0.5,
    armor: 0,
    agility: 0,
    intelligence: 0,
    powers: 1.0,
    vitality: 0,
  },
  aegis_ward: {
    attack: 0,
    armor: 0.7,
    agility: 0,
    intelligence: 0,
    powers: 0,
    vitality: 0.3,
  },
  arcane_overcharge: {
    attack: 0,
    armor: 0,
    agility: 0,
    intelligence: 0.7,
    powers: 0,
    vitality: 0.3,
  },
  celestial_rejuvenation: {
    attack: 0,
    armor: 0,
    agility: 0.4,
    intelligence: 0,
    powers: 0,
    vitality: 0.6,
  },
  guardians_bulwark: {
    attack: 0,
    armor: 1.0,
    agility: 0,
    intelligence: 0,
    powers: 0,
    vitality: 0,
  },
  mindwrap: {
    attack: 0,
    armor: 0,
    agility: 0,
    intelligence: 1.0,
    powers: 0,
    vitality: 0,
  },
  soul_leech: {
    attack: 0,
    armor: 0,
    agility: 0,
    intelligence: 0.7,
    powers: 0.3,
    vitality: 0,
  },
  titans_strike: {
    attack: 1.0,
    armor: 0,
    agility: 0,
    intelligence: 0,
    powers: 0.3,
    vitality: 0,
  },
  twin_strike: {
    attack: 0.8,
    armor: 0,
    agility: 0.3,
    intelligence: 0,
    powers: 0,
    vitality: 0,
  },
  fury_unleashed: {
    attack: 0.7,
    armor: 0,
    agility: 0,
    intelligence: 0,
    powers: 0,
    vitality: 0.3,
  },
}
