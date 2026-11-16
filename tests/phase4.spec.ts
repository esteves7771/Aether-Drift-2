import { expect, test } from '@playwright/test';
import type { AppBase } from 'playcanvas';

import type { ChaseCamera } from '../src/camera';
import type { Combat } from '../src/combat';
import type { Settings } from '../src/config';
import type { Cruise } from '../src/cruise';
import type { CinematicExplosions } from '../src/explosions';
import type { Flight } from '../src/flight';
import type { Input } from '../src/input';
import type { ModelLibrary } from '../src/model-library';
import type { PilotCamera } from '../src/pilot-camera';
import type { PlayerThrusters } from '../src/player-thrusters';
import type { ShipHangar } from '../src/ship-hangar';
import type { UniverseView } from '../src/universe-view';
type Driver = {
    universe: UniverseView;
    combat: Combat;
    flight: Flight;
    modelLibrary: ModelLibrary;
    hangar: ShipHangar;
    cruise: Cruise;
    app: AppBase;
    thrusters: PlayerThrusters;
    input: Input;
    chase: ChaseCamera;
    pilotCamera: PilotCamera;
    explosions: CinematicExplosions;
    settings: Settings;
    pilot: boolean;
    useAbilities: boolean;
    autoUpgrades: boolean;
    events: { kind: string; x: number; y: number; z: number; time: number; style?: string }[];
    advance(ticks: number): void;
};
declare global {
    var __phase4: Driver;
}
for (const renderer of ['webgpu', 'webgl2'])
    test('Phase 4 encounter / ' + renderer, async ({ page }) => {
        test.setTimeout(150000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto('http://127.0.0.1:5181/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.locator('#launch').click();
        await page.evaluate(() => {
            __phase4.app.timeScale = 0;
            __phase4.advance(20);
        });
        await page.mouse.click(720, 450, { button: 'right' });
        await page.keyboard.press('m');
        await page.keyboard.press('g');
        await page.evaluate(() => __phase4.advance(2));
        await expect(page.locator('#abilities')).toHaveAttribute('data-ammo', '5');
        expect(await page.evaluate(() => __phase4.combat.empCooldown)).toBeGreaterThan(20);
        await page.keyboard.press('Escape');
        const before = await page.evaluate(() => ({
            emp: __phase4.combat.empCooldown,
            age: __phase4.combat.enemies[0].age
        }));
        await page.evaluate(() => __phase4.advance(10));
        expect(
            await page.evaluate(() => ({ emp: __phase4.combat.empCooldown, age: __phase4.combat.enemies[0].age }))
        ).toEqual(before);
        await page.locator('#restart').click();
        await page.locator('#restart-accept').click();
        await page.keyboard.down('KeyZ');
        await page.evaluate(() => {
            __phase4.pilot = true;
        });
        const waves = new Set<number>(),
            phases = new Set<number>(),
            turrets = new Set<number>();
        let maxBolts = 0,
            elite = false;
        let baseline = 0;
        let victorySeen = false;
        let explosionTiming: unknown;
        const captures = new Set<string>();
        let timing: { median: number; p95: number; max: number; peakDraws: number } | undefined;
        for (let i = 0; i < 550; i++) {
            const state = await page.evaluate(() => {
                const h = __phase4;
                h.advance(h.combat.boss.dying > 0 ? 1 : 10);
                const c = h.combat;
                return {
                    wave: c.wave,
                    phase: c.boss.active ? c.boss.phase : 0,
                    turrets: c.boss.parts.slice(0, 4).filter((p) => p.active).length,
                    hull: h.flight.hull,
                    elite: c.enemies.some((e) => e.active && e.elite),
                    bolts: c.projectiles.items.filter((p) => p.active).length,
                    renders: h.app.root.findComponents('render').length,
                    score: c.score,
                    victory: c.victory,
                    charge: c.boss.charge,
                    events: h.events.filter((e) => c.duration - e.time < 0.55).map((e) => e.kind),
                    death: c.boss.deathStage
                };
            });
            for (const kind of ['explosion', 'elite-explosion', 'capital-final'])
                if (state.events.includes(kind) && !captures.has(kind)) {
                    await page.screenshot({ path: 'test-results/spectacle-' + renderer + '-' + kind + '.png' });
                    captures.add(kind);
                    if (kind === 'capital-final')
                        explosionTiming = await page.evaluate(
                            () =>
                                new Promise((resolve) => {
                                    const app = __phase4.app,
                                        samples: number[] = [];
                                    let previous = performance.now(),
                                        draws = 0;
                                    app.timeScale = 1;
                                    const frame = () => {
                                        const now = performance.now();
                                        samples.push(now - previous);
                                        previous = now;
                                        draws = Math.max(draws, app.stats.drawCallCount);
                                        if (samples.length === 60) {
                                            app.off('frameend', frame);
                                            app.timeScale = 0;
                                            samples.sort((a, b) => a - b);
                                            resolve({ median: samples[30], p95: samples[57], max: samples[59], draws });
                                        }
                                    };
                                    app.on('frameend', frame);
                                })
                        );
                }
            waves.add(state.wave);
            if (state.phase) phases.add(state.phase);
            if (state.wave === 5) turrets.add(state.turrets);
            elite ||= state.elite;
            maxBolts = Math.max(maxBolts, state.bolts);
            baseline ||= state.renders;
            expect(state.renders).toBeLessThanOrEqual(baseline + 110);
            expect(state.hull, 'scripted pilot survived wave ' + state.wave + ' / tick ' + i).toBeGreaterThan(0);
            if (state.victory > 0 && !victorySeen) {
                await page.evaluate(() => __phase4.advance(2));
                await expect(page.locator('#wave-banner')).toContainText('CAPITAL SHIP DESTROYED');
                await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
                await page.screenshot({ path: 'test-results/phase4-' + renderer + '-victory.png' });
                victorySeen = true;
            }
            if (
                state.wave === 5 &&
                state.phase &&
                !phases.has(-state.phase) &&
                !(await page.evaluate(() => __phase4.combat.boss.arriving || __phase4.combat.boss.grace > 0))
            ) {
                await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'boss');
                await page.screenshot({ path: 'test-results/phase4-' + renderer + '-phase' + state.phase + '.png' });
                if (state.phase === 1) {
                    await page.keyboard.up('KeyZ');
                    await page.evaluate(() => {
                        __phase4.useAbilities = false;
                    });
                    for (let n = 0; n < 40; n++) {
                        const charge = await page.evaluate(() => {
                            __phase4.advance(2);
                            return __phase4.combat.boss.charge;
                        });
                        if (charge > 0.1) break;
                    }
                    await page.screenshot({ path: 'test-results/spectacle-' + renderer + '-telegraph.png' });
                    await page.evaluate(() => __phase4.advance(25));
                    await page.screenshot({ path: 'test-results/spectacle-' + renderer + '-attack.png' });

                    const bossPixels = await page.evaluate(async () => {
                        const app = __phase4.app,
                            saved = app.root.children.map((e) => ({ e, enabled: e.enabled }));
                        for (const { e } of saved)
                            e.enabled = ['Capital ship', 'Chase camera', 'Starlight', 'Magenta rim'].includes(e.name);
                        const bright = await new Promise<number>((resolve) =>
                            app.once('frameend', () => {
                                const source = app.graphicsDevice.canvas as HTMLCanvasElement,
                                    copy = document.createElement('canvas');
                                copy.width = source.width;
                                copy.height = source.height;
                                const ctx = copy.getContext('2d')!;
                                ctx.drawImage(source, 0, 0);
                                const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
                                let n = 0;
                                for (let i = 0; i < data.length; i += 4)
                                    if (Math.max(data[i], data[i + 1], data[i + 2]) > 60) n++;
                                resolve(n);
                            })
                        );
                        for (const { e, enabled } of saved) e.enabled = enabled;
                        return bright;
                    });
                    expect(bossPixels, 'isolated capital ship contributes visible canvas pixels').toBeGreaterThan(30);
                    await page.keyboard.press('Escape');
                    const age = await page.evaluate(() => __phase4.combat.boss.age);
                    await page.evaluate(() => __phase4.advance(10));
                    expect(await page.evaluate(() => __phase4.combat.boss.age)).toBe(age);
                    await page.locator('#launch').click();
                    await page.keyboard.down('KeyZ');
                    timing = await page.evaluate(
                        () =>
                            new Promise<{ median: number; p95: number; max: number; peakDraws: number }>((resolve) => {
                                const app = __phase4.app,
                                    samples: number[] = [];
                                let last = performance.now(),
                                    peakDraws = 0;
                                app.timeScale = 1;
                                const sample = () => {
                                    const now = performance.now();
                                    samples.push(now - last);
                                    last = now;
                                    peakDraws = Math.max(peakDraws, app.stats.drawCallCount);
                                    if (samples.length >= 90) {
                                        app.off('frameend', sample);
                                        app.timeScale = 0;
                                        samples.sort((a, b) => a - b);
                                        resolve({ median: samples[45], p95: samples[85], max: samples[89], peakDraws });
                                    }
                                };
                                app.on('frameend', sample);
                            })
                    );
                }
                if (state.phase === 1) {
                    await page.keyboard.down('KeyZ');
                    await page.evaluate(() => {
                        __phase4.useAbilities = true;
                    });
                }
                phases.add(-state.phase);
            }
            if (state.wave >= 6) break;
        }
        expect([...waves]).toEqual([0, 1, 2, 3, 4, 5, 6]);
        for (const p of [1, 2, 3]) expect(phases.has(p)).toBe(true);
        expect(turrets.has(4)).toBe(true);
        expect(turrets.has(0)).toBe(true);
        expect(elite).toBe(true);
        expect(victorySeen).toBe(true);
        for (const kind of ['explosion', 'elite-explosion', 'capital-final'])
            expect(captures.has(kind), 'captured ' + kind).toBe(true);
        expect(maxBolts).toBeLessThan(240);
        await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
        await page.keyboard.up('KeyZ');
        await page.evaluate(() => {
            __phase4.pilot = false;
            __phase4.combat.hurtPlayer(999, __phase4.flight.position);
            __phase4.advance(1);
        });
        await expect(page.locator('#menu-heading')).toContainText('Ship lost');
        await page.locator('#retry').click();
        await page.evaluate(() => __phase4.advance(3));
        await expect(page.locator('#abilities')).toHaveAttribute('data-ammo', '6');
        await page.keyboard.press('Escape');
        await page.locator('#show-settings').click();
        await page.locator('#assist').uncheck();
        await page.locator('#menu-back').click();
        await page.locator('#launch').click();
        await page.keyboard.down('KeyW');
        await page.keyboard.down('ShiftLeft');
        await page.keyboard.down('KeyD');
        await page.evaluate(() => __phase4.advance(50));
        expect(await page.evaluate(() => __phase4.flight.velocity.length())).toBeGreaterThan(90);
        expect(await page.evaluate(() => __phase4.app.root.findByName('Chase camera')!.camera!.fov)).toBeGreaterThan(
            68
        );
        await page.screenshot({ path: 'test-results/spectacle-' + renderer + '-boost.png' });
        await page.keyboard.up('KeyW');
        await page.keyboard.up('ShiftLeft');
        await page.keyboard.up('KeyD');
        console.log(renderer, {
            waves: [...waves],
            phases: [...phases].filter((p) => p > 0),
            maxBolts,
            timing,
            explosionTiming,
            renderEntities: baseline
        });
        expect(errors).toEqual([]);
    });
