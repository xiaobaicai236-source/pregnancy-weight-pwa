(() => {
  const PREFS_KEY='pregnancy-share-card-prefs-v1';
  const DEFAULT_PREFS=Object.freeze({
    showPreWeight:true,
    showCurrentWeight:true,
    showGain:true,
    showGestationalAge:true,
    showHistoryCurve:true,
    showQrCode:true
  });
  const DESIGN=window.PregnancyShareDesign;
  if(!DESIGN?.card)throw new Error('分享设计令牌未加载');
  const CARD=DESIGN.card,FONT=CARD.font;
  let provider=null;
  let latestSnapshot=null;
  let imageUrl='';
  let imageBlob=null;
  let imageFile=null;
  let generating=false;
  let motherIllustration=null;
  let motherIllustrationPromise=null;
  let els={};

  function readPrefs(){
    try{return {...DEFAULT_PREFS,...JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')}}catch{return {...DEFAULT_PREFS}}
  }
  function writePrefs(prefs){
    try{localStorage.setItem(PREFS_KEY,JSON.stringify(prefs))}catch{}
  }
  function collectPrefs(){
    return Object.fromEntries(Object.keys(DEFAULT_PREFS).map(key=>[key,Boolean(els.form?.elements[key]?.checked)]));
  }
  function applyPrefs(prefs){
    Object.keys(DEFAULT_PREFS).forEach(key=>{if(els.form?.elements[key])els.form.elements[key].checked=Boolean(prefs[key])});
  }
  function roundedRect(ctx,x,y,w,h,r){
    const radius=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.arcTo(x+w,y,x+w,y+h,radius);
    ctx.arcTo(x+w,y+h,x,y+h,radius);
    ctx.arcTo(x,y+h,x,y,radius);
    ctx.arcTo(x,y,x+w,y,radius);
    ctx.closePath();
  }
  function fillRounded(ctx,x,y,w,h,r,fill,stroke){
    ctx.save();roundedRect(ctx,x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}
    ctx.restore();
  }
  function text(ctx,value,x,y,size,weight='500',color=CARD.colors.text,align='left'){
    ctx.save();ctx.fillStyle=color;ctx.font=`${weight} ${size}px ${FONT}`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(value,x,y);ctx.restore();
  }
  function formatWeight(value){return `${Number(value).toFixed(1)} kg`}
  function formatGain(value){const n=Number(value);return `${n>0?'+':''}${n.toFixed(1)} kg`}
  function drawPaperTexture(ctx){
    ctx.save();ctx.strokeStyle=CARD.colors.texture;ctx.fillStyle=CARD.colors.texture;ctx.lineWidth=1;
    for(let index=0;index<96;index++){
      const x=(index*97)%CARD.width,y=(index*157)%CARD.height;
      if(index%3===0){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+7+(index%5),y+1);ctx.stroke();}
      else{ctx.beginPath();ctx.arc(x,y,1+(index%2)*.4,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }
  function drawHeart(ctx,x,y,size,color){
    ctx.save();ctx.translate(x,y);ctx.scale(size/20,size/20);ctx.beginPath();ctx.moveTo(0,6);ctx.bezierCurveTo(-12,-2,-8,-14,0,-8);ctx.bezierCurveTo(8,-14,12,-2,0,6);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();
  }
  function drawMotherLine(ctx,x,y,scale=1){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.strokeStyle=CARD.colors.motherLine;ctx.lineWidth=3.2;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.arc(38,24,18,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(28,48);ctx.bezierCurveTo(12,73,15,113,35,139);ctx.bezierCurveTo(47,155,58,160,69,159);ctx.stroke();
    ctx.beginPath();ctx.moveTo(49,48);ctx.bezierCurveTo(62,69,62,84,55,97);ctx.bezierCurveTo(92,86,119,109,110,136);ctx.bezierCurveTo(102,158,75,164,52,154);ctx.stroke();
    ctx.beginPath();ctx.moveTo(58,72);ctx.bezierCurveTo(75,76,85,88,88,105);ctx.stroke();
    ctx.beginPath();ctx.moveTo(37,139);ctx.lineTo(28,176);ctx.moveTo(68,159);ctx.lineTo(77,178);ctx.stroke();ctx.restore();
  }
  function loadMotherIllustration(){
    if(motherIllustrationPromise)return motherIllustrationPromise;
    motherIllustrationPromise=new Promise(resolve=>{
      const image=new Image();
      image.decoding='async';
      image.onload=()=>{motherIllustration=image;resolve(image)};
      image.onerror=()=>resolve(null);
      image.src=DESIGN.assets?.motherIllustration||'';
    });
    return motherIllustrationPromise;
  }
  function drawMotherIllustration(ctx,layout){
    if(!motherIllustration){drawMotherLine(ctx,layout.motherX,layout.motherY,layout.motherScale);return}
    ctx.save();
    ctx.globalAlpha=.96;
    ctx.drawImage(motherIllustration,layout.motherImageX,layout.motherImageY,layout.motherImageWidth,layout.motherImageHeight);
    ctx.restore();
  }
  function drawQr(ctx,url,x,y,size){
    if(typeof window.qrcode!=='function')throw new Error('二维码组件未加载');
    const qr=window.qrcode(0,'M');
    qr.addData(url);
    qr.make();
    const count=qr.getModuleCount();
    const quiet=4;
    const cell=Math.max(1,Math.floor(size/(count+quiet*2)));
    const actual=cell*(count+quiet*2);
    const startX=Math.round(x+(size-actual)/2);
    const startY=Math.round(y+(size-actual)/2);
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle=CARD.colors.white;ctx.fillRect(startX,startY,actual,actual);
    ctx.fillStyle=CARD.colors.text;
    for(let row=0;row<count;row++)for(let col=0;col<count;col++){
      if(qr.isDark(row,col))ctx.fillRect(startX+(col+quiet)*cell,startY+(row+quiet)*cell,cell,cell);
    }
    ctx.restore();
  }
  function drawCard(snapshot,prefs){
    const P=CARD.colors,T=CARD.type,L=CARD.layout,C=CARD.chart;
    const publicLinkEnabled=DESIGN.features.shareCardPublicLink===true;
    const canvas=document.createElement('canvas');
    canvas.width=CARD.width;canvas.height=CARD.height;
    const ctx=canvas.getContext('2d',{alpha:false});
    const background=ctx.createLinearGradient(0,0,CARD.width,CARD.height);
    background.addColorStop(0,P.backgroundStart);background.addColorStop(.52,P.backgroundMiddle);background.addColorStop(1,P.backgroundEnd);
    ctx.fillStyle=background;ctx.fillRect(0,0,CARD.width,CARD.height);

    drawPaperTexture(ctx);
    const glow=ctx.createRadialGradient(L.glowX,L.glowY,L.glowInner,L.glowX,L.glowY,L.glowOuter);
    glow.addColorStop(0,P.glow);glow.addColorStop(1,P.glowClear);
    ctx.fillStyle=glow;ctx.fillRect(L.glowFillX,0,L.glowFillWidth,L.glowFillHeight);
    ctx.save();ctx.fillStyle=P.decorGreen;ctx.beginPath();ctx.ellipse(L.decorEllipseX,L.decorEllipseY,L.decorEllipseRx,L.decorEllipseRy,L.decorEllipseRotation,0,Math.PI*2);ctx.fill();ctx.restore();
    drawMotherIllustration(ctx,L);drawHeart(ctx,L.heartX,L.heartY,L.heartSize,P.heartCoral);drawHeart(ctx,L.smallHeartX,L.smallHeartY,L.smallHeartSize,P.heartGreen);
    text(ctx,snapshot.productName||'孕期体重记录',L.safe,L.productY,T.product,'700',P.link);
    text(ctx,'我的孕期体重记录',L.safe,L.titleY,T.title,'800',P.text);
    ctx.save();ctx.strokeStyle=P.coral;ctx.lineWidth=L.underlineWidth;ctx.lineCap='round';ctx.globalAlpha=.72;ctx.beginPath();ctx.moveTo(L.underlineStartX,L.titleUnderlineY);ctx.bezierCurveTo(L.underlineControl1X,L.titleUnderlineY-8,L.underlineControl2X,L.titleUnderlineY+6,L.underlineEndX,L.underlineEndY);ctx.stroke();ctx.restore();
    text(ctx,'记录变化，看见每一步成长',L.safe,L.subtitleY,T.subtitle,'500',P.muted);

    let statsY=L.statsDefaultY;
    if(prefs.showGestationalAge){
      fillRounded(ctx,L.safe,L.weekY,L.weekWidth,L.weekHeight,L.weekRadius,P.peachSoft,P.peachLine);
      text(ctx,snapshot.gestationalLabel,L.safe+L.weekWidth/2,L.weekTextY,T.week,'800',P.coralText,'center');
      statsY=L.statsWithWeekY;
    }

    const stats=[];
    if(prefs.showPreWeight)stats.push(['孕前体重',formatWeight(snapshot.preWeight)]);
    if(prefs.showCurrentWeight)stats.push(['当前体重',formatWeight(snapshot.currentWeight)]);
    if(prefs.showGain)stats.push(['累计增重',formatGain(snapshot.gain)]);
    let chartY=statsY;
    if(stats.length){
      const gap=L.statsGap,boxWidth=(L.panelWidth-gap*(stats.length-1))/stats.length;
      stats.forEach(([label,value],index)=>{
        const x=L.safe+index*(boxWidth+gap),fills=[P.statPanel,P.statPeach,P.statGreen];
        fillRounded(ctx,x,statsY,boxWidth,L.statHeight,L.statRadius,fills[index%fills.length],P.line);
        text(ctx,label,x+L.statLabelX,statsY+L.statLabelY,T.statLabel,'650',P.statLabel);
        text(ctx,value,x+L.statLabelX,statsY+L.statValueY,T.statValue,'800',P.text);
      });
      chartY=statsY+L.chartGapAfterStats;
    }

    const showPublicLink=publicLinkEnabled&&prefs.showQrCode;
    const chartHeight=(stats.length?L.chartDefaultHeight:L.chartPrivateHeight)+(showPublicLink?0:L.chartNoQrExtra);
    fillRounded(ctx,L.safe,chartY,L.panelWidth,chartHeight,L.chartRadius,P.panel,P.line);
    text(ctx,'体重趋势',L.chartTitleX,chartY+L.chartTitleY,T.section,'700',P.heading);
    let records=prefs.showHistoryCurve?snapshot.records:[snapshot.currentRecord];
    if(!prefs.showCurrentWeight)records=records.filter(record=>record.id!==snapshot.currentRecord.id);
    window.PregnancyChart.drawShareChart(ctx,{
      bounds:{x:L.chartBoundsX,y:chartY+L.chartBoundsY,width:L.chartBoundsWidth,height:chartHeight-L.chartBoundsBottom},
      records,
      rangeSamples:snapshot.rangeSamples,
      rangeLabel:snapshot.rangeLabel,
      rangeType:snapshot.rangeType,
      middleSource:snapshot.middleSource,
      palette:{actual:P.coralDeep,range:P.green,rangeFill:P.greenSoft,doctor:P.doctor,doctorFill:P.doctorSoft,text:P.muted,grid:P.line,pointFill:P.white,currentLine:P.currentLine},
      metrics:C,fontFamily:FONT,
      currentGestation:prefs.showGestationalAge?snapshot.gestation:NaN,
      currentWeight:prefs.showCurrentWeight?snapshot.currentWeight:NaN,
      minWeek:snapshot.minWeek,
      maxWeek:snapshot.maxWeek
    });
    const needsMoreRecords=prefs.showHistoryCurve&&records.length<2;

    const statusY=chartY+chartHeight+L.statusGap;
    const doctor=snapshot.rangeType==='doctor';
    fillRounded(ctx,L.safe,statusY,L.panelWidth,L.statusHeight,L.statusRadius,doctor?P.doctorSoft:P.greenSoft,doctor?P.doctorSoft:P.greenLine);
    text(ctx,snapshot.statusText,L.statusTextX,statusY+L.statusTitleY,T.status,'750',doctor?P.doctor:P.greenText);
    text(ctx,needsMoreRecords?'继续记录，形成你的孕期体重曲线':snapshot.statusNote||'结果仅用于日常记录与趋势参考',L.statusTextX,statusY+L.statusNoteY,T.note,'500',P.muted);

    const footerY=statusY+L.footerGap;
    const configQr=showPublicLink&&snapshot.qrEnabled&&/^https:\/\//i.test(snapshot.productUrl)&&!/(localhost|127\.0\.0\.1)/i.test(snapshot.productUrl);
    text(ctx,'孕期体重记录',L.safe,footerY+L.brandTitleY,T.brand,'780',P.text);
    text(ctx,'记录变化，看见每一步成长',L.safe,footerY+L.brandTaglineY,T.product,'500',P.muted);
    if(showPublicLink)text(ctx,snapshot.productUrl,L.safe,footerY+L.brandUrlY,T.url,'500',P.link);
    text(ctx,'仅供体重记录与趋势参考，不作为医学诊断依据',L.safe,L.legalY,T.legal,'500',P.subtle);
    if(configQr){
      fillRounded(ctx,L.qrX,footerY,L.qrSize,L.qrSize,L.qrRadius,P.white,P.line);
      drawQr(ctx,snapshot.productUrl,L.qrX+L.qrInset,footerY+L.qrInset,L.qrImageSize);
      text(ctx,'扫码记录你的孕期体重',L.qrCaptionX,footerY+L.qrCaptionY,T.qr,'600',P.qrCaption,'center');
    }
    return canvas;
  }
  function canvasToBlob(canvas){
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG 生成失败')),'image/png'));
  }
  function safeFileName(snapshot){
    const suffix=snapshot.gestationalLabel.replace(/[^0-9周天]/g,'')||'记录';
    return `孕期体重记录-${suffix}.png`;
  }
  function getResult(){
    try{return typeof provider==='function'?provider():{ready:false,missing:['分享数据接口未就绪']}}
    catch(error){console.warn('分享卡片数据读取失败',error);return {ready:false,missing:['分享功能暂时不可用']}}
  }
  function refreshAvailability(){
    if(!els.entryButton)return;
    const result=getResult();
    const missing=Array.isArray(result?.missing)?result.missing:[];
    els.entryButtons.forEach(button=>{button.disabled=!result?.ready;button.setAttribute('aria-disabled',String(!result?.ready));});
    els.entryHint.textContent=result?.ready?'仅在本机生成，不会上传任何记录。':missing.join('；')||'请完成孕前设置并录入当前体重。';
  }
  function showSettings(){
    const result=getResult();
    if(!result?.ready){refreshAvailability();return}
    latestSnapshot=result.data;
    applyPrefs(readPrefs());
    els.settings.hidden=false;els.preview.hidden=true;els.status.hidden=true;
    els.dialog.showModal();
    els.generate.focus();
  }
  function clearPreview(){
    if(imageUrl)URL.revokeObjectURL(imageUrl);
    imageUrl='';imageBlob=null;imageFile=null;
    if(els.image)els.image.removeAttribute('src');
  }
  function setStatus(message,tone='info'){
    els.status.hidden=false;els.status.dataset.tone=tone;els.status.textContent=message;
  }
  async function generate(){
    if(generating)return;
    const result=getResult();
    if(!result?.ready){setStatus((result?.missing||['当前信息不完整']).join('；'),'error');return}
    generating=true;latestSnapshot=result.data;
    const prefs=collectPrefs();writePrefs(prefs);
    const oldText=els.generate.textContent;
    els.generate.disabled=true;els.generate.textContent='正在生成卡片…';
    els.entryButtons.forEach(button=>button.disabled=true);els.entryLabel.textContent='正在生成卡片…';
    els.status.hidden=true;
    try{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      await loadMotherIllustration();
      const canvas=drawCard(latestSnapshot,prefs);
      const blob=await canvasToBlob(canvas);
      clearPreview();
      imageBlob=blob;imageUrl=URL.createObjectURL(blob);
      imageFile=new File([blob],safeFileName(latestSnapshot),{type:'image/png'});
      els.image.src=imageUrl;els.image.width=1080;els.image.height=1440;
      els.settings.hidden=true;els.preview.hidden=false;
      let canShare=false;
      try{canShare=Boolean(navigator.share&&navigator.canShare&&navigator.canShare({files:[imageFile]}))}catch{}
      els.share.hidden=!canShare;
      els.fallback.hidden=canShare;
      els.image.focus();
    }catch(error){
      console.warn('分享卡片生成失败',error);
      setStatus('卡片生成失败，请重新尝试。原有记录不受影响。','error');
    }finally{
      generating=false;els.generate.disabled=false;els.generate.textContent=oldText;
      els.entryLabel.textContent='生成我的孕期体重卡片';refreshAvailability();
    }
  }
  function save(){
    if(!imageUrl||!latestSnapshot)return;
    const link=document.createElement('a');
    link.href=imageUrl;link.download=safeFileName(latestSnapshot);link.rel='noopener';
    document.body.appendChild(link);link.click();link.remove();
    setStatus('已准备保存 PNG 图片。iPhone 可长按预览图保存到照片。');
  }
  async function share(){
    if(!imageFile||!navigator.share)return;
    try{await navigator.share({files:[imageFile],title:'我的孕期体重曲线'})}
    catch(error){if(error?.name!=='AbortError')setStatus('当前浏览器未能打开分享面板，请保存图片后分享。','error')}
  }
  function close(){if(els.dialog?.open)els.dialog.close()}
  function init({getSnapshot}={}){
    provider=getSnapshot;
    els={
      entryButton:document.getElementById('shareCardButton'),entryAux:document.getElementById('shareCardAuxButton'),entryHint:document.getElementById('shareCardHint'),
      dialog:document.getElementById('shareCardDialog'),form:document.getElementById('sharePrivacyForm'),
      settings:document.getElementById('shareSettingsView'),preview:document.getElementById('sharePreviewView'),
      generate:document.getElementById('generateSharePreviewButton'),image:document.getElementById('shareCardImage'),
      save:document.getElementById('saveShareCardButton'),share:document.getElementById('shareImageButton'),
      regenerate:document.getElementById('regenerateShareCardButton'),closeButtons:[...document.querySelectorAll('[data-share-close]')],
      status:document.getElementById('shareCardStatus'),fallback:document.getElementById('shareFallbackHint')
    };
    els.entryButtons=[els.entryButton,els.entryAux].filter(Boolean);els.entryLabel=els.entryButton?.querySelector('span')||els.entryButton;
    document.querySelectorAll('[data-share-feature="public-link"]').forEach(control=>{control.hidden=DESIGN.features.shareCardPublicLink!==true});
    if(!els.entryButton||!els.dialog||!els.form)throw new Error('分享卡片界面缺失');
    els.entryButtons.forEach(button=>button.addEventListener('click',showSettings));
    els.generate.addEventListener('click',generate);
    els.save.addEventListener('click',save);
    els.share.addEventListener('click',share);
    els.regenerate.addEventListener('click',()=>{els.preview.hidden=true;els.settings.hidden=false;els.status.hidden=true;els.generate.focus()});
    els.closeButtons.forEach(button=>button.addEventListener('click',close));
    els.dialog.addEventListener('click',event=>{if(event.target===els.dialog)close()});
    const openFullPreview=()=>{if(imageUrl)window.open(imageUrl,'_blank','noopener')};
    els.image.addEventListener('click',openFullPreview);
    els.image.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openFullPreview()}});
    els.dialog.addEventListener('close',()=>{
      els.status.hidden=true;clearPreview();els.preview.hidden=true;els.settings.hidden=false;
    });
    loadMotherIllustration();
    refreshAvailability();
  }
  window.PregnancyShareCard={init,refreshAvailability};
})();
