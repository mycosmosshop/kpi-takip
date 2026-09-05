// YGG (Yönetimin Gözden Geçirmesi) — ISO 9001 md. 9.3 + IATF 16949 md. 9.3.2.1
// yapısında, LOKASYON BAZINDA rapor.
//
// Her bölüm üç parçadan oluşur:
//   otomatik : uygulamadaki canlı veriden üretilir (KPI, DÖF, aksiyon, yıl
//              karşılaştırma). Salt okunur, her açılışta günceldir.
//   metin    : standart YGG metniyle DOLU gelir, kullanıcı düzenler/siler.
//   aksiyonlar: konu + sorumlu + termin + durum satırları.
//
// Otomatik kısım veriden GELMEYEN hiçbir şey uydurmaz. Standart metin ise
// firmanın YGG şablonundan gelir; kullanıcı üzerine yazana kadar taslaktır.
import type { Kpi, ActionItem, MultiYearKpiData, Dof } from '../types';
import { karsilastir, hedefDegisimi } from './yilKarsilastirma.ts';
import { bolumGrafikHtml, maliyetGrafikHtml } from './yggGrafik.ts';
import type { MaliyetAy } from './yggGrafik.ts';   // type: Node strip-types deger sanmasin
// adGecer: Türkçe İ/ı katlayan ad araması. Regex'in /i bayrağı "İç PPM"i
// bulamıyor ('İ'.toUpperCase() !== 'I') — aynı tuzak aylık raporda iki satırı
// yanlış KPI'ya bağlamıştı.
import { adGecer, tipEslesir, yerEslesir } from './aylikKalite.ts';
import { hedefTablosu, hedefTabloHtml, hedefAksiyonlari } from './yggHedef.ts';
import type { MaliyetSatir } from './kaliteMaliyet.ts';

export interface YggAksiyon {
    id: string; konu: string; sorumlu: string; termin: string; durum: string;
}

export interface YggBolum {
    id: string;
    madde: string;          // "9.3.2 c) 2" gibi
    baslik: string;
    otomatik: string[];     // canlı veriden (salt okunur)
    varsayilanMetin: string;// standart YGG metni (düzenlenebilir taslak)
    grafik?: string;        // maddeye ait grafik (HTML; canlı, KAYDEDİLMEZ)
    oneriler?: YggAksiyon[];// ÖNERİLEN aksiyonlar (kullanıcı onaylayıp ekler)
    sabit: boolean;         // standart madde mi (silinse de geri gelmez, işaretlenir)
}

export interface YggKatilimci {
    id: string; ad: string; gorev: string; eposta: string;
}

// Eski kayıtlarda katılımcılar tek metin alanıydı ("Ali Veli, Ayşe Yılmaz").
// Satır/virgül/noktalı virgülden ayrılır; varsa "Ad <a@b.c>" biçiminden
// e-posta ayıklanır. Göç yapılmazsa eski toplantıların katılımcıları
// ekrandan SİLİNMİŞ gibi görünürdü.
export const katilimciCoz = (metin: string): YggKatilimci[] =>
    String(metin || '')
        .split(/[;,\n]/)
        .map(x => x.trim())
        .filter(x => x.length > 0)
        .map((x, i) => {
            const m = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(x);
            const ad = x.replace(/[<>]/g, ' ').replace(m ? m[0] : '', '').trim();
            return {
                id: 'k_' + i + '_' + Math.random().toString(36).slice(2, 7),
                ad: ad || (m ? m[0] : x),
                gorev: '',
                eposta: m ? m[0] : '',
            };
        });

// Kullanıcının kaydettiği hâl
export interface YggKayitBolum {
    id: string; madde: string; baslik: string; metin: string;
    aksiyonlar: YggAksiyon[]; silindi?: boolean; eklenen?: boolean;
}

const yuzde = (a: number, b: number): string =>
    b > 0 ? (a / b * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%' : '—';

const sayi = (n: number | null | undefined): string =>
    (n === null || n === undefined || isNaN(Number(n))) ? '—'
        : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: Math.abs(Number(n)) >= 1000 ? 0 : 2 });

const durumSay = (kpis: Kpi[]) => ({
    toplam: kpis.length,
    basarili: kpis.filter(k => k.durum === 'basarili').length,
    marjinal: kpis.filter(k => k.durum === 'marjinal').length,
    basarisiz: kpis.filter(k => k.durum === 'basarisiz').length,
    na: kpis.filter(k => !k.durum || k.durum === 'n/a').length,
});

export const yggBolumleri = (
    lokasyon: string,
    yil: number,
    kpis: Kpi[],
    aksiyonlar: ActionItem[],
    multiYearData: MultiYearKpiData,
    maliyet?: MaliyetSatir[],
): YggBolum[] => {
    const d = durumSay(kpis);
    const basarisizlar = kpis.filter(k => k.durum === 'basarisiz');
    const marjinaller = kpis.filter(k => k.durum === 'marjinal');
    const tumDof: { kpi: Kpi; dof: Dof }[] = [];
    kpis.forEach(k => (k.dof || []).forEach(x => tumDof.push({ kpi: k, dof: x })));
    const acikDof = tumDof.filter(x => x.dof.durum !== 'Tamamlandı');

    const prosesler = new Map<string, Kpi[]>();
    kpis.forEach(k => {
        const p = k.proses || '—';
        if (!prosesler.has(p)) prosesler.set(p, []);
        prosesler.get(p)!.push(k);
    });

    const karsi = karsilastir(kpis, multiYearData, yil - 1);
    const gecenVar = karsi.filter(s => s.varMi);
    const sikilasan = karsi.filter(s => hedefDegisimi(s).sikilasti === true);
    const gevseyen = karsi.filter(s => hedefDegisimi(s).sikilasti === false);

    const bitenAks = aksiyonlar.filter(a => a.done);
    const gecikenAks = aksiyonlar.filter(a => !a.done && a.due && a.due < new Date().toISOString().slice(0, 10));

    const kpiAra = (kelimeler: string[]) =>
        kpis.filter(k => adGecer(k.kpi_adi || '', kelimeler));
    const kpiSatir = (k: Kpi) => `${k.kpi_adi}: ${sayi(k.ortalama)} ${k.birim} `
        + `(hedef ${sayi(k.yeni_yil_hedef)}) — `
        + (k.durum === 'basarili' ? 'hedefte' : k.durum === 'marjinal' ? 'marjinal' : 'hedef dışı');

    const B = (id: string, madde: string, baslik: string,
        otomatik: string[], varsayilanMetin: string, grafik?: string,
        oneriler?: YggAksiyon[]): YggBolum =>
        ({ id, madde, baslik, otomatik, varsayilanMetin, grafik, oneriler, sabit: true });

    // Yeni yıl hedefleri: Yıl Karşılaştırma ekranıyla AYNI formül.
    const hedefler = hedefTablosu(kpis, multiYearData, yil);
    const tutmayanlar = hedefler.filter(h => h.tuttu === false);
    const hedefAks = hedefAksiyonlari(hedefler, yil).map((a, i) => ({
        id: 'oneri_' + i, konu: a.konu, sorumlu: a.sorumlu, termin: a.termin, durum: a.durum,
    }));

    // Maddeye ait KPI kümeleri (grafikler bunlardan çizilir)
    // DİKKAT: 'iade ppm' kelimesi burada ARANMAZ. Türkçe katlamayla
    // "Toplam İade PPM" de eşleşirdi; o KPI MÜŞTERİ iade PPM'idir,
    // tedarikçi performansı maddesine yazılması yanlış olurdu.
    const tedKpi = kpis.filter(k => k.kaynak?.type === 'tedarikci'
        || adGecer(k.kpi_adi || '', ['tedarik']));
    const bakimKpi = kpis.filter(k => k.kaynak?.type === 'cmms'
        || adGecer(k.kpi_adi || '', ['mttr', 'mtbf', 'arıza', 'bakım']));
    // MÜŞTERİ memnuniyeti maddesine PERSONEL memnuniyeti karışmamalı:
    // "memnuniyet" kelimesi ikisinde de geçiyor; personel anketi insan
    // kaynağı maddesine (9.3.2 d) aittir.
    const memnuniyetKpi = kpis.filter(k => adGecer(k.kpi_adi || '', ['memnuniyet', 'şikayet'])
        && !adGecer(k.kpi_adi || '', ['personel', 'çalışan']));
    const egitimKpi = kpis.filter(k => k.kaynak?.type === 'egitim'
        || adGecer(k.kpi_adi || '', ['eğitim', 'polivalans', 'devamsızlık', 'turnover',
            'personel memnuniyet', 'çalışan memnuniyet', 'iş kazası']));
    const uygunlukKpi = kpiAra(['ppm', 'hurda', 'iade', 'fire', 'uygunsuzluk']);
    const verimlilikKpi = kpiAra(['verimlilik', 'oee', 'kapasite', 'doluluk', 'fire']);
    const maliyetKpi = kpiAra(['maliyet', 'kalitesizlik', 'hurda']);

    // Kalite maliyeti: lokasyonun bu yılki aylık TL'si (kaynak: egt_ayar)
    const maliyetAylik: MaliyetAy[] = [];
    let maliyetToplam = 0, maliyetIc = 0, maliyetDis = 0, maliyetTed = 0, maliyetEslesmeyen = 0;
    let maliyetFAy = 0, maliyetFAy2 = 0, maliyetFYakin = 0;
    if (maliyet && maliyet.length) {
        for (let a = 1; a <= 12; a++) {
            const m: MaliyetAy = { ay: a, ic: 0, dis: 0, ted: 0, diger: 0 };
            let varMi = false;
            maliyet.forEach(r => {
                if (Number(r.yil) !== yil || Number(r.ay) !== a) return;
                if (!yerEslesir(r.yer || '', lokasyon)) return;
                varMi = true;
                const t = Number(r.tutar) || 0;
                if (tipEslesir(r.tip || '', 'ic')) m.ic += t;
                else if (tipEslesir(r.tip || '', 'dis')) m.dis += t;
                else if (tipEslesir(r.tip || '', 'ted')) m.ted += t;
                else m.diger += t;
                maliyetEslesmeyen += Number(r.eslesmeyen) || 0;
                maliyetFAy += Number(r.fAy) || 0;
                maliyetFAy2 += Number(r.fAy2) || 0;
                maliyetFYakin += Number(r.fYakin) || 0;
            });
            if (varMi) maliyetAylik.push(m);
            maliyetIc += m.ic; maliyetDis += m.dis; maliyetTed += m.ted;
            maliyetToplam += m.ic + m.dis + m.ted + m.diger;
        }
    }

    const L = lokasyon;
    return [
        B('gundem', 'Gündem', 'Toplantı gündem maddeleri',
            [],
            `YGG TOPLANTI GİRDİLERİ\n`
            + `a) Önceki yönetim incelemelerinden alınan eylemlerin durumu\n`
            + `b) Kalite yönetim sistemi ile ilgili iç ve dış konulardaki değişiklikler; `
            + `bilimsel ve teknolojik gelişmelerin takibi\n`
            + `c) KYS'nin performansı ve etkinliği hakkında bilgi (eğilimler dâhil):\n`
            + `   1) İlgili taraflardan müşteri memnuniyeti ve geri bildirim\n`
            + `   2) Kalite hedeflerinin ne ölçüde karşılandığı (FR100 ve yeni hedefler)\n`
            + `   3) Süreç performansı ile ürün ve hizmetlerin uygunluğu (ürün güvenliği)\n`
            + `   4) Uygunsuzluklar ve düzeltici faaliyetler (ürün güvenliği uygunsuzlukları)\n`
            + `   5) İzleme ve ölçüm sonuçları\n`
            + `   6) İç ve dış denetim sonuçları\n`
            + `   7) Dış sağlayıcıların (tedarikçi) performansı\n`
            + `d) Kaynakların yeterliliği (ürün güvenliği için gereken kaynaklar dâhil)\n`
            + `e) Risk ve fırsatlar için alınan önlemlerin etkinliği (md. 6.1); acil durum `
            + `planları (yangın, enerji kesintisi, tedarik kesintisi vb.)\n`
            + `f) İyileştirme fırsatları (FR100'de yeni hedefler, kaynak terminleri)\n\n`
            + `TAMAMLAYICI GİRDİLER (IATF 16949 md. 9.3.2.1)\n`
            + `a) Düşük kalite maliyeti (dahili ve harici uygunsuzluk maliyeti, bütçeye oranı)\n`
            + `b) Süreç etkinliğinin ölçümü (FR100 / FR001)\n`
            + `c) Proses verimliliği ölçümleri\n`
            + `d) Ürün uygunluğu (şikayetlerin ürün güvenliğine etkisi)\n`
            + `e) Operasyon değişiklikleri ve imalat fizibilite değerlendirmeleri (md. 7.1.3.1)\n`
            + `f) Müşteri memnuniyeti (ISO 9001 md. 9.1.2) ve müşteri DÖF durumu\n`
            + `g) Bakım hedeflerine göre performans (MTTR / MTBF)\n`
            + `h) Garanti performansı (varsa) — garanti sağlamamaktayız\n`
            + `i) Müşteri puan kartlarının gözden geçirilmesi (varsa)\n`
            + `j) Risk analizi (HTEA/FMEA) ile tanımlanan potansiyel saha arızaları\n`
            + `k) Gerçek saha arızaları ve güvenlik üzerindeki etkileri\n\n`
            + `EK: Ürün güvenliği ve yanmazlık (yanma) testleri (md. 4.4.1.2), kalite `
            + `politikasının uygunluğu\n\n`
            + `YGG ÇIKTILARI\n`
            + `a) İyileştirme fırsatları (FR100/FR001'de yeni hedefler, kaynak terminleri)\n`
            + `b) Kalite yönetim sisteminde değişiklik ihtiyacı\n`
            + `c) Kaynak ihtiyaçları`),

        B('girdi_a', '9.3.2 a)', 'Önceki yönetim incelemelerinden alınan eylemlerin durumu',
            aksiyonlar.length === 0
                ? ['Aksiyonlar ekranında bu lokasyon/yıl için kayıt yok.']
                : [
                    `Toplam ${aksiyonlar.length} aksiyon; ${bitenAks.length} tamamlandı `
                    + `(${yuzde(bitenAks.length, aksiyonlar.length)}), ${aksiyonlar.length - bitenAks.length} devam ediyor.`,
                    ...(gecikenAks.length
                        ? [`Termini geçmiş ${gecikenAks.length} aksiyon: `
                            + gecikenAks.slice(0, 8).map(a => `${a.action || a.kpi} (${a.owner || 'sorumlu yok'}, ${a.due})`).join('; ')
                            + (gecikenAks.length > 8 ? ` … ve ${gecikenAks.length - 8} tane daha` : '')]
                        : ['Termini geçmiş aksiyon yok.']),
                ],
            `${yil - 1} yılı Yönetimin Gözden Geçirmesi toplantısında ${L} lokasyonu için planlanan `
            + `aksiyonların ${yil} yılı itibarıyla durumu gözden geçirilmiştir. Tamamlanan eylemler `
            + `kapatılmış, devam edenler için terminler güncellenmiştir. Kapanmayan maddeler bu `
            + `dönemin aksiyon listesine aktarılmıştır.`),

        B('girdi_b', '9.3.2 b)', 'KYS ile ilgili iç ve dış konulardaki değişiklikler',
            [],
            `İç ve dış hususlar gözden geçirildi. ${L} lokasyonunda kalite yönetim sistemini `
            + `etkileyen organizasyonel değişiklikler, sertifikasyon durumu, yasal ve mevzuat `
            + `şartlarındaki değişiklikler ile müşteri özel gereksinimlerindeki (CSR) güncellemeler `
            + `değerlendirilmiştir. Bir kısım müşterimizin özel gereksinimi doğrultusunda `
            + `BİLİMSEL VE TEKNOLOJİK GELİŞMELER de dış husus olarak izlenmektedir: sektörel `
            + `standart ve yönetmelik güncellemeleri (yanmazlık, VOC/koku, geri dönüştürülebilirlik), `
            + `hammadde ve proses teknolojilerindeki yenilikler, ölçüm/test tekniklerindeki `
            + `gelişmeler, dijitalleşme ve otomasyon uygulamaları ile üniversite/lab ve tedarikçi `
            + `kaynaklı Ar-Ge çalışmaları takip edilmiş; ürün ve proseslerimize etkisi olabilecek `
            + `gelişmeler iyileştirme fırsatı olarak (md. 9.3.2 f) değerlendirmeye alınmıştır. `
            + `Sistemi olumsuz etkileyen bir değişiklik tespit edilmemiştir.`),

        B('girdi_c1', '9.3.2 c) 1', 'İlgili taraflardan müşteri memnuniyeti ve geri bildirim',
            (() => {
                return memnuniyetKpi.length ? memnuniyetKpi.map(kpiSatir) : [];
            })(),
            `Paydaş ve müşteri geri bildirimleri gözden geçirildi. ${L} lokasyonuna ait müşteri `
            + `memnuniyet anketleri, portal puanları ve geri bildirimler değerlendirilmiş; `
            + `memnuniyetsizlik bildirilen konular için düzeltici faaliyet başlatılmıştır.`,
            bolumGrafikHtml(memnuniyetKpi, yil, 'Müşteri memnuniyeti / şikayet KPI’ları')),

        B('girdi_c2', '9.3.2 c) 2', 'Kalite hedeflerinin ne ölçüde karşılandığı',
            [
                `${yil} yılı ${L} lokasyonunda ${d.toplam} KPI izlendi: `
                + `${d.basarili} başarılı (${yuzde(d.basarili, d.toplam)}), `
                + `${d.marjinal} marjinal, ${d.basarisiz} başarısız`
                + (d.na ? `, ${d.na} değerlendirilemedi (veri yok)` : '') + '.',
                ...(basarisizlar.length
                    ? ['Hedefi tutturamayan KPI’lar: '
                        + basarisizlar.map(k => `${k.kpi_adi} (ort. ${sayi(k.ortalama)} / hedef ${sayi(k.yeni_yil_hedef)} ${k.birim})`).join('; ')]
                    : ['Hedefi tutturamayan KPI yok.']),
                ...(marjinaller.length ? ['Marjinal KPI’lar: ' + marjinaller.map(k => k.kpi_adi).join('; ')] : []),
            ],
            `Kalite hedeflerine ulaşabilme durumu FR100 KPI takip formu üzerinden gözden geçirildi; `
            + `hedefi tutturamayan KPI’lar için kök neden analizi yapılarak aksiyon planı `
            + `oluşturulmuş, ${yil + 1} dönemi için yeni hedefler belirlenmiştir.`),

        B('girdi_c3', '9.3.2 c) 3', 'Süreç performansı ve ürün/hizmetlerin uygunluğu',
            Array.from(prosesler.entries()).map(([p, list]) => {
                const s = durumSay(list);
                return `${p}: ${s.toplam} KPI — ${s.basarili} başarılı (${yuzde(s.basarili, s.toplam)})`
                    + (s.basarisiz ? `, ${s.basarisiz} başarısız` : '')
                    + (s.marjinal ? `, ${s.marjinal} marjinal` : '');
            }),
            `Süreç performansı ile ürün ve hizmetlerin uygunluğu, ürün güvenliği kapsamında `
            + `değerlendirilmiştir. Proses bazlı KPI sonuçları, kontrol planlarına uygunluk ve `
            + `ürün doğrulama kayıtları gözden geçirilmiş; uygunsuzluk tespit edilen proseslerde `
            + `düzeltici faaliyet başlatılmıştır.`),

        B('girdi_c4', '9.3.2 c) 4', 'Uygunsuzluklar ve düzeltici faaliyetler',
            tumDof.length === 0
                ? ['KPI Takip’te bu lokasyon/yıl için kayıtlı DÖF yok.']
                : [
                    `Toplam ${tumDof.length} DÖF açıldı; ${acikDof.length} tanesi hâlâ açık.`,
                    ...acikDof.slice(0, 10).map(x =>
                        `Açık DÖF — ${x.kpi.kpi_adi}: ${x.dof.problemTanimi || '(problem tanımı girilmemiş)'} `
                        + `(sorumlu: ${x.dof.sorumlu || '—'}, termin: ${x.dof.due_date || '—'}, %${x.dof.ilerleme || 0})`),
                    ...(acikDof.length > 10 ? [`… ve ${acikDof.length - 10} açık DÖF daha.`] : []),
                ],
            `Uygunsuzluk analizleri ve düzeltici faaliyetler 8D metodolojisi ile gözden geçirildi. `
            + `İç ve dış kaynaklı uygunsuzluklar, kök neden analizleri ve kalıcı aksiyonların `
            + `etkinliği değerlendirilmiştir. Ürün güvenliği ile ilgili uygunsuzluklar ayrıca `
            + `ele alınmış, tekrar eden uygunsuzluklar için sistemsel önlem alınmıştır.`),

        B('girdi_c5', '9.3.2 c) 5', 'İzleme ve ölçüm sonuçları',
            [],
            `İzleme ve ölçüm sonuçları gözden geçirildi. ${L} lokasyonundaki ölçüm cihazlarının `
            + `kalibrasyon durumu, ölçüm sistemi analizleri (MSA) ve proses izleme kayıtları `
            + `değerlendirilmiş; kalibrasyon planına uygunluk teyit edilmiştir.`),

        B('girdi_c6', '9.3.2 c) 6', 'Denetim sonuçları',
            [],
            `İç ve dış denetim sonuçları gözden geçirildi. ${L} lokasyonunda gerçekleştirilen iç `
            + `tetkikler, müşteri denetimleri ve belgelendirme denetimlerinde tespit edilen `
            + `bulgular ile bunlara ait düzeltici faaliyetlerin kapanış durumu değerlendirilmiştir.`),

        B('girdi_c7', '9.3.2 c) 7', 'Dış sağlayıcıların (tedarikçi) performansı',
            (() => {
                return tedKpi.length ? tedKpi.map(kpiSatir) : [];
            })(),
            `Tedarikçi performansları gözden geçirildi. Onaylı Tedarikçi Değerlendirme sistemi `
            + `üzerinden tedarikçi puanları, iade PPM ve termin performansları değerlendirilmiş; `
            + `hedefin altında kalan tedarikçilere düzeltici faaliyet talebi açılmış ve gelişim `
            + `planı oluşturulmuştur.`,
            bolumGrafikHtml(tedKpi, yil, 'Onaylı tedarikçi performans KPI’ları')),

        B('girdi_d', '9.3.2 d)', 'Kaynakların yeterliliği',
            [],
            `Kaynaklar konusu gözden geçirilmiş ve terminler planlanmıştır. ${L} lokasyonunda `
            + `insan kaynağı, yetkinlik ve eğitim durumu, makine/teçhizat kapasitesi, altyapı ve `
            + `çalışma ortamı değerlendirilmiştir. Ürün güvenliğinin sağlanması için gereken `
            + `kaynaklar (yetkin personel, ölçüm/test altyapısı, yanmazlık testleri için `
            + `dış laboratuvar hizmeti dâhil) ayrıca ele alınmış; kaynaklar yeterli bulunmuştur.`,
            bolumGrafikHtml(egitimKpi, yil, 'İnsan kaynağı / eğitim KPI’ları')),

        B('girdi_e', '9.3.2 e)', 'Risk ve fırsatlar için alınan önlemlerin etkinliği (md. 6.1)',
            [],
            `Risk ve fırsatlar gözden geçirildi. Ürün güvenliği risklerinin ve fırsatlarının ele `
            + `alınması, acil durum planları (yangın, enerji kesintisi, tedarik kesintisi, siber `
            + `olay vb.) kapsamında risklerin değerlendirilmesi ve alınan önlemlerin etkinliğinin `
            + `gözden geçirilmesi yapılmıştır. Risk analizleri güncel olup alınan önlemler etkin `
            + `bulunmuştur.`),

        B('girdi_f', '9.3.2 f)', 'İyileştirme fırsatları',
            karsi.length === 0 ? [] : [
                gecenVar.length
                    ? `${yil - 1} ile karşılaştırma: ${gecenVar.length} KPI’nın önceki yıl kaydı var; `
                      + `${sikilasan.length} hedef sıkılaştırıldı, ${gevseyen.length} hedef gevşetildi.`
                    : `${yil - 1} yılına ait KPI kaydı bulunamadı — hedef değişimi karşılaştırılamadı.`,
                ...(sikilasan.length
                    ? ['Sıkılaştırılan hedefler: '
                        + sikilasan.slice(0, 10).map(s => `${s.kpi.kpi_adi} (${sayi(s.gecenHedef)} → ${sayi(s.buHedef)})`).join('; ')]
                    : []),
            ],
            `İyileştirme için FR100 KPI takip formunda ${yil + 1} dönemi yeni hedefleri `
            + `belirlenmiştir. Kaynaklarla ilgili terminler planlanmış, iyileştirme projeleri `
            + `sorumlu ve termin bazında aşağıdaki aksiyon tablosuna işlenmiştir. İzlenen `
            + `bilimsel ve teknolojik gelişmeler (md. 9.3.2 b) iyileştirme fırsatı olarak `
            + `değerlendirilmiş; uygulanabilir bulunanlar için fizibilite ve deneme planı `
            + `oluşturulmuştur.`),

        // ── IATF 16949 md. 9.3.2.1 — tamamlayıcı girdiler ──
        B('iatf_a', '9.3.2.1 a)', 'Düşük kalite maliyeti (dahili ve harici uygunsuzluk maliyeti)',
            [
                ...(maliyetAylik.length
                    ? [`${yil} kalite maliyeti (uygunsuzluk × birim fiyat): `
                        + `toplam ${sayi(maliyetToplam)} TL — iç ${sayi(maliyetIc)} TL, `
                        + `dış ${sayi(maliyetDis)} TL, tedarikçi ${sayi(maliyetTed)} TL.`,
                       `Birim fiyat kaynağı: ${maliyetFAy} kayıt o ayın alım/satış fiyatı`
                       + (maliyetFAy2 ? `, ${maliyetFAy2} kayıt aynı ay farklı hareket cinsi` : '')
                       + (maliyetFYakin ? `, ${maliyetFYakin} kayıt en yakın ay fiyatı (tahmini)` : '') + '.',
                       ...(maliyetEslesmeyen
                           ? [`${maliyetEslesmeyen} uygunsuzluk kaydının birim fiyatı bulunamadığı `
                              + `için maliyete katılmamıştır (tutar bu kadar eksiktir).`]
                           : [])]
                    : ['Kalite maliyeti verisi çekilmemiş (LeanSys ajanı /kmaliyet).']),
                ...maliyetKpi.map(kpiSatir),
            ],
            `İç ve dış kalite maliyetleri gözden geçirilmiştir. İç başarısızlık (hurda, yeniden `
            + `işleme, fire) ve dış başarısızlık (iade, müşteri şikayeti, nakliye) maliyetleri `
            + `uygunsuzluk kayıtlarının birim fiyatlarla değerlenmesiyle hesaplanmış, bütçeye/ciroya `
            + `oranı değerlendirilmiş; FR100 ve FR001 formlarına işlenmiştir.`,
            maliyetGrafikHtml(maliyetAylik, yil)),

        B('iatf_b', '9.3.2.1 b)', 'Süreç etkinliğinin ölçümü',
            Array.from(prosesler.entries()).map(([p, list]) => {
                const s = durumSay(list);
                const oran = s.toplam ? s.basarili / s.toplam : 0;
                return `${p}: etkinlik ${yuzde(s.basarili, s.toplam)} — `
                    + (oran >= 0.85 ? 'YÜKSEK' : oran >= 0.6 ? 'ORTA' : 'GELİŞTİRİLMELİ');
            }),
            `Süreçlerin etkinliği ve KPI hedeflerine ulaşma durumu gözden geçirilmiştir. FR100 ve `
            + `FR001 üzerinden hedeflere ulaşabilme durumu kontrol edilmiş, etkinliği düşük `
            + `süreçler için iyileştirme aksiyonu tanımlanmıştır.`),

        B('iatf_c', '9.3.2.1 c)', 'Proses verimliliği ölçümleri',
            verimlilikKpi.map(kpiSatir),
            `Proses verimliliği ölçümleri gözden geçirilmiştir. ${L} lokasyonundaki hat doluluk `
            + `oranları, çevrim süreleri, kapasite kullanımı ve fire oranları değerlendirilmiş; `
            + `darboğaz oluşturan proseslerde iyileştirme planlanmıştır.`),

        B('iatf_d', '9.3.2.1 d)', 'Ürün uygunluğu',
            uygunlukKpi.map(kpiSatir),
            `Ürünle ilgili şikayetler gözden geçirilmiştir. Ürün şikayetleri ve uygunsuzlukların `
            + `ürün güvenliği üzerindeki etkileri değerlendirilmiş; kritik karakteristik (CC/SC) `
            + `taşıyan ürünlerde uygunsuzluk tespit edilmemiştir.`,
            bolumGrafikHtml(uygunlukKpi, yil, 'Ürün uygunluğu KPI’ları (PPM / hurda / iade)')),

        B('iatf_e', '9.3.2.1 e)', 'Operasyon değişiklikleri ve imalat fizibilite değerlendirmeleri (md. 7.1.3.1)',
            [],
            `Mevcut operasyonlardaki değişiklikler ile yeni tesis ve yeni ürünler için yapılan `
            + `imalat fizibilite değerlendirmeleri gözden geçirilmiştir. Fizibilite dokümanları `
            + `incelenmiş, kapasite ve yetkinlik açısından uygunluk teyit edilmiştir.`),

        B('iatf_f', '9.3.2.1 f)', 'Müşteri memnuniyeti (ISO 9001 md. 9.1.2)',
            [],
            `Müşteri DÖF ve memnuniyet durumu gözden geçirilmiştir. Müşteri kaynaklı DÖF’ler, `
            + `şikayet kapama süreleri ve memnuniyet anketi sonuçları değerlendirilmiş; `
            + `DÖF’ler gözden geçirilerek kapatılmıştır.`),

        B('iatf_g', '9.3.2.1 g)', 'Bakım hedeflerine göre performansın gözden geçirilmesi',
            (() => {
                return bakimKpi.length ? bakimKpi.map(kpiSatir) : [];
            })(),
            `MTTR ve MTBF hedefleri gözden geçirilmiştir. Planlı bakım uyum oranı, arıza sıklığı `
            + `ve müdahale süreleri değerlendirilmiş; hedefin dışında kalan makineler için `
            + `önleyici bakım planı revize edilmiştir.`,
            bolumGrafikHtml(bakimKpi, yil, 'Bakım KPI’ları (MTTR / MTBF / arıza)')),

        B('iatf_h', '9.3.2.1 h)', 'Garanti performansı (varsa)',
            [],
            `Garanti sağlamamaktayız; bu madde kapsam dışıdır.`),

        B('iatf_i', '9.3.2.1 i)', 'Müşteri puan kartlarının gözden geçirilmesi (varsa)',
            [],
            `Müşteri portal puan kartları gözden geçirilmiştir. Müşteri puanları, kalite ve termin `
            + `performansı ile varsa müşteri uyarı/eskalasyon durumları değerlendirilmiş; `
            + `puan düşüşü olan müşteriler için aksiyon planlanmıştır.`),

        B('iatf_j', '9.3.2.1 j)', 'Risk analizi (HTEA/FMEA) ile tanımlanan potansiyel saha arızaları',
            [],
            `FMEA’lar gözden geçirilmiştir. P-FMEA ve varsa D-FMEA dokümanları güncellik açısından `
            + `incelenmiş, ürün güvenliği riskleri gözden geçirilmiş; yüksek RPN/AP değerli `
            + `maddeler için önlemler değerlendirilmiştir.`),

        B('iatf_k', '9.3.2.1 k)', 'Gerçek saha arızaları ve güvenlik üzerindeki etkileri',
            [],
            `Müşteri geri bildirimleri, garanti verileri ve saha performansına ilişkin mevcut `
            + `bilgiler doğrultusunda, firmamız kaynaklı herhangi bir saha arızası (field failure) `
            + `tespit edilmemiştir. Buna rağmen ürün güvenliği (product safety) kapsamında kritik `
            + `karakteristikler (CC/SC), müşteri özel gereksinimleri (CSR) ve yasal şartlar `
            + `doğrultusunda potansiyel riskler değerlendirilmiş, ürün güvenliği üzerinde olumsuz `
            + `bir etki oluşturacak durum gözlemlenmemiştir. Ürün güvenliği ile ilgili risklerin `
            + `izlenmesine ve gerekli durumlarda FMEA, kontrol planı ve proseslere geri besleme `
            + `yapılmasına devam edilmektedir.`),

        B('urun_guvenligi', '4.4.1.2', 'Ürün güvenliği ve yanmazlık (yanma) testleri',
            [],
            `Ürün güvenliği prosesi IATF 16949 md. 4.4.1.2 kapsamında gözden geçirilmiştir. `
            + `${L} lokasyonunda üretilen/işlenen ürünler için ürün güvenliğine ilişkin yasal `
            + `ve müşteri şartları belirlenmiş; ürün güvenliği sorumlusu atanmış ve ilgili `
            + `personelin yetkinliği (ürün güvenliği eğitimi) güncel tutulmuştur.

`
            + `YANMAZLIK (YANMA) TESTLERİ: Otomotiv iç mekân malzemelerinde yanma hızı şartı `
            + `(FMVSS 302 / ISO 3795 / DIN 75200 ve müşteri özel standartları) kritik `
            + `karakteristik olarak izlenmektedir. İlgili ürünlerin yanma testleri kontrol `
            + `planında tanımlı periyotta yapılmış, sonuçlar müşteri/standart limitlerinin `
            + `içinde kalmıştır. Dış laboratuvar raporları ve parti bazlı test kayıtları `
            + `gözden geçirilmiş olup ${L} lokasyonu için bu dönemde yanmazlık testlerine `
            + `ilişkin herhangi bir uygunsuzluk, limit aşımı, müşteri şikayeti veya geri `
            + `çağırma bulunmamaktadır; ürün güvenliği açısından bir problem tespit `
            + `edilmemiştir.

`
            + `Ayrıca ürün güvenliği kapsamında; kritik karakteristiklerin (CC/SC) kontrol `
            + `planına ve FMEA'ya yansıtılması, izlenebilirlik (parti/lot takibi) ve blokaj/`
            + `geri çağırma prosedürünün işlerliği, tedarikçi zincirinde ürün güvenliği `
            + `şartlarının aktarılması, özel karakteristikli proseslerde reaksiyon planları ve `
            + `müşteriye/yasal mercilere bildirim (eskalasyon) süreci değerlendirilmiş; `
            + `sistem etkin bulunmuştur. Ürün güvenliğini etkileyebilecek bir değişiklik `
            + `olması hâlinde FMEA, kontrol planı ve testler yeniden gözden geçirilecektir.`),

        B('kalite_politikasi', 'Ek', 'Kalite politikasının uygunluğunun gözden geçirilmesi',
            [],
            `Kalite politikası ve kalite hedeflerinin kuruluşun stratejik yönü ile uygunluğu `
            + `gözden geçirilmiştir. Politika güncel bulunmuş, tüm çalışanlara duyurulmuş ve `
            + `ilgili taraflara erişilebilir durumdadır; değişiklik ihtiyacı bulunmamaktadır.`),

        // ── Çıktılar ──
        B('cikti_a', '9.3.3 a)', 'İyileştirme fırsatları (çıktı) — yeni kalite hedefleri',
            [
                `${yil + 1} yılı için ${hedefler.filter(h => h.yeniHedef !== null).length} KPI'da `
                + `yeni hedef önerilmiştir (tabloda).`,
                ...(tutmayanlar.length
                    ? [`${yil} yılında hedefi tutturamayan ${tutmayanlar.length} KPI için aksiyon `
                        + `önerisi hazırlanmıştır: `
                        + tutmayanlar.slice(0, 12).map(h => h.kpi.kpi_adi).join('; ')
                        + (tutmayanlar.length > 12 ? ` … (+${tutmayanlar.length - 12})` : '') + '.']
                    : [`${yil} yılında hedefi tutturamayan KPI bulunmamaktadır.`]),
            ],
            `İyileştirme için FR100 ve FR001'de ${yil + 1} dönemi yeni hedefleri belirlenerek `
            + `yayımlanmıştır. Yeni hedefler; önceki yılın gerçekleşeni, bu yılın hedefi ve bu yılın `
            + `gerçekleşeni birlikte değerlendirilerek, hedefi tutturan ve önceki yıla göre iyileşen `
            + `KPI'larda daha yüksek iyileştirme payıyla belirlenmiştir. Hedefi tutturamayan `
            + `KPI'larda hedef GEVŞETİLMEMİŞ, mevcut hedef korunmuş ve hedefe ulaşmak için `
            + `aşağıdaki aksiyonlar sorumlu ve terminle planlanmıştır. Kaynak ihtiyaçları için `
            + `terminler ayrıca planlanmıştır.`,
            hedefTabloHtml(hedefler, yil), hedefAks),

        B('cikti_b', '9.3.3 b)', 'KYS’de değişiklik ihtiyacı (çıktı)',
            [],
            `Kalite yönetim sisteminde köklü bir değişiklik ihtiyacı bulunmamaktadır. Gözden `
            + `geçirme sonucunda güncellenmesi gereken prosedür ve talimatlar belirlenmiş, `
            + `doküman revizyonları planlanmıştır.`),

        B('cikti_c', '9.3.3 c)', 'Kaynak ihtiyaçları (çıktı)',
            [],
            `Kaynak ihtiyaçları gözden geçirilerek planlanmıştır. ${L} lokasyonu için makine ve `
            + `ekipman yatırımları, altyapı ihtiyaçları, insan kaynağı ve bakım/onarım kaynakları `
            + `değerlendirilmiş; terminler aşağıdaki aksiyon tablosuna işlenmiştir.`),
    ];
};

// Kalıcı not anahtarı: LOKASYON + YIL başına ayrı.
export const yggAnahtar = (lokasyon: string, yil: number): string =>
    'ygg_' + String(lokasyon || '').trim().toLocaleLowerCase('tr').replace(/\s+/g, '_') + '_' + yil;

// Kayıtlı hâl ile standart listeyi birleştir.
// Kullanıcının SİLDİĞİ bölüm geri gelmez; EKLEDİĞİ bölüm korunur;
// standarda sonradan eklenen madde listeye girer (taslak metniyle).
export const yggBirlestir = (
    standart: YggBolum[],
    kayit: YggKayitBolum[] | null,
    silinenler: string[] = [],
): YggKayitBolum[] => {
    // SILME KAYDI olmadan, silinen standart madde "kayıtta yok" sayılıp
    // her açılışta geri gelirdi — silme hiç işe yaramazdı.
    const silinen = new Set(silinenler || []);
    if (!kayit) {
        return standart.filter(b => !silinen.has(b.id)).map(b => ({
            id: b.id, madde: b.madde, baslik: b.baslik,
            metin: b.varsayilanMetin, aksiyonlar: [],
        }));
    }
    const kayitli = new Map(kayit.map(k => [k.id, k]));
    const sonuc: YggKayitBolum[] = [];
    // Kayıttaki sıra korunur (kullanıcı sıralamış olabilir)
    kayit.forEach(k => sonuc.push(k));
    // Kayıtta hiç görülmemiş standart madde varsa sona eklenir
    standart.forEach(b => {
        if (!kayitli.has(b.id) && !silinen.has(b.id)) {
            sonuc.push({
                id: b.id, madde: b.madde, baslik: b.baslik,
                metin: b.varsayilanMetin, aksiyonlar: [],
            });
        }
    });
    return sonuc;
};
