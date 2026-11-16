import { Vec3 } from 'playcanvas';

import type { Artillery } from './artillery';
import { BULLETHELL } from './bullethell-config';
import type { Rock } from './collisions';
import type { Enemy } from './enemy';
import type { Flight } from './flight';
import type { Phantom } from './phantom';
import type { Tesser } from './tesser';
export type EncounterBoss = Artillery | Phantom | Tesser;
/** Finite reinforcements inside the existing eight enemy slots. No new AI or score authority. */
export class BossFleet {
    deployed = 0;
    private pending = 0;
    private clock = 0;
    private phases = [0, 0, 0];
    private readonly point = new Vec3();
    reset() {
        this.deployed = this.pending = this.clock = 0;
        this.phases.fill(0);
    }
    begin() {
        this.reset();
        this.pending = 2;
        this.clock = 1;
    }
    step(
        dt: number,
        bosses: readonly EncounterBoss[],
        enemies: Enemy[],
        ship: Flight,
        obstacles: readonly Rock[],
        dual = false,
        extra: readonly Rock[] = []
    ) {
        if (dt <= 0) return;
        let active = 0,
            owner = 0,
            escorts = 0;
        for (let i = 0; i < bosses.length; i++)
            if (bosses[i].active) {
                active++;
                owner = i;
                if (bosses[i].phase > this.phases[i]) {
                    if (this.phases[i] > 0) this.pending++;
                    this.phases[i] = bosses[i].phase;
                }
            }
        for (const e of enemies)
            if (e.active && e.escortOwner >= 0) {
                if (!bosses[e.escortOwner]?.active) e.active = false;
                else escorts++;
            }
        if (!active) {
            this.pending = 0;
            return;
        }
        if (bosses.some((b) => b.active && b.arriving)) return;
        this.clock -= dt;
        if (this.clock <= 0) {
            if (bosses[owner].phase > 1) this.pending++;
            this.clock = BULLETHELL.escorts.reinforcement;
        }
        const cap = dual ? BULLETHELL.escorts.dual : BULLETHELL.escorts.single;
        while (this.pending > 0 && escorts < cap && this.deployed < BULLETHELL.escorts.total) {
            const e = enemies.find((e) => !e.active);
            if (!e) break;
            const boss = bosses[owner];
            let safe = false;
            for (let i = 0; i < 32; i++) {
                const angle = (i + this.deployed) * 2.39996,
                    r = 210 + i * 9;
                boss.rotation
                    .transformVector(this.point.set(Math.cos(angle) * r, 65 + Math.sin(angle) * 90, 110), this.point)
                    .add(boss.position);
                if (this.point.distance(ship.position) < 120) continue;
                if (
                    obstacles.some((r) => r.position.distance(this.point) < r.radius + 25) ||
                    extra.some((r) => r.position.distance(this.point) < r.radius + 25)
                )
                    continue;
                if (enemies.some((o) => o.active && o.position.distance(this.point) < 40)) continue;
                if (bosses.some((b) => b.active && b.hull.some((h) => h.position.distance(this.point) < h.radius + 30)))
                    continue;
                safe = true;
                break;
            }
            if (!safe) break;
            e.spawn(
                boss.patterns.profile === 'tesser' && this.deployed % 3 === 0 ? 'heavy' : 'interceptor',
                this.point,
                boss.rotation,
                boss.patterns.profile === 'phantom'
            );
            e.escortOwner = owner;
            e.arrival = 1;
            e.arrivalGoal.copy(this.point);
            e.cooldown = 2;
            this.deployed++;
            this.pending--;
            escorts++;
        }
    }
    coordinate(enemies: Enemy[], bosses: readonly EncounterBoss[]) {
        const major = bosses.some((b) => b.active && (b.arriving || b.patterns.state !== 'recover'));
        for (const e of enemies)
            if (e.active && e.escortOwner >= 0) {
                const b = bosses[e.escortOwner];
                if (!b?.active) {
                    e.active = false;
                    continue;
                }
                if (major) {
                    e.canFire = false;
                    e.patternState = 'idle';
                    e.warmup = 0;
                    e.attackCue = false;
                    e.cooldown = Math.max(0.6, e.cooldown);
                    e.order = 'regroup';
                    b.rotation
                        .transformVector(this.point.set((e.id % 2 ? 1 : -1) * 180, 80, 100 + e.id * 12), e.goal)
                        .add(b.position);
                }
            }
    }
}
