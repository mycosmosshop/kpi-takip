import { Kpi, Status } from '../types';
import { AYLAR } from '../constants';
import { getSingleMonthStatus } from './calculations';

// FR100 (Kalite Yönetim Sistemi) şablonuna uygun, Sanifoam antetli, biçimli Excel üretir.
// ExcelJS (window.ExcelJS) ile çalışır: hücre stilleri, kenarlık, dolgu ve logo görseli desteklenir.

const MONTH_HEADERS = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];

const periodLabel = (p?: string): string => {
    switch (p) {
        case '2aylik': return '2 AY';
        case '3aylik': return '3 AY';
        case '4aylik': return '4 AY';
        case '6aylik': return '6 AY';
        case 'yillik': return '1 YIL';
        case 'aylik':
        default: return '1 AY';
    }
};

const opLabel = (c: string): string => (c === '>' ? '≥' : c === '<' ? '≤' : '=');

// Durum sembolleri: ✔ başarılı (yeşil), ⚠ marjinal/sınırda (amber), ❗ başarısız (kırmızı)
// (U+FE0E = metin gösterimi: hücre yazı rengini alsın, renkli emoji'ye dönmesin)
const statusGlyph = (s: Status): string => (s === 'basarili' ? '✔' : s === 'marjinal' ? '⚠︎' : s === 'basarisiz' ? '❗︎' : '');

const STATUS_FILL: Record<string, string> = {
    basarili: 'FFE2F0D9', marjinal: 'FFFFF2CC', basarisiz: 'FFFBE0E0', 'n/a': 'FFFFFFFF',
};
const STATUS_FONT: Record<string, string> = {
    basarili: 'FF1E7E34', marjinal: 'FF9C6500', basarisiz: 'FFC0392B', 'n/a': 'FF888888',
};

const TOTAL_COLS = 21; // A..U
const NUMFMT = '#,##0.######';

// ArrayBuffer → base64 (tarayıcı ve Node'da çalışır; ExcelJS addImage için en güvenli yol)
const toBase64 = (ab: ArrayBuffer): string => {
    const bytes = new Uint8Array(ab);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
    }
    return typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
};

export const exportFr100 = async (ExcelJS: any, kpis: Kpi[], year: number, logoBuffer: ArrayBuffer | null, brand?: { docNo?: string; companyName?: string; locationName?: string }): Promise<Blob> => {
    const docNo = brand?.docNo || 'FR 100';
    const companyName = brand?.companyName || 'SANİFOAM';
    const wb = new ExcelJS.Workbook();
    wb.creator = 'KPI Takip Tablosu';

    const ws = wb.addWorksheet(`${year} KPI`, {
        properties: { defaultRowHeight: 15 },
        pageSetup: {
            paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.2, footer: 0.2 },
        },
        views: [{ state: 'frozen', xSplit: 2, ySplit: 7 }],
    });

    const widths = [6, 42, 18, 10, 9, 13, 12, 12, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 11];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const thin = { style: 'thin', color: { argb: 'FFA6A6A6' } };
    const allBorder = { top: thin, left: thin, bottom: thin, right: thin };

    const setBorderRange = (r1: number, r2: number, c1 = 1, c2 = TOTAL_COLS) => {
        for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = allBorder;
        }
    };
    const fillRange = (r1: number, r2: number, argb: string, c1 = 1, c2 = TOTAL_COLS) => {
        for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
        }
    };

    // ───────── Antet (1-4. satır) ─────────
    for (let r = 1; r <= 4; r++) ws.getRow(r).height = 18;
    ws.mergeCells('A1:B4');
    ws.mergeCells('C1:R2');
    ws.mergeCells('C3:R4');
    ws.mergeCells('T1:U1'); ws.mergeCells('T2:U2'); ws.mergeCells('T3:U3'); ws.mergeCells('T4:U4');

    const title = ws.getCell('C1');
    title.value = 'KALİTE YÖNETİM SİSTEMİ DOKÜMANTASYONU';
    title.font = { bold: true, size: 14, name: 'Calibri', color: { argb: 'FF1F3864' } };
    title.alignment = { vertical: 'middle', horizontal: 'center' };

    const subtitle = ws.getCell('C3');
    subtitle.value = `${year} YILI ANAHTAR PERFORMANS GÖSTERGELERİ (KPI) İZLEME TABLOSU${brand?.locationName ? ' — ' + brand.locationName : ''}`;
    subtitle.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF333333' } };
    subtitle.alignment = { vertical: 'middle', horizontal: 'center' };

    const docBox: [string, string, string][] = [
        ['S1', 'DOK. NO', docNo],
        ['S2', 'Y. TRH.', '01.11.2003'],
        ['S3', 'REV. NO', '07'],
        ['S4', 'SAYFA', '1 / 1'],
    ];
    docBox.forEach(([labelCell, label, val], i) => {
        const lc = ws.getCell(labelCell);
        lc.value = label;
        lc.font = { bold: true, size: 8, color: { argb: 'FF555555' } };
        lc.alignment = { vertical: 'middle', horizontal: 'center' };
        const vc = ws.getCell(`T${i + 1}`);
        vc.value = val;
        vc.font = { size: 8, bold: i === 0 };
        vc.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    setBorderRange(1, 4, 1, 2);   // logo kutusu
    setBorderRange(1, 4, 3, 19);  // başlık kutusu
    setBorderRange(1, 4, 19, 21); // doküman bilgi kutusu

    if (logoBuffer) {
        try {
            const imgId = wb.addImage({ base64: toBase64(logoBuffer), extension: 'png' });
            ws.addImage(imgId, { tl: { col: 0.15, row: 0.35 }, ext: { width: 170, height: 58 }, editAs: 'oneCell' });
        } catch { /* logo eklenemezse atla */ }
    } else {
        const lg = ws.getCell('A1');
        lg.value = companyName;
        lg.font = { bold: true, size: 16, color: { argb: 'FF0288D1' } };
        lg.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // ───────── Tablo başlığı (6-7. satır) ─────────
    const headerFill = 'FFDCE6F1';
    const HR = 6;
    ws.mergeCells(`A${HR}:A${HR + 1}`);
    ws.mergeCells(`B${HR}:B${HR + 1}`);
    ws.mergeCells(`C${HR}:C${HR + 1}`);
    ws.mergeCells(`D${HR}:D${HR + 1}`);
    ws.mergeCells(`E${HR}:E${HR + 1}`);
    ws.mergeCells(`F${HR}:F${HR + 1}`);
    ws.mergeCells(`G${HR}:G${HR + 1}`);
    ws.mergeCells(`H${HR}:H${HR + 1}`);
    ws.mergeCells(`I${HR}:T${HR}`);
    ws.mergeCells(`U${HR}:U${HR + 1}`);

    const headTexts: [number, string][] = [
        [1, 'Sıra No'], [2, 'Performans Kriteri'], [3, 'Süreç Sahibi'], [4, 'Ölçüm Periyodu'],
        [5, 'Birim'], [6, `GERÇEKLEŞEN (${year - 1})`], [7, 'HEDEF (1 YIL)'], [8, 'HEDEF (3 YIL)'],
        [9, 'GERÇEKLEŞEN'], [21, 'ORTALAMA'],
    ];
    headTexts.forEach(([col, text]) => {
        const cell = ws.getCell(HR, col);
        cell.value = text;
    });
    MONTH_HEADERS.forEach((m, i) => { ws.getCell(HR + 1, 9 + i).value = m; });

    for (let c = 1; c <= TOTAL_COLS; c++) {
        for (let r = HR; r <= HR + 1; r++) {
            const cell = ws.getCell(r, c);
            cell.font = { bold: true, size: 9, color: { argb: 'FF1F3864' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        }
    }
    fillRange(HR, HR + 1, headerFill);
    setBorderRange(HR, HR + 1);
    ws.getRow(HR).height = 16;
    ws.getRow(HR + 1).height = 26;

    // ───────── Süreçlere göre grupla ─────────
    const order: string[] = [];
    const groups = new Map<string, { owner: string; items: Kpi[] }>();
    for (const k of kpis) {
        const p = k.proses || '(Tanımsız Süreç)';
        if (!groups.has(p)) { groups.set(p, { owner: k.sorumlu || '', items: [] }); order.push(p); }
        const g = groups.get(p)!;
        if (!g.owner && k.sorumlu) g.owner = k.sorumlu;
        g.items.push(k);
    }

    let r = HR + 2;
    let procNo = 0;

    for (const proses of order) {
        const g = groups.get(proses)!;
        procNo++;

        // Süreç başlık satırı
        const pr = r;
        ws.getCell(pr, 1).value = `${procNo})`;
        ws.getCell(pr, 2).value = proses;
        ws.getCell(pr, 3).value = g.owner;
        for (let c = 1; c <= TOTAL_COLS; c++) {
            const cell = ws.getCell(pr, c);
            cell.font = { bold: true, size: 10, color: { argb: 'FF1F3864' } };
            cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'center' };
        }
        fillRange(pr, pr, 'FFEAF1FB');
        setBorderRange(pr, pr);
        ws.getRow(pr).height = 16;
        r++;

        for (const kpi of g.items) {
            const vRow = r;
            const sRow = r + 1;
            const dur = (kpi.durum || 'n/a') as string;

            // Değer satırı
            const nameCell = ws.getCell(vRow, 2);
            if (kpi.aciklama && kpi.aciklama.trim()) {
                nameCell.value = {
                    richText: [
                        { text: kpi.kpi_adi, font: { size: 9, bold: false, color: { argb: 'FF222222' } } },
                        { text: `\n${kpi.aciklama.trim()}`, font: { size: 8, italic: true, color: { argb: 'FF888888' } } },
                    ],
                } as any;
            } else {
                nameCell.value = kpi.kpi_adi;
                nameCell.font = { size: 9, color: { argb: 'FF222222' } };
            }
            nameCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

            ws.getCell(vRow, 4).value = periodLabel(kpi.gozdenGecirmePeriyodu);
            ws.getCell(vRow, 5).value = kpi.birim || '';
            ws.getCell(vRow, 6).value = kpi.onceki_yil_gerceklesen ?? '-';
            ws.getCell(vRow, 7).value = kpi.yeni_yil_hedef;
            ws.getCell(vRow, 8).value = ''; // HEDEF (3 YIL) — takip edilmiyor

            AYLAR.forEach((ay, i) => {
                const col = 9 + i;
                const val = kpi.aylik[ay];
                const cell = ws.getCell(vRow, col);
                if (val !== null && val !== undefined) {
                    cell.value = val;
                    cell.numFmt = NUMFMT;
                    const ms = getSingleMonthStatus(kpi, val);
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[ms] || 'FFFFFFFF' } };
                    cell.font = { size: 9, color: { argb: STATUS_FONT[ms] || 'FF222222' } };
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            // Ortalama
            const avgCell = ws.getCell(vRow, 21);
            if (kpi.ortalama !== null && kpi.ortalama !== undefined) {
                avgCell.value = kpi.ortalama;
                avgCell.numFmt = NUMFMT;
            } else {
                avgCell.value = 'N/A';
            }
            avgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[dur] || 'FFFFFFFF' } };
            avgCell.font = { size: 9, bold: true, color: { argb: STATUS_FONT[dur] || 'FF222222' } };
            avgCell.alignment = { vertical: 'middle', horizontal: 'center' };

            // F, G sayısal hizalama
            [6, 7].forEach(c => {
                const cell = ws.getCell(vRow, c);
                if (typeof cell.value === 'number') cell.numFmt = NUMFMT;
                cell.font = { size: 9 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            ws.getCell(vRow, 4).alignment = { vertical: 'middle', horizontal: 'center' };
            ws.getCell(vRow, 5).alignment = { vertical: 'middle', horizontal: 'center' };
            ws.getRow(vRow).height = 22;

            // Sembol satırı (≥ / ≤ ve aylık durum simgesi)
            const op = opLabel(kpi.karsilastirma);
            const opF = ws.getCell(sRow, 6); opF.value = op;
            const opG = ws.getCell(sRow, 7); opG.value = op;
            [opF, opG].forEach(c => { c.font = { bold: true, size: 10, color: { argb: 'FF555555' } }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });

            AYLAR.forEach((ay, i) => {
                const col = 9 + i;
                const val = kpi.aylik[ay];
                const cell = ws.getCell(sRow, col);
                if (val !== null && val !== undefined) {
                    const ms = getSingleMonthStatus(kpi, val);
                    const gl = statusGlyph(ms);
                    if (gl) { cell.value = gl; cell.font = { bold: true, size: 11, color: { argb: STATUS_FONT[ms] || 'FF222222' } }; }
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            const sAvg = ws.getCell(sRow, 21);
            const gl = statusGlyph(dur as Status);
            if (gl) { sAvg.value = gl; sAvg.font = { bold: true, size: 11, color: { argb: STATUS_FONT[dur] || 'FF222222' } }; }
            sAvg.alignment = { vertical: 'middle', horizontal: 'center' };
            ws.getRow(sRow).height = 14;

            setBorderRange(vRow, sRow);
            r += 2;
        }
    }

    // ───────── Alt bilgi ─────────
    r += 1;
    const today = new Date().toLocaleDateString('tr-TR');
    ws.getCell(r, 2).value = 'Hazırlayan';
    ws.getCell(r, 6).value = 'Onaylayan';
    ws.getCell(r, 18).value = `Oluşturma Tarihi: ${today}`;
    [2, 6].forEach(c => { ws.getCell(r, c).font = { bold: true, size: 9 }; });
    ws.getCell(r, 18).font = { italic: true, size: 8, color: { argb: 'FF888888' } };
    ws.getCell(r, 18).alignment = { horizontal: 'right' };

    const buffer = await wb.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
