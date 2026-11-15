import {
    ADDRESS_REPEAT,
    Asset,
    Entity,
    Mat4,
    MeshInstance,
    Quat,
    SphereGeometry,
    Vec3,
    VertexBuffer,
    VertexFormat,
    calculateNormals
} from 'playcanvas';
import type { AppBase, Mesh, StandardMaterial, Texture } from 'playcanvas';

import type { Rock } from './collisions';
import type { GraphicsQuality } from './config';

/** Six coherent fractured bodies, with impact bowls and raised rims. Shared across the field. */
export function asteroidGeometry(variant: number, detailed: boolean) {
    const g = new SphereGeometry({ radius: 1, latitudeBands: detailed ? 28 : 12, longitudeBands: detailed ? 40 : 18 });
    for (let i = 0; i < g.positions.length; i += 3) {
        const x = g.positions[i],
            y = g.positions[i + 1],
            z = g.positions[i + 2];
        const ridge = Math.abs(Math.sin(x * 5 + y * 3 + variant) * Math.cos(z * 6 - y * 4));
        let r = 0.78 + 0.09 * Math.sin(x * 7 + y * 9 + variant) + 0.08 * ridge;
        for (let c = 0; c < 5; c++) {
            const a = c * 2.399 + variant,
                cy = -0.65 + c * 0.31,
                cr = Math.sqrt(1 - cy * cy);
            const d = Math.hypot(x - Math.cos(a) * cr, y - cy, z - Math.sin(a) * cr);
            const size = 0.22 + (c % 3) * 0.07;
            r -= 0.15 * Math.exp(-Math.pow(d / size, 4));
            r += 0.045 * Math.exp(-Math.pow((d - size) / 0.055, 2));
        }
        // Slab, spire, rubble, bilobed and compact archetypes, all within the collision sphere.
        const sx = [0.96, 0.66, 0.9, 0.8, 0.92, 0.72][variant],
            sy = [0.65, 0.98, 0.76, 0.86, 0.72, 0.84][variant];
        const cleft = variant === 3 ? 0.12 * Math.exp(-x * x * 22) : 0;
        g.positions[i] = x * (r - cleft) * sx;
        g.positions[i + 1] = y * (r - cleft) * sy;
        g.positions[i + 2] = z * (r - cleft);
    }
    g.normals = calculateNormals(g.positions, g.indices);
    return g;
}

/** Local 1K CC0 maps; the procedural material stays usable if any file fails. */
export function loadRockMaps(app: AppBase, materials: StandardMaterial[]) {
    const assets: Asset[] = [];
    let quality: GraphicsQuality = 'medium';
    const maps: { normal?: Texture; setQuality(q: GraphicsQuality): void; destroy(): void } = {
        setQuality(q: GraphicsQuality) {
            quality = q;
            for (const m of materials) {
                m.normalMap = q === 'low' ? null : (maps.normal ?? null);
                m.update();
            }
        },
        destroy() {
            for (const a of assets) {
                a.unload();
                app.assets.remove(a);
            }
        }
    };
    for (const [file, property] of [
        ['Color', 'diffuseMap'],
        ['NormalGL', 'normalMap'],
        ['Roughness', 'glossMap']
    ] as const) {
        const a = new Asset('Rocks007 ' + file, 'texture', {
            url: import.meta.env.BASE_URL + 'textures/rocks/Rocks007_1K-JPG_' + file + '.jpg'
        });
        assets.push(a);
        app.assets.add(a);
        a.once('load', () => {
            const texture = a.resource as Texture;
            texture.addressU = texture.addressV = ADDRESS_REPEAT;
            texture.anisotropy = 4;
            if (property === 'normalMap') maps.normal = texture;
            for (const m of materials) {
                m[property] = property === 'normalMap' && quality === 'low' ? null : texture;
                if (property === 'diffuseMap') m.diffuseMapTiling.set(3, 2);
                if (property === 'normalMap') {
                    m.normalMapTiling.set(3, 2);
                    m.bumpiness = 0.65;
                }
                if (property === 'glossMap') {
                    // With inversion enabled this scalar multiplies roughness, not gloss.
                    m.gloss = 1;
                    m.glossMapTiling.set(3, 2);
                    m.glossInvert = true;
                    m.glossMapChannel = 'r';
                }
                m.update();
            }
        });
        app.assets.load(a);
    }
    return maps;
}

/** Twelve shared instanced draws at most; coarse distant bodies, detailed nearby surfaces. */
export class AsteroidField {
    readonly root = new Entity('Asteroids');
    private readonly matrices: Float32Array[] = [];
    private readonly groups: {
        mi: MeshInstance;
        buffer: VertexBuffer;
        data: Float32Array;
        count: number;
        entity: Entity;
    }[] = [];
    private quality: GraphicsQuality = 'medium';
    private age = 1;
    private rocks: Rock[];
    constructor(app: AppBase, rocks: Rock[], meshes: Mesh[][], materials: StandardMaterial[]) {
        this.rocks = rocks;
        app.root.addChild(this.root);
        const matrix = new Mat4(),
            q = new Quat(),
            scale = new Vec3();
        for (let i = 0; i < rocks.length; i++) {
            const r = rocks[i];
            q.setFromEulerAngles(i * 31, i * 71, i * 17);
            scale.set(r.radius, r.radius, r.radius);
            matrix.setTRS(r.position, q, scale);
            this.matrices.push(new Float32Array(matrix.data));
        }
        for (let lod = 0; lod < 2; lod++)
            for (let v = 0; v < 6; v++) {
                const e = new Entity('Instanced regolith ' + lod + '/' + v),
                    mi = new MeshInstance(meshes[lod][v], materials[v % 3], e),
                    data = new Float32Array(rocks.length * 16);
                const buffer = new VertexBuffer(
                    app.graphicsDevice,
                    VertexFormat.getDefaultInstancingFormat(app.graphicsDevice),
                    rocks.length,
                    { data }
                );
                mi.setInstancing(buffer, false);
                mi.instancingCount = 0;
                e.addComponent('render', { meshInstances: [mi] });
                this.root.addChild(e);
                this.groups.push({ mi, buffer, data, count: 0, entity: e });
            }
        this.update(Vec3.ZERO, 1);
    }
    setQuality(q: GraphicsQuality) {
        this.quality = q;
        this.age = 1;
    }
    update(position: Vec3, dt: number) {
        this.age += dt;
        if (this.age < 0.3) return;
        this.age = 0;
        for (const g of this.groups) g.count = 0;
        const distance = this.quality === 'high' ? 520 : 280;
        for (let i = 0; i < this.rocks.length; i++) {
            const r = this.rocks[i],
                near = this.quality !== 'low' && r.position.distance(position) - r.radius < distance;
            const g = this.groups[(near ? 6 : 0) + (i % 6)];
            g.data.set(this.matrices[i], g.count++ * 16);
        }
        for (const g of this.groups) {
            g.mi.instancingCount = g.count;
            g.entity.enabled = g.count > 0;
            if (g.count) g.buffer.setData(g.data);
        }
    }
    destroy() {
        this.root.destroy();
        for (const g of this.groups) g.buffer.destroy();
    }
}
