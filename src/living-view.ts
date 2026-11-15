import { Entity, Quat, Vec3 } from 'playcanvas';
import type { AnimComponent, AppBase, Mesh, MeshInstance, RenderComponent } from 'playcanvas';

import { emission, ModelBuilder } from './art-kit';
import type { Combat } from './combat';
import type { GraphicsQuality } from './config';
import type { FrontierView } from './frontier-view';
import { LIVING } from './living-config';
import type { ModelLibrary } from './model-library';
import { TesserView } from './tesser-view';

/** Bounded, demand-loaded environmental visuals. No combat targets for EVA characters. */
export class LivingView {
    readonly root = new Entity('Living space');
    private readonly bossView: TesserView;
    readonly astronauts: Entity[] = [];
    private readonly barrels: Entity[] = [];
    private readonly turrets: { root: Entity; base: Entity; flash: Entity; instances: MeshInstance[] }[] = [];
    private readonly warning = emission('Volatile cargo hazard light', '#ff491f', 3);
    private readonly tether = emission('EVA tether', '#8ba9a9', 0.3);
    private readonly position = new Vec3();
    private readonly rotation = new Quat();
    private readonly animations: AnimComponent[][] = [];
    private readonly ownedMeshes = new Set<Mesh>();
    private requestedCargo = false;
    private requestedTurret = false;
    private requestedEva = false;
    private closed = false;
    private quality: GraphicsQuality = 'medium';
    private app: AppBase;
    private library: ModelLibrary;
    private combat: Combat;
    private frontier: FrontierView;
    constructor(app: AppBase, library: ModelLibrary, combat: Combat, frontier: FrontierView) {
        this.bossView = new TesserView(app, library);
        this.app = app;
        this.library = library;
        this.combat = combat;
        this.frontier = frontier;
        app.root.addChild(this.root);
    }
    setQuality(q: GraphicsQuality) {
        this.quality = q;
    }
    render(started: boolean, dt: number, alpha: number) {
        this.root.enabled = started;
        this.bossView.render(this.combat, alpha, started);
        if (!started) return;
        const c = this.combat,
            player = c.ship.position;
        if (!this.requestedCargo && c.barrels.items.some((b) => b.position.distance(player) < LIVING.viewRange)) {
            this.requestedCargo = true;
            void this.library.load('cargo').then((ok) => {
                if (!ok || this.closed) return;
                const lamp = new ModelBuilder();
                lamp.box(this.warning, [0, 1.6, -1], [0.4, 0.4, 0.2]);
                const shared = lamp.finish(this.app.graphicsDevice, 'Cargo warning lamp');
                for (const mi of shared.render!.meshInstances) {
                    if (mi.mesh) this.ownedMeshes.add(mi.mesh);
                }
                for (const b of c.barrels.items) {
                    const e = this.library.create('cargo')!;
                    e.name = 'Explosive red barrel ' + b.id;
                    e.setPosition(b.position);
                    e.enabled = false;
                    e.setLocalScale(0.8, 0.8, 0.8);
                    e.addChild(shared.clone());
                    this.root.addChild(e);
                    this.barrels.push(e);
                }
                shared.destroy();
            });
        }
        if (!this.requestedTurret && c.frontier.bases.some((b) => b.rock.position.distance(player) < 1000)) {
            this.requestedTurret = true;
            void this.library.load('turret').then((ok) => {
                if (!ok || this.closed) return;
                for (let i = 0; i < this.frontier.weaponRoots.length; i++) {
                    const original = this.frontier.weaponRoots[i],
                        model = this.library.create('turret')!;
                    model.enabled = false;
                    this.root.addChild(model);
                    original.render!.enabled = false;
                    const authoredBase = model.findByName('base_Object008.005') as Entity;
                    const base = new Entity('Stationary rock mount');
                    if (authoredBase) {
                        authoredBase.parent!.addChild(base);
                        authoredBase.reparent(base);
                    }
                    const flash = new Entity('Imported turret muzzle');
                    flash.addComponent('render', { type: 'sphere', material: this.warning });
                    flash.setLocalPosition(0, 0, -7);
                    flash.setLocalScale(1.5, 1.5, 1.5);
                    model.addChild(flash);
                    const instances = model
                        .findComponents('render')
                        .flatMap((r) => (r as RenderComponent).meshInstances);
                    this.turrets.push({ root: model, base, flash, instances });
                }
            });
        }
        if (!this.requestedEva && c.frontier.locations.some((l) => l.model && l.position.distance(player) < 700)) {
            this.requestedEva = true;
            void this.library.load('astronaut').then((ok) => {
                if (!ok || this.closed) return;
                for (const l of c.frontier.locations)
                    if (l.model)
                        for (let i = 0; i < 2; i++) {
                            const e = this.library.create('astronaut')!;
                            e.name = 'Noncombat EVA ' + l.model + ' ' + i;
                            e.setPosition(
                                l.position.x + (l.model === 'iss' ? 20 : 65) + i * 5,
                                l.position.y + 8,
                                l.position.z - 12
                            );
                            this.root.addChild(e);
                            this.library.animate(e, 'astronaut');
                            this.astronauts.push(e);
                            this.animations.push(e.findComponents('anim') as AnimComponent[]);
                            const cable = new ModelBuilder();
                            cable.box(this.tether, [0, -3, 0], [0.025, 6, 0.025]);
                            cable.box(this.warning, [0.25, 0.2, 0.18], [0.08, 0.08, 0.08]);
                            const detail = cable.finish(this.app.graphicsDevice, 'EVA safety tether and light');
                            e.addChild(detail);
                            for (const mi of detail.render!.meshInstances) {
                                if (mi.mesh) this.ownedMeshes.add(mi.mesh);
                            }
                        }
            });
        }
        for (let i = 0; i < this.barrels.length; i++) {
            const e = this.barrels[i],
                b = c.barrels.items[i];
            e.enabled = b.active && b.position.distance(player) < LIVING.viewRange;
            if (!e.enabled) continue;
            e.setPosition(this.position.lerp(b.previous, b.position, alpha));
            e.setEulerAngles(b.age * 3 + i * 31, b.age * 2 + i * 63, b.age * 1.5);
        }
        let index = 0;
        for (const b of c.frontier.bases)
            for (let i = 1; i < 3; i++) {
                const t = this.turrets[index++],
                    p = b.parts[i];
                if (!t) continue;
                t.root.enabled = p.active && !b.destroyed && p.position.distance(player) < LIVING.viewRange;
                t.root.setPosition(p.position);
                t.root.setRotation(p.facing);
                // Base remains attached to the rock while the authored gun/head track independently.
                if (t.base) {
                    this.rotation.copy(p.facing).invert().mul(b.rotation);
                    t.base.setLocalRotation(this.rotation);
                }
                t.flash.enabled = p.muzzle > 0;
                for (const mi of t.instances)
                    if (p.flash > 0) mi.setParameter('material_emissive', LivingView.hit);
                    else if (p.charge > 0) mi.setParameter('material_emissive', LivingView.charge);
                    else mi.deleteParameter('material_emissive');
            }
        for (let i = 0; i < this.astronauts.length; i++) {
            const e = this.astronauts[i];
            e.enabled =
                e.getPosition().distance(player) < LIVING.astronautRange && (this.quality !== 'low' || i % 2 === 0);
            for (const a of this.animations[i]) {
                a.enabled = e.enabled;
                a.speed = dt > 0 ? 1 : 0;
            }
            // Engine animation updates use the real frame delta; zero speed freezes paused poses.
        }
    }
    private static readonly hit = new Float32Array([2, 2, 2]);
    private static readonly charge = new Float32Array([1.8, 0.35, 0.05]);
    destroy() {
        this.bossView.destroy();
        this.closed = true;
        this.root.destroy();
        for (const m of this.ownedMeshes) m.destroy();
        this.warning.destroy();
        this.tether.destroy();
    }
}
