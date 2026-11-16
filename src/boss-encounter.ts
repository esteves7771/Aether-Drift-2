import { Vec3 } from 'playcanvas';

import type { EncounterBoss } from './boss-fleet';
import { BULLETHELL } from './bullethell-config';
import type { Rock } from './collisions';
import type { Flight } from './flight';
import type { ArrivalObstacle } from './rift-arrival';
export const dualWave = (wave: number) => wave >= BULLETHELL.dual.firstWave && wave % BULLETHELL.dual.interval === 0;
/** Two existing boss instances, one major-attack token, finite arrivals and one victory notification. */
export class BossEncounter {
    dual = false;
    pending = -1;
    owner = 0;
    victoryAnnounced = false;
    private delay = 0;
    private armed = false;
    private readonly original = new Map<
        EncounterBoss,
        { obstacles: readonly ArrivalObstacle[]; avoidance: readonly Rock[] }
    >();
    reset() {
        for (const [b, base] of this.original) {
            b.arrival.obstacles = base.obstacles;
            b.avoidance = base.avoidance;
        }
        this.original.clear();
        this.dual = false;
        this.pending = -1;
        this.delay = 0;
        this.owner = 0;
        this.armed = false;
        this.victoryAnnounced = false;
    }
    begin(wave: number, bosses: readonly EncounterBoss[], primary: EncounterBoss) {
        this.reset();
        this.dual = dualWave(wave);
        this.owner = bosses.indexOf(primary);
        if (!this.dual) return;
        this.pending = (this.owner + 1) % bosses.length;
        this.delay = BULLETHELL.dual.secondDelay;
        for (const b of bosses) this.original.set(b, { obstacles: b.arrival.obstacles, avoidance: b.avoidance });
        for (const b of bosses)
            b.avoidance = [
                ...b.avoidance,
                ...bosses
                    .filter((o) => o !== b)
                    .map((other) => ({
                        position: other.position,
                        get radius() {
                            return other.active ? (other.patterns.profile === 'phantom' ? 45 : 155) : -1e6;
                        },
                        get active() {
                            return other.active;
                        }
                    }))
            ];
    }
    step(dt: number, bosses: readonly EncounterBoss[], ship: Flight, rocks: Rock[]) {
        if (!this.dual) {
            for (const b of bosses) {
                b.patterns.permitted = true;
                b.patterns.limit = BULLETHELL.single;
            }
            return;
        }
        this.delay -= dt;
        if (this.pending >= 0 && this.delay <= 0) {
            const first = bosses[this.owner];
            if (first.arrival.stage !== 'seeking') {
                const next = bosses[this.pending];
                const corridor = Array.from({ length: 9 }, (_, i) => ({
                    position: new Vec3().lerp(first.arrival.start, first.arrival.end, i / 8),
                    radius: first.arrival.tuning.clearance + 80,
                    get active() {
                        return first.arriving;
                    }
                }));
                next.arrival.obstacles = [
                    ...next.arrival.obstacles,
                    ...corridor,
                    ...first.hull,
                    {
                        position: first.position,
                        radius: first.patterns.profile === 'phantom' ? 50 : 155,
                        get active() {
                            return first.active || first.dying > 0;
                        }
                    }
                ];
                next.spawn(ship, rocks);
                this.pending = -1;
            }
        }
        const arriving = this.pending >= 0 || bosses.some((b) => b.active && b.arriving);
        if (!bosses[this.owner]?.active) {
            const next = bosses.findIndex((b) => b.active);
            if (next >= 0) this.owner = next;
            this.armed = false;
        }
        const current = bosses[this.owner];
        if (current?.patterns.state === 'fire') this.armed = true;
        if (
            !arriving &&
            this.armed &&
            current.patterns.state === 'recover' &&
            current.patterns.time > BULLETHELL.dual.handoff
        ) {
            const next = bosses.findIndex((b, i) => i !== this.owner && b.active);
            if (next >= 0) {
                this.owner = next;
                this.armed = false;
            }
        }
        if (arriving) for (const b of bosses) if (b.active) b.grace = Math.max(b.grace, 0.25);
        for (let i = 0; i < bosses.length; i++) {
            bosses[i].patterns.permitted = !arriving && i === this.owner;
            bosses[i].patterns.limit = BULLETHELL.dualLimit;
        }
    }
}
