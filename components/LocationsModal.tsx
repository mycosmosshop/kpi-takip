import React, { useState } from 'react';
import { KpiLocation, Company } from '../types';
import { BRANDS } from '../constants';
import Modal from './Modal';
import { PlusIcon, TrashIcon } from './icons';

interface LocationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    locations: KpiLocation[];
    onChange: (locations: KpiLocation[]) => void;
    currentLocation: string;
    onSelect: (id: string) => void;
}

const slug = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9ğüşıöç]+/gi, '-').replace(/^-+|-+$/g, '') || `loc-${Date.now()}`;

const LocationsModal: React.FC<LocationsModalProps> = ({ isOpen, onClose, locations, onChange, currentLocation, onSelect }) => {
    const [name, setName] = useState('');
    const [company, setCompany] = useState<Company>('sanifoam');

    const add = () => {
        const nm = name.trim();
        if (!nm) return;
        let id = slug(nm);
        if (locations.some(l => l.id === id)) id = `${id}-${Date.now().toString(36).slice(-4)}`;
        onChange([...locations, { id, name: nm, company }]);
        setName('');
    };

    const remove = (loc: KpiLocation) => {
        if (locations.length <= 1) { alert('En az bir lokasyon kalmalı.'); return; }
        if (!window.confirm(`"${loc.name}" lokasyonu ve bu lokasyona ait TÜM KPI verisi silinecek. Emin misiniz?`)) return;
        const rest = locations.filter(l => l.id !== loc.id);
        onChange(rest);
        if (currentLocation === loc.id) onSelect(rest[0].id);
    };

    const rename = (loc: KpiLocation, newName: string) => {
        onChange(locations.map(l => (l.id === loc.id ? { ...l, name: newName } : l)));
    };
    const setLocCompany = (loc: KpiLocation, c: Company) => {
        onChange(locations.map(l => (l.id === loc.id ? { ...l, company: c } : l)));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Lokasyonlar" size="2xl">
            <div className="space-y-4">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700 max-h-80 overflow-y-auto">
                    {locations.map(loc => (
                        <div key={loc.id} className={`flex items-center gap-2 p-2 ${currentLocation === loc.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                            <button onClick={() => onSelect(loc.id)} title="Seç" className={`w-3 h-3 rounded-full shrink-0 ${currentLocation === loc.id ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
                            <input value={loc.name} onChange={e => rename(loc, e.target.value)} className="flex-1 px-2 py-1 text-sm bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 rounded focus:outline-none" />
                            <select value={loc.company} onChange={e => setLocCompany(loc, e.target.value as Company)} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                                <option value="sanifoam">Sanifoam (FR100)</option>
                                <option value="ultech">Ultech (FR001)</option>
                            </select>
                            <span className="text-[10px] text-gray-400 w-14 text-right">{BRANDS[loc.company].docNo}</span>
                            <button onClick={() => remove(loc)} title="Sil" className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
                <div className="flex items-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex-1">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Yeni lokasyon adı</label>
                        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="ör. İzmir" className="w-full px-2 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Marka</label>
                        <select value={company} onChange={e => setCompany(e.target.value as Company)} className="px-2 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
                            <option value="sanifoam">Sanifoam (FR100)</option>
                            <option value="ultech">Ultech (FR001)</option>
                        </select>
                    </div>
                    <button onClick={add} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                        <PlusIcon className="w-4 h-4" /> Ekle
                    </button>
                </div>
                <p className="text-xs text-gray-400">Her lokasyonun KPI verisi ayrı tutulur. Marka, dışa aktarmadaki logo ve doküman no'yu belirler (Sanifoam→FR100, Ultech→FR001).</p>
            </div>
        </Modal>
    );
};

export default LocationsModal;
