import { Entity, Quat, Vec3 } from 'playcanvas';
import type { AppBase, RenderComponent } from 'playcanvas';

import { emission, ModelBuilder, surface, validateRenderAttributes } from './art-kit';
import type { GraphicsQuality } from './config';
import type { Cruise } from './cruise';
import type { Flight } from './flight';
import type { Frontier } from './frontier';
import { FRONTIER } from './frontier-config';

/** Cached attached structures and one compact destination marker; no world-space HUD bars. */
export class FrontierView {
    readonly root = new Entity('Living frontier');
    private readonly towers: Entity[] = [];
    private readonly powers: Entity[] = [];
    private readonly details: Entity[] = [];
    private readonly signals: Entity[] = [];
    private readonly wrecks: Entity[] = [];
    private readonly armor = surface('Outpost layered titanium', '#758da3', 0.65, 0.62);
    private readonly dark = surface('Outpost mechanisms', '#192433', 0.5, 0.4);
    private readonly light = emission('Navigation circular lamps', FRONTIER.sector.signalColor, 2);
    private readonly amber = emission('Defense charge apertures', '#ff994b', 2.5);
    private readonly inverse = new Quat();
    private readonly point = new Vec3();
    private readonly local = new Vec3();
    private readonly panel: HTMLElement;
    private readonly marker: HTMLElement;
    private readonly status: HTMLElement;
    private readonly cruiseStatus: HTMLElement;
    private readonly notice: HTMLElement;
    private time = 0;
    private animated = true;
    private readonly pulse = new Float32Array([0.2, 1.2, 0.9]);
    get weaponRoots() {
        return this.towers;
    }
    readonly world: Frontier;
    constructor(app: AppBase, world: Frontier) {
        this.world = world;
        app.root.addChild(this.root);
        for (const base of world.bases) {
            const root = new Entity('Asteroid-mounted defense ' + base.rockIndex);
            this.root.addChild(root);
            root.setPosition(base.rock.position);
            root.setRotation(base.rotation);
            const r = base.rock.radius,
                deck = r + 1,
                b = new ModelBuilder();
            // Deep support pylons intersect the actual rough surface, not floating above it.
            b.box(this.dark, [0, deck, 0], [34, 3, 19]);
            b.box(this.armor, [0, deck + 2, 0], [30, 1, 17]);
            b.box(this.dark, [0, deck, 19], [11, 2, 23]);
            b.box(this.armor, [0, deck + 1.2, 23], [10, 0.4, 14]);
            for (const side of [-1, 1]) {
                b.box(this.dark, [side * 11, r * 0.88, 0], [5, r * 0.56, 12]);
                b.box(this.armor, [side * 11, deck + 5, 0], [8, 9, 10]);
                b.box(this.light, [side * 4, deck + 2.7, 22], [0.8, 0.2, 12]);
            }
            b.box(this.dark, [0, r * 0.75, 0], [12, r * 0.6, 12]);
            const site = world.bases.indexOf(base);
            if (site === 1) {
                // Mining gantry and ore-processing drums.
                b.box(this.armor, [18, deck + 12, 7], [3, 24, 3]);
                b.box(this.armor, [8, deck + 23, 7], [24, 2, 3]);
                for (let i = 0; i < 3; i++) b.cylinder(this.dark, [-7 + i * 7, deck + 5, 14], [5, 7, 5]);
            } else if (site === 2) {
                // A damaged roof and a broken communications mast.
                b.box(this.armor, [-4, deck + 9, 8], [19, 1, 13], [0, 0, 28]);
                b.box(this.dark, [14, deck + 5, -8], [12, 2, 3], [0, 15, 55]);
            } else if (site === 3) {
                for (let i = 0; i < 4; i++) b.box(this.armor, [-12 + i * 8, deck + 5, 18], [6, 7, 8]);
                b.box(this.amber, [0, deck + 10, 18], [30, 0.3, 0.4]);
            }
            root.addChild(b.finish(app.graphicsDevice, 'Integrated foundation and docking deck'));
            const radar = new ModelBuilder();
            radar.box(this.armor, [0, deck + 8, -7], [1.5, 14, 1.5]);
            radar.box(this.armor, [0, deck + 15, -7], [11, 2, 1.4], [0, 15, 15]);
            radar.box(this.light, [0, deck + 15, -7.8], [8, 0.4, 0.2]);
            const antenna = radar.finish(app.graphicsDevice, 'Radar antenna');
            root.addChild(antenna);
            this.details.push(antenna);
            const core = new ModelBuilder();
            core.box(this.dark, [0, 0, 0], [8, 10, 8]);
            core.box(this.light, [0, 0, -4.2], [5, 6, 0.5]);
            core.box(this.light, [0, 0, 4.2], [5, 6, 0.5]);
            const power = core.finish(app.graphicsDevice, 'Destructible outpost power');
            power.setLocalPosition(base.parts[0].local);
            root.addChild(power);
            this.powers.push(power);
            for (let i = 1; i < 3; i++) {
                const m = new ModelBuilder();
                m.box(this.armor, [0, 0, 0], [8, 5, 8]);
                if (i === 1)
                    for (const side of [-1, 1]) {
                        m.cylinder(this.dark, [side * 2.2, 1, -5], [2, 9, 2]);
                        m.cylinder(this.amber, [side * 2.2, 1, -9.6], [1.2, 0.3, 1.2]);
                    }
                else
                    for (let tube = 0; tube < 4; tube++) {
                        m.box(this.dark, [-3 + tube * 2, 2, -2], [1.5, 3, 8]);
                        m.box(this.amber, [-3 + tube * 2, 2, -6.2], [0.8, 1, 0.2]);
                    }
                const t = m.finish(app.graphicsDevice, 'Tracking outpost weapon');
                // Independent world facing, mounted at simulation-defined local position.
                this.root.addChild(t);
                this.towers.push(t);
            }
        }
        for (const l of world.locations) {
            if (l.kind === 'outpost' || l.kind === 'station') continue;
            const b = new ModelBuilder();
            if (l.kind === 'wreck') {
                for (const side of [-1, 1]) {
                    b.hull(this.armor, [
                        [-17, 1, 0, 1],
                        [-10, 5, 0, 3],
                        [1, 6, 0, 4]
                    ]);
                    b.box(this.dark, [side * 10, 0, 11], [9, 7, 19], [side * 12, side * 15, side * 18]);
                    b.cylinder(this.dark, [side * 10, 0, 21], [7, 4, 7]);
                    b.cylinder(this.light, [side * 10, 0, 23.2], [4, 0.3, 4]);
                    b.box(this.armor, [side * 17, -3, 4], [13, 1, 18], [0, side * 35, side * 20]);
                }
                b.box(this.light, [0, 4.5, -3], [5, 0.3, 5]);
            } else {
                b.box(this.armor, [0, 0, 0], [7, 5, 7]);
                for (const side of [-1, 1]) {
                    b.box(this.dark, [side * 10, 0, 0], [14, 0.8, 9]);
                    for (let panel = 0; panel < 3; panel++)
                        b.box(this.armor, [side * (6 + panel * 4), 0.5, 0], [3.4, 0.3, 8]);
                }
                b.cylinder(this.light, [0, 3, 0], [4, 0.5, 4], [0, 0, 0]);
            }
            const e = b.finish(
                app.graphicsDevice,
                l.kind === 'wreck' ? 'Discoverable cargo wreck' : 'Compact signal relay'
            );
            e.setPosition(l.position);
            e.setEulerAngles(15, l.position.x % 180, -12);
            this.root.addChild(e);
            if (l.kind === 'signal') this.signals.push(e);
            else this.wrecks.push(e);
        }
        validateRenderAttributes(this.root);
        document.body.insertAdjacentHTML(
            'beforeend',
            `<aside id="navigation"><small>FRONTIER NAV / N CYCLE</small><strong id="nav-name"></strong><span id="nav-distance"></span><span id="nav-action"></span><span id="cruise-state"></span></aside><div id="destination-marker" hidden>◇</div><div id="discovery-notice" role="status"></div>`
        );
        this.panel = document.getElementById('navigation')!;
        this.marker = document.getElementById('destination-marker')!;
        this.status = document.getElementById('nav-action')!;
        this.cruiseStatus = document.getElementById('cruise-state')!;
        this.notice = document.getElementById('discovery-notice')!;
    }
    setQuality(level: GraphicsQuality) {
        this.animated = level !== 'low';
        for (const e of this.details) e.enabled = level !== 'low';
    }
    render(ship: Flight, cruise: Cruise, camera: Entity, started: boolean, dt = 0) {
        this.time = (this.time + dt) % 1000;
        this.pulse[1] = this.animated ? 1.2 + Math.sin(this.time * 1.5) * 0.4 : 1.2;
        for (const e of this.signals)
            for (const mi of e.render!.meshInstances)
                if (mi.material === this.light) mi.setParameter('material_emissive', this.pulse);
        let tower = 0;
        for (let i = 0; i < this.world.bases.length; i++) {
            const b = this.world.bases[i];
            this.powers[i].enabled = b.parts[0].active && !b.destroyed;
            for (let j = 1; j < 3; j++) {
                const p = b.parts[j],
                    t = this.towers[tower++];
                t.enabled = p.active && !b.destroyed;
                t.setPosition(p.position);
                t.setRotation(p.facing);
                for (const mi of t.render!.meshInstances)
                    if (mi.material === this.amber)
                        mi.setParameter('material_emissive', p.charge > 0 ? FrontierView.charging : FrontierView.idle);
            }
        }
        this.panel.hidden = !started;
        this.notice.hidden = !started || this.world.noticeTime <= 0;
        this.notice.textContent = this.world.notice;
        const l = this.world.locations[this.world.selected];
        this.marker.hidden = !started || !l;
        if (!started || !l) return;
        const distance = l.position.distance(ship.position);
        document.getElementById('nav-name')!.textContent = l.name;
        document.getElementById('nav-distance')!.textContent =
            Math.round(distance) + ' m' + (l.risk ? ' / HOSTILE RISK' : ' / RECOVERY');
        this.status.textContent = l.used
            ? 'SUPPLY RECOVERED'
            : l.base?.destroyed
              ? 'DEFENSES OFFLINE'
              : distance < FRONTIER.interactRange && l.kind !== 'outpost'
                ? 'V / INVESTIGATE'
                : l.kind === 'outpost'
                  ? 'TARGET POWER TO DISABLE'
                  : 'APPROACH TO INVESTIGATE';
        this.cruiseStatus.textContent =
            cruise.active || cruise.settling
                ? cruise.reason
                : cruise.cooldown > 0
                  ? 'CRUISE COOLDOWN / ' + Math.ceil(cruise.cooldown) + 's'
                  : cruise.reason;
        this.cruiseStatus.dataset.active = String(cruise.active);
        this.inverse.copy(camera.getRotation()).invert();
        this.inverse.transformVector(this.point.sub2(l.position, camera.getPosition()), this.local);
        const w = window.innerWidth,
            h = window.innerHeight,
            f = h / (2 * Math.tan((camera.camera!.fov * Math.PI) / 360));
        let x = w / 2 + (this.local.x / Math.max(1, -this.local.z)) * f,
            y = h / 2 - (this.local.y / Math.max(1, -this.local.z)) * f;
        if (this.local.z >= 0) {
            x = this.local.x >= 0 ? w - 45 : 45;
            y = h / 2;
        }
        x = Math.max(45, Math.min(w - 45, x));
        y = Math.max(120, Math.min(h - 140, y));
        this.marker.style.transform = `translate(${x}px,${y}px)`;
    }
    private static readonly charging = new Float32Array([4, 1.1, 0.1]);
    private static readonly idle = new Float32Array([0.1, 0.05, 0.015]);
    destroy() {
        const meshes = new Set(
            this.root.findComponents('render').flatMap((c) => (c as RenderComponent).meshInstances.map((mi) => mi.mesh))
        );
        this.root.destroy();
        for (const mesh of meshes) mesh?.destroy();
        for (const m of [this.armor, this.dark, this.light, this.amber]) m.destroy();
        this.panel.remove();
        this.marker.remove();
        this.notice.remove();
    }
}
