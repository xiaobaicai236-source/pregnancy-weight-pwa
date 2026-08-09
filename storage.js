window.PregnancyStorage = (() => {
  const D=window.PregnancyData;
  const KEY=D.storageKey;
  const C=D.constraints;
  const defaults=()=>({
    preWeight:D.defaultPrePregnancyWeight,
    heightCm:D.defaultHeightCm,
    plurality:D.defaultPlurality,
    pluralityConfirmed:false,
    hasPregnancyComplication:false,
    hasDoctorTarget:false,
    doctorPlanEnabled:true,
    doctorPlanVersion:1,
    doctorTargets:[],
    week:D.defaultWeek,
    day:D.defaultDay,
    currentWeight:'',
    records:[],
    ignoredRecordCount:0
  });

  function optionalNumber(value,min,max){
    if(value===null || value===undefined || value==='' || typeof value==='boolean') return null;
    const number=Number(value);
    return Number.isFinite(number)&&number>=min&&number<=max?number:null;
  }
  function integer(value,min,max){
    const number=Number(value);
    return Number.isInteger(number)&&number>=min&&number<=max?number:null;
  }
  function expectedId(week,day){ return `${week*7+day}d`; }
  function expectedDoctorTargetId(week,day){ return `doctor-${week*7+day}d`; }
  function deriveWeekDay(gestation){
    const number=Number(gestation);
    if(!Number.isFinite(number)) return null;
    let week=Math.floor(number);
    let day=Math.round((number-week)*7);
    if(day===7){ week+=1; day=0; }
    return integer(week,D.minWeek,D.maxWeek)!==null && integer(day,0,D.maxDay)!==null ? {week,day} : null;
  }

  function normalizeRecord(raw,{allowMissingId=true}={}){
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) return {valid:false,reason:'format'};
    let week=integer(raw.week,D.minWeek,D.maxWeek);
    let day=integer(raw.day,0,D.maxDay);
    if(week===null || day===null){
      const derived=deriveWeekDay(raw.gestation);
      if(!derived) return {valid:false,reason:'gestation'};
      week=derived.week; day=derived.day;
    }
    const gestation=week+day/7;
    if(raw.gestation!==undefined && raw.gestation!==null && raw.gestation!==''){
      const supplied=Number(raw.gestation);
      if(!Number.isFinite(supplied)||Math.abs(supplied-gestation)>0.001) return {valid:false,reason:'gestation-mismatch'};
    }
    const weight=optionalNumber(raw.weight,C.minWeightKg,C.maxWeightKg);
    if(weight===null) return {valid:false,reason:'weight'};
    const generatedId=expectedId(week,day);
    let id=raw.id;
    if(id===undefined || id===null || id===''){
      if(!allowMissingId) return {valid:false,reason:'id'};
      id=generatedId;
    }
    if(typeof id!=='string'||!/^[0-9]{1,3}d$/.test(id)||id!==generatedId) return {valid:false,reason:'id'};
    const updatedAt=Number.isFinite(Number(raw.updatedAt))&&Number(raw.updatedAt)>=0?Number(raw.updatedAt):0;
    return {valid:true,record:{id,week,day,gestation,weight,updatedAt}};
  }

  function normalizeDoctorTarget(raw,{allowMissingId=true}={}){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return {valid:false,reason:'format'};
    const week=integer(raw.week,D.minWeek,D.maxWeek),day=integer(raw.day,0,D.maxDay);
    if(week===null||day===null)return {valid:false,reason:'gestation'};
    const gestation=week+day/7;
    if(raw.gestation!==undefined&&raw.gestation!==null&&raw.gestation!==''){
      const supplied=Number(raw.gestation);if(!Number.isFinite(supplied)||Math.abs(supplied-gestation)>0.001)return {valid:false,reason:'gestation-mismatch'};
    }
    const lower=optionalNumber(raw.lower,C.minWeightKg,C.maxWeightKg),upper=optionalNumber(raw.upper,C.minWeightKg,C.maxWeightKg);
    if(lower===null||upper===null||lower>upper)return {valid:false,reason:'range'};
    const hasMiddle=raw.middle!==null&&raw.middle!==undefined&&raw.middle!=='';
    const middle=hasMiddle?optionalNumber(raw.middle,C.minWeightKg,C.maxWeightKg):null;
    if(hasMiddle&&(middle===null||middle<lower||middle>upper))return {valid:false,reason:'middle'};
    const generatedId=expectedDoctorTargetId(week,day);let id=raw.id;
    if(id===undefined||id===null||id===''){if(!allowMissingId)return {valid:false,reason:'id'};id=generatedId;}
    if(typeof id!=='string'||id!==generatedId)return {valid:false,reason:'id'};
    const updatedAt=Number.isFinite(Number(raw.updatedAt))&&Number(raw.updatedAt)>=0?Number(raw.updatedAt):0;
    return {valid:true,target:{id,week,day,gestation,lower,middle,upper,updatedAt}};
  }

  function normalizeProfile(raw={}){
    const hasPreWeight=raw.preWeight!==null&&raw.preWeight!==undefined&&raw.preWeight!=='';
    const hasHeight=raw.heightCm!==null&&raw.heightCm!==undefined&&raw.heightCm!=='';
    const preWeight=optionalNumber(raw.preWeight,C.minWeightKg,C.maxWeightKg);
    const heightCm=optionalNumber(raw.heightCm,C.minHeightCm,C.maxHeightCm);
    const pluralityValid=raw.plurality==='singleton'||raw.plurality==='twins';
    const complicationValid=raw.hasPregnancyComplication==null||typeof raw.hasPregnancyComplication==='boolean';
    const doctorTargetValid=raw.hasDoctorTarget==null||typeof raw.hasDoctorTarget==='boolean';
    const doctorPlanEnabledValid=raw.doctorPlanEnabled==null||typeof raw.doctorPlanEnabled==='boolean';
    return {
      preWeight,
      heightCm,
      plurality:pluralityValid?raw.plurality:D.defaultPlurality,
      pluralityConfirmed:pluralityValid ? raw.pluralityConfirmed!==false : false,
      hasPregnancyComplication:raw.hasPregnancyComplication===true,
      hasDoctorTarget:raw.hasDoctorTarget===true,
      doctorPlanEnabled:raw.doctorPlanEnabled!==false,
      invalidPreWeight:hasPreWeight&&preWeight===null,
      invalidHeight:hasHeight&&heightCm===null,
      invalidPlurality:raw.plurality!==undefined&&!pluralityValid,
      invalidMedicalFlags:!complicationValid||!doctorTargetValid||!doctorPlanEnabledValid
    };
  }

  function sanitizeState(raw={}){
    const base=defaults();
    const profile=normalizeProfile(raw);
    const week=integer(raw.week,D.minWeek,D.maxWeek) ?? base.week;
    const day=integer(raw.day,0,D.maxDay) ?? base.day;
    const map=new Map();
    let ignoredRecordCount=0;
    (Array.isArray(raw.records)?raw.records:[]).forEach(item=>{
      const normalized=normalizeRecord(item);
      if(!normalized.valid){ ignoredRecordCount+=1; return; }
      const old=map.get(normalized.record.id);
      if(!old || normalized.record.updatedAt>=old.updatedAt) map.set(normalized.record.id,normalized.record);
      else ignoredRecordCount+=1;
    });
    const records=[...map.values()].sort((a,b)=>a.gestation-b.gestation).slice(-C.maxStoredRecords);
    const selectedRecord=records.find(record=>record.id===expectedId(week,day));
    const doctorMap=new Map();
    (Array.isArray(raw.doctorTargets)?raw.doctorTargets:[]).forEach(item=>{
      const normalized=normalizeDoctorTarget(item);if(!normalized.valid)return;
      const old=doctorMap.get(normalized.target.id);if(!old||normalized.target.updatedAt>=old.updatedAt)doctorMap.set(normalized.target.id,normalized.target);
    });
    const doctorTargets=[...doctorMap.values()].sort((a,b)=>a.gestation-b.gestation).slice(0,C.maxDoctorTargets);
    return {
      preWeight:profile.preWeight,
      heightCm:profile.heightCm,
      plurality:profile.plurality,
      pluralityConfirmed:profile.pluralityConfirmed,
      hasPregnancyComplication:profile.hasPregnancyComplication,
      hasDoctorTarget:profile.hasDoctorTarget,
      doctorPlanEnabled:profile.doctorPlanEnabled,
      doctorPlanVersion:1,
      doctorTargets,
      week,day,
      currentWeight:selectedRecord?.weight??'',
      records,
      ignoredRecordCount:ignoredRecordCount+Math.max(0,map.size-C.maxStoredRecords)
    };
  }

  function load(){
    try{ return sanitizeState(JSON.parse(localStorage.getItem(KEY)||'{}')); }
    catch{ return defaults(); }
  }
  function save(state){
    const clean=sanitizeState(state);
    const persisted={
      preWeight:clean.preWeight,heightCm:clean.heightCm,plurality:clean.plurality,
      pluralityConfirmed:clean.pluralityConfirmed,week:clean.week,day:clean.day,
      hasPregnancyComplication:clean.hasPregnancyComplication,hasDoctorTarget:clean.hasDoctorTarget,
      doctorPlanEnabled:clean.doctorPlanEnabled,doctorPlanVersion:clean.doctorPlanVersion,doctorTargets:clean.doctorTargets,
      currentWeight:clean.currentWeight,records:clean.records
    };
    localStorage.setItem(KEY,JSON.stringify(persisted));
    return clean;
  }

  function addRecord(state,week,day,weight){
    const profile=normalizeProfile(state);
    const incomplete=[week,day,weight].some(value=>value===null||value===undefined||typeof value==='boolean'||(typeof value==='string'&&value.trim()===''));
    if(incomplete)return state;
    const w=integer(week,D.minWeek,D.maxWeek), d=integer(day,0,D.maxDay);
    const value=optionalNumber(weight,C.minWeightKg,C.maxWeightKg);
    if(profile.heightCm===null||profile.preWeight===null||w===null||d===null||value===null) return state;
    const gestation=w+d/7;
    const id=expectedId(w,d);
    const record={id,week:w,day:d,gestation,weight:value,updatedAt:Date.now()};
    const records=state.records.filter(item=>item.id!==id);
    records.push(record); records.sort((a,b)=>a.gestation-b.gestation);
    return {...state,currentWeight:value,week:w,day:d,records:records.slice(-C.maxStoredRecords)};
  }
  function updateRecord(state,id,weight){
    const value=optionalNumber(weight,C.minWeightKg,C.maxWeightKg);
    if(value===null) return state;
    const records=state.records.map(record=>record.id===id?{...record,weight:value,updatedAt:Date.now()}:record);
    const selected=records.find(record=>record.id===expectedId(state.week,state.day));
    return {...state,records,currentWeight:selected?.weight??''};
  }
  function deleteRecord(state,id){
    const records=state.records.filter(record=>record.id!==id);
    const selected=records.find(record=>record.id===expectedId(state.week,state.day));
    return {...state,records,currentWeight:selected?.weight??''};
  }
  function clearRecords(state){ return {...state,currentWeight:'',records:[]}; }
  function upsertDoctorTarget(state,target){
    const normalized=normalizeDoctorTarget(target);if(!normalized.valid)return {state,valid:false,reason:normalized.reason,replaced:false};
    const replaced=(state.doctorTargets||[]).some(item=>item.id===normalized.target.id);
    const nextTarget={...normalized.target,updatedAt:Date.now()};
    const doctorTargets=(state.doctorTargets||[]).filter(item=>item.id!==nextTarget.id);doctorTargets.push(nextTarget);doctorTargets.sort((a,b)=>a.gestation-b.gestation);
    return {state:{...state,doctorTargets:doctorTargets.slice(0,C.maxDoctorTargets)},valid:true,target:nextTarget,replaced};
  }
  function deleteDoctorTarget(state,id){return {...state,doctorTargets:(state.doctorTargets||[]).filter(target=>target.id!==id)};}
  function clearDoctorTargets(state){return {...state,doctorTargets:[]};}
  function replaceData(statePatch){ const next=save(statePatch); return next; }

  function makeBackupPayload(state){
    const clean=sanitizeState(state);
    const p=PregnancyCalculator.profile(clean.preWeight,clean.heightCm,clean.plurality);
    return {
      schema:'pregnancy-weight-pwa-backup',version:3,appVersion:D.appVersion,
      exportedAt:new Date().toISOString(),
      data:{
        preWeight:clean.preWeight,heightCm:clean.heightCm,plurality:clean.plurality,
        pluralityConfirmed:clean.pluralityConfirmed,bmi:p.bmi===null?null:Number(p.bmi.toFixed(2)),
        hasPregnancyComplication:clean.hasPregnancyComplication,hasDoctorTarget:clean.hasDoctorTarget,
        doctorPlanEnabled:clean.doctorPlanEnabled,doctorPlanVersion:clean.doctorPlanVersion,
        doctorTargets:clean.doctorTargets.map(target=>({...target})),
        week:clean.week,day:clean.day,records:clean.records.map(record=>({...record}))
      }
    };
  }

  function validateBackup(payload){
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.schema!=='pregnancy-weight-pwa-backup') throw new Error('不是有效的孕期体重备份文件');
    if(payload.version!==undefined && ![1,2,3].includes(Number(payload.version))) throw new Error('备份版本不受支持');
    const raw=payload.data;
    if(!raw||typeof raw!=='object'||Array.isArray(raw)) throw new Error('备份缺少数据');
    if(!Array.isArray(raw.records)||raw.records.length>C.maxImportRecords) throw new Error('历史记录格式或数量无效');
    const profile=normalizeProfile(raw);
    if(profile.invalidPreWeight) throw new Error('孕前体重超出允许范围');
    if(profile.invalidHeight) throw new Error('身高超出允许范围');
    if(profile.invalidPlurality) throw new Error('胎数取值无效');
    if(profile.invalidMedicalFlags) throw new Error('个体化情况取值无效');
    if(raw.doctorPlanVersion!==undefined&&Number(raw.doctorPlanVersion)!==1)throw new Error('医生目标数据版本不受支持');
    if(raw.doctorTargets!==undefined&&(!Array.isArray(raw.doctorTargets)||raw.doctorTargets.length>C.maxDoctorTargets))throw new Error('医生目标格式或数量无效');
    const week=integer(raw.week,D.minWeek,D.maxWeek);
    const day=integer(raw.day,0,D.maxDay);
    if(week===null||day===null) throw new Error('孕周必须为1–40周、0–6天');
    const records=[];
    const seen=new Map();
    let invalid=0,skipped=0;
    raw.records.forEach(item=>{
      const normalized=normalizeRecord(item);
      if(!normalized.valid){ invalid+=1; return; }
      const old=seen.get(normalized.record.id);
      if(old){
        skipped+=1;
        if(normalized.record.updatedAt>=old.updatedAt) seen.set(normalized.record.id,normalized.record);
      }else seen.set(normalized.record.id,normalized.record);
    });
    records.push(...seen.values()); records.sort((a,b)=>a.gestation-b.gestation);
    if(raw.records.length>0&&records.length===0) throw new Error('备份中没有可导入的有效记录');
    const legacyPlurality=raw.plurality===undefined;
    const doctorSeen=new Map();let doctorInvalid=0,doctorSkipped=0;
    (Array.isArray(raw.doctorTargets)?raw.doctorTargets:[]).forEach(item=>{
      const normalized=normalizeDoctorTarget(item);if(!normalized.valid){doctorInvalid+=1;return;}
      const old=doctorSeen.get(normalized.target.id);
      if(old){doctorSkipped+=1;if(normalized.target.updatedAt>=old.updatedAt)doctorSeen.set(normalized.target.id,normalized.target);}
      else doctorSeen.set(normalized.target.id,normalized.target);
    });
    const doctorTargets=[...doctorSeen.values()].sort((a,b)=>a.gestation-b.gestation);
    return {
      data:{
        preWeight:profile.preWeight,heightCm:profile.heightCm,
        plurality:legacyPlurality?'singleton':profile.plurality,
        pluralityConfirmed:legacyPlurality?false:profile.pluralityConfirmed,
        hasPregnancyComplication:profile.hasPregnancyComplication,
        hasDoctorTarget:profile.hasDoctorTarget,
        doctorPlanEnabled:profile.doctorPlanEnabled,
        doctorPlanVersion:1,
        doctorTargets,
        week,day,records
      },
      stats:{invalid,skipped,doctorInvalid,doctorSkipped},
      warnings:[
        ...(raw.heightCm===undefined?['旧版备份未包含身高，请补充设置']:[]),
        ...(legacyPlurality?['旧版备份已暂按单胎处理，请确认胎数']:[])
      ]
    };
  }

  function mergeRecords(current,incoming){
    const map=new Map((current||[]).map(record=>[record.id,record]));
    let merged=0,skipped=0;
    (incoming||[]).forEach(record=>{
      const old=map.get(record.id);
      if(!old){map.set(record.id,record);merged+=1;return;}
      if(record.updatedAt>old.updatedAt){map.set(record.id,record);merged+=1;}
      else skipped+=1;
    });
    const all=[...map.values()].sort((a,b)=>a.gestation-b.gestation);
    const overflow=Math.max(0,all.length-C.maxStoredRecords);
    return {records:all.slice(-C.maxStoredRecords),stats:{merged,skipped:skipped+overflow}};
  }

  function mergeDoctorTargets(current,incoming){
    const map=new Map((current||[]).map(target=>[target.id,target]));let merged=0,skipped=0;
    (incoming||[]).forEach(target=>{const old=map.get(target.id);if(!old||target.updatedAt>old.updatedAt){map.set(target.id,target);merged+=1;}else skipped+=1;});
    return {targets:[...map.values()].sort((a,b)=>a.gestation-b.gestation).slice(0,C.maxDoctorTargets),stats:{merged,skipped}};
  }

  return {load,save,addRecord,updateRecord,deleteRecord,clearRecords,upsertDoctorTarget,deleteDoctorTarget,clearDoctorTargets,replaceData,sanitizeState,normalizeRecord,normalizeDoctorTarget,makeBackupPayload,validateBackup,mergeRecords,mergeDoctorTargets,expectedId,expectedDoctorTargetId};
})();
