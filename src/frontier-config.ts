import { PERSEID } from './environment';
/** Bounded, deterministic points of interest. No procedural universe framework. */
export const FRONTIER = {
    sector: PERSEID,
    installations: 4,
    discoverRange: 150,
    interactRange: 85,
    shieldSupply: 28,
    missileSupply: 2,
    supplyCap: 6,
    encounters: [
        { name: 'BASTION BOMBER WING', minWave: 8, weight: 2, roles: ['bomber', 'heavy', 'interceptor'] },
        { name: 'CARRIER STRONGPOINT', minWave: 9, weight: 2, roles: ['carrier', 'heavy', 'interceptor'] },
        {
            name: 'ELITE VECTOR AMBUSH',
            minWave: 11,
            weight: 2,
            roles: ['interceptor', 'interceptor', 'interceptor', 'heavy']
        },
        {
            name: 'CROSS-VECTOR ASSAULT',
            minWave: 12,
            weight: 3,
            roles: ['bomber', 'interceptor', 'heavy', 'interceptor']
        }
    ],
    plasma: { warning: 1, speed: 155, damage: 16, cooldown: 4.2 },
    turret: {
        health: 100,
        powerHealth: 120,
        range: 330,
        minimum: 90,
        warning: 1.3,
        cooldown: 4.8,
        speed: 135,
        damage: 10,
        score: 100,
        baseScore: 350,
        lifetime: 3.4,
        limit: 8
    },
    cruise: {
        speed: 350,
        acceleration: 90,
        deceleration: 110,
        cooldown: 8,
        lockRange: 500,
        rockClearance: 110,
        settleSpeed: 100,
        fov: 76
    }
} as const;
