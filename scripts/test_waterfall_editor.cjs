#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),os=require('node:os'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const P=require('./fx_visual_png.cjs'),backend=process.argv[2]||'webgl2',
 repo=path.resolve(__dirname,'..'),
 output=path.join(os.tmpdir(),'fxlab_waterfall_'+backend);
async function run(){
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BROWSER_EXECUTABLE,
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:1520,height:1100},
  acceptDownloads:true,offline:true});
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',q=>{if(/^https?:/.test(q.url()))external.push(q.url())});
 try{
  await page.goto(pathToFileURL(path.join(repo,'assets/Waterfall_Lab.html')).href);
  await page.waitForFunction(()=>typeof WaterfallEditor!=='undefined'&&!!WaterfallEditor.getApp(),
   null,{timeout:60000});
  if(backend!=='webgl2'){
   await page.selectOption('#backend',backend);
   await page.waitForFunction(b=>WaterfallEditor.getActualBackend().actual===b,
    backend,{timeout:60000});
  }
  const actual=await page.evaluate(()=>WaterfallEditor.getActualBackend());
  A.equal(actual.actual,backend);A.equal(actual.pixi,'8.22.0');
  const defaults=await page.evaluate(()=>WaterfallEditor.getSettings());
  A.equal(defaults.streamWidth,75);A.equal(defaults.flowSpeed,180);
  A.equal(defaults.strands,8);A.equal(defaults.breakup,.4);
  A.equal(defaults.foamRadius,45);A.equal(defaults.turbulence,.35);
  A.equal(defaults.mode,'loop');A.equal(defaults.durationFrames,60);
  A.equal(defaults.exportFrames,60);
  A.equal(await page.locator('#curveMounts svg').count(),5);
  const png=async(name)=>{
   const b=Buffer.from(await page.evaluate(async()=>Array.from(
    await WaterfallEditor.extractBytes())));
   fs.writeFileSync(path.join(output,name+'.png'),b);
   const img=P.decodePng(b);
   A.equal(img.width,512);A.equal(img.height,512);return img;
  };
  const compare=(a,b)=>P.comparePixels(a,b,{
   step:1,channelTolerance:0}).changedPixels;
  const visible=a=>{const p=P.countAlpha(a);return p.partial+p.opaque};
  const seek=t=>page.evaluate(t=>WaterfallEditor.seek(t),t);
  const set=c=>page.evaluate(c=>WaterfallEditor.setSettings(c),c);
  const get=()=>page.evaluate(()=>WaterfallEditor.getSettings());
  await seek(0);const start=await png('frame00');
  await seek(29.5/60);const midHalf=await png('frame29half');
  await seek(.5);const middle=await png('frame30');
  await seek(59/60);const end=await png('frame59');
  await seek(1);const seam=await png('frame60');
  A.ok(visible(start)>800&&visible(middle)>800&&visible(end)>800);
  A.equal(compare(start,seam),0,'cycle not seamless');
  A.ok(compare(start,middle)>80,'flow must move');
  await seek(.5);const baseline=await png('baseline');
  const differences={};
  for(const [key,fn] of [
   ['streamWidth',c=>{c.streamWidth=100}],
   ['flowSpeed',c=>{c.flowSpeed=240}],
   ['strands',c=>{c.strands=7}],
   ['breakup',c=>{c.breakup=.9}],
   ['foamRadius',c=>{c.foamRadius=80}],
   ['turbulence',c=>{c.turbulence=.9}],
   ['strandGap',c=>{c.strandGap=10}],
   ['fragmentRate',c=>{c.fragmentRate=42}],
   ['breakupDistance',c=>{c.breakupDistance=26}],
   ['flowLength',c=>{c.flowLength=250}],
   ['spatialJitter',c=>{c.spatialJitter=.35}],
   ['seed',c=>{c.seed+=13}],
   ['style',c=>{c.style='magical'}],
   ['spatialMode',c=>{c.spatialMode='clustered'}],
   ['palette',c=>{c.palette.stops[0].rgba=[235,100,230,1]}],
   ['sheetWidthCurve',c=>{c.sheetWidthCurve.keys[1].y=.65}],
   ['flowTurbulenceCurve',c=>{c.flowTurbulenceCurve.keys[1].y=.25}],
   ['sprayAlphaCurve',c=>{c.sprayAlphaCurve.keys[1].y=.6}],
   ['fragmentRateCurve',c=>{c.fragmentRateCurve.keys[1].y=.4}],
   ['breakupDistanceCurve',c=>{c.breakupDistanceCurve.keys[1].y=2.3}],
   ['stream-layer-x',c=>{c.emitters[0].layers.streams.x=20}],
   ['foam-layer-x',c=>{c.emitters[0].layers.baseSprayFoam.x=28}],
   ['emitter-world-x',c=>{c.emitters[0].anchor.x+=20}],
   ['stream-layer-anchor',c=>{c.emitters[0].layers.streams.anchor={
     type:'world',space:'world',name:'',slot:'',x:300,y:50,rotation:0}}],
  ]){
   const c=structuredClone(defaults);fn(c);await set(c);await seek(.5);
   const shot=await png('variant-'+key);
   differences[key]=compare(baseline,shot);
   A.ok(differences[key]>5,'User control inert: '+key+' ('+differences[key]+')');
  }
  // Each layer must be visually independent; foam must not be an opaque block.
  for(const kind of ['streams','fragments','baseSprayFoam']){
   const c=structuredClone(defaults);c.emitters[0].layers[kind].enabled=false;
   await set(c);await seek(.5);
   const img=await png('layer-'+kind+'-disabled');
   const pixels=compare(baseline,img);
   A.ok(pixels>5,'Independent layer '+kind+' is inert');
   differences['layer-'+kind+'-disabled']=pixels;
  }
  const foamOnly=structuredClone(defaults);
  foamOnly.emitters[0].layers.streams.enabled=false;
  foamOnly.emitters[0].layers.fragments.enabled=false;
  await set(foamOnly);await seek(.5);
  const isolatedFoam=await png('foam-isolated');
  const foamCounts=P.countAlpha(isolatedFoam);
  A.ok(foamCounts.partial>20,'Base foam lacks visible translucent pixels');
  A.equal(foamCounts.opaque,0,'Foam must never become an opaque disc');
  await set(defaults);await seek(.5);
  const allOff=structuredClone(defaults);
  for(const l of Object.values(allOff.emitters[0].layers))l.enabled=false;
  await set(allOff);A.equal(visible(await png('all-off')),0);
  await set(defaults);await seek(.5);
  const beforeDrag=await get();
  const impact=page.locator('#impactHandle');
  A.equal(await impact.isVisible(),true);
  const rect=await impact.boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+22,
   rect.y+rect.height/2+11,{steps:5});await page.mouse.up();
  const afterDrag=await get();
  A.ok(afterDrag.emitters[0].layers.baseSprayFoam.x>=
    beforeDrag.emitters[0].layers.baseSprayFoam.x+17,
    'Impact drag not independent');
  A.equal(afterDrag.emitters[0].anchor.x,beforeDrag.emitters[0].anchor.x,
   'Impact drag moved source');
  const draggedImage=await png('dragged-impact');
  A.ok(compare(baseline,draggedImage)>5);
  await set(defaults);await seek(.5);
  const zoom={},background={};
  for(const z of ['.5','1','2']){
   await page.selectOption('#zoom',z);
   zoom[z]=compare(baseline,await png('zoom-'+z));A.equal(zoom[z],0);
  }
  await page.selectOption('#zoom','1');
  for(const b of ['light','dark','checker']){
   await page.selectOption('#background',b);
   background[b]=compare(baseline,await png('background-'+b));
   A.equal(background[b],0);
  }
  // Detect actual lack of cropping across all authoring phases, not only frame30.
  for(let f=0;f<60;f+=6){
   await seek(f/60);
   const extent=await page.evaluate(()=>WaterfallEditor.getFx().currentBounds());
   A.equal(extent.inside,true,'Default crop at '+f+' '+JSON.stringify(extent));
  }
  await set(defaults);
  await page.selectOption('#mode','shutdown');
  const shutdown=await get();
  A.equal(shutdown.durationFrames,40);A.equal(shutdown.exportFrames,40);
  await seek(38/60);const dying=await png('shutdown38');
  await seek(39/60);const finished=await png('shutdown39');
  A.ok(visible(dying)>10);A.equal(visible(finished),0);
  await page.selectOption('#mode','loop');
  A.equal((await get()).durationFrames,60);
  await set(defaults);
  await page.click('#addEmitter');
  A.equal((await get()).emitters.length,2);
  await page.click('#duplicateEmitter');
  A.equal((await get()).emitters.length,3);
  await page.click('#addEmitter');
  A.equal((await get()).emitters.length,4);
  A.equal(await page.locator('#addEmitter').isDisabled(),true);
  await set(defaults);
  const download=page.waitForEvent('download');
  await page.click('#savePreset');const artifact=await download;
  const pathPreset=path.join(output,'Waterfall_Preset.json');
  await artifact.saveAs(pathPreset);
  const preset=JSON.parse(fs.readFileSync(pathPreset,'utf8'));
  A.equal(preset.effectId,'fx.water.waterfall');
  A.deepEqual(preset.settings,defaults);
  await page.locator('#p-strands').evaluate(el=>{
   el.value='6';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  A.equal((await get()).strands,6);
  await page.locator('#presetFile').setInputFiles(pathPreset);
  await page.waitForFunction(()=>WaterfallEditor.getSettings().strands===8);
  A.deepEqual(await get(),defaults);
  const wrong=path.join(output,'invalid-preset.json');
  fs.writeFileSync(wrong,JSON.stringify({...preset,schemaVersion:3}));
  await page.locator('#presetFile').setInputFiles(wrong);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Preset rejected'));
  A.deepEqual(await get(),defaults);
  const bake=await page.evaluate(()=>WaterfallExports.bake({download:false,frames:8})
   .then(v=>({count:v.manifest.frameCount,policy:v.manifest.loopPolicy,
    size:v.blob.size})));
  A.equal(bake.count,8);A.equal(bake.policy,'seamless-periodic-60');A.ok(bake.size>8000);
  const packs=await page.evaluate(async()=>Promise.all(['webgl','webgpu']
   .map(x=>WaterfallExports.buildPackage(x))).then(a=>a.map(v=>({
    size:v.blob.size,names:v.entries.map(x=>x.name),
    id:v.preset.effectId}))));
  for(const pack of packs){
   A.ok(pack.size>22000);A.equal(pack.id,'fx.water.waterfall');
   for(const f of ['FxWaterfall.mjs','Waterfall.mjs','FxCurves.mjs',
    'FxSpacing.mjs','FxPath.mjs','FxColors.mjs','FxTimeline.mjs','example.js'])
    A.ok(pack.names.includes(f),'ZIP missing '+f);
  }
  A.deepEqual(errors,[]);
  A.deepEqual(external,[]);
  const report={status:'PASS',backend:actual,phaseVisible:[visible(start),
   visible(midHalf),visible(end)],flowDelta:compare(start,middle),
   seamDelta:compare(start,seam),differences,impactDragDelta:compare(baseline,draggedImage),
   zoom,background,shutdown:[visible(dying),visible(finished)],
   presetRoundtrip:true,invalidPresetRejected:true,frames:bake.count,
   packageBytes:packs.map(x=>x.size),errors,external,browser:browser.version()};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log('PASS WATER-04 REAL EDITOR',JSON.stringify(report));
 }finally{await browser.close()}
}
run().catch(e=>{console.error('FAIL WATER-04 EDITOR',e.stack||e);process.exitCode=1});
