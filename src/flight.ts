import { Quat, Vec3 } from 'playcanvas';

import { COMBAT } from './combat-config';
import { FLIGHT } from './config';
import { EvasiveRoll } from './evasive-roll';
import { SHIP_MOUNTS, SHIPS } from './ship-config';
import type { PlayerShip } from './thruster-state';
export interface Command {
    x: number;
    y: number;
    z: number;
    pitch: number;
    yaw: number;
    roll: number;
    brake: boolean;
    boost: boolean;
}
export const neutral = (): Command => ({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, brake: false, boost: false });
export class Flight {
    readonly evasion = new EvasiveRoll();
    ship: PlayerShip = 'classic';
    get spec() {
        return SHIPS[this.ship];
    }
    get shieldCapacity() {
        return this.spec.shield;
    }
    setShip(key: PlayerShip) {
        if (key !== this.ship) {
            this.ship = key;
            this.shield = this.shieldCapacity;
        }
    }
    get radius() {
        return SHIP_MOUNTS[this.ship].radius;
    }
    readonly position = new Vec3();
    readonly previous = new Vec3();
    readonly velocity = new Vec3();
    readonly rotation = new Quat();
    readonly previousRotation = new Quat();
    hull = 100;
    shield = COMBAT.shield.capacity as number;
    energy = 100;
    boosting = false;
    boostEfficiency = 1;
    impact = 0;
    private readonly local = new Vec3();
    private readonly force = new Vec3();
    private readonly delta = new Quat();
    reset() {
        this.evasion.reset();
        this.position.set(0, 0, 0);
        this.previous.copy(this.position);
        this.velocity.set(0, 0, 0);
        this.rotation.set(0, 0, 0, 1);
        this.previousRotation.copy(this.rotation);
        this.hull = this.energy = 100;
        this.shield = this.shieldCapacity;
        this.impact = 0;
        this.boosting = false;
        this.boostEfficiency = 1;
    }
    step(c: Command, dt: number, assist: boolean) {
        this.previous.copy(this.position);
        this.previousRotation.copy(this.rotation);
        this.delta.setFromEulerAngles(
            c.pitch * FLIGHT.turnRate * this.spec.turn * dt,
            c.yaw * FLIGHT.turnRate * this.spec.turn * dt,
            c.roll * FLIGHT.turnRate * this.spec.turn * dt
        );
        this.rotation.mul(this.delta).normalize();
        this.evasion.step(this, dt);
        this.boosting = c.boost && c.z < 0 && this.energy > FLIGHT.boostDrain * this.boostEfficiency * dt;
        this.energy = Math.min(
            100,
            Math.max(
                0,
                this.energy + (this.boosting ? -FLIGHT.boostDrain * this.boostEfficiency : FLIGHT.boostRecharge) * dt
            )
        );
        this.local.set(c.x, c.y, c.z);
        if (this.local.lengthSq() > 1) this.local.normalize();
        this.rotation
            .transformVector(this.local, this.force)
            .mulScalar((this.boosting ? FLIGHT.boostAcceleration : FLIGHT.acceleration) * this.spec.acceleration);
        this.velocity.add(this.force.mulScalar(dt));
        this.velocity.mulScalar(Math.exp(-(c.brake ? FLIGHT.brake : assist ? FLIGHT.drag : 0) * dt));
        const limit = (this.boosting ? FLIGHT.boostSpeed : FLIGHT.maxSpeed) * this.spec.speed;
        if (this.velocity.length() > limit) this.velocity.mulScalar(Math.exp(-2 * dt));
        this.position.add(this.force.copy(this.velocity).mulScalar(dt));
        this.impact = Math.max(0, this.impact - dt * 1.7);
    }
}
