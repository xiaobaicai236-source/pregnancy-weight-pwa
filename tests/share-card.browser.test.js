const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');

const url=process.env.APP_URL||'http://127.0.0.1:4174/';
const artifactDir=path.join(__dirname,'artifacts','v22');
const storageKey='pregnancy-weight-pwa-v1';
const prefsKey='pregnancy-share-card-prefs-v1';
const record=(week,day,weight)=>({id:`${week*7+day}d`,week,day,gestation:week+day/7,weight,updatedAt:1});
const baseState={
  preWeight:51.5,heightCm:165,plurality:'singleton',pluralityConfirmed:true,
  hasPregnancyComplication:false,hasDoctorTarget:false,doctorPlanEnabled:true,doctorPlanVersion:1,doctorTargets:[],
  week:25,day:0,currentWeight:'',records:[record(13,0,53),record(19,0,55),record(25,0,58)],ignoredRecordCount:0
};

async function loadState(page,state){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.evaluate(([key,value])=>localStorage.setItem(key,JSON.stringify(value)),[storageKey,state]);
  await page.reload({waitUntil:'networkidle'});
}

async function captureCanvasText(page){
  await page.evaluate(()=>{
    window.__shareTexts=[];
    const original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(value,...args){window.__shareTexts.push(String(value));return original.call(this,value,...args);};
    if(!window.__shareToBlobWrapped){
      const originalToBlob=HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob=function(callback,...args){window.__shareDataUrl=this.toDataURL('image/png');return originalToBlob.call(this,callback,...args);};
      window.__shareToBlobWrapped=true;
    }
  });
}

async function readGenerated(page){
  await page.locator('#shareCardImage').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('shareCardImage')?.naturalWidth===1080);
  return page.evaluate(()=>{
    const image=document.getElementById('shareCardImage'),dataUrl=window.__shareDataUrl||'';
    return {width:image.naturalWidth,height:image.naturalHeight,type:'image/png',size:Math.floor(dataUrl.length*3/4),base64:dataUrl.split(',')[1]||'',texts:window.__shareTexts||[]};
  });
}

async function generate(page,entry='#shareCardButton'){
  await page.locator(entry).click();
  await page.locator('#generateSharePreviewButton').click();
  return readGenerated(page);
}
const saveCard=(name,result)=>fs.writeFileSync(path.join(artifactDir,name),Buffer.from(result.base64,'base64'));

(async()=>{
  fs.mkdirSync(artifactDir,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));

    await page.goto(url,{waitUntil:'networkidle'});
    assert.equal(await page.locator('#shareCardButton').isDisabled(),true);
    assert.match(await page.locator('#shareCardHint').textContent(),/孕前设置/);

    await loadState(page,baseState);await captureCanvasText(page);
    assert.equal(await page.locator('[data-share-feature="public-link"]').isHidden(),true);
    const shareBox=await page.locator('.share-card-entry').boundingBox(),chartBox=await page.locator('.chart-card').boundingBox();
    assert.ok(shareBox&&chartBox);assert.ok(shareBox.y<chartBox.y);
    await page.locator('.share-card-entry').scrollIntoViewIfNeeded();
    await page.evaluate(()=>window.scrollBy(0,-96));
    await page.waitForTimeout(120);
    await page.screenshot({path:path.join(artifactDir,'share-entry-position-mobile.png')});
    const before=await page.evaluate(key=>localStorage.getItem(key),storageKey);
    const result=await generate(page);
    assert.deepEqual({width:result.width,height:result.height,type:result.type},{width:1080,height:1440,type:'image/png'});
    assert.ok(result.size>50000);assert.ok(result.texts.includes('孕前体重'));assert.ok(result.texts.includes('51.5 kg'));
    assert.ok(result.texts.includes('当前体重'));assert.ok(result.texts.includes('58.0 kg'));assert.ok(result.texts.includes('+6.5 kg'));
    assert.ok(result.texts.includes('当前体重位于通用推荐范围内'));
    assert.equal(result.texts.includes('扫码记录你的孕期体重'),false);
    assert.equal(result.texts.some(value=>value.includes('xiaobaicai236-source.github.io')),false);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),storageKey),before);
    saveCard('share-card-general.png',result);
    await page.screenshot({path:path.join(artifactDir,'share-dialog-mobile.png'),fullPage:true});

    await page.locator('#regenerateShareCardButton').click();
    await page.locator('input[name="showCurrentWeight"]').setChecked(false,{force:true});
    await page.locator('input[name="showPreWeight"]').setChecked(false,{force:true});
    await page.locator('input[name="showGain"]').setChecked(false,{force:true});
    await captureCanvasText(page);await page.locator('#generateSharePreviewButton').click();const privacy=await readGenerated(page);
    assert.equal(privacy.texts.includes('当前体重'),false);assert.equal(privacy.texts.includes('58.0 kg'),false);assert.equal(privacy.texts.includes('孕前体重'),false);assert.equal(privacy.texts.includes('累计增重'),false);
    saveCard('share-card-privacy-limited.png',privacy);

    await page.evaluate(()=>document.getElementById('shareCardDialog').close());
    const singleState={...baseState,records:[record(25,0,58)]};
    await loadState(page,singleState);await page.evaluate(key=>localStorage.removeItem(key),prefsKey);await captureCanvasText(page);const single=await generate(page);
    assert.ok(single.texts.includes('继续记录，形成你的孕期体重曲线'));saveCard('share-card-single-record.png',single);

    await page.evaluate(()=>document.getElementById('shareCardDialog').close());
    const doctorState={...baseState,hasDoctorTarget:true,doctorTargets:[
      {id:'doctor-168d',week:24,day:0,gestation:24,lower:55,middle:56,upper:57,updatedAt:1},
      {id:'doctor-196d',week:28,day:0,gestation:28,lower:56,middle:57.2,upper:58.5,updatedAt:1}
    ]};
    await loadState(page,doctorState);await page.evaluate(key=>localStorage.removeItem(key),prefsKey);await captureCanvasText(page);const doctor=await generate(page,'#shareCardAuxButton');
    assert.ok(doctor.texts.includes('医生目标数据由用户录入'));assert.ok(doctor.texts.some(text=>text.includes('医生目标范围')));
    saveCard('share-card-doctor-target.png',doctor);

    await page.evaluate(()=>document.getElementById('shareCardDialog').close());
    await loadState(page,{...baseState,hasPregnancyComplication:true});await page.evaluate(key=>localStorage.removeItem(key),prefsKey);await captureCanvasText(page);const complication=await generate(page);
    assert.ok(complication.texts.includes('与通用推荐范围对照，仅供趋势参考'));
    saveCard('share-card-complication-reference.png',complication);

    assert.deepEqual(errors,[]);
    await context.close();

    const isolated=await browser.newContext({viewport:{width:390,height:844}});
    await isolated.route('**/share-card.js*',route=>route.abort());
    const isolatedPage=await isolated.newPage();const isolatedErrors=[];isolatedPage.on('pageerror',error=>isolatedErrors.push(error.message));
    await isolatedPage.goto(url,{waitUntil:'networkidle'});
    assert.equal(await isolatedPage.locator('#weekInput').inputValue(),'25');
    assert.equal(await isolatedPage.locator('#weightChart').count(),1);
    assert.equal(await isolatedPage.locator('#shareCardButton').isDisabled(),true);
    assert.deepEqual(isolatedErrors,[]);
    await isolated.close();

    const noIllustration=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await noIllustration.route('**/assets/share-mother.png*',route=>route.abort());
    const noIllustrationPage=await noIllustration.newPage();
    await loadState(noIllustrationPage,baseState);await captureCanvasText(noIllustrationPage);
    const fallbackCard=await generate(noIllustrationPage);
    assert.equal(fallbackCard.width,1080);assert.equal(fallbackCard.height,1440);
    await noIllustration.close();

    const offline=await browser.newContext({viewport:{width:390,height:844}});
    const offlinePage=await offline.newPage();await loadState(offlinePage,baseState);
    await offlinePage.evaluate(()=>navigator.serviceWorker.ready);
    await offlinePage.reload({waitUntil:'networkidle'});
    await offline.setOffline(true);await offlinePage.reload({waitUntil:'domcontentloaded'});
    await captureCanvasText(offlinePage);const offlineCard=await generate(offlinePage);
    assert.equal(offlineCard.width,1080);assert.equal(offlineCard.height,1440);
    await offline.close();
    for(const width of [375,768,1280]){
      const responsive=await browser.newContext({viewport:{width,height:900}}),responsivePage=await responsive.newPage();await loadState(responsivePage,baseState);
      const shareBox=await responsivePage.locator('.share-card-entry').boundingBox(),responsiveChart=await responsivePage.locator('.chart-card').boundingBox();
      assert.ok(shareBox.y<responsiveChart.y);await responsivePage.locator('.share-card-entry').screenshot({path:path.join(artifactDir,`share-entry-${width}.png`)});await responsive.close();
    }
    const dark=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark'}),darkPage=await dark.newPage();await loadState(darkPage,baseState);
    await darkPage.locator('.share-card-entry').screenshot({path:path.join(artifactDir,'share-entry-dark.png')});
    await captureCanvasText(darkPage);const darkCard=await generate(darkPage);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(darkCard.base64,'base64')).digest('hex'),crypto.createHash('sha256').update(Buffer.from(result.base64,'base64')).digest('hex'));
    saveCard('share-card-dark-page.png',darkCard);await dark.close();
    console.log('✓ 分享卡片浏览器验收通过：入口位置、尺寸、单记录、隐私重排、医生目标、并发症、离线生成、只读隔离、三档响应式、深浅主题一致输出');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
