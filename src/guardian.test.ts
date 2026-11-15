import { Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Combat } from './combat';
import { Flight } from './flight';
import { Guardian } from './guardian';
import { bossForWave, GUARDIAN } from './guardian-config';
import { Projectiles } from './projectiles';
import { Records } from './records';

describe('Fortress Guardian', () => {
    it('gates perimeter, power and reactor damage and provides fresh phase telegraphs', () => {
        const g = new Guardian(),
            ship = new Flight(),
            shots = new Projectiles();
        g.spawn(ship, []);
        expect(g.parts.every((p) => !p.targetable)).toBe(true);
        expect(g.damage(g.parts[6], 9999)).toBe(false);
        g.step(4, ship, [], shots);
        expect(g.parts.filter((p) => p.targetable)).toHaveLength(4);
        for (const p of g.parts.slice(0, 4)) expect(g.damage(p, 9999)).toBe(true);
        expect(g.phase).toBe(2);
        expect(g.escortsPending).toBe(true);
        expect(g.charge).toBe(0);
        expect(g.grace).toBeGreaterThan(1);
        expect(g.damage(g.parts[4], 9999)).toBe(false);
        g.step(1.3, ship, [], shots);
        expect(g.parts.filter((p) => p.targetable)).toHaveLength(2);
        g.damage(g.parts[4], 9999);
        g.damage(g.parts[5], 9999);
        expect(g.phase).toBe(3);
        g.step(1.3, ship, [], shots);
        expect(g.parts.filter((p) => p.targetable)).toEqual([g.parts[6]]);
        expect(g.damage(g.parts[6], 9999)).toBe(true);
        expect(g.active).toBe(false);
        expect(g.dying).toBe(6.4);
        expect(g.damage(g.parts[6], 9999)).toBe(false);
        g.step(7, ship, [], shots);
        expect(g.dying).toBe(0);
    });
    it('locks attack aim, respects cover, limits projectiles and EMP cancels attacks', () => {
        const g = new Guardian(),
            ship = new Flight(),
            shots = new Projectiles();
        g.spawn(ship, []);
        g.step(4, ship, [], shots);
        g.cooldown = 0;
        g.step(0.01, ship, [], shots);
        expect(g.charge).toBeGreaterThan(1);
        const aim = g.aim.clone();
        ship.position.x += 100;
        g.step(0.2, ship, [], shots);
        expect(g.aim.equals(aim)).toBe(true);
        expect(shots.fired).toBe(0);
        g.disrupted = 1;
        g.step(0.01, ship, [], shots);
        expect(g.charge).toBe(0);
        for (let i = 0; i < 120 * 30; i++) g.step(1 / 120, ship, [], shots);
        expect(shots.fired).toBeGreaterThan(0);
        expect(shots.items.filter((p) => p.active).length).toBeLessThanOrEqual(GUARDIAN.projectileLimit);
        expect(g.parts.every((p) => p.position.distance(g.position) > GUARDIAN.hullRadius + p.radius)).toBe(true);
    });
    it('uses existing collision sweeps, one fatal reward, boss events and additive records', () => {
        const ship = new Flight(),
            events: string[] = [],
            c = new Combat(
                ship,
                [],
                () => undefined,
                (e) => events.push(e)
            );
        c.director.wave = 15;
        c.director.group = 1;
        c.countdown = 100;
        c.guardian.spawn(ship, []);
        const g = c.guardian;
        const phases = new Set<number>();
        for (let n = 0; n < 2000 && g.active; n++) {
            c.step(0.05, false);
            phases.add(g.phase);
            const p = g.parts.find((p) => p.targetable);
            if (!p) continue;
            const normal = p.position.clone().sub(g.position).normalize();
            ship.position.copy(p.position).add(normal.clone().mulScalar(25));
            ship.previous.copy(ship.position);
            c.projectiles.spawn(ship.position, normal.mulScalar(-1), Vec3.ZERO, 500, 100, 1, false);
            c.flow.shots++;
        }
        expect([...phases]).toEqual([1, 2]);
        expect(g.active).toBe(false);
        expect(c.guardianBosses).toBe(1);
        const score = c.score;
        for (let i = 0; i < 120; i++) c.step(0.05, false);
        expect(c.score).toBeGreaterThanOrEqual(score);
        expect(c.guardianBosses).toBe(1);
        expect(events.filter((e) => e === 'boss:defeated')).toHaveLength(1);
        expect(c.bestGuardianTime).toBeGreaterThan(0);
        const data = new Map<string, string>(),
            storage = {
                getItem: (k: string) => data.get(k) ?? null,
                setItem: (k: string, v: string) => data.set(k, v)
            };
        const r = new Records(storage);
        expect(r.save(c.summary('retired'))).toContain('guardian');
        expect(new Records(storage).data.bestGuardianTime).toBe(c.bestGuardianTime);
        c.reset();
        expect(g.active).toBe(false);
        expect(g.escortsPending).toBe(false);
        expect(c.guardianBosses).toBe(0);
    });
    it('rotates later bosses without changing the original boss milestones', () => {
        expect([5, 10, 15, 20, 25, 30].map(bossForWave)).toEqual([
            'dreadnought',
            'phantom',
            'guardian',
            'dreadnought',
            'phantom',
            'guardian'
        ]);
        expect(bossForWave(16)).toBe(null);
    });
});
