// KALİTE MALİYETİ — lokasyon × ay × uygunsuzluk tipi (TL).
//
// Kaynak zinciri: LeanSys (uygunsuzluk × stok hareket TL) → LeanSys_Agent
// /kmaliyet → Supabase egt_ayar['kalite_maliyet'].
//
// TANIM, Uygunsuzluk Analizi uygulamasındaki "Kalite Maliyeti Pareto" ile
// AYNIDIR: birim fiyat = stoğun O AYKI mal kabul (tutar/miktar), yoksa sevk
// (tutar/miktar); maliyet = birim fiyat × hatalı miktar. Fiyatı bulunamayan
// kayıt maliyete katılmaz, AYRICA SAYILIR — "0 TL" ile "fiyatı yok" farklı
// şeyler; ikincisini 0 göstermek maliyeti olduğundan küçük gösterirdi.
import { yerEslesir, tipEslesir } from './aylikKalite.ts';   // .ts: testte strip-types cozebilsin

const KM_URL = 'https://nnubrxbpthmkitueixbh.supabase.co';
const KM_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udWJyeGJwdGhta2l0dWVpeGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjI2MDIsImV4cCI6MjA5NjEzODYwMn0.CHZUOylf_q8kkOQbFf9VWZ6-doUTlynmAhahM2EuImE';

export interface MaliyetSatir {
    yer: string; yil: number; ay: number; tip: string;
    tutar: number; hatali: number; kayit: number;
    eslesmeyen?: number; sifirfiyat?: number;
    // Birim fiyat hangi kademeden geldi (bkz. _kmaliyet_refresh.ps1):
    fAy?: number;      // o ayın alım/satış fiyatı
    fAy2?: number;     // aynı ay, farklı hareket cinsi
    fYakin?: number;   // en yakın ay (TAHMİNİ — 12 ay sınırı)
}

export interface MaliyetOzet {
    toplam: number; ic: number; dis: number; ted: number; diger: number;
    kayit: number; eslesmeyen: number; sifirfiyat: number;
    fAy: number; fAy2: number; fYakin: number;
    onceki: number | null;   // önceki ayın toplamı (yoksa null — 0 değil)
}

const say = (v: any): number => { const n = Number(v); return isNaN(n) ? 0 : n; };

const ayToplami = (
    satirlar: MaliyetSatir[], lokasyon: string, yil: number, ay: number,
): { o: MaliyetOzet; varMi: boolean } => {
    const o: MaliyetOzet = {
        toplam: 0, ic: 0, dis: 0, ted: 0, diger: 0,
        kayit: 0, eslesmeyen: 0, sifirfiyat: 0,
        fAy: 0, fAy2: 0, fYakin: 0, onceki: null,
    };
    let varMi = false;
    (satirlar || []).forEach(r => {
        if (say(r.yil) !== yil || say(r.ay) !== ay) return;
        if (!yerEslesir(r.yer || '', lokasyon)) return;
        varMi = true;
        const t = say(r.tutar);
        o.toplam += t;
        if (tipEslesir(r.tip || '', 'ic')) o.ic += t;
        else if (tipEslesir(r.tip || '', 'dis')) o.dis += t;
        else if (tipEslesir(r.tip || '', 'ted')) o.ted += t;
        else o.diger += t;
        o.kayit += say(r.kayit);
        o.eslesmeyen += say(r.eslesmeyen);
        o.sifirfiyat += say(r.sifirfiyat);
        o.fAy += say(r.fAy); o.fAy2 += say(r.fAy2); o.fYakin += say(r.fYakin);
    });
    return { o, varMi };
};

// Kayıt yoksa null döner: "o ay uygunsuzluk yok" ile "veri çekilmemiş"i
// 0 TL diye aynı göstermek raporu yanlış okutur.
export const maliyetOzet = (
    satirlar: MaliyetSatir[], lokasyon: string, yil: number, ay: number,
): MaliyetOzet | null => {
    const bu = ayToplami(satirlar, lokasyon, yil, ay);
    if (!bu.varMi) return null;
    const oncekiAy = ay === 1 ? 12 : ay - 1;
    const oncekiYil = ay === 1 ? yil - 1 : yil;
    const onc = ayToplami(satirlar, lokasyon, oncekiYil, oncekiAy);
    bu.o.onceki = onc.varMi ? onc.o.toplam : null;
    return bu.o;
};

// Kayıt bazında en pahalı uygunsuzluklar (lokasyon-ay-tip başına ilk 3).
// "Ne kadar?" sorusunun yanında "hangi kayıt, hangi ürün?" cevabı.
export interface MaliyetDetay {
    yer: string; yil: number; ay: number; tip: string;
    no: string; tarih: string; stok: string; cari: string; hataTipi: string;
    miktar: number; birimFiyat: number | null; tutar: number;
    fiyatKaynagi?: string;   // 'ay' | 'ay2' | 'yakin' | 'yok'
    fiyatAyFarki?: number;   // yakın ay ise kaç ay uzakta
}

// Fiyatın nereden geldiğini okunur yazar. "Tahmini" olanı gizlemek,
// denetimde savunulamayan bir tutar bırakırdı.
export const fiyatKaynakMetni = (d: MaliyetDetay): string => {
    switch (d.fiyatKaynagi) {
        case 'ay': return 'o ayın alım/satış fiyatı';
        case 'ay2': return 'aynı ay, farklı hareket cinsi';
        case 'yakin': return `en yakın ay fiyatı (${say(d.fiyatAyFarki)} ay uzak — tahmini)`;
        default: return 'birim fiyat bulunamadı';
    }
};

export const maliyetDetayFiltre = (
    satirlar: MaliyetDetay[], lokasyon: string, yil: number, ay: number,
): MaliyetDetay[] =>
    (satirlar || [])
        .filter(r => say(r.yil) === yil && say(r.ay) === ay && yerEslesir(r.yer || '', lokasyon))
        .sort((a, b) => say(b.tutar) - say(a.tutar));

const egtOku = async (anahtar: string): Promise<any[]> => {
    const sb = (window as any).supabase;
    if (!sb || !sb.createClient) throw new Error('Supabase istemcisi yüklenemedi.');
    const c = sb.createClient(KM_URL, KM_KEY);
    const { data, error } = await c.from('egt_ayar').select('deger').eq('anahtar', anahtar).maybeSingle();
    if (error) throw error;
    if (!data) return [];
    let v: any = data.deger;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
    return Array.isArray(v) ? v : [];
};

export const maliyetDetayCek = async (): Promise<MaliyetDetay[]> =>
    egtOku('kalite_maliyet_detay') as Promise<MaliyetDetay[]>;

// ERP'den gelen başarısızlık maliyetlerinin PAF kalemlerine eşlenmesi.
// TEK yerde: iki ayrı yerde yazıldığında YGG tarafı Türkçe İ yüzünden
// ("Dis" → "DİS") dış başarısızlığı 0 gösteriyordu.
//
// Tedarikçi kaynaklı hata BİZİM tesisimizde yakalanır → İÇ başarısızlık
// kalemidir; dış başarısızlık hatanın MÜŞTERİDE ortaya çıkmasıdır.
export const erpPafKalemleri = (
    satirlar: MaliyetSatir[], lokasyon: string, yil: number, ay?: number,
): { [id: string]: number } => {
    // ERP verisi ÇEKİLMİŞSE üç kalem de dolar; o dönem kaydı olmayan tip
    // 0 TL'dir ("o dönem dış başarısızlık olmadı"). Veri hiç yoksa hiçbiri
    // dolmaz — "girilmedi" ile "0 TL" ayrımı korunur.
    // Ölçüt YIL KAPSAMI: o yıla ait hiç kayıt yoksa veri çekilmemiş
    // demektir → "girilmedi". Yıl varsa, kaydı olmayan tip gerçekten 0'dır.
    if (!satirlar || !satirlar.some(r => say(r.yil) === yil)) return {};
    const t: { [id: string]: number } = { i_hurda: 0, x_iade: 0, i_tedarikci: 0 };
    (satirlar || []).forEach(r => {
        if (say(r.yil) !== yil) return;
        if (ay !== undefined && say(r.ay) !== ay) return;
        if (!yerEslesir(r.yer || '', lokasyon)) return;
        const tut = say(r.tutar);
        if (tipEslesir(r.tip || '', 'ic')) t.i_hurda = (t.i_hurda || 0) + tut;
        else if (tipEslesir(r.tip || '', 'dis')) t.x_iade = (t.x_iade || 0) + tut;
        else if (tipEslesir(r.tip || '', 'ted')) t.i_tedarikci = (t.i_tedarikci || 0) + tut;
    });
    return t;
};

export const maliyetCek = async (): Promise<MaliyetSatir[]> => {
    const sb = (window as any).supabase;
    if (!sb || !sb.createClient) throw new Error('Supabase istemcisi yüklenemedi.');
    const c = sb.createClient(KM_URL, KM_KEY);
    const { data, error } = await c.from('egt_ayar').select('deger').eq('anahtar', 'kalite_maliyet').maybeSingle();
    if (error) throw error;
    if (!data) return [];
    // deger metin de gelebilir (jsonb'ye metin yazılmışsa) — ikisini de karşıla.
    let v: any = data.deger;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
    return Array.isArray(v) ? v as MaliyetSatir[] : [];
};
