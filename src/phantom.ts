import { Mat4, Quat, Vec3 } from 'playcanvas';

import { Boss, BossPart } from './boss';
import { BossPatterns } from './boss-patterns';
import type { Rock } from './collisions';
import { EVOLVED_BOSSES } from './evolved-boss-config';
import { FLEET } from './fleet-config';
import type { Flight } from './flight';
import type { Projectiles } from './projectiles';
import { RiftArrival } from './rift-arrival';

/** A contiguous-flight precision encounter, sharing boss lifecycle and damage interfaces. */
export class Phantom extends Boss {
    readonly arrival = new RiftArrival(EVOLVED_BOSSES.phantom.arrival);
    readonly patterns = new BossPatterns('phantom');
    avoidance: readonly Rock[] = [];
    beamCooldown = 0;
    private readonly sources = {
        banks: [
            { position: new Vec3(), active: true },
            { position: new Vec3(), active: true }
        ],
        muzzle: this.position
    };
    override get arriving() {
        return this.active && !this.arrival.complete;
    }
    override reset() {
        super.reset();
        this.arrival.reset();
        this.patterns.reset();
        this.beamCooldown = 0;
    }

    override readonly parts = [new BossPart(15, new Vec3(), FLEET.phantom.radius, 'PHANTOM')];
    override readonly hull = [];
    state: 'intercept' | 'attack' | 'flank' | 'evade' = 'intercept';
    stateTime = 0;
    private readonly toShip = new Vec3();
    private readonly goal = new Vec3();
    private readonly vector = new Vec3();
    private readonly matrixP = new Mat4();
    private readonly desiredP = new Quat();
    override get maxHealth() {
        return EVOLVED_BOSSES.phantom.health;
    }
    override get firingBank() {
        return 0;
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
        this.disrupted = 0;
        this.cooldown = 1.5;
        this.state = 'intercept';
        this.stateTime = 0;
        this.arrival.begin(ship, rocks);
        this.arrival.sample(this.position);
        this.rotation.copy(this.arrival.rotation);
        this.previous.copy(this.position);
        this.velocity.set(0, 0, 0);
        this.matrixP.setLookAt(this.position, ship.position, Vec3.UP);
        this.rotation.setFromMat4(this.matrixP);
        this.previousRotation.copy(this.rotation);
        const p = this.parts[0];
        p.active = true;
        p.exposed = false;
        p.health = p.maxHealth = this.maxHealth;
        p.position.copy(this.position);
        p.previous.copy(this.position);
        p.velocity.set(0, 0, 0);
    }
    override damage(p: BossPart, amount: number) {
        if (!this.active || !p.targetable) return false;
        p.health = Math.max(0, p.health - amount);
        if (p.health <= 0) {
            this.active = p.active = false;
            this.dying = 6.4;
            this.deathStage = -1;
            this.charge = 0;
            this.previous.copy(this.position);
            this.previousRotation.copy(this.rotation);
            return true;
        }
        const phase = p.health > (this.maxHealth * 2) / 3 ? 1 : p.health > this.maxHealth / 3 ? 2 : 3;
        if (phase !== this.phase) {
            this.phase = phase;
            this.grace = EVOLVED_BOSSES.phantom.grace;
            this.patterns.reset(phase);
            this.charge = 0;
            this.cooldown = 1;
            this.state = 'flank';
            this.stateTime = 0;
            p.exposed = false;
        }
        return false;
    }
    override step(dt: number, ship: Flight, rocks: Rock[], shots: Projectiles) {
        this.dying = Math.max(0, this.dying - dt);
        if (!this.active) {
            if (this.dying > 0) {
                this.previous.copy(this.position);
                this.previousRotation.copy(this.rotation);
                this.velocity.mulScalar(Math.exp(-dt * 0.7));
                this.position.add(this.vector.copy(this.velocity).mulScalar(dt));
            }
            return;
        }
        this.previous.copy(this.position);
        this.previousRotation.copy(this.rotation);
        this.age += dt;
        if (this.arriving) {
            this.arrival.step(dt, ship, rocks);
            this.arrival.sample(this.position);
            this.rotation.copy(this.arrival.rotation);
            const p = this.parts[0];
            p.previous.copy(p.position);
            p.position.copy(this.position);
            p.exposed = false;
            p.velocity.sub2(this.position, this.previous).mulScalar(1 / Math.max(dt, 0.0001));
            return;
        }
        this.state =
            this.patterns.state === 'recover'
                ? 'evade'
                : this.patterns.kind === 'cross' || this.patterns.kind === 'finale'
                  ? 'flank'
                  : 'attack';
        this.stateTime += dt;
        this.grace -= dt;
        this.cooldown -= dt;
        const distance = this.toShip.sub2(ship.position, this.position).length(),
            side = this.attack % 2 ? 1 : -1;
        const z = this.state === 'flank' ? 40 : this.state === 'evade' ? -300 : -180;
        ship.rotation
            .transformVector(
                this.vector.set(side * (this.state === 'flank' ? 200 : 85), Math.sin(this.age * 0.8) * 60, z),
                this.goal
            )
            .add(ship.position);
        this.vector
            .sub2(this.goal, this.position)
            .normalize()
            .mulScalar(this.state === 'attack' ? 30 : EVOLVED_BOSSES.phantom.speed[this.phase - 1]);
        if (distance < 65) this.vector.copy(this.toShip).normalize().mulScalar(-70);
        for (const group of [rocks, this.avoidance])
            for (const rock of group) {
                this.toShip.sub2(this.position, rock.position);
                const d = this.toShip.length(),
                    safe = rock.radius + 35;
                if (d < safe && d > 0.01) this.vector.add(this.toShip.mulScalar(((safe - d) * 4) / d));
            }
        if (this.vector.length() > EVOLVED_BOSSES.phantom.speed[this.phase - 1])
            this.vector.normalize().mulScalar(EVOLVED_BOSSES.phantom.speed[this.phase - 1]);
        if (this.disrupted > 0) {
            this.disrupted = Math.max(0, this.disrupted - dt);
            this.vector.mulScalar(0.3);
            this.charge = 0;
            this.cooldown = Math.max(1, this.cooldown);
        }
        this.velocity.lerp(this.velocity, this.vector, 1 - Math.exp(-2.2 * dt));
        this.position.add(this.vector.copy(this.velocity).mulScalar(dt));
        this.returnToEngagement(ship, this.arrival.anchor, dt);
        for (const r of rocks) {
            this.vector.sub2(this.position, r.position);
            const d = this.vector.length(),
                safe = r.radius + 13;
            if (d < safe) {
                if (d < 0.01) this.vector.set(1, 0, 0);
                else this.vector.mulScalar(1 / d);
                this.position
                    .copy(this.vector)
                    .mulScalar(safe + 0.1)
                    .add(r.position);
            }
        }
        this.toShip.sub2(ship.position, this.position);
        this.matrixP.setLookAt(
            this.position,
            ship.position,
            Math.abs(this.toShip.y / Math.max(1, this.toShip.length())) > 0.98 ? Vec3.RIGHT : Vec3.UP
        );
        this.desiredP.setFromMat4(this.matrixP);
        this.rotation.slerp(this.rotation, this.desiredP, 1 - Math.exp(-2 * dt));
        for (let i = 0; i < 2; i++)
            this.rotation
                .transformVector(this.vector.set(i ? 10 : -10, 0, -14), this.sources.banks[i].position)
                .add(this.position);
        const p = this.parts[0];
        p.previous.copy(p.position);
        p.position.copy(this.position);
        p.velocity.copy(this.velocity);
        p.exposed = !this.arriving && this.grace <= 0 && (this.patterns.state !== 'fire' || this.disrupted > 0);
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
