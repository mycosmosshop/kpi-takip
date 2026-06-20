

import React, { useState, useEffect, useRef } from 'react';
import { Kpi, ModalType } from '../types';
import { AYLAR } from '../constants';
import Modal from './Modal';
import { PaperclipIcon, InfoCircleIcon, EditIcon, TrashIcon, PlusIcon } from './icons';
import { isMonthActive } from '../utils/calculations';

interface KpiDetailViewProps {
    isOpen: boolean;
    onClose: () => void;
    kpi: Kpi | null;
    onSaveKpi: (kpi: Kpi) => void;
    onOpenModal: (type: ModalType, data: any) => void;
    onDeleteDof: (kpiId: string, dofId: string) => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
            <InfoCircleIcon className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">{children}</div>
    </div>
);

export const FormulaEditor: React.FC<{ formula: string; onFormulaChange: (newFormula: string) => void; }> = ({ formula, onFormulaChange }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const insertText = (text: string, cursorOffset: number = text.length) => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const currentText = textareaRef.current.value;
        const newText = currentText.substring(0, start) + text + currentText.substring(end);
        onFormulaChange(newText);
        
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newCursorPos = start + cursorOffset;
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    };

    const buttons = [
        { label: '(', value: '(', offset: 1 }, { label: ')', value: ')', offset: 1 },
        { label: '+', value: ' + ', offset: 3 }, { label: '-', value: ' - ', offset: 3 },
        { label: '×', value: ' * ', offset: 3 }, { label: '÷', value: ' / ', offset: 3 },
        { label: '√', value: 'SQRT()', offset: 5 }, { label: 'x^y', value: 'POW(, )', offset: 4 },
        { label: 'SUM', value: 'SUM(aylar)', offset: 10 }, { label: 'AVG', value: 'AVG(aylar)', offset: 10 },
        { label: 'COUNT', value: 'COUNT(aylar)', offset: 12 }, { label: 'Hedef', value: 'hedef', offset: 5 }
    ];

    return (
        <div className="p-4 bg-gray-100 dark:bg-gray-700/80 rounded-lg">
            <div className="flex flex-wrap gap-2 mb-2">
                {buttons.map(btn => (
                    <button key={btn.label} type="button" onClick={() => insertText(btn.value, btn.offset)} className="px-3 py-1 text-sm font-mono bg-white dark:bg-gray-600 border dark:border-gray-500 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">
                        {btn.label}
                    </button>
                ))}
            </div>
            <textarea
                ref={textareaRef}
                name="formula"
                rows={3}
                value={formula}
                onChange={(e) => onFormulaChange(e.target.value)}
                className="w-full font-mono form-input"
                placeholder="Örn: (SUM(aylar) / COUNT(aylar)) * 100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Kullanılabilir değişkenler: <strong>aylar</strong> (aylık değerler dizisi), <strong>hedef</strong>. <br/>
                Fonksiyonlar: <strong>SUM, AVG, COUNT, SQRT, POW(sayı, üs)</strong>.
            </p>
        </div>
    );
};


const KpiDetailView: React.FC<KpiDetailViewProps> = ({ isOpen, onClose, kpi, onSaveKpi, onOpenModal, onDeleteDof }) => {
    const [editableKpi, setEditableKpi] = useState<Kpi | null>(null);

    useEffect(() => {
        // Only re-initialize state when the modal is opened or the underlying KPI changes.
        // This prevents wiping user input on parent re-renders.
        if (isOpen && kpi) {
            // Create a deep copy to avoid mutating the original object until save
            setEditableKpi(JSON.parse(JSON.stringify(kpi)));
        }
    }, [kpi, isOpen]);

    if (!isOpen || !editableKpi) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['yeni_yil_hedef', 'onceki_yil_gerceklesen'].includes(name);
        setEditableKpi(prev => prev ? { ...prev, [name]: isNumeric ? (parseFloat(value) || null) : value } : null);
    };
    
    const handleMonthlyChange = (month: string, value: string) => {
        const numValue = value === '' ? null : parseFloat(value);
        setEditableKpi(prev => {
            if (!prev) return null;
            const newAylik = { ...prev.aylik, [month]: numValue };
            return { ...prev, aylik: newAylik };
        });
    };
    
    const handlePasifAylarChange = (month: string) => {
        setEditableKpi(prev => {
            if (!prev) return null;
            const currentPasifAylar = prev.pasifAylar || [];
            const newPasifAylar = currentPasifAylar.includes(month)
                ? currentPasifAylar.filter(m => m !== month)
                : [...currentPasifAylar, month];
            return { ...prev, pasifAylar: newPasifAylar };
        });
    };

    const handleSave = () => {
        if (editableKpi) {
            onSaveKpi({ ...editableKpi, son_guncelleme: new Date().toLocaleString('tr-TR') });
        }
    };
    
    const handleDofDelete = (dofId: string) => {
        if (window.confirm('Bu DÖF kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
            // Persist the change in the parent component.
            onDeleteDof(editableKpi.id, dofId);
            
            // Update local state for immediate UI feedback.
            setEditableKpi(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    dof: prev.dof.filter(d => d.id !== dofId),
                };
            });
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="KPI Detayları ve Düzenleme" size="3xl">
            <div className="text-sm">
                
                <Section title="Genel Bilgiler">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                             <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">KPI Adı</label>
                             <input type="text" name="kpi_adi" value={editableKpi.kpi_adi} onChange={handleChange} className="mt-1 w-full form-input"/>
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Proses</label>
                             <input type="text" name="proses" value={editableKpi.proses} onChange={handleChange} className="mt-1 w-full form-input"/>
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Önceki Yıl</label>
                             <input type="number" step="any" name="onceki_yil_gerceklesen" value={editableKpi.onceki_yil_gerceklesen ?? ''} onChange={handleChange} className="mt-1 w-full form-input"/>
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Yıl Sonu Hedef</label>
                             <input type="number" step="any" name="yeni_yil_hedef" value={editableKpi.yeni_yil_hedef} onChange={handleChange} className="mt-1 w-full form-input"/>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Sorumlu</label>
                            <input type="text" name="sorumlu" value={editableKpi.sorumlu ?? ''} onChange={handleChange} className="mt-1 w-full form-input"/>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Birim</label>
                            <input type="text" name="birim" value={editableKpi.birim} onChange={handleChange} className="mt-1 w-full form-input"/>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Karşılaştırma</label>
                            <select name="karsilastirma" value={editableKpi.karsilastirma} onChange={handleChange} className="mt-1 block w-full form-select">
                                <option value="<">Küçükse İyi (&lt;)</option>
                                <option value="<=">Küçük-Eşit İyi (≤)</option>
                                <option value=">">Büyükse İyi (&gt;)</option>
                                <option value=">=">Büyük-Eşit İyi (≥)</option>
                                <option value="=">Eşitse İyi (=)</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Hesap Metodu</label>
                            <select name="hesap_metodu" value={editableKpi.hesap_metodu} onChange={handleChange} className="mt-1 block w-full form-select">
                                <option value="ortalama">Ortalama</option>
                                <option value="medyan">Medyan</option>
                                <option value="yilici_kumulatif">Yıl İçi Kümülatif</option>
                                <option value="formula">Formül</option>
                            </select>
                        </div>
                        <div>
                           <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Gözden Geçirme Periyodu</label>
                           <select name="gozdenGecirmePeriyodu" value={editableKpi.gozdenGecirmePeriyodu ?? 'aylik'} onChange={handleChange} className="mt-1 block w-full form-select">
                               <option value="aylik">Aylık</option>
                               <option value="2aylik">2 Aylık</option>
                               <option value="3aylik">3 Aylık</option>
                               <option value="4aylik">4 Aylık</option>
                               <option value="6aylik">6 Aylık</option>
                               <option value="yillik">Yıllık</option>
                           </select>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 gap-4 mt-4">
                         <div className="col-span-full">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Kanıt Dosyaları</label>
                            <button
                                type="button"
                                onClick={() => onOpenModal('evidence', editableKpi)}
                                className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
                            >
                                <PaperclipIcon className="w-4 h-4"/>
                                Dosyaları Yönet ({editableKpi.kanit_dosyalari.length})
                            </button>
                        </div>
                        <div className="col-span-full">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Açıklama</label>
                            <textarea name="aciklama" value={editableKpi.aciklama} onChange={handleChange} rows={2} className="mt-1 block w-full form-textarea" />
                        </div>
                    </div>
                </Section>
                
                {editableKpi.hesap_metodu === 'formula' && (
                    <Section title="Formül ile Hesaplama">
                        <FormulaEditor
                            formula={editableKpi.formula || ''}
                            onFormulaChange={(newFormula) => {
                                setEditableKpi(prev => prev ? { ...prev, formula: newFormula } : null);
                            }}
                        />
                    </Section>
                )}

                 <Section title="Veri Girilmeyecek Aylar">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Veri girişi yapılmayacak ayları seçin. Bu aylar ortalama hesaplamalarına dahil edilmez.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {AYLAR.map(ay => (
                            <label key={ay} className="flex items-center space-x-2 text-sm p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600/50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editableKpi.pasifAylar?.includes(ay) || false}
                                    onChange={() => handlePasifAylarChange(ay)}
                                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                 <span className="text-gray-700 dark:text-gray-300">{ay}</span>
                            </label>
                        ))}
                    </div>
                </Section>

                <Section title="Aylık Veriler">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {AYLAR.map((ay, monthIndex) => {
                            const isAktif = isMonthActive(editableKpi, monthIndex);
                            const inputClasses = ['mt-1', 'w-full', 'form-input', 'text-center'];
                            if (!isAktif) {
                                inputClasses.push(
                                    'bg-gray-100', 'dark:bg-gray-700/50',
                                    'cursor-not-allowed', 'inactive-month-pattern'
                                );
                            }
                            return (
                            <div key={ay}>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 text-center">{ay}</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={editableKpi.aylik[ay] ?? ''}
                                    onChange={(e) => handleMonthlyChange(ay, e.target.value)}
                                    disabled={!isAktif}
                                    className={inputClasses.join(' ')}
                                />
                            </div>
                        )})}
                    </div>
                </Section>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Section title="Risk Analizi">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">RPN: <span className="font-bold text-lg text-gray-800 dark:text-gray-200">{editableKpi.risk.RPN}</span> (Seviye: {editableKpi.risk.riskSeviyesi})</p>
                            </div>
                            <button onClick={() => onOpenModal('risk', { ...editableKpi, fromDetail: true })} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-orange-500 rounded-md hover:bg-orange-600">
                                <EditIcon className="w-4 h-4" /> Analizi Düzenle
                            </button>
                        </div>
                    </Section>

                    <Section title="Düzeltici Önleyici Faaliyetler (DÖF)">
                        <div className="space-y-3">
                            {editableKpi.dof.length > 0 ? (
                                editableKpi.dof.map(d => (
                                    <div key={d.id} className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                 <p className="font-semibold text-gray-800 dark:text-gray-200">{d.problemTanimi || d.aksiyon}</p>
                                                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sorumlu: {d.sorumlu} | Termin: {d.due_date}</p>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                 <button onClick={() => onOpenModal('dof', { ...d, kpiId: editableKpi.id, returnTo: 'detail' })} className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full"><EditIcon className="w-4 h-4"/></button>
                                                 <button onClick={() => handleDofDelete(d.id)} className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><TrashIcon className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400 italic text-center py-2">Bu KPI için atanmış DÖF bulunmamaktadır.</p>
                            )}
                             <button onClick={() => onOpenModal('dof', { kpiId: editableKpi.id, returnTo: 'detail' })} className="w-full flex items-center justify-center gap-2 mt-3 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
                                <PlusIcon className="w-4 h-4" /> Yeni DÖF Ekle
                            </button>
                        </div>
                    </Section>
                </div>

                <div className="pt-6 flex justify-end gap-3">
                     <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">İptal</button>
                     <button type="button" onClick={handleSave} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Kaydet</button>
                </div>
            </div>
        </Modal>
    );
};

export default KpiDetailView;

// Helper styles for form elements - Tailwind doesn't have these by default
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

if (!document.getElementById('form-styles-sheet-kpi-detail')) {
    const styleSheet = document.createElement("style");
    styleSheet.id = 'form-styles-sheet-kpi-detail';
    styleSheet.innerText = formStyles;
    document.head.appendChild(styleSheet);
}