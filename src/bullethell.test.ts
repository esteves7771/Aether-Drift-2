import { Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { BossPatterns } from './boss-patterns';
import { BULLETHELL } from './bullethell-config';
import { Flight } from './flight';
import { Projectiles } from './projectiles';
describe('Phase 5I attack geometry and reservations', () => {
    it('emits a 60-ring staggered 3D curtain with an intentional corridor', () => {
        const f = new Flight();
        f.position.z = -350;
        const p = new BossPatterns(),
            shots = new Projectiles();
        const sources = {
            muzzle: new Vec3(),
            banks: [
                { position: new Vec3(-40, 0, 0), active: true },
                { position: new Vec3(40, 0, 0), active: true }
            ]
        };
        for (let i = 0; i < 400; i++) p.step(1 / 120, 1, f, sources, shots, []);
        const rings = shots.items.filter((s) => s.active && s.pattern === 1);
        expect(rings.length).toBe(60);
        expect(new Set(rings.map((s) => s.velocity.y.toFixed(1))).size).toBeGreaterThan(4);
        expect(rings.every((s) => s.owner === 8)).toBe(true);
        expect(
            rings.every((s) => s.velocity.x / s.velocity.length() < -0.05 || s.velocity.x / s.velocity.length() > 0.05)
        ).toBe(false); // Curved rows span both sides of the aim plane.
    });
    it('bounds combined hostility and preserves normal player weapon capacity', () => {
        const shots = new Projectiles(),
            v = new Vec3(0, 0, -1),
            zero = new Vec3();
        for (let i = 0; i < 400; i++) shots.spawn(zero, v, zero, 100, 10, 5, true);
        expect(shots.items.filter((p) => p.active).length).toBe(shots.items.length - BULLETHELL.playerReserve);
        for (let i = 0; i < BULLETHELL.playerReserve; i++)
            expect(shots.spawn(zero, v, zero, 100, 10, 5, false)).toBe(true);
    });
    it('freezes denied patterns without firing an unannounced volley', () => {
        const p = new BossPatterns(),
            f = new Flight(),
            s = new Projectiles(),
            sources = { muzzle: new Vec3(), banks: [] };
        f.position.z = -300;
        p.permitted = false;
        p.step(10, 1, f, sources, s, []);
        expect(s.fired).toBe(0);
        expect(p.time).toBe(0);
        p.permitted = true;
        p.step(0.1, 1, f, sources, s, []);
        expect(p.state).toBe('telegraph');
        expect(s.fired).toBe(0);
    });
});
it('curtain corridors are reachable with each actual ship profile after a reaction delay', () => {
    for (const key of ['classic', 'surveyor', 'ptah'] as const)
        for (const distance of [200, 400, 700]) {
            const f = new Flight();
            f.setShip(key);
            const command = { x: -1, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, brake: false, boost: false };
            const available = 1.8 + distance / Math.max(125, distance / 5) - 0.4;
            f.evasion.trigger(f, -1);
            for (let i = 0; i < Math.floor(available * 120); i++) f.step(command, 1 / 120, true);
            expect(Math.abs(f.position.x)).toBeGreaterThan(distance * 0.19 + f.radius + 2.2 + 40);
        }
});
