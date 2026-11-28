'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ci = require('../office/conversation-intelligence');

test('audience-by-product is accepted as a clarification, not rejected as missing data', () => {
  const message = 'الجمهور المستهدف يتم اختياره حسب المشروع أكيد';
  assert.equal(ci.isAudienceByProject(message), true);
  const turn = ci.classifyTurn(message, [{ role: 'assistant', text: 'من هو الجمهور المستهدف؟' }]);
  assert.equal(turn.kind, 'clarification');
  assert.equal(turn.shouldQueue, false);
  assert.equal(turn.shouldAskAgain, false);
});

test('sales profit is a clear business goal and does not trigger a new task or clarification loop', () => {
  const message = 'تحقيق أرباح من المبيعات';
  assert.equal(ci.isRevenueGoal(message), true);
  const turn = ci.classifyTurn(message, [{ role: 'assistant', text: 'ماذا تقصد بالربح منها؟' }]);
  assert.equal(turn.kind, 'clarification');
  assert.equal(turn.shouldQueue, false);
  assert.equal(turn.shouldAskAgain, false);
});

test('an explicit request to research MDM1 products remains actionable and triggers a real site scan', () => {
  const message = 'ابحث عن مشاريع حقيقية من موقعنا https://mdm1.org/ يمكننا الترويج لها والربح منها';
  const turn = ci.classifyTurn(message, []);
  assert.equal(turn.kind, 'request');
  assert.equal(turn.shouldQueue, true);
  assert.equal(ci.shouldResearchSite(message), true);
  assert.equal(ci.isRevenueGoal(message), true);
});

test('a short answer to the previous agent question is treated as conversational context', () => {
  const history = [
    { role: 'user', text: 'ابحثي عن مشاريع من الموقع' },
    { role: 'assistant', text: 'هل نبيع للأفراد أم للشركات؟' }
  ];
  const turn = ci.classifyTurn('للشركات الصغيرة، واختاري الأنسب لكل مشروع', history);
  assert.equal(turn.kind, 'clarification');
  assert.equal(turn.shouldQueue, false);
});

test('audiences are inferred from actual product functionality rather than asked globally', () => {
  assert.match(ci.inferAudience('تطبيق إدارة العملاء والفواتير والمخزون', 'CRM للفواتير والمبيعات'), /أصحاب المتاجر|الأنشطة الصغيرة/);
  assert.match(ci.inferAudience('منصة SEO', 'تحليل الكلمات المفتاحية وتدقيق المواقع'), /SEO|وكالات التسويق/);
  assert.match(ci.inferAudience('مقص الفيديو العمودي', 'تقطيع الفيديو إلى مقاطع قصيرة'), /صنّاع المحتوى|وكالات/);
});

test('chat replies should distinguish conversation from an executable command', () => {
  const turn = ci.classifyTurn('نعم، هذا هو المقصود', [{ role: 'assistant', text: 'هل هذا ما تريده؟' }]);
  assert.equal(turn.kind, 'clarification');
  assert.match(ci.buildTurnContext(turn), /لا تنشئي مهمة جديدة/);
});
