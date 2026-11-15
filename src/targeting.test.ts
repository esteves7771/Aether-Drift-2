import { Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Combat } from './combat';
import type { CombatTarget } from './combat-target';
import { Flight } from './flight';
import { Missiles } from './missiles';
import { RosterPages } from './ship-roster';
import { Targeting } from './targeting';
const target = (id: number, role: CombatTarget['targetRole'] = 'craft', x = 0, z = -200) => ({
    id,
    targetRole: role,
    active: true,
    targetable: true,
    health: 100,
    maxHealth: 100,
    radius: 4,
    label: 'fixture',
    position: new Vec3(x, 0, z),
    previous: new Vec3(x, 0, z),
    velocity: new Vec3(),
    generation: 1
});
describe('combat acquisition', () => {
    it('reacquires by score instead of inheriting a recycled enemy slot before the next tick', () => {
        const t = new Targeting(new Flight(), []),
            old = target(0),
            nearby = target(1, 'craft', 0, -150);
        t.select([old]);
        old.generation++;
        old.position.z = -800;
        expect(t.assist(old)).toBe(false);
        expect(t.missile(old, [old, nearby])).toBe(nearby);
    });
    it('does not consume missile ammo or cooldown without an eligible target', () => {
        const c = new Combat(new Flight(), [], () => undefined);
        c.countdown = 1000;
        expect(c.launchMissile()).toBe(false);
        expect(c.ammo).toBe(6);
        expect(c.missileCooldown).toBe(0);
        expect(c.targeting.message).toBe('NO HOSTILE TARGET');
    });
    it('fires ordinary lasers forward despite a stale environmental selection', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], () => undefined);
        c.countdown = 1000;
        const b = c.barrels.items[0];
        b.position.set(120, 0, -1477);
        c.selected = b.id;
        c.step(0.01, true);
        const shots = c.projectiles.items.filter((p) => p.active && !p.hostile);
        expect(shots.length).toBe(2);
        for (const p of shots) {
            expect(Math.abs(p.velocity.x)).toBeLessThan(0.001);
            expect(p.velocity.z).toBeLessThan(0);
        }
    });
    it('prefers fighters over aligned distant cargo and defenses', () => {
        const t = new Targeting(new Flight(), []),
            fighter = target(0, 'craft', 30, -200);
        expect(t.best([target(40, 'environment', 0, -1477), target(16, 'defense', 0, -300), fighter])).toBe(fighter);
    });
    it('balances range and angle, excluding out-of-cone and distant craft', () => {
        const t = new Targeting(new Flight(), []),
            near = target(0, 'craft', 10, -150);
        expect(
            t.best([target(1, 'craft', 0, -850), target(2, 'craft', 200, -100), target(3, 'craft', 0, -1500), near])
        ).toBe(near);
    });
    it('acquires exposed boss parts, excludes arrival and hidden parts', () => {
        const t = new Targeting(new Flight(), []),
            boss = target(8, 'boss', 0, -800),
            arrival = target(0);
        arrival.targetable = false;
        expect(t.best([arrival, boss])).toBe(boss);
        boss.targetable = false;
        expect(t.best([arrival, boss])).toBeUndefined();
    });
    it('allows deliberate barrels but missile acquisition yields to fighters', () => {
        const t = new Targeting(new Flight(), []),
            barrel = target(40, 'environment'),
            enemy = target(0, 'craft', 20);
        expect(t.select([barrel, enemy], true)).toBe(40);
        expect(t.missile(barrel, [barrel, enemy])).toBe(enemy);
        expect(t.missile(barrel, [barrel])).toBe(barrel);
        expect(t.best([barrel])).toBeUndefined();
    });
    it('fails closed without valid hostiles and reports a compact status', () => {
        const t = new Targeting(new Flight(), []);
        expect(t.missile(undefined, [target(40, 'environment')])).toBeUndefined();
        expect(t.message).toBe('NO HOSTILE TARGET');
        const neutral = target(99);
        delete (neutral as Partial<typeof neutral>).targetRole;
        expect(t.best([neutral])).toBeUndefined();
    });
    it('clears dead, untargetable and recycled slots without reacquiring', () => {
        const t = new Targeting(new Flight(), []),
            a = target(0),
            b = target(1);
        t.select([a, b]);
        a.generation++;
        expect(t.update(0, [a, b], 0.01)).toBe(-1);
        t.select([a]);
        a.active = false;
        expect(t.update(0, [a], 0.01)).toBe(-1);
        a.active = true;
        t.select([a]);
        a.targetable = false;
        expect(t.update(0, [a], 0.01)).toBe(-1);
    });
    it('keeps a lock through a brief excursion, then expires; reentry needs acquisition', () => {
        const t = new Targeting(new Flight(), []),
            a = target(0);
        t.select([a]);
        a.position.x = 600;
        expect(t.update(0, [a], 0.2)).toBe(0);
        expect(t.update(0, [a], 0.21)).toBe(-1);
        a.position.x = 0;
        expect(t.update(-1, [a], 1)).toBe(-1);
        expect(t.select([a])).toBe(0);
    });
    it('rejects obstructed lines of sight', () => {
        const t = new Targeting(new Flight(), [{ position: new Vec3(0, 0, -100), radius: 20 }]);
        expect(t.best([target(0)])).toBeUndefined();
    });
    it('bounds laser assistance and rejects stale or unrelated environmental locks', () => {
        const t = new Targeting(new Flight(), []),
            a = target(0);
        expect(t.assist(a)).toBe(true);
        a.position.x = 25;
        expect(t.assist(a)).toBe(false);
        a.position.set(0, 0, -600);
        expect(t.assist(a)).toBe(false);
        a.active = false;
        expect(t.assist(a)).toBe(false);
        expect(t.assist(target(40, 'environment'))).toBe(false);
    });
    it('missiles retain acquisition, and coast safely after destruction or slot reuse', () => {
        const m = new Missiles(),
            ship = new Flight(),
            a = target(0),
            b = target(1);
        m.launch(ship, a);
        m.step(0.1, (id) => (id === 0 ? a : b));
        expect(m.items[0].targetId).toBe(0);
        a.generation++;
        m.step(0.1, () => a);
        expect(m.items[0].targetId).toBe(-1);
        m.step(0.1, () => b);
        expect(m.items[0].targetId).toBe(-1);
        expect(m.items[0].position.z).toBeLessThan(-2.8);
    });
});
describe('roster pagination', () => {
    it('shows both current ships; additional pages do not select a ship', () => {
        const p = new RosterPages(2);
        expect(p.pages).toBe(1);
        expect([0, 1].every((i) => p.visible(i))).toBe(true);
        p.count = 5;
        p.move(1);
        expect(p.page).toBe(1);
        expect(p.visible(2)).toBe(true);
        expect(p.visible(0)).toBe(false);
        p.move(10);
        expect(p.page).toBe(2);
        p.move(-10);
        expect(p.page).toBe(0);
    });
});
