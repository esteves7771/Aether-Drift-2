import fs from 'node:fs';

import { expect, test } from '@playwright/test';
import type { MeshInstance } from 'playcanvas';
const before = process.env.AE_A0_BEFORE === '1';
for (const renderer of before ? ['webgpu'] : ['webgpu', 'webgl2'])
    test('A0 cockpit framing and layering / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        fs.mkdirSync('artifacts/phase5g', { recursive: true });
        for (const ship of ['classic', 'surveyor']) {
            if (ship === 'surveyor') {
                await page.locator('#ship-surveyor').click();
                await expect(page.locator('#ship-surveyor')).toHaveAttribute('aria-pressed', 'true');
            }
            await page.locator('#launch').click();
            await page.evaluate(() => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.combat.countdown = 1000;
                h.advance(3);
            });
            if (!(await page.evaluate(() => __phase4.pilotCamera.cockpit))) {
                await page.keyboard.press('c');
                await page.evaluate(() => __phase4.advance(3));
            }
            await page.locator('#cockpit-art').evaluate((i: HTMLImageElement) => i.decode());
            for (const [width, height] of [
                [1920, 1080],
                [1280, 720],
                [1600, 1000],
                [1920, 996]
            ]) {
                await page.setViewportSize({ width, height });
                await page.evaluate(() => __phase4.advance(3));
                await page.screenshot({
                    path: `artifacts/phase5g/${renderer}-${before ? 'before' : 'after'}-${ship}-${width}x${height}.png`
                });
                if (!before) {
                    const layout = await page.evaluate(() => {
                        const r = document.querySelector('.cockpit-deck')!.getBoundingClientRect();
                        return {
                            left: r.left,
                            right: r.right,
                            ratio: r.width / r.height,
                            inside: [...document.querySelectorAll('.instrument')].every((e) => {
                                const r = e.getBoundingClientRect();
                                return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
                            })
                        };
                    });
                    expect(layout.left).toBeLessThanOrEqual(0.5);
                    expect(layout.right).toBeGreaterThanOrEqual(width - 0.5);
                    expect(layout.ratio).toBeCloseTo(1672 / 941, 2);
                    expect(layout.inside).toBe(true);
                    const alignment = await page.evaluate(() => {
                        const h = __phase4,
                            cam = h.chase.entity,
                            p = h.flight.position.clone(),
                            forward = p.clone().set(0, 0, -2000);
                        h.flight.rotation.transformVector(forward, forward);
                        p.add(forward);
                        const s = cam.camera!.worldToScreen(p),
                            r = document.querySelector('.reticle')!.getBoundingClientRect();
                        return {
                            screen: [s.x, s.y],
                            reticle: [r.x + r.width / 2, r.y + r.height / 2],
                            height: innerHeight,
                            angle: Math.abs(cam.getRotation().dot(h.flight.rotation))
                        };
                    });
                    expect(Math.abs(alignment.screen[0] - alignment.reticle[0])).toBeLessThan(1);
                    expect(Math.abs(alignment.screen[1] - alignment.reticle[1])).toBeLessThan(1);
                    expect(alignment.screen[1] / height).toBeLessThan(0.48);
                    expect(alignment.angle).toBeCloseTo(1, 4);
                }
            }
            const state = await page.evaluate(() => ({
                position: __phase4.flight.position.toString(),
                velocity: __phase4.flight.velocity.toString(),
                duration: __phase4.combat.duration,
                ship: __phase4.hangar.selected,
                cockpit: __phase4.pilotCamera.cockpit
            }));
            await page.keyboard.press('Escape');
            await page.evaluate(() => __phase4.advance(3));
            await page.screenshot({
                path: `artifacts/phase5g/${renderer}-${before ? 'before' : 'after'}-${ship}-pause.png`
            });
            if (!before) {
                await expect(page.locator('#cockpit')).toBeHidden();
                await expect(page.locator('.reticle')).toBeHidden();
                await expect(page.locator('#launch')).toBeVisible();
                await page.evaluate(() => __phase4.advance(10));
                expect(
                    await page.evaluate(() => ({
                        position: __phase4.flight.position.toString(),
                        velocity: __phase4.flight.velocity.toString(),
                        duration: __phase4.combat.duration,
                        ship: __phase4.hangar.selected,
                        cockpit: __phase4.pilotCamera.cockpit
                    }))
                ).toEqual(state);
            }
            await page.locator('#launch').click();
            await page.evaluate(() => __phase4.advance(3));
            await expect(page.locator('#cockpit')).toBeVisible();
            await page.keyboard.press('r');
            await page.evaluate(() => __phase4.advance(2));
            await expect(page.locator('#restart-confirm')).toBeVisible();
            if (!before) await expect(page.locator('#cockpit')).toBeHidden();
            await page.screenshot({
                path: `artifacts/phase5g/${renderer}-${before ? 'before' : 'after'}-${ship}-restart.png`
            });
            await page.locator('#restart-cancel').click();
            await page.evaluate(() => __phase4.advance(3));
            await expect(page.locator('#cockpit')).toBeVisible();
            await page.keyboard.press('Escape');
            await page.evaluate(() => __phase4.advance(2));
        }
        expect(errors).toEqual([]);
    });

if (!before)
    for (const renderer of ['webgpu', 'webgl2'])
        test('boss damage, death soundtrack hook and retry / ' + renderer, async ({ page, baseURL }) => {
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
            await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
            await page.locator('#launch').click();
            await page.evaluate(() => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.combat.countdown = 1000;
                h.combat.director.wave = 5;
                h.flight.position.set(0, 1500, 0);
                h.flight.previous.copy(h.flight.position);
                h.chase.reset();
                h.combat.boss.spawn(h.flight, h.combat.rocks);
            });
            let died = false;
            for (let i = 0; i < 200; i++) {
                const hull = await page.evaluate(() => {
                    __phase4.advance(20);
                    return __phase4.flight.hull;
                });
                if (hull <= 0) {
                    died = true;
                    break;
                }
            }
            expect(died).toBe(true);
            await expect(page.locator('#menu')).toHaveAttribute('data-screen', 'debrief');
            await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'death');
            await expect(page.locator('#cockpit')).toBeHidden();
            await page.screenshot({ path: `artifacts/phase5g/${renderer}-boss-player-death.png` });
            await page.locator('#retry').click();
            await page.evaluate(() => {
                __phase4.combat.countdown = 1000;
                __phase4.advance(2);
            });
            expect(await page.evaluate(() => __phase4.flight.hull)).toBe(100);
            expect(await page.evaluate(() => __phase4.combat.dreadnought.arrival.radius)).toBe(0);
            await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
            expect(errors).toEqual([]);
        });

if (!before)
    for (const renderer of ['webgpu', 'webgl2'])
        test('Stage A imported artillery / ' + renderer, async ({ page, baseURL }) => {
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            page.on('console', (m) => {
                if (m.type() === 'error') errors.push(m.text());
            });
            await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
            await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
            expect(await page.evaluate(() => __phase4.app.assets.find('Imported artillery')?.loaded)).toBeFalsy();
            await page.locator('#launch').click();
            await page.evaluate(() => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.combat.countdown = 1000;
                h.flight.position.set(0, 1500, 0);
                h.flight.previous.copy(h.flight.position);
                h.chase.reset();
                h.combat.dreadnought.spawn(h.flight, h.combat.rocks);
                h.advance(340);
            });
            await page.waitForFunction(() => __phase4.app.assets.find('Imported artillery')?.loaded);
            await page.evaluate(() => __phase4.advance(3));
            const model = await page.evaluate(() => {
                const h = __phase4,
                    root = h.app.root.findByName('Artillery Dreadnought')!,
                    model = root.findByName('Imported artillery')!;
                const lo = [Infinity, Infinity, Infinity],
                    hi = [-Infinity, -Infinity, -Infinity];
                for (const c of model.findComponents('render'))
                    for (const mi of (c as unknown as { meshInstances: MeshInstance[] }).meshInstances) {
                        const a = mi.aabb;
                        [a.center.x, a.center.y, a.center.z].forEach((v, i) => {
                            const r = [a.halfExtents.x, a.halfExtents.y, a.halfExtents.z][i];
                            lo[i] = Math.min(lo[i], v - r);
                            hi[i] = Math.max(hi[i], v + r);
                        });
                    }
                return {
                    visible: root.enabled,
                    dimensions: hi.map((v, i) => v - lo[i]),
                    health: h.combat.boss.health,
                    parts: h.combat.boss.parts.filter((p) => p.targetable).length
                };
            });
            expect(model.visible).toBe(true);
            expect(Math.max(...model.dimensions)).toBeGreaterThan(220);
            expect(Math.max(...model.dimensions)).toBeLessThan(300);
            expect(model.health).toBe(4400);
            expect(model.parts).toBe(2);
            fs.mkdirSync('artifacts/phase5g', { recursive: true });
            await page.screenshot({ path: `artifacts/phase5g/${renderer}-artillery-integrated-chase.png` });
            await page.keyboard.press('c');
            await page.evaluate(() => __phase4.advance(3));
            await page.locator('#cockpit-art').evaluate((i: HTMLImageElement) => i.decode());
            await page.screenshot({ path: `artifacts/phase5g/${renderer}-artillery-integrated-cockpit.png` });
            expect(errors).toEqual([]);
        });

if (!before)
    for (const renderer of ['webgpu', 'webgl2'])
        test('Stage B gravitational arrival / ' + renderer, async ({ page, baseURL }) => {
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            page.on('console', (m) => {
                if (m.type() === 'error') errors.push(m.text());
            });
            await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
            await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
            await page.locator('#launch').click();
            await page.evaluate(() => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.combat.director.wave = 4;
                h.combat.countdown = 1000;
                h.advance(2);
            });
            await page.waitForFunction(() => __phase4.app.assets.find('Imported artillery')?.loaded);
            const spawn = await page.evaluate(() => {
                const h = __phase4,
                    c = h.combat;
                c.director.wave = 5;
                c.boss.spawn(h.flight, c.rocks);
                h.advance(1);
                const a = c.dreadnought.arrival;
                return {
                    safe: a.corridorClear(a.anchor, a.normal, c.rocks, h.flight.position),
                    stage: a.stage,
                    anchor: a.anchor.toString()
                };
            });
            expect(spawn.safe).toBe(true);
            expect(spawn.stage).toBe('gather');
            fs.mkdirSync('artifacts/phase5g', { recursive: true });
            for (const [name, ticks] of [
                ['gather', 19],
                ['form', 61],
                ['emerge', 60],
                ['collapse', 68],
                ['combat', 43]
            ] as const) {
                const state = await page.evaluate((ticks) => {
                    const h = __phase4;
                    h.advance(ticks);
                    const b = h.combat.dreadnought,
                        a = b.arrival,
                        screen = h.chase.entity.camera!.worldToScreen(a.anchor);
                    return {
                        stage: a.stage,
                        age: a.age,
                        radius: a.radius,
                        arriving: b.arriving,
                        targetable: b.parts.some((p) => p.targetable),
                        health: b.health,
                        screen: [screen.x, screen.y]
                    };
                }, ticks);
                expect(state.stage).toBe(name);
                if (name !== 'combat') {
                    expect(state.targetable).toBe(false);
                    expect(state.health).toBe(4400);
                } else expect(state.arriving).toBe(false);
                if (name === 'form') {
                    expect(state.screen[0]).toBeGreaterThan(0);
                    expect(state.screen[0]).toBeLessThan(1440);
                    expect(state.screen[1]).toBeGreaterThan(0);
                    expect(state.screen[1]).toBeLessThan(900);
                }
                await page.screenshot({ path: `artifacts/phase5g/${renderer}-rift-${name}.png` });
            }
            await page.keyboard.press('r');
            await page.locator('#restart-accept').click();
            await page.evaluate(() => {
                const h = __phase4;
                h.combat.countdown = 1000;
                h.combat.director.wave = 5;
                h.combat.boss.spawn(h.flight, h.combat.rocks);
                h.advance(40);
            });
            await page.keyboard.press('Escape');
            const age = await page.evaluate(() => __phase4.combat.dreadnought.arrival.age);
            await page.evaluate(() => __phase4.advance(20));
            expect(await page.evaluate(() => __phase4.combat.dreadnought.arrival.age)).toBe(age);
            await expect(page.locator('#cockpit')).toBeHidden();
            await page.locator('#restart').click();
            await page.locator('#restart-accept').click();
            await page.evaluate(() => __phase4.advance(2));
            expect(await page.evaluate(() => __phase4.combat.dreadnought.arrival.radius)).toBe(0);
            expect(await page.evaluate(() => __phase4.app.root.findByName('Gravitational rift')!.enabled)).toBe(false);
            expect(errors).toEqual([]);
        });

if (!before)
    for (const renderer of ['webgpu', 'webgl2'])
        test('Stage C real artillery victory / ' + renderer, async ({ page, baseURL }) => {
            test.setTimeout(240000);
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            page.on('console', (m) => {
                if (m.type() === 'error') errors.push(m.text());
            });
            await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
            await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
            await page.locator('#launch').click();
            await page.evaluate(() => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.combat.countdown = 1000;
                h.combat.director.wave = 5;
                h.combat.director.group = 1;
                h.combat.boss.spawn(h.flight, h.combat.rocks);
                h.pilot = true;
                h.useAbilities = false;
            });
            await page.keyboard.down('Space');
            const phases = new Set<number>(),
                families = new Set<string>(),
                captured = new Set<string>();
            let win = false,
                peak = 0,
                bossAge = 0,
                lastState: unknown,
                performanceSample: unknown;
            for (let i = 0; i < 850; i++) {
                const state = await page.evaluate(() => {
                    const h = __phase4;
                    h.advance(10);
                    const b = h.combat.dreadnought;
                    return {
                        alive: h.flight.hull > 0,
                        hull: h.flight.hull,
                        shield: h.flight.shield,
                        active: b.active,
                        dying: b.dying,
                        phase: b.phase,
                        age: b.age,
                        health: b.health,
                        parts: b.parts.map((p) => p.health),
                        kind: b.patterns.kind,
                        state: b.patterns.state,
                        time: b.patterns.time,
                        arriving: b.arriving,
                        projectiles: h.combat.projectiles.items.filter((p) => p.active && p.hostile).length,
                        playerHits: h.combat.playerHits,
                        shots: h.combat.projectiles.fired,
                        duration: h.combat.duration
                    };
                });
                lastState = state;
                phases.add(state.phase);
                peak = Math.max(peak, state.projectiles);
                bossAge = state.age;
                if (!state.arriving) families.add(state.kind);
                expect(state.alive, JSON.stringify(state)).toBe(true);
                if (!state.arriving && state.state === 'fire' && !captured.has(state.kind)) {
                    captured.add(state.kind);
                    await page.screenshot({ path: `artifacts/phase5g/${renderer}-pattern-${state.kind}.png` });
                }
                if (state.phase === 3 && state.kind === 'helix' && state.state === 'fire' && !performanceSample) {
                    performanceSample = await page.evaluate(async () => {
                        const h = __phase4,
                            frame: number[] = [],
                            update: number[] = [],
                            render: number[] = [],
                            draws: number[] = [],
                            bolts: number[] = [];
                        let previous = performance.now();
                        h.app.timeScale = 1;
                        await new Promise<void>((resolve) => {
                            const sample = () => {
                                const now = performance.now();
                                frame.push(now - previous);
                                previous = now;
                                update.push(h.app.stats.frame.updateTime);
                                render.push(h.app.stats.frame.renderTime);
                                draws.push(h.app.stats.drawCallCount);
                                bolts.push(h.combat.projectiles.items.filter((p) => p.active && p.hostile).length);
                                if (frame.length >= 80) {
                                    h.app.off('frameend', sample);
                                    h.app.timeScale = 0;
                                    resolve();
                                }
                            };
                            h.app.on('frameend', sample);
                        });
                        const stats = (a: number[]) => {
                            a.sort((a, b) => a - b);
                            return {
                                median: a[Math.floor(a.length * 0.5)],
                                p95: a[Math.floor(a.length * 0.95)],
                                max: a[a.length - 1]
                            };
                        };
                        return {
                            frame: stats(frame),
                            update: stats(update),
                            render: stats(render),
                            draws: stats(draws),
                            hostile: stats(bolts),
                            renderComponents: h.app.root.findComponents('render').length
                        };
                    });
                }
                if (state.phase === 2 && !captured.has('phase2')) {
                    captured.add('phase2');
                    await page.keyboard.press('c');
                    await page.evaluate(() => __phase4.advance(3));
                    await page.locator('#cockpit-art').evaluate((img: HTMLImageElement) => img.decode());
                    await page.screenshot({ path: `artifacts/phase5g/${renderer}-phase2-cockpit.png` });
                }
                if (state.phase === 3 && !captured.has('phase3')) {
                    captured.add('phase3');
                    await page.screenshot({ path: `artifacts/phase5g/${renderer}-phase3-cockpit.png` });
                }
                if (!state.active && state.dying > 0) {
                    win = true;
                    break;
                }
            }
            await page.keyboard.up('Space');
            peak = Math.max(peak, (performanceSample as { hostile: { max: number } } | undefined)?.hostile.max ?? 0);
            if (!win)
                fs.writeFileSync(
                    `artifacts/phase5g/${renderer}-fight-diagnostic.json`,
                    JSON.stringify(lastState, null, 2)
                );
            expect(win).toBe(true);
            expect([...phases]).toEqual([1, 2, 3]);
            expect(families.size).toBe(5);
            expect(peak).toBeLessThanOrEqual(96);
            await page.evaluate(() => {
                __phase4.pilot = false;
                __phase4.advance(140);
            });
            await expect(page.locator('#wave-banner')).toContainText('SECTOR SECURED');
            await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
            await page.screenshot({ path: `artifacts/phase5g/${renderer}-artillery-victory.png` });
            fs.writeFileSync(
                `artifacts/phase5g/${renderer}-combat-metrics.json`,
                JSON.stringify(
                    {
                        bossAge,
                        peakHostileProjectiles: peak,
                        phases: [...phases],
                        families: [...families],
                        captured: [...captured],
                        performanceSample
                    },
                    null,
                    2
                )
            );
            expect(errors).toEqual([]);
        });

if (!before)
    for (const renderer of ['webgpu', 'webgl2'])
        test('Stage D complete patrol escalation / ' + renderer, async ({ page, baseURL }) => {
            test.setTimeout(240000);
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            page.on('console', (m) => {
                if (m.type() === 'error') errors.push(m.text());
            });
            await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
            await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
            await page.locator('#ship-surveyor').click();
            await expect(page.locator('#ship-surveyor')).toHaveAttribute('aria-pressed', 'true');
            await page.locator('#launch').click();
            await page.evaluate(() => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.pilot = true;
                h.useAbilities = true;
            });
            await page.keyboard.down('Space');
            const waves = new Set<number>(),
                phases = new Set<number>(),
                population: Record<string, number> = {},
                peakLive: Record<string, number> = {},
                entries: Record<string, number> = {};
            let presetCheck = false,
                peakProjectiles = 0,
                last: unknown,
                completed = false;
            for (let i = 0; i < 1700; i++) {
                const state = await page.evaluate(() => {
                    const h = __phase4;
                    h.advance(10);
                    const c = h.combat;
                    return {
                        wave: c.wave,
                        alive: h.flight.hull > 0,
                        hull: h.flight.hull,
                        shield: h.flight.shield,
                        phase: c.boss.phase,
                        bossActive: c.boss.active,
                        bossArrival: c.boss.arriving,
                        bossAge: c.boss.age,
                        health: c.boss.health,
                        count: c.enemies.filter((e) => e.active).length,
                        quota: c.director.total,
                        deployed: c.director.deployed,
                        time: c.duration,
                        shots: c.projectiles.items.filter((p) => p.active && p.hostile).length,
                        kills: c.kills,
                        bosses: c.bosses,
                        ammo: c.ammo
                    };
                });
                last = state;
                expect(state.alive, JSON.stringify(state)).toBe(true);
                waves.add(state.wave);
                peakProjectiles = Math.max(peakProjectiles, state.shots);
                peakLive[state.wave] = Math.max(peakLive[state.wave] ?? 0, state.count);
                population[state.wave] = state.quota;
                entries[state.wave] ??= state.time;
                if (state.wave === 5) {
                    phases.add(state.phase);
                    if (!presetCheck && state.bossActive && !state.bossArrival) {
                        presetCheck = true;
                        await page.keyboard.up('Space');
                        await page.keyboard.press('c');
                        await page.evaluate(() => __phase4.advance(2));
                        await page.locator('#cockpit-art').evaluate((i: HTMLImageElement) => i.decode());
                        for (const quality of ['low', 'medium', 'high']) {
                            await page.keyboard.press('Escape');
                            await page.locator('#show-settings').click();
                            await page.locator('#graphics').selectOption(quality);
                            await page.keyboard.press('Escape');
                            await page.locator('#launch').click();
                            await page.evaluate(() => __phase4.advance(2));
                            await page.screenshot({
                                path: `artifacts/phase5g/${renderer}-surveyor-boss-${quality}.png`
                            });
                        }
                        await page.keyboard.down('Space');
                    }
                }
                if (state.wave >= 7) {
                    completed = true;
                    break;
                }
            }
            await page.keyboard.up('Space');
            fs.writeFileSync(
                `artifacts/phase5g/${renderer}-patrol-metrics.json`,
                JSON.stringify(
                    { waves: [...waves], phases: [...phases], population, peakLive, entries, peakProjectiles, last },
                    null,
                    2
                )
            );
            expect(completed, JSON.stringify(last)).toBe(true);
            expect([...waves]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
            expect([...phases]).toEqual([1, 2, 3]);
            expect(population['1']).toBe(3);
            expect(population['2']).toBe(5);
            expect(population['3']).toBe(7);
            expect(population['4']).toBe(9);
            expect(population['6']).toBe(12);
            expect(Math.max(...Object.values(peakLive))).toBeLessThanOrEqual(8);
            expect(peakProjectiles).toBeLessThanOrEqual(96);
            expect(presetCheck).toBe(true);
            await page.screenshot({ path: `artifacts/phase5g/${renderer}-post-boss-wave7.png` });
            await page.evaluate(() => (__phase4.pilot = false));
            await page.keyboard.press('r');
            await page.locator('#restart-accept').click();
            await page.evaluate(() => {
                __phase4.combat.countdown = 1000;
                __phase4.advance(2);
            });
            const before = await page.evaluate(() => __phase4.app.root.findComponents('render').length);
            for (let i = 0; i < 2; i++) {
                await page.keyboard.press('r');
                await page.locator('#restart-accept').click();
                await page.evaluate(() => {
                    __phase4.combat.countdown = 1000;
                    __phase4.advance(2);
                });
            }
            expect(await page.evaluate(() => __phase4.app.root.findComponents('render').length)).toBe(before);
            expect(await page.evaluate(() => __phase4.hangar.selected)).toBe('surveyor');
            expect(errors).toEqual([]);
        });
