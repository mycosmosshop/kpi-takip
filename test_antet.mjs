// 8D raporunun üst anteti: logo, firma unvanı, DÖF no ve tarihler.
// Kırılan hâl: rapor yalnız ortada bir başlıkla açılıyordu; PDF'e
// basılınca hangi firmanın hangi tarihli 8D'si olduğu belli olmuyordu.
//   çalıştır:  node test_antet.mjs
import assert from 'assert';
import fs from 'fs';

const r = fs.readFileSync('components/DofReportView.tsx', 'utf8');
const sabit = fs.readFileSync('constants.ts', 'utf8');

assert.ok(/<img src=\{marka\.logo\}/.test(r), 'antette logo');
// Logo yuklenemezse rapor bozulmamali
assert.ok(/onError=\{e => \{ \(e\.currentTarget as HTMLImageElement\)\.style\.display = 'none'/.test(r),
  'logo yüklenemezse gizlenmeli');
assert.ok(/\{marka\.unvan\}/.test(r), 'antette firma unvanı');
assert.ok(/DÖF No:/.test(r) && /Başlangıç:/.test(r) && /Basım:/.test(r), 'antette doküman bilgileri');
assert.ok(/8D PROBLEM ÇÖZME RAPORU/.test(r), 'başlık');
// Marka lokasyondan gelir, yoksa Sanifoam
assert.ok(/BRANDS\[company \|\| 'sanifoam'\] \|\| BRANDS\.sanifoam/.test(r), 'marka seçimi');

// Logo dosyalari gercekten public/ icinde mi?
const logolar = [...sabit.matchAll(/logo: '([^']+)'/g)].map(m => m[1]);
assert.ok(logolar.length >= 2, 'marka logoları tanımlı');
for (const l of logolar)
  assert.ok(fs.existsSync('public/' + l), `public/${l} bulunmalı`);

// DÖF numarası ham uuid olmamalı
const blok = r.slice(r.indexOf('const dofNo'), r.indexOf('const relevantMonthData'));
assert.ok(/DÖF-\$\{y\}-\$\{rakam\.slice\(-5\)\}/.test(blok), 'okunur DÖF numarası');

console.log('OK antet: logo (hatada gizlenir), unvan, DÖF no ve tarihler; logo dosyaları yerinde');
