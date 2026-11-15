/** Reusable arrival envelope; seconds/metres, separate from encounter damage tuning. */
export const RIFT = {
    gather: 2,
    form: 2.2,
    emerge: 5.8,
    collapse: 1.8,
    settle: 0.6,
    radius: 110,
    behind: 170,
    ahead: 190,
    bodyHalfLength: 125,
    clearance: 120,
    candidates: 512,
    distance: 680,
    accent: [0.38, 0.24, 1.3],
    distortion: 0.035
} as const;
export interface RiftTuning {
    gather: number;
    form: number;
    emerge: number;
    collapse: number;
    settle: number;
    radius: number;
    behind: number;
    ahead: number;
    bodyHalfLength: number;
    clearance: number;
    candidates: number;
    distance: number;
    accent: readonly [number, number, number];
    distortion: number;
}
