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
  S(1, 'diger',  { qi: 26, icHatali: 39102, icKontrol: 320031, sevkSatir: 328, maliyet: 46579, ciro: 17809633 }),
  S(1, 'vileda', { qi: 13, icHatali: 12652, icKontrol: 234620, sevkSatir: 38, maliyet: 76761, ciro: 5226134 }),
  S(7, 'diger',  { qi: 18, iadeMiktar: 1800, iadeSevk: 549190, sevkSatir: 499, maliyet: 34328, ciro: 24870275 }),
  S(7, 'vileda', { qi: 9, sevkSatir: 21, maliyet: 58, ciro: 3077146 }),
  // Başka lokasyon karışmamalı
  { ...S(1, 'diger', { qi: 99, ciro: 1 }), yer: 'CERKEZKOY' },
];

const tum = aylikKalite(rows, 'Veliköy', 2026, 'tum');
assert.strictEqual(tum[1].kalite_qi, 39);                       // FR100 Ocak = 39
assert.strictEqual(tum[1].kalite_maliyet, 123340);
// Havuzlama: Σhatalı/Σkontrol, iki PPM'in ortalaması DEĞİL
assert.strictEqual(tum[1].kalite_ic_ppm, Math.round((39102 + 12652) / (320031 + 234620) * 1e6));
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

// İade var ama aynı birimde sevk yok → oran uydurulmaz
const iadeSevksiz = aylikKalite([S(3, 'diger', { iadeMiktar: 10, sevkSatir: 5 })], 'Veliköy', 2026);
assert.strictEqual(iadeSevksiz[3].kalite_iade_ppm, null);

// Kaynak tahmini: müşteri iade PPM'i artık tedarikçi değil
const k = (proses, kpi_adi) => kaynakTahmini({ proses, kpi_adi });
assert.deepStrictEqual(k('Kalite', 'Toplam İade PPM Total Return PPM'), { type: 'kalite', metric: 'kalite_iade_ppm' });
assert.deepStrictEqual(k('Paketleme Prosesi', 'Dış İade PPM External Returns PPM'), { type: 'kalite', metric: 'kalite_iade_ppm' });
assert.deepStrictEqual(k('Kalite', 'İç PPM internal PPM'), { type: 'kalite', metric: 'kalite_ic_ppm' });
assert.deepStrictEqual(k('Kalite', 'Kalite Uygunsuzlukları Adedi (QI)'), { type: 'kalite', metric: 'kalite_qi' });
assert.deepStrictEqual(k('Kalite', 'Müşteri Şikayetleri Miktarı'), { type: 'kalite', metric: 'kalite_sikayet' });
assert.deepStrictEqual(k('Kalite', 'Kalite Maliyetlerinin Aylık Bütçeye Oranı'), { type: 'kalite', metric: 'kalite_oran' });
// Tedarikçi KPI'ları yerinde kalmalı
assert.deepStrictEqual(k('Satınalma', 'Tedarikçi Değerlendirme (iade ppm göre)'), { type: 'tedarikci', metric: 'td_ppmpuan' });
assert.strictEqual(k('Yönetim', 'Ebidta'), null);

console.log('test_kalite_kpi: tamam');
