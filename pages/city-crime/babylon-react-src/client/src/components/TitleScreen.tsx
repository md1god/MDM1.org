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
    const timer = setTimeout(() => setShowButtons(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.6;
    if (!muted) audio.play().catch(() => console.log("Audio play blocked"));
    else audio.pause();
  }, [muted]);

  const handleStart = () => {
    videoRef.current?.pause();
    audioRef.current?.pause();
    onStart();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0e14", zIndex: 50, overflow: "hidden" }}>
      {/* فيديو الخلفية */}
      {!videoError ? (
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
            opacity: 1
          }}
        >
          <source src="./assets/intro.mp4" type="video/mp4" />
        </video>
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #0a0e14, #1a1f26)" }} />
      )}

      {/* طبقة داكنة خفيفة */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(5,10,14,0.25)" }} />

      {/* موسيقى الخلفية */}
      <audio ref={audioRef} src="./assets/city-crime-theme.wav" loop preload="auto" />

      {/* شريط سفلي مع الأزرار */}
      <div style={{
        position: "absolute",
        bottom: 24,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 12,
        padding: "0 16px",
        flexWrap: "wrap",
        opacity: showButtons ? 1 : 0,
        transform: showButtons ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.6s ease",
      }}>
        <button
          onClick={handleStart}
          style={{
            padding: "12px 36px",
            fontSize: "1.1rem",
            fontWeight: 700,
            background: "#f4a62a",
            color: "#0a0e14",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(244,166,42,0.35)",
            fontFamily: '"IBM Plex Sans Arabic", sans-serif'
          }}
        >
          ▶ ابدأ اللعبة
        </button>

        <button
          onClick={() => setMuted(!muted)}
          style={{
            padding: "10px 20px",
            fontSize: "0.9rem",
            background: "rgba(255,255,255,0.08)",
            color: "#c9d5dc",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 20,
            cursor: "pointer",
            fontFamily: '"IBM Plex Sans Arabic", sans-serif'
          }}
        >
          {muted ? "🔇 تشغيل الموسيقى" : "🔊 كتم الموسيقى"}
        </button>
      </div>
    </div>
  );
}
