import { c as Vector3, y as TransformNode, b5 as MeshBuilder, i as StandardMaterial, j as Color3, b6 as HDRCubeTexture, b7 as PBRMaterial, n as DirectionalLight, H as HemisphericLight, b8 as ShadowGenerator, e as Texture, b9 as UniversalCamera, ax as Scene, C as Color4 } from "./babylon-core-DhADYfIs.js";
import { P as PhysicsAggregate, a as PhysicsShapeType, H as HavokPlugin } from "./babylon-physics-kAE5rBMp.js";
import { H as HavokPhysics } from "./babylon-havok-CNZJPyCv.js";
import { D as DefaultRenderingPipeline, S as SSAO2RenderingPipeline } from "./babylon-postprocess-V_CCuZLp.js";
import "./babylon-loaders-DARkz5F_.js";
class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.heldKeys = /* @__PURE__ */ new Set();
    this.interactQueued = false;
    this.yaw = 0;
    this.pitch = -0.08;
    this.pointerLocked = false;
    this.onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "shift", "e"].includes(key)) event.preventDefault();
      this.heldKeys.add(key);
      if (key === "e" && !event.repeat) this.interactQueued = true;
    };
    this.onKeyUp = (event) => {
      this.heldKeys.delete(event.key.toLowerCase());
    };
    this.onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    };
    this.onPointerMove = (event) => {
      if (!this.pointerLocked) return;
      this.yaw -= event.movementX * 22e-4;
      this.pitch = Math.max(-0.55, Math.min(0.24, this.pitch - event.movementY * 15e-4));
    };
    this.onCanvasClick = () => {
      if (!this.pointerLocked) this.canvas.requestPointerLock?.();
    };
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onPointerMove);
    canvas.addEventListener("click", this.onCanvasClick);
  }
  consume() {
    const moveX = Number(this.heldKeys.has("d")) - Number(this.heldKeys.has("a"));
    const moveZ = Number(this.heldKeys.has("w")) - Number(this.heldKeys.has("s"));
    const interactPressed = this.interactQueued;
    this.interactQueued = false;
    return {
      moveX,
      moveZ,
      running: this.heldKeys.has("shift"),
      interactPressed,
      yaw: this.yaw,
      pitch: this.pitch
    };
  }
  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onPointerMove);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
  }
}
class Player {
  constructor(scene, initialPosition, physicsEnabled) {
    this.scene = scene;
    this.activeMotion = "idle";
    this.visualTime = 0;
    this.velocity = Vector3.Zero();
    this.stamina = 100;
    this.root = new TransformNode("heroine-root", scene);
    this.root.position.copyFrom(initialPosition);
    this.collider = MeshBuilder.CreateBox("heroine-physics", { width: 0.64, depth: 0.5, height: 1.72 }, scene);
    this.collider.parent = this.root;
    this.collider.position.y = 0.86;
    this.collider.isVisible = false;
    this.aggregate = physicsEnabled ? new PhysicsAggregate(this.collider, PhysicsShapeType.BOX, { mass: 0, friction: 0.7 }, scene) : null;
  }
  get position() {
    return this.root.position;
  }
  get currentStamina() {
    return Math.round(this.stamina);
  }
  update(deltaSeconds, movement, running) {
    const desiredSpeed = running && movement.lengthSquared() > 0 ? 6.7 : 3.15;
    const normalized = movement.lengthSquared() > 0 ? movement.normalize() : Vector3.Zero();
    const targetVelocity = normalized.scale(desiredSpeed);
    this.velocity = Vector3.Lerp(this.velocity, targetVelocity, Math.min(1, deltaSeconds * 11));
    this.root.position.addInPlace(this.velocity.scale(deltaSeconds));
    if (this.velocity.lengthSquared() > 0.05) {
      const desiredYaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.root.rotation.y += (desiredYaw - this.root.rotation.y) * Math.min(1, deltaSeconds * 13);
    }
    const nextMotion = this.velocity.length() < 0.18 ? "idle" : running ? "run" : "walk";
    if (nextMotion !== this.activeMotion) this.transitionTo(nextMotion);
    this.visualTime += deltaSeconds * (nextMotion === "run" ? 10.5 : nextMotion === "walk" ? 7 : 2);
    this.stamina = running && nextMotion === "run" ? Math.max(8, this.stamina - deltaSeconds * 7) : Math.min(100, this.stamina + deltaSeconds * 13);
  }
  dispose() {
    this.aggregate?.dispose();
    this.root.dispose(false, true);
  }
  transitionTo(nextMotion) {
    if (nextMotion === this.activeMotion) return;
    this.activeMotion = nextMotion;
  }
}
class Vehicle {
  constructor(scene, position, physicsEnabled) {
    this.wheels = [];
    this.speed = 0;
    this.controlled = false;
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
  toggleControl(playerPosition) {
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
  update(deltaSeconds, input) {
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
const publishAsset = (fileName, developmentPath) => developmentPath;
const assets = {
  asphalt: {
    diffuse: publishAsset("asphalt_diff_2k.jpg", "/manus-storage/asphalt_diff_2k_9fa4ba4e.jpg"),
    normal: publishAsset("asphalt_normal_2k.jpg", "/manus-storage/asphalt_normal_2k_269f9e53.jpg"),
    roughness: publishAsset("asphalt_roughness_2k.jpg", "/manus-storage/asphalt_roughness_2k_3c86db6e.jpg")
  },
  concrete: {
    diffuse: publishAsset("concrete_diff_2k.jpg", "/manus-storage/concrete_diff_2k_5023af34.jpg"),
    normal: publishAsset("concrete_normal_2k.jpg", "/manus-storage/concrete_normal_2k_5ab78430.jpg"),
    roughness: publishAsset("concrete_roughness_2k.jpg", "/manus-storage/concrete_roughness_2k_c69508cc.jpg")
  },
  daylightHdr: publishAsset("kloppenheim_06_puresky_1k.hdr", "/manus-storage/kloppenheim_06_puresky_1k_03e03c41.hdr"),
  havokWasm: publishAsset("HavokPhysics.wasm", "/manus-storage/HavokPhysics_51481a86.wasm")
};
function trackTexture(texture, label, progress, progressState) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      progressState.completed += 1;
      progress(label, progressState.completed, progressState.total);
      resolve();
    };
    texture.onLoadObservable.addOnce(settle);
    const timeoutId = window.setTimeout(settle, 6500);
    if (texture.isReady()) window.queueMicrotask(settle);
  });
}
function createPbrMaterial(name, scene, source, tileScale, progress, progressState) {
  const usePbr = scene.getEngine().getClassName() === "WebGPUEngine";
  const material = usePbr ? new PBRMaterial(name, scene) : new StandardMaterial(name, scene);
  if (material instanceof PBRMaterial) {
    material.metallic = 0.03;
    material.roughness = 0.88;
    material.environmentIntensity = 0.52;
  } else {
    material.specularColor = Color3.FromHexString("#20242A");
    material.specularPower = 32;
  }
  const diffuse = new Texture(source.diffuse, scene, true, false);
  const normal = new Texture(source.normal, scene, true, false);
  const roughness = new Texture(source.roughness, scene, true, false);
  [diffuse, normal, roughness].forEach((texture) => {
    texture.uScale = tileScale;
    texture.vScale = tileScale;
  });
  if (material instanceof PBRMaterial) {
    material.albedoTexture = diffuse;
    material.bumpTexture = normal;
    material.microSurfaceTexture = roughness;
    material.invertNormalMapX = true;
  } else {
    material.diffuseTexture = diffuse;
    material.bumpTexture = normal;
    material.invertNormalMapX = true;
  }
  const textureEntries = [
    ["لون الخامة", diffuse],
    ["التفاصيل الطبيعية", normal],
    ["خشونة السطح", roughness]
  ];
  const ready = Promise.all(textureEntries.map(([label, texture]) => trackTexture(texture, `${name}: ${label}`, progress, progressState))).then(() => void 0);
  return { material, ready };
}
function createBuilding(scene, concrete, index, position, size) {
  const building = MeshBuilder.CreateBox(`building-${index}`, { width: size.x, height: size.y, depth: size.z }, scene);
  building.position.copyFrom(position);
  building.position.y = size.y / 2;
  building.material = concrete;
  const glass = new StandardMaterial(`building-glass-${index}`, scene);
  glass.diffuseColor = Color3.FromHexString("#162738");
  glass.specularColor = Color3.FromHexString("#7AA4BB");
  glass.emissiveColor = Color3.FromHexString("#07111C");
  glass.alpha = 0.93;
  const columns = Math.max(2, Math.floor(size.x / 2.3));
  const rows = Math.max(2, Math.floor(size.y / 2.5));
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const window2 = MeshBuilder.CreateBox(`building-window-${index}-${column}-${row}`, {
        width: Math.min(1.1, size.x / columns - 0.22),
        height: 1.3,
        depth: 0.05
      }, scene);
      window2.parent = building;
      window2.position.x = -size.x / 2 + (column + 0.5) * (size.x / columns);
      window2.position.y = -size.y / 2 + 1.28 + row * 2.32;
      window2.position.z = size.z / 2 + 0.035;
      window2.material = glass;
    }
  }
  const roof = MeshBuilder.CreateBox(`building-roof-${index}`, { width: size.x + 0.3, height: 0.16, depth: size.z + 0.3 }, scene);
  roof.parent = building;
  roof.position.y = size.y / 2 + 0.08;
  roof.material = concrete;
  return building;
}
function createRoadMarkings(scene) {
  const paint = new StandardMaterial("road-paint", scene);
  paint.diffuseColor = Color3.FromHexString("#D1B16A");
  paint.specularColor = Color3.FromHexString("#3A3020");
  for (let z = -30; z <= 30; z += 4) {
    const line = MeshBuilder.CreateBox(`road-mark-${z}`, { width: 0.14, height: 0.024, depth: 1.75 }, scene);
    line.position.set(0, 0.027, z);
    line.material = paint;
  }
  for (let x = -24; x <= 24; x += 4) {
    const line = MeshBuilder.CreateBox(`cross-mark-${x}`, { width: 1.75, height: 0.024, depth: 0.14 }, scene);
    line.position.set(x, 0.028, 0);
    line.material = paint;
  }
}
function createMissionRoute(scene) {
  const amber = new StandardMaterial("objective-amber-route", scene);
  amber.diffuseColor = Color3.FromHexString("#F4A62A");
  amber.emissiveColor = Color3.FromHexString("#A65A08");
  amber.specularColor = Color3.FromHexString("#FFF0C7");
  [-9.8, -7.8, -5.8, -3.8, -1.8, 0.2].forEach((z, index) => {
    const segment = MeshBuilder.CreateBox(`objective-route-z-${index}`, { width: 0.24, height: 0.035, depth: 0.9 }, scene);
    segment.position.set(1.05, 0.04, z);
    segment.material = amber;
  });
  [1.8, 3.2, 4.6].forEach((x, index) => {
    const segment = MeshBuilder.CreateBox(`objective-route-x-${index}`, { width: 0.9, height: 0.035, depth: 0.24 }, scene);
    segment.position.set(x, 0.04, 1.35);
    segment.material = amber;
  });
  const ring = MeshBuilder.CreateTorus("objective-vehicle-ring", { diameter: 1.8, thickness: 0.075, tessellation: 24 }, scene);
  ring.position.set(5.5, 0.06, 3.5);
  ring.rotation.x = Math.PI / 2;
  ring.material = amber;
  const beacon = MeshBuilder.CreateCylinder("objective-beacon", { height: 2.4, diameterTop: 0.08, diameterBottom: 0.18, tessellation: 12 }, scene);
  beacon.position.set(5.5, 1.2, 3.5);
  beacon.material = amber;
}
function createStreetProps(scene) {
  const metal = new StandardMaterial("street-metal", scene);
  metal.diffuseColor = Color3.FromHexString("#303C46");
  metal.specularColor = Color3.FromHexString("#A7C1CE");
  const amber = new StandardMaterial("traffic-amber", scene);
  amber.diffuseColor = Color3.FromHexString("#F4A62A");
  amber.emissiveColor = Color3.FromHexString("#B86D0D");
  amber.roughness = 0.36;
  [[-7.6, -7.6], [7.6, -7.6], [-7.6, 7.6], [7.6, 7.6]].forEach(([x, z], index) => {
    const pole = MeshBuilder.CreateCylinder(`traffic-pole-${index}`, { height: 5.8, diameter: 0.15, tessellation: 12 }, scene);
    pole.position.set(x, 2.9, z);
    pole.material = metal;
    const signal = MeshBuilder.CreateBox(`traffic-signal-${index}`, { width: 0.42, height: 0.92, depth: 0.28 }, scene);
    signal.position.set(x, 5.15, z);
    signal.material = metal;
    const lens = MeshBuilder.CreateSphere(`traffic-lens-${index}`, { diameter: 0.18, segments: 12 }, scene);
    lens.position.set(x, 5.28, z + (z < 0 ? 0.16 : -0.16));
    lens.material = amber;
  });
  [[-8.6, 13], [8.6, 13], [-8.6, -13], [8.6, -13]].forEach(([x, z], index) => {
    const lamp = MeshBuilder.CreateCylinder(`street-lamp-${index}`, { height: 7, diameter: 0.12, tessellation: 12 }, scene);
    lamp.position.set(x, 3.5, z);
    lamp.material = metal;
    const head = MeshBuilder.CreateSphere(`street-lamp-head-${index}`, { diameter: 0.32, segments: 12 }, scene);
    head.position.set(x, 6.82, z);
    head.material = amber;
  });
  const bollard = new StandardMaterial("street-bollard", scene);
  bollard.diffuseColor = Color3.FromHexString("#4B5961");
  bollard.specularColor = Color3.FromHexString("#C5D0D6");
  [-10.5, -8.9, 8.9, 10.5].forEach((x, index) => {
    const post = MeshBuilder.CreateCylinder(`sidewalk-bollard-${index}`, { height: 0.78, diameter: 0.16, tessellation: 12 }, scene);
    post.position.set(x, 0.39, -5.6);
    post.material = bollard;
  });
}
async function createEnvironment(scene, progress, physicsEnabled) {
  const progressState = { completed: 0, total: 8 };
  const asphalt = createPbrMaterial("إسفلت Poly Haven", scene, assets.asphalt, 12, progress, progressState);
  const concrete = createPbrMaterial("خرسانة Poly Haven", scene, assets.concrete, 5, progress, progressState);
  const hdr = new HDRCubeTexture(assets.daylightHdr, scene, 128, false, true, false, true);
  scene.environmentTexture = hdr;
  scene.environmentIntensity = 0.78;
  progressState.completed += 1;
  progress("إضاءة البيئة HDRI", progressState.completed, progressState.total);
  const ground = MeshBuilder.CreateGround("city-ground", { width: 62, height: 62, subdivisions: 2 }, scene);
  ground.material = asphalt.material;
  const groundAggregate = physicsEnabled ? new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.92, restitution: 0.02 }, scene) : null;
  const sidewalkMaterial = concrete.material.clone("sidewalk-concrete");
  if (sidewalkMaterial instanceof PBRMaterial) sidewalkMaterial.albedoColor = Color3.FromHexString("#B7B6AE");
  if (sidewalkMaterial instanceof StandardMaterial) sidewalkMaterial.diffuseColor = Color3.FromHexString("#B7B6AE");
  const sidewalks = [
    { x: -12.2, z: 0, width: 5.8, depth: 62 },
    { x: 12.2, z: 0, width: 5.8, depth: 62 },
    { x: 0, z: -12.2, width: 24, depth: 5.8 },
    { x: 0, z: 12.2, width: 24, depth: 5.8 }
  ];
  sidewalks.forEach((sidewalk, index) => {
    const mesh = MeshBuilder.CreateBox(`sidewalk-${index}`, { width: sidewalk.width, height: 0.17, depth: sidewalk.depth }, scene);
    mesh.position.set(sidewalk.x, 0.08, sidewalk.z);
    mesh.material = sidewalkMaterial;
  });
  const curbMaterial = new StandardMaterial("street-curb", scene);
  curbMaterial.diffuseColor = Color3.FromHexString("#8E9190");
  curbMaterial.specularColor = Color3.FromHexString("#D7DED9");
  [-9.18, 9.18].forEach((x, index) => {
    const curb = MeshBuilder.CreateBox(`long-curb-${index}`, { width: 0.28, height: 0.22, depth: 56 }, scene);
    curb.position.set(x, 0.11, 0);
    curb.material = curbMaterial;
  });
  [-9.18, 9.18].forEach((z, index) => {
    const curb = MeshBuilder.CreateBox(`cross-curb-${index}`, { width: 18.4, height: 0.22, depth: 0.28 }, scene);
    curb.position.set(0, 0.11, z);
    curb.material = curbMaterial;
  });
  createRoadMarkings(scene);
  createMissionRoute(scene);
  createStreetProps(scene);
  [
    [new Vector3(-18, 0, -17), new Vector3(8, 12, 8)],
    [new Vector3(17, 0, -16), new Vector3(7, 16, 9)],
    [new Vector3(-18, 0, 17), new Vector3(8, 20, 7)],
    [new Vector3(18, 0, 17), new Vector3(8, 11, 9)],
    [new Vector3(-26, 0, 2), new Vector3(6, 8, 11)],
    [new Vector3(26, 0, 1), new Vector3(6, 13, 10)]
  ].forEach(([position, size], index) => createBuilding(scene, concrete.material, index, position, size));
  const sun = new DirectionalLight("late-afternoon-sun", new Vector3(-0.61, -0.74, 0.32), scene);
  sun.position = new Vector3(30, 26, -28);
  sun.intensity = 4.1;
  sun.diffuse = Color3.FromHexString("#FFE0B8");
  const fill = new HemisphericLight("blue-sky-fill", new Vector3(0.15, 1, -0.28), scene);
  fill.intensity = 0.46;
  fill.diffuse = Color3.FromHexString("#A6BFDA");
  fill.groundColor = Color3.FromHexString("#1D2429");
  const shadowGenerator = new ShadowGenerator(1536, sun, true);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadowGenerator.bias = 25e-5;
  progressState.completed += 1;
  progress("هندسة الشارع والظلال", progressState.completed, progressState.total);
  return {
    ground,
    shadowGenerator,
    ready: Promise.all([asphalt.ready, concrete.ready]).then(() => void 0),
    dispose: () => {
      groundAggregate?.dispose();
      hdr.dispose();
    }
  };
}
const CAMERA_TUNING = {
  firstPersonEyeHeight: 1.62,
  firstPersonLookDistance: 9,
  firstPersonSmoothing: 13,
  vehicleFollowDistance: 8.8,
  vehicleFollowHeight: 2.6
};
class GameWorld {
  constructor(scene, engine, canvas, tier, updateHud, physicsEnabled, demo = false) {
    this.scene = scene;
    this.engine = engine;
    this.canvas = canvas;
    this.tier = tier;
    this.updateHud = updateHud;
    this.physicsEnabled = physicsEnabled;
    this.demo = demo;
    this.environment = null;
    this.postProcess = null;
    this.ssao = null;
    this.lastHudUpdate = 0;
    this.resolutionScore = 60;
    this.scalingLevel = 1;
    this.demoTime = 0;
    this.missionTarget = new Vector3(5.5, 0, 3.5);
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
      this.updateHud({ loading: { label, progress: 30 + completed / total * 48, active: true } });
    }, this.physicsEnabled);
    this.environment.shadowGenerator.addShadowCaster(this.player.collider);
    this.environment.shadowGenerator.addShadowCaster(this.vehicle.body);
    this.createPostProcessing();
    this.updateHud({ loading: { label: "تحميل خامات البيئة", progress: 78, active: true } });
    void this.environment.ready.then(() => {
      this.updateHud({ loading: { label: "المشهد جاهز", progress: 100, active: false } });
    });
  }
  update(deltaSeconds) {
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
    const vehicleInput = this.demo && this.vehicle.isControlled ? { ...input, moveZ: 1, moveX: Math.sin(this.demoTime * 0.7) * 0.28 } : input;
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
          inVehicle: this.vehicle.isControlled
        },
        mission: {
          id: "reach-vehicle",
          title: "المهمة الرئيسية",
          objective: this.vehicle.isControlled ? "التحرك إلى نقطة الاختبار" : distanceToVehicle < 4 ? "اضغط E لقيادة المركبة" : "الوصول إلى المركبة",
          progress: this.vehicle.isControlled ? 1 : Math.max(0, Math.min(0.86, 1 - distanceToVehicle / 26)),
          target: { x: this.missionTarget.x, z: this.missionTarget.z }
        }
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
  createPostProcessing() {
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
      this.ssao = new SSAO2RenderingPipeline("street-ssao", this.scene, { ssaoRatio: 0.5, combineRatio: 1 }, [this.camera], true);
      this.ssao.radius = 2.1;
      this.ssao.totalStrength = 0.55;
      this.ssao.expensiveBlur = false;
      this.ssao.samples = this.tier === "Ultra" ? 16 : 8;
    }
  }
  updateDynamicResolution(deltaSeconds) {
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
async function createGameScene(engine, canvas, tier, updateHud, demo = false) {
  updateHud({ loading: { label: "تفعيل محرك الفيزياء", progress: 24, active: true } });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.12, 0.17, 0.22, 1);
  scene.collisionsEnabled = true;
  let physicsEnabled = false;
  try {
    if (demo) throw new Error("Demo mode uses deterministic movement fallback.");
    const havokUrl = new URL(assets.havokWasm, window.location.origin).toString();
    console.info("Initializing Havok physics from", havokUrl);
    const havokInstance = await Promise.race([
      HavokPhysics({ locateFile: (fileName) => fileName.endsWith(".wasm") ? havokUrl : fileName }),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("Havok initialization timed out after 4.5 seconds")), 4500);
      })
    ]);
    physicsEnabled = scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, havokInstance));
    if (!physicsEnabled) throw new Error("Babylon scene rejected the Havok physics plugin");
    console.info("Havok physics enabled.");
  } catch (error) {
    console.warn("Havok could not initialize; the scene will use movement fallbacks.", error);
    updateHud({ loading: { label: "تعذر تسريع الفيزياء — متابعة التهيئة", progress: 27, active: true } });
  }
  const world = new GameWorld(scene, engine, canvas, tier, updateHud, physicsEnabled, demo);
  await world.initialize();
  scene.onBeforeRenderObservable.add(() => world.update(Math.min(0.05, engine.getDeltaTime() / 1e3)));
  return {
    scene,
    dispose: () => {
      world.dispose();
      scene.dispose();
    }
  };
}
export {
  createGameScene
};
