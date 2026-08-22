import{d as o}from"./index-DNVpF50N.js";const e="sceneUboDeclaration",n=`struct Scene {viewProjection : mat4x4<f32>,
#ifdef MULTIVIEW
viewProjectionR : mat4x4<f32>,
#endif 
view : mat4x4<f32>,
projection : mat4x4<f32>,
vEyePosition : vec4<f32>,
inverseProjection : mat4x4<f32>,};
#define SCENE_UBO
var<uniform> scene : Scene;
`;o.IncludesShadersStoreWGSL[e]||(o.IncludesShadersStoreWGSL[e]=n);const r={name:e,shader:n};export{r as s};
