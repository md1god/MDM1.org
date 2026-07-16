const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'pages-data.json');
const PAGES_DIR = path.join(__dirname, 'pages');
const INDEX_FILE = path.join(PAGES_DIR, 'index.json');

if (!fs.existsSync(PAGES_DIR)) fs.mkdirSync(PAGES_DIR);

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
let index = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) : { pages: [] };

const isDuplicate = (title) => index.pages.some(p => p.title === title);

let title;
let attempts = 0;
do {
    title = data.contentWords.titles[Math.floor(Math.random() * data.contentWords.titles.length)];
    attempts++;
} while (isDuplicate(title) && attempts < 20);

if (attempts >= 20) {
    console.log("تم استنفاد المحتوى الفريد.");
    process.exit(0);
}

const pageId = String(index.pages.length + 1).padStart(4, '0');
const fileName = `page-${pageId}.json`;
const content = {
    id: pageId,
    title: title,
    description: data.contentWords.descriptions[Math.floor(Math.random() * data.contentWords.descriptions.length)],
    cta: data.contentWords.ctas[Math.floor(Math.random() * data.contentWords.ctas.length)],
    color: data.contentWords.colors[Math.floor(Math.random() * data.contentWords.colors.length)],
    status: 'pending',
    createdAt: new Date().toISOString()
};

fs.writeFileSync(path.join(PAGES_DIR, fileName), JSON.stringify(content, null, 2), 'utf8');

index.pages.push({ id: pageId, title: title, file: fileName, status: 'pending' });

if (index.pages.length > 50) {
    const oldest = index.pages.shift();
    if (fs.existsSync(path.join(PAGES_DIR, oldest.file))) {
        fs.unlinkSync(path.join(PAGES_DIR, oldest.file));
    }
}

fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');

console.log(`تم إنشاء ${fileName} بنجاح.`);
