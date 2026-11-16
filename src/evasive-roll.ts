import { Quat, Vec3 } from 'playcanvas';

import { BULLETHELL } from './bullethell-config';
import type { Flight } from './flight';
export const EVADE = BULLETHELL.evade;
/** Actual bounded lateral impulse and local-axis attitude rotation; no invulnerability or projectile removal. */
export class EvasiveRoll {
    active = false;
    age = 0;
    cooldown = 0;
    side = 1;
    angle = 0;
    previousAngle = 0;
    private readonly impulse = new Vec3();
    private readonly roll = new Quat();
    reset() {
        this.active = false;
        this.age = this.cooldown = this.angle = this.previousAngle = 0;
        this.side = 1;
    }
    trigger(ship: Flight, side: number) {
        if (this.active || this.cooldown > 0 || ship.hull <= 0) return false;
        this.side = side < 0 ? -1 : 1;
        this.active = true;
        this.age = 0;
        this.angle = this.previousAngle = 0;
        this.cooldown = EVADE.cooldown;
        const before = ship.velocity.length();
        ship.rotation.transformVector(this.impulse.set(this.side, 0, 0), this.impulse).mulScalar(EVADE.impulse);
        ship.velocity.add(this.impulse);
        const cap = Math.max(before, 190 * ship.spec.speed);
        if (ship.velocity.length() > cap) ship.velocity.normalize().mulScalar(cap);
        return true;
    }
    step(ship: Flight, dt: number) {
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.previousAngle = this.angle;
        if (!this.active) return;
        this.age = Math.min(EVADE.duration, this.age + dt);
        const t = this.age / EVADE.duration;
        this.angle = -this.side * 360 * t * t * (3 - 2 * t);
        this.roll.setFromEulerAngles(0, 0, this.angle - this.previousAngle);
        ship.rotation.mul(this.roll).normalize();
        if (this.age >= EVADE.duration) this.active = false;
    }
}
