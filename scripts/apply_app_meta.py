#!/usr/bin/env python3
"""Applies data/app-meta.json: re-orders apps/index.html and tools/index.html by importance, adds the Pro chip,
and puts the Pro purchase box on each Pro app page (idempotent). Run from the repo root: python3 scripts/apply_app_meta.py"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app_meta as M
import add_app
import trend_pages as T

BOX = re.compile(re.escape(M.MARK) + r'<div class="card".*?</a></div>', re.S)


def main():
    data = json.load(open("data/apps.json", encoding="utf-8"))
    add_app.write_index(data)
    T.write_tools_index(T.load())
    n = 0
    for a in data["apps"]:
        p = "apps/%s.html" % a["slug"]
        if not os.path.exists(p): continue
        h = open(p, encoding="utf-8").read()
        h2 = BOX.sub("", h)
        b = M.banner(a["slug"])
        if b:
            k = h2.find('<div class="divider"></div>')
            if k < 0: print("no divider, skipped", a["slug"]); continue
            h2 = h2[:k] + b + h2[k:]
        if h2 != h:
            open(p, "w", encoding="utf-8").write(h2); n += 1
    print("pro banners written/updated:", n)


if __name__ == "__main__":
    main()
