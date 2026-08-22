import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSAO2RenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import type { GameEngine } from "./engine";
import { InputManager } from "./InputManager";
import { Player } from "./Player";
import { Vehicle } from "./Vehicle";
import { createEnvironment, type EnvironmentHandle } from "./Environment";
import type { HudUpdate, QualityTier } from "./types";

// منظور اللاعب: تضبط هذه القيم بعد مراجعة النسخة البصرية التالية.
const CAMERA_TUNING = {
  firstPersonEyeHeight: 1.62,
  firstPersonLookDistance: 9,
  firstPersonSmoothing: 13,
  vehicleFollowDistance: 8.8,
  vehicleFollowHeight: 2.6,
} as const;

export class GameWorld {
  private readonly input: InputManager;
  private readonly camera: UniversalCamera;
  private readonly player: Player;
  private readonly vehicle: Vehicle;
  private environment: EnvironmentHandle | null = null;
  private postProcess: DefaultRenderingPipeline | null = null;
  private ssao: SSAO2RenderingPipeline | null = null;
  private lastHudUpdate = 0;
  private resolutionScore = 60;
  private scalingLevel = 1;
  private demoTime = 0;
  private readonly missionTarget = new Vector3(5.5, 0, 3.5);

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
    this.camera = new UniversalCamera("third-person-universal-camera", new Vector3(0, 3.2, -8.5), scene);
    this.camera.minZ = 0.08;
    this.camera.fov = 0.92;
    this.camera.inertia = 0;
    scene.activeCamera = this.camera;

    this.player = new Player(scene, new Vector3(0, 0.02, -12), physicsEnabled);
    this.vehicle = new Vehicle(scene, new Vector3(5.5, 0, 3.5), physicsEnabled);
  }

  async initialize() {
    this.environment = await createEnvironment(this.scene, (label, completed, total) => {
      this.updateHud({ loading: { label, progress: 30 + (completed / total) * 48, active: true } });
    }, this.physicsEnabled);
    this.environment.shadowGenerator.addShadowCaster(this.player.collider);
    this.environment.shadowGenerator.addShadowCaster(this.vehicle.body);
    this.createPostProcessing();
    this.updateHud({ loading: { label: "تحميل خامات البيئة", progress: 78, active: true } });
    void this.environment.ready.then(() => {
      this.updateHud({ loading: { label: "المشهد جاهز", progress: 100, active: false } });
    });
  }

  update(deltaSeconds: number) {
    const input = this.input.consume();
    this.demoTime += deltaSeconds;
    if (input.interactPressed) {
      this.vehicle.toggleControl(this.player.position);
    }

    if (this.demo && !this.vehicle.isControlled) {
      const toVehicle = this.vehicle.body.position.subtract(this.player.position);
      this.player.update(deltaSeconds, toVehicle, true);
      if (toVehicle.lengthSquared() < 8) this.vehicle.toggleControl(this.player.position);
    } else if (!this.vehicle.isControlled) {
      const forward = new Vector3(Math.sin(input.yaw), 0, Math.cos(input.yaw));
      const right = new Vector3(forward.z, 0, -forward.x);
      const movement = forward.scale(input.moveZ).add(right.scale(input.moveX));
      this.player.update(deltaSeconds, movement, input.running && this.player.currentStamina > 10);
    }
    const vehicleInput = this.demo && this.vehicle.isControlled
      ? { ...input, moveZ: 1, moveX: Math.sin(this.demoTime * 0.7) * 0.28 }
      : input;
    this.vehicle.update(deltaSeconds, vehicleInput);

    const focus = this.vehicle.isControlled ? this.vehicle.body.position : this.player.position;
    if (this.vehicle.isControlled) {
      const distance = CAMERA_TUNING.vehicleFollowDistance;
      const cameraOffset = new Vector3(-Math.sin(input.yaw) * distance, CAMERA_TUNING.vehicleFollowHeight - input.pitch * 2.3, -Math.cos(input.yaw) * distance);
      const desiredPosition = focus.add(cameraOffset);
      this.camera.position.copyFrom(Vector3.Lerp(this.camera.position, desiredPosition, Math.min(1, deltaSeconds * 6.5)));
      this.camera.setTarget(focus.add(new Vector3(0, 0.8, 0)));
    } else {
      const eye = this.player.position.add(new Vector3(0, CAMERA_TUNING.firstPersonEyeHeight, 0));
      const viewDirection = new Vector3(Math.sin(input.yaw), input.pitch * 0.7, Math.cos(input.yaw)).normalize();
      this.camera.position.copyFrom(Vector3.Lerp(this.camera.position, eye, Math.min(1, deltaSeconds * CAMERA_TUNING.firstPersonSmoothing)));
      this.camera.setTarget(eye.add(viewDirection.scale(CAMERA_TUNING.firstPersonLookDistance)));
    }

    this.updateDynamicResolution(deltaSeconds);
    const now = performance.now();
    if (now - this.lastHudUpdate > 110) {
      this.lastHudUpdate = now;
      const distanceToVehicle = Vector3.Distance(this.player.position, this.vehicle.body.position);
      this.updateHud({
        fps: Math.round(this.engine.getFps()),
        player: {
          health: 100,
          stamina: this.player.currentStamina,
          x: focus.x,
          z: focus.z,
          inVehicle: this.vehicle.isControlled,
        },
        mission: {
          id: "reach-vehicle",
          title: "المهمة الرئيسية",
          objective: this.vehicle.isControlled ? "التحرك إلى نقطة الاختبار" : distanceToVehicle < 4 ? "اضغط E لقيادة المركبة" : "الوصول إلى المركبة",
          progress: this.vehicle.isControlled ? 1 : Math.max(0, Math.min(0.86, 1 - distanceToVehicle / 26)),
          target: { x: this.missionTarget.x, z: this.missionTarget.z },
        },
      });
    }
  }

  dispose() {
    this.input.dispose();
    this.player.dispose();
    this.vehicle.dispose();
    this.environment?.dispose();
    this.postProcess?.dispose();
    this.ssao?.dispose();
  }

  private createPostProcessing() {
    if (this.engine.getClassName() !== "WebGPUEngine") return;
    this.postProcess = new DefaultRenderingPipeline("console-look-pipeline", true, this.scene, [this.camera]);
    this.postProcess.imageProcessingEnabled = true;
    this.postProcess.bloomEnabled = this.tier !== "Low";
    this.postProcess.bloomThreshold = 0.72;
    this.postProcess.bloomWeight = this.tier === "Ultra" ? 0.26 : 0.16;
    this.postProcess.bloomKernel = 56;
    this.postProcess.fxaaEnabled = this.tier === "Medium" || this.tier === "Low";
    this.postProcess.samples = this.tier === "Ultra" ? 2 : 1;
    this.postProcess.imageProcessing.contrast = 1.14;
    this.postProcess.imageProcessing.exposure = 1.02;
    this.postProcess.imageProcessing.toneMappingEnabled = true;
    this.postProcess.imageProcessing.toneMappingType = 1;

    const supportsSsao = this.engine.getClassName() === "WebGPUEngine";
    if (supportsSsao && (this.tier === "Ultra" || this.tier === "High")) {
      this.ssao = new SSAO2RenderingPipeline("street-ssao", this.scene, { ssaoRatio: 0.5, combineRatio: 1.0 }, [this.camera], true);
      this.ssao.radius = 2.1;
      this.ssao.totalStrength = 0.55;
      this.ssao.expensiveBlur = false;
      this.ssao.samples = this.tier === "Ultra" ? 16 : 8;
    }
  }

  private updateDynamicResolution(deltaSeconds: number) {
    const fps = Math.max(1, this.engine.getFps());
    const smoothing = Math.min(1, deltaSeconds * 1.8);
    this.resolutionScore += (fps - this.resolutionScore) * smoothing;
    let nextScaling = this.scalingLevel;
    if (this.resolutionScore < 29) nextScaling = 1.85;
    else if (this.resolutionScore < 39) nextScaling = 1.52;
    else if (this.resolutionScore < 50) nextScaling = 1.22;
    else if (this.resolutionScore > 58) nextScaling = 1;
    if (Math.abs(nextScaling - this.scalingLevel) > 0.04) {
      this.scalingLevel = nextScaling;
      this.engine.setHardwareScalingLevel(nextScaling);
    }
  }
}
