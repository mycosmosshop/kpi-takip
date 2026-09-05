// YGG (Yönetimin Gözden Geçirmesi) raporu — LOKASYON BAZINDA, anlık.
//
// Bölümler standart YGG metniyle DOLU gelir; başlık ve metin düzenlenebilir,
// bölüm silinebilir, yeni bölüm eklenebilir. Her bölümün altında sorumlu ve
// terminli aksiyon tablosu var. Otomatik satırlar canlı veriden gelir ve
// kaydedilmez — her açılışta yeniden üretilir.
import React, { useEffect, useMemo, useState } from 'react';
import { Kpi, ActionItem, MultiYearKpiData } from '../types';
import { yggBolumleri, yggAnahtar, yggBirlestir, YggKayitBolum, YggAksiyon } from '../utils/ygg';
import { maliyetCek, MaliyetSatir } from '../utils/kaliteMaliyet';
import { cloudFetchMeta, cloudSaveMeta } from '../utils/cloudSync';
import { kpiGrafikHtml } from '../utils/yggGrafik';
import Modal from './Modal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    kpis: Kpi[];
    aksiyonlar: ActionItem[];
    multiYearData: MultiYearKpiData;
    lokasyon: string;
    yil: number;
}

const YggModal: React.FC<Props> = ({ isOpen, onClose, kpis, aksiyonlar, multiYearData, lokasyon, yil }) => {
    const [bolumler, setBolumler] = useState<YggKayitBolum[]>([]);
    const [durum, setDurum] = useState<'yukleniyor' | 'hazir' | 'kaydediliyor' | 'kaydedildi' | 'hata'>('yukleniyor');
    const [hata, setHata] = useState('');
    const [katilanlar, setKatilanlar] = useState('');
    const [tarih, setTarih] = useState('');
    // Silinen standart maddeler: kayıtta tutulmazsa her açılışta geri gelir.
    const [silinenler, setSilinenler] = useState<string[]>([]);
    // Kalite maliyeti (egt_ayar). Okunamazsa madde "veri çekilmemiş" der,
    // uydurma tutar yazmaz.
    const [maliyet, setMaliyet] = useState<MaliyetSatir[] | undefined>(undefined);

    useEffect(() => {
        if (!isOpen) return;
        let iptal = false;
        maliyetCek().then(d => { if (!iptal) setMaliyet(d); }).catch(() => { if (!iptal) setMaliyet([]); });
        return () => { iptal = true; };
    }, [isOpen]);

    const anahtar = yggAnahtar(lokasyon, yil);
    const standart = useMemo(
        () => yggBolumleri(lokasyon, yil, kpis, aksiyonlar, multiYearData, maliyet),
        [lokasyon, yil, kpis, aksiyonlar, multiYearData, maliyet]);
    const otoHarita = useMemo(() => new Map(standart.map(b => [b.id, b.otomatik])), [standart]);
    // Madde grafikleri (bakım, tedarikçi, maliyet…) — canlı, kaydedilmez.
    const grafikHarita = useMemo(
        () => new Map(standart.filter(b => b.grafik).map(b => [b.id, b.grafik as string])),
        [standart]);
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
                setBolumler(yggBirlestir(standart, Array.isArray(o.bolumler) ? o.bolumler : null, sil));
                setKatilanlar(o.katilanlar || '');
                setTarih(o.tarih || '');
                setDurum('hazir');
            })
            .catch(e => {
                if (iptal) return;
                setHata(String(e?.message || e)); setDurum('hata');
            });
        return () => { iptal = true; };
    }, [isOpen, anahtar]);   // standart bilerek yok: her veri değişiminde metni sıfırlamasın

    const kaydet = async () => {
        setDurum('kaydediliyor'); setHata('');
        try {
            await cloudSaveMeta(anahtar, { bolumler, silinenler, katilanlar, tarih, guncelleme: new Date().toISOString() });
            setDurum('kaydedildi'); setTimeout(() => setDurum('hazir'), 2000);
        } catch (e: any) { setHata(String(e?.message || e)); setDurum('hata'); }
    };

    const guncelle = (id: string, alan: 'baslik' | 'metin' | 'madde', v: string) =>
        setBolumler(b => b.map(x => x.id === id ? { ...x, [alan]: v } : x));

    const bolumSil = (id: string) => {
        setBolumler(b => b.filter(x => x.id !== id));
        // Standart madde ise silme kaydı bırak; yoksa geri gelir.
        if (!id.startsWith('ek_')) setSilinenler(s => s.includes(id) ? s : [...s, id]);
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
        const esc = (t: string) => String(t || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const govde = bolumler.map(b => {
            const oto = otoHarita.get(b.id) || [];
            const aks = b.aksiyonlar.length ? `
                <table class="aks"><thead><tr><th>Aksiyon / Karar</th><th>Sorumlu</th><th>Termin</th><th>Durum</th></tr></thead>
                <tbody>${b.aksiyonlar.map(a => `<tr><td>${esc(a.konu)}</td><td>${esc(a.sorumlu)}</td>
                    <td>${esc(a.termin)}</td><td>${esc(a.durum)}</td></tr>`).join('')}</tbody></table>` : '';
            return `<h3><span class="md">${esc(b.madde)}</span> ${esc(b.baslik)}</h3>
                ${b.metin ? `<p>${esc(b.metin).replace(/\n/g, '<br>')}</p>` : ''}
                ${oto.length ? `<ul class="oto">${oto.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
                ${grafikHarita.get(b.id) || ''}
                ${aks}`;
        }).join('');
        w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8">
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
            <div class="ust"><b>Toplantı tarihi/saati:</b> ${esc(tarih) || '—'}<br>
            <b>Katılanlar:</b> ${esc(katilanlar) || '—'}</div>
            <h3><span class="md">KPI</span> ${yil} yılı KPI performans özeti</h3>
            ${grafik}
            ${govde}
            <p style="margin-top:20px;font-size:9pt;color:#666">Madde işaretli satırlar KPI Takip
            uygulamasındaki ${esc(lokasyon)} / ${yil} verisinden ${new Date().toLocaleString('tr-TR')}
            tarihinde üretilmiştir.</p></body></html>`);
        w.document.close(); w.focus();
    };

    const alan = 'w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded '
        + 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';
    const mini = 'text-xs p-1.5 border border-gray-300 dark:border-gray-600 rounded '
        + 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';

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
                    <button onClick={kaydet} disabled={durum === 'yukleniyor' || durum === 'kaydediliyor'}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                        Kaydet
                    </button>
                </div>
            }>
            <div className="text-sm">
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
                        <label className="text-xs">Katılanlar
                            <input className={alan} value={katilanlar} onChange={e => setKatilanlar(e.target.value)}
                                placeholder="Y. ULKAT, V. PEKATİK, …" />
                        </label>
                    </div>
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

                {bolumler.map(b => {
                    const oto = otoHarita.get(b.id) || [];
                    return (
                        <div key={b.id} className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 flex items-center gap-2">
                                <input className={mini + ' w-24 shrink-0'} value={b.madde}
                                    onChange={e => guncelle(b.id, 'madde', e.target.value)} placeholder="Madde" />
                                <input className={mini + ' flex-1 font-semibold'} value={b.baslik}
                                    onChange={e => guncelle(b.id, 'baslik', e.target.value)} placeholder="Bölüm başlığı" />
                                <button title="Bölümü sil" onClick={() => bolumSil(b.id)}
                                    className="text-red-600 hover:text-red-800 px-1">✕</button>
                            </div>
                            <div className="px-3 py-2">
                                <textarea className={alan} rows={3} value={b.metin}
                                    onChange={e => guncelle(b.id, 'metin', e.target.value)}
                                    placeholder="Bu maddeye ilişkin değerlendirme…" />
                                {oto.length > 0 && (
                                    <ul className="list-disc ml-5 mt-2 text-xs text-gray-700 dark:text-gray-300">
                                        {oto.map((x, i) => <li key={i} className="my-0.5">{x}</li>)}
                                    </ul>
                                )}
                                {/* Maddeye ait grafik: yazdırmadakiyle AYNI üreticiden. */}
                                {grafikHarita.get(b.id) && (
                                    <div className="mt-2 p-2 rounded bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                                        dangerouslySetInnerHTML={{ __html: grafikHarita.get(b.id) as string }} />
                                )}

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
                                                    <td className="p-1"><input className={mini + ' w-full'} value={a.konu}
                                                        onChange={e => aksGuncelle(b.id, a.id, 'konu', e.target.value)} /></td>
                                                    <td className="p-1"><input className={mini + ' w-full'} value={a.sorumlu}
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
