// scripts/rotate-theme.js
// -----------------------------------------------------------------
// بيختار ثيم (ألوان + خط + شكل الكروت) بناءً على رقم الفترة الحالية
// (كل فترة = 14 يوم) ويكتبه في data/theme.json.
// الموقع (games.html) بيقرأ الملف ده ويطبّق الشكل تلقائيًا.
// تقدر تغيّر عدد أيام الدورة من PERIOD_DAYS تحت.
// -----------------------------------------------------------------

const fs = require("fs");
const path = require("path");

const PERIOD_DAYS = 14; // غيّرها لـ 7 لو عايز كل أسبوع بدل كل أسبوعين
const EPOCH = new Date("2026-01-01T00:00:00Z").getTime(); // نقطة بداية ثابتة للعد منها

// كل ثيم هنا مختلف فعلاً: ألوان + شكل حواف الكروت + نوع الخط
const THEMES = [
  {
    name: "نيون أركيد",
    bgDark: "#0b0c14", bgCard: "#171826",
    pink: "#ff2d78", cyan: "#00d4ff", yellow: "#ffcc00", purple: "#8b5cf6", green: "#2bd67b",
    radius: "10px", font: "'Tajawal', system-ui, sans-serif"
  },
  {
    name: "غروب صحراوي",
    bgDark: "#160f0a", bgCard: "#241a12",
    pink: "#ff6b35", cyan: "#ffb238", yellow: "#ffe15d", purple: "#c1440e", green: "#f7c548",
    radius: "18px", font: "'Cairo', system-ui, sans-serif"
  },
  {
    name: "غابة استوائية",
    bgDark: "#07130f", bgCard: "#0f2018",
    pink: "#ff5e78", cyan: "#2ee6a6", yellow: "#c6f24e", purple: "#0c7c59", green: "#43e97b",
    radius: "6px", font: "'Almarai', system-ui, sans-serif"
  },
  {
    name: "فضاء بنفسجي",
    bgDark: "#0e0821", bgCard: "#1a1038",
    pink: "#e93cac", cyan: "#7f5af0", yellow: "#f5d442", purple: "#9d4bff", green: "#4ee1a0",
    radius: "24px", font: "'Tajawal', system-ui, sans-serif"
  },
  {
    name: "كاندي بوب",
    bgDark: "#1a0e18", bgCard: "#2b1826",
    pink: "#ff4fa3", cyan: "#5ce1e6", yellow: "#ffde59", purple: "#c774e8", green: "#7bf1a8",
    radius: "16px", font: "'Cairo', system-ui, sans-serif"
  },
  {
    name: "أزرق محيطي",
    bgDark: "#061826", bgCard: "#0d2b3e",
    pink: "#ff6f91", cyan: "#00c2d1", yellow: "#ffd166", purple: "#3a86ff", green: "#06d6a0",
    radius: "8px", font: "'Almarai', system-ui, sans-serif"
  },
  {
    name: "نار وجليد",
    bgDark: "#0a0f1e", bgCard: "#141c33",
    pink: "#ff3860", cyan: "#3ec6ff", yellow: "#ffb703", purple: "#5c6bc0", green: "#00e5a0",
    radius: "12px", font: "'Tajawal', system-ui, sans-serif"
  },
  {
    name: "ليمون وأسود",
    bgDark: "#0d0d0d", bgCard: "#1c1c1c",
    pink: "#ff1f6d", cyan: "#00ffd0", yellow: "#e8ff00", purple: "#7c3aed", green: "#a3ff12",
    radius: "4px", font: "'Cairo', system-ui, sans-serif"
  }
];

function main() {
  const now = Date.now();
  const periodIndex = Math.floor((now - EPOCH) / (PERIOD_DAYS * 24 * 60 * 60 * 1000));
  const theme = THEMES[((periodIndex % THEMES.length) + THEMES.length) % THEMES.length];

  const output = {
    ...theme,
    periodIndex,
    periodDays: PERIOD_DAYS,
    updatedAt: new Date().toISOString()
  };

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(
    path.join(dataDir, "theme.json"),
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log(`🎨 تم اختيار الثيم: ${theme.name} (فترة رقم ${periodIndex})`);
}

main();
