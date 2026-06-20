import React, { useState, useEffect } from 'react';
import { Kpi, KpiSource } from '../types';
import Modal from './Modal';
import { fetchCmmsLocations, CmmsMetric } from '../utils/cmmsSource';

interface KpiSourceModalProps {
    isOpen: boolean;
    onClose: () => void;
    kpi: Kpi | null;
    defaultLocation: string;
    year: number;
    onPull: (kpiId: string, source: KpiSource) => Promise<void>;
    onClear: (kpiId: string) => void;
}

const guessMetric = (kpi: Kpi | null): CmmsMetric => {
    const t = (kpi?.kpi_adi || '').toLowerCase();
    if (t.includes('mtbf')) return 'mtbf';
    if (t.includes('mttr')) return 'mttr';
    if (t.includes('mttf')) return 'mttf';
    if (t.includes('kullanılab') || t.includes('availab')) return 'availability';
    if (t.includes('plansız') || t.includes('plansiz')) return 'unplanned';
    if (t.includes('uyum') || t.includes('pmc')) return 'pmc';
    if (t.includes('planlı bakım oran') || t.includes('pmr')) return 'pmr';
    return 'mtbf';
};

const KpiSourceModal: React.FC<KpiSourceModalProps> = ({ isOpen, onClose, kpi, defaultLocation, year, onPull, onClear }) => {
    const [metric, setMetric] = useState<CmmsMetric>('mtbf');
    const [location, setLocation] = useState('');
    const [formula, setFormula] = useState('');
    const [busy, setBusy] = useState(false);
    const [cmmsLocs, setCmmsLocs] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen || !kpi) return;
        setMetric(kpi.kaynak?.metric || guessMetric(kpi));
        setLocation(kpi.kaynak?.location || defaultLocation);
        setFormula(kpi.kaynak?.formula || '');
        fetchCmmsLocations().then(setCmmsLocs).catch(() => {});
    }, [isOpen, kpi, defaultLocation]);

    if (!kpi) return null;

    const doPull = async () => {
        setBusy(true);
        await onPull(kpi.id, { type: 'cmms', metric, location: location.trim() || undefined, formula: formula.trim() || undefined });
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
        <Modal isOpen={isOpen} onClose={onClose} title="Veri Kaynağı — Bakım Yönetim Sistemi (CMMS)" size="lg" footer={footer}>
            <div className="space-y-4">
                <div className="text-sm bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
                    <div className="font-semibold text-gray-800 dark:text-gray-100">{kpi.proses} — {kpi.kpi_adi}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Seçilen metrik bu yılın (12 ay) gerçekleşen değerlerini CMMS'ten çekip hücrelere yazar. Veri olmayan ay = NA (boş). Çektikten sonra hücreyi elle değiştirebilirsin.</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Metrik</label>
                        <select value={metric} onChange={e => setMetric(e.target.value as CmmsMetric)} className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                            <option value="mtbf">MTBF — Arızalar arası ort. süre (saat)</option>
                            <option value="mttr">MTTR — Ort. tamir süresi (saat)</option>
                            <option value="availability">Kullanılabilirlik (%)</option>
                            <option value="pmr">PMR — Planlı Bakım Oranı (%)</option>
                            <option value="pmc">PMC — Planlı Bakım Uyumu (%)</option>
                            <option value="unplanned">Plansız Bakım (%)</option>
                            <option value="mttf">MTTF — İlk arızaya kadar süre (saat)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">CMMS Lokasyonu</label>
                        <input list="cmmsLocs" value={location} onChange={e => setLocation(e.target.value)} placeholder={defaultLocation} className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                        <datalist id="cmmsLocs">{cmmsLocs.map(l => <option key={l} value={l} />)}</datalist>
                        <p className="text-[11px] text-gray-400 mt-1">CMMS'teki makine lokasyon adıyla eşleşmeli. {cmmsLocs.length > 0 && `Bulunanlar: ${cmmsLocs.join(', ')}`}</p>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Formül (opsiyonel)</label>
                    <input value={formula} onChange={e => setFormula(e.target.value)} placeholder="x  (örn: x/60 → saati dakikaya, x*1.0)" className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono" />
                    <p className="text-[11px] text-gray-400 mt-1"><strong>x</strong> = CMMS'ten çekilen değer. Boş bırakırsan değer olduğu gibi yazılır.</p>
                </div>
            </div>
        </Modal>
    );
};

export default KpiSourceModal;
