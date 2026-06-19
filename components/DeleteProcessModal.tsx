import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { ExclamationCircleIcon } from './icons';

interface DeleteProcessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (target: string, action: 'clear' | 'delete' | 'delete-dofs' | 'delete-evidences') => void;
    processes: string[];
}

const DeleteProcessModal: React.FC<DeleteProcessModalProps> = ({ isOpen, onClose, onConfirm, processes }) => {
    // '__ALL__' özel değeri tüm tabloyu temsil eder
    const [target, setTarget] = useState('__ALL__');

    useEffect(() => {
        if (isOpen) {
            setTarget('__ALL__');
        }
    }, [isOpen]);

    const handleConfirm = (action: 'clear' | 'delete' | 'delete-dofs' | 'delete-evidences') => {
        onConfirm(target, action);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Toplu İşlemler"
            size="2xl"
            footer={
                <>
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">
                        Kapat
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                <div>
                    <label htmlFor="targetSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        İşlem Hedefi
                    </label>
                    <select
                        id="targetSelect"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                        <option value="__ALL__">Tüm Tablo</option>
                        {processes.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-600">
                    {/* Eylem: Verileri Temizle */}
                    <div className="p-4 border dark:border-gray-600 rounded-lg flex flex-col justify-between">
                        <div>
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200">Verileri Temizle</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Seçilen hedefin sadece aylık veri girişlerini siler. KPI satırları ve tanımları korunur.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleConfirm('clear')}
                            className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
                        >
                            {target === '__ALL__' ? 'Tüm Verileri Temizle' : 'Proses Verilerini Temizle'}
                        </button>
                    </div>

                     {/* Eylem: Kanıtları Sil */}
                    <div className="p-4 border border-orange-200 dark:border-orange-900/80 rounded-lg flex flex-col justify-between bg-orange-50 dark:bg-orange-900/20">
                         <div>
                            <div className="flex items-center gap-2">
                                <ExclamationCircleIcon className="h-5 w-5 text-orange-500"/>
                                <h4 className="font-semibold text-orange-800 dark:text-orange-200">Kanıtları Sil</h4>
                            </div>
                            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                Seçilen hedefe ait KPI'ların <strong>tüm kanıt dosyalarını ve linklerini</strong> siler. KPI'lar, DÖF'ler ve aylık veriler korunur.
                            </p>
                        </div>
                         <button
                            type="button"
                            onClick={() => handleConfirm('delete-evidences')}
                            className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md shadow-sm hover:bg-orange-700"
                        >
                           {target === '__ALL__' ? 'Tüm Kanıtları Sil' : 'Proses Kanıtlarını Sil'}
                        </button>
                    </div>

                    {/* Eylem: DÖF'leri Sil */}
                    <div className="p-4 border border-orange-200 dark:border-orange-900/80 rounded-lg flex flex-col justify-between bg-orange-50 dark:bg-orange-900/20">
                         <div>
                            <div className="flex items-center gap-2">
                                <ExclamationCircleIcon className="h-5 w-5 text-orange-500"/>
                                <h4 className="font-semibold text-orange-800 dark:text-orange-200">DÖF'leri Sil</h4>
                            </div>
                            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                Seçilen hedefe ait KPI'ların <strong>tüm DÖF kayıtlarını</strong> siler. KPI'lar ve aylık veriler korunur.
                            </p>
                        </div>
                         <button
                            type="button"
                            onClick={() => handleConfirm('delete-dofs')}
                            className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md shadow-sm hover:bg-orange-700"
                        >
                           {target === '__ALL__' ? 'Tüm DÖF\'leri Sil' : 'Proses DÖF\'lerini Sil'}
                        </button>
                    </div>

                    {/* Eylem: Komple Sil */}
                    <div className="p-4 border border-red-200 dark:border-red-900/80 rounded-lg flex flex-col justify-between bg-red-50 dark:bg-red-900/20">
                         <div>
                            <div className="flex items-center gap-2">
                                <ExclamationCircleIcon className="h-5 w-5 text-red-500"/>
                                <h4 className="font-semibold text-red-800 dark:text-red-200">Komple Sil</h4>
                            </div>
                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                Seçilen hedefe ait <strong>tüm KPI satırlarını</strong> kalıcı olarak siler. Bu işlem geri alınamaz.
                            </p>
                        </div>
                         <button
                            type="button"
                            onClick={() => handleConfirm('delete')}
                            className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700"
                        >
                           {target === '__ALL__' ? 'Tüm Tabloyu Sil' : 'Prosesi Komple Sil'}
                        </button>
                    </div>
                </div>

            </div>
        </Modal>
    );
};

export default DeleteProcessModal;
