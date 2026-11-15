import { Entity } from 'playcanvas';
import type { AppBase, RenderComponent } from 'playcanvas';

import { emission, ModelBuilder, surface } from './art-kit';
import type { GraphicsQuality } from './config';
import type { Flight } from './flight';
import type { Frontier } from './frontier';
import type { ModelKey } from './model-config';
import type { ModelLibrary } from './model-library';

export class ImportedLandmarks {
    readonly root = new Entity('Imported orbital landmarks');
    private readonly library: ModelLibrary;
    private readonly world: Frontier;
    private readonly sites: { key: ModelKey; index: number; root: Entity; fallback: Entity; requested: boolean }[] = [];
    private readonly cargos: Entity[] = [];
    private cargoRequested = false;
    private closed = false;
    private quality: GraphicsQuality = 'medium';
    private readonly steel = surface('Distant orbital silhouette', '#6d869a', 0.6, 0.6);
    private readonly lamps = emission('Orbital signal lamps', '#89ecdf', 1.5);
    constructor(app: AppBase, library: ModelLibrary, world: Frontier) {
        this.library = library;
        this.world = world;
        app.root.addChild(this.root);
        world.locations.forEach((l, index) => {
            if (!l.model) return;
            const root = new Entity(l.name),
                b = new ModelBuilder();
            root.setPosition(l.position);
            this.root.addChild(root);
            b.box(this.steel, [0, 0, 0], [75, 7, 7]);
            for (const side of [-1, 1]) {
                b.box(this.steel, [side * 26, 0, 0], [16, 2, 75]);
                b.box(this.lamps, [side * 26, 2, 0], [12, 0.4, 30]);
            }
            const fallback = b.finish(app.graphicsDevice, 'Orbital loading silhouette');
            root.addChild(fallback);
            this.sites.push({ key: l.model, index, root, fallback, requested: false });
        });
    }
    render(ship: Flight, started: boolean) {
        this.root.enabled = started;
        if (!started) return;
        for (const site of this.sites) {
            if (
                !site.requested &&
                (site.root.getPosition().distance(ship.position) < 1400 || this.world.selected === site.index)
            ) {
                site.requested = true;
                void this.library.load(site.key).then((ok) => {
                    if (!ok || this.closed) return;
                    const model = this.library.create(site.key)!;
                    site.root.addChild(model);
                    site.fallback.enabled = false;
                });
            }
        }
        if (
            !this.cargoRequested &&
            this.world.locations.some(
                (l, i) => l.kind === 'wreck' && (l.position.distance(ship.position) < 900 || i === this.world.selected)
            )
        ) {
            this.cargoRequested = true;
            void this.library.load('cargo').then((ok) => {
                if (!ok || this.closed) return;
                for (const l of this.world.locations)
                    if (l.kind === 'wreck')
                        for (const side of [-1, 1]) {
                            const e = this.library.create('cargo')!;
                            e.setPosition(l.position.x + side * 14, l.position.y - 1, l.position.z + 12);
                            e.setEulerAngles(0, side * 35, side * 12);
                            this.root.addChild(e);
                            this.cargos.push(e);
                        }
                this.setQuality(this.quality);
            });
        }
    }
    setQuality(level: GraphicsQuality) {
        this.quality = level;
        for (let i = 0; i < this.cargos.length; i++) this.cargos[i].enabled = level !== 'low' || i % 2 === 0;
    }
    destroy() {
        this.closed = true;
        const meshes = this.sites.flatMap((s) =>
            s.fallback
                .findComponents('render')
                .flatMap((c) => (c as RenderComponent).meshInstances.map((mi) => mi.mesh))
        );
        this.root.destroy();
        for (const mesh of meshes) mesh?.destroy();
        this.steel.destroy();
        this.lamps.destroy();
    }
}
