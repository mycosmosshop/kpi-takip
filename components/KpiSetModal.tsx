import React, { useEffect, useMemo, useState } from 'react';
import { Kpi, SourceMetric } from '../types';
import Modal from './Modal';
import { KALITE_METRIKLER } from './KpiSourceModal';
import { KALITE_KAPSAM } from '../utils/kaynakAciklama';
import { cloudFetchMeta, cloudSaveMeta } from '../utils/cloudSync';

// LeanSys / Mikro'dan otomatik çekilen KPI seti — tüm lokasyonlar için ortak (kpi_meta 'kpi_set_leansys').
// Lokasyon tablosuna "Ekle" ile LeanSys'e bağlı satır eklenir ve hemen doldurulur; "Tablodan çıkar" satırı siler.
export interface KpiSetKalem {
    id: string; proses: string; kpi_adi: string; birim: string;
    karsilastirma: '<' | '<=' | '>' | '>='; hedef: number | null; metric: SourceMetric; scope: string;
}

const k = (proses: string, kpi_adi: string, birim: string, karsilastirma: KpiSetKalem['karsilastirma'], metric: SourceMetric, scope = 'tum'): KpiSetKalem =>
    ({ id: `${metric}|${scope}`, proses, kpi_adi, birim, karsilastirma, hedef: null, metric, scope });

export const VARSAYILAN_SET: KpiSetKalem[] = [
    k('Kalite', 'Kalite Uygunsuzlukları Adedi (QI)', 'Adet', '<=', 'kalite_qi'),
    k('Kalite', 'Müşteri Şikayetleri Miktarı (LeanSys)', 'Adet', '<=', 'kalite_sikayet'),
    k('Kalite', 'İç PPM', 'ppm', '<=', 'kalite_ic_ppm'),
    k('Kalite', 'Ek Yeri Firesi PPM', 'ppm', '<=', 'kalite_fire_ppm'),
    k('Kalite', 'Toplam İade PPM', 'ppm', '<=', 'kalite_iade_ppm'),
    k('Kalite', 'Kalite Maliyeti (TL)', 'TL', '<=', 'kalite_maliyet'),
    k('Kalite', 'Kalite Maliyetlerinin Aylık Satışa Oranı', '%', '<=', 'kalite_oran'),
    k('Kalite', 'İç Başarısızlık Maliyeti (TL)', 'TL', '<=', 'kalite_maliyet_ic'),
    k('Kalite', 'Dış Başarısızlık Maliyeti (TL)', 'TL', '<=', 'kalite_maliyet_dis'),
    k('Kalite', 'İç Uygunsuzluk Adedi', 'Adet', '<=', 'kalite_ic_nc'),
    k('Satınalma Prosesi', 'Tedarikçi Uygunsuzluk Adedi', 'Adet', '<=', 'kalite_td_nc'),
    k('Üretim Prosesi', 'İç iade PPM', 'ppm', '<=', 'kalite_ic_ppm_uretim'),
    k('Paketleme Prosesi', 'İç iade PPM', 'ppm', '<=', 'kalite_ic_ppm_paket'),
    k('Üretim Prosesi', 'OEE (Toplam Ekipman Etkinliği)', '%', '>=', 'kalite_oee_uretim'),
    k('Paketleme Prosesi', 'OEE (Toplam Ekipman Etkinliği)', '%', '>=', 'kalite_oee_paket'),
    k('Planlama Prosesi', 'Terminlere Uygunluk', '%', '>=', 'plan_termin'),
    k('Planlama Prosesi', 'Ortalama Gecikme Gün Sayısı', 'Gün', '<=', 'plan_gecikme'),
    k('Yönetimin Sorumluluğu Prosesi', 'Ebidta', '%', '>=', 'finans_ebitda'),
    k('Kalite', 'QI — Vileda', 'Adet', '<=', 'kalite_qi', 'vileda'),
    k('Kalite', 'QI — Diğer (Vileda hariç)', 'Adet', '<=', 'kalite_qi', 'diger'),
    k('Kalite', 'İç PPM — Vileda', 'ppm', '<=', 'kalite_ic_ppm', 'vileda'),
    k('Kalite', 'İç PPM — Diğer (Vileda hariç)', 'ppm', '<=', 'kalite_ic_ppm', 'diger'),
    k('Kalite', 'İade PPM — Vileda', 'ppm', '<=', 'kalite_iade_ppm', 'vileda'),
    k('Kalite', 'İade PPM — Diğer (Vileda hariç)', 'ppm', '<=', 'kalite_iade_ppm', 'diger'),
    k('Kalite', 'İç PPM — Otomotiv', 'ppm', '<=', 'kalite_ic_ppm', 'otomotiv'),
    k('Kalite', 'İç PPM — Otomotiv dışı', 'ppm', '<=', 'kalite_ic_ppm', 'otomotiv_disi'),
    k('Kalite', 'İade PPM — Otomotiv', 'ppm', '<=', 'kalite_iade_ppm', 'otomotiv'),
    k('Kalite', 'İade PPM — Otomotiv dışı', 'ppm', '<=', 'kalite_iade_ppm', 'otomotiv_disi'),
];

export const SET_ANAHTARI = 'kpi_set_leansys';

// Satır sette hangi kaleme denk? (LeanSys'e bağlı, aynı metrik + kapsam)
export const setteMi = (kpi: Kpi, s: KpiSetKalem) =>
    kpi.kaynak?.type === 'kalite' && kpi.kaynak.metric === s.metric && (kpi.kaynak.scope || 'tum') === s.scope;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    kpis: Kpi[];
    lokasyon: string;
    yil: number;
    onEkle: (kalemler: KpiSetKalem[]) => Promise<void>;
    onCikar: (kpiId: string) => void;
}

const bos: Omit<KpiSetKalem, 'id'> = { proses: 'Kalite', kpi_adi: '', birim: 'ppm', karsilastirma: '<=', hedef: null, metric: 'kalite_qi', scope: 'tum' };

const KpiSetModal: React.FC<Props> = ({ isOpen, onClose, kpis, lokasyon, yil, onEkle, onCikar }) => {
    const [set, setSet] = useState<KpiSetKalem[]>(VARSAYILAN_SET);
    const [secili, setSecili] = useState<Set<string>>(new Set());
    const [yeni, setYeni] = useState(bos);
    const [mesgul, setMesgul] = useState(false);
    const [hata, setHata] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        cloudFetchMeta(SET_ANAHTARI).then(v => { if (Array.isArray(v) && v.length) setSet(v); }).catch(() => { /* varsayılan set */ });
        setSecili(new Set()); setHata('');
    }, [isOpen]);

    const kaydet = async (s: KpiSetKalem[]) => {
        setSet(s);
        try { await cloudSaveMeta(SET_ANAHTARI, s); } catch (e: any) { setHata(`Set kaydedilemedi: ${e?.message || e}`); }
    };

    const satirlar = useMemo(() => set.map(s => ({ s, kpi: kpis.find(kp => setteMi(kp, s)) })), [set, kpis]);
    const metrikAd = (m: string) => KALITE_METRIKLER.find(x => x.v === m)?.l.split(' (')[0].split(' — ')[0] || m;

    const ekle = async (kalemler: KpiSetKalem[]) => {
        if (!kalemler.length) return;
        setMesgul(true);
        try { await onEkle(kalemler); setSecili(new Set()); } finally { setMesgul(false); }
    };

    const yeniEkle = () => {
        if (!yeni.kpi_adi.trim()) { setHata('KPI adı boş olamaz.'); return; }
        const id = `${yeni.metric}|${yeni.scope}`;
        if (set.some(s => s.id === id)) { setHata('Bu metrik + kapsam zaten sette.'); return; }
        setHata(''); kaydet([...set, { ...yeni, kpi_adi: yeni.kpi_adi.trim(), id }]); setYeni(bos);
    };

    const eksikler = satirlar.filter(r => !r.kpi).map(r => r.s);
    const inp = 'px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`LeanSys KPI Seti — ${lokasyon} · ${yil}`} size="6xl"
            footer={<>
                <button onClick={onClose} className="px-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md">Kapat</button>
                <button disabled={mesgul || !secili.size} onClick={() => ekle(set.filter(s => secili.has(s.id)))}
                    className="px-4 py-2 mr-2 text-sm text-white bg-blue-600 rounded-md disabled:opacity-50">{mesgul ? 'Ekleniyor…' : `Seçilileri ekle (${secili.size})`}</button>
            </>}>
            <p className="text-xs text-gray-500 mb-3">
                LeanSys'ten (Mikro muhasebe dahil) otomatik çekilen göstergeler. Set tüm lokasyonlarda ortaktır. "Ekle" bu lokasyonun {yil} tablosuna
                kaynağa bağlı satır ekler ve hemen doldurur; kanıt Excel'i FR100 dışa aktarmada bu satırlarla birlikte iner. Kapsamı Vileda / Otomotiv
                olan satırlar yalnız o ürün grubunu sayar. EBITDA şimdilik yalnız Veliköy için hesaplanır.
            </p>
            {hata && <p className="text-sm text-red-600 mb-2">{hata}</p>}
            <div className="overflow-x-auto max-h-[55vh] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                        <tr className="text-left">
                            <th className="px-2 py-2 w-8"><input type="checkbox" checked={!!eksikler.length && eksikler.every(s => secili.has(s.id))}
                                onChange={e => setSecili(new Set(e.target.checked ? eksikler.map(s => s.id) : []))} title="Tablodaki olmayanların hepsini seç" /></th>
                            <th className="px-2 py-2">Proses</th><th className="px-2 py-2">KPI</th><th className="px-2 py-2">Metrik</th>
                            <th className="px-2 py-2">Kapsam</th><th className="px-2 py-2">Birim</th><th className="px-2 py-2">Bu tabloda</th><th className="px-2 py-2 text-right">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {satirlar.map(({ s, kpi }) => (
                            <tr key={s.id} className="border-t border-gray-100 dark:border-gray-700">
                                <td className="px-2 py-1">{!kpi && <input type="checkbox" checked={secili.has(s.id)}
                                    onChange={e => { const n = new Set(secili); e.target.checked ? n.add(s.id) : n.delete(s.id); setSecili(n); }} />}</td>
                                <td className="px-2 py-1 whitespace-nowrap">{s.proses}</td>
                                <td className="px-2 py-1">{s.kpi_adi}</td>
                                <td className="px-2 py-1 text-gray-500">{metrikAd(s.metric)}</td>
                                <td className="px-2 py-1 text-gray-500">{s.scope === 'tum' ? 'Tümü' : (KALITE_KAPSAM[s.scope] || s.scope).split(' (')[0]}</td>
                                <td className="px-2 py-1">{s.birim}</td>
                                <td className="px-2 py-1">{kpi ? <span className="text-green-700">✓ var</span> : <span className="text-gray-400">yok</span>}</td>
                                <td className="px-2 py-1 text-right whitespace-nowrap">
                                    {kpi
                                        ? <button onClick={() => onCikar(kpi.id)} className="px-2 py-0.5 text-xs text-red-700 border border-red-300 rounded">Tablodan çıkar</button>
                                        : <button disabled={mesgul} onClick={() => ekle([s])} className="px-2 py-0.5 text-xs text-white bg-blue-600 rounded disabled:opacity-50">Ekle</button>}
                                    <button onClick={() => { if (window.confirm(`"${s.kpi_adi}" setten silinsin mi? (Tablolardaki satırlar kalır.)`)) kaydet(set.filter(x => x.id !== s.id)); }}
                                        title="Setten sil (tüm lokasyonlar)" className="ml-2 px-2 py-0.5 text-xs text-gray-500 border border-gray-300 rounded">Setten sil</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded">
                <p className="text-sm font-medium mb-2">Sete yeni KPI ekle</p>
                <div className="flex flex-wrap gap-2 items-center">
                    <input className={inp} placeholder="Proses" value={yeni.proses} onChange={e => setYeni({ ...yeni, proses: e.target.value })} />
                    <input className={`${inp} w-64`} placeholder="KPI adı" value={yeni.kpi_adi} onChange={e => setYeni({ ...yeni, kpi_adi: e.target.value })} />
                    <select className={inp} value={yeni.metric} onChange={e => setYeni({ ...yeni, metric: e.target.value as SourceMetric })}>
                        {KALITE_METRIKLER.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                    </select>
                    <select className={inp} value={yeni.scope} onChange={e => setYeni({ ...yeni, scope: e.target.value })}>
                        {Object.entries(KALITE_KAPSAM).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input className={`${inp} w-20`} placeholder="Birim" value={yeni.birim} onChange={e => setYeni({ ...yeni, birim: e.target.value })} />
                    <select className={inp} value={yeni.karsilastirma} onChange={e => setYeni({ ...yeni, karsilastirma: e.target.value as KpiSetKalem['karsilastirma'] })}>
                        {['<=', '<', '>=', '>'].map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                    <input className={`${inp} w-24`} type="number" placeholder="Hedef" value={yeni.hedef ?? ''} onChange={e => setYeni({ ...yeni, hedef: e.target.value === '' ? null : Number(e.target.value) })} />
                    <button onClick={yeniEkle} className="px-3 py-1 text-sm text-white bg-green-600 rounded">Sete ekle</button>
                </div>
            </div>
        </Modal>
    );
};

export default KpiSetModal;
