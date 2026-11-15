import { Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { field } from './collisions';
import { Frontier } from './frontier';
import { Universe, AmbientTraffic } from './universe';
const setup = () => {
    const rocks = field(),
        frontier = new Frontier(rocks),
        world = new Universe(frontier, rocks);
    return { rocks, frontier, world };
};
describe('persistent noncombat universe', () => {
    it('places exactly 50 safe deterministic satellites without altering ten locations', () => {
        const a = setup(),
            b = setup();
        expect(a.frontier.locations).toHaveLength(10);
        expect(a.world.satellites).toHaveLength(50);
        for (const [kind, count] of [
            ['orbit', 18],
            ['drift', 14],
            ['static', 12],
            ['abandoned', 6]
        ] as const)
            expect(a.world.satellites.filter((s) => s.kind === kind)).toHaveLength(count);
        expect(a.world.satellites.map((s) => s.position.toString())).toEqual(
            b.world.satellites.map((s) => s.position.toString())
        );
        for (const s of a.world.satellites) {
            expect('targetable' in s).toBe(false);
            for (let t = 0; t < 1600; t += 7) {
                s.sample(t, new Vec3());
                expect(a.world.safe(s.sample(t, new Vec3()))).toBe(true);
            }
        }
    });
    it('uses smooth bounded paths and reset preserves placements', () => {
        const { world } = setup(),
            initial = world.satellites.map((s) => s.position.clone());
        world.step(10);
        expect(world.satellites[0].position.distance(initial[0])).toBeGreaterThan(1);
        for (const s of world.satellites) {
            const a = s.sample(12, new Vec3()),
                b = s.sample(12.01, new Vec3());
            expect(a.distance(b)).toBeLessThan(0.1);
        }
        for (const s of world.satellites.filter((s) => s.kind === 'static'))
            expect(s.position.equals(initial[s.id])).toBe(true);
        world.step(0);
        const time = world.time;
        world.step(0);
        expect(world.time).toBe(time);
        world.reset();
        world.satellites.forEach((s, i) => expect(s.position.equals(initial[i])).toBe(true));
    });
    it('pools at most three ambient ships, waits through bosses, and leaves quiet intervals', () => {
        const { world, frontier } = setup(),
            traffic = new AmbientTraffic(world, frontier),
            player = new Vec3(0, 1200, 0);
        traffic.step(31, player, true);
        expect(traffic.active).toBe(false);
        traffic.step(0.1, player, false);
        expect(traffic.active).toBe(true);
        expect(traffic.safePath(traffic.start, traffic.end, player)).toBe(true);
        expect(traffic.count).toBeLessThanOrEqual(3);
        const p = traffic.positions[0].clone();
        traffic.step(0, player, false);
        expect(traffic.positions[0].equals(p)).toBe(true);
        traffic.step(traffic.duration + 1, player, false);
        expect(traffic.active).toBe(false);
        expect(traffic.countdown).toBeGreaterThanOrEqual(8);
        expect(traffic.countdown + traffic.duration).toBeGreaterThanOrEqual(30);
        expect(traffic.countdown + traffic.duration).toBeLessThanOrEqual(60);
        for (let i = 0; i < 2000; i++) {
            traffic.step(1, player, false);
            expect(traffic.count).toBeLessThanOrEqual(3);
            if (traffic.active) expect(traffic.safePath(traffic.start, traffic.end, player)).toBe(true);
        }
        expect(traffic.events).toBeGreaterThan(10);
        traffic.reset();
        expect(traffic.events).toBe(0);
        expect(traffic.count).toBe(0);
    });
});
