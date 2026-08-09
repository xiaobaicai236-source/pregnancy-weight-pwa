const assert=require('node:assert/strict');

global.window=global;
const memory=new Map();
global.localStorage={
  getItem:key=>memory.has(key)?memory.get(key):null,
  setItem:(key,value)=>memory.set(key,String(value)),
  removeItem:key=>memory.delete(key),
  clear:()=>memory.clear()
};

require('../data.js');
require('../calculator.js');
require('../storage.js');

const D=PregnancyData,C=PregnancyCalculator,S=PregnancyStorage;
const validProfile={preWeight:51.5,heightCm:165,plurality:'singleton',pluralityConfirmed:true};
let passed=0;
function test(name,fn){fn();passed+=1;console.log(`✓ ${name}`);}
function record(week,day,weight,updatedAt=1){return {id:`${week*7+day}d`,week,day,gestation:week+day/7,weight,updatedAt};}

test('全新用户不会把 null 孕前体重当作 0',()=>{
  localStorage.clear();const state=S.load();
  assert.equal(state.preWeight,null);
  const result=C.recommendation(state.preWeight,state.heightCm,state.plurality,25,0);
  assert.equal(result.available,false);assert.equal(result.reason,'preWeight');assert.equal(result.target,undefined);
});

test('已有孕前体重但缺少身高时保留体重且不生成曲线',()=>{
  const result=C.recommendation(51.5,null,'singleton',25,0);
  assert.equal(result.available,false);assert.equal(result.reason,'height');assert.deepEqual(C.curve(51.5,null,'singleton'),[]);
});

test('中国 BMI 四分类边界正确',()=>{
  assert.equal(C.profile(45,165,'singleton').bmiCategory.id,'underweight');
  assert.equal(C.bmiCategory(18.5).id,'normal');assert.equal(C.bmiCategory(23.999).id,'normal');
  assert.equal(C.bmiCategory(24).id,'overweight');assert.equal(C.bmiCategory(27.999).id,'overweight');
  assert.equal(C.bmiCategory(28).id,'obese');
});

test('中国单胎四种 BMI 类别都能生成有限的估算范围',()=>{
  [[45,'underweight'],[60,'normal'],[75,'overweight'],[90,'obese']].forEach(([weight,id])=>{
    const result=C.recommendation(weight,165,'singleton',25,0);
    assert.equal(result.available,true);assert.equal(result.profile.bmiCategory.id,id);
    assert.ok(result.low<result.target&&result.target<result.high);
  });
});

test('双胎不套用中国单胎总增重范围或逐周曲线',()=>{
  const result=C.recommendation(60,165,'twins',25,0);
  assert.equal(result.available,false);assert.equal(result.reason,'twins');
  assert.equal(result.totalGain,null);
  assert.deepEqual(C.curve(60,165,'twins'),[]);
});

test('WS/T 801—2022 四类增重参数完整且不混用美国数据',()=>{
  const groups=D.references.singleton.byBmi;
  assert.deepEqual(groups.underweight,{totalGainKg:[11,16],weeklyTargetKg:0.46,weeklyGainKg:[0.37,0.56]});
  assert.deepEqual(groups.normal,{totalGainKg:[8,14],weeklyTargetKg:0.37,weeklyGainKg:[0.26,0.48]});
  assert.deepEqual(groups.overweight,{totalGainKg:[7,11],weeklyTargetKg:0.30,weeklyGainKg:[0.22,0.37]});
  assert.deepEqual(groups.obese,{totalGainKg:[5,9],weeklyTargetKg:0.22,weeklyGainKg:[0.15,0.30]});
  assert.deepEqual(D.references.singleton.firstTrimesterGainKg,[0,2]);
  assert.equal(D.references.twins,undefined);
});

test('身高、孕前体重、并发症和医生目标限制普通参考但保留记录能力',()=>{
  const cases=[
    [C.profile(50,139,'singleton'),'height-limit'],
    [C.profile(126,180,'singleton'),'weight-limit'],
    [C.profile(60,165,'singleton',{hasPregnancyComplication:true}),'complication'],
    [C.profile(60,165,'singleton',{hasDoctorTarget:true}),'doctor-target']
  ];
  cases.forEach(([profile,reason])=>{assert.equal(profile.referenceReason,reason);assert.equal(profile.referenceEligible,false);});
  let state=S.sanitizeState({...validProfile,heightCm:139,records:[]});
  state=S.addRecord(state,25,0,60);assert.equal(state.records.length,1);
  state=S.sanitizeState({...validProfile,hasPregnancyComplication:true,records:state.records});
  assert.equal(C.recommendation(state.preWeight,state.heightCm,state.plurality,25,0,{hasPregnancyComplication:true}).available,false);
  assert.equal(state.records.length,1);
  assert.equal(C.profile(60,140,'singleton').referenceEligible,true);
  assert.equal(C.profile(125,200,'singleton').referenceEligible,true);
});

test('孕周边界接受 1周0天 和 40周6天',()=>{
  assert.equal(C.gestationalWeek(1,0),1);assert.equal(C.gestationalWeek(40,6),40+6/7);
  let state=S.sanitizeState({...validProfile,records:[]});state=S.addRecord(state,40,6,70);
  assert.equal(state.records.length,1);assert.equal(state.records[0].id,'286d');
});

test('禁止保存 41周、42周和越界天数',()=>{
  const state=S.sanitizeState({...validProfile,records:[]});
  assert.equal(S.addRecord(state,41,0,70).records.length,0);
  assert.equal(S.addRecord(state,42,0,70).records.length,0);
  assert.equal(S.addRecord(state,40,7,70).records.length,0);
});

test('同一孕周重新输入会覆盖原记录',()=>{
  let state=S.sanitizeState({...validProfile,records:[]});state=S.addRecord(state,25,0,60);state=S.addRecord(state,25,0,61);
  assert.equal(state.records.length,1);assert.equal(state.records[0].weight,61);
});

test('存储层拒绝缺少身高或孕前体重的新增记录',()=>{
  const noProfile=S.sanitizeState({records:[]});
  const noHeight=S.sanitizeState({preWeight:51.5,records:[]});
  const noPreWeight=S.sanitizeState({heightCm:165,records:[]});
  assert.equal(S.addRecord(noProfile,25,0,60).records.length,0);
  assert.equal(S.addRecord(noHeight,25,0,60).records.length,0);
  assert.equal(S.addRecord(noPreWeight,25,0,60).records.length,0);
});

test('存储层拒绝不完整或越界的孕周天数和当前体重',()=>{
  const state=S.sanitizeState({...validProfile,records:[]});
  [[null,0,60],[25,null,60],[25,0,null],[0,0,60],[25,7,60],[25,0,20]].forEach(args=>{
    assert.equal(S.addRecord(state,...args).records.length,0);
  });
});

test('当前体重只对应当前孕周天数，不沿用最近一条记录',()=>{
  const state=S.sanitizeState({...validProfile,week:26,day:0,currentWeight:60,records:[record(25,0,60)]});
  assert.equal(state.currentWeight,'');
  const selected=S.sanitizeState({...state,week:25,day:0,currentWeight:''});
  assert.equal(selected.currentWeight,60);
});

test('保存孕周、刷新、修改孕前设置和恢复备份都不会额外新增记录',()=>{
  localStorage.clear();
  let state=S.save(S.sanitizeState({...validProfile,week:25,day:0,records:[record(25,0,60)]}));
  state=S.save({...state,week:26,day:0});
  assert.equal(state.records.length,1);assert.equal(state.currentWeight,'');
  state=S.load();assert.equal(state.records.length,1);
  state=S.save({...state,heightCm:166});assert.equal(state.records.length,1);
  const incoming=[record(28,0,62,20),record(30,0,63,21)];
  const merged=S.mergeRecords(state.records,incoming);
  state=S.replaceData({...state,week:30,day:0,records:merged.records});
  assert.equal(state.records.length,3);assert.equal(state.currentWeight,63);
});

test('清空历史记录保留孕前资料',()=>{
  const state=S.sanitizeState({preWeight:51.5,heightCm:165,plurality:'singleton',pluralityConfirmed:true,records:[record(25,0,60)]});
  const cleared=S.clearRecords(state);assert.equal(cleared.records.length,0);assert.equal(cleared.currentWeight,'');assert.equal(cleared.preWeight,51.5);assert.equal(cleared.heightCm,165);
});

test('旧版异常记录被安全跳过且不会导致加载失败',()=>{
  const state=S.sanitizeState({week:42,day:9,records:[record(25,0,60),{id:'294d',week:42,day:0,gestation:42,weight:70}]});
  assert.equal(state.week,D.defaultWeek);assert.equal(state.day,D.defaultDay);assert.equal(state.records.length,1);assert.equal(state.ignoredRecordCount,1);
});

test('近4周不足时不会借用更早记录',()=>{
  const result=C.recentPace([record(10,0,52),record(20,0,55)],C.profile(50,165,'singleton'));
  assert.equal(result.available,false);assert.equal(result.reason,'window');
});

test('记录间隔少于14天时不作速度判断',()=>{
  const result=C.recentPace([record(20,0,55),record(21,0,56)],C.profile(50,165,'singleton'));
  assert.equal(result.available,false);assert.equal(result.reason,'short');
});

test('近4周多条记录采用窗口内最早和最新记录',()=>{
  const result=C.recentPace([record(15,0,52),record(20,0,55),record(22,0,56),record(24,0,57)],C.profile(50,165,'singleton'));
  assert.equal(result.available,true);assert.equal(result.spanDays,28);assert.equal(result.count,3);assert.equal(result.weekly,0.5);
});

test('需个体化评价时近期速度只供观察且不判断偏快偏慢',()=>{
  const profile=C.profile(50,165,'singleton',{hasPregnancyComplication:true});
  const result=C.recentPace([record(20,0,55),record(22,0,56),record(24,0,57)],profile);
  assert.equal(result.available,true);assert.equal(result.weeklyReference,null);assert.equal(result.status,'仅供观察');
});

test('新版备份包含资料字段并可通过校验',()=>{
  const state=S.sanitizeState({preWeight:51.5,heightCm:165,plurality:'singleton',pluralityConfirmed:true,hasDoctorTarget:true,week:25,day:0,records:[record(25,0,58)]});
  const payload=S.makeBackupPayload(state),checked=S.validateBackup(payload);
  assert.equal(payload.version,2);assert.ok(Number.isFinite(payload.data.bmi));assert.equal(checked.data.records.length,1);assert.equal(checked.data.hasDoctorTarget,true);
});

test('旧版备份缺少身高和胎数时仍可导入并给出提醒',()=>{
  const checked=S.validateBackup({schema:'pregnancy-weight-pwa-backup',version:1,data:{preWeight:51.5,week:25,day:0,records:[record(25,0,58)]}});
  assert.equal(checked.data.heightCm,null);assert.equal(checked.data.plurality,'singleton');assert.equal(checked.data.pluralityConfirmed,false);assert.equal(checked.data.hasPregnancyComplication,false);assert.equal(checked.data.hasDoctorTarget,false);assert.equal(checked.warnings.length,2);
});

test('恶意或不一致记录仅计为无效，不进入数据',()=>{
  const checked=S.validateBackup({schema:'pregnancy-weight-pwa-backup',version:2,data:{preWeight:51.5,heightCm:165,plurality:'singleton',week:25,day:0,records:[record(25,0,58),{id:'<img src=x onerror=alert(1)>',week:25,day:1,gestation:25.2,weight:59}]}});
  assert.equal(checked.data.records.length,1);assert.equal(checked.stats.invalid,1);
});

test('无效资料会拒绝整个备份',()=>{
  assert.throws(()=>S.validateBackup({schema:'pregnancy-weight-pwa-backup',version:2,data:{preWeight:0,heightCm:165,plurality:'singleton',week:25,day:0,records:[]}}),/孕前体重/);
});

test('合并重复记录会按更新时间更新并统计跳过',()=>{
  const current=[record(25,0,58,10)],incoming=[record(25,0,59,20),record(26,0,60,20)];
  const merged=S.mergeRecords(current,incoming);assert.equal(merged.records.length,2);assert.equal(merged.records[0].weight,59);assert.equal(merged.stats.merged,2);
});

console.log(`\n${passed} core tests passed.`);
