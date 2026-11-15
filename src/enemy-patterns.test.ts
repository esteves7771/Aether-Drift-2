import { Quat, Vec3 } from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { Enemy } from './enemy';
import { EnemyPatterns } from './enemy-patterns';
import { Flight } from './flight';
import { Projectiles } from './projectiles';
describe('ordinary shared patterns', () => {
    for (const role of ['standard', 'veteran', 'elite', 'heavy', 'sniper'] as const)
        it(role + ' anticipates, releases and recovers', () => {
            const e = new Enemy(role === 'sniper' ? 3 : 1),
                ship = new Flight(),
                shots = new Projectiles(),
                patterns = new EnemyPatterns();
            e.spawn(
                role === 'heavy' || role === 'sniper' ? 'heavy' : 'interceptor',
                new Vec3(0, 0, 250),
                new Quat(),
                role === 'elite'
            );
            e.sniper = role === 'sniper';
            if (role === 'veteran') e.tier = 'veteran';
            e.state = 'attack';
            e.age = 3;
            e.cooldown = 0;
            patterns.step(0.01, e, ship, shots, [e], () => undefined);
            expect(shots.fired).toBe(0);
            expect(e.attackCue).toBe(true);
            for (let i = 0; i < 400; i++) patterns.step(0.01, e, ship, shots, [e], () => undefined);
            expect(shots.fired).toBe(role === 'sniper' ? 1 : role === 'standard' ? 3 : 5);
            expect(e.state).toBe('reposition');
            if (role === 'heavy' || role === 'veteran')
                expect(
                    new Set(shots.items.filter((p) => p.active).map((p) => p.velocity.y.toFixed(2))).size
                ).toBeGreaterThan(1);
        });
    it('one complex anticipation at a time; EMP cancels safely', () => {
        const a = new Enemy(1),
            b = new Enemy(2),
            p = new EnemyPatterns(),
            f = new Flight(),
            s = new Projectiles();
        for (const e of [a, b]) {
            e.spawn('heavy', new Vec3(0, 0, 250), new Quat());
            e.state = 'attack';
            e.age = 3;
            e.cooldown = 0;
        }
        p.step(0.01, a, f, s, [a, b], () => undefined);
        p.step(0.01, b, f, s, [a, b], () => undefined);
        expect(a.patternState).toBe('telegraph');
        expect(b.patternState).toBe('idle');
        a.disrupted = 1;
        p.step(0.1, a, f, s, [a, b], () => undefined);
        expect(a.patternState).toBe('idle');
        expect(s.fired).toBe(0);
    });
});
