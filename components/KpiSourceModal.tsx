import React, { useState, useEffect, useRef } from 'react';
import { Kpi, KpiSource, SourceType, SourceMetric } from '../types';
import Modal from './Modal';
import { fetchCmmsLocations } from '../utils/cmmsSource';
import { fetchEgitimLocations } from '../utils/egitimSource';

interface KpiSourceModalProps {
    isOpen: boolean;
    onClose: () => void;
    kpi: Kpi | null;
    defaultLocation: string;
    year: number;
    onPull: (kpiId: string, source: KpiSource) => Promise<void>;
    onClear: (kpiId: string) => void;
}

const METRICS: Record<SourceType, { v: SourceMetric; l: string }[]> = {
    cmms: [
        { v: 'mtbf', l: 'MTBF — Arızalar arası ort. süre (saat)' },
        { v: 'mttr', l: 'MTTR — Ort. tamir süresi (saat)' },
        { v: 'availability', l: 'Kullanılabilirlik (%)' },
        { v: 'pmr', l: 'PMR — Planlı Bakım Oranı (%)' },
        { v: 'pmc', l: 'PMC — Planlı Bakım Uyumu (%)' },
        { v: 'unplanned', l: 'Plansız Bakım (%)' },
        { v: 'mttf', l: 'MTTF — İlk arızaya kadar süre (saat)' },
    ],
    egitim: [
        { v: 'egitim_sure', l: 'Eğitim Süresi (adam·saat, gerçekleşen)' },
        { v: 'egitim_gerceklesme', l: 'Gerçekleşen / Planlanan Eğitim (%)' },
    ],
    tedarikci: [
        { v: 'iade_ppm', l: 'İade PPM (Σiade / Σsevk × 1.000.000)' },
        { v: 'td_puan', l: 'Tedarikçi Değerlendirme Puanı (ort.)' },
        { v: 'td_termin', l: 'Termin / Tamamlanma Puanı (ort.)' },
    ],
};

const SCOPES: { v: string; l: string }[] = [
    { v: 'tum', l: 'Tüm tedarikçiler (lokasyon)' },
    { v: 'onayli', l: 'Onaylı tedarikçiler (lokasyon)' },
    { v: 'otomotiv', l: 'Sadece Otomotiv (lokasyon)' },
    { v: 'onayli_otomotiv', l: 'Onaylı + Otomotiv (lokasyon)' },
];

const guess = (kpi: Kpi | null): { type: SourceType; metric: SourceMetric } => {
    const p = (kpi?.proses || '').toLowerCase();
    const t = (kpi?.kpi_adi || '').toLowerCase();
    // Tedarikçi değerlendirme KPI'ları (Satınalma prosesi)
    if (t.includes('tedarikçi değerlend') || t.includes('tedarikci degerlend') || (t.includes('iade') && t.includes('ppm')) || (p.includes('satınalma') || p.includes('satinalma'))) {
        if (t.includes('termin')) return { type: 'tedarikci', metric: 'td_termin' };
        if (t.includes('ppm') || t.includes('iade')) return { type: 'tedarikci', metric: 'iade_ppm' };
        return { type: 'tedarikci', metric: 'td_puan' };
    }
    if (p.includes('eğitim') || p.includes('egitim') || t.includes('eğitim') || t.includes('egitim')) {
        const metric: SourceMetric = (t.includes('süre') || t.includes('sure') || t.includes('saat')) ? 'egitim_sure' : 'egitim_gerceklesme';
        return { type: 'egitim', metric };
    }
    if (t.includes('mtbf')) return { type: 'cmms', metric: 'mtbf' };
    if (t.includes('mttr')) return { type: 'cmms', metric: 'mttr' };
    if (t.includes('mttf')) return { type: 'cmms', metric: 'mttf' };
    if (t.includes('kullanılab') || t.includes('availab')) return { type: 'cmms', metric: 'availability' };
    if (t.includes('plansız') || t.includes('plansiz')) return { type: 'cmms', metric: 'unplanned' };
    if (t.includes('uyum')) return { type: 'cmms', metric: 'pmc' };
    if (t.includes('planlı bakım oran') || t.includes('pmr')) return { type: 'cmms', metric: 'pmr' };
    return { type: 'cmms', metric: 'mtbf' };
};

const norm = (s: string) => (s || '').toLocaleUpperCase('tr').trim();

const KpiSourceModal: React.FC<KpiSourceModalProps> = ({ isOpen, onClose, kpi, defaultLocation, year, onPull, onClear }) => {
    const [type, setType] = useState<SourceType>('cmms');
    const [metric, setMetric] = useState<SourceMetric>('mtbf');
    const [location, setLocation] = useState('');
    const [formula, setFormula] = useState('');
    const formulaRef = useRef<HTMLInputElement>(null);
    const insertToken = (tok: string) => {
        const el = formulaRef.current;
        if (!el) { setFormula(f => f + tok); return; }
        const s = el.selectionStart ?? formula.length;
        const e = el.selectionEnd ?? formula.length;
        const next = formula.slice(0, s) + tok + formula.slice(e);
        setFormula(next);
        requestAnimationFrame(() => { el.focus(); const pos = s + tok.length; try { el.setSelectionRange(pos, pos); } catch { } });
    };
    const [busy, setBusy] = useState(false);
    const [locs, setLocs] = useState<string[]>([]);
    const [scope, setScope] = useState<string>('onayli');

    // Seçili kaynağın lokasyon listesini getir ve gerekiyorsa eşleşeni öner
    const loadLocs = (t: SourceType, currentLoc: string) => {
        if (t === 'tedarikci') {
            const ls = ['Çerkezköy', 'Veliköy', 'Ankara', 'Bursa', 'Adana', 'Eskişehir'];
            setLocs(ls);
            if (currentLoc && !ls.includes(currentLoc)) {
                const match = ls.find(l => norm(l).includes(norm(currentLoc)) || norm(currentLoc).includes(norm(l)));
                if (match) setLocation(match);
            }
            return;
        }
        const fn = t === 'egitim' ? fetchEgitimLocations : fetchCmmsLocations;
        fn().then(ls => {
            setLocs(ls);
            if (currentLoc && !ls.includes(currentLoc)) {
                const match = ls.find(l => norm(l).includes(norm(currentLoc)) || norm(currentLoc).includes(norm(l)));
                if (match) setLocation(match);
            }
        }).catch(() => {});
    };

    useEffect(() => {
        if (!isOpen || !kpi) return;
        const g = kpi.kaynak ? { type: kpi.kaynak.type, metric: kpi.kaynak.metric } : guess(kpi);
        setType(g.type);
        setMetric(g.metric);
        setScope(kpi.kaynak?.scope || 'onayli');
        const loc0 = kpi.kaynak?.location || defaultLocation;
        setLocation(loc0);
        setFormula(kpi.kaynak?.formula || '');
        loadLocs(g.type, loc0);
    }, [isOpen, kpi, defaultLocation]);

    if (!kpi) return null;

    const onTypeChange = (t: SourceType) => {
        setType(t);
        const m = METRICS[t][0].v;
        setMetric(m);
        loadLocs(t, location || defaultLocation);
    };

    const doPull = async () => {
        setBusy(true);
        await onPull(kpi.id, { type, metric, location: location.trim() || undefined, scope: type === 'tedarikci' ? scope : undefined, formula: formula.trim() || undefined });
        setBusy(false);
        onClose();
    };

    const footer = (
        <>
            <button type="button" onClick={doPull} disabled={busy} className="w-full sm:w-auto sm:ml-3 inline-flex justify-center rounded-lg px-4 py-2 bg-blue-600 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
                {busy ? 'Çekiliyor…' : `Çek ve Kaydet (${year})`}
            </button>
            <button type="button" onClick={onClose} className="mt-2 sm:mt-0 w-full sm:w-auto inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-500 px-4 py-2 bg-white dark:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500">Kapat</button>
            {kpi.kaynak && <button type="button" onClick={() => { onClear(kpi.id); onClose(); }} className="mt-2 sm:mt-0 sm:mr-auto w-full sm:w-auto inline-flex justify-center rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700">Bağlantıyı Kaldır</button>}
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Veri Kaynağı — Otomatik Çekme" size="lg" footer={footer}>
            <div className="space-y-4">
                <div className="text-sm bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
                    <div className="font-semibold text-gray-800 dark:text-gray-100">{kpi.proses} — {kpi.kpi_adi}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Seçilen metrik bu yılın (12 ay) değerlerini kaynaktan çekip hücrelere yazar. Veri olmayan ay = NA (boş). Çektikten sonra hücreyi elle değiştirebilirsin.</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Kaynak</label>
                        <select value={type} onChange={e => onTypeChange(e.target.value as SourceType)} className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                            <option value="cmms">Bakım Yönetim Sistemi (CMMS)</option>
                            <option value="egitim">Eğitim &amp; Polivalans</option>
                            <option value="tedarikci">Tedarikçi Değerlendirme</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Metrik</label>
                        <select value={metric} onChange={e => setMetric(e.target.value as SourceMetric)} className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                            {METRICS[type].map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Lokasyon ({type === 'egitim' ? 'Eğitim' : type === 'tedarikci' ? 'Teslim yeri' : 'CMMS'})</label>
                    <input list="srcLocs" value={location} onChange={e => setLocation(e.target.value)} placeholder={defaultLocation} className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                    <datalist id="srcLocs">{locs.map(l => <option key={l} value={l} />)}</datalist>
                    <p className="text-[11px] text-gray-400 mt-1">{type === 'tedarikci' ? 'Tedarikçinin mal verdiği (teslim) lokasyon. Boş = tüm lokasyonlar.' : <>Kaynaktaki lokasyon adıyla birebir eşleşmeli. {locs.length > 0 && `Bulunanlar: ${locs.join(', ')}`}</>}</p>
                </div>

                {type === 'tedarikci' && (
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Kapsam (kimlerin ortalaması)</label>
                        <select value={scope} onChange={e => setScope(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                            {SCOPES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                        </select>
                        <p className="text-[11px] text-gray-400 mt-1">Seçilen lokasyon + kapsam + yıl ({year}) için aya göre hesaplanır (supplier_monthly + kategori/durum). Ay boşsa NA.</p>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Formül (opsiyonel)</label>
                    <div className="flex flex-wrap items-center gap-1 mb-1">
                        <button type="button" onClick={() => insertToken('x')} className="px-2.5 py-1 text-xs font-bold rounded bg-blue-600 text-white hover:bg-blue-700" title="Çekilen değeri ekle">x = değer</button>
                        {['+', '-', '*', '/', '(', ')'].map(op => (
                            <button key={op} type="button" onClick={() => insertToken(op)} className="px-2 py-1 text-xs font-mono rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">{op}</button>
                        ))}
                        <button type="button" onClick={() => setFormula('')} className="px-2 py-1 text-xs rounded text-red-600 hover:text-red-700" title="Formülü temizle">Temizle</button>
                    </div>
                    <input ref={formulaRef} value={formula} onChange={e => setFormula(e.target.value)} placeholder="x  (örn: x/60, x*1.0)" className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono" />
                    <p className="text-[11px] text-gray-400 mt-1"><strong>x</strong> = kaynaktan çekilen değer. "<strong>x = değer</strong>" butonuyla ekle. Boş bırakırsan değer olduğu gibi yazılır.</p>
                </div>
            </div>
        </Modal>
    );
};

export default KpiSourceModal;
