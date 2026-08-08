(() => {
  const $ = id => document.getElementById(id);
  const els = {
    week:$('weekInput'), day:$('dayInput'), weight:$('weightInput'), target:$('targetWeight'), range:$('weightRange'), baseLabel:$('baseWeightLabel'),
    baseButton:$('baseWeightButton'), dialog:$('settingsDialog'), baseInput:$('baseWeightInput'), saveBase:$('saveBaseWeightButton'), saveState:$('saveState'),
    chart:$('weightChart'), chartWrap:$('chartWrap'), chartEmpty:$('chartEmpty'), chartHeadline:$('chartHeadline'), historyCard:$('historyCard'), historyList:$('historyList'), clear:$('clearHistoryButton'),
    tooltip:$('chartTooltip'), tooltipWeek:$('tooltipWeek'), tooltipWeight:$('tooltipWeight'), trendGrid:$('trendGrid'), sinceLast:$('sinceLastValue'), sinceLastMeta:$('sinceLastMeta'), fourWeek:$('fourWeekValue'), fourWeekMeta:$('fourWeekMeta'),
    historyCount:$('historyCount'), historyToggle:$('historyToggle'), recordDialog:$('recordDialog'), recordDialogWeek:$('recordDialogWeek'), recordWeight:$('recordWeightInput'), saveRecord:$('saveRecordButton'), deleteRecord:$('deleteRecordButton'),
    insightGrid:$('insightGrid'), totalGain:$('totalGainValue'), totalGainMeta:$('totalGainMeta'), position:$('positionValue'), positionMeta:$('positionMeta'), paceStatus:$('paceStatusValue'), paceStatusMeta:$('paceStatusMeta'), chartDetail:$('chartDetail'), chartDetailWeek:$('chartDetailWeek'), chartDetailWeight:$('chartDetailWeight'), chartDetailMeta:$('chartDetailMeta'), installSheet:$('installSheet'), installHintButton:$('installHintButton'), installSheetClose:$('installSheetClose'), exportBackup:$('exportBackupButton'), importBackup:$('importBackupButton'), backupFile:$('backupFileInput'), backupStatus:$('backupStatus')
  };
  let state = PregnancyStorage.load();
  let saveTimer, tooltipTimer, editingId = null, showAllHistory = false;

  function hydrate(){els.week.value=state.week;els.day.value=state.day;els.weight.value=state.currentWeight||'';els.baseInput.value=state.preWeight;els.baseLabel.textContent=Number(state.preWeight).toFixed(1)}
  function validInputs(){let w=Math.min(42,Math.max(4,+els.week.value||25));let d=Math.min(6,Math.max(0,+els.day.value||0));els.week.value=w;els.day.value=d;return {w,d}}
  function fmtDelta(v){const n=Number(v);return `${n>0?'+':''}${n.toFixed(1)} kg`}
  function paceAnalysis(records){
    const sorted=[...records].sort((a,b)=>a.gestation-b.gestation);
    if(sorted.length<2)return null;
    const latest=sorted.at(-1);
    const windowStart=latest.gestation-4;
    const inWindow=sorted.filter(r=>r.gestation>=windowStart);
    const start=(inWindow.length>=2?inWindow[0]:sorted.at(-2));
    const span=latest.gestation-start.gestation;
    if(span<=0)return null;
    const weekly=(latest.weight-start.weight)/span;
    const c=PregnancyData.curve;
    let low,high;
    if(latest.gestation>c.firstTrimesterEndWeek){
      low=c.laterWeeklyGainLow; high=c.laterWeeklyGainHigh;
    }else{
      low=0; high=c.firstTrimesterGainHigh/Math.max(1,c.firstTrimesterEndWeek-PregnancyData.minWeek);
    }
    const status=weekly<low?'偏慢':weekly>high?'偏快':'参考范围内';
    return {weekly,low,high,status,days:Math.round(span*7)};
  }
  function renderInsights(rec){
    const current=Number(els.weight.value);
    if(!Number.isFinite(current)||current<30||current>200){
      els.totalGain.textContent='--'; els.totalGainMeta.textContent='输入当前体重后显示';
      els.position.textContent='--'; els.position.dataset.status=''; els.positionMeta.textContent='当前孕周参考';
    }else{
      const gain=current-state.preWeight;
      els.totalGain.textContent=fmtDelta(gain);
      const targetGain=rec.target-state.preWeight;
      els.totalGainMeta.textContent=`本周推荐累计约 +${targetGain.toFixed(1)} kg`;
      const diff=current-rec.target;
      const within=current>=rec.low&&current<=rec.high;
      els.position.textContent=within?'参考范围内':diff>0?'高于参考':'低于参考';
      els.position.dataset.status=within?'ok':diff>0?'high':'low';
      if(Math.abs(diff)<0.05){
        els.positionMeta.textContent=`接近推荐线 · 范围 ${rec.low.toFixed(1)}–${rec.high.toFixed(1)}`;
      }else{
        els.positionMeta.textContent=`${Math.abs(diff).toFixed(1)} kg ${diff>0?'高于':'低于'}推荐线 · 范围 ${rec.low.toFixed(1)}–${rec.high.toFixed(1)}`;
      }
    }
    const pace=paceAnalysis(state.records);
    if(!pace){
      els.paceStatus.textContent='--'; els.paceStatus.dataset.status='';
      els.paceStatusMeta.textContent='至少需要两条记录';
    }else{
      els.paceStatus.textContent=pace.status;
      els.paceStatus.dataset.status=pace.status==='参考范围内'?'ok':pace.status==='偏快'?'high':'low';
      els.paceStatusMeta.textContent=`${pace.weekly>=0?'+':''}${pace.weekly.toFixed(2)} kg/周 · 参考 ${pace.low.toFixed(2)}–${pace.high.toFixed(2)}`;
    }
  }
  function renderEnhancedChart(){
    const canvas=$('weightChart');
    if(!canvas || !window.PregnancyChart)return;
    const currentWeek=state.week + state.day/7;
    PregnancyChart.drawChart(canvas,{
      records:state.records,
      currentWeek,
      minWeek:PregnancyData.minWeek,
      maxWeek:PregnancyData.maxWeek,
      recommendationAtWeek:(w)=>PregnancyCalculator.recommendation(state.preWeight,w)
    });
  }
  function isStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function isIOS(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
  function setupInstallUX(){
    if(!els.installHintButton)return;
    if(isStandalone()){
      els.installHintButton.hidden=true;
      if(els.installSheet)els.installSheet.hidden=true;
      return;
    }
    els.installHintButton.addEventListener('click',()=>{
      if(els.installSheet)els.installSheet.hidden=false;
    });
    els.installSheetClose?.addEventListener('click',()=>{
      els.installSheet.hidden=true;
    });
    if(!isIOS()) els.installHintButton.textContent='安装说明';
  }
  function setupInputPolish(){
    const inputs=[els.weight, els.recordWeight].filter(Boolean);
    inputs.forEach(input=>{
      input.addEventListener('focus',()=>setTimeout(()=>input.select?.(),60));
      input.addEventListener('keydown',(e)=>{
        if(e.key==='Enter'){ input.blur(); }
      });
    });
  }
  function makeBackupPayload(){
    return {
      schema:"pregnancy-weight-pwa-backup",
      version:1,
      appVersion:PregnancyData.appVersion,
      exportedAt:new Date().toISOString(),
      data:{
        preWeight:state.preWeight,
        week:state.week,
        day:state.day,
        records:[...state.records]
      }
    };
  }
  function showBackupStatus(message, tone='ok'){
    if(!els.backupStatus)return;
    els.backupStatus.hidden=false;
    els.backupStatus.dataset.tone=tone;
    els.backupStatus.textContent=message;
    clearTimeout(showBackupStatus._timer);
    showBackupStatus._timer=setTimeout(()=>{ els.backupStatus.hidden=true; },4500);
  }
  function exportBackup(){
    const payload=makeBackupPayload();
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const stamp=new Date().toISOString().slice(0,10);
    a.href=url;
    a.download=`pregnancy-weight-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showBackupStatus(`已生成备份 · ${state.records.length} 条记录`);
  }
  function validateBackup(payload){
    if(!payload || payload.schema!=='pregnancy-weight-pwa-backup') throw new Error('不是有效的孕期体重备份文件');
    if(!payload.data || typeof payload.data!=='object') throw new Error('备份缺少数据');
    const d=payload.data;
    if(!Number.isFinite(Number(d.preWeight))) throw new Error('孕前体重数据无效');
    if(!Number.isFinite(Number(d.week)) || !Number.isFinite(Number(d.day))) throw new Error('孕周数据无效');
    if(!Array.isArray(d.records)) throw new Error('历史记录格式无效');
    const cleaned=d.records.map(r=>{
      const gestation=Number(r.gestation), weight=Number(r.weight);
      if(!Number.isFinite(gestation)||!Number.isFinite(weight)) throw new Error('备份中存在无效记录');
      return {...r,gestation,weight};
    });
    return {
      preWeight:Number(d.preWeight),
      week:Number(d.week),
      day:Number(d.day),
      records:cleaned
    };
  }
  function mergeRecords(current,incoming){
    const map=new Map();
    [...current,...incoming].forEach(r=>{
      const key=Number(r.gestation).toFixed(4);
      const old=map.get(key);
      if(!old || (r.updatedAt||r.createdAt||'') >= (old.updatedAt||old.createdAt||'')) map.set(key,r);
    });
    return [...map.values()].sort((a,b)=>a.gestation-b.gestation);
  }
  async function importBackupFile(file){
    try{
      const text=await file.text();
      const parsed=JSON.parse(text);
      const incoming=validateBackup(parsed);
      const merged=mergeRecords(state.records,incoming.records);
      state.preWeight=incoming.preWeight;
      state.week=incoming.week;
      state.day=incoming.day;
      state.records=merged;
      const latest=[...state.records].sort((a,b)=>a.gestation-b.gestation).at(-1);
      state.currentWeight=latest ? latest.weight : '';
      state=PregnancyStorage.replaceData(state);
      hydrate();
      render();
      showBackupStatus(`导入完成 · 当前共 ${state.records.length} 条记录`);
    }catch(err){
      console.error(err);
      showBackupStatus(err.message||'导入失败，请检查备份文件','error');
    }finally{
      if(els.backupFile) els.backupFile.value='';
    }
  }
  function setupBackupUX(){
    els.exportBackup?.addEventListener('click',exportBackup);
    els.importBackup?.addEventListener('click',()=>els.backupFile?.click());
    els.backupFile?.addEventListener('change',()=>{
      const file=els.backupFile.files?.[0];
      if(file) importBackupFile(file);
    });
  }
  function render(){
    const {w,d}=validInputs(); const rec=PregnancyCalculator.recommendation(state.preWeight,w,d);
    els.target.textContent=rec.target.toFixed(1); els.range.textContent=`${rec.low.toFixed(1)}–${rec.high.toFixed(1)}`;
    els.chartHeadline.textContent=`${w}周${d?d+'天':''} · 参考 ${rec.target.toFixed(1)} kg`;
    const curve=PregnancyCalculator.curve(state.preWeight); PregnancyChart.draw({curve,records:state.records,currentGestation:rec.gestation});
    els.chartEmpty.hidden=state.records.length>0; renderInsights(rec); renderTrends(); renderHistory(); renderEnhancedChart();
  }
  function renderTrends(){
    const records=[...state.records].sort((a,b)=>a.gestation-b.gestation); els.trendGrid.hidden=records.length<2; if(records.length<2)return;
    const latest=records.at(-1), prev=records.at(-2), delta=latest.weight-prev.weight, weeks=Math.max(.01,latest.gestation-prev.gestation);
    els.sinceLast.textContent=fmtDelta(delta); els.sinceLast.className=delta>0?'trend-up':delta<0?'trend-down':''; els.sinceLastMeta.textContent=`距上次 ${Math.max(1,Math.round(weeks*7))} 天`;
    const cutoff=latest.gestation-4; const candidates=records.filter(r=>r.gestation>=cutoff); const start=candidates[0]||records[0];
    if(start && start.id!==latest.id){const dw=latest.gestation-start.gestation, gain=latest.weight-start.weight, weekly=gain/dw;els.fourWeek.textContent=`${weekly>0?'+':''}${weekly.toFixed(2)} kg/周`;els.fourWeek.className=weekly>0?'trend-up':weekly<0?'trend-down':'';els.fourWeekMeta.textContent=`${Math.round(dw*7)} 天内共 ${fmtDelta(gain)}`}
    else{els.fourWeek.textContent='--';els.fourWeek.className='';els.fourWeekMeta.textContent='暂无足够记录'}
  }
  function renderHistory(){
    const records=[...state.records].sort((a,b)=>b.gestation-a.gestation); els.historyCard.hidden=!records.length; els.historyCount.textContent=`${records.length} 条`;
    const list=showAllHistory?records:records.slice(0,6); els.historyToggle.hidden=records.length<=6; els.historyToggle.textContent=showAllHistory?'收起':'查看全部';
    els.historyList.innerHTML=list.map((r,i)=>{const older=records[i+1];const delta=older?r.weight-older.weight:null;return `<button class="history-item" data-id="${r.id}" type="button"><div class="history-left"><i class="history-bullet"></i><div><span>${r.week}周${r.day?`${r.day}天`:''}</span><small>${delta===null?'首次记录':`较上次 ${fmtDelta(delta)}`}</small></div></div><div class="history-value"><strong>${Number(r.weight).toFixed(1)} kg</strong><span>›</span></div></button>`}).join('')
  }
  function persistCurrent(){
    const {w,d}=validInputs(); const value=+els.weight.value;
    if(Number.isFinite(value)&&value>=30&&value<=200){state=PregnancyStorage.addRecord(state,w,d,value);PregnancyStorage.save(state);flashSaved()}
    else{state={...state,week:w,day:d,currentWeight:els.weight.value};PregnancyStorage.save(state)} render();
  }
  function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(persistCurrent,320)}
  function flashSaved(){els.saveState.textContent='已保存到本机';els.saveState.classList.add('saved');setTimeout(()=>{els.saveState.textContent='输入后自动保存到本机';els.saveState.classList.remove('saved')},1300)}
  function showTooltip(event){const p=PregnancyChart.nearest(event.clientX,event.clientY);if(!p){hideTooltip();return}els.tooltipWeek.textContent=`${p.week}周${p.day?`${p.day}天`:''}`;els.tooltipWeight.textContent=`${Number(p.weight).toFixed(1)} kg`;const rect=els.chart.getBoundingClientRect(),wrap=els.chartWrap.getBoundingClientRect();els.tooltip.style.left=`${p.x+rect.left-wrap.left}px`;els.tooltip.style.top=`${p.y+rect.top-wrap.top}px`;els.tooltip.hidden=false;clearTimeout(tooltipTimer);tooltipTimer=setTimeout(hideTooltip,2200)}
  function hideTooltip(){els.tooltip.hidden=true}
  function openRecord(id){const r=state.records.find(x=>x.id===id);if(!r)return;editingId=id;els.recordDialogWeek.textContent=`${r.week}周${r.day?`${r.day}天`:''}`;els.recordWeight.value=Number(r.weight).toFixed(1);els.recordDialog.showModal()}

  hydrate();
  PregnancyChart.init(els.chart);
  setupInstallUX();
  setupInputPolish();
  setupBackupUX();
  render();
  ['input','change'].forEach(evt=>{els.week.addEventListener(evt,scheduleSave);els.day.addEventListener(evt,scheduleSave);els.weight.addEventListener(evt,scheduleSave)});
  els.baseButton.addEventListener('click',()=>{els.baseInput.value=state.preWeight;els.dialog.showModal()});
  els.saveBase.addEventListener('click',e=>{e.preventDefault();const v=+els.baseInput.value;if(Number.isFinite(v)&&v>=30&&v<=200){state={...state,preWeight:v};PregnancyStorage.save(state);els.baseLabel.textContent=v.toFixed(1);els.dialog.close();render();flashSaved()}});
  els.clear.addEventListener('click',()=>{if(confirm('清空所有体重记录？')){state=PregnancyStorage.clearRecords(state);PregnancyStorage.save(state);els.weight.value='';showAllHistory=false;render()}});
  els.historyToggle.addEventListener('click',()=>{showAllHistory=!showAllHistory;renderHistory()});
  els.historyList.addEventListener('click',e=>{const item=e.target.closest('.history-item');if(item)openRecord(item.dataset.id)});
  els.saveRecord.addEventListener('click',e=>{e.preventDefault();const v=+els.recordWeight.value;if(editingId&&Number.isFinite(v)&&v>=30&&v<=200){state=PregnancyStorage.updateRecord(state,editingId,v);PregnancyStorage.save(state);hydrate();els.recordDialog.close();render();flashSaved()}});
  els.deleteRecord.addEventListener('click',()=>{if(editingId&&confirm('删除这条体重记录？')){state=PregnancyStorage.deleteRecord(state,editingId);PregnancyStorage.save(state);hydrate();els.recordDialog.close();render()}});
  [els.dialog,els.recordDialog].forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));
  els.chartWrap.addEventListener('pointerdown',showTooltip); els.chartWrap.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')showTooltip(e)}); els.chartWrap.addEventListener('pointerleave',hideTooltip);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',()=>requestAnimationFrame(render));
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>requestAnimationFrame(render),120)});
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}))}
})();
