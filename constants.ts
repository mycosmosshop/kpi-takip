import { KpiData, AppearanceTheme, Company, KpiLocation } from './types';

export const AYLAR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Marka/şirket → doküman no, logo dosyası ve antet metni
export const BRANDS: Record<Company, { docNo: string; fileTag: string; logo: string; name: string }> = {
    sanifoam: { docNo: 'FR 100', fileTag: 'FR100', logo: 'SanifoamLogo-Transparent.png', name: 'SANİFOAM' },
    ultech:   { docNo: 'FR 001', fileTag: 'FR001', logo: 'ultech-logo.png',              name: 'ULTECH' },
};

// Varsayılan lokasyonlar (kullanıcı ekleyebilir/silebilir)
export const DEFAULT_LOCATIONS: KpiLocation[] = [
    { id: 'cerkezkoy', name: 'Çerkezköy', company: 'sanifoam' },
    { id: 'velikoy',   name: 'Veliköy',   company: 'sanifoam' },
    { id: 'eskisehir', name: 'Eskişehir', company: 'sanifoam' },
    { id: 'adana',     name: 'Adana',     company: 'sanifoam' },
    { id: 'bursa',     name: 'Bursa',     company: 'sanifoam' },
    { id: 'adapazari', name: 'Adapazarı', company: 'sanifoam' },
    { id: 'ultech1',   name: 'Ultech1',   company: 'ultech' },
    { id: 'ultech2',   name: 'Ultech2',   company: 'ultech' },
];

export const THEMES: Record<AppearanceTheme, Record<string, string>> = {
    default: {
        th: 'p-2 border-b border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700',
        theadRowBg: 'bg-gray-100 dark:bg-gray-700',
        thSticky: '', // bg is in th
        thMonth: 'hover:bg-gray-200 dark:hover:bg-gray-600',
        thMonthSelected: 'bg-blue-200 dark:bg-blue-800',
        thStatic: '', // bg is in th
        tdSticky: '', tdMonth: '', tdAvg: '',
    },
    'corporate-light': {
        th: 'p-2 border-b-2 border-gray-300 dark:border-gray-600 font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800',
        theadRowBg: 'bg-white dark:bg-gray-800',
        thSticky: '', // bg is in th
        thMonth: 'hover:bg-gray-50 dark:hover:bg-gray-700',
        thMonthSelected: 'bg-blue-100 dark:bg-blue-900',
        thStatic: '', // bg is in th
        tdSticky: '', tdMonth: '', tdAvg: '',
    },
    'modern-dark': {
        th: 'p-2 border-b-2 border-blue-500 dark:border-blue-400 font-medium text-gray-100 bg-slate-800 dark:bg-slate-900',
        theadRowBg: 'bg-slate-800 dark:bg-slate-900',
        thSticky: '', // bg is in th
        thMonth: 'hover:bg-slate-700 dark:hover:bg-slate-800',
        thMonthSelected: 'bg-blue-900 dark:bg-blue-600',
        thStatic: '', // bg is in th
        tdSticky: '', tdMonth: '', tdAvg: '',
    }
};


export const initialData: KpiData = {
    yil: 2026,
    kpis: [
        {
            id: 'kpi-uuid-1',
            proses: 'Laminasyon',
            kpi_adi: 'Hurda Oranı (%)',
            sorumlu: 'Üretim Müdürü',
            gozdenGecirmePeriyodu: 'aylik',
            pasifAylar: ['Ağustos'],
            onceki_yil_gerceklesen: 3.1,
            yeni_yil_hedef: 2.5,
            karsilastirma: '<',
            hesap_metodu: 'ortalama',
            birim: '%',
            aciklama: 'Toplam hurda / Toplam üretim',
            kanit_dosyalari: [{ id: 'file-1', name: 'Laminasyon Hurda Raporu (Link)', type: 'link', data: 'https://example.com/laminasyon_hurda_raporu.pdf'}],
            aylik: {
                'Ocak': 2.9, 'Şubat': 2.7, 'Mart': 3.4, 'Nisan': null, 'Mayıs': null, 'Haziran': null,
                'Temmuz': null, 'Ağustos': null, 'Eylül': null, 'Ekim': null, 'Kasım': null, 'Aralık': null
            },
            ortalama: null,
            durum: 'n/a',
            risk: {
                S: 4, O: 3, D: 4, RPN: 48, esik: 40, riskSeviyesi: 'Yüksek'
            },
            dof: [],
            son_guncelleme: '01.03.2026 14:32'
        },
        {
            id: 'kpi-uuid-2',
            proses: 'Kesim',
            kpi_adi: 'Planlanan Teslimata Uyum (%)',
            sorumlu: 'Lojistik Sorumlusu',
            gozdenGecirmePeriyodu: 'aylik',
            onceki_yil_gerceklesen: 93,
            yeni_yil_hedef: 95,
            karsilastirma: '>',
            hesap_metodu: 'yilici_kumulatif',
            birim: '%',
            aciklama: 'Zamanında teslim edilen sipariş / Toplam sipariş',
            kanit_dosyalari: [{ id: 'file-2', name: 'OTD Kesim Raporu (Link)', type: 'link', data: 'https://example.com/otd_kesim.xlsx'}],
            aylik: {
                'Ocak': 94, 'Şubat': 96, 'Mart': 95, 'Nisan': null, 'Mayıs': null, 'Haziran': null,
                'Temmuz': null, 'Ağustos': null, 'Eylül': null, 'Ekim': null, 'Kasım': null, 'Aralık': null
            },
            ortalama: null,
            durum: 'n/a',
            risk: {
                S: 2, O: 2, D: 4, RPN: 16, esik: 40, riskSeviyesi: 'Düşük'
            },
            dof: [],
            son_guncelleme: '01.03.2026 15:00'
        }
    ]
};