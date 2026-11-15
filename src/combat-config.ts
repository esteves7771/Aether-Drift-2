import { ARCADE } from './arcade-config';
export const COMBAT = {
    projectileCapacity: 240,
    enemyCapacity: 8,
    effectCapacity: 128,
    player: { fireRate: 7, speed: 480, damage: 14, lifetime: 2.2, radius: 0.7, aimCone: 0.94 },
    shield: { capacity: 70, delay: 5, recharge: 12 },
    waveDelay: 4,
    interceptor: {
        health: 56,
        speed: 48,
        turn: 3.8,
        radius: 3.8,
        fireRate: 1.15,
        projectileSpeed: 165,
        damage: 10,
        score: ARCADE.scoring.interceptor
    },
    heavy: {
        health: 168,
        speed: 29,
        turn: 2.1,
        radius: 5.8,
        fireRate: 0.8,
        projectileSpeed: 145,
        damage: 22,
        score: ARCADE.scoring.heavy
    }
} as const;
export type EnemyKind = 'interceptor' | 'heavy' | 'bomber' | 'carrier' | 'drone';
export type AIState = 'pursue' | 'approach' | 'attack' | 'evade' | 'reposition';
export type CombatEvent =
    | 'laser'
    | 'hostile'
    | 'impact'
    | 'shield'
    | 'hull'
    | 'explosion'
    | 'emp'
    | 'charge'
    | 'elite-explosion'
    | 'capital-burst'
    | 'capital-final'
    | 'missile-impact'
    | 'armor'
    | 'deploy'
    | 'salvo'
    | 'drone';
