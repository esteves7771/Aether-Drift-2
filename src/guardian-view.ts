import { Entity, Quat, SphereGeometry, Vec3, calculateNormals } from 'playcanvas';
import type { AppBase, RenderComponent } from 'playcanvas';

import { emission, ModelBuilder, surface, validateRenderAttributes } from './art-kit';
import type { Guardian } from './guardian';
import { GUARDIAN } from './guardian-config';

export class GuardianView {
    readonly root = new Entity('Fortress Guardian');
    private readonly sections: Entity[] = [];
    private readonly turrets: Entity[] = [];
    private readonly rock: Entity;
    private readonly armor = surface('Fortress titanium armor', '#768497', 0.7, 0.65);
    private readonly dark = surface('Fortress obsidian regolith', '#303541', 0, 0.2);
    private readonly metal = surface('Fortress gunmetal', '#253c4a', 0.65, 0.7);
    private readonly power = emission('Fortress energy conduits', '#ffad5b', 2);
    private readonly reactor = emission('Fortress unstable reactor', '#a5ffee', 2.5);
    private readonly rotation = new Quat();
    private readonly point = new Vec3();
    private readonly aim = new Entity('Guardian aim transform');
    private readonly warning: Entity;
    constructor(app: AppBase) {
        app.root.addChild(this.root);
        const asteroid = new ModelBuilder();
        const regolith = new SphereGeometry({ radius: GUARDIAN.hullRadius, latitudeBands: 16, longitudeBands: 24 });
        for (let i = 0; i < regolith.positions.length; i += 3) {
            const x = regolith.positions[i] / GUARDIAN.hullRadius,
                y = regolith.positions[i + 1] / GUARDIAN.hullRadius,
                z = regolith.positions[i + 2] / GUARDIAN.hullRadius;
            const rough = 0.92 + 0.045 * Math.sin(x * 7 + z * 8) + 0.025 * Math.sin(y * 12 - x * 9);
            regolith.positions[i] *= rough;
            regolith.positions[i + 1] *= rough;
            regolith.positions[i + 2] *= rough;
        }
        regolith.normals = calculateNormals(regolith.positions, regolith.indices);
        asteroid.geometry(this.dark, regolith, [0, 0, 0], [1, 0.95, 1]);
        for (const side of [-1, 1]) {
            asteroid.box(this.metal, [side * 70, 0, 0], [26, 100, 120], [0, 0, side * 15]);
            asteroid.box(this.armor, [side * 88, 0, -10], [12, 65, 115]);
            for (let i = 0; i < 4; i++) asteroid.box(this.power, [side * 95, -23 + i * 15, -10], [0.8, 2, 95]);
        }
        asteroid.box(this.metal, [0, 0, -80], [100, 90, 16]);
        asteroid.box(this.armor, [0, 57, 0], [98, 16, 80]);
        asteroid.box(this.armor, [0, -60, 0], [85, 14, 90]);
        this.rock = asteroid.finish(app.graphicsDevice, 'Massive armored asteroid core');
        this.root.addChild(this.rock);
        for (let i = 0; i < 7; i++) {
            const p = GUARDIAN.parts[i],
                b = new ModelBuilder();
            if (i < 4) {
                const side = p[0] < 0 ? -1 : 1;
                b.box(this.metal, [p[0] - side * 15, p[1], p[2]], [40, 12, 40]);
                b.box(this.armor, [p[0], p[1] - 4, p[2]], [28, 10, 32]);
                for (let fin = 0; fin < 3; fin++)
                    b.box(this.armor, [p[0] + side * 12, p[1] + fin * 4, p[2] + 8], [4, 2, 25]);
            } else if (i < 6) {
                b.cylinder(this.metal, [...p], [28, 22, 28]);
                b.cylinder(this.power, [p[0], p[1], p[2] - 13], [18, 3, 18]);
                for (const side of [-1, 1]) b.box(this.armor, [p[0] + side * 13, p[1], p[2]], [4, 27, 30]);
            } else {
                b.cylinder(this.metal, [...p], [48, 25, 48]);
                b.cylinder(this.reactor, [p[0], p[1], p[2] - 13], [30, 3, 30]);
                b.geometry(
                    this.reactor,
                    new SphereGeometry({ radius: 15, latitudeBands: 10, longitudeBands: 16 }),
                    [...p],
                    [1, 1, 1]
                );
                for (let j = 0; j < 4; j++)
                    b.box(
                        this.armor,
                        [Math.sin((j * Math.PI) / 2) * 27, Math.cos((j * Math.PI) / 2) * 27, -104],
                        [12, 12, 20],
                        [0, 0, j * 90]
                    );
            }
            const e = b.finish(app.graphicsDevice, 'Guardian destructible section ' + i);
            this.root.addChild(e);
            this.sections.push(e);
            if (i < 4) {
                const gun = new ModelBuilder();
                gun.box(this.armor, [0, 0, 0], [20, 13, 21]);
                for (const side of [-1, 1]) {
                    gun.cylinder(this.metal, [side * 5, 1, -15], [5, 24, 5]);
                    gun.cylinder(this.power, [side * 5, 1, -27.5], [3, 0.6, 3]);
                }
                const t = gun.finish(app.graphicsDevice, 'Guardian rotating weapon tower');
                app.root.addChild(t);
                this.turrets.push(t);
            }
        }
        const w = new ModelBuilder();
        w.box(this.power, [0, 0, -0.5], [0.35, 0.35, 1]);
        this.warning = w.finish(app.graphicsDevice, 'Guardian locked attack warning');
        app.root.addChild(this.warning);
        this.warning.enabled = false;
        validateRenderAttributes(this.root);
        this.root.enabled = false;
    }
    render(b: Guardian, alpha: number, player: Vec3) {
        this.root.enabled = b.active || b.dying > 0;
        this.warning.enabled = b.active && b.charge > 0;
        this.turrets.forEach((t) => (t.enabled = this.root.enabled));
        if (!this.root.enabled) return;
        this.root.setPosition(b.position);
        this.rotation.slerp(b.previousRotation, b.rotation, alpha);
        this.root.setRotation(this.rotation);
        const death = b.dying > 0 ? b.deathAge : 0;
        GuardianView.critical[1] = 3.5 + Math.sin(b.age * 15) * 0.7;
        this.rock.enabled = death < 4.8;
        for (let i = 0; i < 7; i++) {
            const p = b.parts[i],
                e = this.sections[i];
            if (i === 6)
                for (const mi of e.render!.meshInstances) if (mi.material === this.metal) mi.visible = b.phase !== 3;
            e.enabled = (p.active || death > 0) && death < 4.8;
            if (i < 4) {
                const t = this.turrets[i];
                t.enabled = p.active && death < 4.8;
                this.point.lerp(p.previous, p.position, alpha);
                t.setPosition(this.point);
                this.aim.setPosition(this.point);
                this.aim.lookAt(player);
                t.setRotation(this.aim.getRotation());
            }
            for (const mi of e.render!.meshInstances)
                if (mi.material === this.power || mi.material === this.reactor)
                    mi.setParameter(
                        'material_emissive',
                        p.targetable ? (b.phase === 3 ? GuardianView.critical : GuardianView.live) : GuardianView.dim
                    );
            if (death > 0) {
                const side = i % 2 ? 1 : -1;
                e.setLocalPosition(side * death * 5, death * (i - 3), 0);
                e.setLocalEulerAngles(death * i * 8, death * side * 10, death * side * 6);
            } else {
                e.setLocalPosition(0, 0, 0);
                e.setLocalEulerAngles(0, 0, 0);
            }
        }
        if (this.warning.enabled) {
            this.warning.setPosition(b.warningOrigin);
            this.warning.lookAt(b.aim);
            this.warning.setLocalScale(1, 1, b.warningOrigin.distance(b.aim));
        }
    }
    private static readonly dim = new Float32Array([0.12, 0.04, 0.015]);
    private static readonly live = new Float32Array([3, 1.2, 0.2]);
    private static readonly critical = new Float32Array([1.2, 4, 3.5]);
    destroy() {
        const roots = [this.root, this.warning, ...this.turrets];
        const meshes = new Set(
            roots.flatMap((r) =>
                r.findComponents('render').flatMap((c) => (c as RenderComponent).meshInstances.map((mi) => mi.mesh))
            )
        );
        for (const r of roots) r.destroy();
        for (const mesh of meshes) mesh?.destroy();
        for (const m of [this.armor, this.dark, this.metal, this.power, this.reactor]) m.destroy();
        this.aim.destroy();
    }
}
