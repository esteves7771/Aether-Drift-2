import { Quat, Vec3 } from 'playcanvas';

import type { CombatTarget } from './combat-target';
import { EVOLUTION } from './evolution-config';
import type { Flight } from './flight';
export class Missile {
    active = false;
    readonly hostile = false;
    readonly missile = true;
    targetId = -1;
    damage = EVOLUTION.missile.damage;
    radius = EVOLUTION.missile.radius;
    life = 0;
    speed = 0;
    readonly position = new Vec3();
    readonly previous = new Vec3();
    readonly velocity = new Vec3();
    readonly direction = new Vec3();
    readonly inherited = new Vec3();
}
export class Missiles {
    readonly items = Array.from({ length: EVOLUTION.missile.capacity }, () => new Missile());
    private readonly desired = new Vec3();
    private readonly axis = new Vec3();
    private readonly delta = new Vec3();
    private readonly rotation = new Quat();
    reset() {
        for (const m of this.items) m.active = false;
    }
    launch(ship: Flight, target: CombatTarget) {
        const m = this.items.find((m) => !m.active);
        if (!m) return false;
        m.active = true;
        m.targetId = target.id;
        m.life = EVOLUTION.missile.lifetime;
        m.speed = EVOLUTION.missile.launchSpeed;
        ship.rotation.transformVector(this.delta.set(0, -0.65, -2.8), m.position).add(ship.position);
        m.previous.copy(m.position);
        ship.rotation.transformVector(Vec3.FORWARD, m.direction);
        m.inherited.copy(ship.velocity).mulScalar(0.35);
        return true;
    }
    step(dt: number, target: (id: number) => CombatTarget | undefined) {
        for (const m of this.items)
            if (m.active) {
                m.previous.copy(m.position);
                m.life -= dt;
                if (m.life <= 0) {
                    m.active = false;
                    continue;
                }
                const t = target(m.targetId);
                if (t?.active && t.targetable) {
                    const distance = this.delta.sub2(t.position, m.position).length();
                    this.desired
                        .copy(t.velocity)
                        .mulScalar(Math.min(1, distance / EVOLUTION.missile.speed) * 0.65)
                        .add(t.position)
                        .sub(m.position)
                        .normalize();
                    const dot = Math.max(-1, Math.min(1, m.direction.dot(this.desired))),
                        angle = Math.acos(dot);
                    if (angle > 1e-6) {
                        this.axis.cross(m.direction, this.desired);
                        if (this.axis.lengthSq() < 1e-8) {
                            this.axis.cross(m.direction, Vec3.UP);
                            if (this.axis.lengthSq() < 1e-8) this.axis.cross(m.direction, Vec3.RIGHT);
                        }
                        this.axis.normalize();
                        this.rotation.setFromAxisAngle(
                            this.axis,
                            (Math.min(angle, EVOLUTION.missile.turnRate * dt) * 180) / Math.PI
                        );
                        this.rotation.transformVector(m.direction, m.direction).normalize();
                    }
                } else m.targetId = -1;
                m.speed = Math.min(EVOLUTION.missile.speed, m.speed + EVOLUTION.missile.acceleration * dt);
                m.velocity.copy(m.direction).mulScalar(m.speed).add(m.inherited);
                m.position.add(this.delta.copy(m.velocity).mulScalar(dt));
            }
    }
}
