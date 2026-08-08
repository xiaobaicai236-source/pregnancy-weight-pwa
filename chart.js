(() => {
  const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  function roundRect(ctx, x, y, w, h, r){
    const rr=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  function setupCanvas(canvas){
    const rect=canvas.getBoundingClientRect();
    const width=Math.max(280, rect.width || 320);
    const height=Math.max(240, rect.height || 300);
    canvas.width=Math.round(width*DPR);
    canvas.height=Math.round(height*DPR);
    const ctx=canvas.getContext('2d');
    ctx.setTransform(DPR,0,0,DPR,0,0);
    return {ctx,width,height};
  }

  function cssVar(name, fallback){
    const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function drawChart(canvas, opts={}){
    const {ctx,width,height}=setupCanvas(canvas);
    const records=[...(opts.records||[])].sort((a,b)=>a.gestation-b.gestation);
    const currentWeek=Number(opts.currentWeek ?? (records.at(-1)?.gestation ?? 24));
    const minWeek=Number(opts.minWeek ?? 12);
    const maxWeek=Number(opts.maxWeek ?? 40);
    const recFn=opts.recommendationAtWeek || ((w)=>({low:0,target:0,high:0}));

    const pad={l:38,r:16,t:20,b:34};
    const plotW=width-pad.l-pad.r, plotH=height-pad.t-pad.b;
    const samples=[];
    for(let w=minWeek;w<=maxWeek+0.001;w+=0.5){
      const r=recFn(w);
      samples.push({w,...r});
    }
    const ys=[];
    for(const s of samples) ys.push(s.low,s.high,s.target);
    for(const r of records) ys.push(r.weight);
    let yMin=Math.min(...ys.filter(Number.isFinite))-1;
    let yMax=Math.max(...ys.filter(Number.isFinite))+1;
    if(!Number.isFinite(yMin)||!Number.isFinite(yMax)){yMin=45;yMax=75}
    if(yMax-yMin<8){ const mid=(yMax+yMin)/2; yMin=mid-4; yMax=mid+4; }

    const x=w=>pad.l+(w-minWeek)/(maxWeek-minWeek)*plotW;
    const y=v=>pad.t+(yMax-v)/(yMax-yMin)*plotH;

    ctx.clearRect(0,0,width,height);

    // Subtle horizontal grid.
    ctx.save();
    ctx.strokeStyle=cssVar('--hairline','rgba(127,127,127,.16)');
    ctx.lineWidth=1;
    ctx.fillStyle=cssVar('--muted','#8e8e93');
    ctx.font='11px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.textAlign='right';
    ctx.textBaseline='middle';
    for(let i=0;i<4;i++){
      const val=yMin+(yMax-yMin)*(i/3);
      const yy=y(val);
      ctx.beginPath(); ctx.moveTo(pad.l,yy); ctx.lineTo(width-pad.r,yy); ctx.stroke();
      ctx.fillText(val.toFixed(0),pad.l-7,yy);
    }
    ctx.restore();

    // Reference band.
    ctx.save();
    const grad=ctx.createLinearGradient(0,pad.t,0,height-pad.b);
    grad.addColorStop(0,'rgba(52,199,89,.17)');
    grad.addColorStop(1,'rgba(52,199,89,.05)');
    ctx.fillStyle=grad;
    ctx.beginPath();
    samples.forEach((s,i)=>{ const xx=x(s.w), yy=y(s.high); i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); });
    for(let i=samples.length-1;i>=0;i--){ const s=samples[i]; ctx.lineTo(x(s.w),y(s.low)); }
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Target line.
    ctx.save();
    ctx.strokeStyle=cssVar('--green','#34c759');
    ctx.lineWidth=2;
    ctx.setLineDash([5,5]);
    ctx.beginPath();
    samples.forEach((s,i)=>{ const xx=x(s.w),yy=y(s.target); i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); });
    ctx.stroke();
    ctx.restore();

    // Current week marker.
    if(currentWeek>=minWeek && currentWeek<=maxWeek){
      const cx=x(currentWeek);
      ctx.save();
      ctx.strokeStyle='rgba(0,122,255,.45)';
      ctx.lineWidth=1.5;
      ctx.setLineDash([3,5]);
      ctx.beginPath(); ctx.moveTo(cx,pad.t); ctx.lineTo(cx,height-pad.b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=cssVar('--accent','#007aff');
      ctx.font='600 10px -apple-system,BlinkMacSystemFont,sans-serif';
      ctx.textAlign='center';
      ctx.fillText(`${Math.floor(currentWeek)}周`,cx,pad.t-7);
      ctx.restore();
    }

    // Actual line.
    if(records.length){
      ctx.save();
      ctx.strokeStyle=cssVar('--accent','#007aff');
      ctx.lineWidth=3;
      ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.beginPath();
      records.forEach((r,i)=>{ const xx=x(r.gestation),yy=y(r.weight); i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy); });
      ctx.stroke();

      records.forEach((r,i)=>{
        const xx=x(r.gestation),yy=y(r.weight);
        ctx.beginPath();
        ctx.fillStyle=cssVar('--panel','#fff');
        ctx.arc(xx,yy,6,0,Math.PI*2); ctx.fill();
        ctx.beginPath();
        ctx.fillStyle=cssVar('--accent','#007aff');
        ctx.arc(xx,yy,3.5,0,Math.PI*2); ctx.fill();
      });
      ctx.restore();
    }

    // X labels.
    ctx.save();
    ctx.fillStyle=cssVar('--muted','#8e8e93');
    ctx.font='11px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='top';
    [12,20,28,36,40].filter(w=>w>=minWeek&&w<=maxWeek).forEach(w=>ctx.fillText(`${w}周`,x(w),height-pad.b+9));
    ctx.restore();

    const hitPoints=records.map(r=>({x:x(r.gestation),y:y(r.weight),record:r}));
    canvas.__weightChartHitPoints=hitPoints;
    canvas.__weightChartMeta={x,y,pad,width,height,yMin,yMax,minWeek,maxWeek};
    return {hitPoints};
  }

  function nearestPoint(canvas, clientX, clientY, maxDist=24){
    const rect=canvas.getBoundingClientRect();
    const px=clientX-rect.left, py=clientY-rect.top;
    let best=null, bestD=Infinity;
    for(const p of canvas.__weightChartHitPoints||[]){
      const d=Math.hypot(px-p.x,py-p.y);
      if(d<bestD){best=p;bestD=d}
    }
    return bestD<=maxDist?best:null;
  }

  window.PregnancyChart={drawChart,nearestPoint};
})();