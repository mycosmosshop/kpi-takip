
import React, { useMemo } from 'react';
import { Kpi, ModalType } from '../types';
import { AYLAR } from '../constants';
import { CloseIcon } from './icons';

interface SummaryCardProps {
    title: string;
    value: string | number;
    colorClass: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, colorClass }) => (
    <div className={`p-4 rounded-lg shadow-md flex-1 min-w-[150px] ${colorClass}`}>
        <h3 className="text-sm font-medium text-white/80">{title}</h3>
        <p className="text-3xl font-bold text-white">{value}</p>
    </div>
);

interface SummaryPanelProps {
    allKpis: Kpi[];
    onMonthFilter: (month: string | null) => void;
    selectedMonth: string | null;
    onOpenModal: (type: ModalType, data: any) => void;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ allKpis, onMonthFilter, selectedMonth, onOpenModal }) => {
    const summary = useMemo(() => {
        const totalKpis = allKpis.length;
        const basarili = allKpis.filter(k => k.durum === 'basarili').length;
        const marjinal = allKpis.filter(k => k.durum === 'marjinal').length;
        const basarisiz = allKpis.filter(k => k.durum === 'basarisiz').length;
        const acikDof = allKpis.reduce((acc, kpi) => acc + kpi.dof.filter(d => d.durum !== 'Tamamlandı').length, 0);
        const yuksekRisk = allKpis.filter(k => k.risk.riskSeviyesi === 'Yüksek').length;

        const monthlySuccessRate = AYLAR.map(ay => {
            const relevantKpis = allKpis.filter(kpi => kpi.aylik[ay] !== null && kpi.aylik[ay] !== undefined);
            if (relevantKpis.length === 0) return null;

            const successfulThisMonth = relevantKpis.filter(kpi => {
                 const averageUpToMonth = kpi.ortalama; // Simplified for summary view, using overall average
                 if (averageUpToMonth === null) return false;
                 return kpi.durum === 'basarili';
            }).length;
            
            return Math.round((successfulThisMonth / relevantKpis.length) * 100);
        });

        return { totalKpis, basarili, marjinal, basarisiz, acikDof, yuksekRisk, monthlySuccessRate };
    }, [allKpis]);

    const getHeatmapColor = (rate: number | null) => {
        if (rate === null) return 'bg-gray-200 dark:bg-gray-700';
        if (rate >= 90) return 'bg-green-600';
        if (rate >= 75) return 'bg-green-400';
        if (rate >= 50) return 'bg-yellow-400';
        return 'bg-red-500';
    };

    return (
        <aside className="my-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Özet Panel</h2>
            <div className="flex flex-wrap gap-4 mb-6">
                <SummaryCard title="Toplam KPI" value={summary.totalKpis} colorClass="bg-blue-500" />
                <SummaryCard title="Başarılı ✓" value={summary.basarili} colorClass="bg-green-500" />
                <SummaryCard title="Marjinal ≈" value={summary.marjinal} colorClass="bg-yellow-500" />
                <SummaryCard title="Başarısız ✗" value={summary.basarisiz} colorClass="bg-red-500" />
                <SummaryCard title="Açık DÖF" value={summary.acikDof} colorClass="bg-purple-500" />
                <SummaryCard title="Yüksek Risk" value={summary.yuksekRisk} colorClass="bg-orange-500" />
            </div>
            <div>
                <div className="flex items-center gap-4 mb-2">
                    <h3 className="text-lg font-semibold">Aylık Başarı Oranı (%)</h3>
                    {selectedMonth && (
                        <button
                            onClick={() => onMonthFilter(null)}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label={`Filtreyi temizle: ${selectedMonth}`}
                        >
                            <span>{selectedMonth}</span>
                            <CloseIcon className="w-3 h-3"/>
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-12 gap-1">
                    {AYLAR.map((ay, index) => (
                        <div key={ay} className="text-center">
                             <button
                                type="button"
                                onClick={() => {
                                    onMonthFilter(ay);
                                    onOpenModal('month-detail', { month: ay });
                                }}
                                aria-label={`Filtrele ve detayları gör: ${ay}`}
                                className="group relative w-full p-0 border-none bg-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 rounded-md"
                            >
                                <div className={`h-10 w-full rounded transition-all ${getHeatmapColor(summary.monthlySuccessRate[index])} ${selectedMonth === ay ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800' : ''}`}></div>
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[150px] px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                    {ay}: {summary.monthlySuccessRate[index] !== null ? `${summary.monthlySuccessRate[index]}%` : 'N/A'}
                                </div>
                                <span className="text-xs mt-1 block">{ay.substring(0,3)}</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
};

export default SummaryPanel;
