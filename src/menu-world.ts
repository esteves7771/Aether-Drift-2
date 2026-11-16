import { Entity, Vec3 } from 'playcanvas';
import type { AppBase, Quat, RenderComponent, AnimComponent } from 'playcanvas';

import { ModelBuilder } from './art-kit';
import { AsteroidField } from './asteroid-art';
import type { GraphicsQuality } from './config';
import type { ModelLibrary } from './model-library';
import type { buildScene } from './scene';
import { ShipInspection } from './ship-inspection';

const SATELLITES = [
    [-6, 9, -35],
    [10, -12, -28],
    [4, 6, -95],
    [25, 10, -145]
] as const;

/** Cinematic decoration only: no colliders, targets, AI or changes to world locations. */
export class MenuWorld {
    readonly inspection = new ShipInspection();
    readonly root = new Entity('Command deck scenery');
    private readonly field: AsteroidField;
    private readonly satellites: Entity[] = [];
    private readonly traffic: Entity[] = [];
    private readonly scene: ReturnType<typeof buildScene>;
    private readonly planetPosition: Vec3;
    private readonly atmospherePosition: Vec3;
    private readonly atmosphereScale: Vec3;
    private readonly atmosphereRotation: Quat;
    private time = 0;
    private visible = false;
    private closed = false;
    private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    private quality: GraphicsQuality = 'medium';
    private readonly beacon: Entity;
    private readonly beacons: Entity[] = [];
    private viewDistance = 11.8;
    private astronaut?: Entity;
    private astronautAnimations: AnimComponent[] = [];
    constructor(app: AppBase, library: ModelLibrary, scene: ReturnType<typeof buildScene>) {
        this.scene = scene;
        this.planetPosition = scene.planet.getPosition().clone();
        this.atmospherePosition = scene.planetAtmosphere.getPosition().clone();
        this.atmosphereScale = scene.planetAtmosphere.getLocalScale().clone();
        this.atmosphereRotation = scene.planetAtmosphere.getRotation().clone();
        app.root.addChild(this.root);
        const lamp = new ModelBuilder();
        lamp.box(scene.art.cyan, [0, 0.7, 0], [0.16, 0.16, 0.16]);
        lamp.box(scene.art.hostile, [0, -0.7, 0], [0.12, 0.12, 0.12]);
        this.beacon = lamp.finish(app.graphicsDevice, 'Satellite signal lights');
        const rocks = Array.from({ length: 72 }, (_, i) => {
            const z = -18 - ((i * 73) % 430),
                x = -75 + ((i * 41) % 180),
                y = -65 + ((i * 37) % 120);
            return { position: new Vec3(x, y, z), radius: 1.2 + (i % 5) * 1.2 };
        });
        rocks.push(
            { position: new Vec3(-5, -8, -9), radius: 4.3 },
            { position: new Vec3(18, -2, -20), radius: 3.4 },
            { position: new Vec3(-15, 16, -22), radius: 5.2 }
        );
        this.field = new AsteroidField(app, rocks, scene.rockMeshes, scene.rockMaterials);
        this.root.addChild(this.field.root);
        for (let i = 0; i < 4; i++) {
            const root = scene.art.create('player');
            root.name = 'Menu patrol ' + i;
            root.setLocalScale(0.22, 0.22, 0.22);
            this.root.addChild(root);
            this.traffic.push(root);
        }
        void library.load('satellite').then((ok) => {
            if (!ok || this.closed) return;
            for (let i = 0; i < 4; i++) {
                const root = library.create('satellite')!;
                root.name = 'Menu satellite ' + i;
                const size = i === 1 ? 0.9 : i === 0 ? 0.8 : 0.5;
                root.setLocalScale(size, size, size);
                this.root.addChild(root);
                const beacon = this.beacon.clone();
                root.addChild(beacon);
                this.beacons.push(beacon);
                this.satellites.push(root);
            }
            this.setQuality(this.quality);
        });
        void library.load('station').then((ok) => {
            if (!ok || this.closed) return;
            const station = library.create('station')!;
            station.name = 'Menu Kepler orbital';
            station.setLocalScale(0.17, 0.17, 0.17);
            station.setLocalPosition(24, 18, -90);
            station.setLocalEulerAngles(65, -12, 10);
            this.root.addChild(station);
        });
        void library.load('astronaut').then((ok) => {
            if (!ok || this.closed) return;
            const e = library.create('astronaut')!;
            e.name = 'Menu floating astronaut';
            e.setLocalPosition(10, -2, -12);
            e.setLocalEulerAngles(12, -25, -15);
            this.root.addChild(e);
            library.animate(e, 'astronaut');
            this.astronaut = e;
            this.astronautAnimations = e.findComponents('anim') as AnimComponent[];
        });
        this.root.enabled = false;
    }
    setQuality(q: GraphicsQuality) {
        this.quality = q;
        this.field.setQuality(q);
        this.satellites.forEach((e, i) => (e.enabled = q !== 'low' || i < 3));
        this.traffic.forEach((e, i) => (e.enabled = q !== 'low' || i < 2));
    }
    update(show: boolean, dt: number, camera: Entity, selected: 'classic' | 'surveyor' | 'ptah' = 'classic') {
        this.inspection.update(show && document.getElementById('menu')?.dataset.screen === 'home', dt, selected);
        if (show !== this.visible) {
            if (!show) this.scene.ship.setLocalScale(1, 1, 1);
            this.visible = show;
            this.root.enabled = show;
            this.scene.asteroidField.root.enabled = !show;
            if (show) {
                this.scene.planet.setPosition(2250, 450, -3200);
                this.scene.planetAtmosphere.setPosition(2250, 450, -3200);
            } else {
                this.scene.planet.setPosition(this.planetPosition);
                this.scene.planetAtmosphere.setPosition(this.atmospherePosition);
                this.scene.planetAtmosphere.setLocalScale(this.atmosphereScale);
                this.scene.planetAtmosphere.setRotation(this.atmosphereRotation);
            }
        }
        if (!show) return;
        if (!this.reduced) this.time += Math.min(dt, 0.05);
        const t = this.time,
            aspect = appAspect(camera);
        this.scene.ship.setPosition(0, Math.sin(t * 0.4) * 0.14, 0);
        this.scene.ship.setEulerAngles(-8 + this.inspection.state.pitch, 28 + this.inspection.state.yaw, -5);
        const zoom = this.inspection.state.zoom;
        this.scene.ship.setLocalScale(zoom, zoom, zoom);
        this.viewDistance += ((selected === 'surveyor' ? 10.8 : 11.8) - this.viewDistance) * (1 - Math.exp(-dt * 4));
        camera.setPosition(0, 2, this.viewDistance);
        camera.lookAt(-Math.min(5.5, aspect * 1.9), 0, 0);
        this.scene.planetAtmosphere.lookAt(camera.getPosition());
        this.satellites.forEach((e, i) => {
            const [x, y, z] = SATELLITES[i];
            e.setLocalPosition(x + Math.sin(t * 0.055 + i) * 1.2, y + Math.cos(t * 0.08 + i) * 0.6, z);
            e.setLocalEulerAngles(12 + Math.sin(t * 0.04 + i) * 6, 8 + i * 8 + t * 0.3, i * 18 - 20);
            this.beacons[i].enabled = this.reduced || Math.sin(t * 1.6 + i * 2) > -0.35;
        });
        this.traffic.forEach((e, i) => {
            e.setLocalPosition(-13 + ((t * 0.45 + i * 17) % 62), 9 - i * 3, -48 - i * 24);
            e.setLocalEulerAngles(-3, -65, -5);
        });
        if (this.astronaut) {
            this.astronaut.setLocalPosition(10 + Math.sin(t * 0.13) * 0.3, -2 + Math.sin(t * 0.2) * 0.2, -12);
            this.astronaut.setLocalEulerAngles(
                12 + Math.sin(t * 0.11) * 4,
                -25 + t * 0.6,
                -15 + Math.sin(t * 0.15) * 5
            );
            for (const a of this.astronautAnimations) a.speed = dt > 0 ? 1 : 0;
        }
        this.field.update(Vec3.ZERO, dt);
    }
    destroy() {
        this.inspection.destroy();
        this.closed = true;
        this.field.destroy();
        this.root.destroy();
        for (const c of this.beacon.findComponents('render'))
            for (const mi of (c as RenderComponent).meshInstances) mi.mesh?.destroy();
        this.beacon.destroy();
    }
}
function appAspect(camera: Entity) {
    return camera.camera?.aspectRatio || innerWidth / innerHeight;
}
