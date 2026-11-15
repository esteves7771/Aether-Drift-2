/** Wave-5 identity and calibrated attachments. Other bosses retain their own tuning. */
export const ARTILLERY = {
    length: 240,
    tactics: {
        near: 430,
        far: 560,
        approach: 42,
        retreat: 22,
        drift: [12, 16, 20],
        turn: 0.34,
        speed: 46,
        avoidance: 135,
        phaseGrace: 1.8
    },
    health: [440, 440, 440, 440, 620, 620, 1400],
    parts: [
        [-18, 19, -69],
        [18, 19, -69],
        [-42, 10, 39],
        [42, 10, 39],
        [-42, -8, 63],
        [42, -8, 63],
        [0, 4, -116]
    ],
    radii: [8, 8, 8, 8, 9, 9, 11],
    hull: [
        [0, -2, -83, 23],
        [0, 0, -40, 30],
        [0, 0, 10, 36],
        [0, 0, 63, 30],
        [-24, -5, 73, 15],
        [24, -5, 73, 15],
        [0, 3, 105, 20]
    ],
    engines: [
        [-28, -1, 110],
        [28, -1, 110]
    ]
} as const;
