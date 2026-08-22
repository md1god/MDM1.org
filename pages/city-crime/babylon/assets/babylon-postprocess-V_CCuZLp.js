import { O as Observable, v as VertexBuffer, aE as EffectWrapper, aF as __runInitializers, aG as SmartArray, d as Vector2, _ as __vitePreload, aH as GetExponentOfTwo, aI as SerializationHelper, aJ as GetClass, aK as __esDecorate, aL as AbstractEngine, f as Effect, aM as RegisterClass, aN as serialize, aO as serializeAsColor4, aP as EngineStore, e as Texture, aQ as serializeAsVector2, aR as ImageProcessingConfiguration, ax as Scene, ay as SceneComponentConstants, aS as UniqueIdGenerator, T as Tools, L as Logger, aT as ToGammaSpace, aU as GlowLayer, aV as RegisterDepthRendererSceneComponent, aW as TimingTools, aX as DepthRenderer, M as Matrix, p as Camera, aY as RandomRange, aZ as RawTexture, c as Vector3, a1 as TmpVectors, a_ as RegisterPrePassRendererSceneComponent, a$ as RegisterGeometryBufferRendererSceneComponent, b0 as GeometryBufferRenderer, b1 as SSAO2Configuration, b2 as PrePassRenderer } from "./babylon-core-DhADYfIs.js";
class PostProcessManager {
  /**
   * Creates a new instance PostProcess
   * @param scene The scene that the post process is associated with.
   */
  constructor(scene) {
    this._vertexBuffers = {};
    this._activePostProcesses = [];
    this.onBeforeRenderObservable = new Observable();
    this._scene = scene;
  }
  _prepareBuffers() {
    if (this._vertexBuffers[VertexBuffer.PositionKind]) {
      return;
    }
    const vertices = [];
    vertices.push(1, 1);
    vertices.push(-1, 1);
    vertices.push(-1, -1);
    vertices.push(1, -1);
    this._vertexBuffers[VertexBuffer.PositionKind] = new VertexBuffer(this._scene.getEngine(), vertices, VertexBuffer.PositionKind, false, false, 2);
    this._buildIndexBuffer();
  }
  _buildIndexBuffer() {
    const indices = [];
    indices.push(0);
    indices.push(1);
    indices.push(2);
    indices.push(0);
    indices.push(2);
    indices.push(3);
    this._indexBuffer = this._scene.getEngine().createIndexBuffer(indices);
  }
  _getActivePostProcesses(source) {
    const activePostProcesses = this._activePostProcesses;
    activePostProcesses.length = 0;
    for (let index = 0; index < source.length; index++) {
      const postProcess = source[index];
      if (postProcess) {
        activePostProcesses.push(postProcess);
      }
    }
    return activePostProcesses;
  }
  /**
   * Rebuilds the vertex buffers of the manager.
   * @internal
   */
  _rebuild() {
    const vb = this._vertexBuffers[VertexBuffer.PositionKind];
    if (!vb) {
      return;
    }
    vb._rebuild();
    this._buildIndexBuffer();
  }
  // Methods
  /**
   * Prepares a frame to be run through a post process.
   * @param sourceTexture The input texture to the post processes. (default: null)
   * @param postProcesses An array of post processes to be run. (default: null)
   * @returns True if the post processes were able to be run.
   * @internal
   */
  _prepareFrame(sourceTexture = null, postProcesses = null) {
    const camera = this._scene.activeCamera;
    if (!camera) {
      return false;
    }
    postProcesses = postProcesses || this._getActivePostProcesses(camera._postProcesses);
    if (!postProcesses || postProcesses.length === 0 || !this._scene.postProcessesEnabled) {
      return false;
    }
    postProcesses[0].activate(camera, sourceTexture, postProcesses !== null && postProcesses !== void 0);
    return true;
  }
  /**
   * Manually render a set of post processes to a texture.
   * Please note, the frame buffer won't be unbound after the call in case you have more render to do.
   * @param postProcesses An array of post processes to be run.
   * @param targetTexture The render target wrapper to render to.
   * @param forceFullscreenViewport force gl.viewport to be full screen eg. 0,0,textureWidth,textureHeight
   * @param faceIndex defines the face to render to if a cubemap is defined as the target
   * @param lodLevel defines which lod of the texture to render to
   * @param doNotBindFrambuffer If set to true, assumes that the framebuffer has been bound previously
   * @param numPostsProcesses The number of post processes to render. Defaults to the length of the postProcesses array.
   */
  directRender(postProcesses, targetTexture = null, forceFullscreenViewport = false, faceIndex = 0, lodLevel = 0, doNotBindFrambuffer = false, numPostsProcesses = postProcesses.length) {
    const engine = this._scene.getEngine();
    for (let index = 0; index < numPostsProcesses; index++) {
      if (index < postProcesses.length - 1) {
        postProcesses[index + 1].activate(this._scene.activeCamera || this._scene, targetTexture?.texture);
      } else {
        if (targetTexture) {
          engine.bindFramebuffer(targetTexture, faceIndex, void 0, void 0, forceFullscreenViewport, lodLevel);
        } else if (!doNotBindFrambuffer) {
          engine.restoreDefaultFramebuffer();
        }
        engine._debugInsertMarker?.(`post process ${postProcesses[index].name} output`);
      }
      const pp = postProcesses[index];
      const effect = pp.apply();
      if (effect) {
        pp.onBeforeRenderObservable.notifyObservers(effect);
        this._prepareBuffers();
        engine.bindBuffers(this._vertexBuffers, this._indexBuffer, effect);
        engine.drawElementsType(0, 0, 6);
        pp.onAfterRenderObservable.notifyObservers(effect);
      }
    }
    engine.setDepthBuffer(true);
    engine.setDepthWrite(true);
  }
  /**
   * Finalize the result of the output of the postprocesses.
   * @param doNotPresent If true the result will not be displayed to the screen.
   * @param targetTexture The render target wrapper to render to.
   * @param faceIndex The index of the face to bind the target texture to.
   * @param postProcesses The array of post processes to render.
   * @param forceFullscreenViewport force gl.viewport to be full screen eg. 0,0,textureWidth,textureHeight (default: false)
   * @internal
   */
  _finalizeFrame(doNotPresent, targetTexture, faceIndex, postProcesses, forceFullscreenViewport = false) {
    const camera = this._scene.activeCamera;
    if (!camera) {
      return;
    }
    this.onBeforeRenderObservable.notifyObservers(this);
    postProcesses = postProcesses || this._getActivePostProcesses(camera._postProcesses);
    if (postProcesses.length === 0 || !this._scene.postProcessesEnabled) {
      return;
    }
    const engine = this._scene.getEngine();
    for (let index = 0, len = postProcesses.length; index < len; index++) {
      const pp = postProcesses[index];
      if (index < len - 1) {
        pp._outputTexture = postProcesses[index + 1].activate(camera, targetTexture?.texture);
      } else {
        if (targetTexture) {
          engine.bindFramebuffer(targetTexture, faceIndex, void 0, void 0, forceFullscreenViewport);
          pp._outputTexture = targetTexture;
        } else {
          engine.restoreDefaultFramebuffer();
          pp._outputTexture = null;
        }
        engine._debugInsertMarker?.(`post process ${postProcesses[index].name} output`);
      }
      if (doNotPresent) {
        break;
      }
      const effect = pp.apply();
      if (effect) {
        pp.onBeforeRenderObservable.notifyObservers(effect);
        this._prepareBuffers();
        engine.bindBuffers(this._vertexBuffers, this._indexBuffer, effect);
        engine.drawElementsType(0, 0, 6);
        pp.onAfterRenderObservable.notifyObservers(effect);
      }
    }
    engine.setDepthBuffer(true);
    engine.setDepthWrite(true);
    engine.setAlphaMode(0);
  }
  /**
   * Disposes of the post process manager.
   */
  dispose() {
    const buffer = this._vertexBuffers[VertexBuffer.PositionKind];
    if (buffer) {
      buffer.dispose();
      this._vertexBuffers[VertexBuffer.PositionKind] = null;
    }
    if (this._indexBuffer) {
      this._scene.getEngine()._releaseBuffer(this._indexBuffer);
      this._indexBuffer = null;
    }
  }
}
let PostProcess = (() => {
  var _a;
  let _instanceExtraInitializers = [];
  let _uniqueId_decorators;
  let _uniqueId_initializers = [];
  let _uniqueId_extraInitializers = [];
  let _get_name_decorators;
  let _width_decorators;
  let _width_initializers = [];
  let _width_extraInitializers = [];
  let _height_decorators;
  let _height_initializers = [];
  let _height_extraInitializers = [];
  let _renderTargetSamplingMode_decorators;
  let _renderTargetSamplingMode_initializers = [];
  let _renderTargetSamplingMode_extraInitializers = [];
  let _clearColor_decorators;
  let _clearColor_initializers = [];
  let _clearColor_extraInitializers = [];
  let _autoClear_decorators;
  let _autoClear_initializers = [];
  let _autoClear_extraInitializers = [];
  let _forceAutoClearInAlphaMode_decorators;
  let _forceAutoClearInAlphaMode_initializers = [];
  let _forceAutoClearInAlphaMode_extraInitializers = [];
  let _get_alphaMode_decorators;
  let _alphaConstants_decorators;
  let _alphaConstants_initializers = [];
  let _alphaConstants_extraInitializers = [];
  let _enablePixelPerfectMode_decorators;
  let _enablePixelPerfectMode_initializers = [];
  let _enablePixelPerfectMode_extraInitializers = [];
  let _forceFullscreenViewport_decorators;
  let _forceFullscreenViewport_initializers = [];
  let _forceFullscreenViewport_extraInitializers = [];
  let _scaleMode_decorators;
  let _scaleMode_initializers = [];
  let _scaleMode_extraInitializers = [];
  let _alwaysForcePOT_decorators;
  let _alwaysForcePOT_initializers = [];
  let _alwaysForcePOT_extraInitializers = [];
  let __samples_decorators;
  let __samples_initializers = [];
  let __samples_extraInitializers = [];
  let _adaptScaleToCurrentViewport_decorators;
  let _adaptScaleToCurrentViewport_initializers = [];
  let _adaptScaleToCurrentViewport_extraInitializers = [];
  return _a = class PostProcess {
    /**
     * Force all the postprocesses to compile to glsl even on WebGPU engines.
     * False by default. This is mostly meant for backward compatibility.
     */
    static get ForceGLSL() {
      return EffectWrapper.ForceGLSL;
    }
    static set ForceGLSL(force) {
      EffectWrapper.ForceGLSL = force;
    }
    /**
     * Registers a shader code processing with a post process name.
     * @param postProcessName name of the post process. Use null for the fallback shader code processing. This is the shader code processing that will be used in case no specific shader code processing has been associated to a post process name
     * @param customShaderCodeProcessing shader code processing to associate to the post process name
     */
    static RegisterShaderCodeProcessing(postProcessName, customShaderCodeProcessing) {
      EffectWrapper.RegisterShaderCodeProcessing(postProcessName, customShaderCodeProcessing);
    }
    /** Name of the PostProcess. */
    get name() {
      return this._effectWrapper.name;
    }
    set name(value) {
      this._effectWrapper.name = value;
    }
    /**
     * Type of alpha mode to use when performing the post process (default: Engine.ALPHA_DISABLE)
     */
    get alphaMode() {
      return this._effectWrapper.alphaMode;
    }
    set alphaMode(value) {
      this._effectWrapper.alphaMode = value;
    }
    /**
     * Number of sample textures (default: 1)
     */
    get samples() {
      return this._samples;
    }
    set samples(n) {
      this._samples = Math.min(n, this._engine.getCaps().maxMSAASamples);
      this._textures.forEach((texture) => {
        texture.setSamples(this._samples);
      });
    }
    /**
     * Gets the shader language type used to generate vertex and fragment source code.
     */
    get shaderLanguage() {
      return this._shaderLanguage;
    }
    /**
     * Returns the fragment url or shader name used in the post process.
     * @returns the fragment url or name in the shader store.
     */
    getEffectName() {
      return this._fragmentUrl;
    }
    /**
     * A function that is added to the onActivateObservable
     */
    set onActivate(callback) {
      if (this._onActivateObserver) {
        this.onActivateObservable.remove(this._onActivateObserver);
      }
      if (callback) {
        this._onActivateObserver = this.onActivateObservable.add(callback);
      }
    }
    /**
     * A function that is added to the onSizeChangedObservable
     */
    set onSizeChanged(callback) {
      if (this._onSizeChangedObserver) {
        this.onSizeChangedObservable.remove(this._onSizeChangedObserver);
      }
      this._onSizeChangedObserver = this.onSizeChangedObservable.add(callback);
    }
    /**
     * A function that is added to the onApplyObservable
     */
    set onApply(callback) {
      if (this._onApplyObserver) {
        this.onApplyObservable.remove(this._onApplyObserver);
      }
      this._onApplyObserver = this.onApplyObservable.add(callback);
    }
    /**
     * A function that is added to the onBeforeRenderObservable
     */
    set onBeforeRender(callback) {
      if (this._onBeforeRenderObserver) {
        this.onBeforeRenderObservable.remove(this._onBeforeRenderObserver);
      }
      this._onBeforeRenderObserver = this.onBeforeRenderObservable.add(callback);
    }
    /**
     * A function that is added to the onAfterRenderObservable
     */
    set onAfterRender(callback) {
      if (this._onAfterRenderObserver) {
        this.onAfterRenderObservable.remove(this._onAfterRenderObserver);
      }
      this._onAfterRenderObserver = this.onAfterRenderObservable.add(callback);
    }
    /**
     * The input texture for this post process and the output texture of the previous post process. When added to a pipeline the previous post process will
     * render it's output into this texture and this texture will be used as textureSampler in the fragment shader of this post process.
     */
    get inputTexture() {
      return this._textures.data[this._currentRenderTextureInd];
    }
    set inputTexture(value) {
      this._forcedOutputTexture = value;
    }
    /**
     * Since inputTexture should always be defined, if we previously manually set `inputTexture`,
     * the only way to unset it is to use this function to restore its internal state
     */
    restoreDefaultInputTexture() {
      if (this._forcedOutputTexture) {
        this._forcedOutputTexture = null;
        this.markTextureDirty();
      }
    }
    /**
     * Gets the camera which post process is applied to.
     * @returns The camera the post process is applied to.
     */
    getCamera() {
      return this._camera;
    }
    /**
     * Gets the texel size of the postprocess.
     * See https://en.wikipedia.org/wiki/Texel_(graphics)
     */
    get texelSize() {
      if (this._shareOutputWithPostProcess) {
        return this._shareOutputWithPostProcess.texelSize;
      }
      if (this._forcedOutputTexture) {
        this._texelSize.copyFromFloats(1 / this._forcedOutputTexture.width, 1 / this._forcedOutputTexture.height);
      }
      return this._texelSize;
    }
    /** @internal */
    constructor(name, fragmentUrl, parameters, samplers, _size, camera, samplingMode = 1, engine, reusable, defines = null, textureType = 0, vertexUrl = "postprocess", indexParameters, blockCompilation = false, textureFormat = 5, shaderLanguage, extraInitializations) {
      this._parentContainer = (__runInitializers(this, _instanceExtraInitializers), null);
      this.uniqueId = __runInitializers(this, _uniqueId_initializers, void 0);
      this.width = (__runInitializers(this, _uniqueId_extraInitializers), __runInitializers(this, _width_initializers, -1));
      this.height = (__runInitializers(this, _width_extraInitializers), __runInitializers(this, _height_initializers, -1));
      this.nodeMaterialSource = (__runInitializers(this, _height_extraInitializers), null);
      this._outputTexture = null;
      this.renderTargetSamplingMode = __runInitializers(this, _renderTargetSamplingMode_initializers, void 0);
      this.clearColor = (__runInitializers(this, _renderTargetSamplingMode_extraInitializers), __runInitializers(this, _clearColor_initializers, void 0));
      this.autoClear = (__runInitializers(this, _clearColor_extraInitializers), __runInitializers(this, _autoClear_initializers, true));
      this.forceAutoClearInAlphaMode = (__runInitializers(this, _autoClear_extraInitializers), __runInitializers(this, _forceAutoClearInAlphaMode_initializers, false));
      this.alphaConstants = (__runInitializers(this, _forceAutoClearInAlphaMode_extraInitializers), __runInitializers(this, _alphaConstants_initializers, void 0));
      this.animations = (__runInitializers(this, _alphaConstants_extraInitializers), []);
      this.enablePixelPerfectMode = __runInitializers(this, _enablePixelPerfectMode_initializers, false);
      this.forceFullscreenViewport = (__runInitializers(this, _enablePixelPerfectMode_extraInitializers), __runInitializers(this, _forceFullscreenViewport_initializers, true));
      this.inspectableCustomProperties = __runInitializers(this, _forceFullscreenViewport_extraInitializers);
      this.scaleMode = __runInitializers(this, _scaleMode_initializers, 1);
      this.alwaysForcePOT = (__runInitializers(this, _scaleMode_extraInitializers), __runInitializers(this, _alwaysForcePOT_initializers, false));
      this._samples = (__runInitializers(this, _alwaysForcePOT_extraInitializers), __runInitializers(this, __samples_initializers, 1));
      this.adaptScaleToCurrentViewport = (__runInitializers(this, __samples_extraInitializers), __runInitializers(this, _adaptScaleToCurrentViewport_initializers, false));
      this.doNotSerialize = (__runInitializers(this, _adaptScaleToCurrentViewport_extraInitializers), false);
      this._webGPUReady = false;
      this._reusable = false;
      this._renderId = 0;
      this.externalTextureSamplerBinding = false;
      this._textures = new SmartArray(2);
      this._textureCache = [];
      this._currentRenderTextureInd = 0;
      this._scaleRatio = new Vector2(1, 1);
      this._texelSize = Vector2.Zero();
      this.onActivateObservable = new Observable();
      this.onSizeChangedObservable = new Observable();
      this.onApplyObservable = new Observable();
      this.onBeforeRenderObservable = new Observable();
      this.onAfterRenderObservable = new Observable();
      this.onDisposeObservable = new Observable();
      RegisterPostProcess();
      let size = 1;
      let uniformBuffers = null;
      let effectWrapper;
      if (parameters && !Array.isArray(parameters)) {
        const options = parameters;
        parameters = options.uniforms ?? null;
        samplers = options.samplers ?? null;
        size = options.size ?? 1;
        camera = options.camera ?? null;
        samplingMode = options.samplingMode ?? 1;
        engine = options.engine;
        reusable = options.reusable;
        defines = Array.isArray(options.defines) ? options.defines.join("\n") : options.defines ?? null;
        textureType = options.textureType ?? 0;
        vertexUrl = options.vertexUrl ?? "postprocess";
        indexParameters = options.indexParameters;
        blockCompilation = options.blockCompilation ?? false;
        textureFormat = options.textureFormat ?? 5;
        shaderLanguage = options.shaderLanguage ?? 0;
        uniformBuffers = options.uniformBuffers ?? null;
        extraInitializations = options.extraInitializations;
        effectWrapper = options.effectWrapper;
      } else if (_size) {
        if (typeof _size === "number") {
          size = _size;
        } else {
          size = { width: _size.width, height: _size.height };
        }
      }
      this._useExistingThinPostProcess = !!effectWrapper;
      this._effectWrapper = effectWrapper ?? new EffectWrapper({
        name,
        useShaderStore: true,
        useAsPostProcess: true,
        fragmentShader: fragmentUrl,
        engine: engine || camera?.getScene().getEngine(),
        uniforms: parameters,
        samplers,
        uniformBuffers,
        defines,
        vertexUrl,
        indexParameters,
        blockCompilation: true,
        shaderLanguage,
        extraInitializations: void 0
      });
      this.name = name;
      this.onEffectCreatedObservable = this._effectWrapper.onEffectCreatedObservable;
      if (camera != null) {
        this._camera = camera;
        this._scene = camera.getScene();
        camera.attachPostProcess(this);
        this._engine = this._scene.getEngine();
        this._scene.addPostProcess(this);
        this.uniqueId = this._scene.getUniqueId();
      } else if (engine) {
        this._engine = engine;
        this._engine.postProcesses.push(this);
      }
      this._options = size;
      this.renderTargetSamplingMode = samplingMode ? samplingMode : 1;
      this._reusable = reusable || false;
      this._textureType = textureType;
      this._textureFormat = textureFormat;
      this._shaderLanguage = shaderLanguage || 0;
      this._samplers = samplers || [];
      if (this._samplers.indexOf("textureSampler") === -1) {
        this._samplers.push("textureSampler");
      }
      this._fragmentUrl = fragmentUrl;
      this._vertexUrl = vertexUrl;
      this._parameters = parameters || [];
      if (this._parameters.indexOf("scale") === -1) {
        this._parameters.push("scale");
      }
      this._uniformBuffers = uniformBuffers || [];
      this._indexParameters = indexParameters;
      if (!this._useExistingThinPostProcess) {
        this._webGPUReady = this._shaderLanguage === 1;
        const importPromises = [];
        this._gatherImports(this._engine.isWebGPU && !_a.ForceGLSL, importPromises);
        this._effectWrapper._webGPUReady = this._webGPUReady;
        this._effectWrapper._postConstructor(blockCompilation, defines, extraInitializations, importPromises);
      }
    }
    _gatherImports(useWebGPU = false, list) {
      if (useWebGPU && this._webGPUReady) {
        list.push(Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bb), true ? [] : void 0, import.meta.url)]));
      } else {
        list.push(Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bc), true ? [] : void 0, import.meta.url)]));
      }
    }
    /**
     * Gets a string identifying the name of the class
     * @returns "PostProcess" string
     */
    getClassName() {
      return "PostProcess";
    }
    /**
     * Gets the engine which this post process belongs to.
     * @returns The engine the post process was enabled with.
     */
    getEngine() {
      return this._engine;
    }
    /**
     * The effect that is created when initializing the post process.
     * @returns The created effect corresponding to the postprocess.
     */
    getEffect() {
      return this._effectWrapper.drawWrapper.effect;
    }
    /**
     * To avoid multiple redundant textures for multiple post process, the output the output texture for this post process can be shared with another.
     * @param postProcess The post process to share the output with.
     * @returns This post process.
     */
    shareOutputWith(postProcess) {
      this._disposeTextures();
      this._shareOutputWithPostProcess = postProcess;
      return this;
    }
    /**
     * Reverses the effect of calling shareOutputWith and returns the post process back to its original state.
     * This should be called if the post process that shares output with this post process is disabled/disposed.
     */
    useOwnOutput() {
      if (this._textures.length == 0) {
        this._textures = new SmartArray(2);
      }
      this._shareOutputWithPostProcess = null;
    }
    /**
     * Updates the effect with the current post process compile time values and recompiles the shader.
     * @param defines Define statements that should be added at the beginning of the shader. (default: null)
     * @param uniforms Set of uniform variables that will be passed to the shader. (default: null)
     * @param samplers Set of Texture2D variables that will be passed to the shader. (default: null)
     * @param indexParameters The index parameters to be used for babylons include syntax "#include<kernelBlurVaryingDeclaration>[0..varyingCount]". (default: undefined) See usage in babylon.blurPostProcess.ts and kernelBlur.vertex.fx
     * @param onCompiled Called when the shader has been compiled.
     * @param onError Called if there is an error when compiling a shader.
     * @param vertexUrl The url of the vertex shader to be used (default: the one given at construction time)
     * @param fragmentUrl The url of the fragment shader to be used (default: the one given at construction time)
     */
    updateEffect(defines = null, uniforms = null, samplers = null, indexParameters, onCompiled, onError, vertexUrl, fragmentUrl) {
      this._effectWrapper.updateEffect(defines, uniforms, samplers, indexParameters, onCompiled, onError, vertexUrl, fragmentUrl);
      this._postProcessDefines = Array.isArray(this._effectWrapper.options.defines) ? this._effectWrapper.options.defines.join("\n") : this._effectWrapper.options.defines;
    }
    /**
     * The post process is reusable if it can be used multiple times within one frame.
     * @returns If the post process is reusable
     */
    isReusable() {
      return this._reusable;
    }
    /** invalidate frameBuffer to hint the postprocess to create a depth buffer */
    markTextureDirty() {
      this.width = -1;
    }
    _createRenderTargetTexture(textureSize, textureOptions, channel = 0) {
      for (let i = 0; i < this._textureCache.length; i++) {
        if (this._textureCache[i].texture.width === textureSize.width && this._textureCache[i].texture.height === textureSize.height && this._textureCache[i].postProcessChannel === channel && this._textureCache[i].texture._generateDepthBuffer === textureOptions.generateDepthBuffer && this._textureCache[i].texture.samples === textureOptions.samples) {
          return this._textureCache[i].texture;
        }
      }
      const tex = this._engine.createRenderTargetTexture(textureSize, textureOptions);
      this._textureCache.push({ texture: tex, postProcessChannel: channel, lastUsedRenderId: -1 });
      return tex;
    }
    _flushTextureCache() {
      const currentRenderId = this._renderId;
      for (let i = this._textureCache.length - 1; i >= 0; i--) {
        if (currentRenderId - this._textureCache[i].lastUsedRenderId > 100) {
          let currentlyUsed = false;
          for (let j = 0; j < this._textures.length; j++) {
            if (this._textures.data[j] === this._textureCache[i].texture) {
              currentlyUsed = true;
              break;
            }
          }
          if (!currentlyUsed) {
            this._textureCache[i].texture.dispose();
            this._textureCache.splice(i, 1);
          }
        }
      }
    }
    /**
     * Resizes the post-process texture
     * @param width Width of the texture
     * @param height Height of the texture
     * @param camera The camera this post-process is applied to. Pass null if the post-process is used outside the context of a camera post-process chain (default: null)
     * @param needMipMaps True if mip maps need to be generated after render (default: false)
     * @param forceDepthStencil True to force post-process texture creation with stencil depth and buffer (default: false)
     */
    resize(width, height, camera = null, needMipMaps = false, forceDepthStencil = false) {
      if (this._textures.length > 0) {
        this._textures.reset();
      }
      this.width = width;
      this.height = height;
      let firstPP = null;
      if (camera) {
        for (let i = 0; i < camera._postProcesses.length; i++) {
          if (camera._postProcesses[i] !== null) {
            firstPP = camera._postProcesses[i];
            break;
          }
        }
      }
      const textureSize = { width: this.width, height: this.height };
      const textureOptions = {
        generateMipMaps: needMipMaps,
        generateDepthBuffer: forceDepthStencil || firstPP === this,
        generateStencilBuffer: (forceDepthStencil || firstPP === this) && this._engine.isStencilEnable,
        samplingMode: this.renderTargetSamplingMode,
        type: this._textureType,
        format: this._textureFormat,
        samples: this._samples,
        label: "PostProcessRTT-" + this.name
      };
      this._textures.push(this._createRenderTargetTexture(textureSize, textureOptions, 0));
      if (this._reusable) {
        this._textures.push(this._createRenderTargetTexture(textureSize, textureOptions, 1));
      }
      this._texelSize.copyFromFloats(1 / this.width, 1 / this.height);
      this.onSizeChangedObservable.notifyObservers(this);
    }
    _getTarget() {
      let target;
      if (this._shareOutputWithPostProcess) {
        target = this._shareOutputWithPostProcess.inputTexture;
      } else if (this._forcedOutputTexture) {
        target = this._forcedOutputTexture;
        this.width = this._forcedOutputTexture.width;
        this.height = this._forcedOutputTexture.height;
      } else {
        target = this.inputTexture;
        let cache;
        for (let i = 0; i < this._textureCache.length; i++) {
          if (this._textureCache[i].texture === target) {
            cache = this._textureCache[i];
            break;
          }
        }
        if (cache) {
          cache.lastUsedRenderId = this._renderId;
        }
      }
      return target;
    }
    /**
     * Activates the post process by intializing the textures to be used when executed. Notifies onActivateObservable.
     * When this post process is used in a pipeline, this is call will bind the input texture of this post process to the output of the previous.
     * @param cameraOrScene The camera that will be used in the post process. This camera will be used when calling onActivateObservable. You can also pass the scene if no camera is available.
     * @param sourceTexture The source texture to be inspected to get the width and height if not specified in the post process constructor. (default: null)
     * @param forceDepthStencil If true, a depth and stencil buffer will be generated. (default: false)
     * @returns The render target wrapper that was bound to be written to.
     */
    activate(cameraOrScene, sourceTexture = null, forceDepthStencil) {
      const camera = cameraOrScene === null || cameraOrScene.cameraRigMode !== void 0 ? cameraOrScene || this._camera : null;
      const scene = camera?.getScene() ?? cameraOrScene;
      const engine = scene.getEngine();
      const maxSize = engine.getCaps().maxTextureSize;
      const requiredWidth = (sourceTexture ? sourceTexture.width : this._engine.getRenderWidth(true)) * this._options | 0;
      const requiredHeight = (sourceTexture ? sourceTexture.height : this._engine.getRenderHeight(true)) * this._options | 0;
      let desiredWidth = this._options.width || requiredWidth;
      let desiredHeight = this._options.height || requiredHeight;
      const needMipMaps = this.renderTargetSamplingMode !== 7 && this.renderTargetSamplingMode !== 1 && this.renderTargetSamplingMode !== 2;
      let target = null;
      if (!this._shareOutputWithPostProcess && !this._forcedOutputTexture) {
        if (this.adaptScaleToCurrentViewport) {
          const currentViewport = engine.currentViewport;
          if (currentViewport) {
            desiredWidth *= currentViewport.width;
            desiredHeight *= currentViewport.height;
          }
        }
        if (needMipMaps || this.alwaysForcePOT) {
          if (!this._options.width) {
            desiredWidth = engine.needPOTTextures ? GetExponentOfTwo(desiredWidth, maxSize, this.scaleMode) : desiredWidth;
          }
          if (!this._options.height) {
            desiredHeight = engine.needPOTTextures ? GetExponentOfTwo(desiredHeight, maxSize, this.scaleMode) : desiredHeight;
          }
        }
        if (this.width !== desiredWidth || this.height !== desiredHeight || !(target = this._getTarget())) {
          this.resize(desiredWidth, desiredHeight, camera, needMipMaps, forceDepthStencil);
        }
        this._textures.forEach((texture) => {
          if (texture.samples !== this.samples) {
            this._engine.updateRenderTargetTextureSampleCount(texture, this.samples);
          }
        });
        this._flushTextureCache();
        this._renderId++;
      }
      if (!target) {
        target = this._getTarget();
      }
      if (this.enablePixelPerfectMode) {
        this._scaleRatio.copyFromFloats(requiredWidth / desiredWidth, requiredHeight / desiredHeight);
        this._engine.bindFramebuffer(target, 0, requiredWidth, requiredHeight, this.forceFullscreenViewport);
      } else {
        this._scaleRatio.copyFromFloats(1, 1);
        this._engine.bindFramebuffer(target, 0, void 0, void 0, this.forceFullscreenViewport);
      }
      this._engine._debugInsertMarker?.(`post process ${this.name} input`);
      this.onActivateObservable.notifyObservers(camera);
      if (this.autoClear && (this.alphaMode === 0 || this.forceAutoClearInAlphaMode)) {
        this._engine.clear(this.clearColor ? this.clearColor : scene.clearColor, scene._allowPostProcessClearColor, true, true);
      }
      if (this._reusable) {
        this._currentRenderTextureInd = (this._currentRenderTextureInd + 1) % 2;
      }
      return target;
    }
    /**
     * If the post process is supported.
     */
    get isSupported() {
      return this._effectWrapper.drawWrapper.effect.isSupported;
    }
    /**
     * The aspect ratio of the output texture.
     */
    get aspectRatio() {
      if (this._shareOutputWithPostProcess) {
        return this._shareOutputWithPostProcess.aspectRatio;
      }
      if (this._forcedOutputTexture) {
        return this._forcedOutputTexture.width / this._forcedOutputTexture.height;
      }
      return this.width / this.height;
    }
    /**
     * Get a value indicating if the post-process is ready to be used
     * @returns true if the post-process is ready (shader is compiled)
     */
    isReady() {
      return this._effectWrapper.isReady();
    }
    /**
     * Binds all textures and uniforms to the shader, this will be run on every pass.
     * @returns the effect corresponding to this post process. Null if not compiled or not ready.
     */
    apply() {
      if (!this._effectWrapper.isReady()) {
        return null;
      }
      this._engine.enableEffect(this._effectWrapper.drawWrapper);
      this._engine.setState(false);
      this._engine.setDepthBuffer(false);
      this._engine.setDepthWrite(false);
      if (this.alphaConstants) {
        this.getEngine().setAlphaConstants(this.alphaConstants.r, this.alphaConstants.g, this.alphaConstants.b, this.alphaConstants.a);
      }
      this._engine.setAlphaMode(this.alphaMode);
      let source;
      if (this._shareOutputWithPostProcess) {
        source = this._shareOutputWithPostProcess.inputTexture;
      } else if (this._forcedOutputTexture) {
        source = this._forcedOutputTexture;
      } else {
        source = this.inputTexture;
      }
      if (!this.externalTextureSamplerBinding) {
        this._effectWrapper.drawWrapper.effect._bindTexture("textureSampler", source?.texture);
      }
      this._effectWrapper.drawWrapper.effect.setVector2("scale", this._scaleRatio);
      this.onApplyObservable.notifyObservers(this._effectWrapper.drawWrapper.effect);
      this._effectWrapper.bind(true);
      return this._effectWrapper.drawWrapper.effect;
    }
    _disposeTextures() {
      if (this._shareOutputWithPostProcess || this._forcedOutputTexture) {
        this._disposeTextureCache();
        return;
      }
      this._disposeTextureCache();
      this._textures.dispose();
    }
    _disposeTextureCache() {
      for (let i = this._textureCache.length - 1; i >= 0; i--) {
        this._textureCache[i].texture.dispose();
      }
      this._textureCache.length = 0;
    }
    /**
     * Sets the required values to the prepass renderer.
     * @param prePassRenderer defines the prepass renderer to setup.
     * @returns true if the pre pass is needed.
     */
    setPrePassRenderer(prePassRenderer) {
      if (this._prePassEffectConfiguration) {
        this._prePassEffectConfiguration = prePassRenderer.addEffectConfiguration(this._prePassEffectConfiguration);
        this._prePassEffectConfiguration.enabled = true;
        return true;
      }
      return false;
    }
    /**
     * Disposes the post process.
     * @param camera The camera to dispose the post process on.
     */
    dispose(camera) {
      camera = camera || this._camera;
      if (!this._useExistingThinPostProcess) {
        this._effectWrapper.dispose();
      }
      this._disposeTextures();
      if (this._scene) {
        this._scene.removePostProcess(this);
      }
      let index;
      if (this._parentContainer) {
        index = this._parentContainer.postProcesses.indexOf(this);
        if (index > -1) {
          this._parentContainer.postProcesses.splice(index, 1);
        }
        this._parentContainer = null;
      }
      index = this._engine.postProcesses.indexOf(this);
      if (index !== -1) {
        this._engine.postProcesses.splice(index, 1);
      }
      this.onDisposeObservable.notifyObservers();
      if (!camera) {
        return;
      }
      camera.detachPostProcess(this);
      index = camera._postProcesses.indexOf(this);
      if (index === 0 && camera._postProcesses.length > 0) {
        const firstPostProcess = this._camera._getFirstPostProcess();
        if (firstPostProcess) {
          firstPostProcess.markTextureDirty();
        }
      }
      this.onActivateObservable.clear();
      this.onAfterRenderObservable.clear();
      this.onApplyObservable.clear();
      this.onBeforeRenderObservable.clear();
      this.onSizeChangedObservable.clear();
      this.onEffectCreatedObservable.clear();
    }
    /**
     * Serializes the post process to a JSON object
     * @returns the JSON object
     */
    serialize() {
      const serializationObject = SerializationHelper.Serialize(this);
      const camera = this.getCamera() || this._scene && this._scene.activeCamera;
      serializationObject.customType = "BABYLON." + this.getClassName();
      serializationObject.cameraId = camera ? camera.id : null;
      serializationObject.reusable = this._reusable;
      serializationObject.textureType = this._textureType;
      serializationObject.fragmentUrl = this._fragmentUrl;
      serializationObject.parameters = this._parameters;
      serializationObject.samplers = this._samplers;
      serializationObject.uniformBuffers = this._uniformBuffers;
      serializationObject.options = this._options;
      serializationObject.defines = this._postProcessDefines;
      serializationObject.textureFormat = this._textureFormat;
      serializationObject.vertexUrl = this._vertexUrl;
      serializationObject.indexParameters = this._indexParameters;
      return serializationObject;
    }
    /**
     * Clones this post process
     * @returns a new post process similar to this one
     */
    clone() {
      const serializationObject = this.serialize();
      serializationObject._engine = this._engine;
      serializationObject.cameraId = null;
      const result = _a.Parse(serializationObject, this._scene, "");
      if (!result) {
        return null;
      }
      result.onActivateObservable = this.onActivateObservable.clone();
      result.onSizeChangedObservable = this.onSizeChangedObservable.clone();
      result.onApplyObservable = this.onApplyObservable.clone();
      result.onBeforeRenderObservable = this.onBeforeRenderObservable.clone();
      result.onAfterRenderObservable = this.onAfterRenderObservable.clone();
      result._prePassEffectConfiguration = this._prePassEffectConfiguration;
      return result;
    }
    /**
     * Creates a material from parsed material data
     * @param parsedPostProcess defines parsed post process data
     * @param scene defines the hosting scene
     * @param rootUrl defines the root URL to use to load textures
     * @returns a new post process
     */
    static Parse(parsedPostProcess, scene, rootUrl) {
      const postProcessType = GetClass(parsedPostProcess.customType);
      if (!postProcessType || !postProcessType._Parse) {
        return null;
      }
      const camera = scene ? scene.getCameraById(parsedPostProcess.cameraId) : null;
      return postProcessType._Parse(parsedPostProcess, camera, scene, rootUrl);
    }
    /**
     * @internal
     */
    static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
      return SerializationHelper.Parse(() => {
        return new _a(parsedPostProcess.name, parsedPostProcess.fragmentUrl, parsedPostProcess.parameters, parsedPostProcess.samplers, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, parsedPostProcess._engine, parsedPostProcess.reusable, parsedPostProcess.defines, parsedPostProcess.textureType, parsedPostProcess.vertexUrl, parsedPostProcess.indexParameters, false, parsedPostProcess.textureFormat);
      }, parsedPostProcess, scene, rootUrl);
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? /* @__PURE__ */ Object.create(null) : void 0;
    _uniqueId_decorators = [serialize()];
    _get_name_decorators = [serialize()];
    _width_decorators = [serialize()];
    _height_decorators = [serialize()];
    _renderTargetSamplingMode_decorators = [serialize()];
    _clearColor_decorators = [serializeAsColor4()];
    _autoClear_decorators = [serialize()];
    _forceAutoClearInAlphaMode_decorators = [serialize()];
    _get_alphaMode_decorators = [serialize()];
    _alphaConstants_decorators = [serialize()];
    _enablePixelPerfectMode_decorators = [serialize()];
    _forceFullscreenViewport_decorators = [serialize()];
    _scaleMode_decorators = [serialize()];
    _alwaysForcePOT_decorators = [serialize()];
    __samples_decorators = [serialize("samples")];
    _adaptScaleToCurrentViewport_decorators = [serialize()];
    __esDecorate(_a, null, _get_name_decorators, { kind: "getter", name: "name", static: false, private: false, access: { has: (obj) => "name" in obj, get: (obj) => obj.name }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_alphaMode_decorators, { kind: "getter", name: "alphaMode", static: false, private: false, access: { has: (obj) => "alphaMode" in obj, get: (obj) => obj.alphaMode }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(null, null, _uniqueId_decorators, { kind: "field", name: "uniqueId", static: false, private: false, access: { has: (obj) => "uniqueId" in obj, get: (obj) => obj.uniqueId, set: (obj, value) => {
      obj.uniqueId = value;
    } }, metadata: _metadata }, _uniqueId_initializers, _uniqueId_extraInitializers);
    __esDecorate(null, null, _width_decorators, { kind: "field", name: "width", static: false, private: false, access: { has: (obj) => "width" in obj, get: (obj) => obj.width, set: (obj, value) => {
      obj.width = value;
    } }, metadata: _metadata }, _width_initializers, _width_extraInitializers);
    __esDecorate(null, null, _height_decorators, { kind: "field", name: "height", static: false, private: false, access: { has: (obj) => "height" in obj, get: (obj) => obj.height, set: (obj, value) => {
      obj.height = value;
    } }, metadata: _metadata }, _height_initializers, _height_extraInitializers);
    __esDecorate(null, null, _renderTargetSamplingMode_decorators, { kind: "field", name: "renderTargetSamplingMode", static: false, private: false, access: { has: (obj) => "renderTargetSamplingMode" in obj, get: (obj) => obj.renderTargetSamplingMode, set: (obj, value) => {
      obj.renderTargetSamplingMode = value;
    } }, metadata: _metadata }, _renderTargetSamplingMode_initializers, _renderTargetSamplingMode_extraInitializers);
    __esDecorate(null, null, _clearColor_decorators, { kind: "field", name: "clearColor", static: false, private: false, access: { has: (obj) => "clearColor" in obj, get: (obj) => obj.clearColor, set: (obj, value) => {
      obj.clearColor = value;
    } }, metadata: _metadata }, _clearColor_initializers, _clearColor_extraInitializers);
    __esDecorate(null, null, _autoClear_decorators, { kind: "field", name: "autoClear", static: false, private: false, access: { has: (obj) => "autoClear" in obj, get: (obj) => obj.autoClear, set: (obj, value) => {
      obj.autoClear = value;
    } }, metadata: _metadata }, _autoClear_initializers, _autoClear_extraInitializers);
    __esDecorate(null, null, _forceAutoClearInAlphaMode_decorators, { kind: "field", name: "forceAutoClearInAlphaMode", static: false, private: false, access: { has: (obj) => "forceAutoClearInAlphaMode" in obj, get: (obj) => obj.forceAutoClearInAlphaMode, set: (obj, value) => {
      obj.forceAutoClearInAlphaMode = value;
    } }, metadata: _metadata }, _forceAutoClearInAlphaMode_initializers, _forceAutoClearInAlphaMode_extraInitializers);
    __esDecorate(null, null, _alphaConstants_decorators, { kind: "field", name: "alphaConstants", static: false, private: false, access: { has: (obj) => "alphaConstants" in obj, get: (obj) => obj.alphaConstants, set: (obj, value) => {
      obj.alphaConstants = value;
    } }, metadata: _metadata }, _alphaConstants_initializers, _alphaConstants_extraInitializers);
    __esDecorate(null, null, _enablePixelPerfectMode_decorators, { kind: "field", name: "enablePixelPerfectMode", static: false, private: false, access: { has: (obj) => "enablePixelPerfectMode" in obj, get: (obj) => obj.enablePixelPerfectMode, set: (obj, value) => {
      obj.enablePixelPerfectMode = value;
    } }, metadata: _metadata }, _enablePixelPerfectMode_initializers, _enablePixelPerfectMode_extraInitializers);
    __esDecorate(null, null, _forceFullscreenViewport_decorators, { kind: "field", name: "forceFullscreenViewport", static: false, private: false, access: { has: (obj) => "forceFullscreenViewport" in obj, get: (obj) => obj.forceFullscreenViewport, set: (obj, value) => {
      obj.forceFullscreenViewport = value;
    } }, metadata: _metadata }, _forceFullscreenViewport_initializers, _forceFullscreenViewport_extraInitializers);
    __esDecorate(null, null, _scaleMode_decorators, { kind: "field", name: "scaleMode", static: false, private: false, access: { has: (obj) => "scaleMode" in obj, get: (obj) => obj.scaleMode, set: (obj, value) => {
      obj.scaleMode = value;
    } }, metadata: _metadata }, _scaleMode_initializers, _scaleMode_extraInitializers);
    __esDecorate(null, null, _alwaysForcePOT_decorators, { kind: "field", name: "alwaysForcePOT", static: false, private: false, access: { has: (obj) => "alwaysForcePOT" in obj, get: (obj) => obj.alwaysForcePOT, set: (obj, value) => {
      obj.alwaysForcePOT = value;
    } }, metadata: _metadata }, _alwaysForcePOT_initializers, _alwaysForcePOT_extraInitializers);
    __esDecorate(null, null, __samples_decorators, { kind: "field", name: "_samples", static: false, private: false, access: { has: (obj) => "_samples" in obj, get: (obj) => obj._samples, set: (obj, value) => {
      obj._samples = value;
    } }, metadata: _metadata }, __samples_initializers, __samples_extraInitializers);
    __esDecorate(null, null, _adaptScaleToCurrentViewport_decorators, { kind: "field", name: "adaptScaleToCurrentViewport", static: false, private: false, access: { has: (obj) => "adaptScaleToCurrentViewport" in obj, get: (obj) => obj.adaptScaleToCurrentViewport, set: (obj, value) => {
      obj.adaptScaleToCurrentViewport = value;
    } }, metadata: _metadata }, _adaptScaleToCurrentViewport_initializers, _adaptScaleToCurrentViewport_extraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
let _Registered$3 = false;
function RegisterPostProcess() {
  if (_Registered$3) {
    return;
  }
  _Registered$3 = true;
  AbstractEngine.prototype.setTextureFromPostProcess = function(channel, postProcess, name) {
    let postProcessInput = null;
    if (postProcess) {
      if (postProcess._forcedOutputTexture) {
        postProcessInput = postProcess._forcedOutputTexture;
      } else if (postProcess._textures.data[postProcess._currentRenderTextureInd]) {
        postProcessInput = postProcess._textures.data[postProcess._currentRenderTextureInd];
      }
    }
    this._bindTexture(channel, postProcessInput?.texture ?? null, name);
  };
  AbstractEngine.prototype.setTextureFromPostProcessOutput = function(channel, postProcess, name) {
    this._bindTexture(channel, postProcess?._outputTexture?.texture ?? null, name);
  };
  Effect.prototype.setTextureFromPostProcess = function(channel, postProcess) {
    this._engine.setTextureFromPostProcess(this._samplers[channel], postProcess, channel);
  };
  Effect.prototype.setTextureFromPostProcessOutput = function(channel, postProcess) {
    this._engine.setTextureFromPostProcessOutput(this._samplers[channel], postProcess, channel);
  };
  RegisterClass("BABYLON.PostProcess", PostProcess);
}
class ThinPassPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bd), true ? [] : void 0, import.meta.url)]));
    } else {
      list.push(Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.be), true ? [] : void 0, import.meta.url)]));
    }
    super._gatherImports(useWebGPU, list);
  }
  /**
   * Constructs a new pass post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    const localOptions = {
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinPassPostProcess.FragmentUrl,
      ...options
    };
    if (!localOptions.engine) {
      localOptions.engine = EngineStore.LastCreatedEngine;
    }
    super(localOptions);
  }
}
ThinPassPostProcess.FragmentUrl = "pass";
class ThinPassCubePostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bf), true ? [] : void 0, import.meta.url)]));
    } else {
      list.push(Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bg), true ? [] : void 0, import.meta.url)]));
    }
    super._gatherImports(useWebGPU, list);
  }
  /**
   * Creates the PassCubePostProcess
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinPassCubePostProcess.FragmentUrl,
      defines: "#define POSITIVEX"
    });
    this._face = 0;
  }
  /**
   * Gets or sets the cube face to display.
   *  * 0 is +X
   *  * 1 is -X
   *  * 2 is +Y
   *  * 3 is -Y
   *  * 4 is +Z
   *  * 5 is -Z
   */
  get face() {
    return this._face;
  }
  set face(value) {
    if (value < 0 || value > 5) {
      return;
    }
    this._face = value;
    switch (this._face) {
      case 0:
        this.updateEffect("#define POSITIVEX");
        break;
      case 1:
        this.updateEffect("#define NEGATIVEX");
        break;
      case 2:
        this.updateEffect("#define POSITIVEY");
        break;
      case 3:
        this.updateEffect("#define NEGATIVEY");
        break;
      case 4:
        this.updateEffect("#define POSITIVEZ");
        break;
      case 5:
        this.updateEffect("#define NEGATIVEZ");
        break;
    }
  }
}
ThinPassCubePostProcess.FragmentUrl = "passCube";
class PassPostProcess extends PostProcess {
  /**
   * Gets a string identifying the name of the class
   * @returns "PassPostProcess" string
   */
  getClassName() {
    return "PassPostProcess";
  }
  /**
   * Creates the PassPostProcess
   * @param name The name of the effect.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType The type of texture to be used when performing the post processing.
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(name, options, camera = null, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const localOptions = {
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      blockCompilation,
      ...options
    };
    super(name, ThinPassPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinPassPostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
  }
  /**
   * @internal
   */
  static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
    return SerializationHelper.Parse(() => {
      return new PassPostProcess(parsedPostProcess.name, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, parsedPostProcess._engine, parsedPostProcess.reusable);
    }, parsedPostProcess, scene, rootUrl);
  }
}
(() => {
  var _a;
  let _classSuper = PostProcess;
  let _instanceExtraInitializers = [];
  let _get_face_decorators;
  return _a = class PassCubePostProcess extends _classSuper {
    /**
     * Gets or sets the cube face to display.
     *  * 0 is +X
     *  * 1 is -X
     *  * 2 is +Y
     *  * 3 is -Y
     *  * 4 is +Z
     *  * 5 is -Z
     */
    get face() {
      return this._effectWrapper.face;
    }
    set face(value) {
      this._effectWrapper.face = value;
    }
    /**
     * Gets a string identifying the name of the class
     * @returns "PassCubePostProcess" string
     */
    getClassName() {
      return "PassCubePostProcess";
    }
    /**
     * Creates the PassCubePostProcess
     * @param name The name of the effect.
     * @param options The required width/height ratio to downsize to before computing the render pass.
     * @param camera The camera to apply the render pass to.
     * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
     * @param engine The engine which the post process will be applied. (default: current engine)
     * @param reusable If the post process can be reused on the same frame. (default: false)
     * @param textureType The type of texture to be used when performing the post processing.
     * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
     */
    constructor(name, options, camera = null, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
      const localOptions = {
        size: typeof options === "number" ? options : void 0,
        camera,
        samplingMode,
        engine,
        reusable,
        textureType,
        blockCompilation,
        ...options
      };
      super(name, ThinPassPostProcess.FragmentUrl, {
        effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinPassCubePostProcess(name, engine, localOptions) : void 0,
        ...localOptions
      });
      __runInitializers(this, _instanceExtraInitializers);
    }
    /**
     * @internal
     */
    static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
      return SerializationHelper.Parse(() => {
        return new _a(parsedPostProcess.name, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, parsedPostProcess._engine, parsedPostProcess.reusable);
      }, parsedPostProcess, scene, rootUrl);
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_face_decorators = [serialize()];
    __esDecorate(_a, null, _get_face_decorators, { kind: "getter", name: "face", static: false, private: false, access: { has: (obj) => "face" in obj, get: (obj) => obj.face }, metadata: _metadata }, null, _instanceExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
class ThinBlurPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bh), true ? [] : void 0, import.meta.url), __vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bi), true ? [] : void 0, import.meta.url)]));
    } else {
      list.push(Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bj), true ? [] : void 0, import.meta.url), __vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bk), true ? [] : void 0, import.meta.url)]));
    }
  }
  /**
   * Constructs a new blur post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param direction Direction in which to apply the blur
   * @param kernel Kernel size of the blur
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, direction, kernel, options) {
    const blockCompilationFinal = !!options?.blockCompilation;
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinBlurPostProcess.FragmentUrl,
      uniforms: ThinBlurPostProcess.Uniforms,
      samplers: ThinBlurPostProcess.Samplers,
      vertexUrl: ThinBlurPostProcess.VertexUrl,
      blockCompilation: true
    });
    this._packedFloat = false;
    this._staticDefines = "";
    this.textureWidth = 0;
    this.textureHeight = 0;
    this._staticDefines = options ? Array.isArray(options.defines) ? options.defines.join("\n") : options.defines || "" : "";
    this.options.blockCompilation = blockCompilationFinal;
    if (direction !== void 0) {
      this.direction = direction;
    }
    if (kernel !== void 0) {
      this.kernel = kernel;
    }
  }
  /**
   * Sets the length in pixels of the blur sample region
   */
  set kernel(v) {
    if (this._idealKernel === v) {
      return;
    }
    v = Math.max(v, 1);
    this._idealKernel = v;
    this._kernel = this._nearestBestKernel(v);
    if (!this.options.blockCompilation) {
      this._updateParameters();
    }
  }
  /**
   * Gets the length in pixels of the blur sample region
   */
  get kernel() {
    return this._idealKernel;
  }
  /**
   * Sets whether or not the blur needs to unpack/repack floats
   */
  set packedFloat(v) {
    if (this._packedFloat === v) {
      return;
    }
    this._packedFloat = v;
    if (!this.options.blockCompilation) {
      this._updateParameters();
    }
  }
  /**
   * Gets whether or not the blur is unpacking/repacking floats
   */
  get packedFloat() {
    return this._packedFloat;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this._drawWrapper.effect.setFloat2("delta", 1 / this.textureWidth * this.direction.x, 1 / this.textureHeight * this.direction.y);
  }
  /** @internal */
  _updateParameters(onCompiled, onError) {
    const n = this._kernel;
    const centerIndex = (n - 1) / 2;
    let offsets = [];
    let weights = [];
    let totalWeight = 0;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const w = this._gaussianWeight(u * 2 - 1);
      offsets[i] = i - centerIndex;
      weights[i] = w;
      totalWeight += w;
    }
    for (let i = 0; i < weights.length; i++) {
      weights[i] /= totalWeight;
    }
    const linearSamplingWeights = [];
    const linearSamplingOffsets = [];
    const linearSamplingMap = [];
    for (let i = 0; i <= centerIndex; i += 2) {
      const j = Math.min(i + 1, Math.floor(centerIndex));
      const singleCenterSample = i === j;
      if (singleCenterSample) {
        linearSamplingMap.push({ o: offsets[i], w: weights[i] });
      } else {
        const sharedCell = j === centerIndex;
        const weightLinear = weights[i] + weights[j] * (sharedCell ? 0.5 : 1);
        const offsetLinear = offsets[i] + 1 / (1 + weights[i] / weights[j]);
        if (offsetLinear === 0) {
          linearSamplingMap.push({ o: offsets[i], w: weights[i] });
          linearSamplingMap.push({ o: offsets[i + 1], w: weights[i + 1] });
        } else {
          linearSamplingMap.push({ o: offsetLinear, w: weightLinear });
          linearSamplingMap.push({ o: -offsetLinear, w: weightLinear });
        }
      }
    }
    for (let i = 0; i < linearSamplingMap.length; i++) {
      linearSamplingOffsets[i] = linearSamplingMap[i].o;
      linearSamplingWeights[i] = linearSamplingMap[i].w;
    }
    offsets = linearSamplingOffsets;
    weights = linearSamplingWeights;
    const maxVaryingRows = this.options.engine.getCaps().maxVaryingVectors - (this.options.shaderLanguage === 1 ? 1 : 0);
    const freeVaryingVec2 = Math.max(maxVaryingRows, 0) - 1;
    let varyingCount = Math.min(offsets.length, freeVaryingVec2);
    let defines = "";
    defines += this._staticDefines;
    if (this._staticDefines.indexOf("DOF") != -1) {
      defines += `#define CENTER_WEIGHT ${this._glslFloat(weights[varyingCount - 1])}
`;
      varyingCount--;
    }
    for (let i = 0; i < varyingCount; i++) {
      defines += `#define KERNEL_OFFSET${i} ${this._glslFloat(offsets[i])}
`;
      defines += `#define KERNEL_WEIGHT${i} ${this._glslFloat(weights[i])}
`;
    }
    let depCount = 0;
    for (let i = freeVaryingVec2; i < offsets.length; i++) {
      defines += `#define KERNEL_DEP_OFFSET${depCount} ${this._glslFloat(offsets[i])}
`;
      defines += `#define KERNEL_DEP_WEIGHT${depCount} ${this._glslFloat(weights[i])}
`;
      depCount++;
    }
    if (this.packedFloat) {
      defines += `#define PACKEDFLOAT 1`;
    }
    this.options.blockCompilation = false;
    this.updateEffect(defines, null, null, {
      varyingCount,
      depCount
    }, onCompiled, onError);
  }
  /**
   * Best kernels are odd numbers that when divided by 2, their integer part is even, so 5, 9 or 13.
   * Other odd kernels optimize correctly but require proportionally more samples, even kernels are
   * possible but will produce minor visual artifacts. Since each new kernel requires a new shader we
   * want to minimize kernel changes, having gaps between physical kernels is helpful in that regard.
   * The gaps between physical kernels are compensated for in the weighting of the samples
   * @param idealKernel Ideal blur kernel.
   * @returns Nearest best kernel.
   */
  _nearestBestKernel(idealKernel) {
    const v = Math.round(idealKernel);
    for (const k of [v, v - 1, v + 1, v - 2, v + 2]) {
      if (k % 2 !== 0 && Math.floor(k / 2) % 2 === 0 && k > 0) {
        return Math.max(k, 3);
      }
    }
    return Math.max(v, 3);
  }
  /**
   * Calculates the value of a Gaussian distribution with sigma 3 at a given point.
   * @param x The point on the Gaussian distribution to sample.
   * @returns the value of the Gaussian function at x.
   */
  _gaussianWeight(x) {
    const sigma = 1 / 3;
    const denominator = Math.sqrt(2 * Math.PI) * sigma;
    const exponent = -(x * x / (2 * sigma * sigma));
    const weight = 1 / denominator * Math.exp(exponent);
    return weight;
  }
  /**
   * Generates a string that can be used as a floating point number in GLSL.
   * @param x Value to print.
   * @param decimalFigures Number of decimal places to print the number to (excluding trailing 0s).
   * @returns GLSL float string.
   */
  _glslFloat(x, decimalFigures = 8) {
    return x.toFixed(decimalFigures).replace(/0+$/, "");
  }
}
ThinBlurPostProcess.VertexUrl = "kernelBlur";
ThinBlurPostProcess.FragmentUrl = "kernelBlur";
ThinBlurPostProcess.Uniforms = ["delta", "direction"];
ThinBlurPostProcess.Samplers = ["circleOfConfusionSampler"];
let BlurPostProcess = (() => {
  var _a;
  let _classSuper = PostProcess;
  let _instanceExtraInitializers = [];
  let _get_direction_decorators;
  let _set_kernel_decorators;
  let _set_packedFloat_decorators;
  return _a = class BlurPostProcess extends _classSuper {
    /** The direction in which to blur the image. */
    get direction() {
      return this._effectWrapper.direction;
    }
    set direction(value) {
      this._effectWrapper.direction = value;
    }
    /**
     * Sets the length in pixels of the blur sample region
     */
    set kernel(v) {
      this._effectWrapper.kernel = v;
    }
    /**
     * Gets the length in pixels of the blur sample region
     */
    get kernel() {
      return this._effectWrapper.kernel;
    }
    /**
     * Sets whether or not the blur needs to unpack/repack floats
     */
    set packedFloat(v) {
      this._effectWrapper.packedFloat = v;
    }
    /**
     * Gets whether or not the blur is unpacking/repacking floats
     */
    get packedFloat() {
      return this._effectWrapper.packedFloat;
    }
    /**
     * Gets a string identifying the name of the class
     * @returns "BlurPostProcess" string
     */
    getClassName() {
      return "BlurPostProcess";
    }
    /**
     * Creates a new instance BlurPostProcess
     * @param name The name of the effect.
     * @param direction The direction in which to blur the image.
     * @param kernel The size of the kernel to be used when computing the blur. eg. Size of 3 will blur the center pixel by 2 pixels surrounding it.
     * @param options The required width/height ratio to downsize to before computing the render pass. (Use 1.0 for full size)
     * @param camera The camera to apply the render pass to.
     * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
     * @param engine The engine which the post process will be applied. (default: current engine)
     * @param reusable If the post process can be reused on the same frame. (default: false)
     * @param textureType Type of textures used when performing the post process. (default: 0)
     * @param defines
     * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
     * @param textureFormat Format of textures used when performing the post process. (default: TEXTUREFORMAT_RGBA)
     */
    constructor(name, direction, kernel, options, camera = null, samplingMode = Texture.BILINEAR_SAMPLINGMODE, engine, reusable, textureType = 0, defines = "", blockCompilation = false, textureFormat = 5) {
      const blockCompilationFinal = typeof options === "number" ? blockCompilation : !!options.blockCompilation;
      const localOptions = {
        uniforms: ThinBlurPostProcess.Uniforms,
        samplers: ThinBlurPostProcess.Samplers,
        size: typeof options === "number" ? options : void 0,
        camera,
        samplingMode,
        engine,
        reusable,
        textureType,
        vertexUrl: ThinBlurPostProcess.VertexUrl,
        indexParameters: { varyingCount: 0, depCount: 0 },
        textureFormat,
        defines,
        ...options,
        blockCompilation: true
      };
      super(name, ThinBlurPostProcess.FragmentUrl, {
        effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinBlurPostProcess(name, engine, void 0, void 0, localOptions) : void 0,
        ...localOptions
      });
      __runInitializers(this, _instanceExtraInitializers);
      this._effectWrapper.options.blockCompilation = blockCompilationFinal;
      this.direction = direction;
      this.onApplyObservable.add(() => {
        this._effectWrapper.textureWidth = this._outputTexture ? this._outputTexture.width : this.width;
        this._effectWrapper.textureHeight = this._outputTexture ? this._outputTexture.height : this.height;
      });
      this.kernel = kernel;
    }
    /**
     * Updates the effect with the current post process compile time values and recompiles the shader
     * @param _defines the post process defines
     * @param _uniforms the post process uniforms
     * @param _samplers the post process samplers
     * @param _indexParameters the index parameters
     * @param onCompiled callback called when the shader is compiled
     * @param onError callback called if there is an error
     */
    updateEffect(_defines = null, _uniforms = null, _samplers = null, _indexParameters, onCompiled, onError) {
      this._effectWrapper._updateParameters(onCompiled, onError);
    }
    /**
     * @internal
     */
    static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
      return SerializationHelper.Parse(() => {
        return new _a(parsedPostProcess.name, parsedPostProcess.direction, parsedPostProcess.kernel, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.reusable, parsedPostProcess.textureType, void 0, false);
      }, parsedPostProcess, scene, rootUrl);
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_direction_decorators = [serializeAsVector2()];
    _set_kernel_decorators = [serialize()];
    _set_packedFloat_decorators = [serialize()];
    __esDecorate(_a, null, _get_direction_decorators, { kind: "getter", name: "direction", static: false, private: false, access: { has: (obj) => "direction" in obj, get: (obj) => obj.direction }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _set_kernel_decorators, { kind: "setter", name: "kernel", static: false, private: false, access: { has: (obj) => "kernel" in obj, set: (obj, value) => {
      obj.kernel = value;
    } }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _set_packedFloat_decorators, { kind: "setter", name: "packedFloat", static: false, private: false, access: { has: (obj) => "packedFloat" in obj, set: (obj, value) => {
      obj.packedFloat = value;
    } }, metadata: _metadata }, null, _instanceExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
class ThinSharpenPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bl), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bm), true ? [] : void 0, import.meta.url));
    }
  }
  /**
   * Constructs a new sharpen post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinSharpenPostProcess.FragmentUrl,
      uniforms: ThinSharpenPostProcess.Uniforms
    });
    this.colorAmount = 1;
    this.edgeAmount = 0.3;
    this.textureWidth = 0;
    this.textureHeight = 0;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const effect = this._drawWrapper.effect;
    effect.setFloat2("screenSize", this.textureWidth, this.textureHeight);
    effect.setFloat2("sharpnessAmounts", this.edgeAmount, this.colorAmount);
  }
}
ThinSharpenPostProcess.FragmentUrl = "sharpen";
ThinSharpenPostProcess.Uniforms = ["sharpnessAmounts", "screenSize"];
let SharpenPostProcess = (() => {
  var _a;
  let _classSuper = PostProcess;
  let _instanceExtraInitializers = [];
  let _get_colorAmount_decorators;
  let _get_edgeAmount_decorators;
  return _a = class SharpenPostProcess extends _classSuper {
    /**
     * How much of the original color should be applied. Setting this to 0 will display edge detection. (default: 1)
     */
    get colorAmount() {
      return this._effectWrapper.colorAmount;
    }
    set colorAmount(value) {
      this._effectWrapper.colorAmount = value;
    }
    /**
     * How much sharpness should be applied (default: 0.3)
     */
    get edgeAmount() {
      return this._effectWrapper.edgeAmount;
    }
    set edgeAmount(value) {
      this._effectWrapper.edgeAmount = value;
    }
    /**
     * Gets a string identifying the name of the class
     * @returns "SharpenPostProcess" string
     */
    getClassName() {
      return "SharpenPostProcess";
    }
    /**
     * Creates a new instance ConvolutionPostProcess
     * @param name The name of the effect.
     * @param options The required width/height ratio to downsize to before computing the render pass.
     * @param camera The camera to apply the render pass to.
     * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
     * @param engine The engine which the post process will be applied. (default: current engine)
     * @param reusable If the post process can be reused on the same frame. (default: false)
     * @param textureType Type of textures used when performing the post process. (default: 0)
     * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
     */
    constructor(name, options, camera, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
      const localOptions = {
        uniforms: ThinSharpenPostProcess.Uniforms,
        size: typeof options === "number" ? options : void 0,
        camera,
        samplingMode,
        engine,
        reusable,
        textureType,
        blockCompilation,
        ...options
      };
      super(name, ThinSharpenPostProcess.FragmentUrl, {
        effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinSharpenPostProcess(name, engine, localOptions) : void 0,
        ...localOptions
      });
      __runInitializers(this, _instanceExtraInitializers);
      this.onApply = (_effect) => {
        this._effectWrapper.textureWidth = this.width;
        this._effectWrapper.textureHeight = this.height;
      };
    }
    /**
     * @internal
     */
    static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
      return SerializationHelper.Parse(() => {
        return new _a(parsedPostProcess.name, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.textureType, parsedPostProcess.reusable);
      }, parsedPostProcess, scene, rootUrl);
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_colorAmount_decorators = [serialize()];
    _get_edgeAmount_decorators = [serialize()];
    __esDecorate(_a, null, _get_colorAmount_decorators, { kind: "getter", name: "colorAmount", static: false, private: false, access: { has: (obj) => "colorAmount" in obj, get: (obj) => obj.colorAmount }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_edgeAmount_decorators, { kind: "getter", name: "edgeAmount", static: false, private: false, access: { has: (obj) => "edgeAmount" in obj, get: (obj) => obj.edgeAmount }, metadata: _metadata }, null, _instanceExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
class ThinImageProcessingPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bn), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bo), true ? [] : void 0, import.meta.url));
    }
  }
  /**
   * Gets the image processing configuration used either in this material.
   */
  get imageProcessingConfiguration() {
    return this._imageProcessingConfiguration;
  }
  /**
   * Sets the Default image processing configuration used either in the this material.
   *
   * If sets to null, the scene one is in use.
   */
  set imageProcessingConfiguration(value) {
    value.applyByPostProcess = true;
    this._attachImageProcessingConfiguration(value);
  }
  /**
   * Attaches a new image processing configuration to the PBR Material.
   * @param configuration
   * @param doNotBuild
   */
  _attachImageProcessingConfiguration(configuration, doNotBuild = false) {
    if (configuration === this._imageProcessingConfiguration) {
      return;
    }
    if (this._imageProcessingConfiguration && this._imageProcessingObserver) {
      this._imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingObserver);
    }
    if (!configuration) {
      let scene = this.options.scene;
      if (!scene) {
        const engine = this.options.engine;
        if (engine && engine.scenes) {
          const scenes = engine.scenes;
          scene = scenes[scenes.length - 1];
        } else {
          scene = EngineStore.LastCreatedScene;
        }
      }
      if (scene) {
        this._imageProcessingConfiguration = scene.imageProcessingConfiguration;
      } else {
        this._imageProcessingConfiguration = new ImageProcessingConfiguration();
      }
    } else {
      this._imageProcessingConfiguration = configuration;
    }
    if (this._imageProcessingConfiguration) {
      this._imageProcessingObserver = this._imageProcessingConfiguration.onUpdateParameters.add(() => {
        this._updateParameters();
      });
    }
    if (!doNotBuild) {
      this._updateParameters();
    }
  }
  /**
   * Gets Color curves setup used in the effect if colorCurvesEnabled is set to true .
   */
  get colorCurves() {
    return this.imageProcessingConfiguration.colorCurves;
  }
  /**
   * Sets Color curves setup used in the effect if colorCurvesEnabled is set to true .
   */
  set colorCurves(value) {
    this.imageProcessingConfiguration.colorCurves = value;
  }
  /**
   * Gets whether the color curves effect is enabled.
   */
  get colorCurvesEnabled() {
    return this.imageProcessingConfiguration.colorCurvesEnabled;
  }
  /**
   * Sets whether the color curves effect is enabled.
   */
  set colorCurvesEnabled(value) {
    this.imageProcessingConfiguration.colorCurvesEnabled = value;
  }
  /**
   * Gets Color grading LUT texture used in the effect if colorGradingEnabled is set to true.
   */
  get colorGradingTexture() {
    return this.imageProcessingConfiguration.colorGradingTexture;
  }
  /**
   * Sets Color grading LUT texture used in the effect if colorGradingEnabled is set to true.
   */
  set colorGradingTexture(value) {
    this.imageProcessingConfiguration.colorGradingTexture = value;
  }
  /**
   * Gets whether the color grading effect is enabled.
   */
  get colorGradingEnabled() {
    return this.imageProcessingConfiguration.colorGradingEnabled;
  }
  /**
   * Gets whether the color grading effect is enabled.
   */
  set colorGradingEnabled(value) {
    this.imageProcessingConfiguration.colorGradingEnabled = value;
  }
  /**
   * Gets exposure used in the effect.
   */
  get exposure() {
    return this.imageProcessingConfiguration.exposure;
  }
  /**
   * Sets exposure used in the effect.
   */
  set exposure(value) {
    this.imageProcessingConfiguration.exposure = value;
  }
  /**
   * Gets whether tonemapping is enabled or not.
   */
  get toneMappingEnabled() {
    return this._imageProcessingConfiguration.toneMappingEnabled;
  }
  /**
   * Sets whether tonemapping is enabled or not
   */
  set toneMappingEnabled(value) {
    this._imageProcessingConfiguration.toneMappingEnabled = value;
  }
  /**
   * Gets the type of tone mapping effect.
   */
  get toneMappingType() {
    return this._imageProcessingConfiguration.toneMappingType;
  }
  /**
   * Sets the type of tone mapping effect.
   */
  set toneMappingType(value) {
    this._imageProcessingConfiguration.toneMappingType = value;
  }
  /**
   * Gets contrast used in the effect.
   */
  get contrast() {
    return this.imageProcessingConfiguration.contrast;
  }
  /**
   * Sets contrast used in the effect.
   */
  set contrast(value) {
    this.imageProcessingConfiguration.contrast = value;
  }
  /**
   * Gets Vignette stretch size.
   */
  get vignetteStretch() {
    return this.imageProcessingConfiguration.vignetteStretch;
  }
  /**
   * Sets Vignette stretch size.
   */
  set vignetteStretch(value) {
    this.imageProcessingConfiguration.vignetteStretch = value;
  }
  /**
   * Gets Vignette center X Offset.
   * @deprecated use vignetteCenterX instead
   */
  get vignetteCentreX() {
    return this.imageProcessingConfiguration.vignetteCenterX;
  }
  /**
   * Sets Vignette center X Offset.
   * @deprecated use vignetteCenterX instead
   */
  set vignetteCentreX(value) {
    this.imageProcessingConfiguration.vignetteCenterX = value;
  }
  /**
   * Gets Vignette center Y Offset.
   * @deprecated use vignetteCenterY instead
   */
  get vignetteCentreY() {
    return this.imageProcessingConfiguration.vignetteCenterY;
  }
  /**
   * Sets Vignette center Y Offset.
   * @deprecated use vignetteCenterY instead
   */
  set vignetteCentreY(value) {
    this.imageProcessingConfiguration.vignetteCenterY = value;
  }
  /**
   * Vignette center Y Offset.
   */
  get vignetteCenterY() {
    return this.imageProcessingConfiguration.vignetteCenterY;
  }
  set vignetteCenterY(value) {
    this.imageProcessingConfiguration.vignetteCenterY = value;
  }
  /**
   * Vignette center X Offset.
   */
  get vignetteCenterX() {
    return this.imageProcessingConfiguration.vignetteCenterX;
  }
  set vignetteCenterX(value) {
    this.imageProcessingConfiguration.vignetteCenterX = value;
  }
  /**
   * Gets Vignette weight or intensity of the vignette effect.
   */
  get vignetteWeight() {
    return this.imageProcessingConfiguration.vignetteWeight;
  }
  /**
   * Sets Vignette weight or intensity of the vignette effect.
   */
  set vignetteWeight(value) {
    this.imageProcessingConfiguration.vignetteWeight = value;
  }
  /**
   * Gets Color of the vignette applied on the screen through the chosen blend mode (vignetteBlendMode)
   * if vignetteEnabled is set to true.
   */
  get vignetteColor() {
    return this.imageProcessingConfiguration.vignetteColor;
  }
  /**
   * Sets Color of the vignette applied on the screen through the chosen blend mode (vignetteBlendMode)
   * if vignetteEnabled is set to true.
   */
  set vignetteColor(value) {
    this.imageProcessingConfiguration.vignetteColor = value;
  }
  /**
   * Gets Camera field of view used by the Vignette effect.
   */
  get vignetteCameraFov() {
    return this.imageProcessingConfiguration.vignetteCameraFov;
  }
  /**
   * Sets Camera field of view used by the Vignette effect.
   */
  set vignetteCameraFov(value) {
    this.imageProcessingConfiguration.vignetteCameraFov = value;
  }
  /**
   * Gets the vignette blend mode allowing different kind of effect.
   */
  get vignetteBlendMode() {
    return this.imageProcessingConfiguration.vignetteBlendMode;
  }
  /**
   * Sets the vignette blend mode allowing different kind of effect.
   */
  set vignetteBlendMode(value) {
    this.imageProcessingConfiguration.vignetteBlendMode = value;
  }
  /**
   * Gets whether the vignette effect is enabled.
   */
  get vignetteEnabled() {
    return this.imageProcessingConfiguration.vignetteEnabled;
  }
  /**
   * Sets whether the vignette effect is enabled.
   */
  set vignetteEnabled(value) {
    this.imageProcessingConfiguration.vignetteEnabled = value;
  }
  /**
   * Gets intensity of the dithering effect.
   */
  get ditheringIntensity() {
    return this.imageProcessingConfiguration.ditheringIntensity;
  }
  /**
   * Sets intensity of the dithering effect.
   */
  set ditheringIntensity(value) {
    this.imageProcessingConfiguration.ditheringIntensity = value;
  }
  /**
   * Gets whether the dithering effect is enabled.
   */
  get ditheringEnabled() {
    return this.imageProcessingConfiguration.ditheringEnabled;
  }
  /**
   * Sets whether the dithering effect is enabled.
   */
  set ditheringEnabled(value) {
    this.imageProcessingConfiguration.ditheringEnabled = value;
  }
  /**
   * Gets whether the input of the processing is in Gamma or Linear Space.
   */
  get fromLinearSpace() {
    return this._fromLinearSpace;
  }
  /**
   * Sets whether the input of the processing is in Gamma or Linear Space.
   */
  set fromLinearSpace(value) {
    if (this._fromLinearSpace === value) {
      return;
    }
    this._fromLinearSpace = value;
    this._updateParameters();
  }
  /**
   * * Gets the width of the output texture used to store the result of the post process.
   */
  get outputTextureWidth() {
    return this.imageProcessingConfiguration.outputTextureWidth;
  }
  /**
   * * Sets the width of the output texture used to store the result of the post process.
   */
  set outputTextureWidth(value) {
    this.imageProcessingConfiguration.outputTextureWidth = value;
  }
  /**
   * * Gets the height of the output texture used to store the result of the post process.
   */
  get outputTextureHeight() {
    return this.imageProcessingConfiguration.outputTextureHeight;
  }
  /**
   * * Sets the height of the output texture used to store the result of the post process.
   */
  set outputTextureHeight(value) {
    this.imageProcessingConfiguration.outputTextureHeight = value;
  }
  /**
   * Constructs a new image processing post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinImageProcessingPostProcess.FragmentUrl
    });
    this._fromLinearSpace = true;
    this._defines = {
      IMAGEPROCESSING: false,
      VIGNETTE: false,
      VIGNETTEBLENDMODEMULTIPLY: false,
      VIGNETTEBLENDMODEOPAQUE: false,
      TONEMAPPING: 0,
      CONTRAST: false,
      COLORCURVES: false,
      COLORGRADING: false,
      COLORGRADING3D: false,
      FROMLINEARSPACE: false,
      SAMPLER3DGREENDEPTH: false,
      SAMPLER3DBGRMAP: false,
      DITHER: false,
      IMAGEPROCESSINGPOSTPROCESS: false,
      EXPOSURE: false,
      SKIPFINALCOLORCLAMP: false
    };
    const imageProcessingConfiguration = options?.imageProcessingConfiguration;
    if (imageProcessingConfiguration) {
      imageProcessingConfiguration.applyByPostProcess = true;
      this._attachImageProcessingConfiguration(imageProcessingConfiguration, true);
      this._updateParameters();
    } else {
      this._attachImageProcessingConfiguration(null, true);
      this.imageProcessingConfiguration.applyByPostProcess = true;
    }
  }
  /**
   * @internal
   */
  _updateParameters() {
    this._defines.FROMLINEARSPACE = this._fromLinearSpace;
    this.imageProcessingConfiguration.prepareDefines(this._defines, true);
    let defines = "";
    for (const prop in this._defines) {
      const value = this._defines[prop];
      const type = typeof value;
      switch (type) {
        case "number":
        case "string":
          defines += `#define ${prop} ${value};
`;
          break;
        default:
          if (value) {
            defines += `#define ${prop};
`;
          }
          break;
      }
    }
    const samplers = ["textureSampler"];
    const uniforms = ["scale"];
    if (ImageProcessingConfiguration) {
      ImageProcessingConfiguration.PrepareSamplers(samplers, this._defines);
      ImageProcessingConfiguration.PrepareUniforms(uniforms, this._defines);
    }
    this.updateEffect(defines, uniforms, samplers);
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this.imageProcessingConfiguration.bind(this.effect, this.overrideAspectRatio);
  }
  dispose() {
    super.dispose();
    if (this._imageProcessingConfiguration && this._imageProcessingObserver) {
      this._imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingObserver);
    }
    if (this._imageProcessingConfiguration) {
      this.imageProcessingConfiguration.applyByPostProcess = false;
    }
  }
}
ThinImageProcessingPostProcess.FragmentUrl = "imageProcessing";
let ImageProcessingPostProcess = (() => {
  var _a;
  let _classSuper = PostProcess;
  let _instanceExtraInitializers = [];
  let _get_fromLinearSpace_decorators;
  return _a = class ImageProcessingPostProcess extends _classSuper {
    get _imageProcessingConfiguration() {
      return this._effectWrapper.imageProcessingConfiguration;
    }
    /**
     * Gets the image processing configuration used either in this material.
     */
    get imageProcessingConfiguration() {
      return this._effectWrapper.imageProcessingConfiguration;
    }
    /**
     * Sets the Default image processing configuration used either in the this material.
     *
     * If sets to null, the scene one is in use.
     */
    set imageProcessingConfiguration(value) {
      this._effectWrapper.imageProcessingConfiguration = value;
    }
    /**
     * If the post process is supported.
     */
    get isSupported() {
      const effect = this.getEffect();
      return !effect || effect.isSupported;
    }
    /**
     * Gets Color curves setup used in the effect if colorCurvesEnabled is set to true .
     */
    get colorCurves() {
      return this.imageProcessingConfiguration.colorCurves;
    }
    /**
     * Sets Color curves setup used in the effect if colorCurvesEnabled is set to true .
     */
    set colorCurves(value) {
      this.imageProcessingConfiguration.colorCurves = value;
    }
    /**
     * Gets whether the color curves effect is enabled.
     */
    get colorCurvesEnabled() {
      return this.imageProcessingConfiguration.colorCurvesEnabled;
    }
    /**
     * Sets whether the color curves effect is enabled.
     */
    set colorCurvesEnabled(value) {
      this.imageProcessingConfiguration.colorCurvesEnabled = value;
    }
    /**
     * Gets Color grading LUT texture used in the effect if colorGradingEnabled is set to true.
     */
    get colorGradingTexture() {
      return this.imageProcessingConfiguration.colorGradingTexture;
    }
    /**
     * Sets Color grading LUT texture used in the effect if colorGradingEnabled is set to true.
     */
    set colorGradingTexture(value) {
      this.imageProcessingConfiguration.colorGradingTexture = value;
    }
    /**
     * Gets whether the color grading effect is enabled.
     */
    get colorGradingEnabled() {
      return this.imageProcessingConfiguration.colorGradingEnabled;
    }
    /**
     * Gets whether the color grading effect is enabled.
     */
    set colorGradingEnabled(value) {
      this.imageProcessingConfiguration.colorGradingEnabled = value;
    }
    /**
     * Gets exposure used in the effect.
     */
    get exposure() {
      return this.imageProcessingConfiguration.exposure;
    }
    /**
     * Sets exposure used in the effect.
     */
    set exposure(value) {
      this.imageProcessingConfiguration.exposure = value;
    }
    /**
     * Gets whether tonemapping is enabled or not.
     */
    get toneMappingEnabled() {
      return this._imageProcessingConfiguration.toneMappingEnabled;
    }
    /**
     * Sets whether tonemapping is enabled or not
     */
    set toneMappingEnabled(value) {
      this._imageProcessingConfiguration.toneMappingEnabled = value;
    }
    /**
     * Gets the type of tone mapping effect.
     */
    get toneMappingType() {
      return this._imageProcessingConfiguration.toneMappingType;
    }
    /**
     * Sets the type of tone mapping effect.
     */
    set toneMappingType(value) {
      this._imageProcessingConfiguration.toneMappingType = value;
    }
    /**
     * Gets contrast used in the effect.
     */
    get contrast() {
      return this.imageProcessingConfiguration.contrast;
    }
    /**
     * Sets contrast used in the effect.
     */
    set contrast(value) {
      this.imageProcessingConfiguration.contrast = value;
    }
    /**
     * Gets Vignette stretch size.
     */
    get vignetteStretch() {
      return this.imageProcessingConfiguration.vignetteStretch;
    }
    /**
     * Sets Vignette stretch size.
     */
    set vignetteStretch(value) {
      this.imageProcessingConfiguration.vignetteStretch = value;
    }
    /**
     * Gets Vignette center X Offset.
     * @deprecated use vignetteCenterX instead
     */
    get vignetteCentreX() {
      return this.imageProcessingConfiguration.vignetteCenterX;
    }
    /**
     * Sets Vignette center X Offset.
     * @deprecated use vignetteCenterX instead
     */
    set vignetteCentreX(value) {
      this.imageProcessingConfiguration.vignetteCenterX = value;
    }
    /**
     * Gets Vignette center Y Offset.
     * @deprecated use vignetteCenterY instead
     */
    get vignetteCentreY() {
      return this.imageProcessingConfiguration.vignetteCenterY;
    }
    /**
     * Sets Vignette center Y Offset.
     * @deprecated use vignetteCenterY instead
     */
    set vignetteCentreY(value) {
      this.imageProcessingConfiguration.vignetteCenterY = value;
    }
    /**
     * Vignette center Y Offset.
     */
    get vignetteCenterY() {
      return this.imageProcessingConfiguration.vignetteCenterY;
    }
    set vignetteCenterY(value) {
      this.imageProcessingConfiguration.vignetteCenterY = value;
    }
    /**
     * Vignette center X Offset.
     */
    get vignetteCenterX() {
      return this.imageProcessingConfiguration.vignetteCenterX;
    }
    set vignetteCenterX(value) {
      this.imageProcessingConfiguration.vignetteCenterX = value;
    }
    /**
     * Gets Vignette weight or intensity of the vignette effect.
     */
    get vignetteWeight() {
      return this.imageProcessingConfiguration.vignetteWeight;
    }
    /**
     * Sets Vignette weight or intensity of the vignette effect.
     */
    set vignetteWeight(value) {
      this.imageProcessingConfiguration.vignetteWeight = value;
    }
    /**
     * Gets Color of the vignette applied on the screen through the chosen blend mode (vignetteBlendMode)
     * if vignetteEnabled is set to true.
     */
    get vignetteColor() {
      return this.imageProcessingConfiguration.vignetteColor;
    }
    /**
     * Sets Color of the vignette applied on the screen through the chosen blend mode (vignetteBlendMode)
     * if vignetteEnabled is set to true.
     */
    set vignetteColor(value) {
      this.imageProcessingConfiguration.vignetteColor = value;
    }
    /**
     * Gets Camera field of view used by the Vignette effect.
     */
    get vignetteCameraFov() {
      return this.imageProcessingConfiguration.vignetteCameraFov;
    }
    /**
     * Sets Camera field of view used by the Vignette effect.
     */
    set vignetteCameraFov(value) {
      this.imageProcessingConfiguration.vignetteCameraFov = value;
    }
    /**
     * Gets the vignette blend mode allowing different kind of effect.
     */
    get vignetteBlendMode() {
      return this.imageProcessingConfiguration.vignetteBlendMode;
    }
    /**
     * Sets the vignette blend mode allowing different kind of effect.
     */
    set vignetteBlendMode(value) {
      this.imageProcessingConfiguration.vignetteBlendMode = value;
    }
    /**
     * Gets whether the vignette effect is enabled.
     */
    get vignetteEnabled() {
      return this.imageProcessingConfiguration.vignetteEnabled;
    }
    /**
     * Sets whether the vignette effect is enabled.
     */
    set vignetteEnabled(value) {
      this.imageProcessingConfiguration.vignetteEnabled = value;
    }
    /**
     * Gets intensity of the dithering effect.
     */
    get ditheringIntensity() {
      return this.imageProcessingConfiguration.ditheringIntensity;
    }
    /**
     * Sets intensity of the dithering effect.
     */
    set ditheringIntensity(value) {
      this.imageProcessingConfiguration.ditheringIntensity = value;
    }
    /**
     * Gets whether the dithering effect is enabled.
     */
    get ditheringEnabled() {
      return this.imageProcessingConfiguration.ditheringEnabled;
    }
    /**
     * Sets whether the dithering effect is enabled.
     */
    set ditheringEnabled(value) {
      this.imageProcessingConfiguration.ditheringEnabled = value;
    }
    /**
     * Gets whether the input of the processing is in Gamma or Linear Space.
     */
    get fromLinearSpace() {
      return this._effectWrapper.fromLinearSpace;
    }
    /**
     * Sets whether the input of the processing is in Gamma or Linear Space.
     */
    set fromLinearSpace(value) {
      this._effectWrapper.fromLinearSpace = value;
    }
    constructor(name, options, camera = null, samplingMode, engine, reusable, textureType = 0, imageProcessingConfiguration) {
      const localOptions = {
        size: typeof options === "number" ? options : void 0,
        camera,
        samplingMode,
        engine,
        reusable,
        textureType,
        imageProcessingConfiguration,
        scene: camera?.getScene(),
        ...options,
        blockCompilation: true
      };
      super(name, ThinImageProcessingPostProcess.FragmentUrl, {
        effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinImageProcessingPostProcess(name, engine, localOptions) : void 0,
        ...localOptions
      });
      __runInitializers(this, _instanceExtraInitializers);
      this.onApply = () => {
        this._effectWrapper.overrideAspectRatio = this.aspectRatio;
      };
    }
    /**
     *  "ImageProcessingPostProcess"
     * @returns "ImageProcessingPostProcess"
     */
    getClassName() {
      return "ImageProcessingPostProcess";
    }
    /**
     * @internal
     */
    _updateParameters() {
      this._effectWrapper._updateParameters();
    }
    dispose(camera) {
      super.dispose(camera);
      if (this._imageProcessingConfiguration) {
        this.imageProcessingConfiguration.applyByPostProcess = false;
      }
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_fromLinearSpace_decorators = [serialize()];
    __esDecorate(_a, null, _get_fromLinearSpace_decorators, { kind: "getter", name: "fromLinearSpace", static: false, private: false, access: { has: (obj) => "fromLinearSpace" in obj, get: (obj) => obj.fromLinearSpace }, metadata: _metadata }, null, _instanceExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
class ThinChromaticAberrationPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bp), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bq), true ? [] : void 0, import.meta.url));
    }
  }
  /**
   * Constructs a new chromatic aberration post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinChromaticAberrationPostProcess.FragmentUrl,
      uniforms: ThinChromaticAberrationPostProcess.Uniforms
    });
    this.aberrationAmount = 30;
    this.radialIntensity = 0;
    this.direction = new Vector2(0.707, 0.707);
    this.centerPosition = new Vector2(0.5, 0.5);
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const effect = this._drawWrapper.effect;
    effect.setFloat("chromatic_aberration", this.aberrationAmount);
    effect.setFloat("screen_width", this.screenWidth);
    effect.setFloat("screen_height", this.screenHeight);
    effect.setFloat("radialIntensity", this.radialIntensity);
    effect.setFloat2("direction", this.direction.x, this.direction.y);
    effect.setFloat2("centerPosition", this.centerPosition.x, this.centerPosition.y);
  }
}
ThinChromaticAberrationPostProcess.FragmentUrl = "chromaticAberration";
ThinChromaticAberrationPostProcess.Uniforms = ["chromatic_aberration", "screen_width", "screen_height", "direction", "radialIntensity", "centerPosition"];
let ChromaticAberrationPostProcess = (() => {
  var _a;
  let _classSuper = PostProcess;
  let _instanceExtraInitializers = [];
  let _get_aberrationAmount_decorators;
  let _get_radialIntensity_decorators;
  let _get_direction_decorators;
  let _get_centerPosition_decorators;
  let _get_screenWidth_decorators;
  let _get_screenHeight_decorators;
  return _a = class ChromaticAberrationPostProcess extends _classSuper {
    /**
     * The amount of separation of rgb channels (default: 30)
     */
    get aberrationAmount() {
      return this._effectWrapper.aberrationAmount;
    }
    set aberrationAmount(value) {
      this._effectWrapper.aberrationAmount = value;
    }
    /**
     * The amount the effect will increase for pixels closer to the edge of the screen. (default: 0)
     */
    get radialIntensity() {
      return this._effectWrapper.radialIntensity;
    }
    set radialIntensity(value) {
      this._effectWrapper.radialIntensity = value;
    }
    /**
     * The normalized direction in which the rgb channels should be separated. If set to 0,0 radial direction will be used. (default: Vector2(0.707,0.707))
     */
    get direction() {
      return this._effectWrapper.direction;
    }
    set direction(value) {
      this._effectWrapper.direction = value;
    }
    /**
     * The center position where the radialIntensity should be around. [0.5,0.5 is center of screen, 1,1 is top right corner] (default: Vector2(0.5 ,0.5))
     */
    get centerPosition() {
      return this._effectWrapper.centerPosition;
    }
    set centerPosition(value) {
      this._effectWrapper.centerPosition = value;
    }
    /** The width of the screen to apply the effect on */
    get screenWidth() {
      return this._effectWrapper.screenWidth;
    }
    set screenWidth(value) {
      this._effectWrapper.screenWidth = value;
    }
    /** The height of the screen to apply the effect on */
    get screenHeight() {
      return this._effectWrapper.screenHeight;
    }
    set screenHeight(value) {
      this._effectWrapper.screenHeight = value;
    }
    /**
     * Gets a string identifying the name of the class
     * @returns "ChromaticAberrationPostProcess" string
     */
    getClassName() {
      return "ChromaticAberrationPostProcess";
    }
    /**
     * Creates a new instance ChromaticAberrationPostProcess
     * @param name The name of the effect.
     * @param screenWidth The width of the screen to apply the effect on.
     * @param screenHeight The height of the screen to apply the effect on.
     * @param options The required width/height ratio to downsize to before computing the render pass.
     * @param camera The camera to apply the render pass to.
     * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
     * @param engine The engine which the post process will be applied. (default: current engine)
     * @param reusable If the post process can be reused on the same frame. (default: false)
     * @param textureType Type of textures used when performing the post process. (default: 0)
     * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
     */
    constructor(name, screenWidth, screenHeight, options, camera, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
      const localOptions = {
        uniforms: ThinChromaticAberrationPostProcess.Uniforms,
        size: typeof options === "number" ? options : void 0,
        camera,
        samplingMode,
        engine,
        reusable,
        textureType,
        blockCompilation,
        ...options
      };
      super(name, ThinChromaticAberrationPostProcess.FragmentUrl, {
        effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinChromaticAberrationPostProcess(name, engine, localOptions) : void 0,
        ...localOptions
      });
      __runInitializers(this, _instanceExtraInitializers);
      this.screenWidth = screenWidth;
      this.screenHeight = screenHeight;
    }
    /**
     * @internal
     */
    static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
      return SerializationHelper.Parse(() => {
        return new _a(parsedPostProcess.name, parsedPostProcess.screenWidth, parsedPostProcess.screenHeight, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.reusable, parsedPostProcess.textureType, false);
      }, parsedPostProcess, scene, rootUrl);
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_aberrationAmount_decorators = [serialize()];
    _get_radialIntensity_decorators = [serialize()];
    _get_direction_decorators = [serialize()];
    _get_centerPosition_decorators = [serialize()];
    _get_screenWidth_decorators = [serialize()];
    _get_screenHeight_decorators = [serialize()];
    __esDecorate(_a, null, _get_aberrationAmount_decorators, { kind: "getter", name: "aberrationAmount", static: false, private: false, access: { has: (obj) => "aberrationAmount" in obj, get: (obj) => obj.aberrationAmount }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_radialIntensity_decorators, { kind: "getter", name: "radialIntensity", static: false, private: false, access: { has: (obj) => "radialIntensity" in obj, get: (obj) => obj.radialIntensity }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_direction_decorators, { kind: "getter", name: "direction", static: false, private: false, access: { has: (obj) => "direction" in obj, get: (obj) => obj.direction }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_centerPosition_decorators, { kind: "getter", name: "centerPosition", static: false, private: false, access: { has: (obj) => "centerPosition" in obj, get: (obj) => obj.centerPosition }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_screenWidth_decorators, { kind: "getter", name: "screenWidth", static: false, private: false, access: { has: (obj) => "screenWidth" in obj, get: (obj) => obj.screenWidth }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_screenHeight_decorators, { kind: "getter", name: "screenHeight", static: false, private: false, access: { has: (obj) => "screenHeight" in obj, get: (obj) => obj.screenHeight }, metadata: _metadata }, null, _instanceExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
class ThinGrainPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.br), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bs), true ? [] : void 0, import.meta.url));
    }
  }
  /**
   * Constructs a new grain post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinGrainPostProcess.FragmentUrl,
      uniforms: ThinGrainPostProcess.Uniforms
    });
    this.intensity = 30;
    this.animated = false;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this._drawWrapper.effect.setFloat("intensity", this.intensity);
    this._drawWrapper.effect.setFloat("animatedSeed", this.animated ? Math.random() + 1 : 1);
  }
}
ThinGrainPostProcess.FragmentUrl = "grain";
ThinGrainPostProcess.Uniforms = ["intensity", "animatedSeed"];
let GrainPostProcess = (() => {
  var _a;
  let _classSuper = PostProcess;
  let _instanceExtraInitializers = [];
  let _get_intensity_decorators;
  let _get_animated_decorators;
  return _a = class GrainPostProcess extends _classSuper {
    /**
     * The intensity of the grain added (default: 30)
     */
    get intensity() {
      return this._effectWrapper.intensity;
    }
    set intensity(value) {
      this._effectWrapper.intensity = value;
    }
    /**
     * If the grain should be randomized on every frame
     */
    get animated() {
      return this._effectWrapper.animated;
    }
    set animated(value) {
      this._effectWrapper.animated = value;
    }
    /**
     * Gets a string identifying the name of the class
     * @returns "GrainPostProcess" string
     */
    getClassName() {
      return "GrainPostProcess";
    }
    /**
     * Creates a new instance of @see GrainPostProcess
     * @param name The name of the effect.
     * @param options The required width/height ratio to downsize to before computing the render pass.
     * @param camera The camera to apply the render pass to.
     * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
     * @param engine The engine which the post process will be applied. (default: current engine)
     * @param reusable If the post process can be reused on the same frame. (default: false)
     * @param textureType Type of textures used when performing the post process. (default: 0)
     * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
     */
    constructor(name, options, camera, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
      const localOptions = {
        uniforms: ThinGrainPostProcess.Uniforms,
        size: typeof options === "number" ? options : void 0,
        camera,
        samplingMode,
        engine,
        reusable,
        textureType,
        blockCompilation,
        ...options
      };
      super(name, ThinGrainPostProcess.FragmentUrl, {
        effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinGrainPostProcess(name, engine, localOptions) : void 0,
        ...localOptions
      });
      __runInitializers(this, _instanceExtraInitializers);
    }
    /**
     * @internal
     */
    static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
      return SerializationHelper.Parse(() => {
        return new _a(parsedPostProcess.name, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.reusable);
      }, parsedPostProcess, scene, rootUrl);
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_intensity_decorators = [serialize()];
    _get_animated_decorators = [serialize()];
    __esDecorate(_a, null, _get_intensity_decorators, { kind: "getter", name: "intensity", static: false, private: false, access: { has: (obj) => "intensity" in obj, get: (obj) => obj.intensity }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_animated_decorators, { kind: "getter", name: "animated", static: false, private: false, access: { has: (obj) => "animated" in obj, get: (obj) => obj.animated }, metadata: _metadata }, null, _instanceExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
class ThinFXAAPostProcess extends EffectWrapper {
  static _GetDefines(engine) {
    if (!engine) {
      return null;
    }
    const driverInfo = engine.extractDriverInfo();
    if (driverInfo.toLowerCase().indexOf("mali") > -1) {
      return "#define MALI 1\n";
    }
    return null;
  }
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bt), true ? [] : void 0, import.meta.url), __vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bu), true ? [] : void 0, import.meta.url)]));
    } else {
      list.push(Promise.all([__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bv), true ? [] : void 0, import.meta.url), __vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bw), true ? [] : void 0, import.meta.url)]));
    }
  }
  /**
   * Constructs a new FXAA post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    const localOptions = {
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      vertexShader: ThinFXAAPostProcess.VertexUrl,
      fragmentShader: ThinFXAAPostProcess.FragmentUrl,
      uniforms: ThinFXAAPostProcess.Uniforms
    };
    super({
      ...localOptions,
      defines: ThinFXAAPostProcess._GetDefines(localOptions.engine)
    });
    this.texelSize = new Vector2(0, 0);
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this._drawWrapper.effect.setFloat2("texelSize", this.texelSize.x, this.texelSize.y);
  }
}
ThinFXAAPostProcess.VertexUrl = "fxaa";
ThinFXAAPostProcess.FragmentUrl = "fxaa";
ThinFXAAPostProcess.Uniforms = ["texelSize"];
class FxaaPostProcess extends PostProcess {
  /**
   * Gets a string identifying the name of the class
   * @returns "FxaaPostProcess" string
   */
  getClassName() {
    return "FxaaPostProcess";
  }
  constructor(name, options, camera = null, samplingMode, engine, reusable, textureType = 0) {
    const localOptions = {
      uniforms: ThinFXAAPostProcess.Uniforms,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode: samplingMode || Texture.BILINEAR_SAMPLINGMODE,
      engine,
      reusable,
      textureType,
      ...options
    };
    super(name, ThinFXAAPostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinFXAAPostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
    this.onApplyObservable.add((_effect) => {
      this._effectWrapper.texelSize = this.texelSize;
    });
  }
  /**
   * @internal
   */
  static _Parse(parsedPostProcess, targetCamera, scene, rootUrl) {
    return SerializationHelper.Parse(() => {
      return new FxaaPostProcess(parsedPostProcess.name, parsedPostProcess.options, targetCamera, parsedPostProcess.renderTargetSamplingMode, scene.getEngine(), parsedPostProcess.reusable);
    }, parsedPostProcess, scene, rootUrl);
  }
}
let _PostProcessRenderPipelineManagerClass;
class PostProcessRenderPipelineManagerSceneComponent {
  /**
   * Creates a new instance of the component for the given scene
   * @param scene Defines the scene to register the component in
   */
  constructor(scene) {
    this.name = SceneComponentConstants.NAME_POSTPROCESSRENDERPIPELINEMANAGER;
    this.scene = scene;
  }
  /**
   * Registers the component in a given scene
   */
  register() {
    this.scene._gatherRenderTargetsStage.registerStep(SceneComponentConstants.STEP_GATHERRENDERTARGETS_POSTPROCESSRENDERPIPELINEMANAGER, this, this._gatherRenderTargets);
  }
  /**
   * Rebuilds the elements related to this component in case of
   * context lost for instance.
   */
  rebuild() {
    if (this.scene._postProcessRenderPipelineManager) {
      this.scene._postProcessRenderPipelineManager._rebuild();
    }
  }
  /**
   * Disposes the component and the associated resources
   */
  dispose() {
    if (this.scene._postProcessRenderPipelineManager) {
      this.scene._postProcessRenderPipelineManager.dispose();
    }
  }
  _gatherRenderTargets() {
    if (this.scene._postProcessRenderPipelineManager) {
      this.scene._postProcessRenderPipelineManager.update();
    }
  }
}
let _Registered$2 = false;
function RegisterPostProcessRenderPipelineManagerSceneComponent(pipelineManagerClass) {
  if (pipelineManagerClass) {
    _PostProcessRenderPipelineManagerClass = pipelineManagerClass;
  }
  if (_Registered$2) {
    return;
  }
  _Registered$2 = true;
  Object.defineProperty(Scene.prototype, "postProcessRenderPipelineManager", {
    get: function() {
      if (!this._postProcessRenderPipelineManager) {
        let component = this._getComponent(SceneComponentConstants.NAME_POSTPROCESSRENDERPIPELINEMANAGER);
        if (!component) {
          component = new PostProcessRenderPipelineManagerSceneComponent(this);
          this._addComponent(component);
        }
        this._postProcessRenderPipelineManager = new _PostProcessRenderPipelineManagerClass();
      }
      return this._postProcessRenderPipelineManager;
    },
    enumerable: true,
    configurable: true
  });
}
class PostProcessRenderPipelineManager {
  /**
   * Initializes a PostProcessRenderPipelineManager
   * @see https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/postProcessRenderPipeline
   */
  constructor() {
    this._renderPipelines = {};
    this._onNewPipelineAddedObservable = new Observable();
    this._onPipelineRemovedObservable = new Observable();
    RegisterPostProcessRenderPipelineManagerSceneComponent(PostProcessRenderPipelineManager);
  }
  /**
   * An event triggered when a pipeline is added to the manager
   */
  get onNewPipelineAddedObservable() {
    return this._onNewPipelineAddedObservable;
  }
  /**
   * An event triggered when a pipeline is removed from the manager
   */
  get onPipelineRemovedObservable() {
    return this._onPipelineRemovedObservable;
  }
  /**
   * Gets the list of supported render pipelines
   */
  get supportedPipelines() {
    const result = [];
    for (const renderPipelineName in this._renderPipelines) {
      if (Object.prototype.hasOwnProperty.call(this._renderPipelines, renderPipelineName)) {
        const pipeline = this._renderPipelines[renderPipelineName];
        if (pipeline.isSupported) {
          result.push(pipeline);
        }
      }
    }
    return result;
  }
  /**
   * Adds a pipeline to the manager
   * @param renderPipeline The pipeline to add
   */
  addPipeline(renderPipeline) {
    this.removePipeline(renderPipeline._name);
    this._renderPipelines[renderPipeline._name] = renderPipeline;
    this._onNewPipelineAddedObservable.notifyObservers(renderPipeline);
  }
  /**
   * Remove the pipeline from the manager
   * @param renderPipelineName the name of the pipeline to remove
   */
  removePipeline(renderPipelineName) {
    const pipeline = this._renderPipelines[renderPipelineName];
    if (pipeline) {
      this._onPipelineRemovedObservable.notifyObservers(pipeline);
      delete this._renderPipelines[renderPipelineName];
    }
  }
  /**
   * Attaches a camera to the pipeline
   * @param renderPipelineName The name of the pipeline to attach to
   * @param cameras the camera to attach
   * @param unique if the camera can be attached multiple times to the pipeline
   */
  attachCamerasToRenderPipeline(renderPipelineName, cameras, unique = false) {
    const renderPipeline = this._renderPipelines[renderPipelineName];
    if (!renderPipeline) {
      return;
    }
    renderPipeline._attachCameras(cameras, unique);
  }
  /**
   * Detaches a camera from the pipeline
   * @param renderPipelineName The name of the pipeline to detach from
   * @param cameras the camera to detach
   */
  detachCamerasFromRenderPipeline(renderPipelineName, cameras) {
    const renderPipeline = this._renderPipelines[renderPipelineName];
    if (!renderPipeline) {
      return;
    }
    renderPipeline._detachCameras(cameras);
  }
  /**
   * Enables an effect by name on a pipeline
   * @param renderPipelineName the name of the pipeline to enable the effect in
   * @param renderEffectName the name of the effect to enable
   * @param cameras the cameras that the effect should be enabled on
   */
  enableEffectInPipeline(renderPipelineName, renderEffectName, cameras) {
    const renderPipeline = this._renderPipelines[renderPipelineName];
    if (!renderPipeline) {
      return;
    }
    renderPipeline._enableEffect(renderEffectName, cameras);
  }
  /**
   * Disables an effect by name on a pipeline
   * @param renderPipelineName the name of the pipeline to disable the effect in
   * @param renderEffectName the name of the effect to disable
   * @param cameras the cameras that the effect should be disabled on
   */
  disableEffectInPipeline(renderPipelineName, renderEffectName, cameras) {
    const renderPipeline = this._renderPipelines[renderPipelineName];
    if (!renderPipeline) {
      return;
    }
    renderPipeline._disableEffect(renderEffectName, cameras);
  }
  /**
   * Updates the state of all contained render pipelines and disposes of any non supported pipelines
   */
  update() {
    for (const renderPipelineName in this._renderPipelines) {
      if (Object.prototype.hasOwnProperty.call(this._renderPipelines, renderPipelineName)) {
        const pipeline = this._renderPipelines[renderPipelineName];
        if (!pipeline.isSupported) {
          pipeline.dispose();
          delete this._renderPipelines[renderPipelineName];
        } else {
          pipeline._update();
        }
      }
    }
  }
  /** @internal */
  _rebuild() {
    for (const renderPipelineName in this._renderPipelines) {
      if (Object.prototype.hasOwnProperty.call(this._renderPipelines, renderPipelineName)) {
        const pipeline = this._renderPipelines[renderPipelineName];
        pipeline._rebuild();
      }
    }
  }
  /**
   * Disposes of the manager and pipelines
   */
  dispose() {
    for (const renderPipelineName in this._renderPipelines) {
      if (Object.prototype.hasOwnProperty.call(this._renderPipelines, renderPipelineName)) {
        const pipeline = this._renderPipelines[renderPipelineName];
        pipeline.dispose();
      }
    }
  }
}
let PostProcessRenderPipeline = (() => {
  var _a;
  let __name_decorators;
  let __name_initializers = [];
  let __name_extraInitializers = [];
  return _a = class PostProcessRenderPipeline {
    /**
     * Gets pipeline name
     */
    get name() {
      return this._name;
    }
    /** Gets the list of attached cameras */
    get cameras() {
      return this._cameras;
    }
    /**
     * Gets the active engine
     */
    get engine() {
      return this._engine;
    }
    /**
     * Initializes a PostProcessRenderPipeline
     * @param _engine engine to add the pipeline to
     * @param name name of the pipeline
     */
    constructor(_engine, name) {
      this._engine = _engine;
      this._name = __runInitializers(this, __name_initializers, void 0);
      this.uniqueId = (__runInitializers(this, __name_extraInitializers), UniqueIdGenerator.UniqueId);
      RegisterPostProcessRenderPipelineManagerSceneComponent(PostProcessRenderPipelineManager);
      this._name = name;
      this._renderEffects = {};
      this._renderEffectsForIsolatedPass = new Array();
      this._cameras = [];
    }
    /**
     * Gets the class name
     * @returns "PostProcessRenderPipeline"
     */
    getClassName() {
      return "PostProcessRenderPipeline";
    }
    /**
     * If all the render effects in the pipeline are supported
     */
    get isSupported() {
      for (const renderEffectName in this._renderEffects) {
        if (Object.prototype.hasOwnProperty.call(this._renderEffects, renderEffectName)) {
          if (!this._renderEffects[renderEffectName].isSupported) {
            return false;
          }
        }
      }
      return true;
    }
    /**
     * Adds an effect to the pipeline
     * @param renderEffect the effect to add
     */
    addEffect(renderEffect) {
      this._renderEffects[renderEffect._name] = renderEffect;
    }
    // private
    /** @internal */
    _rebuild() {
    }
    /**
     * @internal
     */
    _enableEffect(renderEffectName, cameras) {
      const renderEffects = this._renderEffects[renderEffectName];
      if (!renderEffects) {
        return;
      }
      renderEffects._enable(Tools.MakeArray(cameras || this._cameras));
    }
    /**
     * @internal
     */
    _disableEffect(renderEffectName, cameras) {
      const renderEffects = this._renderEffects[renderEffectName];
      if (!renderEffects) {
        return;
      }
      renderEffects._disable(Tools.MakeArray(cameras || this._cameras));
    }
    /**
     * @internal
     */
    _attachCameras(cameras, unique) {
      const cams = Tools.MakeArray(cameras || this._cameras);
      if (!cams) {
        return;
      }
      const indicesToDelete = [];
      let i;
      for (i = 0; i < cams.length; i++) {
        const camera = cams[i];
        if (!camera) {
          continue;
        }
        if (this._cameras.indexOf(camera) === -1) {
          this._cameras.push(camera);
        } else if (unique) {
          indicesToDelete.push(i);
        }
      }
      for (i = 0; i < indicesToDelete.length; i++) {
        cams.splice(indicesToDelete[i], 1);
      }
      for (const renderEffectName in this._renderEffects) {
        if (Object.prototype.hasOwnProperty.call(this._renderEffects, renderEffectName)) {
          this._renderEffects[renderEffectName]._attachCameras(cams);
        }
      }
    }
    /**
     * @internal
     */
    _detachCameras(cameras) {
      const cams = Tools.MakeArray(cameras || this._cameras);
      if (!cams) {
        return;
      }
      for (const renderEffectName in this._renderEffects) {
        if (Object.prototype.hasOwnProperty.call(this._renderEffects, renderEffectName)) {
          this._renderEffects[renderEffectName]._detachCameras(cams);
        }
      }
      for (let i = 0; i < cams.length; i++) {
        this._cameras.splice(this._cameras.indexOf(cams[i]), 1);
      }
    }
    /** @internal */
    _update() {
      for (const renderEffectName in this._renderEffects) {
        if (Object.prototype.hasOwnProperty.call(this._renderEffects, renderEffectName)) {
          this._renderEffects[renderEffectName]._update();
        }
      }
      for (let i = 0; i < this._cameras.length; i++) {
        if (!this._cameras[i]) {
          continue;
        }
        const cameraName = this._cameras[i].name;
        if (this._renderEffectsForIsolatedPass[cameraName]) {
          this._renderEffectsForIsolatedPass[cameraName]._update();
        }
      }
    }
    /** @internal */
    _reset() {
      this._renderEffects = {};
      this._renderEffectsForIsolatedPass = new Array();
    }
    _enableMSAAOnFirstPostProcess(sampleCount) {
      if (!this._engine._features.supportMSAA) {
        return false;
      }
      const effectKeys = Object.keys(this._renderEffects);
      if (effectKeys.length > 0) {
        const postProcesses = this._renderEffects[effectKeys[0]].getPostProcesses();
        if (postProcesses) {
          postProcesses[0].samples = sampleCount;
        }
      }
      return true;
    }
    /**
     * Ensures that all post processes in the pipeline are the correct size according to the
     * the viewport's required size
     */
    _adaptPostProcessesToViewPort() {
      const effectKeys = Object.keys(this._renderEffects);
      for (const effectKey of effectKeys) {
        const postProcesses = this._renderEffects[effectKey].getPostProcesses();
        if (postProcesses) {
          for (const postProcess of postProcesses) {
            postProcess.adaptScaleToCurrentViewport = true;
          }
        }
      }
    }
    /**
     * Sets the required values to the prepass renderer.
     * @param prePassRenderer defines the prepass renderer to setup.
     * @returns true if the pre pass is needed.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setPrePassRenderer(prePassRenderer) {
      return false;
    }
    /**
     * Disposes of the pipeline
     */
    dispose() {
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? /* @__PURE__ */ Object.create(null) : void 0;
    __name_decorators = [serialize()];
    __esDecorate(null, null, __name_decorators, { kind: "field", name: "_name", static: false, private: false, access: { has: (obj) => "_name" in obj, get: (obj) => obj._name, set: (obj, value) => {
      obj._name = value;
    } }, metadata: _metadata }, __name_initializers, __name_extraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
class PostProcessRenderEffect {
  /**
   * Instantiates a post process render effect.
   * A post process can be used to apply a shader to a texture after it is rendered.
   * @param engine The engine the effect is tied to
   * @param name The name of the effect
   * @param getPostProcesses A function that returns a set of post processes which the effect will run in order to be run.
   * @param singleInstance False if this post process can be run on multiple cameras. (default: true)
   */
  constructor(engine, name, getPostProcesses, singleInstance = true) {
    this._name = name;
    this._singleInstance = singleInstance;
    this._getPostProcesses = getPostProcesses;
    this._cameras = {};
    this._indicesForCamera = {};
    this._postProcesses = {};
  }
  /**
   * Checks if all the post processes in the effect are supported.
   */
  get isSupported() {
    for (const index in this._postProcesses) {
      if (Object.prototype.hasOwnProperty.call(this._postProcesses, index)) {
        const pps = this._postProcesses[index];
        for (let ppIndex = 0; ppIndex < pps.length; ppIndex++) {
          if (!pps[ppIndex].isSupported) {
            return false;
          }
        }
      }
    }
    return true;
  }
  /**
   * Updates the current state of the effect
   * @internal
   */
  _update() {
  }
  /**
   * Attaches the effect on cameras
   * @param cameras The camera to attach to.
   * @internal
   */
  _attachCameras(cameras) {
    let cameraKey;
    const cams = Tools.MakeArray(cameras || this._cameras);
    if (!cams) {
      return;
    }
    for (let i = 0; i < cams.length; i++) {
      const camera = cams[i];
      if (!camera) {
        continue;
      }
      const cameraName = camera.name;
      if (this._singleInstance) {
        cameraKey = 0;
      } else {
        cameraKey = cameraName;
      }
      if (!this._postProcesses[cameraKey]) {
        const postProcess = this._getPostProcesses();
        if (postProcess) {
          this._postProcesses[cameraKey] = Array.isArray(postProcess) ? postProcess : [postProcess];
        }
      }
      if (!this._indicesForCamera[cameraName]) {
        this._indicesForCamera[cameraName] = [];
      }
      const pps = this._postProcesses[cameraKey];
      for (const postProcess of pps) {
        const index = camera.attachPostProcess(postProcess);
        this._indicesForCamera[cameraName].push(index);
      }
      if (!this._cameras[cameraName]) {
        this._cameras[cameraName] = camera;
      }
    }
  }
  /**
   * Detaches the effect on cameras
   * @param cameras The camera to detach from.
   * @internal
   */
  _detachCameras(cameras) {
    const cams = Tools.MakeArray(cameras || this._cameras);
    if (!cams) {
      return;
    }
    for (let i = 0; i < cams.length; i++) {
      const camera = cams[i];
      const cameraName = camera.name;
      const postProcesses = this._postProcesses[this._singleInstance ? 0 : cameraName];
      if (postProcesses) {
        for (const postProcess of postProcesses) {
          camera.detachPostProcess(postProcess);
        }
      }
      if (this._cameras[cameraName]) {
        this._cameras[cameraName] = null;
      }
      delete this._indicesForCamera[cameraName];
    }
  }
  /**
   * Enables the effect on given cameras
   * @param cameras The camera to enable.
   * @internal
   */
  _enable(cameras) {
    const cams = Tools.MakeArray(cameras || this._cameras);
    if (!cams) {
      return;
    }
    for (let i = 0; i < cams.length; i++) {
      const camera = cams[i];
      const cameraName = camera.name;
      const cameraKey = this._singleInstance ? 0 : cameraName;
      for (let j = 0; j < this._indicesForCamera[cameraName].length; j++) {
        const index = this._indicesForCamera[cameraName][j];
        const postProcess = camera._postProcesses[index];
        if (postProcess === void 0 || postProcess === null) {
          cams[i].attachPostProcess(this._postProcesses[cameraKey][j], index);
        }
      }
    }
  }
  /**
   * Disables the effect on the given cameras
   * @param cameras The camera to disable.
   * @internal
   */
  _disable(cameras) {
    const cams = Tools.MakeArray(cameras || this._cameras);
    if (!cams) {
      return;
    }
    for (let i = 0; i < cams.length; i++) {
      const camera = cams[i];
      const cameraName = camera.name;
      const pps = this._postProcesses[this._singleInstance ? 0 : cameraName];
      for (const postProcess of pps) {
        camera.detachPostProcess(postProcess);
      }
    }
  }
  /**
   * Gets a list of the post processes contained in the effect.
   * @param camera The camera to get the post processes on.
   * @returns The list of the post processes in the effect.
   */
  getPostProcesses(camera) {
    if (this._singleInstance) {
      return this._postProcesses[0];
    } else {
      if (!camera) {
        return null;
      }
      return this._postProcesses[camera.name];
    }
  }
}
class ThinCircleOfConfusionPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bx), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.by), true ? [] : void 0, import.meta.url));
    }
  }
  /**
   * Constructs a new circle of confusion post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinCircleOfConfusionPostProcess.FragmentUrl,
      uniforms: ThinCircleOfConfusionPostProcess.Uniforms,
      samplers: ThinCircleOfConfusionPostProcess.Samplers,
      defines: options?.depthNotNormalized ? ThinCircleOfConfusionPostProcess.DefinesDepthNotNormalized : void 0
    });
    this.lensSize = 50;
    this.fStop = 1.4;
    this.focusDistance = 2e3;
    this.focalLength = 50;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const options = this.options;
    const effect = this._drawWrapper.effect;
    if (!options.depthNotNormalized) {
      effect.setFloat2("cameraMinMaxZ", this.camera.minZ, this.camera.maxZ - this.camera.minZ);
    }
    const aperture = this.lensSize / this.fStop;
    const cocPrecalculation = aperture * this.focalLength / (this.focusDistance - this.focalLength);
    effect.setFloat("focusDistance", this.focusDistance);
    effect.setFloat("cocPrecalculation", cocPrecalculation);
  }
}
ThinCircleOfConfusionPostProcess.FragmentUrl = "circleOfConfusion";
ThinCircleOfConfusionPostProcess.Uniforms = ["cameraMinMaxZ", "focusDistance", "cocPrecalculation"];
ThinCircleOfConfusionPostProcess.Samplers = ["depthSampler"];
ThinCircleOfConfusionPostProcess.DefinesDepthNotNormalized = "#define COC_DEPTH_NOT_NORMALIZED";
let CircleOfConfusionPostProcess = (() => {
  var _a;
  let _classSuper = PostProcess;
  let _instanceExtraInitializers = [];
  let _get_lensSize_decorators;
  let _get_fStop_decorators;
  let _get_focusDistance_decorators;
  let _get_focalLength_decorators;
  return _a = class CircleOfConfusionPostProcess extends _classSuper {
    /**
     * Max lens size in scene units/1000 (eg. millimeter). Standard cameras are 50mm. (default: 50) The diameter of the resulting aperture can be computed by lensSize/fStop.
     */
    get lensSize() {
      return this._effectWrapper.lensSize;
    }
    set lensSize(value) {
      this._effectWrapper.lensSize = value;
    }
    /**
     * F-Stop of the effect's camera. The diameter of the resulting aperture can be computed by lensSize/fStop. (default: 1.4)
     */
    get fStop() {
      return this._effectWrapper.fStop;
    }
    set fStop(value) {
      this._effectWrapper.fStop = value;
    }
    /**
     * Distance away from the camera to focus on in scene units/1000 (eg. millimeter). (default: 2000)
     */
    get focusDistance() {
      return this._effectWrapper.focusDistance;
    }
    set focusDistance(value) {
      this._effectWrapper.focusDistance = value;
    }
    /**
     * Focal length of the effect's camera in scene units/1000 (eg. millimeter). (default: 50)
     */
    get focalLength() {
      return this._effectWrapper.focalLength;
    }
    set focalLength(value) {
      this._effectWrapper.focalLength = value;
    }
    /**
     * Gets a string identifying the name of the class
     * @returns "CircleOfConfusionPostProcess" string
     */
    getClassName() {
      return "CircleOfConfusionPostProcess";
    }
    /**
     * Creates a new instance CircleOfConfusionPostProcess
     * @param name The name of the effect.
     * @param depthTexture The depth texture of the scene to compute the circle of confusion. This must be set in order for this to function but may be set after initialization if needed.
     * @param options The required width/height ratio to downsize to before computing the render pass.
     * @param camera The camera to apply the render pass to.
     * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
     * @param engine The engine which the post process will be applied. (default: current engine)
     * @param reusable If the post process can be reused on the same frame. (default: false)
     * @param textureType Type of textures used when performing the post process. (default: 0)
     * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
     */
    constructor(name, depthTexture, options, camera, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
      const localOptions = {
        uniforms: ThinCircleOfConfusionPostProcess.Uniforms,
        samplers: ThinCircleOfConfusionPostProcess.Samplers,
        defines: typeof options === "object" && options.depthNotNormalized ? ThinCircleOfConfusionPostProcess.DefinesDepthNotNormalized : void 0,
        size: typeof options === "number" ? options : void 0,
        camera,
        samplingMode,
        engine,
        reusable,
        textureType,
        blockCompilation,
        ...options
      };
      super(name, ThinCircleOfConfusionPostProcess.FragmentUrl, {
        effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinCircleOfConfusionPostProcess(name, engine, localOptions) : void 0,
        ...localOptions
      });
      this._depthTexture = (__runInitializers(this, _instanceExtraInitializers), null);
      this._depthTexture = depthTexture;
      this.onApplyObservable.add((effect) => {
        if (!this._depthTexture) {
          Logger.Warn("No depth texture set on CircleOfConfusionPostProcess");
          return;
        }
        effect.setTexture("depthSampler", this._depthTexture);
        this._effectWrapper.camera = this._depthTexture.activeCamera;
      });
    }
    /**
     * Depth texture to be used to compute the circle of confusion. This must be set here or in the constructor in order for the post process to function.
     */
    set depthTexture(value) {
      this._depthTexture = value;
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_lensSize_decorators = [serialize()];
    _get_fStop_decorators = [serialize()];
    _get_focusDistance_decorators = [serialize()];
    _get_focalLength_decorators = [serialize()];
    __esDecorate(_a, null, _get_lensSize_decorators, { kind: "getter", name: "lensSize", static: false, private: false, access: { has: (obj) => "lensSize" in obj, get: (obj) => obj.lensSize }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_fStop_decorators, { kind: "getter", name: "fStop", static: false, private: false, access: { has: (obj) => "fStop" in obj, get: (obj) => obj.fStop }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_focusDistance_decorators, { kind: "getter", name: "focusDistance", static: false, private: false, access: { has: (obj) => "focusDistance" in obj, get: (obj) => obj.focusDistance }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_focalLength_decorators, { kind: "getter", name: "focalLength", static: false, private: false, access: { has: (obj) => "focalLength" in obj, get: (obj) => obj.focalLength }, metadata: _metadata }, null, _instanceExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
class ThinDepthOfFieldBlurPostProcess extends ThinBlurPostProcess {
  constructor(name, engine = null, direction, kernel, options) {
    super(name, engine, direction, kernel, {
      ...options,
      defines: `#define DOF 1
`
    });
  }
}
class DepthOfFieldBlurPostProcess extends BlurPostProcess {
  /**
   * Gets a string identifying the name of the class
   * @returns "DepthOfFieldBlurPostProcess" string
   */
  getClassName() {
    return "DepthOfFieldBlurPostProcess";
  }
  /**
   * Creates a new instance DepthOfFieldBlurPostProcess
   * @param name The name of the effect.
   * @param _scene The scene the effect belongs to (not used, you can pass null)
   * @param direction The direction the blur should be applied.
   * @param kernel The size of the kernel used to blur.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param circleOfConfusion The circle of confusion + depth map to be used to avoid blurring across edges
   * @param imageToBlur The image to apply the blur to (default: Current rendered frame)
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType Type of textures used when performing the post process. (default: 0)
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   * @param textureFormat Format of textures used when performing the post process. (default: TEXTUREFORMAT_RGBA)
   */
  constructor(name, _scene, direction, kernel, options, camera, circleOfConfusion, imageToBlur = null, samplingMode = Texture.BILINEAR_SAMPLINGMODE, engine, reusable, textureType = 0, blockCompilation = false, textureFormat = 5) {
    const localOptions = {
      size: typeof options === "number" ? options : void 0,
      camera,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      samplingMode: samplingMode = 2,
      engine,
      reusable,
      textureType,
      defines: `#define DOF 1
`,
      blockCompilation,
      textureFormat,
      ...options
    };
    super(name, direction, kernel, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinDepthOfFieldBlurPostProcess(name, engine, direction, kernel, localOptions) : void 0,
      ...localOptions
    });
    this.externalTextureSamplerBinding = !!imageToBlur;
    this.onApplyObservable.add((effect) => {
      if (imageToBlur != null) {
        effect.setTextureFromPostProcess("textureSampler", imageToBlur);
      }
      effect.setTextureFromPostProcessOutput("circleOfConfusionSampler", circleOfConfusion);
    });
  }
}
class ThinDepthOfFieldMergePostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bz), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bA), true ? [] : void 0, import.meta.url));
    }
  }
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinDepthOfFieldMergePostProcess.FragmentUrl,
      samplers: ThinDepthOfFieldMergePostProcess.Samplers
    });
  }
}
ThinDepthOfFieldMergePostProcess.FragmentUrl = "depthOfFieldMerge";
ThinDepthOfFieldMergePostProcess.Samplers = ["circleOfConfusionSampler", "blurStep0", "blurStep1", "blurStep2"];
class DepthOfFieldMergePostProcess extends PostProcess {
  /**
   * Gets a string identifying the name of the class
   * @returns "DepthOfFieldMergePostProcess" string
   */
  getClassName() {
    return "DepthOfFieldMergePostProcess";
  }
  /**
   * Creates a new instance of DepthOfFieldMergePostProcess
   * @param name The name of the effect.
   * @param originalFromInput Post process which's input will be used for the merge.
   * @param circleOfConfusion Circle of confusion post process which's output will be used to blur each pixel.
   * @param _blurSteps Blur post processes from low to high which will be mixed with the original image.
   * @param options The required width/height ratio to downsize to before computing the render pass.
   * @param camera The camera to apply the render pass to.
   * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
   * @param engine The engine which the post process will be applied. (default: current engine)
   * @param reusable If the post process can be reused on the same frame. (default: false)
   * @param textureType Type of textures used when performing the post process. (default: 0)
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(name, originalFromInput, circleOfConfusion, _blurSteps, options, camera, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
    const blockCompilationFinal = typeof options === "number" ? blockCompilation : !!options.blockCompilation;
    const localOptions = {
      samplers: ThinDepthOfFieldMergePostProcess.Samplers,
      size: typeof options === "number" ? options : void 0,
      camera,
      samplingMode,
      engine,
      reusable,
      textureType,
      ...options,
      blockCompilation: true
    };
    super(name, ThinDepthOfFieldMergePostProcess.FragmentUrl, {
      effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinDepthOfFieldMergePostProcess(name, engine, localOptions) : void 0,
      ...localOptions
    });
    this._blurSteps = _blurSteps;
    this.externalTextureSamplerBinding = true;
    this.onApplyObservable.add((effect) => {
      effect.setTextureFromPostProcess("textureSampler", originalFromInput);
      effect.setTextureFromPostProcessOutput("circleOfConfusionSampler", circleOfConfusion);
      for (let i = 0; i < _blurSteps.length; i++) {
        const step = _blurSteps[i];
        effect.setTextureFromPostProcessOutput("blurStep" + (_blurSteps.length - i - 1), step);
      }
    });
    if (!blockCompilationFinal) {
      this.updateEffect();
    }
  }
  /**
   * Updates the effect with the current post process compile time values and recompiles the shader.
   * @param defines Define statements that should be added at the beginning of the shader. (default: null)
   * @param uniforms Set of uniform variables that will be passed to the shader. (default: null)
   * @param samplers Set of Texture2D variables that will be passed to the shader. (default: null)
   * @param indexParameters The index parameters to be used for babylons include syntax "#include<kernelBlurVaryingDeclaration>[0..varyingCount]". (default: undefined) See usage in babylon.blurPostProcess.ts and kernelBlur.vertex.fx
   * @param onCompiled Called when the shader has been compiled.
   * @param onError Called if there is an error when compiling a shader.
   */
  updateEffect(defines = null, uniforms = null, samplers = null, indexParameters, onCompiled, onError) {
    if (!defines) {
      defines = "";
      defines += "#define BLUR_LEVEL " + (this._blurSteps.length - 1) + "\n";
    }
    super.updateEffect(defines, uniforms, samplers, indexParameters, onCompiled, onError);
  }
}
var ThinDepthOfFieldEffectBlurLevel;
(function(ThinDepthOfFieldEffectBlurLevel2) {
  ThinDepthOfFieldEffectBlurLevel2[ThinDepthOfFieldEffectBlurLevel2["Low"] = 0] = "Low";
  ThinDepthOfFieldEffectBlurLevel2[ThinDepthOfFieldEffectBlurLevel2["Medium"] = 1] = "Medium";
  ThinDepthOfFieldEffectBlurLevel2[ThinDepthOfFieldEffectBlurLevel2["High"] = 2] = "High";
})(ThinDepthOfFieldEffectBlurLevel || (ThinDepthOfFieldEffectBlurLevel = {}));
class ThinDepthOfFieldEffect {
  /**
   * The focal the length of the camera used in the effect in scene units/1000 (eg. millimeter)
   */
  set focalLength(value) {
    this._circleOfConfusion.focalLength = value;
  }
  get focalLength() {
    return this._circleOfConfusion.focalLength;
  }
  /**
   * F-Stop of the effect's camera. The diameter of the resulting aperture can be computed by lensSize/fStop. (default: 1.4)
   */
  set fStop(value) {
    this._circleOfConfusion.fStop = value;
  }
  get fStop() {
    return this._circleOfConfusion.fStop;
  }
  /**
   * Distance away from the camera to focus on in scene units/1000 (eg. millimeter). (default: 2000)
   */
  set focusDistance(value) {
    this._circleOfConfusion.focusDistance = value;
  }
  get focusDistance() {
    return this._circleOfConfusion.focusDistance;
  }
  /**
   * Max lens size in scene units/1000 (eg. millimeter). Standard cameras are 50mm. (default: 50) The diameter of the resulting aperture can be computed by lensSize/fStop.
   */
  set lensSize(value) {
    this._circleOfConfusion.lensSize = value;
  }
  get lensSize() {
    return this._circleOfConfusion.lensSize;
  }
  /**
   * Creates a new instance of @see ThinDepthOfFieldEffect
   * @param name The name of the depth of field render effect
   * @param engine The engine which the render effect will be applied. (default: current engine)
   * @param blurLevel The quality of the effect. (default: DepthOfFieldEffectBlurLevel.Low)
   * @param depthNotNormalized If the (view) depth used in circle of confusion post-process is normalized (0.0 to 1.0 from near to far) or not (0 to camera max distance) (default: false)
   * @param blockCompilation If shaders should not be compiled when the effect is created (default: false)
   */
  constructor(name, engine, blurLevel = 0, depthNotNormalized = false, blockCompilation = false) {
    this._depthOfFieldBlurX = [];
    this._depthOfFieldBlurY = [];
    this._circleOfConfusion = new ThinCircleOfConfusionPostProcess(name, engine, { depthNotNormalized, blockCompilation });
    this.blurLevel = blurLevel;
    let blurCount;
    let kernelSize;
    switch (blurLevel) {
      case 2: {
        blurCount = 3;
        kernelSize = 51;
        break;
      }
      case 1: {
        blurCount = 2;
        kernelSize = 31;
        break;
      }
      default: {
        kernelSize = 15;
        blurCount = 1;
        break;
      }
    }
    const adjustedKernelSize = kernelSize / Math.pow(2, blurCount - 1);
    let ratio = 1;
    for (let i = 0; i < blurCount; i++) {
      this._depthOfFieldBlurY.push([new ThinDepthOfFieldBlurPostProcess(name, engine, new Vector2(0, 1), adjustedKernelSize, { blockCompilation }), ratio]);
      ratio = 0.75 / Math.pow(2, i);
      this._depthOfFieldBlurX.push([new ThinDepthOfFieldBlurPostProcess(name, engine, new Vector2(1, 0), adjustedKernelSize, { blockCompilation }), ratio]);
    }
    this._dofMerge = new ThinDepthOfFieldMergePostProcess(name, engine, { blockCompilation });
  }
  /**
   * Checks if the effect is ready to be used
   * @returns if the effect is ready
   */
  isReady() {
    let isReady = this._circleOfConfusion.isReady() && this._dofMerge.isReady();
    for (let i = 0; i < this._depthOfFieldBlurX.length; i++) {
      isReady = isReady && this._depthOfFieldBlurX[i][0].isReady() && this._depthOfFieldBlurY[i][0].isReady();
    }
    return isReady;
  }
}
var DepthOfFieldEffectBlurLevel;
(function(DepthOfFieldEffectBlurLevel2) {
  DepthOfFieldEffectBlurLevel2[DepthOfFieldEffectBlurLevel2["Low"] = 0] = "Low";
  DepthOfFieldEffectBlurLevel2[DepthOfFieldEffectBlurLevel2["Medium"] = 1] = "Medium";
  DepthOfFieldEffectBlurLevel2[DepthOfFieldEffectBlurLevel2["High"] = 2] = "High";
})(DepthOfFieldEffectBlurLevel || (DepthOfFieldEffectBlurLevel = {}));
class DepthOfFieldEffect extends PostProcessRenderEffect {
  /**
   * The focal the length of the camera used in the effect in scene units/1000 (eg. millimeter)
   */
  set focalLength(value) {
    this._thinDepthOfFieldEffect.focalLength = value;
  }
  get focalLength() {
    return this._thinDepthOfFieldEffect.focalLength;
  }
  /**
   * F-Stop of the effect's camera. The diameter of the resulting aperture can be computed by lensSize/fStop. (default: 1.4)
   */
  set fStop(value) {
    this._thinDepthOfFieldEffect.fStop = value;
  }
  get fStop() {
    return this._thinDepthOfFieldEffect.fStop;
  }
  /**
   * Distance away from the camera to focus on in scene units/1000 (eg. millimeter). (default: 2000)
   */
  set focusDistance(value) {
    this._thinDepthOfFieldEffect.focusDistance = value;
  }
  get focusDistance() {
    return this._thinDepthOfFieldEffect.focusDistance;
  }
  /**
   * Max lens size in scene units/1000 (eg. millimeter). Standard cameras are 50mm. (default: 50) The diameter of the resulting aperture can be computed by lensSize/fStop.
   */
  set lensSize(value) {
    this._thinDepthOfFieldEffect.lensSize = value;
  }
  get lensSize() {
    return this._thinDepthOfFieldEffect.lensSize;
  }
  /**
   * Creates a new instance DepthOfFieldEffect
   * @param sceneOrEngine The scene or engine the effect belongs to.
   * @param depthTexture The depth texture of the scene to compute the circle of confusion.This must be set in order for this to function but may be set after initialization if needed.
   * @param blurLevel
   * @param pipelineTextureType The type of texture to be used when performing the post processing.
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   * @param depthNotNormalized If the depth from the depth texture is already normalized or if the normalization should be done at runtime in the shader (default: false)
   */
  constructor(sceneOrEngine, depthTexture, blurLevel = 0, pipelineTextureType = 0, blockCompilation = false, depthNotNormalized = false) {
    const engine = sceneOrEngine._renderForCamera ? sceneOrEngine.getEngine() : sceneOrEngine;
    super(engine, "depth of field", () => {
      return this._effects;
    }, true);
    this._effects = [];
    this._thinDepthOfFieldEffect = new ThinDepthOfFieldEffect("Depth of Field", engine, blurLevel, false, blockCompilation);
    const circleOfConfusionTextureFormat = engine.isWebGPU || engine.version > 1 ? 6 : 5;
    this._circleOfConfusion = new CircleOfConfusionPostProcess("circleOfConfusion", depthTexture, {
      size: 1,
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      depthNotNormalized,
      effectWrapper: this._thinDepthOfFieldEffect._circleOfConfusion
    }, null);
    this._depthOfFieldBlurY = [];
    this._depthOfFieldBlurX = [];
    const blurCount = this._thinDepthOfFieldEffect._depthOfFieldBlurX.length;
    for (let i = 0; i < blurCount; i++) {
      const [thinBlurY, ratioY] = this._thinDepthOfFieldEffect._depthOfFieldBlurY[i];
      const blurY = new DepthOfFieldBlurPostProcess("vertical blur", null, thinBlurY.direction, thinBlurY.kernel, {
        size: ratioY,
        samplingMode: Texture.BILINEAR_SAMPLINGMODE,
        engine,
        textureType: pipelineTextureType,
        blockCompilation,
        textureFormat: i == 0 ? circleOfConfusionTextureFormat : 5,
        effectWrapper: thinBlurY
      }, null, this._circleOfConfusion, i == 0 ? this._circleOfConfusion : null);
      blurY.autoClear = false;
      const [thinBlurX, ratioX] = this._thinDepthOfFieldEffect._depthOfFieldBlurX[i];
      const blurX = new DepthOfFieldBlurPostProcess("horizontal blur", null, thinBlurX.direction, thinBlurX.kernel, {
        size: ratioX,
        samplingMode: Texture.BILINEAR_SAMPLINGMODE,
        engine,
        textureType: pipelineTextureType,
        blockCompilation,
        effectWrapper: thinBlurX
      }, null, this._circleOfConfusion, null);
      blurX.autoClear = false;
      this._depthOfFieldBlurY.push(blurY);
      this._depthOfFieldBlurX.push(blurX);
    }
    this._effects = [this._circleOfConfusion];
    for (let i = 0; i < this._depthOfFieldBlurX.length; i++) {
      this._effects.push(this._depthOfFieldBlurY[i]);
      this._effects.push(this._depthOfFieldBlurX[i]);
    }
    this._dofMerge = new DepthOfFieldMergePostProcess("dofMerge", this._circleOfConfusion, this._circleOfConfusion, this._depthOfFieldBlurX, {
      size: this._thinDepthOfFieldEffect._depthOfFieldBlurX[blurCount - 1][1],
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      effectWrapper: this._thinDepthOfFieldEffect._dofMerge
    }, null);
    this._dofMerge.autoClear = false;
    this._effects.push(this._dofMerge);
  }
  /**
   * Get the current class name of the current effect
   * @returns "DepthOfFieldEffect"
   */
  getClassName() {
    return "DepthOfFieldEffect";
  }
  /**
   * Depth texture to be used to compute the circle of confusion. This must be set here or in the constructor in order for the post process to function.
   */
  set depthTexture(value) {
    this._circleOfConfusion.depthTexture = value;
  }
  /**
   * Disposes each of the internal effects for a given camera.
   * @param camera The camera to dispose the effect on.
   */
  disposeEffects(camera) {
    for (let effectIndex = 0; effectIndex < this._effects.length; effectIndex++) {
      this._effects[effectIndex].dispose(camera);
    }
  }
  /**
   * @internal Internal
   */
  _updateEffects() {
    for (let effectIndex = 0; effectIndex < this._effects.length; effectIndex++) {
      this._effects[effectIndex].updateEffect();
    }
  }
  /**
   * Internal
   * @returns if all the contained post processes are ready.
   * @internal
   */
  _isReady() {
    return this._thinDepthOfFieldEffect.isReady();
  }
}
class ThinExtractHighlightsPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bB), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bC), true ? [] : void 0, import.meta.url));
    }
  }
  /**
   * Constructs a new extract highlights post process
   * @param name Name of the effect
   * @param engine Engine to use to render the effect. If not provided, the last created engine will be used
   * @param options Options to configure the effect
   */
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinExtractHighlightsPostProcess.FragmentUrl,
      uniforms: ThinExtractHighlightsPostProcess.Uniforms
    });
    this.threshold = 0.9;
    this._exposure = 1;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const effect = this._drawWrapper.effect;
    effect.setFloat("threshold", Math.pow(this.threshold, ToGammaSpace));
    effect.setFloat("exposure", this._exposure);
  }
}
ThinExtractHighlightsPostProcess.FragmentUrl = "extractHighlights";
ThinExtractHighlightsPostProcess.Uniforms = ["threshold", "exposure"];
let ExtractHighlightsPostProcess = (() => {
  var _a;
  let _classSuper = PostProcess;
  let _instanceExtraInitializers = [];
  let _get_threshold_decorators;
  return _a = class ExtractHighlightsPostProcess extends _classSuper {
    /**
     * The luminance threshold, pixels below this value will be set to black.
     */
    get threshold() {
      return this._effectWrapper.threshold;
    }
    set threshold(value) {
      this._effectWrapper.threshold = value;
    }
    /** @internal */
    get _exposure() {
      return this._effectWrapper._exposure;
    }
    /** @internal */
    set _exposure(value) {
      this._effectWrapper._exposure = value;
    }
    /**
     * Gets a string identifying the name of the class
     * @returns "ExtractHighlightsPostProcess" string
     */
    getClassName() {
      return "ExtractHighlightsPostProcess";
    }
    constructor(name, options, camera = null, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
      const localOptions = {
        uniforms: ThinExtractHighlightsPostProcess.Uniforms,
        size: typeof options === "number" ? options : void 0,
        camera,
        samplingMode,
        engine,
        reusable,
        textureType,
        blockCompilation,
        ...options
      };
      super(name, ThinExtractHighlightsPostProcess.FragmentUrl, {
        effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinExtractHighlightsPostProcess(name, engine, localOptions) : void 0,
        ...localOptions
      });
      this._inputPostProcess = (__runInitializers(this, _instanceExtraInitializers), null);
      this.onApplyObservable.add((effect) => {
        this.externalTextureSamplerBinding = !!this._inputPostProcess;
        if (this._inputPostProcess) {
          effect.setTextureFromPostProcess("textureSampler", this._inputPostProcess);
        }
      });
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_threshold_decorators = [serialize()];
    __esDecorate(_a, null, _get_threshold_decorators, { kind: "getter", name: "threshold", static: false, private: false, access: { has: (obj) => "threshold" in obj, get: (obj) => obj.threshold }, metadata: _metadata }, null, _instanceExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
class ThinBloomMergePostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bD), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bE), true ? [] : void 0, import.meta.url));
    }
  }
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinBloomMergePostProcess.FragmentUrl,
      uniforms: ThinBloomMergePostProcess.Uniforms,
      samplers: ThinBloomMergePostProcess.Samplers
    });
    this.weight = 1;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    this._drawWrapper.effect.setFloat("bloomWeight", this.weight);
  }
}
ThinBloomMergePostProcess.FragmentUrl = "bloomMerge";
ThinBloomMergePostProcess.Uniforms = ["bloomWeight"];
ThinBloomMergePostProcess.Samplers = ["bloomBlur"];
let BloomMergePostProcess = (() => {
  var _a;
  let _classSuper = PostProcess;
  let _instanceExtraInitializers = [];
  let _get_weight_decorators;
  return _a = class BloomMergePostProcess extends _classSuper {
    /** Weight of the bloom to be added to the original input. */
    get weight() {
      return this._effectWrapper.weight;
    }
    set weight(value) {
      this._effectWrapper.weight = value;
    }
    /**
     * Gets a string identifying the name of the class
     * @returns "BloomMergePostProcess" string
     */
    getClassName() {
      return "BloomMergePostProcess";
    }
    /**
     * Creates a new instance of @see BloomMergePostProcess
     * @param name The name of the effect.
     * @param originalFromInput Post process which's input will be used for the merge.
     * @param blurred Blurred highlights post process which's output will be used.
     * @param weight Weight of the bloom to be added to the original input.
     * @param options The required width/height ratio to downsize to before computing the render pass.
     * @param camera The camera to apply the render pass to.
     * @param samplingMode The sampling mode to be used when computing the pass. (default: 0)
     * @param engine The engine which the post process will be applied. (default: current engine)
     * @param reusable If the post process can be reused on the same frame. (default: false)
     * @param textureType Type of textures used when performing the post process. (default: 0)
     * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
     */
    constructor(name, originalFromInput, blurred, weight, options, camera = null, samplingMode, engine, reusable, textureType = 0, blockCompilation = false) {
      const blockCompilationFinal = typeof options === "number" ? blockCompilation : !!options.blockCompilation;
      const localOptions = {
        uniforms: ThinBloomMergePostProcess.Uniforms,
        samplers: ThinBloomMergePostProcess.Samplers,
        size: typeof options === "number" ? options : void 0,
        camera,
        samplingMode,
        engine,
        reusable,
        textureType,
        ...options,
        blockCompilation: true
      };
      super(name, ThinBloomMergePostProcess.FragmentUrl, {
        effectWrapper: typeof options === "number" || !options.effectWrapper ? new ThinBloomMergePostProcess(name, engine, localOptions) : void 0,
        ...localOptions
      });
      __runInitializers(this, _instanceExtraInitializers);
      this.weight = weight;
      this.externalTextureSamplerBinding = true;
      this.onApplyObservable.add((effect) => {
        effect.setTextureFromPostProcess("textureSampler", originalFromInput);
        effect.setTextureFromPostProcessOutput("bloomBlur", blurred);
      });
      if (!blockCompilationFinal) {
        this.updateEffect();
      }
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_weight_decorators = [serialize()];
    __esDecorate(_a, null, _get_weight_decorators, { kind: "getter", name: "weight", static: false, private: false, access: { has: (obj) => "weight" in obj, get: (obj) => obj.weight }, metadata: _metadata }, null, _instanceExtraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
class ThinBloomEffect {
  /**
   * The luminance threshold to find bright areas of the image to bloom.
   */
  get threshold() {
    return this._downscale.threshold;
  }
  set threshold(value) {
    this._downscale.threshold = value;
  }
  /**
   * The strength of the bloom.
   */
  get weight() {
    return this._merge.weight;
  }
  set weight(value) {
    this._merge.weight = value;
  }
  /**
   * Specifies the size of the bloom blur kernel, relative to the final output size
   */
  get kernel() {
    return this._blurX.kernel / this.scale;
  }
  set kernel(value) {
    this._blurX.kernel = value * this.scale;
    this._blurY.kernel = value * this.scale;
  }
  /**
   * Creates a new instance of @see ThinBloomEffect
   * @param name The name of the bloom render effect
   * @param engine The engine which the render effect will be applied. (default: current engine)
   * @param scale The ratio of the blur texture to the input texture that should be used to compute the bloom.
   * @param blockCompilation If shaders should not be compiled when the effect is created (default: false)
   */
  constructor(name, engine, scale, blockCompilation = false) {
    this.scale = scale;
    this._downscale = new ThinExtractHighlightsPostProcess(name + "_downscale", engine, { blockCompilation });
    this._blurX = new ThinBlurPostProcess(name + "_blurX", engine, new Vector2(1, 0), 10, { blockCompilation });
    this._blurY = new ThinBlurPostProcess(name + "_blurY", engine, new Vector2(0, 1), 10, { blockCompilation });
    this._merge = new ThinBloomMergePostProcess(name + "_merge", engine, { blockCompilation });
  }
  /**
   * Checks if the effect is ready to be used
   * @returns if the effect is ready
   */
  isReady() {
    return this._downscale.isReady() && this._blurX.isReady() && this._blurY.isReady() && this._merge.isReady();
  }
}
class BloomEffect extends PostProcessRenderEffect {
  /**
   * The luminance threshold to find bright areas of the image to bloom.
   */
  get threshold() {
    return this._thinBloomEffect.threshold;
  }
  set threshold(value) {
    this._thinBloomEffect.threshold = value;
  }
  /**
   * The strength of the bloom.
   */
  get weight() {
    return this._thinBloomEffect.weight;
  }
  set weight(value) {
    this._thinBloomEffect.weight = value;
  }
  /**
   * Specifies the size of the bloom blur kernel, relative to the final output size
   */
  get kernel() {
    return this._thinBloomEffect.kernel;
  }
  set kernel(value) {
    this._thinBloomEffect.kernel = value;
  }
  get bloomScale() {
    return this._thinBloomEffect.scale;
  }
  /**
   * Creates a new instance of @see BloomEffect
   * @param sceneOrEngine The scene or engine the effect belongs to.
   * @param bloomScale The ratio of the blur texture to the input texture that should be used to compute the bloom.
   * @param bloomWeight The strength of bloom.
   * @param bloomKernel The size of the kernel to be used when applying the blur.
   * @param pipelineTextureType The type of texture to be used when performing the post processing.
   * @param blockCompilation If compilation of the shader should not be done in the constructor. The updateEffect method can be used to compile the shader at a later time. (default: false)
   */
  constructor(sceneOrEngine, bloomScale, bloomWeight, bloomKernel, pipelineTextureType = 0, blockCompilation = false) {
    const engine = sceneOrEngine._renderForCamera ? sceneOrEngine.getEngine() : sceneOrEngine;
    super(engine, "bloom", () => {
      return this._effects;
    }, true);
    this._effects = [];
    this._thinBloomEffect = new ThinBloomEffect("bloom", engine, bloomScale, blockCompilation);
    this._downscale = new ExtractHighlightsPostProcess("highlights", {
      size: 1,
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      effectWrapper: this._thinBloomEffect._downscale
    });
    this._blurX = new BlurPostProcess("horizontal blur", this._thinBloomEffect._blurX.direction, this._thinBloomEffect._blurX.kernel, {
      size: bloomScale,
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      effectWrapper: this._thinBloomEffect._blurX
    });
    this._blurX.alwaysForcePOT = true;
    this._blurX.autoClear = false;
    this._blurY = new BlurPostProcess("vertical blur", this._thinBloomEffect._blurY.direction, this._thinBloomEffect._blurY.kernel, {
      size: bloomScale,
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      effectWrapper: this._thinBloomEffect._blurY
    });
    this._blurY.alwaysForcePOT = true;
    this._blurY.autoClear = false;
    this.kernel = bloomKernel;
    this._effects = [this._downscale, this._blurX, this._blurY];
    this._merge = new BloomMergePostProcess("bloomMerge", this._downscale, this._blurY, bloomWeight, {
      size: bloomScale,
      samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      engine,
      textureType: pipelineTextureType,
      blockCompilation,
      effectWrapper: this._thinBloomEffect._merge
    });
    this._merge.autoClear = false;
    this._effects.push(this._merge);
  }
  /**
   * Disposes each of the internal effects for a given camera.
   * @param camera The camera to dispose the effect on.
   */
  disposeEffects(camera) {
    for (let effectIndex = 0; effectIndex < this._effects.length; effectIndex++) {
      this._effects[effectIndex].dispose(camera);
    }
  }
  /**
   * @internal Internal
   */
  _updateEffects() {
    for (let effectIndex = 0; effectIndex < this._effects.length; effectIndex++) {
      this._effects[effectIndex].updateEffect();
    }
  }
  /**
   * Internal
   * @returns if all the contained post processes are ready.
   * @internal
   */
  _isReady() {
    return this._thinBloomEffect.isReady();
  }
}
let DefaultRenderingPipeline = (() => {
  var _a;
  let _classSuper = PostProcessRenderPipeline;
  let _instanceExtraInitializers = [];
  let _get_sharpenEnabled_decorators;
  let _get_bloomKernel_decorators;
  let __bloomWeight_decorators;
  let __bloomWeight_initializers = [];
  let __bloomWeight_extraInitializers = [];
  let __bloomThreshold_decorators;
  let __bloomThreshold_initializers = [];
  let __bloomThreshold_extraInitializers = [];
  let __hdr_decorators;
  let __hdr_initializers = [];
  let __hdr_extraInitializers = [];
  let _get_bloomWeight_decorators;
  let _get_bloomThreshold_decorators;
  let _get_bloomScale_decorators;
  let _get_bloomEnabled_decorators;
  let _get_depthOfFieldEnabled_decorators;
  let _get_depthOfFieldBlurLevel_decorators;
  let _get_fxaaEnabled_decorators;
  let _get_samples_decorators;
  let _get_imageProcessingEnabled_decorators;
  let _get_glowLayerEnabled_decorators;
  let _get_chromaticAberrationEnabled_decorators;
  let _get_grainEnabled_decorators;
  return _a = class DefaultRenderingPipeline extends _classSuper {
    /**
     * Enable or disable automatic building of the pipeline when effects are enabled and disabled.
     * If false, you will have to manually call prepare() to update the pipeline.
     */
    get automaticBuild() {
      return this._buildAllowed;
    }
    set automaticBuild(value) {
      this._buildAllowed = value;
    }
    /**
     * Gets active scene
     */
    get scene() {
      return this._scene;
    }
    /**
     * Enable or disable the sharpen process from the pipeline
     */
    set sharpenEnabled(enabled) {
      if (this._sharpenEnabled === enabled) {
        return;
      }
      this._sharpenEnabled = enabled;
      this._buildPipeline();
    }
    get sharpenEnabled() {
      return this._sharpenEnabled;
    }
    /**
     * Specifies the size of the bloom blur kernel, relative to the final output size
     */
    get bloomKernel() {
      return this._bloomKernel;
    }
    set bloomKernel(value) {
      this._bloomKernel = value;
      this.bloom.kernel = value / this._hardwareScaleLevel;
    }
    /**
     * The strength of the bloom.
     */
    set bloomWeight(value) {
      if (this._bloomWeight === value) {
        return;
      }
      this.bloom.weight = value;
      this._bloomWeight = value;
    }
    get bloomWeight() {
      return this._bloomWeight;
    }
    /**
     * The luminance threshold to find bright areas of the image to bloom.
     */
    set bloomThreshold(value) {
      if (this._bloomThreshold === value) {
        return;
      }
      this.bloom.threshold = value;
      this._bloomThreshold = value;
    }
    get bloomThreshold() {
      return this._bloomThreshold;
    }
    /**
     * The scale of the bloom, lower value will provide better performance.
     */
    set bloomScale(value) {
      if (this._bloomScale === value) {
        return;
      }
      this._bloomScale = value;
      this._rebuildBloom();
      this._buildPipeline();
    }
    get bloomScale() {
      return this._bloomScale;
    }
    /**
     * Enable or disable the bloom from the pipeline
     */
    set bloomEnabled(enabled) {
      if (this._bloomEnabled === enabled) {
        return;
      }
      this._bloomEnabled = enabled;
      this._buildPipeline();
    }
    get bloomEnabled() {
      return this._bloomEnabled;
    }
    _rebuildBloom() {
      const oldBloom = this.bloom;
      this.bloom = new BloomEffect(this._scene, this.bloomScale, this._bloomWeight, this.bloomKernel / this._hardwareScaleLevel, this._defaultPipelineTextureType, false);
      this.bloom.threshold = oldBloom.threshold;
      for (let i = 0; i < this._cameras.length; i++) {
        oldBloom.disposeEffects(this._cameras[i]);
      }
    }
    /**
     * If the depth of field is enabled.
     */
    get depthOfFieldEnabled() {
      return this._depthOfFieldEnabled;
    }
    set depthOfFieldEnabled(enabled) {
      if (this._depthOfFieldEnabled === enabled) {
        return;
      }
      this._depthOfFieldEnabled = enabled;
      this._buildPipeline();
    }
    /**
     * Blur level of the depth of field effect. (Higher blur will effect performance)
     */
    get depthOfFieldBlurLevel() {
      return this._depthOfFieldBlurLevel;
    }
    set depthOfFieldBlurLevel(value) {
      if (this._depthOfFieldBlurLevel === value) {
        return;
      }
      this._depthOfFieldBlurLevel = value;
      const oldDof = this.depthOfField;
      this.depthOfField = new DepthOfFieldEffect(this._scene, null, this._depthOfFieldBlurLevel, this._defaultPipelineTextureType, false);
      this.depthOfField.focalLength = oldDof.focalLength;
      this.depthOfField.focusDistance = oldDof.focusDistance;
      this.depthOfField.fStop = oldDof.fStop;
      this.depthOfField.lensSize = oldDof.lensSize;
      for (let i = 0; i < this._cameras.length; i++) {
        oldDof.disposeEffects(this._cameras[i]);
      }
      this._buildPipeline();
    }
    /**
     * If the anti aliasing is enabled.
     */
    set fxaaEnabled(enabled) {
      if (this._fxaaEnabled === enabled) {
        return;
      }
      this._fxaaEnabled = enabled;
      this._buildPipeline();
    }
    get fxaaEnabled() {
      return this._fxaaEnabled;
    }
    /**
     * MSAA sample count, setting this to 4 will provide 4x anti aliasing. (default: 1)
     */
    set samples(sampleCount) {
      if (this._samples === sampleCount) {
        return;
      }
      this._samples = sampleCount;
      this._buildPipeline();
    }
    get samples() {
      return this._samples;
    }
    /**
     * If image processing is enabled.
     */
    set imageProcessingEnabled(enabled) {
      if (this._imageProcessingEnabled === enabled) {
        return;
      }
      this._scene.imageProcessingConfiguration.isEnabled = enabled;
    }
    get imageProcessingEnabled() {
      return this._imageProcessingEnabled;
    }
    /**
     * If glow layer is enabled. (Adds a glow effect to emmissive materials)
     */
    set glowLayerEnabled(enabled) {
      if (enabled && !this._glowLayer) {
        this._glowLayer = new GlowLayer("", this._scene);
      } else if (!enabled && this._glowLayer) {
        this._glowLayer.dispose();
        this._glowLayer = null;
      }
    }
    get glowLayerEnabled() {
      return this._glowLayer != null;
    }
    /**
     * Gets the glow layer (or null if not defined)
     */
    get glowLayer() {
      return this._glowLayer;
    }
    /**
     * Enable or disable the chromaticAberration process from the pipeline
     */
    set chromaticAberrationEnabled(enabled) {
      if (this._chromaticAberrationEnabled === enabled) {
        return;
      }
      this._chromaticAberrationEnabled = enabled;
      this._buildPipeline();
    }
    get chromaticAberrationEnabled() {
      return this._chromaticAberrationEnabled;
    }
    /**
     * Enable or disable the grain process from the pipeline
     */
    set grainEnabled(enabled) {
      if (this._grainEnabled === enabled) {
        return;
      }
      this._grainEnabled = enabled;
      this._buildPipeline();
    }
    get grainEnabled() {
      return this._grainEnabled;
    }
    /**
     * Instantiates a DefaultRenderingPipeline.
     * @param name The rendering pipeline name (default: "")
     * @param hdr If high dynamic range textures should be used (default: true)
     * @param scene The scene linked to this pipeline (default: the last created scene)
     * @param cameras The array of cameras that the rendering pipeline will be attached to (default: scene.cameras)
     * @param automaticBuild If false, you will have to manually call prepare() to update the pipeline (default: true)
     */
    constructor(name = "", hdr = true, scene = EngineStore.LastCreatedScene, cameras, automaticBuild = true) {
      RegisterDepthRendererSceneComponent(DepthRenderer);
      super(scene.getEngine(), name);
      this._scene = __runInitializers(this, _instanceExtraInitializers);
      this._camerasToBeAttached = [];
      this.SharpenPostProcessId = "SharpenPostProcessEffect";
      this.ImageProcessingPostProcessId = "ImageProcessingPostProcessEffect";
      this.FxaaPostProcessId = "FxaaPostProcessEffect";
      this.ChromaticAberrationPostProcessId = "ChromaticAberrationPostProcessEffect";
      this.GrainPostProcessId = "GrainPostProcessEffect";
      this._glowLayer = null;
      this.animations = [];
      this._imageProcessingConfigurationObserver = null;
      this._sharpenEnabled = false;
      this._bloomEnabled = false;
      this._depthOfFieldEnabled = false;
      this._depthOfFieldBlurLevel = 0;
      this._fxaaEnabled = false;
      this._imageProcessingEnabled = true;
      this._bloomScale = 0.5;
      this._chromaticAberrationEnabled = false;
      this._grainEnabled = false;
      this._buildAllowed = true;
      this.onBuildObservable = new Observable();
      this._resizeObserver = null;
      this._hardwareScaleLevel = 1;
      this._bloomKernel = 64;
      this._bloomWeight = __runInitializers(this, __bloomWeight_initializers, 0.15);
      this._bloomThreshold = (__runInitializers(this, __bloomWeight_extraInitializers), __runInitializers(this, __bloomThreshold_initializers, 0.9));
      this._hdr = (__runInitializers(this, __bloomThreshold_extraInitializers), __runInitializers(this, __hdr_initializers, void 0));
      this._samples = (__runInitializers(this, __hdr_extraInitializers), 1);
      this._hasCleared = false;
      this._prevPostProcess = null;
      this._prevPrevPostProcess = null;
      this._depthOfFieldSceneObserver = null;
      this._activeCameraChangedObserver = null;
      this._activeCamerasChangedObserver = null;
      this._cameras = cameras || scene.cameras;
      this._cameras = this._cameras.slice();
      this._camerasToBeAttached = this._cameras.slice();
      this._buildAllowed = automaticBuild;
      this._scene = scene;
      const caps = this._scene.getEngine().getCaps();
      this._hdr = hdr && (caps.textureHalfFloatRender || caps.textureFloatRender);
      if (this._hdr) {
        if (caps.textureHalfFloatRender) {
          this._defaultPipelineTextureType = 2;
        } else if (caps.textureFloatRender) {
          this._defaultPipelineTextureType = 1;
        }
      } else {
        this._defaultPipelineTextureType = 0;
      }
      scene.postProcessRenderPipelineManager.addPipeline(this);
      const engine = this._scene.getEngine();
      this.sharpen = new SharpenPostProcess("sharpen", 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._defaultPipelineTextureType, true);
      this._sharpenEffect = new PostProcessRenderEffect(engine, this.SharpenPostProcessId, () => {
        return this.sharpen;
      }, true);
      this.depthOfField = new DepthOfFieldEffect(this._scene, null, this._depthOfFieldBlurLevel, this._defaultPipelineTextureType, true);
      this._hardwareScaleLevel = engine.getHardwareScalingLevel();
      this._resizeObserver = engine.onResizeObservable.add(() => {
        this._hardwareScaleLevel = engine.getHardwareScalingLevel();
        this.bloomKernel = this._bloomKernel;
      });
      this.bloom = new BloomEffect(this._scene, this._bloomScale, this._bloomWeight, this.bloomKernel / this._hardwareScaleLevel, this._defaultPipelineTextureType, true);
      this.chromaticAberration = new ChromaticAberrationPostProcess("ChromaticAberration", engine.getRenderWidth(), engine.getRenderHeight(), 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._defaultPipelineTextureType, true);
      this._chromaticAberrationEffect = new PostProcessRenderEffect(engine, this.ChromaticAberrationPostProcessId, () => {
        return this.chromaticAberration;
      }, true);
      this.grain = new GrainPostProcess("Grain", 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._defaultPipelineTextureType, true);
      this._grainEffect = new PostProcessRenderEffect(engine, this.GrainPostProcessId, () => {
        return this.grain;
      }, true);
      let avoidReentrancyAtConstructionTime = true;
      this._imageProcessingConfigurationObserver = this._scene.imageProcessingConfiguration.onUpdateParameters.add(() => {
        this.bloom._downscale._exposure = this._scene.imageProcessingConfiguration.exposure;
        if (this.imageProcessingEnabled !== this._scene.imageProcessingConfiguration.isEnabled) {
          this._imageProcessingEnabled = this._scene.imageProcessingConfiguration.isEnabled;
          if (avoidReentrancyAtConstructionTime) {
            TimingTools.SetImmediate(() => {
              this._buildPipeline();
            });
          } else {
            this._buildPipeline();
          }
        }
      });
      this._buildPipeline();
      avoidReentrancyAtConstructionTime = false;
    }
    /**
     * Get the class name
     * @returns "DefaultRenderingPipeline"
     */
    getClassName() {
      return "DefaultRenderingPipeline";
    }
    /**
     * Force the compilation of the entire pipeline.
     */
    prepare() {
      const previousState = this._buildAllowed;
      this._buildAllowed = true;
      this._buildPipeline();
      this._buildAllowed = previousState;
    }
    _setAutoClearAndTextureSharing(postProcess, skipTextureSharing = false) {
      if (this._hasCleared) {
        postProcess.autoClear = false;
      } else {
        postProcess.autoClear = true;
        this._scene.autoClear = false;
        this._hasCleared = true;
      }
      if (!skipTextureSharing) {
        if (this._prevPrevPostProcess) {
          postProcess.shareOutputWith(this._prevPrevPostProcess);
        } else {
          postProcess.useOwnOutput();
        }
        if (this._prevPostProcess) {
          this._prevPrevPostProcess = this._prevPostProcess;
        }
        this._prevPostProcess = postProcess;
      }
    }
    _buildPipeline() {
      if (!this._buildAllowed) {
        return;
      }
      this._scene.autoClear = true;
      const engine = this._scene.getEngine();
      this._disposePostProcesses();
      if (this._cameras !== null) {
        this._scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(this._name, this._cameras);
        this._cameras = this._camerasToBeAttached.slice();
      }
      this._reset();
      this._prevPostProcess = null;
      this._prevPrevPostProcess = null;
      this._hasCleared = false;
      if (this.depthOfFieldEnabled) {
        if (this._cameras.length > 1) {
          for (const camera of this._cameras) {
            const depthRenderer = this._scene.enableDepthRenderer(camera);
            depthRenderer.useOnlyInActiveCamera = true;
          }
          this._depthOfFieldSceneObserver = this._scene.onAfterRenderTargetsRenderObservable.add((scene) => {
            if (this._cameras.indexOf(scene.activeCamera) > -1) {
              this.depthOfField.depthTexture = scene.enableDepthRenderer(scene.activeCamera).getDepthMap();
            }
          });
        } else {
          this._scene.onAfterRenderTargetsRenderObservable.remove(this._depthOfFieldSceneObserver);
          const depthRenderer = this._scene.enableDepthRenderer(this._cameras[0]);
          this.depthOfField.depthTexture = depthRenderer.getDepthMap();
        }
        if (!this.depthOfField._isReady()) {
          this.depthOfField._updateEffects();
        }
        this.addEffect(this.depthOfField);
        this._setAutoClearAndTextureSharing(this.depthOfField._effects[0], true);
      } else {
        this._scene.onAfterRenderTargetsRenderObservable.remove(this._depthOfFieldSceneObserver);
      }
      if (this.bloomEnabled) {
        if (!this.bloom._isReady()) {
          this.bloom._updateEffects();
        }
        this.addEffect(this.bloom);
        this._setAutoClearAndTextureSharing(this.bloom._effects[0], true);
      }
      if (this._imageProcessingEnabled) {
        this.imageProcessing = new ImageProcessingPostProcess("imageProcessing", 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._defaultPipelineTextureType, this.scene.imageProcessingConfiguration);
        if (this._hdr) {
          this.addEffect(new PostProcessRenderEffect(engine, this.ImageProcessingPostProcessId, () => {
            return this.imageProcessing;
          }, true));
          this._setAutoClearAndTextureSharing(this.imageProcessing);
        } else {
          this._scene.imageProcessingConfiguration.applyByPostProcess = false;
        }
        if (!this._cameras || this._cameras.length === 0) {
          this._scene.imageProcessingConfiguration.applyByPostProcess = false;
        }
        if (!this.imageProcessing.getEffect()) {
          this.imageProcessing._updateParameters();
        }
      }
      if (this.sharpenEnabled) {
        if (!this.sharpen.isReady()) {
          this.sharpen.updateEffect();
        }
        this.addEffect(this._sharpenEffect);
        this._setAutoClearAndTextureSharing(this.sharpen);
      }
      if (this.grainEnabled) {
        if (!this.grain.isReady()) {
          this.grain.updateEffect();
        }
        this.addEffect(this._grainEffect);
        this._setAutoClearAndTextureSharing(this.grain);
      }
      if (this.chromaticAberrationEnabled) {
        if (!this.chromaticAberration.isReady()) {
          this.chromaticAberration.updateEffect();
        }
        this.addEffect(this._chromaticAberrationEffect);
        this._setAutoClearAndTextureSharing(this.chromaticAberration);
      }
      if (this.fxaaEnabled) {
        this.fxaa = new FxaaPostProcess("fxaa", 1, null, Texture.BILINEAR_SAMPLINGMODE, engine, false, this._defaultPipelineTextureType);
        this.addEffect(new PostProcessRenderEffect(engine, this.FxaaPostProcessId, () => {
          return this.fxaa;
        }, true));
        this._setAutoClearAndTextureSharing(this.fxaa, true);
      }
      if (this._cameras !== null) {
        this._scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(this._name, this._cameras);
      }
      if (this._scene.activeCameras && this._scene.activeCameras.length > 1 || this._scene.activeCamera && this._cameras.indexOf(this._scene.activeCamera) === -1) {
        this._scene.autoClear = true;
      }
      if (!this._activeCameraChangedObserver) {
        this._activeCameraChangedObserver = this._scene.onActiveCameraChanged.add(() => {
          if (this._scene.activeCamera && this._cameras.indexOf(this._scene.activeCamera) === -1) {
            this._scene.autoClear = true;
          }
        });
      }
      if (!this._activeCamerasChangedObserver) {
        this._activeCamerasChangedObserver = this._scene.onActiveCamerasChanged.add(() => {
          if (this._scene.activeCameras && this._scene.activeCameras.length > 1) {
            this._scene.autoClear = true;
          }
        });
      }
      this._adaptPostProcessesToViewPort();
      if (!this._enableMSAAOnFirstPostProcess(this.samples) && this.samples > 1) {
        Logger.Warn("MSAA failed to enable, MSAA is only supported in browsers that support webGL >= 2.0");
      }
      this.onBuildObservable.notifyObservers(this);
    }
    _disposePostProcesses(disposeNonRecreated = false) {
      for (let i = 0; i < this._cameras.length; i++) {
        const camera = this._cameras[i];
        if (this.imageProcessing) {
          this.imageProcessing.dispose(camera);
        }
        if (this.fxaa) {
          this.fxaa.dispose(camera);
        }
        if (disposeNonRecreated) {
          if (this.sharpen) {
            this.sharpen.dispose(camera);
          }
          if (this.depthOfField) {
            this._scene.onAfterRenderTargetsRenderObservable.remove(this._depthOfFieldSceneObserver);
            this.depthOfField.disposeEffects(camera);
          }
          if (this.bloom) {
            this.bloom.disposeEffects(camera);
          }
          if (this.chromaticAberration) {
            this.chromaticAberration.dispose(camera);
          }
          if (this.grain) {
            this.grain.dispose(camera);
          }
          if (this._glowLayer) {
            this._glowLayer.dispose();
          }
        }
      }
      this.imageProcessing = null;
      this.fxaa = null;
      if (disposeNonRecreated) {
        this.sharpen = null;
        this._sharpenEffect = null;
        this.depthOfField = null;
        this.bloom = null;
        this.chromaticAberration = null;
        this._chromaticAberrationEffect = null;
        this.grain = null;
        this._grainEffect = null;
        this._glowLayer = null;
      }
    }
    /**
     * Adds a camera to the pipeline
     * @param camera the camera to be added
     */
    addCamera(camera) {
      this._camerasToBeAttached.push(camera);
      this._buildPipeline();
    }
    /**
     * Removes a camera from the pipeline
     * @param camera the camera to remove
     */
    removeCamera(camera) {
      const index = this._camerasToBeAttached.indexOf(camera);
      this._camerasToBeAttached.splice(index, 1);
      this._buildPipeline();
    }
    /**
     * Dispose of the pipeline and stop all post processes
     */
    dispose() {
      this._buildAllowed = false;
      this.onBuildObservable.clear();
      this._disposePostProcesses(true);
      this._scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(this._name, this._cameras);
      this._scene._postProcessRenderPipelineManager.removePipeline(this.name);
      this._scene.autoClear = true;
      if (this._resizeObserver) {
        this._scene.getEngine().onResizeObservable.remove(this._resizeObserver);
        this._resizeObserver = null;
      }
      this._scene.onActiveCameraChanged.remove(this._activeCameraChangedObserver);
      this._scene.onActiveCamerasChanged.remove(this._activeCamerasChangedObserver);
      this._scene.imageProcessingConfiguration.onUpdateParameters.remove(this._imageProcessingConfigurationObserver);
      super.dispose();
    }
    /**
     * Serialize the rendering pipeline (Used when exporting)
     * @returns the serialized object
     */
    serialize() {
      const serializationObject = SerializationHelper.Serialize(this);
      serializationObject.customType = "DefaultRenderingPipeline";
      return serializationObject;
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_sharpenEnabled_decorators = [serialize()];
    _get_bloomKernel_decorators = [serialize()];
    __bloomWeight_decorators = [serialize()];
    __bloomThreshold_decorators = [serialize()];
    __hdr_decorators = [serialize()];
    _get_bloomWeight_decorators = [serialize()];
    _get_bloomThreshold_decorators = [serialize()];
    _get_bloomScale_decorators = [serialize()];
    _get_bloomEnabled_decorators = [serialize()];
    _get_depthOfFieldEnabled_decorators = [serialize()];
    _get_depthOfFieldBlurLevel_decorators = [serialize()];
    _get_fxaaEnabled_decorators = [serialize()];
    _get_samples_decorators = [serialize()];
    _get_imageProcessingEnabled_decorators = [serialize()];
    _get_glowLayerEnabled_decorators = [serialize()];
    _get_chromaticAberrationEnabled_decorators = [serialize()];
    _get_grainEnabled_decorators = [serialize()];
    __esDecorate(_a, null, _get_sharpenEnabled_decorators, { kind: "getter", name: "sharpenEnabled", static: false, private: false, access: { has: (obj) => "sharpenEnabled" in obj, get: (obj) => obj.sharpenEnabled }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_bloomKernel_decorators, { kind: "getter", name: "bloomKernel", static: false, private: false, access: { has: (obj) => "bloomKernel" in obj, get: (obj) => obj.bloomKernel }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_bloomWeight_decorators, { kind: "getter", name: "bloomWeight", static: false, private: false, access: { has: (obj) => "bloomWeight" in obj, get: (obj) => obj.bloomWeight }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_bloomThreshold_decorators, { kind: "getter", name: "bloomThreshold", static: false, private: false, access: { has: (obj) => "bloomThreshold" in obj, get: (obj) => obj.bloomThreshold }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_bloomScale_decorators, { kind: "getter", name: "bloomScale", static: false, private: false, access: { has: (obj) => "bloomScale" in obj, get: (obj) => obj.bloomScale }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_bloomEnabled_decorators, { kind: "getter", name: "bloomEnabled", static: false, private: false, access: { has: (obj) => "bloomEnabled" in obj, get: (obj) => obj.bloomEnabled }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_depthOfFieldEnabled_decorators, { kind: "getter", name: "depthOfFieldEnabled", static: false, private: false, access: { has: (obj) => "depthOfFieldEnabled" in obj, get: (obj) => obj.depthOfFieldEnabled }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_depthOfFieldBlurLevel_decorators, { kind: "getter", name: "depthOfFieldBlurLevel", static: false, private: false, access: { has: (obj) => "depthOfFieldBlurLevel" in obj, get: (obj) => obj.depthOfFieldBlurLevel }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_fxaaEnabled_decorators, { kind: "getter", name: "fxaaEnabled", static: false, private: false, access: { has: (obj) => "fxaaEnabled" in obj, get: (obj) => obj.fxaaEnabled }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_samples_decorators, { kind: "getter", name: "samples", static: false, private: false, access: { has: (obj) => "samples" in obj, get: (obj) => obj.samples }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_imageProcessingEnabled_decorators, { kind: "getter", name: "imageProcessingEnabled", static: false, private: false, access: { has: (obj) => "imageProcessingEnabled" in obj, get: (obj) => obj.imageProcessingEnabled }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_glowLayerEnabled_decorators, { kind: "getter", name: "glowLayerEnabled", static: false, private: false, access: { has: (obj) => "glowLayerEnabled" in obj, get: (obj) => obj.glowLayerEnabled }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_chromaticAberrationEnabled_decorators, { kind: "getter", name: "chromaticAberrationEnabled", static: false, private: false, access: { has: (obj) => "chromaticAberrationEnabled" in obj, get: (obj) => obj.chromaticAberrationEnabled }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_grainEnabled_decorators, { kind: "getter", name: "grainEnabled", static: false, private: false, access: { has: (obj) => "grainEnabled" in obj, get: (obj) => obj.grainEnabled }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(null, null, __bloomWeight_decorators, { kind: "field", name: "_bloomWeight", static: false, private: false, access: { has: (obj) => "_bloomWeight" in obj, get: (obj) => obj._bloomWeight, set: (obj, value) => {
      obj._bloomWeight = value;
    } }, metadata: _metadata }, __bloomWeight_initializers, __bloomWeight_extraInitializers);
    __esDecorate(null, null, __bloomThreshold_decorators, { kind: "field", name: "_bloomThreshold", static: false, private: false, access: { has: (obj) => "_bloomThreshold" in obj, get: (obj) => obj._bloomThreshold, set: (obj, value) => {
      obj._bloomThreshold = value;
    } }, metadata: _metadata }, __bloomThreshold_initializers, __bloomThreshold_extraInitializers);
    __esDecorate(null, null, __hdr_decorators, { kind: "field", name: "_hdr", static: false, private: false, access: { has: (obj) => "_hdr" in obj, get: (obj) => obj._hdr, set: (obj, value) => {
      obj._hdr = value;
    } }, metadata: _metadata }, __hdr_initializers, __hdr_extraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
let _Registered$1 = false;
function DefaultRenderingPipelineParse(source, scene, rootUrl) {
  return SerializationHelper.Parse(() => new DefaultRenderingPipeline(source._name, source._name._hdr, scene), source, scene, rootUrl);
}
function RegisterDefaultRenderingPipeline() {
  if (_Registered$1) {
    return;
  }
  _Registered$1 = true;
  DefaultRenderingPipeline.Parse = DefaultRenderingPipelineParse;
  RegisterClass("BABYLON.DefaultRenderingPipeline", DefaultRenderingPipeline);
}
RegisterDefaultRenderingPipeline();
class ThinSSAO2PostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bF), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bG), true ? [] : void 0, import.meta.url));
    }
  }
  get textureWidth() {
    return this._textureWidth;
  }
  set textureWidth(width) {
    if (this._textureWidth === width) {
      return;
    }
    this._textureWidth = width;
  }
  get textureHeight() {
    return this._textureHeight;
  }
  set textureHeight(height) {
    if (this._textureHeight === height) {
      return;
    }
    this._textureHeight = height;
  }
  set samples(n) {
    this._samples = n;
    this.updateEffect();
    this._sampleSphere = this._generateHemisphere();
  }
  get samples() {
    return this._samples;
  }
  set normalsInWorldSpace(value) {
    if (this._normalsInWorldSpace === value) {
      return;
    }
    this._normalsInWorldSpace = value;
    this.updateEffect();
  }
  get normalsInWorldSpace() {
    return this._normalsInWorldSpace;
  }
  set epsilon(n) {
    this._epsilon = n;
    this.updateEffect();
  }
  get epsilon() {
    return this._epsilon;
  }
  updateEffect() {
    super.updateEffect(this._getDefinesForSSAO());
  }
  constructor(name, scene, options) {
    super({
      ...options,
      name,
      engine: scene.getEngine(),
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinSSAO2PostProcess.FragmentUrl,
      uniforms: ThinSSAO2PostProcess.Uniforms,
      samplers: ThinSSAO2PostProcess.Samplers,
      defines: `#define SSAO
#define SAMPLES 8
#define EPSILON 0.0001`,
      shaderLanguage: scene.getEngine().isWebGPU ? 1 : 0
    });
    this.camera = null;
    this._textureWidth = 0;
    this._textureHeight = 0;
    this._samples = 8;
    this.totalStrength = 1;
    this.radius = 2;
    this.maxZ = 100;
    this.minZAspect = 0.2;
    this.base = 0;
    this._epsilon = 0.02;
    this._normalsInWorldSpace = false;
    this._normalWorldToViewMatrix = new Matrix();
    this._normalWorldToView = new Float32Array(9);
    this._bits = new Uint32Array(1);
    this._scene = scene;
    this._createRandomTexture();
    this.updateEffect();
    this._sampleSphere = this._generateHemisphere();
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const effect = this._drawWrapper.effect;
    const camera = this.camera;
    if (!camera) {
      return;
    }
    const projectionMatrix = camera.getProjectionMatrix();
    effect.setArray3("sampleSphere", this._sampleSphere);
    effect.setFloat("randTextureTiles", 32);
    effect.setFloat("samplesFactor", 1 / this.samples);
    effect.setFloat("totalStrength", this.totalStrength);
    effect.setFloat2("texelSize", 1 / this.textureWidth, 1 / this.textureHeight);
    effect.setFloat("radius", this.radius);
    effect.setFloat("maxZ", this.maxZ);
    effect.setFloat("minZAspect", this.minZAspect);
    effect.setFloat("base", this.base);
    effect.setFloat("near", camera.minZ);
    if (camera.mode === Camera.PERSPECTIVE_CAMERA) {
      effect.setMatrix3x3("depthProjection", ThinSSAO2PostProcess.PERSPECTIVE_DEPTH_PROJECTION);
      const viewportSize = Math.tan(camera.fov / 2);
      if (camera.fovMode === Camera.FOVMODE_VERTICAL_FIXED) {
        effect.setFloat("xViewport", viewportSize * this._scene.getEngine().getAspectRatio(camera, true));
        effect.setFloat("yViewport", viewportSize);
      } else {
        effect.setFloat("xViewport", viewportSize);
        effect.setFloat("yViewport", viewportSize / this._scene.getEngine().getAspectRatio(camera, true));
      }
    } else {
      const halfWidth = this._scene.getEngine().getRenderWidth() / 2;
      const halfHeight = this._scene.getEngine().getRenderHeight() / 2;
      const orthoLeft = camera.orthoLeft ?? -halfWidth;
      const orthoRight = camera.orthoRight ?? halfWidth;
      const orthoBottom = camera.orthoBottom ?? -halfHeight;
      const orthoTop = camera.orthoTop ?? halfHeight;
      effect.setMatrix3x3("depthProjection", ThinSSAO2PostProcess.ORTHO_DEPTH_PROJECTION);
      effect.setFloat4("viewport", orthoLeft, orthoRight, orthoBottom, orthoTop);
    }
    effect.setMatrix("projection", projectionMatrix);
    if (this._normalsInWorldSpace) {
      camera.getViewMatrix().toNormalMatrix(this._normalWorldToViewMatrix);
      const viewMatrix = this._normalWorldToViewMatrix.m;
      const normalWorldToView = this._normalWorldToView;
      normalWorldToView[0] = viewMatrix[0];
      normalWorldToView[1] = viewMatrix[1];
      normalWorldToView[2] = viewMatrix[2];
      normalWorldToView[3] = viewMatrix[4];
      normalWorldToView[4] = viewMatrix[5];
      normalWorldToView[5] = viewMatrix[6];
      normalWorldToView[6] = viewMatrix[8];
      normalWorldToView[7] = viewMatrix[9];
      normalWorldToView[8] = viewMatrix[10];
      effect.setMatrix3x3("normalWorldToView", normalWorldToView);
    }
    effect.setTexture("randomSampler", this._randomTexture);
  }
  dispose() {
    this._randomTexture.dispose();
    super.dispose();
  }
  _createRandomTexture() {
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    const randVector = Vector2.Zero();
    for (let index = 0; index < data.length; ) {
      randVector.set(RandomRange(0, 1), RandomRange(0, 1)).normalize().scaleInPlace(255);
      data[index++] = Math.floor(randVector.x);
      data[index++] = Math.floor(randVector.y);
      data[index++] = 0;
      data[index++] = 255;
    }
    const texture = RawTexture.CreateRGBATexture(data, size, size, this._scene, false, false, 2);
    texture.name = "SSAORandomTexture";
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    this._randomTexture = texture;
  }
  //Van der Corput radical inverse
  _radicalInverseVdC(i) {
    this._bits[0] = i;
    this._bits[0] = (this._bits[0] << 16 | this._bits[0] >> 16) >>> 0;
    this._bits[0] = (this._bits[0] & 1431655765) << 1 | (this._bits[0] & 2863311530) >>> 1 >>> 0;
    this._bits[0] = (this._bits[0] & 858993459) << 2 | (this._bits[0] & 3435973836) >>> 2 >>> 0;
    this._bits[0] = (this._bits[0] & 252645135) << 4 | (this._bits[0] & 4042322160) >>> 4 >>> 0;
    this._bits[0] = (this._bits[0] & 16711935) << 8 | (this._bits[0] & 4278255360) >>> 8 >>> 0;
    return this._bits[0] * 23283064365386963e-26;
  }
  _hammersley(i, n) {
    return [i / n, this._radicalInverseVdC(i)];
  }
  _hemisphereSampleUniform(u, v) {
    const phi = v * 2 * Math.PI;
    const cosTheta = 1 - u * 0.85;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    return new Vector3(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta);
  }
  _generateHemisphere() {
    const numSamples = this.samples;
    const result = [];
    let vector;
    let i = 0;
    while (i < numSamples) {
      if (numSamples < 16) {
        vector = this._hemisphereSampleUniform(Math.random(), Math.random());
      } else {
        const rand = this._hammersley(i, numSamples);
        vector = this._hemisphereSampleUniform(rand[0], rand[1]);
      }
      result.push(vector.x, vector.y, vector.z);
      i++;
    }
    return result;
  }
  _getDefinesForSSAO() {
    const epsilon = this._epsilon ?? 0.02;
    const samples = this._samples ?? 8;
    let defines = `#define SSAO
#define SAMPLES ${samples}
#define EPSILON ${epsilon.toFixed(4)}`;
    if (this.camera?.mode === Camera.ORTHOGRAPHIC_CAMERA) {
      defines += `
#define ORTHOGRAPHIC_CAMERA`;
    }
    if (this._normalsInWorldSpace) {
      defines += `
#define NORMAL_WORLDSPACE`;
    }
    return defines;
  }
}
ThinSSAO2PostProcess.ORTHO_DEPTH_PROJECTION = [1, 0, 0, 0, 1, 0, 0, 0, 1];
ThinSSAO2PostProcess.PERSPECTIVE_DEPTH_PROJECTION = [0, 0, 0, 0, 0, 0, 1, 1, 1];
ThinSSAO2PostProcess.FragmentUrl = "ssao2";
ThinSSAO2PostProcess.Uniforms = [
  "sampleSphere",
  "samplesFactor",
  "randTextureTiles",
  "totalStrength",
  "radius",
  "base",
  "range",
  "projection",
  "near",
  "texelSize",
  "xViewport",
  "yViewport",
  "viewport",
  "maxZ",
  "minZAspect",
  "depthProjection",
  "normalWorldToView"
];
ThinSSAO2PostProcess.Samplers = ["randomSampler", "depthSampler", "normalSampler"];
class ThinSSAO2BlurPostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bF), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bG), true ? [] : void 0, import.meta.url));
    }
  }
  constructor(name, engine = null, isHorizontal, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinSSAO2BlurPostProcess.FragmentUrl,
      uniforms: ThinSSAO2BlurPostProcess.Uniforms,
      samplers: ThinSSAO2BlurPostProcess.Samplers,
      defines: "#define BLUR\n" + (isHorizontal ? "#define BLUR_H\n" : "")
    });
    this._bypassBlur = false;
    this.textureSize = 0;
    this.bilateralSamples = 16;
    this.bilateralSoften = 0;
    this.bilateralTolerance = 0;
    this._expensiveBlur = true;
    this._isHorizontal = isHorizontal;
    const defines = this._getDefinesForBlur(this.expensiveBlur, this.bypassBlur);
    const samplers = this._getSamplersForBlur(this.bypassBlur);
    this.updateEffect(defines, null, samplers);
  }
  set bypassBlur(b) {
    const defines = this._getDefinesForBlur(this.expensiveBlur, b);
    const samplers = this._getSamplersForBlur(b);
    this.updateEffect(defines, null, samplers);
    this._bypassBlur = b;
  }
  get bypassBlur() {
    return this._bypassBlur;
  }
  set expensiveBlur(b) {
    const defines = this._getDefinesForBlur(b, this._bypassBlur);
    this.updateEffect(defines);
    this._expensiveBlur = b;
  }
  get expensiveBlur() {
    return this._expensiveBlur;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const effect = this._drawWrapper.effect;
    effect.setFloat("outSize", this.textureSize);
    effect.setInt("samples", this.bilateralSamples);
    effect.setFloat("soften", this.bilateralSoften);
    effect.setFloat("tolerance", this.bilateralTolerance);
  }
  _getSamplersForBlur(disabled) {
    return disabled ? ["textureSampler"] : ["textureSampler", "depthSampler"];
  }
  _getDefinesForBlur(bilateral, disabled) {
    let define = "#define BLUR\n";
    if (disabled) {
      define += "#define BLUR_BYPASS\n";
    }
    if (!bilateral) {
      define += "#define BLUR_LEGACY\n";
    }
    return this._isHorizontal ? define + "#define BLUR_H\n" : define;
  }
}
ThinSSAO2BlurPostProcess.FragmentUrl = "ssao2";
ThinSSAO2BlurPostProcess.Uniforms = ["outSize", "samples", "soften", "tolerance"];
ThinSSAO2BlurPostProcess.Samplers = ["textureSampler", "depthSampler"];
class ThinSSAO2CombinePostProcess extends EffectWrapper {
  _gatherImports(useWebGPU, list) {
    if (useWebGPU) {
      this._webGPUReady = true;
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bH), true ? [] : void 0, import.meta.url));
    } else {
      list.push(__vitePreload(() => import("./babylon-core-DhADYfIs.js").then((n) => n.bI), true ? [] : void 0, import.meta.url));
    }
  }
  constructor(name, engine = null, options) {
    super({
      ...options,
      name,
      engine: engine || EngineStore.LastCreatedEngine,
      useShaderStore: true,
      useAsPostProcess: true,
      fragmentShader: ThinSSAO2CombinePostProcess.FragmentUrl,
      uniforms: ThinSSAO2CombinePostProcess.Uniforms,
      samplers: ThinSSAO2CombinePostProcess.Samplers
    });
    this.camera = null;
    this.useViewportInCombineStage = true;
  }
  bind(noDefaultBindings = false) {
    super.bind(noDefaultBindings);
    const effect = this._drawWrapper.effect;
    if (this.camera) {
      const viewport = this.camera.viewport;
      if (this.useViewportInCombineStage) {
        effect.setVector4("viewport", TmpVectors.Vector4[0].copyFromFloats(viewport.x, viewport.y, viewport.width, viewport.height));
      } else {
        effect.setVector4("viewport", TmpVectors.Vector4[0].copyFromFloats(0, 0, 1, 1));
      }
    }
  }
}
ThinSSAO2CombinePostProcess.FragmentUrl = "ssaoCombine";
ThinSSAO2CombinePostProcess.Uniforms = ["viewport"];
ThinSSAO2CombinePostProcess.Samplers = ["originalColor"];
class ThinSSAO2RenderingPipeline {
  /**
   * The camera to which the rendering pipeline will be applied.
   */
  get camera() {
    return this._ssaoPostProcess.camera;
  }
  set camera(camera) {
    this._ssaoPostProcess.camera = camera;
    this._ssaoCombinePostProcess.camera = camera;
  }
  /**
   * Number of samples used for the SSAO calculations. Default value is 8.
   */
  set samples(n) {
    this._ssaoPostProcess.samples = n;
  }
  get samples() {
    return this._ssaoPostProcess.samples;
  }
  /**
   * The output strength of the SSAO post-process. Default value is 1.0.
   */
  get totalStrength() {
    return this._ssaoPostProcess.totalStrength;
  }
  set totalStrength(value) {
    this._ssaoPostProcess.totalStrength = value;
  }
  /**
   * The radius around the analyzed pixel used by the SSAO post-process. Default value is 2.0
   */
  get radius() {
    return this._ssaoPostProcess.radius;
  }
  set radius(value) {
    this._ssaoPostProcess.radius = value;
  }
  /**
   * Maximum depth value to still render AO. A smooth falloff makes the dimming more natural, so there will be no abrupt shading change.
   */
  get maxZ() {
    return this._ssaoPostProcess.maxZ;
  }
  set maxZ(value) {
    this._ssaoPostProcess.maxZ = value;
  }
  /**
   * In order to save performances, SSAO radius is clamped on close geometry. This ratio changes by how much.
   */
  get minZAspect() {
    return this._ssaoPostProcess.minZAspect;
  }
  set minZAspect(value) {
    this._ssaoPostProcess.minZAspect = value;
  }
  /**
   * The base color of the SSAO post-process
   * The final result is "base + ssao" between [0, 1]
   */
  get base() {
    return this._ssaoPostProcess.base;
  }
  set base(value) {
    this._ssaoPostProcess.base = value;
  }
  /**
   * Used in SSAO calculations to compensate for accuracy issues with depth values. Default 0.02.
   *
   * Normally you do not need to change this value, but you can experiment with it if you get a lot of in false self-occlusion on flat surfaces when using fewer than 16 samples. Useful range is normally [0..0.1] but higher values is allowed.
   */
  get epsilon() {
    return this._ssaoPostProcess.epsilon;
  }
  set epsilon(n) {
    this._ssaoPostProcess.epsilon = n;
  }
  /**
   * Skips the denoising (blur) stage of the SSAO calculations.
   *
   * Useful to temporarily set while experimenting with the other SSAO2 settings.
   */
  set bypassBlur(b) {
    this._ssaoBlurXPostProcess.bypassBlur = b;
    this._ssaoBlurYPostProcess.bypassBlur = b;
  }
  get bypassBlur() {
    return this._ssaoBlurXPostProcess.bypassBlur;
  }
  /**
   * Enables the configurable bilateral denoising (blurring) filter. Default is true.
   * Set to false to instead use a legacy bilateral filter that can't be configured.
   *
   * The denoising filter runs after the SSAO calculations and is a very important step. Both options results in a so called bilateral being used, but the "expensive" one can be
   * configured in several ways to fit your scene.
   */
  set expensiveBlur(b) {
    this._ssaoBlurXPostProcess.expensiveBlur = b;
    this._ssaoBlurYPostProcess.expensiveBlur = b;
  }
  get expensiveBlur() {
    return this._ssaoBlurXPostProcess.expensiveBlur;
  }
  /**
   * The number of samples the bilateral filter uses in both dimensions when denoising the SSAO calculations. Default value is 16.
   *
   * A higher value should result in smoother shadows but will use more processing time in the shaders.
   *
   * A high value can cause the shadows to get to blurry or create visible artifacts (bands) near sharp details in the geometry. The artifacts can sometimes be mitigated by increasing the bilateralSoften setting.
   */
  get bilateralSamples() {
    return this._ssaoBlurXPostProcess.bilateralSamples;
  }
  set bilateralSamples(n) {
    this._ssaoBlurXPostProcess.bilateralSamples = n;
    this._ssaoBlurYPostProcess.bilateralSamples = n;
  }
  /**
   * Controls the shape of the denoising kernel used by the bilateral filter. Default value is 0.
   *
   * By default the bilateral filter acts like a box-filter, treating all samples on the same depth with equal weights. This is effective to maximize the denoising effect given a limited set of samples. However, it also often results in visible ghosting around sharp shadow regions and can spread out lines over large areas so they are no longer visible.
   *
   * Increasing this setting will make the filter pay less attention to samples further away from the center sample, reducing many artifacts but at the same time increasing noise.
   *
   * Useful value range is [0..1].
   */
  get bilateralSoften() {
    return this._ssaoBlurXPostProcess.bilateralSoften;
  }
  set bilateralSoften(n) {
    this._ssaoBlurXPostProcess.bilateralSoften = n;
    this._ssaoBlurYPostProcess.bilateralSoften = n;
  }
  /**
   * How forgiving the bilateral denoiser should be when rejecting samples. Default value is 0.
   *
   * A higher value results in the bilateral filter being more forgiving and thus doing a better job at denoising slanted and curved surfaces, but can lead to shadows spreading out around corners or between objects that are close to each other depth wise.
   *
   * Useful value range is normally [0..1], but higher values are allowed.
   */
  get bilateralTolerance() {
    return this._ssaoBlurXPostProcess.bilateralTolerance;
  }
  set bilateralTolerance(n) {
    this._ssaoBlurXPostProcess.bilateralTolerance = n;
    this._ssaoBlurYPostProcess.bilateralTolerance = n;
  }
  /**
   * Indicates that the combine stage should use the current camera viewport to render the SSAO result on only a portion of the output texture (default: true).
   */
  get useViewportInCombineStage() {
    return this._ssaoCombinePostProcess.useViewportInCombineStage;
  }
  set useViewportInCombineStage(b) {
    this._ssaoCombinePostProcess.useViewportInCombineStage = b;
  }
  /**
   * Checks if all the post processes in the pipeline are ready.
   * @returns true if all the post processes in the pipeline are ready
   */
  isReady() {
    return this._ssaoPostProcess.isReady() && this._ssaoBlurXPostProcess.isReady() && this._ssaoBlurYPostProcess.isReady() && this._ssaoCombinePostProcess.isReady();
  }
  /**
   * Constructor of the SSR rendering pipeline
   * @param name The rendering pipeline name
   * @param scene The scene linked to this pipeline
   */
  constructor(name, scene) {
    this.name = name;
    this._scene = scene;
    this._ssaoPostProcess = new ThinSSAO2PostProcess(this.name, this._scene);
    this._ssaoBlurXPostProcess = new ThinSSAO2BlurPostProcess(this.name + " BlurX", this._scene.getEngine(), true);
    this._ssaoBlurYPostProcess = new ThinSSAO2BlurPostProcess(this.name + " BlurY", this._scene.getEngine(), false);
    this._ssaoCombinePostProcess = new ThinSSAO2CombinePostProcess(this.name + " Combiner", this._scene.getEngine());
  }
  /**
   * Disposes of the pipeline
   */
  dispose() {
    this._ssaoPostProcess?.dispose();
    this._ssaoBlurXPostProcess?.dispose();
    this._ssaoBlurYPostProcess?.dispose();
    this._ssaoCombinePostProcess?.dispose();
  }
}
let SSAO2RenderingPipeline = (() => {
  var _a;
  let _classSuper = PostProcessRenderPipeline;
  let _instanceExtraInitializers = [];
  let _get_totalStrength_decorators;
  let _get_maxZ_decorators;
  let _get_minZAspect_decorators;
  let _set_epsilon_decorators;
  let _set_samples_decorators;
  let __textureSamples_decorators;
  let __textureSamples_initializers = [];
  let __textureSamples_extraInitializers = [];
  let __forceGeometryBuffer_decorators;
  let __forceGeometryBuffer_initializers = [];
  let __forceGeometryBuffer_extraInitializers = [];
  let __ratio_decorators;
  let __ratio_initializers = [];
  let __ratio_extraInitializers = [];
  let __textureType_decorators;
  let __textureType_initializers = [];
  let __textureType_extraInitializers = [];
  let _get_radius_decorators;
  let _get_base_decorators;
  let _set_bypassBlur_decorators;
  let _set_expensiveBlur_decorators;
  let _get_bilateralSamples_decorators;
  let _get_bilateralSoften_decorators;
  let _get_bilateralTolerance_decorators;
  return _a = class SSAO2RenderingPipeline extends _classSuper {
    /**
     * The output strength of the SSAO post-process. Default value is 1.0.
     */
    get totalStrength() {
      return this._thinSSAORenderingPipeline.totalStrength;
    }
    set totalStrength(value) {
      this._thinSSAORenderingPipeline.totalStrength = value;
    }
    /**
     * Maximum depth value to still render AO. A smooth falloff makes the dimming more natural, so there will be no abrupt shading change.
     */
    get maxZ() {
      return this._thinSSAORenderingPipeline.maxZ;
    }
    set maxZ(value) {
      this._thinSSAORenderingPipeline.maxZ = value;
    }
    /**
     * In order to save performances, SSAO radius is clamped on close geometry. This ratio changes by how much.
     */
    get minZAspect() {
      return this._thinSSAORenderingPipeline.minZAspect;
    }
    set minZAspect(value) {
      this._thinSSAORenderingPipeline.minZAspect = value;
    }
    /**
     * Used in SSAO calculations to compensate for accuracy issues with depth values. Default 0.02.
     *
     * Normally you do not need to change this value, but you can experiment with it if you get a lot of in false self-occlusion on flat surfaces when using fewer than 16 samples. Useful range is normally [0..0.1] but higher values is allowed.
     */
    set epsilon(n) {
      this._thinSSAORenderingPipeline.epsilon = n;
    }
    get epsilon() {
      return this._thinSSAORenderingPipeline.epsilon;
    }
    /**
     * Number of samples used for the SSAO calculations. Default value is 8.
     */
    set samples(n) {
      this._thinSSAORenderingPipeline.samples = n;
    }
    get samples() {
      return this._thinSSAORenderingPipeline.samples;
    }
    /**
     * Number of samples to use for antialiasing.
     */
    set textureSamples(n) {
      this._textureSamples = n;
      if (this._prePassRenderer) {
        this._prePassRenderer.samples = n;
      } else {
        this._originalColorPostProcess.samples = n;
      }
    }
    get textureSamples() {
      return this._textureSamples;
    }
    get _geometryBufferRenderer() {
      if (!this._forceGeometryBuffer) {
        return null;
      }
      return this._forcedGeometryBuffer ?? this._scene.geometryBufferRenderer;
    }
    get _prePassRenderer() {
      if (this._forceGeometryBuffer) {
        return null;
      }
      return this._scene.prePassRenderer;
    }
    /**
     * The radius around the analyzed pixel used by the SSAO post-process. Default value is 2.0
     */
    get radius() {
      return this._thinSSAORenderingPipeline.radius;
    }
    set radius(value) {
      this._thinSSAORenderingPipeline.radius = value;
    }
    /**
     * The base color of the SSAO post-process
     * The final result is "base + ssao" between [0, 1]
     */
    get base() {
      return this._thinSSAORenderingPipeline.base;
    }
    set base(value) {
      this._thinSSAORenderingPipeline.base = value;
    }
    /**
     * Skips the denoising (blur) stage of the SSAO calculations.
     *
     * Useful to temporarily set while experimenting with the other SSAO2 settings.
     */
    set bypassBlur(b) {
      this._thinSSAORenderingPipeline.bypassBlur = b;
    }
    get bypassBlur() {
      return this._thinSSAORenderingPipeline.bypassBlur;
    }
    /**
     * Enables the configurable bilateral denoising (blurring) filter. Default is true.
     * Set to false to instead use a legacy bilateral filter that can't be configured.
     *
     * The denoising filter runs after the SSAO calculations and is a very important step. Both options results in a so called bilateral being used, but the "expensive" one can be
     * configured in several ways to fit your scene.
     */
    set expensiveBlur(b) {
      this._thinSSAORenderingPipeline.expensiveBlur = b;
    }
    get expensiveBlur() {
      return this._thinSSAORenderingPipeline.expensiveBlur;
    }
    /**
     * The number of samples the bilateral filter uses in both dimensions when denoising the SSAO calculations. Default value is 16.
     *
     * A higher value should result in smoother shadows but will use more processing time in the shaders.
     *
     * A high value can cause the shadows to get to blurry or create visible artifacts (bands) near sharp details in the geometry. The artifacts can sometimes be mitigated by increasing the bilateralSoften setting.
     */
    get bilateralSamples() {
      return this._thinSSAORenderingPipeline.bilateralSamples;
    }
    set bilateralSamples(n) {
      this._thinSSAORenderingPipeline.bilateralSamples = n;
    }
    /**
     * Controls the shape of the denoising kernel used by the bilateral filter. Default value is 0.
     *
     * By default the bilateral filter acts like a box-filter, treating all samples on the same depth with equal weights. This is effective to maximize the denoising effect given a limited set of samples. However, it also often results in visible ghosting around sharp shadow regions and can spread out lines over large areas so they are no longer visible.
     *
     * Increasing this setting will make the filter pay less attention to samples further away from the center sample, reducing many artifacts but at the same time increasing noise.
     *
     * Useful value range is [0..1].
     */
    get bilateralSoften() {
      return this._thinSSAORenderingPipeline.bilateralSoften;
    }
    set bilateralSoften(n) {
      this._thinSSAORenderingPipeline.bilateralSoften = n;
    }
    /**
     * How forgiving the bilateral denoiser should be when rejecting samples. Default value is 0.
     *
     * A higher value results in the bilateral filter being more forgiving and thus doing a better job at denoising slanted and curved surfaces, but can lead to shadows spreading out around corners or between objects that are close to each other depth wise.
     *
     * Useful value range is normally [0..1], but higher values are allowed.
     */
    get bilateralTolerance() {
      return this._thinSSAORenderingPipeline.bilateralTolerance;
    }
    set bilateralTolerance(n) {
      this._thinSSAORenderingPipeline.bilateralTolerance = n;
    }
    /**
     *  Support test.
     */
    static get IsSupported() {
      const engine = EngineStore.LastCreatedEngine;
      if (!engine) {
        return false;
      }
      return engine._features.supportSSAO2;
    }
    /**
     * Indicates that the combine stage should use the current camera viewport to render the SSAO result on only a portion of the output texture (default: true).
     */
    get useViewportInCombineStage() {
      return this._thinSSAORenderingPipeline.useViewportInCombineStage;
    }
    set useViewportInCombineStage(b) {
      this._thinSSAORenderingPipeline.useViewportInCombineStage = b;
    }
    /**
     * Checks if all the post processes in the pipeline are ready.
     * @returns True if all the post processes in the pipeline are ready
     */
    isReady() {
      this._syncNormalsInWorldSpace();
      return this._thinSSAORenderingPipeline.isReady();
    }
    /**
     * Gets active scene
     */
    get scene() {
      return this._scene;
    }
    /**
     * Creates the SSAO2 rendering pipeline.
     * @param name The rendering pipeline name
     * @param scene The scene linked to this pipeline
     * @param ratio The size of the postprocesses. Can be a number shared between passes or an object for more precision: { ssaoRatio: 0.5, blurRatio: 1.0 }
     * @param cameras The array of cameras that the rendering pipeline will be attached to
     * @param forceGeometryBuffer Set to true if you want to use the legacy geometry buffer renderer. You can also pass an existing instance of GeometryBufferRenderer if you want to use your own geometry buffer renderer.
     * @param textureType The texture type used by the different post processes created by SSAO (default: 0)
     */
    constructor(name, scene, ratio, cameras, forceGeometryBuffer = false, textureType = 0) {
      RegisterPrePassRendererSceneComponent(PrePassRenderer);
      RegisterGeometryBufferRendererSceneComponent(GeometryBufferRenderer);
      super(scene.getEngine(), name);
      this.SSAOOriginalSceneColorEffect = (__runInitializers(this, _instanceExtraInitializers), "SSAOOriginalSceneColorEffect");
      this.SSAORenderEffect = "SSAORenderEffect";
      this.SSAOBlurHRenderEffect = "SSAOBlurHRenderEffect";
      this.SSAOBlurVRenderEffect = "SSAOBlurVRenderEffect";
      this.SSAOCombineRenderEffect = "SSAOCombineRenderEffect";
      this._textureSamples = __runInitializers(this, __textureSamples_initializers, 1);
      this._forcedGeometryBuffer = (__runInitializers(this, __textureSamples_extraInitializers), null);
      this._forceGeometryBuffer = __runInitializers(this, __forceGeometryBuffer_initializers, false);
      this._ratio = (__runInitializers(this, __forceGeometryBuffer_extraInitializers), __runInitializers(this, __ratio_initializers, void 0));
      this._textureType = (__runInitializers(this, __ratio_extraInitializers), __runInitializers(this, __textureType_initializers, void 0));
      this._scene = __runInitializers(this, __textureType_extraInitializers);
      this._currentCameraMode = -1;
      this._thinSSAORenderingPipeline = new ThinSSAO2RenderingPipeline(name, scene);
      this._scene = scene;
      this._ratio = ratio;
      this._textureType = textureType;
      if (forceGeometryBuffer instanceof GeometryBufferRenderer) {
        this._forceGeometryBuffer = true;
        this._forcedGeometryBuffer = forceGeometryBuffer;
      } else {
        this._forceGeometryBuffer = forceGeometryBuffer;
      }
      if (!this.isSupported) {
        Logger.Error("The current engine does not support SSAO 2.");
        return;
      }
      const ssaoRatio = this._ratio.ssaoRatio || ratio;
      const blurRatio = this._ratio.blurRatio || ratio;
      if (this._forceGeometryBuffer) {
        if (!this._forcedGeometryBuffer) {
          scene.enableGeometryBufferRenderer();
        }
      } else {
        scene.enablePrePassRenderer();
      }
      this._syncNormalsInWorldSpace();
      this._originalColorPostProcess = new PassPostProcess("SSAOOriginalSceneColor", 1, null, Texture.BILINEAR_SAMPLINGMODE, scene.getEngine(), void 0, this._textureType);
      this._originalColorPostProcess.onBeforeRenderObservable.add(() => {
        this._syncNormalsInWorldSpace();
        const camera = this._scene.activeCamera;
        this._thinSSAORenderingPipeline._ssaoPostProcess.camera = camera;
        if (camera && this._currentCameraMode !== camera.mode) {
          this._currentCameraMode = camera.mode;
          this._thinSSAORenderingPipeline._ssaoPostProcess.updateEffect();
        }
      });
      this._originalColorPostProcess.samples = this.textureSamples;
      this._createSSAOPostProcess(1, textureType);
      this._createBlurPostProcess(ssaoRatio, blurRatio, this._textureType);
      this._createSSAOCombinePostProcess(blurRatio, this._textureType);
      this.addEffect(new PostProcessRenderEffect(scene.getEngine(), this.SSAOOriginalSceneColorEffect, () => {
        return this._originalColorPostProcess;
      }, true));
      this.addEffect(new PostProcessRenderEffect(scene.getEngine(), this.SSAORenderEffect, () => {
        return this._ssaoPostProcess;
      }, true));
      this.addEffect(new PostProcessRenderEffect(scene.getEngine(), this.SSAOBlurHRenderEffect, () => {
        return this._blurHPostProcess;
      }, true));
      this.addEffect(new PostProcessRenderEffect(scene.getEngine(), this.SSAOBlurVRenderEffect, () => {
        return this._blurVPostProcess;
      }, true));
      this.addEffect(new PostProcessRenderEffect(scene.getEngine(), this.SSAOCombineRenderEffect, () => {
        return this._ssaoCombinePostProcess;
      }, true));
      scene.postProcessRenderPipelineManager.addPipeline(this);
      if (cameras) {
        scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(name, cameras);
      }
    }
    // Public Methods
    /**
     * Get the class name
     * @returns "SSAO2RenderingPipeline"
     */
    getClassName() {
      return "SSAO2RenderingPipeline";
    }
    /**
     * Removes the internal pipeline assets and detaches the pipeline from the scene cameras
     * @param disableGeometryBufferRenderer Set to true if you want to disable the Geometry Buffer renderer
     */
    dispose(disableGeometryBufferRenderer = false) {
      for (let i = 0; i < this._scene.cameras.length; i++) {
        const camera = this._scene.cameras[i];
        this._originalColorPostProcess.dispose(camera);
        this._ssaoPostProcess.dispose(camera);
        this._blurHPostProcess.dispose(camera);
        this._blurVPostProcess.dispose(camera);
        this._ssaoCombinePostProcess.dispose(camera);
      }
      if (disableGeometryBufferRenderer && !this._forcedGeometryBuffer) {
        this._scene.disableGeometryBufferRenderer();
      }
      this._scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(this._name, this._scene.cameras);
      this._scene.postProcessRenderPipelineManager.removePipeline(this._name);
      this._thinSSAORenderingPipeline.dispose();
      super.dispose();
    }
    // Private Methods
    _syncNormalsInWorldSpace() {
      const renderer = this._forceGeometryBuffer ? this._geometryBufferRenderer : this._prePassRenderer;
      const normalsInWorldSpace = !!renderer?.generateNormalsInWorldSpace;
      this._thinSSAORenderingPipeline._ssaoPostProcess.normalsInWorldSpace = normalsInWorldSpace;
    }
    /** @internal */
    _rebuild() {
      super._rebuild();
    }
    _createBlurPostProcess(ssaoRatio, blurRatio, textureType) {
      this._blurHPostProcess = this._createBlurFilter("BlurH", ssaoRatio, textureType, true);
      this._blurVPostProcess = this._createBlurFilter("BlurV", blurRatio, textureType, false);
    }
    _createBlurFilter(name, ratio, textureType, horizontal) {
      const blurFilter = new PostProcess(name, ThinSSAO2BlurPostProcess.FragmentUrl, {
        size: ratio,
        samplingMode: 2,
        engine: this._scene.getEngine(),
        textureType: this._textureType,
        effectWrapper: horizontal ? this._thinSSAORenderingPipeline._ssaoBlurXPostProcess : this._thinSSAORenderingPipeline._ssaoBlurYPostProcess
      });
      blurFilter.onApply = (effect) => {
        const ratio2 = this._ratio.blurRatio || this._ratio;
        const ssaoCombineSize = horizontal ? this._originalColorPostProcess.width * ratio2 : this._originalColorPostProcess.height * ratio2;
        const originalColorSize = horizontal ? this._originalColorPostProcess.width : this._originalColorPostProcess.height;
        this._thinSSAORenderingPipeline._ssaoBlurXPostProcess.textureSize = ssaoCombineSize > 0 ? ssaoCombineSize : originalColorSize;
        this._thinSSAORenderingPipeline._ssaoBlurYPostProcess.textureSize = ssaoCombineSize > 0 ? ssaoCombineSize : originalColorSize;
        if (this._geometryBufferRenderer) {
          effect.setTexture("depthSampler", this._geometryBufferRenderer.getGBuffer().textures[0]);
        } else if (this._prePassRenderer) {
          effect.setTexture("depthSampler", this._prePassRenderer.getRenderTarget().textures[this._prePassRenderer.getIndex(5)]);
        }
      };
      blurFilter.samples = this.textureSamples;
      blurFilter.autoClear = false;
      return blurFilter;
    }
    _getTextureSize() {
      const engine = this._scene.getEngine();
      const prePassRenderer = this._prePassRenderer;
      let textureSize = { width: engine.getRenderWidth(), height: engine.getRenderHeight() };
      if (prePassRenderer && this._scene.activeCamera?._getFirstPostProcess() === this._ssaoPostProcess) {
        const renderTarget = prePassRenderer.getRenderTarget();
        if (renderTarget && renderTarget.textures) {
          textureSize = renderTarget.textures[prePassRenderer.getIndex(4)].getSize();
        }
      } else if (this._ssaoPostProcess.inputTexture) {
        textureSize.width = this._ssaoPostProcess.inputTexture.width;
        textureSize.height = this._ssaoPostProcess.inputTexture.height;
      }
      return textureSize;
    }
    _createSSAOPostProcess(ratio, textureType) {
      this._ssaoPostProcess = new PostProcess("ssao", ThinSSAO2PostProcess.FragmentUrl, {
        size: ratio,
        samplingMode: 2,
        engine: this._scene.getEngine(),
        textureType,
        effectWrapper: this._thinSSAORenderingPipeline._ssaoPostProcess
      });
      this._ssaoPostProcess.autoClear = false;
      this._ssaoPostProcess.onApply = (effect) => {
        if (this._geometryBufferRenderer) {
          effect.setTexture("depthSampler", this._geometryBufferRenderer.getGBuffer().textures[0]);
          effect.setTexture("normalSampler", this._geometryBufferRenderer.getGBuffer().textures[1]);
        } else if (this._prePassRenderer) {
          effect.setTexture("depthSampler", this._prePassRenderer.getRenderTarget().textures[this._prePassRenderer.getIndex(5)]);
          effect.setTexture("normalSampler", this._prePassRenderer.getRenderTarget().textures[this._prePassRenderer.getIndex(6)]);
        }
        const textureSize = this._getTextureSize();
        this._thinSSAORenderingPipeline._ssaoPostProcess.textureWidth = textureSize.width;
        this._thinSSAORenderingPipeline._ssaoPostProcess.textureHeight = textureSize.height;
      };
      this._ssaoPostProcess.samples = this.textureSamples;
      if (!this._forceGeometryBuffer) {
        this._ssaoPostProcess._prePassEffectConfiguration = new SSAO2Configuration();
      }
    }
    _createSSAOCombinePostProcess(ratio, textureType) {
      this._ssaoCombinePostProcess = new PostProcess("ssaoCombine", ThinSSAO2CombinePostProcess.FragmentUrl, {
        size: ratio,
        samplingMode: 2,
        engine: this._scene.getEngine(),
        textureType,
        effectWrapper: this._thinSSAORenderingPipeline._ssaoCombinePostProcess
      });
      this._ssaoCombinePostProcess.onApply = (effect) => {
        this._thinSSAORenderingPipeline._ssaoCombinePostProcess.camera = this._scene.activeCamera;
        effect.setTextureFromPostProcessOutput("originalColor", this._originalColorPostProcess);
      };
      this._ssaoCombinePostProcess.autoClear = false;
      this._ssaoCombinePostProcess.samples = this.textureSamples;
    }
    /**
     * Serialize the rendering pipeline (Used when exporting)
     * @returns the serialized object
     */
    serialize() {
      const serializationObject = SerializationHelper.Serialize(this);
      serializationObject.customType = "SSAO2RenderingPipeline";
      return serializationObject;
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _get_totalStrength_decorators = [serialize()];
    _get_maxZ_decorators = [serialize()];
    _get_minZAspect_decorators = [serialize()];
    _set_epsilon_decorators = [serialize("epsilon")];
    _set_samples_decorators = [serialize("samples")];
    __textureSamples_decorators = [serialize("textureSamples")];
    __forceGeometryBuffer_decorators = [serialize()];
    __ratio_decorators = [serialize()];
    __textureType_decorators = [serialize()];
    _get_radius_decorators = [serialize()];
    _get_base_decorators = [serialize()];
    _set_bypassBlur_decorators = [serialize("bypassBlur")];
    _set_expensiveBlur_decorators = [serialize("expensiveBlur")];
    _get_bilateralSamples_decorators = [serialize()];
    _get_bilateralSoften_decorators = [serialize()];
    _get_bilateralTolerance_decorators = [serialize()];
    __esDecorate(_a, null, _get_totalStrength_decorators, { kind: "getter", name: "totalStrength", static: false, private: false, access: { has: (obj) => "totalStrength" in obj, get: (obj) => obj.totalStrength }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_maxZ_decorators, { kind: "getter", name: "maxZ", static: false, private: false, access: { has: (obj) => "maxZ" in obj, get: (obj) => obj.maxZ }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_minZAspect_decorators, { kind: "getter", name: "minZAspect", static: false, private: false, access: { has: (obj) => "minZAspect" in obj, get: (obj) => obj.minZAspect }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _set_epsilon_decorators, { kind: "setter", name: "epsilon", static: false, private: false, access: { has: (obj) => "epsilon" in obj, set: (obj, value) => {
      obj.epsilon = value;
    } }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _set_samples_decorators, { kind: "setter", name: "samples", static: false, private: false, access: { has: (obj) => "samples" in obj, set: (obj, value) => {
      obj.samples = value;
    } }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_radius_decorators, { kind: "getter", name: "radius", static: false, private: false, access: { has: (obj) => "radius" in obj, get: (obj) => obj.radius }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_base_decorators, { kind: "getter", name: "base", static: false, private: false, access: { has: (obj) => "base" in obj, get: (obj) => obj.base }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _set_bypassBlur_decorators, { kind: "setter", name: "bypassBlur", static: false, private: false, access: { has: (obj) => "bypassBlur" in obj, set: (obj, value) => {
      obj.bypassBlur = value;
    } }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _set_expensiveBlur_decorators, { kind: "setter", name: "expensiveBlur", static: false, private: false, access: { has: (obj) => "expensiveBlur" in obj, set: (obj, value) => {
      obj.expensiveBlur = value;
    } }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_bilateralSamples_decorators, { kind: "getter", name: "bilateralSamples", static: false, private: false, access: { has: (obj) => "bilateralSamples" in obj, get: (obj) => obj.bilateralSamples }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_bilateralSoften_decorators, { kind: "getter", name: "bilateralSoften", static: false, private: false, access: { has: (obj) => "bilateralSoften" in obj, get: (obj) => obj.bilateralSoften }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a, null, _get_bilateralTolerance_decorators, { kind: "getter", name: "bilateralTolerance", static: false, private: false, access: { has: (obj) => "bilateralTolerance" in obj, get: (obj) => obj.bilateralTolerance }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(null, null, __textureSamples_decorators, { kind: "field", name: "_textureSamples", static: false, private: false, access: { has: (obj) => "_textureSamples" in obj, get: (obj) => obj._textureSamples, set: (obj, value) => {
      obj._textureSamples = value;
    } }, metadata: _metadata }, __textureSamples_initializers, __textureSamples_extraInitializers);
    __esDecorate(null, null, __forceGeometryBuffer_decorators, { kind: "field", name: "_forceGeometryBuffer", static: false, private: false, access: { has: (obj) => "_forceGeometryBuffer" in obj, get: (obj) => obj._forceGeometryBuffer, set: (obj, value) => {
      obj._forceGeometryBuffer = value;
    } }, metadata: _metadata }, __forceGeometryBuffer_initializers, __forceGeometryBuffer_extraInitializers);
    __esDecorate(null, null, __ratio_decorators, { kind: "field", name: "_ratio", static: false, private: false, access: { has: (obj) => "_ratio" in obj, get: (obj) => obj._ratio, set: (obj, value) => {
      obj._ratio = value;
    } }, metadata: _metadata }, __ratio_initializers, __ratio_extraInitializers);
    __esDecorate(null, null, __textureType_decorators, { kind: "field", name: "_textureType", static: false, private: false, access: { has: (obj) => "_textureType" in obj, get: (obj) => obj._textureType, set: (obj, value) => {
      obj._textureType = value;
    } }, metadata: _metadata }, __textureType_initializers, __textureType_extraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
let _Registered = false;
function SSAO2RenderingPipelineParse(source, scene, rootUrl) {
  return SerializationHelper.Parse(() => new SSAO2RenderingPipeline(source._name, scene, source._ratio, void 0, source._forceGeometryBuffer, source._textureType), source, scene, rootUrl);
}
function RegisterSsao2RenderingPipeline() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterPostProcessRenderPipelineManagerSceneComponent(PostProcessRenderPipelineManager);
  SSAO2RenderingPipeline.Parse = SSAO2RenderingPipelineParse;
  RegisterClass("BABYLON.SSAO2RenderingPipeline", SSAO2RenderingPipeline);
}
RegisterSsao2RenderingPipeline();
export {
  BlurPostProcess as B,
  DefaultRenderingPipeline as D,
  ImageProcessingPostProcess as I,
  PostProcessManager as P,
  SSAO2RenderingPipeline as S,
  ThinBlurPostProcess as T,
  PostProcess as a
};
