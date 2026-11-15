import { Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Combat } from './combat';
import { COMBAT } from './combat-config';
import { Enemy } from './enemy';
import { EnemyAI } from './enemy-ai';
import { Flight } from './flight';
import { Projectiles, sweptHit } from './projectiles';
const quiet = () => {
    /* simulation-only observer */
};
const advance = (combat: Combat, seconds: number, fire = false) => {
    for (let i = 0; i < seconds * 120; i++) combat.step(1 / 120, fire);
};
describe('swept projectile collision and pools', () => {
    it('inherits rapid ship motion without changing bolt direction or lifetime', () => {
        const ship = new Flight();
        ship.velocity.set(140, 20, -80);
        const combat = new Combat(ship, [], quiet);
        combat.countdown = 100;
        combat.step(1 / 120, true);
        const bolt = combat.projectiles.items[0];
        expect(bolt.velocity.x).toBe(140);
        expect(bolt.velocity.y).toBe(20);
        expect(bolt.velocity.z).toBe(-80 - COMBAT.player.speed);
        expect(bolt.position.distance(bolt.previous)).toBeCloseTo(bolt.velocity.length() / 120);
        expect(bolt.life).toBeCloseTo(COMBAT.player.lifetime - 1 / 120);
    });
    it('hits fast projectiles and moving targets, rejects misses, returns earliest entry', () => {
        expect(sweptHit(new Vec3(0, 0, 20), new Vec3(0, 0, -20), new Vec3(), new Vec3(), 2)).toBeCloseTo(0.45);
        expect(
            sweptHit(new Vec3(-10, 0, 0), new Vec3(10, 0, 0), new Vec3(0, -10, 0), new Vec3(0, 10, 0), 1)
        ).toBeLessThan(0.5);
        expect(sweptHit(new Vec3(-10, 4, 0), new Vec3(10, 4, 0), new Vec3(), new Vec3(), 1)).toBe(Infinity);
    });
    it('bounds projectile allocation and reuses expired slots', () => {
        const pool = new Projectiles(),
            p = new Vec3(),
            d = new Vec3(0, 0, -1);
        for (let i = 0; i < 1000; i++) pool.spawn(p, d, p, 100, 10, 1, false);
        expect(pool.items.length).toBe(COMBAT.projectileCapacity);
        expect(pool.dropped).toBe(1000 - COMBAT.projectileCapacity);
        pool.items[0].active = false;
        pool.spawn(p, d, p, 100, 10, 1, false);
        expect(pool.items[0].active).toBe(true);
        pool.reset();
        expect(pool.items.some((p) => p.active)).toBe(false);
    });
});
describe('combat simulation', () => {
    it('absorbs shields before hull, delays recharge, and permits death', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], quiet);
        c.countdown = 1000;
        c.hurtPlayer(50, new Vec3(1, 0, 0));
        expect(ship.shield).toBe(20);
        expect(ship.hull).toBe(100);
        advance(c, 2);
        expect(ship.shield).toBe(20);
        c.hurtPlayer(40, new Vec3());
        expect(ship.hull).toBe(80);
        expect(ship.shield).toBe(0);
        advance(c, 6);
        expect(ship.shield).toBeGreaterThan(0);
        c.hurtPlayer(999, new Vec3());
        expect(ship.hull).toBe(0);
    });
    it('blocks player shots with nearer asteroids before enemy targets', () => {
        const ship = new Flight(),
            c = new Combat(ship, [{ position: new Vec3(0, 0, -25), radius: 8 }], quiet);
        const e = c.enemies[0];
        e.spawn('heavy', new Vec3(0, 0, -60), ship.rotation);
        advance(c, 0.3, true);
        expect(c.rockHits).toBeGreaterThan(0);
        expect(e.health).toBe(e.maxHealth);
    });
    it('destroys a selected enemy with actual pooled projectiles and scores a kill', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], quiet);
        c.enemies[0].spawn('interceptor', new Vec3(0, 0, -90), ship.rotation);
        c.selectTarget();
        advance(c, 1, true);
        expect(c.kills).toBe(1);
        expect(c.score).toBe(125);
        expect(c.countdown).toBeGreaterThan(0);
    });
    it('spawns safe mixed waves and resets all combat state', () => {
        const ship = new Flight(),
            c = new Combat(ship, [{ position: new Vec3(28, 0, -190), radius: 40 }], quiet);
        advance(c, 2.1);
        expect(c.remaining).toBe(2);
        for (const e of c.enemies)
            if (e.active) expect(e.position.distance(c.rocks[0].position)).toBeGreaterThan(40 + e.tuning.radius);
        for (const e of c.enemies) e.active = false;
        advance(c, 4);
        expect(c.director.group).toBe(2);
        for (const e of c.enemies) e.active = false;
        advance(c, 8);
        expect(c.wave).toBe(2);
        expect(c.enemies.some((e) => e.active && e.kind === 'heavy')).toBe(true);
        c.reset();
        expect(c.wave).toBe(0);
        expect(c.remaining).toBe(0);
        expect(c.projectiles.fired).toBe(0);
    });
    it('AI turns, attacks, evades, and repositions in three dimensions', () => {
        const ship = new Flight(),
            e = new Enemy(1),
            ai = new EnemyAI(),
            states = new Set<string>();
        e.spawn('interceptor', new Vec3(20, 10, -200), ship.rotation);
        for (let i = 0; i < 120 * 15; i++) {
            ai.step(e, ship, [e], [], 1 / 120);
            states.add(e.state);
        }
        expect(states.has('attack')).toBe(true);
        expect(states.has('evade')).toBe(true);
        expect(states.has('reposition')).toBe(true);
        expect(e.position.y).not.toBeCloseTo(10);
        expect(e.rotation.length()).toBeCloseTo(1);
    });
    it('enemies fire, drain shields, and kill an idle player over time', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], quiet);
        advance(c, 50);
        expect(c.enemyHits).toBeGreaterThan(0);
        expect(ship.hull).toBe(0);
    });
});
