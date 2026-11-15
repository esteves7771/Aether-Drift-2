/** Native shader pairs for one bounded analytic particle mesh per explosion. */
export const blastVertexGLSL = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv0;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform vec4 uBlast;
uniform vec4 uBudget;
uniform float uStyle;
uniform vec3 uRight;
uniform vec3 uUp;
varying vec2 vUv;
varying vec4 vData;
void main(void) {
 float kind=aNormal.x, index=aNormal.y, seed=aNormal.z+uBlast.z;
 float age=max(0.0,uBlast.x), t=age/uBlast.w;
 vec2 q=aUv0*2.0-1.0;
 vec3 dir=normalize(aPosition);
 vec3 pos=vec3(0.0);
 float size=uBlast.y;
 float visible=1.0;
 if(kind<.5){
  visible=step(index+.5,uBudget.x);
  float grow=1.0-exp(-age*9.0);
  vec3 spread=dir*(.08+grow*.38)*size*step(.5,index);
  float radius=size*(.18+grow*.56)*(1.0+sin(seed*5.1)*.2);
  pos=spread+(uRight*q.x+uUp*q.y)*radius;
 }else if(kind<2.5){
  visible=step(index+.5,kind<1.5?uBudget.y:uBudget.z);
  float delay=kind<1.5?.045:.12;
  float a=max(0.0,age-delay);
  vec3 center=dir*size*(kind<1.5?3.5:2.2)*(a*.65+.12*(1.0-exp(-a*9.0)));
  vec2 axis=normalize(vec2(dot(dir,uRight),dot(dir,uUp))+vec2(.001));
  if(kind<1.5){
   float length=size*(.04+.16*exp(-a*2.2));
   vec2 p=axis*q.y*length+vec2(-axis.y,axis.x)*q.x*size*.006;
   pos=center+uRight*p.x+uUp*p.y;
  }else{
   float r=size*(.012+.012*fract(seed*7.0));
   float angle=age*(3.0+seed)+seed*7.0;
   vec2 p=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*q*r;
   pos=center+uRight*p.x+uUp*p.y;
  }
 }else{
  visible=step(2.5,uStyle);
  pos=(uRight*q.x+uUp*q.y)*size*(.25+age*2.5);
 }
 if(visible<.5)pos=vec3(0.0);
 vUv=aUv0;vData=vec4(kind,seed,t,visible);
 gl_Position=matrix_viewProjection*(matrix_model*vec4(pos,1.0));
}`;
export const blastFragmentGLSL = `
uniform vec4 uBlast;
uniform vec4 uBudget;
uniform float uStyle;
uniform float uAtlasReady;
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec4 vData;
vec4 fireFrame(float f,vec2 uv){return texture2D(uAtlas,vec2((mod(f,4.0)+uv.x)/4.0,(3.0-floor(f/4.0)+uv.y)/4.0));}
void main(void){
 vec2 p=vUv*2.0-1.0;float r=length(p),kind=vData.x,seed=vData.y,t=vData.z,age=uBlast.x;
 float fade=pow(max(0.0,1.0-t),1.3),alpha=0.0;vec3 color=vec3(1.6,.36,.025);
 if(kind<.5){
  if(uAtlasReady>.5){
   float f=clamp(age/(uBlast.w*.65)*15.0,0.0,15.0);vec2 uv=mix(vec2(.012),vec2(.988),vUv);
   vec4 fire=mix(fireFrame(floor(f),uv),fireFrame(min(15.0,floor(f)+1.0),uv),fract(f));
   color=fire.rgb*(2.0+exp(-age*8.0)*2.0);alpha=fire.a*fade*.7;
   alpha*=smoothstep(0.0,.06,vUv.x)*smoothstep(0.0,.06,1.0-vUv.x)*smoothstep(0.0,.06,vUv.y)*smoothstep(0.0,.06,1.0-vUv.y);
  }else{
   float noise=.12*sin(p.x*17.0+p.y*7.0+seed-age*10.0);
   float heat=clamp(1.0-r-age*.7+noise,0.0,1.0);
   color=mix(vec3(1.6,.14,.01),vec3(4.0,3.5,2.3),smoothstep(.3,.9,heat));
   alpha=(1.0-smoothstep(.35,.95,r+noise))*fade*.5;
  }
  if(uStyle>5.5&&uStyle<6.5)color=mix(color,vec3(1.8,2.5,3.5),exp(-age*10.0)*.4);
 }else if(kind<1.5){
  alpha=(1.0-smoothstep(.15,1.0,abs(p.x)))*(1.0-smoothstep(.5,1.0,abs(p.y)))*fade*smoothstep(.02,.08,age);
  color=mix(vec3(1.8,.21,.015),vec3(3.5,2.5,1.3),exp(-age*2.0));
  if(uStyle>3.5&&uStyle<4.5)color=mix(color,vec3(.5,1.8,3.0),.6);
 }else if(kind<2.5){alpha=(1.0-smoothstep(.7,1.0,max(abs(p.x),abs(p.y))))*fade;color=mix(vec3(.09,.1,.13),vec3(1.4,.2,.01),exp(-age*6.0))*(.5+vUv.x*.5);}
 else{alpha=(1.0-smoothstep(.025,.075,abs(r-.8)))*exp(-age*5.0)*.35;color=vec3(2.0,.65,.1);}
 alpha*=vData.w*uBudget.a;if(alpha<.003)discard;gl_FragColor=vec4(color,alpha);
}`;
export const blastVertexWGSL = `
attribute aPosition: vec3f;
attribute aNormal: vec3f;
attribute aUv0: vec2f;
uniform matrix_model: mat4x4f;
uniform matrix_viewProjection: mat4x4f;
uniform uBlast: vec4f;
uniform uBudget: vec4f;
uniform uStyle: f32;
uniform uRight: vec3f;
uniform uUp: vec3f;
varying vUv: vec2f;
varying vData: vec4f;
@vertex fn vertexMain(input: VertexInput)->VertexOutput {
 var output: VertexOutput;
 let kind=input.aNormal.x;let index=input.aNormal.y;let seed=input.aNormal.z+uniform.uBlast.z;
 let age=max(0.0,uniform.uBlast.x);let t=age/uniform.uBlast.w;
 let q=input.aUv0*2.0-vec2f(1.0);let dir=normalize(input.aPosition);
 var pos=vec3f(0.0);let size=uniform.uBlast.y;var visible=1.0;
 if(kind<.5){
  visible=step(index+.5,uniform.uBudget.x);
  let grow=1.0-exp(-age*9.0);
  let spread=dir*(.08+grow*.38)*size*step(.5,index);
  let radius=size*(.14+grow*.46)*(1.0+sin(seed*5.1)*.2);
  pos=spread+(uniform.uRight*q.x+uniform.uUp*q.y)*radius;
 }else if(kind<2.5){
  visible=step(index+.5,select(uniform.uBudget.z,uniform.uBudget.y,kind<1.5));
  let delay=select(.12,.045,kind<1.5);let a=max(0.0,age-delay);
  let center=dir*size*select(2.2,3.5,kind<1.5)*(a*.65+.12*(1.0-exp(-a*9.0)));
  let axis=normalize(vec2f(dot(dir,uniform.uRight),dot(dir,uniform.uUp))+vec2f(.001));
  if(kind<1.5){
   let length=size*(.04+.16*exp(-a*2.2));
   let p=axis*q.y*length+vec2f(-axis.y,axis.x)*q.x*size*.006;
   pos=center+uniform.uRight*p.x+uniform.uUp*p.y;
  }else{
   let r=size*(.012+.012*fract(seed*7.0));let angle=age*(3.0+seed)+seed*7.0;
   let p=mat2x2f(vec2f(cos(angle),sin(angle)),vec2f(-sin(angle),cos(angle)))*q*r;
   pos=center+uniform.uRight*p.x+uniform.uUp*p.y;
  }
 }else{visible=step(2.5,uniform.uStyle);pos=(uniform.uRight*q.x+uniform.uUp*q.y)*size*(.25+age*2.5);}
 if(visible<.5){pos=vec3f(0.0);}
 output.vUv=input.aUv0;output.vData=vec4f(kind,seed,t,visible);
 output.position=uniform.matrix_viewProjection*(uniform.matrix_model*vec4f(pos,1.0));return output;
}`;
export const blastFragmentWGSL = `
uniform uBlast: vec4f;
uniform uBudget: vec4f;
uniform uStyle: f32;
uniform uAtlasReady: f32;
var uAtlas: texture_2d<f32>;
var uAtlasSampler: sampler;
varying vUv: vec2f;
varying vData: vec4f;
fn fireFrame(f:f32,uv:vec2f)->vec4f{return textureSampleLevel(uAtlas,uAtlasSampler,vec2f((f%4.0+uv.x)/4.0,(3.0-floor(f/4.0)+uv.y)/4.0),0.0);}
@fragment fn fragmentMain(input: FragmentInput)->FragmentOutput {
 var output: FragmentOutput;let p=input.vUv*2.0-vec2f(1.0);let r=length(p);let kind=input.vData.x;let seed=input.vData.y;let t=input.vData.z;let age=uniform.uBlast.x;
 let fade=pow(max(0.0,1.0-t),1.3);var alpha=0.0;var color=vec3f(1.6,.36,.025);
 if(kind<.5){
  if(uniform.uAtlasReady>.5){
   let f=clamp(age/(uniform.uBlast.w*.65)*15.0,0.0,15.0);let uv=mix(vec2f(.012),vec2f(.988),input.vUv);
   let fire=mix(fireFrame(floor(f),uv),fireFrame(min(15.0,floor(f)+1.0),uv),fract(f));
   color=fire.rgb*(2.0+exp(-age*8.0)*2.0);alpha=fire.a*fade*.7;
   alpha*=smoothstep(0.0,.06,input.vUv.x)*smoothstep(0.0,.06,1.0-input.vUv.x)*smoothstep(0.0,.06,input.vUv.y)*smoothstep(0.0,.06,1.0-input.vUv.y);
  }else{
   let noise=.12*sin(p.x*17.0+p.y*7.0+seed-age*10.0);let heat=clamp(1.0-r-age*.7+noise,0.0,1.0);
   color=mix(vec3f(1.6,.14,.01),vec3f(4.0,3.5,2.3),smoothstep(.3,.9,heat));alpha=(1.0-smoothstep(.35,.95,r+noise))*fade*.5;
  }
  if(uniform.uStyle>5.5&&uniform.uStyle<6.5){color=mix(color,vec3f(1.8,2.5,3.5),exp(-age*10.0)*.4);}
 }else if(kind<1.5){
  alpha=(1.0-smoothstep(.15,1.0,abs(p.x)))*(1.0-smoothstep(.5,1.0,abs(p.y)))*fade*smoothstep(.02,.08,age);
  color=mix(vec3f(1.8,.21,.015),vec3f(3.5,2.5,1.3),exp(-age*2.0));if(uniform.uStyle>3.5&&uniform.uStyle<4.5){color=mix(color,vec3f(.5,1.8,3.0),.6);}
 }else if(kind<2.5){alpha=(1.0-smoothstep(.7,1.0,max(abs(p.x),abs(p.y))))*fade;color=mix(vec3f(.09,.1,.13),vec3f(1.4,.2,.01),exp(-age*6.0))*(.5+input.vUv.x*.5);}
 else{alpha=(1.0-smoothstep(.025,.075,abs(r-.8)))*exp(-age*5.0)*.35;color=vec3f(2.0,.65,.1);}
 alpha*=input.vData.w*uniform.uBudget.a;if(alpha<.003){discard;}output.color=vec4f(color,alpha);return output;
}`;
