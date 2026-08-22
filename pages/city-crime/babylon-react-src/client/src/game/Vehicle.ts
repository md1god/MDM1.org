import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { InputSnapshot } from "./InputManager";

export class Vehicle {
  readonly body: Mesh;
  private readonly aggregate: PhysicsAggregate | null;
  private readonly wheels: Mesh[] = [];
  private speed = 0;
  private controlled = false;

  constructor(scene: Scene, position: Vector3, physicsEnabled: boolean) {
    this.body = MeshBuilder.CreateBox("drivable-sedan-physics", { width: 1.84, height: 0.62, depth: 4.38 }, scene);
    this.body.position.copyFrom(position);
    this.body.position.y = 0.78;
    this.body.rotation.y = -0.34;

    const bodyMaterial = new StandardMaterial("sedan-graphite", scene);
    bodyMaterial.diffuseColor = Color3.FromHexString("#293542");
    bodyMaterial.specularColor = Color3.FromHexString("#C5D4DA");
    bodyMaterial.specularPower = 96;
    this.body.material = bodyMaterial;

    const trimMaterial = new StandardMaterial("sedan-chrome-trim", scene);
    trimMaterial.diffuseColor = Color3.FromHexString("#63727A");
    trimMaterial.specularColor = Color3.FromHexString("#F1F5F3");
    trimMaterial.specularPower = 128;
    const hood = MeshBuilder.CreateBox("sedan-hood", { width: 1.72, height: 0.18, depth: 1.3 }, scene);
    hood.parent = this.body;
    hood.position.set(0, 0.38, 1.42);
    hood.material = bodyMaterial;
    const trunk = MeshBuilder.CreateBox("sedan-trunk", { width: 1.7, height: 0.2, depth: 0.82 }, scene);
    trunk.parent = this.body;
    trunk.position.set(0, 0.4, -1.62);
    trunk.material = bodyMaterial;
    const bumperFront = MeshBuilder.CreateBox("sedan-front-bumper", { width: 1.9, height: 0.18, depth: 0.16 }, scene);
    bumperFront.parent = this.body;
    bumperFront.position.set(0, -0.15, 2.23);
    bumperFront.material = trimMaterial;
    const bumperRear = bumperFront.clone("sedan-rear-bumper");
    if (bumperRear) bumperRear.position.z = -2.23;

    const cabin = MeshBuilder.CreateBox("sedan-cabin", { width: 1.46, height: 0.56, depth: 2.05 }, scene);
    cabin.parent = this.body;
    cabin.position.y = 0.5;
    cabin.position.z = -0.15;
    const glass = new StandardMaterial("sedan-glass", scene);
    glass.diffuseColor = Color3.FromHexString("#1D3B50");
    glass.specularColor = Color3.FromHexString("#A8C9D7");
    glass.alpha = 0.72;
    cabin.material = glass;
    const roof = MeshBuilder.CreateBox("sedan-roof", { width: 1.36, height: 0.12, depth: 1.55 }, scene);
    roof.parent = this.body;
    roof.position.set(0, 0.83, -0.2);
    roof.material = bodyMaterial;

    const tireMaterial = new StandardMaterial("tire-material", scene);
    tireMaterial.diffuseColor = Color3.FromHexString("#111315");
    [-0.82, 0.82].forEach((x) => {
      [-1.48, 1.48].forEach((z) => {
        const wheel = MeshBuilder.CreateCylinder("sedan-wheel", { diameter: 0.67, height: 0.27, tessellation: 18 }, scene);
        wheel.parent = this.body;
        wheel.position.set(x, -0.38, z);
        wheel.rotation.z = Math.PI / 2;
        wheel.material = tireMaterial;
        const rim = MeshBuilder.CreateCylinder("sedan-wheel-rim", { diameter: 0.38, height: 0.285, tessellation: 16 }, scene);
        rim.parent = wheel;
        rim.position.z = 0.01;
        rim.material = trimMaterial;
        this.wheels.push(wheel);
      });
    });

    const lightMaterial = new StandardMaterial("sedan-headlights", scene);
    lightMaterial.diffuseColor = Color3.FromHexString("#DBE8F1");
    lightMaterial.emissiveColor = Color3.FromHexString("#6A9AC1");
    lightMaterial.roughness = 0.15;
    const leftLamp = MeshBuilder.CreateBox("sedan-left-lamp", { width: 0.38, height: 0.13, depth: 0.06 }, scene);
    leftLamp.parent = this.body;
    leftLamp.position.set(-0.52, 0.03, 2.21);
    leftLamp.material = lightMaterial;
    const rightLamp = leftLamp.clone("sedan-right-lamp");
    if (rightLamp) rightLamp.position.x = 0.52;
    const grille = MeshBuilder.CreateBox("sedan-grille", { width: 0.72, height: 0.19, depth: 0.05 }, scene);
    grille.parent = this.body;
    grille.position.set(0, -0.03, 2.22);
    grille.material = trimMaterial;
    const rearLightMaterial = new StandardMaterial("sedan-rear-lights", scene);
    rearLightMaterial.diffuseColor = Color3.FromHexString("#B63E35");
    rearLightMaterial.emissiveColor = Color3.FromHexString("#661A16");
    [-0.54, 0.54].forEach((x, index) => {
      const tail = MeshBuilder.CreateBox(`sedan-tail-lamp-${index}`, { width: 0.35, height: 0.13, depth: 0.06 }, scene);
      tail.parent = this.body;
      tail.position.set(x, 0.03, -2.21);
      tail.material = rearLightMaterial;
    });

    this.aggregate = physicsEnabled ? new PhysicsAggregate(this.body, PhysicsShapeType.BOX, { mass: 0, friction: 0.92, restitution: 0.05 }, scene) : null;
  }

  get isControlled() {
    return this.controlled;
  }

  toggleControl(playerPosition: Vector3) {
    if (this.controlled) {
      this.controlled = false;
      playerPosition.copyFrom(this.body.position.add(new Vector3(2.1, 0, 0)));
      return true;
    }

    if (Vector3.DistanceSquared(playerPosition, this.body.position) < 16) {
      this.controlled = true;
      return true;
    }
    return false;
  }

  update(deltaSeconds: number, input: InputSnapshot) {
    if (!this.controlled) return;
    const throttle = input.moveZ;
    const steering = input.moveX;
    const targetSpeed = throttle * (throttle < 0 ? 6 : 15);
    this.speed += (targetSpeed - this.speed) * Math.min(1, deltaSeconds * (throttle === 0 ? 4.5 : 2.5));
    this.body.rotation.y += steering * deltaSeconds * Math.max(0.35, Math.min(1.45, Math.abs(this.speed) / 6)) * Math.sign(this.speed || 1);
    const forward = new Vector3(Math.sin(this.body.rotation.y), 0, Math.cos(this.body.rotation.y));
    this.body.position.addInPlace(forward.scale(this.speed * deltaSeconds));
    this.wheels.forEach((wheel, index) => {
      wheel.rotation.x += this.speed * deltaSeconds * 2.8;
      if (index < 2) wheel.rotation.y = steering * 0.28;
    });
  }

  dispose() {
    this.aggregate?.dispose();
    this.body.dispose(false, true);
  }
}
