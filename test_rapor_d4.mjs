// D4 raporu: 5 Neden ZİNCİRİ görünmeli, kullanılmayan araç basılmamalı.
// Kırılan hâl: rapor yalnız "Kök Neden" satırını yazıyordu (zincir yok) ve
// FTA/Pareto/Scatter/Balık kılçığı kullanılmasa bile "… oluşturulmamış."
// yazısıyla sayfada yer kaplıyordu.
//   çalıştır:  node test_rapor_d4.mjs
import assert from 'assert';
import fs from 'fs';

const r = fs.readFileSync('components/DofReportView.tsx', 'utf8');

// 5 Neden zinciri
assert.ok(/const BesNedenBolumu/.test(r), '5 Neden bölüm bileşeni olmalı');
assert.ok(/dolu\.map\(x => \(/.test(r), 'zincir halkaları listelenmeli');
assert.ok(/<strong>Problem: <\/strong>/.test(r), 'problem cümlesi basılmalı');
assert.ok(/<strong>Kök Neden: <\/strong>/.test(r), 'kök neden basılmalı');
// Zincir de kök neden de boşsa bölüm hiç çıkmamalı
assert.ok(/if \(!dolu\.length && !String\(kokNeden \|\| ''\)\.trim\(\)\) return null/.test(r),
  'boş 5N bölümü gizlenmeli');

// Kullanılmayan araçlar
for (const bayrak of ['ftaKullanildi', 'paretoKullanildi', 'balikKullanildi'])
  assert.ok(r.includes('{' + bayrak + ' && ('), `${bayrak} ile koşullu render`);
assert.ok(r.includes('{scatterVerisiVar(dof.kokNedenAnalizi?.scatter) && ('),
  'scatter koşullu render');
// "oluşturulmamış" yazıları raporda kalmamalı
assert.ok(!/Dağılım grafiği analizi oluşturulmamış/.test(r), 'scatter boş yazısı kaldırılmalı');

// FTA yalnız şablon başlığıyla kullanılmış sayılmamalı
const ftaBlok = r.slice(r.indexOf('const ftaKullanildi'), r.indexOf('const paretoKullanildi'));
assert.ok(/children \|\| \[\]\)\.length > 0/.test(ftaBlok), 'FTA için düğüm şartı');
assert.ok(!/topEvent\.text/.test(ftaBlok), 'şablon başlığı kullanım sayılmamalı');

console.log('OK D4 raporunda 5 Neden zinciri var; kullanılmayan araçlar basılmıyor');
