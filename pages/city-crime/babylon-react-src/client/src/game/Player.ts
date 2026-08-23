import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";

type MotionState = "idle" | "walk" | "run";

export class Player {
  readonly root: TransformNode;
  readonly collider: Mesh;
  private readonly aggregate: PhysicsAggregate | null;
  private activeMotion: MotionState = "idle";
  private visualTime = 0;
  private velocity = Vector3.Zero();
  private stamina = 100;

  constructor(private readonly scene: Scene, initialPosition: Vector3, physicsEnabled: boolean) {
    this.root = new TransformNode("hero-root", scene);
    this.root.position.copyFrom(initialPosition);

    // بلوك-آوت: كبسولة مرئية زرقاء تمثل يوسف. تُستبدل بنموذج GLB لاحقاً بعد ضبط اللعب.
    this.collider = MeshBuilder.CreateCapsule("hero-capsule", { height: 1.72, radius: 0.32 }, scene);
    this.collider.parent = this.root;
    this.collider.position.y = 0.86;
    this.collider.isVisible = true;
    const heroMat = new StandardMaterial("hero-material", scene);
    heroMat.diffuseColor = Color3.FromHexString("#2C6BE0");
    heroMat.specularColor = Color3.FromHexString("#0A0A0A");
    this.collider.material = heroMat;

    this.aggregate = physicsEnabled ? new PhysicsAggregate(this.collider, PhysicsShapeType.CAPSULE, { mass: 0, friction: 0.7 }, scene) : null;
  }

  get position() {
    return this.root.position;
  }

  get currentStamina() {
    return Math.round(this.stamina);
  }

  update(deltaSeconds: number, movement: Vector3, running: boolean) {
    const desiredSpeed = running && movement.lengthSquared() > 0 ? 6.7 : 3.15;
    const normalized = movement.lengthSquared() > 0 ? movement.normalize() : Vector3.Zero();
    const targetVelocity = normalized.scale(desiredSpeed);
    this.velocity = Vector3.Lerp(this.velocity, targetVelocity, Math.min(1, deltaSeconds * 11));
    this.root.position.addInPlace(this.velocity.scale(deltaSeconds));

    if (this.velocity.lengthSquared() > 0.05) {
      const desiredYaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.root.rotation.y += (desiredYaw - this.root.rotation.y) * Math.min(1, deltaSeconds * 13);
    }

    const nextMotion: MotionState = this.velocity.length() < 0.18 ? "idle" : running ? "run" : "walk";
    if (nextMotion !== this.activeMotion) this.transitionTo(nextMotion);
    this.visualTime += deltaSeconds * (nextMotion === "run" ? 10.5 : nextMotion === "walk" ? 7 : 2);

    this.stamina = running && nextMotion === "run" ? Math.max(8, this.stamina - deltaSeconds * 7) : Math.min(100, this.stamina + deltaSeconds * 13);
  }

  dispose() {
    this.aggregate?.dispose();
    this.root.dispose(false, true);
  }

  private transitionTo(nextMotion: MotionState) {
    if (nextMotion === this.activeMotion) return;
    this.activeMotion = nextMotion;
  }
}
