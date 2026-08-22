import{d as e}from"./index-DNVpF50N.js";import{k as d}from"./kernelBlurVaryingDeclaration-Cl05a3E4.js";const n="kernelBlurVertex",o="sampleCoord{X}=sampleCenter+delta*KERNEL_OFFSET{X};";e.IncludesShadersStore[n]||(e.IncludesShadersStore[n]=o);const s={name:n,shader:o},a="kernelBlurVertexShader",t=`attribute vec2 position;uniform vec2 delta;varying vec2 sampleCenter;
#include<kernelBlurVaryingDeclaration>[0..varyingCount]
const vec2 madd=vec2(0.5,0.5);
#define CUSTOM_VERTEX_DEFINITIONS
void main(void) {
#define CUSTOM_VERTEX_MAIN_BEGIN
sampleCenter=(position*madd+madd);
#include<kernelBlurVertex>[0..varyingCount]
gl_Position=vec4(position,0.0,1.0);
#define CUSTOM_VERTEX_MAIN_END
}`;e.ShadersStore[a]||(e.ShadersStore[a]=t);const i=[d,s];for(const r of i)e.IncludesShadersStore[r.name]||(e.IncludesShadersStore[r.name]=r.shader);const S={name:a,shader:t};export{S as kernelBlurVertexShader};
