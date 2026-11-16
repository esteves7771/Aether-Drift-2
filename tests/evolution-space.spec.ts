import fs from 'node:fs';

import { expect, test } from '@playwright/test';

for (const renderer of ['webgpu', 'webgl2'])
    test('Stage A acquisition and roster / ' + renderer, async ({ page }) => {
        test.setTimeout(120000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto('http://127.0.0.1:5187/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await expect(page.locator('#show-ships')).toHaveCount(0);
        await expect(page.locator('.roster-arrow').first()).toBeVisible();
        await page.locator('#ship-surveyor').click();
        await expect(page.locator('#ship-surveyor')).toHaveAttribute('aria-pressed', 'true');
        await page.evaluate(() => {
            const h = __phase4.hangar,
                card = document.getElementById('ship-classic')!.cloneNode(true) as HTMLElement;
            card.id = 'future-fixture';
            document.querySelector('.roster-cards')!.append(card);
            h.roster.render();
        });
        await page.getByRole('button', { name: 'Next ships' }).click();
        await expect(page.locator('#future-fixture')).toBeVisible();
        expect(await page.evaluate(() => __phase4.hangar.selected)).toBe('surveyor');
        await page.getByRole('button', { name: 'Previous ships' }).click();
        await page.evaluate(() => {
            document.getElementById('future-fixture')!.remove();
            __phase4.hangar.roster.render();
        });
        await page.locator('#ship-classic').click();
        fs.mkdirSync('artifacts/phase5fc', { recursive: true });
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-menu.png` });
        await page.locator('#launch').click();
        const result = await page.evaluate(() => {
            const h = __phase4,
                c = h.combat;
            h.app.timeScale = 0;
            c.countdown = 1000;
            h.advance(2);
            for (const e of c.enemies) e.active = false;
            // Controlled open-space fixture: the actual game acquisition, launch, rendering and HUD paths.
            h.flight.position.set(0, 1400, 0);
            h.flight.previous.copy(h.flight.position);
            h.flight.rotation.set(0, 0, 0, 1);
            h.flight.previousRotation.copy(h.flight.rotation);
            const e = c.enemies[0];
            e.spawn('interceptor', h.flight.position.clone().add({ x: 12, y: 0, z: -180 } as never), h.flight.rotation);
            e.arrival = 0;
            e.warmup = 5;
            const barrel = c.barrels.items[0];
            barrel.position.copy(h.flight.position).z -= 1477;
            c.selectTarget();
            const selected = c.selected,
                ammo = c.ammo;
            const launched = c.launchMissile(),
                missile = c.missiles.items.find((m) => m.active)?.targetId;
            h.chase.reset();
            h.advance(2);
            return {
                selected,
                enemy: e.id,
                launched,
                spent: ammo - c.ammo,
                missile
            };
        });
        expect(result.selected).toBe(result.enemy);
        expect(result.launched).toBe(true);
        expect(result.spent).toBe(1);
        expect(result.missile).toBe(result.enemy);
        await page.waitForTimeout(300);
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-targeting.png` });
        await page.keyboard.press('c');
        await page.evaluate(() => __phase4.advance(3));
        await expect(page.locator('#cockpit')).toBeVisible();
        await page.locator('#cockpit-art').evaluate((i: HTMLImageElement) => i.decode());
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-targeting-cockpit.png` });
        const manual = await page.evaluate(() => {
            const h = __phase4,
                c = h.combat;
            for (const e of c.enemies) e.active = false;
            c.projectiles.reset();
            c.missiles.reset();
            const barrel = c.barrels.items[0];
            barrel.origin.copy(h.flight.position).z -= 240;
            barrel.position.copy(barrel.origin);
            barrel.previous.copy(barrel.origin);
            c.selectTarget(true);
            const manual = c.selected;
            barrel.active = false;
            c.selected = -1;
            c.targeting.reset();
            c.missileCooldown = 0;
            const ammo = c.ammo,
                launched = c.launchMissile();
            barrel.active = true;
            barrel.position.copy(barrel.origin);
            c.selectTarget(true);
            h.advance(1);
            return { manual, barrel: barrel.id, launched, spent: ammo - c.ammo };
        });
        expect(manual.manual).toBe(manual.barrel);
        expect(manual.launched).toBe(false);
        expect(manual.spent).toBe(0);
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-manual-cargo.png` });
        const boss = await page.evaluate(() => {
            const h = __phase4,
                c = h.combat;
            c.boss.spawn(h.flight, c.rocks);
            for (let i = 0; i < 420 && !c.boss.parts.some((p) => p.targetable); i++) h.advance(1);
            c.selectTarget();
            h.advance(3);
            return {
                active: c.boss.active,
                role: c.getTarget(c.selected)?.targetRole,
                targetable: c.getTarget(c.selected)?.targetable
            };
        });
        expect(boss.active).toBe(true);
        expect(boss.role).toBe('boss');
        expect(boss.targetable).toBe(true);
        await expect(page.locator('#cp-target')).toContainText(/TURRET|ARTILLERY BANK/);
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-boss-lock.png` });
        expect(errors).toEqual([]);
    });

for (const renderer of ['webgpu', 'webgl2'])
    test('Stage C depth, presets and cockpit / ' + renderer, async ({ page }) => {
        test.setTimeout(120000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto('http://127.0.0.1:5187/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.locator('#launch').click();
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.advance(20);
        });
        await page.waitForFunction(() => __phase4.universe.satellites.length === 20);
        fs.mkdirSync('artifacts/phase5fc', { recursive: true });
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-cinematic-chase.png` });
        const parallax = await page.evaluate(() => {
            const h = __phase4,
                star = h.app.root.findByName('Stars')!,
                moon = h.app.root.findByName('Selene / mineral moon')!,
                before = moon.getPosition().clone(),
                starBefore = star.getPosition().clone(),
                s = h.universe.world.satellites[0].origin.clone();
            h.flight.position.x += 250;
            h.flight.previous.copy(h.flight.position);
            h.chase.reset();
            h.advance(1);
            return {
                starMoved: star.getPosition().distance(starBefore),
                bodyMoved: moon.getPosition().distance(before),
                satelliteOriginMoved: h.universe.world.satellites[0].origin.distance(s)
            };
        });
        expect(parallax.starMoved).toBeGreaterThan(240);
        expect(parallax.bodyMoved).toBe(0);
        expect(parallax.satelliteOriginMoved).toBe(0);
        for (const [preset, budget] of [
            ['low', 8],
            ['medium', 14],
            ['high', 20]
        ] as const) {
            await page.keyboard.press('Escape');
            await page.locator('#show-settings').click();
            await page.locator('#graphics').selectOption(preset);
            await page.keyboard.press('Escape');
            await page.locator('#launch').click();
            await page.evaluate(() => __phase4.advance(5));
            const state = await page.evaluate(() => ({
                count: __phase4.universe.world.satellites.length,
                visible: __phase4.universe.visibleSatellites,
                renders: __phase4.app.root.findComponents('render').length,
                draws: __phase4.app.stats.drawCallCount
            }));
            expect(state.count).toBe(50);
            expect(state.visible).toBeLessThanOrEqual(budget);
            await page.screenshot({ path: `artifacts/phase5fc/${renderer}-${preset}.png` });
        }
        await page.keyboard.press('c');
        await page.evaluate(() => __phase4.advance(3));
        await expect(page.locator('#cockpit')).toBeVisible();
        await page.locator('#cockpit-art').evaluate((i: HTMLImageElement) => i.decode());
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-cinematic-cockpit.png` });
        const metrics = await page.evaluate(async () => {
            const h = __phase4,
                updates: number[] = [],
                renders: number[] = [],
                frames: number[] = [];
            let previous = performance.now();
            for (let i = 0; i < 90; i++) {
                await new Promise<void>((r) => requestAnimationFrame(() => r()));
                const now = performance.now();
                frames.push(now - previous);
                previous = now;
                updates.push(h.app.stats.frame.updateTime);
                renders.push(h.app.stats.frame.renderTime);
            }
            const summary = (a: number[]) => {
                a.sort((a, b) => a - b);
                return { median: a[Math.floor(a.length * 0.5)], p95: a[Math.floor(a.length * 0.95)] };
            };
            return {
                raf: summary(frames),
                update: summary(updates),
                render: summary(renders),
                draws: h.app.stats.drawCallCount,
                components: h.app.root.findComponents('render').length,
                satellitePool: h.universe.satellites.length,
                visible: h.universe.visibleSatellites
            };
        });
        fs.writeFileSync(`artifacts/phase5fc/${renderer}-after.json`, JSON.stringify(metrics, null, 2));
        expect(errors).toEqual([]);
    });

for (const renderer of ['webgpu', 'webgl2'])
    test('Stage B living universe / ' + renderer, async ({ page }) => {
        test.setTimeout(120000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto('http://127.0.0.1:5187/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.locator('#launch').click();
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.advance(5);
        });
        await page.waitForFunction(() => __phase4.universe.satellites.length === 20);
        const counts = await page.evaluate(() => ({
            population: __phase4.universe.world.satellites.length,
            locations: __phase4.combat.frontier.locations.length,
            targets: __phase4.combat.targets.length
        }));
        expect(counts.population).toBe(50);
        expect(counts.locations).toBe(10);
        fs.mkdirSync('artifacts/phase5fc', { recursive: true });
        for (const kind of ['orbit', 'drift', 'static', 'abandoned']) {
            const state = await page.evaluate((kind) => {
                const h = __phase4,
                    u = h.universe,
                    s = u.world.satellites.find((s) => s.kind === kind)!;
                h.flight.position.copy(s.position).add({ x: 10, y: 12, z: 110 } as never);
                h.flight.previous.copy(h.flight.position);
                h.flight.velocity.set(0, 0, 0);
                h.flight.rotation.set(0, 0, 0, 1);
                h.flight.previousRotation.copy(h.flight.rotation);
                h.chase.reset();
                h.advance(80);
                return { visible: u.visibleSatellites, targets: h.combat.targets.length, pool: u.satellites.length };
            }, kind);
            expect(state.pool).toBe(20);
            expect(state.visible).toBeGreaterThan(0);
            expect(state.visible).toBeLessThanOrEqual(14);
            expect(state.targets).toBe(counts.targets);
            await page.waitForTimeout(250);
            await page.screenshot({ path: `artifacts/phase5fc/${renderer}-satellite-${kind}.png` });
        }
        await page.evaluate(() => {
            const h = __phase4,
                l = h.combat.frontier.locations.find((l) => l.model === 'iss')!;
            h.flight.position.copy(l.position).add({ x: 0, y: 45, z: 380 } as never);
            h.flight.previous.copy(h.flight.position);
            h.chase.reset();
            h.advance(2);
        });
        await page.waitForFunction(() => __phase4.app.assets.find('Imported iss')?.loaded);
        await page.evaluate(() => __phase4.advance(2));
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-station-satellites.png` });
        const event = await page.evaluate(() => {
            const h = __phase4;
            h.flight.position.set(0, 1400, 0);
            h.flight.previous.copy(h.flight.position);
            h.chase.reset();
            h.universe.traffic.countdown = 0;
            h.advance(2);
            return { active: h.universe.traffic.active, count: h.universe.traffic.count };
        });
        expect(event.active).toBe(true);
        expect(event.count).toBe(1);
        await page.evaluate(() => {
            const h = __phase4,
                t = h.universe.traffic;
            t.step(t.duration * 0.45, h.flight.position, false);
            h.advance(2);
            h.flight.position.copy(t.positions[0]).add({ x: 0, y: 25, z: 180 } as never);
            h.flight.previous.copy(h.flight.position);
            h.chase.reset();
            h.advance(1);
        });
        await page.waitForTimeout(250);
        await page.screenshot({ path: `artifacts/phase5fc/${renderer}-courier-flyby.png` });
        await page.keyboard.press('Escape');
        const time = await page.evaluate(() => __phase4.universe.world.time);
        await page.evaluate(() => __phase4.advance(30));
        expect(await page.evaluate(() => __phase4.universe.world.time)).toBe(time);
        await page.locator('#restart').click();
        await page.locator('#restart-accept').click();
        await page.evaluate(() => __phase4.advance(1));
        expect(await page.evaluate(() => __phase4.universe.world.satellites.length)).toBe(50);
        expect(await page.evaluate(() => __phase4.universe.traffic.active)).toBe(false);
        expect(await page.evaluate(() => __phase4.universe.satellites.length)).toBe(20);
        expect(errors).toEqual([]);
    });
