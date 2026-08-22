import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Material } from "@babylonjs/core/Materials/material";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { HDRCubeTexture } from "@babylonjs/core/Materials/Textures/hdrCubeTexture";
import { Scene } from "@babylonjs/core/scene";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import "@babylonjs/core/Shaders/pbr.vertex";
import "@babylonjs/core/Shaders/pbr.fragment";
import { assets } from "./assets";

type Progress = (label: string, completed: number, total: number) => void;

export type EnvironmentHandle = {
  ground: Mesh;
  shadowGenerator: ShadowGenerator;
  ready: Promise<void>;
  dispose: () => void;
};

function trackTexture(texture: Texture, label: string, progress: Progress, progressState: { completed: number; total: number }) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      progressState.completed += 1;
      progress(label, progressState.completed, progressState.total);
      resolve();
    };
    texture.onLoadObservable.addOnce(settle);
    const timeoutId = window.setTimeout(settle, 6500);
    if (texture.isReady()) window.queueMicrotask(settle);
  });
}

function createPbrMaterial(
  name: string,
  scene: Scene,
  source: typeof assets.asphalt | typeof assets.concrete,
  tileScale: number,
  progress: Progress,
  progressState: { completed: number; total: number },
): { material: Material; ready: Promise<void> } {
  const usePbr = scene.getEngine().getClassName() === "WebGPUEngine";
  const material: PBRMaterial | StandardMaterial = usePbr ? new PBRMaterial(name, scene) : new StandardMaterial(name, scene);
  if (material instanceof PBRMaterial) {
    material.metallic = 0.03;
    material.roughness = 0.88;
    material.environmentIntensity = 0.52;
  } else {
    material.specularColor = Color3.FromHexString("#20242A");
    material.specularPower = 32;
  }

  const diffuse = new Texture(source.diffuse, scene, true, false);
  const normal = new Texture(source.normal, scene, true, false);
  const roughness = new Texture(source.roughness, scene, true, false);
  [diffuse, normal, roughness].forEach((texture) => {
    texture.uScale = tileScale;
    texture.vScale = tileScale;
  });
  if (material instanceof PBRMaterial) {
    material.albedoTexture = diffuse;
    material.bumpTexture = normal;
    material.microSurfaceTexture = roughness;
    material.invertNormalMapX = true;
  } else {
    material.diffuseTexture = diffuse;
    material.bumpTexture = normal;
    material.invertNormalMapX = true;
  }

  const textureEntries: readonly [string, Texture][] = [
    ["لون الخامة", diffuse],
    ["التفاصيل الطبيعية", normal],
    ["خشونة السطح", roughness],
  ];
  const ready = Promise.all(textureEntries.map(([label, texture]) => trackTexture(texture, `${name}: ${label}`, progress, progressState))).then(() => undefined);
  return { material, ready };
}

function createBuilding(scene: Scene, concrete: Material, index: number, position: Vector3, size: Vector3) {
  const building = MeshBuilder.CreateBox(`building-${index}`, { width: size.x, height: size.y, depth: size.z }, scene);
  building.position.copyFrom(position);
  building.position.y = size.y / 2;
  building.material = concrete;

  const glass = new StandardMaterial(`building-glass-${index}`, scene);
  glass.diffuseColor = Color3.FromHexString("#162738");
  glass.specularColor = Color3.FromHexString("#7AA4BB");
  glass.emissiveColor = Color3.FromHexString("#07111C");
  glass.alpha = 0.93;

  const columns = Math.max(2, Math.floor(size.x / 2.3));
  const rows = Math.max(2, Math.floor(size.y / 2.5));
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const window = MeshBuilder.CreateBox(`building-window-${index}-${column}-${row}`, {
        width: Math.min(1.1, size.x / columns - 0.22),
        height: 1.3,
        depth: 0.05,
      }, scene);
      window.parent = building;
      window.position.x = -size.x / 2 + (column + 0.5) * (size.x / columns);
      window.position.y = -size.y / 2 + 1.28 + row * 2.32;
      window.position.z = size.z / 2 + 0.035;
      window.material = glass;
    }
  }

  const roof = MeshBuilder.CreateBox(`building-roof-${index}`, { width: size.x + 0.3, height: 0.16, depth: size.z + 0.3 }, scene);
  roof.parent = building;
  roof.position.y = size.y / 2 + 0.08;
  roof.material = concrete;
  return building;
}

function createRoadMarkings(scene: Scene) {
  const paint = new StandardMaterial("road-paint", scene);
  paint.diffuseColor = Color3.FromHexString("#D1B16A");
  paint.specularColor = Color3.FromHexString("#3A3020");
  for (let z = -30; z <= 30; z += 4) {
    const line = MeshBuilder.CreateBox(`road-mark-${z}`, { width: 0.14, height: 0.024, depth: 1.75 }, scene);
    line.position.set(0, 0.027, z);
    line.material = paint;
  }
  for (let x = -24; x <= 24; x += 4) {
    const line = MeshBuilder.CreateBox(`cross-mark-${x}`, { width: 1.75, height: 0.024, depth: 0.14 }, scene);
    line.position.set(x, 0.028, 0);
    line.material = paint;
  }
}

function createMissionRoute(scene: Scene) {
  const amber = new StandardMaterial("objective-amber-route", scene);
  amber.diffuseColor = Color3.FromHexString("#F4A62A");
  amber.emissiveColor = Color3.FromHexString("#A65A08");
  amber.specularColor = Color3.FromHexString("#FFF0C7");

  // Route starts at the first-person spawn, then turns toward the parked vehicle.
  [-9.8, -7.8, -5.8, -3.8, -1.8, 0.2].forEach((z, index) => {
    const segment = MeshBuilder.CreateBox(`objective-route-z-${index}`, { width: 0.24, height: 0.035, depth: 0.9 }, scene);
    segment.position.set(1.05, 0.04, z);
    segment.material = amber;
  });
  [1.8, 3.2, 4.6].forEach((x, index) => {
    const segment = MeshBuilder.CreateBox(`objective-route-x-${index}`, { width: 0.9, height: 0.035, depth: 0.24 }, scene);
    segment.position.set(x, 0.04, 1.35);
    segment.material = amber;
  });
  const ring = MeshBuilder.CreateTorus("objective-vehicle-ring", { diameter: 1.8, thickness: 0.075, tessellation: 24 }, scene);
  ring.position.set(5.5, 0.06, 3.5);
  ring.rotation.x = Math.PI / 2;
  ring.material = amber;
  const beacon = MeshBuilder.CreateCylinder("objective-beacon", { height: 2.4, diameterTop: 0.08, diameterBottom: 0.18, tessellation: 12 }, scene);
  beacon.position.set(5.5, 1.2, 3.5);
  beacon.material = amber;
}

function createStreetProps(scene: Scene) {
  const metal = new StandardMaterial("street-metal", scene);
  metal.diffuseColor = Color3.FromHexString("#303C46");
  metal.specularColor = Color3.FromHexString("#A7C1CE");
  const amber = new StandardMaterial("traffic-amber", scene);
  amber.diffuseColor = Color3.FromHexString("#F4A62A");
  amber.emissiveColor = Color3.FromHexString("#B86D0D");
  amber.roughness = 0.36;

  [[-7.6, -7.6], [7.6, -7.6], [-7.6, 7.6], [7.6, 7.6]].forEach(([x, z], index) => {
    const pole = MeshBuilder.CreateCylinder(`traffic-pole-${index}`, { height: 5.8, diameter: 0.15, tessellation: 12 }, scene);
    pole.position.set(x, 2.9, z);
    pole.material = metal;
    const signal = MeshBuilder.CreateBox(`traffic-signal-${index}`, { width: 0.42, height: 0.92, depth: 0.28 }, scene);
    signal.position.set(x, 5.15, z);
    signal.material = metal;
    const lens = MeshBuilder.CreateSphere(`traffic-lens-${index}`, { diameter: 0.18, segments: 12 }, scene);
    lens.position.set(x, 5.28, z + (z < 0 ? 0.16 : -0.16));
    lens.material = amber;
  });

  [[-8.6, 13], [8.6, 13], [-8.6, -13], [8.6, -13]].forEach(([x, z], index) => {
    const lamp = MeshBuilder.CreateCylinder(`street-lamp-${index}`, { height: 7, diameter: 0.12, tessellation: 12 }, scene);
    lamp.position.set(x, 3.5, z);
    lamp.material = metal;
    const head = MeshBuilder.CreateSphere(`street-lamp-head-${index}`, { diameter: 0.32, segments: 12 }, scene);
    head.position.set(x, 6.82, z);
    head.material = amber;
  });

  const bollard = new StandardMaterial("street-bollard", scene);
  bollard.diffuseColor = Color3.FromHexString("#4B5961");
  bollard.specularColor = Color3.FromHexString("#C5D0D6");
  [-10.5, -8.9, 8.9, 10.5].forEach((x, index) => {
    const post = MeshBuilder.CreateCylinder(`sidewalk-bollard-${index}`, { height: 0.78, diameter: 0.16, tessellation: 12 }, scene);
    post.position.set(x, 0.39, -5.6);
    post.material = bollard;
  });
}

export async function createEnvironment(scene: Scene, progress: Progress, physicsEnabled: boolean): Promise<EnvironmentHandle> {
  const progressState = { completed: 0, total: 8 };
  const asphalt = createPbrMaterial("إسفلت Poly Haven", scene, assets.asphalt, 12, progress, progressState);
  const concrete = createPbrMaterial("خرسانة Poly Haven", scene, assets.concrete, 5, progress, progressState);

  const hdr = new HDRCubeTexture(assets.daylightHdr, scene, 128, false, true, false, true);
  scene.environmentTexture = hdr;
  scene.environmentIntensity = 0.78;
  progressState.completed += 1;
  progress("إضاءة البيئة HDRI", progressState.completed, progressState.total);

  const ground = MeshBuilder.CreateGround("city-ground", { width: 62, height: 62, subdivisions: 2 }, scene);
  ground.material = asphalt.material;
  const groundAggregate = physicsEnabled ? new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.92, restitution: 0.02 }, scene) : null;

  const sidewalkMaterial = concrete.material.clone("sidewalk-concrete") as Material;
  if (sidewalkMaterial instanceof PBRMaterial) sidewalkMaterial.albedoColor = Color3.FromHexString("#B7B6AE");
  if (sidewalkMaterial instanceof StandardMaterial) sidewalkMaterial.diffuseColor = Color3.FromHexString("#B7B6AE");
  const sidewalks = [
    { x: -12.2, z: 0, width: 5.8, depth: 62 },
    { x: 12.2, z: 0, width: 5.8, depth: 62 },
    { x: 0, z: -12.2, width: 24, depth: 5.8 },
    { x: 0, z: 12.2, width: 24, depth: 5.8 },
  ];
  sidewalks.forEach((sidewalk, index) => {
    const mesh = MeshBuilder.CreateBox(`sidewalk-${index}`, { width: sidewalk.width, height: 0.17, depth: sidewalk.depth }, scene);
    mesh.position.set(sidewalk.x, 0.08, sidewalk.z);
    mesh.material = sidewalkMaterial;
  });
  const curbMaterial = new StandardMaterial("street-curb", scene);
  curbMaterial.diffuseColor = Color3.FromHexString("#8E9190");
  curbMaterial.specularColor = Color3.FromHexString("#D7DED9");
  [-9.18, 9.18].forEach((x, index) => {
    const curb = MeshBuilder.CreateBox(`long-curb-${index}`, { width: 0.28, height: 0.22, depth: 56 }, scene);
    curb.position.set(x, 0.11, 0);
    curb.material = curbMaterial;
  });
  [-9.18, 9.18].forEach((z, index) => {
    const curb = MeshBuilder.CreateBox(`cross-curb-${index}`, { width: 18.4, height: 0.22, depth: 0.28 }, scene);
    curb.position.set(0, 0.11, z);
    curb.material = curbMaterial;
  });
  createRoadMarkings(scene);
  createMissionRoute(scene);
  createStreetProps(scene);

  [
    [new Vector3(-18, 0, -17), new Vector3(8, 12, 8)],
    [new Vector3(17, 0, -16), new Vector3(7, 16, 9)],
    [new Vector3(-18, 0, 17), new Vector3(8, 20, 7)],
    [new Vector3(18, 0, 17), new Vector3(8, 11, 9)],
    [new Vector3(-26, 0, 2), new Vector3(6, 8, 11)],
    [new Vector3(26, 0, 1), new Vector3(6, 13, 10)],
  ].forEach(([position, size], index) => createBuilding(scene, concrete.material, index, position, size));

  const sun = new DirectionalLight("late-afternoon-sun", new Vector3(-0.61, -0.74, 0.32), scene);
  sun.position = new Vector3(30, 26, -28);
  sun.intensity = 4.1;
  sun.diffuse = Color3.FromHexString("#FFE0B8");
  const fill = new HemisphericLight("blue-sky-fill", new Vector3(0.15, 1, -0.28), scene);
  fill.intensity = 0.46;
  fill.diffuse = Color3.FromHexString("#A6BFDA");
  fill.groundColor = Color3.FromHexString("#1D2429");
  const shadowGenerator = new ShadowGenerator(1536, sun, true);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadowGenerator.bias = 0.00025;
  progressState.completed += 1;
  progress("هندسة الشارع والظلال", progressState.completed, progressState.total);

  return {
    ground,
    shadowGenerator,
    ready: Promise.all([asphalt.ready, concrete.ready]).then(() => undefined),
    dispose: () => {
      groundAggregate?.dispose();
      hdr.dispose();
    },
  };
}
