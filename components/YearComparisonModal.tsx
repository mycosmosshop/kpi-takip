// Yıl karşılaştırma: geçen yılın HEDEFİ ve GERÇEKLEŞENİ (ortalama) ile
// bu yılın hedefini yan yana koyar.
//
// Geçen yılın gerçekleşeni tablodaki "Önceki Yıl" hücresinden DEĞİL, geçen
// yılın kendi aylık verisinden hesaplanır. "Önceki Yıl" elle yazılan bir
// alan; eskimiş olabilir. İkisi farklıysa uyarı verilir — bu, denetimde
// "bu sayı nereden geliyor?" sorusunun cevabı.
import React, { useMemo, useState } from 'react';
import { Kpi, MultiYearKpiData } from '../types';
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

// Geçen yılın gerçekleşeni hedefe göre nerede? Birimler KPI'dan KPI'ya
// çok farklı (TL, ppm, saat), o yüzden çubuk MUTLAK değil hedefe ORANLI:
// hedef her satırda aynı yerde durur, göz kıyaslayabilsin.
const Cubuk: React.FC<{ s: KarsilastirmaSatiri }> = ({ s }) => {
    if (s.gecenGercek === null || s.gecenHedef === null || s.gecenHedef === 0) {
        return <span className="text-gray-400">—</span>;
    }
    const oran = s.gecenGercek / Math.abs(s.gecenHedef);         // 1 = hedefte
    const basarili = s.gecenDurum === 'basarili';
    const marjinal = s.gecenDurum === 'marjinal';
    const renk = basarili ? '#22c55e' : marjinal ? '#eab308' : '#ef4444';
    // 2× hedef tam genişlik; taşan değer sınıra dayanır (ok ile belirtilir)
    const gen = Math.min(oran / 2, 1) * 100;
    const tasti = oran > 2;
    return (
        <div className="flex items-center gap-2" title={`Hedefin %${fmt(oran * 100)}’i`}>
            <div className="relative flex-1 h-3 rounded bg-gray-200 dark:bg-gray-600 min-w-[70px]">
                <div className="absolute inset-y-0 left-0 rounded"
                    style={{ width: `${gen}%`, background: renk }} />
                {/* Hedef çizgisi: %50 = hedef (ölçek 2× hedef) */}
                <div className="absolute inset-y-[-3px] w-[2px] bg-gray-700 dark:bg-gray-200"
                    style={{ left: '50%' }} title="Hedef" />
            </div>
            <span className="text-xs tabular-nums w-12 text-right"
                style={{ color: renk }}>{tasti ? '›' : ''}{fmt(oran * 100)}%</span>
        </div>
    );
};

const YearComparisonModal: React.FC<Props> = ({ isOpen, onClose, kpis, multiYearData, currentYear }) => {
    const oncekiYil = currentYear - 1;
    const [sadeceFarkli, setSadeceFarkli] = useState(false);
    const [sadeceDegisen, setSadeceDegisen] = useState(false);

    const satirlar = useMemo<KarsilastirmaSatiri[]>(
        () => karsilastir(kpis, multiYearData, oncekiYil),
        [kpis, multiYearData, oncekiYil]);

    const sapmaSayisi = satirlar.filter(sapmaVar).length;
    const eksik = satirlar.filter(s => !s.varMi).length;
    const sikilasan = satirlar.filter(s => hedefDegisimi(s).sikilasti === true).length;
    const gevseyen = satirlar.filter(s => hedefDegisimi(s).sikilasti === false).length;
    const gecenBasarili = satirlar.filter(s => s.gecenDurum === 'basarili').length;
    const gecenVeriliToplam = satirlar.filter(s => s.gecenDurum && s.gecenDurum !== 'n/a').length;

    let gosterilen = satirlar;
    if (sadeceFarkli) gosterilen = gosterilen.filter(sapmaVar);
    if (sadeceDegisen) gosterilen = gosterilen.filter(s => hedefDegisimi(s).sikilasti !== null);

    // Prosese göre grupla: tablo 19 satırda tek blok olunca okunmuyordu.
    const gruplar = useMemo(() => {
        const m = new Map<string, KarsilastirmaSatiri[]>();
        gosterilen.forEach(s => {
            const p = s.kpi.proses || '—';
            if (!m.has(p)) m.set(p, []);
            m.get(p)!.push(s);
        });
        return Array.from(m.entries());
    }, [gosterilen]);

    const th = 'px-3 py-2 text-left font-semibold text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300 border-b-2 border-gray-300 dark:border-gray-600 whitespace-nowrap';
    const td = 'px-3 py-2 border-b border-gray-100 dark:border-gray-700 align-middle';
    const sayi = td + ' text-right whitespace-nowrap tabular-nums';

    const Kart: React.FC<{ renk: string; buyuk: React.ReactNode; alt: string }> = ({ renk, buyuk, alt }) => (
        <div className="px-4 py-2 rounded-lg border" style={{ borderColor: renk + '55', background: renk + '14' }}>
            <div className="text-xl font-bold leading-tight" style={{ color: renk }}>{buyuk}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300">{alt}</div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="7xl"
            title={`Yıl Karşılaştırma — ${oncekiYil} → ${currentYear}`}>
            <div className="text-sm">
                {/* Özet kartlar: tabloya girmeden önce "ne oldu" cevabı */}
                <div className="mb-4 flex flex-wrap gap-2">
                    <Kart renk="#3b82f6" buyuk={satirlar.length} alt="KPI karşılaştırıldı" />
                    <Kart renk="#22c55e"
                        buyuk={<>{gecenBasarili}<span className="text-sm font-normal">/{gecenVeriliToplam}</span></>}
                        alt={`${oncekiYil} hedefini tutturan`} />
                    <Kart renk="#1e7e34" buyuk={sikilasan} alt={`${currentYear} hedefi sıkılaşan`} />
                    <Kart renk="#c0392b" buyuk={gevseyen} alt={`${currentYear} hedefi gevşeyen`} />
                    {eksik > 0 && <Kart renk="#6b7280" buyuk={eksik} alt={`${oncekiYil} kaydı olmayan`} />}
                    {sapmaSayisi > 0 && <Kart renk="#b7791f" buyuk={sapmaSayisi} alt="“Önceki Yıl” hücresi tutmuyor" />}
                </div>

                <div className="mb-3 flex flex-wrap gap-4 items-center text-xs">
                    {sapmaSayisi > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={sadeceFarkli}
                                onChange={e => setSadeceFarkli(e.target.checked)} />
                            <span>Yalnızca “Önceki Yıl” hücresi {oncekiYil} ortalamasıyla
                                {' '}<b>tutmayanlar</b></span>
                        </label>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={sadeceDegisen}
                            onChange={e => setSadeceDegisen(e.target.checked)} />
                        <span>Yalnızca <b>hedefi değişenler</b></span>
                    </label>
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className="inline-block w-8 h-2 rounded bg-gray-200 dark:bg-gray-600 relative">
                            <span className="absolute inset-y-[-2px] w-[2px] bg-gray-700 dark:bg-gray-200" style={{ left: '50%' }} />
                        </span>
                        çubuktaki çizgi = {oncekiYil} hedefi
                    </span>
                </div>

                <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700"
                    style={{ maxHeight: '58vh' }}>
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className={th}>KPI</th>
                                <th className={th + ' text-right'}>{oncekiYil} hedef</th>
                                <th className={th + ' text-right'}>{oncekiYil} gerçekleşen</th>
                                <th className={th} style={{ minWidth: 150 }}>{oncekiYil} hedefe göre</th>
                                <th className={th + ' text-right'}>{currentYear} hedef</th>
                                <th className={th}>Hedef değişimi</th>
                                <th className={th + ' text-right'}>Tabloda yazan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gruplar.map(([proses, satir]) => (
                                <React.Fragment key={proses}>
                                    <tr className="bg-gray-100 dark:bg-gray-800">
                                        <td className="px-3 py-1.5 font-semibold text-xs text-gray-700 dark:text-gray-200"
                                            colSpan={7}>{proses}</td>
                                    </tr>
                                    {satir.map(s => {
                                        const d = hedefDegisimi(s);
                                        const sap = sapmaVar(s);
                                        return (
                                            <tr key={s.kpi.id}
                                                className={'hover:bg-blue-50/60 dark:hover:bg-gray-700/60 '
                                                    + (sap ? 'bg-amber-50 dark:bg-amber-900/20' : '')}>
                                                <td className={td}>
                                                    <div className="font-medium">{s.kpi.kpi_adi}</div>
                                                    <div className="text-xs text-gray-500">{s.kpi.birim}</div>
                                                </td>
                                                <td className={sayi}>{s.varMi ? fmt(s.gecenHedef) : '—'}</td>
                                                <td className={sayi}>
                                                    <span className="font-semibold">{fmt(s.gecenGercek)}</span>
                                                    {s.gecenDurum && s.gecenDurum !== 'n/a' && (
                                                        <span className="ml-1">
                                                            {s.gecenDurum === 'basarili' ? '✓'
                                                                : s.gecenDurum === 'marjinal' ? '≈' : '✗'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={td}><Cubuk s={s} /></td>
                                                <td className={sayi}>
                                                    {fmt(s.buHedef)}
                                                    <span className="text-gray-400 text-xs"> {opSym(s.kpi.karsilastirma)}</span>
                                                </td>
                                                <td className={td}>
                                                    {d.sikilasti === null ? (
                                                        <span className="text-gray-400 text-xs">
                                                            {d.fark === null ? 'karşılaştırılamıyor' : 'değişmedi'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                                            style={{
                                                                background: d.sikilasti ? '#dcfce7' : '#fee2e2',
                                                                color: d.sikilasti ? '#166534' : '#991b1b',
                                                            }}>
                                                            {d.sikilasti ? '▲ sıkılaştı' : '▼ gevşedi'}
                                                            <span className="opacity-70">
                                                                {(d.fark! > 0 ? '+' : '') + fmt(d.fark)}
                                                                {d.yuzde !== null && ` (${fmt(d.yuzde)}%)`}
                                                            </span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={sayi}>
                                                    {fmt(s.yazanOnceki)}
                                                    {sap && (
                                                        <div className="text-xs font-medium" style={{ color: '#b7791f' }}>
                                                            ≠ {fmt(s.gecenGercek)}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                            {gosterilen.length === 0 && (
                                <tr><td className={td + ' text-center text-gray-500'} colSpan={7}>
                                    Seçilen filtreye uyan satır yok.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    “{oncekiYil} gerçekleşen”, o yılın <b>kendi aylık verisinden</b> hesaplanır;
                    tablodaki “Önceki Yıl” hücresi elle girilir ve eskimiş olabilir — ikisi
                    ayrılırsa satır sarı işaretlenir. {oncekiYil} kaydı olmayan KPI’da
                    karşılaştırma yapılmaz, değer uydurulmaz.
                </p>
            </div>
        </Modal>
    );
};

export default YearComparisonModal;
