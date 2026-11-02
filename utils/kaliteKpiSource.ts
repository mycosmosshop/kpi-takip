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
import { sade, yerEslesir, kaynakYeri } from './aylikKalite.ts';   // .ts: testte esbuild/strip-types cozebilsin

const KK_URL = 'https://nnubrxbpthmkitueixbh.supabase.co';
const KK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udWJyeGJwdGhta2l0dWVpeGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjI2MDIsImV4cCI6MjA5NjEzODYwMn0.CHZUOylf_q8kkOQbFf9VWZ6-doUTlynmAhahM2EuImE';
const AJAN = 'http://127.0.0.1:17777/kpikalite';

export type KaliteMetric = 'kalite_qi' | 'kalite_sikayet' | 'kalite_ic_ppm' | 'kalite_ic_ppm_uretim' | 'kalite_ic_ppm_paket' | 'kalite_fire_ppm' | 'kalite_iade_ppm' | 'kalite_maliyet' | 'kalite_oran' | 'plan_termin' | 'plan_gecikme' | 'kalite_oee_uretim' | 'kalite_oee_paket' | 'finans_ebitda'
    | 'kalite_ic_nc' | 'kalite_td_nc' | 'kalite_maliyet_ic' | 'kalite_maliyet_dis';
export type KaliteKapsam = 'tum' | 'vileda' | 'diger' | 'otomotiv' | 'otomotiv_disi';

export interface KaliteSatir {
    yer: string; yil: number; ay: number; seg: 'vileda' | 'otomotiv' | 'diger';
    qi: number; sikayet: number; icHatali: number; icKontrol: number;
    icNc?: number; tdNc?: number; maliyetDis?: number;   // iç / tedarikçi uygunsuzluk adedi; maliyetin kalite kaynaklı müşteri iadesi kısmı (02.11.2026)
    icPay?: number; icPayda?: number; ekYeri?: number;   // iç PPM: (hatalı − ek yeri) / üretim
    icPayU?: number; icPaydaU?: number; icPayP?: number; icPaydaP?: number;   // aynısı proses bazında: Üretim / Paketleme makineleri
    iadeMiktar: number; iadeSevk: number; sevkSatir: number;
    maliyet: number; maliyetKayit: number; fiyatsiz: number; iadeTutar: number; ciro: number;
    sipSatir?: number; sipZamaninda?: number; sipGecikmeGun?: number;
    oeePlanU?: number; oeeWU?: number; oeePlanP?: number; oeeWP?: number;
    ebitdaKum?: number; satisKum?: number;   // EBITDA: yılbaşından o aya kümülatif (TL), yalnız Veliköy 'diger' satırında   // OEE: Σ planlı süre, Σ OEE × planlı süre (yalnız 'diger' satırında)   // müşteri sipariş satırı: teslim tarihi o ay ve geçmiş
}

type AyDeger = { [m in KaliteMetric]: number | null };

const n = (v: any): number => { const x = Number(v); return isNaN(x) ? 0 : x; };

// Lokasyon + kapsam + yıl için 12 ayın değerleri. Kaynakta hiç satırı olmayan
// ay = null (NA), 0 değil: "kayıt yok" ile "o ay hiç veri gelmedi" ayrı şey.
// 'diger' = Vileda dışı (Veliköy satırları otomotiv ayrımından etkilenmez); 'otomotiv_disi' = otomotiv dışı (Çerkezköy 'Diğer')
const kapsamda = (seg: string, k: KaliteKapsam): boolean =>
    k === 'tum' || (k === 'vileda' ? seg === 'vileda' : k === 'diger' ? seg !== 'vileda' : k === 'otomotiv' ? seg === 'otomotiv' : seg !== 'otomotiv');

export const aylikKalite = (
    rows: KaliteSatir[], lokasyon: string, yil: number, kapsam: KaliteKapsam = 'tum',
): { [month: number]: AyDeger } => {
    const out: { [month: number]: AyDeger } = {};
    for (let m = 1; m <= 12; m++) {
        const s = (rows || []).filter(r => n(r.yil) === yil && n(r.ay) === m && yerEslesir(r.yer, lokasyon)
            && kapsamda(r.seg, kapsam));
        if (!s.length) {
            out[m] = { kalite_qi: null, kalite_sikayet: null, kalite_ic_ppm: null, kalite_ic_ppm_uretim: null, kalite_ic_ppm_paket: null, kalite_fire_ppm: null, kalite_iade_ppm: null, kalite_maliyet: null, kalite_oran: null, plan_termin: null, plan_gecikme: null, kalite_oee_uretim: null, kalite_oee_paket: null, finans_ebitda: null, kalite_ic_nc: null, kalite_td_nc: null, kalite_maliyet_ic: null, kalite_maliyet_dis: null };
            continue;
        }
        const t = (f: keyof KaliteSatir) => s.reduce((a, r) => a + n(r[f]), 0);
        const sevkN = t('sevkSatir'), iade = t('iadeMiktar'), iadeSevk = t('iadeSevk');
        const maliyet = t('maliyet'), ciro = t('ciro');
        // Payda ÜRETİM (2025 İç PPM dosyasıyla aynı). Kontrol miktarı yalnız uygunsuzluk
        // açılan partileri içerdiği için oranı şişiriyordu (Mart 103.884'e karşı 35.448).
        const payda = t('icPayda');
        // 02.11.2026'dan önceki çekimde bu alanlar yok → 0 değil NA
        const yeni = (f: keyof KaliteSatir) => s.some(r => r[f] !== undefined && r[f] !== null);
        const disM = yeni('maliyetDis') ? t('maliyetDis') : null;
        out[m] = {
            kalite_qi: t('qi'),
            kalite_sikayet: t('sikayet'),
            kalite_ic_ppm: payda > 0 ? Math.round(t('icPay') / payda * 1e6) : null,
            // Proses: makine adında PAKETLEME geçen makineler Paketleme, diğerleri Üretim — pay ve payda aynı prosesten
            kalite_ic_ppm_uretim: t('icPaydaU') > 0 ? Math.round(t('icPayU') / t('icPaydaU') * 1e6) : null,
            kalite_ic_ppm_paket: t('icPaydaP') > 0 ? Math.round(t('icPayP') / t('icPaydaP') * 1e6) : null,
            // Ek yeri: rulo malzemede bilerek bulunur, ayıklanması planlı → PPM değil fire
            kalite_fire_ppm: payda > 0 ? Math.round(t('ekYeri') / payda * 1e6) : null,
            // İade yoksa ve o ay sevk varsa 0; sevk de yoksa NA. İade var ama aynı
            // birimde sevk yoksa NA (payda bilinmiyor — uydurma oran yazılmaz).
            kalite_iade_ppm: iade > 0 ? (iadeSevk > 0 ? parseFloat((iade / iadeSevk * 1e6).toFixed(2)) : null)
                : (sevkN > 0 ? 0 : null),
            kalite_maliyet: Math.round(maliyet),
            kalite_oran: ciro > 0 ? parseFloat((maliyet / ciro * 100).toFixed(3)) : null,   // % olarak
            // Planlama: teslim tarihine kadar ≥%98 sevk edilen satır oranı; gecikme günü tüm satırlara bölünür (zamanında = 0)
            plan_termin: t('sipSatir') > 0 ? parseFloat((t('sipZamaninda') / t('sipSatir') * 100).toFixed(2)) : null,
            plan_gecikme: t('sipSatir') > 0 ? parseFloat((t('sipGecikmeGun') / t('sipSatir')).toFixed(2)) : null,
            // OEE: makine OEE'lerinin planlı süreyle ağırlıklı ortalaması (%); Vileda/Diğer kırılımı yok → kapsam 'diger'de kalır
            kalite_oee_uretim: t('oeePlanU') > 0 ? parseFloat((t('oeeWU') / t('oeePlanU') * 100).toFixed(1)) : null,
            kalite_oee_paket: t('oeePlanP') > 0 ? parseFloat((t('oeeWP') / t('oeePlanP') * 100).toFixed(1)) : null,
            // EBITDA %: yılbaşından o aya kümülatif (aylık oran iç satış zamanlaması / yıl sonu düzeltmeleriyle çok oynuyor)
            finans_ebitda: t('satisKum') > 0 ? parseFloat((t('ebitdaKum') / t('satisKum') * 100).toFixed(1)) : null,
            kalite_ic_nc: yeni('icNc') ? t('icNc') : null,
            kalite_td_nc: yeni('tdNc') ? t('tdNc') : null,
            // İç başarısızlık maliyeti = hurda + tedarikçiye iade kararlı uygunsuzluklar; dış = kalite kaynaklı müşteri iadesi
            kalite_maliyet_ic: disM === null ? null : Math.round(maliyet - disM),
            kalite_maliyet_dis: disM === null ? null : Math.round(disM),
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
// Tazeleme tüm şubeleri baştan hesaplar (ölçüm: ~9 dk). Aynı sayfa oturumunda
// yıl başına BİR KEZ yapılır; sonraki KPI satırları Supabase'teki taze çekimi
// okur. Yoksa her satır bağlanırken 9 dk beklenirdi.
// Veri 6 saatten yeniyse (her gün 12:00 görevi tazeliyor) ajan hiç beklenmez: tazeleme OEE / EBITDA / iki DB
// siparişiyle 10–15 dk sürüyor ve ilk "Çek" o kadar takılı görünüyordu (kullanıcı 02.11.2026).
const tazeMi = async (): Promise<boolean> => {
    try {
        const { data } = await istemci().from('egt_ayar').select('updated_at').eq('anahtar', 'kpi_kalite').limit(1);
        const t = data && data.length ? Date.parse((data[0] as any).updated_at) : NaN;
        return !isNaN(t) && Date.now() - t < 6 * 3600 * 1000;
    } catch { return false; }
};
const tazelenenYillar = new Set<number>();
const tazele = async (yil: number): Promise<string | null> => {
    if (tazelenenYillar.has(yil)) return null;
    tazelenenYillar.add(yil);   // başarısız olsa da oturumda yeniden denenmez — her satır 10 dk beklemesin
    if (await tazeMi()) return null;
    try {
        const ctl = new AbortController();
        const zaman = setTimeout(() => ctl.abort(), 600000);
        const r = await fetch(`${AJAN}?from=${yil}-01-01&to=${yil + 1}-01-01`, { signal: ctl.signal });
        clearTimeout(zaman);
        const j = await r.json();
        if (j && j.ok) return null;
        return j?.error || 'ajan hatası';
    } catch { return 'ajan yok'; }
};

// KANIT Excel'i (her sayının satırları: uygunsuzluklar, hata tipleri, üretim, iadeler, satış, yöntem):
// LeanSys ajanı /kpikanit → D:\Yazılım\16QA\kpi_kalite_kanit.py üretip kaydeder; indir=true ise dosya döner.
// Yalnız ajanın çalıştığı bilgisayarda olur (LeanSys'e erişim orada); başka yerde her gün 12:00'deki dosya kalır.
const AJAN_KANIT = 'http://127.0.0.1:17777/kpikanit';
export const kanitUret = async (location: string, year: number, indir: boolean): Promise<{ ok: boolean; yol?: string; hata?: string }> => {
    try {
        const r = await fetch(`${AJAN_KANIT}?yer=${encodeURIComponent(kaynakYeri(location))}&yil=${year}&indir=${indir ? 1 : 0}`);
        const j = await r.json();
        if (!j || !j.ok) return { ok: false, hata: j?.error || 'kanıt üretilemedi' };
        if (indir && j.b64) {
            const ikili = Uint8Array.from(atob(j.b64), c => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([ikili], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            const a = document.createElement('a'); a.href = url; a.download = j.ad || `KPI ${year} kanit.xlsx`; a.click();
            URL.revokeObjectURL(url);
        }
        return { ok: true, yol: j.yol };
    } catch { return { ok: false, hata: 'LeanSys ajanı bu bilgisayarda çalışmıyor' }; }
};

// LeanSys çekiminden sonra kanıt dosyası arka planda tazelenir — oturumda lokasyon×yıl başına bir kez
// (her KPI satırında yeniden üretmek gereksiz; aynı veriden çıkar).
const kanitTazelenen = new Set<string>();

export const fetchKaliteMetrics = async (
    location: string, year: number, kapsam: KaliteKapsam = 'tum',
): Promise<{ [month: number]: AyDeger }> => {
    await tazele(year);
    const kk = `${sade(location)}|${year}`;
    if (!kanitTazelenen.has(kk)) { kanitTazelenen.add(kk); kanitUret(location, year, false).then(s => { if (!s.ok) kanitTazelenen.delete(kk); }); }
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
