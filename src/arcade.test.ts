import { Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { ARCADE } from './arcade-config';
import { Combat } from './combat';
import { CombatFlow } from './combat-flow';
import { Flight } from './flight';
import { Records } from './records';
import type { RunSummary } from './records';
import { WaveChallenge } from './wave-challenge';
describe('Combat Flow and skill challenges', () => {
    it('awards the configured bases and bonuses once, then increases Flow every three kills', () => {
        const f = new CombatFlow();
        for (let i = 0; i < 3; i++) f.kill(ARCADE.scoring.interceptor, false, 'INT');
        expect(f.score).toBe(375);
        expect(f.multiplier).toBe(1.5);
        expect(f.chain).toBe(3);
        f.kill(ARCADE.scoring.heavy, true, 'HEAVY');
        expect(f.lastReward).toBe(338);
        expect(f.score).toBe(713);
        for (let i = 0; i < 100; i++) f.kill(ARCADE.scoring.elite, false, 'ELITE');
        expect(f.multiplier).toBe(4);
        expect(f.longest).toBe(104);
    });
    it('shield damage drops one step; hull damage breaks the chain and clean bonus', () => {
        const f = new CombatFlow();
        for (let i = 0; i < 6; i++) f.kill(100, false, 'INT');
        expect(f.multiplier).toBe(2);
        f.damage(false);
        expect(f.multiplier).toBe(1.5);
        expect(f.chain).toBe(6);
        f.kill(100, false, 'INT');
        expect(f.lastReward).toBe(150);
        f.damage(true);
        expect(f.multiplier).toBe(1);
        expect(f.chain).toBe(0);
        f.kill(100, false, 'INT');
        expect(f.lastReward).toBe(100);
    });
    it('refreshes the window only on valid damage, freezes protected intervals, and expires fairly', () => {
        const f = new CombatFlow();
        f.kill(100, false, 'INT');
        f.step(7, true);
        expect(f.activity).toBe(1);
        f.step(50, false);
        expect(f.activity).toBe(1);
        f.hit();
        expect(f.activity).toBe(8);
        f.step(7.9, true);
        expect(f.chain).toBe(1);
        f.step(0.2, true);
        expect(f.chain).toBe(0);
        expect(f.longest).toBe(1);
    });
    it('tracks actual weapon accuracy, shield/hull damage and resets the entire run', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], () => undefined);
        c.countdown = 100;
        c.step(1 / 120, true);
        expect(c.flow.shots).toBe(2);
        c.flow.kill(100, false, 'INT');
        c.hurtPlayer(10, Vec3.ZERO);
        expect(c.flow.damageCount).toBe(1);
        ship.hull -= 10;
        c.observeHull();
        expect(c.flow.hullHits).toBe(1);
        expect(c.flow.chain).toBe(0);
        c.reset();
        expect(c.score).toBe(0);
        expect(c.flow.shots).toBe(0);
        expect(c.flow.damageCount).toBe(0);
    });
    it('freezes Flow during real wave recovery and protected boss transitions', () => {
        const ship = new Flight(),
            c = new Combat(ship, [], () => undefined);
        c.countdown = 100;
        c.flow.kill(100, false, 'INT');
        c.flow.activity = 1;
        for (let i = 0; i < 500; i++) c.step(1 / 120, false);
        expect(c.flow.activity).toBe(1);
        c.director.wave = 5;
        c.boss.spawn(ship, []);
        for (let i = 0; i < 100; i++) c.step(1 / 120, false);
        expect(c.flow.activity).toBe(1);
        c.boss.age = 4;
        c.boss.grace = 1;
        for (let i = 0; i < 60; i++) c.step(1 / 120, false);
        expect(c.flow.activity).toBe(1);
    });
    it('resolves deterministic wave goals once and supports opting out', () => {
        const f = new CombatFlow(),
            c = new WaveChallenge();
        c.begin(1, f, true);
        f.shots = 10;
        f.hits = 5;
        expect(c.finish(f)).toBe(true);
        expect(f.score).toBe(250);
        expect(c.finish(f)).toBe(false);
        expect(f.score).toBe(250);
        c.begin(2, f, true);
        f.damage(true);
        expect(c.finish(f)).toBe(false);
        c.begin(3, f, true);
        f.boostKills += 2;
        expect(c.finish(f)).toBe(true);
        c.begin(4, f, false);
        expect(c.finish(f)).toBe(false);
        c.begin(5, f, true);
        expect(c.enabled).toBe(false);
    });
});
describe('local run records', () => {
    const run: RunSummary = {
        score: 1000,
        wave: 5,
        cleared: 4,
        kills: 8,
        shots: 100,
        hits: 65,
        combo: 6,
        bossTime: null,
        bosses: 0,
        duration: 120,
        challenges: 1,
        ended: 'lost'
    };
    it('persists separate personal bests and the complete best individual run', () => {
        let value = '';
        const storage = {
            getItem: () => value,
            setItem: (_key: string, v: string) => {
                value = v;
            }
        };
        const r = new Records(storage);
        expect(r.save(run)).toEqual(['score', 'wave', 'combo']);
        r.save({ ...run, score: 500, wave: 6, combo: 3, bossTime: 50, bosses: 1 });
        const loaded = new Records(storage);
        expect(loaded.data.highScore).toBe(1000);
        expect(loaded.data.highWave).toBe(6);
        expect(loaded.data.longestCombo).toBe(6);
        expect(loaded.data.bestBossTime).toBe(50);
        expect(loaded.data.bestRun).toEqual(run);
        loaded.save({ ...run, bossTime: 40, bosses: 1 });
        expect(loaded.data.bestBossTime).toBe(40);
        expect(loaded.data.runs).toBe(3);
    });
    it('accepts legacy fields and handles corrupt or unavailable storage gracefully', () => {
        const legacy = new Records({
            getItem: () => '{"score":2500,"wave":3,"longestCombo":-1}',
            setItem: () => undefined
        });
        expect(legacy.data.highScore).toBe(2500);
        expect(legacy.data.highWave).toBe(3);
        expect(legacy.data.longestCombo).toBe(0);
        const bad = new Records({
            getItem: () => '{broken',
            setItem: () => {
                throw new Error('quota');
            }
        });
        expect(() => bad.save(run)).not.toThrow();
        expect(bad.data.highScore).toBe(1000);
        expect(bad.available).toBe(false);
    });
});
