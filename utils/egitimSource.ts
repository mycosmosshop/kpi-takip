// Eğitim & Polivalans köprüsü: egt_egitim tablosundan aylık eğitim KPI'larını hesaplar.
// Tablo anon-okunur (kalite-kontrol projesi nnubrxbpthmkitueixbh); CMMS'ten farklı olarak
// ham satırlar doğrudan okunup KPI app içinde aylık toplanır (ayrı özet tablo gerekmez).

const EGT_URL = 'https://nnubrxbpthmkitueixbh.supabase.co';
const EGT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udWJyeGJwdGhta2l0dWVpeGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjI2MDIsImV4cCI6MjA5NjEzODYwMn0.CHZUOylf_q8kkOQbFf9VWZ6-doUTlynmAhahM2EuImE';

let _client: any = null;
const getEgitimClient = (): any => {
    if (_client) return _client;
    const sb = (window as any).supabase;
    if (!sb || !sb.createClient) return null;
    try { _client = sb.createClient(EGT_URL, EGT_KEY); } catch { return null; }
    return _client;
};

export type EgitimMetric = 'egitim_sure' | 'egitim_gerceklesme';

// Bir lokasyon + yıl için ay→{egitim_sure, egitim_gerceklesme} hesaplar.
//  egitim_sure          = o ay gerçekleşen (gerceklesme=1) eğitimlerin adam·saat toplamı
//  egitim_gerceklesme   = gerçekleşen kayıt / planlanan kayıt × 100 (%)
export const fetchEgitimMetrics = async (location: string, year: number): Promise<{ [month: number]: { egitim_sure: number | null; egitim_gerceklesme: number | null } }> => {
    const sb = getEgitimClient();
    if (!sb) throw new Error('Supabase istemcisi yüklenemedi.');
    const from = `${year}-01-01`, to = `${year + 1}-01-01`;
    // Lokasyon adı kaynakta farklı yazılmış olabilir (app "Çerkezköy" ↔ kayıt "ÇERKEZKÖY MERKEZ")
    // bu yüzden tam eşitlik yerine "içerir" (ilike) ile esnek eşleştir.
    const { data, error } = await sb.from('egt_egitim')
        .select('plan_tarih,sure,gerceklesme')
        .ilike('lokasyon', `%${location}%`)
        .gte('plan_tarih', from)
        .lt('plan_tarih', to)
        .limit(20000);
    if (error) throw error;
    const agg: { [m: number]: { tot: number; real: number; sure: number } } = {};
    (data || []).forEach((r: any) => {
        if (!r.plan_tarih) return;
        const m = new Date(r.plan_tarih).getMonth() + 1;
        if (!agg[m]) agg[m] = { tot: 0, real: 0, sure: 0 };
        agg[m].tot++;
        if (r.gerceklesme === 1 || r.gerceklesme === true) {
            agg[m].real++;
            agg[m].sure += Number(r.sure) || 0;
        }
    });
    const map: { [month: number]: { egitim_sure: number | null; egitim_gerceklesme: number | null } } = {};
    for (let m = 1; m <= 12; m++) {
        const a = agg[m];
        map[m] = a
            ? { egitim_sure: a.sure, egitim_gerceklesme: a.tot > 0 ? parseFloat((a.real / a.tot * 100).toFixed(1)) : null }
            : { egitim_sure: null, egitim_gerceklesme: null };
    }
    return map;
};

// egt_egitim'deki farklı lokasyon adlarını getir (eşleştirme datalist'i için)
export const fetchEgitimLocations = async (): Promise<string[]> => {
    const sb = getEgitimClient();
    if (!sb) return [];
    // PostgREST satır başına ~1000 limitlediği için sayfalayarak tüm distinct lokasyonları topla
    const set = new Set<string>();
    try {
        for (let page = 0; page < 30; page++) {
            const fromR = page * 1000, toR = fromR + 999;
            const { data, error } = await sb.from('egt_egitim').select('lokasyon').range(fromR, toR);
            if (error || !data || data.length === 0) break;
            data.forEach((r: any) => { if (r.lokasyon) set.add(r.lokasyon); });
            if (data.length < 1000) break;
        }
    } catch { /* yoksay */ }
    return [...set].sort();
};
