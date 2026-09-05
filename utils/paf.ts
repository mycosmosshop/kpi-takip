// KALİTE MALİYETİ — PAF modeli (Prevention · Appraisal · Failure).
//
// Dört kategori: Önleme · Değerlendirme (ölçme) · İç başarısızlık · Dış
// başarısızlık. İç/dış başarısızlığın ÜRÜN maliyeti ERP'den gelir
// (uygunsuzluk × birim fiyat); önleme ve değerlendirme kalemleri LeanSys'te
// TUTARSAL OLARAK YOKTUR — ölçüldü: eğitim tablolarında maliyet alanı yok,
// muhasebe tarafında yalnızca hesap planı var (hareket yok), gider/hizmet
// faturası tablosu bağlı değil. Bu yüzden elle girilir; nereden bulunacağı
// her kalemin yanında yazar. Uydurma tutar üretilmez.

export type PafKategori = 'onleme' | 'degerlendirme' | 'ic' | 'dis';

export const PAF_ADI: Record<PafKategori, string> = {
    onleme: 'Önleme maliyetleri',
    degerlendirme: 'Değerlendirme (ölçme/kontrol) maliyetleri',
    ic: 'İç başarısızlık maliyetleri',
    dis: 'Dış başarısızlık maliyetleri',
};

export interface PafKalemTanim {
    id: string;
    kategori: PafKategori;
    ad: string;
    nereden: string;               // tutar hangi kayıttan bulunur
    kaynak: 'erp' | 'elle';
}

// Kalem listesi IATF/ISO uygulamasındaki olağan kalite maliyeti kalemleridir.
export const PAF_KATALOG: PafKalemTanim[] = [
    // ── ÖNLEME: hatanın oluşmasını engellemek için harcananlar ──
    { id: 'p_planlama', kategori: 'onleme', ad: 'Kalite planlama (APQP, FMEA, kontrol planı)', kaynak: 'elle', nereden: 'kalite/proses personelinin bu işe ayırdığı saat × saatlik maliyet' },
    { id: 'p_egitim', kategori: 'onleme', ad: 'Eğitim (kalite, proses, ürün güvenliği, IATF)', kaynak: 'elle', nereden: 'eğitim ücreti + katılımcı saati × saatlik maliyet (eğitim planı kayıtları)' },
    { id: 'p_tedarikci', kategori: 'onleme', ad: 'Tedarikçi geliştirme ve saha denetimi', kaynak: 'elle', nereden: 'denetçi süresi + yol/konaklama; onaylı tedarikçi sistemi denetim kayıtları' },
    { id: 'p_onleyici_bakim', kategori: 'onleme', ad: 'Önleyici bakım', kaynak: 'elle', nereden: 'CMMS planlı bakım iş emirleri: işçilik + yedek parça' },
    { id: 'p_sistem', kategori: 'onleme', ad: 'Yönetim sistemi belgelendirme ve gözetim denetimi', kaynak: 'elle', nereden: 'belgelendirme kuruluşu ve danışmanlık faturaları' },
    { id: 'p_pokayoke', kategori: 'onleme', ad: 'Hata önleyici (poka-yoke) aparat ve otomasyon', kaynak: 'elle', nereden: 'aparat/otomasyon yatırım faturaları' },

    // ── DEĞERLENDİRME: uygunluğu ÖLÇMEK için harcananlar ──
    { id: 'd_giris', kategori: 'degerlendirme', ad: 'Girdi (mal kabul) kontrolü', kaynak: 'elle', nereden: 'giriş kontrol personeli saati × saatlik maliyet' },
    { id: 'd_proses', kategori: 'degerlendirme', ad: 'Proses içi kontrol ve ilk parça onayı', kaynak: 'elle', nereden: 'kontrol planındaki kontrol süreleri × saatlik maliyet' },
    { id: 'd_son', kategori: 'degerlendirme', ad: 'Son kontrol ve sevkiyat kontrolü', kaynak: 'elle', nereden: 'son kontrol personeli saati × saatlik maliyet' },
    { id: 'd_lab', kategori: 'degerlendirme', ad: 'Laboratuvar ve dış test (yanmazlık, VOC, mukavemet)', kaynak: 'elle', nereden: 'dış laboratuvar faturaları + iç lab sarf malzemesi' },
    { id: 'd_kalibrasyon', kategori: 'degerlendirme', ad: 'Ölçüm cihazı kalibrasyonu ve MSA/R&R', kaynak: 'elle', nereden: 'kalibrasyon hizmet faturaları (kalibrasyon uygulaması) + R&R çalışma süresi' },
    { id: 'd_tetkik', kategori: 'degerlendirme', ad: 'İç tetkik, ürün ve proses denetimleri', kaynak: 'elle', nereden: 'tetkikçi saati × saatlik maliyet' },

    // ── İÇ BAŞARISIZLIK: müşteriye ULAŞMADAN yakalanan hatalar ──
    { id: 'i_hurda', kategori: 'ic', ad: 'Hurda ve fire (ürün maliyeti)', kaynak: 'erp', nereden: 'uygunsuzluk kayıtları × birim fiyat — ERP’den otomatik' },
    { id: 'i_yeniden', kategori: 'ic', ad: 'Yeniden işleme / tamir işçiliği', kaynak: 'elle', nereden: 'yeniden işleme süresi × saatlik maliyet' },
    { id: 'i_sorting', kategori: 'ic', ad: '%100 ayıklama (sorting)', kaynak: 'elle', nereden: 'ayıklama personeli saati × saatlik maliyet' },
    { id: 'i_durus', kategori: 'ic', ad: 'Kalite kaynaklı duruş', kaynak: 'elle', nereden: 'duruş süresi × makine saat maliyeti (CMMS/üretim kayıtları)' },

    // ── DIŞ BAŞARISIZLIK: müşteride ortaya çıkan hatalar ──
    { id: 'x_iade', kategori: 'dis', ad: 'Müşteri iadeleri (ürün maliyeti)', kaynak: 'erp', nereden: 'dış başarısızlık uygunsuzlukları × birim fiyat — ERP’den otomatik' },
    { id: 'x_sikayet', kategori: 'dis', ad: 'Şikayet işleme ve 8D çalışmaları', kaynak: 'elle', nereden: 'kalite personeli saati × saatlik maliyet' },
    { id: 'x_navlun', kategori: 'dis', ad: 'Ek / acil nakliye', kaynak: 'elle', nereden: 'ekstra navlun faturaları (tedarikçi değerlendirmede ekstra navlun kaydı)' },
    { id: 'x_garanti', kategori: 'dis', ad: 'Garanti, ceza ve müşteride ayıklama', kaynak: 'elle', nereden: 'müşteri borç dekontları (debit note)' },
];

export interface PafKalem { id: string; tutar: number | null; not?: string; }

export interface PafOzet {
    kategori: Record<PafKategori, number>;
    toplam: number;
    yuzde: Record<PafKategori, number | null>;   // toplam 0 ise null (0'a bölme yok)
    uygunlukPayi: number | null;    // önleme + değerlendirme
    basarisizlikPayi: number | null;
    girilen: number;                // tutarı girilmiş kalem sayısı
    eksik: number;                  // tutarı girilmemiş kalem sayısı
}

const say = (v: any): number => { const n = Number(v); return isNaN(n) ? 0 : n; };

export const pafOzet = (kalemler: PafKalem[]): PafOzet => {
    const harita = new Map((kalemler || []).map(k => [k.id, k]));
    const kategori: Record<PafKategori, number> = { onleme: 0, degerlendirme: 0, ic: 0, dis: 0 };
    let girilen = 0, eksik = 0;
    PAF_KATALOG.forEach(t => {
        const k = harita.get(t.id);
        // Tutarı GİRİLMEMİŞ kalem 0 sayılmaz, EKSİK sayılır: 0 TL ile
        // "bilinmiyor" farklı şeyler, toplam eksikse rapor bunu söylemeli.
        if (!k || k.tutar === null || k.tutar === undefined) { eksik++; return; }
        girilen++;
        kategori[t.kategori] += say(k.tutar);
    });
    const toplam = kategori.onleme + kategori.degerlendirme + kategori.ic + kategori.dis;
    const oran = (v: number): number | null => toplam > 0 ? (v / toplam) * 100 : null;
    return {
        kategori, toplam, girilen, eksik,
        yuzde: {
            onleme: oran(kategori.onleme), degerlendirme: oran(kategori.degerlendirme),
            ic: oran(kategori.ic), dis: oran(kategori.dis),
        },
        uygunlukPayi: oran(kategori.onleme + kategori.degerlendirme),
        basarisizlikPayi: oran(kategori.ic + kategori.dis),
    };
};

export interface PafAksiyon { konu: string; sorumlu: string; termin: string; durum: string; }

// PAF DENGESİNE göre aksiyon önerileri. Yalnızca veriden çıkan durumlar
// için üretilir; kalem girilmemişse öneri de üretilmez.
export const pafAksiyonlari = (o: PafOzet, yil: number, ay: number): PafAksiyon[] => {
    const a: PafAksiyon[] = [];
    if (o.toplam <= 0) return a;
    const termin = `${yil}-${String(Math.min(12, ay + 2)).padStart(2, '0')}-28`;
    const ekle = (konu: string) => a.push({ konu, sorumlu: '', termin, durum: 'Planlandı' });
    const y = (v: number | null) => v === null ? '—' : v.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%';

    if ((o.basarisizlikPayi ?? 0) > 50) {
        ekle(`Başarısızlık maliyeti toplam kalite maliyetinin ${y(o.basarisizlikPayi)}'i — `
            + 'en yüksek maliyetli ilk 3 uygunsuzluk için kök neden analizi yapılması ve '
            + 'kaynağındaki önleme faaliyetine (kontrol planı, poka-yoke, tedarikçi geliştirme) bütçe kaydırılması.');
    }
    if ((o.kategori.dis > o.kategori.ic) && o.kategori.dis > 0) {
        ekle(`Dış başarısızlık (${y(o.yuzde.dis)}) iç başarısızlığı (${y(o.yuzde.ic)}) aşıyor — `
            + 'hatalar müşteride yakalanıyor: son kontrol ve sevkiyat kontrol planının gözden geçirilmesi, '
            + 'müşteri şikayetlerinin ortak kök nedenlerinin belirlenmesi.');
    }
    if ((o.yuzde.onleme ?? 0) < 10) {
        ekle(`Önleme maliyeti payı ${y(o.yuzde.onleme)} — eğitim, tedarikçi geliştirme ve önleyici bakım `
            + 'planlarının gözden geçirilerek önleme bütçesinin artırılması.');
    }
    if ((o.yuzde.degerlendirme ?? 0) > 40) {
        ekle(`Değerlendirme (kontrol) payı ${y(o.yuzde.degerlendirme)} — kontrol ağırlıklı yapı; `
            + 'tekrarlayan kontrolleri azaltmak için proses yeterliliğinin (Cp/Cpk) ve otomatik '
            + 'hata önleyici uygulamaların değerlendirilmesi.');
    }
    if (o.eksik > 0) {
        ekle(`${o.eksik} kalite maliyeti kalemi girilmemiş — ilgili birimlerden (muhasebe, İK, bakım, `
            + 'satın alma) tutarların toplanarak kalite maliyeti tablosunun tamamlanması.');
    }
    return a;
};

const esc = (t: any): string => String(t === null || t === undefined ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const tl = (n: number | null): string =>
    n === null || n === undefined ? '—'
        : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' TL';

export const pafTabloHtml = (kalemler: PafKalem[], o: PafOzet): string => {
    const harita = new Map((kalemler || []).map(k => [k.id, k]));
    const satir = (t: PafKalemTanim): string => {
        const k = harita.get(t.id);
        const v = (k && k.tutar !== null && k.tutar !== undefined) ? Number(k.tutar) : null;
        return `<tr>
            <td style="padding:3px 6px;font-size:9.5pt">${esc(t.ad)}
              ${t.kaynak === 'erp' ? '<span style="color:#2563eb;font-size:8pt"> [ERP]</span>' : ''}
              <div style="font-size:8pt;color:#888">${esc(t.nereden)}</div></td>
            <td style="padding:3px 6px;text-align:right;font-size:9.5pt;white-space:nowrap">
              ${v === null ? '<span style="color:#b45309">girilmedi</span>' : esc(tl(v))}</td>
            <td style="padding:3px 6px;font-size:9pt;color:#555">${esc(k?.not || '')}</td>
          </tr>`;
    };
    const grup = (kat: PafKategori): string => `
        <tr style="background:#eef2f7">
          <td style="padding:4px 6px;font-weight:600;font-size:9.5pt">${esc(PAF_ADI[kat])}</td>
          <td style="padding:4px 6px;text-align:right;font-weight:600;font-size:9.5pt;white-space:nowrap">
            ${esc(tl(o.kategori[kat]))}</td>
          <td style="padding:4px 6px;font-size:9pt;color:#555">
            ${o.yuzde[kat] === null ? '' : esc(o.yuzde[kat]!.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%')}</td>
        </tr>
        ${PAF_KATALOG.filter(t => t.kategori === kat).map(satir).join('')}`;

    return `<div style="margin:6px 0 10px">
        <div style="font-size:9.5pt;font-weight:600;margin-bottom:2px">
          Kalite maliyeti — PAF kırılımı (toplam ${esc(tl(o.toplam))})</div>
        <table style="border-collapse:collapse;width:100%">
          <thead><tr style="background:#f4f6f8;font-size:9pt">
            <th style="padding:3px 6px;text-align:left">Kalem</th>
            <th style="padding:3px 6px;text-align:right">Tutar</th>
            <th style="padding:3px 6px;text-align:left">Pay / Not</th>
          </tr></thead>
          <tbody>
            ${(['onleme', 'degerlendirme', 'ic', 'dis'] as PafKategori[]).map(grup).join('')}
            <tr style="background:#e5e7eb">
              <td style="padding:4px 6px;font-weight:700">TOPLAM KALİTE MALİYETİ</td>
              <td style="padding:4px 6px;text-align:right;font-weight:700;white-space:nowrap">${esc(tl(o.toplam))}</td>
              <td style="padding:4px 6px;font-size:9pt">uygunluk (önleme+değerlendirme)
                ${o.uygunlukPayi === null ? '—' : esc(o.uygunlukPayi.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%')}
                · başarısızlık
                ${o.basarisizlikPayi === null ? '—' : esc(o.basarisizlikPayi.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%')}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:8pt;color:#888;margin-top:3px">
          [ERP] kalemler uygunsuzluk kayıtlarından otomatik gelir; diğerleri elle girilir
          (LeanSys'te bu kalemlerin tutarı yoktur). ${o.eksik} kalem girilmemiştir —
          girilmeyen kalem 0 TL sayılmaz, toplam bu kadar eksiktir.
        </div>
      </div>`;
};
