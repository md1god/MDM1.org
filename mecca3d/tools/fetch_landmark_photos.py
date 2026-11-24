#!/usr/bin/env python3
"""Download one Wikipedia lead image per famous landmark into mecca3d/img/landmarks/ (served locally, fast, no runtime dependency)."""
import json, os, re, sys, urllib.parse, urllib.request
OUT = os.path.join(os.path.dirname(__file__), '..', 'img', 'landmarks')
os.makedirs(OUT, exist_ok=True)
UA = {'User-Agent': 'MDM1-mecca3d/1.0 (https://mdm1.org; landmark thumbnails)'}
FAMOUS = {
  'kaaba': (['Kaaba'], ['الكعبة']),
  'haram': (['Great_Mosque_of_Mecca', 'Masjid_al-Haram'], ['المسجد_الحرام']),
  'clock': (['Abraj_Al-Bait', 'Makkah_Royal_Clock_Tower'], ['أبراج_البيت']),
  'safa': (['Safa_and_Marwa', 'Al-Safa_and_Al-Marwa'], ['الصفا_والمروة']),
  'nour': (['Jabal_al-Nour', 'Jabal_al-Noor'], ['جبل_النور']),
  'hira': (['Cave_of_Hira', 'Hira'], ['غار_حراء']),
  'thawr': (['Jabal_Thawr', 'Thawr_Cave'], ['جبل_ثور']),
  'jamarat': (['Jamaraat_Bridge', 'Jamarat', 'Stoning_of_the_Devil'], ['جسر_الجمرات']),
  'muala': (["Jannat_al-Mu'alla"], ['مقبرة_المعلاة']),
  'qubays': (['Jabal_Abu_Qubays', 'Abu_Qubays'], ['جبل_أبي_قبيس']),
  'jinn': (['Masjid_al-Jinn'], ['مسجد_الجن']),
  'library': (["Makkah_Al-Mukarramah_Library", "Birthplace_of_Muhammad"], ["مكتبة_مكة_المكرمة"]),
  'omar': (["Jabal_Omar_Development", "Jabal_Omar"], ["مشروع_جبل_عمر"]),
  'bayah': (["Masjid_al-Bay'ah", "Al-Bay'ah_Mosque"], ["مسجد_البيعة"]),
  'quranm': (["Museum_of_the_Holy_Quran"], ["متحف_القرآن_الكريم"]),
  'uqu': (["Umm_al-Qura_University"], ["جامعة_أم_القرى"]),
  'kudai': (["Abraj_Kudai"], ["أبراج_كدي"]),
  'haramain': (['Haramain_high-speed_railway'], ['قطار_الحرمين_السريع']),
}
def get(url, binary=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        d = r.read(); return d if binary else json.loads(d)
credits = {}
for fid, (en, ar) in FAMOUS.items():
    done = False
    for lang, t in [('en', x) for x in en] + [('ar', x) for x in ar]:
        try:
            j = get(f'https://{lang}.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(t))
            src = (j.get('thumbnail') or {}).get('source')
            if not src: continue
            src = re.sub(r'/(\d+)px-', '/500px-', src)
            data = get(src, True)
            with open(os.path.join(OUT, fid + '.jpg'), 'wb') as f: f.write(data)
            credits[fid] = {'page': j.get('content_urls', {}).get('desktop', {}).get('page', ''), 'title': j.get('title', t)}
            print('ok', fid, lang, t, len(data)); done = True; break
        except Exception as e:
            print('try failed', fid, lang, t, e, file=sys.stderr)
    if not done: print('NO IMAGE', fid, file=sys.stderr)
json.dump(credits, open(os.path.join(OUT, 'credits.json'), 'w'), ensure_ascii=False, indent=1)
