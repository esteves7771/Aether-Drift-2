import { expect, test } from '@playwright/test';
import type { AppBase, Asset, ContainerResource, Entity, RenderComponent } from 'playcanvas';

import { MODEL_TUNING } from '../src/model-config';

for (const renderer of ['webgpu', 'webgl2'])
    test('Pages release / ' + renderer, async ({ page, baseURL, request }) => {
        const errors: string[] = [],
            badResponses: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        page.on('response', (r) => {
            if (r.status() >= 400) badResponses.push(r.status() + ' ' + r.url());
        });
        await page.addInitScript({ path: '.agents/skills/inspect-runtime/scripts/devtools-hook.js' });
        const url = new URL(baseURL!);
        if (renderer === 'webgl2') url.search = '?webgl';
        const response = await page.goto(url.href);
        expect(response?.status()).toBe(200);
        await expect(page.locator('#launch')).toBeVisible();
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        expect(await page.locator('#ship-classic').getAttribute('aria-pressed')).toBe('true');
        await page.locator('#show-settings').click();
        await page.locator('#graphics').selectOption('low');
        await page.locator('#musicVolume').evaluate((input: HTMLInputElement) => {
            input.value = '0.35';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.locator('#menu-back').click();
        await page.locator('#ship-surveyor').click();
        await expect(page.locator('#ship-status')).toContainText('SURVEYOR READY');
        await page.locator('#launch').click();
        await expect
            .poll(() => page.locator('audio[data-music-state=combat]').evaluate((a: HTMLAudioElement) => a.currentTime))
            .toBeGreaterThan(0.1);
        await page.keyboard.down('Space');
        await expect
            .poll(async () => Number(await page.locator('#combat-perf').getAttribute('data-projectiles')))
            .toBeGreaterThan(0);
        await page.keyboard.up('Space');
        await expect(page.locator('.enemy-marker[data-id="0"]')).toHaveAttribute('data-health', /\d+/, {
            timeout: 20000
        });
        const moving = await page.evaluate(() => {
            const app = [
                ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
            ][0];
            return app.root.findByName('Enemy 0')!.getPosition().toString();
        });
        await page.waitForTimeout(350);
        expect(
            await page.evaluate(() => {
                const app = [
                    ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
                ][0];
                return app.root.findByName('Enemy 0')!.getPosition().toString();
            })
        ).not.toBe(moving);
        await page.mouse.click(720, 450, { button: 'right' });
        await page.keyboard.down('Space');
        await page.waitForTimeout(900);
        await page.keyboard.up('Space');
        await page.screenshot({ path: 'artifacts/public-release/combat-' + renderer + '.png' });
        await page.keyboard.press('Escape');
        await expect(page.locator('#end-patrol')).toBeVisible();
        const hits = await page.locator('#combat-perf').getAttribute('data-enemyHits');
        await page.waitForTimeout(200);
        expect(await page.locator('#combat-perf').getAttribute('data-enemyHits')).toBe(hits);
        await page.locator('#end-patrol').click();
        await page.locator('#return-home').click();
        await page.reload();
        await page.locator('#show-settings').click();
        await expect(page.locator('#graphics')).toHaveValue('low');
        await expect(page.locator('#musicVolume')).toHaveValue('0.35');
        expect(await page.evaluate(() => localStorage.getItem('aether-drift-2-records'))).not.toBeNull();
        await page.locator('#menu-back').click();
        await page.locator('#launch').click();
        await page.keyboard.press('KeyR');
        await page.locator('#restart-accept').click();
        await expect(page.locator('#hull-number')).toHaveText('100%');
        await page.keyboard.press('Escape');
        const manifest = await request.get(new URL('audio/music/manifest.json', baseURL).href);
        expect(manifest.ok()).toBe(true);
        const tracks = (await manifest.json()) as Record<string, string>;
        expect(Object.keys(tracks).sort()).toEqual(['boss', 'combat', 'death', 'menu']);
        for (const filename of Object.values(tracks)) {
            const r = await request.get(new URL('audio/music/' + filename, baseURL).href);
            expect(r.status()).toBe(200);
            expect((await r.body()).length).toBeGreaterThan(10000);
        }
        // Art-only verification through the real Engine loader on the actual released application.
        // Gameplay above uses normal UI; no simulation globals are shipped or accessed.
        const art = await page.evaluate(
            async ({ base, models }) => {
                const app = [
                    ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
                ][0];
                app.timeScale = 0;
                app.off('update');
                for (const e of app.root.children)
                    e.enabled = e.name === 'Chase camera' || e.name === 'Starlight' || e.name === 'Magenta rim';
                const camera = app.root.findByName('Chase camera')!;
                camera.setPosition(0, 2, 24);
                camera.lookAt(0, 0, 0);
                const ExistingAsset = app.assets.list().find((a) => a.type === 'container')!
                    .constructor as typeof Asset;
                const ExistingEntity = app.root.constructor as new (name: string) => Entity;
                const results: { name: string; pixels: number }[] = [];
                const visiblePixels = () =>
                    new Promise<number>((resolve) =>
                        app.once('frameend', () => {
                            const source = app.graphicsDevice.canvas as HTMLCanvasElement,
                                copy = document.createElement('canvas');
                            copy.width = source.width;
                            copy.height = source.height;
                            const ctx = copy.getContext('2d')!;
                            ctx.drawImage(source, 0, 0);
                            const p = ctx.getImageData(0, 0, copy.width, copy.height).data;
                            let lit = 0;
                            for (let i = 0; i < p.length; i += 4) if (Math.max(p[i], p[i + 1], p[i + 2]) > 65) lit++;
                            resolve(lit);
                        })
                    );
                for (const [key, t] of Object.entries(models)) {
                    const asset = new ExistingAsset('Release asset check ' + key, 'container', {
                        url: new URL('models/' + t.file, base).href
                    });
                    app.assets.add(asset);
                    await new Promise<void>((resolve, reject) => {
                        asset.once('load', () => resolve());
                        asset.once('error', () => reject(Error('Could not load ' + key)));
                        app.assets.load(asset);
                    });
                    const model = (asset.resource as ContainerResource).instantiateRenderEntity({
                        castShadows: false,
                        receiveShadows: false
                    });
                    const wrapper = new ExistingEntity('Release model art fixture'),
                        pivot = new ExistingEntity('Authored units preserved');
                    const scale = 12 / Math.max(...t.dims);
                    pivot.setLocalScale(scale, scale, scale);
                    pivot.setLocalPosition(-t.center[0] * scale, -t.center[1] * scale, -t.center[2] * scale);
                    pivot.addChild(model);
                    wrapper.addChild(pivot);
                    wrapper.setLocalEulerAngles(10, t.yaw + 25, 0);
                    app.root.addChild(wrapper);
                    for (const r of wrapper.findComponents('render'))
                        for (const mi of (r as RenderComponent).meshInstances) mi.mask = 3;
                    await visiblePixels();
                    results.push({ name: key, pixels: await visiblePixels() });
                    wrapper.destroy();
                    asset.unload();
                    app.assets.remove(asset);
                }
                for (const name of ['Capital ship', 'Phantom boss']) {
                    const root = app.root.findByName(name)!;
                    root.enabled = true;
                    root.setPosition(0, 0, 0);
                    root.setEulerAngles(0, 25, 0);
                    root.setLocalScale(
                        name === 'Capital ship' ? 0.055 : 0.8,
                        name === 'Capital ship' ? 0.055 : 0.8,
                        name === 'Capital ship' ? 0.055 : 0.8
                    );
                    await visiblePixels();
                    results.push({ name, pixels: await visiblePixels() });
                    root.enabled = false;
                }
                return results;
            },
            { base: baseURL!, models: MODEL_TUNING }
        );
        for (const r of art) expect(r.pixels, r.name + ' actual rendered pixels').toBeGreaterThan(100);
        expect(badResponses).toEqual([]);
        expect(errors).toEqual([]);
        console.log(renderer, {
            url: url.href,
            rendered: art,
            tracks: Object.keys(tracks),
            consoleErrors: errors.length
        });
    });

for (const renderer of ['webgpu', 'webgl2'])
    test('Phase 5G public presentation / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [],
            bad: string[] = [],
            requests: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        page.on('response', (r) => {
            if (r.status() >= 400) bad.push(r.url());
        });
        page.on('request', (r) => requests.push(r.url()));
        await page.addInitScript({ path: '.agents/skills/inspect-runtime/scripts/devtools-hook.js' });
        await page.addInitScript(() => {
            const contexts: AudioContext[] = [];
            Object.assign(globalThis, { __releaseAudioContexts: contexts });
            globalThis.AudioContext = new Proxy(globalThis.AudioContext, {
                construct(Target, args) {
                    const context = Reflect.construct(Target, args) as AudioContext;
                    contexts.push(context);
                    return context;
                }
            });
        });
        await page.goto(baseURL! + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await expect(page.locator('.command-logo')).toBeVisible();
        await expect(page.locator('.command-status')).toContainText('v0.5g');
        await page.waitForFunction(
            () =>
                [
                    ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
                ][0]?.root.findByName('Menu satellite 3'),
            undefined,
            { timeout: 45000 }
        );
        expect(requests.some((u) => u.includes('cockpit-overlay.png'))).toBe(false);
        await page.screenshot({ path: `artifacts/public-release/5f-menu-${renderer}.png` });
        await page.locator('#ship-classic').click();
        for (const ship of ['classic', 'surveyor']) {
            if (ship === 'surveyor') {
                await page.keyboard.press('Escape');
                await page.locator('#end-patrol').click();
                await page.locator('#return-home').click();
                await page.locator('#ship-surveyor').click();
                await expect(page.locator('#ship-surveyor')).toHaveAttribute('aria-pressed', 'true');
            }
            await page.locator('#launch').click();
            await expect(page.locator('#camera-toggle')).toBeVisible();
            await expect
                .poll(() =>
                    page.evaluate(() =>
                        (
                            globalThis as unknown as { __releaseAudioContexts: AudioContext[] }
                        ).__releaseAudioContexts.some((c) => c.state === 'running')
                    )
                )
                .toBe(true);
            await expect
                .poll(() =>
                    page.locator('audio[data-music-state=combat]').evaluate((a: HTMLAudioElement) => a.currentTime)
                )
                .toBeGreaterThan(0.1);
            await page.locator('#application-canvas').focus();
            await page.keyboard.down('KeyW');
            await page.keyboard.down('ShiftLeft');
            await expect
                .poll(
                    () =>
                        page.evaluate(() => {
                            const app = [
                                ...(
                                    globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }
                                ).__playcanvasApps.keys()
                            ][0];
                            const c = app.root
                                .findByName('Player engine 0')!
                                .findComponents('render')[0] as RenderComponent;
                            return (c.meshInstances[0].getParameter('uEngine').data as Float32Array)[1];
                        }),
                    { timeout: 3000 }
                )
                .toBeGreaterThan(0.7);
            const propulsion = await page.evaluate(() => {
                const app = [
                    ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
                ][0];
                const root = app.root.findByName('Player propulsion')!;
                const engines = root.children.filter((e) => e.name.startsWith('Player engine ') && e.enabled);
                const data = (engines[0] as Entity).findComponents('render')[0] as RenderComponent;
                return {
                    count: engines.length,
                    power: (data.meshInstances[0].getParameter('uEngine').data as Float32Array)[1]
                };
            });
            expect(propulsion.count).toBe(ship === 'classic' ? 2 : 3);
            expect(propulsion.power).toBeGreaterThan(0.7);
            await page.screenshot({ path: `artifacts/public-release/5f-${ship}-thrusters-${renderer}.png` });
            await page.keyboard.up('KeyW');
            await page.keyboard.up('ShiftLeft');
            await page.keyboard.press('c');
            await expect(page.locator('#cockpit')).toBeVisible();
            await page.locator('#cockpit-art').evaluate((i: HTMLImageElement) => i.decode());
            await expect(page.locator('#cp-hull')).toHaveText(/\d+%/);
            await expect(page.locator('#cp-ammo')).toHaveText('6');
            await page.screenshot({ path: `artifacts/public-release/5f-${ship}-cockpit-${renderer}.png` });
            await page.locator('#camera-toggle').click();
            await expect(page.locator('#cockpit')).toBeHidden();
        }
        await page.keyboard.press('c');
        await expect(page.locator('#cockpit')).toBeVisible();
        await page.keyboard.press('r');
        await expect(page.locator('#restart-confirm')).toBeVisible();
        const before = await page.locator('#combat-perf').getAttribute('data-enemyHits');
        await page.waitForTimeout(150);
        expect(await page.locator('#combat-perf').getAttribute('data-enemyHits')).toBe(before);
        await page.screenshot({ path: `artifacts/public-release/5f-restart-${renderer}.png` });
        await page.locator('#restart-cancel').click();
        await expect(page.locator('#menu')).toBeHidden();
        await page.keyboard.press('r');
        await page.locator('#restart-accept').click();
        await expect(page.locator('#camera-toggle')).toHaveAttribute('aria-pressed', 'false');
        await page.keyboard.press('c');
        await expect
            .poll(() => page.locator('.enemy-marker[data-id="0"]').evaluate((e) => e.hasAttribute('hidden')), {
                timeout: 20000
            })
            .toBe(false);
        await expect(page.locator('.enemy-marker[data-id="0"]')).not.toHaveClass(/armored/, { timeout: 20000 });
        // Only real controls and read-only Engine state: no simulation globals, health edits or effect injection.
        await page.keyboard.down('Space');
        let sawBlast = false;
        for (let i = 0; i < 100; i++) {
            const state = await page.evaluate(() => {
                const app = [
                    ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
                ][0];
                const ship = app.root.findByName('Ship')!,
                    target = app.root.children
                        .find((e) => e.name === 'Combat')
                        ?.children.find((e) => e.name.startsWith('Enemy ') && e.enabled);
                const local = target
                    ? ship
                          .getRotation()
                          .clone()
                          .invert()
                          .transformVector(target.getPosition().clone().sub(ship.getPosition()))
                    : null;
                return {
                    yaw: local ? Math.atan2(local.x, -local.z) : 0,
                    pitch: local ? Math.atan2(local.y, Math.hypot(local.x, local.z)) : 0,
                    blast: app.root.findByName('Cinematic explosions')!.children.some((e) => e.enabled)
                };
            });
            if (state.blast) {
                sawBlast = true;
                break;
            }
            for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) await page.keyboard.up(key);
            if (Math.abs(state.yaw) > 0.035) await page.keyboard.down(state.yaw > 0 ? 'ArrowRight' : 'ArrowLeft');
            if (Math.abs(state.pitch) > 0.035) await page.keyboard.down(state.pitch > 0 ? 'ArrowDown' : 'ArrowUp');
            if (i % 12 === 0) await page.keyboard.press('m');
            await page.waitForTimeout(65);
        }
        await page.screenshot({ path: `artifacts/public-release/5f-live-explosion-${renderer}.png` });
        await page.keyboard.up('Space');
        for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) await page.keyboard.up(key);
        expect(sawBlast, 'actual combat generated an enabled explosion pool slot').toBe(true);
        expect(bad).toEqual([]);
        expect(errors).toEqual([]);
        console.log('5F live smoke', renderer, {
            url: baseURL,
            sawBlast,
            audio: 'streaming and AudioContext running',
            errors: errors.length
        });
    });
