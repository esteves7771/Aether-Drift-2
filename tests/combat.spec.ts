import { expect, test } from '@playwright/test';
import type { AppBase } from 'playcanvas';
for (const renderer of ['webgpu', 'webgl2'])
    test(`dogfight / ${renderer}`, async ({ page }) => {
        test.setTimeout(90000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.addInitScript({ path: '.agents/skills/inspect-runtime/scripts/devtools-hook.js' });
        await page.goto(renderer === 'webgl2' ? '/?webgl' : '/');
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.locator('#launch').click();
        await expect(page.locator('.enemy-marker:not([hidden])')).toHaveCount(2);
        const initial = await page.evaluate(() => {
            const app = [
                ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
            ][0];
            return {
                entities: app.root.findByName('Combat')!.findComponents('render').length,
                position: app.root.findByName('Enemy 0')!.getPosition().clone()
            };
        });
        await page.waitForTimeout(350);
        const moved = await page.evaluate(() => {
            const app = [
                ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
            ][0];
            const p = app.root.findByName('Enemy 0')!.getPosition();
            return { x: p.x, y: p.y, z: p.z };
        });
        expect(
            Math.abs(moved.x - initial.position.x) +
                Math.abs(moved.y - initial.position.y) +
                Math.abs(moved.z - initial.position.z)
        ).toBeGreaterThan(1);
        // Exercise actual mouse firing before the keyboard-driven dogfight.
        await page.mouse.move(720, 450);
        await page.mouse.down();
        await expect
            .poll(async () => Number(await page.locator('#combat-perf').getAttribute('data-projectiles')))
            .toBeGreaterThan(0);
        await page.mouse.up();
        await page.keyboard.down('KeyZ');
        const deadline = Date.now() + 22000;
        let maxWave = 0;
        while (Date.now() < deadline) {
            await page.mouse.click(720, 450, { button: 'right' });
            await page.waitForTimeout(180);
            maxWave = Number(await page.locator('#combat-perf').getAttribute('data-wave'));
            if (maxWave >= 2) break;
        }
        await page.keyboard.up('KeyZ');
        expect(Number(await page.locator('#score').textContent())).toBeGreaterThanOrEqual(200);
        expect(maxWave).toBeGreaterThanOrEqual(2);
        await expect(page.locator('.enemy-marker[data-kind="heavy"]:not([hidden])')).toHaveCount(1);
        await page.screenshot({ path: `test-results/combat-${renderer}.png` });
        const pool = await page.evaluate(() => {
            const app = [
                ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
            ][0];
            return app.root.findByName('Combat')!.findComponents('render').length;
        });
        expect(pool).toBe(initial.entities);
        await page.keyboard.press('Escape');
        const score = await page.locator('#score').textContent(),
            shield = await page.locator('#shield').getAttribute('value');
        await page.waitForTimeout(400);
        expect(await page.locator('#score').textContent()).toBe(score);
        expect(await page.locator('#shield').getAttribute('value')).toBe(shield);
        await page.locator('#restart').click();
        await page.locator('#restart-accept').click();
        await expect(page.locator('#score')).toHaveText('000000');
        await expect(page.locator('#shield')).toHaveAttribute('value', '70');
        await expect
            .poll(async () => Number(await page.locator('#combat-perf').getAttribute('data-enemy-hits')), {
                timeout: 20000
            })
            .toBeGreaterThan(0);
        await expect(page.locator('#menu-heading')).toContainText('Ship lost', { timeout: 50000 });
        expect(Number(await page.locator('#hull').getAttribute('value'))).toBe(0);
        await page.locator('#retry').click();
        await expect(page.locator('#menu')).toBeHidden();
        await expect(page.locator('#hull')).toHaveAttribute('value', '100');
        expect(errors).toEqual([]);
    });
