import React, { useState, useEffect } from 'react';
import Modal from './Modal';

interface ChangeYearModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentYear: number;
    onConfirm: (newYear: number, copyData: boolean) => void;
    targetYear?: number;
}

const ChangeYearModal: React.FC<ChangeYearModalProps> = ({ isOpen, onClose, currentYear, onConfirm, targetYear }) => {
    const [newYear, setNewYear] = useState(String(targetYear || currentYear + 1));
    const [copyData, setCopyData] = useState(true);
    const [error, setError] = useState('');
    
    useEffect(() => {
        if(isOpen) {
            setNewYear(String(targetYear || currentYear + 1));
            setCopyData(true);
            setError('');
        }
    }, [isOpen, currentYear, targetYear]);

    const handleSubmit = () => {
        const yearNum = parseInt(newYear, 10);
        if (isNaN(yearNum) || newYear.length !== 4) {
            setError('Lütfen geçerli bir yıl girin (örn. 2025).');
            return;
        }
        if (yearNum === currentYear) {
            setError('Yeni yıl mevcut yıldan farklı olmalıdır.');
            return;
        }
        setError('');
        onConfirm(yearNum, copyData);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Yılı Değiştir"
            size="md"
            footer={
                <>
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">
                        İptal
                    </button>
                    <button type="button" onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 ml-3">
                        Onayla ve Yılı Değiştir
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                <div>
                    <label htmlFor="newYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Yeni Yıl
                    </label>
                    <input
                        type="number"
                        id="newYear"
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="YYYY"
                    />
                    {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
                </div>
                <div className="relative flex items-start">
                    <div className="flex h-6 items-center">
                        <input
                            id="copyData"
                            name="copyData"
                            type="checkbox"
                            checked={copyData}
                            onChange={(e) => setCopyData(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="copyData" className="font-medium text-gray-700 dark:text-gray-300">
                            Mevcut KPI'ları yeni yıla kopyala
                        </label>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Önceki yılın ortalaması, yeni yılın 'Önceki Yıl Gerçekleşen' değeri olarak atanır. Aylık veriler ve DÖF kayıtları sıfırlanır.
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ChangeYearModal;