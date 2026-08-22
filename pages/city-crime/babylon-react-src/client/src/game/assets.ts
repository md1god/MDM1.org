import "@babylonjs/loaders/glTF";

const publishAsset = (fileName: string, developmentPath: string) => (
  import.meta.env.DEV ? developmentPath : new URL(`game-assets/${fileName}`, document.baseURI).toString()
);

export const assets = {
  asphalt: {
    diffuse: publishAsset("asphalt_diff_2k.jpg", "/manus-storage/asphalt_diff_2k_9fa4ba4e.jpg"),
    normal: publishAsset("asphalt_normal_2k.jpg", "/manus-storage/asphalt_normal_2k_269f9e53.jpg"),
    roughness: publishAsset("asphalt_roughness_2k.jpg", "/manus-storage/asphalt_roughness_2k_3c86db6e.jpg"),
  },
  concrete: {
    diffuse: publishAsset("concrete_diff_2k.jpg", "/manus-storage/concrete_diff_2k_5023af34.jpg"),
    normal: publishAsset("concrete_normal_2k.jpg", "/manus-storage/concrete_normal_2k_5ab78430.jpg"),
    roughness: publishAsset("concrete_roughness_2k.jpg", "/manus-storage/concrete_roughness_2k_c69508cc.jpg"),
  },
  daylightHdr: publishAsset("kloppenheim_06_puresky_1k.hdr", "/manus-storage/kloppenheim_06_puresky_1k_03e03c41.hdr"),
  havokWasm: publishAsset("HavokPhysics.wasm", "/manus-storage/HavokPhysics_51481a86.wasm"),
} as const;
