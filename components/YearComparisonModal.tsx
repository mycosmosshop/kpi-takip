// Yıl karşılaştırma: geçen yılın HEDEFİ ve GERÇEKLEŞENİ (ortalama) ile
// bu yılın hedefini yan yana koyar.
//
// Geçen yılın gerçekleşeni tablodaki "Önceki Yıl" hücresinden DEĞİL, geçen
// yılın kendi aylık verisinden hesaplanır. "Önceki Yıl" elle yazılan bir
// alan; eskimiş olabilir. İkisi farklıysa uyarı verilir — bu, denetimde
// "bu sayı nereden geliyor?" sorusunun cevabı.
import React, { useMemo, useState } from 'react';
import { Kpi, MultiYearKpiData, Status } from '../types';
import {
    karsilastir, sapmaVar, hedefDegisimi, KarsilastirmaSatiri,
} from '../utils/yilKarsilastirma';
import Modal from './Modal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    kpis: Kpi[];                       // bu yılın işlenmiş KPI'ları
    multiYearData: MultiYearKpiData;   // bu lokasyonun tüm yılları
    currentYear: number;
}

const opSym = (c: string) => (c === '>=' ? '≥' : c === '<=' ? '≤' : c === '>' ? '>' : c === '<' ? '<' : '=');

const fmt = (n: number | null | undefined): string => {
    if (n === null || n === undefined || isNaN(Number(n))) return '—';
    const x = Number(n);
    const abs = Math.abs(x);
    return x.toLocaleString('tr-TR', { maximumFractionDigits: abs >= 1000 ? 0 : (abs < 1 ? 4 : 2) });
};

const YearComparisonModal: React.FC<Props> = ({ isOpen, onClose, kpis, multiYearData, currentYear }) => {
    const oncekiYil = currentYear - 1;
    const [sadeceFarkli, setSadeceFarkli] = useState(false);

    const satirlar = useMemo<KarsilastirmaSatiri[]>(
        () => karsilastir(kpis, multiYearData, oncekiYil),
        [kpis, multiYearData, oncekiYil]);

    const gosterilen = sadeceFarkli ? satirlar.filter(sapmaVar) : satirlar;
    const sapmaSayisi = satirlar.filter(sapmaVar).length;
    const eksik = satirlar.filter(s => !s.varMi).length;

    const hedefYonu = (s: KarsilastirmaSatiri): { metin: string; renk: string } => {
        const d = hedefDegisimi(s);
        if (d.sikilasti === null) {
            return { metin: d.fark === null ? '—' : 'değişmedi', renk: '#6b7280' };
        }
        return {
            metin: (d.fark! > 0 ? '+' : '') + fmt(d.fark)
                + (d.yuzde !== null ? ` (${fmt(d.yuzde)}%)` : '')
                + (d.sikilasti ? ' · sıkılaştı' : ' · gevşedi'),
            renk: d.sikilasti ? '#1e7e34' : '#c0392b',
        };
    };

    const th = 'px-3 py-2 text-left font-semibold border-b border-gray-300 dark:border-gray-600 whitespace-nowrap';
    const td = 'px-3 py-2 border-b border-gray-200 dark:border-gray-700 align-top';
    const sayi = td + ' text-right whitespace-nowrap';

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="7xl"
            title={`Yıl Karşılaştırma — ${oncekiYil} → ${currentYear}`}>
            <div className="text-sm">
                <div className="mb-3 flex flex-wrap gap-3 items-center">
                    <div className="px-3 py-2 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200">
                        <b>{satirlar.length}</b> KPI karşılaştırıldı
                    </div>
                    {eksik > 0 && (
                        <div className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                            <b>{eksik}</b> KPI’nın {oncekiYil} kaydı yok
                        </div>
                    )}
                    {sapmaSayisi > 0 && (
                        <label className="px-3 py-2 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={sadeceFarkli}
                                onChange={e => setSadeceFarkli(e.target.checked)} />
                            <span><b>{sapmaSayisi}</b> KPI’da “Önceki Yıl” hücresi {oncekiYil}
                                {' '}ortalamasıyla tutmuyor — yalnızca onları göster</span>
                        </label>
                    )}
                </div>

                <div className="overflow-auto" style={{ maxHeight: '62vh' }}>
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className={th}>Proses</th>
                                <th className={th}>KPI</th>
                                <th className={th + ' text-right'}>{oncekiYil} hedef</th>
                                <th className={th + ' text-right'}>{oncekiYil} gerçekleşen<br />
                                    <span className="font-normal text-xs text-gray-500">(aylık ortalama)</span></th>
                                <th className={th + ' text-center'}>{oncekiYil} durum</th>
                                <th className={th + ' text-right'}>{currentYear} hedef</th>
                                <th className={th}>Hedef değişimi</th>
                                <th className={th + ' text-right'}>Tabloda yazan<br />
                                    <span className="font-normal text-xs text-gray-500">“Önceki Yıl”</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {gosterilen.map(s => {
                                const y = hedefYonu(s);
                                const sap = sapmaVar(s);
                                return (
                                    <tr key={s.kpi.id} className={sap ? 'bg-amber-50 dark:bg-amber-900/20' : ''}>
                                        <td className={td + ' text-gray-600 dark:text-gray-300'}>{s.kpi.proses}</td>
                                        <td className={td + ' font-medium'}>{s.kpi.kpi_adi}
                                            <span className="text-gray-500 font-normal"> ({s.kpi.birim})</span></td>
                                        <td className={sayi}>{s.varMi ? fmt(s.gecenHedef) : '—'}</td>
                                        <td className={sayi}>{fmt(s.gecenGercek)}</td>
                                        <td className={td + ' text-center'}>
                                            {s.gecenDurum === 'basarili' ? <span style={{ color: '#1e7e34' }}>✓</span>
                                                : s.gecenDurum === 'marjinal' ? <span style={{ color: '#b7791f' }}>≈</span>
                                                    : s.gecenDurum === 'basarisiz' ? <span style={{ color: '#c0392b' }}>✗</span>
                                                        : <span className="text-gray-400">—</span>}
                                        </td>
                                        <td className={sayi}>{fmt(s.buHedef)}
                                            <span className="text-gray-500"> ({opSym(s.kpi.karsilastirma)})</span></td>
                                        <td className={td} style={{ color: y.renk }}>{y.metin}</td>
                                        <td className={sayi}>
                                            {fmt(s.yazanOnceki)}
                                            {sap && (
                                                <div className="text-xs" style={{ color: '#b7791f' }}>
                                                    ≠ {fmt(s.gecenGercek)}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {gosterilen.length === 0 && (
                                <tr><td className={td + ' text-center text-gray-500'} colSpan={8}>
                                    Gösterilecek satır yok.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    “{oncekiYil} gerçekleşen”, o yılın <b>kendi aylık verisinden</b> hesaplanır;
                    tablodaki “Önceki Yıl” hücresi elle girilir ve eskimiş olabilir.
                    {oncekiYil} kaydı olmayan KPI’larda karşılaştırma yapılmaz — tarih uydurulmaz.
                </p>
            </div>
        </Modal>
    );
};

export default YearComparisonModal;
