import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { AppBase } from 'playcanvas';

// Read the actual graphics canvas at frameend. HTML/CSS HUD pixels are never included.
async function canvasPixels(page: Page, only: 'all' | 'ship' | 'stars' = 'all') {
    return page.evaluate(async (selection) => {
        const app = [
            ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
        ][0];
        const saved = app.root.children.map((entity) => ({ entity, enabled: entity.enabled }));
        if (selection !== 'all') {
            for (const { entity } of saved)
                entity.enabled =
                    entity.name === 'Chase camera' ||
                    (selection === 'ship'
                        ? entity.name === 'Ship' || entity.name === 'Starlight' || entity.name === 'Magenta rim'
                        : entity.name === 'Stars');
        }
        const pixels = await new Promise<number>((resolve) =>
            app.once('frameend', () => {
                const source = app.graphicsDevice.canvas as HTMLCanvasElement;
                const copy = document.createElement('canvas');
                copy.width = source.width;
                copy.height = source.height;
                const ctx = copy.getContext('2d', { willReadFrequently: true })!;
                ctx.drawImage(source, 0, 0);
                const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
                let bright = 0;
                for (let i = 0; i < data.length; i += 4) if (Math.max(data[i], data[i + 1], data[i + 2]) > 60) bright++;
                resolve(bright);
            })
        );
        for (const { entity, enabled } of saved) entity.enabled = enabled;
        return pixels;
    }, only);
}

for (const renderer of ['webgpu', 'webgl2'])
    test(`real canvas visibility / ${renderer}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });
        await page.addInitScript({ path: '.agents/skills/inspect-runtime/scripts/devtools-hook.js' });
        await page.goto(renderer === 'webgl2' ? '/?webgl' : '/');
        await expect(page.locator('#perf')).toContainText(/WEBGPU|WEBGL2/);
        const backend = await page.evaluate(
            () =>
                [...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()][0]
                    .graphicsDevice.deviceType
        );
        test.skip(renderer === 'webgpu' && backend !== 'webgpu', 'WebGPU is unavailable on this browser/GPU.');
        expect(backend).toBe(renderer);
        expect(await canvasPixels(page)).toBeGreaterThan(10000);
        // Isolate each contributor: visible HUD or asteroids cannot conceal a missing ship/starfield.
        expect(await canvasPixels(page, 'ship')).toBeGreaterThan(800);
        expect(await canvasPixels(page, 'stars')).toBeGreaterThan(50);
        await page.screenshot({ path: `test-results/visible-menu-${renderer}.png` });
        await page.locator('#launch').click();
        expect(await canvasPixels(page)).toBeGreaterThan(10000);
        await page.keyboard.down('KeyW');
        await page.keyboard.down('ShiftLeft');
        await page.waitForTimeout(500);
        expect(await canvasPixels(page)).toBeGreaterThan(10000);
        await page.keyboard.up('KeyW');
        await page.keyboard.up('ShiftLeft');
        await page.keyboard.down('ArrowRight');
        await page.keyboard.down('KeyE');
        await page.waitForTimeout(300);
        await page.keyboard.up('ArrowRight');
        await page.keyboard.up('KeyE');
        expect(await canvasPixels(page)).toBeGreaterThan(3000);
        await page.keyboard.press('Escape');
        await expect(page.locator('#menu')).toBeVisible();
        expect(await canvasPixels(page)).toBeGreaterThan(3000);
        await page.locator('#restart').click();
        await page.waitForTimeout(150);
        expect(await canvasPixels(page, 'ship')).toBeGreaterThan(800);
        expect(await canvasPixels(page)).toBeGreaterThan(10000);
        await page.screenshot({ path: `test-results/visible-flight-${renderer}.png` });
        expect(
            await page.evaluate(
                () =>
                    [
                        ...(
                            globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }
                        ).__playcanvasApps.keys()
                    ][0].root.findByName('DIAGNOSTIC CUBE') === null
            )
        ).toBe(true);
        expect(errors).toEqual([]);
    });
