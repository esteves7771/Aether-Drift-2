import { Quat, Vec3 } from 'playcanvas';

import type { Rock } from './collisions';
import type { EmitCombat } from './combat';
import type { Enemy } from './enemy';
import { FLEET } from './fleet-config';
import type { Flight } from './flight';
import { PatternGeometry } from './pattern-geometry';
import type { Projectile, Projectiles } from './projectiles';
/** New support roles reuse the eight ship slots and the existing projectile pool. */
export class Fleet {
    private readonly geometry = new PatternGeometry();
    threat = 0;
    deployed = 0;
    salvos = 0;
    private readonly point = new Vec3();
    private readonly direction = new Vec3();
    private readonly axis = new Vec3();
    private readonly desired = new Vec3();
    private readonly zero = new Vec3();
    private readonly rotation = new Quat();
    reset() {
        this.threat = this.deployed = this.salvos = 0;
    }
    step(dt: number, ship: Flight, enemies: Enemy[], rocks: Rock[], shots: Projectiles, emit: EmitCombat) {
        this.threat = Math.max(0, this.threat - dt);
        for (const e of enemies)
            if (e.active && e.arrival <= 0) {
                if (e.kind === 'drone') {
                    const parent = enemies[e.owner];
                    if (!parent?.active || parent.kind !== 'carrier' || parent.generation !== e.ownerGeneration) {
                        e.orphanTime += dt;
                        if (e.orphanTime >= FLEET.deployment.orphanLife) {
                            e.active = false;
                            emit('impact', e.position, 0.5);
                        }
                    }
                    continue;
                }
                if (e.kind !== 'bomber' && e.kind !== 'carrier') continue;
                if (e.disrupted > 0) {
                    e.warmup = 0;
                    e.cooldown = Math.max(e.cooldown, 2);
                    e.attackCue = false;
                    continue;
                }
                let pressure = 0;
                for (const p of shots.items) if (p.active && p.hostile) pressure++;
                if (pressure >= 60) {
                    e.warmup = 0;
                    e.attackCue = false;
                    e.cooldown = Math.max(0.5, e.cooldown);
                    continue;
                }
                if (e.warmup > 0) {
                    e.warmup -= dt;
                    e.attackCue = true;
                    if (e.warmup <= 0) {
                        if (e.kind === 'bomber') {
                            const distance = e.position.distance(ship.position);
                            if (distance < FLEET.missile.range && distance >= FLEET.missile.minimumRange) {
                                for (const side of [-1, 1]) {
                                    e.rotation
                                        .transformVector(this.point.set(side * 5, -0.4, -5), this.point)
                                        .add(e.position);
                                    this.direction
                                        .copy(ship.velocity)
                                        .mulScalar(0.3)
                                        .add(ship.position)
                                        .sub(this.point)
                                        .normalize();
                                    shots.spawn(
                                        this.point,
                                        this.direction,
                                        this.zero,
                                        FLEET.bomber.projectileSpeed,
                                        FLEET.bomber.damage,
                                        FLEET.missile.life,
                                        true,
                                        true
                                    );
                                }
                                this.salvos++;
                                this.threat = 2;
                                emit('salvo', e.position, 1);
                            }
                            e.cooldown = FLEET.missile.cooldown;
                            e.state = 'reposition';
                            e.stateTime = 0;
                        } else {
                            this.deploy(e, ship, enemies, rocks, emit);
                            this.desired.copy(ship.position);
                            for (let i = 0; i < Math.min(3, 60 - pressure); i++) {
                                const angle = e.deployments + (i * Math.PI * 2) / 3;
                                this.geometry.ray(
                                    e.position,
                                    this.desired,
                                    Math.cos(angle) * 0.08,
                                    Math.sin(angle) * 0.08,
                                    this.direction
                                );
                                shots.spawn(
                                    e.position,
                                    this.direction,
                                    this.zero,
                                    140,
                                    6,
                                    4,
                                    true,
                                    false,
                                    false,
                                    false,
                                    2
                                );
                            }
                            e.cooldown = FLEET.deployment.cooldown;
                        }
                    }
                } else if (
                    !enemies.some(
                        (o) =>
                            o !== e &&
                            o.active &&
                            (o.warmup > 0 || (o.role !== 'standard' && o.patternState !== 'idle'))
                    ) &&
                    e.cooldown <= 0 &&
                    e.age > 3 &&
                    e.position.distance(ship.position) < FLEET.missile.range
                ) {
                    let drones = 0;
                    for (const other of enemies) if (other.active && other.kind === 'drone') drones++;
                    if (
                        (e.kind === 'bomber' && e.canFire && e.state === 'attack') ||
                        (e.kind === 'carrier' &&
                            e.canFire &&
                            e.deployments < FLEET.deployment.total &&
                            drones < FLEET.deployment.active)
                    ) {
                        e.warmup = e.kind === 'bomber' ? FLEET.missile.warmup : FLEET.deployment.warmup;
                        e.attackCue = true;
                        emit('charge', e.position, 1);
                    }
                }
            }
    }
    private deploy(parent: Enemy, ship: Flight, enemies: Enemy[], rocks: Rock[], emit: EmitCombat) {
        let active = 0;
        for (const e of enemies) if (e.active && e.kind === 'drone') active++;
        for (let i = active; i < FLEET.deployment.active && parent.deployments < FLEET.deployment.total; i++) {
            const drone = enemies.find((e) => !e.active);
            if (!drone) break;
            let safe = false;
            for (let attempt = 0; attempt < 16; attempt++) {
                parent.rotation
                    .transformVector(
                        this.point.set((i % 2 ? 1 : -1) * (16 + attempt * 4), 4 + attempt * 2, -6),
                        this.point
                    )
                    .add(parent.position);
                safe =
                    this.point.distance(ship.position) > 30 &&
                    rocks.every((r) => r.position.distance(this.point) > r.radius + 5) &&
                    enemies.every((e) => !e.active || e.position.distance(this.point) > e.radius + 4);
                if (safe) break;
            }
            if (!safe) continue;
            drone.spawn('drone', this.point, parent.rotation);
            drone.owner = parent.id;
            drone.ownerGeneration = parent.generation;
            parent.deployments++;
            this.deployed++;
            emit('deploy', this.point, 1);
        }
    }
    steer(p: Projectile, ship: Flight, dt: number) {
        if (!p.seeker || p.guide <= 0) return;
        p.guide -= dt;
        this.desired.copy(ship.velocity).mulScalar(0.2).add(ship.position).sub(p.position).normalize();
        const speed = p.velocity.length();
        this.direction.copy(p.velocity).normalize();
        const angle = Math.acos(Math.max(-1, Math.min(1, this.direction.dot(this.desired))));
        this.axis.cross(this.direction, this.desired);
        if (angle > 1e-5 && this.axis.lengthSq() > 1e-8) {
            this.axis.normalize();
            this.rotation.setFromAxisAngle(this.axis, (Math.min(angle, FLEET.missile.turn * dt) * 180) / Math.PI);
            this.rotation.transformVector(this.direction, this.direction);
            p.velocity.copy(this.direction).mulScalar(speed);
        }
    }
}
