export const FLIGHT = {
    step: 1 / 120,
    acceleration: 25,
    boostAcceleration: 65,
    maxSpeed: 95,
    boostSpeed: 190,
    drag: 0.7,
    brake: 3.2,
    turnRate: 95,
    radius: 2.4,
    boostDrain: 24,
    boostRecharge: 16
} as const;
export interface Settings {
    sensitivity: number;
    distance: number;
    assist: boolean;
    challenges: boolean;
    cameraEffects: boolean;
    volume: number;
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    graphics: GraphicsQuality;
}
export type GraphicsQuality = 'low' | 'medium' | 'high';
export const defaults: Settings = {
    sensitivity: 1,
    distance: 19,
    assist: true,
    challenges: true,
    cameraEffects: true,
    volume: 0.25,
    masterVolume: 1,
    musicVolume: 0.15,
    sfxVolume: 0.25,
    graphics: 'medium'
};
export function loadSettings(): Settings {
    try {
        const v = JSON.parse(localStorage.getItem('aether-drift-2-settings') || '{}');
        const volume = (value: unknown, fallback: number) =>
            typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
        return {
            masterVolume: volume(v.masterVolume, defaults.masterVolume),
            musicVolume: volume(v.musicVolume, defaults.musicVolume),
            sfxVolume: volume(v.sfxVolume, volume(v.volume, defaults.sfxVolume)),
            graphics: v.graphics === 'low' || v.graphics === 'high' ? v.graphics : 'medium',
            sensitivity: Math.min(2, Math.max(0.2, Number(v.sensitivity) || 1)),
            distance: Math.min(34, Math.max(12, Number(v.distance) || 19)),
            cameraEffects: typeof v.cameraEffects === 'boolean' ? v.cameraEffects : true,
            challenges: typeof v.challenges === 'boolean' ? v.challenges : true,
            assist: typeof v.assist === 'boolean' ? v.assist : true,
            volume:
                typeof v.volume === 'number' && Number.isFinite(v.volume)
                    ? Math.min(1, Math.max(0, v.volume))
                    : defaults.volume
        };
    } catch {
        return { ...defaults };
    }
}
