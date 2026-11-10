(() => {
  const form = document.getElementById('quote-form');
  const typeField = document.getElementById('service-type');
  const status = document.getElementById('form-status');
  const copyButton = document.getElementById('copy-request');
  const addressButton = document.getElementById('copy-address');
  const walletStatus = document.getElementById('wallet-status');
  const txForm = document.getElementById('tx-form');
  const mailtoAddress = 'info@mdm1.org';
  let requestText = '';

  const deposits = {
    'إعداد موقع أو صفحة هبوط': '49.50 USDT دفعة بدء من أصل 99 USDT',
    'أتمتة إجراء بسيط': '39.50 USDT دفعة بدء من أصل 79 USDT',
    'دعم وصيانة شهرية': '29 USDT للشهر، يدويًا دون تجديد آلي'
  };

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
      const service = String(data.get('service') || '').trim();
      const lines = [
        'طلب خدمة من موقع MDM1',
        '',
        `الباقة: ${service}`,
        `المبلغ المعلن/دفعة البدء: ${deposits[service] || 'يرجى مراجعة السعر قبل الدفع'}`,
        `بريد الرد: ${data.get('email')}`,
        `النشاط أو المشروع: ${data.get('business') || 'لم يذكر'}`,
        `رابط الموقع: ${data.get('url') || 'لم يذكر'}`,
        '',
        'وصف الطلب:',
        String(data.get('brief') || '').trim(),
        '',
        'سأنتظر تأكيد النطاق والموعد عبر البريد قبل إرسال أي تحويل.'
      ];
      requestText = lines.join('\n');
      const subject = `طلب خدمة MDM1 — ${service}`;
      const mailto = `mailto:${mailtoAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(requestText)}`;
      copyButton.hidden = false;
      status.textContent = 'جهزنا الرسالة. راجعها وأرسلها بنفسك. لا تحوّل قبل تأكيدنا للنطاق والموعد.';
      window.location.href = mailto;
    });
  }

  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      if (!requestText) return;
      const copied = await copyText(requestText);
      status.textContent = copied
        ? 'نُسخ نص الطلب. أرسله إلى info@mdm1.org.'
        : 'تعذر النسخ تلقائيًا. أعد إنشاء رسالة البريد أو انسخ الحقول يدويًا.';
    });
  }

  if (addressButton) {
    addressButton.addEventListener('click', async () => {
      const address = addressButton.dataset.address || '';
      const copied = await copyText(address);
      walletStatus.textContent = copied
        ? 'نُسخ العنوان. تأكد من اختيار USDT على Polygon PoS قبل الإرسال.'
        : 'تعذر النسخ تلقائيًا. اضغط مطولًا على العنوان لنسخه يدويًا.';
    });
  }

  if (txForm) {
    txForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!txForm.reportValidity()) return;
      const data = new FormData(txForm);
      const message = [
        'تأكيد تحويل USDT إلى MDM1',
        '',
        `الباقة: ${data.get('service')}`,
        `بريد العميل: ${data.get('email')}`,
        `المبلغ: ${data.get('amount')} USDT`,
        'الشبكة: Polygon PoS',
        `عنوان الاستقبال: ${addressButton.dataset.address}`,
        `TXID: ${String(data.get('txid') || '').trim()}`,
        '',
        'أرجو التحقق يدويًا من وصول المبلغ ثم تأكيد الاستلام.'
      ].join('\n');
      const subject = `TXID تأكيد تحويل MDM1 — ${data.get('service')}`;
      txForm.querySelector('#tx-status').textContent = 'جهزنا رسالة التأكيد. أرسلها بنفسك بعد مراجعتها؛ هذا النموذج لا يتحقق من الدفع تلقائيًا.';
      window.location.href = `mailto:${mailtoAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    });
  }

  async function copyText(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (error) {
      // Use the legacy clipboard path below when permissions deny the modern API.
    }
    const fallback = document.createElement('textarea');
    fallback.value = value;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.appendChild(fallback);
    fallback.select();
    const copied = document.execCommand('copy');
    fallback.remove();
    return copied;
  }

  document.querySelectorAll('.service-card').forEach((card, index) => {
    card.style.animationDelay = `${index * 70}ms`;
    card.classList.add('reveal');
  });
})();
