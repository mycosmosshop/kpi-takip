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
};

export const kaynakTahmini = (kpi: Kpi | null): { type: SourceType; metric: SourceMetric } | null => {
    // TURKCE 'İ' TUZAGI: 'İade'.toLowerCase() -> 'i' + birlesik nokta (U+0307),
    // yani 'iade' ile eslesmez. "Toplam İade PPM" bu yuzden taninmiyordu.
    // Noktayi atinca hem 'İade' hem 'Iade' 'iade' olur.
    const kucuk = (x: string) => (x || '').toLowerCase().replace(/̇/g, '');
    const p = kucuk(kpi?.proses || '');
    const t = kucuk(kpi?.kpi_adi || '');
    // Tedarikçi değerlendirme KPI'ları (Satınalma prosesi)
    if (t.includes('tedarikçi değerlend') || t.includes('tedarikci degerlend') || (t.includes('iade') && t.includes('ppm')) || (p.includes('satınalma') || p.includes('satinalma'))) {
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
