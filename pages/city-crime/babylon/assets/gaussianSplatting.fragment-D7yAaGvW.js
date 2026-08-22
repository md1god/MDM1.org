import{d as n}from"./index-DNVpF50N.js";import{c as o,a as s}from"./clipPlaneFragment-LjS3fiel.js";import{l}from"./logDepthDeclaration-BvwLZ8xp.js";import{f,a as c}from"./fogFragment-CoRD_xCO.js";import{p as g}from"./packingFunctions-CiMKs5Az.js";import{l as S}from"./logDepthFragment-BuGQUiet.js";const a="gaussianSplattingFragmentDeclaration",i=`fn gaussianColor(inColor: vec4f,inPosition: vec2f)->vec4f
{var A : f32=-dot(inPosition,inPosition);if (A>-4.0)
{var B: f32=exp(A)*inColor.a;
#include<logDepthFragment>
var color: vec3f=inColor.rgb;
#ifdef FOG
#include<fogFragment>
#endif
return vec4f(color,B);} else {return vec4f(0.0);}}
`;n.IncludesShadersStoreWGSL[a]||(n.IncludesShadersStoreWGSL[a]=i);const d={name:a,shader:i},t="gaussianSplattingPixelShader",r=`#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
#ifdef GPUPICKER_PACK_DEPTH
#include<packingFunctions>
#endif
varying vColor: vec4f;varying vPosition: vec2f;
#define CUSTOM_FRAGMENT_DEFINITIONS
#include<gaussianSplattingFragmentDeclaration>
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
var finalColor: vec4f=gaussianColor(input.vColor,input.vPosition);
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
#ifdef GPUPICKER_DEPTH
fragmentOutputs.fragData0=finalColor;
#ifdef GPUPICKER_PACK_DEPTH
fragmentOutputs.fragData1=pack(fragmentInputs.position.z);
#else
fragmentOutputs.fragData1=vec4f(fragmentInputs.position.z,0.0,0.0,1.0);
#endif
#else
fragmentOutputs.color=finalColor;
#endif
#define CUSTOM_FRAGMENT_MAIN_END
}
`;n.ShadersStoreWGSL[t]||(n.ShadersStoreWGSL[t]=r);const m=[o,l,f,g,S,c,d,s];for(const e of m)n.IncludesShadersStoreWGSL[e.name]||(n.IncludesShadersStoreWGSL[e.name]=e.shader);const v={name:t,shader:r};export{v as gaussianSplattingPixelShaderWGSL};
