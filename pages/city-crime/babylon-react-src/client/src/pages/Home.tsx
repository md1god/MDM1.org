import { useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import TitleScreen from "@/components/TitleScreen";

export default function Home() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <TitleScreen onStart={() => setStarted(true)} />;
  }

  return <GameCanvas />;
}
