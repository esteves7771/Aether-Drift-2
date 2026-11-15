import fs from 'node:fs';

import { test, expect } from '@playwright/test';
import type { Vec3 } from 'playcanvas';
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage E regular threats / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        const result = await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.combat.rocks.length = 0;
            const C = h.combat.enemies[0].position.constructor as typeof Vec3;
            for (const [i, _role] of ['veteran', 'heavy', 'sniper'].entries()) {
                const e = h.combat.enemies[i === 2 ? 3 : i];
                e.spawn(i ? 'heavy' : 'interceptor', new C((i - 1) * 65, 20, -270), h.flight.rotation);
                if (!i) e.tier = 'veteran';
                if (i === 2) e.sniper = true;
                e.state = 'attack';
                e.age = 4;
                e.cooldown = 0;
            }
            h.advance(100);
            return {
                tells: h.combat.enemyPatterns.tells,
                shots: h.combat.enemyPatterns.salvos,
                pool: h.combat.projectiles.items.length
            };
        });
        expect(result.tells).toBeGreaterThan(0);
        expect(result.shots).toBeGreaterThan(0);
        expect(result.pool).toBe(240);
        fs.mkdirSync('artifacts/phase5g-eh', { recursive: true });
        await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-regular-threats.png` });
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage F Phantom encounter / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.combat.rocks.length = 0;
            h.combat.director.wave = 10;
            h.combat.phantom.spawn(h.flight, []);
            h.advance(65);
        });
        await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-phantom-rift.png` });
        const result = await page.evaluate(() => {
            const h = __phase4,
                b = h.combat.phantom,
                kinds = new Set<string>();
            h.advance(100);
            for (let phase = 1; phase <= 3; phase++) {
                b.phase = phase;
                b.grace = 0;
                b.patterns.reset(phase);
                for (let i = 0; i < 800; i++) {
                    b.step(0.05, h.flight, [], h.combat.projectiles);
                    kinds.add(b.patterns.kind);
                    for (const p of h.combat.projectiles.items) p.active = false;
                }
            }
            b.parts[0].exposed = true;
            const killed = b.damage(b.parts[0], 99999);
            return { kinds: [...kinds], arriving: b.arriving, killed, dying: b.dying };
        });
        expect(result.arriving).toBe(false);
        expect(result.kinds).toContain('finale');
        expect(result.kinds).toContain('cross');
        expect(result.killed).toBe(true);
        expect(result.dying).toBeGreaterThan(0);
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage G Tesser spatial encounter / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        await page.evaluate(async () => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.combat.rocks.length = 0;
            h.combat.director.wave = 15;
            await h.modelLibrary.load('tesser');
            h.combat.guardian.spawn(h.flight, []);
            h.advance(150);
        });
        await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-tesser-rift.png` });
        const result = await page.evaluate(() => {
            const h = __phase4,
                b = h.combat.guardian,
                kinds = new Set<string>();
            h.advance(140);
            for (let phase = 1; phase <= 3; phase++) {
                b.phase = phase;
                b.grace = 0;
                b.patterns.reset(phase);
                for (let i = 0; i < 1000; i++) {
                    b.step(0.05, h.flight, [], h.combat.projectiles);
                    kinds.add(b.patterns.kind);
                    for (const p of h.combat.projectiles.items) p.active = false;
                }
            }
            return { kinds: [...kinds], arriving: b.arriving, phase: b.phase };
        });
        expect(result.arriving).toBe(false);
        expect(result.kinds).toContain('sphere');
        expect(result.kinds).toContain('cross');
        expect(result.kinds).toContain('finale');
        await page.keyboard.press('c');
        await page.evaluate(() => __phase4.advance(1));
        await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-tesser-cockpit.png` });
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    for (const wave of [10, 15])
        test('actual laser victory wave ' + wave + ' / ' + renderer, async ({ page, baseURL }) => {
            test.setTimeout(240000);
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            page.on('console', (m) => {
                if (m.type() === 'error') errors.push(m.text());
            });
            await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
            await page.locator('#launch').click();
            await page.evaluate((w) => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.combat.countdown = 1000;
                h.combat.director.wave = w;
                h.combat.director.group = 1;
                h.combat.boss.spawn(h.flight, h.rocks);
                h.pilot = true;
                h.useAbilities = false;
            }, wave);
            await page.keyboard.down('Space');
            const phases = new Set<number>(),
                kinds = new Set<string>(),
                captures = new Set<string>();
            let win = false,
                last: unknown,
                peak = 0;
            for (let i = 0; i < 1400; i++) {
                const s = await page.evaluate(() => {
                    const h = __phase4;
                    h.advance(10);
                    const b = h.combat.boss;
                    return {
                        phase: b.phase,
                        kind: b.patterns.kind,
                        state: b.patterns.state,
                        time: b.patterns.time,
                        age: b.age,
                        health: b.health,
                        active: b.active,
                        arriving: b.arriving,
                        hull: h.flight.hull,
                        shots: h.combat.projectiles.items.filter((p) => p.active && p.hostile).length,
                        hits: h.combat.playerHits,
                        parts: b.parts.map((p) => p.health),
                        score: h.combat.score
                    };
                });
                last = s;
                phases.add(s.phase);
                peak = Math.max(peak, s.shots);
                if (!s.arriving) kinds.add(s.kind);
                if (!s.arriving && s.state === 'fire' && s.time > 0.3 && !captures.has(s.kind)) {
                    captures.add(s.kind);
                    await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-wave${wave}-${s.kind}.png` });
                }
                if (s.phase === 3 && !captures.has('phase3')) {
                    captures.add('phase3');
                    await page.keyboard.press('c');
                    await page.evaluate(() => __phase4.advance(3));
                    await page.locator('#cockpit-art').evaluate((img: HTMLImageElement) => img.decode());
                    await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-wave${wave}-phase3-cockpit.png` });
                }
                if (s.phase === 3 && s.state === 'fire' && s.time > 0.3 && !captures.has('cockpit-attack')) {
                    captures.add('cockpit-attack');
                    await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-wave${wave}-cockpit-attack.png` });
                }
                if (s.hull <= 0) break;
                if (!s.active) {
                    win = true;
                    break;
                }
            }
            fs.writeFileSync(
                `artifacts/phase5g-eh/${renderer}-wave${wave}-victory.json`,
                JSON.stringify({ win, peak, phases: [...phases], kinds: [...kinds], last }, null, 2)
            );
            if (win) {
                await page.keyboard.up('Space');
                await page.evaluate(() => __phase4.advance(60));
                await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-wave${wave}-destruction.png` });
            }
            expect(win, JSON.stringify(last)).toBe(true);
            expect([...phases]).toEqual([1, 2, 3]);
            expect(peak).toBeLessThanOrEqual(96);
            expect(errors).toEqual([]);
        });
for (const renderer of ['webgpu', 'webgl2'])
    test('abilities pause reset and quality / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        for (const wave of [10, 15]) {
            const result = await page.evaluate((w) => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.combat.countdown = 1000;
                h.combat.director.wave = w;
                h.combat.boss.spawn(h.flight, []);
                h.combat.boss.arrival.stage = 'combat';
                h.combat.boss.grace = 0;
                const b = h.combat.boss;
                b.position.copy(h.flight.position);
                b.position.z -= 130;
                b.previous.copy(b.position);
                b.patterns.interrupt();
                b.step(0.01, h.flight, [], h.combat.projectiles);
                const p = b.parts.find((p) => p.targetable)!;
                h.combat.selected = p.id;
                h.combat.rocks.length = 0;
                const dir = p.position.clone().sub(h.flight.position).normalize(),
                    axis = dir.clone().set(dir.y, -dir.x, 0);
                if (axis.lengthSq() > 0.00001)
                    h.flight.rotation.setFromAxisAngle(axis.normalize(), (Math.acos(-dir.z) * 180) / Math.PI);
                h.flight.previousRotation.copy(h.flight.rotation);
                const before = h.combat.ammo;
                h.combat.launchMissile();
                const launched = h.combat.ammo === before - 1;
                const emp = h.combat.emp();
                return { launched, emp, disrupted: b.disrupted, slots: h.combat.enemies.length };
            }, wave);
            expect(result.launched, JSON.stringify({ wave, ...result })).toBe(true);
            expect(result.disrupted).toBeGreaterThan(0);
            expect(result.slots).toBe(8);
            if (!(await page.evaluate(() => __phase4.pilotCamera.cockpit))) await page.keyboard.press('c');
            await page.evaluate(() => __phase4.advance(3));
            await expect(page.locator('#cockpit')).toBeVisible();
            await page.keyboard.press('Escape');
            const frozen = await page.evaluate(() => {
                const h = __phase4,
                    b = h.combat.boss;
                const age = b.age;
                h.advance(10);
                return age === b.age;
            });
            expect(frozen).toBe(true);
            await page.locator('#launch').click();
            await page.keyboard.press('r');
            await expect(page.locator('#restart-confirm')).toBeVisible();
            await page.locator('#restart-cancel').click();
            await page.evaluate(() => {
                const h = __phase4;
                h.combat.reset();
                h.combat.countdown = 1000;
                h.input.clear();
            });
            expect(await page.evaluate(() => __phase4.combat.projectiles.items.filter((p) => p.active).length)).toBe(0);
        }
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage H late-wave pressure and presets / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.director.wave = 19;
            h.combat.countdown = 0;
            h.advance(80);
        });
        const state = await page.evaluate(() => {
            const c = __phase4.combat;
            return {
                quota: c.director.total,
                active: c.enemies.filter((e) => e.active).length,
                pool: c.enemies.length,
                reserves: c.director.reserves,
                roles: c.enemies.filter((e) => e.active).map((e) => e.label)
            };
        });
        expect(state.quota).toBe(15);
        expect(state.active).toBeLessThanOrEqual(7);
        expect(state.reserves).toBeGreaterThan(0);
        expect(state.pool).toBe(8);
        await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-late-mixed-wave19.png` });
        for (const quality of ['low', 'medium', 'high']) {
            await page.keyboard.press('Escape');
            await page.locator('#show-settings').click();
            const before = await page.evaluate(() => ({
                age: __phase4.combat.duration,
                shots: __phase4.combat.projectiles.fired
            }));
            await page.locator('#graphics').selectOption(quality);
            expect(
                await page.evaluate(() => ({ age: __phase4.combat.duration, shots: __phase4.combat.projectiles.fired }))
            ).toEqual(before);
            await page.keyboard.press('Escape');
            await page.locator('#launch').click();
            await page.evaluate(() => __phase4.advance(2));
            await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-late-${quality}.png` });
        }
        const metrics = await page.evaluate(async () => {
            const h = __phase4,
                counts: number[] = [],
                frames: number[] = [],
                cpu: number[] = [],
                draws: number[] = [];
            let old = performance.now();
            h.app.timeScale = 1;
            await new Promise<void>((resolve) => {
                let n = 0;
                const fn = () => {
                    const now = performance.now();
                    frames.push(now - old);
                    old = now;
                    counts.push(h.combat.projectiles.items.filter((p) => p.active && p.hostile).length);
                    cpu.push(h.app.stats.frame.updateTime);
                    draws.push(h.app.stats.drawCalls.total);
                    if (++n === 50) {
                        h.app.off('frameend', fn);
                        resolve();
                    }
                };
                h.app.on('frameend', fn);
            });
            h.app.timeScale = 0;
            return {
                frames,
                cpu,
                draws,
                peak: Math.max(...counts),
                entities: h.app.root.findComponents('render').length
            };
        });
        const resets: number[] = [];
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => {
                const h = __phase4;
                h.combat.reset();
                h.combat.director.wave = 19;
                h.combat.countdown = 0;
                h.advance(80);
            });
            await page.waitForTimeout(150);
            resets.push(await page.evaluate(() => __phase4.app.root.findComponents('render').length));
        }
        expect(new Set(resets).size).toBe(1);
        fs.writeFileSync(
            `artifacts/phase5g-eh/${renderer}-late-metrics.json`,
            JSON.stringify({ ...metrics, resets }, null, 2)
        );
        expect(metrics.peak).toBeLessThanOrEqual(60);
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('offscreen capital anticipation / ' + renderer, async ({ page, baseURL }) => {
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.combat.director.wave = 15;
            const b = h.combat.guardian;
            b.spawn(h.flight, []);
            b.arrival.stage = 'combat';
            b.position.set(0, 0, -400);
            b.previous.copy(b.position);
            b.patterns.reset(3);
            b.phase = 3;
            b.grace = 0;
            h.flight.rotation.setFromEulerAngles(0, 180, 0);
            h.flight.previousRotation.copy(h.flight.rotation);
            h.pilotCamera.cockpit = true;
            h.advance(3);
        });
        const marker = page.locator('.enemy-marker[data-capital="true"].offscreen.charging-threat');
        await expect(marker.locator('i')).toBeVisible();
        expect(await marker.count()).toBe(1);
        await page.screenshot({ path: `artifacts/phase5g-eh/${renderer}-offscreen-capital-cue.png` });
    });
