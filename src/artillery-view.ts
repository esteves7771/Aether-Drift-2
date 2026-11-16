import { Entity, Mesh, MeshInstance, Plane, Quat, SphereGeometry, TorusGeometry, Vec3 } from 'playcanvas';
import type { AppBase, RenderComponent } from 'playcanvas';

import { emission, surface } from './art-kit';
import type { Artillery } from './artillery';
import { ARTILLERY } from './artillery-config';
import { BeamKit } from './beam-kit';
import { BossView } from './boss-view';
import type { ModelLibrary } from './model-library';
import { RiftView } from './rift-view';

/** Imported hull and small readable attachment effects; simulation owns all target anchors. */
export class ArtilleryView {
    readonly root = new Entity('Artillery Dreadnought');
    library?: ModelLibrary;
    private imported?: Entity;
    private requested = false;
    private closed = false;
    private readonly fallback: BossView;
    private readonly rift: RiftView;
    private readonly clipPlane = [new Plane()];
    private clipped = false;
    private clipSerial = -1;
    private instances: MeshInstance[] = [];
    private readonly ports: Entity[] = [];
    private readonly cores: Entity[] = [];
    private readonly engines: Entity[] = [];
    private readonly beams: Entity[] = [];
    private readonly beamKit: BeamKit;
    private readonly warning = emission('Artillery sweep anticipation', '#ffb15f', 1.2, 0.16);
    private readonly hitColor = new Float32Array(3);
    private hullInstances: MeshInstance[] = [];
    private readonly metal = surface('Artillery battery sockets', '#657080', 0.7, 0.5);
    private readonly live = emission('Artillery exposed circuits', '#68ffe4', 2);
    private readonly locked = emission('Armored battery circuits', '#28313d', 0.25);
    private readonly hot = emission('Artillery weapon charge', '#ffa158', 3);
    private readonly engine = emission('Capital fusion drive', '#719eff', 2, 0.6);
    private readonly position = new Vec3();
    private readonly rotation = new Quat();
    private readonly tumble = new Quat();
    private readonly sphere: Mesh;
    private readonly ring: Mesh;
    constructor(app: AppBase, boss: Artillery) {
        this.fallback = new BossView(app, boss);
        this.beamKit = new BeamKit(app);
        this.rift = new RiftView(app);
        app.root.addChild(this.root);
        this.sphere = Mesh.fromGeometry(
            app.graphicsDevice,
            new SphereGeometry({ latitudeBands: 10, longitudeBands: 14 })
        );
        this.ring = Mesh.fromGeometry(
            app.graphicsDevice,
            new TorusGeometry({ ringRadius: 1, tubeRadius: 0.12, segments: 24, sides: 6 })
        );
        for (const p of boss.parts) {
            const port = new Entity(p.label + ' socket');
            port.setLocalPosition(p.local);
            port.addComponent('render', { meshInstances: [new MeshInstance(this.ring, this.metal, port)] });
            port.setLocalScale(p.radius, p.radius, p.radius);
            port.setLocalEulerAngles(90, 0, 0);
            const core = new Entity('Vulnerability aperture ' + p.id);
            core.addComponent('render', { meshInstances: [new MeshInstance(this.sphere, this.live, core)] });
            core.setLocalScale(0.82, 0.14, 0.82);
            port.addChild(core);
            this.root.addChild(port);
            this.ports.push(port);
            this.cores.push(core);
        }
        for (const p of ARTILLERY.engines) {
            const e = new Entity('Artillery engine plume');
            e.addComponent('render', { meshInstances: [new MeshInstance(this.sphere, this.engine, e)] });
            e.setLocalPosition(p[0], p[1], p[2]);
            e.setLocalScale(4, 4, 10);
            this.root.addChild(e);
            this.engines.push(e);
        }
        for (let i = 0; i < 3; i++) {
            const e = i === 0 ? this.beamKit.create('Artillery live beam') : new Entity('Artillery sweep boundary');
            if (i !== 0) e.addComponent('render', { type: 'box', material: this.warning });
            e.enabled = false;
            this.root.addChild(e);
            this.beams.push(e);
        }
        this.root.enabled = false;
    }
    render(boss: Artillery, alpha: number, wave: number) {
        if (!this.requested && this.library && (wave >= 4 || boss.active)) {
            this.requested = true;
            void this.library.load('artillery').then((ok) => {
                if (!ok || this.closed) return;
                this.imported = this.library!.create('artillery');
                if (this.imported) {
                    this.root.addChild(this.imported);
                    this.instances = (this.root.findComponents('render') as RenderComponent[]).flatMap(
                        (c) => c.meshInstances
                    );
                    this.hullInstances = (this.imported.findComponents('render') as RenderComponent[]).flatMap(
                        (c) => c.meshInstances
                    );
                }
            });
        }
        this.rift.render(boss.arrival, boss.active);
        if (this.imported || boss.arriving) this.fallback.hide();
        else this.fallback.render(boss, alpha);
        const clip = !boss.arrival.complete;
        if (this.imported && (clip !== this.clipped || this.clipSerial !== boss.arrival.serial)) {
            this.clipPlane[0].setFromPointNormal(boss.arrival.anchor, boss.arrival.normal);
            for (const mi of this.instances) mi.clippingPlanes = clip ? this.clipPlane : [];
            this.clipped = clip;
            this.clipSerial = boss.arrival.serial;
        }
        this.root.enabled =
            !!this.imported &&
            (boss.active || boss.dying > 0) &&
            (!boss.arriving ||
                boss.arrival.stage === 'emerge' ||
                boss.arrival.stage === 'collapse' ||
                boss.arrival.stage === 'settle');
        if (!this.root.enabled) return;
        this.position.lerp(boss.previous, boss.position, alpha);
        this.rotation.slerp(boss.previousRotation, boss.rotation, alpha);
        if (!boss.active) {
            this.tumble.setFromEulerAngles(boss.deathAge * 2, 0, boss.deathAge * 3);
            this.rotation.mul(this.tumble);
        }
        this.root.setPosition(this.position);
        this.root.setRotation(this.rotation);
        const scale = boss.dying > 0 && boss.deathAge > 6 ? Math.max(0.01, boss.dying / 1.6) : 1;
        this.root.setLocalScale(scale, scale, scale);
        this.ports.forEach((e, i) => {
            const p = boss.parts[i];
            e.enabled = p.active;
            this.cores[i].render!.meshInstances[0].material = p.targetable
                ? this.live
                : boss.patterns.permitted &&
                    (boss.charge > 0 ||
                        (boss.patterns.state === 'fire' && boss.patterns.time % boss.patterns.spec.interval < 0.12)) &&
                    (boss.phase === 1 ? i < 4 : i === 6)
                  ? this.hot
                  : this.locked;
        });
        const pattern = boss.patterns;
        const heat =
            boss.patterns.permitted && boss.patterns.state === 'telegraph'
                ? 0.1 * (1 - boss.patterns.winding / boss.patterns.spec.telegraph[boss.phase - 1])
                : boss.patterns.state === 'fire' && boss.patterns.time < 0.16
                  ? 0.16
                  : 0;
        this.hitColor[0] = boss.hitFlash * 0.18 + heat;
        this.hitColor[1] = boss.hitFlash * 0.045 + heat * 0.3;
        this.hitColor[2] = boss.hitFlash * 0.012;
        for (const mi of this.hullInstances) {
            if (boss.hitFlash > 0 || heat > 0) mi.setParameter('material_emissive', this.hitColor);
            else mi.deleteParameter('material_emissive');
        }
        for (let i = 0; i < 3; i++) {
            const e = this.beams[i],
                active = boss.active && !boss.arriving && boss.grace <= 0 && boss.disrupted <= 0;
            e.enabled =
                active &&
                pattern.kind === 'beam' &&
                (i === 0
                    ? pattern.beamActive || (pattern.state === 'recover' && pattern.time < 0.16)
                    : pattern.state === 'telegraph');
            if (!e.enabled) continue;
            const end = i === 1 ? pattern.warningEnd : i === 2 ? pattern.warningFar : pattern.beamEnd,
                length = pattern.beamOrigin.distance(end);
            if (length < 0.1) {
                e.enabled = false;
                continue;
            }
            if (i === 0)
                this.beamKit.update(
                    e,
                    pattern.beamOrigin,
                    end,
                    boss.age,
                    pattern.beamActive ? 1 : Math.max(0, 1 - pattern.time / 0.16),
                    0
                );
            this.position.lerp(pattern.beamOrigin, end, 0.5);
            e.setPosition(this.position);
            e.lookAt(end);
            const radius = i === 0 ? 2.8 : 0.24;
            e.setLocalScale(radius * 2, radius * 2, length);
        }
        for (const e of this.engines) e.setLocalScale(4, 4, boss.arriving ? 14 : 10 + Math.sin(boss.age * 5));
    }
    destroy() {
        this.closed = true;
        this.rift.destroy();
        this.fallback.destroy();
        this.root.destroy();
        this.beamKit.destroy();
        this.sphere.destroy();
        this.ring.destroy();
        for (const m of [this.metal, this.live, this.locked, this.hot, this.engine, this.warning]) m.destroy();
    }
}
