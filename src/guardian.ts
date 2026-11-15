import { Quat, Vec3 } from 'playcanvas';

import { Boss, BossPart } from './boss';
import type { Rock } from './collisions';
import type { Flight } from './flight';
import { GUARDIAN } from './guardian-config';
import type { Projectiles } from './projectiles';
import { sweptHit } from './projectiles';

/** Environmental component encounter: perimeter towers → power nodes → exposed reactor. */
export class Guardian extends Boss {
    override readonly parts = GUARDIAN.parts.map(
        (v, i) =>
            new BossPart(
                22 + i,
                new Vec3(...v),
                GUARDIAN.radius[i],
                i < 4 ? 'GUARDIAN TOWER ' + (i + 1) : i < 6 ? 'FORTRESS POWER NODE' : 'FORTRESS REACTOR'
            )
    );
    override readonly hull: Boss['hull'] = [
        { local: new Vec3(), position: new Vec3(), previous: new Vec3(), radius: GUARDIAN.hullRadius }
    ];
    escortsPending = false;
    private escortsReleased = false;
    readonly warningOrigin = new Vec3();
    private readonly lockedOrigin = new Vec3();
    private readonly deltaG = new Vec3();
    private readonly directionG = new Vec3();
    private readonly sideG = new Vec3();
    private readonly upG = new Vec3();
    private readonly zeroG = new Vec3();
    private readonly yawG = new Quat();
    override get maxHealth() {
        return GUARDIAN.health.reduce((a, b) => a + b, 0);
    }
    override get arriving() {
        return this.active && this.age < GUARDIAN.arrival;
    }
    override get attackName(): string {
        return this.phase === 1
            ? 'PERIMETER BATTERY / BREAK AIM'
            : this.phase === 2
              ? 'ROTATING DEFENSE / OPEN LANES'
              : this.attack % 2
                ? 'OVERLOAD BLOOM'
                : 'REACTOR LANCE / BREAK AIM';
    }
    override reset() {
        super.reset();
        this.escortsPending = this.escortsReleased = false;
    }
    override spawn(ship: Flight, rocks: Rock[]) {
        this.reset();
        this.active = true;
        this.age = 0;
        this.phase = 1;
        this.grace = this.disrupted = 0;
        this.cooldown = 1.8;
        this.velocity.set(0, 0, 0);
        // Reserve a physically large clear footprint. Farther search avoids rock overlap.
        for (let i = 0; i < 96; i++) {
            ship.rotation
                .transformVector(
                    this.deltaG.set(Math.sin(i * 2.4) * 200, Math.cos(i * 1.8) * 140, -600 - i * 24),
                    this.position
                )
                .add(ship.position);
            if (rocks.every((r) => r.position.distance(this.position) > r.radius + 165)) break;
        }
        this.previous.copy(this.position);
        this.rotation.copy(ship.rotation);
        this.previousRotation.copy(this.rotation);
        for (let i = 0; i < this.parts.length; i++) {
            const p = this.parts[i];
            p.active = true;
            p.exposed = false;
            p.health = p.maxHealth = GUARDIAN.health[i];
            p.velocity.set(0, 0, 0);
        }
        this.sync(0);
    }
    private sync(dt: number) {
        for (const p of this.parts) {
            p.previous.copy(p.position);
            this.rotation.transformVector(p.local, p.position).add(this.position);
            if (dt > 0) p.velocity.sub2(p.position, p.previous).mulScalar(1 / dt);
            else p.previous.copy(p.position);
            const i = p.id - 22;
            p.exposed =
                p.active &&
                !this.arriving &&
                this.grace <= 0 &&
                (this.phase === 1 ? i < 4 : this.phase === 2 ? i === 4 || i === 5 : i === 6);
        }
        this.hull[0].previous.copy(this.hull[0].position);
        this.hull[0].position.copy(this.position);
        if (dt === 0) this.hull[0].previous.copy(this.position);
    }
    override damage(p: BossPart, amount: number) {
        if (!this.active || !p.targetable) return false;
        p.health = Math.max(0, p.health - amount);
        if (p.health > 0) return false;
        p.active = false;
        if (p.id === 28) {
            this.active = false;
            this.dying = 6.4;
            this.charge = 0;
            this.deathStage = -1;
            return true;
        }
        if (this.phase === 1 && this.parts.slice(0, 4).every((t) => !t.active)) {
            this.phase = 2;
            this.grace = GUARDIAN.grace;
            this.charge = 0;
            this.cooldown = 1.4;
            this.escortsPending = !this.escortsReleased;
        } else if (this.phase === 2 && !this.parts[4].active && !this.parts[5].active) {
            this.phase = 3;
            this.grace = GUARDIAN.grace;
            this.charge = 0;
            this.cooldown = 1.4;
        }
        this.sync(0);
        return true;
    }
    override step(dt: number, ship: Flight, rocks: Rock[], shots: Projectiles) {
        this.dying = Math.max(0, this.dying - dt);
        if (!this.active) return;
        this.age += dt;
        this.grace = Math.max(0, this.grace - dt);
        this.cooldown -= dt;
        this.previousRotation.copy(this.rotation);
        this.yawG.setFromEulerAngles(0, GUARDIAN.rotationSpeed * dt, 0);
        this.rotation.mul(this.yawG).normalize();
        this.sync(dt);
        if (this.escortsPending) this.escortsReleased = true;
        if (this.disrupted > 0) {
            this.disrupted = Math.max(0, this.disrupted - dt);
            this.charge = 0;
            this.cooldown = Math.max(1.2, this.cooldown);
            return;
        }
        if (this.arriving || this.grace > 0) return;
        if (this.charge > 0) {
            this.charge -= dt;
            if (this.charge <= 0) {
                this.fireGuardian(shots);
                this.attack++;
                this.cooldown = GUARDIAN.cooldown[this.phase - 1];
            }
        } else if (this.cooldown <= 0 && ship.position.distance(this.position) < 1100) {
            let index = -1;
            // Select a surviving battery with a clear outward arc; a hidden bank cannot stall the encounter.
            for (let n = 0; n < 7; n++) {
                const candidate = (this.attack + n) % 7,
                    p = this.parts[candidate];
                if (
                    p.targetable &&
                    sweptHit(p.position, ship.position, this.position, this.position, GUARDIAN.hullRadius + 2) ===
                        Infinity
                ) {
                    index = candidate;
                    break;
                }
            }
            if (index < 0) return;
            const p = this.parts[index];
            for (const r of rocks)
                if (sweptHit(p.position, ship.position, r.position, r.position, r.radius + 2) < Infinity) return;
            this.lockedOrigin.copy(p.position);
            this.warningOrigin.copy(p.position);
            this.batteryA.copy(p.position);
            this.batteryB.copy(p.position);
            this.aim.copy(ship.velocity).mulScalar(0.45).add(ship.position);
            this.charge = GUARDIAN.windup[this.phase - 1];
        }
    }
    private fireGuardian(shots: Projectiles) {
        let active = 0;
        for (const p of shots.items) if (p.active && p.hostile) active++;
        const count = Math.max(0, Math.min(GUARDIAN.projectiles[this.phase - 1], GUARDIAN.projectileLimit - active));
        this.directionG.sub2(this.aim, this.lockedOrigin).normalize();
        this.sideG.cross(this.directionG, Math.abs(this.directionG.y) > 0.98 ? Vec3.RIGHT : Vec3.UP).normalize();
        this.upG.cross(this.sideG, this.directionG).normalize();
        for (let i = 0; i < count; i++) {
            this.deltaG.copy(this.directionG);
            if (this.phase === 3 && this.attack % 2) {
                const a = (i / count) * Math.PI * 2;
                this.deltaG.add(this.zeroG.copy(this.sideG).mulScalar(Math.cos(a) * 0.13));
                this.deltaG.add(this.zeroG.copy(this.upG).mulScalar(Math.sin(a) * 0.13));
            } else
                this.deltaG.add(
                    this.zeroG.copy(this.attack % 2 ? this.upG : this.sideG).mulScalar((i - (count - 1) / 2) * 0.024)
                );
            this.deltaG.normalize();
            this.zeroG.set(0, 0, 0);
            shots.spawn(
                this.lockedOrigin,
                this.deltaG,
                this.zeroG,
                GUARDIAN.speed[this.phase - 1],
                GUARDIAN.damage[this.phase - 1],
                6,
                true,
                this.phase === 2 && i < 2
            );
        }
    }
}
