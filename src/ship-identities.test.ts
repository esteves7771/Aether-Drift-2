import { Mat4, Vec3 } from 'playcanvas';
import { describe, it, expect } from 'vitest';

import { Combat } from './combat';
import { Flight, neutral } from './flight';
import { SHIPS } from './ship-config';

describe('three ship identities', () => {
    it('keeps DPS in one shared band with meaningful defense and agility tradeoffs', () => {
        const dps = Object.values(SHIPS).map(
            (s) =>
                (2 * s.weapon.damage * s.weapon.burst) / ((s.weapon.burst - 1) * s.weapon.interval + s.weapon.recovery)
        );
        expect(Math.max(...dps) / Math.min(...dps)).toBeLessThan(1.1);
        expect(SHIPS.surveyor.shield).toBeGreaterThan(SHIPS.classic.shield);
        expect(SHIPS.ptah.shield).toBeLessThan(SHIPS.classic.shield);
        const speeds = [];
        for (const key of ['classic', 'surveyor', 'ptah'] as const) {
            const f = new Flight();
            f.setShip(key);
            const c = neutral();
            c.z = -1;
            for (let i = 0; i < 120; i++) f.step(c, 1 / 120, true);
            speeds.push(f.velocity.length());
            f.reset();
            expect(f.shield).toBe(f.shieldCapacity);
        }
        expect(speeds[2]).toBeGreaterThan(speeds[0]);
        expect(speeds[0]).toBeGreaterThan(speeds[1]);
    });
    it('commits a three-shot plasma burst, and clears it on reset', () => {
        const f = new Flight();
        f.setShip('ptah');
        const c = new Combat(f, [], () => undefined);
        c.countdown = 1000;
        c.step(0.01, true);
        for (let i = 0; i < 25; i++) c.step(0.01, false);
        expect(c.projectiles.fired).toBe(6);
        expect(c.projectiles.items.filter((p) => p.active).every((p) => p.pattern === 7)).toBe(true);
        c.reset();
        expect(c.burstRemaining).toBe(0);
    });
});

it('all three primaries damage each existing boss through normal projectile sweeps', () => {
    for (const key of ['classic', 'surveyor', 'ptah'] as const)
        for (const wave of [5, 10, 15]) {
            const f = new Flight();
            f.setShip(key);
            const c = new Combat(f, [], () => undefined);
            c.director.wave = wave;
            c.countdown = 1000;
            const b = c.boss;
            b.spawn(f, []);
            b.arrival.stage = 'combat';
            b.position.set(0, 0, -350);
            b.previous.copy(b.position);
            b.rotation.set(0, 0, 0, 1);
            b.patterns.interrupt();
            b.disrupted = 3;
            b.step(0.01, f, [], c.projectiles);
            const p = b.parts.find((p) => p.targetable)!;
            const before = b.health,
                m = new Mat4();
            for (let i = 0; i < 240; i++) {
                m.setLookAt(f.position, p.position, Vec3.UP);
                f.rotation.setFromMat4(m);
                c.selected = p.id;
                c.step(1 / 120, true);
            }
            expect(b.health, key + ' Wave ' + wave).toBeLessThan(before);
        }
});
