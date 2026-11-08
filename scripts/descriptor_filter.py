#!/usr/bin/env python3
"""Keep the site language-neutral: strip the Arabic-script word for "Arabic" when it is
used as a DESCRIPTOR (for example "<tool> + descriptor" or "<app> + descriptor").

The site is international, so pages must not label themselves with one language.
Language *pickers* (the native name of a language inside a selector) are kept.

Usage:  python3 scripts/descriptor_filter.py [repo_root]
Idempotent: files that no longer contain the word are not touched.
Run by the generator workflows right before they commit.
"""
import os
import re
import sys

EXTS = (".html", ".json", ".xml", ".md", ".txt")
SKIP_DIRS = {".git", "archive", "node_modules"}

L = "ء-ي"
NB = "(?<![" + L + "])"
NA = "(?![" + L + "ً-ْ])"
ENW = "(?:إنجليزي|انجليزي|إنكليزي)"
ENF = "(?:إنجليزية|انجليزية|إنكليزية)"
PRE = "(بال|لل|وبال|ولل|وال|فال|كال|ال|ب|ل|و)?"

# language-name entries that must survive (language pickers / i18n data)
PROTECT = [
    re.compile(r'<option value="(?:ar[^"]*|en2ar)"[^>]*>[^<]*</option>'),
    # proper nouns (country names) are not descriptors
    re.compile(r"المملكة العربية السعودية"),
    re.compile(r"الإمارات العربية المتحدة"),
    re.compile(r"جمهورية مصر العربية"),
    re.compile(r'"name"\s*:\s*"العربية"'),
    re.compile(r'\[\s*"ar"\s*,\s*"العربية"\s*\]'),
    re.compile(r"\bar\s*:\s*['\"]العربية['\"]"),
    re.compile(r'lang_name\s*:\s*"[^"]*"'),
    re.compile(r'<button id="(?:lang-ar|l-ar)"[^>]*>[^<]*</button>'),
    # generated per-language pages (scripts/build-i18n.js): the Arabic entry of the language switcher / language list
    re.compile(r'<option value="[^"]*"[^>]*>العربية</option>'),
    re.compile(r'<a href="[^"]*" hreflang="ar" lang="ar">العربية</a>'),
    re.compile(r"'تم التطبيق: العربية'"),
]


def _pair_prefix(m):
    p = m.group(1) or ""
    if p.startswith("ب"):
        return "بلغتين"
    if p.startswith("لل") or p == "ل":
        return "للغتين"
    if p.startswith("و"):
        return "ولغتين"
    return "لغتين"


def _drop_adv(m):
    return " " if (m.group(1) and m.group(4)) else ""


def _drop_adv_tanwin(m):
    return " " if (m.group(1) and m.group(2)) else ""


R = lambda p, r: (re.compile(p), r)
# RULES never swallow line breaks (keeps line counts and code layout intact)
RH = lambda p, r: (re.compile(p.replace("\\s", "[ \\t]")), r)

RULES = [
    # --- pass 1: bilingual phrasing, "first" claims, generic adjective removal
    RH(r"اللغة\s*\(\s*عربي\s*/\s*" + ENW + r"\s*\)", "اللغة"),
    RH(r"اللغة\s*\(\s*عربية\s*/\s*" + ENF + r"\s*\)", "اللغة"),
    RH(r"عربي\s+ويدعم", "يدعم"),
    RH(NB + r"عربي(?:ة)?\s+وRTL", "RTL"),
    RH(r"للعربية\s*و\s*RTL", "لـ RTL"),
    RH(r"من\s+العربية\s+إلى\s+(?:ال)?" + ENF, "بين اللغات"),
    RH("([" + L + "]*لغتين)" + r"\s+(?:ال)?عربية\s*و(?:ال)?" + ENF, r"\1"),
    RH(NB + PRE + r"عربية\s*و\s*(?:ال)?" + ENF, _pair_prefix),
    RH(NB + PRE + ENF + r"\s*و\s*(?:ال)?عربية" + NA, _pair_prefix),
    RH(r"بالعربية\s*و\s*ال?English", "بلغتين"),
    RH(r"باللغة\s+العربية\s*و(?:ال)?" + ENF, "بلغتين"),
    RH(NB + r"عربي\s*(?:/|-|،)\s*" + ENW + NA, "ثنائي اللغة"),
    RH(NB + r"عربي\s+و" + ENW + NA, "ثنائي اللغة"),
    RH(NB + r"عربي\s+" + ENW + NA, "ثنائي اللغة"),
    RH(NB + ENW + r"\s*(?:/|-|،)\s*عربي" + NA, "ثنائي اللغة"),
    RH(NB + r"عربية\s*(?:/|-|،)\s*" + ENF + NA, "ثنائية اللغة"),
    RH(NB + r"عربية\s+و" + ENF + NA, "ثنائية اللغة"),
    RH(NB + r"عربية\s+" + ENF + NA, "ثنائية اللغة"),
    RH(NB + ENF + r"\s*(?:/|-|،)\s*عربية" + NA, "ثنائية اللغة"),
    RH(r"\s*عربية\s*/\s*أجنبية", ""),
    RH(r"(•\s*)(?:ال)?عربي(?:ة)?\s+أول(?:ًا|اً|ا):\s*", r"\1"),
    RH(NB + r"(?:ال)?عربي(?:ة)?\s+أول(?:ًا|اً|ا)(?=\s*[:،,.<\"])", ""),
    RH(r"\s*بالعربية\s+أول(?:ًا|اً|ا)\s*[،,]?", ""),
    RH(NB + r"اللغة\s+العربية" + NA, "اللغات"),
    RH(r"(\s*)" + NB + r"(و?)بالعربي(?:ة)?(\s*[،,])?(\s*)", _drop_adv),
    RH(r"(\s*)" + NB + r"عربيًا(\s*)", _drop_adv_tanwin),
    RH(r"\s+(?:ال)?عربي(?:ة|ين|ات|ون|ًا)?" + NA, ""),
    RH(NB + r"(?:ال)?عربي(?:ة|ين|ات|ون|ًا)?" + NA + r"\s*", ""),
    # --- pass 2: leftovers around the word
    RH(NB + ENW + r"\s+وعربي" + NA, "ثنائي اللغة"),
    RH(NB + ENF + r"\s+وعربية" + NA, "ثنائية اللغة"),
    RH(r"بعربية/LTR\s*وRTL", "باتجاهي LTR وRTL"),
    RH(r"للعربية\s+واللغات", "للغات"),
    RH(r"للعربية\s+واللهجات", "للهجات"),
    RH(r"للعربية\s*\(RTL\)", "لاتجاه RTL"),
    RH(r"للعربية\s*/\s*RTL", "لاتجاه RTL"),
    RH(r"للعربية\s+RTL", "لاتجاه RTL"),
    RH(r"للعربية\s+و(?=اتجاه|واجهة|RTL)", "ل"),
    RH(r"للعربية\s*[،,]?\s*و?ال(?=[" + L + "])", "لل"),
    RH(r"\s+للعربية" + NA, ""),
    RH(NB + r"للعربية" + NA + r"\s*", ""),
    RH(r"\s+و(?:ال)?عربي(?:ة|ًا|اً)?" + NA, ""),
    RH(NB + r"العربية\s*،\s*(?=ال)", ""),
    RH(r"\s*،\s*العربية" + NA, ""),
    RH(r"\s+عربي(?:ًا|اً)" + NA, ""),
]

# --- tidy-ups, anchored on Arabic letters so code is never touched
FIXES = [
    R("(?<=[" + L + "] )\\(/(?=[A-Za-z])", "("),
    R("(?<=[" + L + "])/(?=[\\s،.:؛)\\]\"<]|\\\\n)", ""),
    R("(?<=[" + L + r"]\s)ب(?=(?:\\n|[.،,:;)<\"]))", ""),
    R(r"(ثنائي(?:ة)? اللغة)\s+\1", r"\1"),
    R("(?<=[" + L + r"])\s+\(\s*\)", ""),
    R(r"،\s*،", "،"),
    R("(?<=[A-Za-z0-9" + L + r"])\sو(?=:)", ""),
]

WORD = re.compile(r"عربي|العربي")
CODEISH = re.compile(r"\.test\(|\.replace\(|\.match\(|=>|\bfunction\b|\bconst\b|\bvar\b|\blet\b")


def clean(text):
    """Return text with the descriptor removed (language-picker entries kept)."""
    if not WORD.search(text):
        return text
    holders = []

    def stash(m):
        holders.append(m.group(0))
        return "%d" % (len(holders) - 1)

    for rx in PROTECT:
        text = rx.sub(stash, text)
    before = text
    for rx, repl in RULES:
        text = rx.sub(repl, text)
    # tidy-ups only on lines the rules changed, and never on lines that look like code
    a, b = before.split("\n"), text.split("\n")
    if len(a) == len(b):
        for i in range(len(b)):
            if a[i] != b[i] and not CODEISH.search(b[i]):
                for rx, repl in FIXES:
                    b[i] = rx.sub(repl, b[i])
        text = "\n".join(b)
    return re.sub("(\\d+)", lambda m: holders[int(m.group(1))], text)


def main(root):
    changed = 0
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if not fn.endswith(EXTS):
                continue
            path = os.path.join(dp, fn)
            try:
                with open(path, encoding="utf-8") as f:
                    old = f.read()
            except (UnicodeDecodeError, OSError):
                continue
            new = clean(old)
            if new != old:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(new)
                changed += 1
    print("descriptor_filter: %d file(s) changed" % changed)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
