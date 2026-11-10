(() => {
  const form = document.getElementById('quote-form');
  const typeField = document.getElementById('service-type');
  const status = document.getElementById('form-status');
  const copyButton = document.getElementById('copy-request');
  const mailtoAddress = 'info@mdm1.org';
  let requestText = '';

  document.querySelectorAll('.service-select').forEach((button) => {
    button.addEventListener('click', () => {
      const requestedService = button.dataset.service || '';
      const match = Array.from(typeField.options).find((option) => option.text === requestedService);
      if (match) typeField.value = match.value;
      document.getElementById('quote').scrollIntoView({ behavior: 'smooth', block: 'start' });
      typeField.focus({ preventScroll: true });
    });
  });

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const data = new FormData(form);
      const lines = [
        'طلب عرض سعر من موقع MDM1',
        '',
        `الخدمة المطلوبة: ${data.get('service')}`,
        `بريد الرد: ${data.get('email')}`,
        `النشاط أو المشروع: ${data.get('business') || 'لم يذكر'}`,
        `رابط الموقع: ${data.get('url') || 'لم يذكر'}`,
        '',
        'وصف الطلب:',
        String(data.get('brief') || '').trim(),
        '',
        'أرجو مراجعة النطاق وإفادتي بإمكانية التنفيذ والسعر والمدة قبل أي اتفاق.'
      ];
      requestText = lines.join('\n');
      const subject = `طلب عرض سعر MDM1 — ${data.get('service')}`;
      const mailto = `mailto:${mailtoAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(requestText)}`;
      copyButton.hidden = false;
      status.textContent = 'جهزنا الرسالة. راجعها في تطبيق البريد وأرسلها بنفسك. إذا لم يفتح البريد، استخدم زر نسخ نص الطلب.';
      window.location.href = mailto;
    });
  }

  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      if (!requestText) return;
      try {
        await navigator.clipboard.writeText(requestText);
        status.textContent = 'نُسخ نص الطلب. الصقه في رسالة إلى info@mdm1.org ثم أرسله بنفسك.';
      } catch (error) {
        const fallback = document.createElement('textarea');
        fallback.value = requestText;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        const copied = document.execCommand('copy');
        fallback.remove();
        status.textContent = copied
          ? 'نُسخ نص الطلب. الصقه في رسالة إلى info@mdm1.org ثم أرسله بنفسك.'
          : 'تعذر النسخ تلقائيًا. أعد إنشاء الرسالة أو انسخ الحقول يدويًا.';
      }
    });
  }

  document.querySelectorAll('.service-card').forEach((card, index) => {
    card.style.animationDelay = `${index * 70}ms`;
    card.classList.add('reveal');
  });
})();
