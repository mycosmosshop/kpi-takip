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
// Unvan ve basim tarihi ANTETTEN CIKARILDI: unvan logonun altinda
// zaten yaziyor, basim tarihi kalite dokumaninda bir sey ifade etmiyor.
assert.ok(/DÖF No:/.test(r) && /Başlangıç:/.test(r), 'antette doküman bilgileri');
assert.ok(/8D PROBLEM ÇÖZME RAPORU/.test(r), 'başlık');
// Marka lokasyondan gelir, yoksa Sanifoam
assert.ok(/BRANDS\[company \|\| 'sanifoam'\] \|\| BRANDS\.sanifoam/.test(r), 'marka seçimi');

// Logo dosyalari gercekten public/ icinde mi?
const logolar = [...sabit.matchAll(/logo: '([^']+)'/g)].map(m => m[1]);
assert.ok(logolar.length >= 2, 'marka logoları tanımlı');
for (const l of logolar)
  assert.ok(fs.existsSync('public/' + l), `public/${l} bulunmalı`);

// DÖF numarası ham uuid olmamalı (üretici constants.ts'e taşındı)
const blok = sabit.slice(sabit.indexOf('export function dofNoOner'),
                         sabit.indexOf('export function dofNoOner') + 500);
assert.ok(blok.includes('DÖF-'), 'okunur DÖF numarası');
assert.ok(blok.includes('rakam.slice(-5)'), 'numara iç kimlikten türetilir');

// PDF alinmadan once gorseller beklenmeli; yoksa logo bos gecer
const pdfBlok = r.slice(r.indexOf('const handleGeneratePdf'), r.indexOf('const getDofText'));
assert.ok(/querySelectorAll\('img'\)/.test(pdfBlok), 'PDF öncesi görseller toplanmalı');
assert.ok(/g\.complete \? Promise\.resolve\(\)/.test(pdfBlok), 'yüklenmiş görsel beklenmemeli');
assert.ok(/setTimeout\(bitir, 3000\)/.test(pdfBlok), 'yüklenemeyen görsel basımı bekletmemeli');
assert.ok(/addEventListener\('error'/.test(pdfBlok), 'hata da beklemeyi bitirmeli');
assert.ok(/if \(!element \|\| pdfMesgul\) return/.test(pdfBlok), 'çift basım engellenmeli');

console.log('OK antet: logo (hatada gizlenir), DÖF no ve başlangıç; logo dosyaları yerinde');
