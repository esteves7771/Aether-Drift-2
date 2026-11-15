import { expect, test } from '@playwright/test';

for (const renderer of ['webgpu', 'webgl2'])
    test('Living space assets / ' + renderer, async ({ page }) => {
        test.setTimeout(120000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto('http://127.0.0.1:5181/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        await page.evaluate(() => {
            __phase4.app.timeScale = 0;
        });
        await page.evaluate(() => __phase4.advance(2));
        await page.screenshot({ path: 'artifacts/phase5e/asteroids-' + renderer + '.png' });
        const timings: Record<string, unknown> = {};
        const sample = async (name: string) => {
            timings[name] = await page.evaluate(
                () =>
                    new Promise((resolve) => {
                        const frames: number[] = [],
                            h = __phase4;
                        let last = performance.now(),
                            draws = 0;
                        const count = h.app.root.findComponents('render').length;
                        h.app.timeScale = 1;
                        const frame = () => {
                            const now = performance.now();
                            frames.push(now - last);
                            last = now;
                            draws = Math.max(draws, h.app.stats.drawCallCount);
                            if (frames.length === 45) {
                                h.app.off('frameend', frame);
                                h.app.timeScale = 0;
                                frames.sort((a, b) => a - b);
                                resolve({
                                    median: frames[22],
                                    p95: frames[42],
                                    max: frames[44],
                                    draws,
                                    entitiesBefore: count,
                                    entitiesAfter: h.app.root.findComponents('render').length
                                });
                            }
                        };
                        h.app.on('frameend', frame);
                    })
            );
        };
        expect(await page.evaluate(() => __phase4.app.root.findByName('Guardian rotating weapon tower'))).toBeNull();
        await sample('asteroid-field');
        await page.evaluate(() => __phase4.advance(45));
        await page.screenshot({ path: 'artifacts/phase5e/arrival-' + renderer + '.png' });
        await page.evaluate(() => {
            const h = __phase4,
                b = h.combat.frontier.bases[0];
            h.flight.position.copy(b.parts[0].position);
            h.flight.position.z += 95;
            h.flight.previous.copy(h.flight.position);
            h.flight.velocity.set(0, 0, 0);
            h.advance(10);
        });
        await page.waitForFunction(() => __phase4.modelLibrary.loaded >= 2);
        await page.screenshot({ path: 'artifacts/phase5e/installation-' + renderer + '.png' });
        await sample('multi-turret-site');
        await page.evaluate(() => {
            const h = __phase4,
                b = h.combat.barrels.items.find((b) => b.active && b.id >= 46)!;
            h.flight.position.copy(b.position);
            h.flight.position.z += 30;
            h.flight.previous.copy(h.flight.position);
            h.flight.velocity.set(0, 0, 0);
            h.flight.rotation.setFromEulerAngles(0, 0, 0);
            h.flight.previousRotation.copy(h.flight.rotation);
            h.combat.selected = b.id;
            h.advance(30);
        });
        await page.screenshot({ path: 'artifacts/phase5e/barrels-' + renderer + '.png' });
        await page.keyboard.down('Space');
        await page.evaluate(() => __phase4.advance(5));
        await page.keyboard.up('Space');
        expect(
            await page.evaluate(() => __phase4.combat.barrels.items.filter((b) => !b.active).length)
        ).toBeGreaterThan(0);
        await page.screenshot({ path: 'artifacts/phase5e/barrel-blast-' + renderer + '.png' });
        await sample('barrel-explosion');
        await page.evaluate(() => {
            const h = __phase4,
                l = h.combat.frontier.locations.find((l) => l.model === 'iss')!;
            h.flight.position.copy(l.position);
            h.flight.position.x += 22;
            h.flight.position.y += 9;
            h.flight.position.z += 12;
            h.flight.previous.copy(h.flight.position);
            h.advance(12);
        });
        await page.waitForFunction(() => __phase4.app.root.findByName('Noncombat EVA iss 0') !== null);
        const before = await page.evaluate(() => {
            const e = __phase4.app.root.findByName('Noncombat EVA iss 0')!;
            return [
                e.findByName('L_Knee.83')!.getLocalRotation().toString(),
                e.findByName('R_Arm.44')!.getLocalRotation().toString()
            ];
        });
        await page.evaluate(() => {
            __phase4.app.timeScale = 1;
        });
        await page.waitForFunction(() => {
            const e = __phase4.app.root.findByName('Noncombat EVA iss 0')!;
            return e.findComponents('anim')[0].baseLayer.activeStateCurrentTime > 0.8;
        });
        const after = await page.evaluate(() => {
            __phase4.app.timeScale = 0;
            const e = __phase4.app.root.findByName('Noncombat EVA iss 0')!;
            return [
                e.findByName('L_Knee.83')!.getLocalRotation().toString(),
                e.findByName('R_Arm.44')!.getLocalRotation().toString()
            ];
        });
        expect(before[0]).not.toBe(after[0]);
        expect(before[1]).not.toBe(after[1]);
        await page.screenshot({ path: 'artifacts/phase5e/astronaut-' + renderer + '.png' });
        await sample('station-eva');
        await page.keyboard.press('Escape');
        const paused = await page.evaluate(() => __phase4.combat.duration);
        await page.evaluate(() => {
            __phase4.app.timeScale = 1;
        });
        await page.waitForTimeout(180);
        expect(await page.evaluate(() => __phase4.combat.duration)).toBe(paused);
        await page.keyboard.press('Escape');
        await page.keyboard.press('KeyR');
        await page.locator('#restart-accept').click();
        expect(await page.evaluate(() => __phase4.combat.barrels.items.every((b) => b.active))).toBe(true);
        const warmed = await page.evaluate(() => __phase4.app.root.findComponents('render').length);
        for (let i = 0; i < 2; i++) {
            await page.keyboard.press('KeyR');
        await page.locator('#restart-accept').click();
            await page.evaluate(() => __phase4.advance(2));
        }
        expect(await page.evaluate(() => __phase4.app.root.findComponents('render').length)).toBe(warmed);
        // Isolated art fixture; the separate progression test reaches Wave 15 through combat.
        await page.evaluate(() => {
            const h = __phase4;
            h.combat.director.wave = 15;
            h.combat.director.group = 1;
            h.combat.countdown = 100;
            h.combat.guardian.spawn(h.flight, h.rocks);
            h.app.timeScale = 0;
            h.advance(130);
        });
        await page.waitForFunction(() => __phase4.app.root.findByName('Imported tesser') !== null);
        await page.evaluate(() => __phase4.advance(2));
        await page.screenshot({ path: 'artifacts/phase5e/tesser-' + renderer + '.png' });
        await page.keyboard.press('Escape');
        await page.locator('#end-patrol').click();
        await page.locator('#return-home').click();
        await page.waitForFunction(() => !__phase4.app.root.findByName('Tesser warship')!.enabled);
        expect(await page.evaluate(() => __phase4.app.root.findByName('Tesser locked attack warning')!.enabled)).toBe(
            false
        );
        console.log(renderer, JSON.stringify(timings));
        expect(errors).toEqual([]);
    });
