import { describe, expect, it } from 'vitest';

import { neutral } from './flight';
import { thrusterVertexWGSL, thrusterFragmentWGSL } from './thruster-shader';
import { PLAYER_ENGINES, ThrusterState } from './thruster-state';

describe('Input-driven propulsion visuals', () => {
    it('avoids duplicate shared WGSL uniforms in the Engine 2.24 shader processor', () => {
        const declarations = new Map<string, string>();
        for (const shader of [thrusterVertexWGSL, thrusterFragmentWGSL])
            for (const match of shader.matchAll(/uniform\s+(\w+)[^;]*;/g)) {
                const previous = declarations.get(match[1]);
                if (previous) expect(match[0]).toBe(previous);
                else declarations.set(match[1], match[0]);
            }
    });
    it('distinguishes idle, actual thrust, exhausted boost, cruise and braking', () => {
        const s = new ThrusterState(),
            c = neutral();
        s.update(c, false, false, 0.1);
        expect(s.mode).toBe('idle');
        c.z = -1;
        for (let i = 0; i < 12; i++) s.update(c, false, false, 0.1);
        const thrust = s.length;
        expect(s.mode).toBe('thrust');
        for (let i = 0; i < 12; i++) s.update(c, true, false, 0.1);
        expect(s.mode).toBe('boost');
        expect(s.length).toBeGreaterThan(thrust * 2);
        s.update(c, false, false, 0.1);
        expect(s.mode).toBe('thrust');
        c.z = 0;
        for (let i = 0; i < 12; i++) s.update(c, false, true, 0.1);
        expect(s.mode).toBe('cruise');
        expect(s.length).toBeGreaterThan(7.5);
        c.brake = true;
        for (let i = 0; i < 15; i++) s.update(c, false, false, 0.1);
        expect(s.mode).toBe('braking');
        expect(s.length).toBeLessThan(0.25);
    });
    it('does not interpret boost-key intent without forward acceleration as boost', () => {
        const s = new ThrusterState(),
            c = neutral();
        c.boost = true;
        s.update(c, false, false, 0.1);
        expect(s.mode).toBe('idle');
        c.z = 1;
        s.update(c, false, false, 0.1);
        expect(s.mode).toBe('braking');
    });
    it('reacts on the force-opposite side for lateral, vertical and roll inputs', () => {
        const s = new ThrusterState(),
            c = neutral();
        c.x = 1;
        c.y = 1;
        for (let i = 0; i < 10; i++) s.update(c, false, false, 0.1);
        expect(s.jets[0]).toBeGreaterThan(0.9);
        expect(s.jets[1]).toBe(0);
        expect(s.jets[4]).toBeGreaterThan(0.9);
        expect(s.jets[2]).toBe(0);
        c.x = c.y = 0;
        c.roll = 1;
        for (let i = 0; i < 10; i++) s.update(c, false, false, 0.1);
        expect(s.jets[2]).toBeGreaterThan(0.6);
        expect(s.jets[5]).toBeGreaterThan(0.6);
    });
    it('freezes all animation and envelopes when paused, resets and ignores cleared menu controls', () => {
        const s = new ThrusterState(),
            c = neutral();
        c.z = -1;
        c.x = 1;
        s.update(c, true, false, 0.1);
        const before = JSON.stringify(s);
        s.update(neutral(), false, false, 0.1, false);
        expect(JSON.stringify(s)).toBe(before);
        s.reset();
        expect(s.mode).toBe('idle');
        expect(s.time).toBe(0);
        expect(s.jets.every((n) => n === 0)).toBe(true);
        s.update(c, true, true, 0.1, false, true);
        expect(s.mode).toBe('idle');
        expect(s.jets.every((n) => n === 0)).toBe(true);
    });
    it('is frame independent and retains ship-specific measured nozzle geometry', () => {
        const a = new ThrusterState(),
            b = new ThrusterState(),
            c = neutral();
        c.z = -1;
        for (let i = 0; i < 120; i++) a.update(c, true, false, 1 / 120);
        for (let i = 0; i < 30; i++) b.update(c, true, false, 1 / 30);
        expect(a.length).toBeCloseTo(b.length, 5);
        expect(a.power).toBeCloseTo(b.power, 5);
        expect(PLAYER_ENGINES.classic).toHaveLength(2);
        expect(PLAYER_ENGINES.surveyor).toHaveLength(3);
        expect(PLAYER_ENGINES.surveyor[0].point[2]).toBeLessThan(PLAYER_ENGINES.surveyor[1].point[2]);
    });
});
