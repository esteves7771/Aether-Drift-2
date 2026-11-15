import { ARCADE } from './arcade-config';
import { SPECTACLE } from './spectacle-config';
export const EVOLUTION = {
    missile: {
        capacity: 12,
        starting: 6,
        maxAmmo: 6,
        speed: 220,
        launchSpeed: 90,
        acceleration: 150,
        turnRate: 1.8,
        lifetime: 6,
        damage: 170,
        radius: 1.4,
        cooldown: 0.65
    },
    emp: { radius: 180, duration: 3.5, bossDuration: 1.6, cooldown: 22, slow: 0.35 },
    boss: {
        wave: 5,
        arrival: 3,
        turretHealth: 180,
        weakHealth: 280,
        coreHealth: 680,
        turretRadius: 6,
        weakRadius: 6,
        coreRadius: 8,
        reward: ARCADE.scoring.boss,
        componentReward: ARCADE.scoring.turret,
        phaseGrace: 1.1,
        windup: SPECTACLE.boss.windup,
        cooldown: SPECTACLE.boss.cooldown,
        shotSpeed: [150, 130, 175],
        damage: [12, 14, 12],
        projectileLimit: 72,
        victory: 7
    },
    director: { groupBreak: 3.5, waveBreak: 7, resupply: 2, hullRepair: 12, attackers: 3 },
    coordination: { formation: 2.5, cycle: 14, regroupAt: 10, flankUntil: 6 },
    elite: {
        health: 84,
        speed: 56,
        turn: 4.8,
        radius: 3.8,
        fireRate: 1.4,
        projectileSpeed: 185,
        damage: 11,
        score: ARCADE.scoring.elite
    }
} as const;
