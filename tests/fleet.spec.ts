import { expect, test } from '@playwright/test';
for (const renderer of ['webgpu', 'webgl2'])
    test('Fleet expansion and bar removal / ' + renderer, async ({ page }) => {
        test.setTimeout(180000);
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
        expect(await page.evaluate(() => __phase4.app.root.children.some((e) => /beacon/i.test(e.name)))).toBe(false);
        await expect(page.locator('.reticle')).toBeVisible();
        await page.mouse.click(720, 450, { button: 'right' });
        await page.evaluate(() => __phase4.advance(2));
        await expect(page.locator('.enemy-marker.locked')).toHaveCount(1);
        await page.keyboard.down('Space');
        const bolt = await page.evaluate(() => {
            __phase4.advance(2);
            const p = __phase4.combat.projectiles.items.find((p) => p.active && !p.hostile)!;
            return {
                i: __phase4.combat.projectiles.items.indexOf(p),
                x: p.position.x,
                y: p.position.y,
                z: p.position.z
            };
        });
        await page.evaluate(() => __phase4.advance(4));
        expect(
            await page.evaluate((b) => {
                const p = __phase4.combat.projectiles.items[b.i];
                return Math.hypot(p.position.x - b.x, p.position.y - b.y, p.position.z - b.z);
            }, bolt)
        ).toBeGreaterThan(40);
        await page.screenshot({ path: 'test-results/fleet-' + renderer + '-clean-combat.png' });
        await page.keyboard.press('Escape');
        await page.locator('#restart').click();
        await page.locator('#restart-accept').click();
        await page.keyboard.down('Space');
        await page.evaluate(() => {
            __phase4.pilot = true;
        });
        const waves = new Set<number>(),
            phases = new Set<number>(),
            captured = new Set<string>();
        let baseline = 0,
            maxShips = 0,
            maxBolts = 0;
        let timing: unknown;
        let carrierTiming: unknown;
        for (let i = 0; i < 1500; i++) {
            const s = await page.evaluate(() => {
                const h = __phase4;
                h.advance(h.combat.phantom.dying > 0 ? 1 : 10);
                const c = h.combat;
                return {
                    wave: c.wave,
                    phase: c.phantom.active ? c.phantom.phase : 0,
                    arriving: c.phantom.arriving,
                    grace: c.phantom.grace,
                    dead: c.phantom.deathStage,
                    victory: c.victory,
                    score: c.score,
                    remaining: c.remaining,
                    group: c.director.group,
                    groups: c.director.groupCount,
                    hull: c.ship.hull,
                    carrier: c.enemies.some((e) => e.active && e.kind === 'carrier'),
                    bomber: c.enemies.some((e) => e.active && e.kind === 'bomber'),
                    name: c.director.encounter?.name ?? '',
                    renders: h.app.root.findComponents('render').length,
                    ships: c.enemies.filter((e) => e.active).length,
                    bolts: c.projectiles.items.filter((p) => p.active).length
                };
            });
            if (
                (s.wave === 5 && s.remaining === 0 && !captured.has('bomber')) ||
                (s.wave === 6 && s.remaining === 0 && s.group >= s.groups && !captured.has('carrier'))
            ) {
                await page.keyboard.up('Space');
                await page.evaluate(() => {
                    __phase4.useAbilities = false;
                });
            }
            waves.add(s.wave);
            if (s.phase) phases.add(s.phase);
            baseline ||= s.renders;
            expect(s.renders).toBeLessThanOrEqual(baseline + 110);
            maxShips = Math.max(maxShips, s.ships);
            maxBolts = Math.max(maxBolts, s.bolts);
            expect(s.hull, 'pilot survived Wave ' + s.wave).toBeGreaterThan(0);
            if (s.bomber && !captured.has('bomber')) {
                await page.keyboard.up('Space');
                await page.evaluate(() => {
                    __phase4.useAbilities = false;
                });
                for (let j = 0; j < 160; j++) {
                    const fired = await page.evaluate(() => {
                        __phase4.advance(2);
                        return __phase4.combat.fleet.salvos;
                    });
                    if (fired > 0) break;
                }
                expect(await page.evaluate(() => __phase4.combat.fleet.salvos)).toBeGreaterThan(0);
                await page.screenshot({ path: 'test-results/fleet-' + renderer + '-bomber.png' });
                captured.add('bomber');
                await page.keyboard.down('Space');
                await page.evaluate(() => {
                    __phase4.useAbilities = true;
                });
            }
            if (s.carrier && !captured.has('carrier')) {
                await page.keyboard.up('Space');
                await page.evaluate(() => {
                    __phase4.useAbilities = false;
                });
                for (let j = 0; j < 140; j++) {
                    const n = await page.evaluate(() => {
                        __phase4.advance(2);
                        return __phase4.combat.fleet.deployed;
                    });
                    if (n > 0) break;
                }
                expect(await page.evaluate(() => __phase4.combat.fleet.deployed)).toBeGreaterThan(0);
                expect(
                    await page.evaluate(
                        () => __phase4.combat.enemies.filter((e) => e.active && e.kind === 'drone').length
                    )
                ).toBeLessThanOrEqual(2);
                carrierTiming = await page.evaluate(
                    () =>
                        new Promise((resolve) => {
                            const app = __phase4.app,
                                frames: number[] = [];
                            let last = performance.now(),
                                draws = 0;
                            app.timeScale = 1;
                            const frame = () => {
                                const now = performance.now();
                                frames.push(now - last);
                                last = now;
                                draws = Math.max(draws, app.stats.drawCallCount);
                                if (frames.length === 60) {
                                    app.off('frameend', frame);
                                    app.timeScale = 0;
                                    frames.sort((a, b) => a - b);
                                    resolve({ median: frames[30], p95: frames[57], max: frames[59], draws });
                                }
                            };
                            app.on('frameend', frame);
                        })
                );
                await page.screenshot({ path: 'test-results/fleet-' + renderer + '-carrier-deploy.png' });
                captured.add('carrier');
                await page.keyboard.down('Space');
                await page.evaluate(() => {
                    __phase4.useAbilities = true;
                });
            }
            if (s.name === 'MIXED ASSAULT' && !captured.has('mixed')) {
                await page.screenshot({ path: 'test-results/fleet-' + renderer + '-mixed.png' });
                captured.add('mixed');
            }
            if (s.phase && !s.arriving && s.grace <= 0 && !captured.has('phase' + s.phase)) {
                await expect(page.locator('#boss-name')).toContainText('PHANTOM');
                await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'boss');
                await page.screenshot({ path: 'test-results/fleet-' + renderer + '-phantom-phase' + s.phase + '.png' });
                captured.add('phase' + s.phase);
                if (s.phase === 1) {
                    await page.keyboard.up('Space');
                    await page.evaluate(() => {
                        __phase4.useAbilities = false;
                    });
                    for (let j = 0; j < 100; j++) {
                        const charge = await page.evaluate(() => {
                            __phase4.advance(2);
                            return __phase4.combat.phantom.charge;
                        });
                        if (charge > 0.1) break;
                    }
                    await page.screenshot({ path: 'test-results/fleet-' + renderer + '-phantom-attack.png' });
                    timing = await page.evaluate(
                        () =>
                            new Promise((resolve) => {
                                const app = __phase4.app,
                                    frames: number[] = [];
                                let previous = performance.now(),
                                    draws = 0;
                                app.timeScale = 1;
                                const frame = () => {
                                    const now = performance.now();
                                    frames.push(now - previous);
                                    previous = now;
                                    draws = Math.max(draws, app.stats.drawCallCount);
                                    if (frames.length === 90) {
                                        app.off('frameend', frame);
                                        app.timeScale = 0;
                                        frames.sort((a, b) => a - b);
                                        resolve({ median: frames[45], p95: frames[85], max: frames[89], draws });
                                    }
                                };
                                app.on('frameend', frame);
                            })
                    );
                    await page.keyboard.down('Space');
                    await page.evaluate(() => {
                        __phase4.useAbilities = true;
                    });
                }
            }
            if (s.wave === 10 && s.dead === 6 && !captured.has('destroyed')) {
                await page.evaluate(() => __phase4.advance(2));
                await expect(page.locator('#wave-banner')).toContainText('PHANTOM NEUTRALIZED');
                await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
                await page.screenshot({ path: 'test-results/fleet-' + renderer + '-phantom-destruction.png' });
                captured.add('destroyed');
            }
            expect(await page.evaluate(() => __phase4.app.root.children.some((e) => /beacon/i.test(e.name)))).toBe(
                false
            );
            if (s.wave >= 11) break;
        }
        expect([...waves]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect([...phases]).toEqual([1, 2, 3]);
        for (const key of ['bomber', 'carrier', 'mixed', 'destroyed'])
            expect(captured.has(key), 'captured ' + key).toBe(true);
        expect(maxShips).toBeLessThanOrEqual(8);
        expect(maxBolts).toBeLessThan(240);
        expect(
            await page
                .locator('.enemy-marker:not(.locked):not([hidden]) meter')
                .evaluateAll((es) => es.every((e) => getComputedStyle(e).display === 'none'))
        ).toBe(true);
        await page.keyboard.up('Space');
        await page.evaluate(() => {
            __phase4.pilot = false;
            __phase4.combat.hurtPlayer(999, __phase4.flight.position);
            __phase4.advance(50);
        });
        await expect(page.locator('#run-grid')).toContainText('PHANTOM');
        expect(
            await page.evaluate(() => JSON.parse(localStorage.getItem('aether-drift-2-records')!).bestPhantomTime)
        ).toBeGreaterThan(0);
        await page.locator('#retry').click();
        await page.evaluate(() => __phase4.advance(3));
        expect(await page.evaluate(() => __phase4.combat.fleet.deployed)).toBe(0);
        expect(await page.evaluate(() => __phase4.combat.phantom.active)).toBe(false);
        console.log(renderer, {
            waves: [...waves],
            phases: [...phases],
            maxShips,
            maxBolts,
            renderEntities: baseline,
            timing,
            carrierTiming
        });
        expect(errors).toEqual([]);
    });
