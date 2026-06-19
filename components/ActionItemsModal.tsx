import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ActionItem, ActionPriority, Kpi } from '../types';
import Modal from './Modal';
import { PlusIcon, TrashIcon, TableCellsIcon, ClipboardCheckIcon } from './icons';

interface ActionItemsModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: ActionItem[];
    onChange: (items: ActionItem[]) => void;
    kpis: Kpi[];
    year: number;
    nextMeeting: string;
    onChangeNextMeeting: (v: string) => void;
    onExport: () => void;
    onStartDof: (kpiId: string, actionItemId: string) => void;
    focusKpiId?: string;
}

const opSym = (c: string) => (c === '>' ? '≥' : c === '<' ? '≤' : '=');

const buildKpiText = (kpi: Kpi): string =>
    `${kpi.kpi_adi} ${opSym(kpi.karsilastirma)}${kpi.yeni_yil_hedef} Ortalama: ${kpi.ortalama ?? 'N/A'}`;

const priorityFromKpi = (kpi: Kpi): ActionPriority =>
    kpi.durum === 'basarisiz' ? 'HIGH' : kpi.durum === 'marjinal' ? 'MEDIUM' : 'LOW';
const rankFromKpi = (kpi: Kpi): number =>
    kpi.durum === 'basarisiz' ? 5 : kpi.durum === 'marjinal' ? 3 : 2;

const newId = () => `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const makeFromKpi = (kpi: Kpi): ActionItem => ({
    id: newId(),
    kpiId: kpi.id,
    kpi: buildKpiText(kpi),
    rootCause: '',
    action: '',
    rank: rankFromKpi(kpi),
    priority: priorityFromKpi(kpi),
    owner: kpi.sorumlu || '',
    assigned: '',
    due: '',
    done: false,
    status: 0,
    notes: '',
});

const blankItem = (): ActionItem => ({
    id: newId(), kpi: '', rootCause: '', action: '', rank: 3, priority: 'MEDIUM',
    owner: '', assigned: '', due: '', done: false, status: 0, notes: '',
});

const PRIO_CLASS: Record<ActionPriority, string> = {
    LOW: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    HIGH: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

// FR216 risk matrisi: RANK (1-5) × Öncelik (High=3, Medium=2, Low=1)
// Skor: 1-4 Düşük (yeşil), 5-8 Orta (sarı), 9+ Yüksek (kırmızı)
const PRIO_WEIGHT: Record<ActionPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
export const actionRiskInfo = (rank: number, priority: ActionPriority): { score: number; level: string; cls: string } => {
    const score = (rank || 0) * (PRIO_WEIGHT[priority] || 1);
    if (score <= 4) return { score, level: 'Düşük', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' };
    if (score <= 8) return { score, level: 'Orta', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' };
    return { score, level: 'Yüksek', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' };
};

const inputCls = 'w-full bg-transparent px-1 py-1 text-xs rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:outline-none';

const ActionItemsModal: React.FC<ActionItemsModalProps> = ({ isOpen, onClose, items, onChange, kpis, year, nextMeeting, onChangeNextMeeting, onExport, onStartDof, focusKpiId }) => {
    const [rows, setRows] = useState<ActionItem[]>(items);
    const [showPicker, setShowPicker] = useState(false);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const didInit = useRef(false);

    // rows -> yukarı senkron (onChange'i deps'e koymuyoruz; sonsuz döngü olmasın)
    useEffect(() => { onChange(rows); /* eslint-disable-next-line */ }, [rows]);

    // İlgili KPI'dan açıldıysa o KPI için satır yoksa otomatik ekle
    useEffect(() => {
        if (didInit.current) return;
        didInit.current = true;
        if (focusKpiId && !rows.some(r => r.kpiId === focusKpiId)) {
            const k = kpis.find(x => x.id === focusKpiId);
            if (k) setRows(prev => [...prev, makeFromKpi(k)]);
        }
        // eslint-disable-next-line
    }, []);

    const update = (id: string, patch: Partial<ActionItem>) =>
        setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
    const remove = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

    const openPicker = () => {
        const off = new Set(kpis.filter(k => k.durum === 'basarisiz' || k.durum === 'marjinal').map(k => k.id));
        setPicked(off);
        setShowPicker(true);
    };
    const addPicked = () => {
        const existing = new Set(rows.map(r => r.kpiId).filter(Boolean));
        const toAdd = kpis.filter(k => picked.has(k.id) && !existing.has(k.id)).map(makeFromKpi);
        if (toAdd.length) setRows(prev => [...prev, ...toAdd]);
        setShowPicker(false);
    };
    const togglePick = (id: string) => setPicked(prev => {
        const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
    });

    // Henüz eklenmemiş hedef dışı (başarısız + marjinal) KPI'lar
    const offTarget = useMemo(() => {
        const existing = new Set(rows.map(r => r.kpiId).filter(Boolean));
        return kpis.filter(k => (k.durum === 'basarisiz' || k.durum === 'marjinal') && !existing.has(k.id));
    }, [kpis, rows]);
    const pullOffTarget = () => {
        if (!offTarget.length) return;
        setRows(prev => [...prev, ...offTarget.map(makeFromKpi)]);
    };

    const stats = useMemo(() => {
        const done = rows.filter(r => r.done || r.status >= 100).length;
        const high = rows.filter(r => r.priority === 'HIGH').length;
        return { total: rows.length, done, high };
    }, [rows]);

    const footer = (
        <>
            <button onClick={onClose} className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 px-4 py-2 bg-white dark:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500">Kapat</button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`KPI'lar için Aksiyonlar — FR216 (${year})`} size="7xl" footer={footer}>
            <div className="space-y-3">
                {/* Üst araç çubuğu */}
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={pullOffTarget} disabled={!offTarget.length}
                        title="Hedef dışı (başarısız + marjinal) KPI'ları tek tıkla aksiyon listesine çek"
                        className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md text-white ${offTarget.length ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'}`}>
                        <ClipboardCheckIcon className="w-4 h-4" /> Hedef Dışı Çek ({offTarget.length})
                    </button>
                    <button onClick={openPicker} title="KPI listesinden seçerek ekle (başarılılar dahil)" className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                        <ClipboardCheckIcon className="w-4 h-4" /> KPI'dan Ekle
                    </button>
                    <button onClick={() => setRows(prev => [...prev, blankItem()])} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600">
                        <PlusIcon className="w-4 h-4" /> Boş Satır
                    </button>
                    <button onClick={onExport} className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
                        <TableCellsIcon className="w-4 h-4" /> FR216 Excel
                    </button>
                    <div className="flex items-center gap-2 ml-auto text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Next Meeting:</span>
                        <input type="datetime-local" value={nextMeeting} onChange={(e) => onChangeNextMeeting(e.target.value)}
                            className="px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
                    </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    Toplam <strong>{stats.total}</strong> aksiyon · Tamamlanan <strong>{stats.done}</strong> · Yüksek öncelik <strong className="text-red-600 dark:text-red-400">{stats.high}</strong>
                </div>

                {/* KPI seçici */}
                {showPicker && (
                    <div className="border border-blue-300 dark:border-blue-700 rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">KPI seç (hedef dışı olanlar ön-seçili) — başarılı olanları da ekleyebilirsiniz</p>
                            <div className="flex gap-2">
                                <button onClick={addPicked} className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Seçilenleri Ekle ({picked.size})</button>
                                <button onClick={() => setShowPicker(false)} className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300">İptal</button>
                            </div>
                        </div>
                        <div className="max-h-52 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-1">
                            {kpis.map(k => {
                                const dotColor = k.durum === 'basarisiz' ? 'bg-red-500' : k.durum === 'marjinal' ? 'bg-yellow-500' : k.durum === 'basarili' ? 'bg-green-500' : 'bg-gray-400';
                                return (
                                    <label key={k.id} className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-white dark:hover:bg-gray-800 cursor-pointer">
                                        <input type="checkbox" checked={picked.has(k.id)} onChange={() => togglePick(k.id)} className="form-checkbox h-4 w-4 text-blue-600 rounded" />
                                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
                                        <span className="truncate"><span className="text-gray-400">{k.proses} —</span> {k.kpi_adi}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Tablo */}
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-[1100px] w-full text-xs">
                        <thead>
                            <tr className="bg-[#375623] text-white">
                                {['KPI', 'Root Cause', 'Action', 'RANK', 'PRIORITY', 'RISK', 'OWNER', 'ASSIGNED', 'DUE', 'DONE', 'STATUS %', 'NOTES', ''].map(h => (
                                    <th key={h} className="p-2 font-semibold text-left whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr><td colSpan={13} className="p-6 text-center text-gray-400">Henüz aksiyon yok. "KPI'dan Ekle" veya "Boş Satır" ile başlayın.</td></tr>
                            )}
                            {rows.map(r => (
                                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700 align-top">
                                    <td className="p-1 min-w-[220px]"><textarea rows={2} value={r.kpi} onChange={e => update(r.id, { kpi: e.target.value })} className={inputCls} /></td>
                                    <td className="p-1 min-w-[160px]"><textarea rows={2} value={r.rootCause} onChange={e => update(r.id, { rootCause: e.target.value })} className={inputCls} /></td>
                                    <td className="p-1 min-w-[160px]"><textarea rows={2} value={r.action} onChange={e => update(r.id, { action: e.target.value })} className={inputCls} /></td>
                                    <td className="p-1 w-14"><input type="number" min={1} max={5} value={r.rank} onChange={e => update(r.id, { rank: parseInt(e.target.value) || 0 })} className={`${inputCls} text-center`} /></td>
                                    <td className="p-1 w-24">
                                        <select value={r.priority} onChange={e => update(r.id, { priority: e.target.value as ActionPriority })} className={`${inputCls} font-semibold ${PRIO_CLASS[r.priority]}`}>
                                            <option value="LOW">LOW</option>
                                            <option value="MEDIUM">MEDIUM</option>
                                            <option value="HIGH">HIGH</option>
                                        </select>
                                    </td>
                                    <td className="p-1 w-20 text-center">
                                        {(() => { const ri = actionRiskInfo(r.rank, r.priority); return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${ri.cls}`} title={`RANK ${r.rank} × ${r.priority} = ${ri.score}`}>{ri.level} ({ri.score})</span>; })()}
                                    </td>
                                    <td className="p-1 w-28"><input value={r.owner} onChange={e => update(r.id, { owner: e.target.value })} className={inputCls} /></td>
                                    <td className="p-1 w-28"><input value={r.assigned} onChange={e => update(r.id, { assigned: e.target.value })} className={inputCls} /></td>
                                    <td className="p-1 w-32"><input type="date" value={r.due} onChange={e => update(r.id, { due: e.target.value })} className={inputCls} /></td>
                                    <td className="p-1 w-12 text-center"><input type="checkbox" checked={r.done} onChange={e => update(r.id, { done: e.target.checked })} className="form-checkbox h-4 w-4 text-green-600 rounded" /></td>
                                    <td className="p-1 w-20">
                                        <input type="number" min={0} max={100} value={r.status} onChange={e => update(r.id, { status: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })} className={`${inputCls} text-center`} />
                                        <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded mt-0.5"><div className="h-full bg-green-500 rounded" style={{ width: `${r.status}%` }} /></div>
                                    </td>
                                    <td className="p-1 min-w-[120px]"><textarea rows={2} value={r.notes} onChange={e => update(r.id, { notes: e.target.value })} className={inputCls} /></td>
                                    <td className="p-1 w-24 whitespace-nowrap">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button onClick={() => r.kpiId && onStartDof(r.kpiId, r.id)} disabled={!r.kpiId}
                                                title={r.kpiId ? '8D / DÖF başlat' : 'KPI bağlantısı gerekli'}
                                                className={`px-2 py-1 rounded text-[11px] font-bold border ${r.kpiId ? 'text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-300 dark:border-purple-700 dark:hover:bg-purple-900/30' : 'text-gray-300 border-gray-200 dark:border-gray-700 cursor-not-allowed'}`}>
                                                8D
                                            </button>
                                            <button onClick={() => remove(r.id)} title="Sil" className="p-1 text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-gray-400">8D istenirse satırdaki <strong>8D</strong> butonu ile (veya KPI Risk analizinden) başlatılır.</p>
            </div>
        </Modal>
    );
};

export default ActionItemsModal;
