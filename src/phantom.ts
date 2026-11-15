import { Mat4, Quat, Vec3 } from 'playcanvas';

import { Boss, BossPart } from './boss';
import type { Rock } from './collisions';
import { EVOLUTION } from './evolution-config';
import { FLEET } from './fleet-config';
import type { Flight } from './flight';
import type { Projectiles } from './projectiles';

/** A contiguous-flight precision encounter, sharing boss lifecycle and damage interfaces. */
export class Phantom extends Boss {
    override readonly parts = [new BossPart(15, new Vec3(), FLEET.phantom.radius, 'PHANTOM')];
    override readonly hull = [];
    state: 'intercept' | 'attack' | 'flank' | 'evade' = 'intercept';
    stateTime = 0;
    private readonly toShip = new Vec3();
    private readonly goal = new Vec3();
    private readonly vector = new Vec3();
    private readonly right = new Vec3();
    private readonly up = new Vec3();
    private readonly zeroVector = new Vec3();
    private readonly matrixP = new Mat4();
    private readonly desiredP = new Quat();
    override get maxHealth() {
        return FLEET.phantom.health;
    }
    override get firingBank() {
        return 0;
    }
    override get attackName() {
        return this.phase === 1
            ? 'INTERCEPTION BURST'
            : this.phase === 2
              ? 'FLANK CROSSFIRE'
              : this.attack % 2
                ? 'LAST STAND / STARBURST'
                : 'LAST STAND / PRECISION LANCE';
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
        for (let i = 0; i < 64; i++) {
            ship.rotation
                .transformVector(
                    this.vector.set(55 + Math.sin(i * 2) * i * 7, 30 + Math.cos(i) * i * 3, -330 - i * 3),
                    this.position
                )
                .add(ship.position);
            if (rocks.every((r) => r.position.distance(this.position) > r.radius + 32)) break;
        }
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
            this.grace = 0.8;
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
        if (!this.active) return;
        this.previous.copy(this.position);
        this.previousRotation.copy(this.rotation);
        this.age += dt;
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
            .mulScalar(this.state === 'attack' ? 30 : FLEET.phantom.speed[this.phase - 1]);
        if (distance < 65) this.vector.copy(this.toShip).normalize().mulScalar(-70);
        for (const rock of rocks) {
            this.toShip.sub2(this.position, rock.position);
            const d = this.toShip.length(),
                safe = rock.radius + 35;
            if (d < safe && d > 0.01) this.vector.add(this.toShip.mulScalar(((safe - d) * 4) / d));
        }
        if (this.vector.length() > FLEET.phantom.speed[this.phase - 1])
            this.vector.normalize().mulScalar(FLEET.phantom.speed[this.phase - 1]);
        if (this.disrupted > 0) {
            this.disrupted = Math.max(0, this.disrupted - dt);
            this.vector.mulScalar(0.3);
            this.charge = 0;
            this.cooldown = Math.max(1, this.cooldown);
        }
        this.velocity.lerp(this.velocity, this.vector, 1 - Math.exp(-2.2 * dt));
        this.position.add(this.vector.copy(this.velocity).mulScalar(dt));
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
        const p = this.parts[0];
        p.previous.copy(p.position);
        p.position.copy(this.position);
        p.velocity.copy(this.velocity);
        p.exposed = !this.arriving && this.grace <= 0;
        if (this.arriving || this.grace > 0 || this.disrupted > 0) return;
        if (this.charge > 0) {
            this.charge -= dt;
            if (this.charge <= 0) {
                this.fireBurst(shots);
                this.attack++;
                this.cooldown = FLEET.phantom.cooldown[this.phase - 1];
                this.state = this.phase === 1 ? 'evade' : 'flank';
                this.stateTime = 0;
            }
        } else if ((this.state === 'intercept' || this.state === 'attack') && this.cooldown <= 0 && distance < 450) {
            this.state = 'attack';
            this.aim.copy(ship.velocity).mulScalar(0.5).add(ship.position);
            this.charge = FLEET.phantom.windup[this.phase - 1];
        } else if ((this.state === 'flank' || this.state === 'evade') && this.stateTime > 2.4) {
            this.state = 'intercept';
            this.stateTime = 0;
        }
    }
    private fireBurst(shots: Projectiles) {
        let active = 0;
        for (const p of shots.items) if (p.active && p.hostile) active++;
        const count = Math.min(
            EVOLUTION.boss.projectileLimit - active,
            this.phase === 3 ? 9 : this.phase === 2 ? 7 : 5
        );
        this.rotation.transformVector(Vec3.RIGHT, this.right);
        this.rotation.transformVector(Vec3.UP, this.up);
        for (let i = 0; i < count; i++) {
            this.vector.sub2(this.aim, this.position).normalize();
            if (this.phase === 3 && this.attack % 2 && i > 0) {
                const a = ((i - 1) * Math.PI) / 4;
                this.vector.add(this.toShip.copy(this.right).mulScalar(Math.cos(a) * 0.085));
                this.vector.add(this.toShip.copy(this.up).mulScalar(Math.sin(a) * 0.085));
            } else this.vector.add(this.toShip.copy(this.right).mulScalar((i - (count - 1) / 2) * 0.024));
            this.vector.normalize();
            shots.spawn(
                this.position,
                this.vector,
                this.zeroVector,
                FLEET.phantom.shotSpeed[this.phase - 1],
                FLEET.phantom.damage[this.phase - 1],
                4,
                true
            );
        }
    }
}
