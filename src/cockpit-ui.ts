import { Quat, Vec3 } from 'playcanvas';

import type { Combat } from './combat';
import { COCKPIT_FRAMING } from './view-framing';
/** Fixed raster cockpit with a small live instrument layer. Asset is requested only on first use. */
export class CockpitHUD {
    readonly root: HTMLElement;
    readonly button: HTMLButtonElement;
    private readonly fields = new Map<string, HTMLElement>();
    private readonly dots: SVGCircleElement[] = [];
    private readonly inverse = new Quat();
    private readonly local = new Vec3();
    private loaded = false;
    constructor(toggle: () => void) {
        document.body.style.setProperty('--cockpit-aim-y', `${(0.5 - COCKPIT_FRAMING.aimLift) * 100}%`);
        document.body.insertAdjacentHTML(
            'beforeend',
            `<button id="camera-toggle" title="C — Chase / Cockpit Camera" aria-pressed="false">◉ <span>CAMERA: CHASE</span> <kbd>C</kbd></button><div id="cockpit" hidden aria-label="Pilot cockpit"><div class="cockpit-canopy"></div><div class="cockpit-side"></div><div class="cockpit-deck"><img alt="" id="cockpit-art"><div id="cockpit-warmth"></div><div class="cockpit-left instrument"><small>SHIP / SYSTEMS</small><label>HULL <b id="cp-hull"></b></label><label>SHIELD <b id="cp-shield"></b></label><p id="cp-alert"></p></div><div class="cockpit-speed instrument"><b id="cp-speed"></b><span id="cp-boost"></span></div><div class="cockpit-warning instrument" id="cp-warning"></div><svg id="cockpit-radar" viewBox="0 0 240 110" aria-label="Nearby contacts"><ellipse cx="120" cy="55" rx="100" ry="40"/><ellipse cx="120" cy="55" rx="55" ry="22"/><path d="M20 55h200M120 15v80M50 27l140 56M50 83l140-56"/><path class="pilot-symbol" d="m120 46-5 15 5-3 5 3z"/></svg><div class="cockpit-right instrument"><small id="cp-target"></small><p id="cp-distance"></p><p id="cp-lock"></p><label>MISSILES <b id="cp-ammo"></b></label><label>EMP <b id="cp-emp"></b></label><label>V / STORM <b id="cp-storm"></b></label></div></div></div>`
        );
        this.root = document.getElementById('cockpit')!;
        this.button = document.getElementById('camera-toggle') as HTMLButtonElement;
        this.button.onclick = toggle;
        for (const id of [
            'hull',
            'shield',
            'alert',
            'speed',
            'boost',
            'warning',
            'target',
            'distance',
            'lock',
            'ammo',
            'emp',
            'storm'
        ])
            this.fields.set(id, document.getElementById('cp-' + id)!);
        const radar = document.getElementById('cockpit-radar')!;
        for (let i = 0; i < 8; i++) {
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('r', '2.5');
            radar.append(dot);
            this.dots.push(dot);
        }
    }
    present(cockpit: boolean, flight: boolean, visible: boolean) {
        this.button.hidden = !flight;
        this.button.setAttribute('aria-pressed', String(cockpit));
        this.button.querySelector('span')!.textContent = 'CAMERA: ' + (cockpit ? 'COCKPIT' : 'CHASE');
        if (cockpit && flight && !this.loaded) {
            const url = new URL(import.meta.env.BASE_URL + 'images/cockpit-overlay.png', document.baseURI).href;
            (document.getElementById('cockpit-art') as HTMLImageElement).src = url;
            this.root.style.setProperty('--cockpit-art', `url("${url}")`);
            this.loaded = true;
        }
        this.root.hidden = !(cockpit && flight && visible);
        document.body.classList.toggle('cockpit-view', cockpit && flight);
        this.button.disabled = !visible;
    }
    update(combat: Combat, warmth: number) {
        if (this.root.hidden) return;
        const ship = combat.ship,
            set = (key: string, value: string) => (this.fields.get(key)!.textContent = value);
        set('hull', Math.ceil(ship.hull) + '%');
        set('storm', combat.storm.ready ? 'READY' : Math.floor((combat.storm.charge / 45) * 100) + '%');
        set('shield', Math.ceil((ship.shield / ship.shieldCapacity) * 100) + '%');
        set('alert', ship.hull < 30 ? 'HULL CRITICAL' : ship.shield < 15 ? 'SHIELD LOW' : 'SYSTEMS NOMINAL');
        set('speed', Math.round(ship.velocity.length()) + ' m/s');
        set('boost', ship.boosting ? 'BOOST ACTIVE' : Math.round(ship.energy) + '% BOOST');
        const target = combat.getTarget(combat.selected),
            locked = target?.active && target.targetable;
        set(
            'warning',
            combat.damageFlash > 0
                ? 'INCOMING DAMAGE'
                : combat.targeting.messageTime > 0
                  ? combat.targeting.message
                  : locked
                    ? 'TARGET ACQUIRED'
                    : 'FLIGHT LINK / SIX AXES'
        );
        set('target', locked ? target.label.toUpperCase() : 'NO TARGET');
        set('distance', locked ? Math.round(target.position.distance(ship.position)) + ' m' : 'RMB / SELECT TARGET');
        set(
            'lock',
            locked
                ? combat.ammo <= 0
                    ? 'MISSILES EMPTY'
                    : combat.missileCooldown > 0
                      ? 'MISSILE RELOADING'
                      : 'MISSILE LOCK / READY'
                : 'WEAPONS ONLINE'
        );
        set('ammo', String(combat.ammo));
        set('emp', combat.empCooldown > 0 ? Math.ceil(combat.empCooldown) + 's' : 'READY');
        this.root.style.setProperty('--warmth', String(Math.min(0.5, warmth * 0.5)));
        this.root.dataset.warning = String(ship.hull < 30 || combat.damageFlash > 0);
        this.inverse.copy(ship.rotation).invert();
        let count = 0;
        for (const t of combat.targets) {
            if (count >= 8) break;
            if (!t.active || !t.targetable || t.position.distance(ship.position) > 600) continue;
            this.inverse.transformVector(this.local.sub2(t.position, ship.position), this.local);
            const dot = this.dots[count++];
            dot.setAttribute('cx', String(120 + Math.max(-95, Math.min(95, (this.local.x / 600) * 95))));
            dot.setAttribute('cy', String(55 + Math.max(-36, Math.min(36, (this.local.z / 600) * 36))));
            dot.style.display = '';
        }
        for (let i = count; i < 8; i++) this.dots[i].style.display = 'none';
    }
    destroy() {
        this.root.remove();
        this.button.remove();
        document.body.classList.remove('cockpit-view');
    }
}
