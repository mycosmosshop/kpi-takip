// Sipariş tamamlanma köprüsü: siparis_tamamlanma tablosundan aylık yüzde.
//
// Kaynak zinciri: LeanSys/Mikro sevk raporu (0157) → LeanSys_Agent /siptamam
// → Supabase siparis_tamamlanma (depo, year, month, siparis, irsaliye, satir).
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

export const fetchSiparisMetrics = async (
    location: string,
    year: number,
): Promise<{ [month: number]: { siparis_tamamlanma: number | null } }> => {
    const sb = getSiparisClient();
    if (!sb) throw new Error('Supabase istemcisi yüklenemedi.');
    let q = sb.from('siparis_tamamlanma')
        .select('depo,year,month,siparis,irsaliye,satir')
        .eq('year', year)
        .limit(5000);
    // "__ALL__" tüm depolar; aksi hâlde lokasyon ADI depo adının içinde geçmeli.
    if (location && location !== '__ALL__') q = q.ilike('depo', `%${location}%`);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || !data.length) {
        throw new Error(
            `siparis_tamamlanma tablosunda ${year} / "${location}" için kayıt yok. ` +
            `LeanSys ajanında /siptamam tazelemesini çalıştırın (Mikro sevk raporu 0157).`);
    }
    const tam = aylikTamamlanma(data as SiparisSatir[]);
    const out: { [month: number]: { siparis_tamamlanma: number | null } } = {};
    for (let m = 1; m <= 12; m++) out[m] = { siparis_tamamlanma: tam[m].siparis_tamamlanma };
    return out;
};

// Tablodaki depo adlarını getir (lokasyon eşleştirme listesi için)
export const fetchSiparisDepolar = async (): Promise<string[]> => {
    const sb = getSiparisClient();
    if (!sb) return [];
    try {
        const { data } = await sb.from('siparis_tamamlanma').select('depo').limit(5000);
        return [...new Set((data || []).map((r: any) => String(r.depo || '').trim()).filter(Boolean))].sort() as string[];
    } catch { return []; }
};
