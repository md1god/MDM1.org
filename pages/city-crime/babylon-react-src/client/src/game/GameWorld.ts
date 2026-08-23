import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import type { GameEngine } from "./engine";
import { InputManager } from "./InputManager";
import { Player } from "./Player";
import { createWellSite, type WellSiteHandle } from "./WellSite";
import type { HudUpdate, QualityTier } from "./types";
import { StageManager, StageId } from "./StageManager";

const CAMERA_TUNING = {
  followDistance: 6.5,
  followHeight: 3.2,
  smoothing: 8,
} as const;

type QuestStage = "approach-well" | "descend" | "push-stone" | "reach-door" | "door-open";

export class GameWorld {
  private readonly input: InputManager;
  private readonly camera: UniversalCamera;
  private readonly player: Player;
  private site: WellSiteHandle | null = null;
  private lastHudUpdate = 0;
  private demoTime = 0;
  private stage: QuestStage = "approach-well";
  private doorOpenProgress = 0;
  private stageManager: StageManager;

  constructor(
    private readonly scene: Scene,
    private readonly engine: GameEngine,
    private readonly canvas: HTMLCanvasElement,
    private readonly tier: QualityTier,
    private readonly updateHud: HudUpdate,
    private readonly physicsEnabled: boolean,
    private readonly demo = false,
  ) {
    this.input = new InputManager(canvas);
    this.camera = new UniversalCamera("third-person-camera", new Vector3(6, 4.5, -4), scene);
    this.camera.minZ = 0.08;
    this.camera.fov = 0.9;
    this.camera.inertia = 0;
    scene.activeCamera = this.camera;

    this.player = new Player(scene, new Vector3(2, 0.02, -4), physicsEnabled);
    this.input.setPlayer(this.player);

    this.stageManager = new StageManager(this.scene, this.player);
    this.player.setStageManager(this.stageManager);

    this.stageManager.setCallbacks(
      (stageId) => {
        console.log("Stage completed:", stageId);
      },
      (objectives) => {
        window.dispatchEvent(new CustomEvent("objectives-update", { detail: objectives }));
      }
    );

    const savedStage = this.stageManager.loadProgress();
    if (savedStage && savedStage !== StageId.VILLA_WELL) {
      this.stageManager.startStage(savedStage);
    }
  }

  async initialize() {
    this.updateHud({ loading: { label: "بناء الحديقة والبئر", progress: 40, active: true } });
    this.site = createWellSite(this.scene, this.physicsEnabled);
    this.site.shadowGenerator.addShadowCaster(this.player.collider);
    this.updateHud({ loading: { label: "المشهد جاهز", progress: 100, active: false } });

    const savedStage = this.stageManager.loadProgress();
    if (savedStage && savedStage !== StageId.VILLA_WELL) {
      await this.stageManager.startStage(savedStage);
    }

    this.scene.registerBeforeRender(() => {
      this.player.checkInteractions();
      this.stageManager.checkInteractions(this.player.position);
    });
  }

  update(deltaSeconds: number) {
    const input = this.input.consume();
    this.demoTime += deltaSeconds;

    const forward = new Vector3(Math.sin(input.yaw), 0, Math.cos(input.yaw));
    const right = new Vector3(forward.z, 0, -forward.x);
    const movement = forward.scale(input.moveZ).add(right.scale(input.moveX));
    this.player.update(deltaSeconds, movement, input.running && this.player.currentStamina > 10);

    this.updateQuest(input.interactPressed);
    this.updateCamera(input, deltaSeconds);
    this.pushHud();
  }

  dispose() {
    this.input.dispose();
    this.player.dispose();
    this.site?.dispose();
  }

  private updateCamera(input: ReturnType<InputManager["consume"]>, deltaSeconds: number) {
    const focus = this.player.position;
    const distance = CAMERA_TUNING.followDistance;
    const cameraOffset = new Vector3(
      -Math.sin(input.yaw) * distance,
      CAMERA_TUNING.followHeight,
      -Math.cos(input.yaw) * distance
    );
    const desiredPosition = focus.add(cameraOffset);
    this.camera.position.copyFrom(
      Vector3.Lerp(this.camera.position, desiredPosition, Math.min(1, deltaSeconds * CAMERA_TUNING.smoothing))
    );
    this.camera.setTarget(focus.add(new Vector3(0, 1.1, 0)));
  }

  private updateQuest(interactPressed: boolean) {
    if (!this.site) return;
    const p = this.player.position;

    switch (this.stage) {
      case "approach-well": {
        const distanceToWell = Vector3.Distance(new Vector3(p.x, 0, p.z), new Vector3(6, 0, 4));
        if (distanceToWell < 1.6) {
          this.stage = "descend";
          this.player.root.position.set(6, this.site.wellBottomY + 0.05, 6);
        }
        break;
      }
      case "descend": {
        this.stage = "push-stone";
        break;
      }
      case "push-stone": {
        if (p.z > 9.2) this.stage = "reach-door";
        break;
      }
      case "reach-door": {
        const distanceToDoor = Math.abs(p.z - 23);
        if (distanceToDoor < 2.2 && interactPressed) {
          this.stage = "door-open";
        }
        break;
      }
      case "door-open": {
        this.doorOpenProgress = Math.min(1, this.doorOpenProgress + 0.02);
        this.site.tunnelDoor.position.y = this.site.wellBottomY + 1.9 - this.doorOpenProgress * 3.8;
        break;
      }
    }
  }

  private pushHud() {
    const now = performance.now();
    if (now - this.lastHudUpdate < 110) return;
    this.lastHudUpdate = now;

    const objectives: Record<QuestStage, string> = {
      "approach-well": "اتجه نحو فوهة البئر لإنقاذ مايا",
      descend: "تنزل يوسف إلى السرداب المظلم",
      "push-stone": "ادفع الحجر الكبير للمرور عبر الممر",
      "reach-door": "قف أمام الباب الحجري واضغط E لتقول: افتح",
      "door-open": "الباب ينفتح... غرفة الأسرار في الانتظار",
    };
    const progressByStage: Record<QuestStage, number> = {
      "approach-well": 0.1,
      descend: 0.3,
      "push-stone": 0.55,
      "reach-door": 0.8,
      "door-open": 1,
    };

    this.updateHud({
      fps: Math.round(this.engine.getFps()),
      player: {
        health: 100,
        stamina: this.player.currentStamina,
        x: this.player.position.x,
        z: this.player.position.z,
        inVehicle: false,
      },
      mission: {
        id: "well-descent",
        title: "المرحلة الأولى: السقوط",
        objective: objectives[this.stage],
        progress: progressByStage[this.stage],
        target: { x: 6, z: this.stage === "approach-well" ? 4 : 23 },
      },
    });
  }
}
