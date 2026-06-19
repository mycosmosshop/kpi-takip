import React, { useState, useEffect } from 'react';
import { AppearanceSettings, AppearanceTheme } from '../types';
import Modal from './Modal';

interface AppearanceSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppearanceSettings;
    onSave: (newSettings: AppearanceSettings) => void;
    onReset: () => void;
}

const AppearanceSettingsModal: React.FC<AppearanceSettingsModalProps> = ({ isOpen, onClose, settings, onSave, onReset }) => {
    const [localSettings, setLocalSettings] = useState<AppearanceSettings>(settings);

    useEffect(() => {
        if (isOpen) {
            setLocalSettings(settings);
        }
    }, [isOpen, settings]);

    const handleSettingChange = (key: keyof AppearanceSettings, value: string) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    };

    const RadioGroup = ({ title, name, options, selected, onChange }: { title: string, name: keyof AppearanceSettings, options: { value: string, label: string }[], selected: string, onChange: (value: string) => void }) => (
        <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</h4>
            <div className="flex flex-wrap gap-2">
                {options.map(opt => (
                    <label key={opt.value} className="flex-1 min-w-[80px]">
                        <input
                            type="radio"
                            name={name}
                            value={opt.value}
                            checked={selected === opt.value}
                            onChange={() => onChange(opt.value)}
                            className="sr-only"
                        />
                        <div className={`cursor-pointer text-center text-sm px-3 py-2 rounded-md border-2 transition-colors ${selected === opt.value ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-blue-400'}`}>
                            {opt.label}
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Tablo Görünüm Ayarları"
            size="md"
        >
            <div className="space-y-6">
                <RadioGroup
                    title="Yazı Tipi Boyutu"
                    name="fontSize"
                    selected={localSettings.fontSize}
                    onChange={(value) => handleSettingChange('fontSize', value)}
                    options={[
                        { value: 'xs', label: 'Küçük' },
                        { value: 'sm', label: 'Normal' },
                        { value: 'base', label: 'Büyük' }
                    ]}
                />
                <RadioGroup
                    title="Yazı Tipi Kalınlığı"
                    name="fontWeight"
                    selected={localSettings.fontWeight}
                    onChange={(value) => handleSettingChange('fontWeight', value)}
                    options={[
                        { value: 'normal', label: 'Normal' },
                        { value: 'medium', label: 'Orta Kalın' },
                        { value: 'semibold', label: 'Kalın' }
                    ]}
                />
                <RadioGroup
                    title="Tablo Teması"
                    name="theme"
                    selected={localSettings.theme}
                    onChange={(value) => handleSettingChange('theme', value)}
                    options={[
                        { value: 'default', label: 'Varsayılan' },
                        { value: 'corporate-light', label: 'Kurumsal Açık' },
                        { value: 'modern-dark', label: 'Modern Koyu' }
                    ]}
                />
            </div>
            <div className="pt-8 flex justify-between items-center">
                <button
                    type="button"
                    onClick={onReset}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500"
                >
                    Sıfırla
                </button>
                <div className="flex gap-2">
                     <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">
                        İptal
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave(localSettings)}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 ml-3"
                    >
                        Değişiklikleri Kaydet
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default AppearanceSettingsModal;