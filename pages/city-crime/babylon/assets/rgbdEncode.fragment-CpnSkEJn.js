import{d as e}from"./index-DNVpF50N.js";import{h as n}from"./helperFunctions-C2YSIN10.js";const t="rgbdEncodePixelShader",a=`varying vUV: vec2f;var textureSamplerSampler: sampler;var textureSampler: texture_2d<f32>;
#include<helperFunctions>
#define CUSTOM_FRAGMENT_DEFINITIONS
@fragment
fn main(input: FragmentInputs)->FragmentOutputs {fragmentOutputs.color=toRGBD(textureSample(textureSampler,textureSamplerSampler,input.vUV).rgb);}`;e.ShadersStoreWGSL[t]||(e.ShadersStoreWGSL[t]=a);const S=[n];for(const r of S)e.IncludesShadersStoreWGSL[r.name]||(e.IncludesShadersStoreWGSL[r.name]=r.shader);const d={name:t,shader:a};export{d as rgbdEncodePixelShaderWGSL};
