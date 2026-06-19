import React, { useState, useEffect } from 'react';
import { Kpi, Comparison, CalculationMethod, ReviewPeriod } from '../types';
import Modal from './Modal';

interface BulkKpiModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (kpis: Partial<Kpi>[], commonData: Partial<Kpi>) => void;
}

const BulkKpiModal: React.FC<BulkKpiModalProps> = ({ isOpen, onClose, onSave }) => {
    const getInitialState = (): Partial<Kpi> => ({
        proses: '',
        onceki_yil_gerceklesen: null,
        yeni_yil_hedef: 0,
        karsilastirma: '<',
        hesap_metodu: 'ortalama',
        birim: '%',
        sorumlu: '',
        gozdenGecirmePeriyodu: 'aylik',
    });

    const [commonData, setCommonData] = useState<Partial<Kpi>>(getInitialState());
    const [kpiNames, setKpiNames] = useState('');

     useEffect(() => {
        if (isOpen) {
            setCommonData(getInitialState());
            setKpiNames('');
        }
    }, [isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCommonData(prev => ({ ...prev, [name]: name === 'onceki_yil_gerceklesen' || name === 'yeni_yil_hedef' ? (value === '' ? null : parseFloat(value)) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const names = kpiNames.split('\n').map(name => name.trim()).filter(Boolean);
        
        if (!commonData.proses?.trim()) {
            alert('Lütfen ortak özellikler için bir "Proses" adı girin.');
            return;
        }
        if (names.length === 0) {
            alert('Lütfen en az bir KPI adı girin.');
            return;
        }

        const kpisToCreate = names.map(name => ({ kpi_adi: name }));
        onSave(kpisToCreate, commonData);
    };
    
    const kpiCount = kpiNames.split('\n').map(name => name.trim()).filter(Boolean).length;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Toplu KPI Ekle" size="3xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Ortak Özellikler</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Burada girdiğiniz değerler, aşağıdaki listeye ekleyeceğiniz tüm KPI'lar için geçerli olacaktır.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-600">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Proses (*)</label>
                        <input type="text" name="proses" value={commonData.proses} onChange={handleChange} required className="mt-1 block w-full form-input" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Birim</label>
                        <input type="text" name="birim" value={commonData.birim} onChange={handleChange} className="mt-1 block w-full form-input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Önceki Yıl Gerçekleşen</label>
                        <input type="number" step="any" name="onceki_yil_gerceklesen" value={commonData.onceki_yil_gerceklesen ?? ''} onChange={handleChange} className="mt-1 block w-full form-input" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Yeni Yıl Hedef</label>
                        <input type="number" step="any" name="yeni_yil_hedef" value={commonData.yeni_yil_hedef ?? ''} onChange={handleChange} required className="mt-1 block w-full form-input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Karşılaştırma</label>
                        <select name="karsilastirma" value={commonData.karsilastirma} onChange={handleChange} className="mt-1 block w-full form-select">
                            <option value="<">Küçükse İyi (&lt;)</option>
                            <option value=">">Büyükse İyi (&gt;)</option>
                            <option value="=">Eşitse İyi (=)</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hesap Metodu</label>
                        <select name="hesap_metodu" value={commonData.hesap_metodu} onChange={handleChange} className="mt-1 block w-full form-select">
                            <option value="ortalama">Ortalama</option>
                            <option value="medyan">Medyan</option>
                            <option value="yilici_kumulatif">Yıl İçi Kümülatif</option>
                            <option value="formula">Formül (Daha sonra düzenleyin)</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sorumlu</label>
                        <input type="text" name="sorumlu" value={commonData.sorumlu} onChange={handleChange} className="mt-1 block w-full form-input" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gözden Geçirme Periyodu</label>
                        <select name="gozdenGecirmePeriyodu" value={commonData.gozdenGecirmePeriyodu} onChange={handleChange} className="mt-1 block w-full form-select">
                            <option value="aylik">Aylık</option>
                            <option value="2aylik">2 Aylık</option>
                            <option value="3aylik">3 Aylık</option>
                            <option value="4aylik">4 Aylık</option>
                            <option value="6aylik">6 Aylık</option>
                            <option value="yillik">Yıllık</option>
                        </select>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Oluşturulacak KPI Listesi</h3>
                     <label htmlFor="kpiNames" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Her satıra bir KPI adı girin.
                    </label>
                    <textarea
                        id="kpiNames"
                        rows={8}
                        value={kpiNames}
                        onChange={(e) => setKpiNames(e.target.value)}
                        className="mt-2 block w-full form-textarea"
                        placeholder="Hurda Oranı (%)\nTeslimat Performansı (%)\nMüşteri Şikayet Sayısı (adet)"
                    />
                </div>
                
                <div className="pt-4 flex justify-between items-center">
                     <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                        {kpiCount > 0 ? `${kpiCount} KPI oluşturulacak` : "Başlamak için KPI adlarını girin"}
                    </span>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">İptal</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50" disabled={kpiCount === 0}>Oluştur</button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

// Helper styles for form elements to ensure consistency
const formStyles = `
  .form-input, .form-textarea, .form-select {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: #111827;
    background-color: #fff;
    background-clip: padding-box;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  }
  .dark .form-input, .dark .form-textarea, .dark .form-select {
    color: #d1d5db;
    background-color: #374151;
    border-color: #4b5563;
  }
  .form-input:focus, .form-textarea:focus, .form-select:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px #4f46e5;
  }
`;

if (!document.getElementById('form-styles-sheet-bulk-kpi-modal')) {
    const styleSheet = document.createElement("style");
    styleSheet.id = 'form-styles-sheet-bulk-kpi-modal';
    styleSheet.innerText = formStyles;
    document.head.appendChild(styleSheet);
}

export default BulkKpiModal;
