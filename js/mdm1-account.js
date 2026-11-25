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
      if (!data.session?.user) {
        if (state.profile?.mode === 'supabase') {
          state.profile = null;
          state.favorites = [];
          save(state);
          render();
        }
        return;
      }
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
    const provider = event.target.closest('[data-account-provider]');
    if (provider) {
      event.preventDefault();
      if (!remote() || typeof window.signInWithProvider !== 'function') { notify('خدمة تسجيل الدخول غير متاحة الآن'); return; }
      window.signInWithProvider(provider.dataset.accountProvider).then(res => {
        if (res && res.error) notify(/provider is not enabled|unsupported provider/i.test(res.error.message || '') ? 'هذا المزوّد غير مفعّل بعد؛ استخدم البريد الإلكتروني' : 'تعذر بدء تسجيل الدخول؛ حاول مرة أخرى');
      }).catch(() => notify('تعذر بدء تسجيل الدخول؛ حاول مرة أخرى'));
      return;
    }
    if (event.target.closest('[data-account-verify]')) {
      event.preventDefault();
      const email = String($('#account-email')?.value || '').trim().toLowerCase();
      const code = String($('#account-code')?.value || '').trim();
      if (!/^\d{6,8}$/.test(code.replace(/\s+/g, ''))) { notify('أدخل الكود المكوّن من 6 أرقام'); return; }
      window.verifyEmailCode(email, code).then(res => {
        if (res.error) { notify('الكود غير صحيح أو منتهي؛ اطلب كوداً جديداً'); return; }
        notify('تم تسجيل الدخول'); close(); hydrateRemote();
      }).catch(() => notify('تعذر التحقق من الكود؛ حاول مرة أخرى'));
      return;
    }
    if (event.target.closest('[data-account-open]')) { open(); return; }
    if (event.target.closest('[data-account-close]')) { close(); return; }
    if (event.target.closest('[data-account-signout]')) {
      const sb = remote(); if (sb) sb.auth.signOut().catch(() => {});
      state.profile = null; state.favorites = []; save(state); render(); close(); notify('تم تسجيل الخروج'); return;
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
      if (!result.error) {
        notify('أرسلنا رابط وكود الدخول إلى بريدك الإلكتروني');
        const row = $('#account-code-row'); if (row) { row.hidden = false; $('#account-code')?.focus(); }
        return;
      }
      const msg = String(result.error.message || '');
      if (result.error.code === 'cooldown' || /after \d+ seconds|rate limit/i.test(msg)) { notify(msg.startsWith('انتظر') ? msg : 'تم إرسال طلبات كثيرة؛ انتظر دقيقة ثم حاول مجدداً'); return; }
      notify('تعذر إرسال رابط الدخول؛ يمكنك استخدام الوضع المحلي مؤقتاً');
    }
    state.profile = { email, name: name || email.split('@')[0], mode: 'local', updatedAt: new Date().toISOString() };
    save(state); render(); close(); notify('تم حفظ الحساب محلياً');
  });
  window.MDM1Account = { state, open, close, toggleFavorite, render };
  render();
  hydrateRemote();
  if (window.mdm1AuthError) {
    const m = String(window.mdm1AuthError.message || '');
    open();
    notify(/expired|invalid/i.test(m) ? 'انتهى رابط الدخول أو استُخدم من قبل؛ اطلب رابطاً جديداً أو أدخل الكود من الإيميل' : 'تعذر إكمال تسجيل الدخول؛ حاول مرة أخرى');
  }
  if (remote()) remote().auth.onAuthStateChange(() => hydrateRemote());
})();
