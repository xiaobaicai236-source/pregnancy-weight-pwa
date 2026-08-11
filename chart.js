(() => {
  const DPR=Math.max(1,Math.min(3,window.devicePixelRatio||1));
  let canvas=null,hitPoints=[],lastFrame=null,crosshair=null;
  function cssVar(name,fallback){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fallback;}
  function setup(element){
    const rect=element.getBoundingClientRect(),width=Math.max(280,rect.width||320),height=Math.max(240,rect.height||300);
    element.width=Math.round(width*DPR);element.height=Math.round(height*DPR);
    const ctx=element.getContext('2d');ctx.setTransform(DPR,0,0,DPR,0,0);
    const overlay=element.parentElement?.querySelector?.('.chart-crosshair-layer')||null;
    let overlayCtx=null;
    if(overlay){overlay.width=element.width;overlay.height=element.height;overlayCtx=overlay.getContext('2d');overlayCtx.setTransform(DPR,0,0,DPR,0,0);}
    return {ctx,overlayCtx,width,height};
  }
  function separateLabels(labels,minY,maxY,gap=13){
    const sorted=labels.map(item=>({...item,displayY:item.y})).sort((a,b)=>a.y-b.y);
    for(let index=1;index<sorted.length;index++) sorted[index].displayY=Math.max(sorted[index].displayY,sorted[index-1].displayY+gap);
    const overflow=sorted.at(-1).displayY-maxY;
    if(overflow>0) sorted.forEach(item=>item.displayY-=overflow);
    const underflow=minY-sorted[0].displayY;
    if(underflow>0) sorted.forEach(item=>item.displayY+=underflow);
    return sorted;
  }
  function xAxisTicks(plotW){
    const candidates=Array.from({length:14},(_,index)=>1+index*3).filter(week=>week<=40),minGap=28;
    const maxLabels=Math.max(2,Math.floor(plotW/minGap)+1);
    if(maxLabels>=candidates.length)return candidates;
    const stride=Math.ceil((candidates.length-1)/(maxLabels-1));
    const ticks=candidates.filter((_,index)=>index%stride===0);
    if(ticks.at(-1)!==40){
      const distance=(40-ticks.at(-1))/39*plotW;
      if(distance<minGap)ticks[ticks.length-1]=40;else ticks.push(40);
    }
    return ticks;
  }
  function roundedRect(ctx,x,y,width,height,radius=8){
    const r=Math.min(radius,width/2,height/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+width,y,x+width,y+height,r);ctx.arcTo(x+width,y+height,x,y+height,r);ctx.arcTo(x,y+height,x,y,r);ctx.arcTo(x,y,x+width,y,r);ctx.closePath();
  }
  function drawTag(ctx,text,desiredX,desiredY,frame,{align='center'}={}){
    ctx.save();ctx.font='600 10px -apple-system,BlinkMacSystemFont,sans-serif';
    const tagW=Math.ceil(ctx.measureText(text).width)+16,tagH=22;
    let left=align==='left'?desiredX:desiredX-tagW/2,top=desiredY;
    left=Math.max(4,Math.min(frame.width-tagW-4,left));top=Math.max(4,Math.min(frame.height-tagH-4,top));
    roundedRect(ctx,left,top,tagW,tagH,8);ctx.fillStyle=cssVar('--panel-solid','#fff');ctx.globalAlpha=.96;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=cssVar('--line-strong','rgba(127,127,127,.22)');ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=cssVar('--text','#17181b');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,left+tagW/2,top+tagH/2+.5);ctx.restore();
  }
  function drawRangeInfo(ctx,query,xx,frame){
    const {pad,plotW}=frame,boxW=Math.min(174,plotW-14);
    const left=xx>pad.l+plotW/2?pad.l+7:pad.l+plotW-boxW-7,top=pad.t+7;
    const doctorColor=cssVar('--doctor','#7551b9');
    const colors=query.kind==='doctor'?{upper:doctorColor,middle:doctorColor,lower:doctorColor}:{upper:cssVar('--range-upper','#a45116'),middle:cssVar('--range-middle','#0f7335'),lower:cssVar('--range-lower','#006fa8')};
    const outline=cssVar('--chart-label-outline','rgba(255,255,255,.92)');
    const text=(value,x,y,{color=cssVar('--text','#17181b'),font='600 9px -apple-system,BlinkMacSystemFont,sans-serif'}={})=>{
      ctx.font=font;ctx.strokeStyle=outline;ctx.lineWidth=2.4;ctx.lineJoin='round';ctx.strokeText(value,x,y);ctx.fillStyle=color;ctx.fillText(value,x,y);
    };
    ctx.save();ctx.textAlign='left';ctx.textBaseline='middle';text(`${query.week}周${query.day}天`,left+4,top+10,{font:'700 10px -apple-system,BlinkMacSystemFont,sans-serif'});
    if(query.doctorUnavailable)text('该孕周暂无医生目标数据',left+4,top+25,{color:doctorColor,font:'700 9px -apple-system,BlinkMacSystemFont,sans-serif'});
    if(query.noReference){text('通用参考当前也不可用',left+4,top+43,{color:cssVar('--muted','#72757d'),font:'8px -apple-system,BlinkMacSystemFont,sans-serif'});ctx.restore();return;}
    const rowTop=query.doctorUnavailable?43:29;
    const prefix=query.kind==='doctor'?'医生目标':query.doctorUnavailable?'通用参考':'推荐';
    const middleLabel=query.kind==='doctor'?(query.middleSource==='provided'?'医生目标中位数':'范围中点'):`${prefix}中位数`;
    const rows=[
      {key:'upper',label:`${prefix}上限`,value:query.high,shape:'bar'},
      {key:'middle',label:middleLabel,value:query.target,shape:'ring'},
      {key:'lower',label:`${prefix}下限`,value:query.low,shape:'diamond'}
    ];
    rows.forEach((row,index)=>{
      const rowY=top+rowTop+index*18;ctx.strokeStyle=colors[row.key];ctx.fillStyle=colors[row.key];ctx.lineWidth=row.shape==='ring'?2:1.7;
      if(row.shape==='bar'){ctx.beginPath();ctx.moveTo(left+4,rowY);ctx.lineTo(left+14,rowY);ctx.stroke();}
      else if(row.shape==='ring'){ctx.beginPath();ctx.arc(left+9,rowY,4,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(left+9,rowY,1.5,0,Math.PI*2);ctx.fill();}
      else{ctx.beginPath();ctx.moveTo(left+9,rowY-4);ctx.lineTo(left+13,rowY);ctx.lineTo(left+9,rowY+4);ctx.lineTo(left+5,rowY);ctx.closePath();ctx.fill();}
      text(`${row.label} ${row.value.toFixed(1)} kg`,left+20,rowY+.5,{color:colors[row.key],font:`${row.shape==='ring'?'700':'600'} 9px -apple-system,BlinkMacSystemFont,sans-serif`});
    });
    let footerY=top+rowTop+59;
    if(Number.isFinite(query.actualWeight)){text(`当前实际体重 ${query.actualWeight.toFixed(1)} kg`,left+4,footerY,{color:cssVar('--accent','#0a84ff'),font:'700 8px -apple-system,BlinkMacSystemFont,sans-serif'});footerY+=13;}
    text(query.kind==='doctor'?'医生录入目标，仅负责记录和绘图':'通用推荐范围，仅供趋势参考',left+4,footerY,{color:cssVar('--muted','#72757d'),font:'8px -apple-system,BlinkMacSystemFont,sans-serif'});ctx.restore();
  }
  function drawCrosshair(frame,query){
    if(!frame||!query)return;const {pad,plotW,height,x,y}=frame,ctx=frame.overlayCtx||frame.ctx,xx=x(query.gestation);
    const primaryColor=query.kind==='doctor'?cssVar('--doctor','#7551b9'):cssVar('--accent','#0a84ff');
    if(query.noReference){ctx.save();ctx.strokeStyle=primaryColor;ctx.globalAlpha=.48;ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(xx,pad.t);ctx.lineTo(xx,height-pad.b);ctx.stroke();ctx.restore();drawTag(ctx,`${query.week}周${query.day}天`,xx,height-pad.b+10,frame);drawRangeInfo(ctx,query,xx,frame);return;}
    const yy=y(query.target),upperY=y(query.high),lowerY=y(query.low);
    ctx.save();ctx.strokeStyle=primaryColor;ctx.globalAlpha=.48;ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(xx,pad.t);ctx.lineTo(xx,height-pad.b);ctx.moveTo(pad.l,yy);ctx.lineTo(pad.l+plotW,yy);ctx.stroke();ctx.restore();
    ctx.save();ctx.setLineDash([2,3]);ctx.lineWidth=1;ctx.globalAlpha=.5;
    ctx.strokeStyle=cssVar('--range-upper','#a45116');ctx.beginPath();ctx.moveTo(xx-18,upperY);ctx.lineTo(xx+18,upperY);ctx.stroke();
    ctx.strokeStyle=cssVar('--range-lower','#006fa8');ctx.beginPath();ctx.moveTo(xx-14,lowerY);ctx.lineTo(xx+14,lowerY);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    const upperColor=query.kind==='doctor'?primaryColor:cssVar('--range-upper','#a45116'),middleColor=query.kind==='doctor'?primaryColor:cssVar('--range-middle','#0f7335'),lowerColor=query.kind==='doctor'?primaryColor:cssVar('--range-lower','#006fa8');
    ctx.strokeStyle=upperColor;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(xx-5,upperY);ctx.lineTo(xx+5,upperY);ctx.stroke();
    ctx.fillStyle=cssVar('--panel-solid','#fff');ctx.strokeStyle=middleColor;ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(xx,yy,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=middleColor;ctx.beginPath();ctx.arc(xx,yy,2.3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=lowerColor;ctx.beginPath();ctx.moveTo(xx,lowerY-4);ctx.lineTo(xx+4,lowerY);ctx.lineTo(xx,lowerY+4);ctx.lineTo(xx-4,lowerY);ctx.closePath();ctx.fill();ctx.restore();
    drawTag(ctx,`${query.week}周${query.day}天`,xx,height-pad.b+10,frame);
    drawRangeInfo(ctx,query,xx,frame);
  }
  function clearCrosshairLayer(){
    if(!lastFrame)return;
    const {overlayCtx,ctx,baseImage,element}=lastFrame;
    if(overlayCtx){overlayCtx.save();overlayCtx.setTransform(1,0,0,1,0,0);overlayCtx.clearRect(0,0,element.width,element.height);overlayCtx.restore();overlayCtx.setTransform(DPR,0,0,DPR,0,0);return;}
    if(baseImage){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(baseImage,0,0);ctx.restore();ctx.setTransform(DPR,0,0,DPR,0,0);}
  }
  function drawChart(element,opts={}){
    if(!element)return {hitPoints:[]};
    crosshair=null;canvas=element;const {ctx,overlayCtx,width,height}=setup(element);
    const minWeek=Number(opts.minWeek??1),maxWeek=Number(opts.maxWeek??40+6/7),currentWeek=Number(opts.currentWeek??25);
    const records=[...(opts.records||[])].filter(record=>Number.isFinite(+record.gestation)&&Number.isFinite(+record.weight)&&record.gestation>=minWeek&&record.gestation<=maxWeek).sort((a,b)=>a.gestation-b.gestation);
    const generalRecFn=typeof opts.generalRecommendationAtWeek==='function'?opts.generalRecommendationAtWeek:(typeof opts.recommendationAtWeek==='function'?opts.recommendationAtWeek:null);
    const doctorRecFn=typeof opts.doctorRecommendationAtWeek==='function'?opts.doctorRecommendationAtWeek:null;
    const doctorEnabled=opts.doctorEnabled===true,doctorTargets=doctorEnabled&&Array.isArray(opts.doctorTargets)?opts.doctorTargets:[],generalMuted=opts.generalMuted===true;
    const samples=[];
    if(generalRecFn){
      for(let gestation=minWeek;gestation<=maxWeek+0.001;gestation+=0.25){
        const result=generalRecFn(gestation);
        if(result?.available&&[result.low,result.target,result.high].every(Number.isFinite)) samples.push({gestation,low:+result.low,target:+result.target,high:+result.high});
      }
      if(samples.length&&samples.at(-1).gestation<maxWeek){
        const result=generalRecFn(maxWeek);
        if(result?.available) samples.push({gestation:maxWeek,low:+result.low,target:+result.target,high:+result.high});
      }
    }
    const doctorSamples=doctorEnabled&&Array.isArray(opts.doctorCurve)?opts.doctorCurve.filter(sample=>sample?.available&&[sample.low,sample.target,sample.high].every(Number.isFinite)):[];
    const validDoctorTargets=doctorTargets.filter(target=>[target.gestation,target.lower,target.upper].every(value=>Number.isFinite(Number(value))));
    const hasGeneralReference=samples.length>1,hasDoctorReference=doctorSamples.length>0||validDoctorTargets.length>0,hasReference=hasGeneralReference||hasDoctorReference;if(!hasReference)crosshair=null;
    const pad={l:38,r:hasReference?(width<360?54:62):16,t:25,b:44};
    const plotW=Math.max(150,width-pad.l-pad.r),plotH=height-pad.t-pad.b;
    const values=[];samples.forEach(sample=>values.push(sample.low,sample.target,sample.high));doctorSamples.forEach(sample=>values.push(sample.low,sample.target,sample.high));validDoctorTargets.forEach(target=>values.push(+target.lower,+target.upper,...(target.middle===null?[]:[+target.middle])));records.forEach(record=>values.push(+record.weight));
    const finite=values.filter(Number.isFinite);
    let yMin=finite.length?Math.min(...finite)-1:45,yMax=finite.length?Math.max(...finite)+1:75;
    if(yMax-yMin<8){const middle=(yMin+yMax)/2;yMin=middle-4;yMax=middle+4;}
    const x=gestation=>pad.l+(gestation-minWeek)/(maxWeek-minWeek)*plotW;
    const y=weight=>pad.t+(yMax-weight)/(yMax-yMin)*plotH;
    ctx.clearRect(0,0,width,height);

    ctx.save();ctx.strokeStyle=cssVar('--line','rgba(127,127,127,.16)');ctx.fillStyle=cssVar('--muted','#72757d');ctx.lineWidth=1;ctx.font='10px -apple-system,BlinkMacSystemFont,sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
    for(let index=0;index<4;index++){
      const value=yMin+(yMax-yMin)*(index/3),yy=y(value);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(pad.l+plotW,yy);ctx.stroke();ctx.fillText(value.toFixed(0),pad.l-6,yy);
    }
    ctx.restore();

    if(hasGeneralReference){
      ctx.save();ctx.globalAlpha=generalMuted?.34:1;const gradient=ctx.createLinearGradient(0,pad.t,0,height-pad.b);gradient.addColorStop(0,'rgba(52,199,89,.17)');gradient.addColorStop(1,'rgba(52,199,89,.05)');ctx.fillStyle=gradient;ctx.beginPath();
      samples.forEach((sample,index)=>index?ctx.lineTo(x(sample.gestation),y(sample.high)):ctx.moveTo(x(sample.gestation),y(sample.high)));
      for(let index=samples.length-1;index>=0;index--)ctx.lineTo(x(samples[index].gestation),y(samples[index].low));
      ctx.closePath();ctx.fill();ctx.restore();

      ctx.save();ctx.globalAlpha=generalMuted?.42:1;ctx.strokeStyle=cssVar('--green','#29c763');ctx.lineWidth=generalMuted?1.5:2;ctx.setLineDash(generalMuted?[3,6]:[5,5]);ctx.beginPath();samples.forEach((sample,index)=>index?ctx.lineTo(x(sample.gestation),y(sample.target)):ctx.moveTo(x(sample.gestation),y(sample.target)));ctx.stroke();ctx.restore();

      const end=samples.at(-1),edgeX=x(end.gestation);
      const labels=separateLabels([
        {text:'上限',value:end.high,y:y(end.high),alpha:.72},
        {text:'中位数',value:end.target,y:y(end.target),alpha:1},
        {text:'下限',value:end.low,y:y(end.low),alpha:.72}
      ],pad.t+5,height-pad.b-5,width<360?12:13);
      ctx.save();ctx.strokeStyle=cssVar('--green','#29c763');ctx.fillStyle=cssVar('--green','#29c763');ctx.lineWidth=1;ctx.font=`600 ${width<360?9:10}px -apple-system,BlinkMacSystemFont,sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';
      labels.forEach(label=>{ctx.globalAlpha=label.alpha*(generalMuted?.45:1);ctx.beginPath();ctx.moveTo(edgeX+2,label.y);ctx.lineTo(edgeX+7,label.displayY);ctx.stroke();ctx.fillText(label.text,edgeX+9,label.displayY);});ctx.restore();
    }

    if(hasDoctorReference){
      const doctorColor=cssVar('--doctor','#7551b9');
      if(doctorSamples.length>1){
        ctx.save();ctx.fillStyle=cssVar('--doctor-soft','rgba(117,81,185,.14)');ctx.beginPath();doctorSamples.forEach((sample,index)=>index?ctx.lineTo(x(sample.gestation),y(sample.high)):ctx.moveTo(x(sample.gestation),y(sample.high)));for(let index=doctorSamples.length-1;index>=0;index--)ctx.lineTo(x(doctorSamples[index].gestation),y(doctorSamples[index].low));ctx.closePath();ctx.fill();ctx.restore();
        ctx.save();ctx.strokeStyle=doctorColor;ctx.lineWidth=1.8;ctx.setLineDash([]);['high','low'].forEach(key=>{ctx.beginPath();doctorSamples.forEach((sample,index)=>index?ctx.lineTo(x(sample.gestation),y(sample[key])):ctx.moveTo(x(sample.gestation),y(sample[key])));ctx.stroke();});ctx.restore();
        ctx.save();ctx.strokeStyle=doctorColor;ctx.lineWidth=2.4;for(let index=1;index<doctorSamples.length;index++){const left=doctorSamples[index-1],right=doctorSamples[index];ctx.setLineDash(left.middleSource==='provided'&&right.middleSource==='provided'?[]:[4,4]);ctx.beginPath();ctx.moveTo(x(left.gestation),y(left.target));ctx.lineTo(x(right.gestation),y(right.target));ctx.stroke();}ctx.restore();
      }
      ctx.save();ctx.strokeStyle=doctorColor;ctx.fillStyle=doctorColor;ctx.lineWidth=2;
      validDoctorTargets.forEach(target=>{const xx=x(+target.gestation),upperY=y(+target.upper),lowerY=y(+target.lower);ctx.beginPath();ctx.moveTo(xx,upperY);ctx.lineTo(xx,lowerY);ctx.stroke();[upperY,lowerY].forEach(yy=>{ctx.beginPath();ctx.arc(xx,yy,3,0,Math.PI*2);ctx.fill();});if(target.middle!==null){ctx.fillStyle=cssVar('--panel-solid','#fff');ctx.beginPath();ctx.arc(xx,y(+target.middle),5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=doctorColor;}});ctx.restore();
    }

    if(currentWeek>=minWeek&&currentWeek<=maxWeek){
      const currentX=x(currentWeek);ctx.save();ctx.strokeStyle='rgba(10,132,255,.42)';ctx.lineWidth=1.5;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(currentX,pad.t);ctx.lineTo(currentX,height-pad.b);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=cssVar('--accent','#0a84ff');ctx.font='600 10px -apple-system,BlinkMacSystemFont,sans-serif';ctx.textAlign='center';ctx.fillText(`${Math.floor(currentWeek)}周`,Math.max(pad.l+13,Math.min(pad.l+plotW-13,currentX)),pad.t-8);ctx.restore();
    }

    if(records.length){
      ctx.save();ctx.strokeStyle=cssVar('--accent','#0a84ff');ctx.lineWidth=3;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();records.forEach((record,index)=>index?ctx.lineTo(x(record.gestation),y(record.weight)):ctx.moveTo(x(record.gestation),y(record.weight)));ctx.stroke();
      records.forEach(record=>{const xx=x(record.gestation),yy=y(record.weight);ctx.beginPath();ctx.fillStyle=cssVar('--panel-solid','#fff');ctx.arc(xx,yy,6,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.fillStyle=cssVar('--accent','#0a84ff');ctx.arc(xx,yy,3.7,0,Math.PI*2);ctx.fill();});ctx.restore();
    }

    const recommendedPoints=hasGeneralReference?records.map(record=>{
      const recommendation=generalRecFn(record.gestation);return recommendation?.available?{gestation:record.gestation,target:Number(recommendation.target),week:record.week,day:record.day}:null;
    }).filter(point=>point&&Number.isFinite(point.target)):[];
    if(recommendedPoints.length){
      ctx.save();ctx.strokeStyle=cssVar('--green','#29c763');ctx.fillStyle=cssVar('--panel-solid','#fff');ctx.lineWidth=2;
      recommendedPoints.forEach(point=>{const xx=x(point.gestation),yy=y(point.target);ctx.beginPath();ctx.arc(xx,yy,5,0,Math.PI*2);ctx.fill();ctx.stroke();});ctx.restore();
    }

    ctx.save();ctx.fillStyle=cssVar('--muted','#72757d');ctx.font=`${width<360?9:10}px -apple-system,BlinkMacSystemFont,sans-serif`;ctx.textAlign='center';ctx.textBaseline='top';
    xAxisTicks(plotW).forEach(week=>ctx.fillText(String(week),x(week),height-pad.b+8));
    ctx.font=`${width<360?8:9}px -apple-system,BlinkMacSystemFont,sans-serif`;ctx.textAlign='right';ctx.fillText('单位：周',pad.l+plotW,height-11);ctx.restore();

    hitPoints=[
      ...records.map(record=>({type:'actual',x:x(record.gestation),y:y(record.weight),record,week:record.week,day:record.day,weight:record.weight})),
      ...recommendedPoints.map(point=>({type:'recommended',x:x(point.gestation),y:y(point.target),week:point.week,day:point.day,weight:point.target})),
      ...validDoctorTargets.filter(target=>target.middle!==null).map(target=>({type:'doctor',x:x(target.gestation),y:y(target.middle),week:target.week,day:target.day,weight:target.middle}))
    ];
    const baseImage=overlayCtx?null:ctx.getImageData(0,0,element.width,element.height);
    lastFrame={element,opts,ctx,overlayCtx,width,height,pad,plotW,plotH,minWeek,maxWeek,generalRecFn,doctorRecFn,doctorEnabled,records,x,y,baseImage};
    return {hitPoints};
  }
  function nearestPoint(element,clientX,clientY,maxDistance=24){
    if(!element)return null;const rect=element.getBoundingClientRect(),px=clientX-rect.left,py=clientY-rect.top;let best=null,distance=Infinity;
    hitPoints.forEach(point=>{const next=Math.hypot(px-point.x,py-point.y);if(next<distance){best=point;distance=next;}});return distance<=maxDistance?best:null;
  }
  function init(element){canvas=element;}
  function draw({curve=[],records=[],currentGestation=25}={}){
    if(!canvas)return;const nearestRecommendation=gestation=>{
      let best=null,distance=Infinity;curve.forEach(point=>{const next=Math.abs(+point.week-gestation);if(next<distance){distance=next;best=point;}});
      return best?{available:true,low:+best.low,target:+best.target,high:+best.high}:{available:false};
    };
    drawChart(canvas,{records,currentWeek:currentGestation,minWeek:1,maxWeek:40+6/7,recommendationAtWeek:curve.length?nearestRecommendation:null});
  }
  function nearest(clientX,clientY){return nearestPoint(canvas,clientX,clientY);}
  // Normalize viewport coordinates like Chart.js so CSS sizing, zoom and rotation
  // cannot create a fixed gap between the finger and the crosshair.
  function localPosition(frame,clientX,clientY){
    const rect=frame.element.getBoundingClientRect(),scaleX=rect.width?frame.width/rect.width:1,scaleY=rect.height?frame.height/rect.height:1;
    return {x:(clientX-rect.left)*scaleX,y:(clientY-rect.top)*scaleY};
  }
  function showCrosshair(clientX,clientY){
    const frame=lastFrame;if((!frame?.generalRecFn&&!frame?.doctorRecFn)||!frame.element)return clearCrosshair();
    const {x:px,y:py}=localPosition(frame,clientX,clientY);
    if(py<frame.pad.t||py>frame.height-frame.pad.b||px<frame.pad.l||px>frame.pad.l+frame.plotW)return clearCrosshair();
    const maxQueryWeek=Math.min(40,frame.maxWeek),raw=frame.minWeek+(px-frame.pad.l)/frame.plotW*(frame.maxWeek-frame.minWeek);
    const totalDays=Math.round(Math.max(frame.minWeek,Math.min(maxQueryWeek,raw))*7),gestation=totalDays/7;
    if(crosshair?.gestation===gestation)return {...crosshair};
    const doctorResult=frame.doctorEnabled&&frame.doctorRecFn?frame.doctorRecFn(gestation):null;
    const generalResult=frame.generalRecFn?frame.generalRecFn(gestation):null;
    const result=doctorResult?.available?doctorResult:generalResult;
    if(!result?.available){
      if(!frame.doctorEnabled)return clearCrosshair();
      crosshair={gestation,week:Math.floor(totalDays/7),day:totalDays%7,kind:'doctor',doctorUnavailable:true,noReference:true,actualWeight:null};clearCrosshairLayer();drawCrosshair(lastFrame,crosshair);return {...crosshair};
    }
    if(![result.low,result.target,result.high].every(value=>Number.isFinite(Number(value))))return clearCrosshair();
    const low=Number(result.low),target=Number(result.target),high=Number(result.high);
    if(low>target||target>high)return clearCrosshair();
    const actual=frame.records.find(record=>Math.abs(Number(record.gestation)-gestation)<1e-6);
    crosshair={gestation,week:Math.floor(totalDays/7),day:totalDays%7,low,target,high,kind:doctorResult?.available?'doctor':'general',middleSource:doctorResult?.middleSource||'provided',doctorUnavailable:frame.doctorEnabled&&!doctorResult?.available,actualWeight:actual?Number(actual.weight):null};
    clearCrosshairLayer();drawCrosshair(lastFrame,crosshair);return {...crosshair};
  }
  function clearCrosshair(){
    const had=Boolean(crosshair);crosshair=null;if(had)clearCrosshairLayer();return null;
  }
  function hasCrosshair(){return Boolean(crosshair);}
  function drawShareChart(ctx,opts={}){
    if(!ctx)return;
    const M=opts.metrics||window.PregnancyShareDesign?.card?.chart;
    const fontFamily=opts.fontFamily||window.PregnancyShareDesign?.card?.font;
    if(!M||!fontFamily)return;
    const bounds=opts.bounds||{x:0,y:0,width:800,height:460};
    const records=[...(opts.records||[])].filter(record=>Number.isFinite(+record.gestation)&&Number.isFinite(+record.weight)).sort((a,b)=>a.gestation-b.gestation);
    const samples=[...(opts.rangeSamples||[])].map(sample=>({
      gestation:+(sample.gestation??sample.week),low:+sample.low,middle:+(sample.middle??sample.target),high:+sample.high
    })).filter(sample=>[sample.gestation,sample.low,sample.middle,sample.high].every(Number.isFinite));
    const minWeek=Number(opts.minWeek??1),maxWeek=Number(opts.maxWeek??40),pad={l:M.padLeft,r:M.padRight,t:M.padTop,b:M.padBottom};
    const plot={x:bounds.x+pad.l,y:bounds.y+pad.t,width:bounds.width-pad.l-pad.r,height:bounds.height-pad.t-pad.b};
    const values=[];samples.forEach(sample=>values.push(sample.low,sample.middle,sample.high));records.forEach(record=>values.push(+record.weight));
    let yMin=Math.min(...values)-M.yMargin,yMax=Math.max(...values)+M.yMargin;
    if(!Number.isFinite(yMin)||!Number.isFinite(yMax)){yMin=M.fallbackMin;yMax=M.fallbackMax;}
    if(yMax-yMin<M.minSpan){const middle=(yMin+yMax)/2;yMin=middle-M.minSpan/2;yMax=middle+M.minSpan/2;}
    const x=gestation=>plot.x+(gestation-minWeek)/(maxWeek-minWeek)*plot.width;
    const y=weight=>plot.y+(yMax-weight)/(yMax-yMin)*plot.height;
    const palette=opts.palette||{},actualColor=palette.actual,textColor=palette.text,gridColor=palette.grid,pointFill=palette.pointFill;
    const rangeColor=opts.rangeType==='doctor'?palette.doctor:palette.range;
    const rangeFill=opts.rangeType==='doctor'?palette.doctorFill:palette.rangeFill;

    ctx.save();ctx.fillStyle=textColor;ctx.font=`500 ${M.legendFont}px ${fontFamily}`;ctx.textAlign='left';ctx.textBaseline='middle';
    const legendY=bounds.y+M.legendY;ctx.fillStyle=actualColor;ctx.beginPath();ctx.arc(bounds.x+M.legendDotRadius+2,legendY,M.legendDotRadius,0,Math.PI*2);ctx.fill();ctx.fillStyle=textColor;ctx.fillText('我的体重',bounds.x+M.legendTextX,legendY);
    if(samples.length){ctx.strokeStyle=rangeColor;ctx.lineWidth=M.rangeWidth;ctx.setLineDash(opts.rangeType==='doctor'?[]:M.generalDash);ctx.beginPath();ctx.moveTo(bounds.x+M.legendRangeX1,legendY);ctx.lineTo(bounds.x+M.legendRangeX2,legendY);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=textColor;ctx.fillText(opts.rangeLabel||'推荐参考',bounds.x+M.legendRangeTextX,legendY);}
    ctx.strokeStyle=gridColor;ctx.fillStyle=textColor;ctx.lineWidth=1;ctx.font=`500 ${M.axisFont}px ${fontFamily}`;ctx.textAlign='right';ctx.textBaseline='middle';
    for(let index=0;index<4;index++){const value=yMin+(yMax-yMin)*(index/3),yy=y(value);ctx.beginPath();ctx.moveTo(plot.x,yy);ctx.lineTo(plot.x+plot.width,yy);ctx.stroke();ctx.fillText(value.toFixed(0),plot.x-M.axisLabelOffset,yy);}
    if(samples.length){ctx.fillStyle=rangeFill;ctx.beginPath();samples.forEach((sample,index)=>index?ctx.lineTo(x(sample.gestation),y(sample.high)):ctx.moveTo(x(sample.gestation),y(sample.high)));for(let index=samples.length-1;index>=0;index--)ctx.lineTo(x(samples[index].gestation),y(samples[index].low));ctx.closePath();ctx.fill();ctx.strokeStyle=rangeColor;ctx.lineWidth=M.rangeWidth;ctx.setLineDash(opts.rangeType==='doctor'&&opts.middleSource==='provided'?[]:M.estimatedDash);ctx.beginPath();samples.forEach((sample,index)=>index?ctx.lineTo(x(sample.gestation),y(sample.middle)):ctx.moveTo(x(sample.gestation),y(sample.middle)));ctx.stroke();ctx.setLineDash([]);}
    const currentGestation=+opts.currentGestation;
    if(Number.isFinite(currentGestation)&&currentGestation>=minWeek&&currentGestation<=maxWeek){const xx=x(currentGestation);ctx.strokeStyle=palette.currentLine;ctx.lineWidth=M.currentLineWidth;ctx.setLineDash(M.currentDash);ctx.beginPath();ctx.moveTo(xx,plot.y);ctx.lineTo(xx,plot.y+plot.height);ctx.stroke();ctx.setLineDash([]);}
    if(records.length>1){ctx.strokeStyle=actualColor;ctx.lineWidth=M.actualWidth;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();records.forEach((record,index)=>index?ctx.lineTo(x(record.gestation),y(record.weight)):ctx.moveTo(x(record.gestation),y(record.weight)));ctx.stroke();}
    records.forEach(record=>{const xx=x(record.gestation),yy=y(record.weight);ctx.fillStyle=pointFill;ctx.beginPath();ctx.arc(xx,yy,M.pointOuter,0,Math.PI*2);ctx.fill();ctx.fillStyle=actualColor;ctx.beginPath();ctx.arc(xx,yy,M.pointInner,0,Math.PI*2);ctx.fill();});
    if(Number.isFinite(currentGestation)&&Number.isFinite(+opts.currentWeight)){const xx=x(currentGestation),yy=y(+opts.currentWeight);ctx.strokeStyle=actualColor;ctx.lineWidth=M.actualWidth;ctx.fillStyle=pointFill;ctx.beginPath();ctx.arc(xx,yy,M.currentOuter,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=actualColor;ctx.beginPath();ctx.arc(xx,yy,M.currentInner,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle=textColor;ctx.font=`500 ${M.axisFont}px ${fontFamily}`;ctx.textAlign='center';ctx.textBaseline='top';[1,10,20,30,40].filter(week=>week>=minWeek&&week<=maxWeek).forEach(week=>ctx.fillText(String(week),x(week),plot.y+plot.height+M.xLabelY));ctx.textAlign='right';ctx.fillText('单位：周',plot.x+plot.width,plot.y+plot.height+M.unitY);ctx.restore();
  }
  window.PregnancyChart={init,draw,nearest,drawChart,nearestPoint,showCrosshair,clearCrosshair,hasCrosshair,drawShareChart};
})();
