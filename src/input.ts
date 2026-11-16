import type { Settings } from './config';
import { neutral } from './flight';
export class Input {
    readonly command = neutral();
    private readonly keys = new Set<string>();
    private mx = 0;
    private my = 0;
    firing = false;
    private mouseFire = false;
    private targetRequested = false;
    private missileRequested = false;
    private empRequested = false;
    private stormRequested = false;
    private cameraRequested = false;
    private evadeRequested = false;
    private recentSide = 1;
    private readonly events = new AbortController();
    private settings: Settings;
    constructor(canvas: HTMLCanvasElement, settings: Settings, pause: () => void, reset: () => void) {
        this.settings = settings;
        const options = { signal: this.events.signal };
        window.addEventListener(
            'keydown',
            (e) => {
                if (e.defaultPrevented) return;
                if (document.body.classList.contains('menu-open') && e.code !== 'Escape' && e.code !== 'KeyR') return;
                if (
                    e.target instanceof Element &&
                    e.target.closest('#menu, #upgrade-panel') &&
                    e.code !== 'Escape' &&
                    !(e.code === 'KeyR' && document.querySelector('#menu[data-screen="pause"]'))
                )
                    return;
                if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
                if (e.code === 'Escape' && !e.repeat) pause();
                if (e.code === 'KeyR' && !e.repeat) reset();
                if (!e.repeat && e.code === 'KeyM') this.missileRequested = true;
                if (!e.repeat && e.code === 'KeyG') this.empRequested = true;
                if (!e.repeat && e.code === 'KeyV') this.stormRequested = true;
                if (!e.repeat && e.code === 'Space') this.evadeRequested = true;
                if (!e.repeat && e.code === 'KeyC') this.cameraRequested = true;
                this.keys.add(e.code);
            },
            options
        );
        window.addEventListener('keyup', (e) => this.keys.delete(e.code), options);
        window.addEventListener(
            'mousemove',
            (e) => {
                if (document.pointerLockElement === canvas) {
                    this.mx += e.movementX;
                    this.my += e.movementY;
                }
            },
            options
        );
        window.addEventListener('blur', () => this.clear(), options);
        canvas.addEventListener(
            'mousedown',
            (e) => {
                if (e.button === 0) this.mouseFire = true;
                if (e.button === 2) this.targetRequested = true;
            },
            options
        );
        window.addEventListener(
            'mouseup',
            (e) => {
                if (e.button === 0) this.mouseFire = false;
            },
            options
        );
        canvas.addEventListener('contextmenu', (e) => e.preventDefault(), options);
        canvas.addEventListener(
            'click',
            () => {
                if (document.pointerLockElement !== canvas)
                    void canvas.requestPointerLock()?.catch(() => {
                        /* Arrow-key steering remains available if capture is denied. */
                    });
            },
            options
        );
    }
    destroy() {
        this.events.abort();
        this.clear();
    }
    clear() {
        this.keys.clear();
        this.missileRequested = this.empRequested = this.stormRequested = false;
        this.cameraRequested = this.evadeRequested = false;
        this.mx = this.my = 0;
        this.mouseFire = this.firing = this.targetRequested = false;
        Object.assign(this.command, neutral());
    }
    sample(dt: number) {
        const k = (code: string) => Number(this.keys.has(code));
        const c = this.command;
        c.x = k('KeyD') - k('KeyA');
        if (c.x !== 0) this.recentSide = c.x;
        c.y = k('KeyF') - k('ControlLeft') - k('ControlRight');
        this.firing = this.mouseFire || this.keys.has('KeyZ');
        c.y = Math.max(-1, c.y);
        c.z = k('KeyS') - k('KeyW');
        c.pitch = k('ArrowDown') - k('ArrowUp') - (this.my * 0.002 * this.settings.sensitivity) / dt;
        c.yaw = k('ArrowLeft') - k('ArrowRight') - (this.mx * 0.002 * this.settings.sensitivity) / dt;
        c.pitch = Math.max(-3, Math.min(3, c.pitch));
        c.yaw = Math.max(-3, Math.min(3, c.yaw));
        c.roll = k('KeyQ') - k('KeyE');
        c.brake = this.keys.has('KeyX');
        c.boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
        this.mx = this.my = 0;
        return c;
    }
    consumeEvade() {
        const v = this.evadeRequested;
        this.evadeRequested = false;
        return v ? Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')) || this.recentSide : 0;
    }
    consumeStorm() {
        const v = this.stormRequested;
        this.stormRequested = false;
        return v;
    }
    consumeMissile() {
        const value = this.missileRequested;
        this.missileRequested = false;
        return value;
    }
    consumeCamera() {
        const v = this.cameraRequested;
        this.cameraRequested = false;
        return v;
    }
    consumeEMP() {
        const value = this.empRequested;
        this.empRequested = false;
        return value;
    }
    consumeTarget() {
        const requested = this.targetRequested;
        this.targetRequested = false;
        return requested;
    }
}
