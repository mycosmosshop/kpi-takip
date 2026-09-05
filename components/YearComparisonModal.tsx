// Yıl karşılaştırma: geçen yılın HEDEFİ ve GERÇEKLEŞENİ (ortalama) ile
// bu yılın hedefini yan yana koyar; son sütunda gelecek yıl için hedef
// tavsiyesi verir.
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
import { tavsiyeDetay, atanacakHedefler, IYILESTIRME, TavsiyeSonuc } from '../utils/hedefTavsiye';
import Modal from './Modal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    kpis: Kpi[];                       // bu yılın işlenmiş KPI'ları
    multiYearData: MultiYearKpiData;   // bu lokasyonun tüm yılları
    currentYear: number;
    onAssignTargets?: (hedefler: { [kpiId: string]: number }) => void;
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

const YearComparisonModal: React.FC<Props> = ({ isOpen, onClose, kpis, multiYearData, currentYear, onAssignTargets }) => {
    const oncekiYil = currentYear - 1;
    const sonrakiYil = currentYear + 1;
    const [sadeceFarkli, setSadeceFarkli] = useState(false);
    const [sadeceDegisen, setSadeceDegisen] = useState(false);
    const [sadeceDegisenListe, setSadeceDegisenListe] = useState(false);
    // Tavsiye sütununda elle yapılan düzeltmeler (kpi.id → yazılan metin)
    const [duzeltme, setDuzeltme] = useState<{ [id: string]: string }>({});

    const satirlar = useMemo<KarsilastirmaSatiri[]>(
        () => karsilastir(kpis, multiYearData, oncekiYil),
        [kpis, multiYearData, oncekiYil]);

    const sapmaSayisi = satirlar.filter(sapmaVar).length;
    const yeniSayisi = satirlar.filter(s => s.tip === 'yeni').length;
    const kaldirilanSayisi = satirlar.filter(s => s.tip === 'kaldirildi').length;
    const sikilasan = satirlar.filter(s => hedefDegisimi(s).sikilasti === true).length;
    const gevseyen = satirlar.filter(s => hedefDegisimi(s).sikilasti === false).length;
    const gecenBasarili = satirlar.filter(s => s.gecenDurum === 'basarili').length;
    const gecenVeriliToplam = satirlar.filter(s => s.gecenDurum && s.gecenDurum !== 'n/a').length;

    let gosterilen = satirlar;
    if (sadeceFarkli) gosterilen = gosterilen.filter(sapmaVar);
    if (sadeceDegisen) gosterilen = gosterilen.filter(s => hedefDegisimi(s).sikilasti !== null);
    if (sadeceDegisenListe) gosterilen = gosterilen.filter(s => s.tip !== 'ayni');

    // Tavsiye edilen hedef: (bu yılın hedefi + gerçekleşeni) / 2, üzerine %5
    // iyileştirme. Elle düzeltme varsa o geçerlidir.
    const oneriler = useMemo(() => {
        const m = new Map<string, TavsiyeSonuc | null>();
        satirlar.forEach(s => m.set(s.kpi.id, s.tip === 'kaldirildi'
            ? null
            // Önceki yılın GERÇEKLEŞENİ de hesaba girer (tek yıllık sıçrama
            // hedefi savurmasın).
            : tavsiyeDetay(s.kpi, s.buGercek, s.gecenGercek)));
        return m;
    }, [satirlar]);

    const yazilan = (s: KarsilastirmaSatiri): string => {
        const d = duzeltme[s.kpi.id];
        if (d !== undefined) return d;
        const o = oneriler.get(s.kpi.id);
        return (o === null || o === undefined) ? '' : String(o.hedef);
    };

    // Atanacaklar: SADECE görünen satırlar. Filtre, seçimin kendisidir —
    // gizli satıra sessizce hedef yazmak denetimde açıklanamaz.
    const atanacak = useMemo(() => atanacakHedefler(gosterilen, yazilan),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [gosterilen, duzeltme, oneriler]);

    const atanacakSayi = Object.keys(atanacak).length;
    const sonrakiMevcut = (multiYearData[sonrakiYil]?.kpis || []).length;

    const ata = () => {
        if (!onAssignTargets || !atanacakSayi) return;
        const uyari = sonrakiMevcut
            ? `${sonrakiYil} yılında zaten ${sonrakiMevcut} KPI var; eşleşenlerin hedefi GÜNCELLENECEK.`
            : `${sonrakiYil} yılı henüz yok; ${currentYear} KPI'ları bu hedeflerle kopyalanacak (aylık veriler boş).`;
        if (!window.confirm(`${atanacakSayi} KPI için ${sonrakiYil} hedefi atanacak.\n\n${uyari}\n\nDevam edilsin mi?`)) return;
        onAssignTargets(atanacak);
    };

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

    const Rozet: React.FC<{ tip: string }> = ({ tip }) => {
        if (tip === 'yeni') {
            return <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold align-middle"
                style={{ background: '#dcfce7', color: '#166534' }}
                title={`${oncekiYil} yılında yok, ${currentYear} yılında eklendi`}>+ YENİ</span>;
        }
        if (tip === 'kaldirildi') {
            return <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold align-middle"
                style={{ background: '#e5e7eb', color: '#374151' }}
                title={`${oncekiYil} yılında vardı, ${currentYear} listesinde yok`}>− KALDIRILDI</span>;
        }
        return null;
    };

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
                    {yeniSayisi > 0 && <Kart renk="#0d9488" buyuk={'+' + yeniSayisi} alt={`${currentYear} yılında eklenen KPI`} />}
                    {kaldirilanSayisi > 0 && <Kart renk="#6b7280" buyuk={'−' + kaldirilanSayisi} alt={`${oncekiYil} yılında olup kaldırılan`} />}
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
                    {(yeniSayisi + kaldirilanSayisi) > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={sadeceDegisenListe}
                                onChange={e => setSadeceDegisenListe(e.target.checked)} />
                            <span>Yalnızca <b>eklenen / kaldırılan</b></span>
                        </label>
                    )}
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
                                <th className={th + ' text-right'}>{currentYear} gerçekleşen</th>
                                <th className={th}>Hedef değişimi</th>
                                <th className={th + ' text-right bg-indigo-50 dark:bg-indigo-900/30'}
                                    style={{ minWidth: 130 }}>
                                    {sonrakiYil} tavsiye
                                    <div className="font-normal normal-case text-[10px] text-gray-500 dark:text-gray-400"
                                        title={`Taban = 0,5×${currentYear} gerçekleşen + 0,3×${currentYear} hedef + 0,2×${oncekiYil} gerçekleşen`
                                            + ` · pay %${IYILESTIRME * 100} ± performans (hedefi tutturana +%2, tutturamayana −%3,`
                                            + ` önceki yıla göre iyileşene +%2) · tavsiye mevcut hedeften gevşek olamaz`}>
                                        0,5×gerçekleşen + 0,3×hedef + 0,2×önceki yıl<br />
                                        ± performansa göre %1–%10 iyileştirme
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {gruplar.map(([proses, satir]) => (
                                <React.Fragment key={proses}>
                                    <tr className="bg-gray-100 dark:bg-gray-800">
                                        <td className="px-3 py-1.5 font-semibold text-xs text-gray-700 dark:text-gray-200"
                                            colSpan={8}>{proses}</td>
                                    </tr>
                                    {satir.map(s => {
                                        const d = hedefDegisimi(s);
                                        const sap = sapmaVar(s);
                                        const kaldirildi = s.tip === 'kaldirildi';
                                        const oneri = oneriler.get(s.kpi.id) || null;
                                        const oneriDeger = oneri ? oneri.hedef : null;
                                        const elle = duzeltme[s.kpi.id] !== undefined
                                            && duzeltme[s.kpi.id] !== (oneriDeger === null ? '' : String(oneriDeger));
                                        return (
                                            <tr key={s.tip + '|' + s.kpi.id}
                                                className={'hover:bg-blue-50/60 dark:hover:bg-gray-700/60 '
                                                    + (kaldirildi ? 'opacity-70 bg-gray-50 dark:bg-gray-800/40 '
                                                        : s.tip === 'yeni' ? 'bg-teal-50/50 dark:bg-teal-900/10 ' : '')
                                                    + (sap ? 'bg-amber-50 dark:bg-amber-900/20' : '')}>
                                                <td className={td}>
                                                    <div className="font-medium">
                                                        {s.kpi.kpi_adi}<Rozet tip={s.tip} />
                                                    </div>
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
                                                    {kaldirildi ? <span className="text-gray-400">yok</span> : (
                                                        <>
                                                            {fmt(s.buHedef)}
                                                            <span className="text-gray-400 text-xs"> {opSym(s.kpi.karsilastirma)}</span>
                                                        </>
                                                    )}
                                                </td>
                                                <td className={sayi}>
                                                    {kaldirildi ? <span className="text-gray-400">—</span> : fmt(s.buGercek)}
                                                </td>
                                                <td className={td}>
                                                    {d.sikilasti === null ? (
                                                        <span className="text-gray-400 text-xs">
                                                            {kaldirildi ? `${currentYear} listesinde yok`
                                                                : d.fark === null ? `${oncekiYil} kaydı yok`
                                                                    : 'değişmedi'}
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
                                                <td className={td + ' text-right bg-indigo-50/40 dark:bg-indigo-900/20'}>
                                                    {kaldirildi ? <span className="text-gray-400 text-xs">—</span> : (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <input type="text" inputMode="decimal"
                                                                value={yazilan(s)}
                                                                placeholder={oneri === null ? 'veri yok' : ''}
                                                                title={oneri === null
                                                                    ? (s.buGercek === null
                                                                        ? `${currentYear} gerçekleşen değeri yok — tavsiye üretilmez`
                                                                        : '“=” hedefte iyileştirme yönü yok — tavsiye üretilmez')
                                                                    : oneri.aciklama}
                                                                onChange={e => setDuzeltme(p => ({ ...p, [s.kpi.id]: e.target.value }))}
                                                                className={'w-24 px-2 py-1 text-right tabular-nums rounded border text-sm '
                                                                    + (elle ? 'border-indigo-500 bg-white dark:bg-gray-800 font-semibold'
                                                                        : 'border-gray-300 dark:border-gray-600 bg-white/70 dark:bg-gray-800/70')} />
                                                            <span className="text-gray-400 text-xs w-3">{opSym(s.kpi.karsilastirma)}</span>
                                                        </div>
                                                    )}
                                                    {oneri && oneri.korundu && !elle && (
                                                        <div className="text-[10px] text-amber-700 dark:text-amber-400"
                                                            title={oneri.aciklama}>hedef korundu</div>
                                                    )}
                                                    {elle && (
                                                        <button className="text-[10px] text-indigo-600 hover:underline"
                                                            onClick={() => setDuzeltme(p => { const n = { ...p }; delete n[s.kpi.id]; return n; })}>
                                                            tavsiyeye dön ({fmt(oneriDeger)})
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                            {gosterilen.length === 0 && (
                                <tr><td className={td + ' text-center text-gray-500'} colSpan={8}>
                                    Seçilen filtreye uyan satır yok.
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {onAssignTargets && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg
                        bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                        <div className="text-xs text-gray-700 dark:text-gray-200">
                            <b>{sonrakiYil} hedefleri:</b> tavsiye sütunundaki değerler ({atanacakSayi} KPI)
                            {sonrakiMevcut > 0
                                ? ` ${sonrakiYil} yılındaki mevcut ${sonrakiMevcut} KPI'ya yazılır.`
                                : ` ${sonrakiYil} yılı oluşturularak yazılır (aylık veriler boş gelir).`}
                            <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                                Yalnızca <b>görünen</b> satırlar atanır; hücreyi boşaltırsanız o KPI atlanır.
                            </div>
                        </div>
                        <button onClick={ata} disabled={!atanacakSayi}
                            className="px-4 py-2 rounded-lg text-white text-sm font-semibold whitespace-nowrap
                                bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                            Bu hedefleri {sonrakiYil} için ata ({atanacakSayi})
                        </button>
                    </div>
                )}

                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    “{oncekiYil} gerçekleşen”, o yılın <b>kendi aylık verisinden</b> hesaplanır;
                    tablodaki “Önceki Yıl” hücresi elle girilir ve eskimiş olabilir — ikisi
                    ayrılırsa satır sarı işaretlenir. {oncekiYil} kaydı olmayan KPI “+ YENİ”,
                    {' '}{currentYear} listesinde olmayan “− KALDIRILDI” işaretlenir; değer uydurulmaz.
                </p>
            </div>
        </Modal>
    );
};

export default YearComparisonModal;
