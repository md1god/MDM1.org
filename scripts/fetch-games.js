const fs = require('fs');
const path = require('path');
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', err => reject(err));
  });
}

async function fetchAllGames() {
  console.log('🚀 بدء جلب الكتالوج الكامل...');
  
  let page = 1;
  let allGames = [];
  const seenIds = new Set();
  let keepFetching = true;

  while (keepFetching && page <= 35) {
    const url = `https://gamemonetize.com/feed.php?format=0&num=1000&page=${page}`;
    console.log(`📦 جلب الصفحة ${page}...`);

    try {
      const data = await fetchJson(url);

      if (Array.isArray(data) && data.length > 0) {
        let added = 0;
        for (const game of data) {
          if (game && game.url && !seenIds.has(game.id)) {
            seenIds.add(game.id);
            allGames.push({
              id: String(game.id || ''),
              title: String(game.title || ''),
              category: String(game.category || 'other'),
              tags: String(game.tags || ''),
              thumb: String(game.thumb || ''),
              url: String(game.url || ''),
              width: game.width || 800,
              height: game.height || 600
            });
            added++;
          }
        }
        console.log(`✅ تم إضافة ${added} لعبة من الصفحة ${page}`);
        page++;
      } else {
        keepFetching = false;
      }
    } catch (err) {
      console.error(`❌ خطأ في الصفحة ${page}:`, err.message);
      keepFetching = false;
    }
  }

  console.log(`🎉 الإجمالي: ${allGames.length} لعبة.`);

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(dataDir, 'games.json'),
    JSON.stringify(allGames),
    'utf8'
  );

  fs.writeFileSync(
    path.join(dataDir, 'games-meta.json'),
    JSON.stringify({
      total: allGames.length,
      updatedAt: new Date().toISOString(),
      version: Date.now().toString()
    }, null, 2),
    'utf8'
  );

  console.log('💾 تم الحفظ بنجاح في مجلد data.');
}

fetchAllGames();
