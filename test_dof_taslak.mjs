// KPI verisinden üretilen 8D taslağı doğru sayıları taşıyor mu?
//
// Taslak metni ekibe kök neden önerir; içindeki sayı yanlışsa 8D'nin D2'si
// yanlış gerekçeyle kapanır. Bu yüzden üretilen metin GERÇEK aylık veriyle
// karşılaştırılır — hedef yönü (>= / <=) dahil.
//   çalıştır:  node test_dof_taslak.mjs
import assert from 'assert';
import { buildSync } from 'esbuild';

const c = buildSync({ entryPoints: ['utils/dofTaslak.ts'], bundle: true, write: false,
  format: 'esm', platform: 'neutral', target: 'es2020' }).outputFiles[0].text;
const { dofTaslagi } = await import('data:text/javascript;base64,' + Buffer.from(c).toString('base64'));

// Ankara 2026 — Bakım Prosesi (KPI Takip'teki gerçek değerler)
const mtbf = {
  id: 'k1', proses: 'Bakım Prosesi', kpi_adi: 'Arızalar Arasındaki Ortalama Süre (MTBF)',
  yeni_yil_hedef: 500, karsilastirma: '>=', birim: 'saat',
  gozdenGecirmePeriyodu: 'Aylık', kaynak: { type: 'cmms', metric: 'mtbf', location: 'Ankara' },
  aylik: { Ocak: 589, 'Şubat': 799, Mart: 614, Nisan: 570, 'Mayıs': 589,
           Haziran: 284, Temmuz: 884, 'Ağustos': 589 },
};
const mttr = {
  id: 'k2', proses: 'Bakım Prosesi', kpi_adi: 'Arıza Duruşları (MTTR)',
  yeni_yil_hedef: 2, karsilastirma: '<=', birim: 'saat',
  aylik: { Haziran: 1.4 },
};

const t = dofTaslagi(mtbf, 'Haziran', 2026, [mtbf, mttr]);
assert.ok(t, 'taslak üretilmeli');

// ── D2: gerçek sayılar ──
assert.ok(t.problemTanimi.includes('284'), 'ölçülen değer');
assert.ok(t.problemTanimi.includes('500'), 'hedef');
assert.ok(t.problemTanimi.includes('Haziran 2026'), 'dönem');
assert.ok(t.problemTanimi.includes('Ankara'), 'lokasyon');
// Haziran hedefin %56,8'i; sapma %43,2
assert.ok(t.problemTanimi.includes('43,2'), 'sapma yüzdesi: ' + t.problemTanimi.slice(0, 200));
assert.ok(t.problemTanimi.includes('≥ 500'), 'yön işareti ≥ olmalı');
assert.ok(!/'[iısu]dir|'i kadar/.test(t.problemTanimi), 'sayıya ek getiren kalıp kalmamalı');
assert.ok(t.problemTanimi.includes('56,8'), 'gerçekleşme yüzdesi');
// Haziran dışı 7 ayın ortalaması (589+799+614+570+589+884+589)/7 = 662
const beklenenOrt = Math.round((589 + 799 + 614 + 570 + 589 + 884 + 589) / 7);
assert.strictEqual(Math.round(t.ozet.digerOrt), beklenenOrt, 'öteki ayların ortalaması');
assert.ok(t.problemTanimi.includes(String(beklenenOrt)), 'ortalama metinde');
// Hedef dışına çıkan TEK ay Haziran
assert.deepStrictEqual(t.ozet.altAylar, ['Haziran'], 'hedef dışı aylar');
assert.ok(t.problemTanimi.includes('tek ayıdır'), 'tek ay ifadesi');

// ── Aynı prosesteki öteki KPI bağlamı: MTTR hedefi TUTUYOR (1,4 <= 2) ──
assert.ok(t.problemTanimi.includes('MTTR'), 'kardeş KPI bağlamı');
const mttrSatir = t.problemTanimi.split('\n').find(s => s.includes('MTTR'));
assert.ok(mttrSatir.includes('hedef içinde'), '<= yönü doğru değerlendirilmeli: ' + mttrSatir);
// KPI'ın kendisi bağlam listesine girmemeli
assert.strictEqual(t.problemTanimi.split('Arızalar Arasındaki').length - 1, 2,
  'KPI kendi bağlam satırını yazmamalı (biri başlık, biri 5 neden sorusu)');

// ── D4: ilk halka veriyle dolu, gerisi ekibe bırakılmış ──
assert.ok(t.occurrence[0].because.includes(String(beklenenOrt)), 'oluşum ilk halkası veriye dayanmalı');
assert.ok(t.occurrence[1].because.includes('['), 'sonraki halkalar boş bırakılmalı');
assert.ok(t.nonDetection[0].because.includes('Aylık') || t.nonDetection[0].because.includes('aylık'),
  'kaçış halkası gözden geçirme periyodunu yazmalı');

// ── D6: sapmadan sonraki aylar ──
assert.ok(t.uygulamaDogrulama.includes('Temmuz 884'), 'sonraki ay ölçümü');
assert.ok(t.uygulamaDogrulama.includes('Ağustos 589'), 'sonraki ay ölçümü');
assert.ok(t.uygulamaDogrulama.includes('2 tanesi hedefi tutmaktadır'), 'tutan ay sayısı');

// ── '<=' yönlü KPI (ör. PPM): büyük değer KÖTÜ ──
const ppm = {
  id: 'k3', proses: 'Kalite', kpi_adi: 'İç PPM', yeni_yil_hedef: 1000,
  karsilastirma: '<=', birim: 'ppm',
  aylik: { Ocak: 800, Haziran: 2500, Temmuz: 900 },
};
const p = dofTaslagi(ppm, 'Haziran', 2026);
assert.deepStrictEqual(p.ozet.altAylar, ['Haziran'], '<= yönünde hedef dışı ay');
assert.ok(p.problemTanimi.includes('2500') && p.problemTanimi.includes('1000'), 'ppm sayıları');

// ── Ölçüm ya da hedef yoksa taslak üretilmez (uydurma yapılmaz) ──
assert.strictEqual(dofTaslagi(mtbf, 'Aralık', 2026), null, 'ölçümü olmayan ay');
assert.strictEqual(dofTaslagi({ ...mtbf, yeni_yil_hedef: null }, 'Haziran', 2026), null, 'hedefsiz KPI');

console.log('OK 8D taslağı KPI verisiyle birebir: sapma, ortalama, hedef dışı aylar, kardeş KPI yönü, D6 izleme');
