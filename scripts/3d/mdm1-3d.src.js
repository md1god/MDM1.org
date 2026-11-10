/* MDM1.org — site-wide interactive 3D layer (source).
 *
 * Built into /js/mdm1-3d.js with:  cd scripts/3d && npm install && npm run build
 * Loaded on every page by scripts/inject_menu_and_card.py at deploy time.
 *
 * What it adds (all optional, all progressive — the plain site still works without it):
 *   1. Ambient background: a 3D golden galaxy + a spinning MDM1 token that follow the pointer / device tilt
 *      and travel with the scroll position.
 *   2. "Gateways": on the home page of every language, an orbit of planets built from the site menu links.
 *      Drag to rotate, click a planet to enter.
 *   3. 3D card tilt on hover and 3D scroll reveal for content blocks.
 *   4. A small toggle button (remembered) and automatic fallbacks: reduced-motion, data saver,
 *      no WebGL, low-memory devices, the local-LLM assistant page, pages that already own a big canvas.
 */
import {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, Points, BufferGeometry, Float32BufferAttribute,
  ShaderMaterial, AdditiveBlending, CylinderGeometry, TorusGeometry, SphereGeometry, IcosahedronGeometry,
  MeshStandardMaterial, CanvasTexture, SRGBColorSpace, AmbientLight, DirectionalLight, PointLight,
  Raycaster, Vector2, Sprite, SpriteMaterial, MathUtils, PMREMGenerator, EdgesGeometry, LineSegments,
  LineBasicMaterial, LineLoop, Color, ACESFilmicToneMapping,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

(function main() {
  'use strict';
  if (window.__mdm13d) return;
  window.__mdm13d = true;

  /* ------------------------------------------------------------------ environment */
  const doc = document;
  const root = doc.documentElement;
  const mq = (q) => (window.matchMedia ? window.matchMedia(q).matches : false);
  const reduceMotion = mq('(prefers-reduced-motion: reduce)');
  const coarse = mq('(pointer: coarse)');
  const nav = navigator;
  const saveData = !!(nav.connection && nav.connection.saveData);
  const lowMem = !!(nav.deviceMemory && nav.deviceMemory <= 2);
  const lowCpu = !!(nav.hardwareConcurrency && nav.hardwareConcurrency <= 2);
  const path = location.pathname.replace(/\/+$/, '/') || '/';
  const isRTL = (root.getAttribute('dir') || doc.dir || '').toLowerCase() === 'rtl';
  const lang = (root.getAttribute('lang') || 'ar').toLowerCase();
  const STORE = 'mdm1-3d';

  const GOLD = 0xc9a84c, GOLD_B = 0xf0c060, BLOOD = 0x8b1a1a, BLOOD_B = 0xcc2222, BLUE = 0x2a5bd7, TEAL = 0x2fb5a0, VIOLET = 0x9b6cff;

  const readPref = () => { try { return localStorage.getItem(STORE) !== 'off'; } catch (e) { return true; } };
  const writePref = (on) => { try { localStorage.setItem(STORE, on ? 'on' : 'off'); } catch (e) { /* private mode */ } };

  // Heavy pages keep the GPU to themselves: the in-browser LLM assistant and the game engines.
  const heavyPage = /^\/(assistant|chat|fight|games)(\/|\.html|$)/.test(path) || /^\/(assistant)\//.test(path);
  const lightMode = reduceMotion || saveData || lowMem;      // no WebGL at all
  const modest = coarse || lowCpu;                           // fewer particles, 30 fps

  let effectsOn = readPref();

  /* ------------------------------------------------------------------ small utilities */
  const clamp = MathUtils.clamp, lerp = MathUtils.lerp;
  const rand = Math.random;

  function onReady(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function makeRenderer(canvas, alpha) {
    try {
      const r = new WebGLRenderer({ canvas, alpha: !!alpha, antialias: !modest, powerPreference: 'low-power' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, modest ? 1.25 : 1.75));
      r.outputColorSpace = SRGBColorSpace;
      r.toneMapping = ACESFilmicToneMapping;
      r.toneMappingExposure = 1.1;
      if (alpha) r.setClearColor(0x000000, 0);
      return r;
    } catch (e) {
      return null;
    }
  }

  function environmentFor(renderer, scene) {
    try {
      const pm = new PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      if ('environmentIntensity' in scene) scene.environmentIntensity = 0.75;
      pm.dispose();
    } catch (e) { /* metals just look flatter */ }
  }

  /* ------------------------------------------------------------------ shared 3D pieces */
  function tokenFaceTexture() {
    const s = 512, c = doc.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const bg = g.createRadialGradient(s / 2, s / 2, 30, s / 2, s / 2, s / 2);
    bg.addColorStop(0, '#2c1d06'); bg.addColorStop(1, '#0b0700');
    g.fillStyle = bg; g.fillRect(0, 0, s, s);
    const ring = (r, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(s / 2, s / 2, r, 0, Math.PI * 2); g.stroke(); };
    ring(s / 2 - 22, 12, '#c9a84c'); ring(s / 2 - 48, 3, '#f0c060'); ring(s / 2 - 60, 2, '#6b4f1a');
    // Eye of Horus-like emblem
    g.save(); g.translate(s / 2, s * 0.37);
    g.strokeStyle = '#f0c060'; g.fillStyle = '#f0c060'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-96, 0); g.quadraticCurveTo(0, -78, 96, 0); g.quadraticCurveTo(0, 62, -96, 0); g.stroke();
    g.beginPath(); g.arc(4, -2, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0b0700'; g.beginPath(); g.arc(4, -2, 11, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c9a84c'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-18, 40); g.quadraticCurveTo(-30, 82, -6, 98); g.stroke();
    g.restore();
    g.fillStyle = '#f0c060'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 112px Georgia, "Times New Roman", serif';
    g.fillText('MDM1', s / 2, s * 0.74);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function buildToken() {
    const face = tokenFaceTexture();
    const side = new MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.26 });
    const cap = new MeshStandardMaterial({ map: face, emissive: 0x3a2506, emissiveMap: face, emissiveIntensity: 0.9, metalness: 0.85, roughness: 0.34 });
    const body = new Mesh(new CylinderGeometry(1, 1, 0.17, 96, 1), [side, cap, cap]);
    body.rotation.x = Math.PI / 2;                         // cap faces the camera
    const rimMat = new MeshStandardMaterial({ color: GOLD_B, metalness: 1, roughness: 0.2 });
    const rimA = new Mesh(new TorusGeometry(1, 0.055, 16, 96), rimMat); rimA.position.z = 0.085;
    const rimB = rimA.clone(); rimB.position.z = -0.085;
    const g = new Group();
    g.add(body, rimA, rimB);
    g.userData.dispose = () => { face.dispose(); side.dispose(); cap.dispose(); rimMat.dispose(); body.geometry.dispose(); rimA.geometry.dispose(); };
    return g;
  }

  function addLights(scene) {
    scene.add(new AmbientLight(0xffe9b8, 0.5));
    const key = new DirectionalLight(0xfff1cf, 2.2); key.position.set(3, 4, 6); scene.add(key);
    const warm = new PointLight(GOLD_B, 28, 30, 1.6); warm.position.set(-4, 1.5, 4); scene.add(warm);
    const cold = new PointLight(BLUE, 14, 30, 1.6); cold.position.set(5, -3, -2); scene.add(cold);
  }

  const PARTICLE_VERT = `
    uniform float uTime; uniform float uPx; uniform vec2 uPointer; uniform float uPush;
    attribute float aSize; attribute vec3 aColor; attribute float aRand;
    varying vec3 vColor; varying float vA;
    void main(){
      vec3 p = position;
      float r = length(p.xz);
      float ang = uTime * (0.05 + 0.22 / (r + 1.0)) * (0.6 + aRand * 0.8);
      float cs = cos(ang), sn = sin(ang);
      p.xz = mat2(cs, -sn, sn, cs) * p.xz;
      p.y += sin(uTime * 0.6 + aRand * 30.0 + r) * 0.12;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vec2 d = mv.xy - uPointer;
      float dist = length(d);
      mv.xy += normalize(d + vec2(0.0001)) * smoothstep(2.4, 0.0, dist) * uPush;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPx * (26.0 / max(0.5, -mv.z));
      vColor = aColor;
      vA = 0.3 + 0.7 * aRand;
    }`;
  const PARTICLE_FRAG = `
    varying vec3 vColor; varying float vA;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vColor, a * a * vA);
    }`;

  function buildGalaxy(count, radius) {
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count), rnd = new Float32Array(count);
    const inner = new Color(GOLD_B), mid = new Color(BLOOD_B), blue = new Color(BLUE), tmp = new Color();
    const arms = 3;
    for (let i = 0; i < count; i++) {
      const r = Math.pow(rand(), 1.55) * radius + 0.25;
      const arm = ((i % arms) / arms) * Math.PI * 2;
      const a = arm + r * 0.55;
      const spread = Math.pow(rand(), 3) * (rand() < 0.5 ? -1 : 1) * 0.55 * (0.4 + r * 0.18);
      pos[i * 3] = Math.cos(a) * r + spread;
      pos[i * 3 + 1] = (rand() - 0.5) * 0.7 * (1 - r / (radius * 1.15)) + spread * 0.25;
      pos[i * 3 + 2] = Math.sin(a) * r + (rand() - 0.5) * 0.4;
      tmp.copy(inner).lerp(rand() < 0.5 ? mid : blue, clamp(r / radius, 0, 1) * (0.5 + rand() * 0.5));
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      size[i] = 0.6 + rand() * rand() * 2.4;
      rnd[i] = rand();
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new Float32BufferAttribute(col, 3));
    geo.setAttribute('aSize', new Float32BufferAttribute(size, 1));
    geo.setAttribute('aRand', new Float32BufferAttribute(rnd, 1));
    const mat = new ShaderMaterial({
      vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uPointer: { value: new Vector2(99, 99) }, uPush: { value: 0.9 } },
    });
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  function makeLoop(step, shouldRun) {
    let raf = 0, running = false, last = 0;
    const minDelta = modest ? 1000 / 30 : 0;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (minDelta && t - last < minDelta) return;
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      step(t / 1000, dt);
    }
    function start() { if (!running && shouldRun()) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { running = false; cancelAnimationFrame(raf); }
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(); else start(); });
    return { start, stop, isRunning: () => running };
  }

  /* ------------------------------------------------------------------ 1. ambient background */
  const ambient = { canvas: null, stop: null, start: null, dispose: null };

  function startAmbient() {
    if (ambient.canvas || heavyPage || lightMode) return;
    // Pages that already draw their own full-screen canvas keep it.
    for (const c of doc.querySelectorAll('canvas')) {
      if (c.closest('#mdm1-hub3d') || c.id === 'mdm1-3d-bg') continue;
      const r = c.getBoundingClientRect();
      if (r.width * r.height > innerWidth * innerHeight * 0.45) return;
    }
    const canvas = doc.createElement('canvas');
    canvas.id = 'mdm1-3d-bg';
    canvas.setAttribute('aria-hidden', 'true');
    const renderer = makeRenderer(canvas, true);
    if (!renderer) return;
    doc.body.insertBefore(canvas, doc.body.firstChild);
    root.classList.add('m3d-on');

    const scene = new Scene();
    const camera = new PerspectiveCamera(55, 1, 0.1, 80);
    camera.position.set(0, 0, 9);
    environmentFor(renderer, scene);
    addLights(scene);

    const galaxy = buildGalaxy(modest ? 5200 : 14000, 9);
    const galaxyGroup = new Group();
    galaxyGroup.rotation.x = -0.95;
    galaxyGroup.add(galaxy);
    scene.add(galaxyGroup);

    const token = buildToken();
    const side = isRTL ? -1 : 1;                         // sit opposite the reading side
    token.position.set(side * 3.9, 0.4, -1);
    token.scale.setScalar(0.85);
    scene.add(token);

    const shapes = [];
    const shapeMat = new LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.22 });
    const ico = new IcosahedronGeometry(1, 0), edges = new EdgesGeometry(ico);
    for (let i = 0; i < 7; i++) {
      const m = new LineSegments(edges, shapeMat);
      m.position.set((rand() - 0.5) * 13, (rand() - 0.5) * 7, -2 - rand() * 5);
      m.scale.setScalar(0.35 + rand() * 0.9);
      m.userData.spin = new Vector2((rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6);
      m.userData.baseY = m.position.y;
      shapes.push(m); scene.add(m);
    }

    const state = { px: 0, py: 0, tx: 0, ty: 0, sp: 0, tsp: 0, vel: 0, lastScroll: scrollY, w: 0, h: 0 };
    const uni = galaxy.material.uniforms;

    function resize() {
      const w = innerWidth, h = innerHeight;
      if (w === state.w && h === state.h) return;
      state.w = w; state.h = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      uni.uPx.value = renderer.getPixelRatio() * (h / 900);
      // On narrow screens keep the token inside the frame.
      token.position.x = side * clamp(3.9 * (w / h) / 1.6, 1.6, 3.9);
    }
    resize();
    addEventListener('resize', resize, { passive: true });

    function readScroll() {
      const max = Math.max(1, root.scrollHeight - innerHeight);
      state.tsp = clamp(scrollY / max, 0, 1);
      state.vel += Math.abs(scrollY - state.lastScroll) * 0.0025;
      state.lastScroll = scrollY;
    }
    addEventListener('scroll', readScroll, { passive: true });
    readScroll();

    addEventListener('pointermove', (e) => { state.tx = (e.clientX / innerWidth) * 2 - 1; state.ty = -((e.clientY / innerHeight) * 2 - 1); }, { passive: true });
    if (coarse && 'DeviceOrientationEvent' in window) {
      addEventListener('deviceorientation', (e) => {
        if (e.gamma == null || e.beta == null) return;
        state.tx = clamp(e.gamma / 30, -1, 1); state.ty = clamp((e.beta - 45) / -30, -1, 1);
      }, { passive: true });
    }

    const loop = makeLoop((t, dt) => {
      resize();
      state.px = lerp(state.px, state.tx, 1 - Math.exp(-dt * 3));
      state.py = lerp(state.py, state.ty, 1 - Math.exp(-dt * 3));
      state.sp = lerp(state.sp, state.tsp, 1 - Math.exp(-dt * 2.5));
      state.vel *= Math.exp(-dt * 3);
      const dist = 9 - state.sp * 3.4;
      camera.position.set(state.px * 0.9, state.py * 0.5 - state.sp * 1.3, dist);
      camera.lookAt(0, -state.sp * 0.5, 0);
      galaxyGroup.rotation.y = state.sp * 1.7 + state.px * 0.15;
      galaxyGroup.rotation.x = -0.95 + state.sp * 0.5 + state.py * 0.08;
      uni.uTime.value = t;
      const halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * dist;
      uni.uPointer.value.set(state.px * halfH * camera.aspect, state.py * halfH);
      token.rotation.y = t * 0.7 + state.vel * 6 + state.px * 0.6;
      token.rotation.x = Math.sin(t * 0.5) * 0.18 + state.py * 0.3;
      token.position.y = 0.4 + Math.sin(t * 0.8) * 0.15 - state.sp * 0.6;
      for (const s of shapes) {
        s.rotation.x += s.userData.spin.x * dt; s.rotation.y += s.userData.spin.y * dt;
        s.position.y = s.userData.baseY + Math.sin(t * 0.5 + s.position.x) * 0.25;
      }
      renderer.render(scene, camera);
    }, () => effectsOn && !doc.hidden);

    ambient.canvas = canvas;
    ambient.start = () => { canvas.style.display = ''; root.classList.add('m3d-on'); loop.start(); };
    ambient.stop = () => { loop.stop(); canvas.style.display = 'none'; root.classList.remove('m3d-on'); };
    ambient.dispose = () => { loop.stop(); token.userData.dispose(); renderer.dispose(); canvas.remove(); ambient.canvas = null; };
    loop.start();
  }

  /* ------------------------------------------------------------------ 2. gateways (orbit navigation) */
  const HUB_TEXT = {
    ar: ['بوابات عالم MDM1', 'اسحب لتدوير المدار · اضغط على كوكب للدخول'],
    en: ['MDM1 Gateways', 'Drag to rotate · tap a planet to enter'],
    fr: ['Portails MDM1', 'Faites glisser pour tourner · touchez une planète'],
    es: ['Portales MDM1', 'Arrastra para girar · toca un planeta'],
    de: ['MDM1-Portale', 'Ziehen zum Drehen · Planet antippen'],
    tr: ['MDM1 Kapıları', 'Döndürmek için sürükle · bir gezegene dokun'],
    ru: ['Порталы MDM1', 'Перетащите для вращения · нажмите на планету'],
    pt: ['Portais MDM1', 'Arraste para girar · toque num planeta'],
    id: ['Gerbang MDM1', 'Seret untuk memutar · ketuk planet'],
    hi: ['MDM1 द्वार', 'घुमाने के लिए खींचें · ग्रह पर टैप करें'],
    zh: ['MDM1 入口', '拖动旋转 · 点击星球进入'],
    he: ['שערי MDM1', 'גררו לסיבוב · הקישו על כוכב'],
  };
  const hubText = HUB_TEXT[lang] || HUB_TEXT[lang.split('-')[0]] || HUB_TEXT.en;
  const PLANET_COLORS = [GOLD, BLOOD_B, BLUE, TEAL, VIOLET, GOLD_B];

  function isHomePage() {
    return /^\/(index\.html)?$/.test(path) || /^\/[a-z]{2}(-[a-z]{2})?\/(index\.html)?$/.test(path);
  }

  function collectLinks() {
    const seen = new Set(), out = [];
    const here = path.replace(/index\.html$/, '');
    const langHome = /^\/([a-z]{2}(-[a-z]{2})?)?\/?(index\.html)?$/i;
    function take(a) {
      const href = a.getAttribute('href');
      const label = (a.textContent || '').replace(/\s+/g, ' ').replace(/\s*#\d+$/, '').trim();
      if (!href || label.length < 2 || label.length > 60 || /^(#|javascript:|mailto:|tel:)/i.test(href)) return;
      let abs;
      try { abs = new URL(href, location.href); } catch (e) { return; }
      if (abs.origin === location.origin && abs.pathname.replace(/index\.html$/, '') === here) return;
      if (seen.has(abs.href)) return;
      seen.add(abs.href);
      out.push({ href: abs.href, label });
    }
    // 1) the site menu (Arabic home + untranslated pages)
    doc.querySelectorAll('#mdm1m-panel a[href]').forEach(take);
    // 2) translated pages have no menu: use the page's own content links, never the language switcher
    if (out.length < 2) {
      out.length = 0; seen.clear();
      doc.querySelectorAll('main a[href], header a[href], section a[href], nav a[href], article a[href]').forEach((a) => {
        if (a.closest('footer, #mdm1-hub3d, select, [class*="lang"], [id*="lang"], [class*="switch"]')) return;
        let u; try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }
        if (u.origin === location.origin && langHome.test(u.pathname)) return;     // "/", "/fr/", language switcher entries
        take(a);
      });
    }
    return out.slice(0, 12);
  }

  function labelSprite(text) {
    const w = 640, h = 140, c = doc.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    let t = text.length > 30 ? text.slice(0, 29) + '…' : text;
    g.font = '700 50px Tajawal, "Segoe UI", system-ui, sans-serif';
    g.direction = /[֐-ࣿ]/.test(t) ? 'rtl' : 'ltr';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = Math.min(w - 30, g.measureText(t).width + 56);
    g.fillStyle = 'rgba(5,4,3,0.72)';
    const x = (w - tw) / 2, y = 22, rh = h - 44, r = rh / 2;
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + tw, y, x + tw, y + rh, r); g.arcTo(x + tw, y + rh, x, y + rh, r); g.arcTo(x, y + rh, x, y, r); g.arcTo(x, y, x + tw, y, r); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(201,168,76,0.65)'; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = '#f4e3b0'; g.fillText(t, w / 2, h / 2 + 2, w - 60);
    const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
    const sp = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(2.5, 2.5 * (h / w), 1);
    sp.renderOrder = 20;
    return sp;
  }

  function buildHub() {
    const links = collectLinks();
    if (links.length < 2) return;

    const section = doc.createElement('section');
    section.id = 'mdm1-hub3d';
    section.setAttribute('aria-labelledby', 'mdm1-hub3d-h');
    section.innerHTML =
      '<div class="hub3d-head"><h2 id="mdm1-hub3d-h"></h2><p class="hub3d-hint"></p></div>' +
      '<div class="hub3d-stage"><canvas class="hub3d-canvas" aria-hidden="true"></canvas><div class="hub3d-tip" role="status"></div></div>' +
      '<nav class="hub3d-links" aria-label="MDM1"></nav>';
    section.querySelector('h2').textContent = hubText[0];
    section.querySelector('.hub3d-hint').textContent = hubText[1];
    const nav = section.querySelector('.hub3d-links');
    links.forEach((l) => { const a = doc.createElement('a'); a.href = l.href; a.textContent = l.label; nav.appendChild(a); });

    const anchor = doc.getElementById('ch1') || doc.querySelector('footer');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(section, anchor);
    else doc.body.appendChild(section);

    if (lightMode || !effectsOn) { section.classList.add('hub3d-plain'); return; }

    const canvas = section.querySelector('canvas');
    const stage = section.querySelector('.hub3d-stage');
    const tip = section.querySelector('.hub3d-tip');
    const renderer = makeRenderer(canvas, true);
    if (!renderer) { section.classList.add('hub3d-plain'); return; }

    const scene = new Scene();
    const camera = new PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 2.1, 9.2); camera.lookAt(0, 0, 0);
    environmentFor(renderer, scene);
    addLights(scene);

    const system = new Group();
    scene.add(system);
    const token = buildToken(); token.scale.setScalar(1.15);
    system.add(token);

    // star dust behind everything
    const dust = buildGalaxy(modest ? 1400 : 3600, 14);
    dust.material.uniforms.uPush.value = 0;
    dust.scale.setScalar(1.5);
    scene.add(dust);

    const planets = [];
    const pickables = [];
    const n = links.length;
    links.forEach((l, i) => {
      const lane = i % 3;
      const radius = 2.7 + lane * 1.05;
      const tilt = (lane - 1) * 0.22;
      const a0 = (i / n) * Math.PI * 2;
      const col = PLANET_COLORS[i % PLANET_COLORS.length];
      const mat = new MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.22, metalness: 0.55, roughness: 0.32 });
      const mesh = new Mesh(new SphereGeometry(0.3 + (lane === 1 ? 0.06 : 0), 40, 28), mat);
      const label = labelSprite(l.label);
      label.position.set(0, 0.66, 0);
      const holder = new Group();
      holder.add(mesh, label);
      const orbit = new Group();
      orbit.rotation.z = tilt;
      orbit.add(holder);
      system.add(orbit);
      const ringPts = [];
      for (let k = 0; k < 128; k++) { const a = (k / 128) * Math.PI * 2; ringPts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius); }
      const ringGeo = new BufferGeometry(); ringGeo.setAttribute('position', new Float32BufferAttribute(ringPts, 3));
      const ring = new LineLoop(ringGeo, new LineBasicMaterial({ color: col, transparent: true, opacity: 0.22 }));
      orbit.add(ring);
      const p = { link: l, mesh, label, holder, mat, radius, angle: a0, speed: (0.16 + (2 - lane) * 0.05) * (i % 2 ? -1 : 1), scale: 1, target: 1 };
      mesh.userData.planet = p; label.userData.planet = p;
      planets.push(p); pickables.push(mesh, label);
    });

    const ray = new Raycaster();
    const ptr = new Vector2(2, 2);
    const drag = { on: false, moved: 0, x: 0, y: 0, vx: 0, vy: 0, id: -1 };
    let hover = null, size = { w: 0, h: 0 }, visible = false;

    function resize() {
      const r = stage.getBoundingClientRect();
      const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
      if (w === size.w && h === size.h) return;
      size = { w, h };
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = w / h < 1 ? 13.5 : 9.2;
      camera.updateProjectionMatrix();
      dust.material.uniforms.uPx.value = renderer.getPixelRatio() * (h / 700);
    }
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else addEventListener('resize', resize);

    function setPointer(e) {
      const r = canvas.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    }
    function pick() {
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      return hit ? hit.object.userData.planet : null;
    }
    function showTip(p, e) {
      if (!p) { tip.classList.remove('on'); return; }
      tip.textContent = p.link.label;
      const r = stage.getBoundingClientRect();
      tip.style.left = clamp(e.clientX - r.left, 40, r.width - 40) + 'px';
      tip.style.top = clamp(e.clientY - r.top - 18, 20, r.height - 20) + 'px';
      tip.classList.add('on');
    }

    canvas.addEventListener('pointerdown', (e) => {
      drag.on = true; drag.moved = 0; drag.x = e.clientX; drag.y = e.clientY; drag.id = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      setPointer(e);
      if (drag.on) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        drag.x = e.clientX; drag.y = e.clientY;
        drag.vx = dx * 0.006; drag.vy = dy * 0.004;
        system.rotation.y += drag.vx;
        system.rotation.x = clamp(system.rotation.x + drag.vy, -0.7, 0.7);
      } else {
        hover = pick();
        canvas.style.cursor = hover ? 'pointer' : 'grab';
        showTip(hover, e);
      }
    });
    const endDrag = (e) => {
      if (!drag.on) return;
      drag.on = false;
      try { canvas.releasePointerCapture(drag.id); } catch (err) { /* ignore */ }
      if (drag.moved < 8) {
        setPointer(e);
        const p = pick();
        if (p) location.href = p.link.href;
      }
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', () => { drag.on = false; });
    canvas.addEventListener('pointerleave', () => { hover = null; tip.classList.remove('on'); });

    const loop = makeLoop((t, dt) => {
      if (!drag.on) {
        system.rotation.y += drag.vx; drag.vx *= Math.exp(-dt * 2.2);
        system.rotation.x = lerp(system.rotation.x, clamp(system.rotation.x + drag.vy, -0.7, 0.7), 0.5); drag.vy *= Math.exp(-dt * 2.2);
        system.rotation.y += dt * (hover ? 0.02 : 0.09);
        system.rotation.x = lerp(system.rotation.x, 0.28, 1 - Math.exp(-dt * 0.6));
      }
      for (const p of planets) {
        p.angle += p.speed * dt * (p === hover ? 0.1 : 1);
        p.holder.position.set(Math.cos(p.angle) * p.radius, 0, Math.sin(p.angle) * p.radius);
        p.target = p === hover ? 1.4 : 1;
        p.scale = lerp(p.scale, p.target, 1 - Math.exp(-dt * 9));
        p.mesh.scale.setScalar(p.scale);
        p.mat.emissiveIntensity = lerp(p.mat.emissiveIntensity, p === hover ? 0.9 : 0.22, 1 - Math.exp(-dt * 8));
        p.mesh.rotation.y += dt * 0.6;
      }
      token.rotation.y = t * 0.8;
      token.rotation.x = Math.sin(t * 0.6) * 0.15;
      dust.material.uniforms.uTime.value = t;
      dust.rotation.y = t * 0.01;
      renderer.render(scene, camera);
    }, () => visible && effectsOn && !doc.hidden);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) loop.start(); else loop.stop(); }, { rootMargin: '120px' }).observe(stage);
    } else { visible = true; loop.start(); }
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'pan-y';
    section.classList.add('hub3d-live');
    hubApi.start = () => { section.classList.remove('hub3d-plain'); loop.start(); };
    hubApi.stop = () => loop.stop();
  }
  const hubApi = { start() {}, stop() {} };

  /* ------------------------------------------------------------------ 3. card tilt + 3D reveal */
  const TILT_SEL = '.card,.game-card,.app-card,.tool-card,.split-card,.feature,.feature-card,.grid>article,[class*="-card"],[class$="card"]';
  const TILT_SKIP = 'input,textarea,select,video,iframe,form,canvas,#mdm1m-panel,nav,header';

  function initTilt() {
    if (reduceMotion || coarse) return;
    const els = [...doc.querySelectorAll(TILT_SEL)].filter((el) => {
      if (el.closest('#mdm1m-panel, #mdm1-hub3d, nav, header') || el.dataset.m3dTilt) return false;
      if (el.querySelector(TILT_SKIP)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 120 && r.width < 760 && r.height > 70 && r.height < 620;
    }).slice(0, 160);
    els.forEach((el) => {
      el.dataset.m3dTilt = '1';
      el.classList.add('m3d-tilt');
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        if (!effectsOn) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.setProperty('--m3d-rx', (-y * 9).toFixed(2) + 'deg');
          el.style.setProperty('--m3d-ry', (x * 11).toFixed(2) + 'deg');
          el.style.setProperty('--m3d-gx', ((x + 0.5) * 100).toFixed(1) + '%');
          el.style.setProperty('--m3d-gy', ((y + 0.5) * 100).toFixed(1) + '%');
          el.classList.add('m3d-hot');
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.style.removeProperty('--m3d-rx'); el.style.removeProperty('--m3d-ry');
        el.classList.remove('m3d-hot');
      });
    });
  }

  function initReveal() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    const sel = 'main>*,section>*,article>*,.container>*,.content>*,.grid>*';
    const targets = [...doc.querySelectorAll(sel)].filter((el) => {
      if (el.closest('#mdm1m-panel, #mdm1-hub3d, nav, header, footer, .chapter, [id^="ch"]')) return false;
      if (/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|CANVAS)$/.test(el.tagName)) return false;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'absolute' || cs.display === 'none') return false;
      const r = el.getBoundingClientRect();
      return r.height > 40 && r.top > innerHeight * 0.9;      // only things that start below the first screen
    }).slice(0, 220);
    if (!targets.length) return;
    root.classList.add('m3d-reveal-ready');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('m3d-in'); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((el) => { el.classList.add('m3d-rv'); io.observe(el); });
    setTimeout(() => targets.forEach((el) => el.classList.add('m3d-in')), 9000);   // safety net
  }

  /* ------------------------------------------------------------------ toggle button */
  function addToggle() {
    const b = doc.createElement('button');
    b.id = 'm3d-toggle'; b.type = 'button';
    const labels = lang.startsWith('ar') ? ['إيقاف المؤثرات ثلاثية الأبعاد', 'تشغيل المؤثرات ثلاثية الأبعاد'] : ['Turn 3D effects off', 'Turn 3D effects on'];
    function paint() {
      b.textContent = '3D';
      b.setAttribute('aria-pressed', String(effectsOn));
      const lbl = effectsOn ? labels[0] : labels[1];
      b.title = lbl; b.setAttribute('aria-label', lbl);
      b.classList.toggle('off', !effectsOn);
    }
    b.addEventListener('click', () => {
      effectsOn = !effectsOn; writePref(effectsOn); paint();
      root.classList.toggle('m3d-off', !effectsOn);
      if (effectsOn) { if (ambient.canvas) ambient.start(); else startAmbient(); hubApi.start(); }
      else { if (ambient.stop) ambient.stop(); hubApi.stop(); }
    });
    paint();
    root.classList.toggle('m3d-off', !effectsOn);
    doc.body.appendChild(b);
  }

  /* ------------------------------------------------------------------ boot */
  onReady(() => {
    try {
      if (isHomePage()) buildHub();
      if (!heavyPage) { initTilt(); initReveal(); }
      addToggle();
      if (effectsOn) startAmbient();
    } catch (err) {
      // The 3D layer must never break a page.
      if (window.console) console.warn('[mdm1-3d]', err);
    }
  });
}());
