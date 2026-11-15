import { Entity, Quat, Vec3 } from 'playcanvas';
import type { AppBase, RenderComponent } from 'playcanvas';

import { emission, ModelBuilder, surface, validateRenderAttributes } from './art-kit';
import { EncounterView } from './encounter-view';
import type { Phantom } from './phantom';
export class PhantomView {
    private readonly encounter: EncounterView;
    readonly root = new Entity('Phantom boss');
    private readonly wings: Entity[] = [];
    private readonly engines: Entity[] = [];
    private readonly body: Entity;
    private readonly armor = surface('Phantom obsidian alloy', '#44415f', 0.65, 0.75);
    private readonly edge = surface('Phantom cut armor', '#7a6e91', 0.6, 0.6);
    private readonly dark = surface('Phantom mechanisms', '#101a2c', 0.45, 0.45);
    private readonly violet = emission('Phantom violet drive', '#aa73ff', 2.8);
    private readonly crimson = emission('Phantom charge', '#ff406b', 3);
    private readonly core = emission('Phantom critical systems', '#ffc3db', 3);
    private readonly position = new Vec3();
    private readonly rotation = new Quat();
    constructor(app: AppBase) {
        this.encounter = new EncounterView(app);
        app.root.addChild(this.root);
        this.armor.emissive.fromString('#242033');
        this.armor.emissiveIntensity = 0.35;
        this.armor.update();
        const b = new ModelBuilder();
        b.hull(this.dark, [
            [-18, 0.5, 0, 0.4],
            [-9, 3, 0, 1.6],
            [3, 4, 0, 2.4],
            [14, 2, 0, 1.2]
        ]);
        b.hull(this.armor, [
            [-17, 0.3, 1, 0.2],
            [-6, 2.6, 1.2, 1.2],
            [4, 3, 1.5, 1.5],
            [11, 1.6, 1, 0.8]
        ]);
        b.box(this.violet, [0, 2.8, -3], [1.4, 0.3, 8]);
        b.box(this.core, [0, -1.8, 2], [2, 0.3, 6]);
        this.body = b.finish(app.graphicsDevice, 'Phantom central chassis');
        this.root.addChild(this.body);
        for (const side of [-1, 1]) {
            const m = new ModelBuilder();
            m.plate(
                this.dark,
                [
                    [side * 2, -7],
                    [side * 13, -16],
                    [side * 23, -3],
                    [side * 17, 13],
                    [side * 5, 10]
                ],
                -0.5,
                0.6
            );
            m.plate(
                this.armor,
                [
                    [side * 3, -6],
                    [side * 12, -13],
                    [side * 21, -3],
                    [side * 16, 11],
                    [side * 5, 9]
                ],
                0.7,
                1.2
            );
            m.box(this.edge, [side * 13, 1.5, 1], [2, 1, 18], [0, side * 25, 0]);
            m.box(this.violet, [side * 19, 1.5, 0], [0.4, 0.3, 7], [0, side * 20, 0]);
            m.box(this.dark, [side * 10, 0, -9], [1, 1, 9]);
            m.cylinder(this.crimson, [side * 10, 0, -13.6], [0.8, 0.3, 0.8]);
            m.cylinder(this.dark, [side * 7, 0, 11], [4, 5, 4]);
            m.cylinder(this.violet, [side * 7, 0, 13.7], [2.8, 0.2, 2.8]);
            const w = m.finish(app.graphicsDevice, 'Phantom articulated wing');
            this.root.addChild(w);
            this.wings.push(w);
            const jet = new ModelBuilder();
            jet.cylinder(this.violet, [0, 0, 0], [1.4, 1, 1.4]);
            const e = jet.finish(app.graphicsDevice, 'Phantom engine wake');
            e.setLocalPosition(side * 7, 0, 16);
            this.root.addChild(e);
            this.engines.push(e);
        }
        validateRenderAttributes(this.root);
        this.root.enabled = false;
    }
    render(p: Phantom, alpha: number) {
        this.root.enabled = p.active || p.dying > 0;
        this.encounter.render(this.root, p);
        if (!this.root.enabled) return;
        this.position.lerp(p.previous, p.position, alpha);
        this.rotation.slerp(p.previousRotation, p.rotation, alpha);
        this.root.setPosition(this.position);
        this.root.setRotation(this.rotation);
        const dying = !p.active,
            age = dying ? p.deathAge : 0,
            final = age >= 4.8;
        this.body.enabled = !final;
        for (const mi of this.body.render!.meshInstances) if (mi.material === this.core) mi.visible = p.phase === 3;
        for (const mi of this.body.render!.meshInstances)
            if (mi.material === this.armor || mi.material === this.edge)
                mi.material = p.phase === 3 ? this.edge : this.armor;
        for (let i = 0; i < 2; i++) {
            const side = i ? 1 : -1;
            this.wings[i].setLocalEulerAngles(
                dying ? age * 10 : 0,
                0,
                side * (dying ? age * 12 : Math.sin(p.age * 1.6) * 8 + (p.phase === 2 ? 12 : 0))
            );
            this.wings[i].setLocalPosition(dying ? side * age * 3 : 0, dying ? -age : 0, 0);
            const s = final ? Math.max(0.05, p.dying / 1.6) : 1;
            this.wings[i].setLocalScale(s, s, s);
            this.engines[i].enabled = !final;
            this.engines[i].setLocalScale(1, 1, dying ? 8 + age * 3 : p.state === 'flank' ? 12 : 6);
            for (const mi of this.engines[i].render!.meshInstances)
                mi.material = p.charge > 0 ? this.crimson : this.violet;
        }
    }
    destroy() {
        this.encounter.destroy();
        for (const r of this.root.findComponents('render'))
            for (const m of (r as RenderComponent).meshInstances) m.mesh?.destroy();
        this.root.destroy();
        for (const m of [this.armor, this.edge, this.dark, this.violet, this.crimson, this.core]) m.destroy();
    }
}
