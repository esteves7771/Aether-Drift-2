import { Mat4, Quat, Vec3 } from 'playcanvas';

import type { Rock } from './collisions';
export const CONVOY = {
    capacity: 2,
    cruisers: 3,
    escorts: 6,
    first: 45,
    interval: [150, 240],
    length: 260,
    clearance: 160,
    combatClearance: 600,
    routeLength: 3600
} as const;
export type ConvoyKind = 'standard' | 'heavy' | 'station' | 'fast';
export class ConvoyGroup {
    active = false;
    age = 0;
    duration = 110;
    kind: ConvoyKind = 'standard';
    cruisers = 1;
    escorts = 2;
    readonly start = new Vec3();
    readonly end = new Vec3();
    readonly control = new Vec3();
    readonly position = new Vec3();
    readonly direction = new Vec3();
    readonly rotation = new Quat();
    readonly members = Array.from({ length: 9 }, () => new Vec3());
    readonly corridor = Array.from({ length: 33 }, () => new Vec3());
    envelope = 190;
    private readonly offset = new Vec3();
    private readonly matrix = new Mat4();
    sample(t: number, out: Vec3) {
        return out
            .copy(this.start)
            .mulScalar((1 - t) ** 2)
            .add(this.offset.copy(this.control).mulScalar(2 * t * (1 - t)))
            .add(this.offset.copy(this.end).mulScalar(t * t));
    }
    update(dt: number) {
        if (!this.active) return;
        this.age += dt;
        const t = Math.min(1, this.age / this.duration);
        this.sample(t, this.position);
        this.direction
            .copy(this.control)
            .sub(this.start)
            .mulScalar(1 - t)
            .add(this.offset.copy(this.end).sub(this.control).mulScalar(t))
            .normalize();
        this.matrix.setLookAt(
            this.position,
            this.offset.copy(this.position).add(this.direction),
            Math.abs(this.direction.y) > 0.98 ? Vec3.RIGHT : Vec3.UP
        );
        this.rotation.setFromMat4(this.matrix);
        for (let i = 0; i < 9; i++) {
            if (i < 3) {
                this.offset.set(this.cruisers === 1 ? 0 : (i - 1) * 390, i === 1 ? 35 : 0, i === 1 ? 180 : 0);
            } else {
                const j = i - 3;
                this.offset.set(
                    (j % 2 ? 1 : -1) * (150 + Math.floor(j / 2) * 45),
                    Math.sin(j * 2) * 85,
                    180 + Math.floor(j / 2) * 110
                );
            }
            this.rotation.transformVector(this.offset, this.members[i]).add(this.position);
        }
        if (t === 1) this.active = false;
    }
}
/** Cosmetic trajectories only: no CombatTarget, damage, collision response or wave membership. */
export class Convoys {
    blocked = false;
    readonly groups = Array.from({ length: 2 }, () => new ConvoyGroup());
    countdown = CONVOY.first as number;
    events = 0;
    private seed = 0x5a11ce;
    private readonly center = new Vec3();
    private readonly offset = new Vec3();
    private readonly ray = new Vec3();
    readonly exclusions = this.groups.flatMap((g) =>
        g.corridor.map((position) => ({
            position,
            get radius() {
                return g.envelope + 60;
            },
            get active() {
                return g.active;
            }
        }))
    );
    readonly obstacles: readonly Rock[];
    readonly stations: readonly Vec3[];
    constructor(obstacles: readonly Rock[], stations: readonly Vec3[]) {
        this.obstacles = obstacles;
        this.stations = stations;
    }
    reset(seed = 0x5a11ce) {
        this.seed = seed;
        this.countdown = CONVOY.first;
        this.events = 0;
        for (const g of this.groups) {
            g.active = false;
            g.age = 0;
        }
    }
    private random() {
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        return this.seed / 4294967296;
    }
    safe(g: ConvoyGroup, player: Vec3) {
        for (let i = 0; i <= 32; i++) {
            g.sample(i / 32, g.corridor[i]);
            const p = g.corridor[i];
            if (p.distance(player) < g.envelope + CONVOY.combatClearance) return false;
            for (const r of this.obstacles) if (p.distance(r.position) < r.radius + g.envelope + 60) return false;
            for (const other of this.groups)
                if (other !== g && other.active)
                    for (const q of other.corridor) if (p.distance(q) < g.envelope + other.envelope + 120) return false;
        }
        return true;
    }
    begin(player: Vec3, rotation: Quat, kind?: ConvoyKind) {
        const g = this.groups.find((g) => !g.active);
        if (!g) return false;
        const r = this.random();
        g.kind = kind ?? (r < 0.1 ? 'heavy' : r < 0.3 ? 'station' : r < 0.4 ? 'fast' : 'standard');
        g.cruisers = g.kind === 'heavy' ? 3 : g.kind === 'station' ? 2 : 1;
        g.escorts = g.kind === 'heavy' ? 6 : g.kind === 'station' ? 4 : 2;
        g.envelope = g.cruisers === 3 ? 590 : g.cruisers === 2 ? 540 : 190;
        for (let attempt = 0; attempt < 64; attempt++) {
            const angle = this.random() * Math.PI * 2,
                range = 1200 + this.random() * 1800;
            this.offset.set(Math.cos(angle) * range, 250 + this.random() * 450, -900 - Math.sin(angle) * range);
            rotation.transformVector(this.offset, this.center).add(player);
            if (g.kind === 'station' && this.stations.length) {
                this.center.copy(this.stations[this.events % this.stations.length]);
                this.center.y += 650 + g.envelope;
                this.center.x += 900;
            }
            const a = this.random() * Math.PI * 2;
            this.ray
                .set(Math.cos(a), 0.08 * Math.sin(a * 2), Math.sin(a))
                .normalize()
                .mulScalar(CONVOY.routeLength / 2);
            g.start.copy(this.center).sub(this.ray);
            g.end.copy(this.center).add(this.ray);
            g.control.copy(this.center);
            g.control.y += 180;
            if (!this.safe(g, player)) continue;
            g.age = 0;
            g.duration = g.kind === 'fast' ? 65 : 110 + this.random() * 25;
            g.active = true;
            g.update(0);
            this.events++;
            return true;
        }
        return false;
    }
    step(dt: number, player: Vec3, rotation: Quat, busy: boolean) {
        this.blocked = busy;
        for (const g of this.groups) g.update(dt);
        if (dt <= 0) return;
        this.countdown -= dt;
        if (this.countdown > 0) return;
        if (busy) {
            this.countdown = 8;
            return;
        }
        this.countdown = this.begin(player, rotation)
            ? CONVOY.interval[0] + this.random() * (CONVOY.interval[1] - CONVOY.interval[0])
            : 12;
    }
}
