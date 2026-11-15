import { Mat4, Quat, Vec3 } from 'playcanvas';

import type { Rock } from './collisions';
import type { AIState } from './combat-config';
import type { Enemy } from './enemy';
import { EVOLUTION } from './evolution-config';
import type { Flight } from './flight';
import { LIVING } from './living-config';
export class EnemyAI {
    private readonly toPlayer = new Vec3();
    private readonly desired = new Vec3();
    private readonly avoid = new Vec3();
    private readonly delta = new Vec3();
    private readonly target = new Vec3();
    private readonly matrix = new Mat4();
    private readonly rotation = new Quat();
    private transition(e: Enemy, state: AIState) {
        e.state = state;
        e.stateTime = 0;
    }
    step(e: Enemy, ship: Flight, enemies: Enemy[], rocks: Rock[], dt: number) {
        if (e.arrival > 0) {
            e.previous.copy(e.position);
            e.previousRotation.copy(e.rotation);
            e.canFire = false;
            e.attackCue = false;
            e.arrival = Math.max(0, e.arrival - dt);
            this.desired.sub2(e.arrivalGoal, e.position).normalize().mulScalar(LIVING.arrivalSpeed);
            for (const rock of rocks) {
                this.delta.sub2(e.position, rock.position);
                const d = this.delta.length(),
                    safe = rock.radius + e.radius + 28;
                if (d < safe && d > 0.01) this.desired.add(this.delta.mulScalar(((safe - d) * 5) / d));
            }
            e.velocity.lerp(e.velocity, this.desired, 1 - Math.exp(-dt * 4));
            e.position.add(this.delta.copy(e.velocity).mulScalar(dt));
            this.target.copy(e.position).add(e.velocity);
            this.matrix.setLookAt(e.position, this.target, Vec3.UP);
            this.rotation.setFromMat4(this.matrix);
            e.rotation.slerp(e.rotation, this.rotation, 1 - Math.exp(-dt * 4));
            if (e.arrival === 0) e.cooldown = Math.max(e.cooldown, 1);
            return;
        }
        e.previous.copy(e.position);
        e.previousRotation.copy(e.rotation);
        e.age += dt;
        e.stateTime += dt;
        e.flash = Math.max(0, e.flash - dt);
        e.cooldown -= dt;
        this.toPlayer.sub2(ship.position, e.position);
        const distance = this.toPlayer.length();
        this.toPlayer.normalize();
        const support = e.kind === 'bomber' || e.kind === 'carrier';
        if (e.state === 'pursue' && distance < (support ? 550 : 340)) this.transition(e, 'approach');
        else if (e.state === 'approach' && distance < (support ? 390 : e.kind === 'heavy' ? 270 : 230))
            this.transition(e, 'attack');
        else if (e.state === 'attack' && (distance < (support ? 180 : 55) || e.stateTime > (support ? 7 : 4.5))) {
            this.transition(e, 'evade');
            e.escape.copy(this.toPlayer).mulScalar(-0.4);
            e.escape.x += Math.sin(e.id * 2.4 + e.age) * 0.9;
            e.escape.y += Math.cos(e.id * 1.7 + e.age) * 0.8;
            e.escape.normalize();
        } else if (e.state === 'evade' && e.stateTime > 2.4) this.transition(e, 'reposition');
        else if (e.state === 'reposition' && e.stateTime > 1.8) this.transition(e, 'pursue');
        if (distance > 600 && e.state !== 'pursue') this.transition(e, 'pursue');
        this.desired.copy(this.toPlayer);
        let speed = e.tuning.speed;
        if (e.state === 'attack') {
            speed *= distance > 170 ? 0.6 : 0.15;
            this.desired.x += Math.sin(e.age * 1.2 + e.id * 2) * 0.3;
            this.desired.y += Math.cos(e.age * 0.9 + e.id) * 0.2;
        }
        if (e.state === 'evade') this.desired.copy(e.escape);
        if (e.state === 'reposition') {
            this.desired.x += Math.sin(e.id * 3 + e.age) * 1.2;
            this.desired.y += Math.cos(e.id + e.age) * 0.9;
            speed *= 0.8;
        }
        if (e.order !== 'engage') this.desired.sub2(e.goal, e.position).normalize();
        if (e.elite && e.state === 'attack') {
            this.desired.x += Math.sin(e.age * 2.7 + e.id) * 0.55;
            this.desired.y += Math.cos(e.age * 2.3 + e.id) * 0.35;
        }
        if (support && e.order === 'engage') {
            if (distance < 240) this.desired.copy(this.toPlayer).mulScalar(-1);
            else if (distance < 370) {
                this.desired.set(-this.toPlayer.z, Math.sin(e.age * 0.7) * 0.3, this.toPlayer.x).normalize();
                speed *= 0.65;
            }
        }
        if (e.disrupted > 0) speed *= EVOLUTION.emp.slow;
        this.avoid.set(0, 0, 0);
        this.target.copy(e.velocity).mulScalar(0.8).add(e.position);
        for (const rock of rocks) {
            this.delta.sub2(this.target, rock.position);
            const d = this.delta.length(),
                safe = rock.radius + e.tuning.radius + 22;
            if (d < safe) {
                if (d < 0.01) this.delta.set(1, 1, 0);
                else this.delta.mulScalar(1 / d);
                this.avoid.add(this.delta.mulScalar(((safe - d) / safe) * 4));
            }
        }
        for (const other of enemies)
            if (other !== e && other.active) {
                this.delta.sub2(e.position, other.position);
                const d = this.delta.length();
                if (d < 22 && d > 0.01) this.avoid.add(this.delta.mulScalar((22 - d) / (d * 15)));
            }
        if (distance < 25) this.avoid.add(this.delta.copy(this.toPlayer).mulScalar(-3));
        this.desired.add(this.avoid).normalize().mulScalar(speed);
        e.velocity.lerp(e.velocity, this.desired, 1 - Math.exp(-e.tuning.turn * dt));
        e.position.add(this.delta.copy(e.velocity).mulScalar(dt));
        // Conservative separation also protects against an avoidance overshoot.
        for (const rock of rocks) {
            this.delta.sub2(e.position, rock.position);
            const safe = rock.radius + e.tuning.radius,
                d = this.delta.length();
            if (d < safe) {
                if (d < 0.01) this.delta.set(1, 0, 0);
                else this.delta.mulScalar(1 / d);
                e.position
                    .copy(this.delta)
                    .mulScalar(safe + 0.1)
                    .add(rock.position);
            }
        }
        this.target.copy(
            e.order !== 'engage'
                ? e.goal
                : support || e.state === 'attack' || e.state === 'approach'
                  ? ship.position
                  : this.delta.copy(e.position).add(e.velocity)
        );
        if (this.delta.sub2(this.target, e.position).lengthSq() > 0.01) {
            this.matrix.setLookAt(
                e.position,
                this.target,
                Math.abs(this.delta.y) / this.delta.length() > 0.98 ? Vec3.RIGHT : Vec3.UP
            );
            this.rotation.setFromMat4(this.matrix);
            e.rotation.slerp(e.rotation, this.rotation, 1 - Math.exp(-e.tuning.turn * dt));
        }
    }
}
