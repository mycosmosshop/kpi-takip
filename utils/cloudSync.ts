import { KpiData, ActionYearData, KpiLocation } from '../types';

// ERP portal Supabase projesi (erp-guard ile aynı; oturum paylaşılır).
// Publishable key herkese açıktır; veri güvenliği RLS ile sağlanır.
const SUPA_URL = 'https://chchaielttnimuuezazb.supabase.co';
const SUPA_KEY = 'sb_publishable_S2ywbq7TkgcZKiVif3td-A_oAuQL3QT';

let _client: any = null;
export const getClient = (): any => {
    if (_client) return _client;
    const sb = (window as any).supabase;
    if (!sb || !sb.createClient) return null;
    try { _client = sb.createClient(SUPA_URL, SUPA_KEY); } catch { return null; }
    return _client;
};

export const isAuthed = async (): Promise<boolean> => {
    const sb = getClient();
    if (!sb) return false;
    try { const { data } = await sb.auth.getSession(); return !!(data && data.session); } catch { return false; }
};

// ── KPI verisi (lokasyon + yıl) ──
export const cloudFetchKpi = async (loc: string, year: number): Promise<KpiData | null> => {
    const sb = getClient(); if (!sb) return null;
    const { data, error } = await sb.from('kpi_data').select('data').eq('location', loc).eq('year', year).maybeSingle();
    if (error) throw error;
    return data ? (data.data as KpiData) : null;
};
export const cloudSaveKpi = async (loc: string, year: number, data: KpiData): Promise<void> => {
    const sb = getClient(); if (!sb) return;
    const { error } = await sb.from('kpi_data').upsert({ location: loc, year, data, updated_at: new Date().toISOString() }, { onConflict: 'location,year' });
    if (error) throw error;
};

// ── Aksiyon verisi (lokasyon + yıl) ──
export const cloudFetchActions = async (loc: string, year: number): Promise<ActionYearData | null> => {
    const sb = getClient(); if (!sb) return null;
    const { data, error } = await sb.from('kpi_action_data').select('items, next_meeting').eq('location', loc).eq('year', year).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { items: data.items || [], nextMeeting: data.next_meeting || '' };
};
export const cloudSaveActions = async (loc: string, year: number, ad: ActionYearData): Promise<void> => {
    const sb = getClient(); if (!sb) return;
    const { error } = await sb.from('kpi_action_data').upsert({ location: loc, year, items: ad.items, next_meeting: ad.nextMeeting, updated_at: new Date().toISOString() }, { onConflict: 'location,year' });
    if (error) throw error;
};

// ── Meta (ör. lokasyon listesi) ──
export const cloudFetchMeta = async (key: string): Promise<any> => {
    const sb = getClient(); if (!sb) return null;
    const { data, error } = await sb.from('kpi_meta').select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
};
export const cloudSaveMeta = async (key: string, value: any): Promise<void> => {
    const sb = getClient(); if (!sb) return;
    const { error } = await sb.from('kpi_meta').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
};

// ── Realtime abonelik (lokasyon için) ──
export const subscribeLocation = (
    loc: string,
    onKpi: (year: number, data: KpiData) => void,
    onActions: (year: number, ad: ActionYearData) => void,
): (() => void) => {
    const sb = getClient();
    if (!sb) return () => {};
    let channel: any = null;
    try {
        channel = sb.channel(`kpi-sync-${loc}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'kpi_data', filter: `location=eq.${loc}` }, (p: any) => {
                if (p.new && p.new.data) onKpi(p.new.year, p.new.data);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'kpi_action_data', filter: `location=eq.${loc}` }, (p: any) => {
                if (p.new) onActions(p.new.year, { items: p.new.items || [], nextMeeting: p.new.next_meeting || '' });
            })
            .subscribe();
    } catch { /* realtime yoksa sessizce geç */ }
    return () => { try { if (channel) sb.removeChannel(channel); } catch { /* yok say */ } };
};
