(() => {
  'use strict';
  const KEY = 'mdm1_account_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } };
  const save = value => { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (_) {} };
  const state = Object.assign({ profile: null, favorites: [] }, load());
  const $ = s => document.querySelector(s);
  const remote = () => window.supabase && typeof window.supabase.auth?.getSession === 'function' ? window.supabase : null;
  const notify = message => { const el = $('#account-toast'); if (!el) return; el.textContent = message; el.hidden = false; setTimeout(() => { el.hidden = true; }, 3200); };
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
  const hydrateRemote = async () => {
    const sb = remote(); if (!sb) return;
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session?.user) return;
      const user = data.session.user;
      state.profile = { email: user.email || '', name: user.user_metadata?.name || user.email?.split('@')[0] || '', mode: 'supabase' };
      const result = await sb.from('favorites').select('resource_id').eq('user_id', user.id);
      if (!result.error && Array.isArray(result.data)) state.favorites = result.data.map(row => row.resource_id);
      save(state); render();
    } catch (_) { /* local mode remains available */ }
  };
  const toggleFavorite = async id => {
    if (!id) return;
    const sb = remote();
    if (sb && state.profile?.mode === 'supabase') {
      const { data } = await sb.auth.getSession(); const uid = data.session?.user?.id;
      if (uid) {
        const exists = state.favorites.includes(id);
        const result = exists ? await sb.from('favorites').delete().eq('user_id', uid).eq('resource_id', id) : await sb.from('favorites').insert({ user_id: uid, resource_id: id, resource_type: 'resource' });
        if (!result.error) { state.favorites = exists ? state.favorites.filter(x => x !== id) : [...state.favorites, id]; save(state); render(); notify(exists ? 'أزيل من المفضلة السحابية' : 'حُفظ في المفضلة السحابية'); return; }
        notify('طبّق migration 004 في Supabase لتفعيل المفضلات السحابية');
      }
    }
    const i = state.favorites.indexOf(id);
    if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push(id);
    save(state); render(); notify(i >= 0 ? 'أزيل من المفضلة على هذا الجهاز' : 'حُفظ على هذا الجهاز');
  };
  document.addEventListener('click', event => {
    const fav = event.target.closest('[data-favorite-id]');
    if (fav) { event.preventDefault(); toggleFavorite(fav.dataset.favoriteId); return; }
    if (event.target.closest('[data-account-open]')) { open(); return; }
    if (event.target.closest('[data-account-close]')) { close(); return; }
    if (event.target.closest('[data-account-signout]')) {
      const sb = remote(); if (sb) sb.auth.signOut().catch(() => {});
      state.profile = null; save(state); render(); close(); notify('تم تسجيل الخروج'); return;
    }
  });
  document.addEventListener('submit', async event => {
    if (!event.target.matches('#account-form')) return;
    event.preventDefault();
    const email = String($('#account-email')?.value || '').trim().toLowerCase();
    const name = String($('#account-name')?.value || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { notify('أدخل بريداً إلكترونياً صحيحاً'); return; }
    const sb = remote();
    if (sb && typeof window.sendMagicLink === 'function') {
      const result = await window.sendMagicLink(email, { name });
      if (!result.error) { notify('أرسلنا رابط الدخول إلى بريدك الإلكتروني'); close(); return; }
      notify('تعذر إرسال رابط الدخول؛ يمكنك استخدام الوضع المحلي مؤقتاً');
    }
    state.profile = { email, name: name || email.split('@')[0], mode: 'local', updatedAt: new Date().toISOString() };
    save(state); render(); close(); notify('تم حفظ الحساب محلياً');
  });
  window.MDM1Account = { state, open, close, toggleFavorite, render };
  render();
  hydrateRemote();
  if (remote()) remote().auth.onAuthStateChange(() => hydrateRemote());
})();
