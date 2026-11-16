import { expect, it } from 'vitest';

import { Combat } from './combat';
import { Flight } from './flight';
it('boss escorts use finite reusable slots and stop when the boss dies', () => {
    const c = new Combat(new Flight(), [], () => undefined);
    c.director.wave = 5;
    c.dreadnought.spawn(c.ship, []);
    c.dreadnought.arrival.stage = 'combat';
    c.defenseFleet.begin();
    for (let i = 0; i < 10; i++) c.defenseFleet.step(0.2, c.allBosses, c.enemies, c.ship, []);
    expect(c.enemies.filter((e) => e.active && e.escortOwner >= 0).length).toBe(2);
    c.defenseFleet.coordinate(c.enemies, c.allBosses);
    expect(c.enemies.filter((e) => e.active).every((e) => !e.canFire)).toBe(true);
    c.dreadnought.active = false;
    c.defenseFleet.step(0.1, c.allBosses, c.enemies, c.ship, []);
    expect(c.enemies.some((e) => e.active)).toBe(false);
    expect(c.defenseFleet.deployed).toBe(2);
});
