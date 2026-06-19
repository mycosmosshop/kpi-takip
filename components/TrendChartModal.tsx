import React, { useState, useMemo } from 'react';
import { Kpi, Status, MultiYearKpiData } from '../types';
import { AYLAR } from '../constants';
import { getSingleMonthStatus, isMonthActive, calculateAverage } from '../utils/calculations';
import Modal from './Modal';

interface TrendChartModalProps {
    isOpen: boolean;
    onClose: () => void;
    kpis: Kpi[];                       // seçili yılın işlenmiş KPI'ları
    multiYearData: MultiYearKpiData;   // bu lokasyonun tüm yılları (yıllık trend için)
    initialKpiId?: string;
}

const STATUS_COLOR: Record<string, string> = {
    basarili: '#22c55e', marjinal: '#eab308', basarisiz: '#ef4444', 'n/a': '#cbd5e1',
};
const opSym = (c: string) => (c === '>' ? '≥' : c === '<' ? '≤' : '=');

const fmt = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    return n.toLocaleString('tr-TR', { maximumFractionDigits: abs < 1 ? 4 : 2 });
};

type Bar = { label: string; value: number | null; status: Status };

// Ortak çubuk grafik (SVG) — hedef çizgili
const BarChart: React.FC<{ bars: Bar[]; target: number; unit: string }> = ({ bars, target, unit }) => {
    const nums = bars.map(b => b.value).filter((v): v is number => v !== null && v !== undefined);
    const dataMax = Math.max(target, ...(nums.length ? nums : [0]));
    const dataMin = Math.min(0, target, ...(nums.length ? nums : [0]));
    const maxY = dataMax === dataMin ? dataMax + 1 : dataMax + (dataMax - dataMin) * 0.15;
    const minY = dataMin < 0 ? dataMin - Math.abs(dataMin) * 0.1 : 0;

    const W = 820, H = 400, mL = 56, mR = 20, mT = 24, mB = 56;
    const plotW = W - mL - mR, plotH = H - mT - mB;
    const yToPx = (v: number) => mT + plotH - ((v - minY) / (maxY - minY)) * plotH;
    const bandW = plotW / Math.max(bars.length, 1);
    const barW = Math.min(bandW * 0.6, 70);
    const targetY = yToPx(target);
    const ticks = 5;
    const tickVals = Array.from({ length: ticks + 1 }, (_, i) => minY + (i * (maxY - minY)) / ticks);

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 560 }}>
            {tickVals.map((tv, i) => {
                const y = yToPx(tv);
                return (
                    <g key={i}>
                        <line x1={mL} y1={y} x2={W - mR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                        <text x={mL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#9ca3af">{fmt(tv)}</text>
                    </g>
                );
            })}
            <line x1={mL} y1={mT} x2={mL} y2={mT + plotH} stroke="#9ca3af" strokeWidth={1} />
            <line x1={mL} y1={mT + plotH} x2={W - mR} y2={mT + plotH} stroke="#9ca3af" strokeWidth={1} />
            {bars.map((b, i) => {
                const cx = mL + i * bandW + bandW / 2;
                const labelY = mT + plotH + 16;
                if (b.value === null || b.value === undefined) {
                    return <text key={i} x={cx} y={labelY} textAnchor="middle" fontSize={11} fill="#9ca3af">{b.label}</text>;
                }
                const yv = yToPx(b.value);
                const y0 = yToPx(Math.max(minY, 0));
                const top = Math.min(yv, y0);
                const hgt = Math.max(2, Math.abs(yv - y0));
                return (
                    <g key={i}>
                        <rect x={cx - barW / 2} y={top} width={barW} height={hgt} rx={3} fill={STATUS_COLOR[b.status]} opacity={0.92} />
                        <text x={cx} y={top - 5} textAnchor="middle" fontSize={10} fill="#6b7280" fontWeight="600">{fmt(b.value)}</text>
                        <text x={cx} y={labelY} textAnchor="middle" fontSize={11} fill="#6b7280">{b.label}</text>
                    </g>
                );
            })}
            <line x1={mL} y1={targetY} x2={W - mR} y2={targetY} stroke="#dc2626" strokeWidth={2} strokeDasharray="6 4" />
            <text x={W - mR} y={targetY - 5} textAnchor="end" fontSize={11} fill="#dc2626" fontWeight="700">Hedef {fmt(target)}{unit ? ' ' + unit : ''}</text>
        </svg>
    );
};

const TrendChartModal: React.FC<TrendChartModalProps> = ({ isOpen, onClose, kpis, multiYearData, initialKpiId }) => {
    const [selectedId, setSelectedId] = useState<string>(initialKpiId || (kpis[0]?.id ?? ''));
    const [mode, setMode] = useState<'aylik' | 'yillik'>('aylik');
    const kpi = useMemo(() => kpis.find(k => k.id === selectedId) || kpis[0], [kpis, selectedId]);

    const monthlyBars: Bar[] = useMemo(() => {
        if (!kpi) return [];
        return AYLAR.map((ay, i) => {
            const v = (kpi.aylik[ay] !== undefined && isMonthActive(kpi, i)) ? kpi.aylik[ay] : (kpi.aylik[ay] ?? null);
            return { label: ay.slice(0, 3), value: v ?? null, status: getSingleMonthStatus(kpi, v ?? null) as Status };
        });
    }, [kpi]);

    // Yıllık: aynı KPI'yı (proses + ad) tüm yıllar boyunca ortalamasıyla karşılaştır
    const yearlyBars: Bar[] = useMemo(() => {
        if (!kpi) return [];
        const years = Object.keys(multiYearData).map(Number).filter(y => !isNaN(y) && y > 0).sort((a, b) => a - b);
        return years.map(y => {
            const yd = multiYearData[y];
            const match = yd?.kpis?.find(k => k.proses === kpi.proses && k.kpi_adi === kpi.kpi_adi);
            const avg = match ? calculateAverage(match) : null;
            return { label: String(y), value: avg, status: getSingleMonthStatus(kpi, avg) as Status };
        });
    }, [multiYearData, kpi]);

    if (!kpi) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Trend Grafiği" size="2xl">
                <p className="text-gray-500 dark:text-gray-400">Gösterilecek KPI bulunamadı.</p>
            </Modal>
        );
    }

    const bars = mode === 'aylik' ? monthlyBars : yearlyBars;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Trend Grafiği" size="5xl">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
                        <button onClick={() => setMode('aylik')} className={`px-3 py-1.5 font-medium ${mode === 'aylik' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Aylık</button>
                        <button onClick={() => setMode('yillik')} className={`px-3 py-1.5 font-medium ${mode === 'yillik' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Yıllık (yıllar arası)</button>
                    </div>
                    <select
                        value={kpi.id}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="flex-1 min-w-[260px] px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"
                    >
                        {kpis.map(k => <option key={k.id} value={k.id}>{k.proses} — {k.kpi_adi}</option>)}
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span><strong>Hedef:</strong> {opSym(kpi.karsilastirma)} {fmt(kpi.yeni_yil_hedef)} {kpi.birim}</span>
                    <span><strong>{mode === 'aylik' ? 'Ortalama' : 'Bu yıl ort.'}:</strong> {kpi.ortalama ?? 'N/A'} {kpi.birim}</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.basarili }} /> Başarılı</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.marjinal }} /> Marjinal</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.basarisiz }} /> Başarısız</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: '#dc2626' }} /> Hedef</span>
                </div>

                <div className="w-full overflow-x-auto bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                    <BarChart bars={bars} target={kpi.yeni_yil_hedef} unit={kpi.birim} />
                </div>
                <p className="text-xs text-gray-400">
                    {mode === 'aylik'
                        ? 'Seçilen KPI\'nın bu yıla ait aylık değerleri (durum renkli) + hedef çizgisi.'
                        : 'Aynı KPI\'nın (proses + ad) yıllar arası gerçekleşen ortalamaları — yıllar arası karşılaştırma + hedef çizgisi.'}
                </p>
            </div>
        </Modal>
    );
};

export default TrendChartModal;
