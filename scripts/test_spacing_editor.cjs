#!/usr/bin/env node
// FX-CORE-02: actual browser integration, event metadata, developer handoff.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {entries,decodeRgba}=require('./test_png_pma.cjs');
const S=require('../assets/template/src/spacing-core.js');
const opt=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1]};
const html=opt('html'),backend=opt('backend','webgl'),output=path.resolve(opt('output','fx-spacing-results'));
if(!html||!['webgl','webgpu'].includes(backend))throw Error('Usage: test_spacing_editor.cjs --html FILE --backend webgl|webgpu --output DIR');
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
 args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU==='1'?['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']:[])]});
 fs.mkdirSync(output,{recursive:true});
 const page=await browser.newPage({viewport:{width:1366,height:900},offline:true,acceptDownloads:true});
 const errors=[];let network=0;
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))network++});
 const change=async(id,v)=>{
   const selector=page.locator('#'+id);
   if(typeof v==='boolean')await (v?selector.check():selector.uncheck());
   else if(await selector.evaluate(x=>x.tagName)==='SELECT')await selector.selectOption(String(v));
   else {await selector.fill(String(v));await selector.dispatchEvent('change');}
 };
 try{
  const url=pathToFileURL(path.resolve(html));url.searchParams.set('renderer',backend);
  await page.goto(url.href);
  await page.waitForFunction(()=>document.querySelector('#viewport canvas')&&
   document.getElementById('loading').style.display==='none'&&
   !document.getElementById('assetName').textContent.includes('Loading'),null,{timeout:60000});
  assert.equal(await page.evaluate(()=>backend),backend,'must not silently fall back');
  if(process.argv.includes('--webgl1')){
    assert.equal(backend,'webgl');
    const version=await page.evaluate(async()=>{cfg.quality='low';await switchRenderer();return app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'});
    assert.equal(version,'webgl1');
  }
  const init=await page.evaluate(()=>({enabled:cfg.spacingEnabled,plan:fx.spacingPlan,guide:document.querySelector('#fxSpacingGuide')?.childElementCount}));
  assert.equal(init.enabled,false);assert.equal(init.plan,null);assert.equal(init.guide,0);
  await page.locator('#fxSpacingPanel summary').click();
  await change('fxSpacingEnabled',true);
  await change('fxSpacingBaseRate',20);
  await change('fxSpacingBasePx',18);
  const first=await page.evaluate(()=>({enabled:cfg.spacingEnabled,plan:fx.spacingPlan}));
  assert.ok(first.enabled&&first.plan.events.length>0);
  const count=first.plan.spatial.points.length;
  await change('fxSpacingBasePx',36);
  const fewer=await page.evaluate(()=>fx.spacingPlan.spatial.points.length);
  assert.ok(fewer<count,'spacing control must change the number of anchors');
  await change('fxSpacingBasePx',18);
  await change('fxSpacingGuides',true);
  const guide=await page.evaluate(()=>({visible:!document.querySelector('#fxSpacingGuide').hidden,
   paths:document.querySelectorAll('#fxSpacingGuide path').length,
   dots:document.querySelectorAll('#fxSpacingGuide circle').length}));
  assert.ok(guide.visible&&guide.paths===1&&guide.dots>0,'guide is visible in preview');
  await change('fxSpacingPath1Y',140);
  assert.equal(await page.evaluate(()=>cfg.spacingPath.segments[0].p1[1]),140);
  const pathChanged=await page.evaluate(()=>fx.spacingPlan.pathLengthPx);
  assert.ok(pathChanged!==first.plan.pathLengthPx,'geometry change recomputes arc length');
  await change('fxSpacingCurveTarget','spacing');
  await change('fxSpacingCurveValue',7);
  let curve=await page.evaluate(()=>cfg.spacingDistanceCurve);
  assert.equal(curve.parameterKey,'spacingPx');
  assert.equal(curve.keys[0].y,7);
  const curvePoints=await page.evaluate(()=>fx.spacingPlan.spatial.points.length);
  assert.notEqual(curvePoints,count,'custom distance curve changes physical placement');
  await change('fxSpacingCurveTarget','rate');
  await change('fxSpacingCurveValue',1.6);
  assert.equal(await page.evaluate(()=>cfg.spacingTemporalMode),'custom');
  const custom=await page.evaluate(()=>fx.spacingPlan.events.map(e=>e.time));
  await change('fxSpacingCurveTarget','interval');
  await change('fxSpacingCurveValue',.7);
  assert.ok(await page.evaluate(()=>Boolean(cfg.spacingIntervalCurve)));
  await change('fxSpacingFrequencySource','interval');
  const interval=await page.evaluate(()=>fx.spacingPlan.events.map(e=>e.time));
  assert.notDeepEqual(interval,custom,'interval curve is an independent control');
  await change('fxSpacingFrequencySource','rate');
  await change('fxSpacingCombine','both');
  await change('fxSpacingTravelSpeedPx',0);
  assert.equal(await page.evaluate(()=>fx.spacingPlan.events.length),0,'stationary AND mode does not emit');
  await change('fxSpacingTravelSpeedPx',180);
  assert.ok(await page.evaluate(()=>fx.spacingPlan.events.length)>0,'motion unlocks AND events');
  await change('fxSpacingCombine','distance');
  assert.ok(await page.evaluate(()=>fx.spacingPlan.events.length)>0);
  await change('fxSpacingCombine','time');
  await change('fxSpacingTemporalMode','uniform');
  await change('fxSpacingFrequencySource','rate');
  await change('fxSpacingBaseRate',25);
  await change('fxSpacingTimeJitter',.12);
  await change('fxSpacingSeed',222);
  await change('fxSpacingAlignToTangent',true);
  await change('fxSpacingSparkTrails',false);
  await change('fxSpacingClosed',true);
  assert.equal(await page.evaluate(()=>cfg.spacingPath.closed),true,'closed path control');
  await change('fxSpacingClosed',false);
  await change('fxSpacingGuides',true);
  assert.equal(await page.evaluate(()=>document.querySelector('#fxSpacingGuide').hidden),false);
  await page.locator('#animPlay').uncheck();
  for(const [id,value]of [['bakeWidth',160],['bakeHeight',128],['bakeFrames',40],['durationFrames',40]]){
    await change(id,value);
  }
  const before=await page.evaluate(()=>fx.spacingPlan.events.map(e=>e.time));
  const downloadPending=page.waitForEvent('download',{timeout:120000});
  await page.locator('#bakeStart').click();
  const result=await downloadPending,file=path.join(output,backend+'-spacing.zip');
  await result.saveAs(file);
  await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled);
  const archive=entries(fs.readFileSync(file));
  assert.equal([...archive.keys()].filter(s=>s.endsWith('.png')).length,40);
  const metadata=JSON.parse(archive.get('sequence.json'));
  assert.equal(metadata.spacing.enabled,true);
  assert.equal(metadata.spacing.mode,'time');
  assert.equal(metadata.effectSettings.spacingEnabled,true);
  assert.equal(metadata.effectSettings.sparkTrails,false);
  assert.ok(metadata.spacing.eventTimesSeconds.length>0);
  assert.ok(metadata.spacing.spatialDistancesPx.length>0);
  assert.ok(metadata.spacing.actuallySpawned.length>0,'bake must actually spawn path particles');
  assert.ok(metadata.spacing.actuallySpawned.every(e=>e.time<=metadata.lastSampleSeconds+1e-9));
  assert.ok(metadata.spacing.actuallySpawned.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)));
  for(let i=1;i<metadata.spacing.eventTimesSeconds.length;i++)
    assert.ok(metadata.spacing.eventTimesSeconds[i]>metadata.spacing.eventTimesSeconds[i-1]);
  assert.equal(metadata.spacing.eventTimesSeconds.length,metadata.spacing.eventAnchors.length);
  const plan=S.createTemporalSchedule({
    schemaVersion:1,mode:metadata.effectSettings.spacingTemporalMode,frequencySource:'rate',
    baseRate:Math.min(metadata.effectSettings.spacingBaseRate,160),
    interval:metadata.effectSettings.spacingInterval,
    duration:metadata.effectSettings.duration,
    minInterval:metadata.effectSettings.spacingMinInterval,
    jitter:metadata.effectSettings.spacingTimeJitter,
    burstCount:metadata.effectSettings.spacingBurstCount,burstDelay:metadata.effectSettings.spacingBurstDelay,
    seed:metadata.effectSettings.spacingSeed,maxEvents:Math.min(4096,Math.ceil(metadata.effectSettings.duration*160)+128),
    rateCurve:metadata.effectSettings.spacingRateCurve,intervalCurve:metadata.effectSettings.spacingIntervalCurve});
  assert.deepEqual(metadata.spacing.eventTimesSeconds,plan.events.map(e=>e.time),'schedule is sourced from pure function');
  assert.equal(decodeRgba(archive.get('frames/frame_00000.png')).width,160);
  assert.equal(archive.has('fxSpacingGuide'),false,'guides must not leak into PNG/ZIP');
  console.log('PASS SPACING PNG',JSON.stringify({backend,frames:40,eventCount:metadata.spacing.eventTimesSeconds.length,
    anchors:metadata.spacing.spatialDistancesPx.length,spawned:metadata.spacing.actuallySpawned.length,guideInitially:guide.dots}));
  // Neither DOM-only authoring guides nor camera zoom may leak into PNG pixels.
  await change('fxSpacingGuides',false);
  assert.equal(await page.evaluate(()=>document.querySelector('#fxSpacingGuide').hidden),true);
  await page.locator('#cameraZoomIn').click();
  const secondDownload=page.waitForEvent('download',{timeout:120000});
  await page.locator('#bakeStart').click();
  const secondFile=path.join(output,backend+'-spacing-hidden-guides-zoom.zip');
  await (await secondDownload).saveAs(secondFile);
  await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled);
  const second=entries(fs.readFileSync(secondFile));
  for(const frame of ['frames/frame_00000.png','frames/frame_00020.png','frames/frame_00035.png']){
    assert.ok(archive.get(frame).equals(second.get(frame)),
      'camera zoom and guide toggles must not change baked RGBA '+frame);
  }
  assert.deepEqual(JSON.parse(second.get('sequence.json')).spacing.eventTimesSeconds,metadata.spacing.eventTimesSeconds);
  console.log('PASS SPACING CAMERA/GUIDE INVARIANCE',JSON.stringify({backend,framesChecked:3}));
  for(const target of ['WebGL','WebGPU']){
    const dl=page.waitForEvent('download',{timeout:60000});
    await page.locator('#export'+target).click();
    const dest=path.join(output,backend+'-'+target+'.zip');
    await (await dl).saveAs(dest);
    const files=entries(fs.readFileSync(dest));
    assert.ok(files.has('FxSpacing.mjs'));assert.ok(files.has('FxCurves.mjs'));
    assert.ok(files.get('BurnTransition.mjs').toString().includes("import './FxSpacing.mjs'"));
    const preset=JSON.parse(files.get('preset.json'));
    assert.equal(preset.settings.spacingEnabled,true);
    assert.equal(preset.settings.spacingCombine,'time');
    assert.deepEqual(preset.settings.spacingPath,metadata.effectSettings.spacingPath);
    const directory=path.join(output,'modules-'+backend+'-'+target);
    fs.mkdirSync(directory,{recursive:true});
    for(const name of ['FxSpacing.mjs','FxCurves.mjs','BurnTransition.mjs',...(files.has('FxColors.mjs')?['FxColors.mjs']:[]),...(files.has('FxTimeline.mjs')?['FxTimeline.mjs']:[])])
      fs.writeFileSync(path.join(directory,name),files.get(name));
    const module=await import(pathToFileURL(path.join(directory,'FxSpacing.mjs')).href);
    const effect=await import(pathToFileURL(path.join(directory,'BurnTransition.mjs')).href);
    assert.equal(typeof effect.createBurnTransition,'function');
    assert.equal(module.FxSpacing.VERSION,1);
    const generated=module.FxSpacing.createTemporalSchedule({...plan.config});
    assert.deepEqual(generated.events,plan.events);
  }
  assert.equal(network,0);assert.deepEqual(errors,[]);
  console.log('PASS SPACING UI+DEVELOPER',JSON.stringify({backend,offline:true,exports:2,
    checks:['source toggle','physical spacing','guide overlay','curve controls','rate-vs-interval','stationary/AND','closed path','camera independent export']}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
