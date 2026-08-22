export type EngineKind = "WebGPU" | "WebGL2";
export type QualityTier = "Ultra" | "High" | "Medium" | "Low";

export type MissionState = {
  id: string;
  title: string;
  objective: string;
  progress: number;
  target: { x: number; z: number };
};

export type HudState = {
  loading: { label: string; progress: number; active: boolean };
  engine: EngineKind | "تهيئة";
  tier: QualityTier | "قياس";
  fps: number;
  player: {
    health: number;
    stamina: number;
    x: number;
    z: number;
    inVehicle: boolean;
  };
  mission: MissionState;
};

export type HudUpdate = (state: Partial<HudState>) => void;

export const initialHudState: HudState = {
  loading: { label: "تهيئة المشهد", progress: 0, active: true },
  engine: "تهيئة",
  tier: "قياس",
  fps: 0,
  player: { health: 100, stamina: 100, x: 0, z: -12, inVehicle: false },
  mission: {
    id: "reach-vehicle",
    title: "المهمة الرئيسية",
    objective: "الوصول إلى المركبة",
    progress: 0,
    target: { x: 5.5, z: 3.5 },
  },
};
