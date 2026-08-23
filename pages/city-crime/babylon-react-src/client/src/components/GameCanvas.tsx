import { useEffect, useRef, useState } from "react";
import type { GameHandle } from "@/game/scene";
import type { GameEngine } from "@/game/engine";
import type { InputManager } from "@/game/InputManager";
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
  const inputManagerRef = useRef<InputManager | null>(null);

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
        updateHud({
          engine: selection.kind,
          loading: { label: demo ? "تجهيز العرض التلقائي" : "قياس الأداء الفعلي", progress: 13, active: true },
        });
        const benchmark = demo
          ? { averageFps: 60, tier: "High" as const }
          : await runSceneBenchmark(engine);
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
        inputManagerRef.current = handle.inputManager; // ✅ حفظ المرجع
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

  // ✅ دوال الأزرار
  const handleRunTouchStart = () => inputManagerRef.current?.setTouchRunning(true);
  const handleRunTouchEnd = () => inputManagerRef.current?.setTouchRunning(false);
  const handleInteractClick = () => inputManagerRef.current?.queueTouchInteract();

  return (
    <main className="game-shell" aria-label="لعبة City Crime">
      <canvas ref={canvasRef} className="game-canvas" aria-label="مشهد City Crime ثلاثي الأبعاد" />
      <Hud state={hud} />

      {/* أزرار تحكم للموبايل */}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          zIndex: 200,
        }}
      >
        <button
          onTouchStart={handleRunTouchStart}
          onTouchEnd={handleRunTouchEnd}
          onMouseDown={handleRunTouchStart}
          onMouseUp={handleRunTouchEnd}
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(244,166,42,0.7)",
            color: "#0a0e14",
            fontSize: 14,
            fontWeight: 700,
            border: "2px solid rgba(255,255,255,0.3)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
          }}
        >
          🏃
        </button>
        <button
          onClick={handleInteractClick}
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(42,120,200,0.7)",
            color: "#fff",
            fontSize: 18,
            fontWeight: 700,
            border: "2px solid rgba(255,255,255,0.3)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
          }}
        >
          E
        </button>
      </div>
    </main>
  );
}
