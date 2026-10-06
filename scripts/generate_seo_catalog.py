#!/usr/bin/env python3
"""Build the new SEO catalog and sitemap from pages under tools/seo only.

The generator intentionally never edits existing site pages outside tools/seo.
Run before the Pages upload and before the IndexNow notification.
"""
from __future__ import annotations

import argparse
import html
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEO = ROOT / "tools" / "seo"
SITE = "https://mdm1.org"
MARKERS = {
    "ar": ("<!-- SEO-CATALOG:AR:START -->", "<!-- SEO-CATALOG:AR:END -->"),
    "en": ("<!-- SEO-CATALOG:EN:START -->", "<!-- SEO-CATALOG:EN:END -->"),
}


class Metadata(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lang = ""
        self.canonical = ""
        self.description = ""
        self.title = ""
        self.h1 = ""
        self._capture: str | None = None
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang", "") or ""
        elif tag == "meta" and (a.get("name", "").lower() == "description"):
            self.description = a.get("content", "") or ""
        elif tag == "link" and "canonical" in (a.get("rel", "").lower().split()):
            self.canonical = a.get("href", "") or ""
        elif tag in ("title", "h1") and self._capture is None:
            self._capture = tag
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == self._capture:
            value = " ".join("".join(self._parts).split())
            if tag == "title":
                self.title = value
            else:
                self.h1 = value
            self._capture = None
            self._parts = []


def read_metadata(path: Path) -> Metadata:
    parser = Metadata()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def cards_for(language: str) -> list[str]:
    folder = SEO if language == "ar" else SEO / "en"
    pages = sorted(p for p in folder.glob("*.html") if p.name != "index.html")
    if not pages:
        raise ValueError(f"No SEO tool pages found for language {language}")
    cards: list[str] = []
    for page in pages:
        info = read_metadata(page)
        expected = f"{SITE}/{page.relative_to(ROOT).as_posix()}"
        if info.lang != language:
            raise ValueError(f"Unexpected lang={info.lang!r} in {page}")
        if info.canonical.rstrip("/") != expected.rstrip("/"):
            raise ValueError(f"Canonical must match this file exactly: {page}")
        if not info.description.strip():
            raise ValueError(f"Missing meta description in {page}")
        label = info.h1 or info.title
        if not label:
            raise ValueError(f"Missing title/heading in {page}")
        title = html.escape(label, quote=True)
        description = html.escape(info.description.strip(), quote=True)
        href = html.escape(page.name, quote=True)
        icon = "🔗" if "utm" in page.stem else "🔎" if "meta" in page.stem else "🧭" if "robots" in page.stem else "🧰"
        action = f"افتح {title} ←" if language == "ar" else f"Open {title} →"
        cards.append(
            f'<article class="seo-card"><span aria-hidden="true">{icon}</span>'
            f'<h2><a href="{href}">{title}</a></h2><p>{description}</p>'
            f'<a href="{href}">{action}</a></article>'
        )
    return cards


def update_index(language: str, cards: list[str]) -> str:
    path = SEO / "index.html" if language == "ar" else SEO / "en" / "index.html"
    source = path.read_text(encoding="utf-8")
    start, end = MARKERS[language]
    if source.count(start) != 1 or source.count(end) != 1:
        raise ValueError(f"Expected exactly one generated catalog marker pair in {path}")
    block = start + "\n" + "\n".join(cards) + "\n" + end
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    return pattern.sub(lambda _: block, source, count=1)


def make_sitemap() -> str:
    urls = [f"{SITE}/tools/seo/", f"{SITE}/tools/seo/en/"]
    for language, folder in (("ar", SEO), ("en", SEO / "en")):
        for page in sorted(p for p in folder.glob("*.html") if p.name != "index.html"):
            info = read_metadata(page)
            expected = f"{SITE}/{page.relative_to(ROOT).as_posix()}"
            if info.lang != language or info.canonical.rstrip("/") != expected.rstrip("/"):
                raise ValueError(f"Invalid language/canonical on {page}")
            urls.append(expected)
    root = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for url in urls:
        node = ET.SubElement(root, "url")
        ET.SubElement(node, "loc").text = url
    body = ET.tostring(root, encoding="unicode")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + body + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="fail if generated files are stale")
    mode.add_argument("--write", action="store_true", help="write generated outputs (the default)")
    args = parser.parse_args()
    outputs = {
        SEO / "index.html": update_index("ar", cards_for("ar")),
        SEO / "en" / "index.html": update_index("en", cards_for("en")),
        ROOT / "sitemap-seo.xml": make_sitemap(),
    }
    stale = [str(path.relative_to(ROOT)) for path, value in outputs.items()
             if not path.is_file() or path.read_text(encoding="utf-8") != value]
    if args.check:
        if stale:
            print("SEO catalog is stale: " + ", ".join(stale), file=sys.stderr)
            return 1
        print("SEO catalog and sitemap are up to date; legacy pages are outside the write set.")
        return 0
    for path, value in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value, encoding="utf-8")
    print(f"Generated {len(cards_for('ar')) + len(cards_for('en'))} tool cards and sitemap-seo.xml under tools/seo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
