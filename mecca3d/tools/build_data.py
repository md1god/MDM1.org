#!/usr/bin/env python3
"""Build compact game data for the Mecca 3D explorer from OpenStreetMap + terrain tiles.

Runs on GitHub Actions (see .github/workflows/mecca3d-data.yml). Output goes to mecca3d/data/:
  meta.json     bbox, origin, building cell index
  roads.json    named roads with junction ids (for GPS), local metres (x east, z south)
  places.json   neighbourhood / district nodes
  landmarks.json notable named features
  terrain.json  height grid (int16 decimetres, base64)
  b/{cx}_{cz}.json  building footprints per 500 m cell

Data (c) OpenStreetMap contributors (ODbL). Elevation: Terrarium tiles (SRTM/ASTER/etc., see Mapzen docs).
"""
import argparse, base64, io, json, math, os, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone

R = 6371008.8
ORIGIN_LAT, ORIGIN_LON = 21.4225, 39.8262
COS0 = math.cos(math.radians(ORIGIN_LAT))
CELL = 500.0
UA = "mdm1-mecca3d/1.0 (+https://mdm1.org/mecca3d/)"
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

HWY_TYPE = {
    "motorway": 0, "motorway_link": 0, "trunk": 1, "trunk_link": 1, "primary": 2, "primary_link": 2,
    "secondary": 3, "secondary_link": 3, "tertiary": 4, "tertiary_link": 4, "unclassified": 5,
    "residential": 6, "living_street": 6, "service": 7, "pedestrian": 8, "footway": 9, "path": 9,
    "steps": 9, "track": 9,
}
HWY_REGEX = "|".join(HWY_TYPE.keys())
PLACE_LEVEL = {"city": 0, "town": 0, "suburb": 1, "neighbourhood": 2, "quarter": 2, "village": 3, "hamlet": 3, "locality": 3}


def to_xz(lat, lon):
    x = math.radians(lon - ORIGIN_LON) * R * COS0
    z = -math.radians(lat - ORIGIN_LAT) * R
    return x, z


def to_latlon(x, z):
    lat = ORIGIN_LAT - math.degrees(z / R)
    lon = ORIGIN_LON + math.degrees(x / (R * COS0))
    return lat, lon


def r1(v):
    return round(v, 1)


def log(*a):
    print(*a, flush=True)


CACHE_DIR = os.environ.get("OVERPASS_CACHE")


def overpass(query, tries=int(os.environ.get("OVERPASS_TRIES", "8"))):
    last = None
    cpath = None
    if CACHE_DIR:
        import hashlib
        os.makedirs(CACHE_DIR, exist_ok=True)
        cpath = os.path.join(CACHE_DIR, hashlib.sha1(query.encode()).hexdigest() + ".json")
        if os.path.exists(cpath):
            try:
                with open(cpath) as f:
                    log("  (from cache)")
                    return json.load(f)
            except Exception:  # noqa
                pass
    for attempt in range(tries):
        ep = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            req = urllib.request.Request(ep, data=urllib.parse.urlencode({"data": query}).encode(),
                                         headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=300) as r:
                body = r.read()
            data = json.loads(body)
            if "remark" in data and not data.get("elements") and "error" in data.get("remark", "").lower():
                raise RuntimeError(data["remark"])
            if cpath:
                with open(cpath, "w") as f:
                    json.dump(data, f)
            return data
        except Exception as e:  # noqa
            last = e
            wait = min(90, 5 * (attempt + 1))
            log(f"  overpass attempt {attempt+1} failed on {ep}: {str(e)[:120]} -> retry in {wait}s")
            time.sleep(wait)
    raise SystemExit(f"Overpass failed repeatedly: {last}")


def tiles(s, w, n, e, step):
    lat = s
    while lat < n - 1e-9:
        lon = w
        while lon < e - 1e-9:
            yield (round(lat, 6), round(lon, 6), round(min(lat + step, n), 6), round(min(lon + step, e), 6))
            lon += step
        lat += step


def tag_name(tags):
    ar = tags.get("name:ar") or ""
    base = tags.get("name") or ""
    en = tags.get("name:en") or ""
    name = ar or base
    if not name and en:
        name = en
    if not en and base and ar and base != ar:
        en = base
    if not en and base and all(ord(c) < 0x250 for c in base):
        en = base
    return name.strip(), en.strip()


def parse_height(tags):
    h = tags.get("height") or tags.get("building:height")
    if h:
        try:
            return float(str(h).lower().replace("m", "").replace(",", ".").strip().split()[0])
        except Exception:
            pass
    lv = tags.get("building:levels")
    if lv:
        try:
            return float(str(lv).split(";")[0]) * 3.2 + 1.0
        except Exception:
            pass
    return 0.0


def poly_area(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % len(pts)]
        a += x1 * z2 - x2 * z1
    return abs(a) / 2.0


skipped = [0]


def fetch_ways(kind, bbox, step):
    """Yield unique way elements for a query kind across tiles."""
    seen = set()
    s, w, n, e = bbox
    for i, (ts, tw, tn, te) in enumerate(tiles(s, w, n, e, step)):
        bb = f"{ts},{tw},{tn},{te}"
        if kind == "roads":
            q = f'[out:json][timeout:240];way["highway"~"^({HWY_REGEX})$"]({bb});out geom;'
        else:
            q = f'[out:json][timeout:240];way["building"]({bb});out geom;'
        log(f"{kind} tile {i+1}: {bb}")
        try:
            data = overpass(q)
        except SystemExit as ex:
            if not os.environ.get("ALLOW_SKIP_TILES"):
                raise
            skipped[0] += 1
            log(f"   !! tile skipped: {ex}")
            continue
        added = 0
        for el in data.get("elements", []):
            if el.get("type") != "way" or el["id"] in seen:
                continue
            seen.add(el["id"])
            added += 1
            yield el
        log(f"   +{added} ways")
        time.sleep(2)


def build_roads(elements):
    names = {}
    name_list = []
    ways = []
    node_count = {}
    for el in elements:
        geom = el.get("geometry")
        nodes = el.get("nodes")
        if not geom or not nodes or len(geom) != len(nodes) or any(g is None for g in geom):
            continue
        tags = el.get("tags", {})
        hw = tags.get("highway")
        if hw not in HWY_TYPE:
            continue
        pts = [to_xz(g["lat"], g["lon"]) for g in geom]
        nds = list(nodes)
        oneway = 0
        ow = str(tags.get("oneway", "")).lower()
        if ow in ("yes", "true", "1"):
            oneway = 1
        elif ow == "-1":
            oneway = 1
            pts.reverse()
            nds.reverse()
        junction = tags.get("junction", "")
        rb = junction in ("roundabout", "circular")
        if rb and not ow:
            oneway = 1
        flags = 0
        br = tags.get("bridge", "no")
        tu = tags.get("tunnel", "no")
        if br not in ("no", ""):
            flags |= 1
        if tu not in ("no", "") and tu != "building_passage":
            flags |= 2
        if rb:
            flags |= 4
        lanes = 0
        try:
            lanes = int(str(tags.get("lanes", "0")).split(";")[0])
        except Exception:
            pass
        ms = 0
        try:
            ms = int(str(tags.get("maxspeed", "0")).split()[0])
        except Exception:
            pass
        nm, en = tag_name(tags)
        key = (nm, en)
        if nm or en:
            if key not in names:
                names[key] = len(name_list)
                name_list.append([nm, en])
            ni = names[key]
        else:
            ni = -1
        ways.append([ni, HWY_TYPE[hw], oneway, flags, lanes, ms, pts, nds])
        for k in set(nds):
            node_count[k] = node_count.get(k, 0) + 1
    gid = {}
    roads = []
    for ni, t, ow, fl, ln, ms, pts, nds in ways:
        j = []
        for idx, nid in enumerate(nds):
            if node_count.get(nid, 0) >= 2 or idx == 0 or idx == len(nds) - 1:
                if nid not in gid:
                    gid[nid] = len(gid)
                j += [idx, gid[nid]]
        flat = []
        for x, z in pts:
            flat += [r1(x), r1(z)]
        roads.append([ni, t, ow, fl, ln, ms, flat, j])
    return {"names": name_list, "roads": roads}


def build_buildings(elements):
    out = []
    for el in elements:
        geom = el.get("geometry")
        if not geom or any(g is None for g in geom) or len(geom) < 4:
            continue
        tags = el.get("tags", {})
        pts = [to_xz(g["lat"], g["lon"]) for g in geom]
        if pts[0] == pts[-1] or (abs(pts[0][0] - pts[-1][0]) < 0.05 and abs(pts[0][1] - pts[-1][1]) < 0.05):
            pts = pts[:-1]
        if len(pts) < 3:
            continue
        area = poly_area(pts)
        if area < 12:
            continue
        cx = sum(p[0] for p in pts) / len(pts)
        cz = sum(p[1] for p in pts) / len(pts)
        nm, _ = tag_name(tags)
        kind = 0
        bt = tags.get("building", "")
        if area > 20000 and (bt == "mosque" or "الحرام" in nm or "haram" in nm.lower()) and math.hypot(cx, cz) < 900:
            kind = 1  # Masjid al-Haram complex: rendered as open plaza, no collision
        out.append({"c": (cx, cz), "p": pts, "h": parse_height(tags), "k": kind})
    return out


def build_places(data):
    out = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        nm, en = tag_name(tags)
        if not nm:
            continue
        if "lat" in el:
            lat, lon = el["lat"], el["lon"]
        elif "center" in el:
            lat, lon = el["center"]["lat"], el["center"]["lon"]
        else:
            continue
        x, z = to_xz(lat, lon)
        out.append({"n": nm, "en": en, "t": PLACE_LEVEL.get(tags.get("place", ""), 3), "x": r1(x), "z": r1(z)})
    return out


def landmark_kind(tags):
    if tags.get("natural") == "peak":
        return "peak"
    if tags.get("tourism"):
        return "tourism"
    if tags.get("amenity") in ("hospital",):
        return "hospital"
    if tags.get("amenity") in ("university", "college"):
        return "edu"
    if tags.get("amenity") == "place_of_worship" or tags.get("building") == "mosque":
        return "mosque"
    if tags.get("railway") or tags.get("amenity") == "bus_station":
        return "transit"
    if tags.get("historic"):
        return "historic"
    return "poi"


def build_landmarks(data):
    out, seen = [], set()
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        nm, en = tag_name(tags)
        if not nm:
            continue
        if "lat" in el:
            lat, lon = el["lat"], el["lon"]
        elif "center" in el:
            lat, lon = el["center"]["lat"], el["center"]["lon"]
        else:
            continue
        x, z = to_xz(lat, lon)
        key = (nm, round(x / 30), round(z / 30))
        if key in seen:
            continue
        seen.add(key)
        out.append({"n": nm, "en": en, "k": landmark_kind(tags), "x": r1(x), "z": r1(z)})
    return out


def sample_terrain(X0, Z0, X1, Z1, step, flat):
    import numpy as np
    w = int(math.ceil((X1 - X0) / step)) + 1
    h = int(math.ceil((Z1 - Z0) / step)) + 1
    if flat:
        return w, h, np.full((h, w), 300.0, dtype=np.float32)
    from PIL import Image
    zoom = 13
    n = 2 ** zoom
    xs = X0 + np.arange(w) * step
    zs = Z0 + np.arange(h) * step
    lat = ORIGIN_LAT - np.degrees(zs / R)
    lon = ORIGIN_LON + np.degrees(xs / (R * COS0))
    xt = (lon + 180.0) / 360.0 * n
    yt = (1.0 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2.0 * n
    tx0, tx1 = int(np.floor(xt.min())) - 1, int(np.floor(xt.max())) + 1
    ty0, ty1 = int(np.floor(yt.min())) - 1, int(np.floor(yt.max())) + 1
    mosaic = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), dtype=np.float32)
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{tx}/{ty}.png"
            data = None
            for attempt in range(5):
                try:
                    req = urllib.request.Request(url, headers={"User-Agent": UA})
                    with urllib.request.urlopen(req, timeout=60) as r:
                        data = r.read()
                    break
                except Exception as e:  # noqa
                    log(f"  tile {url} failed: {e}")
                    time.sleep(3 * (attempt + 1))
            if data is None:
                raise SystemExit(f"terrain tile failed: {url}")
            img = np.array(Image.open(io.BytesIO(data)).convert("RGB")).astype(np.float32)
            elev = img[..., 0] * 256.0 + img[..., 1] + img[..., 2] / 256.0 - 32768.0
            oy, ox = (ty - ty0) * 256, (tx - tx0) * 256
            mosaic[oy:oy + 256, ox:ox + 256] = elev
    px = (xt - tx0) * 256.0 - 0.5
    py = (yt - ty0) * 256.0 - 0.5
    x0 = np.clip(np.floor(px).astype(int), 0, mosaic.shape[1] - 2)
    y0 = np.clip(np.floor(py).astype(int), 0, mosaic.shape[0] - 2)
    fx = np.clip(px - x0, 0, 1)[None, :]
    fy = np.clip(py - y0, 0, 1)[:, None]
    X0i, Y0i = x0[None, :], y0[:, None]
    a = mosaic[Y0i, X0i]
    b = mosaic[Y0i, X0i + 1]
    c = mosaic[Y0i + 1, X0i]
    d = mosaic[Y0i + 1, X0i + 1]
    grid = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
    # light 3x3 smoothing to remove DEM noise
    p = np.pad(grid, 1, mode="edge")
    grid = (p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] + p[1:-1, :-2] + p[1:-1, 1:-1] * 4 + p[1:-1, 2:] + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 12.0
    return w, h, grid.astype(np.float32)


BANNED = [(r"\s*و?السيسي\b|\s*و?السيسى", ""), (r"\s*(?:and\s+)?Al[- ]?Sisi\b|\s*Sisi\b|\s*El[- ]?Sisi\b", "")]


def clean_text(t):
    for pat, rep in BANNED:
        t = re.sub(pat, rep, t, flags=re.I)
    return t


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(clean_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":"))))
    log(f"wrote {path} ({os.path.getsize(path)/1024:.0f} KB)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--south", type=float, default=21.375)
    ap.add_argument("--west", type=float, default=39.775)
    ap.add_argument("--north", type=float, default=21.465)
    ap.add_argument("--east", type=float, default=39.875)
    ap.add_argument("--tile", type=float, default=0.03, help="query tile size in degrees")
    ap.add_argument("--out", default="mecca3d/data")
    ap.add_argument("--mock", help="directory with mock overpass JSON (roads.json, buildings.json, places.json, landmarks.json)")
    ap.add_argument("--flat-terrain", action="store_true")
    ap.add_argument("--terrain-step", type=float, default=25.0)
    a = ap.parse_args()
    bbox = (a.south, a.west, a.north, a.east)
    bb_str = f"{a.south},{a.west},{a.north},{a.east}"

    if a.mock:
        load = lambda n: json.load(open(os.path.join(a.mock, n), encoding="utf-8"))
        road_els = load("roads.json")["elements"]
        bld_els = load("buildings.json")["elements"]
        places_data = load("places.json")
        lm_data = load("landmarks.json")
    else:
        road_els = list(fetch_ways("roads", bbox, a.tile))
        bld_els = list(fetch_ways("buildings", bbox, a.tile))
        if skipped[0] and os.environ.get("SKIP_REPORT"):
            open(os.environ["SKIP_REPORT"], "w").write(str(skipped[0]))
        places_data = overpass(f'[out:json][timeout:240];nwr["place"~"^(city|town|village|suburb|neighbourhood|quarter|hamlet|locality)$"]["name"]({bb_str});out center;')
        lm_q = (f'[out:json][timeout:240];('
                f'nwr["name"]["wikidata"]({bb_str});'
                f'nwr["tourism"~"^(attraction|museum|viewpoint|zoo|theme_park)$"]["name"]({bb_str});'
                f'nwr["natural"="peak"]["name"]({bb_str});'
                f'nwr["amenity"~"^(hospital|university|college|bus_station|police|courthouse|townhall)$"]["name"]({bb_str});'
                f'nwr["railway"="station"]["name"]({bb_str});'
                f'nwr["historic"]["name"]({bb_str});'
                f');out center tags;')
        lm_data = overpass(lm_q)

    roads = build_roads(road_els)
    log(f"roads: {len(roads['roads'])} ways, {len(roads['names'])} names")
    blds = build_buildings(bld_els)
    log(f"buildings: {len(blds)}")
    places = build_places(places_data)
    lms = build_landmarks(lm_data)
    log(f"places: {len(places)}, landmarks: {len(lms)}")

    corners = [to_xz(a.south, a.west), to_xz(a.south, a.east), to_xz(a.north, a.west), to_xz(a.north, a.east)]
    X0 = min(c[0] for c in corners)
    X1 = max(c[0] for c in corners)
    Z0 = min(c[1] for c in corners)
    Z1 = max(c[1] for c in corners)
    X0, Z0 = math.floor(X0 / 100) * 100.0, math.floor(Z0 / 100) * 100.0
    X1, Z1 = math.ceil(X1 / 100) * 100.0, math.ceil(Z1 / 100) * 100.0

    # buildings -> cells
    cells = {}
    for b in blds:
        cx = int((b["c"][0] - X0) // CELL)
        cz = int((b["c"][1] - Z0) // CELL)
        flat = []
        for x, z in b["p"]:
            flat += [r1(x), r1(z)]
        rec = {"p": flat, "h": round(b["h"], 1)}
        if b["k"]:
            rec["k"] = b["k"]
        cells.setdefault(f"{cx}_{cz}", []).append(rec)
    out = a.out
    for k, v in cells.items():
        write_json(os.path.join(out, "b", f"{k}.json"), v)

    write_json(os.path.join(out, "roads.json"), roads)
    write_json(os.path.join(out, "places.json"), places)
    write_json(os.path.join(out, "landmarks.json"), lms)

    import numpy as np
    w, h, grid = sample_terrain(X0, Z0, X1, Z1, a.terrain_step, a.flat_terrain)
    q = np.round(grid * 10.0).astype("<i2")
    write_json(os.path.join(out, "terrain.json"), {
        "x0": X0, "z0": Z0, "step": a.terrain_step, "w": w, "h": h,
        "data": base64.b64encode(q.tobytes()).decode("ascii"), "scale": 10})

    write_json(os.path.join(out, "meta.json"), {
        "origin": {"lat": ORIGIN_LAT, "lon": ORIGIN_LON},
        "bbox": {"south": a.south, "west": a.west, "north": a.north, "east": a.east},
        "x0": X0, "x1": X1, "z0": Z0, "z1": Z1, "cell": CELL,
        "bcells": sorted(cells.keys()),
        "counts": {"roads": len(roads["roads"]), "streets": len(roads["names"]), "buildings": len(blds),
                   "places": len(places), "landmarks": len(lms)},
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "attribution": "Map data (c) OpenStreetMap contributors (ODbL). Terrain: Terrarium tiles.",
    })


if __name__ == "__main__":
    main()
