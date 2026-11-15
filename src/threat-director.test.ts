import { describe, expect, it } from 'vitest';

import { Combat } from './combat';
import { Flight } from './flight';
import { waveHealth, wavePopulation } from './threat-config';
import { WaveDirector } from './wave-director';
describe('quota-driven wave pressure', () => {
    it('builds 3/3/5/5 onboarding and bounded stepped later quotas with bounded active attackers', () => {
        const d = new WaveDirector();
        for (const [w, total] of [
            [1, 3],
            [2, 3],
            [3, 5],
            [4, 5],
            [6, 7],
            [7, 7],
            [8, 9],
            [9, 9],
            [30, 30]
        ]) {
            d.wave = w;
            if (w % 5 === 0) continue;
            expect(d.total).toBe(total);
            expect(d.activeLimit).toBeLessThanOrEqual(7);
            expect(d.attackers).toBeLessThanOrEqual(5);
            expect(d.size).toBeLessThanOrEqual(7);
        }
        expect(wavePopulation(1000)).toBe(30);
    });
    it('reinforces an ongoing battle and clears only when its full quota is deployed and defeated', () => {
        const d = new WaveDirector();
        d.wave = 3;
        d.countdown = 0;
        expect(d.step(0.01, 0)).toBe('squad');
        expect(d.size).toBe(4);
        d.commitSpawn(4);
        expect(d.deployed).toBe(4);
        expect(d.step(5, 2)).toBe('squad');
        expect(d.size).toBe(1);
        expect(d.cleared).toBe(false);
        d.commitSpawn(1);
        expect(d.reserves).toBe(0);
        d.step(0.01, 3);
        expect(d.cleared).toBe(false);
        d.step(0.01, 0);
        expect(d.cleared).toBe(true);
        expect(d.stage).toBe('clear');
        d.step(0.01, 0);
        expect(d.cleared).toBe(false);
    });
    it('retries failed safe-spawn attempts without spending quota or skipping waves', () => {
        const d = new WaveDirector();
        d.countdown = 0;
        expect(d.step(0.01, 0)).toBe('squad');
        d.commitSpawn(0);
        expect(d.deployed).toBe(0);
        expect(d.reserves).toBe(3);
        expect(d.step(0.5, 0)).toBe('none');
        expect(d.step(0.6, 0)).toBe('squad');
        expect(d.wave).toBe(1);
        expect(d.group).toBe(1);
    });
    it('never overwrites active ship generations when reinforcements arrive', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], () => undefined);
        c.director.wave = 3;
        c.countdown = 0;
        c.step(0.01, false);
        expect(c.remaining).toBe(4);
        c.enemies[0].active = c.enemies[1].active = false;
        const generations = c.enemies.slice(2, 4).map((e) => e.generation);
        for (let i = 0; i < 510; i++) c.step(0.01, false);
        expect(c.director.deployed).toBe(5);
        expect(c.enemies.slice(2, 4).map((e) => e.generation)).toEqual(generations);
        expect(c.enemies.length).toBe(8);
    });
    it('scales selected late heavy/elite durability without blanket early or player changes', () => {
        expect(waveHealth(4, 'heavy', false)).toBe(1);
        expect(waveHealth(20, 'interceptor', false)).toBe(1);
        expect(waveHealth(20, 'heavy', false)).toBeGreaterThan(1.3);
        expect(waveHealth(20, 'interceptor', true)).toBeGreaterThan(1.3);
        expect(waveHealth(1000, 'bomber', false)).toBe(1.6);
    });
    it('retains the every-fifth-wave boss rotation and reset state', () => {
        const d = new WaveDirector();
        for (const w of [5, 10, 15, 20]) {
            d.wave = w;
            expect(d.encounter).toBeNull();
            expect(d.groupCount).toBe(1);
            expect(d.size).toBe(0);
        }
        d.reset();
        expect(d.wave).toBe(0);
        expect(d.deployed).toBe(0);
        expect(d.group).toBe(0);
    });
});
it('advances Waves 1–24 with exact quotas, bounded slots and recurring bosses', () => {
    const d = new WaveDirector(),
        seen = new Set<number>();
    let alive = 0,
        issued = 0;
    for (let tick = 0; tick < 30000 && d.wave < 25; tick++) {
        const order = d.step(0.1, alive);
        seen.add(d.wave);
        if (order === 'boss') {
            alive = 1;
            issued = 0;
        }
        if (order === 'squad') {
            const n = d.size;
            expect(n + alive).toBeLessThanOrEqual(d.activeLimit);
            issued += n;
            alive += n;
            d.commitSpawn(n);
        }
        if (tick % 15 === 0 && alive > 0) alive--;
        if (d.cleared && d.wave % 5 !== 0) expect(issued).toBe(d.total);
        if (d.cleared) issued = 0;
    }
    expect([...seen]).toContain(24);
    expect(d.wave).toBe(25);
});
