import { expect, test } from '@playwright/test';

for (const renderer of ['webgpu', 'webgl2'])
    test('Waves 1–16 and Tesser / ' + renderer, async ({ page }) => {
        test.setTimeout(180000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto('http://127.0.0.1:5181/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.locator('#launch').click();
        await page.keyboard.down('KeyZ');
        const baseline = await page.evaluate(() => {
            __phase4.app.timeScale = 0;
            __phase4.pilot = true;
            return __phase4.app.root.findComponents('render').length;
        });
        const waves = new Set<number>(),
            phases = new Set<number>(),
            bosses = new Set<string>();
        let victory = false,
            reactorCapture = false,
            mixed = false,
            maxShips = 0,
            maxBolts = 0;
        let timing: unknown;
        for (let n = 0; n < 2400; n++) {
            const s = await page.evaluate(() => {
                const h = __phase4;
                h.advance(h.combat.guardian.dying > 0 ? 1 : 15);
                const c = h.combat;
                return {
                    wave: c.wave,
                    phase: c.guardian.active && !c.guardian.arriving && c.guardian.grace <= 0 ? c.guardian.phase : 0,
                    dead: c.guardian.deathStage,
                    victory: c.victory,
                    bosses: c.bosses,
                    hull: c.ship.hull,
                    health: c.guardian.health,
                    score: c.score,
                    renders: h.app.root.findComponents('render').length,
                    ships: c.enemies.filter((e) => e.active).length,
                    bolts: c.projectiles.items.filter((p) => p.active).length,
                    name: c.director.encounter?.name ?? '',
                    type: c.boss.active
                        ? c.boss === c.guardian
                            ? 'guardian'
                            : c.boss === c.phantom
                              ? 'phantom'
                              : 'dreadnought'
                        : ''
                };
            });
            waves.add(s.wave);
            if (s.type) bosses.add(s.type);
            expect(s.hull, 'pilot survives Wave ' + s.wave).toBeGreaterThan(0);
            expect(s.renders).toBeLessThanOrEqual(baseline + 250); // demand-loaded, bounded ship visual cache
            maxShips = Math.max(maxShips, s.ships);
            maxBolts = Math.max(maxBolts, s.bolts);
            if (s.phase === 3 && s.health < 600 && !reactorCapture) {
                await page.screenshot({ path: 'test-results/frontier-' + renderer + '-guardian-reactor.png' });
                reactorCapture = true;
            }
            if (!mixed && s.wave >= 8 && s.ships >= 3) {
                await page.screenshot({ path: 'test-results/frontier-' + renderer + '-mixed.png' });
                mixed = true;
            }
            if (s.phase && !phases.has(s.phase)) {
                phases.add(s.phase);
                await expect(page.locator('#boss-name')).toContainText('TESSER');
                await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'boss');
                await page.screenshot({
                    path: 'test-results/frontier-' + renderer + '-guardian-phase' + s.phase + '.png'
                });
                if (s.phase === 1) {
                    await page.keyboard.up('KeyZ');
                    await page.evaluate(() => {
                        __phase4.useAbilities = false;
                    });
                    for (let j = 0; j < 100; j++) {
                        if (
                            await page.evaluate(() => {
                                __phase4.advance(2);
                                return __phase4.combat.guardian.charge > 0;
                            })
                        )
                            break;
                    }
                    expect(await page.evaluate(() => __phase4.combat.guardian.charge)).toBeGreaterThan(0);
                    await page.screenshot({ path: 'test-results/frontier-' + renderer + '-guardian-warning.png' });
                    timing = await page.evaluate(
                        () =>
                            new Promise((resolve) => {
                                const frames: number[] = [],
                                    app = __phase4.app;
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
                    await page.keyboard.down('KeyZ');
                    await page.evaluate(() => {
                        __phase4.useAbilities = true;
                    });
                }
            }
            if (s.wave === 15 && s.dead === 6 && !victory) {
                await page.evaluate(() => __phase4.advance(2));
                await expect(page.locator('#wave-banner')).toContainText('TESSER NEUTRALIZED');
                await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
                await page.screenshot({ path: 'test-results/frontier-' + renderer + '-guardian-destruction.png' });
                victory = true;
            }
            if (s.wave >= 16) break;
        }
        expect([...waves].filter((w) => w > 0)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
        expect([...phases]).toEqual([1, 2]);
        expect([...bosses]).toEqual(['dreadnought', 'phantom', 'guardian']);
        expect(victory).toBe(true);
        expect(await page.evaluate(() => __phase4.combat.upgrades.selections)).toBe(5);
        expect(await page.evaluate(() => __phase4.combat.guardianBosses)).toBe(1);
        expect(maxShips).toBeLessThanOrEqual(8);
        expect(maxBolts).toBeLessThan(240);
        await page.keyboard.up('KeyZ');
        await page.evaluate(() => {
            __phase4.pilot = false;
            __phase4.combat.hurtPlayer(999, __phase4.flight.position);
            __phase4.advance(50);
        });
        await expect(page.locator('#run-grid')).toContainText('TESSER');
        expect(
            await page.evaluate(() => JSON.parse(localStorage.getItem('aether-drift-2-records')!).bestGuardianTime)
        ).toBeGreaterThan(0);
        await page.locator('#retry').click();
        await page.evaluate(() => __phase4.advance(1));
        expect(await page.evaluate(() => __phase4.combat.guardian.active)).toBe(false);
        expect(await page.evaluate(() => __phase4.combat.upgrades.selections)).toBe(0);
        console.log(renderer, {
            waves: [...waves],
            phases: [...phases],
            maxShips,
            maxBolts,
            renderEntities: baseline,
            timing
        });
        expect(errors).toEqual([]);
    });
