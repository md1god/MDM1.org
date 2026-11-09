/* MDM1 - country search for the join form. Names come from the browser (Intl.DisplayNames) in the page language,
   and the search also matches the English name and the ISO code. No data files, no network. */
(function () {
  "use strict";
  var CODES = ("AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI KH CM CA CV CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW HK XK").split(" ");
  var lang = (document.documentElement.lang || "ar").toLowerCase();
  function names(l) { try { return new Intl.DisplayNames([l], { type: "region" }); } catch (e) { return null; } }
  var local = names(lang) || names("en"), en = names("en");
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[ً-ٰٟ̀-ͯ]/g, "")
      .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
  }
  var LIST = CODES.map(function (c) {
    var n = local ? local.of(c) : c, e = en ? en.of(c) : c;
    return { code: c, name: n || c, key: norm(n) + " " + norm(e) + " " + c.toLowerCase() };
  }).sort(function (a, b) { return a.name.localeCompare(b.name, lang); });
  window.searchCountries = function (q) {
    var t = norm(q);
    if (!t) return [];
    var starts = [], has = [];
    LIST.forEach(function (c) {
      if (c.key.indexOf(t) === 0 || c.key.indexOf(" " + t) >= 0) starts.push(c); else if (c.key.indexOf(t) >= 0) has.push(c);
    });
    return starts.concat(has).slice(0, 8).map(function (c) { return { code: c.code, name: c.name }; });
  };
})();
