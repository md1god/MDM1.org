const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./babylon-core-DhADYfIs.js","./babylon-postprocess-V_CCuZLp.js"])))=>i.map(i=>d[i]);
import { T as Tools, R as RegisterSceneLoaderPlugin, O as Observable, L as Logger, D as DataReader, A as AssetContainer, a as DecodeBase64UrlToBinary, b as RuntimeError, E as ErrorCodes, M as Matrix, V as Vector4, c as Vector3, d as Vector2, e as Texture, f as Effect, S as ShaderMaterial, C as Color4, g as AbstractMesh, h as Skeleton, G as GetBlobBufferSource, i as StandardMaterial, j as Color3, k as Material, l as Constants, m as Animation, Q as Quaternion, H as HemisphericLight, n as DirectionalLight, P as PointLight, o as SpotLight, F as FreeCamera, p as Camera, q as Mesh, B as Bone, r as VertexData, s as MultiMaterial, t as Geometry, u as SubMesh, v as VertexBuffer, w as FlowGraphInteger, x as RandomGUID, _ as __vitePreload, y as TransformNode, z as deepMerge, I as MorphTargetManager, J as MorphTarget, K as Lazy, N as VertexBufferGetTypeByteLength, U as VertexBufferForEach, W as Buffer, X as Deferred, Y as GetMimeType, Z as IsBase64DataUrl, $ as LoadFileError, a0 as GetTypedArrayConstructor, a1 as TmpVectors, a2 as BoundingInfo, a3 as TextureChannel, a4 as InvertTextureAsync, a5 as ChannelMask, a6 as TextureColorSpace, a7 as ExtractChannelAsync, a8 as CreateTextureWithFactorOperand, a9 as ExtractMaxChannelAsync, aa as LerpTexturesAsync, ab as MultiplyTexturesAsync, ac as RawCubeTexture, ad as SphericalHarmonics, ae as SphericalPolynomial, af as MeshoptCompression, ag as Light, ah as DracoDecoder, ai as GaussianSplattingMesh, aj as AllocateShBuffers, ak as RectAreaLight, al as RenderTargetTexture, am as Sound, an as WeightedSound, ao as AnimationEvent, ap as getAnimationTypeByFlowGraphType, aq as IsDelayActive, ar as FlowGraphCoordinator, as as ParseFlowGraphAsync, at as addToBlockFactory, au as FlowGraphBlock, av as RichTypeAny } from "./babylon-core-DhADYfIs.js";
function ValidateAsync(data, rootUrl, fileName, getExternalResource) {
  const options = {
    externalResourceFunction: getExternalResource
  };
  if (fileName) {
    options.uri = rootUrl === "file:" ? fileName : rootUrl + fileName;
  }
  return ArrayBuffer.isView(data) ? GLTFValidator.validateBytes(data, options) : GLTFValidator.validateString(data, options);
}
function WorkerFunc() {
  const pendingExternalResources = [];
  onmessage = (message) => {
    const data = message.data;
    switch (data.id) {
      case "init": {
        importScripts(data.url);
        break;
      }
      case "validate": {
        ValidateAsync(data.data, data.rootUrl, data.fileName, (uri) => new Promise((resolve, reject) => {
          const index = pendingExternalResources.length;
          pendingExternalResources.push({ resolve, reject });
          postMessage({ id: "getExternalResource", index, uri });
        })).then((value) => {
          postMessage({ id: "validate.resolve", value });
        }, (reason) => {
          postMessage({ id: "validate.reject", reason });
        });
        break;
      }
      case "getExternalResource.resolve": {
        pendingExternalResources[data.index].resolve(data.value);
        break;
      }
      case "getExternalResource.reject": {
        pendingExternalResources[data.index].reject(data.reason);
        break;
      }
    }
  };
}
class GLTFValidation {
  /**
   * Validate a glTF asset using the glTF-Validator.
   * @param data The JSON of a glTF or the array buffer of a binary glTF
   * @param rootUrl The root url for the glTF
   * @param fileName The file name for the glTF
   * @param getExternalResource The callback to get external resources for the glTF validator
   * @returns A promise that resolves with the glTF validation results once complete
   */
  static ValidateAsync(data, rootUrl, fileName, getExternalResource) {
    if (typeof Worker === "function") {
      return new Promise((resolve, reject) => {
        const workerContent = `${ValidateAsync}(${WorkerFunc})()`;
        const workerBlobUrl = URL.createObjectURL(new Blob([workerContent], { type: "application/javascript" }));
        const worker = new Worker(workerBlobUrl);
        const onError = (error) => {
          worker.removeEventListener("error", onError);
          worker.removeEventListener("message", onMessage);
          reject(error);
        };
        const onMessage = (message) => {
          const data2 = message.data;
          switch (data2.id) {
            case "getExternalResource": {
              getExternalResource(data2.uri).then((value) => {
                worker.postMessage({ id: "getExternalResource.resolve", index: data2.index, value }, [value.buffer]);
              }, (reason) => {
                worker.postMessage({ id: "getExternalResource.reject", index: data2.index, reason });
              });
              break;
            }
            case "validate.resolve": {
              worker.removeEventListener("error", onError);
              worker.removeEventListener("message", onMessage);
              GLTFValidation._LastResults = data2.value;
              resolve(data2.value);
              worker.terminate();
              break;
            }
            case "validate.reject": {
              worker.removeEventListener("error", onError);
              worker.removeEventListener("message", onMessage);
              reject(data2.reason);
              worker.terminate();
            }
          }
        };
        worker.addEventListener("error", onError);
        worker.addEventListener("message", onMessage);
        worker.postMessage({ id: "init", url: Tools.GetBabylonScriptURL(this.Configuration.url) });
        if (ArrayBuffer.isView(data)) {
          const slicedData = data.slice();
          worker.postMessage({ id: "validate", data: slicedData, rootUrl, fileName }, [slicedData.buffer]);
        } else {
          worker.postMessage({ id: "validate", data, rootUrl, fileName });
        }
      });
    } else {
      if (!this._LoadScriptPromise) {
        this._LoadScriptPromise = Tools.LoadBabylonScriptAsync(this.Configuration.url);
      }
      return this._LoadScriptPromise.then(() => {
        return ValidateAsync(data, rootUrl, fileName, getExternalResource);
      });
    }
  }
}
GLTFValidation.Configuration = {
  url: `${Tools._DefaultCdnUrl}/gltf_validator.js`
};
GLTFValidation._LastResults = null;
const GLTFMagicBase64Encoded = "Z2xURg";
const GLTFFileLoaderMetadata = {
  name: "gltf",
  extensions: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".gltf": { isBinary: false, mimeType: "model/gltf+json" },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ".glb": { isBinary: true, mimeType: "model/gltf-binary" }
  },
  canDirectLoad(data) {
    return data.indexOf("asset") !== -1 && data.indexOf("version") !== -1 || data.startsWith("data:base64," + GLTFMagicBase64Encoded) || // this is technically incorrect, but will continue to support for backcompat.
    data.startsWith("data:;base64," + GLTFMagicBase64Encoded) || data.startsWith("data:application/octet-stream;base64," + GLTFMagicBase64Encoded) || data.startsWith("data:model/gltf-binary;base64," + GLTFMagicBase64Encoded);
  }
};
function readAsync(arrayBuffer, byteOffset, byteLength) {
  try {
    return Promise.resolve(new Uint8Array(arrayBuffer, byteOffset, byteLength));
  } catch (e) {
    return Promise.reject(e);
  }
}
function readViewAsync(arrayBufferView, byteOffset, byteLength) {
  try {
    if (byteOffset < 0 || byteOffset >= arrayBufferView.byteLength) {
      throw new RangeError("Offset is out of range.");
    }
    if (byteOffset + byteLength > arrayBufferView.byteLength) {
      throw new RangeError("Length is out of range.");
    }
    return Promise.resolve(new Uint8Array(arrayBufferView.buffer, arrayBufferView.byteOffset + byteOffset, byteLength));
  } catch (e) {
    return Promise.reject(e);
  }
}
var GLTFLoaderCoordinateSystemMode;
(function(GLTFLoaderCoordinateSystemMode2) {
  GLTFLoaderCoordinateSystemMode2[GLTFLoaderCoordinateSystemMode2["AUTO"] = 0] = "AUTO";
  GLTFLoaderCoordinateSystemMode2[GLTFLoaderCoordinateSystemMode2["FORCE_RIGHT_HANDED"] = 1] = "FORCE_RIGHT_HANDED";
})(GLTFLoaderCoordinateSystemMode || (GLTFLoaderCoordinateSystemMode = {}));
var GLTFLoaderAnimationStartMode;
(function(GLTFLoaderAnimationStartMode2) {
  GLTFLoaderAnimationStartMode2[GLTFLoaderAnimationStartMode2["NONE"] = 0] = "NONE";
  GLTFLoaderAnimationStartMode2[GLTFLoaderAnimationStartMode2["FIRST"] = 1] = "FIRST";
  GLTFLoaderAnimationStartMode2[GLTFLoaderAnimationStartMode2["ALL"] = 2] = "ALL";
})(GLTFLoaderAnimationStartMode || (GLTFLoaderAnimationStartMode = {}));
var GLTFLoaderState;
(function(GLTFLoaderState2) {
  GLTFLoaderState2[GLTFLoaderState2["LOADING"] = 0] = "LOADING";
  GLTFLoaderState2[GLTFLoaderState2["READY"] = 1] = "READY";
  GLTFLoaderState2[GLTFLoaderState2["COMPLETE"] = 2] = "COMPLETE";
})(GLTFLoaderState || (GLTFLoaderState = {}));
class GLTFLoaderBaseOptions {
  constructor() {
    this.alwaysComputeBoundingBox = false;
    this.alwaysComputeSkeletonRootNode = false;
    this.animationStartMode = GLTFLoaderAnimationStartMode.FIRST;
    this.compileMaterials = false;
    this.compileShadowGenerators = false;
    this.coordinateSystemMode = GLTFLoaderCoordinateSystemMode.AUTO;
    this.createInstances = true;
    this.loadAllMaterials = false;
    this.loadMorphTargets = true;
    this.useMaxMorphTargetInfluencers = true;
    this.loadNodeAnimations = true;
    this.loadOnlyMaterials = false;
    this.loadSkins = true;
    this.skipMaterials = false;
    this.targetFps = 60;
    this.transparencyAsCoverage = false;
    this.useClipPlane = false;
    this.useGltfTextureNames = false;
    this.useRangeRequests = false;
    this.useSRGBBuffers = true;
    this.validate = false;
    this.useOpenPBR = false;
    this.dontUseTransmissionHelper = false;
  }
}
const GLTFLoaderDefaultOptions = new GLTFLoaderBaseOptions();
class GLTFLoaderOptions extends GLTFLoaderBaseOptions {
  constructor() {
    super(...arguments);
    this.extensionOptions = {};
    this.preprocessUrlAsync = (url) => Promise.resolve(url);
  }
  // eslint-disable-next-line babylonjs/available
  copyFrom(options) {
    if (options) {
      this.alwaysComputeBoundingBox = options.alwaysComputeBoundingBox ?? this.alwaysComputeBoundingBox;
      this.alwaysComputeSkeletonRootNode = options.alwaysComputeSkeletonRootNode ?? this.alwaysComputeSkeletonRootNode;
      this.animationStartMode = options.animationStartMode ?? this.animationStartMode;
      this.capturePerformanceCounters = options.capturePerformanceCounters ?? this.capturePerformanceCounters;
      this.compileMaterials = options.compileMaterials ?? this.compileMaterials;
      this.compileShadowGenerators = options.compileShadowGenerators ?? this.compileShadowGenerators;
      this.coordinateSystemMode = options.coordinateSystemMode ?? this.coordinateSystemMode;
      this.createInstances = options.createInstances ?? this.createInstances;
      this.customRootNode = options.customRootNode;
      this.extensionOptions = options.extensionOptions ?? this.extensionOptions;
      this.loadAllMaterials = options.loadAllMaterials ?? this.loadAllMaterials;
      this.loadMorphTargets = options.loadMorphTargets ?? this.loadMorphTargets;
      this.loadNodeAnimations = options.loadNodeAnimations ?? this.loadNodeAnimations;
      this.loadOnlyMaterials = options.loadOnlyMaterials ?? this.loadOnlyMaterials;
      this.loadSkins = options.loadSkins ?? this.loadSkins;
      this.loggingEnabled = options.loggingEnabled ?? this.loggingEnabled;
      this.onCameraLoaded = options.onCameraLoaded;
      this.onMaterialLoaded = options.onMaterialLoaded;
      this.onMeshLoaded = options.onMeshLoaded;
      this.onParsed = options.onParsed;
      this.onSkinLoaded = options.onSkinLoaded;
      this.onTextureLoaded = options.onTextureLoaded;
      this.onValidated = options.onValidated;
      this.preprocessUrlAsync = options.preprocessUrlAsync ?? this.preprocessUrlAsync;
      this.skipMaterials = options.skipMaterials ?? this.skipMaterials;
      this.targetFps = options.targetFps ?? this.targetFps;
      this.transparencyAsCoverage = options.transparencyAsCoverage ?? this.transparencyAsCoverage;
      this.useClipPlane = options.useClipPlane ?? this.useClipPlane;
      this.useGltfTextureNames = options.useGltfTextureNames ?? this.useGltfTextureNames;
      this.useMaxMorphTargetInfluencers = options.useMaxMorphTargetInfluencers ?? this.useMaxMorphTargetInfluencers;
      this.useOpenPBR = options.useOpenPBR ?? this.useOpenPBR;
      this.useRangeRequests = options.useRangeRequests ?? this.useRangeRequests;
      this.useSRGBBuffers = options.useSRGBBuffers ?? this.useSRGBBuffers;
      this.validate = options.validate ?? this.validate;
      this.dontUseTransmissionHelper = options.dontUseTransmissionHelper ?? this.dontUseTransmissionHelper;
    }
  }
}
class GLTFFileLoader extends GLTFLoaderOptions {
  /**
   * Creates a new glTF file loader.
   * @param options The options for the loader
   */
  constructor(options) {
    super();
    this.onParsedObservable = new Observable();
    this.onMeshLoadedObservable = new Observable();
    this.onSkinLoadedObservable = new Observable();
    this.onTextureLoadedObservable = new Observable();
    this.onMaterialLoadedObservable = new Observable();
    this.onCameraLoadedObservable = new Observable();
    this.onCompleteObservable = new Observable();
    this.onErrorObservable = new Observable();
    this.onDisposeObservable = new Observable();
    this.onExtensionLoadedObservable = new Observable();
    this.onValidatedObservable = new Observable();
    this._loader = null;
    this._state = null;
    this._requests = new Array();
    this.name = GLTFFileLoaderMetadata.name;
    this.extensions = GLTFFileLoaderMetadata.extensions;
    this.onLoaderStateChangedObservable = new Observable();
    this._logIndentLevel = 0;
    this._loggingEnabled = false;
    this._log = this._logDisabled;
    this._capturePerformanceCounters = false;
    this._startPerformanceCounter = this._startPerformanceCounterDisabled;
    this._endPerformanceCounter = this._endPerformanceCounterDisabled;
    this.copyFrom(Object.assign({ ...GLTFLoaderDefaultOptions }, options));
  }
  /**
   * Raised when the asset has been parsed
   */
  set onParsed(callback) {
    if (this._onParsedObserver) {
      this.onParsedObservable.remove(this._onParsedObserver);
    }
    if (callback) {
      this._onParsedObserver = this.onParsedObservable.add(callback);
    }
  }
  /**
   * Callback raised when the loader creates a mesh after parsing the glTF properties of the mesh.
   * Note that the callback is called as soon as the mesh object is created, meaning some data may not have been setup yet for this mesh (vertex data, morph targets, material, ...)
   */
  set onMeshLoaded(callback) {
    if (this._onMeshLoadedObserver) {
      this.onMeshLoadedObservable.remove(this._onMeshLoadedObserver);
    }
    if (callback) {
      this._onMeshLoadedObserver = this.onMeshLoadedObservable.add(callback);
    }
  }
  /**
   * Callback raised when the loader creates a skin after parsing the glTF properties of the skin node.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF/glTFSkinning#ignoring-the-transform-of-the-skinned-mesh
   */
  set onSkinLoaded(callback) {
    if (this._onSkinLoadedObserver) {
      this.onSkinLoadedObservable.remove(this._onSkinLoadedObserver);
    }
    if (callback) {
      this._onSkinLoadedObserver = this.onSkinLoadedObservable.add((data) => callback(data.node, data.skinnedNode));
    }
  }
  /**
   * Callback raised when the loader creates a texture after parsing the glTF properties of the texture.
   */
  set onTextureLoaded(callback) {
    if (this._onTextureLoadedObserver) {
      this.onTextureLoadedObservable.remove(this._onTextureLoadedObserver);
    }
    if (callback) {
      this._onTextureLoadedObserver = this.onTextureLoadedObservable.add(callback);
    }
  }
  /**
   * Callback raised when the loader creates a material after parsing the glTF properties of the material.
   */
  set onMaterialLoaded(callback) {
    if (this._onMaterialLoadedObserver) {
      this.onMaterialLoadedObservable.remove(this._onMaterialLoadedObserver);
    }
    if (callback) {
      this._onMaterialLoadedObserver = this.onMaterialLoadedObservable.add(callback);
    }
  }
  /**
   * Callback raised when the loader creates a camera after parsing the glTF properties of the camera.
   */
  set onCameraLoaded(callback) {
    if (this._onCameraLoadedObserver) {
      this.onCameraLoadedObservable.remove(this._onCameraLoadedObserver);
    }
    if (callback) {
      this._onCameraLoadedObserver = this.onCameraLoadedObservable.add(callback);
    }
  }
  /**
   * Callback raised when the asset is completely loaded, immediately before the loader is disposed.
   * For assets with LODs, raised when all of the LODs are complete.
   * For assets without LODs, raised when the model is complete, immediately after the loader resolves the returned promise.
   */
  set onComplete(callback) {
    if (this._onCompleteObserver) {
      this.onCompleteObservable.remove(this._onCompleteObserver);
    }
    this._onCompleteObserver = this.onCompleteObservable.add(callback);
  }
  /**
   * Callback raised when an error occurs.
   */
  set onError(callback) {
    if (this._onErrorObserver) {
      this.onErrorObservable.remove(this._onErrorObserver);
    }
    this._onErrorObserver = this.onErrorObservable.add(callback);
  }
  /**
   * Callback raised after the loader is disposed.
   */
  set onDispose(callback) {
    if (this._onDisposeObserver) {
      this.onDisposeObservable.remove(this._onDisposeObserver);
    }
    this._onDisposeObserver = this.onDisposeObservable.add(callback);
  }
  /**
   * Callback raised after a loader extension is created.
   */
  set onExtensionLoaded(callback) {
    if (this._onExtensionLoadedObserver) {
      this.onExtensionLoadedObservable.remove(this._onExtensionLoadedObserver);
    }
    this._onExtensionLoadedObserver = this.onExtensionLoadedObservable.add(callback);
  }
  /**
   * Defines if the loader logging is enabled.
   */
  get loggingEnabled() {
    return this._loggingEnabled;
  }
  set loggingEnabled(value) {
    if (this._loggingEnabled === value) {
      return;
    }
    this._loggingEnabled = value;
    if (this._loggingEnabled) {
      this._log = this._logEnabled;
    } else {
      this._log = this._logDisabled;
    }
  }
  /**
   * Defines if the loader should capture performance counters.
   */
  get capturePerformanceCounters() {
    return this._capturePerformanceCounters;
  }
  set capturePerformanceCounters(value) {
    if (this._capturePerformanceCounters === value) {
      return;
    }
    this._capturePerformanceCounters = value;
    if (this._capturePerformanceCounters) {
      this._startPerformanceCounter = this._startPerformanceCounterEnabled;
      this._endPerformanceCounter = this._endPerformanceCounterEnabled;
    } else {
      this._startPerformanceCounter = this._startPerformanceCounterDisabled;
      this._endPerformanceCounter = this._endPerformanceCounterDisabled;
    }
  }
  /**
   * Callback raised after the asset is validated.
   */
  set onValidated(callback) {
    if (this._onValidatedObserver) {
      this.onValidatedObservable.remove(this._onValidatedObserver);
    }
    this._onValidatedObserver = this.onValidatedObservable.add(callback);
  }
  /**
   * Disposes the loader, releases resources during load, and cancels any outstanding requests.
   */
  dispose() {
    if (this._loader) {
      this._loader.dispose();
      this._loader = null;
    }
    for (const request of this._requests) {
      request.abort();
    }
    this._requests.length = 0;
    delete this._progressCallback;
    this.preprocessUrlAsync = (url) => Promise.resolve(url);
    this.onMeshLoadedObservable.clear();
    this.onSkinLoadedObservable.clear();
    this.onTextureLoadedObservable.clear();
    this.onMaterialLoadedObservable.clear();
    this.onCameraLoadedObservable.clear();
    this.onCompleteObservable.clear();
    this.onExtensionLoadedObservable.clear();
    this.onDisposeObservable.notifyObservers(void 0);
    this.onDisposeObservable.clear();
  }
  /**
   * @internal
   */
  loadFile(scene, fileOrUrl, rootUrl, onSuccess, onProgress, useArrayBuffer, onError, name) {
    if (ArrayBuffer.isView(fileOrUrl)) {
      this._loadBinary(scene, fileOrUrl, rootUrl, onSuccess, onError, name);
      return null;
    }
    this._progressCallback = onProgress;
    const fileName = fileOrUrl.name || Tools.GetFilename(fileOrUrl);
    if (useArrayBuffer) {
      if (this.useRangeRequests) {
        if (this.validate) {
          Logger.Warn("glTF validation is not supported when range requests are enabled");
        }
        const fileRequest = {
          abort: () => {
          },
          onCompleteObservable: new Observable()
        };
        const dataBuffer = {
          readAsync: (byteOffset, byteLength) => {
            return new Promise((resolve, reject) => {
              this._loadFile(scene, fileOrUrl, (data) => {
                resolve(new Uint8Array(data));
              }, true, (error) => {
                reject(error);
              }, (webRequest) => {
                webRequest.setRequestHeader("Range", `bytes=${byteOffset}-${byteOffset + byteLength - 1}`);
              });
            });
          },
          byteLength: 0
        };
        this._unpackBinaryAsync(new DataReader(dataBuffer)).then((loaderData) => {
          fileRequest.onCompleteObservable.notifyObservers(fileRequest);
          onSuccess(loaderData);
        }, onError ? (error) => onError(void 0, error) : void 0);
        return fileRequest;
      }
      return this._loadFile(scene, fileOrUrl, (data) => {
        this._validate(scene, new Uint8Array(data, 0, data.byteLength), rootUrl, fileName);
        this._unpackBinaryAsync(new DataReader({
          readAsync: (byteOffset, byteLength) => readAsync(data, byteOffset, byteLength),
          byteLength: data.byteLength
        })).then((loaderData) => {
          onSuccess(loaderData);
        }, onError ? (error) => onError(void 0, error) : void 0);
      }, true, onError);
    } else {
      return this._loadFile(scene, fileOrUrl, (data) => {
        try {
          this._validate(scene, data, rootUrl, fileName);
          onSuccess({ json: this._parseJson(data) });
        } catch {
          if (onError) {
            onError();
          }
        }
      }, false, onError);
    }
  }
  _loadBinary(scene, data, rootUrl, onSuccess, onError, fileName) {
    this._validate(scene, new Uint8Array(data.buffer, data.byteOffset, data.byteLength), rootUrl, fileName);
    this._unpackBinaryAsync(new DataReader({
      readAsync: (byteOffset, byteLength) => readViewAsync(data, byteOffset, byteLength),
      byteLength: data.byteLength
    })).then((loaderData) => {
      onSuccess(loaderData);
    }, onError ? (error) => onError(void 0, error) : void 0);
  }
  /**
   * @internal
   */
  importMeshAsync(meshesNames, scene, data, rootUrl, onProgress, fileName) {
    return Promise.resolve().then(() => {
      this.onParsedObservable.notifyObservers(data);
      this.onParsedObservable.clear();
      this._log(`Loading ${fileName || ""}`);
      this._loader = this._getLoader(data);
      return this._loader.importMeshAsync(meshesNames, scene, null, data, rootUrl, onProgress, fileName);
    });
  }
  /**
   * @internal
   */
  loadAsync(scene, data, rootUrl, onProgress, fileName) {
    return Promise.resolve().then(() => {
      this.onParsedObservable.notifyObservers(data);
      this.onParsedObservable.clear();
      this._log(`Loading ${fileName || ""}`);
      this._loader = this._getLoader(data);
      return this._loader.loadAsync(scene, data, rootUrl, onProgress, fileName);
    });
  }
  /**
   * @internal
   */
  loadAssetContainerAsync(scene, data, rootUrl, onProgress, fileName) {
    return Promise.resolve().then(() => {
      this.onParsedObservable.notifyObservers(data);
      this.onParsedObservable.clear();
      this._log(`Loading ${fileName || ""}`);
      this._loader = this._getLoader(data);
      const container = new AssetContainer(scene);
      const materials = [];
      this.onMaterialLoadedObservable.add((material) => {
        materials.push(material);
      });
      const textures = [];
      this.onTextureLoadedObservable.add((texture) => {
        textures.push(texture);
      });
      const cameras = [];
      this.onCameraLoadedObservable.add((camera) => {
        cameras.push(camera);
      });
      const morphTargetManagers = [];
      this.onMeshLoadedObservable.add((mesh) => {
        if (mesh.morphTargetManager) {
          morphTargetManagers.push(mesh.morphTargetManager);
        }
      });
      return this._loader.importMeshAsync(null, scene, container, data, rootUrl, onProgress, fileName).then((result) => {
        Array.prototype.push.apply(container.geometries, result.geometries);
        Array.prototype.push.apply(container.meshes, result.meshes);
        Array.prototype.push.apply(container.particleSystems, result.particleSystems);
        Array.prototype.push.apply(container.skeletons, result.skeletons);
        Array.prototype.push.apply(container.animationGroups, result.animationGroups);
        Array.prototype.push.apply(container.materials, materials);
        Array.prototype.push.apply(container.textures, textures);
        Array.prototype.push.apply(container.lights, result.lights);
        Array.prototype.push.apply(container.transformNodes, result.transformNodes);
        Array.prototype.push.apply(container.cameras, cameras);
        Array.prototype.push.apply(container.morphTargetManagers, morphTargetManagers);
        return container;
      });
    });
  }
  /**
   * @internal
   */
  canDirectLoad(data) {
    return GLTFFileLoaderMetadata.canDirectLoad(data);
  }
  /**
   * @internal
   */
  directLoad(scene, data) {
    if (data.startsWith("base64," + GLTFMagicBase64Encoded) || // this is technically incorrect, but will continue to support for backcompat.
    data.startsWith(";base64," + GLTFMagicBase64Encoded) || data.startsWith("application/octet-stream;base64," + GLTFMagicBase64Encoded) || data.startsWith("model/gltf-binary;base64," + GLTFMagicBase64Encoded)) {
      const arrayBuffer = DecodeBase64UrlToBinary(data);
      this._validate(scene, new Uint8Array(arrayBuffer, 0, arrayBuffer.byteLength));
      return this._unpackBinaryAsync(new DataReader({
        readAsync: (byteOffset, byteLength) => readAsync(arrayBuffer, byteOffset, byteLength),
        byteLength: arrayBuffer.byteLength
      }));
    }
    this._validate(scene, data);
    return Promise.resolve({ json: this._parseJson(data) });
  }
  /** @internal */
  createPlugin(options) {
    return new GLTFFileLoader(options[GLTFFileLoaderMetadata.name]);
  }
  /**
   * The loader state or null if the loader is not active.
   */
  get loaderState() {
    return this._state;
  }
  /**
   * Returns a promise that resolves when the asset is completely loaded.
   * @returns a promise that resolves when the asset is completely loaded.
   */
  whenCompleteAsync() {
    return new Promise((resolve, reject) => {
      this.onCompleteObservable.addOnce(() => {
        resolve();
      });
      this.onErrorObservable.addOnce((reason) => {
        reject(reason);
      });
    });
  }
  /**
   * @internal
   */
  _setState(state) {
    if (this._state === state) {
      return;
    }
    this._state = state;
    this.onLoaderStateChangedObservable.notifyObservers(this._state);
    this._log(GLTFLoaderState[this._state]);
  }
  /**
   * @internal
   */
  _loadFile(scene, fileOrUrl, onSuccess, useArrayBuffer, onError, onOpened) {
    const request = scene._loadFile(fileOrUrl, onSuccess, (event) => {
      this._onProgress(event, request);
    }, true, useArrayBuffer, onError, onOpened);
    request.onCompleteObservable.add(() => {
      request._lengthComputable = true;
      request._total = request._loaded;
    });
    this._requests.push(request);
    return request;
  }
  _onProgress(event, request) {
    if (!this._progressCallback) {
      return;
    }
    request._lengthComputable = event.lengthComputable;
    request._loaded = event.loaded;
    request._total = event.total;
    let lengthComputable = true;
    let loaded = 0;
    let total = 0;
    for (const request2 of this._requests) {
      if (request2._lengthComputable === void 0 || request2._loaded === void 0 || request2._total === void 0) {
        return;
      }
      lengthComputable = lengthComputable && request2._lengthComputable;
      loaded += request2._loaded;
      total += request2._total;
    }
    this._progressCallback({
      lengthComputable,
      loaded,
      total: lengthComputable ? total : 0
    });
  }
  _validate(scene, data, rootUrl = "", fileName = "") {
    if (!this.validate) {
      return;
    }
    this._startPerformanceCounter("Validate JSON");
    GLTFValidation.ValidateAsync(data, rootUrl, fileName, (uri) => {
      return this.preprocessUrlAsync(rootUrl + uri).then((url) => {
        return scene._loadFileAsync(url, void 0, true, true).then((data2) => {
          return new Uint8Array(data2, 0, data2.byteLength);
        });
      });
    }).then((result) => {
      this._endPerformanceCounter("Validate JSON");
      this.onValidatedObservable.notifyObservers(result);
      this.onValidatedObservable.clear();
    }, (reason) => {
      this._endPerformanceCounter("Validate JSON");
      Tools.Warn(`Failed to validate: ${reason.message}`);
      this.onValidatedObservable.clear();
    });
  }
  _getLoader(loaderData) {
    const asset = loaderData.json.asset || {};
    this._log(`Asset version: ${asset.version}`);
    asset.minVersion && this._log(`Asset minimum version: ${asset.minVersion}`);
    asset.generator && this._log(`Asset generator: ${asset.generator}`);
    const version = GLTFFileLoader._parseVersion(asset.version);
    if (!version) {
      throw new Error("Invalid version: " + asset.version);
    }
    if (asset.minVersion !== void 0) {
      const minVersion = GLTFFileLoader._parseVersion(asset.minVersion);
      if (!minVersion) {
        throw new Error("Invalid minimum version: " + asset.minVersion);
      }
      if (GLTFFileLoader._compareVersion(minVersion, { major: 2, minor: 0 }) > 0) {
        throw new Error("Incompatible minimum version: " + asset.minVersion);
      }
    }
    const createLoaders = {
      1: GLTFFileLoader._CreateGLTF1Loader,
      2: GLTFFileLoader._CreateGLTF2Loader
    };
    const createLoader = createLoaders[version.major];
    if (!createLoader) {
      throw new Error("Unsupported version: " + asset.version);
    }
    return createLoader(this);
  }
  _parseJson(json) {
    this._startPerformanceCounter("Parse JSON");
    this._log(`JSON length: ${json.length}`);
    const parsed = JSON.parse(json);
    this._endPerformanceCounter("Parse JSON");
    return parsed;
  }
  _unpackBinaryAsync(dataReader) {
    this._startPerformanceCounter("Unpack Binary");
    return dataReader.loadAsync(20).then(() => {
      const Binary = {
        Magic: 1179937895
      };
      const magic = dataReader.readUint32();
      if (magic !== Binary.Magic) {
        throw new RuntimeError("Unexpected magic: " + magic, ErrorCodes.GLTFLoaderUnexpectedMagicError);
      }
      const version = dataReader.readUint32();
      if (this.loggingEnabled) {
        this._log(`Binary version: ${version}`);
      }
      const length = dataReader.readUint32();
      if (!this.useRangeRequests && length !== dataReader.buffer.byteLength) {
        Logger.Warn(`Length in header does not match actual data length: ${length} != ${dataReader.buffer.byteLength}`);
      }
      let unpacked;
      switch (version) {
        case 1: {
          unpacked = this._unpackBinaryV1Async(dataReader, length);
          break;
        }
        case 2: {
          unpacked = this._unpackBinaryV2Async(dataReader, length);
          break;
        }
        default: {
          throw new Error("Unsupported version: " + version);
        }
      }
      this._endPerformanceCounter("Unpack Binary");
      return unpacked;
    });
  }
  _unpackBinaryV1Async(dataReader, length) {
    const ContentFormat = {
      JSON: 0
    };
    const contentLength = dataReader.readUint32();
    const contentFormat = dataReader.readUint32();
    if (contentFormat !== ContentFormat.JSON) {
      throw new Error(`Unexpected content format: ${contentFormat}`);
    }
    const bodyLength = length - dataReader.byteOffset;
    const data = { json: this._parseJson(dataReader.readString(contentLength)), bin: null };
    if (bodyLength !== 0) {
      const startByteOffset = dataReader.byteOffset;
      data.bin = {
        readAsync: (byteOffset, byteLength) => dataReader.buffer.readAsync(startByteOffset + byteOffset, byteLength),
        byteLength: bodyLength
      };
    }
    return Promise.resolve(data);
  }
  _unpackBinaryV2Async(dataReader, length) {
    const ChunkFormat = {
      JSON: 1313821514,
      BIN: 5130562
    };
    const chunkLength = dataReader.readUint32();
    const chunkFormat = dataReader.readUint32();
    if (chunkFormat !== ChunkFormat.JSON) {
      throw new Error("First chunk format is not JSON");
    }
    if (dataReader.byteOffset + chunkLength === length) {
      return dataReader.loadAsync(chunkLength).then(() => {
        return { json: this._parseJson(dataReader.readString(chunkLength)), bin: null };
      });
    }
    return dataReader.loadAsync(chunkLength + 8).then(() => {
      const data = { json: this._parseJson(dataReader.readString(chunkLength)), bin: null };
      const readAsync2 = () => {
        const chunkLength2 = dataReader.readUint32();
        const chunkFormat2 = dataReader.readUint32();
        switch (chunkFormat2) {
          case ChunkFormat.JSON: {
            throw new Error("Unexpected JSON chunk");
          }
          case ChunkFormat.BIN: {
            const startByteOffset = dataReader.byteOffset;
            data.bin = {
              readAsync: (byteOffset, byteLength) => dataReader.buffer.readAsync(startByteOffset + byteOffset, byteLength),
              byteLength: chunkLength2
            };
            dataReader.skipBytes(chunkLength2);
            break;
          }
          default: {
            dataReader.skipBytes(chunkLength2);
            break;
          }
        }
        if (dataReader.byteOffset !== length) {
          return dataReader.loadAsync(8).then(readAsync2);
        }
        return Promise.resolve(data);
      };
      return readAsync2();
    });
  }
  static _parseVersion(version) {
    if (version === "1.0" || version === "1.0.1") {
      return {
        major: 1,
        minor: 0
      };
    }
    const match = (version + "").match(/^(\d+)\.(\d+)/);
    if (!match) {
      return null;
    }
    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2])
    };
  }
  static _compareVersion(a, b) {
    if (a.major > b.major) {
      return 1;
    }
    if (a.major < b.major) {
      return -1;
    }
    if (a.minor > b.minor) {
      return 1;
    }
    if (a.minor < b.minor) {
      return -1;
    }
    return 0;
  }
  /**
   * @internal
   */
  _logOpen(message) {
    this._log(message);
    this._logIndentLevel++;
  }
  /** @internal */
  _logClose() {
    --this._logIndentLevel;
  }
  _logEnabled(message) {
    const spaces = GLTFFileLoader._logSpaces.substring(0, this._logIndentLevel * 2);
    Logger.Log(`${spaces}${message}`);
  }
  _logDisabled(message) {
  }
  _startPerformanceCounterEnabled(counterName) {
    Tools.StartPerformanceCounter(counterName);
  }
  _startPerformanceCounterDisabled(counterName) {
  }
  _endPerformanceCounterEnabled(counterName) {
    Tools.EndPerformanceCounter(counterName);
  }
  _endPerformanceCounterDisabled(counterName) {
  }
}
GLTFFileLoader.IncrementalLoading = true;
GLTFFileLoader.HomogeneousCoordinates = false;
GLTFFileLoader._logSpaces = "                                ";
let _Registered$H = false;
function RegisterGLTFFileLoader() {
  if (_Registered$H) {
    return;
  }
  _Registered$H = true;
  RegisterSceneLoaderPlugin(new GLTFFileLoader());
}
RegisterGLTFFileLoader();
var EComponentType;
(function(EComponentType2) {
  EComponentType2[EComponentType2["BYTE"] = 5120] = "BYTE";
  EComponentType2[EComponentType2["UNSIGNED_BYTE"] = 5121] = "UNSIGNED_BYTE";
  EComponentType2[EComponentType2["SHORT"] = 5122] = "SHORT";
  EComponentType2[EComponentType2["UNSIGNED_SHORT"] = 5123] = "UNSIGNED_SHORT";
  EComponentType2[EComponentType2["FLOAT"] = 5126] = "FLOAT";
})(EComponentType || (EComponentType = {}));
var EShaderType;
(function(EShaderType2) {
  EShaderType2[EShaderType2["FRAGMENT"] = 35632] = "FRAGMENT";
  EShaderType2[EShaderType2["VERTEX"] = 35633] = "VERTEX";
})(EShaderType || (EShaderType = {}));
var EParameterType;
(function(EParameterType2) {
  EParameterType2[EParameterType2["BYTE"] = 5120] = "BYTE";
  EParameterType2[EParameterType2["UNSIGNED_BYTE"] = 5121] = "UNSIGNED_BYTE";
  EParameterType2[EParameterType2["SHORT"] = 5122] = "SHORT";
  EParameterType2[EParameterType2["UNSIGNED_SHORT"] = 5123] = "UNSIGNED_SHORT";
  EParameterType2[EParameterType2["INT"] = 5124] = "INT";
  EParameterType2[EParameterType2["UNSIGNED_INT"] = 5125] = "UNSIGNED_INT";
  EParameterType2[EParameterType2["FLOAT"] = 5126] = "FLOAT";
  EParameterType2[EParameterType2["FLOAT_VEC2"] = 35664] = "FLOAT_VEC2";
  EParameterType2[EParameterType2["FLOAT_VEC3"] = 35665] = "FLOAT_VEC3";
  EParameterType2[EParameterType2["FLOAT_VEC4"] = 35666] = "FLOAT_VEC4";
  EParameterType2[EParameterType2["INT_VEC2"] = 35667] = "INT_VEC2";
  EParameterType2[EParameterType2["INT_VEC3"] = 35668] = "INT_VEC3";
  EParameterType2[EParameterType2["INT_VEC4"] = 35669] = "INT_VEC4";
  EParameterType2[EParameterType2["BOOL"] = 35670] = "BOOL";
  EParameterType2[EParameterType2["BOOL_VEC2"] = 35671] = "BOOL_VEC2";
  EParameterType2[EParameterType2["BOOL_VEC3"] = 35672] = "BOOL_VEC3";
  EParameterType2[EParameterType2["BOOL_VEC4"] = 35673] = "BOOL_VEC4";
  EParameterType2[EParameterType2["FLOAT_MAT2"] = 35674] = "FLOAT_MAT2";
  EParameterType2[EParameterType2["FLOAT_MAT3"] = 35675] = "FLOAT_MAT3";
  EParameterType2[EParameterType2["FLOAT_MAT4"] = 35676] = "FLOAT_MAT4";
  EParameterType2[EParameterType2["SAMPLER_2D"] = 35678] = "SAMPLER_2D";
})(EParameterType || (EParameterType = {}));
var ETextureWrapMode;
(function(ETextureWrapMode2) {
  ETextureWrapMode2[ETextureWrapMode2["CLAMP_TO_EDGE"] = 33071] = "CLAMP_TO_EDGE";
  ETextureWrapMode2[ETextureWrapMode2["MIRRORED_REPEAT"] = 33648] = "MIRRORED_REPEAT";
  ETextureWrapMode2[ETextureWrapMode2["REPEAT"] = 10497] = "REPEAT";
})(ETextureWrapMode || (ETextureWrapMode = {}));
var ETextureFilterType;
(function(ETextureFilterType2) {
  ETextureFilterType2[ETextureFilterType2["NEAREST"] = 9728] = "NEAREST";
  ETextureFilterType2[ETextureFilterType2["LINEAR"] = 9728] = "LINEAR";
  ETextureFilterType2[ETextureFilterType2["NEAREST_MIPMAP_NEAREST"] = 9984] = "NEAREST_MIPMAP_NEAREST";
  ETextureFilterType2[ETextureFilterType2["LINEAR_MIPMAP_NEAREST"] = 9985] = "LINEAR_MIPMAP_NEAREST";
  ETextureFilterType2[ETextureFilterType2["NEAREST_MIPMAP_LINEAR"] = 9986] = "NEAREST_MIPMAP_LINEAR";
  ETextureFilterType2[ETextureFilterType2["LINEAR_MIPMAP_LINEAR"] = 9987] = "LINEAR_MIPMAP_LINEAR";
})(ETextureFilterType || (ETextureFilterType = {}));
var ETextureFormat;
(function(ETextureFormat2) {
  ETextureFormat2[ETextureFormat2["ALPHA"] = 6406] = "ALPHA";
  ETextureFormat2[ETextureFormat2["RGB"] = 6407] = "RGB";
  ETextureFormat2[ETextureFormat2["RGBA"] = 6408] = "RGBA";
  ETextureFormat2[ETextureFormat2["LUMINANCE"] = 6409] = "LUMINANCE";
  ETextureFormat2[ETextureFormat2["LUMINANCE_ALPHA"] = 6410] = "LUMINANCE_ALPHA";
})(ETextureFormat || (ETextureFormat = {}));
var ECullingType;
(function(ECullingType2) {
  ECullingType2[ECullingType2["FRONT"] = 1028] = "FRONT";
  ECullingType2[ECullingType2["BACK"] = 1029] = "BACK";
  ECullingType2[ECullingType2["FRONT_AND_BACK"] = 1032] = "FRONT_AND_BACK";
})(ECullingType || (ECullingType = {}));
var EBlendingFunction;
(function(EBlendingFunction2) {
  EBlendingFunction2[EBlendingFunction2["ZERO"] = 0] = "ZERO";
  EBlendingFunction2[EBlendingFunction2["ONE"] = 1] = "ONE";
  EBlendingFunction2[EBlendingFunction2["SRC_COLOR"] = 768] = "SRC_COLOR";
  EBlendingFunction2[EBlendingFunction2["ONE_MINUS_SRC_COLOR"] = 769] = "ONE_MINUS_SRC_COLOR";
  EBlendingFunction2[EBlendingFunction2["DST_COLOR"] = 774] = "DST_COLOR";
  EBlendingFunction2[EBlendingFunction2["ONE_MINUS_DST_COLOR"] = 775] = "ONE_MINUS_DST_COLOR";
  EBlendingFunction2[EBlendingFunction2["SRC_ALPHA"] = 770] = "SRC_ALPHA";
  EBlendingFunction2[EBlendingFunction2["ONE_MINUS_SRC_ALPHA"] = 771] = "ONE_MINUS_SRC_ALPHA";
  EBlendingFunction2[EBlendingFunction2["DST_ALPHA"] = 772] = "DST_ALPHA";
  EBlendingFunction2[EBlendingFunction2["ONE_MINUS_DST_ALPHA"] = 773] = "ONE_MINUS_DST_ALPHA";
  EBlendingFunction2[EBlendingFunction2["CONSTANT_COLOR"] = 32769] = "CONSTANT_COLOR";
  EBlendingFunction2[EBlendingFunction2["ONE_MINUS_CONSTANT_COLOR"] = 32770] = "ONE_MINUS_CONSTANT_COLOR";
  EBlendingFunction2[EBlendingFunction2["CONSTANT_ALPHA"] = 32771] = "CONSTANT_ALPHA";
  EBlendingFunction2[EBlendingFunction2["ONE_MINUS_CONSTANT_ALPHA"] = 32772] = "ONE_MINUS_CONSTANT_ALPHA";
  EBlendingFunction2[EBlendingFunction2["SRC_ALPHA_SATURATE"] = 776] = "SRC_ALPHA_SATURATE";
})(EBlendingFunction || (EBlendingFunction = {}));
class GLTFUtils {
  /**
   * Sets the given "parameter" matrix
   * @param scene the Scene object
   * @param source the source node where to pick the matrix
   * @param parameter the GLTF technique parameter
   * @param uniformName the name of the shader's uniform
   * @param shaderMaterial the shader material
   */
  static SetMatrix(scene, source, parameter, uniformName, shaderMaterial) {
    let mat = null;
    if (parameter.semantic === "MODEL") {
      mat = source.getWorldMatrix();
    } else if (parameter.semantic === "PROJECTION") {
      mat = scene.getProjectionMatrix();
    } else if (parameter.semantic === "VIEW") {
      mat = scene.getViewMatrix();
    } else if (parameter.semantic === "MODELVIEWINVERSETRANSPOSE") {
      mat = Matrix.Transpose(source.getWorldMatrix().multiply(scene.getViewMatrix()).invert());
    } else if (parameter.semantic === "MODELVIEW") {
      mat = source.getWorldMatrix().multiply(scene.getViewMatrix());
    } else if (parameter.semantic === "MODELVIEWPROJECTION") {
      mat = source.getWorldMatrix().multiply(scene.getTransformMatrix());
    } else if (parameter.semantic === "MODELINVERSE") {
      mat = source.getWorldMatrix().invert();
    } else if (parameter.semantic === "VIEWINVERSE") {
      mat = scene.getViewMatrix().invert();
    } else if (parameter.semantic === "PROJECTIONINVERSE") {
      mat = scene.getProjectionMatrix().invert();
    } else if (parameter.semantic === "MODELVIEWINVERSE") {
      mat = source.getWorldMatrix().multiply(scene.getViewMatrix()).invert();
    } else if (parameter.semantic === "MODELVIEWPROJECTIONINVERSE") {
      mat = source.getWorldMatrix().multiply(scene.getTransformMatrix()).invert();
    } else if (parameter.semantic === "MODELINVERSETRANSPOSE") {
      mat = Matrix.Transpose(source.getWorldMatrix().invert());
    }
    if (mat) {
      switch (parameter.type) {
        case EParameterType.FLOAT_MAT2:
          shaderMaterial.setMatrix2x2(uniformName, Matrix.GetAsMatrix2x2(mat));
          break;
        case EParameterType.FLOAT_MAT3:
          shaderMaterial.setMatrix3x3(uniformName, Matrix.GetAsMatrix3x3(mat));
          break;
        case EParameterType.FLOAT_MAT4:
          shaderMaterial.setMatrix(uniformName, mat);
          break;
      }
    }
  }
  /**
   * Sets the given "parameter" matrix
   * @param shaderMaterial the shader material
   * @param uniform the name of the shader's uniform
   * @param value the value of the uniform
   * @param type the uniform's type (EParameterType FLOAT, VEC2, VEC3 or VEC4)
   * @returns true if set, else false
   */
  static SetUniform(shaderMaterial, uniform, value, type) {
    switch (type) {
      case EParameterType.FLOAT:
        shaderMaterial.setFloat(uniform, value);
        return true;
      case EParameterType.FLOAT_VEC2:
        shaderMaterial.setVector2(uniform, Vector2.FromArray(value));
        return true;
      case EParameterType.FLOAT_VEC3:
        shaderMaterial.setVector3(uniform, Vector3.FromArray(value));
        return true;
      case EParameterType.FLOAT_VEC4:
        shaderMaterial.setVector4(uniform, Vector4.FromArray(value));
        return true;
      default:
        return false;
    }
  }
  /**
   * Returns the wrap mode of the texture
   * @param mode the mode value
   * @returns the wrap mode (TEXTURE_WRAP_ADDRESSMODE, MIRROR_ADDRESSMODE or CLAMP_ADDRESSMODE)
   */
  static GetWrapMode(mode) {
    switch (mode) {
      case ETextureWrapMode.CLAMP_TO_EDGE:
        return Texture.CLAMP_ADDRESSMODE;
      case ETextureWrapMode.MIRRORED_REPEAT:
        return Texture.MIRROR_ADDRESSMODE;
      case ETextureWrapMode.REPEAT:
        return Texture.WRAP_ADDRESSMODE;
      default:
        return Texture.WRAP_ADDRESSMODE;
    }
  }
  /**
   * Returns the byte stride giving an accessor
   * @param accessor the GLTF accessor objet
   * @returns the byte stride
   */
  static GetByteStrideFromType(accessor) {
    const type = accessor.type;
    switch (type) {
      case "VEC2":
        return 2;
      case "VEC3":
        return 3;
      case "VEC4":
        return 4;
      case "MAT2":
        return 4;
      case "MAT3":
        return 9;
      case "MAT4":
        return 16;
      default:
        return 1;
    }
  }
  /**
   * Returns the texture filter mode giving a mode value
   * @param mode the filter mode value
   * @returns the filter mode (TODO - needs to be a type?)
   */
  static GetTextureFilterMode(mode) {
    switch (mode) {
      case ETextureFilterType.LINEAR:
      case ETextureFilterType.LINEAR_MIPMAP_NEAREST:
      case ETextureFilterType.LINEAR_MIPMAP_LINEAR:
        return Texture.TRILINEAR_SAMPLINGMODE;
      case ETextureFilterType.NEAREST:
      case ETextureFilterType.NEAREST_MIPMAP_NEAREST:
        return Texture.NEAREST_SAMPLINGMODE;
      default:
        return Texture.BILINEAR_SAMPLINGMODE;
    }
  }
  static GetBufferFromBufferView(gltfRuntime, bufferView, byteOffset, byteLength, componentType) {
    byteOffset = bufferView.byteOffset + byteOffset;
    const loadedBufferView = gltfRuntime.loadedBufferViews[bufferView.buffer];
    if (byteOffset + byteLength > loadedBufferView.byteLength) {
      throw new Error("Buffer access is out of range");
    }
    const buffer = loadedBufferView.buffer;
    byteOffset += loadedBufferView.byteOffset;
    switch (componentType) {
      case EComponentType.BYTE:
        return new Int8Array(buffer, byteOffset, byteLength);
      case EComponentType.UNSIGNED_BYTE:
        return new Uint8Array(buffer, byteOffset, byteLength);
      case EComponentType.SHORT:
        return new Int16Array(buffer, byteOffset, byteLength);
      case EComponentType.UNSIGNED_SHORT:
        return new Uint16Array(buffer, byteOffset, byteLength);
      default:
        return new Float32Array(buffer, byteOffset, byteLength);
    }
  }
  /**
   * Returns a buffer from its accessor
   * @param gltfRuntime the GLTF runtime
   * @param accessor the GLTF accessor
   * @returns an array buffer view
   */
  static GetBufferFromAccessor(gltfRuntime, accessor) {
    const bufferView = gltfRuntime.bufferViews[accessor.bufferView];
    const byteLength = accessor.count * GLTFUtils.GetByteStrideFromType(accessor);
    return GLTFUtils.GetBufferFromBufferView(gltfRuntime, bufferView, accessor.byteOffset, byteLength, accessor.componentType);
  }
  /**
   * Decodes a buffer view into a string
   * @param view the buffer view
   * @returns a string
   */
  static DecodeBufferToText(view) {
    let result = "";
    const length = view.byteLength;
    for (let i = 0; i < length; ++i) {
      result += String.fromCharCode(view[i]);
    }
    return result;
  }
  /**
   * Returns the default material of gltf. Related to
   * https://github.com/KhronosGroup/glTF/tree/master/specification/1.0#appendix-a-default-material
   * @param scene the Babylon.js scene
   * @returns the default Babylon material
   */
  static GetDefaultMaterial(scene) {
    if (!GLTFUtils._DefaultMaterial) {
      Effect.ShadersStore["GLTFDefaultMaterialVertexShader"] = [
        "precision highp float;",
        "",
        "uniform mat4 worldView;",
        "uniform mat4 projection;",
        "",
        "attribute vec3 position;",
        "",
        "void main(void)",
        "{",
        "    gl_Position = projection * worldView * vec4(position, 1.0);",
        "}"
      ].join("\n");
      Effect.ShadersStore["GLTFDefaultMaterialPixelShader"] = [
        "precision highp float;",
        "",
        "uniform vec4 u_emission;",
        "",
        "void main(void)",
        "{",
        "    gl_FragColor = u_emission;",
        "}"
      ].join("\n");
      const shaderPath = {
        vertex: "GLTFDefaultMaterial",
        fragment: "GLTFDefaultMaterial"
      };
      const options = {
        attributes: ["position"],
        uniforms: ["worldView", "projection", "u_emission"],
        samplers: new Array(),
        needAlphaBlending: false
      };
      GLTFUtils._DefaultMaterial = new ShaderMaterial("GLTFDefaultMaterial", scene, shaderPath, options);
      GLTFUtils._DefaultMaterial.setColor4("u_emission", new Color4(0.5, 0.5, 0.5, 1));
    }
    return GLTFUtils._DefaultMaterial;
  }
}
GLTFUtils._DefaultMaterial = null;
var ETokenType;
(function(ETokenType2) {
  ETokenType2[ETokenType2["IDENTIFIER"] = 1] = "IDENTIFIER";
  ETokenType2[ETokenType2["UNKNOWN"] = 2] = "UNKNOWN";
  ETokenType2[ETokenType2["END_OF_INPUT"] = 3] = "END_OF_INPUT";
})(ETokenType || (ETokenType = {}));
class Tokenizer {
  constructor(toParse) {
    this._pos = 0;
    this.currentToken = ETokenType.UNKNOWN;
    this.currentIdentifier = "";
    this.currentString = "";
    this.isLetterOrDigitPattern = /^[a-zA-Z0-9]+$/;
    this._toParse = toParse;
    this._maxPos = toParse.length;
  }
  getNextToken() {
    if (this.isEnd()) {
      return ETokenType.END_OF_INPUT;
    }
    this.currentString = this.read();
    this.currentToken = ETokenType.UNKNOWN;
    if (this.currentString === "_" || this.isLetterOrDigitPattern.test(this.currentString)) {
      this.currentToken = ETokenType.IDENTIFIER;
      this.currentIdentifier = this.currentString;
      while (!this.isEnd() && (this.isLetterOrDigitPattern.test(this.currentString = this.peek()) || this.currentString === "_")) {
        this.currentIdentifier += this.currentString;
        this.forward();
      }
    }
    return this.currentToken;
  }
  peek() {
    return this._toParse[this._pos];
  }
  read() {
    return this._toParse[this._pos++];
  }
  forward() {
    this._pos++;
  }
  isEnd() {
    return this._pos >= this._maxPos;
  }
}
const glTFTransforms = ["MODEL", "VIEW", "PROJECTION", "MODELVIEW", "MODELVIEWPROJECTION", "JOINTMATRIX"];
const BabylonTransforms = ["world", "view", "projection", "worldView", "worldViewProjection", "mBones"];
const glTFAnimationPaths = ["translation", "rotation", "scale"];
const BabylonAnimationPaths = ["position", "rotationQuaternion", "scaling"];
const ParseBuffers = (parsedBuffers, gltfRuntime) => {
  for (const buf in parsedBuffers) {
    const parsedBuffer = parsedBuffers[buf];
    gltfRuntime.buffers[buf] = parsedBuffer;
    gltfRuntime.buffersCount++;
  }
};
const ParseShaders = (parsedShaders, gltfRuntime) => {
  for (const sha in parsedShaders) {
    const parsedShader = parsedShaders[sha];
    gltfRuntime.shaders[sha] = parsedShader;
    gltfRuntime.shaderscount++;
  }
};
const ParseObject = (parsedObjects, runtimeProperty, gltfRuntime) => {
  for (const object in parsedObjects) {
    const parsedObject = parsedObjects[object];
    gltfRuntime[runtimeProperty][object] = parsedObject;
  }
};
const NormalizeUVs = (buffer) => {
  if (!buffer) {
    return;
  }
  for (let i = 0; i < buffer.length / 2; i++) {
    buffer[i * 2 + 1] = 1 - buffer[i * 2 + 1];
  }
};
const GetAttribute = (attributeParameter) => {
  if (attributeParameter.semantic === "NORMAL") {
    return "normal";
  } else if (attributeParameter.semantic === "POSITION") {
    return "position";
  } else if (attributeParameter.semantic === "JOINT") {
    return "matricesIndices";
  } else if (attributeParameter.semantic === "WEIGHT") {
    return "matricesWeights";
  } else if (attributeParameter.semantic === "COLOR") {
    return "color";
  } else if (attributeParameter.semantic && attributeParameter.semantic.indexOf("TEXCOORD_") !== -1) {
    const channel = Number(attributeParameter.semantic.split("_")[1]);
    return "uv" + (channel === 0 ? "" : channel + 1);
  }
  return null;
};
const LoadAnimations = (gltfRuntime) => {
  for (const anim in gltfRuntime.animations) {
    const animation = gltfRuntime.animations[anim];
    if (!animation.channels || !animation.samplers) {
      continue;
    }
    let lastAnimation = null;
    for (let i = 0; i < animation.channels.length; i++) {
      const channel = animation.channels[i];
      const sampler = animation.samplers[channel.sampler];
      if (!sampler) {
        continue;
      }
      let inputData;
      let outputData;
      if (animation.parameters) {
        inputData = animation.parameters[sampler.input];
        outputData = animation.parameters[sampler.output];
      } else {
        inputData = sampler.input;
        outputData = sampler.output;
      }
      const bufferInput = GLTFUtils.GetBufferFromAccessor(gltfRuntime, gltfRuntime.accessors[inputData]);
      const bufferOutput = GLTFUtils.GetBufferFromAccessor(gltfRuntime, gltfRuntime.accessors[outputData]);
      const targetId = channel.target.id;
      let targetNode = gltfRuntime.scene.getNodeById(targetId);
      if (targetNode === null) {
        targetNode = gltfRuntime.scene.getNodeByName(targetId);
      }
      if (targetNode === null) {
        Tools.Warn("Creating animation named " + anim + ". But cannot find node named " + targetId + " to attach to");
        continue;
      }
      const isBone = targetNode instanceof Bone;
      let targetPath = channel.target.path;
      const targetPathIndex = glTFAnimationPaths.indexOf(targetPath);
      if (targetPathIndex !== -1) {
        targetPath = BabylonAnimationPaths[targetPathIndex];
      }
      let animationType = Animation.ANIMATIONTYPE_MATRIX;
      if (!isBone) {
        if (targetPath === "rotationQuaternion") {
          animationType = Animation.ANIMATIONTYPE_QUATERNION;
          targetNode.rotationQuaternion = new Quaternion();
        } else {
          animationType = Animation.ANIMATIONTYPE_VECTOR3;
        }
      }
      let babylonAnimation = null;
      const keys = [];
      let arrayOffset = 0;
      let modifyKey = false;
      if (isBone && lastAnimation && lastAnimation.getKeys().length === bufferInput.length) {
        babylonAnimation = lastAnimation;
        modifyKey = true;
      }
      if (!modifyKey) {
        gltfRuntime.scene._blockEntityCollection = !!gltfRuntime.assetContainer;
        babylonAnimation = new Animation(anim, isBone ? "_matrix" : targetPath, 1, animationType, Animation.ANIMATIONLOOPMODE_CYCLE);
        gltfRuntime.scene._blockEntityCollection = false;
      }
      for (let j = 0; j < bufferInput.length; j++) {
        let value;
        if (targetPath === "rotationQuaternion") {
          value = Quaternion.FromArray([bufferOutput[arrayOffset], bufferOutput[arrayOffset + 1], bufferOutput[arrayOffset + 2], bufferOutput[arrayOffset + 3]]);
          arrayOffset += 4;
        } else {
          value = Vector3.FromArray([bufferOutput[arrayOffset], bufferOutput[arrayOffset + 1], bufferOutput[arrayOffset + 2]]);
          arrayOffset += 3;
        }
        if (isBone) {
          const bone = targetNode;
          let translation = Vector3.Zero();
          let rotationQuaternion = new Quaternion();
          let scaling = Vector3.Zero();
          let mat = bone.getBaseMatrix();
          if (modifyKey && lastAnimation) {
            mat = lastAnimation.getKeys()[j].value;
          }
          mat.decompose(scaling, rotationQuaternion, translation);
          if (targetPath === "position") {
            translation = value;
          } else if (targetPath === "rotationQuaternion") {
            rotationQuaternion = value;
          } else {
            scaling = value;
          }
          value = Matrix.Compose(scaling, rotationQuaternion, translation);
        }
        if (!modifyKey) {
          keys.push({
            frame: bufferInput[j],
            value
          });
        } else if (lastAnimation) {
          lastAnimation.getKeys()[j].value = value;
        }
      }
      if (!modifyKey && babylonAnimation) {
        babylonAnimation.setKeys(keys);
        targetNode.animations.push(babylonAnimation);
      }
      lastAnimation = babylonAnimation;
      gltfRuntime.scene.stopAnimation(targetNode);
      gltfRuntime.scene.beginAnimation(targetNode, 0, bufferInput[bufferInput.length - 1], true, 1);
    }
  }
};
const ConfigureBoneTransformation = (node) => {
  let mat;
  if (node.translation || node.rotation || node.scale) {
    const scale = Vector3.FromArray(node.scale || [1, 1, 1]);
    const rotation = Quaternion.FromArray(node.rotation || [0, 0, 0, 1]);
    const position = Vector3.FromArray(node.translation || [0, 0, 0]);
    mat = Matrix.Compose(scale, rotation, position);
  } else {
    mat = Matrix.FromArray(node.matrix);
  }
  return mat;
};
const GetParentBone = (gltfRuntime, skins, jointName, newSkeleton) => {
  for (let i = 0; i < newSkeleton.bones.length; i++) {
    if (newSkeleton.bones[i].name === jointName) {
      return newSkeleton.bones[i];
    }
  }
  const nodes = gltfRuntime.nodes;
  for (const nde in nodes) {
    const node = nodes[nde];
    if (!node.jointName) {
      continue;
    }
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      const child = gltfRuntime.nodes[children[i]];
      if (!child.jointName) {
        continue;
      }
      if (child.jointName === jointName) {
        const mat = ConfigureBoneTransformation(node);
        const bone = new Bone(node.name || "", newSkeleton, GetParentBone(gltfRuntime, skins, node.jointName, newSkeleton), mat);
        bone.id = nde;
        return bone;
      }
    }
  }
  return null;
};
const GetNodeToRoot = (nodesToRoot, id) => {
  for (let i = 0; i < nodesToRoot.length; i++) {
    const nodeToRoot = nodesToRoot[i];
    for (let j = 0; j < nodeToRoot.node.children.length; j++) {
      const child = nodeToRoot.node.children[j];
      if (child === id) {
        return nodeToRoot.bone;
      }
    }
  }
  return null;
};
const GetJointNode = (gltfRuntime, jointName) => {
  const nodes = gltfRuntime.nodes;
  let node = nodes[jointName];
  if (node) {
    return {
      node,
      id: jointName
    };
  }
  for (const nde in nodes) {
    node = nodes[nde];
    if (node.jointName === jointName) {
      return {
        node,
        id: nde
      };
    }
  }
  return null;
};
const NodeIsInJoints = (skins, id) => {
  for (let i = 0; i < skins.jointNames.length; i++) {
    if (skins.jointNames[i] === id) {
      return true;
    }
  }
  return false;
};
const GetNodesToRoot = (gltfRuntime, newSkeleton, skins, nodesToRoot) => {
  for (const nde in gltfRuntime.nodes) {
    const node = gltfRuntime.nodes[nde];
    const id = nde;
    if (!node.jointName || NodeIsInJoints(skins, node.jointName)) {
      continue;
    }
    const mat = ConfigureBoneTransformation(node);
    const bone = new Bone(node.name || "", newSkeleton, null, mat);
    bone.id = id;
    nodesToRoot.push({ bone, node, id });
  }
  for (let i = 0; i < nodesToRoot.length; i++) {
    const nodeToRoot = nodesToRoot[i];
    const children = nodeToRoot.node.children;
    for (let j = 0; j < children.length; j++) {
      let child = null;
      for (let k = 0; k < nodesToRoot.length; k++) {
        if (nodesToRoot[k].id === children[j]) {
          child = nodesToRoot[k];
          break;
        }
      }
      if (child) {
        child.bone._parent = nodeToRoot.bone;
        nodeToRoot.bone.children.push(child.bone);
      }
    }
  }
};
const ImportSkeleton = (gltfRuntime, skins, mesh, newSkeleton) => {
  if (!newSkeleton) {
    newSkeleton = new Skeleton(skins.name || "", "", gltfRuntime.scene);
  }
  if (!skins.babylonSkeleton) {
    return newSkeleton;
  }
  const nodesToRoot = [];
  const nodesToRootToAdd = [];
  GetNodesToRoot(gltfRuntime, newSkeleton, skins, nodesToRoot);
  newSkeleton.bones = [];
  for (let i = 0; i < skins.jointNames.length; i++) {
    const jointNode = GetJointNode(gltfRuntime, skins.jointNames[i]);
    if (!jointNode) {
      continue;
    }
    const node = jointNode.node;
    if (!node) {
      Tools.Warn("Joint named " + skins.jointNames[i] + " does not exist");
      continue;
    }
    const id = jointNode.id;
    const existingBone = gltfRuntime.scene.getBoneById(id);
    if (existingBone) {
      newSkeleton.bones.push(existingBone);
      continue;
    }
    let foundBone;
    let parentBone = null;
    for (let j = 0; j < i; j++) {
      const jointNode2 = GetJointNode(gltfRuntime, skins.jointNames[j]);
      if (!jointNode2) {
        continue;
      }
      const joint = jointNode2.node;
      if (!joint) {
        Tools.Warn("Joint named " + skins.jointNames[j] + " does not exist when looking for parent");
        continue;
      }
      const children = joint.children;
      if (!children) {
        continue;
      }
      foundBone = false;
      for (let k = 0; k < children.length; k++) {
        if (children[k] === id) {
          parentBone = GetParentBone(gltfRuntime, skins, skins.jointNames[j], newSkeleton);
          foundBone = true;
          break;
        }
      }
      if (foundBone) {
        break;
      }
    }
    const mat = ConfigureBoneTransformation(node);
    if (!parentBone && nodesToRoot.length > 0) {
      parentBone = GetNodeToRoot(nodesToRoot, id);
      if (parentBone) {
        if (nodesToRootToAdd.indexOf(parentBone) === -1) {
          nodesToRootToAdd.push(parentBone);
        }
      }
    }
    const bone = new Bone(node.jointName || "", newSkeleton, parentBone, mat);
    bone.id = id;
  }
  const bones = newSkeleton.bones;
  newSkeleton.bones = [];
  for (let i = 0; i < skins.jointNames.length; i++) {
    const jointNode = GetJointNode(gltfRuntime, skins.jointNames[i]);
    if (!jointNode) {
      continue;
    }
    for (let j = 0; j < bones.length; j++) {
      if (bones[j].id === jointNode.id) {
        newSkeleton.bones.push(bones[j]);
        break;
      }
    }
  }
  newSkeleton.prepare();
  for (let i = 0; i < nodesToRootToAdd.length; i++) {
    newSkeleton.bones.push(nodesToRootToAdd[i]);
  }
  return newSkeleton;
};
const ImportMesh = (gltfRuntime, node, meshes, id, newMesh) => {
  if (!newMesh) {
    gltfRuntime.scene._blockEntityCollection = !!gltfRuntime.assetContainer;
    newMesh = new Mesh(node.name || "", gltfRuntime.scene);
    newMesh._parentContainer = gltfRuntime.assetContainer;
    gltfRuntime.scene._blockEntityCollection = false;
    newMesh.id = id;
  }
  if (!node.babylonNode) {
    return newMesh;
  }
  const subMaterials = [];
  let vertexData = null;
  const verticesStarts = [];
  const verticesCounts = [];
  const indexStarts = [];
  const indexCounts = [];
  for (let meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
    const meshId = meshes[meshIndex];
    const mesh = gltfRuntime.meshes[meshId];
    if (!mesh) {
      continue;
    }
    for (let i = 0; i < mesh.primitives.length; i++) {
      const tempVertexData = new VertexData();
      const primitive = mesh.primitives[i];
      if (primitive.mode !== 4) ;
      const attributes = primitive.attributes;
      let accessor;
      let buffer;
      for (const semantic in attributes) {
        accessor = gltfRuntime.accessors[attributes[semantic]];
        buffer = GLTFUtils.GetBufferFromAccessor(gltfRuntime, accessor);
        if (semantic === "NORMAL") {
          tempVertexData.normals = new Float32Array(buffer.length);
          tempVertexData.normals.set(buffer);
        } else if (semantic === "POSITION") {
          if (GLTFFileLoader.HomogeneousCoordinates) {
            tempVertexData.positions = new Float32Array(buffer.length - buffer.length / 4);
            for (let j = 0; j < buffer.length; j += 4) {
              tempVertexData.positions[j] = buffer[j];
              tempVertexData.positions[j + 1] = buffer[j + 1];
              tempVertexData.positions[j + 2] = buffer[j + 2];
            }
          } else {
            tempVertexData.positions = new Float32Array(buffer.length);
            tempVertexData.positions.set(buffer);
          }
          verticesCounts.push(tempVertexData.positions.length);
        } else if (semantic.indexOf("TEXCOORD_") !== -1) {
          const channel = Number(semantic.split("_")[1]);
          const uvKind = VertexBuffer.UVKind + (channel === 0 ? "" : channel + 1);
          const uvs = new Float32Array(buffer.length);
          uvs.set(buffer);
          NormalizeUVs(uvs);
          tempVertexData.set(uvs, uvKind);
        } else if (semantic === "JOINT") {
          tempVertexData.matricesIndices = new Float32Array(buffer.length);
          tempVertexData.matricesIndices.set(buffer);
        } else if (semantic === "WEIGHT") {
          tempVertexData.matricesWeights = new Float32Array(buffer.length);
          tempVertexData.matricesWeights.set(buffer);
        } else if (semantic === "COLOR") {
          tempVertexData.colors = new Float32Array(buffer.length);
          tempVertexData.colors.set(buffer);
        }
      }
      accessor = gltfRuntime.accessors[primitive.indices];
      if (accessor) {
        buffer = GLTFUtils.GetBufferFromAccessor(gltfRuntime, accessor);
        tempVertexData.indices = new Int32Array(buffer.length);
        tempVertexData.indices.set(buffer);
        indexCounts.push(tempVertexData.indices.length);
      } else {
        const indices = [];
        for (let j = 0; j < tempVertexData.positions.length / 3; j++) {
          indices.push(j);
        }
        tempVertexData.indices = new Int32Array(indices);
        indexCounts.push(tempVertexData.indices.length);
      }
      if (!vertexData) {
        vertexData = tempVertexData;
      } else {
        vertexData.merge(tempVertexData);
      }
      const material2 = gltfRuntime.scene.getMaterialById(primitive.material);
      subMaterials.push(material2 === null ? GLTFUtils.GetDefaultMaterial(gltfRuntime.scene) : material2);
      verticesStarts.push(verticesStarts.length === 0 ? 0 : verticesStarts[verticesStarts.length - 1] + verticesCounts[verticesCounts.length - 2]);
      indexStarts.push(indexStarts.length === 0 ? 0 : indexStarts[indexStarts.length - 1] + indexCounts[indexCounts.length - 2]);
    }
  }
  let material;
  gltfRuntime.scene._blockEntityCollection = !!gltfRuntime.assetContainer;
  if (subMaterials.length > 1) {
    material = new MultiMaterial("multimat" + id, gltfRuntime.scene);
    material.subMaterials = subMaterials;
  } else {
    material = new StandardMaterial("multimat" + id, gltfRuntime.scene);
  }
  if (subMaterials.length === 1) {
    material = subMaterials[0];
  }
  material._parentContainer = gltfRuntime.assetContainer;
  if (!newMesh.material) {
    newMesh.material = material;
  }
  new Geometry(id, gltfRuntime.scene, vertexData, false, newMesh);
  newMesh.computeWorldMatrix(true);
  gltfRuntime.scene._blockEntityCollection = false;
  newMesh.subMeshes = [];
  let index = 0;
  for (let meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
    const meshId = meshes[meshIndex];
    const mesh = gltfRuntime.meshes[meshId];
    if (!mesh) {
      continue;
    }
    for (let i = 0; i < mesh.primitives.length; i++) {
      if (mesh.primitives[i].mode !== 4) ;
      SubMesh.AddToMesh(index, verticesStarts[index], verticesCounts[index], indexStarts[index], indexCounts[index], newMesh, newMesh, true);
      index++;
    }
  }
  return newMesh;
};
const ConfigureNode = (newNode, position, rotation, scaling) => {
  if (newNode.position) {
    newNode.position = position;
  }
  if (newNode.rotationQuaternion || newNode.rotation) {
    newNode.rotationQuaternion = rotation;
  }
  if (newNode.scaling) {
    newNode.scaling = scaling;
  }
};
const ConfigureNodeFromMatrix = (newNode, node) => {
  if (node.matrix) {
    const position = new Vector3(0, 0, 0);
    const rotation = new Quaternion();
    const scaling = new Vector3(0, 0, 0);
    const mat = Matrix.FromArray(node.matrix);
    mat.decompose(scaling, rotation, position);
    ConfigureNode(newNode, position, rotation, scaling);
  } else if (node.translation && node.rotation && node.scale) {
    ConfigureNode(newNode, Vector3.FromArray(node.translation), Quaternion.FromArray(node.rotation), Vector3.FromArray(node.scale));
  }
  newNode.computeWorldMatrix(true);
};
const ImportNode = (gltfRuntime, node, id) => {
  let lastNode = null;
  if (gltfRuntime.importOnlyMeshes && (node.skin || node.meshes)) {
    if (gltfRuntime.importMeshesNames && gltfRuntime.importMeshesNames.length > 0 && gltfRuntime.importMeshesNames.indexOf(node.name || "") === -1) {
      return null;
    }
  }
  if (node.skin) {
    if (node.meshes) {
      const skin = gltfRuntime.skins[node.skin];
      const newMesh = ImportMesh(gltfRuntime, node, node.meshes, id, node.babylonNode);
      newMesh.skeleton = gltfRuntime.scene.getLastSkeletonById(node.skin);
      if (newMesh.skeleton === null) {
        newMesh.skeleton = ImportSkeleton(gltfRuntime, skin, newMesh, skin.babylonSkeleton);
        if (!skin.babylonSkeleton) {
          skin.babylonSkeleton = newMesh.skeleton;
        }
      }
      lastNode = newMesh;
    }
  } else if (node.meshes) {
    const newMesh = ImportMesh(gltfRuntime, node, node.mesh ? [node.mesh] : node.meshes, id, node.babylonNode);
    lastNode = newMesh;
  } else if (node.light && !node.babylonNode && !gltfRuntime.importOnlyMeshes) {
    const light = gltfRuntime.lights[node.light];
    if (light) {
      if (light.type === "ambient") {
        const ambienLight = light[light.type];
        const hemiLight = new HemisphericLight(node.light, Vector3.Zero(), gltfRuntime.scene);
        hemiLight.name = node.name || "";
        if (ambienLight.color) {
          hemiLight.diffuse = Color3.FromArray(ambienLight.color);
        }
        lastNode = hemiLight;
      } else if (light.type === "directional") {
        const directionalLight = light[light.type];
        const dirLight = new DirectionalLight(node.light, Vector3.Zero(), gltfRuntime.scene);
        dirLight.name = node.name || "";
        if (directionalLight.color) {
          dirLight.diffuse = Color3.FromArray(directionalLight.color);
        }
        lastNode = dirLight;
      } else if (light.type === "point") {
        const pointLight = light[light.type];
        const ptLight = new PointLight(node.light, Vector3.Zero(), gltfRuntime.scene);
        ptLight.name = node.name || "";
        if (pointLight.color) {
          ptLight.diffuse = Color3.FromArray(pointLight.color);
        }
        lastNode = ptLight;
      } else if (light.type === "spot") {
        const spotLight = light[light.type];
        const spLight = new SpotLight(node.light, Vector3.Zero(), Vector3.Zero(), 0, 0, gltfRuntime.scene);
        spLight.name = node.name || "";
        if (spotLight.color) {
          spLight.diffuse = Color3.FromArray(spotLight.color);
        }
        if (spotLight.fallOfAngle) {
          spLight.angle = spotLight.fallOfAngle;
        }
        if (spotLight.fallOffExponent) {
          spLight.exponent = spotLight.fallOffExponent;
        }
        lastNode = spLight;
      }
    }
  } else if (node.camera && !node.babylonNode && !gltfRuntime.importOnlyMeshes) {
    const camera = gltfRuntime.cameras[node.camera];
    if (camera) {
      gltfRuntime.scene._blockEntityCollection = !!gltfRuntime.assetContainer;
      if (camera.type === "orthographic") {
        const orthoCamera = new FreeCamera(node.camera, Vector3.Zero(), gltfRuntime.scene, false);
        orthoCamera.name = node.name || "";
        orthoCamera.mode = Camera.ORTHOGRAPHIC_CAMERA;
        orthoCamera.attachControl();
        lastNode = orthoCamera;
        orthoCamera._parentContainer = gltfRuntime.assetContainer;
      } else if (camera.type === "perspective") {
        const perspectiveCamera = camera[camera.type];
        const persCamera = new FreeCamera(node.camera, Vector3.Zero(), gltfRuntime.scene, false);
        persCamera.name = node.name || "";
        persCamera.attachControl();
        if (!perspectiveCamera.aspectRatio) {
          perspectiveCamera.aspectRatio = gltfRuntime.scene.getEngine().getRenderWidth() / gltfRuntime.scene.getEngine().getRenderHeight();
        }
        if (perspectiveCamera.znear && perspectiveCamera.zfar) {
          persCamera.maxZ = perspectiveCamera.zfar;
          persCamera.minZ = perspectiveCamera.znear;
        }
        lastNode = persCamera;
        persCamera._parentContainer = gltfRuntime.assetContainer;
      }
      gltfRuntime.scene._blockEntityCollection = false;
    }
  }
  if (!node.jointName) {
    if (node.babylonNode) {
      return node.babylonNode;
    } else if (lastNode === null) {
      gltfRuntime.scene._blockEntityCollection = !!gltfRuntime.assetContainer;
      const dummy = new Mesh(node.name || "", gltfRuntime.scene);
      dummy._parentContainer = gltfRuntime.assetContainer;
      gltfRuntime.scene._blockEntityCollection = false;
      node.babylonNode = dummy;
      lastNode = dummy;
    }
  }
  if (lastNode !== null) {
    if (node.matrix && lastNode instanceof Mesh) {
      ConfigureNodeFromMatrix(lastNode, node);
    } else {
      const translation = node.translation || [0, 0, 0];
      const rotation = node.rotation || [0, 0, 0, 1];
      const scale = node.scale || [1, 1, 1];
      ConfigureNode(lastNode, Vector3.FromArray(translation), Quaternion.FromArray(rotation), Vector3.FromArray(scale));
    }
    lastNode.updateCache(true);
    node.babylonNode = lastNode;
  }
  return lastNode;
};
const TraverseNodes = (gltfRuntime, id, parent, meshIncluded = false) => {
  const node = gltfRuntime.nodes[id];
  let newNode = null;
  if (gltfRuntime.importOnlyMeshes && !meshIncluded && gltfRuntime.importMeshesNames) {
    if (gltfRuntime.importMeshesNames.indexOf(node.name || "") !== -1 || gltfRuntime.importMeshesNames.length === 0) {
      meshIncluded = true;
    } else {
      meshIncluded = false;
    }
  } else {
    meshIncluded = true;
  }
  if (!node.jointName && meshIncluded) {
    newNode = ImportNode(gltfRuntime, node, id);
    if (newNode !== null) {
      newNode.id = id;
      newNode.parent = parent;
    }
  }
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      TraverseNodes(gltfRuntime, node.children[i], newNode, meshIncluded);
    }
  }
};
const PostLoad = (gltfRuntime) => {
  let currentScene = gltfRuntime.currentScene;
  if (currentScene) {
    for (let i = 0; i < currentScene.nodes.length; i++) {
      TraverseNodes(gltfRuntime, currentScene.nodes[i], null);
    }
  } else {
    for (const thing in gltfRuntime.scenes) {
      currentScene = gltfRuntime.scenes[thing];
      for (let i = 0; i < currentScene.nodes.length; i++) {
        TraverseNodes(gltfRuntime, currentScene.nodes[i], null);
      }
    }
  }
  LoadAnimations(gltfRuntime);
  for (let i = 0; i < gltfRuntime.scene.skeletons.length; i++) {
    const skeleton = gltfRuntime.scene.skeletons[i];
    gltfRuntime.scene.beginAnimation(skeleton, 0, Number.MAX_VALUE, true, 1);
  }
};
const OnBindShaderMaterial = (mesh, gltfRuntime, unTreatedUniforms, shaderMaterial, technique, material, onSuccess) => {
  const materialValues = material.values || technique.parameters;
  for (const unif in unTreatedUniforms) {
    const uniform = unTreatedUniforms[unif];
    const type = uniform.type;
    if (type === EParameterType.FLOAT_MAT2 || type === EParameterType.FLOAT_MAT3 || type === EParameterType.FLOAT_MAT4) {
      if (uniform.semantic && !uniform.source && !uniform.node) {
        GLTFUtils.SetMatrix(gltfRuntime.scene, mesh, uniform, unif, shaderMaterial.getEffect());
      } else if (uniform.semantic && (uniform.source || uniform.node)) {
        let source = gltfRuntime.scene.getNodeByName(uniform.source || uniform.node || "");
        if (source === null) {
          source = gltfRuntime.scene.getNodeById(uniform.source || uniform.node || "");
        }
        if (source === null) {
          continue;
        }
        GLTFUtils.SetMatrix(gltfRuntime.scene, source, uniform, unif, shaderMaterial.getEffect());
      }
    } else {
      const value = materialValues[technique.uniforms[unif]];
      if (!value) {
        continue;
      }
      if (type === EParameterType.SAMPLER_2D) {
        const texture = gltfRuntime.textures[material.values ? value : uniform.value].babylonTexture;
        if (texture === null || texture === void 0) {
          continue;
        }
        shaderMaterial.getEffect().setTexture(unif, texture);
      } else {
        GLTFUtils.SetUniform(shaderMaterial.getEffect(), unif, value, type);
      }
    }
  }
  onSuccess(shaderMaterial);
};
const PrepareShaderMaterialUniforms = (gltfRuntime, shaderMaterial, technique, material, unTreatedUniforms) => {
  const materialValues = material.values || technique.parameters;
  const techniqueUniforms = technique.uniforms;
  for (const unif in unTreatedUniforms) {
    const uniform = unTreatedUniforms[unif];
    const type = uniform.type;
    let value = materialValues[techniqueUniforms[unif]];
    if (value === void 0) {
      value = uniform.value;
    }
    if (!value) {
      continue;
    }
    const onLoadTexture = (uniformName) => {
      return (texture) => {
        if (uniform.value && uniformName) {
          shaderMaterial.setTexture(uniformName, texture);
          delete unTreatedUniforms[uniformName];
        }
      };
    };
    if (type === EParameterType.SAMPLER_2D) {
      GLTFLoaderExtension.LoadTextureAsync(gltfRuntime, material.values ? value : uniform.value, onLoadTexture(unif), () => onLoadTexture(null));
    } else {
      if (uniform.value && GLTFUtils.SetUniform(shaderMaterial, unif, material.values ? value : uniform.value, type)) {
        delete unTreatedUniforms[unif];
      }
    }
  }
};
const OnShaderCompileError = (program, shaderMaterial, onError) => {
  return (effect, error) => {
    shaderMaterial.dispose(true);
    onError("Cannot compile program named " + program.name + ". Error: " + error + ". Default material will be applied");
  };
};
const OnShaderCompileSuccess = (gltfRuntime, shaderMaterial, technique, material, unTreatedUniforms, onSuccess) => {
  return (_) => {
    PrepareShaderMaterialUniforms(gltfRuntime, shaderMaterial, technique, material, unTreatedUniforms);
    shaderMaterial.onBind = (mesh) => {
      OnBindShaderMaterial(mesh, gltfRuntime, unTreatedUniforms, shaderMaterial, technique, material, onSuccess);
    };
  };
};
const ParseShaderUniforms = (tokenizer, technique, unTreatedUniforms) => {
  for (const unif in technique.uniforms) {
    const uniform = technique.uniforms[unif];
    const uniformParameter = technique.parameters[uniform];
    if (tokenizer.currentIdentifier === unif) {
      if (uniformParameter.semantic && !uniformParameter.source && !uniformParameter.node) {
        const transformIndex = glTFTransforms.indexOf(uniformParameter.semantic);
        if (transformIndex !== -1) {
          delete unTreatedUniforms[unif];
          return BabylonTransforms[transformIndex];
        }
      }
    }
  }
  return tokenizer.currentIdentifier;
};
const ImportMaterials = (gltfRuntime) => {
  for (const mat in gltfRuntime.materials) {
    GLTFLoaderExtension.LoadMaterialAsync(gltfRuntime, mat, () => {
    }, () => {
    });
  }
};
class GLTFLoaderBase {
  static CreateRuntime(parsedData, scene, rootUrl) {
    const gltfRuntime = {
      extensions: {},
      accessors: {},
      buffers: {},
      bufferViews: {},
      meshes: {},
      lights: {},
      cameras: {},
      nodes: {},
      images: {},
      textures: {},
      shaders: {},
      programs: {},
      samplers: {},
      techniques: {},
      materials: {},
      animations: {},
      skins: {},
      extensionsUsed: [],
      scenes: {},
      buffersCount: 0,
      shaderscount: 0,
      scene,
      rootUrl,
      loadedBufferCount: 0,
      loadedBufferViews: {},
      loadedShaderCount: 0,
      importOnlyMeshes: false,
      dummyNodes: [],
      assetContainer: null
    };
    if (parsedData.extensions) {
      ParseObject(parsedData.extensions, "extensions", gltfRuntime);
    }
    if (parsedData.extensionsUsed) {
      ParseObject(parsedData.extensionsUsed, "extensionsUsed", gltfRuntime);
    }
    if (parsedData.buffers) {
      ParseBuffers(parsedData.buffers, gltfRuntime);
    }
    if (parsedData.bufferViews) {
      ParseObject(parsedData.bufferViews, "bufferViews", gltfRuntime);
    }
    if (parsedData.accessors) {
      ParseObject(parsedData.accessors, "accessors", gltfRuntime);
    }
    if (parsedData.meshes) {
      ParseObject(parsedData.meshes, "meshes", gltfRuntime);
    }
    if (parsedData.lights) {
      ParseObject(parsedData.lights, "lights", gltfRuntime);
    }
    if (parsedData.cameras) {
      ParseObject(parsedData.cameras, "cameras", gltfRuntime);
    }
    if (parsedData.nodes) {
      ParseObject(parsedData.nodes, "nodes", gltfRuntime);
    }
    if (parsedData.images) {
      ParseObject(parsedData.images, "images", gltfRuntime);
    }
    if (parsedData.textures) {
      ParseObject(parsedData.textures, "textures", gltfRuntime);
    }
    if (parsedData.shaders) {
      ParseShaders(parsedData.shaders, gltfRuntime);
    }
    if (parsedData.programs) {
      ParseObject(parsedData.programs, "programs", gltfRuntime);
    }
    if (parsedData.samplers) {
      ParseObject(parsedData.samplers, "samplers", gltfRuntime);
    }
    if (parsedData.techniques) {
      ParseObject(parsedData.techniques, "techniques", gltfRuntime);
    }
    if (parsedData.materials) {
      ParseObject(parsedData.materials, "materials", gltfRuntime);
    }
    if (parsedData.animations) {
      ParseObject(parsedData.animations, "animations", gltfRuntime);
    }
    if (parsedData.skins) {
      ParseObject(parsedData.skins, "skins", gltfRuntime);
    }
    if (parsedData.scenes) {
      gltfRuntime.scenes = parsedData.scenes;
    }
    if (parsedData.scene && parsedData.scenes) {
      gltfRuntime.currentScene = parsedData.scenes[parsedData.scene];
    }
    return gltfRuntime;
  }
  // eslint-disable-next-line no-restricted-syntax
  static LoadBufferAsync(gltfRuntime, id, onSuccess, onError, onProgress) {
    const buffer = gltfRuntime.buffers[id];
    if (Tools.IsBase64(buffer.uri)) {
      setTimeout(() => onSuccess(new Uint8Array(Tools.DecodeBase64(buffer.uri))));
    } else {
      Tools.LoadFile(gltfRuntime.rootUrl + buffer.uri, (data) => onSuccess(new Uint8Array(data)), onProgress, void 0, true, (request) => {
        if (request) {
          onError(request.status + " " + request.statusText);
        }
      });
    }
  }
  // eslint-disable-next-line no-restricted-syntax
  static LoadTextureBufferAsync(gltfRuntime, id, onSuccess, onError) {
    const texture = gltfRuntime.textures[id];
    if (!texture || !texture.source) {
      onError("");
      return;
    }
    if (texture.babylonTexture) {
      onSuccess(null);
      return;
    }
    const source = gltfRuntime.images[texture.source];
    if (Tools.IsBase64(source.uri)) {
      setTimeout(() => onSuccess(new Uint8Array(Tools.DecodeBase64(source.uri))));
    } else {
      Tools.LoadFile(gltfRuntime.rootUrl + source.uri, (data) => onSuccess(new Uint8Array(data)), void 0, void 0, true, (request) => {
        if (request) {
          onError(request.status + " " + request.statusText);
        }
      });
    }
  }
  // eslint-disable-next-line no-restricted-syntax
  static CreateTextureAsync(gltfRuntime, id, buffer, onSuccess) {
    const texture = gltfRuntime.textures[id];
    if (texture.babylonTexture) {
      onSuccess(texture.babylonTexture);
      return;
    }
    const sampler = gltfRuntime.samplers[texture.sampler];
    const createMipMaps = sampler.minFilter === ETextureFilterType.NEAREST_MIPMAP_NEAREST || sampler.minFilter === ETextureFilterType.NEAREST_MIPMAP_LINEAR || sampler.minFilter === ETextureFilterType.LINEAR_MIPMAP_NEAREST || sampler.minFilter === ETextureFilterType.LINEAR_MIPMAP_LINEAR;
    const samplingMode = Texture.BILINEAR_SAMPLINGMODE;
    const blob = buffer == null ? new Blob() : new Blob([GetBlobBufferSource(buffer)]);
    const blobURL = URL.createObjectURL(blob);
    const revokeBlobURL = () => URL.revokeObjectURL(blobURL);
    const newTexture = new Texture(blobURL, gltfRuntime.scene, !createMipMaps, true, samplingMode, revokeBlobURL, revokeBlobURL);
    if (sampler.wrapS !== void 0) {
      newTexture.wrapU = GLTFUtils.GetWrapMode(sampler.wrapS);
    }
    if (sampler.wrapT !== void 0) {
      newTexture.wrapV = GLTFUtils.GetWrapMode(sampler.wrapT);
    }
    newTexture.name = id;
    texture.babylonTexture = newTexture;
    onSuccess(newTexture);
  }
  // eslint-disable-next-line no-restricted-syntax
  static LoadShaderStringAsync(gltfRuntime, id, onSuccess, onError) {
    const shader = gltfRuntime.shaders[id];
    if (Tools.IsBase64(shader.uri)) {
      const shaderString = atob(shader.uri.split(",")[1]);
      if (onSuccess) {
        onSuccess(shaderString);
      }
    } else {
      Tools.LoadFile(gltfRuntime.rootUrl + shader.uri, onSuccess, void 0, void 0, false, (request) => {
        if (request && onError) {
          onError(request.status + " " + request.statusText);
        }
      });
    }
  }
  // eslint-disable-next-line no-restricted-syntax
  static LoadMaterialAsync(gltfRuntime, id, onSuccess, onError) {
    const material = gltfRuntime.materials[id];
    if (!material.technique) {
      if (onError) {
        onError("No technique found.");
      }
      return;
    }
    const technique = gltfRuntime.techniques[material.technique];
    if (!technique) {
      gltfRuntime.scene._blockEntityCollection = !!gltfRuntime.assetContainer;
      const defaultMaterial = new StandardMaterial(id, gltfRuntime.scene);
      defaultMaterial._parentContainer = gltfRuntime.assetContainer;
      gltfRuntime.scene._blockEntityCollection = false;
      defaultMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
      defaultMaterial.sideOrientation = Material.CounterClockWiseSideOrientation;
      onSuccess(defaultMaterial);
      return;
    }
    const program = gltfRuntime.programs[technique.program];
    const states = technique.states;
    const vertexShader = Effect.ShadersStore[program.vertexShader + "VertexShader"];
    const pixelShader = Effect.ShadersStore[program.fragmentShader + "PixelShader"];
    let newVertexShader = "";
    let newPixelShader = "";
    const vertexTokenizer = new Tokenizer(vertexShader);
    const pixelTokenizer = new Tokenizer(pixelShader);
    const unTreatedUniforms = {};
    const uniforms = [];
    const attributes = [];
    const samplers = [];
    for (const unif in technique.uniforms) {
      const uniform = technique.uniforms[unif];
      const uniformParameter = technique.parameters[uniform];
      unTreatedUniforms[unif] = uniformParameter;
      if (uniformParameter.semantic && !uniformParameter.node && !uniformParameter.source) {
        const transformIndex = glTFTransforms.indexOf(uniformParameter.semantic);
        if (transformIndex !== -1) {
          uniforms.push(BabylonTransforms[transformIndex]);
          delete unTreatedUniforms[unif];
        } else {
          uniforms.push(unif);
        }
      } else if (uniformParameter.type === EParameterType.SAMPLER_2D) {
        samplers.push(unif);
      } else {
        uniforms.push(unif);
      }
    }
    for (const attr in technique.attributes) {
      const attribute = technique.attributes[attr];
      const attributeParameter = technique.parameters[attribute];
      if (attributeParameter.semantic) {
        const name = GetAttribute(attributeParameter);
        if (name) {
          attributes.push(name);
        }
      }
    }
    while (!vertexTokenizer.isEnd() && vertexTokenizer.getNextToken()) {
      const tokenType = vertexTokenizer.currentToken;
      if (tokenType !== ETokenType.IDENTIFIER) {
        newVertexShader += vertexTokenizer.currentString;
        continue;
      }
      let foundAttribute = false;
      for (const attr in technique.attributes) {
        const attribute = technique.attributes[attr];
        const attributeParameter = technique.parameters[attribute];
        if (vertexTokenizer.currentIdentifier === attr && attributeParameter.semantic) {
          newVertexShader += GetAttribute(attributeParameter);
          foundAttribute = true;
          break;
        }
      }
      if (foundAttribute) {
        continue;
      }
      newVertexShader += ParseShaderUniforms(vertexTokenizer, technique, unTreatedUniforms);
    }
    while (!pixelTokenizer.isEnd() && pixelTokenizer.getNextToken()) {
      const tokenType = pixelTokenizer.currentToken;
      if (tokenType !== ETokenType.IDENTIFIER) {
        newPixelShader += pixelTokenizer.currentString;
        continue;
      }
      newPixelShader += ParseShaderUniforms(pixelTokenizer, technique, unTreatedUniforms);
    }
    const shaderPath = {
      vertex: program.vertexShader + id,
      fragment: program.fragmentShader + id
    };
    const options = {
      attributes,
      uniforms,
      samplers,
      needAlphaBlending: states && states.enable && states.enable.indexOf(3042) !== -1
    };
    Effect.ShadersStore[program.vertexShader + id + "VertexShader"] = newVertexShader;
    Effect.ShadersStore[program.fragmentShader + id + "PixelShader"] = newPixelShader;
    const shaderMaterial = new ShaderMaterial(id, gltfRuntime.scene, shaderPath, options);
    shaderMaterial.onError = OnShaderCompileError(program, shaderMaterial, onError);
    shaderMaterial.onCompiled = OnShaderCompileSuccess(gltfRuntime, shaderMaterial, technique, material, unTreatedUniforms, onSuccess);
    shaderMaterial.sideOrientation = Material.CounterClockWiseSideOrientation;
    if (states && states.functions) {
      const functions = states.functions;
      if (functions.cullFace && functions.cullFace[0] !== ECullingType.BACK) {
        shaderMaterial.backFaceCulling = false;
      }
      const blendFunc = functions.blendFuncSeparate;
      if (blendFunc) {
        if (blendFunc[0] === EBlendingFunction.SRC_ALPHA && blendFunc[1] === EBlendingFunction.ONE_MINUS_SRC_ALPHA && blendFunc[2] === EBlendingFunction.ONE && blendFunc[3] === EBlendingFunction.ONE) {
          shaderMaterial.alphaMode = Constants.ALPHA_COMBINE;
        } else if (blendFunc[0] === EBlendingFunction.ONE && blendFunc[1] === EBlendingFunction.ONE && blendFunc[2] === EBlendingFunction.ZERO && blendFunc[3] === EBlendingFunction.ONE) {
          shaderMaterial.alphaMode = Constants.ALPHA_ONEONE;
        } else if (blendFunc[0] === EBlendingFunction.SRC_ALPHA && blendFunc[1] === EBlendingFunction.ONE && blendFunc[2] === EBlendingFunction.ZERO && blendFunc[3] === EBlendingFunction.ONE) {
          shaderMaterial.alphaMode = Constants.ALPHA_ADD;
        } else if (blendFunc[0] === EBlendingFunction.ZERO && blendFunc[1] === EBlendingFunction.ONE_MINUS_SRC_COLOR && blendFunc[2] === EBlendingFunction.ONE && blendFunc[3] === EBlendingFunction.ONE) {
          shaderMaterial.alphaMode = Constants.ALPHA_SUBTRACT;
        } else if (blendFunc[0] === EBlendingFunction.DST_COLOR && blendFunc[1] === EBlendingFunction.ZERO && blendFunc[2] === EBlendingFunction.ONE && blendFunc[3] === EBlendingFunction.ONE) {
          shaderMaterial.alphaMode = Constants.ALPHA_MULTIPLY;
        } else if (blendFunc[0] === EBlendingFunction.SRC_ALPHA && blendFunc[1] === EBlendingFunction.ONE_MINUS_SRC_COLOR && blendFunc[2] === EBlendingFunction.ONE && blendFunc[3] === EBlendingFunction.ONE) {
          shaderMaterial.alphaMode = Constants.ALPHA_MAXIMIZED;
        }
      }
    }
  }
}
let GLTFLoader$1 = class GLTFLoader {
  static RegisterExtension(extension) {
    if (GLTFLoader.Extensions[extension.name]) {
      Tools.Error('Tool with the same name "' + extension.name + '" already exists');
      return;
    }
    GLTFLoader.Extensions[extension.name] = extension;
  }
  dispose() {
  }
  // eslint-disable-next-line no-restricted-syntax
  _importMeshAsync(meshesNames, scene, data, rootUrl, assetContainer, onSuccess, onProgress, onError) {
    scene.useRightHandedSystem = true;
    GLTFLoaderExtension.LoadRuntimeAsync(scene, data, rootUrl, (gltfRuntime) => {
      gltfRuntime.assetContainer = assetContainer;
      gltfRuntime.importOnlyMeshes = true;
      if (meshesNames === "") {
        gltfRuntime.importMeshesNames = [];
      } else if (typeof meshesNames === "string") {
        gltfRuntime.importMeshesNames = [meshesNames];
      } else if (meshesNames && !(meshesNames instanceof Array)) {
        gltfRuntime.importMeshesNames = [meshesNames];
      } else {
        gltfRuntime.importMeshesNames = [];
        Tools.Warn("Argument meshesNames must be of type string or string[]");
      }
      this._createNodes(gltfRuntime);
      const meshes = [];
      const skeletons = [];
      for (const nde in gltfRuntime.nodes) {
        const node = gltfRuntime.nodes[nde];
        if (node.babylonNode instanceof AbstractMesh) {
          meshes.push(node.babylonNode);
        }
      }
      for (const skl in gltfRuntime.skins) {
        const skin = gltfRuntime.skins[skl];
        if (skin.babylonSkeleton instanceof Skeleton) {
          skeletons.push(skin.babylonSkeleton);
        }
      }
      this._loadBuffersAsync(gltfRuntime, () => {
        this._loadShadersAsync(gltfRuntime, () => {
          ImportMaterials(gltfRuntime);
          PostLoad(gltfRuntime);
          if (!GLTFFileLoader.IncrementalLoading && onSuccess) {
            onSuccess(meshes, skeletons);
          }
        });
      });
      if (GLTFFileLoader.IncrementalLoading && onSuccess) {
        onSuccess(meshes, skeletons);
      }
    }, onError);
    return true;
  }
  /**
   * Imports one or more meshes from a loaded gltf file and adds them to the scene
   * @param meshesNames a string or array of strings of the mesh names that should be loaded from the file
   * @param scene the scene the meshes should be added to
   * @param assetContainer defines the asset container to use (can be null)
   * @param data gltf data containing information of the meshes in a loaded file
   * @param rootUrl root url to load from
   * @param onProgress event that fires when loading progress has occured
   * @returns a promise containg the loaded meshes, particles, skeletons and animations
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  importMeshAsync(meshesNames, scene, assetContainer, data, rootUrl, onProgress) {
    return new Promise((resolve, reject) => {
      this._importMeshAsync(meshesNames, scene, data, rootUrl, assetContainer, (meshes, skeletons) => {
        resolve({
          meshes,
          particleSystems: [],
          skeletons,
          animationGroups: [],
          lights: [],
          transformNodes: [],
          geometries: [],
          spriteManagers: []
        });
      }, onProgress, (message) => {
        reject(new Error(message));
      });
    });
  }
  // eslint-disable-next-line no-restricted-syntax
  _loadAsync(scene, data, rootUrl, onSuccess, onProgress, onError) {
    scene.useRightHandedSystem = true;
    GLTFLoaderExtension.LoadRuntimeAsync(scene, data, rootUrl, (gltfRuntime) => {
      GLTFLoaderExtension.LoadRuntimeExtensionsAsync(gltfRuntime, () => {
        this._createNodes(gltfRuntime);
        this._loadBuffersAsync(gltfRuntime, () => {
          this._loadShadersAsync(gltfRuntime, () => {
            ImportMaterials(gltfRuntime);
            PostLoad(gltfRuntime);
            if (!GLTFFileLoader.IncrementalLoading) {
              onSuccess();
            }
          });
        });
        if (GLTFFileLoader.IncrementalLoading) {
          onSuccess();
        }
      }, onError);
    }, onError);
  }
  /**
   * Imports all objects from a loaded gltf file and adds them to the scene
   * @param scene the scene the objects should be added to
   * @param data gltf data containing information of the meshes in a loaded file
   * @param rootUrl root url to load from
   * @param onProgress event that fires when loading progress has occured
   * @returns a promise which completes when objects have been loaded to the scene
   */
  async loadAsync(scene, data, rootUrl, onProgress) {
    return await new Promise((resolve, reject) => {
      this._loadAsync(scene, data, rootUrl, () => {
        resolve();
      }, onProgress, (message) => {
        reject(new Error(message));
      });
    });
  }
  // eslint-disable-next-line no-restricted-syntax
  _loadShadersAsync(gltfRuntime, onload) {
    let hasShaders = false;
    const processShader = (sha, shader) => {
      GLTFLoaderExtension.LoadShaderStringAsync(gltfRuntime, sha, (shaderString) => {
        if (shaderString instanceof ArrayBuffer) {
          return;
        }
        gltfRuntime.loadedShaderCount++;
        if (shaderString) {
          Effect.ShadersStore[sha + (shader.type === EShaderType.VERTEX ? "VertexShader" : "PixelShader")] = shaderString;
        }
        if (gltfRuntime.loadedShaderCount === gltfRuntime.shaderscount) {
          onload();
        }
      }, () => {
        Tools.Error("Error when loading shader program named " + sha + " located at " + shader.uri);
      });
    };
    for (const sha in gltfRuntime.shaders) {
      hasShaders = true;
      const shader = gltfRuntime.shaders[sha];
      if (shader) {
        processShader.bind(this, sha, shader)();
      } else {
        Tools.Error("No shader named: " + sha);
      }
    }
    if (!hasShaders) {
      onload();
    }
  }
  // eslint-disable-next-line no-restricted-syntax
  _loadBuffersAsync(gltfRuntime, onLoad) {
    let hasBuffers = false;
    const processBuffer = (buf, buffer) => {
      GLTFLoaderExtension.LoadBufferAsync(gltfRuntime, buf, (bufferView) => {
        gltfRuntime.loadedBufferCount++;
        if (bufferView) {
          if (bufferView.byteLength != gltfRuntime.buffers[buf].byteLength) {
            Tools.Error("Buffer named " + buf + " is length " + bufferView.byteLength + ". Expected: " + buffer.byteLength);
          }
          gltfRuntime.loadedBufferViews[buf] = bufferView;
        }
        if (gltfRuntime.loadedBufferCount === gltfRuntime.buffersCount) {
          onLoad();
        }
      }, () => {
        Tools.Error("Error when loading buffer named " + buf + " located at " + buffer.uri);
      });
    };
    for (const buf in gltfRuntime.buffers) {
      hasBuffers = true;
      const buffer = gltfRuntime.buffers[buf];
      if (buffer) {
        processBuffer.bind(this, buf, buffer)();
      } else {
        Tools.Error("No buffer named: " + buf);
      }
    }
    if (!hasBuffers) {
      onLoad();
    }
  }
  _createNodes(gltfRuntime) {
    let currentScene = gltfRuntime.currentScene;
    if (currentScene) {
      for (let i = 0; i < currentScene.nodes.length; i++) {
        TraverseNodes(gltfRuntime, currentScene.nodes[i], null);
      }
    } else {
      for (const thing in gltfRuntime.scenes) {
        currentScene = gltfRuntime.scenes[thing];
        for (let i = 0; i < currentScene.nodes.length; i++) {
          TraverseNodes(gltfRuntime, currentScene.nodes[i], null);
        }
      }
    }
  }
};
GLTFLoader$1.Extensions = {};
class GLTFLoaderExtension {
  constructor(name) {
    this._name = name;
  }
  get name() {
    return this._name;
  }
  /**
   * Defines an override for loading the runtime
   * Return true to stop further extensions from loading the runtime
   * @param scene
   * @param data
   * @param rootUrl
   * @param onSuccess
   * @param onError
   * @returns true to stop further extensions from loading the runtime
   */
  // eslint-disable-next-line no-restricted-syntax
  loadRuntimeAsync(scene, data, rootUrl, onSuccess, onError) {
    return false;
  }
  /**
   * Defines an onverride for creating gltf runtime
   * Return true to stop further extensions from creating the runtime
   * @param gltfRuntime
   * @param onSuccess
   * @param onError
   * @returns true to stop further extensions from creating the runtime
   */
  // eslint-disable-next-line no-restricted-syntax
  loadRuntimeExtensionsAsync(gltfRuntime, onSuccess, onError) {
    return false;
  }
  /**
   * Defines an override for loading buffers
   * Return true to stop further extensions from loading this buffer
   * @param gltfRuntime
   * @param id
   * @param onSuccess
   * @param onError
   * @param onProgress
   * @returns true to stop further extensions from loading this buffer
   */
  // eslint-disable-next-line no-restricted-syntax
  // eslint-disable-next-line no-restricted-syntax
  loadBufferAsync(gltfRuntime, id, onSuccess, onError, onProgress) {
    return false;
  }
  /**
   * Defines an override for loading texture buffers
   * Return true to stop further extensions from loading this texture data
   * @param gltfRuntime
   * @param id
   * @param onSuccess
   * @param onError
   * @returns true to stop further extensions from loading this texture data
   */
  // eslint-disable-next-line no-restricted-syntax
  loadTextureBufferAsync(gltfRuntime, id, onSuccess, onError) {
    return false;
  }
  /**
   * Defines an override for creating textures
   * Return true to stop further extensions from loading this texture
   * @param gltfRuntime
   * @param id
   * @param buffer
   * @param onSuccess
   * @param onError
   * @returns true to stop further extensions from loading this texture
   */
  // eslint-disable-next-line no-restricted-syntax
  createTextureAsync(gltfRuntime, id, buffer, onSuccess, onError) {
    return false;
  }
  /**
   * Defines an override for loading shader strings
   * Return true to stop further extensions from loading this shader data
   * @param gltfRuntime
   * @param id
   * @param onSuccess
   * @param onError
   * @returns true to stop further extensions from loading this shader data
   */
  // eslint-disable-next-line no-restricted-syntax
  loadShaderStringAsync(gltfRuntime, id, onSuccess, onError) {
    return false;
  }
  /**
   * Defines an override for loading materials
   * Return true to stop further extensions from loading this material
   * @param gltfRuntime
   * @param id
   * @param onSuccess
   * @param onError
   * @returns true to stop further extensions from loading this material
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialAsync(gltfRuntime, id, onSuccess, onError) {
    return false;
  }
  // ---------
  // Utilities
  // ---------
  // eslint-disable-next-line no-restricted-syntax
  static LoadRuntimeAsync(scene, data, rootUrl, onSuccess, onError) {
    GLTFLoaderExtension._ApplyExtensions((loaderExtension) => {
      return loaderExtension.loadRuntimeAsync(scene, data, rootUrl, onSuccess, onError);
    }, () => {
      setTimeout(() => {
        if (!onSuccess) {
          return;
        }
        onSuccess(GLTFLoaderBase.CreateRuntime(data.json, scene, rootUrl));
      });
    });
  }
  // eslint-disable-next-line no-restricted-syntax
  static LoadRuntimeExtensionsAsync(gltfRuntime, onSuccess, onError) {
    GLTFLoaderExtension._ApplyExtensions((loaderExtension) => {
      return loaderExtension.loadRuntimeExtensionsAsync(gltfRuntime, onSuccess, onError);
    }, () => {
      setTimeout(() => {
        onSuccess();
      });
    });
  }
  // eslint-disable-next-line no-restricted-syntax
  static LoadBufferAsync(gltfRuntime, id, onSuccess, onError, onProgress) {
    GLTFLoaderExtension._ApplyExtensions((loaderExtension) => {
      return loaderExtension.loadBufferAsync(gltfRuntime, id, onSuccess, onError, onProgress);
    }, () => {
      GLTFLoaderBase.LoadBufferAsync(gltfRuntime, id, onSuccess, onError, onProgress);
    });
  }
  // eslint-disable-next-line no-restricted-syntax
  static LoadTextureAsync(gltfRuntime, id, onSuccess, onError) {
    GLTFLoaderExtension._LoadTextureBufferAsync(gltfRuntime, id, (buffer) => {
      if (buffer) {
        GLTFLoaderExtension._CreateTextureAsync(gltfRuntime, id, buffer, onSuccess, onError);
      }
    }, onError);
  }
  // eslint-disable-next-line no-restricted-syntax
  static LoadShaderStringAsync(gltfRuntime, id, onSuccess, onError) {
    GLTFLoaderExtension._ApplyExtensions((loaderExtension) => {
      return loaderExtension.loadShaderStringAsync(gltfRuntime, id, onSuccess, onError);
    }, () => {
      GLTFLoaderBase.LoadShaderStringAsync(gltfRuntime, id, onSuccess, onError);
    });
  }
  // eslint-disable-next-line no-restricted-syntax
  static LoadMaterialAsync(gltfRuntime, id, onSuccess, onError) {
    GLTFLoaderExtension._ApplyExtensions((loaderExtension) => {
      return loaderExtension.loadMaterialAsync(gltfRuntime, id, onSuccess, onError);
    }, () => {
      GLTFLoaderBase.LoadMaterialAsync(gltfRuntime, id, onSuccess, onError);
    });
  }
  // eslint-disable-next-line no-restricted-syntax
  static _LoadTextureBufferAsync(gltfRuntime, id, onSuccess, onError) {
    GLTFLoaderExtension._ApplyExtensions((loaderExtension) => {
      return loaderExtension.loadTextureBufferAsync(gltfRuntime, id, onSuccess, onError);
    }, () => {
      GLTFLoaderBase.LoadTextureBufferAsync(gltfRuntime, id, onSuccess, onError);
    });
  }
  // eslint-disable-next-line no-restricted-syntax
  static _CreateTextureAsync(gltfRuntime, id, buffer, onSuccess, onError) {
    GLTFLoaderExtension._ApplyExtensions((loaderExtension) => {
      return loaderExtension.createTextureAsync(gltfRuntime, id, buffer, onSuccess, onError);
    }, () => {
      GLTFLoaderBase.CreateTextureAsync(gltfRuntime, id, buffer, onSuccess);
    });
  }
  static _ApplyExtensions(func, defaultFunc) {
    for (const extensionName in GLTFLoader$1.Extensions) {
      const loaderExtension = GLTFLoader$1.Extensions[extensionName];
      if (func(loaderExtension)) {
        return;
      }
    }
    defaultFunc();
  }
}
GLTFFileLoader._CreateGLTF1Loader = () => new GLTFLoader$1();
const BinaryExtensionBufferName = "binary_glTF";
class GLTFBinaryExtension extends GLTFLoaderExtension {
  constructor() {
    super("KHR_binary_glTF");
  }
  // eslint-disable-next-line no-restricted-syntax
  loadRuntimeAsync(scene, data, rootUrl, onSuccess) {
    const extensionsUsed = data.json.extensionsUsed;
    if (!extensionsUsed || extensionsUsed.indexOf(this.name) === -1 || !data.bin) {
      return false;
    }
    this._bin = data.bin;
    onSuccess(GLTFLoaderBase.CreateRuntime(data.json, scene, rootUrl));
    return true;
  }
  // eslint-disable-next-line no-restricted-syntax
  loadBufferAsync(gltfRuntime, id, onSuccess, onError) {
    if (gltfRuntime.extensionsUsed.indexOf(this.name) === -1) {
      return false;
    }
    if (id !== BinaryExtensionBufferName) {
      return false;
    }
    this._bin.readAsync(0, this._bin.byteLength).then(onSuccess, (error) => onError(error.message));
    return true;
  }
  // eslint-disable-next-line no-restricted-syntax
  loadTextureBufferAsync(gltfRuntime, id, onSuccess) {
    const texture = gltfRuntime.textures[id];
    const source = gltfRuntime.images[texture.source];
    if (!source.extensions || !(this.name in source.extensions)) {
      return false;
    }
    const sourceExt = source.extensions[this.name];
    const bufferView = gltfRuntime.bufferViews[sourceExt.bufferView];
    const buffer = GLTFUtils.GetBufferFromBufferView(gltfRuntime, bufferView, 0, bufferView.byteLength, EComponentType.UNSIGNED_BYTE);
    onSuccess(buffer);
    return true;
  }
  // eslint-disable-next-line no-restricted-syntax
  loadShaderStringAsync(gltfRuntime, id, onSuccess) {
    const shader = gltfRuntime.shaders[id];
    if (!shader.extensions || !(this.name in shader.extensions)) {
      return false;
    }
    const binaryExtensionShader = shader.extensions[this.name];
    const bufferView = gltfRuntime.bufferViews[binaryExtensionShader.bufferView];
    const shaderBytes = GLTFUtils.GetBufferFromBufferView(gltfRuntime, bufferView, 0, bufferView.byteLength, EComponentType.UNSIGNED_BYTE);
    setTimeout(() => {
      const shaderString = GLTFUtils.DecodeBufferToText(shaderBytes);
      onSuccess(shaderString);
    });
    return true;
  }
}
GLTFLoader$1.RegisterExtension(new GLTFBinaryExtension());
class GLTFMaterialsCommonExtension extends GLTFLoaderExtension {
  constructor() {
    super("KHR_materials_common");
  }
  // eslint-disable-next-line no-restricted-syntax
  loadRuntimeExtensionsAsync(gltfRuntime) {
    if (!gltfRuntime.extensions) {
      return false;
    }
    const extension = gltfRuntime.extensions[this.name];
    if (!extension) {
      return false;
    }
    const lights = extension.lights;
    if (lights) {
      for (const thing in lights) {
        const light = lights[thing];
        switch (light.type) {
          case "ambient": {
            const ambientLight = new HemisphericLight(light.name, new Vector3(0, 1, 0), gltfRuntime.scene);
            const ambient = light.ambient;
            if (ambient) {
              ambientLight.diffuse = Color3.FromArray(ambient.color || [1, 1, 1]);
            }
            break;
          }
          case "point": {
            const pointLight = new PointLight(light.name, new Vector3(10, 10, 10), gltfRuntime.scene);
            const point = light.point;
            if (point) {
              pointLight.diffuse = Color3.FromArray(point.color || [1, 1, 1]);
            }
            break;
          }
          case "directional": {
            const dirLight = new DirectionalLight(light.name, new Vector3(0, -1, 0), gltfRuntime.scene);
            const directional = light.directional;
            if (directional) {
              dirLight.diffuse = Color3.FromArray(directional.color || [1, 1, 1]);
            }
            break;
          }
          case "spot": {
            const spot = light.spot;
            if (spot) {
              const spotLight = new SpotLight(light.name, new Vector3(0, 10, 0), new Vector3(0, -1, 0), spot.fallOffAngle || Math.PI, spot.fallOffExponent || 0, gltfRuntime.scene);
              spotLight.diffuse = Color3.FromArray(spot.color || [1, 1, 1]);
            }
            break;
          }
          default:
            Tools.Warn('GLTF Material Common extension: light type "' + light.type + "” not supported");
            break;
        }
      }
    }
    return false;
  }
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialAsync(gltfRuntime, id, onSuccess, onError) {
    const material = gltfRuntime.materials[id];
    if (!material || !material.extensions) {
      return false;
    }
    const extension = material.extensions[this.name];
    if (!extension) {
      return false;
    }
    const standardMaterial = new StandardMaterial(id, gltfRuntime.scene);
    standardMaterial.sideOrientation = Material.CounterClockWiseSideOrientation;
    if (extension.technique === "CONSTANT") {
      standardMaterial.disableLighting = true;
    }
    standardMaterial.backFaceCulling = extension.doubleSided === void 0 ? false : !extension.doubleSided;
    standardMaterial.alpha = extension.values.transparency === void 0 ? 1 : extension.values.transparency;
    standardMaterial.specularPower = extension.values.shininess === void 0 ? 0 : extension.values.shininess;
    if (typeof extension.values.ambient === "string") {
      this._loadTexture(gltfRuntime, extension.values.ambient, standardMaterial, "ambientTexture", onError);
    } else {
      standardMaterial.ambientColor = Color3.FromArray(extension.values.ambient || [0, 0, 0]);
    }
    if (typeof extension.values.diffuse === "string") {
      this._loadTexture(gltfRuntime, extension.values.diffuse, standardMaterial, "diffuseTexture", onError);
    } else {
      standardMaterial.diffuseColor = Color3.FromArray(extension.values.diffuse || [0, 0, 0]);
    }
    if (typeof extension.values.emission === "string") {
      this._loadTexture(gltfRuntime, extension.values.emission, standardMaterial, "emissiveTexture", onError);
    } else {
      standardMaterial.emissiveColor = Color3.FromArray(extension.values.emission || [0, 0, 0]);
    }
    if (typeof extension.values.specular === "string") {
      this._loadTexture(gltfRuntime, extension.values.specular, standardMaterial, "specularTexture", onError);
    } else {
      standardMaterial.specularColor = Color3.FromArray(extension.values.specular || [0, 0, 0]);
    }
    return true;
  }
  _loadTexture(gltfRuntime, id, material, propertyPath, onError) {
    GLTFLoaderBase.LoadTextureBufferAsync(gltfRuntime, id, (buffer) => {
      GLTFLoaderBase.CreateTextureAsync(gltfRuntime, id, buffer, (texture) => material[propertyPath] = texture);
    }, onError);
  }
}
GLTFLoader$1.RegisterExtension(new GLTFMaterialsCommonExtension());
const RegisteredGLTFExtensions = /* @__PURE__ */ new Map();
const registeredGLTFExtensions = RegisteredGLTFExtensions;
function registerGLTFExtension(name, isGLTFExtension, factory) {
  if (unregisterGLTFExtension(name)) {
    Logger.Warn(`Extension with the name '${name}' already exists`);
  }
  RegisteredGLTFExtensions.set(name, {
    isGLTFExtension,
    factory
  });
}
function unregisterGLTFExtension(name) {
  return RegisteredGLTFExtensions.delete(name);
}
const OptionalPathExceptionsList = [
  {
    // get the node as object when reading an extension
    regex: new RegExp(`^/nodes/\\d+/extensions/`)
  },
  {
    // KHR_interactivity animation pointers (e.g. /animations/{}/extensions/KHR_interactivity/maxTime)
    // are virtual: they are computed from the Babylon animation group and are not stored in the
    // glTF JSON, so the animation object has no `extensions` member to traverse into.
    regex: new RegExp(`^/animations/\\d+/extensions/`)
  },
  {
    // weights may be undefined on nodes without morph targets
    regex: new RegExp(`^/nodes/\\d+/weights`)
  },
  {
    // weights may be undefined on meshes without morph targets
    regex: new RegExp(`^/meshes/\\d+/weights`)
  },
  {
    // KHR_texture_transform may not be present on texture info objects
    regex: new RegExp(`/extensions/KHR_texture_transform/`)
  }
];
class GLTFPathToObjectConverter {
  constructor(_gltf, _infoTree) {
    this._gltf = _gltf;
    this._infoTree = _infoTree;
  }
  /**
   * The pointer string is represented by a [JSON pointer](https://datatracker.ietf.org/doc/html/rfc6901).
   * See also https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/ObjectModel.adoc#core-pointers
   * <animationPointer> := /<rootNode>/<assetIndex>/<propertyPath>
   * <rootNode> := "nodes" | "materials" | "meshes" | "cameras" | "extensions"
   * <assetIndex> := <digit> | <name>
   * <propertyPath> := <extensionPath> | <standardPath>
   * <extensionPath> := "extensions"/<name>/<standardPath>
   * <standardPath> := <name> | <name>/<standardPath>
   * <name> := W+
   * <digit> := D+
   *
   * Examples:
   *  - "/nodes/0/rotation"
   * - "/nodes.length"
   *  - "/materials/2/emissiveFactor"
   *  - "/materials/2/pbrMetallicRoughness/baseColorFactor"
   *  - "/materials/2/extensions/KHR_materials_emissive_strength/emissiveStrength"
   *
   * @param path The path to convert
   * @returns The object and info associated with the path
   */
  convert(path) {
    let objectTree = this._gltf;
    let infoTree = this._infoTree;
    let target = void 0;
    if (!path.startsWith("/")) {
      throw new Error("Path must start with a /");
    }
    const parts = path.split("/");
    parts.shift();
    if (parts[parts.length - 1].includes(".length")) {
      const lastPart = parts[parts.length - 1];
      const split = lastPart.split(".");
      parts.pop();
      parts.push(...split);
    }
    let ignoreObjectTree = false;
    for (const part of parts) {
      const isLength = part === "length";
      if (isLength) {
        if (infoTree.length) {
          infoTree = infoTree.length;
        } else if (infoTree.__array__) {
          throw new Error(`Path ${path} is invalid - no length accessor`);
        } else {
          throw new Error(`Path ${path} is invalid`);
        }
        if (objectTree !== void 0) {
          target = objectTree;
        }
        continue;
      }
      if (infoTree.__ignoreObjectTree__) {
        ignoreObjectTree = true;
      }
      if (infoTree.__array__) {
        infoTree = infoTree.__array__;
      } else {
        infoTree = infoTree[part];
        if (!infoTree) {
          throw new Error(`Path ${path} is invalid`);
        }
      }
      if (infoTree.__passThroughTarget__) {
        ignoreObjectTree = true;
      } else if (!ignoreObjectTree) {
        if (objectTree === void 0) {
          const exception = OptionalPathExceptionsList.find((e) => e.regex.test(path));
          if (!exception) {
            throw new Error(`Path ${path} is invalid`);
          }
        } else {
          objectTree = objectTree?.[part];
        }
      } else {
        const numericIndex = /^\d+$/.test(part) ? parseInt(part, 10) : NaN;
        if (!isNaN(numericIndex) && typeof infoTree.get === "function") {
          const orig = infoTree;
          infoTree = { ...orig };
          infoTree.get = (target2, _index, ...rest) => orig.get(target2, numericIndex, ...rest);
          if (typeof orig.set === "function") {
            infoTree.set = (value, target2, _index, ...rest) => orig.set(value, target2, numericIndex, ...rest);
          }
          if (typeof orig.getTarget === "function") {
            infoTree.getTarget = (target2, _index, ...rest) => orig.getTarget(target2, numericIndex, ...rest);
          }
        }
      }
      if (infoTree.__target__) {
        if (objectTree !== void 0) {
          target = objectTree;
        }
      }
    }
    return {
      object: target,
      info: infoTree
    };
  }
}
function _CreateLengthAccessor(getLength, getTarget) {
  return {
    type: "FlowGraphInteger",
    get: (target) => {
      const length = getLength(target);
      return length === void 0 ? void 0 : FlowGraphInteger.FromValue(length);
    },
    getTarget,
    getPropertyName: [() => "length"]
  };
}
const nodesTree = {
  length: _CreateLengthAccessor((nodes) => nodes.length, (nodes) => nodes.map((node) => node._babylonTransformNode)),
  __array__: {
    __target__: true,
    translation: {
      type: "Vector3",
      get: (node) => node._babylonTransformNode?.position,
      set: (value, node) => node._babylonTransformNode?.position.copyFrom(value),
      getTarget: (node) => node._babylonTransformNode,
      getPropertyName: [() => "position"]
    },
    rotation: {
      type: "Quaternion",
      get: (node) => node._babylonTransformNode?.rotationQuaternion,
      set: (value, node) => node._babylonTransformNode?.rotationQuaternion?.copyFrom(value),
      getTarget: (node) => node._babylonTransformNode,
      getPropertyName: [() => "rotationQuaternion"]
    },
    scale: {
      type: "Vector3",
      get: (node) => node._babylonTransformNode?.scaling,
      set: (value, node) => node._babylonTransformNode?.scaling.copyFrom(value),
      getTarget: (node) => node._babylonTransformNode,
      getPropertyName: [() => "scaling"]
    },
    weights: {
      // Skip glTF objectTree traversal — weights may be undefined on the glTF node
      // but accessible via the Babylon MorphTargetManager on the INode's meshes
      __passThroughTarget__: true,
      length: _CreateLengthAccessor((node) => {
        const found = _findNodeMorphTargets(node);
        return found ? found.mtm.numTargets : node?.mesh !== void 0 ? 0 : void 0;
      }, (node) => node?._babylonTransformNode),
      __array__: {
        __target__: true,
        type: "number",
        get: (node, index) => {
          const found = _findNodeMorphTargets(node);
          if (found && index !== void 0 && index >= 0 && index < found.mtm.numTargets) {
            return _roundFloat32Artifact(found.mtm.getTarget(index).influence);
          }
          return void 0;
        },
        set: (value, node, index) => {
          const numValue = typeof value === "number" ? value : typeof value?.value === "number" ? value.value : value;
          const found = _findNodeMorphTargets(node);
          if (!found || index === void 0 || index < 0 || index >= found.mtm.numTargets) {
            return;
          }
          for (const mesh of found.meshes) {
            const target = mesh.morphTargetManager?.getTarget(index);
            if (target) {
              target.influence = numValue;
            }
          }
        },
        getTarget: (node, index) => {
          const found = _findNodeMorphTargets(node);
          if (found && index !== void 0 && index >= 0 && index < found.mtm.numTargets) {
            return found.mtm.getTarget(index);
          }
          return node?._babylonTransformNode;
        },
        getPropertyName: [() => "influence"]
      },
      type: "number[]",
      get: (node) => {
        const found = _findNodeMorphTargets(node);
        if (!found) {
          return [];
        }
        const weights = [];
        for (let i = 0; i < found.mtm.numTargets; i++) {
          weights.push(_roundFloat32Artifact(found.mtm.getTarget(i).influence));
        }
        return weights;
      },
      getTarget: (node) => node?._babylonTransformNode,
      getPropertyName: [() => "influence"]
    },
    // readonly!
    matrix: {
      type: "Matrix",
      get: (node) => Matrix.Compose(node._babylonTransformNode?.scaling, node._babylonTransformNode?.rotationQuaternion, node._babylonTransformNode?.position),
      getTarget: (node) => node._babylonTransformNode,
      isReadOnly: true
    },
    globalMatrix: {
      type: "Matrix",
      get: (node) => {
        const matrix = Matrix.Identity();
        let rootNode = node.parent;
        while (rootNode && rootNode.parent) {
          rootNode = rootNode.parent;
        }
        const forceUpdate = node._babylonTransformNode?.position._isDirty || node._babylonTransformNode?.rotationQuaternion?._isDirty || node._babylonTransformNode?.scaling._isDirty;
        if (rootNode) {
          const rootMatrix = rootNode._babylonTransformNode?.computeWorldMatrix(true).invert();
          if (rootMatrix) {
            node._babylonTransformNode?.computeWorldMatrix(forceUpdate)?.multiplyToRef(rootMatrix, matrix);
          }
        } else if (node._babylonTransformNode) {
          matrix.copyFrom(node._babylonTransformNode.computeWorldMatrix(forceUpdate));
        }
        return matrix;
      },
      getTarget: (node) => node._babylonTransformNode,
      isReadOnly: true
    },
    camera: {
      type: "string",
      // Per KHR_interactivity Object Model: read-only ref pointing to the
      // attached camera, encoded as a JSON Pointer string. Empty string
      // when no camera is attached (the spec's null-ref convention).
      get: (node) => node.camera !== void 0 ? `/cameras/${node.camera}` : "",
      getTarget: (node) => node,
      isReadOnly: true
    },
    mesh: {
      type: "string",
      get: (node) => node.mesh !== void 0 ? `/meshes/${node.mesh}` : "",
      getTarget: (node) => node,
      isReadOnly: true
    },
    skin: {
      type: "string",
      get: (node) => node.skin !== void 0 ? `/skins/${node.skin}` : "",
      getTarget: (node) => node,
      isReadOnly: true
    },
    parent: {
      type: "string",
      get: (node) => node.parent && node.parent.index !== void 0 ? `/nodes/${node.parent.index}` : "",
      getTarget: (node) => node,
      isReadOnly: true
    },
    children: {
      length: _CreateLengthAccessor((children) => children?.length ?? 0, (children) => children ?? []),
      __array__: {
        __target__: true,
        type: "string",
        // The wrapping converter passes the indexed child value (an
        // INode index); convert it to a JSON Pointer ref string.
        get: (childIndex) => typeof childIndex === "number" ? `/nodes/${childIndex}` : "",
        getTarget: () => ({ __nodeIndex: true }),
        isReadOnly: true
      }
    },
    extensions: {
      EXT_lights_ies: {
        multiplier: {
          type: "number",
          get: (node) => {
            return node._babylonTransformNode?.getChildren((child) => child instanceof SpotLight, true)[0]?.intensity;
          },
          getTarget: (node) => node._babylonTransformNode?.getChildren((child) => child instanceof SpotLight, true)[0],
          set: (value, node) => {
            if (node._babylonTransformNode) {
              const light = node._babylonTransformNode.getChildren((child) => child instanceof SpotLight, true)[0];
              if (light) {
                light.intensity = value;
              }
            }
          }
        },
        color: {
          type: "Color3",
          get: (node) => {
            return node._babylonTransformNode?.getChildren((child) => child instanceof SpotLight, true)[0]?.diffuse;
          },
          getTarget: (node) => node._babylonTransformNode?.getChildren((child) => child instanceof SpotLight, true)[0],
          set: (value, node) => {
            if (node._babylonTransformNode) {
              const light = node._babylonTransformNode.getChildren((child) => child instanceof SpotLight, true)[0];
              if (light) {
                light.diffuse = value;
              }
            }
          }
        }
      },
      KHR_node_visibility: {
        visible: {
          type: "boolean",
          get: (node) => {
            return node._primitiveBabylonMeshes ? node._primitiveBabylonMeshes[0].isVisible : false;
          },
          getTarget: () => void 0,
          // TODO: what should this return?
          set: (value, node) => {
            if (node._primitiveBabylonMeshes) {
              node._primitiveBabylonMeshes.forEach((mesh) => mesh.isVisible = value);
            }
          }
        }
      }
    }
  }
};
const animationsTree = {
  length: _CreateLengthAccessor((animations) => animations.length, (animations) => animations.map((animation) => animation._babylonAnimationGroup)),
  __array__: {
    // Indexed access to the animation, surfaced as a JSON Pointer ref string so blocks like
    // ``animation/start`` can consume it directly. Uses the animation's own ``index`` property
    // (populated by the loader's ArrayItem.Assign step) so the ref is resolved without needing
    // a separate index payload from the path converter.
    __target__: true,
    type: "string",
    get: (animation) => animation && typeof animation.index === "number" ? `/animations/${animation.index}` : "",
    getTarget: (animation) => animation._babylonAnimationGroup,
    isReadOnly: true
  }
};
const meshesTree = {
  length: _CreateLengthAccessor((meshes) => meshes.length, (meshes) => meshes.map((mesh) => mesh.primitives[0]._instanceData?.babylonSourceMesh)),
  __array__: {
    __target__: true,
    primitives: {
      length: _CreateLengthAccessor((primitives) => primitives?.length ?? 0, (primitives) => primitives ?? []),
      __array__: {
        __target__: true,
        material: {
          type: "string",
          // Read-only ref to the assigned material, JSON Pointer encoded.
          get: (primitive) => primitive.material !== void 0 ? `/materials/${primitive.material}` : "",
          getTarget: (primitive) => primitive,
          isReadOnly: true
        }
      }
    },
    weights: {
      length: _CreateLengthAccessor((weights) => weights?.length ?? 0, (weights) => weights ?? []),
      __array__: {
        __target__: true,
        type: "number",
        get: (weightValue) => weightValue,
        getTarget: () => ({ __weightValue: true }),
        isReadOnly: true
      }
    }
  }
};
const camerasTree = {
  length: _CreateLengthAccessor((cameras) => cameras.length, (cameras) => cameras.map((camera) => camera._babylonCamera)),
  __array__: {
    __target__: true,
    orthographic: {
      xmag: {
        componentsCount: 2,
        type: "Vector2",
        get: (camera) => new Vector2(camera._babylonCamera?.orthoLeft ?? 0, camera._babylonCamera?.orthoRight ?? 0),
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.orthoLeft = value.x;
            camera._babylonCamera.orthoRight = value.y;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "orthoLeft", () => "orthoRight"]
      },
      ymag: {
        componentsCount: 2,
        type: "Vector2",
        get: (camera) => new Vector2(camera._babylonCamera?.orthoBottom ?? 0, camera._babylonCamera?.orthoTop ?? 0),
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.orthoBottom = value.x;
            camera._babylonCamera.orthoTop = value.y;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "orthoBottom", () => "orthoTop"]
      },
      zfar: {
        type: "number",
        get: (camera) => camera._babylonCamera?.maxZ,
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.maxZ = value;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "maxZ"]
      },
      znear: {
        type: "number",
        get: (camera) => camera._babylonCamera?.minZ,
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.minZ = value;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "minZ"]
      }
    },
    perspective: {
      aspectRatio: {
        type: "number",
        get: (camera) => camera._babylonCamera?.getEngine().getAspectRatio(camera._babylonCamera),
        getTarget: (camera) => camera,
        getPropertyName: [() => "aspectRatio"],
        isReadOnly: true
        // might not be the case for glTF?
      },
      yfov: {
        type: "number",
        get: (camera) => camera._babylonCamera?.fov,
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.fov = value;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "fov"]
      },
      zfar: {
        type: "number",
        get: (camera) => camera._babylonCamera?.maxZ,
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.maxZ = value;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "maxZ"]
      },
      znear: {
        type: "number",
        get: (camera) => camera._babylonCamera?.minZ,
        set: (value, camera) => {
          if (camera._babylonCamera) {
            camera._babylonCamera.minZ = value;
          }
        },
        getTarget: (camera) => camera,
        getPropertyName: [() => "minZ"]
      }
    }
  }
};
const materialsTree = {
  length: _CreateLengthAccessor((materials) => materials.length, (materials) => materials.map((material) => material._data?.[Constants.MATERIAL_TriangleFillMode]?.babylonMaterial)),
  __array__: {
    __target__: true,
    doubleSided: {
      type: "boolean",
      get: (material, index, payload) => !GetMaterial(material, index, payload)?.backFaceCulling,
      set: (value, material, index, payload) => {
        const mat = GetMaterial(material, index, payload);
        if (mat) {
          mat.backFaceCulling = !value;
        }
      },
      getTarget: (material, index, payload) => GetMaterial(material, index, payload),
      getPropertyName: [() => "backFaceCulling"]
    },
    alphaCutoff: {
      type: "number",
      get: (material, index, payload) => GetMaterial(material, index, payload)?.alphaCutOff,
      set: (value, material, index, payload) => {
        const mat = GetMaterial(material, index, payload);
        if (mat) {
          mat.alphaCutOff = value;
        }
      },
      getTarget: (material, index, payload) => GetMaterial(material, index, payload),
      getPropertyName: [() => "alphaCutOff"]
    },
    emissiveFactor: {
      type: "Color3",
      get: (material, index, payload) => GetMaterial(material, index, payload).emissiveColor,
      set: (value, material, index, payload) => GetMaterial(material, index, payload).emissiveColor.copyFrom(value),
      getTarget: (material, index, payload) => GetMaterial(material, index, payload),
      getPropertyName: [() => "emissiveColor"]
    },
    emissiveTexture: {
      extensions: {
        KHR_texture_transform: GenerateTextureMap("emissiveTexture")
      }
    },
    normalTexture: {
      scale: {
        type: "number",
        get: (material, index, payload) => GetTexture(material, payload, "bumpTexture")?.level,
        set: (value, material, index, payload) => {
          const texture = GetTexture(material, payload, "bumpTexture");
          if (texture) {
            texture.level = value;
          }
        },
        getTarget: (material, index, payload) => GetMaterial(material, index, payload),
        getPropertyName: [() => "level"]
      },
      extensions: {
        KHR_texture_transform: GenerateTextureMap("bumpTexture")
      }
    },
    occlusionTexture: {
      strength: {
        type: "number",
        get: (material, index, payload) => GetMaterial(material, index, payload).ambientTextureStrength,
        set: (value, material, index, payload) => {
          const mat = GetMaterial(material, index, payload);
          if (mat) {
            mat.ambientTextureStrength = value;
          }
        },
        getTarget: (material, index, payload) => GetMaterial(material, index, payload),
        getPropertyName: [() => "ambientTextureStrength"]
      },
      extensions: {
        KHR_texture_transform: GenerateTextureMap("ambientTexture")
      }
    },
    pbrMetallicRoughness: {
      baseColorFactor: {
        type: "Color4",
        get: (material, index, payload) => {
          const mat = GetMaterial(material, index, payload);
          return Color4.FromColor3(mat.albedoColor, mat.alpha);
        },
        set: (value, material, index, payload) => {
          const mat = GetMaterial(material, index, payload);
          mat.albedoColor.set(value.r, value.g, value.b);
          mat.alpha = value.a;
        },
        getTarget: (material, index, payload) => GetMaterial(material, index, payload),
        // This is correct on the animation level, but incorrect as a single property of a type Color4
        getPropertyName: [() => "albedoColor", () => "alpha"]
      },
      baseColorTexture: {
        extensions: {
          KHR_texture_transform: GenerateTextureMap("albedoTexture")
        }
      },
      metallicFactor: {
        type: "number",
        get: (material, index, payload) => GetMaterial(material, index, payload).metallic,
        set: (value, material, index, payload) => {
          const mat = GetMaterial(material, index, payload);
          if (mat) {
            mat.metallic = value;
          }
        },
        getTarget: (material, index, payload) => GetMaterial(material, index, payload),
        getPropertyName: [() => "metallic"]
      },
      roughnessFactor: {
        type: "number",
        get: (material, index, payload) => GetMaterial(material, index, payload).roughness,
        set: (value, material, index, payload) => {
          const mat = GetMaterial(material, index, payload);
          if (mat) {
            mat.roughness = value;
          }
        },
        getTarget: (material, index, payload) => GetMaterial(material, index, payload),
        getPropertyName: [() => "roughness"]
      },
      metallicRoughnessTexture: {
        extensions: {
          KHR_texture_transform: GenerateTextureMap("metallicTexture")
        }
      }
    },
    extensions: {
      KHR_materials_anisotropy: {
        anisotropyStrength: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload)?.anisotropy?.intensity,
          set: (value, material, index, payload) => {
            const mat = GetMaterial(material, index, payload);
            if (mat) {
              mat.anisotropy.intensity = value;
            }
          },
          getTarget: (material, index, payload) => GetMaterial(material, index, payload),
          getPropertyName: [() => "anisotropy.intensity"]
        },
        anisotropyRotation: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload)?.anisotropy?.angle,
          set: (value, material, index, payload) => {
            const mat = GetMaterial(material, index, payload);
            if (mat) {
              mat.anisotropy.angle = value;
            }
          },
          getTarget: (material, index, payload) => GetMaterial(material, index, payload),
          getPropertyName: [() => "anisotropy.angle"]
        },
        anisotropyTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("anisotropy", "texture")
          }
        }
      },
      KHR_materials_clearcoat: {
        clearcoatFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).clearCoat.intensity,
          set: (value, material, index, payload) => {
            GetMaterial(material, index, payload).clearCoat.intensity = value;
          },
          getTarget: (material, index, payload) => GetMaterial(material, index, payload),
          getPropertyName: [() => "clearCoat.intensity"]
        },
        clearcoatRoughnessFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).clearCoat.roughness,
          set: (value, material, index, payload) => {
            GetMaterial(material, index, payload).clearCoat.roughness = value;
          },
          getTarget: (material, index, payload) => GetMaterial(material, index, payload),
          getPropertyName: [() => "clearCoat.roughness"]
        },
        clearcoatTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("clearCoat", "texture")
          }
        },
        clearcoatNormalTexture: {
          scale: {
            type: "number",
            get: (material, index, payload) => GetMaterial(material, index, payload).clearCoat.bumpTexture?.level,
            getTarget: GetMaterial,
            set: (value, material, index, payload) => GetMaterial(material, index, payload).clearCoat.bumpTexture.level = value
          },
          extensions: {
            KHR_texture_transform: GenerateTextureMap("clearCoat", "bumpTexture")
          }
        },
        clearcoatRoughnessTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("clearCoat", "textureRoughness")
          }
        }
      },
      KHR_materials_dispersion: {
        dispersion: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.dispersion,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.dispersion = value
        }
      },
      KHR_materials_emissive_strength: {
        emissiveStrength: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).emissiveIntensity,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).emissiveIntensity = value
        }
      },
      KHR_materials_ior: {
        ior: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).indexOfRefraction,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).indexOfRefraction = value
        }
      },
      KHR_materials_iridescence: {
        iridescenceFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).iridescence.intensity,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).iridescence.intensity = value
        },
        iridescenceIor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).iridescence.indexOfRefraction,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).iridescence.indexOfRefraction = value
        },
        iridescenceTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("iridescence", "texture")
          }
        },
        iridescenceThicknessMaximum: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).iridescence.maximumThickness,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).iridescence.maximumThickness = value
        },
        iridescenceThicknessMinimum: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).iridescence.minimumThickness,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).iridescence.minimumThickness = value
        },
        iridescenceThicknessTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("iridescence", "thicknessTexture")
          }
        }
      },
      KHR_materials_sheen: {
        sheenColorFactor: {
          type: "Color3",
          get: (material, index, payload) => GetMaterial(material, index, payload).sheen.color,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).sheen.color.copyFrom(value)
        },
        sheenColorTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("sheen", "texture")
          }
        },
        sheenRoughnessFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).sheen.intensity,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).sheen.intensity = value
        },
        sheenRoughnessTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("sheen", "textureRoughness")
          }
        }
      },
      KHR_materials_specular: {
        specularFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).metallicF0Factor,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).metallicF0Factor = value,
          getPropertyName: [() => "metallicF0Factor"]
        },
        specularColorFactor: {
          type: "Color3",
          get: (material, index, payload) => GetMaterial(material, index, payload).metallicReflectanceColor,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).metallicReflectanceColor.copyFrom(value),
          getPropertyName: [() => "metallicReflectanceColor"]
        },
        specularTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("metallicReflectanceTexture")
          }
        },
        specularColorTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("reflectanceTexture")
          }
        }
      },
      KHR_materials_transmission: {
        transmissionFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.refractionIntensity,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.refractionIntensity = value,
          getPropertyName: [() => "subSurface.refractionIntensity"]
        },
        transmissionTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("subSurface", "refractionIntensityTexture", {
              extensionKey: "KHR_materials_transmission",
              texturePath: ["transmissionTexture"]
            })
          }
        }
      },
      KHR_materials_diffuse_transmission: {
        diffuseTransmissionFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.translucencyIntensity,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.translucencyIntensity = value
        },
        diffuseTransmissionTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("subSurface", "translucencyIntensityTexture", {
              extensionKey: "KHR_materials_diffuse_transmission",
              texturePath: ["diffuseTransmissionTexture"]
            })
          }
        },
        diffuseTransmissionColorFactor: {
          type: "Color3",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.translucencyColor,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => value && GetMaterial(material, index, payload).subSurface.translucencyColor?.copyFrom(value)
        },
        diffuseTransmissionColorTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("subSurface", "translucencyColorTexture", {
              extensionKey: "KHR_materials_diffuse_transmission",
              texturePath: ["diffuseTransmissionColorTexture"]
            })
          }
        }
      },
      KHR_materials_volume: {
        attenuationColor: {
          type: "Color3",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.tintColor,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.tintColor.copyFrom(value)
        },
        attenuationDistance: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.tintColorAtDistance,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.tintColorAtDistance = value
        },
        thicknessFactor: {
          type: "number",
          get: (material, index, payload) => GetMaterial(material, index, payload).subSurface.maximumThickness,
          getTarget: GetMaterial,
          set: (value, material, index, payload) => GetMaterial(material, index, payload).subSurface.maximumThickness = value
        },
        thicknessTexture: {
          extensions: {
            KHR_texture_transform: GenerateTextureMap("subSurface", "thicknessTexture", { extensionKey: "KHR_materials_volume", texturePath: ["thicknessTexture"] })
          }
        }
      }
    }
  }
};
const extensionsTree = {
  KHR_lights_punctual: {
    lights: {
      length: _CreateLengthAccessor((lights) => lights.length, (lights) => lights.map((light) => light._babylonLight)),
      __array__: {
        __target__: true,
        color: {
          type: "Color3",
          get: (light) => light._babylonLight?.diffuse,
          set: (value, light) => light._babylonLight?.diffuse.copyFrom(value),
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "diffuse"]
        },
        intensity: {
          type: "number",
          get: (light) => light._babylonLight?.intensity,
          set: (value, light) => light._babylonLight ? light._babylonLight.intensity = value : void 0,
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "intensity"]
        },
        range: {
          type: "number",
          get: (light) => light._babylonLight?.range,
          set: (value, light) => light._babylonLight ? light._babylonLight.range = value : void 0,
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "range"]
        },
        spot: {
          innerConeAngle: {
            type: "number",
            get: (light) => light._babylonLight?.innerAngle,
            set: (value, light) => light._babylonLight ? light._babylonLight.innerAngle = value : void 0,
            getTarget: (light) => light._babylonLight,
            getPropertyName: [(_light) => "innerConeAngle"]
          },
          outerConeAngle: {
            type: "number",
            get: (light) => light._babylonLight?.angle,
            set: (value, light) => light._babylonLight ? light._babylonLight.angle = value : void 0,
            getTarget: (light) => light._babylonLight,
            getPropertyName: [(_light) => "outerConeAngle"]
          }
        }
      }
    }
  },
  EXT_lights_area: {
    lights: {
      length: _CreateLengthAccessor((lights) => lights.length, (lights) => lights.map((light) => light._babylonLight)),
      __array__: {
        __target__: true,
        color: {
          type: "Color3",
          get: (light) => light._babylonLight?.diffuse,
          set: (value, light) => light._babylonLight?.diffuse.copyFrom(value),
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "diffuse"]
        },
        intensity: {
          type: "number",
          get: (light) => light._babylonLight?.intensity,
          set: (value, light) => light._babylonLight ? light._babylonLight.intensity = value : void 0,
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "intensity"]
        },
        size: {
          type: "number",
          get: (light) => light._babylonLight?.height,
          set: (value, light) => light._babylonLight ? light._babylonLight.height = value : void 0,
          getTarget: (light) => light._babylonLight,
          getPropertyName: [(_light) => "size"]
        },
        rect: {
          aspect: {
            type: "number",
            get: (light) => light._babylonLight?.width / light._babylonLight?.height,
            set: (value, light) => light._babylonLight ? light._babylonLight.width = value * light._babylonLight.height : void 0,
            getTarget: (light) => light._babylonLight,
            getPropertyName: [(_light) => "aspect"]
          }
        }
      }
    }
  },
  EXT_lights_ies: {
    lights: {
      length: _CreateLengthAccessor((lights) => lights.length, (lights) => lights.map((light) => light._babylonLight))
    }
  },
  EXT_lights_image_based: {
    lights: {
      length: _CreateLengthAccessor((lights) => lights.length, (lights) => lights.map((light) => light._babylonTexture)),
      __array__: {
        __target__: true,
        intensity: {
          type: "number",
          get: (light) => light._babylonTexture?.level,
          set: (value, light) => {
            if (light._babylonTexture) {
              light._babylonTexture.level = value;
            }
          },
          getTarget: (light) => light._babylonTexture
        },
        rotation: {
          type: "Quaternion",
          get: (light) => light._babylonTexture && Quaternion.FromRotationMatrix(light._babylonTexture?.getReflectionTextureMatrix()),
          set: (value, light) => {
            if (!light._babylonTexture) {
              return;
            }
            if (!light._babylonTexture.getScene()?.useRightHandedSystem) {
              value = Quaternion.Inverse(value);
            }
            Matrix.FromQuaternionToRef(value, light._babylonTexture.getReflectionTextureMatrix());
          },
          getTarget: (light) => light._babylonTexture
        }
      }
    }
  }
};
function GetTexture(material, payload, textureType, textureInObject) {
  const babylonMaterial = GetMaterial(material);
  return textureInObject ? babylonMaterial[textureType][textureInObject] : babylonMaterial[textureType];
}
function GetMaterial(material, _index, payload) {
  return material._data?.[payload?.fillMode ?? Constants.MATERIAL_TriangleFillMode]?.babylonMaterial;
}
function _getNodeMorphTargetManager(node) {
  const tn = node?._babylonTransformNode;
  if (!tn) {
    return void 0;
  }
  if (tn.morphTargetManager) {
    return tn.morphTargetManager;
  }
  const primMeshes = node._primitiveBabylonMeshes;
  if (primMeshes) {
    for (const mesh of primMeshes) {
      if (mesh?.morphTargetManager) {
        return mesh.morphTargetManager;
      }
      if (mesh?.sourceMesh?.morphTargetManager) {
        return mesh.sourceMesh.morphTargetManager;
      }
    }
  }
  return void 0;
}
function _findNodeMorphTargets(node) {
  const tn = node?._babylonTransformNode;
  if (!tn) {
    return void 0;
  }
  const directMtm = _getNodeMorphTargetManager(node);
  if (directMtm && node._primitiveBabylonMeshes && node._primitiveBabylonMeshes.length > 0) {
    return { mtm: directMtm, meshes: node._primitiveBabylonMeshes };
  }
  const descendants = tn.getDescendants(false);
  for (const desc of descendants) {
    const candidate = desc;
    const mtm = candidate.morphTargetManager ?? candidate.sourceMesh?.morphTargetManager;
    if (!mtm) {
      continue;
    }
    const meshes = [];
    const parent = candidate.parent;
    if (parent) {
      for (const sib of parent.getChildMeshes(true)) {
        const sibMtm = sib.morphTargetManager ?? sib.sourceMesh?.morphTargetManager;
        if (sibMtm === mtm) {
          meshes.push(sib);
        }
      }
    }
    if (meshes.length === 0) {
      meshes.push(candidate);
    }
    return { mtm, meshes };
  }
  return void 0;
}
function _roundFloat32Artifact(v) {
  if (!Number.isFinite(v)) {
    return v;
  }
  return parseFloat(v.toPrecision(7));
}
function _gltfTextureTransform(material, gltfPath, createMissing) {
  if (!material) {
    return void 0;
  }
  let extensions = material.extensions;
  if (!extensions) {
    if (!createMissing) {
      return void 0;
    }
    extensions = {};
    material.extensions = extensions;
  }
  let cursor = extensions[gltfPath.extensionKey];
  if (!cursor) {
    if (!createMissing) {
      return void 0;
    }
    cursor = {};
    extensions[gltfPath.extensionKey] = cursor;
  }
  for (const key of gltfPath.texturePath) {
    let next = cursor[key];
    if (!next) {
      if (!createMissing) {
        return void 0;
      }
      next = {};
      cursor[key] = next;
    }
    cursor = next;
  }
  if (!cursor.extensions) {
    if (!createMissing) {
      return void 0;
    }
    cursor.extensions = {};
  }
  let xform = cursor.extensions.KHR_texture_transform;
  if (!xform) {
    if (!createMissing) {
      return void 0;
    }
    xform = {};
    cursor.extensions.KHR_texture_transform = xform;
  }
  return xform;
}
function GenerateTextureMap(textureType, textureInObject, gltfPath) {
  return {
    offset: {
      componentsCount: 2,
      // assuming two independent values for u and v, and NOT a Vector2
      type: "Vector2",
      get: (material, _index, payload) => {
        const texture = GetTexture(material, payload, textureType, textureInObject);
        if (texture) {
          return new Vector2(texture.uOffset, texture.vOffset);
        }
        if (gltfPath) {
          const xform = _gltfTextureTransform(material, gltfPath, false);
          const o = xform?.offset;
          return new Vector2(o?.[0] ?? 0, o?.[1] ?? 0);
        }
        return new Vector2(0, 0);
      },
      getTarget: GetMaterial,
      set: (value, material, _index, payload) => {
        const texture = GetTexture(material, payload, textureType, textureInObject);
        if (texture) {
          texture.uOffset = value.x;
          texture.vOffset = value.y;
        }
        if (gltfPath) {
          const xform = _gltfTextureTransform(material, gltfPath, true);
          if (xform) {
            xform.offset = [value.x, value.y];
          }
        }
      },
      getPropertyName: [
        () => `${textureType}${textureInObject ? "." + textureInObject : ""}.uOffset`,
        () => `${textureType}${textureInObject ? "." + textureInObject : ""}.vOffset`
      ]
    },
    rotation: {
      type: "number",
      get: (material, _index, payload) => {
        const texture = GetTexture(material, payload, textureType, textureInObject);
        if (texture) {
          return texture.wAng;
        }
        if (gltfPath) {
          const xform = _gltfTextureTransform(material, gltfPath, false);
          return xform?.rotation ?? 0;
        }
        return 0;
      },
      getTarget: GetMaterial,
      set: (value, material, _index, payload) => {
        const texture = GetTexture(material, payload, textureType, textureInObject);
        if (texture) {
          texture.wAng = value;
        }
        if (gltfPath) {
          const xform = _gltfTextureTransform(material, gltfPath, true);
          if (xform) {
            xform.rotation = value;
          }
        }
      },
      getPropertyName: [() => `${textureType}${textureInObject ? "." + textureInObject : ""}.wAng`]
    },
    scale: {
      componentsCount: 2,
      type: "Vector2",
      get: (material, _index, payload) => {
        const texture = GetTexture(material, payload, textureType, textureInObject);
        if (texture) {
          return new Vector2(texture.uScale, texture.vScale);
        }
        if (gltfPath) {
          const xform = _gltfTextureTransform(material, gltfPath, false);
          const s = xform?.scale;
          return new Vector2(s?.[0] ?? 1, s?.[1] ?? 1);
        }
        return new Vector2(1, 1);
      },
      getTarget: GetMaterial,
      set: (value, material, index, payload) => {
        const texture = GetTexture(material, payload, textureType, textureInObject);
        if (texture) {
          texture.uScale = value.x;
          texture.vScale = value.y;
        }
        if (gltfPath) {
          const xform = _gltfTextureTransform(material, gltfPath, true);
          if (xform) {
            xform.scale = [value.x, value.y];
          }
        }
      },
      getPropertyName: [
        () => `${textureType}${textureInObject ? "." + textureInObject : ""}.uScale`,
        () => `${textureType}${textureInObject ? "." + textureInObject : ""}.vScale`
      ]
    }
  };
}
const scenesTree = {
  length: _CreateLengthAccessor((scenes) => scenes.length, (scenes) => scenes),
  __array__: {
    __target__: true,
    nodes: {
      length: _CreateLengthAccessor((nodes) => nodes?.length ?? 0, (nodes) => nodes ?? []),
      __array__: {
        __target__: true,
        type: "string",
        // Indexed scene root: the underlying value is the INode index;
        // KHR_interactivity expects a ref-typed JSON Pointer string.
        get: (nodeIndex) => typeof nodeIndex === "number" ? `/nodes/${nodeIndex}` : "",
        getTarget: () => ({ __nodeIndex: true }),
        isReadOnly: true
      }
    }
  }
};
const skinsTree = {
  length: _CreateLengthAccessor((skins) => skins.length, (skins) => skins.map((skin) => skin._data?.babylonSkeleton)),
  __array__: {
    __target__: true,
    joints: {
      length: _CreateLengthAccessor((joints) => joints?.length ?? 0, (joints) => joints ?? []),
      __array__: {
        __target__: true,
        type: "string",
        // Indexed skin joint: returns a ref to the joint node.
        get: (jointIndex) => typeof jointIndex === "number" ? `/nodes/${jointIndex}` : "",
        getTarget: () => ({ __nodeIndex: true }),
        isReadOnly: true
      }
    },
    skeleton: {
      type: "string",
      // Skin's skeleton root: returns a ref to the root node, or empty
      // (null ref) when no skeleton root is declared.
      get: (skin) => {
        const skeleton = skin.skeleton;
        return typeof skeleton === "number" ? `/nodes/${skeleton}` : "";
      },
      getTarget: (skin) => skin,
      isReadOnly: true
    }
  }
};
const objectModelMapping = {
  scene: {
    __target__: true,
    type: "number",
    get: (sceneIndex) => sceneIndex ?? 0,
    getTarget: () => ({ __gltfRoot: true }),
    isReadOnly: true,
    getPropertyName: [() => "scene"]
  },
  cameras: camerasTree,
  nodes: nodesTree,
  materials: materialsTree,
  extensions: extensionsTree,
  animations: animationsTree,
  meshes: meshesTree,
  scenes: scenesTree,
  skins: skinsTree
};
function GetPathToObjectConverter(gltf) {
  return new GLTFPathToObjectConverter(gltf, objectModelMapping);
}
function GetMappingForKey(key) {
  const keyParts = key.split("/").map((part) => part.replace(/{}/g, "__array__"));
  let current = objectModelMapping;
  for (const part of keyParts) {
    if (!part) {
      continue;
    }
    current = current[part];
  }
  if (current && current.type && current.get) {
    return current;
  }
  return void 0;
}
function SetInterpolationForKey(key, interpolation) {
  const keyParts = key.split("/").map((part) => part.replace(/{}/g, "__array__"));
  let current = objectModelMapping;
  for (const part of keyParts) {
    if (!part) {
      continue;
    }
    current = current[part];
  }
  if (current && current.type && current.get) {
    current.interpolation = interpolation;
  }
}
function AddObjectAccessorToKey(key, accessor) {
  const keyParts = key.split("/").map((part) => part.replace(/{}/g, "__array__"));
  let current = objectModelMapping;
  for (const part of keyParts) {
    if (!part) {
      continue;
    }
    if (!current[part]) {
      if (part === "?") {
        current.__ignoreObjectTree__ = true;
        continue;
      }
      current[part] = {};
      if (part === "__array__") {
        current[part].__target__ = true;
      }
    }
    current = current[part];
  }
  Object.assign(current, accessor);
}
const LazyAnimationGroupModulePromise = /* @__PURE__ */ new Lazy(() => __vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bJ), true ? __vite__mapDeps([0,1]) : void 0, import.meta.url));
const LazyLoaderAnimationModulePromise = /* @__PURE__ */ new Lazy(() => __vitePreload(() => Promise.resolve().then(() => glTFLoaderAnimation), true ? void 0 : void 0, import.meta.url));
class ArrayItem {
  /**
   * Gets an item from the given array.
   * @param context The context when loading the asset
   * @param array The array to get the item from
   * @param index The index to the array
   * @returns The array item
   */
  static Get(context, array, index) {
    if (!array || index == void 0 || !array[index]) {
      throw new Error(`${context}: Failed to find index (${index})`);
    }
    return array[index];
  }
  /**
   * Gets an item from the given array or returns null if not available.
   * @param array The array to get the item from
   * @param index The index to the array
   * @returns The array item or null
   */
  static TryGet(array, index) {
    if (!array || index == void 0 || !array[index]) {
      return null;
    }
    return array[index];
  }
  /**
   * Assign an `index` field to each item of the given array.
   * @param array The array of items
   */
  static Assign(array) {
    if (array) {
      for (let index = 0; index < array.length; index++) {
        array[index].index = index;
      }
    }
  }
}
function LoadBoundingInfoFromPositionAccessor(accessor) {
  if (accessor.min && accessor.max) {
    const minArray = accessor.min;
    const maxArray = accessor.max;
    const minVector = TmpVectors.Vector3[0].copyFromFloats(minArray[0], minArray[1], minArray[2]);
    const maxVector = TmpVectors.Vector3[1].copyFromFloats(maxArray[0], maxArray[1], maxArray[2]);
    if (accessor.normalized && accessor.componentType !== 5126) {
      let divider = 1;
      switch (accessor.componentType) {
        case 5120:
          divider = 127;
          break;
        case 5121:
          divider = 255;
          break;
        case 5122:
          divider = 32767;
          break;
        case 5123:
          divider = 65535;
          break;
      }
      const oneOverDivider = 1 / divider;
      minVector.scaleInPlace(oneOverDivider);
      maxVector.scaleInPlace(oneOverDivider);
    }
    return new BoundingInfo(minVector, maxVector);
  }
  return null;
}
class GLTFLoader2 {
  /**
   * Test if the given material is an instance of any PBR material type known to this loader.
   * @param material The material to test
   * @returns true if the material matches one of the loaded PBR implementations
   */
  isMatchingMaterialType(material) {
    if (!material) {
      return false;
    }
    const materialImpls = Array.from(this._pbrMaterialImpls.values());
    for (const impl of materialImpls) {
      if (material instanceof impl.materialClass) {
        return true;
      }
    }
    return false;
  }
  /**
   * Registers a loader extension.
   * @param name The name of the loader extension.
   * @param factory The factory function that creates the loader extension.
   * @deprecated Please use registerGLTFExtension instead.
   */
  static RegisterExtension(name, factory) {
    registerGLTFExtension(name, false, factory);
  }
  /**
   * Unregisters a loader extension.
   * @param name The name of the loader extension.
   * @returns A boolean indicating whether the extension has been unregistered
   * @deprecated Please use unregisterGLTFExtension instead.
   */
  static UnregisterExtension(name) {
    return unregisterGLTFExtension(name);
  }
  /**
   * The object that represents the glTF JSON.
   */
  get gltf() {
    if (!this._gltf) {
      throw new Error("glTF JSON is not available");
    }
    return this._gltf;
  }
  /**
   * The BIN chunk of a binary glTF.
   */
  get bin() {
    return this._bin;
  }
  /**
   * The parent file loader.
   */
  get parent() {
    return this._parent;
  }
  /**
   * The Babylon scene when loading the asset.
   */
  get babylonScene() {
    if (!this._babylonScene) {
      throw new Error("Scene is not available");
    }
    return this._babylonScene;
  }
  /**
   * The root Babylon node when loading the asset.
   */
  get rootBabylonMesh() {
    return this._rootBabylonMesh;
  }
  /**
   * The root url when loading the asset.
   */
  get rootUrl() {
    return this._rootUrl;
  }
  /**
   * @internal
   */
  constructor(parent) {
    this._completePromises = new Array();
    this._assetContainer = null;
    this._babylonLights = [];
    this._disableInstancedMesh = 0;
    this._allMaterialsDirtyRequired = false;
    this._skipStartAnimationStep = false;
    this._extensions = new Array();
    this._disposed = false;
    this._rootUrl = null;
    this._fileName = null;
    this._uniqueRootUrl = null;
    this._bin = null;
    this._rootBabylonMesh = null;
    this._defaultBabylonMaterialData = {};
    this._postSceneLoadActions = new Array();
    this._materialAdapterCache = /* @__PURE__ */ new WeakMap();
    this._materialAdapters = /* @__PURE__ */ new Set();
    this._pbrMaterialImpls = /* @__PURE__ */ new Map();
    this._parent = parent;
  }
  /**
   * Creates or gets a cached material loading adapter with dynamic imports
   * @param material The material to adapt
   * @returns Promise that resolves to the appropriate adapter
   * @internal
   */
  _getOrCreateMaterialAdapter(material) {
    let adapter = this._materialAdapterCache.get(material);
    if (!adapter) {
      const materialImpls = Array.from(this._pbrMaterialImpls.values());
      for (const impl of materialImpls) {
        if (material instanceof impl.materialClass) {
          adapter = new impl.adapterClass(material);
          break;
        }
      }
      if (!adapter) {
        throw new Error(`Appropriate material adapter class not found`);
      }
      const createdAdapter = adapter;
      this._materialAdapterCache.set(material, createdAdapter);
      this._materialAdapters.add(createdAdapter);
    }
    return adapter;
  }
  /** @internal */
  dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._completePromises.length = 0;
    this._extensions.forEach((extension) => extension.dispose && extension.dispose());
    this._extensions.length = 0;
    this._materialAdapters.clear();
    this._gltf = null;
    this._bin = null;
    this._babylonScene = null;
    this._rootBabylonMesh = null;
    this._defaultBabylonMaterialData = {};
    this._postSceneLoadActions.length = 0;
    this._parent.dispose();
  }
  /**
   * @internal
   */
  async importMeshAsync(meshesNames, scene, container, data, rootUrl, onProgress, fileName = "") {
    return await Promise.resolve().then(async () => {
      this._babylonScene = scene;
      this._assetContainer = container;
      this._loadData(data);
      let nodes = null;
      if (meshesNames) {
        const nodeMap = {};
        if (this._gltf.nodes) {
          for (const node of this._gltf.nodes) {
            if (node.name) {
              nodeMap[node.name] = node.index;
            }
          }
        }
        const names = meshesNames instanceof Array ? meshesNames : [meshesNames];
        nodes = names.map((name) => {
          const node = nodeMap[name];
          if (node === void 0) {
            throw new Error(`Failed to find node '${name}'`);
          }
          return node;
        });
      }
      return await this._loadAsync(rootUrl, fileName, nodes, () => {
        return {
          meshes: this._getMeshes(),
          particleSystems: [],
          skeletons: this._getSkeletons(),
          animationGroups: this._getAnimationGroups(),
          lights: this._babylonLights,
          transformNodes: this._getTransformNodes(),
          geometries: this._getGeometries(),
          spriteManagers: []
        };
      });
    });
  }
  /**
   * @internal
   */
  async loadAsync(scene, data, rootUrl, onProgress, fileName = "") {
    this._babylonScene = scene;
    this._loadData(data);
    return await this._loadAsync(rootUrl, fileName, null, () => void 0);
  }
  async _loadAsync(rootUrl, fileName, nodes, resultFunc) {
    return await Promise.resolve().then(async () => {
      this._rootUrl = rootUrl;
      this._uniqueRootUrl = !rootUrl.startsWith("file:") && fileName ? rootUrl : `${rootUrl}${RandomGUID()}/`;
      this._fileName = fileName;
      this._allMaterialsDirtyRequired = false;
      await this._loadExtensionsAsync();
      if (!this.parent.skipMaterials) {
        const needsOpenPBR = this.parent.useOpenPBR || this.isExtensionUsed("KHR_materials_openpbr");
        let needsPBR = false;
        if (!this.parent.useOpenPBR) {
          needsPBR = true;
        } else if (this._gltf.materials?.length && this._gltf.materials.some((m) => !m.extensions?.["KHR_materials_openpbr"])) {
          needsPBR = true;
        }
        const implPromises = [];
        if (needsOpenPBR && !this._pbrMaterialImpls.has("openpbr")) {
          implPromises.push(
            // Import the .pure module (which directly declares the class and its registration
            // function) rather than the side-effect wrapper. The wrapper re-exports the class via
            // `export *`, and some bundlers fail to surface star-re-exported bindings on a dynamic
            // import namespace across a chunk boundary (e.g. a Web Worker chunk), which would leave
            // materialClass undefined and throw a cryptic "materialClass is not a constructor" later.
            // A direct named export is reliable everywhere; we trigger registration explicitly.
            Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bK), true ? __vite__mapDeps([0,1]) : void 0, import.meta.url), __vitePreload(() => Promise.resolve().then(() => openpbrMaterialLoadingAdapter), true ? void 0 : void 0, import.meta.url)]).then(([{ OpenPBRMaterial: openPBRMaterialClass, RegisterOpenpbrMaterial: registerOpenPBRMaterial }, { OpenPBRMaterialLoadingAdapter: openPBRAdapterClass }]) => {
              registerOpenPBRMaterial();
              this._pbrMaterialImpls.set("openpbr", {
                materialClass: openPBRMaterialClass,
                adapterClass: openPBRAdapterClass
              });
            })
          );
        }
        if (needsPBR && !this._pbrMaterialImpls.has("pbr")) {
          implPromises.push(
            // See the openpbr note above: import the .pure module for a reliable class binding and
            // register the class explicitly instead of relying on the wrapper's `export *` re-export.
            Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.ba), true ? __vite__mapDeps([0,1]) : void 0, import.meta.url), __vitePreload(() => Promise.resolve().then(() => pbrMaterialLoadingAdapter), true ? void 0 : void 0, import.meta.url)]).then(([{ PBRMaterial: pbrMaterialClass, RegisterPbrMaterial: registerPBRMaterial }, { PBRMaterialLoadingAdapter: pbrAdapterClass }]) => {
              registerPBRMaterial();
              this._pbrMaterialImpls.set("pbr", {
                materialClass: pbrMaterialClass,
                adapterClass: pbrAdapterClass
              });
            })
          );
        }
        await Promise.all(implPromises);
      }
      const loadingToReadyCounterName = `${GLTFLoaderState[GLTFLoaderState.LOADING]} => ${GLTFLoaderState[GLTFLoaderState.READY]}`;
      const loadingToCompleteCounterName = `${GLTFLoaderState[GLTFLoaderState.LOADING]} => ${GLTFLoaderState[GLTFLoaderState.COMPLETE]}`;
      this._parent._startPerformanceCounter(loadingToReadyCounterName);
      this._parent._startPerformanceCounter(loadingToCompleteCounterName);
      this._parent._setState(GLTFLoaderState.LOADING);
      this._extensionsOnLoading();
      const promises = new Array();
      const oldBlockMaterialDirtyMechanism = this._babylonScene.blockMaterialDirtyMechanism;
      this._babylonScene.blockMaterialDirtyMechanism = true;
      if (!this.parent.loadOnlyMaterials) {
        if (nodes) {
          promises.push(this.loadSceneAsync("/nodes", { nodes, index: -1 }));
        } else if (this._gltf.scene != void 0 || this._gltf.scenes && this._gltf.scenes[0]) {
          const scene = ArrayItem.Get(`/scene`, this._gltf.scenes, this._gltf.scene || 0);
          promises.push(this.loadSceneAsync(`/scenes/${scene.index}`, scene));
        }
      }
      if (!this.parent.skipMaterials && this.parent.loadAllMaterials && this._gltf.materials) {
        for (let m = 0; m < this._gltf.materials.length; ++m) {
          const material = this._gltf.materials[m];
          const context = "/materials/" + m;
          const babylonDrawMode = Material.TriangleFillMode;
          promises.push(this._loadMaterialAsync(context, material, null, babylonDrawMode, () => {
          }));
        }
      }
      if (this._allMaterialsDirtyRequired) {
        this._babylonScene.blockMaterialDirtyMechanism = oldBlockMaterialDirtyMechanism;
      } else {
        this._babylonScene._forceBlockMaterialDirtyMechanism(oldBlockMaterialDirtyMechanism);
      }
      if (this._parent.compileMaterials) {
        promises.push(this._compileMaterialsAsync());
      }
      if (this._parent.compileShadowGenerators) {
        promises.push(this._compileShadowGeneratorsAsync());
      }
      const resultPromise = Promise.all(promises).then(() => {
        if (this._rootBabylonMesh && this._rootBabylonMesh !== this._parent.customRootNode) {
          this._rootBabylonMesh.setEnabled(true);
        }
        for (const material of this._babylonScene.materials) {
          const mat = material;
          if (mat.maxSimultaneousLights !== void 0) {
            mat.maxSimultaneousLights = Math.max(mat.maxSimultaneousLights, this._babylonScene.lights.length);
          }
        }
        for (const adapter of Array.from(this._materialAdapters)) {
          this._completePromises.push(adapter.finalizeAsync(this));
        }
        this._extensionsOnReady();
        this._parent._setState(GLTFLoaderState.READY);
        if (!this._skipStartAnimationStep) {
          this._startAnimations();
        }
        return resultFunc();
      });
      return await resultPromise.then((result) => {
        this._parent._endPerformanceCounter(loadingToReadyCounterName);
        Tools.SetImmediate(() => {
          if (!this._disposed) {
            Promise.all(this._completePromises).then(() => {
              this._parent._endPerformanceCounter(loadingToCompleteCounterName);
              this._parent._setState(GLTFLoaderState.COMPLETE);
              this._parent.onCompleteObservable.notifyObservers(void 0);
              this._parent.onCompleteObservable.clear();
              this.dispose();
            }, (error) => {
              this._parent.onErrorObservable.notifyObservers(error);
              this._parent.onErrorObservable.clear();
              this.dispose();
            });
          }
        });
        return result;
      });
    }).catch((error) => {
      if (!this._disposed) {
        this._parent.onErrorObservable.notifyObservers(error);
        this._parent.onErrorObservable.clear();
        this.dispose();
      }
      throw error;
    });
  }
  _loadData(data) {
    this._gltf = data.json;
    this._setupData();
    if (data.bin) {
      const buffers = this._gltf.buffers;
      if (buffers && buffers[0] && !buffers[0].uri) {
        const binaryBuffer = buffers[0];
        if (binaryBuffer.byteLength < data.bin.byteLength - 3 || binaryBuffer.byteLength > data.bin.byteLength) {
          Logger.Warn(`Binary buffer length (${binaryBuffer.byteLength}) from JSON does not match chunk length (${data.bin.byteLength})`);
        }
        this._bin = data.bin;
      } else {
        Logger.Warn("Unexpected BIN chunk");
      }
    }
  }
  _setupData() {
    ArrayItem.Assign(this._gltf.accessors);
    ArrayItem.Assign(this._gltf.animations);
    ArrayItem.Assign(this._gltf.buffers);
    ArrayItem.Assign(this._gltf.bufferViews);
    ArrayItem.Assign(this._gltf.cameras);
    ArrayItem.Assign(this._gltf.images);
    ArrayItem.Assign(this._gltf.materials);
    ArrayItem.Assign(this._gltf.meshes);
    ArrayItem.Assign(this._gltf.nodes);
    ArrayItem.Assign(this._gltf.samplers);
    ArrayItem.Assign(this._gltf.scenes);
    ArrayItem.Assign(this._gltf.skins);
    ArrayItem.Assign(this._gltf.textures);
    if (this._gltf.nodes) {
      const nodeParents = {};
      for (const node of this._gltf.nodes) {
        if (node.children) {
          for (const index of node.children) {
            nodeParents[index] = node.index;
          }
        }
      }
      const rootNode = this._createRootNode();
      for (const node of this._gltf.nodes) {
        const parentIndex = nodeParents[node.index];
        node.parent = parentIndex === void 0 ? rootNode : this._gltf.nodes[parentIndex];
      }
    }
  }
  async _loadExtensionsAsync() {
    const extensionPromises = [];
    registeredGLTFExtensions.forEach((registeredExtension, name) => {
      if (this.parent.extensionOptions[name]?.enabled === false) {
        if (registeredExtension.isGLTFExtension && this.isExtensionUsed(name)) {
          Logger.Warn(`Extension ${name} is used but has been explicitly disabled.`);
        }
      } else if (!registeredExtension.isGLTFExtension || this.isExtensionUsed(name)) {
        extensionPromises.push((async () => {
          const extension = await registeredExtension.factory(this);
          if (extension.name !== name) {
            Logger.Warn(`The name of the glTF loader extension instance does not match the registered name: ${extension.name} !== ${name}`);
          }
          this._parent.onExtensionLoadedObservable.notifyObservers(extension);
          return extension;
        })());
      }
    });
    this._extensions.push(...await Promise.all(extensionPromises));
    this._extensions.sort((a, b) => (a.order || Number.MAX_VALUE) - (b.order || Number.MAX_VALUE));
    this._parent.onExtensionLoadedObservable.clear();
    if (this._gltf.extensionsRequired) {
      for (const name of this._gltf.extensionsRequired) {
        const available = this._extensions.some((extension) => extension.name === name && extension.enabled);
        if (!available) {
          if (this.parent.extensionOptions[name]?.enabled === false) {
            throw new Error(`Required extension ${name} is disabled`);
          }
          throw new Error(`Required extension ${name} is not available`);
        }
      }
    }
  }
  _createRootNode() {
    if (this._parent.customRootNode !== void 0) {
      this._rootBabylonMesh = this._parent.customRootNode;
      return {
        _babylonTransformNode: this._rootBabylonMesh === null ? void 0 : this._rootBabylonMesh,
        index: -1
      };
    }
    this._babylonScene._blockEntityCollection = !!this._assetContainer;
    const rootMesh = new Mesh("__root__", this._babylonScene);
    this._rootBabylonMesh = rootMesh;
    this._rootBabylonMesh._parentContainer = this._assetContainer;
    this._babylonScene._blockEntityCollection = false;
    this._rootBabylonMesh.setEnabled(false);
    const rootNode = {
      _babylonTransformNode: this._rootBabylonMesh,
      index: -1
    };
    switch (this._parent.coordinateSystemMode) {
      case GLTFLoaderCoordinateSystemMode.AUTO: {
        if (!this._babylonScene.useRightHandedSystem) {
          rootNode.rotation = [0, 1, 0, 0];
          rootNode.scale = [1, 1, -1];
          GLTFLoader2._LoadTransform(rootNode, this._rootBabylonMesh);
        }
        break;
      }
      case GLTFLoaderCoordinateSystemMode.FORCE_RIGHT_HANDED: {
        this._babylonScene.useRightHandedSystem = true;
        break;
      }
      default: {
        throw new Error(`Invalid coordinate system mode (${this._parent.coordinateSystemMode})`);
      }
    }
    this._parent.onMeshLoadedObservable.notifyObservers(rootMesh);
    return rootNode;
  }
  /**
   * Loads a glTF scene.
   * @param context The context when loading the asset
   * @param scene The glTF scene property
   * @returns A promise that resolves when the load is complete
   */
  loadSceneAsync(context, scene) {
    const extensionPromise = this._extensionsLoadSceneAsync(context, scene);
    if (extensionPromise) {
      return extensionPromise;
    }
    const promises = new Array();
    this.logOpen(`${context} ${scene.name || ""}`);
    if (scene.nodes) {
      for (const index of scene.nodes) {
        const node = ArrayItem.Get(`${context}/nodes/${index}`, this._gltf.nodes, index);
        promises.push(this.loadNodeAsync(`/nodes/${node.index}`, node, (babylonMesh) => {
          babylonMesh.parent = this._rootBabylonMesh;
        }));
      }
    }
    for (const action of this._postSceneLoadActions) {
      action();
    }
    promises.push(this._loadAnimationsAsync());
    this.logClose();
    return Promise.all(promises).then(() => {
    });
  }
  _forEachPrimitive(node, callback) {
    if (node._primitiveBabylonMeshes) {
      for (const babylonMesh of node._primitiveBabylonMeshes) {
        callback(babylonMesh);
      }
    }
  }
  _getGeometries() {
    const geometries = [];
    const nodes = this._gltf.nodes;
    if (nodes) {
      for (const node of nodes) {
        this._forEachPrimitive(node, (babylonMesh) => {
          const geometry = babylonMesh.geometry;
          if (geometry && geometries.indexOf(geometry) === -1) {
            geometries.push(geometry);
          }
        });
      }
    }
    return geometries;
  }
  _getMeshes() {
    const meshes = [];
    if (this._rootBabylonMesh instanceof AbstractMesh) {
      meshes.push(this._rootBabylonMesh);
    }
    const nodes = this._gltf.nodes;
    if (nodes) {
      for (const node of nodes) {
        this._forEachPrimitive(node, (babylonMesh) => {
          meshes.push(babylonMesh);
        });
      }
    }
    return meshes;
  }
  _getTransformNodes() {
    const transformNodes = [];
    const nodes = this._gltf.nodes;
    if (nodes) {
      for (const node of nodes) {
        if (node._babylonTransformNode && node._babylonTransformNode.getClassName() === "TransformNode") {
          transformNodes.push(node._babylonTransformNode);
        }
        if (node._babylonTransformNodeForSkin) {
          transformNodes.push(node._babylonTransformNodeForSkin);
        }
      }
    }
    return transformNodes;
  }
  _getSkeletons() {
    const skeletons = [];
    const skins = this._gltf.skins;
    if (skins) {
      for (const skin of skins) {
        if (skin._data) {
          skeletons.push(skin._data.babylonSkeleton);
        }
      }
    }
    return skeletons;
  }
  _getAnimationGroups() {
    const animationGroups = [];
    const animations = this._gltf.animations;
    if (animations) {
      for (const animation of animations) {
        if (animation._babylonAnimationGroup) {
          animationGroups.push(animation._babylonAnimationGroup);
        }
      }
    }
    return animationGroups;
  }
  _startAnimations() {
    switch (this._parent.animationStartMode) {
      case GLTFLoaderAnimationStartMode.NONE: {
        break;
      }
      case GLTFLoaderAnimationStartMode.FIRST: {
        const babylonAnimationGroups = this._getAnimationGroups();
        if (babylonAnimationGroups.length !== 0) {
          babylonAnimationGroups[0].start(true);
        }
        break;
      }
      case GLTFLoaderAnimationStartMode.ALL: {
        const babylonAnimationGroups = this._getAnimationGroups();
        for (const babylonAnimationGroup of babylonAnimationGroups) {
          babylonAnimationGroup.start(true);
        }
        break;
      }
      default: {
        Logger.Error(`Invalid animation start mode (${this._parent.animationStartMode})`);
        return;
      }
    }
  }
  /**
   * Loads a glTF node.
   * @param context The context when loading the asset
   * @param node The glTF node property
   * @param assign A function called synchronously after parsing the glTF properties
   * @returns A promise that resolves with the loaded Babylon mesh when the load is complete
   */
  loadNodeAsync(context, node, assign = () => {
  }) {
    const extensionPromise = this._extensionsLoadNodeAsync(context, node, assign);
    if (extensionPromise) {
      return extensionPromise;
    }
    if (node._babylonTransformNode) {
      throw new Error(`${context}: Invalid recursive node hierarchy`);
    }
    const promises = new Array();
    this.logOpen(`${context} ${node.name || ""}`);
    const loadNode = (babylonTransformNode) => {
      GLTFLoader2.AddPointerMetadata(babylonTransformNode, context);
      GLTFLoader2._LoadTransform(node, babylonTransformNode);
      if (node.camera != void 0) {
        const camera = ArrayItem.Get(`${context}/camera`, this._gltf.cameras, node.camera);
        promises.push(this.loadCameraAsync(`/cameras/${camera.index}`, camera, (babylonCamera) => {
          babylonCamera.parent = babylonTransformNode;
          if (!this._babylonScene.useRightHandedSystem) {
            babylonTransformNode.scaling.x = -1;
          }
        }));
      }
      if (node.children) {
        for (const index of node.children) {
          const childNode = ArrayItem.Get(`${context}/children/${index}`, this._gltf.nodes, index);
          promises.push(this.loadNodeAsync(`/nodes/${childNode.index}`, childNode, (childBabylonMesh) => {
            childBabylonMesh.parent = babylonTransformNode;
          }));
        }
      }
      assign(babylonTransformNode);
    };
    const hasMesh = node.mesh != void 0;
    const hasSkin = this._parent.loadSkins && node.skin != void 0;
    if (!hasMesh || hasSkin) {
      const nodeName = node.name || `node${node.index}`;
      this._babylonScene._blockEntityCollection = !!this._assetContainer;
      const transformNode = new TransformNode(nodeName, this._babylonScene);
      transformNode._parentContainer = this._assetContainer;
      this._babylonScene._blockEntityCollection = false;
      if (node.mesh == void 0) {
        node._babylonTransformNode = transformNode;
      } else {
        node._babylonTransformNodeForSkin = transformNode;
      }
      loadNode(transformNode);
    }
    if (hasMesh) {
      if (hasSkin) {
        const mesh = ArrayItem.Get(`${context}/mesh`, this._gltf.meshes, node.mesh);
        promises.push(this._loadMeshAsync(`/meshes/${mesh.index}`, node, mesh, (babylonTransformNode) => {
          const babylonTransformNodeForSkin = node._babylonTransformNodeForSkin;
          babylonTransformNode.metadata = deepMerge(babylonTransformNodeForSkin.metadata, babylonTransformNode.metadata || {});
          const skin = ArrayItem.Get(`${context}/skin`, this._gltf.skins, node.skin);
          promises.push(this._loadSkinAsync(`/skins/${skin.index}`, node, skin, (babylonSkeleton) => {
            this._forEachPrimitive(node, (babylonMesh) => {
              babylonMesh.skeleton = babylonSkeleton;
            });
            this._postSceneLoadActions.push(() => {
              if (skin.skeleton != void 0) {
                const parentNode = ArrayItem.Get(`/skins/${skin.index}/skeleton`, this._gltf.nodes, skin.skeleton).parent;
                if (node.index === parentNode.index) {
                  babylonTransformNode.parent = babylonTransformNodeForSkin.parent;
                } else {
                  babylonTransformNode.parent = parentNode._babylonTransformNode;
                }
              } else {
                babylonTransformNode.parent = this._rootBabylonMesh;
              }
              this._parent.onSkinLoadedObservable.notifyObservers({ node: babylonTransformNodeForSkin, skinnedNode: babylonTransformNode });
            });
          }));
        }));
      } else {
        const mesh = ArrayItem.Get(`${context}/mesh`, this._gltf.meshes, node.mesh);
        promises.push(this._loadMeshAsync(`/meshes/${mesh.index}`, node, mesh, loadNode));
      }
    }
    this.logClose();
    return Promise.all(promises).then(() => {
      this._forEachPrimitive(node, (babylonMesh) => {
        const asMesh = babylonMesh;
        if (!asMesh.isAnInstance && asMesh.geometry && asMesh.geometry.useBoundingInfoFromGeometry) {
          babylonMesh._updateBoundingInfo();
        } else {
          babylonMesh.refreshBoundingInfo(true, true);
        }
      });
      return node._babylonTransformNode;
    });
  }
  _loadMeshAsync(context, node, mesh, assign) {
    const primitives = mesh.primitives;
    if (!primitives || !primitives.length) {
      throw new Error(`${context}: Primitives are missing`);
    }
    if (primitives[0].index == void 0) {
      ArrayItem.Assign(primitives);
    }
    const promises = new Array();
    this.logOpen(`${context} ${mesh.name || ""}`);
    const name = node.name || `node${node.index}`;
    if (primitives.length === 1) {
      const primitive = mesh.primitives[0];
      promises.push(this._loadMeshPrimitiveAsync(`${context}/primitives/${primitive.index}`, name, node, mesh, primitive, (babylonMesh) => {
        node._babylonTransformNode = babylonMesh;
        node._primitiveBabylonMeshes = [babylonMesh];
      }));
    } else {
      this._babylonScene._blockEntityCollection = !!this._assetContainer;
      node._babylonTransformNode = new TransformNode(name, this._babylonScene);
      node._babylonTransformNode._parentContainer = this._assetContainer;
      this._babylonScene._blockEntityCollection = false;
      node._primitiveBabylonMeshes = [];
      for (const primitive of primitives) {
        promises.push(this._loadMeshPrimitiveAsync(`${context}/primitives/${primitive.index}`, `${name}_primitive${primitive.index}`, node, mesh, primitive, (babylonMesh) => {
          babylonMesh.parent = node._babylonTransformNode;
          node._primitiveBabylonMeshes.push(babylonMesh);
        }));
      }
    }
    assign(node._babylonTransformNode);
    this.logClose();
    return Promise.all(promises).then(() => {
      return node._babylonTransformNode;
    });
  }
  /**
   * @internal Define this method to modify the default behavior when loading data for mesh primitives.
   * @param context The context when loading the asset
   * @param name The mesh name when loading the asset
   * @param node The glTF node when loading the asset
   * @param mesh The glTF mesh when loading the asset
   * @param primitive The glTF mesh primitive property
   * @param assign A function called synchronously after parsing the glTF properties
   * @returns A promise that resolves with the loaded mesh when the load is complete or null if not handled
   */
  _loadMeshPrimitiveAsync(context, name, node, mesh, primitive, assign) {
    const extensionPromise = this._extensionsLoadMeshPrimitiveAsync(context, name, node, mesh, primitive, assign);
    if (extensionPromise) {
      return extensionPromise;
    }
    this.logOpen(`${context}`);
    const shouldInstance = this._disableInstancedMesh === 0 && this._parent.createInstances && node.skin == void 0 && !mesh.primitives[0].targets;
    let babylonAbstractMesh;
    let promise;
    if (shouldInstance && primitive._instanceData) {
      this._babylonScene._blockEntityCollection = !!this._assetContainer;
      babylonAbstractMesh = primitive._instanceData.babylonSourceMesh.createInstance(name);
      babylonAbstractMesh._parentContainer = this._assetContainer;
      this._babylonScene._blockEntityCollection = false;
      promise = primitive._instanceData.promise;
    } else {
      const promises = new Array();
      this._babylonScene._blockEntityCollection = !!this._assetContainer;
      const babylonMesh = new Mesh(name, this._babylonScene);
      babylonMesh._parentContainer = this._assetContainer;
      this._babylonScene._blockEntityCollection = false;
      babylonMesh.sideOrientation = this._babylonScene.useRightHandedSystem ? Material.CounterClockWiseSideOrientation : Material.ClockWiseSideOrientation;
      this._createMorphTargets(context, node, mesh, primitive, babylonMesh);
      promises.push(this._loadVertexDataAsync(context, primitive, babylonMesh).then(async (babylonGeometry) => {
        return await this._loadMorphTargetsAsync(context, primitive, babylonMesh, babylonGeometry).then(() => {
          if (this._disposed) {
            return;
          }
          this._babylonScene._blockEntityCollection = !!this._assetContainer;
          babylonGeometry.applyToMesh(babylonMesh);
          babylonGeometry._parentContainer = this._assetContainer;
          this._babylonScene._blockEntityCollection = false;
        });
      }));
      if (!this.parent.skipMaterials) {
        const babylonDrawMode = GLTFLoader2._GetDrawMode(context, primitive.mode);
        if (primitive.material == void 0) {
          let babylonMaterial = this._defaultBabylonMaterialData[babylonDrawMode];
          if (!babylonMaterial) {
            babylonMaterial = this._createDefaultMaterial("__GLTFLoader._default", babylonDrawMode, this._getDefaultImpl());
            this._parent.onMaterialLoadedObservable.notifyObservers(babylonMaterial);
            this._defaultBabylonMaterialData[babylonDrawMode] = babylonMaterial;
          }
          babylonMesh.material = babylonMaterial;
        } else {
          const material = ArrayItem.Get(`${context}/material`, this._gltf.materials, primitive.material);
          promises.push(this._loadMaterialAsync(`/materials/${material.index}`, material, babylonMesh, babylonDrawMode, (babylonMaterial) => {
            babylonMesh.material = babylonMaterial;
          }));
        }
      }
      promise = Promise.all(promises);
      if (shouldInstance) {
        primitive._instanceData = {
          babylonSourceMesh: babylonMesh,
          promise
        };
      }
      babylonAbstractMesh = babylonMesh;
    }
    GLTFLoader2.AddPointerMetadata(babylonAbstractMesh, context);
    this._parent.onMeshLoadedObservable.notifyObservers(babylonAbstractMesh);
    assign(babylonAbstractMesh);
    this.logClose();
    return promise.then(() => {
      return babylonAbstractMesh;
    });
  }
  _loadVertexDataAsync(context, primitive, babylonMesh) {
    const extensionPromise = this._extensionsLoadVertexDataAsync(context, primitive, babylonMesh);
    if (extensionPromise) {
      return extensionPromise;
    }
    const attributes = primitive.attributes;
    if (!attributes) {
      throw new Error(`${context}: Attributes are missing`);
    }
    const promises = new Array();
    const babylonGeometry = new Geometry(babylonMesh.name, this._babylonScene);
    if (primitive.indices == void 0) {
      babylonMesh.isUnIndexed = true;
    } else {
      const accessor = ArrayItem.Get(`${context}/indices`, this._gltf.accessors, primitive.indices);
      promises.push(this._loadIndicesAccessorAsync(`/accessors/${accessor.index}`, accessor).then((data) => {
        babylonGeometry.setIndices(data);
      }));
    }
    const loadAttribute = (name, kind, callback) => {
      if (attributes[name] == void 0) {
        return;
      }
      babylonMesh._delayInfo = babylonMesh._delayInfo || [];
      if (babylonMesh._delayInfo.indexOf(kind) === -1) {
        babylonMesh._delayInfo.push(kind);
      }
      const accessor = ArrayItem.Get(`${context}/attributes/${name}`, this._gltf.accessors, attributes[name]);
      promises.push(this._loadVertexAccessorAsync(`/accessors/${accessor.index}`, accessor, kind).then((babylonVertexBuffer) => {
        if (babylonVertexBuffer.getKind() === VertexBuffer.PositionKind && !this.parent.alwaysComputeBoundingBox && !babylonMesh.skeleton) {
          const babylonBoundingInfo = LoadBoundingInfoFromPositionAccessor(accessor);
          if (babylonBoundingInfo) {
            babylonGeometry._boundingInfo = babylonBoundingInfo;
            babylonGeometry.useBoundingInfoFromGeometry = true;
          }
        }
        babylonGeometry.setVerticesBuffer(babylonVertexBuffer, accessor.count);
      }));
      if (kind == VertexBuffer.MatricesIndicesExtraKind) {
        babylonMesh.numBoneInfluencers = 8;
      }
      if (callback) {
        callback(accessor);
      }
    };
    loadAttribute("POSITION", VertexBuffer.PositionKind);
    loadAttribute("NORMAL", VertexBuffer.NormalKind);
    loadAttribute("TANGENT", VertexBuffer.TangentKind);
    loadAttribute("TEXCOORD_0", VertexBuffer.UVKind);
    loadAttribute("TEXCOORD_1", VertexBuffer.UV2Kind);
    loadAttribute("TEXCOORD_2", VertexBuffer.UV3Kind);
    loadAttribute("TEXCOORD_3", VertexBuffer.UV4Kind);
    loadAttribute("TEXCOORD_4", VertexBuffer.UV5Kind);
    loadAttribute("TEXCOORD_5", VertexBuffer.UV6Kind);
    loadAttribute("JOINTS_0", VertexBuffer.MatricesIndicesKind);
    loadAttribute("WEIGHTS_0", VertexBuffer.MatricesWeightsKind);
    loadAttribute("JOINTS_1", VertexBuffer.MatricesIndicesExtraKind);
    loadAttribute("WEIGHTS_1", VertexBuffer.MatricesWeightsExtraKind);
    loadAttribute("COLOR_0", VertexBuffer.ColorKind, (accessor) => {
      if (accessor.type === "VEC4") {
        babylonMesh.hasVertexAlpha = true;
      }
    });
    return Promise.all(promises).then(() => {
      return babylonGeometry;
    });
  }
  _createMorphTargets(context, node, mesh, primitive, babylonMesh) {
    if (!primitive.targets || !this._parent.loadMorphTargets) {
      return;
    }
    if (node._numMorphTargets == void 0) {
      node._numMorphTargets = primitive.targets.length;
    } else if (primitive.targets.length !== node._numMorphTargets) {
      throw new Error(`${context}: Primitives do not have the same number of targets`);
    }
    const targetNames = mesh.extras ? mesh.extras.targetNames : null;
    this._babylonScene._blockEntityCollection = !!this._assetContainer;
    babylonMesh.morphTargetManager = new MorphTargetManager(this._babylonScene);
    babylonMesh.morphTargetManager._parentContainer = this._assetContainer;
    this._babylonScene._blockEntityCollection = false;
    babylonMesh.morphTargetManager.areUpdatesFrozen = true;
    for (let index = 0; index < primitive.targets.length; index++) {
      const weight = node.weights ? node.weights[index] : mesh.weights ? mesh.weights[index] : 0;
      const name = targetNames ? targetNames[index] : `morphTarget${index}`;
      babylonMesh.morphTargetManager.addTarget(new MorphTarget(name, weight, babylonMesh.getScene()));
    }
  }
  _loadMorphTargetsAsync(context, primitive, babylonMesh, babylonGeometry) {
    if (!primitive.targets || !this._parent.loadMorphTargets) {
      return Promise.resolve();
    }
    const promises = new Array();
    const morphTargetManager = babylonMesh.morphTargetManager;
    for (let index = 0; index < morphTargetManager.numTargets; index++) {
      const babylonMorphTarget = morphTargetManager.getTarget(index);
      promises.push(this._loadMorphTargetVertexDataAsync(`${context}/targets/${index}`, babylonGeometry, primitive.targets[index], babylonMorphTarget));
    }
    return Promise.all(promises).then(() => {
      morphTargetManager.areUpdatesFrozen = false;
      if (this._parent.useMaxMorphTargetInfluencers) {
        if (morphTargetManager.isUsingTextureForTargets || morphTargetManager.numTargets <= MorphTargetManager.MaxActiveMorphTargetsInVertexAttributeMode) {
          morphTargetManager.optimizeInfluencers = false;
          morphTargetManager.numMaxInfluencers = morphTargetManager.numTargets;
        }
      }
    });
  }
  async _loadMorphTargetVertexDataAsync(context, babylonGeometry, attributes, babylonMorphTarget) {
    const promises = new Array();
    const loadAttribute = (attribute, kind, setData) => {
      if (attributes[attribute] == void 0) {
        return;
      }
      const babylonVertexBuffer = babylonGeometry.getVertexBuffer(kind);
      if (!babylonVertexBuffer) {
        return;
      }
      const accessor = ArrayItem.Get(`${context}/${attribute}`, this._gltf.accessors, attributes[attribute]);
      promises.push(this._loadFloatAccessorAsync(`/accessors/${accessor.index}`, accessor).then((data) => {
        setData(babylonVertexBuffer, data);
      }));
    };
    loadAttribute("POSITION", VertexBuffer.PositionKind, (babylonVertexBuffer, data) => {
      const positions = new Float32Array(data.length);
      babylonVertexBuffer.forEach(data.length, (value, index) => {
        positions[index] = data[index] + value;
      });
      babylonMorphTarget.setPositions(positions);
    });
    loadAttribute("NORMAL", VertexBuffer.NormalKind, (babylonVertexBuffer, data) => {
      const normals = new Float32Array(data.length);
      babylonVertexBuffer.forEach(normals.length, (value, index) => {
        normals[index] = data[index] + value;
      });
      babylonMorphTarget.setNormals(normals);
    });
    loadAttribute("TANGENT", VertexBuffer.TangentKind, (babylonVertexBuffer, data) => {
      const tangents = new Float32Array(data.length / 3 * 4);
      let dataIndex = 0;
      babylonVertexBuffer.forEach(data.length / 3 * 4, (value, index) => {
        if ((index + 1) % 4 !== 0) {
          tangents[dataIndex] = data[dataIndex] + value;
          dataIndex++;
        }
      });
      babylonMorphTarget.setTangents(tangents);
    });
    loadAttribute("TEXCOORD_0", VertexBuffer.UVKind, (babylonVertexBuffer, data) => {
      const uvs = new Float32Array(data.length);
      babylonVertexBuffer.forEach(data.length, (value, index) => {
        uvs[index] = data[index] + value;
      });
      babylonMorphTarget.setUVs(uvs);
    });
    loadAttribute("TEXCOORD_1", VertexBuffer.UV2Kind, (babylonVertexBuffer, data) => {
      const uvs = new Float32Array(data.length);
      babylonVertexBuffer.forEach(data.length, (value, index) => {
        uvs[index] = data[index] + value;
      });
      babylonMorphTarget.setUV2s(uvs);
    });
    loadAttribute("COLOR_0", VertexBuffer.ColorKind, (babylonVertexBuffer, data) => {
      let colors = null;
      const componentSize = babylonVertexBuffer.getSize();
      if (componentSize === 3) {
        colors = new Float32Array(data.length / 3 * 4);
        babylonVertexBuffer.forEach(data.length, (value, index) => {
          const pixid = Math.floor(index / 3);
          const channel = index % 3;
          colors[4 * pixid + channel] = data[3 * pixid + channel] + value;
        });
        for (let i = 0; i < data.length / 3; ++i) {
          colors[4 * i + 3] = 1;
        }
      } else if (componentSize === 4) {
        colors = new Float32Array(data.length);
        babylonVertexBuffer.forEach(data.length, (value, index) => {
          colors[index] = data[index] + value;
        });
      } else {
        throw new Error(`${context}: Invalid number of components (${componentSize}) for COLOR_0 attribute`);
      }
      babylonMorphTarget.setColors(colors);
    });
    return await Promise.all(promises).then(() => {
    });
  }
  static _LoadTransform(node, babylonNode) {
    if (node.skin != void 0) {
      return;
    }
    let position = Vector3.Zero();
    let rotation = Quaternion.Identity();
    let scaling = Vector3.One();
    if (node.matrix) {
      const matrix = Matrix.FromArray(node.matrix);
      matrix.decompose(scaling, rotation, position);
    } else {
      if (node.translation) {
        position = Vector3.FromArray(node.translation);
      }
      if (node.rotation) {
        rotation = Quaternion.FromArray(node.rotation);
      }
      if (node.scale) {
        scaling = Vector3.FromArray(node.scale);
      }
    }
    babylonNode.position = position;
    babylonNode.rotationQuaternion = rotation;
    babylonNode.scaling = scaling;
  }
  _loadSkinAsync(context, node, skin, assign) {
    if (!this._parent.loadSkins) {
      return Promise.resolve();
    }
    const extensionPromise = this._extensionsLoadSkinAsync(context, node, skin);
    if (extensionPromise) {
      return extensionPromise;
    }
    if (skin._data) {
      assign(skin._data.babylonSkeleton);
      return skin._data.promise;
    }
    const skeletonId = `skeleton${skin.index}`;
    this._babylonScene._blockEntityCollection = !!this._assetContainer;
    const babylonSkeleton = new Skeleton(skin.name || skeletonId, skeletonId, this._babylonScene);
    babylonSkeleton._parentContainer = this._assetContainer;
    this._babylonScene._blockEntityCollection = false;
    this._loadBones(context, skin, babylonSkeleton);
    const promise = this._loadSkinInverseBindMatricesDataAsync(context, skin).then((inverseBindMatricesData) => {
      this._updateBoneMatrices(babylonSkeleton, inverseBindMatricesData);
    });
    skin._data = {
      babylonSkeleton,
      promise
    };
    assign(babylonSkeleton);
    return promise;
  }
  _loadBones(context, skin, babylonSkeleton) {
    if (skin.skeleton == void 0 || this._parent.alwaysComputeSkeletonRootNode) {
      const rootNode = this._findSkeletonRootNode(`${context}/joints`, skin.joints);
      if (rootNode) {
        if (skin.skeleton === void 0) {
          skin.skeleton = rootNode.index;
        } else {
          const isParent = (a, b) => {
            for (; b.parent; b = b.parent) {
              if (b.parent === a) {
                return true;
              }
            }
            return false;
          };
          const skeletonNode = ArrayItem.Get(`${context}/skeleton`, this._gltf.nodes, skin.skeleton);
          if (skeletonNode !== rootNode && !isParent(skeletonNode, rootNode)) {
            Logger.Warn(`${context}/skeleton: Overriding with nearest common ancestor as skeleton node is not a common root`);
            skin.skeleton = rootNode.index;
          }
        }
      } else {
        Logger.Warn(`${context}: Failed to find common root`);
      }
    }
    const babylonBones = {};
    for (const index of skin.joints) {
      const node = ArrayItem.Get(`${context}/joints/${index}`, this._gltf.nodes, index);
      this._loadBone(node, skin, babylonSkeleton, babylonBones);
    }
  }
  _findSkeletonRootNode(context, joints) {
    if (joints.length === 0) {
      return null;
    }
    const paths = {};
    for (const index of joints) {
      const path = [];
      let node = ArrayItem.Get(`${context}/${index}`, this._gltf.nodes, index);
      while (node.index !== -1) {
        path.unshift(node);
        node = node.parent;
      }
      paths[index] = path;
    }
    let rootNode = null;
    for (let i = 0; ; ++i) {
      let path = paths[joints[0]];
      if (i >= path.length) {
        return rootNode;
      }
      const node = path[i];
      for (let j = 1; j < joints.length; ++j) {
        path = paths[joints[j]];
        if (i >= path.length || node !== path[i]) {
          return rootNode;
        }
      }
      rootNode = node;
    }
  }
  _loadBone(node, skin, babylonSkeleton, babylonBones) {
    node._isJoint = true;
    let babylonBone = babylonBones[node.index];
    if (babylonBone) {
      return babylonBone;
    }
    let parentBabylonBone = null;
    if (node.index !== skin.skeleton) {
      if (node.parent && node.parent.index !== -1) {
        parentBabylonBone = this._loadBone(node.parent, skin, babylonSkeleton, babylonBones);
      } else if (skin.skeleton !== void 0) {
        Logger.Warn(`/skins/${skin.index}/skeleton: Skeleton node is not a common root`);
      }
    }
    const boneIndex = skin.joints.indexOf(node.index);
    babylonBone = new Bone(node.name || `joint${node.index}`, babylonSkeleton, parentBabylonBone, this._getNodeMatrix(node), null, null, boneIndex);
    babylonBones[node.index] = babylonBone;
    this._postSceneLoadActions.push(() => {
      babylonBone.linkTransformNode(node._babylonTransformNode);
    });
    return babylonBone;
  }
  _loadSkinInverseBindMatricesDataAsync(context, skin) {
    if (skin.inverseBindMatrices == void 0) {
      return Promise.resolve(null);
    }
    const accessor = ArrayItem.Get(`${context}/inverseBindMatrices`, this._gltf.accessors, skin.inverseBindMatrices);
    return this._loadFloatAccessorAsync(`/accessors/${accessor.index}`, accessor);
  }
  _updateBoneMatrices(babylonSkeleton, inverseBindMatricesData) {
    for (const babylonBone of babylonSkeleton.bones) {
      const baseMatrix = Matrix.Identity();
      const boneIndex = babylonBone._index;
      if (inverseBindMatricesData && boneIndex !== -1) {
        Matrix.FromArrayToRef(inverseBindMatricesData, boneIndex * 16, baseMatrix);
        baseMatrix.invertToRef(baseMatrix);
      }
      const babylonParentBone = babylonBone.getParent();
      if (babylonParentBone) {
        baseMatrix.multiplyToRef(babylonParentBone.getAbsoluteInverseBindMatrix(), baseMatrix);
      }
      babylonBone.updateMatrix(baseMatrix, false, false);
      babylonBone._updateAbsoluteBindMatrices(void 0, false);
    }
  }
  _getNodeMatrix(node) {
    return node.matrix ? Matrix.FromArray(node.matrix) : Matrix.Compose(node.scale ? Vector3.FromArray(node.scale) : Vector3.One(), node.rotation ? Quaternion.FromArray(node.rotation) : Quaternion.Identity(), node.translation ? Vector3.FromArray(node.translation) : Vector3.Zero());
  }
  /**
   * Loads a glTF camera.
   * @param context The context when loading the asset
   * @param camera The glTF camera property
   * @param assign A function called synchronously after parsing the glTF properties
   * @returns A promise that resolves with the loaded Babylon camera when the load is complete
   */
  loadCameraAsync(context, camera, assign = () => {
  }) {
    const extensionPromise = this._extensionsLoadCameraAsync(context, camera, assign);
    if (extensionPromise) {
      return extensionPromise;
    }
    const promises = new Array();
    this.logOpen(`${context} ${camera.name || ""}`);
    this._babylonScene._blockEntityCollection = !!this._assetContainer;
    const babylonCamera = new FreeCamera(camera.name || `camera${camera.index}`, Vector3.Zero(), this._babylonScene, false);
    babylonCamera._parentContainer = this._assetContainer;
    this._babylonScene._blockEntityCollection = false;
    camera._babylonCamera = babylonCamera;
    babylonCamera.setTarget(new Vector3(0, 0, -1));
    switch (camera.type) {
      case "perspective": {
        const perspective = camera.perspective;
        if (!perspective) {
          throw new Error(`${context}: Camera perspective properties are missing`);
        }
        babylonCamera.fov = perspective.yfov;
        babylonCamera.minZ = perspective.znear;
        babylonCamera.maxZ = perspective.zfar || 0;
        break;
      }
      case "orthographic": {
        if (!camera.orthographic) {
          throw new Error(`${context}: Camera orthographic properties are missing`);
        }
        babylonCamera.mode = Camera.ORTHOGRAPHIC_CAMERA;
        babylonCamera.orthoLeft = -camera.orthographic.xmag;
        babylonCamera.orthoRight = camera.orthographic.xmag;
        babylonCamera.orthoBottom = -camera.orthographic.ymag;
        babylonCamera.orthoTop = camera.orthographic.ymag;
        babylonCamera.minZ = camera.orthographic.znear;
        babylonCamera.maxZ = camera.orthographic.zfar;
        break;
      }
      default: {
        throw new Error(`${context}: Invalid camera type (${camera.type})`);
      }
    }
    GLTFLoader2.AddPointerMetadata(babylonCamera, context);
    this._parent.onCameraLoadedObservable.notifyObservers(babylonCamera);
    assign(babylonCamera);
    this.logClose();
    return Promise.all(promises).then(() => {
      return babylonCamera;
    });
  }
  _loadAnimationsAsync() {
    this._parent._startPerformanceCounter("Load animations");
    const animations = this._gltf.animations;
    if (!animations) {
      return Promise.resolve();
    }
    const promises = new Array();
    for (let index = 0; index < animations.length; index++) {
      const animation = animations[index];
      promises.push(this.loadAnimationAsync(`/animations/${animation.index}`, animation).then((animationGroup) => {
        if (animationGroup.targetedAnimations.length === 0) {
          animationGroup.dispose();
        }
      }));
    }
    return Promise.all(promises).then(() => {
      this._parent._endPerformanceCounter("Load animations");
    });
  }
  /**
   * Loads a glTF animation.
   * @param context The context when loading the asset
   * @param animation The glTF animation property
   * @returns A promise that resolves with the loaded Babylon animation group when the load is complete
   */
  loadAnimationAsync(context, animation) {
    this._parent._startPerformanceCounter("Load animation");
    const promise = this._extensionsLoadAnimationAsync(context, animation);
    if (promise) {
      return promise;
    }
    return LazyAnimationGroupModulePromise.value.then(({ AnimationGroup }) => {
      this._babylonScene._blockEntityCollection = !!this._assetContainer;
      const babylonAnimationGroup = new AnimationGroup(animation.name || `animation${animation.index}`, this._babylonScene);
      babylonAnimationGroup._parentContainer = this._assetContainer;
      this._babylonScene._blockEntityCollection = false;
      animation._babylonAnimationGroup = babylonAnimationGroup;
      const promises = new Array();
      ArrayItem.Assign(animation.channels);
      ArrayItem.Assign(animation.samplers);
      for (const channel of animation.channels) {
        promises.push(this._loadAnimationChannelAsync(`${context}/channels/${channel.index}`, context, animation, channel, (babylonTarget, babylonAnimation) => {
          babylonTarget.animations = babylonTarget.animations || [];
          babylonTarget.animations.push(babylonAnimation);
          babylonAnimationGroup.addTargetedAnimation(babylonAnimation, babylonTarget);
        }));
      }
      this._parent._endPerformanceCounter("Load animation");
      return Promise.all(promises).then(() => {
        babylonAnimationGroup.normalize(0);
        return babylonAnimationGroup;
      });
    });
  }
  /**
   * @hidden
   * Loads a glTF animation channel.
   * @param context The context when loading the asset
   * @param animationContext The context of the animation when loading the asset
   * @param animation The glTF animation property
   * @param channel The glTF animation channel property
   * @param onLoad Called for each animation loaded
   * @returns A void promise that resolves when the load is complete
   */
  _loadAnimationChannelAsync(context, animationContext, animation, channel, onLoad) {
    const promise = this._extensionsLoadAnimationChannelAsync(context, animationContext, animation, channel, onLoad);
    if (promise) {
      return promise;
    }
    if (channel.target.node == void 0) {
      return Promise.resolve();
    }
    const targetNode = ArrayItem.Get(`${context}/target/node`, this._gltf.nodes, channel.target.node);
    const channelTargetPath = channel.target.path;
    const pathIsWeights = channelTargetPath === "weights";
    if (pathIsWeights && !targetNode._numMorphTargets || !pathIsWeights && !targetNode._babylonTransformNode) {
      return Promise.resolve();
    }
    if (!this._parent.loadNodeAnimations && !pathIsWeights && !targetNode._isJoint) {
      return Promise.resolve();
    }
    return LazyLoaderAnimationModulePromise.value.then(() => {
      let properties;
      switch (channelTargetPath) {
        case "translation": {
          properties = GetMappingForKey("/nodes/{}/translation")?.interpolation;
          break;
        }
        case "rotation": {
          properties = GetMappingForKey("/nodes/{}/rotation")?.interpolation;
          break;
        }
        case "scale": {
          properties = GetMappingForKey("/nodes/{}/scale")?.interpolation;
          break;
        }
        case "weights": {
          properties = GetMappingForKey("/nodes/{}/weights")?.interpolation;
          break;
        }
        default: {
          throw new Error(`${context}/target/path: Invalid value (${channel.target.path})`);
        }
      }
      if (!properties) {
        throw new Error(`${context}/target/path: Could not find interpolation properties for target path (${channel.target.path})`);
      }
      const targetInfo = {
        object: targetNode,
        info: properties
      };
      return this._loadAnimationChannelFromTargetInfoAsync(context, animationContext, animation, channel, targetInfo, onLoad);
    });
  }
  /**
   * @hidden
   * Loads a glTF animation channel.
   * @param context The context when loading the asset
   * @param animationContext The context of the animation when loading the asset
   * @param animation The glTF animation property
   * @param channel The glTF animation channel property
   * @param targetInfo The glTF target and properties
   * @param onLoad Called for each animation loaded
   * @returns A void promise that resolves when the load is complete
   */
  _loadAnimationChannelFromTargetInfoAsync(context, animationContext, animation, channel, targetInfo, onLoad) {
    const fps = this.parent.targetFps;
    const invfps = 1 / fps;
    const sampler = ArrayItem.Get(`${context}/sampler`, animation.samplers, channel.sampler);
    return this._loadAnimationSamplerAsync(`${animationContext}/samplers/${channel.sampler}`, sampler).then((data) => {
      let numAnimations = 0;
      const target = targetInfo.object;
      const propertyInfos = targetInfo.info;
      for (const propertyInfo of propertyInfos) {
        const stride = propertyInfo.getStride(target);
        const input = data.input;
        const output = data.output;
        const keys = new Array(input.length);
        let outputOffset = 0;
        switch (data.interpolation) {
          case "STEP": {
            for (let index = 0; index < input.length; index++) {
              const value = propertyInfo.getValue(target, output, outputOffset, 1);
              outputOffset += stride;
              keys[index] = {
                frame: input[index] * fps,
                value,
                interpolation: 1
              };
            }
            break;
          }
          case "CUBICSPLINE": {
            for (let index = 0; index < input.length; index++) {
              const inTangent = propertyInfo.getValue(target, output, outputOffset, invfps);
              outputOffset += stride;
              const value = propertyInfo.getValue(target, output, outputOffset, 1);
              outputOffset += stride;
              const outTangent = propertyInfo.getValue(target, output, outputOffset, invfps);
              outputOffset += stride;
              keys[index] = {
                frame: input[index] * fps,
                inTangent,
                value,
                outTangent
              };
            }
            break;
          }
          case "LINEAR": {
            for (let index = 0; index < input.length; index++) {
              const value = propertyInfo.getValue(target, output, outputOffset, 1);
              outputOffset += stride;
              keys[index] = {
                frame: input[index] * fps,
                value
              };
            }
            break;
          }
        }
        if (outputOffset > 0) {
          const name = `${animation.name || `animation${animation.index}`}_channel${channel.index}_${numAnimations}`;
          const babylonAnimations = propertyInfo.buildAnimations(target, name, fps, keys);
          for (const babylonAnimation of babylonAnimations) {
            numAnimations++;
            onLoad(babylonAnimation.babylonAnimatable, babylonAnimation.babylonAnimation);
          }
        }
      }
    });
  }
  _loadAnimationSamplerAsync(context, sampler) {
    if (sampler._data) {
      return sampler._data;
    }
    const interpolation = sampler.interpolation || "LINEAR";
    switch (interpolation) {
      case "STEP":
      case "LINEAR":
      case "CUBICSPLINE": {
        break;
      }
      default: {
        throw new Error(`${context}/interpolation: Invalid value (${sampler.interpolation})`);
      }
    }
    const inputAccessor = ArrayItem.Get(`${context}/input`, this._gltf.accessors, sampler.input);
    const outputAccessor = ArrayItem.Get(`${context}/output`, this._gltf.accessors, sampler.output);
    sampler._data = Promise.all([
      this._loadFloatAccessorAsync(`/accessors/${inputAccessor.index}`, inputAccessor),
      this._loadFloatAccessorAsync(`/accessors/${outputAccessor.index}`, outputAccessor)
    ]).then(([inputData, outputData]) => {
      return {
        input: inputData,
        interpolation,
        output: outputData
      };
    });
    return sampler._data;
  }
  /**
   * Loads a glTF buffer.
   * @param context The context when loading the asset
   * @param buffer The glTF buffer property
   * @param byteOffset The byte offset to use
   * @param byteLength The byte length to use
   * @returns A promise that resolves with the loaded data when the load is complete
   */
  loadBufferAsync(context, buffer, byteOffset, byteLength) {
    const extensionPromise = this._extensionsLoadBufferAsync(context, buffer, byteOffset, byteLength);
    if (extensionPromise) {
      return extensionPromise;
    }
    if (!buffer._data) {
      if (buffer.uri) {
        buffer._data = this.loadUriAsync(`${context}/uri`, buffer, buffer.uri);
      } else {
        if (!this._bin) {
          throw new Error(`${context}: Uri is missing or the binary glTF is missing its binary chunk`);
        }
        buffer._data = this._bin.readAsync(0, buffer.byteLength);
      }
    }
    return buffer._data.then((data) => {
      try {
        return new Uint8Array(data.buffer, data.byteOffset + byteOffset, byteLength);
      } catch (e) {
        throw new Error(`${context}: ${e.message}`, { cause: e });
      }
    });
  }
  /**
   * Loads a glTF buffer view.
   * @param context The context when loading the asset
   * @param bufferView The glTF buffer view property
   * @returns A promise that resolves with the loaded data when the load is complete
   */
  loadBufferViewAsync(context, bufferView) {
    const extensionPromise = this._extensionsLoadBufferViewAsync(context, bufferView);
    if (extensionPromise) {
      return extensionPromise;
    }
    if (bufferView._data) {
      return bufferView._data;
    }
    const buffer = ArrayItem.Get(`${context}/buffer`, this._gltf.buffers, bufferView.buffer);
    bufferView._data = this.loadBufferAsync(`/buffers/${buffer.index}`, buffer, bufferView.byteOffset || 0, bufferView.byteLength);
    return bufferView._data;
  }
  _loadAccessorAsync(context, accessor, constructor) {
    if (accessor._data) {
      return accessor._data;
    }
    const numComponents = GLTFLoader2._GetNumComponents(context, accessor.type);
    const byteStride = numComponents * VertexBufferGetTypeByteLength(accessor.componentType);
    const length = numComponents * accessor.count;
    if (accessor.bufferView == void 0) {
      accessor._data = Promise.resolve(new constructor(length));
    } else {
      const bufferView = ArrayItem.Get(`${context}/bufferView`, this._gltf.bufferViews, accessor.bufferView);
      accessor._data = this.loadBufferViewAsync(`/bufferViews/${bufferView.index}`, bufferView).then((data) => {
        if (accessor.componentType === 5126 && !accessor.normalized && (!bufferView.byteStride || bufferView.byteStride === byteStride)) {
          return GLTFLoader2._GetTypedArray(context, accessor.componentType, data, accessor.byteOffset, length);
        } else {
          const typedArray = new constructor(length);
          VertexBufferForEach(data, accessor.byteOffset || 0, bufferView.byteStride || byteStride, numComponents, accessor.componentType, typedArray.length, accessor.normalized || false, (value, index) => {
            typedArray[index] = value;
          });
          return typedArray;
        }
      });
    }
    if (accessor.sparse) {
      const sparse = accessor.sparse;
      accessor._data = accessor._data.then((data) => {
        const typedArray = data;
        const indicesBufferView = ArrayItem.Get(`${context}/sparse/indices/bufferView`, this._gltf.bufferViews, sparse.indices.bufferView);
        const valuesBufferView = ArrayItem.Get(`${context}/sparse/values/bufferView`, this._gltf.bufferViews, sparse.values.bufferView);
        return Promise.all([
          this.loadBufferViewAsync(`/bufferViews/${indicesBufferView.index}`, indicesBufferView),
          this.loadBufferViewAsync(`/bufferViews/${valuesBufferView.index}`, valuesBufferView)
        ]).then(([indicesData, valuesData]) => {
          const indices = GLTFLoader2._GetTypedArray(`${context}/sparse/indices`, sparse.indices.componentType, indicesData, sparse.indices.byteOffset, sparse.count);
          const sparseLength = numComponents * sparse.count;
          let values;
          if (accessor.componentType === 5126 && !accessor.normalized) {
            values = GLTFLoader2._GetTypedArray(`${context}/sparse/values`, accessor.componentType, valuesData, sparse.values.byteOffset, sparseLength);
          } else {
            const sparseData = GLTFLoader2._GetTypedArray(`${context}/sparse/values`, accessor.componentType, valuesData, sparse.values.byteOffset, sparseLength);
            values = new constructor(sparseLength);
            VertexBufferForEach(sparseData, 0, byteStride, numComponents, accessor.componentType, values.length, accessor.normalized || false, (value, index) => {
              values[index] = value;
            });
          }
          let valuesIndex = 0;
          for (let indicesIndex = 0; indicesIndex < indices.length; indicesIndex++) {
            let dataIndex = indices[indicesIndex] * numComponents;
            for (let componentIndex = 0; componentIndex < numComponents; componentIndex++) {
              typedArray[dataIndex++] = values[valuesIndex++];
            }
          }
          return typedArray;
        });
      });
    }
    return accessor._data;
  }
  /**
   * @internal
   */
  _loadFloatAccessorAsync(context, accessor) {
    return this._loadAccessorAsync(context, accessor, Float32Array);
  }
  /**
   * @internal
   */
  _loadIndicesAccessorAsync(context, accessor) {
    if (accessor.type !== "SCALAR") {
      throw new Error(`${context}/type: Invalid value ${accessor.type}`);
    }
    if (accessor.componentType !== 5121 && accessor.componentType !== 5123 && accessor.componentType !== 5125) {
      throw new Error(`${context}/componentType: Invalid value ${accessor.componentType}`);
    }
    if (accessor._data) {
      return accessor._data;
    }
    if (accessor.sparse) {
      const constructor = GLTFLoader2._GetTypedArrayConstructor(`${context}/componentType`, accessor.componentType);
      accessor._data = this._loadAccessorAsync(context, accessor, constructor);
    } else {
      const bufferView = ArrayItem.Get(`${context}/bufferView`, this._gltf.bufferViews, accessor.bufferView);
      accessor._data = this.loadBufferViewAsync(`/bufferViews/${bufferView.index}`, bufferView).then((data) => {
        return GLTFLoader2._GetTypedArray(context, accessor.componentType, data, accessor.byteOffset, accessor.count);
      });
    }
    return accessor._data;
  }
  /**
   * @internal
   */
  _loadVertexBufferViewAsync(bufferView) {
    if (bufferView._babylonBuffer) {
      return bufferView._babylonBuffer;
    }
    const engine = this._babylonScene.getEngine();
    bufferView._babylonBuffer = this.loadBufferViewAsync(`/bufferViews/${bufferView.index}`, bufferView).then((data) => {
      return new Buffer(engine, data, false);
    });
    return bufferView._babylonBuffer;
  }
  /**
   * @internal
   */
  _loadVertexAccessorAsync(context, accessor, kind) {
    if (accessor._babylonVertexBuffer?.[kind]) {
      return accessor._babylonVertexBuffer[kind];
    }
    if (!accessor._babylonVertexBuffer) {
      accessor._babylonVertexBuffer = {};
    }
    const engine = this._babylonScene.getEngine();
    if (accessor.sparse || accessor.bufferView == void 0) {
      accessor._babylonVertexBuffer[kind] = this._loadFloatAccessorAsync(context, accessor).then((data) => {
        return new VertexBuffer(engine, data, kind, false);
      });
    } else {
      const bufferView = ArrayItem.Get(`${context}/bufferView`, this._gltf.bufferViews, accessor.bufferView);
      accessor._babylonVertexBuffer[kind] = this._loadVertexBufferViewAsync(bufferView).then((babylonBuffer) => {
        const numComponents = GLTFLoader2._GetNumComponents(context, accessor.type);
        return new VertexBuffer(engine, babylonBuffer, kind, false, void 0, bufferView.byteStride, void 0, accessor.byteOffset, numComponents, accessor.componentType, accessor.normalized, true, void 0, true);
      });
    }
    return accessor._babylonVertexBuffer[kind];
  }
  _loadMaterialMetallicRoughnessPropertiesAsync(context, properties, babylonMaterial) {
    const promises = new Array();
    const adapter = this._getOrCreateMaterialAdapter(babylonMaterial);
    if (properties) {
      if (properties.baseColorFactor) {
        adapter.baseColor = Color3.FromArray(properties.baseColorFactor);
        adapter.geometryOpacity = properties.baseColorFactor[3];
      } else {
        adapter.baseColor = Color3.White();
      }
      adapter.baseMetalness = properties.metallicFactor == void 0 ? 1 : properties.metallicFactor;
      adapter.specularRoughness = properties.roughnessFactor == void 0 ? 1 : properties.roughnessFactor;
      if (properties.baseColorTexture) {
        promises.push(this.loadTextureInfoAsync(`${context}/baseColorTexture`, properties.baseColorTexture, (texture) => {
          texture.name = `${babylonMaterial.name} (Base Color)`;
          adapter.baseColorTexture = texture;
        }));
      }
      if (properties.metallicRoughnessTexture) {
        properties.metallicRoughnessTexture.nonColorData = true;
        promises.push(this.loadTextureInfoAsync(`${context}/metallicRoughnessTexture`, properties.metallicRoughnessTexture, (texture) => {
          texture.name = `${babylonMaterial.name} (Metallic Roughness)`;
          adapter.baseMetalnessTexture = texture;
          adapter.specularRoughnessTexture = texture;
        }));
        adapter.useRoughnessFromMetallicTextureGreen = true;
        adapter.useMetallicFromMetallicTextureBlue = true;
      }
    }
    return Promise.all(promises).then(() => {
    });
  }
  /**
   * @internal
   */
  _loadMaterialAsync(context, material, babylonMesh, babylonDrawMode, assign = () => {
  }) {
    const extensionPromise = this._extensionsLoadMaterialAsync(context, material, babylonMesh, babylonDrawMode, assign);
    if (extensionPromise) {
      return extensionPromise;
    }
    material._data = material._data || {};
    let babylonData = material._data[babylonDrawMode];
    if (!babylonData) {
      this.logOpen(`${context} ${material.name || ""}`);
      const babylonMaterial = this.createMaterial(context, material, babylonDrawMode);
      babylonData = {
        babylonMaterial,
        babylonMeshes: [],
        promise: this.loadMaterialPropertiesAsync(context, material, babylonMaterial)
      };
      material._data[babylonDrawMode] = babylonData;
      GLTFLoader2.AddPointerMetadata(babylonMaterial, context);
      this._parent.onMaterialLoadedObservable.notifyObservers(babylonMaterial);
      this.logClose();
    }
    if (babylonMesh) {
      babylonData.babylonMeshes.push(babylonMesh);
      babylonMesh.onDisposeObservable.addOnce(() => {
        const index = babylonData.babylonMeshes.indexOf(babylonMesh);
        if (index !== -1) {
          babylonData.babylonMeshes.splice(index, 1);
        }
      });
    }
    assign(babylonData.babylonMaterial);
    return babylonData.promise.then(() => {
      return babylonData.babylonMaterial;
    });
  }
  /**
   * Selects the appropriate PBR material implementation for a given glTF material.
   * Uses OpenPBR when the material carries a "KHR_materials_openpbr" extension or when
   * the loader-level `useOpenPBR` flag is set; falls back to standard PBR otherwise.
   * @param material The glTF material
   * @returns The matching loaded implementation
   */
  _selectImplForGltfMaterial(material) {
    if (this.parent.useOpenPBR || material.extensions?.["KHR_materials_openpbr"]) {
      const impl2 = this._pbrMaterialImpls.get("openpbr");
      if (impl2) {
        return impl2;
      }
    }
    const impl = this._pbrMaterialImpls.get("pbr");
    if (impl) {
      return impl;
    }
    throw new Error("No PBR material implementation loaded");
  }
  /**
   * Returns the default PBR material implementation used when there is no per-material
   * selection context (e.g. when creating the built-in default material for primitives
   * that have no glTF material assigned).  Prefers OpenPBR when `useOpenPBR` is set.
   * @returns The default loaded implementation
   */
  _getDefaultImpl() {
    if (this.parent.useOpenPBR) {
      const impl2 = this._pbrMaterialImpls.get("openpbr");
      if (impl2) {
        return impl2;
      }
    }
    const impl = this._pbrMaterialImpls.get("pbr") ?? this._pbrMaterialImpls.values().next().value;
    if (impl) {
      return impl;
    }
    throw new Error("No PBR material implementation loaded");
  }
  _createDefaultMaterial(name, babylonDrawMode, impl) {
    this._babylonScene._blockEntityCollection = !!this._assetContainer;
    const babylonMaterial = new impl.materialClass(name, this._babylonScene);
    babylonMaterial._parentContainer = this._assetContainer;
    this._babylonScene._blockEntityCollection = false;
    babylonMaterial.fillMode = babylonDrawMode;
    babylonMaterial.transparencyMode = impl.materialClass.MATERIAL_OPAQUE;
    const adapter = this._getOrCreateMaterialAdapter(babylonMaterial);
    adapter.transparencyAsAlphaCoverage = this._parent.transparencyAsCoverage;
    adapter.baseMetalness = 1;
    adapter.specularRoughness = 1;
    return babylonMaterial;
  }
  /**
   * Creates a Babylon material from a glTF material.
   * @param context The context when loading the asset
   * @param material The glTF material property
   * @param babylonDrawMode The draw mode for the Babylon material
   * @returns The Babylon material
   */
  createMaterial(context, material, babylonDrawMode) {
    const extensionMaterial = this._extensionsCreateMaterial(context, material, babylonDrawMode);
    if (extensionMaterial) {
      return extensionMaterial;
    }
    const name = material.name || `material${material.index}`;
    const babylonMaterial = this._createDefaultMaterial(name, babylonDrawMode, this._selectImplForGltfMaterial(material));
    return babylonMaterial;
  }
  /**
   * Loads properties from a glTF material into a Babylon material.
   * @param context The context when loading the asset
   * @param material The glTF material property
   * @param babylonMaterial The Babylon material
   * @returns A promise that resolves when the load is complete
   */
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    const extensionPromise = this._extensionsLoadMaterialPropertiesAsync(context, material, babylonMaterial);
    if (extensionPromise) {
      return extensionPromise;
    }
    const promises = new Array();
    promises.push(this.loadMaterialBasePropertiesAsync(context, material, babylonMaterial));
    if (material.pbrMetallicRoughness) {
      promises.push(this._loadMaterialMetallicRoughnessPropertiesAsync(`${context}/pbrMetallicRoughness`, material.pbrMetallicRoughness, babylonMaterial));
    }
    this.loadMaterialAlphaProperties(context, material, babylonMaterial);
    return Promise.all(promises).then(() => {
    });
  }
  /**
   * Loads the normal, occlusion, and emissive properties from a glTF material into a Babylon material.
   * @param context The context when loading the asset
   * @param material The glTF material property
   * @param babylonMaterial The Babylon material
   * @returns A promise that resolves when the load is complete
   */
  loadMaterialBasePropertiesAsync(context, material, babylonMaterial) {
    const promises = new Array();
    const adapter = this._getOrCreateMaterialAdapter(babylonMaterial);
    adapter.emissionColor = material.emissiveFactor ? Color3.FromArray(material.emissiveFactor) : new Color3(0, 0, 0);
    if (material.doubleSided) {
      adapter.backFaceCulling = false;
      adapter.twoSidedLighting = true;
    }
    if (material.normalTexture) {
      material.normalTexture.nonColorData = true;
      promises.push(this.loadTextureInfoAsync(`${context}/normalTexture`, material.normalTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Normal)`;
        adapter.geometryNormalTexture = texture;
        if (material.normalTexture?.scale != void 0) {
          texture.level = material.normalTexture.scale;
        }
      }));
      adapter.setNormalMapInversions(!this._babylonScene.useRightHandedSystem, this._babylonScene.useRightHandedSystem);
    }
    let aoTexture;
    let aoStrength = 1;
    let emissionTexture;
    if (material.occlusionTexture) {
      material.occlusionTexture.nonColorData = true;
      promises.push(this.loadTextureInfoAsync(`${context}/occlusionTexture`, material.occlusionTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Occlusion)`;
        aoTexture = texture;
      }));
      if (material.occlusionTexture.strength != void 0) {
        aoStrength = material.occlusionTexture.strength;
      }
    }
    if (material.emissiveTexture) {
      promises.push(this.loadTextureInfoAsync(`${context}/emissiveTexture`, material.emissiveTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Emissive)`;
        emissionTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
      if (aoTexture) {
        adapter.ambientOcclusionTexture = aoTexture;
        adapter.ambientOcclusionTextureStrength = aoStrength;
      }
      if (emissionTexture) {
        adapter.emissionColorTexture = emissionTexture;
      }
    });
  }
  /**
   * Loads the alpha properties from a glTF material into a Babylon material.
   * Must be called after the setting the albedo texture of the Babylon material when the material has an albedo texture.
   * @param context The context when loading the asset
   * @param material The glTF material property
   * @param babylonMaterial The Babylon material
   */
  loadMaterialAlphaProperties(context, material, babylonMaterial) {
    if (this._pbrMaterialImpls.size === 0) {
      throw new Error(`${context}: Material type not supported`);
    }
    const adapter = this._getOrCreateMaterialAdapter(babylonMaterial);
    const baseColorTexture = adapter.baseColorTexture;
    const alphaMode = material.alphaMode || "OPAQUE";
    switch (alphaMode) {
      case "OPAQUE": {
        babylonMaterial.transparencyMode = Material.MATERIAL_OPAQUE;
        babylonMaterial.alpha = 1;
        break;
      }
      case "MASK": {
        babylonMaterial.transparencyMode = Material.MATERIAL_ALPHATEST;
        adapter.alphaCutOff = material.alphaCutoff == void 0 ? 0.5 : material.alphaCutoff;
        if (baseColorTexture) {
          baseColorTexture.hasAlpha = true;
          adapter.useAlphaFromBaseColorTexture = true;
        }
        break;
      }
      case "BLEND": {
        babylonMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;
        if (baseColorTexture) {
          baseColorTexture.hasAlpha = true;
          adapter.useAlphaFromBaseColorTexture = true;
        }
        break;
      }
      default: {
        throw new Error(`${context}/alphaMode: Invalid value (${material.alphaMode})`);
      }
    }
  }
  /**
   * Loads a glTF texture info.
   * @param context The context when loading the asset
   * @param textureInfo The glTF texture info property
   * @param assign A function called synchronously after parsing the glTF properties
   * @returns A promise that resolves with the loaded Babylon texture when the load is complete
   */
  loadTextureInfoAsync(context, textureInfo, assign = () => {
  }) {
    const extensionPromise = this._extensionsLoadTextureInfoAsync(context, textureInfo, assign);
    if (extensionPromise) {
      return extensionPromise;
    }
    this.logOpen(`${context}`);
    if (textureInfo.texCoord >= 6) {
      throw new Error(`${context}/texCoord: Invalid value (${textureInfo.texCoord})`);
    }
    const texture = ArrayItem.Get(`${context}/index`, this._gltf.textures, textureInfo.index);
    texture._textureInfo = textureInfo;
    const promise = this._loadTextureAsync(`/textures/${textureInfo.index}`, texture, (babylonTexture) => {
      babylonTexture.coordinatesIndex = textureInfo.texCoord || 0;
      GLTFLoader2.AddPointerMetadata(babylonTexture, context);
      this._parent.onTextureLoadedObservable.notifyObservers(babylonTexture);
      assign(babylonTexture);
    });
    this.logClose();
    return promise;
  }
  /**
   * @internal
   */
  _loadTextureAsync(context, texture, assign = () => {
  }) {
    const extensionPromise = this._extensionsLoadTextureAsync(context, texture, assign);
    if (extensionPromise) {
      return extensionPromise;
    }
    this.logOpen(`${context} ${texture.name || ""}`);
    const sampler = texture.sampler == void 0 ? GLTFLoader2.DefaultSampler : ArrayItem.Get(`${context}/sampler`, this._gltf.samplers, texture.sampler);
    const image = ArrayItem.Get(`${context}/source`, this._gltf.images, texture.source);
    const promise = this._createTextureAsync(context, sampler, image, assign, void 0, !texture._textureInfo.nonColorData);
    this.logClose();
    return promise;
  }
  /**
   * @internal
   */
  _createTextureAsync(context, sampler, image, assign = () => {
  }, textureLoaderOptions, useSRGBBuffer) {
    const samplerData = this._loadSampler(`/samplers/${sampler.index}`, sampler);
    const promises = new Array();
    const deferred = new Deferred();
    this._babylonScene._blockEntityCollection = !!this._assetContainer;
    const textureCreationOptions = {
      noMipmap: samplerData.noMipMaps,
      invertY: false,
      samplingMode: samplerData.samplingMode,
      onLoad: () => {
        if (!this._disposed) {
          deferred.resolve();
        }
      },
      onError: (message, exception) => {
        if (!this._disposed) {
          deferred.reject(new Error(`${context}: ${exception && exception.message ? exception.message : message || "Failed to load texture"}`));
        }
      },
      mimeType: image.mimeType ?? GetMimeType(image.uri ?? ""),
      loaderOptions: textureLoaderOptions,
      useSRGBBuffer: !!useSRGBBuffer && this._parent.useSRGBBuffers
    };
    const babylonTexture = new Texture(null, this._babylonScene, textureCreationOptions);
    babylonTexture._parentContainer = this._assetContainer;
    this._babylonScene._blockEntityCollection = false;
    promises.push(deferred.promise);
    const nonBase64Uri = image.uri && !IsBase64DataUrl(image.uri) ? image.uri : void 0;
    const imageId = nonBase64Uri ?? `${this._fileName}#image${image.index}`;
    promises.push(this.loadImageAsync(`/images/${image.index}`, image).then((data) => {
      const dataUrl = `data:${this._uniqueRootUrl}${imageId}`;
      babylonTexture.updateURL(dataUrl, data);
      const internalTexture = babylonTexture.getInternalTexture();
      if (internalTexture) {
        internalTexture.label = image.name;
      }
    }));
    babylonTexture.wrapU = samplerData.wrapU;
    babylonTexture.wrapV = samplerData.wrapV;
    assign(babylonTexture);
    if (this._parent.useGltfTextureNames) {
      const textureName = image.name || nonBase64Uri || `image${image.index}`;
      babylonTexture.name = textureName;
    }
    return Promise.all(promises).then(() => {
      return babylonTexture;
    });
  }
  _loadSampler(context, sampler) {
    if (!sampler._data) {
      sampler._data = {
        noMipMaps: sampler.minFilter === 9728 || sampler.minFilter === 9729,
        samplingMode: GLTFLoader2._GetTextureSamplingMode(context, sampler),
        wrapU: GLTFLoader2._GetTextureWrapMode(`${context}/wrapS`, sampler.wrapS),
        wrapV: GLTFLoader2._GetTextureWrapMode(`${context}/wrapT`, sampler.wrapT)
      };
    }
    return sampler._data;
  }
  /**
   * Loads a glTF image.
   * @param context The context when loading the asset
   * @param image The glTF image property
   * @returns A promise that resolves with the loaded data when the load is complete
   */
  loadImageAsync(context, image) {
    if (!image._data) {
      this.logOpen(`${context} ${image.name || ""}`);
      if (image.uri) {
        image._data = this.loadUriAsync(`${context}/uri`, image, image.uri);
      } else {
        const bufferView = ArrayItem.Get(`${context}/bufferView`, this._gltf.bufferViews, image.bufferView);
        image._data = this.loadBufferViewAsync(`/bufferViews/${bufferView.index}`, bufferView);
      }
      this.logClose();
    }
    return image._data;
  }
  /**
   * Loads a glTF uri.
   * @param context The context when loading the asset
   * @param property The glTF property associated with the uri
   * @param uri The base64 or relative uri
   * @returns A promise that resolves with the loaded data when the load is complete
   */
  loadUriAsync(context, property, uri) {
    const extensionPromise = this._extensionsLoadUriAsync(context, property, uri);
    if (extensionPromise) {
      return extensionPromise;
    }
    if (!GLTFLoader2._ValidateUri(uri)) {
      throw new Error(`${context}: '${uri}' is invalid`);
    }
    if (IsBase64DataUrl(uri)) {
      const data = new Uint8Array(DecodeBase64UrlToBinary(uri));
      this.log(`${context}: Decoded ${uri.substring(0, 64)}... (${data.length} bytes)`);
      return Promise.resolve(data);
    }
    this.log(`${context}: Loading ${uri}`);
    return this._parent.preprocessUrlAsync(this._rootUrl + uri).then((url) => {
      return new Promise((resolve, reject) => {
        this._parent._loadFile(this._babylonScene, url, (data) => {
          if (!this._disposed) {
            this.log(`${context}: Loaded ${uri} (${data.byteLength} bytes)`);
            resolve(new Uint8Array(data));
          }
        }, true, (request) => {
          reject(new LoadFileError(`${context}: Failed to load '${uri}'${request ? ": " + request.status + " " + request.statusText : ""}`, request));
        });
      });
    });
  }
  /**
   * Adds a JSON pointer to the _internalMetadata of the Babylon object at `<object>._internalMetadata.gltf.pointers`.
   * @param babylonObject the Babylon object with _internalMetadata
   * @param pointer the JSON pointer
   */
  static AddPointerMetadata(babylonObject, pointer) {
    babylonObject.metadata = babylonObject.metadata || {};
    const metadata = babylonObject._internalMetadata = babylonObject._internalMetadata || {};
    const gltf = metadata.gltf = metadata.gltf || {};
    const pointers = gltf.pointers = gltf.pointers || [];
    pointers.push(pointer);
  }
  static _GetTextureWrapMode(context, mode) {
    mode = mode == void 0 ? 10497 : mode;
    switch (mode) {
      case 33071:
        return Texture.CLAMP_ADDRESSMODE;
      case 33648:
        return Texture.MIRROR_ADDRESSMODE;
      case 10497:
        return Texture.WRAP_ADDRESSMODE;
      default:
        Logger.Warn(`${context}: Invalid value (${mode})`);
        return Texture.WRAP_ADDRESSMODE;
    }
  }
  static _GetTextureSamplingMode(context, sampler) {
    const magFilter = sampler.magFilter == void 0 ? 9729 : sampler.magFilter;
    const minFilter = sampler.minFilter == void 0 ? 9987 : sampler.minFilter;
    if (magFilter === 9729) {
      switch (minFilter) {
        case 9728:
          return Texture.LINEAR_NEAREST;
        case 9729:
          return Texture.LINEAR_LINEAR;
        case 9984:
          return Texture.LINEAR_NEAREST_MIPNEAREST;
        case 9985:
          return Texture.LINEAR_LINEAR_MIPNEAREST;
        case 9986:
          return Texture.LINEAR_NEAREST_MIPLINEAR;
        case 9987:
          return Texture.LINEAR_LINEAR_MIPLINEAR;
        default:
          Logger.Warn(`${context}/minFilter: Invalid value (${minFilter})`);
          return Texture.LINEAR_LINEAR_MIPLINEAR;
      }
    } else {
      if (magFilter !== 9728) {
        Logger.Warn(`${context}/magFilter: Invalid value (${magFilter})`);
      }
      switch (minFilter) {
        case 9728:
          return Texture.NEAREST_NEAREST;
        case 9729:
          return Texture.NEAREST_LINEAR;
        case 9984:
          return Texture.NEAREST_NEAREST_MIPNEAREST;
        case 9985:
          return Texture.NEAREST_LINEAR_MIPNEAREST;
        case 9986:
          return Texture.NEAREST_NEAREST_MIPLINEAR;
        case 9987:
          return Texture.NEAREST_LINEAR_MIPLINEAR;
        default:
          Logger.Warn(`${context}/minFilter: Invalid value (${minFilter})`);
          return Texture.NEAREST_NEAREST_MIPNEAREST;
      }
    }
  }
  static _GetTypedArrayConstructor(context, componentType) {
    try {
      return GetTypedArrayConstructor(componentType);
    } catch (e) {
      throw new Error(`${context}: ${e.message}`, { cause: e });
    }
  }
  static _GetTypedArray(context, componentType, bufferView, byteOffset, length) {
    const buffer = bufferView.buffer;
    byteOffset = bufferView.byteOffset + (byteOffset || 0);
    const constructor = GLTFLoader2._GetTypedArrayConstructor(`${context}/componentType`, componentType);
    const componentTypeLength = VertexBufferGetTypeByteLength(componentType);
    if (byteOffset % componentTypeLength !== 0) {
      Logger.Warn(`${context}: Copying buffer as byte offset (${byteOffset}) is not a multiple of component type byte length (${componentTypeLength})`);
      return new constructor(buffer.slice(byteOffset, byteOffset + length * componentTypeLength), 0);
    }
    return new constructor(buffer, byteOffset, length);
  }
  static _GetNumComponents(context, type) {
    switch (type) {
      case "SCALAR":
        return 1;
      case "VEC2":
        return 2;
      case "VEC3":
        return 3;
      case "VEC4":
        return 4;
      case "MAT2":
        return 4;
      case "MAT3":
        return 9;
      case "MAT4":
        return 16;
    }
    throw new Error(`${context}: Invalid type (${type})`);
  }
  static _ValidateUri(uri) {
    return Tools.IsBase64(uri) || uri.indexOf("..") === -1;
  }
  /**
   * @internal
   */
  static _GetDrawMode(context, mode) {
    if (mode == void 0) {
      mode = 4;
    }
    switch (mode) {
      case 0:
        return Material.PointListDrawMode;
      case 1:
        return Material.LineListDrawMode;
      case 2:
        return Material.LineLoopDrawMode;
      case 3:
        return Material.LineStripDrawMode;
      case 4:
        return Material.TriangleFillMode;
      case 5:
        return Material.TriangleStripDrawMode;
      case 6:
        return Material.TriangleFanDrawMode;
    }
    throw new Error(`${context}: Invalid mesh primitive mode (${mode})`);
  }
  _compileMaterialsAsync() {
    this._parent._startPerformanceCounter("Compile materials");
    const promises = new Array();
    if (this._gltf.materials) {
      for (const material of this._gltf.materials) {
        if (material._data) {
          for (const babylonDrawMode in material._data) {
            const babylonData = material._data[babylonDrawMode];
            for (const babylonMesh of babylonData.babylonMeshes) {
              babylonMesh.computeWorldMatrix(true);
              const babylonMaterial = babylonData.babylonMaterial;
              promises.push(babylonMaterial.forceCompilationAsync(babylonMesh));
              promises.push(babylonMaterial.forceCompilationAsync(babylonMesh, { useInstances: true }));
              if (this._parent.useClipPlane) {
                promises.push(babylonMaterial.forceCompilationAsync(babylonMesh, { clipPlane: true }));
                promises.push(babylonMaterial.forceCompilationAsync(babylonMesh, { clipPlane: true, useInstances: true }));
              }
            }
          }
        }
      }
    }
    return Promise.all(promises).then(() => {
      this._parent._endPerformanceCounter("Compile materials");
    });
  }
  _compileShadowGeneratorsAsync() {
    this._parent._startPerformanceCounter("Compile shadow generators");
    const promises = new Array();
    const lights = this._babylonScene.lights;
    for (const light of lights) {
      const generator = light.getShadowGenerator();
      if (generator) {
        promises.push(generator.forceCompilationAsync());
      }
    }
    return Promise.all(promises).then(() => {
      this._parent._endPerformanceCounter("Compile shadow generators");
    });
  }
  _forEachExtensions(action) {
    for (const extension of this._extensions) {
      if (extension.enabled) {
        action(extension);
      }
    }
  }
  _applyExtensions(property, functionName, actionAsync) {
    for (const extension of this._extensions) {
      if (extension.enabled) {
        const id = `${extension.name}.${functionName}`;
        const loaderProperty = property;
        loaderProperty._activeLoaderExtensionFunctions = loaderProperty._activeLoaderExtensionFunctions || {};
        const activeLoaderExtensionFunctions = loaderProperty._activeLoaderExtensionFunctions;
        if (!activeLoaderExtensionFunctions[id]) {
          activeLoaderExtensionFunctions[id] = true;
          try {
            const result = actionAsync(extension);
            if (result) {
              return result;
            }
          } finally {
            delete activeLoaderExtensionFunctions[id];
          }
        }
      }
    }
    return null;
  }
  _extensionsOnLoading() {
    this._forEachExtensions((extension) => extension.onLoading && extension.onLoading());
  }
  _extensionsOnReady() {
    this._forEachExtensions((extension) => extension.onReady && extension.onReady());
  }
  _extensionsLoadSceneAsync(context, scene) {
    return this._applyExtensions(scene, "loadScene", (extension) => extension.loadSceneAsync && extension.loadSceneAsync(context, scene));
  }
  _extensionsLoadNodeAsync(context, node, assign) {
    return this._applyExtensions(node, "loadNode", (extension) => extension.loadNodeAsync && extension.loadNodeAsync(context, node, assign));
  }
  _extensionsLoadCameraAsync(context, camera, assign) {
    return this._applyExtensions(camera, "loadCamera", (extension) => extension.loadCameraAsync && extension.loadCameraAsync(context, camera, assign));
  }
  _extensionsLoadVertexDataAsync(context, primitive, babylonMesh) {
    return this._applyExtensions(primitive, "loadVertexData", (extension) => extension._loadVertexDataAsync && extension._loadVertexDataAsync(context, primitive, babylonMesh));
  }
  _extensionsLoadMeshPrimitiveAsync(context, name, node, mesh, primitive, assign) {
    return this._applyExtensions(primitive, "loadMeshPrimitive", (extension) => extension._loadMeshPrimitiveAsync && extension._loadMeshPrimitiveAsync(context, name, node, mesh, primitive, assign));
  }
  _extensionsLoadMaterialAsync(context, material, babylonMesh, babylonDrawMode, assign) {
    return this._applyExtensions(material, "loadMaterial", (extension) => extension._loadMaterialAsync && extension._loadMaterialAsync(context, material, babylonMesh, babylonDrawMode, assign));
  }
  _extensionsCreateMaterial(context, material, babylonDrawMode) {
    return this._applyExtensions(material, "createMaterial", (extension) => extension.createMaterial && extension.createMaterial(context, material, babylonDrawMode));
  }
  _extensionsLoadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return this._applyExtensions(material, "loadMaterialProperties", (extension) => extension.loadMaterialPropertiesAsync && extension.loadMaterialPropertiesAsync(context, material, babylonMaterial));
  }
  _extensionsLoadTextureInfoAsync(context, textureInfo, assign) {
    return this._applyExtensions(textureInfo, "loadTextureInfo", (extension) => extension.loadTextureInfoAsync && extension.loadTextureInfoAsync(context, textureInfo, assign));
  }
  _extensionsLoadTextureAsync(context, texture, assign) {
    return this._applyExtensions(texture, "loadTexture", (extension) => extension._loadTextureAsync && extension._loadTextureAsync(context, texture, assign));
  }
  _extensionsLoadAnimationAsync(context, animation) {
    return this._applyExtensions(animation, "loadAnimation", (extension) => extension.loadAnimationAsync && extension.loadAnimationAsync(context, animation));
  }
  _extensionsLoadAnimationChannelAsync(context, animationContext, animation, channel, onLoad) {
    return this._applyExtensions(animation, "loadAnimationChannel", (extension) => extension._loadAnimationChannelAsync && extension._loadAnimationChannelAsync(context, animationContext, animation, channel, onLoad));
  }
  _extensionsLoadSkinAsync(context, node, skin) {
    return this._applyExtensions(skin, "loadSkin", (extension) => extension._loadSkinAsync && extension._loadSkinAsync(context, node, skin));
  }
  _extensionsLoadUriAsync(context, property, uri) {
    return this._applyExtensions(property, "loadUri", (extension) => extension._loadUriAsync && extension._loadUriAsync(context, property, uri));
  }
  _extensionsLoadBufferViewAsync(context, bufferView) {
    return this._applyExtensions(bufferView, "loadBufferView", (extension) => extension.loadBufferViewAsync && extension.loadBufferViewAsync(context, bufferView));
  }
  _extensionsLoadBufferAsync(context, buffer, byteOffset, byteLength) {
    return this._applyExtensions(buffer, "loadBuffer", (extension) => extension.loadBufferAsync && extension.loadBufferAsync(context, buffer, byteOffset, byteLength));
  }
  /**
   * Helper method called by a loader extension to load an glTF extension.
   * @param context The context when loading the asset
   * @param property The glTF property to load the extension from
   * @param extensionName The name of the extension to load
   * @param actionAsync The action to run
   * @returns The promise returned by actionAsync or null if the extension does not exist
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static LoadExtensionAsync(context, property, extensionName, actionAsync) {
    if (!property.extensions) {
      return null;
    }
    const extensions = property.extensions;
    const extension = extensions[extensionName];
    if (!extension) {
      return null;
    }
    return actionAsync(`${context}/extensions/${extensionName}`, extension);
  }
  /**
   * Helper method called by a loader extension to load a glTF extra.
   * @param context The context when loading the asset
   * @param property The glTF property to load the extra from
   * @param extensionName The name of the extension to load
   * @param actionAsync The action to run
   * @returns The promise returned by actionAsync or null if the extra does not exist
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  static LoadExtraAsync(context, property, extensionName, actionAsync) {
    if (!property.extras) {
      return null;
    }
    const extras = property.extras;
    const extra = extras[extensionName];
    if (!extra) {
      return null;
    }
    return actionAsync(`${context}/extras/${extensionName}`, extra);
  }
  /**
   * Checks for presence of an extension.
   * @param name The name of the extension to check
   * @returns A boolean indicating the presence of the given extension name in `extensionsUsed`
   */
  isExtensionUsed(name) {
    return !!this._gltf.extensionsUsed && this._gltf.extensionsUsed.indexOf(name) !== -1;
  }
  /**
   * Increments the indentation level and logs a message.
   * @param message The message to log
   */
  logOpen(message) {
    this._parent._logOpen(message);
  }
  /**
   * Decrements the indentation level.
   */
  logClose() {
    this._parent._logClose();
  }
  /**
   * Logs a message
   * @param message The message to log
   */
  log(message) {
    this._parent._log(message);
  }
  /**
   * Starts a performance counter.
   * @param counterName The name of the performance counter
   */
  startPerformanceCounter(counterName) {
    this._parent._startPerformanceCounter(counterName);
  }
  /**
   * Ends a performance counter.
   * @param counterName The name of the performance counter
   */
  endPerformanceCounter(counterName) {
    this._parent._endPerformanceCounter(counterName);
  }
}
GLTFLoader2.DefaultSampler = { index: -1 };
let _Registered$G = false;
function RegisterGLTF2Loader() {
  if (_Registered$G) {
    return;
  }
  _Registered$G = true;
  GLTFFileLoader._CreateGLTF2Loader = (parent) => new GLTFLoader2(parent);
}
RegisterGLTF2Loader();
RegisterGLTFFileLoader();
function getVector3(_target, source, offset, scale) {
  return Vector3.FromArray(source, offset).scaleInPlace(scale);
}
function getQuaternion(_target, source, offset, scale) {
  return Quaternion.FromArray(source, offset).scaleInPlace(scale);
}
function getWeights(target, source, offset, scale) {
  const value = new Array(target._numMorphTargets);
  for (let i = 0; i < value.length; i++) {
    value[i] = source[offset++] * scale;
  }
  return value;
}
class AnimationPropertyInfo {
  /** @internal */
  constructor(type, name, getValue, getStride) {
    this.type = type;
    this.name = name;
    this.getValue = getValue;
    this.getStride = getStride;
  }
  _buildAnimation(name, fps, keys) {
    const babylonAnimation = new Animation(name, this.name, fps, this.type);
    babylonAnimation.setKeys(keys, true);
    return babylonAnimation;
  }
}
class TransformNodeAnimationPropertyInfo extends AnimationPropertyInfo {
  /** @internal */
  buildAnimations(target, name, fps, keys) {
    const babylonAnimations = [];
    babylonAnimations.push({ babylonAnimatable: target._babylonTransformNode, babylonAnimation: this._buildAnimation(name, fps, keys) });
    return babylonAnimations;
  }
}
class WeightAnimationPropertyInfo extends AnimationPropertyInfo {
  buildAnimations(target, name, fps, keys) {
    const babylonAnimations = [];
    if (target._numMorphTargets) {
      for (let targetIndex = 0; targetIndex < target._numMorphTargets; targetIndex++) {
        const babylonAnimation = new Animation(`${name}_${targetIndex}`, this.name, fps, this.type);
        babylonAnimation.setKeys(keys.map((key) => ({
          frame: key.frame,
          inTangent: key.inTangent ? key.inTangent[targetIndex] : void 0,
          value: key.value[targetIndex],
          outTangent: key.outTangent ? key.outTangent[targetIndex] : void 0,
          interpolation: key.interpolation
        })), true);
        if (target._primitiveBabylonMeshes) {
          for (const babylonMesh of target._primitiveBabylonMeshes) {
            if (babylonMesh.morphTargetManager) {
              const morphTarget = babylonMesh.morphTargetManager.getTarget(targetIndex);
              const babylonAnimationClone = babylonAnimation.clone();
              morphTarget.animations.push(babylonAnimationClone);
              babylonAnimations.push({ babylonAnimatable: morphTarget, babylonAnimation: babylonAnimationClone });
            }
          }
        }
      }
    }
    return babylonAnimations;
  }
}
SetInterpolationForKey("/nodes/{}/translation", [new TransformNodeAnimationPropertyInfo(Animation.ANIMATIONTYPE_VECTOR3, "position", getVector3, () => 3)]);
SetInterpolationForKey("/nodes/{}/rotation", [new TransformNodeAnimationPropertyInfo(Animation.ANIMATIONTYPE_QUATERNION, "rotationQuaternion", getQuaternion, () => 4)]);
SetInterpolationForKey("/nodes/{}/scale", [new TransformNodeAnimationPropertyInfo(Animation.ANIMATIONTYPE_VECTOR3, "scaling", getVector3, () => 3)]);
SetInterpolationForKey("/nodes/{}/weights", [new WeightAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "influence", getWeights, (target) => target._numMorphTargets)]);
const glTFLoaderAnimation = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AnimationPropertyInfo,
  TransformNodeAnimationPropertyInfo,
  WeightAnimationPropertyInfo,
  getQuaternion,
  getVector3,
  getWeights
}, Symbol.toStringTag, { value: "Module" }));
class OpenPBRMaterialLoadingAdapter {
  /**
   * Creates a new instance of the OpenPBRMaterialLoadingAdapter.
   * @param material - The OpenPBR material to adapt.
   */
  constructor(material) {
    this._specWorkflow = false;
    this._diffuseTransmissionTint = Color3.White();
    this._diffuseTransmissionTintTexture = null;
    this._material = material;
  }
  /**
   * Gets the underlying material
   */
  get material() {
    return this._material;
  }
  /**
   * Whether the material should be treated as unlit
   */
  get isUnlit() {
    return this._material.unlit;
  }
  /**
   * Sets whether the material should be treated as unlit
   */
  set isUnlit(value) {
    this._material.unlit = value;
  }
  // ========================================
  // CULLING PROPERTIES
  // ========================================
  /**
   * Sets whether back face culling is enabled.
   * @param value True to enable back face culling
   */
  set backFaceCulling(value) {
    this._material.backFaceCulling = value;
  }
  /**
   * Gets whether back face culling is enabled.
   * @returns True if back face culling is enabled
   */
  get backFaceCulling() {
    return this._material.backFaceCulling;
  }
  /**
   * Sets whether two-sided lighting is enabled.
   * @param value True to enable two-sided lighting
   */
  set twoSidedLighting(value) {
    this._material.twoSidedLighting = value;
  }
  /**
   * Gets whether two-sided lighting is enabled.
   * @returns True if two-sided lighting is enabled
   */
  get twoSidedLighting() {
    return this._material.twoSidedLighting;
  }
  // ========================================
  // ALPHA PROPERTIES
  // ========================================
  /**
   * Sets the alpha cutoff value for alpha testing.
   * Note: OpenPBR doesn't have a direct equivalent, so this is a no-op.
   * @param value The alpha cutoff threshold (ignored for OpenPBR)
   */
  set alphaCutOff(value) {
    this._material.alphaCutOff = value;
  }
  /**
   * Gets the alpha cutoff value.
   * @returns Default value of 0.5 (OpenPBR doesn't support this directly)
   */
  get alphaCutOff() {
    return this._material.alphaCutOff;
  }
  /**
   * Sets whether to use alpha from the base color texture.
   * Note: OpenPBR handles this differently through the baseColorTexture alpha channel.
   * @param value True to use alpha from base color texture (handled automatically in OpenPBR)
   */
  set useAlphaFromBaseColorTexture(value) {
    this._material._useAlphaFromBaseColorTexture = value;
  }
  /**
   * Gets whether alpha is used from the base color texture.
   * @returns True if alpha is used from the base color texture
   */
  get useAlphaFromBaseColorTexture() {
    return this._material._useAlphaFromBaseColorTexture;
  }
  /**
   * Gets whether the transparency is treated as alpha coverage.
   */
  get transparencyAsAlphaCoverage() {
    return false;
  }
  /**
   * Sets/Gets whether the transparency is treated as alpha coverage
   */
  set transparencyAsAlphaCoverage(value) {
  }
  // ========================================
  // BASE PARAMETERS
  // ========================================
  /**
   * Sets the base color of the OpenPBR material.
   * @param value The base color as a Color3
   */
  set baseColor(value) {
    this._material.baseColor = value;
  }
  /**
   * Gets the base color of the OpenPBR material.
   * @returns The base color as a Color3
   */
  get baseColor() {
    return this._material.baseColor;
  }
  /**
   * Sets the base color texture of the OpenPBR material.
   * @param value The base color texture or null
   */
  set baseColorTexture(value) {
    this._material.baseColorTexture = value;
  }
  /**
   * Gets the base color texture of the OpenPBR material.
   * @returns The base color texture or null
   */
  get baseColorTexture() {
    return this._material.baseColorTexture;
  }
  /**
   * Sets the base diffuse roughness of the OpenPBR material.
   * @param value The diffuse roughness value (0-1)
   */
  set baseDiffuseRoughness(value) {
    this._material.baseDiffuseRoughness = value;
  }
  /**
   * Gets the base diffuse roughness of the OpenPBR material.
   * @returns The diffuse roughness value (0-1)
   */
  get baseDiffuseRoughness() {
    return this._material.baseDiffuseRoughness;
  }
  /**
   * Sets the base diffuse roughness texture of the OpenPBR material.
   * @param value The diffuse roughness texture or null
   */
  set baseDiffuseRoughnessTexture(value) {
    this._material.baseDiffuseRoughnessTexture = value;
  }
  /**
   * Gets the base diffuse roughness texture of the OpenPBR material.
   * @returns The diffuse roughness texture or null
   */
  get baseDiffuseRoughnessTexture() {
    return this._material.baseDiffuseRoughnessTexture;
  }
  /**
   * Sets the base metalness value of the OpenPBR material.
   * @param value The metalness value (0-1)
   */
  set baseMetalness(value) {
    this._material.baseMetalness = value;
  }
  /**
   * Gets the base metalness value of the OpenPBR material.
   * @returns The metalness value (0-1)
   */
  get baseMetalness() {
    return this._material.baseMetalness;
  }
  /**
   * Sets the base metalness texture of the OpenPBR material.
   * @param value The metalness texture or null
   */
  set baseMetalnessTexture(value) {
    this._material.baseMetalnessTexture = value;
  }
  /**
   * Gets the base metalness texture of the OpenPBR material.
   * @returns The metalness texture or null
   */
  get baseMetalnessTexture() {
    return this._material.baseMetalnessTexture;
  }
  /**
   * Sets whether to use roughness from the metallic texture's green channel.
   * @param value True to use green channel for roughness
   */
  set useRoughnessFromMetallicTextureGreen(value) {
    this._material._useRoughnessFromMetallicTextureGreen = value;
  }
  /**
   * Sets whether to use metalness from the metallic texture's blue channel.
   * @param value True to use blue channel for metalness
   */
  set useMetallicFromMetallicTextureBlue(value) {
    this._material._useMetallicFromMetallicTextureBlue = value;
  }
  // ========================================
  // SPECULAR PARAMETERS
  // ========================================
  /**
   * Configures specular properties for OpenPBR material.
   * @param _enableEdgeColor Whether to enable edge color support (ignored for OpenPBR)
   */
  enableSpecularEdgeColor(_enableEdgeColor = false) {
  }
  configureSpecularGlossiness() {
    this._specWorkflow = true;
  }
  /**
   * Sets the specular weight of the OpenPBR material.
   * @param value The specular weight value (0-1)
   */
  set specularWeight(value) {
    this._material.specularWeight = value;
  }
  /**
   * Gets the specular weight of the OpenPBR material.
   * @returns The specular weight value (0-1)
   */
  get specularWeight() {
    return this._material.specularWeight;
  }
  /**
   * Sets the specular weight texture of the OpenPBR material.
   * If the same texture is used for specular color, optimizes by using alpha channel for weight.
   * @param value The specular weight texture or null
   */
  set specularWeightTexture(value) {
    if (this._material.specularColorTexture === value) {
      this._material.specularWeightTexture = null;
      this._material._useSpecularWeightFromSpecularColorTexture = true;
      this._material._useSpecularWeightFromAlpha = true;
    } else {
      this._material.specularWeightTexture = value;
    }
  }
  /**
   * Gets the specular weight texture of the OpenPBR material.
   * @returns The specular weight texture or null
   */
  get specularWeightTexture() {
    return this._material.specularWeightTexture;
  }
  /**
   * Sets the specular color of the OpenPBR material.
   * @param value The specular color as a Color3
   */
  set specularColor(value) {
    this._material.specularColor = value;
  }
  /**
   * Gets the specular color of the OpenPBR material.
   * @returns The specular color as a Color3
   */
  get specularColor() {
    return this._material.specularColor;
  }
  /**
   * Sets the specular color texture of the OpenPBR material.
   * If the same texture is used for specular weight, optimizes by using alpha channel for weight.
   * @param value The specular color texture or null
   */
  set specularColorTexture(value) {
    this._material.specularColorTexture = value;
    if (this._material.specularWeightTexture === this._material.specularColorTexture) {
      this._material.specularWeightTexture = null;
      this._material._useSpecularWeightFromSpecularColorTexture = true;
      this._material._useSpecularWeightFromAlpha = true;
    }
  }
  /**
   * Gets the specular color texture of the OpenPBR material.
   * @returns The specular color texture or null
   */
  get specularColorTexture() {
    return this._material.specularColorTexture;
  }
  /**
   * Sets the specular roughness of the OpenPBR material.
   * @param value The roughness value (0-1)
   */
  set specularRoughness(value) {
    this._material.specularRoughness = value;
  }
  /**
   * Gets the specular roughness of the OpenPBR material.
   * @returns The roughness value (0-1)
   */
  get specularRoughness() {
    return this._material.specularRoughness;
  }
  /**
   * Sets the specular roughness texture of the OpenPBR material.
   * @param value The roughness texture or null
   */
  set specularRoughnessTexture(value) {
    this._material.specularRoughnessTexture = value;
  }
  /**
   * Gets the specular roughness texture of the OpenPBR material.
   * @returns The roughness texture or null
   */
  get specularRoughnessTexture() {
    return this._material.specularRoughnessTexture;
  }
  /**
   * Sets the specular index of refraction (IOR) of the OpenPBR material.
   * @param value The IOR value
   */
  set specularIor(value) {
    this._material.specularIor = value;
  }
  /**
   * Gets the specular index of refraction (IOR) of the OpenPBR material.
   * @returns The IOR value
   */
  get specularIor() {
    return this._material.specularIor;
  }
  /**
   * Sets the glossiness (inverted roughness) of the OpenPBR material.
   */
  set glossiness(value) {
    this._material.specularRoughness = Math.max(1 - value, 0);
  }
  get glossiness() {
    return 1 - this._material.specularRoughness;
  }
  // ========================================
  // EMISSION PARAMETERS
  // ========================================
  /**
   * Sets the emission color of the OpenPBR material.
   * @param value The emission color as a Color3
   */
  set emissionColor(value) {
    this._material.emissionColor = value;
  }
  /**
   * Gets the emission color of the OpenPBR material.
   * @returns The emission color as a Color3
   */
  get emissionColor() {
    return this._material.emissionColor;
  }
  /**
   * Sets the emission luminance of the OpenPBR material.
   * @param value The emission luminance value
   */
  set emissionLuminance(value) {
    this._material.emissionLuminance = value;
  }
  /**
   * Gets the emission luminance of the OpenPBR material.
   * @returns The emission luminance value
   */
  get emissionLuminance() {
    return this._material.emissionLuminance;
  }
  /**
   * Sets the emission color texture of the OpenPBR material.
   * @param value The emission texture or null
   */
  set emissionColorTexture(value) {
    this._material.emissionColorTexture = value;
  }
  /**
   * Gets the emission color texture of the OpenPBR material.
   * @returns The emission texture or null
   */
  get emissionColorTexture() {
    return this._material.emissionColorTexture;
  }
  // ========================================
  // AMBIENT OCCLUSION
  // ========================================
  /**
   * Sets the ambient occlusion texture of the OpenPBR material.
   * @param value The ambient occlusion texture or null
   */
  set ambientOcclusionTexture(value) {
    this._material.ambientOcclusionTexture = value;
  }
  /**
   * Gets the ambient occlusion texture of the OpenPBR material.
   * @returns The ambient occlusion texture or null
   */
  get ambientOcclusionTexture() {
    return this._material.ambientOcclusionTexture;
  }
  /**
   * Sets the ambient occlusion texture strength by modifying the texture's level.
   * @param value The strength value (typically 0-1)
   */
  set ambientOcclusionTextureStrength(value) {
    const texture = this._material.ambientOcclusionTexture;
    if (texture) {
      texture.level = value;
    }
  }
  /**
   * Gets the ambient occlusion texture strength from the texture's level property.
   * @returns The strength value, defaults to 1.0 if no texture or level is set
   */
  get ambientOcclusionTextureStrength() {
    const texture = this._material.ambientOcclusionTexture;
    return texture?.level ?? 1;
  }
  // ========================================
  // COAT PARAMETERS
  // ========================================
  /**
   * Configures coat parameters for OpenPBR material.
   * OpenPBR coat is already built-in, so no configuration is needed.
   */
  configureCoat() {
  }
  /**
   * Sets the coat weight of the OpenPBR material.
   * @param value The coat weight value (0-1)
   */
  set coatWeight(value) {
    this._material.coatWeight = value;
  }
  /**
   * Gets the coat weight of the OpenPBR material.
   * @returns The coat weight value (0-1)
   */
  get coatWeight() {
    return this._material.coatWeight;
  }
  /**
   * Sets the coat weight texture of the OpenPBR material.
   * @param value The coat weight texture or null
   */
  set coatWeightTexture(value) {
    this._material.coatWeightTexture = value;
  }
  /**
   * Gets the coat weight texture of the OpenPBR material.
   * @returns The coat weight texture or null
   */
  get coatWeightTexture() {
    return this._material.coatWeightTexture;
  }
  /**
   * Sets the coat color of the OpenPBR material.
   * @param value The coat color as a Color3
   */
  set coatColor(value) {
    this._material.coatColor = value;
  }
  /**
   * Gets the coat color of the OpenPBR material.
   */
  get coatColor() {
    return this._material.coatColor;
  }
  /**
   * Sets the coat color texture of the OpenPBR material.
   * @param value The coat color texture or null
   */
  set coatColorTexture(value) {
    this._material.coatColorTexture = value;
  }
  /**
   * Sets the coat roughness of the OpenPBR material.
   * @param value The coat roughness value (0-1)
   */
  set coatRoughness(value) {
    this._material.coatRoughness = value;
  }
  /**
   * Gets the coat roughness of the OpenPBR material.
   * @returns The coat roughness value (0-1)
   */
  get coatRoughness() {
    return this._material.coatRoughness;
  }
  /**
   * Sets the coat roughness texture of the OpenPBR material.
   * @param value The coat roughness texture or null
   */
  set coatRoughnessTexture(value) {
    this._material.coatRoughnessTexture = value;
    if (value) {
      this._material._useCoatRoughnessFromGreenChannel = true;
    }
  }
  /**
   * Gets the coat roughness texture of the OpenPBR material.
   * @returns The coat roughness texture or null
   */
  get coatRoughnessTexture() {
    return this._material.coatRoughnessTexture;
  }
  /**
   * Sets the coat index of refraction (IOR) of the OpenPBR material.
   */
  set coatIor(value) {
    this._material.coatIor = value;
  }
  get coatIor() {
    return this._material.coatIor;
  }
  /**
   * Sets the coat darkening value of the OpenPBR material.
   * @param value The coat darkening value
   */
  set coatDarkening(value) {
    this._material.coatDarkening = value;
  }
  get coatDarkening() {
    return this._material.coatDarkening;
  }
  /**
   * Sets the coat darkening texture (OpenPBR: coatDarkeningTexture, no PBR equivalent)
   */
  set coatDarkeningTexture(value) {
    this._material.coatDarkeningTexture = value;
  }
  /**
   * Sets the coat roughness anisotropy.
   * TODO: Implementation pending OpenPBR coat anisotropy feature availability.
   * @param value The coat anisotropy intensity value
   */
  set coatRoughnessAnisotropy(value) {
    this._material.coatRoughnessAnisotropy = value;
  }
  /**
   * Gets the coat roughness anisotropy.
   * TODO: Implementation pending OpenPBR coat anisotropy feature availability.
   * @returns Currently returns 0 as coat anisotropy is not yet available
   */
  get coatRoughnessAnisotropy() {
    return this._material.coatRoughnessAnisotropy;
  }
  /**
   * Sets the coat tangent angle for anisotropy.
   * TODO: Implementation pending OpenPBR coat anisotropy feature availability.
   * @param value The coat anisotropy rotation angle in radians
   */
  set geometryCoatTangentAngle(value) {
    this._material.geometryCoatTangentAngle = value;
  }
  /**
   * Sets the coat tangent texture for anisotropy.
   * TODO: Implementation pending OpenPBR coat anisotropy feature availability.
   * @param value The coat anisotropy texture or null
   */
  set geometryCoatTangentTexture(value) {
    this._material.geometryCoatTangentTexture = value;
    if (value) {
      this._material._useCoatRoughnessAnisotropyFromTangentTexture = true;
    }
  }
  /**
   * Gets the coat tangent texture for anisotropy.
   * TODO: Implementation pending OpenPBR coat anisotropy feature availability.
   * @returns Currently returns null as coat anisotropy is not yet available
   */
  get geometryCoatTangentTexture() {
    return this._material.geometryCoatTangentTexture;
  }
  // ========================================
  // TRANSMISSION LAYER
  // ========================================
  /**
   * Configures transmission for OpenPBR material.
   */
  configureTransmission() {
    this._material.geometryThinWalled = 1;
    this._material.transmissionDepth = 0;
  }
  /**
   * Sets the transmission weight.
   * @param value The transmission weight value (0-1)
   */
  set transmissionWeight(value) {
    this._material.transmissionWeight = value;
  }
  /**
   * Sets the transmission weight texture.
   * @param value The transmission weight texture or null
   */
  set transmissionWeightTexture(value) {
    this._material.transmissionWeightTexture = value;
  }
  get transmissionWeightTexture() {
    return this._material.transmissionWeightTexture;
  }
  /**
   * Gets the transmission weight.
   * @returns Currently returns 0 as transmission is not yet available
   */
  get transmissionWeight() {
    return this._material.transmissionWeight;
  }
  /**
   * Sets the transmission scatter coefficient.
   * @param value The scatter coefficient as a Vector3
   */
  set transmissionScatter(value) {
    this._material.transmissionScatter = value;
  }
  /**
   * Gets the transmission scatter coefficient.
   * @returns The scatter coefficient as a Vector3
   */
  get transmissionScatter() {
    return this._material.transmissionScatter;
  }
  /**
   * Sets the transmission scatter texture.
   * @param value The transmission scatter texture or null
   */
  set transmissionScatterTexture(value) {
    this._material.transmissionScatterTexture = value;
  }
  /**
   * Gets the transmission scatter texture.
   * @returns The transmission scatter texture or null
   */
  get transmissionScatterTexture() {
    return this._material.transmissionScatterTexture;
  }
  /**
   * Sets the transmission scattering anisotropy.
   * @param value The anisotropy intensity value (-1 to 1)
   */
  set transmissionScatterAnisotropy(value) {
    this._material.transmissionScatterAnisotropy = value;
  }
  /**
   * Sets the transmission dispersion Abbe number.
   * @param value The Abbe number value
   */
  set transmissionDispersionAbbeNumber(value) {
    this._material.transmissionDispersionAbbeNumber = value;
  }
  /**
   * Sets the transmission dispersion scale.
   * @param value The dispersion scale value
   */
  set transmissionDispersionScale(value) {
    this._material.transmissionDispersionScale = value;
  }
  /**
   * Sets the attenuation distance.
   * @param value The attenuation distance value
   */
  set transmissionDepth(value) {
    if (value !== Number.MAX_VALUE || this._material.transmissionDepth !== 0) {
      this._material.transmissionDepth = value;
    } else {
      this._material.transmissionDepth = 0;
    }
  }
  /**
   * Gets the attenuation distance.
   */
  get transmissionDepth() {
    return this._material.transmissionDepth;
  }
  /**
   * Sets the attenuation color.
   * @param value The attenuation color as a Color3
   */
  set transmissionColor(value) {
    if (!value.equals(Color3.White())) {
      this._material.transmissionColor = value;
    }
  }
  /**
   * Gets the attenuation color.
   */
  get transmissionColor() {
    return this._material.transmissionColor;
  }
  /**
   * Gets the refraction background texture
   * @returns The refraction background texture or null
   */
  get refractionBackgroundTexture() {
    return this._material.backgroundRefractionTexture;
  }
  /**
   * Sets the refraction background texture
   * @param value The refraction background texture or null
   */
  set refractionBackgroundTexture(value) {
    this._material.backgroundRefractionTexture = value;
  }
  // ========================================
  // VOLUME PROPERTIES
  // ========================================
  /**
   * Configures volume properties for OpenPBR material.
   */
  configureVolume() {
    this._material.geometryThinWalled = 0;
  }
  /**
   * Sets whether the material is thin-walled (i.e. non-volumetric) or not.
   */
  set geometryThinWalled(value) {
    this._material.geometryThinWalled = value ? 1 : 0;
  }
  /**
   * Gets whether the material is thin-walled (i.e. non-volumetric) or not.
   */
  get geometryThinWalled() {
    return this._material.geometryThinWalled ? true : false;
  }
  /**
   * Sets the thickness texture.
   * @param value The thickness texture or null
   */
  set volumeThicknessTexture(value) {
    this._material.geometryThicknessTexture = value;
    this._material._useGeometryThicknessFromGreenChannel = true;
  }
  /**
   * Sets the thickness factor.
   * @param value The thickness value
   */
  set volumeThickness(value) {
    this._material.geometryThickness = value;
  }
  // ========================================
  // SUBSURFACE PROPERTIES (Subsurface Scattering)
  // ========================================
  /**
   * Configures subsurface properties for PBR material
   */
  configureSubsurface() {
    this._material.geometryThinWalled = 1;
    this._material.subsurfaceScatterAnisotropy = 1;
  }
  /**
   * Sets the subsurface weight
   */
  set subsurfaceWeight(value) {
    this._material.subsurfaceWeight = value;
  }
  get subsurfaceWeight() {
    return this._material.subsurfaceWeight;
  }
  /**
   * Sets the subsurface weight texture
   */
  set subsurfaceWeightTexture(value) {
    this._material.subsurfaceWeightTexture = value;
    this._material._useSubsurfaceWeightFromTextureAlpha = true;
  }
  get subsurfaceWeightTexture() {
    return this._material.subsurfaceWeightTexture;
  }
  /**
   * Sets the subsurface color.
   * @param value The subsurface tint color as a Color3
   */
  set subsurfaceColor(value) {
    this._material.subsurfaceColor = value;
  }
  /**
   * Sets the subsurface color texture.
   * @param value The subsurface tint texture or null
   */
  set subsurfaceColorTexture(value) {
    this._material.subsurfaceColorTexture = value;
  }
  /**
   * Sets the diffuse transmission tint of the material
   */
  set diffuseTransmissionTint(value) {
    this._diffuseTransmissionTint = value;
  }
  /**
   * Gets the diffuse transmission tint of the material
   */
  get diffuseTransmissionTint() {
    return this._diffuseTransmissionTint;
  }
  /**
   * Sets the diffuse transmission tint texture of the material
   */
  set diffuseTransmissionTintTexture(value) {
    this._diffuseTransmissionTintTexture = value;
  }
  /**
   * Gets the subsurface radius for subsurface scattering.
   * subsurfaceRadiusScale * subsurfaceRadius gives the mean free path per color channel.
   */
  get subsurfaceRadius() {
    return this._material.subsurfaceRadius;
  }
  /**
   * Sets the subsurface radius for subsurface scattering.
   * subsurfaceRadiusScale * subsurfaceRadius gives the mean free path per color channel.
   * @param value The subsurface radius value
   */
  set subsurfaceRadius(value) {
    this._material.subsurfaceRadius = value;
  }
  /**
   * Gets the subsurface radius scale for subsurface scattering.
   * subsurfaceRadiusScale * subsurfaceRadius gives the mean free path per color channel.
   */
  get subsurfaceRadiusScale() {
    return this._material.subsurfaceRadiusScale;
  }
  /**
   * Sets the subsurface radius scale for subsurface scattering.
   * subsurfaceRadiusScale * subsurfaceRadius gives the mean free path per color channel.
   * @param value The subsurface radius scale as a Color3
   */
  set subsurfaceRadiusScale(value) {
    this._material.subsurfaceRadiusScale = value;
  }
  /**
   * Sets the subsurface scattering anisotropy.
   * @param value The anisotropy intensity value
   */
  set subsurfaceScatterAnisotropy(value) {
    this._material.subsurfaceScatterAnisotropy = value;
  }
  /**
   * Does this material have a translucent surface (i.e. either transmission or subsurface)?
   * @returns True if the material is translucent, false otherwise
   */
  isTranslucent() {
    return this.transmissionWeight > 0 || this.subsurfaceWeight > 0;
  }
  // ========================================
  // FUZZ LAYER (Sheen)
  // ========================================
  /**
   * Configures fuzz for OpenPBR.
   * Enables fuzz and sets up proper configuration.
   */
  configureFuzz() {
  }
  /**
   * Sets the fuzz weight.
   * @param value The fuzz weight value
   */
  set fuzzWeight(value) {
    this._material.fuzzWeight = value;
  }
  /**
   * Sets the fuzz weight texture.
   * @param value The fuzz weight texture or null
   */
  set fuzzWeightTexture(value) {
    this._material.fuzzWeightTexture = value;
  }
  /**
   * Sets the fuzz color.
   * @param value The fuzz color as a Color3
   */
  set fuzzColor(value) {
    this._material.fuzzColor = value;
  }
  /**
   * Sets the fuzz color texture.
   * @param value The fuzz color texture or null
   */
  set fuzzColorTexture(value) {
    this._material.fuzzColorTexture = value;
  }
  /**
   * Sets the fuzz roughness.
   * @param value The fuzz roughness value (0-1)
   */
  set fuzzRoughness(value) {
    this._material.fuzzRoughness = value;
  }
  /**
   * Sets the fuzz roughness texture.
   * @param value The fuzz roughness texture or null
   */
  set fuzzRoughnessTexture(value) {
    this._material.fuzzRoughnessTexture = value;
    this._material._useFuzzRoughnessFromTextureAlpha = true;
  }
  // ========================================
  // ANISOTROPY
  // ========================================
  /**
   * Sets the specular roughness anisotropy of the OpenPBR material.
   * @param value The anisotropy intensity value
   */
  set specularRoughnessAnisotropy(value) {
    this._material.specularRoughnessAnisotropy = value;
  }
  /**
   * Gets the specular roughness anisotropy of the OpenPBR material.
   * @returns The anisotropy intensity value
   */
  get specularRoughnessAnisotropy() {
    return this._material.specularRoughnessAnisotropy;
  }
  /**
   * Sets the anisotropy rotation angle.
   * @param value The anisotropy rotation angle in radians
   */
  set geometryTangentAngle(value) {
    this._material.geometryTangentAngle = value;
  }
  /**
   * Sets the geometry tangent texture for anisotropy.
   * Automatically enables using anisotropy from the tangent texture.
   * @param value The anisotropy texture or null
   */
  set geometryTangentTexture(value) {
    this._material.geometryTangentTexture = value;
    this._material._useSpecularRoughnessAnisotropyFromTangentTexture = true;
  }
  /**
   * Gets the geometry tangent texture for anisotropy.
   * @returns The anisotropy texture or null
   */
  get geometryTangentTexture() {
    return this._material.geometryTangentTexture;
  }
  /**
   * Configures glTF-style anisotropy for the OpenPBR material.
   * @param useGltfStyle Whether to use glTF-style anisotropy
   */
  configureGltfStyleAnisotropy(useGltfStyle = true) {
    this._material._useGltfStyleAnisotropy = useGltfStyle;
  }
  // ========================================
  // THIN FILM IRIDESCENCE
  // ========================================
  /**
   * Sets the thin film weight.
   * @param value The thin film weight value
   */
  set thinFilmWeight(value) {
    this._material.thinFilmWeight = value;
  }
  /**
   * Sets the thin film IOR.
   * @param value The thin film IOR value
   */
  set thinFilmIor(value) {
    this._material.thinFilmIor = value;
  }
  /**
   * Sets the thin film thickness minimum.
   * @param value The minimum thickness value in nanometers
   */
  set thinFilmThicknessMinimum(value) {
    this._material.thinFilmThicknessMin = value / 1e3;
  }
  /**
   * Sets the thin film thickness maximum.
   * @param value The maximum thickness value in nanometers
   */
  set thinFilmThicknessMaximum(value) {
    this._material.thinFilmThickness = value / 1e3;
  }
  /**
   * Sets the thin film weight texture.
   * @param value The thin film weight texture or null
   */
  set thinFilmWeightTexture(value) {
    this._material.thinFilmWeightTexture = value;
  }
  /**
   * Sets the thin film thickness texture.
   * @param value The thin film thickness texture or null
   */
  set thinFilmThicknessTexture(value) {
    this._material.thinFilmThicknessTexture = value;
    this._material._useThinFilmThicknessFromTextureGreen = true;
  }
  // ========================================
  // UNLIT MATERIALS
  // ========================================
  /**
   * Sets whether the OpenPBR material is unlit.
   * @param value True to make the material unlit
   */
  set unlit(value) {
    this._material.unlit = value;
  }
  // ========================================
  // GEOMETRY PARAMETERS
  // ========================================
  /**
   * Sets the geometry opacity of the OpenPBR material.
   * @param value The opacity value (0-1)
   */
  set geometryOpacity(value) {
    this._material.geometryOpacity = value;
  }
  /**
   * Gets the geometry opacity of the OpenPBR material.
   * @returns The opacity value (0-1)
   */
  get geometryOpacity() {
    return this._material.geometryOpacity;
  }
  /**
   * Sets the geometry normal texture of the OpenPBR material.
   * @param value The normal texture or null
   */
  set geometryNormalTexture(value) {
    this._material.geometryNormalTexture = value;
  }
  /**
   * Gets the geometry normal texture of the OpenPBR material.
   * @returns The normal texture or null
   */
  get geometryNormalTexture() {
    return this._material.geometryNormalTexture;
  }
  /**
   * Sets the normal map inversions for the OpenPBR material.
   * Note: OpenPBR may handle normal map inversions differently or may not need them.
   * @param invertX Whether to invert the normal map on the X axis (may be ignored)
   * @param invertY Whether to invert the normal map on the Y axis (may be ignored)
   */
  setNormalMapInversions(invertX, invertY) {
  }
  /**
   * Sets the geometry coat normal texture of the OpenPBR material.
   * @param value The coat normal texture or null
   */
  set geometryCoatNormalTexture(value) {
    this._material.geometryCoatNormalTexture = value;
  }
  /**
   * Gets the geometry coat normal texture of the OpenPBR material.
   * @returns The coat normal texture or null
   */
  get geometryCoatNormalTexture() {
    return this._material.geometryCoatNormalTexture;
  }
  /**
   * Sets the geometry coat normal texture scale.
   * @param value The scale value for the coat normal texture
   */
  set geometryCoatNormalTextureScale(value) {
    if (this._material.geometryCoatNormalTexture) {
      this._material.geometryCoatNormalTexture.level = value;
    }
  }
  /**
   * Finalizes material properties after all loading is complete.
   * @param loader The glTF loader; `loader._disposed` is polled between texture passes to bail early on dispose.
   */
  async finalizeAsync(loader) {
    if (this._diffuseTransmissionTint && !this._diffuseTransmissionTint.equals(Color3.White()) || this._diffuseTransmissionTintTexture) {
      if (this._material.geometryThinWalled) {
        this.subsurfaceColor = this._diffuseTransmissionTint;
        this.subsurfaceColorTexture = this._diffuseTransmissionTintTexture;
      } else {
        await this.copySurfaceToCoatAsync(loader, this.subsurfaceWeight, this.subsurfaceWeightTexture, TextureChannel.A, this._diffuseTransmissionTint, this._diffuseTransmissionTintTexture, true);
        if (loader._disposed) {
          return;
        }
      }
    }
    if (this.transmissionWeight > 0) {
      if (this._material.geometryThinWalled || this._material.transmissionDepth === 0) {
        this._material.transmissionColor = this._material.baseColor;
        this._material.transmissionColorTexture = this._material.baseColorTexture;
      } else if (!this.baseColor.equals(Color3.White()) || this.baseColorTexture !== null) {
        await this.copySurfaceToCoatAsync(loader, this.transmissionWeight, this.transmissionWeightTexture, TextureChannel.R, this.baseColor, this.baseColorTexture, false);
        if (loader._disposed) {
          return;
        }
      }
    }
    if (this._specWorkflow) {
      const newRoughnessTexture = await InvertTextureAsync("newRoughnessTexture (" + this._material.name + ")", await ExtractChannelAsync("glossiness (" + this._material.name + ")", CreateTextureWithFactorOperand(this.specularColorTexture, new Color4(this.specularColor.r, this.specularColor.g, this.specularColor.b, this.glossiness), TextureChannel.A, TextureColorSpace.Linear), TextureChannel.A, this._material.getScene(), TextureColorSpace.Linear, ChannelMask.R), this._material.getScene(), ChannelMask.R, TextureColorSpace.Linear, ChannelMask.R);
      if (loader._disposed) {
        newRoughnessTexture.texture?.dispose();
        return;
      }
      this.specularRoughnessTexture = newRoughnessTexture.texture;
      this.specularRoughness = newRoughnessTexture.factor ? newRoughnessTexture.factor.r : 1;
      const newMetallic = await ExtractMaxChannelAsync("metallicTexture (" + this._material.name + ")", CreateTextureWithFactorOperand(this.specularColorTexture, this.specularColor.toColor4(), TextureChannel.RGBA, TextureColorSpace.Linear), this._material.getScene(), false, TextureColorSpace.SRGB, ChannelMask.RGB);
      if (loader._disposed) {
        newMetallic.texture?.dispose();
        return;
      }
      this.baseMetalnessTexture = newMetallic.texture;
      this.baseMetalness = newMetallic.factor ? newMetallic.factor.r : 1;
      const newBaseColor = await LerpTexturesAsync("newBaseColor (" + this._material.name + ")", CreateTextureWithFactorOperand(this.baseColorTexture, this.baseColor.toColor4(), TextureChannel.RGBA, TextureColorSpace.Linear), CreateTextureWithFactorOperand(this.specularColorTexture, this.specularColor.toColor4(), TextureChannel.RGBA, TextureColorSpace.Linear), { ...newMetallic, dispose: void 0, colorSpace: TextureColorSpace.Linear }, this._material.getScene(), TextureColorSpace.SRGB, ChannelMask.RGB);
      if (loader._disposed) {
        newBaseColor.texture?.dispose();
        return;
      }
      const oldBaseColorTexture = this.baseColorTexture;
      oldBaseColorTexture?.dispose();
      this.baseColorTexture = newBaseColor.texture;
      this.baseColor = newBaseColor.factor ? new Color3(newBaseColor.factor.r, newBaseColor.factor.g, newBaseColor.factor.b) : Color3.White();
      const oldSpecularColorTexture = this.specularColorTexture;
      oldSpecularColorTexture?.dispose();
      this.specularColorTexture = null;
    }
  }
  async copySurfaceToCoatAsync(loader, weight, weightTexture, weightTextureChannel, color, colorTexture, diffuseTransmission = false) {
    const origCoatWeight = this._material.coatWeight;
    const origCoatWeightTexture = this._material.coatWeightTexture;
    const origCoatColor = this._material.coatColor.clone();
    const origCoatColorTexture = this._material.coatColorTexture;
    const origCoatNormalTexture = this._material.geometryCoatNormalTexture;
    const origCoatWeightCol4 = new Color4(origCoatWeight, origCoatWeight, origCoatWeight, origCoatWeight);
    const weightCol4 = new Color4(weight, weight, weight, weight);
    this.coatWeightTexture = null;
    this.coatWeight = 1;
    const results = await Promise.allSettled([
      LerpTexturesAsync("lerpExistingCoat", CreateTextureWithFactorOperand(null, new Color4(1, 1, 1, 1)), CreateTextureWithFactorOperand(origCoatColorTexture, origCoatColor.toColor4(), TextureChannel.RGBA, TextureColorSpace.SRGB), CreateTextureWithFactorOperand(origCoatWeightTexture, origCoatWeightCol4, TextureChannel.R), this._material.getScene(), TextureColorSpace.SRGB),
      LerpTexturesAsync("lerpSurfaceColor", CreateTextureWithFactorOperand(null, new Color4(1, 1, 1, 1)), CreateTextureWithFactorOperand(colorTexture, color.toColor4(), TextureChannel.RGBA, TextureColorSpace.SRGB), CreateTextureWithFactorOperand(weightTexture, weightCol4, weightTextureChannel), this._material.getScene(), TextureColorSpace.SRGB)
    ]);
    const rejected = results.find((r) => r.status === "rejected");
    if (rejected) {
      for (const r of results) {
        if (r.status === "fulfilled") {
          r.value.texture?.dispose();
        }
      }
      throw rejected.reason;
    }
    const [lerpCoatColor, lerpSurfaceColor] = results.map((r) => r.value);
    if (loader._disposed) {
      lerpCoatColor.texture?.dispose();
      lerpSurfaceColor.texture?.dispose();
      return;
    }
    const newCoatColor = await MultiplyTexturesAsync("newCoatColor (" + this._material.name + ")", lerpCoatColor, lerpSurfaceColor, this._material.getScene(), TextureColorSpace.SRGB);
    if (loader._disposed) {
      newCoatColor.texture?.dispose();
      return;
    }
    if (newCoatColor.texture) {
      this.coatColorTexture = newCoatColor.texture;
      this.coatColor = Color3.White();
    } else if (newCoatColor.factor) {
      this.coatColorTexture = null;
      this.coatColor.fromArray([newCoatColor.factor.r, newCoatColor.factor.g, newCoatColor.factor.b]);
    }
    const newCoatIor = await LerpTexturesAsync("newCoatIor (" + this._material.name + ")", CreateTextureWithFactorOperand(null, new Color4(this._material.specularIor, this._material.specularIor, this._material.specularIor, 1), TextureChannel.R), CreateTextureWithFactorOperand(null, new Color4(this.coatIor, this.coatIor, this.coatIor, 1), TextureChannel.R), CreateTextureWithFactorOperand(origCoatWeightTexture, origCoatWeightCol4, TextureChannel.R), this._material.getScene());
    if (loader._disposed) {
      newCoatIor.texture?.dispose();
      return;
    }
    this.coatIor = newCoatIor.factor ? newCoatIor.factor.r : this.coatIor;
    const newCoatRoughness = await LerpTexturesAsync("newCoatRoughness (" + this._material.name + ")", CreateTextureWithFactorOperand(this.specularRoughnessTexture, new Color4(this.specularRoughness, this.specularRoughness, this.specularRoughness, 1), TextureChannel.G), CreateTextureWithFactorOperand(this.coatRoughnessTexture, new Color4(this.coatRoughness, this.coatRoughness, this.coatRoughness, 1), TextureChannel.G), CreateTextureWithFactorOperand(origCoatWeightTexture, origCoatWeightCol4, TextureChannel.R), this._material.getScene());
    if (loader._disposed) {
      newCoatRoughness.texture?.dispose();
      return;
    }
    this.coatRoughness = newCoatRoughness.factor ? newCoatRoughness.factor.r : 1;
    this.coatRoughnessTexture = newCoatRoughness.texture;
    const newCoatDarkening = await LerpTexturesAsync("newCoatDarkening (" + this._material.name + ")", CreateTextureWithFactorOperand(null, new Color4(0, 0, 0, 1), TextureChannel.R), CreateTextureWithFactorOperand(null, new Color4(this.coatDarkening, this.coatDarkening, this.coatDarkening, 1), TextureChannel.R), CreateTextureWithFactorOperand(origCoatWeightTexture, origCoatWeightCol4, TextureChannel.R), this._material.getScene());
    if (loader._disposed) {
      newCoatDarkening.texture?.dispose();
      return;
    }
    this.coatDarkening = newCoatDarkening.factor ? newCoatDarkening.factor.r : this.coatDarkening;
    if (diffuseTransmission) {
      const newSpecularRoughness = await LerpTexturesAsync("newSpecularRoughness (" + this._material.name + ")", CreateTextureWithFactorOperand(this.specularRoughnessTexture, new Color4(this._material.specularRoughness, this._material.specularRoughness, this._material.specularRoughness, 1), TextureChannel.G), CreateTextureWithFactorOperand(null, new Color4(1, 1, 1, 1), TextureChannel.R), CreateTextureWithFactorOperand(weightTexture, weightCol4, weightTextureChannel), this._material.getScene());
      if (loader._disposed) {
        newSpecularRoughness.texture?.dispose();
        return;
      }
      this.specularRoughness = newSpecularRoughness.factor ? newSpecularRoughness.factor.r : 1;
      this.specularRoughnessTexture = newSpecularRoughness.texture;
    }
    if (origCoatNormalTexture || this.geometryNormalTexture) {
      const newCoatNormal = await LerpTexturesAsync("newCoatNormal (" + this._material.name + ")", CreateTextureWithFactorOperand(this.geometryNormalTexture, this.geometryNormalTexture ? new Color4(1, 1, 1, 1) : new Color4(0.5, 0.5, 1, 1), TextureChannel.RGBA), CreateTextureWithFactorOperand(origCoatNormalTexture, origCoatNormalTexture ? new Color4(1, 1, 1, 1) : new Color4(0.5, 0.5, 1, 1), TextureChannel.RGBA), CreateTextureWithFactorOperand(origCoatWeightTexture, origCoatWeightCol4, TextureChannel.R), this._material.getScene());
      if (loader._disposed) {
        newCoatNormal.texture?.dispose();
        return;
      }
      if (newCoatNormal.texture) {
        this.geometryCoatNormalTexture = newCoatNormal.texture;
      }
    }
  }
}
const openpbrMaterialLoadingAdapter = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  OpenPBRMaterialLoadingAdapter
}, Symbol.toStringTag, { value: "Module" }));
class PBRMaterialLoadingAdapter {
  /**
   * Creates a new instance of the PBRMaterialLoadingAdapter.
   * @param material - The PBR material to adapt.
   */
  constructor(material) {
    this._specWorkflow = false;
    this._material = material;
    this._material.enableSpecularAntiAliasing = true;
  }
  /**
   * Gets the underlying material
   */
  get material() {
    return this._material;
  }
  /**
   * No-op: PBRMaterial has no deferred finalization.
   * @param _loader Unused.
   */
  async finalizeAsync(_loader) {
  }
  /**
   * Whether the material should be treated as unlit
   */
  get isUnlit() {
    return this._material.unlit;
  }
  /**
   * Sets whether the material should be treated as unlit
   */
  set isUnlit(value) {
    this._material.unlit = value;
  }
  // ========================================
  // CULLING PROPERTIES
  // ========================================
  /**
   * Sets whether back face culling is enabled.
   * @param value True to enable back face culling
   */
  set backFaceCulling(value) {
    this._material.backFaceCulling = value;
  }
  /**
   * Gets whether back face culling is enabled.
   * @returns True if back face culling is enabled
   */
  get backFaceCulling() {
    return this._material.backFaceCulling;
  }
  /**
   * Sets whether two-sided lighting is enabled.
   * @param value True to enable two-sided lighting
   */
  set twoSidedLighting(value) {
    this._material.twoSidedLighting = value;
  }
  /**
   * Gets whether two-sided lighting is enabled.
   * @returns True if two-sided lighting is enabled
   */
  get twoSidedLighting() {
    return this._material.twoSidedLighting;
  }
  // ========================================
  // ALPHA PROPERTIES
  // ========================================
  /**
   * Sets the alpha cutoff value for alpha testing.
   * @param value The alpha cutoff threshold (0-1)
   */
  set alphaCutOff(value) {
    this._material.alphaCutOff = value;
  }
  /**
   * Gets the alpha cutoff value.
   * @returns The alpha cutoff threshold (0-1)
   */
  get alphaCutOff() {
    return this._material.alphaCutOff;
  }
  /**
   * Sets whether to use alpha from the albedo texture.
   * @param value True to use alpha from albedo texture
   */
  set useAlphaFromBaseColorTexture(value) {
    this._material.useAlphaFromAlbedoTexture = value;
  }
  /**
   * Gets whether alpha is used from the albedo texture.
   * @returns True if using alpha from albedo texture
   */
  get useAlphaFromBaseColorTexture() {
    return this._material.useAlphaFromAlbedoTexture;
  }
  /**
   * Gets whether the transparency is treated as alpha coverage.
   */
  get transparencyAsAlphaCoverage() {
    return this._material.useRadianceOverAlpha || this._material.useSpecularOverAlpha;
  }
  /**
   * Sets/Gets whether the transparency is treated as alpha coverage
   */
  set transparencyAsAlphaCoverage(value) {
    this._material.useRadianceOverAlpha = !value;
    this._material.useSpecularOverAlpha = !value;
  }
  // ========================================
  // BASE PARAMETERS
  // ========================================
  /**
   * Sets the base color of the material (mapped to PBR albedoColor).
   * @param value The base color as a Color3
   */
  set baseColor(value) {
    this._material.albedoColor = value;
  }
  /**
   * Gets the base color of the material.
   * @returns The base color as a Color3
   */
  get baseColor() {
    return this._material.albedoColor;
  }
  /**
   * Sets the base color texture of the material (mapped to PBR albedoTexture).
   * @param value The base color texture or null
   */
  set baseColorTexture(value) {
    this._material.albedoTexture = value;
  }
  /**
   * Gets the base color texture of the material.
   * @returns The base color texture or null
   */
  get baseColorTexture() {
    return this._material.albedoTexture;
  }
  /**
   * Sets the base diffuse roughness of the material.
   * @param value The diffuse roughness value (0-1)
   */
  set baseDiffuseRoughness(value) {
    this._material.baseDiffuseRoughness = value;
    if (value > 0) {
      this._material.brdf.baseDiffuseModel = Constants.MATERIAL_DIFFUSE_MODEL_E_OREN_NAYAR;
    }
  }
  /**
   * Gets the base diffuse roughness of the material.
   * @returns The diffuse roughness value (0-1), defaults to 0 if not set
   */
  get baseDiffuseRoughness() {
    return this._material.baseDiffuseRoughness ?? 0;
  }
  /**
   * Sets the base diffuse roughness texture of the material.
   * @param value The diffuse roughness texture or null
   */
  set baseDiffuseRoughnessTexture(value) {
    this._material.baseDiffuseRoughnessTexture = value;
  }
  /**
   * Gets the base diffuse roughness texture of the material.
   * @returns The diffuse roughness texture or null
   */
  get baseDiffuseRoughnessTexture() {
    return this._material.baseDiffuseRoughnessTexture;
  }
  /**
   * Sets the base metalness value of the material (mapped to PBR metallic).
   * @param value The metalness value (0-1)
   */
  set baseMetalness(value) {
    this._material.metallic = value;
  }
  /**
   * Gets the base metalness value of the material.
   * @returns The metalness value (0-1), defaults to 1 if not set
   */
  get baseMetalness() {
    return this._material.metallic ?? 1;
  }
  /**
   * Sets the base metalness texture of the material (mapped to PBR metallicTexture).
   * @param value The metalness texture or null
   */
  set baseMetalnessTexture(value) {
    this._material.metallicTexture = value;
  }
  /**
   * Gets the base metalness texture of the material.
   * @returns The metalness texture or null
   */
  get baseMetalnessTexture() {
    return this._material.metallicTexture;
  }
  /**
   * Sets whether to use roughness from the metallic texture's green channel.
   * Also disables using roughness from the alpha channel when enabled.
   * @param value True to use green channel for roughness
   */
  set useRoughnessFromMetallicTextureGreen(value) {
    this._material.useRoughnessFromMetallicTextureGreen = value;
    this._material.useRoughnessFromMetallicTextureAlpha = !value;
  }
  /**
   * Sets whether to use metalness from the metallic texture's blue channel.
   * @param value True to use blue channel for metalness
   */
  set useMetallicFromMetallicTextureBlue(value) {
    this._material.useMetallnessFromMetallicTextureBlue = value;
  }
  // ========================================
  // SPECULAR PARAMETERS
  // ========================================
  /**
   * Configures specular properties and optionally enables OpenPBR BRDF model for edge color support.
   * @param enableEdgeColor Whether to enable OpenPBR BRDF models for edge color support
   */
  enableSpecularEdgeColor(enableEdgeColor = false) {
    if (enableEdgeColor) {
      this._material.brdf.dielectricSpecularModel = Constants.MATERIAL_DIELECTRIC_SPECULAR_MODEL_OPENPBR;
      this._material.brdf.conductorSpecularModel = Constants.MATERIAL_CONDUCTOR_SPECULAR_MODEL_OPENPBR;
    }
  }
  /**
   * Enable the specular/glossiness workflow and disable metallic/roughness.
   */
  configureSpecularGlossiness() {
    this._specWorkflow = true;
    this._material.metallic = null;
    this._material.roughness = null;
    this._material.useMicroSurfaceFromReflectivityMapAlpha = true;
  }
  /**
   * Sets the specular weight (mapped to PBR metallicF0Factor).
   * @param value The specular weight value
   */
  set specularWeight(value) {
    this._material.metallicF0Factor = value;
  }
  /**
   * Gets the specular weight.
   * @returns The specular weight value, defaults to 1 if not set
   */
  get specularWeight() {
    return this._material.metallicF0Factor ?? 1;
  }
  /**
   * Sets the specular weight texture (mapped to PBR metallicReflectanceTexture).
   * Configures the material to use only metalness from this texture when set.
   * @param value The specular weight texture or null
   */
  set specularWeightTexture(value) {
    if (value) {
      this._material.metallicReflectanceTexture = value;
      this._material.useOnlyMetallicFromMetallicReflectanceTexture = true;
    } else {
      this._material.metallicReflectanceTexture = null;
      this._material.useOnlyMetallicFromMetallicReflectanceTexture = false;
    }
  }
  /**
   * Gets the specular weight texture.
   * @returns The specular weight texture or null
   */
  get specularWeightTexture() {
    return this._material.metallicReflectanceTexture;
  }
  /**
   * Sets the specular color (mapped to PBR metallicReflectanceColor).
   * @param value The specular color as a Color3
   */
  set specularColor(value) {
    if (this._specWorkflow) {
      this._material.reflectivityColor = value;
    } else {
      this._material.metallicReflectanceColor = value;
    }
  }
  /**
   * Gets the specular color.
   * @returns The specular color as a Color3
   */
  get specularColor() {
    if (this._specWorkflow) {
      return this._material.reflectivityColor;
    } else {
      return this._material.metallicReflectanceColor;
    }
  }
  /**
   * Sets the specular color texture (mapped to PBR reflectanceTexture).
   * @param value The specular color texture or null
   */
  set specularColorTexture(value) {
    if (this._specWorkflow) {
      this._material.reflectivityTexture = value;
      if (this._material.reflectivityTexture) {
        this._material.reflectivityTexture.hasAlpha = true;
      }
    } else {
      this._material.reflectanceTexture = value;
    }
  }
  /**
   * Gets the specular color texture.
   * @returns The specular color texture or null
   */
  get specularColorTexture() {
    if (this._specWorkflow) {
      return this._material.reflectivityTexture;
    } else {
      return this._material.reflectanceTexture;
    }
  }
  /**
   * Sets the specular roughness (mapped to PBR roughness).
   * @param value The roughness value (0-1)
   */
  set specularRoughness(value) {
    this._material.roughness = value;
  }
  /**
   * Gets the specular roughness.
   * @returns The roughness value (0-1), defaults to 1 if not set
   */
  get specularRoughness() {
    return this._material.roughness ?? 1;
  }
  /**
   * Sets the specular roughness texture.
   * Note: PBR uses the same texture for both metallic and roughness,
   * so this only sets the texture if no base metalness texture exists.
   * @param value The roughness texture or null
   */
  set specularRoughnessTexture(value) {
    if (!this.baseMetalnessTexture) {
      this._material.metallicTexture = value;
    }
  }
  /**
   * Gets the specular roughness texture.
   * @returns The roughness texture (same as metallic texture for PBR) or null
   */
  get specularRoughnessTexture() {
    return this._material.metallicTexture;
  }
  /**
   * Sets the specular index of refraction (mapped to PBR indexOfRefraction).
   * @param value The IOR value
   */
  set specularIor(value) {
    this._material.indexOfRefraction = value;
  }
  /**
   * Gets the specular index of refraction.
   * @returns The IOR value
   */
  get specularIor() {
    return this._material.indexOfRefraction;
  }
  /**
   * Sets/gets the glossiness (inverted roughness)
   * ONLY used for specular/glossiness workflow; has no effect when metallic/roughness workflow is active
   */
  get glossiness() {
    return this._material.microSurface ?? 1;
  }
  /**
   * Sets/gets the glossiness (inverted roughness)
   * ONLY used for specular/glossiness workflow; has no effect when metallic/roughness workflow is active
   */
  set glossiness(value) {
    this._material.microSurface = value;
  }
  // ========================================
  // EMISSION PARAMETERS
  // ========================================
  /**
   * Sets the emission color (mapped to PBR emissiveColor).
   * @param value The emission color as a Color3
   */
  set emissionColor(value) {
    this._material.emissiveColor = value;
  }
  /**
   * Gets the emission color.
   * @returns The emission color as a Color3
   */
  get emissionColor() {
    return this._material.emissiveColor;
  }
  /**
   * Sets the emission luminance/intensity (mapped to PBR emissiveIntensity).
   * @param value The emission intensity value
   */
  set emissionLuminance(value) {
    this._material.emissiveIntensity = value;
  }
  /**
   * Gets the emission luminance/intensity.
   * @returns The emission intensity value
   */
  get emissionLuminance() {
    return this._material.emissiveIntensity;
  }
  /**
   * Sets the emission color texture (mapped to PBR emissiveTexture).
   * @param value The emission texture or null
   */
  set emissionColorTexture(value) {
    this._material.emissiveTexture = value;
  }
  /**
   * Gets the emission color texture.
   * @returns The emission texture or null
   */
  get emissionColorTexture() {
    return this._material.emissiveTexture;
  }
  // ========================================
  // AMBIENT OCCLUSION
  // ========================================
  /**
   * Sets the ambient occlusion texture (mapped to PBR ambientTexture).
   * Automatically enables grayscale mode when set.
   * @param value The ambient occlusion texture or null
   */
  set ambientOcclusionTexture(value) {
    this._material.ambientTexture = value;
    if (value) {
      this._material.useAmbientInGrayScale = true;
    }
  }
  /**
   * Gets the ambient occlusion texture.
   * @returns The ambient occlusion texture or null
   */
  get ambientOcclusionTexture() {
    return this._material.ambientTexture;
  }
  /**
   * Sets the ambient occlusion texture strength.
   * @param value The strength value (typically 0-1)
   */
  set ambientOcclusionTextureStrength(value) {
    this._material.ambientTextureStrength = value;
  }
  /**
   * Gets the ambient occlusion texture strength.
   * @returns The strength value, defaults to 1.0 if not set
   */
  get ambientOcclusionTextureStrength() {
    return this._material.ambientTextureStrength ?? 1;
  }
  // ========================================
  // COAT PARAMETERS
  // ========================================
  /**
   * Configures clear coat for PBR material.
   * Enables clear coat and sets up proper configuration.
   */
  configureCoat() {
    this._material.clearCoat.isEnabled = true;
    this._material.clearCoat.useRoughnessFromMainTexture = false;
    this._material.clearCoat.remapF0OnInterfaceChange = false;
  }
  /**
   * Sets the coat weight (mapped to PBR clearCoat.intensity).
   * Automatically enables clear coat.
   * @param value The coat weight value (0-1)
   */
  set coatWeight(value) {
    this._material.clearCoat.isEnabled = true;
    this._material.clearCoat.intensity = value;
  }
  /**
   * Gets the coat weight.
   * @returns The coat weight value
   */
  get coatWeight() {
    return this._material.clearCoat.intensity;
  }
  /**
   * Sets the coat weight texture (mapped to PBR clearCoat.texture).
   * Automatically enables clear coat.
   * @param value The coat weight texture or null
   */
  set coatWeightTexture(value) {
    this._material.clearCoat.isEnabled = true;
    this._material.clearCoat.texture = value;
  }
  /**
   * Gets the coat weight texture.
   * @returns The coat weight texture or null
   */
  get coatWeightTexture() {
    return this._material.clearCoat.texture;
  }
  /**
   * Sets the coat color (mapped to PBR clearCoat.tintColor).
   * @param value The coat tint color as a Color3
   */
  set coatColor(value) {
    this._material.clearCoat.isTintEnabled = value != Color3.White();
    this._material.clearCoat.tintColor = value;
  }
  /**
   * Sets the coat color texture (mapped to PBR clearCoat.tintTexture).
   * @param value The coat color texture or null
   */
  set coatColorTexture(value) {
    this._material.clearCoat.tintTexture = value;
  }
  /**
   * Sets the coat roughness (mapped to PBR clearCoat.roughness).
   * Automatically enables clear coat.
   * @param value The coat roughness value (0-1)
   */
  set coatRoughness(value) {
    this._material.clearCoat.isEnabled = true;
    this._material.clearCoat.roughness = value;
  }
  /**
   * Gets the coat roughness.
   * @returns The coat roughness value, defaults to 0 if not set
   */
  get coatRoughness() {
    return this._material.clearCoat.roughness ?? 0;
  }
  /**
   * Sets the coat roughness texture (mapped to PBR clearCoat.textureRoughness).
   * Automatically enables clear coat and disables using roughness from main texture.
   * @param value The coat roughness texture or null
   */
  set coatRoughnessTexture(value) {
    this._material.clearCoat.isEnabled = true;
    this._material.clearCoat.useRoughnessFromMainTexture = false;
    this._material.clearCoat.textureRoughness = value;
  }
  /**
   * Gets the coat roughness texture.
   * @returns The coat roughness texture or null
   */
  get coatRoughnessTexture() {
    return this._material.clearCoat.textureRoughness;
  }
  /**
   * Sets the coat index of refraction (IOR).
   */
  set coatIor(value) {
    this._material.clearCoat.indexOfRefraction = value;
  }
  /**
   * Sets the coat darkening value.
   * Note: PBR doesn't have a direct coat darkening property, so this is a no-op.
   * @param value The coat darkening value (ignored for PBR)
   */
  set coatDarkening(value) {
  }
  /**
   * Sets the coat darkening texture
   * @param value The coat darkening texture or null
   */
  set coatDarkeningTexture(value) {
  }
  /**
   * Sets the coat roughness anisotropy.
   * Note: PBR clearCoat doesn't support anisotropy yet, so this is a placeholder.
   * @param value The coat anisotropy intensity value (currently ignored)
   */
  set coatRoughnessAnisotropy(value) {
  }
  /**
   * Gets the coat roughness anisotropy.
   * Note: PBR clearCoat doesn't support anisotropy yet, so this returns 0.
   * @returns Currently returns 0 as clearCoat anisotropy is not yet available
   */
  get coatRoughnessAnisotropy() {
    return 0;
  }
  /**
   * Sets the coat tangent angle for anisotropy.
   * Note: PBR clearCoat doesn't support anisotropy yet, so this is a placeholder.
   * @param value The coat anisotropy rotation angle in radians (currently ignored)
   */
  set geometryCoatTangentAngle(value) {
  }
  /**
   * Sets the coat tangent texture for anisotropy.
   * Note: PBR clearCoat doesn't support anisotropy textures yet, so this is a placeholder.
   * @param value The coat anisotropy texture (currently ignored)
   */
  set geometryCoatTangentTexture(value) {
  }
  /**
   * Gets the coat tangent texture for anisotropy.
   * Note: PBR clearCoat doesn't support anisotropy textures yet, so this returns null.
   * @returns Currently returns null as clearCoat anisotropy is not yet available
   */
  get geometryCoatTangentTexture() {
    return null;
  }
  // ========================================
  // TRANSMISSION LAYER
  // ========================================
  /**
   * Sets the transmission weight (mapped to PBR subSurface.refractionIntensity).
   * Enables refraction when value \> 0.
   * @param value The transmission weight value (0-1)
   */
  set transmissionWeight(value) {
    this._material.subSurface.isRefractionEnabled = value > 0;
    this._material.subSurface.refractionIntensity = value;
  }
  /**
   * Gets the transmission weight.
   * @returns The transmission weight value
   */
  get transmissionWeight() {
    return this._material.subSurface.isRefractionEnabled ? this._material.subSurface.refractionIntensity : 0;
  }
  /**
   * Sets the transmission weight texture (mapped to PBR subSurface.refractionIntensityTexture).
   * Automatically enables refraction and glTF-style textures.
   * @param value The transmission weight texture or null
   */
  set transmissionWeightTexture(value) {
    this._material.subSurface.isRefractionEnabled = true;
    this._material.subSurface.refractionIntensityTexture = value;
    this._material.subSurface.useGltfStyleTextures = true;
  }
  /**
   * Sets the attenuation distance for volume.
   * @param value The attenuation distance value
   */
  set transmissionDepth(value) {
    if (this.transmissionWeight > 0) {
      this._material.subSurface.tintColorAtDistance = value;
    } else if (this.subsurfaceWeight > 0) {
      this._material.subSurface.diffusionDistance.multiplyInPlace(new Color3(value, value, value));
    }
  }
  /**
   * Gets the attenuation distance for volume.
   * @returns The attenuation distance value
   */
  get transmissionDepth() {
    if (this.transmissionWeight > 0) {
      return this._material.subSurface.tintColorAtDistance;
    }
    return 0;
  }
  /**
   * Sets the attenuation color (mapped to PBR subSurface.tintColor).
   * @param value The attenuation color as a Color3
   */
  set transmissionColor(value) {
    if (this.transmissionWeight > 0) {
      this._material.subSurface.tintColor = value;
    } else if (this.subsurfaceWeight > 0) {
      this._material.subSurface.diffusionDistance.multiplyInPlace(value);
    }
  }
  /**
   * Sets the attenuation color (mapped to PBR subSurface.tintColor).
   * @returns The attenuation color as a Color3
   */
  get transmissionColor() {
    if (this.transmissionWeight > 0) {
      return this._material.subSurface.tintColor;
    } else if (this.subsurfaceWeight > 0) {
      return this._material.subSurface.diffusionDistance;
    }
    return new Color3(0, 0, 0);
  }
  /**
   * Sets the transmission scatter coefficient.
   * @param value The scatter coefficient as a Color3
   */
  set transmissionScatter(value) {
    this._material.subSurface.diffusionDistance = value;
  }
  /**
   * Sets the transmission scatter coefficient.
   * @returns The scatter coefficient as a Color3
   */
  get transmissionScatter() {
    return this._material.subSurface.diffusionDistance;
  }
  set transmissionScatterTexture(value) {
  }
  /**
   * Sets the transmission scattering anisotropy.
   * @param value The anisotropy intensity value (-1 to 1)
   */
  set transmissionScatterAnisotropy(value) {
  }
  /**
   * Sets the transmission dispersion Abbe number.
   * @param value The Abbe number value
   */
  set transmissionDispersionAbbeNumber(value) {
  }
  /**
   * Sets the transmission dispersion scale.
   * @param value The dispersion scale value
   */
  set transmissionDispersionScale(value) {
    if (value > 0) {
      this._material.subSurface.isDispersionEnabled = true;
      this._material.subSurface.dispersion = 20 / value;
    } else {
      this._material.subSurface.isDispersionEnabled = false;
      this._material.subSurface.dispersion = 0;
    }
  }
  /**
   * Gets the refraction background texture
   * @returns The refraction background texture or null
   */
  get refractionBackgroundTexture() {
    return this._material.subSurface.refractionTexture;
  }
  /**
   * Sets the refraction background texture
   * @param value The refraction background texture or null
   */
  set refractionBackgroundTexture(value) {
    this._material.subSurface.refractionTexture = value;
  }
  /**
   * Configures transmission for thin-surface transmission (KHR_materials_transmission).
   * Sets up the material for proper thin-surface transmission behavior.
   */
  configureTransmission() {
    this._material.subSurface.volumeIndexOfRefraction = 1;
    this._material.subSurface.useAlbedoToTintRefraction = true;
    this._material.subSurface.minimumThickness = 0;
    this._material.subSurface.maximumThickness = 0;
  }
  // ========================================
  // VOLUME PROPERTIES
  // ========================================
  /**
   * Configures volume properties for PBR material. Nothing to do for PBRMaterial.
   */
  configureVolume() {
  }
  /**
   * Sets whether the material is thin-walled (i.e. non-volumetric) or not.
   */
  set geometryThinWalled(value) {
  }
  /**
   * Gets whether the material is thin-walled (i.e. non-volumetric) or not.
   */
  get geometryThinWalled() {
    return this._material.subSurface.maximumThickness === 0;
  }
  /**
   * Sets the thickness texture (mapped to PBR subSurface.thicknessTexture).
   * Automatically enables refraction.
   * @param value The thickness texture or null
   */
  set volumeThicknessTexture(value) {
    this._material.subSurface.thicknessTexture = value;
    this._material.subSurface.useGltfStyleTextures = true;
  }
  /**
   * Sets the thickness factor (mapped to PBR subSurface.maximumThickness).
   * Automatically enables refraction.
   * @param value The thickness value
   */
  set volumeThickness(value) {
    this._material.subSurface.minimumThickness = 0;
    this._material.subSurface.maximumThickness = value;
    this._material.subSurface.useThicknessAsDepth = true;
    if (value > 0) {
      this._material.subSurface.volumeIndexOfRefraction = this._material.indexOfRefraction;
    }
  }
  // ========================================
  // SUBSURFACE PROPERTIES (Subsurface Scattering)
  // ========================================
  /**
   * Configures subsurface properties for PBR material
   */
  configureSubsurface() {
    this._material.subSurface.useGltfStyleTextures = true;
    this._material.subSurface.volumeIndexOfRefraction = 1;
    this._material.subSurface.minimumThickness = 0;
    this._material.subSurface.maximumThickness = 0;
    this._material.subSurface.useAlbedoToTintTranslucency = false;
  }
  /**
   * Sets the subsurface weight
   */
  set subsurfaceWeight(value) {
    this._material.subSurface.isTranslucencyEnabled = value > 0;
    this._material.subSurface.translucencyIntensity = value;
  }
  /**
   * Gets the subsurface weight
   * @returns The subsurface weight value
   */
  get subsurfaceWeight() {
    return this._material.subSurface.isTranslucencyEnabled ? this._material.subSurface.translucencyIntensity : 0;
  }
  /**
   * Sets the subsurface weight texture
   */
  set subsurfaceWeightTexture(value) {
    this._material.subSurface.translucencyIntensityTexture = value;
  }
  /**
   * Sets the subsurface color.
   * @param value The subsurface tint color as a Color3
   */
  set subsurfaceColor(value) {
    const extinctionCoefficient = new Vector3(-Math.log(this.transmissionColor.r), -Math.log(this.transmissionColor.g), -Math.log(this.transmissionColor.b));
    extinctionCoefficient.scaleInPlace(1 / Math.max(this.transmissionDepth, 1e-3));
    const absorptionCoeff = extinctionCoefficient;
    const maxChannel = Math.max(absorptionCoeff.x, Math.max(absorptionCoeff.y, absorptionCoeff.z));
    const attenuationDistance = maxChannel > 0 ? 1 / maxChannel : 1;
    this._material.subSurface.diffusionDistance = new Color3(Math.exp(-absorptionCoeff.x * attenuationDistance), Math.exp(-absorptionCoeff.y * attenuationDistance), Math.exp(-absorptionCoeff.z * attenuationDistance));
  }
  /**
   * Sets the subsurface color texture.
   * @param value The subsurface tint texture or null
   */
  set subsurfaceColorTexture(value) {
  }
  /**
   * Sets the surface tint of the material (when using subsurface scattering)
   */
  set diffuseTransmissionTint(value) {
    this._material.subSurface.tintColor = value;
  }
  /**
   * Gets the subsurface constant tint (when using subsurface scattering)
   * @returns The subsurface constant tint as a Color3
   */
  get diffuseTransmissionTint() {
    return this._material.subSurface.tintColor;
  }
  /**
   * Sets the subsurface constant tint texture (when using subsurface scattering)
   * @param value The subsurface constant tint texture or null
   */
  set diffuseTransmissionTintTexture(value) {
    this._material.subSurface.translucencyColorTexture = value;
  }
  /**
   * Gets the subsurface radius (used for subsurface scattering)
   * subsurfaceRadiusScale * subsurfaceRadius gives the mean free path per color channel.
   * @returns The subsurface radius as a Color3
   */
  get subsurfaceRadius() {
    return 1;
  }
  /**
   * Sets the subsurface radius (used for subsurface scattering)
   * subsurfaceRadiusScale * subsurfaceRadius gives the mean free path per color channel.
   * @param value The subsurface radius as a number
   */
  set subsurfaceRadius(value) {
  }
  /**
   * Gets the subsurface radius scale (used for subsurface scattering)
   * subsurfaceRadiusScale * subsurfaceRadius gives the mean free path per color channel.
   * @returns The subsurface radius scale as a Color3
   */
  get subsurfaceRadiusScale() {
    return this._material.subSurface.scatteringDiffusionProfile ?? Color3.White();
  }
  /**
   * Sets the subsurface radius scale (used for subsurface scattering)
   * subsurfaceRadiusScale * subsurfaceRadius gives the mean free path per color channel.
   * @param value The subsurface radius scale as a Color3
   */
  set subsurfaceRadiusScale(value) {
    this._material.subSurface.scatteringDiffusionProfile = value;
  }
  /**
   * Sets the subsurface scattering anisotropy.
   * Note: PBRMaterial does not have a direct equivalent, so this is a no-op.
   * @param value The anisotropy intensity value (ignored for PBR)
   */
  set subsurfaceScatterAnisotropy(value) {
  }
  /**
   * Does this material have a translucent surface (i.e. either transmission or subsurface)?
   * @returns True if the material is translucent, false otherwise
   */
  isTranslucent() {
    return this.transmissionWeight > 0 || this.subsurfaceWeight > 0;
  }
  // ========================================
  // FUZZ LAYER (Sheen)
  // ========================================
  /**
   * Configures sheen for PBR material.
   * Enables sheen and sets up proper configuration.
   */
  configureFuzz() {
    this._material.sheen.isEnabled = true;
    this._material.sheen.useRoughnessFromMainTexture = false;
    this._material.sheen.albedoScaling = true;
  }
  /**
   * Sets the sheen weight (mapped to PBR sheen.intensity).
   * Automatically enables sheen.
   * @param value The sheen weight value
   */
  set fuzzWeight(value) {
    this._material.sheen.isEnabled = true;
    this._material.sheen.intensity = value;
  }
  /**
   * Sets the fuzz weight texture.
   * @param value The fuzz weight texture or null
   */
  set fuzzWeightTexture(value) {
    if (!this._material.sheen.texture) {
      this._material.sheen.texture = value;
    }
  }
  /**
   * Sets the sheen color (mapped to PBR sheen.color).
   * Automatically enables sheen.
   * @param value The sheen color as a Color3
   */
  set fuzzColor(value) {
    this._material.sheen.isEnabled = true;
    this._material.sheen.color = value;
  }
  /**
   * Sets the sheen color texture (mapped to PBR sheen.texture).
   * Automatically enables sheen.
   * @param value The sheen color texture or null
   */
  set fuzzColorTexture(value) {
    this._material.sheen.texture = value;
  }
  /**
   * Sets the sheen roughness (mapped to PBR sheen.roughness).
   * Automatically enables sheen.
   * @param value The sheen roughness value (0-1)
   */
  set fuzzRoughness(value) {
    this._material.sheen.isEnabled = true;
    this._material.sheen.roughness = value;
  }
  /**
   * Sets the sheen roughness texture (mapped to PBR sheen.textureRoughness).
   * Automatically enables sheen.
   * @param value The sheen roughness texture or null
   */
  set fuzzRoughnessTexture(value) {
    this._material.sheen.isEnabled = true;
    this._material.sheen.textureRoughness = value;
  }
  // ========================================
  // ANISOTROPY
  // ========================================
  /**
   * Sets the specular roughness anisotropy (mapped to PBR anisotropy.intensity).
   * Automatically enables anisotropy.
   * @param value The anisotropy intensity value
   */
  set specularRoughnessAnisotropy(value) {
    this._material.anisotropy.isEnabled = true;
    this._material.anisotropy.intensity = value;
  }
  /**
   * Gets the specular roughness anisotropy.
   * @returns The anisotropy intensity value
   */
  get specularRoughnessAnisotropy() {
    return this._material.anisotropy.intensity;
  }
  /**
   * Sets the anisotropy rotation (mapped to PBR anisotropy.angle).
   * Automatically enables anisotropy.
   * @param value The anisotropy rotation angle in radians
   */
  set geometryTangentAngle(value) {
    this._material.anisotropy.isEnabled = true;
    this._material.anisotropy.angle = value;
  }
  /**
   * Sets the geometry tangent texture (mapped to PBR anisotropy.texture).
   * Automatically enables anisotropy.
   * @param value The anisotropy texture or null
   */
  set geometryTangentTexture(value) {
    this._material.anisotropy.isEnabled = true;
    this._material.anisotropy.texture = value;
  }
  /**
   * Gets the geometry tangent texture.
   * @returns The anisotropy texture or null
   */
  get geometryTangentTexture() {
    return this._material.anisotropy.texture;
  }
  /**
   * Configures glTF-style anisotropy for the material.
   * Note: PBR materials don't need this configuration, so this is a no-op.
   * @param useGltfStyle Whether to use glTF-style anisotropy (ignored for PBR)
   */
  configureGltfStyleAnisotropy(useGltfStyle = true) {
  }
  // ========================================
  // THIN FILM IRIDESCENCE
  // ========================================
  /**
   * Sets the iridescence weight (mapped to PBR iridescence.intensity).
   * Automatically enables iridescence.
   * @param value The iridescence intensity value
   */
  set thinFilmWeight(value) {
    this._material.iridescence.isEnabled = value > 0;
    this._material.iridescence.intensity = value;
  }
  /**
   * Sets the iridescence IOR (mapped to PBR iridescence.indexOfRefraction).
   * @param value The iridescence IOR value
   */
  set thinFilmIor(value) {
    this._material.iridescence.indexOfRefraction = value;
  }
  /**
   * Sets the iridescence thickness minimum (mapped to PBR iridescence.minimumThickness).
   * @param value The minimum thickness value in nanometers
   */
  set thinFilmThicknessMinimum(value) {
    this._material.iridescence.minimumThickness = value;
  }
  /**
   * Sets the iridescence thickness maximum (mapped to PBR iridescence.maximumThickness).
   * @param value The maximum thickness value in nanometers
   */
  set thinFilmThicknessMaximum(value) {
    this._material.iridescence.maximumThickness = value;
  }
  /**
   * Sets the thin film weight texture (mapped to PBR iridescence.texture).
   * @param value The thin film weight texture or null
   */
  set thinFilmWeightTexture(value) {
    this._material.iridescence.texture = value;
  }
  /**
   * Sets the iridescence thickness texture (mapped to PBR iridescence.thicknessTexture).
   * @param value The iridescence thickness texture or null
   */
  set thinFilmThicknessTexture(value) {
    this._material.iridescence.thicknessTexture = value;
  }
  // ========================================
  // UNLIT MATERIALS
  // ========================================
  /**
   * Sets whether the material is unlit.
   * @param value True to make the material unlit
   */
  set unlit(value) {
    this._material.unlit = value;
  }
  // ========================================
  // GEOMETRY PARAMETERS
  // ========================================
  /**
   * Sets the geometry opacity (mapped to PBR alpha).
   * @param value The opacity value (0-1)
   */
  set geometryOpacity(value) {
    this._material.alpha = value;
  }
  /**
   * Gets the geometry opacity.
   * @returns The opacity value (0-1)
   */
  get geometryOpacity() {
    return this._material.alpha;
  }
  /**
   * Sets the geometry normal texture (mapped to PBR bumpTexture).
   * Also forces irradiance computation in fragment shader for better lighting.
   * @param value The normal texture or null
   */
  set geometryNormalTexture(value) {
    this._material.bumpTexture = value;
    this._material.forceIrradianceInFragment = true;
  }
  /**
   * Gets the geometry normal texture.
   * @returns The normal texture or null
   */
  get geometryNormalTexture() {
    return this._material.bumpTexture;
  }
  /**
   * Sets the normal map inversions for the material.
   * @param invertX Whether to invert the normal map on the X axis
   * @param invertY Whether to invert the normal map on the Y axis
   */
  setNormalMapInversions(invertX, invertY) {
    this._material.invertNormalMapX = invertX;
    this._material.invertNormalMapY = invertY;
  }
  /**
   * Sets the geometry coat normal texture (mapped to PBR clearCoat.bumpTexture).
   * Automatically enables clear coat.
   * @param value The coat normal texture or null
   */
  set geometryCoatNormalTexture(value) {
    this._material.clearCoat.isEnabled = true;
    this._material.clearCoat.bumpTexture = value;
  }
  /**
   * Gets the geometry coat normal texture.
   * @returns The coat normal texture or null
   */
  get geometryCoatNormalTexture() {
    return this._material.clearCoat.bumpTexture;
  }
  /**
   * Sets the geometry coat normal texture scale.
   * @param value The scale value for the coat normal texture
   */
  set geometryCoatNormalTextureScale(value) {
    if (this._material.clearCoat.bumpTexture) {
      this._material.clearCoat.bumpTexture.level = value;
    }
  }
}
const pbrMaterialLoadingAdapter = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  PBRMaterialLoadingAdapter
}, Symbol.toStringTag, { value: "Module" }));
const NAME$F = "EXT_lights_image_based";
class EXT_lights_image_based {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$F;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$F);
  }
  /** @internal */
  dispose() {
    this._loader = null;
    delete this._lights;
  }
  /** @internal */
  onLoading() {
    const extensions = this._loader.gltf.extensions;
    if (extensions && extensions[this.name]) {
      const extension = extensions[this.name];
      this._lights = extension.lights;
    }
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadSceneAsync(context, scene) {
    return GLTFLoader2.LoadExtensionAsync(context, scene, this.name, async (extensionContext, extension) => {
      this._loader._allMaterialsDirtyRequired = true;
      const promises = new Array();
      promises.push(this._loader.loadSceneAsync(context, scene));
      this._loader.logOpen(`${extensionContext}`);
      const light = ArrayItem.Get(`${extensionContext}/light`, this._lights, extension.light);
      promises.push(
        // eslint-disable-next-line github/no-then
        this._loadLightAsync(`/extensions/${this.name}/lights/${extension.light}`, light).then((texture) => {
          this._loader.babylonScene.environmentTexture = texture;
        })
      );
      this._loader.logClose();
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadLightAsync(context, light) {
    if (!light._loaded) {
      const promises = new Array();
      this._loader.logOpen(`${context}`);
      const imageData = new Array(light.specularImages.length);
      for (let mipmap = 0; mipmap < light.specularImages.length; mipmap++) {
        const faces = light.specularImages[mipmap];
        imageData[mipmap] = new Array(faces.length);
        for (let face = 0; face < faces.length; face++) {
          const specularImageContext = `${context}/specularImages/${mipmap}/${face}`;
          this._loader.logOpen(`${specularImageContext}`);
          const index = faces[face];
          const image = ArrayItem.Get(specularImageContext, this._loader.gltf.images, index);
          promises.push(
            // eslint-disable-next-line github/no-then
            this._loader.loadImageAsync(`/images/${index}`, image).then((data) => {
              imageData[mipmap][face] = data;
            })
          );
          this._loader.logClose();
        }
      }
      this._loader.logClose();
      light._loaded = Promise.all(promises).then(async () => {
        const babylonTexture = new RawCubeTexture(this._loader.babylonScene, null, light.specularImageSize);
        babylonTexture.name = light.name || "environment";
        light._babylonTexture = babylonTexture;
        if (light.intensity != void 0) {
          babylonTexture.level = light.intensity;
        }
        if (light.rotation) {
          let rotation = Quaternion.FromArray(light.rotation);
          if (!this._loader.babylonScene.useRightHandedSystem) {
            rotation = Quaternion.Inverse(rotation);
          }
          Matrix.FromQuaternionToRef(rotation, babylonTexture.getReflectionTextureMatrix());
        }
        if (!light.irradianceCoefficients) {
          throw new Error(`${context}: Irradiance coefficients are missing`);
        }
        const sphericalHarmonics = SphericalHarmonics.FromArray(light.irradianceCoefficients);
        sphericalHarmonics.scaleInPlace(light.intensity);
        sphericalHarmonics.convertIrradianceToLambertianRadiance();
        const sphericalPolynomial = SphericalPolynomial.FromHarmonics(sphericalHarmonics);
        const lodGenerationScale = (imageData.length - 1) / Math.log2(light.specularImageSize);
        return await babylonTexture.updateRGBDAsync(imageData, sphericalPolynomial, lodGenerationScale);
      });
    }
    return light._loaded.then(() => {
      return light._babylonTexture;
    });
  }
}
let _Registered$F = false;
function RegisterEXT_lights_image_based() {
  if (_Registered$F) {
    return;
  }
  _Registered$F = true;
  unregisterGLTFExtension(NAME$F);
  registerGLTFExtension(NAME$F, true, (loader) => new EXT_lights_image_based(loader));
}
RegisterEXT_lights_image_based();
const NAME$E = "EXT_mesh_gpu_instancing";
class EXT_mesh_gpu_instancing {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$E;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$E);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadNodeAsync(context, node, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, node, this.name, async (extensionContext, extension) => {
      this._loader._disableInstancedMesh++;
      const promise = this._loader.loadNodeAsync(`/nodes/${node.index}`, node, assign);
      this._loader._disableInstancedMesh--;
      if (!node._primitiveBabylonMeshes) {
        return await promise;
      }
      const promises = new Array();
      let instanceCount = 0;
      const loadAttribute = (attribute) => {
        if (extension.attributes[attribute] == void 0) {
          promises.push(Promise.resolve(null));
          return;
        }
        const accessor = ArrayItem.Get(`${extensionContext}/attributes/${attribute}`, this._loader.gltf.accessors, extension.attributes[attribute]);
        promises.push(this._loader._loadFloatAccessorAsync(`/accessors/${accessor.bufferView}`, accessor));
        if (instanceCount === 0) {
          instanceCount = accessor.count;
        } else if (instanceCount !== accessor.count) {
          throw new Error(`${extensionContext}/attributes: Instance buffer accessors do not have the same count.`);
        }
      };
      loadAttribute("TRANSLATION");
      loadAttribute("ROTATION");
      loadAttribute("SCALE");
      loadAttribute("_COLOR_0");
      return await promise.then(async (babylonTransformNode) => {
        const [translationBuffer, rotationBuffer, scaleBuffer, colorBuffer] = await Promise.all(promises);
        const matrices = new Float32Array(instanceCount * 16);
        TmpVectors.Vector3[0].copyFromFloats(0, 0, 0);
        TmpVectors.Quaternion[0].copyFromFloats(0, 0, 0, 1);
        TmpVectors.Vector3[1].copyFromFloats(1, 1, 1);
        for (let i = 0; i < instanceCount; ++i) {
          translationBuffer && Vector3.FromArrayToRef(translationBuffer, i * 3, TmpVectors.Vector3[0]);
          rotationBuffer && Quaternion.FromArrayToRef(rotationBuffer, i * 4, TmpVectors.Quaternion[0]);
          scaleBuffer && Vector3.FromArrayToRef(scaleBuffer, i * 3, TmpVectors.Vector3[1]);
          Matrix.ComposeToRef(TmpVectors.Vector3[1], TmpVectors.Quaternion[0], TmpVectors.Vector3[0], TmpVectors.Matrix[0]);
          TmpVectors.Matrix[0].copyToArray(matrices, i * 16);
        }
        for (const babylonMesh of node._primitiveBabylonMeshes) {
          babylonMesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
          if (colorBuffer) {
            if (colorBuffer.length === instanceCount * 3) {
              babylonMesh.thinInstanceSetBuffer("color", colorBuffer, 3, true);
            } else if (colorBuffer.length === instanceCount * 4) {
              babylonMesh.thinInstanceSetBuffer("color", colorBuffer, 4, true);
            } else {
              Logger.Warn("Unexpected size of _COLOR_0 attribute for mesh " + babylonMesh.name);
            }
          }
        }
        return babylonTransformNode;
      });
    });
  }
}
let _Registered$E = false;
function RegisterEXT_mesh_gpu_instancing() {
  if (_Registered$E) {
    return;
  }
  _Registered$E = true;
  unregisterGLTFExtension(NAME$E);
  registerGLTFExtension(NAME$E, true, (loader) => new EXT_mesh_gpu_instancing(loader));
}
RegisterEXT_mesh_gpu_instancing();
const NAME$D = "EXT_meshopt_compression";
class EXT_meshopt_compression {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$D;
    this.enabled = loader.isExtensionUsed(NAME$D);
    this._loader = loader;
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadBufferViewAsync(context, bufferView) {
    return GLTFLoader2.LoadExtensionAsync(context, bufferView, this.name, async (extensionContext, extension) => {
      const bufferViewMeshopt = bufferView;
      if (bufferViewMeshopt._meshOptData) {
        return await bufferViewMeshopt._meshOptData;
      }
      const buffer = ArrayItem.Get(`${context}/buffer`, this._loader.gltf.buffers, extension.buffer);
      bufferViewMeshopt._meshOptData = this._loader.loadBufferAsync(`/buffers/${buffer.index}`, buffer, extension.byteOffset || 0, extension.byteLength).then(async (buffer2) => {
        return await MeshoptCompression.Default.decodeGltfBufferAsync(buffer2, extension.count, extension.byteStride, extension.mode, extension.filter);
      });
      return await bufferViewMeshopt._meshOptData;
    });
  }
}
let _Registered$D = false;
function RegisterEXT_meshopt_compression() {
  if (_Registered$D) {
    return;
  }
  _Registered$D = true;
  unregisterGLTFExtension(NAME$D);
  registerGLTFExtension(NAME$D, true, (loader) => new EXT_meshopt_compression(loader));
}
RegisterEXT_meshopt_compression();
const NAME$C = "EXT_texture_webp";
class EXT_texture_webp {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$C;
    this._loader = loader;
    this.enabled = loader.isExtensionUsed(NAME$C);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadTextureAsync(context, texture, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, texture, this.name, async (extensionContext, extension) => {
      const sampler = texture.sampler == void 0 ? GLTFLoader2.DefaultSampler : ArrayItem.Get(`${context}/sampler`, this._loader.gltf.samplers, texture.sampler);
      const image = ArrayItem.Get(`${extensionContext}/source`, this._loader.gltf.images, extension.source);
      return await this._loader._createTextureAsync(context, sampler, image, (babylonTexture) => {
        assign(babylonTexture);
      }, void 0, !texture._textureInfo.nonColorData);
    });
  }
}
let _Registered$C = false;
function RegisterEXT_texture_webp() {
  if (_Registered$C) {
    return;
  }
  _Registered$C = true;
  unregisterGLTFExtension(NAME$C);
  registerGLTFExtension(NAME$C, true, (loader) => new EXT_texture_webp(loader));
}
RegisterEXT_texture_webp();
const NAME$B = "EXT_texture_avif";
class EXT_texture_avif {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$B;
    this._loader = loader;
    this.enabled = loader.isExtensionUsed(NAME$B);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadTextureAsync(context, texture, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, texture, this.name, async (extensionContext, extension) => {
      const sampler = texture.sampler == void 0 ? GLTFLoader2.DefaultSampler : ArrayItem.Get(`${context}/sampler`, this._loader.gltf.samplers, texture.sampler);
      const image = ArrayItem.Get(`${extensionContext}/source`, this._loader.gltf.images, extension.source);
      return await this._loader._createTextureAsync(context, sampler, image, (babylonTexture) => {
        assign(babylonTexture);
      }, void 0, !texture._textureInfo.nonColorData);
    });
  }
}
let _Registered$B = false;
function RegisterEXT_texture_avif() {
  if (_Registered$B) {
    return;
  }
  _Registered$B = true;
  unregisterGLTFExtension(NAME$B);
  registerGLTFExtension(NAME$B, true, (loader) => new EXT_texture_avif(loader));
}
RegisterEXT_texture_avif();
const NAME$A = "EXT_lights_ies";
class EXT_lights_ies {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$A;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$A);
  }
  /** @internal */
  dispose() {
    this._loader = null;
    delete this._lights;
  }
  /** @internal */
  onLoading() {
    const extensions = this._loader.gltf.extensions;
    if (extensions && extensions[this.name]) {
      const extension = extensions[this.name];
      this._lights = extension.lights;
      ArrayItem.Assign(this._lights);
    }
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  // eslint-disable-next-line no-restricted-syntax
  loadNodeAsync(context, node, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, node, this.name, async (extensionContext, extension) => {
      this._loader._allMaterialsDirtyRequired = true;
      let babylonSpotLight;
      let light;
      const transformNode = await this._loader.loadNodeAsync(context, node, (babylonMesh) => {
        light = ArrayItem.Get(extensionContext, this._lights, extension.light);
        const name = light.name || babylonMesh.name;
        this._loader.babylonScene._blockEntityCollection = !!this._loader._assetContainer;
        babylonSpotLight = new SpotLight(name, Vector3.Zero(), Vector3.Backward(), 0, 1, this._loader.babylonScene);
        babylonSpotLight.angle = Math.PI / 2;
        babylonSpotLight.innerAngle = 0;
        babylonSpotLight._parentContainer = this._loader._assetContainer;
        this._loader.babylonScene._blockEntityCollection = false;
        light._babylonLight = babylonSpotLight;
        babylonSpotLight.falloffType = Light.FALLOFF_GLTF;
        babylonSpotLight.diffuse = extension.color ? Color3.FromArray(extension.color) : Color3.White();
        babylonSpotLight.intensity = extension.multiplier || 1;
        babylonSpotLight.range = Number.MAX_VALUE;
        babylonSpotLight.parent = babylonMesh;
        this._loader._babylonLights.push(babylonSpotLight);
        GLTFLoader2.AddPointerMetadata(babylonSpotLight, extensionContext);
        assign(babylonMesh);
      });
      let bufferData;
      if (light.uri) {
        bufferData = await this._loader.loadUriAsync(context, light, light.uri);
      } else {
        const bufferView = ArrayItem.Get(`${context}/bufferView`, this._loader.gltf.bufferViews, light.bufferView);
        bufferData = await this._loader.loadBufferViewAsync(`/bufferViews/${bufferView.index}`, bufferView);
      }
      babylonSpotLight.iesProfileTexture = new Texture(babylonSpotLight.name + "_iesProfile", this._loader.babylonScene, true, false, void 0, null, null, bufferData, true, void 0, void 0, void 0, void 0, ".ies");
      return transformNode;
    });
  }
}
let _Registered$A = false;
function RegisterEXT_lights_ies() {
  if (_Registered$A) {
    return;
  }
  _Registered$A = true;
  unregisterGLTFExtension(NAME$A);
  registerGLTFExtension(NAME$A, true, (loader) => new EXT_lights_ies(loader));
}
RegisterEXT_lights_ies();
const NAME$z = "KHR_draco_mesh_compression";
class KHR_draco_mesh_compression {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$z;
    this.useNormalizedFlagFromAccessor = true;
    this._loader = loader;
    this.enabled = DracoDecoder.DefaultAvailable && this._loader.isExtensionUsed(NAME$z);
  }
  /** @internal */
  dispose() {
    delete this.dracoDecoder;
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadVertexDataAsync(context, primitive, babylonMesh) {
    return GLTFLoader2.LoadExtensionAsync(context, primitive, this.name, async (extensionContext, extension) => {
      if (primitive.mode != void 0) {
        if (primitive.mode !== 4 && primitive.mode !== 5) {
          throw new Error(`${context}: Unsupported mode ${primitive.mode}`);
        }
      }
      const attributes = {};
      const normalized = {};
      const loadAttribute = (name, kind) => {
        const uniqueId = extension.attributes[name];
        if (uniqueId == void 0) {
          return;
        }
        babylonMesh._delayInfo = babylonMesh._delayInfo || [];
        if (babylonMesh._delayInfo.indexOf(kind) === -1) {
          babylonMesh._delayInfo.push(kind);
        }
        attributes[kind] = uniqueId;
        if (this.useNormalizedFlagFromAccessor) {
          const accessor = ArrayItem.TryGet(this._loader.gltf.accessors, primitive.attributes[name]);
          if (accessor) {
            normalized[kind] = accessor.normalized || false;
          }
        }
      };
      loadAttribute("POSITION", VertexBuffer.PositionKind);
      loadAttribute("NORMAL", VertexBuffer.NormalKind);
      loadAttribute("TANGENT", VertexBuffer.TangentKind);
      loadAttribute("TEXCOORD_0", VertexBuffer.UVKind);
      loadAttribute("TEXCOORD_1", VertexBuffer.UV2Kind);
      loadAttribute("TEXCOORD_2", VertexBuffer.UV3Kind);
      loadAttribute("TEXCOORD_3", VertexBuffer.UV4Kind);
      loadAttribute("TEXCOORD_4", VertexBuffer.UV5Kind);
      loadAttribute("TEXCOORD_5", VertexBuffer.UV6Kind);
      loadAttribute("JOINTS_0", VertexBuffer.MatricesIndicesKind);
      loadAttribute("WEIGHTS_0", VertexBuffer.MatricesWeightsKind);
      loadAttribute("COLOR_0", VertexBuffer.ColorKind);
      const bufferView = ArrayItem.Get(extensionContext, this._loader.gltf.bufferViews, extension.bufferView);
      if (!bufferView._dracoBabylonGeometry) {
        bufferView._dracoBabylonGeometry = this._loader.loadBufferViewAsync(`/bufferViews/${bufferView.index}`, bufferView).then(async (data) => {
          const dracoDecoder = this.dracoDecoder || DracoDecoder.Default;
          const positionAccessor = ArrayItem.TryGet(this._loader.gltf.accessors, primitive.attributes["POSITION"]);
          const babylonBoundingInfo = !this._loader.parent.alwaysComputeBoundingBox && !babylonMesh.skeleton && positionAccessor ? LoadBoundingInfoFromPositionAccessor(positionAccessor) : null;
          return await dracoDecoder._decodeMeshToGeometryForGltfAsync(babylonMesh.name, this._loader.babylonScene, data, attributes, normalized, babylonBoundingInfo).catch((error) => {
            throw new Error(`${context}: ${error.message}`);
          });
        });
      }
      return await bufferView._dracoBabylonGeometry;
    });
  }
}
let _Registered$z = false;
function RegisterKHR_draco_mesh_compression() {
  if (_Registered$z) {
    return;
  }
  _Registered$z = true;
  unregisterGLTFExtension(NAME$z);
  registerGLTFExtension(NAME$z, true, (loader) => new KHR_draco_mesh_compression(loader));
}
RegisterKHR_draco_mesh_compression();
const NAME$y = "KHR_gaussian_splatting";
const ShC0 = 0.28209479177387814;
const RotationAttribute = "KHR_gaussian_splatting:ROTATION";
const ScaleAttribute = "KHR_gaussian_splatting:SCALE";
const OpacityAttribute = "KHR_gaussian_splatting:OPACITY";
const ShDegree0Attribute = "KHR_gaussian_splatting:SH_DEGREE_0_COEF_0";
const ShCoefficientCountPerDegree = [0, 3, 5, 7];
function Clamp255(value) {
  return value <= 0 ? 0 : value >= 255 ? 255 : value + 0.5 | 0;
}
class KHR_gaussian_splatting {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$y;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$y);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadMeshPrimitiveAsync(context, name, node, mesh, primitive, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, primitive, this.name, async (extensionContext) => {
      if (primitive.mode != void 0 && primitive.mode !== 0) {
        throw new Error(`${extensionContext}: Gaussian splatting primitives must use POINTS mode`);
      }
      const loader = this._loader;
      const loadAttribute = (attributeName) => {
        const accessorIndex = primitive.attributes[attributeName];
        if (accessorIndex == void 0) {
          return null;
        }
        const accessor = ArrayItem.Get(`${context}/attributes/${attributeName}`, loader.gltf.accessors, accessorIndex);
        return loader._loadFloatAccessorAsync(`/accessors/${accessor.index}`, accessor);
      };
      const positionsPromise = loadAttribute("POSITION");
      if (!positionsPromise) {
        throw new Error(`${extensionContext}: Gaussian splatting primitive is missing the POSITION attribute`);
      }
      let shDegree = 0;
      const shAttributeNames = [];
      for (let degree = 1; degree <= 3; degree++) {
        if (primitive.attributes[`KHR_gaussian_splatting:SH_DEGREE_${degree}_COEF_0`] == void 0) {
          break;
        }
        shDegree = degree;
        for (let coef = 0; coef < ShCoefficientCountPerDegree[degree]; coef++) {
          shAttributeNames.push(`KHR_gaussian_splatting:SH_DEGREE_${degree}_COEF_${coef}`);
        }
      }
      const scene = loader.babylonScene;
      scene._blockEntityCollection = !!loader._assetContainer;
      const gaussianSplattingMesh = new GaussianSplattingMesh(name, null, scene);
      gaussianSplattingMesh._parentContainer = loader._assetContainer;
      scene._blockEntityCollection = false;
      GLTFLoader2.AddPointerMetadata(gaussianSplattingMesh, context);
      loader.parent.onMeshLoadedObservable.notifyObservers(gaussianSplattingMesh);
      assign(gaussianSplattingMesh);
      const engineCaps = scene.getEngine().getCaps();
      const [positions, rotations, scales, opacities, shDegree0, colors, ...shHigherDegrees] = await Promise.all([
        positionsPromise,
        loadAttribute(RotationAttribute),
        loadAttribute(ScaleAttribute),
        loadAttribute(OpacityAttribute),
        loadAttribute(ShDegree0Attribute),
        loadAttribute("COLOR_0"),
        ...shAttributeNames.map((attributeName) => loadAttribute(attributeName))
      ]);
      const splatCount = positions.length / 3;
      const colorStride = colors ? colors.length / splatCount : 0;
      const rowOutputLength = 3 * 4 + 3 * 4 + 4 + 4;
      const buffer = new ArrayBuffer(rowOutputLength * splatCount);
      const floatView = new Float32Array(buffer);
      const byteView = new Uint8Array(buffer);
      let shBuffers = null;
      if (shDegree > 0) {
        const shVectorCount = (shDegree + 1) * (shDegree + 1) - 1;
        const shComponentCount = shVectorCount * 3;
        const textureCount = Math.ceil(shComponentCount / 16);
        const width = engineCaps.maxTextureSize;
        const height = Math.ceil(splatCount / width);
        shBuffers = AllocateShBuffers(textureCount, height * width * 4 * 4);
      }
      for (let i = 0; i < splatCount; i++) {
        const floatBase = i * 8;
        const byteBase = i * 32;
        const p = i * 3;
        floatView[floatBase + 0] = positions[p + 0];
        floatView[floatBase + 1] = positions[p + 1];
        floatView[floatBase + 2] = positions[p + 2];
        floatView[floatBase + 3] = scales ? scales[p + 0] : 1;
        floatView[floatBase + 4] = scales ? scales[p + 1] : 1;
        floatView[floatBase + 5] = scales ? scales[p + 2] : 1;
        if (shDegree0) {
          byteView[byteBase + 24] = Clamp255((0.5 + ShC0 * shDegree0[p + 0]) * 255);
          byteView[byteBase + 25] = Clamp255((0.5 + ShC0 * shDegree0[p + 1]) * 255);
          byteView[byteBase + 26] = Clamp255((0.5 + ShC0 * shDegree0[p + 2]) * 255);
        } else if (colors) {
          const c = i * colorStride;
          byteView[byteBase + 24] = Clamp255(colors[c + 0] * 255);
          byteView[byteBase + 25] = Clamp255(colors[c + 1] * 255);
          byteView[byteBase + 26] = Clamp255(colors[c + 2] * 255);
        } else {
          byteView[byteBase + 24] = 255;
          byteView[byteBase + 25] = 255;
          byteView[byteBase + 26] = 255;
        }
        if (opacities) {
          byteView[byteBase + 27] = Clamp255(opacities[i] * 255);
        } else if (colors && colorStride >= 4) {
          byteView[byteBase + 27] = Clamp255(colors[i * colorStride + 3] * 255);
        } else {
          byteView[byteBase + 27] = 255;
        }
        const r = i * 4;
        const qx = rotations ? rotations[r + 0] : 0;
        const qy = rotations ? rotations[r + 1] : 0;
        const qz = rotations ? rotations[r + 2] : 0;
        const qw = rotations ? rotations[r + 3] : 1;
        byteView[byteBase + 28] = Clamp255(qw * 127.5 + 127.5);
        byteView[byteBase + 29] = Clamp255(qx * 127.5 + 127.5);
        byteView[byteBase + 30] = Clamp255(qy * 127.5 + 127.5);
        byteView[byteBase + 31] = Clamp255(qz * 127.5 + 127.5);
        if (shBuffers) {
          const offsetPerSplat = i * 16;
          for (let coef = 0; coef < shHigherDegrees.length; coef++) {
            const coefData = shHigherDegrees[coef];
            if (!coefData) {
              continue;
            }
            for (let channel = 0; channel < 3; channel++) {
              const flatIndex = coef * 3 + channel;
              const textureIndex = flatIndex >> 4;
              const byteIndexInTexture = flatIndex & 15;
              shBuffers[textureIndex][offsetPerSplat + byteIndexInTexture] = Clamp255(coefData[p + channel] * 128 + 128);
            }
          }
        }
      }
      await gaussianSplattingMesh.updateDataAsync(buffer, shBuffers ?? void 0, void 0, shDegree || void 0);
      return gaussianSplattingMesh;
    });
  }
}
let _Registered$y = false;
function RegisterKHR_gaussian_splatting() {
  if (_Registered$y) {
    return;
  }
  _Registered$y = true;
  unregisterGLTFExtension(NAME$y);
  registerGLTFExtension(NAME$y, true, (loader) => new KHR_gaussian_splatting(loader));
}
RegisterKHR_gaussian_splatting();
const NAME$x = "KHR_lights_punctual";
class KHR_lights {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$x;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$x);
  }
  /** @internal */
  dispose() {
    this._loader = null;
    delete this._lights;
  }
  /** @internal */
  onLoading() {
    const extensions = this._loader.gltf.extensions;
    if (extensions && extensions[this.name]) {
      const extension = extensions[this.name];
      this._lights = extension.lights;
      ArrayItem.Assign(this._lights);
    }
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadNodeAsync(context, node, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, node, this.name, async (extensionContext, extension) => {
      this._loader._allMaterialsDirtyRequired = true;
      return await this._loader.loadNodeAsync(context, node, (babylonMesh) => {
        let babylonLight;
        const light = ArrayItem.Get(extensionContext, this._lights, extension.light);
        const name = light.name || babylonMesh.name;
        this._loader.babylonScene._blockEntityCollection = !!this._loader._assetContainer;
        switch (light.type) {
          case "directional": {
            const babylonDirectionalLight = new DirectionalLight(name, Vector3.Backward(), this._loader.babylonScene);
            babylonDirectionalLight.position.setAll(0);
            babylonLight = babylonDirectionalLight;
            break;
          }
          case "point": {
            babylonLight = new PointLight(name, Vector3.Zero(), this._loader.babylonScene);
            break;
          }
          case "spot": {
            const babylonSpotLight = new SpotLight(name, Vector3.Zero(), Vector3.Backward(), 0, 1, this._loader.babylonScene);
            babylonSpotLight.angle = (light.spot && light.spot.outerConeAngle || Math.PI / 4) * 2;
            babylonSpotLight.innerAngle = (light.spot && light.spot.innerConeAngle || 0) * 2;
            babylonLight = babylonSpotLight;
            break;
          }
          default: {
            this._loader.babylonScene._blockEntityCollection = false;
            throw new Error(`${extensionContext}: Invalid light type (${light.type})`);
          }
        }
        babylonLight._parentContainer = this._loader._assetContainer;
        this._loader.babylonScene._blockEntityCollection = false;
        light._babylonLight = babylonLight;
        babylonLight.falloffType = Light.FALLOFF_GLTF;
        babylonLight.diffuse = light.color ? Color3.FromArray(light.color) : Color3.White();
        babylonLight.intensity = light.intensity == void 0 ? 1 : light.intensity;
        babylonLight.range = light.range == void 0 ? Number.MAX_VALUE : light.range;
        babylonLight.parent = babylonMesh;
        this._loader._babylonLights.push(babylonLight);
        GLTFLoader2.AddPointerMetadata(babylonLight, extensionContext);
        assign(babylonMesh);
      });
    });
  }
}
let _Registered$x = false;
function RegisterKHR_lights() {
  if (_Registered$x) {
    return;
  }
  _Registered$x = true;
  unregisterGLTFExtension(NAME$x);
  registerGLTFExtension(NAME$x, true, (loader) => new KHR_lights(loader));
}
RegisterKHR_lights();
const NAME$w = "EXT_lights_area";
class EXT_lights_area {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$w;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$w);
  }
  /** @internal */
  dispose() {
    this._loader = null;
    delete this._lights;
  }
  /** @internal */
  onLoading() {
    const extensions = this._loader.gltf.extensions;
    if (extensions && extensions[this.name]) {
      const extension = extensions[this.name];
      this._lights = extension.lights;
      ArrayItem.Assign(this._lights);
    }
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadNodeAsync(context, node, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, node, this.name, async (extensionContext, extension) => {
      this._loader._allMaterialsDirtyRequired = true;
      return await this._loader.loadNodeAsync(context, node, (babylonMesh) => {
        let babylonLight;
        const light = ArrayItem.Get(extensionContext, this._lights, extension.light);
        const name = light.name || babylonMesh.name;
        this._loader.babylonScene._blockEntityCollection = !!this._loader._assetContainer;
        const size = light.size !== void 0 ? light.size : 1;
        switch (light.type) {
          case "rect": {
            const width = light.rect?.aspect !== void 0 ? light.rect.aspect * size : size;
            const height = size;
            const babylonRectAreaLight = new RectAreaLight(name, Vector3.Zero(), width, height, this._loader.babylonScene);
            babylonLight = babylonRectAreaLight;
            break;
          }
          case "disk": {
            const newSize = Math.sqrt(size * size * 0.25 * Math.PI);
            const babylonRectAreaLight = new RectAreaLight(name, Vector3.Zero(), newSize, newSize, this._loader.babylonScene);
            babylonLight = babylonRectAreaLight;
            break;
          }
          default: {
            this._loader.babylonScene._blockEntityCollection = false;
            throw new Error(`${extensionContext}: Invalid area light type (${light.type})`);
          }
        }
        babylonLight._parentContainer = this._loader._assetContainer;
        this._loader.babylonScene._blockEntityCollection = false;
        light._babylonLight = babylonLight;
        babylonLight.falloffType = Light.FALLOFF_GLTF;
        babylonLight.diffuse = light.color ? Color3.FromArray(light.color) : Color3.White();
        babylonLight.intensity = light.intensity == void 0 ? 1 : light.intensity;
        const lightParentNode = new TransformNode(`${name}_orientation`, this._loader.babylonScene);
        lightParentNode.rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), Math.PI);
        lightParentNode.parent = babylonMesh;
        babylonLight.parent = lightParentNode;
        this._loader._babylonLights.push(babylonLight);
        GLTFLoader2.AddPointerMetadata(babylonLight, extensionContext);
        assign(babylonMesh);
      });
    });
  }
}
let _Registered$w = false;
function RegisterEXT_lights_area() {
  if (_Registered$w) {
    return;
  }
  _Registered$w = true;
  unregisterGLTFExtension(NAME$w);
  registerGLTFExtension(NAME$w, true, (loader) => new EXT_lights_area(loader));
}
RegisterEXT_lights_area();
const NAME$v = "KHR_materials_pbrSpecularGlossiness";
class KHR_materials_pbrSpecularGlossiness {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$v;
    this.order = 200;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$v);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialBasePropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadSpecularGlossinessPropertiesAsync(extensionContext, extension, babylonMaterial));
      this._loader.loadMaterialAlphaProperties(context, material, babylonMaterial);
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadSpecularGlossinessPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.configureSpecularGlossiness();
    if (properties.diffuseFactor) {
      adapter.baseColor = Color3.FromArray(properties.diffuseFactor);
      babylonMaterial.alpha = properties.diffuseFactor[3];
    } else {
      adapter.baseColor = Color3.White();
    }
    adapter.specularColor = properties.specularFactor ? Color3.FromArray(properties.specularFactor) : Color3.White();
    adapter.glossiness = properties.glossinessFactor == void 0 ? 1 : properties.glossinessFactor;
    if (properties.diffuseTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/diffuseTexture`, properties.diffuseTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Diffuse)`;
        adapter.baseColorTexture = texture;
      }));
    }
    if (properties.specularGlossinessTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/specularGlossinessTexture`, properties.specularGlossinessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Specular Glossiness)`;
        adapter.specularColorTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$v = false;
function RegisterKHR_materials_pbrSpecularGlossiness() {
  if (_Registered$v) {
    return;
  }
  _Registered$v = true;
  unregisterGLTFExtension(NAME$v);
  registerGLTFExtension(NAME$v, true, (loader) => new KHR_materials_pbrSpecularGlossiness(loader));
}
RegisterKHR_materials_pbrSpecularGlossiness();
const NAME$u = "KHR_materials_unlit";
class KHR_materials_unlit {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$u;
    this.order = 210;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$u);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async () => {
      return await this._loadUnlitPropertiesAsync(context, material, babylonMaterial);
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadUnlitPropertiesAsync(context, material, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    const properties = material.pbrMetallicRoughness;
    if (properties) {
      if (properties.baseColorFactor) {
        adapter.baseColor = Color3.FromArray(properties.baseColorFactor);
        adapter.geometryOpacity = properties.baseColorFactor[3];
      }
      if (properties.baseColorTexture) {
        promises.push(this._loader.loadTextureInfoAsync(`${context}/baseColorTexture`, properties.baseColorTexture, (texture) => {
          texture.name = `${babylonMaterial.name} (Base Color)`;
          adapter.baseColorTexture = texture;
        }));
      }
    }
    adapter.isUnlit = true;
    if (material.doubleSided) {
      adapter.backFaceCulling = false;
      adapter.twoSidedLighting = true;
    }
    this._loader.loadMaterialAlphaProperties(context, material, babylonMaterial);
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$u = false;
function RegisterKHR_materials_unlit() {
  if (_Registered$u) {
    return;
  }
  _Registered$u = true;
  unregisterGLTFExtension(NAME$u);
  registerGLTFExtension(NAME$u, true, (loader) => new KHR_materials_unlit(loader));
}
RegisterKHR_materials_unlit();
const NAME$t = "KHR_materials_clearcoat";
class KHR_materials_clearcoat {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$t;
    this.order = 190;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$t);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadClearCoatPropertiesAsync(extensionContext, extension, babylonMaterial));
      await Promise.all(promises);
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadClearCoatPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.configureCoat();
    adapter.coatWeight = properties.clearcoatFactor !== void 0 ? properties.clearcoatFactor : 0;
    adapter.coatRoughness = properties.clearcoatRoughnessFactor !== void 0 ? properties.clearcoatRoughnessFactor : 0;
    if (properties.clearcoatTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/clearcoatTexture`, properties.clearcoatTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (ClearCoat)`;
        adapter.coatWeightTexture = texture;
      }));
    }
    if (properties.clearcoatRoughnessTexture) {
      properties.clearcoatRoughnessTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/clearcoatRoughnessTexture`, properties.clearcoatRoughnessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (ClearCoat Roughness)`;
        adapter.coatRoughnessTexture = texture;
      }));
    }
    if (properties.clearcoatNormalTexture) {
      properties.clearcoatNormalTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/clearcoatNormalTexture`, properties.clearcoatNormalTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (ClearCoat Normal)`;
        adapter.geometryCoatNormalTexture = texture;
        if (properties.clearcoatNormalTexture?.scale != void 0) {
          adapter.geometryCoatNormalTextureScale = properties.clearcoatNormalTexture.scale;
        }
      }));
      adapter.setNormalMapInversions(!babylonMaterial.getScene().useRightHandedSystem, babylonMaterial.getScene().useRightHandedSystem);
    }
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$t = false;
function RegisterKHR_materials_clearcoat() {
  if (_Registered$t) {
    return;
  }
  _Registered$t = true;
  unregisterGLTFExtension(NAME$t);
  registerGLTFExtension(NAME$t, true, (loader) => new KHR_materials_clearcoat(loader));
}
RegisterKHR_materials_clearcoat();
const NAME$s = "KHR_materials_coat";
class KHR_materials_coat {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$s;
    this.order = 191;
    this.useOpenPBR = false;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$s);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      if (material.extensions && material.extensions["KHR_materials_openpbr"]) {
        this.useOpenPBR = true;
      }
      promises.push(this._loadCoatPropertiesAsync(extensionContext, extension, babylonMaterial));
      await Promise.all(promises);
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadCoatPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.configureCoat();
    adapter.coatWeight = properties.coatFactor !== void 0 ? properties.coatFactor : 0;
    adapter.coatRoughness = properties.coatRoughnessFactor !== void 0 ? properties.coatRoughnessFactor : 0;
    if (properties.coatTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/coatTexture`, properties.coatTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Coat)`;
        adapter.coatWeightTexture = texture;
      }));
    }
    if (properties.coatRoughnessTexture) {
      properties.coatRoughnessTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/coatRoughnessTexture`, properties.coatRoughnessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Coat Roughness)`;
        adapter.coatRoughnessTexture = texture;
      }));
    }
    if (properties.coatNormalTexture) {
      properties.coatNormalTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/coatNormalTexture`, properties.coatNormalTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Coat Normal)`;
        adapter.geometryCoatNormalTexture = texture;
        if (properties.coatNormalTexture?.scale != void 0) {
          adapter.geometryCoatNormalTextureScale = properties.coatNormalTexture.scale;
        }
      }));
      adapter.setNormalMapInversions(!babylonMaterial.getScene().useRightHandedSystem, babylonMaterial.getScene().useRightHandedSystem);
    }
    adapter.coatDarkening = properties.coatDarkeningFactor !== void 0 ? properties.coatDarkeningFactor : 1;
    adapter.coatIor = properties.coatIor !== void 0 ? properties.coatIor : 1.5;
    const colorFactor = Color3.White();
    if (properties.coatColorFactor !== void 0) {
      colorFactor.fromArray(properties.coatColorFactor);
    }
    adapter.coatColor = colorFactor;
    if (properties.coatColorTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/coatColorTexture`, properties.coatColorTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Coat Color)`;
        adapter.coatColorTexture = texture;
      }));
    }
    const coatAnisotropyWeight = properties.coatAnisotropyStrength ?? 0;
    const coatAnisotropyAngle = properties.coatAnisotropyRotation ?? 0;
    adapter.coatRoughnessAnisotropy = coatAnisotropyWeight;
    adapter.geometryCoatTangentAngle = coatAnisotropyAngle;
    if (!this.useOpenPBR) {
      adapter.configureGltfStyleAnisotropy(true);
    }
    if (properties.coatAnisotropyTexture) {
      properties.coatAnisotropyTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/coatAnisotropyTexture`, properties.coatAnisotropyTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Coat Anisotropy)`;
        adapter.geometryCoatTangentTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$s = false;
function RegisterKHR_materials_coat() {
  if (_Registered$s) {
    return;
  }
  _Registered$s = true;
  unregisterGLTFExtension(NAME$s);
  registerGLTFExtension(NAME$s, true, (loader) => new KHR_materials_coat(loader));
}
RegisterKHR_materials_coat();
const NAME$r = "KHR_materials_iridescence";
class KHR_materials_iridescence {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$r;
    this.order = 195;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$r);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadIridescencePropertiesAsync(extensionContext, extension, babylonMaterial));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadIridescencePropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.thinFilmWeight = properties.iridescenceFactor ?? 0;
    adapter.thinFilmIor = properties.iridescenceIor ?? properties.iridescenceIOR ?? 1.3;
    adapter.thinFilmThicknessMinimum = properties.iridescenceThicknessMinimum ?? 100;
    adapter.thinFilmThicknessMaximum = properties.iridescenceThicknessMaximum ?? 400;
    if (properties.iridescenceTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/iridescenceTexture`, properties.iridescenceTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Iridescence)`;
        adapter.thinFilmWeightTexture = texture;
      }));
    }
    if (properties.iridescenceThicknessTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/iridescenceThicknessTexture`, properties.iridescenceThicknessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Iridescence Thickness)`;
        adapter.thinFilmThicknessTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$r = false;
function RegisterKHR_materials_iridescence() {
  if (_Registered$r) {
    return;
  }
  _Registered$r = true;
  unregisterGLTFExtension(NAME$r);
  registerGLTFExtension(NAME$r, true, (loader) => new KHR_materials_iridescence(loader));
}
RegisterKHR_materials_iridescence();
const NAME$q = "KHR_materials_anisotropy";
class KHR_materials_anisotropy {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$q;
    this.order = 195;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$q);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadAnisotropyPropertiesAsync(extensionContext, extension, babylonMaterial));
      await Promise.all(promises);
    });
  }
  async _loadAnisotropyPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    const anisotropyWeight = properties.anisotropyStrength ?? 0;
    const anisotropyAngle = properties.anisotropyRotation ?? 0;
    adapter.specularRoughnessAnisotropy = anisotropyWeight;
    adapter.geometryTangentAngle = anisotropyAngle;
    const extensions = properties.extensions ?? {};
    if (!extensions.EXT_materials_anisotropy_openpbr || !extensions.EXT_materials_anisotropy_openpbr.openPbrAnisotropyEnabled) {
      adapter.configureGltfStyleAnisotropy(true);
    }
    if (properties.anisotropyTexture) {
      properties.anisotropyTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/anisotropyTexture`, properties.anisotropyTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Anisotropy Intensity)`;
        adapter.geometryTangentTexture = texture;
      }));
    }
    await Promise.all(promises);
  }
}
let _Registered$q = false;
function RegisterKHR_materials_anisotropy() {
  if (_Registered$q) {
    return;
  }
  _Registered$q = true;
  unregisterGLTFExtension(NAME$q);
  registerGLTFExtension(NAME$q, true, (loader) => new KHR_materials_anisotropy(loader));
}
RegisterKHR_materials_anisotropy();
const NAME$p = "KHR_materials_emissive_strength";
class KHR_materials_emissive_strength {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$p;
    this.order = 170;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$p);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      await this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial);
      this._loadEmissiveProperties(extensionContext, extension, babylonMaterial);
      return await Promise.resolve();
    });
  }
  _loadEmissiveProperties(context, properties, babylonMaterial) {
    if (properties.emissiveStrength !== void 0) {
      const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
      adapter.emissionLuminance = properties.emissiveStrength;
    }
  }
}
let _Registered$p = false;
function RegisterKHR_materials_emissive_strength() {
  if (_Registered$p) {
    return;
  }
  _Registered$p = true;
  unregisterGLTFExtension(NAME$p);
  registerGLTFExtension(NAME$p, true, (loader) => new KHR_materials_emissive_strength(loader));
}
RegisterKHR_materials_emissive_strength();
const NAME$o = "KHR_materials_sheen";
class KHR_materials_sheen {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$o;
    this.order = 190;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$o);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadSheenPropertiesAsync(extensionContext, extension, babylonMaterial));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadSheenPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.configureFuzz();
    const sheenColor = properties.sheenColorFactor !== void 0 ? Color3.FromArray(properties.sheenColorFactor) : Color3.Black();
    const sheenRoughness = properties.sheenRoughnessFactor !== void 0 ? properties.sheenRoughnessFactor : 0;
    adapter.fuzzWeight = 1;
    adapter.fuzzColor = sheenColor;
    adapter.fuzzRoughness = sheenRoughness;
    if (properties.sheenColorTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/sheenColorTexture`, properties.sheenColorTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Sheen Color)`;
        adapter.fuzzColorTexture = texture;
      }));
    }
    if (properties.sheenRoughnessTexture) {
      properties.sheenRoughnessTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/sheenRoughnessTexture`, properties.sheenRoughnessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Sheen Roughness)`;
        adapter.fuzzRoughnessTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$o = false;
function RegisterKHR_materials_sheen() {
  if (_Registered$o) {
    return;
  }
  _Registered$o = true;
  unregisterGLTFExtension(NAME$o);
  registerGLTFExtension(NAME$o, true, (loader) => new KHR_materials_sheen(loader));
}
RegisterKHR_materials_sheen();
const NAME$n = "KHR_materials_fuzz";
class KHR_materials_fuzz {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$n;
    this.order = 190;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$n);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadFuzzPropertiesAsync(extensionContext, extension, babylonMaterial));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadFuzzPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.configureFuzz();
    adapter.fuzzWeight = properties.fuzzFactor !== void 0 ? properties.fuzzFactor : 0;
    adapter.fuzzColor = properties.fuzzColorFactor !== void 0 ? Color3.FromArray(properties.fuzzColorFactor) : Color3.White();
    adapter.fuzzRoughness = properties.fuzzRoughnessFactor !== void 0 ? properties.fuzzRoughnessFactor : 0.5;
    if (properties.fuzzTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/fuzzTexture`, properties.fuzzTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Fuzz)`;
        adapter.fuzzWeightTexture = texture;
      }));
    }
    if (properties.fuzzColorTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/fuzzColorTexture`, properties.fuzzColorTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Fuzz Color)`;
        adapter.fuzzColorTexture = texture;
      }));
    }
    if (properties.fuzzRoughnessTexture) {
      properties.fuzzRoughnessTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/fuzzRoughnessTexture`, properties.fuzzRoughnessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Fuzz Roughness)`;
        adapter.fuzzRoughnessTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$n = false;
function RegisterKHR_materials_fuzz() {
  if (_Registered$n) {
    return;
  }
  _Registered$n = true;
  unregisterGLTFExtension(NAME$n);
  registerGLTFExtension(NAME$n, true, (loader) => new KHR_materials_fuzz(loader));
}
RegisterKHR_materials_fuzz();
const NAME$m = "KHR_materials_specular";
class KHR_materials_specular {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$m;
    this.order = 190;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$m);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadSpecularPropertiesAsync(extensionContext, extension, babylonMaterial));
      const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
      if (extension.extensions && extension.extensions.EXT_materials_specular_edge_color) {
        const specularEdgeColorExtension = extension.extensions.EXT_materials_specular_edge_color;
        if (specularEdgeColorExtension.specularEdgeColorEnabled) {
          adapter.enableSpecularEdgeColor(true);
        }
      }
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadSpecularPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.specularWeight = properties.specularFactor ?? 1;
    adapter.specularColor = properties.specularColorFactor !== void 0 ? Color3.FromArray(properties.specularColorFactor) : new Color3(1, 1, 1);
    if (properties.specularTexture) {
      properties.specularTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/specularTexture`, properties.specularTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Specular)`;
        adapter.specularWeightTexture = texture;
      }));
    }
    if (properties.specularColorTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/specularColorTexture`, properties.specularColorTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Specular Color)`;
        adapter.specularColorTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$m = false;
function RegisterKHR_materials_specular() {
  if (_Registered$m) {
    return;
  }
  _Registered$m = true;
  unregisterGLTFExtension(NAME$m);
  registerGLTFExtension(NAME$m, true, (loader) => new KHR_materials_specular(loader));
}
RegisterKHR_materials_specular();
const NAME$l = "KHR_materials_ior";
class KHR_materials_ior {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$l;
    this.order = 180;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$l);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadIorPropertiesAsync(extensionContext, extension, babylonMaterial));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadIorPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const indexOfRefraction = properties.ior !== void 0 ? properties.ior : KHR_materials_ior._DEFAULT_IOR;
    adapter.specularIor = indexOfRefraction;
    return Promise.resolve();
  }
}
KHR_materials_ior._DEFAULT_IOR = 1.5;
let _Registered$l = false;
function RegisterKHR_materials_ior() {
  if (_Registered$l) {
    return;
  }
  _Registered$l = true;
  unregisterGLTFExtension(NAME$l);
  registerGLTFExtension(NAME$l, true, (loader) => new KHR_materials_ior(loader));
}
RegisterKHR_materials_ior();
const NAME$k = "KHR_materials_variants";
class KHR_materials_variants {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$k;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$k) && !this._loader.parent.skipMaterials;
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * Gets the list of available variant names for this asset.
   * @param rootNode The glTF root node
   * @returns the list of all the variant names for this model
   */
  static GetAvailableVariants(rootNode) {
    const extensionMetadata = this._GetExtensionMetadata(rootNode);
    if (!extensionMetadata) {
      return [];
    }
    return Object.keys(extensionMetadata.variants);
  }
  /**
   * Gets the list of available variant names for this asset.
   * @param rootNode The glTF root node
   * @returns the list of all the variant names for this model
   */
  getAvailableVariants(rootNode) {
    return KHR_materials_variants.GetAvailableVariants(rootNode);
  }
  /**
   * Select a variant given a variant name or a list of variant names.
   * @param rootNode The glTF root node
   * @param variantName The variant name(s) to select.
   */
  static SelectVariant(rootNode, variantName) {
    const extensionMetadata = this._GetExtensionMetadata(rootNode);
    if (!extensionMetadata) {
      throw new Error(`Cannot select variant on a glTF mesh that does not have the ${NAME$k} extension`);
    }
    const select = (variantName2) => {
      const entries = extensionMetadata.variants[variantName2];
      if (entries) {
        for (const entry of entries) {
          entry.mesh.material = entry.material;
        }
      }
    };
    if (variantName instanceof Array) {
      for (const name of variantName) {
        select(name);
      }
    } else {
      select(variantName);
    }
    extensionMetadata.lastSelected = variantName;
  }
  /**
   * Select a variant given a variant name or a list of variant names.
   * @param rootNode The glTF root node
   * @param variantName The variant name(s) to select.
   */
  selectVariant(rootNode, variantName) {
    KHR_materials_variants.SelectVariant(rootNode, variantName);
  }
  /**
   * Reset back to the original before selecting a variant.
   * @param rootNode The glTF root node
   */
  static Reset(rootNode) {
    const extensionMetadata = this._GetExtensionMetadata(rootNode);
    if (!extensionMetadata) {
      throw new Error(`Cannot reset on a glTF mesh that does not have the ${NAME$k} extension`);
    }
    for (const entry of extensionMetadata.original) {
      entry.mesh.material = entry.material;
    }
    extensionMetadata.lastSelected = null;
  }
  /**
   * Reset back to the original before selecting a variant.
   * @param rootNode The glTF root node
   */
  reset(rootNode) {
    KHR_materials_variants.Reset(rootNode);
  }
  /**
   * Gets the last selected variant name(s) or null if original.
   * @param rootNode The glTF root node
   * @returns The selected variant name(s).
   */
  static GetLastSelectedVariant(rootNode) {
    const extensionMetadata = this._GetExtensionMetadata(rootNode);
    if (!extensionMetadata) {
      throw new Error(`Cannot get the last selected variant on a glTF mesh that does not have the ${NAME$k} extension`);
    }
    return extensionMetadata.lastSelected;
  }
  /**
   * Gets the last selected variant name(s) or null if original.
   * @param rootNode The glTF root node
   * @returns The selected variant name(s).
   */
  getLastSelectedVariant(rootNode) {
    return KHR_materials_variants.GetLastSelectedVariant(rootNode);
  }
  static _GetExtensionMetadata(rootNode) {
    return rootNode?._internalMetadata?.gltf?.[NAME$k] || null;
  }
  /** @internal */
  onLoading() {
    const extensions = this._loader.gltf.extensions;
    if (extensions && extensions[this.name]) {
      const extension = extensions[this.name];
      this._variants = extension.variants;
    }
  }
  /** @internal */
  onReady() {
    const rootNode = this._loader.rootBabylonMesh;
    if (rootNode) {
      const options = this._loader.parent.extensionOptions[NAME$k];
      if (options?.defaultVariant) {
        KHR_materials_variants.SelectVariant(rootNode, options.defaultVariant);
      }
      options?.onLoaded?.({
        get variants() {
          return KHR_materials_variants.GetAvailableVariants(rootNode);
        },
        get selectedVariant() {
          const lastSelectedVariant = KHR_materials_variants.GetLastSelectedVariant(rootNode);
          if (!lastSelectedVariant) {
            return KHR_materials_variants.GetAvailableVariants(rootNode)[0];
          }
          if (Array.isArray(lastSelectedVariant)) {
            return lastSelectedVariant[0];
          }
          return lastSelectedVariant;
        },
        set selectedVariant(variantName) {
          KHR_materials_variants.SelectVariant(rootNode, variantName);
        }
      });
    }
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadMeshPrimitiveAsync(context, name, node, mesh, primitive, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, primitive, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader._loadMeshPrimitiveAsync(context, name, node, mesh, primitive, (babylonMesh) => {
        assign(babylonMesh);
        if (babylonMesh instanceof Mesh) {
          const babylonDrawMode = GLTFLoader2._GetDrawMode(context, primitive.mode);
          const root = this._loader.rootBabylonMesh;
          const metadata = root ? root._internalMetadata = root._internalMetadata || {} : {};
          const gltf = metadata.gltf = metadata.gltf || {};
          const extensionMetadata = gltf[NAME$k] = gltf[NAME$k] || { lastSelected: null, original: [], variants: {} };
          extensionMetadata.original.push({ mesh: babylonMesh, material: babylonMesh.material });
          for (let mappingIndex = 0; mappingIndex < extension.mappings.length; ++mappingIndex) {
            const mapping = extension.mappings[mappingIndex];
            const material = ArrayItem.Get(`${extensionContext}/mappings/${mappingIndex}/material`, this._loader.gltf.materials, mapping.material);
            promises.push(this._loader._loadMaterialAsync(`#/materials/${mapping.material}`, material, babylonMesh, babylonDrawMode, (babylonMaterial) => {
              for (let mappingVariantIndex = 0; mappingVariantIndex < mapping.variants.length; ++mappingVariantIndex) {
                const variantIndex = mapping.variants[mappingVariantIndex];
                const variant = ArrayItem.Get(`/extensions/${NAME$k}/variants/${variantIndex}`, this._variants, variantIndex);
                extensionMetadata.variants[variant.name] = extensionMetadata.variants[variant.name] || [];
                extensionMetadata.variants[variant.name].push({
                  mesh: babylonMesh,
                  material: babylonMaterial
                });
                babylonMesh.onClonedObservable.add((newOne) => {
                  const newMesh = newOne;
                  let metadata2;
                  let newRoot = newMesh;
                  do {
                    newRoot = newRoot.parent;
                    if (!newRoot) {
                      return;
                    }
                    metadata2 = KHR_materials_variants._GetExtensionMetadata(newRoot);
                  } while (metadata2 === null);
                  if (root && metadata2 === KHR_materials_variants._GetExtensionMetadata(root)) {
                    newRoot._internalMetadata = {};
                    for (const key in root._internalMetadata) {
                      newRoot._internalMetadata[key] = root._internalMetadata[key];
                    }
                    newRoot._internalMetadata.gltf = [];
                    for (const key in root._internalMetadata.gltf) {
                      newRoot._internalMetadata.gltf[key] = root._internalMetadata.gltf[key];
                    }
                    newRoot._internalMetadata.gltf[NAME$k] = { lastSelected: null, original: [], variants: {} };
                    for (const original of metadata2.original) {
                      newRoot._internalMetadata.gltf[NAME$k].original.push({
                        mesh: original.mesh,
                        material: original.material
                      });
                    }
                    for (const key in metadata2.variants) {
                      if (Object.prototype.hasOwnProperty.call(metadata2.variants, key)) {
                        newRoot._internalMetadata.gltf[NAME$k].variants[key] = [];
                        for (const variantEntry of metadata2.variants[key]) {
                          newRoot._internalMetadata.gltf[NAME$k].variants[key].push({
                            mesh: variantEntry.mesh,
                            material: variantEntry.material
                          });
                        }
                      }
                    }
                    metadata2 = newRoot._internalMetadata.gltf[NAME$k];
                  }
                  for (const target of metadata2.original) {
                    if (target.mesh === babylonMesh) {
                      target.mesh = newMesh;
                    }
                  }
                  for (const target of metadata2.variants[variant.name]) {
                    if (target.mesh === babylonMesh) {
                      target.mesh = newMesh;
                    }
                  }
                });
              }
            }));
          }
        }
      }));
      return await Promise.all(promises).then(([babylonMesh]) => {
        return babylonMesh;
      });
    });
  }
}
let _Registered$k = false;
function RegisterKHR_materials_variants() {
  if (_Registered$k) {
    return;
  }
  _Registered$k = true;
  unregisterGLTFExtension(NAME$k);
  registerGLTFExtension(NAME$k, true, (loader) => new KHR_materials_variants(loader));
}
RegisterKHR_materials_variants();
class TransmissionHelper {
  /**
   * Creates the default options for the helper.
   * @returns the default options
   */
  static _GetDefaultOptions() {
    return {
      renderSize: 1024,
      samples: 4,
      lodGenerationScale: 1,
      lodGenerationOffset: -4,
      renderTargetTextureType: Constants.TEXTURETYPE_HALF_FLOAT,
      generateMipmaps: true
    };
  }
  /**
   * constructor
   * @param options Defines the options we want to customize the helper
   * @param scene The scene to add the material to
   */
  constructor(options, scene) {
    this._opaqueRenderTarget = null;
    this._opaqueMeshesCache = [];
    this._transparentMeshesCache = [];
    this._materialObservers = {};
    this._newMeshObserver = null;
    this._removedMeshObserver = null;
    this._disposed = false;
    this._materialImpls = [];
    this._adapterCache = /* @__PURE__ */ new WeakMap();
    this._translucentMaterialIndices = /* @__PURE__ */ new Map();
    this._opaqueOnlySubMeshes = /* @__PURE__ */ new Map();
    this._savedSubMeshes = /* @__PURE__ */ new Map();
    this._options = {
      ...TransmissionHelper._GetDefaultOptions(),
      ...options
    };
    this._scene = scene;
    this._scene._transmissionHelper = this;
    this.onErrorObservable = new Observable();
    this._scene.onDisposeObservable.addOnce(() => {
      this.dispose();
    });
    this._parseScene();
    this._setupRenderTargets();
  }
  /**
   * Registers a material implementation with the helper so it can classify and create
   * adapters for materials of that type. Safe to call multiple times with the same
   * implementation — duplicates are ignored.
   * @param impl The material implementation to register
   */
  addMaterialImpl(impl) {
    if (!this._materialImpls.some((i) => i.materialClass === impl.materialClass)) {
      this._materialImpls.push(impl);
    }
  }
  /**
   * Updates the helper options.
   * @param options the options to update
   */
  updateOptions(options) {
    const newValues = Object.keys(options).filter((key) => this._options[key] !== options[key]);
    if (!newValues.length) {
      return;
    }
    const newOptions = {
      ...this._options,
      ...options
    };
    const oldOptions = this._options;
    this._options = newOptions;
    if (newOptions.renderSize !== oldOptions.renderSize || newOptions.renderTargetTextureType !== oldOptions.renderTargetTextureType || newOptions.generateMipmaps !== oldOptions.generateMipmaps || !this._opaqueRenderTarget) {
      this._setupRenderTargets();
    } else {
      this._opaqueRenderTarget.samples = newOptions.samples;
      this._opaqueRenderTarget.lodGenerationScale = newOptions.lodGenerationScale;
      this._opaqueRenderTarget.lodGenerationOffset = newOptions.lodGenerationOffset;
    }
  }
  /**
   * @returns the opaque render target texture or null if not available.
   */
  getOpaqueTarget() {
    return this._opaqueRenderTarget;
  }
  _getOrCreateAdapter(material) {
    let adapter = this._adapterCache.get(material);
    if (!adapter) {
      for (const impl of this._materialImpls) {
        if (material instanceof impl.materialClass) {
          adapter = new impl.adapterClass(material);
          this._adapterCache.set(material, adapter);
          break;
        }
      }
    }
    return adapter;
  }
  /**
   * Classify a mesh's materials as transparent, opaque, or mixed.
   * Sets the refraction background texture on any translucent materials found.
   * For mixed MultiMaterial meshes, populates _translucentMaterialIndices so
   * their translucent submeshes can be excluded from the opaque render target.
   * @param mesh - The mesh to classify
   * @returns 'transparent' if all materials are translucent, 'opaque' if none are, 'mixed' if both
   */
  _classifyMeshMaterials(mesh) {
    const material = mesh.material;
    if (!material) {
      return "opaque";
    }
    if (!(material instanceof MultiMaterial)) {
      const adapter = this._getOrCreateAdapter(material);
      if (!adapter) {
        return "opaque";
      }
      if (adapter.isTranslucent()) {
        adapter.refractionBackgroundTexture = this._opaqueRenderTarget;
        return "transparent";
      }
      return "opaque";
    }
    let hasTranslucent = false;
    let hasOpaque = false;
    const translucentIndices = /* @__PURE__ */ new Set();
    for (let i = 0; i < material.subMaterials.length; i++) {
      const subMat = material.subMaterials[i];
      if (!subMat) {
        hasOpaque = true;
        continue;
      }
      const adapter = this._getOrCreateAdapter(subMat);
      if (adapter) {
        if (adapter.isTranslucent()) {
          adapter.refractionBackgroundTexture = this._opaqueRenderTarget;
          hasTranslucent = true;
          translucentIndices.add(i);
        } else {
          hasOpaque = true;
        }
      } else {
        hasOpaque = true;
      }
    }
    if (hasTranslucent && hasOpaque) {
      this._translucentMaterialIndices.set(mesh, translucentIndices);
      this._rebuildOpaqueOnlySubMeshes(mesh, translucentIndices);
      return "mixed";
    }
    this._translucentMaterialIndices.delete(mesh);
    this._opaqueOnlySubMeshes.delete(mesh);
    return hasTranslucent ? "transparent" : "opaque";
  }
  /**
   * Rebuild the cached opaque-only submesh array for a mixed mesh.
   * Called when classification changes so the per-frame swap is allocation-free.
   * @param mesh - The mesh to rebuild for
   * @param translucentIndices - Set of materialIndex values that are translucent
   */
  _rebuildOpaqueOnlySubMeshes(mesh, translucentIndices) {
    if (mesh.subMeshes) {
      this._opaqueOnlySubMeshes.set(mesh, mesh.subMeshes.filter((sm) => !translucentIndices.has(sm.materialIndex)));
    }
  }
  _addMesh(mesh) {
    this._materialObservers[mesh.uniqueId] = mesh.onMaterialChangedObservable.add(this._onMeshMaterialChanged.bind(this));
    Tools.SetImmediate(() => {
      if (this._disposed) {
        return;
      }
      if (mesh.material) {
        const classification = this._classifyMeshMaterials(mesh);
        if (classification === "transparent") {
          if (this._transparentMeshesCache.indexOf(mesh) === -1) {
            this._transparentMeshesCache.push(mesh);
          }
        } else {
          if (this._opaqueMeshesCache.indexOf(mesh) === -1) {
            this._opaqueMeshesCache.push(mesh);
          }
        }
      }
    });
  }
  _removeMesh(mesh) {
    mesh.onMaterialChangedObservable.remove(this._materialObservers[mesh.uniqueId]);
    delete this._materialObservers[mesh.uniqueId];
    let idx = this._transparentMeshesCache.indexOf(mesh);
    if (idx !== -1) {
      this._transparentMeshesCache.splice(idx, 1);
    }
    idx = this._opaqueMeshesCache.indexOf(mesh);
    if (idx !== -1) {
      this._opaqueMeshesCache.splice(idx, 1);
    }
    this._translucentMaterialIndices.delete(mesh);
    this._opaqueOnlySubMeshes.delete(mesh);
  }
  _parseScene() {
    this._scene.meshes.forEach(this._addMesh.bind(this));
    this._newMeshObserver = this._scene.onNewMeshAddedObservable.add(this._addMesh.bind(this));
    this._removedMeshObserver = this._scene.onMeshRemovedObservable.add(this._removeMesh.bind(this));
  }
  // When one of the meshes in the scene has its material changed, make sure that it's in the correct cache list.
  _onMeshMaterialChanged(mesh) {
    const transparentIdx = this._transparentMeshesCache.indexOf(mesh);
    const opaqueIdx = this._opaqueMeshesCache.indexOf(mesh);
    const classification = this._classifyMeshMaterials(mesh);
    if (classification === "transparent") {
      if (opaqueIdx !== -1) {
        this._opaqueMeshesCache.splice(opaqueIdx, 1);
        this._transparentMeshesCache.push(mesh);
      } else if (transparentIdx === -1) {
        this._transparentMeshesCache.push(mesh);
      }
    } else {
      if (transparentIdx !== -1) {
        this._transparentMeshesCache.splice(transparentIdx, 1);
        this._opaqueMeshesCache.push(mesh);
      } else if (opaqueIdx === -1) {
        this._opaqueMeshesCache.push(mesh);
      }
    }
  }
  /**
   * @internal
   * Check if the opaque render target has not been disposed and can still be used.
   * @returns
   */
  _isRenderTargetValid() {
    return this._opaqueRenderTarget?.getInternalTexture() !== null;
  }
  /**
   * @internal
   * Setup the render targets according to the specified options.
   */
  _setupRenderTargets() {
    if (this._opaqueRenderTarget) {
      this._opaqueRenderTarget.dispose();
    }
    this._opaqueRenderTarget = new RenderTargetTexture("opaqueSceneTexture", this._options.renderSize, this._scene, this._options.generateMipmaps, void 0, this._options.renderTargetTextureType);
    this._opaqueRenderTarget.ignoreCameraViewport = true;
    this._opaqueRenderTarget.renderList = this._opaqueMeshesCache;
    this._opaqueRenderTarget.forceLayerMaskCheck = true;
    this._opaqueRenderTarget.clearColor = this._options.clearColor?.clone() ?? this._scene.clearColor.clone();
    this._opaqueRenderTarget.clearColor.a = 0;
    this._opaqueRenderTarget.gammaSpace = false;
    this._opaqueRenderTarget.lodGenerationScale = this._options.lodGenerationScale;
    this._opaqueRenderTarget.lodGenerationOffset = this._options.lodGenerationOffset;
    this._opaqueRenderTarget.samples = this._options.samples;
    this._opaqueRenderTarget.renderSprites = true;
    this._opaqueRenderTarget.renderParticles = true;
    this._opaqueRenderTarget.disableImageProcessing = true;
    let saveSceneEnvIntensity;
    this._opaqueRenderTarget.onBeforeBindObservable.add((opaqueRenderTarget) => {
      saveSceneEnvIntensity = this._scene.environmentIntensity;
      this._scene.environmentIntensity = 1;
      if (!this._options.clearColor) {
        this._scene.clearColor.toLinearSpaceToRef(opaqueRenderTarget.clearColor, this._scene.getEngine().useExactSrgbConversions);
      } else {
        opaqueRenderTarget.clearColor.copyFrom(this._options.clearColor);
      }
      opaqueRenderTarget.clearColor.a = 0;
      const tlEntries = this._opaqueOnlySubMeshes.entries();
      for (let tlEntry = tlEntries.next(); !tlEntry.done; tlEntry = tlEntries.next()) {
        const mesh = tlEntry.value[0];
        const opaqueOnly = tlEntry.value[1];
        if (mesh.subMeshes) {
          this._savedSubMeshes.set(mesh, mesh.subMeshes);
          mesh.subMeshes = opaqueOnly;
        }
      }
    });
    this._opaqueRenderTarget.onAfterUnbindObservable.add(() => {
      this._scene.environmentIntensity = saveSceneEnvIntensity;
      const savedEntries = this._savedSubMeshes.entries();
      for (let savedEntry = savedEntries.next(); !savedEntry.done; savedEntry = savedEntries.next()) {
        savedEntry.value[0].subMeshes = savedEntry.value[1];
      }
      this._savedSubMeshes.clear();
    });
    for (const mesh of this._transparentMeshesCache) {
      if (mesh.material) {
        this._classifyMeshMaterials(mesh);
      }
    }
    const mixedEntries = this._translucentMaterialIndices.entries();
    for (let mixedEntry = mixedEntries.next(); !mixedEntry.done; mixedEntry = mixedEntries.next()) {
      const mesh = mixedEntry.value[0];
      if (mesh.material) {
        this._classifyMeshMaterials(mesh);
      }
    }
  }
  /**
   * Dispose all the elements created by the Helper.
   */
  dispose() {
    this._disposed = true;
    this._newMeshObserver?.remove();
    this._removedMeshObserver?.remove();
    this._newMeshObserver = null;
    this._removedMeshObserver = null;
    const allTracked = [...this._transparentMeshesCache, ...this._opaqueMeshesCache];
    for (const mesh of allTracked) {
      const observer = this._materialObservers[mesh.uniqueId];
      if (observer) {
        observer.remove();
        delete this._materialObservers[mesh.uniqueId];
      }
    }
    for (const mesh of this._scene.meshes) {
      const observer = this._materialObservers[mesh.uniqueId];
      if (observer) {
        observer.remove();
        delete this._materialObservers[mesh.uniqueId];
      }
    }
    this._materialObservers = {};
    this._scene._transmissionHelper = void 0;
    if (this._opaqueRenderTarget) {
      this._opaqueRenderTarget.dispose();
      this._opaqueRenderTarget = null;
    }
    this._transparentMeshesCache = [];
    this._opaqueMeshesCache = [];
    this._translucentMaterialIndices.clear();
    this._opaqueOnlySubMeshes.clear();
    this._savedSubMeshes.clear();
  }
}
function ensureTransmissionHelper(loader, babylonMaterial) {
  if (loader.parent.dontUseTransmissionHelper) {
    return;
  }
  const scene = babylonMaterial.getScene();
  const existingHelper = scene._transmissionHelper;
  const helper = existingHelper ?? new TransmissionHelper({}, babylonMaterial.getScene());
  for (const impl of Array.from(loader._pbrMaterialImpls.values())) {
    helper.addMaterialImpl(impl);
  }
  if (existingHelper && !existingHelper._isRenderTargetValid()) {
    existingHelper._setupRenderTargets();
  }
}
const NAME$j = "KHR_materials_transmission";
class KHR_materials_transmission {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$j;
    this.order = 175;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$j);
    if (this.enabled) {
      loader.parent.transparencyAsCoverage = true;
    }
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadTransparentPropertiesAsync(extensionContext, material, babylonMaterial, extension));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/promise-function-async
  _loadTransparentPropertiesAsync(context, material, babylonMaterial, extension) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const transmissionWeight = extension.transmissionFactor !== void 0 ? extension.transmissionFactor : 0;
    if (transmissionWeight === 0 || !adapter) {
      return Promise.resolve();
    }
    adapter.configureTransmission();
    adapter.transmissionWeight = transmissionWeight;
    if (transmissionWeight > 0) {
      ensureTransmissionHelper(this._loader, babylonMaterial);
    }
    let texturePromise = Promise.resolve(null);
    if (extension.transmissionTexture) {
      extension.transmissionTexture.nonColorData = true;
      texturePromise = this._loader.loadTextureInfoAsync(`${context}/transmissionTexture`, extension.transmissionTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Transmission)`;
        adapter.transmissionWeightTexture = texture;
      });
    }
    return texturePromise.then(() => {
    });
  }
}
let _Registered$j = false;
function RegisterKHR_materials_transmission() {
  if (_Registered$j) {
    return;
  }
  _Registered$j = true;
  unregisterGLTFExtension(NAME$j);
  registerGLTFExtension(NAME$j, true, (loader) => new KHR_materials_transmission(loader));
}
RegisterKHR_materials_transmission();
const NAME$i = "KHR_materials_diffuse_transmission";
class KHR_materials_diffuse_transmission {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$i;
    this.order = 174;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$i);
    if (this.enabled) {
      loader.parent.transparencyAsCoverage = true;
    }
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadTranslucentPropertiesAsync(extensionContext, material, babylonMaterial, extension));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/promise-function-async
  _loadTranslucentPropertiesAsync(context, material, babylonMaterial, extension) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    adapter.configureSubsurface();
    adapter.subsurfaceWeight = extension.diffuseTransmissionFactor ?? 0;
    if (adapter.subsurfaceWeight > 0) {
      ensureTransmissionHelper(this._loader, babylonMaterial);
    }
    adapter.diffuseTransmissionTint = extension.diffuseTransmissionColorFactor !== void 0 ? Color3.FromArray(extension.diffuseTransmissionColorFactor) : Color3.White();
    const promises = new Array();
    if (extension.diffuseTransmissionTexture) {
      extension.diffuseTransmissionTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/diffuseTransmissionTexture`, extension.diffuseTransmissionTexture).then((texture) => {
        texture.name = `${babylonMaterial.name} (Diffuse Transmission)`;
        adapter.subsurfaceWeightTexture = texture;
      }));
    }
    if (extension.diffuseTransmissionColorTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/diffuseTransmissionColorTexture`, extension.diffuseTransmissionColorTexture).then((texture) => {
        texture.name = `${babylonMaterial.name} (Diffuse Transmission Color)`;
        adapter.diffuseTransmissionTintTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$i = false;
function RegisterKHR_materials_diffuse_transmission() {
  if (_Registered$i) {
    return;
  }
  _Registered$i = true;
  unregisterGLTFExtension(NAME$i);
  registerGLTFExtension(NAME$i, true, (loader) => new KHR_materials_diffuse_transmission(loader));
}
RegisterKHR_materials_diffuse_transmission();
const NAME$h = "KHR_materials_volume";
class KHR_materials_volume {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$h;
    this.order = 173;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$h);
    if (this.enabled) {
      this._loader._disableInstancedMesh++;
    }
  }
  /** @internal */
  dispose() {
    if (this.enabled) {
      this._loader._disableInstancedMesh--;
    }
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadVolumePropertiesAsync(extensionContext, material, babylonMaterial, extension));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadVolumePropertiesAsync(context, material, babylonMaterial, extension) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    if (adapter.transmissionWeight === 0 && adapter.subsurfaceWeight === 0 || !extension.thicknessFactor) {
      return Promise.resolve();
    }
    adapter.geometryThinWalled = false;
    const attenuationDistance = extension.attenuationDistance !== void 0 ? extension.attenuationDistance : Number.MAX_VALUE;
    const attenuationColor = extension.attenuationColor !== void 0 && extension.attenuationColor.length == 3 ? Color3.FromArray(extension.attenuationColor) : Color3.White();
    adapter.configureVolume();
    adapter.transmissionColor = attenuationColor;
    adapter.transmissionDepth = attenuationDistance;
    adapter.volumeThickness = extension.thicknessFactor ?? 0;
    const promises = new Array();
    if (extension.thicknessTexture) {
      extension.thicknessTexture.nonColorData = true;
      promises.push(this._loader.loadTextureInfoAsync(`${context}/thicknessTexture`, extension.thicknessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Thickness)`;
        adapter.volumeThicknessTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$h = false;
function RegisterKHR_materials_volume() {
  if (_Registered$h) {
    return;
  }
  _Registered$h = true;
  unregisterGLTFExtension(NAME$h);
  registerGLTFExtension(NAME$h, true, (loader) => new KHR_materials_volume(loader));
}
RegisterKHR_materials_volume();
const NAME$g = "KHR_materials_volume_scatter";
function multiScatterToSingleScatterAlbedo(multiScatter) {
  const multiScatterAlbedo = new Vector3(multiScatter.r, multiScatter.g, multiScatter.b);
  const s = new Vector3(4.09712, 4.09712, 4.09712);
  s.addInPlace(new Vector3(4.20863, 4.20863, 4.20863).multiplyInPlace(multiScatterAlbedo));
  const p = new Vector3(9.59217, 9.59217, 9.59217);
  p.addInPlace(new Vector3(41.6808, 41.6808, 41.6808).multiplyInPlace(multiScatterAlbedo));
  p.addInPlace(new Vector3(17.7126, 17.7126, 17.7126).multiplyInPlace(multiScatterAlbedo.multiply(multiScatterAlbedo)));
  s.subtractInPlace(new Vector3(Math.sqrt(p.x), Math.sqrt(p.y), Math.sqrt(p.z)));
  return new Vector3(1, 1, 1).subtract(s.multiply(s));
}
class KHR_materials_volume_scatter {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$g;
    this.order = 172;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$g);
    if (this.enabled) {
      this._loader._disableInstancedMesh++;
    }
  }
  /** @internal */
  dispose() {
    if (this.enabled) {
      this._loader._disableInstancedMesh--;
    }
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadVolumePropertiesAsync(extensionContext, material, babylonMaterial, extension));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadVolumePropertiesAsync(context, material, babylonMaterial, extension) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    if (adapter.transmissionWeight === 0 && adapter.subsurfaceWeight === 0 || adapter.geometryThinWalled) {
      return Promise.resolve();
    }
    const scatterColor = extension.multiscatterColorFactor !== void 0 && extension.multiscatterColorFactor.length == 3 ? Color3.FromArray(extension.multiscatterColorFactor) : Color3.Black();
    const scatterAnisotropy = extension.scatterAnisotropy !== void 0 ? extension.scatterAnisotropy : 0;
    let texturePromise = Promise.resolve(null);
    if (extension.multiscatterColorTexture) {
      extension.multiscatterColorTexture.nonColorData = true;
      texturePromise = this._loader.loadTextureInfoAsync(`${context}/multiscatterColorTexture`, extension.multiscatterColorTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Scatter Color)`;
        if (adapter.transmissionWeight > 0) {
          adapter.transmissionScatterTexture = texture;
        }
        if (adapter.subsurfaceWeight > 0) {
          adapter.subsurfaceColorTexture = texture;
        }
      });
    }
    const extinctionCoefficient = new Vector3(-Math.log(adapter.transmissionColor.r), -Math.log(adapter.transmissionColor.g), -Math.log(adapter.transmissionColor.b));
    extinctionCoefficient.scaleInPlace(1 / Math.max(adapter.transmissionDepth, 1e-6));
    if (adapter.transmissionWeight > 0) {
      const singleScatterAlbedo = multiScatterToSingleScatterAlbedo(scatterColor);
      const scatteringCoefficient = extinctionCoefficient.multiply(singleScatterAlbedo);
      scatteringCoefficient.scaleInPlace(adapter.transmissionDepth);
      adapter.transmissionScatter.set(scatteringCoefficient.x, scatteringCoefficient.y, scatteringCoefficient.z);
      adapter.transmissionScatterAnisotropy = scatterAnisotropy;
    }
    if (adapter.subsurfaceWeight > 0) {
      adapter.subsurfaceScatterAnisotropy = scatterAnisotropy;
      adapter.subsurfaceColor = scatterColor;
      const mfp = new Vector3(extinctionCoefficient.x !== 0 ? 1 / extinctionCoefficient.x : 1, extinctionCoefficient.y !== 0 ? 1 / extinctionCoefficient.y : 1, extinctionCoefficient.z !== 0 ? 1 / extinctionCoefficient.z : 1);
      adapter.subsurfaceRadius = Math.max(mfp.x, mfp.y, mfp.z);
      adapter.subsurfaceRadiusScale = new Color3(mfp.x / adapter.subsurfaceRadius, mfp.y / adapter.subsurfaceRadius, mfp.z / adapter.subsurfaceRadius);
    }
    return texturePromise.then(() => {
    });
  }
}
let _Registered$g = false;
function RegisterKHR_materials_volume_scatter() {
  if (_Registered$g) {
    return;
  }
  _Registered$g = true;
  unregisterGLTFExtension(NAME$g);
  registerGLTFExtension(NAME$g, true, (loader) => new KHR_materials_volume_scatter(loader));
}
RegisterKHR_materials_volume_scatter();
const NAME$f = "KHR_materials_dispersion";
class KHR_materials_dispersion {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$f;
    this.order = 174;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$f);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadDispersionPropertiesAsync(extensionContext, material, babylonMaterial, extension));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadDispersionPropertiesAsync(context, material, babylonMaterial, extension) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    if (adapter.transmissionWeight == 0 || !extension.dispersion) {
      return Promise.resolve();
    }
    adapter.transmissionDispersionAbbeNumber = 20;
    adapter.transmissionDispersionScale = extension.dispersion;
    return Promise.resolve();
  }
}
let _Registered$f = false;
function RegisterKHR_materials_dispersion() {
  if (_Registered$f) {
    return;
  }
  _Registered$f = true;
  unregisterGLTFExtension(NAME$f);
  registerGLTFExtension(NAME$f, true, (loader) => new KHR_materials_dispersion(loader));
}
RegisterKHR_materials_dispersion();
const NAME$e = "KHR_materials_diffuse_roughness";
class KHR_materials_diffuse_roughness {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$e;
    this.order = 190;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$e);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
      promises.push(this._loadDiffuseRoughnessPropertiesAsync(extensionContext, extension, babylonMaterial));
      return await Promise.all(promises).then(() => {
      });
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadDiffuseRoughnessPropertiesAsync(context, properties, babylonMaterial) {
    const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
    const promises = new Array();
    adapter.baseDiffuseRoughness = properties.diffuseRoughnessFactor ?? 0;
    if (properties.diffuseRoughnessTexture) {
      promises.push(this._loader.loadTextureInfoAsync(`${context}/diffuseRoughnessTexture`, properties.diffuseRoughnessTexture, (texture) => {
        texture.name = `${babylonMaterial.name} (Diffuse Roughness)`;
        adapter.baseDiffuseRoughnessTexture = texture;
      }));
    }
    return Promise.all(promises).then(() => {
    });
  }
}
let _Registered$e = false;
function RegisterKHR_materials_diffuse_roughness() {
  if (_Registered$e) {
    return;
  }
  _Registered$e = true;
  unregisterGLTFExtension(NAME$e);
  registerGLTFExtension(NAME$e, true, (loader) => new KHR_materials_diffuse_roughness(loader));
}
RegisterKHR_materials_diffuse_roughness();
const NAME$d = "KHR_mesh_quantization";
class KHR_mesh_quantization {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$d;
    this.enabled = loader.isExtensionUsed(NAME$d);
  }
  /** @internal */
  dispose() {
  }
}
let _Registered$d = false;
function RegisterKHR_mesh_quantization() {
  if (_Registered$d) {
    return;
  }
  _Registered$d = true;
  unregisterGLTFExtension(NAME$d);
  registerGLTFExtension(NAME$d, true, (loader) => new KHR_mesh_quantization(loader));
}
RegisterKHR_mesh_quantization();
const NAME$c = "KHR_texture_basisu";
class KHR_texture_basisu {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$c;
    this._loader = loader;
    this.enabled = loader.isExtensionUsed(NAME$c);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadTextureAsync(context, texture, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, texture, this.name, async (extensionContext, extension) => {
      const sampler = texture.sampler == void 0 ? GLTFLoader2.DefaultSampler : ArrayItem.Get(`${context}/sampler`, this._loader.gltf.samplers, texture.sampler);
      const image = ArrayItem.Get(`${extensionContext}/source`, this._loader.gltf.images, extension.source);
      return await this._loader._createTextureAsync(context, sampler, image, (babylonTexture) => {
        assign(babylonTexture);
      }, texture._textureInfo.nonColorData ? { useRGBAIfASTCBC7NotAvailableWhenUASTC: true } : void 0, !texture._textureInfo.nonColorData);
    });
  }
}
let _Registered$c = false;
function RegisterKHR_texture_basisu() {
  if (_Registered$c) {
    return;
  }
  _Registered$c = true;
  unregisterGLTFExtension(NAME$c);
  registerGLTFExtension(NAME$c, true, (loader) => new KHR_texture_basisu(loader));
}
RegisterKHR_texture_basisu();
const NAME$b = "KHR_texture_transform";
class KHR_texture_transform {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$b;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$b);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadTextureInfoAsync(context, textureInfo, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, textureInfo, this.name, async (extensionContext, extension) => {
      return await this._loader.loadTextureInfoAsync(context, textureInfo, (babylonTexture) => {
        if (!(babylonTexture instanceof Texture)) {
          throw new Error(`${extensionContext}: Texture type not supported`);
        }
        if (extension.offset) {
          babylonTexture.uOffset = extension.offset[0];
          babylonTexture.vOffset = extension.offset[1];
        }
        babylonTexture.uRotationCenter = 0;
        babylonTexture.vRotationCenter = 0;
        if (extension.rotation) {
          babylonTexture.wAng = -extension.rotation;
        }
        if (extension.scale) {
          babylonTexture.uScale = extension.scale[0];
          babylonTexture.vScale = extension.scale[1];
        }
        if (extension.texCoord != void 0) {
          babylonTexture.coordinatesIndex = extension.texCoord;
        }
        assign(babylonTexture);
      });
    });
  }
}
let _Registered$b = false;
function RegisterKHR_texture_transform() {
  if (_Registered$b) {
    return;
  }
  _Registered$b = true;
  unregisterGLTFExtension(NAME$b);
  registerGLTFExtension(NAME$b, true, (loader) => new KHR_texture_transform(loader));
}
RegisterKHR_texture_transform();
const NAME$a = "KHR_xmp_json_ld";
class KHR_xmp_json_ld {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$a;
    this.order = 100;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$a);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * Called after the loader state changes to LOADING.
   */
  onLoading() {
    if (this._loader.rootBabylonMesh === null) {
      return;
    }
    const xmpGltf = this._loader.gltf.extensions?.KHR_xmp_json_ld;
    const xmpNode = this._loader.gltf.asset?.extensions?.KHR_xmp_json_ld;
    if (xmpGltf && xmpNode) {
      const packet = +xmpNode.packet;
      if (xmpGltf.packets && packet < xmpGltf.packets.length) {
        this._loader.rootBabylonMesh.metadata = this._loader.rootBabylonMesh.metadata || {};
        this._loader.rootBabylonMesh.metadata.xmp = xmpGltf.packets[packet];
      }
    }
  }
}
let _Registered$a = false;
function RegisterKHR_xmp_json_ld() {
  if (_Registered$a) {
    return;
  }
  _Registered$a = true;
  unregisterGLTFExtension(NAME$a);
  registerGLTFExtension(NAME$a, true, (loader) => new KHR_xmp_json_ld(loader));
}
RegisterKHR_xmp_json_ld();
const NAME$9 = "KHR_animation_pointer";
class KHR_animation_pointer {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$9;
    this._loader = loader;
    this._pathToObjectConverter = GetPathToObjectConverter(this._loader.gltf);
  }
  /**
   * Defines whether this extension is enabled.
   */
  get enabled() {
    return this._loader.isExtensionUsed(NAME$9);
  }
  /** @internal */
  dispose() {
    this._loader = null;
    delete this._pathToObjectConverter;
  }
  /**
   * Loads a glTF animation channel.
   * @param context The context when loading the asset
   * @param animationContext The context of the animation when loading the asset
   * @param animation The glTF animation property
   * @param channel The glTF animation channel property
   * @param onLoad Called for each animation loaded
   * @returns A void promise that resolves when the load is complete or null if not handled
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadAnimationChannelAsync(context, animationContext, animation, channel, onLoad) {
    const extension = channel.target.extensions?.KHR_animation_pointer;
    if (!extension || !this._pathToObjectConverter) {
      return null;
    }
    if (channel.target.path !== "pointer") {
      Logger.Warn(`${context}/target/path: Value (${channel.target.path}) must be (${"pointer"}) when using the ${this.name} extension`);
    }
    if (channel.target.node != void 0) {
      Logger.Warn(`${context}/target/node: Value (${channel.target.node}) must not be present when using the ${this.name} extension`);
    }
    const extensionContext = `${context}/extensions/${this.name}`;
    const pointer = extension.pointer;
    if (!pointer) {
      throw new Error(`${extensionContext}: Pointer is missing`);
    }
    try {
      const obj = this._pathToObjectConverter.convert(pointer);
      if (!obj.info.interpolation) {
        throw new Error(`${extensionContext}/pointer: Interpolation is missing`);
      }
      return this._loader._loadAnimationChannelFromTargetInfoAsync(context, animationContext, animation, channel, {
        object: obj.object,
        info: obj.info.interpolation
      }, onLoad);
    } catch (e) {
      Logger.Warn(`${extensionContext}/pointer: Invalid pointer (${pointer}) skipped`);
      return null;
    }
  }
}
let _Registered$9 = false;
function RegisterKHR_animation_pointer() {
  if (_Registered$9) {
    return;
  }
  _Registered$9 = true;
  unregisterGLTFExtension(NAME$9);
  registerGLTFExtension(NAME$9, true, (loader) => new KHR_animation_pointer(loader));
}
function getColor3(_target, source, offset, scale) {
  return Color3.FromArray(source, offset).scale(scale);
}
function getAlpha(_target, source, offset, scale) {
  return source[offset + 3] * scale;
}
function getFloat(_target, source, offset, scale) {
  return source[offset] * scale;
}
function getMinusFloat(_target, source, offset, scale) {
  return -source[offset] * scale;
}
function getNextFloat(_target, source, offset, scale) {
  return source[offset + 1] * scale;
}
function getFloatBy2(_target, source, offset, scale) {
  return source[offset] * scale * 2;
}
function getTextureTransformTree(textureName) {
  return {
    scale: [
      new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, `${textureName}.uScale`, getFloat, () => 2),
      new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, `${textureName}.vScale`, getNextFloat, () => 2)
    ],
    offset: [
      new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, `${textureName}.uOffset`, getFloat, () => 2),
      new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, `${textureName}.vOffset`, getNextFloat, () => 2)
    ],
    rotation: [new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, `${textureName}.wAng`, getMinusFloat, () => 1)]
  };
}
class CameraAnimationPropertyInfo extends AnimationPropertyInfo {
  /** @internal */
  buildAnimations(target, name, fps, keys) {
    return [{ babylonAnimatable: target._babylonCamera, babylonAnimation: this._buildAnimation(name, fps, keys) }];
  }
}
class MaterialAnimationPropertyInfo extends AnimationPropertyInfo {
  /** @internal */
  buildAnimations(target, name, fps, keys) {
    const babylonAnimations = [];
    for (const fillMode in target._data) {
      babylonAnimations.push({
        babylonAnimatable: target._data[fillMode].babylonMaterial,
        babylonAnimation: this._buildAnimation(name, fps, keys)
      });
    }
    return babylonAnimations;
  }
}
class LightAnimationPropertyInfo extends AnimationPropertyInfo {
  /** @internal */
  buildAnimations(target, name, fps, keys) {
    return [{ babylonAnimatable: target._babylonLight, babylonAnimation: this._buildAnimation(name, fps, keys) }];
  }
}
class MeshAnimationPropertyInfo extends AnimationPropertyInfo {
  /** @internal */
  buildAnimations(target, name, fps, keys) {
    return target._primitiveBabylonMeshes ? target._primitiveBabylonMeshes.map((mesh) => ({ babylonAnimatable: mesh, babylonAnimation: this._buildAnimation(name, fps, keys) })) : [];
  }
}
SetInterpolationForKey("/cameras/{}/orthographic/xmag", [
  new CameraAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "orthoLeft", getMinusFloat, () => 1),
  new CameraAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "orthoRight", getNextFloat, () => 1)
]);
SetInterpolationForKey("/cameras/{}/orthographic/ymag", [
  new CameraAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "orthoBottom", getMinusFloat, () => 1),
  new CameraAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "orthoTop", getNextFloat, () => 1)
]);
SetInterpolationForKey("/cameras/{}/orthographic/zfar", [new CameraAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "maxZ", getFloat, () => 1)]);
SetInterpolationForKey("/cameras/{}/orthographic/znear", [new CameraAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "minZ", getFloat, () => 1)]);
SetInterpolationForKey("/cameras/{}/perspective/yfov", [new CameraAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "fov", getFloat, () => 1)]);
SetInterpolationForKey("/cameras/{}/perspective/zfar", [new CameraAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "maxZ", getFloat, () => 1)]);
SetInterpolationForKey("/cameras/{}/perspective/znear", [new CameraAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "minZ", getFloat, () => 1)]);
SetInterpolationForKey("/materials/{}/pbrMetallicRoughness/baseColorFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_COLOR3, "albedoColor", getColor3, () => 4),
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "alpha", getAlpha, () => 4)
]);
SetInterpolationForKey("/materials/{}/pbrMetallicRoughness/metallicFactor", [new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "metallic", getFloat, () => 1)]);
SetInterpolationForKey("/materials/{}/pbrMetallicRoughness/metallicFactor", [new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "roughness", getFloat, () => 1)]);
const baseColorTextureInterpolation = getTextureTransformTree("albedoTexture");
SetInterpolationForKey("/materials/{}/pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/scale", baseColorTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/offset", baseColorTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/rotation", baseColorTextureInterpolation.rotation);
const metallicRoughnessTextureInterpolation = getTextureTransformTree("metallicTexture");
SetInterpolationForKey("//materials/{}/pbrMetallicRoughness/metallicRoughnessTexture/scale", metallicRoughnessTextureInterpolation.scale);
SetInterpolationForKey("//materials/{}/pbrMetallicRoughness/metallicRoughnessTexture/offset", metallicRoughnessTextureInterpolation.offset);
SetInterpolationForKey("//materials/{}/pbrMetallicRoughness/metallicRoughnessTexture/rotation", metallicRoughnessTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/emissiveFactor", [new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_COLOR3, "emissiveColor", getColor3, () => 3)]);
const normalTextureInterpolation = getTextureTransformTree("bumpTexture");
SetInterpolationForKey("/materials/{}/normalTexture/scale", [new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "bumpTexture.level", getFloat, () => 1)]);
SetInterpolationForKey("/materials/{}/normalTexture/extensions/KHR_texture_transform/scale", normalTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/normalTexture/extensions/KHR_texture_transform/offset", normalTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/normalTexture/extensions/KHR_texture_transform/rotation", normalTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/occlusionTexture/strength", [new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "ambientTextureStrength", getFloat, () => 1)]);
const occlusionTextureInterpolation = getTextureTransformTree("ambientTexture");
SetInterpolationForKey("/materials/{}/occlusionTexture/extensions/KHR_texture_transform/scale", occlusionTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/occlusionTexture/extensions/KHR_texture_transform/offset", occlusionTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/occlusionTexture/extensions/KHR_texture_transform/rotation", occlusionTextureInterpolation.rotation);
const emissiveTextureInterpolation = getTextureTransformTree("emissiveTexture");
SetInterpolationForKey("/materials/{}/emissiveTexture/extensions/KHR_texture_transform/scale", emissiveTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/emissiveTexture/extensions/KHR_texture_transform/offset", emissiveTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/emissiveTexture/extensions/KHR_texture_transform/rotation", emissiveTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_anisotropy/anisotropyStrength", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "anisotropy.intensity", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_anisotropy/anisotropyRotation", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "anisotropy.angle", getFloat, () => 1)
]);
const anisotropyTextureInterpolation = getTextureTransformTree("anisotropy.texture");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_anisotropy/anisotropyTexture/extensions/KHR_texture_transform/scale", anisotropyTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_anisotropy/anisotropyTexture/extensions/KHR_texture_transform/offset", anisotropyTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_anisotropy/anisotropyTexture/extensions/KHR_texture_transform/rotation", anisotropyTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "clearCoat.intensity", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatRoughnessFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "clearCoat.roughness", getFloat, () => 1)
]);
const clearcoatTextureInterpolation = getTextureTransformTree("clearCoat.texture");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatTexture/extensions/KHR_texture_transform/scale", clearcoatTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatTexture/extensions/KHR_texture_transform/offset", clearcoatTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatTexture/extensions/KHR_texture_transform/rotation", clearcoatTextureInterpolation.rotation);
const clearcoatNormalTextureInterpolation = getTextureTransformTree("clearCoat.bumpTexture");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatNormalTexture/scale", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "clearCoat.bumpTexture.level", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatNormalTexture/extensions/KHR_texture_transform/scale", clearcoatNormalTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatNormalTexture/extensions/KHR_texture_transform/offset", clearcoatNormalTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatNormalTexture/extensions/KHR_texture_transform/rotation", clearcoatNormalTextureInterpolation.rotation);
const clearcoatRoughnessTextureInterpolation = getTextureTransformTree("clearCoat.textureRoughness");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatRoughnessTexture/extensions/KHR_texture_transform/scale", clearcoatRoughnessTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatRoughnessTexture/extensions/KHR_texture_transform/offset", clearcoatRoughnessTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_clearcoat/clearcoatRoughnessTexture/extensions/KHR_texture_transform/rotation", clearcoatRoughnessTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_dispersion/dispersionFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "subSurface.dispersion", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_emissive_strength/emissiveStrength", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "emissiveIntensity", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_ior/ior", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "indexOfRefraction", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_iridescence/iridescenceFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "iridescence.intensity", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_iridescence/iridescenceIor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "iridescence.indexOfRefraction", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_iridescence/iridescenceThicknessMinimum", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "iridescence.minimumThickness", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_iridescence/iridescenceThicknessMaximum", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "iridescence.maximumThickness", getFloat, () => 1)
]);
const iridescenceTextureInterpolation = getTextureTransformTree("iridescence.texture");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_iridescence/iridescenceTexture/extensions/KHR_texture_transform/scale", iridescenceTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_iridescence/iridescenceTexture/extensions/KHR_texture_transform/offset", iridescenceTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_iridescence/iridescenceTexture/extensions/KHR_texture_transform/rotation", iridescenceTextureInterpolation.rotation);
const iridescenceThicknessTextureInterpolation = getTextureTransformTree("iridescence.thicknessTexture");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_iridescence/iridescenceThicknessTexture/extensions/KHR_texture_transform/scale", iridescenceThicknessTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_iridescence/iridescenceThicknessTexture/extensions/KHR_texture_transform/offset", iridescenceThicknessTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_iridescence/iridescenceThicknessTexture/extensions/KHR_texture_transform/rotation", iridescenceThicknessTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_sheen/sheenColorFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_COLOR3, "sheen.color", getColor3, () => 3)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_sheen/sheenRoughnessFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "sheen.roughness", getFloat, () => 1)
]);
const sheenTextureInterpolation = getTextureTransformTree("sheen.texture");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_sheen/sheenColorTexture/extensions/KHR_texture_transform/scale", sheenTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_sheen/sheenColorTexture/extensions/KHR_texture_transform/offset", sheenTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_sheen/sheenColorTexture/extensions/KHR_texture_transform/rotation", sheenTextureInterpolation.rotation);
const sheenRoughnessTextureInterpolation = getTextureTransformTree("sheen.textureRoughness");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_sheen/sheenRoughnessTexture/extensions/KHR_texture_transform/scale", sheenRoughnessTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_sheen/sheenRoughnessTexture/extensions/KHR_texture_transform/offset", sheenRoughnessTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_sheen/sheenRoughnessTexture/extensions/KHR_texture_transform/rotation", sheenRoughnessTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_specular/specularFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "metallicF0Factor", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_specular/specularColorFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_COLOR3, "metallicReflectanceColor", getColor3, () => 3)
]);
const specularTextureInterpolation = getTextureTransformTree("metallicReflectanceTexture");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_specular/specularTexture/extensions/KHR_texture_transform/scale", specularTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_specular/specularTexture/extensions/KHR_texture_transform/offset", specularTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_specular/specularTexture/extensions/KHR_texture_transform/rotation", specularTextureInterpolation.rotation);
const specularColorTextureInterpolation = getTextureTransformTree("reflectanceTexture");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_specular/specularColorTexture/extensions/KHR_texture_transform/scale", specularColorTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_specular/specularColorTexture/extensions/KHR_texture_transform/offset", specularColorTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_specular/specularColorTexture/extensions/KHR_texture_transform/rotation", specularColorTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_transmission/transmissionFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "subSurface.refractionIntensity", getFloat, () => 1)
]);
const transmissionTextureInterpolation = getTextureTransformTree("subSurface.refractionIntensityTexture");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_transmission/transmissionTexture/extensions/KHR_texture_transform/scale", transmissionTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_transmission/transmissionTexture/extensions/KHR_texture_transform/offset", transmissionTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_transmission/transmissionTexture/extensions/KHR_texture_transform/rotation", transmissionTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_volume/attenuationColor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_COLOR3, "subSurface.tintColor", getColor3, () => 3)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_volume/attenuationDistance", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "subSurface.tintColorAtDistance", getFloat, () => 1)
]);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_volume/thicknessFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "subSurface.maximumThickness", getFloat, () => 1)
]);
const thicknessTextureInterpolation = getTextureTransformTree("subSurface.thicknessTexture");
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_volume/thicknessTexture/extensions/KHR_texture_transform/scale", thicknessTextureInterpolation.scale);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_volume/thicknessTexture/extensions/KHR_texture_transform/offset", thicknessTextureInterpolation.offset);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_volume/thicknessTexture/extensions/KHR_texture_transform/rotation", thicknessTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_diffuse_transmission/diffuseTransmissionFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "subSurface.translucencyIntensity", getFloat, () => 1)
]);
const diffuseTransmissionTextureInterpolation = getTextureTransformTree("subSurface.translucencyIntensityTexture");
SetInterpolationForKey("materials/{}/extensions/KHR_materials_diffuse_transmission/diffuseTransmissionTexture/extensions/KHR_texture_transform/scale", diffuseTransmissionTextureInterpolation.scale);
SetInterpolationForKey("materials/{}/extensions/KHR_materials_diffuse_transmission/diffuseTransmissionTexture/extensions/KHR_texture_transform/offset", diffuseTransmissionTextureInterpolation.offset);
SetInterpolationForKey("materials/{}/extensions/KHR_materials_diffuse_transmission/diffuseTransmissionTexture/extensions/KHR_texture_transform/rotation", diffuseTransmissionTextureInterpolation.rotation);
SetInterpolationForKey("/materials/{}/extensions/KHR_materials_diffuse_transmission/diffuseTransmissionColorFactor", [
  new MaterialAnimationPropertyInfo(Animation.ANIMATIONTYPE_COLOR3, "subSurface.translucencyColor", getColor3, () => 3)
]);
const diffuseTransmissionColorTextureInterpolation = getTextureTransformTree("subSurface.translucencyColorTexture");
SetInterpolationForKey("materials/{}/extensions/KHR_materials_diffuse_transmission/diffuseTransmissionColorTexture/extensions/KHR_texture_transform/scale", diffuseTransmissionColorTextureInterpolation.scale);
SetInterpolationForKey("materials/{}/extensions/KHR_materials_diffuse_transmission/diffuseTransmissionColorTexture/extensions/KHR_texture_transform/offset", diffuseTransmissionColorTextureInterpolation.offset);
SetInterpolationForKey("materials/{}/extensions/KHR_materials_diffuse_transmission/diffuseTransmissionColorTexture/extensions/KHR_texture_transform/rotation", diffuseTransmissionColorTextureInterpolation.rotation);
SetInterpolationForKey("/extensions/KHR_lights_punctual/lights/{}/color", [new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_COLOR3, "diffuse", getColor3, () => 3)]);
SetInterpolationForKey("/extensions/KHR_lights_punctual/lights/{}/intensity", [new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "intensity", getFloat, () => 1)]);
SetInterpolationForKey("/extensions/KHR_lights_punctual/lights/{}/range", [new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "range", getFloat, () => 1)]);
SetInterpolationForKey("/extensions/KHR_lights_punctual/lights/{}/spot/innerConeAngle", [
  new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "innerAngle", getFloatBy2, () => 1)
]);
SetInterpolationForKey("/extensions/KHR_lights_punctual/lights/{}/spot/outerConeAngle", [
  new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "angle", getFloatBy2, () => 1)
]);
SetInterpolationForKey("/extensions/EXT_lights_area/lights/{}/color", [new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_COLOR3, "diffuse", getColor3, () => 3)]);
SetInterpolationForKey("/extensions/EXT_lights_area/lights/{}/intensity", [new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "intensity", getFloat, () => 1)]);
SetInterpolationForKey("/extensions/EXT_lights_area/lights/{}/size", [new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "radius", getFloat, () => 1)]);
SetInterpolationForKey("/extensions/EXT_lights_area/lights/{}/rect/aspect", [new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "radius", getFloat, () => 1)]);
SetInterpolationForKey("/nodes/{}/extensions/EXT_lights_ies/color", [new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_COLOR3, "diffuse", getColor3, () => 3)]);
SetInterpolationForKey("/nodes/{}/extensions/EXT_lights_ies/multiplier", [new LightAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "intensity", getFloat, () => 1)]);
SetInterpolationForKey("/nodes/{}/extensions/KHR_node_visibility/visible", [new MeshAnimationPropertyInfo(Animation.ANIMATIONTYPE_FLOAT, "isVisible", getFloat, () => 1)]);
RegisterKHR_animation_pointer();
const NAME$8 = "MSFT_audio_emitter";
class MSFT_audio_emitter {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$8;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$8);
  }
  /** @internal */
  dispose() {
    this._loader = null;
    this._clips = null;
    this._emitters = null;
  }
  /** @internal */
  onLoading() {
    const extensions = this._loader.gltf.extensions;
    if (extensions && extensions[this.name]) {
      const extension = extensions[this.name];
      this._clips = extension.clips;
      this._emitters = extension.emitters;
      ArrayItem.Assign(this._clips);
      ArrayItem.Assign(this._emitters);
    }
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadSceneAsync(context, scene) {
    return GLTFLoader2.LoadExtensionAsync(context, scene, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadSceneAsync(context, scene));
      for (const emitterIndex of extension.emitters) {
        const emitter = ArrayItem.Get(`${extensionContext}/emitters`, this._emitters, emitterIndex);
        if (emitter.refDistance != void 0 || emitter.maxDistance != void 0 || emitter.rolloffFactor != void 0 || emitter.distanceModel != void 0 || emitter.innerAngle != void 0 || emitter.outerAngle != void 0) {
          throw new Error(`${extensionContext}: Direction or Distance properties are not allowed on emitters attached to a scene`);
        }
        promises.push(this._loadEmitterAsync(`${extensionContext}/emitters/${emitter.index}`, emitter));
      }
      await Promise.all(promises);
    });
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadNodeAsync(context, node, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, node, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      const babylonMesh = await this._loader.loadNodeAsync(extensionContext, node, (babylonMesh2) => {
        for (const emitterIndex of extension.emitters) {
          const emitter = ArrayItem.Get(`${extensionContext}/emitters`, this._emitters, emitterIndex);
          promises.push(
            // eslint-disable-next-line github/no-then
            this._loadEmitterAsync(`${extensionContext}/emitters/${emitter.index}`, emitter).then(() => {
              for (const sound of emitter._babylonSounds) {
                sound.attachToMesh(babylonMesh2);
                if (emitter.innerAngle != void 0 || emitter.outerAngle != void 0) {
                  sound.setLocalDirectionToMesh(Vector3.Forward());
                  sound.setDirectionalCone(2 * Tools.ToDegrees(emitter.innerAngle == void 0 ? Math.PI : emitter.innerAngle), 2 * Tools.ToDegrees(emitter.outerAngle == void 0 ? Math.PI : emitter.outerAngle), 0);
                }
              }
            })
          );
        }
        assign(babylonMesh2);
      });
      await Promise.all(promises);
      return babylonMesh;
    });
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadAnimationAsync(context, animation) {
    return GLTFLoader2.LoadExtensionAsync(context, animation, this.name, async (extensionContext, extension) => {
      const babylonAnimationGroup = await this._loader.loadAnimationAsync(context, animation);
      const promises = new Array();
      ArrayItem.Assign(extension.events);
      for (const event of extension.events) {
        promises.push(this._loadAnimationEventAsync(`${extensionContext}/events/${event.index}`, context, animation, event, babylonAnimationGroup));
      }
      await Promise.all(promises);
      return babylonAnimationGroup;
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadClipAsync(context, clip) {
    if (clip._objectURL) {
      return clip._objectURL;
    }
    let promise;
    if (clip.uri) {
      promise = this._loader.loadUriAsync(context, clip, clip.uri);
    } else {
      const bufferView = ArrayItem.Get(`${context}/bufferView`, this._loader.gltf.bufferViews, clip.bufferView);
      promise = this._loader.loadBufferViewAsync(`/bufferViews/${bufferView.index}`, bufferView);
    }
    clip._objectURL = promise.then((data) => {
      const buffer = GetBlobBufferSource(data);
      return URL.createObjectURL(new Blob([buffer], { type: clip.mimeType }));
    });
    return clip._objectURL;
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadEmitterAsync(context, emitter) {
    emitter._babylonSounds = emitter._babylonSounds || [];
    if (!emitter._babylonData) {
      const clipPromises = new Array();
      const name = emitter.name || `emitter${emitter.index}`;
      const options = {
        loop: false,
        autoplay: false,
        volume: emitter.volume == void 0 ? 1 : emitter.volume
      };
      for (let i = 0; i < emitter.clips.length; i++) {
        const clipContext = `/extensions/${this.name}/clips`;
        const clip = ArrayItem.Get(clipContext, this._clips, emitter.clips[i].clip);
        clipPromises.push(
          // eslint-disable-next-line github/no-then
          this._loadClipAsync(`${clipContext}/${emitter.clips[i].clip}`, clip).then((objectURL) => {
            const sound = emitter._babylonSounds[i] = new Sound(name, objectURL, this._loader.babylonScene, null, options);
            sound.refDistance = emitter.refDistance || 1;
            sound.maxDistance = emitter.maxDistance || 256;
            sound.rolloffFactor = emitter.rolloffFactor || 1;
            sound.distanceModel = emitter.distanceModel || "exponential";
          })
        );
      }
      const promise = Promise.all(clipPromises).then(() => {
        const weights = emitter.clips.map((clip) => {
          return clip.weight || 1;
        });
        const weightedSound = new WeightedSound(emitter.loop || false, emitter._babylonSounds, weights);
        if (emitter.innerAngle) {
          weightedSound.directionalConeInnerAngle = 2 * Tools.ToDegrees(emitter.innerAngle);
        }
        if (emitter.outerAngle) {
          weightedSound.directionalConeOuterAngle = 2 * Tools.ToDegrees(emitter.outerAngle);
        }
        if (emitter.volume) {
          weightedSound.volume = emitter.volume;
        }
        emitter._babylonData.sound = weightedSound;
      });
      emitter._babylonData = {
        loaded: promise
      };
    }
    return emitter._babylonData.loaded;
  }
  _getEventAction(context, sound, action, time, startOffset) {
    switch (action) {
      case "play": {
        return (currentFrame) => {
          const frameOffset = (startOffset || 0) + (currentFrame - time);
          sound.play(frameOffset);
        };
      }
      case "stop": {
        return () => {
          sound.stop();
        };
      }
      case "pause": {
        return () => {
          sound.pause();
        };
      }
      default: {
        throw new Error(`${context}: Unsupported action ${action}`);
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadAnimationEventAsync(context, animationContext, animation, event, babylonAnimationGroup) {
    if (babylonAnimationGroup.targetedAnimations.length == 0) {
      return Promise.resolve();
    }
    const babylonAnimation = babylonAnimationGroup.targetedAnimations[0];
    const emitterIndex = event.emitter;
    const emitter = ArrayItem.Get(`/extensions/${this.name}/emitters`, this._emitters, emitterIndex);
    return this._loadEmitterAsync(context, emitter).then(() => {
      const sound = emitter._babylonData.sound;
      if (sound) {
        const babylonAnimationEvent = new AnimationEvent(event.time, this._getEventAction(context, sound, event.action, event.time, event.startOffset));
        babylonAnimation.animation.addEvent(babylonAnimationEvent);
        babylonAnimationGroup.onAnimationGroupEndObservable.add(() => {
          sound.stop();
        });
        babylonAnimationGroup.onAnimationGroupPauseObservable.add(() => {
          sound.pause();
        });
      }
    });
  }
}
let _Registered$8 = false;
function RegisterMSFT_audio_emitter() {
  if (_Registered$8) {
    return;
  }
  _Registered$8 = true;
  unregisterGLTFExtension(NAME$8);
  registerGLTFExtension(NAME$8, true, (loader) => new MSFT_audio_emitter(loader));
}
RegisterMSFT_audio_emitter();
const NAME$7 = "MSFT_lod";
class MSFT_lod {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$7;
    this.order = 100;
    this.maxLODsToLoad = 10;
    this.onNodeLODsLoadedObservable = new Observable();
    this.onMaterialLODsLoadedObservable = new Observable();
    this._bufferLODs = new Array();
    this._nodeIndexLOD = null;
    this._nodeSignalLODs = new Array();
    this._nodePromiseLODs = new Array();
    this._nodeBufferLODs = new Array();
    this._materialIndexLOD = null;
    this._materialSignalLODs = new Array();
    this._materialPromiseLODs = new Array();
    this._materialBufferLODs = new Array();
    this._loader = loader;
    this.maxLODsToLoad = this._loader.parent.extensionOptions[NAME$7]?.maxLODsToLoad ?? this.maxLODsToLoad;
    this.enabled = this._loader.isExtensionUsed(NAME$7);
  }
  /** @internal */
  dispose() {
    this._loader = null;
    this._nodeIndexLOD = null;
    this._nodeSignalLODs.length = 0;
    this._nodePromiseLODs.length = 0;
    this._nodeBufferLODs.length = 0;
    this._materialIndexLOD = null;
    this._materialSignalLODs.length = 0;
    this._materialPromiseLODs.length = 0;
    this._materialBufferLODs.length = 0;
    this.onMaterialLODsLoadedObservable.clear();
    this.onNodeLODsLoadedObservable.clear();
  }
  /** @internal */
  onReady() {
    for (let indexLOD = 0; indexLOD < this._nodePromiseLODs.length; indexLOD++) {
      const promise = Promise.all(this._nodePromiseLODs[indexLOD]).then(() => {
        if (indexLOD !== 0) {
          this._loader.endPerformanceCounter(`Node LOD ${indexLOD}`);
          this._loader.log(`Loaded node LOD ${indexLOD}`);
        }
        this.onNodeLODsLoadedObservable.notifyObservers(indexLOD);
        if (indexLOD !== this._nodePromiseLODs.length - 1) {
          this._loader.startPerformanceCounter(`Node LOD ${indexLOD + 1}`);
          this._loadBufferLOD(this._nodeBufferLODs, indexLOD + 1);
          if (this._nodeSignalLODs[indexLOD]) {
            this._nodeSignalLODs[indexLOD].resolve();
          }
        }
      });
      this._loader._completePromises.push(promise);
    }
    for (let indexLOD = 0; indexLOD < this._materialPromiseLODs.length; indexLOD++) {
      const promise = Promise.all(this._materialPromiseLODs[indexLOD]).then(() => {
        if (indexLOD !== 0) {
          this._loader.endPerformanceCounter(`Material LOD ${indexLOD}`);
          this._loader.log(`Loaded material LOD ${indexLOD}`);
        }
        this.onMaterialLODsLoadedObservable.notifyObservers(indexLOD);
        if (indexLOD !== this._materialPromiseLODs.length - 1) {
          this._loader.startPerformanceCounter(`Material LOD ${indexLOD + 1}`);
          this._loadBufferLOD(this._materialBufferLODs, indexLOD + 1);
          if (this._materialSignalLODs[indexLOD]) {
            this._materialSignalLODs[indexLOD].resolve();
          }
        }
      });
      this._loader._completePromises.push(promise);
    }
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadSceneAsync(context, scene) {
    const promise = this._loader.loadSceneAsync(context, scene);
    this._loadBufferLOD(this._bufferLODs, 0);
    return promise;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadNodeAsync(context, node, assign) {
    return GLTFLoader2.LoadExtensionAsync(context, node, this.name, async (extensionContext, extension) => {
      let firstPromise;
      const nodeLODs = this._getLODs(extensionContext, node, this._loader.gltf.nodes, extension.ids);
      this._loader.logOpen(`${extensionContext}`);
      for (let indexLOD = 0; indexLOD < nodeLODs.length; indexLOD++) {
        const nodeLOD = nodeLODs[indexLOD];
        if (indexLOD !== 0) {
          this._nodeIndexLOD = indexLOD;
          this._nodeSignalLODs[indexLOD] = this._nodeSignalLODs[indexLOD] || new Deferred();
        }
        const assignWrap = (babylonTransformNode) => {
          assign(babylonTransformNode);
          babylonTransformNode.setEnabled(false);
        };
        const promise = this._loader.loadNodeAsync(`/nodes/${nodeLOD.index}`, nodeLOD, assignWrap).then((babylonMesh) => {
          if (indexLOD !== 0) {
            const previousNodeLOD = nodeLODs[indexLOD - 1];
            if (previousNodeLOD._babylonTransformNode) {
              this._disposeTransformNode(previousNodeLOD._babylonTransformNode);
              delete previousNodeLOD._babylonTransformNode;
            }
          }
          babylonMesh.setEnabled(true);
          return babylonMesh;
        });
        this._nodePromiseLODs[indexLOD] = this._nodePromiseLODs[indexLOD] || [];
        if (indexLOD === 0) {
          firstPromise = promise;
        } else {
          this._nodeIndexLOD = null;
          this._nodePromiseLODs[indexLOD].push(promise);
        }
      }
      this._loader.logClose();
      return await firstPromise;
    });
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadMaterialAsync(context, material, babylonMesh, babylonDrawMode, assign) {
    if (this._nodeIndexLOD) {
      return null;
    }
    return GLTFLoader2.LoadExtensionAsync(context, material, this.name, async (extensionContext, extension) => {
      let firstPromise;
      const materialLODs = this._getLODs(extensionContext, material, this._loader.gltf.materials, extension.ids);
      this._loader.logOpen(`${extensionContext}`);
      for (let indexLOD = 0; indexLOD < materialLODs.length; indexLOD++) {
        const materialLOD = materialLODs[indexLOD];
        if (indexLOD !== 0) {
          this._materialIndexLOD = indexLOD;
        }
        const promise = this._loader._loadMaterialAsync(`/materials/${materialLOD.index}`, materialLOD, babylonMesh, babylonDrawMode, (babylonMaterial) => {
          if (indexLOD === 0) {
            assign(babylonMaterial);
          }
        }).then((babylonMaterial) => {
          if (indexLOD !== 0) {
            assign(babylonMaterial);
            const previousDataLOD = materialLODs[indexLOD - 1]._data;
            if (previousDataLOD[babylonDrawMode]) {
              this._disposeMaterials([previousDataLOD[babylonDrawMode].babylonMaterial]);
              delete previousDataLOD[babylonDrawMode];
            }
          }
          return babylonMaterial;
        });
        this._materialPromiseLODs[indexLOD] = this._materialPromiseLODs[indexLOD] || [];
        if (indexLOD === 0) {
          firstPromise = promise;
        } else {
          this._materialIndexLOD = null;
          this._materialPromiseLODs[indexLOD].push(promise);
        }
      }
      this._loader.logClose();
      return await firstPromise;
    });
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  _loadUriAsync(context, property, uri) {
    if (this._nodeIndexLOD !== null) {
      this._loader.log(`deferred`);
      const previousIndexLOD = this._nodeIndexLOD - 1;
      this._nodeSignalLODs[previousIndexLOD] = this._nodeSignalLODs[previousIndexLOD] || new Deferred();
      return this._nodeSignalLODs[this._nodeIndexLOD - 1].promise.then(async () => {
        return await this._loader.loadUriAsync(context, property, uri);
      });
    } else if (this._materialIndexLOD !== null) {
      this._loader.log(`deferred`);
      const previousIndexLOD = this._materialIndexLOD - 1;
      this._materialSignalLODs[previousIndexLOD] = this._materialSignalLODs[previousIndexLOD] || new Deferred();
      return this._materialSignalLODs[previousIndexLOD].promise.then(async () => {
        return await this._loader.loadUriAsync(context, property, uri);
      });
    }
    return null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadBufferAsync(context, buffer, byteOffset, byteLength) {
    if (this._loader.parent.useRangeRequests && !buffer.uri) {
      if (!this._loader.bin) {
        throw new Error(`${context}: Uri is missing or the binary glTF is missing its binary chunk`);
      }
      const loadAsync = async (bufferLODs, indexLOD) => {
        const start = byteOffset;
        const end = start + byteLength - 1;
        let bufferLOD = bufferLODs[indexLOD];
        if (bufferLOD) {
          bufferLOD.start = Math.min(bufferLOD.start, start);
          bufferLOD.end = Math.max(bufferLOD.end, end);
        } else {
          bufferLOD = { start, end, loaded: new Deferred() };
          bufferLODs[indexLOD] = bufferLOD;
        }
        return await bufferLOD.loaded.promise.then((data) => {
          return new Uint8Array(data.buffer, data.byteOffset + byteOffset - bufferLOD.start, byteLength);
        });
      };
      this._loader.log(`deferred`);
      if (this._nodeIndexLOD !== null) {
        return loadAsync(this._nodeBufferLODs, this._nodeIndexLOD);
      } else if (this._materialIndexLOD !== null) {
        return loadAsync(this._materialBufferLODs, this._materialIndexLOD);
      } else {
        return loadAsync(this._bufferLODs, 0);
      }
    }
    return null;
  }
  _loadBufferLOD(bufferLODs, indexLOD) {
    const bufferLOD = bufferLODs[indexLOD];
    if (bufferLOD) {
      this._loader.log(`Loading buffer range [${bufferLOD.start}-${bufferLOD.end}]`);
      this._loader.bin.readAsync(bufferLOD.start, bufferLOD.end - bufferLOD.start + 1).then((data) => {
        bufferLOD.loaded.resolve(data);
      }, (error) => {
        bufferLOD.loaded.reject(error);
      });
    }
  }
  /**
   * @returns an array of LOD properties from lowest to highest.
   * @param context
   * @param property
   * @param array
   * @param ids
   */
  _getLODs(context, property, array, ids) {
    if (this.maxLODsToLoad <= 0) {
      throw new Error("maxLODsToLoad must be greater than zero");
    }
    const properties = [];
    for (let i = ids.length - 1; i >= 0; i--) {
      properties.push(ArrayItem.Get(`${context}/ids/${ids[i]}`, array, ids[i]));
      if (properties.length === this.maxLODsToLoad) {
        return properties;
      }
    }
    properties.push(property);
    return properties;
  }
  _disposeTransformNode(babylonTransformNode) {
    const babylonMaterials = [];
    const babylonMaterial = babylonTransformNode.material;
    if (babylonMaterial) {
      babylonMaterials.push(babylonMaterial);
    }
    for (const babylonMesh of babylonTransformNode.getChildMeshes()) {
      if (babylonMesh.material) {
        babylonMaterials.push(babylonMesh.material);
      }
    }
    babylonTransformNode.dispose();
    const babylonMaterialsToDispose = babylonMaterials.filter((babylonMaterial2) => this._loader.babylonScene.meshes.every((mesh) => mesh.material != babylonMaterial2));
    this._disposeMaterials(babylonMaterialsToDispose);
  }
  _disposeMaterials(babylonMaterials) {
    const babylonTextures = {};
    for (const babylonMaterial of babylonMaterials) {
      for (const babylonTexture of babylonMaterial.getActiveTextures()) {
        babylonTextures[babylonTexture.uniqueId] = babylonTexture;
      }
      babylonMaterial.dispose();
    }
    for (const uniqueId in babylonTextures) {
      for (const babylonMaterial of this._loader.babylonScene.materials) {
        if (babylonMaterial.hasTexture(babylonTextures[uniqueId])) {
          delete babylonTextures[uniqueId];
        }
      }
    }
    for (const uniqueId in babylonTextures) {
      babylonTextures[uniqueId].dispose();
    }
  }
}
let _Registered$7 = false;
function RegisterMSFT_lod() {
  if (_Registered$7) {
    return;
  }
  _Registered$7 = true;
  unregisterGLTFExtension(NAME$7);
  registerGLTFExtension(NAME$7, true, (loader) => new MSFT_lod(loader));
}
RegisterMSFT_lod();
const NAME$6 = "MSFT_minecraftMesh";
class MSFT_minecraftMesh {
  /** @internal */
  constructor(loader) {
    this.name = NAME$6;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$6);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /** @internal */
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtraAsync(context, material, this.name, async (extraContext, extra) => {
      if (extra) {
        const impl = this._loader._pbrMaterialImpls.get("pbr");
        if (!impl) {
          throw new Error(`${extraContext}: Material type not supported`);
        }
        const promise = this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial);
        if (babylonMaterial.needAlphaBlending()) {
          babylonMaterial.forceDepthWrite = true;
          babylonMaterial.separateCullingPass = true;
        }
        babylonMaterial.backFaceCulling = babylonMaterial.forceDepthWrite;
        babylonMaterial.twoSidedLighting = true;
        return await promise;
      }
    });
  }
}
let _Registered$6 = false;
function RegisterMSFT_minecraftMesh() {
  if (_Registered$6) {
    return;
  }
  _Registered$6 = true;
  unregisterGLTFExtension(NAME$6);
  registerGLTFExtension(NAME$6, true, (loader) => new MSFT_minecraftMesh(loader));
}
RegisterMSFT_minecraftMesh();
const NAME$5 = "MSFT_sRGBFactors";
class MSFT_sRGBFactors {
  /** @internal */
  constructor(loader) {
    this.name = NAME$5;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME$5);
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /** @internal*/
  // eslint-disable-next-line no-restricted-syntax
  loadMaterialPropertiesAsync(context, material, babylonMaterial) {
    return GLTFLoader2.LoadExtraAsync(context, material, this.name, async (extraContext, extra) => {
      if (extra) {
        const adapter = this._loader._getOrCreateMaterialAdapter(babylonMaterial);
        const promise = this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial);
        const useExactSrgbConversions = babylonMaterial.getScene().getEngine().useExactSrgbConversions;
        if (!adapter.baseColorTexture) {
          adapter.baseColor.toLinearSpaceToRef(adapter.baseColor, useExactSrgbConversions);
        }
        if (!adapter.specularColorTexture) {
          adapter.specularColor.toLinearSpaceToRef(adapter.specularColor, useExactSrgbConversions);
        }
        return await promise;
      }
    });
  }
}
let _Registered$5 = false;
function RegisterMSFT_sRGBFactors() {
  if (_Registered$5) {
    return;
  }
  _Registered$5 = true;
  unregisterGLTFExtension(NAME$5);
  registerGLTFExtension(NAME$5, true, (loader) => new MSFT_sRGBFactors(loader));
}
RegisterMSFT_sRGBFactors();
const InteractivityForLoopMaxIterations = 2e4;
function getMappingForFullOperationName(fullOperationName) {
  const [op, extension] = fullOperationName.split(":");
  return getMappingForDeclaration({ op, extension });
}
function getMappingForDeclaration(declaration, returnNoOpIfNotAvailable = true) {
  const mapping = declaration.extension ? gltfExtensionsToFlowGraphMapping[declaration.extension]?.[declaration.op] : gltfToFlowGraphMapping[declaration.op];
  if (!mapping) {
    Logger.Warn(`No mapping found for operation ${declaration.op} and extension ${declaration.extension || "KHR_interactivity"}`);
    if (returnNoOpIfNotAvailable) {
      const inputs = {};
      const outputs = {
        flows: {}
      };
      if (declaration.inputValueSockets) {
        inputs.values = {};
        for (const key in declaration.inputValueSockets) {
          inputs.values[key] = {
            name: key
          };
        }
      }
      if (declaration.outputValueSockets) {
        outputs.values = {};
        Object.keys(declaration.outputValueSockets).forEach((key) => {
          outputs.values[key] = {
            name: key
          };
        });
      }
      return {
        blocks: [],
        // no blocks, just mapping
        inputs,
        outputs
      };
    }
  }
  return mapping;
}
function addNewInteractivityFlowGraphMapping(key, extension, mapping) {
  gltfExtensionsToFlowGraphMapping[extension] || (gltfExtensionsToFlowGraphMapping[extension] = {});
  gltfExtensionsToFlowGraphMapping[extension][key] = mapping;
}
const gltfExtensionsToFlowGraphMapping = {
  /**
   * This is the BABYLON extension for glTF interactivity.
   * It defines babylon-specific blocks and operations.
   */
  BABYLON: {
    /**
     * flow/log is a flow node that logs input to the console.
     * It has "in" and "out" flows, and takes a message as input.
     * The message can be any type of value.
     * The message is logged to the console when the "in" flow is triggered.
     * The "out" flow is triggered when the message is logged.
     */
    "flow/log": {
      blocks: [
        "FlowGraphConsoleLogBlock"
        /* FlowGraphBlockNames.ConsoleLog */
      ],
      inputs: {
        values: {
          message: { name: "message" }
        }
      }
    }
  }
};
const gltfToFlowGraphMapping = {
  "event/onStart": {
    blocks: [
      "FlowGraphSceneReadyEventBlock"
      /* FlowGraphBlockNames.SceneReadyEvent */
    ],
    outputs: {
      values: {
        // KHR_interactivity `ref event` output (the event reference).
        event: { name: "event" }
      },
      flows: {
        out: { name: "done" }
      }
    }
  },
  "event/onTick": {
    blocks: [
      "FlowGraphSceneTickEventBlock"
      /* FlowGraphBlockNames.SceneTickEvent */
    ],
    inputs: {},
    outputs: {
      values: {
        timeSinceLastTick: {
          name: "deltaTime",
          gltfType: "number"
          /*, dataTransformer: (time: number) => time / 1000*/
        },
        // KHR_interactivity `ref event` output (the event reference).
        event: { name: "event" }
      },
      flows: {
        out: { name: "done" }
      }
    }
  },
  "event/send": {
    blocks: [
      "FlowGraphSendCustomEventBlock"
      /* FlowGraphBlockNames.SendCustomEvent */
    ],
    extraProcessor(gltfBlock, declaration, _mapping, parser, serializedObjects) {
      if (declaration.op !== "event/send" || !gltfBlock.configuration || Object.keys(gltfBlock.configuration).length !== 1) {
        throw new Error("Receive event should have a single configuration object, the event itself");
      }
      const eventConfiguration = gltfBlock.configuration["event"];
      const eventId = eventConfiguration.value?.[0];
      if (typeof eventId !== "number") {
        throw new Error("Event id should be a number");
      }
      const event = parser.arrays.events[eventId];
      const serializedObject = serializedObjects[0];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.eventId = event.eventId;
      serializedObject.config.eventData = event.eventData;
      return serializedObjects;
    }
  },
  "event/receive": {
    blocks: [
      "FlowGraphReceiveCustomEventBlock"
      /* FlowGraphBlockNames.ReceiveCustomEvent */
    ],
    outputs: {
      values: {
        // KHR_interactivity `ref event` output (the event reference).
        event: { name: "event" }
      },
      flows: {
        out: { name: "done" }
      }
    },
    validation(gltfBlock, interactivityGraph) {
      if (!gltfBlock.configuration) {
        Logger.Error("Receive event should have a configuration object");
        return { valid: false, error: "Receive event should have a configuration object" };
      }
      const eventConfiguration = gltfBlock.configuration["event"];
      if (!eventConfiguration) {
        Logger.Error("Receive event should have a single configuration object, the event itself");
        return { valid: false, error: "Receive event should have a single configuration object, the event itself" };
      }
      const eventId = eventConfiguration.value?.[0];
      if (typeof eventId !== "number") {
        Logger.Error("Event id should be a number");
        return { valid: false, error: "Event id should be a number" };
      }
      const event = interactivityGraph.events?.[eventId];
      if (!event) {
        Logger.Error(`Event with id ${eventId} not found`);
        return { valid: false, error: `Event with id ${eventId} not found` };
      }
      return { valid: true };
    },
    extraProcessor(gltfBlock, declaration, _mapping, parser, serializedObjects) {
      if (declaration.op !== "event/receive" || !gltfBlock.configuration || Object.keys(gltfBlock.configuration).length !== 1) {
        throw new Error("Receive event should have a single configuration object, the event itself");
      }
      const eventConfiguration = gltfBlock.configuration["event"];
      const eventId = eventConfiguration.value?.[0];
      if (typeof eventId !== "number") {
        throw new Error("Event id should be a number");
      }
      const event = parser.arrays.events[eventId];
      const serializedObject = serializedObjects[0];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.eventId = event.eventId;
      serializedObject.config.eventData = event.eventData;
      return serializedObjects;
    }
  },
  "event/stopPropagation": {
    blocks: [
      "FlowGraphStopEventPropagationBlock"
      /* FlowGraphBlockNames.StopEventPropagation */
    ],
    inputs: {
      values: {
        event: { name: "event" },
        stopImmediate: { name: "stopImmediate" }
      },
      flows: {
        in: { name: "in" }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" }
      }
    }
  },
  "math/E": getSimpleInputMapping(
    "FlowGraphEBlock"
    /* FlowGraphBlockNames.E */
  ),
  "math/Pi": getSimpleInputMapping(
    "FlowGraphPIBlock"
    /* FlowGraphBlockNames.PI */
  ),
  "math/Tau": getSimpleInputMapping(
    "FlowGraphTauBlock"
    /* FlowGraphBlockNames.Tau */
  ),
  "math/Inf": getSimpleInputMapping(
    "FlowGraphInfBlock"
    /* FlowGraphBlockNames.Inf */
  ),
  "math/NaN": getSimpleInputMapping(
    "FlowGraphNaNBlock"
    /* FlowGraphBlockNames.NaN */
  ),
  "math/abs": getSimpleInputMapping(
    "FlowGraphAbsBlock"
    /* FlowGraphBlockNames.Abs */
  ),
  "math/sign": getSimpleInputMapping(
    "FlowGraphSignBlock"
    /* FlowGraphBlockNames.Sign */
  ),
  "math/trunc": getSimpleInputMapping(
    "FlowGraphTruncBlock"
    /* FlowGraphBlockNames.Trunc */
  ),
  "math/floor": getSimpleInputMapping(
    "FlowGraphFloorBlock"
    /* FlowGraphBlockNames.Floor */
  ),
  "math/ceil": getSimpleInputMapping(
    "FlowGraphCeilBlock"
    /* FlowGraphBlockNames.Ceil */
  ),
  "math/round": {
    blocks: [
      "FlowGraphRoundBlock"
      /* FlowGraphBlockNames.Round */
    ],
    configuration: {},
    inputs: {
      values: {
        a: { name: "a" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    },
    extraProcessor(gltfBlock, declaration, _mapping, parser, serializedObjects) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      serializedObjects[0].config.roundHalfAwayFromZero = true;
      return serializedObjects;
    }
  },
  "math/fract": getSimpleInputMapping(
    "FlowGraphFractBlock"
    /* FlowGraphBlockNames.Fraction */
  ),
  "math/neg": getSimpleInputMapping(
    "FlowGraphNegationBlock"
    /* FlowGraphBlockNames.Negation */
  ),
  "math/add": getSimpleInputMapping("FlowGraphAddBlock", ["a", "b"], true),
  "math/sub": getSimpleInputMapping("FlowGraphSubtractBlock", ["a", "b"], true),
  "math/mul": {
    blocks: [
      "FlowGraphMultiplyBlock"
      /* FlowGraphBlockNames.Multiply */
    ],
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      serializedObjects[0].config.useMatrixPerComponent = true;
      serializedObjects[0].config.preventIntegerFloatArithmetic = true;
      let type = -1;
      Object.keys(_gltfBlock.values || {}).find((value) => {
        if (_gltfBlock.values?.[value].type !== void 0) {
          type = _gltfBlock.values[value].type;
          return true;
        }
        return false;
      });
      if (type !== -1) {
        serializedObjects[0].config.type = _parser.arrays.types[type].flowGraphType;
      }
      return serializedObjects;
    },
    validation(gltfBlock) {
      if (gltfBlock.values) {
        return ValidateTypes(gltfBlock);
      }
      return { valid: true };
    }
  },
  "math/div": getSimpleInputMapping("FlowGraphDivideBlock", ["a", "b"], true),
  "math/rem": getSimpleInputMapping("FlowGraphModuloBlock", ["a", "b"]),
  "math/min": getSimpleInputMapping("FlowGraphMinBlock", ["a", "b"]),
  "math/max": getSimpleInputMapping("FlowGraphMaxBlock", ["a", "b"]),
  "math/clamp": getSimpleInputMapping("FlowGraphClampBlock", ["a", "b", "c"]),
  "math/saturate": getSimpleInputMapping(
    "FlowGraphSaturateBlock"
    /* FlowGraphBlockNames.Saturate */
  ),
  "math/mix": getSimpleInputMapping("FlowGraphMathInterpolationBlock", ["a", "b", "c"]),
  // Smooth-step (Hermite interpolation): edges a/b and value c.
  "math/smoothStep": getSimpleInputMapping("FlowGraphSmoothStepBlock", ["a", "b", "c"]),
  // Linear sRGB <-> OkLCh (Oklab polar form). Scalar r/g/b inputs map to l/c/h
  // outputs (hue in radians) and vice-versa.
  "math/rgbToOkLCh": {
    blocks: [
      "FlowGraphRGBToOkLChBlock"
      /* FlowGraphBlockNames.RGBToOkLCh */
    ],
    inputs: {
      values: {
        r: { name: "r", gltfType: "number" },
        g: { name: "g", gltfType: "number" },
        b: { name: "b", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        l: { name: "l" },
        c: { name: "c" },
        h: { name: "h" }
      }
    }
  },
  "math/rgbFromOkLCh": {
    blocks: [
      "FlowGraphRGBFromOkLChBlock"
      /* FlowGraphBlockNames.RGBFromOkLCh */
    ],
    inputs: {
      values: {
        l: { name: "l", gltfType: "number" },
        c: { name: "c", gltfType: "number" },
        h: { name: "h", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        r: { name: "r" },
        g: { name: "g" },
        b: { name: "b" }
      }
    }
  },
  // Quaternion spherical-linear interpolation. Inputs are two unit
  // quaternions and an unclamped float coefficient.
  "math/quatSlerp": getSimpleInputMapping("FlowGraphMathSlerpBlock", ["a", "b", "c"]),
  // Vector spherical-linear interpolation (float2/float3). Inputs are two
  // vectors and an unclamped float coefficient.
  "math/slerp": getSimpleInputMapping("FlowGraphVectorSlerpBlock", ["a", "b", "c"]),
  "math/eq": getSimpleInputMapping("FlowGraphEqualityBlock", ["a", "b"]),
  // Reference equality. The spec defines `ref/eq` as: true if both refs are
  // null, true if both refer to the same object (regardless of whether it
  // exists), false otherwise. FlowGraphEqualityBlock falls through to a
  // strict `===` comparison for non-vector/matrix/numeric types, which
  // already produces the spec-defined behaviour for Babylon object refs.
  "ref/eq": getSimpleInputMapping("FlowGraphEqualityBlock", ["a", "b"]),
  "math/lt": getSimpleInputMapping("FlowGraphLessThanBlock", ["a", "b"]),
  "math/le": getSimpleInputMapping("FlowGraphLessThanOrEqualBlock", ["a", "b"]),
  "math/gt": getSimpleInputMapping("FlowGraphGreaterThanBlock", ["a", "b"]),
  "math/ge": getSimpleInputMapping("FlowGraphGreaterThanOrEqualBlock", ["a", "b"]),
  "math/isNaN": getSimpleInputMapping(
    "FlowGraphIsNaNBlock"
    /* FlowGraphBlockNames.IsNaN */
  ),
  "math/isInf": getSimpleInputMapping(
    "FlowGraphIsInfBlock"
    /* FlowGraphBlockNames.IsInfinity */
  ),
  "math/select": {
    blocks: [
      "FlowGraphConditionalBlock"
      /* FlowGraphBlockNames.Conditional */
    ],
    inputs: {
      values: {
        condition: { name: "condition" },
        // Should we validate those have the same type here, or assume it is already validated?
        a: { name: "onTrue" },
        b: { name: "onFalse" }
      }
    },
    outputs: {
      values: {
        value: { name: "output" }
      }
    }
  },
  "math/random": {
    blocks: [
      "FlowGraphRandomBlock"
      /* FlowGraphBlockNames.Random */
    ],
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/sin": getSimpleInputMapping(
    "FlowGraphSinBlock"
    /* FlowGraphBlockNames.Sin */
  ),
  "math/cos": getSimpleInputMapping(
    "FlowGraphCosBlock"
    /* FlowGraphBlockNames.Cos */
  ),
  "math/tan": getSimpleInputMapping(
    "FlowGraphTanBlock"
    /* FlowGraphBlockNames.Tan */
  ),
  "math/asin": getSimpleInputMapping(
    "FlowGraphASinBlock"
    /* FlowGraphBlockNames.Asin */
  ),
  "math/acos": getSimpleInputMapping(
    "FlowGraphACosBlock"
    /* FlowGraphBlockNames.Acos */
  ),
  "math/atan": getSimpleInputMapping(
    "FlowGraphATanBlock"
    /* FlowGraphBlockNames.Atan */
  ),
  "math/atan2": getSimpleInputMapping("FlowGraphATan2Block", ["a", "b"]),
  "math/sinh": getSimpleInputMapping(
    "FlowGraphSinhBlock"
    /* FlowGraphBlockNames.Sinh */
  ),
  "math/cosh": getSimpleInputMapping(
    "FlowGraphCoshBlock"
    /* FlowGraphBlockNames.Cosh */
  ),
  "math/tanh": getSimpleInputMapping(
    "FlowGraphTanhBlock"
    /* FlowGraphBlockNames.Tanh */
  ),
  "math/asinh": getSimpleInputMapping(
    "FlowGraphASinhBlock"
    /* FlowGraphBlockNames.Asinh */
  ),
  "math/acosh": getSimpleInputMapping(
    "FlowGraphACoshBlock"
    /* FlowGraphBlockNames.Acosh */
  ),
  "math/atanh": getSimpleInputMapping(
    "FlowGraphATanhBlock"
    /* FlowGraphBlockNames.Atanh */
  ),
  "math/exp": getSimpleInputMapping(
    "FlowGraphExponentialBlock"
    /* FlowGraphBlockNames.Exponential */
  ),
  "math/log": getSimpleInputMapping(
    "FlowGraphLogBlock"
    /* FlowGraphBlockNames.Log */
  ),
  "math/log2": getSimpleInputMapping(
    "FlowGraphLog2Block"
    /* FlowGraphBlockNames.Log2 */
  ),
  "math/log10": getSimpleInputMapping(
    "FlowGraphLog10Block"
    /* FlowGraphBlockNames.Log10 */
  ),
  "math/sqrt": getSimpleInputMapping(
    "FlowGraphSquareRootBlock"
    /* FlowGraphBlockNames.SquareRoot */
  ),
  "math/cbrt": getSimpleInputMapping(
    "FlowGraphCubeRootBlock"
    /* FlowGraphBlockNames.CubeRoot */
  ),
  "math/pow": getSimpleInputMapping("FlowGraphPowerBlock", ["a", "b"]),
  "math/length": getSimpleInputMapping(
    "FlowGraphLengthBlock"
    /* FlowGraphBlockNames.Length */
  ),
  "math/normalize": getSimpleInputMapping(
    "FlowGraphNormalizeBlock"
    /* FlowGraphBlockNames.Normalize */
  ),
  "math/dot": getSimpleInputMapping("FlowGraphDotBlock", ["a", "b"]),
  "math/cross": getSimpleInputMapping("FlowGraphCrossBlock", ["a", "b"]),
  "math/rotate2D": {
    blocks: [
      "FlowGraphRotate2DBlock"
      /* FlowGraphBlockNames.Rotate2D */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        angle: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/rotate3D": {
    blocks: [
      "FlowGraphRotate3DBlock"
      /* FlowGraphBlockNames.Rotate3D */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        rotation: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/transform": {
    // glTF transform is vectorN with matrixN
    blocks: [
      "FlowGraphTransformVectorBlock"
      /* FlowGraphBlockNames.TransformVector */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        b: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/combine2": {
    blocks: [
      "FlowGraphCombineVector2Block"
      /* FlowGraphBlockNames.CombineVector2 */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/combine3": {
    blocks: [
      "FlowGraphCombineVector3Block"
      /* FlowGraphBlockNames.CombineVector3 */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" },
        c: { name: "input_2", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/combine4": {
    blocks: [
      "FlowGraphCombineVector4Block"
      /* FlowGraphBlockNames.CombineVector4 */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" },
        c: { name: "input_2", gltfType: "number" },
        d: { name: "input_3", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  // one input, N outputs! outputs named using numbers.
  "math/extract2": {
    blocks: [
      "FlowGraphExtractVector2Block"
      /* FlowGraphBlockNames.ExtractVector2 */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" }
      }
    }
  },
  "math/extract3": {
    blocks: [
      "FlowGraphExtractVector3Block"
      /* FlowGraphBlockNames.ExtractVector3 */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" },
        "2": { name: "output_2" }
      }
    }
  },
  "math/extract4": {
    blocks: [
      "FlowGraphExtractVector4Block"
      /* FlowGraphBlockNames.ExtractVector4 */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" },
        "2": { name: "output_2" },
        "3": { name: "output_3" }
      }
    }
  },
  "math/transpose": getSimpleInputMapping(
    "FlowGraphTransposeBlock"
    /* FlowGraphBlockNames.Transpose */
  ),
  "math/determinant": getSimpleInputMapping(
    "FlowGraphDeterminantBlock"
    /* FlowGraphBlockNames.Determinant */
  ),
  "math/inverse": getSimpleInputMapping(
    "FlowGraphInvertMatrixBlock"
    /* FlowGraphBlockNames.InvertMatrix */
  ),
  "math/matMul": getSimpleInputMapping("FlowGraphMatrixMultiplicationBlock", ["a", "b"]),
  "math/matCompose": {
    blocks: [
      "FlowGraphMatrixCompose"
      /* FlowGraphBlockNames.MatrixCompose */
    ],
    inputs: {
      values: {
        translation: { name: "position", gltfType: "float3" },
        rotation: { name: "rotationQuaternion", gltfType: "float4" },
        scale: { name: "scaling", gltfType: "float3" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects, context) {
      const d = serializedObjects[0].dataInputs.find((input) => input.name === "rotationQuaternion");
      if (!d) {
        throw new Error("Rotation quaternion input not found");
      }
      if (context._connectionValues[d.uniqueId]) {
        context._connectionValues[d.uniqueId].type = "Quaternion";
      }
      return serializedObjects;
    }
  },
  "math/matDecompose": {
    blocks: [
      "FlowGraphMatrixDecompose"
      /* FlowGraphBlockNames.MatrixDecompose */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        translation: { name: "position" },
        rotation: { name: "rotationQuaternion" },
        scale: { name: "scaling" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      serializedObjects[0].config.keepDegenerateComponents = true;
      return serializedObjects;
    }
  },
  "math/quatConjugate": getSimpleInputMapping("FlowGraphConjugateBlock", ["a"]),
  "math/quatMul": {
    blocks: [
      "FlowGraphMultiplyBlock"
      /* FlowGraphBlockNames.Multiply */
    ],
    inputs: {
      values: {
        a: { name: "a", gltfType: "vector4" },
        b: { name: "b", gltfType: "vector4" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      serializedObjects[0].config.type = "Quaternion";
      return serializedObjects;
    }
  },
  "math/quatAngleBetween": getSimpleInputMapping("FlowGraphAngleBetweenBlock", ["a", "b"]),
  "math/quatFromAxisAngle": {
    blocks: [
      "FlowGraphQuaternionFromAxisAngleBlock"
      /* FlowGraphBlockNames.QuaternionFromAxisAngle */
    ],
    inputs: {
      values: {
        axis: { name: "a", gltfType: "float3" },
        angle: { name: "b", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/quatToAxisAngle": getSimpleInputMapping("FlowGraphAxisAngleFromQuaternionBlock", ["a"]),
  "math/quatFromDirections": getSimpleInputMapping("FlowGraphQuaternionFromDirectionsBlock", ["a", "b"]),
  "math/quatFromUpForward": {
    blocks: [
      "FlowGraphQuaternionFromUpForwardBlock"
      /* FlowGraphBlockNames.QuaternionFromUpForward */
    ],
    inputs: {
      values: {
        up: { name: "a", gltfType: "float3" },
        forward: { name: "b", gltfType: "float3" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  // Tait–Bryan intrinsic Euler angles (x/y/z, in radians) to a rotation quaternion. The rotation
  // order is selected by the `order` configuration string (default `yxz`).
  "math/quatFromAngles": {
    blocks: [
      "FlowGraphQuaternionFromAnglesBlock"
      /* FlowGraphBlockNames.QuaternionFromAngles */
    ],
    configuration: {
      order: { name: "order", defaultValue: ["yxz"] }
    },
    inputs: {
      values: {
        x: { name: "a", gltfType: "number" },
        y: { name: "b", gltfType: "number" },
        z: { name: "c", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/combine2x2": {
    blocks: [
      "FlowGraphCombineMatrix2DBlock"
      /* FlowGraphBlockNames.CombineMatrix2D */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" },
        c: { name: "input_2", gltfType: "number" },
        d: { name: "input_3", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/extract2x2": {
    blocks: [
      "FlowGraphExtractMatrix2DBlock"
      /* FlowGraphBlockNames.ExtractMatrix2D */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "float2x2" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" },
        "2": { name: "output_2" },
        "3": { name: "output_3" }
      }
    }
  },
  "math/combine3x3": {
    blocks: [
      "FlowGraphCombineMatrix3DBlock"
      /* FlowGraphBlockNames.CombineMatrix3D */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" },
        c: { name: "input_2", gltfType: "number" },
        d: { name: "input_3", gltfType: "number" },
        e: { name: "input_4", gltfType: "number" },
        f: { name: "input_5", gltfType: "number" },
        g: { name: "input_6", gltfType: "number" },
        h: { name: "input_7", gltfType: "number" },
        i: { name: "input_8", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/extract3x3": {
    blocks: [
      "FlowGraphExtractMatrix3DBlock"
      /* FlowGraphBlockNames.ExtractMatrix3D */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "float3x3" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" },
        "2": { name: "output_2" },
        "3": { name: "output_3" },
        "4": { name: "output_4" },
        "5": { name: "output_5" },
        "6": { name: "output_6" },
        "7": { name: "output_7" },
        "8": { name: "output_8" }
      }
    }
  },
  "math/combine4x4": {
    blocks: [
      "FlowGraphCombineMatrixBlock"
      /* FlowGraphBlockNames.CombineMatrix */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" },
        c: { name: "input_2", gltfType: "number" },
        d: { name: "input_3", gltfType: "number" },
        e: { name: "input_4", gltfType: "number" },
        f: { name: "input_5", gltfType: "number" },
        g: { name: "input_6", gltfType: "number" },
        h: { name: "input_7", gltfType: "number" },
        i: { name: "input_8", gltfType: "number" },
        j: { name: "input_9", gltfType: "number" },
        k: { name: "input_10", gltfType: "number" },
        l: { name: "input_11", gltfType: "number" },
        m: { name: "input_12", gltfType: "number" },
        n: { name: "input_13", gltfType: "number" },
        o: { name: "input_14", gltfType: "number" },
        p: { name: "input_15", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "math/extract4x4": {
    blocks: [
      "FlowGraphExtractMatrixBlock"
      /* FlowGraphBlockNames.ExtractMatrix */
    ],
    configuration: {},
    inputs: {
      values: {
        a: { name: "input", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" },
        "2": { name: "output_2" },
        "3": { name: "output_3" },
        "4": { name: "output_4" },
        "5": { name: "output_5" },
        "6": { name: "output_6" },
        "7": { name: "output_7" },
        "8": { name: "output_8" },
        "9": { name: "output_9" },
        "10": { name: "output_10" },
        "11": { name: "output_11" },
        "12": { name: "output_12" },
        "13": { name: "output_13" },
        "14": { name: "output_14" },
        "15": { name: "output_15" }
      }
    }
  },
  "math/not": {
    blocks: [
      "FlowGraphBitwiseNotBlock"
      /* FlowGraphBlockNames.BitwiseNot */
    ],
    inputs: {
      values: {
        a: { name: "a" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects, context) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      const socketIn = serializedObjects[0].dataInputs[0];
      serializedObjects[0].config.valueType = context._connectionValues[socketIn.uniqueId]?.type ?? "FlowGraphInteger";
      return serializedObjects;
    }
  },
  "math/and": {
    blocks: [
      "FlowGraphBitwiseAndBlock"
      /* FlowGraphBlockNames.BitwiseAnd */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        b: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects, context) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      const socketInA = serializedObjects[0].dataInputs[0];
      const socketInB = serializedObjects[0].dataInputs[1];
      serializedObjects[0].config.valueType = context._connectionValues[socketInA.uniqueId]?.type ?? context._connectionValues[socketInB.uniqueId]?.type ?? "FlowGraphInteger";
      return serializedObjects;
    }
  },
  "math/or": {
    blocks: [
      "FlowGraphBitwiseOrBlock"
      /* FlowGraphBlockNames.BitwiseOr */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        b: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects, context) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      const socketInA = serializedObjects[0].dataInputs[0];
      const socketInB = serializedObjects[0].dataInputs[1];
      serializedObjects[0].config.valueType = context._connectionValues[socketInA.uniqueId]?.type ?? context._connectionValues[socketInB.uniqueId]?.type ?? "FlowGraphInteger";
      return serializedObjects;
    }
  },
  "math/xor": {
    blocks: [
      "FlowGraphBitwiseXorBlock"
      /* FlowGraphBlockNames.BitwiseXor */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        b: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects, context) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      const socketInA = serializedObjects[0].dataInputs[0];
      const socketInB = serializedObjects[0].dataInputs[1];
      serializedObjects[0].config.valueType = context._connectionValues[socketInA.uniqueId]?.type ?? context._connectionValues[socketInB.uniqueId]?.type ?? "FlowGraphInteger";
      return serializedObjects;
    }
  },
  "math/asr": getSimpleInputMapping("FlowGraphBitwiseRightShiftBlock", ["a", "b"]),
  "math/lsl": getSimpleInputMapping("FlowGraphBitwiseLeftShiftBlock", ["a", "b"]),
  "math/clz": getSimpleInputMapping(
    "FlowGraphLeadingZerosBlock"
    /* FlowGraphBlockNames.LeadingZeros */
  ),
  "math/ctz": getSimpleInputMapping(
    "FlowGraphTrailingZerosBlock"
    /* FlowGraphBlockNames.TrailingZeros */
  ),
  "math/popcnt": getSimpleInputMapping(
    "FlowGraphOneBitsCounterBlock"
    /* FlowGraphBlockNames.OneBitsCounter */
  ),
  "math/rad": getSimpleInputMapping(
    "FlowGraphDegToRadBlock"
    /* FlowGraphBlockNames.DegToRad */
  ),
  "math/deg": getSimpleInputMapping(
    "FlowGraphRadToDegBlock"
    /* FlowGraphBlockNames.RadToDeg */
  ),
  "type/boolToInt": getSimpleInputMapping(
    "FlowGraphBooleanToInt"
    /* FlowGraphBlockNames.BooleanToInt */
  ),
  "type/boolToFloat": getSimpleInputMapping(
    "FlowGraphBooleanToFloat"
    /* FlowGraphBlockNames.BooleanToFloat */
  ),
  "type/intToBool": getSimpleInputMapping(
    "FlowGraphIntToBoolean"
    /* FlowGraphBlockNames.IntToBoolean */
  ),
  "type/intToFloat": getSimpleInputMapping(
    "FlowGraphIntToFloat"
    /* FlowGraphBlockNames.IntToFloat */
  ),
  "type/floatToInt": getSimpleInputMapping(
    "FlowGraphFloatToInt"
    /* FlowGraphBlockNames.FloatToInt */
  ),
  "type/floatToBool": getSimpleInputMapping(
    "FlowGraphFloatToBoolean"
    /* FlowGraphBlockNames.FloatToBoolean */
  ),
  // flows
  "flow/sequence": {
    blocks: [
      "FlowGraphSequenceBlock"
      /* FlowGraphBlockNames.Sequence */
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, _arrays, serializedObjects) {
      const serializedObject = serializedObjects[0];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.outputSignalCount = Object.keys(gltfBlock.flows || []).length;
      serializedObject.signalOutputs.forEach((output, index) => {
        output.name = "out_" + index;
      });
      return serializedObjects;
    }
  },
  "flow/branch": {
    blocks: [
      "FlowGraphBranchBlock"
      /* FlowGraphBlockNames.Branch */
    ],
    outputs: {
      flows: {
        true: { name: "onTrue" },
        false: { name: "onFalse" }
      }
    }
  },
  "flow/switch": {
    blocks: [
      "FlowGraphSwitchBlock"
      /* FlowGraphBlockNames.Switch */
    ],
    configuration: {
      cases: { name: "cases", isArray: true, inOptions: true, defaultValue: [] }
    },
    inputs: {
      values: {
        selection: { name: "case" },
        default: { name: "default" }
      }
    },
    validation(gltfBlock) {
      const cases = gltfBlock.configuration?.cases;
      if (cases && cases.value) {
        const onlyIntegers = cases.value.every((caseValue) => {
          return typeof caseValue === "number" && /^-?\d+$/.test(caseValue.toString());
        });
        if (!onlyIntegers) {
          Logger.Warn("Switch cases should be integers. Using empty array instead.");
          cases.value = [];
          return { valid: true };
        }
        const uniqueCases = new Set(cases.value);
        cases.value = Array.from(uniqueCases);
      }
      return { valid: true };
    },
    extraProcessor(gltfBlock, declaration, _mapping, _arrays, serializedObjects) {
      if (declaration.op !== "flow/switch" || !gltfBlock.flows || Object.keys(gltfBlock.flows).length === 0) {
        throw new Error("Switch should have a single configuration object, the cases array");
      }
      const serializedObject = serializedObjects[0];
      serializedObject.signalOutputs.forEach((output) => {
        if (output.name !== "default") {
          output.name = "out_" + output.name;
        }
      });
      return serializedObjects;
    }
  },
  "flow/while": {
    blocks: [
      "FlowGraphWhileLoopBlock"
      /* FlowGraphBlockNames.WhileLoop */
    ],
    outputs: {
      flows: {
        loopBody: { name: "executionFlow" }
      }
    }
  },
  "flow/for": {
    blocks: [
      "FlowGraphForLoopBlock"
      /* FlowGraphBlockNames.ForLoop */
    ],
    configuration: {
      initialIndex: { name: "initialIndex", gltfType: "number", inOptions: true, defaultValue: 0 }
    },
    inputs: {
      values: {
        startIndex: { name: "startIndex", gltfType: "number" },
        endIndex: { name: "endIndex", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        index: { name: "index" }
      },
      flows: {
        loopBody: { name: "executionFlow" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects) {
      const serializedObject = serializedObjects[0];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.incrementIndexWhenLoopDone = true;
      serializedObject.config.maxLoopIterations = InteractivityForLoopMaxIterations;
      return serializedObjects;
    }
  },
  "flow/doN": {
    blocks: [
      "FlowGraphDoNBlock"
      /* FlowGraphBlockNames.DoN */
    ],
    configuration: {},
    inputs: {
      values: {
        n: { name: "maxExecutions", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        currentCount: { name: "executionCount" }
      }
    }
  },
  "flow/multiGate": {
    blocks: [
      "FlowGraphMultiGateBlock"
      /* FlowGraphBlockNames.MultiGate */
    ],
    configuration: {
      isRandom: { name: "isRandom", gltfType: "boolean", inOptions: true, defaultValue: false },
      isLoop: { name: "isLoop", gltfType: "boolean", inOptions: true, defaultValue: false }
    },
    extraProcessor(gltfBlock, declaration, _mapping, _arrays, serializedObjects) {
      if (declaration.op !== "flow/multiGate" || !gltfBlock.flows || Object.keys(gltfBlock.flows).length === 0) {
        throw new Error("MultiGate should have a single configuration object, the number of output flows");
      }
      const serializedObject = serializedObjects[0];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.outputSignalCount = Object.keys(gltfBlock.flows).length;
      serializedObject.signalOutputs.forEach((output, index) => {
        output.name = "out_" + index;
      });
      return serializedObjects;
    }
  },
  "flow/waitAll": {
    blocks: [
      "FlowGraphWaitAllBlock"
      /* FlowGraphBlockNames.WaitAll */
    ],
    configuration: {
      inputFlows: { name: "inputSignalCount", gltfType: "number", inOptions: true, defaultValue: 0 }
    },
    inputs: {
      flows: {
        reset: { name: "reset" },
        "[segment]": { name: "in_$1" }
      }
    },
    validation(gltfBlock) {
      if (typeof gltfBlock.configuration?.inputFlows?.value?.[0] !== "number") {
        gltfBlock.configuration = gltfBlock.configuration || {
          inputFlows: { value: [0] }
        };
        gltfBlock.configuration.inputFlows.value = [0];
      }
      return { valid: true };
    }
  },
  "flow/throttle": {
    blocks: [
      "FlowGraphThrottleBlock"
      /* FlowGraphBlockNames.Throttle */
    ],
    outputs: {
      flows: {
        err: { name: "error" }
      }
    }
  },
  "flow/setDelay": {
    blocks: [
      "FlowGraphSetDelayBlock"
      /* FlowGraphBlockNames.SetDelay */
    ],
    outputs: {
      flows: {
        err: { name: "error" }
      },
      values: {
        // New spec renames this output to `lastDelay` (ref). Internally we still produce a
        // FlowGraphInteger; the index is unique per delay so it acts as the opaque handle.
        lastDelay: { name: "lastDelayIndex" }
      }
    }
  },
  "flow/cancelDelay": {
    blocks: [
      "FlowGraphCancelDelayBlock"
      /* FlowGraphBlockNames.CancelDelay */
    ],
    inputs: {
      values: {
        // New spec renames this input to `delay` (ref). The underlying block reads an int
        // from `delayIndex`; when a ref-string flows in we coerce it via the path converter.
        delay: { name: "delayIndex" }
      }
    }
  },
  "variable/get": {
    blocks: [
      "FlowGraphGetVariableBlock"
      /* FlowGraphBlockNames.GetVariable */
    ],
    validation(gltfBlock) {
      if (!gltfBlock.configuration?.variable?.value) {
        Logger.Error("Variable get block should have a variable configuration");
        return { valid: false, error: "Variable get block should have a variable configuration" };
      }
      return { valid: true };
    },
    configuration: {
      variable: {
        name: "variable",
        gltfType: "number",
        flowGraphType: "string",
        inOptions: true,
        isVariable: true,
        dataTransformer(index, parser) {
          return parser.getVariableName(index);
        }
      }
    }
  },
  "variable/set": {
    blocks: [
      "FlowGraphSetVariableBlock"
      /* FlowGraphBlockNames.SetVariable */
    ],
    configuration: {
      variables: {
        name: "variables",
        gltfType: "number",
        flowGraphType: "string",
        inOptions: true,
        isArray: true,
        dataTransformer(index, parser) {
          return index.map((i) => parser.getVariableName(i));
        }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, parser, serializedObjects) {
      const serializedGetVariable = serializedObjects[0];
      serializedGetVariable.dataInputs.forEach((input) => {
        input.name = parser.getVariableName(+input.name);
      });
      return serializedObjects;
    }
  },
  "variable/interpolate": {
    blocks: [
      "FlowGraphInterpolationBlock",
      "FlowGraphContextBlock",
      "FlowGraphPlayAnimationBlock",
      "FlowGraphBezierCurveEasing",
      "FlowGraphGetVariableBlock"
    ],
    configuration: {
      variable: {
        name: "propertyName",
        inOptions: true,
        isVariable: true,
        dataTransformer(index, parser) {
          return parser.getVariableName(index);
        }
      },
      useSlerp: {
        name: "animationType",
        inOptions: true,
        defaultValue: false,
        dataTransformer(value) {
          return value === true ? "Quaternion" : void 0;
        }
      }
    },
    inputs: {
      values: {
        value: { name: "value_1" },
        duration: { name: "duration_1", gltfType: "number" },
        p1: {
          name: "controlPoint1",
          toBlock: "FlowGraphBezierCurveEasing"
          /* FlowGraphBlockNames.BezierCurveEasing */
        },
        p2: {
          name: "controlPoint2",
          toBlock: "FlowGraphBezierCurveEasing"
          /* FlowGraphBlockNames.BezierCurveEasing */
        }
      },
      flows: {
        in: {
          name: "in",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        }
      }
    },
    outputs: {
      flows: {
        err: {
          name: "error",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        },
        out: {
          name: "out",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        },
        done: {
          name: "done",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        }
      }
    },
    interBlockConnectors: [
      {
        input: "object",
        output: "userVariables",
        inputBlockIndex: 2,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "animation",
        output: "animation",
        inputBlockIndex: 2,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "easingFunction",
        output: "easingFunction",
        inputBlockIndex: 0,
        outputBlockIndex: 3,
        isVariable: true
      },
      {
        input: "value_0",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 4,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, parser, serializedObjects) {
      var _a, _b;
      const serializedValueInterpolation = serializedObjects[0];
      const propertyIndex = gltfBlock.configuration?.variable.value?.[0];
      if (typeof propertyIndex !== "number") {
        Logger.Error("Variable index is not defined for variable interpolation block");
        throw new Error("Variable index is not defined for variable interpolation block");
      }
      const variable = parser.arrays.staticVariables[propertyIndex];
      if (typeof serializedValueInterpolation.config?.animationType?.value === "undefined") {
        serializedValueInterpolation.config || (serializedValueInterpolation.config = {});
        (_a = serializedValueInterpolation.config).animationType || (_a.animationType = {});
        serializedValueInterpolation.config.animationType.value = getAnimationTypeByFlowGraphType(variable.type);
      }
      const serializedGetVariable = serializedObjects[4];
      serializedGetVariable.config || (serializedGetVariable.config = {});
      (_b = serializedGetVariable.config).variable || (_b.variable = {});
      serializedGetVariable.config.variable.value = parser.getVariableName(propertyIndex);
      return serializedObjects;
    }
  },
  "pointer/get": {
    blocks: [
      "FlowGraphGetPropertyBlock",
      "FlowGraphJsonPointerParserBlock"
      /* FlowGraphBlockNames.JsonPointerParser */
    ],
    validation: ValidateJsonPointerTemplate,
    configuration: {
      pointer: {
        name: "jsonPointer",
        toBlock: "FlowGraphJsonPointerParserBlock"
        /* FlowGraphBlockNames.JsonPointerParser */
      }
    },
    inputs: {
      values: {
        "[segment]": {
          name: "$1",
          toBlock: "FlowGraphJsonPointerParserBlock"
          /* FlowGraphBlockNames.JsonPointerParser */
        }
      }
    },
    interBlockConnectors: [
      {
        input: "object",
        output: "object",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "propertyName",
        output: "propertyName",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "customGetFunction",
        output: "getFunction",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, parser, serializedObjects) {
      serializedObjects.forEach((serializedObject) => {
        if (serializedObject.className === "FlowGraphJsonPointerParserBlock") {
          serializedObject.config || (serializedObject.config = {});
          serializedObject.config.outputValue = true;
        }
      });
      return serializedObjects;
    }
  },
  "pointer/set": {
    blocks: [
      "FlowGraphSetPropertyBlock",
      "FlowGraphJsonPointerParserBlock"
      /* FlowGraphBlockNames.JsonPointerParser */
    ],
    validation: ValidateJsonPointerTemplate,
    configuration: {
      pointer: {
        name: "jsonPointer",
        toBlock: "FlowGraphJsonPointerParserBlock"
        /* FlowGraphBlockNames.JsonPointerParser */
      }
    },
    inputs: {
      values: {
        // must be defined due to the array taking over
        value: { name: "value" },
        "[segment]": {
          name: "$1",
          toBlock: "FlowGraphJsonPointerParserBlock"
          /* FlowGraphBlockNames.JsonPointerParser */
        }
      }
    },
    outputs: {
      flows: {
        err: { name: "error" }
      }
    },
    interBlockConnectors: [
      {
        input: "object",
        output: "object",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "propertyName",
        output: "propertyName",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "customSetFunction",
        output: "setFunction",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, parser, serializedObjects) {
      serializedObjects.forEach((serializedObject) => {
        if (serializedObject.className === "FlowGraphJsonPointerParserBlock") {
          serializedObject.config || (serializedObject.config = {});
          serializedObject.config.outputValue = true;
        }
      });
      return serializedObjects;
    }
  },
  "pointer/interpolate": {
    // interpolate, parse the pointer and play the animation generated. 3 blocks!
    blocks: [
      "FlowGraphInterpolationBlock",
      "FlowGraphJsonPointerParserBlock",
      "FlowGraphPlayAnimationBlock",
      "FlowGraphBezierCurveEasing"
      /* FlowGraphBlockNames.BezierCurveEasing */
    ],
    validation: ValidateJsonPointerTemplate,
    configuration: {
      pointer: {
        name: "jsonPointer",
        toBlock: "FlowGraphJsonPointerParserBlock"
        /* FlowGraphBlockNames.JsonPointerParser */
      }
    },
    inputs: {
      values: {
        value: { name: "value_1" },
        "[segment]": {
          name: "$1",
          toBlock: "FlowGraphJsonPointerParserBlock"
          /* FlowGraphBlockNames.JsonPointerParser */
        },
        duration: {
          name: "duration_1",
          gltfType: "number"
          /*, inOptions: true */
        },
        p1: {
          name: "controlPoint1",
          toBlock: "FlowGraphBezierCurveEasing"
          /* FlowGraphBlockNames.BezierCurveEasing */
        },
        p2: {
          name: "controlPoint2",
          toBlock: "FlowGraphBezierCurveEasing"
          /* FlowGraphBlockNames.BezierCurveEasing */
        }
      },
      flows: {
        in: {
          name: "in",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        }
      }
    },
    outputs: {
      flows: {
        err: {
          name: "error",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        },
        out: {
          name: "out",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        },
        done: {
          name: "done",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        }
      }
    },
    interBlockConnectors: [
      {
        input: "object",
        output: "object",
        inputBlockIndex: 2,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "propertyName",
        output: "propertyName",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "customBuildAnimation",
        output: "generateAnimationsFunction",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "animation",
        output: "animation",
        inputBlockIndex: 2,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "easingFunction",
        output: "easingFunction",
        inputBlockIndex: 0,
        outputBlockIndex: 3,
        isVariable: true
      },
      {
        input: "value_0",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, parser, serializedObjects) {
      serializedObjects.forEach((serializedObject) => {
        if (serializedObject.className === "FlowGraphJsonPointerParserBlock") {
          serializedObject.config || (serializedObject.config = {});
          serializedObject.config.outputValue = true;
        } else if (serializedObject.className === "FlowGraphInterpolationBlock") {
          serializedObject.config || (serializedObject.config = {});
          Object.keys(gltfBlock.values || []).forEach((key) => {
            const value = gltfBlock.values?.[key];
            if (key === "value" && value) {
              const type = value.type;
              if (type !== void 0) {
                serializedObject.config.animationType = parser.arrays.types[type].flowGraphType;
              }
            }
          });
        }
      });
      return serializedObjects;
    }
  },
  "animation/start": {
    blocks: ["FlowGraphPlayAnimationBlock", "FlowGraphArrayIndexBlock", "KHR_interactivity/FlowGraphGLTFDataProvider"],
    inputs: {
      values: {
        animation: {
          name: "index",
          gltfType: "number",
          toBlock: "FlowGraphArrayIndexBlock"
          /* FlowGraphBlockNames.ArrayIndex */
        },
        speed: { name: "speed", gltfType: "number" },
        startTime: {
          name: "from",
          gltfType: "number",
          convertConnectedTimeToFrames: true,
          dataTransformer: (time, parser) => [time[0] * parser._animationTargetFps]
        },
        endTime: {
          name: "to",
          gltfType: "number",
          convertConnectedTimeToFrames: true,
          dataTransformer: (time, parser) => [time[0] * parser._animationTargetFps]
        }
      }
    },
    outputs: {
      flows: {
        err: { name: "error" }
      }
    },
    interBlockConnectors: [
      {
        input: "animationGroup",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "animationGroups",
        inputBlockIndex: 1,
        outputBlockIndex: 2,
        isVariable: true
      }
    ],
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects, _context, globalGLTF) {
      const serializedObject = serializedObjects[serializedObjects.length - 1];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.glTF = globalGLTF;
      return serializedObjects;
    }
  },
  "animation/stop": {
    blocks: ["FlowGraphStopAnimationBlock", "FlowGraphArrayIndexBlock", "KHR_interactivity/FlowGraphGLTFDataProvider"],
    inputs: {
      values: {
        animation: {
          name: "index",
          gltfType: "number",
          toBlock: "FlowGraphArrayIndexBlock"
          /* FlowGraphBlockNames.ArrayIndex */
        }
      }
    },
    outputs: {
      flows: {
        err: { name: "error" }
      }
    },
    interBlockConnectors: [
      {
        input: "animationGroup",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "animationGroups",
        inputBlockIndex: 1,
        outputBlockIndex: 2,
        isVariable: true
      }
    ],
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects, _context, globalGLTF) {
      const serializedObject = serializedObjects[serializedObjects.length - 1];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.glTF = globalGLTF;
      return serializedObjects;
    }
  },
  "animation/stopAt": {
    blocks: ["FlowGraphStopAnimationBlock", "FlowGraphArrayIndexBlock", "KHR_interactivity/FlowGraphGLTFDataProvider"],
    configuration: {},
    inputs: {
      values: {
        animation: {
          name: "index",
          gltfType: "number",
          toBlock: "FlowGraphArrayIndexBlock"
          /* FlowGraphBlockNames.ArrayIndex */
        },
        stopTime: {
          name: "stopAtFrame",
          gltfType: "number",
          convertConnectedTimeToFrames: true,
          dataTransformer: (time, parser) => [time[0] * parser._animationTargetFps]
        }
      }
    },
    outputs: {
      flows: {
        err: { name: "error" }
      }
    },
    interBlockConnectors: [
      {
        input: "animationGroup",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "animationGroups",
        inputBlockIndex: 1,
        outputBlockIndex: 2,
        isVariable: true
      }
    ],
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects, _context, globalGLTF) {
      const serializedObject = serializedObjects[serializedObjects.length - 1];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.glTF = globalGLTF;
      return serializedObjects;
    }
  },
  "math/switch": {
    blocks: [
      "FlowGraphDataSwitchBlock"
      /* FlowGraphBlockNames.DataSwitch */
    ],
    configuration: {
      cases: { name: "cases", isArray: true, inOptions: true, defaultValue: [] }
    },
    inputs: {
      values: {
        selection: { name: "case" }
      }
    },
    validation(gltfBlock) {
      const cases = gltfBlock.configuration?.cases;
      if (cases && cases.value) {
        const onlyIntegers = cases.value.every((caseValue) => {
          return typeof caseValue === "number" && /^-?\d+$/.test(caseValue.toString());
        });
        if (!onlyIntegers) {
          Logger.Warn("Switch cases should be integers. Using empty array instead.");
          cases.value = [];
          return { valid: true };
        }
        const uniqueCases = new Set(cases.value);
        cases.value = Array.from(uniqueCases);
      }
      return { valid: true };
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects) {
      const serializedObject = serializedObjects[0];
      serializedObject.dataInputs.forEach((input) => {
        if (input.name !== "default" && input.name !== "case") {
          input.name = "in_" + input.name;
        }
      });
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.treatCasesAsIntegers = true;
      return serializedObjects;
    }
  },
  "debug/log": {
    blocks: [
      "FlowGraphConsoleLogBlock"
      /* FlowGraphBlockNames.ConsoleLog */
    ],
    configuration: {
      message: { name: "messageTemplate", inOptions: true }
    }
  }
};
function getSimpleInputMapping(type, inputs = ["a"], inferType) {
  return {
    blocks: [type],
    inputs: {
      values: inputs.reduce((acc, input) => {
        acc[input] = { name: input };
        return acc;
      }, {})
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    },
    extraProcessor(gltfBlock, _declaration, _mapping, _parser, serializedObjects) {
      var _a;
      if (inferType) {
        (_a = serializedObjects[0]).config || (_a.config = {});
        serializedObjects[0].config.preventIntegerFloatArithmetic = true;
        let type2 = -1;
        Object.keys(gltfBlock.values || {}).find((value) => {
          if (gltfBlock.values?.[value].type !== void 0) {
            type2 = gltfBlock.values[value].type;
            return true;
          }
          return false;
        });
        if (type2 !== -1) {
          serializedObjects[0].config.type = _parser.arrays.types[type2].flowGraphType;
        }
      }
      return serializedObjects;
    },
    validation(gltfBlock) {
      if (inferType) {
        return ValidateTypes(gltfBlock);
      }
      return { valid: true };
    }
  };
}
function ValidateTypes(gltfBlock) {
  if (gltfBlock.values) {
    const types = Object.keys(gltfBlock.values).map((key) => gltfBlock.values[key].type).filter((type) => type !== void 0);
    const allSameType = types.every((type) => type === types[0]);
    if (!allSameType) {
      return { valid: false, error: "All inputs must be of the same type" };
    }
  }
  return { valid: true };
}
function HasOddBracketRun(segment) {
  for (let index = 0; index < segment.length; index++) {
    const character = segment[index];
    if ("[]{}".indexOf(character) === -1) {
      continue;
    }
    let runLength = 1;
    while (segment[index + runLength] === character) {
      runLength++;
    }
    if (runLength % 2 !== 0) {
      return true;
    }
    index += runLength - 1;
  }
  return false;
}
function ValidateJsonPointerTemplate(gltfBlock) {
  const pointer = gltfBlock.configuration?.pointer?.value?.[0];
  if (typeof pointer !== "string") {
    return { valid: false, error: "A pointer operation requires a string `pointer` configuration value" };
  }
  if (pointer.length !== 0 && pointer[0] !== "/") {
    return { valid: false, error: `The JSON Pointer Template "${pointer}" is not a syntactically valid JSON Pointer` };
  }
  const invalid = (reason) => ({ valid: false, error: `The JSON Pointer Template "${pointer}" is invalid: ${reason}` });
  const socketIds = /* @__PURE__ */ new Set();
  for (const segment of pointer.split("/")) {
    const isIntegerParameter = segment[0] === "[" && segment[1] !== "[";
    const isReferenceParameter = segment[0] === "{" && segment[1] !== "{";
    if (!isIntegerParameter && !isReferenceParameter) {
      if (HasOddBracketRun(segment)) {
        return invalid(`the path segment "${segment}" contains an odd number of consecutive brackets`);
      }
      continue;
    }
    const closingBracket = isIntegerParameter ? "]" : "}";
    const body = segment.substring(1, segment.length - 1);
    if (segment.length < 3 || segment[segment.length - 1] !== closingBracket || /[[{]/.test(body) || /[\]}]/.test(body)) {
      return invalid(`the template parameter path segment "${segment}" is malformed`);
    }
    const socketId = body.replace(/~1/g, "/").replace(/~0/g, "~");
    if (socketIds.has(socketId)) {
      return invalid(`the template parameter "${socketId}" is used more than once`);
    }
    socketIds.add(socketId);
  }
  return { valid: true };
}
const gltfTypeToBabylonType = {
  float: { length: 1, flowGraphType: "number", elementType: "number" },
  bool: { length: 1, flowGraphType: "boolean", elementType: "boolean" },
  float2: { length: 2, flowGraphType: "Vector2", elementType: "number" },
  float3: { length: 3, flowGraphType: "Vector3", elementType: "number" },
  float4: { length: 4, flowGraphType: "Vector4", elementType: "number" },
  float4x4: { length: 16, flowGraphType: "Matrix", elementType: "number" },
  float2x2: { length: 4, flowGraphType: "Matrix2D", elementType: "number" },
  float3x3: { length: 9, flowGraphType: "Matrix3D", elementType: "number" },
  int: { length: 1, flowGraphType: "FlowGraphInteger", elementType: "number" },
  // KHR_interactivity opaque reference type. Represented as a JSON Pointer string
  // (e.g. "/nodes/17/") that addresses a glTF object. The empty string is the
  // canonical "null reference" sentinel used by the parser.
  ref: { length: 1, flowGraphType: "string", elementType: "string" }
};
class InteractivityGraphToFlowGraphParser {
  constructor(_interactivityGraph, _gltf, _animationTargetFps = 60) {
    this._interactivityGraph = _interactivityGraph;
    this._gltf = _gltf;
    this._animationTargetFps = _animationTargetFps;
    this._types = [];
    this._mappings = [];
    this._staticVariables = [];
    this._events = [];
    this._internalEventsCounter = 0;
    this._nodes = [];
    this._insertedBlocks = [];
    this._parseTypes();
    this._parseDeclarations();
    this._parseVariables();
    this._parseEvents();
    this._parseNodes();
  }
  get arrays() {
    return {
      types: this._types,
      mappings: this._mappings,
      staticVariables: this._staticVariables,
      events: this._events,
      nodes: this._nodes
    };
  }
  _parseTypes() {
    if (!this._interactivityGraph.types) {
      return;
    }
    for (const type of this._interactivityGraph.types) {
      this._types.push(gltfTypeToBabylonType[type.signature]);
    }
  }
  _parseDeclarations() {
    if (!this._interactivityGraph.declarations) {
      return;
    }
    for (const declaration of this._interactivityGraph.declarations) {
      const mapping = getMappingForDeclaration(declaration);
      if (!mapping) {
        Logger.Error(["No mapping found for declaration", declaration]);
        throw new Error("Error parsing declarations");
      }
      this._mappings.push({
        flowGraphMapping: mapping,
        fullOperationName: declaration.extension ? declaration.op + ":" + declaration.extension : declaration.op
      });
    }
  }
  _parseVariables() {
    if (!this._interactivityGraph.variables) {
      return;
    }
    for (const variable of this._interactivityGraph.variables) {
      const parsed = this._parseVariable(variable);
      this._staticVariables.push(parsed);
    }
  }
  _parseVariable(variable, dataTransform) {
    const type = this._types[variable.type];
    if (!type) {
      Logger.Error(["No type found for variable", variable]);
      throw new Error("Error parsing variables");
    }
    if (variable.value) {
      if (variable.value.length !== type.length) {
        Logger.Error(["Invalid value length for variable", variable, type]);
        throw new Error("Error parsing variables");
      }
    }
    const value = variable.value || [];
    if (!value.length) {
      switch (type.flowGraphType) {
        case "boolean":
          value.push(false);
          break;
        case "FlowGraphInteger":
          value.push(0);
          break;
        case "number":
          value.push(NaN);
          break;
        case "string":
          value.push("");
          break;
        case "Vector2":
          value.push(NaN, NaN);
          break;
        case "Vector3":
          value.push(NaN, NaN, NaN);
          break;
        case "Vector4":
        case "Matrix2D":
        case "Quaternion":
          value.fill(NaN, 0, 4);
          break;
        case "Matrix":
          value.fill(NaN, 0, 16);
          break;
        case "Matrix3D":
          value.fill(NaN, 0, 9);
          break;
      }
    }
    if (type.elementType === "number" && typeof value[0] === "string") {
      value[0] = parseFloat(value[0]);
    }
    return { type: type.flowGraphType, value: dataTransform ? dataTransform(value, this) : value };
  }
  _parseEvents() {
    if (!this._interactivityGraph.events) {
      return;
    }
    for (const event of this._interactivityGraph.events) {
      const converted = {
        eventId: event.id || "internalEvent_" + this._internalEventsCounter++
      };
      if (event.values) {
        converted.eventData = Object.keys(event.values).map((key) => {
          const eventValue = event.values?.[key];
          if (!eventValue) {
            Logger.Error(["No value found for event key", key]);
            throw new Error("Error parsing events");
          }
          const type = this._types[eventValue.type];
          if (!type) {
            Logger.Error(["No type found for event value", eventValue]);
            throw new Error("Error parsing events");
          }
          const value = typeof eventValue.value !== "undefined" ? this._parseVariable(eventValue) : void 0;
          return {
            id: key,
            type: type.flowGraphType,
            eventData: true,
            value
          };
        });
      }
      this._events.push(converted);
    }
  }
  _parseNodes() {
    if (!this._interactivityGraph.nodes) {
      return;
    }
    for (const node of this._interactivityGraph.nodes) {
      if (typeof node.declaration !== "number") {
        Logger.Error(["No declaration found for node", node]);
        throw new Error("Error parsing nodes");
      }
      const mapping = this._mappings[node.declaration];
      if (!mapping) {
        Logger.Error(["No mapping found for node", node]);
        throw new Error("Error parsing nodes");
      }
      if (mapping.flowGraphMapping.validation) {
        const validationResult = mapping.flowGraphMapping.validation(node, this._interactivityGraph, this._gltf);
        if (!validationResult.valid) {
          throw new Error(`Error validating interactivity node ${this._interactivityGraph.declarations?.[node.declaration].op} - ${validationResult.error}`);
        }
      }
      const blocks = [];
      for (const blockType of mapping.flowGraphMapping.blocks) {
        const block = this._getEmptyBlock(blockType, mapping.fullOperationName);
        this._parseNodeConfiguration(node, block, mapping.flowGraphMapping, blockType);
        blocks.push(block);
      }
      this._nodes.push({ blocks, fullOperationName: mapping.fullOperationName });
    }
  }
  _getEmptyBlock(className, type) {
    return {
      uniqueId: RandomGUID(),
      className,
      dataInputs: [],
      dataOutputs: [],
      signalInputs: [],
      signalOutputs: [],
      config: {},
      type,
      metadata: {}
    };
  }
  _parseNodeConfiguration(node, block, nodeMapping, blockType) {
    const gltfConfiguration = node.configuration;
    if (gltfConfiguration) {
      for (const key in gltfConfiguration) {
        const gltfProperty = gltfConfiguration[key];
        if (!gltfProperty) {
          throw new Error("Error parsing node configuration");
        }
        const propertyMapping = nodeMapping.configuration?.[key];
        const belongsToBlock = propertyMapping && propertyMapping.toBlock ? propertyMapping.toBlock === blockType : nodeMapping.blocks.indexOf(blockType) === 0;
        if (belongsToBlock) {
          let value = propertyMapping?.defaultValue;
          if (gltfProperty?.value) {
            value = gltfProperty.value;
          }
          if (!propertyMapping?.isArray) {
            if (value.length !== 1) {
              Logger.Warn(`Invalid non-array value length: ${value.length}`);
            }
            value = value[0];
          }
          if (propertyMapping?.dataTransformer) {
            value = propertyMapping.dataTransformer(value, this);
          }
          if (value !== void 0) {
            block.config[propertyMapping?.name || key] = {
              value
            };
          }
        }
      }
    }
  }
  _parseNodeConnections(context) {
    for (let i = 0; i < this._nodes.length; i++) {
      const gltfNode = this._interactivityGraph.nodes?.[i];
      if (!gltfNode) {
        Logger.Error(["No node found for interactivity node", this._nodes[i]]);
        throw new Error("Error parsing node connections");
      }
      const flowGraphBlocks = this._nodes[i];
      const outputMapper = this._mappings[gltfNode.declaration];
      if (!outputMapper) {
        Logger.Error(["No mapping found for node", gltfNode]);
        throw new Error("Error parsing node connections");
      }
      if (flowGraphBlocks.blocks.length === 0) {
        Logger.Warn(`Skipping connections for no-op node #${i} (unsupported operation: ${flowGraphBlocks.fullOperationName})`);
        continue;
      }
      const flowsFromGLTF = gltfNode.flows || {};
      const flowsKeys = Object.keys(flowsFromGLTF).sort();
      for (const flowKey of flowsKeys) {
        const flow = flowsFromGLTF[flowKey];
        const flowMapping = outputMapper.flowGraphMapping.outputs?.flows?.[flowKey];
        const socketOutName = flowMapping?.name || flowKey;
        const inputNodeId = flow.node;
        const nodeIn = this._nodes[inputNodeId];
        if (!nodeIn) {
          Logger.Error(["No node found for input node id", inputNodeId]);
          throw new Error("Error parsing node connections");
        }
        if (nodeIn.blocks.length === 0) {
          Logger.Warn(`Dropping flow connection from node #${i} "${flowKey}" to no-op node #${inputNodeId} (unsupported operation: ${nodeIn.fullOperationName})`);
          continue;
        }
        const socketOut = this._createNewSocketConnection(socketOutName, true);
        const block = flowMapping && flowMapping.toBlock && flowGraphBlocks.blocks.find((b) => b.className === flowMapping.toBlock) || flowGraphBlocks.blocks[0];
        block.signalOutputs.push(socketOut);
        const inputMapper = getMappingForFullOperationName(nodeIn.fullOperationName);
        if (!inputMapper) {
          Logger.Error(["No mapping found for input node", nodeIn]);
          throw new Error("Error parsing node connections");
        }
        let flowInMapping = inputMapper.inputs?.flows?.[flow.socket || "in"];
        let arrayMapping = false;
        if (!flowInMapping) {
          for (const key in inputMapper.inputs?.flows) {
            if (key.startsWith("[") && key.endsWith("]")) {
              arrayMapping = true;
              flowInMapping = inputMapper.inputs?.flows?.[key];
            }
          }
        }
        const nodeInSocketName = flowInMapping ? arrayMapping ? flowInMapping.name.replace("$1", flow.socket || "") : flowInMapping.name : flow.socket || "in";
        const inputBlock = flowInMapping && flowInMapping.toBlock && nodeIn.blocks.find((b) => b.className === flowInMapping.toBlock) || nodeIn.blocks[0];
        let socketIn = inputBlock.signalInputs.find((s) => s.name === nodeInSocketName);
        if (!socketIn) {
          socketIn = this._createNewSocketConnection(nodeInSocketName);
          inputBlock.signalInputs.push(socketIn);
        }
        socketIn.connectedPointIds.push(socketOut.uniqueId);
        socketOut.connectedPointIds.push(socketIn.uniqueId);
      }
      const valuesFromGLTF = gltfNode.values || {};
      const valuesKeys = Object.keys(valuesFromGLTF);
      for (const valueKey of valuesKeys) {
        const value = valuesFromGLTF[valueKey];
        let valueMapping = outputMapper.flowGraphMapping.inputs?.values?.[valueKey];
        let arrayMapping = false;
        if (!valueMapping) {
          for (const key in outputMapper.flowGraphMapping.inputs?.values) {
            if (key.startsWith("[") && key.endsWith("]")) {
              arrayMapping = true;
              valueMapping = outputMapper.flowGraphMapping.inputs?.values?.[key];
            }
          }
        }
        const socketInName = valueMapping ? arrayMapping ? valueMapping.name.replace("$1", valueKey) : valueMapping.name : valueKey;
        const socketIn = this._createNewSocketConnection(socketInName);
        const block = valueMapping && valueMapping.toBlock && flowGraphBlocks.blocks.find((b) => b.className === valueMapping.toBlock) || flowGraphBlocks.blocks[0];
        block.dataInputs.push(socketIn);
        const convertConnectedTimeToFrames = !!valueMapping?.convertConnectedTimeToFrames;
        if (value.value !== void 0) {
          const convertedValue = this._parseVariable(value, valueMapping && valueMapping.dataTransformer);
          context._connectionValues[socketIn.uniqueId] = convertedValue;
        } else if (typeof value.node !== "undefined") {
          const nodeOutId = value.node;
          const nodeOutSocketName = value.socket || "value";
          const nodeOut = this._nodes[nodeOutId];
          if (!nodeOut) {
            Logger.Error(["No node found for output socket reference", value]);
            throw new Error("Error parsing node connections");
          }
          if (nodeOut.blocks.length === 0) {
            Logger.Warn(`Dropping value connection from no-op node #${nodeOutId} (unsupported operation: ${nodeOut.fullOperationName}) into node #${i} "${valueKey}"; consumer will use type-default value`);
            continue;
          }
          const outputMapper2 = getMappingForFullOperationName(nodeOut.fullOperationName);
          if (!outputMapper2) {
            Logger.Error(["No mapping found for output socket reference", value]);
            throw new Error("Error parsing node connections");
          }
          let valueMapping2 = outputMapper2.outputs?.values?.[nodeOutSocketName];
          let arrayMapping2 = false;
          if (!valueMapping2) {
            for (const key in outputMapper2.outputs?.values) {
              if (key.startsWith("[") && key.endsWith("]")) {
                arrayMapping2 = true;
                valueMapping2 = outputMapper2.outputs?.values?.[key];
              }
            }
          }
          const socketOutName = valueMapping2 ? arrayMapping2 ? valueMapping2.name.replace("$1", nodeOutSocketName) : valueMapping2?.name : nodeOutSocketName;
          const outBlock = valueMapping2 && valueMapping2.toBlock && nodeOut.blocks.find((b) => b.className === valueMapping2.toBlock) || nodeOut.blocks[0];
          let socketOut = outBlock.dataOutputs.find((s) => s.name === socketOutName);
          if (!socketOut) {
            socketOut = this._createNewSocketConnection(socketOutName, true);
            outBlock.dataOutputs.push(socketOut);
          }
          if (convertConnectedTimeToFrames) {
            this._connectWithSecondsToFramesConversion(context, socketOut, socketIn);
          } else {
            socketIn.connectedPointIds.push(socketOut.uniqueId);
            socketOut.connectedPointIds.push(socketIn.uniqueId);
          }
        } else {
          Logger.Error(["Invalid value for value connection", value]);
          throw new Error("Error parsing node connections");
        }
      }
      if (outputMapper.flowGraphMapping.interBlockConnectors) {
        for (const connector of outputMapper.flowGraphMapping.interBlockConnectors) {
          const input = connector.input;
          const output = connector.output;
          const isVariable = connector.isVariable;
          this._connectFlowGraphNodes(input, output, flowGraphBlocks.blocks[connector.inputBlockIndex], flowGraphBlocks.blocks[connector.outputBlockIndex], isVariable);
        }
      }
      if (outputMapper.flowGraphMapping.extraProcessor) {
        const declaration = this._interactivityGraph.declarations?.[gltfNode.declaration];
        if (!declaration) {
          Logger.Error(["No declaration found for extra processor", gltfNode]);
          throw new Error("Error parsing node connections");
        }
        flowGraphBlocks.blocks = outputMapper.flowGraphMapping.extraProcessor(gltfNode, declaration, outputMapper.flowGraphMapping, this, flowGraphBlocks.blocks, context, this._gltf);
      }
    }
  }
  _createNewSocketConnection(name, isOutput) {
    return {
      uniqueId: RandomGUID(),
      name,
      _connectionType: isOutput ? 1 : 0,
      connectedPointIds: []
    };
  }
  /**
   * Wires an upstream data output into a downstream data input through a runtime multiply block that
   * scales the value by the animation target fps. This converts a KHR animation time (seconds),
   * delivered by a connection (e.g. a `pointer/get` on the `maxTime` animation pointer), into the
   * Babylon animation frames expected by the play/stop-animation blocks. Literal times are already
   * converted at parse time by the input's `dataTransformer`, so this is only used for connections.
   * @param context the serialized flow graph context that stores literal socket values
   * @param upstreamOutput the data output socket providing the time value (in seconds)
   * @param downstreamInput the data input socket that expects the time in frames
   */
  _connectWithSecondsToFramesConversion(context, upstreamOutput, downstreamInput) {
    const multiplyBlock = this._getEmptyBlock(
      "FlowGraphMultiplyBlock",
      "FlowGraphMultiplyBlock"
      /* FlowGraphBlockNames.Multiply */
    );
    multiplyBlock.config = {
      type: "number"
      /* FlowGraphTypes.Number */
    };
    const inputA = this._createNewSocketConnection("a");
    const inputB = this._createNewSocketConnection("b");
    const output = this._createNewSocketConnection("value", true);
    multiplyBlock.dataInputs.push(inputA, inputB);
    multiplyBlock.dataOutputs.push(output);
    context._connectionValues[inputB.uniqueId] = { type: "number", value: [this._animationTargetFps] };
    inputA.connectedPointIds.push(upstreamOutput.uniqueId);
    upstreamOutput.connectedPointIds.push(inputA.uniqueId);
    downstreamInput.connectedPointIds.push(output.uniqueId);
    output.connectedPointIds.push(downstreamInput.uniqueId);
    this._insertedBlocks.push(multiplyBlock);
  }
  _connectFlowGraphNodes(input, output, serializedInput, serializedOutput, isVariable) {
    const inputArray = isVariable ? serializedInput.dataInputs : serializedInput.signalInputs;
    const outputArray = isVariable ? serializedOutput.dataOutputs : serializedOutput.signalOutputs;
    const inputConnection = inputArray.find((s) => s.name === input) || this._createNewSocketConnection(input);
    const outputConnection = outputArray.find((s) => s.name === output) || this._createNewSocketConnection(output, true);
    if (!inputArray.find((s) => s.name === input)) {
      inputArray.push(inputConnection);
    }
    if (!outputArray.find((s) => s.name === output)) {
      outputArray.push(outputConnection);
    }
    inputConnection.connectedPointIds.push(outputConnection.uniqueId);
    outputConnection.connectedPointIds.push(inputConnection.uniqueId);
  }
  /**
   * Returns the deterministic FlowGraph user-variable name used for the
   * static variable at the given declaration index.
   * @param index zero-based index into the interactivity graph's `variables` array.
   * @returns the FlowGraph variable name (e.g. `staticVariable_3`).
   */
  getVariableName(index) {
    return "staticVariable_" + index;
  }
  /**
   * Serializes the parsed interactivity graph into the {@link ISerializedFlowGraph}
   * payload consumed by `ParseFlowGraphAsync`. Performs node-connection wiring
   * and seeds the execution context with the graph's static variables.
   * @returns the serialized FlowGraph for the parsed KHR_interactivity graph.
   */
  serializeToFlowGraph() {
    const context = {
      uniqueId: RandomGUID(),
      _userVariables: {},
      _connectionValues: {}
    };
    this._parseNodeConnections(context);
    for (let i = 0; i < this._staticVariables.length; i++) {
      const variable = this._staticVariables[i];
      context._userVariables[this.getVariableName(i)] = variable;
    }
    const allBlocks = this._nodes.reduce((acc, val) => acc.concat(val.blocks), []).concat(this._insertedBlocks);
    return {
      rightHanded: true,
      allBlocks,
      executionContexts: [context]
    };
  }
}
class CompositePathToObjectConverter {
  /**
   * @param _prefixes prefix-keyed converter table, tried in order
   * @param _fallback converter used when no prefix entry matches
   */
  constructor(_prefixes, _fallback) {
    this._prefixes = _prefixes;
    this._fallback = _fallback;
  }
  /**
   * Adds a new prefix entry at the front of the lookup list so it is tried
   * before any entries registered earlier. Useful for late-registered
   * loader extensions that want to override or augment a previously
   * registered namespace.
   * @param entry the entry to add
   */
  addPrefix(entry) {
    this._prefixes.unshift(entry);
  }
  /**
   * @param path the JSON Pointer path to resolve
   * @returns an object accessor for the resolved property
   */
  convert(path) {
    for (const { prefix, converter } of this._prefixes) {
      if (path.startsWith(prefix)) {
        return converter.convert(path);
      }
    }
    return this._fallback.convert(path);
  }
}
const BABYLON_SCENE_OBJECT_MODEL_PREFIX = "/extensions/BABYLON_scene_objects/";
class BabylonScenePathToObjectConverter {
  constructor(_scene, _tree) {
    this._scene = _scene;
    this._tree = _tree;
  }
  /**
   * @param path the full JSON Pointer (must start with the Babylon prefix)
   * @returns an object-info container holding the resolved instance and accessor
   */
  convert(path) {
    if (!path.startsWith(BABYLON_SCENE_OBJECT_MODEL_PREFIX)) {
      throw new Error(`BabylonScenePathToObjectConverter: path "${path}" does not start with the expected prefix "${BABYLON_SCENE_OBJECT_MODEL_PREFIX}".`);
    }
    const tail = path.slice(BABYLON_SCENE_OBJECT_MODEL_PREFIX.length);
    const parts = tail.split("/").filter((p) => p.length > 0);
    if (parts.length === 0) {
      throw new Error(`BabylonScenePathToObjectConverter: path "${path}" is missing a collection name.`);
    }
    const collectionName = parts[0];
    const collection = this._tree[collectionName];
    if (!collection) {
      throw new Error(`BabylonScenePathToObjectConverter: unknown collection "${collectionName}" in path "${path}".`);
    }
    if (parts.length === 2 && parts[1] === "length") {
      const arr = this._getCollectionArray(collectionName);
      return { object: arr, info: collection.length };
    }
    if (parts.length < 2) {
      throw new Error(`BabylonScenePathToObjectConverter: path "${path}" is missing an instance id.`);
    }
    if (!/^\d+$/.test(parts[1])) {
      throw new Error(`BabylonScenePathToObjectConverter: invalid uniqueId "${parts[1]}" in path "${path}".`);
    }
    const uniqueId = parseInt(parts[1], 10);
    if (!Number.isFinite(uniqueId) || uniqueId < 0) {
      throw new Error(`BabylonScenePathToObjectConverter: invalid uniqueId "${parts[1]}" in path "${path}".`);
    }
    const instance = this._lookupInstanceByUniqueId(collectionName, uniqueId);
    if (!instance) {
      throw new Error(`BabylonScenePathToObjectConverter: no ${collectionName} instance found with uniqueId ${uniqueId} (path "${path}").`);
    }
    if (parts.length === 2) {
      return {
        object: instance,
        info: this._buildIdentityAccessor(instance)
      };
    }
    if (parts.length > 3) {
      throw new Error(`BabylonScenePathToObjectConverter: nested property paths are not yet supported (path "${path}").`);
    }
    const propertyName = parts[2];
    const leaf = collection.__array__[propertyName];
    if (!leaf || typeof leaf === "boolean") {
      throw new Error(`BabylonScenePathToObjectConverter: property "${propertyName}" is not registered on ${collectionName} (path "${path}").`);
    }
    return {
      object: instance,
      info: leaf
    };
  }
  _getCollectionArray(collectionName) {
    switch (collectionName) {
      case "transformNodes":
        return this._scene.transformNodes;
      case "meshes":
        return this._scene.meshes;
      case "materials":
        return this._scene.materials;
      default:
        return [];
    }
  }
  _lookupInstanceByUniqueId(collectionName, uniqueId) {
    switch (collectionName) {
      case "transformNodes": {
        const direct = this._scene.transformNodes.find((n) => n.uniqueId === uniqueId);
        if (direct) {
          return direct;
        }
        return this._scene.meshes.find((m) => m.uniqueId === uniqueId);
      }
      case "meshes":
        return this._scene.meshes.find((m) => m.uniqueId === uniqueId);
      case "materials":
        return this._scene.materials.find((m) => m.uniqueId === uniqueId);
      default:
        return void 0;
    }
  }
  _buildIdentityAccessor(instance) {
    return {
      type: "object",
      get: () => instance,
      getTarget: () => instance,
      isReadOnly: true
    };
  }
}
function CreateDefaultBabylonSceneObjectModelTree() {
  return {
    transformNodes: {
      length: {
        type: "number",
        get: (arr) => arr.length,
        getTarget: (arr) => arr
      },
      __array__: {
        __target__: true,
        name: {
          type: "string",
          get: (n) => n.name,
          set: (v, n) => {
            n.name = v;
          },
          getTarget: (n) => n
        },
        translation: {
          type: "Vector3",
          get: (n) => n.position,
          set: (v, n) => n.position.copyFrom(v),
          getTarget: (n) => n
        },
        rotation: {
          type: "Quaternion",
          get: (n) => n.rotationQuaternion ?? Quaternion.RotationYawPitchRoll(n.rotation.y, n.rotation.x, n.rotation.z),
          set: (v, n) => {
            if (!n.rotationQuaternion) {
              n.rotationQuaternion = v.clone();
            } else {
              n.rotationQuaternion.copyFrom(v);
            }
          },
          getTarget: (n) => n
        },
        scale: {
          type: "Vector3",
          get: (n) => n.scaling,
          set: (v, n) => n.scaling.copyFrom(v),
          getTarget: (n) => n
        },
        matrix: {
          type: "Matrix",
          get: (n) => n.computeWorldMatrix(false),
          getTarget: (n) => n,
          isReadOnly: true
        },
        globalMatrix: {
          type: "Matrix",
          get: (n) => n.computeWorldMatrix(true),
          getTarget: (n) => n,
          isReadOnly: true
        }
      }
    },
    meshes: {
      length: {
        type: "number",
        get: (arr) => arr.length,
        getTarget: (arr) => arr
      },
      __array__: {
        __target__: true,
        name: {
          type: "string",
          get: (m) => m.name,
          set: (v, m) => {
            m.name = v;
          },
          getTarget: (m) => m
        },
        visible: {
          type: "boolean",
          get: (m) => m.isVisible,
          set: (v, m) => {
            m.isVisible = v;
          },
          getTarget: (m) => m
        }
      }
    },
    materials: {
      length: {
        type: "number",
        get: (arr) => arr.length,
        getTarget: (arr) => arr
      },
      __array__: {
        __target__: true,
        name: {
          type: "string",
          get: (m) => m.name,
          set: (v, m) => {
            m.name = v;
          },
          getTarget: (m) => m
        }
      }
    }
  };
}
const EventReferencePrefix = "/extensions/KHR_interactivity/events/";
const DelayReferencePrefix = "/extensions/KHR_interactivity/delays/";
function GetEventReference(key) {
  return EventReferencePrefix + key;
}
function GetEventReferenceKey(reference) {
  return IsEventReference(reference) ? reference.substring(EventReferencePrefix.length) : void 0;
}
function IsEventReference(value) {
  return typeof value === "string" && value.startsWith(EventReferencePrefix);
}
const RefValidityTarget = { isKhrInteractivityRef: true };
class InteractivityRefPathToObjectConverter {
  /**
   * @param path the (template-substituted) JSON Pointer to resolve
   * @returns an object accessor whose `get` validates the reference
   */
  convert(path) {
    const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
    if (normalized.startsWith(EventReferencePrefix)) {
      const key = normalized.substring(EventReferencePrefix.length);
      return {
        object: RefValidityTarget,
        info: {
          type: "object",
          isReadOnly: true,
          // A non-empty key means a real event reference was supplied (the
          // template substitution rejects null refs before we get here).
          get: () => key.length > 0 ? normalized : void 0,
          getTarget: () => RefValidityTarget
        }
      };
    }
    const rawIndex = normalized.substring(DelayReferencePrefix.length);
    const index = /^\d+$/.test(rawIndex) ? parseInt(rawIndex, 10) : NaN;
    return {
      object: RefValidityTarget,
      info: {
        type: "object",
        isReadOnly: true,
        get: (_target, _index, payload) => {
          const context = payload;
          if (!context || isNaN(index) || index < 0) {
            return void 0;
          }
          return IsDelayActive(context, index) ? new FlowGraphInteger(index) : void 0;
        },
        getTarget: () => RefValidityTarget
      }
    };
  }
}
const InteractivityAssetCapabilitiesPrefix = "/extensions/KHR_interactivity/asset/";
const InteractivityLimitsPrefix = "/extensions/KHR_interactivity/limits/";
const MaxSupportedGltfVersion = { major: 2, minor: 0 };
const UndisclosedRuntimeLimit = 2147483647;
const RuntimeLimits = {
  maxActiveAnimations: UndisclosedRuntimeLimit,
  maxActiveDelays: UndisclosedRuntimeLimit,
  maxActivePropertyInterpolations: UndisclosedRuntimeLimit,
  maxActiveVariableInterpolations: UndisclosedRuntimeLimit
};
const AssetCapabilityTarget = { isKhrInteractivityAssetCapability: true };
function GetEffectiveGltfVersion(version) {
  const [rawMajor, rawMinor] = (version ?? "").split(".");
  const major = parseInt(rawMajor, 10);
  const minor = parseInt(rawMinor, 10);
  if (isNaN(major)) {
    return MaxSupportedGltfVersion;
  }
  if (major !== MaxSupportedGltfVersion.major) {
    return major < MaxSupportedGltfVersion.major ? { major, minor: isNaN(minor) ? 0 : minor } : MaxSupportedGltfVersion;
  }
  return { major, minor: Math.min(isNaN(minor) ? 0 : minor, MaxSupportedGltfVersion.minor) };
}
class InteractivityAssetPathToObjectConverter {
  /**
   * @param _gltf the loaded glTF, used to read the asset version
   * @param _isExtensionEnabled predicate telling whether a glTF extension is both used by the asset and supported
   * by this loader
   */
  constructor(_gltf, _isExtensionEnabled) {
    this._gltf = _gltf;
    this._isExtensionEnabled = _isExtensionEnabled;
  }
  /**
   * @param path the JSON Pointer to resolve
   * @returns an object accessor for the addressed capability
   * @throws if the path does not address a known capability, which `pointer/get` surfaces as `isValid = false`
   */
  convert(path) {
    const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
    if (normalized.startsWith(InteractivityLimitsPrefix)) {
      const limit = RuntimeLimits[normalized.substring(InteractivityLimitsPrefix.length)];
      if (limit === void 0) {
        throw new Error(`Path ${path} is invalid`);
      }
      return this._createAccessor("number", () => limit);
    }
    const capability = normalized.substring(InteractivityAssetCapabilitiesPrefix.length);
    if (capability === "majorVersion" || capability === "minorVersion") {
      return this._createAccessor("number", () => GetEffectiveGltfVersion(this._gltf.asset?.version)[capability === "majorVersion" ? "major" : "minor"]);
    }
    const segments = capability.split("/");
    if (segments.length === 3 && segments[0] === "extensions" && segments[2] === "enabled") {
      const extensionName = segments[1];
      return this._createAccessor("boolean", () => this._isExtensionEnabled(extensionName));
    }
    throw new Error(`Path ${path} is invalid`);
  }
  _createAccessor(type, get) {
    return {
      object: AssetCapabilityTarget,
      info: {
        type,
        isReadOnly: true,
        get,
        getTarget: () => AssetCapabilityTarget
      }
    };
  }
}
class InteractivityHostResolver {
  /**
   * @param key the FlowGraph event source key
   * @returns the KHR_interactivity event reference
   */
  encodeEventReference(key) {
    return GetEventReference(key);
  }
  /**
   * @param reference the value to decode
   * @returns the FlowGraph event source key, or `undefined` when the value is not an event reference
   */
  decodeEventReference(reference) {
    return GetEventReferenceKey(reference);
  }
  /**
   * @param reference the reference to decode
   * @returns the index the reference denotes, or `undefined` when it is not an indexed JSON Pointer
   */
  decodeIndexReference(reference) {
    if (reference.length === 0 || reference[0] !== "/") {
      return void 0;
    }
    const tail = reference.substring(reference.lastIndexOf("/") + 1);
    if (!/^(0|[1-9]\d*)$/.test(tail)) {
      return void 0;
    }
    return parseInt(tail, 10);
  }
  /**
   * Maps a Babylon object loaded from the glTF back to a JSON Pointer addressing it.
   *
   * The glTF loader stamps `_internalMetadata.gltf.pointers` with one entry per JSON Pointer the
   * object can be addressed by; a single-primitive mesh, for example, holds both `/nodes/<i>` and
   * `/meshes/<j>/primitives/<k>`. The hint is the path segment preceding the template parameter
   * being resolved, so a template like `/nodes/{nodeRef}/globalMatrix` picks the `/nodes/<i>`
   * pointer even when another pointer was added to the object first.
   * @param object the Babylon object to address
   * @param hint the expected root segment of the pointer, when known
   * @returns the JSON Pointer for the object, or `undefined` when it is not addressable
   */
  getObjectReference(object, hint) {
    const pointers = object._internalMetadata?.gltf?.pointers;
    if (!Array.isArray(pointers)) {
      return void 0;
    }
    const stringPointers = pointers.filter((pointer) => typeof pointer === "string");
    if (stringPointers.length === 0) {
      return void 0;
    }
    if (hint) {
      const match = stringPointers.find((pointer) => pointer.split("/")[1] === hint);
      if (match) {
        return match;
      }
    }
    return stringPointers[0];
  }
}
const NAME$4 = "KHR_interactivity";
class KHR_interactivity {
  /**
   * @internal
   * @param _loader
   */
  constructor(_loader) {
    this._loader = _loader;
    this.name = NAME$4;
    this.enabled = this._loader.isExtensionUsed(NAME$4);
    this._gltfPathConverter = GetPathToObjectConverter(this._loader.gltf);
    const scene = _loader.babylonScene;
    if (this._gltfPathConverter) {
      const initialPrefixes = [];
      if (scene) {
        initialPrefixes.push({
          prefix: BABYLON_SCENE_OBJECT_MODEL_PREFIX,
          converter: new BabylonScenePathToObjectConverter(scene, CreateDefaultBabylonSceneObjectModelTree())
        });
      }
      const refConverter = new InteractivityRefPathToObjectConverter();
      initialPrefixes.push({ prefix: EventReferencePrefix, converter: refConverter });
      initialPrefixes.push({ prefix: DelayReferencePrefix, converter: refConverter });
      const enabledExtensions = new Set((this._loader.gltf.extensionsUsed ?? []).filter((name) => registeredGLTFExtensions.has(name) && this._loader.parent.extensionOptions[name]?.enabled !== false));
      const assetConverter = new InteractivityAssetPathToObjectConverter(this._loader.gltf, (extensionName) => enabledExtensions.has(extensionName));
      initialPrefixes.push({ prefix: InteractivityAssetCapabilitiesPrefix, converter: assetConverter });
      initialPrefixes.push({ prefix: InteractivityLimitsPrefix, converter: assetConverter });
      this._pathConverter = new CompositePathToObjectConverter(initialPrefixes, this._gltfPathConverter);
    }
    _loader._skipStartAnimationStep = true;
    if (scene) {
      _AddInteractivityObjectModel(scene);
    }
  }
  dispose() {
    this._loader = null;
    delete this._gltfPathConverter;
    delete this._pathConverter;
  }
  // eslint-disable-next-line no-restricted-syntax, @typescript-eslint/no-misused-promises
  async onReady() {
    if (!this._loader.babylonScene || !this._pathConverter) {
      return;
    }
    const scene = this._loader.babylonScene;
    const interactivityDefinition = this._loader.gltf.extensions?.KHR_interactivity;
    if (!interactivityDefinition) {
      return;
    }
    await Promise.all(interactivityDefinition.graphs.map(async (graph, index) => {
      const coordinator = new FlowGraphCoordinator({ scene, hostResolver: new InteractivityHostResolver() });
      coordinator.dispatchEventsSynchronously = false;
      try {
        const parser = new InteractivityGraphToFlowGraphParser(graph, this._loader.gltf, this._loader.parent.targetFps);
        await ParseFlowGraphAsync(parser.serializeToFlowGraph(), { coordinator, pathConverter: this._pathConverter });
        coordinator.start();
      } catch (error) {
        Logger.Error(`KHR_interactivity: rejecting behavior graph #${index}: ${error?.message ?? error}`);
        coordinator.dispose();
      }
    }));
  }
}
function _AddInteractivityObjectModel(scene) {
  AddObjectAccessorToKey("/extensions/KHR_interactivity/?/activeCamera/rotation", {
    get: () => {
      if (!scene.activeCamera) {
        return new Quaternion(NaN, NaN, NaN, NaN);
      }
      const quat = Quaternion.FromRotationMatrix(scene.activeCamera.getWorldMatrix()).normalize();
      if (!scene.useRightHandedSystem) {
        quat.w *= -1;
        quat.x *= -1;
      }
      return quat;
    },
    type: "Quaternion",
    getTarget: () => scene.activeCamera
  });
  AddObjectAccessorToKey("/extensions/KHR_interactivity/?/activeCamera/position", {
    get: () => {
      if (!scene.activeCamera) {
        return new Vector3(NaN, NaN, NaN);
      }
      const pos = scene.activeCamera.getWorldMatrix().getTranslation();
      if (!scene.useRightHandedSystem) {
        pos.x *= -1;
      }
      return pos;
    },
    type: "Vector3",
    getTarget: () => scene.activeCamera
  });
  const getActivePerspectiveValue = (compute) => {
    const camera = scene.activeCamera;
    if (!camera || camera.mode === Constants.ORTHOGRAPHIC_CAMERA) {
      return NaN;
    }
    return compute(camera);
  };
  const getActiveOrthographicValue = (compute) => {
    const camera = scene.activeCamera;
    if (!camera || camera.mode !== Constants.ORTHOGRAPHIC_CAMERA) {
      return NaN;
    }
    return compute(camera);
  };
  AddObjectAccessorToKey("/extensions/KHR_interactivity/?/activeCamera/perspective/aspectRatio", {
    get: () => getActivePerspectiveValue((camera) => camera.getEngine().getAspectRatio(camera)),
    type: "number",
    getTarget: () => scene.activeCamera
  });
  AddObjectAccessorToKey("/extensions/KHR_interactivity/?/activeCamera/perspective/yfov", {
    get: () => getActivePerspectiveValue((camera) => {
      if (camera.fovMode === Constants.FOVMODE_VERTICAL_FIXED) {
        return camera.fov;
      }
      const aspectRatio = camera.getEngine().getAspectRatio(camera);
      return aspectRatio ? 2 * Math.atan(Math.tan(camera.fov / 2) / aspectRatio) : camera.fov;
    }),
    type: "number",
    getTarget: () => scene.activeCamera
  });
  AddObjectAccessorToKey("/extensions/KHR_interactivity/?/activeCamera/perspective/znear", {
    get: () => getActivePerspectiveValue((camera) => camera.minZ),
    type: "number",
    getTarget: () => scene.activeCamera
  });
  AddObjectAccessorToKey("/extensions/KHR_interactivity/?/activeCamera/perspective/zfar", {
    get: () => getActivePerspectiveValue((camera) => camera.maxZ === 0 ? Infinity : camera.maxZ),
    type: "number",
    getTarget: () => scene.activeCamera
  });
  AddObjectAccessorToKey("/extensions/KHR_interactivity/?/activeCamera/orthographic/xmag", {
    get: () => getActiveOrthographicValue((camera) => {
      const halfWidth = camera.getEngine().getRenderWidth() / 2;
      return ((camera.orthoRight ?? halfWidth) - (camera.orthoLeft ?? -halfWidth)) / 2;
    }),
    type: "number",
    getTarget: () => scene.activeCamera
  });
  AddObjectAccessorToKey("/extensions/KHR_interactivity/?/activeCamera/orthographic/ymag", {
    get: () => getActiveOrthographicValue((camera) => {
      const halfHeight = camera.getEngine().getRenderHeight() / 2;
      return ((camera.orthoTop ?? halfHeight) - (camera.orthoBottom ?? -halfHeight)) / 2;
    }),
    type: "number",
    getTarget: () => scene.activeCamera
  });
  AddObjectAccessorToKey("/extensions/KHR_interactivity/?/activeCamera/orthographic/znear", {
    get: () => getActiveOrthographicValue((camera) => camera.minZ),
    type: "number",
    getTarget: () => scene.activeCamera
  });
  AddObjectAccessorToKey("/extensions/KHR_interactivity/?/activeCamera/orthographic/zfar", {
    get: () => getActiveOrthographicValue((camera) => camera.maxZ),
    type: "number",
    getTarget: () => scene.activeCamera
  });
  AddObjectAccessorToKey("/animations/{}/extensions/KHR_interactivity/isPlaying", {
    get: (animation) => {
      return animation._babylonAnimationGroup?.isPlaying ?? false;
    },
    type: "boolean",
    getTarget: (animation) => {
      return animation._babylonAnimationGroup;
    }
  });
  AddObjectAccessorToKey("/animations/{}/extensions/KHR_interactivity/minTime", {
    get: (animation) => {
      return (animation._babylonAnimationGroup?.from ?? 0) / 60;
    },
    type: "number",
    getTarget: (animation) => {
      return animation._babylonAnimationGroup;
    }
  });
  AddObjectAccessorToKey("/animations/{}/extensions/KHR_interactivity/maxTime", {
    get: (animation) => {
      return (animation._babylonAnimationGroup?.to ?? 0) / 60;
    },
    type: "number",
    getTarget: (animation) => {
      return animation._babylonAnimationGroup;
    }
  });
  AddObjectAccessorToKey("/animations/{}/extensions/KHR_interactivity/playhead", {
    get: (animation) => {
      return (animation._babylonAnimationGroup?.getCurrentFrame() ?? 0) / 60;
    },
    type: "number",
    getTarget: (animation) => {
      return animation._babylonAnimationGroup;
    }
  });
  AddObjectAccessorToKey("/animations/{}/extensions/KHR_interactivity/virtualPlayhead", {
    get: (animation) => {
      return (animation._babylonAnimationGroup?.getCurrentFrame() ?? 0) / 60;
    },
    type: "number",
    getTarget: (animation) => {
      return animation._babylonAnimationGroup;
    }
  });
}
let _Registered$4 = false;
function RegisterKHR_interactivity() {
  if (_Registered$4) {
    return;
  }
  _Registered$4 = true;
  addToBlockFactory(NAME$4, "FlowGraphGLTFDataProvider", async () => {
    return (await __vitePreload(async () => {
      const { FlowGraphGLTFDataProvider: FlowGraphGLTFDataProvider2 } = await Promise.resolve().then(() => flowGraphGLTFDataProvider);
      return { FlowGraphGLTFDataProvider: FlowGraphGLTFDataProvider2 };
    }, true ? void 0 : void 0, import.meta.url)).FlowGraphGLTFDataProvider;
  });
  unregisterGLTFExtension(NAME$4);
  registerGLTFExtension(NAME$4, true, (loader) => new KHR_interactivity(loader));
}
RegisterKHR_interactivity();
const NAME$3 = "KHR_node_visibility";
class KHR_node_visibility {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$3;
    this._loader = loader;
    this.enabled = loader.isExtensionUsed(NAME$3);
  }
  onReady() {
    if (!this._loader) {
      return;
    }
    const nodes = this._loader.gltf.nodes;
    if (nodes) {
      for (const node of nodes) {
        const babylonTransformNode = node._babylonTransformNode;
        if (babylonTransformNode) {
          babylonTransformNode.inheritVisibility = true;
          if (node.extensions && node.extensions.KHR_node_visibility && node.extensions.KHR_node_visibility.visible === false) {
            babylonTransformNode.isVisible = false;
            node._primitiveBabylonMeshes?.forEach((mesh) => {
              mesh.inheritVisibility = true;
              mesh.isVisible = false;
            });
          }
        }
      }
    }
  }
  dispose() {
    delete this._loader;
  }
}
let _Registered$3 = false;
function RegisterKHR_node_visibility() {
  if (_Registered$3) {
    return;
  }
  _Registered$3 = true;
  AddObjectAccessorToKey("/nodes/{}/extensions/KHR_node_visibility/visible", {
    get: (node) => {
      const tn = node._babylonTransformNode;
      if (tn && tn.isVisible !== void 0) {
        return tn.isVisible;
      }
      return true;
    },
    set: (value, node) => {
      node._primitiveBabylonMeshes?.forEach((mesh) => {
        mesh.inheritVisibility = true;
      });
      if (node._babylonTransformNode) {
        node._babylonTransformNode.isVisible = value;
      }
      node._primitiveBabylonMeshes?.forEach((mesh) => {
        mesh.isVisible = value;
      });
    },
    getTarget: (node) => node._babylonTransformNode,
    getPropertyName: [() => "isVisible"],
    type: "boolean"
  });
  unregisterGLTFExtension(NAME$3);
  registerGLTFExtension(NAME$3, true, (loader) => new KHR_node_visibility(loader));
}
RegisterKHR_node_visibility();
const NAME$2 = "KHR_node_selectability";
class KHR_node_selectability {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$2;
    this._loader = loader;
    this.enabled = loader.isExtensionUsed(NAME$2);
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-misused-promises
  async onReady() {
    this._loader.gltf.nodes?.forEach((node) => {
      if (node.extensions?.KHR_node_selectability && node.extensions?.KHR_node_selectability.selectable === false) {
        node._babylonTransformNode?.getChildMeshes().forEach((mesh) => {
          mesh.isPickable = false;
        });
      }
    });
  }
  dispose() {
    this._loader = null;
  }
}
let _Registered$2 = false;
function RegisterKHR_node_selectability() {
  if (_Registered$2) {
    return;
  }
  _Registered$2 = true;
  addNewInteractivityFlowGraphMapping("event/onSelect", NAME$2, {
    // using GetVariable as the nodeIndex is a configuration and not a value (i.e. it's not mutable)
    blocks: ["FlowGraphMeshPickEventBlock", "FlowGraphGetVariableBlock", "FlowGraphIndexOfBlock", "KHR_interactivity/FlowGraphGLTFDataProvider"],
    configuration: {
      stopPropagation: { name: "stopPropagation" },
      nodeIndex: {
        name: "variable",
        toBlock: "FlowGraphGetVariableBlock",
        dataTransformer(data) {
          return "pickedMesh_" + data;
        }
      }
    },
    outputs: {
      values: {
        selectedNodeIndex: {
          name: "index",
          toBlock: "FlowGraphIndexOfBlock"
          /* FlowGraphBlockNames.IndexOf */
        },
        // `selectedNode` is the new ref-typed output from the Opaque-Reference
        // spec update. It's the picked Babylon mesh itself, available directly
        // from FlowGraphMeshPickEventBlock.pickedMesh — no IndexOf lookup needed.
        selectedNode: {
          name: "pickedMesh",
          toBlock: "FlowGraphMeshPickEventBlock"
          /* FlowGraphBlockNames.MeshPickEvent */
        },
        controllerIndex: { name: "pointerId" },
        selectionPoint: { name: "pickedPoint" },
        selectionRayOrigin: { name: "pickOrigin" }
      },
      flows: {
        out: { name: "done" }
      }
    },
    interBlockConnectors: [
      {
        input: "asset",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "nodes",
        inputBlockIndex: 2,
        outputBlockIndex: 3,
        isVariable: true
      },
      {
        input: "object",
        output: "pickedMesh",
        inputBlockIndex: 2,
        outputBlockIndex: 0,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, _arrays, serializedObjects, context, globalGLTF) {
      const serializedObject = serializedObjects[serializedObjects.length - 1];
      serializedObject.config = serializedObject.config || {};
      serializedObject.config.glTF = globalGLTF;
      const nodeIndex = gltfBlock.configuration?.["nodeIndex"]?.value?.[0];
      if (nodeIndex === void 0 || typeof nodeIndex !== "number") {
        throw new Error("nodeIndex not found in configuration");
      }
      const variableName = "pickedMesh_" + nodeIndex;
      serializedObjects[1].config.variable = variableName;
      context._userVariables[variableName] = {
        className: "Mesh",
        id: globalGLTF?.nodes?.[nodeIndex]._babylonTransformNode?.id,
        uniqueId: globalGLTF?.nodes?.[nodeIndex]._babylonTransformNode?.uniqueId
      };
      return serializedObjects;
    }
  });
  AddObjectAccessorToKey("/nodes/{}/extensions/KHR_node_selectability/selectable", {
    get: (node) => {
      const tn = node._babylonTransformNode;
      if (tn && tn.isPickable !== void 0) {
        return tn.isPickable;
      }
      return true;
    },
    set: (value, node) => {
      node._primitiveBabylonMeshes?.forEach((mesh) => {
        mesh.isPickable = value;
      });
    },
    getTarget: (node) => node._babylonTransformNode,
    getPropertyName: [() => "isPickable"],
    type: "boolean"
  });
  unregisterGLTFExtension(NAME$2);
  registerGLTFExtension(NAME$2, true, (loader) => new KHR_node_selectability(loader));
}
RegisterKHR_node_selectability();
const NAME$1 = "KHR_node_hoverability";
const MeshPointerOverPrefix = "targetMeshPointerOver_";
const MeshPointerOutPrefix = "targetMeshPointerOut_";
class KHR_node_hoverability {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME$1;
    this._loader = loader;
    this.enabled = loader.isExtensionUsed(NAME$1);
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-misused-promises
  async onReady() {
    this._loader.gltf.nodes?.forEach((node) => {
      if (node.extensions?.KHR_node_hoverability && node.extensions?.KHR_node_hoverability.hoverable === false) {
        node._babylonTransformNode?.getChildMeshes().forEach((mesh) => {
          mesh.pointerOverDisableMeshTesting = true;
        });
      }
    });
  }
  dispose() {
    this._loader = null;
  }
}
let _Registered$1 = false;
function RegisterKHR_node_hoverability() {
  if (_Registered$1) {
    return;
  }
  _Registered$1 = true;
  addNewInteractivityFlowGraphMapping("event/onHoverIn", NAME$1, {
    // using GetVariable as the nodeIndex is a configuration and not a value (i.e. it's not mutable)
    blocks: ["FlowGraphPointerOverEventBlock", "FlowGraphGetVariableBlock", "FlowGraphIndexOfBlock", "KHR_interactivity/FlowGraphGLTFDataProvider"],
    configuration: {
      stopPropagation: { name: "stopPropagation" },
      nodeIndex: {
        name: "variable",
        toBlock: "FlowGraphGetVariableBlock",
        dataTransformer(data) {
          return MeshPointerOverPrefix + data;
        }
      }
    },
    outputs: {
      values: {
        hoverNodeIndex: {
          name: "index",
          toBlock: "FlowGraphIndexOfBlock"
          /* FlowGraphBlockNames.IndexOf */
        },
        // `hoveredNode` is the new ref-typed output from the Opaque-Reference
        // spec update — the picked Babylon mesh itself, available directly
        // from FlowGraphPointerOverEventBlock.meshUnderPointer (no IndexOf).
        hoveredNode: {
          name: "meshUnderPointer",
          toBlock: "FlowGraphPointerOverEventBlock"
          /* FlowGraphBlockNames.PointerOverEvent */
        },
        controllerIndex: { name: "pointerId" }
      },
      flows: {
        out: { name: "done" }
      }
    },
    interBlockConnectors: [
      {
        input: "targetMesh",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "nodes",
        inputBlockIndex: 2,
        outputBlockIndex: 3,
        isVariable: true
      },
      {
        input: "object",
        output: "meshUnderPointer",
        inputBlockIndex: 2,
        outputBlockIndex: 0,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, _arrays, serializedObjects, context, globalGLTF) {
      const serializedObject = serializedObjects[serializedObjects.length - 1];
      serializedObject.config = serializedObject.config || {};
      serializedObject.config.glTF = globalGLTF;
      const nodeIndex = gltfBlock.configuration?.["nodeIndex"]?.value?.[0];
      if (nodeIndex === void 0 || typeof nodeIndex !== "number") {
        throw new Error("nodeIndex not found in configuration");
      }
      const variableName = MeshPointerOverPrefix + nodeIndex;
      serializedObjects[1].config.variable = variableName;
      context._userVariables[variableName] = {
        className: "Mesh",
        id: globalGLTF?.nodes?.[nodeIndex]._babylonTransformNode?.id,
        uniqueId: globalGLTF?.nodes?.[nodeIndex]._babylonTransformNode?.uniqueId
      };
      return serializedObjects;
    }
  });
  addNewInteractivityFlowGraphMapping("event/onHoverOut", NAME$1, {
    // using GetVariable as the nodeIndex is a configuration and not a value (i.e. it's not mutable)
    blocks: ["FlowGraphPointerOutEventBlock", "FlowGraphGetVariableBlock", "FlowGraphIndexOfBlock", "KHR_interactivity/FlowGraphGLTFDataProvider"],
    configuration: {
      stopPropagation: { name: "stopPropagation" },
      nodeIndex: {
        name: "variable",
        toBlock: "FlowGraphGetVariableBlock",
        dataTransformer(data) {
          return MeshPointerOutPrefix + data;
        }
      }
    },
    outputs: {
      values: {
        hoverNodeIndex: {
          name: "index",
          toBlock: "FlowGraphIndexOfBlock"
          /* FlowGraphBlockNames.IndexOf */
        },
        // Ref-typed output: the mesh that the pointer just left.
        hoveredNode: {
          name: "meshOutOfPointer",
          toBlock: "FlowGraphPointerOutEventBlock"
          /* FlowGraphBlockNames.PointerOutEvent */
        },
        controllerIndex: { name: "pointerId" }
      },
      flows: {
        out: { name: "done" }
      }
    },
    interBlockConnectors: [
      {
        input: "targetMesh",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "nodes",
        inputBlockIndex: 2,
        outputBlockIndex: 3,
        isVariable: true
      },
      {
        input: "object",
        output: "meshOutOfPointer",
        inputBlockIndex: 2,
        outputBlockIndex: 0,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, _arrays, serializedObjects, context, globalGLTF) {
      const serializedObject = serializedObjects[serializedObjects.length - 1];
      serializedObject.config = serializedObject.config || {};
      serializedObject.config.glTF = globalGLTF;
      const nodeIndex = gltfBlock.configuration?.["nodeIndex"]?.value?.[0];
      if (nodeIndex === void 0 || typeof nodeIndex !== "number") {
        throw new Error("nodeIndex not found in configuration");
      }
      const variableName = MeshPointerOutPrefix + nodeIndex;
      serializedObjects[1].config.variable = variableName;
      context._userVariables[variableName] = {
        className: "Mesh",
        id: globalGLTF?.nodes?.[nodeIndex]._babylonTransformNode?.id,
        uniqueId: globalGLTF?.nodes?.[nodeIndex]._babylonTransformNode?.uniqueId
      };
      return serializedObjects;
    }
  });
  AddObjectAccessorToKey("/nodes/{}/extensions/KHR_node_hoverability/hoverable", {
    get: (node) => {
      const tn = node._babylonTransformNode;
      if (tn && tn.pointerOverDisableMeshTesting !== void 0) {
        return tn.pointerOverDisableMeshTesting;
      }
      return true;
    },
    set: (value, node) => {
      node._primitiveBabylonMeshes?.forEach((mesh) => {
        mesh.pointerOverDisableMeshTesting = !value;
      });
    },
    getTarget: (node) => node._babylonTransformNode,
    getPropertyName: [() => "pointerOverDisableMeshTesting"],
    type: "boolean"
  });
  unregisterGLTFExtension(NAME$1);
  registerGLTFExtension(NAME$1, true, (loader) => new KHR_node_hoverability(loader));
}
RegisterKHR_node_hoverability();
const NAME = "ExtrasAsMetadata";
class ExtrasAsMetadata {
  _assignExtras(babylonObject, gltfProp) {
    if (gltfProp.extras && Object.keys(gltfProp.extras).length > 0) {
      const metadata = babylonObject.metadata = babylonObject.metadata || {};
      const gltf = metadata.gltf = metadata.gltf || {};
      gltf.extras = gltfProp.extras;
    }
  }
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this.enabled = true;
    this._loader = loader;
  }
  /** @internal */
  dispose() {
    this._loader = null;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadNodeAsync(context, node, assign) {
    return this._loader.loadNodeAsync(context, node, (babylonTransformNode) => {
      this._assignExtras(babylonTransformNode, node);
      assign(babylonTransformNode);
    });
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadCameraAsync(context, camera, assign) {
    return this._loader.loadCameraAsync(context, camera, (babylonCamera) => {
      this._assignExtras(babylonCamera, camera);
      assign(babylonCamera);
    });
  }
  /**
   * @internal
   */
  createMaterial(context, material, babylonDrawMode) {
    const babylonMaterial = this._loader.createMaterial(context, material, babylonDrawMode);
    this._assignExtras(babylonMaterial, material);
    return babylonMaterial;
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadAnimationAsync(context, animation) {
    return this._loader.loadAnimationAsync(context, animation).then((babylonAnimation) => {
      this._assignExtras(babylonAnimation, animation);
      return babylonAnimation;
    });
  }
}
let _Registered = false;
function RegisterExtrasAsMetadata() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  unregisterGLTFExtension(NAME);
  registerGLTFExtension(NAME, false, (loader) => new ExtrasAsMetadata(loader));
}
RegisterExtrasAsMetadata();
class FlowGraphGLTFDataProvider extends FlowGraphBlock {
  constructor(config) {
    super(config);
    const glTF = config.glTF;
    const animationGroups = glTF?.animations?.map((a) => a._babylonAnimationGroup) || [];
    this.animationGroups = this.registerDataOutput("animationGroups", RichTypeAny, animationGroups);
    const nodes = glTF?.nodes?.map((n) => n._babylonTransformNode) || [];
    this.nodes = this.registerDataOutput("nodes", RichTypeAny, nodes);
  }
  getClassName() {
    return "FlowGraphGLTFDataProvider";
  }
}
const flowGraphGLTFDataProvider = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  FlowGraphGLTFDataProvider
}, Symbol.toStringTag, { value: "Module" }));
