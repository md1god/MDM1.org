#!/usr/bin/env python3
"""Add the shared MDM1 visual shell to a deployment copy of every HTML page.

This is intentionally a build-time transform: it does not rewrite source pages in CI.
Run `python3 scripts/inject_global_shell.py --write` immediately before upload-pages-artifact.
"""
from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

SITE_ROOT = Path(__file__).resolve().parents[1]
MENU_LINKS = [
    ("/index.html", "🏠 الرئيسية", "🏠 Home"),
    ("/hub.html", "⛩️ المنصة", "⛩️ Platform"),
    ("/whitepaper.html", "📃 الورقة البيضاء", "📃 White paper"),
    ("/tools/seo/", "🔎 أدوات SEO", "🔎 SEO tools"),
    ("/tools/", "🧰 كل الأدوات", "🧰 All tools"),
    ("/pages/community.html", "🤝 المجتمع", "🤝 Community"),
    ("/pages/roadmap.html", "🗺️ خارطة الطريق", "🗺️ Roadmap"),
    ("/pages/faq.html", "❓ الأسئلة الشائعة", "❓ FAQ"),
    ("/games.html", "🎮 الألعاب", "🎮 Games"),
    ("/pages/index.html", "📚 كل الصفحات", "📚 All pages"),
    ("/pages/about.html", "ℹ️ من نحن", "ℹ️ About"),
]


class MarkupScan(HTMLParser):
    def __init__(self, text: str):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.lines = text.splitlines(keepends=True)
        self.line_offsets = [0]
        for line in self.lines:
            self.line_offsets.append(self.line_offsets[-1] + len(line))
        self.tags: list[dict] = []
        self.html_lang = ""
        self.feed(text)

    def _offset(self) -> int:
        line, col = self.getpos()
        return self.line_offsets[line - 1] + col

    def handle_starttag(self, tag: str, attrs):
        raw = self.get_starttag_text() or ""
        offset = self._offset()
        values = {key.lower(): value for key, value in attrs}
        if tag.lower() == "html":
            self.html_lang = values.get("lang") or ""
        self.tags.append({"tag": tag.lower(), "attrs": values, "start": offset, "raw": raw})

    def handle_startendtag(self, tag: str, attrs):
        self.handle_starttag(tag, attrs)


def _replace_attr(raw: str, name: str, value: str | None) -> str:
    pattern = re.compile(rf'(?<![\w:-]){re.escape(name)}\s*(?:=\s*(?:"[^"]*"|\'[^\']*\'|[^\s/>]+))?', re.I)
    if value is None:
        return pattern.sub("", raw)
    replacement = f'{name}="{value}"'
    if pattern.search(raw):
        return pattern.sub(replacement, raw, count=1)
    close = "/>" if raw.rstrip().endswith("/>") else ">"
    return raw[:raw.rfind(close)] + " " + replacement + raw[raw.rfind(close):]


def _attr(tag: dict, name: str) -> str:
    value = tag["attrs"].get(name)
    return "" if value is None else str(value)


def _find_close(text: str, tag: str, start: int) -> int:
    match = re.search(rf"</\s*{re.escape(tag)}\s*>", text[start:], re.I)
    if not match:
        raise ValueError(f"Missing closing </{tag}> after offset {start}")
    return start + match.end()


def _menu_markup(is_ar: bool) -> tuple[str, str]:
    button = '<button type="button" id="mdm1m-btn" title="القائمة" aria-label="فتح قائمة الموقع" aria-controls="mdm1m-panel" aria-expanded="false">🏛️</button>' if is_ar else '<button type="button" id="mdm1m-btn" title="Menu" aria-label="Open site menu" aria-controls="mdm1m-panel" aria-expanded="false">🏛️</button>'
    links = []
    for index, (href, ar, en) in enumerate(MENU_LINKS):
        if index == 3 or index == 5:
            links.append('<div class="mdm1m-sep" role="separator"></div>')
        links.append(f'<a href="{href}">{ar if is_ar else en}</a>')
    label = "قائمة الموقع" if is_ar else "Site navigation"
    panel = f'<nav id="mdm1m-panel" aria-label="{label}" aria-hidden="true">' + "".join(links) + "</nav>"
    return button, panel


def _music_markup(button_id: str, audio_id: str, is_ar: bool) -> tuple[str, str]:
    label = "تشغيل الموسيقى الخلفية" if is_ar else "Play background music"
    button = f'<button type="button" id="{button_id}" data-md1-audio-id="{audio_id}" title="{label}" aria-label="{label}" aria-pressed="false">♪</button>'
    audio = (f'<audio id="{audio_id}" loop preload="none">'
             '<source src="/audio/mdm1-theme.ogg" type="audio/ogg">'
             '<source src="/audio/mdm1-theme.mp3" type="audio/mpeg">'
             '</audio>')
    return button, audio


def _insert_before_body_end(text: str, addition: str) -> str:
    match = list(re.finditer(r"</\s*body\s*>", text, re.I))
    if match:
        pos = match[-1].start()
        return text[:pos] + addition + "\n" + text[pos:]
    return text + "\n" + addition + "\n"


def _ensure_head(text: str, root: Path) -> str:
    head_match = re.search(r"</\s*head\s*>", text, re.I)
    if not head_match:
        raise ValueError("HTML page has no closing </head>")
    head = text[:head_match.start()]
    additions: list[str] = []
    if 'href="/css/mdm1-site-controls.css"' not in head:
        additions.append('<link rel="stylesheet" href="/css/mdm1-site-controls.css">')
    icon_tags = [
        ('/images/android-chrome-192x192.png', '192x192'),
        ('/images/android-chrome-512x512.png', '512x512'),
    ]
    for href, size in icon_tags:
        local = root / href.lstrip("/")
        if not local.is_file():
            raise ValueError(f"Required Horus icon is missing: {local}")
        if href not in head:
            additions.append(f'<link rel="icon" type="image/png" sizes="{size}" href="{href}">')
    apple = root / "images/apple-touch-icon.png"
    if apple.is_file() and "/images/apple-touch-icon.png" not in head:
        additions.append('<link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">')
    if not re.search(r'<meta\b[^>]*property=["\']og:image["\']', head, re.I):
        additions.extend([
            '<meta property="og:image" content="https://mdm1.org/images/android-chrome-512x512.png">',
            '<meta property="og:image:alt" content="MDM1 Horus falcon emblem">',
            '<meta property="og:image:width" content="512">',
            '<meta property="og:image:height" content="512">',
        ])
    if not re.search(r'<meta\b[^>]*name=["\']twitter:card["\']', head, re.I):
        additions.append('<meta name="twitter:card" content="summary_large_image">')
    if not re.search(r'<meta\b[^>]*name=["\']twitter:image["\']', head, re.I):
        additions.append('<meta name="twitter:image" content="https://mdm1.org/images/android-chrome-512x512.png">')
    if not additions:
        return text
    return text[:head_match.start()] + "\n    " + "\n    ".join(additions) + "\n" + text[head_match.start():]


def transform_page(path: Path, root: Path) -> tuple[str, dict]:
    original = path.read_text(encoding="utf-8")
    # Deploy-copy repair: a bare, never-closed <nav> directly before another <nav> swallows the whole page
    # (and the floating menu button with it). Source files stay untouched.
    original_fixed = original
    if len(re.findall(r"<nav\b", original, re.I)) > len(re.findall(r"</nav>", original, re.I)):
        original_fixed = re.sub(r"<nav>\s*(?=<nav\b)", "", original, count=1, flags=re.I)
    text = _ensure_head(original_fixed, root)
    if path.relative_to(root).as_posix() == "tools/index.html" and 'mdm1-seo-card' not in text:
        seo_card = ('<div class="card mdm1-seo-card"><span class="card-icon">🔎</span>'
                    '<div class="card-title"><a href="/tools/seo/" class="glow-gold">أدوات SEO والنمو المجانية</a></div>'
                    '<div class="card-text">منشئ روابط UTM، معاينة الميتا، ومولّد robots.txt — أدوات عملية مجانية بالعربية والإنجليزية.</div></div>')
        grid = re.search(r'<div\b[^>]*class=["\'][^"\']*\bcard-grid\b[^"\']*["\'][^>]*>', text, re.I)
        if grid:
            text = text[:grid.end()] + seo_card + text[grid.end():]
        else:
            text = _insert_before_body_end(text, seo_card)
    scan = MarkupScan(text)
    is_ar = scan.html_lang.lower().startswith("ar") or not scan.html_lang.lower().startswith("en")

    by_id: dict[str, list[dict]] = {}
    for tag in scan.tags:
        element_id = tag["attrs"].get("id")
        if element_id:
            by_id.setdefault(str(element_id), []).append(tag)

    edits: list[tuple[int, int, str]] = []
    menu_button, menu_panel = _menu_markup(is_ar)
    existing_menu_buttons = by_id.get("mdm1m-btn", [])
    existing_panels = [t for t in by_id.get("mdm1m-panel", []) if t["tag"] == "nav"]
    if len(existing_menu_buttons) > 1 or len(existing_panels) > 1:
        raise ValueError("Duplicate global menu IDs")
    if existing_menu_buttons:
        t = existing_menu_buttons[0]
        end = _find_close(text, "button", t["start"] + len(t["raw"]))
        edits.append((t["start"], end, ""))  # re-added as a direct child of <body> (avoids transformed/hidden ancestors)
    if existing_panels:
        t = existing_panels[0]
        end = _find_close(text, "nav", t["start"] + len(t["raw"]))
        edits.append((t["start"], end, ""))

    music_button_ids = [key for key in ("music-btn", "musicBtn") if by_id.get(key)]
    button_id = music_button_ids[0] if music_button_ids else "music-btn"
    if len(music_button_ids) > 1:
        raise ValueError("More than one music control ID on a page")
    music_audios = [t for t in scan.tags if t["tag"] == "audio" and t["attrs"].get("id") in ("bg-music", "site-music")]
    # games.html has a game-specific bg-music track and a site-wide music player.
    preferred_audio = next((t for t in music_audios if t["attrs"].get("id") == "site-music"), None)
    if preferred_audio is None:
        preferred_audio = next((t for t in music_audios if t["attrs"].get("id") == "bg-music"), None)
    audio_id = str(preferred_audio["attrs"].get("id")) if preferred_audio else "bg-music"
    music_button, music_audio = _music_markup(button_id, audio_id, is_ar)
    if music_button_ids:
        t = by_id[button_id][0]
        end = _find_close(text, "button", t["start"] + len(t["raw"]))
        edits.append((t["start"], end, music_button))
    if preferred_audio:
        end = _find_close(text, "audio", preferred_audio["start"] + len(preferred_audio["raw"]))
        edits.append((preferred_audio["start"], end, music_audio))

    image_count = 0
    lazy_image_changes = 0
    video_changes = 0
    for t in scan.tags:
        if t["tag"] == "img":
            image_count += 1
            raw = t["raw"]
            src = _attr(t, "src").lower()
            klass = _attr(t, "class").lower()
            alt = _attr(t, "alt").lower()
            is_brand = any(word in src + " " + klass + " " + alt for word in ("logo", "icon", "hero", "avatar", "brand", "favicon", "mdm1", "horus", "falcon"))
            if not is_brand and image_count > 1:
                if "loading" not in t["attrs"]:
                    raw = _replace_attr(raw, "loading", "lazy")
                    lazy_image_changes += 1
                if "decoding" not in t["attrs"]:
                    raw = _replace_attr(raw, "decoding", "async")
            if raw != t["raw"]:
                edits.append((t["start"], t["start"] + len(t["raw"]), raw))
        elif t["tag"] == "video":
            raw = t["raw"]
            if "autoplay" in t["attrs"]:
                raw = _replace_attr(raw, "autoplay", None)
                raw = _replace_attr(raw, "data-mdm1-autoplay", "true")
                if "playsinline" not in t["attrs"]:
                    raw = _replace_attr(raw, "playsinline", "")
            if "preload" not in t["attrs"]:
                raw = _replace_attr(raw, "preload", "none")
            if raw != t["raw"]:
                edits.append((t["start"], t["start"] + len(t["raw"]), raw))
                video_changes += 1

    # Apply replacements against original offsets, latest first.
    for start, end, replacement in sorted(edits, key=lambda item: item[0], reverse=True):
        text = text[:start] + replacement + text[end:]

    # Elements that were not already present are added once, before </body>.
    additions: list[str] = []
    additions.append(menu_button)
    additions.append(menu_panel)
    if not music_button_ids:
        additions.append(music_button)
    if not preferred_audio:
        additions.append(music_audio)
    if additions:
        text = _insert_before_body_end(text, "\n".join(additions))

    # Include the shared controller in the deploy copy only; idempotent on repeated builds.
    if 'src="/js/mdm1-site-controls.js"' not in text:
        text = _insert_before_body_end(text, '<script defer src="/js/mdm1-site-controls.js"></script>')

    metadata_added = text != original
    stats = {
        "menu": bool(existing_menu_buttons or existing_panels),
        "music": True,
        "lazy_images": lazy_image_changes,
        "lazy_videos": video_changes,
        "changed": metadata_added,
    }
    return text, stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=SITE_ROOT, help="site root; use a temporary copy for tests")
    parser.add_argument("--write", action="store_true", help="write transformed HTML files")
    args = parser.parse_args()
    root = args.root.resolve()
    pages = sorted(p for p in root.rglob("*.html") if ".git" not in p.parts)
    if not pages:
        print("No HTML pages found", file=sys.stderr)
        return 1
    total_images = total_videos = menu_count = 0
    for path in pages:
        transformed, stats = transform_page(path, root)
        total_images += stats["lazy_images"]
        total_videos += stats["lazy_videos"]
        menu_count += int(stats["menu"])
        if args.write and transformed != path.read_text(encoding="utf-8"):
            path.write_text(transformed, encoding="utf-8")
    mode = "written" if args.write else "dry-run"
    print(f"{mode}: {len(pages)} HTML pages; {menu_count} already had a menu; {total_images} below-fold images marked lazy; {total_videos} videos deferred")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
