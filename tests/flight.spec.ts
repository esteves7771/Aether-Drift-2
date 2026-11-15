import { test, expect } from '@playwright/test';
import type { AppBase } from 'playcanvas';
for (const mode of ['webgl', 'auto'])
    test(`flight lifecycle / ${mode}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.addInitScript({ path: '.agents/skills/inspect-runtime/scripts/devtools-hook.js' });
        await page.goto(mode === 'webgl' ? '/?webgl' : '/');
        await expect(page.locator('#launch')).toBeVisible();
        await expect(page.locator('#perf')).toContainText(/WEBGL2|WEBGPU/);
        await page.screenshot({ path: `test-results/menu-${mode}.png` });
        await page.locator('#launch').click();
        await expect(page.locator('#menu')).toBeHidden();
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(1400);
        await page.keyboard.up('KeyW');
        expect(Number(await page.locator('#speed').textContent())).toBeGreaterThan(10);
        await page.keyboard.press('Escape');
        await expect(page.locator('#menu')).toBeVisible();
        const speed = await page.locator('#speed').textContent();
        await page.waitForTimeout(300);
        expect(await page.locator('#speed').textContent()).toBe(speed);
        await page.locator('#show-settings').click();
        await page.locator('#distance').fill('26');
        await page.locator('#assist').uncheck();
        await page.locator('#menu-back').click();
        await page.locator('#restart').click();
        await page.locator('#restart-accept').click();
        await expect(page.locator('#menu')).toBeHidden();
        await expect(page.locator('#speed')).toHaveText('000');
        await page.keyboard.down('ArrowRight');
        await page.keyboard.down('KeyE');
        await page.waitForTimeout(400);
        await page.keyboard.up('ArrowRight');
        await page.keyboard.up('KeyE');
        const pose = await page.evaluate(() => {
            const apps = (globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps;
            const app = [...apps.keys()][0];
            const ship = app.root.findByName('Ship');
            return {
                yaw: ship!.getRotation().y,
                roll: ship!.getRotation().z,
                entities: app.root.findByName('Stars')!.render!.meshInstances.length,
                ratio: app.graphicsDevice.canvas.width / app.graphicsDevice.canvas.clientWidth
            };
        });
        expect(Math.abs(pose.yaw)).toBeGreaterThan(0.1);
        expect(Math.abs(pose.roll)).toBeGreaterThan(0.1);
        expect(pose.entities).toBe(1);
        expect(pose.ratio).toBeGreaterThanOrEqual(0.79);
        await page.locator('canvas').click({ position: { x: 700, y: 400 } });
        await expect.poll(() => page.evaluate(() => document.pointerLockElement?.tagName)).toBe('CANVAS');
        await page.mouse.move(780, 440, { steps: 6 });
        await page.waitForTimeout(100);
        await page.keyboard.press('Escape');
        await expect(page.locator('#menu')).toBeVisible();
        await page.locator('#launch').click();
        await page.keyboard.press('KeyR');
        await page.locator('#restart-accept').click();
        await page.keyboard.down('KeyW');
        await page.keyboard.down('ShiftLeft');
        await expect
            .poll(async () => Number(await page.locator('#hull').getAttribute('value')), { timeout: 15000 })
            .toBeLessThan(100);
        await page.keyboard.up('KeyW');
        await page.keyboard.up('ShiftLeft');
        await page.screenshot({ path: `test-results/flight-${mode}.png` });
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await expect(page.locator('#menu')).toBeVisible();
        await page.setViewportSize({ width: 800, height: 600 });
        await expect(page.locator('#launch')).toBeVisible();
        expect(errors).toEqual([]);
    });
