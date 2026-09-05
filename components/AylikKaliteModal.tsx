// Aylık Kalite Raporu — lokasyon bazlı, satırlar eklenip çıkarılabilir.
// Otomatik sütun ERP verisinden (uygunsuzluk_records) ve KPI tablosundan
// gelir; Özet Açıklama ve Aksiyon kullanıcınındır, lokasyon+ay anahtarıyla
// buluta yazılır.
import React, { useEffect, useMemo, useState } from 'react';
import { Kpi } from '../types';
import {
    UygKayit, uygunsuzluklariCek, ilkN, sayimlar, aylikKaliteAnahtar, RaporSatir,
} from '../utils/aylikKalite';
import { cloudFetchMeta, cloudSaveMeta } from '../utils/cloudSync';
import { AYLAR } from '../constants';
import Modal from './Modal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    kpis: Kpi[];
    lokasyon: string;
    yil: number;
}

const sayi = (n: number | null | undefined): string =>
    (n === null || n === undefined || isNaN(Number(n))) ? '—'
        : Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 2 });

// KPI'nın seçili aydaki değeri + önceki ay (trend). PPM burada yeniden
// HESAPLANMAZ; KPI tablosundaki doğrulanmış değer okunur.
const kpiAy = (kpis: Kpi[], desen: RegExp, ay: number): string => {
    const k = kpis.find(x => desen.test(x.kpi_adi || ''));
    if (!k) return 'İlgili KPI tanımlı değil.';
    const bu = k.aylik[AYLAR[ay - 1]];
    const onc = ay > 1 ? k.aylik[AYLAR[ay - 2]] : null;
    if (bu === null || bu === undefined) return `${k.kpi_adi}: bu ay için değer girilmemiş.`;
    const fark = (onc !== null && onc !== undefined) ? Number(bu) - Number(onc) : null;
    return `${k.kpi_adi}: ${sayi(bu)} ${k.birim} (hedef ${sayi(k.yeni_yil_hedef)})`
        + (fark === null ? ' · önceki ay kaydı yok'
            : ` · önceki ay ${sayi(onc)} → ${fark === 0 ? 'değişmedi' : (fark > 0 ? '▲ +' : '▼ ') + sayi(fark)}`);
};

const AylikKaliteModal: React.FC<Props> = ({ isOpen, onClose, kpis, lokasyon, yil }) => {
    const [ay, setAy] = useState(new Date().getMonth() + 1);
    const [kayitlar, setKayitlar] = useState<UygKayit[] | null>(null);
    const [satirlar, setSatirlar] = useState<RaporSatir[]>([]);
    const [durum, setDurum] = useState<'yukleniyor' | 'hazir' | 'kaydediliyor' | 'kaydedildi' | 'hata'>('yukleniyor');
    const [hata, setHata] = useState('');

    const anahtar = aylikKaliteAnahtar(lokasyon, yil, ay);

    // ERP kayıtları (yıl bazında bir kez)
    useEffect(() => {
        if (!isOpen) return;
        let iptal = false;
        uygunsuzluklariCek(yil)
            .then(d => { if (!iptal) setKayitlar(d); })
            .catch(e => { if (!iptal) { setKayitlar([]); setHata('ERP uygunsuzluk verisi okunamadı: ' + (e?.message || e)); } });
        return () => { iptal = true; };
    }, [isOpen, yil]);

    const oto = useMemo(() => {
        if (!kayitlar) return null;
        const s = sayimlar(kayitlar, lokasyon, yil, ay);
        const trend = (r: { ad: string; adet: number; miktar: number; oncekiMiktar: number | null }) =>
            `${r.ad} — ${sayi(r.miktar)} adet hatalı / ${r.adet} kayıt`
            + (r.oncekiMiktar === null ? ' (önceki ay kaydı yok)'
                : ` (önceki ay ${sayi(r.oncekiMiktar)}${r.miktar > r.oncekiMiktar ? ' ▲' : r.miktar < r.oncekiMiktar ? ' ▼' : ' =' })`);
        const musteri3 = ilkN(kayitlar, lokasyon, yil, ay, 'dis', 'cariAdi');
        const urun3 = ilkN(kayitlar, lokasyon, yil, ay, 'ic', 'stokAdi');
        return {
            musteriPpm: kpiAy(kpis, /iade\s*ppm|toplam iade/i, ay),
            musteri3: musteri3.length ? musteri3.map(trend).join(' | ') : 'Bu ay dış başarısızlık kaydı yok.',
            icPpm: kpiAy(kpis, /iç\s*ppm|ic\s*ppm|hurda/i, ay),
            urun3: urun3.length ? urun3.map(trend).join(' | ') : 'Bu ay iç başarısızlık kaydı yok.',
            musteriDof: s.dis === 0 ? 'Bu ay müşteri kaynaklı uygunsuzluk kaydı yok.'
                : `${s.dis} kayıt, ${sayi(s.disMiktar)} adet. Şikayet açan müşteriler: ${s.musteriler.join(', ')}`,
            tedarikciDof: s.ted === 0 ? 'Bu ay tedarikçi kaynaklı uygunsuzluk kaydı yok.'
                : `${s.ted} kayıt, ${sayi(s.tedMiktar)} adet. Tedarikçiler: ${s.tedarikciler.slice(0, 12).join(', ')}`
                    + (s.tedarikciler.length > 12 ? ` … (+${s.tedarikciler.length - 12})` : ''),
        };
    }, [kayitlar, kpis, lokasyon, yil, ay]);

    const varsayilan = (): RaporSatir[] => ([
        { id: 'musteri_ppm', kriter: 'Müşteri İade PPM', otomatik: '', ozet: '', aksiyon: '', silinebilir: false },
        { id: 'musteri_ilk3', kriter: 'İade PPM ilk 3 Müşteri (önceki aya ait trend)', otomatik: '', ozet: '', aksiyon: '', silinebilir: false },
        { id: 'ic_ppm', kriter: 'İç Hurda PPM', otomatik: '', ozet: '', aksiyon: '', silinebilir: false },
        { id: 'ic_ilk3', kriter: 'İç Hurda PPM ilk 3 ürün (önceki aya ait trend)', otomatik: '', ozet: '', aksiyon: '', silinebilir: false },
        { id: 'musteri_dof', kriter: 'Müşteri DÖF / Şikayet Sayısı (şikayet açan müşteriler)', otomatik: '', ozet: '', aksiyon: '', silinebilir: false },
        { id: 'tedarikci_dof', kriter: 'Tedarikçi DÖF / şikayet', otomatik: '', ozet: '', aksiyon: '', silinebilir: false },
        { id: 'diger', kriter: 'Diğer Konu(lar) (altyapı eksikleri, denetim konuları, müşteri ziyaretleri, iç testler, dış lab sonuçları vb…)', otomatik: '', ozet: '', aksiyon: '', silinebilir: false },
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
                if (!kayitli) { setSatirlar(varsayilan()); setDurum('hazir'); return; }
                // Sabit kriterler kaybolmasın: kayıtta yoksa geri eklenir.
                const varOlan = new Set(kayitli.map(x => x.id));
                setSatirlar([...kayitli, ...varsayilan().filter(x => !varOlan.has(x.id))]);
                setDurum('hazir');
            })
            .catch(e => { if (!iptal) { setHata(String(e?.message || e)); setDurum('hata'); } });
        return () => { iptal = true; };
    }, [isOpen, anahtar]);

    const kaydet = async () => {
        setDurum('kaydediliyor'); setHata('');
        try {
            // Otomatik metin KAYDEDILMEZ: her açılışta canlı veriden üretilir,
            // yoksa rapor eski sayıları kalıcı olarak taşırdı.
            await cloudSaveMeta(anahtar, {
                satirlar: satirlar.map(s => ({ ...s, otomatik: '' })),
                guncelleme: new Date().toISOString(),
            });
            setDurum('kaydedildi'); setTimeout(() => setDurum('hazir'), 2000);
        } catch (e: any) { setHata(String(e?.message || e)); setDurum('hata'); }
    };

    const otoMetin = (id: string): string => {
        if (!oto) return 'ERP verisi yükleniyor…';
        switch (id) {
            case 'musteri_ppm': return oto.musteriPpm;
            case 'musteri_ilk3': return oto.musteri3;
            case 'ic_ppm': return oto.icPpm;
            case 'ic_ilk3': return oto.urun3;
            case 'musteri_dof': return oto.musteriDof;
            case 'tedarikci_dof': return oto.tedarikciDof;
            default: return '';
        }
    };

    const guncelle = (id: string, alan: 'ozet' | 'aksiyon' | 'kriter', v: string) =>
        setSatirlar(s => s.map(x => x.id === id ? { ...x, [alan]: v } : x));

    const satirEkle = () => setSatirlar(s => [...s, {
        id: 'ek_' + Date.now(), kriter: '', otomatik: '', ozet: '', aksiyon: '', silinebilir: true,
    }]);

    const yazdir = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        const esc = (t: string) => String(t || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const tr = satirlar.map(s => `<tr>
            <td class="k">${esc(s.kriter)}${otoMetin(s.id) ? `<div class="oto">${esc(otoMetin(s.id))}</div>` : ''}</td>
            <td>${esc(s.ozet).replace(/\n/g, '<br>')}</td>
            <td>${esc(s.aksiyon).replace(/\n/g, '<br>')}</td></tr>`).join('');
        w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8">
            <title>Aylık Kalite Raporu — ${esc(lokasyon)} ${AYLAR[ay - 1]} ${yil}</title><style>
            body{font-family:Segoe UI,Arial,sans-serif;font-size:11pt;color:#111;margin:22px}
            h1{font-size:15pt;margin:0 0 3px} h2{font-size:11pt;color:#444;font-weight:normal;margin:0 0 14px}
            table{border-collapse:collapse;width:100%} th,td{border:1px solid #999;padding:6px 8px;vertical-align:top}
            th{background:#f0f0f0;text-align:left} td.k{width:38%} td:not(.k){width:31%}
            .oto{margin-top:4px;font-size:9.5pt;color:#444;background:#f7f7f7;padding:4px 6px;border-left:3px solid #999}
            @media print{body{margin:10mm}}
            </style></head><body>
            <h1>AYLIK KALİTE RAPORU</h1>
            <h2>${esc(lokasyon)} — ${AYLAR[ay - 1]} ${yil}</h2>
            <table><thead><tr><th>Kriter</th><th>Özet Açıklama</th><th>Aksiyon</th></tr></thead>
            <tbody>${tr}</tbody></table>
            <p style="margin-top:16px;font-size:9pt;color:#666">Gri kutulardaki özetler
            ${esc(lokasyon)} lokasyonunun ERP uygunsuzluk kayıtlarından ve KPI tablosundan
            ${new Date().toLocaleString('tr-TR')} tarihinde üretilmiştir.</p>
            </body></html>`);
        w.document.close(); w.focus();
    };

    const alan = 'w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded '
        + 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100';

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="7xl"
            title={`Aylık Kalite Raporu — ${lokasyon} / ${AYLAR[ay - 1]} ${yil}`}
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
                <div className="mb-3 flex flex-wrap gap-3 items-center">
                    <label className="text-xs">Ay
                        <select className={alan} value={ay} onChange={e => setAy(Number(e.target.value))}>
                            {AYLAR.map((a, i) => <option key={a} value={i + 1}>{a}</option>)}
                        </select>
                    </label>
                    <span className="text-xs text-gray-600 dark:text-gray-300 self-end pb-2">
                        Rapor <b>{lokasyon}</b> lokasyonuna aittir; her lokasyon ve ay ayrı saklanır.
                        Gri kutular ERP’den gelir, elle değiştirilmez.
                    </span>
                </div>

                <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700" style={{ maxHeight: '62vh' }}>
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold w-[38%]">Kriter</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold">Özet Açıklama</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold">Aksiyon</th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {satirlar.map(s => (
                                <tr key={s.id} className="border-b border-gray-200 dark:border-gray-700 align-top">
                                    <td className="px-3 py-2">
                                        {s.silinebilir
                                            ? <input className={alan} value={s.kriter} placeholder="Kriter"
                                                onChange={e => guncelle(s.id, 'kriter', e.target.value)} />
                                            : <div className="font-medium">{s.kriter}</div>}
                                        {otoMetin(s.id) && (
                                            <div className="mt-1 text-xs p-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                                {otoMetin(s.id)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-2 py-2">
                                        <textarea className={alan} rows={2} value={s.ozet}
                                            onChange={e => guncelle(s.id, 'ozet', e.target.value)} />
                                    </td>
                                    <td className="px-2 py-2">
                                        <textarea className={alan} rows={2} value={s.aksiyon}
                                            onChange={e => guncelle(s.id, 'aksiyon', e.target.value)} />
                                    </td>
                                    <td className="px-1 py-2 text-center">
                                        {s.silinebilir && (
                                            <button title="Satırı sil"
                                                onClick={() => setSatirlar(x => x.filter(y => y.id !== s.id))}
                                                className="text-red-600 hover:text-red-800">✕</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
};

export default AylikKaliteModal;
