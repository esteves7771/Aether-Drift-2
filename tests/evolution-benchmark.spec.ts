import fs from 'node:fs';

import { expect, test } from '@playwright/test';
const version = process.env.AE_BASELINE === '1' ? 'baseline' : 'final';
for (const renderer of ['webgpu', 'webgl2'])
    test('matched world measurement / ' + renderer, async ({ page, baseURL }) => {
        test.setTimeout(120000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.locator('#launch').click();
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.advance(80);
        });
        await page.waitForTimeout(800);
        fs.mkdirSync('artifacts/phase5fc', { recursive: true });
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-${version}-matched-chase.png` });
        const metrics = await page.evaluate(async () => {
            const h = __phase4,
                frames: number[] = [],
                updates: number[] = [],
                renders: number[] = [],
                draws: number[] = [];
            let before = performance.now();
            for (let i = 0; i < 120; i++) {
                await new Promise<void>((r) => requestAnimationFrame(() => r()));
                const now = performance.now();
                frames.push(now - before);
                before = now;
                updates.push(h.app.stats.frame.updateTime);
                renders.push(h.app.stats.frame.renderTime);
                draws.push(h.app.stats.drawCallCount);
            }
            const summary = (a: number[]) => {
                a.sort((a, b) => a - b);
                return { median: a[Math.floor(a.length * 0.5)], p95: a[Math.floor(a.length * 0.95)] };
            };
            return {
                preset: document.body.dataset.graphics,
                raf: summary(frames),
                update: summary(updates),
                render: summary(renders),
                draws: summary(draws),
                renderComponents: h.app.root.findComponents('render').length,
                enabledRenderComponents: h.app.root
                    .findComponents('render')
                    .filter((c) => c.enabled && c.entity.enabled).length,
                models: h.modelLibrary.loaded
            };
        });
        fs.writeFileSync(`artifacts/phase5fc/${renderer}-${version}-matched.json`, JSON.stringify(metrics, null, 2));
        await page.keyboard.press('c');
        await page.evaluate(() => __phase4.advance(2));
        await expect(page.locator('#cockpit')).toBeVisible();
        await page.locator('#cockpit-art').evaluate((i: HTMLImageElement) => i.decode());
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-${version}-matched-cockpit.png` });
        expect(errors).toEqual([]);
    });
