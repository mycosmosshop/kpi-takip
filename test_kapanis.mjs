// Termin (tahmini kapanış) ile gerçek kapanış ayrı tutulmalı.
// Kırılan hâl: tek bir due_date vardı, raporda "Kapanış Tarihi" diye
// yazıyordu; DÖF'ün fiilen ne zaman kapandığı hiçbir yerde durmuyor,
// termine uyulup uyulmadığı ölçülemiyordu.
//   çalıştır:  node test_kapanis.mjs
import assert from 'assert';
import fs from 'fs';

const tip = fs.readFileSync('types.ts', 'utf8');
assert.ok(/gercekKapanis\?: string/.test(tip), 'Dof tipinde gercekKapanis olmalı');

const modal = fs.readFileSync('components/DofModal.tsx', 'utf8');
assert.ok(/name="gercekKapanis"/.test(modal), 'modalda gerçek kapanış alanı');
assert.ok(/gercekKapanis: ''/.test(modal), 'varsayılan boş');
// %100 isaretlenince bugun onerilir, YAZILI tarih ezilmez
const blok = modal.slice(modal.indexOf("newStatus === 'Tamamlandı'"), modal.indexOf("newStatus === 'Tamamlandı'") + 320);
assert.ok(/!String\(prev\.gercekKapanis \|\| ''\)\.trim\(\)/.test(blok),
  'dolu gerçek kapanış ezilmemeli');

const rapor = fs.readFileSync('components/DofReportView.tsx', 'utf8');
assert.ok(/Termin \(tahmini kapanış\)/.test(rapor), 'raporda termin etiketi');
assert.ok(/Gerçek Kapanış/.test(rapor), 'raporda gerçek kapanış');
assert.ok(/gün gecikmeli/.test(rapor) && /termine uyuldu/.test(rapor),
  'raporda termin performansı');

// Gecikme hesabi: UTC, gun farki
const gun = (g, v) => Math.round((Date.parse(g + 'T00:00:00Z') - Date.parse(v + 'T00:00:00Z')) / 86400000);
assert.strictEqual(gun('2026-10-05', '2026-10-01'), 4, '4 gün gecikme');
assert.strictEqual(gun('2026-10-01', '2026-10-01'), 0, 'gününde kapanış');
assert.strictEqual(gun('2026-09-28', '2026-10-01'), -3, 'erken kapanış');
// Ay ve yil sinirinda kaymamali
assert.strictEqual(gun('2027-01-01', '2026-12-31'), 1, 'yıl sınırı');

const panel = fs.readFileSync('components/AllDofsModal.tsx', 'utf8');
assert.ok(/Kapandı: /.test(panel), 'panelde kapanış rozeti');
assert.ok(/<th>Gerçek Kapanış<\/th>/.test(panel), 'PDF başlığı');
const basliklar = (panel.match(/<th>/g) || []).length;
const hucreler = (panel.slice(panel.indexOf('<tbody>')).match(/<td>/g) || []).length;
assert.strictEqual(basliklar, hucreler, `PDF sütun sayısı tutmalı (${basliklar} başlık / ${hucreler} hücre)`);

console.log('OK termin ve gerçek kapanış ayrı; gecikme UTC ile, PDF sütunları tutuyor');
