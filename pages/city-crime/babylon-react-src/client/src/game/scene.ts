import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import type { GameEngine } from "./engine";
import type { HudUpdate, QualityTier } from "./types";
import { GameWorld } from "./GameWorld";
import { assets } from "./assets";

export type GameHandle = {
  scene: Scene;
  dispose: () => void;
};

export async function createGameScene(
  engine: GameEngine,
  canvas: HTMLCanvasElement,
  tier: QualityTier,
  updateHud: HudUpdate,
  demo = false,
): Promise<GameHandle> {
  updateHud({ loading: { label: "تفعيل محرك الفيزياء", progress: 24, active: true } });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.12, 0.17, 0.22, 1);
  scene.collisionsEnabled = true;

  let physicsEnabled = false;
  try {
    if (demo) throw new Error("Demo mode uses deterministic movement fallback.");
    const havokUrl = new URL(assets.havokWasm, window.location.origin).toString();
    console.info("Initializing Havok physics from", havokUrl);
    const havokInstance = await Promise.race([
      HavokPhysics({ locateFile: (fileName: string) => (fileName.endsWith(".wasm") ? havokUrl : fileName) }),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Havok initialization timed out after 4.5 seconds")), 4500);
      }),
    ]);
    physicsEnabled = scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, havokInstance));
    if (!physicsEnabled) throw new Error("Babylon scene rejected the Havok physics plugin");
    console.info("Havok physics enabled.");
  } catch (error) {
    console.warn("Havok could not initialize; the scene will use movement fallbacks.", error);
    updateHud({ loading: { label: "تعذر تسريع الفيزياء — متابعة التهيئة", progress: 27, active: true } });
  }

  const world = new GameWorld(scene, engine, canvas, tier, updateHud, physicsEnabled, demo);
  await world.initialize();
  scene.onBeforeRenderObservable.add(() => world.update(Math.min(0.05, engine.getDeltaTime() / 1000)));

  return {
    scene,
    dispose: () => {
      world.dispose();
      scene.dispose();
    },
  };
}
