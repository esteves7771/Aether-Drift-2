export const riftVertexGLSL = `attribute vec3 aPosition;attribute vec2 aUv0;uniform mat4 matrix_model;uniform mat4 matrix_viewProjection;varying vec2 vUv;void main(){vUv=aUv0;gl_Position=matrix_viewProjection*matrix_model*vec4(aPosition,1.0);}`;
export const riftFragmentGLSL = `
uniform vec4 uRift;uniform vec4 uAccent;varying vec2 vUv;
void main(){
 vec2 p=vUv*2.0-1.0;float r=length(p),a=atan(p.y,p.x),t=uRift.x;
 if(r>1.0)discard;
 float warp=r+sin(a*7.0-t*3.0+r*20.0)*uAccent.w*.5;
 float ring=exp(-pow((warp-.72)*23.0,2.0));
 float streak=pow(max(0.0,sin(a*19.0+r*39.0+t*8.0)),14.0)*smoothstep(.28,.8,r)*(1.0-smoothstep(.8,1.0,r));
 float corona=exp(-pow((r-.77)*7.0,2.0))*(.25+.14*sin(a*4.0-t*2.0));
 float pulse=.9+.1*sin(t*9.0);vec3 color=vec3(.0004,.0007,.002);
 color+=(uAccent.rgb*corona+vec3(.28,.6,1.25)*ring+vec3(.55,.35,1.1)*streak*.7)*pulse;
 float alpha=1.0-smoothstep(.9,1.0,r);if(alpha<.02)discard;
 gl_FragColor=vec4(color,alpha*uRift.y);
}`;
export const riftVertexWGSL = `attribute aPosition:vec3f;attribute aUv0:vec2f;uniform matrix_model:mat4x4f;uniform matrix_viewProjection:mat4x4f;varying vUv:vec2f;@vertex fn vertexMain(input:VertexInput)->VertexOutput{var output:VertexOutput;output.vUv=input.aUv0;output.position=uniform.matrix_viewProjection*uniform.matrix_model*vec4f(input.aPosition,1.0);return output;}`;
export const riftFragmentWGSL = `uniform uRift:vec4f;uniform uAccent:vec4f;varying vUv:vec2f;
@fragment fn fragmentMain(input:FragmentInput)->FragmentOutput{
 var output:FragmentOutput;let p=input.vUv*2.0-1.0;let r=length(p);let a=atan2(p.y,p.x);let t=uniform.uRift.x;
 if(r>1.0){discard;}
 let warp=r+sin(a*7.0-t*3.0+r*20.0)*uniform.uAccent.w*.5;let ring=exp(-pow((warp-.72)*23.0,2.0));
 let streak=pow(max(0.0,sin(a*19.0+r*39.0+t*8.0)),14.0)*smoothstep(.28,.8,r)*(1.0-smoothstep(.8,1.0,r));
 let corona=exp(-pow((r-.77)*7.0,2.0))*(.25+.14*sin(a*4.0-t*2.0));let pulse=.9+.1*sin(t*9.0);
 var color=vec3f(.0004,.0007,.002);color+=(uniform.uAccent.xyz*corona+vec3f(.28,.6,1.25)*ring+vec3f(.55,.35,1.1)*streak*.7)*pulse;
 let alpha=1.0-smoothstep(.9,1.0,r);if(alpha<.02){discard;}output.color=vec4f(color,alpha*uniform.uRift.y);return output;
}`;
