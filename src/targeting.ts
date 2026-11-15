import { Vec3 } from 'playcanvas';

import type { Rock } from './collisions';
import type { CombatTarget } from './combat-target';
import type { Flight } from './flight';
import { TARGETING } from './targeting-config';

/** Stateless scoring plus short-lived lock memory. Ambient objects never enter this registry. */
export class Targeting {
    manualId = -1;
    message = '';
    messageTime = 0;
    private outside = 0;
    private lockedId = -1;
    private generation = 0;
    private remember(t: CombatTarget | undefined) {
        this.lockedId = t?.id ?? -1;
        this.generation = t?.generation ?? 0;
    }
    private readonly ray = new Vec3();
    private readonly forward = new Vec3();
    private readonly point = new Vec3();
    private readonly ship: Flight;
    private readonly rocks: readonly Rock[];
    constructor(ship: Flight, rocks: readonly Rock[]) {
        this.ship = ship;
        this.rocks = rocks;
    }
    notify(message: string) {
        this.message = message;
        this.messageTime = TARGETING.messageDuration;
    }
    reset() {
        this.lockedId = -1;
        this.manualId = -1;
        this.outside = 0;
        this.message = '';
        this.messageTime = 0;
    }
    clear() {
        this.lockedId = -1;
        this.manualId = -1;
        this.outside = 0;
        this.notify('TARGET LOST');
        return -1;
    }
    private range(t: CombatTarget) {
        return t.targetRole === 'craft'
            ? TARGETING.craftRange
            : t.targetRole === 'boss'
              ? TARGETING.bossRange
              : t.targetRole === 'defense'
                ? TARGETING.defenseRange
                : TARGETING.manualRange;
    }
    private visible(t: CombatTarget) {
        this.ray.sub2(t.position, this.ship.position);
        const length = this.ray.lengthSq();
        if (length < 1) return true;
        for (const r of this.rocks) {
            this.point.sub2(r.position, this.ship.position);
            const along = this.point.dot(this.ray) / length;
            if (along <= 0 || along >= 1) continue;
            this.point.sub(this.forward.copy(this.ray).mulScalar(along));
            if (this.point.lengthSq() < r.radius * r.radius) return false;
        }
        return true;
    }
    eligible(t: CombatTarget | undefined, manual = false, retain = false) {
        if (!t?.active || !t.targetable || t.health <= 0) return false;
        if (t.targetRole !== 'craft' && t.targetRole !== 'boss' && t.targetRole !== 'defense' && !manual) return false;
        const distance = this.ray.sub2(t.position, this.ship.position).length();
        if (distance > this.range(t) * (retain ? TARGETING.rangeGrace : 1) || distance < 0.001) return false;
        this.ship.rotation.transformVector(Vec3.FORWARD, this.forward);
        const dot = this.ray.mulScalar(1 / distance).dot(this.forward);
        const cone = retain
            ? TARGETING.retainCos
            : t.targetRole === 'environment'
              ? TARGETING.manualCos
              : TARGETING.acquireCos;
        return dot >= cone && this.visible(t);
    }
    best(targets: readonly CombatTarget[], manual = false) {
        let best: CombatTarget | undefined,
            bestTier = Infinity,
            bestScore = -Infinity;
        for (const t of targets) {
            const environment = t.targetRole === 'environment';
            if (!this.eligible(t, manual && environment)) continue;
            this.ray.sub2(t.position, this.ship.position);
            const distance = this.ray.length();
            this.ship.rotation.transformVector(Vec3.FORWARD, this.forward);
            const dot = this.ray.mulScalar(1 / distance).dot(this.forward);
            // RMB can deliberately select an environmental object only under the tight central reticle.
            const tier = manual && environment ? -1 : t.targetRole === 'craft' ? 0 : t.targetRole === 'boss' ? 1 : 2;
            const closing = Math.max(-1, Math.min(1, -t.velocity.dot(this.ray) / 100));
            const score =
                ((dot - TARGETING.acquireCos) / (1 - TARGETING.acquireCos)) * 0.65 +
                (1 - distance / this.range(t)) * 0.35 +
                closing * 0.025;
            if (tier < bestTier || (tier === bestTier && score > bestScore)) {
                best = t;
                bestTier = tier;
                bestScore = score;
            }
        }
        return best;
    }
    select(targets: readonly CombatTarget[], manual = false) {
        const t = this.best(targets, manual);
        this.manualId = manual && t?.targetRole === 'environment' ? t.id : -1;
        this.outside = 0;
        this.remember(t);
        this.notify(t ? 'TARGET ACQUIRED' : 'NO HOSTILE TARGET');
        return t?.id ?? -1;
    }
    update(id: number, targets: readonly CombatTarget[], dt: number) {
        this.messageTime = Math.max(0, this.messageTime - dt);
        if (id < 0) return id;
        const t = targets.find((t) => t.id === id);
        if (
            !t?.active ||
            !t.targetable ||
            t.health <= 0 ||
            (this.lockedId === id && (t.generation ?? 0) !== this.generation)
        )
            return this.clear();
        if (this.lockedId !== id) this.remember(t);
        if (this.eligible(t, id === this.manualId, true)) this.outside = 0;
        else this.outside += dt;
        return this.outside >= TARGETING.grace ? this.clear() : id;
    }
    missile(current: CombatTarget | undefined, targets: readonly CombatTarget[]) {
        // A manually selected barrel must still yield to a relevant hostile craft/boss.
        const sameLife = this.lockedId !== current?.id || (current?.generation ?? 0) === this.generation;
        let target = sameLife && current?.targetRole !== 'environment' && this.eligible(current) ? current : undefined;
        target ??= this.best(targets);
        if (!target && current?.id === this.manualId && this.eligible(current, true)) target = current;
        this.outside = 0;
        this.remember(target);
        this.notify(target ? 'MISSILE LOCK' : 'NO HOSTILE TARGET');
        return target;
    }
    assist(t: CombatTarget | undefined) {
        if (
            !this.eligible(t, t?.id === this.manualId) ||
            (this.lockedId === t?.id && (t?.generation ?? 0) !== this.generation)
        )
            return false;
        const distance = this.ray.sub2(t!.position, this.ship.position).length();
        this.ship.rotation.transformVector(Vec3.FORWARD, this.forward);
        return (
            distance <= TARGETING.laserRange && this.ray.mulScalar(1 / distance).dot(this.forward) >= TARGETING.laserCos
        );
    }
}
