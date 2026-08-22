import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Scene } from "@babylonjs/core/scene";
import type { EngineKind, QualityTier } from "./types";

export type GameEngine = Engine | WebGPUEngine;

export type EngineSelection = {
  engine: GameEngine;
  kind: EngineKind;
};

export type BenchmarkResult = {
  averageFps: number;
  tier: QualityTier;
};

export async function createPreferredEngine(canvas: HTMLCanvasElement): Promise<EngineSelection> {
  try {
    const supported = await WebGPUEngine.IsSupportedAsync;
    if (supported) {
      const engine = new WebGPUEngine(canvas, {
        adaptToDeviceRatio: true,
        antialias: true,
      });
      await engine.initAsync();
      return { engine, kind: "WebGPU" };
    }
  } catch (error) {
    console.warn("WebGPU init failed; using WebGL2 fallback.", error);
  }

  return {
    engine: new Engine(canvas, true, {
      adaptToDeviceRatio: true,
      preserveDrawingBuffer: false,
      stencil: true,
      powerPreference: "high-performance",
    }),
    kind: "WebGL2",
  };
}

export async function runSceneBenchmark(engine: GameEngine): Promise<BenchmarkResult> {
  const scene = new Scene(engine);
  scene.clearColor.set(0.026, 0.036, 0.052, 1);

  const camera = new FreeCamera("benchmark-camera", new Vector3(0, 7, -13), scene);
  camera.setTarget(new Vector3(0, 0, 0));
  new HemisphericLight("benchmark-light", new Vector3(0.35, 1, 0.2), scene).intensity = 0.9;

  const material = new StandardMaterial("benchmark-material", scene);
  material.diffuseColor = new Color3(0.27, 0.52, 0.72);
  material.specularColor = new Color3(0.35, 0.35, 0.35);

  for (let index = 0; index < 90; index += 1) {
    const mesh = MeshBuilder.CreateBox(`benchmark-${index}`, { size: 0.9 }, scene);
    mesh.position.set((index % 10) - 4.5, Math.floor(index / 30) * 0.92, Math.floor(index / 10) - 4.5);
    mesh.rotation.set(index * 0.08, index * 0.13, 0);
    mesh.material = material;
  }

  return new Promise((resolve) => {
    const samples: number[] = [];
    const start = performance.now();
    let lastFrame = start;

    const render = (now: number) => {
      const frameTime = Math.max(1, now - lastFrame);
      lastFrame = now;
      samples.push(1000 / frameTime);
      scene.render();

      if (now - start < 2400) {
        window.requestAnimationFrame(render);
        return;
      }

      const recent = samples.slice(Math.max(0, samples.length - 120));
      const averageFps = recent.reduce((total, value) => total + value, 0) / Math.max(1, recent.length);
      scene.dispose();

      const tier: QualityTier =
        averageFps >= 57 ? "Ultra" : averageFps >= 47 ? "High" : averageFps >= 34 ? "Medium" : "Low";
      resolve({ averageFps: Math.round(averageFps), tier });
    };

    window.requestAnimationFrame(render);
  });
}
