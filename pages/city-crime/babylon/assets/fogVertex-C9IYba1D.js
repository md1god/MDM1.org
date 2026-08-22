import{d as e}from"./index-DNVpF50N.js";const o="fogVertexDeclaration",s=`#ifdef FOG
varying vec3 vFogDistance;
#endif
`;e.IncludesShadersStore[o]||(e.IncludesShadersStore[o]=s);const n={name:o,shader:s},r="fogVertex",a=`#ifdef FOG
vFogDistance=(view*worldPos).xyz;
#endif
`;e.IncludesShadersStore[r]||(e.IncludesShadersStore[r]=a);const d={name:r,shader:a};export{d as a,n as f};
