import { Mat4, Quat, Vec3 } from 'playcanvas';

import type { Rock } from './collisions';
import type { Flight } from './flight';
import { RIFT } from './rift-config';
import type { RiftTuning } from './rift-config';
export type ArrivalStage = 'seeking' | 'gather' | 'form' | 'emerge' | 'collapse' | 'settle' | 'combat';
export interface ArrivalObstacle extends Rock {
    active?: boolean;
}
export interface TransitCorridor {
    start: Vec3;
    end: Vec3;
    active: boolean;
}
/** Deterministic, swept-footprint placement and continuous physical emergence. No camera/control ownership. */
export class RiftArrival {
    stage: ArrivalStage = 'combat';
    age = 0;
    radius = 0;
    emergence = 0;
    serial = 0;
    readonly anchor = new Vec3();
    readonly normal = new Vec3();
    readonly rotation = new Quat();
    readonly start = new Vec3();
    readonly end = new Vec3();
    obstacles: readonly ArrivalObstacle[] = [];
    transit?: TransitCorridor;
    private readonly local = new Vec3();
    private readonly point = new Vec3();
    private readonly offset = new Vec3();
    private readonly ray = new Vec3();
    private readonly farStart = new Vec3();
    private readonly farEnd = new Vec3();
    private readonly matrix = new Mat4();
    private retry = 0;
    readonly tuning: RiftTuning;
    constructor(tuning: RiftTuning = RIFT) {
        this.tuning = tuning;
    }
    get complete() {
        return this.stage === 'combat';
    }
    get duration() {
        const c = this.tuning;
        return c.gather + c.form + c.emerge + c.collapse + c.settle;
    }
    reset() {
        this.stage = 'combat';
        this.age = this.radius = this.emergence = this.retry = 0;
    }
    private distanceSq(point: Vec3, start: Vec3, end: Vec3) {
        this.ray.sub2(end, start);
        const length = this.ray.lengthSq(),
            t = length > 0 ? Math.max(0, Math.min(1, this.offset.sub2(point, start).dot(this.ray) / length)) : 0;
        return this.offset.copy(this.ray).mulScalar(t).add(start).sub(point).lengthSq();
    }
    corridorClear(anchor: Vec3, normal: Vec3, rocks: readonly ArrivalObstacle[], player: Vec3) {
        const c = this.tuning;
        this.farStart
            .copy(normal)
            .mulScalar(-c.behind - c.bodyHalfLength)
            .add(anchor);
        this.farEnd
            .copy(normal)
            .mulScalar(c.ahead + c.bodyHalfLength)
            .add(anchor);
        if (this.distanceSq(player, this.farStart, this.farEnd) < (c.clearance + 30) ** 2) return false;
        for (const group of [rocks, this.obstacles])
            for (const r of group) {
                if (r.active === false) continue;
                if (this.distanceSq(r.position, this.farStart, this.farEnd) < (r.radius + c.clearance) ** 2)
                    return false;
            }
        if (this.transit?.active)
            for (let i = 0; i <= 32; i++) {
                this.point.lerp(this.transit.start, this.transit.end, i / 32);
                if (this.distanceSq(this.point, this.farStart, this.farEnd) < (c.clearance + 80) ** 2) return false;
            }
        return true;
    }
    begin(ship: Flight, rocks: readonly Rock[]) {
        this.stage = 'seeking';
        this.age = this.radius = this.emergence = 0;
        this.serial++;
        for (let i = 0; i < this.tuning.candidates; i++) {
            const angle = i * 2.399963 + this.serial * 0.27,
                r = Math.sqrt(i / this.tuning.candidates) * 620;
            this.local.set(
                Math.sin(angle) * r * 0.8,
                80 + Math.abs(Math.cos(angle)) * r * 0.85,
                -this.tuning.distance - i * 1.15
            );
            ship.rotation.transformVector(this.local, this.anchor).add(ship.position);
            this.normal.sub2(ship.position, this.anchor).normalize();
            if (!this.corridorClear(this.anchor, this.normal, rocks, ship.position)) continue;
            this.start.copy(this.normal).mulScalar(-this.tuning.behind).add(this.anchor);
            this.end.copy(this.normal).mulScalar(this.tuning.ahead).add(this.anchor);
            this.matrix.setLookAt(this.anchor, ship.position, Math.abs(this.normal.y) > 0.98 ? Vec3.RIGHT : Vec3.UP);
            this.rotation.setFromMat4(this.matrix);
            this.stage = 'gather';
            return true;
        }
        this.retry = 1;
        return false;
    }
    step(dt: number, ship: Flight, rocks: readonly Rock[]) {
        if (this.complete || dt <= 0) return;
        if (this.stage === 'seeking') {
            this.retry -= dt;
            if (this.retry <= 0) this.begin(ship, rocks);
            return;
        }
        this.age += dt;
        const c = this.tuning,
            g = c.gather,
            f = g + c.form,
            e = f + c.emerge,
            k = e + c.collapse;
        if (this.age < g) {
            this.stage = 'gather';
            this.radius = 3 + 19 * (this.age / g) ** 2;
        } else if (this.age < f) {
            this.stage = 'form';
            const t = (this.age - g) / c.form;
            this.radius = 22 + (c.radius - 22) * t * t * (3 - 2 * t);
        } else if (this.age < e) {
            this.stage = 'emerge';
            this.radius = c.radius;
            const t = (this.age - f) / c.emerge;
            this.emergence = t * t * (3 - 2 * t);
        } else if (this.age < k) {
            this.stage = 'collapse';
            this.emergence = 1;
            this.radius = c.radius * (1 - (this.age - e) / c.collapse) ** 1.5;
        } else {
            this.emergence = 1;
            this.radius = 0;
            this.stage = this.age < k + c.settle ? 'settle' : 'combat';
        }
    }
    sample(out: Vec3) {
        return out.lerp(this.start, this.end, this.emergence);
    }
}
