import { CHARACTERS, type CharacterInfo } from "@/game/characters";

interface Props {
  onSelect: (character: CharacterInfo) => void;
}

export default function CharacterSelectScreen({ onSelect }: Props) {
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
        zIndex: 50,
        padding: 16,
        overflowY: "auto",
      }}
    >
      <h1
        style={{
          color: "#f4a62a",
          fontFamily: '"IBM Plex Sans Arabic", sans-serif',
          fontSize: "1.8rem",
          margin: 0,
        }}
      >
        اختر شخصيتك
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
          gap: 12,
          width: "100%",
          maxWidth: 600,
        }}
      >
        {CHARACTERS.map((char) => (
          <button
            key={char.id}
            onClick={() => onSelect(char)}
            style={{
              background: "#1a1f26",
              border: `2px solid ${char.color}`,
              borderRadius: 12,
              padding: "12px 8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              color: "#fff",
              fontFamily: '"IBM Plex Sans Arabic", sans-serif',
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = `0 0 18px ${char.color}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: char.color,
                display: "block",
              }}
            />
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{char.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
