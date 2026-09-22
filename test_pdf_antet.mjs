// PDF: antet her sayfada, sayfa kırılımı başlığı ortadan bölmemeli.
//   çalıştır:  node test_pdf_antet.mjs
import assert from 'assert';
import fs from 'fs';

const r = fs.readFileSync('components/DofReportView.tsx', 'utf8');
const h = fs.readFileSync('index.html', 'utf8');
const m = fs.readFileSync('components/DofModal.tsx', 'utf8');
const c = fs.readFileSync('constants.ts', 'utf8');
const pdf = r.slice(r.indexOf('const handleGeneratePdf'), r.indexOf('const getDofText'));

// Antet her sayfaya basılır
assert.ok(r.includes('data-antet'), 'antet işaretli');
assert.ok(/getNumberOfPages\(\)/.test(pdf), 'sayfa sayısı okunmalı');
assert.ok(/pdf\.addImage\(antetImg/.test(pdf), 'her sayfaya antet resmi');
assert.ok(/antetEl\.style\.display = 'none'/.test(pdf), 'antet akıştan çıkarılmalı');
assert.ok(/if \(antetEl\) antetEl\.style\.display = ''/.test(pdf), 'sonra geri gelmeli');
// Üst marj antet kadar açılmalı, yoksa içerik antetin altına girer
assert.ok(/margin: antetImg \? \[KENAR \+ antetYukseklik \+ 4/.test(pdf), 'üst marj antet kadar');
// jsPDF metin çizimi KULLANILMAMALI (WinAnsi: ş/ğ/ı bozuk)
assert.ok(!/pdf\.text\(/.test(pdf), 'jsPDF metin çizimi kullanılmamalı');
// html2canvas yoksa PDF yine alınabilmeli
assert.ok(/catch \{ antetImg = null; \}/.test(pdf), 'antet çizilemezse PDF yine alınır');

// Sayfa kırılımı
assert.ok(/pagebreak: \{ mode: \['css', 'legacy'\], avoid: \['\.no-break', 'tr', 'img'\] \}/.test(pdf),
  'pagebreak ayarı');
// .no-break @media print DIŞINDA da tanımlı olmalı (html2pdf ekran render'ı)
// Yorum metninde de "@media print" geçiyor; blok açılışı aranır.
const printBasla = h.indexOf('@media print {');
const kuralYeri = h.indexOf('.no-break { break-inside: avoid;');
assert.ok(kuralYeri > -1 && kuralYeri < printBasla, '.no-break kuralı @media print dışında');

// DÖF No elle girilebilir, boşsa türetilir
assert.ok(/name="dofNo"/.test(m), 'modalda DÖF No alanı');
assert.ok(/export function dofNoOner/.test(c), 'numara türetici');
assert.ok(/String\(dof\.dofNo \|\| ''\)\.trim\(\) \|\| dofNoOner\(dof\)/.test(r), 'önce kayıttaki numara');

// Antette basım tarihi ve unvan YOK, gövdede DÖF ID yok
assert.ok(!/<strong>Basım:<\/strong>/.test(r), 'basım tarihi kaldırıldı');
assert.ok(!/\{marka\.unvan\}/.test(r), 'antette unvan kaldırıldı');
assert.ok(!/<strong>DÖF ID:<\/strong>/.test(r), 'gövdede DÖF ID kaldırıldı');

// D5'te bağlı kök nedende çalışma notu basılmaz (eski kayıtlar için de)
const d5 = r.slice(r.indexOf('action.linkedRootCauses.map'),
                   r.indexOf('action.linkedRootCauses.map') + 400);
assert.ok(d5.includes('.replace(') && d5.includes('trim()'),
  'D5 kök nedeninde köşeli parantezli not kırpılmalı');

console.log('OK antet her sayfada, sayfa kırılımı korumalı, DÖF No elle girilebilir');
