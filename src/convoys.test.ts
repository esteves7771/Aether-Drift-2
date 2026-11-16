import { Quat, Vec3 } from 'playcanvas';
import { describe, it, expect } from 'vitest';

import { Convoys } from './convoys';
describe('noncombat convoys', () => {
    it('builds all four formations, preserves relative separation and a fixed pool', () => {
        const c = new Convoys([], []),
            p = new Vec3(),
            q = new Quat();
        for (const kind of ['standard', 'heavy', 'station', 'fast'] as const) {
            c.reset(123);
            expect(c.begin(p, q, kind)).toBe(true);
            const g = c.groups[0];
            expect(c.safe(g, p)).toBe(true);
            for (let i = 0; i < 100; i++) c.step(0.1, p, q, true);
            if (kind === 'heavy') expect(g.members[0].distance(g.members[1])).toBeGreaterThan(300);
            expect(c.groups.length).toBe(2);
        }
    });
    it('delays unsafe routes and boss-time events, and freezes while paused', () => {
        const c = new Convoys([{ position: new Vec3(), radius: 100000 }], []),
            p = new Vec3(),
            q = new Quat();
        expect(c.begin(p, q)).toBe(false);
        c.countdown = 0;
        c.step(1, p, q, true);
        expect(c.events).toBe(0);
        const t = c.countdown;
        c.step(0, p, q, false);
        expect(c.countdown).toBe(t);
    });
});
