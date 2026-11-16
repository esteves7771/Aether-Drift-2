import { expect, test } from '@playwright/test';
import type { RenderComponent } from 'playcanvas';

for (const renderer of ['webgpu', 'webgl2'])
    test('Imported ships and orbital exploration / ' + renderer, async ({ page }) => {
        test.setTimeout(120000);
        const errors: string[] = [];
        const requests: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        page.on('request', (r) => {
            if (r.url().endsWith('.glb')) requests.push(r.url());
        });
        await page.goto('http://127.0.0.1:5181/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        expect(requests.every((u) => /\/(satellite|sci-fi-space-station|astronaut)\.glb$/.test(u))).toBe(true);
        await expect(page.locator('#ship-classic')).toHaveAttribute('aria-pressed', 'true');
        await page.locator('#ship-surveyor').click();
        await expect(page.locator('#ship-status')).toContainText('SURVEYOR READY');
        expect(requests.filter((u) => u.endsWith('/spaceship.glb'))).toHaveLength(1);
        await page.screenshot({ path: 'test-results/models-' + renderer + '-hangar.png' });
        await page.locator('#launch').click();
        await page.evaluate(() => {
            __phase4.app.timeScale = 0;
            __phase4.combat.countdown = 100;
            __phase4.advance(10);
        });
        await page.screenshot({ path: 'test-results/models-' + renderer + '-surveyor-flight.png' });
        for (const angle of [90, 180]) {
            await page.evaluate((a) => {
                const r = __phase4.app.root.findByName('Imported surveyor')!;
                r.children[0].setLocalEulerAngles(0, a, 0);
            }, angle);
            await page.screenshot({ path: 'test-results/models-' + renderer + '-surveyor-' + angle + '.png' });
        }
        await page.evaluate(() =>
            __phase4.app.root.findByName('Imported surveyor')!.children[0].setLocalEulerAngles(0, 0, 0)
        );
        await page.keyboard.down('KeyZ');
        await page.evaluate(() => __phase4.advance(3));
        await page.keyboard.up('KeyZ');
        expect(await page.evaluate(() => __phase4.combat.projectiles.fired)).toBeGreaterThan(0);
        await page.evaluate(() => {
            const h = __phase4;
            h.combat.projectiles.reset();
            for (let i = 0; i < 3; i++) {
                const e = h.combat.enemies[i];
                e.spawn(
                    i === 1 ? 'heavy' : 'interceptor',
                    h.flight.position.clone().set((i - 1) * 20, 0, -65),
                    h.flight.rotation,
                    i === 2
                );
                e.rotation.setFromEulerAngles(0, 180, 0);
                if (i === 2) e.visual = 'saucer';
            }
            h.advance(1);
        });
        await expect.poll(() => page.evaluate(() => __phase4.modelLibrary.loaded)).toBeGreaterThanOrEqual(5);
        await expect
            .poll(() =>
                page.evaluate(() => __phase4.app.root.findByName('Enemy 0')!.findByName('Imported raider')?.enabled)
            )
            .toBe(true);
        await expect
            .poll(() =>
                page.evaluate(() => __phase4.app.root.findByName('Enemy 1')!.findByName('Imported heavy')?.enabled)
            )
            .toBe(true);
        await expect
            .poll(() =>
                page.evaluate(() => __phase4.app.root.findByName('Enemy 2')!.findByName('Imported saucer')?.enabled)
            )
            .toBe(true);
        await page.screenshot({ path: 'test-results/models-' + renderer + '-fleet.png' });
        const bounds = await page.evaluate(() =>
            ['raider', 'heavy', 'saucer'].map((key, index) => {
                const root = __phase4.app.root.findByName('Enemy ' + index)!.findByName('Imported ' + key)!;
                const min = [Infinity, Infinity, Infinity],
                    max = [-Infinity, -Infinity, -Infinity];
                for (const r of root.findComponents('render'))
                    for (const mi of (r as RenderComponent).meshInstances) {
                        const b = mi.aabb,
                            c = [b.center.x, b.center.y, b.center.z],
                            e = [b.halfExtents.x, b.halfExtents.y, b.halfExtents.z];
                        for (let a = 0; a < 3; a++) {
                            min[a] = Math.min(min[a], c[a] - e[a]);
                            max[a] = Math.max(max[a], c[a] + e[a]);
                        }
                    }
                return { key, max: Math.max(...max.map((v, a) => v - min[a])) };
            })
        );
        for (const b of bounds) expect(b.max, 'actual rendered bounds ' + b.key).toBeLessThan(16);
        const frameSample = await page.evaluate(
            () =>
                new Promise((resolve) => {
                    const app = __phase4.app,
                        frames: number[] = [];
                    let last = performance.now(),
                        draws = 0;
                    const count = app.root.findComponents('render').length;
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
                            resolve({
                                median: frames[30],
                                p95: frames[57],
                                max: frames[59],
                                draws,
                                renderBefore: count,
                                renderAfter: app.root.findComponents('render').length
                            });
                        }
                    };
                    app.on('frameend', frame);
                })
        );
        expect(requests.filter((u) => u.includes('sci-fi-space-station'))).toHaveLength(1);
        await page.evaluate(() => {
            const h = __phase4;
            for (const e of h.combat.enemies) e.active = false;
            h.combat.projectiles.reset();
            const w = h.combat.frontier,
                l = w.locations[2];
            w.selected = 2;
            h.flight.position.copy(l.position).add(l.position.clone().set(0, 9, 65));
            h.flight.previous.copy(h.flight.position);
            h.flight.velocity.set(0, 0, 0);
            const aim = h.app.root.findByName('Ship')!;
            aim.setPosition(h.flight.position);
            aim.lookAt(l.position.clone().add(l.position.clone().set(14, -1, 12)));
            h.flight.rotation.copy(aim.getRotation());
            h.flight.previousRotation.copy(h.flight.rotation);
            h.advance(30);
        });
        await page.screenshot({ path: 'test-results/models-' + renderer + '-cargo.png' });
        for (const key of ['iss', 'station'] as const) {
            await page.evaluate((k) => {
                const h = __phase4;
                for (const e of h.combat.enemies) e.active = false;
                h.combat.projectiles.reset();
                const w = h.combat.frontier,
                    l = w.locations.find((l) => l.model === k)!;
                w.selected = w.locations.indexOf(l);
                h.flight.position.copy(l.position).add(l.position.clone().set(0, 20, k === 'iss' ? 190 : 310));
                h.flight.previous.copy(h.flight.position);
                h.flight.velocity.set(0, 0, 0);
                const aim = h.app.root.findByName('Ship')!;
                aim.setPosition(h.flight.position);
                aim.lookAt(l.position);
                h.flight.rotation.copy(aim.getRotation());
                h.flight.previousRotation.copy(h.flight.rotation);
                h.flight.shield = 10;
                h.advance(35);
            }, key);
            await expect
                .poll(() =>
                    page.evaluate(
                        (k) =>
                            Boolean(
                                __phase4.app.root.findByName('Imported orbital landmarks')!.findByName('Imported ' + k)
                            ),
                        key
                    )
                )
                .toBe(true);
            await page.screenshot({ path: 'test-results/models-' + renderer + '-' + key + '.png' });
            const extent = await page.evaluate((k) => {
                const root = __phase4.app.root.findByName('Imported orbital landmarks')!.findByName('Imported ' + k)!;
                const min = [Infinity, Infinity, Infinity],
                    max = [-Infinity, -Infinity, -Infinity];
                for (const r of root.findComponents('render'))
                    for (const mi of (r as RenderComponent).meshInstances) {
                        const b = mi.aabb,
                            c = [b.center.x, b.center.y, b.center.z],
                            e = [b.halfExtents.x, b.halfExtents.y, b.halfExtents.z];
                        for (let a = 0; a < 3; a++) {
                            min[a] = Math.min(min[a], c[a] - e[a]);
                            max[a] = Math.max(max[a], c[a] + e[a]);
                        }
                    }
                return Math.max(...max.map((v, a) => v - min[a]));
            }, key);
            expect(extent).toBeGreaterThan(100);
            expect(extent).toBeLessThan(key === 'iss' ? 190 : 320);
            await page.evaluate(() => {
                const h = __phase4,
                    l = h.combat.frontier.locations[h.combat.frontier.selected];
                h.flight.position.copy(l.position).add(l.position.clone().set(0, 0, 65));
                h.flight.previous.copy(h.flight.position);
                h.flight.shield = 10;
                h.advance(1);
            });
            await page.evaluate(() => {
                const h = __phase4;
                h.combat.ammo = h.combat.frontier.interact(h.flight, h.combat.ammo, h.combat.ammoCapacity);
            }); // Retained internal service, no player shortcut.
            await page.evaluate(() => __phase4.advance(1));
            expect(
                await page.evaluate(() => __phase4.combat.frontier.locations[__phase4.combat.frontier.selected].used)
            ).toBe(true);
        }
        expect(await page.evaluate(() => __phase4.modelLibrary.failures.size)).toBe(0);
        const loaded = await page.evaluate(() => __phase4.modelLibrary.loaded);
        // Flight/exploration models, existing living-space props and the shared menu satellite.
        expect(loaded).toBe(10);
        const entities = await page.evaluate(() => __phase4.app.root.findComponents('render').length);
        await page.keyboard.press('Escape');
        await page.locator('#restart').click();
        await page.locator('#restart-accept').click();
        await page.evaluate(() => __phase4.advance(1));
        expect(await page.evaluate(() => __phase4.hangar.selected)).toBe('surveyor');
        expect(await page.evaluate(() => __phase4.modelLibrary.loaded)).toBe(loaded);
        for (let i = 0; i < 3; i++) {
            await page.keyboard.press('r');
            await page.locator('#restart-accept').click();
            await page.evaluate(() => __phase4.advance(1));
        }
        expect(await page.evaluate(() => __phase4.app.root.findComponents('render').length)).toBe(entities);
        console.log(renderer, { loadedModels: loaded, requests: requests.length, entities, frameSample, errors });
        expect(errors).toEqual([]);
    });
