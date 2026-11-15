import { Entity, Mesh, MeshInstance, PRIMITIVE_LINES, SphereGeometry } from 'playcanvas';
import type { AppBase, Vec3 } from 'playcanvas';

import { emission, ModelBuilder, surface, validateRenderAttributes } from './art-kit';
import type { GraphicsQuality } from './config';
import { SPECTACLE } from './spectacle-config';
/** Decorative only; nothing in this hierarchy is a CombatTarget or a collision proxy. */
export class Atmosphere {
    readonly root = new Entity('Decorative distant activity');
    private readonly dust = new Entity('Peripheral space dust');
    private readonly dustMesh: Mesh;
    private readonly dustPositions = new Float32Array(64 * 6);
    private readonly depth = new Float32Array(64);
    private readonly wreck: Entity;
    private readonly flash: Entity;
    private time = 0;
    private count = 42;
    private enabled = true;
    private readonly hull = surface('Distant utility hull', '#62718a', 0.3, 0.2);
    private readonly lamps = emission('Decorative navigation lamps', '#708ab1', 0.7);
    private readonly motes = emission('Peripheral motes', '#87b6dc', 0.65, 0.28);
    private readonly glint = emission('Faraway combat flash', '#ffc9ac', 2, 0.25);
    constructor(app: AppBase) {
        app.root.addChild(this.root);
        const wreck = new ModelBuilder();
        for (let i = 0; i < 7; i++)
            wreck.box(
                this.hull,
                [Math.sin(i * 4.2) * 150, Math.cos(i * 2.4) * 80, -180 - i * 35],
                [2 + i * 0.4, 0.4, 4 + i],
                [i * 33, i * 45, i * 17]
            );
        this.wreck = wreck.finish(app.graphicsDevice, 'Unmarked drifting fragments');
        this.root.addChild(this.wreck);
        this.flash = new Entity('Distant decorative flash');
        this.flash.addComponent('render', {
            meshInstances: [
                new MeshInstance(
                    Mesh.fromGeometry(app.graphicsDevice, new SphereGeometry({ latitudeBands: 6, longitudeBands: 8 })),
                    this.glint,
                    this.flash
                )
            ]
        });
        this.root.addChild(this.flash);
        this.dustMesh = new Mesh(app.graphicsDevice);
        this.dustMesh.setPositions(this.dustPositions);
        this.dustMesh.update(PRIMITIVE_LINES);
        this.dust.addComponent('render', { meshInstances: [new MeshInstance(this.dustMesh, this.motes, this.dust)] });
        app.root.addChild(this.dust);
        for (let i = 0; i < 64; i++) this.depth[i] = -5 - ((i * 37) % 90);
        validateRenderAttributes(this.root);
        validateRenderAttributes(this.dust);
    }
    setQuality(quality: GraphicsQuality) {
        const i = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
        this.count = SPECTACLE.speed.dust[i];
        this.wreck.enabled = quality !== 'low';
    }
    update(dt: number, _ship: Vec3, camera: Entity, speed: number, boost: boolean, cues: boolean) {
        this.time += dt;
        this.wreck.setLocalEulerAngles(this.time * 0.4, this.time * 0.2, 0);
        const phase = this.time % 11;
        this.flash.enabled = phase < 0.16 || this.time < 0.05;
        this.flash.setLocalPosition(-470, 360, -1700);
        const size = 3 + Math.sin((phase / 0.16) * Math.PI) * 12;
        this.flash.setLocalScale(size, size, size);
        this.dust.enabled = this.enabled && cues && speed > 18;
        this.dust.setPosition(camera.getPosition());
        this.dust.setRotation(camera.getRotation());
        if (!this.dust.enabled) return;
        for (let i = 0; i < 64; i++) {
            const k = i * 6;
            if (i >= this.count) {
                for (let j = 0; j < 6; j++) this.dustPositions[k + j] = 0;
                continue;
            }
            this.depth[i] += (12 + speed * 0.65) * dt;
            if (this.depth[i] > -4) this.depth[i] -= 90;
            const a = i * 2.399,
                x = Math.cos(a) * (14 + (i % 7) * 4),
                y = Math.sin(a) * (9 + (i % 5) * 3),
                z = this.depth[i];
            this.dustPositions[k] = this.dustPositions[k + 3] = x;
            this.dustPositions[k + 1] = this.dustPositions[k + 4] = y;
            this.dustPositions[k + 2] = z;
            this.dustPositions[k + 5] = z + (boost ? 4 : Math.min(2, speed / 65));
        }
        this.dustMesh.setPositions(this.dustPositions);
        this.dustMesh.update(PRIMITIVE_LINES);
    }
    destroy() {
        const meshes = new Set<Mesh>();
        for (const render of this.root.findComponents('render'))
            for (const mi of (render as unknown as { meshInstances: MeshInstance[] }).meshInstances)
                if (mi.mesh) meshes.add(mi.mesh);
        for (const mesh of meshes) mesh.destroy();
        this.root.destroy();
        this.dust.destroy();
        this.dustMesh.destroy();
        for (const m of [this.hull, this.lamps, this.motes, this.glint]) m.destroy();
    }
}
