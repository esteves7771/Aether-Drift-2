import { Mat4, Quat, Vec3 } from 'playcanvas';

import { ARTILLERY } from './artillery-config';
import { Boss, BossPart } from './boss';
import { BossPatterns } from './boss-patterns';
import type { Rock } from './collisions';
import type { Flight } from './flight';
import type { Projectiles } from './projectiles';
import { RiftArrival } from './rift-arrival';

/** Heavy assault encounter; component IDs and established scoring/death/music contracts are retained. */
export class Artillery extends Boss {
    readonly arrival = new RiftArrival();
    readonly patterns = new BossPatterns();
    avoidance: readonly Rock[] = [];
    beamCooldown = 0;
    hitFlash = 0;
    override readonly parts = ARTILLERY.parts.map(
        (p, i) =>
            new BossPart(
                8 + i,
                new Vec3(...p),
                ARTILLERY.radii[i],
                i < 4
                    ? (i % 2 ? 'STARBOARD' : 'PORT') + ' ARTILLERY BANK ' + (Math.floor(i / 2) + 1)
                    : i < 6
                      ? (i === 4 ? 'PORT' : 'STARBOARD') + ' COOLANT MANIFOLD'
                      : 'FRONTAL COMMAND REACTOR'
            )
    );
    override readonly hull = ARTILLERY.hull.map(([x, y, z, radius]) => ({
        local: new Vec3(x, y, z),
        position: new Vec3(),
        previous: new Vec3(),
        radius
    }));
    private readonly sources = { banks: this.parts.slice(0, 4), muzzle: this.parts[6].position };
    private readonly vectorA = new Vec3();
    private readonly lateralA = new Vec3();
    private readonly matrixA = new Mat4();
    private readonly desiredA = new Quat();
    private wasDisrupted = false;
    override get arriving() {
        return this.active && !this.arrival.complete;
    }
    override get maxHealth() {
        return ARTILLERY.health.reduce((a, b) => a + b, 0);
    }
    override get attackName() {
        return this.patterns.spec.name;
    }
    override get firingBank() {
        const bank = this.patterns.bank;
        return this.parts.some((p, i) => i < 4 && i % 2 === bank && p.active) ? bank : 1 - bank;
    }
    override reset() {
        super.reset();
        this.arrival.reset();
        this.patterns.reset();
        this.beamCooldown = this.hitFlash = 0;
        this.wasDisrupted = false;
    }
    override spawn(ship: Flight, rocks: Rock[]) {
        super.spawn(ship, rocks);
        this.parts.forEach((p, i) => {
            p.health = p.maxHealth = ARTILLERY.health[i];
            p.exposed = false;
        });
        this.arrival.begin(ship, rocks);
        this.arrival.sample(this.position);
        this.previous.copy(this.position);
        this.rotation.copy(this.arrival.rotation);
        this.previousRotation.copy(this.rotation);
        this.updateParts(1);
    }
    protected override updateParts(dt: number) {
        super.updateParts(dt);
        this.expose();
        this.batteryA.copy(this.parts[0].position);
        this.batteryB.copy(this.parts[1].position);
    }
    private expose() {
        const open = !this.arriving && this.grace <= 0 && (this.patterns.state === 'recover' || this.disrupted > 0);
        for (let i = 0; i < this.parts.length; i++) {
            const p = this.parts[i];
            p.exposed =
                open &&
                (this.phase === 1
                    ? i < 4 && i % 2 === this.firingBank
                    : this.phase === 2
                      ? i === 4 || i === 5
                      : i === 6);
        }
    }
    override damage(part: BossPart, amount: number) {
        if (!this.active || !part.targetable) return false;
        const phase = this.phase;
        this.hitFlash = 1;
        const destroyed = super.damage(part, amount);
        if (this.phase !== phase) {
            this.grace = ARTILLERY.tactics.phaseGrace;
            this.patterns.reset(this.phase);
        }
        if (!this.active) this.patterns.beamActive = false;
        return destroyed;
    }
    private move(dt: number, ship: Flight, rocks: Rock[]) {
        const t = ARTILLERY.tactics;
        this.vectorA.sub2(ship.position, this.position);
        const distance = this.vectorA.length();
        if (distance > 1) {
            this.matrixA.setLookAt(
                this.position,
                ship.position,
                Math.abs(this.vectorA.y / distance) > 0.98 ? Vec3.RIGHT : Vec3.UP
            );
            this.desiredA.setFromMat4(this.matrixA);
            this.rotation.slerp(this.rotation, this.desiredA, 1 - Math.exp(-t.turn * dt));
        }
        this.velocity
            .copy(this.vectorA)
            .normalize()
            .mulScalar(distance > t.far ? t.approach : distance < t.near ? -t.retreat : 0);
        this.lateralA
            .cross(this.vectorA, Vec3.UP)
            .normalize()
            .mulScalar(
                t.drift[this.phase - 1] *
                    (this.patterns.index % 2 ? 1 : -1) *
                    (this.patterns.state === 'telegraph' ? 0.4 : 1)
            );
        this.velocity.add(this.lateralA);
        this.velocity.y += Math.sin(this.age * 0.42) * 6;
        for (const group of [rocks, this.avoidance])
            for (const r of group) {
                this.vectorA.sub2(this.position, r.position);
                const d = this.vectorA.length(),
                    safe = r.radius + t.avoidance;
                if (d < safe && d > 0.01) this.velocity.add(this.vectorA.mulScalar(((safe - d) * 1.4) / d));
            }
        if (this.velocity.lengthSq() > t.speed * t.speed) this.velocity.normalize().mulScalar(t.speed);
        this.position.add(this.vectorA.copy(this.velocity).mulScalar(dt));
    }
    override step(dt: number, ship: Flight, rocks: Rock[], shots: Projectiles) {
        this.dying = Math.max(0, this.dying - dt);
        this.hitFlash = Math.max(0, this.hitFlash - dt * 7);
        this.beamCooldown = Math.max(0, this.beamCooldown - dt);
        if (!this.active) {
            this.patterns.beamActive = false;
            return;
        }
        this.previous.copy(this.position);
        this.previousRotation.copy(this.rotation);
        this.age += dt;
        this.collisionCooldown -= dt;
        if (this.arriving) {
            this.arrival.step(dt, ship, rocks);
            this.arrival.sample(this.position);
            this.rotation.copy(this.arrival.rotation);
            this.velocity.sub2(this.position, this.previous).mulScalar(dt > 0 ? 1 / dt : 0);
            this.updateParts(dt > 0 ? dt : 1);
            this.charge = 0;
            return;
        }
        this.grace = Math.max(0, this.grace - dt);
        this.move(dt, ship, rocks);
        this.updateParts(dt > 0 ? dt : 1);
        if (this.grace > 0) {
            this.patterns.beamActive = false;
            this.charge = 0;
            return;
        }
        if (this.disrupted > 0) {
            if (!this.wasDisrupted) this.patterns.interrupt();
            this.wasDisrupted = true;
            this.disrupted = Math.max(0, this.disrupted - dt);
            this.charge = 0;
            return;
        }
        this.wasDisrupted = false;
        const last = this.patterns.index;
        this.patterns.step(dt, this.phase, ship, this.sources, shots, rocks);
        if (last !== this.patterns.index) this.attack++;
        this.aim.copy(this.patterns.aim);
        this.charge = this.patterns.winding;
        this.cooldown =
            this.patterns.state === 'recover'
                ? Math.max(0, this.patterns.spec.recovery[this.phase - 1] - this.patterns.time)
                : 0;
        this.expose();
    }
}
