import fs from 'node:fs';

import { test, expect } from '@playwright/test';
for (const backend of ['webgpu', 'webgl2']) {
    test('local roster transparent thumbnails / ' + backend, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(backend === 'webgl2' ? '/?webgl' : '/');
        await page.getByRole('button', { name: 'Next ships' }).click();
        await page.locator('#ship-ptah').click();
        await expect(page.locator('#ship-ptah')).toHaveAttribute('aria-pressed', 'true');
        const images = await page.evaluate(async () => {
            const results = [];
            for (const key of ['classic', 'surveyor', 'ptah']) {
                const img = document.querySelector<HTMLImageElement>('#ship-' + key + ' img')!;
                await img.decode();
                const c = document.createElement('canvas');
                c.width = img.naturalWidth;
                c.height = img.naturalHeight;
                const ctx = c.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
                const d = ctx.getImageData(0, 0, c.width, c.height).data;
                let minX = c.width,
                    maxX = 0,
                    minY = c.height,
                    maxY = 0,
                    opaque = 0;
                for (let y = 0; y < c.height; y++)
                    for (let x = 0; x < c.width; x++)
                        if (d[(y * c.width + x) * 4 + 3] > 20) {
                            opaque++;
                            minX = Math.min(minX, x);
                            maxX = Math.max(maxX, x);
                            minY = Math.min(minY, y);
                            maxY = Math.max(maxY, y);
                        }
                results.push({
                    key,
                    width: c.width,
                    height: c.height,
                    cornerAlpha: d[3],
                    minX,
                    maxX,
                    minY,
                    maxY,
                    opaque
                });
            }
            return results;
        });
        for (const image of images) {
            expect(image.cornerAlpha).toBe(0);
            expect(image.width).toBe(440);
            expect(image.height).toBe(180);
            expect(image.minX).toBeGreaterThan(0);
            expect(image.maxX).toBeLessThan(439);
            expect(image.minY).toBeGreaterThan(0);
            expect(image.maxY).toBeLessThan(179);
            expect(image.maxX - image.minX).toBeGreaterThan(300);
        }
        for (const size of [
            { width: 1920, height: 1080 },
            { width: 1280, height: 720 },
            { width: 1920, height: 1200 }
        ]) {
            await page.setViewportSize(size);
            await page.screenshot({
                path: `artifacts/phase5h-release/roster-after-${backend}-${size.width}x${size.height}.png`
            });
            expect(await page.locator('#ship-ptah').evaluate((e) => e.getBoundingClientRect().right)).toBeLessThan(
                size.width
            );
        }
        await page.getByRole('button', { name: 'Previous ships' }).click();
        await expect(page.locator('#ship-classic')).toBeVisible();
        await expect(page.locator('#ship-surveyor')).toBeVisible();
        await page.locator('#ship-surveyor').click();
        await expect(page.locator('#ship-surveyor')).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: 'Next ships' }).click();
        await expect(page.locator('#ship-ptah')).toHaveAttribute('aria-pressed', 'false');
        await page.locator('#ship-ptah').click();
        await page.reload();
        await expect(page.locator('#ship-ptah')).toHaveAttribute('aria-pressed', 'true');
        fs.writeFileSync(`artifacts/phase5h-release/thumbnail-${backend}.json`, JSON.stringify(images, null, 2));
        expect(errors).toEqual([]);
    });
}
