import { Entity, Plane, Vec3 } from 'playcanvas';
import type { AppBase, MeshInstance, RenderComponent } from 'playcanvas';

import { emission } from './art-kit';
import type { BossPatterns } from './boss-patterns';
import type { RiftArrival } from './rift-arrival';
import { RiftView } from './rift-view';
/** Shared arrival clipping and essential danger rendering, independent of cosmetic quality. */
export class EncounterView {
    private readonly rift: RiftView;
    private readonly planes = [new Plane()];
    private readonly rays: Entity[] = [];
    private readonly warning = emission('Encounter trajectory warning', '#ff9474', 1.4, 0.2);
    private readonly hot = emission('Encounter live cutting beam', '#ff514f', 3, 0.9);
    private readonly middle = new Vec3();
    private readonly end = new Vec3();
    private serial = -1;
    private clipping = false;
    constructor(app: AppBase) {
        this.rift = new RiftView(app);
        for (let i = 0; i < 6; i++) {
            const e = new Entity('Capital telegraph ' + i);
            e.addComponent('render', { type: 'box', material: i === 0 || i === 3 ? this.hot : this.warning });
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
        for (let i = 0; i < this.rays.length; i++) {
            const e = this.rays[i];
            e.enabled =
                b.active && !b.arriving && beam && (i === 0 || i === 3 ? p.beamActive : p.state === 'telegraph');
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
            e.setPosition(this.middle.lerp(from, to, 0.5));
            e.lookAt(to);
            e.setLocalScale(i === 0 || i === 3 ? 4 : 0.45, i === 0 || i === 3 ? 4 : 0.45, length);
        }
    }
    destroy() {
        this.rift.destroy();
        for (const e of this.rays) e.destroy();
        this.warning.destroy();
        this.hot.destroy();
    }
}
