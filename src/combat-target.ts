import type { Vec3 } from 'playcanvas';
export interface CombatTarget {
    readonly targetRole?: 'craft' | 'boss' | 'defense' | 'environment';
    readonly generation?: number;
    readonly id: number;
    active: boolean;
    health: number;
    maxHealth: number;
    readonly position: Vec3;
    readonly previous: Vec3;
    readonly velocity: Vec3;
    readonly radius: number;
    readonly label: string;
    readonly targetable: boolean;
}
