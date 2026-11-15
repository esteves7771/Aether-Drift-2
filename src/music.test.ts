import { describe, expect, it, vi } from 'vitest';

import { loadSettings } from './config';
import { MUSIC, MusicManager } from './music';
import type { MusicMedia, MusicState } from './music';
class FakeMedia implements MusicMedia {
    src = '';
    preload = '';
    loop = false;
    volume = 0;
    currentTime = 0;
    paused = true;
    plays = 0;
    removed = false;
    reject?: Error;
    pending?: Promise<void>;
    readonly handlers = new Map<string, () => void>();
    play() {
        this.plays++;
        if (this.reject) return Promise.reject(this.reject);
        this.paused = false;
        return this.pending ?? Promise.resolve();
    }
    pause() {
        this.paused = true;
    }
    load() {
        /* no network in simulation */
    }
    removeAttribute() {
        this.src = '';
    }
    remove() {
        this.removed = true;
    }
    addEventListener(type: string, callback: () => void) {
        this.handlers.set(type, callback);
    }
}
const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};
function setup() {
    const tracks = new Map<MusicState, FakeMedia>();
    const manager = new MusicManager(
        { menu: 'menu.mp3', combat: 'combat.mp3', boss: 'boss.mp3', death: 'death-cue.mp3' },
        (state) => {
            const m = new FakeMedia();
            tracks.set(state, m);
            return m;
        }
    );
    const tick = (seconds: number) => {
        for (let i = 0; i < seconds * 20; i++) {
            for (const m of tracks.values()) if (!m.paused) m.currentTime += 0.05;
            manager.update(0.05);
        }
    };
    return { manager, tracks, tick };
}
describe('streaming soundtrack', () => {
    it('can return to a still-loading channel without a stale play promise pausing its replacement', async () => {
        const tracks = new Map<MusicState, FakeMedia>();
        let resolveOld!: () => void;
        const manager = new MusicManager({ menu: 'menu.mp3', combat: 'combat.mp3' }, (state) => {
            const media = new FakeMedia();
            if (state === 'menu')
                media.pending = new Promise<void>((resolve) => {
                    resolveOld = resolve;
                });
            tracks.set(state, media);
            return media;
        });
        manager.unlock();
        manager.setState('combat');
        manager.update(0.05);
        const menu = tracks.get('menu')!;
        menu.pending = undefined;
        manager.setState('menu');
        await flush();
        resolveOld();
        await flush();
        expect(menu.plays).toBe(2);
        expect(menu.paused).toBe(false);
        expect(manager.status).toBe('playing');
    });
    it('loads nothing before gesture and only the selected track after unlock', async () => {
        const { manager, tracks } = setup();
        manager.update(1);
        expect(tracks.size).toBe(0);
        manager.unlock();
        await flush();
        expect([...tracks.keys()]).toEqual(['menu']);
        expect(tracks.get('menu')!.preload).toBe('none');
        expect(tracks.get('menu')!.loop).toBe(true);
    });
    it('crossfades and reuses combat playback when returning from boss', async () => {
        const { manager, tracks, tick } = setup();
        manager.unlock();
        await flush();
        tick(2);
        manager.setState('combat');
        await flush();
        tick(0.4);
        expect(tracks.get('menu')!.volume).toBeGreaterThan(0);
        expect(tracks.get('combat')!.volume).toBeGreaterThan(0);
        tick(1);
        expect(tracks.get('menu')!.paused).toBe(true);
        const combat = tracks.get('combat')!;
        const time = combat.currentTime,
            plays = combat.plays;
        manager.setState('combat');
        tick(0.2);
        expect(combat.plays).toBe(plays);
        expect(combat.currentTime).toBeGreaterThan(time);
        manager.setState('boss');
        await flush();
        tick(2);
        const pausedAt = combat.currentTime;
        manager.setState('combat');
        await flush();
        expect(combat.currentTime).toBe(pausedAt);
        tick(2);
        expect(tracks.size).toBe(3);
        expect(combat.volume).toBeCloseTo(0.15);
    });
    it('pauses envelope and transport, resumes without seeking, and supports master/music mute', async () => {
        const { manager, tracks, tick } = setup();
        manager.unlock();
        await flush();
        tick(1);
        const m = tracks.get('menu')!,
            t = m.currentTime,
            v = m.volume;
        manager.setPaused(true);
        tick(1);
        expect(m.currentTime).toBe(t);
        expect(m.volume).toBe(v);
        manager.setPaused(false);
        await flush();
        tick(0.2);
        expect(m.currentTime).toBeGreaterThan(t);
        manager.setVolumes(0, 0.5);
        expect(m.paused).toBe(true);
        expect(m.volume).toBe(0);
        const mutedAt = m.currentTime;
        manager.setVolumes(0.5, 0.4);
        await flush();
        tick(2);
        expect(m.currentTime).toBeGreaterThan(mutedAt);
        expect(m.volume).toBeCloseTo(0.2);
        manager.setVolumes(1, 0);
        expect(m.paused).toBe(true);
    });
    it('does not retry autoplay rejection every frame and retries on a new gesture', async () => {
        const media = new FakeMedia();
        media.reject = new DOMException('Gesture required', 'NotAllowedError');
        const m = new MusicManager({ menu: 'menu.mp3' }, () => media);
        m.unlock();
        await flush();
        for (let i = 0; i < 100; i++) m.update(0.05);
        expect(media.plays).toBe(1);
        expect(m.status).toBe('blocked');
        media.reject = undefined;
        m.unlock();
        await flush();
        expect(media.plays).toBe(2);
        expect(m.status).toBe('playing');
    });
    it('guards late play resolution across pause/resume and destruction', async () => {
        const media = new FakeMedia();
        let finish!: () => void;
        media.pending = new Promise<void>((resolve) => {
            finish = resolve;
        });
        const m = new MusicManager({ menu: 'menu.mp3' }, () => media);
        m.unlock();
        m.setPaused(true);
        media.pending = undefined;
        m.setPaused(false);
        await flush();
        finish();
        await flush();
        expect(media.paused).toBe(false);
        m.destroy();
        expect(media.paused).toBe(true);
        expect(media.removed).toBe(true);
        m.unlock();
        expect(media.plays).toBe(2);
    });
    it('plays death once, fades the ending, bounds an accidentally long cue, and rearms only for a new death', async () => {
        const { manager, tracks, tick } = setup();
        manager.setState('death');
        manager.unlock();
        await flush();
        const death = tracks.get('death')!;
        expect(death.loop).toBe(false);
        tick(4);
        const loud = death.volume;
        tick(3);
        expect(death.volume).toBeLessThan(loud);
        tick(2);
        expect(death.currentTime).toBeGreaterThanOrEqual(MUSIC.deathDuration);
        expect(death.paused).toBe(true);
        expect(manager.status).toBe('ended');
        manager.setState('death');
        manager.unlock();
        expect(death.plays).toBe(1);
        manager.setState('combat');
        await flush();
        manager.setState('death');
        await flush();
        expect(death.currentTime).toBe(0);
        expect(death.plays).toBe(2);
    });
    it('handles absent and corrupt files without retry loops or affecting other states', async () => {
        const missing = new MusicManager({}, () => {
            throw new Error('Must not create audio');
        });
        missing.unlock();
        missing.update(1);
        expect(missing.status).toBe('missing');
        const { manager, tracks, tick } = setup();
        manager.unlock();
        await flush();
        tracks.get('menu')!.handlers.get('error')!();
        tick(1);
        manager.unlock();
        expect(tracks.get('menu')!.plays).toBe(1);
        expect(manager.status).toBe('missing');
        manager.setState('combat');
        await flush();
        expect(manager.status).toBe('playing');
    });
    it('migrates existing SFX volume and clamps independent saved audio preferences', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => JSON.stringify({ volume: 0, masterVolume: 2, musicVolume: -1 })
        });
        try {
            const settings = loadSettings();
            expect(settings.sfxVolume).toBe(0);
            expect(settings.masterVolume).toBe(1);
            expect(settings.musicVolume).toBe(0);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
