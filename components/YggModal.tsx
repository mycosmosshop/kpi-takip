// YGG (Yönetimin Gözden Geçirmesi) raporu — LOKASYON BAZINDA, anlık.
//
// Bölümler standart YGG metniyle DOLU gelir; başlık ve metin düzenlenebilir,
// bölüm silinebilir, yeni bölüm eklenebilir. Her bölümün altında sorumlu ve
// terminli aksiyon tablosu var. Otomatik satırlar canlı veriden gelir ve
// kaydedilmez — her açılışta yeniden üretilir.
import React, { useEffect, useMemo, useState } from 'react';
import { Kpi, ActionItem, MultiYearKpiData } from '../types';
import { yggBolumleri, yggAnahtar, yggAnahtarCoz, yggBirlestir, YggKayitBolum, YggAksiyon } from '../utils/ygg';
import { maliyetCek, MaliyetSatir, erpPafKalemleri } from '../utils/kaliteMaliyet';
import { aylikKaliteAnahtar } from '../utils/aylikKalite';
import {
    PafKalem, PafKategori, pafOzet, PAF_KATALOG, PAF_ADI, PAF_GRUP_ADI,
} from '../utils/paf';
import { katilimciCoz, YggKatilimci } from '../utils/ygg';
import { yggKatilimcilari } from '../utils/kadro';
// adGecer: Türkçe İ/ı katlayan arama (regex'in /i bayrağı yetmiyor).
import { adGecer } from '../utils/aylikKalite';
import { vurguParcala, vurguVar } from '../utils/vurgu';
import { yggMailGonder, yggMailDurumOku, adresListesi, YggMailDurum } from '../utils/yggMail';
import { cloudFetchMeta, cloudSaveMeta, cloudListMeta, cloudDeleteMeta } from '../utils/cloudSync';
import { kpiGrafikHtml } from '../utils/yggGrafik';
import Modal from './Modal';
import OtoTextarea from './OtoTextarea';

// Aranan kelimeyi SARI işaretler — düz metinde. input/textarea içine HTML
// konamaz, orada alanın kendisi sarıya boyanır (aşağıdaki sariAlan).
const Vurgu: React.FC<{ metin: string; ara: string }> = ({ metin, ara }) => (
    <>
        {vurguParcala(metin, ara).map((p, i) => p.vurgulu
            ? <mark key={i} className="bg-yellow-300 dark:bg-yellow-400/70 text-black rounded px-0.5">
                {p.metin}
            </mark>
            : <React.Fragment key={i}>{p.metin}</React.Fragment>)}
    </>
);

interface Props {
    isOpen: boolean;
    onClose: () => void;
    kpis: Kpi[];
    aksiyonlar: ActionItem[];
    multiYearData: MultiYearKpiData;
    lokasyon: string;      // GÖSTERİM adı (“Ankara”)
    lokasyonId?: string;   // bulut anahtarı (“ankara”) — DEĞİŞMEMELİ
    yil: number;
}

const YggModal: React.FC<Props> = ({ isOpen, onClose, kpis, aksiyonlar, multiYearData, lokasyon, lokasyonId, yil }) => {
    const [bolumler, setBolumler] = useState<YggKayitBolum[]>([]);
    const [durum, setDurum] = useState<'yukleniyor' | 'hazir' | 'kaydediliyor' | 'kaydedildi' | 'hata'>('yukleniyor');
    const [hata, setHata] = useState('');
    const [katilanlar, setKatilanlar] = useState('');
    const [katilimcilar, setKatilimcilar] = useState<YggKatilimci[]>([]);
    const [mailAcik, setMailAcik] = useState(false);
    const [mailCc, setMailCc] = useState('');
    const [mailKonu, setMailKonu] = useState('');
    const [mailNot, setMailNot] = useState('');
    const [mailDurum, setMailDurum] = useState<YggMailDurum | null>(null);
    const [ara, setAra] = useState('');
    const [tarih, setTarih] = useState('');
    // Kaydedilmiş YGG raporları (Kalite Raporu'ndaki liste ile aynı davranış):
    // aç/düzenle ve kalıcı sil. null = henüz yüklenmedi.
    const [kayitli, setKayitli] = useState<{ key: string; updated_at: string | null }[] | null>(null);
    const [listeAcik, setListeAcik] = useState(false);
    // Silinen standart maddeler: kayıtta tutulmazsa her açılışta geri gelir.
    const [silinenler, setSilinenler] = useState<string[]>([]);
    // Kalite maliyeti (egt_ayar). Okunamazsa madde "veri çekilmemiş" der,
    // uydurma tutar yazmaz.
    const [maliyet, setMaliyet] = useState<MaliyetSatir[] | undefined>(undefined);
    // Yıl boyu PAF kalemleri: 12 aylık Kalite Raporu kaydından toplanır.
    // Önleme/değerleme kalemleri orada elle giriliyor; YGG onları toplar.
    const [pafKalemler, setPafKalemler] = useState<PafKalem[]>([]);

    // Kaydedilmiş YGG listesi: lokasyon/yıl değişince değil, modal açılınca.
    useEffect(() => {
        if (!isOpen) return;
        let iptal = false;
        cloudListMeta('ygg_')
            .then(l => { if (!iptal) setKayitli(l); })
            .catch(() => { if (!iptal) setKayitli([]); });
        return () => { iptal = true; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        let iptal = false;
        Promise.all(Array.from({ length: 12 }, (_, i) =>
            cloudFetchMeta(aylikKaliteAnahtar(lokasyonId || lokasyon, yil, i + 1)).catch(() => null)))
            .then(liste => {
                if (iptal) return;
                const toplam = new Map<string, number>();
                const notlar = new Map<string, string>();
                liste.forEach(v => {
                    const k = (v && Array.isArray(v.pafKalemler)) ? v.pafKalemler as PafKalem[] : [];
                    k.forEach(x => {
                        // Girilmemiş (null) kalem toplanmaz; 0 TL ile
                        // "girilmedi" ayrı kalsın.
                        if (x.tutar === null || x.tutar === undefined) return;
                        toplam.set(x.id, (toplam.get(x.id) || 0) + Number(x.tutar));
                        if (x.not) notlar.set(x.id, x.not);
                    });
                });
                setPafKalemler(Array.from(toplam.entries())
                    .map(([id, tutar]) => ({ id, tutar, not: notlar.get(id) || '' })));
            })
            .catch(() => { if (!iptal) setPafKalemler([]); });
        return () => { iptal = true; };
    }, [isOpen, lokasyon, lokasyonId, yil]);

    // YGG'de ELLE girilen yıllık tutarlar (aylık toplamı ezer): önleme ve
    // değerleme kalemleri aylık raporda doldurulmadıysa yıl sonunda buradan
    // girilebilsin — aksi hâlde madde boş kalıyordu.
    const [pafYillik, setPafYillik] = useState<PafKalem[]>([]);
    const [pafAcik, setPafAcik] = useState(false);

    // ERP'den gelen yıllık başarısızlık maliyetleri (uygunsuzluk × birim fiyat)
    // ERP başarısızlık maliyetleri (yıl toplamı) — eşleme utils/kaliteMaliyet'te.
    const erpPaf = useMemo(
        () => erpPafKalemleri(maliyet || [], lokasyon, yil),
        [maliyet, yil, lokasyon]);

    // Öncelik: YGG'de elle girilen → aylık raporlardan toplanan → ERP
    const pafListe = useMemo<PafKalem[]>(() => PAF_KATALOG.map(t => {
        const elle = pafYillik.find(x => x.id === t.id);
        if (elle && elle.tutar !== null && elle.tutar !== undefined) return elle;
        const aylik = pafKalemler.find(x => x.id === t.id);
        if (aylik && aylik.tutar !== null && aylik.tutar !== undefined) return aylik;
        const e = erpPaf[t.id];
        return { id: t.id, tutar: (e === undefined ? null : Math.round(e)), not: elle?.not || aylik?.not || '' };
    }), [pafYillik, pafKalemler, erpPaf]);

    const pafToplam = useMemo(() => pafOzet(pafListe), [pafListe]);

    const pafGuncelle = (id: string, alan: 'tutar' | 'not', v: string) => setPafYillik(p => {
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

    useEffect(() => {
        if (!isOpen) return;
        let iptal = false;
        maliyetCek().then(d => { if (!iptal) setMaliyet(d); }).catch(() => { if (!iptal) setMaliyet([]); });
        return () => { iptal = true; };
    }, [isOpen]);

    // Anahtar ID'den: ad ile üretilirse “Çerkezköy” farklı anahtar
    // olur ve eski kayıtlar kaybolurdu.
    const anahtar = yggAnahtar(lokasyonId || lokasyon, yil);
    const standart = useMemo(
        () => yggBolumleri(lokasyon, yil, kpis, aksiyonlar, multiYearData, maliyet, pafListe, pafToplam),
        [lokasyon, yil, kpis, aksiyonlar, multiYearData, maliyet, pafListe, pafToplam]);
    const otoHarita = useMemo(() => new Map(standart.map(b => [b.id, b.otomatik])), [standart]);
    // Madde grafikleri (bakım, tedarikçi, maliyet…) — canlı, kaydedilmez.
    const grafikHarita = useMemo(
        () => new Map(standart.filter(b => b.grafik).map(b => [b.id, b.grafik as string])),
        [standart]);
    // Yazdırma sürümü: ekranda katlanan tablolar burada AÇIK basılır.
    const grafikYazdirHarita = useMemo(
        () => new Map(standart.map(b => [b.id, (b.grafikYazdir || b.grafik || '') as string])),
        [standart]);
    // Önerilen aksiyonlar: KULLANICI ONAYLAYINCA rapora girer. Otomatik
    // eklenseydi, kimsenin taahhüt etmediği aksiyon kayda geçerdi.
    const oneriHarita = useMemo(
        () => new Map(standart.filter(b => (b.oneriler || []).length)
            .map(b => [b.id, b.oneriler as YggAksiyon[]])),
        [standart]);

    const oneriEkle = (bid: string, o: YggAksiyon) => setBolumler(b => b.map(x => x.id === bid
        ? (x.aksiyonlar.some(a => a.konu === o.konu)   // aynı öneri iki kez girmesin
            ? x
            : { ...x, aksiyonlar: [...x.aksiyonlar, { ...o, id: 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) }] })
        : x));

    const oneriHepsiniEkle = (bid: string) => {
        const liste = oneriHarita.get(bid) || [];
        setBolumler(b => b.map(x => {
            if (x.id !== bid) return x;
            const yeni = liste
                .filter(o => !x.aksiyonlar.some(a => a.konu === o.konu))
                .map((o, i) => ({ ...o, id: 'a_' + Date.now() + '_' + i }));
            return yeni.length ? { ...x, aksiyonlar: [...x.aksiyonlar, ...yeni] } : x;
        }));
    };
    // Grafik HTML'i TEK yerde uretilir; hem ekranda hem yazdirmada ayni.
    const grafik = useMemo(() => kpiGrafikHtml(kpis, yil), [kpis, yil]);

    // Notları buluttan oku. Okunamazsa BOŞ göstermek yerine hatayı söyle:
    // sessizce boş açılırsa kullanıcı üstüne yazar ve eskisini kaybeder.
    useEffect(() => {
        if (!isOpen) return;
        let iptal = false;
        setDurum('yukleniyor'); setHata('');
        cloudFetchMeta(anahtar)
            .then(v => {
                if (iptal) return;
                const o = v || {};
                const sil = Array.isArray(o.silinenler) ? o.silinenler : [];
                setSilinenler(sil);
                setPafYillik(Array.isArray(o.pafYillik) ? o.pafYillik as PafKalem[] : []);
                setBolumler(yggBirlestir(standart, Array.isArray(o.bolumler) ? o.bolumler : null, sil));
                setKatilanlar(o.katilanlar || '');
                // Eski kayıtta yalnızca metin vardı; göç edilmezse
                // katılımcılar boş görünürdü.
                const kayitli = Array.isArray(o.katilimcilar) && o.katilimcilar.length
                    ? o.katilimcilar as YggKatilimci[]
                    : katilimciCoz(o.katilanlar || '');
                // Hiç kayıt yoksa lokasyonun kadrosuyla başlat (utils/kadro.ts);
                // kullanıcı düzenleyip silebilir, kayıtlı liste bir daha ezilmez.
                setKatilimcilar(kayitli.length ? kayitli
                    : yggKatilimcilari(lokasyonId || lokasyon).map((k, i) => ({
                        id: 'kd_' + i, ad: k.ad, gorev: k.gorev, eposta: k.eposta,
                    })));
                setTarih(o.tarih || '');
                setDurum('hazir');
            })
            .catch(e => {
                if (iptal) return;
                setHata(String(e?.message || e)); setDurum('hata');
            });
        return () => { iptal = true; };
    }, [isOpen, anahtar]);   // standart bilerek yok: her veri değişiminde metni sıfırlamasın

    const listeyiTazele = () => cloudListMeta('ygg_')
        .then(l => setKayitli(l))
        .catch(() => setKayitli([]));

    const kaydet = async () => {
        setDurum('kaydediliyor'); setHata('');
        try {
            await cloudSaveMeta(anahtar, { bolumler, silinenler, katilanlar, katilimcilar,
                pafYillik, tarih, guncelleme: new Date().toISOString() });
            setDurum('kaydedildi'); setTimeout(() => setDurum('hazir'), 2000);
            listeyiTazele();   // yeni kayıt listede hemen görünsün
        } catch (e: any) { setHata(String(e?.message || e)); setDurum('hata'); }
    };

    const raporSil = async (key: string) => {
        const c = yggAnahtarCoz(key);
        const ad = c ? `${c.lokasyon} · ${c.yil}` : key;
        if (!window.confirm(`${ad} YGG raporu KALICI olarak silinecek.\n\n`
            + 'Yazdığınız değerlendirme, katılımcılar, aksiyon ve terminler gider; '
            + 'lokasyon yeniden açıldığında standart YGG taslağı gelir.\n\nSilinsin mi?')) return;
        try {
            await cloudDeleteMeta(key);
            await listeyiTazele();
            if (key === anahtar) {
                // Açık olan rapor silindiyse ekran da taslağa dönmeli; yoksa
                // kullanıcı silinmiş raporu düzenlemeye devam eder.
                setSilinenler([]);
                setBolumler(yggBirlestir(standart, null, []));
                setKatilimcilar(yggKatilimcilari(lokasyonId || lokasyon).map((k, i) => ({
                    id: 'kd_' + i, ad: k.ad, gorev: k.gorev, eposta: k.eposta,
                })));
                setTarih(''); setKatilanlar('');
            }
            setHata('');
        } catch (e: any) { setHata('Silinemedi: ' + String(e?.message || e)); setDurum('hata'); }
    };

    const guncelle = (id: string, alan: 'baslik' | 'metin' | 'madde', v: string) =>
        setBolumler(b => b.map(x => x.id === id ? { ...x, [alan]: v } : x));

    const bolumSil = (id: string) => {
        setBolumler(b => b.filter(x => x.id !== id));
        // Standart madde ise silme kaydı bırak; yoksa geri gelir.
        if (!id.startsWith('ek_')) setSilinenler(s => s.includes(id) ? s : [...s, id]);
    };

    // Bölümün aranabilir tüm metni. Grafik HTML'i dışarıda: içinde stil
    // adları var, "background" araması her bölümü eşlerdi.
    const bolumMetni = (b: YggKayitBolum): string =>
        [b.madde, b.baslik, b.metin,
            (otoHarita.get(b.id) || []).join(' '),
            b.aksiyonlar.map(a => `${a.konu} ${a.sorumlu} ${a.termin} ${a.durum}`).join(' ')].join(' ');

    const gorunenBolumler = ara.trim()
        ? bolumler.filter(b => adGecer(bolumMetni(b), [ara.trim()]))
        : bolumler;

    // ── Katılımcılar ──
    const katEkle = () => setKatilimcilar(k => [...k, {
        id: 'kt_' + Date.now(), ad: '', gorev: '', eposta: '',
    }]);
    const katGuncelle = (id: string, alan: keyof YggKatilimci, v: string) =>
        setKatilimcilar(k => k.map(x => x.id === id ? { ...x, [alan]: v } : x));
    const katSil = (id: string) => setKatilimcilar(k => k.filter(x => x.id !== id));

    // ── Mail ──
    // Yalnızca kutucuğu işaretli katılımcılara gider (eski kayıtlarda
    // alan yok: tanımsız = işaretli sayılır).
    const mailAlicilar = adresListesi(
        katilimcilar.filter(k => k.gonder !== false).map(k => k.eposta));
    const mailCcListe = adresListesi(mailCc);

    useEffect(() => {
        if (!isOpen) return;
        let iptal = false;
        yggMailDurumOku().then(d => { if (!iptal) setMailDurum(d); }).catch(() => { });
        return () => { iptal = true; };
    }, [isOpen]);

    useEffect(() => {
        if (mailAcik && !mailKonu) {
            setMailKonu(`${yil} Yılı Yönetimin Gözden Geçirmesi (YGG) — ${lokasyon}`);
        }
    }, [mailAcik, mailKonu, yil, lokasyon]);

    const mailYolla = async () => {
        if (!mailAlicilar.length) { setHata('Katılımcılarda geçerli e-posta yok.'); return; }
        setDurum('kaydediliyor'); setHata('');
        try {
            // Rapor mailde de AYNI belge olsun diye raporHtml() kullanılır.
            const not = mailNot.trim()
                ? `<p style="background:#f4f6f8;padding:8px;border-left:3px solid #888">${esc(mailNot).replace(/\n/g, '<br>')}</p>`
                : '';
            await yggMailGonder({
                lokasyon, yil,
                konu: mailKonu || `${yil} YGG — ${lokasyon}`,
                alicilar: mailAlicilar,
                cc: mailCcListe,
                html: raporHtml().replace('<h1>', not + '<h1>'),
                pdf: true,
                dosyaAdi: `YGG_${lokasyon}_${yil}`.replace(/[^\w\-]+/g, '_'),
            });
            setMailAcik(false);
            setDurum('kaydedildi'); setTimeout(() => setDurum('hazir'), 3000);
            setMailDurum({ ...(mailDurum || {}), istekDurum: 'kuyrukta' });
        } catch (e: any) { setHata('Mail isteği yazılamadı: ' + String(e?.message || e)); setDurum('hata'); }
    };

    const bolumEkle = () => setBolumler(b => [...b, {
        id: 'ek_' + Date.now(), madde: 'Ek', baslik: '', metin: '', aksiyonlar: [], eklenen: true,
    }]);

    const aksEkle = (id: string) => setBolumler(b => b.map(x => x.id === id
        ? { ...x, aksiyonlar: [...x.aksiyonlar, { id: 'a_' + Date.now(), konu: '', sorumlu: '', termin: '', durum: 'Planlandı' }] }
        : x));

    const aksGuncelle = (bid: string, aid: string, alan: keyof YggAksiyon, v: string) =>
        setBolumler(b => b.map(x => x.id === bid
            ? { ...x, aksiyonlar: x.aksiyonlar.map(a => a.id === aid ? { ...a, [alan]: v } : a) }
            : x));

    const aksSil = (bid: string, aid: string) => setBolumler(b => b.map(x => x.id === bid
        ? { ...x, aksiyonlar: x.aksiyonlar.filter(a => a.id !== aid) } : x));

    const yazdir = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(raporHtml());
        w.document.close(); w.focus();
    };

    const esc = (t: string) => String(t || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Rapor HTML'i TEK yerde üretilir: yazdırma ve mail AYNI belgeyi
    // kullanır. İki ayrı üretici olsaydı biri güncellenip diğeri
    // unutulurdu (grafiklerde bunun bedeli ödendi).
    const raporHtml = (): string => {
        const govde = bolumler.map(b => {
            const oto = otoHarita.get(b.id) || [];
            const aks = b.aksiyonlar.length ? `
                <table class="aks"><thead><tr><th>Aksiyon / Karar</th><th>Sorumlu</th><th>Termin</th><th>Durum</th></tr></thead>
                <tbody>${b.aksiyonlar.map(a => `<tr><td>${esc(a.konu)}</td><td>${esc(a.sorumlu)}</td>
                    <td>${esc(a.termin)}</td><td>${esc(a.durum)}</td></tr>`).join('')}</tbody></table>` : '';
            return `<h3><span class="md">${esc(b.madde)}</span> ${esc(b.baslik)}</h3>
                ${b.metin ? `<p>${esc(b.metin).replace(/\n/g, '<br>')}</p>` : ''}
                ${oto.length ? `<ul class="oto">${oto.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
                ${grafikYazdirHarita.get(b.id) || ''}
                ${aks}`;
        }).join('');
        return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
            <title>YGG ${esc(lokasyon)} ${yil}</title><style>
            body{font-family:Segoe UI,Arial,sans-serif;font-size:11.5pt;color:#111;margin:24px;line-height:1.5}
            h1{font-size:15pt;margin:0 0 3px} h2{font-size:11pt;color:#444;margin:0 0 16px;font-weight:normal}
            h3{font-size:11pt;margin:16px 0 5px;border-bottom:1px solid #bbb;padding-bottom:3px}
            .md{color:#666;font-weight:normal;font-size:9.5pt;margin-right:5px}
            p{margin:4px 0;text-align:justify}
            ul.oto{margin:6px 0 6px 18px;padding:0;font-size:10pt;color:#333}
            table.aks{border-collapse:collapse;width:100%;margin:8px 0;font-size:10pt}
            table.aks th,table.aks td{border:1px solid #999;padding:4px 7px;text-align:left}
            table.aks th{background:#f0f0f0}
            .ust{margin-bottom:14px;font-size:10.5pt}
            @media print{body{margin:12mm} h3{page-break-after:avoid}}
            </style></head><body>
            <h1>${yil} YILI YÖNETİMİN GÖZDEN GEÇİRMESİ TOPLANTISI (YGG)</h1>
            <h2>Lokasyon: ${esc(lokasyon)}</h2>
            <div class="ust"><b>Toplantı tarihi/saati:</b> ${esc(tarih) || '—'}</div>
            <h3><span class="md">Katılımcılar</span> Toplantıya katılanlar</h3>
            ${katilimcilar.length
                ? `<table class="aks"><thead><tr><th>Ad Soyad</th><th>Görev</th><th>E-posta</th></tr></thead>
                   <tbody>${katilimcilar.map(k => `<tr><td>${esc(k.ad)}</td><td>${esc(k.gorev)}</td>
                   <td>${esc(k.eposta)}</td></tr>`).join('')}</tbody></table>`
                : `<p>${esc(katilanlar) || '—'}</p>`}
            <h3><span class="md">KPI</span> ${yil} yılı KPI performans özeti</h3>
            ${grafik}
            ${govde}
            <p style="margin-top:20px;font-size:9pt;color:#666">Madde işaretli satırlar KPI Takip
            uygulamasındaki ${esc(lokasyon)} / ${yil} verisinden ${new Date().toLocaleString('tr-TR')}
            tarihinde üretilmiştir.</p></body></html>`;
    };

    const alan = 'w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded '
        + 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
    const mini = 'text-xs p-1.5 border border-gray-300 dark:border-gray-600 rounded '
        + 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
    // Yazılabilir alanda <mark> kullanılamaz; aranan metin içindeyse alanın
    // kendisi sarıya boyanır, böylece "nerede geçiyor" gözle bulunur.
    const sariAlan = (metin: string): string =>
        vurguVar(metin, ara) ? ' ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/40' : '';

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="7xl"
            title={`YGG — ${lokasyon} / ${yil}`}
            footer={
                <div className="flex items-center gap-3 justify-end w-full">
                    <span className="text-xs mr-auto">
                        {durum === 'yukleniyor' && 'Yükleniyor…'}
                        {durum === 'kaydediliyor' && 'Kaydediliyor…'}
                        {durum === 'kaydedildi' && <span className="text-green-600">✓ Kaydedildi</span>}
                        {durum === 'hata' && <span className="text-red-600">Hata: {hata}</span>}
                        {durum === 'hazir' && <span className="text-gray-500">{bolumler.length} bölüm</span>}
                    </span>
                    <button onClick={bolumEkle}
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                        ＋ Bölüm ekle
                    </button>
                    <button onClick={yazdir}
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                        🖨️ Yazdır / PDF
                    </button>
                    <button onClick={() => setMailAcik(true)}
                        className="px-3 py-2 text-sm border border-indigo-300 dark:border-indigo-700 rounded
                            text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                        📧 Katılımcılara maille gönder
                    </button>
                    <button onClick={kaydet} disabled={durum === 'yukleniyor' || durum === 'kaydediliyor'}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                        Kaydet
                    </button>
                </div>
            }>
            <div className="text-sm">
                {/* Arama: "içinde şu var mı?" sorusunun cevabı */}
                <div className="mb-3 flex items-center gap-2">
                    <input value={ara} onChange={e => setAra(e.target.value)}
                        placeholder="🔍 Raporda ara — madde, başlık, metin, veri satırı, aksiyon…"
                        className={alan + ' flex-1'} />
                    <button onClick={() => setPafAcik(v => !v)}
                        className="px-3 py-2 text-sm rounded border border-emerald-300 dark:border-emerald-700
                            text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30
                            whitespace-nowrap">
                        💰 Kalite maliyeti (PAF)
                        {pafToplam.toplam > 0
                            ? ` — ${pafToplam.toplam.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL` : ''}
                    </button>
                    <button onClick={() => setListeAcik(v => !v)}
                        className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600
                            hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap">
                        📁 Kayıtlar{kayitli ? ` (${kayitli.length})` : ''}
                    </button>
                    {ara.trim() && (
                        <>
                            <span className={'text-xs whitespace-nowrap '
                                + (gorunenBolumler.length ? 'text-gray-600 dark:text-gray-300' : 'text-red-600')}>
                                {gorunenBolumler.length
                                    ? `${gorunenBolumler.length} bölümde bulundu`
                                    : 'bulunamadı'}
                            </span>
                            <button onClick={() => setAra('')}
                                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600">
                                temizle
                            </button>
                        </>
                    )}
                </div>

                {listeAcik && (
                    <div className="mb-3 p-3 rounded border border-gray-300 dark:border-gray-600
                        bg-gray-50 dark:bg-gray-800">
                        <div className="font-semibold text-sm mb-2">📁 Kaydedilmiş YGG raporları</div>
                        {kayitli === null && <div className="text-xs text-gray-500">Yükleniyor…</div>}
                        {kayitli && kayitli.length === 0 && (
                            <div className="text-xs text-gray-500">Henüz kaydedilmiş YGG raporu yok.</div>
                        )}
                        <div className="max-h-56 overflow-auto">
                            {(kayitli || []).map(r => {
                                const c = yggAnahtarCoz(r.key);
                                if (!c) return null;
                                const secili = r.key === anahtar;
                                return (
                                    <div key={r.key}
                                        className={'flex items-center gap-2 py-1 border-b border-gray-200 '
                                            + 'dark:border-gray-700 text-xs '
                                            + (secili ? 'bg-blue-50 dark:bg-blue-900/30' : '')}>
                                        <span className="flex-1">
                                            <b className="capitalize">{c.lokasyon}</b> · {c.yil}
                                            {r.updated_at && (
                                                <span className="text-gray-500">
                                                    {' '}· kaydedildi {new Date(r.updated_at).toLocaleString('tr-TR')}
                                                </span>
                                            )}
                                        </span>
                                        {secili
                                            ? <span className="text-blue-700 dark:text-blue-300">açık</span>
                                            : <span className="text-gray-400"
                                                title="Bu rapor başka lokasyon/yıla ait">
                                                KPI Takip’te lokasyon/yılı değiştirin
                                            </span>}
                                        <button onClick={() => raporSil(r.key)} title="Kaydı kalıcı sil"
                                            className="px-1 text-red-600 hover:text-red-800">🗑️</button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-2">
                            Liste tüm lokasyonların kayıtlarını gösterir; açık olan
                            <b> {lokasyon} / {yil}</b>. Başkasını düzenlemek için üst çubuktan
                            lokasyon veya yılı değiştirin — kayıt orada açılır.
                        </div>
                    </div>
                )}
                {pafAcik && (
                    <div className="mb-3 p-3 rounded border border-emerald-300 dark:border-emerald-700
                        bg-emerald-50/50 dark:bg-emerald-900/20">
                        <div className="font-semibold text-sm mb-1">
                            💰 {yil} kalite maliyeti — PAF (önleme · değerleme · iç · dış)
                        </div>
                        <div className="text-[11px] text-gray-600 dark:text-gray-300 mb-2">
                            İç/dış başarısızlık ve tedarikçi kaynaklı tutarlar ERP'den (uygunsuzluk ×
                            birim fiyat) otomatik gelir. <b>Önleme ve değerleme kalemlerinin tutarı
                            ERP'de yoktur</b> — yıllık toplamı buraya girin; Kalite Raporu'nda (ay bazlı)
                            girdiyseniz oradan toplanır ve burada görünür. Buraya yazdığınız değer
                            aylık toplamı ezer. Boş bırakılan kalem <b>0 TL sayılmaz</b>, eksik sayılır.
                        </div>
                        <div className="overflow-auto" style={{ maxHeight: '45vh' }}>
                            <table className="w-full border-collapse text-xs">
                                <thead className="sticky top-0 bg-emerald-100/80 dark:bg-emerald-900/50">
                                    <tr>
                                        <th className="p-1 text-left">Kalem</th>
                                        <th className="p-1 text-right w-32">Yıllık tutar (TL)</th>
                                        <th className="p-1 text-left w-1/4">Not</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(['onleme', 'degerlendirme', 'ic', 'dis'] as PafKategori[]).map(kat => (
                                        <React.Fragment key={kat}>
                                            <tr className="bg-white/70 dark:bg-gray-800/60">
                                                <td className="p-1 font-semibold">{PAF_ADI[kat]}</td>
                                                <td className="p-1 text-right font-semibold tabular-nums">
                                                    {pafToplam.kategori[kat].toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                                                </td>
                                                <td className="p-1 text-gray-600 dark:text-gray-300">
                                                    {pafToplam.yuzde[kat] === null ? '' :
                                                        pafToplam.yuzde[kat]!.toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + '%'}
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
                                        <td className="p-1 font-bold">TOPLAM</td>
                                        <td className="p-1 text-right font-bold tabular-nums">
                                            {pafToplam.toplam.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                                        </td>
                                        <td className="p-1 text-[11px]">
                                            {PAF_GRUP_ADI.uygunluk} {pafToplam.grup.uygunluk.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                                            {' · '}{PAF_GRUP_ADI.uygunsuzluk} {pafToplam.grup.uygunsuzluk.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                                            {pafToplam.eksik > 0 && <span className="text-amber-700"> · {pafToplam.eksik} kalem girilmedi</span>}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="text-[11px] text-gray-600 dark:text-gray-300 mt-2">
                            Girilen tutarlar <b>9.3.2.1 a)</b> maddesinde tablo ve grafik olarak görünür;
                            YGG kaydıyla birlikte saklanır.
                        </div>
                    </div>
                )}

                {durum === 'hata' && (
                    <div className="mb-3 p-3 rounded bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                        Okunamadı: {hata}. <b>Kaydetmeyin</b> — kaydederseniz eski içeriğin üzerine yazılır.
                    </div>
                )}
                <div className="mb-4 p-3 rounded bg-blue-50 dark:bg-blue-900/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="text-xs">Toplantı tarihi/saati
                            <input className={alan} value={tarih} onChange={e => setTarih(e.target.value)}
                                placeholder="07.01.2027 10:00" />
                        </label>
                        <label className="text-xs">Toplantı yeri / notu
                            <input className={alan} value={katilanlar} onChange={e => setKatilanlar(e.target.value)}
                                placeholder="Toplantı salonu, çevrim içi vb." />
                        </label>
                    </div>

                    {/* Katılımcılar: mailin alıcı listesi de buradan çıkar. */}
                    <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-semibold">Toplantıya katılanlar</div>
                            <button onClick={katEkle}
                                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600
                                    hover:bg-white dark:hover:bg-gray-700">＋ Katılımcı ekle</button>
                        </div>
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr className="bg-white/60 dark:bg-gray-800/60">
                                    <th className="p-1 text-left">Ad Soyad</th>
                                    <th className="p-1 text-left w-1/3">Görev</th>
                                    <th className="p-1 text-left w-1/3">E-posta</th>
                                    <th className="p-1 text-center w-16" title="İşaretli olanlara rapor PDF olarak gönderilir">
                                        📄 Gönder</th>
                                    <th className="w-6"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {katilimcilar.map(k => (
                                    <tr key={k.id}>
                                        <td className="p-1"><input className={mini + ' w-full'} value={k.ad}
                                            onChange={e => katGuncelle(k.id, 'ad', e.target.value)} placeholder="Ad Soyad" /></td>
                                        <td className="p-1"><input className={mini + ' w-full'} value={k.gorev}
                                            onChange={e => katGuncelle(k.id, 'gorev', e.target.value)} placeholder="Görev / ünvan" /></td>
                                        <td className="p-1"><input className={mini + ' w-full'} value={k.eposta} type="email"
                                            onChange={e => katGuncelle(k.id, 'eposta', e.target.value)} placeholder="ad@sanifoam.com.tr" /></td>
                                        <td className="p-1 text-center">
                                            <input type="checkbox" className="w-4 h-4 accent-blue-600"
                                                checked={k.gonder !== false && !!k.eposta.trim()}
                                                disabled={!k.eposta.trim()}
                                                title={k.eposta.trim()
                                                    ? 'Rapor bu kişiye PDF olarak gönderilsin'
                                                    : 'E-posta yazılmadan gönderilemez'}
                                                onChange={e => setKatilimcilar(liste => liste.map(x =>
                                                    x.id === k.id ? { ...x, gonder: e.target.checked } : x))} />
                                        </td>
                                        <td className="p-1 text-center">
                                            <button onClick={() => katSil(k.id)}
                                                className="text-red-600 hover:text-red-800">✕</button>
                                        </td>
                                    </tr>
                                ))}
                                {katilimcilar.length === 0 && (
                                    <tr><td colSpan={5} className="p-2 text-center text-gray-500">
                                        Katılımcı eklenmedi. “＋ Katılımcı ekle” ile başlayın.
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                        <div className="text-[11px] text-gray-600 dark:text-gray-300 mt-1">
                            {mailAlicilar.length} kişiye PDF olarak gönderilecek
                            {mailDurum?.sonGonderim && ` · son gönderim: ${mailDurum.sonGonderim}`}
                            {mailDurum?.istekDurum === 'kuyrukta' && ' · gönderim isteği kuyrukta'}
                        </div>
                    </div>

                    {/* Mail onay kutusu — onaylı tedarikçi sistemindeki akışın aynısı */}
                    {mailAcik && (
                        <div className="mt-3 p-3 rounded border border-indigo-300 dark:border-indigo-700
                            bg-white dark:bg-gray-800">
                            <div className="font-semibold text-sm mb-2">📧 YGG raporunu maille gönder</div>
                            <label className="text-xs block mb-2">Konu
                                <input className={alan} value={mailKonu} onChange={e => setMailKonu(e.target.value)} />
                            </label>
                            <div className="text-xs mb-2">
                                <b>Alıcılar ({mailAlicilar.length}):</b>
                                <div className="mt-1 max-h-24 overflow-auto p-2 rounded bg-gray-50 dark:bg-gray-700">
                                    {mailAlicilar.length
                                        ? mailAlicilar.map((a, i) => <div key={a}>{i + 1}. {a}</div>)
                                        : <span className="text-red-600">Katılımcılarda geçerli e-posta yok —
                                            önce katılımcı tablosuna e-posta girin.</span>}
                                </div>
                            </div>
                            <label className="text-xs block mb-2">CC (virgül veya satırla ayırın)
                                <input className={alan} value={mailCc} onChange={e => setMailCc(e.target.value)}
                                    placeholder="kalite@sanifoam.com.tr, ..." />
                                {mailCcListe.length > 0 && (
                                    <span className="text-[11px] text-gray-500">CC: {mailCcListe.join(', ')}</span>
                                )}
                            </label>
                            <label className="text-xs block mb-2">Mailin başına eklenecek not (isteğe bağlı)
                                <textarea className={alan} rows={2} value={mailNot}
                                    onChange={e => setMailNot(e.target.value)} />
                            </label>
                            <div className="text-[11px] text-gray-600 dark:text-gray-300 mb-2">
                                Mail, <b>yerel gönderim görevi</b> (perf-mail, 15 dakikada bir) tarafından
                                Outlook’tan gönderilir — onaylı tedarikçi sistemindeki akışın aynısı.
                                Rapor, ekrandaki hâliyle (grafikler dâhil) gönderilir.
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setMailAcik(false)}
                                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded">
                                    Vazgeç
                                </button>
                                <button onClick={mailYolla} disabled={!mailAlicilar.length}
                                    className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded
                                        hover:bg-indigo-700 disabled:bg-gray-400">
                                    Gönderim isteği oluştur ({mailAlicilar.length})
                                </button>
                            </div>
                        </div>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                        Bu rapor <b>yalnızca {lokasyon}</b> lokasyonuna aittir; notlar her lokasyon ve
                        yıl için ayrı saklanır. Metinler standart YGG taslağıyla dolu gelir —
                        <b> düzenleyin, gerekmeyeni silin</b>. Madde işaretli satırlar canlı veriden
                        gelir, kaydedilmez.
                    </p>
                </div>

                <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 font-semibold">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">KPI</span>
                        {yil} yılı KPI performans özeti
                    </div>
                    {/* Grafik canli veriden; kaydedilmez, duzenlenmez. */}
                    <div className="px-3 py-2 bg-white dark:bg-gray-800"
                        dangerouslySetInnerHTML={{ __html: grafik }} />
                </div>

                {ara.trim() && gorunenBolumler.length > 0 && (
                    <div className="mb-2 text-xs text-amber-700 dark:text-amber-400">
                        Arama açık: {bolumler.length - gorunenBolumler.length} bölüm gizli.
                        Yazdırma ve mail RAPORUN TAMAMINI içerir.
                    </div>
                )}
                {gorunenBolumler.map(b => {
                    const oto = otoHarita.get(b.id) || [];
                    return (
                        <div key={b.id} className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 flex items-center gap-2">
                                <input className={mini + ' w-24 shrink-0' + sariAlan(b.madde)} value={b.madde}
                                    onChange={e => guncelle(b.id, 'madde', e.target.value)} placeholder="Madde" />
                                <input className={mini + ' flex-1 font-semibold' + sariAlan(b.baslik)} value={b.baslik}
                                    onChange={e => guncelle(b.id, 'baslik', e.target.value)} placeholder="Bölüm başlığı" />
                                <button title="Bölümü sil" onClick={() => bolumSil(b.id)}
                                    className="text-red-600 hover:text-red-800 px-1">✕</button>
                            </div>
                            <div className="px-3 py-2">
                                <OtoTextarea className={alan + sariAlan(b.metin)} value={b.metin}
                                    onChange={e => guncelle(b.id, 'metin', e.target.value)}
                                    placeholder="Bu maddeye ilişkin değerlendirme…" />
                                {oto.length > 0 && (
                                    <ul className="list-disc ml-5 mt-2 text-xs text-gray-700 dark:text-gray-300">
                                        {oto.map((x, i) => (
                                            <li key={i} className="my-0.5"><Vurgu metin={x} ara={ara} /></li>
                                        ))}
                                    </ul>
                                )}
                                {/* Maddeye ait grafik: yazdırmadakiyle AYNI üreticiden. */}
                                {grafikHarita.get(b.id) && (
                                    <div className="mt-2 p-2 rounded bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                                        dangerouslySetInnerHTML={{ __html: grafikHarita.get(b.id) as string }} />
                                )}

                                {(oneriHarita.get(b.id) || []).length > 0 && (() => {
                                    const oneriler = oneriHarita.get(b.id) as YggAksiyon[];
                                    const kalan = oneriler.filter(o => !b.aksiyonlar.some(a => a.konu === o.konu));
                                    return (
                                        <div className="mt-2 p-2 rounded border border-amber-300 dark:border-amber-700
                                            bg-amber-50 dark:bg-amber-900/20">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                                                    Hedefi tutturamayan KPI’lar için önerilen aksiyonlar
                                                    ({kalan.length}/{oneriler.length} eklenmedi)
                                                </div>
                                                {kalan.length > 0 && (
                                                    <button onClick={() => oneriHepsiniEkle(b.id)}
                                                        className="text-xs px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700">
                                                        Hepsini aksiyona ekle
                                                    </button>
                                                )}
                                            </div>
                                            <div className="max-h-40 overflow-auto">
                                                {oneriler.map((o, i) => {
                                                    const eklendi = b.aksiyonlar.some(a => a.konu === o.konu);
                                                    return (
                                                        <div key={i} className="flex items-start gap-2 py-1 text-xs
                                                            border-b border-amber-200/60 dark:border-amber-800/60">
                                                            <span className="flex-1">{o.konu}
                                                                <span className="text-gray-500">
                                                                    {' '}· termin {o.termin}
                                                                    {o.sorumlu ? ` · ${o.sorumlu}` : ' · sorumlu boş'}
                                                                </span>
                                                            </span>
                                                            {eklendi
                                                                ? <span className="text-green-700 dark:text-green-400 whitespace-nowrap">✓ eklendi</span>
                                                                : <button onClick={() => oneriEkle(b.id, o)}
                                                                    className="px-2 py-0.5 rounded border border-amber-500
                                                                        text-amber-800 dark:text-amber-200 whitespace-nowrap
                                                                        hover:bg-amber-100 dark:hover:bg-amber-900/40">
                                                                    ＋ ekle
                                                                </button>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-1">
                                                Öneriler rapora <b>eklemeden</b> girmez; ekledikten sonra konu,
                                                sorumlu ve termini düzenleyebilirsiniz.
                                            </div>
                                        </div>
                                    );
                                })()}

                                {b.aksiyonlar.length > 0 && (
                                    <table className="w-full mt-2 border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-gray-700">
                                                <th className="p-1 text-left">Aksiyon / Karar</th>
                                                <th className="p-1 text-left w-32">Sorumlu</th>
                                                <th className="p-1 text-left w-32">Termin</th>
                                                <th className="p-1 text-left w-32">Durum</th>
                                                <th className="w-6"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {b.aksiyonlar.map(a => (
                                                <tr key={a.id}>
                                                    <td className="p-1"><input className={mini + ' w-full' + sariAlan(a.konu)} value={a.konu}
                                                        onChange={e => aksGuncelle(b.id, a.id, 'konu', e.target.value)} /></td>
                                                    <td className="p-1"><input className={mini + ' w-full' + sariAlan(a.sorumlu)} value={a.sorumlu}
                                                        onChange={e => aksGuncelle(b.id, a.id, 'sorumlu', e.target.value)} /></td>
                                                    <td className="p-1"><input className={mini + ' w-full'} type="date" value={a.termin}
                                                        onChange={e => aksGuncelle(b.id, a.id, 'termin', e.target.value)} /></td>
                                                    <td className="p-1">
                                                        <select className={mini + ' w-full'} value={a.durum}
                                                            onChange={e => aksGuncelle(b.id, a.id, 'durum', e.target.value)}>
                                                            {['Planlandı', 'Devam ediyor', 'Tamamlandı', 'İptal'].map(x =>
                                                                <option key={x} value={x}>{x}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-1 text-center">
                                                        <button title="Aksiyonu sil" onClick={() => aksSil(b.id, a.id)}
                                                            className="text-red-600 hover:text-red-800">✕</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                                <button onClick={() => aksEkle(b.id)}
                                    className="mt-2 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                                    ＋ Aksiyon (sorumlu / termin)
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
};

export default YggModal;
