import { describe, it, expect } from 'vitest';

import { Combat } from './combat';
import { Flight } from './flight';
import { Phantom } from './phantom';
import { Projectiles } from './projectiles';
describe('Phantom evolution', () => {
    it('safe physical intro, three phases and bounded patterns', () => {
        const b = new Phantom(),
            f = new Flight(),
            s = new Projectiles();
        b.spawn(f, []);
        expect(b.arriving).toBe(true);
        expect(b.parts[0].targetable).toBe(false);
        for (let i = 0; i < 1000; i++) b.step(0.01, f, [], s);
        expect(b.arriving).toBe(false);
        const kinds = new Set<string>();
        for (let phase = 1; phase <= 3; phase++) {
            b.phase = phase;
            b.patterns.reset(phase);
            b.grace = 0;
            for (let i = 0; i < 6000; i++) {
                b.step(0.01, f, [], s);
                kinds.add(b.patterns.kind);
                for (const p of s.items) p.active = false;
            }
        }
        expect(kinds).toEqual(new Set(['banks', 'seekers', 'fan', 'cross', 'helix', 'finale']));
        b.disrupted = 1;
        b.step(0.01, f, [], s);
        expect(b.patterns.state).toBe('recover');
        b.parts[0].exposed = true;
        b.damage(b.parts[0], 99999);
        expect(b.active).toBe(false);
        expect(b.dying).toBeGreaterThan(0);
        b.reset();
        expect(b.arrival.complete).toBe(true);
    });
});
import { Tesser } from './tesser';
it('Tesser gates three component phases and all spatial families', () => {
    const b = new Tesser(),
        f = new Flight(),
        s = new Projectiles();
    b.spawn(f, []);
    for (let i = 0; i < 1500; i++) b.step(0.01, f, [], s);
    expect(b.arriving).toBe(false);
    const kinds = new Set<string>();
    for (let phase = 1; phase <= 3; phase++) {
        expect(b.phase).toBe(phase);
        b.grace = 0;
        for (let i = 0; i < 6000; i++) {
            b.step(0.01, f, [], s);
            kinds.add(b.patterns.kind);
            for (const p of s.items) p.active = false;
        }
        for (const p of b.parts.filter(
            (p) => p.active && (phase === 1 ? p.id < 26 : phase === 2 ? p.id < 28 : p.id === 28)
        )) {
            p.exposed = true;
            b.damage(p, 99999);
        }
    }
    expect(kinds).toEqual(new Set(['sphere', 'helix', 'fan', 'cross', 'finale']));
    expect(b.active).toBe(false);
    expect(b.dying).toBeGreaterThan(0);
});
it('crossing beam second segment damages once through the shared combat authority', () => {
    const ship = new Flight(),
        c = new Combat(ship, [], () => undefined);
    c.director.wave = 15;
    c.countdown = 1000;
    const b = c.guardian;
    b.spawn(ship, []);
    b.arrival.stage = 'combat';
    b.position.set(0, 0, -400);
    b.previous.copy(b.position);
    const p = b.patterns;
    p.phase = 2;
    p.index = 0;
    p.state = 'fire';
    p.beamActive = true;
    p.beamOrigin.set(200, 0, -100);
    p.beamEnd.set(200, 0, 100);
    p.secondOrigin.set(0, 0, -100);
    p.secondEnd.set(0, 0, 100);
    const shield = ship.shield;
    c.step(0, false);
    expect(ship.shield).toBeLessThan(shield);
    const once = ship.shield;
    c.step(0, false);
    expect(ship.shield).toBe(once);
});
