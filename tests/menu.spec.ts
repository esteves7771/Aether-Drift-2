import fs from 'node:fs';

import { expect, test } from '@playwright/test';
import type { AppBase, RenderComponent } from 'playcanvas';

for (const renderer of ['webgpu', 'webgl2'])
    test('command deck / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [],
            failures: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        page.on('response', (r) => {
            if (r.status() >= 400) failures.push(r.status() + ' ' + r.url());
        });
        await page.addInitScript({ path: '.agents/skills/inspect-runtime/scripts/devtools-hook.js' });
        await page.goto(baseURL! + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.waitForFunction(() => {
            const app = [
                ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
            ][0];
            return app.root.findByName('Menu satellite 3') && app.root.findByName('Menu Kepler orbital');
        });
        await expect(page.locator('#status-best')).toHaveText('0');
        await expect(page.locator('#status-wave')).toHaveText('WAVE 0');
        expect(
            await page
                .locator('#ship-hangar img')
                .evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0))
        ).toBe(true);
        fs.mkdirSync('artifacts/phase5fa', { recursive: true });
        for (const [width, height] of [
            [1920, 1080],
            [1600, 900],
            [1440, 900],
            [1366, 768],
            [1280, 720],
            [2560, 1080],
            [960, 600]
        ]) {
            await page.setViewportSize({ width, height });
            // Wait for the Engine's resize event/frame instead of assuming a GPU-dependent delay.
            await expect
                .poll(() =>
                    page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])
                )
                .toEqual([width, height]);
            const fits = await page.evaluate(() => {
                const visible = [
                    '#launch',
                    '#show-ships',
                    '#show-records',
                    '#show-settings',
                    '#show-credits',
                    '#ship-classic',
                    '#ship-surveyor',
                    '.command-status'
                ];
                return {
                    scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
                    controls: visible.map((id) => {
                        const r = document.querySelector(id)!.getBoundingClientRect();
                        return { id, x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height };
                    })
                };
            });
            expect(fits.scroll).toEqual([width, height]);
            for (const r of fits.controls) {
                expect(r.x, r.id).toBeGreaterThanOrEqual(0);
                expect(r.y, r.id).toBeGreaterThanOrEqual(0);
                expect(r.right, r.id).toBeLessThanOrEqual(width);
                expect(r.bottom, r.id).toBeLessThanOrEqual(height);
                expect(r.height, r.id).toBeGreaterThanOrEqual(30);
            }
            if ([1920, 1366, 1280].includes(width))
                await page.screenshot({ path: `artifacts/phase5fa/${renderer}-${width}x${height}.png` });
        }
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.locator('#show-ships').click();
        await expect(page.locator('#ship-classic')).toBeFocused();
        await page.locator('#ship-surveyor').click();
        await expect(page.locator('#ship-surveyor')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.ship-index')).toHaveText('SURVEYOR / EXPLORER');
        await page.waitForTimeout(600);
        await page.screenshot({ path: `artifacts/phase5fa/${renderer}-surveyor.png` });
        await page.locator('#ship-classic').click();
        await expect(page.locator('#ship-classic')).toHaveAttribute('aria-pressed', 'true');
        await page.locator('#show-records').click();
        await expect(page.locator('#record-grid')).toContainText('HIGH SCORE');
        await page.locator('#menu-back').click();
        await page.locator('#show-credits').click();
        await expect(page.locator('#credits-panel')).toBeVisible();
        for (const link of await page
            .locator('.credits-links a')
            .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href)))
            expect((await page.request.get(link)).status()).toBe(200);
        await page.keyboard.press('Escape');
        await page.locator('#show-settings').click();
        for (const q of ['low', 'high', 'medium']) {
            await page.locator('#graphics').selectOption(q);
            await page.waitForTimeout(150);
        }
        await page.locator('#menu-back').click();
        const read = () =>
            page.evaluate(() => {
                const app = [
                        ...(
                            globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }
                        ).__playcanvasApps.keys()
                    ][0],
                    menu = app.root.findByName('Command deck scenery')!;
                return {
                    satellite: menu.findByName('Menu satellite 0')!.getPosition().toString(),
                    enabled: menu.enabled,
                    count: menu.findComponents('render').length,
                    ship: app.root
                        .findByName('Ship')!
                        .findComponents('render')
                        .map((c) => (c as RenderComponent).meshInstances.length)
                        .reduce((a, b) => a + b, 0)
                };
            });
        const first = await read();
        await page.waitForTimeout(250);
        expect((await read()).satellite).not.toBe(first.satellite);
        const samples = await page.evaluate(async () => {
            const app = [
                    ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
                ][0],
                times: number[] = [];
            let previous = performance.now();
            await new Promise<void>((resolve) => {
                const frame = () => {
                    const now = performance.now();
                    times.push(now - previous);
                    previous = now;
                    if (times.length === 60) {
                        app.off('frameend', frame);
                        resolve();
                    }
                };
                app.on('frameend', frame);
            });
            const sorted = times.slice(20).sort((a, b) => a - b);
            return { median: sorted[20], p95: sorted[38], draws: app.stats.drawCallCount };
        });
        fs.writeFileSync(`artifacts/phase5fa/${renderer}-performance.json`, JSON.stringify(samples, null, 2));
        await page.locator('#launch').click();
        await expect(page.locator('#menu')).toBeHidden();
        await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
        await expect.poll(async () => (await read()).enabled).toBe(false);
        const stopped = (await read()).satellite;
        await page.keyboard.down('KeyW');
        await page.keyboard.down('Space');
        await page.waitForTimeout(500);
        await page.keyboard.up('KeyW');
        await page.keyboard.up('Space');
        expect((await read()).satellite).toBe(stopped);
        await page.keyboard.press('Escape');
        await expect(page.locator('#menu')).toHaveAttribute('data-screen', 'pause');
        await page.locator('#restart').click();
        await page.locator('#restart-accept').click();
        await expect(page.locator('#menu')).toBeHidden();
        await page.keyboard.press('Escape');
        await page.locator('#end-patrol').click();
        await page.locator('#return-home').click();
        await expect(page.locator('#menu')).toHaveAttribute('data-screen', 'home');
        await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'menu');
        expect((await read()).count).toBe(first.count);
        await page.evaluate(() =>
            localStorage.setItem('aether-drift-2-records', JSON.stringify({ version: 1, highScore: 9876, highWave: 7 }))
        );
        await page.reload();
        await expect(page.locator('#status-best')).toHaveText('9,876');
        await expect(page.locator('#status-wave')).toHaveText('WAVE 7');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.reload();
        await page.waitForFunction(() => {
            const app = [
                ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
            ][0];
            return app?.root.findByName('Menu satellite 3');
        });
        const still = (await read()).satellite;
        await page.waitForTimeout(200);
        expect((await read()).satellite).toBe(still);
        expect(errors).toEqual([]);
        expect(failures).toEqual([]);
    });
