#!/usr/bin/env python3
"""Submit published sitemap URLs to IndexNow providers such as Bing and Yandex."""
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
KEY = 'mdm1-indexnow-2026'
sitemaps = sorted(ROOT.glob('sitemap*.xml'))
urls = []
for path in sitemaps:
    text = path.read_text(encoding='utf-8', errors='ignore')
    urls.extend(re.findall(r'<loc>(https://mdm1\.org/[^<]+)</loc>', text))
urls = sorted(set(urls))
if not urls:
    raise SystemExit('No MDM1 URLs found in sitemaps')
for start in range(0, len(urls), 10000):
    batch = urls[start:start + 10000]
    payload = json.dumps({
        'host': 'mdm1.org',
        'key': KEY,
        'keyLocation': f'https://mdm1.org/{KEY}.txt',
        'urlList': batch,
    }).encode()
    request = urllib.request.Request(
        'https://api.indexnow.org/indexnow',
        data=payload,
        headers={'Content-Type': 'application/json; charset=utf-8'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print(f'IndexNow batch {start // 10000 + 1}: HTTP {response.status}, URLs {len(batch)}')
    except Exception as exc:
        print(f'IndexNow batch {start // 10000 + 1} failed: {exc}')
print(f'Prepared {len(urls)} unique URLs from {len(sitemaps)} sitemaps')
