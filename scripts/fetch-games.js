const fs = require('fs');
const path = require('path');

async function fetchAllGames() {
  console.log('🚀 بدء جلب كتالوج الألعاب الكامل من GameMonetize...');
  
  let page = 1;
  let allGames = [];
  let hasMore = true;
  
  // معالجة وإزالة الألعاب المكررة بناءً على الـ ID
  const seenIds = new Set();

  while (hasMore) {
    // يمكنك تجربة format=0 (JSON) أو format=xml
    const url = `https://gamemonetize.com/feed.php?format=0&num=1000&page=${page}`;
    console.log(`📦 جلب الصفحة ${page}...`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`⚠️ توقف عند الصفحة ${page} (رمز الاستجابة: ${response.status})`);
        break;
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        let newGamesInPage = 0;

        for (const game of data) {
          if (game && game.url && !seenIds.has(game.id)) {
            seenIds.add(game.id);
            allGames.push(game);
            newGamesInPage++;
          }
        }

        console.log(`✅ تم إضافة ${newGamesInPage} لعبة جديدة من الصفحة ${page}`);
        page++;

        // فاصل زمني صغير لمنع حظر السيرفر
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        console.log('🏁 تم الوصول إلى نهاية الكتالوج.');
        hasMore = false;
      }
    } catch (error) {
      console.error(`❌ خطأ أثناء جلب الصفحة ${page}:`, error.message);
      hasMore = false;
    }
  }

  console.log(`🎉 إجمالي الألعاب المجمعة: ${allGames.length} لعبة.`);

  // حفظ الكتالوج الكامل
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(dataDir, 'games.json'),
    JSON.stringify(allGames),
    'utf8'
  );

  // حفظ بيانات Metadata
  const meta = {
    total: allGames.length,
    updatedAt: new Date().toISOString(),
    version: Date.now().toString()
  };

  fs.writeFileSync(
    path.join(dataDir, 'games-meta.json'),
    JSON.stringify(meta, null, 2),
    'utf8'
  );

  console.log('💾 تم حفظ الملفات بنجاح في مجلد data/');
}

fetchAllGames();
