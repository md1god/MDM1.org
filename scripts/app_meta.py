"""Importance order + Pro (paid) marking for apps and tools. Data lives in data/app-meta.json (edit there only).

- ordered(items, kind): most important first; items without a rank get default_rank and keep newest-first order.
- badge(slug): small "Pro" chip for the listing cards.
- banner(slug): purchase box shown on a Pro app page (marker <!--pro-banner-->, idempotent).
Pro apps stay usable for a free trial in the browser; what is sold is the setup/customization package on the payment page.
"""
import json, os

_P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "app-meta.json")
MARK = "<!--pro-banner-->"


def _meta():
    try: return json.load(open(_P, encoding="utf-8"))
    except (OSError, ValueError): return {}


def ordered(items, kind="apps"):
    """items oldest-first (as stored). Returns them most important first; ties: newest first."""
    m = _meta(); r = m.get("rank", {}); d = m.get("default_rank", 40)
    key = (lambda s: r.get("tool:" + s, d)) if kind == "tools" else (lambda s: r.get(s, d))
    idx = {id(x): i for i, x in enumerate(items)}
    return sorted(items, key=lambda x: (-key(x["slug"]), -idx[id(x)]))


def is_pro(slug): return slug in set(_meta().get("pro", []))


def badge(slug):
    if not is_pro(slug): return ""
    return '<span style="display:inline-block;margin-inline-start:.5rem;padding:.05rem .55rem;border:1px solid rgba(224,166,64,.8);border-radius:999px;background:rgba(224,166,64,.12);color:#f0d08b;font-size:.72rem;font-weight:700;vertical-align:middle">Pro</span>'


def banner(slug, root_rel="../"):
    m = _meta()
    if slug not in set(m.get("pro", [])): return ""
    price = m.get("pro_price_usdt", 79)
    url = root_rel + m.get("pro_url", "pages/hub-services.html#quote-form")
    return (MARK + '<div class="card" style="margin-top:1rem;border:1px solid rgba(224,166,64,.6);background:rgba(224,166,64,.07)">'
            '<strong style="color:#f0d08b">Pro · نسخة مخصّصة لنشاطك</strong>'
            '<p style="margin:.4rem 0 .6rem;line-height:1.8">يمكنك تجربة التطبيق هنا مجانًا داخل المتصفح. إن أردته مُعدًّا لنشاطك (بياناتك وحقولك وتقاريرك وشعارك) مع تسليم وشرح ودعم، '
            f'نجهّزه لك بسعر {price} USDT للمشروع، والدفع بـUSDT على Polygon بعد تأكيد النطاق.</p>'
            f'<a href="{url}" class="glow-gold">اطلب النسخة المخصّصة ←</a></div>')
