import React, { useState, useRef, useEffect } from 'react';
import { TooltipSettings } from '../types';
import { GearIcon, CloseIcon } from './icons';

interface TooltipSettingsPanelProps {
    settings: TooltipSettings;
    onChange: (newSettings: TooltipSettings) => void;
}

const Toggle: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
    <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer disabled:bg-gray-200"
        />
        <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
    </div>
);

const TooltipSettingsPanel: React.FC<TooltipSettingsPanelProps> = ({ settings, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleToggle = (key: keyof Omit<TooltipSettings, 'opacity'>) => {
        onChange({ ...settings, [key]: !settings[key] });
    };
    
    const OTHER_LABELS: { [key in keyof Omit<TooltipSettings, 'opacity' | 'goster' | 'aktif_ay_degeri'>]: string } = {
        sorumlu: 'Sorumlu',
        hesap_metodu: 'Hesap Metodu',
        RPN: 'RPN Skoru',
        son_guncelleme: 'Son Güncelleme',
        hedef: 'Hedef Değeri',
        durum: 'Genel Durum',
    };

    return (
        <div ref={panelRef} className="fixed top-4 right-4 z-[60]">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 bg-blue-800 dark:bg-blue-600 rounded-full shadow-lg text-white dark:text-gray-100 hover:bg-blue-900 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                aria-label="Bilgi kutucuğu ayarları"
            >
                <GearIcon className="w-6 h-6" />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border dark:border-gray-700">
                    <div className="flex justify-between items-center p-3 border-b dark:border-gray-700">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200">İpucu Ayarları</h3>
                        <button onClick={() => setIsOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                           <CloseIcon className="w-5 h-5"/>
                        </button>
                    </div>
                    <div className="p-3 space-y-3">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">Bilgi Kutucuğunu Göster</span>
                            <Toggle checked={settings.goster} onChange={() => handleToggle('goster')} />
                        </label>
                        <div className="border-t border-gray-200 dark:border-gray-600 !mt-2 !mb-2"></div>
                        <div className={`space-y-3 transition-opacity ${!settings.goster ? 'opacity-50 pointer-events-none' : ''}`}>
                             <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm text-gray-700 dark:text-gray-300">Aktif Ay Değeri</span>
                                <Toggle checked={settings.aktif_ay_degeri} onChange={() => handleToggle('aktif_ay_degeri')} disabled={!settings.goster} />
                            </label>
                            {Object.keys(OTHER_LABELS).map((key) => (
                                <label key={key} className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{OTHER_LABELS[key as keyof typeof OTHER_LABELS]}</span>
                                    <Toggle checked={settings[key as keyof typeof OTHER_LABELS]} onChange={() => handleToggle(key as keyof typeof OTHER_LABELS)} disabled={!settings.goster}/>
                                </label>
                            ))}
                            <div className="pt-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Saydamlık</label>
                                <input
                                    type="range"
                                    min="0.1"
                                    max="1"
                                    step="0.05"
                                    value={settings.opacity}
                                    onChange={(e) => onChange({ ...settings, opacity: parseFloat(e.target.value) })}
                                    disabled={!settings.goster}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .toggle-checkbox:checked { right: 0; border-color: #3b82f6; }
                .toggle-checkbox:checked + .toggle-label { background-color: #3b82f6; }
                .dark .toggle-checkbox:checked { border-color: #60a5fa; }
                .dark .toggle-checkbox:checked + .toggle-label { background-color: #60a5fa; }
                .toggle-checkbox:disabled { border-color: #d1d5db; }
                .toggle-checkbox:disabled + .toggle-label { background-color: #e5e7eb; }
                .dark .toggle-checkbox:disabled { border-color: #4b5563; }
                .dark .toggle-checkbox:disabled + .toggle-label { background-color: #4b5563; }
            `}</style>
        </div>
    );
};

export default TooltipSettingsPanel;