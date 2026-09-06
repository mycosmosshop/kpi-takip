// Aylık Kalite Raporu — lokasyon bazlı. Her satır düzenlenebilir ve
// silinebilir; aksiyonun sorumlusu ve termini vardır.
//
// VERİ KAYNAKLARI (karıştırılmaması kritik):
//   Müşteri İade PPM   ← onaylı listedeki MÜŞTERİ kayıtları (Σiade/Σsevk)
//   Tedarikçi PPM      ← uygunsuzluk kayıtları, tipi=Tedarikçi (Σhatalı/Σparti)
//   İç Hurda PPM       ← KPI tablosu (yoksa uygunsuzluk kayıtlarından)
//   Kalite Maliyeti    ← egt_ayar['kalite_maliyet'] (LeanSys TL × hatalı miktar)
// Eskiden müşteri satırına TEDARİKÇİ değerlendirme PPM'i yazılıyordu.
import React, { useEffect, useMemo, useState } from 'react';
import { Kpi } from '../types';
import {
    UygKayit, uygunsuzluklariCek, ilkN, sayimlar, ppmParti, kpiAra,
    aylikKaliteAnahtar, aylikKaliteAnahtarCoz, aylikBirlestir, RaporSatir,
    uygAyrinti, uygSatirMetni, sebepKirilimi, sebepMetni, yapilanIslemler,
} from '../utils/aylikKalite';
import { musteriPpmAy, onayliListeCoz, OnayliKayit } from '../utils/musteriPpm';
import { readSupplierSync } from '../utils/supplierEval';
import { maliyetCek, maliyetOzet, MaliyetSatir, maliyetDetayCek, maliyetDetayFiltre, MaliyetDetay,
    fiyatKaynakMetni, erpPafKalemleri } from '../utils/kaliteMaliyet';
import { cloudFetchMeta, cloudSaveMeta, cloudListMeta, cloudDeleteMeta } from '../utils/cloudSync';
import { yggMailGonder, yggMailDurumOku, buRaporGonderildi, buRaporKuyrukta,
    KALITE_ISTEK, KALITE_DURUM, RAPOR_ALICI, YggMailDurum } from '../utils/yggMail';
import { kaliteSorumlusu } from '../utils/kadro';
import { AYLAR } from '../constants';
import Modal from './Modal';
import OtoTextarea from './OtoTextarea';
import {
    PAF_KATALOG, PAF_ADI, PafKalem, PafKategori, pafOzet, pafAksiyonlari,
    pafGrafikHtml,
} from '../utils/paf';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    kpis: Kpi[];
    lokasyon: string;      // GÖSTERİM adı (“Ankara”)
    lokasyonId?: string;   // bulut anahtarı (“ankara”) — DEĞİŞMEMELİ
    yil: number;
}

const sayi = (n: number | null | undefined): string =>
    (n === null || n === undefined || isNaN(Number(n))) ? '—'
        : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 2 });

const tl = (n: number | null | undefined): string =>
    (n === null || n === undefined || isNaN(Number(n))) ? '—'
        : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' TL';

// KPI'nın seçili aydaki değeri + önceki ay (trend). PPM burada yeniden
// HESAPLANMAZ; KPI tablosundaki doğrulanmış değer okunur.
const kpiAyMetni = (k: Kpi | null, ay: number): string | null => {
    if (!k) return null;
    const bu = k.aylik[AYLAR[ay - 1]];
    const onc = ay > 1 ? k.aylik[AYLAR[ay - 2]] : null;
    if (bu === null || bu === undefined) return `${k.kpi_adi}: bu ay için değer girilmemiş.`;
    const fark = (onc !== null && onc !== undefined) ? Number(bu) - Number(onc) : null;
    return `${k.kpi_adi}: ${sayi(bu)} ${k.birim} (hedef ${sayi(k.yeni_yil_hedef)})`
        + (fark === null ? ' · önceki ay kaydı yok'
            : ` · önceki ay ${sayi(onc)} → ${fark === 0 ? 'değişmedi' : (fark > 0 ? '▲ +' : '▼ ') + sayi(fark)}`);
};

const AylikKaliteModal: React.FC<Props> = ({ isOpen, onClose, kpis, lokasyon, lokasyonId, yil }) => {
    const [ay, setAy] = useState(new Date().getMonth() + 1);
    const [kayitlar, setKayitlar] = useState<UygKayit[] | null>(null);
    const [onayli, setOnayli] = useState<OnayliKayit[] | null>(null);
    const [maliyet, setMaliyet] = useState<MaliyetSatir[] | null>(null);
    const [maliyetDetay, setMaliyetDetay] = useState<MaliyetDetay[] | null>(null);
    const [satirlar, setSatirlar] = useState<RaporSatir[]>([]);
    const [silinenler, setSilinenler] = useState<string[]>([]);
    const [durum, setDurum] = useState<'yukleniyor' | 'hazir' | 'kaydediliyor' | 'kaydedildi' | 'hata'>('yukleniyor');
    const [hata, setHata] = useState('');
    const [uyari, setUyari] = useState('');
    // Kayıtlı raporlar (geçmiş): anahtar + son güncelleme.
    const [kayitli, setKayitli] = useState<{ key: string; updated_at: string | null }[] | null>(null);
    const [listeAcik, setListeAcik] = useState(false);
    const [mailBilgi, setMailBilgi] = useState('');
    // Tam durum tutulur: "gönderildi" işareti için sadece tarih değil KONU da
    // gerekiyor (kayıt tüm lokasyon/aylar için ortak).
    const [mailDurum, setMailDurum] = useState<YggMailDurum | null>(null);
    const sonMail = mailDurum?.sonGonderim || '';
    // PAF (önleme / değerlendirme / iç / dış) kalem tutarları — ERP'de
    // olmayanlar elle girilir, kayıtla birlikte saklanır.
    const [pafKalemler, setPafKalemler] = useState<PafKalem[]>([]);
    const [pafAcik, setPafAcik] = useState(false);

    // Anahtar ID'den (bkz. YggModal): ad değişse de kayıt kaybolmasın.
    const anahtar = aylikKaliteAnahtar(lokasyonId || lokasyon, yil, ay);

    const listeyiTazele = () => cloudListMeta('aylikkalite_')
        .then(l => setKayitli(l))
        .catch(() => setKayitli([]));

    useEffect(() => {
        if (!isOpen) return;
        let iptal = false;
        cloudListMeta('aylikkalite_').then(l => { if (!iptal) setKayitli(l); }).catch(() => { if (!iptal) setKayitli([]); });
        yggMailDurumOku(KALITE_DURUM)
            .then(d => { if (!iptal) setMailDurum(d); })
            .catch(() => { });
        return () => { iptal = true; };
    }, [isOpen]);

    // ERP kayıtları (yıl bazında bir kez). Müşteri listesi ve maliyet
    // ayrı kaynaklardan; biri düşerse diğeri çalışmaya devam etsin diye
    // hepsi ayrı ayrı yakalanır.
    useEffect(() => {
        if (!isOpen) return;
        let iptal = false;
        const notlar: string[] = [];
        uygunsuzluklariCek(yil)
            .then(d => { if (!iptal) setKayitlar(d); })
            .catch(e => { if (!iptal) { setKayitlar([]); notlar.push('uygunsuzluk kayıtları: ' + (e?.message || e)); setUyari(notlar.join(' | ')); } });
        readSupplierSync()
            .then(b => { if (!iptal) setOnayli(onayliListeCoz(b)); })
            .catch(() => { if (!iptal) { setOnayli([]); notlar.push('onaylı liste okunamadı (müşteri PPM yok)'); setUyari(notlar.join(' | ')); } });
        maliyetCek()
            .then(d => { if (!iptal) setMaliyet(d); })
            .catch(e => { if (!iptal) { setMaliyet([]); notlar.push('kalite maliyeti: ' + (e?.message || e)); setUyari(notlar.join(' | ')); } });
        maliyetDetayCek()
            .then(d => { if (!iptal) setMaliyetDetay(d); })
            .catch(() => { if (!iptal) setMaliyetDetay([]); });
        return () => { iptal = true; };
    }, [isOpen, yil]);

    const oto = useMemo(() => {
        if (!kayitlar) return null;
        const s = sayimlar(kayitlar, lokasyon, yil, ay);
        const trend = (r: { ad: string; adet: number; miktar: number; oncekiMiktar: number | null }) =>
            `${r.ad} — ${sayi(r.miktar)} adet hatalı / ${r.adet} kayıt`
            + (r.oncekiMiktar === null ? ' (önceki ay kaydı yok)'
                : ` (önceki ay ${sayi(r.oncekiMiktar)}${r.miktar > r.oncekiMiktar ? ' ▲' : r.miktar < r.oncekiMiktar ? ' ▼' : ' =' })`);
        const urun3 = ilkN(kayitlar, lokasyon, yil, ay, 'ic', 'stokAdi');

        // Kayıt kayıt ayrıntı: no, tarih, cari/stok, miktar, hata tipi,
        // karar ve yapılan işlem. "3 kayıt var" demek denetimde yetmiyor.
        const ayrintiMetni = (kyt: UygKayit[], hangi: 'ic' | 'dis' | 'ted'): string => {
            const r = uygAyrinti(kyt, lokasyon, yil, ay, hangi);
            if (!r.length) return '';
            const acik = r.filter(x => !x.kapali).length;
            return r.map(x => '• ' + uygSatirMetni(x)).join('\n')
                + `\n(${r.length} kayıt listelendi${acik ? `, ${acik} tanesi AÇIK` : ', tamamı kapatılmış'})`;
        };

        // ── Müşteri İade PPM: onaylı listedeki MÜŞTERİ kayıtları ──
        const m = onayli ? musteriPpmAy(onayli, lokasyon, ay) : null;
        const mOnc = (onayli && ay > 1) ? musteriPpmAy(onayli, lokasyon, ay - 1) : null;
        const musteriPpm = !onayli ? 'Onaylı liste okunamadı.'
            : m!.musteriSayisi === 0 && m!.sevk === 0
                ? `${lokasyon} için bu ay sevki olan müşteri kaydı yok (onaylı listede ${lokasyon} müşterisi tanımlı mı?).`
                : `İade PPM: ${m!.ppm === null ? 'hesaplanamadı (sevk 0)' : sayi(m!.ppm) + ' ppm'}`
                + ` · ${sayi(m!.iade)} iade / ${sayi(m!.sevk)} sevk · ${m!.musteriSayisi} müşteri`
                + (mOnc && mOnc.ppm !== null ? ` · önceki ay ${sayi(mOnc.ppm)} ppm` : ' · önceki ay kaydı yok');
        const musteri3 = !onayli ? 'Onaylı liste okunamadı.'
            : !m!.iadeliler.length ? 'Bu ay iadesi olan müşteri yok.'
                : m!.iadeliler.slice(0, 3).map(x => {
                    const o = mOnc ? mOnc.iadeliler.find(y => y.ad === x.ad) : null;
                    return `${x.ad} — ${sayi(x.iade)} iade`
                        + (o ? ` (önceki ay ${sayi(o.iade)}${x.iade > o.iade ? ' ▲' : x.iade < o.iade ? ' ▼' : ' ='})` : ' (önceki ay kaydı yok)');
                }).join(' | ');

        // PPM'in SEBEBİ: hata tipi ve kaynağı olmadan "4.688 ppm" satırı
        // aksiyona dönüşmüyor.
        const sebepler = (hangi: 'ic' | 'dis' | 'ted'): string => {
            const tip = sebepKirilimi(kayitlar, lokasyon, yil, ay, hangi, 'hataTipi');
            if (!tip.length) return '';
            const kaynak = sebepKirilimi(kayitlar, lokasyon, yil, ay, hangi, 'hataKaynagi');
            const urun = sebepKirilimi(kayitlar, lokasyon, yil, ay, hangi, 'stokAdi', 3);
            const makine = sebepKirilimi(kayitlar, lokasyon, yil, ay, hangi, 'makine', 3);
            return `\nHata tipi: ${sebepMetni(tip)}`
                + (kaynak.length ? `\nHata kaynağı: ${sebepMetni(kaynak)}` : '')
                + (urun.length ? `\nEn çok etkilenen ürün: ${sebepMetni(urun)}` : '')
                + (makine.length && hangi === 'ic' ? `\nMakine/proses: ${sebepMetni(makine)}` : '');
        };

        const neYapildi = (hangi: 'ic' | 'dis' | 'ted'): string => {
            const l = yapilanIslemler(kayitlar, lokasyon, yil, ay, hangi);
            return l.length ? `\nKayıtlar ve yapılan işlem:\n• ${l.join('\n• ')}` : '';
        };

        // ── İç Hurda PPM: KPI (Türkçe'ye dayanıklı arama), yoksa ERP ──
        const icKpi = kpiAra<Kpi>(kpis, ['iç ppm', 'ic ppm', 'hurda'], ['tedarikçi', 'tedarikci']);
        const icErp = ppmParti(kayitlar, lokasyon, yil, ay, 'ic');
        const icTemel = kpiAyMetni(icKpi, ay)
            || (icErp.kayit === 0 ? 'İlgili KPI tanımlı değil; bu ay iç uygunsuzluk kaydı da yok.'
                : `İlgili KPI tanımlı değil. Uygunsuzluk kayıtlarından: `
                + `${icErp.ppm === null ? 'PPM hesaplanamadı (parti hacmi yok)' : sayi(icErp.ppm) + ' ppm'}`
                + ` (${sayi(icErp.hatali)} hatalı / ${sayi(icErp.parti)} parti hacmi, ${icErp.kayit} kayıt).`);
        // KPI değeri gelse bile SEBEP uygunsuzluk kayıtlarından eklenir.
        // KPI değeri gelse bile sebep uygunsuzluk kayıtlarından çıkar; kayıt
        // yoksa bunu AÇIKÇA söyle — yoksa “neden sebep yazmıyor?” sorusu kalır.
        const icPpm = icTemel
            + (icErp.kayit
                ? sebepler('ic') + neYapildi('ic') + `\n(${icErp.kayit} iç uygunsuzluk kaydından)`
                : `\nSebep kırılımı yok: ${lokasyon} lokasyonunda ${AYLAR[ay - 1]} ${yil} için `
                + 'iç başarısızlık uygunsuzluk kaydı bulunmuyor'
                + (icKpi ? ' (PPM değeri KPI tablosundan geliyor).' : '.'));

        // ── Tedarikçi PPM: uygunsuzluk kayıtlarından ──
        const tedErp = ppmParti(kayitlar, lokasyon, yil, ay, 'ted');
        const tedOnc = ppmParti(kayitlar, lokasyon, ay === 1 ? yil - 1 : yil, ay === 1 ? 12 : ay - 1, 'ted');
        const tedFirma = sebepKirilimi(kayitlar, lokasyon, yil, ay, 'ted', 'cariAdi');
        const tedPpm = tedErp.kayit === 0 ? 'Bu ay tedarikçi kaynaklı uygunsuzluk kaydı yok.'
            : `${tedErp.ppm === null ? 'PPM hesaplanamadı (parti hacmi yok)' : sayi(tedErp.ppm) + ' ppm'}`
            + ` (Hatalı/Parti Hacmi) · ${sayi(tedErp.hatali)} hatalı / ${sayi(tedErp.parti)} parti · ${tedErp.kayit} kayıt`
            + (tedOnc.ppm === null ? ' · önceki ay kaydı yok' : ` · önceki ay ${sayi(tedOnc.ppm)} ppm`)
            + (tedFirma.length ? `\nTedarikçi: ${sebepMetni(tedFirma)}` : '')
            + sebepler('ted')
            + neYapildi('ted');

        // ── Kalite maliyeti ──
        const km = maliyet ? maliyetOzet(maliyet, lokasyon, yil, ay) : null;
        const kmDetay = maliyetDetay ? maliyetDetayFiltre(maliyetDetay, lokasyon, yil, ay) : [];
        const maliyetMetni = !maliyet ? 'Kalite maliyeti verisi yükleniyor…'
            : !km ? `${lokasyon} için ${AYLAR[ay - 1]} ${yil} ayında maliyetlendirilmiş uygunsuzluk kaydı yok.`
                : `Toplam ${tl(km.toplam)}`
                + ` (iç ${tl(km.ic)} · dış ${tl(km.dis)} · tedarikçi ${tl(km.ted)}${km.diger ? ' · diğer ' + tl(km.diger) : ''})`
                + ` · ${km.kayit} kayıt`
                + (km.onceki === null ? ' · önceki ay kaydı yok'
                    : ` · önceki ay ${tl(km.onceki)}${km.toplam > km.onceki ? ' ▲' : km.toplam < km.onceki ? ' ▼' : ' ='}`)
                + (km.eslesmeyen ? ` · ${km.eslesmeyen} kaydın birim fiyatı bulunamadı (maliyete girmedi)` : '')
                + (km.sifirfiyat ? ` · ${km.sifirfiyat} kayıtta birim fiyat 0` : '')
                + `\nFiyat kaynağı: ${km.fAy} kayıt o ayın alım/satış fiyatı`
                + (km.fAy2 ? `, ${km.fAy2} kayıt aynı ay farklı hareket cinsi` : '')
                + (km.fYakin ? `, ${km.fYakin} kayıt en yakın ay fiyatı (tahmini, en çok 12 ay)` : '')
                + (km.eslesmeyen ? `, ${km.eslesmeyen} kayıt fiyatsız` : '') + '.'
                + (kmDetay.length
                    ? '\nEn yüksek maliyetli kayıtlar:\n' + kmDetay.slice(0, 8).map(x =>
                        `• ${x.no} · ${x.tarih} · ${x.stok || '(stok yok)'}`
                        + (x.cari ? ` · ${x.cari}` : '')
                        + (x.hataTipi ? ` · ${x.hataTipi}` : '')
                        + ` · ${sayi(x.miktar)} adet × ${x.birimFiyat === null ? 'birim fiyat yok' : sayi(x.birimFiyat) + ' TL'}`
                        + ` = ${tl(x.tutar)}`
                        + (x.fiyatKaynagi && x.fiyatKaynagi !== 'ay' ? ` [${fiyatKaynakMetni(x)}]` : '')).join('\n')
                    : '');

        return {
            musteriPpm, musteri3, icPpm, tedPpm, maliyet: maliyetMetni,
            urun3: urun3.length ? urun3.map(trend).join(' | ') : 'Bu ay iç başarısızlık kaydı yok.',
            musteriDof: s.dis === 0 ? 'Bu ay müşteri kaynaklı uygunsuzluk kaydı yok.'
                : `${s.dis} kayıt, ${sayi(s.disMiktar)} adet. Şikayet açan müşteriler: ${s.musteriler.join(', ')}\n`
                + ayrintiMetni(kayitlar, 'dis'),
            tedarikciDof: s.ted === 0 ? 'Bu ay tedarikçi kaynaklı uygunsuzluk kaydı yok.'
                : `${s.ted} kayıt, ${sayi(s.tedMiktar)} adet. Tedarikçiler: ${s.tedarikciler.slice(0, 12).join(', ')}`
                    + (s.tedarikciler.length > 12 ? ` … (+${s.tedarikciler.length - 12})` : '')
                    + `\n` + ayrintiMetni(kayitlar, 'ted'),
            icAyrinti: ppmParti(kayitlar, lokasyon, yil, ay, 'ic').kayit === 0
                ? 'Bu ay iç uygunsuzluk kaydı yok.'
                : ayrintiMetni(kayitlar, 'ic'),
        };
    }, [kayitlar, onayli, maliyet, maliyetDetay, kpis, lokasyon, yil, ay]);

    // Rapor satırları KANIT ve AYLIK TAKİP aksiyonuyla dolu gelir: denetimde
    // kanıt istendiğinde nereden indirileceği ve ay boyunca nasıl izleneceği
    // yazılı olsun. Sorumlu varsayılanı lokasyon kalite mühendisi; termin
    // rapor ayının son günü. Hepsi düzenlenebilir, satır silinebilir.
    // Lokasyonun kalite mühendisi (utils/kadro.ts). Kadroda yoksa genel ifade kalır.
    const SORUMLU = kaliteSorumlusu(lokasyonId || lokasyon);
    const aySonu = (): string => {
        const d = new Date(yil, ay, 0);       // ay 1-12 → o ayın son günü
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const bos = { otomatik: '', ozet: '', aksiyon: '', sorumlu: '', termin: '', durum: '', silinebilir: true };
    const V = (ozet: string, aksiyon: string) => ({
        ...bos, ozet, aksiyon, sorumlu: SORUMLU, termin: aySonu(), durum: 'Devam ediyor',
    });

    const varsayilan = (): RaporSatir[] => ([
        {
            id: 'musteri_ppm', kriter: 'Müşteri İade PPM',
            ...V('Müşteri iade PPM’i onaylı listedeki müşteri sevk/iade verisinden hesaplandı. '
                + 'Hedef aşımı varsa ilgili müşteri için DÖF açılır.',
                'Kanıt: Onaylı sistemden ilgili ayın müşteri sevk-iade dökümü PDF olarak indirilip '
                + 'rapora eklenir (denetimde istenmeden hazır bulunur). '
                + 'Takip: iade bildirimleri hafta içinde izlenir, ay sonunda PPM KPI formuna işlenir.'),
        },
        {
            id: 'musteri_ilk3', kriter: 'İade PPM ilk 3 Müşteri (önceki aya ait trend)',
            ...V('İadesi olan ilk 3 müşteri ve önceki aya göre değişim değerlendirildi.',
                'Kanıt: müşteri bazlı iade dökümü (bu rapordan Yazdır/PDF ile alınır). '
                + 'Takip: iki ay üst üste artan müşteride müşteriye özel aksiyon planı açılır.'),
        },
        {
            id: 'ic_ppm', kriter: 'İç Hurda PPM',
            ...V('İç hurda PPM’i KPI takip formundaki aylık veriden okundu; hedefle karşılaştırıldı.',
                'Kanıt: KPI Takip aylık veri girişi ekranı ve uygunsuzluk kayıtları çıktısı. '
                + 'Takip: hurda kayıtları haftalık gözden geçirilir, ay sonunda PPM hesaplanıp '
                + 'KPI formuna işlenir; hedef aşımında kök neden çalışması başlatılır.'),
        },
        {
            id: 'ic_ilk3', kriter: 'İç Hurda PPM ilk 3 ürün (önceki aya ait trend)',
            ...V('En çok hurda veren ilk 3 ürün ve önceki aya göre değişim değerlendirildi.',
                'Kanıt: ürün bazlı hurda dökümü. Takip: ilk 3 ürün için kök neden (5N1K / balık kılçığı) '
                + 'çalışması yürütülür, kontrol planı ve P-FMEA gözden geçirilir.'),
        },
        {
            id: 'ic_ayrinti', kriter: 'İç uygunsuzluk kayıtları (no, sebep, miktar, karar, yapılan işlem)',
            ...V('İç uygunsuzluk kayıtları no, sebep, miktar ve karar bazında listelendi; '
                + 'açık kayıtlar takibe alındı.',
                'Kanıt: uygunsuzluk formları (U-seri/sıra no) ve kapatma kayıtları. '
                + 'Takip: açık kayıtlar haftalık gözden geçirilir; kapatma tarihi girilmemiş kayıtlar '
                + 'ay sonuna kadar kapatılır.'),
        },
        {
            id: 'musteri_dof', kriter: 'Müşteri DÖF / Şikayet Sayısı (şikayet açan müşteriler)',
            ...V('Müşteri kaynaklı uygunsuzluklar ve şikayet açan müşteriler değerlendirildi.',
                'Kanıt: 8D/DÖF dosyaları ve müşteri yazışmaları. '
                + 'Takip: açık DÖF’ler haftalık izlenir, 8D’ler müşteri terminine göre kapatılır; '
                + 'kalıcı önlemin etkinliği bir sonraki ay doğrulanır.'),
        },
        {
            id: 'tedarikci_ppm', kriter: 'Tedarikçi PPM (uygunsuzluk kayıtlarından)',
            ...V('Tedarikçi kaynaklı uygunsuzlukların PPM’i, tedarikçi ve hata tipi kırılımıyla değerlendirildi.',
                'Kanıt: uygunsuzluk kayıtları ve tedarikçiye açılan DÖF. '
                + 'Takip: tekrarlayan uygunsuzlukta giriş kontrol sıklığı artırılır ve tedarikçi '
                + 'değerlendirme puanına işlenir.'),
        },
        {
            id: 'tedarikci_dof', kriter: 'Tedarikçi DÖF / şikayet',
            ...V('Tedarikçiye açılan DÖF’ler, kararlar ve yapılan işlemler gözden geçirildi.',
                'Kanıt: tedarikçiye gönderilen DÖF ve cevapları (8D). '
                + 'Takip: cevap süresi izlenir; süresinde cevap vermeyen tedarikçi değerlendirmede '
                + 'puan kaybeder, gerekirse saha denetimi planlanır.'),
        },
        {
            id: 'kalite_maliyet', kriter: 'Kalite Maliyeti (PAF: önleme · değerleme · iç · dış)',
            ...V('Kalite maliyeti PAF kırılımıyla değerlendirildi; uygunluk (yatırım) ve '
                + 'uygunsuzluk (kayıp) payları karşılaştırıldı.',
                'Kanıt: PAF tablosu ve kalem kaynak belgeleri (faturalar, saat kayıtları, '
                + 'kalibrasyon ve laboratuvar faturaları). '
                + 'Takip: kalemler ay sonunda güncellenir; uygunsuzluk payı artarsa önleme '
                + 'faaliyetine bütçe kaydırılır (1-10-100).'),
        },
        {
            id: 'diger', kriter: 'Diğer Konu(lar) (altyapı eksikleri, denetim konuları, müşteri ziyaretleri, iç testler, dış lab sonuçları vb…)',
            ...V('', 'Kanıt: ilgili yazışma, denetim raporu veya test sonucu. '
                + 'Takip: konu kapanana kadar aylık kalite raporunda izlenir.'),
        },
    ]);

    // Kayıtlı satırları oku. Okunamazsa BOŞ göstermeyip hatayı söyle:
    // sessizce boş açılırsa kullanıcı üstüne yazar ve eskisini kaybeder.
    useEffect(() => {
        if (!isOpen) return;
        let iptal = false;
        setDurum('yukleniyor');
        cloudFetchMeta(anahtar)
            .then(v => {
                if (iptal) return;
                const kayitli = (v && Array.isArray(v.satirlar)) ? v.satirlar as RaporSatir[] : null;
                const sil = (v && Array.isArray(v.silinenler)) ? v.silinenler as string[] : [];
                setSilinenler(sil);
                setPafKalemler(Array.isArray(v?.pafKalemler) ? v.pafKalemler as PafKalem[] : []);
                setSatirlar(aylikBirlestir(varsayilan(), kayitli, sil));
                setDurum('hazir');
            })
            .catch(e => { if (!iptal) { setHata(String(e?.message || e)); setDurum('hata'); } });
        return () => { iptal = true; };
    }, [isOpen, anahtar]);

    const kaydet = async () => {
        setDurum('kaydediliyor'); setHata('');
        try {
            // Otomatik metin KAYDEDILMEZ: her açılışta canlı veriden üretilir,
            // yoksa rapor eski sayıları kalıcı olarak taşırdı. Kullanıcının
            // elle değiştirdiği metin (otoElle) ise kaydedilir.
            await cloudSaveMeta(anahtar, {
                satirlar: satirlar.map(s => ({ ...s, otomatik: '' })),
                silinenler,
                pafKalemler,
                guncelleme: new Date().toISOString(),
            });
            setDurum('kaydedildi'); setTimeout(() => setDurum('hazir'), 2000);
            listeyiTazele();   // yeni kayıt listede hemen görünsün
        } catch (e: any) { setHata(String(e?.message || e)); setDurum('hata'); }
    };

    const raporSil = async (key: string) => {
        const c = aylikKaliteAnahtarCoz(key);
        const ad = c ? `${c.lokasyon} · ${AYLAR[c.ay - 1]} ${c.yil}` : key;
        if (!window.confirm(`${ad} kalite raporu KALICI olarak silinecek.\n\n`
            + 'Yazdığınız özet, aksiyon, sorumlu ve terminler gider; ay yeniden '
            + 'açıldığında ERP verisinden boş rapor gelir.\n\nSilinsin mi?')) return;
        try {
            await cloudDeleteMeta(key);
            await listeyiTazele();
            if (key === anahtar) {
                // Açık olan ay silindiyse ekran da varsayılana dönmeli;
                // yoksa kullanıcı silinmiş raporu düzenlemeye devam eder.
                setSilinenler([]);
                setSatirlar(aylikBirlestir(varsayilan(), null, []));
            }
            setHata('');
        } catch (e: any) { setHata('Silinemedi: ' + String(e?.message || e)); setDurum('hata'); }
    };

    // ERP'den gelen iç/dış başarısızlık ÜRÜN maliyeti PAF kalemlerine
    // otomatik yazılır (kullanıcı üzerine yazabilir); elle girilen kalem
    // varsa o korunur.
    const pafKalemDeger = (id: string): number | null => {
        const k = pafKalemler.find(x => x.id === id);
        if (k && k.tutar !== null && k.tutar !== undefined) return Number(k.tutar);
        // Eşleme utils/kaliteMaliyet'te (YGG ile AYNI fonksiyon): tedarikçi
        // kaynaklı hata iç başarısızlıktır, dış = müşteride ortaya çıkan.
        const e = erpPafKalemleri(maliyet || [], lokasyon, yil, ay)[id];
        return e === undefined ? null : Math.round(e);
    };

    const pafListe = useMemo<PafKalem[]>(() => PAF_KATALOG.map(t => {
        const k = pafKalemler.find(x => x.id === t.id);
        return { id: t.id, tutar: pafKalemDeger(t.id), not: k?.not || '' };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [pafKalemler, maliyet, lokasyon, yil, ay]);

    const paf = useMemo(() => pafOzet(pafListe), [pafListe]);

    const pafGuncelle = (id: string, alan: 'tutar' | 'not', v: string) => setPafKalemler(p => {
        const yeni = [...p];
        const i = yeni.findIndex(x => x.id === id);
        const mevcut = i >= 0 ? yeni[i] : { id, tutar: null as number | null, not: '' };
        const guncel = alan === 'tutar'
            // Boş bırakmak "0 TL" değil "girilmedi" demektir.
            ? { ...mevcut, tutar: v.trim() === '' ? null : Number(v.replace(',', '.')) }
            : { ...mevcut, not: v };
        if (i >= 0) yeni[i] = guncel; else yeni.push(guncel);
        return yeni;
    });

    // PAF dengesinden çıkan aksiyonlar rapora SATIR olarak eklenir.
    const pafOneriler = useMemo(() => pafAksiyonlari(paf, yil, ay, SORUMLU), [paf, yil, ay, SORUMLU]);

    const pafOneriEkle = (konu: string, termin: string) => setSatirlar(x => (
        x.some(y => y.ozet === konu) ? x : [...x, {
            id: 'ek_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            kriter: 'Kalite maliyeti aksiyonu (PAF)', otomatik: '', otoElle: '',
            ozet: konu, aksiyon: '', sorumlu: '', termin, durum: 'Planlandı', silinebilir: true,
        }]));

    const otoMetin = (id: string): string => {
        if (!oto) return 'ERP verisi yükleniyor…';
        switch (id) {
            case 'musteri_ppm': return oto.musteriPpm;
            case 'musteri_ilk3': return oto.musteri3;
            case 'ic_ppm': return oto.icPpm;
            case 'ic_ilk3': return oto.urun3;
            case 'ic_ayrinti': return oto.icAyrinti;
            case 'musteri_dof': return oto.musteriDof;
            case 'tedarikci_ppm': return oto.tedPpm;
            case 'tedarikci_dof': return oto.tedarikciDof;
            case 'kalite_maliyet': return oto.maliyet;
            default: return '';
        }
    };
    // Ekranda ve çıktıda görünen metin: kullanıcı düzelttiyse onunki.
    const gosterilenOto = (s: RaporSatir): string =>
        s.otoElle !== undefined ? s.otoElle : otoMetin(s.id);

    const guncelle = (id: string, alan: keyof RaporSatir, v: string) =>
        setSatirlar(s => s.map(x => x.id === id ? { ...x, [alan]: v } : x));

    // Silinen satır id'si ayrıca tutulur: standart liste her açılışta
    // eklendiği için, tutulmazsa silinen satır geri gelirdi.
    const satirSil = (id: string) => {
        if (!window.confirm('Bu satır rapordan kaldırılsın mı?')) return;
        setSatirlar(s => s.filter(x => x.id !== id));
        if (!id.startsWith('ek_')) setSilinenler(s => (s.indexOf(id) >= 0 ? s : [...s, id]));
    };

    const satirEkle = () => setSatirlar(s => [...s, {
        id: 'ek_' + Date.now(), kriter: '', otomatik: '', otoElle: '',
        ozet: '', aksiyon: '', sorumlu: '', termin: '', durum: '', silinebilir: true,
    }]);

    const esc = (t: string) => String(t || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Rapor HTML'i TEK yerde üretilir: yazdırma ve mail AYNI belgedir.
    const raporHtml = (): string => {
        const tr = satirlar.map(s => `<tr>
            <td class="k">${esc(s.kriter)}${gosterilenOto(s) ? `<div class="oto">${esc(gosterilenOto(s))}</div>` : ''}</td>
            <td>${esc(s.ozet).replace(/\n/g, '<br>')}</td>
            <td>${esc(s.aksiyon).replace(/\n/g, '<br>')}</td>
            <td>${esc(s.sorumlu || '')}</td>
            <td>${esc(s.termin || '')}</td>
            <td>${esc(s.durum || '')}</td></tr>`).join('');
        return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
            <title>Kalite Raporu — ${esc(lokasyon)} ${AYLAR[ay - 1]} ${yil}</title><style>
            body{font-family:Segoe UI,Arial,sans-serif;font-size:11pt;color:#111;margin:22px}
            h1{font-size:15pt;margin:0 0 3px} h2{font-size:11pt;color:#444;font-weight:normal;margin:0 0 14px}
            table{border-collapse:collapse;width:100%} th,td{border:1px solid #999;padding:6px 8px;vertical-align:top}
            th{background:#f0f0f0;text-align:left} td.k{width:32%} td:nth-child(2),td:nth-child(3){width:24%}
            td:nth-child(4){width:11%} td:nth-child(5){width:8%} td:nth-child(6){width:9%}
            .oto{margin-top:4px;font-size:9.5pt;color:#444;background:#f7f7f7;padding:4px 6px;border-left:3px solid #999}
            @media print{body{margin:10mm}}
            </style></head><body>
            <h1>KALİTE RAPORU</h1>
            <h2>${esc(lokasyon)} — ${AYLAR[ay - 1]} ${yil}</h2>
            <table><thead><tr><th>Kriter</th><th>Özet Açıklama</th><th>Aksiyon</th>
            <th>Sorumlu</th><th>Termin</th><th>Durum</th></tr></thead>
            <tbody>${tr}</tbody></table>
            ${paf.toplam > 0 || paf.girilen > 0 ? pafGrafikHtml(paf) : ''}
            <p style="margin-top:16px;font-size:9pt;color:#666">Gri kutulardaki özetler
            ${esc(lokasyon)} lokasyonunun ERP uygunsuzluk kayıtlarından, onaylı müşteri
            listesinden ve KPI tablosundan ${new Date().toLocaleString('tr-TR')} tarihinde
            üretilmiştir; elle değiştirilmiş olabilir.</p>
            </body></html>`;
    };

    const yazdir = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(raporHtml());
        w.document.close(); w.focus();
    };

    // Yazdır ve ilet: yazdırma penceresini açar VE raporu mail kuyruğuna
    // yazar. Gönderimi yerel görev (perf-mail, 15 dk) Outlook'tan yapar —
    // tarayıcıdan kurumsal hesapla mail gönderilemez.
    const yazdirVeIlet = async () => {
        yazdir();
        setDurum('kaydediliyor'); setHata('');
        const konu = `Kalite Raporu — ${lokasyon} / ${AYLAR[ay - 1]} ${yil}`;
        try {
            await yggMailGonder({
                lokasyon, yil,
                konu,
                alicilar: [RAPOR_ALICI],
                cc: [],
                html: raporHtml(),
            }, KALITE_ISTEK);
            setMailBilgi(`Rapor ${RAPOR_ALICI} adresine gönderilmek üzere kuyruğa alındı; `
                + 'yerel gönderim görevi 15 dakika içinde yollayacak.');
            // Düğme hemen "kuyrukta" göstersin: gerçek gönderim 15 dk sonra,
            // o zamana kadar işaretsiz kalırsa kullanıcı ikinci kez gönderiyor.
            setMailDurum(d => ({ ...(d || {}), konu, istekDurum: 'kuyrukta' }));
            setDurum('kaydedildi'); setTimeout(() => setDurum('hazir'), 3000);
        } catch (e: any) {
            setHata('Mail isteği yazılamadı: ' + String(e?.message || e)); setDurum('hata');
        }
    };

    const alan = 'w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded '
        + 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
    const mini = 'text-xs p-1 border border-gray-300 dark:border-gray-600 rounded '
        + 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
    // "Gönderildi" yalnız BU lokasyon+ay+yıl gönderildiyse yanar; kayıt tüm
    // raporlar için ortak, ayrım konudan yapılır (bkz. buRaporGonderildi).
    const mailGonderildi = buRaporGonderildi(mailDurum, [lokasyon, AYLAR[ay - 1], yil]);
    const mailKuyrukta = buRaporKuyrukta(mailDurum, [lokasyon, AYLAR[ay - 1], yil]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="full"
            title={`Kalite Raporu — ${lokasyon} / ${AYLAR[ay - 1]} ${yil}`}
            footer={
                <div className="flex items-center gap-3 justify-end w-full">
                    <span className="text-xs mr-auto">
                        {durum === 'yukleniyor' && 'Yükleniyor…'}
                        {durum === 'kaydediliyor' && 'Kaydediliyor…'}
                        {durum === 'kaydedildi' && <span className="text-green-600">✓ Kaydedildi</span>}
                        {durum === 'hata' && <span className="text-red-600">Hata: {hata}</span>}
                    </span>
                    <button onClick={satirEkle}
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                        ＋ Satır ekle
                    </button>
                    <button onClick={yazdir}
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                        🖨️ Yazdır / PDF
                    </button>
                    <button onClick={yazdirVeIlet} disabled={durum === 'kaydediliyor'}
                        title={mailGonderildi
                            ? `Bu ay ${RAPOR_ALICI} adresine gönderildi — ${sonMail}`
                            : `Yazdırma penceresini açar ve raporu ${RAPOR_ALICI} adresine gönderir`}
                        className={'px-3 py-2 text-sm rounded border disabled:opacity-50 ' + (mailKuyrukta
                            ? 'border-amber-500 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100'
                            : mailGonderildi
                                ? 'border-green-500 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100'
                                : 'border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 '
                                    + 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30')}>
                        {/* Kuyruk ÖNCE: yeniden gönderimde düğme hemen değişsin. */}
                        {mailKuyrukta ? '⏳ Kuyrukta' : mailGonderildi ? '✅ Gönderildi' : '📧 Yazdır ve ilet'}
                        {!mailKuyrukta && mailGonderildi && (
                            <span className="text-[11px] font-normal opacity-80"> · {sonMail}</span>
                        )}
                    </button>
                    <button onClick={kaydet} disabled={durum === 'yukleniyor' || durum === 'kaydediliyor'}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                        Kaydet
                    </button>
                </div>
            }>
            <div className="text-sm">
                {hata && durum === 'hata' && (
                    <div className="mb-3 p-3 rounded bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                        {hata} — <b>kaydetmeyin</b>, eski satırların üzerine yazılır.
                    </div>
                )}
                {mailBilgi && (
                    <div className="mb-3 p-2 rounded text-xs bg-indigo-50 dark:bg-indigo-900/30
                        text-indigo-800 dark:text-indigo-200">
                        📧 {mailBilgi}
                        {sonMail && <span className="text-gray-500"> · önceki gönderim: {sonMail}</span>}
                    </div>
                )}
                {uyari && (
                    <div className="mb-3 p-2 rounded text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                        Bazı kaynaklar okunamadı: {uyari}
                    </div>
                )}
                <div className="mb-3 flex flex-wrap gap-3 items-end">
                    <label className="text-xs flex flex-col gap-1 w-32">
                        <span>Ay</span>
                        <select className={alan} value={ay} onChange={e => setAy(Number(e.target.value))}>
                            {AYLAR.map((a, i) => {
                                const k = aylikKaliteAnahtar(lokasyonId || lokasyon, yil, i + 1);
                                const var_ = (kayitli || []).some(x => x.key === k);
                                return <option key={a} value={i + 1}>{a}{var_ ? ' ●' : ''}</option>;
                            })}
                        </select>
                    </label>
                    <button onClick={() => setListeAcik(v => !v)}
                        className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600
                            hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap">
                        📁 Kayıtlı raporlar{kayitli ? ` (${kayitli.length})` : ''}
                    </button>
                    <button onClick={() => setPafAcik(v => !v)}
                        className="px-3 py-2 text-sm rounded border border-emerald-300 dark:border-emerald-700
                            text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30
                            whitespace-nowrap">
                        💰 Kalite maliyeti (PAF){paf.toplam > 0
                            ? ` — ${paf.toplam.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL` : ''}
                    </button>
                    <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 min-w-[16rem] pb-2">
                        Rapor <b>{lokasyon}</b> lokasyonuna aittir; her lokasyon ve ay ayrı saklanır.
                        Gri kutular ERP’den gelir — <b>elle değiştirilebilir</b>, değiştirirseniz
                        “otomatiğe dön” ile geri alabilirsiniz.
                    </span>
                </div>

                {listeAcik && (
                    <div className="mb-3 p-3 rounded border border-gray-300 dark:border-gray-600
                        bg-gray-50 dark:bg-gray-800">
                        <div className="font-semibold text-sm mb-2">📁 Kaydedilmiş kalite raporları</div>
                        {kayitli === null && <div className="text-xs text-gray-500">Yükleniyor…</div>}
                        {kayitli && kayitli.length === 0 && (
                            <div className="text-xs text-gray-500">Henüz kaydedilmiş rapor yok.</div>
                        )}
                        <div className="max-h-56 overflow-auto">
                            {(kayitli || []).map(r => {
                                const c = aylikKaliteAnahtarCoz(r.key);
                                if (!c) return null;
                                const buLokasyon = c.lokasyon === String(lokasyonId || lokasyon).toLocaleLowerCase('tr');
                                const acilabilir = buLokasyon && c.yil === yil;
                                const secili = r.key === anahtar;
                                return (
                                    <div key={r.key}
                                        className={'flex items-center gap-2 py-1 border-b border-gray-200 dark:border-gray-700 text-xs '
                                            + (secili ? 'bg-blue-50 dark:bg-blue-900/30' : '')}>
                                        <span className="flex-1">
                                            <b className="capitalize">{c.lokasyon}</b> · {AYLAR[c.ay - 1]} {c.yil}
                                            {r.updated_at && (
                                                <span className="text-gray-500">
                                                    {' '}· kaydedildi {new Date(r.updated_at).toLocaleString('tr-TR')}
                                                </span>
                                            )}
                                        </span>
                                        {secili
                                            ? <span className="text-blue-700 dark:text-blue-300">açık</span>
                                            : acilabilir
                                                ? <button onClick={() => { setAy(c.ay); setListeAcik(false); }}
                                                    className="px-2 py-0.5 rounded border border-blue-400 text-blue-700
                                                        dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30">
                                                    aç / düzenle
                                                </button>
                                                : <span className="text-gray-400" title="Bu rapor başka lokasyon/yıla ait">
                                                    KPI Takip’te lokasyon/yılı değiştirin
                                                </span>}
                                        <button onClick={() => raporSil(r.key)} title="Kaydı sil"
                                            className="px-1 text-red-600 hover:text-red-800">🗑️</button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-2">
                            Liste tüm lokasyonların kayıtlarını gösterir; yalnızca <b>{lokasyon} / {yil}</b>
                            {' '}kayıtları buradan açılabilir. 🗑️ ile kayıt kalıcı silinir — silinen ay
                            yeniden açıldığında ERP verisinden boş rapor gelir.
                        </div>
                    </div>
                )}

                {pafAcik && (
                    <div className="mb-3 p-3 rounded border border-emerald-300 dark:border-emerald-700
                        bg-emerald-50/50 dark:bg-emerald-900/20">
                        <div className="font-semibold text-sm mb-1">
                            💰 Kalite maliyeti — PAF kırılımı (Önleme · Değerlendirme · İç · Dış)
                        </div>
                        <div className="text-[11px] text-gray-600 dark:text-gray-300 mb-2">
                            [ERP] işaretli kalemler uygunsuzluk kayıtlarından otomatik gelir. Diğerlerinin
                            tutarı LeanSys'te yoktur (ölçüldü: eğitim/muhasebe tarafında tutar alanı yok),
                            elle girilir — her kalemin yanında <b>nereden bulunacağı</b> yazılıdır.
                            Boş bırakılan kalem <b>0 TL sayılmaz</b>, eksik sayılır.
                        </div>

                        <div className="overflow-auto" style={{ maxHeight: '40vh' }}>
                            <table className="w-full border-collapse text-xs">
                                <thead className="sticky top-0 bg-emerald-100/80 dark:bg-emerald-900/50">
                                    <tr>
                                        <th className="p-1 text-left">Kalem</th>
                                        <th className="p-1 text-right w-32">Tutar (TL)</th>
                                        <th className="p-1 text-left w-1/4">Not</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(['onleme', 'degerlendirme', 'ic', 'dis'] as PafKategori[]).map(kat => (
                                        <React.Fragment key={kat}>
                                            <tr className="bg-white/70 dark:bg-gray-800/60">
                                                <td className="p-1 font-semibold">{PAF_ADI[kat]}</td>
                                                <td className="p-1 text-right font-semibold tabular-nums">
                                                    {paf.kategori[kat].toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                                                </td>
                                                <td className="p-1 text-gray-600 dark:text-gray-300">
                                                    {paf.yuzde[kat] === null ? '' :
                                                        paf.yuzde[kat]!.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%'}
                                                </td>
                                            </tr>
                                            {PAF_KATALOG.filter(t => t.kategori === kat).map(t => {
                                                const k = pafListe.find(x => x.id === t.id);
                                                return (
                                                    <tr key={t.id} className="border-b border-emerald-200/50 dark:border-emerald-800/40">
                                                        <td className="p-1 pl-4">
                                                            {t.ad}
                                                            {t.kaynak === 'erp' && (
                                                                <span className="ml-1 text-[10px] px-1 rounded bg-blue-100 text-blue-800">ERP</span>
                                                            )}
                                                            <div className="text-[10px] text-gray-500">{t.nereden}</div>
                                                        </td>
                                                        <td className="p-1">
                                                            <input type="text" inputMode="decimal"
                                                                className={mini + ' w-full text-right tabular-nums'}
                                                                placeholder="girilmedi"
                                                                value={k?.tutar === null || k?.tutar === undefined ? '' : String(k.tutar)}
                                                                onChange={e => pafGuncelle(t.id, 'tutar', e.target.value)} />
                                                        </td>
                                                        <td className="p-1">
                                                            <input className={mini + ' w-full'} value={k?.not || ''}
                                                                placeholder="kaynak / açıklama"
                                                                onChange={e => pafGuncelle(t.id, 'not', e.target.value)} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                    <tr className="bg-emerald-200/60 dark:bg-emerald-900/50">
                                        <td className="p-1 font-bold">TOPLAM KALİTE MALİYETİ</td>
                                        <td className="p-1 text-right font-bold tabular-nums">
                                            {paf.toplam.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                                        </td>
                                        <td className="p-1 text-[11px]">
                                            uygunluk {paf.uygunlukPayi === null ? '—'
                                                : paf.uygunlukPayi.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%'}
                                            {' · '}başarısızlık {paf.basarisizlikPayi === null ? '—'
                                                : paf.basarisizlikPayi.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%'}
                                            {paf.eksik > 0 && <span className="text-amber-700"> · {paf.eksik} kalem girilmedi</span>}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Grafik: yazdırma ve mail ile AYNI üreticiden. */}
                        <div className="mt-2 p-2 rounded bg-white dark:bg-gray-800"
                            dangerouslySetInnerHTML={{ __html: pafGrafikHtml(paf) }} />

                        {pafOneriler.length > 0 && (
                            <div className="mt-2 p-2 rounded border border-amber-300 dark:border-amber-700
                                bg-amber-50 dark:bg-amber-900/20">
                                <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                                    PAF dengesinden çıkan aksiyon önerileri ({pafOneriler.length})
                                </div>
                                {pafOneriler.map((o, i) => {
                                    const eklendi = satirlar.some(x => x.ozet === o.konu);
                                    return (
                                        <div key={i} className="flex items-start gap-2 py-1 text-xs
                                            border-b border-amber-200/60 dark:border-amber-800/60">
                                            <span className="flex-1">{o.konu}
                                                <span className="text-gray-500"> · termin {o.termin}</span></span>
                                            {eklendi
                                                ? <span className="text-green-700 dark:text-green-400 whitespace-nowrap">✓ eklendi</span>
                                                : <button onClick={() => pafOneriEkle(o.konu, o.termin)}
                                                    className="px-2 py-0.5 rounded border border-amber-500 whitespace-nowrap
                                                        text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40">
                                                    ＋ rapora ekle
                                                </button>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700" style={{ maxHeight: '62vh' }}>
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 z-10">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold w-[34%]">Kriter</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold">Özet Açıklama</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold">Aksiyon</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold w-[12%]">Sorumlu</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold w-[10%]">Termin</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold w-[11%]">Durum</th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {satirlar.map(s => (
                                <tr key={s.id} className="border-b border-gray-200 dark:border-gray-700 align-top">
                                    <td className="px-3 py-2">
                                        <input className={alan + ' font-medium'} value={s.kriter} placeholder="Kriter"
                                            onChange={e => guncelle(s.id, 'kriter', e.target.value)} />
                                        <OtoTextarea value={gosterilenOto(s)}
                                            onChange={e => guncelle(s.id, 'otoElle', e.target.value)}
                                            className="mt-1 w-full text-xs p-2 rounded bg-gray-100 dark:bg-gray-700
                                                text-gray-700 dark:text-gray-200 border border-transparent
                                                focus:border-gray-400 focus:bg-white dark:focus:bg-gray-800" />
                                        {s.otoElle !== undefined && s.otoElle !== otoMetin(s.id) && (
                                            <button className="text-[10px] text-blue-600 hover:underline"
                                                onClick={() => setSatirlar(x => x.map(y => y.id === s.id
                                                    ? { ...y, otoElle: undefined } : y))}>
                                                otomatiğe dön
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-2 py-2">
                                        <OtoTextarea className={alan} value={s.ozet}
                                            onChange={e => guncelle(s.id, 'ozet', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2">
                                        <OtoTextarea className={alan} value={s.aksiyon}
                                            onChange={e => guncelle(s.id, 'aksiyon', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input className={alan} value={s.sorumlu || ''} placeholder="Ad Soyad"
                                            onChange={e => guncelle(s.id, 'sorumlu', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2">
                                        <input type="date" className={alan} value={s.termin || ''}
                                            onChange={e => guncelle(s.id, 'termin', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2">
                                        <select className={alan} value={s.durum || ''}
                                            onChange={e => guncelle(s.id, 'durum', e.target.value)}>
                                            {['', 'Planlandı', 'Devam ediyor', 'Tamamlandı', 'İptal'].map(x =>
                                                <option key={x} value={x}>{x || '—'}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-1 py-2 text-center">
                                        <button title="Satırı sil" onClick={() => satirSil(s.id)}
                                            className="text-red-600 hover:text-red-800">✕</button>
                                    </td>
                                </tr>
                            ))}
                            {satirlar.length === 0 && (
                                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                                    Tüm satırlar silinmiş. “＋ Satır ekle” ile yeni satır açabilirsiniz.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
};

export default AylikKaliteModal;
