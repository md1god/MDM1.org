(() => {
  'use strict';

  const isArabic = document.documentElement.lang.toLowerCase().startsWith('ar') || !document.documentElement.lang.toLowerCase().startsWith('en');
  const labels = isArabic
    ? { play: 'تشغيل الموسيقى الخلفية', pause: 'إيقاف الموسيقى الخلفية', tap: 'اضغط لتشغيل الموسيقى' }
    : { play: 'Play background music', pause: 'Pause background music', tap: 'Tap to enable background music' };

  const menuButton = document.getElementById('mdm1m-btn');
  const menuPanel = document.getElementById('mdm1m-panel');
  if (menuButton && menuPanel) {
    menuButton.type = 'button';
    menuButton.setAttribute('aria-controls', 'mdm1m-panel');
    menuButton.setAttribute('aria-expanded', 'false');
    menuPanel.setAttribute('aria-label', isArabic ? 'قائمة الموقع' : 'Site navigation');
    menuPanel.setAttribute('aria-hidden', 'true');

    const closeMenu = () => {
      menuPanel.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuPanel.setAttribute('aria-hidden', 'true');
    };
    const openMenu = () => {
      menuPanel.classList.add('is-open');
      menuButton.setAttribute('aria-expanded', 'true');
      menuPanel.setAttribute('aria-hidden', 'false');
    };
    // Capture and stop older page-specific handlers so every page has one reliable controller.
    menuButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      menuPanel.classList.contains('is-open') ? closeMenu() : openMenu();
    }, true);
    document.addEventListener('click', (event) => {
      if (!menuPanel.contains(event.target) && event.target !== menuButton && !menuButton.contains(event.target)) closeMenu();
    }, true);
    menuPanel.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuPanel.classList.contains('is-open')) {
        closeMenu();
        menuButton.focus();
      }
    });
  }

  const musicButton = document.getElementById('music-btn') || document.getElementById('musicBtn');
  const audioId = musicButton?.dataset.md1AudioId || 'bg-music';
  const music = document.getElementById(audioId);
  if (musicButton && music) {
    musicButton.type = 'button';
    musicButton.setAttribute('aria-pressed', 'false');
    music.preload = 'none';
    music.loop = true;
    music.volume = 0.32;

    const updateMusicButton = () => {
      const playing = !music.paused;
      musicButton.textContent = playing ? '♫' : '♪';
      musicButton.classList.toggle('playing', playing);
      musicButton.setAttribute('aria-pressed', String(playing));
      musicButton.title = playing ? labels.pause : labels.play;
      musicButton.setAttribute('aria-label', musicButton.title);
    };
    musicButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!music.paused) {
        music.pause();
        try { localStorage.setItem('mdm1-music-enabled', '0'); } catch (_) {}
        return;
      }
      try {
        await music.play();
        try { localStorage.setItem('mdm1-music-enabled', '1'); } catch (_) {}
      } catch (_) {
        musicButton.title = labels.tap;
      }
      updateMusicButton();
    }, true);
    music.addEventListener('play', updateMusicButton);
    music.addEventListener('pause', updateMusicButton);
    updateMusicButton();
    try {
      if (localStorage.getItem('mdm1-music-enabled') === '1') music.play().catch(() => {});
    } catch (_) {}
  }

  const lazyVideos = document.querySelectorAll('video[data-mdm1-autoplay="true"]');
  const startVideo = (video) => video.play().catch(() => {});
  if ('IntersectionObserver' in window && lazyVideos.length) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          startVideo(entry.target);
          observer.unobserve(entry.target);
        }
      }
    }, { rootMargin: '220px 0px' });
    lazyVideos.forEach((video) => observer.observe(video));
  } else {
    lazyVideos.forEach(startVideo);
  }
})();
