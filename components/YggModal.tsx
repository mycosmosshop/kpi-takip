// YGG (Yönetimin Gözden Geçirmesi) raporu — LOKASYON BAZINDA, anlık.
//
// Otomatik bölümler her açılışta canlı veriden yeniden üretilir; notlar
// lokasyon+yıl anahtarıyla buluta yazılır (kpi_meta). Böylece rapor
// istendiği an güncel çıkar ama elle yazılanlar kaybolmaz.
import React, { useEffect, useMemo, useState } from 'react';
import { Kpi, ActionItem, MultiYearKpiData } from '../types';
import { yggBolumleri, yggAnahtar, YggNotlar } from '../utils/ygg';
import { cloudFetchMeta, cloudSaveMeta } from '../utils/cloudSync';
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
    const [notlar, setNotlar] = useState<YggNotlar>({});
    const [durum, setDurum] = useState<'yukleniyor' | 'hazir' | 'kaydediliyor' | 'kaydedildi' | 'hata'>('yukleniyor');
    const [hata, setHata] = useState('');
    const [katilanlar, setKatilanlar] = useState('');
    const [tarih, setTarih] = useState('');

    const anahtar = yggAnahtar(lokasyon, yil);
    const bolumler = useMemo(
        () => yggBolumleri(lokasyon, yil, kpis, aksiyonlar, multiYearData),
        [lokasyon, yil, kpis, aksiyonlar, multiYearData]);

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
                setNotlar(o.notlar || {});
                setKatilanlar(o.katilanlar || '');
                setTarih(o.tarih || '');
                setDurum('hazir');
            })
            .catch(e => {
                if (iptal) return;
                setHata(String(e?.message || e));
                setDurum('hata');
            });
        return () => { iptal = true; };
    }, [isOpen, anahtar]);

    const kaydet = async () => {
        setDurum('kaydediliyor'); setHata('');
        try {
            await cloudSaveMeta(anahtar, { notlar, katilanlar, tarih, guncelleme: new Date().toISOString() });
            setDurum('kaydedildi');
            setTimeout(() => setDurum('hazir'), 2000);
        } catch (e: any) {
            setHata(String(e?.message || e));
            setDurum('hata');
        }
    };

    const yazdir = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        const esc = (t: string) => String(t || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const govde = bolumler.map(b => `
            <h3>${esc(b.madde)} ${esc(b.baslik)}</h3>
            <ul>${b.otomatik.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
            ${notlar[b.id] ? `<p class="not">${esc(notlar[b.id]).replace(/\n/g, '<br>')}</p>` : ''}`).join('');
        w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8">
            <title>YGG ${esc(lokasyon)} ${yil}</title><style>
            body{font-family:Segoe UI,Arial,sans-serif;font-size:12pt;color:#111;margin:26px;line-height:1.5}
            h1{font-size:16pt;margin:0 0 4px} h2{font-size:12pt;color:#444;margin:0 0 18px;font-weight:normal}
            h3{font-size:11.5pt;margin:16px 0 4px;border-bottom:1px solid #ccc;padding-bottom:3px}
            ul{margin:4px 0 4px 18px;padding:0} li{margin:2px 0}
            .not{background:#f7f7f7;border-left:3px solid #888;padding:6px 10px;margin:6px 0;white-space:pre-wrap}
            .ust{margin-bottom:14px;font-size:10.5pt;color:#333}
            @media print{body{margin:12mm}}
            </style></head><body>
            <h1>${yil} YILI YÖNETİMİN GÖZDEN GEÇİRMESİ TOPLANTISI (YGG)</h1>
            <h2>Lokasyon: ${esc(lokasyon)}</h2>
            <div class="ust"><b>Toplantı tarihi/saati:</b> ${esc(tarih) || '—'}<br>
            <b>Katılanlar:</b> ${esc(katilanlar) || '—'}</div>
            ${govde}
            <p style="margin-top:22px;font-size:9.5pt;color:#666">
            Otomatik bölümler KPI Takip uygulamasındaki ${esc(lokasyon)} / ${yil} verisinden
            ${new Date().toLocaleString('tr-TR')} tarihinde üretilmiştir.</p>
            </body></html>`);
        w.document.close();
        w.focus();
    };

    const alan = 'w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded '
        + 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="6xl"
            title={`YGG — ${lokasyon} / ${yil}`}
            footer={
                <div className="flex items-center gap-3 justify-end w-full">
                    <span className="text-xs mr-auto">
                        {durum === 'yukleniyor' && 'Notlar yükleniyor…'}
                        {durum === 'kaydediliyor' && 'Kaydediliyor…'}
                        {durum === 'kaydedildi' && <span className="text-green-600">✓ Kaydedildi</span>}
                        {durum === 'hata' && <span className="text-red-600">Hata: {hata}</span>}
                    </span>
                    <button onClick={yazdir}
                        className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                        🖨️ Yazdır / PDF
                    </button>
                    <button onClick={kaydet} disabled={durum === 'yukleniyor' || durum === 'kaydediliyor'}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                        Notları kaydet
                    </button>
                </div>
            }>
            <div className="text-sm">
                {durum === 'hata' && (
                    <div className="mb-3 p-3 rounded bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                        Notlar okunamadı: {hata}. <b>Kaydetmeyin</b> — kaydederseniz eski notların
                        üzerine boş metin yazılır. Bağlantıyı kontrol edip yeniden açın.
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
                        Bu rapor <b>yalnızca {lokasyon}</b> lokasyonuna aittir. Başka lokasyon için
                        üstteki lokasyon seçicisini değiştirip yeniden açın — notlar her lokasyon ve
                        yıl için ayrı saklanır.
                    </p>
                </div>

                {bolumler.map(b => (
                    <div key={b.id} className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 font-semibold">
                            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{b.madde}</span>
                            {b.baslik}
                        </div>
                        <div className="px-3 py-2">
                            <ul className="list-disc ml-5 text-gray-800 dark:text-gray-200">
                                {b.otomatik.map((x, i) => <li key={i} className="my-0.5">{x}</li>)}
                            </ul>
                            <textarea className={alan + ' mt-2'} rows={2} value={notlar[b.id] || ''}
                                placeholder={b.ipucu}
                                onChange={e => setNotlar(n => ({ ...n, [b.id]: e.target.value }))} />
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
};

export default YggModal;
