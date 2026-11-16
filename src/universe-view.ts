import { Entity, Mesh, MeshInstance, Vec3 } from 'playcanvas';
import type { AppBase, RenderComponent, MeshInstance as MeshInstanceType } from 'playcanvas';

import { emission, ModelBuilder } from './art-kit';
import type { Combat } from './combat';
import type { GraphicsQuality } from './config';
import { ConvoyView } from './convoy-view';
import { Convoys } from './convoys';
import type { ModelLibrary } from './model-library';
import type { SpacecraftArt } from './spacecraft-art';
import { Universe, AmbientTraffic } from './universe';
import { UNIVERSE } from './universe-config';

/** Bounded visual pool. Imported satellite containers share meshes, materials and their small atlas. */
export class UniverseView {
    readonly root = new Entity('Living frontier / noncombat');
    readonly world: Universe;
    readonly traffic: AmbientTraffic;
    readonly convoys: Convoys;
    private readonly convoyView: ConvoyView;
    readonly satellites: { root: Entity; id: number; lamp: Entity; instances: MeshInstanceType[] }[] = [];
    readonly ships: { root: Entity; exhaust: Entity; trail: Entity }[] = [];
    private quality = 1;
    private requested = false;
    private closed = false;
    private sample = 0;
    private readonly point = new Vec3();
    private readonly right = new Vec3();
    private readonly up = new Vec3();
    private readonly positions = new Float32Array(50 * 9);
    private readonly colors = new Float32Array(50 * 12);
    private readonly signalMesh: Mesh;
    private readonly signals = new Entity('Distant satellite signals');
    private readonly light = emission('Satellite navigation / soft cyan', '#a3e4e6', 1.3);
    private readonly signal = emission('Distant satellite glints', '#ffffff', 0.8);
    private readonly engine = emission('Civilian ion exhaust', '#76d8ff', 2.2);
    private readonly trailMaterial = emission('Brief courier exhaust', '#426caa', 0.7, 0.25);
    private readonly library: ModelLibrary;
    private readonly combat: Combat;
    private lampTemplate?: Entity;
    private readonly ownMeshes = new Set<Mesh>();
    constructor(app: AppBase, library: ModelLibrary, combat: Combat, art: SpacecraftArt) {
        this.library = library;
        this.combat = combat;
        this.world = new Universe(combat.frontier, combat.rocks);
        this.traffic = new AmbientTraffic(this.world, combat.frontier);
        this.convoys = new Convoys(
            this.world.obstacles,
            combat.frontier.locations.filter((l) => l.model).map((l) => l.position)
        );
        this.convoyView = new ConvoyView(app, library, this.convoys);
        this.convoyView.root.reparent(this.root);
        const arrivalLandmarks = this.world.obstacles
            .slice(combat.rocks.length)
            .map((r) => ({ position: r.position, radius: r.radius + 35 }));
        combat.dreadnought.arrival.obstacles = [
            ...arrivalLandmarks,
            ...combat.frontier.bases.map((b) => ({ position: b.rock.position, radius: b.rock.radius + 45 })),
            ...this.world.satellites.map((s) => ({ position: s.position, radius: s.kind === 'orbit' ? 70 : 20 })),
            ...combat.enemies,
            ...this.convoys.exclusions
        ];
        combat.dreadnought.avoidance = [
            ...arrivalLandmarks,
            ...combat.frontier.bases.map((b) => ({ position: b.rock.position, radius: b.rock.radius + 45 }))
        ];
        combat.spawnObstacles = combat.dreadnought.avoidance;
        combat.dreadnought.patterns.obstacles = combat.dreadnought.avoidance;
        const traffic = this.traffic;
        combat.dreadnought.arrival.transit = {
            start: traffic.start,
            end: traffic.end,
            get active() {
                return traffic.active;
            }
        };
        for (const b of [combat.phantom, combat.guardian]) {
            b.arrival.obstacles = combat.dreadnought.arrival.obstacles;
            b.arrival.transit = combat.dreadnought.arrival.transit;
            b.avoidance = combat.dreadnought.avoidance;
            b.patterns.obstacles = b.avoidance;
        }
        app.root.addChild(this.root);
        this.signal.emissiveVertexColor = true;
        this.signal.update();
        this.signalMesh = new Mesh(app.graphicsDevice);
        this.signalMesh.setPositions(this.positions);
        this.signalMesh.setColors(this.colors);
        this.signalMesh.update();
        this.signals.addComponent('render', {
            meshInstances: [new MeshInstance(this.signalMesh, this.signal, this.signals)]
        });
        this.root.addChild(this.signals);
        const lamp = new ModelBuilder();
        lamp.box(this.light, [0, 1, 0], [0.18, 0.18, 0.18]);
        this.lampTemplate = lamp.finish(app.graphicsDevice, 'Satellite signal');
        for (const mi of this.lampTemplate.render!.meshInstances) if (mi.mesh) this.ownMeshes.add(mi.mesh);
        for (let i = 0; i < UNIVERSE.traffic.capacity; i++) {
            const root = new Entity('Ambient spacecraft ' + i);
            root.addChild(art.create(i === 0 ? 'player' : 'heavy'));
            root.setLocalScale(2, 2, 2);
            const exhaust = new Entity('Civilian engine glow');
            exhaust.addComponent('render', { type: 'sphere', material: this.engine });
            exhaust.setLocalPosition(0, 0, 2.5);
            exhaust.setLocalScale(0.65, 0.5, 1.6);
            root.addChild(exhaust);
            const trail = new Entity('Brief civilian engine trail');
            trail.addComponent('render', { type: 'cone', material: this.trailMaterial });
            trail.setLocalEulerAngles(-90, 0, 0);
            root.addChild(trail);
            this.root.addChild(root);
            root.enabled = false;
            this.ships.push({ root, exhaust, trail });
        }
        this.root.enabled = false;
    }
    setQuality(q: GraphicsQuality) {
        this.quality = q === 'low' ? 0 : q === 'medium' ? 1 : 2;
        this.convoyView.setQuality(q);
    }
    get visibleSatellites() {
        return this.satellites.filter((s) => s.root.enabled).length;
    }
    reset() {
        this.convoys.reset(Date.now() >>> 0);
        this.world.reset();
        this.traffic.reset();
        this.sample = 1;
        for (const s of this.satellites) {
            s.id = -1;
            s.root.enabled = false;
        }
        for (const s of this.ships) s.root.enabled = false;
    }
    render(started: boolean, dt: number, player: Vec3, camera: Entity) {
        this.root.enabled = started;
        if (!started) return;
        this.world.step(dt);
        this.convoys.step(dt, player, this.combat.ship.rotation, this.combat.boss.active || this.traffic.active);
        this.convoyView.render(dt, player, started);
        this.traffic.step(
            dt,
            player,
            this.combat.boss.active || this.convoys.groups.some((g) => g.active),
            this.combat.ship.rotation
        ); // All boss encounters get uninterrupted presentation.
        if (!this.requested) {
            this.requested = true;
            void this.library.load('satellite').then((ok) => {
                if (!ok || this.closed) return;
                for (let i = 0; i < UNIVERSE.satellite.full[2]; i++) {
                    const root = this.library.create('satellite')!,
                        lamp = this.lampTemplate!.clone();
                    root.name = 'Gameplay satellite pool ' + i;
                    root.addChild(lamp);
                    root.enabled = false;
                    this.root.addChild(root);
                    this.satellites.push({
                        root,
                        id: -1,
                        lamp,
                        instances: (root.findComponents('render') as RenderComponent[]).flatMap((c) => c.meshInstances)
                    });
                }
            });
        }
        const max = UNIVERSE.satellite.full[this.quality],
            range = UNIVERSE.satellite.range[this.quality];
        this.sample += dt;
        if (this.sample >= UNIVERSE.satellite.sampleStep) {
            this.sample = 0;
            // Stable slots with range hysteresis. No sort or transient arrays in the update loop.
            for (let i = 0; i < this.satellites.length; i++) {
                const slot = this.satellites[i];
                if (
                    i >= max ||
                    (slot.id >= 0 && this.world.satellites[slot.id].position.distance(player) > range + 80)
                ) {
                    slot.id = -1;
                    slot.root.enabled = false;
                }
            }
            for (const s of this.world.satellites) {
                if (s.position.distance(player) > range || this.satellites.some((p) => p.id === s.id)) continue;
                let free = -1;
                for (let i = 0; i < Math.min(max, this.satellites.length); i++)
                    if (this.satellites[i].id < 0) {
                        free = i;
                        break;
                    }
                if (free < 0) {
                    let farthest = s.position.distance(player) + 100;
                    for (let i = 0; i < Math.min(max, this.satellites.length); i++) {
                        const distance = this.world.satellites[this.satellites[i].id].position.distance(player);
                        if (distance > farthest) {
                            farthest = distance;
                            free = i;
                        }
                    }
                }
                if (free < 0) continue;
                this.satellites[free].id = s.id;
            }
            camera.getRotation().transformVector(Vec3.RIGHT, this.right);
            camera.getRotation().transformVector(Vec3.UP, this.up);
            for (const s of this.world.satellites) {
                const d = s.position.distance(player),
                    visible = d < UNIVERSE.satellite.signalRange && d > range * 0.85 && s.kind !== 'abandoned';
                const strength = visible
                    ? Math.min(1, (d - range * 0.85) / 150) *
                      Math.min(1, (UNIVERSE.satellite.signalRange - d) / 250) *
                      (0.6 + 0.15 * Math.sin(this.world.time + s.id))
                    : 0;
                const size = Math.max(0.23, d * 0.00045);
                for (let v = 0; v < 3; v++) {
                    const a = v === 0 ? -1 : v === 1 ? 1 : 0,
                        b = v === 2 ? 1 : -0.6,
                        k = s.id * 9 + v * 3,
                        c = s.id * 12 + v * 4;
                    this.positions[k] = s.position.x + size * (this.right.x * a + this.up.x * b);
                    this.positions[k + 1] = s.position.y + size * (this.right.y * a + this.up.y * b);
                    this.positions[k + 2] = s.position.z + size * (this.right.z * a + this.up.z * b);
                    this.colors[c] = strength * 0.45;
                    this.colors[c + 1] = strength * 0.75;
                    this.colors[c + 2] = strength;
                    this.colors[c + 3] = 1;
                }
            }
            this.signalMesh.setPositions(this.positions);
            this.signalMesh.setColors(this.colors);
            this.signalMesh.update();
        }
        for (const slot of this.satellites) {
            if (slot.id < 0) continue;
            const s = this.world.satellites[slot.id];
            s.sample(this.world.time, this.point);
            slot.root.setPosition(this.point);
            const fade = Math.max(0.001, Math.min(1, (range + 80 - this.point.distance(player)) / 130));
            slot.root.setLocalScale(fade, fade, fade);
            slot.root.setLocalEulerAngles(
                s.id * 37 + (s.kind === 'static' ? 0 : this.world.time * (s.kind === 'abandoned' ? 1.1 : 0.28)),
                s.id * 71 + this.world.time * 0.5,
                s.id * 13
            );
            slot.lamp.enabled = s.kind !== 'abandoned' && Math.sin(this.world.time * 1.8 + s.id * 2.4) > 0.35;
            // Instance-local muted abandoned finish, leaving the shared PBR atlas untouched.
            for (const mi of slot.instances) {
                if (s.kind === 'abandoned') mi.setParameter('material_diffuse', MUTED);
                else mi.deleteParameter('material_diffuse');
            }
            slot.root.enabled = true;
        }
        for (let i = 0; i < this.ships.length; i++) {
            const s = this.ships[i];
            s.root.enabled = this.traffic.active && i < this.traffic.count && (this.quality > 0 || i === 0);
            if (!s.root.enabled) continue;
            s.root.setPosition(this.traffic.positions[i]);
            this.point.copy(this.traffic.positions[i]).add(this.traffic.direction);
            s.root.lookAt(this.point);
            const t = this.traffic.age / this.traffic.duration,
                fade = Math.min(1, t * 6, (1 - t) * 6);
            s.root.setLocalScale(2 * fade, 2 * fade, 2 * fade);
            const length = UNIVERSE.traffic.trail[this.quality] * (this.traffic.kind === 'courier' ? 1 : 0.35);
            s.trail.enabled = this.quality > 0 && t > 0.2 && t < 0.8;
            s.trail.setLocalScale(0.32, length, 0.32);
            s.trail.setLocalPosition(0, 0, 3 + length * 0.5);
        }
    }
    destroy() {
        this.convoyView.destroy();
        this.closed = true;
        this.root.destroy();
        this.lampTemplate?.destroy();
        this.signalMesh.destroy();
        for (const m of this.ownMeshes) m.destroy();
        for (const m of [this.light, this.signal, this.engine, this.trailMaterial]) m.destroy();
    }
}
const MUTED = new Float32Array([0.18, 0.22, 0.28]);
