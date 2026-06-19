import { ActionItem } from '../types';

// FR216 "KPI'lar için Aksiyonlar / Action Items For KPI" şablonuna uygun, Sanifoam antetli Excel üretir.

const TOTAL_COLS = 11; // A..K
const toBase64 = (ab: ArrayBuffer): string => {
    const bytes = new Uint8Array(ab);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
    return typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
};

const PRIO_FILL: Record<string, string> = { LOW: 'FFE2F0D9', MEDIUM: 'FFFFF2CC', HIGH: 'FFF8CBCB' };
const PRIO_FONT: Record<string, string> = { LOW: 'FF548235', MEDIUM: 'FF9C6500', HIGH: 'FFC0392B' };

export const exportFr216 = async (ExcelJS: any, items: ActionItem[], year: number, nextMeeting: string, logoBuffer: ArrayBuffer | null): Promise<Blob> => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'KPI Takip Tablosu';
    const ws = wb.addWorksheet(`${year} Aksiyonlar`, {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.2, footer: 0.2 } },
        views: [{ state: 'frozen', ySplit: 6 }],
    });

    const widths = [38, 28, 30, 7, 10, 14, 14, 12, 7, 9, 22];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const thin = { style: 'thin', color: { argb: 'FFA6A6A6' } };
    const allBorder = { top: thin, left: thin, bottom: thin, right: thin };
    const setBorder = (r1: number, r2: number, c1 = 1, c2 = TOTAL_COLS) => {
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = allBorder;
    };

    // ── Antet ──
    for (let r = 1; r <= 4; r++) ws.getRow(r).height = 18;
    ws.mergeCells('A1:B4');
    ws.mergeCells('C1:I2');
    ws.mergeCells('C3:I4');
    const title = ws.getCell('C1');
    title.value = 'KALİTE YÖNETİM SİSTEMİ DOKÜMANTASYONU';
    title.font = { bold: true, size: 13, color: { argb: 'FF1F3864' } };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    const sub = ws.getCell('C3');
    sub.value = "KPI'lar için Aksiyonlar\nAction Items For KPI";
    sub.font = { bold: true, size: 11, italic: true, color: { argb: 'FF375623' } };
    sub.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    const docBox: [string, string, string][] = [
        ['J1', 'DOK. NO', 'FR216'], ['J2', 'Y. TRH.', '15.04.2022'], ['J3', 'REV. NO', '00'], ['J4', 'SAYFA', '1 / 1'],
    ];
    docBox.forEach(([lc, label, val], i) => {
        const l = ws.getCell(lc); l.value = label; l.font = { bold: true, size: 8, color: { argb: 'FF555555' } }; l.alignment = { vertical: 'middle', horizontal: 'center' };
        const v = ws.getCell(`K${i + 1}`); v.value = val; v.font = { size: 8, bold: i === 0 }; v.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    setBorder(1, 4, 1, 2); setBorder(1, 4, 3, 9); setBorder(1, 4, 10, 11);

    if (logoBuffer) {
        try {
            const id = wb.addImage({ base64: toBase64(logoBuffer), extension: 'png' });
            ws.addImage(id, { tl: { col: 0.15, row: 0.35 }, ext: { width: 165, height: 56 }, editAs: 'oneCell' });
        } catch { /* atla */ }
    } else {
        const lg = ws.getCell('A1'); lg.value = 'SANİFOAM'; lg.font = { bold: true, size: 16, color: { argb: 'FF0288D1' } }; lg.alignment = { vertical: 'middle', horizontal: 'center' };
    }

    // Last Updated / Next Meeting (5. satır)
    const today = new Date().toLocaleDateString('tr-TR');
    ws.getCell('G5').value = 'Last Updated:'; ws.getCell('G5').font = { bold: true, size: 9 }; ws.getCell('G5').alignment = { horizontal: 'right' };
    ws.getCell('H5').value = today; ws.getCell('H5').font = { size: 9 };
    ws.getCell('J5').value = 'Next Meeting:'; ws.getCell('J5').font = { bold: true, size: 9 }; ws.getCell('J5').alignment = { horizontal: 'right' };
    ws.getCell('K5').value = nextMeeting || ''; ws.getCell('K5').font = { size: 9 };

    // ── Tablo başlığı (6. satır) ──
    const HR = 6;
    const headers = ['KPI', 'Root Cause', 'Action', 'RANK', 'PRIORITY', 'OWNER', 'ASSIGNED', 'DUE', 'DONE', 'STATUS', 'NOTES'];
    headers.forEach((h, i) => {
        const c = ws.getCell(HR, i + 1);
        c.value = h;
        c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF375623' } };
    });
    setBorder(HR, HR);
    ws.getRow(HR).height = 22;

    // ── Veri satırları ──
    let r = HR + 1;
    for (const it of items) {
        ws.getCell(r, 1).value = it.kpi || '';
        ws.getCell(r, 2).value = it.rootCause || '';
        ws.getCell(r, 3).value = it.action || '';
        ws.getCell(r, 4).value = it.rank || '';
        const prio = ws.getCell(r, 5);
        prio.value = it.priority;
        prio.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIO_FILL[it.priority] || 'FFFFFFFF' } };
        prio.font = { bold: true, size: 9, color: { argb: PRIO_FONT[it.priority] || 'FF222222' } };
        ws.getCell(r, 6).value = it.owner || '';
        ws.getCell(r, 7).value = it.assigned || '';
        ws.getCell(r, 8).value = it.due || '';
        ws.getCell(r, 9).value = it.done ? '✓' : '';
        const st = ws.getCell(r, 10);
        st.value = (it.status || 0) / 100;
        st.numFmt = '0%';
        const pct = it.status || 0;
        st.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pct >= 100 ? 'FFC6EFCE' : pct >= 50 ? 'FFE2EFDA' : 'FFFFF2CC' } };
        st.font = { bold: true, size: 9, color: { argb: 'FF375623' } };
        ws.getCell(r, 11).value = it.notes || '';

        // hizalama + sarma
        [1, 2, 3, 11].forEach(c => { ws.getCell(r, c).alignment = { vertical: 'top', horizontal: 'left', wrapText: true }; ws.getCell(r, c).font = { size: 9 }; });
        [4, 5, 6, 7, 8, 9, 10].forEach(c => { ws.getCell(r, c).alignment = { vertical: 'middle', horizontal: 'center' }; });
        ws.getRow(r).height = 40;
        r++;
    }
    // En az birkaç boş satır görünümü için tabloyu çerçevele
    if (items.length === 0) r++;
    setBorder(HR + 1, Math.max(HR + 1, r - 1));

    const buffer = await wb.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
