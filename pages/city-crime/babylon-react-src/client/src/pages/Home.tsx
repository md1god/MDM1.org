import { useState } from "react";
import CharacterSelectScreen from "@/components/CharacterSelectScreen";
import CityCrimeBabylon from "@/components/CityCrimeBabylon";
import type { CharacterInfo } from "@/game/characters";

export default function Home() {
  const [character, setCharacter] = useState<CharacterInfo | null>(null);

  if (!character) {
    return <CharacterSelectScreen onSelect={setCharacter} />;
  }

  return <CityCrimeBabylon selectedCharacter={character} />;
}
