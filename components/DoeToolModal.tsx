import React, { useEffect } from 'react';
import Modal from './Modal';

interface DoeToolModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DoeToolModal: React.FC<DoeToolModalProps> = ({ isOpen, onClose }) => {
    
    useEffect(() => {
        if (!isOpen) return;

        // The script is self-contained and attaches its own event listeners.
        (function(){
            // ---------- Shortcuts & State ----------
            const $ = (sel: string, root: ParentNode | null = document) => root?.querySelector(sel);
            const $$ = (sel: string, root: ParentNode | null = document) => Array.from(root?.querySelectorAll(sel) || []);
            const uid=()=> 'id'+Math.random().toString(36).slice(2,9);
            const state: { factors: any[], runs: any[], yName: string, goal: string, target: number, rep: number, fraction: number, randomized: boolean, data: any, aliases: string[] } = {factors:[],runs:[],yName:'Y',goal:'max',target:0,rep:2,fraction:1,randomized:true,data:{},aliases:[]};

            const modalRoot = document.querySelector('.doe-tool-container');
            if (!modalRoot) return;

            // ---------- UI Builders ----------
            function addFactorRow(init={name:'F1',low:0,high:1,unit:'',include:true}){
                const tbody=$('#factorTable tbody', modalRoot); if (!tbody) return; const id=uid(); const idx=tbody.children.length+1; const tr=document.createElement('tr'); tr.dataset.id=id;
                // FIX: Explicitly convert numbers to strings for innerHTML.
                tr.innerHTML=`
                <td>${String(idx)}</td>
                <td><input value="${init.name||''}" placeholder="F${idx}" class="f-name"/></td>
                <td><input type="number" step="any" value="${String(init.low??0)}" class="f-low"/></td>
                <td><input type="number" step="any" value="${String(init.high??1)}" class="f-high"/></td>
                <td><input value="${init.unit||''}" class="f-unit" placeholder="°C, bar..."/></td>
                <td><input type="checkbox" class="f-include" ${init.include!==false?'checked':''}/></td>
                <td><button class="danger del">Sil</button></td>`;
                tbody.appendChild(tr); (tr.querySelector('.del') as HTMLElement).onclick=()=>{ tr.remove(); renumber(); }; renumber();
            }
            function renumber(){ $$('#factorTable tbody tr', modalRoot).forEach((tr,i)=> (tr.firstElementChild as HTMLElement).textContent=String(i+1)); }
            function readFactors(){ const rows=$$('#factorTable tbody tr', modalRoot); const out: any[] = []; for(const tr of rows){ const name=(tr.querySelector('.f-name') as HTMLInputElement).value.trim()||(tr.querySelector('.f-name') as HTMLInputElement).placeholder; const low=parseFloat((tr.querySelector('.f-low') as HTMLInputElement).value); const high=parseFloat((tr.querySelector('.f-high') as HTMLInputElement).value); const unit=(tr.querySelector('.f-unit') as HTMLInputElement).value.trim(); const include=(tr.querySelector('.f-include') as HTMLInputElement).checked; if(include) out.push({id:(tr as HTMLElement).dataset.id,name,low,high,unit,include}); } return out; }

            // ---------- Design Generation ----------
            function buildDesign(){
                state.yName=($('#yName', modalRoot) as HTMLInputElement).value.trim()||'Y'; state.goal=($('#goal', modalRoot) as HTMLSelectElement).value; state.target=parseFloat(($('#target', modalRoot) as HTMLInputElement).value||'0'); state.rep=Math.max(1,parseInt(($('#rep', modalRoot) as HTMLInputElement).value||'1')); state.fraction=parseInt(($('#fraction', modalRoot) as HTMLSelectElement).value||'1'); state.randomized=($('#randomize', modalRoot) as HTMLInputElement).checked; state.factors=readFactors(); if(state.factors.length===0){ alert('En az 1 faktör seçin.'); return; }
                const k=state.factors.length; const baseRuns=1<<k; const frac=Math.max(1,state.fraction); const size=Math.max(1,Math.floor(baseRuns/frac));
                const coded: any[] =[]; for(let i=0;i<baseRuns;i++){ const row: Record<string, number>={}; state.factors.forEach((f,idx)=>{ row[f.name]=((i>>idx)&1)?+1:-1;}); coded.push(row);}    
                let design=coded.slice(0,size); state.aliases = frac>1 ? [`Uyarı: ${frac}-fraksiyon seçildi (yaklaşık). Bazı etkileşimler alias olabilir.`] : [];
                let runs: any[] =[]; for(const row of design){ for(let r=0;r<state.rep;r++){ const combo: Record<string, number>={}; for(const f of state.factors){ combo[f.name]= (row[f.name]===-1?f.low:f.high); } runs.push({id:uid(), combo, replicateIndex:r}); }}
                if(state.randomized){ runs = runs.sort(()=>Math.random()-0.5); }
                state.runs=runs; state.data={}; renderRunsTable();
            }
            function codeFromValue(v: number,low: number,high: number){ return (Math.abs(v-high)<Math.abs(v-low))?+1:-1; }
            function renderRunsTable(){ const t=$('#runTable', modalRoot); if(!t) return; const fns=state.factors.map(f=>f.name); const head=`<thead><tr><th>#</th>${fns.map(n=>`<th>${n}</th>`).join('')}<th>${state.yName}</th></tr></thead>`; const body=state.runs.map((r,i)=>{ const cells=fns.map(n=>`<td>${r.combo[n]}</td>`).join(''); const yid=`y_${r.id}`; return `<tr><td>${i+1}</td>${cells}<td><input type="number" step="any" id="${yid}" placeholder="Y"/></td></tr>`; }).join(''); t.innerHTML=head+`<tbody>${body}</tbody>`; ($('#runCount', modalRoot) as HTMLElement).textContent=`${state.runs.length} koşul`; }
            function fmt(v: number){ return Number.isFinite(v)?(Math.abs(v)>9999? v.toExponential(2): v.toFixed(2)): String(v); }

            // ---------- Analysis & Charts ----------
            function analyze(){
                const Y: number[]=[], X: number[][]=[]; const fn=state.factors.map(f=>f.name);
                for(const run of state.runs){ const el=$('#y_'+run.id, modalRoot) as HTMLInputElement; const y=parseFloat(el?el.value:NaN); if(Number.isFinite(y)){ const coded=fn.map(n=> codeFromValue(run.combo[n], state.factors.find(f=>f.name===n).low, state.factors.find(f=>f.name===n).high)); X.push([1, ...coded, ...twoWay(coded)]); Y.push(y);} }
                if(Y.length < (fn.length + 2)) { alert('Analiz için daha fazla ölçüm girin. En az ' + (fn.length + 2) + ' ölçüm gerekli.'); return; }
                const terms=['(Intercept)', ...fn, ...pairs(fn)];
                const Xt=transpose(X), XtX=matMul(Xt,X), XtY=matVec(Xt,Y), inv=invMat(XtX), beta=matVec(inv,XtY);
                const Yhat=X.map(r=>dot(r,beta)); const resid=Y.map((y,i)=> y-Yhat[i]); const sse=resid.reduce((a,b)=>a+b*b,0); const dof=Math.max(1, Y.length-terms.length); const mse=sse/dof; const seBeta=diagDiag(inv).map(v=>Math.sqrt(Math.max(0,mse*v))); const tstats=beta.map((b,i)=> seBeta[i]>0? b/seBeta[i]:0);
                const effects=terms.map((t,i)=>({term:t, beta:beta[i], effect:i===0?0:2*beta[i], t:tstats[i]}));
                drawMainEffects(fn,beta); drawInteraction(fn,beta,terms); drawParetoMinitab(effects,tstats,dof); drawResiduals(Y,Yhat,resid); renderOptimizer(fn,beta); renderInsights(effects,fn,beta,mse,dof); setComments(effects,fn,beta,mse,dof);
            }

            function pairs(arr: string[]){ const out=[]; for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++) out.push(arr[i]+'×'+arr[j]); return out; }
            function twoWay(c: number[]){ const out=[]; for(let i=0;i<c.length;i++) for(let j=i+1;j<c.length;j++) out.push(c[i]*c[j]); return out; }

            // ---- Canvas helpers ----
            function clearCanvas(ctx: CanvasRenderingContext2D){ ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height); }
            function axis(ctx: CanvasRenderingContext2D,x0:number,y0:number,x1:number,y1:number){ ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=1; ctx.stroke(); }
            function text(ctx: CanvasRenderingContext2D,s:string,x:number,y:number,align='left'){ ctx.fillStyle='#c7d3ee'; ctx.font='12px ui-sans-serif'; ctx.textAlign=align as CanvasTextAlign; ctx.fillText(s,x,y); }
            function line(ctx: CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number,w=2,col='#7aa2ff'){ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.strokeStyle=col; ctx.lineWidth=w; ctx.stroke(); }
            function bar(ctx: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,col='#7aa2ff'){ ctx.fillStyle=col; ctx.fillRect(x,y,w,h); }

            function drawMainEffects(fn: string[],beta: number[]){ const cvs=$('#mainEffects', modalRoot) as HTMLCanvasElement; if(!cvs) return; const ctx=cvs.getContext('2d')!; clearCanvas(ctx); const W=cvs.width,H=cvs.height,pad=40,innerW=W-2*pad,innerH=H-2*pad; axis(ctx,pad,H-pad,W-pad,H-pad); axis(ctx,pad,pad,pad,H-pad); const b0=beta[0]; const lows=fn.map((n,i)=> b0-Math.abs(beta[1+i])); const highs=fn.map((n,i)=> b0+Math.abs(beta[1+i])); const ymin=Math.min(...lows,...highs), ymax=Math.max(...lows,...highs); const sx=(i:number,o:number)=> pad+i*(innerW/fn.length)+(o||0); const sy=(v:number)=> H-pad - ((v-ymin)/(ymax-ymin+1e-9))*innerH; for(let i=0;i<fn.length;i++){ const x1=sx(i,20), x2=sx(i,100), y1=sy(lows[i]), y2=sy(highs[i]); line(ctx,x1,y1,x2,y2,3,'#7aa2ff'); text(ctx,fn[i],(x1+x2)/2,H-10,'center'); } ($('#mainEffectsBadge', modalRoot) as HTMLElement).textContent=`${fn.length} faktör`; }

            function drawInteraction(fn:string[],beta:number[],terms:string[]){ const cvs=$('#interaction', modalRoot) as HTMLCanvasElement;  if(!cvs) return; const ctx=cvs.getContext('2d')!; clearCanvas(ctx); const W=cvs.width,H=cvs.height,pad=40,innerW=W-2*pad,innerH=H-2*pad; axis(ctx,pad,H-pad,W-pad,H-pad); axis(ctx,pad,pad,pad,H-pad); if(fn.length<2){ text(ctx,'En az 2 faktör gerekli',W/2,H/2,'center'); ($('#interactionBadge', modalRoot) as HTMLElement).textContent='-'; return; } const b0=beta[0], bA=beta[1], bB=beta[2]; const pair=fn[0]+'×'+fn[1]; const idx=terms.indexOf(pair); const bAB=idx>=0?beta[idx]:0; const xs=[-1,+1]; const yhat=(a:number,b:number)=> b0+bA*a+bB*b+(bAB?bAB*a*b:0); const curves=[{label:`${fn[1]} = -1`,vals:xs.map(x=>yhat(x,-1))},{label:`${fn[1]} = +1`,vals:xs.map(x=>yhat(x,+1))}]; const all=curves.flatMap(c=>c.vals); const ymin=Math.min(...all), ymax=Math.max(...all); const sX=(i:number)=> pad+((xs[i]+1)/2)*innerW; const sY=(v:number)=> H-pad - ((v-ymin)/(ymax-ymin+1e-9))*innerH; curves.forEach((c,ci)=>{ line(ctx,sX(0),sY(c.vals[0]), sX(1),sY(c.vals[1]),3, ci?'#9bffb7':'#7aa2ff'); text(ctx,c.label,W-10,sY(c.vals[1])-8,'right'); }); text(ctx, fn[0]+' (-1 → +1)', W/2, H-12, 'center'); ($('#interactionBadge', modalRoot) as HTMLElement).textContent=(idx<0||Math.abs(bAB||0)<1e-9)?'Etkileşim zayıf/hesaplanamadı':'Etkileşim var'; }

            function drawParetoMinitab(effects: any[],tstats: number[],dof: number){
                const cvs=$('#pareto', modalRoot) as HTMLCanvasElement; if(!cvs) return; const ctx=cvs.getContext('2d')!; clearCanvas(ctx);
                const W=cvs.width,H=cvs.height,padL=40,padR=60,padT=20,padB=40,innerW=W-padL-padR,innerH=H-padT-padB;
                axis(ctx,padL,H-padB,W-padR,H-padB); axis(ctx,padL,padT,padL,H-padB);
                const data=effects.map((e,i)=>({term:e.term,val:Math.abs(e.term==='(Intercept)'?0:tstats[i]||0)})).filter(o=>o.term!=='(Intercept)');
                data.sort((a,b)=>b.val-a.val);
                const tcrit=approxTCrit(dof);
                const maxValData=Math.max(1e-9,...data.map(d=>d.val));
                const scaleMax=Math.max(maxValData, tcrit*1.05);
                const bw=innerW/Math.max(1,data.length);
                data.forEach((d,i)=>{ const h=(d.val/scaleMax)*innerH; bar(ctx,padL+i*bw+6, H-padB-h, bw-12, h, '#7aa2ff'); text(ctx, d.term.replace('×','·'), padL+i*bw+bw/2, H-10, 'center'); });
                const yCrit=padT + (1-(tcrit/scaleMax))*innerH;
                ctx.strokeStyle='#ff6b6b'; ctx.lineWidth=2; ctx.setLineDash([6,4]);
                ctx.beginPath(); ctx.moveTo(padL,yCrit); ctx.lineTo(W-padR,yCrit); ctx.stroke(); ctx.setLineDash([]);
                line(ctx, padL-4, yCrit, padL, yCrit, 2, '#ff6b6b');
                text(ctx, `t*=${tcrit.toFixed(3)}`, W-padR-4, yCrit-6, 'right');
                ($('#paretoBadge', modalRoot) as HTMLElement).textContent=`${data.length} terim`;
                const pc=$('#paretoComment', modalRoot);
                if(pc){ pc.innerHTML = `Pareto: Çubuklar <b>|t|</b> (standart etki) ile sıralıdır. Kırmızı kesikli çizgi kritik değer <b>t* ≈ ${tcrit.toFixed(3)}</b> (α≈0.05, iki yönlü). Çubuklar çizginin <b>üstüne</b> çıkarsa etki istatistiksel olarak anlamlı kabul edilebilir.`; }
            }

            function drawResiduals(Y:number[],Yhat:number[],resid:number[]){ const n=Y.length; if(n===0) return; const cvsQQ=$('#residQQ', modalRoot) as HTMLCanvasElement,ctxQQ=cvsQQ?.getContext('2d'); if(!ctxQQ) return; const W=cvsQQ.width,H=cvsQQ.height,pad=40,innerW=W-2*pad,innerH=H-2*pad; clearCanvas(ctxQQ); axis(ctxQQ,pad,H-pad,W-pad,H-pad); axis(ctxQQ,pad,pad,pad,H-pad); const rSorted=[...resid].sort((a,b)=>a-b); const exp:number[]=[]; for(let i=1;i<=n;i++){ exp.push(normInv((i-0.5)/n)); } const minX=Math.min(...exp), maxX=Math.max(...exp), minY=Math.min(...rSorted), maxY=Math.max(...rSorted); const sx=(x:number)=> pad+((x-minX)/(maxX-minX+1e-9))*innerW; const sy=(y:number)=> H-pad-((y-minY)/(maxY-minY+1e-9))*innerH; line(ctxQQ,sx(minX),sy(minY),sx(maxX),sy(maxY),1,'rgba(255,255,255,.5)'); rSorted.forEach((r,i)=>{ ctxQQ.beginPath(); ctxQQ.arc(sx(exp[i]),sy(r),3,0,Math.PI*2); ctxQQ.fillStyle='#7aa2ff'; ctxQQ.fill(); }); text(ctxQQ,'Normal QQ', W/2, pad-8,'center'); const cvsVF=$('#residVsFit', modalRoot) as HTMLCanvasElement,ctxVF=cvsVF?.getContext('2d'); if(!ctxVF) return; clearCanvas(ctxVF); const W2=cvsVF.width,H2=cvsVF.height,pad2=40,innerW2=W2-2*pad2,innerH2=H2-2*pad2; axis(ctxVF,pad2,H2-pad2,W2-pad2,H2-pad2); axis(ctxVF,pad2,pad2,pad2,H2-pad2); const minF=Math.min(...Yhat), maxF=Math.max(...Yhat), minR=Math.min(...resid), maxR=Math.max(...resid); const sxf=(x:number)=> pad2+((x-minF)/(maxF-minF+1e-9))*innerW2; const syr=(y:number)=> H2-pad2-((y-minR)/(maxR-minR+1e-9))*innerH2; line(ctxVF,pad2,syr(0),W2-pad2,syr(0),1,'rgba(255,255,255,.5)'); for(let i=0;i<n;i++){ ctxVF.beginPath(); ctxVF.arc(sxf(Yhat[i]),syr(resid[i]),3,0,Math.PI*2); ctxVF.fillStyle='#7aa2ff'; ctxVF.fill(); } text(ctxVF,'Residuals vs Fits', W2/2, pad2-8,'center'); const cvsH=$('#residHist', modalRoot) as HTMLCanvasElement,ctxH=cvsH?.getContext('2d'); if(!ctxH) return; clearCanvas(ctxH); const W3=cvsH.width,H3=cvsH.height,pad3=40,innerW3=W3-2*pad3,innerH3=H3-2*pad3; axis(ctxH,pad3,H3-pad3,W3-pad3,H3-pad3); axis(ctxH,pad3,pad3,pad3,H3-pad3); const bins=Math.max(5,Math.round(Math.sqrt(n))); const bw=(maxR-minR+1e-9)/bins; const hist=new Array(bins).fill(0); resid.forEach(r=>{ const idx=Math.min(bins-1, Math.max(0, Math.floor((r-minR)/bw))); hist[idx]++; }); const maxCount=Math.max(...hist,1); for(let i=0;i<bins;i++){ const x=pad3+(i/bins)*innerW3+4; const w=innerW3/bins-8; const h=(hist[i]/maxCount)*innerH3; ctxH.fillStyle='#7aa2ff'; ctxH.fillRect(x,H3-pad3-h,w,h);} text(ctxH,'Histogram (Residuals)', W3/2, pad3-8,'center'); const cvsO=$('#residOrder', modalRoot) as HTMLCanvasElement,ctxO=cvsO?.getContext('2d'); if(!ctxO) return; clearCanvas(ctxO); const W4=cvsO.width,H4=cvsO.height,pad4=40,innerW4=W4-2*pad4,innerH4=H4-2*pad4; axis(ctxO,pad4,H4-pad4,W4-pad4,H4-pad4); axis(ctxO,pad4,pad4,pad4,H4-pad4); const sxo=(i:number)=> pad4+(i/(n-1))*innerW4; const syo=(y:number)=> H4-pad4-((y-minR)/(maxR-minR+1e-9))*innerH4; for(let i=0;i<n;i++){ if(i>0) line(ctxO,sxo(i-1),syo(resid[i-1]), sxo(i),syo(resid[i]),2,'#7aa2ff'); ctxO.beginPath(); ctxO.arc(sxo(i),syo(resid[i]),3,0,Math.PI*2); ctxO.fillStyle='#7aa2ff'; ctxO.fill(); } text(ctxO,'Residuals vs Order', W4/2, pad4-8,'center'); ($('#residBadge', modalRoot) as HTMLElement).textContent=`${n} gözlem`; const flagTrend=Math.abs(resid.slice(0,Math.floor(n/2)).reduce((a,b)=>a+b,0) - resid.slice(Math.floor(n/2)).reduce((a,b)=>a+b,0)) > 0.5*Math.max(1e-9, maxR-minR); ($('#residComment', modalRoot) as HTMLElement).innerHTML=`<b>Residuals yorumu</b><br/>• <b>QQ Plot</b>: Noktalar referans çizgisine yakınsa <i>normallik</i> varsayımı makul.<br/>• <b>Residuals vs Fits</b>: Sıfır çevresinde rastgele saçılım <i>sabit varyans</i> demektir; huni/desen varsa varyans değişiyor olabilir.<br/>• <b>Histogram</b>: Yaklaşık simetrik/tek tepe beklenir; kuyruk/asimetri sapma gösterebilir.<br/>• <b>Order</b>: Zaman sırasına göre belirgin trend ${(flagTrend?' <span class="warning">gözleniyor</span>':'gözlenmiyor')} ise <i>bağımsızlık</i> varsayımı makuldur.`; }

            // ---------- Optimizer & Insights ----------
            function renderOptimizer(fn:string[],beta:number[]){ const goal=state.goal; const out: any[]=[]; fn.forEach((name,i)=>{ const b=beta[1+i]; const f=state.factors.find(ff=>ff.name===name); let rec,why; if(goal==='max'){ rec=b>=0?f.high:f.low; why=`Etki işareti ${b>=0?'+':'-'} → ${b>=0?'yüksek':'düşük'} seviye`; } else if(goal==='min'){ rec=b>=0?f.low:f.high; why=`Etki işareti ${b>=0?'+':'-'} → ${b>=0?'düşük':'yüksek'} seviye`; } else { rec=(f.low+f.high)/2; why='Hedefleme: orta seviye'; } out.push({name,unit:f.unit||'',recommend:rec,rationale:why}); }); ($('#optTableWrap', modalRoot) as HTMLElement).innerHTML=`<table><thead><tr><th>Faktör</th><th>Öneri</th><th>Açıklama</th></tr></thead><tbody>${out.map(o=>`<tr><td>${o.name} ${o.unit?'<span class="muted">('+o.unit+')</span>':''}</td><td><b>${fmt(o.recommend)}</b></td><td class="muted">${o.rationale}</td></tr>`).join('')}</tbody></table>`; ($('#optBadge', modalRoot) as HTMLElement).textContent = `${goal==='max'?'Maksimizasyon':goal==='min'?'Minimizasyon':'Hedefleme'}`; }
            function renderInsights(effects: any[],fn:string[],beta:number[],mse:number,dof:number){ const info=[]; const nonI=effects.filter(e=>e.term!=='(Intercept)'); nonI.sort((a,b)=> Math.abs(b.effect)-Math.abs(a.effect)); if(nonI.length){ const top=nonI[0]; info.push(`<div><b>En büyük etki:</b> <span class="success">${top.term.replace('×','·')}</span> (|etki|=${fmt(Math.abs(top.effect))})</div>`);} if(fn.length>=2){ const pairName=fn[0]+'×'+fn[1]; const terms=['(Intercept)', ...fn, ...pairs(fn)]; const idx12=terms.indexOf(pairName); const b12=idx12>=0? beta[idx12]:0; info.push(`<div><b>Etkileşim (ilk iki faktör):</b> ${Math.abs(b12)<1e-9? '<span class="muted">zayıf</span>':'<span class="warning">belirgin</span>'}</div>`);} info.push(`<div><b>MSE:</b> ${fmt(mse)} <span class="muted">(dof=${dof})</span></div>`); if(state.aliases.length) info.push(`<div class="warning">${state.aliases[0]}</div>`); if(state.goal==='max') info.push(`<div>Hedef <b>maksimizasyon</b>. Pozitif ana etkiler için <b>yüksek seviye</b> önerilir.</div>`); if(state.goal==='min') info.push(`<div>Hedef <b>minimizasyon</b>. Pozitif ana etkiler için <b>düşük seviye</b> önerilir.</div>`); if(state.goal==='target') info.push(`<div>Hedef <b>${fmt(state.target)}</b> civarı. Güçlü etkiler varsa orta seviye ve etkileşim kontrolü önerilir.</div>`); ($('#insights', modalRoot) as HTMLElement).innerHTML=info.map(s=>`<div class="badge" style="white-space:nowrap">•</div><div>${s}</div>`).join(''); }

            function setComments(effects:any[],fn:string[],beta:number[],mse:number,dof:number){ const nonI=effects.filter(e=>e.term!=='(Intercept)'); const mains=nonI.filter(e=>!e.term.includes('×')).sort((a,b)=> Math.abs(b.effect)-Math.abs(a.effect)); const topMain=mains[0]; const me=$('#mainEffectsComment', modalRoot); if(me){ if(topMain){ const dir=topMain.beta>=0?'pozitif (yüksek seviye ↑ Y)':'negatif (yüksek seviye ↓ Y)'; me.innerHTML=`Ana Etkiler: En büyük ana etki <b>${topMain.term.replace('×','·')}</b> (|etki|=${fmt(Math.abs(topMain.effect))}).<br/>Eğim ${dir}. Çizgilerin dikliği etkinin büyüklüğünü gösterir.`; } else { me.textContent='Ana Etkiler: Yorum için yeterli veri yok.'; } } let b12=0; if(fn.length>=2){ const terms=['(Intercept)', ...fn, ...pairs(fn)]; const idx12=terms.indexOf(fn[0]+'×'+fn[1]); b12=idx12>=0? beta[idx12]:0; } const it=$('#interactionComment', modalRoot); if(it){ const msg=(fn.length<2||Math.abs(b12)<1e-9)?'Interaction: İlk iki faktör arasında belirgin etkileşim görünmüyor (çizgiler ≈ paralel).':'Interaction: İlk iki faktör arasında etkileşim var (çizgiler paralel değil).'; it.innerHTML= msg + ' <br/><b>Yorum:</b> Paralel olmayan çizgiler, bir faktörün etkisinin diğerinin seviyesine bağlı olarak değiştiğini (etkileşim) gösterir.'; } const ef=nonI.slice().sort((a:any,b:any)=> Math.abs(b.effect)-Math.abs(a.effect)); const pc=$('#paretoComment', modalRoot); if(pc){ const names=ef.slice(0,3).map((e:any)=>e.term.replace('×','·')).join(', '); const tcrit=approxTCrit(dof); pc.innerHTML= ef.length? `Pareto: Çubuklar <b>|t|</b> (standart etki) ile sıralıdır.<br/>Kırmızı çizgi kritik değer <b>t* ≈ ${tcrit.toFixed(3)}</b> (α≈0.05, iki yönlü).<br/>Çizginin <b>üstündeki</b> terimler istatistiksel olarak anlamlı olabilir.<br/>Baskın terimler: ${names}.` : 'Pareto: Yorum için yeterli veri yok.'; } }

            // ---- LA Helpers ----
            function transpose(A: number[][]){ const m=A.length,n=A[0].length,T=Array.from({length:n},()=>Array(m)); for(let i=0;i<m;i++) for(let j=0;j<n;j++) T[j][i]=A[i][j]; return T; }
            function matMul(A:number[][],B:number[][]){ const m=A.length,n=B[0].length,p=B.length; const C=Array.from({length:m},()=>Array(n).fill(0)); for(let i=0;i<m;i++) for(let k=0;k<p;k++) for(let j=0;j<n;j++) C[i][j]+=A[i][k]*B[k][j]; return C; }
            function matVec(A:number[][],v:number[]){ const m=A.length,n=A[0].length; const r=Array(m).fill(0); for(let i=0;i<m;i++){ let s=0; for(let j=0;j<n;j++) s+=A[i][j]*v[j]; r[i]=s; } return r; }
            function dot(a:number[],b:number[]){ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; }
            function invMat(A:number[][]){ const n=A.length; const M=A.map(r=>r.slice()); const I=Array.from({length:n},(_,i)=>Array.from({length:n},(__,j)=> i===j?1:0)); for(let i=0;i<n;i++){ let piv=i; for(let r=i+1;r<n;r++) if(Math.abs(M[r][i])>Math.abs(M[piv][i])) piv=r; if(Math.abs(M[piv][i])<1e-12) return I; if(piv!==i){ [M[i],M[piv]]=[M[piv],M[i]]; [I[i],I[piv]]=[I[piv],I[i]]; } const d=M[i][i]; for(let j=0;j<n;j++){ M[i][j]/=d; I[i][j]/=d; } for(let r=0;r<n;r++) if(r!==i){ const f=M[r][i]; for(let j=0;j<n;j++){ M[r][j]-=f*M[i][j]; I[r][j]-=f*I[i][j]; } } } return I; }
            function diagDiag(A:number[][]){ return A.map((row,i)=> Math.abs(row[i])); }

            // ---------- Events & Tests ----------
            ($('#addFactor', modalRoot) as HTMLElement).onclick=()=> addFactorRow({name:`F${$$('#factorTable tbody tr', modalRoot).length+1}`,low:0,high:1,unit:'',include:true});
            ($('#buildDesign', modalRoot) as HTMLElement).onclick=buildDesign; ($('#analyze', modalRoot) as HTMLElement).onclick=analyze; ($('#clearY', modalRoot) as HTMLElement).onclick=()=>{ state.runs.forEach(r=>{ const el=$('#y_'+r.id, modalRoot) as HTMLInputElement; if(el) el.value=''; }); };
            ($('#fillDemo', modalRoot) as HTMLElement).onclick=()=>{ const fn=state.factors.map(f=>f.name); if(fn.length===0){ alert('Önce tasarımı oluşturun.'); return; } const idxA=0, idxB=1; state.runs.forEach(r=>{ const a=codeFromValue(r.combo[fn[idxA]], state.factors[idxA].low, state.factors[idxA].high); const b=fn[idxB]? codeFromValue(r.combo[fn[idxB]], state.factors[idxB].low, state.factors[idxB].high):0; const y= 50 + 5*a + 8*b - 6*a*b + (Math.random()-0.5)*2; const el=$('#y_'+r.id, modalRoot) as HTMLInputElement; if(el) el.value=y.toFixed(2); }); };
            // FIX: Add missing `include` property to object literals.
            ($('#quickTest', modalRoot) as HTMLElement).onclick=()=>{ if(state.factors.length===0){ addFactorRow({name:'Sıcaklık',low:120,high:150,unit:'°C', include: true}); addFactorRow({name:'Basınç',low:50,high:100,unit:'bar', include: true});} buildDesign(); ($('#fillDemo', modalRoot) as HTMLElement).click(); ($('#analyze', modalRoot) as HTMLElement).click(); };
            // FIX: Add missing `include` property to object literal.
            ($('#test1F', modalRoot) as HTMLElement).onclick=()=>{ ($('#factorTable tbody', modalRoot) as HTMLElement).innerHTML=''; addFactorRow({name:'Pad',low:0,high:1,unit:'', include: true}); buildDesign(); state.runs.forEach(r=>{ const a=codeFromValue(r.combo['Pad'],0,1); const el=$('#y_'+r.id, modalRoot) as HTMLInputElement; if(el) el.value=(10+3*a+(Math.random()-0.5)*0.4).toFixed(2); }); ($('#analyze', modalRoot) as HTMLElement).click(); };
            // FIX: Add missing `include` property to object literals.
            ($('#test3F', modalRoot) as HTMLElement).onclick=()=>{ ($('#factorTable tbody', modalRoot) as HTMLElement).innerHTML=''; addFactorRow({name:'Pad',low:0,high:1,unit:'', include: true}); addFactorRow({name:'V carrier',low:10,high:100,unit:'', include: true}); addFactorRow({name:'V table',low:10,high:100,unit:'', include: true}); buildDesign(); const fn=state.factors.map(f=>f.name); state.runs.forEach(r=>{ const a=codeFromValue(r.combo[fn[0]],0,1); const b=codeFromValue(r.combo[fn[1]],10,100); const c=codeFromValue(r.combo[fn[2]],10,100); const y= 5 + 2*a + 3*b + 0.5*c - 1.5*a*b + (Math.random()-0.5); const el=$('#y_'+r.id, modalRoot) as HTMLInputElement; if(el) el.value=y.toFixed(2); }); ($('#analyze', modalRoot) as HTMLElement).click(); };

            // Seed defaults
            // FIX: Add missing `include` property to object literals.
            addFactorRow({name:'Sıcaklık',low:120,high:150,unit:'°C', include: true}); addFactorRow({name:'Basınç',low:50,high:100,unit:'bar', include: true}); addFactorRow({name:'Süre',low:8,high:14,unit:'sn',include:false});

            // Public D5 API (not used in modal context, but kept for integrity)
            (window as any).DOE={ attachDoeToD5(selector: string){ const host=document.querySelector(selector); if(!host){ console.warn('D5 alanı bulunamadı:',selector); return;} const btn=document.createElement('button'); btn.textContent='DOE – Deney Tasarımı'; btn.className='secondary'; btn.onclick=()=>{ document.querySelector('.container')?.scrollIntoView({behavior:'smooth'}); }; host.appendChild(btn);} };

            // ---- Stats helpers ----
            function normInv(p: number){ const a1=-39.6968302866538,a2=220.946098424521,a3=-275.928510446969,a4=138.357751867269,a5=-30.6647980661472,a6=2.50662827745924; const b1=-54.4760987982241,b2=161.585836858041,b3=-155.698979859887,b4=66.8013118877197,b5=-13.2806815528857; const c1=-7.78489400243029,c2=-3.22396458041136,c3=-2.40075827716184,c4=-2.54973253934373,c5=4.37466414146497,c6=2.93816398269878; const d1=7.78469570904146,d2=3.2246712907004,d3=2.445134137143,d4=3.75440866190742; const plow=0.02425,phigh=1-plow; let q,r; if(p<plow){ q=Math.sqrt(-2*Math.log(p)); return (((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6)/((((d1*q+d2)*q+d3)*q+d4)*q+1);} if(p>phigh){ q=Math.sqrt(-2*Math.log(1-p)); return -(((((c1*q+c2)*q+c3)*q+c4)*q+c5)*q+c6)/((((d1*q+d2)*q+d3)*q+d4)*q+1);} q=p-0.5; r=q*q; return (((((a1*r+a2)*r+a3)*r+a4)*r+a5)*r+a6)*q/(((((b1*r+b2)*r+b3)*r+b4)*r+b5)*r+1); }
            function approxTCrit(dof:number){ if(!isFinite(dof)||dof<=1) return 12; if(dof<3) return 4.3; if(dof<5) return 2.78; if(dof<10) return 2.31; if(dof<20) return 2.09; if(dof<30) return 2.05; if(dof<60) return 2.00; return 1.96; }
        })();
    }, [isOpen]);

    const doeHtmlContent = `
    <div class="container">
        <div class="row">
        <h1>DOE (Design of Experiments) – Web UI</h1>
        <span class="badge">Minitab tarzı akış • Ana etki • Etkileşim • Pareto • Residuals • Yorum</span>
        </div>
        <div class="grid two" style="margin-top:16px">
        <div class="card">
            <div class="section-title"><h2>1) Deney Kurulumu</h2><span class="badge">2-seviyeli faktöriyel, tam veya fraksiyel</span></div>
            <div class="divider"></div>
            <div class="row">
            <label>Hedef (Response) adı <input id="yName" placeholder="Yapışma (N/25mm)"/></label>
            <label>Hedef yönü 
                <select id="goal">
                <option value="max">Maksimize et</option>
                <option value="min">Minimize et</option>
                <option value="target">Hedefe yakın</option>
                </select>
            </label>
            <label>Hedef değer <input id="target" type="number" step="any" value="0"/></label>
            <label>Replikasyon <input id="rep" type="number" min="1" value="2"/></label>
            <label>Fraksiyon 
                <select id="fraction">
                <option value="1">Tam (2^k)</option>
                <option value="2">1/2 fraksiyon</option>
                <option value="4">1/4 fraksiyon</option>
                </select>
            </label>
            <label class="row"><input type="checkbox" id="randomize" checked/> Randomize sırala</label>
            </div>
            <div class="divider"></div>
            <h3>Faktörler</h3>
            <table id="factorTable">
            <thead>
                <tr><th>#</th><th>Faktör Adı</th><th>Düşük (-1)</th><th>Yüksek (+1)</th><th>Birim</th><th>Dahil</th><th></th></tr>
            </thead>
            <tbody></tbody>
            </table>
            <div class="row" style="margin-top:8px">
            <button class="secondary" id="addFactor">+ Faktör Ekle</button>
            <span class="note">Örn: Sıcaklık (°C) 120 / 150 • Basınç (bar) 50 / 100</span>
            <span class="right"></span>
            <button id="buildDesign">Tasarımı Oluştur</button>
            </div>
            <div class="divider"></div>
            <div class="row">
            <button class="ghost" id="quickTest">Hızlı Test (2F)</button>
            <button class="ghost" id="test1F">Test 1F</button>
            <button class="ghost" id="test3F">Test 3F</button>
            <span class="note">(Test butonları: otomatik veri + analiz)</span>
            </div>
        </div>
        <div class="card">
            <div class="section-title"><h2>2) Deney Koşulları & Ölçümler</h2><span class="badge" id="runCount">0 koşul</span></div>
            <div class="divider"></div>
            <div class="row">
            <button class="ghost" id="clearY">Y sütunlarını temizle</button>
            <button class="ghost" id="fillDemo">Demo veri doldur</button>
            <span class="right note">Koşulları oluşturduktan sonra sonuç (Y) girin.</span>
            </div>
            <div style="overflow:auto; margin-top:8px; max-height: 400px;">
            <table id="runTable"></table>
            </div>
            <div class="row" style="margin-top:10px">
            <button id="analyze">3) Analiz Et</button>
            <span class="note">Analiz: etkiler, Pareto, ana/etkileşim grafikleri, residuals, optimizer ve yorumlar</span>
            </div>
        </div>
        </div>
        <div class="grid three" style="margin-top:16px">
        <div class="card">
            <div class="section-title"><h2>Ana Etki Grafiği</h2><span class="badge" id="mainEffectsBadge">-</span></div>
            <div class="divider"></div>
            <div class="canvas-wrap"><canvas id="mainEffects" width="520" height="320"></canvas></div>
            <div class="note">X: Faktör seviyeleri (-1/+1) • Y: Ortalama yanıt</div>
            <div id="mainEffectsComment" class="note" style="margin-top:6px"></div>
        </div>
        <div class="card">
            <div class="section-title"><h2>Etkileşim Grafiği (ilk 2 faktör)</h2><span class="badge" id="interactionBadge">-</span></div>
            <div class="divider"></div>
            <div class="canvas-wrap"><canvas id="interaction" width="520" height="320"></canvas></div>
            <div class="note">Çizgiler paralel değilse etkileşim vardır.</div>
            <div id="interactionComment" class="note" style="margin-top:6px"></div>
        </div>
        <div class="card">
            <div class="section-title"><h2>Pareto (Standartlaştırılmış Etkiler |t|)</h2><span class="badge" id="paretoBadge">-</span></div>
            <div class="divider"></div>
            <div class="canvas-wrap"><canvas id="pareto" width="520" height="320"></canvas></div>
            <div id="paretoComment" class="note" style="margin-top:6px"></div>
        </div>
        </div>
        <div class="grid two" style="margin-top:16px">
        <div class="card">
            <div class="section-title"><h2>Residual Diagnostikleri</h2><span class="badge" id="residBadge">-</span></div>
            <div class="divider"></div>
            <div class="grid two">
            <div class="canvas-wrap"><canvas id="residQQ" width="520" height="320"></canvas></div>
            <div class="canvas-wrap"><canvas id="residVsFit" width="520" height="320"></canvas></div>
            <div class="canvas-wrap"><canvas id="residHist" width="520" height="320"></canvas></div>
            <div class="canvas-wrap"><canvas id="residOrder" width="520" height="320"></canvas></div>
            </div>
            <div id="residComment" class="note" style="margin-top:6px"></div>
        </div>
        <div class="card">
            <div class="section-title"><h2>Otomatik Yorumlar</h2><span class="badge">Dinamik</span></div>
            <div class="divider"></div>
            <div id="insights" class="row" style="align-items:flex-start"></div>
            <div class="divider"></div>
            <div class="section-title"><h2>Önerilen Ayarlar (Optimizer)</h2><span class="badge" id="optBadge">-</span></div>
            <div id="optTableWrap"></div>
        </div>
        </div>
    </div>
    `;

    const doeCssContent = `
    .doe-tool-container * { box-sizing: border-box; }
    .doe-tool-container { --bg:#0b1020; --card:#121931; --muted:#95a0b5; --text:#e8eefc; --accent:#7aa2ff; --accent-2:#9bffb7; --danger:#ff6b6b; --border:rgba(255,255,255,.08); background: var(--bg); color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 16px; border-radius: 8px;}
    .doe-tool-container .container{max-width:100%; margin: auto; padding: 0 }
    .doe-tool-container .grid{display:grid; gap:16px}
    .doe-tool-container .grid.two{grid-template-columns:1fr 1fr}
    .doe-tool-container .grid.three{grid-template-columns:repeat(auto-fit, minmax(300px, 1fr))}
    .doe-tool-container .card{background:var(--card); border:1px solid var(--border); border-radius:16px; padding:16px; box-shadow:0 10px 30px rgba(0,0,0,.25)}
    .doe-tool-container h1,.doe-tool-container h2,.doe-tool-container h3{margin:0 0 12px 0; color: var(--text); font-weight: 600;}
    .doe-tool-container h1 { font-size: 1.5rem; } .doe-tool-container h2 { font-size: 1.25rem; } .doe-tool-container h3 { font-size: 1.1rem; }
    .doe-tool-container .muted{color:var(--muted); font-size:12px}
    .doe-tool-container .row{display:flex; gap:8px; align-items:center; flex-wrap:wrap}
    .doe-tool-container button{background:linear-gradient(135deg,var(--accent),#4d7dff); border:none; color:#fff; padding:10px 14px; border-radius:12px; cursor:pointer; font-weight:600}
    .doe-tool-container button.secondary{background:#1a2446; color:var(--text); border:1px solid var(--border)}
    .doe-tool-container button.ghost{background:transparent; border:1px dashed var(--border); color:var(--muted)}
    .doe-tool-container button.danger{background:linear-gradient(135deg,var(--danger),#d84b4b)}
    .doe-tool-container input,.doe-tool-container select{background:#0e142a; border:1px solid var(--border); color:var(--text); padding:8px 10px; border-radius:10px}
    .doe-tool-container input[type=number]{width:100px}
    .doe-tool-container table{width:100%; border-collapse:collapse; font-size:14px}
    .doe-tool-container th,.doe-tool-container td{border-bottom:1px solid var(--border); padding:8px 6px; text-align:left}
    .doe-tool-container th{color:#c7d3ee; font-weight:700}
    .doe-tool-container kbd{background:#0e142a; border:1px solid var(--border); border-bottom-width:2px; padding:2px 6px; border-radius:6px; font-size:12px}
    .doe-tool-container .badge{background:#0e142a; border:1px solid var(--border); padding:2px 8px; border-radius:999px; font-size:12px}
    .doe-tool-container .right{margin-left:auto}
    .doe-tool-container .section-title{display:flex; align-items:center; gap:8px}
    .doe-tool-container .canvas-wrap{background:#0c1226; border:1px solid var(--border); border-radius:12px; padding:8px; overflow: hidden;}
    .doe-tool-container canvas { max-width: 100%; height: auto; }
    .doe-tool-container .note{font-size:12px; color:var(--muted)}
    .doe-tool-container .success{color:var(--accent-2)}
    .doe-tool-container .warning{color:#ffd166}
    .doe-tool-container .divider{height:1px; background:var(--border); margin:8px 0}
    `;
    
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Deney Tasarımı (DOE) Aracı"
            size="7xl"
        >
            <style>{doeCssContent}</style>
            <div 
                className="doe-tool-container"
                key={isOpen ? 'doe-tool-active' : 'doe-tool-inactive'}
                dangerouslySetInnerHTML={{ __html: doeHtmlContent }}
            />
        </Modal>
    );
};

export default DoeToolModal;
