/** Native shader pairs; no GLSL transpiler, textures, lights or screen-space distortion.
 * Engine 2.24 deduplicates shared WGSL declarations by their literal text: keep them identical.
 */
export const thrusterVertexGLSL = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv0;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform mat3 matrix_normal;
uniform vec4 uEngine;
uniform vec4 uShape;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
void main(void) {
    vec3 p=aPosition;
    if(uShape.x<0.5 || uShape.x>2.5) {
        float wave=sin(p.z*31.0-uEngine.x*13.0+aUv0.x*18.8496+uShape.y);
        p.xy*=1.0+wave*uShape.z*.035*p.z;
    }
    vec4 world=matrix_model*vec4(p,1.0);
    vWorld=world.xyz; vNormal=normalize(matrix_normal*aNormal);vUv=aUv0;
    gl_Position=matrix_viewProjection*world;
}`;
export const thrusterFragmentGLSL = `
uniform vec3 view_position;
uniform vec4 uEngine;
uniform vec4 uShape;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
void main(void) {
    float facing=abs(dot(normalize(vNormal),normalize(view_position-vWorld)));
    float power=uEngine.y, heat=uEngine.z;
    vec3 cold=vec3(.018,.24,1.05),hot=vec3(.65,1.05,1.5);
    float density=1.0;
    if(uShape.x<.5 || uShape.x>2.5) {
        float t=vUv.y,angle=vUv.x*6.283185;
        float flow=mix(13.0,7.0,uEngine.w);
        float noise=.72+.17*sin(t*53.0-uEngine.x*flow+angle*3.0+uShape.y)
                       +.11*sin(t*24.0+angle*7.0+uEngine.x*5.0);
        float diamonds=pow(max(0.0,sin(t*47.0-uEngine.x*2.0)),8.0);
        density=(1.0-smoothstep(.62,1.0,t))*smoothstep(0.0,.6,facing);
        density*=mix(.88,noise,uShape.z)+diamonds*.16*power;
        if(uShape.x>2.5) density=pow(max(0.0,1.0-abs(vUv.x*2.0-1.0)),1.6)*(1.0-smoothstep(.25,1.0,t))*noise;
        hot=mix(hot,cold,smoothstep(.05,.85,t)*.65);
    } else {
        density=pow(facing,uShape.x<1.5?1.3:2.8);
    }
    float inner=step(2.5,uShape.x);
    vec3 color=mix(cold,hot,clamp(heat*.65+inner*.25+(uShape.x>0.5&&uShape.x<1.5?.35:0.0),0.0,1.0));
    color*=.8+power*2.1;
    gl_FragColor=vec4(color,clamp(density*uShape.w,0.0,.85));
}`;
export const thrusterVertexWGSL = `
attribute aPosition: vec3f;
attribute aNormal: vec3f;
attribute aUv0: vec2f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform matrix_normal: mat3x3f;
uniform uEngine: vec4f;
uniform uShape: vec4f;
varying vUv: vec2f;
varying vWorld: vec3f;
varying vNormal: vec3f;
@vertex fn vertexMain(input:VertexInput)->VertexOutput {
    var output:VertexOutput;
    var p=input.aPosition;
    if(uniform.uShape.x<0.5 || uniform.uShape.x>2.5) {
        let wave=sin(p.z*31.0-uniform.uEngine.x*13.0+input.aUv0.x*18.8496+uniform.uShape.y);
        p=vec3f(p.xy*(1.0+wave*uniform.uShape.z*.035*p.z),p.z);
    }
    let world=uniform.matrix_model*vec4f(p,1.0);
    output.vWorld=world.xyz;
    output.vNormal=normalize(uniform.matrix_normal*input.aNormal);
    output.vUv=input.aUv0;
    output.position=uniform.matrix_viewProjection*world;
    return output;
}`;
export const thrusterFragmentWGSL = `
uniform view_position:vec3f;
uniform uEngine: vec4f;
uniform uShape: vec4f;
varying vUv:vec2f;
varying vWorld:vec3f;
varying vNormal:vec3f;
@fragment fn fragmentMain(input:FragmentInput)->FragmentOutput {
    var output:FragmentOutput;
    let facing=abs(dot(normalize(input.vNormal),normalize(uniform.view_position-input.vWorld)));
    let power=uniform.uEngine.y;let heat=uniform.uEngine.z;
    let cold=vec3f(.018,.24,1.05);var hot=vec3f(.65,1.05,1.5);
    var density=1.0;
    if(uniform.uShape.x<.5 || uniform.uShape.x>2.5) {
        let t=input.vUv.y;let angle=input.vUv.x*6.283185;
        let flow=mix(13.0,7.0,uniform.uEngine.w);
        let noise=.72+.17*sin(t*53.0-uniform.uEngine.x*flow+angle*3.0+uniform.uShape.y)
                      +.11*sin(t*24.0+angle*7.0+uniform.uEngine.x*5.0);
        let diamonds=pow(max(0.0,sin(t*47.0-uniform.uEngine.x*2.0)),8.0);
        density=(1.0-smoothstep(.62,1.0,t))*smoothstep(0.0,.6,facing);
        density*=mix(.88,noise,uniform.uShape.z)+diamonds*.16*power;
        if(uniform.uShape.x>2.5) { density=pow(max(0.0,1.0-abs(input.vUv.x*2.0-1.0)),1.6)*(1.0-smoothstep(.25,1.0,t))*noise; }
        hot=mix(hot,cold,smoothstep(.05,.85,t)*.65);
    } else {
        density=pow(facing,select(2.8,1.3,uniform.uShape.x<1.5));
    }
    let inner=select(0.0,1.0,uniform.uShape.x>=2.5);
    let core=select(0.0,.35,uniform.uShape.x>.5 && uniform.uShape.x<1.5);
    var color=mix(cold,hot,clamp(heat*.65+inner*.25+core,0.0,1.0));
    color*=.8+power*2.1;
    output.color=vec4f(color,clamp(density*uniform.uShape.w,0.0,.85));
    return output;
}`;
