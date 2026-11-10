#!/usr/bin/env python3
"""Deploy-time shell for every MDM1 page. Source files in the repository are never modified.

1. The floating menu button (CSS + button + link list + script) is copied *verbatim* from index.html
   and added to every page that does not already have its own `#mdm1m-btn`.
   The only change is that relative links in the list become root-absolute so they work from any folder.
2. The Horus share card (images/og-card.jpg, 1200x630) is set as og:image / twitter:image on every page.

Run in CI right before the Pages artifact is uploaded:  python3 scripts/inject_menu_and_card.py --write
"""
from __future__ import annotations

import argparse
import hashlib
import posixpath
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARD = "https://mdm1.org/images/og-card.jpg"
HAS_MENU = re.compile(r'id=["\']mdm1m-btn["\']', re.I)
HAS_MUSIC = re.compile(r'id=["\']bg-music["\']', re.I)
HAS_GLOBAL_JS = re.compile(r'js/global\.js', re.I)
PANEL_RE = re.compile(r'(<nav id="mdm1m-panel"[^>]*>)(.*?)(</nav>)', re.S | re.I)
DEFAULT_TRACK = "/audio/index.mp3"
MUSIC_CSS = ("<style>#music-btn{position:fixed;bottom:5rem;left:1.5rem;z-index:999;width:48px;height:48px;border-radius:50%;"
             "border:1px solid rgba(201,168,76,.5);background:rgba(0,0,0,.75);backdrop-filter:blur(8px);color:#c9a84c;"
             "font-size:1.3rem;cursor:pointer;align-items:center;justify-content:center}"
             "#music-btn.playing{border-color:rgba(201,168,76,.9);box-shadow:0 0 18px rgba(201,168,76,.35)}</style>")
MUSIC_HTML = ('<audio id="bg-music" loop preload="none"><source src="' + DEFAULT_TRACK + '" type="audio/mpeg"></audio>\n'
              '<button id="music-btn" title="تشغيل / إيقاف الموسيقى" style="display:none">🔇</button>\n')
GENERIC_NAV_RULE = re.compile(r'(^|[};,\s>])nav\s*[{,]')
HAS_3D = re.compile(r'js/mdm1-3d\.js', re.I)


def asset_version(root: Path, rel: str) -> str:
    """Short content hash so browsers never keep a stale copy of the 3D layer."""
    f = root / rel
    return hashlib.sha1(f.read_bytes()).hexdigest()[:8] if f.is_file() else "0"


def extract_homepage_menu(root: Path) -> dict[str, str]:
    src = (root / "index.html").read_text(encoding="utf-8")
    style = re.search(r"<style>\s*#mdm1m-btn\{.*?</style>", src, re.S)
    button = re.search(r'<button id="mdm1m-btn".*?</button>', src, re.S)
    panel = re.search(r'<nav id="mdm1m-panel">(.*?)</nav>', src, re.S)
    script = re.search(r"<script>\s*\(function\(\)\{\s*var mBtn = document\.getElementById\('mdm1m-btn'\);.*?</script>", src, re.S)
    missing = [n for n, m in (("style", style), ("button", button), ("panel", panel), ("script", script)) if not m]
    if missing:
        raise SystemExit(f"index.html menu pieces not found: {', '.join(missing)}")
    return {"style": style.group(0), "button": button.group(0), "panel_inner": panel.group(1), "script": script.group(0)}


def absolutize(inner: str) -> str:
    def fix(m: re.Match) -> str:
        href = m.group(2)
        if re.match(r"^(?:[a-z][a-z0-9+.-]*:|/|#|\?)", href, re.I):
            return m.group(0)
        return f'{m.group(1)}{posixpath.normpath("/" + href)}{m.group(3)}'
    return re.sub(r'(<a\b[^>]*?\bhref=")([^"]*)(")', fix, inner, flags=re.I)


def card_tags(text: str) -> tuple[str, list[str]]:
    for pat in (r'<meta\b[^>]*property=["\']og:image(?::[a-z_]+)?["\'][^>]*>[ \t]*\n?',
                r'<meta\b[^>]*name=["\']twitter:image(?::alt)?["\'][^>]*>[ \t]*\n?'):
        text = re.sub(pat, "", text, flags=re.I)
    tags = [
        f'<meta property="og:image" content="{CARD}">',
        '<meta property="og:image:type" content="image/jpeg">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="MDM1.org - Eye of Horus hooded emblem">',
        f'<meta name="twitter:image" content="{CARD}">',
    ]
    if not re.search(r'<meta\b[^>]*name=["\']twitter:card["\']', text, re.I):
        tags.append('<meta name="twitter:card" content="summary_large_image">')
    if not re.search(r'<meta\b[^>]*property=["\']og:site_name["\']', text, re.I):
        tags.append('<meta property="og:site_name" content="MDM1.org">')
    return text, tags


def transform(text: str, menu: dict[str, str], v3d: tuple[str, str] | None = None) -> str:
    # A bare, never-closed <nav> right before another <nav> swallows the whole page (and a fixed button with it).
    if len(re.findall(r"<nav\b", text, re.I)) > len(re.findall(r"</nav>", text, re.I)):
        text = re.sub(r"<nav>\s*(?=<nav\b)", "", text, count=1, flags=re.I)
    text, head_add = card_tags(text)
    add_menu = not HAS_MENU.search(text)
    if not add_menu:   # صفحة لها قائمتها: نوحّد روابطها مع قائمة الرئيسية الحالية
        canon = absolutize(menu["panel_inner"])
        text = PANEL_RE.sub(lambda m: m.group(1) + canon + m.group(3), text, count=1)
    if add_menu:
        head_add.append(menu["style"])
    heads = list(re.finditer(r"</\s*head\s*>", text, re.I))
    bodies = list(re.finditer(r"</\s*body\s*>", text, re.I))
    if not heads or not bodies:
        raise ValueError("no </head> or </body>")
    body_pos = bodies[-1].start()
    if add_menu:
        tag = "div" if GENERIC_NAV_RULE.search(text) else "nav"   # identical look; avoids page-level `nav{}` rules
        role = ' role="navigation"' if tag == "div" else ""
        block = (menu["button"] + "\n" + f'<{tag} id="mdm1m-panel"{role}>' + absolutize(menu["panel_inner"]) + f"</{tag}>\n" + menu["script"] + "\n")
        text = text[:body_pos] + block + text[body_pos:]
    add_music = not HAS_MUSIC.search(text)
    if add_music:   # موسيقى الخلفية كباقي الموقع (global.js يتولى التشغيل والاختيار المحفوظ)
        pos = list(re.finditer(r"</\s*body\s*>", text, re.I))[-1].start()
        extra = MUSIC_HTML + ('' if HAS_GLOBAL_JS.search(text) else '<script src="/js/global.js"></script>\n')
        text = text[:pos] + extra + text[pos:]
        head_add.append(MUSIC_CSS)
    if "js/lang.js" not in text:      # site-wide world-language picker (also extends pages that have their own #lang-select)
        pos = list(re.finditer(r"</\s*body\s*>", text, re.I))[-1].start()
        text = text[:pos] + '<script src="/js/lang.js" defer></script>\n' + text[pos:]
    if v3d and not HAS_3D.search(text):   # interactive 3D layer: ambient galaxy, gateways, card tilt (see scripts/3d/)
        pos = list(re.finditer(r"</\s*body\s*>", text, re.I))[-1].start()
        text = text[:pos] + f'<script type="module" src="/js/mdm1-3d.js?v={v3d[0]}"></script>\n' + text[pos:]
        head_add.append(f'<link rel="stylesheet" href="/css/mdm1-3d.css?v={v3d[1]}">')
    head_pos = list(re.finditer(r"</\s*head\s*>", text, re.I))[0].start()
    return text[:head_pos] + "\n    " + "\n    ".join(head_add) + "\n" + text[head_pos:]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=ROOT)
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
    root = args.root.resolve()
    if not (root / "images/og-card.jpg").is_file():
        raise SystemExit("images/og-card.jpg is missing")
    menu = extract_homepage_menu(root)
    v3d = None
    if (root / "js/mdm1-3d.js").is_file() and (root / "css/mdm1-3d.css").is_file():
        v3d = (asset_version(root, "js/mdm1-3d.js"), asset_version(root, "css/mdm1-3d.css"))
    pages = sorted(p for p in root.rglob("*.html") if ".git" not in p.parts and "node_modules" not in p.parts)
    added = carded = 0
    for p in pages:
        original = p.read_text(encoding="utf-8")
        try:
            new = transform(original, menu, v3d)
        except ValueError as exc:
            print(f"skip {p.relative_to(root)}: {exc}", file=sys.stderr)
            continue
        added += int(not HAS_MENU.search(original))
        carded += 1
        if args.write and new != original:
            p.write_text(new, encoding="utf-8")
    print(f"{'written' if args.write else 'dry-run'}: {len(pages)} pages, menu added to {added}, share card on {carded}, 3D layer {'on' if v3d else 'skipped (bundle missing)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
