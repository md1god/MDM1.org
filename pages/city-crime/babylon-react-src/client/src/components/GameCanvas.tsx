import { useEffect, useRef, useState, useCallback } from "react";
import type { GameHandle } from "@/game/scene";
import type { GameEngine } from "@/game/engine";
import { initialHudState, type HudState } from "@/game/types";
import { Hud } from "./Hud";
import type { InputManager } from "@/game/InputManager";

function mergeHudState(current: HudState, patch: Partial<HudState>): HudState {
  return {
    ...current,
    ...patch,
    loading: { ...current.loading, ...patch.loading },
    player: { ...current.player, ...patch.player },
    mission: { ...current.mission, ...patch.mission },
  };
}

function MobileControls({ inputRef }: { inputRef: React.MutableRefObject<InputManager | null> }) {
  const touchId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const onJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touchId.current = touch.identifier;
    origin.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onJoystickMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchId.current) {
        const dx = t.clientX - origin.current.x;
        const dy = t.clientY - origin.current.y;
        const max = 40;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = dist > max ? max / dist : 1;
        setPos({ x: dx * scale, y: dy * scale });
        inputRef.current?.setButton("w", dy < -8);
        inputRef.current?.setButton("s", dy > 8);
        inputRef.current?.setButton("a", dx < -8);
        inputRef.current?.setButton("d", dx > 8);
      }
    }
  }, [inputRef]);

  const onJoystickEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId.current) {
        touchId.current = null;
        setPos({ x: 0, y: 0 });
        inputRef.current?.setButton("w", false);
        inputRef.current?.setButton("s", false);
        inputRef.current?.setButton("a", false);
        inputRef.current?.setButton("d", false);
      }
    }
  }, [inputRef]);

  const btn = (label: string, key: "w" | "a" | "s" | "d" | "shift" | "e") => (
    <button
      onTouchStart={(e) => { e.preventDefault(); inputRef.current?.setButton(key, true); }}
      onTouchEnd={(e) => { e.preventDefault(); inputRef.current?.setButton(key, false); }}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "1px solid rgba(244,166,42,0.5)",
        background: "rgba(0,0,0,0.55)",
        color: "#f4a62a",
        fontSize: "1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* جويستيك */}
      <div
        style={{ position: "fixed", bottom: 30, left: 20, width: 100, height: 100, zIndex: 200, touchAction: "none" }}
        onTouchStart={onJoystickStart}
        onTouchMove={onJoystickMove}
        onTouchEnd={onJoystickEnd}
      >
        <div style={{
          width: "100%", height: "100%", borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.3)",
          position: "relative"
        }}>
          <div style={{
            position: "absolute", left: "50%", top: "50%", width: 36, height: 36,
            marginLeft: -18, marginTop: -18, borderRadius: "50%",
            background: "rgba(244,166,42,0.5)",
            transform: `translate(${pos.x}px, ${pos.y}px)`
          }} />
        </div>
      </div>

      {/* أزرار يمين */}
      <div style={{ position: "fixed", bottom: 30, right: 20, zIndex: 200, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>{btn("▲", "w")}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {btn("◀", "a")}
          {btn("▼", "s")}
          {btn("▶", "d")}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            onTouchStart={(e) => { e.preventDefault(); inputRef.current?.setButton("shift", true); }}
            onTouchEnd={(e) => { e.preventDefault(); inputRef.current?.setButton("shift", false); }}
            style={{ width: 50, height: 40, borderRadius: 8, background: "rgba(0,0,0,0.55)", color: "#f4a62a", border: "1px solid rgba(244,166,42,0.5)", fontSize: "1rem" }}
          >🏃</button>
          <button
            onTouchStart={(e) => { e.preventDefault(); inputRef.current?.setButton("e", true); }}
            onTouchEnd={(e) => { e.preventDefault(); inputRef.current?.setButton("e", false); }}
            style={{ width: 50, height: 40, borderRadius: 8, background: "rgba(0,0,0,0.55)", color: "#fff", border: "1px solid rgba(42,120,200,0.5)", fontSize: "1rem" }}
          >E</button>
        </div>
      </div>
    </>
  );
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const [hud, setHud] = useState<HudState>(initialHudState);
  const [showMobile, setShowMobile] = useState(false);
  const inputRef = useRef<InputManager | null>(null);

  useEffect(() => {
    setShowMobile("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

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
        const benchmark = demo ? { averageFps: 60, tier: "High" as const } : await runSceneBenchmark(engine);
        if (disposed) return;
        updateHud({
          tier: benchmark.tier,
          fps: benchmark.averageFps,
          loading: { label: `ضبط الجودة: ${benchmark.tier}`, progress: 24, active: true },
        });
        const { createGameScene } = await import("@/game/scene");
        handle = await createGameScene(engine, canvas, benchmark.tier, updateHud, demo);
        if (disposed) { handle.dispose(); return; }
        inputRef.current = handle.inputManager;
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
    <main className="game-shell" style={{ position: "fixed", inset: 0, background: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <Hud state={hud} />
      {showMobile && <MobileControls inputRef={inputRef} />}
    </main>
  );
}
