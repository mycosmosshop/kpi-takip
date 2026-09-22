// 8D/DÖF simgesi hangi ay hücresinde görünüyor?
// Kırılan hâl: eşleşme "ayın 2'si" sihirli gününe bağlıydı. 8D Temmuz'da
// açılıp (2026-07-02) başlangıç tarihi Haziran'a çekilince (2026-06-05)
// gün 02 olmadığı için simge hiçbir aya düşmedi, DÖF sessizce "genel" oldu.
//   çalıştır:  node test_dof_ay.mjs
import assert from 'assert';
import { buildSync } from 'esbuild';

const c = buildSync({ entryPoints: ['constants.ts'], bundle: true, write: false,
  format: 'esm', platform: 'neutral', target: 'es2020' }).outputFiles[0].text;
const { dofAyi, acikDofAyda, scatterVerisiVar, ORNEK_SCATTER } = await import('data:text/javascript;base64,' + Buffer.from(c).toString('base64'));

// Hücreden açılan DÖF (eski biçim) çalışmaya devam etmeli
assert.strictEqual(dofAyi('2026-07-02', 2026), 'Temmuz');
// Kullanıcının elle seçtiği gün de aynı aya düşmeli — kırılan durum
assert.strictEqual(dofAyi('2026-06-05', 2026), 'Haziran');
assert.strictEqual(dofAyi('2026-06-01', 2026), 'Haziran');
assert.strictEqual(dofAyi('2026-06-30', 2026), 'Haziran');
// Sınırlar
assert.strictEqual(dofAyi('2026-01-15', 2026), 'Ocak');
assert.strictEqual(dofAyi('2026-12-31', 2026), 'Aralık');
// Başka yıl / tarihsiz → genel DÖF (ortalama sütunundaki rozet)
assert.strictEqual(dofAyi('2025-06-02', 2026), null);
assert.strictEqual(dofAyi('', 2026), null);
assert.strictEqual(dofAyi(null, 2026), null);
assert.strictEqual(dofAyi('2026-13-01', 2026), null);
// Yıl string gelse de çalışmalı (kayıtlarda öyle olabiliyor)
assert.strictEqual(dofAyi('2026-06-05', '2026'), 'Haziran');

// ── Panelden "8D başlat": o ayda açık DÖF varsa yenisi açılmamalı ──
const dofler = [
  { id: 'a', durum: 'Açık', start_date: '2026-06-30', problemTanimi: 'MTBF düşük' },
  { id: 'b', durum: 'Tamamlandı', start_date: '2026-07-02' },
];
assert.strictEqual(acikDofAyda(dofler, 'Haziran', 2026).id, 'a', 'açık DÖF bulunmalı');
// Kapanmis DOF yeni acilmayi engellemez
assert.strictEqual(acikDofAyda(dofler, 'Temmuz', 2026), undefined, 'tamamlanan DÖF sayılmaz');
assert.strictEqual(acikDofAyda(dofler, 'Mayıs', 2026), undefined, 'boş ay');
assert.strictEqual(acikDofAyda(dofler, '', 2026), undefined, 'ay verilmedi');
assert.strictEqual(acikDofAyda([], 'Haziran', 2026), undefined, 'hiç DÖF yok');

// ── Dagilim grafigi: ornek veri "girilmis veri" sayilmaz ──
assert.strictEqual(scatterVerisiVar({ inputData: '' }), false, 'boş scatter');
assert.strictEqual(scatterVerisiVar(undefined), false, 'scatter yok');
assert.strictEqual(scatterVerisiVar({ inputData: ORNEK_SCATTER }), false,
  'örnek veri rapora grafik bastırmamalı');
const kendiVeri = ['Sicaklik,MTBF', '60,520', '72,410'].join(String.fromCharCode(10));
assert.strictEqual(scatterVerisiVar({ inputData: kendiVeri }), true,
  'kullanıcının kendi verisi');

console.log('OK 8D simgesi başlangıç tarihinin ayına düşüyor; aynı ayda açık DÖF varsa ikincisi açılmıyor');
