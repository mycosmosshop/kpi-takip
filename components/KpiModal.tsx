

import React, { useState, useEffect } from 'react';
import { Kpi, Comparison, CalculationMethod, ReviewPeriod } from '../types';
import Modal from './Modal';
import { AYLAR } from '../constants';
import { derivePasifAylarFromPeriod } from '../utils/calculations';
import { FormulaEditor } from './KpiDetailView';

interface KpiModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (kpi: Kpi) => void;
    kpiData?: Kpi | null;
}

const KpiModal: React.FC<KpiModalProps> = ({ isOpen, onClose, onSave, kpiData }) => {
    const getInitialState = (): Partial<Kpi> => ({
        proses: '',
        kpi_adi: '',
        sorumlu: '',
        gozdenGecirmePeriyodu: 'aylik',
        pasifAylar: [],
        birim: '%',
        onceki_yil_gerceklesen: null,
        yeni_yil_hedef: 0,
        karsilastirma: '<',
        hesap_metodu: 'ortalama',
        formula: '',
        aciklama: '',
    });

    const [kpi, setKpi] = useState<Partial<Kpi>>(getInitialState());

    useEffect(() => {
        // Only re-initialize state when the modal is opened or the underlying data ID changes.
        // This prevents wiping user input on parent re-renders.
        if (isOpen) {
           if (kpiData) {
                setKpi(kpiData);
            } else {
                setKpi(getInitialState());
            }
        }
    }, [kpiData?.id, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setKpi(prev => ({ ...prev, [name]: name.includes('hedef') || name.includes('gerceklesen') ? parseFloat(value) || 0 : value }));
    };

    const handlePasifAylarChange = (month: string) => {
        setKpi(prev => {
            const currentPasifAylar = prev?.pasifAylar || [];
            const newPasifAylar = currentPasifAylar.includes(month)
                ? currentPasifAylar.filter(m => m !== month)
                : [...currentPasifAylar, month];
            return { ...prev, pasifAylar: newPasifAylar };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const fullKpi: Kpi = {
            id: kpi.id || `kpi-uuid-${Date.now()}`,
            proses: kpi.proses || '',
            kpi_adi: kpi.kpi_adi || '',
            sorumlu: kpi.sorumlu || '',
            gozdenGecirmePeriyodu: kpi.gozdenGecirmePeriyodu || 'aylik',
            pasifAylar: kpi.pasifAylar || [],
            birim: kpi.birim || '%',
            onceki_yil_gerceklesen: kpi.onceki_yil_gerceklesen || null,
            yeni_yil_hedef: kpi.yeni_yil_hedef || 0,
            karsilastirma: kpi.karsilastirma || '<',
            hesap_metodu: kpi.hesap_metodu || 'ortalama',
            formula: kpi.hesap_metodu === 'formula' ? kpi.formula : '',
            aciklama: kpi.aciklama || '',
            kanit_dosyalari: kpi.kanit_dosyalari || [],
            aylik: kpi.aylik || Object.fromEntries(AYLAR.map(ay => [ay, null])),
            dof: kpi.dof || [],
            risk: kpi.risk || { S: 1, O: 1, D: 1, RPN: 1, esik: 40, riskSeviyesi: 'Düşük' },
            son_guncelleme: (kpi.son_guncelleme && kpi.son_guncelleme.trim()) ? kpi.son_guncelleme : new Date().toLocaleString('tr-TR'),
            ortalama: kpi.ortalama || null,
            durum: kpi.durum || 'n/a',
        };
        onSave(fullKpi);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={kpiData ? 'KPI Düzenle' : 'Yeni KPI Ekle'} size="3xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Proses</label>
                        <input type="text" name="proses" value={kpi.proses} onChange={handleChange} required className="mt-1 block w-full form-input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">KPI Adı</label>
                        <input type="text" name="kpi_adi" value={kpi.kpi_adi} onChange={handleChange} required className="mt-1 block w-full form-input" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Önceki Yıl Gerçekleşen</label>
                        <input type="number" step="0.1" name="onceki_yil_gerceklesen" value={kpi.onceki_yil_gerceklesen ?? ''} onChange={handleChange} className="mt-1 block w-full form-input" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Yeni Yıl Hedef</label>
                        <input type="number" step="0.1" name="yeni_yil_hedef" value={kpi.yeni_yil_hedef ?? ''} onChange={handleChange} required className="mt-1 block w-full form-input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Birim</label>
                        <input type="text" name="birim" value={kpi.birim} onChange={handleChange} className="mt-1 block w-full form-input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Karşılaştırma</label>
                        <select name="karsilastirma" value={kpi.karsilastirma} onChange={handleChange} className="mt-1 block w-full form-select">
                            <option value="<">Küçükse İyi (&lt;)</option>
                            <option value="<=">Küçük-Eşit İyi (≤)</option>
                            <option value=">">Büyükse İyi (&gt;)</option>
                            <option value=">=">Büyük-Eşit İyi (≥)</option>
                            <option value="=">Eşitse İyi (=)</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hesap Metodu</label>
                        <select name="hesap_metodu" value={kpi.hesap_metodu} onChange={handleChange} className="mt-1 block w-full form-select">
                            <option value="ortalama">Ortalama</option>
                            <option value="medyan">Medyan</option>
                            <option value="yilici_kumulatif">Yıl İçi Kümülatif</option>
                            <option value="formula">Formül</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sorumlu</label>
                        <input type="text" name="sorumlu" value={kpi.sorumlu ?? ''} onChange={handleChange} className="mt-1 block w-full form-input" placeholder="Hedefin sahibini girin..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Son Güncelleme</label>
                        <input type="text" name="son_guncelleme" value={kpi.son_guncelleme ?? ''} onChange={handleChange} className="mt-1 block w-full form-input" placeholder="örn. 20.06.2026 10:00 (boş = şimdi)" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gözden Geçirme Periyodu</label>
                        <select name="gozdenGecirmePeriyodu" value={kpi.gozdenGecirmePeriyodu} onChange={(e) => { const p = e.target.value as ReviewPeriod; setKpi(prev => ({ ...prev, gozdenGecirmePeriyodu: p, pasifAylar: derivePasifAylarFromPeriod(p) })); }} className="mt-1 block w-full form-select">
                            <option value="aylik">Aylık</option>
                            <option value="2aylik">2 Aylık</option>
                            <option value="3aylik">3 Aylık</option>
                            <option value="4aylik">4 Aylık</option>
                            <option value="6aylik">6 Aylık</option>
                            <option value="yillik">Yıllık</option>
                        </select>
                    </div>
                </div>
                
                {kpi.hesap_metodu === 'formula' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Formül Editörü</label>
                        <FormulaEditor
                            formula={kpi.formula || ''}
                            onFormulaChange={(newFormula) => {
                                setKpi(prev => ({ ...prev, formula: newFormula }));
                            }}
                        />
                    </div>
                )}
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Açıklama</label>
                    <textarea name="aciklama" value={kpi.aciklama} onChange={handleChange} rows={3} className="mt-1 block w-full form-textarea" />
                </div>

                <div className="p-4 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Veri Girilmeyecek Aylar</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Veri girilmeyecek ayları seçin — bu aylar tabloda pasifleştirilir (kilitli). Aktif aylar = işaretli OLMAYANLAR. "Gözden Geçirme Periyodu" seçince bu liste otomatik ön-doldurulur; istediğin ayı işaretleyip kaldırabilirsin.</p>
                    <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-4 gap-y-2">
                        {AYLAR.map(ay => (
                            <label key={ay} className="flex items-center space-x-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={kpi.pasifAylar?.includes(ay) || false}
                                    onChange={() => handlePasifAylarChange(ay)}
                                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <span className="text-gray-700 dark:text-gray-300">{ay}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">İptal</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Kaydet</button>
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

if (!document.getElementById('form-styles-sheet-kpi-modal')) {
    const styleSheet = document.createElement("style");
    styleSheet.id = 'form-styles-sheet-kpi-modal';
    styleSheet.innerText = formStyles;
    document.head.appendChild(styleSheet);
}

export default KpiModal;