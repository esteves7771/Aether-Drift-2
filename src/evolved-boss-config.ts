import type { PatternKind, PatternSpec } from './boss-pattern-config';
import { PATTERNS } from './boss-pattern-config';
import { RIFT } from './rift-config';
export type EncounterProfile = 'artillery' | 'phantom' | 'tesser';
export const EVOLVED_BOSSES = {
    phantom: {
        health: 3600,
        speed: [82, 100, 118],
        grace: 1.2,
        arrival: {
            ...RIFT,
            gather: 1,
            form: 1.3,
            emerge: 2.8,
            collapse: 1.1,
            settle: 0.7,
            radius: 38,
            behind: 65,
            ahead: 80,
            bodyHalfLength: 25,
            clearance: 40,
            distance: 480,
            accent: [0.25, 0.8, 1.5] as const
        },
        sequences: [
            ['banks', 'seekers', 'banks', 'fan'],
            ['cross', 'helix', 'seekers', 'banks'],
            ['finale', 'cross', 'helix', 'seekers', 'fan']
        ] as readonly (readonly PatternKind[])[]
    },
    tesser: {
        health: [520, 520, 520, 520, 850, 850, 1900],
        grace: 1.5,
        arrival: {
            ...RIFT,
            gather: 2.4,
            form: 2.8,
            emerge: 5.2,
            collapse: 1.6,
            settle: 1.2,
            radius: 130,
            bodyHalfLength: 65,
            clearance: 120,
            accent: [0.6, 0.35, 1.5] as const
        },
        sequences: [
            ['sphere', 'helix', 'fan'],
            ['cross', 'sphere', 'helix', 'fan'],
            ['finale', 'cross', 'sphere', 'helix', 'fan']
        ] as readonly (readonly PatternKind[])[]
    }
} as const;
export function encounterSpec(profile: EncounterProfile, kind: PatternKind): PatternSpec {
    const base = PATTERNS[kind];
    if (profile === 'artillery') return base;
    return {
        ...base,
        name:
            profile === 'phantom'
                ? {
                      banks: 'HUNTER BURST',
                      seekers: 'TRACKING SALVO',
                      helix: 'SPIRAL LANCE',
                      cross: 'CROSS-VECTOR STRIKE',
                      finale: 'PREDATOR FINALE',
                      fan: 'SHIFTING ION FAN',
                      beam: 'PRECISION LANCE',
                      sphere: 'HUNTER CONE'
                  }[kind]
                : {
                      sphere: 'PARTIAL SPHERICAL BURST',
                      helix: 'ROTATING HELIX',
                      cross: 'CROSSING BEAM SWEEP',
                      fan: 'GEOMETRIC BARRAGE',
                      finale: 'SINGULARITY SEQUENCE',
                      banks: 'WEAPON BANKS',
                      seekers: 'ION SALVO',
                      beam: 'GRAVITATIONAL LANCE'
                  }[kind],
        speed: profile === 'phantom' ? base.speed * 1.15 : base.speed,
        recovery: profile === 'phantom' ? [3.2, 2.9, 2.6] : [4.2, 3.7, 3.2]
    };
}
