import { useEffect, useState } from "react";

interface Objective {
  id: string;
  description: string;
  completed: boolean;
}

export function Hud({ state }: { state: any }) {
  const [objectives, setObjectives] = useState<Objective[]>([]);

  useEffect(() => {
    const handleObjectives = (e: Event) => {
      const custom = e as CustomEvent;
      setObjectives(custom.detail);
    };
    window.addEventListener("objectives-update", handleObjectives);
    return () => window.removeEventListener("objectives-update", handleObjectives);
  }, []);

  const allCompleted = objectives.length > 0 && objectives.every((o) => o.completed);

  return (
    <div
      className="hud-container"
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        background: "rgba(0,0,0,0.75)",
        color: "#d4af37",
        padding: "1rem",
        borderRadius: "8px",
        minWidth: "250px",
        fontFamily: '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif',
        zIndex: 100,
        backdropFilter: "blur(4px)",
      }}
    >
      <h3
        style={{
          margin: "0 0 0.5rem",
          borderBottom: "1px solid #d4af37",
          paddingBottom: "0.5rem",
          fontSize: "1.1rem",
        }}
      >
        🎯 أهداف المرحلة
      </h3>
      {objectives.length === 0 ? (
        <p style={{ color: "#829ba9", fontSize: "0.9rem", margin: 0 }}>
          جاري تحميل الأهداف...
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {objectives.map((obj) => (
            <li
              key={obj.id}
              style={{
                padding: "0.3rem 0",
                textDecoration: obj.completed ? "line-through" : "none",
                opacity: obj.completed ? 0.5 : 1,
                transition: "all 0.3s",
                fontSize: "0.95rem",
              }}
            >
              {obj.completed ? "✅" : "⬜"} {obj.description}
            </li>
          ))}
        </ul>
      )}
      {allCompleted && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.6rem",
            background: "linear-gradient(135deg, #d4af37, #b8941f)",
            color: "#000",
            textAlign: "center",
            borderRadius: "6px",
            fontWeight: "bold",
            fontSize: "1rem",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        >
          🎉 اكتملت المرحلة!
        </div>
      )}
    </div>
  );
}
