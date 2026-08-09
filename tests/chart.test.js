const assert=require('node:assert/strict');

global.window=global;
global.document={documentElement:{}};
global.getComputedStyle=()=>({getPropertyValue:()=>''});
global.devicePixelRatio=1;

const operations=[];
const gradient={addColorStop(){}};
const context={
  setTransform(){},clearRect(){},save(){},restore(){},beginPath(){},closePath(){},stroke(){},fill(){},setLineDash(){},arc(){},arcTo(){},putImageData(){},
  fillText(text,x,y){operations.push(['fillText',String(text),x,y]);},
  moveTo(x,y){operations.push(['moveTo',x,y]);},lineTo(x,y){operations.push(['lineTo',x,y]);},
  createLinearGradient(){return gradient;},measureText(text){return {width:String(text).length*6};},getImageData(){return {mock:true};}
};
const canvas={
  width:0,height:0,
  getContext(){return context;},
  getBoundingClientRect(){return {left:0,top:0,width:654,height:320};}
};

require('../chart.js');

const minWeek=1,maxWeek=40+6/7,padLeft=38,plotWidth=654-38-62;
const clientX=gestation=>padLeft+(gestation-minWeek)/(maxWeek-minWeek)*plotWidth;
let calls=[];
const recommendationAtWeek=gestation=>{
  calls.push(gestation);
  return {available:true,low:49+gestation/10,target:50+gestation/10,high:51+gestation/10};
};

PregnancyChart.drawChart(canvas,{records:[],currentWeek:25,minWeek,maxWeek,recommendationAtWeek});

[
  [1,0],[14,0],[25,0],[40,0]
].forEach(([week,day])=>{
  calls=[];
  const result=PregnancyChart.showCrosshair(clientX(week+day/7),120);
  assert.equal(result.week,week);assert.equal(result.day,day);
  assert.equal(result.gestation,week+day/7);
  assert.equal(result.low,49+(week+day/7)/10);
  assert.equal(result.target,50+(week+day/7)/10);
  assert.equal(result.high,51+(week+day/7)/10);
  assert.ok(result.low<=result.target&&result.target<=result.high);
  assert.ok(calls.some(value=>Math.abs(value-result.gestation)<1e-9),'必须调用传入的统一推荐函数');
});

const dayResult=PregnancyChart.showCrosshair(clientX(14+3/7),80);
assert.equal(dayResult.week,14);assert.equal(dayResult.day,3);assert.equal(dayResult.target,50+(14+3/7)/10);
const sameXOtherY=PregnancyChart.showCrosshair(clientX(14+3/7),210);
assert.equal(sameXOtherY.target,dayResult.target,'横线对应推荐中位数，不跟随手指纵坐标');
assert.equal(sameXOtherY.low,dayResult.low);assert.equal(sameXOtherY.high,dayResult.high);
const drawnText=operations.filter(operation=>operation[0]==='fillText').map(operation=>operation[1]);
assert.ok(drawnText.some(text=>text.startsWith('推荐上限 ')));
assert.ok(drawnText.some(text=>text.startsWith('推荐中位数 ')));
assert.ok(drawnText.some(text=>text.startsWith('推荐下限 ')));
assert.ok(drawnText.includes('估算推荐范围，仅供趋势参考'));

assert.equal(PregnancyChart.hasCrosshair(),true);
PregnancyChart.clearCrosshair();assert.equal(PregnancyChart.hasCrosshair(),false);
assert.equal(PregnancyChart.showCrosshair(2,2),null,'绘图区外不显示十字定位');

PregnancyChart.drawChart(canvas,{records:[],currentWeek:25,minWeek,maxWeek,recommendationAtWeek:null});
assert.equal(PregnancyChart.showCrosshair(clientX(25),120),null,'没有可用推荐曲线时不显示虚假十字定位');

PregnancyChart.drawChart(canvas,{records:[],currentWeek:25,minWeek,maxWeek,recommendationAtWeek:()=>({available:true,low:62,target:61,high:63})});
assert.equal(PregnancyChart.showCrosshair(clientX(25),120),null,'推荐范围顺序无效时不显示虚假十字定位');

console.log('✓ 十字定位上下限/中位数、1/14/25/40周、按天吸附、推荐函数复用与清理状态通过');
