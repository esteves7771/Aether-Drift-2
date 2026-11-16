import { Mat4, Quat, Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Combat } from './combat';
import { FLEET } from './fleet-config';
import { Flight } from './flight';
import { Phantom } from './phantom';
import { Projectiles } from './projectiles';
import { Records } from './records';
import { WaveDirector } from './wave-director';
const dt = 1 / 120,
    quiet = () => undefined;
describe('new fleet roles', () => {
    it('telegraphs bounded bomber salvos, limits guidance, and cancels preparation under EMP', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], quiet);
        const e = c.enemies[0];
        e.spawn('bomber', new Vec3(0, 0, -320), new Quat());
        let warned = false;
        for (let i = 0; i < 720; i++) {
            c.step(dt, false);
            warned ||= e.warmup > 0;
        }
        expect(warned).toBe(true);
        expect(c.fleet.salvos).toBeGreaterThan(0);
        expect(c.projectiles.items.filter((p) => p.active && p.seeker).length).toBeLessThanOrEqual(2);
        const missile = c.projectiles.items.find((p) => p.active && p.seeker)!;
        expect(missile).toBeDefined();
        const speed = missile.velocity.length();
        for (let i = 0; i < 400; i++) c.fleet.steer(missile, ship, dt);
        expect(missile.guide).toBeLessThanOrEqual(0);
        expect(missile.velocity.length()).toBeCloseTo(speed);
        e.warmup = 1;
        e.disrupted = 2;
        c.step(dt, false);
        expect(e.warmup).toBe(0);
        expect(e.cooldown).toBeGreaterThanOrEqual(2);
        e.disrupted = 0;
        e.position.set(0, 0, -60);
        e.warmup = 0.01;
        const fired = c.projectiles.fired;
        c.fleet.step(0.02, ship, c.enemies, [], c.projectiles, quiet);
        expect(c.projectiles.fired).toBe(fired);
        const pool = new Projectiles();
        pool.spawn(Vec3.ZERO, Vec3.FORWARD, Vec3.ZERO, 95, 10, 3, true, true);
        pool.items[0].active = false;
        pool.spawn(Vec3.ZERO, Vec3.FORWARD, Vec3.ZERO, 95, 10, 3, true);
        expect(pool.items[0].seeker).toBe(false);
    });
    it('caps carrier deployments, reuses slots, and retires orphan drones without score', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], quiet),
            parent = c.enemies[0];
        parent.spawn('carrier', new Vec3(0, 0, -350), new Quat());
        const step = (seconds: number) => {
            for (let i = 0; i < seconds * 120; i++) {
                parent.age += dt;
                parent.cooldown -= dt;
                c.fleet.step(dt, ship, c.enemies, [], c.projectiles, quiet);
            }
        };
        step(5);
        expect(c.fleet.deployed).toBe(2);
        expect(c.enemies.filter((e) => e.active && e.kind === 'drone')).toHaveLength(2);
        step(30);
        expect(c.fleet.deployed).toBe(2);
        for (const e of c.enemies) if (e.kind === 'drone') e.active = false;
        step(12);
        expect(c.fleet.deployed).toBe(FLEET.deployment.total);
        parent.active = false;
        const score = c.score;
        step(13);
        expect(c.enemies.some((e) => e.active)).toBe(false);
        expect(c.score).toBe(score);
        expect(c.enemies).toHaveLength(8);
    });
    it('awards a high-priority carrier interruption exactly once through CombatFlow', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], quiet),
            e = c.enemies[0];
        e.spawn('carrier', new Vec3(0, 0, -40), new Quat());
        e.health = 14;
        e.warmup = 1;
        c.selected = 0;
        for (let i = 0; i < 40; i++) c.step(dt, true);
        expect(c.kills).toBe(1);
        expect(c.score).toBe(350);
        expect(e.active).toBe(false);
    });
    it('uses deterministic weighted roles after the preserved first five waves', () => {
        const a = new WaveDirector(),
            b = new WaveDirector();
        for (let wave = 6; wave < 25; wave++) {
            a.wave = b.wave = wave;
            for (let group = 1; group < 4; group++) {
                a.group = b.group = group;
                expect(a.encounter).toEqual(b.encounter);
                expect(a.size).toBeLessThanOrEqual(7);
            }
        }
        a.wave = 6;
        a.group = 1;
        expect(a.encounter?.roles).toContain('bomber');
        a.wave = 7;
        expect(a.encounter?.roles).toContain('carrier');
        a.wave = 10;
        expect(a.groupCount).toBe(1);
        expect(a.encounter).toBeNull();
    });
});
describe('Phantom encounter and retained progression', () => {
    it('moves continuously, fires physical attacks, and exposes three reachable damage phases', () => {
        const ship = new Flight(),
            p = new Phantom(),
            shots = new Projectiles();
        p.spawn(ship, []);
        let moved = 0;
        for (let i = 0; i < 120 * 20; i++) {
            const before = p.position.clone();
            p.step(dt, ship, [], shots);
            const distance = before.distance(p.position);
            expect(distance).toBeLessThanOrEqual(105 * dt + 0.0001);
            moved += distance;
        }
        expect(moved).toBeGreaterThan(300);
        expect(shots.fired).toBeGreaterThan(0);
        p.parts[0].exposed = true;
        p.damage(p.parts[0], p.maxHealth * 0.35);
        expect(p.phase).toBe(2);
        for (let i = 0; i < 120; i++) p.step(dt, ship, [], shots);
        p.parts[0].exposed = true;
        p.damage(p.parts[0], p.maxHealth * 0.35);
        expect(p.phase).toBe(3);
        for (let i = 0; i < 120; i++) p.step(dt, ship, [], shots);
        p.parts[0].exposed = true;
        p.damage(p.parts[0], p.maxHealth);
        expect(p.active).toBe(false);
        expect(p.dying).toBeGreaterThan(0);
    });
    it('plays Waves 1–21 using actual shots, all three bosses, new roles, score and records', () => {
        const ship = new Flight(),
            events: string[] = [],
            c = new Combat(ship, [], quiet, (e) => events.push(e)),
            matrix = new Mat4(),
            point = new Vec3(),
            delta = new Vec3(),
            phases = new Set<number>(),
            roles = new Set<string>(),
            waves = new Set<number>();
        for (let i = 0; i < 120 * 2000 && c.wave < 21; i++) {
            const target = c.targets.find((t) => t.active && t.targetable);
            if (target) {
                // Deterministic collision fixture visits the outer face of Tesser's lateral capacitors.
                // Actual flight and complete boss combat are separately browser-tested.
                if (c.guardian.active && target.id >= 26) {
                    const normal = target.position.clone().sub(c.guardian.position).normalize();
                    ship.position.copy(target.position).add(normal.mulScalar(160));
                    ship.previous.copy(ship.position);
                }
                point
                    .copy(target.velocity)
                    .sub(ship.velocity)
                    .mulScalar(target.position.distance(ship.position) / 480)
                    .add(target.position);
                matrix.setLookAt(ship.position, point, Vec3.UP);
                ship.rotation.setFromMat4(matrix);
                ship.previousRotation.copy(ship.rotation);
                c.selected = target.id;
                if (c.wave >= 3 && c.ammo > 0 && c.missileCooldown <= 0) c.launchMissile();
            }
            if (c.storm.ready) c.activateStorm();
            ship.velocity.set(Math.sin(i * 0.013) * 42, Math.cos(i * 0.017) * 42, 0);
            ship.previous.copy(ship.position);
            ship.position.add(delta.copy(ship.velocity).mulScalar(dt));
            if (c.empCooldown <= 0 && c.enemies.some((e) => e.active && e.position.distance(ship.position) < 150))
                c.emp();
            c.step(dt, true);
            if (c.upgrades.pending) c.chooseUpgrade(c.upgrades.offers[0]);
            waves.add(c.wave);
            for (const e of c.enemies) if (e.active) roles.add(e.kind);
            if (c.phantom.active) phases.add(c.phantom.phase);
            if (ship.hull <= 0) throw Error('Pilot died at ' + c.wave + ' after ' + i / 120 + 's');
        }
        expect([...waves]).toEqual(Array.from({ length: 22 }, (_, i) => i));
        expect([...phases]).toEqual([1, 2, 3]);
        expect(roles.has('bomber')).toBe(true);
        expect(roles.has('carrier')).toBe(true);
        expect(c.bosses).toBe(5);
        expect(c.phantom.health).toBe(0);
        expect(events).toEqual(Array.from({ length: 4 }, () => ['boss:spawn', 'boss:defeated']).flat());
        const store = { getItem: () => null, setItem: quiet },
            records = new Records(store);
        expect(records.save(c.summary('retired'))).toContain('phantom');
        expect(records.data.bestPhantomTime).toBeGreaterThan(0);
    });
});
