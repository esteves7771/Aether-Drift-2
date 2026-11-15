/** Shared simulation and art anchors, in metres. Never independently scale the visual root. */
export const GUARDIAN = {
    wave: 15,
    arrival: 3.8,
    score: 4200,
    componentScore: 150,
    health: [140, 140, 140, 140, 180, 180, 720],
    radius: [11, 11, 11, 11, 12, 12, 18],
    parts: [
        [-110, 45, -35],
        [110, 45, -35],
        [-100, -50, 20],
        [100, -50, 20],
        [-100, 0, -68],
        [100, 0, -68],
        [0, 0, -104]
    ],
    hullRadius: 82,
    rotationSpeed: 2.5,
    grace: 1.2,
    windup: [1.6, 1.45, 1.8],
    cooldown: [3.2, 2.8, 2.6],
    speed: [145, 150, 165],
    damage: [12, 12, 14],
    projectiles: [6, 8, 12],
    projectileLimit: 36,
    escorts: 2,
    rotation: ['dreadnought', 'phantom', 'guardian']
} as const;
export function bossForWave(wave: number) {
    return wave >= 5 && wave % 5 === 0
        ? GUARDIAN.rotation[(Math.floor(wave / 5) - 1) % GUARDIAN.rotation.length]
        : null;
}
