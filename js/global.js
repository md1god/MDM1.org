/* ============================================================
   MDM1 — GLOBAL JS v2.3
   التعديلات عن v2.2:
   1) initMusic() بقت نسخة كاملة مطابقة لمنطق index.html/whitepaper.html:
      - تشغيل تلقائي بحيلة الكتم المؤقت (يعمل بدون الحاجة لسؤال المستخدم)
      - استمرارية الاختيار بين كل الصفحات عبر sessionStorage
      - دعم اختياري لشاشة سؤال "#music-prompt" لو الصفحة فيها واحدة
      - استئناف الموسيقى عند الرجوع للصفحة (pageshow / visibilitychange)
   2) تم حذف زر "العودة للأعلى" (☀️ addFloatingLight) نهائياً بطلب المستخدم.
   ============================================================ */
(function(){
  "use strict";

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- NAVBAR + MEGA DROPDOWN ---------------- */
  function initNavbar(){
    const nav = document.querySelector('.mdm1-nav');
    if(!nav) return;

    const toggle = nav.querySelector('.mdm1-nav__toggle');
    const links  = nav.querySelector('.mdm1-nav__links');

    if(toggle && links){
      toggle.addEventListener('click', () => {
        const open = toggle.classList.toggle('is-open');
        links.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    const current = window.location.pathname.split('/').pop() || 'index.html';
    nav.querySelectorAll('.mdm1-nav__links a').forEach(a => {
      const href = a.getAttribute('href') || '';
      if(href.endsWith(current)) a.classList.add('is-active');
    });

    document.querySelectorAll('.has-mega').forEach(item => {
      item.addEventListener('mouseenter', () => item.classList.add('open'));
      item.addEventListener('mouseleave', () => item.classList.remove('open'));
    });
  }

  /* ---------------- MUSIC SYSTEM (v2.3) ---------------- */
  function initMusic(){
    const audio = document.getElementById('bg-music');
    if(!audio) return; // الصفحة دي مفيهاش موسيقى، تجاهل بأمان

    const btn = document.getElementById('music-btn');
    if(!btn) return;

    const prompt = document.getElementById('music-prompt');
    const mpYes  = document.getElementById('mp-yes');
    const mpNo   = document.getElementById('mp-no');

    const MUSIC_KEY = 'mdm1_music_choice'; // مشترك بين كل الصفحات طوال الجلسة (التبويب)

    function fadeVolume(el, from, to, duration, onDone){
      const steps = 30;
      const interval = duration / steps;
      const delta = (to - from) / steps;
      let current = from;
      el.volume = Math.max(0, Math.min(1, from));
      const timer = setInterval(() => {
        current += delta;
        el.volume = Math.max(0, Math.min(1, current));
        if((delta > 0 && current >= to) || (delta < 0 && current <= to)){
          clearInterval(timer);
          if(onDone) onDone();
        }
      }, interval);
    }

    function playMusic(fadeMs){
      btn.style.display = 'flex';
      if(!audio.paused) return;
      const start = () => {
        // حيلة التشغيل التلقائي: المتصفحات تسمح دائماً بتشغيل صوت "مكتوم" بدون أي
        // تفاعل من المستخدم — نشغّله مكتوماً ثم نلغي الكتم ونرفع الصوت تدريجياً.
        audio.muted = true;
        audio.play().then(() => {
          audio.muted = false;
          audio.volume = 0;
          fadeVolume(audio, 0, 0.45, fadeMs);
          btn.textContent = '🔊';
          btn.classList.add('playing');
        }).catch(() => {});
      };
      if(audio.readyState >= 3){
        start();
      } else {
        audio.addEventListener('canplaythrough', start, { once: true });
        audio.load();
      }
    }

    const savedChoice = sessionStorage.getItem(MUSIC_KEY);

    if(savedChoice === 'yes'){
      // المستخدم وافق على الموسيقى في صفحة سابقة — شغّلها هنا كذلك مباشرة
      btn.style.display = 'flex';
      btn.textContent = '🔇';
      setTimeout(() => playMusic(2000), 400);
    } else if(savedChoice === 'no'){
      btn.style.display = 'flex';
      btn.textContent = '🔇';
    } else if(prompt && mpYes && mpNo){
      // الصفحة فيها شاشة سؤال (مثل index.html) — اعرضها
      setTimeout(() => prompt.classList.add('show'), 600);
    } else {
      // لا يوجد سؤال في هذه الصفحة (مثل whitepaper.html) — شغّل تلقائياً مباشرة
      setTimeout(() => playMusic(2200), 400);
    }

    if(mpYes) mpYes.addEventListener('click', () => {
      prompt.classList.remove('show');
      sessionStorage.setItem(MUSIC_KEY, 'yes');
      playMusic(2500);
    });

    if(mpNo) mpNo.addEventListener('click', () => {
      prompt.classList.remove('show');
      sessionStorage.setItem(MUSIC_KEY, 'no');
      btn.textContent = '🔇';
      btn.style.display = 'flex';
    });

    btn.addEventListener('click', () => {
      if(audio.paused){
        sessionStorage.setItem(MUSIC_KEY, 'yes');
        audio.muted = false;
        audio.play();
        fadeVolume(audio, 0, 0.45, 1200);
        btn.textContent = '🔊';
        btn.classList.add('playing');
      } else {
        sessionStorage.setItem(MUSIC_KEY, 'no');
        fadeVolume(audio, audio.volume, 0, 800, () => audio.pause());
        btn.textContent = '🔇';
        btn.classList.remove('playing');
      }
    });

    // استئناف الموسيقى عند الرجوع للصفحة (زر رجوع المتصفح / bfcache) أو العودة لتبويبها
    window.addEventListener('pageshow', () => {
      if(sessionStorage.getItem(MUSIC_KEY) === 'yes' && audio.paused) playMusic(1200);
    });
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible' && sessionStorage.getItem(MUSIC_KEY) === 'yes' && audio.paused){
        playMusic(1200);
      }
    });
  }

  /* ---------------- LIVE PRICE (معطّل عمدًا) ---------------- */
  function initLiveElements(){
    // ⚠️ كان بيعرض رقم عشوائي Math.random() كأنه سعر حقيقي — ده بيانات مالية
    // مزيفة معروضة على إنها حقيقية. لما يبقى عندك سعر حقيقي من DexScreener/
    // Polygonscan API اربطه هنا بدل السطر ده.
    document.querySelectorAll('.live-price').forEach(el => {
      el.textContent = 'قريبًا';
    });

    const progress = document.getElementById('light-progress');
    if(progress) progress.style.width = '0%';
  }

  /* ---------------- PARTICLES ---------------- */
  function initParticles(){
    const host = document.querySelector('.mdm1-particles') || document.getElementById('particles');
    if(!host || reduceMotion) return;

    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let w, h, particles;
    const COUNT = 38;

    function resize(){ w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    function makeParticle(){
      return {
        x: Math.random() * w, y: Math.random() * h,
        r: 0.6 + Math.random() * 1.6, speed: 0.15 + Math.random() * 0.35,
        drift: (Math.random() - 0.5) * 0.3, alpha: 0.15 + Math.random() * 0.35
      };
    }
    function init(){ resize(); particles = Array.from({length: COUNT}, makeParticle); }
    function tick(){
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#C9A84C';
      particles.forEach(p => {
        p.y -= p.speed; p.x += p.drift;
        if(p.y < -10){ p.y = h + 10; p.x = Math.random() * w; }
        ctx.globalAlpha = p.alpha;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      requestAnimationFrame(tick);
    }
    init();
    window.addEventListener('resize', resize, { passive: true });
    tick();
  }

  /* ---------------- CUSTOM CURSOR ---------------- */
  function initCursor(){
    if(reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;

    const dot = document.createElement('div'); dot.className = 'mdm1-cursor-dot';
    const ring = document.createElement('div'); ring.className = 'mdm1-cursor-ring';
    document.body.append(dot, ring);

    let ringX = 0, ringY = 0;
    window.addEventListener('mousemove', e => {
      dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px';
      ringX = e.clientX; ringY = e.clientY;
    }, { passive: true });

    (function follow(){
      ring.style.left = ringX + 'px'; ring.style.top = ringY + 'px';
      requestAnimationFrame(follow);
    })();

    document.querySelectorAll('a, button, .mdm1-btn').forEach(el => {
      el.addEventListener('mouseenter', () => ring.classList.add('is-active'));
      el.addEventListener('mouseleave', () => ring.classList.remove('is-active'));
    });
  }

  /* ---------------- SCROLL REVEAL ---------------- */
  function initReveal(){
    const items = document.querySelectorAll('.mdm1-reveal, .reveal');
    if(!items.length) return;

    if(reduceMotion || !('IntersectionObserver' in window)){
      items.forEach(el => el.classList.add('is-visible', 'visible'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible', 'visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -5% 0px' }   /* threshold 0: long lists (85+ items) never reach 15% visible and stayed invisible */);

    items.forEach(el => io.observe(el));
  }

  /* ---------------- PSYCHOLOGY / GAMIFICATION (معطّل عمدًا) ---------------- */
  function initPsychology(){
    // ⚠️ عداد تنازلي بدون موعد حقيقي = dark pattern خداعي (إيحاء بندرة وهمية).
    // فعّله فقط لو "fomo-countdown" مربوط بـ data-deadline حقيقي، مثال:
    // <div class="fomo-countdown" data-deadline="2026-07-01T00:00:00Z"></div>
    document.querySelectorAll('.fomo-countdown').forEach(cd => {
      const deadline = cd.getAttribute('data-deadline');
      if(!deadline) return; // مفيش موعد حقيقي = مفيش عداد
      const target = new Date(deadline).getTime();
      setInterval(() => {
        const diff = Math.max(0, target - Date.now());
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        cd.textContent = `${h}س ${m}د`;
      }, 60000);
    });
  }

  /* ---------------- MUSIC FOR AUTO-GENERATED PAGES (pages/NN.html) ----------------
     الصفحات المولّدة تلقائيًا (pages/99.html ...) مفيهاش <audio> ولا زر.
     بدل ما نلمس الكود اللي بيولّدها، الزر والموسيقى بيتضافوا من هنا (ملف مشترك). */
  function initGeneratedPageMusic(){
    try {
      if(document.getElementById('bg-music') || document.getElementById('music-btn')) return;
      const m = window.location.pathname.match(/\/pages\/(\d+)\.html$/);
      if(!m) return;
      const file = (m[1] === '18' || m[1] === '19') ? m[1] : 'index';

      const audio = document.createElement('audio');
      audio.id = 'bg-music'; audio.loop = true; audio.preload = 'none';
      audio.src = '../audio/' + file + '.mp3';
      const btn = document.createElement('button');
      btn.id = 'music-btn'; btn.type = 'button';
      btn.textContent = '🎧';
      btn.title = 'تشغيل / إيقاف الموسيقى';
      btn.setAttribute('aria-label', 'تشغيل / إيقاف الموسيقى');
      btn.style.opacity = '.65';
      document.body.append(audio, btn);

      const KEY = 'mdm1_music_choice';
      const get = () => { try { return sessionStorage.getItem(KEY); } catch(e){ return null; } };
      const set = v => { try { sessionStorage.setItem(KEY, v); } catch(e){} };
      let timer;
      function fade(to, ms, done){
        clearInterval(timer);
        const from = audio.volume, steps = 25, d = (to - from) / steps; let i = 0;
        timer = setInterval(() => {
          i++; audio.volume = Math.max(0, Math.min(1, from + d * i));
          if(i >= steps){ clearInterval(timer); if(done) done(); }
        }, ms / steps);
      }
      function on(){ btn.classList.add('playing'); btn.style.opacity = '1'; }
      function off(){ btn.classList.remove('playing'); btn.style.opacity = '.65'; }
      function play(ms){
        audio.volume = 0;
        const p = audio.play();
        if(p && p.then) p.then(() => { on(); fade(0.45, ms); }).catch(() => { off(); });
      }
      btn.addEventListener('click', () => {
        if(audio.paused){ set('yes'); play(1200); }
        else { set('no'); fade(0, 700, () => audio.pause()); off(); }
      });
      const saveData = navigator.connection && navigator.connection.saveData;
      if(get() !== 'no' && !saveData) setTimeout(() => play(2200), 400);
      document.addEventListener('visibilitychange', () => {
        if(document.visibilityState === 'visible' && get() === 'yes' && audio.paused) play(1200);
      });
    } catch(e){ /* الموسيقى اختيارية — لا تكسر الصفحة */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initMusic();
    initGeneratedPageMusic();
    initLiveElements();
    initPsychology();
    initCursor();
    initParticles();
    initReveal();
  });
})();
