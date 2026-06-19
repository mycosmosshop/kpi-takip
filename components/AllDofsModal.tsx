import React, { useMemo, useState, useEffect } from 'react';
import { Kpi, Dof, ModalType, DofStatus, ScatterPlotAnalysisData } from '../types';
import Modal from './Modal';
import { EditIcon, TrashIcon, MagnifyingGlassIcon, UserIcon, CalendarIcon, PdfIcon, DocumentDuplicateIcon, ChartBarIcon } from './icons';
import ScatterPlotMatrix from './ScatterPlotMatrix';

interface AllDofsModalProps {
    isOpen: boolean;
    onClose: () => void;
    allKpis: Kpi[];
    onOpenModal: (type: ModalType, data: any) => void;
    onDeleteDof: (kpiId: string, dofId: string) => void;
}

type DofWithKpi = Dof & {
    kpiAdi: string;
    proses: string;
    kpiOrtalama: number | null;
};

const AllDofsModal: React.FC<AllDofsModalProps> = ({ isOpen, onClose, allKpis, onOpenModal, onDeleteDof }) => {
    const [statusFilter, setStatusFilter] = useState<DofStatus | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<'list' | 'scatter'>('list');

    const [scatterData, setScatterData] = useState<ScatterPlotAnalysisData>({
        inputData: `Hata Sayısı,Duruş Süresi (dk),Operatör Tecrübesi (ay),Makine Yaşı (yıl)\n12,45,24,5\n8,30,60,2\n15,55,12,8\n5,20,120,1\n10,35,36,4\n14,50,18,7\n7,25,84,3\n11,40,30,6\n4,15,150,1\n9,32,48,3`,
        matrixCols: ['Hata Sayısı', 'Duruş Süresi (dk)'],
        simpleX: 'Operatör Tecrübesi (ay)',
        simpleY: 'Hata Sayısı',
        showMatrixTrend: true,
        showMatrixR: true,
        showMatrixHeat: false,
        alpha: 0.05,
        showSimpleTrend: true,
    });

    useEffect(() => {
        if (isOpen) {
            setView('list');
        }
    }, [isOpen]);

    const allDofs = useMemo((): DofWithKpi[] => {
        return allKpis.flatMap(kpi => 
            kpi.dof.map(dof => ({
                ...dof,
                kpiAdi: kpi.kpi_adi,
                proses: kpi.proses,
                kpiOrtalama: kpi.ortalama,
            }))
        ).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    }, [allKpis]);

    const filteredDofs = useMemo(() => {
        return allDofs.filter(dof => {
            const matchesStatus = statusFilter === 'all' || dof.durum === statusFilter;
            const lowerSearchTerm = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || 
                (dof.problemTanimi && dof.problemTanimi.toLowerCase().includes(lowerSearchTerm)) ||
                // FIX: `kaliciAksiyonlar` is an array of objects. Search within each action's text.
                (dof.kaliciAksiyonlar && Array.isArray(dof.kaliciAksiyonlar) && dof.kaliciAksiyonlar.some(ca => ca.action && ca.action.toLowerCase().includes(lowerSearchTerm))) ||
                (dof.aksiyon && dof.aksiyon.toLowerCase().includes(lowerSearchTerm)) || // backward compatibility
                dof.sorumlu.toLowerCase().includes(lowerSearchTerm) ||
                dof.kpiAdi.toLowerCase().includes(lowerSearchTerm) ||
                dof.proses.toLowerCase().includes(lowerSearchTerm);
            return matchesStatus && matchesSearch;
        });
    }, [allDofs, statusFilter, searchTerm]);

    const isOverdue = (dof: Dof) => {
        return new Date(dof.due_date) < new Date() && dof.durum !== 'Tamamlandı';
    };

    const getStatusColor = (status: DofStatus) => {
        switch (status) {
            case 'Açık': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 ring-red-200 dark:ring-red-800';
            case 'Devam': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 ring-yellow-200 dark:ring-yellow-800';
            case 'Tamamlandı': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 ring-green-200 dark:ring-green-800';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200 ring-gray-200 dark:ring-gray-700';
        }
    };
     const getProgressBarColor = (progress: number) => {
        if (progress < 25) return 'bg-red-500';
        if (progress < 75) return 'bg-yellow-500';
        return 'bg-green-500';
    };
    
    const handleGenerateListPdf = () => {
        if (!window.html2pdf) {
            alert("PDF oluşturma kütüphanesi yüklenemedi.");
            return;
        }

        const reportContainer = document.createElement('div');
        reportContainer.className = "p-8 font-sans";

        const tableHTML = `
            <style>
                table { width: 100%; border-collapse: collapse; font-size: 9px; }
                th, td { padding: 6px; border: 1px solid #ddd; text-align: left; word-break: break-word; }
                th { background-color: #f2f2f2; font-weight: bold; }
                thead { display: table-header-group; }
            </style>
            <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">DÖF Listesi Raporu</h1>
            <p style="font-size: 12px; color: #555; margin-bottom: 24px;">Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}</p>
            <table>
                <thead>
                    <tr>
                        <th>Durum</th>
                        <th>İlgili KPI</th>
                        <th>KPI Ort.</th>
                        <th>Problem Tanımı / Aksiyon</th>
                        <th>Sorumlu</th>
                        <th>Termin</th>
                        <th>İlerleme</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredDofs.map(dof => `
                        <tr>
                            <td>${dof.durum}</td>
                            <td>${dof.proses} - ${dof.kpiAdi}</td>
                            <td>${dof.kpiOrtalama ?? 'N/A'}</td>
                            <td>${dof.problemTanimi || dof.aksiyon}</td>
                            <td>${dof.sorumlu}</td>
                            <td>${new Date(dof.due_date).toLocaleDateString('tr-TR')}</td>
                            <td>${dof.ilerleme}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        reportContainer.innerHTML = tableHTML;
        
        const filename = `dof_listesi_${new Date().toISOString().split('T')[0]}.pdf`;
        const options = {
            margin: 10,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        };

        window.html2pdf().set(options).from(reportContainer).save();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="DÖF Paneli" size="5xl">
             <div>
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                    <button
                        className={`px-4 py-2 text-sm font-medium ${view === 'list' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        onClick={() => setView('list')}
                    >
                        DÖF Listesi ({filteredDofs.length})
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium ${view === 'scatter' ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        onClick={() => setView('scatter')}
                    >
                        Scatter Analizi
                    </button>
                </div>

                {view === 'list' ? (
                    <div className="space-y-4">
                        {/* Filter Controls */}
                        <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-100 dark:bg-gray-900/50 rounded-lg border dark:border-gray-700">
                            <div className="relative flex-grow">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Ara (Problem, Aksiyon, Sorumlu, KPI...)"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:border-gray-600"
                                />
                            </div>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="block py-2 pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-800 dark:border-gray-600">
                                <option value="all">Tüm Durumlar</option>
                                <option value="Açık">Açık</option>
                                <option value="Devam">Devam Ediyor</option>
                                <option value="Tamamlandı">Tamamlandı</option>
                            </select>
                            <button onClick={handleGenerateListPdf} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                                <PdfIcon className="w-4 h-4" /> Listeyi PDF İndir
                            </button>
                        </div>

                        {/* DÖF Cards */}
                        <div className="max-h-[65vh] overflow-y-auto space-y-4 pr-2">
                            {filteredDofs.length > 0 ? filteredDofs.map(dof => {
                                const kpi = allKpis.find(k => k.id === dof.kpiId);
                                if (!kpi) return null;
                                const cardTitle = dof.problemTanimi || dof.aksiyon; // Backward compatibility

                                return (
                                    <div key={dof.id}
                                        className="group relative p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm transition-all duration-200 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer"
                                        onClick={() => onOpenModal('dof-report', { dof, kpi })}
                                    >
                                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            <button onClick={(e) => { e.stopPropagation(); onOpenModal('copy-dof', { dof, kpi }) }} className="p-2 text-gray-600 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full" title="Kopyala">
                                                <DocumentDuplicateIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onOpenModal('dof', { ...dof, kpiId: dof.kpiId, returnTo: 'all-dofs' }) }} className="p-2 text-blue-600 bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full" title="Düzenle">
                                                <EditIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteDof(dof.kpiId, dof.id); }} className="p-2 text-red-600 bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full" title="Sil">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                            <div className="flex-1">
                                                <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full mb-2 ring-1 ring-inset ${getStatusColor(dof.durum)}`}>{dof.durum}</span>
                                                <p className="font-semibold text-gray-800 dark:text-gray-200 text-base leading-tight pr-16">{cardTitle}</p>
                                                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1.5">
                                                    <span className="font-medium text-gray-500 dark:text-gray-400">İlgili KPI:</span> {dof.proses} - {dof.kpiAdi}
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0 flex flex-col items-start sm:items-end gap-2 text-sm text-gray-600 dark:text-gray-300 mt-2 sm:mt-0">
                                                <div className="flex items-center gap-2">
                                                    <UserIcon className="w-4 h-4 text-gray-400" />
                                                    <span>{dof.sorumlu}</span>
                                                </div>
                                                <div className={`flex items-center gap-2 ${isOverdue(dof) ? 'text-red-500 font-bold' : ''}`}>
                                                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                                                    <span>{new Date(dof.due_date).toLocaleDateString('tr-TR')}</span>
                                                </div>
                                                <div className="flex items-center gap-2 font-mono" title="İlgili KPI'ın Yıllık Ortalaması">
                                                    <ChartBarIcon className="w-4 h-4 text-gray-400" />
                                                    <span>{dof.kpiOrtalama ?? 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                                <div className={`h-2.5 rounded-full transition-colors duration-300 ${getProgressBarColor(dof.ilerleme)}`} style={{ width: `${dof.ilerleme}%` }}></div>
                                            </div>
                                            <div className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">{dof.ilerleme}%</div>
                                        </div>
                                    </div>
                                )
                            }) : (
                                <div className="text-center text-gray-500 dark:text-gray-400 italic py-12">
                                    <p className="text-lg">Filtrelerle eşleşen DÖF bulunamadı.</p>
                                    <p className="text-sm mt-1">Filtrelerinizi temizlemeyi veya yeni bir arama yapmayı deneyin.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-[75vh] overflow-y-auto pr-2 space-y-6">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Basit Dağılım Grafiği (X-Y)</h3>
                        <ScatterPlotMatrix
                            key="dof-panel-simple-scatter"
                            data={scatterData}
                            onChange={setScatterData}
                            initialView="simple"
                            showTabs={false}
                        />
                        <div className="border-t border-gray-200 dark:border-gray-700 my-6"></div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">İlişki Matrisi (Scatter Matrix)</h3>
                        <ScatterPlotMatrix
                            key="dof-panel-matrix-scatter"
                            data={scatterData}
                            onChange={setScatterData}
                            initialView="matrix"
                            showTabs={false}
                        />
                    </div>
                )}
                 <div className="pt-4 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Kapat</button>
                </div>
            </div>
        </Modal>
    );
};

export default AllDofsModal;