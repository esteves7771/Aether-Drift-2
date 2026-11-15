import { Entity } from 'playcanvas';
import type { GraphicsDevice, MeshInstance, RenderComponent } from 'playcanvas';

import { ModelBuilder, emission, surface } from './art-kit';
import type { Enemy } from './enemy';
import { MODEL_MOUNTS, MODEL_TUNING } from './model-config';
import type { ModelLibrary } from './model-library';

type ShipKey = 'raider' | 'heavy' | 'saucer';
interface Visual {
    root: Entity;
    body: Entity;
    instances: MeshInstance[];
    jets: Entity[];
}
/** Cosmetic variants only: slot IDs, AI, collision radii, weapons, health and scoring stay authoritative. */
export class ImportedFleet {
    private readonly library: ModelLibrary;
    private readonly roots: readonly Entity[];
    private readonly device: GraphicsDevice;
    private readonly loading = new Set<ShipKey>();
    private readonly variants = new Map<ShipKey, Visual[]>();
    private readonly mounts = surface('Imported cannon housings', '#374454', 0.7, 0.65);
    private readonly drive = emission('Imported hostile drives', '#ff708b', 2.5);
    private readonly templates = new Map<ShipKey, Entity>();
    private closed = false;
    constructor(library: ModelLibrary, roots: readonly Entity[], device: GraphicsDevice) {
        this.library = library;
        this.roots = roots;
        this.device = device;
    }
    private request(key: ShipKey) {
        if (this.loading.has(key)) return;
        this.loading.add(key);
        void this.library.load(key).then(async (ok) => {
            if (!ok || this.closed) return;
            const list: Visual[] = [];
            for (let i = 0; i < this.roots.length; i++) {
                if (this.closed) return;
                const root = this.library.create(key)!;
                const body = root.children[0] as Entity;
                const instances = root.findComponents('render').flatMap((c) => (c as RenderComponent).meshInstances);
                const mounts = MODEL_MOUNTS[key];
                let template = this.templates.get(key);
                if (!template) {
                    const b = new ModelBuilder();
                    const z = mounts.muzzle[2];
                    for (const x of key === 'heavy' ? [-2, 0, 2] : [0])
                        b.cylinder(this.mounts, [x, 0, z + 1], [0.35, 2, 0.35]);
                    template = b.finish(this.device, key + ' aligned cannon adapter');
                    this.templates.set(key, template);
                }
                root.addChild(template.clone());
                const jets: Entity[] = [];
                for (const p of mounts.engines) {
                    const jet = new Entity('Imported engine wake');
                    jet.addComponent('render', { type: 'cone', material: this.drive });
                    jet.setLocalPosition(p[0], p[1], p[2]);
                    jet.setLocalEulerAngles(-90, 0, 0);
                    root.addChild(jet);
                    jets.push(jet);
                }
                root.enabled = false;
                this.roots[i].addChild(root);
                list.push({ root, body, instances, jets });
                // Bound the work of instantiation to two slot visuals per rendered frame.
                if (i % 2 === 1) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            }
            if (!this.closed) this.variants.set(key, list);
        });
    }
    render(e: Enemy, index: number) {
        const key: ShipKey | undefined =
            e.visual === 'saucer'
                ? 'saucer'
                : e.kind === 'heavy'
                  ? 'heavy'
                  : e.kind === 'interceptor' && e.id % 3 !== 2
                    ? 'raider'
                    : undefined;
        for (const [k, list] of this.variants) list[index].root.enabled = e.active && k === key;
        if (!e.active || !key) return false;
        const model = this.variants.get(key)?.[index];
        if (!model) {
            this.request(key);
            return false;
        }
        model.root.enabled = true;
        const color =
            e.flash > 0
                ? ImportedFleet.hit
                : e.disrupted > 0
                  ? ImportedFleet.emp
                  : e.attackCue
                    ? ImportedFleet.charge
                    : undefined;
        for (const mi of model.instances) {
            if (color) mi.setParameter('material_emissive', color);
            else mi.deleteParameter('material_emissive');
        }
        model.body.setLocalEulerAngles(0, MODEL_TUNING[key].yaw + (key === 'saucer' ? e.age * 14 : 0), 0);
        for (const jet of model.jets)
            jet.setLocalScale(0.28, (e.arrival > 0 ? 4 : 0.8) + Math.min(2, e.velocity.length() * 0.025), 0.28);
        return true;
    }
    private static readonly hit = new Float32Array([3, 5, 6]);
    private static readonly emp = new Float32Array([0.05, 0.8, 2]);
    private static readonly charge = new Float32Array([3, 0.65, 0.03]);
    destroy() {
        this.closed = true;
        for (const list of this.variants.values()) for (const v of list) v.root.destroy();
        for (const t of this.templates.values()) {
            for (const c of t.findComponents('render'))
                for (const mi of (c as RenderComponent).meshInstances) mi.mesh?.destroy();
            t.destroy();
        }
        this.mounts.destroy();
        this.drive.destroy();
    }
}
