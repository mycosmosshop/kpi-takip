// Otomatik çekilen KPI'ların "Açıklama" alanına hesabın nasıl yapıldığını yazar.
//
// KULLANICININ KENDİ YAZDIĞI KORUNUR: metin bir işaretçiyle ikiye ayrılır.
// İşaretçinin ÜSTÜ kullanıcınındır, uygulama oraya hiç dokunmaz; altındaki
// blok her çekimde yeniden yazılır. Blok yoksa metnin sonuna eklenir.

import type { KpiSource, SourceMetric, SourceType } from '../types';

export const ACIKLAMA_BASI = '── Otomatik hesap (bu satırın altını uygulama yazar) ──';

const KAYNAK: Record<SourceType, string> = {
    cmms: 'Bakım Yönetim Sistemi (CMMS)',
    egitim: 'Eğitim & Polivalans',
    tedarikci: 'Onaylı Tedarikçi Değerlendirme',
    siparis: 'LeanSys / Mikro Sevkiyat Raporu (0157)',
    kalite: 'LeanSys Uygunsuzluk Raporu + mal kabul iadeleri + sevk / satış (LeanSys ajanı /kpikalite)',
};

// Her metriğin hesabı — denetimde "bu sayı nereden geliyor?" sorusunun cevabı.
const HESAP: Record<SourceMetric, string> = {
    mtbf: 'MTBF = toplam çalışma süresi / arıza adedi (saat). Arızalar arasındaki ortalama süre.',
    mttr: 'MTTR = toplam tamir süresi / arıza adedi (saat). Ortalama tamir süresi.',
    mttf: 'MTTF = ilk arızaya kadar geçen ortalama süre (saat).',
    cost: 'Bakım maliyeti = arıza maliyeti + planlı bakım maliyeti + yedek parça maliyeti (TL, lokasyon toplamı).',
    availability: 'Kullanılabilirlik = (planlı süre − duruş) / planlı süre × 100.',
    pmr: 'PMR = planlı bakım iş emri / toplam iş emri × 100.',
    pmc: 'PMC = zamanında kapatılan planlı bakım / vadesi gelen planlı bakım × 100. Vadesi gelmemiş iş sayılmaz.',
    unplanned: 'Plansız Bakım = plansız iş emri / toplam iş emri × 100.',
    egitim_sure: 'Eğitim Süresi = gerçekleşen eğitimlerin adam·saat toplamı (katılımcı × süre).',
    egitim_gerceklesme: 'Gerçekleşme = gerçekleşen eğitim / planlanan eğitim × 100. Planı olmayan ay boş bırakılır.',
    iade_ppm: 'İade PPM = Σ iade miktarı / Σ sevk miktarı × 1.000.000.',
    td_puan: 'Tedarikçi Değerlendirme Puanı — PR06 Rev04 ağırlıklarıyla aylık bileşik puan.',
    td_terminpuan: 'Termine göre değerlendirme puanı (aylık).',
    td_ppmpuan: 'İade PPM’e göre değerlendirme puanı (aylık).',
    td_termin: 'Termin Tamamlanma Oranı — sipariş satırlarının zamanında karşılanma ortalaması.',
    siparis_tamamlanma:
        'Sipariş Tamamlanma = Σ min(sipariş satırının toplam sevki, sipariş miktarı) / Σ sipariş miktarı × 100.\n'
        + '  · Sipariş miktarı sipariş satırı başına BİR KEZ sayılır. Rapor bir siparişi birden çok\n'
        + '    irsaliyeye böldüğünde sipariş miktarını her satırda tekrar gösterir; sütun toplamı\n'
        + '    alınırsa tam teslim edilmiş bir sipariş bile düşük çıkar.\n'
        + '  · Sipariş miktarından fazla sevk, sipariş miktarıyla sınırlanır (yüzde 100’ü aşmasın).\n'
        + '  · Sadece çıkış hareketleri; depolar arası transferler ve siparişe bağlı olmayan\n'
        + '    sevkiyatlar (sipariş miktarı 0) hariç.\n'
        + '  · Ay = sipariş satırının ilk irsaliye ayı.',
    kalite_qi: 'Kalite Uygunsuzlukları Adedi = o ay açılan tekil uygunsuzluk kaydı (iç + dış + tedarikçi; NC seri + sıra ile tekil).',
    kalite_sikayet: 'Müşteri Şikayeti = uygunsuzluk tipi "Dış Başarısızlık" olan kayıt sayısı (yalnız LeanSys\'e girilenler).',
    kalite_ic_ppm:
        'İç PPM = (iç başarısızlık hatalı miktarı − ek yeri) / aynı ay ve aynı birimdeki üretim miktarı × 1.000.000.\n'
        + '  · Payda üretimdir (2025 İç PPM dosyasıyla aynı). Kontrol miktarı yalnız uygunsuzluk açılan partileri içerir, kullanılmaz.\n'
        + '  · Ek yeri hariç: rulo malzemede bilerek bulunur, ayıklanması planlıdır → fire olarak ayrı izlenir.\n'
        + '  · Çap kesim, keçe tüylenmesi, selülozsuz kısım, oluk formu gibi ürün hataları dahildir (karar düşük kalite olsa da).',
    kalite_fire_ppm: 'Ek Yeri Firesi PPM = hata tipi "Ek Yeri" olan iç uygunsuzluk miktarı / üretim miktarı × 1.000.000 (planlı ayıklama; iç PPM\'e girmez).',
    kalite_iade_ppm:
        'Dış İade PPM = müşteri iade miktarı / aynı ay ve aynı birimdeki sevk miktarı × 1.000.000.\n'
        + '  · Müşteri iadesi = mal kabul (evrak tipi 13) "iade" işaretli satırlar; 9xx hammadde/ambalaj (fason malzeme) hariç.\n'
        + '  · Her iade girer (kalite dışı nedenli olanlar da — sevkiyat fazlası vb.); nedeni kanıt Excel\'inde.\n'
        + '  · İade yoksa ve sevk varsa 0; o ay sevk yoksa boş (NA).',
    kalite_maliyet:
        'Kalite Maliyeti (TL) = yalnız hurdaya ayrılan ve iade edilenler:\n'
        + '  · Uygunsuzluk kararı Hurda / Tedarikçiye iade → hatalı miktar × birim fiyat\n'
        + '  · Kalite kaynaklı müşteri iadesi → iade miktarı × iade birim fiyatı. Kalite kaynaklı = aynı stokta iadeden önceki 30 gün içinde\n'
        + '    dış başarısızlık uygunsuzluğu var. Diğer iadeler (ör. sevkiyat fazlası) iade PPM\'e girer, maliyete girmez.\n'
        + '  · Kullanılan, düşük kalite, şartlı kullanım, tamir, değerlendirme maliyete girmez.\n'
        + '  · Birim fiyat: son Mikro faturası (Fiyat Listesi Son Fatura); yoksa son stok hareketi fiyatı.',
    kalite_oran:
        'Kalite Maliyeti Oranı (%) = kalite maliyeti / lokasyon satış tutarı × 100.\n'
        + '  · Bütçe LeanSys\'te ve Mikro\'da tutulmadığı için payda satış tutarıdır (SAT003, Saniteks iç satışı dahil).',
};

const KAPSAM: { [k: string]: string } = {
    tum: 'Tüm tedarikçiler',
    onayli: 'Onaylı tedarikçiler',
    otomotiv: 'Sadece otomotiv tedarikçileri',
    onayli_otomotiv: 'Onaylı + otomotiv tedarikçileri',
    filtre: 'Onaylı sistemdeki kayıtlı filtre',
};

export const KALITE_KAPSAM: { [k: string]: string } = {
    tum: 'Tüm ürünler',
    vileda: 'Yalnız Vileda (stok 140./191., VL / Glitzi, FHP malzemesi)',
    diger: 'Vileda hariç tüm ürünler',
};

// Çekim sonrası açıklama bloğu
export const kaynakAciklamasi = (
    source: KpiSource,
    loc: string,
    year: number,
    tarih: Date = new Date(),
): string => {
    const s: string[] = [ACIKLAMA_BASI];
    s.push(`Kaynak: ${KAYNAK[source.type]}`);
    s.push(`Hesap: ${HESAP[source.metric] || source.metric}`);
    if (source.type === 'tedarikci') {
        const kap = KAPSAM[source.scope || 'onayli'] || source.scope || '';
        s.push(`Kapsam: ${kap}${source.filterName ? ` — "${source.filterName}"` : ''}`);
    }
    if (source.type === 'kalite') {
        s.push(`Kapsam: ${KALITE_KAPSAM[source.scope || 'tum'] || source.scope}`);
    }
    s.push(`Lokasyon: ${loc === '__ALL__' ? 'tüm lokasyonlar' : loc} · Yıl: ${year}`);
    // Formül varsa değeri değiştiriyor demektir — açıklamada görünmeli.
    if (source.formula && source.formula.trim()) {
        s.push(`Uygulanan formül: ${source.formula.trim()}  (x = kaynaktan çekilen değer)`);
    }
    s.push(`Son çekim: ${tarih.toLocaleString('tr-TR')}`);
    return s.join('\n');
};

// Kullanıcının kendi yazdığını koruyarak bloğu tazeler.
export const aciklamaGuncelle = (mevcut: string | undefined, blok: string): string => {
    const m = mevcut || '';
    const i = m.indexOf(ACIKLAMA_BASI);
    if (i < 0) return m.trim() ? `${m.trimEnd()}\n\n${blok}` : blok;
    // İşaretçiden öncesi kullanıcınındır; sonrası tamamen yenilenir.
    const onces = m.slice(0, i).trimEnd();
    return onces ? `${onces}\n\n${blok}` : blok;
};
