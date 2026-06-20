// Tedarikçi Değerlendirme köprüsü (onaylı tedarikçi sistemi = TEK DOĞRULUK KAYNAĞI):
//  - supplier_sync (ERP, oturumlu) → supplierComputedScores: sistemin hesapladığı AYLIK
//    bileşik puan (comp), termin puanı (termin), ppm puanı (ppmp). KPI birebir bunu okur.
//    Ayrıca supplierCategoryMap / supplierStatusMap (kapsam) + supplierFilters (kayıtlı filtre).
//  - supplier_monthly (nnubrxbpthmkitueixbh, anon) → ham İade PPM (Σiade/Σsevk×1M).
//  - mal_kabul (anon) → tedarikçi → lokasyon (gerçek alım depolarının şehri).
// Lokasyon × kapsam × ay (veya kayıtlı filtre × ay) bazında agregat döndürür.
import { getClient as getErpClient } from './cloudSync';

const PT_URL = 'https://nnubrxbpthmkitueixbh.supabase.co';
const PT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udWJyeGJwdGhta2l0dWVpeGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjI2MDIsImV4cCI6MjA5NjEzODYwMn0.CHZUOylf_q8kkOQbFf9VWZ6-doUTlynmAhahM2EuImE';

let _pt: any = null;
const ptClient = (): any => {
    if (_pt) return _pt;
    const sb = (window as any).supabase;
    if (!sb || !sb.createClient) return null;
    try { _pt = sb.createClient(PT_URL, PT_ANON); } catch { return null; }
    return _pt;
};

// Supplier app ile BİREBİR aynı normalizeName (join anahtarı supplier_norm ile eşleşsin)
const normName = (name: any): string => String(name || '')
    .trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:()&\-\/\t'"]+/g, '')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .trim().replace(/\s+/g, ' ');

const depoToLoc = (depo: any): string | null => {
    const d = String(depo || '').toUpperCase();
    if (d.indexOf('CERKEZKOY') === 0 || d.indexOf('ÇERKEZKÖY') === 0) return 'Çerkezköy';
    if (d.indexOf('VELIKOY') === 0 || d.indexOf('VELİKÖY') === 0) return 'Veliköy';
    if (d.indexOf('ESKISEHIR') === 0 || d.indexOf('ESKİŞEHİR') === 0) return 'Eskişehir';
    if (d.indexOf('ADANA') === 0) return 'Adana';
    if (d.indexOf('ANKARA') === 0) return 'Ankara';
    if (d.indexOf('BURSA') === 0) return 'Bursa';
    return null;
};

export type TdScope = 'tum' | 'onayli' | 'otomotiv' | 'onayli_otomotiv' | 'filtre';
export type TdMetric = 'iade_ppm' | 'td_puan' | 'td_terminpuan' | 'td_ppmpuan' | 'td_termin';
export type SupplierFilter = { id: number; name: string; period: string; count: number; selectedSuppliers: string[] };

// Sistemin hesapladığı (supplierComputedScores) skorlara dayanan metrikler
const SCORE_METRICS: TdMetric[] = ['td_puan', 'td_terminpuan', 'td_ppmpuan'];

export const fetchSupplierEvalLocations = async (): Promise<string[]> => {
    return ['Çerkezköy', 'Veliköy', 'Ankara', 'Bursa', 'Adana', 'Eskişehir'];
};

// supplier_sync blob'unu bir kez oku (kategori/durum/skorlar/filtreler)
const readSupplierSync = async (): Promise<any> => {
    try {
        const erp = getErpClient();
        if (!erp) return null;
        const { data } = await erp.from('supplier_sync').select('data').eq('id', 'tedarikci').maybeSingle();
        return (data && data.data) ? data.data : null;
    } catch { return null; }
};

// Onaylı sistemde o yıla ait kayıtlı filtreler (period etiketli + etiketsiz)
export const fetchSupplierFilters = async (year: number): Promise<SupplierFilter[]> => {
    const blob = await readSupplierSync();
    if (!blob) return [];
    let arr: any[] = [];
    try { arr = JSON.parse(blob.supplierFilters || '[]'); } catch { arr = []; }
    if (!Array.isArray(arr)) return [];
    const y = String(year).trim();
    return arr
        .filter(f => { const p = String((f && f.period) || '').trim(); const m = p.match(/(20\d{2})/); return !p || p === y || (m && m[1] === y); })
        .map(f => ({
            id: Number(f.id), name: String(f.name || 'Filtre'), period: String((f.period || '')).trim(),
            count: (f.selectedSuppliers || []).length, selectedSuppliers: (f.selectedSuppliers || []).map(String),
        }));
};

// Lokasyon/kapsam (veya kayıtlı filtre) için aya göre agregat. firma: 'SANIFOAM' | 'ULTECH' ...
export const fetchSupplierEval = async (
    firma: string, year: number, location: string, scope: TdScope, metric: TdMetric,
    opts?: { filterKeys?: string[] },
): Promise<{ [month: number]: { iade_ppm: number | null; td_puan: number | null; td_terminpuan: number | null; td_ppmpuan: number | null; td_termin: number | null } }> => {
    const pt = ptClient();
    if (!pt) throw new Error('Supabase istemcisi yüklenemedi.');

    // 1) supplier_sync blob (kategori/durum + sistemin hesapladığı aylık skorlar + filtre)
    const blob = await readSupplierSync();
    let catMap: any = {}, statusMap: any = {};
    if (blob) {
        try { catMap = JSON.parse(blob.supplierCategoryMap || '{}'); } catch { }
        try { statusMap = JSON.parse(blob.supplierStatusMap || '{}'); } catch { }
    }

    // Sistemin hesapladığı aylık değerler (skorlar + ham sevk/iade/tamamlanma) — norm bazlı + key→norm
    type ScoreRec = { comp: (number | null)[]; termin: (number | null)[]; ppmp: (number | null)[]; sevk: number[]; iade: number[]; tamam: (number | null)[] };
    const scoreByNorm: { [nn: string]: ScoreRec } = {};
    const keyToNorm: { [key: string]: string } = {};
    let scoresPresent = false;
    if (blob) {
        try {
            const store = JSON.parse(blob.supplierComputedScores || '{}') || {};
            const yObj = store[String(year)] || store[year];
            if (yObj && Array.isArray(yObj.suppliers)) {
                scoresPresent = true;
                yObj.suppliers.forEach((s: any) => {
                    const nn = String(s.norm || normName(s.key));
                    if (!nn) return;
                    scoreByNorm[nn] = {
                        comp: s.comp || [], termin: s.termin || [], ppmp: s.ppmp || [],
                        sevk: s.sevk || [], iade: s.iade || [], tamam: s.tamam || [],
                    };
                    if (s.key) keyToNorm[String(s.key)] = nn;
                });
            }
        } catch { }
    }
    if (SCORE_METRICS.indexOf(metric) >= 0 && !scoresPresent) {
        throw new Error(`Sistemin hesapladığı tedarikçi puanları (${year}) bulunamadı. Onaylı Tedarikçi uygulamasını ${year} dönemiyle açıp verinin senkronlanmasını bekleyin (puanlar orada hesaplanır), sonra tekrar çekin.`);
    }

    // 2) Kapsam: hangi tedarikçiler (norm kümesi)?
    let inScope: (nn: string) => boolean;
    if (scope === 'filtre') {
        const set = new Set<string>();
        (opts?.filterKeys || []).forEach(k => { set.add(keyToNorm[k] || normName(k)); });
        inScope = (nn) => set.has(nn);
    } else {
        // Lokasyon (mal_kabul gerçek alım depoları) + kapsam (kategori/durum)
        const locMap: { [nn: string]: Set<string> } = {};
        if (location !== '__ALL__') {
            let off = 0;
            while (true) {
                const { data, error } = await pt.from('mal_kabul').select('cari_adi,depo,iade').range(off, off + 999);
                if (error || !data || !data.length) break;
                data.forEach((r: any) => {
                    if (!r.cari_adi) return;
                    const depoU = (r.depo || '').toUpperCase();
                    const isReturn = (r.iade === 1) || /URUN|ÜRÜN|IADE|İADE/.test(depoU);
                    if (isReturn) return;
                    const loc = depoToLoc(r.depo);
                    if (!loc) return;
                    const nn = normName(r.cari_adi);
                    if (!locMap[nn]) locMap[nn] = new Set();
                    locMap[nn].add(loc);
                });
                if (data.length < 1000) break;
                off += 1000;
            }
        }
        const inLoc = (nn: string) => location === '__ALL__' || (locMap[nn] && locMap[nn].has(location));
        inScope = (nn) => {
            if (!inLoc(nn)) return false;
            const st = String(statusMap[nn] || 'ONAYLI').toUpperCase();
            if (scope === 'tum') return true;
            if (scope === 'otomotiv') return catMap[nn] === 'Otomotiv';
            if (st !== 'ONAYLI') return false;
            if (scope === 'onayli_otomotiv') return catMap[nn] === 'Otomotiv';
            return true; // onayli
        };
    }

    const scoreNorms = Object.keys(scoreByNorm).filter(inScope);
    const avgMonth = (field: 'comp' | 'termin' | 'ppmp', mIdx: number): number | null => {
        let s = 0, n = 0;
        scoreNorms.forEach(nn => {
            const v = scoreByNorm[nn][field][mIdx];
            if (v != null && Number.isFinite(Number(v))) { s += Number(v); n++; }
        });
        return n ? parseFloat((s / n).toFixed(4)) : null;
    };

    // 3) Ham İade PPM + tamamlanma kaynağı:
    //    Skorlar varsa SİSTEMİN kendi aylık sevk/iade/tamamlanma'sı (GENEL PPM ile birebir);
    //    yoksa (eski yıl) supplier_monthly (ayrı LeanSys çekimi) yedek olarak.
    const agg: { [m: number]: { sevk: number; iade: number; tS: number; tN: number } } = {};
    for (let m = 1; m <= 12; m++) agg[m] = { sevk: 0, iade: 0, tS: 0, tN: 0 };
    if (scoresPresent) {
        scoreNorms.forEach(nn => {
            const rec = scoreByNorm[nn];
            for (let m = 1; m <= 12; m++) {
                const a = agg[m];
                a.sevk += Number(rec.sevk[m - 1]) || 0;
                a.iade += Number(rec.iade[m - 1]) || 0;
                const tv = rec.tamam[m - 1];
                if (tv != null && Number.isFinite(Number(tv))) { a.tS += Number(tv); a.tN++; }
            }
        });
    } else {
        let off2 = 0;
        while (true) {
            const { data, error } = await pt.from('supplier_monthly')
                .select('supplier_norm,month,sevk,iade,tamamlanma')
                .eq('firma', firma).eq('year', year).range(off2, off2 + 999);
            if (error) throw error;
            if (!data || !data.length) break;
            data.forEach((r: any) => {
                const nn = r.supplier_norm;
                if (!nn || !inScope(nn)) return;
                const a = agg[r.month];
                if (!a) return;
                a.sevk += Number(r.sevk) || 0;
                a.iade += Number(r.iade) || 0;
                if (r.tamamlanma != null) { a.tS += Number(r.tamamlanma); a.tN++; }
            });
            if (data.length < 1000) break;
            off2 += 1000;
        }
    }

    // Cari aydan sonraki ayları çekme: bulunduğumuz yıl ise yalnızca o aya kadar
    const now = new Date();
    const maxMonth = (year === now.getFullYear()) ? (now.getMonth() + 1) : 12;

    const out: any = {};
    for (let m = 1; m <= 12; m++) {
        const a = agg[m];
        if (m > maxMonth) { out[m] = { iade_ppm: null, td_puan: null, td_terminpuan: null, td_ppmpuan: null, td_termin: null }; continue; }
        out[m] = {
            iade_ppm: a.sevk > 0 ? Math.round(a.iade / a.sevk * 1e6) : null,
            td_puan: avgMonth('comp', m - 1),       // o ayın bileşik puanı
            td_terminpuan: avgMonth('termin', m - 1),
            td_ppmpuan: avgMonth('ppmp', m - 1),
            td_termin: a.tN ? parseFloat((a.tS / a.tN).toFixed(4)) : null,
        };
    }
    return out;
};
