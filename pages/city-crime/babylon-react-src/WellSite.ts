import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";

// بلوك-آوت خالص: صناديق وأسطوانات وألوان مسطحة. لا خامات PBR ولا HDRI ولا GLB.
// الهدف: تشغيل فوري بدون أي تحميل ثقيل، لضبط الأزرار والفكرة أولاً.

export type WellSiteHandle = {
  ground: Mesh;
  shadowGenerator: ShadowGenerator;
  wellMouth: Mesh;
  wellBottomY: number;
  tunnelDoor: Mesh;
  dispose: () => void;
};

function flatMaterial(scene: Scene, name: string, hex: string) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.FromHexString(hex);
  material.specularColor = Color3.FromHexString("#111111");
  return material;
}

export function createWellSite(scene: Scene, physicsEnabled: boolean): WellSiteHandle {
  // --- أرضية الحديقة (سطح) ---
  const sandMat = flatMaterial(scene, "garden-sand", "#D9C48C");
  const ground = MeshBuilder.CreateGround("garden-ground", { width: 60, height: 60 }, scene);
  ground.material = sandMat;
  const groundAggregate = physicsEnabled
    ? new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.9 }, scene)
    : null;

  // --- الفيلا: صندوق واحد بسيط في الخلفية، مجرد مرجع بصري ---
  const villaMat = flatMaterial(scene, "villa-block", "#E8E1D3");
  const villa = MeshBuilder.CreateBox("villa-blockout", { width: 10, height: 5, depth: 8 }, scene);
  villa.position.set(0, 2.5, -18);
  villa.material = villaMat;

  // --- سياج بسيط حوالين الحديقة ---
  const fenceMat = flatMaterial(scene, "fence-block", "#8A7355");
  [-29, 29].forEach((x, i) => {
    const wall = MeshBuilder.CreateBox(`fence-x-${i}`, { width: 0.6, height: 2, depth: 58 }, scene);
    wall.position.set(x, 1, 0);
    wall.material = fenceMat;
  });
  [-29, 29].forEach((z, i) => {
    const wall = MeshBuilder.CreateBox(`fence-z-${i}`, { width: 58, height: 2, depth: 0.6 }, scene);
    wall.position.set(0, 1, z);
    wall.material = fenceMat;
  });

  // --- فتحة البئر: حلقة أرضية (مرئية) + أسطوانة مجوفة بصرياً للنزول ---
  const wellRingMat = flatMaterial(scene, "well-ring", "#6B5B45");
  const wellMouth = MeshBuilder.CreateTorus("well-mouth", { diameter: 3.2, thickness: 0.5, tessellation: 24 }, scene);
  wellMouth.position.set(6, 0.15, 4);
  wellMouth.material = wellRingMat;

  const wellShaftMat = flatMaterial(scene, "well-shaft", "#3A3128");
  const wellShaft = MeshBuilder.CreateCylinder("well-shaft", { diameterTop: 3, diameterBottom: 3, height: 14, tessellation: 24, sideOrientation: Mesh.BACKSIDE }, scene);
  wellShaft.position.set(6, -7, 4);
  wellShaft.material = wellShaftMat;

  // قاعدة السرداب أسفل البئر (أرضية جديدة تحت الأرض)
  const wellBottomY = -14;
  const tunnelFloorMat = flatMaterial(scene, "tunnel-floor", "#4A4438");
  const tunnelFloor = MeshBuilder.CreateGround("tunnel-floor", { width: 10, height: 26 }, scene);
  tunnelFloor.position.set(6, wellBottomY, 12);
  tunnelFloor.material = tunnelFloorMat;
  const tunnelFloorAggregate = physicsEnabled
    ? new PhysicsAggregate(tunnelFloor, PhysicsShapeType.BOX, { mass: 0, friction: 0.9 }, scene)
    : null;

  // جدران السرداب (ممر بسيط)
  const tunnelWallMat = flatMaterial(scene, "tunnel-wall", "#5C5342");
  [-5, 5].forEach((offsetX, i) => {
    const wall = MeshBuilder.CreateBox(`tunnel-wall-${i}`, { width: 0.5, height: 4, depth: 26 }, scene);
    wall.position.set(6 + offsetX, wellBottomY + 2, 12);
    wall.material = tunnelWallMat;
  });
  const tunnelCeilingMat = flatMaterial(scene, "tunnel-ceiling", "#2E2A22");
  const tunnelCeiling = MeshBuilder.CreateBox("tunnel-ceiling", { width: 10, height: 0.4, depth: 26 }, scene);
  tunnelCeiling.position.set(6, wellBottomY + 4, 12);
  tunnelCeiling.material = tunnelCeilingMat;

  // --- عائق بسيط (حجر يُدفع) في منتصف السرداب — أول لغز ---
  const stoneMat = flatMaterial(scene, "push-stone", "#7A6C55");
  const pushStone = MeshBuilder.CreateBox("push-stone", { width: 1.6, height: 1.6, depth: 1.6 }, scene);
  pushStone.position.set(6, wellBottomY + 0.8, 8);
  pushStone.material = stoneMat;
  const pushStoneAggregate = physicsEnabled
    ? new PhysicsAggregate(pushStone, PhysicsShapeType.BOX, { mass: 40, friction: 0.6 }, scene)
    : null;

  // --- الباب الحجري الضخم (نهاية المرحلة) ---
  const doorMat = flatMaterial(scene, "stone-door", "#4B4130");
  const tunnelDoor = MeshBuilder.CreateBox("tunnel-door", { width: 4.4, height: 3.8, depth: 0.5 }, scene);
  tunnelDoor.position.set(6, wellBottomY + 1.9, 23);
  tunnelDoor.material = doorMat;

  // --- إضاءة ---
  const sun = new DirectionalLight("garden-sun", new Vector3(-0.5, -0.85, 0.3), scene);
  sun.position = new Vector3(20, 24, -20);
  sun.intensity = 3.6;
  sun.diffuse = Color3.FromHexString("#FFEBC8");
  const fill = new HemisphericLight("sky-fill", new Vector3(0.1, 1, -0.2), scene);
  fill.intensity = 0.55;
  fill.diffuse = Color3.FromHexString("#CFE0EE");
  fill.groundColor = Color3.FromHexString("#2A2620");

  // إضاءة داخلية خافتة للسرداب (بدون HDRI)
  const tunnelLight = new HemisphericLight("tunnel-fill", new Vector3(0, 1, 0), scene);
  tunnelLight.intensity = 0.35;
  tunnelLight.diffuse = Color3.FromHexString("#8FA8C0");
  tunnelLight.groundColor = Color3.FromHexString("#101014");

  const shadowGenerator = new ShadowGenerator(1024, sun, true);
  shadowGenerator.usePercentageCloserFiltering = true;

  return {
    ground,
    shadowGenerator,
    wellMouth,
    wellBottomY,
    tunnelDoor,
    dispose: () => {
      groundAggregate?.dispose();
      tunnelFloorAggregate?.dispose();
      pushStoneAggregate?.dispose();
    },
  };
}
