import { describe, it, expect } from 'vitest';

import { InspectionState } from './ship-inspection';
describe('isolated inspection state', () => {
    it('permits full yaw, clamps pitch/zoom and damps reset', () => {
        const s = new InspectionState();
        s.drag(1400, 900);
        s.wheel(-100000);
        for (let i = 0; i < 120; i++) s.step(1 / 120);
        expect(s.yaw).toBeGreaterThan(360);
        expect(s.pitch).toBeLessThanOrEqual(65);
        expect(s.zoom).toBeLessThanOrEqual(1.3);
        s.reset();
        for (let i = 0; i < 180; i++) s.step(1 / 120);
        expect(Math.abs(s.yaw - Math.round(s.yaw / 360) * 360)).toBeLessThan(0.01);
        expect(s.zoom).toBeCloseTo(1);
    });
});
