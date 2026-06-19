
import React, { useState, useEffect, useMemo } from 'react';
import { Kpi, Risk, RiskLevel } from '../types';
import Modal from './Modal';

interface RiskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (risk: Risk) => void;
    kpi: Kpi;
    onStartDof: (kpiId: string) => void;
}

const RiskModal: React.FC<RiskModalProps> = ({ isOpen, onClose, onSave, kpi, onStartDof }) => {
    const [risk, setRisk] = useState<Risk>(kpi.risk);

    useEffect(() => {
        // Only re-initialize state when the modal is opened or the underlying KPI changes.
        // This prevents wiping user input on parent re-renders.
        if (isOpen) {
            setRisk(kpi.risk);
        }
    }, [kpi.id, isOpen]);
    
    const calculatedRisk = useMemo(() => {
        const RPN = risk.S * risk.O * risk.D;
        let riskSeviyesi: RiskLevel = 'N/A';
        if (RPN <= 20) riskSeviyesi = 'Düşük';
        else if (RPN <= risk.esik) riskSeviyesi = 'Orta';
        else riskSeviyesi = 'Yüksek';
        return { RPN, riskSeviyesi };
    }, [risk.S, risk.O, risk.D, risk.esik]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setRisk(prev => ({ ...prev, [name]: parseInt(value, 10) || 1 }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...risk, ...calculatedRisk });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Risk Analizi">
            <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                <p className="text-sm font-semibold">İlgili KPI: <span className="font-normal">{kpi.proses} - {kpi.kpi_adi}</span></p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Şiddet (S)</label>
                        <input type="number" min="1" max="10" name="S" value={risk.S} onChange={handleChange} className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Olasılık (O)</label>
                        <input type="number" min="1" max="10" name="O" value={risk.O} onChange={handleChange} className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Saptanabilirlik (D)</label>
                        <input type="number" min="1" max="10" name="D" value={risk.D} onChange={handleChange} className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium">Risk Eşiği</label>
                    <input type="number" min="1" name="esik" value={risk.esik} onChange={handleChange} className="mt-1 w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                </div>
                 <div className="mt-4 p-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-center">
                    <p className="text-lg">Risk Öncelik Numarası (RPN): <span className="font-bold text-2xl">{calculatedRisk.RPN}</span></p>
                    <p className="text-md">Risk Seviyesi: <span className="font-semibold">{calculatedRisk.riskSeviyesi}</span></p>
                </div>
                
                <div className="pt-4 flex justify-between items-center gap-2">
                    <div>
                        {calculatedRisk.riskSeviyesi === 'Yüksek' && (
                            <button type="button" onClick={() => onStartDof(kpi.id)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700">
                                Yüksek Risk: DÖF Başlat
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">İptal</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Kaydet</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default RiskModal;
