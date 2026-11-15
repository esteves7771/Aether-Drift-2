/** Presentation and boss tactics; player flight, health, weapon damage and fire rates stay unchanged. */
export const SPECTACLE = {
    boss: {
        clearance: 155,
        spawnDistance: 390,
        near: 290,
        far: 360,
        orbit: [13, 18, 24],
        turn: [0.45, 0.5, 0.65],
        speed: 36,
        windup: [1.3, 1.6, 1.85],
        cooldown: [1.7, 2.1, 1.8],
        nodeWindow: 3.5,
        facing: 16,
        lead: 0.7,
        crossLanes: 7,
        crossSpread: 0.06,
        crossHeight: 0.025,
        lanceCount: 5,
        lanceSpread: 0.012,
        ringCount: 13,
        ringSpread: 0.1,
        parts: [
            [-64, 12, -52],
            [64, 12, -52],
            [-40, 29, -86],
            [40, 29, -86],
            [-23, -14, -81],
            [23, -14, -81],
            [0, 3, -106]
        ],
        radii: [8, 8, 8, 8, 8, 8, 10],
        hull: [
            [0, 0, -58, 34],
            [0, 0, 0, 42],
            [0, 0, 65, 34],
            [-62, 0, 18, 26],
            [62, 0, 18, 26],
            [-46, 0, -34, 20],
            [46, 0, -34, 20],
            [-60, 0, 99, 28],
            [60, 0, 99, 28]
        ],
        destruction: 6.4,
        beats: [0, 0.7, 1.5, 2.3, 3.2, 4, 4.8],
        finalBeat: 6
    },
    effects: { normal: 22, elite: 32, capital: 36, secondaryDelay: 0.24, secondaryCapacity: 8, coreAngular: 0.2 },
    speed: {
        fov: 65,
        fovBoost: 5,
        fovSpeed: 2,
        pullback: 2.2,
        accelerationPull: 1.1,
        response: 4,
        dust: [20, 42, 64],
        ambient: [2, 3, 4]
    }
} as const;
