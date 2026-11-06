// Shared quality gate: blocks titles/descriptions that contain leaked model reasoning, placeholders, or are empty.
// Used by build-pages.js (before a page is written) and by scripts/check-page-quality.js (CI over all pages).
const LEAK = [
  /\blet me\b/i, /\blet's (think|see|pick)\b/i, /<\/?think>/i, /\bno need for tools\b/i,
  /<one sentence>/i, /\bI'll\b/, /\bshould I\b/i, /\bsomething like\b/i,
  /\bthinking\b/i, /\bhmm+\b/i, /\bwait,/i, /"\s*(or|\/)\s*"/i, /"\.\s*or\s+"/i, /\bor\s+"[A-Za-z]/,
  // leaked naming-step instructions (Arabic)
  /اختيار اسم فريد|فحص العلامة والنطاق|فحص النطاقات/,
];
const PLACEHOLDER = [/\blorem ipsum\b/i, /\bTODO\b/, /\bTBD\b/, /undefined|\bnull\b|\[object Object\]/];

function field(name, value, { min = 1, max = 220 } = {}) {
  const v = String(value ?? '').replace(/\s+/g, ' ').trim();
  const out = [];
  if (v.length < min) out.push(`${name}: فارغ أو قصير جدًا`);
  if (v.length > max) out.push(`${name}: أطول من ${max} حرفًا (قد يكون نصًا مقطوعًا أو مسرّبًا)`);
  for (const r of LEAK) if (r.test(v)) { out.push(`${name}: يحتوي نص تفكير مسرّب (${r})`); break; }
  for (const r of PLACEHOLDER) if (r.test(v)) { out.push(`${name}: يحتوي نصًا بديلًا (${r})`); break; }
  const quotes = (v.match(/"/g) || []).length;
  if (quotes % 2 === 1) out.push(`${name}: علامات اقتباس غير متوازنة (اسم مقطوع)`);
  return out;
}

// title: the visible title; description: meta description. Returns an array of problems (empty = fine).
function findProblems({ title, description }) {
  return [...field('العنوان', title, { min: 3, max: 140 }), ...field('الوصف', description, { min: 15, max: 400 })];
}
// Body text: only leaked-reasoning markers matter (a long plan legitimately contains quotes and Latin words).
function findBodyProblems(body) {
  const v = String(body ?? '');
  return LEAK.filter(r => r.test(v)).map(r => `النص: يحتوي نص تفكير مسرّب (${r})`);
}
module.exports = { findProblems, findBodyProblems };
