import { expect, test } from '@playwright/test';
import type { AppBase } from 'playcanvas';

import { silentMp3 } from './helpers/silent-mp3';
import { openSettings, launchPatrol } from './menu-helpers';

test('music streams lazily, crossfades, preserves transport, and follows gameplay lifecycle', async ({ page }) => {
    test.setTimeout(90000);
    const requests: string[] = [],
        errors: string[] = [];
    page.on('request', (r) => {
        if (r.url().endsWith('.mp3')) requests.push(new URL(r.url()).pathname);
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript({ path: '.agents/skills/inspect-runtime/scripts/devtools-hook.js' });
    await page.addInitScript({
        content: `const nativeConnect=AudioNode.prototype.connect;globalThis.__sfxOutputs=[];AudioNode.prototype.connect=function(destination,...args){if(this instanceof GainNode&&destination instanceof AudioDestinationNode)globalThis.__sfxOutputs.push(this);return nativeConnect.call(this,destination,...args);};`
    });
    await page.route('**/audio/music/manifest.json', (route) =>
        route.fulfill({ json: { menu: 'menu.mp3', combat: 'combat.mp3', boss: 'boss.mp3', death: 'death-cue.mp3' } })
    );
    const fixture = silentMp3();
    await page.route('**/audio/music/*.mp3', (route) =>
        route.fulfill({ status: 200, contentType: 'audio/mpeg', body: fixture })
    );
    await page.goto('/?webgl');
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'locked');
    expect(requests).toEqual([]);
    await openSettings(page);
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'playing');
    await expect
        .poll(() => page.locator('audio[data-music-state=menu]').evaluate((a: HTMLAudioElement) => a.currentTime))
        .toBeGreaterThan(0.1);
    expect(requests).toEqual(['/audio/music/menu.mp3']);
    await openSettings(page);
    await page.locator('#masterVolume').fill('0.5');
    await openSettings(page);
    await page.locator('#musicVolume').fill('0.6');
    await openSettings(page);
    await page.locator('#sfxVolume').fill('0.25');
    await expect
        .poll(() => page.locator('audio[data-music-state=menu]').evaluate((a: HTMLAudioElement) => a.volume))
        .toBeCloseTo(0.3, 2);
    await launchPatrol(page);
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
    await expect
        .poll(() => page.locator('audio[data-music-state=combat]').evaluate((a: HTMLAudioElement) => a.volume))
        .toBeGreaterThan(0.01);
    expect(
        await page.locator('audio[data-music-state=menu]').evaluate((a: HTMLAudioElement) => a.volume)
    ).toBeGreaterThan(0);
    await expect
        .poll(() =>
            page.evaluate(() => (globalThis as unknown as { __sfxOutputs: GainNode[] }).__sfxOutputs[0]?.gain.value)
        )
        .toBeCloseTo(0.125, 2);
    await expect
        .poll(() => page.locator('audio[data-music-state=menu]').evaluate((a: HTMLAudioElement) => a.paused))
        .toBe(true);
    const combatBeforeBoss = await page
        .locator('audio[data-music-state=combat]')
        .evaluate((a: HTMLAudioElement) => a.currentTime);
    const bossEvent = async (name: string) =>
        page.evaluate((name) => {
            const app = [
                ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
            ][0];
            app.fire(name);
        }, name);
    await bossEvent('boss:spawn');
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'boss');
    await expect
        .poll(() => page.locator('audio[data-music-state=boss]').evaluate((a: HTMLAudioElement) => a.currentTime))
        .toBeGreaterThan(0.2);
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'paused');
    const bossPaused = await page
        .locator('audio[data-music-state=boss]')
        .evaluate((a: HTMLAudioElement) => a.currentTime);
    await page.waitForTimeout(300);
    expect(
        await page.locator('audio[data-music-state=boss]').evaluate((a: HTMLAudioElement) => a.currentTime)
    ).toBeCloseTo(bossPaused, 2);
    await launchPatrol(page);
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'boss');
    await expect
        .poll(() => page.locator('audio[data-music-state=boss]').evaluate((a: HTMLAudioElement) => a.currentTime))
        .toBeGreaterThan(bossPaused);
    await bossEvent('boss:defeated');
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
    await expect
        .poll(() => page.locator('audio[data-music-state=combat]').evaluate((a: HTMLAudioElement) => a.currentTime))
        .toBeGreaterThan(combatBeforeBoss);
    await page.keyboard.press('Escape');
    await openSettings(page);
    await page.locator('#masterVolume').fill('0');
    await expect
        .poll(() =>
            page.evaluate(() => [...document.querySelectorAll('audio')].every((a) => a.volume === 0 && a.paused))
        )
        .toBe(true);
    await openSettings(page);
    await page.locator('#masterVolume').fill('0.5');
    await openSettings(page);
    await page.locator('#musicVolume').fill('0');
    await launchPatrol(page);
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'muted');
    await page.keyboard.press('Escape');
    await openSettings(page);
    await page.locator('#musicVolume').fill('0.4');
    await openSettings(page);
    await page.locator('#sfxVolume').fill('0');
    await launchPatrol(page);
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'playing');
    await expect
        .poll(() =>
            page.evaluate(() => (globalThis as unknown as { __sfxOutputs: GainNode[] }).__sfxOutputs[0].gain.value)
        )
        .toBeLessThan(0.001);
    const timeBeforeReset = await page
        .locator('audio[data-music-state=combat]')
        .evaluate((a: HTMLAudioElement) => a.currentTime);
    await page.keyboard.press('KeyR');
    await page.locator('#restart-accept').click();
    expect(
        await page.locator('audio[data-music-state=combat]').evaluate((a: HTMLAudioElement) => a.currentTime)
    ).toBeGreaterThanOrEqual(timeBeforeReset);
    await page.reload();
    expect(await page.locator('#masterVolume').inputValue()).toBe('0.5');
    expect(await page.locator('#musicVolume').inputValue()).toBe('0.4');
    expect(await page.locator('#sfxVolume').inputValue()).toBe('0');
    await launchPatrol(page);
    await expect(page.locator('#menu-heading')).toContainText('Ship lost', { timeout: 40000 });
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'death');
    const death = page.locator('audio[data-music-state=death]');
    expect(await death.evaluate((a: HTMLAudioElement) => a.loop)).toBe(false);
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'ended', { timeout: 11000 });
    const endedAt = await death.evaluate((a: HTMLAudioElement) => a.currentTime);
    expect(endedAt).toBeLessThan(8.3);
    expect(await death.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
    await page.waitForTimeout(250);
    expect(await death.evaluate((a: HTMLAudioElement) => a.currentTime)).toBe(endedAt);
    await page.locator('#retry').click();
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
    expect(await page.locator('audio').count()).toBeLessThanOrEqual(4);
    expect(errors).toEqual([]);
});

test('missing supplied tracks remain silent without requests, errors, or gameplay interruption', async ({ page }) => {
    await page.route('**/audio/music/manifest.json', (route) => route.fulfill({ json: {} }));
    const errors: string[] = [],
        requests: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    page.on('request', (r) => {
        if (r.url().endsWith('.mp3')) requests.push(r.url());
    });
    await page.goto('/?webgl');
    await openSettings(page);
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'missing');
    await launchPatrol(page);
    await expect(page.locator('#menu')).toBeHidden();
    await page.keyboard.down('KeyZ');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyZ');
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu')).toBeVisible();
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
});

test('installed licensed MP3s decode and transition through real game states', async ({ page }) => {
    test.setTimeout(70000);
    const errors: string[] = [],
        requested: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    page.on('request', (r) => {
        if (r.url().endsWith('.mp3')) requested.push(new URL(r.url()).pathname);
    });
    await page.addInitScript({ path: '.agents/skills/inspect-runtime/scripts/devtools-hook.js' });
    await page.goto('/');
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'locked');
    expect(requested).toEqual([]);
    await openSettings(page);
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'playing');
    const menu = page.locator('audio[data-music-state=menu]');
    await expect.poll(() => menu.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0.1);
    expect(await menu.evaluate((a: HTMLAudioElement) => a.duration)).toBeGreaterThan(170);
    expect(requested.every((url) => url.endsWith('/menu.mp3'))).toBe(true);
    await launchPatrol(page);
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
    await expect
        .poll(() => page.locator('audio[data-music-state=combat]').evaluate((a: HTMLAudioElement) => a.currentTime))
        .toBeGreaterThan(0.1);
    const event = async (name: string) =>
        page.evaluate(
            (name) =>
                [
                    ...(globalThis as unknown as { __playcanvasApps: Map<AppBase, unknown> }).__playcanvasApps.keys()
                ][0].fire(name),
            name
        );
    expect(requested.some((url) => url.endsWith('/boss.mp3'))).toBe(false);
    await event('boss:spawn');
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'boss');
    await expect
        .poll(() => page.locator('audio[data-music-state=boss]').evaluate((a: HTMLAudioElement) => a.currentTime))
        .toBeGreaterThan(0.1);
    await event('boss:defeated');
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
    expect(requested.some((url) => url.endsWith('/death-cue.mp3'))).toBe(false);
    await expect(page.locator('#menu-heading')).toContainText('Ship lost', { timeout: 40000 });
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'death');
    const death = page.locator('audio[data-music-state=death]');
    await expect.poll(() => death.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0.1);
    expect(await death.evaluate((a: HTMLAudioElement) => a.duration)).toBeLessThanOrEqual(8.1);
    expect(await death.evaluate((a: HTMLAudioElement) => a.loop)).toBe(false);
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'ended', { timeout: 11000 });
    expect(requested.some((url) => url.endsWith('/death.mp3'))).toBe(false);
    expect(await death.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
    await page.locator('#retry').click();
    await expect(page.locator('#music-status')).toHaveAttribute('data-state', 'combat');
    await expect(page.locator('#music-status')).toHaveAttribute('data-status', 'playing');
    expect(errors).toEqual([]);
});
