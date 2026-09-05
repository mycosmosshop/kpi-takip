// Lokasyon kadrosu: YGG katılımcıları ve rapor sorumluları.
// E-posta adresleri UYDURULMAMIŞTIR: Outlook'taki gerçek yazışmalardan
// çıkarılmış, birden fazla adresi olanlarda en son kullanılan seçilmiştir.
// Adresi bilinmeyen kişide alan BOŞ bırakılır (yanlış adrese YGG maili gitmesin).
import { sade } from './aylikKalite.ts';

export interface Kisi { ad: string; gorev: string; eposta: string }

/** Lokasyon adı veya id → kadro anahtarı. Ultech1/Ultech2 tek kadroyu paylaşır. */
export const kadroAnahtari = (lokasyon: string): string => {
    const s = sade(lokasyon).toLowerCase();   // sade() BÜYÜK harfe çevirir
    if (s.indexOf('ultech') === 0) return 'ultech';
    if (s.indexOf('cerkezkoy') >= 0) return 'cerkezkoy';
    if (s.indexOf('velikoy') >= 0) return 'velikoy';
    if (s.indexOf('eskisehir') >= 0) return 'eskisehir';
    if (s.indexOf('ankara') >= 0) return 'ankara';
    if (s.indexOf('bursa') >= 0) return 'bursa';
    if (s.indexOf('adana') >= 0) return 'adana';
    if (s.indexOf('adapazari') >= 0) return 'adapazari';
    return s;
};

const KALITE: Record<string, Kisi> = {
    ankara: { ad: 'Emre Biçer', gorev: 'Kalite Mühendisi', eposta: 'emre.bicer@sanifoam.com.tr' },
    cerkezkoy: { ad: 'Umut Çiftçioğulları', gorev: 'Kalite Mühendisi', eposta: 'umut.ciftciogullari@sanifoam.com.tr' },
    eskisehir: { ad: 'Ayşegül Ekiz', gorev: 'Kalite Mühendisi', eposta: 'aysegul.ekiz@sanifoam.com.tr' },
    bursa: { ad: 'Sedatcan Vüdül', gorev: 'Kalite Mühendisi', eposta: 'sedatcan.vudul@sanifoam.com.tr' },
    adana: { ad: 'Şevin Yılmaz', gorev: 'Kalite Mühendisi', eposta: 'sevin.yilmaz@sanifoam.com.tr' },
    // Bu ikisinin adresi yazışmalarda bulunamadı; uygulamadan doldurulabilir.
    velikoy: { ad: 'Kazım Karışan', gorev: 'Kalite Mühendisi', eposta: '' },
    ultech: { ad: 'Kıymet Toker', gorev: 'Kalite Mühendisi', eposta: '' },
};

const FABRIKA_MUDURU: Record<string, Kisi> = {
    ankara: { ad: 'Mete Yılmaz', gorev: 'Fabrika Müdürü', eposta: 'mete.yilmaz@sanifoam.com.tr' },
    cerkezkoy: { ad: 'Ünal Ürkmez', gorev: 'Fabrika Müdürü', eposta: 'unal.urkmez@sanifoam.com.tr' },
    velikoy: { ad: 'Şendoğan Kalaycı', gorev: 'Fabrika Müdürü', eposta: 'sendogan.kalayci@sanifoam.com.tr' },
    eskisehir: { ad: 'Türker Peker', gorev: 'Fabrika Müdürü', eposta: 'turker.peker@sanifoam.com.tr' },
    bursa: { ad: 'Aydilek Özyurt', gorev: 'Fabrika Müdürü', eposta: 'aydilek.ozyurt@sanifoam.com.tr' },
    adana: { ad: 'Umut Sağır', gorev: 'Fabrika Müdürü', eposta: 'umut.sagir@sanifoam.com.tr' },
    ultech: { ad: 'Umut Sağır', gorev: 'Fabrika Müdürü', eposta: 'umut.sagir@sanifoam.com.tr' },
};

/** Her lokasyonun YGG'sine katılanlar. */
const HERKESE: Kisi[] = [
    { ad: 'Yıldırım Ulkat', gorev: 'Yönetim Kurulu Başkanı', eposta: 'yildirim.ulkat@sanifoam.com.tr' },
    { ad: 'Emrah Eryılmaz', gorev: 'Genel Müdür', eposta: 'emrah.eryilmaz@sanifoam.com.tr' },
    { ad: 'Ünal Ürkmez', gorev: 'Üretim Koordinatörü', eposta: 'unal.urkmez@sanifoam.com.tr' },
    { ad: 'Kutlay Altıparmak', gorev: 'Satın Alma Müdürü', eposta: 'kutlay.altiparmak@sanifoam.com.tr' },
];

/** Ar-Ge Müdürü Ultech dışındaki lokasyonlara katılır. */
const ARGE: Kisi = { ad: 'Sinem Kaya', gorev: 'Ar-Ge Müdürü', eposta: 'sinem.kaya@sanifoam.com.tr' };

const SEMIH: Kisi = { ad: 'Semih Anar', gorev: 'Satış Müdürü', eposta: 'semih.anar@sanifoam.com.tr' };
const ENDER: Kisi = {
    ad: 'Ender Zaimoğlu', gorev: 'Genel Müdür Yrd. / Satış Pazarlama',
    eposta: 'ender.zaimoglu@sanifoam.com.tr',
};

const LOKASYON_EK: Record<string, Kisi[]> = {
    velikoy: [
        { ad: 'Gül Ulkat', gorev: 'Genel Müdür Yardımcısı', eposta: 'gulkat@sanifoam.com.tr' },
        { ad: 'Elif Güzel', gorev: 'Satış Müdürü', eposta: 'elif.guzel@sanifoam.com.tr' },
        { ad: 'Gözde Ulkat', gorev: 'Satış Yöneticisi', eposta: 'gozdeulkat@sanifoam.com.tr' },
    ],
    eskisehir: [SEMIH, ENDER],
    adana: [SEMIH],
    ultech: [SEMIH],
    cerkezkoy: [ENDER],
    ankara: [ENDER],
};

/** Raporlarda aksiyon sorumlusu olarak yazılacak ad. Kadroda yoksa eski
 *  genel ifade kalır — uydurma isim yazılmaz. */
export const kaliteSorumlusu = (lokasyon: string): string => {
    const k = KALITE[kadroAnahtari(lokasyon)];
    return k ? k.ad : 'Lokasyon Kalite Mühendisi';
};

export const kaliteSorumlusuKisi = (lokasyon: string): Kisi | null =>
    KALITE[kadroAnahtari(lokasyon)] || null;

/** YGG katılımcı listesi. Aynı kişi iki görevdeyse (ör. Çerkezköy'de Ünal
 *  Ürkmez hem fabrika müdürü hem üretim koordinatörü) tek satırda birleşir. */
export const yggKatilimcilari = (lokasyon: string): Kisi[] => {
    const a = kadroAnahtari(lokasyon);
    const liste: Kisi[] = [];
    const ekle = (k?: Kisi) => {
        if (!k) return;
        const ayni = liste.find(x => sade(x.ad) === sade(k.ad));
        if (!ayni) { liste.push({ ...k }); return; }
        if (ayni.gorev.indexOf(k.gorev) < 0) ayni.gorev += ' / ' + k.gorev;
        if (!ayni.eposta) ayni.eposta = k.eposta;
    };
    ekle(FABRIKA_MUDURU[a]);
    ekle(KALITE[a]);
    HERKESE.forEach(ekle);
    if (a !== 'ultech') ekle(ARGE);
    (LOKASYON_EK[a] || []).forEach(ekle);
    return liste;
};
