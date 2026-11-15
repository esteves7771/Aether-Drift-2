import { Mat4, Quat, Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Boss } from './boss';
import { field } from './collisions';
import { Combat } from './combat';
import { EVOLUTION } from './evolution-config';
import { Flight } from './flight';
import { Projectiles } from './projectiles';

const dt = 1 / 120;
const advance = (c: Combat, seconds: number) => {
    for (let i = 0; i < seconds * 120; i++) c.step(dt, false);
};
describe('Phase 4 abilities and capital encounter', () => {
    it('each boss phase fires damaging physical bolts and can destroy an idle player', () => {
        for (const phase of [1, 2, 3]) {
            const ship = new Flight(),
                c = new Combat(ship, [], () => undefined);
            c.director.wave = 5;
            c.director.group = 1;
            c.boss.spawn(ship, []);
            c.boss.phase = phase;
            advance(c, 90);
            expect(c.enemyHits, 'phase ' + phase).toBeGreaterThan(0);
            expect(ship.hull, 'phase ' + phase).toBe(0);
            expect(c.projectiles.items.filter((p) => p.active && p.hostile).length).toBeLessThanOrEqual(
                EVOLUTION.boss.projectileLimit
            );
        }
    });
    it('homes physical missiles, spends charges, respects cooldown, and hits enemies', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], () => undefined);
        c.countdown = 100;
        const e = c.enemies[0];
        e.spawn('heavy', new Vec3(20, 0, -100), new Quat());
        c.selected = e.id;
        expect(c.launchMissile()).toBe(true);
        expect(c.ammo).toBe(5);
        expect(c.launchMissile()).toBe(false);
        const m = c.missiles.items[0];
        expect(m.position.z).toBe(-2.8);
        advance(c, 0.2);
        expect(m.position.z).toBeLessThan(-20);
        expect(m.direction.x).toBeGreaterThan(0);
        advance(c, 2);
        expect(e.active).toBe(false);
        expect(c.kills).toBe(1);
        c.reset();
        expect(c.ammo).toBe(6);
        expect(c.missiles.items.some((m) => m.active)).toBe(false);
    });
    it('missiles strike nearer rocks and expire after losing targets', () => {
        const ship = new Flight(),
            c = new Combat(ship, [{ position: new Vec3(0, 0, -30), radius: 9 }], () => undefined);
        c.countdown = 100;
        const e = c.enemies[0];
        e.spawn('heavy', new Vec3(0, 0, -90), new Quat());
        c.selected = 0;
        c.missiles.launch(ship, e);
        advance(c, 0.4);
        expect(c.rockHits).toBeGreaterThan(0);
        expect(e.health).toBe(e.maxHealth);
        c.missileCooldown = 0;
        c.missiles.launch(ship, e);
        e.active = false;
        advance(c, 7);
        expect(c.missiles.items.some((m) => m.active)).toBe(false);
    });
    it('EMP is local, clears hostile bolts, disrupts firing, then recovers', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], () => undefined);
        c.countdown = 100;
        c.enemies[0].spawn('interceptor', new Vec3(0, 0, -80), new Quat());
        c.enemies[1].spawn('interceptor', new Vec3(400, 0, 0), new Quat());
        c.projectiles.spawn(new Vec3(0, 0, -10), Vec3.FORWARD, Vec3.ZERO, 50, 10, 3, true);
        expect(c.emp()).toBe(true);
        expect(c.emp()).toBe(false);
        expect(c.enemies[0].disrupted).toBe(3.5);
        expect(c.enemies[1].disrupted).toBe(0);
        expect(c.projectiles.items[0].active).toBe(false);
        advance(c, 1);
        expect(c.enemies[0].canFire).toBe(false);
        advance(c, 3);
        expect(c.enemies[0].disrupted).toBe(0);
        expect(c.empCooldown).toBeGreaterThan(0);
    });
    it('squad orders regroup and recover with a bounded attack budget', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], () => undefined);
        c.countdown = 100;
        for (let i = 0; i < 6; i++) c.enemies[i].spawn('interceptor', new Vec3(i * 30, 100, -300), new Quat(), i === 0);
        c.squadron.step(4, c.enemies, ship);
        expect(c.enemies.some((e) => e.active && e.order === 'flank')).toBe(true);
        c.squadron.step(7, c.enemies, ship);
        expect(c.enemies.every((e) => !e.active || e.order === 'regroup')).toBe(true);
        c.squadron.step(10, c.enemies, ship);
        expect(c.enemies.filter((e) => e.active && e.canFire).length).toBeLessThanOrEqual(3);
    });
    it('boss spawns clear of rocks, gates phases, telegraphs locked aim and cancels attacks under EMP', () => {
        const ship = new Flight(),
            b = new Boss(),
            rocks = field(),
            shots = new Projectiles();
        b.spawn(ship, rocks);
        expect(rocks.every((r) => r.position.distance(b.position) > r.radius + 72)).toBe(true);
        expect(b.parts.some((p) => p.targetable)).toBe(false);
        for (let i = 0; i < 120 * 6; i++) b.step(dt, ship, [], shots);
        expect(b.charge).toBeGreaterThan(0);
        const aim = b.aim.clone();
        ship.position.x += 100;
        b.step(dt, ship, [], shots);
        expect(b.aim.equals(aim)).toBe(true);
        b.disrupted = 1.6;
        b.step(dt, ship, [], shots);
        expect(b.charge).toBe(0);
        expect(shots.fired).toBe(0);
        for (let i = 0; i < 4; i++) {
            b.step(dt, ship, [], shots);
            b.damage(b.parts[i], 1000);
        }
        expect(b.phase).toBe(2);
        expect(b.parts[6].targetable).toBe(false);
        for (let i = 0; i < 150; i++) b.step(dt, ship, [], shots);
        expect(b.parts[4].targetable).toBe(true);
        b.damage(b.parts[4], 1000);
        b.step(dt, ship, [], shots);
        b.damage(b.parts[5], 1000);
        expect(b.phase).toBe(3);
    });
    it('plays all waves through actual laser/missile hits, all boss components, victory, then Wave 6', () => {
        const ship = new Flight(),
            events: string[] = [],
            c = new Combat(
                ship,
                [],
                () => undefined,
                (e) => events.push(e)
            );
        const matrix = new Mat4(),
            aim = new Vec3(),
            direction = new Vec3(),
            phases = new Set<number>(),
            orders = new Set<string>();
        let elite = false,
            missileHits = false;
        const seen = new Set<number>();
        for (let i = 0; i < 120 * 600 && c.wave < 6; i++) {
            const target = c.targets.find((t) => t.active && t.targetable);
            if (target) {
                // Perfect deterministic pilot: no enemy health changes or skipped director states.
                aim.copy(target.velocity)
                    .mulScalar(target.position.distance(ship.position) / 480)
                    .add(target.position);
                matrix.setLookAt(ship.position, aim, Vec3.UP);
                ship.rotation.setFromMat4(matrix);
                ship.previousRotation.copy(ship.rotation);
                c.selected = target.id;
                if (c.wave >= 3 && c.ammo > 0 && c.missileCooldown <= 0) {
                    c.launchMissile();
                    missileHits = true;
                }
                direction.sub2(target.position, ship.position).normalize();
                ship.velocity.set(Math.sin(i * 0.013) * 12, Math.cos(i * 0.017) * 12, 0);
            }
            ship.previous.copy(ship.position);
            ship.position.add(direction.copy(ship.velocity).mulScalar(dt));
            if (c.empCooldown <= 0 && c.enemies.some((e) => e.active && e.position.distance(ship.position) < 150))
                c.emp();
            c.step(dt, true);
            if (c.upgrades.pending) c.chooseUpgrade(c.upgrades.offers[0]);
            seen.add(c.wave);
            if (c.boss.active) phases.add(c.boss.phase);
            for (const e of c.enemies)
                if (e.active) {
                    elite ||= e.elite;
                    orders.add(e.order);
                }
            if (ship.hull <= 0) throw new Error('Pilot died at wave ' + c.wave + ' time ' + i / 120);
        }
        expect([...seen]).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect([...phases]).toEqual([1, 2, 3]);
        expect(elite).toBe(true);
        expect(missileHits).toBe(true);
        expect(orders.has('formation')).toBe(true);
        expect(events).toEqual(['boss:spawn', 'boss:defeated']);
        expect(c.score).toBeGreaterThan(6000);
        expect(c.boss.health).toBe(0);
        expect(c.enemies.some((e) => e.active && e.kind === 'bomber')).toBe(true);
        expect(c.projectiles.items.length).toBe(240);
        expect(c.missiles.items.length).toBe(EVOLUTION.missile.capacity);
    });
});
