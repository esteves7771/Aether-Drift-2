/** Cosmetic budgets only; logical population and combat balance are invariant across presets. */
export const UNIVERSE = {
    satellite: {
        orbit: 18,
        drift: 14,
        static: 12,
        abandoned: 6,
        full: [8, 14, 20],
        range: [560, 760, 1000],
        signalRange: 1800,
        padding: 18,
        sampleStep: 0.15
    },
    traffic: {
        minimumInterval: 30,
        intervalVariation: 30,
        capacity: 3,
        duration: [9, 22, 15],
        speed: [240, 75, 130],
        clearance: 95,
        distance: 420,
        trail: [1, 9, 18]
    }
} as const;
