import { Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Artillery } from './artillery';
import { BOSS_PATTERNS } from './boss-pattern-config';
import { BossPatterns } from './boss-patterns';
import { Combat } from './combat';
import { Flight } from './flight';
import { Projectiles, sweptHit } from './projectiles';
const sources = () => ({
    banks: [
        { position: new Vec3(-20, 0, -450), active: true },
        { position: new Vec3(20, 0, -450), active: true }
    ],
    muzzle: new Vec3(0, 0, -450)
});
describe('telegraphed 3D pattern combat', () => {
    it('updates moving weak-point velocity once per tick for reliable lead and swept collisions', () => {
        const b = new Artillery(),
            ship = new Flight(),
            shots = new Projectiles();
        b.spawn(ship, []);
        b.step(13, ship, [], shots);
        b.step(0.01, ship, [], shots);
        const part = b.parts[0],
            previous = part.position.clone();
        b.step(0.01, ship, [], shots);
        expect(part.previous.equals(previous)).toBe(true);
        expect(part.velocity.length()).toBeGreaterThan(1);
        expect(part.position.clone().sub(previous).mulScalar(100).distance(part.velocity)).toBeLessThan(0.001);
    });
    it('warns before firing and freezes aim through the attack, pause and reset', () => {
        const p = new BossPatterns(),
            ship = new Flight(),
            shots = new Projectiles(),
            s = sources();
        p.step(0.1, 1, ship, s, shots, []);
        const aim = p.aim.clone();
        ship.position.x = 100;
        p.step(1, 1, ship, s, shots, []);
        expect(shots.fired).toBe(0);
        expect(p.aim.equals(aim)).toBe(true);
        p.step(0.8, 1, ship, s, shots, []);
        expect(shots.fired).toBeGreaterThan(0);
        const t = p.time;
        p.step(0, 1, ship, s, shots, []);
        expect(p.time).toBe(t);
        p.reset();
        expect(p.beamActive).toBe(false);
        expect(p.state).toBe('telegraph');
    });
    it('emits staggered fans across three elevations, with deliberate holes', () => {
        const p = new BossPatterns(),
            ship = new Flight(),
            shots = new Projectiles();
        p.reset(2);
        p.index = BOSS_PATTERNS.sequences[1].indexOf('fan');
        p.step(1.66, 2, ship, sources(), shots, []);
        const bolts = shots.items.filter((p) => p.active);
        expect(bolts).toHaveLength(12);
        expect(new Set(bolts.map((p) => Math.round(p.velocity.y / 10))).size).toBeGreaterThanOrEqual(3);
        expect(bolts.every((p) => p.pattern === 1 && p.plasma && p.life === 7)).toBe(true);
    });
    it('runs all five families through distinct warning/fire/recovery states under bounded load', () => {
        const p = new BossPatterns(),
            ship = new Flight(),
            shots = new Projectiles(),
            s = sources(),
            kinds = new Set<string>(),
            stages = new Set<string>();
        p.reset(3);
        let peak = 0;
        for (let i = 0; i < 18000; i++) {
            p.step(0.01, 3, ship, s, shots, []);
            kinds.add(p.kind);
            stages.add(p.state);
            let count = 0;
            for (const b of shots.items)
                if (b.active) {
                    b.life -= 0.01;
                    if (b.life <= 0) b.active = false;
                    else count++;
                }
            peak = Math.max(peak, count);
        }
        expect(kinds.size).toBe(5);
        expect(stages.size).toBe(3);
        expect(peak).toBeLessThanOrEqual(BOSS_PATTERNS.hostileLimit);
        expect(shots.dropped).toBe(0);
    });
    it('reserves room for player shots instead of exhausting the shared pool', () => {
        const p = new BossPatterns(),
            shots = new Projectiles(),
            ship = new Flight();
        for (let i = 0; i < 208; i++) shots.spawn(Vec3.ZERO, Vec3.FORWARD, Vec3.ZERO, 1, 1, 10, false);
        p.step(2, 1, ship, sources(), shots, []);
        expect(shots.items.filter((b) => b.hostile && b.active)).toHaveLength(0);
    });
    it('telegraphs a changing-plane beam and stops its dangerous segment at asteroid cover', () => {
        const p = new BossPatterns(),
            ship = new Flight(),
            shots = new Projectiles(),
            s = sources();
        p.reset(2);
        p.index = BOSS_PATTERNS.sequences[1].indexOf('beam');
        p.step(3.15, 2, ship, s, shots, []);
        expect(p.beamActive).toBe(true);
        expect(sweptHit(p.beamOrigin, p.beamEnd, ship.position, ship.position, 6)).toBeLessThan(Infinity);
        p.obstacles = [{ position: new Vec3(0, 0, -250), radius: 40 }];
        p.step(0.0001, 2, ship, s, shots, []);
        expect(p.beamEnd.z).toBeLessThan(-280);
        expect(sweptHit(p.beamOrigin, p.beamEnd, ship.position, ship.position, 6)).toBe(Infinity);
        p.interrupt();
        expect(p.beamActive).toBe(false);
    });
    it('punishes a stationary player through the real damage/death path', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], () => undefined);
        c.countdown = 1000;
        c.director.wave = 5;
        c.boss.spawn(ship, []);
        for (let i = 0; i < 30000 && ship.hull > 0; i++) c.step(0.01, false);
        expect(ship.hull).toBe(0);
        expect(c.enemyHits).toBeGreaterThan(5);
        expect(c.duration).toBeLessThan(180);
    });
});
