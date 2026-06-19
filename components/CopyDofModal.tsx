import React, { useState } from 'react';
import { Dof, Kpi } from '../types';
import { AYLAR } from '../constants';
import Modal from './Modal';

interface CopyDofModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCopy: (dof: Dof, targetKpiId: string, targetMonth: string, year: number) => void;
    dofToCopy: Dof;
    allKpis: Kpi[];
    year: number;
}

const CopyDofModal: React.FC<CopyDofModalProps> = ({ isOpen, onClose, onCopy, dofToCopy, allKpis, year }) => {
    const [targetKpiId, setTargetKpiId] = useState<string>(allKpis[0]?.id || '');
    const [targetMonth, setTargetMonth] = useState<string>(AYLAR[0]);

    if (!dofToCopy) return null;

    const handleSubmit = () => {
        if (!targetKpiId) {
            alert('Lütfen bir hedef KPI seçin.');
            return;
        }
        onCopy(dofToCopy, targetKpiId, targetMonth, year);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="DÖF Kopyala"
            size="lg"
            footer={
                <>
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">
                        İptal
                    </button>
                    <button type="button" onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 ml-3">
                        Kopyala
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Kopyalanacak DÖF:</p>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{dofToCopy.problemTanimi || dofToCopy.aksiyon}</p>
                </div>
                <div>
                    <label htmlFor="targetKpi" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Hedef KPI
                    </label>
                    <select
                        id="targetKpi"
                        value={targetKpiId}
                        onChange={(e) => setTargetKpiId(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                        {allKpis.map(kpi => (
                            <option key={kpi.id} value={kpi.id}>
                                {kpi.proses} - {kpi.kpi_adi}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="targetMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Hedef Ay veya Ortalama
                    </label>
                    <select
                        id="targetMonth"
                        value={targetMonth}
                        onChange={(e) => setTargetMonth(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                        {AYLAR.map(ay => (
                            <option key={ay} value={ay}>
                                {ay}
                            </option>
                        ))}
                        <option value="average">Yıllık Ortalama</option>
                    </select>
                </div>
            </div>
        </Modal>
    );
};

export default CopyDofModal;