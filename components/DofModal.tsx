

import React, { useState, useEffect, useMemo } from 'react';
import { Dof, Kpi, DofStatus, FiveWhyAnalysis, CorrectiveAction, CorrectiveActionStatus, FtaNode, ModalType } from '../types';
import Modal from './Modal';
import { LightBulbIcon, ClipboardDocumentListIcon, UserIcon, CalendarIcon, WrenchScrewdriverIcon, CheckCircleIcon, PlusIcon, TrashIcon, CloseIcon } from './icons';
import { AYLAR, gunEkle, dofAyi, dofNoOner } from '../constants';
import { dofTaslagi } from '../utils/dofTaslak';
import FiveWhyModal from './FiveWhyModal';

interface DofModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (dof: Dof) => void;
    onUpdateDof: (dof: Dof) => void;
    /** Aynı prosesteki öteki KPI'lar — taslakta bağlam olarak kullanılır. */
    kardesKpiler?: Kpi[];
    onDelete: (kpiId: string, dofId: string) => void;
    dofData?: any;
    kpi?: Kpi;
    year: number;
    onOpenModal: (type: ModalType, data?: any) => void;
}

const STEPS = [
    { id: 'D0D1', name: 'D0 & D1: Plan ve Takım' },
    { id: 'D2', name: 'D2: Problemin Tanımı' },
    { id: 'D3', name: 'D3: Geçici Önlemler' },
    { id: 'D4', name: 'D4: Kök Neden Analizi' },
    { id: 'D5', name: 'D5: Kalıcı Aksiyonlar' },
    { id: 'D6', name: 'D6: Uygulama ve Doğrulama' },
    { id: 'D7', name: 'D7: Tekrarın Önlenmesi' },
    { id: 'D8', name: 'D8: Kapanış ve Takdir' },
];

const RootCausePickerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (selectedCauses: string[]) => void;
    allCauses: string[];
    initialSelectedCauses: string[];
}> = ({ isOpen, onClose, onSave, allCauses, initialSelectedCauses }) => {
    const [selected, setSelected] = useState(new Set(initialSelectedCauses));

    useEffect(() => {
        if (isOpen) {
            setSelected(new Set(initialSelectedCauses));
        }
    }, [isOpen, initialSelectedCauses]);

    const handleToggle = (cause: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(cause)) {
            newSelected.delete(cause);
        } else {
            newSelected.add(cause);
        }
        setSelected(newSelected);
    };

    const handleSave = () => {
        onSave(Array.from(selected));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Kök Nedenleri Bağla" size="xl">
            <div className="max-h-[60vh] overflow-y-auto space-y-2 p-1">
                {allCauses.map((cause, index) => (
                    <label key={index} className="flex items-center p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={selected.has(cause)}
                            onChange={() => handleToggle(cause)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-3 text-sm text-gray-800 dark:text-gray-200">{cause}</span>
                    </label>
                ))}
                 {allCauses.length === 0 && (
                    <p className="text-center text-gray-500 italic p-6">Bağlanacak kök neden bulunamadı. Lütfen D4 adımında analizi tamamlayın.</p>
                )}
            </div>
            <div className="pt-5 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">İptal</button>
                <button type="button" onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Kaydet</button>
            </div>
        </Modal>
    );
};

const DofModal: React.FC<DofModalProps> = ({ isOpen, onClose, onSave, onUpdateDof, onDelete, dofData, kpi, year, onOpenModal, kardesKpiler = [] }) => {
    const [isFiveWhyModalOpen, setFiveWhyModalOpen] = useState(false);
    const [isPickerOpen, setPickerOpen] = useState(false);
    const [currentActionIndex, setCurrentActionIndex] = useState<number | null>(null);
    const [activeStep, setActiveStep] = useState(STEPS[0].id);

    const getInitialState = (): Partial<Dof> => ({
        start_date: new Date().toISOString().split('T')[0],
        due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
        durum: 'Açık',
        ilerleme: 0,
        gercekKapanis: '',
        dofNo: '',
        takim: '',
        problemTanimi: '',
        geciciOnlemler: '',
        kaliciAksiyonlar: [],
        uygulamaDogrulama: '',
        uygulamaDogrulamaSorumlu: '',
        uygulamaDogrulamaTermin: '',
        tekrarinOnlenmesi: '',
        tekrarinOnlenmesiSorumlu: '',
        tekrarinOnlenmesiTermin: '',
        takdir: '',
        takdirSorumlu: '',
        takdirTermin: '',
        etkinlikKontroluNotlari: '',
        etkinlikKontrolSorumlusu: '',
        etkinlikKontrolTarihi: '',
        kokNedenAnalizi: {
            occurrence: [{ id: `why-occ-${Date.now()}`, why: '', because: '' }],
            nonDetection: [{ id: `why-nd-${Date.now()}`, why: '', because: '' }],
            occurrenceRootCause: '',
            nonDetectionRootCause: '',
            fishbone: {
                problem: '',
                categories: [
                    { name: 'İnsan', causes: [] }, { name: 'Yöntem', causes: [] }, { name: 'Makine', causes: [] },
                    { name: 'Malzeme', causes: [] }, { name: 'Ölçüm', causes: [] }, { name: 'Çevre', causes: [] },
                ]
            },
            fta: {
                topEvent: {
                    id: `fta-top-${Date.now()}`, type: 'event', eventType: 'INTERMEDIATE',
                    text: 'Tepe Olay (Problem)', children: [], x: 450, y: 20
                },
                floatingNodes: [],
            },
            pareto: {
                inputData: '', thresholdMode: '80', customThreshold: 75
            },
            // Dagilim grafigi BOS baslar. Varsayilan olarak ornek veri
            // (PIQ/Brain/Height/Weight) doluydu; her 8D raporunda urunle
            // ilgisi olmayan iki grafik basiliyordu. Kullanici kendi CSV'sini
            // yapistirir; denemek isterse aractaki "Örnek yükle" durur.
            scatter: {
                inputData: '',
                matrixCols: [], simpleX: '', simpleY: '',
                showMatrixTrend: true, showMatrixR: true, showMatrixHeat: false, alpha: 0.05, showSimpleTrend: true,
            }
        }
    });

    const [dof, setDof] = useState<Partial<Dof>>(getInitialState());

    useEffect(() => {
        if (isOpen) {
            setActiveStep(STEPS[0].id);
            if (dofData && dofData.id) { // Editing existing DÖF
                const initialState = getInitialState();
                const mergedKokNedenAnalizi = {
                    ...initialState.kokNedenAnalizi,
                    ...(dofData.kokNedenAnalizi || {}),
                };

                let migratedDof: Partial<Dof> = { 
                    ...initialState, 
                    ...dofData,
                    kokNedenAnalizi: mergedKokNedenAnalizi,
                };

                if (typeof dofData.kaliciAksiyonlar === 'string' && dofData.kaliciAksiyonlar) {
                    migratedDof.kaliciAksiyonlar = [{ id: `action-${Date.now()}`, action: dofData.kaliciAksiyonlar, responsible: dofData.sorumlu || '', dueDate: dofData.due_date, status: 'Açık' }];
                } 
                else if (dofData.aksiyon && (!dofData.kaliciAksiyonlar || dofData.kaliciAksiyonlar.length === 0)) {
                     migratedDof.kaliciAksiyonlar = [{ id: `action-${Date.now()}`, action: dofData.aksiyon, responsible: dofData.sorumlu || '', dueDate: dofData.due_date, status: 'Açık' }];
                }
                else {
                    migratedDof.kaliciAksiyonlar = dofData.kaliciAksiyonlar || [];
                }
                delete (migratedDof as any).aksiyon;
                delete (migratedDof as any).kok_neden;
                setDof(migratedDof);

            } else { // New DÖF
                const initialState = getInitialState();
                if (dofData?.month && year) {
                    const monthIndex = AYLAR.indexOf(dofData.month);
                    if (monthIndex > -1) {
                        const monthStr = String(monthIndex + 1).padStart(2, '0');
                        initialState.start_date = `${year}-${monthStr}-02`;
                        
                        initialState.due_date = gunEkle(initialState.start_date, 30);
                    }
                }
                setDof(initialState);
            }
        }
        // Bagimlilikta `kpi` YOK: modal acikken disaridaki bir KPI
        // guncellemesi formu acilis verisine dondurup yazilanlari
        // silebiliyordu.
    }, [dofData, isOpen, year]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        if (name === 'ilerleme') {
            const progress = parseInt(value, 10) || 0;
            let newStatus: DofStatus = 'Açık';
            if (progress > 0 && progress < 100) {
                newStatus = 'Devam';
            } else if (progress === 100) {
                newStatus = 'Tamamlandı';
            }
            setDof(prev => ({
                ...prev, ilerleme: progress, durum: newStatus,
                // %100'e gelince gercek kapanis bos ise bugun onerilir;
                // yazili bir tarih varsa dokunulmaz.
                gercekKapanis: newStatus === 'Tamamlandı' && !String(prev.gercekKapanis || '').trim()
                    ? new Date().toISOString().split('T')[0]
                    : prev.gercekKapanis,
            }));
        } else if (name === 'start_date') {
            setDof(prev => {
                const next: Partial<Dof> = { ...prev, start_date: value };
                // Termin ELLE degistirilmediyse (hâlâ eski baslangic + 30)
                // baslangicla birlikte kayar. Ilk acilista termin
                // baslangic + 30 kuruluyor; kullanici baslangici geri
                // cekince termin oldugu yerde kaliyor ve 30 gunluk DOF
                // 2 gunluk gorunuyordu (30.06 baslangica 02.07 termin).
                if (prev.start_date && prev.due_date
                        && gunEkle(prev.start_date, 30) === prev.due_date) {
                    next.due_date = gunEkle(value, 30) || prev.due_date;
                }
                return next;
            });
        } else {
            setDof(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleActionChange = (index: number, field: keyof Omit<CorrectiveAction, 'id'>, value: string | string[]) => {
        setDof(prev => {
            if (!prev || !prev.kaliciAksiyonlar) return prev;
            const newActions = [...prev.kaliciAksiyonlar];
            newActions[index] = { ...newActions[index], [field]: value };
            return { ...prev, kaliciAksiyonlar: newActions };
        });
    };

    const addAction = () => {
        setDof(prev => {
            if (!prev) return prev;
            const newAction: CorrectiveAction = {
                id: `action-${Date.now()}`,
                action: '',
                responsible: '',
                dueDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
                status: 'Açık',
                linkedRootCauses: []
            };
            const newActions = [...(prev.kaliciAksiyonlar || []), newAction];
            return { ...prev, kaliciAksiyonlar: newActions };
        });
    };

    const removeAction = (index: number) => {
        // Yalnizca formu gunceller. Onceden dogrudan kaydi yaziyordu
        // (onUpdateDof); kayit degisince kpi prop'u yenileniyor, useEffect
        // tetikleniyor ve form acilis verisiyle SIFIRLANIYORDU — bir
        // aksiyon silinince kaydedilmemis butun aksiyonlar gidiyordu.
        setDof(prev => ({
            ...prev,
            kaliciAksiyonlar: (prev.kaliciAksiyonlar || []).filter((_, i) => i !== index),
        }));
    };

    const handleSaveFiveWhy = (fiveWhyData: FiveWhyAnalysis) => {
        setDof(prev => ({ ...prev, kokNedenAnalizi: fiveWhyData }));
        setFiveWhyModalOpen(false);
    };
    
    const allRootCauses = useMemo(() => {
        if (!dof.kokNedenAnalizi) return [];
        const causes = new Set<string>();
        
        if (dof.kokNedenAnalizi.occurrenceRootCause) causes.add(dof.kokNedenAnalizi.occurrenceRootCause);
        if (dof.kokNedenAnalizi.nonDetectionRootCause) causes.add(dof.kokNedenAnalizi.nonDetectionRootCause);
        
        dof.kokNedenAnalizi.fishbone?.categories.forEach(cat => {
            cat.causes.forEach(cause => causes.add(cause));
        });

        if (dof.kokNedenAnalizi.fta) {
            const allNodesInFta: FtaNode[] = [];
            const collectNodes = (node: FtaNode) => {
                allNodesInFta.push(node);
                (node.children || []).forEach(collectNodes);
            };

            if (dof.kokNedenAnalizi.fta.topEvent) {
                collectNodes(dof.kokNedenAnalizi.fta.topEvent);
            }
            (dof.kokNedenAnalizi.fta.floatingNodes || []).forEach(collectNodes);
            
            for (const node of allNodesInFta) {
                // A root cause is any EVENT type node that has no children.
                if (node.type === 'event' && (!node.children || node.children.length === 0)) {
                    if (node.text.trim()) {
                        causes.add(`[FTA] ${node.text}`);
                    }
                }
            }
        }

        return Array.from(causes);
    }, [dof.kokNedenAnalizi]);


    const handleLinkRootCause = (index: number) => {
        setCurrentActionIndex(index);
        setPickerOpen(true);
    };

    const handleSaveLinkedCauses = (causes: string[]) => {
        if (currentActionIndex !== null) {
            handleActionChange(currentActionIndex, 'linkedRootCauses', causes);
        }
        setPickerOpen(false);
        setCurrentActionIndex(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const fullDof: Dof = {
            id: dof.id || `dof-uuid-${Date.now()}`,
            kpiId: kpi?.id || dofData?.kpiId || '',
            ...getInitialState(),
            ...dof,
        } as Dof;
        onSave(fullDof);
    };

    // KPI'ın kendi aylık verisinden D2 / D4 / D6 taslağı. YALNIZ BOŞ
    // alanları doldurur: ekibin yazdığı metin hiçbir durumda ezilmez.
    const [taslakNot, setTaslakNot] = useState('');
    // Kacis (saptanamama) zinciri her 8D'de gerekmiyor. Karar TEK yerde:
    // 5N ekranindaki tik. Taslak da onu izler — kayitta kacis analizi
    // varsa doldurur, yoksa hic yazmaz.
    const kacisDahil = (dof.kokNedenAnalizi?.nonDetection || [])
        .some(x => String(x?.because || '').trim())
        || !!String(dof.kokNedenAnalizi?.nonDetectionRootCause || '').trim();
    const handleTaslak = () => {
        const ay = dofAyi(dof.start_date, year);
        if (!kpi || !ay) {
            setTaslakNot('Taslak için KPI ve başlangıç tarihi gerekli.');
            return;
        }
        const t = dofTaslagi(kpi, ay, year, kardesKpiler, kacisDahil);
        if (!t) {
            setTaslakNot(`${ay} ayında bu KPI için ölçüm ya da hedef yok.`);
            return;
        }
        const dolu = (x: any) => !!String(x || '').trim();
        const bosZincir = (z: any[]) => !z || !z.length
            || z.every(x => !dolu(x.why) && !dolu(x.because));
        const k0 = dof.kokNedenAnalizi;

        // Hangi adimlarda zaten yazi var? Dugmeye ikinci kez basan
        // kullanici eski taslagi degistirmek istiyor olabilir; atlayip
        // susmak "dugme calismiyor" gibi gorunuyordu.
        const doluAdimlar: string[] = [];
        if (dolu(dof.problemTanimi)) doluAdimlar.push('D2');
        if (dolu(dof.geciciOnlemler)) doluAdimlar.push('D3');
        if (k0 && (!bosZincir(k0.occurrence) || !bosZincir(k0.nonDetection))) doluAdimlar.push('D4');
        if ((dof.kaliciAksiyonlar || []).some(a => dolu(a.action))) doluAdimlar.push('D5');
        if (dolu(dof.uygulamaDogrulama)) doluAdimlar.push('D6');
        if (dolu(dof.tekrarinOnlenmesi)) doluAdimlar.push('D7');
        if (dolu(dof.takdir)) doluAdimlar.push('D8');

        let uzerineYaz = false;
        if (doluAdimlar.length) {
            uzerineYaz = window.confirm(
                `Şu adımlarda yazı var: ${doluAdimlar.join(', ')}.\n\n`
                + 'TAMAM  → taslak bunların ÜZERİNE yazsın (eski metin gider)\n'
                + 'İPTAL  → yalnız boş adımlar doldurulsun');
        }

        setDof(prev => {
            const n: Partial<Dof> = { ...prev };
            const atlanan: string[] = [];
            const yaz = (bosMu: boolean, adim: string, uygula: () => void) => {
                if (bosMu || uzerineYaz) uygula(); else atlanan.push(adim);
            };
            yaz(!dolu(prev.problemTanimi), 'D2', () => { n.problemTanimi = t.problemTanimi; });
            yaz(!dolu(prev.geciciOnlemler), 'D3', () => { n.geciciOnlemler = t.geciciOnlemler; });
            yaz(!dolu(prev.uygulamaDogrulama), 'D6', () => { n.uygulamaDogrulama = t.uygulamaDogrulama; });
            yaz(!dolu(prev.tekrarinOnlenmesi), 'D7', () => { n.tekrarinOnlenmesi = t.tekrarinOnlenmesi; });
            yaz(!dolu(prev.takdir), 'D8', () => { n.takdir = t.takdir; });
            // D5 bir LISTE: icinde yazili aksiyon varsa dokunulmaz.
            yaz(!(prev.kaliciAksiyonlar || []).some(a => dolu(a.action)), 'D5',
                () => { n.kaliciAksiyonlar = t.kaliciAksiyonlar as any; });
            const k = prev.kokNedenAnalizi;
            if (k) {
                // Zincirle birlikte ekrandaki "Kök Neden" kutusu da yazilir;
                // bos kalinca 5N yarim gorunuyordu.
                yaz(bosZincir(k.occurrence), 'D4 oluşum', () => {
                    n.kokNedenAnalizi = { ...k, occurrence: t.occurrence,
                        occurrenceRootCause: t.occurrenceRootCause };
                });
                if (kacisDahil) {
                    const k2 = n.kokNedenAnalizi || k;
                    yaz(bosZincir(k2.nonDetection), 'D4 kaçış', () => {
                        n.kokNedenAnalizi = { ...k2, nonDetection: t.nonDetection,
                            nonDetectionRootCause: t.nonDetectionRootCause };
                    });
                }
            }
            setTaslakNot(`${ay}: ${t.ozet.deger} (hedef ${kpi.karsilastirma} ${t.ozet.hedef}) — taslak yazıldı.`
                + (atlanan.length ? ` Dolu olduğu için atlanan: ${atlanan.join(', ')}.` : '')
                + (uzerineYaz ? ' Dolu adımların üzerine yazıldı.' : ''));
            return n;
        });
    };

    const handleDelete = () => {
        if (dof.id && kpi?.id) {
            if (window.confirm("Bu 8D kaydını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.")) {
                onDelete(kpi.id, dof.id);
            }
        }
    };

    const renderStepContent = () => {
        switch (activeStep) {
            case 'D0D1': return (
                <div className="space-y-4">
                    {/* Termin, baslangicin YANINDA. Onceden yalniz son adimda ve
                        "Nihai Kapanis Tarihi" adiyla duruyordu; kullanici D0'da
                        baslangici duzeltince panelde degismeyen terminin
                        tarihini goruyor ve ayni alan saniyordu. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Başlangıç Tarihi (D0)</label>
                            <input type="date" name="start_date" value={dof.start_date || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Termin (tahmini kapanış)</label>
                            <input type="date" name="due_date" value={dof.due_date || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Elle değiştirilmediyse başlangıçla birlikte kayar (+30 gün).
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">DÖF No</label>
                            <input type="text" name="dofNo" value={dof.dofNo || ''} onChange={handleChange}
                                   placeholder={dofNoOner(dof)} className="mt-1 w-full form-input" />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Raporun antetinde görünür. Boş bırakılırsa örnekteki gibi üretilir.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Gerçek Kapanış</label>
                            <input type="date" name="gercekKapanis" value={dof.gercekKapanis || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                DÖF fiilen kapandığında dolar; %100 işaretlenince bugün önerilir.
                            </p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Sorumlu</label>
                        <input type="text" name="sorumlu" value={dof.sorumlu || ''} onChange={handleChange} required className="mt-1 w-full form-input" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Takım Üyeleri (D1)</label>
                        <textarea name="takim" value={dof.takim || ''} onChange={handleChange} rows={4} className="mt-1 w-full form-input" placeholder="Lider, Üyeler..."/>
                    </div>
                </div>
            );
            case 'D2': return (
                <div className="space-y-3">
                    {/* Dugme, DOLDURDUGU adimda durur. Onceden D0'daydi;
                        kullanici D2'yi acip bos gorunce ne ise yaradigini
                        anlamiyordu. */}
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-xs text-blue-900 dark:text-blue-200">
                                8D'nin tamamını doldurur: aşağıdaki tanım, D4 5 Neden zinciri ve D6
                                doğrulaması bu KPI'ın kendi aylık verisinden; D3, D5, D7 konuya göre
                                öneri olarak gelir (ekip onaylar). Dolu adım varsa üzerine yazmadan
                                önce sorar. Saptanamama zinciri, D4 ekranında o analiz açıksa
                                doldurulur.
                            </div>
                            <button type="button" onClick={handleTaslak}
                                className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">
                                KPI verisinden doldur
                            </button>
                        </div>
                        {taslakNot && <p className="mt-2 text-xs text-blue-800 dark:text-blue-300">{taslakNot}</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Problemin Detaylı Tanımı (5N1K vb. ile)</label>
                        <textarea name="problemTanimi" value={dof.problemTanimi || ''} onChange={handleChange} required rows={8} className="mt-1 w-full form-input" placeholder="Ne, Nerede, Ne zaman, Ne kadar, Nasıl, Kim..."/>
                    </div>
                </div>
            );
            case 'D3': return (
                 <div>
                    <label className="block text-sm font-medium">Uygulanan Geçici Önlemler ve Doğrulama Sonuçları</label>
                    <textarea name="geciciOnlemler" value={dof.geciciOnlemler || ''} onChange={handleChange} rows={8} className="mt-1 w-full form-input" placeholder="Müşteriyi korumak için hemen ne yapıldı? Etkinliği nasıl doğrulandı?"/>
                </div>
            );
            case 'D4': return (
                <div className="text-center p-4 border-2 border-dashed rounded-lg">
                    <WrenchScrewdriverIcon className="w-12 h-12 mx-auto text-gray-400"/>
                    <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Kök Neden Analizi</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">5 Neden, Balık Kılçığı vb. metodolojileri kullanarak kök nedenleri belirleyin.</p>
                    <div className="mt-6">
                        <button type="button" onClick={() => setFiveWhyModalOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                           <WrenchScrewdriverIcon className="-ml-1 mr-2 h-5 w-5"/> Analiz Aracını Aç
                        </button>
                    </div>
                </div>
            );
            case 'D5': return (
                <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <label className="block text-sm font-medium">Seçilen Kalıcı Düzeltici Aksiyonlar</label>
                        <button
                          type="button"
                          onClick={() => onOpenModal('doe-tool', null)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <WrenchScrewdriverIcon className="w-4 h-4 mr-2" /> Deney Tasarımı (DOE) Aracını Aç
                        </button>
                    </div>
                    <div className="space-y-3">
                        {(dof.kaliciAksiyonlar || []).map((action, index) => (
                            <div key={action.id} className="p-3 border dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900/50">
                                <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
                                    <div className="md:col-span-8"><label className="text-xs font-medium">Aksiyon Tanımı</label><textarea value={action.action} onChange={e => handleActionChange(index, 'action', e.target.value)} rows={2} className="w-full text-sm form-input"/></div>
                                    <div className="md:col-span-3"><label className="text-xs font-medium mt-1 block">Sorumlu</label><input type="text" value={action.responsible} onChange={e => handleActionChange(index, 'responsible', e.target.value)} className="w-full text-sm form-input"/></div>
                                    <div className="md:col-span-2"><label className="text-xs font-medium mt-1 block">Termin</label><input type="date" value={action.dueDate} onChange={e => handleActionChange(index, 'dueDate', e.target.value)} className="w-full text-sm form-input"/></div>
                                    <div className="md:col-span-2"><label className="text-xs font-medium mt-1 block">Durum</label>
                                        <select value={action.status} onChange={e => handleActionChange(index, 'status', e.target.value)} className="w-full text-sm form-input">
                                            <option value="Açık">Açık</option>
                                            <option value="Devam">Devam</option>
                                            <option value="Tamamlandı">Tamamlandı</option>
                                            <option value="Doğrulandı">Doğrulandı</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center"><button type="button" onClick={() => removeAction(index)} className="w-full p-2 text-red-500 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 rounded-md"><TrashIcon className="w-5 h-5 mx-auto"/></button></div>
                                </div>
                                <div className="mt-3 pt-3 border-t dark:border-gray-700">
                                    <button type="button" onClick={() => handleLinkRootCause(index)} className="text-xs font-medium text-blue-600 hover:underline">Kök Neden Bağla ({action.linkedRootCauses?.length || 0})</button>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {action.linkedRootCauses?.map(cause => (
                                            <span key={cause} className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded-full">{cause}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                     <button type="button" onClick={addAction} className="mt-4 flex items-center justify-center gap-2 text-sm py-2 px-4 text-white bg-green-600 hover:bg-green-700 rounded-md"><PlusIcon className="w-4 h-4" /> Yeni Aksiyon Ekle</button>
                </div>
            );
            case 'D6': return (
                 <div>
                    <label className="block text-sm font-medium">Uygulama ve Doğrulama Sonuçları</label>
                    <textarea name="uygulamaDogrulama" value={dof.uygulamaDogrulama || ''} onChange={handleChange} rows={6} className="mt-1 w-full form-input" placeholder="Kalıcı aksiyonlar uygulandı mı? Sonuçları ne oldu? Problem ortadan kalktı mı?"/>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium">Sorumlu</label>
                            <input type="text" name="uygulamaDogrulamaSorumlu" value={dof.uygulamaDogrulamaSorumlu || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Termin Tarihi</label>
                            <input type="date" name="uygulamaDogrulamaTermin" value={dof.uygulamaDogrulamaTermin || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                        </div>
                    </div>
                </div>
            );
            case 'D7': return (
                 <div>
                    <label className="block text-sm font-medium">Problemin Tekrarını Önleyici Aksiyonlar</label>
                    <textarea name="tekrarinOnlenmesi" value={dof.tekrarinOnlenmesi || ''} onChange={handleChange} rows={6} className="mt-1 w-full form-input" placeholder="Sistem, prosedür, talimat vb. dokümanlarda yapılan güncellemeler. Benzer proseslere yaygınlaştırma."/>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium">Sorumlu</label>
                            <input type="text" name="tekrarinOnlenmesiSorumlu" value={dof.tekrarinOnlenmesiSorumlu || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Termin Tarihi</label>
                            <input type="date" name="tekrarinOnlenmesiTermin" value={dof.tekrarinOnlenmesiTermin || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                        </div>
                    </div>
                </div>
            );
            case 'D8': {
                const getProgressColor = (progress: number) => {
                    if (progress < 25) return 'bg-red-500';
                    if (progress < 75) return 'bg-yellow-500';
                    return 'bg-green-500';
                };
                const progress = dof.ilerleme || 0;

                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium">Kapanış ve Takımın Takdir Edilmesi</label>
                            <textarea name="takdir" value={dof.takdir || ''} onChange={handleChange} rows={4} className="mt-1 w-full form-input" placeholder="Sürecin özeti, öğrenilen dersler ve takımın başarısının tanınması."/>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium">Sorumlu</label>
                                    <input type="text" name="takdirSorumlu" value={dof.takdirSorumlu || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Termin Tarihi</label>
                                    <input type="date" name="takdirTermin" value={dof.takdirTermin || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t dark:border-gray-600">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium">İlerleme Durumu: <span className="font-bold">{dof.durum === 'Devam' ? 'Devam Ediyor' : dof.durum}</span></label>
                                <span className="text-sm font-semibold">{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 my-2">
                                <div className={`h-4 rounded-full transition-colors duration-300 ${getProgressColor(progress)}`} style={{ width: `${progress}%` }}></div>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                name="ilerleme" 
                                value={progress} 
                                onChange={handleChange} 
                                className="w-full" 
                            />
                        </div>
                         
                         <div>
                            <label className="block text-sm font-medium">Termin (tahmini kapanış)</label>
                            <input type="date" name="due_date" value={dof.due_date || ''} onChange={handleChange} required className="mt-1 w-full form-input" />
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Etkinlik Kontrolü</label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">DÖF kapandıktan sonra alınan aksiyonların kalıcılığını doğrulamak için.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <div>
                                    <label className="block text-xs font-medium">Sorumlu</label>
                                    <input type="text" name="etkinlikKontrolSorumlusu" value={dof.etkinlikKontrolSorumlusu || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium">Kontrol Tarihi</label>
                                    <input type="date" name="etkinlikKontrolTarihi" value={dof.etkinlikKontrolTarihi || ''} onChange={handleChange} className="mt-1 w-full form-input" />
                                </div>
                                <div className="md:col-span-2">
                                     <label className="block text-xs font-medium">Notlar</label>
                                    <textarea name="etkinlikKontroluNotlari" value={dof.etkinlikKontroluNotlari || ''} onChange={handleChange} rows={2} className="mt-1 w-full form-input" placeholder="Kontrol sonuçları..."/>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
            default: return null;
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={dofData?.id ? '8D Düzenle' : 'Yeni 8D Başlat'} size="5xl">
            <div className="p-2">
                <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600 mb-6">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-wider uppercase">İlgili KPI</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-200 mt-1">{kpi?.proses} - {kpi?.kpi_adi}</p>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Left Nav */}
                    <div className="md:col-span-1 border-r dark:border-gray-700 pr-4">
                        <nav className="flex flex-col space-y-1">
                            {STEPS.map(step => (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => setActiveStep(step.id)}
                                    className={`w-full text-left p-2 rounded-md text-sm font-medium flex items-center gap-3 ${activeStep === step.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                >
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${activeStep === step.id ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}>{step.id.replace('D', '')}</span>
                                {step.name.split(':')[1]}
                                </button>
                            ))}
                        </nav>
                    </div>
                    {/* Right Content */}
                    <div className="md:col-span-3 min-h-[450px]">
                        <h3 className="text-lg font-bold mb-4">{STEPS.find(s => s.id === activeStep)?.name}</h3>
                        {renderStepContent()}
                    </div>
                </form>

                 <div className="pt-6 mt-6 border-t dark:border-gray-700 flex justify-between items-center">
                    <div>
                        {dof.id && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 dark:bg-red-900/50 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Sil
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500">İptal</button>
                        <button type="submit" onClick={handleSubmit} className="px-8 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700">Kaydet</button>
                    </div>
                </div>
            </div>
            {isFiveWhyModalOpen && dof.kokNedenAnalizi && (
                <FiveWhyModal
                    isOpen={isFiveWhyModalOpen}
                    onClose={() => setFiveWhyModalOpen(false)}
                    onSave={handleSaveFiveWhy}
                    initialData={dof.kokNedenAnalizi}
                />
            )}
            {currentActionIndex !== null && dof.kaliciAksiyonlar && (
                 <RootCausePickerModal
                    isOpen={isPickerOpen}
                    onClose={() => setPickerOpen(false)}
                    onSave={handleSaveLinkedCauses}
                    allCauses={allRootCauses}
                    initialSelectedCauses={dof.kaliciAksiyonlar[currentActionIndex].linkedRootCauses || []}
                 />
            )}
        </Modal>
    );
};

export default DofModal;

const formStyles = `
  .form-input {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: #111827;
    background-color: #fff;
    background-clip: padding-box;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  }
  .dark .form-input {
    color: #d1d5db;
    background-color: #374151;
    border-color: #4b5563;
  }
  .form-input:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px #4f46e5;
  }
`;

if (!document.getElementById('form-styles-sheet-dof')) {
    const styleSheet = document.createElement("style");
    styleSheet.id = 'form-styles-sheet-dof';
    styleSheet.innerText = formStyles;
    document.head.appendChild(styleSheet);
}