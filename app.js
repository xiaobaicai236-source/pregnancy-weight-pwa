(() => {
  const $=id=>document.getElementById(id);
  const D=PregnancyData, C=D.constraints;
  const els={
    week:$('weekInput'),day:$('dayInput'),weight:$('weightInput'),target:$('targetWeight'),range:$('weightRange'),targetLabel:$('targetLabel'),rangeLabel:$('rangeLabel'),baseLabel:$('baseWeightLabel'),profileNotice:$('profileNotice'),
    baseButton:$('baseWeightButton'),dialog:$('settingsDialog'),baseInput:$('baseWeightInput'),heightInput:$('heightInput'),pluralityInput:$('pluralityInput'),complicationInput:$('complicationInput'),doctorTargetInput:$('doctorTargetInput'),bmiPreview:$('bmiPreview'),profileReference:$('profileReference'),saveBase:$('saveBaseWeightButton'),saveState:$('saveState'),
    chart:$('weightChart'),chartWrap:$('chartWrap'),chartEmpty:$('chartEmpty'),chartHeadline:$('chartHeadline'),chartHint:$('chartHint'),chartGuide:$('chartGestureGuide'),legendRecommendation:$('legendRecommendation'),legendRange:$('legendRange'),historyCard:$('historyCard'),historyList:$('historyList'),clear:$('clearHistoryButton'),
    tooltip:$('chartTooltip'),tooltipType:$('tooltipType'),tooltipWeek:$('tooltipWeek'),tooltipWeight:$('tooltipWeight'),trendGrid:$('trendGrid'),sinceLast:$('sinceLastValue'),sinceLastMeta:$('sinceLastMeta'),fourWeek:$('fourWeekValue'),fourWeekMeta:$('fourWeekMeta'),
    historyCount:$('historyCount'),historyToggle:$('historyToggle'),recordDialog:$('recordDialog'),recordDialogWeek:$('recordDialogWeek'),recordWeight:$('recordWeightInput'),saveRecord:$('saveRecordButton'),deleteRecord:$('deleteRecordButton'),
    totalGain:$('totalGainValue'),totalGainMeta:$('totalGainMeta'),position:$('positionValue'),positionMeta:$('positionMeta'),paceStatus:$('paceStatusValue'),paceStatusMeta:$('paceStatusMeta'),exportBackup:$('exportBackupButton'),importBackup:$('importBackupButton'),backupFile:$('backupFileInput'),backupStatus:$('backupStatus'),
    installPanel:$('installPanel'),installMessage:$('installMessage'),installButton:$('installAppButton'),dismissInstall:$('dismissInstallButton')
  };
  let state=PregnancyStorage.load();
  let tooltipTimer,editingId=null,showAllHistory=false,deferredInstallPrompt=null,weightDirty=false;
  const INSTALL_DISMISS_KEY='pregnancy-weight-install-dismissed-at';
  const INSTALL_COOLDOWN_MS=14*24*60*60*1000;
  const SAVE_GUIDANCE='孕周和当前体重填写完整后自动保存';
  const PROFILE_REQUIRED='请先完成孕前设置：身高和孕前体重。';
  const CHART_GUIDE_KEY='pregnancy-chart-guide-seen-v1';

  const medicalState=()=>({hasPregnancyComplication:state.hasPregnancyComplication,hasDoctorTarget:state.hasDoctorTarget});
  const currentProfile=()=>PregnancyCalculator.profile(state.preWeight,state.heightCm,state.plurality,medicalState());
  const validWeight=value=>Number.isFinite(Number(value))&&Number(value)>=C.minWeightKg&&Number(value)<=C.maxWeightKg;
  const completedWeight=value=>{
    const text=String(value??'').trim();
    if(!/^\d+(?:\.\d+)?$/.test(text)&&!/^\d+\.$/.test(text))return null;
    const number=Number(text);return validWeight(number)?number:null;
  };
  const fmtDelta=value=>{const n=Number(value);return `${n>0?'+':''}${n.toFixed(1)} kg`;};
  const fmtRange=range=>range?`${range.low.toFixed(1)}–${range.high.toFixed(1)} kg`:'--';

  function hydrate(){
    els.week.value=state.week;
    els.day.value=state.day;
    loadWeightForSelection({valid:true,week:state.week,day:state.day});
    syncProfileControls();
  }

  function syncProfileControls(){
    els.baseInput.value=state.preWeight??'';
    els.heightInput.value=state.heightCm??'';
    els.pluralityInput.value=state.plurality||'singleton';
    els.complicationInput.checked=state.hasPregnancyComplication===true;
    els.doctorTargetInput.checked=state.hasDoctorTarget===true;
    const profile=currentProfile();
    if(profile.preWeight===null) els.baseLabel.textContent='请输入孕前体重';
    else if(profile.heightCm===null) els.baseLabel.textContent=`孕前体重 ${profile.preWeight.toFixed(1)} kg · 补充身高`;
    else els.baseLabel.textContent=`${profile.bmiCategory.label} · BMI ${profile.bmi.toFixed(1)}`;
    renderProfileNotice(profile);
    updateBmiPreview();
  }

  function renderProfileNotice(profile){
    let text='',tone='info';
    if(profile.preWeight===null){text='请先输入准妈妈孕前体重';tone='attention';}
    else if(profile.heightCm===null){text='请补充身高，以计算孕前 BMI 和个性化参考';tone='attention';}
    else if(!state.pluralityConfirmed){text='请确认单胎或双胎设置';tone='attention';}
    else if(profile.referenceReason){text=referenceMessage(profile.referenceReason);tone='attention';}
    else text=`中国标准 · ${profile.bmiCategory.label} · BMI ${profile.bmi.toFixed(1)}；孕早期逐周线为基于官方阶段范围生成的趋势参考`;
    els.profileNotice.textContent=text;
    els.profileNotice.dataset.tone=tone;
  }

  function referenceMessage(reason){
    const messages={
      twins:'当前参考曲线仅适用于单胎妊娠，双胎孕期增重目标请咨询产检医生。',
      'height-limit':'身高低于 140 cm，不生成普通参考结论，请结合产检医生意见进行个体化评价。',
      'weight-limit':'孕前体重超过 125 kg，不生成普通参考结论，请结合产检医生意见进行个体化评价。',
      complication:'存在妊娠期糖尿病或其他妊娠并发症，请遵医嘱进行个体化体重管理。',
      'doctor-target':'医生已制定个体化体重目标，请以医生建议为准。',
      preWeight:'请先输入孕前体重',
      height:'请补充身高以计算 BMI',
      gestation:'请填写完整孕周和天数'
    };
    return messages[reason]||'当前情况需要个体化评价，请咨询产检医生。';
  }

  function readInputs(){
    const weekText=els.week.value.trim(),dayText=els.day.value.trim();
    const rawWeek=weekText===''?NaN:Number(weekText),rawDay=dayText===''?NaN:Number(dayText);
    const weekValid=Number.isInteger(rawWeek)&&rawWeek>=D.minWeek&&rawWeek<=D.maxWeek;
    const dayValid=Number.isInteger(rawDay)&&rawDay>=0&&rawDay<=D.maxDay;
    return {valid:weekValid&&dayValid,week:weekValid?rawWeek:null,day:dayValid?rawDay:null};
  }

  function recordForSelection(selection){
    if(!selection.valid)return null;
    const id=PregnancyStorage.expectedId(selection.week,selection.day);
    return state.records.find(record=>record.id===id)||null;
  }

  function loadWeightForSelection(selection=readInputs()){
    weightDirty=false;
    const record=recordForSelection(selection);
    els.weight.value=record?record.weight.toFixed(1):'';
  }

  function setSaveState(message=SAVE_GUIDANCE,tone=''){
    els.saveState.textContent=message;
    els.saveState.classList.remove('saved','error');
    if(tone)els.saveState.classList.add(tone);
  }

  function unavailableRecommendation(profile){
    return {available:false,reason:'gestation',gestation:NaN,profile,totalGain:PregnancyCalculator.totalGainReference(profile)};
  }

  function updateBmiPreview(){
    const profile=PregnancyCalculator.profile(els.baseInput.value,els.heightInput.value,els.pluralityInput.value,{hasPregnancyComplication:els.complicationInput.checked,hasDoctorTarget:els.doctorTargetInput.checked});
    if(profile.preWeight===null){els.bmiPreview.textContent='请输入有效的孕前体重';els.profileReference.textContent='';return;}
    if(profile.heightCm===null){els.bmiPreview.textContent='补充身高后自动计算 BMI';els.profileReference.textContent='';return;}
    els.bmiPreview.textContent=`孕前 BMI ${profile.bmi.toFixed(1)} · ${profile.bmiCategory.label}`;
    const total=PregnancyCalculator.totalGainReference(profile);
    if(!profile.referenceEligible) els.profileReference.textContent=referenceMessage(profile.referenceReason);
    else els.profileReference.textContent=`WS/T 801—2022 全程总增重参考：${fmtRange(total)}。孕早期逐周线为基于官方 0–2 kg 阶段范围生成的趋势参考。`;
  }

  function renderInsights(recommendation,profile){
    const current=Number(els.weight.value);
    if(!validWeight(current)||profile.preWeight===null){
      els.totalGain.textContent='--';
      els.totalGainMeta.textContent=profile.preWeight===null?'请先输入孕前体重':'输入当前体重后显示';
    }else{
      els.totalGain.textContent=fmtDelta(current-profile.preWeight);
      if(recommendation.available) els.totalGainMeta.textContent=`本周估算累计约 +${(recommendation.target-profile.preWeight).toFixed(1)} kg`;
      else if(recommendation.totalGain) els.totalGainMeta.textContent=`全程参考 ${fmtRange(recommendation.totalGain)}`;
      else els.totalGainMeta.textContent=recommendation.reason==='gestation'?'填写完整孕周后显示参考':referenceMessage(recommendation.reason);
    }
    if(!validWeight(current)||!recommendation.available){
      els.position.textContent='--';els.position.dataset.status='';
      els.positionMeta.textContent=referenceMessage(recommendation.reason);
    }else{
      const diff=current-recommendation.target;
      const within=current>=recommendation.low&&current<=recommendation.high;
      els.position.textContent=within?'参考范围内':diff>0?'高于参考':'低于参考';
      els.position.dataset.status=within?'ok':diff>0?'high':'low';
      els.positionMeta.textContent=Math.abs(diff)<0.05
        ? `接近估算中位线 · 范围 ${recommendation.low.toFixed(1)}–${recommendation.high.toFixed(1)}`
        : `${Math.abs(diff).toFixed(1)} kg ${diff>0?'高于':'低于'}估算中位线 · 范围 ${recommendation.low.toFixed(1)}–${recommendation.high.toFixed(1)}`;
    }
    const pace=PregnancyCalculator.recentPace(state.records,profile);
    if(!pace.available){
      els.paceStatus.textContent='--';els.paceStatus.dataset.status='';
      els.paceStatusMeta.textContent=pace.reason==='short'?`记录间隔仅 ${pace.spanDays} 天，暂不判断`:'近4周记录不足';
    }else{
      els.paceStatus.textContent=pace.status;
      els.paceStatus.dataset.status=pace.status==='参考范围内'?'ok':pace.status==='偏快'?'high':pace.status==='偏慢'?'low':'';
      const reference=pace.weeklyReference?` · 参考 ${pace.weeklyReference[0].toFixed(2)}–${pace.weeklyReference[1].toFixed(2)}`:' · 不作医学判断';
      els.paceStatusMeta.textContent=`${pace.weekly>=0?'+':''}${pace.weekly.toFixed(2)} kg/周${reference}`;
    }
  }

  function renderTrends(profile){
    const records=[...state.records].sort((a,b)=>a.gestation-b.gestation);
    els.trendGrid.hidden=records.length===0;
    if(records.length<2){
      els.sinceLast.textContent='--';els.sinceLast.className='';els.sinceLastMeta.textContent='至少需要两条记录';
    }else{
      const latest=records.at(-1),previous=records.at(-2),delta=latest.weight-previous.weight;
      els.sinceLast.textContent=fmtDelta(delta);els.sinceLast.className=delta>0?'trend-up':delta<0?'trend-down':'';
      els.sinceLastMeta.textContent=`距上次 ${Math.max(1,Math.round((latest.gestation-previous.gestation)*7))} 天`;
    }
    const pace=PregnancyCalculator.recentPace(records,profile);
    if(!pace.available){
      els.fourWeek.textContent='--';els.fourWeek.className='';
      els.fourWeekMeta.textContent=pace.reason==='short'?`间隔 ${pace.spanDays} 天，暂不计算`:'近4周记录不足';
    }else{
      els.fourWeek.textContent=`${pace.weekly>0?'+':''}${pace.weekly.toFixed(2)} kg/周`;
      els.fourWeek.className=pace.weekly>0?'trend-up':pace.weekly<0?'trend-down':'';
      els.fourWeekMeta.textContent=`最近 ${pace.spanDays} 天 · 仅用于趋势观察`;
    }
  }

  function renderEnhancedChart(recommendation){
    PregnancyChart.clearCrosshair();
    PregnancyChart.drawChart(els.chart,{
      records:state.records,
      currentWeek:recommendation.gestation,
      minWeek:D.minWeek,
      maxWeek:D.maxWeek+D.maxDay/7,
      recommendationAtWeek:recommendation.available
        ? gestation=>PregnancyCalculator.recommendationAtGestation(state.preWeight,state.heightCm,state.plurality,gestation,medicalState())
        : null
    });
  }

  function chartGuideSeen(){try{return localStorage.getItem(CHART_GUIDE_KEY)==='1';}catch{return false;}}
  function updateChartGuidance(recommendation){
    const available=recommendation.available===true;
    const desktop=window.matchMedia?.('(hover: hover) and (pointer: fine)').matches===true;
    els.chartHint.textContent=available
      ? desktop?'移动鼠标查看各孕周的推荐体重':'按住图表左右滑动，查看其他孕周的推荐体重'
      : '完成孕前设置后，可在图表中查询各孕周推荐体重';
    els.chartGuide.classList.remove('is-hiding');
    els.chartGuide.hidden=!available||chartGuideSeen();
  }
  function dismissChartGuide(){
    try{localStorage.setItem(CHART_GUIDE_KEY,'1');}catch{}
    if(els.chartGuide.hidden)return;
    const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
    if(reduceMotion){els.chartGuide.hidden=true;return;}
    els.chartGuide.classList.add('is-hiding');
    setTimeout(()=>{els.chartGuide.hidden=true;els.chartGuide.classList.remove('is-hiding');},180);
  }

  function renderHistory(){
    const records=[...state.records].sort((a,b)=>b.gestation-a.gestation);
    els.historyCard.hidden=!records.length;els.historyCount.textContent=`${records.length} 条`;
    els.historyToggle.hidden=records.length<=6;els.historyToggle.textContent=showAllHistory?'收起':'查看全部';
    els.historyList.replaceChildren();
    (showAllHistory?records:records.slice(0,6)).forEach((record,index)=>{
      const older=records[index+1],delta=older?record.weight-older.weight:null;
      const button=document.createElement('button');button.className='history-item';button.type='button';button.dataset.id=record.id;
      const left=document.createElement('div');left.className='history-left';
      const bullet=document.createElement('i');bullet.className='history-bullet';
      const copy=document.createElement('div');
      const week=document.createElement('span');week.textContent=`${record.week}周${record.day?`${record.day}天`:''}`;
      const meta=document.createElement('small');meta.textContent=delta===null?'首次记录':`较上次 ${fmtDelta(delta)}`;
      copy.append(week,meta);left.append(bullet,copy);
      const value=document.createElement('div');value.className='history-value';
      const strong=document.createElement('strong');strong.textContent=`${record.weight.toFixed(1)} kg`;
      const arrow=document.createElement('span');arrow.textContent='›';value.append(strong,arrow);
      button.append(left,value);els.historyList.append(button);
    });
  }

  function render(){
    const selection=readInputs();
    const profile=currentProfile();
    const recommendation=selection.valid
      ? PregnancyCalculator.recommendation(state.preWeight,state.heightCm,state.plurality,selection.week,selection.day,medicalState())
      : unavailableRecommendation(profile);
    els.targetLabel.textContent='推荐体重';els.rangeLabel.textContent='参考范围';
    if(recommendation.available){
      els.legendRecommendation.hidden=false;els.legendRange.hidden=false;
      els.target.textContent=recommendation.target.toFixed(1);
      els.range.textContent=`${recommendation.low.toFixed(1)}–${recommendation.high.toFixed(1)}`;
      els.chartHeadline.textContent=`${selection.week}周${selection.day?selection.day+'天':''} · 估算中位 ${recommendation.target.toFixed(1)} kg`;
    }else{
      els.legendRecommendation.hidden=true;els.legendRange.hidden=true;
      els.target.textContent='--';
      els.range.textContent='--';
      els.chartHeadline.textContent=referenceMessage(recommendation.reason);
    }
    if(state.records.length) els.chartEmpty.hidden=true;
    else{
      els.chartEmpty.hidden=false;
      els.chartEmpty.textContent=recommendation.available?'输入当前体重后，会显示你的体重记录':referenceMessage(recommendation.reason);
    }
    updateChartGuidance(recommendation);renderProfileNotice(profile);renderInsights(recommendation,profile);renderTrends(profile);renderHistory();renderEnhancedChart(recommendation);
  }

  function setupInputPolish(){
    [els.week,els.day,els.weight,els.recordWeight,els.baseInput,els.heightInput].filter(Boolean).forEach(input=>{
      input.addEventListener('focus',()=>setTimeout(()=>input.select?.(),60));
      input.addEventListener('keydown',event=>{if(event.key==='Enter')input.blur();});
    });
  }
  function showBackupStatus(message,tone='ok'){
    els.backupStatus.hidden=false;els.backupStatus.dataset.tone=tone;els.backupStatus.textContent=message;
    clearTimeout(showBackupStatus.timer);showBackupStatus.timer=setTimeout(()=>{els.backupStatus.hidden=true;},7000);
  }
  function exportBackup(){
    const payload=PregnancyStorage.makeBackupPayload(state);
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`pregnancy-weight-v1.8.0-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    showBackupStatus(`已生成新版备份 · ${state.records.length} 条记录`);
  }
  async function importBackupFile(file){
    try{
      if(file.size>C.maxBackupBytes) throw new Error('备份文件过大，无法导入');
      const parsed=JSON.parse(await file.text());
      const checked=PregnancyStorage.validateBackup(parsed);
      const merge=PregnancyStorage.mergeRecords(state.records,checked.data.records);
      const next={...state,...checked.data,records:merge.records};
      state=PregnancyStorage.replaceData(next);hydrate();render();
      const skipped=checked.stats.skipped+merge.stats.skipped;
      const warning=checked.warnings.length?` · ${checked.warnings.join('；')}`:'';
      showBackupStatus(`导入完成：合并/更新 ${merge.stats.merged}，跳过 ${skipped}，无效 ${checked.stats.invalid}${warning}`,checked.warnings.length?'warning':'ok');
    }catch(error){
      console.error(error);showBackupStatus(error.message||'导入失败，现有数据未更改','error');
    }finally{els.backupFile.value='';}
  }
  function setupBackupUX(){
    els.exportBackup.addEventListener('click',exportBackup);
    els.importBackup.addEventListener('click',()=>els.backupFile.click());
    els.backupFile.addEventListener('change',()=>{const file=els.backupFile.files?.[0];if(file)importBackupFile(file);});
  }
  function detectInstallEnvironment({userAgent='',platform='',maxTouchPoints=0}={}){
    const ua=String(userAgent),isIOS=/iPad|iPhone|iPod/i.test(ua)||(platform==='MacIntel'&&maxTouchPoints>1);
    const isAndroid=/Android/i.test(ua),isMobile=isIOS||isAndroid||/Mobi/i.test(ua);
    const isEmbedded=/MicroMessenger|WeChat|QQ\/|XiaoHongShu|XHS\//i.test(ua)||/MQQBrowser/i.test(ua);
    return {isIOS,isAndroid,isMobile,isEmbedded};
  }
  function isStandalone(){
    return navigator.standalone===true||['standalone','fullscreen','minimal-ui','window-controls-overlay'].some(mode=>window.matchMedia?.(`(display-mode: ${mode})`).matches);
  }
  function installPromptDismissed(){
    try{const dismissedAt=Number(localStorage.getItem(INSTALL_DISMISS_KEY));return Number.isFinite(dismissedAt)&&Date.now()-dismissedAt<INSTALL_COOLDOWN_MS;}
    catch{return false;}
  }
  function hideInstallPanel(){els.installPanel.hidden=true;els.installButton.hidden=true;}
  function showInstallPanel({message,native=false,buttonLabel='安装到手机'}){
    if(isStandalone()||installPromptDismissed())return;
    els.installMessage.textContent=message;els.installButton.textContent=buttonLabel;els.installButton.hidden=!native;els.installPanel.hidden=false;
  }
  function setupInstallUX(){
    if(isStandalone()){hideInstallPanel();return;}
    const environment=detectInstallEnvironment({userAgent:navigator.userAgent||'',platform:navigator.platform||'',maxTouchPoints:navigator.maxTouchPoints||0});
    if(environment.isEmbedded){
      const browserName=environment.isIOS?'Safari':environment.isAndroid?'系统浏览器':'系统浏览器';
      showInstallPanel({message:`当前浏览器可能不支持添加到桌面，请点击右上角菜单，选择“在浏览器中打开”。请使用${browserName}打开。`});
    }else if(environment.isIOS){
      showInstallPanel({message:'在浏览器中点击分享按钮，选择“添加到主屏幕”，即可像 App 一样使用。如果没有看到该选项，请使用 Safari 打开。'});
    }else if(environment.isAndroid){
      showInstallPanel({message:'如浏览器支持，可在浏览器菜单中选择“添加到桌面”或“安装应用”。'});
    }

    window.addEventListener('beforeinstallprompt',event=>{
      event.preventDefault();deferredInstallPrompt=event;
      if(environment.isEmbedded||environment.isIOS)return;
      showInstallPanel({message:environment.isMobile?'安装后可从手机桌面直接打开，像 App 一样使用。':'安装后可从电脑桌面或应用列表直接打开。',native:true,buttonLabel:environment.isMobile?'安装到手机':'安装到电脑'});
    });
    window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;hideInstallPanel();});
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',event=>{if(event.matches)hideInstallPanel();});
    els.installButton.addEventListener('click',async()=>{
      if(!deferredInstallPrompt){hideInstallPanel();return;}
      const prompt=deferredInstallPrompt;deferredInstallPrompt=null;
      await prompt.prompt();
      const choice=await prompt.userChoice;
      if(choice?.outcome!=='accepted')try{localStorage.setItem(INSTALL_DISMISS_KEY,String(Date.now()));}catch{}
      hideInstallPanel();
    });
    els.dismissInstall.addEventListener('click',()=>{try{localStorage.setItem(INSTALL_DISMISS_KEY,String(Date.now()));}catch{}hideInstallPanel();});
  }
  function persistCurrent(){
    if(!weightDirty)return;
    const profile=currentProfile(),selection=readInputs(),weightText=els.weight.value,weightValue=completedWeight(weightText);
    if(profile.heightCm===null||profile.preWeight===null){setSaveState(PROFILE_REQUIRED,'error');return;}
    if(!selection.valid||weightValue===null){setSaveState();return;}
    const next=PregnancyStorage.addRecord(state,selection.week,selection.day,weightValue);
    if(next===state){setSaveState('当前信息未通过保存校验','error');return;}
    state=PregnancyStorage.save(next);weightDirty=false;flashSaved();
    render();
  }
  function handleWeightInput(){
    weightDirty=true;render();
    const profile=currentProfile(),selection=readInputs(),weightText=els.weight.value;
    if(profile.heightCm===null||profile.preWeight===null){setSaveState(PROFILE_REQUIRED,'error');return;}
    if(!selection.valid||completedWeight(weightText)===null){setSaveState();return;}
    setSaveState();
  }
  function previewSelection(){
    const selection=readInputs();loadWeightForSelection(selection);render();
  }
  function persistSelection(){
    const selection=readInputs();
    if(selection.valid)state=PregnancyStorage.save({...state,week:selection.week,day:selection.day});
    loadWeightForSelection(selection);render();
  }
  function flashSaved(){
    setSaveState('已保存到本机','saved');
    setTimeout(()=>setSaveState(),1300);
  }
  function showTooltip(event){
    const point=PregnancyChart.nearest(event.clientX,event.clientY);
    if(!point){hideTooltip();return;}
    els.tooltipType.textContent=point.type==='recommended'?'推荐体重':'实际体重';
    els.tooltipWeek.textContent=`${point.week}周${point.day?`${point.day}天`:''}`;
    els.tooltipWeight.textContent=`${Number(point.weight).toFixed(1)} kg`;
    const rect=els.chart.getBoundingClientRect(),wrap=els.chartWrap.getBoundingClientRect();
    els.tooltip.style.left=`${Math.max(54,Math.min(wrap.width-54,point.x+rect.left-wrap.left))}px`;
    els.tooltip.style.top=`${point.y+rect.top-wrap.top}px`;els.tooltip.hidden=false;
    clearTimeout(tooltipTimer);tooltipTimer=setTimeout(hideTooltip,2600);
  }
  function hideTooltip(){els.tooltip.hidden=true;}
  let activeChartPointer=null,chartPointerStart=null;
  function beginChartInteraction(event){
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const query=PregnancyChart.showCrosshair(event.clientX,event.clientY);if(!query){showTooltip(event);return;}
    hideTooltip();dismissChartGuide();activeChartPointer=event.pointerId;chartPointerStart={x:event.clientX,y:event.clientY,moved:false};
    try{els.chartWrap.setPointerCapture(event.pointerId);}catch{}
  }
  function moveChartInteraction(event){
    if(activeChartPointer===event.pointerId&&chartPointerStart){
      if(Math.hypot(event.clientX-chartPointerStart.x,event.clientY-chartPointerStart.y)>6)chartPointerStart.moved=true;
      PregnancyChart.showCrosshair(event.clientX,event.clientY);return;
    }
    if(event.pointerType==='mouse'&&!event.buttons){hideTooltip();if(!PregnancyChart.showCrosshair(event.clientX,event.clientY))showTooltip(event);}
  }
  function finishChartInteraction(event,{showPoint=false}={}){
    if(activeChartPointer!==null&&event.pointerId!==undefined&&event.pointerId!==activeChartPointer)return;
    const shouldShowPoint=showPoint&&chartPointerStart&&!chartPointerStart.moved;
    const pointerId=activeChartPointer;activeChartPointer=null;chartPointerStart=null;PregnancyChart.clearCrosshair();
    if(pointerId!==null)try{if(els.chartWrap.hasPointerCapture(pointerId))els.chartWrap.releasePointerCapture(pointerId);}catch{}
    if(shouldShowPoint)showTooltip(event);
  }
  function openRecord(id){
    const record=state.records.find(item=>item.id===id);if(!record)return;
    editingId=id;els.recordDialogWeek.textContent=`${record.week}周${record.day?`${record.day}天`:''}`;els.recordWeight.value=record.weight.toFixed(1);els.recordDialog.showModal();
  }

  hydrate();PregnancyChart.init(els.chart);setupInputPolish();setupBackupUX();setupInstallUX();render();
  let previewTimer;
  [els.week,els.day].forEach(input=>{
    input.addEventListener('input',()=>{clearTimeout(previewTimer);previewTimer=setTimeout(()=>requestAnimationFrame(previewSelection),80);});
    input.addEventListener('change',persistSelection);input.addEventListener('blur',persistSelection);
  });
  els.weight.addEventListener('input',handleWeightInput);
  ['change','blur'].forEach(eventName=>els.weight.addEventListener(eventName,()=>{if(weightDirty)persistCurrent();}));
  els.baseButton.addEventListener('click',()=>{syncProfileControls();els.dialog.showModal();});
  [els.baseInput,els.heightInput,els.pluralityInput,els.complicationInput,els.doctorTargetInput].forEach(input=>input.addEventListener('input',updateBmiPreview));
  els.saveBase.addEventListener('click',event=>{
    event.preventDefault();
    const weight=Number(els.baseInput.value),heightRaw=els.heightInput.value.trim(),height=heightRaw===''?null:Number(heightRaw);
    if(!validWeight(weight)){els.bmiPreview.textContent='孕前体重需在 30–200 kg';return;}
    if(height!==null&&(!Number.isFinite(height)||height<C.minHeightCm||height>C.maxHeightCm)){els.bmiPreview.textContent=`身高需在 ${C.minHeightCm}–${C.maxHeightCm} cm`;return;}
    state=PregnancyStorage.save({...state,preWeight:weight,heightCm:height,plurality:els.pluralityInput.value,pluralityConfirmed:true,hasPregnancyComplication:els.complicationInput.checked,hasDoctorTarget:els.doctorTargetInput.checked});
    els.dialog.close();syncProfileControls();render();setSaveState();
  });
  els.clear.addEventListener('click',()=>{if(confirm('清空所有体重记录？此操作不会清除孕前设置。')){state=PregnancyStorage.save(PregnancyStorage.clearRecords(state));els.weight.value='';showAllHistory=false;render();}});
  els.historyToggle.addEventListener('click',()=>{showAllHistory=!showAllHistory;renderHistory();});
  els.historyList.addEventListener('click',event=>{const item=event.target.closest('.history-item');if(item)openRecord(item.dataset.id);});
  els.saveRecord.addEventListener('click',event=>{event.preventDefault();const value=Number(els.recordWeight.value);if(editingId&&validWeight(value)){state=PregnancyStorage.save(PregnancyStorage.updateRecord(state,editingId,value));hydrate();els.recordDialog.close();render();flashSaved();}});
  els.deleteRecord.addEventListener('click',()=>{if(editingId&&confirm('删除这条体重记录？')){state=PregnancyStorage.save(PregnancyStorage.deleteRecord(state,editingId));hydrate();els.recordDialog.close();render();}});
  [els.dialog,els.recordDialog].forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();}));
  els.chartWrap.addEventListener('pointerdown',beginChartInteraction);
  els.chartWrap.addEventListener('pointermove',moveChartInteraction);
  els.chartWrap.addEventListener('pointerup',event=>finishChartInteraction(event,{showPoint:true}));
  els.chartWrap.addEventListener('pointercancel',event=>finishChartInteraction(event));
  els.chartWrap.addEventListener('pointerleave',event=>{hideTooltip();finishChartInteraction(event);});
  els.chartWrap.addEventListener('lostpointercapture',event=>finishChartInteraction(event));
  window.addEventListener('blur',()=>{hideTooltip();finishChartInteraction({});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){hideTooltip();finishChartInteraction({});}});
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',()=>requestAnimationFrame(render));
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>requestAnimationFrame(render),120);});
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(registration=>registration.update().catch(()=>{})).catch(error=>console.warn('Service Worker registration failed',error)));
})();
