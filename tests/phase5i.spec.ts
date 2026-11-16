import fs from 'node:fs';

import { test, expect } from '@playwright/test';

import type { CombatView } from '../src/combat-view';
for (const backend of ['webgpu', 'webgl2'])
    test('A energy profiles and bounded mesh / ' + backend, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (backend === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        const result = await page.evaluate(async () => {
            const h = __phase4 as typeof __phase4 & { view: CombatView };
            h.app.timeScale = 0;
            h.app.off('update');
            h.combat.projectiles.reset();
            const camera = h.app.root.findByName('Chase camera')!;
            camera.setPosition(0, 0, 0);
            camera.lookAt(0, 0, -50);
            for (const e of h.app.root.children) e.enabled = e === camera || e.name === 'Cinematic hostile energy';
            const pos = h.flight.position.clone(),
                dir = pos.clone().set(0, 0, -1),
                zero = pos.clone().set(0, 0, 0);
            for (const [i, kind] of [1, 2, 4, 5].entries())
                h.combat.projectiles.spawn(
                    pos.set((i - 1.5) * 12, 0, -50),
                    dir,
                    zero,
                    100,
                    10,
                    7,
                    true,
                    false,
                    kind === 1,
                    false,
                    kind
                );
            h.view.energy.render(h.combat.projectiles, camera, 1, 0.1);
            await new Promise<void>((r) => h.app.once('frameend', () => r()));
            return await new Promise<{ lit: number; entities: number; zones: number[] }>((r) =>
                h.app.once('frameend', () => {
                    const src = h.app.graphicsDevice.canvas as HTMLCanvasElement,
                        c = document.createElement('canvas');
                    c.width = src.width;
                    c.height = src.height;
                    const ctx = c.getContext('2d')!;
                    ctx.drawImage(src, 0, 0);
                    const d = ctx.getImageData(0, 0, c.width, c.height).data;
                    let lit = 0;
                    for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) > 80) lit++;
                    const zones = [0, 1, 2, 3].map((n) => {
                        const focal = c.height / (2 * Math.tan((camera.camera!.fov * Math.PI) / 360));
                        const x0 = Math.round(c.width / 2 + (((n - 1.5) * 12) / 50) * focal);
                        let count = 0;
                        for (let y = Math.floor(c.height / 2 - 35); y < c.height / 2 + 35; y++)
                            for (let x = x0 - 35; x < x0 + 35; x++) {
                                const k = (y * c.width + x) * 4;
                                if (Math.max(d[k], d[k + 1], d[k + 2]) > 80) count++;
                            }
                        return count;
                    });
                    r({ lit, entities: h.app.root.findComponents('render').length, zones });
                })
            );
        });
        expect(result.lit).toBeGreaterThan(500);
        for (const count of result.zones) expect(count).toBeGreaterThan(15);
        fs.mkdirSync('artifacts/phase5i', { recursive: true });
        await page.screenshot({ path: `artifacts/phase5i/${backend}-energy-profiles.png` });
        expect(errors).toEqual([]);
    });
for (const backend of ['webgpu', 'webgl2'])
    test('E dual arrivals, attack token and restart / ' + backend, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (backend === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        await page.keyboard.down('KeyZ');
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.director.wave = 20;
            h.combat.countdown = 1000;
            h.combat.dreadnought.spawn(h.flight, h.rocks);
            h.combat.encounter.begin(20, h.combat.allBosses, h.combat.dreadnought);
            h.combat.defenseFleet.begin();
            h.pilot = true;
            h.advance(95);
        });
        await page.screenshot({ path: `artifacts/phase5i/${backend}-dual-rifts.png` });
        const state = await page.evaluate(() => {
            const h = __phase4;
            h.advance(400);
            return {
                active: h.combat.allBosses.filter((b) => b.active).length,
                permissions: h.combat.allBosses.filter((b) => b.active && b.patterns.permitted).length,
                health: h.flight.hull,
                escorts: h.combat.enemies.filter((e) => e.active && e.escortOwner >= 0).length,
                projectiles: h.combat.projectiles.items.filter((p) => p.active && p.hostile).length
            };
        });
        expect(state.active).toBe(2);
        expect(state.permissions).toBe(1);
        expect(state.health).toBeGreaterThan(0);
        expect(state.escorts).toBeLessThanOrEqual(2);
        expect(state.projectiles).toBeLessThanOrEqual(176);
        await expect(page.locator('#dual-boss')).toBeVisible();
        await page.screenshot({ path: `artifacts/phase5i/${backend}-dual-combat.png` });
        await page.keyboard.press('KeyR');
        await page.locator('#restart-accept').click();
        expect(await page.evaluate(() => __phase4.combat.allBosses.some((b) => b.active))).toBe(false);
        expect(errors).toEqual([]);
    });
for (const backend of ['webgpu', 'webgl2'])
    test('F G three ships, three-second evade and real V storm / ' + backend, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        for (const ship of ['classic', 'surveyor', 'ptah']) {
            await page.goto(baseURL! + '/' + (backend === 'webgl2' ? '?webgl' : ''));
            if (await page.locator('#ship-' + ship).isHidden())
                await page.getByRole('button', { name: ship === 'ptah' ? 'Next ships' : 'Previous ships' }).click();
            await page.locator('#ship-' + ship).click();
            await expect(page.locator('#ship-' + ship)).toHaveAttribute('aria-pressed', 'true');
            await page.locator('#launch').click();
            await page.evaluate(() => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.combat.countdown = 1000;
                h.advance(900);
            });
            expect(await page.evaluate(() => __phase4.combat.storm.ready)).toBe(true);
            await page.keyboard.down('KeyA');
            await page.keyboard.down('Space');
            await page.evaluate(() => __phase4.advance(2));
            expect(await page.evaluate(() => __phase4.flight.evasion.cooldown)).toBeLessThanOrEqual(3);
            expect(await page.evaluate(() => __phase4.flight.velocity.x)).toBeLessThan(0);
            await page.evaluate(() => __phase4.advance(70));
            expect(await page.evaluate(() => __phase4.flight.evasion.active)).toBe(false);
            expect(await page.evaluate(() => __phase4.flight.evasion.cooldown)).toBe(0);
            await page.keyboard.up('Space');
            await page.keyboard.up('KeyA');
            const ammo = await page.evaluate(() => {
                const h = __phase4;
                for (let i = 0; i < 2; i++) {
                    const e = h.combat.enemies[i];
                    e.spawn(
                        'heavy',
                        h.flight.position.clone().add(h.flight.position.clone().set(i ? 30 : -30, 0, -160)),
                        h.flight.rotation
                    );
                }
                h.combat.selected = 0;
                return h.combat.ammo;
            });
            if (ship === 'ptah') await page.keyboard.press('KeyC');
            await page.keyboard.down('KeyV');
            await page.evaluate(() => __phase4.advance(5));
            expect(await page.evaluate(() => __phase4.combat.storm.pending)).toBeGreaterThan(0);
            await page.keyboard.press('Escape');
            const frozen = await page.evaluate(() => ({
                charge: __phase4.combat.storm.charge,
                pending: __phase4.combat.storm.pending
            }));
            await page.evaluate(() => __phase4.advance(20));
            expect(
                await page.evaluate(() => ({
                    charge: __phase4.combat.storm.charge,
                    pending: __phase4.combat.storm.pending
                }))
            ).toEqual(frozen);
            await page.locator('#launch').click();
            await page.evaluate(() => __phase4.advance(15));
            expect(await page.evaluate(() => __phase4.combat.storm.fired)).toBe(6);
            expect(await page.evaluate(() => __phase4.combat.ammo)).toBe(ammo);
            await page.screenshot({ path: `artifacts/phase5i/${backend}-${ship}-storm-launch.png` });
            await page.keyboard.up('KeyV');
            await page.evaluate(() => __phase4.advance(200));
            expect(await page.evaluate(() => __phase4.events.some((e) => e.kind === 'missile-impact'))).toBe(true);
            await page.screenshot({ path: `artifacts/phase5i/${backend}-${ship}-storm-impact.png` });
            await page.keyboard.press('KeyR');
            await page.locator('#restart-accept').click();
            expect(await page.evaluate(() => __phase4.combat.storm.charge)).toBe(0);
            expect(await page.evaluate(() => __phase4.combat.missiles.reserved)).toBe(0);
        }
        expect(errors).toEqual([]);
    });
for (const backend of ['webgpu', 'webgl2'])
    test('H normal-control dual boss victory / ' + backend, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (backend === 'webgl2' ? '?webgl' : ''));
        await page.locator('#ship-surveyor').click();
        await expect(page.locator('#ship-surveyor')).toHaveAttribute('aria-pressed', 'true');
        await page.locator('#launch').click();
        await page.locator('#application-canvas').click();
        expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(true);
        await page.keyboard.down('KeyZ');
        await page.evaluate(() => {
            const h = __phase4 as typeof __phase4 & { controlsOnly: boolean };
            h.app.timeScale = 0;
            h.combat.director.wave = 20;
            h.combat.countdown = 1000;
            h.combat.dreadnought.spawn(h.flight, h.rocks);
            h.combat.encounter.begin(20, h.combat.allBosses, h.combat.dreadnought);
            h.combat.defenseFleet.begin();
            h.pilot = true;
            h.controlsOnly = true;
        });
        await page.evaluate(() => {
            const h = __phase4 as typeof __phase4 & { completedEvents: number };
            h.completedEvents = 0;
            h.app.on('boss:defeated', () => h.completedEvents++);
        });
        let win = false,
            last: unknown,
            peak = 0;
        for (let i = 0; i < 1800; i++) {
            const state = await page.evaluate(() => {
                const h = __phase4;
                h.advance(10);
                return {
                    bosses: h.combat.allBosses.filter((b) => b.active || b.dying > 0).length,
                    pending: h.combat.encounter.pending,
                    hull: h.flight.hull,
                    health: h.combat.allBosses.map((b) => b.health),
                    score: h.combat.score,
                    shots: h.combat.projectiles.items.filter((p) => p.active && p.hostile).length,
                    time: h.combat.duration,
                    storm: h.combat.storm.fired
                };
            });
            last = state;
            peak = Math.max(peak, state.shots);
            if (state.hull <= 0) break;
            if (state.bosses === 0 && state.pending < 0) {
                win = true;
                break;
            }
        }
        fs.writeFileSync(`artifacts/phase5i/${backend}-dual-win.json`, JSON.stringify({ win, last, peak }, null, 2));
        await page.screenshot({ path: `artifacts/phase5i/${backend}-dual-victory.png` });
        expect(win, JSON.stringify(last)).toBe(true);
        const continuation = await page.evaluate(() => {
            const h = __phase4 as typeof __phase4 & { completedEvents: number };
            h.advance(185);
            return {
                wave: h.combat.wave,
                bosses: h.combat.bosses,
                events: h.completedEvents,
                orphans: h.combat.enemies.filter((e) => e.active && e.escortOwner >= 0).length
            };
        });
        expect(continuation).toEqual({ wave: 21, bosses: 2, events: 1, orphans: 0 });
        expect(errors).toEqual([]);
    });
for (const backend of ['webgpu', 'webgl2'])
    test('H cinematic patterns, presets and bounded resources / ' + backend, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (backend === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        const captures = [
            { wave: 5, index: 0, phase: 1, name: 'orange-curtain', seconds: 4.3 },
            { wave: 5, index: 1, phase: 1, name: 'red-barrage', seconds: 2.9 },
            { wave: 5, index: 1, phase: 3, name: 'heavy-beam', seconds: 2.6 },
            { wave: 10, index: 0, phase: 1, name: 'violet-helix', seconds: 2.7 },
            { wave: 15, index: 0, phase: 1, name: 'tesser-sphere', seconds: 3.0 },
            { wave: 15, index: 0, phase: 2, name: 'tesser-crossing-beams', seconds: 2.8 }
        ];
        for (const c of captures) {
            await page.evaluate((c) => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.pilot = false;
                h.flight.reset();
                h.combat.reset();
                h.combat.director.wave = c.wave;
                h.combat.countdown = 1000;
                const b = h.combat.boss;
                b.spawn(h.flight, h.rocks);
                b.arrival.stage = 'combat';
                b.position.set(0, 90, -470);
                b.previous.copy(b.position);
                b.phase = c.phase;
                b.grace = 0;
                b.patterns.reset(c.phase);
                b.patterns.index = c.index;
                h.combat.defenseFleet.begin();
                h.advance(Math.round(c.seconds / 0.05));
            }, c);
            if (c.wave !== 10)
                await page.waitForFunction(
                    (key) => !!__phase4.app.assets.find('Imported ' + key, 'container')?.resource,
                    c.wave === 5 ? 'artillery' : 'tesser'
                );
            await page.screenshot({ path: `artifacts/phase5i/${backend}-${c.name}.png` });
        }
        await page.evaluate(() => {
            const h = __phase4;
            h.combat.reset();
            h.flight.reset();
            h.combat.director.wave = 20;
            h.combat.countdown = 1000;
            h.combat.dreadnought.spawn(h.flight, h.rocks);
            h.combat.encounter.begin(20, h.combat.allBosses, h.combat.dreadnought);
            h.combat.defenseFleet.begin();
            h.pilot = true;
            h.advance(440);
        });
        const metrics = [];
        for (const quality of ['low', 'medium', 'high'] as const) {
            const sample = await page.evaluate(async (quality) => {
                const h = __phase4 as typeof __phase4 & { view: CombatView };
                h.settings.graphics = quality;
                h.app.fire('update', 0);
                const camera = h.app.root.findByName('Chase camera')!,
                    shots = h.combat.projectiles;
                const p = h.flight.position.clone(),
                    dir = p.clone().set(0, 0, -1),
                    zero = p.clone().set(0, 0, 0);
                shots.reset();
                for (let i = 0; i < 176; i++)
                    shots.spawn(
                        p
                            .clone()
                            .add(p.clone().set(((i % 16) - 8) * 7, Math.floor(i / 16) * 6 - 30, -100 - (i % 8) * 8)),
                        dir,
                        zero,
                        125,
                        10,
                        7,
                        true,
                        false,
                        i % 3 === 0,
                        false,
                        i % 3 === 0 ? 1 : i % 3 === 1 ? 2 : 4,
                        8
                    );
                const start = performance.now();
                for (let i = 0; i < 200; i++) h.view.energy.render(shots, camera, 1, 0);
                const energyMs = (performance.now() - start) / 200;
                let n = 0;
                const samples: number[] = [],
                    gpu: number[] = [];
                const profiler = h.app.graphicsDevice.gpuProfiler;
                if (profiler) profiler.enabled = true;
                await new Promise<void>((resolve) => {
                    const frame = () => {
                        samples.push(h.app.stats.drawCalls.total);
                        const t = h.app.stats.gpuFrameTime;
                        if (t !== undefined) gpu.push(t);
                        if (++n === 30) {
                            h.app.off('frameend', frame);
                            resolve();
                        }
                    };
                    h.app.on('frameend', frame);
                });
                const entities = h.app.root.findComponents('render').length;
                return {
                    quality,
                    energyMs,
                    drawMin: Math.min(...samples),
                    drawMax: Math.max(...samples),
                    gpuMs: gpu.length ? gpu.reduce((a, b) => a + b, 0) / gpu.length : null,
                    entities,
                    nodes: h.app.root.find(() => true).length,
                    hostileCapacity: 176,
                    beamLimit: 2
                };
            }, quality);

            metrics.push(sample);
            await page.screenshot({ path: `artifacts/phase5i/${backend}-dual-${quality}.png` });
        }
        const reuse = await page.evaluate(() => {
            const h = __phase4;
            const start = performance.now();
            for (let i = 0; i < 60; i++) h.combat.step(1 / 120, false);
            const combatMs = (performance.now() - start) / 60;
            const counts = [];
            for (let i = 0; i < 8; i++) {
                h.combat.reset();
                h.combat.director.wave = 20;
                h.combat.dreadnought.spawn(h.flight, h.rocks);
                h.combat.encounter.begin(20, h.combat.allBosses, h.combat.dreadnought);
                h.combat.defenseFleet.begin();
                h.advance(1);
                counts.push(h.app.root.findComponents('render').length);
            }
            return { counts, combatMs };
        });
        expect(new Set(reuse.counts).size).toBe(1);
        fs.writeFileSync(`artifacts/phase5i/${backend}-performance.json`, JSON.stringify({ metrics, reuse }, null, 2));
        expect(errors).toEqual([]);
    });
for (const backend of ['webgpu', 'webgl2'])
    for (const c of [
        { wave: 5, ship: 'classic' },
        { wave: 10, ship: 'ptah' },
        { wave: 15, ship: 'surveyor' }
    ])
        test(`H single victory ${c.wave} ${c.ship} / ${backend}`, async ({ page, baseURL }) => {
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            page.on('console', (m) => {
                if (m.type() === 'error') errors.push(m.text());
            });
            await page.goto(baseURL! + '/' + (backend === 'webgl2' ? '?webgl' : ''));
            if (c.ship === 'ptah') await page.getByRole('button', { name: 'Next ships' }).click();
            await page.locator('#ship-' + c.ship).click();
            await expect(page.locator('#ship-' + c.ship)).toHaveAttribute('aria-pressed', 'true');
            await page.locator('#launch').click();
            await page.locator('#application-canvas').click();
            await page.keyboard.down('KeyZ');
            await page.evaluate((wave) => {
                const h = __phase4 as typeof __phase4 & { controlsOnly: boolean };
                h.app.timeScale = 0;
                h.combat.director.wave = wave;
                h.combat.countdown = 1000;
                h.combat.boss.spawn(h.flight, h.rocks);
                h.combat.encounter.begin(wave, h.combat.allBosses, h.combat.boss);
                h.combat.defenseFleet.begin();
                h.pilot = true;
                h.controlsOnly = true;
            }, c.wave);
            let win = false,
                last: unknown,
                peak = 0;
            const phases = new Set<number>();
            for (let i = 0; i < 1400; i++) {
                const state = await page.evaluate(() => {
                    const h = __phase4;
                    h.advance(10);
                    return {
                        active: h.combat.boss.active,
                        dying: h.combat.boss.dying,
                        phase: h.combat.boss.phase,
                        hull: h.flight.hull,
                        health: h.combat.boss.health,
                        time: h.combat.duration,
                        score: h.combat.score,
                        shots: h.combat.projectiles.items.filter((p) => p.active && p.hostile).length
                    };
                });
                last = state;
                phases.add(state.phase);
                peak = Math.max(peak, state.shots);
                if (state.hull <= 0) break;
                if (!state.active && state.dying <= 0) {
                    win = true;
                    break;
                }
            }
            fs.writeFileSync(
                `artifacts/phase5i/${backend}-${c.wave}-win.json`,
                JSON.stringify({ win, last, peak, phases: [...phases] }, null, 2)
            );
            await page.screenshot({ path: `artifacts/phase5i/${backend}-${c.wave}-victory.png` });
            expect(win, JSON.stringify(last)).toBe(true);
            expect([...phases]).toEqual([1, 2, 3]);
            expect(errors).toEqual([]);
        });
test('H short choreography recording', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        recordVideo: { dir: 'artifacts/phase5i/video', size: { width: 1280, height: 720 } }
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(baseURL! + '/?webgl');
    await page.locator('#launch').click();
    await page.evaluate(() => {
        const h = __phase4;
        h.app.timeScale = 0;
        h.combat.countdown = 1000;
        h.advance(900);
        h.flight.position.set(0, 200, 0);
        h.flight.previous.copy(h.flight.position);
        h.combat.director.wave = 5;
        h.combat.dreadnought.spawn(h.flight, h.rocks);
        h.combat.dreadnought.arrival.stage = 'combat';
        h.combat.dreadnought.position.set(0, 200, -560);
        h.combat.dreadnought.previous.copy(h.combat.dreadnought.position);
        h.combat.selected = 8;
        h.combat.defenseFleet.begin();
    });
    for (let i = 0; i < 150; i++) {
        if (i === 30) await page.keyboard.press('KeyV');
        if (i === 65) await page.keyboard.press('Space');
        if (i === 80) await page.keyboard.press('KeyC');
        await page.evaluate(() => __phase4.advance(2));
        await page.waitForTimeout(50);
    }
    const video = page.video()!;
    await context.close();
    await video.saveAs('artifacts/phase5i/video/choreography.webm');
    expect(errors).toEqual([]);
});
