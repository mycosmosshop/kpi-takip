

export type Comparison = '<' | '>' | '=' | '>=' | '<=';
export type CalculationMethod = 'ortalama' | 'medyan' | 'yilici_kumulatif' | 'formula';
export type Status = 'basarili' | 'marjinal' | 'basarisiz' | 'n/a';
export type DofStatus = 'Açık' | 'Devam' | 'Tamamlandı';
export type RiskLevel = 'Düşük' | 'Orta' | 'Yüksek' | 'N/A';
export type ReviewPeriod = 'aylik' | '2aylik' | '3aylik' | '4aylik' | '6aylik' | 'yillik';

export interface FiveWhyStep {
    id: string;
    why: string;
    because: string;
}

export type CorrectiveActionStatus = 'Açık' | 'Devam' | 'Tamamlandı' | 'Doğrulandı';

export interface CorrectiveAction {
    id: string;
    action: string;
    responsible: string;
    dueDate: string;
    status: CorrectiveActionStatus;
    verificationNotes?: string;
    linkedRootCauses?: string[];
}

export interface FishboneCategory {
    name: string;
    causes: string[];
}

export interface FishboneAnalysis {
    problem: string;
    categories: FishboneCategory[];
}

export type FtaGateType = 'AND' | 'OR' | 'PRIORITY_AND' | 'XOR' | 'INHIBIT';
export type FtaEventType = 'BASIC' | 'UNDEVELOPED' | 'INTERMEDIATE' | 'CONDITIONAL' | 'HOUSE' | 'TRANSFER';
export type FtaNodeType = 'event' | 'gate';

export interface FtaNode {
  id: string;
  type: FtaNodeType;
  gateType?: FtaGateType;
  eventType?: FtaEventType;
  text: string;
  children: FtaNode[];
  x?: number;
  y?: number;
  p?: number; // User-input probability for basic events
  houseValue?: boolean; // For HOUSE event type: true=1, false=0. Default true.
  calculatedP?: number; // Result of calculation for this node
}

export interface FaultTreeAnalysis {
  topEvent: FtaNode;
  floatingNodes?: FtaNode[];
  calculationResult?: {
    p: number;
    steps: string;
    fixes?: string[];
    warnings?: { id: string; message: string }[];
    insightsText?: string;
  };
}

export interface ParetoAnalysisData {
    inputData: string;
    thresholdMode: '70' | '80' | 'custom';
    customThreshold: number;
}

export interface ScatterPlotAnalysisData {
    inputData: string;
    matrixCols: string[];
    simpleX: string;
    simpleY: string;
    showMatrixTrend: boolean;
    showMatrixR: boolean;
    showMatrixHeat: boolean;
    alpha: number;
    showSimpleTrend: boolean;
}

export interface FiveWhyAnalysis {
    occurrence: FiveWhyStep[];
    nonDetection: FiveWhyStep[];
    occurrenceRootCause: string;
    nonDetectionRootCause: string;
    fishbone?: FishboneAnalysis;
    fta?: FaultTreeAnalysis;
    pareto?: ParetoAnalysisData;
    scatter?: ScatterPlotAnalysisData;
}

export interface Dof {
    id: string;
    kpiId: string;
    start_date: string; // D0
    sorumlu: string;
    due_date: string;
    durum: DofStatus;
    ilerleme: number;

    // 8D Adımları
    takim: string; // D1
    problemTanimi: string; // D2
    geciciOnlemler: string; // D3
    kokNedenAnalizi?: FiveWhyAnalysis; // D4
    kaliciAksiyonlar: CorrectiveAction[]; // D5

    uygulamaDogrulama: string; // D6
    uygulamaDogrulamaSorumlu?: string;
    uygulamaDogrulamaTermin?: string;

    tekrarinOnlenmesi: string; // D7
    tekrarinOnlenmesiSorumlu?: string;
    tekrarinOnlenmesiTermin?: string;
    
    takdir: string; // D8
    takdirSorumlu?: string;
    takdirTermin?: string;

    // Etkinlik Kontrolü
    etkinlikKontroluNotlari?: string;
    etkinlikKontrolSorumlusu?: string;
    etkinlikKontrolTarihi?: string;

    // Geriye dönük uyumluluk için eski alanlar (isteğe bağlı)
    kok_neden?: string;
    aksiyon?: string;
}


export interface Risk {
    S: number;
    O: number;
    D: number;
    RPN: number;
    esik: number;
    riskSeviyesi: RiskLevel;
}

export type SourceType = 'cmms' | 'egitim' | 'tedarikci';
export type SourceMetric =
    | 'mtbf' | 'mttr' | 'availability' | 'pmr' | 'pmc' | 'unplanned' | 'mttf'  // CMMS (Bakım)
    | 'egitim_sure' | 'egitim_gerceklesme'                                     // Eğitim
    | 'iade_ppm' | 'td_puan' | 'td_terminpuan' | 'td_ppmpuan' | 'td_termin';   // Tedarikçi Değerlendirme

export interface KpiSource {
    type: SourceType;
    metric: SourceMetric;
    location?: string;   // kaynak lokasyonu (boşsa app lokasyon adı kullanılır)
    scope?: string;      // tedarikçi kapsamı: 'tum'|'onayli'|'otomotiv'|'onayli_otomotiv'|'filtre'
    filterId?: number;   // scope='filtre' iken onaylı sistemdeki kayıtlı filtre id'si
    filterName?: string; // kayıtlı filtre adı (görünüm için)
    formula?: string;    // opsiyonel; 'x' = kaynaktan çekilen değer (ör. x/60)
}

export interface Kpi {
    id: string;
    proses: string;
    kpi_adi: string;
    kaynak?: KpiSource;
    sorumlu?: string;
    gozdenGecirmePeriyodu?: ReviewPeriod;
    pasifAylar?: string[];
    onceki_yil_gerceklesen: number | null;
    yeni_yil_hedef: number;
    karsilastirma: Comparison;
    hesap_metodu: CalculationMethod;
    formula?: string;
    birim: string;
    aciklama: string;
    kanit_dosyalari: { id: string; name: string; type: string; data: string; }[];
    aylik: { [key: string]: number | null };
    ortalama: number | null;
    durum: Status;
    risk: Risk;
    dof: Dof[];
    son_guncelleme: string;
}

export interface KpiData {
    yil: number;
    kpis: Kpi[];
}

export type MultiYearKpiData = {
    [year: number]: KpiData;
};

export type Company = 'sanifoam' | 'ultech';

export interface KpiLocation {
    id: string;
    name: string;
    company: Company;
}

export type ActionPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ActionItem {
    id: string;
    kpiId?: string;       // bağlı KPI (opsiyonel)
    kpi: string;          // KPI metni (ör. "Müşteri Şikayetleri ≤ 3,5 Ortalama: 5,33")
    rootCause: string;    // Root Cause
    action: string;       // Action
    rank: number;         // 1-5 (FR216 RANK)
    priority: ActionPriority;
    owner: string;        // OWNER
    assigned: string;     // ASSIGNED
    due: string;          // DUE (tarih metni)
    done: boolean;        // DONE
    status: number;       // 0-100 (% tamamlanma)
    notes: string;        // NOTES
    dofId?: string;       // başlatılan 8D bağlantısı
}

export interface ActionYearData {
    items: ActionItem[];
    nextMeeting: string;  // Next Meeting (tarih/saat metni)
}

export type ModalType = 'kpi' | 'dof' | 'risk' | 'detail' | 'month-detail' | 'all-dofs' | 'dof-report' | 'change-year' | 'copy-dof' | 'delete-process' | 'appearance-settings' | 'evidence' | 'bulk-kpi' | 'doe-tool' | 'action-items' | 'trend-chart' | 'locations' | 'process-order' | 'kpi-source' | null;

export interface ModalState {
    type: ModalType;
    data?: any;
}

export interface TooltipSettings {
    goster: boolean;
    aktif_ay_degeri: boolean;
    sorumlu: boolean;
    hesap_metodu: boolean;
    RPN: boolean;
    son_guncelleme: boolean;
    hedef: boolean;
    durum: boolean;
    opacity: number;
}

export type AppearanceTheme = 'default' | 'corporate-light' | 'modern-dark';

export interface AppearanceSettings {
    fontSize: 'xs' | 'sm' | 'base';
    fontWeight: 'normal' | 'medium' | 'semibold';
    theme: AppearanceTheme;
    showSonGuncelleme?: boolean;
}