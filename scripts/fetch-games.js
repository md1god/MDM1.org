<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MDM1 — بوابة الألعاب الأسطورية</title>

<style>
/* ============================================================
   RESET & CORE KIDS/GAMING THEME (BRIGHT & VIBRANT)
   ============================================================ */
:root {
  --bg-dark: #12102b;
  --bg-card: #1d1a3f;
  --bg-card-hover: #2a2660;
  --accent-pink: #ff3d9a;
  --accent-cyan: #00e5ff;
  --accent-yellow: #ffd60a;
  --accent-purple: #9d4bff;
  --accent-green: #2bff88;
  --text-bright: #ffffff;
  --text-sub: #c7cdf0;
  --border-glow: rgba(0, 229, 255, 0.35);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Tajawal', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  user-select: none;
}

body {
  background-color: var(--bg-dark);
  background-image:
    radial-gradient(circle at 10% 10%, rgba(255, 61, 154, 0.22) 0%, transparent 35%),
    radial-gradient(circle at 90% 15%, rgba(0, 229, 255, 0.20) 0%, transparent 35%),
    radial-gradient(circle at 50% 90%, rgba(157, 75, 255, 0.20) 0%, transparent 40%),
    radial-gradient(circle at 90% 85%, rgba(43, 255, 136, 0.15) 0%, transparent 35%);
  background-attachment: fixed;
  color: var(--text-bright);
  min-height: 100vh;
  display: flex;
  overflow-x: hidden;
}

/* ============================================================
   NAVBAR (FULL WIDTH, NO WASTED SIDE SPACE)
   ============================================================ */
.app-navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(18, 16, 43, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 3px solid rgba(255, 255, 255, 0.08);
  padding: 0.8rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  font-size: 1.5rem;
  font-weight: 900;
  color: #fff;
  letter-spacing: 0.5px;
}

.brand-badge {
  background: linear-gradient(135deg, var(--accent-pink), var(--accent-purple));
  color: #fff;
  padding: 0.25rem 0.7rem;
  border-radius: 10px;
  font-size: 1rem;
  box-shadow: 0 0 15px rgba(255, 61, 154, 0.55);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.btn-md1 {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #ffd60a, #ff9500);
  color: #12102b;
  font-weight: 800;
  font-size: 0.95rem;
  padding: 0.55rem 1.1rem;
  border-radius: 30px;
  text-decoration: none;
  box-shadow: 0 0 15px rgba(255, 214, 10, 0.45);
  transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  border: 2px solid #fff26b;
}

.btn-md1:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 0 22px rgba(255, 214, 10, 0.8);
}

.btn-audio {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff;
  padding: 0.55rem 0.9rem;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s;
}

.btn-audio:hover {
  background: rgba(0, 229, 255, 0.18);
  border-color: var(--accent-cyan);
}

/* ============================================================
   MAIN CONTENT AREA — FULL BLEED, NO EMPTY SIDE GAPS
   ============================================================ */
.main-container {
  flex: 1;
  max-width: 1900px;
  margin: 0 auto;
  padding: 1rem 1.5rem 3rem;
  width: 100%;
}

/* HERO SECTION - COMPACT & FUN */
.hero-compact {
  text-align: center;
  padding: 1.4rem 1rem 1.1rem;
}

.hero-compact h1 {
  font-size: 2.3rem;
  font-weight: 900;
  background: linear-gradient(90deg, var(--accent-cyan), var(--accent-pink), var(--accent-yellow), var(--accent-green));
  background-size: 300% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.35rem;
  animation: shimmer 6s linear infinite;
}

@keyframes shimmer {
  to { background-position: 300% center; }
}

.hero-compact p {
  color: var(--text-sub);
  font-size: 1rem;
  font-weight: 600;
}

/* TOOLBAR & SEARCH */
.toolbar-section {
  margin: 1rem 0 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-wrapper {
  position: relative;
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
}

.search-input {
  width: 100%;
  padding: 0.85rem 1.2rem 0.85rem 3rem;
  background: var(--bg-card);
  border: 2px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  color: #fff;
  font-size: 1.05rem;
  outline: none;
  transition: all 0.25s ease;
  box-shadow: 0 4px 15px rgba(0,0,0,0.25);
}

.search-input:focus {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 20px rgba(0, 229, 255, 0.45);
  background: #241f4d;
}

.search-icon {
  position: absolute;
  left: 1.1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.15rem;
  color: var(--text-sub);
  pointer-events: none;
}

.stats-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 700px;
  margin: -0.2rem auto 0;
  padding: 0 0.5rem;
  font-size: 0.9rem;
  color: var(--text-sub);
  font-weight: 700;
}

#gamesCount { color: var(--accent-green); }

/* CATEGORY FILTERS WITH FUN ICONS */
.filter-bar {
  display: flex;
  gap: 0.6rem;
  overflow-x: auto;
  padding: 0.4rem 0.2rem 0.8rem;
  scrollbar-width: none;
  justify-content: center;
  flex-wrap: wrap;
}

.filter-bar::-webkit-scrollbar {
  display: none;
}

.chip-btn {
  background: var(--bg-card);
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  color: var(--text-sub);
  padding: 0.55rem 1.15rem;
  border-radius: 25px;
  font-size: 0.92rem;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.chip-btn:hover, .chip-btn.active {
  background: linear-gradient(135deg, var(--accent-pink), var(--accent-purple));
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 18px rgba(255, 61, 154, 0.45);
  transform: translateY(-2px);
}

/* ============================================================
   GAMES GRID (FULL WIDTH, MORE COLUMNS ON WIDE SCREENS)
   ============================================================ */
.games-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  list-style: none;
  margin-top: 0.5rem;
  width: 100%;
}

@media (min-width: 550px) {
  .games-grid { grid-template-columns: repeat(3, 1fr); gap: 1.1rem; }
}
@media (min-width: 850px) {
  .games-grid { grid-template-columns: repeat(5, 1fr); gap: 1.2rem; }
}
@media (min-width: 1200px) {
  .games-grid { grid-template-columns: repeat(7, 1fr); gap: 1.3rem; }
}
@media (min-width: 1600px) {
  .games-grid { grid-template-columns: repeat(9, 1fr); gap: 1.3rem; }
}

.game-card {
  background: var(--bg-card);
  border-radius: 18px;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  position: relative;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  display: flex;
  flex-direction: column;
}

.game-card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 18px;
  padding: 2px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-pink), var(--accent-yellow));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.game-card:hover {
  transform: translateY(-6px) scale(1.03);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5), 0 0 18px rgba(0, 229, 255, 0.35);
  background: var(--bg-card-hover);
}

.game-card:hover::after {
  opacity: 1;
}

.game-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #0a0920;
}

.game-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}

.game-card:hover .game-thumb img {
  transform: scale(1.08);
}

.play-badge {
  position: absolute;
  inset: 0;
  background: rgba(18, 16, 43, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.game-card:hover .play-badge {
  opacity: 1;
}

.play-btn-circle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  box-shadow: 0 0 18px rgba(0, 229, 255, 0.7);
  transform: scale(0.8);
  transition: transform 0.25s ease;
}

.game-card:hover .play-btn-circle {
  transform: scale(1);
}

.game-details {
  padding: 0.7rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.game-title {
  font-size: 0.92rem;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.game-cat-tag {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--accent-yellow);
  text-transform: uppercase;
}

/* LOADER & LOAD MORE */
.portal-loader {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-sub);
}

.spinner {
  width: 42px;
  height: 42px;
  margin: 0 auto 1rem;
  border: 4px solid rgba(255,255,255,0.12);
  border-top-color: var(--accent-cyan);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.load-more-wrap {
  display: flex;
  justify-content: center;
  margin: 2rem 0;
}

.btn-load-more {
  display: none;
  background: linear-gradient(135deg, rgba(0,229,255,0.15), rgba(157,75,255,0.15));
  border: 2px solid var(--accent-cyan);
  color: #fff;
  padding: 0.8rem 2.2rem;
  border-radius: 30px;
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.25s ease;
}

.btn-load-more:hover {
  background: var(--accent-cyan);
  color: #12102b;
  box-shadow: 0 0 20px rgba(0, 229, 255, 0.55);
}

/* ============================================================
   PLAY OVERLAY MODAL (IFRAME SCREEN)
   ============================================================ */
.play-overlay {
  position: fixed;
  inset: 0;
  background: rgba(5, 6, 16, 0.97);
  z-index: 2000;
  display: none;
  flex-direction: column;
}

.play-overlay.open {
  display: flex;
}

.overlay-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1.2rem;
  background: #171432;
  border-bottom: 2px solid rgba(255, 255, 255, 0.08);
}

.overlay-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--accent-cyan);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 50%;
}

.topbar-btns {
  display: flex;
  gap: 0.6rem;
}

.ctrl-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff;
  padding: 0.5rem 0.9rem;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  transition: all 0.2s;
}

.ctrl-btn:hover {
  background: rgba(255, 61, 154, 0.22);
  border-color: var(--accent-pink);
}

.ctrl-btn.close-btn {
  background: rgba(255, 61, 154, 0.85);
  border-color: transparent;
}

.ctrl-btn.close-btn:hover {
  background: var(--accent-pink);
  box-shadow: 0 0 12px rgba(255, 61, 154, 0.6);
}

.stage-wrapper {
  position: relative;
  flex: 1;
  background: #000;
}

.stage-wrapper iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.stage-loader-box {
  position: absolute;
  inset: 0;
  background: #12102b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  z-index: 10;
}

.stage-loader-box.hidden { display: none; }
</style>
</head>
<body>

<!-- AUDIO -->
<audio id="bg-music" src="audio/games.opus" loop preload="none"></audio>

<!-- NAVBAR -->
<header class="app-navbar">
  <a href="index.html" class="brand-logo">
    <span class="brand-badge">MDM1</span>
    <span>بوابة الألعاب</span>
  </a>

  <div class="nav-actions">
    <a href="https://md1usd.com" class="btn-md1" target="_blank" rel="noopener">
      <span>💎</span>
      <span>MD1$</span>
    </a>

    <button id="audioToggle" class="btn-audio">
      <span id="audioIcon">🔊</span>
      <span id="audioText">الموسيقى</span>
    </button>
  </div>
</header>

<!-- MAIN CONTENT -->
<main class="main-container">

  <!-- HERO HEADER (COMPACT) -->
  <section class="hero-compact">
    <h1>🎮 عالم الألعاب الأسطوري</h1>
    <p>العب مباشرة مجاناً وبدون أي تحميل من متصفحك!</p>
  </section>

  <!-- TOOLBAR: SEARCH & STATS -->
  <div class="toolbar-section">
    <div class="search-wrapper">
      <span class="search-icon">🔍</span>
      <input id="gamesSearch" class="search-input" type="search" placeholder="ابحث عن لعبه مفضلة..." autocomplete="off">
    </div>

    <div class="stats-bar">
      <span id="gamesCount">جاري جلب الألعاب...</span>
      <span id="gamesStatus">⚡ MDM1 GAMES PORTAL</span>
    </div>

    <!-- CATEGORY FILTERS -->
    <nav class="filter-bar" id="filterBar">
      <button class="chip-btn active" data-category="all">🔥 الأكثر شهرة</button>
      <button class="chip-btn" data-category="new">🆕 جديد</button>
      <button class="chip-btn" data-category="action">⚔️ أكشن</button>
      <button class="chip-btn" data-category="shooting">🔫 إطلاق نار</button>
      <button class="chip-btn" data-category="racing">🏎️ سباقات</button>
      <button class="chip-btn" data-category="puzzle">🧩 ألغاز</button>
      <button class="chip-btn" data-category="sports">⚽ رياضة</button>
      <button class="chip-btn" data-category="simulation">🏗️ محاكاة</button>
      <button class="chip-btn" data-category="adventure">🗺️ مغامرة</button>
      <button class="chip-btn" data-category="arcade">🕹️ أركيد</button>
      <button class="chip-btn" data-category="kids">🧸 أطفال</button>
      <button class="chip-btn" data-category="multiplayer">👥 متعدد اللاعبين</button>
      <button class="chip-btn" data-category="io">🌐 ألعاب آيو</button>
    </nav>
  </div>

  <!-- LOADER -->
  <div id="portalLoader" class="portal-loader">
    <div class="spinner"></div>
    <div>جاري تحميل مكتبة الألعاب...</div>
  </div>

  <!-- GRID -->
  <ul class="games-grid" id="gamesGrid"></ul>

  <!-- LOAD MORE -->
  <div class="load-more-wrap">
    <button id="loadMoreBtn" class="btn-load-more">عرض المزيد من الألعاب ✨</button>
  </div>

</main>

<!-- PLAY OVERLAY MODAL -->
<div class="play-overlay" id="playOverlay">
  <div class="overlay-topbar">
    <span class="overlay-title" id="playTitle">اسم اللعبة</span>

    <div class="topbar-btns">
      <button class="ctrl-btn" id="btnReload" title="إعادة تشغيل">⟳ إعادة</button>
      <button class="ctrl-btn" id="btnFullscreen" title="شاشة كاملة">⛶ شاشة كاملة</button>
      <button class="ctrl-btn close-btn" id="btnClose">✖ إغلاق</button>
    </div>
  </div>

  <div class="stage-wrapper" id="playStage">
    <div class="stage-loader-box" id="stageLoader">
      <div class="spinner"></div>
      <span>جاري فتح اللعبة...</span>
    </div>
    <iframe id="gameFrame" src="about:blank" allow="fullscreen; autoplay; gamepad; pointer-lock" title="Game Canvas" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
  </div>
</div>

<!-- ALL-IN-ONE SELF-CONTAINED JAVASCRIPT -->
<script>
(function () {
  "use strict";

  const DATA_URL = "data/games.json";
  const BATCH_SIZE = 40;

  /* DOM ELEMENTS */
  const gamesGrid = document.getElementById("gamesGrid");
  const filterBar = document.getElementById("filterBar");
  const gamesSearch = document.getElementById("gamesSearch");
  const gamesCount = document.getElementById("gamesCount");
  const gamesStatus = document.getElementById("gamesStatus");
  const portalLoader = document.getElementById("portalLoader");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const playOverlay = document.getElementById("playOverlay");
  const gameFrame = document.getElementById("gameFrame");
  const playTitle = document.getElementById("playTitle");
  const stageLoader = document.getElementById("stageLoader");
  const btnClose = document.getElementById("btnClose");
  const btnReload = document.getElementById("btnReload");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const playStage = document.getElementById("playStage");
  const bgMusic = document.getElementById("bg-music");
  const audioToggle = document.getElementById("audioToggle");
  const audioIcon = document.getElementById("audioIcon");

  /* STATE */
  let ALL_GAMES = [];
  let visibleGames = [];
  let activeCategory = "all";
  let searchText = "";
  let renderedCount = 0;
  let currentGame = null;
  let audioTimeBeforeGame = 0;
  let isMuted = false;

  /* CATEGORY MAPPING — WIDER MATCHING SO MORE GAMES LAND IN A REAL CATEGORY
     INSTEAD OF FALLING INTO "OTHER" */
  function normalizeCategory(category, tags, title) {
    const c = String(category || "").trim().toLowerCase();
    const t = String(tags || "").trim().toLowerCase();
    const ti = String(title || "").trim().toLowerCase();
    const hay = c + " " + t + " " + ti;

    if (/shoot|gun|sniper|swat|fps|war|army|zombie/.test(hay)) return "shooting";
    if (/action|fight|boxing|battle|combat|ninja|hero/.test(hay)) return "action";
    if (/puzzle|brain|logic|match|block|maze/.test(hay)) return "puzzle";
    if (/racing|race|drive|car|moto|bike/.test(hay)) return "racing";
    if (/sport|soccer|football|basketball|golf|volleyball|tennis/.test(hay)) return "sports";
    if (/simulat|tycoon|farm|cook|restaurant|build|craft|shop/.test(hay)) return "simulation";
    if (/adventure|explor|quest|rpg|world/.test(hay)) return "adventure";
    if (/\.io\b|io game/.test(hay)) return "io";
    if (/multiplayer|\.io|online battle|pvp/.test(hay)) return "multiplayer";
    if (/kids|girl|dress|coloring|baby|cute/.test(hay)) return "kids";
    if (/arcade|runner|jump|clicker|idle/.test(hay)) return "arcade";
    return c || "arcade";
  }

  function categoryLabel(cat) {
    const map = {
      action: "أكشن", puzzle: "ألغاز", racing: "سباقات", sports: "رياضة",
      shooting: "إطلاق نار", simulation: "محاكاة", adventure: "مغامرة",
      arcade: "أركيد", kids: "أطفال", multiplayer: "متعدد اللاعبين", io: "آيو"
    };
    return map[cat] || cat || "العاب";
  }

  /* ESCAPE HTML */
  function escapeHTML(str) {
    return String(str || "").replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[m]));
  }

  /* FILTERING */
  function applyFilters() {
    const q = searchText.trim().toLowerCase();
    visibleGames = ALL_GAMES.filter(game => {
      if (activeCategory !== "all" && game._cat !== activeCategory) return false;
      if (!q) return true;
      return [game.title, game.category, game.tags].filter(Boolean).join(" ").toLowerCase().includes(q);
    });

    renderedCount = 0;
    gamesGrid.innerHTML = "";
    updateStats();
    renderNextBatch();
  }

  /* REAL COUNT — TAKEN DIRECTLY FROM THE LOADED DATA FILE, NEVER HARDCODED */
  function updateStats() {
    gamesCount.textContent = visibleGames.length.toLocaleString("ar-EG") + " لعبة متاحة";
  }

  /* CARD CREATION WITH FULL COVER IMAGES & NO INNER PADDING */
  function createGameCard(game) {
    const li = document.createElement("li");
    li.className = "game-card";

    const title = escapeHTML(game.title || "لعبة");
    const cat = escapeHTML(categoryLabel(game._cat));
    const thumb = game.thumb
      ? `<img src="${escapeHTML(game.thumb)}" alt="${title}" loading="lazy" onerror="this.src='images/placeholder.png'">`
      : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:2rem;">🎮</div>`;

    li.innerHTML = `
      <div class="game-thumb">
        ${thumb}
        <div class="play-badge">
          <div class="play-btn-circle">▶</div>
        </div>
      </div>
      <div class="game-details">
        <div class="game-title">${title}</div>
        <div class="game-cat-tag">${cat}</div>
      </div>
    `;

    li.addEventListener("click", () => openGame(game));
    return li;
  }

  function renderNextBatch() {
    if (renderedCount >= visibleGames.length) {
      loadMoreBtn.style.display = "none";
      return;
    }

    const fragment = document.createDocumentFragment();
    const end = Math.min(renderedCount + BATCH_SIZE, visibleGames.length);

    for (let i = renderedCount; i < end; i++) {
      fragment.appendChild(createGameCard(visibleGames[i]));
    }

    gamesGrid.appendChild(fragment);
    renderedCount = end;

    loadMoreBtn.style.display = renderedCount < visibleGames.length ? "inline-block" : "none";
  }

  /* LOAD DATA */
  async function loadGames() {
    try {
      portalLoader.style.display = "block";
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error("فشل التحميل");
      const data = await res.json();

      ALL_GAMES = data
        .filter(g => g && g.url)
        .map(g => ({ ...g, _cat: normalizeCategory(g.category, g.tags, g.title) }));

      // شكّل الأحدث أولاً لو فيه ترتيب زمني في البيانات (id تصاعدي غالباً = ترتيب الإضافة في الفييد)
      visibleGames = ALL_GAMES.slice();
      portalLoader.style.display = "none";

      updateStats();
      renderNextBatch();
    } catch (err) {
      portalLoader.innerHTML = `<div>⚠️ تعذر تحميل مكتبة الألعاب. يرجى التأكد من مسار data/games.json</div>`;
    }
  }

  /* AUDIO HANDLING */
  audioToggle.addEventListener("click", () => {
    isMuted = !isMuted;
    if (isMuted) {
      bgMusic.pause();
      audioIcon.textContent = "🔇";
    } else {
      bgMusic.play().catch(() => {});
      audioIcon.textContent = "🔊";
    }
  });

  const enableAudioOnTouch = () => {
    if (!isMuted && bgMusic.paused) {
      bgMusic.volume = 0.3;
      bgMusic.play().catch(() => {});
    }
    document.removeEventListener("pointerdown", enableAudioOnTouch);
  };
  document.addEventListener("pointerdown", enableAudioOnTouch);

  /* OPEN GAME (PAUSE MUSIC & RECORD TIME) */
  function openGame(game) {
    if (!game || !game.url) return;
    currentGame = game;
    playTitle.textContent = game.title || "اللعبة";

    if (!bgMusic.paused) {
      audioTimeBeforeGame = bgMusic.currentTime;
      bgMusic.pause();
    }

    stageLoader.classList.remove("hidden");
    gameFrame.src = game.url;
    playOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  /* CLOSE GAME (RESUME MUSIC FROM EXACT TIME) */
  function closeGame() {
    playOverlay.classList.remove("open");
    document.body.style.overflow = "";
    gameFrame.src = "about:blank";

    if (!isMuted) {
      bgMusic.currentTime = audioTimeBeforeGame;
      bgMusic.play().catch(() => {});
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    currentGame = null;
  }

  gameFrame.addEventListener("load", () => {
    if (gameFrame.src && gameFrame.src !== "about:blank") {
      stageLoader.classList.add("hidden");
    }
  });

  btnReload.addEventListener("click", () => {
    if (!currentGame) return;
    stageLoader.classList.remove("hidden");
    gameFrame.src = currentGame.url;
  });

  btnFullscreen.addEventListener("click", () => {
    if (playStage.requestFullscreen) playStage.requestFullscreen();
    else if (playStage.webkitRequestFullscreen) playStage.webkitRequestFullscreen();
  });

  btnClose.addEventListener("click", closeGame);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && playOverlay.classList.contains("open")) closeGame();
  });

  /* SEARCH & FILTERS LISTENERS */
  let searchTimer;
  gamesSearch.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchText = gamesSearch.value;
      applyFilters();
    }, 150);
  });

  filterBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-btn");
    if (!btn) return;
    filterBar.querySelectorAll(".chip-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeCategory = btn.dataset.category || "all";
    applyFilters();
  });

  loadMoreBtn.addEventListener("click", renderNextBatch);

  loadGames();
})();
</script>
</body>
</html>
