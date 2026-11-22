#!/usr/bin/env node
'use strict';
// WATER-05: decoded real PNG/control and curve evidence, backend provenance.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),
 {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),
 P=require('./fx_visual_png.cjs');
const backend=process.argv[2]||'webgl2',repo=path.resolve(__dirname,'..'),
 output=path.resolve(process.argv[3]||path.join(os.tmpdir(),'fxlab_bubbles_'+backend));
async function run(){
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:1650,height:1100},
  acceptDownloads:true,offline:true});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/i.test(r.url()))external.push(r.url())});
 try{
  await page.goto(pathToFileURL(path.join(repo,'assets/Rising_Bubbles_Lab.html')).href);
  await page.waitForFunction(()=>typeof BubblesEditor!=='undefined'&&!!BubblesEditor.getApp(),
   null,{timeout:60000});
  if(backend!=='webgl2'){
   await page.selectOption('#backend',backend);
   await page.waitForFunction(b=>BubblesEditor.getActualBackend().actual===b,
    backend,{timeout:60000});
  }
  const actual=await page.evaluate(()=>BubblesEditor.getActualBackend());
  A.equal(actual.actual,backend);A.equal(actual.pixi,'8.22.0');
  const defaults=await page.evaluate(()=>BubblesEditor.getSettings());
  A.deepEqual(Object.keys(defaults.emitters[0].layers),['bubbles','highlights','popRings']);
  A.equal(defaults.rate,16);A.equal(defaults.radius,8);
  A.equal(defaults.buoyancy,90);A.equal(defaults.wobble,12);
  A.equal(defaults.lifetime,1.8);A.equal(defaults.highlightStrength,.6);
  A.equal(defaults.originGap,22);A.equal(defaults.nozzleBend,9);
  A.equal(defaults.mode,'loop');A.equal(defaults.durationFrames,60);
  A.equal(defaults.exportFrames,60);
  A.equal(await page.locator('#curveMounts svg').count(),5);
  const png=async name=>{
   const bytes=Buffer.from(await page.evaluate(async()=>Array.from(await BubblesEditor.extractBytes())));
   fs.writeFileSync(path.join(output,name+'.png'),bytes);
   const im=P.decodePng(bytes);A.equal(im.width,512);A.equal(im.height,512);
   return {name,im,bytes};
  };
  const change=(a,b)=>P.comparePixels(a.im,b.im,{step:1,channelTolerance:0}).changedPixels;
  const visible=p=>{const counts=P.countAlpha(p.im);return counts.partial+counts.opaque};
  const seek=t=>page.evaluate(t=>BubblesEditor.seek(t),t);
  const set=c=>page.evaluate(c=>BubblesEditor.setSettings(c),c);
  const get=()=>page.evaluate(()=>BubblesEditor.getSettings());
  await seek(0);const start=await png('frame00');
  await seek(29.5/60);const half=await png('frame29half');
  await seek(.5);const middle=await png('frame30');
  await seek(59/60);const tail=await png('frame59');
  await seek(1);const seam=await png('frame60');
  A.ok(visible(start)>100&&visible(half)>100&&visible(middle)>100&&visible(tail)>100);
  A.equal(change(start,seam),0,'loop has visible seam');
  A.ok(change(start,middle)>100,'bubbles do not rise/move');
  await seek(.5);const baseline=await png('baseline'),diffs={};
  for(const [key,mutate] of [
   ['rate',c=>{c.rate=24}],
   ['radius',c=>{c.radius=14}],
   ['buoyancy',c=>{c.buoyancy=160}],
   ['wobble',c=>{c.wobble=0}],
   ['lifetime',c=>{c.lifetime=2.7}],
   ['highlightStrength',c=>{c.highlightStrength=0}],
   ['originGap',c=>{c.originGap=30}],
   ['originSpan',c=>{c.originSpan=250}],
   ['nozzleBend',c=>{c.nozzleBend=50}],
   ['spatialJitter',c=>{c.spatialJitter=0}],
   ['radiusVariation',c=>{c.radiusVariation=.7}],
   ['popLifetime',c=>{c.popLifetime=.5}],
   ['seed',c=>{c.seed+=47}],
   ['spatialMode',c=>{c.spatialMode='clustered'}],
   ['temporalMode',c=>{c.temporalMode='clustered'}],
   ['style',c=>{c.style='magical'}],
   ['palette',c=>{c.palette.stops[0].rgba=[216,85,245,.95]}],
   ['sizeCurve',c=>{c.sizeCurve.keys[1].y=.55}],
   ['lateralDriftCurve',c=>{c.lateralDriftCurve.keys[1].y=.25}],
   ['alphaCurve',c=>{c.alphaCurve.keys[1].y=.25}],
   ['emissionRateCurve',c=>{c.emissionRateCurve.keys[1].y=.5}],
   ['originGapCurve',c=>{c.originGapCurve.keys[1].y=1.8}],
   ['bubble-layer-x',c=>{c.emitters[0].layers.bubbles.x=20}],
   ['highlight-layer-x',c=>{c.emitters[0].layers.highlights.x=28}],
   ['emitter-world-x',c=>{c.emitters[0].anchor.x+=18}],
   ['bubble-layer-anchor',c=>{c.emitters[0].layers.bubbles.anchor={
    type:'world',space:'world',name:'',slot:'',x:280,y:420,rotation:0}}]
  ]){
   const cfg=structuredClone(defaults);mutate(cfg);
   await set(cfg);await seek(.5);
   const shot=await png('variant-'+key);
   diffs[key]=change(baseline,shot);
   A.ok(diffs[key]>5,'Inert control or curve '+key+'; changed='+diffs[key]);
  }
  for(const layer of ['bubbles','highlights','popRings']){
   const c=structuredClone(defaults);c.emitters[0].layers[layer].enabled=false;
   await set(c);await seek(.5);
   const shot=await png('layer-'+layer+'-disabled');
   diffs['layer-'+layer+'-disabled']=change(baseline,shot);
   A.ok(diffs['layer-'+layer+'-disabled']>5,'layer toggle inert '+layer);
  }
  const isolated=structuredClone(defaults);
  isolated.emitters[0].layers.bubbles.enabled=false;
  isolated.emitters[0].layers.popRings.enabled=false;
  await set(isolated);await seek(.5);
  const highlight=await png('highlight-isolated'),counts=P.countAlpha(highlight.im);
  A.ok(counts.partial>20,'highlights lack translucent pixels');
  A.equal(counts.opaque,0,'highlights became opaque rectangle');
  const allOff=structuredClone(defaults);
  for(const l of Object.values(allOff.emitters[0].layers))l.enabled=false;
  await set(allOff);await seek(.5);
  A.equal(visible(await png('all-off')),0);
  await set(defaults);await seek(.5);
  const beforeDrag=await get();
  const handle=page.locator('#highlightHandle'),r=await handle.boundingBox();
  A.ok(r&&r.width>0);
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);
  await page.mouse.down();await page.mouse.move(r.x+r.width/2+22,r.y+r.height/2+11,{steps:7});
  await page.mouse.up();
  const dragged=await get();
  A.ok(dragged.emitters[0].layers.highlights.x>=
   beforeDrag.emitters[0].layers.highlights.x+17);
  A.equal(dragged.emitters[0].anchor.x,beforeDrag.emitters[0].anchor.x);
  const draggedImage=await png('dragged-highlight'),highlightDragDelta=change(baseline,draggedImage);
  A.ok(highlightDragDelta>5);
  await set(defaults);await seek(.5);
  const zoom={},background={};
  for(const z of ['.5','1','2']){
   await page.selectOption('#zoom',z);
   zoom[z]=change(baseline,await png('zoom-'+z));A.equal(zoom[z],0);
  }
  await page.selectOption('#zoom','1');
  for(const b of ['light','dark','checker']){
   await page.selectOption('#background',b);
   background[b]=change(baseline,await png('background-'+b));A.equal(background[b],0);
  }
  for(let f=0;f<60;f+=5){
   await seek(f/60);
   const b=await page.evaluate(()=>BubblesEditor.getFx().currentBounds());
   A.equal(b.inside,true,'default invalid side/bottom crop frame '+f+': '+JSON.stringify(b));
  }
  await set(defaults);await page.selectOption('#mode','shutdown');
  A.equal((await get()).durationFrames,40);
  A.equal((await get()).exportFrames,40);
  await seek(38/60);const dying=await png('shutdown38');
  await seek(39/60);const ended=await png('shutdown39');
  A.ok(visible(dying)>10);A.equal(visible(ended),0);
  await page.selectOption('#mode','loop');
  A.equal((await get()).durationFrames,60);
  await set(defaults);
  await page.click('#addEmitter');A.equal((await get()).emitters.length,2);
  await page.click('#duplicateEmitter');A.equal((await get()).emitters.length,3);
  await page.click('#addEmitter');A.equal((await get()).emitters.length,4);
  A.equal(await page.locator('#addEmitter').isDisabled(),true);
  await set(defaults);
  const next=page.waitForEvent('download',{timeout:30000});
  await page.click('#savePreset');const download=await next;
  const presetPath=path.join(output,'Rising_Bubbles_Preset.json');
  await download.saveAs(presetPath);
  const preset=JSON.parse(fs.readFileSync(presetPath,'utf8'));
  A.equal(preset.effectId,'fx.water.rising-bubbles');
  A.deepEqual(preset.settings,defaults);
  await page.locator('#p-radius').evaluate(el=>{
   el.value='14';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  A.equal((await get()).radius,14);
  await page.locator('#presetFile').setInputFiles(presetPath);
  await page.waitForFunction(()=>BubblesEditor.getSettings().radius===8);
  A.deepEqual(await get(),defaults);
  const bad=path.join(output,'invalid-preset.json');
  fs.writeFileSync(bad,JSON.stringify({...preset,schemaVersion:3}));
  await page.locator('#presetFile').setInputFiles(bad);
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Preset rejected'));
  A.deepEqual(await get(),defaults);
  const baked=await page.evaluate(()=>BubblesExports.bake({download:false,frames:8})
   .then(v=>({count:v.manifest.frameCount,size:v.blob.size,policy:v.manifest.loopPolicy})));
  A.equal(baked.count,8);A.ok(baked.size>10000);
  const packages=await page.evaluate(async()=>Promise.all(['webgl','webgpu']
   .map(x=>BubblesExports.buildPackage(x))).then(a=>a.map(p=>({
    size:p.blob.size,names:p.entries.map(q=>q.name),effectId:p.preset.effectId}))));
  for(const p of packages){
   A.ok(p.size>22000);A.equal(p.effectId,'fx.water.rising-bubbles');
   for(const file of ['FxBubbles.mjs','Bubbles.mjs','FxCurves.mjs',
    'FxSpacing.mjs','FxColors.mjs','FxTimeline.mjs','example.js'])
    A.ok(p.names.includes(file),'Developer zip lacks '+file);
  }
  A.deepEqual(errors,[]);A.deepEqual(external,[]);
  const report={status:'PASS',backend:actual,phaseVisible:[visible(start),visible(half),visible(tail)],
   motionDelta:change(start,middle),seamDelta:change(start,seam),differences:diffs,
   highlightDragDelta,zoom,background,shutdown:[visible(dying),visible(ended)],
   presetRoundtrip:true,invalidPresetRejected:true,frames:baked.count,
   packageBytes:packages.map(p=>p.size),browser:browser.version(),external,errors};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log('PASS WATER-05 REAL EDITOR '+backend,JSON.stringify(report));
 }finally{await browser.close()}
}
run().catch(e=>{console.error('FAIL WATER-05 EDITOR',e.stack||e);process.exitCode=1});
