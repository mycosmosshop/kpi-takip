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

// ── D4: bileşenin beklediği yapı ──
// occurrence[0].why = PROBLEM CÜMLESİ, her kaydın because'ı o halkanın
// cevabı, sonraki why = önceki cevap. Yer tutucu why ekranda görünüyordu.
assert.ok(t.occurrence[0].why.includes('284') && t.occurrence[0].why.includes('500'),
  'problem cümlesi ölçüm ve hedefi taşımalı');
assert.ok(!/\[bir önceki/i.test(t.occurrence.map(x => x.why).join(' ')),
  'why alanlarında yer tutucu kalmamalı');
for (let i = 1; i < t.occurrence.length; i++)
  assert.strictEqual(t.occurrence[i].why, t.occurrence[i - 1].because,
    `halka ${i + 1} sorusu bir önceki cevap olmalı`);
// İlk halka gerçek bir nedensellik adımı: arıza sayısı katsayısı
assert.ok(/arıza sayısı arttı/.test(t.occurrence[0].because), 'ilk halka olgu tekrarı olmamalı');
assert.ok(t.occurrence[0].because.includes(String(beklenenOrt)), 'ilk halka veriye dayanmalı');
assert.ok(t.occurrence[1].because.includes('plansız'), 'ikinci halka konuya özgü');
// Zincir sistemsel nedene inmeli, ucuncu halkada kesilmemeli
assert.ok(t.occurrence.length >= 4, 'zincir en az 4 halka');
assert.ok(/yedek parça/i.test(t.occurrence.map(x => x.because).join(' ')), 'zincir yedek parçaya iniyor');
assert.ok(/periyot ve sorumlu/i.test(t.occurrenceRootCause), 'kök neden sistemsel');
assert.ok(t.occurrenceRootCause.includes('['), 'kök neden doğrulanmadan kesin yazılmamalı');
assert.ok(t.nonDetectionRootCause.length > 30, 'kaçış kök nedeni dolu');
// Kalite KPI'sinda yedek parca zinciri GELMEMELI
const kaliteT = dofTaslagi({ id: 'k8', proses: 'Muayene', kpi_adi: 'İç PPM Oranı',
  yeni_yil_hedef: 1000, karsilastirma: '<=', birim: 'ppm', aylik: { Haziran: 9375 } }, 'Haziran', 2026);
assert.ok(!/yedek parça/i.test(kaliteT.occurrence.map(x => x.because).join(' ')),
  'kalite KPI bakım zincirini almamalı');
assert.ok(t.occurrence.some(x => x.because.includes('[')), 'doğrulanmamış halkalar işaretli');
assert.ok(t.nonDetection[0].why.includes('fark edilmedi'), 'kaçış problem cümlesi');
assert.ok(t.nonDetection[0].because.includes('aylık'), 'kaçış halkası periyodu yazmalı');

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

// ── D3 / D5 / D7 / D8: konuya göre öneri, "yapıldı" gibi görünmemeli ──
assert.ok(t.geciciOnlemler.includes('Öneri'), 'D3 öneri olarak işaretli');
assert.ok(/ariza|arıza|bakım|duruş/i.test(t.geciciOnlemler), 'D3 bakım konusuna uygun');
assert.ok(t.kaliciAksiyonlar.length >= 3, 'D5 aksiyon listesi');
assert.ok(t.kaliciAksiyonlar.every(a => a.action && a.status === 'Açık'), 'D5 satır biçimi');
assert.ok(t.kaliciAksiyonlar.every(a => a.dueDate === ''), 'D5 termin uydurulmamalı');
assert.ok(/yedek parça|bakım/i.test(t.tekrarinOnlenmesi), 'D7 bakım konusu');
assert.ok(t.takdir.includes('≥ 500'), 'D8 kapanış ölçütü');

// Konu KPI'a göre değişmeli: PPM'de kalite önerileri gelmeli
const ppmT = dofTaslagi({ id: 'k9', proses: 'Muayene', kpi_adi: 'İç PPM Oranı',
  yeni_yil_hedef: 1000, karsilastirma: '<=', birim: 'ppm',
  aylik: { Haziran: 9375 } }, 'Haziran', 2026);
assert.ok(/ayıklama|karantina/i.test(ppmT.geciciOnlemler), 'PPM için kalite önlemleri: ' + ppmT.geciciOnlemler.slice(0, 120));
assert.ok(/PFMEA|Kontrol planı/i.test(ppmT.kaliciAksiyonlar.map(a => a.action).join(' ')), 'PPM kalıcı aksiyonları');

// ── Ölçüm ya da hedef yoksa taslak üretilmez (uydurma yapılmaz) ──
assert.strictEqual(dofTaslagi(mtbf, 'Aralık', 2026), null, 'ölçümü olmayan ay');
assert.strictEqual(dofTaslagi({ ...mtbf, yeni_yil_hedef: null }, 'Haziran', 2026), null, 'hedefsiz KPI');

console.log('OK 8D taslağı KPI verisiyle birebir: sapma, ortalama, hedef dışı aylar, kardeş KPI yönü, D6 izleme');
