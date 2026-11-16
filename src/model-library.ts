import { Asset, Entity } from 'playcanvas';
import type { AppBase, ContainerResource, RenderComponent, StandardMaterial, Texture } from 'playcanvas';

import { validateRenderAttributes } from './art-kit';
import type { GraphicsQuality } from './config';
import { modelAvailable } from './distribution';
import { MODEL_TUNING } from './model-config';
import type { ModelKey } from './model-config';

/** Local, demand-loaded, bounded container cache. No network/CDN/decoder dependencies at runtime. */
export class ModelLibrary {
    private readonly app: AppBase;
    private readonly pending = new Map<ModelKey, Promise<boolean>>();
    private readonly assets = new Map<ModelKey, Asset>();
    private readonly normals = new Map<StandardMaterial, Texture | null>();
    private quality: GraphicsQuality = 'medium';
    private closed = false;
    readonly failures = new Set<ModelKey>();
    constructor(app: AppBase) {
        this.app = app;
    }
    load(key: ModelKey) {
        if (!modelAvailable(key)) return Promise.resolve(false);
        const existing = this.pending.get(key);
        if (existing) return existing;
        const promise = new Promise<boolean>((resolve) => {
            const asset = new Asset('Imported ' + key, 'container', {
                url: import.meta.env.BASE_URL + 'models/' + MODEL_TUNING[key].file
            });
            this.assets.set(key, asset);
            this.app.assets.add(asset);
            asset.once('load', () => resolve(!this.closed));
            asset.once('error', () => {
                this.failures.add(key);
                resolve(false);
            });
            this.app.assets.load(asset);
        });
        this.pending.set(key, promise);
        return promise;
    }
    create(key: ModelKey) {
        const asset = this.assets.get(key);
        if (!asset?.resource || this.closed) return undefined;
        const t = MODEL_TUNING[key],
            s = t.size / t.dims[t.dimension];
        const root = new Entity('Imported ' + key),
            yaw = new Entity(key + ' calibration yaw');
        const visual = (asset.resource as ContainerResource).instantiateRenderEntity({
            castShadows: false,
            receiveShadows: false
        });
        // Container roots can carry authored unit conversions (for example FBX centimetres).
        // Never overwrite their transform: calibrate on a fresh parent instead.
        const calibration = new Entity(key + ' scale and pivot');
        calibration.setLocalScale(s, s, s);
        calibration.setLocalPosition(-t.center[0] * s, -t.center[1] * s, -t.center[2] * s);
        calibration.addChild(visual);
        yaw.setLocalEulerAngles(0, t.yaw, 0);
        yaw.addChild(calibration);
        root.addChild(yaw);
        for (const c of root.findComponents('render'))
            for (const mi of (c as RenderComponent).meshInstances) {
                mi.mask = 3;
                const material = mi.material as StandardMaterial;
                if (!this.normals.has(material)) {
                    this.normals.set(material, material.normalMap);
                    // Keep an emissive uniform available for instance-local hit/EMP/attack feedback.
                    if (material.emissive.r + material.emissive.g + material.emissive.b < 0.001)
                        material.emissive.set(0.001, 0.001, 0.001);
                    material.normalMap = this.quality === 'low' ? null : this.normals.get(material)!;
                    material.update();
                }
            }
        validateRenderAttributes(root);
        return root;
    }
    animate(root: Entity, key: ModelKey) {
        const resource = this.assets.get(key)?.resource as ContainerResource | undefined;
        const clip = resource?.animations.find((a) => a.resource?.name.includes('floating'));
        const authored = root.children[0]?.children[0]?.children[0] as Entity | undefined;
        if (!clip?.resource || !authored) return false;
        authored.addComponent('anim', { activate: true });
        authored.anim!.assignAnimation('Floating', clip.resource);
        return true;
    }
    setQuality(level: GraphicsQuality) {
        if (level === this.quality) return;
        this.quality = level;
        for (const [m, normal] of this.normals) {
            m.normalMap = level === 'low' ? null : normal;
            m.update();
        }
    }
    get loaded() {
        let n = 0;
        for (const a of this.assets.values()) if (a.resource) n++;
        return n;
    }
    destroy() {
        this.closed = true;
        for (const a of this.assets.values()) {
            a.unload();
            this.app.assets.remove(a);
        }
        this.assets.clear();
        this.pending.clear();
        this.normals.clear();
    }
}
