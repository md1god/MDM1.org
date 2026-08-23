import { useEffect, useState } from "react";

interface Objective {
  id: string;
  description: string;
  completed: boolean;
}

export function Hud() {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [stageName, setStageName] = useState("");

  useEffect(() => {
    const handleObjectives = (e: Event) => {
      const custom = e as CustomEvent;
      setObjectives(custom.detail);
    };
    window.addEventListener("objectives-update", handleObjectives);
    return () => window.removeEventListener("objectives-update", handleObjectives);
  }, []);

  return (
    <div className="hud-container" style={{
      position: "fixed", top: 20, right: 20,
      background: "rgba(0,0,0,0.7)", color: "#d4af37",
      padding: "1rem", borderRadius: "8px", minWidth: "250px",
      fontFamily: "Segoe UI, Tahoma, sans-serif", zIndex: 100
    }}>
      <h3 style={{ margin: "0 0 0.5rem", borderBottom: "1px solid #d4af37", paddingBottom: "0.5rem" }}>
        🎯 أهداف المرحلة
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {objectives.map(obj => (
          <li key={obj.id} style={{
            padding: "0.3rem 0",
            textDecoration: obj.completed ? "line-through" : "none",
            opacity: obj.completed ? 0.5 : 1,
            transition: "all 0.3s"
          }}>
            {obj.completed ? "✅" : "⬜"} {obj.description}
          </li>
        ))}
      </ul>
      {objectives.every(o => o.completed) && (
        <div style={{ 
          marginTop: "0.5rem", padding: "0.5rem", 
          background: "#d4af37", color: "#000",
          textAlign: "center", borderRadius: "4px",
          fontWeight: "bold"
        }}>
          🎉 اكتملت المرحلة!
        </div>
      )}
    </div>
  );
}
