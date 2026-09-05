// Yıl karşılaştırmasının saf mantığı: eşleştirme, sapma, hedef yönü.
// Bileşenden ayrı, çünkü asıl doğrulanması gereken kısım bu.
import type { Kpi, MultiYearKpiData, Status } from '../types';
import { calculateAverage, determineStatus } from './calculations.ts';   // .ts uzantisi: Node --experimental-strip-types ile testte cozulebilsin

export interface KarsilastirmaSatiri {
    kpi: Kpi;
    gecenHedef: number | null;
    gecenGercek: number | null;
    gecenDurum: Status | null;
    buHedef: number;
    yazanOnceki: number | null;
    varMi: boolean;
}

// Yıllar arasında eşleştirme anahtarı. id ile eşleşme önce denenir;
// yeni yıla kopyalarken yeni id üretildiği için proses+ad yedeği şart.
export const kpiAnahtari = (k: Kpi): string =>
    (k.proses || '').trim().toLocaleLowerCase('tr') + '|' +
    (k.kpi_adi || '').trim().toLocaleLowerCase('tr');

export const karsilastir = (
    kpis: Kpi[],
    multiYearData: MultiYearKpiData,
    oncekiYil: number,
): KarsilastirmaSatiri[] => {
    const gecen = multiYearData[oncekiYil]?.kpis || [];
    const idIle = new Map(gecen.map(k => [k.id, k]));
    const adIle = new Map(gecen.map(k => [kpiAnahtari(k), k]));
    return (kpis || []).map(k => {
        const g = idIle.get(k.id) || adIle.get(kpiAnahtari(k));
        // Geçen yılın gerçekleşeni o yılın KENDİ aylık verisinden gelir.
        // Tablodaki "Önceki Yıl" hücresi elle girilir; onu doğrulamak için
        // ayrı tutuluyor (yazanOnceki), kaynak olarak kullanılmıyor.
        const gercek = g ? calculateAverage(g) : null;
        return {
            kpi: k,
            gecenHedef: g ? g.yeni_yil_hedef : null,
            gecenGercek: gercek,
            gecenDurum: g ? determineStatus(g, gercek) : null,
            buHedef: k.yeni_yil_hedef,
            yazanOnceki: k.onceki_yil_gerceklesen,
            varMi: !!g,
        };
    });
};

// "Önceki Yıl" hücresi geçen yılın gerçek ortalamasıyla tutuyor mu?
// Yuvarlama payı bırakılır, yoksa neredeyse her satır sapmalı görünür.
export const sapmaVar = (s: KarsilastirmaSatiri): boolean => {
    // varMi ayrica denetlenmiyor: kayit yoksa gecenGercek zaten null.
    if (s.gecenGercek === null || s.yazanOnceki === null) return false;
    return Math.abs(s.gecenGercek - s.yazanOnceki)
        > Math.max(0.01, Math.abs(s.gecenGercek) * 0.01);
};

// Hedef sıkılaştı mı gevşedi mi? KARŞILAŞTIRMA YÖNÜNE bağlı: PPM'de (≤)
// hedefin küçülmesi sıkılaşma, ciroda (≥) büyümesi sıkılaşmadır.
export const hedefDegisimi = (
    s: KarsilastirmaSatiri,
): { fark: number | null; yuzde: number | null; sikilasti: boolean | null } => {
    if (s.gecenHedef === null || s.gecenHedef === s.buHedef) {
        return { fark: s.gecenHedef === null ? null : 0, yuzde: null, sikilasti: null };
    }
    const fark = s.buHedef - s.gecenHedef;
    const kucukIyi = s.kpi.karsilastirma === '<=' || s.kpi.karsilastirma === '<';
    return {
        fark,
        yuzde: s.gecenHedef !== 0 ? (fark / Math.abs(s.gecenHedef)) * 100 : null,
        sikilasti: kucukIyi ? fark < 0 : fark > 0,
    };
};
