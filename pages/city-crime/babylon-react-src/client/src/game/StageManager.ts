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
    [
      StageId.SECRET_CHAMBER,
      {
        id: StageId.SECRET_CHAMBER,
        name: "غرفة الأسرار",
        spawnPoint: new Vector3(0, 1, 0),
        objectives: [
          { id: "explore_chamber", description: "استكشف القاعة الحجرية", completed: false },
          { id: "collect_keys", description: "اجمع 7 مفاتيح حجرية", completed: false },
          { id: "activate_portal", description: "فعّل البوابة الدائرية", completed: false },
        ],
        nextStage: StageId.BURIED_VILLAGE,
        blockoutColor: new Color3(0.2, 0.15, 0.1),
        ambientLight: 0.4,
      },
    ],
    [
      StageId.BURIED_VILLAGE,
      {
        id: StageId.BURIED_VILLAGE,
        name: "القرية المطمورة",
        spawnPoint: new Vector3(0, 1, 10),
        objectives: [
          { id: "find_family", description: "اعثر على العائلة الفقيرة", completed: false },
          { id: "fix_water", description: "أصلح قناة المياه", completed: false },
          { id: "protect_child", description: "احمِ الطفل من الظل", completed: false },
          { id: "solve_hieroglyph", description: "فك لغز الهيروغليفي", completed: false },
        ],
        nextStage: StageId.MIRROR_LAYER,
        blockoutColor: new Color3(0.5, 0.4, 0.3),
        ambientLight: 0.5,
      },
    ],
    [
      StageId.MIRROR_LAYER,
      {
        id: StageId.MIRROR_LAYER,
        name: "طبقة المرايا",
        spawnPoint: new Vector3(0, 1, 0),
        objectives: [
          { id: "cross_mirror", description: "اعبر المساحة العاكسة", completed: false },
          { id: "solve_reflection", description: "حل لغز الانعكاس العكسي", completed: false },
          { id: "escape_shadow", description: "اهرب من انعكاس الظل", completed: false },
        ],
        nextStage: StageId.FUTURE_LAYER,
        blockoutColor: new Color3(0.1, 0.2, 0.3),
        ambientLight: 0.3,
      },
    ],
    [
      StageId.FUTURE_LAYER,
      {
        id: StageId.FUTURE_LAYER,
        name: "طبقة المستقبل",
        spawnPoint: new Vector3(0, 2, 0),
        objectives: [
          { id: "explore_city", description: "استكشف المدينة المهجورة", completed: false },
          { id: "collect_memories", description: "اجمع 5 ذكريات مبعثرة", completed: false },
          { id: "awaken_people", description: "أوقظ سكان المدينة", completed: false },
        ],
        nextStage: StageId.SHADOW_LAYER,
        blockoutColor: new Color3(0.15, 0.15, 0.2),
        ambientLight: 0.4,
      },
    ],
    [
      StageId.SHADOW_LAYER,
      {
        id: StageId.SHADOW_LAYER,
        name: "طبقة الظل",
        spawnPoint: new Vector3(0, 1, -5),
        objectives: [
          { id: "face_fear", description: "واجه خوفك", completed: false },
          { id: "solve_love_puzzle", description: "حل ألغاز الحب والشجاعة", completed: false },
          { id: "defeat_shadow", description: "هزم الظل بتذكر لحظات الحب", completed: false },
        ],
        nextStage: StageId.RETURN,
        blockoutColor: new Color3(0.05, 0.05, 0.05),
        ambientLight: 0.15,
      },
    ],
    [
      StageId.RETURN,
      {
        id: StageId.RETURN,
        name: "العودة",
        spawnPoint: new Vector3(0, 1, 0),
        objectives: [
          { id: "find_truth", description: "اكتشف سر الإرث الحقيقي", completed: false },
          { id: "return_surface", description: "ارجع إلى السطح", completed: false },
          { id: "accept_duty", description: "تقبل مسؤولية حماية الهرم", completed: false },
        ],
        nextStage: undefined,
        blockoutColor: new Color3(0.6, 0.5, 0.3),
        ambientLight: 0.9,
      },
    ],
  ]);

  constructor(scene: Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.createTransitionOverlay();
  }

  private createTransitionOverlay() {
    this.transitionOverlay = document.createElement("div");
    this.transitionOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #000; opacity: 0; pointer-events: none; z-index: 1000;
      transition: opacity 1.5s ease; display: flex; align-items: center;
      justify-content: center; color: #d4af37; font-size: 2rem;
      font-family: 'Segoe UI', Tahoma, sans-serif; text-align: center;
    `;
    document.body.appendChild(this.transitionOverlay);
  }

  setCallbacks(
    onStageComplete: (stage: StageId) => void,
    onObjectiveUpdate: (obj: StageObjective[]) => void
  ) {
    this.onStageComplete = onStageComplete;
    this.onObjectiveUpdate = onObjectiveUpdate;
  }

  getCurrentStage(): StageId {
    return this.currentStage;
  }

  getCurrentConfig(): StageConfig | undefined {
    return this.stageConfigs.get(this.currentStage);
  }

  getObjectives(): StageObjective[] {
    const config = this.getCurrentConfig();
    if (!config) return [];
    return config.objectives.map((obj) => ({
      ...obj,
      completed: this.objectives.get(obj.id) || false,
    }));
  }

  async startStage(stageId: StageId) {
    this.saveProgress(stageId);
    this.currentStage = stageId;
    const config = this.stageConfigs.get(stageId)!;
    await this.fadeToBlack(`المرحلة ${stageId}: ${config.name}`);
    this.clearStage();
    this.player.teleport(config.spawnPoint);
    this.buildStageBlockout(stageId, config);
    this.scene.ambientColor = config.blockoutColor.scale(config.ambientLight);
    config.objectives.forEach((obj) => {
      if (!this.objectives.has(obj.id)) {
        this.objectives.set(obj.id, false);
      }
    });
    await this.fadeFromBlack();
    this.notifyObjectiveUpdate();
  }

  async completeStage() {
    const config = this.getCurrentConfig();
    if (!config) return;
    const allCompleted = config.objectives.every((obj) => this.objectives.get(obj.id) === true);
    if (!allCompleted) {
      console.warn("لم تكتمل جميع أهداف المرحلة بعد!");
      return;
    }
    await this.fadeToBlack("تم إكمال المرحلة!");
    if (this.onStageComplete) {
      this.onStageComplete(this.currentStage);
    }
    if (config.nextStage) {
      setTimeout(() => {
        this.startStage(config.nextStage!);
      }, 2000);
    } else {
      this.showGameComplete();
    }
  }

  completeObjective(objectiveId: string) {
    const config = this.getCurrentConfig();
    if (!config) return;
    const objective = config.objectives.find((o) => o.id === objectiveId);
    if (!objective) return;
    this.objectives.set(objectiveId, true);
    console.log(`✅ تم إكمال: ${objective.description}`);
    this.notifyObjectiveUpdate();
    const allDone = config.objectives.every((o) => this.objectives.get(o.id));
    if (allDone) {
      setTimeout(() => this.completeStage(), 1500);
    }
  }

  private buildStageBlockout(stageId: StageId, config: StageConfig) {
    const color = config.blockoutColor;
    switch (stageId) {
      case StageId.VILLA_WELL:
        this.buildVillaWell(color);
        break;
      case StageId.SECRET_CHAMBER:
        this.buildSecretChamber(color);
        break;
      case StageId.BURIED_VILLAGE:
        this.buildBuriedVillage(color);
        break;
      case StageId.MIRROR_LAYER:
        this.buildMirrorLayer(color);
        break;
      case StageId.FUTURE_LAYER:
        this.buildFutureLayer(color);
        break;
      case StageId.SHADOW_LAYER:
        this.buildShadowLayer(color);
        break;
      case StageId.RETURN:
        this.buildReturnLayer(color);
        break;
    }
  }

  private buildVillaWell(color: Color3) {
    const ground = MeshBuilder.CreateGround("villa_ground", { width: 40, height: 40 }, this.scene);
    const mat = new StandardMaterial("villa_mat", this.scene);
    mat.diffuseColor = color;
    ground.material = mat;
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.stageMeshes.push(ground);

    const well = MeshBuilder.CreateCylinder("well", { height: 2, diameter: 4 }, this.scene);
    well.position = new Vector3(8, 1, 8);
    const wellMat = new StandardMaterial("well_mat", this.scene);
    wellMat.diffuseColor = new Color3(0.1, 0.08, 0.05);
    well.material = wellMat;
    new PhysicsAggregate(well, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
    this.stageMeshes.push(well);

    const wellTrigger = MeshBuilder.CreateCylinder("well_trigger", { height: 3, diameter: 5 }, this.scene);
    wellTrigger.position = new Vector3(8, 1, 8);
    wellTrigger.isVisible = false;
    wellTrigger.actionManager = new ActionManager(this.scene);
    this.stageMeshes.push(wellTrigger);

    for (let i = 0; i < 20; i++) {
      const fence = MeshBuilder.CreateBox(`fence_${i}`, { width: 0.3, height: 1.5, depth: 0.3 }, this.scene);
      const angle = (i / 20) * Math.PI * 2;
      fence.position = new Vector3(Math.cos(angle) * 18, 0.75, Math.sin(angle) * 18);
      const fMat = new StandardMaterial("fence_mat", this.scene);
      fMat.diffuseColor = new Color3(0.5, 0.4, 0.3);
      fence.material = fMat;
      new PhysicsAggregate(fence, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
      this.stageMeshes.push(fence);
    }

    const tunnel = MeshBuilder.CreateBox("tunnel", { width: 4, height: 3, depth: 20 }, this.scene);
    tunnel.position = new Vector3(8, -5, -5);
    const tunnelMat = new StandardMaterial("tunnel_mat", this.scene);
    tunnelMat.diffuseColor = new Color3(0.2, 0.15, 0.1);
    tunnel.material = tunnelMat;
    this.stageMeshes.push(tunnel);

    const tunnelFloor = MeshBuilder.CreateGround("tunnel_floor", { width: 4, height: 20 }, this.scene);
    tunnelFloor.position = new Vector3(8, -6.5, -5);
    const tfMat = new StandardMaterial("tf_mat", this.scene);
    tfMat.diffuseColor = new Color3(0.15, 0.1, 0.05);
    tunnelFloor.material = tfMat;
    new PhysicsAggregate(tunnelFloor, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.stageMeshes.push(tunnelFloor);

    const stone = MeshBuilder.CreateSphere("push_stone", { diameter: 1.5 }, this.scene);
    stone.position = new Vector3(8, -5, -2);
    const stoneMat = new StandardMaterial("stone_mat", this.scene);
    stoneMat.diffuseColor = new Color3(0.4, 0.4, 0.4);
    stone.material = stoneMat;
    new PhysicsAggregate(stone, PhysicsShapeType.SPHERE, { mass: 5 }, this.scene);
    this.stageMeshes.push(stone);

    const door = MeshBuilder.CreateBox("stone_door", { width: 3, height: 3, depth: 0.5 }, this.scene);
    door.position = new Vector3(8, -5, -12);
    const doorMat = new StandardMaterial("door_mat", this.scene);
    doorMat.diffuseColor = new Color3(0.3, 0.25, 0.2);
    door.material = doorMat;
    new PhysicsAggregate(door, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.stageMeshes.push(door);

    const doorTrigger = MeshBuilder.CreateBox("door_trigger", { width: 4, height: 3, depth: 2 }, this.scene);
    doorTrigger.position = new Vector3(8, -5, -10);
    doorTrigger.isVisible = false;
    this.stageMeshes.push(doorTrigger);

    const light = new PointLight("well_light", new Vector3(8, 3, 8), this.scene);
    light.intensity = 0.8;
    light.diffuse = new Color3(1, 0.9, 0.7);
    this.stageMeshes.push(light as any);
  }

  private buildSecretChamber(color: Color3) {
    const floor = MeshBuilder.CreateGround("chamber_floor", { width: 30, height: 30 }, this.scene);
    const mat = new StandardMaterial("chamber_mat", this.scene);
    mat.diffuseColor = color;
    floor.material = mat;
    new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.stageMeshes.push(floor);

    for (let i = 0; i < 4; i++) {
      const wall = MeshBuilder.CreateBox(`wall_${i}`, { width: 30, height: 8, depth: 1 }, this.scene);
      const angle = (i / 4) * Math.PI * 2;
      wall.position = new Vector3(Math.sin(angle) * 15, 4, Math.cos(angle) * 15);
      wall.rotation.y = angle;
      const wMat = new StandardMaterial("wall_mat", this.scene);
      wMat.diffuseColor = color.scale(0.7);
      wall.material = wMat;
      new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
      this.stageMeshes.push(wall);
    }

    const portal = MeshBuilder.CreateTorus("portal", { diameter: 5, thickness: 0.5 }, this.scene);
    portal.position = new Vector3(0, 3, -12);
    const portalMat = new StandardMaterial("portal_mat", this.scene);
    portalMat.diffuseColor = new Color3(0.8, 0.6, 0.2);
    portalMat.emissiveColor = new Color3(0.4, 0.3, 0.1);
    portal.material = portalMat;
    this.stageMeshes.push(portal);

    const keyPositions = [
      new Vector3(-10, 1, -10),
      new Vector3(10, 1, -10),
      new Vector3(-10, 1, 10),
      new Vector3(10, 1, 10),
      new Vector3(0, 1, 0),
      new Vector3(-5, 1, 0),
      new Vector3(5, 1, 0),
    ];

    keyPositions.forEach((pos, i) => {
      const key = MeshBuilder.CreateBox(`key_${i}`, { width: 0.5, height: 0.8, depth: 0.2 }, this.scene);
      key.position = pos;
      const kMat = new StandardMaterial(`key_mat_${i}`, this.scene);
      kMat.diffuseColor = new Color3(0.8, 0.7, 0.3);
      kMat.emissiveColor = new Color3(0.2, 0.15, 0.05);
      key.material = kMat;
      const anim = new Animation("key_spin", "rotation.y", 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
      const keys = [{ frame: 0, value: 0 }, { frame: 60, value: Math.PI * 2 }];
      anim.setKeys(keys);
      key.animations.push(anim);
      this.scene.beginAnimation(key, 0, 60, true);
      this.stageMeshes.push(key);
    });
  }

  private buildBuriedVillage(color: Color3) {
    const ground = MeshBuilder.CreateGround("village_ground", { width: 50, height: 50 }, this.scene);
    const mat = new StandardMaterial("village_mat", this.scene);
    mat.diffuseColor = color;
    ground.material = mat;
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.stageMeshes.push(ground);

    for (let i = 0; i < 6; i++) {
      const house = MeshBuilder.CreateBox(`house_${i}`, { width: 4, height: 3, depth: 4 }, this.scene);
      const angle = (i / 6) * Math.PI * 2;
      house.position = new Vector3(Math.cos(angle) * 15, 1.5, Math.sin(angle) * 15);
      const hMat = new StandardMaterial("house_mat", this.scene);
      hMat.diffuseColor = new Color3(0.6, 0.5, 0.35);
      house.material = hMat;
      new PhysicsAggregate(house, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
      this.stageMeshes.push(house);
    }

    const water = MeshBuilder.CreateBox("water_channel", { width: 2, height: 0.5, depth: 30 }, this.scene);
    water.position = new Vector3(0, 0.25, 0);
    const waterMat = new StandardMaterial("water_mat", this.scene);
    waterMat.diffuseColor = new Color3(0.2, 0.4, 0.8);
    waterMat.alpha = 0.7;
    water.material = waterMat;
    this.stageMeshes.push(water);

    const child = MeshBuilder.CreateCapsule("child_npc", { height: 1, radius: 0.3 }, this.scene);
    child.position = new Vector3(5, 0.5, 5);
    const childMat = new StandardMaterial("child_mat", this.scene);
    childMat.diffuseColor = new Color3(1, 0.9, 0.3);
    child.material = childMat;
    this.stageMeshes.push(child);
  }

  private buildMirrorLayer(color: Color3) {
    const mirror = MeshBuilder.CreateGround("mirror_floor", { width: 40, height: 40 }, this.scene);
    const mat = new StandardMaterial("mirror_mat", this.scene);
    mat.diffuseColor = color;
    mat.specularColor = new Color3(1, 1, 1);
    mat.specularPower = 128;
    mirror.material = mat;
    new PhysicsAggregate(mirror, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.stageMeshes.push(mirror);

    for (let i = 0; i < 8; i++) {
      const pillar = MeshBuilder.CreateBox(`mirror_pillar_${i}`, { width: 1, height: 6, depth: 0.2 }, this.scene);
      const angle = (i / 8) * Math.PI * 2;
      pillar.position = new Vector3(Math.cos(angle) * 12, 3, Math.sin(angle) * 12);
      pillar.rotation.y = angle;
      const pMat = new StandardMaterial("mirror_pillar_mat", this.scene);
      pMat.diffuseColor = new Color3(0.8, 0.9, 1);
      pMat.specularColor = new Color3(1, 1, 1);
      pMat.specularPower = 256;
      pillar.material = pMat;
      new PhysicsAggregate(pillar, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
      this.stageMeshes.push(pillar);
    }

    const water = MeshBuilder.CreateGround("underground_water", { width: 20, height: 20 }, this.scene);
    water.position = new Vector3(0, 0.1, 0);
    const wMat = new StandardMaterial("water_surface", this.scene);
    wMat.diffuseColor = new Color3(0.1, 0.3, 0.5);
    wMat.alpha = 0.6;
    water.material = wMat;
    this.stageMeshes.push(water);
  }

  private buildFutureLayer(color: Color3) {
    const ground = MeshBuilder.CreateGround("future_ground", { width: 40, height: 40 }, this.scene);
    const mat = new StandardMaterial("future_mat", this.scene);
    mat.diffuseColor = color;
    mat.specularColor = new Color3(0.5, 0.5, 0.6);
    ground.material = mat;
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.stageMeshes.push(ground);

    for (let i = 0; i < 5; i++) {
      const tower = MeshBuilder.CreateCylinder(`tower_${i}`, { height: 10 + Math.random() * 10, diameter: 3 }, this.scene);
      const angle = (i / 5) * Math.PI * 2;
      tower.position = new Vector3(Math.cos(angle) * 15, 5, Math.sin(angle) * 15);
      const tMat = new StandardMaterial("tower_mat", this.scene);
      tMat.diffuseColor = new Color3(0.3, 0.3, 0.4);
      tMat.emissiveColor = new Color3(0.05, 0.05, 0.1);
      tower.material = tMat;
      new PhysicsAggregate(tower, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
      this.stageMeshes.push(tower);
    }

    for (let i = 0; i < 5; i++) {
      const memory = MeshBuilder.CreateSphere(`memory_${i}`, { diameter: 0.8 }, this.scene);
      memory.position = new Vector3((Math.random() - 0.5) * 20, 1, (Math.random() - 0.5) * 20);
      const mMat = new StandardMaterial("memory_mat", this.scene);
      mMat.diffuseColor = new Color3(1, 0.8, 0.4);
      mMat.emissiveColor = new Color3(0.5, 0.4, 0.2);
      memory.material = mMat;
      this.stageMeshes.push(memory);
    }
  }

  private buildShadowLayer(color: Color3) {
    const ground = MeshBuilder.CreateGround("shadow_ground", { width: 30, height: 30 }, this.scene);
    const mat = new StandardMaterial("shadow_mat", this.scene);
    mat.diffuseColor = color;
    ground.material = mat;
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.stageMeshes.push(ground);

    for (let i = 0; i < 12; i++) {
      const pillar = MeshBuilder.CreateBox(`shadow_pillar_${i}`, { width: 2, height: 10, depth: 2 }, this.scene);
      const angle = (i / 12) * Math.PI * 2;
      pillar.position = new Vector3(Math.cos(angle) * 10, 5, Math.sin(angle) * 10);
      const pMat = new StandardMaterial("shadow_pillar_mat", this.scene);
      pMat.diffuseColor = new Color3(0.02, 0.02, 0.02);
      pillar.material = pMat;
      new PhysicsAggregate(pillar, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
      this.stageMeshes.push(pillar);
    }

    const shadow = MeshBuilder.CreateSphere("shadow_entity", { diameter: 4 }, this.scene);
    shadow.position = new Vector3(0, 2, -10);
    const sMat = new StandardMaterial("shadow_entity_mat", this.scene);
    sMat.diffuseColor = new Color3(0, 0, 0);
    sMat.emissiveColor = new Color3(0.1, 0, 0.2);
    shadow.material = sMat;
    this.stageMeshes.push(shadow);
  }

  private buildReturnLayer(color: Color3) {
    for (let i = 0; i < 20; i++) {
      const step = MeshBuilder.CreateBox(`step_${i}`, { width: 4, height: 0.5, depth: 2 }, this.scene);
      step.position = new Vector3(0, i * 0.5, -i * 2);
      const sMat = new StandardMaterial("step_mat", this.scene);
      sMat.diffuseColor = new Color3(0.7, 0.6, 0.4);
      step.material = sMat;
      new PhysicsAggregate(step, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
      this.stageMeshes.push(step);
    }

    const light = new PointLight("return_light", new Vector3(0, 15, -40), this.scene);
    light.intensity = 2;
    light.diffuse = new Color3(1, 0.95, 0.8);
    this.stageMeshes.push(light as any);
  }

  private fadeToBlack(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.transitionOverlay) {
        this.transitionOverlay.innerHTML = `<div>${text}</div>`;
        this.transitionOverlay.style.opacity = "1";
        this.transitionOverlay.style.pointerEvents = "all";
      }
      setTimeout(resolve, 1500);
    });
  }

  private fadeFromBlack(): Promise<void> {
    return new Promise((resolve) => {
      if (this.transitionOverlay) {
        this.transitionOverlay.style.opacity = "0";
        this.transitionOverlay.style.pointerEvents = "none";
      }
      setTimeout(resolve, 1500);
    });
  }

  private clearStage() {
    this.stageMeshes.forEach((mesh) => mesh.dispose());
    this.stageMeshes = [];
  }

  private saveProgress(stageId: StageId) {
    localStorage.setItem(
      "pyramid_heir_progress",
      JSON.stringify({
        currentStage: stageId,
        objectives: Array.from(this.objectives.entries()),
        timestamp: Date.now(),
      })
    );
  }

  loadProgress(): StageId | null {
    const saved = localStorage.getItem("pyramid_heir_progress");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.objectives) {
          this.objectives = new Map(data.objectives);
        }
        return data.currentStage as StageId;
      } catch {
        return null;
      }
    }
    return null;
  }

  private showGameComplete() {
    if (this.transitionOverlay) {
      this.transitionOverlay.innerHTML = `
        <div style="text-align: center;">
          <h1 style="font-size: 3rem; margin-bottom: 1rem;">🌟 مبروك! 🌟</h1>
          <p style="font-size: 1.5rem;">أكملت رحلة وريث الهرم</p>
          <p style="font-size: 1rem; margin-top: 2rem; opacity: 0.8;">
            الإرث الحقيقي ليس كنزاً، بل مسؤولية حماية الهرم من الظل للأبد.
          </p>
          <button onclick="location.reload()" style="
            margin-top: 2rem; padding: 1rem 2rem; font-size: 1.2rem;
            background: #d4af37; color: #000; border: none;
            cursor: pointer; border-radius: 8px;
          ">العب مرة أخرى</button>
        </div>
      `;
      this.transitionOverlay.style.opacity = "1";
      this.transitionOverlay.style.pointerEvents = "all";
    }
  }

  private notifyObjectiveUpdate() {
    if (this.onObjectiveUpdate) {
      this.onObjectiveUpdate(this.getObjectives());
    }
  }

  checkInteractions(playerPos: Vector3) {
    const config = this.getCurrentConfig();
    if (!config) return;

    if (this.currentStage === StageId.VILLA_WELL) {
      const wellPos = new Vector3(8, 1, 8);
      if (Vector3.Distance(playerPos, wellPos) < 3) {
        this.completeObjective("approach_well");
      }
      const tunnelPos = new Vector3(8, -5, -10);
      if (Vector3.Distance(playerPos, tunnelPos) < 2) {
        this.completeObjective("reach_door");
      }
    }

    if (this.currentStage === StageId.SECRET_CHAMBER) {
      let collected = 0;
      for (let i = 0; i < 7; i++) {
        const key = this.scene.getMeshByName(`key_${i}`);
        if (key && Vector3.Distance(playerPos, key.position) < 1.5) {
          key.dispose();
          collected++;
        }
      }
      if (collected >= 7) {
        this.completeObjective("collect_keys");
      }
    }
  }
}
