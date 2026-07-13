/* ============================================================
   MDM1 — PAGES TEMPLATE JS
   Shared by: faq, gallery (and any page reusing these components)
   Safe to include everywhere — each block checks for its own
   markup before doing anything.
   Load AFTER global.js.
   ============================================================ */
(function(){
  "use strict";

  /* ---------------- ACCORDION (faq.html) ---------------- */
  function initAccordion(){
    const items = document.querySelectorAll('.mdm1-accordion__item');
    if(!items.length) return;

    items.forEach(item => {
      const btn = item.querySelector('.mdm1-accordion__q');
      if(!btn) return;
      btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        // close siblings for a single-open accordion feel
        items.forEach(i => i.classList.remove('is-open'));
        if(!isOpen) item.classList.add('is-open');
      });
    });
  }

  /* ---------------- GALLERY LIGHTBOX (gallery.html) ---------------- */
  function initGalleryLightbox(){
    const grid = document.querySelector('.mdm1-grid--gallery');
    if(!grid) return;

    const overlay = document.createElement('div');
    overlay.className = 'mdm1-lightbox';
    overlay.innerHTML = '<img alt="">';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', background:'rgba(10,9,7,0.92)',
      display:'none', alignItems:'center', justifyContent:'center',
      zIndex:'2000', cursor:'zoom-out', padding:'2rem'
    });
    const img = overlay.querySelector('img');
    Object.assign(img.style, { maxWidth:'92vw', maxHeight:'92vh', borderRadius:'4px' });
    document.body.appendChild(overlay);

    grid.querySelectorAll('img').forEach(thumb => {
      thumb.style.cursor = 'zoom-in';
      thumb.addEventListener('click', () => {
        img.src = thumb.src;
        img.alt = thumb.alt || '';
        overlay.style.display = 'flex';
      });
    });
    overlay.addEventListener('click', () => { overlay.style.display = 'none'; });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape') overlay.style.display = 'none';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initAccordion();
    initGalleryLightbox();
  });
})();
