const fs = require('fs');
const path = require('path');

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
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        console.log(`⚠️ توقف عند الصفحة ${page} - رمز الحالة: ${response.status}`);
        break;
      }

      const data = await response.json();

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
        await new Promise(r => setTimeout(r, 200));
      } else {
        console.log('🏁 لا توجد بيانات إضافية.');
        keepFetching = false;
      }
    } catch (err) {
      console.error(`❌ خطأ في الصفحة ${page}:`, err.message);
      keepFetching = false;
    }
  }

  console.log(`🎉 إجمالي الألعاب المجمعة: ${allGames.length}`);

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

  console.log('💾 تم التحديث والحفظ بنجاح.');
}

fetchAllGames();
