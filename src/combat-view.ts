import { BoxGeometry, Entity, Mesh, MeshInstance, Quat, SphereGeometry, Vec3 } from 'playcanvas';
import type { AppBase, Texture } from 'playcanvas';

import { emission, surface, validateRenderAttributes } from './art-kit';
import type { Boss } from './boss';
import { BossView } from './boss-view';
import type { Combat } from './combat';
import { COMBAT } from './combat-config';
import type { CombatEvent } from './combat-config';
import type { GraphicsQuality } from './config';
import { EVOLUTION } from './evolution-config';
import type { BlastClass } from './explosion-config';
import { CinematicExplosions } from './explosions';
import { PRESETS } from './graphics';
import type { ImportedFleet } from './imported-fleet';
import { PhantomView } from './phantom-view';
import type { SpacecraftArt } from './spacecraft-art';
import { SPECTACLE } from './spectacle-config';
type EffectKind = 'ring' | 'flare' | 'spark' | 'trail' | 'emp';
class Effect {
    readonly position = new Vec3();
    readonly velocity = new Vec3();
    priority = 0;
    life = 0;
    duration = 0;
    size = 1;
    type: EffectKind = 'spark';
    readonly entity: Entity;
    constructor(entity: Entity) {
        this.entity = entity;
    }
}
export class CombatView {
    readonly explosions: CinematicExplosions;
    readonly root = new Entity('Combat');
    private readonly enemyRoots: Entity[] = [];
    get enemyVisualRoots(): readonly Entity[] {
        return this.enemyRoots;
    }
    importedFleet?: ImportedFleet;
    private readonly variants: Entity[][] = [];
    private readonly armor: MeshInstance[][] = [];
    private readonly bolts: Entity[] = [];
    private readonly missiles: Entity[] = [];
    private readonly bossView: BossView;
    private readonly phantomView: PhantomView;
    private readonly elite = surface('Elite gold armor', '#a98a48', 0.75, 0.7);
    private readonly effects: Effect[] = [];
    private readonly muzzles: Entity[] = [];
    private readonly mint = emission('Friendly laser core', '#89fff0', 3.5);
    private readonly red = emission('Hostile laser core', '#ff567e', 3.2);
    private readonly alien = emission('Alien violet laser core', '#bd8cff', 3.2);
    private readonly orange = emission('Metal sparks', '#ffb77b', 3, 0.8);
    private readonly white = emission('Muzzle plasma', '#c8faff', 4);
    private readonly glow = emission('Plasma scattering', '#70caff', 1.2, 0.45);
    private readonly flare = emission('Impact flare', '#ffc8a0', 3, 0.6);
    private readonly ring = emission('Shield shock front', '#5ec5ff', 1.3, 0.45);
    private readonly position = new Vec3();
    private readonly target = new Vec3();
    private readonly rotation = new Quat();
    private readonly art: SpacecraftArt;
    private readonly secondary = Array.from({ length: SPECTACLE.effects.secondaryCapacity }, () => ({
        delay: -1,
        position: new Vec3(),
        size: 1
    }));
    private readonly secondarySound: ((point: Vec3, size: number) => void) | undefined;
    private readonly sparkMesh: Mesh;
    private readonly debrisMesh: Mesh;
    private readonly quadMesh: Mesh;
    private readonly ringMesh: Mesh;
    private limit = 88;
    private serial = 0;
    private missileTrailTime = 0;
    private warmFrames = 4;
    private readonly warmup: Entity;
    constructor(
        app: AppBase,
        ship: Entity,
        art: SpacecraftArt,
        glowTexture: Texture,
        boss: Boss,
        secondarySound?: (point: Vec3, size: number) => void
    ) {
        this.art = art;
        this.explosions = new CinematicExplosions(app);
        this.secondarySound = secondarySound;
        this.bossView = new BossView(app, boss);
        this.phantomView = new PhantomView(app);
        const device = app.graphicsDevice;
        app.root.addChild(this.root);
        this.sparkMesh = Mesh.fromGeometry(device, new SphereGeometry({ latitudeBands: 6, longitudeBands: 8 }));
        this.debrisMesh = Mesh.fromGeometry(device, new BoxGeometry());
        this.quadMesh = new Mesh(device);
        this.quadMesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]);
        this.quadMesh.setUvs(0, [0, 0, 1, 0, 0, 1, 1, 1]);
        this.quadMesh.setIndices([0, 1, 2, 2, 1, 3]);
        this.quadMesh.update();
        const rp: number[] = [],
            ri: number[] = [];
        for (let i = 0; i < 48; i++) {
            const a = (i / 48) * Math.PI * 2,
                b = ((i + 1) / 48) * Math.PI * 2,
                base = rp.length / 3;
            for (const [r, t] of [
                [0.46, a],
                [0.5, a],
                [0.46, b],
                [0.5, b]
            ])
                rp.push(Math.cos(t) * r, Math.sin(t) * r, 0);
            ri.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
        this.ringMesh = new Mesh(device);
        this.ringMesh.setPositions(rp);
        this.ringMesh.setIndices(ri);
        this.ringMesh.update();
        for (const m of [this.glow, this.flare]) {
            m.emissiveMap = glowTexture;
            m.opacityMap = glowTexture;
            m.opacityMapChannel = 'a';
            m.update();
        }
        for (const side of [-1, 1]) {
            const e = new Entity('Cannon muzzle');
            e.addComponent('render', { meshInstances: [new MeshInstance(this.sparkMesh, this.white, e)] });
            e.setLocalPosition(side * 1.35, -0.12, -2.9);
            e.setLocalScale(0.45, 0.45, 1.0);
            e.enabled = false;
            ship.addChild(e);
            this.muzzles.push(e);
        }
        for (let i = 0; i < COMBAT.enemyCapacity; i++) {
            const root = new Entity(`Enemy ${i}`);
            this.root.addChild(root);
            this.enemyRoots.push(root);
            const variants: Entity[] = [],
                armor: MeshInstance[] = [];
            for (const kind of ['interceptor', 'heavy', 'bomber', 'carrier', 'drone'] as const) {
                const model = art.create(kind);
                root.addChild(model);
                variants.push(model);
                for (const instance of model.render!.meshInstances)
                    if (
                        instance.material === art.interceptor ||
                        instance.material === art.heavy ||
                        instance.material === art.armor
                    )
                        armor.push(instance);
            }
            root.enabled = false;
            this.variants.push(variants);
            this.armor.push(armor);
        }
        for (let i = 0; i < EVOLUTION.missile.capacity; i++) {
            const e = new Entity('Guided missile ' + i);
            e.addComponent('render', { meshInstances: [new MeshInstance(this.debrisMesh, this.orange, e)] });
            e.setLocalScale(0.5, 0.5, 3);
            const trail = new Entity('Missile trail');
            trail.addComponent('render', { meshInstances: [new MeshInstance(this.sparkMesh, this.glow, trail)] });
            trail.setLocalPosition(0, 0, 4);
            trail.setLocalScale(1, 1, 3);
            e.addChild(trail);
            e.enabled = false;
            this.root.addChild(e);
            this.missiles.push(e);
        }
        for (let i = 0; i < COMBAT.projectileCapacity; i++) {
            const e = new Entity(`Laser ${i}`);
            e.addComponent('render', { meshInstances: [new MeshInstance(this.debrisMesh, this.mint, e)] });
            e.enabled = false;
            this.root.addChild(e);
            this.bolts.push(e);
        }
        for (let i = 0; i < COMBAT.effectCapacity; i++) {
            const e = new Entity(`Impact effect ${i}`);
            e.addComponent('render', { meshInstances: [new MeshInstance(this.sparkMesh, this.orange, e)] });
            e.enabled = false;
            this.root.addChild(e);
            this.effects.push(new Effect(e));
        }
        // Compile effect variants under the opening menu, before the first dogfight.
        this.warmup = new Entity('VFX shader warmup');
        this.warmup.setPosition(0, 0, -6000);
        this.warmup.addComponent('render', {
            meshInstances: [
                new MeshInstance(this.quadMesh, this.glow, this.warmup),
                new MeshInstance(this.quadMesh, this.flare, this.warmup),
                new MeshInstance(this.ringMesh, this.ring, this.warmup),
                new MeshInstance(this.sparkMesh, this.orange, this.warmup)
            ]
        });
        this.root.addChild(this.warmup);
        validateRenderAttributes(this.root);
    }
    setQuality(level: GraphicsQuality) {
        this.explosions.setQuality(level);
        this.warmFrames = 4;
        this.limit = PRESETS[level].effects;
        for (let i = this.limit; i < this.effects.length; i++) {
            this.effects[i].life = 0;
            this.effects[i].entity.enabled = false;
        }
    }
    reset() {
        this.explosions.reset();
        for (const e of this.effects) {
            e.life = 0;
            e.entity.enabled = false;
        }
        for (const e of this.enemyRoots) e.enabled = false;
        for (const e of this.bolts) e.enabled = false;
        for (const e of this.muzzles) e.enabled = false;
        this.missileTrailTime = 0;
        for (const e of this.secondary) e.delay = -1;
    }
    private acquire(priority = 0) {
        for (let i = 0; i < this.limit; i++)
            if (this.effects[i].life <= 0) {
                this.effects[i].priority = priority;
                return this.effects[i];
            }
        if (priority >= 2)
            for (let i = 0; i < this.limit; i++)
                if (this.effects[i].priority < priority) {
                    this.effects[i].priority = priority;
                    return this.effects[i];
                }
        return undefined;
    }
    event = (kind: CombatEvent, position: Vec3, size: number, blast?: BlastClass) => {
        if (kind === 'laser' || kind === 'hostile' || kind === 'drone') return;
        const capital = kind === 'capital-final',
            elite = kind === 'elite-explosion',
            burst = kind === 'capital-burst',
            explosion = kind === 'explosion' || elite || capital || burst || kind === 'missile-impact';
        if (elite) {
            const q = this.secondary.find((e) => e.delay < 0);
            if (q) {
                q.delay = SPECTACLE.effects.secondaryDelay;
                q.position.copy(position);
                q.size = size * 0.6;
            }
        }
        if (explosion) {
            this.explosions.spawn(
                position,
                size,
                blast ?? (capital || burst ? 'dreadnought' : elite ? 'heavy' : 'fighter')
            );
            return;
        }
        const count = kind === 'emp' ? 3 : kind === 'shield' || kind === 'armor' ? 4 : 7;
        for (let i = 0; i < count; i++) {
            const e = this.acquire(1);
            if (!e) break;
            const n = ++this.serial;
            e.duration = kind === 'emp' ? 0.85 : kind === 'shield' ? 0.35 : 0.2 + (i % 3) * 0.07;
            e.life = e.duration;
            e.size = kind === 'shield' ? size * 0.55 : size;
            e.position.copy(position);
            e.type = kind === 'emp' ? 'emp' : kind === 'shield' && i === 0 ? 'ring' : i === 1 ? 'flare' : 'spark';
            e.velocity
                .set(Math.sin(n * 7.3), Math.cos(n * 2.7), Math.sin(n * 4.9))
                .normalize()
                .mulScalar(7 * Math.sqrt(size));
            if (e.type === 'ring' || e.type === 'emp' || e.type === 'flare') e.velocity.set(0, 0, 0);
            const mi = e.entity.render!.meshInstances[0];
            mi.mesh =
                e.type === 'ring' || e.type === 'emp'
                    ? this.ringMesh
                    : e.type === 'flare'
                      ? this.quadMesh
                      : this.sparkMesh;
            mi.material =
                e.type === 'ring' || e.type === 'emp'
                    ? this.ring
                    : e.type === 'flare'
                      ? this.flare
                      : kind === 'shield'
                        ? this.glow
                        : this.orange;
            mi.setParameter('material_opacity', 0.6);
            e.entity.enabled = true;
            e.entity.setPosition(position);
            if (e.type === 'emp') e.entity.setEulerAngles(i === 1 ? 90 : 0, i === 2 ? 90 : 0, 0);
        }
    };
    render(combat: Combat, alpha: number, dt: number, camera?: Entity) {
        this.explosions.update(dt, camera);
        for (const q of this.secondary)
            if (q.delay >= 0 && dt > 0) {
                q.delay -= dt;
                if (q.delay <= 0) {
                    this.event('missile-impact', q.position, q.size);
                    this.secondarySound?.(q.position, q.size);
                    q.delay = -1;
                }
            }
        this.warmup.enabled = this.warmFrames-- > 0;
        this.bossView.render(combat.dreadnought, alpha);
        this.phantomView.render(combat.phantom, alpha);
        this.missileTrailTime += dt;
        const leaveTrail = this.missileTrailTime > 0.05 && dt > 0;
        if (leaveTrail) this.missileTrailTime = 0;
        for (let i = 0; i < this.missiles.length; i++) {
            const m = combat.missiles.items[i],
                e = this.missiles[i];
            e.enabled = m.active;
            if (m.active) {
                this.position.lerp(m.previous, m.position, alpha);
                e.setPosition(this.position);
                this.target.copy(this.position).add(m.direction);
                e.lookAt(this.target);
                if (leaveTrail) {
                    const trace = this.acquire();
                    if (trace) {
                        trace.type = 'trail';
                        trace.life = trace.duration = 0.4;
                        trace.size = 1;
                        trace.position.copy(this.position);
                        trace.velocity.set(0, 0, 0);
                        trace.entity.render!.meshInstances[0].mesh = this.quadMesh;
                        trace.entity.render!.meshInstances[0].material = this.glow;
                    }
                }
            }
        }
        for (let i = 0; i < this.enemyRoots.length; i++) {
            const e = combat.enemies[i],
                root = this.enemyRoots[i];
            root.enabled = e.active;
            if (!e.active) continue;
            this.position.lerp(e.previous, e.position, alpha);
            this.rotation.slerp(e.previousRotation, e.rotation, alpha);
            root.setPosition(this.position);
            root.setRotation(this.rotation);
            const imported = this.importedFleet?.render(e, i) ?? false;
            for (let k = 0; k < 5; k++)
                this.variants[i][k].enabled =
                    !imported && e.kind === ['interceptor', 'heavy', 'bomber', 'carrier', 'drone'][k];
            for (const instance of this.armor[i])
                instance.material =
                    e.flash > 0
                        ? this.art.flash
                        : e.disrupted > 0
                          ? this.mint
                          : e.attackCue
                            ? this.orange
                            : e.elite
                              ? this.elite
                              : e.kind === 'carrier'
                                ? this.art.armor
                                : e.kind === 'heavy' || e.kind === 'bomber'
                                  ? this.art.heavy
                                  : this.art.interceptor;
        }
        for (let i = 0; i < this.bolts.length; i++) {
            const p = combat.projectiles.items[i],
                e = this.bolts[i];
            e.enabled = p.active;
            if (!p.active) continue;
            this.position.lerp(p.previous, p.position, alpha);
            e.setPosition(this.position);
            this.target.copy(this.position).add(p.velocity);
            e.lookAt(this.target);
            e.render!.meshInstances[0].material = p.alien
                ? this.alien
                : p.seeker || p.plasma
                  ? this.orange
                  : p.hostile
                    ? this.red
                    : this.mint;
            e.setLocalScale(
                p.plasma ? 1.4 : p.seeker ? 0.7 : p.hostile ? 0.32 : 0.16,
                p.plasma ? 1.4 : p.seeker ? 0.7 : p.hostile ? 0.32 : 0.16,
                p.plasma ? 3 : p.seeker ? 5 : p.hostile ? 8 : 15
            );
        }
        for (const e of this.effects)
            if (e.life > 0) {
                e.life = Math.max(0, e.life - dt);
                e.entity.enabled = e.life > 0;
                e.position.add(this.position.copy(e.velocity).mulScalar(dt));
                e.entity.setPosition(e.position);
                const f = e.life / e.duration;
                if (camera && (e.type === 'ring' || e.type === 'flare' || e.type === 'trail'))
                    e.entity.setRotation(camera.getRotation());
                const scale =
                    e.type === 'ring' || e.type === 'emp'
                        ? e.size * (6 + (1 - f) * (e.type === 'emp' ? 18 : 36))
                        : e.type === 'flare'
                          ? e.size * (3 + Math.sin(f * Math.PI) * 10)
                          : e.type === 'trail'
                            ? e.size * f * 1.5
                            : e.size * (0.08 + f * 0.5);
                e.entity.render!.meshInstances[0].setParameter('material_opacity', Math.min(0.65, f * 0.8));
                e.entity.setLocalScale(scale, scale, e.type === 'spark' ? scale * 4 : scale);
            }
        for (const e of this.muzzles) {
            e.enabled = combat.muzzle > 0;
            const size = 0.3 + combat.muzzle * 6;
            e.setLocalScale(size, size, size * 2);
        }
    }
    get activeEffects() {
        let n = 0;
        for (const e of this.effects) if (e.life > 0) n++;
        return n + this.explosions.active;
    }
    destroy() {
        this.explosions.destroy();
        this.alien.destroy();
        this.bossView.destroy();
        this.phantomView.destroy();
        this.elite.destroy();
        this.root.destroy();
        for (const m of [this.mint, this.red, this.orange, this.white, this.glow, this.flare, this.ring]) m.destroy();
        this.sparkMesh.destroy();
        this.debrisMesh.destroy();
        this.quadMesh.destroy();
        this.ringMesh.destroy();
    }
}
