import type { PlayerShip } from './thruster-state';
/** Shared implementation consumes these calibrated ship-space attachment points. */
export const SHIP_MOUNTS = {
    classic: {
        radius: 2.4,
        muzzles: [
            [-1.35, -0.12, -2.8],
            [1.35, -0.12, -2.8]
        ],
        camera: [0, 0.55, -1.2]
    },
    surveyor: {
        radius: 2.4,
        muzzles: [
            [-1.35, -0.12, -2.8],
            [1.35, -0.12, -2.8]
        ],
        camera: [0, 0.4, -0.9]
    },
    ptah: {
        radius: 2.7,
        muzzles: [
            [-2.95, -0.07, 1.2],
            [2.95, -0.07, 1.2]
        ],
        camera: [0, 0.65, 0.8]
    }
} as const satisfies Record<PlayerShip, unknown>;

export interface ShipSpec {
    name: string;
    acceleration: number;
    turn: number;
    speed: number;
    shield: number;
    weapon: {
        name: string;
        damage: number;
        speed: number;
        burst: number;
        interval: number;
        recovery: number;
        tag: number;
    };
}
/** AE-01 is the reference; sustained nominal DPS stays within 6% across the three hulls. */
export const SHIPS: Record<PlayerShip, ShipSpec> = {
    classic: {
        name: 'AE-01',
        acceleration: 1,
        turn: 1,
        speed: 1,
        shield: 70,
        weapon: {
            name: 'TWIN PRECISION LASERS',
            damage: 14,
            speed: 480,
            burst: 1,
            interval: 0,
            recovery: 1 / 7,
            tag: 0
        }
    },
    surveyor: {
        name: 'SURVEYOR',
        acceleration: 0.9,
        turn: 0.94,
        speed: 0.96,
        shield: 90,
        weapon: {
            name: 'SUSTAINED ENERGY CANNONS',
            damage: 11,
            speed: 420,
            burst: 1,
            interval: 0,
            recovery: 1 / 9,
            tag: 6
        }
    },
    ptah: {
        name: 'PTAH',
        acceleration: 1.16,
        turn: 1.1,
        speed: 1.08,
        shield: 55,
        weapon: {
            name: 'BURST PLASMA CANNONS',
            damage: 15,
            speed: 360,
            burst: 3,
            interval: 0.085,
            recovery: 0.31,
            tag: 7
        }
    }
};
