// LeanSys kalite KPI köprüsü: uygunsuzluk adedi, müşteri şikayeti, iç PPM,
// dış (müşteri) iade PPM, kalite maliyeti ve maliyetin satışa oranı.
//
// Kaynak zinciri: LeanSys → LeanSys_Agent /kpikalite (_kpikalite_refresh.ps1)
// → Supabase egt_ayar['kpi_kalite'] = [{yer,yil,ay,seg,qi,sikayet,icHatali,icKontrol,
//   iadeMiktar,iadeSevk,sevkSatir,maliyet,maliyetKayit,fiyatsiz,iadeTutar,ciro}]
//
// Kaynak HAM TOPLAM yazar, oranı burada HAVUZLAYARAK hesaplarız: Vileda + Diğer
// toplamının iç PPM'i iki PPM'in ortalaması değil, Σhatalı / Σkontrol'dür.
// Ortalama almak küçük kümeyi büyük kümeyle eşit ağırlıklı yapardı.
//
// Kalite maliyeti TANIMI (kullanıcı 01.11.2026): yalnız hurdaya ayrılan ve iade
// edilen (karar Hurda / Tedarikçiye iade + müşteri iadesi). Kullanılan, düşük
// kalite, şartlı, tamir ve değerlendirmedeki kayıtlar girmez. Uygunsuzluk
// Analizi'ndeki "Kalite Maliyeti Pareto" her kaydı fiyatlar — o başka bir soru.
import { sade, yerEslesir } from './aylikKalite.ts';   // .ts: testte esbuild/strip-types cozebilsin

const KK_URL = 'https://nnubrxbpthmkitueixbh.supabase.co';
const KK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udWJyeGJwdGhta2l0dWVpeGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjI2MDIsImV4cCI6MjA5NjEzODYwMn0.CHZUOylf_q8kkOQbFf9VWZ6-doUTlynmAhahM2EuImE';
const AJAN = 'http://127.0.0.1:17777/kpikalite';

export type KaliteMetric = 'kalite_qi' | 'kalite_sikayet' | 'kalite_ic_ppm' | 'kalite_iade_ppm' | 'kalite_maliyet' | 'kalite_oran';
export type KaliteKapsam = 'tum' | 'vileda' | 'diger';

export interface KaliteSatir {
    yer: string; yil: number; ay: number; seg: 'vileda' | 'diger';
    qi: number; sikayet: number; icHatali: number; icKontrol: number;
    iadeMiktar: number; iadeSevk: number; sevkSatir: number;
    maliyet: number; maliyetKayit: number; fiyatsiz: number; iadeTutar: number; ciro: number;
}

type AyDeger = { [m in KaliteMetric]: number | null };

const n = (v: any): number => { const x = Number(v); return isNaN(x) ? 0 : x; };

// Lokasyon + kapsam + yıl için 12 ayın değerleri. Kaynakta hiç satırı olmayan
// ay = null (NA), 0 değil: "kayıt yok" ile "o ay hiç veri gelmedi" ayrı şey.
export const aylikKalite = (
    rows: KaliteSatir[], lokasyon: string, yil: number, kapsam: KaliteKapsam = 'tum',
): { [month: number]: AyDeger } => {
    const out: { [month: number]: AyDeger } = {};
    for (let m = 1; m <= 12; m++) {
        const s = (rows || []).filter(r => n(r.yil) === yil && n(r.ay) === m && yerEslesir(r.yer, lokasyon)
            && (kapsam === 'tum' || r.seg === kapsam));
        if (!s.length) {
            out[m] = { kalite_qi: null, kalite_sikayet: null, kalite_ic_ppm: null, kalite_iade_ppm: null, kalite_maliyet: null, kalite_oran: null };
            continue;
        }
        const t = (f: keyof KaliteSatir) => s.reduce((a, r) => a + n(r[f]), 0);
        const icK = t('icKontrol'), sevkN = t('sevkSatir'), iade = t('iadeMiktar'), iadeSevk = t('iadeSevk');
        const maliyet = t('maliyet'), ciro = t('ciro');
        out[m] = {
            kalite_qi: t('qi'),
            kalite_sikayet: t('sikayet'),
            kalite_ic_ppm: icK > 0 ? Math.round(t('icHatali') / icK * 1e6) : null,
            // İade yoksa ve o ay sevk varsa 0; sevk de yoksa NA. İade var ama aynı
            // birimde sevk yoksa NA (payda bilinmiyor — uydurma oran yazılmaz).
            kalite_iade_ppm: iade > 0 ? (iadeSevk > 0 ? parseFloat((iade / iadeSevk * 1e6).toFixed(2)) : null)
                : (sevkN > 0 ? 0 : null),
            kalite_maliyet: Math.round(maliyet),
            kalite_oran: ciro > 0 ? parseFloat((maliyet / ciro * 100).toFixed(3)) : null,   // % olarak
        };
    }
    return out;
};

let _client: any = null;
const istemci = (): any => {
    if (_client) return _client;
    const sb = (window as any).supabase;
    if (!sb || !sb.createClient) return null;
    try { _client = sb.createClient(KK_URL, KK_KEY); } catch { return null; }
    return _client;
};

const satirlariOku = async (): Promise<KaliteSatir[]> => {
    const sb = istemci();
    if (!sb) throw new Error('Supabase istemcisi yüklenemedi.');
    const { data, error } = await sb.from('egt_ayar').select('deger').eq('anahtar', 'kpi_kalite').limit(1);
    if (error) throw error;
    const d = data && data.length ? (data[0] as any).deger : null;
    const ham = typeof d === 'string' ? JSON.parse(d) : d;
    return Array.isArray(ham) ? ham as KaliteSatir[] : [];
};

// Bu bilgisayarda LeanSys ajanı çalışıyorsa önce tazelemeyi dener (LeanSys'e
// erişimi olan tek yer ajan). Ajan yoksa/başarısızsa Supabase'teki son çekim
// okunur — başka bilgisayardan açan kullanıcı da çekebilsin.
const tazele = async (yil: number): Promise<string | null> => {
    try {
        const ctl = new AbortController();
        const zaman = setTimeout(() => ctl.abort(), 600000);
        const r = await fetch(`${AJAN}?from=${yil}-01-01&to=${yil + 1}-01-01`, { signal: ctl.signal });
        clearTimeout(zaman);
        const j = await r.json();
        return j && j.ok ? null : (j?.error || 'ajan hatası');
    } catch { return 'ajan yok'; }
};

export const fetchKaliteMetrics = async (
    location: string, year: number, kapsam: KaliteKapsam = 'tum',
): Promise<{ [month: number]: AyDeger }> => {
    await tazele(year);
    const hepsi = await satirlariOku();
    if (!hepsi.some(r => n(r.yil) === year && yerEslesir(r.yer, location))) {
        throw new Error(`${year} / "${location}" için LeanSys kalite verisi yok. LeanSys ajanının çalıştığı bilgisayardan bir kez çekin (/kpikalite).`);
    }
    return aylikKalite(hepsi, location, year, kapsam);
};

// Kaynaktaki lokasyon adları (pencere önerisi için)
export const fetchKaliteYerleri = async (): Promise<string[]> => {
    try { return [...new Set((await satirlariOku()).map(r => sade(r.yer)).filter(Boolean))].sort(); }
    catch { return []; }
};
