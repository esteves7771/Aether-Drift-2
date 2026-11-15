import { Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Boss } from './boss';
import { Combat } from './combat';
import { EVOLUTION } from './evolution-config';
import { Flight } from './flight';
import { FlightFeel } from './flight-feel';
import { Projectiles, sweptHit } from './projectiles';
import { SPECTACLE } from './spectacle-config';
describe('spectacle and fair capital tactics', () => {
    it('bounds and smooths optional speed cues without changing flight state', () => {
        const a = new FlightFeel(),
            b = new FlightFeel();
        for (let i = 0; i < 360; i++) a.update(190, true, true, true, 'medium', 1 / 120);
        for (let i = 0; i < 90; i++) b.update(190, true, true, true, 'medium', 1 / 30);
        expect(a.fov).toBeLessThanOrEqual(72);
        expect(a.fov).toBeCloseTo(b.fov, 5);
        expect(a.pullback).toBeLessThan(3.4);
        const paused = a.fov;
        a.update(0, false, false, true, 'medium', 20);
        expect(a.fov).toBe(paused);
        for (let i = 0; i < 360; i++) a.update(190, true, true, false, 'medium', 1 / 120);
        expect(a.fov).toBeCloseTo(65, 3);
        expect(a.pullback).toBeCloseTo(0, 3);
        expect([...a.engineColor].every(Number.isFinite)).toBe(true);
    });
    it('keeps every weak point in front of its hull proxy along a forward attack ray', () => {
        const ship = new Flight(),
            b = new Boss();
        b.spawn(ship, []);
        const shots = new Projectiles();
        for (let i = 0; i < 400; i++) b.step(1 / 120, ship, [], shots);
        for (const p of b.parts) {
            const component = sweptHit(ship.position, p.position, p.position, p.position, p.radius);
            let body = Infinity;
            for (const h of b.hull)
                body = Math.min(body, sweptHit(ship.position, p.position, h.position, h.position, h.radius));
            expect(component, p.label).toBeLessThan(body);
        }
        expect(b.maxHealth).toBe(1960);
        expect(EVOLUTION.boss.damage).toEqual([12, 14, 12]);
    });
    it('locks aim during each windup and allows a strafing player to evade a whole volley', () => {
        for (const phase of [1, 2, 3]) {
            const ship = new Flight(),
                b = new Boss(),
                pool = new Projectiles(),
                delta = new Vec3();
            b.spawn(ship, []);
            b.age = 4;
            b.phase = phase;
            b.cooldown = 0;
            b.step(1 / 120, ship, [], pool);
            const aim = b.aim.clone();
            for (let i = 0; i < Math.ceil(SPECTACLE.boss.windup[phase - 1] * 120) + 2; i++) {
                ship.previous.copy(ship.position);
                ship.position.x += 30 / 120;
                b.step(1 / 120, ship, [], pool);
                if (b.charge > 0) expect(b.aim.equals(aim)).toBe(true);
            }
            expect(pool.fired).toBeGreaterThan(0);
            let hits = 0;
            for (let i = 0; i < 720; i++) {
                ship.previous.copy(ship.position);
                ship.position.x += 30 / 120;
                for (const p of pool.items)
                    if (p.active) {
                        p.previous.copy(p.position);
                        p.position.add(delta.copy(p.velocity).mulScalar(1 / 120));
                        if (sweptHit(p.previous, p.position, ship.previous, ship.position, 4) !== Infinity) {
                            hits++;
                            p.active = false;
                        }
                    }
            }
            expect(hits, 'phase ' + phase + ' has a reasonable strafe escape').toBe(0);
        }
    });
    it('cycles cooling exposure while always leaving a live node attackable', () => {
        const b = new Boss(),
            ship = new Flight(),
            pool = new Projectiles();
        b.spawn(ship, []);
        b.age = 4;
        b.phase = 2;
        const exposed = new Set<number>();
        for (let i = 0; i < 120 * 9; i++) {
            b.step(1 / 120, ship, [], pool);
            expect(b.parts.slice(4, 6).some((p) => p.targetable)).toBe(true);
            for (const p of b.parts.slice(4, 6)) if (p.targetable) exposed.add(p.id);
        }
        expect([...exposed].sort()).toEqual([12, 13]);
    });
    it('emits a bounded ordered destruction sequence and one victory event, with no repeated score', () => {
        const events: string[] = [],
            fx: string[] = [],
            ship = new Flight(),
            c = new Combat(
                ship,
                [],
                (e) => fx.push(e),
                (e) => events.push(e)
            );
        c.director.wave = 5;
        c.director.group = 1;
        c.boss.spawn(ship, []);
        c.boss.active = false;
        c.boss.dying = SPECTACLE.boss.destruction;
        c.flow.kill(100, false, 'TEST CHAIN');
        const score = c.score;
        for (let i = 0; i < 120 * 6.5; i++) c.step(1 / 120, false);
        expect(fx.filter((e) => e === 'capital-burst')).toHaveLength(6);
        expect(fx.filter((e) => e === 'capital-final')).toHaveLength(1);
        expect(events).toEqual(['boss:defeated']);
        expect(c.score).toBe(score);
        expect(c.flow.activity).toBe(8);
        expect(c.boss.dying).toBe(0);
        expect(c.projectiles.items).toHaveLength(240);
    });
});
