import { Mat4, Quat, Vec3 } from 'playcanvas';

import type { Rock } from './collisions';
import type { CombatTarget } from './combat-target';
import type { Enemy } from './enemy';
import type { Flight } from './flight';
import { FRONTIER } from './frontier-config';
import type { Projectiles } from './projectiles';
import { sweptHit } from './projectiles';

export class InstallationPart implements CombatTarget {
    active = true;
    health = 0;
    maxHealth = 0;
    readonly position = new Vec3();
    readonly previous = new Vec3();
    readonly velocity = new Vec3();
    readonly facing = new Quat();
    readonly aim = new Vec3();
    muzzle = 0;
    cooldown = 2;
    charge = 0;
    disrupted = 0;
    flash = 0;
    readonly id: number;
    readonly local: Vec3;
    readonly radius: number;
    readonly label: string;
    readonly base: Installation;
    constructor(id: number, local: Vec3, radius: number, label: string, base: Installation) {
        this.id = id;
        this.local = local;
        this.radius = radius;
        this.label = label;
        this.base = base;
        this.maxHealth = label.includes('POWER') ? FRONTIER.turret.powerHealth : FRONTIER.turret.health;
        this.health = this.maxHealth;
    }
    get targetable() {
        return this.active;
    }
}
export class Installation {
    readonly rotation = new Quat();
    readonly parts: InstallationPart[];
    destroyed = false;
    readonly rock: Rock;
    readonly rockIndex: number;
    constructor(rock: Rock, rockIndex: number, index: number) {
        this.rock = rock;
        this.rockIndex = rockIndex;
        this.rotation.setFromEulerAngles(rockIndex * 31, rockIndex * 71, rockIndex * 17);
        const y = rock.radius + 8;
        const start = index < 2 ? 16 + index * 3 : 30 + (index - 2) * 3;
        this.parts = [
            new InstallationPart(start, new Vec3(0, y, 0), 5, 'OUTPOST POWER', this),
            new InstallationPart(start + 1, new Vec3(-12, y + 4, 0), 5, 'DEFENSE TOWER', this),
            new InstallationPart(
                start + 2,
                new Vec3(12, y + 2, 0),
                5,
                index % 2 ? 'HEAVY PLASMA' : 'MISSILE PLATFORM',
                this
            )
        ];
        this.sync();
    }
    get powered() {
        return this.parts[0].active && !this.destroyed;
    }
    sync() {
        for (const p of this.parts) {
            this.rotation.transformVector(p.local, p.position).add(this.rock.position);
            p.previous.copy(p.position);
        }
    }
}
export type LocationKind = 'outpost' | 'wreck' | 'signal' | 'station';
export class Location {
    model?: 'iss' | 'station';
    discovered = false;
    used = false;
    readonly kind: LocationKind;
    readonly name: string;
    readonly position: Vec3;
    readonly risk: boolean;
    readonly base?: Installation;
    constructor(kind: LocationKind, name: string, position: Vec3, risk: boolean, base?: Installation) {
        this.kind = kind;
        this.name = name;
        this.position = position;
        this.risk = risk;
        this.base = base;
    }
}
/** World objects persist for a run; rewards cannot be repeated by leaving/re-entering. */
export class Frontier {
    readonly solids: Rock[] = [];
    readonly bases: Installation[] = [];
    readonly locations: Location[] = [];
    readonly targets: InstallationPart[] = [];
    selected = 0;
    notice = '';
    noticeTime = 0;
    ambushPending = false;
    discoveries = 0;
    supplies = 0;
    shots = 0;
    private readonly offset = new Vec3();
    private readonly direction = new Vec3();
    private readonly zero = new Vec3();
    private readonly matrix = new Mat4();
    private readonly desired = new Quat();
    readonly rocks: Rock[];
    constructor(rocks: Rock[]) {
        this.rocks = rocks;
        // Choose existing large, separated asteroids; no collision-field regeneration.
        for (let i = 1; i < rocks.length && this.bases.length < FRONTIER.installations; i++) {
            const r = rocks[i];
            if (
                r.radius < 24 ||
                r.position.length() < 380 ||
                r.position.length() > 2200 ||
                this.bases.some((b) => b.rock.position.distance(r.position) < 260)
            )
                continue;
            const b = new Installation(r, i, this.bases.length);
            if (
                b.parts.some((p) =>
                    rocks.some((other) => other !== r && other.position.distance(p.position) < other.radius + 10)
                )
            )
                continue;
            this.bases.push(b);
            this.targets.push(...b.parts);
            this.locations.push(
                new Location(
                    'outpost',
                    ['BASTION / MILITARY', 'MINING / EXTRACTION', 'ABANDONED / OUTPOST', 'CARGO / DEFENSE'][
                        this.bases.length - 1
                    ],
                    r.position.clone(),
                    true,
                    b
                )
            );
        }
        const safe = (x: number, y: number, z: number, clearance = 55) => {
            const v = new Vec3(x, y, z);
            for (let i = 0; i < 40 && rocks.some((r) => r.position.distance(v) < r.radius + clearance); i++) v.y += 25;
            return v;
        };
        this.locations.push(new Location('wreck', 'WAYFARER / SALVAGE', safe(-320, 90, -480), false));
        this.locations.push(new Location('wreck', 'BROKEN ARRAY / AMMO', safe(420, -120, -1050), false));
        this.locations.push(new Location('signal', 'CIVILIAN RELAY / SUPPLY', safe(-560, 180, -900), false));
        this.locations.push(new Location('signal', 'MILITARY SIGNAL / AMBUSH', safe(510, 170, -1550), true));
        const iss = new Location('station', 'ISS HERITAGE / RECOVERY', safe(-800, 160, -760, 145), false);
        iss.model = 'iss';
        this.locations.push(iss);
        const station = new Location('station', 'KEPLER ORBITAL / RECOVERY', safe(850, 210, -1700, 220), false);
        station.model = 'station';
        this.locations.push(station);
        // Keep legacy navigation indices 0–7, including both orbital landmarks.
        const extraOutposts = this.locations.splice(2, Math.max(0, this.bases.length - 2));
        this.locations.push(...extraOutposts);
        this.solids.push({ position: iss.position, radius: 12 }, { position: station.position, radius: 24 });
        this.selected = Math.min(2, this.bases.length);
    }
    reset() {
        for (const b of this.bases) {
            b.destroyed = false;
            b.sync();
            for (const p of b.parts) {
                p.active = true;
                p.health = p.maxHealth;
                p.muzzle = p.charge = p.disrupted = p.flash = 0;
                p.cooldown = 2;
            }
        }
        for (const l of this.locations) l.discovered = l.used = false;
        this.selected = Math.min(2, this.bases.length);
        this.notice = '';
        this.noticeTime = this.discoveries = this.supplies = this.shots = 0;
        this.ambushPending = false;
    }
    cycle() {
        this.selected = (this.selected + 1) % this.locations.length;
    }
    notify(text: string) {
        this.notice = text;
        this.noticeTime = 4;
    }
    interact(ship: Flight, ammo: number, capacity: number = FRONTIER.supplyCap) {
        const l = this.locations[this.selected];
        if (!l || l.kind === 'outpost' || l.used || l.position.distance(ship.position) > FRONTIER.interactRange)
            return ammo;
        if (l.risk) {
            if (this.ambushPending) return ammo;
            l.used = true;
            this.ambushPending = true;
            this.notify('MILITARY TRANSPONDER / HOSTILE RESPONSE PENDING');
        } else {
            const missiles = l.name.includes('AMMO');
            if (missiles ? ammo >= capacity : ship.shield >= 70) {
                this.notify('RESERVES FULL / CACHE PRESERVED');
                return ammo;
            }
            l.used = true;
            this.supplies++;
            if (missiles) ammo = Math.min(capacity, ammo + FRONTIER.missileSupply);
            else ship.shield = Math.min(70, ship.shield + FRONTIER.shieldSupply);
            this.notify(missiles ? 'SALVAGED / +2 MISSILES' : 'SALVAGED / SHIELD RESTORED');
        }
        return ammo;
    }
    step(dt: number, ship: Flight, shots: Projectiles, bossActive: boolean) {
        this.noticeTime = Math.max(0, this.noticeTime - dt);
        for (const l of this.locations)
            if (!l.discovered && l.position.distance(ship.position) < FRONTIER.discoverRange) {
                l.discovered = true;
                this.discoveries++;
                this.notify('DISCOVERED / ' + l.name);
            }
        let hostileCount = 0;
        for (const p of shots.items) if (p.active && p.hostile) hostileCount++;
        for (const b of this.bases)
            for (let i = 1; i < b.parts.length; i++) {
                const p = b.parts[i];
                p.flash = Math.max(0, p.flash - dt);
                p.muzzle = Math.max(0, p.muzzle - dt);
                p.disrupted = Math.max(0, p.disrupted - dt);
                p.cooldown -= dt;
                const distance = p.position.distance(ship.position);
                if (
                    !p.active ||
                    !b.powered ||
                    p.disrupted > 0 ||
                    bossActive ||
                    distance > FRONTIER.turret.range ||
                    distance < FRONTIER.turret.minimum
                ) {
                    p.charge = 0;
                    continue;
                }
                let clear = true;
                for (const r of this.rocks)
                    if (sweptHit(p.position, ship.position, r.position, r.position, r.radius + 2) < Infinity) {
                        clear = false;
                        break;
                    }
                if (!clear) {
                    p.charge = 0;
                    continue;
                }
                this.direction.sub2(ship.position, p.position);
                this.matrix.setLookAt(
                    p.position,
                    p.charge > 0 ? p.aim : ship.position,
                    Math.abs(this.direction.y / distance) > 0.98 ? Vec3.RIGHT : Vec3.UP
                );
                this.desired.setFromMat4(this.matrix);
                p.facing.slerp(p.facing, this.desired, 1 - Math.exp(-2 * dt));
                if (p.charge > 0) {
                    p.charge -= dt;
                    if (p.charge <= 0) {
                        if (hostileCount < FRONTIER.turret.limit) {
                            this.direction.sub2(p.aim, p.position).normalize();
                            this.offset.copy(this.direction).mulScalar(7).add(p.position);
                            if (
                                shots.spawn(
                                    this.offset,
                                    this.direction,
                                    this.zero,
                                    p.label.includes('MISSILE')
                                        ? 100
                                        : p.label.includes('PLASMA')
                                          ? 115
                                          : FRONTIER.turret.speed,
                                    p.label.includes('PLASMA') ? 18 : FRONTIER.turret.damage,
                                    FRONTIER.turret.lifetime,
                                    true,
                                    p.label.includes('MISSILE'),
                                    p.label.includes('PLASMA')
                                )
                            ) {
                                hostileCount++;
                                this.shots++;
                                p.muzzle = 0.1;
                            }
                        }
                        p.cooldown = p.label.includes('TOWER') ? 1.8 : FRONTIER.turret.cooldown + i;
                    }
                } else if (p.cooldown <= 0 && hostileCount < FRONTIER.turret.limit) {
                    p.aim.copy(ship.velocity).mulScalar(0.35).add(ship.position);
                    p.charge = FRONTIER.turret.warning;
                }
            }
    }
    damage(p: InstallationPart, amount: number) {
        if (!p.active) return 0;
        p.health = Math.max(0, p.health - amount);
        p.flash = 0.2;
        if (p.health > 0) return 0;
        p.active = false;
        p.charge = 0;
        const b = p.base;
        if (p === b.parts[0] || !b.parts.slice(1).some((t) => t.active)) {
            b.destroyed = true;
            for (const t of b.parts) {
                t.active = false;
                t.charge = 0;
            }
            this.notify('BASTION DISABLED / POWER OFFLINE');
            return FRONTIER.turret.baseScore;
        }
        return FRONTIER.turret.score;
    }
    threatening(ship: Flight) {
        return this.bases.some(
            (b) => b.powered && b.rock.position.distance(ship.position) < FRONTIER.turret.range + 60
        );
    }
    dispatchAmbush(enemies: Enemy[], ship: Flight, bossActive: boolean) {
        if (!this.ambushPending || bossActive || enemies.some((e) => e.active)) return;
        // Reuse two enemy slots, safe world-space search, never add another pool.
        let spawned = 0;
        for (let i = 0; i < 2; i++) {
            const e = enemies.find((t) => !t.active);
            if (!e) break;
            let safe = false;
            for (let attempt = 0; attempt < 30; attempt++) {
                ship.rotation
                    .transformVector(
                        this.offset.set((i ? 1 : -1) * (130 + attempt * 8), 50 + attempt * 4, -250 - attempt * 8),
                        this.direction
                    )
                    .add(ship.position);
                safe =
                    this.rocks.every((r) => r.position.distance(this.direction) > r.radius + 22) &&
                    enemies.every((other) => !other.active || other.position.distance(this.direction) > 35);
                if (safe) break;
            }
            if (safe) {
                e.spawn('interceptor', this.direction, ship.rotation, true);
                if (i === 0) e.visual = 'saucer';
                spawned++;
            }
        }
        if (spawned > 0) {
            this.ambushPending = false;
            this.notify('SIGNAL AMBUSH / TWO ELITE SIGNATURES');
        }
    }
}
