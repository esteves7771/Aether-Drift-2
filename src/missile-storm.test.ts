import { Vec3 } from 'playcanvas';
import { expect, it } from 'vitest';

import { BULLETHELL } from './bullethell-config';
import { Combat } from './combat';
import { Flight } from './flight';
it('charges in active fixed time, freezes at dt zero, launches six fanning missiles without normal ammo', () => {
    for (const ship of ['classic', 'surveyor', 'ptah'] as const) {
        const f = new Flight();
        f.setShip(ship);
        const c = new Combat(f, [], () => undefined);
        c.countdown = 1000;
        c.enemies[0].spawn('interceptor', new Vec3(-20, 0, -250), f.rotation);
        c.enemies[1].spawn('heavy', new Vec3(20, 0, -270), f.rotation);
        for (let i = 0; i < 5400; i++) c.storm.step(1 / 120, f, c.targets, c.missiles, () => undefined);
        const before = c.storm.charge;
        c.storm.step(0, f, c.targets, c.missiles, () => undefined);
        expect(c.storm.charge).toBe(before);
        expect(c.storm.ready).toBe(true);
        const ammo = c.ammo;
        expect(c.activateStorm()).toBe(true);
        expect(c.activateStorm()).toBe(false);
        for (let i = 0; i < 120; i++) c.storm.step(1 / 120, f, c.targets, c.missiles, () => undefined);
        const active = c.missiles.items.filter((m) => m.active);
        expect(active.length).toBe(6);
        expect(new Set(active.map((m) => m.targetId)).size).toBe(2);
        expect(active.every((m) => m.damage === 100)).toBe(true);
        expect(c.ammo).toBe(ammo);
        expect(c.missiles.reserved).toBe(0);
        expect(new Set(active.map((m) => m.direction.x.toFixed(2))).size).toBe(3);
        c.reset();
        expect(c.storm.charge).toBe(0);
        expect(c.missiles.items.some((m) => m.active)).toBe(false);
    }
});
it('never guides a queued storm toward a reused enemy generation or neutral prop', () => {
    const c = new Combat(new Flight(), [], () => undefined),
        e = c.enemies[0];
    e.spawn('interceptor', new Vec3(0, 0, -250), c.ship.rotation);
    c.storm.charge = BULLETHELL.storm.charge;
    expect(c.activateStorm()).toBe(true);
    e.spawn('interceptor', new Vec3(0, 0, -250), c.ship.rotation);
    for (let i = 0; i < 120; i++) c.storm.step(1 / 120, c.ship, c.targets, c.missiles, () => undefined);
    expect(c.missiles.items.some((m) => m.active)).toBe(false);
    expect(c.missiles.reserved).toBe(0);
    c.storm.charge = 45;
    e.active = false;
    expect(c.activateStorm()).toBe(false);
    expect(c.storm.charge).toBe(45);
});
it('preserves charged energy when the bounded shared missile pool is busy and cancels on death', () => {
    const c = new Combat(new Flight(), [], () => undefined),
        e = c.enemies[0];
    e.spawn('heavy', new Vec3(0, 0, -200), c.ship.rotation);
    c.storm.charge = 45;
    for (let i = 0; i < 7; i++) c.missiles.launch(c.ship, e);
    expect(c.activateStorm()).toBe(false);
    expect(c.storm.charge).toBe(45);
    c.missiles.reset();
    expect(c.activateStorm()).toBe(true);
    c.hurtPlayer(9999, c.ship.position);
    expect(c.storm.pending).toBe(0);
    expect(c.missiles.reserved).toBe(0);
});
