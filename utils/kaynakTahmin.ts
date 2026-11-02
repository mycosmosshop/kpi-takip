// KPI adindan otomatik kaynak tahmini — TEK YER.
//
// Hem "Veri Kaynagi" penceresinin varsayilan secimi, hem de tablodaki
// İşlemler sutunundaki simge rengi bunu kullanir. Iki yere ayri ayri
// yazilirsa biri guncellenip digeri unutulur: yeni kaynak eklendiginde
// pencere taniyip simge gri kalir.
//
// Eslesme yoksa null doner. "Her sey CMMS" gibi bir varsayilan burada
// YOK; cunku o zaman elle girilen KPI'lar da otomatik cekilebilir
// gorunurdu (Ebitda, Personel Memnuniyeti Anketi...).
import type { Kpi, SourceType, SourceMetric } from '../types';

export const KAYNAK_ADI: Record<SourceType, string> = {
    cmms: 'Bakım (CMMS)',
    egitim: 'Eğitim',
    tedarikci: 'Tedarikçi Değ.',
    siparis: 'Sipariş Tamamlanma',
    kalite: 'LeanSys Kalite',
};

export const kaynakTahmini = (kpi: Kpi | null): { type: SourceType; metric: SourceMetric } | null => {
    // TURKCE 'İ' TUZAGI: 'İade'.toLowerCase() -> 'i' + birlesik nokta (U+0307),
    // yani 'iade' ile eslesmez. "Toplam İade PPM" bu yuzden taninmiyordu.
    // Noktayi atinca hem 'İade' hem 'Iade' 'iade' olur.
    const kucuk = (x: string) => (x || '').toLowerCase().replace(/̇/g, '');
    const p = kucuk(kpi?.proses || '');
    const t = kucuk(kpi?.kpi_adi || '');
    // LeanSys kalite KPI'ları — tedarikçi değerlendirmesinden ÖNCE: "Dış İade PPM"
    // ve "Toplam İade PPM" müşteri iadesidir; aşağıdaki 'iade'+'ppm' kuralı onları
    // tedarikçi iade PPM'i sanıyordu. Adında tedarikçi geçen ya da Satınalma
    // prosesindeki KPI'lar tedarikçide kalır.
    const satinalma = p.includes('satınalma') || p.includes('satinalma') || t.includes('tedarik');
    if (!satinalma) {
        if (t.includes('ppm') && (t.includes('dış iade') || t.includes('dis iade') || t.includes('toplam iade') || t.includes('external'))) return { type: 'kalite', metric: 'kalite_iade_ppm' };
        // "İade PPM — Vileda" gibi kısa adlar müşteri iadesidir; "İç iade PPM" belirsiz, tahmin edilmez
        if (t.includes('iade') && t.includes('ppm') && !t.includes('iç iade') && !t.includes('ic iade')) return { type: 'kalite', metric: 'kalite_iade_ppm' };
        // "İç iade PPM" Üretim / Paketleme prosesinde = o prosesin iç PPM'i (makine bazında ayrılır)
        if ((t.includes('iç iade') || t.includes('ic iade')) && t.includes('ppm')) {
            if (p.includes('paketleme')) return { type: 'kalite', metric: 'kalite_ic_ppm_paket' };
            if (p.includes('üretim') || p.includes('uretim')) return { type: 'kalite', metric: 'kalite_ic_ppm_uretim' };
        }
        if (t.includes('ebidta') || t.includes('ebitda')) return { type: 'kalite', metric: 'finans_ebitda' };
        if (t.includes('oee') || t.includes('ekipman etkinli')) {
            if (p.includes('paketleme')) return { type: 'kalite', metric: 'kalite_oee_paket' };
            if (p.includes('üretim') || p.includes('uretim')) return { type: 'kalite', metric: 'kalite_oee_uretim' };
        }
        if (t.includes('terminlere uygun') || t.includes('termine uygun')) return { type: 'kalite', metric: 'plan_termin' };
        if (t.includes('gecikme') && (t.includes('gün') || t.includes('gun'))) return { type: 'kalite', metric: 'plan_gecikme' };
        if (t.startsWith('qi ') || t.startsWith('qi—') || t.startsWith('qi —')) return { type: 'kalite', metric: 'kalite_qi' };
        if (t.includes('iç ppm') || t.includes('ic ppm') || t.includes('internal ppm')) return { type: 'kalite', metric: 'kalite_ic_ppm' };
        if (t.includes('ek yeri') && (t.includes('fire') || t.includes('ppm'))) return { type: 'kalite', metric: 'kalite_fire_ppm' };
        // "Adedi" 'adet' içermez (adeDi) — ikisi de aranır
        if (t.includes('uygunsuzluk') && (t.includes('adet') || t.includes('aded') || t.includes('sayı') || t.includes('sayi') || t.includes('(qi)'))) return { type: 'kalite', metric: 'kalite_qi' };
        if (t.includes('müşteri şikayet') || t.includes('musteri sikayet')) return { type: 'kalite', metric: 'kalite_sikayet' };
        if (t.includes('kalite maliyet')) return { type: 'kalite', metric: (t.includes('oran') || t.includes('bütçe') || t.includes('butce')) ? 'kalite_oran' : 'kalite_maliyet' };
    }
    // Tedarikçi değerlendirme KPI'ları (Satınalma prosesi)
    const icIade = t.includes('iç iade') || t.includes('ic iade');   // üretim/paketleme iç iadesi — tedarikçi değil, belirsiz
    if (t.includes('tedarikçi değerlend') || t.includes('tedarikci degerlend') || (t.includes('iade') && t.includes('ppm') && !icIade) || (p.includes('satınalma') || p.includes('satinalma'))) {
        if (t.includes('termin')) return { type: 'tedarikci', metric: 'td_terminpuan' };
        if (t.includes('ppm') && (t.includes('göre') || t.includes('gore') || t.includes('puan'))) return { type: 'tedarikci', metric: 'td_ppmpuan' };
        if (t.includes('ppm') || t.includes('iade')) return { type: 'tedarikci', metric: 'iade_ppm' };
        return { type: 'tedarikci', metric: 'td_puan' };
    }
    // Egitim kaynagi yalnizca iki sey verir: adam-saat ve plan gerceklesme (%).
    // Proses "Egitim" diye TUM satirlari eslestirmek, ayni prosesteki elle
    // girilen KPI'lari (Personel Memnuniyeti Anketi) da otomatik gosterirdi.
    const sure = t.includes('süre') || t.includes('sure') || t.includes('saat');
    const gerc = t.includes('gerçekleş') || t.includes('gerceklesi') || t.includes('gerceklesen') || t.includes('planlanan') || t.includes('plan');
    if (t.includes('eğitim') || t.includes('egitim') || ((p.includes('eğitim') || p.includes('egitim')) && (sure || gerc))) {
        return { type: 'egitim', metric: sure ? 'egitim_sure' : 'egitim_gerceklesme' };
    }
    // "Siparişlerin Tamamlanma Yüzdesi": sevk raporu 0157 (İrsaliye/Sipariş)
    if (t.includes('sipariş') || t.includes('siparis')) return { type: 'siparis', metric: 'siparis_tamamlanma' };
    if (t.includes('mtbf')) return { type: 'cmms', metric: 'mtbf' };
    if (t.includes('mttr')) return { type: 'cmms', metric: 'mttr' };
    if (t.includes('mttf')) return { type: 'cmms', metric: 'mttf' };
    if (t.includes('kullanılab') || t.includes('availab')) return { type: 'cmms', metric: 'availability' };
    if (t.includes('plansız') || t.includes('plansiz')) return { type: 'cmms', metric: 'unplanned' };
    if (t.includes('uyum')) return { type: 'cmms', metric: 'pmc' };
    if (t.includes('planlı bakım oran') || t.includes('pmr')) return { type: 'cmms', metric: 'pmr' };
    // "Arızalar Arasındaki Ortalama Süre" = MTBF'in tanimi
    if (t.includes('arızalar aras') || t.includes('arizalar aras')) return { type: 'cmms', metric: 'mtbf' };
    return null;
};
