import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Animation,
  Mesh,
  ActionManager,
  PointLight,
} from "@babylonjs/core";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core";
import { Player } from "./Player";

export enum StageId {
  VILLA_WELL = 1,
  SECRET_CHAMBER = 2,
  BURIED_VILLAGE = 3,
  MIRROR_LAYER = 4,
  FUTURE_LAYER = 5,
  SHADOW_LAYER = 6,
  RETURN = 7,
}

export interface StageObjective {
  id: string;
  description: string;
  completed: boolean;
}

export interface StageConfig {
  id: StageId;
  name: string;
  spawnPoint: Vector3;
  objectives: StageObjective[];
  nextStage?: StageId;
  blockoutColor: Color3;
  ambientLight: number;
}

export class StageManager {
  private scene: Scene;
  private player: Player;
  private currentStage: StageId = StageId.VILLA_WELL;
  private stageMeshes: Mesh[] = [];
  private objectives: Map<string, boolean> = new Map();
  private onStageComplete: ((stage: StageId) => void) | null = null;
  private onObjectiveUpdate: ((obj: StageObjective[]) => void) | null = null;
  private transitionOverlay: HTMLDivElement | null = null;

  private stageConfigs: Map<StageId, StageConfig> = new Map([
    [
      StageId.VILLA_WELL,
      {
        id: StageId.VILLA_WELL,
        name: "السقوط",
        spawnPoint: new Vector3(0, 2, 0),
        objectives: [
          { id: "approach_well", description: "اقترب من فوهة البئر", completed: false },
          { id: "descend_well", description: "انزل إلى قاع البئر", completed: false },
          { id: "push_stone", description: "ادفع الحجر لفتح الممر", completed: false },
          { id: "reach_door", description: "صل إلى الباب الحجري", completed: false },
          { id: "open_door", description: "قل 'افتح' لفتح الباب", completed: false },
        ],
        nextStage: StageId.SECRET_CHAMBER,
        blockoutColor: new Color3(0.4, 0.35, 0.25),
        ambientLight: 0.8,
      },
    ],
    // ... باقي المراحل موجودة كما هي بدون تغيير ...
  ]);

  constructor(scene: Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.createTransitionOverlay();
  }

  // ... باقي الدوال كما هي بدون تغيير ...

  completeObjective(objectiveId: string) {
    const config = this.getCurrentConfig();
    if (!config) return;
    const objective = config.objectives.find((o) => o.id === objectiveId);
    if (!objective || this.objectives.get(objectiveId)) return; // ✅ منع التكرار
    this.objectives.set(objectiveId, true);
    console.log(`✅ تم إكمال: ${objective.description}`);
    this.notifyObjectiveUpdate();
    const allDone = config.objectives.every((o) => this.objectives.get(o.id));
    if (allDone) {
      setTimeout(() => this.completeStage(), 1500);
    }
  }

  checkInteractions(playerPos: Vector3) {
    const config = this.getCurrentConfig();
    if (!config) return;

    // ✅ المرحلة الأولى: البئر والأنفاق
    if (this.currentStage === StageId.VILLA_WELL) {
      const wellPos = new Vector3(8, 1, 8);
      if (Vector3.Distance(playerPos, wellPos) < 3) {
        this.completeObjective("approach_well");
      }

      const tunnelFloorPos = new Vector3(8, -6.5, -5);
      if (Vector3.Distance(playerPos, tunnelFloorPos) < 3) {
        this.completeObjective("descend_well");
      }

      const stonePos = new Vector3(8, -5, -2);
      if (Vector3.Distance(playerPos, stonePos) < 2) {
        this.completeObjective("push_stone");
      }

      const doorTriggerPos = new Vector3(8, -5, -10);
      if (Vector3.Distance(playerPos, doorTriggerPos) < 2.5) {
        this.completeObjective("reach_door");
      }
    }
  }
}
