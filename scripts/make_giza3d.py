#!/usr/bin/env python3
"""Generate giza3d/ from the mecca3d engine (same engine, same data pipeline, Giza location).

Nothing about the world is invented here: roads, buildings, names and landmarks all come from
OpenStreetMap through giza3d/tools/build_data.py. This script only (1) copies the engine,
(2) moves the origin to the Great Pyramid, (3) removes Mecca-only things (the hand-made Kaaba model,
Mecca landmark list, Mecca contribution tables) and (4) lets a pyramid drawn in OSM
(building=pyramid / tomb=pyramid, with its height tag) be rendered as a pyramid instead of a box.
Every patch must match exactly once, otherwise the script fails loudly (so engine drift is never silent).
"""
import os, re, shutil, sys

SRC, DST = "mecca3d", "giza3d"


def sub(text, old, new, path, count=1):
    n = text.count(old)
    if n != count:
        sys.exit(f"PATCH FAILED in {path}: expected {count} match(es), found {n}: {old[:70]!r}")
    return text.replace(old, new)


def rsub(text, pattern, new, path, flags=0):
    out, n = re.subn(pattern, lambda _m: new, text, count=1, flags=flags)
    if n != 1:
        sys.exit(f"PATCH FAILED in {path}: regex not found: {pattern[:70]!r}")
    return out


def edit(rel, fn):
    p = os.path.join(DST, rel)
    t = open(p, encoding="utf-8").read()
    t = fn(t, rel)
    open(p, "w", encoding="utf-8").write(t)


# ---------------------------------------------------------------- 1) copy engine (keep existing giza3d/data)
os.makedirs(DST, exist_ok=True)
for item in os.listdir(SRC):
    if item == "data":
        continue
    s, d = os.path.join(SRC, item), os.path.join(DST, item)
    if os.path.isdir(d):
        shutil.rmtree(d)
    elif os.path.exists(d):
        os.remove(d)
    shutil.copytree(s, d) if os.path.isdir(s) else shutil.copy2(s, d)

# ---------------------------------------------------------------- 2) data pipeline
def p_build(t, f):
    t = sub(t, "Build compact game data for the Mecca 3D explorer", "Build compact game data for the Giza 3D explorer", f)
    t = sub(t, "ORIGIN_LAT, ORIGIN_LON = 21.4225, 39.8262",
            "ORIGIN_LAT, ORIGIN_LON = 29.97917, 31.13417  # Great Pyramid of Giza (29°58'45\"N 31°08'03\"E)", f)
    t = sub(t, 'UA = "mdm1-mecca3d/1.0 (+https://mdm1.org/mecca3d/)"', 'UA = "mdm1-giza3d/1.0 (+https://mdm1.org/giza3d/)"', f)
    t = sub(t, '"--south", type=float, default=21.375', '"--south", type=float, default=29.935', f)
    t = sub(t, '"--west", type=float, default=39.775', '"--west", type=float, default=31.085', f)
    t = sub(t, '"--north", type=float, default=21.465', '"--north", type=float, default=30.025', f)
    t = sub(t, '"--east", type=float, default=39.875', '"--east", type=float, default=31.185', f)
    t = sub(t, 'default="mecca3d/data"', 'default="giza3d/data"', f)
    t = sub(t, """q = f'[out:json][timeout:240];way["building"]({bb});out geom;'""",
            """q = f'[out:json][timeout:240];(way["building"]({bb});way["tomb"="pyramid"]({bb}););out geom;'""", f)
    t = sub(t, """        kind = 0
        bt = tags.get("building", "")
        if area > 20000 and (bt == "mosque" or "الحرام" in nm or "haram" in nm.lower()) and math.hypot(cx, cz) < 900:
            kind = 1  # Masjid al-Haram complex: rendered as open plaza, no collision
        out.append({"c": (cx, cz), "p": pts, "h": parse_height(tags), "k": kind})""",
            """        kind = 0
        h = parse_height(tags)
        if tags.get("building") == "pyramid" or tags.get("tomb") == "pyramid" or (tags.get("roof:shape") == "pyramidal" and area > 5000):
            if not h:
                try:
                    h = float(str(tags.get("roof:height", "0")).split()[0])
                except Exception:
                    h = 0.0
            if h > 0:
                kind = 2  # pyramid: drawn over its real OSM footprint, height from OSM tags
        out.append({"c": (cx, cz), "p": pts, "h": h, "k": kind})""", f)
    t = sub(t, """        out.append({"n": nm, "en": en, "k": landmark_kind(tags), "x": r1(x), "z": r1(z)})""",
            """        rec = {"n": nm, "en": en, "k": landmark_kind(tags), "x": r1(x), "z": r1(z)}
        if tags.get("wikipedia"):
            rec["w"] = tags["wikipedia"]  # e.g. "en:Great Pyramid of Giza" -> photo sign from Wikipedia at runtime
        out.append(rec)""", f)
    t = sub(t, """                f'nwr["natural"="peak"]["name"]({bb_str});'""",
            """                f'nwr["tomb"="pyramid"]["name"]({bb_str});'
                f'nwr["natural"="peak"]["name"]({bb_str});'""", f)
    return t


edit("tools/build_data.py", p_build)

# ---------------------------------------------------------------- 3) engine patches
PYRAMID_FN = r"""
// هرم مرسوم في OpenStreetMap (building=pyramid / tomb=pyramid): أوجه مثلثة فوق البصمة الحقيقية، القمة فوق المركز، الارتفاع من وسوم OSM
export function pyramidFaces(pts, base, apexY) {
  const n = pts.length / 2; let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += pts[i * 2]; cz += pts[i * 2 + 1]; }
  cx /= n; cz /= n;
  const pos = [], nor = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, x1 = pts[i * 2], z1 = pts[i * 2 + 1], x2 = pts[j * 2], z2 = pts[j * 2 + 1];
    const ux = x2 - x1, uy = 0, uz = z2 - z1, vx = cx - x1, vy = apexY - base, vz = cz - z1;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (nx * ((x1 + x2) / 2 - cx) + nz * ((z1 + z2) / 2 - cz) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    pos.push(x1, base, z1, x2, base, z2, cx, apexY, cz);
    for (let q = 0; q < 3; q++) nor.push(nx, ny, nz);
  }
  return { pos, nor };
}
"""

PYRAMID_BRANCH = """      if (b.k === 2) { // pyramid from OSM
        if (!(b.h > 0)) continue;
        const pf = pyramidFaces(pts, gmin - 0.5, gmin + clamp(b.h, 3, 620));
        c.set('#d2bf93');
        for (let q = 0; q < pf.pos.length / 3; q++) { const sh = 0.92 + hash2(minX + q, minZ) * 0.1; rp.push(pf.pos[q * 3], pf.pos[q * 3 + 1], pf.pos[q * 3 + 2]); rn.push(pf.nor[q * 3], pf.nor[q * 3 + 1], pf.nor[q * 3 + 2]); rc.push(c.r * sh, c.g * sh, c.b * sh); ri.push(rv + q); }
        rv += pf.pos.length / 3;
        colliders.push({ minX, maxX, minZ, maxZ, pts: Float32Array.from(pts) });
        continue;
      }
"""

FAMOUS_NEW = """export const FAMOUS = []; // يُملأ وقت التشغيل من معالم OpenStreetMap الحقيقية التي لها وسم wikipedia (لا قائمة مكتوبة يدوياً)
export function setFamous(lms) {
  FAMOUS.length = 0; const seen = new Set();
  const cand = (lms || []).filter((l) => l.w).map((l) => ({ l, d: Math.hypot(l.x, l.z) })).sort((a, b) => a.d - b.d);
  for (const { l, d } of cand) {
    if (FAMOUS.length >= 25 || seen.has(l.w)) continue; seen.add(l.w);
    const m = /^([a-z-]+):(.+)$/i.exec(l.w); if (!m) continue;
    const t = m[2].trim().replace(/ /g, '_'), lang = m[1].toLowerCase();
    FAMOUS.push({ id: FAMOUS.length === 0 && d < 300 ? 'pyramid' : 'w' + FAMOUS.length, n: l.n, x: l.x, z: l.z, wiki: lang === 'en' ? [t] : [], ar: lang === 'ar' ? [t] : [] });
  }
}"""


def p_world(t, f):
    t = rsub(t, r"  _buildLandmarks\(\) \{.*?this\.landmarkGroup = grp;\n  \}",
             "  _buildLandmarks() { // لا معالم مصنوعة يدوياً: كل شيء يأتي من بيانات OSM\n    this.landmarkGroup = new THREE.Group(); this.scene.add(this.landmarkGroup);\n  }", f, re.S)
    t = sub(t, "if (b.k !== 1) { //", "if (b.k !== 1 && b.k !== 2) { //", f)
    t = sub(t, "      let h = b.h;\n", PYRAMID_BRANCH + "      let h = b.h;\n", f)
    t = sub(t, "export class World {", PYRAMID_FN.strip("\n") + "\n\nexport class World {", f)
    t = rsub(t, r"export const FAMOUS = \[.*?\n\];", FAMOUS_NEW, f, re.S)
    return t


def p_main(t, f):
    t = sub(t, "// Mecca 3D explorer — orchestration.", "// Giza 3D explorer — orchestration (generated from the mecca3d engine by scripts/make_giza3d.py).", f)
    t = sub(t, "LandmarkPhotos, FAMOUS } from './world.js';", "LandmarkPhotos, FAMOUS, setFamous } from './world.js';", f)
    t = sub(t, "$('lb').value = f; });\n  $('lt').textContent = 'بناء العالم", "$('lb').value = f; });\n  setFamous(D.landmarks);\n  $('lt').textContent = 'بناء العالم", f)
    t = t.replace("'m3d_", "'g3d_")
    t = sub(t, "u.lang = 'ar-SA'", "u.lang = 'ar-EG'", f)
    t = sub(t, "Math.hypot(r.pts[k] - 150, r.pts[k + 1] - 350)", "Math.hypot(r.pts[k], r.pts[k + 1])", f)
    t = sub(t, "nav.route({ x: 0, z: 60 }, ", "nav.route({ x: 0, z: 0 }, ", f)
    t = sub(t, "teleport(0, 200); toast('🕋 الكعبة المشرفة');", "teleport(0, 0); toast('🔺 الهرم الأكبر');", f)
    t = sub(t, "x.key === 'lm:kaaba'", "x.key === 'lm:pyramid'", f)
    t = sub(t, " && f.id !== 'hira' && f.id !== 'haram'", "", f)
    t = sub(t, "'الكعبة ' + fmtDist(", "'الهرم الأكبر ' + fmtDist(", f)
    t = sub(t, "else if (k === 'k') openPanel('contrib'); ", "", f)
    return t


def p_learn(t, f):
    if "'m3d_" not in t:
        sys.exit("PATCH FAILED in " + f + ": no m3d_ keys")
    return t.replace("'m3d_", "'g3d_")


def p_contrib(t, f):
    t = sub(t, "  async init() {\n    try {", "  async init() {\n    this.failed = true; return false; // نسخة الجيزة: لا خدمة مساهمات بعد (جداول مكة لا تُستخدم)\n    try {", f)
    t = sub(t, "  async submit({ kind, body, x, z, street_key, street_name, file }) {\n",
            "  async submit({ kind, body, x, z, street_key, street_name, file }) {\n    return { error: 'المساهمات غير متاحة في نسخة الجيزة حالياً' };\n", f)
    return t


def p_ui(t, f):
    return sub(t, "    all.push({ d: Math.hypot(px, pz), cls: 'lm kaaba', txt: '🕋 الكعبة المشرفة', x: 0, z: 0, up: 30 });\n", "", f)


def p_data(t, f):
    return sub(t, "search.push({ type: 'landmark', name: 'الكعبة المشرفة', en: 'kaaba masjid al haram', nn: norm('الكعبة المشرفة المسجد الحرام الحرم'), ne: 'kaaba masjid al haram', x: 0, z: 40, kind: 'kaaba', key: 'lm:kaaba' });",
               "search.push({ type: 'landmark', name: 'الهرم الأكبر (هرم خوفو)', en: 'great pyramid of giza khufu cheops', nn: norm('الهرم الأكبر هرم خوفو الاهرامات الجيزة'), ne: 'great pyramid of giza khufu cheops', x: 0, z: 0, kind: 'pyramid', key: 'lm:pyramid' });", f)


edit("js/world.js", p_world)
edit("js/main.js", p_main)
edit("js/learn.js", p_learn)
edit("js/contrib.js", p_contrib)
edit("js/ui.js", p_ui)
edit("js/data.js", p_data)


def p_html(t, f):
    t = sub(t, "<title>مكة 3D — تجوّل حر وتعلّم الشوارع | MDM1</title>", "<title>الجيزة 3D — تجوّل حر عند الهرم الأكبر وتعلّم الشوارع | MDM1</title>", f)
    t = rsub(t, r'<meta name="description" content="[^"]*">',
             '<meta name="description" content="عالم ثلاثي الأبعاد مفتوح للجيزة وهرم خوفو من بيانات OpenStreetMap الحقيقية: قُد سيارة أو امشِ على قدميك، مع GPS وخريطة وتدريب لحفظ أسماء الشوارع والأحياء.">', f)
    t = sub(t, "📍 مسار من الكعبة إلى هنا", "📍 مسار من الهرم الأكبر إلى هنا", f)
    t = sub(t, '<button id="bm_kaaba">🕋 الكعبة</button>', '<button id="bm_kaaba">🔺 الهرم الأكبر</button>', f)
    t = sub(t, "<h1>🕋 مكة 3D</h1>", "<h1>🔺 الجيزة 3D</h1>", f)
    t = sub(t, "انتقال للكعبة", "انتقال للهرم الأكبر", f)
    t = sub(t, "شكل المباني تقريبي ومبني تلقائياً من الخريطة وليس تصويراً حقيقياً.",
            "شكل المباني تقريبي ومبني تلقائياً من الخريطة وليس تصويراً حقيقياً. الهرم يُرسم فوق بصمته وارتفاعه المسجّلين في OSM، والأرض مسطّحة عمداً.", f)
    t = sub(t, "</style>", "#b_contrib{display:none!important}\n#banner{display:none!important}\n</style>", f)
    return t


edit("index.html", p_html)
print("giza3d generated OK (code only; data comes from giza3d/tools/build_data.py)")
