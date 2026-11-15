import { Quat, Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Artillery } from './artillery';
import { ARTILLERY } from './artillery-config';
import { field } from './collisions';
import { Flight } from './flight';
import { Frontier } from './frontier';
import { Projectiles, sweptHit } from './projectiles';
import { RiftArrival } from './rift-arrival';
import { Universe } from './universe';
describe('artillery model / combat foundation', () => {
    it('keeps seven existing IDs, calibrated proxies and deliberately greater durability', () => {
        const b = new Artillery(),
            ship = new Flight();
        b.spawn(ship, []);
        expect(b.parts.map((p) => p.id)).toEqual([8, 9, 10, 11, 12, 13, 14]);
        expect(b.maxHealth).toBe(4400);
        expect(b.health).toBe(b.maxHealth);
        expect(b.hull.length).toBe(7);
        for (let i = 0; i < 7; i++) expect(b.parts[i].local.equals(new Vec3(...ARTILLERY.parts[i]))).toBe(true);
    });
    it('keeps exposed surfaces outside their nearby armor proxies', () => {
        const b = new Artillery();
        b.position.set(0, 0, 0);
        b.rotation.copy(Quat.IDENTITY);
        for (const p of b.parts) {
            const origin = p.local
                    .clone()
                    .add(p.id === 12 ? new Vec3(-180, 0, 0) : p.id === 13 ? new Vec3(180, 0, 0) : new Vec3(0, 0, -220)),
                end = p.local.clone();
            const hit = sweptHit(origin, end, p.local, p.local, p.radius);
            for (const h of b.hull) expect(sweptHit(origin, end, h.local, h.local, h.radius)).toBeGreaterThan(hit);
        }
    });
    it('retains damage gates, phases and final lifecycle', () => {
        const b = new Artillery(),
            ship = new Flight(),
            shots = new Projectiles();
        b.spawn(ship, []);
        expect(b.damage(b.parts[0], 9999)).toBe(false);
        b.step(14, ship, [], shots);
        for (const p of b.parts.slice(0, 4)) {
            p.exposed = true;
            expect(b.damage(p, 10000)).toBe(true);
        }
        expect(b.phase).toBe(2);
        b.step(2, ship, [], shots);
        for (const p of b.parts.slice(4, 6)) {
            p.exposed = true;
            b.damage(p, 10000);
        }
        expect(b.phase).toBe(3);
        b.step(2, ship, [], shots);
        b.parts[6].exposed = true;
        b.damage(b.parts[6], 10000);
        expect(b.active).toBe(false);
        expect(b.dying).toBeGreaterThan(0);
    });
});
describe('space-aware reusable arrival', () => {
    it('reserves the full emergence corridor around the actual populated world', () => {
        const rocks = field(),
            frontier = new Frontier(rocks),
            world = new Universe(frontier, rocks),
            a = new RiftArrival(),
            ship = new Flight();
        a.obstacles = [
            ...world.obstacles.slice(rocks.length).map((r) => ({ position: r.position, radius: r.radius + 35 })),
            ...world.satellites.map((s) => ({ position: s.position, radius: 70 }))
        ];
        expect(a.begin(ship, rocks)).toBe(true);
        expect(a.corridorClear(a.anchor, a.normal, rocks, ship.position)).toBe(true);
        expect(a.anchor.distance(ship.position)).toBeGreaterThan(600);
        expect(a.anchor.distance(ship.position)).toBeLessThan(1500);
    });
    it('avoids both station footprints and an active traffic corridor', () => {
        const rocks = field(),
            frontier = new Frontier(rocks),
            world = new Universe(frontier, rocks),
            ship = new Flight(),
            a = new RiftArrival();
        a.obstacles = [
            ...world.obstacles.slice(rocks.length).map((r) => ({ position: r.position, radius: r.radius + 35 })),
            ...world.satellites.map((s) => ({ position: s.position, radius: 70 }))
        ];
        for (const location of frontier.locations.filter((l) => l.model)) {
            ship.position.copy(location.position);
            ship.position.z += 200;
            expect(a.begin(ship, rocks)).toBe(true);
            expect(a.corridorClear(a.anchor, a.normal, rocks, ship.position)).toBe(true);
        }
        const portal = a.anchor.clone();
        a.transit = {
            start: portal.clone().add(new Vec3(-1000, 0, 0)),
            end: portal.clone().add(new Vec3(1000, 0, 0)),
            active: true
        };
        expect(a.corridorClear(portal, a.normal, rocks, ship.position)).toBe(false);
        expect(a.begin(ship, rocks)).toBe(true);
    });
    it('gathers small, forms, emerges continuously, collapses, then permits combat', () => {
        const a = new RiftArrival(),
            ship = new Flight(),
            seen = new Set<string>();
        expect(a.begin(ship, [])).toBe(true);
        const p = new Vec3(),
            last = a.sample(new Vec3()).clone();
        let largest = 0;
        for (let i = 0; i < 1600; i++) {
            a.step(0.01, ship, []);
            seen.add(a.stage);
            a.sample(p);
            expect(p.distance(last)).toBeLessThan(1);
            last.copy(p);
            largest = Math.max(largest, a.radius);
        }
        expect([...seen]).toEqual(['gather', 'form', 'emerge', 'collapse', 'settle', 'combat']);
        expect(largest).toBe(110);
        expect(a.radius).toBe(0);
        expect(a.sample(p).equals(a.end)).toBe(true);
    });
    it('waits instead of forcing an unsafe spawn, freezes on pause and clears on reset', () => {
        const a = new RiftArrival(),
            ship = new Flight(),
            blocked = [{ position: new Vec3(), radius: 10000 }];
        expect(a.begin(ship, blocked)).toBe(false);
        expect(a.stage).toBe('seeking');
        a.step(0, ship, []);
        expect(a.stage).toBe('seeking');
        a.step(1.1, ship, []);
        expect(a.stage).toBe('gather');
        const age = a.age;
        a.step(0, ship, []);
        expect(a.age).toBe(age);
        a.reset();
        expect(a.complete).toBe(true);
        expect(a.radius).toBe(0);
    });
    it('keeps all banks invulnerable and suppresses shots throughout emergence', () => {
        const b = new Artillery(),
            ship = new Flight(),
            shots = new Projectiles();
        b.spawn(ship, []);
        for (let i = 0; i < 120; i++) {
            b.step(0.1, ship, [], shots);
            expect(b.parts.some((p) => p.targetable)).toBe(false);
            expect(b.damage(b.parts[0], 100)).toBe(false);
        }
        expect(shots.fired).toBe(0);
        for (let i = 0; i < 6; i++) b.step(0.1, ship, [], shots);
        expect(b.arriving).toBe(false);
        for (let i = 0; i < 90 && b.patterns.state !== 'recover'; i++) b.step(0.1, ship, [], shots);
        expect(b.parts[0].targetable).toBe(true);
    });
});
