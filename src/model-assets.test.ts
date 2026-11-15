import { Quat, Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Combat } from './combat';
import { Flight } from './flight';
import { MODEL_MOUNTS, MODEL_TUNING } from './model-config';

describe('Curated imported models', () => {
    it('keeps player muzzle, exhaust and collision calibration compatible with the original flight root', () => {
        const t = MODEL_TUNING.surveyor,
            s = t.size / t.dims[t.dimension];
        expect(t.dims[2] * s).toBeCloseTo(5.2);
        expect(MODEL_MOUNTS.surveyor.muzzle).toEqual([1.35, -0.12, -2.8]);
        expect(MODEL_MOUNTS.surveyor.engines[0]).toEqual([-1.05, -0.1, 2.7]);
        expect(MODEL_MOUNTS.surveyor.radius).toBe(2.4);
        expect(MODEL_TUNING.raider.yaw).toBe(90);
        const forward = new Quat().setFromEulerAngles(0, 90, 0).transformVector(Vec3.RIGHT);
        expect(forward.z).toBeCloseTo(-1);
    });
    it('an alien cosmetic reuses exactly the same elite combat tuning and resets on slot reuse', () => {
        const c = new Combat(new Flight(), [], () => undefined),
            e = c.enemies[0];
        e.spawn('interceptor', new Vec3(0, 0, -180), new Quat(), true);
        const tuning = e.tuning;
        e.visual = 'saucer';
        expect(e.tuning).toBe(tuning);
        expect(e.kind).toBe('interceptor');
        expect(e.label).toContain('ALIEN');
        e.spawn('interceptor', Vec3.ZERO, new Quat());
        expect(e.visual).toBe('standard');
    });
});
