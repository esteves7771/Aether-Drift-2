import { Vec3 } from 'playcanvas';

import { COMBAT } from './combat-config';
import { FLEET } from './fleet-config';
export class Projectile {
    active = false;
    hostile = false;
    seeker = false;
    plasma = false;
    alien = false;
    guide = 0;
    pattern = 0;
    get missile() {
        return this.seeker;
    }
    damage = 0;
    life = 0;
    radius = 0;
    readonly position = new Vec3();
    readonly previous = new Vec3();
    readonly velocity = new Vec3();
}
/** Earliest contact in [0,1], including an initial overlap. Relative motion supports moving targets. */
export function sweptHit(start: Vec3, end: Vec3, targetStart: Vec3, targetEnd: Vec3, radius: number): number {
    const x = start.x - targetStart.x,
        y = start.y - targetStart.y,
        z = start.z - targetStart.z;
    const dx = end.x - targetEnd.x - x,
        dy = end.y - targetEnd.y - y,
        dz = end.z - targetEnd.z - z;
    const c = x * x + y * y + z * z - radius * radius;
    if (c <= 0) return 0;
    const a = dx * dx + dy * dy + dz * dz;
    if (a < 1e-10) return Infinity;
    const b = x * dx + y * dy + z * dz,
        discriminant = b * b - a * c;
    if (discriminant < 0) return Infinity;
    const t = (-b - Math.sqrt(discriminant)) / a;
    return t >= 0 && t <= 1 ? t : Infinity;
}
export class Projectiles {
    readonly items = Array.from({ length: COMBAT.projectileCapacity }, () => new Projectile());
    fired = 0;
    dropped = 0;
    reset() {
        for (const p of this.items) p.active = false;
        this.fired = this.dropped = 0;
    }
    spawn(
        position: Vec3,
        direction: Vec3,
        inherited: Vec3,
        speed: number,
        damage: number,
        lifetime: number,
        hostile: boolean,
        seeker = false,
        plasma = false,
        alien = false,
        pattern = 0
    ) {
        const p = this.items.find((item) => !item.active);
        if (!p) {
            this.dropped++;
            return false;
        }
        p.active = true;
        p.hostile = hostile;
        p.seeker = seeker;
        p.plasma = plasma;
        p.alien = alien;
        p.pattern = pattern;
        p.guide = seeker ? FLEET.missile.guide : 0;
        p.position.copy(position);
        p.previous.copy(position);
        p.velocity.copy(direction).mulScalar(speed).add(inherited);
        p.damage = damage;
        p.life = lifetime;
        p.radius = hostile ? (pattern === 1 ? 2.2 : pattern === 4 ? 1.4 : 1) : COMBAT.player.radius;
        this.fired++;
        return true;
    }
}
