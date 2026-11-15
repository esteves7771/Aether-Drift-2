import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
async function sampleFrames(page: Page) {
    return page.evaluate(
        () =>
            new Promise((resolve) => {
                const app = __phase4.app,
                    frames: number[] = [];
                let last = performance.now(),
                    draws = 0;
                app.timeScale = 1;
                const frame = () => {
                    const now = performance.now();
                    frames.push(now - last);
                    last = now;
                    draws = Math.max(draws, app.stats.drawCallCount);
                    if (frames.length === 60) {
                        app.off('frameend', frame);
                        app.timeScale = 0;
                        frames.sort((a, b) => a - b);
                        resolve({ median: frames[30], p95: frames[57], max: frames[59], draws });
                    }
                };
                app.on('frameend', frame);
            })
    );
}

for (const renderer of ['webgpu', 'webgl2'])
    test('Run refit pauses and resets / ' + renderer, async ({ page }) => {
        await page.goto('http://127.0.0.1:5181/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        await page.keyboard.down('Space');
        await page.evaluate(() => {
            __phase4.app.timeScale = 0;
            __phase4.pilot = true;
            __phase4.autoUpgrades = false;
        });
        for (let i = 0; i < 200; i++) {
            const pending = await page.evaluate(() => {
                __phase4.advance(20);
                return __phase4.combat.upgrades.pending;
            });
            if (pending) break;
        }
        await expect(page.locator('#upgrade-panel')).toBeVisible();
        await expect(page.locator('#upgrade-options button')).toHaveCount(3);
        const frozen = await page.evaluate(() => ({
            duration: __phase4.combat.duration,
            pos: __phase4.flight.position.clone(),
            wave: __phase4.combat.wave
        }));
        expect(frozen.wave).toBe(2);
        await page.evaluate(() => __phase4.advance(20));
        expect(
            await page.evaluate(() => ({
                duration: __phase4.combat.duration,
                pos: __phase4.flight.position.clone(),
                wave: __phase4.combat.wave
            }))
        ).toEqual(frozen);
        await page.keyboard.press('Escape');
        await expect(page.locator('#upgrade-panel')).toBeVisible();
        await page.screenshot({ path: 'test-results/frontier-' + renderer + '-upgrade.png' });
        await page.locator('#upgrade-options button').first().click();
        await page.evaluate(() => __phase4.advance(2));
        await expect(page.locator('#upgrade-panel')).toBeHidden();
        expect(await page.evaluate(() => __phase4.combat.upgrades.selections)).toBe(1);
        await page.keyboard.press('Escape');
        await page.locator('#restart').click();
        expect(await page.evaluate(() => __phase4.combat.upgrades.selections)).toBe(0);
    });

for (const renderer of ['webgpu', 'webgl2'])
    test('Living frontier locations and cruise / ' + renderer, async ({ page }) => {
        test.setTimeout(120000);
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto('http://127.0.0.1:5181/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await expect(page.locator('#perf')).toContainText(renderer.toUpperCase());
        await page.locator('#launch').click();
        const count = await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 100;
            const b = h.combat.frontier.bases[0],
                p = b.parts[0];
            const normal = p.local.clone().set(0, 1, 0);
            b.rotation.transformVector(normal, normal);
            h.flight.position.copy(p.position).add(normal.mulScalar(160));
            h.flight.previous.copy(h.flight.position);
            h.flight.velocity.set(0, 0, 0);
            const aim = h.app.root.findByName('Ship')!;
            aim.setPosition(h.flight.position);
            aim.lookAt(p.position);
            h.flight.rotation.copy(aim.getRotation());
            h.flight.previousRotation.copy(h.flight.rotation);
            h.combat.selected = p.id;
            h.combat.frontier.selected = 0;
            h.advance(90);
            return h.app.root.findComponents('render').length;
        });
        expect(await page.evaluate(() => __phase4.combat.frontier.shots)).toBeGreaterThan(0);
        const baseTiming = await sampleFrames(page);
        await page.screenshot({ path: 'test-results/frontier-' + renderer + '-base.png' });
        await page.evaluate(() => {
            const h = __phase4,
                b = h.combat.frontier.bases[0],
                p = b.parts[0];
            b.rotation
                .transformVector(h.flight.position.set(105, b.rock.radius + 85, 80), h.flight.position)
                .add(b.rock.position);
            h.flight.previous.copy(h.flight.position);
            h.flight.velocity.set(0, 0, 0);
            const aim = h.app.root.findByName('Ship')!;
            aim.setPosition(h.flight.position);
            aim.lookAt(p.position);
            h.flight.rotation.copy(aim.getRotation());
            h.flight.previousRotation.copy(h.flight.rotation);
            h.advance(30);
        });
        await page.screenshot({ path: 'test-results/frontier-' + renderer + '-base-mounted.png' });
        await page.keyboard.press('c');
        await page.evaluate(() => __phase4.advance(2));
        expect(await page.evaluate(() => __phase4.cruise.active)).toBe(false);
        await page.keyboard.down('Space');
        await page.evaluate(() => __phase4.advance(45));
        await page.keyboard.up('Space');
        expect(await page.evaluate(() => __phase4.combat.frontier.bases[0].destroyed)).toBe(true);
        expect(await page.evaluate(() => __phase4.combat.score)).toBeGreaterThanOrEqual(350);
        await page.evaluate(() => {
            const h = __phase4,
                w = h.combat.frontier,
                l = w.locations[2];
            w.selected = 2;
            h.flight.position.copy(l.position).add(l.position.clone().set(0, 10, 70));
            h.flight.previous.copy(h.flight.position);
            h.flight.velocity.set(0, 0, 0);
            h.flight.shield = 10;
            const aim = h.app.root.findByName('Ship')!;
            aim.setPosition(h.flight.position);
            aim.lookAt(l.position);
            h.flight.rotation.copy(aim.getRotation());
            h.flight.previousRotation.copy(h.flight.rotation);
            h.advance(30);
        });
        await page.screenshot({ path: 'test-results/frontier-' + renderer + '-wreck.png' });
        await page.keyboard.press('v');
        await page.evaluate(() => __phase4.advance(1));
        expect(await page.evaluate(() => __phase4.combat.frontier.supplies)).toBe(1);
        await page.keyboard.press('v');
        await page.evaluate(() => __phase4.advance(1));
        expect(await page.evaluate(() => __phase4.combat.frontier.supplies)).toBe(1);
        await page.keyboard.press('n');
        await page.evaluate(() => __phase4.advance(1));
        expect(await page.evaluate(() => __phase4.combat.frontier.selected)).toBe(3);
        await page.evaluate(() => {
            const h = __phase4;
            h.flight.position.set(-1600, 900, 300);
            h.flight.previous.copy(h.flight.position);
            h.flight.velocity.set(0, 0, 0);
            h.flight.rotation.set(0, 0, 0, 1);
            h.flight.previousRotation.copy(h.flight.rotation);
            h.combat.countdown = 100;
        });
        await page.keyboard.press('c');
        await page.evaluate(() => __phase4.advance(100));
        expect(await page.evaluate(() => __phase4.cruise.active)).toBe(true);
        expect(await page.evaluate(() => __phase4.flight.velocity.length())).toBeGreaterThan(300);
        await expect(page.locator('#cruise-state')).toHaveAttribute('data-active', 'true');
        const cruiseTiming = await sampleFrames(page);
        await page.screenshot({ path: 'test-results/frontier-' + renderer + '-cruise.png' });
        await page.keyboard.press('Escape');
        const paused = await page.evaluate(() => ({
            pos: __phase4.flight.position.clone(),
            cd: __phase4.cruise.cooldown
        }));
        await page.evaluate(() => __phase4.advance(20));
        expect(
            await page.evaluate(() => ({ pos: __phase4.flight.position.clone(), cd: __phase4.cruise.cooldown }))
        ).toEqual(paused);
        await page.locator('#launch').click();
        await page.evaluate(() => __phase4.advance(70));
        expect(await page.evaluate(() => __phase4.cruise.settling)).toBe(false);
        expect(await page.evaluate(() => __phase4.flight.velocity.length())).toBeLessThan(100);
        expect(await page.evaluate(() => __phase4.app.root.findComponents('render').length)).toBe(count);
        await page.keyboard.press('Escape');
        await page.locator('#restart').click();
        await page.evaluate(() => __phase4.advance(1));
        expect(await page.evaluate(() => __phase4.combat.frontier.supplies)).toBe(0);
        expect(await page.evaluate(() => __phase4.combat.frontier.bases[0].powered)).toBe(true);
        expect(errors).toEqual([]);
        console.log(renderer, { baseTiming, cruiseTiming, renderEntities: count });
    });
