import { defaults } from './config';
export type MusicState = 'menu' | 'combat' | 'boss' | 'death';
export type MusicAssets = Partial<Record<MusicState, string>>;
export const MUSIC_FILES = {
    menu: 'menu.mp3',
    combat: 'combat.mp3',
    boss: 'boss.mp3',
    death: 'death-cue.mp3'
} as const;
export const MUSIC = { crossfade: 1.2, deathCrossfade: 0.45, deathDuration: 8, deathFadeOut: 2.5 } as const;
export async function loadMusicAssets(): Promise<MusicAssets> {
    try {
        const base = new URL(`${import.meta.env.BASE_URL}audio/music/`, location.href);
        const response = await fetch(new URL('manifest.json', base));
        if (!response.ok) return {};
        const files: unknown = await response.json();
        const assets: MusicAssets = {};
        if (!files || typeof files !== 'object') return assets;
        for (const state of Object.keys(MUSIC_FILES) as MusicState[]) {
            if ((files as Record<string, unknown>)[state] === MUSIC_FILES[state])
                assets[state] = new URL(MUSIC_FILES[state], base).href;
        }
        return assets;
    } catch {
        return {};
    }
}
export interface MusicMedia {
    src: string;
    preload: string;
    loop: boolean;
    volume: number;
    currentTime: number;
    readonly paused: boolean;
    play(): Promise<void>;
    pause(): void;
    load(): void;
    removeAttribute(name: string): void;
    remove(): void;
    addEventListener(type: string, callback: () => void): void;
}
interface Channel {
    state: MusicState;
    audio: MusicMedia;
    gain: number;
    pending: boolean;
    blocked: boolean;
    failed: boolean;
    completed: boolean;
    generation: number;
}
export type MusicStatus = 'locked' | 'paused' | 'muted' | 'missing' | 'blocked' | 'loading' | 'playing' | 'ended';
function clamp(value: number) {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
/** Streaming, lazy media channels; fixed small cache and no independent timers/audio contexts. */
export class MusicManager {
    private readonly assets: MusicAssets;
    private readonly channels = new Map<MusicState, Channel>();
    private readonly createMedia: (state: MusicState) => MusicMedia;
    private state: MusicState = 'menu';
    private paused = false;
    private unlocked = false;
    private destroyed = false;
    private master = 1;
    private music = defaults.musicVolume;
    constructor(assets: MusicAssets, createMedia?: (state: MusicState) => MusicMedia) {
        this.assets = assets;
        this.createMedia =
            createMedia ??
            ((state) => {
                const media = document.createElement('audio');
                media.dataset.musicState = state;
                media.hidden = true;
                document.body.append(media);
                return media;
            });
    }
    get currentState() {
        return this.state;
    }
    get status(): MusicStatus {
        if (!this.assets[this.state]) return 'missing';
        if (!this.unlocked) return 'locked';
        if (this.paused) return 'paused';
        if (this.master * this.music === 0) return 'muted';
        const c = this.channels.get(this.state);
        if (c?.failed) return 'missing';
        if (c?.completed) return 'ended';
        if (c?.blocked) return 'blocked';
        return !c || c.pending || c.audio.paused ? 'loading' : 'playing';
    }
    setState(state: MusicState) {
        if (this.destroyed || state === this.state) return;
        this.state = state;
        const c = this.channels.get(state);
        if (c) {
            c.blocked = false;
            if (state === 'death') {
                c.audio.pause();
                c.generation++;
                c.pending = false;
                c.completed = false;
                c.gain = 0;
                try {
                    c.audio.currentTime = 0;
                } catch {
                    /* A not-yet-ready element already starts at zero. */
                }
            }
        }
        this.ensureSelected();
    }
    /** Call directly inside a pointer/key gesture; reattempt a rejected play only on a new gesture. */
    unlock() {
        if (this.destroyed) return;
        this.unlocked = true;
        for (const c of this.channels.values()) c.blocked = false;
        this.ensureSelected();
    }
    setPaused(paused: boolean) {
        if (this.destroyed || this.paused === paused) return;
        this.paused = paused;
        if (paused)
            for (const c of this.channels.values()) {
                c.generation++;
                c.pending = false;
                c.audio.pause();
            }
        else {
            this.ensureSelected();
            for (const c of this.channels.values()) if (c.gain > 0) this.play(c);
        }
    }
    setVolumes(master: number, music: number) {
        master = clamp(master);
        music = clamp(music);
        if (this.master === master && this.music === music) return;
        this.master = master;
        this.music = music;
        if (master * music === 0)
            for (const c of this.channels.values()) {
                c.generation++;
                c.pending = false;
                c.audio.volume = 0;
                c.audio.pause();
            }
        else {
            this.ensureSelected();
            for (const c of this.channels.values()) {
                this.applyVolume(c);
                if (c.gain > 0) this.play(c);
            }
        }
    }
    private ensureSelected() {
        if (
            this.destroyed ||
            !this.unlocked ||
            this.paused ||
            this.master * this.music === 0 ||
            !this.assets[this.state]
        )
            return;
        let c = this.channels.get(this.state);
        if (!c) {
            const audio = this.createMedia(this.state);
            audio.preload = 'none';
            audio.loop = this.state !== 'death';
            audio.volume = 0;
            c = {
                state: this.state,
                audio,
                gain: 0,
                pending: false,
                blocked: false,
                failed: false,
                completed: false,
                generation: 0
            };
            this.channels.set(this.state, c);
            const channel = c;
            audio.addEventListener('error', () => {
                if (!this.destroyed) {
                    channel.failed = true;
                    channel.pending = false;
                    channel.gain = 0;
                    audio.volume = 0;
                    audio.pause();
                }
            });
            audio.addEventListener('ended', () => {
                if (channel.state === 'death') this.finishDeath(channel);
            });
            audio.src = this.assets[this.state]!;
        }
        this.play(c);
    }
    private wanted(c: Channel) {
        return (
            !this.destroyed &&
            !this.paused &&
            this.master * this.music > 0 &&
            !c.failed &&
            !c.completed &&
            (c.state === this.state || c.gain > 0)
        );
    }
    private play(c: Channel) {
        if (!this.wanted(c) || c.pending || c.blocked || !c.audio.paused) return;
        c.pending = true;
        const generation = c.generation;
        void c.audio
            .play()
            .then(() => {
                if (generation !== c.generation) return;
                if (this.destroyed) {
                    c.audio.pause();
                    return;
                }
                c.pending = false;
                if (!this.wanted(c)) c.audio.pause();
            })
            .catch((error: unknown) => {
                if (this.destroyed || generation !== c.generation) return;
                c.pending = false;
                const name = error instanceof Error ? error.name : '';
                if (name === 'NotAllowedError') c.blocked = true;
                else if (name !== 'AbortError') {
                    c.failed = true;
                    c.audio.pause();
                }
            });
    }
    private finishDeath(c: Channel) {
        c.completed = true;
        c.gain = 0;
        c.audio.volume = 0;
        c.audio.pause();
    }
    private applyVolume(c: Channel) {
        let envelope = Math.sin((c.gain * Math.PI) / 2);
        if (c.state === 'death') envelope *= clamp((MUSIC.deathDuration - c.audio.currentTime) / MUSIC.deathFadeOut);
        c.audio.volume = clamp(this.master * this.music * envelope);
    }
    update(dt: number) {
        if (this.destroyed || this.paused || !this.unlocked || this.master * this.music === 0) return;
        const selected = this.channels.get(this.state);
        const incomingReady = selected && !selected.failed && !selected.pending && !selected.audio.paused;
        const unavailable = !this.assets[this.state] || selected?.failed || selected?.completed;
        const fade = this.state === 'death' ? MUSIC.deathCrossfade : MUSIC.crossfade;
        const step = Math.max(0, Math.min(dt, 0.1)) / fade;
        for (const c of this.channels.values()) {
            if (c.state === 'death' && c.audio.currentTime >= MUSIC.deathDuration) this.finishDeath(c);
            const target =
                c.state === this.state && incomingReady && !c.completed
                    ? 1
                    : c.state !== this.state && !incomingReady && !unavailable
                      ? c.gain
                      : 0;
            c.gain = target > c.gain ? Math.min(target, c.gain + step) : Math.max(target, c.gain - step);
            this.applyVolume(c);
            if (c.gain === 0 && c.state !== this.state && !c.audio.paused) {
                c.generation++;
                c.pending = false;
                c.audio.pause();
            }
        }
    }
    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        for (const c of this.channels.values()) {
            c.generation++;
            c.audio.pause();
            c.audio.removeAttribute('src');
            c.audio.load();
            c.audio.remove();
        }
        this.channels.clear();
    }
}
