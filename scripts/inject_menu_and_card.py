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
import posixpath
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARD = "https://mdm1.org/images/og-card.jpg"
HAS_MENU = re.compile(r'id=["\']mdm1m-btn["\']', re.I)
GENERIC_NAV_RULE = re.compile(r'(^|[};,\s>])nav\s*[{,]')


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


def transform(text: str, menu: dict[str, str]) -> str:
    # A bare, never-closed <nav> right before another <nav> swallows the whole page (and a fixed button with it).
    if len(re.findall(r"<nav\b", text, re.I)) > len(re.findall(r"</nav>", text, re.I)):
        text = re.sub(r"<nav>\s*(?=<nav\b)", "", text, count=1, flags=re.I)
    text, head_add = card_tags(text)
    add_menu = not HAS_MENU.search(text)
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
    pages = sorted(p for p in root.rglob("*.html") if ".git" not in p.parts and "node_modules" not in p.parts)
    added = carded = 0
    for p in pages:
        original = p.read_text(encoding="utf-8")
        try:
            new = transform(original, menu)
        except ValueError as exc:
            print(f"skip {p.relative_to(root)}: {exc}", file=sys.stderr)
            continue
        added += int(not HAS_MENU.search(original))
        carded += 1
        if args.write and new != original:
            p.write_text(new, encoding="utf-8")
    print(f"{'written' if args.write else 'dry-run'}: {len(pages)} pages, menu added to {added}, share card on {carded}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
