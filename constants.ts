import type { KpiData, AppearanceTheme, Company, KpiLocation } from './types';

export const AYLAR = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Bir 8D/DÖF tabloda hangi ay hücresinde görünecek?
// Eşleşme "ayın 2'si" sihirli gününe bağlıydı: hücreden açılan DÖF
// YYYY-MM-02 yazıyordu, kullanıcı başlangıç tarihini elle değiştirince
// (ör. 8D'yi Temmuz'da açıp Haziran'a çekince) gün 02 olmadığı için 8D
// simgesi hiçbir aya düşmüyor, DÖF sessizce "genel" sayılıyordu.
// Artık günü değil, tarihin AYI belirler. Tarihi olmayan veya başka yıla
// ait DÖF genel kalır (ortalama sütunundaki rozet).
export function dofAyi(startDate: any, year: number): string | null {
    const p = String(startDate || '').split('-');
    if (p.length < 2 || Number(p[0]) !== Number(year)) return null;
    const i = Number(p[1]) - 1;
    return Number.isInteger(i) && i >= 0 && i < AYLAR.length ? AYLAR[i] : null;
}

// O ayda hâlâ açık bir 8D/DÖF var mı? Aksiyon panelindeki "8D başlat"
// her tıklamada yeni kayıt açıyordu; aynı KPI'da iki DÖF oluşuyor,
// ikincisi varsayılan tarihle (ayın 2'si + 30 gün) geliyordu.
export function acikDofAyda(dofler: any[], ay: string, year: number): any | undefined {
    if (!ay) return undefined;
    return (dofler || []).find(d => d && d.durum !== 'Tamamlandı'
        && dofAyi(d.start_date, year) === ay);
}

// Marka/şirket → doküman no, logo dosyası ve antet metni.
// unvan: resmî ticaret unvanı — YGG raporunun üst bilgisinde "Firma:" olarak
// yazılır. Yoksa name kullanılır; unvan UYDURULMAZ.
export const BRANDS: Record<Company, {
    docNo: string; fileTag: string; logo: string; name: string; unvan?: string;
}> = {
    sanifoam: {
        docNo: 'FR 100', fileTag: 'FR100', logo: 'SanifoamLogo-Transparent.png',
        name: 'SANİFOAM',
        unvan: 'Sanifoam Endüstri ve Tüketim Ürünleri San.Tic. A.Ş.',
    },
    ultech: {
        docNo: 'FR 001', fileTag: 'FR001', logo: 'ultech-logo.png',
        name: 'ULTECH',
        unvan: 'Ultech Ulaşım Araçları Sanayi ve Ticaret Ltd.Şti',
    },
};

// Varsayılan lokasyonlar (kullanıcı ekleyebilir/silebilir)
export const DEFAULT_LOCATIONS: KpiLocation[] = [
    { id: 'cerkezkoy', name: 'Çerkezköy', company: 'sanifoam' },
    { id: 'velikoy',   name: 'Veliköy',   company: 'sanifoam' },
    { id: 'eskisehir', name: 'Eskişehir', company: 'sanifoam' },
    { id: 'adana',     name: 'Adana',     company: 'sanifoam' },
    { id: 'bursa',     name: 'Bursa',     company: 'sanifoam' },
    { id: 'adapazari', name: 'Adapazarı', company: 'sanifoam' },
    { id: 'ankara',    name: 'Ankara',    company: 'sanifoam' },
    { id: 'ultech1',   name: 'Ultech1',   company: 'ultech' },
    { id: 'ultech2',   name: 'Ultech2',   company: 'ultech' },
];

// Sonradan eklenen varsayılanlar. Lokasyon listesi localStorage/bulutta
// tutulduğu için DEFAULT_LOCATIONS'a eklemek mevcut kullanıcıda görünmez;
// bunlar bayrağı ilk kez işlenirken listeye EKLENİR. Kullanıcı sonradan
// silerse geri gelmez (bkz. utils/lokasyonGoc.ts).
export const YENI_VARSAYILAN_LOKASYONLAR: { bayrak: string; loc: KpiLocation }[] = [
    { bayrak: 'kpi_loc_ankara_v1', loc: { id: 'ankara', name: 'Ankara', company: 'sanifoam' } },
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