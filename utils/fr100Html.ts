import { Kpi, Status } from '../types';
import { AYLAR } from '../constants';
import { getSingleMonthStatus } from './calculations';

// FR100 KPI raporunun HTML karşılığı (PDF için). Excel sürümüyle aynı düzen:
// antet (logo + DOK.NO kutusu), süreç gruplu tablo, ≥/≤ + ✔/⚠/❗ sembol satırı, durum renkleri.

const periodLabel = (p?: string): string => {
    switch (p) {
        case '2aylik': return '2 AY';
        case '3aylik': return '3 AY';
        case '4aylik': return '4 AY';
        case '6aylik': return '6 AY';
        case 'yillik': return '1 YIL';
        default: return '1 AY';
    }
};
const opLabel = (c: string): string => (c === '>=' ? '≥' : c === '<=' ? '≤' : c === '>' ? '>' : c === '<' ? '<' : '=');
const glyph = (s: Status): string => (s === 'basarili' ? '✔' : s === 'marjinal' ? '⚠' : s === 'basarisiz' ? '❗' : '');

const FILL: Record<string, string> = { basarili: '#e2f0d9', marjinal: '#fff2cc', basarisiz: '#fbe0e0', 'n/a': '#ffffff' };
const FONT: Record<string, string> = { basarili: '#1e7e34', marjinal: '#9c6500', basarisiz: '#c0392b', 'n/a': '#888888' };

const esc = (s: any): string => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (v: number | null | undefined): string => {
    if (v === null || v === undefined) return '';
    return Number.isInteger(v) ? v.toLocaleString('tr-TR') : v.toLocaleString('tr-TR', { maximumFractionDigits: 6 });
};

export const buildFr100Html = (
    kpis: Kpi[],
    year: number,
    opts: { docNo: string; companyName: string; locationName: string; logoDataUrl: string | null },
): string => {
    // Süreçlere göre grupla (ilk görünme sırası)
    const order: string[] = [];
    const groups = new Map<string, { owner: string; items: Kpi[] }>();
    for (const k of kpis) {
        const p = k.proses || '(Tanımsız Süreç)';
        if (!groups.has(p)) { groups.set(p, { owner: k.sorumlu || '', items: [] }); order.push(p); }
        const g = groups.get(p)!;
        if (!g.owner && k.sorumlu) g.owner = k.sorumlu;
        g.items.push(k);
    }

    const logoCell = opts.logoDataUrl
        ? `<img src="${opts.logoDataUrl}" style="max-height:46px;max-width:150px;" />`
        : `<span style="font-weight:bold;font-size:18px;color:#0288d1;">${esc(opts.companyName)}</span>`;

    let body = '';
    let procNo = 0;
    for (const proses of order) {
        const g = groups.get(proses)!;
        procNo++;
        body += `<tr class="proc">
            <td style="text-align:center;font-weight:bold;">${procNo})</td>
            <td style="font-weight:bold;">${esc(proses)}</td>
            <td style="font-weight:bold;">${esc(g.owner)}</td>
            <td colspan="18"></td>
        </tr>`;

        for (const kpi of g.items) {
            const dur = (kpi.durum || 'n/a') as string;
            const aciklama = kpi.aciklama && kpi.aciklama.trim() ? `<div style="font-size:7px;color:#888;font-style:italic;">${esc(kpi.aciklama.trim())}</div>` : '';
            // Değer satırı
            let monthsVal = '';
            AYLAR.forEach(ay => {
                const v = kpi.aylik[ay];
                if (v !== null && v !== undefined) {
                    const ms = getSingleMonthStatus(kpi, v);
                    monthsVal += `<td style="text-align:center;background:${FILL[ms]};color:${FONT[ms]};">${fmt(v)}</td>`;
                } else {
                    monthsVal += `<td></td>`;
                }
            });
            const avg = (kpi.ortalama !== null && kpi.ortalama !== undefined)
                ? `<td style="text-align:center;font-weight:bold;background:${FILL[dur]};color:${FONT[dur]};">${fmt(kpi.ortalama)}</td>`
                : `<td style="text-align:center;background:${FILL[dur]};color:${FONT[dur]};">N/A</td>`;

            body += `<tr class="kpi">
                <td></td>
                <td>${esc(kpi.kpi_adi)}${aciklama}</td>
                <td></td>
                <td style="text-align:center;">${periodLabel(kpi.gozdenGecirmePeriyodu)}</td>
                <td style="text-align:center;">${esc(kpi.birim)}</td>
                <td style="text-align:center;">${kpi.onceki_yil_gerceklesen ?? '-'}</td>
                <td style="text-align:center;">${fmt(kpi.yeni_yil_hedef)}</td>
                <td></td>
                ${monthsVal}
                ${avg}
            </tr>`;

            // Sembol satırı (≥/≤ + ✔/⚠/❗)
            const op = opLabel(kpi.karsilastirma);
            let monthsSym = '';
            AYLAR.forEach(ay => {
                const v = kpi.aylik[ay];
                if (v !== null && v !== undefined) {
                    const ms = getSingleMonthStatus(kpi, v);
                    monthsSym += `<td style="text-align:center;color:${FONT[ms]};font-weight:bold;">${glyph(ms)}</td>`;
                } else {
                    monthsSym += `<td></td>`;
                }
            });
            const avgSym = `<td style="text-align:center;color:${FONT[dur]};font-weight:bold;">${glyph(dur as Status)}</td>`;
            body += `<tr class="sym">
                <td></td><td></td><td></td><td></td><td></td>
                <td style="text-align:center;font-weight:bold;color:#555;">${op}</td>
                <td style="text-align:center;font-weight:bold;color:#555;">${op}</td>
                <td></td>
                ${monthsSym}
                ${avgSym}
            </tr>`;
        }
    }

    const monthHead = AYLAR.map(ay => `<th>${ay}</th>`).join('');

    return `
    <style>
        * { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
        .fr100 { width:100%; border-collapse:collapse; font-size:8px; }
        .fr100 th, .fr100 td { border:1px solid #b8b8b8; padding:2px 3px; }
        .fr100 thead th { background:#dce6f1; color:#1f3864; font-weight:bold; text-align:center; }
        .fr100 tr { page-break-inside: avoid; }
        .fr100 tr.proc td { background:#eaf1fb; color:#1f3864; }
        .head { width:100%; border-collapse:collapse; margin-bottom:6px; }
        .head td { border:1px solid #b8b8b8; padding:4px 6px; vertical-align:middle; }
        .doc td { font-size:8px; padding:2px 5px; }
    </style>
    <table class="head">
        <tr>
            <td style="width:160px;text-align:center;">${logoCell}</td>
            <td style="text-align:center;">
                <div style="font-size:14px;font-weight:bold;color:#1f3864;">KALİTE YÖNETİM SİSTEMİ DOKÜMANTASYONU</div>
                <div style="font-size:11px;font-weight:bold;color:#333;margin-top:3px;">${year} YILI ANAHTAR PERFORMANS GÖSTERGELERİ (KPI) İZLEME TABLOSU — ${esc(opts.locationName)}</div>
            </td>
            <td style="width:150px;padding:0;">
                <table style="width:100%;border-collapse:collapse;" class="doc">
                    <tr><td style="font-weight:bold;color:#555;">DOK. NO</td><td style="font-weight:bold;">${esc(opts.docNo)}</td></tr>
                    <tr><td style="font-weight:bold;color:#555;">Y. TRH.</td><td>01.11.2003</td></tr>
                    <tr><td style="font-weight:bold;color:#555;">REV. NO</td><td>07</td></tr>
                    <tr><td style="font-weight:bold;color:#555;">SAYFA</td><td>1 / 1</td></tr>
                </table>
            </td>
        </tr>
    </table>
    <table class="fr100">
        <thead>
            <tr>
                <th rowspan="2">Sıra No</th>
                <th rowspan="2">Performans Kriteri</th>
                <th rowspan="2">Süreç Sahibi</th>
                <th rowspan="2">Ölçüm Periyodu</th>
                <th rowspan="2">Birim</th>
                <th rowspan="2">GERÇEKLEŞEN (${year - 1})</th>
                <th rowspan="2">HEDEF (1 YIL)</th>
                <th rowspan="2">HEDEF (3 YIL)</th>
                <th colspan="12">GERÇEKLEŞEN</th>
                <th rowspan="2">ORTALAMA</th>
            </tr>
            <tr>${monthHead}</tr>
        </thead>
        <tbody>${body}</tbody>
    </table>
    <p style="font-size:8px;color:#888;margin-top:6px;text-align:right;">Oluşturma Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
    `;
};
