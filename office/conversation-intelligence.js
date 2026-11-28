(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MDM1ConversationIntelligence = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function normalizeArabic(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var ACTION_RX = /(?:^|\s)(?:ابحث|ابحثي|ابحثوا|نفذ|نفذي|نفذوا|اعمل|اعملي|انشئ|انشئي|جهز|جهزي|اكتب|اكتبي|حلل|حللي|راجع|راجعي|قارن|قارني|استخرج|استخرجي|ابن|ابني|طور|طوري|اطلق|اطلقي|انشر|انشري|ارسل|ارسلي|احسب|احسبي|صمم|صممي|جهز|قدمي|قدم|اريد|عايز|عاوزه|عاوز|نريد|نحتاج)(?![\p{L}\p{N}])/u;
  var QUESTION_RX = /(?:\?|؟|❓|ما لم افهم|لم افهم|ماذا تريد|ماذا تقصد|من هو الجمهور|ما الجمهور|هل تريد|هل لدينا|ما المخرج|ايهما|أيّهما)/iu;

  function isAudienceByProject(value) {
    var s = normalizeArabic(value);
    return /(?:الجمهور|الشريحه|العملاء).{0,55}(?:حسب|وفقا|وفق|لكل|على حسب).{0,35}(?:المشروع|مشروع|المنتج|منتج|الخدمه|خدمه)|(?:حسب|لكل).{0,25}(?:المشروع|مشروع|المنتج|منتج|الخدمه|خدمه).{0,35}(?:الجمهور|الشريحه)/u.test(s)
      || /(?:الجمهور|الشريحه).{0,45}(?:يتحدد|يحدد|نحدد|يتم اختياره|يتم تحديده).{0,35}(?:حسب|لكل)/u.test(s);
  }

  function isRevenueGoal(value) {
    var s = normalizeArabic(value);
    return /(?:تحقيق|نحقق|نزيد|زياده|جلب|توليد).{0,35}(?:الارباح|ارباح|ربح|دخل|مبيعات|ايراد)|(?:الربح|الارباح|ربح)\s+منها|(?:الربح|الارباح|ربح).{0,25}(?:من|عن طريق).{0,25}(?:المبيعات|البيع|الترويج|المنتجات)|(?:بيع|نبيع|تسويق).{0,30}(?:المنتجات|المشاريع|الخدمات)/u.test(s);
  }

  function isContextualConstraint(value) {
    return isAudienceByProject(value) || isRevenueGoal(value);
  }

  function hasExplicitAction(value) {
    var s = normalizeArabic(value);
    return ACTION_RX.test(s) || /(?:ابحث عن|اعمل لي|اعملي لي|ابدأ|ابدئي|نفذ هذا|نفذي هذا|ابدأ التنفيذ)/u.test(s);
  }

  function lastAssistantText(history) {
    var list = Array.isArray(history) ? history : [];
    for (var i = list.length - 1; i >= 0; i--) {
      var item = list[i] || {};
      var assistant = item.role === 'assistant'
        || (item.senderId && item.senderId !== 'ceo' && item.senderId !== 'system');
      if (assistant && (item.text || item.content)) return String(item.text || item.content);
    }
    return '';
  }

  function classifyTurn(message, history) {
    var raw = String(message || '').trim();
    var prior = lastAssistantText(history);
    var explicit = hasExplicitAction(raw);
    var constraint = isContextualConstraint(raw);
    var answerToQuestion = !explicit && raw.length <= 260 && QUESTION_RX.test(prior);
    var shortFollowUp = !explicit && raw.length <= 120 && Array.isArray(history) && history.length > 0
      && !/[?؟]/.test(raw)
      && /(?:اكيد|تمام|موافق|صحيح|بالضبط|كما قلت|حسب المشروع|لكل مشروع|الهدف|المقصود|اقصد|اقصد ان)/u.test(normalizeArabic(raw));
    if (!explicit && (constraint || answerToQuestion || shortFollowUp)) {
      return {
        kind: 'clarification',
        shouldQueue: false,
        shouldAskAgain: false,
        note: constraint && isAudienceByProject(raw)
          ? 'قيد محفوظ: اختيار الجمهور يتم لكل مشروع حسب طبيعته.'
          : (constraint && isRevenueGoal(raw)
            ? 'هدف تجاري محفوظ: تحقيق إيراد فعلي من المبيعات.'
            : 'هذه متابعة/إجابة مرتبطة بسياق المحادثة السابقة وليست طلب مهمة جديدة.')
      };
    }
    return {
      kind: hasExplicitAction(raw) ? 'request' : 'conversation',
      shouldQueue: hasExplicitAction(raw),
      shouldAskAgain: false,
      note: ''
    };
  }

  function inferAudience(title, description) {
    var s = normalizeArabic(String(title || '') + ' ' + String(description || ''));
    if (/(فواتير|فاتوره|invoice|crm|عملاء|مخزون|نقطه بيع|كاشير|متجر|مبيعات|pos)/u.test(s)) {
      return 'أصحاب المتاجر والأنشطة الصغيرة والمستقلون ومقدمو الخدمات؛ ابدأ بالسوق العربي حيث توجد واجهة RTL، ثم وسّع حسب طلب التخصيص';
    }
    if (/(seo|كلمات مفتاحيه|تدقيق|ترتيب|روابط خلفيه)/u.test(s)) {
      return 'مستقلو SEO ووكالات التسويق الرقمي وأصحاب المتاجر والمواقع الصغيرة الذين يحتاجون تقارير تدقيق قابلة للتصدير';
    }
    if (/(فيديو|مقاطع|clip|مونتاج|عمودي|ريلز|shorts)/u.test(s)) {
      return 'صنّاع المحتوى ومديرو حسابات التواصل ووكالات إنتاج المحتوى والمحررون المستقلون';
    }
    if (/(موعد|حجز|استقبال|مكالمة|عياده)/u.test(s)) {
      return 'الأعمال التي تعتمد على المواعيد والاستفسارات: العيادات ومراكز الخدمات والورش والاستشاريون';
    }
    if (/(توظيف|موارد بشريه|حضور|اجازات|رواتب)/u.test(s)) {
      return 'الشركات الصغيرة التي لا تستخدم نظام موارد بشرية متكاملاً أو تحتاج نموذجاً محلياً بسيطاً';
    }
    return 'لا أستطيع تعيين شريحة دقيقة من الاسم وحده؛ استخرجها من الوظيفة الفعلية وصفحة المنتج قبل اعتماد العرض';
  }

  function shouldResearchSite(message) {
    var s = normalizeArabic(message);
    var mentionsSite = /mdm1\.org|موقعنا|موقع mdm1|موقع الشركه|كتالوج mdm1|مشاريعنا|تطبيقاتنا|ادواتنا/u.test(s);
    var asksResearch = /ابحث|استخرج|احصر|راجع|مشاريع|منتجات|تطبيقات|ادوات|فرص|ارباح|ربح|مبيعات|ترويج|تسويق/u.test(s);
    return mentionsSite && asksResearch;
  }

  function compact(value, max) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max || 500);
  }

  function pageText(doc) {
    return compact(doc && doc.body ? (doc.body.innerText || doc.body.textContent || '') : '', 18000);
  }

  function fetchDoc(path) {
    if (!root || !root.fetch || !root.DOMParser) return Promise.resolve({ path: path, error: 'تعذر الفحص داخل المتصفح الحالي: fetch أو DOMParser غير متاح.' });
    return root.fetch(path, { method: 'GET', credentials: 'same-origin', cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text().then(function (html) {
        var doc = new root.DOMParser().parseFromString(html, 'text/html');
        return { path: path, doc: doc };
      });
    }).catch(function (error) {
      return { path: path, error: String(error && error.message || error) };
    });
  }

  function appCards(doc) {
    if (!doc) return [];
    var result = [], seen = {};
    Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), function (a) {
      var href = '';
      try {
        var url = new URL(a.getAttribute('href'), root.location.origin);
        if (url.origin !== root.location.origin || url.pathname.indexOf('/apps/') !== 0 || /\/apps\/?$/.test(url.pathname)) return;
        href = url.pathname;
      } catch (_) { return; }
      var title = compact(a.textContent, 180);
      if (!title || title.length < 5 || seen[href]) return;
      seen[href] = true;
      var box = a.closest('.card') || a.closest('.it') || a.parentElement;
      var descriptionNode = box && box.querySelector('.card-text, p');
      var cardText = compact(box && box.textContent, 500);
      result.push({
        title: title,
        description: compact(descriptionNode ? descriptionNode.textContent : cardText, 340),
        path: href,
        proListed: /(?:^|\s)pro(?:\s|$)/iu.test(cardText),
        listingText: cardText
      });
    });
    return result;
  }

  function candidateScore(item) {
    var s = normalizeArabic(item.title + ' ' + item.description);
    var score = item.proListed ? 2 : 0;
    if (/(فواتير|فاتوره|invoice|crm|عملاء)/u.test(s)) score += 10;
    if (/(مخزون|متجر|نقطه بيع|كاشير|pos|مبيعات)/u.test(s)) score += 9;
    if (/(seo|كلمات مفتاحيه|تدقيق الصفحات|روابط خلفيه)/u.test(s)) score += 9;
    if (/(فيديو|مقاطع|clip|عمودي|ريلز|shorts)/u.test(s)) score += 7;
    if (/(نموذج|حجز|استقبال|مكالمة|موارد بشريه)/u.test(s)) score += 5;
    return score;
  }

  function extractPageOffer(item, doc) {
    var titleNode = doc.querySelector('h1');
    var meta = doc.querySelector('meta[name="description"]');
    var text = pageText(doc);
    var priceMatches = text.match(/(?:\d+(?:[.,]\d+)?\s*(?:USDT|USD|\$)|(?:USDT|USD|\$)\s*\d+(?:[.,]\d+)?)/giu) || [];
    var hasCustomization = /نسخه مخصصه|تخصيص|معدا لنشاطك|معد لنشاطك|white[\s-]?label/iu.test(text);
    var offer = '';
    var offerNodes = doc.querySelectorAll('.card, .notice, p');
    for (var i = 0; i < offerNodes.length; i++) {
      var nodeText = compact(offerNodes[i].textContent, 900);
      if (/نسخه مخصصه لنشاطك|معدا لنشاطك|معد لنشاطك/iu.test(nodeText) && nodeText.length > 40) {
        offer = nodeText;
        break;
      }
    }
    return {
      title: compact(titleNode ? titleNode.textContent : item.title, 180),
      description: compact(meta ? meta.getAttribute('content') : item.description, 400),
      url: 'https://mdm1.org' + item.path,
      proListed: item.proListed,
      customizationOfferFound: hasCustomization,
      priceEvidence: priceMatches.slice(0, 5),
      offerText: compact(offer, 650),
      robots: (doc.querySelector('meta[name="robots"]') || {}).content || 'indexable/unknown',
      audienceHypothesis: inferAudience(titleNode ? titleNode.textContent : item.title, meta ? meta.getAttribute('content') : item.description)
    };
  }

  function serviceCards(doc) {
    if (!doc) return [];
    var out = [];
    Array.prototype.forEach.call(doc.querySelectorAll('.service-card'), function (card) {
      out.push({
        title: compact((card.querySelector('h3') || {}).textContent, 120),
        description: compact((card.querySelector('p') || {}).textContent, 350),
        price: compact((card.querySelector('.package-price') || {}).textContent, 90)
      });
    });
    return out;
  }

  function fetchMdm1SiteResearch() {
    var paths = ['/apps/index.html', '/projects/index.html', '/pages/hub-services.html'];
    return Promise.all(paths.map(fetchDoc)).then(function (pages) {
      var appPage = pages[0], projectPage = pages[1], servicePage = pages[2];
      var apps = appCards(appPage && appPage.doc);
      apps.sort(function (a, b) { return candidateScore(b) - candidateScore(a); });
      var candidates = apps.filter(function (x) { return candidateScore(x) >= 5; }).slice(0, 10);
      var details = candidates.map(function (item) {
        return fetchDoc(item.path).then(function (page) {
          if (page.error) return { title: item.title, url: 'https://mdm1.org' + item.path, error: page.error, description: item.description, audienceHypothesis: inferAudience(item.title, item.description) };
          return extractPageOffer(item, page.doc);
        });
      });
      return Promise.all(details).then(function (products) {
        var projectCount = 0, projects = [];
        if (projectPage && projectPage.doc) {
          projects = Array.prototype.slice.call(projectPage.doc.querySelectorAll('.it')).map(function (node) {
            var a = node.querySelector('h3 a, a[href]');
            return a ? { title: compact(a.textContent, 130), url: a.href, summary: compact((node.querySelector('p') || {}).textContent, 180) } : null;
          }).filter(Boolean);
          projectCount = projects.length;
        }
        var serviceList = serviceCards(servicePage && servicePage.doc);
        var out = {
          source: 'فحص مباشر لصفحات mdm1.org من المتصفح',
          fetchedAt: new Date().toISOString(),
          listingStatus: appPage && appPage.error ? 'failed' : 'fetched',
          listingUrl: 'https://mdm1.org/apps/',
          productCountInListing: apps.length,
          candidates: products,
          projectListingStatus: projectPage && projectPage.error ? 'failed' : 'fetched',
          projectListingNoindex: projectPage && projectPage.doc ? /noindex/i.test(((projectPage.doc.querySelector('meta[name="robots"]') || {}).content || '')) : null,
          projectSamples: projects.slice(0, 12),
          servicesStatus: servicePage && servicePage.error ? 'failed' : 'fetched',
          services: serviceList,
          errors: pages.filter(function (x) { return x.error; }).map(function (x) { return { path: x.path, error: x.error }; })
        };
        var lines = ['مصدر البيانات: ' + out.source, 'وقت الجمع: ' + out.fetchedAt];
        if (out.listingStatus === 'fetched') lines.push('عدد روابط التطبيقات الفريدة المستخرجة من صفحة القائمة: ' + apps.length);
        else lines.push('تعذر جلب قائمة التطبيقات: ' + (appPage.error || 'غير معروف'));
        lines.push('مرشحون تجاريون تم فحص صفحاتهم:');
        products.forEach(function (p) {
          lines.push('- ' + p.title + ' | ' + p.url);
          if (p.description) lines.push('  الوصف: ' + p.description);
          if (p.priceEvidence && p.priceEvidence.length) lines.push('  أرقام أسعار ظاهرة في الصفحة: ' + p.priceEvidence.join('، '));
          if (p.offerText) lines.push('  نص عرض التخصيص: ' + p.offerText);
          if (p.error) lines.push('  حالة الفحص: تعذر فتح التفاصيل (' + p.error + ')');
          lines.push('  الجمهور المحتمل (استدلال من وظيفة المنتج وليس بيانات مبيعات): ' + p.audienceHypothesis);
        });
        if (out.projectListingStatus === 'fetched') {
          lines.push('صفحة المشاريع قيد البناء: ' + projects.length + ' بطاقة مشروع ظاهرة في الصفحة. لا تخلطها بالتطبيقات المنشورة الجاهزة.');
          lines.push('وسم noindex في صفحة المشاريع: ' + String(out.projectListingNoindex));
          projects.slice(0, 6).forEach(function (p) { lines.push('- فكرة/مشروع قيد البناء: ' + p.title + ' | ' + p.url); });
        } else lines.push('تعذر جلب صفحة المشاريع قيد البناء: ' + (projectPage.error || 'غير معروف'));
        if (out.servicesStatus === 'fetched') {
          lines.push('باقات الخدمات المنشورة:');
          serviceList.forEach(function (x) { lines.push('- ' + x.title + ' | ' + x.price + ' | ' + x.description); });
        } else lines.push('تعذر جلب صفحة الخدمات والأسعار: ' + (servicePage.error || 'غير معروف'));
        lines.push('قيد إلزامي: لا توجد بيانات مبيعات أو تحويل أو تكلفة اكتساب عميل ضمن هذه الصفحات؛ لا تخترعها. افصل الأسعار المنشورة عن أي تسعير مقترح.');
        return { data: out, context: lines.join('\n') };
      });
    });
  }

  function buildTurnContext(turn) {
    if (!turn) return '';
    if (turn.kind === 'clarification') {
      return 'الرسالة الحالية توضيح/إجابة في سياق المحادثة السابقة. لا تنشئي مهمة جديدة ولا تعيدي السؤال الذي أجاب عنه المدير. احفظي القيد وطبقيه على الطلب الأصلي. القيد: ' + turn.note;
    }
    return 'اقرئي سجل المحادثة السابق كاملاً قبل الرد. لا تعاملي كل رسالة كطلب مستقل.';
  }

  return {
    normalizeArabic: normalizeArabic,
    isAudienceByProject: isAudienceByProject,
    isRevenueGoal: isRevenueGoal,
    isContextualConstraint: isContextualConstraint,
    hasExplicitAction: hasExplicitAction,
    classifyTurn: classifyTurn,
    inferAudience: inferAudience,
    shouldResearchSite: shouldResearchSite,
    fetchMdm1SiteResearch: fetchMdm1SiteResearch,
    buildTurnContext: buildTurnContext
  };
});
