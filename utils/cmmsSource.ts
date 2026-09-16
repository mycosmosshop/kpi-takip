// CMMS (Bakım Yönetim Sistemi) köprüsü: cmms_metrics tablosundan aylık MTBF/MTTR okur.
// Cross-project anon okuma (anahtar zaten herkese açık keepalive workflow'unda gömülü; RLS yalnız agregat tabloyu açar).

const CMMS_URL = 'https://bgraqliedgmksqdbddkp.supabase.co';
const CMMS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJncmFxbGllZGdta3NxZGJkZGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODA4MDEsImV4cCI6MjA5NTk1NjgwMX0.htOoBiFUfUsUgkUrbB0BZEanZR5lioYjJYVjobo2oO0';

let _client: any = null;
const getCmmsClient = (): any => {
    if (_client) return _client;
    const sb = (window as any).supabase;
    if (!sb || !sb.createClient) return null;
    try { _client = sb.createClient(CMMS_URL, CMMS_KEY); } catch { return null; }
    return _client;
};

export type CmmsMetric = 'mtbf' | 'mttr' | 'availability' | 'pmr' | 'pmc' | 'unplanned' | 'mttf' | 'cost';

// Bir lokasyon + yıl için ay→metrik haritası döndürür
export const fetchCmmsMetrics = async (location: string, year: number): Promise<{ [month: number]: Record<CmmsMetric, number | null> }> => {
    const sb = getCmmsClient();
    if (!sb) throw new Error('Supabase istemcisi yüklenemedi.');
    // `cost` sütunu tabloda yoksa select hata verir; o durumda cost'suz
    // okunur (alter table cmms_metrics add column if not exists cost numeric).
    let { data, error } = await sb.from('cmms_metrics')
        .select('month,mtbf,mttr,availability,pmr,pmc,unplanned,mttf,cost')
        .eq('location', location).eq('year', year);
    if (error && /cost/i.test((error as any)?.message || '')) {
        ({ data, error } = await sb.from('cmms_metrics')
            .select('month,mtbf,mttr,availability,pmr,pmc,unplanned,mttf')
            .eq('location', location).eq('year', year));
    }
    if (error) throw error;
    const map: { [month: number]: any } = {};
    (data || []).forEach((r: any) => { map[r.month] = { mtbf: r.mtbf, mttr: r.mttr, availability: r.availability, pmr: r.pmr, pmc: r.pmc, unplanned: r.unplanned, mttf: r.mttf, cost: r.cost ?? null }; });

    // Maliyet: cmms_metrics'te `cost` sütunu yoksa ERP ana projesindeki
    // egt_ayar'dan okunur (CMMS oraya da yazar). Sütun eklenirse yukarıdaki
    // değer zaten dolu gelir ve buraya düşülmez.
    if (!Object.values(map).some((m: any) => m && m.cost != null)) {
        const aylik = await fetchMaliyetErp(location, year);
        Object.entries(aylik).forEach(([ay, tl]) => {
            const n = Number(ay);
            if (!map[n]) map[n] = { mtbf:null, mttr:null, availability:null, pmr:null,
                                    pmc:null, unplanned:null, mttf:null, cost:null } as any;
            (map[n] as any).cost = tl;
        });
    }
    return map;
};

// CMMS'te tanımlı lokasyonları getir (eşleştirme yardımcı listesi)
// Bakım maliyeti ERP ana projesindeki egt_ayar'dan: {"1":1650,"2":500,...}
const ERP_URL  = 'https://nnubrxbpthmkitueixbh.supabase.co';
const ERP_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udWJyeGJwdGhta2l0dWVpeGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjI2MDIsImV4cCI6MjA5NjEzODYwMn0.CHZUOylf_q8kkOQbFf9VWZ6-doUTlynmAhahM2EuImE';

export const fetchMaliyetErp = async (location: string, year: number): Promise<Record<string, number>> => {
    try {
        const anahtar = `cmms_maliyet_${location}_${year}`;
        const r = await fetch(`${ERP_URL}/rest/v1/egt_ayar?select=deger&anahtar=eq.${encodeURIComponent(anahtar)}`,
            { headers: { apikey: ERP_ANON, Authorization: `Bearer ${ERP_ANON}` } });
        if (!r.ok) return {};
        const d = await r.json();
        if (!d.length) return {};
        const v = JSON.parse(d[0].deger || '{}');
        const out: Record<string, number> = {};
        Object.entries(v).forEach(([k, x]) => { const n = Number(x); if (!isNaN(n)) out[k] = n; });
        return out;
    } catch { return {}; }
};

export const fetchCmmsLocations = async (): Promise<string[]> => {
    const sb = getCmmsClient();
    if (!sb) return [];
    try {
        const { data, error } = await sb.from('cmms_metrics').select('location');
        if (error) return [];
        return [...new Set((data || []).map((r: any) => r.location).filter(Boolean))] as string[];
    } catch { return []; }
};

// Tek değere formül uygula (x = çekilen değer). Boş formül → x.
export const applySourceFormula = (formula: string | undefined, x: number): number | null => {
    if (!formula || !formula.trim()) return x;
    try {
        // Güvenlik: yalnızca x ve temel Math; global erişimi gölgele
        const f = new Function('x', 'Math', 'window', 'document', 'fetch', 'localStorage',
            `"use strict"; return (${formula});`);
        const r = f(x, Math, undefined, undefined, undefined, undefined);
        return (typeof r === 'number' && isFinite(r)) ? parseFloat(r.toFixed(4)) : null;
    } catch { return null; }
};
