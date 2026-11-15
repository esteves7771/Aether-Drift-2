import { Vec3 } from 'playcanvas';
import type { Entity, MeshInstance, RenderComponent , Quat } from 'playcanvas';
/** Presentation only; camera shares the interpolated simulation attitude, including roll. */
export class PilotCamera {
    cockpit = false;
    private readonly offset = new Vec3();
    private readonly cached = new Map<MeshInstance, boolean>();
    private shipKey = '';
    private hidden = false;
    toggle() {
        this.cockpit = !this.cockpit;
    }
    reset() {
        this.cockpit = false;
    }
    update(camera: Entity, ship: Entity, position: Vec3, rotation: Quat, selected: string, inFlight: boolean) {
        const show = this.cockpit && inFlight;
        if (this.shipKey !== selected || show !== this.hidden) {
            for (const [mi, visible] of this.cached) mi.visible = visible;
            this.cached.clear();
            for (const c of ship.findComponents('render'))
                for (const mi of (c as RenderComponent).meshInstances) {
                    this.cached.set(mi, mi.visible);
                    if (show) mi.visible = false;
                }
            this.shipKey = selected;
            this.hidden = show;
        }
        if (!show) {
            camera.camera!.nearClip = 0.2;
            return;
        }
        rotation
            .transformVector(
                this.offset.set(0, selected === 'surveyor' ? 0.4 : 0.55, selected === 'surveyor' ? -0.9 : -1.2),
                this.offset
            )
            .add(position);
        camera.setPosition(this.offset);
        camera.setRotation(rotation);
        camera.camera!.nearClip = 0.1;
    }
    destroy() {
        for (const [mi, visible] of this.cached) mi.visible = visible;
        this.cached.clear();
    }
}
