import { Vec3 } from 'playcanvas';

import type { CombatTarget } from './combat-target';
import type { Frontier } from './frontier';
import { LIVING } from './living-config';

export class Barrel implements CombatTarget {
    readonly targetRole = 'environment' as const;
    active = true;
    health: number = LIVING.barrelHealth;
    readonly maxHealth = LIVING.barrelHealth;
    readonly radius = LIVING.barrelRadius;
    readonly label = 'VOLATILE CARGO';
    readonly position = new Vec3();
    readonly previous = new Vec3();
    readonly velocity = new Vec3();
    readonly origin = new Vec3();
    flash = 0;
    age = 0;
    readonly id: number;
    constructor(id: number) {
        this.id = id;
    }
    get targetable() {
        return this.active;
    }
}
/** Run-persistent hazards. A bounded iterative queue makes every barrel detonate once. */
export class Barrels {
    readonly items = Array.from({ length: LIVING.barrels }, (_, i) => new Barrel(40 + i));
    private readonly queue = new Int16Array(LIVING.chainLimit);
    constructor(world: Frontier) {
        const sites = world.locations.filter((l) => l.kind !== 'signal');
        for (let i = 0; i < this.items.length; i++) {
            const b = this.items[i],
                site = sites[Math.floor(i / 3) % sites.length];
            b.origin.copy(site.position);
            if (site.base)
                site.base.rotation
                    .transformVector(new Vec3(((i % 3) - 1) * 12, site.base.rock.radius + 20, 28), b.origin)
                    .add(site.position);
            else b.origin.add(new Vec3(18 + (i % 3) * 13, 5 + (i % 2) * 8, -12));
        }
        this.items[this.items.length - 1].origin.set(-120, 80, -700);
        this.reset();
    }
    reset() {
        for (const b of this.items) {
            b.active = true;
            b.health = LIVING.barrelHealth;
            b.flash = b.age = 0;
            b.position.copy(b.origin);
            b.previous.copy(b.origin);
            b.velocity.set(Math.sin(b.id) * 0.16, Math.cos(b.id) * 0.1, 0.08);
        }
    }
    step(dt: number, player: Vec3) {
        for (const b of this.items)
            if (b.active && b.position.distance(player) < LIVING.activeRange) {
                b.previous.copy(b.position);
                b.age += dt;
                b.flash = Math.max(0, b.flash - dt);
                // A closed slow orbit avoids drifting permanently away from authored sites.
                b.position.set(
                    b.origin.x + Math.sin(b.age * 0.04 + b.id) * 2,
                    b.origin.y + Math.sin(b.age * 0.035) * 2,
                    b.origin.z + Math.sin(b.age * 0.04) * 2
                );
            }
    }
    damage(b: Barrel, amount: number, detonate: (barrel: Barrel) => void) {
        if (!b.active) return;
        b.health -= amount;
        b.flash = 0.15;
        if (b.health > 0) return;
        let read = 0,
            write = 1;
        b.active = false;
        this.queue[0] = this.items.indexOf(b);
        while (read < write && read < LIVING.chainLimit) {
            const source = this.items[this.queue[read++]];
            detonate(source);
            for (let i = 0; i < this.items.length; i++) {
                const other = this.items[i];
                if (!other.active) continue;
                const damage =
                    LIVING.blastDamage * Math.max(0, 1 - other.position.distance(source.position) / LIVING.blastRadius);
                other.health -= damage;
                if (other.health <= 0 && write < LIVING.chainLimit) {
                    other.active = false;
                    this.queue[write++] = i;
                }
            }
        }
    }
}
