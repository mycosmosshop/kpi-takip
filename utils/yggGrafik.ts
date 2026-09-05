// YGG raporundaki KPI grafikleri.
//
// Tek bir HTML üreticisi: hem modalde hem YAZDIR çıktısında AYNI grafik
// görünsün. İki ayrı çizim olsaydı biri güncellenip diğeri unutulurdu.
// Kütüphane yok — yazdırmada dış kaynak yüklenmez, satır içi CSS her
// yerde çalışır.
import type { Kpi } from '../types';
import { AYLAR } from '../constants.ts';

const esc = (t: any): string => String(t === null || t === undefined ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sayi = (n: number | null | undefined): string =>
    (n === null || n === undefined || isNaN(Number(n))) ? '—'
        : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: Math.abs(Number(n)) >= 1000 ? 0 : 2 });

const RENK = { basarili: '#22c55e', marjinal: '#eab308', basarisiz: '#ef4444', 'n/a': '#d1d5db' } as const;

// Bir ayda kaç KPI hedefte? Değeri girilmemiş KPI SAYILMAZ — sayılsaydı
// veri girilmemiş ay "başarısız" görünür ve grafik yanlış okunurdu.
export const aylikBasari = (kpis: Kpi[]): { ay: string; oran: number | null; dolu: number }[] =>
    AYLAR.map(ay => {
        const dolu = kpis.filter(k => {
            const v = k.aylik?.[ay];
            return v !== null && v !== undefined;
        });
        if (!dolu.length) return { ay, oran: null, dolu: 0 };
        const iyi = dolu.filter(k => {
            const v = Number(k.aylik[ay]);
            const h = Number(k.yeni_yil_hedef);
            switch (k.karsilastirma) {
                case '<=': return v <= h;
                case '<': return v < h;
                case '>': return v > h;
                case '=': return v === h;
                default: return v >= h;
            }
        }).length;
        return { ay, oran: (iyi / dolu.length) * 100, dolu: dolu.length };
    });

// Hedefe göre gerçekleşme oranı. Birimler çok farklı (TL, ppm, saat), o
// yüzden mutlak değil HEDEFE ORANLI çizilir: hedef her satırda aynı yerde.
export const hedefOrani = (k: Kpi): number | null => {
    // null/undefined ÖNCE elenir: Number(null) === 0 olduğu için verisi
    // olmayan KPI %0 (tam başarısızlık) gibi çizilirdi.
    if (k.ortalama === null || k.ortalama === undefined) return null;
    if (k.yeni_yil_hedef === null || k.yeni_yil_hedef === undefined) return null;
    const o = Number(k.ortalama), h = Number(k.yeni_yil_hedef);
    if (isNaN(o) || isNaN(h) || h === 0) return null;
    return (o / Math.abs(h)) * 100;
};

export const kpiGrafikHtml = (kpis: Kpi[], yil: number): string => {
    if (!kpis.length) return '<p style="color:#666">Bu lokasyon/yıl için KPI kaydı yok.</p>';

    const aylik = aylikBasari(kpis);
    const aylikBar = aylik.map(a => {
        const y = a.oran === null ? 0 : a.oran;
        const renk = a.oran === null ? '#e5e7eb' : (y >= 85 ? RENK.basarili : y >= 60 ? RENK.marjinal : RENK.basarisiz);
        const bilgi = a.oran === null ? 'veri girilmemiş' : `${sayi(y)}% (${a.dolu} KPI)`;
        return `<div style="flex:1;text-align:center;min-width:0">
            <div style="height:74px;display:flex;align-items:flex-end;justify-content:center">
              <div title="${esc(a.ay)}: ${esc(bilgi)}" style="width:74%;height:${Math.max(y, a.oran === null ? 4 : 3)}%;
                background:${renk};border-radius:3px 3px 0 0"></div>
            </div>
            <div style="font-size:8.5pt;color:#555;margin-top:2px">${esc(a.ay.slice(0, 3))}</div>
            <div style="font-size:8pt;color:#888">${a.oran === null ? '—' : sayi(a.oran) + '%'}</div>
          </div>`;
    }).join('');

    // Hedefe göre: ölçek 2× hedef, ortadaki çizgi hedef.
    const satir = kpis.map(k => {
        const o = hedefOrani(k);
        const renk = RENK[(k.durum || 'n/a') as keyof typeof RENK] || RENK['n/a'];
        const gen = o === null ? 0 : Math.min(o / 2, 100);
        return `<tr>
            <td style="padding:3px 6px;font-size:9.5pt;white-space:nowrap;max-width:230px;overflow:hidden;text-overflow:ellipsis">${esc(k.kpi_adi)}</td>
            <td style="padding:3px 6px;text-align:right;font-size:9.5pt;white-space:nowrap">${esc(sayi(k.ortalama))} / ${esc(sayi(k.yeni_yil_hedef))} ${esc(k.birim)}</td>
            <td style="padding:3px 6px;width:46%">
              <div style="position:relative;height:11px;background:#eee;border-radius:3px">
                <div style="position:absolute;left:0;top:0;bottom:0;width:${gen}%;background:${renk};border-radius:3px"></div>
                <div style="position:absolute;left:50%;top:-2px;bottom:-2px;width:2px;background:#555"></div>
              </div>
            </td>
            <td style="padding:3px 6px;text-align:right;font-size:9.5pt;color:${renk};white-space:nowrap">${o === null ? '—' : sayi(o) + '%'}</td>
          </tr>`;
    }).join('');

    return `
    <div style="margin:10px 0 16px">
      <div style="font-weight:600;font-size:10.5pt;margin-bottom:4px">${yil} Aylık Başarı Oranı (hedefi tutturan KPI %)</div>
      <div style="display:flex;gap:3px;align-items:flex-end;border-bottom:1px solid #ccc;padding-bottom:2px">${aylikBar}</div>
      <div style="font-size:8.5pt;color:#777;margin-top:3px">
        Değeri girilmemiş KPI o ayın hesabına katılmaz; hiç veri yoksa sütun boş (—) gösterilir.
      </div>
    </div>
    <div>
      <div style="font-weight:600;font-size:10.5pt;margin-bottom:4px">KPI bazında hedefe göre gerçekleşme</div>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr style="background:#f4f6f8;font-size:9pt">
          <th style="padding:3px 6px;text-align:left">KPI</th>
          <th style="padding:3px 6px;text-align:right">Gerçekleşen / Hedef</th>
          <th style="padding:3px 6px;text-align:left">Hedefe göre (ortadaki çizgi = hedef)</th>
          <th style="padding:3px 6px;text-align:right">%</th>
        </tr></thead>
        <tbody>${satir}</tbody>
      </table>
    </div>`;
};

// ── Bölüm grafiği: ilgili KPI'ların 12 aylık seyri ──
// YGG'de "bakım hedefleri", "tedarikçi performansı" gibi maddeler kendi
// verisini kendi maddesinde göstermeli; genel grafik bunu karşılamıyor.
// Her KPI kendi ölçeğinde çizilir (birimler farklı), hedefi tutan ay yeşil.
export const hedefiTuttu = (k: Kpi, v: number): boolean => {
    const h = Number(k.yeni_yil_hedef);
    switch (k.karsilastirma) {
        case '<=': return v <= h;
        case '<': return v < h;
        case '>': return v > h;
        case '=': return v === h;
        default: return v >= h;
    }
};

export const bolumGrafikHtml = (kpis: Kpi[], yil: number, baslik: string): string => {
    if (!kpis || !kpis.length) return '';
    const satirlar = kpis.slice(0, 8).map(k => {
        const degerler = AYLAR.map(ay => {
            const v = k.aylik ? k.aylik[ay] : null;
            return (v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
        });
        const dolu = degerler.filter(v => v !== null) as number[];
        // Ölçek: KPI'nın kendi en büyük değeri VE hedefi. Hedef ölçeğe
        // katılmazsa hedef çizgisi çerçevenin dışında kalır.
        const enBuyuk = Math.max(...dolu.map(Math.abs), Math.abs(Number(k.yeni_yil_hedef) || 0), 1);
        const hedefY = Math.min(Math.abs(Number(k.yeni_yil_hedef) || 0) / enBuyuk, 1) * 100;
        const kutu = degerler.map((v, i) => {
            if (v === null) {
                return `<div style="flex:1;min-width:0;height:34px;border-bottom:1px solid #e5e7eb"
                    title="${esc(AYLAR[i])}: veri yok"></div>`;
            }
            const y = Math.max((Math.abs(v) / enBuyuk) * 100, 2);
            const iyi = hedefiTuttu(k, v);
            return `<div style="flex:1;min-width:0;height:34px;display:flex;align-items:flex-end;
                border-bottom:1px solid #e5e7eb" title="${esc(AYLAR[i])}: ${esc(sayi(v))} ${esc(k.birim)}">
                <div style="width:78%;margin:0 auto;height:${y}%;border-radius:2px 2px 0 0;
                background:${iyi ? RENK.basarili : RENK.basarisiz}"></div></div>`;
        }).join('');
        return `<tr>
            <td style="padding:2px 6px;font-size:9pt;white-space:nowrap;max-width:190px;
                overflow:hidden;text-overflow:ellipsis">${esc(k.kpi_adi)}
                <span style="color:#888">(${esc(k.birim)})</span></td>
            <td style="padding:2px 4px">
              <div style="position:relative;display:flex;gap:2px">
                ${kutu}
                <div style="position:absolute;left:0;right:0;bottom:${hedefY}%;height:0;
                  border-top:1px dashed #444" title="Hedef ${esc(sayi(k.yeni_yil_hedef))}"></div>
              </div>
            </td>
            <td style="padding:2px 6px;text-align:right;font-size:9pt;white-space:nowrap">
              ${esc(sayi(k.ortalama))} / ${esc(sayi(k.yeni_yil_hedef))}</td>
          </tr>`;
    }).join('');

    return `<div style="margin:6px 0 10px">
        <div style="font-size:9.5pt;font-weight:600;margin-bottom:2px">${esc(baslik)} — ${yil} aylık seyir</div>
        <table style="border-collapse:collapse;width:100%"><tbody>${satirlar}</tbody></table>
        <div style="display:flex;gap:2px;margin-left:0">
          ${AYLAR.map(a => `<div style="flex:1;text-align:center;font-size:7.5pt;color:#999">${esc(a.slice(0, 1))}</div>`).join('')}
        </div>
        <div style="font-size:8pt;color:#888;margin-top:2px">
          Kesikli çizgi = hedef · yeşil: o ay hedefi tuttu · boş sütun: veri girilmemiş
          ${kpis.length > 8 ? ` · ilk 8 KPI gösteriliyor (${kpis.length} KPI)` : ''}
        </div>
      </div>`;
};

// ── Kalite maliyeti grafiği: aylık TL, tip kırılımı yığılmış ──
export interface MaliyetAy { ay: number; ic: number; dis: number; ted: number; diger: number; }

export const maliyetGrafikHtml = (aylik: MaliyetAy[], yil: number): string => {
    if (!aylik || !aylik.length) return '';
    const top = (m: MaliyetAy) => m.ic + m.dis + m.ted + m.diger;
    const enBuyuk = Math.max(...aylik.map(top), 1);
    const parca = (v: number, renk: string, ad: string, m: MaliyetAy) =>
        v <= 0 ? '' : `<div style="height:${(v / enBuyuk) * 100}%;background:${renk}"
            title="${esc(AYLAR[m.ay - 1])} ${esc(ad)}: ${esc(sayi(v))} TL"></div>`;
    const sutun = aylik.map(m => `<div style="flex:1;text-align:center;min-width:0">
        <div style="height:76px;display:flex;flex-direction:column-reverse;justify-content:flex-start">
          ${parca(m.ted, '#ef4444', 'tedarikçi', m)}
          ${parca(m.dis, '#f59e0b', 'dış', m)}
          ${parca(m.ic, '#3b82f6', 'iç', m)}
          ${parca(m.diger, '#9ca3af', 'diğer', m)}
        </div>
        <div style="font-size:8.5pt;color:#555;border-top:1px solid #ccc">${esc(AYLAR[m.ay - 1].slice(0, 3))}</div>
      </div>`).join('');
    const toplam = aylik.reduce((s, m) => s + top(m), 0);
    return `<div style="margin:6px 0 10px">
        <div style="font-size:9.5pt;font-weight:600;margin-bottom:2px">
          ${yil} kalite maliyeti (TL) — toplam ${esc(sayi(toplam))} TL</div>
        <div style="display:flex;gap:3px;align-items:flex-end">${sutun}</div>
        <div style="font-size:8pt;color:#888;margin-top:3px">
          <span style="color:#3b82f6">■</span> iç başarısızlık
          <span style="color:#f59e0b">■</span> dış başarısızlık
          <span style="color:#ef4444">■</span> tedarikçi
          <span style="color:#9ca3af">■</span> diğer
          · birim fiyatı bulunamayan kayıtlar maliyete girmez
        </div>
      </div>`;
};
