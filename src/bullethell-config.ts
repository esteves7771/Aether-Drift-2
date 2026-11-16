/** Phase 5I shared encounter/ability balance. Cosmetic quality never changes these limits. */
export const BULLETHELL = {
    ordinary: 60,
    single: 144,
    dualLimit: 176,
    playerReserve: 40,
    beams: 2,
    maximumRange: 1600,
    maximumRoam: 2400,
    returnSpeed: 42,
    beamLength: 1100,
    curtain: { rows: 5, lanes: 9, pulses: 2, gap: 3 },
    escorts: { single: 3, dual: 2, total: 6, reinforcement: 16 },
    dual: { firstWave: 20, interval: 20, secondDelay: 4, handoff: 0.75 },
    storm: { charge: 45, missiles: 6, damage: 100, interval: 0.12, fan: 0.55, range: 1200 },
    evade: { cooldown: 3, duration: 0.7, impulse: 34 }
} as const;
