import { Quat, Vec3 } from 'playcanvas';

import type { Rock } from './collisions';
import type { Frontier } from './frontier';
import { UNIVERSE } from './universe-config';
export type SatelliteKind = 'orbit' | 'drift' | 'static' | 'abandoned';
export class Satellite {
    readonly position = new Vec3();
    readonly origin = new Vec3();
    readonly u = new Vec3();
    readonly v = new Vec3();
    readonly rotation = new Quat();
    readonly id: number;
    readonly kind: SatelliteKind;
    phase = 0;
    speed = 0;
    radius = 0;
    constructor(id: number, kind: SatelliteKind) {
        this.id = id;
        this.kind = kind;
    }
    sample(time: number, out: Vec3) {
        out.copy(this.origin);
        const a = this.phase + time * this.speed;
        if (this.kind === 'orbit') {
            out.x += this.radius * (this.u.x * Math.cos(a) + this.v.x * Math.sin(a));
            out.y += this.radius * (this.u.y * Math.cos(a) + this.v.y * Math.sin(a));
            out.z += this.radius * (this.u.z * Math.cos(a) + this.v.z * Math.sin(a));
        } else if (this.kind === 'drift') {
            out.x += Math.sin(a) * this.radius;
            out.y += Math.sin(a * 0.71) * this.radius * 0.45;
            out.z += Math.cos(a * 0.83) * this.radius * 0.65;
        }
        return out;
    }
}
/** No camera-relative placement, target IDs, health, collision proxies, or combat callbacks. */
export class Universe {
    readonly satellites: Satellite[] = [];
    readonly obstacles: Rock[];
    time = 0;
    private seed = 0x5fc2026;
    private accumulator = 0;
    private readonly point = new Vec3();
    constructor(frontier: Frontier, rocks: readonly Rock[]) {
        // Conservative visual footprints, rather than the deliberately small gameplay station proxies.
        this.obstacles = [
            ...rocks,
            ...frontier.locations
                .filter((l) => l.model)
                .map((l) => ({ position: l.position, radius: l.model === 'iss' ? 85 : 145 }))
        ];
        const anchors = frontier.locations.filter((l) => l.model || l.base);
        for (const kind of ['orbit', 'drift', 'static', 'abandoned'] as const) {
            for (let i = 0; i < UNIVERSE.satellite[kind]; i++) {
                const s = new Satellite(this.satellites.length, kind);
                s.phase = this.random() * Math.PI * 2;
                s.speed =
                    kind === 'orbit'
                        ? 0.004 + this.random() * 0.008
                        : kind === 'drift'
                          ? 0.006 + this.random() * 0.009
                          : 0;
                const anchor = anchors[i % anchors.length];
                for (let attempt = 0; attempt < 800; attempt++) {
                    const a = this.random() * Math.PI * 2,
                        y = (this.random() - 0.5) * 1.3;
                    s.u.set(Math.cos(a), y, Math.sin(a)).normalize();
                    s.v.cross(s.u, Vec3.UP).normalize();
                    if (kind === 'orbit') {
                        s.origin.copy(anchor.position);
                        const footprint =
                            anchor.model === 'station'
                                ? 145
                                : anchor.model === 'iss'
                                  ? 85
                                  : (anchor.base?.rock.radius ?? 35);
                        s.radius = footprint + 55 + this.random() * 160;
                        // Tilt the orbital plane without affecting the anchor or world geometry.
                        s.rotation.setFromEulerAngles(15 + this.random() * 60, 0, this.random() * 80);
                        s.rotation.transformVector(s.u, s.u);
                        s.rotation.transformVector(s.v, s.v);
                    } else {
                        const abandoned = frontier.locations.filter((l) => l.kind === 'wreck');
                        const site =
                            kind === 'abandoned'
                                ? abandoned[i % abandoned.length]
                                : kind === 'static'
                                  ? anchors[i % anchors.length]
                                  : undefined;
                        if (site) {
                            const d = (site.base?.rock.radius ?? (site.model ? 150 : 30)) + 65 + this.random() * 100;
                            s.origin.copy(site.position).add(this.point.copy(s.u).mulScalar(d));
                        } else
                            s.origin.set(
                                (this.random() - 0.5) * 2600,
                                (this.random() - 0.5) * 850,
                                -100 - this.random() * 2100
                            );
                        s.radius = kind === 'drift' ? 20 + this.random() * 45 : 0;
                    }
                    if (this.safeOrbit(s)) break;
                    if (attempt === 799) throw Error('No safe satellite placement ' + s.id);
                }
                s.sample(0, s.position);
                this.satellites.push(s);
            }
        }
    }
    random() {
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
    safe(point: Vec3, padding: number = UNIVERSE.satellite.padding) {
        return this.obstacles.every((r) => r.position.distance(point) > r.radius + padding);
    }
    private safeOrbit(s: Satellite) {
        // Full orbit / conservative drift envelope. Smooth bounded drifts never wrap.
        if (s.kind === 'drift') return this.safe(s.origin, s.radius * 1.3 + UNIVERSE.satellite.padding);
        for (let i = 0; i < 96; i++) {
            s.sample(s.speed ? ((i / 96) * Math.PI * 2) / s.speed : 0, this.point);
            if (!this.safe(this.point, UNIVERSE.satellite.padding + (s.kind === 'orbit' ? s.radius * 0.035 : 0)))
                return false;
        }
        return true;
    }
    step(dt: number) {
        this.time += dt;
        this.accumulator += dt;
        if (this.accumulator < UNIVERSE.satellite.sampleStep) return;
        this.accumulator %= UNIVERSE.satellite.sampleStep;
        for (const s of this.satellites) s.sample(this.time, s.position);
    }
    reset() {
        this.time = this.accumulator = 0;
        for (const s of this.satellites) s.sample(0, s.position);
    }
}

export type TrafficKind = 'courier' | 'transport' | 'patrol';
export class AmbientTraffic {
    active = false;
    kind: TrafficKind = 'courier';
    count = 0;
    age = 0;
    duration = 0;
    events = 0;
    countdown = 30;
    readonly start = new Vec3();
    readonly end = new Vec3();
    readonly direction = new Vec3();
    readonly positions = Array.from({ length: 3 }, () => new Vec3());
    private seed = 0xaef5fc;
    private readonly offset = new Vec3();
    private readonly closest = new Vec3();
    private readonly ray = new Vec3();
    private readonly world: Universe;
    private readonly sites: readonly Vec3[];
    constructor(world: Universe, frontier: Frontier) {
        this.world = world;
        this.sites = frontier.locations.map((l) => l.position);
    }
    private random() {
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
    safePath(start: Vec3, end: Vec3, player: Vec3) {
        this.ray.sub2(end, start);
        const length = this.ray.lengthSq();
        if (length < 1) return false;
        for (const r of this.world.obstacles) {
            const t = Math.max(0, Math.min(1, this.offset.sub2(r.position, start).dot(this.ray) / length));
            this.closest.copy(this.ray).mulScalar(t).add(start);
            if (this.closest.distance(r.position) < r.radius + UNIVERSE.traffic.clearance) return false;
        }
        const t = Math.max(0, Math.min(1, this.offset.sub2(player, start).dot(this.ray) / length));
        return this.closest.copy(this.ray).mulScalar(t).add(start).distance(player) > UNIVERSE.traffic.clearance + 40;
    }
    private begin(player: Vec3, rotation?: Quat) {
        const n = this.events % 3;
        this.kind = (['courier', 'transport', 'patrol'] as const)[n];
        this.count = n === 2 ? 3 : n === 1 ? 2 : 1;
        this.duration = UNIVERSE.traffic.duration[n];
        for (let i = 0; i < 64; i++) {
            const a = this.random() * Math.PI * 2;
            this.direction.set(Math.cos(a), 0.08 * (this.random() - 0.5), Math.sin(a)).normalize();
            // Events cross a visible, safe corridor ahead of the player. Transports use a site-to-site bearing.
            if (n === 1) {
                const site = this.sites[this.events % this.sites.length],
                    other = this.sites[(this.events + 3) % this.sites.length];
                this.direction.sub2(other, site).normalize();
            }
            this.offset.set(
                (this.random() - 0.5) * 420,
                100 + (this.random() - 0.5) * 200,
                -UNIVERSE.traffic.distance - this.random() * 350
            );
            if (rotation) {
                rotation.transformVector(this.offset, this.offset);
                rotation.transformVector(this.direction, this.direction);
            }
            this.offset.add(player);
            const half = UNIVERSE.traffic.speed[n] * this.duration * 0.5;
            this.start.copy(this.direction).mulScalar(-half).add(this.offset);
            this.end.copy(this.direction).mulScalar(half).add(this.offset);
            if (n === 1) {
                const site = this.sites[this.events % this.sites.length],
                    other = this.sites[(this.events + 3) % this.sites.length],
                    lift = 160 + i * 18;
                this.start.copy(site);
                this.start.y += lift;
                this.end.copy(other);
                this.end.y += lift;
                this.direction.sub2(this.end, this.start).normalize();
                this.duration = Math.max(12, Math.min(24, this.start.distance(this.end) / UNIVERSE.traffic.speed[n]));
            }
            if (this.safePath(this.start, this.end, player)) {
                this.active = true;
                this.age = 0;
                this.events++;
                this.sample();
                return;
            }
        }
        this.countdown = 3; // Wait for a safe corridor; never force a path through obstacles.
    }
    private sample() {
        const t = Math.min(1, this.age / this.duration),
            ease = t * t * (3 - 2 * t);
        for (let i = 0; i < this.count; i++) {
            this.positions[i].lerp(this.start, this.end, ease);
            this.positions[i].x += this.direction.z * (i - 1) * 23;
            this.positions[i].z -= this.direction.x * (i - 1) * 23;
            this.positions[i].y += i === 1 ? 12 : 0;
        }
    }
    step(dt: number, player: Vec3, critical: boolean, rotation?: Quat) {
        if (dt <= 0) return;
        if (this.active) {
            this.age += dt;
            this.sample();
            if (this.age >= this.duration) {
                this.active = false;
                this.count = 0;
                this.countdown = Math.max(
                    8,
                    UNIVERSE.traffic.minimumInterval +
                        this.random() * UNIVERSE.traffic.intervalVariation -
                        this.duration
                );
            }
            return;
        }
        this.countdown = Math.max(0, this.countdown - dt);
        if (this.countdown === 0 && !critical) this.begin(player, rotation);
    }
    reset() {
        this.active = false;
        this.count = this.age = this.events = 0;
        this.countdown = 30;
        this.seed = 0xaef5fc;
    }
}
