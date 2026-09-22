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
interface OneriSeti {
    gecici: string[];
    kalici: string[];
    onleme: string[];
    /** 5 Neden zincirinin 2. halkasindan sonrasi; ilk halka veriden gelir. */
    neden: string[];
    /** Ekrandaki "Kök Neden" kutulari; bos kalirsa 5N yarim gorunuyor. */
    kokNeden?: string;
    kacisKokNeden?: string;
}

const ONERILER: Record<string, OneriSeti> = {
    ariza: {
        gecici: [
            'Sapmanın görüldüğü dönemde arıza veren ekipmanların kritik parçaları için acil stok kontrolü yapıldı; eksikler için sipariş açıldı.',
            'Malzeme beklediği için duran planlı bakım iş emirleri önceliklendirildi.',
            'Plansız duruşlar günlük vardiya toplantısında izlenmeye alındı.',
            'Arıza veren ekipmanlarda vardiya başı operatör kontrolü başlatıldı.',
        ],
        kalici: [
            'Dönem arıza kayıtlarının makine ve arıza tipine göre Pareto analizi; en çok tekrarlayan üç arızanın belirlenmesi',
            'Kritik yedek parça listesinin ekipman envanteriyle karşılaştırılarak güncellenmesi (revizyonlar, yeni makineler, muadil parçalar)',
            'Kritik parçalarda min–max stok seviyelerinin arıza sıklığına ve tedarik süresine göre belirlenmesi',
            'Yedek parça listesinin gözden geçirilmesi için periyot ve sorumlu tanımlanması; ekipman değişikliğinde güncelleme zorunlu hâle getirilmesi',
            'Malzeme bekleyen bakım iş emirleri için haftalık eskalasyon; planlı bakım tamamlanma oranına aylık alt sınır',
            'Tekrarlayan arızalarda periyodik bakım talimatının ve bakım periyodunun güncellenmesi',
        ],
        onleme: [
            'Kritik yedek parça listesinin bakım prosedürüne bağlanması: periyodik gözden geçirme, sorumlu ve kayıt tanımlı.',
            'Yeni ekipman devreye alma kontrol listesine "kritik yedek parça listesi güncellendi" maddesinin eklenmesi.',
            'Kritik parça stok bulunurluğunun ve planlı bakım tamamlanma oranının KPI olarak izlenmesi.',
            'CMMS kayıtlarında arıza tipinin ve "malzeme bekliyor" durumunun zorunlu alan yapılması — Pareto ve eskalasyon bu veri olmadan yapılamıyor.',
        ],
        neden: [
            'Arızalar önlenemeden oluştu: bakım işleri ağırlıkla arıza sonrası (plansız) yürüdü, '
                + 'önleyici bakım payı düştü. [CMMS iş emri dağılımından doğrulanacak]',
            'Planlı bakım iş emirleri zamanında kapatılamadı; gereken kritik yedek parça stokta '
                + 'bulunamadığı için işler beklemeye alındı. '
                + '[Bekleyen iş emirlerinin malzeme durumundan doğrulanacak]',
            'Kritik yedek parça listesi güncel değil: ekipman revizyonları, yeni makineler ve '
                + 'muadil parçalar listeye işlenmemiş, min–max stok seviyeleri arıza sıklığına ve '
                + 'tedarik süresine göre gözden geçirilmemiş. [Liste ile ekipman envanteri '
                + 'karşılaştırılarak doğrulanacak]',
        ],
        kokNeden: 'Kritik yedek parça listesinin güncellenmesi için tanımlı bir periyot ve sorumlu '
            + 'yok; liste ilk kurulumda oluşturulmuş, ekipman değişikliklerinde güncellenmiyor. '
            + '[Yukarıdaki halkalar doğrulandıktan sonra kesinleşir]',
        kacisKokNeden: 'Malzeme bekleyen bakım iş emirleri için eskalasyon ve erken uyarı '
            + 'tanımlı değil; sapma ancak ay kapanışında görülüyor. '
            + '[Doğrulandıktan sonra kesinleşir]',
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
        neden: [
            'Uygunsuzluk üretim sırasında oluştu ve proses içinde yakalanamadı. '
                + '[Hata tipi ve oluştuğu proses adımı uygunsuzluk kayıtlarından belirlenecek]',
            '[Proses adımında ne değişti? Malzeme, ayar, ekipman, operatör ya da yöntem '
                + 'değişikliği incelenecek]',
            '[Bir önceki nedenin kaynağı yazılacak]',
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
        neden: [
            'Uygunsuz malzeme tedarikçi tarafında oluştu ve giriş kontrolünde yakalanamadı. '
                + '[Hangi tedarikçi ve hangi parti olduğu kayıtlardan belirlenecek]',
            '[Tedarikçinin prosesinde ne değişti? 8D talebiyle doğrulanacak]',
            '[Bir önceki nedenin kaynağı yazılacak]',
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
        neden: [
            '[Dönem içinde süreçte ne değişti? Kayıtlar incelenerek yazılacak]',
            '[Bir önceki nedenin kaynağı yazılacak]',
            '[Bir önceki nedenin kaynağı yazılacak]',
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
    occurrenceRootCause: string;
    nonDetectionRootCause: string;
    uygulamaDogrulama: string;
    geciciOnlemler: string;
    kaliciAksiyonlar: { id: string; action: string; responsible: string; dueDate: string;
                        status: string; linkedRootCauses: string[] }[];
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
export function dofTaslagi(kpi: Kpi, ay: string, yil: number, kardes: Kpi[] = [],
                           kacisDahil = false): TaslakSonuc | null {
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

    // 5 Neden: ilk kaydin `why` alani PROBLEM CUMLESI, her kaydin
    // `because` alani o halkanin cevabi. Sonraki `why` degerlerini bilesen
    // onceki cevaptan turetir; oraya yer tutucu yazilirsa ekranda "[bir
    // onceki cevabin nedeni]" diye gorunur.
    const yi = (s: string) => `${s}-${Math.random().toString(36).slice(2, 8)}`;
    const o0 = oneriSeti(kpi);
    const zincir = (onek: string, problem: string, cevaplar: string[]) =>
        cevaplar.map((c, n) => ({
            id: yi(onek),
            why: n === 0 ? problem : cevaplar[n - 1],
            because: c,
        }));

    // Ilk halka VERIDEN: ay icinde olcunun ne kadar degistigi ve —
    // biliniyorsa — sapmanin hangi bilesende olmadigi.
    // "Arizalar arasi sure" tipi bir metrikte sure yariya inmek, ayni
    // calisma suresinde ariza sayisinin iki katina cikmasi demektir; bu
    // cikarim ilk halkayi olgu tekrarindan gercek bir nedensellik
    // adimina cevirir.
    const arizaArasi = o0 === ONERILER.ariza && !yon.includes('<')
        && /mtbf|mttf|arizalar arasi|arızalar aras/i.test(kpi.kpi_adi || '');
    const kat = digerOrt !== null && deger !== 0 ? digerOrt / deger : null;
    const ilkCevap = digerOrt === null
        ? `${ay} ayında ölçüm hedefin dışına çıktı.`
        : (arizaArasi && kat !== null
            ? `Aynı çalışma süresinde arıza sayısı arttı: ${ay} ayında arızalar arası süre `
              + `${biz(deger)}${b}, öteki ${oteki.length} ayın ortalaması ${biz(digerOrt)}${b} — `
              + `yani arıza adedi ortalama aya göre yaklaşık ${biz(kat)} katı. `
              + 'Sapma tek aya özgü olduğuna göre o ay içinde bir şey değişti.'
            : `${ay} ayında ölçüm, öteki ${oteki.length} ayın ortalamasından (${biz(digerOrt)}${b}) `
              + `belirgin biçimde ayrıldı (%${biz(deger / digerOrt * 100)} düzeyi). `
              + 'Sapma tek aya özgü olduğuna göre o ay içinde bir şey değişti.');

    const occurrence = zincir('why-occ',
        `${kpi.kpi_adi} ${ay} ${yil} döneminde ${biz(deger)}${b} ölçüldü; hedef ${yonIsareti(yon)} ${biz(hedef)}${b}.`,
        [ilkCevap, ...o0.neden]);

    // Kacis (saptanamama) zinciri ISTEGE BAGLI: her 8D'de gerekmiyor ve
    // istenmedigi halde uretilince raporda yarisi yer tutucu bir bolum
    // duruyordu.
    const nonDetection = !kacisDahil ? [] : zincir('why-nd',
        `${ay} ayındaki sapma ay kapanana kadar fark edilmedi.`,
        [
            `${kpi.kpi_adi} ${String(kpi.gozdenGecirmePeriyodu || 'aylık').toLocaleLowerCase('tr')} `
                + 'periyotta raporlanıyor; dönem içinde eşik ya da erken uyarı ölçütü tanımlı değil.',
            '[Dönem içi izleme neden yok? KPI tanımında yalnız bu periyot var; '
                + 'ara takip görevlendirilmemiş olabilir]',
            '[Bir önceki nedenin kaynağı yazılacak]',
        ]);

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
    // Her aksiyon, kapattigi KOK NEDENE baglanir. Bos birakilinca
    // raporun "İlgili Kök Neden(ler)" sutunu hep "Girilmemiş" cikiyor ve
    // aksiyonun neyi kapattigi gorunmuyordu.
    // Aksiyona baglanan metinde "[… doğrulandıktan sonra kesinleşir]" gibi
    // notlar olmaz: D5 tablosunda kok neden HER SATIRDA tekrarlaniyor,
    // notu da yanina alinca sutun okunmaz oluyordu. Not, D4'teki kok neden
    // alaninda duruyor.
    const kokNedenMetni = String(o.kokNeden || '').replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    const kaliciAksiyonlar = o.kalici.map(x => ({
        id: yi('action'),
        action: x,
        responsible: String(kpi.sorumlu || ''),
        dueDate: '',
        status: 'Açık',
        linkedRootCauses: kokNedenMetni ? [kokNedenMetni] : [],
    }));

    const takdir = `Kapanış, D5 aksiyonlarının tamamlanması ve ${kpi.kpi_adi} değerinin `
        + `üst üste üç ay ${yonIsareti(yon)} ${biz(hedef)}${b} kalmasıyla yapılacaktır. `
        + 'Katkısı olan ekip üyeleri burada belirtilir.';

    return {
        problemTanimi: satir.join('\n'),
        occurrence, nonDetection,
        occurrenceRootCause: o0.kokNeden
            || '[Zincirin son halkası doğrulandıktan sonra yazılacak]',
        nonDetectionRootCause: !kacisDahil ? ''
            : (o0.kacisKokNeden || '[Dönem içi izlemenin neden tanımlı olmadığı yazılacak]'),
        uygulamaDogrulama: dogrulama,
        geciciOnlemler: gecici,
        kaliciAksiyonlar,
        tekrarinOnlenmesi: onleme,
        takdir,
        ozet: { deger, hedef, digerOrt, altAylar },
    };
}
