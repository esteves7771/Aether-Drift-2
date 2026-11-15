/** Bounded environmental simulation and presentation budgets. */
export const LIVING = {
    barrels: 18,
    barrelHealth: 24,
    barrelRadius: 2,
    blastRadius: 48,
    blastDamage: 72,
    chainLimit: 18,
    activeRange: 850,
    viewRange: 1200,
    astronautRange: 500,
    astronauts: 4,
    arrival: 5,
    approach: 3,
    arrivalSpeed: 135,
    spawnDistance: 620,
    tesser: {
        health: 2450,
        partHealth: [250, 250, 250, 250, 200, 200, 1050],
        arrival: 5,
        speed: 28,
        overdriveSpeed: 43,
        windup: 1.45,
        overdriveWindup: 1.15,
        cooldown: 2.3,
        overdriveCooldown: 1.7,
        projectileLimit: 36,
        damage: 15,
        plasmaDamage: 24,
        plasmaSpeed: 175
    }
} as const;
