import { expect, test } from '@playwright/test';

for (const backend of ['webgpu', 'webgl2'])
    test('production cockpit URLs / ' + backend, async ({ page, baseURL }) => {
        const errors: string[] = [],
            failed: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        page.on('response', (r) => {
            if (r.status() >= 400) failed.push(r.url());
        });
        await page.goto(baseURL! + (backend === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(backend.toUpperCase());
        await page.locator('#launch').click();
        await page.keyboard.press('c');
        await expect(page.locator('#cockpit')).toBeVisible();
        await page.locator('#cockpit-art').evaluate((image: HTMLImageElement) => image.decode());
        expect(await page.locator('#cockpit-art').getAttribute('src')).toContain(
            '/Aether-Drift-2/images/cockpit-overlay.png'
        );
        const canopy = await page.locator('.cockpit-canopy').evaluate((e) => getComputedStyle(e).backgroundImage);
        expect(canopy).toContain('/Aether-Drift-2/images/cockpit-overlay.png');
        expect(canopy).not.toContain('/assets/images/');
        await page.keyboard.down('w');
        await page.waitForTimeout(350);
        const speed = Number(await page.locator('#speed').textContent());
        await page.locator('#camera-toggle').click();
        await expect.poll(async () => Number(await page.locator('#speed').textContent())).toBeGreaterThan(speed + 2);
        await page.keyboard.up('w');
        await page.keyboard.press('r');
        await expect(page.locator('#restart-confirm')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('#menu')).toBeHidden();
        expect(errors).toEqual([]);
        expect(failed).toEqual([]);
    });
