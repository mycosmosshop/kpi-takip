import React from 'react';
import Modal from './Modal';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface ProcessOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    processes: string[];
    onReorder: (proses: string, dir: 'up' | 'down') => void;
}

const ProcessOrderModal: React.FC<ProcessOrderModalProps> = ({ isOpen, onClose, processes, onReorder }) => {
    const footer = (
        <button type="button" onClick={onClose} className="w-full sm:w-auto inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-500 px-4 py-2 bg-white dark:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500">Kapat</button>
    );
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Proses Sırası ve Numaraları" size="lg" footer={footer}>
            <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Yukarı/aşağı taşıyarak proses numaralarını değiştirin. Numara, prosesin tablodaki sırasıdır; o prosese ait tüm KPI'lar birlikte taşınır.</p>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                    {processes.length === 0 && <div className="p-4 text-center text-gray-400 text-sm">Proses yok.</div>}
                    {processes.map((p, i) => (
                        <div key={p} className="flex items-center gap-2 p-2">
                            <span className="w-7 text-center font-bold text-blue-600 dark:text-blue-400">{i + 1})</span>
                            <span className="flex-1 truncate text-sm text-gray-800 dark:text-gray-100">{p}</span>
                            <button onClick={() => onReorder(p, 'up')} disabled={i === 0}
                                title="Yukarı" className={`p-1 rounded ${i === 0 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                <ChevronLeftIcon className="w-5 h-5 rotate-90" />
                            </button>
                            <button onClick={() => onReorder(p, 'down')} disabled={i === processes.length - 1}
                                title="Aşağı" className={`p-1 rounded ${i === processes.length - 1 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                <ChevronRightIcon className="w-5 h-5 rotate-90" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

export default ProcessOrderModal;
