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
  const [joystickActive, setJoystickActive] = useState(false);
  const joystickOrigin = useRef({ x: 0, y: 0 });
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const touchId = useRef<number | null>(null);

  const handleJoystickStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    touchId.current = touch.identifier;
    joystickOrigin.current = { x: touch.clientX, y: touch.clientY };
    setJoystickActive(true);
    setJoystickPos({ x: 0, y: 0 });
  }, []);

  const handleJoystickMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === touchId.current) {
        const dx = t.clientX - joystickOrigin.current.x;
        const dy = t.clientY - joystickOrigin.current.y;
        const maxR = 50;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = dist > maxR ? maxR / dist : 1;
        setJoystickPos({ x: dx * scale, y: dy * scale });
        inputRef.current?.setButton("w", dy < -10);
        inputRef.current?.setButton("s", dy > 10);
        inputRef.current?.setButton("a", dx < -10);
        inputRef.current?.setButton("d", dx > 10);
      }
    }
  }, [inputRef]);

  const handleJoystickEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId.current) {
        touchId.current = null;
        setJoystickActive(false);
        setJoystickPos({ x: 0, y: 0 });
        inputRef.current?.setButton("w", false);
        inputRef.current?.setButton("s", false);
        inputRef.current?.setButton("a", false);
        inputRef.current?.setButton("d", false);
      }
    }
  }, [inputRef]);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    width: 56,
    height: 56,
    borderRadius: "50%",
    border: "2px solid rgba(244,166,42,0.5)",
    background: active ? "rgba(244,166,42,0.4)" : "rgba(0,0,0,0.5)",
    color: "#f4a62a",
    fontSize: "1.2rem",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    touchAction: "none",
    cursor: "pointer",
    backdropFilter: "blur(4px)",
    transition: "background 0.1s",
  });

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 40,
          left: 40,
          width: 120,
          height: 120,
          zIndex: 200,
          touchAction: "none",
        }}
        onTouchStart={handleJoystickStart}
        onTouchMove={handleJoystickMove}
        onTouchEnd={handleJoystickEnd}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.3)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 44,
              height: 44,
              marginLeft: -22,
              marginTop: -22,
              borderRadius: "50%",
              background: "rgba(244,166,42,0.5)",
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              transition: "transform 0.05s",
              opacity: joystickActive ? 1 : 0.5,
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 40,
          right: 30,
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <button
            style={btnStyle(false)}
            onTouchStart={(e) => { e.preventDefault(); inputRef.current?.setButton("w", true); }}
            onTouchEnd={(e) => { e.preventDefault(); inputRef.current?.setButton("w", false); }}
          >▲</button>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            style={btnStyle(false)}
            onTouchStart={(e) => { e.preventDefault(); inputRef.current?.setButton("a", true); }}
            onTouchEnd={(e) => { e.preventDefault(); inputRef.current?.setButton("a", false); }}
          >◀</button>
          <button
            style={btnStyle(false)}
            onTouchStart={(e) => { e.preventDefault(); inputRef.current?.setButton("s", true); }}
            onTouchEnd={(e) => { e.preventDefault(); inputRef.current?.setButton("s", false); }}
          >▼</button>
          <button
            style={btnStyle(false)}
            onTouchStart={(e) => { e.preventDefault(); inputRef.current?.setButton("d", true); }}
            onTouchEnd={(e) => { e.preventDefault(); inputRef.current?.setButton("d", false); }}
          >▶</button>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button
            style={{ ...btnStyle(false), width: 70, borderRadius: 12 }}
            onTouchStart={(e) => { e.preventDefault(); inputRef.current?.setButton("shift", true); }}
            onTouchEnd={(e) => { e.preventDefault(); inputRef.current?.setButton("shift", false); }}
          >🏃</button>
          <button
            style={{ ...btnStyle(false), width: 70, borderRadius: 12 }}
            onTouchStart={(e) => { e.preventDefault(); inputRef.current?.setButton("e", true); }}
            onTouchEnd={(e) => { e.preventDefault(); inputRef.current?.setButton("e", false); }}
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
        inputRef.current = handle.inputManager; // ✅ تصحيح الوصول
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
    <main className="game-shell" aria-label="لعبة City Crime" style={{ position: "fixed", inset: 0 }}>
      <canvas ref={canvasRef} className="game-canvas" aria-label="مشهد City Crime ثلاثي الأبعاد" style={{ width: "100%", height: "100%", display: "block" }} />
      <Hud state={hud} />
      {showMobile && <MobileControls inputRef={inputRef} />}
    </main>
  );
}
