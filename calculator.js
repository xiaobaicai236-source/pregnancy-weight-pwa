window.PregnancyCalculator = (() => {
  const D = window.PregnancyData;
  const round1 = n => Math.round((n + Number.EPSILON) * 10) / 10;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const validNumber = (value, min, max) => {
    if(value === null || value === '' || typeof value === 'boolean') return null;
    const number=Number(value);
    return Number.isFinite(number) && number>=min && number<=max ? number : null;
  };

  function gestationalWeek(week, day=0) {
    const w = clamp(Number.isFinite(+week) ? Math.trunc(+week) : D.defaultWeek, D.minWeek, D.maxWeek);
    const d = clamp(Number.isFinite(+day) ? Math.trunc(+day) : 0, 0, D.maxDay);
    return w + d / 7;
  }

  function bmi(preWeight, heightCm){
    const weight=validNumber(preWeight,D.constraints.minWeightKg,D.constraints.maxWeightKg);
    const height=validNumber(heightCm,D.constraints.minHeightCm,D.constraints.maxHeightCm);
    if(weight===null || height===null) return null;
    return weight / ((height/100) ** 2);
  }

  function bmiCategory(value){
    if(!Number.isFinite(value)) return null;
    return D.bmiCategories.find(category=>value>=category.min && value<category.max) || null;
  }

  function profile(preWeight, heightCm, plurality='singleton',medical={}){
    const weight=validNumber(preWeight,D.constraints.minWeightKg,D.constraints.maxWeightKg);
    const height=validNumber(heightCm,D.constraints.minHeightCm,D.constraints.maxHeightCm);
    const babies=plurality==='twins'?'twins':'singleton';
    const bmiValue=weight!==null && height!==null ? bmi(weight,height) : null;
    const category=bmiCategory(bmiValue);
    const result={
      preWeight:weight,
      heightCm:height,
      plurality:babies,
      hasPregnancyComplication:medical?.hasPregnancyComplication===true,
      hasDoctorTarget:medical?.hasDoctorTarget===true,
      bmi:bmiValue,
      bmiCategory:category,
      complete:weight!==null && height!==null && Boolean(category)
    };
    result.referenceReason=referenceReason(result);
    result.referenceEligible=result.referenceReason===null;
    return result;
  }

  function referenceReason(p){
    if(p.preWeight===null)return 'preWeight';
    if(p.heightCm===null)return 'height';
    if(p.plurality==='twins')return 'twins';
    if(p.heightCm<140)return 'height-limit';
    if(p.preWeight>125)return 'weight-limit';
    if(p.hasPregnancyComplication)return 'complication';
    if(p.hasDoctorTarget)return 'doctor-target';
    return null;
  }

  function totalGainReference(profileInput){
    const p=profileInput?.bmiCategory ? profileInput : profile(profileInput?.preWeight,profileInput?.heightCm,profileInput?.plurality,profileInput);
    if(!p.referenceEligible) return null;
    const group=D.references.singleton.byBmi[p.bmiCategory.id];
    return group ? { low:group.totalGainKg[0], high:group.totalGainKg[1], sourceNote:group.sourceNote||'' } : null;
  }

  function gainAt(gestation, categoryId, type='target'){
    const reference=D.references.singleton;
    const group=reference.byBmi[categoryId];
    if(!group) return null;
    const g=clamp(Number(gestation),D.minWeek,D.maxWeek + D.maxDay/7);
    const firstLow=reference.firstTrimesterGainKg[0];
    const firstHigh=reference.firstTrimesterGainKg[1];
    const firstTarget=(firstLow+firstHigh)/2;
    let gain;
    if(g<=reference.firstTrimesterEndWeek){
      const progress=clamp((g-D.minWeek)/(reference.firstTrimesterEndWeek-D.minWeek),0,1);
      gain=(type==='low'?firstLow:type==='high'?firstHigh:firstTarget)*progress;
    }else{
      const weeklyLow=group.weeklyGainKg[0];
      const weeklyHigh=group.weeklyGainKg[1];
      const weeklyTarget=group.weeklyTargetKg;
      const first=type==='low'?firstLow:type==='high'?firstHigh:firstTarget;
      const weekly=type==='low'?weeklyLow:type==='high'?weeklyHigh:weeklyTarget;
      gain=first+(g-reference.firstTrimesterEndWeek)*weekly;
    }
    const totalLimit=type==='low'?group.totalGainKg[0]:type==='high'?group.totalGainKg[1]:(group.totalGainKg[0]+group.totalGainKg[1])/2;
    return Math.min(gain,totalLimit);
  }

  function recommendationAtGestation(preWeight,heightCm,plurality,gestationInput,medical={}){
    const p=profile(preWeight,heightCm,plurality,medical);
    const gestation=clamp(Number(gestationInput),D.minWeek,D.maxWeek+D.maxDay/7);
    const totalGain=totalGainReference(p);
    if(!p.referenceEligible) return {available:false,reason:p.referenceReason,gestation,profile:p,totalGain};
    const low=p.preWeight+gainAt(gestation,p.bmiCategory.id,'low');
    const target=p.preWeight+gainAt(gestation,p.bmiCategory.id,'target');
    const high=p.preWeight+gainAt(gestation,p.bmiCategory.id,'high');
    return {available:true,estimated:true,gestation,profile:p,totalGain,low:round1(low),target:round1(target),high:round1(high)};
  }

  function recommendation(preWeight, heightCm, plurality, week, day=0,medical={}){
    return recommendationAtGestation(preWeight,heightCm,plurality,gestationalWeek(week,day),medical);
  }

  function curve(preWeight,heightCm,plurality,start=D.minWeek,end=D.maxWeek + D.maxDay/7,step=0.5){
    const p=profile(preWeight,heightCm,plurality);
    if(!p.referenceEligible) return [];
    const out=[];
    for(let w=start;w<=end+1e-9;w+=step){
      const r=recommendationAtGestation(p.preWeight,p.heightCm,p.plurality,w,{hasPregnancyComplication:p.hasPregnancyComplication,hasDoctorTarget:p.hasDoctorTarget});
      if(r.available) out.push({week:+w.toFixed(4),low:r.low,target:r.target,high:r.high});
    }
    return out;
  }

  function recentPace(records, profileInput){
    const valid=(records||[]).filter(record=>Number.isFinite(Number(record.gestation))&&Number.isFinite(Number(record.weight))).sort((a,b)=>a.gestation-b.gestation);
    if(valid.length<2) return {available:false,reason:'records'};
    const latest=valid.at(-1);
    const windowStart=latest.gestation-D.constraints.paceWindowWeeks;
    const inWindow=valid.filter(record=>record.gestation>=windowStart && record.gestation<=latest.gestation);
    if(inWindow.length<2) return {available:false,reason:'window',count:inWindow.length};
    const start=inWindow[0];
    const spanWeeks=latest.gestation-start.gestation;
    const spanDays=Math.round(spanWeeks*7);
    if(spanDays<D.constraints.minimumPaceSpanDays) return {available:false,reason:'short',count:inWindow.length,spanDays};
    const weekly=(latest.weight-start.weight)/spanWeeks;
    const p=profileInput?.bmiCategory ? profileInput : profile(profileInput?.preWeight,profileInput?.heightCm,profileInput?.plurality,profileInput);
    const weeklyReference=p.referenceEligible && latest.gestation>D.references.singleton.firstTrimesterEndWeek
      ? D.references.singleton.byBmi[p.bmiCategory.id].weeklyGainKg
      : null;
    const status=weeklyReference ? (weekly<weeklyReference[0]?'偏慢':weekly>weeklyReference[1]?'偏快':'参考范围内') : '仅供观察';
    return {available:true,weekly,spanDays,count:inWindow.length,status,weeklyReference,start,latest};
  }

  return {gestationalWeek,bmi,bmiCategory,profile,totalGainReference,recommendation,recommendationAtGestation,curve,recentPace,round1};
})();
