/** Ordinary attacks stay smaller than capital barrages; seconds, metres, bounded counts. */
export const ENEMY_PATTERNS = {
    hostileLimit: 60,
    reserve: 32,
    majorSlots: 1,
    standard: { count: 3, spread: 0.018, interval: 0.18, tell: 0.5, cooldown: 3.2 },
    veteran: { count: 5, spread: 0.065, interval: 0.16, tell: 0.85, cooldown: 3.8 },
    elite: { count: 5, spread: 0.075, interval: 0.2, tell: 1.05, cooldown: 4.2 },
    heavy: { count: 5, spread: 0.09, interval: 0.24, tell: 1.25, cooldown: 5.4 },
    sniper: { count: 1, spread: 0, interval: 0.2, tell: 1.8, cooldown: 5.8 }
} as const;
