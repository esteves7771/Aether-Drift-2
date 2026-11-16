import type { Command } from './flight';

export type PlayerShip = 'classic' | 'surveyor' | 'ptah';
export type ThrustMode = 'idle' | 'thrust' | 'boost' | 'cruise' | 'braking';
/** Nozzle centres measured in the calibrated ship's metre-space, exhaust along +Z. */
export const PLAYER_ENGINES = {
    ptah: [{ point: [0, -0.03, 3.4], radius: 0.55, length: 1.2 }],
    classic: [
        { point: [-1.05, -0.1, 2.845], radius: 0.285, length: 1 },
        { point: [1.05, -0.1, 2.845], radius: 0.285, length: 1 }
    ],
    surveyor: [
        { point: [0, -0.257, 2.445], radius: 0.3, length: 1.08 },
        { point: [-1.373, -0.148, 2.615], radius: 0.14, length: 0.66 },
        { point: [1.373, -0.148, 2.615], radius: 0.14, length: 0.66 }
    ]
} as const;
export const THRUST_STATES = {
    idle: { power: 0.13, length: 0.46, heat: 0.15, turbulence: 0.2 },
    thrust: { power: 0.6, length: 2.25, heat: 0.45, turbulence: 0.5 },
    boost: { power: 1, length: 6.2, heat: 1, turbulence: 1 },
    cruise: { power: 0.9, length: 8, heat: 0.85, turbulence: 0.32 },
    braking: { power: 0.045, length: 0.19, heat: 0.1, turbulence: 0.1 }
} as const;
/** Visual-only, time-based input envelope. Speed alone never creates forward exhaust. */
export class ThrusterState {
    mode: ThrustMode = 'idle';
    power: number = THRUST_STATES.idle.power;
    length: number = THRUST_STATES.idle.length;
    heat: number = THRUST_STATES.idle.heat;
    turbulence: number = THRUST_STATES.idle.turbulence;
    time = 0;
    readonly jets = new Float32Array(8);
    reset() {
        this.mode = 'idle';
        this.power = THRUST_STATES.idle.power;
        this.length = THRUST_STATES.idle.length;
        this.heat = THRUST_STATES.idle.heat;
        this.turbulence = THRUST_STATES.idle.turbulence;
        this.time = 0;
        this.jets.fill(0);
    }
    update(command: Command, boosting: boolean, cruising: boolean, dt: number, active = true, menu = false) {
        if ((!active && !menu) || dt <= 0) return;
        dt = Math.min(dt, 0.1);
        this.time = (this.time + dt) % 1000;
        this.mode = menu
            ? 'idle'
            : command.brake || command.z > 0
              ? 'braking'
              : cruising
                ? 'cruise'
                : boosting && command.z < 0
                  ? 'boost'
                  : command.z < 0
                    ? 'thrust'
                    : 'idle';
        const goal = THRUST_STATES[this.mode],
            a = 1 - Math.exp(-dt * (goal.power > this.power ? 11 : 7));
        this.power += (goal.power - this.power) * a;
        this.length += (goal.length - this.length) * a;
        this.heat += (goal.heat - this.heat) * a;
        this.turbulence += (goal.turbulence - this.turbulence) * a;
        const x = menu ? 0 : command.x,
            y = menu ? 0 : command.y,
            roll = menu ? 0 : command.roll;
        const jetBlend = 1 - Math.exp(-dt * 18);
        for (let i = 0; i < 8; i++) {
            const goal =
                i === 0
                    ? Math.max(0, x)
                    : i === 1
                      ? Math.max(0, -x)
                      : i === 2
                        ? Math.max(0, -y, roll * 0.65)
                        : i === 3
                          ? Math.max(0, -y, -roll * 0.65)
                          : i === 4
                            ? Math.max(0, y, -roll * 0.65)
                            : i === 5
                              ? Math.max(0, y, roll * 0.65)
                              : !menu && (command.brake || command.z > 0)
                                ? 0.55
                                : 0;
            this.jets[i] += (goal - this.jets[i]) * jetBlend;
        }
    }
}
