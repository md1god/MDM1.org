import { useState } from "react";
import TitleScreen from "@/components/TitleScreen";
import CharacterSelectScreen from "@/components/CharacterSelectScreen";

export default function Home() {
  const [started, setStarted] = useState(false);
  const [selecting, setSelecting] = useState(false);

  if (!started) {
    return <TitleScreen onStart={() => setStarted(true)} />;
  }

  if (!selecting) {
    return <CharacterSelectScreen onSelect={() => setSelecting(true)} />;
  }

  return null;
}
