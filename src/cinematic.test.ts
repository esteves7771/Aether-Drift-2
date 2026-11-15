import { describe, expect, it } from 'vitest';

import { Combat } from './combat';
import { BLASTS } from './explosion-config';
import { blastVertexWGSL, blastFragmentWGSL } from './explosion-shader';
import { Flight } from './flight';
import { SPECTACLE } from './spectacle-config';

describe('cinematic presentation contracts', () => {
    it('preserves each boss destruction clock, one victory and distinct visual metadata', () => {
        for (const [wave, style] of [
            [5, 'dreadnought'],
            [10, 'phantom'],
            [15, 'tesser']
        ] as const) {
            const events: string[] = [],
                fx: { event: string; style?: string }[] = [],
                ship = new Flight();
            const c = new Combat(
                ship,
                [],
                (event, _position, _size, style) => fx.push({ event, style }),
                (event) => events.push(event)
            );
            c.director.wave = wave;
            c.director.group = 1;
            c.boss.spawn(ship, []);
            c.boss.active = false;
            c.boss.dying = SPECTACLE.boss.destruction;
            const score = c.score;
            for (let i = 0; i < 120 * 6.5; i++) c.step(1 / 120, false);
            expect(fx.filter((e) => e.event === 'capital-final')).toEqual([{ event: 'capital-final', style }]);
            expect(
                fx.filter((e) => ['capital-burst', 'elite-explosion'].includes(e.event)).every((e) => e.style === style)
            ).toBe(true);
            expect(events.filter((e) => e === 'boss:defeated')).toHaveLength(1);
            expect(c.score).toBe(score);
            expect(c.boss.dying).toBe(0);
        }
    });
    it('bounds all quality budgets, including no dependency on bloom', () => {
        expect(BLASTS.capacity).toBeLessThanOrEqual(12);
        for (const q of Object.values(BLASTS.quality)) {
            expect(q[0]).toBeLessThanOrEqual(8);
            expect(q[1]).toBeLessThanOrEqual(48);
            expect(q[2]).toBeLessThanOrEqual(12);
        }
        expect(BLASTS.quality.low[1]).toBeLessThan(BLASTS.quality.high[1]);
        expect(BLASTS.presets.tesser.duration).toBeGreaterThan(BLASTS.presets.phantom.duration);
    });
    it('keeps shared native WGSL declarations byte-identical for Engine deduplication', () => {
        for (const name of ['uBlast', 'uBudget', 'uStyle']) {
            const regex = new RegExp('uniform ' + name + ':[^;]+;');
            expect(blastVertexWGSL.match(regex)?.[0]).toBe(blastFragmentWGSL.match(regex)?.[0]);
        }
    });
});
