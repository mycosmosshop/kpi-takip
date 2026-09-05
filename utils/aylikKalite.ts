// Aylık Kalite Raporu — LOKASYON bazlı, ERP verisinden.
//
// Kaynak: uygunsuzluk_records (LeanSys → Supabase). Alanlar:
//   tipi         : "Iç basarisizlik" | "Dis Basarisizlik" | "Tedarikçi" | "Diger"
//   tespitYeri   : "ANKARA SUBESI", "ÇERKEZKÖY TEKNIK", "VELIKÖY SUBESI"...
//   cariAdi      : müşteri (dış başarısızlıkta), tedarikçi (tedarikçi tipinde)
//   stokAdi      : ürün
//   hataliMiktar : hatalı adet
//   uygunsuzlukTarih : "GG.AA.YYYY"
//
// PPM'in kendisi KPI tablosundan gelir (zaten ERP'den çekilip doğrulanmış);
// burada üretilen şey KIRILIM: ilk 3 müşteri / ilk 3 ürün ve önceki ay trendi.
// PPM'i burada yeniden hesaplamak iki farklı sayı doğururdu.

const UYG_URL = 'https://nnubrxbpthmkitueixbh.supabase.co';
const UYG_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udWJyeGJwdGhta2l0dWVpeGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjI2MDIsImV4cCI6MjA5NjEzODYwMn0.CHZUOylf_q8kkOQbFf9VWZ6-doUTlynmAhahM2EuImE';

export interface UygKayit {
    tipi?: string; tespitYeri?: string; cariAdi?: string; stokAdi?: string; stokKodu?: string;
    hataliMiktar?: number; kontrolMiktar?: number; partiHacmi?: number; uygunsuzlukTarih?: string;
    tarif?: string; makine?: string; hataTipi?: string;
}

// Türkçe harf farkını yok say: "ÇERKEZKÖY TEKNIK" ile "Çerkezköy" eşleşsin.
const TR: { [k: string]: string } = { 'Ç': 'C', 'Ö': 'O', 'Ü': 'U', 'İ': 'I', 'I': 'I', 'Ş': 'S', 'Ğ': 'G' };
export const sade = (x: string): string =>
    String(x || '').toLocaleUpperCase('tr').trim().replace(/[ÇÖÜİIŞĞ]/g, c => TR[c]);

// tespitYeri lokasyona ait mi? "ANKARA SUBESI" → "Ankara"
export const yerEslesir = (tespitYeri: string, lokasyon: string): boolean => {
    const y = sade(tespitYeri), l = sade(lokasyon);
    return !!l && y.indexOf(l) === 0;
};

// "GG.AA.YYYY" → {yil, ay}. Başka biçim gelirse null — tarihi tahmin etme.
export const tarihAyir = (t: string): { yil: number; ay: number } | null => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(t || '').trim());
    if (!m) return null;
    return { yil: Number(m[3]), ay: Number(m[2]) };
};

const TIP = {
    ic: 'IC BASARISIZLIK',
    dis: 'DIS BASARISIZLIK',
    ted: 'TEDARIKCI',
};

// Tip metni hangi sınıfa ait? ("Iç basarisizlik" → 'ic'). Türkçe harf farkı
// katlanır; maliyet tablosu da AYNI metinleri taşıdığı için ortak kullanılır.
export const tipEslesir = (tipMetni: string, hangi: keyof typeof TIP): boolean =>
    sade(tipMetni).indexOf(TIP[hangi]) === 0;

export const tipiOlan = (k: UygKayit, hangi: keyof typeof TIP): boolean =>
    tipEslesir(k.tipi || '', hangi);

export interface KirilimSatir { ad: string; adet: number; miktar: number; oncekiMiktar: number | null; }

// Belirli tipteki kayıtları bir alana göre topla, ilk N'i döndür.
// Önceki ay değeri KARŞILAŞTIRMA için taşınır ("önceki aya ait trend").
export const ilkN = (
    kayitlar: UygKayit[], lokasyon: string, yil: number, ay: number,
    hangi: 'ic' | 'dis' | 'ted', alan: 'cariAdi' | 'stokAdi', n = 3,
): KirilimSatir[] => {
    const oncekiAy = ay === 1 ? 12 : ay - 1;
    const oncekiYil = ay === 1 ? yil - 1 : yil;
    const buAy = new Map<string, { adet: number; miktar: number }>();
    const gecen = new Map<string, number>();

    (kayitlar || []).forEach(k => {
        if (!tipiOlan(k, hangi)) return;
        if (!yerEslesir(k.tespitYeri || '', lokasyon)) return;
        const t = tarihAyir(k.uygunsuzlukTarih || '');
        if (!t) return;
        const ad = String(k[alan] || '').trim() || '(tanımsız)';
        const mik = Number(k.hataliMiktar) || 0;
        if (t.yil === yil && t.ay === ay) {
            const v = buAy.get(ad) || { adet: 0, miktar: 0 };
            v.adet++; v.miktar += mik; buAy.set(ad, v);
        } else if (t.yil === oncekiYil && t.ay === oncekiAy) {
            gecen.set(ad, (gecen.get(ad) || 0) + mik);
        }
    });

    return Array.from(buAy.entries())
        .map(([ad, v]) => ({
            ad, adet: v.adet, miktar: v.miktar,
            // Önceki ayda kaydı yoksa 0 değil NULL: "0 hata" ile "kayıt yok"
            // farklı şeyler; 0 yazmak sahte iyileşme gösterirdi.
            oncekiMiktar: gecen.has(ad) ? gecen.get(ad)! : null,
        }))
        .sort((a, b) => b.miktar - a.miktar || b.adet - a.adet)
        .slice(0, n);
};

// PPM = Σhatalı / Σparti hacmi × 1e6 — Uygunsuzluk Analizi uygulamasının
// kullandığı tanımın AYNISI. Farklı bir payda seçmek ikinci bir "doğru"
// sayı üretirdi. Parti hacmi yoksa PPM hesaplanmaz (null), 0 yazılmaz.
export interface PpmSonuc { ppm: number | null; hatali: number; parti: number; kayit: number; }

export const ppmParti = (
    kayitlar: UygKayit[], lokasyon: string, yil: number, ay: number,
    hangi: 'ic' | 'dis' | 'ted',
): PpmSonuc => {
    const r: PpmSonuc = { ppm: null, hatali: 0, parti: 0, kayit: 0 };
    (kayitlar || []).forEach(k => {
        if (!tipiOlan(k, hangi)) return;
        if (!yerEslesir(k.tespitYeri || '', lokasyon)) return;
        const t = tarihAyir(k.uygunsuzlukTarih || '');
        if (!t || t.yil !== yil || t.ay !== ay) return;
        r.kayit++;
        r.hatali += Number(k.hataliMiktar) || 0;
        r.parti += Number(k.partiHacmi) || Number(k.kontrolMiktar) || 0;
    });
    if (r.parti > 0) r.ppm = Math.round((r.hatali / r.parti) * 1e6);
    return r;
};

// KPI adını Türkçe'ye DAYANIKLI ara. JS'te /iç ppm/i ifadesi "İç PPM Oranı"yı
// BULAMAZ ('İ'.toUpperCase() === 'İ' ≠ 'I'); rapor bu yüzden hem "KPI tanımlı
// değil" diyor hem de "Toplam İade PPM" yerine adında düz 'i' olan TEDARİKÇİ
// KPI'sını yakalıyordu. Arama sade() ile katlanır.
export const adGecer = (ad: string, kelimeler: string[]): boolean => {
    const a = sade(ad);
    return kelimeler.some(k => a.indexOf(sade(k)) >= 0);
};

export const kpiAra = <T extends { kpi_adi: string }>(
    kpis: T[], iceren: string[], haric: string[] = [],
): T | null =>
    (kpis || []).find(k => adGecer(k.kpi_adi || '', iceren)
        && !(haric.length && adGecer(k.kpi_adi || '', haric))) || null;

// Uygunsuzluk/DÖF kayıtlarının AYRINTISI: no, sebep, miktar, karar,
// yapılan işlem. Rapor "3 kayıt var" demekle kalmamalı; denetimde
// "hangi kayıt, ne yapıldı?" sorusunun cevabı burada.
export interface UygSatir {
    no: string; tarih: string; cari: string; stok: string; stokKodu: string;
    miktar: number; parti: number; tur: string; hataTipi: string; kaynak: string;
    tarif: string; karar: string; sonuc: string; makine: string;
    kapatma: string; kapali: boolean;
}

const kis = (t: any, n: number): string => {
    const x = String(t || '').replace(/\s+/g, ' ').trim();
    return x.length > n ? x.slice(0, n - 1) + '…' : x;
};

export const uygAyrinti = (
    kayitlar: UygKayit[], lokasyon: string, yil: number, ay: number,
    hangi: 'ic' | 'dis' | 'ted', n = 25,
): UygSatir[] => {
    const c: UygSatir[] = [];
    (kayitlar || []).forEach((k: any) => {
        if (!tipiOlan(k, hangi)) return;
        if (!yerEslesir(k.tespitYeri || '', lokasyon)) return;
        const t = tarihAyir(k.uygunsuzlukTarih || '');
        if (!t || t.yil !== yil || t.ay !== ay) return;
        const kapatma = String(k.kapatmaTarihi || '').trim();
        c.push({
            no: [k.uygunsuzlukSeri, k.uygunsuzlukSira].filter(Boolean).join('-') || '(no yok)',
            tarih: String(k.uygunsuzlukTarih || ''),
            cari: kis(k.cariAdi, 40),
            stok: kis(k.stokAdi, 45),
            stokKodu: String(k.stokKodu || ''),
            miktar: Number(k.hataliMiktar) || 0,
            parti: Number(k.partiHacmi) || Number(k.kontrolMiktar) || 0,
            tur: String(k.uygunsuzlukTuru || ''),
            hataTipi: String(k.hataTipi || ''),
            kaynak: String(k.hataKaynagi || ''),
            tarif: kis(k.tarif, 120),
            karar: kis(k.karar, 60),
            sonuc: kis(k.sonuc, 120),
            makine: kis(k.makine, 35),
            kapatma,
            // Kapatma tarihi boşsa AÇIK. "Kapandı mı?" sorusunun cevabı
            // uydurulmaz; alan boşsa açık sayılır.
            kapali: kapatma.length > 0,
        });
    });
    return c.sort((a, b) => b.miktar - a.miktar).slice(0, n);
};

// Kayıt satırını tek satırlık okunur metne çevirir (rapor gri kutusu).
export const uygSatirMetni = (r: UygSatir): string =>
    `${r.no} · ${r.tarih}`
    + (r.cari ? ` · ${r.cari}` : '')
    + (r.stok ? ` · ${r.stok}` : '')
    + ` · ${r.miktar.toLocaleString('tr-TR')} adet hatalı`
    + (r.parti ? ` / ${r.parti.toLocaleString('tr-TR')} parti` : '')
    + (r.hataTipi ? ` · hata: ${r.hataTipi}` : '')
    + (r.kaynak ? ` · kaynak: ${r.kaynak}` : '')
    + (r.makine ? ` · makine: ${r.makine}` : '')
    + (r.tarif ? ` · tarif: ${r.tarif}` : '')
    + (r.karar ? ` · karar: ${r.karar}` : '')
    + (r.sonuc ? ` · yapılan işlem: ${r.sonuc}` : '')
    + ` · ${r.kapali ? 'kapatıldı ' + r.kapatma : 'AÇIK'}`;

export const sayimlar = (
    kayitlar: UygKayit[], lokasyon: string, yil: number, ay: number,
): { ic: number; dis: number; ted: number; icMiktar: number; disMiktar: number; tedMiktar: number; musteriler: string[]; tedarikciler: string[] } => {
    const r = { ic: 0, dis: 0, ted: 0, icMiktar: 0, disMiktar: 0, tedMiktar: 0,
        musteriler: [] as string[], tedarikciler: [] as string[] };
    const mus = new Set<string>(), ted = new Set<string>();
    (kayitlar || []).forEach(k => {
        if (!yerEslesir(k.tespitYeri || '', lokasyon)) return;
        const t = tarihAyir(k.uygunsuzlukTarih || '');
        if (!t || t.yil !== yil || t.ay !== ay) return;
        const mik = Number(k.hataliMiktar) || 0;
        if (tipiOlan(k, 'ic')) { r.ic++; r.icMiktar += mik; }
        else if (tipiOlan(k, 'dis')) { r.dis++; r.disMiktar += mik; if (k.cariAdi) mus.add(k.cariAdi); }
        else if (tipiOlan(k, 'ted')) { r.ted++; r.tedMiktar += mik; if (k.cariAdi) ted.add(k.cariAdi); }
    });
    r.musteriler = Array.from(mus).sort();
    r.tedarikciler = Array.from(ted).sort();
    return r;
};

export const uygunsuzluklariCek = async (yil: number): Promise<UygKayit[]> => {
    const sb = (window as any).supabase;
    if (!sb || !sb.createClient) throw new Error('Supabase istemcisi yüklenemedi.');
    const c = sb.createClient(UYG_URL, UYG_KEY);
    const { data, error } = await c.from('uygunsuzluk_records')
        .select('tipi,tespitYeri,cariAdi,stokAdi,stokKodu,hataliMiktar,kontrolMiktar,partiHacmi,uygunsuzlukTarih,tarif,makine,hataTipi')
        .limit(20000);
    if (error) throw error;
    // Yıl filtresi burada: tarih "GG.AA.YYYY" metin olduğu için sunucuda süzülemiyor.
    return (data || []).filter((k: UygKayit) => {
        const t = tarihAyir(k.uygunsuzlukTarih || '');
        return t && t.yil === yil;
    });
};

// Rapor satırı — kullanıcı ekleyip çıkarabilir, sırasını koruyabilir.
export interface RaporSatir {
    id: string;
    kriter: string;
    otomatik: string;   // ERP/KPI'dan üretilen özet (canlı, kaydedilmez)
    otoElle?: string;   // kullanıcı gri kutuyu elle değiştirdiyse
    ozet: string;       // kullanıcının yazdığı
    aksiyon: string;    // kullanıcının yazdığı
    sorumlu?: string;
    termin?: string;    // GG.AA.YYYY veya YYYY-AA-GG (tarih seçici)
    silinebilir: boolean;
}

// Kayıtlı satırlar + standart satırlar. YGG ile aynı desen: SİLİNEN satır
// geri gelmemeli, bu yüzden silinenlerin id'si ayrıca tutulur — yoksa
// standart liste her açılışta onları yeniden eklerdi.
export const aylikBirlestir = (
    standart: RaporSatir[], kayit: RaporSatir[] | null, silinenler: string[] = [],
): RaporSatir[] => {
    const silinen = new Set(silinenler || []);
    if (!kayit) return standart.filter(b => !silinen.has(b.id));
    const kayitli = new Set(kayit.map(x => x.id));
    const sonuc = kayit.filter(x => !silinen.has(x.id));
    standart.forEach(b => {
        if (!kayitli.has(b.id) && !silinen.has(b.id)) sonuc.push(b);
    });
    return sonuc;
};

// Anahtar → {lokasyon, yıl, ay}. Lokasyon adında alt çizgi olabileceği
// için SONDAN ayrıştırılır ("aylikkalite_ust_kat_2026_02").
export const aylikKaliteAnahtarCoz = (
    anahtar: string,
): { lokasyon: string; yil: number; ay: number } | null => {
    const m = /^aylikkalite_(.+)_(\d{4})_(\d{2})$/.exec(String(anahtar || ''));
    if (!m) return null;
    const ay = Number(m[3]);
    if (ay < 1 || ay > 12) return null;
    return { lokasyon: m[1].replace(/_/g, ' '), yil: Number(m[2]), ay };
};

export const aylikKaliteAnahtar = (lokasyon: string, yil: number, ay: number): string =>
    'aylikkalite_' + String(lokasyon || '').trim().toLocaleLowerCase('tr').replace(/\s+/g, '_')
    + '_' + yil + '_' + String(ay).padStart(2, '0');
