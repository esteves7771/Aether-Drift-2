import { describe, expect, it } from 'vitest';

import { field } from './collisions';
import { Combat } from './combat';
import { COMBAT } from './combat-config';
import { Flight, neutral } from './flight';
import { RunUpgrades, UPGRADES } from './run-upgrades';
import { WaveDirector } from './wave-director';

describe('Run refits and tactical escalation', () => {
    it('locks a visible charged plasma attack and assigns a carrier a nearby strongpoint', () => {
        const ship = new Flight(),
            c = new Combat(ship, field(), () => undefined);
        c.director.wave = 8;
        c.director.group = 1;
        c.countdown = 100;
        c.squadron.time = 4;
        const e = c.enemies[2];
        e.spawn('heavy', ship.position.clone().set(0, 60, -180), ship.rotation);
        e.rotation.setFromEulerAngles(0, 180, 0);
        e.state = 'attack';
        e.age = 3;
        e.cooldown = 0;
        c.step(0.01, false);
        expect(e.patternState).toBe('telegraph');
        expect(e.attackCue).toBe(true);
        const aim = e.lockedAim.clone();
        ship.position.x = 40;
        c.step(0.01, false);
        expect(e.lockedAim.equals(aim)).toBe(true);
        for (let n = 0; n < 200; n++) c.step(0.01, false);
        expect(c.projectiles.items.some((p) => p.plasma)).toBe(true);
        // Locate a real weighted defense template rather than replacing its getter.
        search: for (let wave = 9; wave < 25; wave++)
            for (let group = 1; group <= 3; group++) {
                c.director.wave = wave;
                c.director.group = group;
                if (c.director.encounter?.name === 'CARRIER STRONGPOINT') break search;
            }
        const b = c.frontier.bases[0];
        b.rotation.transformVector(ship.position.set(0, 150, 0), ship.position).add(b.rock.position);
        e.spawn('carrier', ship.position.clone().add(ship.position.clone().set(100, 0, -100)), ship.rotation);
        c.step(0.01, false);
        expect(c.director.encounter?.name).toBe('CARRIER STRONGPOINT');
        {
            expect(e.order).toBe('formation');
            expect(e.goal.distance(b.rock.position)).toBeLessThan(200);
        }
    });
    it('offers three distinct bounded choices once at a milestone and validates picks', () => {
        const u = new RunUpgrades();
        expect(u.offer(1)).toBe(false);
        expect(u.offer(2)).toBe(true);
        expect(new Set(u.offers).size).toBe(3);
        expect(u.choose(99)).toBe(false);
        const i = u.offers[0];
        expect(u.choose(i)).toBe(true);
        expect(u.choose(i)).toBe(false);
        expect(u.offer(2)).toBe(false);
        for (const wave of [5, 8, 10, 13]) {
            expect(u.offer(wave)).toBe(true);
            expect(u.offers.every((n) => u.ranks[n] < UPGRADES[n].maximum)).toBe(true);
            u.choose(u.offers[0]);
        }
        expect(u.selections).toBe(5);
        expect([...u.ranks].every((n) => n <= 2)).toBe(true);
        u.reset();
        expect(u.pending).toBe(false);
        expect([...u.ranks].every((n) => n === 0)).toBe(true);
        expect(u.offer(2)).toBe(true);
    });
    it('freezes combat during selection, applies only run-local modifiers, and resets', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], () => undefined);
        c.countdown = 100;
        c.upgrades.offer(2);
        c.step(1, true);
        expect(c.duration).toBe(0);
        expect(c.projectiles.fired).toBe(0);
        c.chooseUpgrade(c.upgrades.offers[0]);
        // A legal next milestone offers laser after two prior picks.
        c.upgrades.offer(5);
        c.chooseUpgrade(c.upgrades.offers[0]);
        c.upgrades.offer(8);
        expect(c.upgrades.offers).toContain(0);
        c.chooseUpgrade(0);
        c.step(0.01, true);
        const p = c.projectiles.items.find((p) => p.active)!;
        expect(p.damage).toBeCloseTo(COMBAT.player.damage * 1.12);
        expect(COMBAT.player.damage).toBe(14);
        c.upgrades.offer(10);
        const choice = c.upgrades.offers.find((i) => i === 1) ?? c.upgrades.offers[0];
        c.chooseUpgrade(choice);
        expect(c.ammo).toBeLessThanOrEqual(c.ammoCapacity);
        c.reset();
        expect(c.ammoCapacity).toBe(6);
        expect(ship.boostEfficiency).toBe(1);
        expect(c.upgrades.selections).toBe(0);
    });
    it('boost efficiency improves duration without changing normal speed or physics', () => {
        const a = new Flight(),
            b = new Flight(),
            cmd = neutral();
        cmd.z = -1;
        cmd.boost = true;
        b.boostEfficiency = 0.7;
        for (let i = 0; i < 120; i++) {
            a.step(cmd, 1 / 120, true);
            b.step(cmd, 1 / 120, true);
        }
        expect(b.energy).toBeGreaterThan(a.energy);
        expect(b.position.equals(a.position)).toBe(true);
    });
    it('introduces new tactics gradually without increasing pool capacity or introducing late roles early', () => {
        const d = new WaveDirector();
        const seen = new Set<string>();
        d.wave = 1;
        expect(d.encounter).toBe(null);
        d.wave = 5;
        expect(d.encounter).toBe(null);
        for (let wave = 8; wave <= 30; wave++)
            for (let group = 1; group <= 3; group++) {
                d.wave = wave;
                d.group = group;
                if (d.encounter) {
                    seen.add(d.encounter.name);
                    expect(d.encounter.minWave).toBeLessThanOrEqual(wave);
                    expect(d.size).toBeLessThanOrEqual(7);
                }
            }
        expect(seen.has('BASTION BOMBER WING')).toBe(true);
        expect(seen.has('CARRIER STRONGPOINT')).toBe(true);
        expect(seen.has('CROSS-VECTOR ASSAULT')).toBe(true);
    });
});
