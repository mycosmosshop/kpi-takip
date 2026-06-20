
import React, { useMemo } from 'react';
import { Kpi, Status } from '../types';
import Modal from './Modal';
import { getStatusColorClasses } from '../utils/calculations';
import { InfoCircleIcon } from './icons';

interface MonthDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    month: string | null;
    allKpis: Kpi[];
}

const getMonthlyStatus = (kpi: Kpi, value: number | null): Status => {
    if (value === null) return 'n/a';
    const { yeni_yil_hedef, karsilastirma } = kpi;
    switch (karsilastirma) {
        case '<': return value < yeni_yil_hedef ? 'basarili' : value === yeni_yil_hedef ? 'marjinal' : 'basarisiz';
        case '<=': return value <= yeni_yil_hedef ? 'basarili' : 'basarisiz';
        case '>': return value > yeni_yil_hedef ? 'basarili' : value === yeni_yil_hedef ? 'marjinal' : 'basarisiz';
        case '>=': return value >= yeni_yil_hedef ? 'basarili' : 'basarisiz';
        case '=': return value === yeni_yil_hedef ? 'basarili' : 'basarisiz';
        default: return 'n/a';
    }
};

const SummaryCard: React.FC<{ title: string; value: number; colorClass: string; }> = ({ title, value, colorClass }) => (
    <div className={`p-3 rounded-lg text-center flex-1 ${colorClass}`}>
        <p className="text-2xl font-bold text-white">{value}</p>
        <h3 className="text-sm font-medium text-white/90">{title}</h3>
    </div>
);

const MonthDetailModal: React.FC<MonthDetailModalProps> = ({ isOpen, onClose, month, allKpis }) => {
    const monthData = useMemo(() => {
        if (!month) return null;

        const relevantKpis = allKpis
            .filter(kpi => kpi.aylik[month] !== null && kpi.aylik[month] !== undefined)
            .map(kpi => ({
                ...kpi,
                monthlyStatus: getMonthlyStatus(kpi, kpi.aylik[month])
            }));
        
        const counts = {
            basarili: relevantKpis.filter(k => k.monthlyStatus === 'basarili').length,
            marjinal: relevantKpis.filter(k => k.monthlyStatus === 'marjinal').length,
            basarisiz: relevantKpis.filter(k => k.monthlyStatus === 'basarisiz').length,
        };

        const total = relevantKpis.length;
        const successRate = total > 0 ? Math.round((counts.basarili / total) * 100) : 0;

        return {
            relevantKpis,
            counts,
            total,
            successRate,
        };
    }, [month, allKpis]);

    if (!isOpen || !month || !monthData) return null;

    const { relevantKpis, counts, total, successRate } = monthData;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${month} Ayı Özeti`} size="xl">
            <div className="space-y-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{month} Ayı Performansı</h2>
                        <div className="text-right">
                             <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{successRate}%</p>
                             <p className="text-sm text-gray-500 dark:text-gray-400">Başarı Oranı</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-4">
                        <SummaryCard title="Toplam KPI" value={total} colorClass="bg-blue-500" />
                        <SummaryCard title="Başarılı" value={counts.basarili} colorClass="bg-green-500" />
                        <SummaryCard title="Marjinal" value={counts.marjinal} colorClass="bg-yellow-500" />
                        <SummaryCard title="Başarısız" value={counts.basarisiz} colorClass="bg-red-500" />
                    </div>
                </div>

                <div>
                     <div className="flex items-center gap-2 mb-3">
                        <InfoCircleIcon className="w-5 h-5 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Aylık KPI Listesi</h3>
                    </div>
                     <div className="max-h-80 overflow-y-auto pr-2 space-y-2">
                        {relevantKpis.length > 0 ? (
                             relevantKpis.map(kpi => (
                                <div key={kpi.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">{kpi.kpi_adi}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{kpi.proses}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <p className="text-lg font-mono">{kpi.aylik[month]}</p>
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full text-center min-w-[80px] ${getStatusColorClasses(kpi.monthlyStatus)}`}>
                                            {kpi.monthlyStatus}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 dark:text-gray-400 italic py-4">Bu ay için veri girilmiş KPI bulunmamaktadır.</p>
                        )}
                    </div>
                </div>
                
                <div className="pt-5 text-right">
                     <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Kapat</button>
                </div>
            </div>
        </Modal>
    );
};

export default MonthDetailModal;
