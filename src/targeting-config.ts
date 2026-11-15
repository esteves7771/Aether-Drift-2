/** Acquisition/assistance constraints only; projectile tuning stays in COMBAT/EVOLUTION. */
export const TARGETING = {
    craftRange: 900,
    bossRange: 1200,
    defenseRange: 350,
    manualRange: 550,
    acquireCos: Math.cos((26 * Math.PI) / 180),
    manualCos: Math.cos((3 * Math.PI) / 180),
    retainCos: Math.cos((40 * Math.PI) / 180),
    grace: 0.4,
    rangeGrace: 1.15,
    laserRange: 500,
    laserCos: Math.cos((4 * Math.PI) / 180),
    laserBlend: 0.35,
    messageDuration: 1.1
} as const;
