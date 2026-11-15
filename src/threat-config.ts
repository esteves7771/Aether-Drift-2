import type { EnemyKind } from './combat-config';
/** Population is a wave quota, not an instruction to allocate more enemy slots. */
export const THREAT = {
    early: [
        { total: 3, active: 3, batch: 2, attackers: 2, delay: 5.2, heavy: false, elite: false, name: 'SCOUT TRIAD' },
        { total: 3, active: 3, batch: 2, attackers: 3, delay: 4.8, heavy: false, elite: false, name: 'MIXED PATROL' },
        { total: 5, active: 4, batch: 2, attackers: 3, delay: 4.4, heavy: true, elite: true, name: 'ELITE FLANKERS' },
        { total: 5, active: 5, batch: 3, attackers: 4, delay: 4, heavy: true, elite: true, name: 'ASSAULT WINGS' }
    ],
    late: {
        totalLimit: 30,
        activeLimit: 7,
        batch: 2,
        delay: 4.4,
        minimumDelay: 3.5,
        attackers: 5
    },
    health: { heavyStep: 0.035, heavyCap: 0.6, eliteStep: 0.028, eliteCap: 0.45 }
} as const;
export function wavePopulation(wave: number) {
    return wave <= 0
        ? 0
        : wave <= 4
          ? THREAT.early[wave - 1].total
          : wave <= 7
            ? 7
            : wave <= 9
              ? 9
              : wave <= 14
                ? 12
                : wave <= 19
                  ? 15
                  : Math.min(30, 18 + Math.floor((wave - 20) / 5) * 2);
}
export function waveHealth(wave: number, kind: EnemyKind, elite: boolean) {
    const age = Math.max(0, wave - 5);
    return elite
        ? 1 + Math.min(THREAT.health.eliteCap, age * THREAT.health.eliteStep)
        : kind === 'heavy' || kind === 'bomber'
          ? 1 + Math.min(THREAT.health.heavyCap, age * THREAT.health.heavyStep)
          : 1;
}

export function waveTier(wave: number, serial: number): 'standard' | 'veteran' | 'elite' {
    const roll = (Math.imul(wave * 17 + serial * 31, 1664525) >>> 0) % 100;
    const elite = wave < 3 ? 0 : wave < 6 ? 12 : wave < 11 ? 20 : wave < 16 ? 28 : 35;
    const veteran = wave < 3 ? 0 : wave < 6 ? 30 : 40;
    return roll < elite ? 'elite' : roll < elite + veteran ? 'veteran' : 'standard';
}
