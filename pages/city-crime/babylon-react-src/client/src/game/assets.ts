import "@babylonjs/loaders/glTF";

const publishAsset = (fileName: string, developmentPath: string) => (
  import.meta.env.DEV ? developmentPath : new URL(`game-assets/${fileName}`, document.baseURI).toString()
);

// خامات الشارع الحضري القديمة (asphalt/concrete/daylightHdr) أُزيلت مع حذف
// Environment.ts وVehicle.ts. عند إضافة خامات حقيقية لاحقاً (فيلا، سرداب)
// تُضاف هنا بنفس النمط.
export const assets = {
  havokWasm: "./assets/HavokPhysics-BqNY-4N9.wasm",
} as const;
