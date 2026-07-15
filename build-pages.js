#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// --- التعديل هنا ---
// بدلاً من استخدام الاسم فقط، نستخدم المسار الكامل للمجلد الذي يتواجد فيه السكربت
const dataPath = path.join(__dirname, 'pages-data.json');
const dataFile = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(dataFile);
// ------------------

// ... باقي الكود كما هو

const PAGES_DIR = path.join(__dirname, 'pages');
const INDEX_FILE = path.join(PAGES_DIR, 'index.json');
const DATA_FILE = 'pages-data.json';

if (!fs.existsSync(PAGES_DIR)) fs.mkdirSync(PAGES_DIR);

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
let index = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) : { pages: [] };

// منع التكرار
const isDuplicate = (title) => index.pages.some(p => p.title === title);

let title, description, cta, color;
let attempts = 0;

do {
    title = data.contentWords.titles[Math.floor(Math.random() * data.contentWords.titles.length)];
    attempts++;
} while (isDuplicate(title) && attempts < 20);

if (attempts >= 20) {
    console.log("⚠️ تم استنفاد المحتوى الفريد.");
    process.exit(0);
}

// إنشاء المحتوى (JSON فقط)
const pageId = String(index.pages.length + 1).padStart(4, '0');
const fileName = `page-${pageId}.json`;
const content = {
    id: pageId,
    title: title,
    description: data.contentWords.descriptions[Math.floor(Math.random() * data.contentWords.descriptions.length)],
    cta: data.contentWords.ctas[Math.floor(Math.random() * data.contentWords.ctas.length)],
    color: data.contentWords.colors[Math.floor(Math.random() * data.contentWords.colors.length)],
    status: 'pending', // للمراجعة
    createdAt: new Date().toISOString()
};

// حفظ ملف الصفحة
fs.writeFileSync(path.join(PAGES_DIR, fileName), JSON.stringify(content, null, 2), 'utf8');

// تحديث الفهرس
index.pages.push({ id: pageId, title: title, file: fileName, status: 'pending' });

// تنظيف الصفحات القديمة (أكثر من 50 صفحة)
if (index.pages.length > 50) {
    const oldest = index.pages.shift();
    if (fs.existsSync(path.join(PAGES_DIR, oldest.file))) {
        fs.unlinkSync(path.join(PAGES_DIR, oldest.file));
    }
}

fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
console.log(`✅ تم إنشاء ${fileName} بنجاح.`);
