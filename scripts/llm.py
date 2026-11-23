#!/usr/bin/env python3
"""Shared LLM client for the repo's pipelines.

Order of attack:
  0. The OpenCode CLI (`opencode run -m opencode/<model>`), the same program that works in the OpenCode app. Free models answer there even
     when the raw Zen HTTP API says "FreeUsageLimitError" (HTTP 429), which is what stalled every pipeline. Installed on demand if missing.
  1. OpenCode Zen (OPENCODE_API_KEY, from the OPENCODE repository secret). Which models are FREE is decided live, every run, from the
     prices Zen itself publishes in GET /zen/v1/models (input and output cost both zero). No model name is hard-coded anywhere, so a
     model that is added, renamed or withdrawn needs no code change.
  2. GitHub Models (GITHUB_TOKEN) as the fallback, exactly as the repo did before.

chat(prompt, max_tokens, temperature, json_mode) -> text or None. Never raises. Prints ::warning:: / ::notice:: lines for the Actions log;
the ::notice:: line says which backend and model actually answered.
"""
import json, os, re, shutil, signal, subprocess, tempfile, time, urllib.error, urllib.request

ZEN = os.environ.get("OPENCODE_BASE_URL", "https://opencode.ai/zen/v1")
GH = "https://models.github.ai/inference/chat/completions"
GH_MODELS = ["openai/gpt-4.1", "openai/gpt-4.1-mini", "openai/gpt-4o"]
_cache = {"cli_off": False, "cli_dead": set(), "free": None, "dead": set(), "zen_off": False, "gh_off": False}   # zen_off: Zen answered a free-usage-limit 429; gh_off: GitHub Models is intercepted (see _call). Both skip that backend for the rest of the run
LAST = {"code": None, "backend": None}   # code: HTTP status of the most recent failed call (None after a success); backend: who answered last
REASONS = []   # one human-readable line per backend that failed this run; explain() joins them so a failed run says WHY

def _why(line):
    if line not in REASONS: REASONS.append(line)

def explain():
    """Why no backend answered, in plain words (for the Actions summary / Telegram report). Empty string if nothing failed."""
    return " | ".join(REASONS)


# Optional wall-clock budget for the whole process (seconds). 0/unset = unlimited (every other pipeline behaves exactly as before).
# REA Scout sets it so a hanging free model cannot eat the whole Actions job (30 min) and get it cancelled: when the budget is spent,
# chat() returns None quickly and the caller reports a clean failure instead.
_T0 = time.monotonic()
try: BUDGET = float(os.environ.get("LLM_BUDGET_SECONDS", "0") or 0)
except ValueError: BUDGET = 0.0

def _left():
    return float("inf") if BUDGET <= 0 else BUDGET - (time.monotonic() - _T0)


def _http(url, body=None, headers=None, timeout=180):
    h = {"User-Agent": "mdm1-pipeline/1.0 (+https://mdm1.org)", **(headers or {})}   # a bare Python-urllib agent is blocked by some CDNs (403)
    req = urllib.request.Request(url, json.dumps(body).encode() if body is not None else None, h, method="POST" if body is not None else "GET")
    return urllib.request.urlopen(req, timeout=max(10, min(timeout, _left()))).read().decode("utf-8", "replace")


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


_ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
CLI_MODELS = ["big-pickle"]   # tried first; other free models from the live Zen catalogue are appended in chat()
CLI_VERSION = "1.19.4"        # the version verified in opencode-cli-canary.yml


def _cli_bin():
    """Path of the opencode CLI, installing it with npm once per run if the runner does not have it. None if impossible."""
    b = shutil.which("opencode")
    if b: return b
    if _cache.get("cli_install_failed"): return None
    try:
        subprocess.run(["npm", "install", "-g", "opencode-ai@" + CLI_VERSION], check=True, capture_output=True, timeout=300)
        return shutil.which("opencode")
    except Exception as e:
        _cache["cli_install_failed"] = True
        _why("opencode CLI could not be installed (%s)" % type(e).__name__)
        return None


def _cli_models():
    """Free model ids the CLI itself lists (`opencode models opencode`): big-pickle first, then every '*-free'. Cached for the run."""
    if "cli_list" in _cache: return _cache["cli_list"]
    ids = []
    b = _cli_bin()
    if b:
        try:
            out = subprocess.run([b, "models", "opencode"], capture_output=True, text=True, timeout=90,
                                 env={k: v for k, v in os.environ.items() if k != "OPENCODE_API_KEY"}).stdout
            for line in _ANSI.sub("", out).splitlines():
                m = re.fullmatch(r"\s*opencode/([\w.\-]+)\s*", line)
                if m and (m.group(1) == "big-pickle" or m.group(1).endswith("-free")): ids.append(m.group(1))
        except Exception as e: print("::warning::opencode models failed:", type(e).__name__)
    _cache["cli_list"] = sorted(set(ids), key=lambda x: (x != "big-pickle", x))
    return _cache["cli_list"]


def _cli(model, prompt, timeout=300):
    """One question to `opencode run -m opencode/<model>` in an empty temp dir; returns the answer text or None."""
    b = _cli_bin()
    if not b: _cache["cli_off"] = True; return None
    timeout = min(timeout, _left())
    if timeout < 30: return None   # budget spent (chat() reports it)
    ask = "Answer with text only. Do not use any tool, do not read or write files, do not run commands.\n\n" + prompt
    with tempfile.TemporaryDirectory() as d:
        proc = subprocess.Popen([b, "run", "-m", "opencode/" + model, ask], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                text=True, cwd=d, start_new_session=True, env={**{k: v for k, v in os.environ.items() if k != "OPENCODE_API_KEY"}, "OPENCODE_ENABLE_EXA": "0"})   # key-less like opencode-probe: the CLI's own free tier answered in ~3 s, while the shared key hit the Zen free quota
        try: out, _ = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            try: os.killpg(proc.pid, signal.SIGKILL)
            except Exception: proc.kill()
            proc.communicate()
            print("::warning::opencode CLI", model, "timed out after", timeout, "s"); _cache["cli_dead"].add(model); return None
    txt = _ANSI.sub("", out or "")
    txt = re.sub(r"^\s*>\s*build\s*·.*$", "", txt, count=1, flags=re.M).strip()
    if not txt:
        # Empty answer: a free model sometimes returns nothing under load. Count it; two empties in a row bench the model for the run.
        n = _cache.setdefault("cli_empty", {}); n[model] = n.get(model, 0) + 1
        print("::warning::opencode CLI", model, "returned no text (exit %s), try %d" % (proc.returncode, n[model]))
        if n[model] >= 2: _cache["cli_dead"].add(model)
        return None
    return txt


def chat(prompt, max_tokens=6000, temperature=0.4, json_mode=True):
    key = os.environ.get("OPENCODE_API_KEY", "").strip()
    if _left() < 30:
        _why("LLM time budget (%d s) used up" % BUDGET); LAST["backend"] = None
        print("::warning::LLM: time budget of %d s is used up, not asking any more models" % BUDGET); return None
    if not _cache["cli_off"] and not os.environ.get("REA_MOCK"):
        for m in [x for x in dict.fromkeys(CLI_MODELS + _cli_models() + free_models()[:2]) if x not in _cache["cli_dead"]][:4]:
            txt = _cli(m, prompt)
            if txt:
                LAST["backend"] = "cli:" + m; LAST["code"] = None; print("::notice::LLM answered via", LAST["backend"]); return txt
            if _cache["cli_off"]: break
    if key and not _cache["zen_off"]:
        h = {"Authorization": "Bearer " + key, "Content-Type": "application/json"}
        for m in free_models():
            if m in _cache["dead"]: continue
            if _cache["zen_off"] or _left() < 30: break
            for fmt in ((True, False) if json_mode else (False,)):   # some models reject response_format: retry without it
                txt = _call(ZEN + "/chat/completions", h, m, prompt, max_tokens, temperature, fmt)
                if txt and txt.strip(): LAST["backend"] = "zen:" + m; print("::notice::LLM answered via", LAST["backend"]); return txt
                if m in _cache["dead"] or _cache["zen_off"]: break
    if not key: _why("OPENCODE_API_KEY is empty (secret OPENCODE missing)")
    tok =os.environ.get("GITHUB_TOKEN", "")
    if tok and not _cache["gh_off"]:
        h = {"Authorization": "Bearer " + tok, "Content-Type": "application/json", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        for m in GH_MODELS:
            if _cache["gh_off"] or _left() < 30: break
            for fmt in ((True, False) if json_mode else (False,)):
                txt = _call(GH, h, m, prompt, max_tokens, temperature, fmt)
                if txt and txt.strip(): LAST["backend"] = "github:" + m; print("::notice::LLM answered via", LAST["backend"]); return txt
                if _cache["gh_off"]: break
    elif not tok: _why("GITHUB_TOKEN not provided")
    LAST["backend"] = None
    if _left() < 30: _why("LLM time budget (%d s) used up" % BUDGET)
    print("::warning::LLM: no backend produced an answer (zen key: %s, zen skipped for quota: %s, github token: %s). Why: %s" % (bool(key), _cache["zen_off"], bool(tok), explain() or "unknown"))
    return None


def _parse(txt):
    """Best-effort JSON parse of a model reply: strict=False accepts raw newlines/tabs inside strings, which models often emit."""
    txt = re.sub(r"^```(?:json)?|```$", "", txt.strip()).strip()
    for cand in (txt, (re.search(r"\{.*\}", txt, re.S) or [None])[0] if re.search(r"\{.*\}", txt, re.S) else None):
        if not cand: continue
        try: return json.loads(cand, strict=False)
        except Exception: pass
    return None


def chat_json(prompt, max_tokens=6000, temperature=0.4):
    """chat() then parse. When a model's reply is not valid JSON, that model is benched for the run and the next one is asked (up to 3 tries)."""
    for _ in range(3):
        txt = chat(prompt, max_tokens, temperature, True)
        if not txt: return None
        obj = _parse(txt)
        if obj is not None: return obj
        who = LAST.get("backend") or ""
        print("::warning::reply was not JSON, len=%d (%s): trying another model" % (len(txt), who))
        if who.startswith("cli:"): _cache["cli_dead"].add(who[4:])
        elif who.startswith("zen:"): _cache["dead"].add(who[4:])
        else: break
    return None
