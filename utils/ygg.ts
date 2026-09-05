// YGG (Yönetimin Gözden Geçirmesi) — ISO 9001 md. 9.3 + IATF 16949 md. 9.3.2.1
// yapısında, LOKASYON BAZINDA rapor.
//
// Her bölümün iki parçası var:
//   otomatik : uygulamadaki canlı veriden üretilir (KPI, DÖF, aksiyon, yıl
//              karşılaştırma). Elle yazılmaz, her açılışta günceldir.
//   not      : kullanıcının kendi yazdığı metin (kaynaklar, riskler,
//              müşteri puan kartları... uygulamanın bilmediği her şey).
//
// Otomatik kısım veriden GELMEYEN hiçbir şey uydurmaz: veri yoksa
// "kayıt yok" der. Denetimde "bu cümle nereden geliyor?" sorusunun
// cevabı ya canlı veridir ya da kullanıcının kendi notudur.
import type { Kpi, ActionItem, MultiYearKpiData, Dof } from '../types';
import { karsilastir, hedefDegisimi } from './yilKarsilastirma.ts';   // .ts: Node --experimental-strip-types testte cozebilsin

export interface YggBolum {
    id: string;           // kalıcı anahtar (not bu id ile saklanır)
    madde: string;        // "9.3.2 a)" gibi
    baslik: string;
    otomatik: string[];   // canlı veriden üretilen satırlar
    ipucu: string;        // kullanıcıya "buraya ne yazılır"
}

export interface YggNotlar { [bolumId: string]: string; }

const yuzde = (a: number, b: number): string =>
    b > 0 ? (a / b * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%' : '—';

const sayi = (n: number | null | undefined): string =>
    (n === null || n === undefined || isNaN(Number(n))) ? '—'
        : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: Math.abs(Number(n)) >= 1000 ? 0 : 2 });

// KPI durum sayıları
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

    // Prosese göre başarı — "süreç performansı" maddesinin verisi
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

    const B = (id: string, madde: string, baslik: string, otomatik: string[], ipucu: string): YggBolum =>
        ({ id, madde, baslik, otomatik, ipucu });

    return [
        B('girdi_a', '9.3.2 a)', 'Önceki yönetim incelemelerinden alınan eylemlerin durumu',
            aksiyonlar.length === 0
                ? ['Bu lokasyon/yıl için aksiyon kaydı yok (Aksiyonlar ekranı boş).']
                : [
                    `Toplam ${aksiyonlar.length} aksiyon; ${bitenAks.length} tamamlandı `
                    + `(${yuzde(bitenAks.length, aksiyonlar.length)}), ${aksiyonlar.length - bitenAks.length} devam ediyor.`,
                    ...(gecikenAks.length
                        ? [`Termini geçmiş ${gecikenAks.length} aksiyon: `
                            + gecikenAks.slice(0, 8).map(a => `${a.action || a.kpi} (${a.owner || 'sorumlu yok'}, ${a.due})`).join('; ')
                            + (gecikenAks.length > 8 ? ` … ve ${gecikenAks.length - 8} tane daha` : '')]
                        : ['Termini geçmiş aksiyon yok.']),
                ],
            'Geçen yılın YGG kararlarının durumu. Aksiyonlar ekranında olmayan kararları buraya yazın.'),

        B('girdi_b', '9.3.2 b)', 'KYS ile ilgili iç ve dış konulardaki değişiklikler',
            ['Uygulama bu maddeyi veriden üretemez — organizasyon, sertifikasyon, '
                + 'mevzuat ve müşteri şartlarındaki değişiklikler elle yazılır.'],
            'Yeni sertifikalar, organizasyon değişiklikleri, yeni müşteri/mevzuat şartları, tesis değişiklikleri.'),

        B('girdi_c2', '9.3.2 c) 2', 'Kalite hedeflerinin ne ölçüde karşılandığı',
            [
                `${yil} yılı ${lokasyon} lokasyonunda ${d.toplam} KPI izlendi: `
                + `${d.basarili} başarılı (${yuzde(d.basarili, d.toplam)}), `
                + `${d.marjinal} marjinal, ${d.basarisiz} başarısız`
                + (d.na ? `, ${d.na} değerlendirilemedi (veri yok)` : '') + '.',
                ...(basarisizlar.length
                    ? ['Hedefi tutturamayan KPI’lar: '
                        + basarisizlar.map(k => `${k.kpi_adi} (ort. ${sayi(k.ortalama)} / hedef ${sayi(k.yeni_yil_hedef)} ${k.birim})`).join('; ')]
                    : ['Hedefi tutturamayan KPI yok.']),
                ...(marjinaller.length
                    ? ['Marjinal KPI’lar: ' + marjinaller.map(k => k.kpi_adi).join('; ')] : []),
            ],
            'Hedeflerin karşılanmama nedenleri ve alınan kararlar.'),

        B('girdi_c3', '9.3.2 c) 3', 'Süreç performansı ve ürün/hizmetlerin uygunluğu',
            Array.from(prosesler.entries()).map(([p, list]) => {
                const s = durumSay(list);
                return `${p}: ${s.toplam} KPI — ${s.basarili} başarılı (${yuzde(s.basarili, s.toplam)})`
                    + (s.basarisiz ? `, ${s.basarisiz} başarısız` : '')
                    + (s.marjinal ? `, ${s.marjinal} marjinal` : '');
            }),
            'Ürün ve hizmet uygunluğu, ürün güvenliği değerlendirmesi.'),

        B('girdi_c4', '9.3.2 c) 4', 'Uygunsuzluklar ve düzeltici faaliyetler',
            tumDof.length === 0
                ? ['Bu lokasyon/yıl için kayıtlı DÖF yok.']
                : [
                    `Toplam ${tumDof.length} DÖF açıldı; ${acikDof.length} tanesi hâlâ açık.`,
                    ...acikDof.slice(0, 10).map(x =>
                        `Açık DÖF — ${x.kpi.kpi_adi}: ${x.dof.problemTanimi || '(problem tanımı girilmemiş)'} `
                        + `(sorumlu: ${x.dof.sorumlu || '—'}, termin: ${x.dof.due_date || '—'}, %${x.dof.ilerleme || 0})`),
                    ...(acikDof.length > 10 ? [`… ve ${acikDof.length - 10} açık DÖF daha.`] : []),
                ],
            'Kök neden analizleri, kalıcı aksiyonların etkinliği, ürün güvenliği ile ilgili uygunsuzluklar.'),

        B('girdi_c7', '9.3.2 c) 7', 'Dış sağlayıcıların (tedarikçi) performansı',
            (() => {
                const ted = kpis.filter(k => k.kaynak?.type === 'tedarikci'
                    || /tedarik|iade ppm/i.test(k.kpi_adi || ''));
                return ted.length
                    ? ted.map(k => `${k.kpi_adi}: ${sayi(k.ortalama)} ${k.birim} `
                        + `(hedef ${sayi(k.yeni_yil_hedef)}) — ${k.durum === 'basarili' ? 'hedef içinde' : k.durum === 'marjinal' ? 'marjinal' : 'hedef aşıldı'}`)
                    : ['Tedarikçi performansı KPI’sı tanımlı değil. Onaylı Tedarikçi sisteminden değerlendirme eklenmeli.'];
            })(),
            'Tedarikçi geliştirme planları, onaysız/riskli tedarikçiler, denetim sonuçları.'),

        B('girdi_d', '9.3.2 d)', 'Kaynakların yeterliliği',
            ['Uygulama bu maddeyi veriden üretemez — insan kaynağı, makine/teçhizat, '
                + 'altyapı ve ürün güvenliği kaynakları elle yazılır.'],
            'Personel sayısı ve yetkinlik, makine yatırımları, altyapı, ürün güvenliği için ayrılan kaynaklar.'),

        B('girdi_e', '9.3.2 e)', 'Risk ve fırsatlar için alınan önlemlerin etkinliği',
            ['Uygulama bu maddeyi veriden üretemez — risk/fırsat değerlendirmesi elle yazılır.'],
            'Risk analizi sonuçları, alınan önlemlerin etkinliği, yeni fırsatlar.'),

        B('girdi_f', '9.3.2 f)', 'İyileştirme fırsatları',
            karsi.length === 0 ? ['Karşılaştırma için veri yok.'] : [
                gecenVar.length
                    ? `${yil - 1} ile karşılaştırma: ${gecenVar.length} KPI’nın önceki yıl kaydı var; `
                      + `${sikilasan.length} hedef sıkılaştırıldı, ${gevseyen.length} hedef gevşetildi.`
                    : `${yil - 1} yılına ait KPI kaydı bulunamadı — hedef değişimi karşılaştırılamadı.`,
                ...(sikilasan.length
                    ? ['Sıkılaştırılan hedefler: ' + sikilasan.slice(0, 10).map(s => {
                        const h = hedefDegisimi(s);
                        return `${s.kpi.kpi_adi} (${sayi(s.gecenHedef)} → ${sayi(s.buHedef)})`;
                    }).join('; ')]
                    : []),
            ],
            'Yeni dönem için belirlenen hedefler, iyileştirme projeleri, terminler.'),

        B('iatf_a', '9.3.2.1 a)', 'Düşük kalite maliyeti (dahili ve harici uygunsuzluk maliyeti)',
            (() => {
                const m = kpis.filter(k => /maliyet|kalitesizlik/i.test(k.kpi_adi || ''));
                return m.length
                    ? m.map(k => `${k.kpi_adi}: ${sayi(k.ortalama)} ${k.birim} (hedef ${sayi(k.yeni_yil_hedef)})`)
                    : ['Kalite maliyeti KPI’sı tanımlı değil — tutar elle yazılmalı.'];
            })(),
            'İç ve dış uygunsuzluk maliyetleri, hurda/yeniden işleme, müşteri iade maliyetleri.'),

        B('iatf_b', '9.3.2.1 b)', 'Süreç etkinliğinin ölçümü',
            Array.from(prosesler.entries()).map(([p, list]) => {
                const s = durumSay(list);
                const oran = s.toplam ? s.basarili / s.toplam : 0;
                return `${p}: etkinlik ${yuzde(s.basarili, s.toplam)} — `
                    + (oran >= 0.85 ? 'YÜKSEK' : oran >= 0.6 ? 'ORTA' : 'GELİŞTİRİLMELİ');
            }),
            'Süreçlerin etkinliği hakkında yönetim değerlendirmesi.'),

        B('iatf_g', '9.3.2.1 g)', 'Bakım hedeflerine göre performans (MTTR / MTBF)',
            (() => {
                const b = kpis.filter(k => k.kaynak?.type === 'cmms'
                    || /mttr|mtbf|arıza|bakım/i.test(k.kpi_adi || ''));
                return b.length
                    ? b.map(k => `${k.kpi_adi}: ${sayi(k.ortalama)} ${k.birim} `
                        + `(hedef ${sayi(k.yeni_yil_hedef)}) — ${k.durum === 'basarili' ? 'hedefte' : k.durum === 'marjinal' ? 'marjinal' : 'hedef dışı'}`)
                    : ['Bakım KPI’sı tanımlı değil.'];
            })(),
            'Önleyici bakım planı, arıza sıklığı ve müdahale süresi için alınan kararlar.'),

        B('cikti_a', '9.3.3 a)', 'İyileştirme fırsatları (çıktı)',
            [`${yil + 1} hedefleri için karar: `
                + (basarisizlar.length
                    ? `öncelik hedefi tutturamayan ${basarisizlar.length} KPI’da.`
                    : 'tüm KPI’lar hedefte; hedeflerin sıkılaştırılması değerlendirilmeli.')],
            'Alınan kararlar, sorumlular ve terminler.'),

        B('cikti_b', '9.3.3 b)', 'KYS’de değişiklik ihtiyacı (çıktı)',
            ['Uygulama bu maddeyi veriden üretemez.'],
            'Prosedür/doküman değişiklikleri, sertifikasyon hedefleri.'),

        B('cikti_c', '9.3.3 c)', 'Kaynak ihtiyaçları (çıktı)',
            ['Uygulama bu maddeyi veriden üretemez.'],
            'Makine, altyapı, personel ve bakım kaynak ihtiyaçları; terminler.'),
    ];
};

// Kalıcı not anahtarı: LOKASYON + YIL başına ayrı. Kullanıcı isteği:
// "sadece tek bir lokasyona özel, ayrı ayrı olmalı".
export const yggAnahtar = (lokasyon: string, yil: number): string =>
    'ygg_' + String(lokasyon || '').trim().toLocaleLowerCase('tr').replace(/\s+/g, '_') + '_' + yil;
