export default function Home() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0e14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <h1
        style={{
          color: "#f4a62a",
          fontFamily: '"IBM Plex Sans Arabic", sans-serif',
          fontSize: "2rem",
          margin: 0,
        }}
      >
        اختر اللعبة
      </h1>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => (window.location.hash = "#/original")}
          style={{
            padding: "16px 32px",
            fontSize: "1.2rem",
            background: "#2f5db3",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          لعبة آدم وروز
        </button>
        <button
          onClick={() => (window.location.hash = "#/friends")}
          style={{
            padding: "16px 32px",
            fontSize: "1.2rem",
            background: "#4caf50",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          لعبة الأصدقاء
        </button>
      </div>
    </div>
  );
}
