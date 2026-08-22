import{d as o}from"./index-DNVpF50N.js";const e="vertexColorMixing",d=`#if defined(VERTEXCOLOR) || defined(INSTANCESCOLOR) && defined(INSTANCES)
vColor=vec4(1.0);
#ifdef VERTEXCOLOR
#ifdef VERTEXALPHA
vColor*=colorUpdated;
#else
vColor.rgb*=colorUpdated.rgb;
#endif
#endif
#ifdef INSTANCESCOLOR
vColor*=instanceColor;
#endif
#endif
`;o.IncludesShadersStore[e]||(o.IncludesShadersStore[e]=d);const i={name:e,shader:d};export{i as v};
