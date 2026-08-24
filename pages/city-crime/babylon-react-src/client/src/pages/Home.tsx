import { useState } from "react";
import TitleScreen from "@/components/TitleScreen";
import CharacterSelectScreen from "@/components/CharacterSelectScreen";

export default function Home() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <TitleScreen onStart={() => setStarted(true)} />;
  }

  return <CharacterSelectScreen onSelect={() => {}} />;
}
