import { useEffect, useRef, useState } from "react";

interface TitleScreenProps {
  onStart: () => void;
}

export default function TitleScreen({ onStart }: TitleScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(true);
  const [showButtons, setShowButtons] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowButtons(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.6;
    if (!muted) {
      audio.play().catch((e) => console.log("Audio play blocked:", e));
    } else {
      audio.pause();
    }
  }, [muted]);

  // محاولة تشغيل الصوت بعد أول تفاعل
  useEffect(() => {
    const tryPlay = () => {
      if (audioRef.current && muted) {
        setMuted(false);
      }
    };
    window.addEventListener("click", tryPlay, { once: true });
    window.addEventListener("touchstart", tryPlay, { once: true });
    return () => {
      window.removeEventListener("click", tryPlay);
      window.removeEventListener("touchstart", tryPlay);
    };
  }, []);

  const handleStart = () => {
    videoRef.current?.pause();
    audioRef.current?.pause();
    onStart();
  };

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
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {/* فيديو الخلفية */}
      {!videoError && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoError(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.45,
          }}
        >
          <source src="./assets/intro.mp4" type="video/mp4" />
        </video>
      )}

      {/* طبقة داكنة فوق الفيديو */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(5,10,14,0.3) 0%, rgba(5,10,14,0.85) 100%)",
        }}
      />

      {/* موسيقى الخلفية */}
      <audio ref={audioRef} src="./assets/city-crime-theme.wav" loop preload="auto" />

      {/* المحتوى */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "2rem" }}>
        {/* اللوجو */}
        <img
          src="./assets/city-crime-threshold-logo-web.png"
          alt="City Crime"
          style={{
            width: "min(320px, 70vw)",
            marginBottom: "2rem",
            filter: "drop-shadow(0 0 20px rgba(244,166,42,0.4))",
          }}
        />

        <h1
          style={{
            color: "#f4a62a",
            fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
            fontWeight: 700,
            margin: "0 0 0.5rem",
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          وريث الهرم
        </h1>
        <p
          style={{
            color: "#a7bdc9",
            fontSize: "clamp(0.9rem, 2vw, 1.1rem)",
            marginBottom: "2.5rem",
            maxWidth: 500,
            lineHeight: 1.6,
          }}
        >
          رحلة عبر الزمن والظل لاكتشاف سر الإرث الحقيقي
        </p>

        {/* الأزرار */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            alignItems: "center",
            opacity: showButtons ? 1 : 0,
            transform: showButtons ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.6s ease",
          }}
        >
          <button
            onClick={handleStart}
            style={{
              padding: "14px 48px",
              fontSize: "1.1rem",
              fontWeight: 700,
              background: "#f4a62a",
              color: "#0a0e14",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(244,166,42,0.35)",
              transition: "transform 0.15s, box-shadow 0.15s",
              fontFamily: '"IBM Plex Sans Arabic", sans-serif',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 6px 28px rgba(244,166,42,0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(244,166,42,0.35)";
            }}
          >
            ▶ ابدأ اللعبة
          </button>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              onClick={() => alert("الإعدادات قريباً")}
              style={{
                padding: "10px 28px",
                fontSize: "0.95rem",
                background: "rgba(255,255,255,0.08)",
                color: "#c9d5dc",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: '"IBM Plex Sans Arabic", sans-serif',
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            >
              ⚙ الإعدادات
            </button>
            <button
              onClick={() => alert("المهمات قريباً")}
              style={{
                padding: "10px 28px",
                fontSize: "0.95rem",
                background: "rgba(255,255,255,0.08)",
                color: "#c9d5dc",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: '"IBM Plex Sans Arabic", sans-serif',
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            >
              📜 المهمات
            </button>
          </div>

          <button
            onClick={() => setMuted(!muted)}
            style={{
              marginTop: "1rem",
              padding: "8px 20px",
              fontSize: "0.85rem",
              background: "transparent",
              color: muted ? "#829ba9" : "#f4a62a",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 20,
              cursor: "pointer",
              fontFamily: '"IBM Plex Sans Arabic", sans-serif',
            }}
          >
            {muted ? "🔇 تشغيل الموسيقى" : "🔊 كتم الموسيقى"}
          </button>
        </div>
      </div>
    </div>
  );
}
