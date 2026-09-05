// YGG çıktısı: YENİ KALİTE HEDEFLERİ ve hedefi tutmayanlar için aksiyon.
//
// Tablo, YGG'de sorulan soruyu birebir cevaplar:
//   "önceki yıl ne gerçekleşti · bu yılın hedefi neydi · ne gerçekleşti ·
//    gelecek yılın hedefi ne olacak?"
// Yeni hedef, Yıl Karşılaştırma ekranındaki TAVSİYE FORMÜLÜNÜN AYNISIDIR
// (utils/hedefTavsiye). İkinci bir hesap, iki farklı "yeni hedef" doğururdu.
//
// Aksiyon önerileri YALNIZCA hedefi tutturamayan KPI'lar için üretilir ve
// kalite yönetiminin kendi araçlarıyla YAPILABİLİR işlerdir (analiz, plan
// revizyonu, DÖF, takip). Yatırım/işe alım gibi bu toplantıda karar
// verilemeyecek işler önerilmez — yapılamayacak aksiyon, aksiyon değildir.
import type { Kpi, MultiYearKpiData } from '../types';
import { karsilastir } from './yilKarsilastirma.ts';
import { tavsiyeDetay } from './hedefTavsiye.ts';
import { adGecer } from './aylikKalite.ts';

export interface HedefSatiri {
    kpi: Kpi;
    oncekiGercek: number | null;
    buHedef: number | null;
    buGercek: number | null;
    tuttu: boolean | null;      // veri yoksa null — "tutmadı" denmez
    yeniHedef: number | null;
    korundu: boolean;           // hesap gevşek çıktı, mevcut hedef korundu
    gerekce: string;
}

const sayi = (n: number | null | undefined): string =>
    (n === null || n === undefined || isNaN(Number(n))) ? '—'
        : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: Math.abs(Number(n)) >= 1000 ? 0 : 2 });

const esc = (t: any): string => String(t === null || t === undefined ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const tuttuMu = (k: Kpi, v: number | null): boolean | null => {
    if (v === null || v === undefined) return null;
    const h = Number(k.yeni_yil_hedef);
    if (isNaN(h)) return null;
    switch (k.karsilastirma) {
        case '<=': return v <= h;
        case '<': return v < h;
        case '>': return v > h;
        case '=': return v === h;
        default: return v >= h;
    }
};

export const hedefTablosu = (
    kpis: Kpi[], multiYearData: MultiYearKpiData, yil: number,
): HedefSatiri[] => {
    const karsi = karsilastir(kpis || [], multiYearData || {}, yil - 1);
    return karsi
        .filter(s => s.tip !== 'kaldirildi')   // bu yıl olmayan KPI'ya hedef verilmez
        .map(s => {
            const t = tavsiyeDetay(s.kpi, s.buGercek, s.gecenGercek);
            return {
                kpi: s.kpi,
                oncekiGercek: s.gecenGercek,
                buHedef: s.buHedef,
                buGercek: s.buGercek,
                tuttu: tuttuMu(s.kpi, s.buGercek),
                yeniHedef: t ? t.hedef : null,
                korundu: !!(t && t.korundu),
                gerekce: t ? t.aciklama
                    : (s.buGercek === null
                        ? `${yil} gerçekleşen değeri yok — yeni hedef önerilmedi`
                        : '“=” hedefte iyileştirme yönü yok — yeni hedef önerilmedi'),
            };
        });
};

export const hedefTabloHtml = (satirlar: HedefSatiri[], yil: number): string => {
    if (!satirlar.length) return '';
    const tr = satirlar.map(s => {
        const renk = s.tuttu === null ? '#9ca3af' : s.tuttu ? '#166534' : '#991b1b';
        return `<tr>
            <td style="padding:3px 6px;font-size:9.5pt">${esc(s.kpi.kpi_adi)}
              <span style="color:#888">(${esc(s.kpi.birim)})</span></td>
            <td style="padding:3px 6px;text-align:right;font-size:9.5pt">${esc(sayi(s.oncekiGercek))}</td>
            <td style="padding:3px 6px;text-align:right;font-size:9.5pt">${esc(sayi(s.buHedef))}</td>
            <td style="padding:3px 6px;text-align:right;font-size:9.5pt;color:${renk};font-weight:600">
              ${esc(sayi(s.buGercek))} ${s.tuttu === null ? '' : s.tuttu ? '✓' : '✗'}</td>
            <td style="padding:3px 6px;text-align:right;font-size:9.5pt;font-weight:700"
              title="${esc(s.gerekce)}">${esc(sayi(s.yeniHedef))}${s.korundu ? ' *' : ''}</td>
          </tr>`;
    }).join('');
    const korunan = satirlar.filter(s => s.korundu).length;
    return `<div style="margin:6px 0 10px">
        <div style="font-size:9.5pt;font-weight:600;margin-bottom:2px">
          ${yil + 1} yılı kalite hedefleri (öneri)</div>
        <table style="border-collapse:collapse;width:100%">
          <thead><tr style="background:#f4f6f8;font-size:9pt">
            <th style="padding:3px 6px;text-align:left">KPI</th>
            <th style="padding:3px 6px;text-align:right">${yil - 1} gerçekleşen</th>
            <th style="padding:3px 6px;text-align:right">${yil} hedef</th>
            <th style="padding:3px 6px;text-align:right">${yil} gerçekleşen</th>
            <th style="padding:3px 6px;text-align:right">${yil + 1} yeni hedef</th>
          </tr></thead>
          <tbody>${tr}</tbody>
        </table>
        <div style="font-size:8pt;color:#888;margin-top:3px">
          Yeni hedef = 0,5×${yil} gerçekleşen + 0,3×${yil} hedef + 0,2×${yil - 1} gerçekleşen,
          üzerine performansa göre %2–%9 iyileştirme; mevcut hedeften gevşek olamaz.
          ${korunan ? `* ${korunan} KPI'da hesap gevşek çıktığı için mevcut hedef korundu.` : ''}
        </div>
      </div>`;
};

// Hedefi tutturamayan KPI'lar için YAPILABİLİR aksiyon önerileri.
const AKSIYON: { anahtar: string[]; metin: string }[] = [
    {
        anahtar: ['ppm', 'hurda', 'fire', 'uygunsuzluk', 'iade'],
        metin: 'en çok hataya neden olan ilk 3 ürün/hata tipi için kök neden analizi (5N1K / balık kılçığı) '
            + 'yapılması, kontrol planı ve P-FMEA’nın buna göre revize edilmesi, etkinliğin aylık PPM takibiyle doğrulanması',
    },
    {
        anahtar: ['tedarikçi', 'tedarikci'],
        metin: 'hedefin altında kalan tedarikçilere DÖF açılması, gelişim planı ve termin takibi; '
            + 'tekrarlayan uygunsuzluklarda giriş kontrol planının sıkılaştırılması',
    },
    {
        anahtar: ['mttr', 'mtbf', 'arıza', 'bakım'],
        metin: 'arıza süresi/sıklığı yüksek makineler için periyodik bakım planının revize edilmesi, '
            + 'kritik yedek parça listesinin gözden geçirilmesi ve arıza kök neden kayıtlarının aylık değerlendirilmesi',
    },
    {
        anahtar: ['eğitim', 'polivalans'],
        metin: 'gerçekleşmeyen eğitimlerin yeniden planlanması, eğitim planının aylık takibi ve '
            + 'polivalans matrisinin güncellenmesi',
    },
    {
        anahtar: ['memnuniyet', 'şikayet', 'döf'],
        metin: 'açık DÖF’lerin kapatılması, şikayet kapama sürelerinin izlenmesi ve tekrar eden '
            + 'şikayet konularında kalıcı önlemin etkinliğinin doğrulanması',
    },
    {
        anahtar: ['termin', 'tamamlanma', 'sipariş'],
        metin: 'termin sapmasına yol açan sipariş/proses adımlarının analiz edilmesi ve planlama ile haftalık takip',
    },
    {
        anahtar: ['maliyet'],
        metin: 'en yüksek maliyetli uygunsuzluk kalemlerinin tek tek ele alınması ve tekrarını önleyecek '
            + 'düzeltici faaliyetlerin başlatılması',
    },
    {
        anahtar: ['denetim', 'tetkik'],
        metin: 'denetim bulgularının termine bağlanması ve kapatma etkinliğinin doğrulanması',
    },
    {
        anahtar: ['iş kazası', 'kaza', 'turnover', 'devamsızlık'],
        metin: 'kök neden değerlendirmesi yapılarak ilgili birimle önleyici faaliyet planlanması ve aylık izlenmesi',
    },
];

const VARSAYILAN = 'hedef sapmasının kök neden analizinin yapılması, düzeltici faaliyet planlanması '
    + 've aylık gözden geçirmede izlenmesi';

export const aksiyonMetni = (kpi: Kpi): string => {
    const bulunan = AKSIYON.find(a => adGecer(kpi.kpi_adi || '', a.anahtar));
    return bulunan ? bulunan.metin : VARSAYILAN;
};

export interface HedefAksiyon { konu: string; sorumlu: string; termin: string; durum: string; }

// Termin: gelecek yılın ilk çeyrek sonu — YGG'de alınan aksiyonların
// olağan takip dönemi. Kullanıcı değiştirebilir.
export const hedefAksiyonlari = (satirlar: HedefSatiri[], yil: number): HedefAksiyon[] =>
    satirlar
        .filter(s => s.tuttu === false)      // veri yoksa (null) aksiyon açılmaz
        .sort((a, b) => (b.buGercek ?? 0) - (a.buGercek ?? 0))
        .map(s => ({
            konu: `${s.kpi.kpi_adi}: ${yil} gerçekleşen ${sayi(s.buGercek)} ${s.kpi.birim} `
                + `(hedef ${sayi(s.buHedef)}) — ${aksiyonMetni(s.kpi)}. `
                + `${yil + 1} hedefi: ${sayi(s.yeniHedef)}.`,
            sorumlu: String(s.kpi.sorumlu || ''),   // yoksa BOŞ — isim uydurulmaz
            termin: `${yil + 1}-03-31`,
            durum: 'Planlandı',
        }));
