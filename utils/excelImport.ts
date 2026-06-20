import { Kpi, KpiData, Comparison, ReviewPeriod } from '../types';
import { AYLAR } from '../constants';

/**
 * FR100 "KPI" Excel şablonunu (Kalite Yönetim Sistemi performans tablosu) okuyup
 * uygulamanın KpiData yapısına dönüştürür.
 *
 * Şablon yapısı:
 *   - Süreç başlığı satırı: A sütununda "N)" sıra no, B'de süreç adı, C'de süreç sahibi.
 *   - KPI satırı: B=KPI adı, D=ölçüm periyodu, E=birim, F=geçen yıl gerçekleşen,
 *     G=HEDEF (1 YIL) [hedef olarak bu baz alınır], H=HEDEF (3 YIL), I..T=aylık (Ocak..Aralık).
 *   - Sembol satırı (KPI satırının hemen altı): F/G hücresinde ≥ / ≤ ile karşılaştırma yönü.
 *
 * window.XLSX (SheetJS) ile okunmuş workbook nesnesi alır.
 */

const firstLine = (v: any): string => String(v ?? '').split('\n')[0].trim();
const restLines = (v: any): string => {
    const parts = String(v ?? '').split('\n');
    return parts.length > 1 ? parts.slice(1).join(' ').trim() : '';
};

const parseNum = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).trim();
    if (s === '' || s === '-' || s === '—') return null;
    const up = s.toUpperCase();
    if (up.includes('DIV') || up === 'J' || up === 'L' || up.includes('N/A') || up.includes('#')) return null;
    s = s.replace('%', '').replace(/\s/g, '');
    if (s.indexOf(',') > -1 && s.indexOf('.') < 0) s = s.replace(',', '.'); // Türkçe ondalık
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
};

const symbolOf = (v: any): Comparison | null => {
    const s = String(v ?? '');
    if (s.includes('≥') || s.includes('>=')) return '>=';
    if (s.includes('≤') || s.includes('<=')) return '<=';
    const t = s.trim();
    if (t === '>') return '>';
    if (t === '<') return '<';
    if (t === '=') return '=';
    return null;
};

const mapPeriod = (v: any): ReviewPeriod => {
    const s = String(v ?? '').toUpperCase().replace(/\s/g, '');
    if (s.includes('2AY')) return '2aylik';
    if (s.includes('3AY')) return '3aylik';
    if (s.includes('4AY')) return '4aylik';
    if (s.includes('6AY')) return '6aylik';
    if (s.includes('1AY')) return 'aylik';
    if (s.includes('YIL') || s.includes('YİL')) return 'yillik';
    return 'aylik';
};

const extractOwner = (v: any): string => {
    const s = String(v ?? '');
    const m = s.match(/\(([^)]+)\)/);
    if (m) return m[1].trim();
    return firstLine(s);
};

// "lower is better" KPI'ları için karşılaştırma varsayılanı (sembol satırı yoksa yedek).
const guessComparison = (name: string, unit: string): Comparison => {
    const t = `${name} ${unit}`.toLowerCase();
    const lowerIsBetter = ['ppm', 'adet', 'şikayet', 'sikayet', 'maliyet', 'hata', 'arıza', 'ariza',
        'duruş', 'durus', 'mttr', 'iade', 'mesai', 'kaza', 'uygunsuzluk', 'navlun', 'başarısızlık', 'basarisizlik'];
    return lowerIsBetter.some(k => t.includes(k)) ? '<' : '>';
};

const monthFromHeader = (v: any): string | null => {
    const t = String(v ?? '').trim().toUpperCase();
    if (!t) return null;
    if (t.startsWith('OCA')) return 'Ocak';
    if (t.startsWith('ŞUB') || t.startsWith('SUB')) return 'Şubat';
    if (t.startsWith('MAR')) return 'Mart';
    if (t.startsWith('NİS') || t.startsWith('NIS')) return 'Nisan';
    if (t.startsWith('MAY')) return 'Mayıs';
    if (t.startsWith('HAZ')) return 'Haziran';
    if (t.startsWith('TEM')) return 'Temmuz';
    if (t.startsWith('AĞU') || t.startsWith('AGU')) return 'Ağustos';
    if (t.startsWith('EYL')) return 'Eylül';
    if (t.startsWith('EKİ') || t.startsWith('EKI')) return 'Ekim';
    if (t.startsWith('KAS')) return 'Kasım';
    if (t.startsWith('ARA')) return 'Aralık';
    return null;
};

const includesUp = (cell: any, ...needles: string[]): boolean => {
    const t = String(cell ?? '').toUpperCase();
    return needles.some(n => t.includes(n));
};

interface ColMap {
    sira: number; name: number; owner: number; period: number;
    unit: number; prev: number; target: number; target3: number;
    months: { [month: string]: number };
}

const detectColumns = (rows: any[][], headerRow: number): ColMap => {
    const h = rows[headerRow] || [];
    const find = (pred: (cell: any) => boolean, fallback: number) => {
        const idx = h.findIndex(pred);
        return idx >= 0 ? idx : fallback;
    };
    const target = find(c => includesUp(c, 'HEDEF') && /1/.test(String(c)), 6);
    const target3 = find(c => includesUp(c, 'HEDEF') && /3/.test(String(c)), 7);
    const name = find(c => includesUp(c, 'PERFORMANS'), 1);
    const owner = find(c => includesUp(c, 'SAH'), 2); // Süreç Sahibi
    const period = find(c => includesUp(c, 'PERİYO', 'PERIYO'), 3); // Ölçüm Periyodu
    const unit = find(c => includesUp(c, 'BİRİM', 'BIRIM'), 4);
    const sira = find(c => includesUp(c, 'SIRA'), 0);
    // "GERÇEKLEŞEN (geçen yıl)" — hedeften önceki gerçekleşen sütunu
    let prev = 5;
    for (let i = 0; i < target; i++) {
        if (includesUp(h[i], 'GERÇEKLE', 'GERCEKLE')) prev = i;
    }

    // Ay sütunları: başlık satırı ve hemen altındaki satırı tara.
    const months: { [m: string]: number } = {};
    for (const r of [headerRow, headerRow + 1]) {
        const row = rows[r] || [];
        row.forEach((cell, idx) => {
            const m = monthFromHeader(cell);
            if (m && months[m] === undefined) months[m] = idx;
        });
    }
    // Hiç ay bulunamazsa sabit yerleşime düş (I..T = 8..19)
    if (Object.keys(months).length === 0) {
        AYLAR.forEach((m, i) => { months[m] = 8 + i; });
    }

    return { sira, name, owner, period, unit, prev, target, target3, months };
};

const parseSheet = (rows: any[][], sheetName: string, fallbackYear: number): KpiData | null => {
    // Başlık satırını bul
    const headerRow = rows.findIndex(r => Array.isArray(r) && r.some(c => includesUp(c, 'PERFORMANS')));
    if (headerRow < 0) return null;

    const cols = detectColumns(rows, headerRow);

    // Veri satırları: ay başlık satırından sonra başlar
    const monthHeaderRow = rows[headerRow + 1] && rows[headerRow + 1].some(c => monthFromHeader(c))
        ? headerRow + 1 : headerRow;
    const dataStart = monthHeaderRow + 1;

    const kpis: Kpi[] = [];
    let currentProcess = '';
    let currentOwner = '';
    let lastKpi: Kpi | null = null;
    let seq = 0;

    for (let r = dataStart; r < rows.length; r++) {
        const row = rows[r] || [];
        const siraCell = row[cols.sira];
        const nameStr = firstLine(row[cols.name]);

        // Süreç başlığı: A sütununda "N)" / "N." deseni
        if (typeof siraCell === 'string' && /^\s*\d+\s*[\)\.]/.test(siraCell)) {
            if (nameStr) currentProcess = nameStr;
            currentOwner = extractOwner(row[cols.owner]);
            continue;
        }
        if (typeof siraCell === 'number' && nameStr) {
            // Bazı şablonlarda sıra no sayı olabilir; yine süreç başlığı gibi davran
            currentProcess = nameStr;
            currentOwner = extractOwner(row[cols.owner]);
            continue;
        }

        // KPI adı yoksa: sembol satırı olabilir → son KPI'nın karşılaştırmasını ayarla
        if (!nameStr) {
            const sym = symbolOf(row[cols.target]) || symbolOf(row[cols.prev]);
            if (sym && lastKpi) lastKpi.karsilastirma = sym;
            continue;
        }

        // Alt bilgi satırlarını atla
        if (includesUp(nameStr, 'HAZIRLAYAN', 'ONAYLAYAN', 'GÖZDEN', 'GOZDEN')) break;

        // KPI satırı
        const unit = firstLine(row[cols.unit]);
        // Yüzde birimli KPI'larda kaynak bazen oran (0,88) bazen tam (%88) girilmiş.
        // Tutarlılık için oran (|v|<3) olanları ×100 yaparak tam yüzdeye çeviriyoruz.
        const isPct = unit.replace(/\s/g, '').includes('%');
        const normPct = (v: number | null): number | null =>
            (v !== null && isPct && Math.abs(v) > 0 && Math.abs(v) < 3) ? parseFloat((v * 100).toFixed(4)) : v;

        const hedef = normPct(parseNum(row[cols.target]));
        const aylik: { [key: string]: number | null } = {};
        AYLAR.forEach(m => {
            const ci = cols.months[m];
            aylik[m] = ci !== undefined ? normPct(parseNum(row[ci])) : null;
        });

        const kpi: Kpi = {
            id: `kpi-uuid-${Date.now()}-${(seq++)}-${Math.random().toString(36).substr(2, 6)}`,
            proses: currentProcess || '(Tanımsız Süreç)',
            kpi_adi: nameStr,
            sorumlu: currentOwner || undefined,
            gozdenGecirmePeriyodu: mapPeriod(row[cols.period]),
            onceki_yil_gerceklesen: normPct(parseNum(row[cols.prev])),
            yeni_yil_hedef: hedef ?? 0,
            karsilastirma: guessComparison(nameStr, unit),
            hesap_metodu: 'ortalama',
            birim: unit,
            aciklama: restLines(row[cols.name]),
            kanit_dosyalari: [],
            aylik,
            ortalama: null,
            durum: 'n/a',
            risk: { S: 1, O: 1, D: 1, RPN: 1, esik: 40, riskSeviyesi: 'Düşük' },
            dof: [],
            son_guncelleme: new Date().toLocaleString('tr-TR'),
        };
        kpis.push(kpi);
        lastKpi = kpi;
    }

    if (kpis.length === 0) return null;

    // Yıl tespiti: sayfa adı → "GERÇEKLEŞEN (YYYY)"+1 → fallback
    let yil = fallbackYear;
    const snMatch = sheetName.match(/(20\d{2})/);
    if (snMatch) {
        yil = parseInt(snMatch[1], 10);
    } else {
        const prevHeader = String((rows[headerRow] || [])[cols.prev] ?? '');
        const phMatch = prevHeader.match(/(20\d{2})/);
        if (phMatch) yil = parseInt(phMatch[1], 10) + 1;
    }

    return { yil, kpis };
};

/**
 * Workbook'taki tüm sayfaları dener, en çok KPI üreten sayfanın sonucunu döndürür.
 * @param XLSX window.XLSX (SheetJS)
 * @param workbook XLSX.read(...) sonucu
 * @param fallbackYear sayfa/başlıktan yıl çözülemezse kullanılacak yıl
 */
export const parseKpiWorkbook = (XLSX: any, workbook: any, fallbackYear: number): KpiData => {
    const candidates: { name: string; parsed: KpiData; nameYear: number; hasKpi: number }[] = [];
    for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
        const parsed = parseSheet(rows, sheetName, fallbackYear);
        if (parsed) {
            const ym = sheetName.match(/(20\d{2})/);
            candidates.push({
                name: sheetName,
                parsed,
                nameYear: ym ? parseInt(ym[1], 10) : 0,
                hasKpi: /kpi/i.test(sheetName) ? 1 : 0,
            });
        }
    }
    if (candidates.length === 0) {
        throw new Error('Excel içinde tanınan KPI tablosu bulunamadı. Şablonun "Performans Kriteri" ve "HEDEF (1 YIL)" başlıklarını içerdiğinden emin olun.');
    }
    // En güncel sayfayı seç: önce sayfa adındaki yıl (büyük), sonra "KPI" adı, en son KPI sayısı.
    // Bu, eski/arşiv sayfalar (ör. "F318") yerine güncel "YYYY-KPI" sayfasının seçilmesini sağlar.
    candidates.sort((a, b) =>
        (b.nameYear - a.nameYear) ||
        (b.hasKpi - a.hasKpi) ||
        (b.parsed.kpis.length - a.parsed.kpis.length)
    );
    return candidates[0].parsed;
};
