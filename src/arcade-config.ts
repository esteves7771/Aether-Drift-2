export const ARCADE = {
    scoring: {
        interceptor: 100,
        heavy: 175,
        bomber: 250,
        carrier: 275,
        phantom: 2400,
        drone: 20,
        elite: 250,
        turret: 200,
        boss: 1500,
        clean: 25,
        boost: 25,
        challenge: 250
    },
    flow: { window: 8, killsPerStep: 3, step: 0.5, maximum: 4, feedback: 1.35 },
    challenges: { accuracy: 0.45, boostKills: 2 }
} as const;
