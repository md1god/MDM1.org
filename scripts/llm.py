#!/usr/bin/env python3
"""Shared LLM client for the repo's pipelines.

Order of attack:
  1. OpenCode Zen (OPENCODE_API_KEY, from the OPENCODE repository secret). Which models are FREE is decided live, every run, from the
     prices Zen itself publishes in GET /zen/v1/models (input and output cost both zero). No model name is hard-coded anywhere, so a
     model that is added, renamed or withdrawn needs no code change.
  2. OpenRouter (OPENROUTER_API_KEY, optional), only for models whose price is exactly zero.
  3. GitHub Models (GITHUB_TOKEN) as the last fallback, exactly as the repo did before.

chat(prompt, max_tokens, temperature, json_mode) -> text or None. Never raises. Prints ::warning:: / ::notice:: lines for the Actions log;
the ::notice:: line says which backend and model actually answered.
"""
import json, os, re, urllib.error, urllib.request

ZEN = os.environ.get("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1")
GH = "https://models.github.ai/inference/chat/completions"
OR = "https://openrouter.ai/api/v1"   # OpenAI-compatible; used only with OPENROUTER_API_KEY, and only for models priced at zero
GH_MODELS = ["openai/gpt-4.1", "openai/gpt-4.1-mini", "openai/gpt-4o"]
_cache = {"free": None, "dead": set(), "zen_off": False, "gh_off": False}   # zen_off: Zen answered a free-usage-limit 429; gh_off: GitHub Models is intercepted (see _call). Both skip that backend for the rest of the run
LAST = {"code": None, "backend": None}   # code: HTTP status of the most recent failed call (None after a success); backend: who answered last
REASONS = []   # one human-readable line per backend that failed this run; explain() joins them so a failed run says WHY

def _why(line):
    if line not in REASONS: REASONS.append(line)

def explain():
    """Why no backend answered, in plain words (for the Actions summary / Telegram report). Empty string if nothing failed."""
    return " | ".join(REASONS)


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


def or_free_models():
    """OpenRouter models whose prompt AND completion price is exactly zero (cached for the run)."""
    if "or" in _cache: return _cache["or"]
    ids = []
    if os.environ.get("OPENROUTER_API_KEY", "").strip():
        try:
            data = json.loads(_http(OR + "/models", headers={"Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"].strip()}, timeout=60))
            for m in data.get("data", []):
                p = m.get("pricing") or {}
                if str(p.get("prompt")) == "0" and str(p.get("completion")) == "0" and m.get("id"): ids.append(m["id"])
        except urllib.error.HTTPError as e: print("::warning::openrouter model list failed: HTTP", e.code)
        except Exception as e: print("::warning::openrouter model list failed:", type(e).__name__)
    _cache["or"] = ids
    return ids


def _extract(raw, who=""):
    try: return json.loads(raw)["choices"][0]["message"]["content"]
    except Exception:
        # a 200 that carries no usable text used to fail silently: say what came back instead
        print("::warning::%s no usable text in reply: %r" % (who or "reply", raw[:400]))
        return None


def _call(url, headers, model, prompt, max_tokens, temperature, json_mode):
    body = {"model": model, "temperature": temperature, "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
    if json_mode: body["response_format"] = {"type": "json_object"}
    try:
        raw = _http(url, body, headers)
        if url.startswith(GH) and raw.strip().upper() == "OK":
            # Seen on every run since 2026-11-09 (scripts/models_probe.py): even GET /catalog/models answers a bare text/plain "OK", so the
            # runner's network layer is answering instead of models.github.ai. Every model would get the same reply: stop asking.
            _cache["gh_off"] = True
            _why("GitHub Models unreachable from this runner (every request is answered with a plain-text 'OK', not JSON)")
            print("::warning::GitHub Models answered a bare 'OK' (not the API): this runner's network blocks it, skipping it for the rest of the run")
            return None
        txt = _extract(raw, model)
        if txt and txt.strip(): LAST["code"] = None
        return txt
    except urllib.error.HTTPError as e:
        LAST["code"] = e.code
        body = e.read()
        hdr = {k: v for k, v in e.headers.items() if re.search(r"retry|limit|opencode|request-id", k, re.I)} if e.code == 429 else ""
        print("::warning::", model, "HTTP", e.code, body[:600], hdr)
        if e.code == 429 and b"FreeUsageLimit" in body and url.startswith(ZEN):
            _cache["zen_off"] = True   # every free model will say the same
            try: wait = " (resets in about %.0f h)" % (int(e.headers.get("Retry-After", "")) / 3600)
            except Exception: wait = ""
            _why("OpenCode Zen free quota exhausted (HTTP 429 FreeUsageLimitError)" + wait)
        elif e.code in (401, 403) and url.startswith(ZEN): _why("OpenCode Zen refused the key (HTTP %d)" % e.code)
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
    if not key: _why("OPENCODE_API_KEY is empty (secret OPENCODE missing)")
    orkey = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not orkey: _why("OPENROUTER_API_KEY not provided (add the secret to enable a third backend)")
    if orkey:
        h = {"Authorization": "Bearer " + orkey, "Content-Type": "application/json"}
        for m in or_free_models()[:8]:
            for fmt in ((True, False) if json_mode else (False,)):
                txt = _call(OR + "/chat/completions", h, m, prompt, max_tokens, temperature, fmt)
                if txt and txt.strip(): LAST["backend"] = "openrouter:" + m; print("::notice::LLM answered via", LAST["backend"]); return txt
    tok = os.environ.get("GITHUB_TOKEN", "")
    if tok and not _cache["gh_off"]:
        h = {"Authorization": "Bearer " + tok, "Content-Type": "application/json", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        for m in GH_MODELS:
            if _cache["gh_off"]: break
            for fmt in ((True, False) if json_mode else (False,)):
                txt = _call(GH, h, m, prompt, max_tokens, temperature, fmt)
                if txt and txt.strip(): LAST["backend"] = "github:" + m; print("::notice::LLM answered via", LAST["backend"]); return txt
                if _cache["gh_off"]: break
    elif not tok: _why("GITHUB_TOKEN not provided")
    LAST["backend"] = None
    print("::warning::LLM: no backend produced an answer (zen key: %s, zen skipped for quota: %s, github token: %s). Why: %s" % (bool(key), _cache["zen_off"], bool(tok), explain() or "unknown"))
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
