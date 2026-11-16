import { Vec3 } from 'playcanvas';
import { describe, it, expect } from 'vitest';

import { Collisions } from './collisions';
import { Flight, neutral } from './flight';
describe('real lateral evasive roll', () => {
    for (const side of [-1, 1])
        it('moves and rolls on side ' + side + ' without changing forward aim', () => {
            const f = new Flight();
            expect(f.evasion.trigger(f, side)).toBe(true);
            expect(f.evasion.trigger(f, -side)).toBe(false);
            for (let i = 0; i < 100; i++) f.step(neutral(), 1 / 120, true);
            expect(f.position.x * side).toBeGreaterThan(15);
            expect(f.evasion.active).toBe(false);
            expect(f.evasion.cooldown).toBeGreaterThan(2);
            expect(f.rotation.transformVector(Vec3.FORWARD).distance(Vec3.FORWARD)).toBeLessThan(0.001);
            f.reset();
            expect(f.evasion.cooldown).toBe(0);
            expect(f.evasion.angle).toBe(0);
        });
    it('uses ordinary swept rock collision rather than teleporting through cover', () => {
        const f = new Flight(),
            c = new Collisions(),
            rock = { position: new Vec3(10, 0, 0), radius: 3 };
        f.evasion.trigger(f, 1);
        for (let i = 0; i < 120; i++) {
            f.step(neutral(), 1 / 120, true);
            c.solve(f, [rock]);
        }
        expect(f.position.x).toBeLessThan(10);
        expect(f.hull).toBeLessThan(100);
    });
});
