import { Mat4, Quat, Vec3 } from 'playcanvas';

import { BossPart } from './boss';
import type { Rock } from './collisions';
import type { Flight } from './flight';
import { Guardian } from './guardian';
import { LIVING } from './living-config';
import type { Projectiles } from './projectiles';

/** Wave-15 replacement, retaining the third-boss record/lifecycle contract. */
export class Tesser extends Guardian {
    override readonly parts = [
        [-65, 7, -25],
        [65, 7, -25],
        [-38, -8, -34],
        [38, -8, -34],
        [-80, 12, 20],
        [80, 12, 20],
        [0, 0, -35]
    ].map(
        (p, i) =>
            new BossPart(
                22 + i,
                new Vec3(...p),
                i === 6 ? 15 : 10,
                i < 4 ? 'TESSER WEAPON BANK ' + (i + 1) : i < 6 ? 'OVERDRIVE CAPACITOR' : 'TESSER COMMAND CORE'
            )
    );
    override readonly hull = [-50, 0, 50].map((x) => ({
        local: new Vec3(x, 0, 0),
        position: new Vec3(),
        previous: new Vec3(),
        radius: x === 0 ? 27 : 23
    }));
    private readonly vectorT = new Vec3();
    private readonly goalT = new Vec3();
    private readonly sideT = new Vec3();
    private readonly upT = new Vec3();
    private readonly directionT = new Vec3();
    private readonly matrixT = new Mat4();
    private readonly desiredT = new Quat();
    private readonly zeroT = new Vec3();
    override get maxHealth() {
        return LIVING.tesser.health;
    }
    override get arriving() {
        return this.active && this.age < LIVING.tesser.arrival;
    }
    override get attackName() {
        return this.attack % 3 === 2
            ? 'OVERLOAD FAN / DODGE OUTWARD'
            : this.attack % 3 === 1
              ? 'CHARGED PLASMA / BREAK LOCK'
              : 'ALTERNATING LASER BANKS';
    }
    override spawn(ship: Flight, rocks: Rock[]) {
        this.reset();
        this.active = true;
        this.age = 0;
        this.phase = 1;
        this.grace = 0;
        this.cooldown = 1.5;
        this.disrupted = 0;
        this.collisionCooldown = 0;
        for (let i = 0; i < 100; i++) {
            ship.rotation
                .transformVector(
                    this.vectorT.set(Math.sin(i * 2.4) * i * 12, 60 + Math.cos(i) * i * 8, -1100 - i * 8),
                    this.position
                )
                .add(ship.position);
            if (rocks.every((r) => r.position.distance(this.position) > r.radius + 110)) break;
        }
        this.previous.copy(this.position);
        this.matrixT.setLookAt(this.position, ship.position, Vec3.UP);
        this.rotation.setFromMat4(this.matrixT);
        this.previousRotation.copy(this.rotation);
        this.velocity.set(0, 0, 0);
        const hp = LIVING.tesser.partHealth;
        for (let i = 0; i < 7; i++) {
            const p = this.parts[i];
            p.active = true;
            p.health = p.maxHealth = hp[i];
            p.exposed = false;
        }
        this.syncT(0);
    }
    private syncT(dt: number) {
        for (let i = 0; i < this.parts.length; i++) {
            const p = this.parts[i];
            p.previous.copy(p.position);
            this.rotation.transformVector(p.local, p.position).add(this.position);
            if (dt > 0) p.velocity.sub2(p.position, p.previous).mulScalar(1 / dt);
            else {
                p.previous.copy(p.position);
                p.velocity.set(0, 0, 0);
            }
            p.exposed = p.active && !this.arriving && this.grace <= 0 && (i < 4 || i === 6 || this.phase === 2);
        }
        for (const h of this.hull) {
            h.previous.copy(h.position);
            this.rotation.transformVector(h.local, h.position).add(this.position);
            if (dt === 0) h.previous.copy(h.position);
        }
        this.warningOrigin.copy(this.position);
    }
    override damage(p: BossPart, amount: number) {
        if (!this.active || !p.targetable) return false;
        p.health = Math.max(0, p.health - amount);
        if (this.phase === 1 && this.health <= this.maxHealth * 0.5) {
            this.phase = 2;
            this.grace = 1.2;
            this.charge = 0;
            this.cooldown = 1.2;
        }
        const destroyed = p.health === 0;
        if (destroyed) p.active = false;
        if (this.health <= 0) {
            this.active = false;
            this.dying = 6.4;
            this.deathStage = -1;
            this.charge = 0;
        }
        this.syncT(0);
        return destroyed;
    }
    override step(dt: number, ship: Flight, rocks: Rock[], shots: Projectiles) {
        this.dying = Math.max(0, this.dying - dt);
        if (!this.active) return;
        this.previous.copy(this.position);
        this.previousRotation.copy(this.rotation);
        this.age += dt;
        this.grace = Math.max(0, this.grace - dt);
        this.collisionCooldown -= dt;
        const over = this.phase === 2;
        ship.rotation
            .transformVector(
                this.vectorT.set(
                    Math.sin(this.age * 0.24) * (over ? 210 : 130),
                    Math.sin(this.age * 0.35) * 70,
                    -(over ? 330 : 440)
                ),
                this.goalT
            )
            .add(ship.position);
        this.vectorT
            .sub2(this.goalT, this.position)
            .normalize()
            .mulScalar(this.arriving ? 110 : over ? LIVING.tesser.overdriveSpeed : LIVING.tesser.speed);
        for (const rock of rocks) {
            this.sideT.sub2(this.position, rock.position);
            const d = this.sideT.length(),
                safe = rock.radius + 100;
            if (d < safe && d > 0.01) this.vectorT.add(this.sideT.mulScalar(((safe - d) * 3) / d));
        }
        if (this.disrupted > 0) {
            this.disrupted = Math.max(0, this.disrupted - dt);
            this.vectorT.mulScalar(0.3);
            this.charge = 0;
            this.cooldown = Math.max(this.cooldown, 1);
        }
        this.velocity.lerp(this.velocity, this.vectorT, 1 - Math.exp(-dt * 2));
        this.position.add(this.vectorT.copy(this.velocity).mulScalar(dt));
        this.matrixT.setLookAt(this.position, ship.position, Vec3.UP);
        this.desiredT.setFromMat4(this.matrixT);
        this.rotation.slerp(this.rotation, this.desiredT, 1 - Math.exp(-dt * 0.7));
        this.syncT(dt);
        if (this.arriving || this.grace > 0 || this.disrupted > 0) return;
        this.cooldown -= dt;
        if (this.charge > 0) {
            this.charge -= dt;
            if (this.charge <= 0) {
                this.fireT(shots, over);
                this.attack++;
                this.cooldown = over ? LIVING.tesser.overdriveCooldown : LIVING.tesser.cooldown;
            }
        } else if (this.cooldown <= 0) {
            this.charge = over ? LIVING.tesser.overdriveWindup : LIVING.tesser.windup;
            this.aim.copy(ship.velocity).mulScalar(0.45).add(ship.position);
        }
    }
    private fireT(shots: Projectiles, over: boolean) {
        let count = 0;
        for (const p of shots.items) if (p.active && p.hostile) count++;
        this.rotation.transformVector(Vec3.RIGHT, this.sideT);
        this.rotation.transformVector(Vec3.UP, this.upT);
        const plasma = this.attack % 3 === 1,
            fan = this.attack % 3 === 2;
        const bank = this.parts[(this.attack % 2) + (this.attack % 3 === 2 ? 2 : 0)];
        const origin = bank.active ? bank.position : this.position;
        const n = plasma ? (over ? 3 : 1) : over ? 9 : 5;
        for (let i = 0; i < n && count < LIVING.tesser.projectileLimit; i++) {
            this.directionT.sub2(this.aim, origin).normalize();
            // A fan has gaps; warnings lock before launch rather than following the player's dodge.
            const spread = (i - (n - 1) / 2) * (plasma ? 0.065 : fan ? 0.065 : 0.025);
            this.directionT.add(this.vectorT.copy(this.sideT).mulScalar(spread));
            if (over) this.directionT.add(this.vectorT.copy(this.upT).mulScalar(Math.sin(i * 2.4) * 0.07));
            this.directionT.normalize();
            this.vectorT.copy(this.directionT).mulScalar(12).add(origin);
            if (
                shots.spawn(
                    this.vectorT,
                    this.directionT,
                    this.zeroT,
                    plasma ? LIVING.tesser.plasmaSpeed : 210,
                    plasma ? LIVING.tesser.plasmaDamage : LIVING.tesser.damage,
                    5,
                    true,
                    false,
                    plasma
                )
            )
                count++;
        }
    }
}
