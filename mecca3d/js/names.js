// تصحيح إملاء أسماء الشوارع والأحياء والمعالم القادمة من OSM (همزات، تاء مربوطة، تشكيل) وتعريب الأسماء اللاتينية المؤكدة.
const TASHKEEL = /[ً-ٰٟـ]/g;
const WORDS = {
  'ابراهيم': 'إبراهيم', 'اسماعيل': 'إسماعيل', 'الامير': 'الأمير', 'الامام': 'الإمام', 'الاخلاق': 'الأخلاق', 'انوار': 'أنوار', 'اجياد': 'أجياد',
  'ابو': 'أبو', 'الى': 'إلى', 'الاول': 'الأول', 'الاولى': 'الأولى', 'الكعبه': 'الكعبة', 'الكعكيه': 'الكعكية', 'اللة': 'الله', 'امن': 'أمن',
  'الاسنان': 'الأسنان', 'القران': 'القرآن', 'الاحمر': 'الأحمر', 'ممشي': 'ممشى', 'اذاخر': 'ذاخر', 'الاسلام': 'الإسلام', 'الاسلامي': 'الإسلامي',
  'الاندلس': 'الأندلس', 'الاسود': 'الأسود', 'المكرمه': 'المكرمة', 'المنوره': 'المنورة', 'المشرفه': 'المشرفة', 'الشريفه': 'الشريفة',
  'العزيزيه': 'العزيزية', 'الخالديه': 'الخالدية', 'الشوقيه': 'الشوقية', 'الهلاليه': 'الهلالية', 'المسفله': 'المسفلة', 'مكه': 'مكة', 'الكريمه': 'الكريمة',
  'الاميرة': 'الأميرة', 'الاخضر': 'الأخضر', 'الاقصى': 'الأقصى', 'الاسواق': 'الأسواق', 'الاعلام': 'الإعلام', 'الابطح': 'الأبطح', 'الاهلي': 'الأهلي',
};
const PHRASES = [[/عبد اللة/g, 'عبد الله'], [/غسيل الكلي/g, 'غسيل الكلى'], [/(^|\s)ام القرى/g, '$1أم القرى'], [/(^|\s)ام جرفان/g, '$1أم جرفان']];
export function fixAr(s) {
  if (!s || !/[؀-ۿ]/.test(s)) return s;
  let t = s.replace(TASHKEEL, '').replace(/\s+/g, ' ').trim();
  for (const [re, to] of PHRASES) t = t.replace(re, to);
  return t.split(' ').map((w) => WORDS[w] || w).join(' ');
}
// أسماء لاتينية فقط في OSM (دون اسم عربي) ونعرف مقابلها العربي المشهور بثقة
const LATIN = {
  'King Khalid Road': 'طريق الملك خالد', 'Second Ring Road': 'الدائري الثاني', 'Makkah-Jeddah Expressway': 'طريق مكة - جدة السريع',
  'Muzdalifah Road': 'طريق مزدلفة', 'Muzdalifah Street': 'شارع مزدلفة', 'Jabal Omar Street': 'شارع جبل عمر', 'Ali Ibn Abi Talib Street': 'شارع علي بن أبي طالب',
  'As Salam Street': 'شارع السلام', 'Al Rahma Street': 'شارع الرحمة', 'Al Amal Street': 'شارع الأمل', 'Al Fikr Street': 'شارع الفكر', 'Hidaya Street': 'شارع الهداية',
  'At Thaqafah Street': 'شارع الثقافة', 'Al Istiqrar Street': 'شارع الاستقرار', 'Al Muhandis Street': 'شارع المهندس', 'Al Mufti Street': 'شارع المفتي',
  'Taqadam Street': 'شارع التقدم', 'At Tilawah Street': 'شارع التلاوة', 'Dar Al Hadith Street': 'شارع دار الحديث', 'Al Balad Al Amin Street': 'شارع البلد الأمين',
  'Al Ilam Street': 'شارع الإعلام', 'Jurhum Street': 'شارع جرهم', 'Al Maliki Street': 'شارع المالكي', 'An Nur Street': 'شارع النور', 'As Shuhada Street': 'شارع الشهداء',
  'Abu Bakr Al Siddiq Street': 'شارع أبي بكر الصديق', 'Ajyad Street': 'شارع أجياد', 'Ajyad Bridge': 'جسر أجياد', 'Ajyad': 'أجياد',
  'Al Imam Al Bukhari Street': 'شارع الإمام البخاري', 'Al Imam Muslim Street': 'شارع الإمام مسلم', 'Al Hijra Street': 'شارع الهجرة', 'Al Jawhara Street': 'طريق الجوهرة',
  'Al Madinah Al Munawarah Road': 'طريق المدينة المنورة', 'Al Andalus Street': 'شارع الأندلس', 'Al Jazair Street': 'شارع الجزائر', 'Abdul Qader Koshak Street': 'د. عبدالقادر كوشك',
  'Abdullah Arif Street': 'طريق عبدالله عريف', 'Abdullah Arif St': 'طريق عبدالله عريف', 'Abdullah Ibn Al Abbas St': 'شارع عبدالله بن عباس', 'Al Abtah Road': 'طريق الأبطح',
  'Al Hujoon Street': 'شارع الحجون', 'Al Hujun Street': 'شارع الحجون', 'Al Khansa Street': 'شارع الخنساء', 'Al Jamiah Street': 'شارع الجامعة', 'Al Ilm Street': 'شارع العلم',
  'Al Imarat Street': 'شارع الإمارات', 'Al Bashair Street': 'شارع البشائر', 'Al Farah Street': 'شارع الفرح', 'Al Haya Street': 'شارع الحياة', 'Al Husna Street': 'شارع الحسنى',
  'Akhlaq Street': 'شارع الأخلاق', 'Al Makarim Street': 'شارع المكارم', 'Al Mahakim Street': 'شارع المحاكم', 'Al Bayah Street': 'شارع البيعة', 'Al Mabadi Street': 'شارع المبادئ',
  'Al Ithar Street': 'شارع الإيثار', 'Al Ijabah Street': 'شارع الإجابة', 'Al Inshira Street': 'شارع الانشراح', 'Al Ful Street': 'شارع الفل',
};
export const latinToAr = (en) => LATIN[(en || '').trim()] || '';
