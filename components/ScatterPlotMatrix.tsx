import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ScatterPlotAnalysisData } from '../types';

// --- Statistical Helper Functions ---
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

function lgamma(z: number): number {
  const g = 7, p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1; let x = p[0]; for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(x: number, a: number, b: number): number {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1, m2 = 2; m <= MAXIT; m++, m2 += 2) {
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regIncBeta(x: number, a: number, b: number): number {
  const bt = (x === 0 || x === 1) ? 0 : Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const sym = x < (a + 1) / (a + b + 2);
  const cf = betacf(sym ? x : 1 - x, sym ? a : b, sym ? b : a);
  return sym ? bt * cf / a : 1 - bt * cf / b;
}

function tCDF(t: number, nu: number): number {
  const x = nu / (nu + t * t);
  const ib = regIncBeta(x, nu / 2, 0.5);
  const cdfPos = 1 - 0.5 * ib;
  return t >= 0 ? cdfPos : 1 - cdfPos;
}

function corr(x: number[], y: number[]): number {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  return sxy / Math.sqrt((sxx || 1e-12) * (syy || 1e-12));
}

function ols(x: number[], y: number[]) {
  const n = x.length, mx = mean(x), my = mean(y);
  let sxx = 0, sxy = 0, SSE = 0; for (let i = 0; i < n; i++) { const dx = x[i] - mx; sxx += dx * dx; sxy += dx * (y[i] - my); }
  const b1 = sxy / (sxx || 1e-12); const b0 = my - b1 * mx;
  for (let i = 0; i < n; i++) { const e = y[i] - (b0 + b1 * x[i]); SSE += e * e; }
  const df = n - 2, S = Math.sqrt(SSE / df);
  const SSyy = y.reduce((s, v) => s + (v - my) * (v - my), 0);
  const R2 = 1 - SSE / (SSyy || 1e-12);
  const R2adj = 1 - (1 - R2) * (n - 1) / df;
  const r = corr(x, y);
  const t = r * Math.sqrt(df / Math.max(1e-12, 1 - r * r));
  const p = 2 * (1 - tCDF(Math.abs(t), df));
  return { b0, b1, S, R2, R2adj, r, p, n };
}
// --- End Statistical Helper Functions ---

interface ScatterPlotMatrixProps {
    data: ScatterPlotAnalysisData;
    onChange: (data: ScatterPlotAnalysisData) => void;
    readOnly?: boolean;
    initialView?: 'matrix' | 'simple';
    showTabs?: boolean;
}

const ScatterPlotMatrix: React.FC<ScatterPlotMatrixProps> = ({ data, onChange, readOnly = false, initialView = 'matrix', showTabs = true }) => {
    const [activeTab, setActiveTab] = useState(initialView);
    
    // This effect ensures that if the component's props change (e.g. from tabbed to non-tabbed),
    // the internal state is correctly synchronized with the intended view.
    useEffect(() => {
        setActiveTab(initialView);
    }, [initialView]);

    // The single source of truth for which view to render.
    // If tabs are shown, it's controlled by user interaction via `activeTab` state.
    // If tabs are hidden, it's locked to whatever `initialView` prop is passed.
    const currentView = showTabs ? activeTab : initialView;

    const parsedData = useMemo(() => {
        const splitCSVLine = (line: string) => {
            const out = []; let cur = '', q = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '\"') { if (q && line[i + 1] === '\"') { cur += '\"'; i++; } else q = !q; }
                else if (ch === ',' && !q) { out.push(cur); cur = ''; }
                else cur += ch;
            }
            out.push(cur); return out;
        }

        const parse = (text: string) => {
            const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            if (!lines.length) return { headers: [], rows: [] };
            const headers = splitCSVLine(lines[0]).map(h => h.trim());
            const rows: Record<string, number>[] = [];
            for (let i = 1; i < lines.length; i++) {
                const cells = splitCSVLine(lines[i]);
                if (cells.length !== headers.length) continue;
                const obj: Record<string, number> = {};
                headers.forEach((h, idx) => obj[h] = Number(cells[idx]));
                rows.push(obj);
            }
            return { headers, rows };
        }
        return parse(data.inputData);
    }, [data.inputData]);
    
    // --- Refs for DOM elements ---
    const msgRef = useRef<HTMLSpanElement>(null);
    const matrixCanvasRef = useRef<HTMLCanvasElement>(null);
    const simpleCanvasRef = useRef<HTMLCanvasElement>(null);
    const matrixSummaryRef = useRef<HTMLDivElement>(null);
    const simpleSummaryRef = useRef<HTMLDivElement>(null);

    const fmt = (x: number) => (Math.abs(x) >= 1000 || Math.abs(x) < 0.01) ? x.toExponential(2) : x.toFixed(2);
    
    const msg = useCallback((t: string, ok = false) => {
        if (msgRef.current) {
            msgRef.current.textContent = t;
            msgRef.current.className = 'note ' + (ok ? 'ok' : 'err');
            setTimeout(() => {
                if(msgRef.current) {
                    msgRef.current.textContent = '';
                    msgRef.current.className = 'note';
                }
            }, 1600);
        }
    }, []);

    const drawMatrix = useCallback(() => {
        if (!parsedData.rows.length) { if(!readOnly) msg('Önce CSV girin'); return; }
        if(!matrixCanvasRef.current || !matrixSummaryRef.current) return;

        const drawYScale = (ctx: CanvasRenderingContext2D, x: number, y0: number, h: number, vmin: number, vmax: number) => {
            const ticks = [vmin, (vmin + vmax) / 2, vmax];
            ctx.strokeStyle = '#1f2b45'; ctx.fillStyle = '#9fb2d9'; ctx.lineWidth = 1; ctx.textAlign = 'right';
            ticks.forEach(tv => {
                const y = y0 + h - ((tv - vmin) / (vmax - vmin)) * h;
                ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 2, y); ctx.stroke();
                ctx.font = '10px system-ui'; ctx.fillText(fmt(tv), x - 20, y + 3);
            });
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ticks.forEach(tv => { const y = y0 + h - ((tv - vmin) / (vmax - vmin)) * h; ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 9000, y); ctx.stroke(); });
        };

        const drawXScale = (ctx: CanvasRenderingContext2D, x0: number, y: number, w: number, vmin: number, vmax: number) => {
            const ticks = [vmin, (vmin + vmax) / 2, vmax];
            ctx.strokeStyle = '#1f2b45'; ctx.fillStyle = '#9fb2d9'; ctx.lineWidth = 1; ctx.textAlign = 'center';
            ticks.forEach(tv => {
                const x = x0 + ((tv - vmin) / (vmax - vmin)) * w;
                ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 2); ctx.stroke();
                ctx.font = '10px system-ui'; ctx.fillText(fmt(tv), x, y + 10);
                ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - 20); ctx.stroke();
                ctx.strokeStyle = '#1f2b45';
            });
        };
        const heatColor = (v: number) => { const r = Math.round(255 * v), g = Math.round(255 * (1 - Math.abs(v - 0.5) * 2)), b = Math.round(255 * (1 - v)); return `rgba(${r},${g},${b},0.25)`; };

        const buildMatrixSummary = (cols: string[], R: number[][], P: number[][], n: number, alpha: number) => {
            let maxPos = { r: -1, i: -1, j: -1 }, maxNeg = { r: 1, i: -1, j: -1 }, sig: { i: number, j: number, r: number, p: number }[] = [];
            for (let i = 0; i < cols.length; i++) {
                for (let j = i + 1; j < cols.length; j++) {
                    const r = R[i][j], p = P[i][j];
                    if (r > maxPos.r) maxPos = { r, i, j };
                    if (r < maxNeg.r) maxNeg = { r, i, j };
                    if (p <= alpha) sig.push({ i, j, r, p });
                }
            }
            sig.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
            const fmtP = (x: number) => (x < 0.001 ? '<0.001' : x.toFixed(3));
            const posTxt = maxPos.i < 0 ? '—' : `${cols[maxPos.i]} ~ ${cols[maxPos.j]} (r=${fmt(maxPos.r)})`;
            const negTxt = maxNeg.i < 0 ? '—' : `${cols[maxNeg.i]} ~ ${cols[maxNeg.j]} (r=${fmt(maxNeg.r)})`;
            const sigTxt = sig.length ? sig.slice(0, 6).map(s => `• ${cols[s.i]} ↔ ${cols[s.j]}: r=${fmt(s.r)}, p=${fmtP(s.p)}`).join('\n')
                : `• Anlamlı korelasyon bulunmadı (α=${alpha}).`;
            const advice = (r: number) => {
                const ar = Math.abs(r);
                if (ar >= 0.7) return 'Güçlü ilişki ⇒ kontrol planını bu değişken çifti üzerinde yoğunlaştırın; limit & SPC uygulayın.';
                if (ar >= 0.4) return 'Orta ilişki ⇒ örneklem genişletin, DoE ile seviyeleri test ederek etkiyi doğrulayın.';
                if (ar >= 0.2) return 'Zayıf ilişki ⇒ segment (vardiya/tedarikçi/makine) bazında tekrar analiz edin.';
                return 'İlişki görünmüyor ⇒ Pareto/5N/FTA ile diğer nedenleri inceleyin.';
            };
            const posAdvice = (maxPos.i < 0) ? '' : `➤ ${cols[maxPos.i]} vs ${cols[maxPos.j]}: ${advice(maxPos.r)}`;
            const negAdvice = (maxNeg.i < 0) ? '' : `➤ ${cols[maxNeg.i]} vs ${cols[maxNeg.j]}: ${advice(maxNeg.r)}`;
            return `📌 Özet (n=${n}, α=${alpha})\n- En güçlü pozitif ilişki: ${posTxt}\n- En güçlü negatif ilişki: ${negTxt}\n\n🔎 Anlamlı korelasyonlar:\n${sigTxt}\n\n🧠 Yorum & Öneri\n${posAdvice}\n${negAdvice}\n\n⚠️ Not: Korelasyon nedensellik değildir; ölçüm sistemi ve gizli değişkenleri kontrol edin.`;
        };

        const selected = data.matrixCols;
        if (selected.length < 2) { if(!readOnly) msg('En az 2 değişken seçin'); return; }

        const filteredRows = parsedData.rows.map(r => selected.map(c => r[c])).filter(row => row.every(isFinite));
        const cols = selected; const n = cols.length; const N = filteredRows.length;
        const ctx = matrixCanvasRef.current.getContext('2d')!;
        const W = matrixCanvasRef.current.clientWidth || 900, H = matrixCanvasRef.current.clientHeight || 640;
        matrixCanvasRef.current.width = W; matrixCanvasRef.current.height = H; ctx.clearRect(0, 0, W, H);

        const padL = 70, padB = 50;
        const cellW = (W - padL) / n;
        const cellH = (H - padB) / n;

        const ranges = cols.map((c, idx) => {
            const vals = filteredRows.map(row => row[idx]);
            const min = Math.min(...vals), max = Math.max(...vals);
            const p = (max - min) * 0.05 || 1;
            return { min: min - p, max: max + p };
        });

        const R = Array.from({ length: n }, () => Array(n).fill(1));
        const P = Array.from({ length: n }, () => Array(n).fill(0));
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            if (i === j) { R[i][j] = 1; P[i][j] = 0; continue; }
            const xi = filteredRows.map(r => r[i]), yj = filteredRows.map(r => r[j]);
            const r = corr(xi, yj);
            const df = N - 2; const t = r * Math.sqrt(df / Math.max(1e-12, 1 - r * r));
            const p = 2 * (1 - tCDF(Math.abs(t), df));
            R[i][j] = r; P[i][j] = p;
        }

        const { showMatrixTrend, showMatrixR, showMatrixHeat, alpha } = data;

        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const x0 = padL + c * cellW, y0 = r * cellH;
                ctx.fillStyle = showMatrixHeat ? heatColor(Math.abs(R[r][c])) : '#0b1224';
                ctx.fillRect(x0, y0, cellW, cellH);

                if (r === c) {
                    ctx.fillStyle = '#dbeafe'; ctx.font = 'bold 12px system-ui';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(cols[r], x0 + cellW / 2, y0 + cellH / 2);
                    ctx.strokeStyle = '#1f2b45'; ctx.strokeRect(x0, y0, cellW, cellH);
                    continue;
                }

                const rx = ranges[c], ry = ranges[r];
                const xs = filteredRows.map(row => row[c]), ys = filteredRows.map(row => row[r]);
                const toX = (v: number) => x0 + ((v - rx.min) / (rx.max - rx.min)) * cellW;
                const toY = (v: number) => y0 + cellH - ((v - ry.min) / (ry.max - ry.min)) * cellH;

                ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, cellW, cellH); ctx.clip();
                ctx.fillStyle = '#60a5fa';
                for (let k = 0; k < xs.length; k++) { ctx.beginPath(); ctx.arc(toX(xs[k]), toY(ys[k]), 2, 0, Math.PI * 2); ctx.fill(); }
                
                if (showMatrixTrend) {
                    const fit = ols(xs, ys);
                    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(toX(rx.min), toY(fit.b0 + fit.b1 * rx.min));
                    ctx.lineTo(toX(rx.max), toY(fit.b0 + fit.b1 * rx.max)); ctx.stroke();
                }

                if (showMatrixR) {
                    ctx.fillStyle = '#dbeafe'; ctx.font = '11px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
                    ctx.fillText('r=' + R[r][c].toFixed(2), x0 + cellW - 4, y0 + 4);
                }

                ctx.restore();
                ctx.strokeStyle = '#1f2b45'; ctx.strokeRect(x0, y0, cellW, cellH);
            }
            const ry = ranges[r]; drawYScale(ctx, padL - 6, r * cellH, cellH, ry.min, ry.max);
        }
        for (let c = 0; c < n; c++) { const rx = ranges[c]; drawXScale(ctx, padL + c * cellW, H - padB + 4, cellW, rx.min, rx.max); }
        ctx.fillStyle = '#cbd5e1'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
        for (let c = 0; c < n; c++) ctx.fillText(cols[c], padL + c * cellW + cellW / 2, H - 8);

        matrixSummaryRef.current.textContent = buildMatrixSummary(cols, R, P, N, alpha);
    }, [parsedData, data, msg, readOnly]);

    const drawSimple = useCallback(() => {
        if (!parsedData.rows.length) { if(!readOnly) msg('Önce CSV girin'); return; }
        if(!simpleCanvasRef.current || !simpleSummaryRef.current) return;
        
        const buildSimpleSummary = (xName: string, yName: string, s: ReturnType<typeof ols>) => {
            const dir = s.b1 > 0 ? 'pozitif (X artınca Y artma eğiliminde)' : s.b1 < 0 ? 'negatif (X artınca Y azalma eğiliminde)' : 'yok';
            const strength = Math.abs(s.r) >= 0.7 ? 'Güçlü' : Math.abs(s.r) >= 0.4 ? 'Orta' : Math.abs(s.r) >= 0.2 ? 'Zayıf' : 'Çok zayıf';
            const ptxt = s.p < 0.001 ? '<0.001' : s.p.toFixed(3);
            const advice = Math.abs(s.r) >= 0.7 ? `Kontrol planını ${xName} üzerinde yoğunlaştırın; limitleri belirleyip SPC ile izleyin.` :
                Math.abs(s.r) >= 0.4 ? `Örneklem büyüklüğünü artırın; DoE ile ${xName} seviyelerini test ederek ${yName} üzerindeki etkiyi doğrulayın.` :
                Math.abs(s.r) >= 0.2 ? `Segment (vardiya/makine/tedarikçi) bazlı analiz yapın; ilişki güçlenebilir.` :
                `İlişki zayıf; Pareto, 5N ve FTA ile alternatif nedenleri araştırın.`;
            return `📌 Basit Scatter Özeti (n=${s.n})\n- Regresyon: y = ${fmt(s.b0)} + ${fmt(s.b1)}·x\n- Korelasyon r = ${fmt(s.r)} (${strength}, yön: ${dir})\n- R² = ${fmt(s.R2)} · R²(adj) = ${fmt(s.R2adj)} · S = ${fmt(s.S)} · p = ${ptxt}\n\n🧠 Yorum & Öneri\n- ${advice}\n- CI/PI bantları istersen eklenebilir; CI ortalama yanıt, PI tek gözlem aralığıdır.`;
        };

        const { simpleX: xCol, simpleY: yCol, showSimpleTrend } = data;
        if (!xCol || !yCol || xCol === yCol) { if(!readOnly) msg('Farklı X ve Y seçin'); return; }
        const pts = parsedData.rows.map(r => ({ x: Number(r[xCol]), y: Number(r[yCol]) })).filter(p => isFinite(p.x) && isFinite(p.y));
        const ctx = simpleCanvasRef.current.getContext('2d')!;
        const W = simpleCanvasRef.current.clientWidth || 900, H = simpleCanvasRef.current.clientHeight || 420;
        simpleCanvasRef.current.width = W; simpleCanvasRef.current.height = H; ctx.clearRect(0, 0, W, H);

        const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
        const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
        const px = (maxX - minX) * 0.05 || 1, py = (maxY - minY) * 0.05 || 1;
        const rx = { min: minX - px, max: maxX + px }, ry = { min: minY - py, max: maxY + py };

        const padL = 70, padB = 50, padT = 14, padR = 14;
        const w = W - padL - padR, h = H - padT - padB;
        const toX = (v:number) => padL + ((v - rx.min) / (rx.max - rx.min)) * w;
        const toY = (v:number) => padT + h - ((v - ry.min) / (ry.max - ry.min)) * h;

        ctx.strokeStyle = '#1f2b45'; ctx.lineWidth = 1; ctx.strokeRect(padL, padT, w, h);
        for (let i = 0; i <= 3; i++) {
            const xv = rx.min + i * (rx.max - rx.min) / 3, yv = ry.min + i * (ry.max - ry.min) / 3;
            const x = toX(xv), y = toY(yv);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + w, y); ctx.stroke();
            ctx.fillStyle = '#9fb2d9'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(fmt(xv), x, padT + h + 12);
            ctx.textAlign = 'right'; ctx.fillText(fmt(yv), padL - 6, y + 3);
        }

        ctx.fillStyle = '#60a5fa'; pts.forEach(p => { ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), 3, 0, Math.PI * 2); ctx.fill(); });
        const fit = ols(pts.map(p => p.x), pts.map(p => p.y));
        if (showSimpleTrend) {
            ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(toX(rx.min), toY(fit.b0 + fit.b1 * rx.min));
            ctx.lineTo(toX(rx.max), toY(fit.b0 + fit.b1 * rx.max)); ctx.stroke();
        }

        ctx.fillStyle = '#cbd5e1'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(xCol, padL + w / 2, H - 6);
        ctx.save(); ctx.translate(12, padT + h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yCol, 0, 0); ctx.restore();

        simpleSummaryRef.current.textContent = buildSimpleSummary(xCol, yCol, fit);
    }, [parsedData, data, msg, readOnly]);

    useEffect(() => {
        // Delay drawing to ensure canvas is in the DOM and has dimensions
        const timeoutId = setTimeout(() => {
            if (currentView === 'matrix') {
                drawMatrix();
            } else {
                drawSimple();
            }
        }, 100);
        return () => clearTimeout(timeoutId);
    }, [currentView, drawMatrix, drawSimple]);
    
    const handleSampleClick = () => {
        onChange({ ...data, inputData: `PIQ,Brain,Height,Weight\n96,90,70,150\n114,96,74,160\n101,90,68,135\n110,88,73,155\n120,98,72,165\n88,85,66,120\n130,105,76,175\n94,92,69,140\n118,99,71,168\n102,91,70,145\n108,94,72,152\n95,86,68,132\n121,100,74,170\n112,97,73,158\n100,89,69,142` });
    }
    
    const handlePngDownload = () => {
        const canvas = currentView === 'matrix' ? matrixCanvasRef.current : simpleCanvasRef.current;
        if (canvas) {
            const a = document.createElement('a');
            a.download = currentView === 'matrix' ? 'scatter_matrix.png' : 'scatter.png';
            a.href = canvas.toDataURL('image/png');
            a.click();
        }
    }

    return (
        <div className="spm-wrap">
            {!readOnly && (
                <div className="spm-tabs">
                    {showTabs && (
                        <>
                            <button className={`spm-tab ${activeTab === 'matrix' ? 'act' : ''}`} onClick={() => setActiveTab('matrix')}>İlişki Matrisi</button>
                            <button className={`spm-tab ${activeTab === 'simple' ? 'act' : ''}`} onClick={() => setActiveTab('simple')}>Basit Scatter</button>
                        </>
                    )}
                    <div style={{ flex: 1 }}></div>
                    <button className="btn" onClick={handlePngDownload}>PNG İndir</button>
                </div>
            )}

            <div className={`spm-grid ${readOnly ? '!grid-cols-1' : ''}`}>
                {!readOnly && (
                    <div className="spm-card">
                        <h4>Veri Girişi (CSV – ilk satır başlık)</h4>
                        <div className="spm-row"><textarea value={data.inputData} onChange={e => onChange({...data, inputData: e.target.value})} rows={10} placeholder={"Başlıklı CSV yapıştırın. Örnek:\nDeğişken1,Değişken2\n10,25\n12,30\n..."}></textarea></div>
                        <div className="spm-row"><button className="btn" onClick={handleSampleClick}>Örnek Veri</button><span ref={msgRef} className="note"></span></div>

                        <div style={{ display: currentView === 'matrix' ? 'block' : 'none' }}>
                            <h4>Ayarlar (Matrix)</h4>
                            <div className="spm-row"><label style={{ width: '120px' }}>Değişkenler</label><select value={data.matrixCols} onChange={e => onChange({...data, matrixCols: Array.from(e.target.selectedOptions, (o: HTMLOptionElement) => o.value)})} className="sel" multiple size={7} title="Ctrl/Shift ile çoklu seçin">
                                {parsedData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select></div>
                            <div className="spm-row spm-chk"><input type="checkbox" checked={data.showMatrixTrend} onChange={e => onChange({...data, showMatrixTrend: e.target.checked})} id="opt-trend" /><label htmlFor="opt-trend" className="note">Trend çizgisi (OLS)</label></div>
                            <div className="spm-row spm-chk"><input type="checkbox" checked={data.showMatrixR} onChange={e => onChange({...data, showMatrixR: e.target.checked})} id="opt-r" /><label htmlFor="opt-r" className="note">Köşede r (Pearson)</label></div>
                            <div className="spm-row spm-chk"><input type="checkbox" checked={data.showMatrixHeat} onChange={e => onChange({...data, showMatrixHeat: e.target.checked})} id="opt-heat" /><label htmlFor="opt-heat" className="note">Arka planı r-ısı haritası</label></div>
                            <div className="spm-row"><label style={{ width: '120px' }}>α (anlamlılık)</label><input value={data.alpha} onChange={e => onChange({...data, alpha: Number(e.target.value)})} className="inp" type="number" min="0.001" max="0.2" step="0.001" /></div>
                            <div className="spm-row"><button className="btn" onClick={drawMatrix}>Matrisi Çiz</button></div>
                        </div>

                        <div style={{ display: currentView === 'simple' ? 'block' : 'none' }}>
                            <h4>Ayarlar (Basit Scatter)</h4>
                            <div className="spm-row"><label style={{ width: '120px' }}>X</label><select value={data.simpleX} onChange={e => onChange({...data, simpleX: e.target.value})} className="sel">
                                {parsedData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select></div>
                            <div className="spm-row"><label style={{ width: '120px' }}>Y</label><select value={data.simpleY} onChange={e => onChange({...data, simpleY: e.target.value})} className="sel">
                                {parsedData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select></div>
                            <div className="spm-row spm-chk"><input type="checkbox" checked={data.showSimpleTrend} onChange={e => onChange({...data, showSimpleTrend: e.target.checked})} id="opt-s-trend" /><label htmlFor="opt-s-trend" className="note">Trend çizgisi (OLS)</label></div>
                            <div className="spm-row"><button className="btn" onClick={drawSimple}>Grafiği Çiz</button></div>
                        </div>
                    </div>
                )}

                <div className="spm-card">
                    <h4>Grafik</h4>
                    <canvas ref={matrixCanvasRef} style={{ display: currentView === 'matrix' ? 'block' : 'none' }}></canvas>
                    <div ref={matrixSummaryRef} className="spm-insight" style={{ display: currentView === 'matrix' ? 'block' : 'none' }}></div>
                    
                    <canvas ref={simpleCanvasRef} className="spm-simple-canvas" style={{ display: currentView === 'simple' ? 'block' : 'none' }}></canvas>
                    <div ref={simpleSummaryRef} className="spm-insight" style={{ display: currentView === 'simple' ? 'block' : 'none' }}></div>
                </div>
            </div>
        </div>
    );
};

export default ScatterPlotMatrix;