#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const P=require('./fx_visual_png.cjs'),root=path.resolve(__dirname,'..');
const backend=process.argv[2]||'webgl2',
 output=path.resolve(process.env.TEMP||'.','fxlab_ripples_'+backend);
async function run(){
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:1400,height:1080},
  acceptDownloads:true,offline:true});
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('request',q=>{if(/^https?:/.test(q.url()))external.push(q.url())});
 try{
  await page.goto(pathToFileURL(path.join(root,'assets/Water_Ripples_Lab.html')).href);
  await page.waitForFunction(()=>typeof RipplesEditor!=='undefined'&&!!RipplesEditor.getApp(),
   null,{timeout:60000});
  if(backend!=='webgl2'){
   await page.selectOption('#backend',backend);
   await page.waitForFunction(expected=>RipplesEditor.getActualBackend().actual===expected,
    backend,{timeout:60000});
  }
  const actual=await page.evaluate(()=>RipplesEditor.getActualBackend());
  A.equal(actual.actual,backend);A.equal(actual.pixi,'8.22.0');
  const defaults=await page.evaluate(()=>RipplesEditor.getSettings());
  A.equal(defaults.durationFrames,40);A.equal(defaults.exportFrames,40);
  A.equal(defaults.rings,3);A.equal(defaults.ringDelayFrames,7);
  A.equal(defaults.ellipticity,1);
  A.equal(await page.locator('#curveMounts svg').count(),4);
  const png=async(name)=>{
   const bytes=Buffer.from(await page.evaluate(async()=>Array.from(
    await RipplesEditor.extractBytes())));
   fs.writeFileSync(path.join(output,name+'.png'),bytes);
   const img=P.decodePng(bytes);
   A.equal(img.width,512);A.equal(img.height,512);return img;
  };
  const changed=(a,b)=>P.comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
  const visible=a=>{const c=P.countAlpha(a);return c.partial+c.opaque};
  const seek=t=>page.evaluate(t=>RipplesEditor.seek(t),t);
  const set=c=>page.evaluate(c=>RipplesEditor.setSettings(c),c);
  const get=()=>page.evaluate(()=>RipplesEditor.getSettings());
  await seek(0);const start=await png('frame00');A.ok(visible(start)>10);
  A.equal(start.pixels[(256*512+256)*4+3],0,'ring must not fill center');
  await seek(19.5/60);const middleHalf=await png('frame19half');A.ok(visible(middleHalf)>300);
  await seek(20/60);const middle=await png('frame20');A.ok(visible(middle)>300);
  await seek(38/60);const fade=await png('frame38');A.ok(visible(fade)>50);
  await seek(39/60);const end=await png('frame39');A.equal(visible(end),0);
  await seek(0);const again=await png('return0');A.equal(changed(start,again),0);
  await seek(20/60);const baseline=await png('baseline');
  const variants={};
  for(const [key,mutate] of [
   ['rings',c=>{c.rings=2}],
   ['startRadius',c=>{c.startRadius=16}],
   ['finalRadius',c=>{c.finalRadius=96}],
   ['ringDelayFrames',c=>{c.ringDelayFrames=4}],
   ['radialGapPx',c=>{c.radialGapPx=38}],
   ['thickness',c=>{c.thickness=8}],
   ['ellipticity',c=>{c.ellipticity=1.8}],
   ['style',c=>{c.style='magical'}],
   ['palette',c=>{c.palette.stops[0].rgba=[255,100,200,1]}],
   ['radiusCurve',c=>{c.radiusCurve.keys[1].y=.4}],
   ['thicknessCurve',c=>{c.thicknessCurve.keys[1].y=.75}],
   ['ringAlphaCurve',c=>{c.ringAlphaCurve.keys[1].y=.15}],
   ['ringDelayCurve',c=>{c.ringDelayCurve.keys[1].y=.5}],
   ['highlight-enable',c=>{c.emitters[0].layers.highlights.enabled=true}],
   ['layer-primary-x',c=>{c.emitters[0].layers.primary.x=18}],
   ['world-anchor-x',c=>{c.emitters[0].anchor.x=266}],
   ['layer-own-anchor',c=>{
    c.emitters[0].layers.primary.anchor={type:'world',space:'world',
     name:'',slot:'',x:292,y:280,rotation:0}}],
  ]){
   const cfg=structuredClone(defaults);mutate(cfg);
   await set(cfg);const img=await png('variant-'+key);
   variants[key]=changed(baseline,img);
   A.ok(variants[key]>8,'Inert artist control '+key+' delta='+variants[key]);
  }
  const withHighlights=structuredClone(defaults);
  withHighlights.emitters[0].layers.highlights.enabled=true;
  await set(withHighlights);await seek(20/60);
  const highlightBase=await png('highlights-on');
  for(const [key,mutate] of [
   ['highlightArcGapPx',c=>c.highlightArcGapPx=32],
   ['highlightDistribution',c=>c.highlightDistribution='clustered'],
   ['highlightJitter',c=>c.highlightJitter=.4],
   ['seed',c=>c.seed=123456]
  ]){
   const cfg=structuredClone(withHighlights);mutate(cfg);await set(cfg);
   variants[key]=changed(highlightBase,await png('variant-'+key));
   A.ok(variants[key]>8,'Inert highlight control '+key);
  }
  await set(defaults);await seek(20/60);
  const blank=structuredClone(defaults);
  for(const l of Object.values(blank.emitters[0].layers))l.enabled=false;
  await set(blank);A.equal(visible(await png('disabled')),0);
  const cyclic=structuredClone(defaults);cyclic.loop=true;
  await set(cyclic);await seek(0);
  const cycle0=await png('cycle0');
  await seek(40/60);const cycleEnd=await png('cycle40');
  A.equal(changed(cycle0,cycleEnd),0);
  A.ok(changed(start,cycle0)>10);
  await set(defaults);await seek(20/60);
  const zoom={};
  for(const z of ['.5','1','2']){
   await page.selectOption('#zoom',z);
   zoom[z]=changed(baseline,await png('zoom-'+z));A.equal(zoom[z],0);
  }
  await page.selectOption('#zoom','1');
  const backgrounds={};
  for(const b of ['light','dark','checker']){
   await page.selectOption('#background',b);
   backgrounds[b]=changed(baseline,await png('background-'+b));
   A.equal(backgrounds[b],0);
  }
  await page.click('#addEmitter');A.equal((await get()).emitters.length,2);
  await page.click('#duplicateEmitter');A.equal((await get()).emitters.length,3);
  await page.click('#addEmitter');A.equal((await get()).emitters.length,4);
  A.ok(await page.locator('#addEmitter').isDisabled());
  await set(defaults);
  const download=page.waitForEvent('download');
  await page.click('#savePreset');const item=await download;
  const presetFile=path.join(output,'Water_Ripples_Preset.json');
  await item.saveAs(presetFile);
  const preset=JSON.parse(fs.readFileSync(presetFile,'utf8'));
  A.equal(preset.effectId,'fx.water.water-ripples');
  A.deepEqual(preset.settings,defaults);
  await page.locator('#p-rings').evaluate(el=>{
   el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  A.equal((await get()).rings,2);
  await page.locator('#presetFile').setInputFiles(presetFile);
  await page.waitForFunction(()=>RipplesEditor.getSettings().rings===3);
  A.deepEqual(await get(),defaults);
  const invalid=path.join(output,'invalid-version.json');
  fs.writeFileSync(invalid,JSON.stringify({...preset,schemaVersion:2}));
  await page.locator('#presetFile').setInputFiles(invalid);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Preset rejected'));
  A.deepEqual(await get(),defaults);
  const baked=await page.evaluate(()=>RipplesExports.bake({download:false,frames:8})
   .then(x=>({count:x.manifest.frames.length,size:x.blob.size,policy:x.manifest.loopPolicy})));
  A.equal(baked.count,8);A.ok(baked.size>4000);
  A.equal(baked.policy,'one-shot-frame39-alpha0');
  const packages=await page.evaluate(async()=>{
   const a=await RipplesExports.buildPackage('webgl');
   const b=await RipplesExports.buildPackage('webgpu');
   return [a,b].map(x=>({names:x.entries.map(v=>v.name),size:x.blob.size,
    id:x.preset.effectId}));
  });
  for(const pack of packages){
   A.equal(pack.id,'fx.water.water-ripples');
   A.ok(pack.size>20000);
   for(const name of ['FxRipples.mjs','WaterRipples.mjs','FxCurves.mjs',
    'FxSpacing.mjs','FxColors.mjs','FxTimeline.mjs','example.js'])
    A.ok(pack.names.includes(name),'ZIP missing '+name);
  }
  A.deepEqual(errors,[]);A.deepEqual(external,[]);
  const report={status:'PASS',backend:actual,phaseVisible:[visible(start),
   visible(middle),visible(fade),visible(end)],variants,zoom,backgrounds,
   loopDelta:changed(cycle0,cycleEnd),frames:baked.count,
   packages:packages.map(x=>x.size),presetRoundtrip:true,
   invalidPresetRejected:true,browser:browser.version(),errors,external};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log('PASS WATER-03 RIPPLES EDITOR',JSON.stringify(report));
 }finally{await browser.close()}
}
run().catch(e=>{console.error('FAIL WATER-03 RIPPLES EDITOR',e.stack||e);process.exitCode=1});
