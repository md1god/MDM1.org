import { useState } from "react";
import TitleScreen from "@/components/TitleScreen";
import CharacterSelectScreen from "@/components/CharacterSelectScreen";
import CityCrimeBabylon from "@/components/CityCrimeBabylon";
import type { CharacterInfo } from "@/game/characters";

export default function Home() {
  const [started, setStarted] = useState(false);
  const [character, setCharacter] = useState<CharacterInfo | null>(null);

  if (!started) {
    return <TitleScreen onStart={() => setStarted(true)} />;
  }

  if (!character) {
    return <CharacterSelectScreen onSelect={setCharacter} />;
  }

  return <CityCrimeBabylon selectedCharacter={character} />;
}
