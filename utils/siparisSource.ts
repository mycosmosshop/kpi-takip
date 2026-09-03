// Sipariş tamamlanma köprüsü: siparis_tamamlanma tablosundan aylık yüzde.
//
// Kaynak zinciri: LeanSys/Mikro sevk raporu (0157) → LeanSys_Agent /siptamam
// → Supabase egt_ayar['siparis_tamamlanma'] = [{depo,year,month,siparis,irsaliye,satir}]
//
// NEDEN AYRI TABLO DEGIL: yeni tablo acmak Supabase SQL Editor'de elle DDL
// calistirmayi gerektiriyor. egt_ayar (anahtar → JSON) zaten var ve aynı
// desen pol_seviye_egitim / pol_egitim_eslesme icin kullaniliyor. Tek satir
// oldugu icin de Supabase sismiyor.
//
// KURAL (kaynakta uygulanır): yalnızca SİPARİŞE BAĞLI satırlar (siparis > 0).
// Sipariş miktarı 0 olan satırlar sevkiyattır ama sipariş değildir; irsaliyesini
// paya ekleyip paydaya bir şey koymamak oranı şişirir — ölçüm: Ankara Mayıs 2026
// bu satırlar dahil edilince %110,97 (imkânsız), hariç tutulunca %88,23.
//
// Lokasyon → depo eşleşmesi ÖNEK iledir ("Ankara" → "ANKARA ÜRÜN DEPO",
// "ANKARA ÜRETİM DEPO"...). Bir lokasyonun birden çok deposu olabilir; ay
// bazında Σsipariş ve Σirsaliye havuzlanır, sonra bölünür. Depoları tek tek
// bölüp ortalamak, küçük depoyu büyük depoyla eşit ağırlıklı yapardı.

const SIP_URL = 'https://nnubrxbpthmkitueixbh.supabase.co';
const SIP_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udWJyeGJwdGhta2l0dWVpeGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjI2MDIsImV4cCI6MjA5NjEzODYwMn0.CHZUOylf_q8kkOQbFf9VWZ6-doUTlynmAhahM2EuImE';

let _client: any = null;
const getSiparisClient = (): any => {
    if (_client) return _client;
    const sb = (window as any).supabase;
    if (!sb || !sb.createClient) return null;
    try { _client = sb.createClient(SIP_URL, SIP_KEY); } catch { return null; }
    return _client;
};

export type SiparisMetric = 'siparis_tamamlanma';

export interface SiparisSatir {
    depo: string; year: number; month: number;
    siparis: number; irsaliye: number; satir: number;
}

// Aylık havuzlama: Σirsaliye / Σsipariş × 100. Siparişi olmayan ay = null
// (0 yazmak "hiç sevk edilmedi" gibi okunur; oysa o ay sipariş yoktur).
export const aylikTamamlanma = (
    rows: SiparisSatir[],
): { [month: number]: { siparis_tamamlanma: number | null; siparis: number; irsaliye: number; satir: number } } => {
    const agg: { [m: number]: { s: number; i: number; n: number } } = {};
    (rows || []).forEach(r => {
        const m = Number(r.month);
        if (!(m >= 1 && m <= 12)) return;
        if (!agg[m]) agg[m] = { s: 0, i: 0, n: 0 };
        agg[m].s += Number(r.siparis) || 0;
        agg[m].i += Number(r.irsaliye) || 0;
        agg[m].n += Number(r.satir) || 0;
    });
    const out: { [month: number]: { siparis_tamamlanma: number | null; siparis: number; irsaliye: number; satir: number } } = {};
    for (let m = 1; m <= 12; m++) {
        const a = agg[m];
        out[m] = a && a.s > 0
            ? { siparis_tamamlanma: parseFloat((a.i / a.s * 100).toFixed(2)), siparis: a.s, irsaliye: a.i, satir: a.n }
            : { siparis_tamamlanma: null, siparis: a ? a.s : 0, irsaliye: a ? a.i : 0, satir: a ? a.n : 0 };
    }
    return out;
};

// Depo adi lokasyonu iceriyor mu?
// OLCUM: LeanSys'teki depo adlari Turkce karaktersiz yazilmis —
// "CERKEZKOY URUN DEPO", "ANKARA URUN DEPO" (ama "BANT ÜRÜN DEPO" var).
// Uygulamadaki lokasyon ise "Çerkezköy". Duz karsilastirma bunu kacirir,
// o yuzden iki taraf da buyuk harfe cevrilip Turkce harfler sadelestirilir.
const TR: { [k: string]: string } = { 'Ç': 'C', 'Ö': 'O', 'Ü': 'U', 'İ': 'I', 'I': 'I', 'Ş': 'S', 'Ğ': 'G' };
const buyuk = (x: string) =>
    (x || '').toLocaleUpperCase('tr').trim().replace(/[ÇÖÜİIŞĞ]/g, c => TR[c]);
export const depoEslesir = (depo: string, location: string) =>
    !location || location === '__ALL__' || buyuk(depo).includes(buyuk(location));

// egt_ayar'daki tek satiri okur; dizi degilse bos doner.
const satirlariOku = async (): Promise<SiparisSatir[]> => {
    const sb = getSiparisClient();
    if (!sb) throw new Error('Supabase istemcisi yüklenemedi.');
    const { data, error } = await sb.from('egt_ayar').select('deger').eq('anahtar', 'siparis_tamamlanma').limit(1);
    if (error) throw error;
    const d = data && data.length ? (data[0] as any).deger : null;
    const ham = typeof d === 'string' ? JSON.parse(d) : d;
    return Array.isArray(ham) ? ham as SiparisSatir[] : [];
};

export const fetchSiparisMetrics = async (
    location: string,
    year: number,
): Promise<{ [month: number]: { siparis_tamamlanma: number | null } }> => {
    const hepsi = await satirlariOku();
    const secili = hepsi.filter(r => Number(r.year) === year && depoEslesir(r.depo, location));
    if (!secili.length) {
        throw new Error(
            `${year} / "${location}" için sipariş kaydı yok. ` +
            `LeanSys ajanında /siptamam tazelemesini çalıştırın (Mikro sevk raporu 0157).`);
    }
    const tam = aylikTamamlanma(secili);
    const out: { [month: number]: { siparis_tamamlanma: number | null } } = {};
    for (let m = 1; m <= 12; m++) out[m] = { siparis_tamamlanma: tam[m].siparis_tamamlanma };
    return out;
};

// Tablodaki depo adlarını getir (lokasyon eşleştirme listesi için)
export const fetchSiparisDepolar = async (): Promise<string[]> => {
    try {
        const hepsi = await satirlariOku();
        return [...new Set(hepsi.map(r => String(r.depo || '').trim()).filter(Boolean))].sort() as string[];
    } catch { return []; }
};
