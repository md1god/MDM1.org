(() => {
  'use strict';
  const KEY = 'mdm1_account_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } };
  const save = value => { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (_) {} };
  const state = Object.assign({ profile: null, favorites: [] }, load());
  const $ = s => document.querySelector(s);
  const esc = v => String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const notify = message => { const el = $('#account-toast'); if (!el) return; el.textContent = message; el.hidden = false; setTimeout(() => { el.hidden = true; }, 2600); };
  const render = () => {
    const signed = !!state.profile;
    const label = signed ? `مرحباً، ${state.profile.name || state.profile.email}` : 'تسجيل الدخول';
    document.querySelectorAll('[data-account-label]').forEach(el => { el.textContent = label; });
    document.querySelectorAll('[data-favorite-count]').forEach(el => { el.textContent = state.favorites.length; });
    document.querySelectorAll('[data-favorite-id]').forEach(el => {
      const active = state.favorites.includes(el.dataset.favoriteId);
      el.classList.toggle('is-favorite', active);
      el.setAttribute('aria-pressed', String(active));
      el.title = active ? 'إزالة من المفضلة' : 'حفظ في المفضلة';
    });
  };
  const open = () => { const panel = $('#account-panel'); if (panel) { panel.hidden = false; $('#account-email')?.focus(); } };
  const close = () => { const panel = $('#account-panel'); if (panel) panel.hidden = true; };
  const toggleFavorite = id => {
    if (!id) return;
    const i = state.favorites.indexOf(id);
    if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(id);
    save(state); render(); notify(i >= 0 ? 'أزيل من المفضلة' : 'حُفظ في المفضلة');
  };
  document.addEventListener('click', event => {
    const fav = event.target.closest('[data-favorite-id]');
    if (fav) { event.preventDefault(); toggleFavorite(fav.dataset.favoriteId); return; }
    if (event.target.closest('[data-account-open]')) { open(); return; }
    if (event.target.closest('[data-account-close]')) { close(); return; }
    if (event.target.closest('[data-account-signout]')) { state.profile = null; save(state); render(); close(); notify('تم تسجيل الخروج من هذا الجهاز'); return; }
  });
  document.addEventListener('submit', event => {
    if (!event.target.matches('#account-form')) return;
    event.preventDefault();
    const email = String($('#account-email')?.value || '').trim();
    const name = String($('#account-name')?.value || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { notify('أدخل بريداً إلكترونياً صحيحاً'); return; }
    state.profile = { email, name: name || email.split('@')[0], mode: 'local', updatedAt: new Date().toISOString() };
    save(state); render(); close(); notify('تم حفظ حسابك محلياً. اربط Supabase لتسجيل سحابي حقيقي.');
  });
  window.MDM1Account = { state, open, close, toggleFavorite, render };
  render();
})();
