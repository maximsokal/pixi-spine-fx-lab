#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const P=require('./fx_visual_png.cjs');
const root=path.resolve(__dirname,'..'),backend=process.argv[2]||'webgl2';
const output=path.join(process.env.TEMP||'.','fxlab_rain_'+backend);
async function run(){
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:1400,height:1050},
  acceptDownloads:true,offline:true});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
 try{
  await page.goto(pathToFileURL(path.join(root,'assets/Rainfall_Lab.html')).href);
  await page.waitForFunction(()=>typeof RainEditor!=='undefined'&&!!RainEditor.getApp(),null,{timeout:60000});
  if(backend!=='webgl2'){
   await page.selectOption('#backend',backend);
   await page.waitForFunction(x=>RainEditor.getActualBackend().actual===x,backend,{timeout:60000});
  }
  const actual=await page.evaluate(()=>RainEditor.getActualBackend());
  A.equal(actual.actual,backend);
  A.equal(actual.pixi,'8.22.0');
  const defaults=await page.evaluate(()=>RainEditor.getSettings());
  A.equal(defaults.density,45);A.equal(defaults.durationFrames,60);
  A.equal(defaults.impactProbability,.3);
  A.equal(await page.locator('#curveMounts svg').count(),4);
  const png=async(name)=>{
   const pixels=Buffer.from(await page.evaluate(async()=>Array.from(
    await RainEditor.extractBytes())));
   fs.writeFileSync(path.join(output,name+'.png'),pixels);
   const image=P.decodePng(pixels);
   A.equal(image.width,512);A.equal(image.height,512);
   return image;
  };
  const changed=(a,b)=>P.comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
  const visible=a=>{const c=P.countAlpha(a);return c.partial+c.opaque};
  const seek=t=>page.evaluate(t=>RainEditor.seek(t),t);
  const set=c=>page.evaluate(c=>RainEditor.setSettings(c),c);
  const get=()=>page.evaluate(()=>RainEditor.getSettings());
  await seek(0);const a=await png('frame00');A.ok(visible(a)>1000);
  await seek(.5);const middle=await png('frame30');A.ok(visible(middle)>1000);
  await seek(59/60);const end=await png('frame59');A.ok(visible(end)>1000);
  A.ok(changed(a,end)>50,'rain must move across last frame, not freeze');
  await seek(0);
  const fxAt0=await png('loop0');
  await page.evaluate(()=>{RainEditor.getFx().seek(1);RainEditor.getApp().render()});
  const fxAt1=await png('loop60');
  A.equal(changed(fxAt0,fxAt1),0,'periodic endpoint must match');
  await seek(.3);const baseline=await png('baseline');
  const heavier=structuredClone(defaults);heavier.windAngle=40;await set(heavier);
  const wind=await png('wind40');A.ok(changed(baseline,wind)>80);
  await set(defaults);
  await page.locator('#p-density').evaluate(el=>{
   el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  A.equal((await get()).density,0);
  A.equal(visible(await png('density0')),0);
  await set(defaults);await seek(.3);
  const n=structuredClone(defaults);n.emitters[0].layers.near.enabled=true;
  await set(n);A.ok(changed(baseline,await png('near-on'))>40);
  const f=structuredClone(defaults);f.emitters[0].layers.far.enabled=true;
  await set(f);A.ok(changed(baseline,await png('far-on'))>40);
  const hit=structuredClone(defaults);hit.impactProbability=0;
  await set(hit);
  const hitOff=await png('impact-off');
  A.ok(changed(baseline,hitOff)>3);
  const disabled=structuredClone(defaults);
  for(const kind of ['drops','far','near','impacts'])disabled.emitters[0].layers[kind].enabled=false;
  await set(disabled);A.equal(visible(await png('disabled')),0);
  await set(defaults);await seek(.3);
  const zoom={};
  for(const z of ['.5','1','2']){
   await page.selectOption('#zoom',z);
   zoom[z]=changed(baseline,await png('zoom-'+z));
   A.equal(zoom[z],0);
  }
  await page.selectOption('#zoom','1');
  await page.click('#addEmitter');A.equal((await get()).emitters.length,2);
  await page.click('#duplicateEmitter');A.equal((await get()).emitters.length,3);
  await page.click('#addEmitter');A.equal((await get()).emitters.length,4);
  A.ok(await page.locator('#addEmitter').isDisabled());
  await set(defaults);
  const baked=await page.evaluate(()=>RainExports.bake({download:false,frames:8}).then(
   result=>({count:result.manifest.frames.length,size:result.blob.size,
    policy:result.manifest.loopPolicy})));
  A.equal(baked.count,8);A.ok(baked.size>5000);
  A.equal(baked.policy,'seamless-periodic-60');
  const packages=await page.evaluate(async()=>{
   const a=await RainExports.buildPackage('webgl');
   const b=await RainExports.buildPackage('webgpu');
   return [a,b].map(v=>({names:v.entries.map(z=>z.name),size:v.blob.size,
    effectId:v.preset.effectId}));
  });
  for(const v of packages){
   A.equal(v.effectId,'fx.water.rainfall');A.ok(v.size>20000);
   for(const name of ['FxRain.mjs','Rainfall.mjs','FxCurves.mjs',
    'FxSpacing.mjs','FxColors.mjs','FxTimeline.mjs','example.js'])
    A.ok(v.names.includes(name),'missing '+name);
  }
  await set(defaults);await seek(.3);
  const variants={};
  for(const [id,mutate] of [
   ['spacing-on',cfg=>{cfg.spacingCurveEnabled=true}],
   ['layer-drops-shifted',cfg=>{cfg.emitters[0].layers.drops.x=16}],
   ['emitter-world-shifted',cfg=>{cfg.emitters[0].anchor.x+=10}],
   ['rain-recolored',cfg=>{cfg.palette.stops[0].rgba=[255,80,185,1]}]
  ]){
   const cfg=structuredClone(defaults);mutate(cfg);
   await set(cfg);variants[id]=changed(baseline,await png(id));
   A.ok(variants[id]>30,'Inert visual UI parameter: '+id);
  }
  await set(defaults);await seek(.3);
  const backgrounds={};
  for(const bg of ['checker','light','dark']){
   await page.selectOption('#background',bg);
   backgrounds[bg]=changed(baseline,await png('background-'+bg));
   A.equal(backgrounds[bg],0,'CSS background leaked into effect-only PNG');
  }
  await page.selectOption('#background','checker');
  const download=page.waitForEvent('download');
  await page.click('#savePreset');
  const item=await download,presetFile=path.join(output,'Rainfall_Preset.json');
  await item.saveAs(presetFile);
  const preset=JSON.parse(fs.readFileSync(presetFile,'utf8'));
  A.equal(preset.effectId,'fx.water.rainfall');
  A.equal(preset.schemaVersion,1);
  A.deepEqual(preset.settings,defaults);
  await page.locator('#p-density').evaluate(el=>{
   el.value='9';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  A.equal((await get()).density,9);
  await page.locator('#presetFile').setInputFiles(presetFile);
  await page.waitForFunction(()=>RainEditor.getSettings().density===45);
  A.deepEqual(await get(),defaults,'Preset roundtrip changed parameter values');
  const invalid=path.join(output,'invalid-rain-version.json');
  fs.writeFileSync(invalid,JSON.stringify({...preset,schemaVersion:2}));
  await page.locator('#presetFile').setInputFiles(invalid);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Preset rejected'));
  A.deepEqual(await get(),defaults,'Invalid preset version mutated settings');
  const report={status:'PASS',backend:actual,zoom,backgrounds,variants,
   phaseVisible:[visible(a),visible(middle),visible(end)],
   windChange:changed(baseline,wind),impactChange:changed(baseline,hitOff),
   frames:baked.count,developer:packages.map(v=>v.size),browser:browser.version(),
   presetRoundtrip:true,presetVersionRejected:true,errors,external};
  A.deepEqual(errors,[]);A.deepEqual(external,[]);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log('PASS WATER-02 RAIN EDITOR',JSON.stringify(report));
 }finally{await browser.close()}
}
run().catch(e=>{console.error('FAIL WATER-02 RAIN EDITOR',e.stack||e);process.exitCode=1});
