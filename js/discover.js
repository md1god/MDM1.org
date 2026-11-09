(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const state = { q:'', type:'all', category:'all', status:'all', sort:'relevance', items:[] };
  const labels = {working_app:'تطبيق يعمل الآن',tool:'أداة مجانية',game:'لعبة',project_plan:'مشروع قيد البناء'};
  const cats = {ai:'ذكاء اصطناعي',dev:'أدوات مطورين',biz:'أعمال',edu:'تعليم',data:'بيانات',media:'إعلام',life:'حياة',sec:'خصوصية وأمان',prod:'إنتاجية',mkt:'تسويق',sci:'علوم',fin:'مال'};
  const escape = v => String(v || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function normal(v){ return String(v||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,''); }
  function normalizeRecord(r, type){ return { ...r, type:type || r.type || 'tool', status:r.status || (type==='project_plan'?'under_construction':'working'), title:r.displayTitle || r.title || r.name, url:r.url || (r.slug ? `/${type==='tool'?'tools':'apps'}/${r.slug}.html` : '#') }; }
  async function load(){
    const [catalog, tools, games] = await Promise.allSettled(['/data/catalog.json','/data/tools.json','/data/games.json'].map(u => fetch(u).then(r => r.ok ? r.json() : null)));
    const out=[];
    if(catalog.value?.records) out.push(...catalog.value.records.map(r=>normalizeRecord(r)));
    if(tools.value?.tools) out.push(...tools.value.tools.map(r=>normalizeRecord(r,'tool')));
    if(Array.isArray(games.value)) out.push(...games.value.slice(0,1200).map(g=>normalizeRecord({title:g.title||g.name,description:g.description||'لعبة متاحة عبر بوابة الألعاب',url:g.url||`/games/${g.id||g.slug}.html`,date:g.date||''},'game')));
    state.items=out.filter((r,i,a)=>r.url && a.findIndex(x=>x.url===r.url)===i);
    buildCategories(); render();
  }
  function buildCategories(){
    const select=$('#category-filter'); const values=[...new Set(state.items.flatMap(x=>[x.primaryCategory,...(x.secondaryCategories||[])].filter(Boolean)))].sort();
    select.innerHTML='<option value="all">كل المجالات</option>'+values.map(v=>`<option value="${escape(v)}">${escape(cats[v]||v)}</option>`).join('');
  }
  function filtered(){
    const q=normal(state.q);
    let arr=state.items.filter(x=>{
      const hay=normal([x.title,x.description,x.primaryCategory,(x.secondaryCategories||[]).join(' '),(x.tags||[]).join(' ')].join(' '));
      return (!q || hay.includes(q)) && (state.type==='all'||x.type===state.type) && (state.category==='all'||x.primaryCategory===state.category||(x.secondaryCategories||[]).includes(state.category)) && (state.status==='all'||x.status===state.status);
    });
    if(state.sort==='newest') arr.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    if(state.sort==='title') arr.sort((a,b)=>normal(a.title).localeCompare(normal(b.title)));
    return arr;
  }
  function render(){
    const arr=filtered(), box=$('#results'); $('#result-count').textContent=`${arr.length.toLocaleString('ar')} نتيجة متاحة`; $('#empty').hidden=arr.length!==0;
    box.innerHTML=arr.slice(0,120).map(x=>{const w=x.status==='under_construction'||x.type==='project_plan'; const id=x.url||x.title; return `<article class="result-card"><div class="card-meta"><span>${escape(labels[x.type]||'مورد رقمي')}</span><span class="badge ${w?'wip':''}">${w?'قيد البناء':'متاح الآن'}</span></div><h3>${escape(x.title)}</h3><p>${escape(x.description||'اكتشف هذا المورد من خلال MDM1.org.')}</p><div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-top:auto"><a href="${escape(x.url)}">${w?'عرض الخطة':'فتح المورد'} <span aria-hidden="true">←</span></a><button class="favorite-button" type="button" data-favorite-id="${escape(id)}" aria-label="حفظ في المفضلة">★</button></div></article>`}).join('');
  }
  function set(key,value){ state[key]=value; document.querySelectorAll('.quick-links button').forEach(b=>b.classList.toggle('active',b.dataset.filter===value)); render(); }
  $('#search').addEventListener('input',e=>set('q',e.target.value)); $('#type-filter').addEventListener('change',e=>set('type',e.target.value)); $('#category-filter').addEventListener('change',e=>set('category',e.target.value)); $('#status-filter').addEventListener('change',e=>set('status',e.target.value)); $('#sort-filter').addEventListener('change',e=>set('sort',e.target.value));
  $('#reset').addEventListener('click',()=>{state.q='';state.type=state.category=state.status='all';$('#search').value='';$('#type-filter').value='all';$('#category-filter').value='all';$('#status-filter').value='all';render()});
  document.querySelectorAll('.quick-links button').forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.filter;if(v==='all') $('#reset').click(); else if(v==='working_app'||v==='tool'||v==='game'||v==='project_plan'){ $('#type-filter').value=v; set('type',v); }}));
  document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();$('#search').focus()} if(e.key==='Escape'){$('#search').blur()}});
  function bindAi(){
    $('#ai-prompt-btn')?.addEventListener('click',()=>{const goal=$('#ai-goal').value.trim()||'إنشاء حل رقمي مفيد'; const tone=$('#ai-tone').value; $('#ai-prompt-output').textContent=`أنت خبير ${tone}.\nالهدف: ${goal}\nحلّل المستخدمين والمشكلة، اقترح 3 بدائل، ثم اكتب خطة MVP بخطوات قابلة للقياس ومخاطر واضحة.`;});
    $('#ai-clarity-btn')?.addEventListener('click',()=>{const text=$('#ai-text').value.trim(); const words=text?text.split(/\s+/).length:0; if(!text){$('#ai-clarity-output').textContent='أدخل نصاً أولاً.';return;} const sentences=(text.match(/[.!؟!?]/g)||[]).length||1; const advice=words>80?'قسّم الفقرة إلى نقاط قصيرة وابدأ بالنتيجة الرئيسية.':words<12?'أضف سياقاً أو مثالاً حتى تصبح الفكرة قابلة للفهم.':'البنية جيدة؛ اجعل الجملة الأولى أكثر مباشرة واحتفظ بمثال واحد.'; $('#ai-clarity-output').textContent=`تحليل محلي: ${words} كلمة · ${sentences} جملة.\n${advice}`;});
    $('#ai-recommend-btn')?.addEventListener('click',()=>{const q=normal($('#ai-need').value); const hits=state.items.filter(x=>normal([x.title,x.description,x.primaryCategory,(x.tags||[]).join(' ')].join(' ')).includes(q)).slice(0,3); $('#ai-recommend-output').textContent=hits.length?hits.map((x,i)=>`${i+1}. ${x.title}`).join('\n'):'لم أجد تطابقاً مباشراً؛ جرّب كلمات مثل: أداة، خصوصية، تعليم، إنتاجية.';});
  }
  bindAi();
  load().catch(()=>{$('#result-count').textContent='تعذر تحميل الفهرس مؤقتاً';});
})();
