#!/usr/bin/env python3
"""Deploy-time generator: one static, indexable landing page per game (+ category pages + sitemap-games.xml).

12,000 games live in data/games.json but only in one JavaScript catalog, so search engines see none of them.
Each game gets /games/<id>-<slug>.html with a bilingual title/description, a click-to-play embed (the game's own
publisher embed URL), related games, JSON-LD and the site's AdSense tag. Files are generated in CI right before the
Pages artifact is uploaded and are NOT committed (keeps the repository small).

Run:  python3 scripts/build_game_pages.py
"""
from __future__ import annotations
import html
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "games"
BASE = "https://mdm1.org"
PER_CAT_PAGE = 120
E = lambda s: html.escape(str(s or ""), quote=True)


def slugify(t: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (t or "").lower()).strip("-")
    return s[:60] or "game"


def clean(t: str) -> str:
    return re.sub(r"\s+", " ", (t or "")).strip()


def page(title, desc, canon, body, ld=None, extra_head=""):
    ldj = f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>' if ld else ""
    return f'''<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{E(title)} | MDM1 Games</title>
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="{canon}">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{canon}">
<link rel="stylesheet" href="/css/global.css">
<link rel="stylesheet" href="/css/pages.css">
<style>.gm{{max-width:980px;margin:0 auto;padding:1rem}}.gm h1{{color:var(--gold-bright,#f0c060)}}
.gm .frame{{position:relative;width:100%;aspect-ratio:4/3;background:#000;border:1px solid var(--gold-dim,#8b6914);border-radius:12px;overflow:hidden}}
.gm .frame iframe{{position:absolute;inset:0;width:100%;height:100%;border:0}}
.gm .play{{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.8rem;cursor:pointer;background-size:cover;background-position:center;color:#fff;border:0;width:100%}}
.gm .play span{{background:linear-gradient(135deg,#c9a84c,#8b6914);color:#000;font-weight:700;border-radius:50px;padding:.8rem 2rem;font-size:1.1rem}}
.gm .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.8rem;margin-top:1rem}}
.gm .grid a{{display:block;text-decoration:none;color:var(--light,#eee);font-size:.85rem}}
.gm .grid img{{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;display:block}}
.gm .tags a{{display:inline-block;margin:.2rem;padding:.15rem .6rem;border:1px solid var(--gold-dim,#8b6914);border-radius:20px;font-size:.8rem;color:var(--gold,#c9a84c);text-decoration:none}}</style>
{ldj}{extra_head}
<meta name="google-adsense-account" content="ca-pub-8270783733461099">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8270783733461099" crossorigin="anonymous"></script>
</head>
<body>
<nav class="navbar">
  <a href="{BASE}/index.html" class="nav-logo">👁️ MDM1</a>
  <a href="{BASE}/games.html" class="nav-back">All games · كل الألعاب</a>
</nav>
<main class="gm">
{body}
</main>
<script src="/js/global.js"></script>
</body>
</html>
'''


def card(g, slug_of):
    return (f'<a href="/games/{slug_of[g["id"]]}.html"><img loading="lazy" src="{E(g["thumb"])}" alt="{E(clean(g["title"]))}">'
            f'{E(clean(g["title"]))}</a>')


def main() -> int:
    games = json.loads((ROOT / "data/games.json").read_text(encoding="utf-8"))
    famous = {str(g["id"]) for g in json.loads((ROOT / "data/famous_games.json").read_text(encoding="utf-8"))}
    games = [g for g in games if g.get("id") and g.get("title") and g.get("url") and g.get("thumb")]
    for g in games:
        g["id"] = str(g["id"])
    slug_of = {g["id"]: f'{g["id"]}-{slugify(g["title"])}' for g in games}
    by_cat = defaultdict(list)
    for g in games:
        by_cat[clean(g.get("category") or "Other")].append(g)
    OUT.mkdir(exist_ok=True)
    urls = []
    for g in games:
        title = clean(g["title"]).title() if clean(g["title"]).islower() else clean(g["title"])
        cat = clean(g.get("category") or "Other")
        tags = [t.strip() for t in (g.get("tags") or "").split(",") if t.strip()][:8]
        slug = slug_of[g["id"]]
        canon = f"{BASE}/games/{slug}.html"
        w, h = int(g.get("width") or 800), int(g.get("height") or 600)
        pool = [x for x in by_cat[cat] if x["id"] != g["id"]]
        start = (int(g["id"]) * 7919) % max(1, len(pool)) if pool else 0
        related = (pool[start:] + pool[:start])[:12]
        desc = (f"Play {title} free online in your browser - a {cat.lower()} game ({', '.join(tags[:4])}). "
                f"العب {title} مجانًا أونلاين بدون تحميل - لعبة {cat}.")[:300]
        body = f'''<h1>{E(title)} <small style="font-size:.5em;opacity:.8">— العب مجانًا / Play free</small></h1>
<div class="frame" id="fr"><button class="play" id="pl" style="background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url('{E(g["thumb"])}')" aria-label="Play {E(title)}"><span>▶ Play · ابدأ اللعب</span></button></div>
<p style="margin-top:1rem">{E(title)} is a free online {E(cat.lower())} game that runs in your browser on desktop and mobile - no download or sign-up needed.
لعبة <b>{E(cat)}</b> مجانية تعمل مباشرة من المتصفح على الكمبيوتر والجوال دون تحميل أو تسجيل.</p>
<div class="tags">{''.join(f'<a href="/games/category-{slugify(cat)}-1.html">{E(t)}</a>' for t in tags)}</div>
<h2>More {E(cat)} games · ألعاب مشابهة</h2>
<div class="grid">{''.join(card(x, slug_of) for x in related)}</div>
<script>document.getElementById('pl').onclick=function(){{var f=document.createElement('iframe');f.src={json.dumps(g["url"])};f.allow='fullscreen; autoplay; gamepad';f.setAttribute('allowfullscreen','');f.title={json.dumps(title)};f.loading='lazy';document.getElementById('fr').replaceChildren(f);}};</script>'''
        ld = {"@context": "https://schema.org", "@type": "VideoGame", "name": title, "url": canon, "image": g["thumb"],
              "genre": cat, "playMode": "SinglePlayer", "gamePlatform": "Web browser", "inLanguage": "en",
              "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}
        (OUT / f"{slug}.html").write_text(page(f"{title} - Play Free Online", desc, canon, body, ld), encoding="utf-8")
        urls.append(canon)
    hub = []
    for cat, items in sorted(by_cat.items()):
        pages = [items[i:i + PER_CAT_PAGE] for i in range(0, len(items), PER_CAT_PAGE)]
        for n, chunk in enumerate(pages, 1):
            canon = f"{BASE}/games/category-{slugify(cat)}-{n}.html"
            nav = " ".join(f'<a href="/games/category-{slugify(cat)}-{k}.html">{k}</a>' for k in range(1, len(pages) + 1))
            body = (f'<h1>{E(cat)} Games · ألعاب {E(cat)} مجانية</h1><p>{len(items)} free {E(cat.lower())} games to play online.</p>'
                    f'<div class="grid">{"".join(card(x, slug_of) for x in chunk)}</div><p style="margin-top:1rem">Pages: {nav}</p>')
            desc = f"Play {len(items)} free {cat.lower()} games online in your browser - العب أفضل ألعاب {cat} مجانًا."
            (OUT / f"category-{slugify(cat)}-{n}.html").write_text(page(f"Free {cat} Games (page {n})", desc, canon, body), encoding="utf-8")
            urls.append(canon)
        hub.append(f'<a href="/games/category-{slugify(cat)}-1.html">{E(cat)} ({len(items)})</a>')
    hub_body = ('<h1>All Free Online Games · كل الألعاب المجانية</h1><div class="tags">' + "".join(hub) + '</div>'
                '<h2>Popular · الأشهر</h2><div class="grid">' +
                "".join(card(g, slug_of) for g in games if g["id"] in famous)[:200000] + '</div>')
    (OUT / "index.html").write_text(page("Free Online Games", f"Play {len(games)} free browser games - no download. العب آلاف الألعاب المجانية.", f"{BASE}/games/", hub_body), encoding="utf-8")
    urls.insert(0, f"{BASE}/games/")
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sm += [f"<url><loc>{u}</loc></url>" for u in urls] + ["</urlset>"]
    (ROOT / "sitemap-games.xml").write_text("\n".join(sm), encoding="utf-8")
    robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
    if "sitemap-games.xml" not in robots:
        (ROOT / "robots.txt").write_text(robots.rstrip("\n") + f"\nSitemap: {BASE}/sitemap-games.xml\n", encoding="utf-8")
    print(f"game pages: {len(games)}, total urls: {len(urls)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
