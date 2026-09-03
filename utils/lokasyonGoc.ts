import type { KpiLocation } from '../types';

/**
 * Yeni varsayılan lokasyonların mevcut listeye BİR KEZ eklenmesi.
 *
 * Lokasyonlar localStorage'da (`kpi_locations_v1`) ve bulutta tutulur;
 * DEFAULT_LOCATIONS yalnızca ilk açılışta kullanılır. Bu yüzden yeni bir
 * lokasyon eklemek, mevcut kullanıcılarda tek başına görünmez.
 *
 * TUZAK: "eksik olan bütün varsayılanları ekle" demek, kullanıcının
 * bilerek SİLDİĞİ lokasyonu geri getirir. Bu yüzden her yeni lokasyonun
 * kendi bayrağı vardır ve yalnızca bayrak ilk kez işlenirken eklenir;
 * sonradan silinirse bir daha gelmez.
 */
export interface YeniLokasyon {
    bayrak: string;
    loc: KpiLocation;
}

export interface GocSonucu {
    liste: KpiLocation[];
    eklenen: KpiLocation[];
    islenenBayraklar: string[];
}

export function lokasyonGocUygula(
    mevcut: KpiLocation[],
    yeniler: YeniLokasyon[],
    bayrakIslendi: (bayrak: string) => boolean,
): GocSonucu {
    const liste = Array.isArray(mevcut) ? [...mevcut] : [];
    const eklenen: KpiLocation[] = [];
    const islenenBayraklar: string[] = [];

    for (const y of yeniler) {
        if (bayrakIslendi(y.bayrak)) continue;      // daha önce işlendi: dokunma
        islenenBayraklar.push(y.bayrak);
        // Zaten varsa (kullanıcı elle eklemiş olabilir) kopyalama
        if (liste.some(l => l.id === y.loc.id)) continue;
        liste.push({ ...y.loc });
        eklenen.push({ ...y.loc });
    }
    return { liste, eklenen, islenenBayraklar };
}
