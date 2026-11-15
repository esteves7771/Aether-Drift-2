export type PatternKind = 'fan' | 'banks' | 'helix' | 'beam' | 'seekers' | 'sphere' | 'cross' | 'finale';
export interface PatternSpec {
    name: string;
    hint: string;
    telegraph: readonly number[];
    fire: number;
    recovery: readonly number[];
    interval: number;
    speed: number;
    damage: number;
}
export const PATTERNS: Record<PatternKind, PatternSpec> = {
    sphere: {
        name: 'PARTIAL SPHERICAL BURST',
        hint: 'READ THE OPEN CORRIDOR / CHANGE AXIS',
        telegraph: [2, 1.9, 1.8],
        fire: 1.8,
        recovery: [4.4, 4, 3.5],
        interval: 0.7,
        speed: 130,
        damage: 13
    },
    cross: {
        name: 'CROSSING BEAM SWEEP',
        hint: 'LEAVE THE TWO MARKED PLANES',
        telegraph: [2.4, 2.3, 2.1],
        fire: 2.4,
        recovery: [4.5, 4, 3.5],
        interval: 0.6,
        speed: 210,
        damage: 10
    },
    finale: {
        name: 'SINGULARITY SEQUENCE',
        hint: 'GUIDANCE THEN SPIRAL / KEEP MOVING',
        telegraph: [2.2, 2, 1.9],
        fire: 3.4,
        recovery: [4.4, 4, 3.5],
        interval: 0.4,
        speed: 150,
        damage: 13
    },
    fan: {
        name: 'LAYERED PLASMA FAN',
        hint: 'FIND THE STAGGERED GAP / STRAFE',
        telegraph: [1.8, 1.65, 1.5],
        fire: 1.2,
        recovery: [4.5, 3.8, 3.2],
        interval: 0.65,
        speed: 125,
        damage: 18
    },
    banks: {
        name: 'ALTERNATING BATTERIES',
        hint: 'KEEP LATERAL THRUST / BREAK AIM',
        telegraph: [1.5, 1.35, 1.2],
        fire: 2.1,
        recovery: [4.2, 3.6, 3],
        interval: 0.45,
        speed: 220,
        damage: 12
    },
    helix: {
        name: 'COUNTER-ROTATING ION HELIX',
        hint: 'LEAVE THE CONE / CHANGE AXIS',
        telegraph: [1.7, 1.55, 1.4],
        fire: 2.4,
        recovery: [4.3, 3.7, 3.1],
        interval: 0.24,
        speed: 165,
        damage: 11
    },
    beam: {
        name: 'OBLIQUE LANCE SWEEP',
        hint: 'BOOST OUT OF THE MARKED PLANE',
        telegraph: [2.1, 2, 1.8],
        fire: 2.3,
        recovery: [4.6, 4, 3.4],
        interval: 0.7,
        speed: 150,
        damage: 8
    },
    seekers: {
        name: 'TRACKING TORPEDO PAIRS',
        hint: 'TURN ACROSS THEIR PATH / EMP',
        telegraph: [1.9, 1.85, 1.7],
        fire: 1.8,
        recovery: [4.4, 3.8, 3.2],
        interval: 0.85,
        speed: 145,
        damage: 20
    }
};
export const BOSS_PATTERNS = {
    sequences: [
        ['fan', 'banks', 'helix', 'banks'],
        ['seekers', 'beam', 'fan', 'helix', 'banks'],
        ['helix', 'beam', 'seekers', 'banks', 'fan']
    ] as readonly (readonly PatternKind[])[],
    hostileLimit: 96,
    playerReserve: 32,
    life: 7,
    aimLead: 0.3,
    beam: { length: 900, radius: 2.8, damage: 8, hitInterval: 0.22, sweep: 0.48 }
} as const;
