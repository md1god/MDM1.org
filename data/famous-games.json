const fs = require('fs');
const path = require('path');

// ======================= CONFIG =======================
const FEED_BASE = 'https://gamemonetize.com/feed.php?format=0';
const MAX_PAGES = 200;            // حد أقصى للصفحات لتفادي التوقف الطويل
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const FULL_OUTPUT_FILE = path.join(OUTPUT_DIR, 'games.json');
const FAMOUS_OUTPUT_FILE = path.join(OUTPUT_DIR, 'famous_games.json');

// قائمة الكلمات المفتاحية لتحديد الألعاب الشهيرة (نفسها في الواجهة)
const FAMOUS_KEYWORDS = [
  "minecraft", "roblox", "among us", "subway surf", "subway surfers",
  "fortnite", "gta", "grand theft auto", "fnaf", "five nights",
  "temple run", "clash royale", "clash of clans", "brawl stars",
  "candy crush", "pubg", "call of duty", "free fire", "slither",
  "agar.io", "stumble guys", "granny", "poppy playtime", "geometry dash",
  "moto x3m", "basketball stars", "soccer", "8 ball pool", "wordle"
];

// ======================= HELPERS =======================
function isFamousGame(title, tags, category) {
  const hay = `${title} ${tags} ${category}`.toLowerCase();
  return FAMOUS_KEYWORDS.some(kw => hay.includes(kw));
}

function normalizeItem(raw) {
  if (!raw || !raw.url) return null;
  const title = raw.title || raw.name || 'Game';
  const category = raw.category || '';
  const tags = raw.tags || '';
  const dateAdded = parseInt(raw.date_added || raw.date_modified || 0, 10) || 0;
  const rating = parseFloat(raw.rating_avg || raw.rating || 0) || 0;
  const ratingCount = parseInt(raw.rating_count || 0, 10) || 0;

  // نحتفظ فقط بالحقول التي يحتاجها موقعك لتقليل الحجم
  return {
    id: raw.id || raw.url,
    title: title,
    category: category,
    tags: tags,
    thumb: raw.thumb || '',
    url: raw.url,
    width: raw.width || '800',
    height: raw.height || '600',
    date_added: dateAdded,
    rating: rating,
    rating_count: ratingCount,
    famous: isFamousGame(title, tags, category)
  };
}

async function fetchPage(page) {
  const url = `${FEED_BASE}&page=${page}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data;
}

async function fetchAllGames() {
  const allGames = [];
  const seenIds = new Set();
  let page = 1;
  let consecutiveEmptyPages = 0;

  console.log('Starting to fetch games...');
  while (page <= MAX_PAGES) {
    try {
      const items = await fetchPage(page);
      if (!items.length) {
        consecutiveEmptyPages++;
        console.log(`Page ${page} is empty (consecutive: ${consecutiveEmptyPages})`);
        if (consecutiveEmptyPages >= 3) {
          console.log('Stopping: 3 empty pages in a row.');
          break;
        }
      } else {
        consecutiveEmptyPages = 0;
        for (const raw of items) {
          const game = normalizeItem(raw);
          if (game && !seenIds.has(game.id)) {
            seenIds.add(game.id);
            allGames.push(game);
          }
        }
        console.log(`Page ${page} fetched, total unique games so far: ${allGames.length}`);
      }
      page++;
      // مهلة صغيرة بين الطلبات لتفادي حظر مؤقت
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      console.error(`Error fetching page ${page}:`, err.message);
      // في حال الخطأ ننتظر قليلاً ثم نحاول مرة أخرى أو نتوقف بعد عدة محاولات
      await new Promise(resolve => setTimeout(resolve, 1000));
      // يمكن التوقف بعد عدد كبير من الأخطاء
      if (consecutiveEmptyPages++ > 5) break;
      page++;
    }
  }

  console.log(`Fetching completed. Total unique games: ${allGames.length}`);
  return allGames;
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Written ${data.length} games to ${filePath}`);
}

async function main() {
  try {
    const games = await fetchAllGames();
    if (!games.length) {
      console.log('No games fetched, exiting.');
      return;
    }

    // حفظ الملف الكامل (بدون famous؟ يمكن الاحتفاظ به داخله لكننا لا نحتاجه في الواجهة)
    // سنحذف خاصية famous من الملف الكامل لتوفير مساحة إذا لم تستخدم
    const fullGames = games.map(({ famous, ...rest }) => rest);
    writeJSON(FULL_OUTPUT_FILE, fullGames);

    // استخراج الألعاب الشهيرة فقط
    const famousGames = games.filter(g => g.famous);
    writeJSON(FAMOUS_OUTPUT_FILE, famousGames);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
