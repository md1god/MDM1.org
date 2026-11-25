#!/usr/bin/env python3
"""Download a Wikipedia lead image for each OSM landmark that has a `wikipedia` tag (selection/ids mirror setFamous() in giza3d/js/world.js).
Usage: landmark_photos_from_osm.py <data_dir> <out_dir>"""
import json, math, os, re, sys, urllib.parse, urllib.request
data, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
UA = {"User-Agent": "MDM1-giza3d/1.0 (https://mdm1.org; landmark thumbnails)"}
lms = json.load(open(os.path.join(data, "landmarks.json"), encoding="utf-8"))
cand = sorted(((math.hypot(l["x"], l["z"]), l) for l in lms if l.get("w")), key=lambda t: t[0])
seen, fam = set(), []
for d, l in cand:
    if len(fam) >= 25 or l["w"] in seen:
        continue
    seen.add(l["w"])
    m = re.match(r"^([a-z-]+):(.+)$", l["w"], re.I)
    if not m:
        continue
    fam.append(("pyramid" if not fam and d < 300 else f"w{len(fam)}", m.group(1).lower(), m.group(2).strip().replace(" ", "_"), l["n"]))
def get(url, binary=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        b = r.read(); return b if binary else json.loads(b)
ok = 0
for fid, lang, title, name in fam:
    try:
        j = get(f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title))
        src = (j.get("thumbnail") or {}).get("source")
        if not src:
            print("no thumbnail", fid, title); continue
        src = re.sub(r"/(\d+)px-", "/500px-", src)  # Wikimedia only serves standard thumbnail sizes
        open(os.path.join(out, fid + ".jpg"), "wb").write(get(src, True)); ok += 1
        print("ok", fid, lang, title)
    except Exception as e:
        print("failed", fid, title, e, file=sys.stderr)
print(f"photos: {ok}/{len(fam)}")
