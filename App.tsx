

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Kpi, KpiData, Dof, Risk, ModalState, ModalType, MultiYearKpiData, TooltipSettings, AppearanceSettings, ActionItem, ActionYearData, KpiLocation, KpiSource } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { initialData, AYLAR, BRANDS, DEFAULT_LOCATIONS } from './constants';
import { calculateAverage, determineStatus } from './utils/calculations';
import { parseKpiWorkbook } from './utils/excelImport';
import { exportFr100 } from './utils/fr100Export';
import { exportFr216 } from './utils/fr216Export';
import { buildFr100Html } from './utils/fr100Html';
import ActionItemsModal from './components/ActionItemsModal';
import TrendChartModal from './components/TrendChartModal';
import LocationsModal from './components/LocationsModal';
import ProcessOrderModal from './components/ProcessOrderModal';
import KpiSourceModal from './components/KpiSourceModal';
import { fetchCmmsMetrics, applySourceFormula } from './utils/cmmsSource';
import { isAuthed, cloudFetchKpi, cloudSaveKpi, cloudFetchActions, cloudSaveActions, cloudFetchMeta, cloudSaveMeta, subscribeLocation } from './utils/cloudSync';
import Header from './components/Header';
import SummaryPanel from './components/SummaryPanel';
import KpiTable from './components/KpiTable';
import KpiModal from './components/KpiModal';
import DofModal from './components/DofModal';
import RiskModal from './components/RiskModal';
import Notification from './components/Notification';
import KpiDetailView from './components/KpiDetailView';
import MonthDetailModal from './components/MonthDetailModal';
import AllDofsModal from './components/AllDofsModal';
import DofReportView from './components/DofReportView';
import ChangeYearModal from './components/ChangeYearModal';
import TooltipSettingsPanel from './components/TooltipSettingsPanel';
import CopyDofModal from './components/CopyDofModal';
import DeleteProcessModal from './components/DeleteProcessModal';
import AppearanceSettingsModal from './components/AppearanceSettingsModal';
import EvidenceModal from './components/EvidenceModal';
import BulkKpiModal from './components/BulkKpiModal';
import DoeToolModal from './components/DoeToolModal';

// Add declarations for html2pdf and xlsx from window object
declare global {
    interface Window {
        html2pdf: any;
        XLSX: any;
        ExcelJS: any;
    }
}

const defaultAppearanceSettings: AppearanceSettings = {
    fontSize: 'sm',
    fontWeight: 'normal',
    theme: 'default',
    showSonGuncelleme: true,
};


const App: React.FC = () => {
    // ── Lokasyon bazlı veri katmanı ──
    const [locations, setLocations] = useLocalStorage<KpiLocation[]>('kpi_locations_v1', DEFAULT_LOCATIONS);
    const [currentLocation, setCurrentLocation] = useLocalStorage<string>('kpi_currentLocation_v1', DEFAULT_LOCATIONS[0].id);
    const [dataByLocation, setDataByLocation] = useLocalStorage<{ [loc: string]: MultiYearKpiData }>('kpiData_byLocation_v1', {});
    const [actionDataByLocation, setActionDataByLocation] = useLocalStorage<{ [loc: string]: { [year: number]: ActionYearData } }>('kpiActionItems_byLoc_v1', {});

    // Mevcut kodla uyum için (lokasyona göre) türetilmiş allKpiData / actionDataByYear + setter "shim"leri
    const allKpiData = useMemo<MultiYearKpiData>(() => dataByLocation[currentLocation] || {}, [dataByLocation, currentLocation]);
    const setAllKpiData = useCallback((value: React.SetStateAction<MultiYearKpiData>) => {
        setDataByLocation(prev => {
            const cur = prev[currentLocation] || {};
            const next = typeof value === 'function' ? (value as (p: MultiYearKpiData) => MultiYearKpiData)(cur) : value;
            return { ...prev, [currentLocation]: next };
        });
    }, [currentLocation, setDataByLocation]);

    const actionDataByYear = useMemo<{ [year: number]: ActionYearData }>(() => actionDataByLocation[currentLocation] || {}, [actionDataByLocation, currentLocation]);
    const setActionDataByYear = useCallback((value: React.SetStateAction<{ [year: number]: ActionYearData }>) => {
        setActionDataByLocation(prev => {
            const cur = prev[currentLocation] || {};
            const next = typeof value === 'function' ? (value as (p: { [year: number]: ActionYearData }) => { [year: number]: ActionYearData })(cur) : value;
            return { ...prev, [currentLocation]: next };
        });
    }, [currentLocation, setActionDataByLocation]);

    const [currentYear, setCurrentYear] = useState<number>(() => {
        try {
            const loc = JSON.parse(localStorage.getItem('kpi_currentLocation_v1') || 'null') || DEFAULT_LOCATIONS[0].id;
            const byLoc = JSON.parse(localStorage.getItem('kpiData_byLocation_v1') || 'null');
            const src = (byLoc && byLoc[loc]) || JSON.parse(localStorage.getItem('kpiData_multi_v2') || 'null'); // migrasyon öncesi yedek
            if (src && typeof src === 'object') {
                const years = Object.keys(src).map(Number).filter(y => !isNaN(y) && y > 0);
                if (years.length > 0) return Math.max(...years);
            }
        } catch (e) { /* yok say */ }
        return initialData.yil;
    });

    // Tek seferlik: eski (lokasyonsuz) veriyi varsayılan lokasyona taşı
    useEffect(() => {
        if (localStorage.getItem('kpi_locmigrate_v1')) return;
        try {
            const oldKpi = JSON.parse(localStorage.getItem('kpiData_multi_v2') || 'null');
            if (oldKpi && Object.keys(oldKpi).length) {
                setDataByLocation(prev => (prev[currentLocation] && Object.keys(prev[currentLocation]).length) ? prev : { ...prev, [currentLocation]: oldKpi });
            }
            const oldAct = JSON.parse(localStorage.getItem('kpiActionItems_v1') || 'null');
            if (oldAct && Object.keys(oldAct).length) {
                setActionDataByLocation(prev => prev[currentLocation] ? prev : { ...prev, [currentLocation]: oldAct });
            }
        } catch (e) { /* yok say */ }
        localStorage.setItem('kpi_locmigrate_v1', '1');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Tek seferlik: eski demo (örnek) KPI kayıtlarını temizle (Laminasyon/Kesim tohumu)
    useEffect(() => {
        if (localStorage.getItem('kpi_demo_cleanup_v1')) return;
        const isDemo = (k: Kpi) => k.id === 'kpi-uuid-1' || k.id === 'kpi-uuid-2';
        setDataByLocation(prev => {
            let changed = false;
            const next: { [loc: string]: MultiYearKpiData } = {};
            for (const loc of Object.keys(prev)) {
                const years = prev[loc]; const ny: MultiYearKpiData = {};
                for (const y of Object.keys(years)) {
                    const yd = years[Number(y)];
                    const filtered = yd.kpis.filter(k => !isDemo(k));
                    if (filtered.length !== yd.kpis.length) changed = true;
                    ny[Number(y)] = { ...yd, kpis: filtered };
                }
                next[loc] = ny;
            }
            return changed ? next : prev;
        });
        localStorage.setItem('kpi_demo_cleanup_v1', '1');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [filteredData, setFilteredData] = useState<Kpi[]>([]);
    const [filters, setFilters] = useState({ process: [] as string[], status: [] as string[], risk: [] as string[] });
    const [monthFilter, setMonthFilter] = useState<string | null>(null);
    const [isSummaryOpen, setSummaryOpen] = useState(true);
    const [modal, setModal] = useState<ModalState>({ type: null, data: null });
    const [recentlyUpdatedKpi, setRecentlyUpdatedKpi] = useState<string | null>(null);
    const updateTimeoutRef = useRef<number | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [cloudStatus, setCloudStatus] = useState<'offline' | 'syncing' | 'connected'>('offline');
    const kpiHashRef = useRef<string>('');
    const actHashRef = useRef<string>('');
    const locHashRef = useRef<string | null>(null);
    const [tooltipSettings, setTooltipSettings] = useLocalStorage<TooltipSettings>('tooltipSettings_v2', {
        goster: true,
        aktif_ay_degeri: true,
        sorumlu: true,
        hesap_metodu: true,
        RPN: true,
        son_guncelleme: true,
        hedef: true,
        durum: true,
        opacity: 0.95,
    });
    const [appearanceSettings, setAppearanceSettings] = useLocalStorage<AppearanceSettings>('appearanceSettings_v1', defaultAppearanceSettings);
    const [darkMode, setDarkMode] = useLocalStorage<boolean>('kpi_dark_v1', typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    useEffect(() => {
        const root = document.documentElement;
        if (darkMode) root.classList.add('dark'); else root.classList.remove('dark');
        root.style.colorScheme = darkMode ? 'dark' : 'light';
    }, [darkMode]);


    // Not: Eski tek-yıl migrasyonu ve demo (örnek) veri tohumlama kaldırıldı.
    // Boş lokasyon/yıl boş gelir; veriler Excel'den yüklenir veya elle eklenir.

    // Migration for evidence files
    useEffect(() => {
        const migrationKey = 'evidence_migrated_v1';
        if (localStorage.getItem(migrationKey) || Object.keys(allKpiData).length === 0) {
            return;
        }

        const needsMigration = Object.values(allKpiData).some(data =>
            data.kpis.some(kpi => (kpi as any).kanit_url !== undefined)
        );

        if (needsMigration) {
            console.log("Running evidence data migration...");
            const migratedData = JSON.parse(JSON.stringify(allKpiData)); // Deep copy

            for (const year in migratedData) {
                migratedData[year].kpis = migratedData[year].kpis.map((kpi: any) => {
                    if (kpi.kanit_url) {
                        kpi.kanit_dosyalari = kpi.kanit_dosyalari || [];
                        if (kpi.kanit_url.trim() && !kpi.kanit_dosyalari.some((f: any) => f.data === kpi.kanit_url)) {
                             kpi.kanit_dosyalari.push({
                                id: `migrated-${kpi.id}`,
                                name: `İçe Aktarılan Link`,
                                type: 'link',
                                data: kpi.kanit_url
                            });
                        }
                        delete kpi.kanit_url;
                    }
                    if (!kpi.kanit_dosyalari) {
                        kpi.kanit_dosyalari = [];
                    }
                    return kpi;
                });
            }
            setAllKpiData(migratedData);
            localStorage.setItem(migrationKey, 'true');
            setNotification({ message: 'Kanıt dosyası formatı güncellendi.', type: 'success' });
        } else {
             localStorage.setItem(migrationKey, 'true'); // No migration needed, but mark as checked
        }
    }, [allKpiData, setAllKpiData]);


    const kpiData = useMemo(() => {
        return allKpiData[currentYear] || { yil: currentYear, kpis: [] };
    }, [allKpiData, currentYear]);

    const currentLocObj = useMemo(() => locations.find(l => l.id === currentLocation) || locations[0] || DEFAULT_LOCATIONS[0], [locations, currentLocation]);
    const currentBrand = useMemo(() => BRANDS[currentLocObj?.company || 'sanifoam'], [currentLocObj]);


    const processedKpis = useMemo(() => {
        return kpiData.kpis.map(kpi => {
            const average = calculateAverage(kpi);
            const status = determineStatus(kpi, average);
            return { ...kpi, ortalama: average, durum: status };
        });
    }, [kpiData.kpis]);

    useEffect(() => {
        let data = processedKpis;
        if (filters.process.length > 0) {
            data = data.filter(kpi => filters.process.includes(kpi.proses));
        }
        if (filters.status.length > 0) {
            data = data.filter(kpi => filters.status.includes(kpi.durum));
        }
        if (filters.risk.length > 0) {
            // FIX: Access riskSeviyesi through the nested risk object.
            data = data.filter(kpi => filters.risk.includes(kpi.risk.riskSeviyesi));
        }
        if (monthFilter) {
            data = data.filter(kpi => kpi.aylik[monthFilter] !== null && kpi.aylik[monthFilter] !== undefined);
        }
        setFilteredData(data);
    }, [processedKpis, filters, monthFilter]);
    
    useEffect(() => {
        // Sync modal data if it's open and its underlying data changes.
        if ((modal.type === 'detail' || modal.type === 'evidence') && modal.data?.id) {
            const freshKpi = processedKpis.find(k => k.id === modal.data.id);
            // If the modal data is stale (based on the last update timestamp), refresh it.
            if (freshKpi && freshKpi.son_guncelleme !== modal.data.son_guncelleme) {
                setModal(prev => ({...prev, data: freshKpi}));
            }
        }
    }, [processedKpis, modal.type, modal.data]);

    useEffect(() => {
        // cleanup for update highlight timeout
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

    const updateCurrentYearData = (updater: (prevData: KpiData) => KpiData) => {
        setAllKpiData(prevAllData => {
            const currentData = prevAllData[currentYear] || { yil: currentYear, kpis: [] };
            const newData = updater(currentData);
            return {
                ...prevAllData,
                [currentYear]: newData
            };
        });
    };

    const handleMonthFilterChange = useCallback((month: string | null) => {
        setMonthFilter(prev => prev === month ? null : month);
    }, []);

    const handleOpenModal = useCallback((type: ModalType, data: any = null) => {
        setModal({ type, data });
    }, []);

    const handleCloseModal = () => {
        setModal({ type: null, data: null });
    };

    const handleSaveKpi = (kpiToSave: Kpi) => {
        updateCurrentYearData(prevData => {
            const kpiIndex = prevData.kpis.findIndex(k => k.id === kpiToSave.id);
            const newKpis = [...prevData.kpis];
            if (kpiIndex > -1) {
                newKpis[kpiIndex] = kpiToSave;
            } else {
                newKpis.push(kpiToSave);
            }
            return { ...prevData, kpis: newKpis };
        });
        handleCloseModal();
    };

    const handleBulkAddKpis = (kpisToAdd: Partial<Kpi>[], commonData: Partial<Kpi>) => {
        updateCurrentYearData(prevData => {
            const newKpis: Kpi[] = kpisToAdd.map(partialKpi => {
                // FIX: The original object creation was not type-safe because spreading a `Partial<Kpi>`
                // does not satisfy the compiler that required fields are present. This revised version
                // is explicit about all required properties to create a valid Kpi object.
                const fullKpi: Kpi = {
                    // Spread the form data first to get optional fields like `sorumlu`.
                    ...commonData,
                    ...partialKpi,
                    // Provide hardcoded defaults for fields not on the form, or that need to be fresh.
                    id: `kpi-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    kanit_dosyalari: [],
                    aylik: Object.fromEntries(AYLAR.map(ay => [ay, null])),
                    dof: [],
                    risk: { S: 1, O: 1, D: 1, RPN: 1, esik: 40, riskSeviyesi: 'Düşük' },
                    son_guncelleme: new Date().toLocaleString('tr-TR'),
                    ortalama: null,
                    durum: 'n/a',

                    // Explicitly define required fields from the form to satisfy TypeScript,
                    // overwriting the optional versions from the spread.
                    // Fallbacks match the modal's initial state.
                    proses: commonData.proses || '',
                    kpi_adi: partialKpi.kpi_adi || '',
                    onceki_yil_gerceklesen: commonData.onceki_yil_gerceklesen ?? null,
                    yeni_yil_hedef: commonData.yeni_yil_hedef ?? 0,
                    karsilastirma: commonData.karsilastirma || '<',
                    hesap_metodu: commonData.hesap_metodu || 'ortalama',
                    birim: commonData.birim || '%',
                    aciklama: commonData.aciklama || '',
                };
                return fullKpi;
            });
    
            return { ...prevData, kpis: [...prevData.kpis, ...newKpis] };
        });
    
        setNotification({ message: `${kpisToAdd.length} adet yeni KPI başarıyla eklendi.`, type: 'success' });
        handleCloseModal();
    };
    
    const handleUpdateKpiValue = (kpiId: string, month: string, value: number | null) => {
        updateCurrentYearData(prevData => {
            const newKpis = prevData.kpis.map(kpi => {
                if (kpi.id === kpiId) {
                    return { ...kpi, aylik: { ...kpi.aylik, [month]: value }, son_guncelleme: new Date().toLocaleString('tr-TR') };
                }
                return kpi;
            });
            return { ...prevData, kpis: newKpis };
        });
        
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }
        setRecentlyUpdatedKpi(kpiId);
        updateTimeoutRef.current = window.setTimeout(() => {
            setRecentlyUpdatedKpi(null);
        }, 2000);
    };

    // "Önceki Yıl" değerini elle düzenle (tablo içi)
    const handleUpdateOnceki = (kpiId: string, value: number | null) => {
        updateCurrentYearData(prevData => ({
            ...prevData,
            kpis: prevData.kpis.map(kpi => kpi.id === kpiId
                ? { ...kpi, onceki_yil_gerceklesen: value, son_guncelleme: new Date().toLocaleString('tr-TR') }
                : kpi),
        }));
    };

    // CMMS kaynağından (cmms_metrics) bu yıl için aylık değerleri çek ve KPI hücrelerine yaz
    const handlePullFromSource = useCallback(async (kpiId: string, source: KpiSource) => {
        const kpi = kpiData.kpis.find(k => k.id === kpiId);
        if (!kpi) return;
        const loc = (source.location && source.location.trim()) ? source.location.trim() : currentLocObj.name;
        try {
            const map = await fetchCmmsMetrics(loc, currentYear);
            const newAylik: { [k: string]: number | null } = { ...kpi.aylik };
            let filled = 0, na = 0;
            AYLAR.forEach((ay, i) => {
                const rec = map[i + 1];
                const raw = rec ? (rec as any)[source.metric] : null;
                if (raw !== null && raw !== undefined) {
                    newAylik[ay] = applySourceFormula(source.formula, Number(raw));
                    if (newAylik[ay] !== null) filled++;
                } else {
                    newAylik[ay] = null; // veri yoksa NA
                    na++;
                }
            });
            updateCurrentYearData(prev => ({
                ...prev,
                kpis: prev.kpis.map(k => k.id === kpiId
                    ? { ...k, aylik: newAylik, kaynak: source, son_guncelleme: new Date().toLocaleString('tr-TR') }
                    : k),
            }));
            setNotification({ message: `CMMS'ten çekildi: ${source.metric.toUpperCase()} · ${loc} · ${currentYear} → ${filled} ay dolu, ${na} ay veri yok (NA).`, type: 'success' });
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'bilinmeyen hata';
            setNotification({ message: `CMMS verisi çekilemedi: ${msg}`, type: 'error' });
        }
    }, [kpiData.kpis, currentYear, currentLocObj]);

    // KPI kaynak bağlantısını kaldır (aylık değerlere dokunmaz)
    const handleClearSource = (kpiId: string) => {
        updateCurrentYearData(prev => ({
            ...prev,
            kpis: prev.kpis.map(k => k.id === kpiId ? { ...k, kaynak: undefined } : k),
        }));
    };

    // Satır sürükle-bırak ile yeniden sırala (sürüklenen, hedefin konumuna taşınır)
    const handleReorderKpis = (draggedId: string, targetId: string) => {
        if (draggedId === targetId) return;
        updateCurrentYearData(prev => {
            const arr = [...prev.kpis];
            const from = arr.findIndex(k => k.id === draggedId);
            const to = arr.findIndex(k => k.id === targetId);
            if (from < 0 || to < 0) return prev;
            const [moved] = arr.splice(from, 1);
            arr.splice(to, 0, moved);
            return { ...prev, kpis: arr };
        });
    };

    // Proses bloğunu yukarı/aşağı taşı (numarası değişir)
    const handleReorderProcess = (proses: string, dir: 'up' | 'down') => {
        updateCurrentYearData(prev => {
            const order = [...new Set(prev.kpis.map(k => k.proses))];
            const i = order.indexOf(proses);
            const j = dir === 'up' ? i - 1 : i + 1;
            if (i < 0 || j < 0 || j >= order.length) return prev;
            [order[i], order[j]] = [order[j], order[i]];
            const rank = new Map(order.map((p, idx) => [p, idx]));
            const arr = [...prev.kpis].sort((a, b) => (rank.get(a.proses) ?? 0) - (rank.get(b.proses) ?? 0));
            return { ...prev, kpis: arr };
        });
    };

    // Tüm KPI'ların "Son Güncelleme" değerini topluca ayarla
    const handleBulkSetSonGuncelleme = () => {
        const def = new Date().toLocaleString('tr-TR');
        const val = window.prompt('Tüm KPI\'lar için "Son Güncelleme" değeri (boş bırakırsanız şu an):', def);
        if (val === null) return;
        const finalVal = val.trim() === '' ? def : val.trim();
        updateCurrentYearData(prev => ({
            ...prev,
            kpis: prev.kpis.map(k => ({ ...k, son_guncelleme: finalVal })),
        }));
        setNotification({ message: `${kpiData.kpis.length} KPI'nın son güncelleme tarihi ayarlandı.`, type: 'success' });
    };

    // "Önceki Yıl"ı bir önceki yılın gerçekleşen ortalamalarından doldur (proses + KPI adına göre eşleştirir)
    const handleFillPrevYear = () => {
        const prevYear = currentYear - 1;
        const prevData = allKpiData[prevYear];
        if (!prevData || prevData.kpis.length === 0) {
            setNotification({ message: `${prevYear} yılı verisi bulunamadı.`, type: 'error' });
            return;
        }
        const avgMap = new Map<string, number | null>();
        prevData.kpis.forEach(k => avgMap.set(`${k.proses}||${k.kpi_adi}`, calculateAverage(k)));
        const count = kpiData.kpis.filter(k => {
            const v = avgMap.get(`${k.proses}||${k.kpi_adi}`);
            return v !== undefined && v !== null;
        }).length;
        if (count === 0) {
            setNotification({ message: `${prevYear} yılında eşleşen (hesaplanmış ortalamalı) KPI bulunamadı.`, type: 'error' });
            return;
        }
        if (!window.confirm(`${count} KPI için "Önceki Yıl" değeri ${prevYear} ortalamalarıyla doldurulacak. Mevcut değerlerin üzerine yazılsın mı?`)) return;
        updateCurrentYearData(prevData2 => ({
            ...prevData2,
            kpis: prevData2.kpis.map(k => {
                const v = avgMap.get(`${k.proses}||${k.kpi_adi}`);
                return (v !== undefined && v !== null) ? { ...k, onceki_yil_gerceklesen: v } : k;
            }),
        }));
        setNotification({ message: `${count} KPI için önceki yıl (${prevYear}) verisi dolduruldu.`, type: 'success' });
    };

    const handleDeleteKpi = (kpiId: string) => {
        const kpi = kpiData.kpis.find(k => k.id === kpiId);
        const adi = kpi ? `"${kpi.kpi_adi}"` : 'bu KPI';
        const dofUyari = kpi && kpi.dof.length > 0 ? `\n\nBu KPI'ye bağlı ${kpi.dof.length} DÖF/8D kaydı da silinecek.` : '';
        if (!window.confirm(`${adi} KPI'sini silmek istediğinize emin misiniz?${dofUyari}\n\nBu işlem geri alınamaz.`)) return;
        updateCurrentYearData(prevData => ({
            ...prevData,
            kpis: prevData.kpis.filter(k => k.id !== kpiId)
        }));
        setNotification({ message: 'KPI başarıyla silindi.', type: 'success' });
    };

    const handleBulkDeleteKpis = (kpiIds: string[]) => {
        if (kpiIds.length === 0) return;
        if (!window.confirm(`Seçili ${kpiIds.length} KPI silinecek. Emin misiniz?\n\nBu işlem geri alınamaz.`)) return;
        updateCurrentYearData(prevData => ({
            ...prevData,
            kpis: prevData.kpis.filter(k => !kpiIds.includes(k.id))
        }));
        setNotification({ message: `${kpiIds.length} adet KPI başarıyla silindi.`, type: 'success' });
    };
    
    const handleDofModalClose = () => {
        const returnTo = modal.data?.returnTo;
        const kpiId = modal.data?.kpiId;

        if (returnTo === 'detail' && kpiId) {
            const updatedKpi = processedKpis.find(k => k.id === kpiId);
            setModal({ type: 'detail', data: updatedKpi });
        } else if (returnTo === 'all-dofs') {
            setModal({ type: 'all-dofs', data: null });
        } else if (returnTo === 'action-items') {
            setModal({ type: 'action-items', data: null });
        } else {
            handleCloseModal();
        }
    };

    const handleSaveDof = (kpiId: string, dof: Dof) => {
        updateCurrentYearData(prevData => {
            const newKpis = prevData.kpis.map(kpi => {
                if (kpi.id === kpiId) {
                    const dofIndex = kpi.dof.findIndex(d => d.id === dof.id);
                    const newDofs = [...kpi.dof];
                    if (dofIndex > -1) {
                        newDofs[dofIndex] = dof;
                    } else {
                        newDofs.push(dof);
                    }
                    return { ...kpi, dof: newDofs, son_guncelleme: new Date().toLocaleString('tr-TR') };
                }
                return kpi;
            });
            return { ...prevData, kpis: newKpis };
        });
        handleDofModalClose();
    };

    const handleUpdateDof = (kpiId: string, dof: Dof) => {
        updateCurrentYearData(prevData => {
            const newKpis = prevData.kpis.map(kpi => {
                if (kpi.id === kpiId) {
                    const dofIndex = kpi.dof.findIndex(d => d.id === dof.id);
                    const newDofs = [...kpi.dof];
                    if (dofIndex > -1) {
                        newDofs[dofIndex] = dof;
                    }
                    return { ...kpi, dof: newDofs, son_guncelleme: new Date().toLocaleString('tr-TR') };
                }
                return kpi;
            });
            return { ...prevData, kpis: newKpis };
        });
    };

    const handleDeleteDof = (kpiId: string, dofId: string) => {
        updateCurrentYearData(prevData => ({
            ...prevData,
            kpis: prevData.kpis.map(kpi =>
                kpi.id === kpiId
                    ? { ...kpi, dof: kpi.dof.filter(d => d.id !== dofId), son_guncelleme: new Date().toLocaleString('tr-TR') }
                    : kpi
            )
        }));
        setNotification({ message: 'DÖF başarıyla silindi.', type: 'success' });
    };
    
    const handleCopyDof = (dofToCopy: Dof, targetKpiId: string, targetMonth: string, year: number) => {
        updateCurrentYearData(prevData => {
            const targetKpiIndex = prevData.kpis.findIndex(k => k.id === targetKpiId);
            if (targetKpiIndex === -1) {
                setNotification({ message: 'Hedef KPI bulunamadı.', type: 'error' });
                return prevData;
            }

            const newDof: Dof = JSON.parse(JSON.stringify(dofToCopy)); // Deep copy
            newDof.id = `dof-uuid-${Date.now()}`;
            newDof.kpiId = targetKpiId;

            const monthIndex = AYLAR.indexOf(targetMonth);
            
            // Calculate duration
            const originalStartDate = new Date(dofToCopy.start_date);
            const originalDueDate = new Date(dofToCopy.due_date);
            let duration = 30 * 24 * 60 * 60 * 1000; // 30 days fallback
            if (!isNaN(originalStartDate.getTime()) && !isNaN(originalDueDate.getTime())) {
                duration = originalDueDate.getTime() - originalStartDate.getTime();
            }

            if (targetMonth === 'average') {
                const today = new Date();
                newDof.start_date = today.toISOString().split('T')[0];
                
                const newStartDateUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
                const newDueDate = new Date(newStartDateUTC.getTime() + duration);
                newDof.due_date = newDueDate.toISOString().split('T')[0];

            } else if (monthIndex > -1) {
                const monthStr = String(monthIndex + 1).padStart(2, '0');
                newDof.start_date = `${year}-${monthStr}-02`;
                
                const newStartDateUTC = new Date(Date.UTC(year, monthIndex, 2));
                const newDueDate = new Date(newStartDateUTC.getTime() + duration);
                newDof.due_date = newDueDate.toISOString().split('T')[0];
            }
            
            const newKpis = [...prevData.kpis];
            const targetKpi = { ...newKpis[targetKpiIndex] };
            targetKpi.dof = [...targetKpi.dof, newDof];
            targetKpi.son_guncelleme = new Date().toLocaleString('tr-TR');
            newKpis[targetKpiIndex] = targetKpi;

            setNotification({ message: 'DÖF başarıyla kopyalandı.', type: 'success' });
            
            return { ...prevData, kpis: newKpis };
        });
        handleCloseModal();
    };


    const handleSaveRisk = (kpiId: string, risk: Risk) => {
        updateCurrentYearData(prevData => {
            const newKpis = prevData.kpis.map(kpi => {
                if (kpi.id === kpiId) {
                    return { ...kpi, risk, son_guncelleme: new Date().toLocaleString('tr-TR') };
                }
                return kpi;
            });
            return { ...prevData, kpis: newKpis };
        });
        
        if(modal.data?.fromDetail) {
           const updatedKpi = processedKpis.find(k => k.id === kpiId);
           setModal({ type: 'detail', data: updatedKpi });
        } else {
           handleCloseModal();
        }
    };

    const handleSaveEvidence = (kpiId: string, newEvidence: Kpi['kanit_dosyalari']) => {
        updateCurrentYearData(prevData => {
            const newKpis = prevData.kpis.map(kpi => {
                if (kpi.id === kpiId) {
                    return { ...kpi, kanit_dosyalari: newEvidence, son_guncelleme: new Date().toLocaleString('tr-TR') };
                }
                return kpi;
            });
            return { ...prevData, kpis: newKpis };
        });
        setNotification({ message: 'Kanıt dosyaları güncellendi.', type: 'success' });
    };

    const handleExport = useCallback(() => {
        const dataToExport = allKpiData[currentYear];
        if (!dataToExport) return;
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = `kpi_data_${dataToExport.yil}.json`;
        link.click();
    }, [allKpiData, currentYear]);

    const handleExportXlsx = useCallback(async () => {
        try {
            if (!window.ExcelJS) {
                throw new Error('Excel (ExcelJS) kütüphanesi yüklenemedi.');
            }
            if (filteredData.length === 0) {
                setNotification({ message: 'Dışa aktarılacak KPI bulunamadı.', type: 'error' });
                return;
            }
            // Lokasyonun markasına göre logo (public/) getir; başarısız olursa metin antetle devam et
            let logoBuffer: ArrayBuffer | null = null;
            try {
                const res = await fetch(currentBrand.logo);
                if (res.ok) logoBuffer = await res.arrayBuffer();
            } catch { /* logo opsiyonel */ }

            const blob = await exportFr100(window.ExcelJS, filteredData, kpiData.yil, logoBuffer, { docNo: currentBrand.docNo, companyName: currentBrand.name, locationName: currentLocObj.name });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${currentBrand.fileTag}_KPI_${currentLocObj.name}_${kpiData.yil}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);

            setNotification({ message: `${currentBrand.docNo} Excel raporu başarıyla oluşturuldu.`, type: 'success' });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen Excel oluşturma hatası';
            setNotification({ message: `Excel oluşturulamadı: ${errorMessage}`, type: 'error' });
        }
    }, [filteredData, kpiData.yil, currentBrand, currentLocObj]);

    // ── Aksiyon Maddeleri (FR216) ──
    const currentActionData: ActionYearData = useMemo(
        () => actionDataByYear[currentYear] || { items: [], nextMeeting: '' },
        [actionDataByYear, currentYear]
    );

    const handleChangeActionItems = useCallback((items: ActionItem[]) => {
        setActionDataByYear(prev => ({ ...prev, [currentYear]: { ...(prev[currentYear] || { items: [], nextMeeting: '' }), items } }));
    }, [currentYear, setActionDataByYear]);

    const handleChangeNextMeeting = useCallback((nextMeeting: string) => {
        setActionDataByYear(prev => ({ ...prev, [currentYear]: { ...(prev[currentYear] || { items: [], nextMeeting: '' }), nextMeeting } }));
    }, [currentYear, setActionDataByYear]);

    const handleExportFr216 = useCallback(async () => {
        try {
            if (!window.ExcelJS) throw new Error('Excel (ExcelJS) kütüphanesi yüklenemedi.');
            const data = actionDataByYear[currentYear] || { items: [], nextMeeting: '' };
            if (data.items.length === 0) { setNotification({ message: 'Dışa aktarılacak aksiyon yok.', type: 'error' }); return; }
            let logoBuffer: ArrayBuffer | null = null;
            try { const res = await fetch(currentBrand.logo); if (res.ok) logoBuffer = await res.arrayBuffer(); } catch { /* opsiyonel */ }
            const blob = await exportFr216(window.ExcelJS, data.items, currentYear, data.nextMeeting, logoBuffer, { companyName: currentBrand.name });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = `FR216_Aksiyonlar_${currentLocObj.name}_${currentYear}.xlsx`; link.click();
            URL.revokeObjectURL(url);
            setNotification({ message: 'FR216 Aksiyon raporu oluşturuldu.', type: 'success' });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Bilinmeyen hata';
            setNotification({ message: `FR216 oluşturulamadı: ${msg}`, type: 'error' });
        }
    }, [actionDataByYear, currentYear, currentBrand, currentLocObj]);

    // ───────────── Supabase bulut senkronu (ERP projesi, oturum paylaşımlı) ─────────────
    const hashOf = (o: any): string => { try { return JSON.stringify(o); } catch { return ''; } };

    const applyCloudKpi = useCallback((loc: string, year: number, data: KpiData) => {
        setDataByLocation(prev => ({ ...prev, [loc]: { ...(prev[loc] || {}), [year]: data } }));
    }, [setDataByLocation]);
    const applyCloudActions = useCallback((loc: string, year: number, ad: ActionYearData) => {
        setActionDataByLocation(prev => ({ ...prev, [loc]: { ...(prev[loc] || {}), [year]: ad } }));
    }, [setActionDataByLocation]);

    // Açılışta: oturum + bulut lokasyon listesi
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const authed = await isAuthed();
                if (cancelled) return;
                setCloudStatus(authed ? 'connected' : 'offline');
                const cloudLocs = await cloudFetchMeta('locations');
                if (cancelled) return;
                if (Array.isArray(cloudLocs) && cloudLocs.length) {
                    setLocations(cloudLocs);
                    locHashRef.current = hashOf(cloudLocs);
                } else {
                    locHashRef.current = hashOf(locations);
                }
            } catch { if (!cancelled) setCloudStatus('offline'); }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Lokasyon/yıl değişince buluttan çek (yoksa yereli yukarı it)
    const pullCloud = useCallback(async (loc: string, year: number) => {
        // Önce mevcut yereli "senkron" işaretle ki erken push olmasın
        kpiHashRef.current = hashOf((dataByLocation[loc] || {})[year]);
        actHashRef.current = hashOf((actionDataByLocation[loc] || {})[year]);
        try {
            setCloudStatus('syncing');
            const cloudKpi = await cloudFetchKpi(loc, year);
            if (cloudKpi) {
                // Eski demo (Laminasyon/Kesim) kayıtları buluttan da temizle ve düzeltilmişi geri yaz
                const stripped = { ...cloudKpi, kpis: (cloudKpi.kpis || []).filter(k => k.id !== 'kpi-uuid-1' && k.id !== 'kpi-uuid-2') };
                const demoCleaned = stripped.kpis.length !== (cloudKpi.kpis || []).length;
                applyCloudKpi(loc, year, stripped); kpiHashRef.current = hashOf(stripped);
                if (demoCleaned) { try { await cloudSaveKpi(loc, year, stripped); } catch { /* yok say */ } }
            }
            else { const localK = (dataByLocation[loc] || {})[year]; if (localK && localK.kpis && localK.kpis.length) await cloudSaveKpi(loc, year, localK); }
            const cloudAct = await cloudFetchActions(loc, year);
            if (cloudAct) { applyCloudActions(loc, year, cloudAct); actHashRef.current = hashOf(cloudAct); }
            else { const localA = (actionDataByLocation[loc] || {})[year]; if (localA && (localA.items?.length || localA.nextMeeting)) await cloudSaveActions(loc, year, localA); }
            setCloudStatus('connected');
        } catch { setCloudStatus('offline'); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applyCloudKpi, applyCloudActions]);

    useEffect(() => {
        pullCloud(currentLocation, currentYear);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLocation, currentYear]);

    // KPI verisi değişince buluta kaydet (debounce; hash ile echo engellenir)
    useEffect(() => {
        const cur = allKpiData[currentYear];
        const h = hashOf(cur);
        if (h === kpiHashRef.current) return;
        const t = window.setTimeout(async () => {
            try { setCloudStatus('syncing'); await cloudSaveKpi(currentLocation, currentYear, cur || { yil: currentYear, kpis: [] }); kpiHashRef.current = h; setCloudStatus('connected'); }
            catch { setCloudStatus('offline'); }
        }, 1200);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allKpiData, currentYear, currentLocation]);

    // Aksiyon verisi değişince buluta kaydet
    useEffect(() => {
        const cur = actionDataByYear[currentYear];
        const h = hashOf(cur);
        if (h === actHashRef.current) return;
        const t = window.setTimeout(async () => {
            try { setCloudStatus('syncing'); await cloudSaveActions(currentLocation, currentYear, cur || { items: [], nextMeeting: '' }); actHashRef.current = h; setCloudStatus('connected'); }
            catch { setCloudStatus('offline'); }
        }, 1200);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actionDataByYear, currentYear, currentLocation]);

    // Lokasyon listesi değişince buluta kaydet (meta)
    useEffect(() => {
        if (locHashRef.current === null) { return; } // açılış çekmesi tamamlanana kadar bekle
        const h = hashOf(locations);
        if (h === locHashRef.current) return;
        const t = window.setTimeout(async () => {
            try { await cloudSaveMeta('locations', locations); locHashRef.current = h; } catch { /* yok say */ }
        }, 1000);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locations]);

    // Realtime: başka kullanıcıların değişiklikleri canlı yansısın
    useEffect(() => {
        const unsub = subscribeLocation(
            currentLocation,
            (year, data) => { if (year === currentYear) { applyCloudKpi(currentLocation, year, data); kpiHashRef.current = hashOf(data); } },
            (year, ad) => { if (year === currentYear) { applyCloudActions(currentLocation, year, ad); actHashRef.current = hashOf(ad); } },
        );
        return unsub;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLocation, currentYear, applyCloudKpi, applyCloudActions]);

    const handleCloudRefresh = useCallback(() => {
        kpiHashRef.current = '~'; actHashRef.current = '~'; // farklı işaretle ki çekilen uygulansın
        pullCloud(currentLocation, currentYear);
        setNotification({ message: 'Bulut verisi yenilendi.', type: 'success' });
    }, [pullCloud, currentLocation, currentYear]);


    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result;
                    if (typeof text === 'string') {
                        const importedData = JSON.parse(text);
                        // Basic validation
                        if (importedData.yil && Array.isArray(importedData.kpis)) {
                            const year = importedData.yil;
                            setAllKpiData(prev => ({ ...prev, [year]: importedData }));
                            setCurrentYear(year);
                            setNotification({ message: `${year} yılı verisi başarıyla içe aktarıldı!`, type: 'success' });
                        } else {
                            throw new Error("Geçersiz JSON formatı.");
                        }
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
                    setNotification({ message: `İçe aktarma hatası: ${errorMessage}`, type: 'error' });
                }
            };
            reader.readAsText(file);
        }
    };

    const handleImportXlsx = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Aynı dosya tekrar seçilebilsin diye input'u sıfırla
        const inputEl = event.target;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (!window.XLSX) throw new Error('Excel (XLSX) kütüphanesi yüklenemedi.');
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = window.XLSX.read(data, { type: 'array' });
                // Dosya adından yıl yedeği (ör. "...KPI 2026.xlsx")
                const nameYear = file.name.match(/(20\d{2})/);
                const fallbackYear = nameYear ? parseInt(nameYear[1], 10) : currentYear;
                const imported = parseKpiWorkbook(window.XLSX, workbook, fallbackYear);

                const year = imported.yil;
                const existing = allKpiData[year];
                if (existing && existing.kpis.length > 0) {
                    const ok = window.confirm(
                        `${year} yılı için zaten ${existing.kpis.length} KPI var.\n` +
                        `Excel'den ${imported.kpis.length} KPI okundu. Mevcut ${year} verisinin ÜZERİNE yazılsın mı?`
                    );
                    if (!ok) { inputEl.value = ''; return; }
                }

                setAllKpiData(prev => ({ ...prev, [year]: imported }));
                setCurrentYear(year);
                setNotification({ message: `${year}: Excel'den ${imported.kpis.length} KPI başarıyla içe aktarıldı.`, type: 'success' });
            } catch (error) {
                const msg = error instanceof Error ? error.message : 'Bilinmeyen hata';
                setNotification({ message: `Excel içe aktarma hatası: ${msg}`, type: 'error' });
            } finally {
                inputEl.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Yıl seçimi: sadece o yılın verisini göster (boşsa boş gelir). Kopya sormaz.
    const handleNavigateYear = (targetYear: number) => {
        setCurrentYear(targetYear);
    };

    // Açık "kopyala" isteği: hangi yıla kopyalanacağını sorar (ChangeYearModal)
    const handleOpenCopyYear = () => {
        handleOpenModal('change-year', { targetYear: currentYear + 1, copyMode: true });
    };

    const handleConfirmChangeYear = (newYear: number, copyData: boolean) => {
        const existing = allKpiData[newYear];
        if (copyData && existing && existing.kpis.length > 0) {
            if (!window.confirm(`${newYear} yılında zaten ${existing.kpis.length} KPI var. Üzerine kopyalansın mı?`)) return;
        }
        if (copyData) {
            const newKpis = processedKpis.map(kpi => {
                // FIX: The new KPI object was missing several optional properties from the original KPI.
                // This caused a type error and was functionally incorrect as it didn't fully copy the KPI's definition.
                // All definitional properties are now copied to the new year.
                const newKpi: Kpi = {
                    // Definitional properties copied from previous year
                    id: kpi.id,
                    proses: kpi.proses,
                    kpi_adi: kpi.kpi_adi,
                    sorumlu: kpi.sorumlu,
                    gozdenGecirmePeriyodu: kpi.gozdenGecirmePeriyodu,
                    pasifAylar: kpi.pasifAylar,
                    yeni_yil_hedef: kpi.yeni_yil_hedef,
                    karsilastirma: kpi.karsilastirma,
                    hesap_metodu: kpi.hesap_metodu,
                    formula: kpi.formula,
                    birim: kpi.birim,
                    aciklama: kpi.aciklama,
                    kanit_dosyalari: kpi.kanit_dosyalari,
                    risk: kpi.risk,

                    // Values reset for the new year
                    onceki_yil_gerceklesen: kpi.ortalama,
                    aylik: Object.fromEntries(AYLAR.map(ay => [ay, null])),
                    dof: [],
                    son_guncelleme: new Date().toLocaleString('tr-TR'),
                    ortalama: null,
                    durum: 'n/a',
                };
                return newKpi;
            });
            setAllKpiData(prev => ({ ...prev, [newYear]: { yil: newYear, kpis: newKpis } }));
            setNotification({ message: `${newYear} yılına başarıyla geçildi ve veriler kopyalandı.`, type: 'success' });
        } else {
            setAllKpiData(prev => ({ ...prev, [newYear]: { yil: newYear, kpis: [] } }));
            setNotification({ message: `${newYear} yılına başarıyla geçildi. Yeni KPI'lar oluşturabilirsiniz.`, type: 'success' });
        }
        setCurrentYear(newYear);
        handleCloseModal();
    };

    const handleGeneratePdf = useCallback(async () => {
        try {
            if (!window.html2pdf) {
                throw new Error("html2pdf kütüphanesi bulunamadı.");
            }
            if (filteredData.length === 0) {
                setNotification({ message: 'Rapor için KPI bulunamadı.', type: 'error' });
                return;
            }

            // Markaya göre logoyu base64 olarak göm (html2canvas zamanlama sorununu önler)
            let logoDataUrl: string | null = null;
            try {
                const res = await fetch(currentBrand.logo);
                if (res.ok) {
                    const buf = await res.arrayBuffer();
                    const bytes = new Uint8Array(buf);
                    let bin = '';
                    const chunk = 0x8000;
                    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
                    logoDataUrl = `data:image/png;base64,${btoa(bin)}`;
                }
            } catch { /* logo opsiyonel */ }

            const reportContainer = document.createElement('div');
            reportContainer.className = 'p-4';
            reportContainer.innerHTML = buildFr100Html(filteredData, kpiData.yil, {
                docNo: currentBrand.docNo,
                companyName: currentBrand.name,
                locationName: currentLocObj.name,
                logoDataUrl,
            });

            const filename = `${currentBrand.fileTag}_KPI_${currentLocObj.name}_${kpiData.yil}.pdf`;
            const opt = {
                margin: 6,
                filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                pagebreak: { mode: ['css', 'legacy'] },
            };

            await window.html2pdf().set(opt).from(reportContainer).save();
            setNotification({ message: 'PDF raporu (FR100 düzeni) oluşturuldu.', type: 'success' });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen PDF oluşturma hatası';
            setNotification({ message: `PDF oluşturulamadı: ${errorMessage}`, type: 'error' });
        }
    }, [kpiData.yil, filteredData, currentBrand, currentLocObj]);


    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const activeElement = document.activeElement;
            const isTyping = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');

            if (isTyping) {
                return; // Do not trigger global shortcuts when user is typing
            }
            
            if (event.key && event.key.toLowerCase() === 'n') {
                event.preventDefault();
                handleOpenModal('kpi');
            }
            if (event.key && event.key.toLowerCase() === 's') {
                event.preventDefault();
                handleExport();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleOpenModal, handleExport]);
    
    const handleBulkDeleteAction = (target: string, action: 'clear' | 'delete' | 'delete-dofs' | 'delete-evidences') => {
        const isAll = target === '__ALL__';
    
        setAllKpiData(prevAllData => {
            const prevYearData = prevAllData[currentYear] || { yil: currentYear, kpis: [] };
            let newKpis: Kpi[];
    
            if (action === 'clear') {
                newKpis = prevYearData.kpis.map(kpi => {
                    if (!isAll && kpi.proses !== target) {
                        return kpi;
                    }
                    return {
                        ...kpi,
                        aylik: Object.fromEntries(AYLAR.map(ay => [ay, null])),
                        son_guncelleme: new Date().toLocaleString('tr-TR'),
                    };
                });
            } else if (action === 'delete') {
                if (isAll) {
                    newKpis = [];
                } else {
                    newKpis = prevYearData.kpis.filter(kpi => kpi.proses !== target);
                }
            } else if (action === 'delete-dofs') {
                newKpis = prevYearData.kpis.map(kpi => {
                    if (!isAll && kpi.proses !== target) {
                        return kpi;
                    }
                    if (kpi.dof.length > 0) {
                        return {
                            ...kpi,
                            dof: [],
                            son_guncelleme: new Date().toLocaleString('tr-TR'),
                        };
                    }
                    return kpi;
                });
            } else if (action === 'delete-evidences') {
                newKpis = prevYearData.kpis.map(kpi => {
                    if (!isAll && kpi.proses !== target) {
                        return kpi;
                    }
                    if (kpi.kanit_dosyalari.length > 0) {
                        return {
                            ...kpi,
                            kanit_dosyalari: [],
                            son_guncelleme: new Date().toLocaleString('tr-TR'),
                        };
                    }
                    return kpi;
                });
            }
            else {
                 newKpis = prevYearData.kpis;
            }
    
            return {
                ...prevAllData,
                [currentYear]: {
                    ...prevYearData,
                    kpis: newKpis,
                },
            };
        });
    
        const targetName = isAll ? `${currentYear} yılı` : `"${target}" prosesi`;
        const actionText = action === 'clear' 
            ? 'içindeki veriler temizlendi' 
            : action === 'delete-dofs'
            ? 'içindeki DÖF\'ler silindi'
            : action === 'delete-evidences'
            ? 'içindeki kanıtlar silindi'
            : 've ilgili tüm KPI\'lar silindi';
        setNotification({ message: `${targetName} ${actionText}.`, type: 'success' });
        handleCloseModal();
    };
    
    const uniqueProcesses = useMemo(() => [...new Set(kpiData.kpis.map(kpi => kpi.proses))], [kpiData.kpis]);


    return (
        <div className="p-4 sm:p-6 lg:p-8 font-sans">
            <TooltipSettingsPanel
                settings={tooltipSettings}
                onChange={setTooltipSettings}
            />
            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}
            <Header
                year={kpiData.yil}
                allKpis={processedKpis}
                filters={filters}
                setFilters={setFilters}
                onAddKpi={() => handleOpenModal('kpi')}
                onImport={handleImport}
                onImportXlsx={handleImportXlsx}
                onExport={handleExport}
                onExportXlsx={handleExportXlsx}
                exportLabel={currentBrand.fileTag}
                locations={locations}
                currentLocation={currentLocation}
                onChangeLocation={setCurrentLocation}
                onManageLocations={() => handleOpenModal('locations')}
                cloudStatus={cloudStatus}
                onCloudRefresh={handleCloudRefresh}
                onCopyYear={handleOpenCopyYear}
                onFillPrevYear={handleFillPrevYear}
                darkMode={darkMode}
                onToggleDark={() => setDarkMode(d => !d)}
                onBulkSonGuncelleme={handleBulkSetSonGuncelleme}
                onNavigateYear={handleNavigateYear}
                isSummaryOpen={isSummaryOpen}
                setSummaryOpen={setSummaryOpen}
                onGeneratePdf={handleGeneratePdf}
                onOpenDofPanel={() => handleOpenModal('all-dofs')}
                onBulkDelete={() => handleOpenModal('delete-process')}
                onOpenModal={handleOpenModal}
            />

            {isSummaryOpen && (
                <SummaryPanel
                    allKpis={processedKpis}
                    onMonthFilter={handleMonthFilterChange}
                    selectedMonth={monthFilter}
                    onOpenModal={handleOpenModal}
                />
            )}
            
            <main className="mt-4">
                <KpiTable
                    kpis={filteredData}
                    year={kpiData.yil}
                    onOpenModal={handleOpenModal}
                    onUpdateValue={handleUpdateKpiValue}
                    onUpdateOnceki={handleUpdateOnceki}
                    onReorderKpis={handleReorderKpis}
                    onDeleteKpi={handleDeleteKpi}
                    onDeleteKpis={handleBulkDeleteKpis}
                    recentlyUpdatedKpi={recentlyUpdatedKpi}
                    tooltipSettings={tooltipSettings}
                    appearanceSettings={appearanceSettings}
                />
            </main>

            {modal.type === 'kpi' && (
                <KpiModal
                    isOpen={modal.type === 'kpi'}
                    onClose={handleCloseModal}
                    onSave={handleSaveKpi}
                    kpiData={modal.data}
                />
            )}
             {modal.type === 'bulk-kpi' && (
                <BulkKpiModal
                    isOpen={modal.type === 'bulk-kpi'}
                    onClose={handleCloseModal}
                    onSave={handleBulkAddKpis}
                />
            )}
            {modal.type === 'dof' && (
                 <DofModal
                    isOpen={modal.type === 'dof'}
                    onClose={handleDofModalClose}
                    onSave={(dof) => handleSaveDof(modal.data.kpiId, dof)}
                    onUpdateDof={(dof) => handleUpdateDof(modal.data.kpiId, dof)}
                    onDelete={(kpiId, dofId) => {
                        handleDeleteDof(kpiId, dofId);
                        handleDofModalClose();
                    }}
                    dofData={modal.data}
                    kpi={processedKpis.find(k => k.id === modal.data.kpiId)}
                    year={kpiData.yil}
                    onOpenModal={handleOpenModal}
                />
            )}
            {modal.type === 'risk' && (
                <RiskModal
                    isOpen={modal.type === 'risk'}
                    onClose={() => {
                         if(modal.data?.fromDetail) {
                            const updatedKpi = processedKpis.find(k => k.id === modal.data.id);
                            setModal({ type: 'detail', data: updatedKpi });
                         } else {
                            handleCloseModal();
                         }
                    }}
                    onSave={(risk) => handleSaveRisk(modal.data.id, risk)}
                    kpi={modal.data}
                    onStartDof={(kpiId) => handleOpenModal('dof', { kpiId: kpiId })}
                />
            )}
            {modal.type === 'detail' && (
                 <KpiDetailView
                    isOpen={modal.type === 'detail'}
                    onClose={handleCloseModal}
                    kpi={modal.data}
                    onSaveKpi={handleSaveKpi}
                    onOpenModal={handleOpenModal}
                    onDeleteDof={handleDeleteDof}
                />
            )}
             {modal.type === 'month-detail' && (
                 <MonthDetailModal
                    isOpen={modal.type === 'month-detail'}
                    onClose={handleCloseModal}
                    month={modal.data.month}
                    allKpis={processedKpis}
                />
            )}
             {modal.type === 'all-dofs' && (
                <AllDofsModal
                    isOpen={modal.type === 'all-dofs'}
                    onClose={handleCloseModal}
                    allKpis={processedKpis}
                    onOpenModal={handleOpenModal}
                    onDeleteDof={handleDeleteDof}
                />
            )}
            {modal.type === 'change-year' && (
                <ChangeYearModal
                    isOpen={modal.type === 'change-year'}
                    onClose={handleCloseModal}
                    currentYear={kpiData.yil}
                    onConfirm={handleConfirmChangeYear}
                    targetYear={modal.data?.targetYear}
                />
            )}
            {modal.type === 'dof-report' && modal.data.dof && modal.data.kpi && (
                <DofReportView
                    isOpen={modal.type === 'dof-report'}
                    onClose={handleCloseModal}
                    dof={modal.data.dof}
                    kpi={modal.data.kpi}
                />
            )}
            {modal.type === 'copy-dof' && (
                <CopyDofModal
                    isOpen={modal.type === 'copy-dof'}
                    onClose={handleCloseModal}
                    onCopy={handleCopyDof}
                    dofToCopy={modal.data.dof}
                    allKpis={processedKpis}
                    year={kpiData.yil}
                />
            )}
             {modal.type === 'delete-process' && (
                <DeleteProcessModal
                    isOpen={modal.type === 'delete-process'}
                    onClose={handleCloseModal}
                    onConfirm={handleBulkDeleteAction}
                    processes={uniqueProcesses}
                />
            )}
            {modal.type === 'appearance-settings' && (
                <AppearanceSettingsModal
                    isOpen={modal.type === 'appearance-settings'}
                    onClose={handleCloseModal}
                    settings={appearanceSettings}
                    onSave={(newSettings) => {
                        setAppearanceSettings(newSettings);
                        handleCloseModal();
                    }}
                    onReset={() => {
                        setAppearanceSettings(defaultAppearanceSettings);
                        handleCloseModal();
                    }}
                    darkMode={darkMode}
                    onToggleDark={() => setDarkMode(d => !d)}
                />
            )}
            {modal.type === 'evidence' && (
                <EvidenceModal
                    isOpen={modal.type === 'evidence'}
                    onClose={handleCloseModal}
                    kpi={modal.data}
                    onSave={handleSaveEvidence}
                />
            )}
            {modal.type === 'doe-tool' && (
                <DoeToolModal
                    isOpen={modal.type === 'doe-tool'}
                    onClose={handleCloseModal}
                />
            )}
            {modal.type === 'action-items' && (
                <ActionItemsModal
                    isOpen={modal.type === 'action-items'}
                    onClose={handleCloseModal}
                    items={currentActionData.items}
                    onChange={handleChangeActionItems}
                    kpis={processedKpis}
                    year={kpiData.yil}
                    nextMeeting={currentActionData.nextMeeting}
                    onChangeNextMeeting={handleChangeNextMeeting}
                    onExport={handleExportFr216}
                    onStartDof={(kpiId) => handleOpenModal('dof', { kpiId, year: kpiData.yil, returnTo: 'action-items' })}
                    focusKpiId={modal.data?.focusKpiId}
                />
            )}
            {modal.type === 'trend-chart' && (
                <TrendChartModal
                    isOpen={modal.type === 'trend-chart'}
                    onClose={handleCloseModal}
                    kpis={processedKpis}
                    multiYearData={allKpiData}
                    initialKpiId={modal.data?.kpiId}
                />
            )}
            {modal.type === 'locations' && (
                <LocationsModal
                    isOpen={modal.type === 'locations'}
                    onClose={handleCloseModal}
                    locations={locations}
                    onChange={setLocations}
                    currentLocation={currentLocation}
                    onSelect={setCurrentLocation}
                />
            )}
            {modal.type === 'process-order' && (
                <ProcessOrderModal
                    isOpen={modal.type === 'process-order'}
                    onClose={handleCloseModal}
                    processes={uniqueProcesses}
                    onReorder={handleReorderProcess}
                />
            )}
            {modal.type === 'kpi-source' && (
                <KpiSourceModal
                    isOpen={modal.type === 'kpi-source'}
                    onClose={handleCloseModal}
                    kpi={processedKpis.find(k => k.id === modal.data?.id) || modal.data}
                    defaultLocation={currentLocObj.name}
                    year={kpiData.yil}
                    onPull={handlePullFromSource}
                    onClear={handleClearSource}
                />
            )}
        </div>
    );
};

export default App;