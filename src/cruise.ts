import { Vec3 } from 'playcanvas';

import type { Rock } from './collisions';
import { FLIGHT } from './config';
import type { Command, Flight } from './flight';
import { FRONTIER } from './frontier-config';
import { sweptHit } from './projectiles';

/** Separate travel envelope; normal Flight.step remains the only rotation integrator. */
export class Cruise {
    active = false;
    settling = false;
    cooldown = 0;
    reason = 'C / CRUISE';
    private damage = 0;
    private readonly forward = new Vec3();
    private readonly desired = new Vec3();
    private readonly end = new Vec3();
    reset() {
        this.active = this.settling = false;
        this.cooldown = this.damage = 0;
        this.reason = 'C / CRUISE';
    }
    toggle(ship: Flight, blocked: boolean) {
        if (this.active) {
            this.cancel('DECELERATING');
            return;
        }
        if (blocked || this.cooldown > 0 || this.settling || ship.hull <= 0) {
            this.reason = blocked ? 'CRUISE LOCKED / HOSTILES NEARBY' : 'CRUISE COOLING';
            return;
        }
        this.active = true;
        this.damage = ship.hull + ship.shield;
        this.reason = 'CRUISE ENGAGED / C OR X TO EXIT';
    }
    cancel(reason: string) {
        if (this.active) {
            this.active = false;
            this.settling = true;
            this.cooldown = FRONTIER.cruise.cooldown;
        }
        this.reason = reason;
    }
    step(
        ship: Flight,
        command: Command,
        dt: number,
        assist: boolean,
        blocked: boolean,
        firing: boolean,
        rocks: Rock[]
    ) {
        this.cooldown = Math.max(0, this.cooldown - dt);
        if (!this.active && !this.settling && this.cooldown <= 0)
            this.reason = blocked ? 'CRUISE LOCKED / HOSTILES NEARBY' : 'C / CRUISE';
        if (
            this.active &&
            (blocked ||
                firing ||
                command.boost ||
                command.brake ||
                command.z > 0 ||
                ship.hull + ship.shield < this.damage)
        )
            this.cancel(blocked ? 'COMBAT CONTACT / DECELERATING' : 'DECELERATING');
        if (this.active) {
            this.end.copy(ship.velocity).mulScalar(1.5).add(ship.position);
            for (const r of rocks)
                if (
                    sweptHit(
                        ship.position,
                        this.end,
                        r.position,
                        r.position,
                        r.radius + FRONTIER.cruise.rockClearance
                    ) < Infinity
                ) {
                    this.cancel('OBSTACLE / DECELERATING');
                    break;
                }
        }
        if (!this.active && !this.settling) {
            ship.step(command, dt, assist);
            return;
        }
        // Flight's ordinary damping/limits must not clamp the independent travel envelope.
        this.desired.copy(ship.velocity);
        const speed = this.desired.length();
        ship.velocity.set(0, 0, 0);
        const boost = command.boost;
        command.boost = false;
        ship.step(command, dt, assist);
        command.boost = boost;
        const targetSpeed = this.active ? FRONTIER.cruise.speed : Math.min(speed, FLIGHT.maxSpeed);
        const nextSpeed =
            speed +
            Math.max(
                -FRONTIER.cruise.deceleration * dt,
                Math.min(FRONTIER.cruise.acceleration * dt, targetSpeed - speed)
            );
        ship.rotation.transformVector(Vec3.FORWARD, this.forward).mulScalar(nextSpeed);
        this.desired.lerp(this.desired, this.forward, 1 - Math.exp(-1.5 * dt));
        if (this.desired.length() > 0.001) this.desired.normalize().mulScalar(nextSpeed);
        ship.velocity.copy(this.desired);
        ship.position.copy(ship.previous).add(this.forward.copy(ship.velocity).mulScalar(dt));
        ship.boosting = false;
        if (!this.active && nextSpeed <= FRONTIER.cruise.settleSpeed) {
            this.settling = false;
            this.reason = 'COMBAT FLIGHT';
        }
    }
}
