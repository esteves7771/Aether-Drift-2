import { expect, test } from '@playwright/test';
import type { AppBase } from 'playcanvas';
for (const renderer of ['webgpu', 'webgl2'])
    test(`visual presets / ${renderer}`, async ({ page }) => {
        test.setTimeout(60000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.addInitScript({ path: '.agents/skills/inspect-runtime/scripts/devtools-hook.js' });
        await page.goto(renderer === 'webgl2' ? '/?webgl' : '/');
        await expect(page.locator('#launch')).toBeVisible();
        await page.locator('#show-settings').click();
        const profiles: Record<string, unknown> = {};
        for (const preset of ['low', 'medium', 'high', 'medium']) {
            await page.locator('#graphics').selectOption(preset);
            await expect(page.locator('body')).toHaveAttribute('data-graphics', preset);
            await page.waitForTimeout(300);
            const sample = await page.evaluate(async () => {
                const app = [
                    ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
                ][0];
                const frames: number[] = [];
                let previous = performance.now();
                await new Promise<void>((resolve) => {
                    const step = () => {
                        const now = performance.now();
                        frames.push(now - previous);
                        previous = now;
                        if (frames.length < 90) app.once('frameend', step);
                        else resolve();
                    };
                    app.once('frameend', step);
                });
                const canvas = app.graphicsDevice.canvas as HTMLCanvasElement,
                    copy = document.createElement('canvas');
                copy.width = canvas.width;
                copy.height = canvas.height;
                const ctx = copy.getContext('2d')!;
                await new Promise<void>((resolve) =>
                    app.once('frameend', () => {
                        ctx.drawImage(canvas, 0, 0);
                        resolve();
                    })
                );
                const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
                let lit = 0;
                for (let i = 0; i < data.length; i += 4) if (Math.max(data[i], data[i + 1], data[i + 2]) > 60) lit++;
                frames.sort((a, b) => a - b);
                const ship = app.root.findByName('Fuselage')!,
                    render = ship.render!;
                return {
                    lit,
                    p50: frames[45],
                    p95: frames[85],
                    draws: app.stats.drawCallCount,
                    ratio: canvas.width / canvas.clientWidth,
                    meshCount: render.meshInstances.length,
                    triangles: render.meshInstances.reduce((n, i) => n + (i.mesh?.primitive[0].count || 0) / 3, 0),
                    backend: app.graphicsDevice.deviceType
                };
            });
            expect(sample.lit).toBeGreaterThan(9000);
            expect(sample.meshCount).toBeGreaterThan(4);
            expect(sample.triangles).toBeGreaterThan(500);
            profiles[preset] = sample;
            await page.locator('#menu-back').click();
            await page.locator('#launch').click();
            await page.waitForTimeout(200);
            await page.keyboard.down('KeyZ');
            await page.waitForTimeout(100);
            await page.screenshot({ path: `test-results/spectacle-${renderer}-${preset}.png` });
            await page.keyboard.up('KeyZ');
            await page.keyboard.press('Escape');
            await page.locator('#show-settings').click();
        }
        console.log(renderer, JSON.stringify(profiles));
        expect(errors).toEqual([]);
    });
