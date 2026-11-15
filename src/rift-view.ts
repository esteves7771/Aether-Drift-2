import {
    BLEND_NORMAL,
    CULLFACE_NONE,
    Entity,
    Mesh,
    MeshInstance,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial
} from 'playcanvas';
import type { AppBase } from 'playcanvas';

import type { RiftArrival } from './rift-arrival';
import { riftVertexGLSL, riftFragmentGLSL, riftVertexWGSL, riftFragmentWGSL } from './rift-shader';
/** Single bounded world-space surface. Analytic inward motes and lens-like accretion; no screen readback. */
export class RiftView {
    private warmFrames = 2;
    readonly root = new Entity('Gravitational rift');
    private readonly mesh: Mesh;
    private readonly material = new ShaderMaterial({
        uniqueName: 'Artillery rift',
        attributes: { aPosition: SEMANTIC_POSITION, aUv0: SEMANTIC_TEXCOORD0 },
        vertexGLSL: riftVertexGLSL,
        fragmentGLSL: riftFragmentGLSL,
        vertexWGSL: riftVertexWGSL,
        fragmentWGSL: riftFragmentWGSL
    });
    private readonly state = new Float32Array(4);
    private readonly accent = new Float32Array(4);
    constructor(app: AppBase) {
        this.material.blendType = BLEND_NORMAL;
        this.material.depthWrite = true;
        this.material.cull = CULLFACE_NONE;
        this.mesh = new Mesh(app.graphicsDevice);
        this.mesh.setPositions([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]);
        this.mesh.setUvs(0, [0, 0, 1, 0, 0, 1, 1, 1]);
        this.mesh.setIndices([0, 1, 2, 2, 1, 3]);
        this.mesh.update();
        this.root.addComponent('render', { meshInstances: [new MeshInstance(this.mesh, this.material, this.root)] });
        app.root.addChild(this.root);
        this.root.enabled = false;
        this.material.setParameter('uRift', this.state);
        this.material.setParameter('uAccent', this.accent);
    }
    render(arrival: RiftArrival, active: boolean) {
        if (this.warmFrames > 0) {
            this.warmFrames--;
            if (!active) {
                this.root.enabled = true;
                this.root.setPosition(0, 0, 0);
                this.root.setLocalScale(0.001, 0.001, 0.001);
                this.state[0] = this.state[1] = 0;
                this.material.setParameter('uRift', this.state);
                return;
            }
        }
        this.root.enabled = active && arrival.radius > 0.01;
        if (!this.root.enabled) return;
        this.root.setPosition(arrival.anchor);
        this.root.setRotation(arrival.rotation);
        this.root.setLocalScale(arrival.radius, arrival.radius, arrival.radius);
        this.accent.set(arrival.tuning.accent);
        this.accent[3] = arrival.tuning.distortion;
        this.state[0] = arrival.age;
        this.state[1] = 1;
        this.material.setParameter('uRift', this.state);
    }
    destroy() {
        this.root.destroy();
        this.mesh.destroy();
        this.material.destroy();
    }
}
