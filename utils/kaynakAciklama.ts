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
    kalite_ic_nc: 'İç Uygunsuzluk Adedi = o ay açılan, tipi "İç Başarısızlık" olan tekil uygunsuzluk kaydı (tespit yeri = lokasyon).',
    kalite_td_nc: 'Tedarikçi Uygunsuzluk Adedi = o ay açılan, tipi "Tedarikçi" olan tekil uygunsuzluk kaydı (giriş kontrol / üretimde tespit edilen malzeme hatası; tespit yeri = lokasyon).',
    kalite_maliyet_ic: 'İç Başarısızlık Maliyeti (TL) = kararı Hurda ya da Tedarikçiye iade olan uygunsuzluklarda hatalı miktar × birim fiyat (son Mikro faturası; yoksa son stok hareketi fiyatı).\n'
        + '  · Kalite Maliyeti = İç + Dış başarısızlık maliyeti. Kullanılan, düşük kalite, şartlı, tamir, değerlendirme girmez.',
    kalite_maliyet_dis: 'Dış Başarısızlık Maliyeti (TL) = kalite kaynaklı müşteri iadesi × iade birim fiyatı. Kalite kaynaklı = aynı stokta iadeden önceki 30 gün içinde dış başarısızlık uygunsuzluğu var; diğer iadeler (sevkiyat fazlası vb.) girmez.',
    kalite_sikayet: 'Müşteri Şikayeti = uygunsuzluk tipi "Dış Başarısızlık" olan kayıt sayısı (yalnız LeanSys\'e girilenler).',
    kalite_ic_ppm:
        'İç PPM = (iç başarısızlık hatalı miktarı − ek yeri) / aynı ay ve aynı birimdeki üretim miktarı × 1.000.000.\n'
        + '  · Payda üretimdir (2025 İç PPM dosyasıyla aynı). Kontrol miktarı yalnız uygunsuzluk açılan partileri içerir, kullanılmaz.\n'
        + '  · Ek yeri hariç: rulo malzemede bilerek bulunur, ayıklanması planlıdır → fire olarak ayrı izlenir.\n'
        + '  · Çap kesim, keçe tüylenmesi, selülozsuz kısım, oluk formu gibi ürün hataları dahildir (karar düşük kalite olsa da).',
    kalite_ic_ppm_uretim: 'Üretim prosesi İç PPM = paketleme dışı makinelerde açılan iç uygunsuzluk hatalı miktarı (ek yeri hariç) / aynı makinelerin aynı ay ve birimdeki üretimi × 1.000.000.\n'
        + '  · Üretim makineleri: laminasyon, keçe fırını, kesim (yatay/dikey/pres), bez kesme-katlama, el işçiliği vb. — adında PAKETLEME geçmeyen tüm makineler.',
    kalite_ic_ppm_paket: 'Paketleme prosesi İç PPM = paketleme makinelerinde (MP4, MP5, MP7, MP8, OKP-2 — adında PAKETLEME geçen) açılan iç uygunsuzluk hatalı miktarı (ek yeri hariç) / aynı makinelerin üretimi × 1.000.000.\n'
        + '  · Hata tipi pareto ve makine bazında döküm kanıt Excel\'inde.',
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
    finans_ebitda:
        'EBITDA (%) = tesis EBITDA ÷ satış × 100, yılbaşından o aya kümülatif (Mikro muhasebe). Yalnız Veliköy ve Çerkezköy hesaplanır.\n'
        + '  · Tesis = Mikro\'da adı o tesisi taşıyan sorumluluk merkezleri: satış − hammadde alımı − işçilik − genel üretim − pazarlama − genel yönetim; amortisman hariç.\n'
        + '  · Genel merkez (İstanbul, genel personel dağılımı ve SM\'siz) giderleri satış payıyla, SM\'siz hammadde alımı alım payıyla dağıtılır; dönem maliyet fişleri hariç.\n'
        + '  · Veliköy: Saniteks eklenir (SMM = satış × yıllık 621 oranı); Saniteks\'e iç satış satıştan düşülür. Sayım ayında stok farkı, Aralık\'ta Saniteks stoğundaki gerçekleşmemiş kâr düşülür.\n'
        + '  · Çerkezköy: Sanifoam GmbH\'ye satış transfer fiyatıyla sayılır (GmbH muhasebesi Mikro\'da yok); sayım olmadığı için malzeme maliyeti alım bazlıdır.',
    kalite_oee_uretim:
        'OEE (%) = Kullanılabilirlik × Performans × Kalite, makine × ay; proses değeri makinelerin planlı süreyle ağırlıklı ortalaması.\n'
        + '  · Kullanılabilirlik = çalışma süresi / planlı süre (makinenin o gün ilk başlama–son bitiş aralığı vardiya bloklarına yuvarlanır: Veliköy ve Çerkezköy 12 saat, Ankara 10 saat, diğer 8 saat; planlı molalar düşülür: Çerkezköy 60 dk, Ankara 75 dk / vardiya).\n'
        + '  · Performans = Σ (miktar / ideal hız) / çalışma süresi; ideal hız = makine × ürünün düzgün kayıtlarındaki %90 dilim hızı.\n'
        + '  · Başlama/bitişi hatalı kayıtta süre = miktar / olağan hız. Kalite = 1 − iç uygunsuzluk (ek yeri hariç) / adet üretim.\n'
        + '  · Üretim prosesi = adında PAKETLEME geçmeyen makineler. LeanSys RAP005_OEE raporu rastgele sayı ürettiği için kullanılmaz.',
    kalite_oee_paket: 'OEE (%) — Paketleme prosesi (MP4, MP5, MP7, MP8, OKP-2). Hesap Üretim OEE ile aynı; makine dökümü kanıt Excel\'inde.',
    plan_termin:
        'Terminlere Uygunluk (%) = teslim tarihine kadar tam (≥ %98) sevk edilen müşteri sipariş satırı / teslim tarihi o ay olan satır × 100.\n'
        + '  · Müşteri siparişi = LeanSys sipariş tipi 0 (tip 1 satınalma siparişi). Teslim tarihi: satırın verilen teslimi, yoksa istenen, yoksa sipariş başlığı.\n'
        + '  · Sevk = irsaliye satırının bağlı olduğu sipariş satırı (RAP005 tip 1). Teslim tarihi gelmemiş satırlar ölçülmez; sipariş deposunun şubesi = lokasyon.',
    plan_gecikme:
        'Ortalama Gecikme (gün) = Σ max(0, tam sevk tarihi − teslim tarihi) / teslim tarihi o ay olan satır sayısı. Zamanında satır 0 gün; hâlâ tam sevk edilmemiş satır bugüne kadar gecikmiş sayılır.',
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
    otomotiv: 'Yalnız otomotiv (satışının en az yarısı otomotiv müşterisine — Sanifoam GmbH dahil)',
    otomotiv_disi: 'Otomotiv hariç tüm ürünler',
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
