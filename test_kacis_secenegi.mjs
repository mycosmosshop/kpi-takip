// Saptanamama (kaçış) analizi isteğe bağlı olmalı.
// Kırılan hâl: her 8D'de üretiliyordu; yarısı yer tutucuyla dolu bir
// sütun ekranda, aynısı raporda duruyordu. Karar TEK yerde olmalı:
// 5N ekranındaki tik.
//   çalıştır:  node test_kacis_secenegi.mjs
import assert from 'assert';
import fs from 'fs';

const f = fs.readFileSync('components/FiveWhyModal.tsx', 'utf8');
const d = fs.readFileSync('components/DofModal.tsx', 'utf8');

// 5N ekranında tik var
assert.ok(/const \[kacisDahil, setKacisDahil\] = useState\(false\)/.test(f),
  '5N ekranında kacisDahil durumu');
assert.ok(/setKacisDahil\(e\.target\.checked\)/.test(f), 'tik kutusu');
assert.ok(f.includes('{kacisDahil && ('), 'sütun tike bağlı');
// Tik kapaliysa KAYITTA da bosalmali; yoksa eski metin raporda kalir
assert.ok(/nonDetection: !kacisDahil \? \[\]/.test(f), 'kapalıyken zincir boşalır');
assert.ok(/nonDetectionRootCause: !kacisDahil \? ''/.test(f), 'kapalıyken kök neden boşalır');
// Acilista mevcut kayda gore isaretlenir
assert.ok(/setKacisDahil\(validNonDetection\.some/.test(f), 'açılışta kayda göre');

// DÖF modalinde İKİNCİ bir tik olmamalı; taslak kayda bakar
assert.ok(!/setKacisDahil/.test(d), 'DÖF modalinde ikinci tik kalmamalı');
assert.ok(/const kacisDahil = \(dof\.kokNedenAnalizi\?\.nonDetection \|\| \[\]\)/.test(d),
  'taslak kararı kayıttan türetmeli');
assert.ok(/dofTaslagi\(kpi, ay, year, kardesKpiler, kacisDahil\)/.test(d),
  'üreticiye aktarılmalı');

console.log('OK kaçış analizi tek tike bağlı; kapalıyken kayıt da boşalıyor');
