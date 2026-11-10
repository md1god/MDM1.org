#!/usr/bin/env python3
"""Shared LLM client for the repo's pipelines.

Order of attack:
  1. OpenCode Zen (OPENCODE_API_KEY, set by the OIDC sign-in step in the workflow). The list of FREE models is read live from
     GET /zen/v1/models every run (free ids are promotional and change), so nothing here is hard-coded to a model that may vanish.
  2. GitHub Models (GITHUB_TOKEN) as the fallback, exactly as the repo did before.

chat(prompt, max_tokens, temperature, json_mode) -> text or None. Never raises. Prints ::warning:: lines for the Actions log.
"""
import json, os, re, urllib.error, urllib.request

ZEN = os.environ.get("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1")
GH = "https://models.github.ai/inference/chat/completions"
GH_MODELS = ["openai/gpt-4.1", "openai/gpt-4.1-mini", "openai/gpt-4o"]
# Free ids on Zen end with -free; big-pickle is the one free model without the suffix. Anything else is never called (it may bill).
FREE_PAT = re.compile(r"(-free$)|(^big-pickle$)")
PREFER = ("deepseek", "minimax", "qwen", "nemotron", "mimo", "glm", "big-pickle")   # soft order only; unknown free ids still get tried
_cache = {"free": None, "dead": set()}
LAST = {"code": None}   # HTTP status of the most recent failed call; None after a success (lets callers detect 429 and stop early)


def _http(url, body=None, headers=None, timeout=180):
    h = {"User-Agent": "mdm1-pipeline/1.0 (+https://mdm1.org)", **(headers or {})}   # a bare Python-urllib agent is blocked by some CDNs (403)
    req = urllib.request.Request(url, json.dumps(body).encode() if body is not None else None, h, method="POST" if body is not None else "GET")
    return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "replace")


def free_models():
    """Live list of free Zen model ids (cached for the run). Empty list when there is no key or the endpoint is unreachable."""
    if _cache["free"] is not None: return _cache["free"]
    key, ids = os.environ.get("OPENCODE_API_KEY", ""), []
    if key:
        try:
            data = json.loads(_http(ZEN + "/models", headers={"Authorization": "Bearer " + key}, timeout=60))
            ids = [m.get("id", "") for m in data.get("data", data if isinstance(data, list) else [])]
            ids = [i for i in ids if FREE_PAT.search(i)]
            ids.sort(key=lambda i: next((n for n, p in enumerate(PREFER) if p in i), len(PREFER)))
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
        print("::warning::", model, "HTTP", e.code, e.read()[:200])
        if e.code in (401, 402, 403, 404): _cache["dead"].add(model)   # not free anymore / not allowed / gone: stop retrying it this run
        return None
    except Exception as e:
        print("::warning::", model, type(e).__name__, str(e)[:120]); return None


def chat(prompt, max_tokens=6000, temperature=0.4, json_mode=True):
    key = os.environ.get("OPENCODE_API_KEY", "")
    if key:
        h = {"Authorization": "Bearer " + key, "Content-Type": "application/json"}
        for m in free_models():
            if m in _cache["dead"]: continue
            for fmt in ((True, False) if json_mode else (False,)):   # some models reject response_format: retry without it
                txt = _call(ZEN + "/chat/completions", h, m, prompt, max_tokens, temperature, fmt)
                if txt and txt.strip(): return txt
                if m in _cache["dead"]: break
    tok = os.environ.get("GITHUB_TOKEN", "")
    if tok:
        h = {"Authorization": "Bearer " + tok, "Content-Type": "application/json", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        for m in GH_MODELS:
            for fmt in ((True, False) if json_mode else (False,)):
                txt = _call(GH, h, m, prompt, max_tokens, temperature, fmt)
                if txt and txt.strip(): return txt
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
