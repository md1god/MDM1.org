import{d}from"./index-DNVpF50N.js";const e="bumpVertexDeclaration",n=`#if defined(BUMP) || defined(PARALLAX) || defined(CLEARCOAT_BUMP) || defined(ANISOTROPIC)
#if defined(TANGENT) && defined(NORMAL) 
varying vTBN0: vec3f;varying vTBN1: vec3f;varying vTBN2: vec3f;
#endif
#endif
`;d.IncludesShadersStoreWGSL[e]||(d.IncludesShadersStoreWGSL[e]=n);const r={name:e,shader:n};export{r as b};
