import { expect, test } from '@playwright/test';
import type { RenderComponent } from 'playcanvas';

for (const renderer of ['webgpu', 'webgl2'])
    test('Reactive player propulsion / ' + renderer, async ({ page }) => {
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
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 10000;
            h.flight.position.set(0, 1800, 0);
            h.flight.previous.copy(h.flight.position);
            h.chase.reset();
            h.advance(10);
        });
        const captures: string[] = [];
        const shot = async (name: string) => {
            const path = 'artifacts/thrusters/' + renderer + '-' + name + '.png';
            await page.screenshot({ path });
            captures.push(path);
        };
        const mode = () =>
            page.evaluate(() => ({
                mode: __phase4.thrusters.state.mode,
                length: __phase4.thrusters.state.length,
                power: __phase4.thrusters.state.power,
                time: __phase4.thrusters.state.time,
                jets: Array.from(__phase4.thrusters.state.jets)
            }));
        for (const ship of ['classic', 'surveyor'] as const) {
            if (ship === 'surveyor') await page.evaluate(() => __phase4.hangar.chooseAlternate());
            await page.evaluate(() => {
                const h = __phase4;
                h.flight.reset();
                h.flight.position.set(0, 1800, 0);
                h.flight.previous.copy(h.flight.position);
                h.cruise.reset();
                h.thrusters.reset();
                h.chase.reset();
                h.advance(5);
            });
            await shot(ship + '-idle');
            const idle = await mode();
            expect(idle.mode).toBe('idle');
            await page.keyboard.down('KeyW');
            await page.evaluate(() => __phase4.advance(18));
            expect((await mode()).mode).toBe('thrust');
            await shot(ship + '-thrust');
            await page.keyboard.down('ShiftLeft');
            await page.evaluate(() => __phase4.advance(14));
            const boost = await mode();
            expect(boost.mode).toBe('boost');
            expect(boost.length).toBeGreaterThan(idle.length * 8);
            await shot(ship + '-boost');
            await page.evaluate(() => {
                const h = __phase4,
                    ship = h.app.root.findByName('Ship')!,
                    camera = h.app.root.findByName('Chase camera')!;
                const position = ship.getPosition().clone();
                const side = () => {
                    camera.setPosition(position.x + 8, position.y + 3, position.z + 10);
                    camera.lookAt(position.x, position.y, position.z + 3);
                };
                h.app.on('prerender', side);
                Object.assign(globalThis, { __thrusterSide: side });
            });
            await shot(ship + '-boost-side');
            await page.evaluate(() => {
                const scope = globalThis as unknown as { __thrusterSide: () => void };
                __phase4.app.off('prerender', scope.__thrusterSide);
            });
            await page.keyboard.up('ShiftLeft');
            await page.keyboard.up('KeyW');
            await page.evaluate(() => __phase4.cruise.toggle(__phase4.flight, false)); // Internal retained travel envelope; C is camera now.
            await page.evaluate(() => __phase4.advance(18));
            expect(await page.evaluate(() => __phase4.cruise.active)).toBe(true);
            expect((await mode()).mode).toBe('cruise');
            await shot(ship + '-cruise');
            await page.keyboard.press('Escape');
            const paused = await mode();
            await page.evaluate(() => __phase4.advance(10));
            expect(await mode()).toEqual(paused);
            await page.keyboard.press('Escape');
            await page.keyboard.down('KeyX');
            await page.evaluate(() => __phase4.advance(12));
            expect((await mode()).mode).toBe('braking');
            await shot(ship + '-brake');
            await page.keyboard.up('KeyX');
            await page.keyboard.down('KeyD');
            await page.keyboard.down('KeyF');
            await page.keyboard.down('KeyQ');
            await page.evaluate(() => __phase4.advance(12));
            const jets = (await mode()).jets;
            expect(jets[0]).toBeGreaterThan(0.8);
            expect(jets[4]).toBeGreaterThan(0.8);
            expect(jets[2]).toBeGreaterThan(0.5);
            await shot(ship + '-maneuver');
            await page.keyboard.up('KeyD');
            await page.keyboard.up('KeyF');
            await page.keyboard.up('KeyQ');
            const roots = await page.evaluate(() =>
                __phase4.thrusters.root.children
                    .filter((e) => e.name.startsWith('Player engine') && e.enabled)
                    .map((e) => ({ name: e.name, position: e.getLocalPosition().toString() }))
            );
            expect(roots).toHaveLength(ship === 'classic' ? 2 : 3);
            console.log(renderer, ship, roots);
        }
        // Presets keep a bounded set of reusable meshes/entities, including repeated ship switches.
        const count = await page.evaluate(() => __phase4.thrusters.root.findComponents('render').length);
        const metrics: Record<string, unknown> = {};
        await page.keyboard.down('KeyW');
        await page.keyboard.down('ShiftLeft');
        await page.evaluate(() => __phase4.advance(12));
        for (const quality of ['low', 'medium', 'high'] as const) {
            await page.evaluate((q) => {
                __phase4.settings.graphics = q;
                __phase4.advance(3);
            }, quality);
            await shot('surveyor-' + quality);
            for (const visible of [false, true]) {
                metrics[quality + '-' + (visible ? 'on' : 'off')] = await page.evaluate(
                    (visible) =>
                        new Promise((resolve) => {
                            const h = __phase4;
                            for (const r of h.thrusters.root.findComponents('render'))
                                for (const mi of (r as RenderComponent).meshInstances) mi.visible = visible;
                            const times: number[] = [];
                            let last = performance.now(),
                                draws = 0,
                                warm = 8;
                            const sample = () => {
                                const now = performance.now();
                                if (warm-- > 0) {
                                    last = now;
                                    return;
                                }
                                times.push(now - last);
                                last = now;
                                draws = Math.max(draws, h.app.stats.drawCallCount);
                                if (times.length === 35) {
                                    h.app.off('frameend', sample);
                                    times.sort((a, b) => a - b);
                                    resolve({ median: times[17], p95: times[33], draws });
                                }
                            };
                            h.app.on('frameend', sample);
                        }),
                    visible
                );
            }
            expect(await page.evaluate(() => __phase4.thrusters.root.findComponents('render').length)).toBe(count);
        }
        await page.keyboard.up('KeyW');
        await page.keyboard.up('ShiftLeft');
        await page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
                __phase4.hangar.chooseClassic();
                __phase4.advance(1);
                await __phase4.hangar.chooseAlternate();
                __phase4.advance(1);
            }
        });
        expect(await page.evaluate(() => __phase4.thrusters.root.findComponents('render').length)).toBe(count);
        await page.keyboard.press('KeyR');
        await page.locator('#restart-accept').click();
        await page.evaluate(() => __phase4.advance(2));
        expect((await mode()).mode).toBe('idle');
        await page.evaluate(() => __phase4.advance(45));
        await page.keyboard.down('KeyZ');
        await page.evaluate(() => {
            __phase4.settings.graphics = 'medium';
            __phase4.advance(80);
        });
        metrics.combat = await page.evaluate(
            () =>
                new Promise((resolve) => {
                    const h = __phase4,
                        times: number[] = [];
                    let last = performance.now(),
                        draws = 0,
                        warm = 8;
                    h.app.timeScale = 1;
                    const sample = () => {
                        const now = performance.now();
                        if (warm-- > 0) {
                            last = now;
                            return;
                        }
                        times.push(now - last);
                        last = now;
                        draws = Math.max(draws, h.app.stats.drawCallCount);
                        if (times.length === 35) {
                            h.app.off('frameend', sample);
                            h.app.timeScale = 0;
                            times.sort((a, b) => a - b);
                            resolve({ median: times[17], p95: times[33], draws });
                        }
                    };
                    h.app.on('frameend', sample);
                })
        );
        await shot('combat');
        await page.keyboard.up('KeyZ');
        expect(await page.evaluate(() => __phase4.combat.projectiles.fired)).toBeGreaterThan(0);
        console.log(renderer, JSON.stringify({ renders: count, metrics, captures }));
        expect(errors).toEqual([]);
    });
