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

export interface YggAksiyon {
    id: string; konu: string; sorumlu: string; termin: string; durum: string;
}

export interface YggBolum {
    id: string;
    madde: string;          // "9.3.2 c) 2" gibi
    baslik: string;
    otomatik: string[];     // canlı veriden (salt okunur)
    varsayilanMetin: string;// standart YGG metni (düzenlenebilir taslak)
    sabit: boolean;         // standart madde mi (silinse de geri gelmez, işaretlenir)
}

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
): YggBolum[] => {
    const d = durumSay(kpis);
    const basarisizlar = kpis.filter(k => k.durum === 'basarisiz');
    const marjinaller = kpis.filter(k => k.durum === 'marjinal');
    const tumDof: { kpi: Kpi; dof: Dof }[] = [];
    kpis.forEach(k => (k.dof || []).forEach(x => tumDof.push({ kpi: k, dof: x })));
    const acikDof = tumDof.filter(x => x.dof.durum !== 'kapali');

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

    const kpiAra = (re: RegExp) => kpis.filter(k => re.test(k.kpi_adi || ''));
    const kpiSatir = (k: Kpi) => `${k.kpi_adi}: ${sayi(k.ortalama)} ${k.birim} `
        + `(hedef ${sayi(k.yeni_yil_hedef)}) — `
        + (k.durum === 'basarili' ? 'hedefte' : k.durum === 'marjinal' ? 'marjinal' : 'hedef dışı');

    const B = (id: string, madde: string, baslik: string,
        otomatik: string[], varsayilanMetin: string): YggBolum =>
        ({ id, madde, baslik, otomatik, varsayilanMetin, sabit: true });

    const L = lokasyon;
    return [
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
            + `değerlendirilmiştir. Sistemi olumsuz etkileyen bir değişiklik tespit edilmemiştir.`),

        B('girdi_c1', '9.3.2 c) 1', 'İlgili taraflardan müşteri memnuniyeti ve geri bildirim',
            (() => {
                const m = kpiAra(/memnuniyet|müşteri şikayet|musteri sikayet/i);
                return m.length ? m.map(kpiSatir) : [];
            })(),
            `Paydaş ve müşteri geri bildirimleri gözden geçirildi. ${L} lokasyonuna ait müşteri `
            + `memnuniyet anketleri, portal puanları ve geri bildirimler değerlendirilmiş; `
            + `memnuniyetsizlik bildirilen konular için düzeltici faaliyet başlatılmıştır.`),

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
                const ted = kpis.filter(k => k.kaynak?.type === 'tedarikci' || /tedarik|iade ppm/i.test(k.kpi_adi || ''));
                return ted.length ? ted.map(kpiSatir) : [];
            })(),
            `Tedarikçi performansları gözden geçirildi. Onaylı Tedarikçi Değerlendirme sistemi `
            + `üzerinden tedarikçi puanları, iade PPM ve termin performansları değerlendirilmiş; `
            + `hedefin altında kalan tedarikçilere düzeltici faaliyet talebi açılmış ve gelişim `
            + `planı oluşturulmuştur.`),

        B('girdi_d', '9.3.2 d)', 'Kaynakların yeterliliği',
            [],
            `Kaynaklar konusu gözden geçirilmiş ve terminler planlanmıştır. ${L} lokasyonunda `
            + `insan kaynağı, yetkinlik ve eğitim durumu, makine/teçhizat kapasitesi, altyapı ve `
            + `çalışma ortamı değerlendirilmiştir. Ürün güvenliğinin sağlanması için gereken `
            + `kaynaklar ayrıca ele alınmış; kaynaklar yeterli bulunmuştur.`),

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
            + `sorumlu ve termin bazında aşağıdaki aksiyon tablosuna işlenmiştir.`),

        // ── IATF 16949 md. 9.3.2.1 — tamamlayıcı girdiler ──
        B('iatf_a', '9.3.2.1 a)', 'Düşük kalite maliyeti (dahili ve harici uygunsuzluk maliyeti)',
            (() => { const m = kpiAra(/maliyet|kalitesizlik|hurda/i); return m.length ? m.map(kpiSatir) : []; })(),
            `İç ve dış kalite maliyetleri gözden geçirilmiştir. İç başarısızlık (hurda, yeniden `
            + `işleme, fire) ve dış başarısızlık (iade, müşteri şikayeti, nakliye) maliyetlerinin `
            + `ciroya oranı hesaplanmış; FR100 ve FR001 formlarına işlenmiştir.`),

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
            (() => { const m = kpiAra(/verimlilik|oee|kapasite|doluluk|fire/i); return m.length ? m.map(kpiSatir) : []; })(),
            `Proses verimliliği ölçümleri gözden geçirilmiştir. ${L} lokasyonundaki hat doluluk `
            + `oranları, çevrim süreleri, kapasite kullanımı ve fire oranları değerlendirilmiş; `
            + `darboğaz oluşturan proseslerde iyileştirme planlanmıştır.`),

        B('iatf_d', '9.3.2.1 d)', 'Ürün uygunluğu',
            [],
            `Ürünle ilgili şikayetler gözden geçirilmiştir. Ürün şikayetleri ve uygunsuzlukların `
            + `ürün güvenliği üzerindeki etkileri değerlendirilmiş; kritik karakteristik (CC/SC) `
            + `taşıyan ürünlerde uygunsuzluk tespit edilmemiştir.`),

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
                const b = kpis.filter(k => k.kaynak?.type === 'cmms' || /mttr|mtbf|arıza|bakım/i.test(k.kpi_adi || ''));
                return b.length ? b.map(kpiSatir) : [];
            })(),
            `MTTR ve MTBF hedefleri gözden geçirilmiştir. Planlı bakım uyum oranı, arıza sıklığı `
            + `ve müdahale süreleri değerlendirilmiş; hedefin dışında kalan makineler için `
            + `önleyici bakım planı revize edilmiştir.`),

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

        B('kalite_politikasi', 'Ek', 'Kalite politikasının uygunluğunun gözden geçirilmesi',
            [],
            `Kalite politikası ve kalite hedeflerinin kuruluşun stratejik yönü ile uygunluğu `
            + `gözden geçirilmiştir. Politika güncel bulunmuş, tüm çalışanlara duyurulmuş ve `
            + `ilgili taraflara erişilebilir durumdadır; değişiklik ihtiyacı bulunmamaktadır.`),

        // ── Çıktılar ──
        B('cikti_a', '9.3.3 a)', 'İyileştirme fırsatları (çıktı)',
            [`${yil + 1} hedefleri için: `
                + (basarisizlar.length
                    ? `öncelik hedefi tutturamayan ${basarisizlar.length} KPI’da.`
                    : 'tüm KPI’lar hedefte; hedeflerin sıkılaştırılması değerlendirilmeli.')],
            `İyileştirme için FR100 ve FR001’de yeni hedefler belirlenerek yayımlanacaktır. `
            + `İlgili KPI takip formlarında ${yil + 1} hedefleri güncellenmiş, kaynak ihtiyaçları `
            + `için terminler planlanmıştır. Kararlar aşağıdaki aksiyon tablosuna işlenmiştir.`),

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
