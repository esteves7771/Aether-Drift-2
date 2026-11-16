import { expect, it } from 'vitest';

import { dualWave } from './boss-encounter';
import { Combat } from './combat';
import { Flight } from './flight';
it('retains single milestones and schedules rare coordinated pairs', () => {
    expect([5, 10, 15, 25, 30].some(dualWave)).toBe(false);
    expect([20, 40, 60].every(dualWave)).toBe(true);
    const c = new Combat(new Flight(), [], () => undefined);
    c.director.wave = 20;
    c.dreadnought.spawn(c.ship, []);
    c.encounter.begin(20, c.allBosses, c.dreadnought);
    c.encounter.step(4.1, c.allBosses, c.ship, []);
    expect(c.phantom.active).toBe(true);
    expect(c.dreadnought.arrival.anchor.distance(c.phantom.arrival.anchor)).toBeGreaterThan(200);
    expect(c.targets.length).toBe(new Set(c.targets.map((t) => t.id)).size);
    c.dreadnought.arrival.stage = c.phantom.arrival.stage = 'combat';
    let first = false,
        second = false;
    for (let i = 0; i < 4000; i++) {
        c.encounter.step(1 / 120, c.allBosses, c.ship, []);
        c.dreadnought.patterns.step(
            1 / 120,
            1,
            c.ship,
            { muzzle: c.dreadnought.position, banks: [] },
            c.projectiles,
            []
        );
        c.phantom.patterns.step(1 / 120, 1, c.ship, { muzzle: c.phantom.position, banks: [] }, c.projectiles, []);
        first ||= c.dreadnought.patterns.state === 'fire';
        second ||= c.phantom.patterns.state === 'fire';
        expect(Number(c.dreadnought.patterns.permitted) + Number(c.phantom.patterns.permitted)).toBe(1);
        for (const p of c.projectiles.items) p.active = false;
    }
    expect(first && second).toBe(true);
    c.reset();
    expect(c.encounter.pending).toBe(-1);
    expect(c.remaining).toBe(0);
});
it('boss target generations change on reuse', () => {
    const c = new Combat(new Flight(), [], () => undefined),
        p = c.phantom.parts[0],
        before = p.generation;
    c.phantom.spawn(c.ship, []);
    expect(p.generation).toBeGreaterThan(before);
});
it('later pairings preserve separate IDs, rift footprints and a two-beam ceiling', () => {
    for (const wave of [40, 60]) {
        const c = new Combat(new Flight(), [], () => undefined);
        c.director.wave = wave;
        const first = c.boss;
        first.spawn(c.ship, []);
        c.encounter.begin(wave, c.allBosses, first);
        c.encounter.step(4.1, c.allBosses, c.ship, []);
        const active = c.allBosses.filter((b) => b.active);
        expect(active.length).toBe(2);
        expect(new Set(active.flatMap((b) => b.parts.map((p) => p.id))).size).toBe(
            active.reduce((n, b) => n + b.parts.length, 0)
        );
        expect(active[0].arrival.anchor.distance(active[1].arrival.anchor)).toBeGreaterThan(200);
        for (const b of active) {
            b.arrival.stage = 'combat';
            b.phase = 3;
            b.patterns.reset(3);
        }
        for (let i = 0; i < 9000; i++) {
            c.encounter.step(1 / 120, c.allBosses, c.ship, []);
            for (const b of active)
                b.patterns.step(1 / 120, 3, c.ship, { muzzle: b.position, banks: [] }, c.projectiles, []);
            expect(
                active.reduce(
                    (n, b) =>
                        n +
                        (b.patterns.beamActive
                            ? b.patterns.profile === 'tesser' && b.patterns.kind === 'cross'
                                ? 2
                                : 1
                            : 0),
                    0
                )
            ).toBeLessThanOrEqual(2);
            for (const p of c.projectiles.items) p.active = false;
        }
    }
});
it('all bosses return toward their engagement sector rather than pursuing forever', () => {
    const c = new Combat(new Flight(), [], () => undefined);
    for (const b of c.allBosses) {
        c.ship.reset();
        b.spawn(c.ship, []);
        b.arrival.stage = 'combat';
        b.position.set(0, 0, -3500);
        b.previous.copy(b.position);
        c.ship.position.set(0, 0, -10000);
        c.ship.previous.copy(c.ship.position);
        const before = b.position.distance(b.arrival.anchor);
        b.step(1 / 120, c.ship, [], c.projectiles);
        expect(b.position.distance(b.arrival.anchor)).toBeLessThan(before);
        b.reset();
    }
});
