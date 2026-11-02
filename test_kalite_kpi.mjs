// LeanSys kalite kaynağı: havuzlama, Vileda/Diğer kapsamı, NA ve kaynak tahmini.
// Satırlar 01.11.2026 Veliköy kuru çekiminden (_kpikalite_refresh.ps1 -Kuru); beklenen
// değerler 16QA kanıt Excel'i (kpi_velikoy_2026.py) ile aynı.
//   çalıştır:  node test_kalite_kpi.mjs
import assert from 'assert';
import { buildSync } from 'esbuild';

const yukle = async (giris) => {
  const c = buildSync({ entryPoints: [giris], bundle: true, write: false, format: 'esm', platform: 'neutral', target: 'es2020' }).outputFiles[0].text;
  return import('data:text/javascript;base64,' + Buffer.from(c).toString('base64'));
};
const { aylikKalite } = await yukle('utils/kaliteKpiSource.ts');
const { kaynakTahmini } = await yukle('utils/kaynakTahmin.ts');

const S = (ay, seg, o) => ({ yer: 'VELIKOY', yil: 2026, ay, seg, qi: 0, sikayet: 0, icHatali: 0, icKontrol: 0, iadeMiktar: 0, iadeSevk: 0,
  sevkSatir: 0, maliyet: 0, maliyetKayit: 0, fiyatsiz: 0, iadeTutar: 0, ciro: 0, ...o });
const rows = [
  S(1, 'diger',  { qi: 26, icHatali: 39102, icKontrol: 320031, icPay: 36000, icPayda: 1500000, ekYeri: 3102, sevkSatir: 328, maliyet: 46579, ciro: 17809633 }),
  S(1, 'vileda', { qi: 13, icHatali: 12652, icKontrol: 234620, icPay: 12509, icPayda: 320435, ekYeri: 143, sevkSatir: 38, maliyet: 76761, ciro: 5226134 }),
  S(7, 'diger',  { qi: 18, iadeMiktar: 1800, iadeSevk: 549190, sevkSatir: 499, maliyet: 34328, ciro: 24870275 }),
  S(7, 'vileda', { qi: 9, sevkSatir: 21, maliyet: 58, ciro: 3077146 }),
  // Başka lokasyon karışmamalı
  { ...S(1, 'diger', { qi: 99, ciro: 1 }), yer: 'CERKEZKOY' },
];

const tum = aylikKalite(rows, 'Veliköy', 2026, 'tum');
assert.strictEqual(tum[1].kalite_qi, 39);                       // FR100 Ocak = 39
assert.strictEqual(tum[1].kalite_maliyet, 123340);
// İç PPM: (hatalı − ek yeri) / ÜRETİM, havuzlanmış — iki PPM'in ortalaması DEĞİL; kontrol miktarı kullanılmaz
assert.strictEqual(tum[1].kalite_ic_ppm, Math.round((36000 + 12509) / (1500000 + 320435) * 1e6));
assert.strictEqual(tum[1].kalite_fire_ppm, Math.round((3102 + 143) / (1500000 + 320435) * 1e6));
assert.strictEqual(tum[7].kalite_ic_ppm, null);                 // üretim paydası yok → NA
assert.strictEqual(tum[1].kalite_oran, parseFloat((123340 / (17809633 + 5226134) * 100).toFixed(3)));
assert.strictEqual(tum[1].kalite_iade_ppm, 0);                  // iade yok, sevk var → 0
assert.strictEqual(tum[7].kalite_iade_ppm, 3277.55);            // 1800 / 549190 × 1e6
assert.strictEqual(tum[2].kalite_qi, null);                     // satırı olmayan ay NA, 0 değil
assert.strictEqual(tum[2].kalite_iade_ppm, null);

const vil = aylikKalite(rows, 'Veliköy', 2026, 'vileda');
assert.strictEqual(vil[1].kalite_qi, 13);
assert.strictEqual(vil[7].kalite_iade_ppm, 0);
const dig = aylikKalite(rows, 'Veliköy', 2026, 'diger');
assert.strictEqual(dig[1].kalite_qi, 26);
assert.strictEqual(vil[1].kalite_qi + dig[1].kalite_qi, tum[1].kalite_qi);

// Proses iç PPM: Üretim / Paketleme ayrı havuzlanır; o prosesin üretimi yoksa NA
const pr = aylikKalite([S(2, 'diger', { icPayU: 100, icPaydaU: 50000, icPayP: 900, icPaydaP: 60000 }),
                        S(2, 'vileda', { icPayP: 100, icPaydaP: 40000 })], 'Veliköy', 2026);
assert.strictEqual(pr[2].kalite_ic_ppm_uretim, 2000);
assert.strictEqual(pr[2].kalite_ic_ppm_paket, 10000);   // (900+100)/(60000+40000), ortalama değil
assert.strictEqual(aylikKalite([S(2, 'vileda', { icPayP: 1, icPaydaP: 10 })], 'Veliköy', 2026)[2].kalite_ic_ppm_uretim, null);

// Planlama: terminlere uygunluk ve ortalama gecikme — Vileda + Diğer havuzlanır
const pl = aylikKalite([S(5, 'diger', { sipSatir: 80, sipZamaninda: 72, sipGecikmeGun: 40 }), S(5, 'vileda', { sipSatir: 20, sipZamaninda: 20 })], 'Veliköy', 2026);
assert.strictEqual(pl[5].plan_termin, 92);
assert.strictEqual(pl[5].plan_gecikme, 0.4);
assert.strictEqual(aylikKalite([S(5, 'diger', {})], 'Veliköy', 2026)[5].plan_termin, null);   // satır yok → NA, %0 değil

// OEE: planlı süre ağırlıklı, yalnız 'diger' satırında
const oe = aylikKalite([S(4, 'diger', { oeePlanU: 1000, oeeWU: 450, oeePlanP: 3000, oeeWP: 1650 }), S(4, 'vileda', {})], 'Veliköy', 2026);
assert.strictEqual(oe[4].kalite_oee_uretim, 45);
assert.strictEqual(oe[4].kalite_oee_paket, 55);

// İade var ama aynı birimde sevk yok → oran uydurulmaz
const iadeSevksiz = aylikKalite([S(3, 'diger', { iadeMiktar: 10, sevkSatir: 5 })], 'Veliköy', 2026);
assert.strictEqual(iadeSevksiz[3].kalite_iade_ppm, null);

// Kaynak tahmini: müşteri iade PPM'i artık tedarikçi değil
const k = (proses, kpi_adi) => kaynakTahmini({ proses, kpi_adi });
assert.deepStrictEqual(k('Kalite', 'Toplam İade PPM Total Return PPM'), { type: 'kalite', metric: 'kalite_iade_ppm' });
assert.deepStrictEqual(k('Paketleme Prosesi', 'Dış İade PPM External Returns PPM'), { type: 'kalite', metric: 'kalite_iade_ppm' });
assert.deepStrictEqual(k('Kalite', 'İç PPM internal PPM'), { type: 'kalite', metric: 'kalite_ic_ppm' });
assert.deepStrictEqual(k('Kalite', 'Ek Yeri Firesi PPM'), { type: 'kalite', metric: 'kalite_fire_ppm' });
assert.deepStrictEqual(k('Kalite', 'İade PPM — Vileda'), { type: 'kalite', metric: 'kalite_iade_ppm' });
assert.deepStrictEqual(k('Kalite', 'QI — Diğer (Vileda hariç)'), { type: 'kalite', metric: 'kalite_qi' });
assert.deepStrictEqual(k('Üretim Prosesi', 'İç iade PPM Internal return PPM'), { type: 'kalite', metric: 'kalite_ic_ppm_uretim' });
assert.deepStrictEqual(k('Paketleme Prosesi', 'İç iade PPM'), { type: 'kalite', metric: 'kalite_ic_ppm_paket' });
assert.strictEqual(k('Kalite', 'İç iade PPM'), null);   // proses belli değil → tahmin edilmez
assert.deepStrictEqual(k('Kalite', 'Kalite Uygunsuzlukları Adedi (QI)'), { type: 'kalite', metric: 'kalite_qi' });
assert.deepStrictEqual(k('Kalite', 'Müşteri Şikayetleri Miktarı'), { type: 'kalite', metric: 'kalite_sikayet' });
assert.deepStrictEqual(k('Kalite', 'Kalite Maliyetlerinin Aylık Bütçeye Oranı'), { type: 'kalite', metric: 'kalite_oran' });
// Tedarikçi KPI'ları yerinde kalmalı
assert.deepStrictEqual(k('Satınalma', 'Tedarikçi Değerlendirme (iade ppm göre)'), { type: 'tedarikci', metric: 'td_ppmpuan' });
assert.strictEqual(k('Yönetim', 'Ebidta'), null);
assert.deepStrictEqual(k('Paketleme Prosesi', 'OEE (Toplam Ekipman Etkinliği)'), { type: 'kalite', metric: 'kalite_oee_paket' });
assert.deepStrictEqual(k('Üretim Prosesi', 'OEE (Toplam Ekipman Etkinliği)'), { type: 'kalite', metric: 'kalite_oee_uretim' });
assert.deepStrictEqual(k('Planlama Prosesi', 'Terminlere Uygunluk'), { type: 'kalite', metric: 'plan_termin' });
assert.deepStrictEqual(k('Planlama Prosesi', 'Ortalama Gecikme Gün Sayısı'), { type: 'kalite', metric: 'plan_gecikme' });

console.log('test_kalite_kpi: tamam');
