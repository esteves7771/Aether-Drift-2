import { Entity, Quat, Vec3 } from 'playcanvas';
import type { AppBase, MeshInstance, RenderComponent } from 'playcanvas';

import { emission, ModelBuilder } from './art-kit';
import type { Combat } from './combat';
import { EncounterView } from './encounter-view';
import type { ModelLibrary } from './model-library';
import { Tesser } from './tesser';

export class TesserView {
    private readonly encounter: EncounterView;
    readonly root = new Entity('Tesser warship');
    private readonly systems: Entity[] = [];
    private readonly engines: Entity[] = [];
    private readonly aperture = emission('Tesser exposed systems', '#ffb662', 2.5);
    private readonly exhaust = emission('Tesser ion drives', '#83e8ff', 3);
    private readonly rotation = new Quat();
    private readonly point = new Vec3();
    private meshes: MeshInstance[] = [];
    private readonly heat = new Float32Array(3);
    private requested = false;
    private closed = false;
    constructor(app: AppBase, privateLibrary: ModelLibrary) {
        this.encounter = new EncounterView(app);
        this.library = privateLibrary;
        this.root.enabled = false;
        app.root.addChild(this.root);

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
            this.root.enabled = false;
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
        this.encounter.render(this.root, boss);
        if (!this.root.enabled) return;
        this.root.setPosition(this.point.lerp(boss.previous, boss.position, alpha));
        this.root.setRotation(this.rotation.slerp(boss.previousRotation, boss.rotation, alpha));
        for (let i = 0; i < 7; i++)
            this.systems[i].enabled =
                boss.parts[i].active &&
                (boss.parts[i].targetable || boss.arriving || (boss.charge > 0 && boss.patterns.permitted));
        for (const e of this.engines) {
            e.enabled = boss.dying <= 0 || boss.deathAge < 1.5;
            e.setLocalScale(1, 1, boss.arriving ? 15 : boss.phase >= 2 ? 8 : 4);
        }
        const f =
            boss.charge > 0
                ? 1 - boss.patterns.winding / boss.patterns.spec.telegraph[boss.phase - 1]
                : boss.patterns.state === 'fire' && boss.patterns.time < 0.16
                  ? 1
                  : 0;
        this.heat[0] = 0.08 + f * 0.16;
        this.heat[1] = 0.025 + f * 0.05;
        this.heat[2] = 0.15 + f * 0.35;
        for (const mi of this.meshes)
            if (boss.phase >= 2 || f > 0) mi.setParameter('material_emissive', this.heat);
            else mi.deleteParameter('material_emissive');
    }
    destroy() {
        this.encounter.destroy();
        this.closed = true;
        this.root.destroy();
        this.aperture.destroy();
        this.exhaust.destroy();
    }
}
