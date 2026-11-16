import {
    BLEND_ADDITIVEALPHA,
    CULLFACE_NONE,
    Entity,
    Mesh,
    MeshInstance,
    SEMANTIC_NORMAL,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    SphereGeometry
} from 'playcanvas';
import type { AppBase, GraphicsDevice } from 'playcanvas';

import type { GraphicsQuality } from './config';
import type { Command, Flight } from './flight';
import { thrusterFragmentGLSL, thrusterFragmentWGSL, thrusterVertexGLSL, thrusterVertexWGSL } from './thruster-shader';
import { PLAYER_ENGINES, ThrusterState } from './thruster-state';
import type { PlayerShip } from './thruster-state';

export function plumeMesh(device: GraphicsDevice, detail: boolean) {
    const positions: number[] = [],
        normals: number[] = [],
        uv: number[] = [],
        indices: number[] = [],
        rings = detail ? 18 : 9,
        sides = detail ? 16 : 8;
    for (let j = 0; j <= rings; j++)
        for (let i = 0; i <= sides; i++) {
            const t = j / rings,
                a = (i / sides) * Math.PI * 2;
            const radius =
                (0.82 + 0.6 * Math.sin((Math.min(1, t * 3.3) * Math.PI) / 2)) * Math.pow(1 - t, 0.72) + 0.008;
            positions.push(Math.cos(a) * radius, Math.sin(a) * radius, t);
            normals.push(Math.cos(a), Math.sin(a), 0.35);
            uv.push(i / sides, t);
            if (i < sides && j < rings) {
                const n = j * (sides + 1) + i;
                indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
            }
        }
    const mesh = new Mesh(device);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, uv);
    mesh.setIndices(indices);
    mesh.update();
    // Shader turbulence expands the radial profile by at most 3.5 percent.
    mesh.aabb.halfExtents.x += 0.04;
    mesh.aabb.halfExtents.y += 0.04;
    return mesh;
}
/** Narrow crossed filaments read as a volumetric core without camera-facing billboard blobs. */
function spineMesh(device: GraphicsDevice) {
    const positions: number[] = [],
        normals: number[] = [],
        uv: number[] = [],
        indices: number[] = [];
    for (let plane = 0; plane < 3; plane++)
        for (let j = 0; j <= 14; j++)
            for (let side = 0; side < 2; side++) {
                const a = (plane * Math.PI) / 3,
                    t = j / 14,
                    r = (side ? 1 : -1) * (1 - t * 0.75);
                positions.push(Math.cos(a) * r, Math.sin(a) * r, t);
                normals.push(-Math.sin(a), Math.cos(a), 0);
                uv.push(side, t);
                if (side === 0 && j < 14) {
                    const n = plane * 30 + j * 2;
                    indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
                }
            }
    const mesh = new Mesh(device);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, uv);
    mesh.setIndices(indices);
    mesh.update();
    mesh.aabb.halfExtents.x += 0.04;
    mesh.aabb.halfExtents.y += 0.04;
    return mesh;
}
type Layer = { entity: Entity; mi: MeshInstance; shape: Float32Array };
type Engine = { root: Entity; layers: Layer[]; data: Float32Array };
/** Three reusable nozzles plus eight tiny RCS jets. No particles or frame-time mesh/material creation. */
export class PlayerThrusters {
    readonly root = new Entity('Player propulsion');
    readonly state = new ThrusterState();
    private readonly material: ShaderMaterial;
    private readonly plume: Mesh[];
    private readonly sphere: Mesh;
    private readonly spine: Mesh;
    private readonly engines: Engine[] = [];
    private readonly jets: Engine[] = [];
    private quality: GraphicsQuality = 'medium';
    private selected: PlayerShip = 'classic';
    private closed = false;
    constructor(app: AppBase, ship: Entity) {
        ship.addChild(this.root);
        this.material = new ShaderMaterial({
            uniqueName: 'PlayerIonPropulsion',
            attributes: { aPosition: SEMANTIC_POSITION, aNormal: SEMANTIC_NORMAL, aUv0: SEMANTIC_TEXCOORD0 },
            vertexGLSL: thrusterVertexGLSL,
            fragmentGLSL: thrusterFragmentGLSL,
            vertexWGSL: thrusterVertexWGSL,
            fragmentWGSL: thrusterFragmentWGSL
        });
        this.material.blendType = BLEND_ADDITIVEALPHA;
        this.material.depthWrite = false;
        this.material.cull = CULLFACE_NONE;
        this.material.setParameter('uEngine', new Float32Array([0, 0.13, 0.15, 0]));
        this.material.setParameter('uShape', new Float32Array([0, 0, 0.2, 0.25]));
        this.material.update();
        this.plume = [plumeMesh(app.graphicsDevice, false), plumeMesh(app.graphicsDevice, true)];
        this.sphere = Mesh.fromGeometry(
            app.graphicsDevice,
            new SphereGeometry({ radius: 1, latitudeBands: 8, longitudeBands: 12 })
        );
        this.spine = spineMesh(app.graphicsDevice);
        for (let i = 0; i < 3; i++) {
            const engine: Engine = { root: new Entity('Player engine ' + i), layers: [], data: new Float32Array(4) };
            this.root.addChild(engine.root);
            for (let j = 0; j < 4; j++)
                engine.layers.push(
                    this.layer(engine, j === 3 ? this.spine : j === 0 ? this.plume[1] : this.sphere, [0, 1, 2, 3][j], i)
                );
            this.engines.push(engine);
        }
        for (let i = 0; i < 8; i++) {
            const engine: Engine = { root: new Entity('Maneuver jet ' + i), layers: [], data: new Float32Array(4) };
            this.root.addChild(engine.root);
            engine.layers.push(this.layer(engine, this.plume[1], 0, i + 3));
            this.jets.push(engine);
        }
        this.fit('classic');
        this.setQuality('medium');
    }
    private layer(engine: Engine, mesh: Mesh, kind: number, seed: number) {
        const entity = new Entity('Ion ' + ['plume', 'core', 'halo', 'spine'][kind]),
            mi = new MeshInstance(mesh, this.material, entity);
        const shape = new Float32Array([
            kind,
            seed * 2.17,
            0.5,
            kind === 1 ? 0.72 : kind === 2 ? 0.1 : kind === 3 ? 0.45 : 0.55
        ]);
        mi.setParameter('uEngine', engine.data);
        mi.setParameter('uShape', shape);
        entity.addComponent('render', { meshInstances: [mi], castShadows: false, receiveShadows: false });
        engine.root.addChild(entity);
        return { entity, mi, shape };
    }
    private fit(ship: PlayerShip) {
        this.selected = ship;
        const config = PLAYER_ENGINES[ship];
        for (let i = 0; i < 3; i++) {
            const e = this.engines[i],
                nozzle = config[i];
            e.root.enabled = !!nozzle;
            if (nozzle) e.root.setLocalPosition(nozzle.point[0], nozzle.point[1], nozzle.point[2]);
        }
        const width = ship === 'classic' ? 2.65 : 1.55,
            y = ship === 'classic' ? 0.34 : 0.22,
            z = ship === 'classic' ? 0.6 : 1.1;
        for (let i = 0; i < 8; i++) {
            const jet = this.jets[i].root;
            if (i < 2) {
                jet.setLocalPosition(i ? width : -width, 0, z);
                jet.setLocalEulerAngles(0, i ? 90 : -90, 0);
            } else if (i < 6) {
                jet.setLocalPosition(i % 2 ? width * 0.72 : -width * 0.72, i < 4 ? y : -y, z);
                jet.setLocalEulerAngles(i < 4 ? -90 : 90, 0, 0);
            } else {
                jet.setLocalPosition(i % 2 ? 0.9 : -0.9, 0, -1.5);
                jet.setLocalEulerAngles(0, 180, 0);
            }
        }
    }
    setQuality(quality: GraphicsQuality) {
        this.quality = quality;
        for (const e of [...this.engines, ...this.jets])
            for (const layer of e.layers)
                if (layer.shape[0] === 0) layer.mi.mesh = this.plume[quality === 'low' ? 0 : 1];
    }
    reset() {
        this.state.reset();
    }
    update(
        ship: Flight,
        command: Command,
        cruise: boolean,
        active: boolean,
        started: boolean,
        selected: PlayerShip,
        dt: number
    ) {
        if (this.closed) return;
        if (selected !== this.selected) this.fit(selected);
        this.root.enabled = ship.hull > 0;
        if (!this.root.enabled) return;
        this.state.update(command, ship.boosting, cruise, dt, active, !started);
        if (ship.evasion.active && active) {
            this.state.power = Math.max(0.95, this.state.power);
            this.state.length = Math.max(3.4, this.state.length);
            this.state.jets[ship.evasion.side > 0 ? 0 : 1] = 1;
        }
        const s = this.state,
            config = PLAYER_ENGINES[this.selected];
        const pulse =
            1 +
            (s.mode === 'cruise' ? 0.018 : 0.025 + s.turbulence * 0.025) * Math.sin(s.time * 9) +
            0.01 * Math.sin(s.time * 15);
        for (let i = 0; i < config.length; i++) {
            const e = this.engines[i],
                nozzle = config[i],
                r = nozzle.radius * (1 + s.power * 0.13),
                length = s.length * nozzle.length;
            e.data[0] = s.time;
            e.data[1] = s.power * pulse;
            e.data[2] = s.heat;
            e.data[3] = s.mode === 'cruise' ? 1 : 0;
            e.layers[0].entity.setLocalScale(r, r, length);
            e.layers[0].shape[2] = this.quality === 'low' ? 0.15 : s.turbulence;
            e.layers[1].entity.setLocalScale(r * 0.81, r * 0.81, r * 0.52);
            e.layers[1].entity.setLocalPosition(0, 0, 0.015);
            e.layers[2].entity.enabled = this.quality === 'high';
            e.layers[2].entity.setLocalScale(r * 1.45, r * 1.45, r * 0.9);
            e.layers[3].entity.enabled = this.quality !== 'low';
            e.layers[3].entity.setLocalScale(r * 0.43, r * 0.43, length * 0.72);
            e.layers[3].shape[2] = s.turbulence * 0.6;
        }
        for (let i = 0; i < 8; i++) {
            const e = this.jets[i],
                n = s.jets[i];
            e.root.enabled = n > 0.035 && this.quality !== 'low';
            if (!e.root.enabled) continue;
            e.data[0] = s.time;
            e.data[1] = n * 0.65;
            e.data[2] = 0.4;
            e.data[3] = 0;
            e.layers[0].entity.setLocalScale(0.085, 0.085, 0.15 + n * 0.65);
        }
    }
    destroy() {
        this.closed = true;
        this.root.destroy();
        this.material.destroy();
        this.sphere.destroy();
        this.spine.destroy();
        for (const m of this.plume) m.destroy();
    }
}
