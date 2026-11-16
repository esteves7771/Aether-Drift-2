export const energyVertexGLSL = `
attribute vec3 aPosition;
attribute vec2 aUv0;
attribute vec4 aColor;
uniform mat4 matrix_viewProjection;
varying vec2 vUv;
varying vec4 vData;
void main(void){vUv=aUv0;vData=aColor;gl_Position=matrix_viewProjection*vec4(aPosition,1.0);}`;
export const energyFragmentGLSL = `
uniform vec4 uEnergyTime;
varying vec2 vUv;
varying vec4 vData;
void main(void){
 vec2 q=vUv*2.0-1.0; float k=vData.x,t=uEnergyTime.x,seed=vData.y*19.0;
 float r=length(q),n=sin(atan(q.y,q.x)*9.0+t*7.0+seed)*sin(atan(q.y,q.x)*5.0-t*4.0);
 float alpha=0.0,core=0.0;vec3 color=vec3(.08,.48,1.2);
 if(k<1.5&&k>.5){float d=abs(r-.60-n*.023*uEnergyTime.y);core=exp(-d*48.0);alpha=(core+exp(-d*15.0)*.48)*(1.0-smoothstep(.82,1.0,r));color=vec3(1.9,.30,.025)*(1.0+n*.10);}
 else if(k>1.5&&k<2.5){float f=clamp(vUv.y,0.0,1.0);alpha=pow(max(0.0,1.0-abs(q.x)),3.0)*pow(f,.7)*(1.0-smoothstep(.94,1.0,f));core=exp(-abs(q.x)*15.0)*smoothstep(.60,.88,f);color=vec3(2.0,.025,.055);}
 else if(k>2.5&&k<3.5){alpha=exp(-abs(q.x+sin(vUv.y*24.0-t*11.0)*.16)*8.0)*.28;color=vec3(.65,.12,1.5);}
 else {core=exp(-r*r*15.0);alpha=(core+exp(-r*3.8)*.5)*(1.0-smoothstep(.8,1.0,r));if(k>3.5&&k<4.5)color=vec3(.64,.12,1.8);if(k>8.5)color=vec3(2.0,.025,.055);}
 color=mix(color,vec3(2.5,1.8,1.1),clamp(core*.7,0.0,1.0));
 gl_FragColor=vec4(color,clamp(alpha*(.92+.08*sin(t*29.0+seed)),0.0,.95));
}`;
export const energyVertexWGSL = `
attribute aPosition: vec3f;
attribute aUv0: vec2f;
attribute aColor: vec4f;
uniform matrix_viewProjection: mat4x4f;
varying vUv: vec2f;
varying vData: vec4f;
@vertex fn vertexMain(input:VertexInput)->VertexOutput {
 var output:VertexOutput;output.vUv=input.aUv0;output.vData=input.aColor;
 output.position=uniform.matrix_viewProjection*vec4f(input.aPosition,1.0);return output;
}`;
export const energyFragmentWGSL = `
uniform uEnergyTime: vec4f;
varying vUv: vec2f;
varying vData: vec4f;
@fragment fn fragmentMain(input:FragmentInput)->FragmentOutput {
 var output:FragmentOutput;let q=input.vUv*2.0-vec2f(1.0);let k=input.vData.x;let t=uniform.uEnergyTime.x;let seed=input.vData.y*19.0;
 let r=length(q);let n=sin(atan2(q.y,q.x)*9.0+t*7.0+seed)*sin(atan2(q.y,q.x)*5.0-t*4.0);
 var alpha=0.0;var core=0.0;var color=vec3f(.08,.48,1.2);
 if(k<1.5&&k>.5){let d=abs(r-.60-n*.023*uniform.uEnergyTime.y);core=exp(-d*48.0);alpha=(core+exp(-d*15.0)*.48)*(1.0-smoothstep(.82,1.0,r));color=vec3f(1.9,.30,.025)*(1.0+n*.10);}
 else if(k>1.5&&k<2.5){let f=clamp(input.vUv.y,0.0,1.0);alpha=pow(max(0.0,1.0-abs(q.x)),3.0)*pow(f,.7)*(1.0-smoothstep(.94,1.0,f));core=exp(-abs(q.x)*15.0)*smoothstep(.60,.88,f);color=vec3f(2.0,.025,.055);}
 else if(k>2.5&&k<3.5){alpha=exp(-abs(q.x+sin(input.vUv.y*24.0-t*11.0)*.16)*8.0)*.28;color=vec3f(.65,.12,1.5);}
 else {core=exp(-r*r*15.0);alpha=(core+exp(-r*3.8)*.5)*(1.0-smoothstep(.8,1.0,r));if(k>3.5&&k<4.5){color=vec3f(.64,.12,1.8);}if(k>8.5){color=vec3f(2.0,.025,.055);}}
 color=mix(color,vec3f(2.5,1.8,1.1),clamp(core*.7,0.0,1.0));
 output.color=vec4f(color,clamp(alpha*(.92+.08*sin(t*29.0+seed)),0.0,.95));return output;
}`;
