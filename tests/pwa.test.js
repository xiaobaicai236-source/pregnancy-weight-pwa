const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
let passed=0;
function test(name,fn){fn();passed+=1;console.log(`✓ ${name}`);}

const html=read('index.html'),worker=read('service-worker.js'),app=read('app.js'),chart=read('chart.js'),style=read('style.css'),data=read('data.js'),calculator=read('calculator.js'),readme=read('README.md');
const manifest=JSON.parse(read('manifest.json'));
function luminance(hex){const values=hex.match(/[0-9a-f]{2}/gi).map(value=>parseInt(value,16)/255).map(value=>value<=0.03928?value/12.92:((value+0.055)/1.055)**2.4);return 0.2126*values[0]+0.7152*values[1]+0.0722*values[2];}
function contrast(first,second){const a=luminance(first),b=luminance(second);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);}

test('所有页面静态资源引用统一为 v1.8.0',()=>{
  const references=[...html.matchAll(/(?:href|src)="([^"]+\?v=[^"]+)"/g)].map(match=>match[1]);
  assert.ok(references.length>=8);references.forEach(reference=>assert.match(reference,/\?v=1\.8\.0$/));
  assert.doesNotMatch(html,/\?v=1\.[0-7]/);
});

test('Service Worker 预缓存 URL 与页面请求完全一致',()=>{
  const references=[...html.matchAll(/(?:href|src)="((?:style\.css|data\.js|calculator\.js|storage\.js|chart\.js|app\.js|manifest\.json|assets\/apple-touch-icon\.png)\?v=1\.8\.0)"/g)].map(match=>`./${match[1]}`);
  references.forEach(reference=>assert.ok(worker.includes(`'${reference}'`),`missing ${reference}`));
  assert.match(worker,/const CACHE='pregnancy-weight-v1\.8\.0-touch-reference-3'/);
  assert.match(worker,/keys\.filter\(key=>key!==CACHE\)/);
});

test('Manifest 适合 GitHub Pages 子目录部署',()=>{
  assert.equal(manifest.name,'孕期体重监测');assert.equal(manifest.short_name,'体重监测');
  assert.equal(manifest.id,'./');assert.match(manifest.start_url,/^\.\//);assert.equal(manifest.scope,'./');
  assert.equal(manifest.display,'standalone');assert.ok(manifest.categories.includes('health'));
  assert.equal(manifest.background_color,'#f3f4f7');assert.equal(manifest.theme_color,'#f3f4f7');
});

test('普通图标与 maskable 图标分离且尺寸正确',()=>{
  const ordinary=manifest.icons.filter(icon=>icon.purpose==='any');
  const maskable=manifest.icons.find(icon=>icon.purpose==='maskable');
  assert.ok(ordinary.some(icon=>icon.sizes==='192x192'));assert.ok(ordinary.some(icon=>icon.sizes==='512x512'));
  assert.ok(maskable);assert.notEqual(maskable.src.replace(/\?.*/,''),'assets/icon-512.png');
  const maskPath=path.join(root,maskable.src.replace(/\?.*/,'')),buffer=fs.readFileSync(maskPath);
  assert.equal(buffer.readUInt32BE(16),512);assert.equal(buffer.readUInt32BE(20),512);
  assert.ok(worker.includes(`'./${maskable.src}'`));
});

test('安装逻辑只在平台允许时提供原生按钮',()=>{
  assert.match(app,/beforeinstallprompt/);assert.match(app,/event\.preventDefault\(\)/);
  assert.match(app,/await prompt\.prompt\(\)/);assert.match(app,/prompt\.userChoice/);
  assert.match(app,/appinstalled/);assert.match(app,/display-mode: standalone/);assert.match(app,/navigator\.standalone===true/);
  assert.match(app,/MicroMessenger\|WeChat\|QQ/);assert.match(app,/XiaoHongShu\|XHS/);assert.match(app,/INSTALL_COOLDOWN_MS/);
  assert.match(app,/els\.installButton\.hidden=!native/);
  assert.match(app,/if\(environment\.isEmbedded\|\|environment\.isIOS\)return/);
  assert.equal((app.match(/native:true/g)||[]).length,1);
});

test('安装环境分类覆盖 iOS、Android、应用内浏览器与桌面端',()=>{
  const start=app.indexOf('function detectInstallEnvironment');
  const end=app.indexOf('function isStandalone',start);
  const detect=Function(`${app.slice(start,end)};return detectInstallEnvironment;`)();
  assert.deepEqual(detect({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit Safari'}),{isIOS:true,isAndroid:false,isMobile:true,isEmbedded:false});
  assert.equal(detect({userAgent:'Mozilla/5.0 Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}).isIOS,true);
  assert.deepEqual(detect({userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit Chrome Mobile'}),{isIOS:false,isAndroid:true,isMobile:true,isEmbedded:false});
  assert.equal(detect({userAgent:'Mozilla/5.0 (Linux; Android 15) MicroMessenger'}).isEmbedded,true);
  assert.equal(detect({userAgent:'Mozilla/5.0 (iPhone) XiaoHongShu'}).isEmbedded,true);
  assert.deepEqual(detect({userAgent:'Mozilla/5.0 (Windows NT 10.0) Chrome'}),{isIOS:false,isAndroid:false,isMobile:false,isEmbedded:false});
});

test('底部使用提示按环境组合且始终保留数据安全说明',()=>{
  assert.match(html,/id="installPanel"[^>]*hidden/);assert.match(html,/id="installAppButton"[^>]*hidden/);
  assert.match(html,/记录仅保存在当前设备和浏览器中，请定期导出备份。/);
  assert.doesNotMatch(html,/可将本页面添加到手机桌面/);
  assert.match(app,/在浏览器中点击分享按钮，选择“添加到主屏幕”/);
  assert.match(app,/如浏览器支持，可在浏览器菜单中选择“添加到桌面”或“安装应用”/);
  assert.match(app,/当前浏览器可能不支持添加到桌面/);
  assert.match(app,/buttonLabel:environment\.isMobile\?'安装到手机':'安装到电脑'/);
  assert.match(app,/\['standalone','fullscreen','minimal-ui','window-controls-overlay'\]/);
  assert.match(style,/\.usage-install-row/);assert.match(style,/\.install-button\{background:rgba\(127,127,127,\.10\)/);
});

test('页面不包含重复的 Canvas 外部横坐标',()=>{
  assert.doesNotMatch(html,/class="chart-footer"/);assert.match(app,/按住图表左右滑动/);assert.match(app,/移动鼠标查看各孕周/);
});

test('图表横坐标按宽度抽稀、仅显示数字并单独标注周单位',()=>{
  assert.match(chart,/function xAxisTicks\(plotW\)/);
  assert.match(chart,/xAxisTicks\(plotW\)\.forEach\(week=>ctx\.fillText\(String\(week\)/);
  assert.match(chart,/ctx\.fillText\('单位：周'/);
  assert.doesNotMatch(chart,/ctx\.fillText\(`\$\{week\}周`,x\(week\),height-pad\.b/);
});

test('十字定位复用推荐函数并完整清理 Pointer Events 状态',()=>{
  assert.match(chart,/frame\.doctorRecFn\(gestation\)/);assert.match(chart,/frame\.generalRecFn\(gestation\)/);assert.match(chart,/Math\.round\([\s\S]*\*7\)/);
  assert.match(chart,/中位数/);assert.doesNotMatch(chart,/标准体重/);
  assert.match(chart,/\$\{prefix\}上限/);assert.match(chart,/\$\{prefix\}下限/);assert.match(chart,/通用推荐范围，仅供趋势参考/);
  assert.match(chart,/low>target\|\|target>high/);
  ['--range-upper','--range-middle','--range-lower','--range-upper-soft','--range-middle-soft','--range-lower-soft'].forEach(variable=>assert.ok(style.includes(variable)));
  assert.doesNotMatch(chart,/正常上限|危险上限|最低安全体重|最高安全体重/);
  ['pointerdown','pointermove','pointerup','pointercancel','pointerleave','lostpointercapture'].forEach(eventName=>assert.ok(app.includes(`addEventListener('${eventName}'`)));
  assert.match(app,/setPointerCapture/);assert.match(app,/releasePointerCapture/);assert.match(app,/PregnancyChart\.clearCrosshair/);
  assert.match(app,/pregnancy-chart-guide-seen-v1/);assert.match(html,/按住并左右滑动/);assert.match(html,/松开即可退出查询/);
  assert.match(style,/touch-action:pan-y/);assert.match(style,/prefers-reduced-motion:reduce/);
});

test('触摸手势超过阈值后单向锁定查询或页面滚动',()=>{
  const start=app.indexOf('const CHART_GESTURE_THRESHOLD');
  const end=app.indexOf('let chartGesture',start);
  const intent=Function(`${app.slice(start,end)};return chartGestureIntent;`)();
  assert.equal(intent(5,2),'pending');assert.equal(intent(20,-10),'query');assert.equal(intent(-24,12),'query');
  assert.equal(intent(8,20),'scroll');assert.equal(intent(-9,-22),'scroll');assert.equal(intent(12,11),'pending');
  assert.match(app,/chartGesture\.mode='query'/);
  assert.match(app,/resolvePendingChartGesture\(deltaX,deltaY,touch\.clientX\)/);
  assert.match(app,/chartGesture\.mode='scroll';cancelScheduledCrosshair\(\);PregnancyChart\.clearCrosshair\(\)/);
  assert.match(app,/scheduleCrosshair\(touch\.clientX,chartGesture\.anchorClientY\)/);
  assert.match(app,/document\.documentElement\.addEventListener\('touchmove',moveChartTouch,\{passive:false\}\)/);
  assert.match(app,/touch\.identifier===chartGesture\.touchId/);
  assert.match(app,/startX:touch\.pageX,startY:touch\.pageY/);
  assert.match(app,/if\(event\.pointerType!=='mouse'\)return/);
  assert.doesNotMatch(style,/touch-action:none/);
});

test('推荐范围数值使用透明Canvas文字而非遮挡曲线的色块',()=>{
  const start=chart.indexOf('function drawRangeInfo');
  const end=chart.indexOf('function drawCrosshair',start);
  const rangeInfo=chart.slice(start,end);
  assert.match(rangeInfo,/strokeText\(value,x,y\)/);assert.match(rangeInfo,/fillText\(value,x,y\)/);
  assert.doesNotMatch(rangeInfo,/roundedRect|panel-solid|range-upper-soft|range-middle-soft|range-lower-soft|shadowBlur|globalAlpha/);
  assert.match(style,/--chart-label-outline:rgba\(255,255,255,\.92\)/);
  assert.match(style,/--chart-label-outline:rgba\(0,0,0,\.84\)/);
});

test('新增记录只能由当前体重主动输入路径触发',()=>{
  assert.equal((app.match(/PregnancyStorage\.addRecord\(/g)||[]).length,1);
  assert.match(app,/if\(!weightDirty\)return/);
  assert.match(app,/els\.weight\.addEventListener\('input',handleWeightInput\)/);
  assert.match(app,/input\.addEventListener\('change',persistSelection\)/);
  assert.match(app,/input\.addEventListener\('blur',persistSelection\)/);
  assert.doesNotMatch(app,/\[els\.week,els\.day\][\s\S]*?addEventListener\('(?:change|blur)',persistCurrent\)/);
  assert.match(html,/孕周和当前体重填写完整后自动保存/);
});

test('当前体重输入保留用户原始字符串并仅在完成输入后保存',()=>{
  const persistBody=app.slice(app.indexOf('function persistCurrent()'),app.indexOf('function handleWeightInput()'));
  const inputBody=app.slice(app.indexOf('function handleWeightInput()'),app.indexOf('function previewSelection()'));
  assert.match(html,/id="weightInput"[^>]*inputmode="decimal"[^>]*type="text"/);
  assert.match(app,/const completedWeight=value=>/);
  assert.match(app,/els\.weight\.addEventListener\('input',handleWeightInput\)/);
  assert.match(app,/\['change','blur'\][\s\S]*persistCurrent/);
  assert.doesNotMatch(app,/saveTimer|setTimeout\(persistCurrent/);
  assert.equal((app.match(/els\.weight\.value\s*=/g)||[]).length,2);
  assert.doesNotMatch(persistBody,/els\.weight\.value\s*=/);
  assert.doesNotMatch(inputBody,/els\.weight\.value\s*=/);
  assert.match(app,/function handleWeightInput\(\)\{\s*weightDirty=true;render\(\);/);
});

test('默认计算完整采用 WS/T 801—2022 中国标准',()=>{
  assert.match(data,/max:24/);assert.match(data,/max:28/);
  assert.match(data,/totalGainKg:\[11,16\], weeklyTargetKg:0\.46, weeklyGainKg:\[0\.37,0\.56\]/);
  assert.match(data,/totalGainKg:\[8,14\], weeklyTargetKg:0\.37, weeklyGainKg:\[0\.26,0\.48\]/);
  assert.doesNotMatch(data,/references:[\s\S]*twins:/);
  assert.match(calculator,/heightCm<140/);assert.match(calculator,/preWeight>125/);
  assert.match(html,/使用前必读 · 关于与说明/);assert.match(html,/class="required-badge">必读/);
  assert.match(html,/WS\/T 801—2022/);assert.match(readme,/2022年10月1日/);
  assert.match(html,/complicationInput/);assert.match(html,/doctorTargetInput/);
});

test('十字定位移动合并到每帧一次并跳过同一天重复绘制',()=>{
  assert.match(app,/function scheduleCrosshair\(clientX,clientY,onResult=null\)/);
  assert.match(app,/crosshairFrame=requestAnimationFrame/);assert.match(app,/cancelAnimationFrame\(crosshairFrame\)/);
  assert.match(app,/scheduleCrosshair\(event\.clientX,chartGesture\.anchorClientY\)/);
  assert.match(app,/scheduleCrosshair\(touch\.clientX,chartGesture\.anchorClientY\)/);
  assert.match(chart,/if\(crosshair\?\.gestation===gestation\)return \{\.\.\.crosshair\}/);
  assert.match(chart,/scaleX=rect\.width\?frame\.width\/rect\.width:1/);
  assert.match(html,/class="chart-crosshair-layer"/);
  assert.match(style,/\.chart-crosshair-layer\{z-index:2;pointer-events:none\}/);
  assert.match(chart,/const baseImage=overlayCtx\?null:ctx\.getImageData/);
  assert.match(chart,/overlayCtx\.clearRect\(0,0,element\.width,element\.height\)/);
});

test('并发症提示与医生个体化目标具有完整本地功能',()=>{
  ['doctorPlanSection','doctorPlanEnabledInput','doctorWeekInput','doctorDayInput','doctorLowerInput','doctorMiddleInput','doctorUpperInput','saveDoctorTargetButton','doctorTargetList','clearDoctorTargetsButton','legendDoctor','medicalNotice','generalReferenceSummary'].forEach(id=>assert.ok(html.includes(`id="${id}"`),id));
  assert.match(html,/医生目标数据由用户根据医生建议录入/);assert.match(html,/参数不足时不会自动生成曲线/);
  assert.match(app,/PregnancyStorage\.upsertDoctorTarget/);assert.match(app,/PregnancyStorage\.deleteDoctorTarget/);assert.match(app,/PregnancyStorage\.clearDoctorTargets/);assert.match(app,/confirm\('确定清空全部医生目标吗/);
  assert.match(app,/当前存在妊娠并发症，通用曲线仅供趋势参考/);assert.match(app,/当前孕周暂无医生目标数据/);
  assert.match(calculator,/function doctorTargetAtGestation/);assert.match(calculator,/function doctorCurve/);assert.match(calculator,/middleSource:provided\?'provided':'range-midpoint'/);
  assert.match(chart,/generalMuted/);assert.match(chart,/doctorCurve/);assert.match(chart,/医生目标中位数/);assert.match(chart,/范围中点/);assert.match(chart,/该孕周暂无医生目标数据/);
  assert.match(style,/--doctor:#7551b9/);assert.match(style,/--doctor:#bf9cff/);assert.match(style,/\.legend-doctor-range/);
});

test('浅色模式主要文字和按钮达到可读对比度',()=>{
  assert.ok(contrast('#17181b','#f3f4f7')>=4.5);
  assert.ok(contrast('#62666f','#f3f4f7')>=4.5);
  assert.ok(contrast('#656a73','#f3f4f7')>=4.5);
  assert.ok(contrast('#ffffff','#0071e3')>=4.5);
  assert.ok(contrast('#8a5000','#f3f4f7')>=4.5);
  assert.ok(contrast('#b42318','#f3f4f7')>=4.5);
  assert.ok(contrast('#a45116','#f3f4f7')>=4.5);
  assert.ok(contrast('#0f7335','#f3f4f7')>=4.5);
  assert.ok(contrast('#006fa8','#f3f4f7')>=4.5);
});

test('深色模式主要状态色和小字达到可读对比度',()=>{
  assert.ok(contrast('#f5f5f7','#090a0c')>=4.5);
  assert.ok(contrast('#999ca5','#090a0c')>=4.5);
  assert.ok(contrast('#8b8e97','#090a0c')>=4.5);
  assert.ok(contrast('#0a84ff','#090a0c')>=4.5);
  assert.ok(contrast('#30d158','#090a0c')>=4.5);
  assert.ok(contrast('#ffb340','#090a0c')>=4.5);
  assert.ok(contrast('#ff6961','#090a0c')>=4.5);
  assert.ok(contrast('#ff9f6e','#090a0c')>=4.5);
  assert.ok(contrast('#30d158','#090a0c')>=4.5);
  assert.ok(contrast('#64d2ff','#090a0c')>=4.5);
});

console.log(`\n${passed} PWA tests passed.`);
