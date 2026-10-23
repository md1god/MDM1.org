#!/usr/bin/env python3
"""Adds a crawlable 'related' block to every page in tools/ and apps/ (idempotent).

Run from the repo root: python3 scripts/related_links.py
Internal links between sibling pages are one of the cheapest ways to help search engines
discover and rank them. Each page links to its 5 closest siblings (by shared title words).
"""
import html
import os
import re
import sys

GROUPS = {
    "tools": ("أدوات أخرى قد تفيدك", "كل الأدوات"),
    "apps": ("تطبيقات أخرى قد تفيدك", "كل التطبيقات"),
}
START, END = "<!--related:start-->", "<!--related:end-->"
N = 5


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def meta(s):
    t = re.search(r"<title>([\s\S]*?)</title>", s)
    d = re.search(r'<meta name="description" content="([^"]*)"', s)
    title = html.unescape(t.group(1)).strip() if t else ""
    title = re.split(r"\s+[—|\-–]\s+", title)[0].strip()
    desc = html.unescape(d.group(1)).strip() if d else ""
    if len(desc) > 110:
        cut = desc[:109]
        desc = (cut[: cut.rfind(" ")] if cut.rfind(" ") > 60 else cut).rstrip("،,.: ") + "…"
    return title, desc


def words(title):
    return {w for w in re.findall(r"[؀-ۿa-zA-Z0-9]{3,}", title)}


def build(folder, label, all_label):
    files = sorted(f for f in os.listdir(folder) if f.endswith(".html") and f != "index.html")
    info = {}
    for f in files:
        title, desc = meta(read(os.path.join(folder, f)))
        info[f] = (title, desc, words(title))
    changed = 0
    for i, f in enumerate(files):
        title, _, w = info[f]
        scored = []
        for j, g in enumerate(files):
            if g == f:
                continue
            overlap = len(w & info[g][2])
            # أكبر تشابه أولاً، ثم أقرب ترتيب دائري حتى يتوزع الربط على كل الصفحات
            scored.append((-overlap, (j - i) % len(files), g))
        picks = [g for _, _, g in sorted(scored)[:N]]
        items = "".join(
            '<li style="margin:.5rem 0"><a href="%s" style="color:var(--gold-bright);font-weight:700">%s</a>'
            '<span style="opacity:.75"> — %s</span></li>'
            % (g, html.escape(info[g][0]), html.escape(info[g][1]))
            for g in picks
        )
        block = (
            f'{START}<section class="related" style="max-width:820px;margin:2.5rem auto;padding:0 1rem">'
            f'<h2 style="color:var(--gold-bright)">{label}</h2>'
            f'<ul style="list-style:none;padding:0;line-height:1.8">{items}</ul>'
            f'<p><a href="index.html" style="color:var(--gold-bright)">{all_label} ←</a></p></section>{END}\n'
        )
        path = os.path.join(folder, f)
        s = read(path)
        if START in s:
            s2 = re.sub(re.escape(START) + r"[\s\S]*?" + re.escape(END) + r"\n?", lambda m: block, s)
        else:
            s2 = s.replace('<footer class="page-footer">', block + '<footer class="page-footer">', 1)
        if s2 != s:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(s2)
            changed += 1
    return changed, len(files)


if __name__ == "__main__":
    total = 0
    for folder, (label, all_label) in GROUPS.items():
        if os.path.isdir(folder):
            c, n = build(folder, label, all_label)
            print(f"{folder}: {c}/{n} pages updated")
            total += c
    sys.exit(0)
