import { Quat, Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { asteroidGeometry } from './asteroid-art';
import { Barrels } from './barrels';
import { field } from './collisions';
import { Combat } from './combat';
import { Enemy } from './enemy';
import { EnemyAI } from './enemy-ai';
import { Flight } from './flight';
import { Frontier } from './frontier';
import { LIVING } from './living-config';
import { Projectiles } from './projectiles';
import { Tesser } from './tesser';

describe('Living space and cinematic combat', () => {
    it('allocates unique bounded target IDs, with no EVA combat entries', () => {
        const c = new Combat(new Flight(), field(), () => undefined);
        const ids = c.targets.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(c.frontier.locations).toHaveLength(10);
        expect(c.targets.some((t) => t.label.includes('EVA'))).toBe(false);
    });
    it('bounds a chain to unique run-persistent detonations, then resets', () => {
        const barrels = new Barrels(new Frontier([])),
            seen = new Set<number>();
        for (const b of barrels.items) b.position.set(0, 0, 0);
        barrels.damage(barrels.items[0], 999, (b) => {
            expect(seen.has(b.id)).toBe(false);
            seen.add(b.id);
        });
        expect(seen.size).toBe(LIVING.barrels);
        barrels.damage(barrels.items[0], 999, () => {
            throw Error('Repeated detonation');
        });
        barrels.reset();
        expect(barrels.items.every((b) => b.active && b.health === LIVING.barrelHealth)).toBe(true);
    });
    it('scores confirmed environmental kills once, hostile hazards give no player credit', () => {
        for (const hostile of [false, true]) {
            const ship = new Flight(),
                c = new Combat(ship, [], () => undefined);
            c.countdown = 100;
            const b = c.barrels.items[0];
            b.position.set(0, 0, -100);
            b.previous.copy(b.position);
            b.origin.copy(b.position);
            for (const other of c.barrels.items.slice(1)) {
                other.position.set(9999, 0, 0);
                other.origin.copy(other.position);
                other.previous.copy(other.position);
            }
            const e = c.enemies[0];
            e.spawn('interceptor', new Vec3(8, 0, -100), new Quat());
            e.health = 1;
            e.disrupted = 10;
            c.projectiles.spawn(new Vec3(0, 0, -90), new Vec3(0, 0, -1), Vec3.ZERO, 500, 30, 1, hostile);
            for (let i = 0; i < 10; i++) c.step(1 / 120, false);
            expect(b.active).toBe(false);
            expect(e.active).toBe(false);
            expect(c.kills).toBe(hostile ? 0 : 1);
            const score = c.score;
            for (let i = 0; i < 10; i++) c.step(1 / 120, false);
            expect(c.score).toBe(score);
        }
    });
    it('keeps arriving ships present, physical and unable to attack before the first five seconds', () => {
        const ship = new Flight(),
            c = new Combat(ship, field(), () => undefined);
        for (let i = 0; i < 239; i++) c.step(1 / 120, false);
        expect(c.remaining).toBe(0);
        for (let i = 0; i < 14; i++) c.step(1 / 120, false);
        expect(c.remaining).toBe(2);
        const start = c.enemies[0].position.clone();
        for (let i = 0; i < 330; i++) c.step(1 / 120, false);
        expect(c.enemies[0].position.distance(start)).toBeGreaterThan(200);
        expect(c.enemies.filter((e) => e.active).every((e) => !e.targetable && !e.canFire)).toBe(true);
        expect(c.projectiles.fired).toBe(0);
        for (let i = 0; i < 80; i++) c.step(1 / 120, false);
        expect(c.enemies.some((e) => e.targetable)).toBe(true);
        c.reset();
        expect(c.remaining).toBe(0);
        expect(c.director.countdown).toBe(2);
    });
    it('arrival movement avoids a nearby asteroid and freezes when not stepped', () => {
        const e = new Enemy(0),
            ship = new Flight(),
            ai = new EnemyAI();
        e.spawn('interceptor', new Vec3(0, 0, -500), new Quat());
        e.arrival = 3;
        e.arrivalGoal.set(0, 0, -220);
        const rocks = [{ position: new Vec3(0, 0, -430), radius: 25 }];
        for (let i = 0; i < 300; i++) ai.step(e, ship, [e], rocks, 1 / 120);
        expect(e.position.distance(rocks[0].position)).toBeGreaterThan(25 + e.radius);
        const timer = e.arrival;
        expect(e.arrival).toBe(timer);
    });
    it('Tesser physically arrives, locks warnings, moves and exposes exactly two phases', () => {
        const t = new Tesser(),
            ship = new Flight(),
            shots = new Projectiles();
        t.spawn(ship, []);
        const initial = t.position.clone();
        expect(t.parts.some((p) => p.targetable)).toBe(false);
        for (let i = 0; i < 120 * 7; i++) t.step(1 / 120, ship, [], shots);
        expect(t.position.distance(initial)).toBeGreaterThan(400);
        expect(t.charge).toBeGreaterThan(0);
        const aim = t.aim.clone();
        ship.position.x += 100;
        t.step(0.1, ship, [], shots);
        expect(t.aim.equals(aim)).toBe(true);
        for (let i = 0; i < 4; i++) t.damage(t.parts[i], 250);
        t.damage(t.parts[6], 250);
        expect(t.phase).toBe(2);
        for (let i = 0; i < 150; i++) t.step(1 / 120, ship, [], shots);
        expect(t.parts[4].targetable).toBe(true);
        for (const p of t.parts) if (p.targetable) t.damage(p, 10000);
        expect(t.active).toBe(false);
        expect(t.dying).toBe(6.4);
        expect(t.health).toBe(0);
    });
    it('Tesser bounds hostile volleys and EMP cancels a charge', () => {
        const t = new Tesser(),
            ship = new Flight(),
            shots = new Projectiles();
        t.spawn(ship, []);
        for (let i = 0; i < 120 * 80; i++) t.step(1 / 120, ship, [], shots);
        expect(shots.items.filter((p) => p.active && p.hostile).length).toBeLessThanOrEqual(
            LIVING.tesser.projectileLimit
        );
        t.charge = 1;
        t.disrupted = 1;
        t.step(0.1, ship, [], shots);
        expect(t.charge).toBe(0);
    });
    it('shares deterministic cratered geometry with complete attributes and conservative extents', () => {
        for (let v = 0; v < 6; v++) {
            const g = asteroidGeometry(v, true),
                again = asteroidGeometry(v, true),
                coarse = asteroidGeometry(v, false);
            expect(g.positions).toEqual(again.positions);
            expect(g.indices.length).toBeGreaterThan(coarse.indices.length);
            expect(g.normals.length).toBe(g.positions.length);
            expect(g.uvs.length / 2).toBe(g.positions.length / 3);
            for (let i = 0; i < g.positions.length; i += 3)
                expect(Math.hypot(g.positions[i], g.positions[i + 1], g.positions[i + 2])).toBeLessThanOrEqual(1.001);
        }
    });
});
