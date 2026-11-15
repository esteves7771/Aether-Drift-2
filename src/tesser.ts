import { Mat4, Quat, Vec3 } from 'playcanvas';

import { BossPart } from './boss';
import { BossPatterns } from './boss-patterns';
import type { Rock } from './collisions';
import { EVOLVED_BOSSES } from './evolved-boss-config';
import type { Flight } from './flight';
import { Guardian } from './guardian';
import { LIVING } from './living-config';
import type { Projectiles } from './projectiles';
import { RiftArrival } from './rift-arrival';

/** Wave-15 replacement, retaining the third-boss record/lifecycle contract. */
export class Tesser extends Guardian {
    readonly arrival = new RiftArrival(EVOLVED_BOSSES.tesser.arrival);
    readonly patterns = new BossPatterns('tesser');
    avoidance: readonly Rock[] = [];
    beamCooldown = 0;
    private readonly sources = { banks: [] as BossPart[], muzzle: this.position };
    override reset() {
        super.reset();
        this.arrival.reset();
        this.patterns.reset();
        this.beamCooldown = 0;
    }

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
    private readonly matrixT = new Mat4();
    private readonly desiredT = new Quat();
    override get maxHealth() {
        return EVOLVED_BOSSES.tesser.health.reduce((a, b) => a + b, 0);
    }
    override get arriving() {
        return this.active && !this.arrival.complete;
    }
    override get attackName() {
        return this.patterns.spec.name;
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
        this.arrival.begin(ship, rocks);
        this.arrival.sample(this.position);
        this.previous.copy(this.position);
        this.matrixT.setLookAt(this.position, ship.position, Vec3.UP);
        this.rotation.copy(this.arrival.rotation);
        this.previousRotation.copy(this.rotation);
        this.velocity.set(0, 0, 0);
        const hp = EVOLVED_BOSSES.tesser.health;
        for (let i = 0; i < 7; i++) {
            const p = this.parts[i];
            p.active = true;
            p.health = p.maxHealth = hp[i];
            p.exposed = false;
        }
        this.sources.banks = this.parts.slice(0, 6);
        this.sources.muzzle = this.parts[6].position;
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
            p.exposed =
                p.active &&
                !this.arriving &&
                this.grace <= 0 &&
                (this.phase === 1 ? i < 4 : this.phase === 2 ? i === 4 || i === 5 : i === 6) &&
                (this.patterns.state === 'recover' ||
                    this.disrupted > 0 ||
                    (this.phase === 1 && this.patterns.state === 'telegraph'));
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

        const destroyed = p.health === 0;
        if (destroyed) p.active = false;
        const next = this.parts.slice(0, 4).some((p) => p.active)
            ? 1
            : this.parts.slice(4, 6).some((p) => p.active)
              ? 2
              : 3;
        if (next !== this.phase) {
            this.phase = next;
            this.patterns.reset(next);
            this.grace = EVOLVED_BOSSES.tesser.grace;
            this.charge = 0;
        }
        if (this.health <= 0) {
            this.active = false;
            this.dying = 6.4;
            this.deathStage = -1;
            this.charge = 0;
        }
        return destroyed;
    }
    override step(dt: number, ship: Flight, rocks: Rock[], shots: Projectiles) {
        this.dying = Math.max(0, this.dying - dt);
        if (!this.active) return;
        this.previous.copy(this.position);
        this.previousRotation.copy(this.rotation);
        this.age += dt;
        this.beamCooldown = Math.max(0, this.beamCooldown - dt);
        if (this.arriving) {
            this.arrival.step(dt, ship, rocks);
            this.arrival.sample(this.position);
            this.rotation.copy(this.arrival.rotation);
            this.syncT(dt);
            return;
        }
        this.grace = Math.max(0, this.grace - dt);
        this.collisionCooldown -= dt;
        const over = this.phase >= 2;
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
        for (const group of [rocks, this.avoidance])
            for (const rock of group) {
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
        if (this.grace > 0) return;
        if (this.disrupted > 0) {
            this.patterns.interrupt();
            this.charge = 0;
            return;
        }
        const old = this.patterns.index;
        this.patterns.step(dt, this.phase, ship, this.sources, shots, rocks);
        this.aim.copy(this.patterns.aim);
        this.charge = this.patterns.winding;
        if (old !== this.patterns.index) this.attack++;
    }
}
