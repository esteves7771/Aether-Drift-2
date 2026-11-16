import fs from 'node:fs';

import { chromium } from '@playwright/test';
fs.mkdirSync('artifacts/phase5h-release', { recursive: true });
fs.copyFileSync('public/images/menu-ptah.webp', 'artifacts/phase5h-release/ptah-before.webp');
const browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--use-webgpu-adapter=swiftshader']
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript({ path: '.agents/skills/inspect-runtime/scripts/devtools-hook.js' });
await page.goto('http://127.0.0.1:5180/?webgl');
await page.getByRole('button', { name: 'Next ships' }).click();
await page.locator('#ship-ptah').click();
await page.locator('#ship-ptah[aria-pressed=true]').waitFor();
await page.screenshot({ path: 'artifacts/phase5h-release/roster-before.png' });
const result = await page.evaluate(async () => {
    const document = globalThis.document;
    const app = [...globalThis.__playcanvasApps.keys()][0];
    app.off('update');
    for (const e of app.root.children)
        e.enabled = ['Ship', 'Chase camera', 'Starlight', 'Magenta rim'].includes(e.name);
    const ship = app.root.findByName('Ship');
    ship.setPosition(0, 0, 0);
    ship.setEulerAngles(0, 0, 0);
    ship.setLocalScale(1, 1, 1);
    const camera = app.root.findByName('Chase camera');
    camera.setPosition(8, 6, -11);
    camera.lookAt(0, 0, 0);
    camera.camera.clearColor.set(0, 0, 0, 0);
    camera.camera.projectionOffset.set(0, 0);
    camera.camera.nearClip = 0.1;
    await new Promise((r) => app.once('frameend', r));
    return await new Promise((resolve) =>
        app.once('frameend', () => {
            const c = document.createElement('canvas'),
                src = app.graphicsDevice.canvas;
            c.width = src.width;
            c.height = src.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(src, 0, 0);
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            let x0 = c.width,
                y0 = c.height,
                x1 = 0,
                y1 = 0;
            for (let y = 0; y < c.height; y++)
                for (let x = 0; x < c.width; x++) {
                    if (d[(y * c.width + x) * 4 + 3] > 10) {
                        x0 = Math.min(x0, x);
                        x1 = Math.max(x1, x);
                        y0 = Math.min(y0, y);
                        y1 = Math.max(y1, y);
                    }
                }
            const out = document.createElement('canvas');
            out.width = 440;
            out.height = 180;
            const sw = x1 - x0 + 1,
                sh = y1 - y0 + 1,
                s = Math.min(410 / sw, 160 / sh);
            out.getContext('2d').drawImage(c, x0, y0, sw, sh, (440 - sw * s) / 2, (180 - sh * s) / 2, sw * s, sh * s);
            resolve({ image: out.toDataURL('image/webp', 0.95), alpha: d[3], bounds: [x0, y0, x1, y1] });
        })
    );
});
if (result.alpha !== 0) throw Error('Source canvas is not transparent: ' + result.alpha);
fs.writeFileSync('public/images/menu-ptah.webp', Buffer.from(result.image.split(',')[1], 'base64'));
console.log({ alpha: result.alpha, bounds: result.bounds });
await browser.close();
