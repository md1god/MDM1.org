// Concrete Meridian: React HUD يتجنب التمركز الزائد ويؤطر مشهد مدينة واقعية بلون كهرماني مخصص.
import { useEffect, useRef, useState } from "react";
import type { GameHandle } from "@/game/scene";
import type { GameEngine } from "@/game/engine";
import { initialHudState, type HudState } from "@/game/types";
import { Hud } from "./Hud";

function mergeHudState(current: HudState, patch: Partial<HudState>): HudState {
  return {
    ...current,
    ...patch,
    loading: { ...current.loading, ...patch.loading },
    player: { ...current.player, ...patch.player },
    mission: { ...current.mission, ...patch.mission },
  };
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const [hud, setHud] = useState<HudState>(initialHudState);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    let disposed = false;
    let engine: GameEngine | null = null;
    let handle: GameHandle | null = null;
    const updateHud = (patch: Partial<HudState>) => setHud((state) => mergeHudState(state, patch));

    const boot = async () => {
      try {
        const demo = new URLSearchParams(window.location.search).has("demo");
        updateHud({ loading: { label: "فحص WebGPU", progress: 7, active: true } });
        const { createPreferredEngine, runSceneBenchmark } = await import("@/game/engine");
        const selection = await createPreferredEngine(canvas);
        engine = selection.engine;
        updateHud({ engine: selection.kind, loading: { label: demo ? "تجهيز العرض التلقائي" : "قياس الأداء الفعلي", progress: 13, active: true } });
        const benchmark = demo ? { averageFps: 60, tier: "High" as const } : await runSceneBenchmark(engine);
        if (disposed) return;
        updateHud({
          tier: benchmark.tier,
          fps: benchmark.averageFps,
          loading: { label: `ضبط الجودة: ${benchmark.tier}`, progress: 24, active: true },
        });
        const { createGameScene } = await import("@/game/scene");
        handle = await createGameScene(engine, canvas, benchmark.tier, updateHud, demo);
        if (disposed) {
          handle.dispose();
          return;
        }
        engine.runRenderLoop(() => handle?.scene.render());
      } catch (error) {
        console.error("Game bootstrap failed.", error);
        updateHud({ loading: { label: "تعذر تهيئة المشهد — أعد التحميل", progress: 0, active: true } });
      }
    };

    void boot();
    const onResize = () => engine?.resize();
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      handle?.dispose();
      engine?.dispose();
      startedRef.current = false;
    };
  }, []);

  return (
    <main className="game-shell" aria-label="لعبة City Crime">
      <canvas ref={canvasRef} className="game-canvas" aria-label="مشهد City Crime ثلاثي الأبعاد" />
      <Hud state={hud} />
    </main>
  );
}
