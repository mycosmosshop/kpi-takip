import React, { useState, useEffect } from 'react';
import { AppearanceSettings } from '../types';
import Modal from './Modal';
import { SunIcon, MoonIcon, PaintBrushIcon, CheckCircleIcon } from './icons';

interface AppearanceSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppearanceSettings;
    onSave: (newSettings: AppearanceSettings) => void;
    onReset: () => void;
    darkMode: boolean;
    onToggleDark: () => void;
}

const Segmented = <T extends string,>({ title, options, value, onChange }: { title: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) => (
    <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{title}</h4>
        <div className="inline-flex w-full rounded-xl bg-gray-100 dark:bg-gray-700/60 p-1 gap-1">
            {options.map(opt => (
                <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${value === opt.value ? 'bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-300 font-semibold ring-1 ring-blue-500/30' : 'text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800/40'}`}>
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

const THEME_PREVIEW: Record<string, { name: string; head: string; row: string; accent: string }> = {
    'default': { name: 'Varsayılan', head: '#f3f4f6', row: '#ffffff', accent: '#3b82f6' },
    'corporate-light': { name: 'Kurumsal Açık', head: '#ffffff', row: '#f8fafc', accent: '#0ea5e9' },
    'modern-dark': { name: 'Modern Koyu', head: '#1e293b', row: '#0f172a', accent: '#60a5fa' },
};

const AppearanceSettingsModal: React.FC<AppearanceSettingsModalProps> = ({ isOpen, onClose, settings, onSave, onReset, darkMode, onToggleDark }) => {
    const [local, setLocal] = useState<AppearanceSettings>(settings);
    useEffect(() => { if (isOpen) setLocal(settings); }, [isOpen, settings]);

    const set = (key: keyof AppearanceSettings, value: any) => setLocal(prev => ({ ...prev, [key]: value }));

    const footer = (
        <>
            <button type="button" onClick={() => onSave(local)} className="w-full sm:w-auto sm:ml-3 inline-flex justify-center rounded-lg px-4 py-2 bg-blue-600 text-sm font-medium text-white shadow-sm hover:bg-blue-700">Kaydet</button>
            <button type="button" onClick={onClose} className="mt-2 sm:mt-0 w-full sm:w-auto inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-500 px-4 py-2 bg-white dark:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500">İptal</button>
            <button type="button" onClick={onReset} className="mt-2 sm:mt-0 sm:mr-auto w-full sm:w-auto inline-flex justify-center rounded-lg px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">Sıfırla</button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Görünüm Ayarları" size="2xl" footer={footer}>
            <div className="space-y-6">
                {/* Açık / Koyu */}
                <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Mod</h4>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { dark: false, label: 'Açık', icon: <SunIcon className="w-6 h-6" />, bg: 'from-amber-50 to-white', ring: 'ring-amber-400' },
                            { dark: true, label: 'Koyu', icon: <MoonIcon className="w-6 h-6" />, bg: 'from-slate-700 to-slate-900', ring: 'ring-blue-400' },
                        ].map(opt => {
                            const active = darkMode === opt.dark;
                            return (
                                <button key={opt.label} type="button" onClick={() => { if (darkMode !== opt.dark) onToggleDark(); }}
                                    className={`relative flex items-center gap-3 p-4 rounded-xl border-2 bg-gradient-to-br ${opt.bg} transition-all ${active ? `border-transparent ring-2 ${opt.ring} scale-[1.02]` : 'border-gray-200 dark:border-gray-600 opacity-80 hover:opacity-100'}`}>
                                    <span className={opt.dark ? 'text-blue-300' : 'text-amber-500'}>{opt.icon}</span>
                                    <span className={`font-semibold ${opt.dark ? 'text-white' : 'text-gray-800'}`}>{opt.label}</span>
                                    {active && <CheckCircleIcon className="w-5 h-5 absolute top-2 right-2 text-green-500" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <Segmented title="Yazı Boyutu"
                    value={local.fontSize}
                    onChange={(v) => set('fontSize', v)}
                    options={[{ value: 'xs', label: 'Küçük' }, { value: 'sm', label: 'Normal' }, { value: 'base', label: 'Büyük' }]}
                />
                <Segmented title="Yazı Kalınlığı"
                    value={local.fontWeight}
                    onChange={(v) => set('fontWeight', v)}
                    options={[{ value: 'normal', label: 'İnce' }, { value: 'medium', label: 'Orta' }, { value: 'semibold', label: 'Kalın' }]}
                />

                {/* Tablo teması — önizlemeli kartlar */}
                <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1"><PaintBrushIcon className="w-3.5 h-3.5" /> Tablo Teması</h4>
                    <div className="grid grid-cols-3 gap-3">
                        {(Object.keys(THEME_PREVIEW) as (keyof typeof THEME_PREVIEW)[]).map(key => {
                            const t = THEME_PREVIEW[key];
                            const active = local.theme === key;
                            return (
                                <button key={key} type="button" onClick={() => set('theme', key)}
                                    className={`rounded-xl border-2 overflow-hidden text-left transition-all ${active ? 'border-blue-500 ring-2 ring-blue-500/30 scale-[1.02]' : 'border-gray-200 dark:border-gray-600 hover:border-blue-400'}`}>
                                    <div className="p-1.5" style={{ background: t.row }}>
                                        <div className="h-3 rounded-sm mb-1" style={{ background: t.head }} />
                                        <div className="h-2 rounded-sm mb-0.5" style={{ background: t.accent, opacity: 0.7, width: '70%' }} />
                                        <div className="h-2 rounded-sm" style={{ background: t.accent, opacity: 0.4, width: '50%' }} />
                                    </div>
                                    <div className={`text-[11px] text-center py-1 font-medium ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>{t.name}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <p className="text-xs text-gray-400">Mod anında uygulanır; yazı ve tablo teması "Kaydet" ile uygulanır.</p>
            </div>
        </Modal>
    );
};

export default AppearanceSettingsModal;
