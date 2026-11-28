'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../office/autopilot-engine');

test('site crawl accepts all same-origin pages, strips fragments and rejects external/assets', () => {
  assert.equal(engine.normalizeUrl('/apps/tool.html#demo', 'https://mdm1.org/'), 'https://mdm1.org/apps/tool.html');
  assert.equal(engine.isPageUrl('https://mdm1.org/pages/25.html', 'https://mdm1.org/'), true);
  assert.equal(engine.isPageUrl('https://evil.example/pages/25.html', 'https://mdm1.org/'), false);
  assert.equal(engine.isPageUrl('https://mdm1.org/image.webp', 'https://mdm1.org/'), false);
});

test('project inventory is dynamic and includes numbered project pages and app detail pages', () => {
  assert.equal(engine.isProjectPage({url:'https://mdm1.org/pages/730.html',title:'Project plan',text:'Revenue model'}), true);
  assert.equal(engine.isProjectPage({url:'https://mdm1.org/apps/offline-invoice-crm.html',title:'Invoice CRM',text:'Invoices and stock'}), true);
  assert.equal(engine.isProjectPage({url:'https://mdm1.org/pages/hub-services.html',title:'Hub services',text:'Pricing'}), false);
  assert.equal(engine.isProjectPage({url:'https://mdm1.org/en/pages/730.html',title:'Project plan'}), false);
});

test('profitability is a weighted index and assessments sort highest first', () => {
  const high = engine.profitabilityScore({revenueClarity:90,readiness:90,marginPotential:80,audienceReach:80,evidenceStrength:90,deliveryEase:70});
  const low = engine.profitabilityScore({revenueClarity:20,readiness:20,marginPotential:30,audienceReach:30,evidenceStrength:20,deliveryEase:20});
  assert.ok(high > low);
  assert.deepEqual(engine.sortAssessments([{title:'low',profitabilityScore:low},{title:'high',profitabilityScore:high}]).map(x=>x.title), ['high','low']);
});

test('models with passing role benchmarks are sorted strongest to weakest; unknown models stay after tested ones', () => {
  const benchmarks = {
    a:{provider:'zen',model:'zeta',role:'web-research-team',score:91,passed:true},
    b:{provider:'zen',model:'alpha',role:'web-research-team',score:73,passed:true}
  };
  assert.deepEqual(engine.sortModels([{id:'alpha'},{id:'unknown'},{id:'zeta'}],benchmarks,'opencode-zen','web-research-team').map(x=>x.id),['zeta','alpha','unknown']);
});

test('prospects are not created from generic search pages or results without a contact method', () => {
  assert.equal(engine.validProspect({name:'Acme Studio',url:'https://acme.example/',email:'sales@acme.example'}),true);
  assert.equal(engine.validProspect({name:'Acme Studio',url:'https://acme.example/'}),false);
  assert.equal(engine.validProspect({name:'Wikipedia',url:'https://en.wikipedia.org/wiki/Acme',email:'x@y.example'}),false);
});

test('Jina search reader markdown is parsed into distinct source URLs', () => {
  const rows = engine.parseMarkdownSearchResults('[Acme](https://acme.example/)\nA real company profile.\n\n[Beta](https://beta.example/)\nAnother company.', 'crm');
  assert.equal(rows.length,2);
  assert.equal(rows[0].title,'Acme');
  assert.match(rows[0].snippet,/real company/);
});
