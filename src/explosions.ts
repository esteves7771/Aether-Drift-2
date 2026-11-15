import {
    BLEND_ADDITIVEALPHA,
    Asset,
    ADDRESS_CLAMP_TO_EDGE,
    BoundingBox,
    Color,
    CULLFACE_NONE,
    Entity,
    FILTER_LINEAR,
    Mesh,
    MeshInstance,
    SEMANTIC_NORMAL,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    Texture,
    Vec3
} from 'playcanvas';
import type { AppBase, LightComponent } from 'playcanvas';

import type { GraphicsQuality } from './config';
import { BLASTS } from './explosion-config';
import type { BlastClass } from './explosion-config';
import { blastFragmentGLSL, blastFragmentWGSL, blastVertexGLSL, blastVertexWGSL } from './explosion-shader';

/** Twelve preallocated GPU-animated bursts, one shared mesh/material, no per-particle entities. */
export class CinematicExplosions {
    readonly root = new Entity('Cinematic explosions');
    private readonly mesh: Mesh;
    private readonly material: ShaderMaterial;
    private readonly atlas: Asset;
    private readonly placeholder: Texture;
    private readonly app: AppBase;
    private closed = false;
    private readonly slots: {
        root: Entity;
        mi: MeshInstance;
        data: Float32Array;
        budget: Float32Array;
        duration: number;
        size: number;
        style: number;
        age: number;
    }[] = [];
    private quality: GraphicsQuality = 'medium';
    private serial = 0;
    private warmFrames = 3;
    private readonly right = new Float32Array([1, 0, 0]);
    private readonly up = new Float32Array([0, 1, 0]);
    private readonly key?: LightComponent;
    private readonly keyColor: Color;
    private readonly keyIntensity: number;
    private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    warmth = 0;
    constructor(app: AppBase) {
        this.app = app;
        app.root.addChild(this.root);
        this.key = (app.root.findByName('Starlight') as Entity | null)?.light ?? undefined;
        this.keyColor = this.key?.color.clone() ?? new Color(1, 1, 1);
        this.keyIntensity = this.key?.intensity ?? 0;
        this.material = new ShaderMaterial({
            uniqueName: 'Layered blast',
            attributes: { aPosition: SEMANTIC_POSITION, aNormal: SEMANTIC_NORMAL, aUv0: SEMANTIC_TEXCOORD0 },
            vertexGLSL: blastVertexGLSL,
            fragmentGLSL: blastFragmentGLSL,
            vertexWGSL: blastVertexWGSL,
            fragmentWGSL: blastFragmentWGSL
        });
        this.material.blendType = BLEND_ADDITIVEALPHA;
        this.material.depthWrite = false;
        this.material.cull = CULLFACE_NONE;
        this.material.update();
        this.placeholder = new Texture(app.graphicsDevice, {
            name: 'Blast fallback',
            width: 1,
            height: 1,
            mipmaps: false
        });
        const blank = document.createElement('canvas');
        blank.width = blank.height = 1;
        this.placeholder.setSource(blank);
        this.material.setParameter('uAtlas', this.placeholder);
        this.material.setParameter('uAtlasReady', 0);
        this.atlas = new Asset('Cinematic fire flipbook', 'texture', {
            url: import.meta.env.BASE_URL + 'images/explosion-atlas.png'
        });
        this.atlas.once('load', () => {
            if (this.closed) return;
            const texture = this.atlas.resource as Texture;
            texture.addressU = texture.addressV = ADDRESS_CLAMP_TO_EDGE;
            texture.minFilter = texture.magFilter = FILTER_LINEAR;
            this.material.setParameter('uAtlas', texture);
            this.material.setParameter('uAtlasReady', 1);
        });
        this.atlas.once('error', () => {
            /* Procedural fire remains available if the optional atlas fails. */
        });
        app.assets.add(this.atlas);
        app.assets.load(this.atlas);
        const pos: number[] = [],
            normals: number[] = [],
            uv: number[] = [],
            indices: number[] = [];
        for (let kind = 0; kind < 4; kind++)
            for (let i = 0; i < [8, 48, 12, 1][kind]; i++) {
                const n = i + kind * 67,
                    a = n * 2.399963,
                    y = 1 - 2 * ((n * 0.618033) % 1),
                    r = Math.sqrt(1 - y * y),
                    base = pos.length / 3;
                for (const [u, v] of [
                    [0, 0],
                    [1, 0],
                    [0, 1],
                    [1, 1]
                ]) {
                    pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
                    normals.push(kind, i, (n * 0.731) % 1);
                    uv.push(u, v);
                }
                indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
            }
        this.mesh = new Mesh(app.graphicsDevice);
        this.mesh.setPositions(pos);
        this.mesh.setNormals(normals);
        this.mesh.setUvs(0, uv);
        this.mesh.setIndices(indices);
        this.mesh.update();
        for (let i = 0; i < BLASTS.capacity; i++) {
            const root = new Entity('Blast ' + i),
                mi = new MeshInstance(this.mesh, this.material, root),
                data = new Float32Array(4),
                budget = new Float32Array(4);
            // Analytic particles can drift far beyond their source vertices. Explicit broad bounds.
            mi.setCustomAabb(new BoundingBox(Vec3.ZERO, new Vec3(600, 600, 600)));
            mi.setParameter('uBlast', data);
            mi.setParameter('uBudget', budget);
            mi.setParameter('uRight', this.right);
            mi.setParameter('uUp', this.up);
            mi.setParameter('uStyle', 0);
            root.addComponent('render', { meshInstances: [mi], castShadows: false, receiveShadows: false });
            root.enabled = false;
            this.root.addChild(root);
            this.slots.push({ root, mi, data, budget, duration: 0, size: 1, style: 0, age: 0 });
        }
        const warm = this.slots[0];
        warm.root.setPosition(0, 0, -6000);
        warm.root.enabled = true;
        warm.data.set([0.1, 1, 0.3, 1.5]);
        warm.budget.set([1, 1, 1, 0.001]);
    }
    setQuality(q: GraphicsQuality) {
        this.quality = q;
    }
    spawn(position: Vec3, size: number, kind: BlastClass = 'fighter') {
        let slot = this.slots.find((s) => !s.root.enabled);
        if (!slot) slot = this.slots.reduce((a, b) => (a.age / a.duration > b.age / b.duration ? a : b));
        const p = BLASTS.presets[kind];
        slot.age = 0;
        slot.duration = p.duration;
        slot.size = size * p.scale;
        slot.style = p.style;
        slot.data.set([0, slot.size, ++this.serial * 0.731, p.duration]);
        slot.mi.setParameter('uStyle', p.style);
        slot.root.setPosition(position);
        slot.root.enabled = true;
    }
    update(dt: number, camera?: Entity) {
        if (!camera) return;
        const r = camera.right,
            u = camera.up;
        this.right[0] = r.x;
        this.right[1] = r.y;
        this.right[2] = r.z;
        this.up[0] = u.x;
        this.up[1] = u.y;
        this.up[2] = u.z;
        let warmth = 0,
            overlap = 0;
        for (const s of this.slots) if (s.root.enabled) overlap++;
        for (const s of this.slots)
            if (s.root.enabled) {
                if (s.duration === 0) {
                    s.root.enabled = this.warmFrames-- > 0;
                    continue;
                }
                s.age += dt;
                s.root.enabled = s.age < s.duration;
                if (!s.root.enabled) continue;
                const distance = s.root.getPosition().distance(camera.getPosition());
                s.data[0] = s.age;
                s.data[1] = Math.min(s.size, Math.max(1, distance * BLASTS.maximumAngularSize));
                const q = BLASTS.quality[this.reduced ? 'low' : this.quality];
                s.budget[0] = q[0];
                s.budget[1] = q[1];
                s.budget[2] = q[2];
                s.budget[3] = (this.reduced ? 0.5 : 1) / Math.sqrt(Math.max(1, overlap * 0.65));
                warmth = Math.max(warmth, Math.exp(-s.age * 9) * Math.max(0, 1 - distance / BLASTS.flashRange));
            }
        this.warmth = this.reduced ? warmth * 0.3 : warmth;
        // One existing key light responds briefly; no new punctual lights or shader variants.
        const w = this.quality === 'low' ? 0 : this.warmth * 0.45;
        if (this.key) {
            this.key.color.set(
                this.keyColor.r + (1 - this.keyColor.r) * w,
                this.keyColor.g * (1 - w * 0.3),
                this.keyColor.b * (1 - w * 0.65)
            );
            this.key.intensity = this.keyIntensity * (1 + w * 0.2);
        }
    }
    get active() {
        return this.slots.reduce((n, s) => n + Number(s.root.enabled), 0);
    }
    reset() {
        for (const s of this.slots) s.root.enabled = false;
        this.warmth = 0;
        if (this.key) {
            this.key.color.copy(this.keyColor);
            this.key.intensity = this.keyIntensity;
        }
    }
    destroy() {
        this.closed = true;
        this.reset();
        this.root.destroy();
        this.mesh.destroy();
        this.material.destroy();
        this.atlas.unload();
        this.app.assets.remove(this.atlas);
        this.placeholder.destroy();
    }
}
