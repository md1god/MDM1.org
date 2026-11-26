#!/usr/bin/env python3
"""Deploy-time cleanup: remove currency/token wording from the published copy only.

The source repository keeps its original layout. This script runs on the generated
_site artifact so mdm1.org can stay a non-commercial technical site without touching
the design of any page. It replaces currency/token names, explorer and wallet links,
and crypto-specific wording with neutral technical labels, keeping the surrounding
HTML, CSS and JavaScript structure intact.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT_DEFAULT = Path(__file__).resolve().parents[1]

# Order matters: exact URLs/emails first, then branded names, then generic wording.
REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r'info@md1usd\.com', re.I), 'info@mdm1.org'),
    (re.compile(r'https?://md1usd\.com/?', re.I), 'https://mdm1.org/'),
    (re.compile(r'\bpages/md1usd\.html\b', re.I), 'pages/about.html'),
    (re.compile(r'\bpages/tokenomics\.html\b', re.I), 'pages/about.html'),
    (re.compile(r'\bpages/ATM\.html\b', re.I), 'pages/hub-services.html'),
    (re.compile(r'https?://(?:www\.)?(?:polygonscan|etherscan|bscscan|solscan)\.[a-z.]+/[^\s"\'<>]*', re.I), 'https://mdm1.org/'),
    (re.compile(r'https?://(?:www\.)?(?:quickswap|uniswap|pancakeswap)[^\s"\'<>]*', re.I), 'https://mdm1.org/'),
    (re.compile(r'https?://(?:www\.)?metamask\.io[^\s"\'<>]*', re.I), 'https://mdm1.org/'),
    (re.compile(r'https?://academy\.binance\.com[^\s"\'<>]*', re.I), 'https://mdm1.org/guides/'),
    (re.compile(r'https?://ethereum\.org/ar/web3/?[^\s"\'<>]*', re.I), 'https://mdm1.org/guides/'),
    (re.compile(r'MD1\s*\$', re.I), 'MDM1'),
    (re.compile(r'\bMD1USD\b|\bmd1usd\b', re.I), 'MDM1'),
    (re.compile(r'\bUSDT\b|\bUSDC\b|\bLUSD\b|\bDAI\b|\bMATIC\b', re.I), 'قيمة'),
    (re.compile(r'التوكنوميكس|اقتصاد الرمز|Tokenomics|tokenomics', re.I), 'دليل المنصة'),
    (re.compile(r'الدولار الرقمي|دولار رقمي|الدرع المستقر', re.I), 'المنصة الرقمية'),
    (re.compile(r'ماكينة الصراف|ماكينة صرافة|الصراف|صرافة|صراف', re.I), 'مركز الخدمات'),
    (re.compile(r'ماكينة مركز الخدمات|مركز الخدماتة', re.I), 'مركز الخدمات'),
    (re.compile(r'المنصة الرقمية مفتوح المصدر', re.I), 'منصة رقمية مفتوحة المصدر'),
    (re.compile(r'تبادل MDM1 بين الأفراد|تبادل العملة بين الأفراد|تبادل MDM1', re.I), 'خدمات MDM1'),
    (re.compile(r'عملة MDM1|العملة بين الأفراد', re.I), 'أداة MDM1'),
    (re.compile(r'الاستثمار|استثمار', re.I), 'المشاركة'),
    (re.compile(r'PolygonScan|polygonscan|QuickSwap|Uniswap|MetaMask|WalletConnect|Etherscan|etherscan|BscScan|bscscan|Solscan|solscan|Polygon|Ethereum|Solana|BNB', re.I), 'MDM1'),
    (re.compile(r'العملات الرقمية|عملة رقمية|العملات المشفرة|العملة المشفرة', re.I), 'الأدوات الرقمية'),
    (re.compile(r'البلوكتشين|بلوكتشين|Blockchain|blockchain', re.I), 'تقنية مفتوحة'),
    (re.compile(r'\bWeb3\b|\bweb3\b', re.I), 'الويب'),
    (re.compile(r'العقود الذكية|عقد ذكي|smart contract', re.I), 'واجهات البرمجة'),
    (re.compile(r'محفظة', re.I), 'حساب'),
    (re.compile(r'ربط الحساب', re.I), 'تسجيل الدخول'),
]

# Script tags that only exist to talk to wallets/explorers; removing them changes no visible layout.
DEAD_SCRIPT_RE = re.compile(
    r'<script\b[^>]*\bsrc=["\'][^"\']*(?:ethers|walletconnect)[^"\']*["\'][^>]*>\s*</script>\s*',
    re.I,
)

# Pages whose whole subject used to be currencies/tokens need a deeper wording pass.
# Other pages (prices in calculators, general banking tools) keep their normal vocabulary.
CRYPTO_PAGE_RE = re.compile(
    r'(?:^|/)(?:whitepaper\.html|pages/(?:ATM|md1usd|\d+)\.html|languages/[^/]+/pages/\d+\.html)$',
    re.I,
)
CRYPTO_PAGE_REPLACEMENTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r'دولار(?:اً|ا)?', re.I), 'وحدة'),
    (re.compile(r'عملة', re.I), 'أداة'),
    (re.compile(r'تبادل', re.I), 'تنسيق'),
]

TEXT_SUFFIXES = {'.html', '.js', '.json', '.xml', '.txt'}


def clean(text: str, rel: str = '') -> str:
    text = DEAD_SCRIPT_RE.sub('', text)
    for pattern, replacement in REPLACEMENTS:
        text = pattern.sub(replacement, text)
    if CRYPTO_PAGE_RE.search(rel.replace('\\', '/')):
        for pattern, replacement in CRYPTO_PAGE_REPLACEMENTS:
            text = pattern.sub(replacement, text)
    return text


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root', type=Path, default=ROOT_DEFAULT)
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()
    root = args.root.resolve()
    changed = 0
    for path in sorted(root.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        original = path.read_text(encoding='utf-8', errors='ignore')
        updated = clean(original, str(path.relative_to(root)))
        if updated != original:
            changed += 1
            if args.write:
                path.write_text(updated, encoding='utf-8')
    print(f"{'written' if args.write else 'dry-run'}: {changed} published files cleaned of currency references")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
