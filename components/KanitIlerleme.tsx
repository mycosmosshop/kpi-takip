import React, { useEffect, useState } from 'react';

// FR100 dışa aktarmadan sonra LeanSys kanıt Excel'i üretilirken (ajan /kpikanit, ~1–3 dk) ilerleme göstergesi.
// Ajan ara durum bildirmiyor: çubuk geçen süre / tahmini süreyle dolar, %95'te bekler, iş bitince kapanır.
const TAHMINI_SN = 120;

const sure = (sn: number) => `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`;

const KanitIlerleme: React.FC<{ baslangic: number; lokasyon: string }> = ({ baslangic, lokasyon }) => {
    const [simdi, setSimdi] = useState(Date.now());
    useEffect(() => {
        const t = window.setInterval(() => setSimdi(Date.now()), 1000);
        return () => window.clearInterval(t);
    }, []);
    const gecen = Math.max(0, Math.round((simdi - baslangic) / 1000));
    const oran = Math.min(95, (gecen / TAHMINI_SN) * 95);
    return (
        <div role="status" aria-live="polite"
            className="fixed bottom-4 left-4 z-50 w-80 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            <div className="flex justify-between text-sm font-medium text-gray-800 dark:text-gray-100">
                <span>Kanıt Excel'i hazırlanıyor — {lokasyon}</span>
                <span className="tabular-nums text-gray-500">{sure(gecen)}</span>
            </div>
            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-1000 ease-linear" style={{ width: `${oran}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
                {gecen < TAHMINI_SN
                    ? `LeanSys'ten okunup hesaplanıyor (tahmini ~${sure(TAHMINI_SN)}). İnince otomatik indirilir; sayfada çalışmaya devam edebilirsiniz.`
                    : 'Beklenenden uzun sürüyor; ajan hâlâ çalışıyor. İnince otomatik indirilir.'}
            </p>
        </div>
    );
};

export default KanitIlerleme;
