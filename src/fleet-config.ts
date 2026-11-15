import { ARCADE } from './arcade-config';
export const FLEET = {
    bomber: {
        health: 196,
        speed: 25,
        turn: 1.7,
        radius: 9,
        fireRate: 0.18,
        projectileSpeed: 95,
        damage: 18,
        score: ARCADE.scoring.bomber
    },
    carrier: {
        health: 240,
        speed: 29,
        turn: 1.6,
        radius: 10,
        fireRate: 0.16,
        projectileSpeed: 130,
        damage: 10,
        score: ARCADE.scoring.carrier
    },
    drone: {
        health: 28,
        speed: 63,
        turn: 4.8,
        radius: 2.2,
        fireRate: 1,
        projectileSpeed: 155,
        damage: 7,
        score: ARCADE.scoring.drone
    },
    missile: { warmup: 1.4, cooldown: 5.5, guide: 2, turn: 0.55, life: 5, range: 500, minimumRange: 140 },
    deployment: { warmup: 1.2, cooldown: 8, active: 2, total: 4, orphanLife: 12 },
    priority: 50,
    phantom: {
        wave: 10,
        health: 1200,
        radius: 12,
        score: ARCADE.scoring.phantom,
        arrival: 3,
        speed: [80, 105, 95],
        windup: [1.1, 1.3, 1.65],
        cooldown: [2.4, 2, 1.8],
        damage: [10, 12, 12],
        shotSpeed: [180, 190, 200]
    },
    encounters: [
        { name: 'BOMBER ESCORT', minWave: 6, weight: 3, roles: ['bomber', 'interceptor', 'interceptor'] },
        { name: 'CARRIER DEFENSE', minWave: 7, weight: 2, roles: ['carrier', 'heavy', 'interceptor'] },
        { name: 'PINCER ATTACK', minWave: 6, weight: 2, roles: ['interceptor', 'heavy', 'interceptor', 'interceptor'] },
        { name: 'ELITE HUNT', minWave: 6, weight: 2, roles: ['interceptor', 'interceptor', 'interceptor'] },
        { name: 'MIXED ASSAULT', minWave: 8, weight: 2, roles: ['bomber', 'carrier', 'heavy', 'interceptor'] }
    ]
} as const;
