import { expect, test } from '@playwright/test';
for (const renderer of ['webgpu', 'webgl2'])
    test('Arcade presentation and records / ' + renderer, async ({ page }) => {
        test.setTimeout(90000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto('http://127.0.0.1:5181/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#menu-heading')).toHaveText('Find your flow.');
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        const turn = await page.evaluate(() => __phase4.app.root.findByName('Ship')!.getRotation().clone());
        await expect
            .poll(() => page.evaluate(() => __phase4.app.root.findByName('Ship')!.getRotation().y))
            .not.toBe(turn.y);
        await page.screenshot({ path: 'test-results/arcade-' + renderer + '-menu.png' });
        await page.locator('#show-records').click();
        await expect(page.locator('#record-grid')).toContainText('HIGH SCORE');
        await page.keyboard.press('Escape');
        await expect(page.locator('#menu')).toHaveAttribute('data-screen', 'home');
        await page.locator('#show-settings').click();
        for (const quality of ['low', 'high', 'medium']) {
            await page.locator('#graphics').selectOption(quality);
            await page.waitForTimeout(300);
        }
        await page.locator('#masterVolume').fill('0');
        await page.locator('#masterVolume').dispatchEvent('input');
        await page.locator('#masterVolume').fill('1');
        await page.locator('#masterVolume').dispatchEvent('input');
        await page.keyboard.press('Escape');
        await page.locator('#launch').focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#menu')).toBeHidden();
        await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
        await page.keyboard.down('Space');
        await page.evaluate(() => {
            __phase4.app.timeScale = 0;
            __phase4.pilot = true;
        });
        for (let i = 0; i < 60; i++) {
            const kills = await page.evaluate(() => {
                __phase4.advance(4);
                return __phase4.combat.kills;
            });
            if (kills >= 3) break;
        }
        expect(await page.evaluate(() => __phase4.combat.kills)).toBeGreaterThanOrEqual(3);
        expect(await page.evaluate(() => __phase4.combat.flow.shots)).toBeGreaterThan(0);
        // Every ordinary target has compact geometry; only the selected contact exposes a label/bar.
        expect(
            await page
                .locator('.enemy-marker:not(.locked):not([hidden]) span')
                .evaluateAll((nodes) => nodes.every((n) => getComputedStyle(n).display === 'none'))
        ).toBe(true);
        await page.screenshot({ path: 'test-results/arcade-' + renderer + '-combat.png' });
        await page.keyboard.up('Space');
        await page.keyboard.press('Escape');
        const flow = await page.evaluate(() => ({
            score: __phase4.combat.score,
            time: __phase4.combat.flow.activity,
            chain: __phase4.combat.flow.chain
        }));
        await page.locator('#show-settings').click();
        await page.evaluate(() => __phase4.advance(40));
        await page.keyboard.press('Escape');
        expect(
            await page.evaluate(() => ({
                score: __phase4.combat.score,
                time: __phase4.combat.flow.activity,
                chain: __phase4.combat.flow.chain
            }))
        ).toEqual(flow);
        await expect(page.locator('#menu')).toHaveAttribute('data-screen', 'pause');
        await page.locator('#launch').click();
        await page.evaluate(() => {
            __phase4.pilot = false;
            __phase4.combat.hurtPlayer(999, __phase4.flight.position);
            __phase4.advance(3);
        });
        await expect(page.locator('#menu')).toHaveAttribute('data-screen', 'debrief');
        await expect(page.locator('#run-grid')).toContainText('ACCURACY');
        await expect(page.locator('#run-records')).toContainText('NEW PERSONAL');
        await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'death');
        const stopped = await page.evaluate(() => __phase4.combat.duration);
        await page.evaluate(() => __phase4.advance(50));
        expect(await page.evaluate(() => __phase4.combat.duration)).toBe(stopped);
        expect(
            await page.evaluate(() =>
                __phase4.app.root
                    .findByName('Combat')!
                    .children.filter((e) => e.name.startsWith('Impact effect'))
                    .some((e) => e.enabled)
            )
        ).toBe(false);
        await page.waitForTimeout(180);
        await page.screenshot({ path: 'test-results/arcade-' + renderer + '-debrief.png' });
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aether-drift-2-records')!));
        expect(saved.highScore).toBe(flow.score);
        expect(saved.runs).toBe(1);
        expect(saved.bestRun.hits).toBeGreaterThan(0);
        await page.locator('#return-home').click();
        await page.evaluate(() => (__phase4.app.timeScale = 1));
        await expect(page.locator('#menu')).toHaveAttribute('data-screen', 'home');
        await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'menu');
        await page.reload();
        await page.locator('#show-records').click();
        await expect(page.locator('#record-grid')).toContainText(String(saved.highScore.toLocaleString('en-US')));
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aether-drift-2-records')!).runs)).toBe(1);
        await page.setViewportSize({ width: 540, height: 780 });
        await page.keyboard.press('Escape');
        await page.screenshot({ path: 'test-results/arcade-' + renderer + '-compact.png' });
        expect(await page.locator('#menu').evaluate((e) => e.scrollWidth <= innerWidth)).toBe(true);
        expect(errors).toEqual([]);
    });
