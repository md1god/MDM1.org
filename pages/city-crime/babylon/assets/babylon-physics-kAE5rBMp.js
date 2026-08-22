import { aw as _WarnImport, c as Vector3, ax as Scene, ay as SceneComponentConstants, L as Logger, O as Observable, a1 as TmpVectors, M as Matrix, az as FloatingOriginCurrentScene, aA as BuildArray, Q as Quaternion, q as Mesh, v as VertexBuffer, aB as BoundingBox, aC as InstancedMesh, aD as WithinEpsilon } from "./babylon-core-DhADYfIs.js";
let PhysicsEngine$1 = class PhysicsEngine {
  /**
   *
   * @returns version
   */
  getPluginVersion() {
    return this._physicsPlugin.getPluginVersion();
  }
  /**
   * @virtual
   * Factory used to create the default physics plugin.
   * @returns The default physics plugin
   */
  static DefaultPluginFactory() {
    throw _WarnImport("CannonJSPlugin");
  }
  /**
   * Creates a new Physics Engine
   * @param gravity defines the gravity vector used by the simulation
   * @param _physicsPlugin defines the plugin to use (CannonJS by default)
   */
  constructor(gravity, _physicsPlugin = PhysicsEngine.DefaultPluginFactory()) {
    this._physicsPlugin = _physicsPlugin;
    this._impostors = [];
    this._joints = [];
    this._subTimeStep = 0;
    this._uniqueIdCounter = 0;
    if (!this._physicsPlugin.isSupported()) {
      throw new Error("Physics Engine " + this._physicsPlugin.name + " cannot be found. Please make sure it is included.");
    }
    gravity = gravity || new Vector3(0, -9.807, 0);
    this.setGravity(gravity);
    this.setTimeStep();
  }
  /**
   * Sets the gravity vector used by the simulation
   * @param gravity defines the gravity vector to use
   */
  setGravity(gravity) {
    this.gravity = gravity;
    this._physicsPlugin.setGravity(this.gravity);
  }
  /**
   * Set the time step of the physics engine.
   * Default is 1/60.
   * To slow it down, enter 1/600 for example.
   * To speed it up, 1/30
   * @param newTimeStep defines the new timestep to apply to this world.
   */
  setTimeStep(newTimeStep = 1 / 60) {
    this._physicsPlugin.setTimeStep(newTimeStep);
  }
  /**
   * Get the time step of the physics engine.
   * @returns the current time step
   */
  getTimeStep() {
    return this._physicsPlugin.getTimeStep();
  }
  /**
   * Set the sub time step of the physics engine.
   * Default is 0 meaning there is no sub steps
   * To increase physics resolution precision, set a small value (like 1 ms)
   * @param subTimeStep defines the new sub timestep used for physics resolution.
   */
  setSubTimeStep(subTimeStep = 0) {
    this._subTimeStep = subTimeStep;
  }
  /**
   * Get the sub time step of the physics engine.
   * @returns the current sub time step
   */
  getSubTimeStep() {
    return this._subTimeStep;
  }
  /**
   * Release all resources
   */
  dispose() {
    for (const impostor of this._impostors) {
      impostor.dispose();
    }
    this._physicsPlugin.dispose();
  }
  /**
   * Gets the name of the current physics plugin
   * @returns the name of the plugin
   */
  getPhysicsPluginName() {
    return this._physicsPlugin.name;
  }
  /**
   * Adding a new impostor for the impostor tracking.
   * This will be done by the impostor itself.
   * @param impostor the impostor to add
   */
  addImpostor(impostor) {
    this._impostors.push(impostor);
    impostor.uniqueId = this._uniqueIdCounter++;
    if (!impostor.parent) {
      this._physicsPlugin.generatePhysicsBody(impostor);
    }
  }
  /**
   * Remove an impostor from the engine.
   * This impostor and its mesh will not longer be updated by the physics engine.
   * @param impostor the impostor to remove
   */
  removeImpostor(impostor) {
    const index = this._impostors.indexOf(impostor);
    if (index > -1) {
      const removed = this._impostors.splice(index, 1);
      if (removed.length) {
        this.getPhysicsPlugin().removePhysicsBody(impostor);
      }
    }
  }
  /**
   * Add a joint to the physics engine
   * @param mainImpostor defines the main impostor to which the joint is added.
   * @param connectedImpostor defines the impostor that is connected to the main impostor using this joint
   * @param joint defines the joint that will connect both impostors.
   */
  addJoint(mainImpostor, connectedImpostor, joint) {
    const impostorJoint = {
      mainImpostor,
      connectedImpostor,
      joint
    };
    joint.physicsPlugin = this._physicsPlugin;
    this._joints.push(impostorJoint);
    this._physicsPlugin.generateJoint(impostorJoint);
  }
  /**
   * Removes a joint from the simulation
   * @param mainImpostor defines the impostor used with the joint
   * @param connectedImpostor defines the other impostor connected to the main one by the joint
   * @param joint defines the joint to remove
   */
  removeJoint(mainImpostor, connectedImpostor, joint) {
    const matchingJoints = this._joints.filter(function(impostorJoint) {
      return impostorJoint.connectedImpostor === connectedImpostor && impostorJoint.joint === joint && impostorJoint.mainImpostor === mainImpostor;
    });
    if (matchingJoints.length) {
      this._physicsPlugin.removeJoint(matchingJoints[0]);
    }
  }
  /**
   * Called by the scene. No need to call it.
   * @param delta defines the timespan between frames
   */
  _step(delta) {
    for (const impostor of this._impostors) {
      if (impostor.isBodyInitRequired()) {
        this._physicsPlugin.generatePhysicsBody(impostor);
      }
    }
    if (delta > 0.1) {
      delta = 0.1;
    } else if (delta <= 0) {
      delta = 1 / 60;
    }
    this._physicsPlugin.executeStep(delta, this._impostors);
  }
  /**
   * Gets the current plugin used to run the simulation
   * @returns current plugin
   */
  getPhysicsPlugin() {
    return this._physicsPlugin;
  }
  /**
   * Gets the list of physic impostors
   * @returns an array of PhysicsImpostor
   */
  getImpostors() {
    return this._impostors;
  }
  /**
   * Gets the impostor for a physics enabled object
   * @param object defines the object impersonated by the impostor
   * @returns the PhysicsImpostor or null if not found
   */
  getImpostorForPhysicsObject(object) {
    for (let i = 0; i < this._impostors.length; ++i) {
      if (this._impostors[i].object === object) {
        return this._impostors[i];
      }
    }
    return null;
  }
  /**
   * Gets the impostor for a physics body object
   * @param body defines physics body used by the impostor
   * @returns the PhysicsImpostor or null if not found
   */
  getImpostorWithPhysicsBody(body) {
    for (let i = 0; i < this._impostors.length; ++i) {
      if (this._impostors[i].physicsBody === body) {
        return this._impostors[i];
      }
    }
    return null;
  }
  /**
   * Does a raycast in the physics world
   * @param from when should the ray start?
   * @param to when should the ray end?
   * @returns PhysicsRaycastResult
   */
  raycast(from, to) {
    return this._physicsPlugin.raycast(from, to);
  }
  /**
   * Does a raycast in the physics world
   * @param from when should the ray start?
   * @param to when should the ray end?
   * @param result resulting PhysicsRaycastResult
   * @returns true if the ray hits an impostor, else false
   */
  raycastToRef(from, to, result) {
    return this._physicsPlugin.raycastToRef(from, to, result);
  }
};
class CastingResult {
  constructor() {
    this._hasHit = false;
    this._hitNormal = Vector3.Zero();
    this._hitPoint = Vector3.Zero();
    this._triangleIndex = -1;
  }
  /**
   * Gets the hit point.
   */
  get hitPoint() {
    return this._hitPoint;
  }
  /**
   * Gets the hit normal.
   */
  get hitNormal() {
    return this._hitNormal;
  }
  /**
   * Gets if there was a hit
   */
  get hasHit() {
    return this._hasHit;
  }
  /**
   * The index of the original triangle which was hit. Will be -1 if contact point is not on a mesh shape
   */
  get triangleIndex() {
    return this._triangleIndex;
  }
  /**
   * Sets the hit data
   * @param hitNormal defines the normal in world space
   * @param hitPoint defines the point in world space
   * @param triangleIndex defines the index of the triangle in case of mesh shape
   */
  setHitData(hitNormal, hitPoint, triangleIndex) {
    this._hasHit = true;
    this._hitNormal.set(hitNormal.x, hitNormal.y, hitNormal.z);
    this._hitPoint.set(hitPoint.x, hitPoint.y, hitPoint.z);
    this._triangleIndex = triangleIndex ?? -1;
  }
  /**
   * Resets all the values to default
   */
  reset() {
    this._hasHit = false;
    this._hitNormal.setAll(0);
    this._hitPoint.setAll(0);
    this._triangleIndex = -1;
    this.body = void 0;
    this.bodyIndex = void 0;
    this.shape = void 0;
  }
}
class PhysicsRaycastResult extends CastingResult {
  constructor() {
    super(...arguments);
    this._hitDistance = 0;
    this._rayFromWorld = Vector3.Zero();
    this._rayToWorld = Vector3.Zero();
  }
  /**
   * Gets the distance from the hit
   */
  get hitDistance() {
    return this._hitDistance;
  }
  /**
   * Gets the hit normal/direction in the world
   */
  get hitNormalWorld() {
    return this._hitNormal;
  }
  /**
   * Gets the hit point in the world
   */
  get hitPointWorld() {
    return this._hitPoint;
  }
  /**
   * Gets the ray "start point" of the ray in the world
   */
  get rayFromWorld() {
    return this._rayFromWorld;
  }
  /**
   * Gets the ray "end point" of the ray in the world
   */
  get rayToWorld() {
    return this._rayToWorld;
  }
  /**
   * Sets the distance from the start point to the hit point
   * @param distance defines the distance to set
   */
  setHitDistance(distance) {
    this._hitDistance = distance;
  }
  /**
   * Calculates the distance manually
   */
  calculateHitDistance() {
    this._hitDistance = Vector3.Distance(this._rayFromWorld, this._hitPoint);
  }
  /**
   * Resets all the values to default
   * @param from The from point on world space
   * @param to The to point on world space
   */
  reset(from = Vector3.Zero(), to = Vector3.Zero()) {
    super.reset();
    this._rayFromWorld.copyFrom(from);
    this._rayToWorld.copyFrom(to);
    this._hitDistance = 0;
  }
}
class PhysicsEngine2 {
  /**
   *
   * @returns physics plugin version
   */
  getPluginVersion() {
    return this._physicsPlugin.getPluginVersion();
  }
  // eslint-disable-next-line jsdoc/require-returns-check
  /**
   * Factory used to create the default physics plugin.
   * @returns The default physics plugin
   */
  static DefaultPluginFactory() {
    throw _WarnImport("");
  }
  /**
   * Creates a new Physics Engine
   * @param gravity defines the gravity vector used by the simulation
   * @param _physicsPlugin defines the plugin to use (CannonJS by default)
   */
  constructor(gravity, _physicsPlugin = PhysicsEngine2.DefaultPluginFactory()) {
    this._physicsPlugin = _physicsPlugin;
    this._physicsBodies = [];
    this._subTimeStep = 0;
    gravity = gravity || new Vector3(0, -9.807, 0);
    this.setGravity(gravity);
    this.setTimeStep();
  }
  /**
   * Sets the gravity vector used by the simulation
   * @param gravity defines the gravity vector to use
   */
  setGravity(gravity) {
    this.gravity = gravity;
    this._physicsPlugin.setGravity(this.gravity);
  }
  /**
   * Set the time step of the physics engine.
   * Default is 1/60.
   * To slow it down, enter 1/600 for example.
   * To speed it up, 1/30
   * Unit is seconds.
   * @param newTimeStep defines the new timestep to apply to this world.
   */
  setTimeStep(newTimeStep = 1 / 60) {
    this._physicsPlugin.setTimeStep(newTimeStep);
  }
  /**
   * Get the time step of the physics engine.
   * @returns the current time step
   */
  getTimeStep() {
    return this._physicsPlugin.getTimeStep();
  }
  /**
   * Set the sub time step of the physics engine.
   * Default is 0 meaning there is no sub steps
   * To increase physics resolution precision, set a small value (like 1 ms)
   * @param subTimeStep defines the new sub timestep used for physics resolution.
   */
  setSubTimeStep(subTimeStep = 0) {
    this._subTimeStep = subTimeStep;
  }
  /**
   * Get the sub time step of the physics engine.
   * @returns the current sub time step
   */
  getSubTimeStep() {
    return this._subTimeStep;
  }
  /**
   * Release all resources
   */
  dispose() {
    this._physicsPlugin.dispose();
  }
  /**
   * Gets the name of the current physics plugin
   * @returns the name of the plugin
   */
  getPhysicsPluginName() {
    return this._physicsPlugin.name;
  }
  /**
   * Set the maximum allowed linear and angular velocities
   * @param maxLinearVelocity maximum allowed linear velocity
   * @param maxAngularVelocity maximum allowed angular velocity
   */
  setVelocityLimits(maxLinearVelocity, maxAngularVelocity) {
    this._physicsPlugin.setVelocityLimits(maxLinearVelocity, maxAngularVelocity);
  }
  /**
   * @returns maximum allowed linear velocity
   */
  getMaxLinearVelocity() {
    return this._physicsPlugin.getMaxLinearVelocity();
  }
  /**
   * @returns maximum allowed angular velocity
   */
  getMaxAngularVelocity() {
    return this._physicsPlugin.getMaxAngularVelocity();
  }
  /**
   * Called by the scene. No need to call it.
   * @param delta defines the timespan between frames
   */
  _step(delta) {
    if (delta > 0.1) {
      delta = 0.1;
    } else if (delta <= 0) {
      delta = 1 / 60;
    }
    this._physicsPlugin.executeStep(delta, this._physicsBodies);
  }
  /**
   * Add a body as an active component of this engine
   * @param physicsBody The body to add
   */
  addBody(physicsBody) {
    this._physicsBodies.push(physicsBody);
  }
  /**
   * Removes a particular body from this engine
   * @param physicsBody The body to remove from the simulation
   */
  removeBody(physicsBody) {
    const index = this._physicsBodies.indexOf(physicsBody);
    if (index > -1) {
      this._physicsBodies.splice(index, 1);
    }
  }
  /**
   * @returns an array of bodies added to this engine
   */
  getBodies() {
    return this._physicsBodies;
  }
  /**
   * Gets the current plugin used to run the simulation
   * @returns current plugin
   */
  getPhysicsPlugin() {
    return this._physicsPlugin;
  }
  /**
   * Does a raycast in the physics world
   * @param from when should the ray start?
   * @param to when should the ray end?
   * @param result resulting PhysicsRaycastResult or array of PhysicsRaycastResults
   * @param query raycast query object
   * If result is an empty array, it will be populated with every detected raycast hit.
   * If result is a populated array, it will only fill the PhysicsRaycastResults present in the array.
   */
  raycastToRef(from, to, result, query) {
    this._physicsPlugin.raycast(from, to, result, query);
  }
  /**
   * Does a raycast in the physics world
   * @param from when should the ray start?
   * @param to when should the ray end?
   * @param query raycast query object
   * @returns PhysicsRaycastResult
   */
  raycast(from, to, query) {
    const result = new PhysicsRaycastResult();
    this._physicsPlugin.raycast(from, to, result, query);
    return result;
  }
  /**
   * Does a raycast through multiple objects in the physics world
   * @param from when should the ray start?
   * @param to when should the ray end?
   * @param query raycast query object
   * @returns array of PhysicsRaycastResult
   */
  raycastMulti(from, to, query) {
    const result = [];
    this._physicsPlugin.raycast(from, to, result, query);
    return result;
  }
}
class PhysicsEngineSceneComponent {
  /**
   * Creates a new instance of the component for the given scene
   * @param scene Defines the scene to register the component in
   */
  constructor(scene) {
    this.name = SceneComponentConstants.NAME_PHYSICSENGINE;
    this.scene = scene;
    this.scene.onBeforePhysicsObservable = new Observable();
    this.scene.onAfterPhysicsObservable = new Observable();
    this.scene.getDeterministicFrameTime = () => {
      if (this.scene._physicsEngine) {
        return this.scene._physicsEngine.getTimeStep() * 1e3;
      }
      return 1e3 / 60;
    };
  }
  /**
   * Registers the component in a given scene
   */
  register() {
  }
  /**
   * Rebuilds the elements related to this component in case of
   * context lost for instance.
   */
  rebuild() {
  }
  /**
   * Disposes the component and the associated resources
   */
  dispose() {
    this.scene.onBeforePhysicsObservable.clear();
    this.scene.onAfterPhysicsObservable.clear();
    if (this.scene._physicsEngine) {
      this.scene.disablePhysicsEngine();
    }
  }
}
let _Registered = false;
function RegisterJoinedPhysicsEngineComponent() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  Scene.prototype.getPhysicsEngine = function() {
    return this._physicsEngine ?? null;
  };
  Scene.prototype.enablePhysics = function(gravity = null, plugin) {
    if (this._physicsEngine) {
      return true;
    }
    let component = this._getComponent(SceneComponentConstants.NAME_PHYSICSENGINE);
    if (!component) {
      component = new PhysicsEngineSceneComponent(this);
      this._addComponent(component);
    }
    try {
      if (!plugin || plugin?.getPluginVersion() === 1) {
        this._physicsEngine = new PhysicsEngine$1(gravity, plugin);
      } else if (plugin?.getPluginVersion() === 2) {
        this._physicsEngine = new PhysicsEngine2(gravity, plugin);
      } else {
        throw new Error("Unsupported Physics plugin version.");
      }
      this._physicsTimeAccumulator = 0;
      return true;
    } catch (e) {
      Logger.Error(e.message);
      return false;
    }
  };
  Scene.prototype.disablePhysicsEngine = function() {
    if (!this._physicsEngine) {
      return;
    }
    this._physicsEngine.dispose();
    this._physicsEngine = null;
  };
  Scene.prototype.isPhysicsEnabled = function() {
    return !!this._physicsEngine;
  };
  Scene.prototype.deleteCompoundImpostor = function(compound) {
    const mesh = compound.parts[0].mesh;
    if (mesh.physicsImpostor) {
      mesh.physicsImpostor.dispose(
        /*true*/
      );
      mesh.physicsImpostor = null;
    }
  };
  Scene.prototype._advancePhysicsEngineStep = function(step) {
    if (this._physicsEngine) {
      const subTime = this._physicsEngine.getSubTimeStep();
      if (subTime > 0) {
        this._physicsTimeAccumulator += step;
        while (this._physicsTimeAccumulator > subTime) {
          this.onBeforePhysicsObservable.notifyObservers(this);
          this._physicsEngine._step(subTime / 1e3);
          this.onAfterPhysicsObservable.notifyObservers(this);
          this._physicsTimeAccumulator -= subTime;
        }
      } else {
        this.onBeforePhysicsObservable.notifyObservers(this);
        this._physicsEngine._step(step / 1e3);
        this.onAfterPhysicsObservable.notifyObservers(this);
      }
    }
  };
}
RegisterJoinedPhysicsEngineComponent();
var PhysicsConstraintAxisLimitMode;
(function(PhysicsConstraintAxisLimitMode2) {
  PhysicsConstraintAxisLimitMode2[PhysicsConstraintAxisLimitMode2["FREE"] = 0] = "FREE";
  PhysicsConstraintAxisLimitMode2[PhysicsConstraintAxisLimitMode2["LIMITED"] = 1] = "LIMITED";
  PhysicsConstraintAxisLimitMode2[PhysicsConstraintAxisLimitMode2["LOCKED"] = 2] = "LOCKED";
})(PhysicsConstraintAxisLimitMode || (PhysicsConstraintAxisLimitMode = {}));
var PhysicsConstraintAxis;
(function(PhysicsConstraintAxis2) {
  PhysicsConstraintAxis2[PhysicsConstraintAxis2["LINEAR_X"] = 0] = "LINEAR_X";
  PhysicsConstraintAxis2[PhysicsConstraintAxis2["LINEAR_Y"] = 1] = "LINEAR_Y";
  PhysicsConstraintAxis2[PhysicsConstraintAxis2["LINEAR_Z"] = 2] = "LINEAR_Z";
  PhysicsConstraintAxis2[PhysicsConstraintAxis2["ANGULAR_X"] = 3] = "ANGULAR_X";
  PhysicsConstraintAxis2[PhysicsConstraintAxis2["ANGULAR_Y"] = 4] = "ANGULAR_Y";
  PhysicsConstraintAxis2[PhysicsConstraintAxis2["ANGULAR_Z"] = 5] = "ANGULAR_Z";
  PhysicsConstraintAxis2[PhysicsConstraintAxis2["LINEAR_DISTANCE"] = 6] = "LINEAR_DISTANCE";
})(PhysicsConstraintAxis || (PhysicsConstraintAxis = {}));
var PhysicsConstraintType;
(function(PhysicsConstraintType2) {
  PhysicsConstraintType2[PhysicsConstraintType2["BALL_AND_SOCKET"] = 1] = "BALL_AND_SOCKET";
  PhysicsConstraintType2[PhysicsConstraintType2["DISTANCE"] = 2] = "DISTANCE";
  PhysicsConstraintType2[PhysicsConstraintType2["HINGE"] = 3] = "HINGE";
  PhysicsConstraintType2[PhysicsConstraintType2["SLIDER"] = 4] = "SLIDER";
  PhysicsConstraintType2[PhysicsConstraintType2["LOCK"] = 5] = "LOCK";
  PhysicsConstraintType2[PhysicsConstraintType2["PRISMATIC"] = 6] = "PRISMATIC";
  PhysicsConstraintType2[PhysicsConstraintType2["SIX_DOF"] = 7] = "SIX_DOF";
})(PhysicsConstraintType || (PhysicsConstraintType = {}));
var PhysicsShapeType;
(function(PhysicsShapeType2) {
  PhysicsShapeType2[PhysicsShapeType2["SPHERE"] = 0] = "SPHERE";
  PhysicsShapeType2[PhysicsShapeType2["CAPSULE"] = 1] = "CAPSULE";
  PhysicsShapeType2[PhysicsShapeType2["CYLINDER"] = 2] = "CYLINDER";
  PhysicsShapeType2[PhysicsShapeType2["BOX"] = 3] = "BOX";
  PhysicsShapeType2[PhysicsShapeType2["CONVEX_HULL"] = 4] = "CONVEX_HULL";
  PhysicsShapeType2[PhysicsShapeType2["CONTAINER"] = 5] = "CONTAINER";
  PhysicsShapeType2[PhysicsShapeType2["MESH"] = 6] = "MESH";
  PhysicsShapeType2[PhysicsShapeType2["HEIGHTFIELD"] = 7] = "HEIGHTFIELD";
})(PhysicsShapeType || (PhysicsShapeType = {}));
var PhysicsConstraintMotorType;
(function(PhysicsConstraintMotorType2) {
  PhysicsConstraintMotorType2[PhysicsConstraintMotorType2["NONE"] = 0] = "NONE";
  PhysicsConstraintMotorType2[PhysicsConstraintMotorType2["VELOCITY"] = 1] = "VELOCITY";
  PhysicsConstraintMotorType2[PhysicsConstraintMotorType2["POSITION"] = 2] = "POSITION";
})(PhysicsConstraintMotorType || (PhysicsConstraintMotorType = {}));
var PhysicsEventType;
(function(PhysicsEventType2) {
  PhysicsEventType2["COLLISION_STARTED"] = "COLLISION_STARTED";
  PhysicsEventType2["COLLISION_CONTINUED"] = "COLLISION_CONTINUED";
  PhysicsEventType2["COLLISION_FINISHED"] = "COLLISION_FINISHED";
  PhysicsEventType2["TRIGGER_ENTERED"] = "TRIGGER_ENTERED";
  PhysicsEventType2["TRIGGER_EXITED"] = "TRIGGER_EXITED";
})(PhysicsEventType || (PhysicsEventType = {}));
var PhysicsMotionType;
(function(PhysicsMotionType2) {
  PhysicsMotionType2[PhysicsMotionType2["STATIC"] = 0] = "STATIC";
  PhysicsMotionType2[PhysicsMotionType2["ANIMATED"] = 1] = "ANIMATED";
  PhysicsMotionType2[PhysicsMotionType2["DYNAMIC"] = 2] = "DYNAMIC";
})(PhysicsMotionType || (PhysicsMotionType = {}));
var PhysicsPrestepType;
(function(PhysicsPrestepType2) {
  PhysicsPrestepType2[PhysicsPrestepType2["DISABLED"] = 0] = "DISABLED";
  PhysicsPrestepType2[PhysicsPrestepType2["TELEPORT"] = 1] = "TELEPORT";
  PhysicsPrestepType2[PhysicsPrestepType2["ACTION"] = 2] = "ACTION";
})(PhysicsPrestepType || (PhysicsPrestepType = {}));
var PhysicsActivationControl;
(function(PhysicsActivationControl2) {
  PhysicsActivationControl2[PhysicsActivationControl2["SIMULATION_CONTROLLED"] = 0] = "SIMULATION_CONTROLLED";
  PhysicsActivationControl2[PhysicsActivationControl2["ALWAYS_ACTIVE"] = 1] = "ALWAYS_ACTIVE";
  PhysicsActivationControl2[PhysicsActivationControl2["ALWAYS_INACTIVE"] = 2] = "ALWAYS_INACTIVE";
})(PhysicsActivationControl || (PhysicsActivationControl = {}));
class PhysicsShape {
  /**
   * Constructs a new physics shape.
   * @param options The options for the physics shape. These are:
   *  * type: The type of the shape. This can be one of the following: SPHERE, BOX, CAPSULE, CYLINDER, CONVEX_HULL, MESH, HEIGHTFIELD, CONTAINER
   *  * parameters: The parameters of the shape.
   *  * pluginData: The plugin data of the shape. This is used if you already have a reference to the object on the plugin side.
   * You need to specify either type or pluginData.
   * @param scene The scene the shape belongs to.
   *
   * This code is useful for creating a new physics shape with the given type, options, and scene.
   * It also checks that the physics engine and plugin version are correct.
   * If not, it throws an error. This ensures that the shape is created with the correct parameters and is compatible with the physics engine.
   */
  constructor(options, scene) {
    this._pluginData = void 0;
    this._isTrigger = false;
    this._isDisposed = false;
    if (!scene) {
      return;
    }
    const physicsEngine = scene.getPhysicsEngine();
    if (!physicsEngine) {
      throw new Error("No Physics Engine available.");
    }
    if (physicsEngine.getPluginVersion() != 2) {
      throw new Error("Plugin version is incorrect. Expected version 2.");
    }
    const physicsPlugin = physicsEngine.getPhysicsPlugin();
    if (!physicsPlugin) {
      throw new Error("No Physics Plugin available.");
    }
    this._physicsPlugin = physicsPlugin;
    if (options.pluginData !== void 0 && options.pluginData !== null) {
      this._pluginData = options.pluginData;
      this._type = this._physicsPlugin.getShapeType(this);
    } else if (options.type !== void 0 && options.type !== null) {
      this._type = options.type;
      const parameters = options.parameters ?? {};
      this._physicsPlugin.initShape(this, options.type, parameters);
    }
  }
  /**
   * Returns the string "PhysicsShape".
   * @returns "PhysicsShape"
   */
  getClassName() {
    return "PhysicsShape";
  }
  /**
   * Returns the type of the physics shape.
   * @returns The type of the physics shape.
   */
  get type() {
    return this._type;
  }
  /**
   * Set the membership mask of a shape. This is a bitfield of arbitrary
   * "categories" to which the shape is a member. This is used in combination
   * with the collide mask to determine if this shape should collide with
   * another.
   *
   * @param membershipMask Bitfield of categories of this shape.
   */
  set filterMembershipMask(membershipMask) {
    this._physicsPlugin.setShapeFilterMembershipMask(this, membershipMask);
  }
  /**
   * Get the membership mask of a shape.
   * @returns Bitmask of categories which this shape is a member of.
   */
  get filterMembershipMask() {
    return this._physicsPlugin.getShapeFilterMembershipMask(this);
  }
  /**
   * Sets the collide mask of a shape. This is a bitfield of arbitrary
   * "categories" to which this shape collides with. Given two shapes,
   * the engine will check if the collide mask and membership overlap:
   * shapeA.filterMembershipMask & shapeB.filterCollideMask
   *
   * If this value is zero (i.e. shapeB only collides with categories
   * which shapeA is _not_ a member of) then the shapes will not collide.
   *
   * Note, the engine will also perform the same test with shapeA and
   * shapeB swapped; the shapes will not collide if either shape has
   * a collideMask which prevents collision with the other shape.
   *
   * @param collideMask Bitmask of categories this shape should collide with
   */
  set filterCollideMask(collideMask) {
    this._physicsPlugin.setShapeFilterCollideMask(this, collideMask);
  }
  /**
   *
   * @returns Bitmask of categories that this shape should collide with
   */
  get filterCollideMask() {
    return this._physicsPlugin.getShapeFilterCollideMask(this);
  }
  /**
   *
   * @param material
   */
  set material(material) {
    this._physicsPlugin.setMaterial(this, material);
    this._material = material;
  }
  /**
   * Returns the material of the physics shape.
   * @returns The material of the physics shape.
   */
  get material() {
    if (!this._material) {
      this._material = this._physicsPlugin.getMaterial(this);
    }
    return this._material;
  }
  /**
   * Sets the density of the physics shape.
   * @param density The density of the physics shape.
   */
  set density(density) {
    this._physicsPlugin.setDensity(this, density);
  }
  /**
   * Returns the density of the physics shape.
   * @returns The density of the physics shape.
   */
  get density() {
    return this._physicsPlugin.getDensity(this);
  }
  /**
   * Utility to add a child shape to this container,
   * automatically computing the relative transform between
   * the container shape and the child instance.
   *
   * @param parentTransform The transform node associated with this shape
   * @param newChild The new PhysicsShape to add
   * @param childTransform The transform node associated with the child shape
   */
  addChildFromParent(parentTransform, newChild, childTransform) {
    const childToWorld = childTransform.computeWorldMatrix(true);
    const parentToWorld = parentTransform.computeWorldMatrix(true);
    const childToParent = TmpVectors.Matrix[0];
    childToWorld.multiplyToRef(Matrix.Invert(parentToWorld), childToParent);
    const translation = TmpVectors.Vector3[0];
    const rotation = TmpVectors.Quaternion[0];
    const scale = TmpVectors.Vector3[1];
    childToParent.decompose(scale, rotation, translation);
    this._physicsPlugin.addChild(this, newChild, translation, rotation, scale);
  }
  /**
   * Adds a child shape to a container with an optional transform
   * @param newChild The new PhysicsShape to add
   * @param translation Optional position of the child shape relative to this shape
   * @param rotation Optional rotation of the child shape relative to this shape
   * @param scale Optional scale of the child shape relative to this shape
   */
  addChild(newChild, translation, rotation, scale) {
    this._physicsPlugin.addChild(this, newChild, translation, rotation, scale);
  }
  /**
   * Removes a child shape from this shape.
   * @param childIndex The index of the child shape to remove
   */
  removeChild(childIndex) {
    this._physicsPlugin.removeChild(this, childIndex);
  }
  /**
   * Returns the number of children of a physics shape.
   * @returns The number of children of a physics shape.
   */
  getNumChildren() {
    return this._physicsPlugin.getNumChildren(this);
  }
  /**
   * Returns the bounding box of the physics shape.
   * @returns The bounding box of the physics shape.
   */
  getBoundingBox() {
    return this._physicsPlugin.getBoundingBox(this);
  }
  set isTrigger(isTrigger) {
    if (this._isTrigger === isTrigger) {
      return;
    }
    this._isTrigger = isTrigger;
    this._physicsPlugin.setTrigger(this, isTrigger);
  }
  get isTrigger() {
    return this._isTrigger;
  }
  /**
   * Dispose the shape and release its associated resources.
   */
  dispose() {
    if (this._isDisposed) {
      return;
    }
    this._physicsPlugin.disposeShape(this);
    this._isDisposed = true;
  }
}
class MeshAccumulator {
  /**
   * Constructor of the mesh accumulator
   * @param mesh - The mesh used to compute the world matrix.
   * @param collectIndices - use mesh indices
   * @param scene - The scene used to determine the right handed system.
   *
   * Merge mesh and its children so whole hierarchy can be used as a mesh shape or convex hull
   */
  constructor(mesh, collectIndices, scene) {
    this._vertices = [];
    this._indices = [];
    this._isRightHanded = scene.useRightHandedSystem;
    this._collectIndices = collectIndices;
  }
  /**
   * Adds a mesh to the physics engine.
   * @param mesh The mesh to add.
   * @param includeChildren Whether to include the children of the mesh.
   *
   * This method adds a mesh to the physics engine by computing the world matrix,
   * multiplying it with the body from world matrix, and then transforming the
   * coordinates of the mesh's vertices. It also adds the indices of the mesh
   * to the physics engine. If includeChildren is true, it will also add the
   * children of the mesh to the physics engine, ignoring any children which
   * have a physics impostor. This is useful for creating a physics engine
   * that accurately reflects the mesh and its children.
   */
  addNodeMeshes(mesh, includeChildren) {
    mesh.computeWorldMatrix(true);
    const rootScaled = TmpVectors.Matrix[0];
    Matrix.ScalingToRef(mesh.absoluteScaling.x, mesh.absoluteScaling.y, mesh.absoluteScaling.z, rootScaled);
    if (mesh instanceof Mesh) {
      this._addMesh(mesh, rootScaled);
    } else if (mesh instanceof InstancedMesh) {
      this._addMesh(mesh.sourceMesh, rootScaled);
    }
    if (includeChildren) {
      const worldToRoot = TmpVectors.Matrix[1];
      mesh.computeWorldMatrix().invertToRef(worldToRoot);
      const worldToRootScaled = TmpVectors.Matrix[2];
      worldToRoot.multiplyToRef(rootScaled, worldToRootScaled);
      const children = mesh.getChildMeshes(false);
      const transformNodes = children.filter((m) => !m.physicsBody);
      for (const m of transformNodes) {
        const childToWorld = m.computeWorldMatrix();
        const childToRootScaled = TmpVectors.Matrix[3];
        childToWorld.multiplyToRef(worldToRootScaled, childToRootScaled);
        if (m instanceof Mesh) {
          this._addMesh(m, childToRootScaled);
        } else if (m instanceof InstancedMesh) {
          this._addMesh(m.sourceMesh, childToRootScaled);
        }
      }
    }
  }
  _addMesh(mesh, meshToRoot) {
    const vertexData = mesh.getVerticesData(VertexBuffer.PositionKind) || [];
    const numVerts = vertexData.length / 3;
    const indexOffset = this._vertices.length;
    for (let v = 0; v < numVerts; v++) {
      const pos = new Vector3(vertexData[v * 3 + 0], vertexData[v * 3 + 1], vertexData[v * 3 + 2]);
      this._vertices.push(Vector3.TransformCoordinates(pos, meshToRoot));
    }
    if (this._collectIndices) {
      const meshIndices = mesh.getIndices();
      if (meshIndices) {
        for (let i = 0; i < meshIndices.length; i += 3) {
          if (this._isRightHanded) {
            this._indices.push(meshIndices[i + 0] + indexOffset);
            this._indices.push(meshIndices[i + 1] + indexOffset);
            this._indices.push(meshIndices[i + 2] + indexOffset);
          } else {
            this._indices.push(meshIndices[i + 2] + indexOffset);
            this._indices.push(meshIndices[i + 1] + indexOffset);
            this._indices.push(meshIndices[i + 0] + indexOffset);
          }
        }
      }
    }
  }
  /**
   * Allocate and populate the vertex positions inside the physics plugin.
   *
   * @param plugin - The plugin to allocate the memory in.
   * @returns An array of floats, whose backing memory is inside the plugin. The array contains the
   * positions of the mesh vertices, where a position is defined by three floats. You must call
   * freeBuffer() on the returned array once you have finished with it, in order to free the
   * memory inside the plugin..
   */
  getVertices(plugin) {
    const nFloats = this._vertices.length * 3;
    const bytesPerFloat = 4;
    const nBytes = nFloats * bytesPerFloat;
    const bufferBegin = plugin._malloc(nBytes);
    const ret = new Float32Array(plugin.HEAPU8.buffer, bufferBegin, nFloats);
    for (let i = 0; i < this._vertices.length; i++) {
      ret[i * 3 + 0] = this._vertices[i].x;
      ret[i * 3 + 1] = this._vertices[i].y;
      ret[i * 3 + 2] = this._vertices[i].z;
    }
    return { offset: bufferBegin, numObjects: nFloats };
  }
  /**
   * Releases a buffer allocated in the physics plugin.
   * @param plugin - The plugin that owns the allocation.
   * @param arr - The plugin memory reference to release.
   */
  freeBuffer(plugin, arr) {
    plugin._free(arr.offset);
  }
  /**
   * Allocate and populate the triangle indices inside the physics plugin
   *
   * @param plugin - The plugin to allocate the memory in.
   * @returns A new Int32Array, whose backing memory is inside the plugin. The array contains the indices
   * of the triangle positions, where a single triangle is defined by three indices. You must call
   * freeBuffer() on this array once you have finished with it, to free the memory inside the plugin..
   */
  getTriangles(plugin) {
    const bytesPerInt = 4;
    const nBytes = this._indices.length * bytesPerInt;
    const bufferBegin = plugin._malloc(nBytes);
    const ret = new Int32Array(plugin.HEAPU8.buffer, bufferBegin, this._indices.length);
    for (let i = 0; i < this._indices.length; i++) {
      ret[i] = this._indices[i];
    }
    return { offset: bufferBegin, numObjects: this._indices.length };
  }
}
class BodyPluginData {
  constructor(bodyId) {
    this.hpBodyId = bodyId;
    this.userMassProps = { centerOfMass: void 0, mass: void 0, inertia: void 0, inertiaOrientation: void 0 };
  }
}
class CollisionContactPoint {
  constructor() {
    this.bodyId = BigInt(0);
    this.position = new Vector3();
    this.normal = new Vector3();
  }
}
class CollisionEvent {
  constructor() {
    this.contactOnA = new CollisionContactPoint();
    this.contactOnB = new CollisionContactPoint();
    this.impulseApplied = 0;
    this.type = 0;
  }
  /**
   * Reads a collision event from Havok memory into an existing event object.
   * @param buffer - The Havok memory buffer to read from.
   * @param offset - The byte offset of the event data.
   * @param eventOut - The collision event object to update.
   */
  static readToRef(buffer, offset, eventOut) {
    const intBuf = new Int32Array(buffer, offset);
    const floatBuf = new Float32Array(buffer, offset);
    const offA = 2;
    eventOut.contactOnA.bodyId = BigInt(intBuf[offA]);
    eventOut.contactOnA.position.set(floatBuf[offA + 8], floatBuf[offA + 9], floatBuf[offA + 10]);
    eventOut.contactOnA.normal.set(floatBuf[offA + 11], floatBuf[offA + 12], floatBuf[offA + 13]);
    const offB = 18;
    eventOut.contactOnB.bodyId = BigInt(intBuf[offB]);
    eventOut.contactOnB.position.set(floatBuf[offB + 8], floatBuf[offB + 9], floatBuf[offB + 10]);
    eventOut.contactOnB.normal.set(floatBuf[offB + 11], floatBuf[offB + 12], floatBuf[offB + 13]);
    eventOut.impulseApplied = floatBuf[offB + 13 + 3];
    eventOut.type = intBuf[0];
  }
}
class TriggerEvent {
  constructor() {
    this.bodyIdA = BigInt(0);
    this.bodyIdB = BigInt(0);
    this.type = 0;
  }
  /**
   * Reads a trigger event from Havok memory into an existing event object.
   * @param buffer - The Havok memory buffer to read from.
   * @param offset - The byte offset of the event data.
   * @param eventOut - The trigger event object to update.
   */
  static readToRef(buffer, offset, eventOut) {
    const intBuf = new Int32Array(buffer, offset);
    eventOut.type = intBuf[0];
    eventOut.bodyIdA = BigInt(intBuf[2]);
    eventOut.bodyIdB = BigInt(intBuf[6]);
  }
}
class HavokPlugin {
  /**
   * Whether floating origin world regions are enabled for the current scene.
   * @returns true when the scene uses floating origin mode and world regions are not disabled
   */
  _areFloatingOriginWorldRegionsEnabled() {
    return !this._disableWorldRegions && !!FloatingOriginCurrentScene.getScene()?.floatingOriginMode;
  }
  /**
   * Finds an existing world region that contains the given world position,
   * or creates a new world region centered at that position.
   *
   * When floatingOriginMode is enabled, we use multiple Havok worlds to maintain
   * float32 precision across a large world. Each world region has its own fixed
   * floating origin, and bodies within that region are simulated relative to it.
   *
   * @param worldPosition - The world position of the body being created
   * @returns The world region to use for this body
   */
  _getOrCreateWorldRegion(worldPosition) {
    if (!this._areFloatingOriginWorldRegionsEnabled()) {
      return this._worldRegions[0];
    }
    for (const region of this._worldRegions) {
      const distance = Vector3.Distance(worldPosition, region.floatingOrigin);
      if (distance <= this._floatingOriginWorldRadius) {
        return region;
      }
    }
    const newWorld = this._hknp.HP_World_Create()[1];
    this._hknp.HP_World_SetGravity(newWorld, this._currentGravity);
    this._hknp.HP_World_SetSpeedLimit(newWorld, this.getMaxLinearVelocity(), this.getMaxAngularVelocity());
    const newRegion = {
      world: newWorld,
      floatingOrigin: worldPosition.clone(),
      gravity: [...this._currentGravity]
    };
    this._worldRegions.push(newRegion);
    return newRegion;
  }
  /**
   * Checks if a body's world position has left its current region and, if so,
   * moves it to the correct region (existing or newly created).
   * This preserves linear and angular velocity across the transition.
   *
   * @param pluginData - The plugin data for the body (or instance) to check
   */
  _reRegionBodyPluginData(pluginData) {
    const currentRegion = pluginData.worldRegion;
    if (!currentRegion) {
      return;
    }
    const bodyTransform = this._hknp.HP_Body_GetQTransform(pluginData.hpBodyId)[1];
    const localPos = bodyTransform[0];
    const orientation = bodyTransform[1];
    const worldPos = TmpVectors.Vector3[2];
    worldPos.set(localPos[0] + currentRegion.floatingOrigin._x, localPos[1] + currentRegion.floatingOrigin._y, localPos[2] + currentRegion.floatingOrigin._z);
    const distToCurrent = Vector3.Distance(worldPos, currentRegion.floatingOrigin);
    if (distToCurrent <= this._floatingOriginWorldRadius * 1.2) {
      return;
    }
    const linVel = this._hknp.HP_Body_GetLinearVelocity(pluginData.hpBodyId)[1];
    const angVel = this._hknp.HP_Body_GetAngularVelocity(pluginData.hpBodyId)[1];
    const lookAheadPos = TmpVectors.Vector3[3];
    lookAheadPos.set(worldPos._x + linVel[0], worldPos._y + linVel[1], worldPos._z + linVel[2]);
    let newRegion = this._findExistingRegion(lookAheadPos);
    if (!newRegion || newRegion === currentRegion) {
      newRegion = this._findExistingRegion(worldPos);
    }
    if (!newRegion || newRegion === currentRegion) {
      newRegion = this._getOrCreateWorldRegion(worldPos);
    }
    if (newRegion === currentRegion) {
      return;
    }
    this._hknp.HP_World_RemoveBody(currentRegion.world, pluginData.hpBodyId);
    const newOffset = newRegion.floatingOrigin;
    const newLocalPos = [worldPos._x - newOffset._x, worldPos._y - newOffset._y, worldPos._z - newOffset._z];
    this._hknp.HP_Body_SetQTransform(pluginData.hpBodyId, [newLocalPos, orientation]);
    this._hknp.HP_World_AddBody(newRegion.world, pluginData.hpBodyId, false);
    this._hknp.HP_Body_SetLinearVelocity(pluginData.hpBodyId, linVel);
    this._hknp.HP_Body_SetAngularVelocity(pluginData.hpBodyId, angVel);
    pluginData.worldRegion = newRegion;
    pluginData.worldTransformOffset = this._hknp.HP_Body_GetWorldTransformOffset(pluginData.hpBodyId)[1];
    this._releaseWorldRegionIfEmpty(currentRegion);
  }
  /**
   * Searches existing world regions for one that contains the given position.
   * @param worldPosition - The world position to find a region for
   * @returns null if no existing region contains it (does NOT create a new one).
   */
  _findExistingRegion(worldPosition) {
    if (!this._areFloatingOriginWorldRegionsEnabled()) {
      return this._worldRegions[0];
    }
    for (const region of this._worldRegions) {
      const distance = Vector3.Distance(worldPosition, region.floatingOrigin);
      if (distance <= this._floatingOriginWorldRadius) {
        return region;
      }
    }
    return null;
  }
  /**
   * Releases a non-default world region when it no longer contains any bodies.
   * @param worldRegion - The world region to release if empty
   */
  _releaseWorldRegionIfEmpty(worldRegion) {
    const regionIndex = this._worldRegions.indexOf(worldRegion);
    if (regionIndex <= 0 || this._hknp.HP_World_GetNumBodies(worldRegion.world)[1] !== 0) {
      return;
    }
    this._hknp.HP_World_Release(worldRegion.world);
    this._worldRegions.splice(regionIndex, 1);
  }
  /**
   * Releases world regions that became candidates for removal while bodies were being removed.
   * This must run after collision and trigger notifications to avoid releasing a world while its native events are being read.
   */
  _releasePendingWorldRegions() {
    for (const worldRegion of this._worldRegionsPendingRelease) {
      this._releaseWorldRegionIfEmpty(worldRegion);
    }
    this._worldRegionsPendingRelease.clear();
  }
  constructor(_useDeltaForWorldStep = true, hpInjection = HK, parameters = {}) {
    this._useDeltaForWorldStep = _useDeltaForWorldStep;
    this._hknp = {};
    this.name = "HavokPlugin";
    this._multiQueryCollector = void 0;
    this._fixedTimeStep = 1 / 60;
    this._maxQueryCollectorHits = 1;
    this._tmpVec3 = BuildArray(3, Vector3.Zero);
    this._bodies = /* @__PURE__ */ new Map();
    this._shapes = /* @__PURE__ */ new Map();
    this._bodyCollisionObservable = /* @__PURE__ */ new Map();
    this._constraintToBodyIdPair = /* @__PURE__ */ new Map();
    this._bodyCollisionEndedObservable = /* @__PURE__ */ new Map();
    this._worldRegions = [];
    this._worldRegionsPendingRelease = /* @__PURE__ */ new Set();
    this._currentGravity = [0, -9.81, 0];
    this._floatingOriginWorldRadius = 1e5;
    this._disableWorldRegions = false;
    this.onCollisionObservable = new Observable();
    this.onCollisionEndedObservable = new Observable();
    this.onTriggerCollisionObservable = new Observable();
    if (typeof hpInjection === "function") {
      Logger.Error("Havok is not ready. Please make sure you await HK() before using the plugin.");
      return;
    } else {
      this._hknp = hpInjection;
    }
    if (!this.isSupported()) {
      Logger.Error("Havok is not available. Please make sure you included the js file.");
      return;
    }
    this.world = this._hknp.HP_World_Create()[1];
    this._worldRegions.push({
      world: this.world,
      floatingOrigin: Vector3.Zero(),
      gravity: [...this._currentGravity]
    });
    this._queryCollector = this._hknp.HP_QueryCollector_Create(1)[1];
    this.setMaxQueryCollectorHits(parameters.maxQueryCollectorHits ?? 1);
    this._disableWorldRegions = parameters.disableWorldRegions ?? false;
    this._floatingOriginWorldRadius = parameters.floatingOriginWorldRadius ?? 1e5;
  }
  /**
   * If this plugin is supported
   * @returns true if its supported
   */
  isSupported() {
    return this._hknp !== void 0;
  }
  /**
   * Sets the gravity of the physics world.
   *
   * @param gravity - The gravity vector to set.
   * @param worldPosition - Optional world position to specify which region's gravity to set.
   *                        If provided, only the region containing this position will be updated.
   *                        If not provided, all regions will be updated (default behavior).
   *                        This is useful for planetary scenarios where gravity direction varies by location.
   */
  setGravity(gravity, worldPosition) {
    const gravityArray = this._bVecToV3(gravity);
    if (worldPosition) {
      const region = this._getOrCreateWorldRegion(worldPosition);
      region.gravity = gravityArray;
      this._hknp.HP_World_SetGravity(region.world, gravityArray);
    } else {
      this._currentGravity = gravityArray;
      for (const region of this._worldRegions) {
        region.gravity = gravityArray;
        this._hknp.HP_World_SetGravity(region.world, gravityArray);
      }
    }
  }
  /**
   * Gets the gravity of the physics world or a specific region.
   *
   * @param worldPosition - Optional world position to get the gravity for that region.
   *                        If not provided, returns the default gravity.
   * @returns The gravity vector.
   */
  getGravity(worldPosition) {
    if (worldPosition) {
      const region = this._getOrCreateWorldRegion(worldPosition);
      return new Vector3(region.gravity[0], region.gravity[1], region.gravity[2]);
    }
    return new Vector3(this._currentGravity[0], this._currentGravity[1], this._currentGravity[2]);
  }
  /**
   * Sets the fixed time step for the physics engine.
   *
   * @param timeStep - The fixed time step to use for the physics engine.
   *
   */
  setTimeStep(timeStep) {
    this._fixedTimeStep = timeStep;
  }
  /**
   * Gets the fixed time step used by the physics engine.
   *
   * @returns The fixed time step used by the physics engine.
   *
   */
  getTimeStep() {
    return this._fixedTimeStep;
  }
  /**
   * Sets the maximum number of raycast hits to process.
   *
   * @param maxQueryCollectorHits - The maximum number of raycast hits to process.
   */
  setMaxQueryCollectorHits(maxQueryCollectorHits) {
    if (maxQueryCollectorHits === this._maxQueryCollectorHits) {
      return;
    }
    if (this._multiQueryCollector) {
      this._hknp.HP_QueryCollector_Release(this._multiQueryCollector);
      this._multiQueryCollector = void 0;
    }
    if (maxQueryCollectorHits > 1) {
      this._multiQueryCollector = this._hknp.HP_QueryCollector_Create(maxQueryCollectorHits)[1];
    }
  }
  /**
   * Gets the maximum number of raycast hits to process.
   *
   * @returns The maximum number of raycast hits to process.
   */
  getMaxQueryCollectorHits() {
    return this._maxQueryCollectorHits;
  }
  /**
   * Executes a single step of the physics engine.
   *
   * @param delta The time delta in seconds since the last step.
   * @param physicsBodies An array of physics bodies to be simulated.
   *
   * This method is useful for simulating the physics engine. It sets the physics body transformation,
   * steps the world, syncs the physics body, and notifies collisions. This allows for the physics engine
   * to accurately simulate the physics bodies in the world.
   */
  executeStep(delta, physicsBodies) {
    if (this._areFloatingOriginWorldRegionsEnabled()) {
      for (const physicsBody of physicsBodies) {
        if (physicsBody._pluginDataInstances.length > 0) {
          for (const instance of physicsBody._pluginDataInstances) {
            this._reRegionBodyPluginData(instance);
          }
        } else if (physicsBody._pluginData) {
          this._reRegionBodyPluginData(physicsBody._pluginData);
        }
      }
    }
    for (const physicsBody of physicsBodies) {
      if (physicsBody.disablePreStep) {
        continue;
      }
      this.setPhysicsBodyTransformation(physicsBody, physicsBody.transformNode);
    }
    const deltaTime = this._useDeltaForWorldStep ? delta : this._fixedTimeStep;
    for (const region of this._worldRegions) {
      this._hknp.HP_World_SetIdealStepTime(region.world, deltaTime);
      this._hknp.HP_World_Step(region.world, deltaTime);
    }
    for (const physicsBody of physicsBodies) {
      if (!physicsBody.disableSync) {
        this.sync(physicsBody);
      }
    }
    for (const region of this._worldRegions) {
      this._notifyCollisions(region.world);
      this._notifyTriggers(region.world);
    }
    this._releasePendingWorldRegions();
  }
  /**
   * Returns the version of the physics engine plugin.
   *
   * @returns The version of the physics engine plugin.
   *
   * This method is useful for determining the version of the physics engine plugin that is currently running.
   */
  getPluginVersion() {
    return 2;
  }
  /**
   * Set the maximum allowed linear and angular velocities
   * @param maxLinearVelocity maximum allowed linear velocity
   * @param maxAngularVelocity maximum allowed angular velocity
   */
  setVelocityLimits(maxLinearVelocity, maxAngularVelocity) {
    for (const region of this._worldRegions) {
      this._hknp.HP_World_SetSpeedLimit(region.world, maxLinearVelocity, maxAngularVelocity);
    }
  }
  /**
   * @returns maximum allowed linear velocity
   */
  getMaxLinearVelocity() {
    const limits = this._hknp.HP_World_GetSpeedLimit(this.world);
    return limits[1];
  }
  /**
   * @returns maximum allowed angular velocity
   */
  getMaxAngularVelocity() {
    const limits = this._hknp.HP_World_GetSpeedLimit(this.world);
    return limits[2];
  }
  /**
   * Initializes a physics body with the given position and orientation.
   *
   * @param body - The physics body to initialize.
   * @param motionType - The motion type of the body.
   * @param position - The position of the body.
   * @param orientation - The orientation of the body.
   * This code is useful for initializing a physics body with the given position and orientation.
   * It creates a plugin data for the body and adds it to the world. It then converts the position
   * and orientation to a transform and sets the body's transform to the given values.
   */
  initBody(body, motionType, position, orientation) {
    body._pluginData = new BodyPluginData(this._hknp.HP_Body_Create()[1]);
    this._internalSetMotionType(body._pluginData, motionType);
    const worldRegion = this._getOrCreateWorldRegion(position);
    body._pluginData.worldRegion = worldRegion;
    const offset = worldRegion.floatingOrigin;
    const transform = [[position._x - offset._x, position._y - offset._y, position._z - offset._z], this._bQuatToV4(orientation)];
    this._hknp.HP_Body_SetQTransform(body._pluginData.hpBodyId, transform);
    this._hknp.HP_World_AddBody(worldRegion.world, body._pluginData.hpBodyId, body.startAsleep);
    this._bodies.set(body._pluginData.hpBodyId[0], { body, index: 0 });
  }
  /**
   * Removes a body from the world. To dispose of a body, it is necessary to remove it from the world first.
   *
   * @param body - The body to remove.
   */
  removeBody(body) {
    if (body._pluginDataInstances && body._pluginDataInstances.length > 0) {
      for (const instance of body._pluginDataInstances) {
        this._bodyCollisionObservable.delete(instance.hpBodyId[0]);
        this._hknp.HP_World_RemoveBody(instance.worldRegion.world, instance.hpBodyId);
        this._bodies.delete(instance.hpBodyId[0]);
        this._worldRegionsPendingRelease.add(instance.worldRegion);
      }
    }
    if (body._pluginData) {
      this._bodyCollisionObservable.delete(body._pluginData.hpBodyId[0]);
      this._hknp.HP_World_RemoveBody(body._pluginData.worldRegion.world, body._pluginData.hpBodyId);
      this._bodies.delete(body._pluginData.hpBodyId[0]);
      this._worldRegionsPendingRelease.add(body._pluginData.worldRegion);
    }
  }
  /**
   * Initializes the body instances for a given physics body and mesh.
   *
   * @param body - The physics body to initialize.
   * @param motionType - How the body will be handled by the engine
   * @param mesh - The mesh to initialize.
   *
   * This code is useful for creating a physics body from a mesh. It creates a
   * body instance for each instance of the mesh and adds it to the world. It also
   * sets the position of the body instance to the position of the mesh instance.
   * This allows for the physics engine to accurately simulate the mesh in the
   * world.
   */
  initBodyInstances(body, motionType, mesh) {
    const instancesCount = mesh._thinInstanceDataStorage?.instancesCount ?? 0;
    const matrixData = mesh._thinInstanceDataStorage.matrixData;
    if (!matrixData) {
      return;
    }
    this._createOrUpdateBodyInstances(body, motionType, matrixData, 0, instancesCount, false);
    for (let index = 0; index < body._pluginDataInstances.length; index++) {
      const bodyId = body._pluginDataInstances[index];
      this._bodies.set(bodyId.hpBodyId[0], { body, index });
    }
  }
  _createOrUpdateBodyInstances(body, motionType, matrixData, startIndex, endIndex, update) {
    const rotation = TmpVectors.Quaternion[0];
    const rotationMatrix = Matrix.Identity();
    const worldPos = TmpVectors.Vector3[0];
    for (let i = startIndex; i < endIndex; i++) {
      worldPos.set(matrixData[i * 16 + 12], matrixData[i * 16 + 13], matrixData[i * 16 + 14]);
      let hkbody;
      let pluginData;
      if (!update) {
        hkbody = this._hknp.HP_Body_Create()[1];
        pluginData = new BodyPluginData(hkbody);
        if (body._pluginDataInstances.length) {
          pluginData.userMassProps = body._pluginDataInstances[0].userMassProps;
        }
      } else {
        pluginData = body._pluginDataInstances[i];
        hkbody = pluginData.hpBodyId;
      }
      const worldRegion = this._getOrCreateWorldRegion(worldPos);
      const offset = worldRegion.floatingOrigin;
      const position = [worldPos._x - offset._x, worldPos._y - offset._y, worldPos._z - offset._z];
      rotationMatrix.setRowFromFloats(0, matrixData[i * 16 + 0], matrixData[i * 16 + 1], matrixData[i * 16 + 2], 0);
      rotationMatrix.setRowFromFloats(1, matrixData[i * 16 + 4], matrixData[i * 16 + 5], matrixData[i * 16 + 6], 0);
      rotationMatrix.setRowFromFloats(2, matrixData[i * 16 + 8], matrixData[i * 16 + 9], matrixData[i * 16 + 10], 0);
      Quaternion.FromRotationMatrixToRef(rotationMatrix, rotation);
      const transform = [position, [rotation.x, rotation.y, rotation.z, rotation.w]];
      this._hknp.HP_Body_SetQTransform(hkbody, transform);
      if (!update) {
        this._internalSetMotionType(pluginData, motionType);
        this._internalUpdateMassProperties(pluginData);
        body._pluginDataInstances.push(pluginData);
        pluginData.worldRegion = worldRegion;
        this._hknp.HP_World_AddBody(worldRegion.world, hkbody, body.startAsleep);
        pluginData.worldTransformOffset = this._hknp.HP_Body_GetWorldTransformOffset(hkbody)[1];
      }
    }
  }
  /**
   * Update the internal body instances for a given physics body to match the instances in a mesh.
   * @param body the body that will be updated
   * @param mesh the mesh with reference instances
   */
  updateBodyInstances(body, mesh) {
    const instancesCount = mesh._thinInstanceDataStorage?.instancesCount ?? 0;
    const matrixData = mesh._thinInstanceDataStorage.matrixData;
    if (!matrixData) {
      return;
    }
    const pluginInstancesCount = body._pluginDataInstances.length;
    const motionType = this.getMotionType(body);
    if (instancesCount > pluginInstancesCount) {
      this._createOrUpdateBodyInstances(body, motionType, matrixData, pluginInstancesCount, instancesCount, false);
      const firstBodyShape = this._hknp.HP_Body_GetShape(body._pluginDataInstances[0].hpBodyId)[1];
      if (!firstBodyShape[0]) {
        firstBodyShape[0] = body.shape?._pluginData[0];
      }
      for (let i = pluginInstancesCount; i < instancesCount; i++) {
        this._hknp.HP_Body_SetShape(body._pluginDataInstances[i].hpBodyId, firstBodyShape);
        this._internalUpdateMassProperties(body._pluginDataInstances[i]);
        this._bodies.set(body._pluginDataInstances[i].hpBodyId[0], { body, index: i });
      }
    } else if (instancesCount < pluginInstancesCount) {
      const instancesToRemove = pluginInstancesCount - instancesCount;
      for (let i = 0; i < instancesToRemove; i++) {
        const hkbody = body._pluginDataInstances.pop();
        this._bodies.delete(hkbody.hpBodyId[0]);
        this._hknp.HP_World_RemoveBody(hkbody.worldRegion.world, hkbody.hpBodyId);
        this._worldRegionsPendingRelease.add(hkbody.worldRegion);
        this._hknp.HP_Body_Release(hkbody.hpBodyId);
      }
      this._createOrUpdateBodyInstances(body, motionType, matrixData, 0, instancesCount, true);
    }
  }
  /**
   * Synchronizes the transform of a physics body with its transform node.
   * @param body - The physics body to synchronize.
   *
   * This function is useful for keeping the physics body's transform in sync with its transform node.
   * This is important for ensuring that the physics body is accurately represented in the physics engine.
   */
  sync(body) {
    this.syncTransform(body, body.transformNode);
  }
  /**
   * Synchronizes the transform of a physics body with the transform of its
   * corresponding transform node.
   *
   * @param body - The physics body to synchronize.
   * @param transformNode - The destination Transform Node.
   *
   * This code is useful for synchronizing the position and orientation of a
   * physics body with the position and orientation of its corresponding
   * transform node. This is important for ensuring that the physics body and
   * the transform node are in the same position and orientation in the scene.
   * This is necessary for the physics engine to accurately simulate the
   * physical behavior of the body.
   */
  syncTransform(body, transformNode) {
    if (body._pluginDataInstances.length) {
      const m = transformNode;
      const matrixData = m._thinInstanceDataStorage.matrixData;
      if (!matrixData) {
        return;
      }
      const instancesCount = body._pluginDataInstances.length;
      for (let i = 0; i < instancesCount; i++) {
        const pluginData = body._pluginDataInstances[i];
        const instanceOffset = pluginData.worldRegion.floatingOrigin;
        const bodyBuffer = this._hknp.HP_World_GetBodyBuffer(pluginData.worldRegion.world)[1];
        const bufOffset = pluginData.worldTransformOffset;
        const transformBuffer = new Float32Array(this._hknp.HEAPU8.buffer, bodyBuffer + bufOffset, 16);
        const index = i * 16;
        for (let mi = 0; mi < 15; mi++) {
          if ((mi & 3) != 3) {
            matrixData[index + mi] = transformBuffer[mi];
          }
        }
        matrixData[index + 12] += instanceOffset._x;
        matrixData[index + 13] += instanceOffset._y;
        matrixData[index + 14] += instanceOffset._z;
        matrixData[index + 15] = 1;
      }
      m.thinInstanceBufferUpdated("matrix");
    } else {
      try {
        const bodyTransform = this._hknp.HP_Body_GetQTransform(body._pluginData.hpBodyId)[1];
        const bodyTranslation = bodyTransform[0];
        const bodyOrientation = bodyTransform[1];
        const quat = TmpVectors.Quaternion[0];
        const offset = body._pluginData.worldRegion.floatingOrigin;
        quat.set(bodyOrientation[0], bodyOrientation[1], bodyOrientation[2], bodyOrientation[3]);
        const worldX = bodyTranslation[0] + offset._x;
        const worldY = bodyTranslation[1] + offset._y;
        const worldZ = bodyTranslation[2] + offset._z;
        const parent = transformNode.parent;
        if (parent && !parent.getWorldMatrix().isIdentity()) {
          parent.computeWorldMatrix(true);
          TmpVectors.Vector3[1].copyFrom(transformNode.scaling);
          quat.normalize();
          const finalTransform = TmpVectors.Matrix[0];
          const finalTranslation = TmpVectors.Vector3[0];
          finalTranslation.copyFromFloats(worldX, worldY, worldZ);
          Matrix.ComposeToRef(transformNode.absoluteScaling, quat, finalTranslation, finalTransform);
          const parentInverseTransform = TmpVectors.Matrix[1];
          parent.getWorldMatrix().invertToRef(parentInverseTransform);
          const localTransform = TmpVectors.Matrix[2];
          finalTransform.multiplyToRef(parentInverseTransform, localTransform);
          localTransform.decomposeToTransformNode(transformNode);
          transformNode.rotationQuaternion?.normalize();
          transformNode.scaling.copyFrom(TmpVectors.Vector3[1]);
        } else {
          transformNode.position.set(worldX, worldY, worldZ);
          if (transformNode.rotationQuaternion) {
            transformNode.rotationQuaternion.copyFrom(quat);
          } else {
            quat.toEulerAnglesToRef(transformNode.rotation);
          }
        }
      } catch (e) {
        Logger.Error(`Syncing transform failed for node ${transformNode.name}: ${e.message}...`);
      }
    }
  }
  /**
   * Sets the shape of a physics body.
   * @param body - The physics body to set the shape for.
   * @param shape - The physics shape to set.
   *
   * This function is used to set the shape of a physics body. It is useful for
   * creating a physics body with a specific shape, such as a box or a sphere,
   * which can then be used to simulate physical interactions in a physics engine.
   * This function is especially useful for meshes with multiple instances, as it
   * will set the shape for each instance of the mesh.
   */
  setShape(body, shape) {
    const shapeHandle = shape && shape._pluginData ? shape._pluginData : BigInt(0);
    if (!(body.transformNode instanceof Mesh) || !body.transformNode._thinInstanceDataStorage?.matrixData) {
      this._hknp.HP_Body_SetShape(body._pluginData.hpBodyId, shapeHandle);
      this._internalUpdateMassProperties(body._pluginData);
      return;
    }
    const m = body.transformNode;
    const instancesCount = m._thinInstanceDataStorage?.instancesCount ?? 0;
    for (let i = 0; i < instancesCount; i++) {
      this._hknp.HP_Body_SetShape(body._pluginDataInstances[i].hpBodyId, shapeHandle);
      this._internalUpdateMassProperties(body._pluginDataInstances[i]);
    }
  }
  /**
   * Returns a reference to the first instance of the plugin data for a physics body.
   * @param body
   * @param instanceIndex
   * @returns a reference to the first instance
   */
  _getPluginReference(body, instanceIndex) {
    return body._pluginDataInstances?.length ? body._pluginDataInstances[instanceIndex ?? 0] : body._pluginData;
  }
  /**
   * Gets the shape of a physics body. This will create a new shape object
   *
   * @param body - The physics body.
   * @returns The shape of the physics body.
   *
   */
  getShape(body) {
    const pluginRef = this._getPluginReference(body);
    const shapePluginData = this._hknp.HP_Body_GetShape(pluginRef.hpBodyId)[1];
    if (shapePluginData != 0) {
      const scene = body.transformNode.getScene();
      return new PhysicsShape({ pluginData: shapePluginData }, scene);
    }
    return null;
  }
  /**
   * Gets the type of a physics shape.
   * @param shape - The physics shape to get the type for.
   * @returns The type of the physics shape.
   *
   */
  getShapeType(shape) {
    if (shape.type) {
      return shape.type;
    } else {
      return this._hknp.HP_Shape_GetType(shape._pluginData);
    }
  }
  /**
   * Sets the event mask of a physics body.
   * @param body - The physics body to set the event mask for.
   * @param eventMask - The event mask to set.
   * @param instanceIndex - The index of the instance to set the event mask for
   *
   * This function is useful for setting the event mask of a physics body, which is used to determine which events the body will respond to. This is important for ensuring that the physics engine is able to accurately simulate the behavior of the body in the game world.
   */
  setEventMask(body, eventMask, instanceIndex) {
    this._applyToBodyOrInstances(body, (bodyPluginData) => {
      this._hknp.HP_Body_SetEventMask(bodyPluginData.hpBodyId, eventMask);
    }, instanceIndex);
  }
  /**
   * Retrieves the event mask of a physics body.
   *
   * @param body - The physics body to retrieve the event mask from.
   * @param instanceIndex - The index of the instance to retrieve the event mask from.
   * @returns The event mask of the physics body.
   *
   */
  getEventMask(body, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    return this._hknp.HP_Body_GetEventMask(pluginRef.hpBodyId)[1];
  }
  _fromMassPropertiesTuple(massPropsTuple) {
    return {
      centerOfMass: Vector3.FromArray(massPropsTuple[0]),
      mass: massPropsTuple[1],
      inertia: Vector3.FromArray(massPropsTuple[2]),
      inertiaOrientation: Quaternion.FromArray(massPropsTuple[3])
    };
  }
  _internalUpdateMassProperties(pluginData) {
    const newProps = this._internalComputeMassProperties(pluginData);
    const massProps = pluginData.userMassProps;
    if (massProps.centerOfMass) {
      newProps[0] = massProps.centerOfMass.asArray();
    }
    if (massProps.mass != void 0) {
      newProps[1] = massProps.mass;
    }
    if (massProps.inertia) {
      newProps[2] = massProps.inertia.asArray();
    }
    if (massProps.inertiaOrientation) {
      newProps[3] = massProps.inertiaOrientation.asArray();
    }
    this._hknp.HP_Body_SetMassProperties(pluginData.hpBodyId, newProps);
  }
  _internalSetMotionType(pluginData, motionType) {
    switch (motionType) {
      case 0:
        this._hknp.HP_Body_SetMotionType(pluginData.hpBodyId, this._hknp.MotionType.STATIC);
        break;
      case 1:
        this._hknp.HP_Body_SetMotionType(pluginData.hpBodyId, this._hknp.MotionType.KINEMATIC);
        break;
      case 2:
        this._hknp.HP_Body_SetMotionType(pluginData.hpBodyId, this._hknp.MotionType.DYNAMIC);
        break;
    }
  }
  /**
   * sets the motion type of a physics body.
   * @param body - The physics body to set the motion type for.
   * @param motionType - The motion type to set.
   * @param instanceIndex - The index of the instance to set the motion type for. If undefined, the motion type of all the bodies will be set.
   */
  setMotionType(body, motionType, instanceIndex) {
    this._applyToBodyOrInstances(body, (pluginData) => {
      this._internalSetMotionType(pluginData, motionType);
    }, instanceIndex);
  }
  /**
   * Gets the motion type of a physics body.
   * @param body - The physics body to get the motion type from.
   * @param instanceIndex - The index of the instance to get the motion type from. If not specified, the motion type of the first instance will be returned.
   * @returns The motion type of the physics body.
   */
  getMotionType(body, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    const type = this._hknp.HP_Body_GetMotionType(pluginRef.hpBodyId)[1];
    switch (type) {
      case this._hknp.MotionType.STATIC:
        return 0;
      case this._hknp.MotionType.KINEMATIC:
        return 1;
      case this._hknp.MotionType.DYNAMIC:
        return 2;
    }
    throw new Error("Unknown motion type: " + type);
  }
  /**
   * sets the activation control mode of a physics body, for instance if you need the body to never sleep.
   * @param body - The physics body to set the activation control mode.
   * @param controlMode - The activation control mode.
   */
  setActivationControl(body, controlMode) {
    switch (controlMode) {
      case 1:
        this._hknp.HP_Body_SetActivationControl(body._pluginData.hpBodyId, this._hknp.ActivationControl.ALWAYS_ACTIVE);
        break;
      case 2:
        this._hknp.HP_Body_SetActivationControl(body._pluginData.hpBodyId, this._hknp.ActivationControl.ALWAYS_INACTIVE);
        break;
      case 0:
        this._hknp.HP_Body_SetActivationControl(body._pluginData.hpBodyId, this._hknp.ActivationControl.SIMULATION_CONTROLLED);
        break;
    }
  }
  _internalComputeMassProperties(pluginData) {
    const shapeRes = this._hknp.HP_Body_GetShape(pluginData.hpBodyId);
    if (shapeRes[0] == this._hknp.Result.RESULT_OK) {
      const shapeMass = this._hknp.HP_Shape_BuildMassProperties(shapeRes[1]);
      if (shapeMass[0] == this._hknp.Result.RESULT_OK) {
        return shapeMass[1];
      }
    }
    return [[0, 0, 0], 1, [1, 1, 1], [0, 0, 0, 1]];
  }
  /**
   * Computes the mass properties of a physics body, from it's shape
   *
   * @param body - The physics body to copmute the mass properties of
   * @param instanceIndex - The index of the instance to compute the mass properties of.
   * @returns The mass properties of the physics body.
   */
  computeMassProperties(body, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    const computed = this._internalComputeMassProperties(pluginRef);
    return this._fromMassPropertiesTuple(computed);
  }
  /**
   * Sets the mass properties of a physics body.
   *
   * @param body - The physics body to set the mass properties of.
   * @param massProps - The mass properties to set.
   * @param instanceIndex - The index of the instance to set the mass properties of. If undefined, the mass properties of all the bodies will be set.
   * This function is useful for setting the mass properties of a physics body,
   * such as its mass, inertia, and center of mass. This is important for
   * accurately simulating the physics of the body in the physics engine.
   *
   */
  setMassProperties(body, massProps, instanceIndex) {
    this._applyToBodyOrInstances(body, (pluginData) => {
      pluginData.userMassProps = massProps;
      this._internalUpdateMassProperties(pluginData);
    }, instanceIndex);
  }
  /**
   * Gets the mass properties of a physics body.
   * @param body - The physics body to get the mass properties from.
   * @param instanceIndex - The index of the instance to get the mass properties from. If not specified, the mass properties of the first instance will be returned.
   * @returns The mass properties of the physics body.
   */
  getMassProperties(body, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    const massPropsTuple = this._hknp.HP_Body_GetMassProperties(pluginRef.hpBodyId)[1];
    return this._fromMassPropertiesTuple(massPropsTuple);
  }
  /**
   * Sets the linear damping of the given body.
   * @param body - The body to set the linear damping for.
   * @param damping - The linear damping to set.
   * @param instanceIndex - The index of the instance to set the linear damping for. If not specified, the linear damping of the first instance will be set.
   *
   * This method is useful for controlling the linear damping of a body in a physics engine.
   * Linear damping is a force that opposes the motion of the body, and is proportional to the velocity of the body.
   * This method allows the user to set the linear damping of a body, which can be used to control the motion of the body.
   */
  setLinearDamping(body, damping, instanceIndex) {
    this._applyToBodyOrInstances(body, (pluginData) => {
      this._hknp.HP_Body_SetLinearDamping(pluginData.hpBodyId, damping);
    }, instanceIndex);
  }
  /**
   * Gets the linear damping of the given body.
   * @param body - The body to get the linear damping from.
   * @param instanceIndex - The index of the instance to get the linear damping from. If not specified, the linear damping of the first instance will be returned.
   * @returns The linear damping of the given body.
   *
   * This method is useful for getting the linear damping of a body in a physics engine.
   * Linear damping is a force that opposes the motion of the body and is proportional to the velocity of the body.
   * It is used to simulate the effects of air resistance and other forms of friction.
   */
  getLinearDamping(body, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    return this._hknp.HP_Body_GetLinearDamping(pluginRef.hpBodyId)[1];
  }
  /**
   * Sets the angular damping of a physics body.
   * @param body - The physics body to set the angular damping for.
   * @param damping - The angular damping value to set.
   * @param instanceIndex - The index of the instance to set the angular damping for. If not specified, the angular damping of the first instance will be set.
   *
   * This function is useful for controlling the angular velocity of a physics body.
   * By setting the angular damping, the body's angular velocity will be reduced over time, allowing for more realistic physics simulations.
   */
  setAngularDamping(body, damping, instanceIndex) {
    this._applyToBodyOrInstances(body, (pluginData) => {
      this._hknp.HP_Body_SetAngularDamping(pluginData.hpBodyId, damping);
    }, instanceIndex);
  }
  /**
   * Gets the angular damping of a physics body.
   * @param body - The physics body to get the angular damping from.
   * @param instanceIndex - The index of the instance to get the angular damping from. If not specified, the angular damping of the first instance will be returned.
   * @returns The angular damping of the body.
   *
   * This function is useful for retrieving the angular damping of a physics body,
   * which is used to control the rotational motion of the body. The angular damping is a value between 0 and 1, where 0 is no damping and 1 is full damping.
   */
  getAngularDamping(body, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    return this._hknp.HP_Body_GetAngularDamping(pluginRef.hpBodyId)[1];
  }
  /**
   * Sets the linear velocity of a physics body.
   * @param body - The physics body to set the linear velocity of.
   * @param linVel - The linear velocity to set.
   * @param instanceIndex - The index of the instance to set the linear velocity of. If not specified, the linear velocity of the first instance will be set.
   *
   * This function is useful for setting the linear velocity of a physics body, which is necessary for simulating
   * motion in a physics engine. The linear velocity is the speed and direction of the body's movement.
   */
  setLinearVelocity(body, linVel, instanceIndex) {
    this._applyToBodyOrInstances(body, (pluginData) => {
      this._hknp.HP_Body_SetLinearVelocity(pluginData.hpBodyId, this._bVecToV3(linVel));
    }, instanceIndex);
  }
  /**
   * Gets the linear velocity of a physics body and stores it in a given vector.
   * @param body - The physics body to get the linear velocity from.
   * @param linVel - The vector to store the linear velocity in.
   * @param instanceIndex - The index of the instance to get the linear velocity from. If not specified, the linear velocity of the first instance will be returned.
   *
   * This function is useful for retrieving the linear velocity of a physics body,
   * which can be used to determine the speed and direction of the body. This
   * information can be used to simulate realistic physics behavior in a game.
   */
  getLinearVelocityToRef(body, linVel, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    const lv = this._hknp.HP_Body_GetLinearVelocity(pluginRef.hpBodyId)[1];
    this._v3ToBvecRef(lv, linVel);
  }
  /*
   * Apply an operation either to all instances of a body, if instanceIndex is not specified, or to a specific instance.
   */
  _applyToBodyOrInstances(body, fnToApply, instanceIndex) {
    if (body._pluginDataInstances?.length > 0 && instanceIndex === void 0) {
      for (let i = 0; i < body._pluginDataInstances.length; i++) {
        fnToApply(body._pluginDataInstances[i]);
      }
    } else {
      fnToApply(this._getPluginReference(body, instanceIndex));
    }
  }
  /**
   * Applies an impulse to a physics body at a given location.
   * @param body - The physics body to apply the impulse to.
   * @param impulse - The impulse vector to apply.
   * @param location - The location in world space to apply the impulse.
   * @param instanceIndex - The index of the instance to apply the impulse to. If not specified, the impulse will be applied to all instances.
   *
   * This method is useful for applying an impulse to a physics body at a given location.
   * This can be used to simulate physical forces such as explosions, collisions, and gravity.
   */
  applyImpulse(body, impulse, location, instanceIndex) {
    this._applyToBodyOrInstances(body, (pluginRef) => {
      const offset = pluginRef.worldRegion.floatingOrigin;
      this._hknp.HP_Body_ApplyImpulse(pluginRef.hpBodyId, this._bVecToV3WithOffset(location, offset), this._bVecToV3(impulse));
    }, instanceIndex);
  }
  /**
   * Applies an angular impulse(torque) to a physics body
   * @param body - The physics body to apply the impulse to.
   * @param angularImpulse - The torque value
   * @param instanceIndex - The index of the instance to apply the impulse to. If not specified, the impulse will be applied to all instances.
   */
  applyAngularImpulse(body, angularImpulse, instanceIndex) {
    this._applyToBodyOrInstances(body, (pluginRef) => {
      this._hknp.HP_Body_ApplyAngularImpulse(pluginRef.hpBodyId, this._bVecToV3(angularImpulse));
    }, instanceIndex);
  }
  /**
   * Applies a force to a physics body at a given location.
   * @param body - The physics body to apply the impulse to.
   * @param force - The force vector to apply.
   * @param location - The location in world space to apply the impulse.
   * @param instanceIndex - The index of the instance to apply the force to. If not specified, the force will be applied to all instances.
   *
   * This method is useful for applying a force to a physics body at a given location.
   * This can be used to simulate physical forces such as explosions, collisions, and gravity.
   */
  applyForce(body, force, location, instanceIndex) {
    force.scaleToRef(this.getTimeStep(), this._tmpVec3[0]);
    this.applyImpulse(body, this._tmpVec3[0], location, instanceIndex);
  }
  /**
   * Applies a torque to a physics body.
   * @param body - The physics body to apply the torque to.
   * @param torque - The torque vector.
   * @param instanceIndex - The index of the instance to apply the torque to. If not specified, the torque will be applied to all instances.
   *
   * This method is useful for applying a torque to a physics body.
   * This can be used to simulate rotational forces such as motors, angular momentum, and rotational dynamics.
   */
  applyTorque(body, torque, instanceIndex) {
    torque.scaleToRef(this.getTimeStep(), this._tmpVec3[0]);
    this.applyAngularImpulse(body, this._tmpVec3[0], instanceIndex);
  }
  /**
   * Sets the angular velocity of a physics body.
   *
   * @param body - The physics body to set the angular velocity of.
   * @param angVel - The angular velocity to set.
   * @param instanceIndex - The index of the instance to set the angular velocity of. If not specified, the angular velocity of the first instance will be set.
   *
   * This function is useful for setting the angular velocity of a physics body in a physics engine.
   * This allows for more realistic simulations of physical objects, as they can be given a rotational velocity.
   */
  setAngularVelocity(body, angVel, instanceIndex) {
    this._applyToBodyOrInstances(body, (pluginRef) => {
      this._hknp.HP_Body_SetAngularVelocity(pluginRef.hpBodyId, this._bVecToV3(angVel));
    }, instanceIndex);
  }
  /**
   * Gets the angular velocity of a body.
   * @param body - The body to get the angular velocity from.
   * @param angVel - The vector3 to store the angular velocity.
   * @param instanceIndex - The index of the instance to get the angular velocity from. If not specified, the angular velocity of the first instance will be returned.
   *
   * This method is useful for getting the angular velocity of a body in a physics engine. It
   * takes the body and a vector3 as parameters and stores the angular velocity of the body
   * in the vector3. This is useful for getting the angular velocity of a body in order to
   * calculate the motion of the body in the physics engine.
   */
  getAngularVelocityToRef(body, angVel, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    const av = this._hknp.HP_Body_GetAngularVelocity(pluginRef.hpBodyId)[1];
    this._v3ToBvecRef(av, angVel);
  }
  /**
   * Sets the transformation of the given physics body to the given transform node.
   * @param body The physics body to set the transformation for.
   * @param node The transform node to set the transformation from.
   * Sets the transformation of the given physics body to the given transform node.
   *
   * This function is useful for setting the transformation of a physics body to a
   * transform node, which is necessary for the physics engine to accurately simulate
   * the motion of the body. It also takes into account instances of the transform
   * node, which is necessary for accurate simulation of multiple bodies with the
   * same transformation.
   */
  setPhysicsBodyTransformation(body, node) {
    if (body.getPrestepType() == PhysicsPrestepType.TELEPORT) {
      const transformNode = body.transformNode;
      if (body.numInstances > 0) {
        const m = transformNode;
        const matrixData = m._thinInstanceDataStorage.matrixData;
        if (!matrixData) {
          return;
        }
        const instancesCount = body.numInstances;
        this._createOrUpdateBodyInstances(body, body.getMotionType(), matrixData, 0, instancesCount, true);
      } else {
        const pluginData = body._pluginData;
        if (pluginData.worldRegion && this._areFloatingOriginWorldRegionsEnabled()) {
          const worldPos = TmpVectors.Vector3[3];
          if (node.parent) {
            node.computeWorldMatrix(true);
            worldPos.copyFrom(node.absolutePosition);
          } else {
            worldPos.copyFrom(node.position);
          }
          const currentRegion = pluginData.worldRegion;
          const distToCurrent = Vector3.Distance(worldPos, currentRegion.floatingOrigin);
          if (distToCurrent > this._floatingOriginWorldRadius * 1.2) {
            const newRegion = this._getOrCreateWorldRegion(worldPos);
            if (newRegion !== currentRegion) {
              const linVel = this._hknp.HP_Body_GetLinearVelocity(pluginData.hpBodyId)[1];
              const angVel = this._hknp.HP_Body_GetAngularVelocity(pluginData.hpBodyId)[1];
              this._hknp.HP_World_RemoveBody(currentRegion.world, pluginData.hpBodyId);
              this._hknp.HP_World_AddBody(newRegion.world, pluginData.hpBodyId, false);
              this._hknp.HP_Body_SetLinearVelocity(pluginData.hpBodyId, linVel);
              this._hknp.HP_Body_SetAngularVelocity(pluginData.hpBodyId, angVel);
              pluginData.worldRegion = newRegion;
              pluginData.worldTransformOffset = this._hknp.HP_Body_GetWorldTransformOffset(pluginData.hpBodyId)[1];
              this._releaseWorldRegionIfEmpty(currentRegion);
            }
          }
        }
        const offset = body._pluginData.worldRegion.floatingOrigin;
        this._hknp.HP_Body_SetQTransform(body._pluginData.hpBodyId, this._getTransformInfos(node, offset));
      }
    } else if (body.getPrestepType() == PhysicsPrestepType.ACTION) {
      this.setTargetTransform(body, node.absolutePosition, node.absoluteRotationQuaternion);
    } else if (body.getPrestepType() == PhysicsPrestepType.DISABLED) {
      Logger.Warn("Prestep type is set to DISABLED. Unable to set physics body transformation.");
    } else {
      Logger.Warn("Invalid prestep type set to physics body.");
    }
  }
  /**
   * Set the target transformation (position and rotation) of the body, such that the body will set its velocity to reach that target
   * @param body The physics body to set the target transformation for.
   * @param position The target position
   * @param rotation The target rotation
   * @param instanceIndex The index of the instance in an instanced body
   */
  setTargetTransform(body, position, rotation, instanceIndex) {
    this._applyToBodyOrInstances(body, (pluginRef) => {
      const offset = pluginRef.worldRegion.floatingOrigin;
      this._hknp.HP_Body_SetTargetQTransform(pluginRef.hpBodyId, [this._bVecToV3WithOffset(position, offset), this._bQuatToV4(rotation)]);
    }, instanceIndex);
  }
  /**
   * Sets the gravity factor of a body
   * @param body the physics body to set the gravity factor for
   * @param factor the gravity factor
   * @param instanceIndex the index of the instance in an instanced body
   */
  setGravityFactor(body, factor, instanceIndex) {
    this._applyToBodyOrInstances(body, (pluginRef) => {
      this._hknp.HP_Body_SetGravityFactor(pluginRef.hpBodyId, factor);
    }, instanceIndex);
  }
  /**
   * Get the gravity factor of a body
   * @param body the physics body to get the gravity factor from
   * @param instanceIndex the index of the instance in an instanced body. If not specified, the gravity factor of the first instance will be returned.
   * @returns the gravity factor
   */
  getGravityFactor(body, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    return this._hknp.HP_Body_GetGravityFactor(pluginRef.hpBodyId)[1];
  }
  /**
   * Disposes a physics body.
   *
   * @param body - The physics body to dispose.
   *
   * This method is useful for releasing the resources associated with a physics body when it is no longer needed.
   * This is important for avoiding memory leaks in the physics engine.
   */
  disposeBody(body) {
    if (body._pluginDataInstances && body._pluginDataInstances.length > 0) {
      for (const instance of body._pluginDataInstances) {
        this._hknp.HP_Body_Release(instance.hpBodyId);
        instance.hpBodyId = void 0;
      }
    }
    if (body._pluginData) {
      this._hknp.HP_Body_Release(body._pluginData.hpBodyId);
      body._pluginData.hpBodyId = void 0;
    }
  }
  _createOptionsFromGroundMesh(options) {
    const mesh = options.groundMesh;
    if (!mesh) {
      return;
    }
    let pos = mesh.getVerticesData(VertexBuffer.PositionKind);
    const transform = mesh.computeWorldMatrix(true);
    const transformedVertices = [];
    let index;
    for (index = 0; index < pos.length; index += 3) {
      Vector3.FromArrayToRef(pos, index, TmpVectors.Vector3[0]);
      Vector3.TransformCoordinatesToRef(TmpVectors.Vector3[0], transform, TmpVectors.Vector3[1]);
      TmpVectors.Vector3[1].toArray(transformedVertices, index);
    }
    pos = transformedVertices;
    const arraySize = ~~(Math.sqrt(pos.length / 3) - 1);
    const boundingInfo = mesh.getBoundingInfo();
    const dim = Math.min(boundingInfo.boundingBox.extendSizeWorld.x, boundingInfo.boundingBox.extendSizeWorld.z);
    const minX = boundingInfo.boundingBox.minimumWorld.x;
    const minY = boundingInfo.boundingBox.minimumWorld.y;
    const minZ = boundingInfo.boundingBox.minimumWorld.z;
    const matrix = new Float32Array((arraySize + 1) * (arraySize + 1));
    const elementSize = dim * 2 / arraySize;
    for (let i = 0; i < matrix.length; i++) {
      matrix[i] = minY;
    }
    for (let i = 0; i < pos.length; i = i + 3) {
      const x = Math.round((pos[i + 0] - minX) / elementSize);
      const z = arraySize - Math.round((pos[i + 2] - minZ) / elementSize);
      const y = pos[i + 1] - minY;
      matrix[z * (arraySize + 1) + x] = y;
    }
    options.numHeightFieldSamplesX = arraySize + 1;
    options.numHeightFieldSamplesZ = arraySize + 1;
    options.heightFieldSizeX = boundingInfo.boundingBox.extendSizeWorld.x * 2;
    options.heightFieldSizeZ = boundingInfo.boundingBox.extendSizeWorld.z * 2;
    options.heightFieldData = matrix;
  }
  /**
   * Initializes a physics shape with the given type and parameters.
   * @param shape - The physics shape to initialize.
   * @param type - The type of shape to initialize.
   * @param options - The parameters for the shape.
   *
   * This code is useful for initializing a physics shape with the given type and parameters.
   * It allows for the creation of a sphere, box, capsule, container, cylinder, mesh, and heightfield.
   * Depending on the type of shape, different parameters are required.
   * For example, a sphere requires a radius, while a box requires extents and a rotation.
   */
  initShape(shape, type, options) {
    switch (type) {
      case 0:
        {
          const radius = options.radius || 1;
          const center = options.center ? this._bVecToV3(options.center) : [0, 0, 0];
          shape._pluginData = this._hknp.HP_Shape_CreateSphere(center, radius)[1];
        }
        break;
      case 3:
        {
          const rotation = options.rotation ? this._bQuatToV4(options.rotation) : [0, 0, 0, 1];
          const extent = options.extents ? this._bVecToV3(options.extents) : [1, 1, 1];
          const center = options.center ? this._bVecToV3(options.center) : [0, 0, 0];
          shape._pluginData = this._hknp.HP_Shape_CreateBox(center, rotation, extent)[1];
        }
        break;
      case 1:
        {
          const pointA = options.pointA ? this._bVecToV3(options.pointA) : [0, 0, 0];
          const pointB = options.pointB ? this._bVecToV3(options.pointB) : [0, 1, 0];
          const radius = options.radius || 0;
          shape._pluginData = this._hknp.HP_Shape_CreateCapsule(pointA, pointB, radius)[1];
        }
        break;
      case 5:
        {
          shape._pluginData = this._hknp.HP_Shape_CreateContainer()[1];
        }
        break;
      case 2:
        {
          const pointA = options.pointA ? this._bVecToV3(options.pointA) : [0, 0, 0];
          const pointB = options.pointB ? this._bVecToV3(options.pointB) : [0, 1, 0];
          const radius = options.radius || 0;
          shape._pluginData = this._hknp.HP_Shape_CreateCylinder(pointA, pointB, radius)[1];
        }
        break;
      case 4:
      case 6:
        {
          const mesh = options.mesh;
          if (mesh) {
            const includeChildMeshes = !!options.includeChildMeshes;
            const needIndices = type != 4;
            const accum = new MeshAccumulator(mesh, needIndices, mesh?.getScene());
            accum.addNodeMeshes(mesh, includeChildMeshes);
            const positions = accum.getVertices(this._hknp);
            const numVec3s = positions.numObjects / 3;
            if (type == 4) {
              shape._pluginData = this._hknp.HP_Shape_CreateConvexHull(positions.offset, numVec3s)[1];
            } else {
              const triangles = accum.getTriangles(this._hknp);
              const numTriangles = triangles.numObjects / 3;
              shape._pluginData = this._hknp.HP_Shape_CreateMesh(positions.offset, numVec3s, triangles.offset, numTriangles)[1];
              accum.freeBuffer(this._hknp, triangles);
            }
            accum.freeBuffer(this._hknp, positions);
          } else {
            throw new Error("No mesh provided to create physics shape.");
          }
        }
        break;
      case 7:
        {
          if (options.groundMesh) {
            this._createOptionsFromGroundMesh(options);
          }
          if (options.numHeightFieldSamplesX && options.numHeightFieldSamplesZ && options.heightFieldSizeX && options.heightFieldSizeZ && options.heightFieldData) {
            const totalNumHeights = options.numHeightFieldSamplesX * options.numHeightFieldSamplesZ;
            const numBytes = totalNumHeights * 4;
            const bufferBegin = this._hknp._malloc(numBytes);
            const heightBuffer = new Float32Array(this._hknp.HEAPU8.buffer, bufferBegin, totalNumHeights);
            for (let x = 0; x < options.numHeightFieldSamplesX; x++) {
              for (let z = 0; z < options.numHeightFieldSamplesZ; z++) {
                const hkBufferIndex = z * options.numHeightFieldSamplesX + x;
                const bjsBufferIndex = (options.numHeightFieldSamplesX - 1 - x) * options.numHeightFieldSamplesZ + z;
                heightBuffer[hkBufferIndex] = options.heightFieldData[bjsBufferIndex];
              }
            }
            const scaleX = options.heightFieldSizeX / (options.numHeightFieldSamplesX - 1);
            const scaleZ = options.heightFieldSizeZ / (options.numHeightFieldSamplesZ - 1);
            shape._pluginData = this._hknp.HP_Shape_CreateHeightField(options.numHeightFieldSamplesX, options.numHeightFieldSamplesZ, [scaleX, 1, scaleZ], bufferBegin)[1];
            this._hknp._free(bufferBegin);
          } else {
            throw new Error("Missing required heightfield parameters");
          }
        }
        break;
      default:
        throw new Error("Unsupported Shape Type.");
    }
    this._shapes.set(shape._pluginData[0], shape);
  }
  /**
   * Sets the shape filter membership mask of a body
   * @param shape - The physics body to set the shape filter membership mask for.
   * @param membershipMask - The shape filter membership mask to set.
   */
  setShapeFilterMembershipMask(shape, membershipMask) {
    const collideWith = this._hknp.HP_Shape_GetFilterInfo(shape._pluginData)[1][1];
    this._hknp.HP_Shape_SetFilterInfo(shape._pluginData, [membershipMask, collideWith]);
  }
  /**
   * Gets the shape filter membership mask of a body
   * @param shape - The physics body to get the shape filter membership mask from.
   * @returns The shape filter membership mask of the given body.
   */
  getShapeFilterMembershipMask(shape) {
    return this._hknp.HP_Shape_GetFilterInfo(shape._pluginData)[1][0];
  }
  /**
   * Sets the shape filter collide mask of a body
   * @param shape - The physics body to set the shape filter collide mask for.
   * @param collideMask - The shape filter collide mask to set.
   */
  setShapeFilterCollideMask(shape, collideMask) {
    const membership = this._hknp.HP_Shape_GetFilterInfo(shape._pluginData)[1][0];
    this._hknp.HP_Shape_SetFilterInfo(shape._pluginData, [membership, collideMask]);
  }
  /**
   * Gets the shape filter collide mask of a body
   * @param shape - The physics body to get the shape filter collide mask from.
   * @returns The shape filter collide mask of the given body.
   */
  getShapeFilterCollideMask(shape) {
    return this._hknp.HP_Shape_GetFilterInfo(shape._pluginData)[1][1];
  }
  /**
   * Sets the material of a physics shape.
   * @param shape - The physics shape to set the material of.
   * @param material - The material to set.
   *
   */
  setMaterial(shape, material) {
    const dynamicFriction = material.friction ?? 0.5;
    const staticFriction = material.staticFriction ?? dynamicFriction;
    const restitution = material.restitution ?? 0;
    const frictionCombine = material.frictionCombine ?? 1;
    const restitutionCombine = material.restitutionCombine ?? 2;
    const hpMaterial = [staticFriction, dynamicFriction, restitution, this._materialCombineToNative(frictionCombine), this._materialCombineToNative(restitutionCombine)];
    this._hknp.HP_Shape_SetMaterial(shape._pluginData, hpMaterial);
  }
  /**
   * Gets the material associated with a physics shape.
   * @param shape - The shape to get the material from.
   * @returns The material associated with the shape.
   */
  getMaterial(shape) {
    const hkMaterial = this._hknp.HP_Shape_GetMaterial(shape._pluginData)[1];
    return {
      staticFriction: hkMaterial[0],
      friction: hkMaterial[1],
      restitution: hkMaterial[2],
      frictionCombine: this._nativeToMaterialCombine(hkMaterial[3]),
      restitutionCombine: this._nativeToMaterialCombine(hkMaterial[4])
    };
  }
  /**
   * Sets the density of a physics shape.
   * @param shape - The physics shape to set the density of.
   * @param density - The density to set.
   *
   */
  setDensity(shape, density) {
    this._hknp.HP_Shape_SetDensity(shape._pluginData, density);
  }
  /**
   * Calculates the density of a given physics shape.
   *
   * @param shape - The physics shape to calculate the density of.
   * @returns The density of the given physics shape.
   *
   */
  getDensity(shape) {
    return this._hknp.HP_Shape_GetDensity(shape._pluginData)[1];
  }
  /**
   * Gets the transform infos of a given transform node.
   * This code is useful for getting the position and orientation of a given transform node.
   * It first checks if the node has a rotation quaternion, and if not, it creates one from the node's rotation.
   * It then creates an array containing the position and orientation of the node and returns it.
   * @param node - The transform node.
   * @param offset - The floating origin offset to apply.
   * @returns An array containing the position and orientation of the node.
   */
  _getTransformInfos(node, offset) {
    if (node.parent) {
      node.computeWorldMatrix(true);
      return [this._bVecToV3WithOffset(node.absolutePosition, offset), this._bQuatToV4(node.absoluteRotationQuaternion)];
    }
    let orientation = TmpVectors.Quaternion[0];
    if (node.rotationQuaternion) {
      orientation = node.rotationQuaternion;
    } else {
      const r = node.rotation;
      Quaternion.FromEulerAnglesToRef(r.x, r.y, r.z, orientation);
    }
    const transform = [this._bVecToV3WithOffset(node.position, offset), this._bQuatToV4(orientation)];
    return transform;
  }
  /**
   * Adds a child shape to the given shape.
   * @param shape - The parent shape.
   * @param newChild - The child shape to add.
   * @param translation - The relative translation of the child from the parent shape
   * @param rotation - The relative rotation of the child from the parent shape
   * @param scale - The relative scale scale of the child from the parent shaep
   *
   */
  addChild(shape, newChild, translation, rotation, scale) {
    const transformNative = [
      translation ? this._bVecToV3(translation) : [0, 0, 0],
      rotation ? this._bQuatToV4(rotation) : [0, 0, 0, 1],
      scale ? this._bVecToV3(scale) : [1, 1, 1]
    ];
    this._hknp.HP_Shape_AddChild(shape._pluginData, newChild._pluginData, transformNative);
  }
  /**
   * Removes a child shape from a parent shape.
   * @param shape - The parent shape.
   * @param childIndex - The index of the child shape to remove.
   *
   */
  removeChild(shape, childIndex) {
    this._hknp.HP_Shape_RemoveChild(shape._pluginData, childIndex);
  }
  /**
   * Returns the number of children of the given shape.
   *
   * @param shape - The shape to get the number of children from.
   * @returns The number of children of the given shape.
   *
   */
  getNumChildren(shape) {
    return this._hknp.HP_Shape_GetNumChildren(shape._pluginData)[1];
  }
  /**
   * Marks the shape as a trigger
   * @param shape the shape to mark as a trigger
   * @param isTrigger if the shape is a trigger
   */
  setTrigger(shape, isTrigger) {
    this._hknp.HP_Shape_SetTrigger(shape._pluginData, isTrigger);
  }
  /**
   * Calculates the bounding box of a given physics shape.
   *
   * @param _shape - The physics shape to calculate the bounding box for.
   * @returns The calculated bounding box.
   *
   * This method is useful for physics engines as it allows to calculate the
   * boundaries of a given shape. Knowing the boundaries of a shape is important
   * for collision detection and other physics calculations.
   */
  getBoundingBox(_shape) {
    const aabb = this._hknp.HP_Shape_GetBoundingBox(_shape._pluginData, [
      [0, 0, 0],
      [0, 0, 0, 1]
    ])[1];
    TmpVectors.Vector3[0].set(aabb[0][0], aabb[0][1], aabb[0][2]);
    TmpVectors.Vector3[1].set(aabb[1][0], aabb[1][1], aabb[1][2]);
    const boundingbox = new BoundingBox(TmpVectors.Vector3[0], TmpVectors.Vector3[1], Matrix.IdentityReadOnly);
    return boundingbox;
  }
  /**
   * Calculates the world bounding box of a given physics body.
   *
   * @param body - The physics body to calculate the bounding box for.
   * @returns The calculated bounding box.
   *
   * This method is useful for physics engines as it allows to calculate the
   * boundaries of a given body.
   */
  getBodyBoundingBox(body) {
    const aabb = this.getBoundingBox(body.shape);
    const boundingbox = new BoundingBox(aabb.minimum, aabb.maximum, body.transformNode.getWorldMatrix());
    return boundingbox;
  }
  /**
   * Gets the geometry of a physics body.
   *
   * @param body - The physics body.
   * @returns An object containing the positions and indices of the body's geometry.
   *
   */
  getBodyGeometry(body) {
    const dataInfo = body._pluginDataInstances?.length > 0 ? body._pluginDataInstances[0] : body._pluginData;
    const shape = this._hknp.HP_Body_GetShape(dataInfo.hpBodyId)[1];
    const geometryRes = this._hknp.HP_Shape_CreateDebugDisplayGeometry(shape);
    if (geometryRes[0] != this._hknp.Result.RESULT_OK) {
      return { positions: [], indices: [] };
    }
    const geometryInfo = this._hknp.HP_DebugGeometry_GetInfo(geometryRes[1])[1];
    const positionsInPlugin = new Float32Array(this._hknp.HEAPU8.buffer, geometryInfo[0], geometryInfo[1] * 3);
    const indicesInPlugin = new Uint32Array(this._hknp.HEAPU8.buffer, geometryInfo[2], geometryInfo[3] * 3);
    const positions = positionsInPlugin.slice(0);
    const indices = indicesInPlugin.slice(0);
    this._hknp.HP_DebugGeometry_Release(geometryRes[1]);
    return { positions, indices };
  }
  /**
   * Releases a physics shape from the physics engine.
   *
   * @param shape - The physics shape to be released.
   *
   * This method is useful for releasing a physics shape from the physics engine, freeing up resources and preventing memory leaks.
   */
  disposeShape(shape) {
    this._shapes.delete(shape._pluginData[0]);
    this._hknp.HP_Shape_Release(shape._pluginData);
    shape._pluginData = void 0;
  }
  // constraint
  /**
   * Initializes a physics constraint with the given parameters.
   *
   * @param constraint - The physics constraint to be initialized.
   * @param body - The main body
   * @param childBody - The child body.
   * @param instanceIndex - If this body is instanced, the index of the instance to which the constraint will be applied. If not specified, no constraint will be applied.
   * @param childInstanceIndex - If the child body is instanced, the index of the instance to which the constraint will be applied. If not specified, no constraint will be applied.
   *
   * This function is useful for setting up a physics constraint in a physics engine.
   */
  initConstraint(constraint, body, childBody, instanceIndex, childInstanceIndex) {
    const type = constraint.type;
    const options = constraint.options;
    if (!type || !options) {
      Logger.Warn("No constraint type or options. Constraint is invalid.");
      return;
    }
    if (body._pluginDataInstances.length > 0 && instanceIndex === void 0 || childBody._pluginDataInstances.length > 0 && childInstanceIndex === void 0) {
      Logger.Warn("Body is instanced but no instance index was specified. Constraint will not be applied.");
      return;
    }
    constraint._pluginData = constraint._pluginData ?? [];
    const jointId = this._hknp.HP_Constraint_Create()[1];
    constraint._pluginData.push(jointId);
    const bodyA = this._getPluginReference(body, instanceIndex).hpBodyId;
    const bodyB = this._getPluginReference(childBody, childInstanceIndex).hpBodyId;
    this._hknp.HP_Constraint_SetParentBody(jointId, bodyA);
    this._hknp.HP_Constraint_SetChildBody(jointId, bodyB);
    this._constraintToBodyIdPair.set(jointId[0], [bodyA[0], bodyB[0]]);
    const pivotA = options.pivotA ? this._bVecToV3(options.pivotA) : this._bVecToV3(Vector3.Zero());
    const axisA = options.axisA ?? new Vector3(1, 0, 0);
    const perpAxisA = this._tmpVec3[0];
    if (options.perpAxisA) {
      perpAxisA.copyFrom(options.perpAxisA);
    } else {
      axisA.getNormalToRef(perpAxisA);
    }
    this._hknp.HP_Constraint_SetAnchorInParent(jointId, pivotA, this._bVecToV3(axisA), this._bVecToV3(perpAxisA));
    const pivotB = options.pivotB ? this._bVecToV3(options.pivotB) : this._bVecToV3(Vector3.Zero());
    const axisB = options.axisB ?? new Vector3(1, 0, 0);
    const perpAxisB = this._tmpVec3[0];
    if (options.perpAxisB) {
      perpAxisB.copyFrom(options.perpAxisB);
    } else {
      axisB.getNormalToRef(perpAxisB);
    }
    this._hknp.HP_Constraint_SetAnchorInChild(jointId, pivotB, this._bVecToV3(axisB), this._bVecToV3(perpAxisB));
    if (!constraint._initOptions) {
      constraint._initOptions = {
        axisA: axisA.clone(),
        axisB: axisB.clone(),
        perpAxisA: perpAxisA.clone(),
        perpAxisB: perpAxisB.clone(),
        pivotA: new Vector3(pivotA[0], pivotA[1], pivotA[2]),
        pivotB: new Vector3(pivotB[0], pivotB[1], pivotB[2])
      };
    }
    if (type == 5) {
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_X, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_Y, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_Z, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.ANGULAR_X, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.ANGULAR_Y, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.ANGULAR_Z, this._hknp.ConstraintAxisLimitMode.LOCKED);
    } else if (type == 2) {
      const distance = options.maxDistance || 0;
      const dist3d = this._hknp.ConstraintAxis.LINEAR_DISTANCE;
      this._hknp.HP_Constraint_SetAxisMode(jointId, dist3d, this._hknp.ConstraintAxisLimitMode.LIMITED);
      this._hknp.HP_Constraint_SetAxisMinLimit(jointId, dist3d, distance);
      this._hknp.HP_Constraint_SetAxisMaxLimit(jointId, dist3d, distance);
    } else if (type == 3) {
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_X, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_Y, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_Z, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.ANGULAR_Y, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.ANGULAR_Z, this._hknp.ConstraintAxisLimitMode.LOCKED);
    } else if (type == 6) {
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_Y, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_Z, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.ANGULAR_X, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.ANGULAR_Y, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.ANGULAR_Z, this._hknp.ConstraintAxisLimitMode.LOCKED);
    } else if (type == 4) {
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_Y, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_Z, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.ANGULAR_Y, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.ANGULAR_Z, this._hknp.ConstraintAxisLimitMode.LOCKED);
    } else if (type == 1) {
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_X, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_Y, this._hknp.ConstraintAxisLimitMode.LOCKED);
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._hknp.ConstraintAxis.LINEAR_Z, this._hknp.ConstraintAxisLimitMode.LOCKED);
    } else if (type == 7) {
      const sixdofData = constraint;
      for (const l of sixdofData.limits) {
        const axId = this._constraintAxisToNative(l.axis);
        if ((l.minLimit ?? -1) == 0 && (l.maxLimit ?? -1) == 0) {
          this._hknp.HP_Constraint_SetAxisMode(jointId, axId, this._hknp.ConstraintAxisLimitMode.LOCKED);
        } else {
          if (l.minLimit != void 0) {
            this._hknp.HP_Constraint_SetAxisMode(jointId, axId, this._hknp.ConstraintAxisLimitMode.LIMITED);
            this._hknp.HP_Constraint_SetAxisMinLimit(jointId, axId, l.minLimit);
          }
          if (l.maxLimit != void 0) {
            this._hknp.HP_Constraint_SetAxisMode(jointId, axId, this._hknp.ConstraintAxisLimitMode.LIMITED);
            this._hknp.HP_Constraint_SetAxisMaxLimit(jointId, axId, l.maxLimit);
          }
        }
        if (l.stiffness) {
          this._hknp.HP_Constraint_SetAxisStiffness(jointId, axId, l.stiffness);
        }
        if (l.damping) {
          this._hknp.HP_Constraint_SetAxisDamping(jointId, axId, l.damping);
        }
      }
    } else {
      throw new Error("Unsupported Constraint Type.");
    }
    const collisionEnabled = !!options.collision;
    this._hknp.HP_Constraint_SetCollisionsEnabled(jointId, collisionEnabled);
    this._hknp.HP_Constraint_SetEnabled(jointId, true);
  }
  /**
   * Get a list of all the pairs of bodies that are connected by this constraint.
   * @param constraint the constraint to search from
   * @returns a list of parent, child pairs
   */
  getBodiesUsingConstraint(constraint) {
    const pairs = [];
    for (const jointId of constraint._pluginData) {
      const bodyIds = this._constraintToBodyIdPair.get(jointId[0]);
      if (bodyIds) {
        const parentBodyInfo = this._bodies.get(bodyIds[0]);
        const childBodyInfo = this._bodies.get(bodyIds[1]);
        if (parentBodyInfo && childBodyInfo) {
          pairs.push({ parentBody: parentBodyInfo.body, parentBodyIndex: parentBodyInfo.index, childBody: childBodyInfo.body, childBodyIndex: childBodyInfo.index });
        }
      }
    }
    return pairs;
  }
  /**
   * Adds a constraint to the physics engine.
   *
   * @param body - The main body to which the constraint is applied.
   * @param childBody - The body to which the constraint is applied.
   * @param constraint - The constraint to be applied.
   * @param instanceIndex - If this body is instanced, the index of the instance to which the constraint will be applied. If not specified, no constraint will be applied.
   * @param childInstanceIndex - If the child body is instanced, the index of the instance to which the constraint will be applied. If not specified, no constraint will be applied.
   */
  addConstraint(body, childBody, constraint, instanceIndex, childInstanceIndex) {
    this.initConstraint(constraint, body, childBody, instanceIndex, childInstanceIndex);
  }
  /**
   * Enables or disables a constraint in the physics engine.
   * @param constraint - The constraint to enable or disable.
   * @param isEnabled - Whether the constraint should be enabled or disabled.
   *
   */
  setEnabled(constraint, isEnabled) {
    for (const jointId of constraint._pluginData) {
      this._hknp.HP_Constraint_SetEnabled(jointId, isEnabled);
    }
  }
  /**
   * Gets the enabled state of the given constraint.
   * @param constraint - The constraint to get the enabled state from.
   * @returns The enabled state of the given constraint.
   *
   */
  getEnabled(constraint) {
    const firstId = constraint._pluginData && constraint._pluginData[0];
    if (firstId) {
      return this._hknp.HP_Constraint_GetEnabled(firstId)[1];
    }
    return false;
  }
  /**
   * Enables or disables collisions for the given constraint.
   * @param constraint - The constraint to enable or disable collisions for.
   * @param isEnabled - Whether collisions should be enabled or disabled.
   *
   */
  setCollisionsEnabled(constraint, isEnabled) {
    for (const jointId of constraint._pluginData) {
      this._hknp.HP_Constraint_SetCollisionsEnabled(jointId, isEnabled);
    }
  }
  /**
   * Gets whether collisions are enabled for the given constraint.
   * @param constraint - The constraint to get collisions enabled for.
   * @returns Whether collisions are enabled for the given constraint.
   *
   */
  getCollisionsEnabled(constraint) {
    const firstId = constraint._pluginData && constraint._pluginData[0];
    if (firstId) {
      return this._hknp.HP_Constraint_GetCollisionsEnabled(firstId)[1];
    }
    return false;
  }
  /**
   * Sets the friction of the given axis of the given constraint.
   *
   * @param constraint - The constraint to set the friction of.
   * @param axis - The axis of the constraint to set the friction of.
   * @param friction - The friction to set.
   *
   */
  setAxisFriction(constraint, axis, friction) {
    for (const jointId of constraint._pluginData) {
      this._hknp.HP_Constraint_SetAxisFriction(jointId, this._constraintAxisToNative(axis), friction);
    }
  }
  /**
   * Gets the friction value of the specified axis of the given constraint.
   *
   * @param constraint - The constraint to get the axis friction from.
   * @param axis - The axis to get the friction from.
   * @returns The friction value of the specified axis.
   *
   */
  getAxisFriction(constraint, axis) {
    const firstId = constraint._pluginData && constraint._pluginData[0];
    if (firstId) {
      return this._hknp.HP_Constraint_GetAxisFriction(firstId, this._constraintAxisToNative(axis))[1];
    }
    return null;
  }
  /**
   * Sets the limit mode of the specified axis of the given constraint.
   * @param constraint - The constraint to set the axis mode of.
   * @param axis - The axis to set the limit mode of.
   * @param limitMode - The limit mode to set.
   */
  setAxisMode(constraint, axis, limitMode) {
    for (const jointId of constraint._pluginData) {
      this._hknp.HP_Constraint_SetAxisMode(jointId, this._constraintAxisToNative(axis), this._limitModeToNative(limitMode));
    }
  }
  /**
   * Gets the axis limit mode of the given constraint.
   *
   * @param constraint - The constraint to get the axis limit mode from.
   * @param axis - The axis to get the limit mode from.
   * @returns The axis limit mode of the given constraint.
   *
   */
  getAxisMode(constraint, axis) {
    const firstId = constraint._pluginData && constraint._pluginData[0];
    if (firstId) {
      const mode = this._hknp.HP_Constraint_GetAxisMode(firstId, this._constraintAxisToNative(axis))[1];
      return this._nativeToLimitMode(mode);
    }
    return null;
  }
  /**
   * Sets the minimum limit of the given axis of the given constraint.
   * @param constraint - The constraint to set the minimum limit of.
   * @param axis - The axis to set the minimum limit of.
   * @param limit - The minimum limit to set.
   *
   */
  setAxisMinLimit(constraint, axis, limit) {
    for (const jointId of constraint._pluginData) {
      this._hknp.HP_Constraint_SetAxisMinLimit(jointId, this._constraintAxisToNative(axis), limit);
    }
  }
  /**
   * Gets the minimum limit of the specified axis of the given constraint.
   * @param constraint - The constraint to get the minimum limit from.
   * @param axis - The axis to get the minimum limit from.
   * @returns The minimum limit of the specified axis of the given constraint.
   *
   */
  getAxisMinLimit(constraint, axis) {
    const firstId = constraint._pluginData && constraint._pluginData[0];
    if (firstId) {
      return this._hknp.HP_Constraint_GetAxisMinLimit(firstId, this._constraintAxisToNative(axis))[1];
    }
    return null;
  }
  /**
   * Sets the maximum limit of the given axis of the given constraint.
   * @param constraint - The constraint to set the maximum limit of the given axis.
   * @param axis - The axis to set the maximum limit of.
   * @param limit - The maximum limit to set.
   *
   */
  setAxisMaxLimit(constraint, axis, limit) {
    for (const jointId of constraint._pluginData) {
      this._hknp.HP_Constraint_SetAxisMaxLimit(jointId, this._constraintAxisToNative(axis), limit);
    }
  }
  /**
   * Gets the maximum limit of the given axis of the given constraint.
   *
   * @param constraint - The constraint to get the maximum limit from.
   * @param axis - The axis to get the maximum limit from.
   * @returns The maximum limit of the given axis of the given constraint.
   *
   */
  getAxisMaxLimit(constraint, axis) {
    const firstId = constraint._pluginData && constraint._pluginData[0];
    if (firstId) {
      return this._hknp.HP_Constraint_GetAxisMaxLimit(firstId, this._constraintAxisToNative(axis))[1];
    }
    return null;
  }
  /**
   * Sets the motor type of the given axis of the given constraint.
   * @param constraint - The constraint to set the motor type of.
   * @param axis - The axis of the constraint to set the motor type of.
   * @param motorType - The motor type to set.
   *
   */
  setAxisMotorType(constraint, axis, motorType) {
    for (const jointId of constraint._pluginData) {
      this._hknp.HP_Constraint_SetAxisMotorType(jointId, this._constraintAxisToNative(axis), this._constraintMotorTypeToNative(motorType));
    }
  }
  /**
   * Gets the motor type of the specified axis of the given constraint.
   * @param constraint - The constraint to get the motor type from.
   * @param axis - The axis of the constraint to get the motor type from.
   * @returns The motor type of the specified axis of the given constraint.
   *
   */
  getAxisMotorType(constraint, axis) {
    const firstId = constraint._pluginData && constraint._pluginData[0];
    if (firstId) {
      return this._nativeToMotorType(this._hknp.HP_Constraint_GetAxisMotorType(firstId, this._constraintAxisToNative(axis))[1]);
    }
    return null;
  }
  /**
   * Sets the target of an axis motor of a constraint.
   *
   * @param constraint - The constraint to set the axis motor target of.
   * @param axis - The axis of the constraint to set the motor target of.
   * @param target - The target of the axis motor.
   *
   */
  setAxisMotorTarget(constraint, axis, target) {
    for (const jointId of constraint._pluginData) {
      this._hknp.HP_Constraint_SetAxisMotorTarget(jointId, this._constraintAxisToNative(axis), target);
    }
  }
  /**
   * Gets the target of the motor of the given axis of the given constraint.
   *
   * @param constraint - The constraint to get the motor target from.
   * @param axis - The axis of the constraint to get the motor target from.
   * @returns The target of the motor of the given axis of the given constraint.
   *
   */
  getAxisMotorTarget(constraint, axis) {
    const firstId = constraint._pluginData && constraint._pluginData[0];
    if (firstId) {
      return this._hknp.HP_Constraint_GetAxisMotorTarget(constraint._pluginData, this._constraintAxisToNative(axis))[1];
    }
    return null;
  }
  /**
   * Sets the maximum force that can be applied by the motor of the given constraint axis.
   * @param constraint - The constraint to set the motor max force for.
   * @param axis - The axis of the constraint to set the motor max force for.
   * @param maxForce - The maximum force that can be applied by the motor.
   *
   */
  setAxisMotorMaxForce(constraint, axis, maxForce) {
    for (const jointId of constraint._pluginData) {
      this._hknp.HP_Constraint_SetAxisMotorMaxForce(jointId, this._constraintAxisToNative(axis), maxForce);
    }
  }
  /**
   * Gets the maximum force of the motor of the given constraint axis.
   *
   * @param constraint - The constraint to get the motor maximum force from.
   * @param axis - The axis of the constraint to get the motor maximum force from.
   * @returns The maximum force of the motor of the given constraint axis.
   *
   */
  getAxisMotorMaxForce(constraint, axis) {
    const firstId = constraint._pluginData && constraint._pluginData[0];
    if (firstId) {
      return this._hknp.HP_Constraint_GetAxisMotorMaxForce(firstId, this._constraintAxisToNative(axis))[1];
    }
    return null;
  }
  /**
   * Disposes a physics constraint.
   *
   * @param constraint - The physics constraint to dispose.
   *
   * This method is useful for releasing the resources associated with a physics constraint, such as
   * the Havok constraint, when it is no longer needed. This is important for avoiding memory leaks.
   */
  disposeConstraint(constraint) {
    for (const jointId of constraint._pluginData) {
      this._hknp.HP_Constraint_SetEnabled(jointId, false);
      this._hknp.HP_Constraint_Release(jointId);
    }
    constraint._pluginData.length = 0;
  }
  _populateHitData(hitData, result) {
    const hitBody = this._bodies.get(hitData[0][0]);
    result.body = hitBody?.body;
    result.bodyIndex = hitBody?.index;
    const hitShape = this._shapes.get(hitData[1][0]);
    result.shape = hitShape;
    const hitPos = hitData[3];
    const hitNormal = hitData[4];
    const hitTriangle = hitData[5];
    const offset = hitBody?.body?._pluginData?.worldRegion?.floatingOrigin ?? this._worldRegions[0].floatingOrigin;
    result.setHitData({ x: hitNormal[0], y: hitNormal[1], z: hitNormal[2] }, { x: hitPos[0] + offset._x, y: hitPos[1] + offset._y, z: hitPos[2] + offset._z }, hitTriangle);
  }
  /**
   * Performs a raycast from a given start point to a given end point and stores the result in a given PhysicsRaycastResult object.
   *
   * @param from - The start point of the raycast.
   * @param to - The end point of the raycast.
   * @param result - The PhysicsRaycastResult object (or array of PhysicsRaycastResults) to store the result of the raycast.
   * @param query - The raycast query options. See [[IRaycastQuery]] for more information.
   *
   * Performs a raycast. It takes in two points, from and to, and a PhysicsRaycastResult object to store the result of the raycast.
   * It then performs the raycast and stores the hit data in the PhysicsRaycastResult object.
   * If result is an empty array, it will be populated with every detected raycast hit.
   * If result is a populated array, it will only fill the PhysicsRaycastResults present in the array.
   */
  raycast(from, to, result, query) {
    const queryMembership = query?.membership ?? -1;
    const queryCollideWith = query?.collideWith ?? -1;
    const shouldHitTriggers = query?.shouldHitTriggers ?? false;
    const bodyToIgnore = query?.ignoreBody ? [BigInt(query.ignoreBody._pluginData.hpBodyId[0])] : [BigInt(0)];
    const results = Array.isArray(result) ? result : [result];
    for (const raycastResult of results) {
      raycastResult.reset(from, to);
    }
    if (this._worldRegions.length === 0) {
      return;
    }
    const worldRegion = query?.ignoreBody?._pluginData?.worldRegion ?? this._worldRegions[0];
    const offset = worldRegion.floatingOrigin;
    const world = worldRegion.world;
    const offsetFrom = this._bVecToV3WithOffset(from, offset);
    const offsetTo = this._bVecToV3WithOffset(to, offset);
    const hkQuery = [offsetFrom, offsetTo, [queryMembership, queryCollideWith], shouldHitTriggers, bodyToIgnore];
    const queryCollector = results.length === 1 || !this._multiQueryCollector ? this._queryCollector : this._multiQueryCollector;
    this._hknp.HP_World_CastRayWithCollector(world, queryCollector, hkQuery);
    const numHits = this._hknp.HP_QueryCollector_GetNumHits(queryCollector)[1];
    if (numHits <= 0) {
      return;
    }
    if (!results.length) {
      for (let i = 0; i < numHits; i++) {
        const raycastResult = new PhysicsRaycastResult();
        raycastResult.reset(from, to);
        results.push(raycastResult);
      }
    }
    const hitDatas = new Array(numHits);
    for (let i = 0; i < numHits; i++) {
      const [, hitData] = this._hknp.HP_QueryCollector_GetCastRayResult(queryCollector, i)[1];
      const hitPos = hitData[3];
      this._tmpVec3[0].set(offsetFrom[0] - hitPos[0], offsetFrom[1] - hitPos[1], offsetFrom[2] - hitPos[2]);
      const distance = this._tmpVec3[0].lengthSquared();
      hitDatas[i] = {
        hitData,
        distance
      };
    }
    hitDatas.sort((a, b) => a.distance - b.distance);
    for (let i = 0; i < Math.min(numHits, results.length); i++) {
      const raycastResult = results[i];
      const hitData = hitDatas[i];
      this._populateHitData(hitData.hitData, raycastResult);
      raycastResult.setHitDistance(Math.sqrt(hitData.distance));
    }
  }
  /**
   * Given a point, returns the closest physics
   * body to that point.
   * @param query the query to perform. @see IPhysicsPointProximityQuery
   * @param result contact point on the hit shape, in world space
   */
  pointProximity(query, result) {
    const queryMembership = query?.collisionFilter?.membership ?? -1;
    const queryCollideWith = query?.collisionFilter?.collideWith ?? -1;
    result.reset();
    const bodyToIgnore = query.ignoreBody ? [BigInt(query.ignoreBody._pluginData.hpBodyId[0])] : [BigInt(0)];
    if (this._worldRegions.length === 0) {
      return;
    }
    const worldRegion = query.ignoreBody?._pluginData?.worldRegion ?? this._worldRegions[0];
    const offset = worldRegion.floatingOrigin;
    const world = worldRegion.world;
    const hkQuery = [this._bVecToV3WithOffset(query.position, offset), query.maxDistance, [queryMembership, queryCollideWith], query.shouldHitTriggers, bodyToIgnore];
    this._hknp.HP_World_PointProximityWithCollector(world, this._queryCollector, hkQuery);
    if (this._hknp.HP_QueryCollector_GetNumHits(this._queryCollector)[1] > 0) {
      const [distance, hitData] = this._hknp.HP_QueryCollector_GetPointProximityResult(this._queryCollector, 0)[1];
      this._populateHitData(hitData, result);
      result.setHitDistance(distance);
    }
  }
  /**
   * Given a shape in a specific position and orientation, returns the closest point to that shape.
   * @param query the query to perform. @see IPhysicsShapeProximityCastQuery
   * @param inputShapeResult contact point on input shape, in input shape space
   * @param hitShapeResult contact point on hit shape, in world space
   */
  shapeProximity(query, inputShapeResult, hitShapeResult) {
    inputShapeResult.reset();
    hitShapeResult.reset();
    const shapeId = query.shape._pluginData;
    const bodyToIgnore = query.ignoreBody ? [BigInt(query.ignoreBody._pluginData.hpBodyId[0])] : [BigInt(0)];
    if (this._worldRegions.length === 0) {
      return;
    }
    const worldRegion = query.ignoreBody?._pluginData?.worldRegion ?? this._worldRegions[0];
    const offset = worldRegion.floatingOrigin;
    const world = worldRegion.world;
    const hkQuery = [shapeId, this._bVecToV3WithOffset(query.position, offset), this._bQuatToV4(query.rotation), query.maxDistance, query.shouldHitTriggers, bodyToIgnore];
    this._hknp.HP_World_ShapeProximityWithCollector(world, this._queryCollector, hkQuery);
    if (this._hknp.HP_QueryCollector_GetNumHits(this._queryCollector)[1] > 0) {
      const [distance, hitInputData, hitShapeData] = this._hknp.HP_QueryCollector_GetShapeProximityResult(this._queryCollector, 0)[1];
      this._populateHitData(hitInputData, inputShapeResult);
      this._populateHitData(hitShapeData, hitShapeResult);
      inputShapeResult.setHitDistance(distance);
      hitShapeResult.setHitDistance(distance);
    }
  }
  /**
   * Given a shape in a specific orientation, cast it from the start to end position specified by the query, and return the first hit.
   * @param query the query to perform. @see IPhysicsShapeCastQuery
   * @param inputShapeResult contact point on input shape, in input shape space
   * @param hitShapeResult contact point on hit shape, in world space
   */
  shapeCast(query, inputShapeResult, hitShapeResult) {
    inputShapeResult.reset();
    hitShapeResult.reset();
    const shapeId = query.shape._pluginData;
    const bodyToIgnore = query.ignoreBody ? [BigInt(query.ignoreBody._pluginData.hpBodyId[0])] : [BigInt(0)];
    if (this._worldRegions.length === 0) {
      return;
    }
    const worldRegion = query.ignoreBody?._pluginData?.worldRegion ?? this._worldRegions[0];
    const offset = worldRegion.floatingOrigin;
    const world = worldRegion.world;
    const hkQuery = [
      shapeId,
      this._bQuatToV4(query.rotation),
      this._bVecToV3WithOffset(query.startPosition, offset),
      this._bVecToV3WithOffset(query.endPosition, offset),
      query.shouldHitTriggers,
      bodyToIgnore
    ];
    this._hknp.HP_World_ShapeCastWithCollector(world, this._queryCollector, hkQuery);
    if (this._hknp.HP_QueryCollector_GetNumHits(this._queryCollector)[1] > 0) {
      const [fractionAlongRay, hitInputData, hitShapeData] = this._hknp.HP_QueryCollector_GetShapeCastResult(this._queryCollector, 0)[1];
      this._populateHitData(hitInputData, inputShapeResult);
      this._populateHitData(hitShapeData, hitShapeResult);
      inputShapeResult.setHitFraction(fractionAlongRay);
      hitShapeResult.setHitFraction(fractionAlongRay);
    }
  }
  /**
   * Return the collision observable for a particular physics body.
   * @param body the physics body
   * @param instanceIndex - optionally, the index of the instance in the body
   * @returns the collision observable for the body
   */
  getCollisionObservable(body, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    const bodyId = pluginRef.hpBodyId[0];
    let observable = this._bodyCollisionObservable.get(bodyId);
    if (!observable) {
      observable = new Observable();
      this._bodyCollisionObservable.set(bodyId, observable);
    }
    return observable;
  }
  /**
   * Return the collision ended observable for a particular physics body.
   * @param body the physics body
   * @param instanceIndex - optionally, the index of the instance in the body
   * @returns the collision ended observable for the body
   */
  getCollisionEndedObservable(body, instanceIndex) {
    const pluginRef = this._getPluginReference(body, instanceIndex);
    const bodyId = pluginRef.hpBodyId[0];
    let observable = this._bodyCollisionEndedObservable.get(bodyId);
    if (!observable) {
      observable = new Observable();
      this._bodyCollisionEndedObservable.set(bodyId, observable);
    }
    return observable;
  }
  /**
   * Enable collision to be reported for a body when a callback is setup on the world
   * @param body the physics body
   * @param enabled whether to enable or disable collision events
   */
  setCollisionCallbackEnabled(body, enabled) {
    const collideEvents = this._hknp.EventType.COLLISION_STARTED.value | this._hknp.EventType.COLLISION_CONTINUED.value | this._hknp.EventType.COLLISION_FINISHED.value;
    if (body._pluginDataInstances && body._pluginDataInstances.length) {
      for (let index = 0; index < body._pluginDataInstances.length; index++) {
        const bodyId = body._pluginDataInstances[index];
        this._hknp.HP_Body_SetEventMask(bodyId.hpBodyId, enabled ? collideEvents : 0);
      }
    } else if (body._pluginData) {
      this._hknp.HP_Body_SetEventMask(body._pluginData.hpBodyId, enabled ? collideEvents : 0);
    }
  }
  /**
   * Enable collision ended to be reported for a body when a callback is setup on the world
   * @param body the physics body
   * @param enabled whether to enable or disable collision ended events
   */
  setCollisionEndedCallbackEnabled(body, enabled) {
    const pluginRef = this._getPluginReference(body);
    let currentCollideEvents = this._hknp.HP_Body_GetEventMask(pluginRef.hpBodyId)[1];
    currentCollideEvents = enabled ? currentCollideEvents | this._hknp.EventType.COLLISION_FINISHED.value : currentCollideEvents & ~this._hknp.EventType.COLLISION_FINISHED.value;
    if (body._pluginDataInstances && body._pluginDataInstances.length) {
      for (let index = 0; index < body._pluginDataInstances.length; index++) {
        const bodyId = body._pluginDataInstances[index];
        this._hknp.HP_Body_SetEventMask(bodyId.hpBodyId, currentCollideEvents);
      }
    } else if (body._pluginData) {
      this._hknp.HP_Body_SetEventMask(body._pluginData.hpBodyId, currentCollideEvents);
    }
  }
  _notifyTriggers(world) {
    const targetWorld = world ?? this.world;
    let eventAddress = this._hknp.HP_World_GetTriggerEvents(targetWorld)[1];
    const event = new TriggerEvent();
    while (eventAddress) {
      TriggerEvent.readToRef(this._hknp.HEAPU8.buffer, eventAddress, event);
      const bodyInfoA = this._bodies.get(event.bodyIdA);
      const bodyInfoB = this._bodies.get(event.bodyIdB);
      if (bodyInfoA && bodyInfoB) {
        const triggerCollisionInfo = {
          collider: bodyInfoA.body,
          colliderIndex: bodyInfoA.index,
          collidedAgainst: bodyInfoB.body,
          collidedAgainstIndex: bodyInfoB.index,
          type: this._nativeTriggerCollisionValueToCollisionType(event.type)
        };
        this.onTriggerCollisionObservable.notifyObservers(triggerCollisionInfo);
      }
      eventAddress = this._hknp.HP_World_GetNextTriggerEvent(targetWorld, eventAddress);
    }
  }
  /**
   * Runs thru all detected collisions and filter by body
   * @param world optional world to check collisions for (defaults to main world)
   */
  _notifyCollisions(world) {
    const targetWorld = world ?? this.world;
    let eventAddress = this._hknp.HP_World_GetCollisionEvents(targetWorld)[1];
    const event = new CollisionEvent();
    const worldAddr = Number(targetWorld);
    const region = this._worldRegions.find((r) => Number(r.world) === worldAddr) ?? this._worldRegions[0];
    const regionOffset = region.floatingOrigin;
    while (eventAddress) {
      CollisionEvent.readToRef(this._hknp.HEAPU8.buffer, eventAddress, event);
      const bodyInfoA = this._bodies.get(event.contactOnA.bodyId);
      const bodyInfoB = this._bodies.get(event.contactOnB.bodyId);
      event.contactOnA.position.addInPlace(regionOffset);
      event.contactOnB.position.addInPlace(regionOffset);
      if (bodyInfoA && bodyInfoB) {
        const collisionInfo = {
          collider: bodyInfoA.body,
          colliderIndex: bodyInfoA.index,
          collidedAgainst: bodyInfoB.body,
          collidedAgainstIndex: bodyInfoB.index,
          type: this._nativeCollisionValueToCollisionType(event.type)
        };
        if (collisionInfo.type === "COLLISION_FINISHED") {
          this.onCollisionEndedObservable.notifyObservers(collisionInfo);
        } else {
          event.contactOnB.position.subtractToRef(event.contactOnA.position, this._tmpVec3[0]);
          const distance = Vector3.Dot(this._tmpVec3[0], event.contactOnA.normal);
          collisionInfo.point = event.contactOnA.position;
          collisionInfo.distance = distance;
          collisionInfo.impulse = event.impulseApplied;
          collisionInfo.normal = event.contactOnA.normal;
          this.onCollisionObservable.notifyObservers(collisionInfo);
        }
        if (this._bodyCollisionObservable.size && collisionInfo.type !== "COLLISION_FINISHED") {
          const observableA = this._bodyCollisionObservable.get(event.contactOnA.bodyId);
          const observableB = this._bodyCollisionObservable.get(event.contactOnB.bodyId);
          event.contactOnA.position.subtractToRef(event.contactOnB.position, this._tmpVec3[0]);
          const distance = Vector3.Dot(this._tmpVec3[0], event.contactOnB.normal);
          if (observableA) {
            observableA.notifyObservers(collisionInfo);
          }
          if (observableB) {
            const collisionInfoB = {
              collider: bodyInfoB.body,
              colliderIndex: bodyInfoB.index,
              collidedAgainst: bodyInfoA.body,
              collidedAgainstIndex: bodyInfoA.index,
              point: event.contactOnB.position,
              distance,
              impulse: event.impulseApplied,
              normal: event.contactOnB.normal,
              type: this._nativeCollisionValueToCollisionType(event.type)
            };
            observableB.notifyObservers(collisionInfoB);
          }
        } else if (this._bodyCollisionEndedObservable.size) {
          const observableA = this._bodyCollisionEndedObservable.get(event.contactOnA.bodyId);
          const observableB = this._bodyCollisionEndedObservable.get(event.contactOnB.bodyId);
          event.contactOnA.position.subtractToRef(event.contactOnB.position, this._tmpVec3[0]);
          const distance = Vector3.Dot(this._tmpVec3[0], event.contactOnB.normal);
          if (observableA) {
            observableA.notifyObservers(collisionInfo);
          }
          if (observableB) {
            const collisionInfoB = {
              collider: bodyInfoB.body,
              colliderIndex: bodyInfoB.index,
              collidedAgainst: bodyInfoA.body,
              collidedAgainstIndex: bodyInfoA.index,
              point: event.contactOnB.position,
              distance,
              impulse: event.impulseApplied,
              normal: event.contactOnB.normal,
              type: this._nativeCollisionValueToCollisionType(event.type)
            };
            observableB.notifyObservers(collisionInfoB);
          }
        }
      }
      eventAddress = this._hknp.HP_World_GetNextCollisionEvent(worldAddr, eventAddress);
    }
  }
  /**
   * Gets the number of bodies in the world
   */
  get numBodies() {
    return this._hknp.HP_World_GetNumBodies(this.world)[1];
  }
  /**
   * Dispose the world and free resources
   */
  dispose() {
    if (this._queryCollector) {
      this._hknp.HP_QueryCollector_Release(this._queryCollector);
      this._queryCollector = void 0;
    }
    if (this._multiQueryCollector) {
      this._hknp.HP_QueryCollector_Release(this._multiQueryCollector);
      this._multiQueryCollector = void 0;
    }
    for (const region of this._worldRegions) {
      if (region.world) {
        this._hknp.HP_World_Release(region.world);
      }
    }
    this._worldRegions.length = 0;
    this._worldRegionsPendingRelease.clear();
    this.world = void 0;
  }
  _v3ToBvecRef(v, vec3) {
    vec3.set(v[0], v[1], v[2]);
  }
  _bVecToV3(v) {
    return [v._x, v._y, v._z];
  }
  /**
   * Converts a Vector3 to Havok format with floating origin offset subtracted.
   * Use this for world-space positions being sent to Havok.
   * @param v - The vector to convert
   * @param offset - Optional offset to use. If not provided, no offset is applied.
   * @returns The converted vector
   */
  _bVecToV3WithOffset(v, offset) {
    if (offset) {
      return [v._x - offset._x, v._y - offset._y, v._z - offset._z];
    }
    return [v._x, v._y, v._z];
  }
  _bQuatToV4(q) {
    return [q._x, q._y, q._z, q._w];
  }
  _constraintMotorTypeToNative(motorType) {
    switch (motorType) {
      case 2:
        return this._hknp.ConstraintMotorType.POSITION;
      case 1:
        return this._hknp.ConstraintMotorType.VELOCITY;
    }
    return this._hknp.ConstraintMotorType.NONE;
  }
  _nativeToMotorType(motorType) {
    switch (motorType) {
      case this._hknp.ConstraintMotorType.POSITION:
        return 2;
      case this._hknp.ConstraintMotorType.VELOCITY:
        return 1;
    }
    return 0;
  }
  _materialCombineToNative(mat) {
    switch (mat) {
      case 0:
        return this._hknp.MaterialCombine.GEOMETRIC_MEAN;
      case 1:
        return this._hknp.MaterialCombine.MINIMUM;
      case 2:
        return this._hknp.MaterialCombine.MAXIMUM;
      case 3:
        return this._hknp.MaterialCombine.ARITHMETIC_MEAN;
      case 4:
        return this._hknp.MaterialCombine.MULTIPLY;
    }
  }
  _nativeToMaterialCombine(mat) {
    switch (mat) {
      case this._hknp.MaterialCombine.GEOMETRIC_MEAN:
        return 0;
      case this._hknp.MaterialCombine.MINIMUM:
        return 1;
      case this._hknp.MaterialCombine.MAXIMUM:
        return 2;
      case this._hknp.MaterialCombine.ARITHMETIC_MEAN:
        return 3;
      case this._hknp.MaterialCombine.MULTIPLY:
        return 4;
      default:
        return void 0;
    }
  }
  _constraintAxisToNative(axId) {
    switch (axId) {
      case 0:
        return this._hknp.ConstraintAxis.LINEAR_X;
      case 1:
        return this._hknp.ConstraintAxis.LINEAR_Y;
      case 2:
        return this._hknp.ConstraintAxis.LINEAR_Z;
      case 3:
        return this._hknp.ConstraintAxis.ANGULAR_X;
      case 4:
        return this._hknp.ConstraintAxis.ANGULAR_Y;
      case 5:
        return this._hknp.ConstraintAxis.ANGULAR_Z;
      case 6:
        return this._hknp.ConstraintAxis.LINEAR_DISTANCE;
    }
  }
  _nativeToLimitMode(mode) {
    switch (mode) {
      case this._hknp.ConstraintAxisLimitMode.FREE:
        return 0;
      case this._hknp.ConstraintAxisLimitMode.LIMITED:
        return 1;
      case this._hknp.ConstraintAxisLimitMode.LOCKED:
        return 2;
    }
    return 0;
  }
  _limitModeToNative(mode) {
    switch (mode) {
      case 0:
        return this._hknp.ConstraintAxisLimitMode.FREE;
      case 1:
        return this._hknp.ConstraintAxisLimitMode.LIMITED;
      case 2:
        return this._hknp.ConstraintAxisLimitMode.LOCKED;
    }
  }
  _nativeCollisionValueToCollisionType(type) {
    switch (type) {
      case this._hknp.EventType.COLLISION_STARTED.value:
        return "COLLISION_STARTED";
      case this._hknp.EventType.COLLISION_FINISHED.value:
        return "COLLISION_FINISHED";
      case this._hknp.EventType.COLLISION_CONTINUED.value:
        return "COLLISION_CONTINUED";
    }
    return "COLLISION_STARTED";
  }
  _nativeTriggerCollisionValueToCollisionType(type) {
    switch (type) {
      case 8:
        return "TRIGGER_ENTERED";
      case 16:
        return "TRIGGER_EXITED";
    }
    return "TRIGGER_ENTERED";
  }
}
class PhysicsBody {
  /**
   * Disable pre-step that consists in updating Physics Body from Transform Node Translation/Orientation.
   * True by default for maximum performance.
   */
  get disablePreStep() {
    return this._prestepType == PhysicsPrestepType.DISABLED;
  }
  set disablePreStep(value) {
    this._prestepType = value ? PhysicsPrestepType.DISABLED : PhysicsPrestepType.TELEPORT;
  }
  /**
   * Constructs a new physics body for the given node.
   * @param transformNode - The Transform Node to construct the physics body for. For better performance, it is advised that this node does not have a parent.
   * @param motionType - The motion type of the physics body. The options are:
   *  - PhysicsMotionType.STATIC - Static bodies are not moving and unaffected by forces or collisions. They are good for level boundaries or terrain.
   *  - PhysicsMotionType.DYNAMIC - Dynamic bodies are fully simulated. They can move and collide with other objects.
   *  - PhysicsMotionType.ANIMATED - They behave like dynamic bodies, but they won't be affected by other bodies, but still push other bodies out of the way.
   * @param startsAsleep - Whether the physics body should start in a sleeping state (not a guarantee). Defaults to false.
   * @param scene - The scene containing the physics engine.
   *
   * This code is useful for creating a physics body for a given Transform Node in a scene.
   * It checks the version of the physics engine and the physics plugin, and initializes the body accordingly.
   * It also sets the node's rotation quaternion if it is not already set. Finally, it adds the body to the physics engine.
   */
  constructor(transformNode, motionType, startsAsleep, scene) {
    this._pluginData = void 0;
    this._pluginDataInstances = [];
    this._collisionCBEnabled = false;
    this._collisionEndedCBEnabled = false;
    this.disableSync = false;
    this._isDisposed = false;
    this._shape = null;
    this._prestepType = PhysicsPrestepType.DISABLED;
    if (!scene) {
      return;
    }
    const physicsEngine = scene.getPhysicsEngine();
    if (!physicsEngine) {
      throw new Error("No Physics Engine available.");
    }
    this._physicsEngine = physicsEngine;
    if (physicsEngine.getPluginVersion() != 2) {
      throw new Error("Plugin version is incorrect. Expected version 2.");
    }
    const physicsPlugin = physicsEngine.getPhysicsPlugin();
    if (!physicsPlugin) {
      throw new Error("No Physics Plugin available.");
    }
    this._physicsPlugin = physicsPlugin;
    if (!transformNode.rotationQuaternion) {
      transformNode.rotationQuaternion = Quaternion.FromEulerAngles(transformNode.rotation.x, transformNode.rotation.y, transformNode.rotation.z);
    }
    this.startAsleep = startsAsleep;
    this.disableSync = motionType == 0;
    const m = transformNode;
    if (m.hasThinInstances) {
      this._physicsPlugin.initBodyInstances(this, motionType, m);
    } else {
      if (transformNode.parent) {
        transformNode.computeWorldMatrix(true);
      }
      this._physicsPlugin.initBody(this, motionType, transformNode.absolutePosition, transformNode.absoluteRotationQuaternion);
    }
    this.transformNode = transformNode;
    transformNode.physicsBody = this;
    physicsEngine.addBody(this);
    this._nodeDisposeObserver = transformNode.onDisposeObservable.add(() => {
      this.dispose();
    });
  }
  /**
   * Returns the string "PhysicsBody".
   * @returns "PhysicsBody"
   */
  getClassName() {
    return "PhysicsBody";
  }
  /**
   * Clone the PhysicsBody to a new body and assign it to the transformNode parameter
   * @param transformNode transformNode that will be used for the cloned PhysicsBody
   * @returns the newly cloned PhysicsBody
   */
  clone(transformNode) {
    const clonedBody = new PhysicsBody(transformNode, this.getMotionType(), this.startAsleep, this.transformNode.getScene());
    clonedBody.shape = this.shape;
    clonedBody.setMassProperties(this.getMassProperties());
    clonedBody.setLinearDamping(this.getLinearDamping());
    clonedBody.setAngularDamping(this.getAngularDamping());
    return clonedBody;
  }
  /**
   * If a physics body is connected to an instanced node, update the number physic instances to match the number of node instances.
   */
  updateBodyInstances() {
    const m = this.transformNode;
    if (m.hasThinInstances) {
      this._physicsPlugin.updateBodyInstances(this, m);
    }
  }
  /**
   * This returns the number of internal instances of the physics body
   */
  get numInstances() {
    return this._pluginDataInstances.length;
  }
  /**
   * Get the motion type of the physics body. Can be STATIC, DYNAMIC, or ANIMATED.
   */
  get motionType() {
    return this._physicsPlugin.getMotionType(this);
  }
  /**
   * Sets the shape of the physics body.
   * @param shape - The shape of the physics body.
   *
   * This method is useful for setting the shape of the physics body, which is necessary for the physics engine to accurately simulate the body's behavior.
   * The shape is used to calculate the body's mass, inertia, and other properties.
   */
  set shape(shape) {
    this._shape = shape;
    if (shape) {
      this._physicsPlugin.setShape(this, shape);
    }
  }
  /**
   * Retrieves the physics shape associated with this object.
   *
   * @returns The physics shape associated with this object, or `undefined` if no
   * shape is associated.
   *
   * This method is useful for retrieving the physics shape associated with this object,
   * which can be used to apply physical forces to the object or to detect collisions.
   */
  get shape() {
    return this._shape;
  }
  /**
   * Returns the bounding box of the physics body.
   * @returns The bounding box of the physics body.
   */
  getBoundingBox() {
    return this._physicsPlugin.getBodyBoundingBox(this);
  }
  /**
   * Sets the event mask for the physics engine.
   *
   * @param eventMask - A bitmask that determines which events will be sent to the physics engine.
   * @param instanceIndex - If this body is instanced, the index of the instance to set the event mask for.
   *
   * This method is useful for setting the event mask for the physics engine, which determines which events
   * will be sent to the physics engine. This allows the user to control which events the physics engine will respond to.
   */
  setEventMask(eventMask, instanceIndex) {
    this._physicsPlugin.setEventMask(this, eventMask, instanceIndex);
  }
  /**
   * Gets the event mask of the physics engine.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the event mask for.
   * @returns The event mask of the physics engine.
   *
   * This method is useful for getting the event mask of the physics engine,
   * which is used to determine which events the engine will respond to.
   * This is important for ensuring that the engine is responding to the correct events and not
   * wasting resources on unnecessary events.
   */
  getEventMask(instanceIndex) {
    return this._physicsPlugin.getEventMask(this, instanceIndex);
  }
  /**
   * Sets the motion type of the physics body. Can be STATIC, DYNAMIC, or ANIMATED.
   * @param motionType - The motion type to set.
   * @param instanceIndex - If this body is instanced, the index of the instance to set the motion type for. If body is instanced but instanceIndex is undefined, the motion type will be set for all instances.
   */
  setMotionType(motionType, instanceIndex) {
    this.disableSync = instanceIndex === void 0 && motionType == 0;
    this._physicsPlugin.setMotionType(this, motionType, instanceIndex);
  }
  /**
   * Gets the motion type of the physics body. Can be STATIC, DYNAMIC, or ANIMATED.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the motion type for.
   * @returns The motion type of the physics body.
   */
  getMotionType(instanceIndex) {
    return this._physicsPlugin.getMotionType(this, instanceIndex);
  }
  /**
   * Set the prestep type of the body
   * @param prestepType prestep type provided by PhysicsPrestepType
   */
  setPrestepType(prestepType) {
    this._prestepType = prestepType;
  }
  /**
   * Get the current prestep type of the body
   * @returns the type of prestep associated with the body and its instance index
   */
  getPrestepType() {
    return this._prestepType;
  }
  /**
   * Computes the mass properties of the physics object, based on the set of physics shapes this body uses.
   * This method is useful for computing the initial mass properties of a physics object, such as its mass,
   * inertia, and center of mass; these values are important for accurately simulating the physics of the
   * object in the physics engine, and computing values based on the shape will provide you with reasonable
   * initial values, which you can then customize.
   * @param instanceIndex - The index of the instance to compute the mass properties for.
   * @returns The mass properties of the object.
   */
  computeMassProperties(instanceIndex) {
    return this._physicsPlugin.computeMassProperties(this, instanceIndex);
  }
  /**
   * Sets the mass properties of the physics object.
   *
   * @param massProps - The mass properties to set.
   * @param instanceIndex - The index of the instance to set the mass properties for. If not defined, the mass properties will be set for all instances.
   *
   * This method is useful for setting the mass properties of a physics object, such as its mass,
   * inertia, and center of mass. This is important for accurately simulating the physics of the object in the physics engine.
   */
  setMassProperties(massProps, instanceIndex) {
    this._physicsPlugin.setMassProperties(this, massProps, instanceIndex);
  }
  /**
   * Retrieves the mass properties of the object.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the mass properties for.
   * @returns The mass properties of the object.
   *
   * This method is useful for physics simulations, as it allows the user to
   * retrieve the mass properties of the object, such as its mass, center of mass,
   * and moment of inertia. This information is necessary for accurate physics
   * simulations.
   */
  getMassProperties(instanceIndex) {
    return this._physicsPlugin.getMassProperties(this, instanceIndex);
  }
  /**
   * Sets the linear damping of the physics body.
   *
   * @param damping - The linear damping value.
   * @param instanceIndex - If this body is instanced, the index of the instance to set the linear damping for.
   *
   * This method is useful for controlling the linear damping of the physics body,
   * which is the rate at which the body's velocity decreases over time. This is useful for simulating
   * the effects of air resistance or other forms of friction.
   */
  setLinearDamping(damping, instanceIndex) {
    this._physicsPlugin.setLinearDamping(this, damping, instanceIndex);
  }
  /**
   * Gets the linear damping of the physics body.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the linear damping for.
   * @returns The linear damping of the physics body.
   *
   * This method is useful for retrieving the linear damping of the physics body, which is the amount of
   * resistance the body has to linear motion. This is useful for simulating realistic physics behavior
   * in a game.
   */
  getLinearDamping(instanceIndex) {
    return this._physicsPlugin.getLinearDamping(this, instanceIndex);
  }
  /**
   * Sets the angular damping of the physics body.
   * @param damping The angular damping of the body.
   * @param instanceIndex - If this body is instanced, the index of the instance to set the angular damping for.
   *
   * This method is useful for controlling the angular velocity of a physics body.
   * By setting the damping, the body's angular velocity will be reduced over time, simulating the effect of friction.
   * This can be used to create realistic physical behavior in a physics engine.
   */
  setAngularDamping(damping, instanceIndex) {
    this._physicsPlugin.setAngularDamping(this, damping, instanceIndex);
  }
  /**
   * Gets the angular damping of the physics body.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the angular damping for.
   *
   * @returns The angular damping of the physics body.
   *
   * This method is useful for getting the angular damping of the physics body,
   * which is the rate of reduction of the angular velocity over time.
   * This is important for simulating realistic physics behavior in a game.
   */
  getAngularDamping(instanceIndex) {
    return this._physicsPlugin.getAngularDamping(this, instanceIndex);
  }
  /**
   * Sets the linear velocity of the physics object.
   * @param linVel - The linear velocity to set.
   * @param instanceIndex - If this body is instanced, the index of the instance to set the linear velocity for.
   *
   * This method is useful for setting the linear velocity of a physics object,
   * which is necessary for simulating realistic physics in a game engine.
   * By setting the linear velocity, the physics object will move in the direction and speed specified by the vector.
   * This allows for realistic physics simulations, such as simulating the motion of a ball rolling down a hill.
   */
  setLinearVelocity(linVel, instanceIndex) {
    this._physicsPlugin.setLinearVelocity(this, linVel, instanceIndex);
  }
  /**
   * Gets the linear velocity of the physics body and stores it in the given vector3.
   * @param linVel - The vector3 to store the linear velocity in.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the linear velocity for.
   *
   * This method is useful for getting the linear velocity of a physics body in a physics engine.
   * This can be used to determine the speed and direction of the body, which can be used to calculate the motion of the body.
   */
  getLinearVelocityToRef(linVel, instanceIndex) {
    this._physicsPlugin.getLinearVelocityToRef(this, linVel, instanceIndex);
  }
  /**
   * Gets the linear velocity of the physics body as a new vector3.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the linear velocity for.
   * @returns The linear velocity of the physics body.
   *
   * This method is useful for getting the linear velocity of a physics body in a physics engine.
   * This can be used to determine the speed and direction of the body, which can be used to calculate the motion of the body.
   */
  getLinearVelocity(instanceIndex) {
    const ref = new Vector3();
    this.getLinearVelocityToRef(ref, instanceIndex);
    return ref;
  }
  /**
   * Sets the angular velocity of the physics object.
   * @param angVel - The angular velocity to set.
   * @param instanceIndex - If this body is instanced, the index of the instance to set the angular velocity for.
   *
   * This method is useful for setting the angular velocity of a physics object, which is necessary for
   * simulating realistic physics behavior. The angular velocity is used to determine the rate of rotation of the object,
   * which is important for simulating realistic motion.
   */
  setAngularVelocity(angVel, instanceIndex) {
    this._physicsPlugin.setAngularVelocity(this, angVel, instanceIndex);
  }
  /**
   * Gets the angular velocity of the physics body and stores it in the given vector3.
   * @param angVel - The vector3 to store the angular velocity in.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the angular velocity for.
   *
   * This method is useful for getting the angular velocity of a physics body, which can be used to determine the body's
   * rotational speed. This information can be used to create realistic physics simulations.
   */
  getAngularVelocityToRef(angVel, instanceIndex) {
    this._physicsPlugin.getAngularVelocityToRef(this, angVel, instanceIndex);
  }
  /**
   * Gets the angular velocity of the physics body as a new vector3.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the angular velocity for.
   * @returns The angular velocity of the physics body.
   *
   * This method is useful for getting the angular velocity of a physics body, which can be used to determine the body's
   * rotational speed. This information can be used to create realistic physics simulations.
   */
  getAngularVelocity(instanceIndex) {
    const ref = new Vector3();
    this.getAngularVelocityToRef(ref, instanceIndex);
    return ref;
  }
  /**
   * Applies an impulse to the physics object.
   *
   * @param impulse The impulse vector.
   * @param location The location of the impulse.
   * @param instanceIndex For a instanced body, the instance to where the impulse should be applied. If not specified, the impulse is applied to all instances.
   *
   * This method is useful for applying an impulse to a physics object, which can be used to simulate physical forces such as gravity,
   * collisions, and explosions. This can be used to create realistic physics simulations in a game or other application.
   */
  applyImpulse(impulse, location, instanceIndex) {
    this._physicsPlugin.applyImpulse(this, impulse, location, instanceIndex);
  }
  /**
   * Add torque to a physics body
   * @param angularImpulse The angular impulse vector.
   * @param instanceIndex For a instanced body, the instance to where the impulse should be applied. If not specified, the impulse is applied to all instances.
   */
  applyAngularImpulse(angularImpulse, instanceIndex) {
    this._physicsPlugin.applyAngularImpulse(this, angularImpulse, instanceIndex);
  }
  /**
   * Applies a torque to the physics body.
   *
   * @param torque The torque vector.
   * @param instanceIndex For a instanced body, the instance to where the torque should be applied. If not specified, the torque is applied to all instances.
   *
   * This method is useful for applying a torque to a physics body, which can be used to simulate rotational forces such as motors,
   * angular momentum, and rotational dynamics. This can be used to create realistic physics simulations in a game or other application.
   */
  applyTorque(torque, instanceIndex) {
    this._physicsPlugin.applyTorque(this, torque, instanceIndex);
  }
  /**
   * Applies a force to the physics object.
   *
   * @param force The force vector.
   * @param location The location of the force.
   * @param instanceIndex For a instanced body, the instance to where the force should be applied. If not specified, the force is applied to all instances.
   *
   * This method is useful for applying a force to a physics object, which can be used to simulate physical forces such as gravity,
   * collisions, and explosions. This can be used to create realistic physics simulations in a game or other application.
   */
  applyForce(force, location, instanceIndex) {
    this._physicsPlugin.applyForce(this, force, location, instanceIndex);
  }
  /**
   * Retrieves the geometry of the body from the physics plugin.
   *
   * @returns The geometry of the body.
   *
   * This method is useful for retrieving the geometry of the body from the physics plugin, which can be used for various physics calculations.
   */
  getGeometry() {
    return this._physicsPlugin.getBodyGeometry(this);
  }
  /**
   * Returns an observable that will be notified for when a collision starts or continues for this PhysicsBody
   * @param instanceIndex - optionally, the index of the instance in the body
   * @returns Observable
   */
  getCollisionObservable(instanceIndex) {
    return this._physicsPlugin.getCollisionObservable(this, instanceIndex);
  }
  /**
   * Returns an observable that will be notified when the body has finished colliding with another body
   * @param instanceIndex - optionally, the index of the instance in the body
   * @returns Observable
   */
  getCollisionEndedObservable(instanceIndex) {
    return this._physicsPlugin.getCollisionEndedObservable(this, instanceIndex);
  }
  /**
   * Enable or disable collision callback for this PhysicsBody.
   * @param enabled true if PhysicsBody's collision will rise a collision event and notifies the observable
   */
  setCollisionCallbackEnabled(enabled) {
    this._collisionCBEnabled = enabled;
    this._physicsPlugin.setCollisionCallbackEnabled(this, enabled);
  }
  /**
   * Enable or disable collision ended callback for this PhysicsBody.
   * @param enabled true if PhysicsBody's collision ended will rise a collision event and notifies the observable
   */
  setCollisionEndedCallbackEnabled(enabled) {
    this._collisionEndedCBEnabled = enabled;
    this._physicsPlugin.setCollisionEndedCallbackEnabled(this, enabled);
  }
  /**
   * Get the center of the object in world space.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the center for.
   * @returns geometric center of the associated mesh
   */
  getObjectCenterWorld(instanceIndex) {
    const ref = new Vector3();
    return this.getObjectCenterWorldToRef(ref, instanceIndex);
  }
  /**
   * Get the center of the object in world space.
   * @param ref - The vector3 to store the result in.
   * @param instanceIndex - If this body is instanced, the index of the instance to get the center for.
   * @returns geometric center of the associated mesh
   */
  getObjectCenterWorldToRef(ref, instanceIndex) {
    if (this._pluginDataInstances?.length > 0) {
      const index = instanceIndex || 0;
      const matrixData = this.transformNode._thinInstanceDataStorage.matrixData;
      if (matrixData) {
        ref.set(matrixData[index * 16 + 12], matrixData[index * 16 + 13], matrixData[index * 16 + 14]);
      }
    } else {
      ref.copyFrom(this.transformNode.position);
    }
    return ref;
  }
  /**
   * Adds a constraint to the physics engine.
   *
   * @param childBody - The body to which the constraint will be applied.
   * @param constraint - The constraint to be applied.
   * @param instanceIndex - If this body is instanced, the index of the instance to which the constraint will be applied. If not specified, no constraint will be applied.
   * @param childInstanceIndex - If the child body is instanced, the index of the instance to which the constraint will be applied. If not specified, no constraint will be applied.
   *
   */
  addConstraint(childBody, constraint, instanceIndex, childInstanceIndex) {
    this._physicsPlugin.addConstraint(this, childBody, constraint, instanceIndex, childInstanceIndex);
  }
  /**
   * Sync with a bone
   * @param bone The bone that the impostor will be synced to.
   * @param boneMesh The mesh that the bone is influencing.
   * @param jointPivot The pivot of the joint / bone in local space.
   * @param distToJoint Optional distance from the impostor to the joint.
   * @param adjustRotation Optional quaternion for adjusting the local rotation of the bone.
   * @param boneAxis Optional vector3 axis the bone is aligned with
   */
  syncWithBone(bone, boneMesh, jointPivot, distToJoint, adjustRotation, boneAxis) {
    const mesh = this.transformNode;
    if (mesh.rotationQuaternion) {
      if (adjustRotation) {
        const tempQuat = TmpVectors.Quaternion[0];
        bone.getRotationQuaternionToRef(1, boneMesh, tempQuat);
        tempQuat.multiplyToRef(adjustRotation, mesh.rotationQuaternion);
      } else {
        bone.getRotationQuaternionToRef(1, boneMesh, mesh.rotationQuaternion);
      }
    }
    const pos = TmpVectors.Vector3[0];
    const boneDir = TmpVectors.Vector3[1];
    if (!boneAxis) {
      boneAxis = TmpVectors.Vector3[2];
      boneAxis.x = 0;
      boneAxis.y = 1;
      boneAxis.z = 0;
    }
    bone.getDirectionToRef(boneAxis, boneMesh, boneDir);
    bone.getAbsolutePositionToRef(boneMesh, pos);
    if ((distToJoint === void 0 || distToJoint === null) && jointPivot) {
      distToJoint = jointPivot.length();
    }
    if (distToJoint !== void 0 && distToJoint !== null) {
      pos.x += boneDir.x * distToJoint;
      pos.y += boneDir.y * distToJoint;
      pos.z += boneDir.z * distToJoint;
    }
    mesh.setAbsolutePosition(pos);
  }
  /**
   * Executes a callback on the body or all of the instances of a body
   * @param callback the callback to execute
   */
  iterateOverAllInstances(callback) {
    if (this._pluginDataInstances?.length > 0) {
      for (let i = 0; i < this._pluginDataInstances.length; i++) {
        callback(this, i);
      }
    } else {
      callback(this, void 0);
    }
  }
  /**
   * Sets the gravity factor of the physics body
   * @param factor the gravity factor to set
   * @param instanceIndex the instance of the body to set, if undefined all instances will be set
   */
  setGravityFactor(factor, instanceIndex) {
    this._physicsPlugin.setGravityFactor(this, factor, instanceIndex);
  }
  /**
   * Gets the gravity factor of the physics body
   * @param instanceIndex the instance of the body to get, if undefined the value of first instance will be returned
   * @returns the gravity factor
   */
  getGravityFactor(instanceIndex) {
    return this._physicsPlugin.getGravityFactor(this, instanceIndex);
  }
  /**
   * Set the target transformation (position and rotation) of the body, such that the body will set its velocity to reach that target
   * @param position The target position
   * @param rotation The target rotation
   * @param instanceIndex The index of the instance in an instanced body
   */
  setTargetTransform(position, rotation, instanceIndex) {
    this._physicsPlugin.setTargetTransform(this, position, rotation, instanceIndex);
  }
  /**
   * Returns if the body has been disposed.
   * @returns true if disposed, false otherwise.
   */
  get isDisposed() {
    return this._isDisposed;
  }
  /**
   * Disposes the body from the physics engine.
   *
   * This method is useful for cleaning up the physics engine when a body is no longer needed. Disposing the body will free up resources and prevent memory leaks.
   */
  dispose() {
    if (this._isDisposed) {
      return;
    }
    if (this._collisionCBEnabled) {
      this.setCollisionCallbackEnabled(false);
    }
    if (this._collisionEndedCBEnabled) {
      this.setCollisionEndedCallbackEnabled(false);
    }
    if (this._nodeDisposeObserver) {
      this.transformNode.onDisposeObservable.remove(this._nodeDisposeObserver);
      this._nodeDisposeObserver = null;
    }
    this._physicsEngine.removeBody(this);
    this._physicsPlugin.removeBody(this);
    this._physicsPlugin.disposeBody(this);
    this.transformNode.physicsBody = null;
    this._pluginData = null;
    this._pluginDataInstances.length = 0;
    this._isDisposed = true;
    this.shape = null;
  }
}
class PhysicsAggregate {
  constructor(transformNode, type, options = { mass: 0 }, _scene) {
    this.transformNode = transformNode;
    this.type = type;
    this._scene = _scene;
    this._disposeShapeWhenDisposed = true;
    this._options = { ...options };
    if (!this.transformNode) {
      Logger.Error("No object was provided. A physics object is obligatory");
      return;
    }
    const m = transformNode;
    if (this.transformNode.parent && this._options.mass !== 0 && m.hasThinInstances) {
      Logger.Warn("A physics body has been created for an object which has a parent and thin instances. Babylon physics currently works in local space so unexpected issues may occur.");
    }
    if (!this._scene && transformNode.getScene) {
      this._scene = transformNode.getScene();
    }
    if (!this._scene) {
      return;
    }
    this._options.mass = this._options.mass === void 0 ? 0 : this._options.mass;
    this._options.friction = this._options.friction === void 0 ? 0.2 : this._options.friction;
    this._options.restitution = this._options.restitution === void 0 ? 0.2 : this._options.restitution;
    const motionType = this._options.mass === 0 ? 0 : 2;
    const startAsleep = this._options.startAsleep ?? false;
    this.body = new PhysicsBody(transformNode, motionType, startAsleep, this._scene);
    this._addSizeOptions();
    if (type.getClassName && type.getClassName() === "PhysicsShape") {
      this.shape = type;
      this._disposeShapeWhenDisposed = false;
    } else {
      this.shape = new PhysicsShape({ type, parameters: this._options }, this._scene);
    }
    if (this._options.isTriggerShape) {
      this.shape.isTrigger = true;
    }
    this.material = { friction: this._options.friction, restitution: this._options.restitution };
    this.body.shape = this.shape;
    this.shape.material = this.material;
    this.body.setMassProperties({ mass: this._options.mass });
    this._nodeDisposeObserver = this.transformNode.onDisposeObservable.add(() => {
      this.dispose();
    });
  }
  _getObjectBoundingBox() {
    if (this.transformNode.getRawBoundingInfo) {
      return this.transformNode.getRawBoundingInfo().boundingBox;
    } else {
      return new BoundingBox(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));
    }
  }
  _hasVertices(node) {
    return node?.getTotalVertices() > 0;
  }
  _addSizeOptions() {
    this.transformNode.computeWorldMatrix(true);
    const bb = this._getObjectBoundingBox();
    const extents = TmpVectors.Vector3[0];
    extents.copyFrom(bb.extendSize);
    extents.scaleInPlace(2);
    extents.multiplyInPlace(this.transformNode.absoluteScaling);
    extents.x = Math.abs(extents.x);
    extents.y = Math.abs(extents.y);
    extents.z = Math.abs(extents.z);
    const min = TmpVectors.Vector3[1];
    min.copyFrom(bb.minimum);
    min.multiplyInPlace(this.transformNode.absoluteScaling);
    if (!this._options.center) {
      const center = new Vector3();
      center.copyFrom(bb.center);
      center.multiplyInPlace(this.transformNode.absoluteScaling);
      this._options.center = center;
    }
    switch (this.type) {
      case 0:
        if (!this._options.radius && WithinEpsilon(extents.x, extents.y, 1e-4) && WithinEpsilon(extents.x, extents.z, 1e-4)) {
          this._options.radius = extents.x / 2;
        } else if (!this._options.radius) {
          Logger.Warn("Non uniform scaling is unsupported for sphere shapes. Setting the radius to the biggest bounding box extent.");
          this._options.radius = Math.max(extents.x, extents.y, extents.z) / 2;
        }
        break;
      case 1:
        {
          const capRadius = extents.x / 2;
          this._options.radius = this._options.radius ?? capRadius;
          this._options.pointA = this._options.pointA ?? new Vector3(0, min.y + capRadius, 0);
          this._options.pointB = this._options.pointB ?? new Vector3(0, min.y + extents.y - capRadius, 0);
        }
        break;
      case 2:
        {
          const capRadius = extents.x / 2;
          this._options.radius = this._options.radius ?? capRadius;
          this._options.pointA = this._options.pointA ?? new Vector3(0, min.y, 0);
          this._options.pointB = this._options.pointB ?? new Vector3(0, min.y + extents.y, 0);
        }
        break;
      case 6:
      case 4:
      case 7:
        if (!this._options.mesh && this._hasVertices(this.transformNode)) {
          this._options.mesh = this.transformNode;
        } else if (!this._options.mesh || !this._hasVertices(this._options.mesh)) {
          throw new Error("No valid mesh was provided for mesh or convex hull shape parameter. Please provide a mesh with valid geometry (number of vertices greater than 0).");
        }
        break;
      case 3:
        this._options.extents = this._options.extents ?? new Vector3(extents.x, extents.y, extents.z);
        this._options.rotation = this._options.rotation ?? Quaternion.Identity();
        break;
    }
  }
  /**
   * Releases the body, shape and material
   */
  dispose() {
    if (this._nodeDisposeObserver) {
      this.body.transformNode.onDisposeObservable.remove(this._nodeDisposeObserver);
      this._nodeDisposeObserver = null;
    }
    this.body.dispose();
    if (this._disposeShapeWhenDisposed) {
      this.shape.dispose();
    }
  }
}
export {
  HavokPlugin as H,
  PhysicsAggregate as P,
  PhysicsShapeType as a
};
