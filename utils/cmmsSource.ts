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

export type CmmsMetric = 'mtbf' | 'mttr' | 'availability' | 'pmr' | 'pmc' | 'unplanned' | 'mttf';

// Bir lokasyon + yıl için ay→metrik haritası döndürür
export const fetchCmmsMetrics = async (location: string, year: number): Promise<{ [month: number]: Record<CmmsMetric, number | null> }> => {
    const sb = getCmmsClient();
    if (!sb) throw new Error('Supabase istemcisi yüklenemedi.');
    const { data, error } = await sb.from('cmms_metrics').select('month,mtbf,mttr,availability,pmr,pmc,unplanned,mttf').eq('location', location).eq('year', year);
    if (error) throw error;
    const map: { [month: number]: any } = {};
    (data || []).forEach((r: any) => { map[r.month] = { mtbf: r.mtbf, mttr: r.mttr, availability: r.availability, pmr: r.pmr, pmc: r.pmc, unplanned: r.unplanned, mttf: r.mttf }; });
    return map;
};

// CMMS'te tanımlı lokasyonları getir (eşleştirme yardımcı listesi)
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
