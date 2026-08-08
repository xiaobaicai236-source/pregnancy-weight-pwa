(() => {
  const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  let canvas = null;
  let hitPoints = [];

  function cssVar(name, fallback){
    const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function setup(c){
    const rect=c.getBoundingClientRect();
    const width=Math.max(280, rect.width || 320);
    const height=Math.max(240, rect.height || 300);
    c.width=Math.round(width*DPR);
    c.height=Math.round(height*DPR);
    const ctx=c.getContext('2d');
    ctx.setTransform(DPR,0,0,DPR,0,0);
    return {ctx,width,height};
  }

  function drawChart(c, opts={}){
    if(!c) return {hitPoints:[]};
    canvas=c;
    const {ctx,width,height}=setup(c);
    const records=[...(opts.records||[])].sort((a,b)=>a.gestation-b.gestation);
    const currentWeek=Number(opts.currentWeek ?? (records.at(-1)?.gestation ?? 25));
    const minWeek=Number(opts.minWeek ?? 1);
    const maxWeek=Number(opts.maxWeek ?? 40);
    const recFn=opts.recommendationAtWeek || (()=>({low:0,target:0,high:0}));

    const pad={l:40,r:54,t:24,b:36};
    const plotW=width-pad.l-pad.r, plotH=height-pad.t-pad.b;
    const samples=[];
    for(let w=minWeek;w<=maxWeek+0.001;w+=0.5){
      const r=recFn(w);
      samples.push({w,low:+r.low,target:+r.target,high:+r.high});
    }

    const vals=[];
    samples.forEach(s=>vals.push(s.low,s.target,s.high));
    records.forEach(r=>vals.push(+r.weight));
    let yMin=Math.min(...vals.filter(Number.isFinite))-1;
    let yMax=Math.max(...vals.filter(Number.isFinite))+1;
    if(!Number.isFinite(yMin)||!Number.isFinite(yMax)){ yMin=45; yMax=75; }
    if(yMax-yMin<8){ const mid=(yMin+yMax)/2; yMin=mid-4; yMax=mid+4; }

    const x=w=>pad.l+(w-minWeek)/(maxWeek-minWeek)*plotW;
    const y=v=>pad.t+(yMax-v)/(yMax-yMin)*plotH;

    ctx.clearRect(0,0,width,height);

    // Grid
    ctx.save();
    ctx.strokeStyle=cssVar('--hairline','rgba(127,127,127,.16)');
    ctx.fillStyle=cssVar('--muted','#8e8e93');
    ctx.lineWidth=1;
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

    // Reference band
    ctx.save();
    const grad=ctx.createLinearGradient(0,pad.t,0,height-pad.b);
    grad.addColorStop(0,'rgba(52,199,89,.17)');
    grad.addColorStop(1,'rgba(52,199,89,.05)');
    ctx.fillStyle=grad;
    ctx.beginPath();
    samples.forEach((s,i)=>i?ctx.lineTo(x(s.w),y(s.high)):ctx.moveTo(x(s.w),y(s.high)));
    for(let i=samples.length-1;i>=0;i--) ctx.lineTo(x(samples[i].w),y(samples[i].low));
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // Target line
    ctx.save();
    ctx.strokeStyle=cssVar('--green','#34c759');
    ctx.lineWidth=2; ctx.setLineDash([5,5]);
    ctx.beginPath();
    samples.forEach((s,i)=>i?ctx.lineTo(x(s.w),y(s.target)):ctx.moveTo(x(s.w),y(s.target)));
    ctx.stroke(); ctx.restore();

    // Reference labels at the right edge
    const end=samples.at(-1);
    if(end){
      const edgeX=x(end.w);
      const labels=[
        {text:'上限',value:end.high,alpha:.72},
        {text:'中位数',value:end.target,alpha:1},
        {text:'下限',value:end.low,alpha:.72}
      ];
      ctx.save();
      ctx.strokeStyle=cssVar('--green','#34c759');
      ctx.fillStyle=cssVar('--green','#34c759');
      ctx.lineWidth=1;
      ctx.font='600 10px -apple-system,BlinkMacSystemFont,sans-serif';
      ctx.textAlign='left'; ctx.textBaseline='middle';
      labels.forEach(label=>{
        const yy=y(label.value);
        ctx.globalAlpha=label.alpha;
        ctx.beginPath(); ctx.moveTo(edgeX+2,yy); ctx.lineTo(edgeX+8,yy); ctx.stroke();
        ctx.fillText(label.text,edgeX+11,yy);
      });
      ctx.restore();
    }

    // Current gestation marker
    if(currentWeek>=minWeek && currentWeek<=maxWeek){
      const cx=x(currentWeek);
      ctx.save();
      ctx.strokeStyle='rgba(0,122,255,.42)';
      ctx.lineWidth=1.5; ctx.setLineDash([3,5]);
      ctx.beginPath(); ctx.moveTo(cx,pad.t); ctx.lineTo(cx,height-pad.b); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=cssVar('--accent','#007aff');
      ctx.font='600 10px -apple-system,BlinkMacSystemFont,sans-serif';
      ctx.textAlign='center';
      ctx.fillText(`${Math.floor(currentWeek)}周`,cx,pad.t-8);
      ctx.restore();
    }

    // Actual records
    if(records.length){
      ctx.save();
      ctx.strokeStyle=cssVar('--accent','#007aff');
      ctx.lineWidth=3; ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.beginPath();
      records.forEach((r,i)=>i?ctx.lineTo(x(r.gestation),y(r.weight)):ctx.moveTo(x(r.gestation),y(r.weight)));
      ctx.stroke();

      records.forEach(r=>{
        const xx=x(r.gestation), yy=y(r.weight);
        ctx.beginPath(); ctx.fillStyle=cssVar('--panel','#fff'); ctx.arc(xx,yy,6,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.fillStyle=cssVar('--accent','#007aff'); ctx.arc(xx,yy,3.5,0,Math.PI*2); ctx.fill();
      });
      ctx.restore();
    }

    // X axis
    ctx.save();
    ctx.fillStyle=cssVar('--muted','#8e8e93');
    ctx.font='11px -apple-system,BlinkMacSystemFont,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    Array.from({length:14},(_,i)=>1+i*3).filter(w=>w<=40).forEach(w=>ctx.fillText(`${w}周`,x(w),height-pad.b+9));
    ctx.restore();

    hitPoints=records.map(r=>({
      x:x(r.gestation), y:y(r.weight),
      record:r, week:r.week, day:r.day, weight:r.weight
    }));
    return {hitPoints};
  }

  function nearestPoint(c, clientX, clientY, maxDist=26){
    if(!c) return null;
    const rect=c.getBoundingClientRect();
    const px=clientX-rect.left, py=clientY-rect.top;
    let best=null, bestD=Infinity;
    for(const p of hitPoints){
      const d=Math.hypot(px-p.x,py-p.y);
      if(d<bestD){best=p;bestD=d;}
    }
    return bestD<=maxDist?best:null;
  }

  // Compatibility API used by app.js from earlier versions.
  function init(c){ canvas=c; }
  function draw({curve=[],records=[],currentGestation=25}={}){
    if(!canvas) return;
    // The enhanced renderer in app.js will immediately redraw with full recommendation fn.
    // Keep this method harmless and compatible.
    if(!curve.length) return;
    const byWeek = new Map(curve.map(p=>[Number(p.week).toFixed(2),p]));
    const nearestRec = w => {
      let best=curve[0], dist=Infinity;
      for(const p of curve){
        const d=Math.abs(+p.week-w);
        if(d<dist){dist=d;best=p;}
      }
      return best || {low:0,target:0,high:0};
    };
    drawChart(canvas,{
      records,currentWeek:currentGestation,
      minWeek:+curve[0].week,maxWeek:+curve.at(-1).week,
      recommendationAtWeek:nearestRec
    });
  }
  function nearest(clientX,clientY){
    const p=nearestPoint(canvas,clientX,clientY);
    return p ? {x:p.x,y:p.y,week:p.week,day:p.day,weight:p.weight,record:p.record} : null;
  }

  window.PregnancyChart={init,draw,nearest,drawChart,nearestPoint};
})();
