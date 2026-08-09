(() => {
  const DPR=Math.max(1,Math.min(3,window.devicePixelRatio||1));
  let canvas=null,hitPoints=[],lastFrame=null,crosshair=null;
  function cssVar(name,fallback){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fallback;}
  function setup(element){
    const rect=element.getBoundingClientRect(),width=Math.max(280,rect.width||320),height=Math.max(240,rect.height||300);
    element.width=Math.round(width*DPR);element.height=Math.round(height*DPR);
    const ctx=element.getContext('2d');ctx.setTransform(DPR,0,0,DPR,0,0);return {ctx,width,height};
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
    const {pad,plotW}=frame,boxW=Math.min(174,plotW-14),boxH=106;
    const left=xx>pad.l+plotW/2?pad.l+7:pad.l+plotW-boxW-7,top=pad.t+7;
    const colors={upper:cssVar('--range-upper','#a45116'),middle:cssVar('--range-middle','#0f7335'),lower:cssVar('--range-lower','#006fa8')};
    const soft={upper:cssVar('--range-upper-soft','rgba(164,81,22,.10)'),middle:cssVar('--range-middle-soft','rgba(22,138,67,.10)'),lower:cssVar('--range-lower-soft','rgba(0,111,168,.10)')};
    ctx.save();roundedRect(ctx,left,top,boxW,boxH,11);ctx.fillStyle=cssVar('--panel-solid','#fff');ctx.globalAlpha=.97;ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle=cssVar('--line-strong','rgba(127,127,127,.22)');ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=cssVar('--text','#17181b');ctx.font='700 10px -apple-system,BlinkMacSystemFont,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(`${query.week}周${query.day}天`,left+11,top+13);
    const rows=[
      {key:'upper',label:'推荐上限',value:query.high,shape:'bar'},
      {key:'middle',label:'推荐中位数',value:query.target,shape:'ring'},
      {key:'lower',label:'推荐下限',value:query.low,shape:'diamond'}
    ];
    rows.forEach((row,index)=>{
      const rowTop=top+25+index*21,rowY=rowTop+8;
      roundedRect(ctx,left+7,rowTop,boxW-14,17,6);ctx.fillStyle=soft[row.key];ctx.fill();ctx.strokeStyle=colors[row.key];ctx.fillStyle=colors[row.key];ctx.lineWidth=row.shape==='ring'?2:1.7;
      if(row.shape==='bar'){ctx.beginPath();ctx.moveTo(left+13,rowY);ctx.lineTo(left+23,rowY);ctx.stroke();}
      else if(row.shape==='ring'){ctx.beginPath();ctx.arc(left+18,rowY,4,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(left+18,rowY,1.5,0,Math.PI*2);ctx.fill();}
      else{ctx.beginPath();ctx.moveTo(left+18,rowY-4);ctx.lineTo(left+22,rowY);ctx.lineTo(left+18,rowY+4);ctx.lineTo(left+14,rowY);ctx.closePath();ctx.fill();}
      ctx.fillStyle=cssVar('--text','#17181b');ctx.font=`${row.shape==='ring'?'700':'600'} 9px -apple-system,BlinkMacSystemFont,sans-serif`;ctx.fillText(`${row.label} ${row.value.toFixed(1)} kg`,left+29,rowY+.5);
    });
    ctx.fillStyle=cssVar('--muted','#72757d');ctx.font='8px -apple-system,BlinkMacSystemFont,sans-serif';ctx.fillText('估算推荐范围，仅供趋势参考',left+10,top+97);ctx.restore();
  }
  function drawCrosshair(frame,query){
    if(!frame||!query)return;const {ctx,pad,plotW,height,x,y}=frame,xx=x(query.gestation),yy=y(query.target),upperY=y(query.high),lowerY=y(query.low);
    ctx.save();ctx.strokeStyle=cssVar('--accent','#0a84ff');ctx.globalAlpha=.48;ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(xx,pad.t);ctx.lineTo(xx,height-pad.b);ctx.moveTo(pad.l,yy);ctx.lineTo(pad.l+plotW,yy);ctx.stroke();ctx.restore();
    ctx.save();ctx.setLineDash([2,3]);ctx.lineWidth=1;ctx.globalAlpha=.5;
    ctx.strokeStyle=cssVar('--range-upper','#a45116');ctx.beginPath();ctx.moveTo(xx-18,upperY);ctx.lineTo(xx+18,upperY);ctx.stroke();
    ctx.strokeStyle=cssVar('--range-lower','#006fa8');ctx.beginPath();ctx.moveTo(xx-14,lowerY);ctx.lineTo(xx+14,lowerY);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    ctx.strokeStyle=cssVar('--range-upper','#a45116');ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(xx-5,upperY);ctx.lineTo(xx+5,upperY);ctx.stroke();
    ctx.fillStyle=cssVar('--panel-solid','#fff');ctx.strokeStyle=cssVar('--range-middle','#0f7335');ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(xx,yy,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=cssVar('--range-middle','#0f7335');ctx.beginPath();ctx.arc(xx,yy,2.3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=cssVar('--range-lower','#006fa8');ctx.beginPath();ctx.moveTo(xx,lowerY-4);ctx.lineTo(xx+4,lowerY);ctx.lineTo(xx,lowerY+4);ctx.lineTo(xx-4,lowerY);ctx.closePath();ctx.fill();ctx.restore();
    drawTag(ctx,`${query.week}周${query.day}天`,xx,height-pad.b+10,frame);
    drawRangeInfo(ctx,query,xx,frame);
  }
  function restoreBase(){
    if(!lastFrame?.baseImage)return;const {ctx,baseImage}=lastFrame;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(baseImage,0,0);ctx.restore();ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  function drawChart(element,opts={}){
    if(!element)return {hitPoints:[]};
    canvas=element;const {ctx,width,height}=setup(element);
    const minWeek=Number(opts.minWeek??1),maxWeek=Number(opts.maxWeek??40+6/7),currentWeek=Number(opts.currentWeek??25);
    const records=[...(opts.records||[])].filter(record=>Number.isFinite(+record.gestation)&&Number.isFinite(+record.weight)&&record.gestation>=minWeek&&record.gestation<=maxWeek).sort((a,b)=>a.gestation-b.gestation);
    const recFn=typeof opts.recommendationAtWeek==='function'?opts.recommendationAtWeek:null;
    const samples=[];
    if(recFn){
      for(let gestation=minWeek;gestation<=maxWeek+0.001;gestation+=0.25){
        const result=recFn(gestation);
        if(result?.available&&[result.low,result.target,result.high].every(Number.isFinite)) samples.push({gestation,low:+result.low,target:+result.target,high:+result.high});
      }
      if(samples.length&&samples.at(-1).gestation<maxWeek){
        const result=recFn(maxWeek);
        if(result?.available) samples.push({gestation:maxWeek,low:+result.low,target:+result.target,high:+result.high});
      }
    }
    const hasReference=samples.length>1;if(!hasReference)crosshair=null;
    const pad={l:38,r:hasReference?(width<360?54:62):16,t:25,b:38};
    const plotW=Math.max(150,width-pad.l-pad.r),plotH=height-pad.t-pad.b;
    const values=[];samples.forEach(sample=>values.push(sample.low,sample.target,sample.high));records.forEach(record=>values.push(+record.weight));
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

    if(hasReference){
      ctx.save();const gradient=ctx.createLinearGradient(0,pad.t,0,height-pad.b);gradient.addColorStop(0,'rgba(52,199,89,.17)');gradient.addColorStop(1,'rgba(52,199,89,.05)');ctx.fillStyle=gradient;ctx.beginPath();
      samples.forEach((sample,index)=>index?ctx.lineTo(x(sample.gestation),y(sample.high)):ctx.moveTo(x(sample.gestation),y(sample.high)));
      for(let index=samples.length-1;index>=0;index--)ctx.lineTo(x(samples[index].gestation),y(samples[index].low));
      ctx.closePath();ctx.fill();ctx.restore();

      ctx.save();ctx.strokeStyle=cssVar('--green','#29c763');ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();samples.forEach((sample,index)=>index?ctx.lineTo(x(sample.gestation),y(sample.target)):ctx.moveTo(x(sample.gestation),y(sample.target)));ctx.stroke();ctx.restore();

      const end=samples.at(-1),edgeX=x(end.gestation);
      const labels=separateLabels([
        {text:'上限',value:end.high,y:y(end.high),alpha:.72},
        {text:'中位数',value:end.target,y:y(end.target),alpha:1},
        {text:'下限',value:end.low,y:y(end.low),alpha:.72}
      ],pad.t+5,height-pad.b-5,width<360?12:13);
      ctx.save();ctx.strokeStyle=cssVar('--green','#29c763');ctx.fillStyle=cssVar('--green','#29c763');ctx.lineWidth=1;ctx.font=`600 ${width<360?9:10}px -apple-system,BlinkMacSystemFont,sans-serif`;ctx.textAlign='left';ctx.textBaseline='middle';
      labels.forEach(label=>{ctx.globalAlpha=label.alpha;ctx.beginPath();ctx.moveTo(edgeX+2,label.y);ctx.lineTo(edgeX+7,label.displayY);ctx.stroke();ctx.fillText(label.text,edgeX+9,label.displayY);});ctx.restore();
    }

    if(currentWeek>=minWeek&&currentWeek<=maxWeek){
      const currentX=x(currentWeek);ctx.save();ctx.strokeStyle='rgba(10,132,255,.42)';ctx.lineWidth=1.5;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(currentX,pad.t);ctx.lineTo(currentX,height-pad.b);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=cssVar('--accent','#0a84ff');ctx.font='600 10px -apple-system,BlinkMacSystemFont,sans-serif';ctx.textAlign='center';ctx.fillText(`${Math.floor(currentWeek)}周`,Math.max(pad.l+13,Math.min(pad.l+plotW-13,currentX)),pad.t-8);ctx.restore();
    }

    if(records.length){
      ctx.save();ctx.strokeStyle=cssVar('--accent','#0a84ff');ctx.lineWidth=3;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();records.forEach((record,index)=>index?ctx.lineTo(x(record.gestation),y(record.weight)):ctx.moveTo(x(record.gestation),y(record.weight)));ctx.stroke();
      records.forEach(record=>{const xx=x(record.gestation),yy=y(record.weight);ctx.beginPath();ctx.fillStyle=cssVar('--panel-solid','#fff');ctx.arc(xx,yy,6,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.fillStyle=cssVar('--accent','#0a84ff');ctx.arc(xx,yy,3.7,0,Math.PI*2);ctx.fill();});ctx.restore();
    }

    const recommendedPoints=hasReference?records.map(record=>{
      const recommendation=recFn(record.gestation);return recommendation?.available?{gestation:record.gestation,target:Number(recommendation.target),week:record.week,day:record.day}:null;
    }).filter(point=>point&&Number.isFinite(point.target)):[];
    if(recommendedPoints.length){
      ctx.save();ctx.strokeStyle=cssVar('--green','#29c763');ctx.fillStyle=cssVar('--panel-solid','#fff');ctx.lineWidth=2;
      recommendedPoints.forEach(point=>{const xx=x(point.gestation),yy=y(point.target);ctx.beginPath();ctx.arc(xx,yy,5,0,Math.PI*2);ctx.fill();ctx.stroke();});ctx.restore();
    }

    ctx.save();ctx.fillStyle=cssVar('--muted','#72757d');ctx.font=`${width<360?9:10}px -apple-system,BlinkMacSystemFont,sans-serif`;ctx.textAlign='center';ctx.textBaseline='top';
    Array.from({length:14},(_,index)=>1+index*3).filter(week=>week<=40).forEach(week=>ctx.fillText(`${week}周`,x(week),height-pad.b+9));ctx.restore();

    hitPoints=[
      ...records.map(record=>({type:'actual',x:x(record.gestation),y:y(record.weight),record,week:record.week,day:record.day,weight:record.weight})),
      ...recommendedPoints.map(point=>({type:'recommended',x:x(point.gestation),y:y(point.target),week:point.week,day:point.day,weight:point.target}))
    ];
    const baseImage=ctx.getImageData(0,0,element.width,element.height);
    lastFrame={element,opts,ctx,width,height,pad,plotW,plotH,minWeek,maxWeek,recFn,x,y,baseImage};
    if(crosshair&&hasReference)drawCrosshair(lastFrame,crosshair);
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
  function showCrosshair(clientX,clientY){
    const frame=lastFrame;if(!frame?.recFn||!frame.element)return clearCrosshair();
    const rect=frame.element.getBoundingClientRect(),px=clientX-rect.left,py=clientY-rect.top;
    if(py<frame.pad.t||py>frame.height-frame.pad.b||px<frame.pad.l||px>frame.pad.l+frame.plotW)return clearCrosshair();
    const maxQueryWeek=Math.min(40,frame.maxWeek),raw=frame.minWeek+(px-frame.pad.l)/frame.plotW*(frame.maxWeek-frame.minWeek);
    const totalDays=Math.round(Math.max(frame.minWeek,Math.min(maxQueryWeek,raw))*7),gestation=totalDays/7;
    const result=frame.recFn(gestation);
    if(!result?.available||![result.low,result.target,result.high].every(value=>Number.isFinite(Number(value))))return clearCrosshair();
    const low=Number(result.low),target=Number(result.target),high=Number(result.high);
    if(low>target||target>high)return clearCrosshair();
    crosshair={gestation,week:Math.floor(totalDays/7),day:totalDays%7,low,target,high};
    restoreBase();drawCrosshair(lastFrame,crosshair);return {...crosshair};
  }
  function clearCrosshair(){
    const had=Boolean(crosshair);crosshair=null;if(had)restoreBase();return null;
  }
  function hasCrosshair(){return Boolean(crosshair);}
  window.PregnancyChart={init,draw,nearest,drawChart,nearestPoint,showCrosshair,clearCrosshair,hasCrosshair};
})();
