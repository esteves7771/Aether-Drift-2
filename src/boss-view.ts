import { Entity, Quat, SphereGeometry, Vec3 } from 'playcanvas';
import type { AppBase, RenderComponent } from 'playcanvas';

import { emission, ModelBuilder, surface, validateRenderAttributes } from './art-kit';
import type { Boss } from './boss';
import { SPECTACLE } from './spectacle-config';
/** All visual modules are built at boot. Simulation anchors and proxies remain independent. */
export class BossView {
    readonly root = new Entity('Capital ship');
    private readonly body: Entity;
    private readonly parts: Entity[] = [];
    private readonly cores: Entity[] = [];
    private readonly cues: Entity[] = [];
    private readonly wings: Entity[] = [];
    private readonly engines: Entity[] = [];
    private readonly exhaust: Entity[] = [];
    private readonly vanes: Entity[] = [];
    private readonly beams: Entity[] = [];
    private readonly armor = surface('Dreadnought ceramic titanium', '#a5afc4', 0.5, 0.6);
    private readonly trim = surface('Dreadnought graphite mechanics', '#1b263d', 0.7, 0.5);
    private readonly edge = surface('Dreadnought armored edges', '#3c4c69', 0.8, 0.65);
    private readonly scar = surface('Capital heat damage', '#332632', 0.45, 0.2);
    private readonly energy = emission('Capital ion conduits', '#557fff', 2);
    private readonly exposed = emission('Capital exposed coolant', '#66ffe5', 2.8);
    private readonly locked = emission('Capital shielded components', '#22324a', 0.25);
    private readonly charge = emission('Capital weapon charge', '#ff6c95', 3);
    private readonly hot = emission('Capital reactor rupture', '#ff9f66', 3);
    private readonly plume = emission('Capital engine plume', '#627bff', 1.7, 0.3);
    private readonly line = emission('Capital aim telegraph', '#ff6485', 1.3, 0.2);
    private readonly position = new Vec3();
    private readonly rotation = new Quat();
    private readonly tumble = new Quat();
    constructor(app: AppBase, boss: Boss) {
        const device = app.graphicsDevice;
        app.root.addChild(this.root);
        for (const m of [this.armor, this.edge]) {
            m.emissive.fromString('#2c4267');
            m.emissiveIntensity = 0.55;
            m.update();
        }
        const b = new ModelBuilder();
        b.hull(this.trim, [
            [-108, 8, 0, 5],
            [-78, 28, 0, 16],
            [-24, 39, 0, 22],
            [40, 37, 0, 24],
            [98, 25, 0, 14],
            [116, 18, 0, 10]
        ]);
        b.hull(this.armor, [
            [-100, 7, 5, 4],
            [-70, 22, 7, 12],
            [-20, 32, 7, 17],
            [36, 31, 7, 19],
            [88, 21, 7, 10],
            [107, 16, 7, 7]
        ]);
        for (const side of [-1, 1]) {
            b.plate(
                this.edge,
                [
                    [side * 10, -94],
                    [side * 39, -38],
                    [side * 39, 50],
                    [side * 20, 91]
                ],
                17,
                20
            );
            b.box(this.energy, [side * 29, 21, 10], [1.1, 1, 92]);
            for (let z = -50; z < 80; z += 16) {
                b.box(this.trim, [side * 33, 14, z], [9, 7, 3]);
                b.box(this.hot, [side * 38, 10, z], [0.5, 1.2, 5]);
            }
            b.box(this.edge, [side * 39, -5, -35], [18, 12, 52], [0, side * 18, 0]);
        }
        b.hull(this.edge, [
            [4, 13, 23, 4],
            [20, 19, 28, 8],
            [54, 17, 29, 10],
            [68, 9, 24, 4]
        ]);
        b.box(this.trim, [0, 41, 42], [19, 8, 27]);
        b.box(this.energy, [0, 43, 27.8], [16, 1.4, 1]);
        for (let z = -75; z < 75; z += 20) b.box(this.trim, [0, 26, z], [11, 4, 5]);
        this.body = b.finish(device, 'Dreadnought central citadel');
        this.root.addChild(this.body);
        for (const side of [-1, 1]) {
            const wing = new ModelBuilder();
            wing.plate(
                this.armor,
                [
                    [side * 32, -37],
                    [side * 78, -73],
                    [side * 94, -31],
                    [side * 88, 66],
                    [side * 56, 93],
                    [side * 36, 37]
                ],
                -7,
                7
            );
            wing.plate(
                this.trim,
                [
                    [side * 44, -29],
                    [side * 77, -58],
                    [side * 84, -27],
                    [side * 80, 53],
                    [side * 56, 75],
                    [side * 44, 29]
                ],
                7,
                11
            );
            wing.box(this.energy, [side * 77, 12, 3], [1.4, 0.8, 85]);
            for (let z = -24; z < 64; z += 17) {
                wing.box(this.edge, [side * 69, 12, z], [25, 5, 4]);
                wing.box(this.trim, [side * 84, 0, z], [5, 12, 7]);
            }
            const w = wing.finish(device, side < 0 ? 'Port armored outrigger' : 'Starboard armored outrigger');
            this.root.addChild(w);
            this.wings.push(w);
            const engine = new ModelBuilder();
            engine.hull(this.edge, [
                [48, 14, 0, 11],
                [72, 19, 0, 16],
                [108, 20, 0, 18],
                [126, 16, 0, 14]
            ]);
            for (const x of [-8, 8]) {
                engine.cylinder(this.trim, [x, 0, 124], [14, 12, 14]);
                engine.cylinder(this.energy, [x, 0, 131], [10, 1, 10]);
            }
            for (let z = 65; z < 120; z += 12) engine.box(this.trim, [0, 17, z], [38, 3, 3]);
            const e = engine.finish(device, 'Capital engine assembly');
            e.setLocalPosition(side * 60, -2, 0);
            this.root.addChild(e);
            this.engines.push(e);
            const flame = new ModelBuilder();
            flame.cylinder(this.plume, [0, 0, 0], [22, 1, 22]);
            const f = flame.finish(device, 'Capital exhaust');
            f.setLocalPosition(side * 60, -2, 143);
            this.root.addChild(f);
            this.exhaust.push(f);
            for (let j = 0; j < 3; j++) {
                const vane = new ModelBuilder();
                vane.box(this.edge, [0, 0, 0], [3, 21, 14]);
                vane.box(this.energy, [0, 0, -7.2], [2, 13, 0.4]);
                const v = vane.finish(device, 'Radiator vane');
                v.setLocalPosition(side * 44, 16, 25 + j * 19);
                this.root.addChild(v);
                this.vanes.push(v);
            }
        }
        const sphere = new SphereGeometry({ latitudeBands: 8, longitudeBands: 12 });
        for (let i = 0; i < boss.parts.length; i++) {
            const part = boss.parts[i],
                r = part.radius,
                m = new ModelBuilder();
            m.cylinder(this.trim, [0, 0, 2], [r * 2.5, 8, r * 2.5]);
            m.cylinder(this.edge, [0, 0, 0], [r * 2.1, 3, r * 2.1]);
            if (i < 4) {
                m.hull(this.armor, [
                    [-6, r * 0.7, 0, r * 0.5],
                    [0, r * 0.9, 0, r * 0.65],
                    [5, r * 0.8, 0, r * 0.5]
                ]);
                for (const side of [-1, 1]) m.box(this.trim, [side * r * 0.55, 0, -6], [r * 0.3, r * 0.35, 12]);
            } else {
                m.box(this.armor, [0, r * 0.85, 0], [r * 1.9, 2, 9]);
                m.box(this.armor, [0, -r * 0.85, 0], [r * 1.9, 2, 9]);
            }
            const e = m.finish(device, part.label);
            e.setLocalPosition(part.local);
            this.root.addChild(e);
            this.parts.push(e);
            const core = new ModelBuilder();
            core.geometry(this.locked, sphere, [0, 0, -7], [r * 1.3, r * 1.3, 3]);
            const c = core.finish(device, 'Component energy aperture');
            e.addChild(c);
            this.cores.push(c);
            const cue = new ModelBuilder();
            cue.cylinder(this.charge, [0, 0, -9], [r * 1.8, 0.3, r * 1.8]);
            const q = cue.finish(device, 'Component attack corona');
            e.addChild(q);
            this.cues.push(q);
        }
        for (let i = 0; i < 2; i++) {
            const e = new Entity('Capital firing solution');
            e.addComponent('render', { type: 'box', material: this.line });
            app.root.addChild(e);
            e.enabled = false;
            this.beams.push(e);
        }
        validateRenderAttributes(this.root);
        this.root.enabled = false;
    }
    render(boss: Boss, alpha: number) {
        this.root.enabled = boss.active || boss.dying > 0;
        for (const e of this.beams) e.enabled = boss.active && !boss.arriving && boss.charge > 0;
        if (!this.root.enabled) return;
        this.position.lerp(boss.previous, boss.position, alpha);
        this.rotation.slerp(boss.previousRotation, boss.rotation, alpha);
        const dying = !boss.active && boss.dying > 0,
            age = dying ? boss.deathAge : 0,
            final = age >= SPECTACLE.boss.beats[SPECTACLE.boss.finalBeat];
        if (dying) {
            this.tumble.setFromEulerAngles(age * 2, 0, age * 3);
            this.rotation.mul(this.tumble);
        }
        this.root.setPosition(this.position);
        this.root.setRotation(this.rotation);
        this.root.setLocalScale(1, 1, 1);
        this.body.enabled = !final;
        for (let i = 0; i < 2; i++) {
            const side = i === 0 ? -1 : 1,
                w = this.wings[i];
            w.setLocalPosition(dying ? side * age * 5 : 0, dying ? -age * 2 : 0, dying ? age * 3 : 0);
            w.setLocalEulerAngles(0, dying ? side * age * 5 : 0, 0);
            const scale = final ? Math.max(0.05, boss.dying / 1.6) : 1;
            w.setLocalScale(scale, scale, scale);
            for (const mi of w.render!.meshInstances)
                if (mi.material !== this.trim && mi.material !== this.energy)
                    mi.material = boss.phase > i + 1 || dying ? this.scar : this.armor;
            this.engines[i].enabled = !final;
            this.exhaust[i].enabled = !final;
            this.exhaust[i].setLocalScale(
                1 + (boss.phase === 3 ? 0.2 : 0),
                1,
                boss.arriving ? 80 : dying ? 15 + age * 5 : 12 + Math.sin(boss.age * 6) * 2
            );
        }
        for (let i = 0; i < this.vanes.length; i++) {
            this.vanes[i].enabled = !final;
            this.vanes[i].setLocalEulerAngles(Math.sin(boss.age * 0.8 + i) * 12, 0, boss.phase === 3 ? 20 : 0);
        }
        const bank = boss.firingBank;
        for (let i = 0; i < this.parts.length; i++) {
            const p = boss.parts[i];
            this.parts[i].enabled = p.active;
            for (const mi of this.cores[i].render!.meshInstances)
                mi.material = p.targetable ? (i === 6 ? this.hot : this.exposed) : this.locked;
            this.cues[i].enabled =
                boss.charge > 0 &&
                (boss.phase === 1 ? i < 4 && i % 2 === bank : boss.phase === 2 ? i === 4 || i === 5 : i === 6);
            const pulse = 1 + Math.sin(boss.age * 22) * 0.1;
            this.cues[i].setLocalScale(pulse, pulse, pulse);
        }
        for (let i = 0; i < this.beams.length; i++)
            if (this.beams[i].enabled) {
                const origin =
                    boss.phase === 2
                        ? i === 0
                            ? boss.batteryA
                            : boss.batteryB
                        : boss.parts[boss.phase === 1 ? (boss.parts[bank].active ? bank : bank + 2) : 6].position;
                this.position.lerp(origin, boss.aim, 0.5);
                this.beams[i].setPosition(this.position);
                this.beams[i].lookAt(boss.aim);
                this.beams[i].setLocalScale(0.22, 0.22, origin.distance(boss.aim));
                if (boss.phase !== 2 && i === 1) this.beams[i].enabled = false;
            }
    }
    destroy() {
        for (const e of this.beams) e.destroy();
        for (const render of this.root.findComponents('render'))
            for (const mi of (render as RenderComponent).meshInstances) mi.mesh?.destroy();
        this.root.destroy();
        for (const m of [
            this.armor,
            this.trim,
            this.edge,
            this.scar,
            this.energy,
            this.exposed,
            this.locked,
            this.charge,
            this.hot,
            this.plume,
            this.line
        ])
            m.destroy();
    }
}
