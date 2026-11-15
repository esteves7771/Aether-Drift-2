import { PLAYER_ENGINES } from './thruster-state';

/** Offline inspector bounds are decoded vertices. Calibration stays below semantic simulation roots. */
export const MODEL_TUNING = {
    satellite: {
        file: 'satellite.glb',
        dims: [0.9, 1.7542, 4.0619],
        center: [0.0321, 0.3683, 0],
        size: 10,
        dimension: 2,
        yaw: 90
    },
    raider: {
        file: 'spaceship-free-001.glb',
        dims: [6.3621, 1.508, 2.97],
        center: [0, 0, 0],
        size: 7.2,
        dimension: 0,
        yaw: 90
    },
    surveyor: { file: 'spaceship.glb', dims: [1.3248, 0.5102, 2], center: [0, 0, 0], size: 5.2, dimension: 2, yaw: 0 },
    heavy: {
        file: 'futuristic-sci-fi-spaceship.glb',
        dims: [46.8929, 23.214, 35.1023],
        center: [-0.0212, 6.2078, -2.7658],
        size: 10.4,
        dimension: 0,
        yaw: 0
    },
    saucer: {
        file: 'alien-flying-saucer.glb',
        dims: [1.9278, 0.5741, 1.9309],
        center: [-0.0313, 0.0578, -0.0042],
        size: 7.2,
        dimension: 2,
        yaw: 0
    },
    iss: {
        file: 'iss.glb',
        dims: [14.5064, 45.4325, 45.5444],
        center: [-3.9655, 18.5477, -0.0924],
        size: 130,
        dimension: 2,
        yaw: 25
    },
    station: {
        file: 'sci-fi-space-station.glb',
        dims: [35.4757, 35.4784, 46.2828],
        center: [0, 0.0014, -1.5996],
        size: 220,
        dimension: 2,
        yaw: -25
    },
    turret: {
        file: 'turret.glb',
        dims: [10.2697, 5.0137, 14.624],
        center: [0.097, 2.5068, -2.1622],
        size: 12,
        dimension: 2,
        yaw: 0
    },
    tesser: { file: 'tesser.glb', dims: [2, 0.496, 0.8823], center: [0, 0, 0], size: 180, dimension: 0, yaw: 0 },
    astronaut: {
        file: 'astronaut.glb',
        dims: [2.6194, 2.3715, 0.7119],
        center: [0, 1.1851, -0.0637],
        size: 2.2,
        dimension: 1,
        yaw: 180
    },
    cargo: {
        file: 'sci-fi-box.glb',
        dims: [0.9534, 1.5899, 0.9779],
        center: [-1.8563, -0.1606, -8.702],
        size: 4,
        dimension: 1,
        yaw: 0
    }
} as const;
export type ModelKey = keyof typeof MODEL_TUNING;
export const MODEL_MOUNTS = {
    raider: {
        radius: 3.8,
        muzzle: [0, 0, -4.8],
        engines: [
            [-1, -0.2, 3],
            [1, -0.2, 3]
        ]
    },
    heavy: {
        radius: 5.8,
        muzzle: [0, 0, -6.8],
        engines: [
            [-1.3, -0.4, 3],
            [1.3, -0.4, 3]
        ]
    },
    saucer: {
        radius: 3.8,
        muzzle: [0, 0, -4.8],
        engines: [
            [-1, -0.6, 1.8],
            [1, -0.6, 1.8]
        ]
    },
    surveyor: {
        radius: 2.4,
        muzzle: [1.35, -0.12, -2.8],
        engines: PLAYER_ENGINES.surveyor.map((nozzle) => nozzle.point)
    }
} as const;
