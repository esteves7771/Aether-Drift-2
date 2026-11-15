import fs from 'node:fs';

import { expect, test } from '@playwright/test';

import type { BlastClass } from '../src/explosion-config';

for (const renderer of ['webgpu', 'webgl2'])
    test('cinematic cockpit and controls / ' + renderer, async ({ page }) => {
        test.setTimeout(180000);
        const errors: string[] = [],
            requests: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        page.on('request', (r) => requests.push(r.url()));
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto('http://127.0.0.1:5181/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.waitForFunction(() => __phase4.app.assets.find('Cinematic fire flipbook')?.loaded);
        expect(requests.some((u) => u.includes('cockpit-overlay'))).toBe(false);
        fs.mkdirSync('artifacts/phase5fb', { recursive: true });
        await page.locator('#launch').click();
        await page.evaluate(() => {
            __phase4.app.timeScale = 0;
            __phase4.combat.countdown = 1000;
            __phase4.advance(3);
        });
        await page.keyboard.press('c');
        await page.evaluate(() => __phase4.advance(2));
        await expect(page.locator('#cockpit')).toBeVisible();
        await page.locator('#cockpit-art').evaluate((i: HTMLImageElement) => i.decode());
        const alpha = await page.locator('#cockpit-art').evaluate((img: HTMLImageElement) => {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const ctx = c.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const alpha = (x: number, y: number) =>
                ctx.getImageData(Math.round(c.width * x), Math.round(c.height * y), 1, 1).data[3];
            return { windshield: alpha(0.5, 0.25), dashboard: alpha(0.5, 0.94), canopy: alpha(0.2, 0.09) };
        });
        expect(alpha.windshield).toBe(0);
        expect(alpha.dashboard).toBeGreaterThan(240);
        expect(alpha.canopy).toBeGreaterThan(200);
        expect(await page.evaluate(() => __phase4.cruise.active)).toBe(false);
        await page.screenshot({ path: `artifacts/phase5fb/${renderer}-classic-cockpit.png` });
        for (const [width, height] of [
            [1600, 900],
            [1440, 900],
            [1366, 768],
            [1280, 720],
            [2560, 1080]
        ]) {
            await page.setViewportSize({ width, height });
            await expect
                .poll(() =>
                    page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])
                )
                .toEqual([width, height]);
            const inside = await page.locator('.instrument').evaluateAll((es) =>
                es.every((e) => {
                    const r = e.getBoundingClientRect();
                    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
                })
            );
            expect(inside).toBe(true);
            if (width === 1280 || width === 1440 || width === 2560)
                await page.screenshot({ path: `artifacts/phase5fb/${renderer}-cockpit-${width}.png` });
        }
        await page.setViewportSize({ width: 1920, height: 1080 });
        const nav = await page.evaluate(() => __phase4.combat.frontier.selected);
        await page.keyboard.press('n');
        await page.keyboard.press('v');
        await page.evaluate(() => __phase4.advance(1));
        expect(await page.evaluate(() => __phase4.combat.frontier.selected)).toBe(nav);
        // Real attitude/input and exact first-person forward alignment; simulation is not changed by the camera.
        await page.keyboard.down('ArrowRight');
        await page.keyboard.down('q');
        await page.keyboard.down('w');
        await page.evaluate(() => __phase4.advance(6));
        await page.keyboard.up('ArrowRight');
        await page.keyboard.up('q');
        await page.keyboard.up('w');
        const aligned = await page.evaluate(() => {
            const h = __phase4;
            return Math.abs(h.chase.entity.getRotation().dot(h.flight.rotation));
        });
        expect(aligned).toBeCloseTo(1, 4);
        await page.locator('#camera-toggle').click();
        await page.evaluate(() => __phase4.advance(1));
        await expect(page.locator('#cockpit')).toBeHidden();
        await page.locator('#camera-toggle').click();
        await page.evaluate(() => __phase4.advance(1));
        // R freezes the run; repeated R, held weapons, Escape and already-paused cancellation.
        const before = await page.evaluate(() => ({
            duration: __phase4.combat.duration,
            pos: __phase4.flight.position.toString(),
            shots: __phase4.combat.projectiles.fired
        }));
        await page.keyboard.press('r');
        await expect(page.locator('#restart-confirm')).toBeVisible();
        await page.screenshot({ path: `artifacts/phase5fb/${renderer}-restart.png` });
        await page.keyboard.press('r');
        await page.keyboard.down('Space');
        await page.evaluate(() => __phase4.advance(5));
        await page.keyboard.up('Space');
        expect(
            await page.evaluate(() => ({
                duration: __phase4.combat.duration,
                pos: __phase4.flight.position.toString(),
                shots: __phase4.combat.projectiles.fired
            }))
        ).toEqual(before);
        await page.keyboard.press('Escape');
        await expect(page.locator('#menu')).toBeHidden();
        expect(await page.evaluate(() => __phase4.pilotCamera.cockpit)).toBe(true);
        await page.keyboard.press('Escape');
        await page.keyboard.press('r');
        await page.locator('#restart-cancel').click();
        await expect(page.locator('#menu')).toHaveAttribute('data-screen', 'pause');
        await page.locator('#restart').click();
        await page.locator('#restart-accept').click();
        await page.evaluate(() => __phase4.advance(1));
        expect(await page.evaluate(() => __phase4.combat.duration)).toBeLessThan(0.1);
        expect(await page.evaluate(() => __phase4.pilotCamera.cockpit)).toBe(false);
        // Alternate ship uses the same artwork and its calibrated pilot position.
        await page.keyboard.press('Escape');
        await page.locator('#end-patrol').click();
        await page.locator('#return-home').click();
        await page.locator('#ship-surveyor').click();
        await expect(page.locator('#ship-surveyor')).toHaveAttribute('aria-pressed', 'true');
        await page.locator('#launch').click();
        await page.keyboard.press('c');
        await page.evaluate(() => {
            __phase4.combat.countdown = 1000;
            __phase4.advance(3);
        });
        await page.screenshot({ path: `artifacts/phase5fb/${renderer}-surveyor-cockpit.png` });
        expect(await page.evaluate(() => __phase4.chase.entity.camera!.nearClip)).toBeCloseTo(0.1);
        // Spawned encounter fixture, actual lasers and unmodified enemy health/AI.
        await page.evaluate(() => {
            const h = __phase4;
            h.flight.reset();
            h.combat.countdown = 1000;
            h.advance(1);
            h.combat.enemies[0].spawn('interceptor', h.flight.position.clone().set(0, 0, -45), h.flight.rotation);
        });
        await page.keyboard.down('Space');
        await page.evaluate(() => __phase4.advance(1));
        await page.screenshot({ path: `artifacts/phase5fb/${renderer}-cockpit-lasers.png` });
        for (let i = 0; i < 30; i++) {
            const alive = await page.evaluate(() => {
                __phase4.advance(3);
                return __phase4.combat.enemies[0].active;
            });
            if (!alive) break;
        }
        await page.keyboard.up('Space');
        expect(await page.evaluate(() => __phase4.combat.enemies[0].active)).toBe(false);
        expect(await page.evaluate(() => __phase4.combat.kills)).toBeGreaterThan(0);
        await page.screenshot({ path: `artifacts/phase5fb/${renderer}-fighter-destruction.png` });
        await page.keyboard.press('m');
        await page.keyboard.press('g');
        await page.evaluate(() => __phase4.advance(2));
        expect(await page.evaluate(() => __phase4.combat.ammo)).toBeLessThan(6);
        expect(await page.evaluate(() => __phase4.combat.empCooldown)).toBeGreaterThan(0);
        // Deterministic visual fixture for each preset, in the actual scene, without pretending to be a wave playthrough.
        const fixture = async (kind: BlastClass, size: number, age = 6) => {
            await page.evaluate(
                ({ kind, size, age }) => {
                    const h = __phase4;
                    h.explosions.reset();
                    const c = h.chase.entity,
                        p = c.forward
                            .clone()
                            .mulScalar(kind === 'fighter' ? 27 : kind === 'heavy' ? 35 : 85)
                            .add(c.getPosition());
                    p.x -= 5;
                    p.y += 5;
                    h.explosions.spawn(p, size, kind);
                    h.advance(age);
                },
                { kind, size, age }
            );
        };
        for (const [kind, size] of [
            ['fighter', 1],
            ['heavy', 1.4],
            ['saucer', 1.5],
            ['barrel', 2.2],
            ['turret', 1],
            ['dreadnought', 9],
            ['phantom', 5],
            ['tesser', 9]
        ] as [BlastClass, number][]) {
            await fixture(kind, size);
            await page.screenshot({ path: `artifacts/phase5fb/${renderer}-${kind}-explosion.png` });
        }
        const renders = await page.evaluate(() => __phase4.app.root.findComponents('render').length);
        await fixture('heavy', 1.4, 1);
        await page.screenshot({ path: `artifacts/phase5fb/${renderer}-cockpit-flash.png` });
        const performanceSamples: Record<string, unknown> = {};
        const sample = () =>
            page.evaluate(async () => {
                const app = __phase4.app,
                    times: number[] = [];
                let last = performance.now();
                await new Promise<void>((resolve) => {
                    const frame = () => {
                        const now = performance.now();
                        times.push(now - last);
                        last = now;
                        if (times.length === 32) {
                            app.off('frameend', frame);
                            resolve();
                        }
                    };
                    app.on('frameend', frame);
                });
                const sorted = times.slice(8).sort((a, b) => a - b);
                return { median: sorted[12], p95: sorted[22], draws: app.stats.drawCallCount };
            });
        for (const q of ['low', 'medium', 'high'] as const) {
            await page.evaluate((q) => (__phase4.settings.graphics = q), q);
            await fixture('heavy', 1.4);
            await page.screenshot({ path: `artifacts/phase5fb/${renderer}-explosion-${q}.png` });
            await page.evaluate(() => (__phase4.explosions.root.enabled = false));
            performanceSamples[q + '-off'] = await sample();
            await page.evaluate(() => (__phase4.explosions.root.enabled = true));
            performanceSamples[q + '-on'] = await sample();
        }
        fs.writeFileSync(
            `artifacts/phase5fb/${renderer}-performance.json`,
            JSON.stringify(performanceSamples, null, 2)
        );
        await page.evaluate(() => {
            const h = __phase4;
            h.settings.graphics = 'medium';
            const p = h.chase.entity.forward.clone().mulScalar(45).add(h.chase.entity.getPosition());
            for (let i = 0; i < 50; i++) h.explosions.spawn(p, 1.3, 'heavy');
            h.advance(1);
        });
        expect(await page.evaluate(() => __phase4.explosions.active)).toBeLessThanOrEqual(12);
        expect(await page.evaluate(() => __phase4.app.root.findComponents('render').length)).toBe(renders);
        await page.evaluate(() => __phase4.advance(55));
        expect(await page.evaluate(() => __phase4.explosions.active)).toBe(0);
        // Shield/hull values remain live, death preserves the debrief and a fresh run resets view mode.
        await page.evaluate(() => {
            __phase4.combat.hurtPlayer(20, __phase4.flight.position);
            __phase4.advance(3);
        });
        await expect(page.locator('#cp-shield')).not.toHaveText('100%');
        await page.evaluate(() => {
            __phase4.combat.hurtPlayer(10000, __phase4.flight.position);
            __phase4.advance(1);
        });
        await expect(page.locator('#menu')).toHaveAttribute('data-screen', 'debrief');
        await page.locator('#retry').click();
        await page.evaluate(() => __phase4.advance(1));
        await expect(page.locator('#cockpit')).toBeHidden();
        expect(errors).toEqual([]);
    });

for (const renderer of ['webgpu', 'webgl2'])
    test('destruction event integration / ' + renderer, async ({ page }) => {
        test.setTimeout(120000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto('http://127.0.0.1:5181/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.waitForFunction(() => __phase4.app.assets.find('Cinematic fire flipbook')?.loaded);
        await page.locator('#launch').click();
        await page.evaluate(() => {
            __phase4.app.timeScale = 0;
            __phase4.combat.countdown = 1000;
        });
        await page.keyboard.press('c');
        await page.evaluate(() => __phase4.advance(2));
        for (const kind of ['heavy', 'saucer'] as const) {
            await page.evaluate((kind) => {
                const h = __phase4;
                h.combat.reset();
                h.combat.countdown = 1000;
                h.flight.reset();
                const e = h.combat.enemies[0];
                e.spawn(
                    kind === 'heavy' ? 'heavy' : 'interceptor',
                    h.flight.position.clone().set(0, 0, -60),
                    h.flight.rotation
                );
                if (kind === 'saucer') e.visual = 'saucer';
                h.events.length = 0;
                h.advance(1);
            }, kind);
            await page.keyboard.down('Space');
            for (let i = 0; i < 40; i++) {
                if (
                    !(await page.evaluate(() => {
                        __phase4.advance(3);
                        return __phase4.combat.enemies[0].active;
                    }))
                )
                    break;
            }
            await page.keyboard.up('Space');
            expect(await page.evaluate(() => __phase4.combat.enemies[0].active)).toBe(false);
            expect(
                await page.evaluate(() =>
                    __phase4.events.filter((e) => e.kind.includes('explosion')).map((e) => e.style)
                )
            ).toContain(kind);
            await page.screenshot({ path: `artifacts/phase5fb/${renderer}-${kind}-actual-kill.png` });
        }
        // Live pooled lasers hit three original-health barrels; existing falloff/chain queue does all damage.
        await page.evaluate(() => {
            const h = __phase4;
            h.combat.reset();
            h.combat.countdown = 1000;
            h.flight.reset();
            h.flight.position.y = 3000;
            h.flight.previous.copy(h.flight.position);
            for (let i = 0; i < 3; i++) {
                const b = h.combat.barrels.items[i];
                b.origin.set(i * 6, 3000, -55);
                b.position.copy(b.origin);
                b.previous.copy(b.position);
            }
            h.events.length = 0;
            h.advance(1);
        });
        await page.keyboard.down('Space');
        await page.evaluate(() => __phase4.advance(10));
        await page.keyboard.up('Space');
        expect(
            await page.evaluate(() => __phase4.combat.barrels.items.slice(0, 3).filter((b) => !b.active).length)
        ).toBe(3);
        expect(await page.evaluate(() => __phase4.events.filter((e) => e.style === 'barrel').length)).toBe(3);
        await page.screenshot({ path: `artifacts/phase5fb/${renderer}-barrel-chain-actual.png` });
        // Shoot an exposed attachment from outside its rock proxy; no direct health edits.
        await page.evaluate(() => {
            const h = __phase4;
            h.combat.reset();
            h.combat.countdown = 1000;
            const base = h.combat.frontier.bases[0],
                p = base.parts[1];
            const outward = p.position.clone().sub(base.rock.position).normalize();
            h.flight.position.copy(p.position).add(outward.mulScalar(50));
            h.flight.previous.copy(h.flight.position);
            h.flight.velocity.set(0, 0, 0);
            const aim = h.app.root.findByName('Ship')!;
            aim.setPosition(h.flight.position);
            aim.lookAt(p.position);
            h.flight.rotation.copy(aim.getRotation());
            h.flight.previousRotation.copy(h.flight.rotation);
            h.events.length = 0;
            h.advance(1);
        });
        await page.keyboard.down('Space');
        for (let i = 0; i < 40; i++) {
            if (
                !(await page.evaluate(() => {
                    __phase4.advance(3);
                    return __phase4.combat.frontier.bases[0].parts[1].active;
                }))
            )
                break;
        }
        await page.keyboard.up('Space');
        expect(await page.evaluate(() => __phase4.combat.frontier.bases[0].parts[1].active)).toBe(false);
        expect(await page.evaluate(() => __phase4.events.some((e) => e.style === 'turret'))).toBe(true);
        await page.screenshot({ path: `artifacts/phase5fb/${renderer}-turret-actual.png` });
        await page.evaluate(() => {
            const h = __phase4,
                l = h.combat.frontier.locations[2];
            h.combat.frontier.selected = 2;
            h.flight.position.copy(l.position);
            h.flight.position.z += 30;
            h.flight.previous.copy(h.flight.position);
            h.advance(1);
        });
        const supplies = await page.evaluate(() => __phase4.combat.frontier.supplies);
        await page.keyboard.press('v');
        await page.keyboard.press('n');
        await page.evaluate(() => __phase4.advance(2));
        expect(await page.evaluate(() => __phase4.combat.frontier.supplies)).toBe(supplies);
        expect(await page.evaluate(() => __phase4.combat.frontier.selected)).toBe(2);
        expect(await page.locator('body').textContent()).not.toMatch(/C cruise|N destination|V investigate|N CYCLE/i);
        // Seed only the destruction state, then run each existing boss clock/event pipeline in the real renderer.
        for (const [wave, style] of [
            [5, 'dreadnought'],
            [10, 'phantom'],
            [15, 'tesser']
        ] as const) {
            await page.evaluate((wave) => {
                const h = __phase4;
                h.combat.reset();
                h.flight.reset();
                h.combat.director.wave = wave;
                h.combat.director.group = 1;
                h.combat.boss.spawn(h.flight, h.rocks);
                h.flight.position.copy(h.combat.boss.position);
                h.flight.position.z += 200;
                h.flight.previous.copy(h.flight.position);
                h.combat.boss.active = false;
                h.combat.boss.dying = 6.4;
                h.events.length = 0;
                h.explosions.reset();
            }, wave);
            for (let i = 0; i < 110; i++) {
                const final = await page.evaluate(() => {
                    __phase4.advance(1);
                    return __phase4.events.some((e) => e.kind === 'capital-final');
                });
                if (final) break;
            }
            const finals = await page.evaluate(() => __phase4.events.filter((e) => e.kind === 'capital-final'));
            expect(finals).toHaveLength(1);
            expect(finals[0].style).toBe(style);
            await page.evaluate(() => __phase4.advance(5));
            await page.screenshot({ path: `artifacts/phase5fb/${renderer}-${style}-sequence.png` });
        }
        expect(errors).toEqual([]);
    });

for (const renderer of ['webgpu', 'webgl2'])
    test('cockpit marker projection / ' + renderer, async ({ page }) => {
        await page.goto('http://127.0.0.1:5181/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.locator('#launch').click();
        await page.keyboard.press('c');
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.advance(1);
            const cam = h.chase.entity;
            const front = cam.forward.clone().mulScalar(100).add(cam.getPosition()),
                below = front.clone().sub(cam.up.clone().mulScalar(150));
            h.combat.enemies[0].spawn('interceptor', front, h.flight.rotation);
            h.combat.enemies[1].spawn('interceptor', below, h.flight.rotation);
            h.combat.selected = 0;
            h.advance(2);
        });
        await expect(page.locator('.enemy-marker[data-id="0"]')).toHaveClass(/locked/);
        await expect(page.locator('.enemy-marker[data-id="0"]')).not.toHaveClass(/offscreen/);
        const position = await page
            .locator('.enemy-marker[data-id="0"]')
            .evaluate((e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m42);
        expect(position).toBeGreaterThan(400);
        expect(position).toBeLessThan(480);
        await expect(page.locator('.enemy-marker[data-id="1"]')).toHaveClass(/offscreen/);
    });
