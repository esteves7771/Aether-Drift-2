import type { Settings } from './config';
import { PERSEID } from './environment';
import type { Flight } from './flight';
export class UI {
    private readonly panel: HTMLElement;
    private readonly heading: HTMLElement;
    private readonly speed: HTMLElement;
    private readonly hull: HTMLElement;
    private readonly boost: HTMLElement;
    private readonly status: HTMLElement;
    private readonly perf: HTMLElement;
    constructor(settings: Settings, launch: () => void, restart: () => void, pause: () => void) {
        document.body.insertAdjacentHTML(
            'beforeend',
            `
        <div class="vignette"></div><div id="impact"></div>
        <header><div class="brand">AETHER<span>DRIFT / 2.0</span></div><div class="sector"><i></i> ${PERSEID.name} <small>COMBAT PATROL · SECTOR 07</small></div><button id="pause" aria-label="Pause">Ⅱ <span>ESC</span></button></header>
        <div class="reticle"><span></span><b>+</b><span></span></div><div class="horizon">— &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; —</div>
        <aside class="telemetry"><small>FLIGHT TELEMETRY</small><div><strong id="speed">000</strong><span>m/s<br>VELOCITY</span></div><p id="status">FLIGHT ASSIST ONLINE</p></aside>
        <aside class="integrity"><label>HULL INTEGRITY <b id="hull-number">100%</b></label><meter id="hull" min="0" max="100" value="100"></meter><label>BOOST RESERVE <b>SHIFT</b></label><meter id="boost" min="0" max="100" value="100"></meter></aside>
        <footer><span>M <em>MISSILE</em> &nbsp; G <em>EMP</em> &nbsp; LMB / Z <em>FIRE</em> &nbsp; SPACE <em>EVADE</em> &nbsp; RMB <em>TARGET</em> &nbsp; WASD <em>THRUST</em> &nbsp; MOUSE <em>STEER</em> &nbsp; Q / E <em>ROLL</em> &nbsp; C <em>CAMERA</em> &nbsp; X <em>BRAKE</em></span><small id="perf">INITIALIZING</small></footer>
        <main id="menu"><div class="menu-card"><p class="eyebrow">COMBAT PROGRAM / PHASE 04</p><h1 id="menu-heading">Into the<br><span>violet frontier.</span></h1><p class="intro">A lone ship. An open expanse.<br>Six degrees of freedom. Hostile contacts inbound.</p><button id="launch" class="primary">ENTER THE DRIFT <span>↗</span></button><button id="restart" class="secondary">Reset ship & restart</button>
        <details><summary>Flight settings & controls</summary><label>Graphics preset <select id="graphics"><option value="low">Low · performance</option><option value="medium">Medium · balanced</option><option value="high">High · cinematic bloom</option></select></label><label>Mouse sensitivity <input id="sensitivity" type="range" min="0.2" max="2" step="0.1" value="${settings.sensitivity}"></label><label>Camera distance <input id="distance" type="range" min="12" max="34" value="${settings.distance}"></label><label>Master volume <input id="masterVolume" type="range" min="0" max="1" step="0.05" value="${settings.masterVolume}"></label><label>Music volume <input id="musicVolume" type="range" min="0" max="1" step="0.05" value="${settings.musicVolume}"></label><label>SFX volume <input id="sfxVolume" type="range" min="0" max="1" step="0.05" value="${settings.sfxVolume}"></label><p id="music-status" class="controls" role="status">Music starts after interaction.</p><label>Flight assistance <input id="assist" type="checkbox" ${settings.assist ? 'checked' : ''}></label><p class="controls">W / S forward & reverse · A / D strafe<br>F / Ctrl rise & descend · Q / E roll<br>Mouse or arrow keys steer · Shift boost<br>Left click / Z fire · Space evasive roll (A / D direction, 5s cooldown) · Right click select target<br>M guided missile · G EMP (180 m)<br>C chase / cockpit camera<br>X brake · R restart confirmation · Esc pause<br>Click the flight view to capture the mouse.<br>With assist off, momentum is preserved.</p></details><p class="build">EXPERIMENTAL FLIGHTCRAFT / AD–02</p></div><div class="menu-caption">BEYOND THE FAMILIAR.<br><span>PERSEID DEFENSE / WEAPONS FREE</span></div></main>`
        );
        const el = (id: string) => document.getElementById(id)!;
        const graphicsSelect = el('graphics') as HTMLSelectElement;
        graphicsSelect.value = settings.graphics;
        graphicsSelect.addEventListener('change', () => {
            const value = graphicsSelect.value;
            if (value === 'low' || value === 'medium' || value === 'high') settings.graphics = value;
            try {
                localStorage.setItem('aether-drift-2-settings', JSON.stringify(settings));
            } catch {
                /* Storage is optional. */
            }
        });
        this.panel = el('menu');
        this.heading = el('menu-heading');
        this.speed = el('speed');
        this.hull = el('hull');
        this.boost = el('boost');
        this.status = el('status');
        this.perf = el('perf');
        el('launch').onclick = launch;
        el('restart').onclick = restart;
        el('pause').onclick = pause;
        for (const key of ['sensitivity', 'distance', 'masterVolume', 'musicVolume', 'sfxVolume', 'assist'] as const)
            el(key).addEventListener('input', () => {
                const input = el(key) as HTMLInputElement;
                if (key === 'assist') settings.assist = input.checked;
                else settings[key] = Number(input.value);
                try {
                    localStorage.setItem('aether-drift-2-settings', JSON.stringify(settings));
                } catch {
                    /* Storage is optional. */
                }
            });
    }
    menu(show: boolean, title = 'Flight paused.') {
        this.panel.hidden = !show;
        this.heading.textContent = title;
    }
    update(ship: Flight, fps: number, draws: number, device: string) {
        this.speed.textContent = Math.round(ship.velocity.length()).toString().padStart(3, '0');
        this.hull.setAttribute('value', String(ship.hull));
        this.boost.setAttribute('value', String(ship.energy));
        document.getElementById('hull-number')!.textContent = `${Math.ceil(ship.hull)}%`;
        this.status.textContent = ship.boosting
            ? 'BOOST ENGAGED'
            : ship.impact > 0.1
              ? 'COLLISION / HULL DAMAGE'
              : 'WEAPONS READY / PERSEID PATROL';
        document.getElementById('impact')!.style.opacity = String(ship.impact * 0.6);
        this.perf.textContent = `${device.toUpperCase()} · ${Math.round(fps)} FPS · ${draws} DRAWS`;
    }
}
