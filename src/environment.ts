/** One concrete sector definition; no universe generator, switching UI or unfinished portals. */
export interface EnvironmentDefinition {
    name: string;
    signalColor: string;
    nebula: { base: readonly number[]; dust: readonly number[]; blue: readonly number[]; vein: readonly number[] };
    planet: { name: string; position: readonly [number, number, number]; radius: number; tilt: number };
}
export const PERSEID: EnvironmentDefinition = {
    name: 'PERSEID EXPANSE',
    signalColor: '#70ebd8',
    nebula: { base: [2, 4, 10], dust: [145, 35, 230], blue: [15, 45, 0], vein: [80, 40, 110] },
    planet: { name: 'Aether gas giant', position: [1600, 600, -3400], radius: 625, tilt: -14 }
};
