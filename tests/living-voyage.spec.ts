import fs from 'node:fs';

import { test, expect } from '@playwright/test';
import type { ContainerResource, Texture } from 'playcanvas';
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage A Space Voyage convoy / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        const targets = await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            const n = h.combat.targets.length;
            const ok = h.universe.convoys.begin(h.flight.position, h.flight.rotation, 'heavy');
            h.advance(2);
            return { n, ok };
        });
        expect(targets.ok).toBe(true);
        await page.waitForFunction(() => !!__phase4.app.root.findByName('Convoy 0 Space Voyage cruiser 0'), undefined, {
            timeout: 30000
        });
        const result = await page.evaluate(() => {
            const h = __phase4,
                c = h.universe.convoys,
                g = c.groups[0],
                camera = h.app.root.findByName('Chase camera')!;
            g.age = g.duration * 0.45;
            g.update(0);
            h.universe.render(true, 0, h.flight.position, camera);
            h.app.off('update');
            camera.setPosition(
                g.position
                    .clone()
                    .add(g.direction.clone().mulScalar(-800))
                    .add(g.position.clone().set(350, 220, 0))
            );
            camera.lookAt(g.position);
            return {
                targets: h.combat.targets.length,
                cruisers: g.cruisers,
                escorts: g.escorts,
                safe: c.safe(g, h.flight.position)
            };
        });
        expect(result.targets).toBe(targets.n);
        expect(result.cruisers).toBe(3);
        expect(result.escorts).toBe(6);
        expect(result.safe).toBe(true);
        fs.mkdirSync('artifacts/phase5h', { recursive: true });
        await page.screenshot({ path: `artifacts/phase5h/${renderer}-heavy-convoy.png` });
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage B untethered animated EVA / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.waitForFunction(() => !!__phase4.app.root.findByName('Menu floating astronaut'));
        await page.screenshot({ path: `artifacts/phase5h/${renderer}-menu-astronaut.png` });
        const before = await page.evaluate(() => {
            const e = __phase4.app.root.findByName('Menu floating astronaut')!;
            return ['L_Arm.10', 'Spine_2.7'].map((name) => e.findByName(name)!.getLocalRotation().toString());
        });
        await page.waitForTimeout(350);
        const after = await page.evaluate(() => {
            const e = __phase4.app.root.findByName('Menu floating astronaut')!;
            return ['L_Arm.10', 'Spine_2.7'].map((name) => e.findByName(name)!.getLocalRotation().toString());
        });
        expect(after[0]).not.toBe(before[0]);
        expect(after[1]).not.toBe(before[1]);
        await page.locator('#launch').click();
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            const site = h.combat.frontier.locations.find((l) => l.model === 'iss')!;
            h.flight.position.copy(site.position).x += 90;
            h.flight.previous.copy(h.flight.position);
            h.advance(3);
        });
        await page.waitForFunction(() => __phase4.living.astronauts.length >= 8);
        const result = await page.evaluate(() => ({
            count: __phase4.living.astronauts.length,
            cables: __phase4.app.root.findByName('EVA safety tether and light') !== null,
            animated: __phase4.living.astronauts.every((e) => e.findComponents('anim').length > 0)
        }));
        expect(result.cables).toBe(false);
        expect(result.animated).toBe(true);
        expect(before).toBeDefined();
        await page.evaluate(() => {
            const h = __phase4,
                e = h.living.astronauts.find((e) => e.enabled)!,
                camera = h.app.root.findByName('Chase camera')!;
            h.app.off('update');
            const p = e.getPosition();
            camera.setPosition(p.x + 3, p.y + 1, p.z + 5);
            camera.lookAt(p);
        });
        await page.screenshot({ path: `artifacts/phase5h/${renderer}-gameplay-eva.png` });
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage C PTAH shared player systems / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.getByRole('button', { name: 'Next ships' }).click();
        await page.locator('#ship-ptah').click();
        await expect(page.locator('#ship-ptah')).toHaveAttribute('aria-pressed', 'true');
        await page.screenshot({ path: `artifacts/phase5h/${renderer}-ptah-roster.png` });
        await page.locator('#launch').click();
        await page.evaluate(() => {
            __phase4.app.timeScale = 0;
            __phase4.combat.countdown = 1000;
            __phase4.advance(2);
        });
        expect(await page.evaluate(() => __phase4.flight.ship)).toBe('ptah');
        await page.mouse.move(720, 450);
        await page.mouse.down();
        await page.evaluate(() => __phase4.advance(3));
        await page.mouse.up();
        expect(await page.evaluate(() => __phase4.combat.projectiles.fired)).toBeGreaterThan(0);
        await page.screenshot({ path: `artifacts/phase5h/${renderer}-ptah-gameplay.png` });
        await page.keyboard.press('c');
        await page.evaluate(() => __phase4.advance(3));
        await expect(page.locator('#cockpit')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('#cockpit')).toBeHidden();
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage D three firing identities and capital damage / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        for (const key of ['classic', 'surveyor', 'ptah']) {
            if (key === 'ptah') await page.getByRole('button', { name: 'Next ships' }).click();
            await page.locator('#ship-' + key).click();
            await expect(page.locator('#ship-' + key)).toHaveAttribute('aria-pressed', 'true');
            await page.locator('#launch').click();
            const r = await page.evaluate(() => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.combat.countdown = 1000;
                h.advance(1);
                return {
                    shield: h.flight.shield,
                    capacity: h.flight.shieldCapacity,
                    burst: h.flight.spec.weapon.burst
                };
            });
            expect(r.shield).toBe(r.capacity);
            await page.mouse.move(720, 450);
            await page.mouse.down();
            await page.evaluate(() => __phase4.advance(12));
            await page.mouse.up();
            const tags = await page.evaluate(() =>
                __phase4.combat.projectiles.items.filter((p) => p.active && !p.hostile).map((p) => p.pattern)
            );
            expect(tags).toContain(key === 'ptah' ? 7 : key === 'surveyor' ? 6 : 0);
            await page.screenshot({ path: `artifacts/phase5h/${renderer}-${key}-primary.png` });
            await page.keyboard.press('Escape');
            await page.locator('#end-patrol').click();
            await page.locator('#return-home').click();
        }
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage E actual evasive roll and input lifecycle / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        for (const key of ['classic', 'surveyor', 'ptah']) {
            if (key === 'ptah') await page.getByRole('button', { name: 'Next ships' }).click();
            await page.locator('#ship-' + key).click();
            await expect(page.locator('#ship-' + key)).toHaveAttribute('aria-pressed', 'true');
            await page.locator('#launch').click();
            await page.evaluate(() => {
                const h = __phase4;
                h.app.timeScale = 0;
                h.combat.countdown = 1000;
                h.advance(1);
            });
            await page.keyboard.down('KeyD');
            await page.keyboard.down('Space');
            await page.evaluate(() => __phase4.advance(4));
            const roll = await page.evaluate(() => ({
                x: __phase4.flight.position.x,
                active: __phase4.flight.evasion.active,
                side: __phase4.flight.evasion.side,
                cd: __phase4.flight.evasion.cooldown,
                fired: __phase4.combat.projectiles.fired
            }));
            expect(roll.x).toBeGreaterThan(4);
            expect(roll.active).toBe(true);
            expect(roll.side).toBe(1);
            expect(roll.fired).toBe(0);
            await page.screenshot({ path: `artifacts/phase5h/${renderer}-${key}-evade.png` });
            await page.keyboard.down('Space');
            await page.evaluate(() => __phase4.advance(2));
            expect(await page.evaluate(() => __phase4.flight.evasion.cooldown)).toBeLessThan(roll.cd);
            await page.keyboard.press('Escape');
            const frozen = await page.evaluate(() => {
                const h = __phase4,
                    t = h.flight.evasion.age;
                h.advance(8);
                return h.flight.evasion.age === t;
            });
            expect(frozen).toBe(true);
            await page.keyboard.up('Space');
            await page.keyboard.up('KeyD');
            await page.locator('#launch').click();
            await page.keyboard.press('c');
            await page.evaluate(() => __phase4.advance(2));
            await expect(page.locator('#cockpit')).toBeVisible();
            const aligned = await page.evaluate(() => {
                const h = __phase4,
                    camera = h.app.root.findByName('Chase camera')!,
                    v = h.flight.position.clone().set(0, 0, -1),
                    a = h.flight.rotation.transformVector(v),
                    b = camera.getRotation().transformVector(v);
                return a.dot(b);
            });
            expect(aligned).toBeGreaterThan(0.999);
            await page.keyboard.press('r');
            await page.locator('#restart-accept').click();
            expect(await page.evaluate(() => __phase4.flight.evasion.cooldown)).toBe(0);
            await page.keyboard.down('KeyZ');
            await page.evaluate(() => __phase4.advance(4));
            await page.keyboard.up('KeyZ');
            expect(await page.evaluate(() => __phase4.combat.projectiles.fired)).toBeGreaterThan(0);
            await page.keyboard.press('Escape');
            await page.locator('#end-patrol').click();
            await page.locator('#return-home').click();
        }
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage F isolated interactive garage / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        for (const key of ['classic', 'surveyor', 'ptah']) {
            if (key === 'ptah') await page.getByRole('button', { name: 'Next ships' }).click();
            await page.locator('#ship-' + key).click();
            await expect(page.locator('#ship-' + key)).toHaveAttribute('aria-pressed', 'true');
            const surface = page.locator('#ship-inspection');
            await expect(surface).toBeVisible();
            const box = (await surface.boundingBox())!;
            const original = await page.evaluate(() => ({
                ship: __phase4.app.root.findByName('Ship')!.getRotation().toString(),
                planet: __phase4.app.root.findByName('Menu Kepler orbital')!.getRotation().toString(),
                selected: __phase4.hangar.selected
            }));
            await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.7, { steps: 12 });
            await page.mouse.move(50, 50, { steps: 3 });
            await page.mouse.up();
            await page.waitForTimeout(400);
            const rotated = await page.evaluate(() => ({
                ship: __phase4.app.root.findByName('Ship')!.getRotation().toString(),
                camera: __phase4.app.root.findByName('Menu Kepler orbital')!.getRotation().toString(),
                selected: __phase4.hangar.selected
            }));
            expect(rotated.ship).not.toBe(original.ship);
            expect(rotated.selected).toBe(original.selected);
            expect(rotated.camera).toBe(original.planet);
            await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
            await page.mouse.wheel(0, -400);
            await page.waitForTimeout(250);
            await page.screenshot({ path: `artifacts/phase5h/${renderer}-${key}-inspection.png` });
            await surface.dblclick();
        }
        await page.locator('#launch').click();
        await expect(page.locator('#ship-inspection')).toBeHidden();
        await page.keyboard.press('Escape');
        await expect(page.locator('#ship-inspection')).toBeHidden();
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    for (const scenario of [
        { key: 'ptah', wave: 5 },
        { key: 'surveyor', wave: 10 },
        { key: 'classic', wave: 15 }
    ])
        test(
            'Stage G actual capital victory ' + scenario.key + ' ' + scenario.wave + ' / ' + renderer,
            async ({ page, baseURL }) => {
                test.setTimeout(240000);
                const errors: string[] = [];
                page.on('pageerror', (e) => errors.push(e.message));
                page.on('console', (m) => {
                    if (m.type() === 'error') errors.push(m.text());
                });
                await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
                if (scenario.key === 'ptah') await page.getByRole('button', { name: 'Next ships' }).click();
                await page.locator('#ship-' + scenario.key).click();
                await expect(page.locator('#ship-' + scenario.key)).toHaveAttribute('aria-pressed', 'true');
                await page.locator('#launch').click();
                await page.evaluate((w) => {
                    const h = __phase4;
                    h.app.timeScale = 0;
                    h.combat.countdown = 1000;
                    h.combat.director.wave = w;
                    h.combat.director.group = 1;
                    h.combat.boss.spawn(h.flight, h.rocks);
                    h.pilot = true;
                    h.useAbilities = true;
                }, scenario.wave);
                await page.keyboard.down('KeyZ');
                let win = false,
                    last: unknown,
                    peak = 0;
                const phases = new Set<number>();
                for (let i = 0; i < 1400; i++) {
                    const s = await page.evaluate(() => {
                        const h = __phase4;
                        h.advance(10);
                        return {
                            active: h.combat.boss.active,
                            phase: h.combat.boss.phase,
                            health: h.combat.boss.health,
                            hull: h.flight.hull,
                            score: h.combat.score,
                            age: h.combat.boss.age,
                            shots: h.combat.projectiles.items.filter((p) => p.active && p.hostile).length
                        };
                    });
                    last = s;
                    phases.add(s.phase);
                    peak = Math.max(peak, s.shots);
                    if (s.hull <= 0) break;
                    if (!s.active) {
                        win = true;
                        break;
                    }
                }
                fs.writeFileSync(
                    `artifacts/phase5h/${renderer}-${scenario.key}-wave${scenario.wave}.json`,
                    JSON.stringify({ win, last, peak, phases: [...phases] }, null, 2)
                );
                expect(win, JSON.stringify(last)).toBe(true);
                expect([...phases]).toEqual([1, 2, 3]);
                await page.screenshot({ path: `artifacts/phase5h/${renderer}-${scenario.key}-capital-victory.png` });
                expect(errors).toEqual([]);
            }
        );
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage G convoy reuse, station route and budget / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#launch').click();
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.universe.convoys.begin(h.flight.position, h.flight.rotation, 'heavy');
            h.advance(2);
        });
        await page.waitForFunction(() => !!__phase4.app.root.findByName('Convoy 0 Space Voyage cruiser 0'));
        const reuse = await page.evaluate(() => {
            const h = __phase4,
                c = h.universe.convoys,
                counts = [];
            for (let i = 0; i < 12; i++) {
                c.reset(100 + i);
                c.begin(h.flight.position, h.flight.rotation, i % 2 ? 'station' : 'heavy');
                h.universe.render(true, 0, h.flight.position, h.app.root.findByName('Chase camera')!);
                counts.push(h.app.root.findComponents('render').length);
            }
            return { counts, targets: h.combat.targets.length, capacity: c.groups.length };
        });
        expect(new Set(reuse.counts).size).toBe(1);
        expect(reuse.capacity).toBe(2);
        await page.evaluate(() => {
            const h = __phase4,
                c = h.universe.convoys,
                g = c.groups[0],
                camera = h.app.root.findByName('Chase camera')!;
            g.age = g.duration * 0.5;
            g.update(0);
            h.universe.render(true, 0, h.flight.position, camera);
            h.app.off('update');
            camera.setPosition(
                g.position
                    .clone()
                    .add(g.direction.clone().mulScalar(-1300))
                    .add(g.position.clone().set(500, 400, 0))
            );
            camera.lookAt(g.position);
        });
        await page.screenshot({ path: `artifacts/phase5h/${renderer}-station-transit.png` });
        const stats = await page.evaluate(async () => {
            const h = __phase4,
                root = h.app.root.findByName('Space Voyage / noncombat convoys')!,
                calls: number[] = [];
            await new Promise<void>((resolve) => {
                let n = 0;
                const fn = () => {
                    calls.push(h.app.stats.drawCalls.total);
                    if (++n === 30) {
                        h.app.off('frameend', fn);
                        resolve();
                    }
                };
                h.app.on('frameend', fn);
            });
            root.enabled = false;
            await new Promise<void>((resolve) => {
                let n = 0;
                const fn = () => {
                    if (++n === 5) {
                        h.app.off('frameend', fn);
                        resolve();
                    }
                };
                h.app.on('frameend', fn);
            });
            const withoutConvoy = h.app.stats.drawCalls.total;
            root.enabled = true;
            const importedTextureBytes = Object.fromEntries(
                ['voyage', 'ptah'].map((key) => {
                    const asset = h.app.assets.find('Imported ' + key, 'container');
                    const resource = asset?.resource as ContainerResource | undefined;
                    return [
                        key,
                        resource?.textures.reduce((sum, texture) => sum + (texture.resource as Texture).gpuSize, 0) ?? 0
                    ];
                })
            );
            const c = h.universe.convoys;
            const second = c.begin(h.flight.position, h.flight.rotation, 'standard');
            const start = performance.now();
            for (let i = 0; i < 10000; i++) {
                for (const g of c.groups) if (g.active) g.age = g.duration * 0.5;
                c.countdown = 1000;
                c.step(1 / 120, h.flight.position, h.flight.rotation, true);
            }
            const logicMs = (performance.now() - start) / 10000;
            return {
                logicMs,
                withoutConvoy,
                addedDrawCalls: Math.max(...calls) - withoutConvoy,
                importedTextureBytes,
                activeGroups: c.groups.filter((g) => g.active).length,
                second,
                drawCalls: calls,
                renderEntities: h.app.root.findComponents('render').length,
                noncombatRenderComponents: root.findComponents('render').length
            };
        });
        fs.writeFileSync(
            `artifacts/phase5h/${renderer}-convoy-budget.json`,
            JSON.stringify({ reuse, ...stats }, null, 2)
        );
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage G async selection abilities death and retry / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.route('**/models/spaceship.glb', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            await route.continue();
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.locator('#ship-surveyor').click();
        await page.getByRole('button', { name: 'Next ships' }).click();
        await page.locator('#ship-ptah').click();
        await expect(page.locator('#ship-ptah')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('#launch')).toBeEnabled();
        await page.locator('#launch').click();
        const abilities = await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.combat.rocks.length = 0;
            h.advance(1);
            const e = h.combat.enemies[0];
            e.spawn('heavy', h.flight.position.clone().set(0, 0, -140), h.flight.rotation);
            h.combat.selected = e.id;
            return {
                missile: h.combat.launchMissile(),
                emp: h.combat.emp(),
                disrupted: e.disrupted,
                shield: h.flight.shieldCapacity
            };
        });
        expect(abilities.missile).toBe(true);
        expect(abilities.emp).toBe(true);
        expect(abilities.disrupted).toBeGreaterThan(0);
        expect(abilities.shield).toBe(55);
        await page.keyboard.down('KeyA');
        await page.keyboard.down('KeyD');
        await page.keyboard.press('Space');
        await page.evaluate(() => __phase4.advance(2));
        expect(await page.evaluate(() => __phase4.flight.evasion.side)).toBe(1);
        await page.keyboard.up('KeyA');
        await page.keyboard.up('KeyD');
        await page.evaluate(() => {
            const h = __phase4;
            h.combat.hurtPlayer(9999, h.flight.position);
            h.advance(2);
        });
        await expect(page.locator('#menu')).toHaveAttribute('data-screen', 'debrief');
        await expect(page.locator('#ship-inspection')).toBeHidden();
        await page.screenshot({ path: `artifacts/phase5h/${renderer}-ptah-debrief.png` });
        await page.locator('#retry').click();
        expect(
            await page.evaluate(() => ({
                hull: __phase4.flight.hull,
                ship: __phase4.flight.ship,
                cd: __phase4.flight.evasion.cooldown
            }))
        ).toEqual({ hull: 100, ship: 'ptah', cd: 0 });
        expect(errors).toEqual([]);
    });
for (const renderer of ['webgpu', 'webgl2'])
    test('Stage G PTAH and convoy graphics budgets / ' + renderer, async ({ page, baseURL }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto(baseURL! + '/' + (renderer === 'webgl2' ? '?webgl' : ''));
        await page.getByRole('button', { name: 'Next ships' }).click();
        await page.locator('#ship-ptah').click();
        await expect(page.locator('#ship-ptah')).toHaveAttribute('aria-pressed', 'true');
        await page.locator('#show-settings').click();
        for (const preset of ['low', 'high', 'medium']) {
            await page.locator('#graphics').selectOption(preset);
            await expect(page.locator('body')).toHaveAttribute('data-graphics', preset);
        }
        await page.locator('#menu-back').click();
        await page.locator('#launch').click();
        await page.evaluate(() => {
            const h = __phase4;
            h.app.timeScale = 0;
            h.combat.countdown = 1000;
            h.universe.convoys.begin(h.flight.position, h.flight.rotation, 'heavy');
            h.advance(2);
        });
        await page.waitForFunction(() => !!__phase4.app.root.findByName('Convoy 0 Space Voyage cruiser 0'));
        await page.evaluate(() => {
            const h = __phase4,
                g = h.universe.convoys.groups[0];
            g.age = g.duration * 0.5;
            g.update(0);
            h.flight.position.copy(g.position).add(g.direction.clone().mulScalar(-1000));
            h.flight.previous.copy(h.flight.position);
            h.advance(2);
        });
        const results: unknown[] = [];
        for (const preset of ['low', 'high', 'medium']) {
            await page.keyboard.press('Escape');
            await page.locator('#show-settings').click();
            await page.locator('#graphics').selectOption(preset);
            await page.locator('#menu-back').click();
            await page.locator('#launch').click();
            await page.evaluate(() => __phase4.advance(2));
            results.push(
                await page.evaluate((preset) => {
                    const h = __phase4;
                    const root = h.app.root.findByName('Space Voyage / noncombat convoys')!;
                    const active = root.children.filter((e) => e.enabled).length;
                    const resource = h.app.assets.find('Imported ptah', 'container')!.resource as ContainerResource;
                    return {
                        preset,
                        active,
                        ptahTextureBytes: resource.textures.reduce((sum, t) => sum + (t.resource as Texture).gpuSize, 0)
                    };
                }, preset)
            );
            await page.screenshot({ path: `artifacts/phase5h/${renderer}-ptah-${preset}.png` });
        }
        expect(results.map((r) => (r as { active: number }).active)).toEqual([6, 9, 7]);
        fs.writeFileSync(`artifacts/phase5h/${renderer}-presets.json`, JSON.stringify(results, null, 2));
        expect(errors).toEqual([]);
    });
