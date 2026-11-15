/** Visual presets only. Existing event sizes, damage and boss death clocks remain authoritative. */
export type BlastClass = 'fighter' | 'heavy' | 'saucer' | 'barrel' | 'turret' | 'dreadnought' | 'phantom' | 'tesser';
export const BLASTS = {
    capacity: 12,
    presets: {
        fighter: { scale: 5.5, duration: 1.65, style: 0 },
        heavy: { scale: 6.3, duration: 1.85, style: 1 },
        saucer: { scale: 6, duration: 1.8, style: 2 },
        barrel: { scale: 4.5, duration: 1.5, style: 3 },
        turret: { scale: 4.5, duration: 1.7, style: 4 },
        dreadnought: { scale: 6.5, duration: 2.1, style: 5 },
        phantom: { scale: 6, duration: 1.65, style: 6 },
        tesser: { scale: 6.8, duration: 2.4, style: 7 }
    },
    quality: { low: [3, 12, 4], medium: [6, 30, 8], high: [8, 48, 12] },
    maximumAngularSize: 0.48,
    flashRange: 130
} as const;
