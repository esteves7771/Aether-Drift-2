import {
    Entity,
    Mesh,
    MeshInstance,
    ShaderMaterial,
    BLEND_ADDITIVEALPHA,
    CULLFACE_NONE,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0
} from 'playcanvas';
import type { AppBase, Vec3 } from 'playcanvas';
const vertexGLSL = `attribute vec3 aPosition;attribute vec2 aUv0;
uniform mat4 matrix_viewProjection;uniform vec3 view_position;
uniform vec3 uStart;uniform vec3 uEnd;uniform vec4 uBeam;
varying vec2 vUv;
void main(void){vec3 axis=normalize(uEnd-uStart);vec3 side=cross(axis,view_position-uStart);if(dot(side,side)<.00001)side=cross(axis,vec3(0.0,1.0,0.0));if(dot(side,side)<.00001)side=vec3(1.0,0.0,0.0);vec3 p=mix(uStart,uEnd,aUv0.y)+normalize(side)*aPosition.x*uBeam.y;vUv=aUv0;gl_Position=matrix_viewProjection*vec4(p,1.0);}`;
const fragmentGLSL = `uniform vec4 uBeam;varying vec2 vUv;
void main(void){float x=abs(vUv.x*2.0-1.0);float flow=.86+.10*sin(vUv.y*160.0-uBeam.x*27.0)+.04*sin(vUv.y*71.0+uBeam.x*19.0);float core=exp(-x*x*160.0);float halo=exp(-x*5.0)*flow;float edge=(1.0-smoothstep(.7,1.0,x))*smoothstep(0.0,.012,vUv.y)*(1.0-smoothstep(.985,1.0,vUv.y));vec3 tone=mix(vec3(1.9,.12,.025),vec3(.55,.16,1.9),uBeam.w);vec3 c=mix(tone,vec3(3.0,2.8,2.3),core);gl_FragColor=vec4(c,(core+halo*.55)*edge*uBeam.z);}`;
const vertexWGSL = `attribute aPosition: vec3f;attribute aUv0: vec2f;
uniform matrix_viewProjection: mat4x4f;uniform view_position: vec3f;
uniform uStart: vec3f;uniform uEnd: vec3f;uniform uBeam: vec4f;
varying vUv: vec2f;
@vertex fn vertexMain(input:VertexInput)->VertexOutput{var output:VertexOutput;let axis=normalize(uniform.uEnd-uniform.uStart);var side=cross(axis,uniform.view_position-uniform.uStart);if(dot(side,side)<.00001){side=cross(axis,vec3f(0.0,1.0,0.0));}if(dot(side,side)<.00001){side=vec3f(1.0,0.0,0.0);}let p=mix(uniform.uStart,uniform.uEnd,input.aUv0.y)+normalize(side)*input.aPosition.x*uniform.uBeam.y;output.vUv=input.aUv0;output.position=uniform.matrix_viewProjection*vec4f(p,1.0);return output;}`;
const fragmentWGSL = `uniform uStart: vec3f;uniform uEnd: vec3f;uniform uBeam: vec4f;
varying vUv: vec2f;
@fragment fn fragmentMain(input:FragmentInput)->FragmentOutput{var output:FragmentOutput;let x=abs(input.vUv.x*2.0-1.0);let flow=.86+.10*sin(input.vUv.y*160.0-uniform.uBeam.x*27.0)+.04*sin(input.vUv.y*71.0+uniform.uBeam.x*19.0);let core=exp(-x*x*160.0);let halo=exp(-x*5.0)*flow;let edge=(1.0-smoothstep(.7,1.0,x))*smoothstep(0.0,.012,input.vUv.y)*(1.0-smoothstep(.985,1.0,input.vUv.y));let tone=mix(vec3f(1.9,.12,.025),vec3f(.55,.16,1.9),uniform.uBeam.w);let c=mix(tone,vec3f(3.0,2.8,2.3),core);output.color=vec4f(c,(core+halo*.55)*edge*uniform.uBeam.z);return output;}`;
/** Shared two-triangle camera-facing volume impression, with finite world-space endpoints. */
export class BeamKit {
    private readonly mesh: Mesh;
    private readonly warm: Entity;
    private readonly material: ShaderMaterial;
    private readonly data = new Map<Entity, { start: Float32Array; end: Float32Array; beam: Float32Array }>();
    constructor(app: AppBase) {
        this.mesh = new Mesh(app.graphicsDevice);
        this.mesh.setPositions([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0]);
        this.mesh.setUvs(0, [0, 0, 1, 0, 0, 1, 1, 1]);
        this.mesh.setIndices([0, 1, 2, 2, 1, 3]);
        this.mesh.update();
        this.material = new ShaderMaterial({
            uniqueName: 'AetherHeavyBeam',
            attributes: { aPosition: SEMANTIC_POSITION, aUv0: SEMANTIC_TEXCOORD0 },
            vertexGLSL,
            fragmentGLSL,
            vertexWGSL,
            fragmentWGSL
        });
        this.material.blendType = BLEND_ADDITIVEALPHA;
        this.material.depthWrite = false;
        this.material.cull = CULLFACE_NONE;
        this.material.update();
        this.warm = this.create('Beam shader warmup');
        app.root.addChild(this.warm);
        const d = this.data.get(this.warm)!;
        d.start[2] = -6000;
        d.end[2] = -6001;
        d.beam[2] = 0;
        app.once('frameend', () => {
            this.warm.enabled = false;
        });
    }
    create(name: string) {
        const e = new Entity(name),
            m = new MeshInstance(this.mesh, this.material, e);
        m.cull = false;
        const d = { start: new Float32Array(3), end: new Float32Array(3), beam: new Float32Array([0, 8, 1, 0]) };
        m.setParameter('uStart', d.start);
        m.setParameter('uEnd', d.end);
        m.setParameter('uBeam', d.beam);
        this.data.set(e, d);
        e.addComponent('render', { meshInstances: [m], castShadows: false, receiveShadows: false });
        return e;
    }
    update(e: Entity, start: Vec3, end: Vec3, time: number, opacity: number, tone = 0) {
        const d = this.data.get(e)!;
        d.start[0] = start.x;
        d.start[1] = start.y;
        d.start[2] = start.z;
        d.end[0] = end.x;
        d.end[1] = end.y;
        d.end[2] = end.z;
        d.beam[0] = time;
        d.beam[2] = opacity;
        d.beam[3] = tone;
    }
    destroy() {
        this.warm.destroy();
        this.data.clear();
        this.mesh.destroy();
        this.material.destroy();
    }
}
