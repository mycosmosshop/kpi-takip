// Tedarikçi Değerlendirme köprüsü (KPI app içinde hesaplanır):
//  - supplier_monthly (nnubrxbpthmkitueixbh, anon): aylık sevk/iade/puan/tamamlanma (supplier_norm bazlı)
//  - mal_kabul (anon): tedarikçi → lokasyon (gerçek alım depolarının şehri)
//  - supplier_sync (ERP projesi, oturumlu): supplierCategoryMap / supplierStatusMap (kategori/durum)
// Lokasyon × kapsam × ay bazında agregat döndürür: { ay: {iade_ppm, td_puan, td_termin} }.
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

export type TdScope = 'tum' | 'onayli' | 'otomotiv' | 'onayli_otomotiv';
export type TdMetric = 'iade_ppm' | 'td_puan' | 'td_termin';

export const fetchSupplierEvalLocations = async (): Promise<string[]> => {
    return ['Çerkezköy', 'Veliköy', 'Ankara', 'Bursa', 'Adana', 'Eskişehir'];
};

// Lokasyon + kapsam için aya göre agregat. firma: 'SANIFOAM' | 'ULTECH' ...
export const fetchSupplierEval = async (
    firma: string, year: number, location: string, scope: TdScope,
): Promise<{ [month: number]: { iade_ppm: number | null; td_puan: number | null; td_termin: number | null } }> => {
    const pt = ptClient();
    if (!pt) throw new Error('Supabase istemcisi yüklenemedi.');

    // 1) Kategori / durum (supplier_sync blob, ERP projesi — oturumlu)
    let catMap: any = {}, statusMap: any = {};
    try {
        const erp = getErpClient();
        if (erp) {
            const { data } = await erp.from('supplier_sync').select('data').eq('id', 'tedarikci').maybeSingle();
            if (data && data.data) {
                try { catMap = JSON.parse(data.data.supplierCategoryMap || '{}'); } catch { }
                try { statusMap = JSON.parse(data.data.supplierStatusMap || '{}'); } catch { }
            }
        }
    } catch { /* kategori/durum yoksa kapsam sadece lokasyona göre çalışır */ }

    // 2) Tedarikçi → lokasyon (mal_kabul gerçek alım depoları)
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
                if (isReturn) return; // gerçek alım değil
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
    const inScope = (nn: string) => {
        const st = String(statusMap[nn] || 'ONAYLI').toUpperCase();
        if (scope === 'tum') return true;
        if (scope === 'otomotiv') return catMap[nn] === 'Otomotiv'; // durum farketmez
        if (st !== 'ONAYLI') return false;
        if (scope === 'onayli_otomotiv') return catMap[nn] === 'Otomotiv';
        return true; // onayli
    };

    // 3) supplier_monthly → aya göre agregat
    const agg: { [m: number]: { sevk: number; iade: number; pS: number; pN: number; tS: number; tN: number } } = {};
    for (let m = 1; m <= 12; m++) agg[m] = { sevk: 0, iade: 0, pS: 0, pN: 0, tS: 0, tN: 0 };
    let off2 = 0;
    while (true) {
        const { data, error } = await pt.from('supplier_monthly')
            .select('supplier_norm,month,sevk,iade,puan,tamamlanma')
            .eq('firma', firma).eq('year', year).range(off2, off2 + 999);
        if (error) throw error;
        if (!data || !data.length) break;
        data.forEach((r: any) => {
            const nn = r.supplier_norm;
            if (!nn || !inLoc(nn) || !inScope(nn)) return;
            const a = agg[r.month];
            if (!a) return;
            a.sevk += Number(r.sevk) || 0;
            a.iade += Number(r.iade) || 0;
            if (r.puan != null) { a.pS += Number(r.puan); a.pN++; }
            if (r.tamamlanma != null) { a.tS += Number(r.tamamlanma); a.tN++; }
        });
        if (data.length < 1000) break;
        off2 += 1000;
    }

    // Cari aydan sonraki ayları çekme: bulunduğumuz yıl ise yalnızca o aya kadar
    // (LeanSys'te ileri aylarda puan/termin görünebilir; veriyi değil çekimi sınırlıyoruz)
    const now = new Date();
    const maxMonth = (year === now.getFullYear()) ? (now.getMonth() + 1) : 12;

    const out: any = {};
    for (let m = 1; m <= 12; m++) {
        if (m > maxMonth) { out[m] = { iade_ppm: null, td_puan: null, td_termin: null }; continue; }
        const a = agg[m];
        out[m] = {
            iade_ppm: a.sevk > 0 ? Math.round(a.iade / a.sevk * 1e6) : null,
            td_puan: a.pN ? parseFloat((a.pS / a.pN).toFixed(4)) : null,
            td_termin: a.tN ? parseFloat((a.tS / a.tN).toFixed(4)) : null,
        };
    }
    return out;
};
