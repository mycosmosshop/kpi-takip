// MÜŞTERİ İade PPM — onaylı sistemdeki MÜŞTERİ kayıtlarından.
//
// Onaylı liste hem tedarikçileri hem müşterileri tutar (status alanı ayırır:
// ONAYLI / MÜŞTERİ). Müşteri satırlarında monthlySevk = bizim o müşteriye
// sevkimiz, monthlyIade = müşterinin iadesi. Müşteri İade PPM buradan gelir.
//
// TEDARİKÇİ değerlendirmesindeki "iade ppm" ile KARIŞTIRILMAMALI: o,
// tedarikçinin bize gönderdiği malın iadesidir. Aylık kalite raporunda
// müşteri satırına tedarikçi sayısı yazılıyordu — bu dosya onu ayırır.
import { sade } from './aylikKalite.ts';   // .ts uzantisi: testte Node --experimental-strip-types cozebilsin

export interface OnayliKayit {
    name?: string;
    status?: string;              // 'ONAYLI' | 'MÜŞTERİ'
    lokasyon?: string[];
    monthlySevk?: (number | null)[];
    monthlyIade?: (number | null)[];
}

export const musteriMi = (r: OnayliKayit): boolean => sade(r?.status || '') === 'MUSTERI';

// Lokasyon adı listede birebir tutulur ('Ankara', 'Çerkezköy'); Türkçe harf
// farkı yok sayılır. Boş lokasyonlu kayıt HİÇBİR lokasyona sayılmaz —
// "bilinmiyor"u bir lokasyona yazmak o lokasyonun PPM'ini bozar.
export const lokasyondaMi = (r: OnayliKayit, lokasyon: string): boolean => {
    const l = sade(lokasyon);
    if (!l) return false;
    return (r?.lokasyon || []).some(x => sade(x) === l);
};

export interface MusteriAy {
    sevk: number; iade: number; ppm: number | null;
    musteriSayisi: number;                     // o ay sevki olan müşteri sayısı
    iadeliler: { ad: string; iade: number }[]; // o ay iadesi olan müşteriler
}

// ay: 1-12. Sevk yoksa PPM null (0 değil): "iade yok" ile "sevk yok" ayrı şey.
export const musteriPpmAy = (
    kayitlar: OnayliKayit[], lokasyon: string, ay: number,
): MusteriAy => {
    const r: MusteriAy = { sevk: 0, iade: 0, ppm: null, musteriSayisi: 0, iadeliler: [] };
    (kayitlar || []).forEach(k => {
        if (!musteriMi(k) || !lokasyondaMi(k, lokasyon)) return;
        const s = Number((k.monthlySevk || [])[ay - 1]) || 0;
        const i = Number((k.monthlyIade || [])[ay - 1]) || 0;
        r.sevk += s; r.iade += i;
        if (s > 0) r.musteriSayisi++;
        if (i > 0) r.iadeliler.push({ ad: String(k.name || '(adsız)'), iade: i });
    });
    r.iadeliler.sort((a, b) => b.iade - a.iade);
    r.ppm = r.sevk > 0 ? Math.round((r.iade / r.sevk) * 1e6) : null;
    return r;
};

// Onaylı sistemin bulut anlık görüntüsündeki tam liste (tedarikçi + müşteri).
// supplier_sync.selectedSuppliers = uygulamanın allResults dizisi.
export const onayliListeCoz = (blob: any): OnayliKayit[] => {
    if (!blob) return [];
    let arr: any = blob.selectedSuppliers;
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = null; } }
    return Array.isArray(arr) ? arr as OnayliKayit[] : [];
};
