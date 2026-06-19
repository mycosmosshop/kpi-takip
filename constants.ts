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
    kpis: [],
};