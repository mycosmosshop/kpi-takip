// YGG raporunun MAİLLE GÖNDERİLMESİ — onaylı tedarikçi sistemindeki
// akışın aynısı: uygulama isteği kuyruğa yazar, YEREL görev (perf-mail
// gonder.py, 15 dakikada bir) Outlook ile gönderir.
//
// NEDEN DOĞRUDAN GÖNDERİM YOK: tarayıcıdan kurumsal Outlook hesabıyla mail
// gönderilemez; kimlik bilgisi de bu depoya konamaz (depo herkese açık).
// Kuyruk Supabase'de (egt_ayar, anahtar → JSON) tutulur; Drive köprüsünün
// gizli anahtarı bu uygulamaya girmez.

const MAIL_URL = 'https://nnubrxbpthmkitueixbh.supabase.co';
const MAIL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udWJyeGJwdGhta2l0dWVpeGJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NjI2MDIsImV4cCI6MjA5NjEzODYwMn0.CHZUOylf_q8kkOQbFf9VWZ6-doUTlynmAhahM2EuImE';

export const YGG_ISTEK = 'ygg_mail_istek';
export const YGG_DURUM = 'ygg_mail_durum';
// Kalite Raporu ayrı kuyruk kullanır: iki rapor aynı anda gönderilmek
// istenirse biri diğerinin isteğini ezmesin.
export const KALITE_ISTEK = 'kalite_mail_istek';
export const KALITE_DURUM = 'kalite_mail_durum';
// "Yazdır ve ilet" sabit alıcısı (kullanıcının kendi kurumsal adresi).
export const RAPOR_ALICI = 'volkan.pekatik@sanifoam.com.tr';

export interface YggMailIstek {
    durum: 'bekliyor' | 'tamamlandi' | 'bayat' | 'hata';
    istek: string;          // ISO zaman damgası (bayatlık buradan)
    lokasyon: string;
    yil: number;
    konu: string;
    alicilar: string[];
    cc: string[];
    html: string;
    // true ise yerel görev HTML'i PDF'e çevirip EK olarak gönderir
    // (gövdede kısa bilgi kalır). Üretilemezse HTML gövdeyle gider.
    pdf?: boolean;
    dosyaAdi?: string;
}

export interface YggMailDurum {
    sonGonderim?: string;   // 'YYYY-AA-GG SS:DD'
    alici?: string;
    konu?: string;
    istekDurum?: string;
    hata?: string;
}

// Basit e-posta ayıklama: "Ad Soyad <a@b.c>" ve düz adresleri kabul eder.
// Geçersizi ELEMEK şart — Outlook tek bozuk adreste tüm maili düşürür.
export const eposta = (metin: string): string | null => {
    const m = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(String(metin || ''));
    return m ? m[0] : null;
};

export const adresListesi = (girdi: string | string[]): string[] => {
    const ham = Array.isArray(girdi) ? girdi : String(girdi || '').split(/[;,\n]/);
    const gorulen = new Set<string>();
    const sonuc: string[] = [];
    ham.forEach(x => {
        const a = eposta(x);
        if (!a) return;
        const k = a.toLowerCase();
        if (gorulen.has(k)) return;      // aynı adres iki kez yazılmasın
        gorulen.add(k);
        sonuc.push(a);
    });
    return sonuc;
};

const istemci = (): any => {
    const sb = (window as any).supabase;
    if (!sb || !sb.createClient) throw new Error('Supabase istemcisi yüklenemedi.');
    return sb.createClient(MAIL_URL, MAIL_KEY);
};

const oku = async (anahtar: string): Promise<any> => {
    const c = istemci();
    const { data, error } = await c.from('egt_ayar').select('deger').eq('anahtar', anahtar).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    let v: any = data.deger;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
    return v;
};

export const yggMailDurumOku = async (anahtar: string = YGG_DURUM): Promise<YggMailDurum | null> =>
    oku(anahtar);

export const yggMailBekleyen = async (anahtar: string = YGG_ISTEK): Promise<YggMailIstek | null> => {
    const v = await oku(anahtar);
    return (v && v.durum === 'bekliyor') ? v as YggMailIstek : null;
};

export const yggMailGonder = async (
    istek: Omit<YggMailIstek, 'durum' | 'istek'>,
    anahtar: string = YGG_ISTEK,
): Promise<void> => {
    if (!istek.alicilar.length) throw new Error('Alıcı yok.');
    const c = istemci();
    const kayit: YggMailIstek = {
        ...istek,
        durum: 'bekliyor',
        istek: new Date().toISOString(),
    };
    const { error } = await c.from('egt_ayar')
        .upsert({ anahtar, deger: kayit }, { onConflict: 'anahtar' });
    if (error) throw error;
};
