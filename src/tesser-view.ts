import { Entity, Quat, Vec3 } from 'playcanvas';
import type { AppBase, MeshInstance, RenderComponent } from 'playcanvas';

import { emission, ModelBuilder } from './art-kit';
import type { Combat } from './combat';
import type { ModelLibrary } from './model-library';
import { Tesser } from './tesser';

export class TesserView {
    readonly root = new Entity('Tesser warship');
    private readonly systems: Entity[] = [];
    private readonly engines: Entity[] = [];
    private readonly aperture = emission('Tesser exposed systems', '#ffb662', 2.5);
    private readonly exhaust = emission('Tesser ion drives', '#83e8ff', 3);
    private readonly rotation = new Quat();
    private readonly point = new Vec3();
    private meshes: MeshInstance[] = [];
    private requested = false;
    private closed = false;
    private readonly beam: Entity;
    constructor(app: AppBase, privateLibrary: ModelLibrary) {
        this.library = privateLibrary;
        this.root.enabled = false;
        app.root.addChild(this.root);
        const b = new ModelBuilder();
        b.box(this.exhaust, [0, 0, 0], [0.8, 0.8, 1]);
        this.beam = b.finish(app.graphicsDevice, 'Tesser locked attack warning');
        this.beam.enabled = false;
        app.root.addChild(this.beam);
        const boss = new Tesser();
        for (const p of boss.parts) {
            const b = new ModelBuilder();
            b.cylinder(this.aperture, [0, 0, 0], [8, 1.4, 8]);
            const e = b.finish(app.graphicsDevice, 'Tesser critical system ' + p.id);
            e.setPosition(p.local);
            this.root.addChild(e);
            this.systems.push(e);
        }
        for (const side of [-1, 1]) {
            const b = new ModelBuilder();
            b.cylinder(this.exhaust, [0, 0, 0], [10, 1, 10]);
            const e = b.finish(app.graphicsDevice, 'Tesser ion engine');
            e.setLocalPosition(side * 47, 0, 33);
            this.root.addChild(e);
            this.engines.push(e);
        }
    }
    private readonly library: ModelLibrary;
    render(c: Combat, alpha: number, started = true) {
        if (!started) {
            this.root.enabled = this.beam.enabled = false;
            return;
        }
        const boss = c.guardian;
        if (!this.requested && c.wave >= 13) {
            this.requested = true;
            void this.library.load('tesser').then((ok) => {
                if (!ok || this.closed) return;
                const e = this.library.create('tesser')!;
                this.root.addChild(e);
                this.meshes = e.findComponents('render').flatMap((r) => (r as RenderComponent).meshInstances);
            });
        }
        this.root.enabled = boss.active || boss.dying > 0;
        this.beam.enabled = boss.active && boss.charge > 0 && !boss.arriving;
        if (!this.root.enabled) return;
        this.root.setPosition(this.point.lerp(boss.previous, boss.position, alpha));
        this.root.setRotation(this.rotation.slerp(boss.previousRotation, boss.rotation, alpha));
        for (let i = 0; i < 7; i++)
            this.systems[i].enabled = boss.parts[i].active && (boss.parts[i].targetable || boss.arriving);
        for (const e of this.engines) {
            e.enabled = boss.dying <= 0 || boss.deathAge < 1.5;
            e.setLocalScale(1, 1, boss.arriving ? 15 : boss.phase === 2 ? 8 : 4);
        }
        for (const mi of this.meshes)
            if (boss.phase === 2) mi.setParameter('material_emissive', TesserView.unstable);
            else mi.deleteParameter('material_emissive');
        if (this.beam.enabled) {
            this.point.sub2(boss.aim, boss.position);
            const distance = this.point.length();
            this.beam.setPosition(boss.position);
            this.beam.lookAt(boss.aim);
            this.beam.setLocalScale(0.4, 0.4, distance);
            this.beam.translateLocal(0, 0, -distance / 2);
        }
    }
    private static readonly unstable = new Float32Array([0.24, 0.035, 0.015]);
    destroy() {
        this.closed = true;
        this.root.destroy();
        this.beam.destroy();
        this.aperture.destroy();
        this.exhaust.destroy();
    }
}
