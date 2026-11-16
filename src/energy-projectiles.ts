import {
    Entity,
    Mesh,
    MeshInstance,
    ShaderMaterial,
    Vec3,
    BLEND_ADDITIVEALPHA,
    CULLFACE_NONE,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    SEMANTIC_COLOR
} from 'playcanvas';
import type { AppBase } from 'playcanvas';

import { COMBAT } from './combat-config';
import type { GraphicsQuality } from './config';
import { ENERGY_LINKS, energyProfile } from './energy-profiles';
import { energyVertexGLSL, energyFragmentGLSL, energyVertexWGSL, energyFragmentWGSL } from './energy-shader';
import type { Projectiles } from './projectiles';
/** One bounded dynamic draw, including strictly decorative short violet links. No simulation ownership. */
export class EnergyProjectiles {
    readonly root = new Entity('Cinematic hostile energy');
    private readonly mesh: Mesh;
    private readonly material: ShaderMaterial;
    private readonly capacity = COMBAT.projectileCapacity * 2 + ENERGY_LINKS;
    private readonly positions = new Float32Array(this.capacity * 12);
    private readonly colors = new Float32Array(this.capacity * 16);
    private readonly uvs = new Float32Array(this.capacity * 8);
    private readonly center = new Vec3();
    private readonly side = new Vec3();
    private readonly along = new Vec3();
    private readonly last = new Vec3();
    private readonly params = new Float32Array([0, 1, 0, 0]);
    private count = 0;
    private warm = 3;
    private quality: GraphicsQuality = 'medium';
    constructor(app: AppBase) {
        this.mesh = new Mesh(app.graphicsDevice);
        const indices = new Uint16Array(this.capacity * 6);
        for (let i = 0; i < this.capacity; i++) {
            indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
            this.uvs.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8);
        }
        this.mesh.setPositions(this.positions);
        this.mesh.setColors(this.colors);
        this.mesh.setUvs(0, this.uvs);
        this.mesh.setIndices(indices);
        this.mesh.update();
        this.material = new ShaderMaterial({
            uniqueName: 'AetherEnergyFormations',
            attributes: { aPosition: SEMANTIC_POSITION, aUv0: SEMANTIC_TEXCOORD0, aColor: SEMANTIC_COLOR },
            vertexGLSL: energyVertexGLSL,
            fragmentGLSL: energyFragmentGLSL,
            vertexWGSL: energyVertexWGSL,
            fragmentWGSL: energyFragmentWGSL
        });
        this.material.blendType = BLEND_ADDITIVEALPHA;
        this.material.depthWrite = false;
        this.material.cull = CULLFACE_NONE;
        this.material.setParameter('uEnergyTime', this.params);
        this.material.update();
        const mi = new MeshInstance(this.mesh, this.material, this.root);
        mi.cull = false;
        this.root.addComponent('render', { meshInstances: [mi], castShadows: false, receiveShadows: false });
        app.root.addChild(this.root);
    }
    setQuality(q: GraphicsQuality) {
        this.quality = q;
        this.params[1] = q === 'low' ? 0.3 : q === 'high' ? 1.3 : 1;
    }
    private quad(center: Vec3, side: Vec3, along: Vec3, kind: number, seed: number) {
        const n = this.count++;
        if (n >= this.capacity) {
            this.count = this.capacity;
            return;
        }
        for (let v = 0; v < 4; v++) {
            const x = v % 2 ? 1 : -1,
                y = v > 1 ? 1 : -1,
                k = n * 12 + v * 3;
            this.positions[k] = center.x + side.x * x + along.x * y;
            this.positions[k + 1] = center.y + side.y * x + along.y * y;
            this.positions[k + 2] = center.z + side.z * x + along.z * y;
            const c = n * 16 + v * 4;
            this.colors[c] = kind;
            this.colors[c + 1] = seed;
            this.colors[c + 2] = 0;
            this.colors[c + 3] = 1;
        }
    }
    render(shots: Projectiles, camera: Entity, alpha: number, dt: number) {
        this.params[0] += dt;
        this.count = 0;
        if (this.warm <= 0 && !shots.items.some((p) => p.active && p.hostile)) {
            this.root.enabled = false;
            return;
        }
        this.positions.fill(0);
        let previous = -1,
            links = 0;
        for (let i = 0; i < shots.items.length; i++) {
            const p = shots.items[i];
            if (!p.active || !p.hostile) continue;
            this.center.lerp(p.previous, p.position, alpha);
            const kind = p.pattern || 0,
                profile = energyProfile(kind);
            if (kind === 2 || kind === 0 || kind === 5) {
                this.along.copy(p.velocity).normalize();
                this.side.cross(this.along, camera.forward);
                if (this.side.lengthSq() < 0.001) this.side.copy(camera.right);
                this.side.normalize().mulScalar(profile.radius);
                const length = profile.trail;
                this.center.add(this.last.copy(this.along).mulScalar(-length * 0.42));
                this.along.mulScalar(length * 0.5);
            } else {
                this.side.copy(camera.right).mulScalar(profile.radius);
                this.along.copy(camera.up).mulScalar(profile.radius);
            }
            this.quad(this.center, this.side, this.along, kind, (i % 23) / 23);
            if (kind === 2 || kind === 0 || kind === 5) {
                this.center.lerp(p.previous, p.position, alpha);
                this.side.copy(camera.right).mulScalar(0.9);
                this.along.copy(camera.up).mulScalar(0.9);
                this.quad(this.center, this.side, this.along, kind === 2 ? 9 : 5, (i % 23) / 23);
            }
            if (kind === 4 && previous >= 0 && links < ENERGY_LINKS && this.quality !== 'low') {
                const q = shots.items[previous];
                if (q.position.distance(p.position) < 85 && q.owner === p.owner) {
                    this.center.lerp(q.position, p.position, 0.5);
                    this.along.sub2(p.position, q.position).mulScalar(0.5);
                    this.side.cross(this.along, camera.forward).normalize().mulScalar(0.12);
                    this.quad(this.center, this.side, this.along, 3, (i % 23) / 23);
                    links++;
                }
            }
            previous = kind === 4 ? i : -1;
        }
        this.mesh.setPositions(this.positions);
        this.mesh.setColors(this.colors);
        this.mesh.update();
        this.root.enabled = this.count > 0 || this.warm-- > 0;
    }
    destroy() {
        this.root.destroy();
        this.mesh.destroy();
        this.material.destroy();
    }
}
