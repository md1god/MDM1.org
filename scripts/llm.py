#!/usr/bin/env python3
"""Shared LLM client for the repo's pipelines.

Order of attack:
  1. OpenCode Zen (OPENCODE_API_KEY, from the OPENCODE repository secret). Which models are FREE is decided live, every run, from the
     prices Zen itself publishes in GET /zen/v1/models (input and output cost both zero). No model name is hard-coded anywhere, so a
     model that is added, renamed or withdrawn needs no code change.
  2. GitHub Models (GITHUB_TOKEN) as the fallback, exactly as the repo did before.

chat(prompt, max_tokens, temperature, json_mode) -> text or None. Never raises. Prints ::warning:: / ::notice:: lines for the Actions log;
the ::notice:: line says which backend and model actually answered.
"""
import json, os, re, urllib.error, urllib.request

ZEN = os.environ.get("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1")
GH = "https://models.github.ai/inference/chat/completions"
GH_MODELS = ["openai/gpt-4.1", "openai/gpt-4.1-mini", "openai/gpt-4o"]
_cache = {"free": None, "dead": set(), "zen_off": False}   # zen_off: Zen answered a free-usage-limit 429, skip Zen for the rest of this run
LAST = {"code": None, "backend": None}   # code: HTTP status of the most recent failed call (None after a success); backend: who answered last


def _http(url, body=None, headers=None, timeout=180):
    h = {"User-Agent": "mdm1-pipeline/1.0 (+https://mdm1.org)", **(headers or {})}   # a bare Python-urllib agent is blocked by some CDNs (403)
    req = urllib.request.Request(url, json.dumps(body).encode() if body is not None else None, h, method="POST" if body is not None else "GET")
    return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "replace")


def _nums(x):
    """Every number found inside a price value (plain numbers, numeric strings like '$0.00', nested dicts or lists)."""
    if isinstance(x, bool) or x is None: return []
    if isinstance(x, (int, float)): return [float(x)]
    if isinstance(x, str):
        try: return [float(x.strip().lstrip("$"))]
        except ValueError: return []
    if isinstance(x, dict): return [n for v in x.values() for n in _nums(v)]
    if isinstance(x, list): return [n for v in x for n in _nums(v)]
    return []


def is_free(m):
    """True when the catalogue entry itself says it costs nothing: input and output price both zero.
    Only when an entry carries no usable price at all do we fall back to the '-free' naming convention."""
    if not isinstance(m, dict) or not m.get("id"): return False
    c = m.get("cost")
    if isinstance(c, dict) and ("input" in c or "output" in c):
        n = [x for k in ("input", "output") if k in c for x in _nums(c[k])]
        return bool(n) and all(x == 0 for x in n)
    n = _nums(c)
    if n: return all(x == 0 for x in n)
    return str(m["id"]).endswith("-free")


def catalogue():
    """The raw model list from Zen (a list of dicts). Raises on HTTP/network errors."""
    key = os.environ.get("OPENCODE_API_KEY", "").strip()
    data = json.loads(_http(ZEN + "/models", headers={"Authorization": "Bearer " + key}, timeout=60))
    items = data.get("data", []) if isinstance(data, dict) else data
    return [m for m in items if isinstance(m, dict)]


def free_models():
    """Live list of free Zen model ids (cached for the run). Empty list when there is no key or the endpoint is unreachable."""
    if _cache["free"] is not None: return _cache["free"]
    ids = []
    if os.environ.get("OPENCODE_API_KEY", "").strip():
        try: ids = [m["id"] for m in catalogue() if is_free(m)]
        except urllib.error.HTTPError as e: print("::warning::zen model list failed: HTTP", e.code, e.read()[:200])
        except Exception as e: print("::warning::zen model list failed:", type(e).__name__, str(e)[:120])
    _cache["free"] = ids
    return ids


def _extract(raw):
    try: return json.loads(raw)["choices"][0]["message"]["content"]
    except Exception: return None


def _call(url, headers, model, prompt, max_tokens, temperature, json_mode):
    body = {"model": model, "temperature": temperature, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
    if json_mode: body["response_format"] = {"type": "json_object"}
    try:
        txt = _extract(_http(url, body, headers))
        if txt and txt.strip(): LAST["code"] = None
        return txt
    except urllib.error.HTTPError as e:
        LAST["code"] = e.code
        body = e.read()
        hdr = {k: v for k, v in e.headers.items() if re.search(r"retry|limit|opencode|request-id", k, re.I)} if e.code == 429 else ""
        print("::warning::", model, "HTTP", e.code, body[:600], hdr)
        if e.code == 429 and b"FreeUsageLimit" in body and url.startswith(ZEN): _cache["zen_off"] = True   # every free model will say the same
        if e.code in (401, 402, 403, 404): _cache["dead"].add(model)   # not free anymore / not allowed / gone: stop retrying it this run
        return None
    except Exception as e:
        print("::warning::", model, type(e).__name__, str(e)[:120]); return None


def chat(prompt, max_tokens=6000, temperature=0.4, json_mode=True):
    key = os.environ.get("OPENCODE_API_KEY", "").strip()
    if key and not _cache["zen_off"]:
        h = {"Authorization": "Bearer " + key, "Content-Type": "application/json"}
        for m in free_models():
            if m in _cache["dead"]: continue
            if _cache["zen_off"]: break
            for fmt in ((True, False) if json_mode else (False,)):   # some models reject response_format: retry without it
                txt = _call(ZEN + "/chat/completions", h, m, prompt, max_tokens, temperature, fmt)
                if txt and txt.strip(): LAST["backend"] = "zen:" + m; print("::notice::LLM answered via", LAST["backend"]); return txt
                if m in _cache["dead"] or _cache["zen_off"]: break
    tok = os.environ.get("GITHUB_TOKEN", "")
    if tok:
        h = {"Authorization": "Bearer " + tok, "Content-Type": "application/json", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        for m in GH_MODELS:
            for fmt in ((True, False) if json_mode else (False,)):
                txt = _call(GH, h, m, prompt, max_tokens, temperature, fmt)
                if txt and txt.strip(): LAST["backend"] = "github:" + m; print("::notice::LLM answered via", LAST["backend"]); return txt
    LAST["backend"] = None
    print("::warning::LLM: no backend produced an answer (zen key: %s, zen skipped for quota: %s, github token: %s)" % (bool(key), _cache["zen_off"], bool(tok)))
    return None


def chat_json(prompt, max_tokens=6000, temperature=0.4):
    """chat() then strip code fences and parse. Returns the parsed object or None."""
    txt = chat(prompt, max_tokens, temperature, True)
    if not txt: return None
    txt = re.sub(r"^```(?:json)?|```$", "", txt.strip()).strip()
    try: return json.loads(txt)
    except Exception:
        m = re.search(r"\{.*\}", txt, re.S)
        try: return json.loads(m.group(0)) if m else None
        except Exception: print("::warning::reply was not JSON, len=%d" % len(txt)); return None
