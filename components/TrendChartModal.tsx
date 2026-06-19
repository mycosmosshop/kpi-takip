import React, { useState, useMemo } from 'react';
import { Kpi, Status } from '../types';
import { AYLAR } from '../constants';
import { getSingleMonthStatus, isMonthActive } from '../utils/calculations';
import Modal from './Modal';

interface TrendChartModalProps {
    isOpen: boolean;
    onClose: () => void;
    kpis: Kpi[];
    initialKpiId?: string;
}

const STATUS_COLOR: Record<string, string> = {
    basarili: '#22c55e', marjinal: '#eab308', basarisiz: '#ef4444', 'n/a': '#cbd5e1',
};
const opSym = (c: string) => (c === '>' ? '≥' : c === '<' ? '≤' : '=');

const TrendChartModal: React.FC<TrendChartModalProps> = ({ isOpen, onClose, kpis, initialKpiId }) => {
    const [selectedId, setSelectedId] = useState<string>(initialKpiId || (kpis[0]?.id ?? ''));
    const kpi = useMemo(() => kpis.find(k => k.id === selectedId) || kpis[0], [kpis, selectedId]);

    if (!kpi) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Aylık Trend Grafiği" size="2xl">
                <p className="text-gray-500 dark:text-gray-400">Gösterilecek KPI bulunamadı.</p>
            </Modal>
        );
    }

    const values = AYLAR.map(ay => kpi.aylik[ay]);
    const target = kpi.yeni_yil_hedef;
    const numeric = values.filter((v): v is number => v !== null && v !== undefined);
    const dataMax = Math.max(target, ...(numeric.length ? numeric : [0]));
    const dataMin = Math.min(0, target, ...(numeric.length ? numeric : [0]));
    const maxY = dataMax === dataMin ? dataMax + 1 : dataMax + (dataMax - dataMin) * 0.15;
    const minY = dataMin < 0 ? dataMin - Math.abs(dataMin) * 0.1 : 0;

    // SVG geometri
    const W = 820, H = 420, mL = 56, mR = 20, mT = 24, mB = 56;
    const plotW = W - mL - mR;
    const plotH = H - mT - mB;
    const yToPx = (v: number) => mT + plotH - ((v - minY) / (maxY - minY)) * plotH;
    const bandW = plotW / AYLAR.length;
    const barW = bandW * 0.6;
    const targetY = yToPx(target);

    const ticks = 5;
    const tickVals = Array.from({ length: ticks + 1 }, (_, i) => minY + (i * (maxY - minY)) / ticks);
    const fmt = (n: number) => {
        const abs = Math.abs(n);
        if (abs >= 1000) return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
        return n.toLocaleString('tr-TR', { maximumFractionDigits: abs < 1 ? 4 : 2 });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Aylık Trend Grafiği" size="5xl">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">KPI:</label>
                    <select
                        value={kpi.id}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="flex-1 min-w-[260px] px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"
                    >
                        {kpis.map(k => (
                            <option key={k.id} value={k.id}>{k.proses} — {k.kpi_adi}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span><strong>Hedef:</strong> {opSym(kpi.karsilastirma)} {fmt(target)} {kpi.birim}</span>
                    <span><strong>Ortalama:</strong> {kpi.ortalama ?? 'N/A'} {kpi.birim}</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.basarili }} /> Başarılı</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.marjinal }} /> Marjinal</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.basarisiz }} /> Başarısız</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: '#dc2626' }} /> Hedef</span>
                </div>

                <div className="w-full overflow-x-auto bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 640 }}>
                        {/* Y ekseni ızgara + etiket */}
                        {tickVals.map((tv, i) => {
                            const y = yToPx(tv);
                            return (
                                <g key={i}>
                                    <line x1={mL} y1={y} x2={W - mR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                                    <text x={mL - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#6b7280">{fmt(tv)}</text>
                                </g>
                            );
                        })}
                        {/* Eksen çizgisi */}
                        <line x1={mL} y1={mT} x2={mL} y2={mT + plotH} stroke="#9ca3af" strokeWidth={1} />
                        <line x1={mL} y1={mT + plotH} x2={W - mR} y2={mT + plotH} stroke="#9ca3af" strokeWidth={1} />

                        {/* Çubuklar */}
                        {AYLAR.map((ay, i) => {
                            const v = values[i];
                            const aktif = isMonthActive(kpi, i);
                            const cx = mL + i * bandW + bandW / 2;
                            const labelY = mT + plotH + 16;
                            if (v === null || v === undefined) {
                                return (
                                    <g key={ay}>
                                        <text x={cx} y={labelY} textAnchor="middle" fontSize={11} fill={aktif ? '#9ca3af' : '#d1d5db'}>{ay.slice(0, 3)}</text>
                                    </g>
                                );
                            }
                            const st = getSingleMonthStatus(kpi, v) as Status;
                            const yv = yToPx(v);
                            const y0 = yToPx(Math.max(minY, 0));
                            const top = Math.min(yv, y0);
                            const hgt = Math.max(2, Math.abs(yv - y0));
                            return (
                                <g key={ay}>
                                    <rect x={cx - barW / 2} y={top} width={barW} height={hgt} rx={2} fill={STATUS_COLOR[st]} opacity={0.92} />
                                    <text x={cx} y={top - 5} textAnchor="middle" fontSize={10} fill="#374151" fontWeight="600">{fmt(v)}</text>
                                    <text x={cx} y={labelY} textAnchor="middle" fontSize={11} fill="#6b7280">{ay.slice(0, 3)}</text>
                                </g>
                            );
                        })}

                        {/* Hedef çizgisi */}
                        <line x1={mL} y1={targetY} x2={W - mR} y2={targetY} stroke="#dc2626" strokeWidth={2} strokeDasharray="6 4" />
                        <text x={W - mR} y={targetY - 5} textAnchor="end" fontSize={11} fill="#dc2626" fontWeight="700">Hedef {fmt(target)}</text>
                    </svg>
                </div>
            </div>
        </Modal>
    );
};

export default TrendChartModal;
