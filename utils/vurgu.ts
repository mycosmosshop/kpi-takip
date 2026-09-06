// Arama vurgusu: aranan metnin GEÇTİĞİ YERLERİ parçalara ayırır.
//
// Neden ayrı bir katlayıcı: aylikKalite'deki sade() trim() yapıyor. Trim,
// baştaki boşluk kadar indeks kaydırır ve vurgu YANLIŞ harfin üzerine düşer.
// Burada uzunluk 1:1 korunmalı, o yüzden trim yok.
const TR: { [k: string]: string } = {
    'Ç': 'C', 'Ö': 'O', 'Ü': 'U', 'İ': 'I', 'I': 'I', 'Ş': 'S', 'Ğ': 'G',
};

// 'İç PPM' ile 'iç ppm' eşleşsin. JS'in /i bayrağı Türkçe İ'yi katlamaz.
export const katla = (x: string): string =>
    String(x || '').toLocaleUpperCase('tr').replace(/[ÇÖÜİIŞĞ]/g, c => TR[c]);

export interface VurguParca {
    metin: string;
    vurgulu: boolean;
}

// "Toplam İade PPM" + "iade" → [{Toplam }, {İade|vurgulu}, { PPM}]
export const vurguParcala = (metin: string, aranan: string): VurguParca[] => {
    const m = String(metin ?? '');
    const q = String(aranan ?? '').trim();
    if (!q || !m) return [{ metin: m, vurgulu: false }];

    const km = katla(m), kq = katla(q);
    // Katlama harf sayısını değiştirdiyse (ör. 'ß' → 'SS') indeksler ham
    // metinde geçersizdir; yanlış yeri sarıya boyamaktansa hiç boyama.
    if (km.length !== m.length || kq.length !== q.length) {
        return [{ metin: m, vurgulu: false }];
    }

    const parcalar: VurguParca[] = [];
    let i = 0;
    while (i <= m.length) {
        const j = km.indexOf(kq, i);
        if (j < 0) {
            if (i < m.length) parcalar.push({ metin: m.slice(i), vurgulu: false });
            break;
        }
        if (j > i) parcalar.push({ metin: m.slice(i, j), vurgulu: false });
        parcalar.push({ metin: m.slice(j, j + q.length), vurgulu: true });
        i = j + q.length;
    }
    return parcalar;
};

// Aranan metin içeride geçiyor mu? (vurgulanacak alanı sarıya boyamak için)
export const vurguVar = (metin: string, aranan: string): boolean => {
    const q = String(aranan ?? '').trim();
    return !!q && katla(String(metin ?? '')).indexOf(katla(q)) >= 0;
};
