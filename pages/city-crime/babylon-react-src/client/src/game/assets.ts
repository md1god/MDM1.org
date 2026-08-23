import "@babylonjs/loaders/glTF";

const publishAsset = (fileName: string, developmentPath: string) => (
  import.meta.env.DEV ? developmentPath : new URL(`game-assets/${fileName}`, document.baseURI).toString()
);

// خامات الشارع الحضري القديمة (asphalt/concrete/daylightHdr) أُزيلت مع حذف
// Environment.ts وVehicle.ts. عند إضافة خامات حقيقية لاحقاً (فيلا، سرداب)
// تُضاف هنا بنفس النمط.
export const assets = {
  havokWasm: publishAsset("HavokPhysics.wasm", "/manus-storage/HavokPhysics_51481a86.wasm"),
} as const;
