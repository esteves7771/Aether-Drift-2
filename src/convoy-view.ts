import {
    Entity,
    MeshInstance,
    ShaderMaterial,
    BLEND_ADDITIVEALPHA,
    CULLFACE_NONE,
    SEMANTIC_POSITION,
    SEMANTIC_NORMAL,
    SEMANTIC_TEXCOORD0
} from 'playcanvas';
import type { AppBase, Vec3 } from 'playcanvas';

import { emission } from './art-kit';
import type { GraphicsQuality } from './config';
import type { Convoys } from './convoys';
import type { ModelLibrary } from './model-library';
import { plumeMesh } from './player-thrusters';
import { thrusterVertexGLSL, thrusterFragmentGLSL, thrusterVertexWGSL, thrusterFragmentWGSL } from './thruster-shader';
/** Fixed two-group pool, three cruiser instances and six existing escorts per group. */
export class ConvoyView {
    readonly root = new Entity('Space Voyage / noncombat convoys');
    private readonly groups: Entity[][] = [];
    private readonly drives: Entity[][] = [];
    private requested = false;
    private closed = false;
    private quality: GraphicsQuality = 'medium';
    private readonly core = emission('Voyage fusion cores', '#9defff', 2.4);
    private readonly plasma: ShaderMaterial;
    private readonly plume: ReturnType<typeof plumeMesh>;
    private readonly engineData = new Float32Array([0, 0.7, 0.5, 0]);
    private time = 0;

    readonly convoys: Convoys;
    constructor(app: AppBase, privateLibrary: ModelLibrary, convoys: Convoys) {
        this.convoys = convoys;
        this.library = privateLibrary;
        this.plume = plumeMesh(app.graphicsDevice, false);
        this.plasma = new ShaderMaterial({
            uniqueName: 'PlayerIonPropulsion',
            attributes: { aPosition: SEMANTIC_POSITION, aNormal: SEMANTIC_NORMAL, aUv0: SEMANTIC_TEXCOORD0 },
            vertexGLSL: thrusterVertexGLSL,
            fragmentGLSL: thrusterFragmentGLSL,
            vertexWGSL: thrusterVertexWGSL,
            fragmentWGSL: thrusterFragmentWGSL
        });
        this.plasma.blendType = BLEND_ADDITIVEALPHA;
        this.plasma.depthWrite = false;
        this.plasma.cull = CULLFACE_NONE;
        this.plasma.setParameter('uEngine', this.engineData);
        this.plasma.setParameter('uShape', new Float32Array([0, 0, 0.35, 0.5]));
        this.plasma.update();
        app.root.addChild(this.root);
    }
    private readonly library: ModelLibrary;
    setQuality(q: GraphicsQuality) {
        this.quality = q;
    }
    private async load() {
        this.requested = true;
        const ok = await this.library.load('voyage');
        if (!ok || this.closed) return;
        await this.library.load('raider');
        if (this.closed) return;
        for (let g = 0; g < 2; g++) {
            const members: Entity[] = [],
                jets: Entity[] = [];
            for (let i = 0; i < 9; i++) {
                const e = this.library.create(i < 3 ? 'voyage' : 'raider');
                if (!e) continue;
                e.name = 'Convoy ' + g + ' ' + (i < 3 ? 'Space Voyage cruiser ' : 'escort ') + i;
                this.root.addChild(e);
                e.enabled = false;
                members.push(e);
                const mounts =
                    i < 3
                        ? [
                              [0, -13.48, 129.6],
                              [0, -5.33, 119.6],
                              [0, -22.4, 119.6]
                          ]
                        : [[0, 0, 3.2]];
                for (const p of mounts) {
                    const c = new Entity('Rear engine core');
                    c.addComponent('render', { type: 'sphere', material: this.core });
                    c.setLocalPosition(p[0], p[1], p[2]);
                    c.setLocalScale(i < 3 ? 7 : 1, i < 3 ? 7 : 1, i < 3 ? 3 : 1);
                    e.addChild(c);
                    const jet = new Entity('Soft convoy exhaust');
                    jet.addComponent('render', { meshInstances: [new MeshInstance(this.plume, this.plasma, jet)] });
                    jet.setLocalPosition(p[0], p[1], p[2]);
                    jet.setLocalScale(i < 3 ? 8 : 1, i < 3 ? 8 : 1, i < 3 ? 65 : 8);
                    e.addChild(jet);
                    jets.push(jet);
                }
            }
            this.groups.push(members);
            this.drives.push(jets);
        }
    }
    render(dt: number, player: Vec3, started: boolean) {
        this.time += dt;
        this.engineData[0] = this.time;
        this.engineData[1] = 0.7 + Math.sin(this.time * 0.7) * 0.025;
        this.root.enabled = started;
        if (!started) return;
        if (
            !this.requested &&
            (this.convoys.groups.some((g) => g.active) || (this.convoys.countdown < 15 && !this.convoys.blocked))
        )
            void this.load();
        for (let g = 0; g < this.groups.length; g++)
            for (let i = 0; i < this.groups[g].length; i++) {
                const state = this.convoys.groups[g],
                    e = this.groups[g][i],
                    count =
                        i < 3
                            ? i < state.cruisers
                            : i - 3 <
                              Math.min(state.escorts, this.quality === 'low' ? 3 : this.quality === 'medium' ? 4 : 6);
                e.enabled =
                    state.active && count && state.members[i].distance(player) < (this.quality === 'low' ? 2500 : 4200);
                if (!e.enabled) continue;
                e.setPosition(state.members[i]);
                e.setRotation(state.rotation);
            }
    }
    destroy() {
        this.closed = true;
        this.root.destroy();
        this.core.destroy();
        this.plasma.destroy();
        this.plume.destroy();
    }
}
