// Bir sonraki yılın hedef TAVSİYESİ.
//
// Kural (kullanıcı tanımı): hedef ile gerçekleşenin ortası alınır, üzerine
// %5 iyileştirme uygulanır. Ortalama alınmasının nedeni: gerçekleşeni
// doğrudan hedefe çevirmek, hedefin çok altında kalan KPI'da hedefi
// anlamsızca kolaylaştırır; hedefi aynen tutmak da iyileşmeyi ödüllendirmez.
import type { Kpi } from '../types';
import type { KarsilastirmaSatiri } from './yilKarsilastirma.ts';
import { AYLAR } from '../constants.ts';   // .ts uzantisi: testte Node --experimental-strip-types cozebilsin

export const IYILESTIRME = 0.05;   // %5

// Gösterimde ve atamada AYNI yuvarlama kullanılır; ekranda 6.413 görünüp
// tabloya 6412,5 yazılırsa hedef denetimde tutmaz.
export const yuvarla = (v: number): number =>
    Math.abs(v) >= 1000 ? Math.round(v) : Math.round(v * 100) / 100;

// gercek: KPI'nın BU yılki gerçekleşen ortalaması (kpi.ortalama).
// Veri yoksa tavsiye YOK — uydurulmuş hedef, hedef değildir.
export const tavsiyeHedef = (
    kpi: Kpi,
    gercek: number | null | undefined,
    oran: number = IYILESTIRME,
): number | null => {
    if (gercek === null || gercek === undefined) return null;
    const g = Number(gercek);
    const h = Number(kpi.yeni_yil_hedef);
    if (isNaN(g) || isNaN(h)) return null;
    // '=' hedefte iyileştirmenin yönü yok (ne büyümesi ne küçülmesi iyi);
    // yön uydurmak yerine tavsiye verilmez.
    const kucukIyi = kpi.karsilastirma === '<=' || kpi.karsilastirma === '<';
    const buyukIyi = kpi.karsilastirma === '>=' || kpi.karsilastirma === '>';
    if (!kucukIyi && !buyukIyi) return null;
    const orta = (h + g) / 2;
    return yuvarla(kucukIyi ? orta * (1 - oran) : orta * (1 + oran));
};

// Tavsiye sütunundan gerçekten atanacak hedefler. Kaldırılan KPI ve
// BOŞ bırakılan hücre atlanır — boşaltmak "bu KPI'ya dokunma" demektir.
// Virgüllü giriş (6.412,5) kabul edilir; Türkçe klavyede olağan.
export const atanacakHedefler = (
    satirlar: KarsilastirmaSatiri[],
    yazilan: (s: KarsilastirmaSatiri) => string,
): { [id: string]: number } => {
    const m: { [id: string]: number } = {};
    satirlar.forEach(s => {
        if (s.tip === 'kaldirildi') return;
        const t = (yazilan(s) || '').replace(',', '.').trim();
        if (t === '') return;
        const v = Number(t);
        if (!isNaN(v)) m[s.kpi.id] = v;
    });
    return m;
};

// Yeni yıla kopya: tanım alanları taşınır, DEĞERLER sıfırlanır.
// Bu yılın ortalaması yeni yılın "önceki yıl gerçekleşen" hücresine geçer.
export const sonrakiYilaKopya = (kpi: Kpi, hedef?: number | null): Kpi => ({
    id: kpi.id,
    proses: kpi.proses,
    kpi_adi: kpi.kpi_adi,
    kaynak: kpi.kaynak,                      // otomatik çekim ayarı yeni yılda da kalsın
    sorumlu: kpi.sorumlu,
    gozdenGecirmePeriyodu: kpi.gozdenGecirmePeriyodu,
    pasifAylar: kpi.pasifAylar,
    yeni_yil_hedef: (hedef === null || hedef === undefined) ? kpi.yeni_yil_hedef : hedef,
    karsilastirma: kpi.karsilastirma,
    hesap_metodu: kpi.hesap_metodu,
    formula: kpi.formula,
    birim: kpi.birim,
    aciklama: kpi.aciklama,
    kanit_dosyalari: kpi.kanit_dosyalari,
    risk: kpi.risk,

    onceki_yil_gerceklesen: kpi.ortalama,
    aylik: Object.fromEntries(AYLAR.map(ay => [ay, null])),
    dof: [],
    son_guncelleme: new Date().toLocaleString('tr-TR'),
    ortalama: null,
    durum: 'n/a',
});
