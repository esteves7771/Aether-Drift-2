import {
    BLEND_ADDITIVEALPHA,
    BoxGeometry,
    CULLFACE_NONE,
    CylinderGeometry,
    Entity,
    Mat4,
    Mesh,
    MeshInstance,
    Quat,
    StandardMaterial,
    Vec3
} from 'playcanvas';
import type { GraphicsDevice, Geometry, RenderComponent } from 'playcanvas';
export function surface(name: string, color: string, metal = 0, gloss = 0.4) {
    const m = new StandardMaterial();
    m.name = name;
    m.diffuse.fromString(color);
    m.useMetalness = true;
    m.metalness = metal;
    m.gloss = gloss;
    m.update();
    return m;
}
export function emission(name: string, color: string, intensity = 2, alpha = 1) {
    const m = new StandardMaterial();
    m.name = name;
    m.diffuse.set(0, 0, 0);
    m.emissive.fromString(color);
    m.emissiveIntensity = intensity;
    m.useLighting = false;
    m.useSkybox = false;
    m.useMetalness = false;
    m.specular.set(0, 0, 0);
    if (alpha < 1) {
        m.blendType = BLEND_ADDITIVEALPHA;
        m.opacity = alpha;
        m.depthWrite = false;
    }
    m.cull = CULLFACE_NONE;
    m.update();
    return m;
}
interface Bucket {
    positions: number[];
    normals: number[];
    uvs: number[];
}
/** Bake mechanical details into one draw per material, with explicit normals on every vertex. */
export class ModelBuilder {
    private readonly buckets = new Map<StandardMaterial, Bucket>();
    private readonly matrix = new Mat4();
    private readonly rotation = new Quat();
    private readonly point = new Vec3();
    private readonly normal = new Vec3();
    private bucket(m: StandardMaterial) {
        let b = this.buckets.get(m);
        if (!b) {
            b = { positions: [], normals: [], uvs: [] };
            this.buckets.set(m, b);
        }
        return b;
    }
    geometry(m: StandardMaterial, g: Geometry, position: number[], scale: number[], angles = [0, 0, 0]) {
        if (!g.indices || !g.positions || !g.normals || !g.uvs)
            throw new Error('Art primitive is missing geometry attributes');
        const b = this.bucket(m);
        this.rotation.setFromEulerAngles(angles[0], angles[1], angles[2]);
        this.matrix.setTRS(
            this.point.set(position[0], position[1], position[2]),
            this.rotation,
            this.normal.set(scale[0], scale[1], scale[2])
        );
        for (const index of g.indices) {
            this.point.set(g.positions[index * 3], g.positions[index * 3 + 1], g.positions[index * 3 + 2]);
            this.matrix.transformPoint(this.point, this.point);
            b.positions.push(this.point.x, this.point.y, this.point.z);
            this.normal.set(
                g.normals[index * 3] / scale[0],
                g.normals[index * 3 + 1] / scale[1],
                g.normals[index * 3 + 2] / scale[2]
            );
            this.rotation.transformVector(this.normal, this.normal).normalize();
            b.normals.push(this.normal.x, this.normal.y, this.normal.z);
            b.uvs.push(g.uvs[index * 2] || 0, g.uvs[index * 2 + 1] || 0);
        }
    }
    box(m: StandardMaterial, p: number[], s: number[], a = [0, 0, 0]) {
        this.geometry(m, ModelBuilder.box, p, s, a);
    }
    cylinder(m: StandardMaterial, p: number[], s: number[], a = [90, 0, 0]) {
        this.geometry(m, ModelBuilder.cylinder, p, s, a);
    }
    /** Extruded outline in XZ, flat top/bottom, with correctly wound side faces. */
    plate(m: StandardMaterial, outline: number[][], bottom: number, top: number) {
        const points = outline.map(([x, z]) => [x, top, z]),
            lower = outline.map(([x, z]) => [x, bottom, z]);
        let area = 0;
        for (let i = 0; i < outline.length; i++) {
            const n = outline[(i + 1) % outline.length];
            area += outline[i][0] * n[1] - n[0] * outline[i][1];
        }
        if (area > 0) {
            points.reverse();
            lower.reverse();
        }
        for (let i = 1; i < points.length - 1; i++) {
            this.triangle(m, points[0], points[i], points[i + 1]);
            this.triangle(m, lower[0], lower[i + 1], lower[i]);
        }
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            this.triangle(m, points[i], lower[i], points[j]);
            this.triangle(m, points[j], lower[i], lower[j]);
        }
    }
    hull(m: StandardMaterial, sections: number[][]) {
        const rings = sections.map(([z, w, y, h]) => [
            [-w * 0.65, y + h, z],
            [w * 0.65, y + h, z],
            [w, y + h * 0.25, z],
            [w * 0.75, y - h, z],
            [-w * 0.75, y - h, z],
            [-w, y + h * 0.25, z]
        ]);
        for (let i = 0; i < rings.length - 1; i++)
            for (let j = 0; j < 6; j++) {
                const k = (j + 1) % 6;
                this.triangle(m, rings[i][j], rings[i + 1][j], rings[i][k]);
                this.triangle(m, rings[i][k], rings[i + 1][j], rings[i + 1][k]);
            }
        for (let j = 1; j < 5; j++) {
            this.triangle(m, rings[0][0], rings[0][j], rings[0][j + 1]);
            const r = rings[rings.length - 1];
            this.triangle(m, r[0], r[j + 1], r[j]);
        }
    }
    triangle(m: StandardMaterial, a: number[], b: number[], c: number[]) {
        const bucket = this.bucket(m);
        const ux = b[0] - a[0],
            uy = b[1] - a[1],
            uz = b[2] - a[2],
            vx = c[0] - a[0],
            vy = c[1] - a[1],
            vz = c[2] - a[2];
        this.normal.set(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx).normalize();
        for (const v of [a, b, c]) {
            bucket.positions.push(...v);
            bucket.normals.push(this.normal.x, this.normal.y, this.normal.z);
            bucket.uvs.push(v[0] * 0.2, v[2] * 0.2);
        }
    }
    finish(device: GraphicsDevice, name: string) {
        const entity = new Entity(name),
            instances: MeshInstance[] = [];
        for (const [material, b] of this.buckets) {
            const mesh = new Mesh(device);
            mesh.setPositions(b.positions);
            mesh.setNormals(b.normals);
            mesh.setUvs(0, b.uvs);
            mesh.update();
            const instance = new MeshInstance(mesh, material, entity);
            instance.mask = 3;
            instances.push(instance);
        }
        entity.addComponent('render', { meshInstances: instances });
        return entity;
    }
    private static readonly box = new BoxGeometry();
    private static readonly cylinder = new CylinderGeometry({ height: 1, radius: 0.5, capSegments: 12 });
}
/** Fail during boot rather than silently invalidating a WebGPU frame during combat. */
export function validateRenderAttributes(root: Entity) {
    for (const render of root.findComponents('render')) {
        const component = render as RenderComponent;
        for (const instance of component.meshInstances) {
            const m = instance.material as StandardMaterial;
            const normals = instance.mesh!.vertexBuffer.format.elements.some((e) => e.name === 'NORMAL');
            if (
                (m.useLighting || m.useMetalness || m.specular.r > 0 || m.specular.g > 0 || m.specular.b > 0) &&
                !normals
            )
                throw new Error(`Missing normals: ${instance.node.name} / ${m.name}`);
            const uv = instance.mesh!.vertexBuffer.format.elements.some((e) => e.name === 'TEXCOORD0');
            if ((m.diffuseMap || m.emissiveMap || m.normalMap || m.opacityMap) && !uv)
                throw new Error(`Missing UVs: ${instance.node.name} / ${m.name}`);
        }
    }
}
