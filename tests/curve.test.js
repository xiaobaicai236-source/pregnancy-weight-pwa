const assert=require('node:assert/strict');

global.window=global;
require('../data.js');
require('../calculator.js');

const C=PregnancyCalculator;

const categoryWeights={underweight:45,normal:60,overweight:75,obese:90};
const expectedTotals={underweight:[11,16],normal:[8,14],overweight:[7,11],obese:[5,9]};
Object.entries(categoryWeights).forEach(([categoryId,preWeight])=>{
  const at136=C.recommendation(preWeight,165,'singleton',13,6);
  const at140=C.recommendation(preWeight,165,'singleton',14,0);
  const at400=C.recommendation(preWeight,165,'singleton',40,0);
  assert.deepEqual([at136.low,at136.target,at136.high].map(value=>C.round1(value-preWeight)),[0,1,2],`${categoryId} 13+6`);
  assert.deepEqual([at140.low,at140.target,at140.high].map(value=>C.round1(value-preWeight)),[0,1,2],`${categoryId} 14+0`);
  assert.deepEqual([at400.low,at400.high].map(value=>C.round1(value-preWeight)),expectedTotals[categoryId],`${categoryId} 40+0`);
});

const expectedNormal={14:[0,1,2],20:[1.8,3.2,4.8],28:[4.3,6.2,8.5],40:[8,10.6,14]};
Object.entries(expectedNormal).forEach(([week,gains])=>{
  const result=C.recommendation(categoryWeights.normal,165,'singleton',Number(week),0);
  assert.deepEqual([result.low,result.target,result.high].map(value=>C.round1(value-categoryWeights.normal)),gains);
});

Object.values(categoryWeights).forEach(preWeight=>{
  const points=C.curve(preWeight,165,'singleton');
  assert.equal(points.length,280,'1+0 到 40+6 应每天一个点');
  points.forEach((point,index)=>{
    if(index){
      assert.ok(Math.abs((point.week-points[index-1].week)-1/7)<1e-4);
      assert.ok(point.low>=points[index-1].low);
      assert.ok(point.high>=points[index-1].high);
    }
    if(point.week>=14&&point.week<=40)assert.ok(point.low<point.target&&point.target<point.high);
  });
});

console.log('✓ 每日派生曲线边界、校验点、单调性与四类 BMI 端点通过');
