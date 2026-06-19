import React, { useRef } from 'react';
import { Kpi, ModalType, KpiLocation } from '../types';
import { PlusIcon, UploadIcon, DownloadIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, PdfIcon, ClipboardCheckIcon, TableCellsIcon, TrashIcon, PaintBrushIcon, ClipboardDocumentListIcon, ChartBarIcon, GearIcon, DocumentDuplicateIcon } from './icons';

interface HeaderProps {
    year: number;
    allKpis: Kpi[];
    filters: { process: string[]; status: string[]; risk: string[] };
    setFilters: React.Dispatch<React.SetStateAction<{ process: string[]; status: string[]; risk: string[] }>>;
    onAddKpi: () => void;
    onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onImportXlsx: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onExport: () => void;
    onExportXlsx: () => void;
    exportLabel: string;
    locations: KpiLocation[];
    currentLocation: string;
    onChangeLocation: (id: string) => void;
    onManageLocations: () => void;
    cloudStatus: 'offline' | 'syncing' | 'connected';
    onCloudRefresh: () => void;
    onCopyYear: () => void;
    onNavigateYear: (targetYear: number) => void;
    isSummaryOpen: boolean;
    setSummaryOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onGeneratePdf: () => void;
    onOpenDofPanel: () => void;
    onBulkDelete: () => void;
    onOpenModal: (type: ModalType, data?: any) => void;
}

const FilterDropdown: React.FC<{ label: string; options: string[]; selected: string[]; onChange: (selected: string[]) => void; }> = ({ label, options, selected, onChange }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option: string) => {
        const newSelected = selected.includes(option)
            ? selected.filter(item => item !== option)
            : [...selected, option];
        onChange(newSelected);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                <span>{label} {selected.length > 0 ? `(${selected.length})` : ''}</span>
                <ChevronDownIcon className="w-4 h-4 ml-2" />
            </button>
            {isOpen && (
                <div className="absolute z-10 w-56 mt-1 bg-white dark:bg-gray-700 rounded-md shadow-lg border dark:border-gray-600">
                    <ul className="py-1 max-h-60 overflow-auto">
                        {options.map(option => (
                            <li key={option} className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center" onClick={() => handleSelect(option)}>
                                <input type="checkbox" checked={selected.includes(option)} readOnly className="mr-2 form-checkbox h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                                {option}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const Header: React.FC<HeaderProps> = ({ year, allKpis, filters, setFilters, onAddKpi, onImport, onImportXlsx, onExport, onExportXlsx, exportLabel, locations, currentLocation, onChangeLocation, onManageLocations, cloudStatus, onCloudRefresh, onCopyYear, onNavigateYear, isSummaryOpen, setSummaryOpen, onGeneratePdf, onOpenDofPanel, onBulkDelete, onOpenModal }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const xlsxInputRef = useRef<HTMLInputElement>(null);
    const uniqueProcesses = [...new Set(allKpis.map(kpi => kpi.proses))];
    const uniqueStatuses = ['basarili', 'marjinal', 'basarisiz', 'n/a'];
    const uniqueRisks = ['Düşük', 'Orta', 'Yüksek', 'N/A'];

    const handleFilterChange = (filterType: 'process' | 'status' | 'risk') => (selected: string[]) => {
        setFilters(prev => ({ ...prev, [filterType]: selected }));
    };

    return (
        <header className="relative bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md no-print">
            <span className="absolute top-2 right-4 text-xs text-gray-400 dark:text-gray-500 font-mono">v1.9</span>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white shrink-0">KPI Takip</h1>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                        <select
                            value={currentLocation}
                            onChange={(e) => onChangeLocation(e.target.value)}
                            className="bg-transparent text-base font-semibold text-gray-800 dark:text-gray-100 cursor-pointer focus:outline-none rounded-md py-1 pl-1 pr-1 hover:bg-gray-200 dark:hover:bg-gray-600 max-w-[160px]"
                            aria-label="Lokasyon seç"
                            title="Lokasyon seç"
                        >
                            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                        </select>
                        <button onClick={onManageLocations} title="Lokasyonları yönet" className="p-1 rounded-md text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                            <GearIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-2xl font-bold text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-700/50 px-3 py-1 rounded-lg">
                        <button
                            onClick={() => onNavigateYear(year - 1)}
                            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
                            aria-label="Önceki Yıl"
                        >
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                        <select
                            value={year}
                            onChange={(e) => onNavigateYear(parseInt(e.target.value, 10))}
                            className="min-w-[80px] text-center bg-transparent text-blue-600 dark:text-blue-400 text-2xl font-bold cursor-pointer focus:outline-none rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                            aria-label="Yıl seç"
                        >
                            {Array.from(new Set([2024, 2025, 2026, 2027, 2028, year - 1, year, year + 1]))
                                .sort((a, b) => a - b)
                                .map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button
                            onClick={() => onNavigateYear(year + 1)}
                            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
                            aria-label="Sonraki Yıl"
                        >
                            <ChevronRightIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <button
                        onClick={onCloudRefresh}
                        title={cloudStatus === 'connected' ? 'Buluta bağlı — yenile' : cloudStatus === 'syncing' ? 'Senkronize ediliyor…' : 'Çevrimdışı (yerel) — buluttan yenilemeyi dene'}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${cloudStatus === 'connected' ? 'bg-green-500' : cloudStatus === 'syncing' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`} />
                        <span className="text-gray-600 dark:text-gray-300">{cloudStatus === 'connected' ? 'Bulut' : cloudStatus === 'syncing' ? 'Senkron…' : 'Çevrimdışı'}</span>
                    </button>
                    <button onClick={onCopyYear} title="Bu yılın KPI'larını seçilen başka yıla kopyala" className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300">
                        <DocumentDuplicateIcon className="w-4 h-4" /> Yıla Kopyala
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <FilterDropdown label="Proses" options={uniqueProcesses} selected={filters.process} onChange={handleFilterChange('process')} />
                    <FilterDropdown label="Durum" options={uniqueStatuses} selected={filters.status} onChange={handleFilterChange('status')} />
                    <FilterDropdown label="Risk" options={uniqueRisks} selected={filters.risk} onChange={handleFilterChange('risk')} />
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={onAddKpi} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <PlusIcon className="w-4 h-4" /> KPI Ekle
                    </button>
                    <button onClick={() => onOpenModal('bulk-kpi')} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <ClipboardDocumentListIcon className="w-4 h-4" /> Toplu KPI Ekle
                    </button>
                    <input type="file" accept=".json" ref={fileInputRef} onChange={onImport} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                        <UploadIcon className="w-4 h-4" /> İçe Aktar
                    </button>
                    <input type="file" accept=".xlsx,.xls" ref={xlsxInputRef} onChange={onImportXlsx} className="hidden" />
                    <button onClick={() => xlsxInputRef.current?.click()} title="FR100 KPI Excel şablonundan KPI'ları içe aktar (hedef = HEDEF 1 YIL)" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                        <TableCellsIcon className="w-4 h-4" /> Excel'den Yükle
                    </button>
                    <button onClick={onExportXlsx} title="Antetli, biçimli KPI Excel raporu indir (lokasyon markasına göre)" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                        <TableCellsIcon className="w-4 h-4" /> {exportLabel} Excel
                    </button>
                    <button onClick={onExport} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                        <DownloadIcon className="w-4 h-4" /> Dışa Aktar (JSON)
                    </button>
                     <button onClick={onGeneratePdf} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                        <PdfIcon className="w-4 h-4" /> PDF Raporu
                    </button>
                     <button onClick={onOpenDofPanel} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                        <ClipboardCheckIcon className="w-4 h-4" /> DÖF Paneli
                    </button>
                     <button onClick={() => onOpenModal('action-items')} title="KPI'lar için Aksiyonlar (FR216)" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                        <ClipboardDocumentListIcon className="w-4 h-4" /> Aksiyonlar
                    </button>
                     <button onClick={() => onOpenModal('trend-chart')} title="Aylık trend grafiği (hedef çizgili)" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                        <ChartBarIcon className="w-4 h-4" /> Trend Grafiği
                    </button>
                     <button onClick={() => setSummaryOpen(!isSummaryOpen)} className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                        Özet Paneli {isSummaryOpen ? 'Kapat' : 'Aç'}
                    </button>
                </div>
            </div>
             <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Toplu İşlemler:</span>
                 <button onClick={onBulkDelete} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-yellow-800 bg-yellow-400 rounded-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-600 dark:text-white">
                    <TrashIcon className="w-4 h-4" /> Toplu Silme
                </button>
                 <button onClick={() => onOpenModal('appearance-settings')} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                    <PaintBrushIcon className="w-4 h-4" /> Görünüm Ayarları
                </button>
            </div>
        </header>
    );
};

export default Header;