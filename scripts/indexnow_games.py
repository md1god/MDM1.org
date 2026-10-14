#!/usr/bin/env python3
"""One-off: tell Bing/Yandex (IndexNow) about the generated game pages, in batches of 10,000."""
import json, re, sys, urllib.request
KEY = "14aaa353c0894bc3f8a8e7855831190e"
xml = urllib.request.urlopen("https://mdm1.org/sitemap-games.xml", timeout=60).read().decode()
urls = re.findall(r"<loc>([^<]+)</loc>", xml)
print("urls", len(urls))
for i in range(0, len(urls), 10000):
    body = json.dumps({"host": "mdm1.org", "key": KEY, "keyLocation": f"https://mdm1.org/{KEY}.txt", "urlList": urls[i:i + 10000]}).encode()
    req = urllib.request.Request("https://api.indexnow.org/indexnow", body, {"Content-Type": "application/json"})
    try:
        print(i, urllib.request.urlopen(req, timeout=60).status)
    except Exception as e:
        print(i, "error", e); sys.exit(1)
