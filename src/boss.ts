import { Mat4, Quat, Vec3 } from 'playcanvas';

import { BULLETHELL } from './bullethell-config';
import type { Rock } from './collisions';
import type { CombatTarget } from './combat-target';
import { EVOLUTION } from './evolution-config';
import type { Flight } from './flight';
import type { Projectiles } from './projectiles';
import { SPECTACLE } from './spectacle-config';

export class BossPart implements CombatTarget {
    readonly targetRole = 'boss' as const;
    active = false;
    generation = 0;
    health = 0;
    maxHealth = 0;
    exposed = false;
    readonly position = new Vec3();
    readonly previous = new Vec3();
    readonly velocity = new Vec3();
    readonly id: number;
    readonly local: Vec3;
    readonly radius: number;
    readonly label: string;
    constructor(id: number, local: Vec3, radius: number, label: string) {
        this.id = id;
        this.local = local;
        this.radius = radius;
        this.label = label;
    }
    get targetable() {
        return this.active && this.exposed;
    }
}
/** Component-gated phases: turrets, cooling nodes, reactor. No hidden health gate. */
export class Boss {
    active = false;
    age = 0;
    dying = 0;
    phase = 1;
    disrupted = 0;
    charge = 0;
    cooldown = 0;
    grace = 0;
    collisionCooldown = 0;
    readonly position = new Vec3();
    readonly previous = new Vec3();
    readonly rotation = new Quat();
    readonly previousRotation = new Quat();
    readonly velocity = new Vec3();
    readonly aim = new Vec3();
    readonly parts = SPECTACLE.boss.parts.map(
        (p, i) =>
            new BossPart(
                8 + i,
                new Vec3(...p),
                SPECTACLE.boss.radii[i],
                [
                    'PORT TURRET',
                    'STARBOARD TURRET',
                    'UPPER PORT TURRET',
                    'UPPER STARBOARD TURRET',
                    'PORT COOLING NODE',
                    'STARBOARD COOLING NODE',
                    'REACTOR'
                ][i]
            )
    );
    readonly hull: { local: Vec3; position: Vec3; previous: Vec3; radius: number }[] = SPECTACLE.boss.hull.map(
        ([x, y, z, radius]) => ({
            local: new Vec3(x, y, z),
            position: new Vec3(),
            previous: new Vec3(),
            radius
        })
    );
    attack = 0;
    deathStage = -1;
    readonly batteryA = new Vec3();
    readonly batteryB = new Vec3();
    private readonly lateral = new Vec3();
    get deathAge() {
        return SPECTACLE.boss.destruction - this.dying;
    }
    get firingBank() {
        const bank = this.attack % 2;
        for (let i = bank; i < 4; i += 2) if (this.parts[i].active) return bank;
        return 1 - bank;
    }
    get attackName(): string {
        return this.phase === 1
            ? this.firingBank === 0
                ? 'PORT HUNT VOLLEY'
                : 'STARBOARD HUNT VOLLEY'
            : this.phase === 2
              ? 'CROSSFIRE / DODGE THE LANES'
              : this.attack % 2 === 0
                ? 'SIEGE LANCE / BREAK AIM'
                : 'OVERLOAD RING / FIND A GAP';
    }
    private readonly delta = new Vec3();
    private readonly direction = new Vec3();
    private readonly zero = new Vec3();
    private readonly matrix = new Mat4();
    private readonly desired = new Quat();
    private readonly facing = new Quat();
    protected returnToEngagement(ship: Flight, anchor: Vec3, dt: number) {
        if (
            this.position.distance(anchor) <= BULLETHELL.maximumRoam ||
            this.position.distance(ship.position) <= BULLETHELL.maximumRange ||
            dt <= 0
        )
            return;
        this.position.lerp(
            this.previous,
            anchor,
            Math.min(1, (BULLETHELL.returnSpeed * dt) / Math.max(1, this.previous.distance(anchor)))
        );
        this.velocity.sub2(this.position, this.previous).mulScalar(1 / dt);
    }
    get arriving() {
        return this.active && this.age < EVOLUTION.boss.arrival;
    }
    get health() {
        let n = 0;
        for (const p of this.parts) n += Math.max(0, p.health);
        return n;
    }
    get maxHealth() {
        return EVOLUTION.boss.turretHealth * 4 + EVOLUTION.boss.weakHealth * 2 + EVOLUTION.boss.coreHealth;
    }
    reset() {
        for (const part of this.parts) part.generation++;
        this.active = false;
        this.dying = 0;
        this.charge = 0;
        this.attack = 0;
        this.deathStage = -1;
        for (const p of this.parts) p.active = false;
    }
    spawn(ship: Flight, rocks: Rock[]) {
        this.reset();
        this.active = true;
        this.age = 0;
        this.phase = 1;
        this.disrupted = 0;
        this.cooldown = 2;
        this.grace = 0;
        this.collisionCooldown = 0;
        for (let attempt = 0; attempt < 128; attempt++) {
            ship.rotation
                .transformVector(
                    this.delta.set(
                        70 + Math.sin(attempt * 2.4) * attempt * 12,
                        30 + Math.cos(attempt * 1.8) * attempt * 9,
                        -SPECTACLE.boss.spawnDistance - attempt * 3
                    ),
                    this.position
                )
                .add(ship.position);
            if (rocks.every((r) => r.position.distance(this.position) > r.radius + SPECTACLE.boss.clearance)) break;
        }
        this.previous.copy(this.position);
        this.matrix.setLookAt(this.position, ship.position, Vec3.UP);
        this.rotation.setFromMat4(this.matrix);
        this.previousRotation.copy(this.rotation);
        this.velocity.set(0, 0, 0);
        for (let i = 0; i < this.parts.length; i++) {
            const p = this.parts[i];
            p.active = true;
            p.health = p.maxHealth =
                i < 4 ? EVOLUTION.boss.turretHealth : i < 6 ? EVOLUTION.boss.weakHealth : EVOLUTION.boss.coreHealth;
        }
        this.updateParts(1);
        for (const p of this.parts) p.previous.copy(p.position);
        for (const h of this.hull) h.previous.copy(h.position);
    }
    protected updateParts(dt: number) {
        for (let i = 0; i < this.parts.length; i++) {
            const p = this.parts[i];
            p.previous.copy(p.position);
            this.rotation.transformVector(p.local, p.position).add(this.position);
            p.velocity.sub2(p.position, p.previous).mulScalar(1 / dt);
            p.exposed =
                !this.arriving &&
                this.grace <= 0 &&
                (this.phase === 1
                    ? i < 4
                    : this.phase === 2
                      ? i >= 4 &&
                        i < 6 &&
                        (!this.parts[4].active ||
                            !this.parts[5].active ||
                            Math.floor(this.age / SPECTACLE.boss.nodeWindow) % 2 === i - 4)
                      : i === 6);
        }
        this.rotation.transformVector(this.delta.set(-61, 0, -48), this.batteryA).add(this.position);
        this.rotation.transformVector(this.delta.set(61, 0, -48), this.batteryB).add(this.position);
        for (const h of this.hull) {
            h.previous.copy(h.position);
            this.rotation.transformVector(h.local, h.position).add(this.position);
        }
    }
    damage(part: BossPart, amount: number) {
        if (!part.targetable || !this.active) return false;
        part.health = Math.max(0, part.health - amount);
        if (part.health > 0) return false;
        part.active = false;
        if (this.phase === 1 && this.parts.slice(0, 4).every((p) => !p.active)) {
            this.phase = 2;
            this.grace = EVOLUTION.boss.phaseGrace;
            this.charge = 0;
            this.cooldown = 2;
        } else if (this.phase === 2 && !this.parts[4].active && !this.parts[5].active) {
            this.phase = 3;
            this.grace = EVOLUTION.boss.phaseGrace;
            this.charge = 0;
            this.cooldown = 1.5;
        } else if (this.phase === 3 && part.id === 14) {
            this.active = false;
            this.dying = SPECTACLE.boss.destruction;
            this.deathStage = -1;
            this.previous.copy(this.position);
            this.previousRotation.copy(this.rotation);
            for (const p of this.parts) p.active = false;
        }
        for (const p of this.parts) p.exposed = false;
        return true;
    }
    step(dt: number, ship: Flight, rocks: Rock[], shots: Projectiles) {
        this.dying = Math.max(0, this.dying - dt);
        if (!this.active) return;
        this.previous.copy(this.position);
        this.previousRotation.copy(this.rotation);
        this.age += dt;
        this.grace -= dt;
        this.collisionCooldown -= dt;
        this.delta.sub2(ship.position, this.position);
        const distance = this.delta.length();
        if (distance > 1) {
            this.matrix.setLookAt(
                this.position,
                ship.position,
                Math.abs(this.delta.y / distance) > 0.98 ? Vec3.RIGHT : Vec3.UP
            );
            this.desired.setFromMat4(this.matrix);
            this.facing.setFromAxisAngle(Vec3.UP, SPECTACLE.boss.facing);
            this.desired.mul(this.facing);
            this.rotation.slerp(this.rotation, this.desired, 1 - Math.exp(-SPECTACLE.boss.turn[this.phase - 1] * dt));
        }
        this.velocity
            .copy(this.delta)
            .normalize()
            .mulScalar(distance > SPECTACLE.boss.far ? 16 : distance < SPECTACLE.boss.near ? -18 : 0);
        this.lateral
            .cross(this.delta, Vec3.UP)
            .normalize()
            .mulScalar(
                SPECTACLE.boss.orbit[this.phase - 1] * (this.attack % 2 ? 1 : -1) * (this.charge > 0 ? 0.35 : 1)
            );
        this.velocity.add(this.lateral);
        this.velocity.y += Math.sin(this.age * 0.6) * 7;
        for (const r of rocks) {
            this.delta.sub2(this.position, r.position);
            const d = this.delta.length(),
                safe = r.radius + SPECTACLE.boss.clearance;
            if (d < safe && d > 0.01) this.velocity.add(this.delta.mulScalar((safe - d) / d));
        }
        if (this.velocity.length() > SPECTACLE.boss.speed) this.velocity.normalize().mulScalar(SPECTACLE.boss.speed);
        this.position.add(this.delta.copy(this.velocity).mulScalar(dt));
        this.updateParts(dt);
        if (this.arriving || this.grace > 0) return;
        if (this.disrupted > 0) {
            this.disrupted = Math.max(0, this.disrupted - dt);
            this.charge = 0;
            this.cooldown = Math.max(this.cooldown, 1);
            return;
        }
        const phase = this.phase - 1;
        if (this.charge > 0) {
            this.charge -= dt;
            if (this.charge <= 0) {
                let count = 0;
                for (const p of shots.items) if (p.active && p.hostile) count++;
                if (count < EVOLUTION.boss.projectileLimit) this.fire(shots, EVOLUTION.boss.projectileLimit - count);
                this.cooldown = SPECTACLE.boss.cooldown[phase];
            }
        } else {
            this.cooldown -= dt;
            if (this.cooldown <= 0) {
                this.aim.copy(ship.velocity).mulScalar(SPECTACLE.boss.lead).add(ship.position);
                this.charge = SPECTACLE.boss.windup[phase];
            }
        }
    }
    private fire(shots: Projectiles, budget: number) {
        const phase = this.phase - 1;
        let fired = 0;
        const count =
            this.phase === 1
                ? 4
                : this.phase === 2
                  ? SPECTACLE.boss.crossLanes * 2
                  : this.attack % 2 === 0
                    ? SPECTACLE.boss.lanceCount
                    : SPECTACLE.boss.ringCount;
        const bank = this.firingBank;
        for (let i = 0; i < count && fired < budget; i++) {
            let origin: Vec3;
            if (this.phase === 1) {
                const p = this.parts[i];
                if (!p.active || i % 2 !== bank) continue;
                origin = p.position;
            } else
                origin =
                    this.phase === 2
                        ? i < SPECTACLE.boss.crossLanes
                            ? this.batteryA
                            : this.batteryB
                        : this.parts[6].position;
            this.direction.sub2(this.aim, origin).normalize();
            this.rotation.transformVector(Vec3.RIGHT, this.lateral);
            if (this.phase === 2) {
                const lane = (i % SPECTACLE.boss.crossLanes) - Math.floor(SPECTACLE.boss.crossLanes / 2);
                this.direction.add(this.delta.copy(this.lateral).mulScalar(lane * SPECTACLE.boss.crossSpread));
                this.rotation.transformVector(Vec3.UP, this.lateral);
                this.direction.add(
                    this.delta
                        .copy(this.lateral)
                        .mulScalar(
                            lane === 0
                                ? 0
                                : i < SPECTACLE.boss.crossLanes
                                  ? SPECTACLE.boss.crossHeight
                                  : -SPECTACLE.boss.crossHeight
                        )
                );
            } else if (this.phase === 3) {
                if (this.attack % 2 === 0)
                    this.direction.add(
                        this.delta.copy(this.lateral).mulScalar((i - (count - 1) / 2) * SPECTACLE.boss.lanceSpread)
                    );
                else if (i > 0) {
                    const angle = ((i - 1) * Math.PI * 2) / (count - 1);
                    this.direction.add(
                        this.delta.copy(this.lateral).mulScalar(Math.cos(angle) * SPECTACLE.boss.ringSpread)
                    );
                    this.rotation.transformVector(Vec3.UP, this.lateral);
                    this.direction.add(
                        this.delta.copy(this.lateral).mulScalar(Math.sin(angle) * SPECTACLE.boss.ringSpread)
                    );
                }
            }
            this.direction.normalize();
            shots.spawn(
                origin,
                this.direction,
                this.zero,
                EVOLUTION.boss.shotSpeed[phase],
                EVOLUTION.boss.damage[phase],
                6,
                true
            );
            fired++;
        }
        this.attack++;
    }
}
