import React, { useRef, useMemo } from 'react';
import { Dof, Kpi, FiveWhyAnalysis, CorrectiveAction, Status, DofStatus, FtaNode, FaultTreeAnalysis, ParetoAnalysisData } from '../types';
import Modal from './Modal';
import { UserIcon, CalendarIcon, LightBulbIcon, ClipboardCheckIcon, WrenchScrewdriverIcon, ChartBarIcon, PdfIcon, CheckCircleIcon, ClipboardDocumentListIcon } from './icons';
import { getStatusColorClasses, getSingleMonthStatus } from '../utils/calculations';
import { AYLAR } from '../constants';
import ScatterPlotMatrix from './ScatterPlotMatrix';

interface DofReportViewProps {
    isOpen: boolean;
    onClose: () => void;
    dof: Dof;
    kpi: Kpi;
}
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon, children, className = '' }) => (
    <div className={`mt-6 no-break ${className}`}>
        <div className="flex items-center gap-3 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
            {icon}
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{title}</h3>
        </div>
        <div className="p-1">{children}</div>
    </div>
);


const FishboneReport: React.FC<{ data: FiveWhyAnalysis['fishbone'] }> = ({ data }) => {
    if (!data || !data.problem) {
        return <p className="text-sm text-gray-500 dark:text-gray-400 italic p-4 text-center">Balık kılçığı diyagramı oluşturulmamış.</p>;
    }
    return (
        <div className="fishbone-diagram" style={{ minHeight: '500px', padding: '1rem 0' }}>
            <div className="category-grid">
                {data.categories.map((cat) => (
                    <div key={cat.name} className="category-card !shadow-none !border-gray-300 dark:!border-gray-600">
                         <h4 className="font-bold text-center text-sm text-blue-600 dark:text-blue-400">{cat.name}</h4>
                         <ul className="text-xs space-y-1 mt-2">
                            {cat.causes.map((cause, causeIdx) => (
                                <li key={causeIdx} className="p-1 rounded bg-gray-100 dark:bg-gray-600/50 break-words">
                                    {cause}
                                </li>
                            ))}
                            {cat.causes.length === 0 && <li className="text-gray-400 italic text-center text-xs">Neden yok</li>}
                        </ul>
                    </div>
                ))}
            </div>
            <div className="spine"></div>
            <div className="head !w-[180px] !p-2 !pl-8">
                <p className="text-center font-bold text-sm">{data.problem}</p>
            </div>
        </div>
    );
};

const FtaShape: React.FC<{ node: FtaNode, className?: string }> = ({ node, className }) => {
    const combinedClassName = `fta-shape ${className || ''}`;

    if (node.type === 'gate') {
        switch (node.gateType) {
            case 'AND': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-and`}><path d="M0 30 V0 H40 V30 A20 20 0 0 1 0 30Z" strokeWidth="2" /></svg>;
            case 'OR': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-or`}><path d="M0 30 Q20 25 40 30 V0 Q20 5 0 0 Z" strokeWidth="2" /></svg>;
            case 'XOR': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-xor`}><path d="M0 30 Q20 25 40 30 V0 Q20 5 0 0 Z" strokeWidth="2" /><path d="M0 26 Q20 21 40 26" strokeWidth="2" fill="none" /></svg>;
            case 'PRIORITY_AND': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-priority-and`}><path d="M0 30 V0 H40 V30 A20 20 0 0 1 0 30Z" strokeWidth="2" /><line x1="5" y1="15" x2="35" y2="15" stroke="currentColor" strokeWidth="1.5" /></svg>;
            case 'INHIBIT': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-inhibit`}><path d="M10 0 L30 0 L40 15 L30 30 L10 30 L0 15 Z" strokeWidth="2" /></svg>;
        }
    }
    if (node.type === 'event') {
        switch (node.eventType) {
            case 'BASIC': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-basic`}><circle cx="20" cy="15" r="14" strokeWidth="2" /></svg>;
            case 'UNDEVELOPED': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-undeveloped`}><path d="M20 0 L40 15 L20 30 L0 15 Z" strokeWidth="2" /></svg>;
            case 'INTERMEDIATE': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-intermediate`}><rect x="2" y="2" width="36" height="26" rx="2" strokeWidth="2" /></svg>;
            case 'CONDITIONAL': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-conditional`}><ellipse cx="20" cy="15" rx="18" ry="12" strokeWidth="2" /></svg>;
            case 'HOUSE': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-house`}><path d="M0 15 L20 0 L40 15 V30 H0 Z" strokeWidth="2" /></svg>;
            case 'TRANSFER': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-transfer`}><path d="M20 5 L35 25 H5 Z" strokeWidth="2" /></svg>;
        }
    }
    return <div className="fta-shape bg-gray-200 border border-gray-400"></div>;
};

const FtaNodeReport: React.FC<{ node: FtaNode }> = ({ node }) => {
    return (
        <div className="fta-node" style={{ left: node.x, top: node.y }}>
            <div className="fta-node-content !cursor-default" data-type={node.type}>
                <FtaShape node={node} />
                <p className="text-xs text-center break-words">{node.text}</p>
                 {typeof node.calculatedP === 'number' && (
                  <p className="fta-calculated-p !text-white !bg-black/50" title="Hesaplanan Olasılık">P={(node.calculatedP).toExponential(2)}</p>  
                )}
            </div>
        </div>
    );
};

const FtaReport: React.FC<{ data?: FiveWhyAnalysis['fta'] }> = ({ data }) => {
    const hasAnalysisStarted = data && data.topEvent && (
        (data.topEvent.children && data.topEvent.children.length > 0) ||
        (data.floatingNodes && data.floatingNodes.length > 0)
    );

    if (!hasAnalysisStarted) {
        return <p className="text-sm text-gray-500 dark:text-gray-400 italic p-4 text-center">Hata ağacı analizi oluşturulmamış.</p>;
    }

    const allNodes: FtaNode[] = [];
    const lines: { x1: number, y1: number, x2: number, y2: number, key: string }[] = [];
    let maxX = 0;
    let maxY = 0;

    const collectNodes = (node: FtaNode) => {
        allNodes.push(node);
        if(node.x !== undefined) maxX = Math.max(maxX, node.x + 140);
        if(node.y !== undefined) maxY = Math.max(maxY, node.y + 80);
        (node.children || []).forEach(collectNodes);
    };

    const generateLines = (node: FtaNode) => {
        if(node.children && node.children.length > 0) {
            const parentX = (node.x || 0) + 70; // Node center (140px width / 2)
            const parentY = (node.y || 0) + 80; // Node bottom (80px height)
            node.children.forEach(child => {
                const childX = (child.x || 0) + 70; // Child center
                const childY = (child.y || 0);     // Child top
                lines.push({ x1: parentX, y1: parentY, x2: childX, y2: childY, key: `${node.id}-${child.id}` });
                generateLines(child); // Recurse for grandchildren
            });
        }
    };
    
    if (data.topEvent) {
        collectNodes(data.topEvent);
        generateLines(data.topEvent);
    }
    (data.floatingNodes || []).forEach(node => {
        collectNodes(node);
        generateLines(node);
    });
    
    return (
        <div className="fta-diagram" style={{ minHeight: maxY + 20 }}>
             <svg className="fta-lines" width={maxX} height={maxY + 20}>
                {lines.map(line => <line {...line} />)}
            </svg>
            {allNodes.map(node => (
                <FtaNodeReport key={node.id} node={node} />
            ))}
        </div>
    );
};

const FtaCalculationResultPanel: React.FC<{ result: FaultTreeAnalysis['calculationResult'] }> = ({ result }) => {
    if (!result) {
        return (
            <div className="mt-4 p-4 border-t dark:border-gray-700 text-center text-gray-500 dark:text-gray-400 italic">
                Hesaplama sonucu bulunmamaktadır.
            </div>
        );
    }

    return (
        <div className="mt-4 p-3 border-t dark:border-gray-700 no-break">
            <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-base mb-2">FTA Hesaplama Sonucu</h5>
            <div className="text-center mb-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">Tepe Olay Olasılığı</p>
                <div className="fta-result-panel-metric text-3xl">{(result.p).toExponential(4)}</div>
            </div>
            {result.fixes && result.fixes.length > 0 && (
                <div className="mb-3">
                    <h6 className="font-semibold text-xs text-blue-600 dark:text-blue-400">Otomatik Düzeltmeler</h6>
                    <ul className="text-xs text-blue-700 dark:text-blue-300 list-disc list-inside space-y-0.5">
                        {result.fixes.map((fix, i) => <li key={i}>{fix}</li>)}
                    </ul>
                </div>
            )}
            {result.warnings && result.warnings.length > 0 && (
                <div className="mb-3">
                    <h6 className="font-semibold text-xs text-yellow-600 dark:text-yellow-400">Uyarılar</h6>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-0.5">
                        {result.warnings.map((warn, i) => <li key={i}><strong>{warn.id}:</strong> {warn.message}</li>)}
                    </ul>
                </div>
            )}
            <div>
                <h6 className="font-semibold text-xs text-gray-600 dark:text-gray-400">Hesaplama Adımları</h6>
                <pre className="fta-result-panel-out mt-1">{result.steps}</pre>
            </div>
            {result.insightsText && (
                 <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <h6 className="font-semibold text-xs text-gray-600 dark:text-gray-400">Otomatik Yorum ve Öneriler</h6>
                    <pre className="fta-result-panel-out mt-1 !bg-blue-50 dark:!bg-blue-900/20 !border-blue-200 dark:!border-blue-700 whitespace-pre-wrap">
                        {result.insightsText}
                    </pre>
                </div>
            )}
        </div>
    );
};

interface ParetoRow {
    name: string;
    value: number;
    share: number;
    cum: number;
    other?: boolean;
}

const processParetoData = (data?: ParetoAnalysisData) => {
    if (!data || !data.inputData) return null;

    const parse = (raw: string) => {
        return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(line => {
            const ix = line.lastIndexOf(','); if (ix < 0) return null;
            const name = line.slice(0, ix).trim(); const val = Number(line.slice(ix + 1).trim());
            if (!name || !(val >= 0)) return null; return { name, value: val };
        }).filter(Boolean) as { name: string; value: number; }[];
    };

    const parsedData = parse(data.inputData);
    if (!parsedData.length) return null;

    parsedData.sort((a, b) => b.value - a.value);
    const total = parsedData.reduce((s, r) => s + r.value, 0) || 0;
    if (total === 0) return null;

    let thrPct = data.thresholdMode === 'custom' ? data.customThreshold : Number(data.thresholdMode);
    thrPct = Math.max(1, Math.min(99, thrPct));

    let cum = 0;
    const enriched: ParetoRow[] = parsedData.map(r => { const share = r.value / total; cum += share; return { ...r, share, cum }; });

    let k = 0;
    for (let i = 0; i < enriched.length; i++) { k = i + 1; if (enriched[i].cum * 100 >= thrPct) break; }
    const keep: ParetoRow[] = enriched.slice(0, k);
    const rest = enriched.slice(k);

    if (rest.length) {
        const restVal = rest.reduce((s, r) => s + r.value, 0);
        keep.push({ name: 'Diğer', value: restVal, share: restVal / total, cum: 1, other: true });
    }

    return { rows: keep, total, threshold: thrPct };
};

const ParetoReport: React.FC<{ data?: ParetoAnalysisData }> = ({ data }) => {
    const result = useMemo(() => processParetoData(data), [data]);

    if (!result) {
        return <p className="text-sm text-gray-500 dark:text-gray-400 italic p-4 text-center">Pareto analizi verisi bulunmamaktadır.</p>;
    }

    const { rows, total, threshold } = result;
    const W = 640, H = 380;
    const pad = { l: 48, r: 40, t: 20, b: 60 };
    const w = W - pad.l - pad.r;
    const h = H - pad.t - pad.b;

    const maxVal = Math.max(1, ...rows.map(r => r.value));
    const yVal = (v: number) => pad.t + h - (v / maxVal) * h;
    const yPct = (p: number) => pad.t + h - p * h;
    const n = rows.length;
    const bw = w / Math.max(n, 1) * 0.7;
    const gap = w / Math.max(n, 1) * 0.3;

    const short = (s: string) => s.length > 14 ? s.slice(0, 12) + '…' : s;
    
    const linePoints: { x: number; y: number }[] = [];
    let currentX = pad.l + gap * 0.5 + bw / 2;
    rows.forEach((r, i) => {
        const cum = (i === rows.length - 1 && r.other) ? 1 : r.cum;
        linePoints.push({ x: currentX, y: yPct(cum || 0) });
        currentX += bw + gap;
    });

    return (
        <div className="pa">
            <div className="pa-g" style={{ gridTemplateColumns: '1fr' }}>
                <div className="card">
                    <div className="legend">
                        <div className="lgb"></div><span className="note">Sıklık (bar)</span>
                        <div className="lgl"></div><span className="note">Kümülatif % (çizgi)</span>
                        <span className="badge">Eşik: %{threshold}</span>
                    </div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxHeight: '380px' }}>
                        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                            const y = yPct(p);
                            return <g key={i}>
                                <line x1={pad.l} y1={y} x2={W-pad.r} y2={y} stroke='#22304b' strokeWidth={1} />
                                <text x={pad.l - 8} y={y + 3} textAnchor="end" fill="#9fb2d9" fontSize="10">{(p * 100).toFixed(0)}%</text>
                            </g>
                        })}
                        {[...Array(5)].map((_, i) => {
                            const v = i * (maxVal/4);
                            const y = yVal(v);
                            return <text key={i} x={pad.l - 8} y={y+3} textAnchor="end" fill="#cbd5e1" fontSize="10">{String(Math.round(v))}</text>
                        })}

                        {rows.map((r, i) => {
                            const hBar = Math.max(0.5, h * (r.value / maxVal));
                            const x = pad.l + gap * 0.5 + i * (bw + gap);
                            return <g key={i}>
                                <rect x={x} y={pad.t+h-hBar} width={bw} height={hBar} fill={r.other ? '#94a3b8' : '#60a5fa'} stroke='#1d4ed8' strokeWidth={1} />
                                <text x={x+bw/2} y={pad.t+h+14} textAnchor="middle" fill="#cbd5e1" fontSize={10} transform={`rotate(-45, ${x+bw/2}, ${pad.t+h+14})`}>{short(r.name)}</text>
                            </g>
                        })}

                        <path d={`M ${linePoints.map(p => `${p.x} ${p.y}`).join(' L ')}`} fill="none" stroke="#22d3ee" strokeWidth="3" />
                        {linePoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#22d3ee" />)}

                         <text x={W - pad.r} y={pad.t - 6} textAnchor="end" fill="#9fb2d9" fontSize="11">% Kümülatif</text>
                        <text x={pad.l} y={pad.t - 6} textAnchor="start" fill="#9fb2d9" fontSize="11">Sıklık</text>
                    </svg>
                    <table className="tbl">
                        <thead><tr><th>#</th><th>Kategori</th><th>Değer</th><th>Pay</th><th>Kümülatif</th></tr></thead>
                        <tbody>
                            {rows.map((r, i) => <tr key={i}><td>{i+1}</td><td>{r.name}</td><td>{r.value}</td><td>{(r.share*100).toFixed(2)}%</td><td>{(r.cum*100).toFixed(2)}%</td></tr>)}
                            <tr><td></td><td><b>Toplam</b></td><td><b>{total}</b></td><td colSpan={2}></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


const DofReportView: React.FC<DofReportViewProps> = ({ isOpen, onClose, dof, kpi }) => {
    const reportContentRef = useRef<HTMLDivElement>(null);

    const ftaDataForReport = useMemo(() => {
        if (!dof.kokNedenAnalizi?.fta) {
            return undefined;
        }
        const ftaCopy = JSON.parse(JSON.stringify(dof.kokNedenAnalizi.fta));
        if (ftaCopy.topEvent && dof.problemTanimi) {
            ftaCopy.topEvent.text = dof.problemTanimi;
        }
        return ftaCopy;
    }, [dof.kokNedenAnalizi?.fta, dof.problemTanimi]);

    const relevantMonthData = useMemo(() => {
        if (!dof.start_date) return null;
        try {
            const startDate = new Date(dof.start_date);
            if (isNaN(startDate.getTime())) return null;

            const monthIndex = startDate.getMonth();
            const monthName = AYLAR[monthIndex];
            const monthValue = kpi.aylik[monthName];

            if (monthValue === null || monthValue === undefined) return null;

            const monthStatus = getSingleMonthStatus(kpi, monthValue);

            return { monthName, monthValue, monthStatus };
        } catch (e) {
            console.error("DÖF başlangıç tarihi ayrıştırılırken hata oluştu:", e);
            return null;
        }
    }, [dof.start_date, kpi]);


    const handleGeneratePdf = () => {
        const element = reportContentRef.current;
        if (!element || !window.html2pdf) {
            console.error("PDF generation failed: element or html2pdf not found.");
            return;
        }
        const reportNo = `${kpi.kpi_adi.replace(/ /g, "_")}`;
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `8D_Raporu_${reportNo}_${timestamp}.pdf`;
        const opt = {
            margin: 8, filename: filename, image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        window.html2pdf().set(opt).from(element).save();
    };

    const getDofText = (text: string | undefined) => text || <span className="italic text-gray-400">Girilmemiş</span>;

    const dofStatusToKpiStatus = (dofStatus: DofStatus): Status => {
        switch (dofStatus) {
            case 'Açık': return 'basarisiz';
            case 'Devam': return 'marjinal';
            case 'Tamamlandı': return 'basarili';
            default: return 'n/a';
        }
    };

    const renderCorrectiveActions = (actions: CorrectiveAction[]) => {
        if (!actions || actions.length === 0) {
            return <p className="italic text-gray-400 p-2">Tanımlanmış kalıcı aksiyon bulunmamaktadır.</p>;
        }
        return (
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                    <thead className="text-left bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="p-2 border dark:border-gray-600 w-2/5">Aksiyon</th>
                            <th className="p-2 border dark:border-gray-600 w-2/5">İlgili Kök Neden(ler)</th>
                            <th className="p-2 border dark:border-gray-600">Sorumlu</th>
                            <th className="p-2 border dark:border-gray-600">Termin</th>
                            <th className="p-2 border dark:border-gray-600">Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actions.map(action => (
                            <tr key={action.id} className="border-b dark:border-gray-700">
                                <td className="p-2 border dark:border-gray-600 align-top whitespace-pre-wrap">{getDofText(action.action)}</td>
                                <td className="p-2 border dark:border-gray-600 align-top">
                                    {action.linkedRootCauses && action.linkedRootCauses.length > 0 ? (
                                        <ul className="list-disc list-inside space-y-1">
                                            {action.linkedRootCauses.map((cause, i) => <li key={i}>{cause}</li>)}
                                        </ul>
                                    ) : getDofText(undefined)}
                                </td>
                                <td className="p-2 border dark:border-gray-600 align-top">{getDofText(action.responsible)}</td>
                                <td className="p-2 border dark:border-gray-600 align-top">{new Date(action.dueDate).toLocaleDateString('tr-TR')}</td>
                                <td className="p-2 border dark:border-gray-600 align-top">{action.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="8D Raporu" size="5xl">
            <div className="max-h-[80vh] overflow-y-auto" data-dof="report">
                <div ref={reportContentRef} className="p-4 bg-white dark:bg-gray-800">
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">8D PROBLEM ÇÖZME RAPORU</h1>
                    </div>
                    
                    <div className="mb-6 p-4 border rounded-lg dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 no-break">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400">İlgili KPI</h4>
                                <p className="text-xl font-bold text-gray-800 dark:text-gray-200">{kpi.kpi_adi}</p>
                                <p className="text-md text-gray-600 dark:text-gray-300">{kpi.proses}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">DÖF Durumu</p>
                                <span className={`px-3 py-1 mt-1 inline-block text-sm font-bold rounded-full ${getStatusColorClasses(dofStatusToKpiStatus(dof.durum))}`}>
                                    {dof.durum}
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-200/50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="p-2 font-semibold rounded-tl-lg">Performans</th>
                                        {relevantMonthData && <th className="p-2 font-semibold">DÖF Ayı ({relevantMonthData.monthName})</th>}
                                        <th className="p-2 font-semibold rounded-tr-lg">Yıllık Ortalama</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b dark:border-gray-700">
                                        <td className="p-2 font-medium">Hedef</td>
                                        {relevantMonthData && <td className="p-2 font-mono">{kpi.karsilastirma} {kpi.yeni_yil_hedef} {kpi.birim}</td>}
                                        <td className="p-2 font-mono">{kpi.karsilastirma} {kpi.yeni_yil_hedef} {kpi.birim}</td>
                                    </tr>
                                    <tr className="border-b dark:border-gray-700">
                                        <td className="p-2 font-medium">Gerçekleşen</td>
                                        {relevantMonthData && <td className="p-2 font-mono text-lg">{relevantMonthData.monthValue}</td>}
                                        <td className="p-2 font-mono text-lg">{kpi.ortalama ?? 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-2 font-medium">Durum</td>
                                        {relevantMonthData && (
                                            <td className="p-2">
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${getStatusColorClasses(relevantMonthData.monthStatus)}`}>
                                                    {relevantMonthData.monthStatus}
                                                </span>
                                            </td>
                                        )}
                                        <td className="p-2">
                                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${getStatusColorClasses(kpi.durum)}`}>
                                                {kpi.durum}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm p-4 border rounded-lg dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 no-break">
                        <p><strong>DÖF ID:</strong> {dof.id}</p>
                        <p><strong>Başlangıç Tarihi (D0):</strong> {dof.start_date ? new Date(dof.start_date).toLocaleDateString('tr-TR') : 'N/A'}</p>
                        <p><strong>Sorumlu:</strong> {dof.sorumlu}</p>
                        <p><strong>Kapanış Tarihi:</strong> {dof.due_date ? new Date(dof.due_date).toLocaleDateString('tr-TR') : 'N/A'}</p>
                    </div>

                    <Section title="D1: Takım" icon={<UserIcon className="w-6 h-6 text-gray-500" />}>
                        <p className="whitespace-pre-wrap p-2">{getDofText(dof.takim)}</p>
                    </Section>
                    <Section title="D2: Problemin Tanımlanması" icon={<ClipboardDocumentListIcon className="w-6 h-6 text-red-500" />}>
                        <p className="whitespace-pre-wrap p-2">{getDofText(dof.problemTanimi)}</p>
                    </Section>
                    <Section title="D3: Geçici Önlemler" icon={<WrenchScrewdriverIcon className="w-6 h-6 text-orange-500" />}>
                        <p className="whitespace-pre-wrap p-2">{getDofText(dof.geciciOnlemler)}</p>
                    </Section>
                    <Section title="D4: Kök Neden Analizi" icon={<LightBulbIcon className="w-6 h-6 text-yellow-500" />}>
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg no-break">
                            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">Hata Ağacı Analizi (FTA)</h4>
                            <FtaReport data={ftaDataForReport} />
                            <FtaCalculationResultPanel result={dof.kokNedenAnalizi?.fta?.calculationResult} />
                        </div>
                         <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg no-break">
                            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">Pareto Analizi</h4>
                            <ParetoReport data={dof.kokNedenAnalizi?.pareto} />
                        </div>
                         <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg no-break">
                            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">Dağılım Grafiği Analizi (Scatter)</h4>
                            {dof.kokNedenAnalizi?.scatter?.inputData ? (
                                <div className="space-y-6">
                                    <div>
                                        <h5 className="font-semibold text-md text-gray-700 dark:text-gray-300 mb-2">Basit Dağılım Grafiği (X-Y)</h5>
                                        <ScatterPlotMatrix
                                            key="report-simple-scatter" 
                                            data={dof.kokNedenAnalizi.scatter} 
                                            onChange={() => {}} 
                                            readOnly={true} 
                                            initialView="simple" 
                                            showTabs={false} 
                                        />
                                    </div>
                                    <div className="border-t border-gray-200 dark:border-gray-700"></div>
                                    <div>
                                        <h5 className="font-semibold text-md text-gray-700 dark:text-gray-300 mb-2">İlişki Matrisi (Scatter Matrix)</h5>
                                        <ScatterPlotMatrix
                                            key="report-matrix-scatter"
                                            data={dof.kokNedenAnalizi.scatter}
                                            onChange={() => {}}
                                            readOnly={true}
                                            initialView="matrix"
                                            showTabs={false}
                                        />
                                    </div>
                                </div>
                            ) : (
                                 <p className="text-sm text-gray-500 dark:text-gray-400 italic p-4 text-center">Dağılım grafiği analizi oluşturulmamış.</p>
                            )}
                        </div>
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg no-break">
                            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">Balık Kılçığı Diyagramı</h4>
                            <FishboneReport data={dof.kokNedenAnalizi?.fishbone} />
                        </div>
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">5 Neden Analizi - Oluşum</h4>
                            <p className="whitespace-pre-wrap p-2"><strong>Kök Neden: </strong> {getDofText(dof.kokNedenAnalizi?.occurrenceRootCause)}</p>
                        </div>
                         <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">5 Neden Analizi - Saptanamama</h4>
                            <p className="whitespace-pre-wrap p-2"><strong>Kök Neden: </strong> {getDofText(dof.kokNedenAnalizi?.nonDetectionRootCause)}</p>
                        </div>
                    </Section>
                    <Section title="D5: Kalıcı Düzeltici Aksiyonlar" icon={<ClipboardCheckIcon className="w-6 h-6 text-blue-500" />}>
                        {renderCorrectiveActions(dof.kaliciAksiyonlar)}
                    </Section>
                     <Section title="D6: Uygulama ve Doğrulama" icon={<ChartBarIcon className="w-6 h-6 text-purple-500" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mb-2 text-sm p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                            <p><strong>Sorumlu:</strong> {getDofText(dof.uygulamaDogrulamaSorumlu)}</p>
                            <p><strong>Termin:</strong> {dof.uygulamaDogrulamaTermin ? new Date(dof.uygulamaDogrulamaTermin).toLocaleDateString('tr-TR') : getDofText(undefined)}</p>
                        </div>
                        <p className="whitespace-pre-wrap p-2">{getDofText(dof.uygulamaDogrulama)}</p>
                    </Section>
                     <Section title="D7: Problemin Tekrarının Önlenmesi" icon={<CalendarIcon className="w-6 h-6 text-teal-500" />}>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mb-2 text-sm p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                            <p><strong>Sorumlu:</strong> {getDofText(dof.tekrarinOnlenmesiSorumlu)}</p>
                            <p><strong>Termin:</strong> {dof.tekrarinOnlenmesiTermin ? new Date(dof.tekrarinOnlenmesiTermin).toLocaleDateString('tr-TR') : getDofText(undefined)}</p>
                        </div>
                        <p className="whitespace-pre-wrap p-2">{getDofText(dof.tekrarinOnlenmesi)}</p>
                    </Section>
                    <Section title="D8: Kapanış ve Takımın Takdir Edilmesi" icon={<ClipboardDocumentListIcon className="w-6 h-6 text-green-500" />}>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mb-2 text-sm p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                            <p><strong>Sorumlu:</strong> {getDofText(dof.takdirSorumlu)}</p>
                            <p><strong>Termin:</strong> {dof.takdirTermin ? new Date(dof.takdirTermin).toLocaleDateString('tr-TR') : getDofText(undefined)}</p>
                        </div>
                        <p className="whitespace-pre-wrap p-2">{getDofText(dof.takdir)}</p>
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Etkinlik Kontrolü</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mb-2 text-sm p-2 bg-gray-100 dark:bg-gray-800/50 rounded">
                                <p><strong>Sorumlu:</strong> {getDofText(dof.etkinlikKontrolSorumlusu)}</p>
                                <p><strong>Kontrol Tarihi:</strong> {dof.etkinlikKontrolTarihi ? new Date(dof.etkinlikKontrolTarihi).toLocaleDateString('tr-TR') : getDofText(undefined)}</p>
                            </div>
                            <p className="whitespace-pre-wrap p-2 text-sm">{getDofText(dof.etkinlikKontroluNotlari)}</p>
                        </div>
                    </Section>

                </div>
            </div>
             <div className="pt-6 mt-4 border-t dark:border-gray-700 flex justify-end gap-3 no-print">
                 <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">Kapat</button>
                 <button type="button" onClick={handleGeneratePdf} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700">
                    <PdfIcon className="w-5 h-5" /> PDF Raporu Oluştur
                </button>
            </div>
        </Modal>
    );
};

export default DofReportView;