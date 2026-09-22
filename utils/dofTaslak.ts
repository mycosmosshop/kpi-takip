// KPI verisinden 8D taslağı.
//
// Bir KPI ayı hedefin dışına çıktığında D2 (problem tanımı), D4 (5 neden) ve
// D6 (doğrulama) metinleri elle yazılıyordu; sapmanın büyüklüğü, yılın geri
// kalanıyla kıyası ve aynı prosesteki öteki KPI'ların o aydaki durumu her
// seferinde tekrar hesaplanıyordu. Bu üretici o hesabı KPI'ın KENDİ
// verisinden yapar — ek ağ çağrısı yok, uydurma sayı yok.
//
// Doldurulmayan yer bilerek boş bırakılır: kök nedeni veri değil ekip
// belirler. Taslak, gerekçesi sorulduğunda izlenebilsin diye hangi sayıya
// dayandığını yazar.

import { AYLAR } from '../constants';
import type { Kpi } from '../types';

const sayi = (x: any): number | null =>
    (x === null || x === undefined || x === '') ? null
        : (Number.isFinite(Number(x)) ? Number(x) : null);

/** Karşılaştırma işareti okunur biçimde. */
const yonIsareti = (k: string): string =>
    String(k).includes('<') ? '\u2264' : '\u2265';

const biz = (x: number): string =>
    Math.abs(x) >= 100 ? String(Math.round(x))
        : (Math.round(x * 100) / 100).toLocaleString('tr-TR');

/** Hedef sağlanıyor mu? karsilastirma '>=' ise büyük olan iyidir. */
function hedefTutuyor(deger: number, hedef: number, karsilastirma: string): boolean {
    return String(karsilastirma).includes('<') ? deger <= hedef : deger >= hedef;
}

// Aksiyon metinleri veriden turetilemez; KPI'in konusuna gore standart
// bir baslangic listesi yazilir, ekip uzerinde oynar. Konu, kaynak
// metriginden ya da KPI adindan anlasilir.
interface OneriSeti { gecici: string[]; kalici: string[]; onleme: string[]; }

const ONERILER: Record<string, OneriSeti> = {
    ariza: {
        gecici: [
            'Sapmanın görüldüğü dönemde arıza veren ekipmanlarda vardiya başı operatör kontrolü başlatıldı.',
            'Plansız duruşlar günlük vardiya toplantısında izlenmeye alındı.',
            'Tekrarlayan arızalarda kritik yedek parça bulunurluğu teyit edildi.',
        ],
        kalici: [
            'Dönem arıza kayıtlarının makine ve arıza tipine göre Pareto analizi; en çok tekrarlayan üç arızanın belirlenmesi',
            'Planlı bakım tamamlanma oranı için aylık alt sınır tanımlanması ve gecikmiş iş emirlerinin eskalasyonu',
            'Tekrarlayan arızalarda periyodik bakım talimatının ve bakım periyodunun güncellenmesi',
            'Plansız duruş ve arıza sayısının haftalık izlenmesi (aylık kapanış beklenmeden)',
        ],
        onleme: [
            'Planlı bakım tamamlanma oranının KPI olarak izlenmesi (alt sınır tanımlı).',
            'Bakım talimatlarının ve bakım periyotlarının güncellenmesi, ilgili personele duyurulması.',
            'CMMS kayıtlarında arıza tipinin zorunlu alan yapılması — Pareto analizi bu veri olmadan yapılamıyor.',
        ],
    },
    kalite: {
        gecici: [
            'Sapmanın görüldüğü dönemin stoğu ve sevk edilmiş ürünleri için %100 ayıklama/kontrol uygulandı.',
            'Uygunsuz ürünler karantinaya alındı ve etiketlendi.',
            'Müşteri tarafında risk varsa bilgilendirme yapıldı.',
        ],
        kalici: [
            'Uygunsuzlukların hata tipi ve proses adımına göre Pareto analizi',
            'Kontrol planı ve PFMEA gözden geçirilmesi; tespit yönteminin güçlendirilmesi',
            'Operatör talimatlarının güncellenmesi ve ilgili personele eğitim',
            'Etkilenen karakteristikte proses yeterliliğinin (Cp/Cpk) doğrulanması',
        ],
        onleme: [
            'Kontrol planı ve PFMEA güncellemesinin benzer ürün ailelerine yayılması.',
            'Katmanlı proses denetimi kapsamına ilgili proses adımının eklenmesi.',
            'Eğitim kayıtlarının ve yetkinlik matrisinin güncellenmesi.',
        ],
    },
    tedarikci: {
        gecici: [
            'Etkilenen tedarikçinin sevkiyatlarında giriş kontrolü sıklaştırıldı.',
            'Mevcut stok için ayıklama yapıldı.',
        ],
        kalici: [
            'Tedarikçiden 8D talep edilmesi ve kök neden doğrulaması',
            'Tedarikçi performans kriterlerinin ve termin takibinin gözden geçirilmesi',
            'Gerekirse tedarikçi sahasında süreç denetimi planlanması',
        ],
        onleme: [
            'Tedarikçi değerlendirme kriterlerinin ve giriş kontrol planının güncellenmesi.',
            'Onaylı tedarikçi listesinin gözden geçirilmesi.',
        ],
    },
    varsayilan: {
        gecici: [
            'Sapmanın sürmesini engellemek için ilgili süreçte ek kontrol uygulandı.',
            'Sapma ilgili proses sahibine bildirildi ve izlemeye alındı.',
        ],
        kalici: [
            'Sapmanın oluştuğu dönemdeki kayıtların ayrıntılı incelenmesi ve kök nedenin doğrulanması',
            'Süreç talimatının/akışının gözden geçirilerek güncellenmesi',
            'Ölçüm ve raporlama sıklığının artırılması',
        ],
        onleme: [
            'Güncellenen talimatın ilgili personele duyurulması ve eğitim kaydının alınması.',
            'Benzer süreçlerde aynı riskin taranması.',
        ],
    },
};

function oneriSeti(kpi: Kpi): OneriSeti {
    const metin = `${kpi.kaynak?.metric || ''} ${kpi.kpi_adi || ''} ${kpi.proses || ''}`
        .toLocaleLowerCase('tr');
    if (/mtbf|mttr|mttf|ariza|arıza|bakım|bakim|duruş|durus/.test(metin)) return ONERILER.ariza;
    if (/tedarik|supplier|iade ppm|td_/.test(metin)) return ONERILER.tedarikci;
    if (/ppm|uygunsuz|hurda|fire|şikayet|sikayet|kalite|muayene/.test(metin)) return ONERILER.kalite;
    return ONERILER.varsayilan;
}

export interface TaslakSonuc {
    problemTanimi: string;
    occurrence: { id: string; why: string; because: string }[];
    nonDetection: { id: string; why: string; because: string }[];
    uygulamaDogrulama: string;
    geciciOnlemler: string;
    kaliciAksiyonlar: { id: string; action: string; responsible: string; dueDate: string; status: string }[];
    tekrarinOnlenmesi: string;
    takdir: string;
    /** Taslağın dayandığı sayılar — ekranda özet göstermek için. */
    ozet: { deger: number; hedef: number; digerOrt: number | null; altAylar: string[] };
}

/**
 * @param kpi      sapmanın görüldüğü KPI
 * @param ay       'Haziran' gibi
 * @param yil      KPI yılı
 * @param kardes   aynı prosesteki öteki KPI'lar (bağlam için; boş geçilebilir)
 */
export function dofTaslagi(kpi: Kpi, ay: string, yil: number, kardes: Kpi[] = []): TaslakSonuc | null {
    const deger = sayi(kpi?.aylik?.[ay]);
    const hedef = sayi(kpi?.yeni_yil_hedef);
    if (deger === null || hedef === null) return null;

    const yon = String(kpi.karsilastirma || '>=');
    const birim = String(kpi.birim || '').trim();
    const b = birim ? ' ' + birim : '';

    // Yılın geri kalanı: o ay HARİÇ, ölçülmüş aylar
    const oteki = AYLAR.filter(a => a !== ay)
        .map(a => ({ a, v: sayi(kpi.aylik?.[a]) }))
        .filter(x => x.v !== null) as { a: string; v: number }[];
    const digerOrt = oteki.length ? oteki.reduce((t, x) => t + x.v, 0) / oteki.length : null;
    const altAylar = AYLAR.filter(a => {
        const v = sayi(kpi.aylik?.[a]);
        return v !== null && !hedefTutuyor(v, hedef, yon);
    });

    const sapmaYuzde = hedef !== 0 ? Math.abs(deger - hedef) / Math.abs(hedef) * 100 : 0;
    const gerceklesenPay = hedef !== 0 ? deger / hedef * 100 : 0;

    const satir: string[] = [];
    // Turkce ek ("%43,2'si" / "%56,8'i") sayinin okunusuna gore degisiyor;
    // uretilen sayida dogru eki secmek guvenilir degil, ek gerektirmeyen
    // kalip kullanilir.
    satir.push(`${kpi.kpi_adi} ${ay} ${yil} döneminde ${biz(deger)}${b} ölçüldü; `
        + `KPI hedefi ${yonIsareti(yon)} ${biz(hedef)}${b}. `
        + `Hedefe göre sapma %${biz(sapmaYuzde)}; gerçekleşme hedefin %${biz(gerceklesenPay)} düzeyinde.`);
    satir.push('');
    satir.push('5N1K:');
    satir.push(`- NE: ${kpi.kpi_adi} hedefin dışında (${biz(deger)}${b} / hedef ${biz(hedef)}${b}).`);
    satir.push(`- NEREDE: ${kpi.kaynak?.location || '[lokasyon]'} · ${kpi.proses}.`);
    satir.push(`- NE ZAMAN: ${ay} ${yil} dönemi.`
        + (altAylar.length === 1 ? ' Yılın hedef dışına çıkan tek ayıdır.'
            : altAylar.length > 1 ? ` Hedef dışına çıkan aylar: ${altAylar.join(', ')}.` : ''));
    if (digerOrt !== null) {
        const pay = digerOrt !== 0 ? deger / digerOrt * 100 : 0;
        satir.push(`- NE KADAR: Ölçülmüş öteki ${oteki.length} ayın ortalaması ${biz(digerOrt)}${b}; `
            + `${ay} bu ortalamanın %${biz(pay)} düzeyinde.`);
    } else {
        satir.push('- NE KADAR: Kıyaslanacak başka aylık ölçüm bulunmuyor.');
    }
    satir.push('- KİM: Aylık KPI gözden geçirmesinde tespit edildi.');
    satir.push(`- NASIL: KPI Takip aylık kaydı${kpi.kaynak ? ` (kaynak: ${kpi.kaynak.type} · ${kpi.kaynak.metric})` : ''}.`);

    // Aynı prosesteki öteki KPI'lar o ay ne durumda? Sapmanın yalnız bu
    // KPI'da mı olduğunu görmek kök nedeni daraltır.
    const baglam = kardes
        .filter(k => k.id !== kpi.id && sayi(k.aylik?.[ay]) !== null && sayi(k.yeni_yil_hedef) !== null)
        .map(k => {
            const v = sayi(k.aylik?.[ay]) as number;
            const h = sayi(k.yeni_yil_hedef) as number;
            const ok = hedefTutuyor(v, h, String(k.karsilastirma || '>='));
            return `  · ${k.kpi_adi}: ${biz(v)}${k.birim ? ' ' + k.birim : ''} `
                + `(hedef ${yonIsareti(String(k.karsilastirma || '>='))} ${biz(h)}) — ${ok ? 'hedef içinde' : 'HEDEF DIŞI'}`;
        });
    if (baglam.length) {
        satir.push('');
        satir.push(`Aynı proseste ${ay} ayı:`);
        satir.push(...baglam);
    }

    const yi = (s: string) => `${s}-${Math.random().toString(36).slice(2, 8)}`;
    const occurrence = [
        { id: yi('why-occ'), why: `${kpi.kpi_adi} ${ay} ayında neden ${biz(deger)}${b} oldu?`,
          because: digerOrt !== null
            ? `Ölçülen değer, öteki ${oteki.length} ayın ortalamasına (${biz(digerOrt)}${b}) göre `
              + `%${biz(digerOrt !== 0 ? deger / digerOrt * 100 : 0)} düzeyinde. `
              + '[ay içinde ne değiştiği yazılacak]'
            : '[doldurulacak]' },
        { id: yi('why-occ'), why: '[bir önceki cevabın nedeni]', because: '[doldurulacak]' },
        { id: yi('why-occ'), why: '[bir önceki cevabın nedeni]', because: '[doldurulacak]' },
    ];
    const nonDetection = [
        { id: yi('why-nd'), why: 'Sapma neden ay kapanmadan fark edilmedi?',
          because: `${kpi.kpi_adi} ${kpi.gozdenGecirmePeriyodu || 'aylık'} periyotta raporlanıyor; `
            + 'ay içinde erken uyarı ölçütü tanımlı değil.' },
        { id: yi('why-nd'), why: '[bir önceki cevabın nedeni]', because: '[doldurulacak]' },
    ];

    // D6: sapmadan SONRAKI aylar hedefi tutuyor mu?
    const i = AYLAR.indexOf(ay);
    const sonraki = AYLAR.slice(i + 1)
        .map(a => ({ a, v: sayi(kpi.aylik?.[a]) }))
        .filter(x => x.v !== null) as { a: string; v: number }[];
    const tutan = sonraki.filter(x => hedefTutuyor(x.v, hedef, yon));
    let dogrulama: string;
    if (!sonraki.length) {
        dogrulama = `Doğrulama ölçütü: ${kpi.kpi_adi} üst üste üç ay ${yonIsareti(yon)} ${biz(hedef)}${b} kalmalı. `
            + `${ay} sonrası için henüz ölçüm girilmemiştir.`;
    } else {
        dogrulama = `${ay} sonrası ölçümler: `
            + sonraki.map(x => `${x.a} ${biz(x.v)}${b}`).join(', ') + '. '
            + `${sonraki.length} ayın ${tutan.length} tanesi hedefi tutmaktadır. `
            + `Doğrulama ölçütü: üst üste üç ay ${yonIsareti(yon)} ${biz(hedef)}${b}.`;
    }

    // D3 / D5 / D7: konuya gore standart baslangic listesi. "Öneri"
    // diye isaretlenir — yapilmis gibi gorunmesin, ekip onaylayip
    // gerceklesen metinle degistirsin.
    const o = oneriSeti(kpi);
    const gecici = ['Öneri — ekip onayladıktan sonra fiilen uygulanan önlemle değiştirilecek:', '']
        .concat(o.gecici.map(x => '- ' + x)).join('\n');
    const onleme = ['Öneri:', ''].concat(o.onleme.map(x => '- ' + x)).join('\n');

    // Aksiyon terminleri DÖF terminine dogru kademelenir; termin yoksa bos
    // birakilir (uydurma tarih yazilmaz).
    const kaliciAksiyonlar = o.kalici.map((x, n) => ({
        id: yi('action'),
        action: x,
        responsible: String(kpi.sorumlu || ''),
        dueDate: '',
        status: 'Açık',
        _sira: n,
    })).map(({ _sira, ...r }) => r);

    const takdir = `Kapanış, D5 aksiyonlarının tamamlanması ve ${kpi.kpi_adi} değerinin `
        + `üst üste üç ay ${yonIsareti(yon)} ${biz(hedef)}${b} kalmasıyla yapılacaktır. `
        + 'Katkısı olan ekip üyeleri burada belirtilir.';

    return {
        problemTanimi: satir.join('\n'),
        occurrence, nonDetection,
        uygulamaDogrulama: dogrulama,
        geciciOnlemler: gecici,
        kaliciAksiyonlar,
        tekrarinOnlenmesi: onleme,
        takdir,
        ozet: { deger, hedef, digerOrt, altAylar },
    };
}
