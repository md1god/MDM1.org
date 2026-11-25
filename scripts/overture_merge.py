#!/usr/bin/env python3
"""Merge Overture Maps building footprints/heights into an existing mecca3d/giza3d data folder.

Usage: overture_merge.py <data_dir> [--geojsonseq FILE]   (without --geojsonseq the `overturemaps` CLI downloads it)
  1. OSM buildings with no height get the height of the Overture building that overlaps them most.
  2. Overture buildings that do NOT overlap any OSM building (covered < 25% by OSM) are added.
Data (c) OpenStreetMap contributors (ODbL); Overture Maps Foundation (ODbL / CDLA, per source dataset).
"""
import argparse, glob, json, math, os, subprocess, sys
from shapely.geometry import Polygon, shape
from shapely.strtree import STRtree

R = 6371008.8
MIN_AREA = 30.0  # m^2: skip tiny sheds/noise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    ap.add_argument("--geojsonseq")
    ap.add_argument("--max-add", type=int, default=60000)
    a = ap.parse_args()
    meta = json.load(open(os.path.join(a.data, "meta.json"), encoding="utf-8"))
    lat0, lon0 = meta["origin"]["lat"], meta["origin"]["lon"]
    cos0 = math.cos(math.radians(lat0))
    bb = meta["bbox"]
    X0, Z0, CELL = meta["x0"], meta["z0"], meta["cell"]

    def to_xz(lon, lat):
        return (math.radians(lon - lon0) * R * cos0, -math.radians(lat - lat0) * R)

    src = a.geojsonseq
    if not src:
        src = os.path.join(a.data, "_overture.geojsonseq")
        subprocess.run([os.path.join(os.path.dirname(sys.executable), "overturemaps"), "download", f"--bbox={bb['west']},{bb['south']},{bb['east']},{bb['north']}",
                        "-f", "geojsonseq", "--type=building", "-o", src], check=True)

    # ---- existing OSM buildings
    osm = []  # (polygon, rec, cellfile)
    for f in sorted(glob.glob(os.path.join(a.data, "b", "*.json"))):
        for rec in json.load(open(f, encoding="utf-8")):
            p = rec["p"]
            pts = [(p[i], p[i + 1]) for i in range(0, len(p), 2)]
            if len(pts) < 3:
                continue
            poly = Polygon(pts)
            if not poly.is_valid:
                poly = poly.buffer(0)
            osm.append((poly, rec))
    print(f"existing buildings: {len(osm)}", flush=True)

    # ---- Overture buildings
    ov = []  # (polygon, height)
    with open(src, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip().lstrip("\x1e")
            if not line:
                continue
            try:
                ft = json.loads(line)
                if ft.get("type") == "FeatureCollection":
                    feats = ft["features"]
                else:
                    feats = [ft]
            except Exception:
                continue
            for ft in feats:
                pr = ft.get("properties") or {}
                h = pr.get("height")
                try:
                    h = float(h) if h is not None else 0.0
                except Exception:
                    h = 0.0
                if not h:
                    nf = pr.get("num_floors")
                    try:
                        h = float(nf) * 3.2 + 1.0 if nf else 0.0
                    except Exception:
                        h = 0.0
                try:
                    g = shape(ft["geometry"])
                except Exception:
                    continue
                geoms = list(g.geoms) if g.geom_type == "MultiPolygon" else [g] if g.geom_type == "Polygon" else []
                for pg in geoms:
                    ext = [to_xz(x, y) for x, y in pg.exterior.coords]
                    poly = Polygon(ext)
                    if not poly.is_valid:
                        poly = poly.buffer(0)
                    if poly.is_empty or poly.geom_type != "Polygon" or poly.area < MIN_AREA:
                        continue
                    ov.append((poly, h))
    print(f"overture buildings: {len(ov)} (with height: {sum(1 for _, h in ov if h > 0)})", flush=True)
    if not ov:
        sys.exit("no Overture buildings read; leaving data untouched")

    # ---- 1) heights for OSM buildings that lack one
    tree_ov = STRtree([p for p, _ in ov])
    enhanced = 0
    for poly, rec in osm:
        if rec.get("h", 0) > 0 or rec.get("k"):
            continue
        best, bh = 0.0, 0.0
        for i in tree_ov.query(poly):
            op, oh = ov[int(i)]
            if oh <= 0:
                continue
            ar = poly.intersection(op).area
            if ar > best:
                best, bh = ar, oh
        if best > 0.3 * poly.area:
            rec["h"] = round(bh, 1); enhanced += 1
    print(f"OSM buildings given an Overture height: {enhanced}", flush=True)

    # ---- 2) add Overture buildings not already covered by OSM
    tree_osm = STRtree([p for p, _ in osm])
    added = []
    for poly, h in ov:
        cov = 0.0
        for i in tree_osm.query(poly):
            cov += poly.intersection(osm[int(i)][0]).area
            if cov > 0.25 * poly.area:
                break
        if cov > 0.25 * poly.area:
            continue
        added.append((poly, h))
        if len(added) >= a.max_add:
            break
    print(f"Overture buildings added: {len(added)}", flush=True)

    # ---- write cells back
    cells = {}
    for poly, rec in osm:
        c = poly.centroid
        cells.setdefault(f"{int((c.x - X0) // CELL)}_{int((c.y - Z0) // CELL)}", []).append(rec)
    for poly, h in added:
        pts = list(poly.exterior.coords)[:-1]
        if len(pts) < 3:
            continue
        flat = []
        for x, z in pts:
            flat += [round(x, 1), round(z, 1)]
        c = poly.centroid
        cells.setdefault(f"{int((c.x - X0) // CELL)}_{int((c.y - Z0) // CELL)}", []).append({"p": flat, "h": round(h, 1)})
    for f in glob.glob(os.path.join(a.data, "b", "*.json")):
        os.remove(f)
    for k, v in cells.items():
        with open(os.path.join(a.data, "b", k + ".json"), "w", encoding="utf-8") as fh:
            json.dump(v, fh, ensure_ascii=False, separators=(",", ":"))
    meta["bcells"] = sorted(cells.keys())
    meta["counts"]["buildings"] = sum(len(v) for v in cells.values())
    meta["attribution"] = meta.get("attribution", "") + " Buildings: also Overture Maps Foundation."
    with open(os.path.join(a.data, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, separators=(",", ":"))
    if not a.geojsonseq and os.path.exists(src):
        os.remove(src)
    print("done: total buildings", meta["counts"]["buildings"])


if __name__ == "__main__":
    main()
