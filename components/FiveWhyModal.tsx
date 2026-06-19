import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiveWhyAnalysis, FiveWhyStep, CorrectiveAction, FishboneCategory, FtaNode, FaultTreeAnalysis, FtaNodeType, FtaGateType, FtaEventType, ParetoAnalysisData, ScatterPlotAnalysisData } from '../types';
import Modal from './Modal';
import { PlusIcon, TrashIcon, LightBulbIcon, EditIcon, LinkOffIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import ScatterPlotMatrix from './ScatterPlotMatrix';

interface FiveWhyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: FiveWhyAnalysis) => void;
    initialData?: FiveWhyAnalysis;
}

// Add global declaration for the FTA calculation core
interface FtaFixAndCalculateResult {
    ok: boolean;
    p?: number;
    steps?: string;
    memo?: Record<string, number>;
    error?: string;
    errors?: { id: string; message: string }[];
    warnings?: { id: string; message: string }[];
    fixes?: string[];
    model?: { nodes: any[], edges: any[] };
}

declare global {
    interface Window {
        FTA: {
            fixAndCalculate: (input: { nodes: any[], topId: string, edges?: any[] }) => FtaFixAndCalculateResult;
            computeProbability: (nodes: Record<string, any>, topId: string) => { pT: number, memo: Record<string, number> };
        }
    }
}

const LEAF_TYPES = new Set(['primary','undeveloped','conditional','house_true','house_false']);

function generateInsights(
    validatedNodesMap: Map<string, any>, 
    topId: string, 
    baseMemo: Record<string, number>
): string {
    const pT = baseMemo[topId];
    if (pT === undefined) return '';

    // Helper: Risk Band
    const riskBand = (p: number) => {
        if (p >= 1e-3) return {band:'Kritik', note:'standartlara göre çok yüksek (≥1e-3) — derhal azaltım gerekir.'};
        if (p >= 1e-4) return {band:'Yüksek', note:'hedeflerin üzerinde (1e-4…1e-3) — iyileştirme önerilir.'};
        if (p >= 1e-5) return {band:'Orta',  note:'kabul/iyileştirme kararı tasarım hedeflerine bağlı.'};
        return {band:'Düşük', note:'hedeflerle uyumlu; izleme yeterli olabilir.'};
    };
    
    // Helper: What-if analysis
    const computeDeltaForLeaf = (leafId: string) => {
        const leaf = validatedNodesMap.get(leafId);
        if (!leaf) return null;

        const basePT = baseMemo[topId];
        
        // Create a deep copy of the map for modification
        const tempNodesMap = new Map(validatedNodesMap);
        let tempLeaf = { ...leaf }; // Modify the probability to 0
        if (leaf.type === 'house_true') {
            tempLeaf.type = 'house_false';
        } else {
            tempLeaf.p = 0;
        }
        tempNodesMap.set(leafId, tempLeaf);
        
        try {
            if (!window.FTA?.computeProbability) {
                console.error("FTA.computeProbability is not available on window object.");
                return null;
            }
            // Use the globally exposed probability function
            const { pT: p2 } = window.FTA.computeProbability(Object.fromEntries(tempNodesMap), topId);
            const delta = basePT - p2;
            return {id: leafId, label: leaf.label||leafId, type: leaf.type, p: leaf.p, delta: Math.max(delta,0), newPT: p2};
        } catch (e) {
            console.error(`What-if analysis failed for leaf ${leafId}:`, e);
            return null;
        }
    };
    
    // Helper: Top Contributors
    const getTopContributors = () => {
        const leaves: any[] = Array.from(validatedNodesMap.values()).filter(n => LEAF_TYPES.has(n.type));
        const rows = leaves.map(L => computeDeltaForLeaf(L.id)).filter(Boolean) as { delta: number }[];
        rows.sort((a,b)=> b.delta - a.delta);
        return rows.slice(0, 3);
    };

    // Helper: Gate Hints
    const getGateHints = () => {
        const hints = [];
        for (const n of validatedNodesMap.values()) {
            if (n.type === 'or' && (n.children || []).some((cid: string) => validatedNodesMap.get(cid)?.type === 'house_true')) {
                hints.push(`'${n.label}' (VEYA) kapısı, her zaman 'true' olan bir olaya bağlı. Bu durum tepe olayı doygunlaştırabilir.`);
            }
            if (n.type === 'xor' && (n.children || []).length !== 2) {
                hints.push(`'${n.label}' (ÖZEL VEYA) kapısı tam olarak 2 girdi gerektirir, ancak ${n.children?.length || 0} girdisi var.`);
            }
            if (n.type === 'intermediate' && (n.children || []).length !== 1) {
                hints.push(`'${n.label}' (Ara olay) tam olarak 1 girdi gerektirir, ancak ${n.children?.length || 0} girdisi var.`);
            }
        }
        return hints;
    };
    
    // Build the final text
    const rb = riskBand(pT);
    const contrib = getTopContributors() as any[];
    const hints = getGateHints();
    const lines = [];

    lines.push(`📌 Risk Özeti`);
    lines.push(`- Tepe Olay Olasılığı: ${pT.toExponential(4)} → ${rb.band} risk (${rb.note})`);
    lines.push('');

    if (contrib.length > 0) {
        lines.push(`🔎 En Kritik Katkılar (what-if: olayın p=0 alınırsa etki)`);
        contrib.forEach((r, i) => {
            if (!r) return;
            const originalP = (r.p === undefined || r.p === null) ? `(${r.type})` : r.p.toExponential(2);
            lines.push(`  ${i+1}. "${r.label}" [p=${originalP}] → ΔP=${r.delta.toExponential(2)} (Yeni P(Tepe) ≈ ${r.newPT.toExponential(4)})`);
        });
        lines.push('');
    }

    if (hints.length > 0) {
        lines.push(`⚠️ Yapısal Notlar/İpuçları`);
        hints.forEach(h => lines.push(`- ${h}`));
        lines.push('');
    }

    lines.push(`🛠️ Örnek DÖF Aksiyonları`);
    if (contrib[0]) {
        lines.push(`- "${contrib[0].label}" olayının olasılığını düşürmeye odaklan (ör. tasarım değişikliği, ek kontrol, bakım planı).`);
    }
    lines.push(`- Geliştirilmemiş (undeveloped) olayları detaylandırarak analizi derinleştir.`);
    lines.push(`- Varsa, koşullu (conditional) olayların gerçekleşme şartlarını ortadan kaldıracak bariyerler ekle.`);
    
    return lines.join('\n');
}


// Simplified internal state type for a more intuitive UI flow
type AnalysisChain = { id: string; text: string };

const AnalysisPath: React.FC<{
    title: string;
    problem: string;
    setProblem: (value: string) => void;
    chain: AnalysisChain[];
    setChain: (chain: AnalysisChain[]) => void;
}> = ({ title, problem, setProblem, chain, setChain }) => {

    const handleChainChange = (index: number, value: string) => {
        const newChain = [...chain];
        newChain[index].text = value;
        setChain(newChain);
    };

    const addStep = () => {
        setChain([...chain, { id: `chain-${Date.now()}`, text: '' }]);
    };
    
    const removeStep = (index: number) => {
        if (window.confirm("Bu adımı silmek, sonraki tüm adımları da kaldıracaktır. Devam etmek istiyor musunuz?")) {
            setChain(chain.slice(0, index));
        }
    };
    
    const lastCause = chain.length > 0 ? chain[chain.length - 1].text : "Analizi tamamlayın...";

    return (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg h-full flex flex-col">
            <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">{title}</h3>
            <div className="flex-grow space-y-2">
                {/* Problem Statement */}
                <div className="bg-white dark:bg-gray-700 p-3 rounded-md shadow-sm">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Problem Cümlesi</label>
                    <textarea
                        rows={2}
                        placeholder="Analiz edilecek problemi yazın..."
                        value={problem}
                        onChange={(e) => setProblem(e.target.value)}
                        className="w-full p-1 border-0 bg-transparent rounded-md text-sm focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                {chain.map((step, index) => (
                    <div key={step.id} className="pl-5 relative">
                        <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                        <div className="absolute left-0 top-5 transform -translate-y-1/2 w-5 h-5 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                           {index + 1}
                        </div>
                        <div className="ml-4 bg-white dark:bg-gray-700 p-3 rounded-md shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Neden?</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 min-h-[20px]">{index === 0 ? problem : chain[index - 1].text}</p>
                                </div>
                                <button type="button" onClick={() => removeStep(index)} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                            <textarea
                                rows={2}
                                placeholder="Çünkü..."
                                value={step.text}
                                onChange={(e) => handleChainChange(index, e.target.value)}
                                className="w-full mt-2 p-1 border-0 bg-gray-50 dark:bg-gray-800 rounded-md text-sm focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                ))}
                
                <div className="pl-10">
                     <button type="button" onClick={addStep} className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50" disabled={!problem}>
                        <PlusIcon className="w-4 h-4" /> Neden Ekle
                    </button>
                </div>
            </div>

            <div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-900/40 border-l-4 border-yellow-500 rounded-r-lg">
                <div className="flex items-center gap-2">
                    <LightBulbIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400"/>
                    <label className="font-semibold text-yellow-800 dark:text-yellow-200">Kök Neden</label>
                </div>
                <p className="mt-1 w-full p-2 bg-transparent rounded-md text-yellow-900 dark:text-yellow-100 min-h-[40px]">{lastCause}</p>
            </div>
        </div>
    );
};


const FtaShape: React.FC<{ node: Partial<FtaNode>, className?: string }> = ({ node, className }) => {
    const combinedClassName = `fta-shape ${className || ''}`;

    if (node.type === 'gate') {
        switch (node.gateType) {
            case 'AND': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-and`}><path d="M0 30 V0 H40 V30 A20 20 0 0 1 0 30Z" strokeWidth="2" /></svg>;
            case 'OR': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-or`}><path d="M0 30 Q20 25 40 30 V0 Q20 5 0 0 Z" strokeWidth="2" /></svg>;
            case 'XOR': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-xor`}><path d="M0 30 Q20 25 40 30 V0 Q20 5 0 0 Z" strokeWidth="2" /><path d="M0 26 Q20 21 40 26" strokeWidth="2" fill="none" /></svg>;
            case 'PRIORITY_AND': return <svg viewBox="0 0 40 30" className={`${combinedClassName} fta-shape-priority-and`}><path d="M0 30 V0 H40 V30 A20 20 0 0 1 0 30Z" strokeWidth="2" /><line x1="5" y1="25" x2="35" y2="25" stroke="currentColor" strokeWidth="1.5" /></svg>;
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

const GATE_TYPES: { type: FtaGateType, label: string }[] = [
    { type: 'AND', label: 'VE Kapısı' }, { type: 'OR', label: 'VEYA Kapısı' }, { type: 'XOR', label: 'ÖZEL VEYA Kapısı' },
    { type: 'PRIORITY_AND', label: 'ÖNCELİKLİ VE Kapısı' }, { type: 'INHIBIT', label: 'ENGELLEME Kapısı' }
];
const EVENT_TYPES: { type: FtaEventType, label: string }[] = [
    { type: 'BASIC', label: 'Temel Olay' }, { type: 'INTERMEDIATE', label: 'Ara Olay' }, { type: 'UNDEVELOPED', label: 'Geliştirilmemiş Olay' },
    { type: 'CONDITIONAL', label: 'Koşullu Olay' }, { type: 'HOUSE', label: 'Dahili Olay' }, { type: 'TRANSFER', label: 'Transfer' }
];

const FtaNodeView: React.FC<{
    node: FtaNode;
    onUpdateText: (id: string, text: string) => void;
    onUpdateP: (id: string, p: number | undefined) => void;
    onUpdateHouseValue: (id: string, value: boolean) => void;
    onDelete: (id: string) => void;
    onDragStart: (e: React.MouseEvent, nodeId: string) => void;
    onConnectionStart: (e: React.MouseEvent, nodeId: string) => void;
    isDropTarget: boolean;
    onSetDropTarget: (nodeId: string | null) => void;
    parentId: string | undefined;
    onDisconnect: (nodeId: string) => void;
    isTopEvent: boolean;
}> = ({ node, onUpdateText, onUpdateP, onUpdateHouseValue, onDelete, onDragStart, onConnectionStart, isDropTarget, onSetDropTarget, parentId, onDisconnect, isTopEvent }) => {
    
    const needsProbabilityInput = node.type === 'event' && ['BASIC', 'UNDEVELOPED', 'CONDITIONAL'].includes(node.eventType!);
    const isHouseEvent = node.type === 'event' && node.eventType === 'HOUSE';
    
    const handlePChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '') {
            onUpdateP(node.id, undefined);
        } else {
            const p = parseFloat(val);
            if (!isNaN(p) && p >= 0 && p <= 1) {
                onUpdateP(node.id, p);
            }
        }
    };

    return (
        <div 
            className={`fta-node group ${isDropTarget ? 'is-drop-target' : ''}`}
            style={{ left: node.x, top: node.y }}
            onMouseEnter={() => onSetDropTarget(node.id)}
            onMouseLeave={() => onSetDropTarget(null)}
        >
             {parentId && (
                <div className="fta-disconnect-btn">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDisconnect(node.id); }} 
                        className="p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600"
                        title="Bağlantıyı kopar"
                    >
                        <LinkOffIcon className="w-4 h-4"/>
                    </button>
                </div>
            )}
            <div className="fta-node-content" onMouseDown={(e) => onDragStart(e, node.id)}>
                {typeof node.calculatedP === 'number' && (
                  <p className="fta-calculated-p" title="Hesaplanan Olasılık">P={(node.calculatedP).toExponential(2)}</p>  
                )}
                <FtaShape node={node} />
                <textarea
                    value={node.text}
                    onChange={e => onUpdateText(node.id, e.target.value)}
                    rows={2}
                    onMouseDown={(e) => e.stopPropagation()} // Prevent node drag when clicking textarea
                />
                 {needsProbabilityInput && (
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={node.p ?? ''}
                        onChange={handlePChange}
                        placeholder="P (0-1)"
                        onMouseDown={(e) => e.stopPropagation()}
                        className="fta-probability-input"
                    />
                 )}
                 {isHouseEvent && (
                    <div className="flex items-center justify-center space-x-2 mt-1 text-xs">
                        <label className="flex items-center cursor-pointer">
                            <input 
                                type="radio" 
                                name={`${node.id}-house`} 
                                checked={node.houseValue !== false} // default to true
                                onChange={() => onUpdateHouseValue(node.id, true)} 
                                onMouseDown={e => e.stopPropagation()}
                                className="form-radio h-3 w-3"
                            />
                            <span className="ml-1">True (1)</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input 
                                type="radio" 
                                name={`${node.id}-house`} 
                                checked={node.houseValue === false} 
                                onChange={() => onUpdateHouseValue(node.id, false)}
                                onMouseDown={e => e.stopPropagation()}
                                className="form-radio h-3 w-3"
                            />
                            <span className="ml-1">False (0)</span>
                        </label>
                    </div>
                )}
                {!isTopEvent && <button onClick={(e) => {e.stopPropagation(); onDelete(node.id);}} className="absolute top-1 right-1 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Sil"><TrashIcon className="w-4 h-4"/></button>}
                {/* Allow connection from all nodes to provide flexibility as requested by user. */}
                <div 
                    className="fta-connection-handle" 
                    onMouseDown={(e) => onConnectionStart(e, node.id)}
                    title="Bağlantı sürükle"
                />
            </div>
        </div>
    );
};

const FtaEditor: React.FC<{ data: FaultTreeAnalysis, onChange: (newData: FaultTreeAnalysis) => void }> = ({ data, onChange }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [movingNode, setMovingNode] = useState<{ id: string, dx: number, dy: number } | null>(null);
    const [connectionState, setConnectionState] = useState<{
        startNodeId: string;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
    } | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const calculationResult = data.calculationResult;
    const [isResultsPanelOpen, setIsResultsPanelOpen] = useState(true);
    
    // --- Tree Traversal and Manipulation ---
    const { nodeMap, parentMap } = useMemo(() => {
        const nodeMap = new Map<string, FtaNode>();
        const parentMap = new Map<string, string>();
        const traverse = (node: FtaNode, parentId?: string) => {
            nodeMap.set(node.id, node);
            if (parentId) {
                parentMap.set(node.id, parentId);
            }
            (node.children || []).forEach(child => traverse(child, node.id));
        };
        if (data.topEvent) {
            traverse(data.topEvent);
        }
        (data.floatingNodes || []).forEach(node => {
            traverse(node); // Floating nodes are roots of their own (sub)trees
        });
        return { nodeMap, parentMap };
    }, [data]);
    
    const hasPath = (fromId: string, toId: string): boolean => {
        const seen = new Set<string>();
        const stack = [fromId];
        while (stack.length > 0) {
            const currentId = stack.pop()!;
            if (currentId === toId) return true;
            if (seen.has(currentId)) continue;
            seen.add(currentId);
            const node = nodeMap.get(currentId);
            if (node && node.children) {
                node.children.forEach(child => stack.push(child.id));
            }
        }
        return false;
    };
    
    const canConnect = (parentId: string, childId: string): { ok: boolean, msg: string } => {
        const parentNode = nodeMap.get(parentId);
        const childNode = nodeMap.get(childId);
        if (!parentNode || !childNode) return { ok: false, msg: 'Düğüm bulunamadı.' };

        // Rule: Child cannot have another parent
        if (parentMap.has(childId)) {
            return { ok: false, msg: `'${childNode.text}' zaten bir ebeveyne sahip. Çoklu girdi için Transfer olayı kullanın.` };
        }
        
        // Rule: Leaf nodes cannot be parents
        const leafEventTypes: FtaEventType[] = ['BASIC', 'UNDEVELOPED', 'CONDITIONAL', 'HOUSE'];
        if (parentNode.type === 'event' && leafEventTypes.includes(parentNode.eventType!)) {
            return { ok: false, msg: `'${parentNode.text}' (${parentNode.eventType}) bir yaprak olaydır ve çocuk sahibi olamaz.` };
        }

        // Rule: Check for cycles
        if (hasPath(childId, parentId)) {
            return { ok: false, msg: 'Döngüsel bir bağlantı oluşturulamaz.' };
        }

        // Rule: Node type specific child count limits
        const childCount = parentNode.children?.length || 0;
        if (parentNode.type === 'event' && parentNode.eventType === 'INTERMEDIATE' && childCount >= 1) {
            return { ok: false, msg: 'Ara olaylar yalnızca bir çocuğa sahip olabilir.' };
        }
        if (parentNode.type === 'event' && parentNode.eventType === 'TRANSFER' && childCount >= 1) {
            return { ok: false, msg: 'Transfer olayları yalnızca bir çocuğa sahip olabilir.' };
        }
        if (parentNode.type === 'gate' && parentNode.gateType === 'XOR' && childCount >= 2) {
            return { ok: false, msg: 'XOR kapıları yalnızca iki çocuğa sahip olabilir.' };
        }

        return { ok: true, msg: '' };
    };


    const updateNodeRecursively = (node: FtaNode, id: string, updates: Partial<FtaNode>): FtaNode => {
        if (node.id === id) {
            return { ...node, ...updates };
        }
        return { ...node, children: (node.children || []).map(child => updateNodeRecursively(child, id, updates)) };
    };

    const handleConnection = (parentId: string, childId: string) => {
        let newTopEvent = JSON.parse(JSON.stringify(data.topEvent));
        let newFloating = JSON.parse(JSON.stringify(data.floatingNodes || []));
        let childNodeToMove: FtaNode | null = null;

        // Find in floating nodes and remove
        const floatingIndex = newFloating.findIndex((n: FtaNode) => n.id === childId);
        if (floatingIndex > -1) {
            childNodeToMove = newFloating[floatingIndex];
            newFloating.splice(floatingIndex, 1);
        }

        // If not found, find in tree and remove
        if (!childNodeToMove) {
            const findAndRemove = (node: FtaNode): FtaNode => {
                const newChildren = [];
                for (const child of (node.children || [])) {
                    if (child.id === childId) {
                        childNodeToMove = child;
                    } else {
                        newChildren.push(findAndRemove(child));
                    }
                }
                return { ...node, children: newChildren };
            };
            newTopEvent = findAndRemove(newTopEvent);
        }
        
        if (!childNodeToMove) return;

        // Now add to parent. The parent can be anywhere (tree or floating).
        let parentFound = false;
        const findAndAdd = (node: FtaNode): FtaNode => {
            if (node.id === parentId) {
                parentFound = true;
                return { ...node, children: [...(node.children || []), childNodeToMove!] };
            }
            return { ...node, children: (node.children || []).map(findAndAdd) };
        };
        
        newTopEvent = findAndAdd(newTopEvent);
        if (!parentFound) {
            newFloating = newFloating.map(findAndAdd);
        }

        onChange({ topEvent: newTopEvent, floatingNodes: newFloating });
    };

    const handleDisconnect = (childId: string) => {
        let newTopEvent = JSON.parse(JSON.stringify(data.topEvent));
        let newFloating = JSON.parse(JSON.stringify(data.floatingNodes || []));
        let childNodeToMove: FtaNode | null = null;

        // Find in tree and remove
        const findAndRemove = (node: FtaNode): FtaNode => {
            const newChildren = [];
            for (const child of (node.children || [])) {
                if (child.id === childId) {
                    childNodeToMove = child;
                } else {
                    newChildren.push(findAndRemove(child));
                }
            }
            return { ...node, children: newChildren };
        };
        newTopEvent = findAndRemove(newTopEvent);
        
        if (childNodeToMove) {
            // Add the disconnected node's subtree to floating nodes
            newFloating.push(childNodeToMove);
        }
        
        onChange({ topEvent: newTopEvent, floatingNodes: newFloating });
    };

    const getAllNodes = (node: FtaNode): FtaNode[] => {
        return [node, ...(node.children || []).flatMap(getAllNodes)];
    };
    const allNodes = useMemo(() => {
        const nodesFromTree = data.topEvent ? getAllNodes(data.topEvent) : [];
        const nodesFromFloating = (data.floatingNodes || []).flatMap(getAllNodes);
        return [...nodesFromTree, ...nodesFromFloating];
    }, [data]);

    // --- Event Handlers ---
    const handleDragStart = (e: React.DragEvent, nodeInfo: Partial<FtaNode>) => {
        e.dataTransfer.setData('application/json', JSON.stringify(nodeInfo));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const dataString = e.dataTransfer.getData('application/json');

        if (!dataString || dataString.trim() === '') {
            // Not a valid drop from the palette, likely end of node move/connection. Ignore.
            return;
        }
        
        try {
            const nodeInfo = JSON.parse(dataString) as Partial<FtaNode>;
            const canvasBounds = canvasRef.current?.getBoundingClientRect();
            if (!canvasBounds || !canvasRef.current) return;

            let text = nodeInfo.type === 'gate'
                ? `${(GATE_TYPES.find(g => g.type === nodeInfo.gateType)?.label || 'Kapı')}`
                : `${(EVENT_TYPES.find(e => e.type === nodeInfo.eventType)?.label || 'Olay')}`;

            const newNode: FtaNode = {
                id: `fta-${Date.now()}`,
                text: text,
                children: [],
                ...nodeInfo,
                x: e.clientX - canvasBounds.left + canvasRef.current.scrollLeft - 70, // 70 = half node width
                y: e.clientY - canvasBounds.top + canvasRef.current.scrollTop - 40,  // 40 = half node height
            } as FtaNode;

            const newFloatingNodes = [...(data.floatingNodes || []), newNode];
            onChange({ ...data, floatingNodes: newFloatingNodes });
        } catch (error) {
            console.error("Failed to parse dropped FTA node data:", error);
        }
    };

    const handleNodeDragStart = (e: React.MouseEvent, nodeId: string) => {
        const node = nodeMap.get(nodeId);
        if (!node) return;
        setMovingNode({ 
            id: nodeId, 
            dx: e.clientX - (node.x || 0), 
            dy: e.clientY - (node.y || 0),
        });
    };

    const handleConnectionStart = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        const startNode = nodeMap.get(nodeId);
        if (!startNode || !canvasRef.current) return;
    
        const canvasBounds = canvasRef.current.getBoundingClientRect();
        const startX = (startNode.x || 0) + 70; // Node center-bottom
        const startY = (startNode.y || 0) + 80;
    
        setConnectionState({
            startNodeId: nodeId,
            startX,
            startY,
            endX: e.clientX - canvasBounds.left + canvasRef.current.scrollLeft,
            endY: e.clientY - canvasBounds.top + canvasRef.current.scrollTop,
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (movingNode) {
            const newX = e.clientX - movingNode.dx;
            const newY = e.clientY - movingNode.dy;
            const movingId = movingNode.id;
    
            // Try updating floating nodes first
            let isFloating = false;
            const newFloating = (data.floatingNodes || []).map(node => {
                if (node.id === movingId) {
                    isFloating = true;
                    return { ...node, x: newX, y: newY };
                }
                return node;
            });
    
            if (isFloating) {
                onChange({ ...data, floatingNodes: newFloating });
                return;
            }
    
            // If not floating, it must be in the main tree.
            const updateRecursively = (node: FtaNode): FtaNode => {
                if (node.id === movingId) {
                    // Found the node to update. Return a new object.
                    return { ...node, x: newX, y: newY };
                }
    
                // If this node has children, recurse.
                if (node.children && node.children.length > 0) {
                    let hasChanged = false;
                    const newChildren = node.children.map(child => {
                        const updatedChild = updateRecursively(child);
                        if (updatedChild !== child) {
                            hasChanged = true; // A descendant was updated.
                        }
                        return updatedChild;
                    });
    
                    // If a child was updated, we need to create a new parent node
                    // with the new children array to maintain immutability.
                    if (hasChanged) {
                        return { ...node, children: newChildren };
                    }
                }
                
                // If no change, return the original node object. This is crucial for performance.
                return node;
            };
    
            if (data.topEvent) {
                const newTopEvent = updateRecursively(data.topEvent);
                // Only trigger a state update if the tree has actually changed.
                if (newTopEvent !== data.topEvent) {
                    onChange({ ...data, topEvent: newTopEvent });
                }
            }
        } else if (connectionState && canvasRef.current) {
            const canvasBounds = canvasRef.current.getBoundingClientRect();
            setConnectionState({
                ...connectionState,
                endX: e.clientX - canvasBounds.left + canvasRef.current.scrollLeft,
                endY: e.clientY - canvasBounds.top + canvasRef.current.scrollTop,
            });
        }
    };

    const handleMouseUpOnCanvas = (e: React.MouseEvent) => {
        if (connectionState && dropTargetId) {
            const { ok, msg } = canConnect(connectionState.startNodeId, dropTargetId);
            if (!ok) {
                alert(`Bağlantı Kurulamadı: ${msg}`);
            } else {
                 handleConnection(connectionState.startNodeId, dropTargetId);
            }
        }
        setMovingNode(null);
        setConnectionState(null);
        setDropTargetId(null);
    };

    const handleDelete = (id: string) => {
        if (data.topEvent.id === id) {
            alert("Tepe olay silinemez.");
            return;
        }

        let newTopEvent = JSON.parse(JSON.stringify(data.topEvent));
        let newFloating = JSON.parse(JSON.stringify(data.floatingNodes || []));
        
        // Try to remove from floating nodes first
        const initialFloatingCount = newFloating.length;
        newFloating = newFloating.filter((node: FtaNode) => node.id !== id);
        
        // If it wasn't a top-level floating node, search within the tree
        if (newFloating.length === initialFloatingCount) {
            const removeRecursively = (node: FtaNode, idToRemove: string): FtaNode => {
                 const newChildren = (node.children || [])
                    .filter(child => child.id !== idToRemove)
                    .map(child => removeRecursively(child, idToRemove));
                return { ...node, children: newChildren };
            };
            newTopEvent = removeRecursively(newTopEvent, id);
        }

        onChange({ topEvent: newTopEvent, floatingNodes: newFloating });
    };
    
    const onUpdateText = (id: string, text: string) => {
        let nodeFoundAndUpdated = false;
        const newFloating = (data.floatingNodes || []).map(node => {
            if (node.id === id) {
                nodeFoundAndUpdated = true;
                return { ...node, text };
            }
            return node;
        });

        if (nodeFoundAndUpdated) {
            onChange({ ...data, floatingNodes: newFloating });
        } else {
            const newTree = updateNodeRecursively(data.topEvent, id, { text });
            onChange({ ...data, topEvent: newTree });
        }
    }
    
    const onUpdateP = (id: string, p: number | undefined) => {
        let nodeFoundAndUpdated = false;
        const newFloating = (data.floatingNodes || []).map(node => {
            if (node.id === id) {
                nodeFoundAndUpdated = true;
                return { ...node, p };
            }
            return node;
        });

        if (nodeFoundAndUpdated) {
            onChange({ ...data, floatingNodes: newFloating });
        } else {
            const newTree = updateNodeRecursively(data.topEvent, id, { p });
            onChange({ ...data, topEvent: newTree });
        }
    };
    
    const onUpdateHouseValue = (id: string, value: boolean) => {
        let nodeFoundAndUpdated = false;
        const newFloating = (data.floatingNodes || []).map(node => {
            if (node.id === id) {
                nodeFoundAndUpdated = true;
                return { ...node, houseValue: value };
            }
            return node;
        });

        if (nodeFoundAndUpdated) {
            onChange({ ...data, floatingNodes: newFloating });
        } else {
            const newTree = updateNodeRecursively(data.topEvent, id, { houseValue: value });
            onChange({ ...data, topEvent: newTree });
        }
    };

    const handleCalculate = () => {
        const typeMap: Record<string, string> = {
            AND: 'and', OR: 'or', XOR: 'xor', PRIORITY_AND: 'pand', INHIBIT: 'inhibit',
            BASIC: 'primary', INTERMEDIATE: 'intermediate', UNDEVELOPED: 'undeveloped',
            CONDITIONAL: 'conditional', HOUSE: 'house_true', TRANSFER: 'transfer'
        };

        const mappedNodes = allNodes.map(n => {
            let coreType = typeMap[n.gateType!] || typeMap[n.eventType!];
            if (n.eventType === 'HOUSE') {
                // Default to true if houseValue is undefined
                coreType = n.houseValue === false ? 'house_false' : 'house_true';
            }
            return {
                id: n.id,
                type: coreType,
                label: n.text,
                p: n.p,
                children: n.children.map(c => c.id) // Ensure children are just IDs
            }
        });

        const result = window.FTA.fixAndCalculate({ nodes: mappedNodes, topId: data.topEvent.id });
        
        if (result.ok && result.memo && result.model) {
            // SUCCESS: Reconstruct state from the validated model returned by the core engine.
            const resultNodeMap = new Map(result.model.nodes.map((n: any) => [n.id, n]));
            // FIX: Explicitly type `originalNodeMap` to ensure correct type inference for `originalNode`.
            const originalNodeMap: Map<string, FtaNode> = new Map(allNodes.map(n => [n.id, n]));

            const reverseTypeMap: Record<string, { type: FtaNodeType, gateType?: FtaGateType, eventType?: FtaEventType }> = {
                'and': { type: 'gate', gateType: 'AND' }, 'or': { type: 'gate', gateType: 'OR' },
                'xor': { type: 'gate', gateType: 'XOR' }, 'pand': { type: 'gate', gateType: 'PRIORITY_AND' },
                'inhibit': { type: 'gate', gateType: 'INHIBIT' }, 'primary': { type: 'event', eventType: 'BASIC' },
                'intermediate': { type: 'event', eventType: 'INTERMEDIATE' }, 'undeveloped': { type: 'event', eventType: 'UNDEVELOPED' },
                'conditional': { type: 'event', eventType: 'CONDITIONAL' }, 'house_true': { type: 'event', eventType: 'HOUSE' },
                'house_false': { type: 'event', eventType: 'HOUSE' }, 'transfer': { type: 'event', eventType: 'TRANSFER' },
            };

            const insightsText = generateInsights(resultNodeMap, data.topEvent.id, result.memo);

            const buildTree = (nodeId: string): FtaNode => {
                const resultNode = resultNodeMap.get(nodeId)!;
                const originalNode = originalNodeMap.get(nodeId);
                const { type, gateType, eventType } = reverseTypeMap[resultNode.type] || { type: 'event', eventType: 'INTERMEDIATE' };
                
                let x = originalNode?.x;
                let y = originalNode?.y;
                if ((x === undefined || y === undefined) && canvasRef.current) {
                    // It's a new node (e.g. auto-added OR gate). Let's try to position it.
                    const parentId = Array.from(resultNodeMap.values()).find((p: any) => p.children?.includes(nodeId))?.id;
                    const parentNode = parentId ? originalNodeMap.get(parentId) : undefined;
                    x = (parentNode?.x ?? 200) + Math.random() * 40 - 20;
                    y = (parentNode?.y ?? 100) + 120; // Place it below the parent
                }

                let houseValue = originalNode?.houseValue;
                if(eventType === 'HOUSE') {
                    houseValue = resultNode.type !== 'house_false';
                }

                return {
                    id: resultNode.id, text: resultNode.label, p: resultNode.p, type, gateType, eventType, houseValue,
                    x, y, calculatedP: result.memo?.[resultNode.id],
                    children: (resultNode.children || []).map((childId: string) => buildTree(childId)),
                };
            };

            const newTopEvent = buildTree(data.topEvent.id);

            const allNodeIdsInTree = new Set<string>();
            const collectIds = (node: FtaNode) => {
                allNodeIdsInTree.add(node.id);
                (node.children || []).forEach(collectIds);
            };
            collectIds(newTopEvent);

            const newFloatingNodes: FtaNode[] = [];
            result.model.nodes.forEach((node: any) => {
                if (!allNodeIdsInTree.has(node.id)) {
                    const hasParent = result.model.nodes.some((p: any) => p.children?.includes(node.id));
                    if (!hasParent) {
                        newFloatingNodes.push(buildTree(node.id));
                    }
                }
            });
            
            const newFullData: FaultTreeAnalysis = {
                topEvent: newTopEvent,
                floatingNodes: newFloatingNodes,
                calculationResult: { 
                    p: result.p!, steps: result.steps!,
                    fixes: result.fixes, warnings: result.warnings,
                    insightsText: insightsText
                }
            };
            onChange(newFullData);

        } else {
            // FAILURE: Display error alert
            let errorMsg = `Hesaplama Hatası: ${result.error}\n\n`;
            if (result.errors) {
                errorMsg += "Detaylar:\n" + result.errors.map(e => `• Düğüm ${e.id}: ${e.message}`).join('\n');
            }
            alert(errorMsg);
            
            const newFullData = JSON.parse(JSON.stringify(data));
            delete newFullData.calculationResult;
            const clearP = (node: FtaNode) => {
                delete node.calculatedP;
                (node.children || []).forEach(clearP);
            };
            clearP(newFullData.topEvent);
            (newFullData.floatingNodes || []).forEach(clearP);
            onChange(newFullData);
        }
    };

    const lines: { x1: number, y1: number, x2: number, y2: number, key: string }[] = [];
    allNodes.forEach(node => {
        if (node.children && node.children.length > 0) {
            const parentX = (node.x || 0) + 70;
            const parentY = (node.y || 0) + 80;
            node.children.forEach(child => {
                const childNode = nodeMap.get(child.id);
                if (childNode) {
                    const childX = (childNode.x || 0) + 70;
                    const childY = (childNode.y || 0);
                    lines.push({ x1: parentX, y1: parentY, x2: childX, y2: childY, key: `${node.id}-${child.id}` });
                }
            });
        }
    });
    

    return (
        <div className={`fta-editor-grid h-full ${!isResultsPanelOpen ? 'fta-results-collapsed' : ''}`}>
            <div className="fta-palette">
                <h4 className="font-bold text-sm mb-2 text-center flex-shrink-0">Şekiller</h4>
                <div className="flex-grow min-h-0 overflow-y-auto pr-2 -mr-2">
                    {[...GATE_TYPES, ...EVENT_TYPES].map((item) => {
                        const isGate = GATE_TYPES.some(g => g.type === item.type);
                        const nodeInfo = isGate
                            ? { type: 'gate' as const, gateType: item.type as FtaGateType }
                            : { type: 'event' as const, eventType: item.type as FtaEventType};
                        return (
                            <div key={item.type} className="fta-palette-item" draggable onDragStart={(e) => handleDragStart(e, nodeInfo)}>
                                <FtaShape node={nodeInfo} />
                                <span>{item.label}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-4 pt-4 border-t dark:border-gray-600 flex-shrink-0">
                    <button onClick={handleCalculate} className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
                        Hesapla
                    </button>
                </div>
            </div>
            <div 
                className="fta-canvas"
                ref={canvasRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOnCanvas}
                onMouseLeave={handleMouseUpOnCanvas}
            >
                <svg className="fta-lines">
                    {lines.map(line => <line {...line} />)}
                    {connectionState && (
                        <line 
                            x1={connectionState.startX} y1={connectionState.startY}
                            x2={connectionState.endX} y2={connectionState.endY}
                            className="fta-preview-line"
                        />
                    )}
                </svg>
                {allNodes.map(node => {
                    const isValidDropTarget = !!connectionState?.startNodeId &&
                        connectionState.startNodeId !== node.id &&
                        !hasPath(node.id, connectionState.startNodeId);
                    
                    const isTopEvent = data.topEvent ? node.id === data.topEvent.id : false;

                    return (
                        <FtaNodeView
                            key={node.id}
                            node={node}
                            onUpdateText={onUpdateText}
                            onUpdateP={onUpdateP}
                            onUpdateHouseValue={onUpdateHouseValue}
                            onDelete={handleDelete}
                            onDragStart={handleNodeDragStart}
                            onConnectionStart={handleConnectionStart}
                            isDropTarget={dropTargetId === node.id && isValidDropTarget}
                            onSetDropTarget={setDropTargetId}
                            parentId={parentMap.get(node.id)}
                            onDisconnect={handleDisconnect}
                            isTopEvent={isTopEvent}
                        />
                    );
                })}
                <button
                    type="button"
                    onClick={() => setIsResultsPanelOpen(!isResultsPanelOpen)}
                    className="fta-results-toggle"
                    title={isResultsPanelOpen ? "Paneli Gizle" : "Paneli Göster"}
                >
                    {isResultsPanelOpen ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeftIcon className="w-5 h-5" />}
                </button>
            </div>
            <div className="fta-results-panel space-y-4 overflow-hidden flex flex-col">
                <div id="resultWrap" className="p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 flex-shrink-0">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-2">FTA Hesaplama Sonucu</h4>
                    {calculationResult ? (
                        <>
                            <div className="text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Tepe Olay Olasılığı</p>
                                <div className="fta-result-panel-metric">{(calculationResult.p).toExponential(4)}</div>
                            </div>
                            {calculationResult.fixes && calculationResult.fixes.length > 0 && (
                                <div className="mt-2">
                                    <h5 className="font-semibold text-xs text-blue-600 dark:text-blue-400">Otomatik Düzeltmeler</h5>
                                    <ul className="text-xs text-blue-700 dark:text-blue-300 list-disc list-inside">
                                        {calculationResult.fixes.map((fix, i) => <li key={i}>{fix}</li>)}
                                    </ul>
                                </div>
                            )}
                            {calculationResult.warnings && calculationResult.warnings.length > 0 && (
                                <div className="mt-2">
                                    <h5 className="font-semibold text-xs text-yellow-600 dark:text-yellow-400">Uyarılar</h5>
                                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                                        {calculationResult.warnings.map((warn, i) => <li key={i}><strong>{warn.id}:</strong> {warn.message}</li>)}
                                    </ul>
                                </div>
                            )}
                            <div className="mt-2">
                                    <h5 className="font-semibold text-xs text-gray-600 dark:text-gray-400">Hesaplama Adımları</h5>
                                <pre className="fta-result-panel-out">{calculationResult.steps}</pre>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-gray-500 dark:text-gray-400 italic py-4">
                            Hesaplama yapmak için "Hesapla" butonuna basın.
                        </div>
                    )}
                </div>
                {calculationResult?.insightsText && (
                    <div id="insights" className="p-4 bg-blue-50 dark:bg-gray-900 border border-blue-200 dark:border-blue-700 rounded-lg flex-grow min-h-0 overflow-y-auto">
                            <h4 className="font-semibold text-blue-800 dark:text-blue-200 text-sm mb-2">Hesaplama Sonrası Yorumlar</h4>
                            <pre className="whitespace-pre-wrap text-xs font-mono text-gray-700 dark:text-gray-300">
                            {calculationResult.insightsText}
                            </pre>
                    </div>
                )}
            </div>
        </div>
    );
};

const ParetoAnalysisTool: React.FC = () => {
    // FIX: Added interface for type safety and to allow 'other' property.
    interface ParetoRow {
        name: string;
        value: number;
        share: number;
        cum: number;
        other?: boolean;
    }

    useEffect(() => {
        const $ = (id: string) => document.getElementById(id);
        // FIX: Conversion of type 'HTMLElement' to type 'SVGElement' is a mistake. Cast to 'unknown' first.
        const svg = $('p-svg') as unknown as SVGElement | null;
        const msg = $('p-msg');
        const badge = $('p-badge');
        let tableRows: ParetoRow[] = [];

        if (!$('p-thr-mode') || !$('p-thr-custom') || !$('p-sample') || !$('p-csv') || !$('p-build') || !svg || !msg || !badge) {
            console.error("Pareto component elements not found");
            return;
        }

        const handleThrModeChange = () => {
            ($('p-thr-custom') as HTMLElement).style.display = (($('p-thr-mode') as HTMLSelectElement).value === 'custom') ? '' : 'none';
        };

        const handleSampleClick = () => {
            ($('p-data') as HTMLTextAreaElement).value =
`Operatör Hatası, 18
CNC Ayarsızlığı, 12
Hammadde Kusuru, 7
Bağlantı Gevşemesi, 6
Program Hatası, 5
Kesici Aşınması, 4
Lojistik Gecikme, 3
Enerji Dalgalanması, 2
Diğer, 2`;
        };

        const handleCsvClick = () => {
            if (!tableRows.length) { note('Önce grafiği oluşturun.'); return; }
            const csv = "Kategori,Değer,Pay %,Kümülatif %\n" +
                tableRows.map(r => `${r.name},${r.value},${(r.share * 100).toFixed(2)}%,${(r.cum * 100).toFixed(2)}%`).join("\n");
            const blob = new Blob([csv], { type: 'text/csv' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = 'pareto.csv'; a.click(); URL.revokeObjectURL(a.href);
        };

        const build = () => {
            const rawData = ($('p-data') as HTMLTextAreaElement)?.value || '';
            const data = parse(rawData); if (!data.length) { note('Geçerli veri girin: "Kategori, Değer".'); return; }
            data.sort((a, b) => b.value - a.value);
            const total = data.reduce((s, r) => s + r.value, 0) || 0;
            if (total === 0) { note('Toplam 0 olamaz.'); return; }

            const thrModeEl = $('p-thr-mode') as HTMLSelectElement;
            const thrCustomEl = $('p-thr') as HTMLInputElement;

            let thrPct = thrModeEl.value === 'custom' ? Number(thrCustomEl.value || 75) : Number(thrModeEl.value);
            thrPct = Math.max(1, Math.min(99, thrPct));
            badge!.textContent = `Eşik: %${thrPct}`;

            let cum = 0;
            const enriched: ParetoRow[] = data.map(r => { const share = r.value / total; cum += share; return { ...r, share, cum }; });

            let k = 0;
            for (let i = 0; i < enriched.length; i++) { k = i + 1; if (enriched[i].cum * 100 >= thrPct) break; }
            const keep: ParetoRow[] = enriched.slice(0, k);
            const rest = enriched.slice(k);
            if (rest.length) {
                const restVal = rest.reduce((s, r) => s + r.value, 0);
                keep.push({ name: 'Diğer', value: restVal, share: restVal / total, cum: 1, other: true });
            }

            drawSVG(keep);
            drawTable(keep, total);
            tableRows = keep;
            note('Pareto oluşturuldu', true);
        };

        const note = (t: string, ok = false) => {
            if (msg) {
                msg.textContent = t;
                msg.className = 'note ' + (ok ? 'ok' : 'err');
                setTimeout(() => { msg.textContent = ''; msg.className = 'note'; }, 2200);
            }
        };
        
        const parse = (raw: string) => {
            return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(line => {
                const ix = line.lastIndexOf(','); if (ix < 0) return null;
                const name = line.slice(0, ix).trim(); const val = Number(line.slice(ix + 1).trim());
                if (!name || !(val >= 0)) return null; return { name, value: val };
            }).filter(Boolean) as {name: string, value: number}[];
        };
        
        const drawTable = (rows: ParetoRow[], total: number) => {
            const t = $('p-table');
            if(!t) return;
            const pct = (x: number) => (x * 100).toFixed(2) + '%';
            t.innerHTML = `
                <thead><tr><th>#</th><th>Kategori</th><th>Değer</th><th>Pay</th><th>Kümülatif</th></tr></thead>
                <tbody>
                ${rows.map((r, i) => `
                    <tr><td>${i + 1}</td><td>${r.name}</td><td>${r.value}</td><td>${pct(r.share || 0)}</td><td>${pct(r.cum || 0)}</td></tr>
                `).join('')}
                <tr><td></td><td><b>Toplam</b></td><td><b>${total}</b></td><td colspan="2"></td></tr>
                </tbody>`;
        };
        
        const drawSVG = (rows: ParetoRow[]) => {
            if (!svg) return;

            const isDarkMode = document.documentElement.classList.contains('dark');
            const gridLineColor = isDarkMode ? '#374151' : '#e5e7eb';
            const axisTextColor = isDarkMode ? '#9ca3af' : '#6b7280';
            const mainTextColor = isDarkMode ? '#d1d5db' : '#374151';
            const chartTitleColor = isDarkMode ? '#9ca3af' : '#6b7280';

            while (svg!.firstChild) svg!.removeChild(svg!.firstChild);
            const W = svg!.clientWidth || 640, H = svg!.clientHeight || 380;
            const pad = { l: 48, r: 40, t: 20, b: 60 }, w = W - pad.l - pad.r, h = H - pad.t - pad.b;

            const maxVal = Math.max(1, ...rows.map(r => r.value));
            const yVal = (v: number) => pad.t + h - (v / maxVal) * h;
            const yPct = (p: number) => pad.t + h - p * h;
            const n = rows.length, bw = w / Math.max(n, 1) * 0.7, gap = w / Math.max(n, 1) * 0.3;

            [0, 0.25, 0.5, 0.75, 1].forEach(p => {
                const y = yPct(p);
                svg!.appendChild(ns('line', { x1: pad.l, y1: y, x2: W - pad.r, y2: y, stroke: gridLineColor, 'stroke-width': 1 }));
                svg!.appendChild(tx((p * 100).toFixed(0) + '%', pad.l - 8, y + 3, 'end', axisTextColor, 10));
            });
            
            const ticks = 4; for (let i = 0; i <= ticks; i++) { const v = i * (maxVal / ticks), y = yVal(v); svg!.appendChild(tx(String(Math.round(v)), pad.l - 8, y + 3, 'end', mainTextColor, 10)); }

            let cx = pad.l + gap * 0.5;
            rows.forEach(r => {
                const hBar = Math.max(0.5, h * (r.value / maxVal));
                svg!.appendChild(ns('rect', { x: cx, y: pad.t + h - hBar, width: bw, height: hBar, fill: r.other ? '#94a3b8' : '#60a5fa', stroke: '#1d4ed8', 'stroke-width': 1 }));
                svg!.appendChild(tx(short(r.name), cx + bw / 2, pad.t + h + 14, 'middle', mainTextColor, 10, -45));
                cx += bw + gap;
            });

            const pts: [number, number][] = []; cx = pad.l + gap * 0.5 + bw / 2;
            rows.forEach((r, i) => {
                const cum = (i === rows.length - 1 && r.other) ? 1 : r.cum;
                pts.push([cx, yPct(cum || 0)]);
                cx += bw + gap;
            });
            for (let i = 0; i < pts.length - 1; i++) {
                const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
                svg!.appendChild(ns('line', { x1, y1, x2, y2, stroke: '#22d3ee', 'stroke-width': 3 }));
            }
            pts.forEach(([x, y]) => svg!.appendChild(ns('circle', { cx: x, cy: y, r: 3.5, fill: '#22d3ee' })));

            svg!.appendChild(tx('% Kümülatif', W - pad.r, pad.t - 6, 'end', chartTitleColor, 11));
            svg!.appendChild(tx('Sıklık', pad.l, pad.t - 6, 'start', chartTitleColor, 11));
        };

        const ns = (tag: string, attrs: Record<string, any>) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, String(attrs[k])); return e; }
        const tx = (str: string, x: number, y: number, anchor: string, fill: string, fs: number, rot?: number) => { const t = ns('text', { x, y, fill: fill || '#dbeafe', 'font-size': fs || 11, 'text-anchor': anchor || 'start' }); if (rot) t.setAttribute('transform', `rotate(${rot},${x},${y})`); t.textContent = str; return t; }
        const short = (s: string) => { return s.length > 14 ? s.slice(0, 12) + '…' : s; }

        $('p-thr-mode')?.addEventListener('change', handleThrModeChange);
        $('p-sample')?.addEventListener('click', handleSampleClick);
        $('p-csv')?.addEventListener('click', handleCsvClick);
        $('p-build')?.addEventListener('click', build);

        // Cleanup function
        return () => {
            $('p-thr-mode')?.removeEventListener('change', handleThrModeChange);
            $('p-sample')?.removeEventListener('click', handleSampleClick);
            $('p-csv')?.removeEventListener('click', handleCsvClick);
            $('p-build')?.removeEventListener('click', build);
        };

    }, []);

    return (
        <section>
            <div className="pa">
                <div className="pa-h">
                <h3>Pareto Analizi</h3>
                <button className="btn" id="p-csv">CSV İndir</button>
                </div>

                <div className="pa-g">
                <div className="card">
                    <h4>Veri Girişi</h4>
                    <div className="row">
                    <textarea id="p-data" className="in" rows={10} placeholder="Her satıra: kategori, değer&#10;Ör:&#10;Operatör Hatası, 18&#10;CNC Ayarsızlığı, 12&#10;Hammadde Kusuru, 7"></textarea>
                    </div>
                    <h4>Ayarlar</h4>
                    <div className="row">
                    <label style={{width:'120px'}}>Eşik (Kümülatif %)</label>
                    <select id="p-thr-mode" className="sel">
                        <option value="80">80</option>
                        <option value="70">70</option>
                        <option value="custom">Özel…</option>
                    </select>
                    </div>
                    <div className="row" id="p-thr-custom" style={{display:'none'}}>
                    <label style={{width:'120px'}}>Özel Eşik (%)</label>
                    <input id="p-thr" className="in" type="number" min="1" max="99" step="1" defaultValue="75"/>
                    </div>
                    <div className="row">
                    <button className="btn" id="p-build">Grafiği Oluştur</button>
                    <span id="p-msg" className="note"></span>
                    </div>
                    <details style={{marginTop:'6px'}}><summary className="note">Örnek veri doldur</summary>
                    <div className="row"><button className="btn" id="p-sample">Üretim Hataları Örneği</button></div>
                    </details>
                </div>

                <div className="card">
                    <h4>Grafik</h4>
                    <div className="legend">
                    <div className="lgb"></div><span className="note">Sıklık (bar)</span>
                    <div className="lgl"></div><span className="note">Kümülatif % (çizgi)</span>
                    <span id="p-badge" className="badge">Eşik: %80</span>
                    </div>
                    <svg id="p-svg"></svg>
                    <table className="tbl" id="p-table"></table>
                </div>
                </div>
            </div>
        </section>
    );
};


const FiveWhyModal: React.FC<FiveWhyModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    
    const getInitialState = (): FiveWhyAnalysis => ({
        occurrence: [{ id: `why-occ-${Date.now()}`, why: '', because: '' }],
        nonDetection: [{ id: `why-nd-${Date.now()}`, why: '', because: '' }],
        occurrenceRootCause: '', nonDetectionRootCause: '',
        fishbone: {
            problem: '',
            categories: [
                { name: 'İnsan', causes: [] }, { name: 'Yöntem', causes: [] }, { name: 'Makine', causes: [] },
                { name: 'Malzeme', causes: [] }, { name: 'Ölçüm', causes: [] }, { name: 'Çevre', causes: [] },
            ]
        },
        fta: {
            topEvent: {
                id: `fta-top-${Date.now()}`,
                type: 'event',
                eventType: 'INTERMEDIATE',
                text: 'Tepe Olay (Problem)',
                children: [],
                x: 450,
                y: 20
            },
            floatingNodes: [],
        },
        pareto: {
            inputData: '',
            thresholdMode: '80',
            customThreshold: 75
        },
        scatter: {
            inputData: `PIQ,Brain,Height,Weight\n96,90,70,150\n114,96,74,160\n101,90,68,135\n110,88,73,155\n120,98,72,165\n88,85,66,120\n130,105,76,175\n94,92,69,140\n118,99,71,168\n102,91,70,145\n108,94,72,152\n95,86,68,132\n121,100,74,170\n112,97,73,158\n100,89,69,142`,
            matrixCols: ['PIQ', 'Brain', 'Height', 'Weight'],
            simpleX: 'Brain',
            simpleY: 'PIQ',
            showMatrixTrend: true,
            showMatrixR: true,
            showMatrixHeat: false,
            alpha: 0.05,
            showSimpleTrend: true,
        }
    });
    
    const [activeTab, setActiveTab] = useState<'5why' | 'fishbone' | 'fta' | 'pareto' | 'scatter'>('5why');
    const [fishboneData, setFishboneData] = useState(initialData?.fishbone || getInitialState().fishbone!);
    const [ftaData, setFtaData] = useState(initialData?.fta || getInitialState().fta!);
    const [scatterData, setScatterData] = useState(initialData?.scatter || getInitialState().scatter!);

    // Internal state for UI
    const [occurrenceProblem, setOccurrenceProblem] = useState('');
    const [occurrenceChain, setOccurrenceChain] = useState<AnalysisChain[]>([]);
    const [nonDetectionProblem, setNonDetectionProblem] = useState('');
    const [nonDetectionChain, setNonDetectionChain] = useState<AnalysisChain[]>([]);
    
    const [newCauses, setNewCauses] = useState<Record<string, string>>(
        Object.fromEntries(getInitialState().fishbone!.categories.map(c => [c.name, '']))
    );
    const [editingCause, setEditingCause] = useState<{ categoryName: string; index: number } | null>(null);
    const [editingText, setEditingText] = useState('');
    
    const initialDataString = useMemo(() => JSON.stringify(initialData), [initialData]);

    useEffect(() => {
        if (isOpen) {
            const data = initialData || getInitialState();
            
            // Convert from FiveWhyStep[] to our UI's chain model
            const validOccurrence = data.occurrence.filter(s => s.why || s.because);
            setOccurrenceProblem(validOccurrence[0]?.why ?? '');
            setOccurrenceChain(validOccurrence.map(s => ({id: s.id, text: s.because})));

            const validNonDetection = data.nonDetection.filter(s => s.why || s.because);
            setNonDetectionProblem(validNonDetection[0]?.why ?? '');
            setNonDetectionChain(validNonDetection.map(s => ({id: s.id, text: s.because})));

            setFishboneData(data.fishbone || getInitialState().fishbone!);
            
            const initialFta = data.fta || getInitialState().fta!;
            if (initialFta.topEvent && (initialData?.fishbone?.problem || data.occurrence[0]?.why)) {
               initialFta.topEvent.text = initialData?.fishbone?.problem || data.occurrence[0]?.why || 'Tepe Olay';
            }
            setFtaData(initialFta);

            setScatterData(data.scatter || getInitialState().scatter!);

            if (data.pareto) {
                setTimeout(() => {
                    const dataEl = document.getElementById('p-data') as HTMLTextAreaElement;
                    const modeEl = document.getElementById('p-thr-mode') as HTMLSelectElement;
                    const customEl = document.getElementById('p-thr') as HTMLInputElement;
                    const buildBtn = document.getElementById('p-build') as HTMLButtonElement;

                    if (dataEl) dataEl.value = data.pareto.inputData;
                    if (modeEl) modeEl.value = data.pareto.thresholdMode;
                    if (customEl) customEl.value = String(data.pareto.customThreshold);
                    
                    if (modeEl) {
                        modeEl.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    if (buildBtn && data.pareto.inputData) {
                        buildBtn.click();
                    }
                }, 100);
            }
        }
    }, [initialDataString, isOpen]);

    // Fishbone handlers
    const handleFishboneChange = (field: 'problem' | 'categories', value: any) => {
        setFishboneData(prev => ({ ...prev, [field]: value }));
    };

    const addCause = (categoryName: string) => {
        const causeText = newCauses[categoryName]?.trim();
        if (!causeText) return;

        const updatedCategories = fishboneData.categories.map(cat => {
            if (cat.name === categoryName) {
                return { ...cat, causes: [...cat.causes, causeText] };
            }
            return cat;
        });
        handleFishboneChange('categories', updatedCategories);
        setNewCauses(prev => ({...prev, [categoryName]: ''}));
    };

    const removeCause = (categoryName: string, causeIndex: number) => {
        const updatedCategories = fishboneData.categories.map(cat => {
            if (cat.name === categoryName) {
                return { ...cat, causes: cat.causes.filter((_, i) => i !== causeIndex) };
            }
            return cat;
        });
        handleFishboneChange('categories', updatedCategories);
    };

    const startEditingCause = (categoryName: string, index: number, text: string) => {
        setEditingCause({ categoryName, index });
        setEditingText(text);
    };

    const saveEditingCause = () => {
        if (!editingCause) return;
        const { categoryName, index } = editingCause;
        const trimmedText = editingText.trim();

        if (trimmedText) {
            const updatedCategories = fishboneData.categories.map(cat => {
                if (cat.name === categoryName) {
                    const newCauses = [...cat.causes];
                    newCauses[index] = trimmedText;
                    return { ...cat, causes: newCauses };
                }
                return cat;
            });
            handleFishboneChange('categories', updatedCategories);
        }
        setEditingCause(null);
        setEditingText('');
    };

    const handleEditInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEditingCause();
        }
        if (e.key === 'Escape') {
            setEditingCause(null);
            setEditingText('');
        }
    };
    
    const handleSubmit = () => {
        const paretoData: ParetoAnalysisData = {
            inputData: (document.getElementById('p-data') as HTMLTextAreaElement)?.value || '',
            thresholdMode: (document.getElementById('p-thr-mode') as HTMLSelectElement)?.value as '70' | '80' | 'custom' || '80',
            customThreshold: Number((document.getElementById('p-thr') as HTMLInputElement)?.value || 75)
        };
        // Convert UI state back to the parent component's expected format
        const finalAnalysis: FiveWhyAnalysis = {
            occurrence: occurrenceChain.map((link, i) => ({
                id: link.id,
                why: i === 0 ? occurrenceProblem : occurrenceChain[i - 1].text,
                because: link.text
            })),
            nonDetection: nonDetectionChain.map((link, i) => ({
                id: link.id,
                why: i === 0 ? nonDetectionProblem : nonDetectionChain[i - 1].text,
                because: link.text
            })),
            occurrenceRootCause: occurrenceChain[occurrenceChain.length - 1]?.text || '',
            nonDetectionRootCause: nonDetectionChain[nonDetectionChain.length - 1]?.text || '',
            fishbone: fishboneData,
            fta: ftaData,
            pareto: paretoData,
            scatter: scatterData,
        };
        // Add a placeholder if the chain is empty but there was a problem
        if (finalAnalysis.occurrence.length === 0 && occurrenceProblem) {
             finalAnalysis.occurrence.push({ id: `why-occ-${Date.now()}`, why: occurrenceProblem, because: '' });
        }
        if (finalAnalysis.nonDetection.length === 0 && nonDetectionProblem) {
             finalAnalysis.nonDetection.push({ id: `why-nd-${Date.now()}`, why: nonDetectionProblem, because: '' });
        }
        
        onSave(finalAnalysis);
    };

    const TabButton: React.FC<{ tabName: '5why' | 'fishbone' | 'fta' | 'pareto' | 'scatter', label: string }> = ({ tabName, label }) => (
         <button
            type="button"
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tabName 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
            }`}
        >
            {label}
        </button>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Kök Neden Analizi" size="7xl">
            <div className="flex flex-wrap items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-700 pb-3">
                <TabButton tabName="5why" label="5N Analizi" />
                <TabButton tabName="fishbone" label="Balık Kılçığı" />
                <TabButton tabName="fta" label="Hata Ağacı (FTA)" />
                <TabButton tabName="pareto" label="Pareto Analizi" />
                <TabButton tabName="scatter" label="Dağılım Grafiği (Scatter)" />
            </div>
            <div className="p-1" style={{minHeight: '85vh'}}>
                {activeTab === '5why' ? (
                    <div className="space-y-6 h-full overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                           <AnalysisPath 
                                title="Oluşum (Problem Neden Ortaya Çıktı?)"
                                problem={occurrenceProblem}
                                setProblem={setOccurrenceProblem}
                                chain={occurrenceChain}
                                setChain={setOccurrenceChain}
                           />
                           <AnalysisPath 
                                title="Saptanamama (Problem Neden Fark Edilemedi?)"
                                problem={nonDetectionProblem}
                                setProblem={setNonDetectionProblem}
                                chain={nonDetectionChain}
                                setChain={setNonDetectionChain}
                           />
                        </div>
                    </div>
                ) : activeTab === 'fishbone' ? (
                    <div className="fishbone-diagram h-full overflow-y-auto">
                        <div className="category-grid">
                            {fishboneData?.categories.map((cat) => (
                                <div key={cat.name} className="category-card">
                                     <h4 className="font-bold text-center text-blue-600 dark:text-blue-400">{cat.name}</h4>
                                     <ul className="text-sm space-y-1 mt-2 min-h-[50px]">
                                        {cat.causes.map((cause, causeIdx) => (
                                            <li key={causeIdx} className="group flex items-center justify-between gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600">
                                                 {editingCause?.categoryName === cat.name && editingCause?.index === causeIdx ? (
                                                    <input
                                                        type="text"
                                                        value={editingText}
                                                        onChange={(e) => setEditingText(e.target.value)}
                                                        onBlur={saveEditingCause}
                                                        onKeyDown={handleEditInputKeyDown}
                                                        autoFocus
                                                        className="w-full text-sm bg-white dark:bg-gray-500 border border-blue-500 rounded p-0.5 focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    <>
                                                        <span className="flex-grow break-all">{cause}</span>
                                                        <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => startEditingCause(cat.name, causeIdx, cause)} className="p-1 text-blue-500 hover:text-blue-700" title="Düzenle"><EditIcon className="w-4 h-4" /></button>
                                                            <button onClick={() => removeCause(cat.name, causeIdx)} className="p-1 text-red-500 hover:text-red-700" title="Sil"><TrashIcon className="w-4 h-4" /></button>
                                                        </div>
                                                    </>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-2 flex">
                                        <input type="text" placeholder="Neden ekle..." value={newCauses[cat.name]} onChange={e => setNewCauses(p => ({...p, [cat.name]: e.target.value}))} onKeyDown={e => e.key === 'Enter' && addCause(cat.name)} className="w-full text-xs p-1 form-input"/>
                                        <button onClick={() => addCause(cat.name)} className="p-1 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"><PlusIcon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="spine"></div>
                        <div className="head">
                            <textarea 
                                value={fishboneData?.problem} 
                                onChange={e => handleFishboneChange('problem', e.target.value)} 
                                placeholder="Problem veya Etki..." 
                                className="focus:outline-none"
                            ></textarea>
                        </div>
                    </div>
                ) : activeTab === 'fta' ? (
                    <FtaEditor data={ftaData} onChange={setFtaData} />
                ) : activeTab === 'pareto' ? (
                    <ParetoAnalysisTool />
                ) : activeTab === 'scatter' ? (
                    <ScatterPlotMatrix data={scatterData} onChange={setScatterData} />
                ) : null}
            </div>
            <div className="pt-6 flex justify-end gap-3 bg-gray-50 dark:bg-gray-700 -mx-6 -mb-4 px-6 py-3 rounded-b-lg">
                <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">İptal</button>
                <button type="button" onClick={handleSubmit} className="px-8 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Analizi Kaydet</button>
            </div>
        </Modal>
    );
};

export default FiveWhyModal;


// Helper styles for form elements - Tailwind doesn't have these by default
const formStyles = `
  .form-input, .form-textarea, .form-select, .form-radio {
    color: #111827;
    background-color: #fff;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }
  .form-input, .form-textarea, .form-select {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
  .dark .form-input, .dark .form-textarea, .dark .form-select, .dark .form-radio {
    color: #d1d5db;
    background-color: #374151;
    border-color: #4b5563;
  }
  .form-input:focus, .form-textarea:focus, .form-select:focus, .form-radio:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px #4f46e5;
  }
  .form-radio {
    padding: 0;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    -webkit-print-color-adjust: exact;
    color-adjust: exact;
    display: inline-block;
    vertical-align: middle;
    background-origin: border-box;
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
    flex-shrink: 0;
    border-radius: 100%;
  }
  .form-radio:checked {
    background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e");
    border-color: transparent;
    background-color: currentColor;
    background-size: 100% 100%;
    background-position: center;
    background-repeat: no-repeat;
  }
  .dark .form-radio:checked {
    color: #60a5fa;
  }
`;

// Avoid re-creating the stylesheet if it already exists from another modal
if (!document.getElementById('form-styles-sheet')) {
    const styleSheet = document.createElement("style");
    styleSheet.id = 'form-styles-sheet';
    styleSheet.innerText = formStyles;
    document.head.appendChild(styleSheet);
}