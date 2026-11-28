  /* ==========================================================================
     Autopilot ("أتمتة العمل") + Start-here guide + live page reading (pwa35)
     --------------------------------------------------------------------------
     • Reads real web pages the CEO mentions (e.g. https://mdm1.org/) and hands
       the extracted text to the agent, so answers rest on what is really there.
     • Autopilot runs cycles by itself while the app is open and resumes from
       where it stopped when it is reopened. Every cycle does real work with the
       user's own model key: discover real projects -> analyse one -> save leads
       found by live search -> write the campaign file -> open an approval for
       anything that leaves the company. It never takes a permission silently:
       when a key or an account link is missing it says so and waits.
     ========================================================================== */
  var AP_DEFAULT_SITE = 'https://mdm1.org/';
  var APEngine = window.MDM1AutopilotEngine || {};
  var AP_GAP_MS = 20 * 1000;              // checkpointed cycles; provider quotas still govern actual calls
  var AP_ROUND_GAP_MS = 60 * 60 * 1000;   // after a full round, look for news hourly
  var apBusy = false, apTimer = null, apWake = null;

  function apState() {
    if (!state.autopilot || typeof state.autopilot !== 'object') {
      state.autopilot = { enabled: false, goal: '', cycle: 0, nextAt: 0, projects: [], analyzed: {}, log: [], needs: '', startedAt: null, leads: 0, campaigns: 0 };
    }
    var a = state.autopilot;
    if (!Array.isArray(a.projects)) a.projects = [];
    if (!Array.isArray(a.log)) a.log = [];
    if (!a.everAnalyzed || typeof a.everAnalyzed !== 'object') a.everAnalyzed = {};
    if (!a.analyzed || typeof a.analyzed !== 'object') a.analyzed = {};
    if (!a.projectAssessments || typeof a.projectAssessments !== 'object') a.projectAssessments = {};
    if (!a.prospects || typeof a.prospects !== 'object') a.prospects = {};
    if (!a.scan || typeof a.scan !== 'object') a.scan = null;
    return a;
  }
  function apLog(msg, kind) {
    var a = apState();
    a.log.unshift({ t: nowIso(), m: String(msg).slice(0, 320), k: kind || 'info' });
    a.log = a.log.slice(0, 60);
    saveState();
    apRender();
  }

  /* ── reading real pages ─────────────────────────────────────────────── */
  function extractUrls(text) {
    var out = [], t = String(text || '');
    t.replace(/https?:\/\/[^\s<>"'،)]+/gi, function (u) {
      u = u.replace(/[.,;:!?؟]+$/, '');
      if (out.indexOf(u) === -1) out.push(u);
      return u;
    });
    t.replace(/(?:^|[\s(])((?:[a-z0-9-]+\.)+(?:org|com|net|io|app|ai|dev))(?=$|[\s),.،؟?!/])/gi, function (m, d) {
      if (!out.some(function (x) { return x.toLowerCase().indexOf(d.toLowerCase()) !== -1; })) out.push('https://' + d + '/');
      return m;
    });
    return out.slice(0, 2);
  }
  function fetchTextWithTimeout(url, ms, headers) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? window.setTimeout(function () { ctl.abort(); }, ms || 15000) : null;
    return fetch(url, { cache: 'no-store', headers: headers || {}, signal: ctl ? ctl.signal : undefined }).then(function (r) {
      if (timer) window.clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }, function (e) { if (timer) window.clearTimeout(timer); throw e; });
  }
  /* Same-origin pages (mdm1.org) are read directly; other sites go through a
     free public reader that returns plain text — no key, no account. */
  function fetchPage(url) {
    return fetchTextWithTimeout(url, 15000).then(function (html) {
      return parsePage(html, url);
    }).catch(function (firstErr) {
      return fetchTextWithTimeout('https://r.jina.ai/' + url, 25000, { Accept: 'text/plain' }).then(function (txt) {
        var title = (txt.match(/^Title:\s*(.+)$/m) || [])[1] || url;
        return { url: url, title: title.trim(), description: '', headings: [], links: [], text: txt.replace(/^(Title|URL Source|Markdown Content):.*$/gm, '').trim().slice(0, 4500) };
      }).catch(function () { throw new Error(firstErr && firstErr.message || 'تعذّر فتح الصفحة'); });
    });
  }
  function parsePage(html, url) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var base; try { base = new URL(url); } catch (e) { base = null; }
    var meta = doc.querySelector('meta[name="description"]') || doc.querySelector('meta[property="og:description"]');
    var links = [];
    Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (a) {
      try {
        var u = new URL(a.getAttribute('href'), url);
        if (base && u.host !== base.host) return;
        if (!/^https?:$/.test(u.protocol)) return;
        u.hash = '';
        var href = u.href;
        if (/\.(?:png|jpe?g|webp|svg|css|js|json|zip|pdf|ico|woff2?)$/i.test(u.pathname)) return;
        if (/(login|signin|signup|logout|privacy|terms|cookies|policy|account|admin|\/office\/?$)/i.test(u.pathname)) return;
        if (u.pathname === '/' || u.pathname === (base && base.pathname)) return;
        var text = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        if (!links.some(function (l) { return l.href === href; })) links.push({ href: href, text: text });
      } catch (e) { /* ignore bad href */ }
    });
    Array.prototype.forEach.call(doc.querySelectorAll('script,style,noscript,svg,iframe,nav,footer'), function (n) { n.remove(); });
    var heads = Array.prototype.map.call(doc.querySelectorAll('h1,h2,h3'), function (h) { return (h.textContent || '').replace(/\s+/g, ' ').trim(); }).filter(Boolean).slice(0, 14);
    return {
      url: url,
      title: ((doc.title || '') + '').trim() || url,
      description: meta ? (meta.getAttribute('content') || '').trim() : '',
      headings: heads,
      links: links.slice(0, 1500),
      text: ((doc.body && doc.body.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 4500)
    };
  }
  function pageContext(p) {
    return '— ' + p.url + '\nالعنوان: ' + p.title + (p.description ? '\nالوصف: ' + p.description : '') +
      (p.headings.length ? '\nالعناوين: ' + p.headings.join(' | ') : '') +
      (p.links.length ? '\nروابط داخلية: ' + p.links.slice(0, 20).map(function (l) { return (l.text || '·') + ' → ' + l.href; }).join(' ; ') : '') +
      '\nالنص: ' + p.text.slice(0, 2600);
  }
  /* Called by aiGenerate: adds what was really read from the pages the CEO named. */
  function urlsContextFor(text) {
    var urls = extractUrls(text);
    if (!urls.length) return Promise.resolve('');
    return Promise.all(urls.map(function (u) {
      return fetchPage(u).then(function (p) { return pageContext(p); }).catch(function (e) {
        return '— ' + u + '\nتعذّر سحب هذه الصفحة (' + e.message + '). لا تدّعِ أنك قرأتها.';
      });
    })).then(function (parts) {
      return '=== محتوى صفحات سُحب فعلاً الآن (اعتمد عليه) ===\n' + parts.join('\n\n');
    });
  }

  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item'; }
  function parseJsonLoose(t) {
    var m = String(t || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e) { return null; }
  }

  /* ── cycle steps ────────────────────────────────────────────────────── */
  function apSite() { var u = extractUrls(apState().goal)[0]; return u || AP_DEFAULT_SITE; }

  function apSiteOrigin(site) {
    try { return new URL(site).origin + '/'; } catch (_) { return AP_DEFAULT_SITE; }
  }

  function apReadSitemap(url, depth, seen) {
    var key = String(url || '');
    if (!key || (seen && seen[key]) || depth > 3) return Promise.resolve([]);
    seen = seen || {};
    seen[key] = true;
    return fetchTextWithTimeout(key, 18000, { Accept: 'application/xml,text/xml,text/plain' }).then(function (xml) {
      var doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('ملف Sitemap غير صالح');
      var locs = Array.prototype.map.call(doc.getElementsByTagName('loc'), function (n) { return (n.textContent || '').trim(); }).filter(Boolean);
      if (!locs.length) return [];
      var nested = locs.filter(function (u) { return /\.xml(?:\?|$)/i.test(u); });
      if (nested.length) return Promise.all(nested.map(function (u) { return apReadSitemap(u, depth + 1, seen); }))
        .then(function (parts) { return Array.prototype.concat.apply([], parts); });
      var base = apSiteOrigin(key);
      return locs.map(function (u) { return APEngine.normalizeUrl ? APEngine.normalizeUrl(u, base) : ''; }).filter(Boolean);
    }).catch(function () { return []; });
  }

  function apSiteInventoryUrls(site) {
    var origin = apSiteOrigin(site), candidates = [origin + 'sitemap.xml', origin + 'sitemap_index.xml', origin + 'sitemap-index.xml'];
    return fetchTextWithTimeout(origin + 'robots.txt', 9000, { Accept: 'text/plain' }).then(function (robots) {
      var matches = robots.match(/^sitemap:\s*(\S+)/gim) || [];
      matches.forEach(function (line) {
        var m = line.match(/^sitemap:\s*(\S+)/i);
        if (m && candidates.indexOf(m[1]) === -1) candidates.unshift(m[1]);
      });
      return candidates;
    }).catch(function () { return candidates; }).then(function (maps) {
      return Promise.all(maps.map(function (u) { return apReadSitemap(u, 0, {}); })).then(function (parts) {
        var all = Array.prototype.concat.apply([], parts), seen = {}, out = [];
        all.forEach(function (u) {
          var v = APEngine.normalizeUrl ? APEngine.normalizeUrl(u, origin) : u;
          if (v && APEngine.isPageUrl(v, origin) && !seen[v]) { seen[v] = true; out.push(v); }
        });
        /* Catalog pages are added as discovery seeds, not as a fixed project list. */
        [origin, origin + 'apps/index.html', origin + 'projects/index.html', origin + 'pages/index.html'].forEach(function (u) {
          var v = APEngine.normalizeUrl ? APEngine.normalizeUrl(u, origin) : u;
          if (v && APEngine.isPageUrl(v, origin) && !seen[v]) { seen[v] = true; out.unshift(v); }
        });
        return { urls: out, source: out.length > 4 ? 'sitemap/robots + catalogs' : 'catalog/link crawl' };
      });
    });
  }

  function apInventoryExport(scan) {
    var candidates = scan.records || [], allUrls = scan.allUrls || [];
    var lines = ['# جرد الموقع بالكامل', '', 'الموقع: ' + scan.site, 'مصدر الحصر: ' + scan.source,
      'صفحات جرى فحصها بنجاح: ' + (scan.pageCount || 0), 'إجمالي روابط الموقع المكتشفة: ' + allUrls.length,
      'صفحات/مشروعات مرشحة للتحليل: ' + candidates.length,
      'روابط تعذّر فتحها بعد إعادة المحاولة: ' + (scan.failedFinal || 0), '',
      'كل الروابط المكتشفة داخل النطاق:'];
    allUrls.forEach(function (url) { lines.push('- ' + url); });
    lines.push('', 'الصفحات المرشحة للتحليل التجاري:');
    candidates.forEach(function (p, i) {
      lines.push((i + 1) + '. [' + p.title + '](' + p.url + ')');
      lines.push('   ' + String(p.description || p.summary || '').slice(0, 360));
      lines.push('');
    });
    writeExport('autopilot-full-site-inventory.md', lines.join('\n'));
    return candidates;
  }

  function apFinishDiscovery() {
    var a = apState(), scan = a.scan;
    var candidates = apInventoryExport(scan);
    scan.complete = true;
    scan.completedAt = nowIso();
    scan.candidateCount = candidates.length;
    a.projects = candidates.map(function (p) {
      return { title: p.title, url: p.url, summary: String(p.description || p.summary || p.text || '').slice(0, 1800) };
    }).filter(function (p) { return !a.everAnalyzed[p.url]; });
    a.analyzed = Object.assign({}, a.everAnalyzed);
    a.scan.inFlight = null;
    saveNow();
    state.teamChat.push({ id: uuid(), senderId: 'web-research-team', senderName: 'فريق البحث (الأتمتة 🤖)', senderAvatar: '🤖', role: 'assistant',
      text: '📚 اكتمل جرد ' + scan.site + ': فُحصت ' + (scan.pageCount || 0) + ' صفحة، واكتُشف ' + (scan.allUrls || []).length + ' رابطاً داخلياً، منها ' + candidates.length + ' صفحة منتج/مشروع مرشحة. ستُحلَّل كل المرشحات ثم تُرتَّب من الأعلى إلى الأدنى.',
      timestamp: nowIso() });
    apLog('اكتمل حصر الموقع: ' + (scan.pageCount || 0) + ' صفحة، ' + candidates.length + ' مرشحاً للتحليل.', 'ok');
    /* Keep the URL inventory and candidate summaries, but release duplicate
       crawler maps to stay within browser storage quotas. */
    scan.queue = []; scan.queued = {}; scan.visited = {};
    saveNow();
  }

  function apContinueDiscovery() {
    var a = apState(), scan = a.scan;
    if (!scan || scan.complete) return Promise.resolve();
    var origin = apSiteOrigin(scan.site), batchSize = 12, startAt = num(scan.cursor, 0);
    if (startAt >= scan.queue.length) {
      if (scan.failed.length && scan.retryPass < 1) {
        scan.queue = scan.failed.slice(); scan.cursor = 0; scan.failed = []; scan.retryPass++;
        apLog('إعادة محاولة فتح ' + scan.queue.length + ' صفحة تعذّر تحميلها في المسح الأول.', 'warn');
      } else {
        scan.failedFinal = scan.failed.length;
        apFinishDiscovery();
        return Promise.resolve();
      }
    }
    var endAt = Math.min(scan.queue.length, startAt + batchSize);
    var batch = scan.queue.slice(startAt, endAt);
    scan.inFlight = { start: startAt, end: endAt };
    saveNow(); /* if the tab closes, this batch is repeated rather than skipped */
    apLog('أفحص صفحات الموقع: ' + Math.min(endAt, scan.queue.length) + ' من ' + scan.queue.length + ' رابطاً مكتشفاً...');
    return Promise.all(batch.map(function (url) {
      return fetchPage(url).then(function (page) { return { page: page, error: null }; })
        .catch(function (e) { return { page: null, url: url, error: e.message || 'تعذّر فتح الصفحة' }; });
    })).then(function (results) {
      results.forEach(function (result) {
        if (!result.page) { scan.failed.push(result.url); return; }
        var page = result.page, normalized = APEngine.normalizeUrl ? APEngine.normalizeUrl(page.url, origin) : page.url;
        if (!normalized || scan.visited[normalized]) return;
        scan.visited[normalized] = true;
        scan.pageCount = (scan.pageCount || 0) + 1;
        var candidateMeta = {
          url: normalized, title: String(page.title || normalized).slice(0, 180),
          description: String(page.description || '').slice(0, 420),
          headings: (page.headings || []).slice(0, 12),
          text: String(page.text || '').slice(0, 1800)
        };
        if (APEngine.isProjectPage && APEngine.isProjectPage(candidateMeta)) {
          candidateMeta.summary = String(page.description || page.text || '').slice(0, 1200);
          delete candidateMeta.text;
          scan.records.push(candidateMeta);
        }
        (page.links || []).forEach(function (link) {
          var next = APEngine.normalizeUrl ? APEngine.normalizeUrl(link.href, origin) : '';
          if (!next || !APEngine.isPageUrl(next, origin) || scan.queued[next] || scan.visited[next] || scan.queue.length >= 50000) return;
          scan.queued[next] = true;
          scan.queue.push(next);
          scan.allUrls.push(next);
        });
      });
      scan.cursor = endAt;
      scan.inFlight = null;
      scan.scanned = Object.keys(scan.visited).length;
      saveNow();
      if (scan.cursor >= scan.queue.length) {
        if (scan.failed.length && scan.retryPass < 1) {
          scan.queue = scan.failed.slice(); scan.cursor = 0; scan.failed = []; scan.retryPass++;
          apLog('إعادة محاولة تحميل الصفحات غير المتاحة.', 'warn');
        } else {
          scan.failedFinal = scan.failed.length;
          apFinishDiscovery();
        }
      } else {
        apLog('حُفظ تقدم المسح: ' + scan.scanned + ' صفحة؛ المتبقي المكتشف ' + (scan.queue.length - scan.cursor) + '.', 'info');
      }
    });
  }

  function apDiscover() {
    var a = apState(), site = apSite();
    if (a.scan && a.scan.site === site && !a.scan.complete) return apContinueDiscovery();
    apLog('أبدأ جرد الموقع كاملاً عبر Sitemap وروابط الصفحات الداخلية: ' + site, 'info');
    return apSiteInventoryUrls(site).then(function (inventory) {
      var origin = apSiteOrigin(site), queued = {};
      var queue = inventory.urls.filter(function (u) {
        var n = APEngine.normalizeUrl ? APEngine.normalizeUrl(u, origin) : '';
        if (!n || queued[n]) return false;
        queued[n] = true; return true;
      });
      a.scan = { site: site, source: inventory.source, queue: queue, allUrls: queue.slice(), cursor: 0, queued: queued, visited: {},
        records: [], failed: [], retryPass: 0, scanned: 0, pageCount: 0, complete: false, startedAt: nowIso(), inFlight: null };
      a.projects = [];
      a.projectAssessments = a.projectAssessments || {};
      saveNow();
      apLog('اكتشفت ' + queue.length + ' رابط بداية من Sitemap/الفهارس؛ أواصل الزحف على دفعات محفوظة.', 'ok');
      return apContinueDiscovery();
    });
  }

  function apParseSearchHtml(html, query) {
    var doc = new DOMParser().parseFromString(String(html || ''), 'text/html'), out = [], seen = {};
    var anchors = doc.querySelectorAll('a.result__a, a[data-testid="result-title-a"], a[href]');
    Array.prototype.forEach.call(anchors, function (a) {
      var href = a.getAttribute('href') || '';
      var title = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (!title || title.length < 3) return;
      try {
        var u = new URL(href, 'https://html.duckduckgo.com/');
        if (u.hostname.indexOf('duckduckgo.com') !== -1 && u.searchParams.has('uddg')) href = u.searchParams.get('uddg');
        var parsed = new URL(href);
        if (!/^https?:$/.test(parsed.protocol) || /duckduckgo\.com|google\.com\/search|bing\.com\/search/i.test(parsed.hostname)) return;
        parsed.hash = ''; href = parsed.href;
      } catch (_) { return; }
      if (seen[href]) return;
      seen[href] = true;
      var box = a.closest('.result') || a.parentElement;
      var sn = box && box.querySelector('.result__snippet, [data-testid="result-snippet"]');
      out.push({ title: title.slice(0, 120), url: href, snippet: String(sn && sn.textContent || query || '').replace(/\s+/g, ' ').trim().slice(0, 260) });
    });
    return out.slice(0, 12);
  }

  function apSearchResults(query) {
    var q = String(query || '').trim();
    if (!q) return Promise.resolve([]);
    var url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q);
    return fetchTextWithTimeout(url, 18000, { Accept: 'text/html' }).then(function (html) {
      var rows = apParseSearchHtml(html, q);
      if (rows.length) return rows;
      throw new Error('لا توجد نتائج HTML قابلة للاستخراج');
    }).catch(function () {
      var reader = 'https://r.jina.ai/http://html.duckduckgo.com/html/?q=' + encodeURIComponent(q);
      return fetchTextWithTimeout(reader, 25000, { Accept: 'text/plain' }).then(function (text) {
        return APEngine.parseMarkdownSearchResults ? APEngine.parseMarkdownSearchResults(text, q) : [];
      }).catch(function () { return []; });
    });
  }

  function apContactFromPage(page) {
    var text = String(page && page.text || ''), emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || [];
    var phones = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
    var email = emails.filter(function (x) { return !/example\.com|domain\.com|email\.com/i.test(x); })[0] || '';
    var phone = phones.map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(function (x) { return x.replace(/\D/g, '').length >= 8; })[0] || '';
    return { email: email, phone: phone };
  }

  function apInspectProspect(row) {
    return fetchPage(row.url).then(function (page) {
      var contact = apContactFromPage(page), contactLinks = (page.links || []).filter(function (l) {
        return /contact|about|impressum|اتصل|تواصل|من نحن|حول/i.test((l.text || '') + ' ' + l.href);
      }).slice(0, 2);
      var chain = Promise.resolve();
      contactLinks.forEach(function (link) {
        chain = chain.then(function () {
          if (contact.email && contact.phone) return;
          return fetchPage(link.href).then(function (contactPage) {
            var found = apContactFromPage(contactPage);
            if (!contact.email) contact.email = found.email;
            if (!contact.phone) contact.phone = found.phone;
          }).catch(function () { return null; });
        });
      });
      return chain.then(function () {
        return { name: String(row.title || page.title || '').slice(0, 100), url: page.url || row.url,
          email: contact.email, phone: contact.phone, snippet: String(row.snippet || page.description || page.text || '').slice(0, 260) };
      });
    }).catch(function () { return null; });
  }

  function apFindProspects(queries, project) {
    var qs = (Array.isArray(queries) ? queries : []).map(function (q) { return String(q || '').trim(); }).filter(Boolean).slice(0, 4);
    if (!qs.length) qs = [project.title + ' businesses potential customers contact', project.title + ' companies email contact'];
    return Promise.all(qs.map(apSearchResults)).then(function (lists) {
      var seen = {}, rows = Array.prototype.concat.apply([], lists).filter(function (x) {
        if (!x || !x.url || seen[x.url]) return false;
        seen[x.url] = true;
        return true;
      }).slice(0, 10);
      return Promise.all(rows.map(apInspectProspect)).then(function (inspected) {
        var a = apState(), added = 0, accepted = [];
        inspected.forEach(function (lead) {
          if (!lead || !APEngine.validProspect || !APEngine.validProspect(lead)) return;
          var duplicate = (state.customers || []).some(function (c) {
            return (lead.email && String(c.email || '').toLowerCase() === lead.email.toLowerCase()) ||
              String(c.notes || '').indexOf(lead.url) !== -1;
          });
          if (duplicate) return;
          state.customers.unshift({
            id: 'cust-' + uuid().slice(0, 8), portalToken: 'pl_' + uuid().replace(/-/g, ''),
            name: lead.name, contactName: '', email: lead.email, phone: lead.phone,
            stage: 'عميل محتمل', projectTitle: project.title, totalValueUsd: 0, paidUsd: 0,
            assignedTo: 'marketing-lead',
            notes: 'مرشح بحث موثّق بوسيلة اتصال منشورة. المصدر: ' + lead.url + '\n' + lead.snippet,
            createdAt: nowIso().slice(0, 10), leadVerifiedAt: nowIso(), leadSource: lead.url
          });
          accepted.push(lead); added++;
        });
        a.leads = (a.leads || 0) + added;
        a.prospects[project.url] = { searched: rows.length, qualified: added, checkedAt: nowIso() };
        saveNow();
        return { added: added, searched: rows.length, accepted: accepted };
      });
    });
  }

  function apBuildRankedReport() {
    var a = apState(), rows = Object.keys(a.projectAssessments || {}).map(function (url) { return a.projectAssessments[url]; });
    rows = APEngine.sortAssessments ? APEngine.sortAssessments(rows) : rows;
    var lines = ['# ترتيب كل مشروعات الموقع حسب مؤشر الفرصة التجارية', '', 'عدد المشروعات/الصفحات المحللة: ' + rows.length,
      'المؤشر من 100، وهو تقييم مقارن احتمالي وليس ربحاً محققاً أو توقعاً مالياً مؤكداً.',
      'الأوزان: وضوح الإيراد 25%، جاهزية البيع 25%، هامش الربح المحتمل 20%، حجم الجمهور 15%، قوة الدليل 10%، سهولة التسليم 5%.', ''];
    rows.forEach(function (p, i) {
      lines.push('## ' + (i + 1) + '. ' + p.title + ' — ' + p.profitabilityScore + '/100');
      lines.push('الرابط: ' + p.url);
      lines.push('الجمهور: ' + (p.audience || 'غير محسوم'));
      lines.push('الجاهزية: ' + (p.readinessLabel || 'غير محددة'));
      lines.push('الربح الإجمالي بالدولار: ' + (p.estimatedGrossProfitUsd == null ? 'غير قابل للحساب من بيانات الصفحة' : '$' + p.estimatedGrossProfitUsd));
      lines.push('الدليل السعري: ' + (p.profitEvidence || 'لا يوجد دليل سعري/تكلفة كافٍ'));
      lines.push('سبب الترتيب: ' + (p.why || '—'));
      lines.push('');
    });
    writeExport('autopilot-profitability-ranking.md', lines.join('\n'));
    return rows;
  }

  function apAnalyze(p) {
    var a = apState(), agent = getAgent('web-research-team');
    apLog('أحلّل المشروع: ' + p.title + ' (' + (Object.keys(a.projectAssessments).length + 1) + '/' + a.scan.candidateCount + ')');
    a.currentProjectUrl = p.url; saveNow();
    return fetchPage(p.url).catch(function () {
      return { url: p.url, title: p.title, description: p.summary, headings: [], links: [], text: p.summary };
    }).then(function (page) {
      var prompt = 'قيّم هذا المشروع التجاري بالاعتماد على الصفحة نفسها فقط، ثم جهّز طريقة بيع قابلة للتنفيذ. أعد JSON صالحاً فقط. لا تخترع مبيعات أو أسعاراً أو تكاليف. إذا لم يوجد نص صريح يثبت السعر والتكلفة فاجعل estimatedGrossProfitUsd=null وprofitEvidence فارغاً. الأرقام التالية تقييم نسبي من 0 إلى 100 وليست أرباحاً محققة: revenueClarity, readiness, marginPotential, audienceReach, evidenceStrength, deliveryEase. readinessLabel من: جاهز للبيع، يحتاج تخصيصاً، قيد التطوير، غير واضح. أخرج البنية: {"offer":"...","audience":"...","revenueClarity":0,"readiness":0,"marginPotential":0,"audienceReach":0,"evidenceStrength":0,"deliveryEase":0,"readinessLabel":"...","publishedPriceUsd":null,"estimatedGrossProfitUsd":null,"profitEvidence":"","confidence":0,"channels":["..."],"queries":["بحث عن شركات/أنشطة حقيقية محتملة كعملاء مع معلومات اتصال عامة"],"outreach":"مسودة فقط لا ترسلها","post":"مسودة فقط لا تنشرها","why":"سبب التقييم مع الدليل"}.\n\n' +
        'الهدف: ' + (a.goal || 'تحقيق مبيعات وربح من منتجات الموقع') + '\nالمشروع: ' + p.title + '\n' + pageContext(page);
      return aiGenerate({ agentId: agent ? agent.id : 'web-research-team', messages: [{ role: 'user', text: prompt }], _urlDone: true });
    }).then(function (r) {
      recordUsage('web-research-team', r.usage);
      if (r.mode !== 'live') throw new Error('لم ينجح أي نموذج متاح: ' + (r.warning || 'تحقق من المفاتيح والحصص'));
      var j = parseJsonLoose(r.text);
      if (!j) throw new Error('النموذج لم يُرجع تحليلاً منظماً صالحاً؛ لم أعلّم المشروع كمنجز.');
      var parts = {
        revenueClarity: j.revenueClarity, readiness: j.readiness, marginPotential: j.marginPotential,
        audienceReach: j.audienceReach, evidenceStrength: j.evidenceStrength, deliveryEase: j.deliveryEase
      };
      var score = APEngine.profitabilityScore ? APEngine.profitabilityScore(parts) : num(j.fit, 0);
      var evidence = String(j.profitEvidence || '').trim();
      var evidenceVerified = Boolean(evidence && String(page.text || '').indexOf(evidence) !== -1);
      var gross = evidenceVerified && j.estimatedGrossProfitUsd != null && isFinite(Number(j.estimatedGrossProfitUsd))
        ? Number(j.estimatedGrossProfitUsd) : null;
      var publishedPrice = evidenceVerified && j.publishedPriceUsd != null && isFinite(Number(j.publishedPriceUsd))
        ? Number(j.publishedPriceUsd) : null;
      var assessment = {
        title: p.title, url: p.url, profitabilityScore: score, audience: j.audience || '',
        readinessLabel: j.readinessLabel || 'غير واضح', publishedPriceUsd: publishedPrice,
        estimatedGrossProfitUsd: gross, profitEvidence: evidenceVerified ? evidence : '',
        evidenceStrength: num(j.evidenceStrength, 0), confidence: num(j.confidence, 0),
        why: j.why || '', assessedAt: nowIso()
      };
      a.projectAssessments[p.url] = assessment;
      saveNow();
      return apFindProspects(j.queries, p).then(function (prospectResult) {
        var offer = j.offer || String(r.text || '').slice(0, 400);
        var md = '# حملة مقترحة: ' + p.title + '\n\nالرابط: ' + p.url +
          '\n\n## الترتيب التجاري\n' + score + '/100 (مؤشر مقارن، وليس ربحاً محققاً)' +
          '\n\n## العرض\n' + offer + '\n\n## الجمهور\n' + (j.audience || '—') +
          '\n\n## الجاهزية\n' + (j.readinessLabel || 'غير واضح') +
          '\n\n## سعر موثق من الصفحة\n' + (publishedPrice == null ? 'غير موجود/لم يثبت' : '$' + publishedPrice) +
          '\n\n## الربح الإجمالي\n' + (gross == null ? 'لا يمكن حسابه بأمان من البيانات المتاحة' : '$' + gross) +
          '\n\n## وسيلة التحقق\n' + (evidenceVerified ? evidence : 'لا يوجد دليل سعري/تكلفة حرفي كافٍ') +
          '\n\n## العملاء المحتملون المؤهلون\n' + prospectResult.added + ' من ' + prospectResult.searched + ' نتيجة بحث؛ لا يُضاف إلى CRM إلا من لديه بريد أو هاتف منشور على موقعه.' +
          '\n\n## القنوات\n' + (Array.isArray(j.channels) ? j.channels.join('، ') : '—') +
          '\n\n## مسودة التواصل (لم تُرسل)\n' + (j.outreach || '—') +
          '\n\n## مسودة الترويج (لم تُنشر)\n' + (j.post || '—') +
          '\n\n## سبب التقييم\n' + (j.why || '—') + '\n';
        writeExport('campaign-' + slug(p.title) + '.md', md);
        addApproval({
          agentId: 'marketing-lead', agentName: 'مسؤول التسويق',
          title: 'مراجعة واعتماد مسودة حملة: ' + p.title + ' (' + score + '/100)',
          details: offer + '\n\nمؤشر الفرصة: ' + score + '/100\nالعملاء المؤهلون: ' + prospectResult.added +
            '\n\nمسودة التواصل:\n' + (j.outreach || '—') + '\n\nمسودة المنشور:\n' + (j.post || '—') +
            '\n\nالموافقة هنا على المسودة فقط. لا إرسال أو نشر خارجي تلقائي.',
          risk: 'medium', actionType: 'publish_marketing', _skipQuality: true
        });
        a.campaigns = (a.campaigns || 0) + 1;
        a.analyzed[p.url] = true; a.everAnalyzed[p.url] = true;
        a.sinceReport = (a.sinceReport || 0) + 1;
        delete a.currentProjectUrl;
        saveNow();
        awardPoints('web-research-team', 5, 'تحليل صفحة مشروع وترتيبها تجارياً');
        state.liveBubbles['web-research-team'] = 'حلّلت: ' + p.title.slice(0, 30);
        apLog('«' + p.title + '»: مؤشر ' + score + '/100؛ ' + prospectResult.added + ' عميل مؤهل بوسيلة اتصال منشورة.', 'ok');
        saveNow();
      });
    });
  }

  function apSummarize() {
    var a = apState(), ea = getAgent('executive-assistant');
    var rows = apBuildRankedReport(), top = rows.slice(0, 20);
    var brief = top.map(function (p, i) { return (i + 1) + '. ' + p.title + ' — ' + p.profitabilityScore + '/100 — ' + p.url; }).join('\n');
    var report = '# تقرير ترتيب الربحية والفرص\n\nعدد الصفحات المحللة: ' + rows.length +
      '\n\nالمؤشر نسبي ومبني على تقييم موحّد؛ لا توجد أرباح مؤكدة دون بيانات مبيعات وتكاليف حقيقية.\n\n' + brief +
      '\n\nالملف الكامل: autopilot-profitability-ranking.md\n';
    writeExport('autopilot-final-report.md', report);
    return aiGenerate({
      agentId: ea ? ea.id : 'executive-assistant', _urlDone: true,
      messages: [{ role: 'user', text: 'اكتمل تحليل كل الصفحات المرشحة من الموقع، وعددها ' + rows.length + '. هذه أعلى الفرص مرتبة بمؤشر تجاري من 100 (ليس ربحاً فعلياً):\n' + brief +
        '\n\nاكتبي تقريراً تنفيذياً موجزاً: ابدئي بالأعلى ترتيباً، اذكري لماذا، فرّقي بين المنتجات الجاهزة والمشروعات قيد التطوير، ولا تدّعي مبيعات أو أرباحاً محققة.' }]
    }).then(function (r) {
      recordUsage('executive-assistant', r.usage);
      if (r.mode !== 'live') throw new Error('تعذّر إعداد الملخص بالنموذج؛ ملف الترتيب الكامل محفوظ.');
      state.teamChat.push({ id: uuid(), senderId: 'executive-assistant', senderName: 'السكرتيرة التنفيذية (تقرير الأتمتة 🤖)', senderAvatar: '📋', role: 'assistant', text: r.text, timestamp: nowIso() });
      writeExport('autopilot-report-' + Date.now() + '.md', report + '\n## الملخص التنفيذي\n' + r.text + '\n');
      telegramNotify('📋 *اكتمل تحليل الموقع وترتيب الفرص*\nعدد الصفحات: ' + rows.length + '\n' + rows.slice(0, 5).map(function (x, i) { return (i + 1) + ') ' + x.title + ' — ' + x.profitabilityScore + '/100'; }).join('\n'));
      apLog('اكتمل تحليل جميع الصفحات المرشحة. الترتيب الكامل محفوظ في autopilot-profitability-ranking.md.', 'ok');
    });
  }

  /* A real model: the user's own key, or a browser model that is really loaded
     (the labeled quick mode has no model, so it does not count). */
  function apModelReady() {
    var m = currentMode();
    if (m === 'demo') return false;
    if (m === 'local') { var l = providerCache.local; return Boolean(l && l.connected && !l.quick); }
    return providerConfigured(m);
  }
  function apCycle() {
    var a = apState();
    if (apBusy) return Promise.resolve();
    if (!apModelReady()) {
      if (a.needs !== 'key') apLog('أحتاج مفتاح نموذج ذكاء اصطناعي من حسابك لأكمل. أضفه من «إضافة API» وسأكمل تلقائياً.', 'warn');
      a.needs = 'key'; a.nextAt = Date.now() + 30000; saveState(); apRender();
      return Promise.resolve();
    }
    a.needs = '';
    apBusy = true; apRender();
    var todo = a.projects.filter(function (p) { return !a.analyzed[p.url]; })[0];
    var job;
    if (!a.scan) job = apDiscover();
    else if (!a.scan.complete) job = apContinueDiscovery();
    else if (todo) job = apAnalyze(todo);
    else if (a.projects.length && a.sinceReport > 0) {
      job = apSummarize().then(function () {
        a.sinceReport = 0; a.projects = []; a.scan = null; a.roundDone = true; saveNow();
      });
    } else if (a.projects.length) {
      job = apSummarize().then(function () { a.projects = []; a.scan = null; a.roundDone = true; saveNow(); });
    } else {
      job = Promise.resolve().then(function () {
        apLog('اكتمل تحليل الدفعة الحالية؛ سأعيد جرد الموقع بعد ساعة للعثور على صفحات جديدة.', 'info');
        a.scan = null; a.roundDone = true; saveNow();
      });
    }
    return job.then(function () {
      a.failStreak = 0;
      a.cycle = (a.cycle || 0) + 1;
      a.nextAt = Date.now() + (a.roundDone ? AP_ROUND_GAP_MS : AP_GAP_MS); saveNow();
      a.roundDone = false;
    }).catch(function (e) {
      /* Back off instead of hammering providers that are rate-limited: each retry
         spends the user's remaining free quota. */
      a.failStreak = (a.failStreak || 0) + 1;
      var quota = /rate limit|quota|429|per-day|credits|انتهت الحصة|الحصة/i.test(String(e.message || ''));
      var waitMin = quota ? 30 : Math.min(60, 3 * Math.pow(2, a.failStreak - 1));
      apLog('تعذّرت الخطوة: ' + String(e.message).slice(0, 220) + ' — ' + (quota ? 'الحصة المجانية لمزودك انتهت أو محدودة؛ ' : '') + 'سأعيد المحاولة بعد ' + waitMin + ' دقيقة. للاستمرار الآن: أضف مفتاح مزود آخر (Groq مجاني بلا بطاقة) من «إضافة مفتاح».', 'err');
      a.nextAt = Date.now() + waitMin * 60 * 1000; saveNow();
    }).then(function () {
      apBusy = false; saveState(); apRender();
    });
  }

  function apTick() {
    var a = apState();
    if (!a.enabled || apBusy || state.emergencyMode) return;
    if (typeof isUnlocked === 'function' && !isUnlocked()) return;
    if (Date.now() >= (a.nextAt || 0)) apCycle();
  }
  function apWakeLock() {
    try {
      if (navigator.wakeLock && !apWake && document.visibilityState === 'visible') {
        navigator.wakeLock.request('screen').then(function (l) { apWake = l; l.addEventListener('release', function () { apWake = null; }); }).catch(function () { /* optional */ });
      }
    } catch (e) { /* optional */ }
  }
  function apStart(goal) {
    var a = apState();
    a.goal = String(goal || a.goal || '').trim();
    if (a.scan && a.scan.site !== apSite()) { a.scan = null; a.projects = []; }
    a.enabled = true; a.nextAt = 0; a.startedAt = a.startedAt || nowIso(); saveNow();
    logAudit('autopilot_started', 'ceo', 'Autopilot started', { goal: a.goal.slice(0, 120) });
    apLog('بدأت الأتمتة. الهدف: ' + (a.goal || 'مشاريع الموقع'), 'ok');
    apWakeLock();
    apTick();
  }
  function apStop() {
    var a = apState();
    a.enabled = false; saveNow();
    apLog('تم إيقاف الأتمتة. ستستأنف من آخر نقطة محفوظة عند فتح المكتب مجدداً.', 'info');
  }

  /* ── autopilot panel ────────────────────────────────────────────────── */
  function apRender() {
    var box = document.getElementById('apModal');
    if (!box) return;
    var a = apState();
    var st = box.querySelector('#apStatus');
    if (st) {
      st.className = 'ap-status ' + (a.needs ? 'warn' : a.enabled ? 'ok' : '');
      st.textContent = a.needs === 'key' ? '🔑 متوقفة مؤقتاً: أضف مفتاح نموذج من حسابك لتكمل.' :
        apBusy ? '⚙️ تعمل الآن على خطوة...' : a.enabled ? '🟢 تعمل — الخطوة التالية خلال ' + Math.max(0, Math.round(((a.nextAt || 0) - Date.now()) / 1000)) + ' ث' : '⚪ متوقفة';
    }
    var stats = box.querySelector('#apStats');
    if (stats) stats.innerHTML = '<span>🌐 صفحات ممسوحة: ' + (a.scan ? (a.scan.scanned || 0) + '/' + (a.scan.allUrls || a.scan.queue || []).length : 0) + '</span><span>📚 مرشحات: ' + (a.scan && a.scan.candidateCount || a.projects.length) + '</span><span>✅ محلَّلة: ' + Object.keys(a.everAnalyzed || {}).length + '</span><span>👥 عملاء محتملون: ' + (a.leads || 0) + '</span><span>📣 حملات بانتظارك: ' + (a.campaigns || 0) + '</span><span>🔁 دورات: ' + (a.cycle || 0) + '</span>';
    var log = box.querySelector('#apLog');
    if (log) log.innerHTML = a.log.slice(0, 25).map(function (x) { return '<div class="ap-line ' + esc(x.k) + '"><small>' + esc(String(x.t).slice(11, 19)) + '</small> ' + esc(x.m) + '</div>'; }).join('') || '<div class="ap-line">لم تبدأ بعد.</div>';
    var tgl = box.querySelector('#apToggle');
    if (tgl) tgl.textContent = a.enabled ? '⏹️ إيقاف الأتمتة' : '▶️ تشغيل الأتمتة';
  }
  function openAutopilot() {
    if (document.getElementById('apModal')) return;
    var a = apState();
    var m = document.createElement('div');
    m.id = 'apModal'; m.className = 'office-modal';
    m.innerHTML = '<div class="office-modal-card">' +
      '<h2>🤖 أتمتة العمل</h2>' +
      '<p>تحصر صفحات الموقع عبر Sitemap والروابط الداخلية، ثم تحلل كل صفحة منتج/مشروع وتقيّمها بمؤشر تجاري موحّد وترتبها من الأعلى للأقل. يبحث عن شركات حقيقية ويضيف إلى CRM فقط من يظهر له بريد أو هاتف منشور. المسودات لا تُرسل ولا تُنشر إلا بقرارك. الحفظ محلي في هذا المتصفح: تعمل الصفحة وهي مفتوحة، وتستأنف من آخر نقطة محفوظة عند إعادة فتحها؛ لا تعمل أثناء إغلاق المتصفح في هذه النسخة الثابتة.</p>' +
      '<label>الهدف (يمكنك ذكر رابط موقعك)</label>' +
      '<textarea id="apGoal" rows="3" placeholder="مثال: روّج لمشاريع https://mdm1.org/ وحقق أول مبيعات">' + esc(a.goal || 'ابحث عن مشاريع حقيقية من https://mdm1.org/ وروّج لها وحقق أرباحاً من المبيعات') + '</textarea>' +
      '<div id="apStatus" class="ap-status"></div><div id="apStats" class="ap-stats"></div>' +
      '<div class="ap-actions"><button type="button" class="btn btn-primary" id="apToggle"></button>' +
      '<button type="button" class="btn btn-secondary" id="apNow">⚡ نفّذ خطوة الآن</button>' +
      '<button type="button" class="btn btn-secondary" id="apKey">🔑 إضافة مفتاح</button>' +
      '<button type="button" class="btn btn-secondary" id="apApprovals">⏳ الموافقات</button>' +
      '<button type="button" class="btn btn-secondary" id="apClose">إغلاق</button></div>' +
      '<div id="apLog" class="ap-log"></div></div>';
    document.body.appendChild(m);
    function close() { window.clearInterval(refresh); m.remove(); }
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    m.querySelector('#apClose').onclick = close;
    m.querySelector('#apToggle').onclick = function () {
      if (apState().enabled) apStop(); else apStart(m.querySelector('#apGoal').value);
    };
    m.querySelector('#apNow').onclick = function () { apState().goal = m.querySelector('#apGoal').value.trim(); apState().nextAt = 0; if (!apState().enabled) apStart(apState().goal); else apTick(); };
    m.querySelector('#apKey').onclick = function () { close(); openConnectionPanel({ focus: 'api' }); };
    m.querySelector('#apApprovals').onclick = function () { close(); shGoTab('approvals'); };
    var refresh = window.setInterval(apRender, 1000);
    apRender();
  }

  /* ── start-here guide: every tick comes from real state ─────────────── */
  var shIdentity = { at: 0, v: null };
  function shLinkedTelegram() {
    var A = window.MDM1Auth;
    if (!A || !A.status || !A.status().googleReady) return Promise.resolve(false);
    if (Date.now() - shIdentity.at < 20000 && shIdentity.v !== null) return Promise.resolve(shIdentity.v);
    return A.relay('identity_get', {}).then(function (r) {
      var i = (r && r.identities) || r || {};
      shIdentity = { at: Date.now(), v: Boolean(i.telegram) };
      return shIdentity.v;
    }).catch(function () { return false; });
  }
  function shGoTab(tab) {
    var b = document.querySelector('.nav-item[data-tab="' + tab + '"]');
    if (b) b.click();
  }
  function shSteps(tg) {
    var A = window.MDM1Auth, st = A && A.status ? A.status() : {};
    var live = apModelReady();
    var chatted = state.teamChat.some(function (x) { return x.role === 'user'; }) || Object.keys(state.directChats || {}).some(function (k) { return (state.directChats[k] || []).length; });
    var backup = ''; try { backup = localStorage.getItem('mdm1_office_v2_last_backup') || ''; } catch (e) { /* none */ }
    var ap = apState();
    return [
      { t: 'سجّل الدخول بحساب Google', d: 'هويتك تحمي بياناتك، ولا يستخدم أحد مفاتيح غيرك.', done: Boolean(st.googleReady), b: 'الحساب', run: function () { if (A) A.openPanel(); } },
      { t: 'أضف مفتاح ذكاء اصطناعي خاص بك', d: 'Groq أو OpenRouter أو OpenCode Zen — فيها خيارات مجانية. يُخزَّن مشفّراً على جهازك فقط.', done: live, b: 'إضافة API', run: function () { openConnectionPanel({ focus: 'api' }); } },
      { t: 'أعطِ الموظفين أول مهمة حقيقية', d: 'اكتب في «المحادثات» ما تريد، وسيردّون بحلول وتنفيذ.', done: chatted, b: 'المحادثات', run: function () { shGoTab('chat'); } },
      { t: 'شغّل «أتمتة العمل»', d: 'تبحث وتحلّل وتجهّز الحملات وتجمع العملاء لوحدها.', done: Boolean(ap.enabled || ap.cycle), b: 'فتح الأتمتة', run: openAutopilot },
      { t: 'أضف أول عميل حقيقي', d: 'من «العملاء (CRM)» أضف عميلاً وقيمة العقد.', done: state.customers.length > 0, b: 'العملاء', run: function () { shGoTab('crm'); } },
      { t: 'سجّل أول إيراد أو مصروف', d: 'من «الأرباح والخسائر» لتظهر أرباحك الفعلية.', done: state.financialLedger.length > 0, b: 'الأرباح', run: function () { shGoTab('pnl'); } },
      { t: 'اربط تليجرام لتصلك النتائج (اختياري)', d: 'إشعار بكل حملة ونتيجة تجهزها الأتمتة.', done: Boolean(tg), b: 'ربط تليجرام', run: function () { openMessaging('telegram'); } },
      { t: 'خذ نسخة احتياطية', d: 'بياناتك في متصفحك؛ النسخة تحميها من الفقد.', done: Boolean(backup), b: 'النسخ الاحتياطي', run: function () { shGoTab('backup'); } }
    ];
  }
  function openStartHere() {
    var old = document.getElementById('shModal'); if (old) old.remove();
    shLinkedTelegram().then(function (tg) {
      if (document.getElementById('shModal')) return;
      var steps = shSteps(tg), done = steps.filter(function (s) { return s.done; }).length;
      var next = steps.findIndex(function (s) { return !s.done; });
      var m = document.createElement('div');
      m.id = 'shModal'; m.className = 'office-modal';
      m.innerHTML = '<div class="office-modal-card"><h2>🚀 ابدأ هنا</h2><p>' + done + ' من ' + steps.length + ' مكتملة. العلامات تُحسب من حالة مكتبك الفعلية.</p>' +
        '<div class="sh-bar"><i style="width:' + Math.round(done / steps.length * 100) + '%"></i></div>' +
        steps.map(function (s, i) {
          return '<div class="sh-step ' + (s.done ? 'done' : i === next ? 'next' : '') + '"><span class="sh-mark">' + (s.done ? '✅' : i === next ? '👉' : '⬜') + '</span><div><strong>' + (i + 1) + '. ' + esc(s.t) + '</strong><small>' + esc(s.d) + '</small></div>' +
            (s.done ? '' : '<button type="button" class="btn btn-secondary" data-i="' + i + '">' + esc(s.b) + '</button>') + '</div>';
        }).join('') +
        '<div class="ap-actions"><button type="button" class="btn btn-primary" id="shClose">إغلاق</button></div></div>';
      document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
      m.querySelector('#shClose').onclick = function () { m.remove(); };
      Array.prototype.forEach.call(m.querySelectorAll('button[data-i]'), function (b) {
        b.onclick = function () { var s = steps[Number(b.getAttribute('data-i'))]; m.remove(); s.run(); };
      });
    });
  }

  function autopilotInit() {
    var a = apState();
    var b1 = document.getElementById('quickStartBtn'); if (b1) b1.onclick = openStartHere;
    var b2 = document.getElementById('autopilotBtn'); if (b2) b2.onclick = openAutopilot;
    if (apTimer) return;
    window.addEventListener('pagehide', function () { try { saveNow(); } catch (_) {} });
    window.addEventListener('beforeunload', function () { try { saveNow(); } catch (_) {} });
    apTimer = window.setInterval(apTick, 5000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { apWakeLock(); apTick(); } });
    if (a.enabled) { if (a.scan && a.scan.inFlight) { a.scan.cursor = Math.min(num(a.scan.cursor, 0), num(a.scan.inFlight.start, 0)); a.scan.inFlight = null; } a.nextAt = 0; saveNow(); apLog('استأنفت الأتمتة من آخر نقطة محفوظة بعد فتح التطبيق.', 'info'); apWakeLock(); window.setTimeout(apTick, 1500); }
    if (!settings.onboardingSeen) {
      settings.onboardingSeen = true; saveSettings();
      window.setTimeout(openStartHere, 1500);
    }
  }
