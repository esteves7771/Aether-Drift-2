import { Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Collisions } from './collisions';
import { FLIGHT } from './config';
import { Flight, neutral } from './flight';
const run = (ship: Flight, seconds: number, assist = false, command = neutral()) => {
    for (let i = 0; i < seconds / FLIGHT.step; i++) ship.step(command, FLIGHT.step, assist);
};
describe('flight simulation', () => {
    it('accelerates along the rotated local forward vector', () => {
        const ship = new Flight();
        ship.rotation.setFromEulerAngles(0, 90, 0);
        run(ship, 1, false, { ...neutral(), z: -1 });
        expect(ship.velocity.x).toBeLessThan(-20);
        expect(Math.abs(ship.velocity.z)).toBeLessThan(0.01);
    });
    it('preserves unassisted inertia and brakes deliberately', () => {
        const ship = new Flight();
        ship.velocity.set(10, 0, 0);
        run(ship, 1);
        expect(ship.velocity.x).toBeCloseTo(10);
        run(ship, 1, false, { ...neutral(), brake: true });
        expect(ship.velocity.length()).toBeLessThan(0.5);
    });
    it('assistance damps drift', () => {
        const ship = new Flight();
        ship.velocity.set(20, 0, 0);
        run(ship, 2, true);
        expect(ship.velocity.length()).toBeLessThan(5);
    });
    it('boost consumes reserve, accelerates faster, and recharges', () => {
        const a = new Flight(),
            b = new Flight();
        run(a, 1, false, { ...neutral(), z: -1, boost: true });
        run(b, 1, false, { ...neutral(), z: -1 });
        expect(a.velocity.length()).toBeGreaterThan(b.velocity.length() * 2);
        expect(a.energy).toBeCloseTo(76);
        run(a, 2);
        expect(a.energy).toBe(100);
    });
    it('keeps quaternion rotation normalized through sustained 6DOF input', () => {
        const ship = new Flight();
        run(ship, 20, false, { ...neutral(), pitch: 1, yaw: -0.4, roll: 1, x: 1, y: 1 });
        expect(ship.rotation.length()).toBeCloseTo(1);
        expect(Number.isFinite(ship.position.x)).toBe(true);
    });
    it('sweeps collisions to prevent tunnelling and resets all state', () => {
        const ship = new Flight();
        ship.previous.set(0, 0, 10);
        ship.position.set(0, 0, -10);
        ship.velocity.set(0, 0, -180);
        new Collisions().solve(ship, [{ position: new Vec3(), radius: 3 }]);
        expect(ship.position.z).toBeGreaterThan(5);
        expect(ship.hull).toBeLessThan(100);
        expect(ship.velocity.z).toBeGreaterThan(0);
        ship.reset();
        expect(ship.hull).toBe(100);
        expect(ship.position.length()).toBe(0);
        expect(ship.velocity.length()).toBe(0);
        expect(ship.energy).toBe(100);
    });
});
