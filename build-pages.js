#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// قراءة البيانات
const dataFile = fs.readFileSync('pages-data.json', 'utf8');
const data = JSON.parse(dataFile);

// قراءة عدد الصفحات المولدة من ملف الحالة (state)
let stateFile = 'build-state.json';
let state = { pageCount: 0, lastUpdate: new Date().toISOString() };

if (fs.existsSync(stateFile)) {
  state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
}

// دالة اختيار عشوائي من مصفوفة
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// دالة إنشاء رقم عشوائي في نطاق
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// دالة إنشاء محتوى HTML
function generatePageHTML(pageIndex, title, description, color, cta, bgColor) {
  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const template = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - MD1usd</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Tajawal', sans-serif;
      background: linear-gradient(135deg, #${bgColor.slice(1)} 0%, #050403 100%);
      color: #e8d5a3;
      min-height: 100vh;
      overflow-x: hidden;
    }
    
    header {
      background: rgba(5, 4, 3, 0.95);
      border-bottom: 2px solid #${bgColor.slice(1)};
      padding: 1.5rem;
      text-align: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .logo {
      font-family: 'Cinzel', serif;
      font-size: 1.8rem;
      color: #${bgColor.slice(1)};
      text-decoration: none;
      font-weight: bold;
    }
    
    .nav-links {
      display: flex;
      gap: 2rem;
      list-style: none;
    }
    
    .nav-links a {
      color: #e8d5a3;
      text-decoration: none;
      transition: color 0.3s;
    }
    
    .nav-links a:hover {
      color: #${bgColor.slice(1)};
    }
    
    main {
      max-width: 1200px;
      margin: 3rem auto;
      padding: 0 1.5rem;
    }
    
    .hero {
      text-align: center;
      margin-bottom: 3rem;
      animation: fadeInDown 0.6s ease-out;
    }
    
    .hero h1 {
      font-family: 'Cinzel', serif;
      font-size: 3rem;
      color: #${bgColor.slice(1)};
      margin-bottom: 1rem;
      text-shadow: 0 2px 10px rgba(201, 168, 76, 0.3);
    }
    
    .hero p {
      font-size: 1.2rem;
      color: #e8d5a3;
      line-height: 1.6;
      max-width: 600px;
      margin: 0 auto 2rem;
    }
    
    .content {
      background: rgba(5, 4, 3, 0.8);
      border: 1px solid #${bgColor.slice(1)};
      border-radius: 8px;
      padding: 2rem;
      margin: 2rem 0;
      animation: fadeInUp 0.6s ease-out 0.2s both;
    }
    
    .content h2 {
      font-family: 'Cinzel', serif;
      color: #${bgColor.slice(1)};
      margin-bottom: 1rem;
      border-bottom: 2px solid #${bgColor.slice(1)};
      padding-bottom: 0.5rem;
    }
    
    .content p {
      line-height: 1.8;
      margin-bottom: 1rem;
      color: #e8d5a3;
    }
    
    .cta-button {
      display: inline-block;
      background: #${bgColor.slice(1)};
      color: #050403;
      padding: 1rem 2.5rem;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
      font-family: 'Cinzel', serif;
      margin-top: 1rem;
      transition: all 0.3s ease;
      cursor: pointer;
      border: none;
    }
    
    .cta-button:hover {
      background: #f0c060;
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(240, 192, 96, 0.3);
    }
    
    .meta {
      text-align: center;
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #${bgColor.slice(1)};
      color: #6b4f1a;
      font-size: 0.9rem;
    }
    
    @keyframes fadeInDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @media (max-width: 768px) {
      .hero h1 {
        font-size: 2rem;
      }
      
      .nav-links {
        gap: 1rem;
      }
      
      .logo {
        font-size: 1.4rem;
      }
    }
  </style>
</head>
<body>
  <header>
    <nav class="navbar">
      <a href="/" class="logo">◉ MD1usd</a>
      <ul class="nav-links">
        <li><a href="/">الرئيسية</a></li>
        <li><a href="/about">عننا</a></li>
        <li><a href="/tokenomics">التوزيع</a></li>
      </ul>
    </nav>
  </header>
  
  <main>
    <section class="hero">
      <h1>${title}</h1>
      <p>${description}</p>
    </section>
    
    <section class="content">
      <h2>التفاصيل</h2>
      <p>هذه الصفحة تم إنشاؤها تلقائياً بواسطة نظام البناء الديناميكي. كل صفحة جديدة تحمل محتوى وألوان مختلفة.</p>
      <p>رقم الصفحة: <strong>#${pageIndex}</strong></p>
      <p>آخر تحديث: <strong>${today}</strong></p>
      <p>الوقت: <strong>${new Date().toLocaleTimeString('ar-EG')}</strong></p>
      <button class="cta-button">${cta}</button>
    </section>
  </main>
  
  <footer class="meta">
    <p>🔄 تم التحديث: ${today} | الصفحة #${pageIndex} من سلسلة MD1usd</p>
  </footer>
</body>
</html>`;

  return template;
}

// إنشاء مجلد pages إذا لم يكن موجوداً
if (!fs.existsSync('pages')) {
  fs.mkdirSync('pages', { recursive: true });
}

// تحديد رقم الدورة الحالي
const cycleLength = randomBetween(
  data.config.cycleLengthMin,
  data.config.cycleLengthMax
);

// إذا وصلنا لنهاية الدورة، ابدأ من جديد
if (state.pageCount >= cycleLength) {
  state.pageCount = 0;
  console.log(`🔄 إعادة تعيين الدورة! بدء دورة جديدة بطول: ${cycleLength}`);
}

// اختيار محتوى عشوائي من البيانات
const title = randomFrom(data.contentWords.titles);
const description = randomFrom(data.contentWords.descriptions);
const color = randomFrom(data.contentWords.colors);
const cta = randomFrom(data.contentWords.ctas);
const bgColor = randomFrom(data.contentWords.colors);

// إنشاء اسم الصفحة
const pageSlug = `page-${String(state.pageCount + 1).padStart(4, '0')}`;
const pagePath = path.join('pages', `${pageSlug}.html`);

// توليد HTML
const html = generatePageHTML(
  state.pageCount + 1,
  title,
  description,
  color,
  cta,
  bgColor
);

// كتابة الملف
fs.writeFileSync(pagePath, html, 'utf8');

// تحديث الحالة
state.pageCount++;
state.lastUpdate = new Date().toISOString();
state.lastPageSlug = pageSlug;
state.currentCycleLength = cycleLength;

fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');

// طباعة النتيجة
console.log(`✅ تم إنشاء صفحة جديدة: ${pageSlug}.html`);
console.log(`📊 الصفحة: ${state.pageCount}/${cycleLength}`);
console.log(`🎨 اللون: ${bgColor}`);
console.log(`📝 العنوان: ${title}`);
console.log(`🕐 الوقت: ${new Date().toLocaleTimeString('ar-EG')}`);
