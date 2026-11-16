import { Entity, Plane, Vec3 } from 'playcanvas';
import type { AppBase, MeshInstance, RenderComponent } from 'playcanvas';

import { emission } from './art-kit';
import { BeamKit } from './beam-kit';
import type { BossPatterns } from './boss-patterns';
import type { RiftArrival } from './rift-arrival';
import { RiftView } from './rift-view';
/** Shared arrival clipping and essential danger rendering, independent of cosmetic quality. */
export class EncounterView {
    private readonly rift: RiftView;
    private readonly beamKit: BeamKit;
    private readonly planes = [new Plane()];
    private readonly rays: Entity[] = [];
    private readonly charge = new Entity('Boss converging energy');
    private readonly violet = emission('Boss violet charge', '#ad72ff', 3.5, 0.7);
    private readonly warning = emission('Encounter trajectory warning', '#ff9474', 1.4, 0.2);
    private readonly middle = new Vec3();
    private readonly end = new Vec3();
    private serial = -1;
    private clipping = false;
    constructor(app: AppBase) {
        this.rift = new RiftView(app);
        this.beamKit = new BeamKit(app);
        this.charge.addComponent('render', { type: 'sphere', material: this.violet });
        app.root.addChild(this.charge);
        for (let i = 0; i < 6; i++) {
            const live = i === 0 || i === 3;
            const e = live ? this.beamKit.create('Capital live beam ' + i) : new Entity('Capital telegraph ' + i);
            if (!live) e.addComponent('render', { type: 'box', material: this.warning });
            e.enabled = false;
            app.root.addChild(e);
            this.rays.push(e);
        }
    }
    render(root: Entity, b: { active: boolean; arriving: boolean; arrival: RiftArrival; patterns: BossPatterns }) {
        this.rift.render(b.arrival, b.active);
        const clip = b.active && !b.arrival.complete;
        // Root may acquire a demand-loaded model; assign planes without cloning its shared material.
        if (clip || clip !== this.clipping || this.serial !== b.arrival.serial) {
            this.planes[0].setFromPointNormal(b.arrival.anchor, b.arrival.normal);
            for (const c of root.findComponents('render') as RenderComponent[])
                for (const m of c.meshInstances as MeshInstance[]) m.clippingPlanes = clip ? this.planes : [];
            this.clipping = clip;
            this.serial = b.arrival.serial;
        }
        if (b.arriving && !['emerge', 'collapse', 'settle'].includes(b.arrival.stage)) root.enabled = false;
        const p = b.patterns,
            beam = p.kind === 'beam' || (p.kind === 'cross' && p.profile === 'tesser');
        const charging = b.active && !b.arriving && p.permitted && p.state === 'telegraph';
        const flash = b.active && !b.arriving && p.state === 'fire' && p.time < 0.18;
        this.charge.enabled = charging || flash;
        if (this.charge.enabled) {
            this.charge.setPosition(p.chargeOrigin);
            const f = charging ? 1 - p.winding / p.spec.telegraph[p.phase - 1] : 1 - p.time / 0.18;
            const size = flash ? 10 * f : 2 + 6 * f;
            this.charge.setLocalScale(size, size, size);
        }
        for (let i = 0; i < this.rays.length; i++) {
            const e = this.rays[i];
            e.enabled =
                b.active &&
                !b.arriving &&
                (i < 3 || (p.kind === 'cross' && p.profile === 'tesser')) &&
                beam &&
                (i === 0 || i === 3
                    ? p.beamActive || (p.state === 'recover' && p.time < 0.16)
                    : p.state === 'telegraph');
            if (!e.enabled) continue;
            const to =
                i === 4
                    ? p.secondWarningEnd
                    : i === 5
                      ? p.secondWarningFar
                      : i === 1
                        ? p.warningEnd
                        : i === 2
                          ? p.warningFar
                          : i === 3
                            ? p.secondEnd
                            : p.beamEnd;
            const from = i >= 3 ? p.secondOrigin : p.beamOrigin;
            const length = this.end.sub2(to, from).length();
            if (length < 0.01) {
                e.enabled = false;
                continue;
            }
            if (i === 0 || i === 3)
                this.beamKit.update(
                    e,
                    from,
                    to,
                    p.time,
                    p.beamActive ? 1 : Math.max(0, 1 - p.time / 0.16),
                    p.profile === 'tesser' ? 1 : 0.5
                );
            e.setPosition(this.middle.lerp(from, to, 0.5));
            e.lookAt(to);
            e.setLocalScale(i === 0 || i === 3 ? 4 : 0.45, i === 0 || i === 3 ? 4 : 0.45, length);
        }
    }
    destroy() {
        this.charge.destroy();
        this.violet.destroy();
        this.rift.destroy();
        for (const e of this.rays) e.destroy();
        this.warning.destroy();
        this.beamKit.destroy();
    }
}
