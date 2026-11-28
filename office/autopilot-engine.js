/* Pure helpers shared by the MDM1 Office autopilot and its tests.
 * No project IDs or model IDs are embedded here: all inventory and models are
 * discovered from the live site/provider endpoints. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MDM1AutopilotEngine = api;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';
  function normalizeUrl(value, base) {
    try {
      var u = new URL(String(value || ''), String(base || ''));
      var b = new URL(String(base || ''));
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      if (u.hostname.toLowerCase() !== b.hostname.toLowerCase()) return '';
      u.hash = '';
      u.search = '';
      if (!u.pathname) u.pathname = '/';
      return u.href;
    } catch (_) { return ''; }
  }
  function isPageUrl(value, base) {
    var href = normalizeUrl(value, base);
    if (!href) return false;
    var u = new URL(href);
    if (/\.(?:avif|bmp|gif|jpe?g|png|webp|svg|ico|css|js|mjs|map|json|xml|zip|rar|7z|pdf|mp[34]|webm|woff2?|ttf|eot)$/i.test(u.pathname)) return false;
    if (/\/(?:api|login|signin|signup|logout|privacy|terms|cookies|policy|account|admin|office|portal)(?:\/|$)/i.test(u.pathname)) return false;
    if (/[?#]/.test(href)) return false;
    return true;
  }
  function isProjectPage(page) {
    if (!page || !page.url) return false;
    var u;
    try { u = new URL(page.url); } catch (_) { return false; }
    var path = u.pathname.toLowerCase();
    if (/^\/(?:en|es|fr|de|pt|id|tr|hi|ru|zh)(?:\/|$)/i.test(path)) return false;
    if (/^\/apps\/(?:index|categories|category)(?:\.html)?\/?$/i.test(path)) return false;
    if (/^\/projects?\/(?:index|categories|category)(?:\.html)?\/?$/i.test(path)) return false;
    if (/^\/pages\/(?:index|hub-services|about|contact|privacy|terms)(?:\.html)?\/?$/i.test(path)) return false;
    var content = [page.title, page.description, page.text, (page.headings || []).join(' ')].join(' ').toLowerCase();
    if (/^\/apps\//i.test(path) || /^\/projects?\//i.test(path)) return true;
    if (/^\/pages\/\d+\.html$/i.test(path)) return true;
    return /project plan|under construction|not yet launched|product plan|revenue model|خطة المشروع|المشروع قيد|قيد التطوير|غير مطلق|فكرة مشروع|نموذج الإيرادات|مشروع رقمي|منتج رقمي/.test(content);
  }
  function clamp(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }
  function profitabilityScore(parts) {
    var p = parts || {};
    /* Weighted commercial opportunity index, not a claim of realized profit. */
    return Math.round(
      clamp(p.revenueClarity) * 0.25 +
      clamp(p.readiness) * 0.25 +
      clamp(p.marginPotential) * 0.20 +
      clamp(p.audienceReach) * 0.15 +
      clamp(p.evidenceStrength) * 0.10 +
      clamp(p.deliveryEase) * 0.05
    );
  }
  function sortAssessments(rows) {
    return (rows || []).slice().sort(function (a, b) {
      var as = clamp(a.profitabilityScore != null ? a.profitabilityScore : a.fit);
      var bs = clamp(b.profitabilityScore != null ? b.profitabilityScore : b.fit);
      if (bs !== as) return bs - as;
      var ae = a.evidenceStrength == null ? 0 : clamp(a.evidenceStrength);
      var be = b.evidenceStrength == null ? 0 : clamp(b.evidenceStrength);
      if (be !== ae) return be - ae;
      return String(a.title || a.url || '').localeCompare(String(b.title || b.url || ''));
    });
  }
  function providerAliases(provider) {
    var p = String(provider || '').toLowerCase();
    if (p === 'zen' || p === 'opencode-zen') return ['zen', 'opencode-zen'];
    if (p === 'groq') return ['groq'];
    if (p === 'openrouter') return ['openrouter'];
    return [p];
  }
  function benchmarkScore(benchmarks, provider, model, role) {
    var aliases = providerAliases(provider), best = null;
    Object.keys(benchmarks || {}).forEach(function (key) {
      var b = benchmarks[key];
      if (!b || String(b.model) !== String(model) || aliases.indexOf(String(b.provider || '').toLowerCase()) < 0) return;
      if (role && b.role !== role) return;
      if (!b.passed || !isFinite(Number(b.score))) return;
      if (best === null || Number(b.score) > best) best = Number(b.score);
    });
    return best;
  }
  function sortModels(models, benchmarks, provider, role) {
    return (models || []).slice().sort(function (a, b) {
      var aid = typeof a === 'string' ? a : a && a.id;
      var bid = typeof b === 'string' ? b : b && b.id;
      var as = benchmarkScore(benchmarks, provider, aid, role);
      var bs = benchmarkScore(benchmarks, provider, bid, role);
      if (as === null && bs !== null) return 1;
      if (bs === null && as !== null) return -1;
      if (as !== null && bs !== null && as !== bs) return bs - as;
      return String(aid || '').localeCompare(String(bid || ''));
    });
  }
  function validProspect(input) {
    var x = input || {}, url = String(x.url || '').trim(), name = String(x.name || x.title || '').trim();
    if (!/^https?:\/\//i.test(url) || name.length < 3) return false;
    if (/(wikipedia|wikimedia|duckduckgo|google\.|bing\.|facebook\.com|instagram\.com|tiktok\.com|linkedin\.com|youtube\.com|twitter\.com|x\.com|reddit\.com|pinterest\.com|\.gov(?:\.|\/)|\.edu(?:\.|\/))/i.test(url)) return false;
    if (/^(search results?|home|contact|about|login|sign in|untitled|صفحة رئيسية|اتصل بنا|من نحن)$/i.test(name)) return false;
    return Boolean(String(x.email || '').trim() || String(x.phone || '').trim());
  }
  function parseMarkdownSearchResults(markdown, query) {
    var text = String(markdown || ''), out = [], seen = {};
    var re = /\[([^\]]{3,180})\]\((https?:\/\/[^)\s]+)\)/g, m;
    while ((m = re.exec(text)) !== null) {
      var title = m[1].replace(/[*_]/g, '').trim();
      var url = m[2].replace(/&amp;/g, '&');
      if (!title || !url || /r\.jina\.ai|duckduckgo\.com|google\.com\/search|bing\.com\/search/i.test(url)) continue;
      var key = url.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      var snippet = text.slice(m.index + m[0].length, Math.min(text.length, m.index + m[0].length + 380))
        .replace(/^\s*[-:|#>*\s]+/, '').split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim().slice(0, 260);
      out.push({ title: title.slice(0, 120), url: url, snippet: snippet || String(query || '').slice(0, 160) });
    }
    return out.slice(0, 12);
  }
  return {
    normalizeUrl: normalizeUrl,
    isPageUrl: isPageUrl,
    isProjectPage: isProjectPage,
    clamp: clamp,
    profitabilityScore: profitabilityScore,
    sortAssessments: sortAssessments,
    benchmarkScore: benchmarkScore,
    sortModels: sortModels,
    validProspect: validProspect,
    parseMarkdownSearchResults: parseMarkdownSearchResults
  };
});
