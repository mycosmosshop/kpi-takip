// FIX: Added import for React hooks (useState, useEffect, useMemo) to resolve multiple 'Cannot find name' errors.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Kpi, ModalType, TooltipSettings, Status, Dof, AppearanceSettings } from '../types';
import { AYLAR, THEMES } from '../constants';
import { getStatusColorClasses, getSingleMonthStatus, isMonthActive } from '../utils/calculations';
import { PaperclipIcon, EditIcon, TrashIcon, FillRightIcon, CloseIcon, ChartBarIcon, StatusSuccessIcon, StatusFailureIcon, StatusMarginalIcon, GearIcon, PlusIcon, GripIcon, ExternalLinkIcon, ClipboardDocumentListIcon } from './icons';
import Trendline from './Trendline';

interface KpiTableProps {
    kpis: Kpi[];
    onOpenModal: (type: ModalType, data: any) => void;
    onUpdateValue: (kpiId: string, month: string, value: number | null) => void;
    onUpdateOnceki: (kpiId: string, value: number | null) => void;
    onReorderKpis: (draggedId: string, targetId: string) => void;
    onDeleteKpi: (kpiId: string) => void;
    onDeleteKpis: (kpiIds: string[]) => void;
    recentlyUpdatedKpi: string | null;
    year: number;
    tooltipSettings: TooltipSettings;
    appearanceSettings: AppearanceSettings;
}

type MultiSelectedCell = {
    kpiId: string;
    month: string;
};

const EditableCell: React.FC<{ kpi: Kpi; value: number | null; onChange: (newValue: number | null) => void; onFillRight: (newValue: number) => void; disabled: boolean; isSelected: boolean; }> = ({ kpi, value, onChange, onFillRight, disabled, isSelected }) => {
    const [editingValue, setEditingValue] = useState(value?.toString() ?? '');

    useEffect(() => {
        setEditingValue(value?.toString() ?? '');
    }, [value]);

    const handleBlur = () => {
        if(disabled) return;
        const numValue = parseFloat(editingValue);
        const finalValue = isNaN(numValue) ? null : numValue;
        if (finalValue !== value) {
            onChange(finalValue);
        }
    };

    const handleFill = () => {
        if(disabled) return;
        const numValue = parseFloat(editingValue);
        if (!isNaN(numValue)) {
            onFillRight(numValue);
            // also commit the current cell's value
            if (numValue !== value) {
                onChange(numValue);
            }
        }
    };

    const status = getSingleMonthStatus(kpi, value);

    const renderStatusIcon = () => {
        if (value === null || disabled) return null;
        switch (status) {
            case 'basarili':
                return <StatusSuccessIcon className="w-4 h-4 text-green-500" title="Hedef Başarılı" />;
            case 'basarisiz':
                return <StatusFailureIcon className="w-4 h-4 text-red-500" title="Hedef Başarısız" />;
            case 'marjinal':
                return <StatusMarginalIcon className="w-4 h-4 text-yellow-500" title="Hedef Eşit" />;
            default:
                return null;
        }
    };
    
    const cellClasses = [
        'relative', 'group', 'flex', 'items-center', 'justify-center', 'h-full'
    ];
    if(isSelected) {
        cellClasses.push('bg-blue-200', 'dark:bg-blue-800');
    }


    return (
        <div className={cellClasses.join(' ')}>
             <div className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none">
                {renderStatusIcon()}
            </div>
            <input
                type="number"
                step="0.1"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={handleBlur}
                disabled={disabled}
                className={`w-full bg-transparent text-center focus:ring-1 focus:ring-blue-500 focus:outline-none rounded pl-5 h-full ${disabled ? 'cursor-not-allowed text-gray-400 dark:text-gray-500' : ''}`}
                onClick={(e) => e.stopPropagation()} // Prevent cell selection when clicking input
            />
            {editingValue && !disabled && (
                <button
                    onClick={handleFill}
                    className="absolute right-0 top-1/2 -translate-y-1/2 -mr-1 p-1 text-gray-400 hover:text-blue-500 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 transition-opacity"
                    title="Sonraki boş ayları bu değerle doldur"
                >
                    <FillRightIcon className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

const OncekiCell: React.FC<{ value: number | null; onChange: (v: number | null) => void }> = ({ value, onChange }) => {
    const [v, setV] = useState(value?.toString() ?? '');
    useEffect(() => { setV(value?.toString() ?? ''); }, [value]);
    const commit = () => {
        const n = parseFloat(v);
        const fv = isNaN(n) ? null : n;
        if (fv !== value) onChange(fv);
    };
    return (
        <input
            type="number" step="any" value={v}
            onChange={(e) => setV(e.target.value)} onBlur={commit}
            onClick={(e) => e.stopPropagation()}
            placeholder="-"
            className="w-full bg-transparent text-center rounded px-1 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            title="Önceki yıl gerçekleşen (elle düzenlenebilir)"
        />
    );
};

interface KpiTableRowProps {
    kpi: Kpi;
    onOpenModal: (type: ModalType, data: any) => void;
    onUpdateValue: (month: string, value: number | null) => void;
    onUpdateOnceki: (value: number | null) => void;
    onDelete: () => void;
    onCellSelect: (kpiId: string, month: string, isMulti: boolean) => void;
    onFillRight: (month: string, value: number) => void;
    isRowSelected: boolean;
    onRowSelect: () => void;
    selectedCols: string[];
    individualSelectionSet: Set<string>;
    isRecentlyUpdated: boolean;
    showTrendlines: boolean;
    showSonGuncelleme: boolean;
    processNo: number;
    year: number;
    onMouseMove: (event: React.MouseEvent, kpi: Kpi) => void;
    onMouseLeave: () => void;
    themeClasses: Record<string, string>;
    onRowDragStart: (id: string) => void;
    onRowDrop: (id: string) => void;
}


const KpiTableRow: React.FC<KpiTableRowProps> = ({ kpi, onOpenModal, onUpdateValue, onUpdateOnceki, onDelete, onCellSelect, onFillRight, isRowSelected, onRowSelect, selectedCols, individualSelectionSet, isRecentlyUpdated, showTrendlines, showSonGuncelleme, processNo, year, onMouseMove, onMouseLeave, themeClasses, onRowDragStart, onRowDrop }) => {
    const statusIcons: { [key: string]: string } = { 'basarili': '✓', 'marjinal': '≈', 'basarisiz': '✗', 'n/a': '-' };
    const baseRowColor = getStatusColorClasses(kpi.durum);
    const finalRowColor = isRowSelected ? 'bg-blue-200 dark:bg-blue-800' : baseRowColor;
    const highlightColor = 'bg-sky-200 dark:bg-sky-700';
    const rowBgClass = isRecentlyUpdated ? highlightColor : finalRowColor;

    const { monthlyActiveDofs, generalActiveDof } = useMemo(() => {
        const monthlyDofs = new Map<string, Dof>();
        let generalDof: Dof | undefined = undefined;

        const activeDofs = kpi.dof.filter(d => d.durum !== 'Tamamlandı' && d.start_date);

        for (const dof of activeDofs) {
            let isMonthly = false;
            for (let i = 0; i < AYLAR.length; i++) {
                const monthStr = String(i + 1).padStart(2, '0');
                const monthlyDateStr = `${year}-${monthStr}-02`;
                if (dof.start_date === monthlyDateStr) {
                    monthlyDofs.set(AYLAR[i], dof);
                    isMonthly = true;
                    break;
                }
            }
            if (!isMonthly && !generalDof) { // Take the first general DOF found
                generalDof = dof;
            }
        }
        return { monthlyActiveDofs: monthlyDofs, generalActiveDof: generalDof };
    }, [kpi.dof, year]);

    return (
        <tr
            className={`group transition-colors duration-1000 ease-out ${rowBgClass}`}
            onMouseMove={(e) => onMouseMove(e, kpi)}
            onMouseLeave={onMouseLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onRowDrop(kpi.id); }}
        >
            <td className={`sticky-col p-2 border-b border-gray-200 dark:border-gray-700 text-center w-[48px] ${themeClasses.tdSticky}`}>
                <div className="flex items-center justify-center gap-1">
                    <span
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); onRowDragStart(kpi.id); }}
                        title="Sürükleyip sırayı değiştir"
                        className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
                    >
                        <GripIcon className="w-4 h-4" />
                    </span>
                    <input type="checkbox" checked={isRowSelected} onChange={onRowSelect} className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"/>
                </div>
            </td>
            <td className={`sticky-col-2 p-2 border-b border-gray-200 dark:border-gray-700 text-center font-bold w-[48px] ${themeClasses.tdSticky}`}>{statusIcons[kpi.durum]}</td>
            <td className={`sticky-col-3 p-2 border-b border-gray-200 dark:border-gray-700 w-[160px] ${themeClasses.tdSticky}`} title={kpi.proses}>
                <div className="process-col"><span className="text-gray-400 dark:text-gray-500 font-semibold mr-1">{processNo})</span>{kpi.proses}</div>
            </td>
            <td className={`sticky-col-4 p-2 border-b border-gray-200 dark:border-gray-700 font-semibold w-[256px] ${themeClasses.tdSticky}`}>
                 <span onClick={() => onOpenModal('detail', kpi)} className="kpi-name cursor-pointer hover:underline text-blue-600 dark:text-blue-400" title={kpi.kpi_adi}>
                    {kpi.kpi_adi}
                </span>
            </td>
            <td className={`p-1 border-b border-gray-200 dark:border-gray-700 text-center w-[120px] ${themeClasses.tdAvg}`}><OncekiCell value={kpi.onceki_yil_gerceklesen} onChange={onUpdateOnceki} /></td>
            <td className={`p-2 border-b border-gray-200 dark:border-gray-700 text-center ${themeClasses.tdAvg}`}>{kpi.yeni_yil_hedef} ({kpi.karsilastirma})</td>
            <td className={`p-2 border-b border-gray-200 dark:border-gray-700 text-center ${themeClasses.tdAvg}`}>{kpi.birim}</td>
            <td className={`p-2 border-b border-gray-200 dark:border-gray-700 text-center ${themeClasses.tdAvg}`}>
                 <button
                    onClick={() => onOpenModal('evidence', kpi)}
                    className="relative text-blue-500 hover:text-blue-700 inline-block p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                    title="Kanıt dosyalarını görüntüle"
                >
                    <PaperclipIcon className="w-5 h-5"/>
                    {kpi.kanit_dosyalari && kpi.kanit_dosyalari.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                            {kpi.kanit_dosyalari.length}
                        </span>
                    )}
                </button>
            </td>
            <td className={`p-1 border-b border-gray-200 dark:border-gray-700 bg-inherit text-blue-500 dark:text-blue-400 ${themeClasses.tdAvg}`}>
                {showTrendlines && <Trendline data={AYLAR.map(ay => kpi.aylik[ay])} />}
            </td>
            {AYLAR.map((ay, monthIndex) => {
                const isAktif = isMonthActive(kpi, monthIndex);
                const isIndividuallySelected = individualSelectionSet.has(`${kpi.id}|${ay}`);
                const isColSelected = selectedCols.includes(ay);
                const isSelected = (isRowSelected || isColSelected || isIndividuallySelected) && isAktif;
                
                const activeDof = monthlyActiveDofs.get(ay);
                
                const cellClasses = [
                    'p-0', 'border-b', 'border-gray-200', 'dark:border-gray-700',
                    'text-center', 'transition-colors', 'duration-150', 'relative', 'group'
                ];
    
                if (isAktif) {
                    cellClasses.push('cursor-pointer');
                    if (isSelected) {
                        cellClasses.push('ring-2', 'ring-blue-500');
                    }
                } else {
                    cellClasses.push(
                        'cursor-not-allowed', 'inactive-month-pattern'
                    );
                }

                return (
                    <td key={ay} className={cellClasses.join(' ')}
                        onClick={(e) => isAktif && onCellSelect(kpi.id, ay, e.ctrlKey || e.metaKey)}
                        data-month={ay}
                    >
                        {isAktif && (
                            <div className="absolute top-0.5 right-0.5 z-10">
                                {activeDof ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent cell selection
                                            onOpenModal('dof', { ...activeDof, kpiId: kpi.id, year: year, returnTo: 'table' });
                                        }}
                                        className="px-1 py-0 text-[9px] font-bold leading-tight rounded bg-purple-600 text-white hover:bg-purple-700 animate-dof-icon-pulse"
                                        title={`Aktif 8D/DÖF: ${activeDof.problemTanimi || activeDof.aksiyon}`}
                                    >
                                        8D
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenModal('action-items', { focusKpiId: kpi.id, focusMonth: ay });
                                        }}
                                        className="p-0.5 text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-300 opacity-40 group-hover:opacity-100 transition-opacity"
                                        title="Bu KPI'nın FR216 aksiyonları (gerekirse 8D başlat)"
                                    >
                                        <ClipboardDocumentListIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                        <EditableCell kpi={kpi} value={kpi.aylik[ay]} onChange={(val) => onUpdateValue(ay, val)} onFillRight={(val) => onFillRight(ay, val)} disabled={!isAktif} isSelected={isSelected} />
                    </td>
                );
            })}
            <td className={`p-2 border-b border-gray-200 dark:border-gray-700 text-center font-bold relative group ${themeClasses.tdAvg}`}>
                <span>{kpi.ortalama ?? 'N/A'}</span>
                <div className="absolute top-0.5 right-0.5 z-10">
                    {generalActiveDof ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenModal('dof', { ...generalActiveDof, kpiId: kpi.id, year: year, returnTo: 'table' });
                            }}
                            className="px-1 py-0 text-[9px] font-bold leading-tight rounded bg-purple-600 text-white hover:bg-purple-700 animate-dof-icon-pulse"
                            title={`Aktif 8D/DÖF: ${generalActiveDof.problemTanimi || generalActiveDof.aksiyon}`}
                        >
                            8D
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenModal('action-items', { focusKpiId: kpi.id });
                            }}
                            className="p-0.5 text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-300 opacity-40 group-hover:opacity-100 transition-opacity"
                            title="Bu KPI'nın FR216 aksiyonları (gerekirse 8D başlat)"
                        >
                            <ClipboardDocumentListIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </td>
            {showSonGuncelleme && (
                <td className={`sticky-col-right-2 p-2 border-b border-gray-200 dark:border-gray-700 text-center text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ${themeClasses.tdAvg}`}>
                    {kpi.son_guncelleme}
                </td>
            )}
            <td className={`sticky-col-right p-2 border-b border-gray-200 dark:border-gray-700 text-center ${themeClasses.tdAvg}`}>
                <button onClick={() => onOpenModal('kpi-source', kpi)} title={kpi.kaynak ? `Bağlı kaynak: ${kpi.kaynak.type === 'egitim' ? 'Eğitim' : 'CMMS'} · ${kpi.kaynak.metric}` : 'Dış kaynaktan veri çek (Bakım/Eğitim)'} className={`p-1 ${kpi.kaynak ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-gray-600'}`}><ExternalLinkIcon className="w-5 h-5"/></button>
                <button onClick={() => onOpenModal('kpi', kpi)} className="p-1 text-blue-600 hover:text-blue-800"><EditIcon className="w-5 h-5"/></button>
                <button onClick={onDelete} className="p-1 text-red-600 hover:text-red-800"><TrashIcon className="w-5 h-5"/></button>
            </td>
        </tr>
    );
};

const KpiTable: React.FC<KpiTableProps> = ({ kpis, onOpenModal, onUpdateValue, onUpdateOnceki, onReorderKpis, onDeleteKpi, onDeleteKpis, recentlyUpdatedKpi, year, tooltipSettings, appearanceSettings }) => {
    const showSonGuncelleme = appearanceSettings.showSonGuncelleme !== false;
    // Satır sürükle-bırak
    const draggedId = useRef<string | null>(null);
    const handleRowDragStart = (id: string) => { draggedId.current = id; };
    const handleRowDrop = (id: string) => { if (draggedId.current) onReorderKpis(draggedId.current, id); draggedId.current = null; };
    // Sağ tık ile pan (yatay/dikey kaydırma)
    const scrollRef = useRef<HTMLDivElement>(null);
    const pan = useRef({ active: false, startX: 0, startY: 0, left: 0, top: 0, moved: false });
    const onPanDown = (e: React.MouseEvent) => {
        if (e.button !== 2) return;
        const el = scrollRef.current; if (!el) return;
        pan.current = { active: true, startX: e.clientX, startY: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
    };
    const onPanMove = (e: React.MouseEvent) => {
        if (!pan.current.active) return;
        const el = scrollRef.current; if (!el) return;
        const dx = e.clientX - pan.current.startX, dy = e.clientY - pan.current.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.current.moved = true;
        el.scrollLeft = pan.current.left - dx;
        el.scrollTop = pan.current.top - dy;
    };
    const onPanEnd = () => { pan.current.active = false; };
    const onCtxMenu = (e: React.MouseEvent) => { if (pan.current.moved) { e.preventDefault(); pan.current.moved = false; } };
    const [individuallySelectedCells, setIndividuallySelectedCells] = useState<MultiSelectedCell[]>([]);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [selectedCols, setSelectedCols] = useState<string[]>([]);
    const [bulkValue, setBulkValue] = useState('');
    const [showTrendlines, setShowTrendlines] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<{ 
        kpi: Kpi; 
        x: number; 
        y: number;
        activeMonthData?: {
            month: string;
            value: number | null;
            status: Status;
        }
    } | null>(null);
    
    const themeClasses = THEMES[appearanceSettings.theme];
    const fontClasses = `text-${appearanceSettings.fontSize} font-${appearanceSettings.fontWeight}`;

    // Süreçleri ilk görünme sırasına göre numaralandır
    const processNumbers = useMemo(() => {
        const map = new Map<string, number>();
        let n = 0;
        kpis.forEach(k => { if (!map.has(k.proses)) map.set(k.proses, ++n); });
        return map;
    }, [kpis]);

    const totalSelectedCells = useMemo(() => {
        const selectionSet = new Set<string>(); // Use string "kpiId|month" to ensure uniqueness

        individuallySelectedCells.forEach(cell => selectionSet.add(`${cell.kpiId}|${cell.month}`));

        selectedRows.forEach(kpiId => {
            AYLAR.forEach(month => selectionSet.add(`${kpiId}|${month}`));
        });

        selectedCols.forEach(month => {
            kpis.forEach(kpi => selectionSet.add(`${kpi.id}|${month}`));
        });
        
        // Final filter to ensure no disabled cells are in the selection
        return Array.from(selectionSet).map(str => {
            const [kpiId, month] = str.split('|');
            return { kpiId, month };
        }).filter(cell => {
             const kpi = kpis.find(k => k.id === cell.kpiId);
             if (!kpi) return false;
             const monthIndex = AYLAR.indexOf(cell.month);
             return isMonthActive(kpi, monthIndex);
        });

    }, [individuallySelectedCells, selectedRows, selectedCols, kpis]);

    const individualSelectionSet = useMemo(() => new Set(individuallySelectedCells.map(c => `${c.kpiId}|${c.month}`)), [individuallySelectedCells]);

    const selectionCount = totalSelectedCells.length;

    const handleCellSelect = (kpiId: string, month: string, isMulti: boolean) => {
        setIndividuallySelectedCells(prev => {
            const cellIndex = prev.findIndex(cell => cell.kpiId === kpiId && cell.month === month);
            const isSelected = cellIndex > -1;

            if (isMulti) {
                if (isSelected) {
                    return prev.filter((_, index) => index !== cellIndex);
                } else {
                    return [...prev, { kpiId, month }];
                }
            } else {
                 if (isSelected && prev.length === 1) {
                    return [];
                }
                return [{ kpiId, month }];
            }
        });
    };
    
    const handleRowSelect = (kpiId: string) => {
        setSelectedRows(prev => prev.includes(kpiId) ? prev.filter(id => id !== kpiId) : [...prev, kpiId]);
    };
    
    const handleSelectAllRows = () => {
        if (selectedRows.length === kpis.length) {
            setSelectedRows([]);
        } else {
            setSelectedRows(kpis.map(k => k.id));
        }
    };
    
    const handleColSelect = (month: string) => {
        // FIX: Corrected typo 'm' to 'month'.
        setSelectedCols(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]);
    };

    // FIX: Added missing handleClearSelection function to manage selection state.
    const handleClearSelection = () => {
        setIndividuallySelectedCells([]);
        setSelectedRows([]);
        setSelectedCols([]);
        setBulkValue('');
    };

    const handleBulkUpdate = () => {
        const numValue = parseFloat(bulkValue);
        if (isNaN(numValue)) {
            alert("Lütfen geçerli bir sayı girin.");
            return;
        }

        totalSelectedCells.forEach(cell => {
            onUpdateValue(cell.kpiId, cell.month, numValue);
        });
        
        handleClearSelection();
    };
    
    const handleBulkDelete = () => {
        totalSelectedCells.forEach(cell => {
            onUpdateValue(cell.kpiId, cell.month, null);
        });
        handleClearSelection();
    };
    
    const handleBulkDeleteRows = () => {
        if (selectedRows.length > 0) {
            onDeleteKpis(selectedRows);
            handleClearSelection();
        }
    };

    const handleFillNext = () => {
        const numValue = parseFloat(bulkValue);
        if (isNaN(numValue)) {
            alert("Lütfen geçerli bir sayı girin.");
            return;
        }

        const updates = new Map<string, Set<string>>();

        totalSelectedCells.forEach(cell => {
            const kpi = kpis.find(k => k.id === cell.kpiId);
            if (!kpi) return;

            if (!updates.has(cell.kpiId)) {
                updates.set(cell.kpiId, new Set());
            }
            const kpiUpdates = updates.get(cell.kpiId)!;

            kpiUpdates.add(cell.month);

            const currentMonthIndex = AYLAR.indexOf(cell.month);
            for (let i = currentMonthIndex + 1; i < AYLAR.length; i++) {
                const monthToFill = AYLAR[i];
                if (kpi.aylik[monthToFill] === null && isMonthActive(kpi, i)) {
                    kpiUpdates.add(monthToFill);
                }
            }
        });
        
        updates.forEach((months, kpiId) => {
            months.forEach(month => {
                onUpdateValue(kpiId, month, numValue);
            });
        });

        handleClearSelection();
    };

    const handleFillRight = (kpiId: string, currentMonth: string, value: number) => {
        const kpi = kpis.find(k => k.id === kpiId);
        if (!kpi) return;

        const currentMonthIndex = AYLAR.indexOf(currentMonth);
        for (let i = currentMonthIndex + 1; i < AYLAR.length; i++) {
            const monthToFill = AYLAR[i];
            if (kpi.aylik[monthToFill] === null && isMonthActive(kpi, i)) {
                onUpdateValue(kpiId, monthToFill, value);
            }
        }
    };
    
     const handleRowMouseMove = (event: React.MouseEvent, kpi: Kpi) => {
        let monthData: typeof activeTooltip.activeMonthData = undefined;

        const targetCell = (event.target as HTMLElement).closest('td');
        const month = targetCell?.dataset.month;

        if (month) {
            const value = kpi.aylik[month];
            const status = getSingleMonthStatus(kpi, value);
            monthData = { month, value, status };
        }

        setActiveTooltip({ kpi: kpi, x: event.clientX, y: event.clientY, activeMonthData: monthData });
    };

    const handleRowMouseLeave = () => {
        setActiveTooltip(null);
    };

    return (
        <>
            {activeTooltip && tooltipSettings.goster && (
                <div
                    className="fixed z-[100] w-max max-w-xs p-3 text-white text-sm rounded-md shadow-lg pointer-events-none space-y-1"
                    style={{
                        backgroundColor: `rgba(31, 41, 55, ${tooltipSettings.opacity})`,
                        left: `${activeTooltip.x + 15}px`,
                        top: `${activeTooltip.y + 15}px`,
                    }}
                >
                    <p className="font-bold text-base mb-2 border-b border-white/20 pb-1">{activeTooltip.kpi.kpi_adi}</p>
                    
                    {tooltipSettings.aktif_ay_degeri && activeTooltip.activeMonthData && (
                        <div className="p-2 my-2 bg-black/20 rounded-md">
                            <p className="font-bold">{activeTooltip.activeMonthData.month} Ayı Değeri</p>
                            <p><strong>Değer:</strong> {activeTooltip.activeMonthData.value ?? 'N/A'}</p>
                            <p><strong>Durum:</strong> {activeTooltip.activeMonthData.status}</p>
                        </div>
                    )}
                    
                    {tooltipSettings.hedef && <p><strong>Hedef:</strong> {activeTooltip.kpi.yeni_yil_hedef} ({activeTooltip.kpi.karsilastirma})</p>}
                    {tooltipSettings.durum && <p><strong>Durum:</strong> {activeTooltip.kpi.durum}</p>}
                    {tooltipSettings.sorumlu && <p><strong>Sorumlu:</strong> {activeTooltip.kpi.sorumlu || 'N/A'}</p>}
                    {tooltipSettings.hesap_metodu && <p><strong>Hesap:</strong> {activeTooltip.kpi.hesap_metodu}</p>}
                    {tooltipSettings.RPN && <p><strong>RPN:</strong> {activeTooltip.kpi.risk.RPN} (Eşik: {activeTooltip.kpi.risk.esik})</p>}
                    {tooltipSettings.son_guncelleme && <p><strong>Son Güncelleme:</strong> {activeTooltip.kpi.son_guncelleme}</p>}
                </div>
            )}
            <div
                ref={scrollRef}
                onMouseDown={onPanDown}
                onMouseMove={onPanMove}
                onMouseUp={onPanEnd}
                onMouseLeave={onPanEnd}
                onContextMenu={onCtxMenu}
                title="İpucu: tabloyu sağ tık ile tutup sürükleyerek kaydırabilirsiniz"
                className="kpi-table overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md max-h-[70vh]"
            >
                {selectionCount > 0 && (
                    <div className="sticky top-0 z-30 bg-blue-100 dark:bg-blue-900/80 p-2 flex flex-wrap items-center gap-2 backdrop-blur-sm border-b-2 border-blue-300 dark:border-blue-700">
                        <span className="font-semibold text-sm text-blue-800 dark:text-blue-200">{selectionCount} hücre seçildi</span>
                        <input
                            type="number"
                            placeholder="Değer girin..."
                            value={bulkValue}
                            onChange={(e) => setBulkValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleBulkUpdate()}
                            className="px-2 py-1 text-sm w-28 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm"
                        />
                        <button onClick={handleBulkUpdate} className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                            Tümünü Doldur
                        </button>
                        <button onClick={handleFillNext} className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
                            Sonrakileri Doldur
                        </button>
                        <button onClick={handleBulkDelete} className="px-3 py-1 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700">
                            Hücre Verisini Sil
                        </button>
                        {selectedRows.length > 0 && (
                             <button onClick={handleBulkDeleteRows} className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">
                                {selectedRows.length} Satırı Sil
                            </button>
                        )}
                        <button onClick={handleClearSelection} className="p-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" title="Seçimi Temizle">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
                <table className={`min-w-full table-fixed ${fontClasses}`}>
                    <thead className="sticky-header">
                        <tr className={themeClasses.theadRowBg}>
                            <th className={`sticky-col z-30 text-center w-[48px] ${themeClasses.th} ${themeClasses.thSticky}`}>
                                <input type="checkbox"
                                    checked={kpis.length > 0 && selectedRows.length === kpis.length}
                                    onChange={handleSelectAllRows}
                                    className="form-checkbox h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                            </th>
                            <th className={`sticky-col-2 z-30 w-[48px] ${themeClasses.th} ${themeClasses.thSticky}`}></th>
                            <th className={`sticky-col-3 z-30 text-left w-[160px] ${themeClasses.th} ${themeClasses.thSticky}`}>Proses</th>
                            <th className={`sticky-col-4 z-30 text-left w-[256px] ${themeClasses.th} ${themeClasses.thSticky}`}>KPI Adı</th>
                            <th className={`w-[120px] ${themeClasses.th} ${themeClasses.thStatic}`}>Önceki Yıl</th>
                            <th className={`w-[120px] ${themeClasses.th} ${themeClasses.thStatic}`}>Hedef</th>
                            <th className={`w-[80px] ${themeClasses.th} ${themeClasses.thStatic}`}>Birim</th>
                            <th className={`w-[80px] ${themeClasses.th} ${themeClasses.thStatic}`}>Kanıt</th>
                            <th className={`w-[112px] text-center ${themeClasses.th} ${themeClasses.thStatic}`} title="Trend">
                                <button
                                    onClick={() => setShowTrendlines(prev => !prev)}
                                    className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 inline-flex items-center"
                                    aria-label="Trend çizgilerini göster/gizle"
                                >
                                    <ChartBarIcon className="w-5 h-5" />
                                </button>
                            </th>
                            {AYLAR.map(ay => {
                                const isColSelected = selectedCols.includes(ay);
                                return (
                                    <th key={ay}
                                        className={`w-[112px] cursor-pointer transition-colors ${themeClasses.th} ${isColSelected ? themeClasses.thMonthSelected : themeClasses.thMonth}`}
                                        onClick={() => handleColSelect(ay)}
                                    >{ay}</th>
                                );
                            })}
                            <th className={`w-[150px] ${themeClasses.th} ${themeClasses.thStatic}`}>Ortalama</th>
                            {showSonGuncelleme && <th className={`w-[160px] sticky-col-right-2 ${themeClasses.th} ${themeClasses.thStatic}`}>Son Güncelleme</th>}
                            <th className={`w-[100px] sticky-col-right ${themeClasses.th} ${themeClasses.thStatic}`}>İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {kpis.map(kpi => (
                            <KpiTableRow
                                key={kpi.id}
                                kpi={kpi}
                                onOpenModal={onOpenModal}
                                onUpdateValue={(month, value) => onUpdateValue(kpi.id, month, value)}
                                onUpdateOnceki={(value) => onUpdateOnceki(kpi.id, value)}
                                onDelete={() => onDeleteKpi(kpi.id)}
                                onCellSelect={handleCellSelect}
                                onFillRight={(month, value) => handleFillRight(kpi.id, month, value)}
                                isRowSelected={selectedRows.includes(kpi.id)}
                                onRowSelect={() => handleRowSelect(kpi.id)}
                                selectedCols={selectedCols}
                                individualSelectionSet={individualSelectionSet}
                                isRecentlyUpdated={kpi.id === recentlyUpdatedKpi}
                                showTrendlines={showTrendlines}
                                showSonGuncelleme={showSonGuncelleme}
                                processNo={processNumbers.get(kpi.proses) || 0}
                                year={year}
                                onMouseMove={handleRowMouseMove}
                                onMouseLeave={handleRowMouseLeave}
                                themeClasses={themeClasses}
                                onRowDragStart={handleRowDragStart}
                                onRowDrop={handleRowDrop}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default KpiTable;