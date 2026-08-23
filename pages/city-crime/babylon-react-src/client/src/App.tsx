import { useEffect, useRef } from "react";
import { initEngine } from "./game/engine";
import { Hud } from "./components/Hud";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    initEngine(canvasRef.current);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <Hud />
      <div style={{
        position: "fixed", bottom: 20, left: 20,
        color: "#d4af37", background: "rgba(0,0,0,0.7)",
        padding: "1rem", borderRadius: "8px", fontSize: "0.9rem"
      }}>
        <div><strong>WASD</strong> حركة</div>
        <div><strong>Shift</strong> ركض</div>
        <div><strong>Mouse</strong> بعد النقر يدير الكاميرا</div>
        <div><strong>E</strong> تفاعل</div>
      </div>
    </div>
  );
}

export default App;
