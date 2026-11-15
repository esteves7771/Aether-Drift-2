import { Quat, Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { field } from './collisions';
import { Combat } from './combat';
import { Cruise } from './cruise';
import { Enemy } from './enemy';
import { Flight, neutral } from './flight';
import { Frontier } from './frontier';
import { FRONTIER } from './frontier-config';
import { Projectiles } from './projectiles';

describe('Living frontier stage A', () => {
    it('selects two existing rocks, uses stable asteroid-local transforms, exposes hittable targets', () => {
        const rocks = field(),
            w = new Frontier(rocks);
        expect(w.bases).toHaveLength(4);
        expect(w.locations).toHaveLength(10);
        expect(w.targets.map((p) => p.id)).toEqual([16, 17, 18, 19, 20, 21, 30, 31, 32, 33, 34, 35]);
        for (const b of w.bases) {
            expect(rocks[b.rockIndex]).toBe(b.rock);
            for (const p of b.parts) {
                expect(new Vec3().sub2(p.position, b.rock.position).length()).toBeGreaterThan(b.rock.radius + p.radius);
                expect(
                    new Quat()
                        .copy(b.rotation)
                        .invert()
                        .transformVector(new Vec3().sub2(p.position, b.rock.position))
                        .distance(p.local)
                ).toBeLessThan(0.001);
            }
            b.rock.position.x += 10;
            b.sync();
            expect(b.parts[0].previous.equals(b.parts[0].position)).toBe(true);
        }
    });
    it('telegraphs and rotates before shooting, respects cover, EMP and power destruction', () => {
        const ship = new Flight(),
            w = new Frontier(field()),
            shots = new Projectiles(),
            b = w.bases[0],
            p = b.parts[1];
        b.rotation.transformVector(new Vec3(0, 180, 0), ship.position).add(b.rock.position);
        p.cooldown = 0;
        w.step(0.01, ship, shots, false);
        expect(p.charge).toBeGreaterThan(1);
        expect(shots.fired).toBe(0);
        for (let i = 0; i < 160; i++) w.step(0.01, ship, shots, false);
        expect(shots.fired).toBeGreaterThan(0);
        expect(p.facing.equals(Quat.IDENTITY)).toBe(false);
        p.cooldown = 0;
        p.disrupted = 2;
        const fired = shots.fired;
        w.step(0.1, ship, shots, false);
        expect(p.charge).toBe(0);
        expect(w.damage(b.parts[0], 1000)).toBe(FRONTIER.turret.baseScore);
        expect(w.damage(b.parts[0], 1000)).toBe(0);
        for (let i = 0; i < 100; i++) w.step(0.05, ship, shots, false);
        expect(shots.fired).toBe(fired);
        expect(b.parts.every((t) => !t.active)).toBe(true);
        w.reset();
        expect(b.powered).toBe(true);
        // Planet-side cover blocks warnings and shots.
        b.rotation.transformVector(new Vec3(0, -180, 0), ship.position).add(b.rock.position);
        for (let i = 0; i < 100; i++) w.step(0.05, ship, shots, false);
        expect(shots.fired).toBe(fired);
    });
    it('uses actual player projectile sweeps and sole score authority for installations', () => {
        const ship = new Flight(),
            combat = new Combat(ship, field(), () => undefined),
            p = combat.frontier.targets[0];
        const normal = p.base.rotation.transformVector(Vec3.UP);
        combat.countdown = 100;
        ship.position.copy(p.position).add(normal.clone().mulScalar(20));
        ship.previous.copy(ship.position);
        combat.projectiles.spawn(ship.position, normal.mulScalar(-1), Vec3.ZERO, 400, 150, 1, false);
        combat.step(0.05, false);
        expect(p.active).toBe(false);
        expect(combat.score).toBeGreaterThanOrEqual(350);
        const score = combat.score;
        combat.step(0.05, false);
        expect(combat.score).toBe(score);
    });
    it('rewards supplies once, preserves full caches, discovers once and resets between runs', () => {
        const w = new Frontier(field()),
            ship = new Flight(),
            shots = new Projectiles();
        w.selected = 2;
        ship.position.copy(w.locations[2].position);
        expect(w.interact(ship, 6)).toBe(6);
        expect(w.locations[2].used).toBe(false);
        ship.shield = 10;
        w.interact(ship, 6);
        expect(ship.shield).toBe(38);
        w.interact(ship, 6);
        expect(ship.shield).toBe(38);
        w.step(0.05, ship, shots, true);
        w.step(0.05, ship, shots, true);
        expect(w.discoveries).toBe(1);
        w.selected = 3;
        ship.position.copy(w.locations[3].position);
        expect(w.interact(ship, 11, 12)).toBe(12);
        w.reset();
        expect(w.supplies).toBe(0);
        expect(w.locations.every((l) => !l.used && !l.discovered)).toBe(true);
    });
    it('dispatches a finite safe ambush with existing slots and waits for clear space', () => {
        const w = new Frontier(field()),
            ship = new Flight(),
            enemies = Array.from({ length: 8 }, (_, i) => new Enemy(i));
        w.selected = 5;
        ship.position.copy(w.locations[5].position);
        w.interact(ship, 6);
        w.interact(ship, 6);
        w.dispatchAmbush(enemies, ship, true);
        expect(enemies.filter((e) => e.active)).toHaveLength(0);
        w.dispatchAmbush(enemies, ship, false);
        expect(enemies.filter((e) => e.active)).toHaveLength(2);
        w.dispatchAmbush(enemies, ship, false);
        expect(enemies.filter((e) => e.active)).toHaveLength(2);
        for (const e of enemies.filter((e) => e.active))
            expect(w.rocks.every((r) => e.position.distance(r.position) > r.radius + 20)).toBe(true);
    });
    it('leaves combat flight unchanged and bounds cruise acceleration, exit, obstacle and combat restrictions', () => {
        const a = new Flight(),
            b = new Flight(),
            c = new Cruise(),
            command = neutral();
        command.z = -1;
        for (let i = 0; i < 120; i++) {
            c.step(a, command, 1 / 120, true, false, false, []);
            b.step(command, 1 / 120, true);
        }
        expect(a.position.equals(b.position)).toBe(true);
        expect(a.velocity.equals(b.velocity)).toBe(true);
        c.toggle(a, true);
        expect(c.active).toBe(false);
        c.toggle(a, false);
        expect(c.active).toBe(true);
        let speed = a.velocity.length();
        for (let i = 0; i < 480; i++) {
            c.step(a, command, 1 / 120, true, false, false, []);
            expect(a.velocity.length() - speed).toBeLessThanOrEqual(90 / 120 + 0.001);
            speed = a.velocity.length();
        }
        expect(speed).toBeGreaterThan(300);
        expect(speed).toBeLessThanOrEqual(350);
        c.step(a, command, 1 / 120, true, true, false, []);
        expect(c.active).toBe(false);
        expect(c.settling).toBe(true);
        for (let i = 0; i < 360; i++) c.step(a, command, 1 / 120, true, false, false, []);
        expect(c.settling).toBe(false);
        expect(a.velocity.length()).toBeLessThan(100);
        c.reset();
        c.toggle(a, false);
        const rock = { position: a.position.clone().add(new Vec3(0, 0, -100)), radius: 20 };
        c.step(a, command, 1 / 120, true, false, false, [rock]);
        expect(c.active).toBe(false);
        c.reset();
        c.toggle(a, false);
        c.step(a, command, 1 / 120, true, false, true, []);
        expect(c.active).toBe(false);
    });
});
