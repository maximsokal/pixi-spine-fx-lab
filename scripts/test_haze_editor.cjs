#!/usr/bin/env node
'use strict';
// FIRE-06 real browser actual-backend pixel validation, explicit scene-source, PNG kinds.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),crypto=require('node:crypto');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1]};
const actual=arg('backend','webgl2'),full=process.argv.includes('--full'),
 root=path.resolve(__dirname,'..'),html=path.resolve(root,'assets/Heat_Haze_Lab.html'),
 dir=path.resolve(arg('output','haze-test-output'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const compare=(a,b)=>comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
const count=i=>{const n=countAlpha(i);return n.partial+n.opaque};
async function run(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',
   ...(actual==='webgpu'?['--enable-unsafe-webgpu']:
    ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:1460,height:1100},offline:true,acceptDownloads:true});
 fs.mkdirSync(dir,{recursive:true});
 const errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('request',r=>{if(/^https?:/i.test(r.url()))remote.push(r.url())});
 const read=async kind=>{
  const bytes=Buffer.from(await page.evaluate(async type=>
   Array.from(await HazeEditor.extractBytes(type)),kind));
  const image=decodePng(bytes);
  assert.equal(image.width,512);assert.equal(image.height,512);
  return {bytes,image};
 };
 const snap=async(name,kind='composite')=>{
  const value=await read(kind);
  fs.writeFileSync(path.join(dir,name+'.png'),value.bytes);
  return value.image;
 };
 const get=async()=>page.evaluate(()=>HazeEditor.getSettings());
 const set=async s=>page.evaluate(value=>HazeEditor.setSettings(value),s);
 const seek=async t=>page.evaluate(x=>HazeEditor.seek(x),t);
 try{
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(()=>typeof HazeEditor!=='undefined'&&
   !!HazeEditor.getApp(),null,{timeout:60000});
  if(actual!=='webgl2'){
   await page.selectOption('#backend',actual);
   await page.waitForFunction(v=>HazeEditor.getActualBackend().actual===v,
    actual,{timeout:60000});
  }
  const backend=await page.evaluate(()=>HazeEditor.getActualBackend());
  assert.equal(backend.actual,actual);
  assert.equal(backend.pixi,'8.22.0');
  const defaults=await get();
  assert.equal(defaults.mode,'loop');assert.equal(defaults.durationFrames,120);
  assert.equal(defaults.emitters.length,1);
  assert.equal(defaults.amplitude,8);
  assert.equal(defaults.pulseRate,1.5);
  assert.equal(await page.locator('#exportKind option').count(),4);
  assert.ok(await page.locator('#distortionCurveEditor svg').count());
  assert.ok(await page.locator('#edgeCurveEditor svg').count());
  assert.ok(await page.locator('#pulseCurveEditor svg').count());
  await seek(.5);
  const affected=await snap('affected-checker');
  const map=await snap('map-checker','displacement');
  const glowOff=await snap('glow-disabled','glow');
  assert.equal(count(glowOff),0,'disabled glow leaks alpha');
  assert.equal(map.colorType,6);
  let coverage=0,uncovered=0;
  for(let i=0;i<map.pixels.length;i+=4){
   const m=map.pixels;
   assert.equal(m[i+3],255,'displacement data must always be opaque');
   if(m[i+2])coverage++;
   else{
    uncovered++;
    assert.deepEqual([...m.subarray(i,i+4)],[128,128,0,255],
     'displacement outside region not neutral at byte '+i);
   }
  }
  assert.ok(coverage>2000&&uncovered>170000);
  const zero=structuredClone(defaults);zero.amplitude=0;
  await set(zero);await seek(.5);
  const original=await snap('original-amplitude-zero');
  const neutral=await snap('map-neutral','displacement');
  assert.ok(compare(affected,original)>300,
   'real captured background has not actually been refracted');
  assert.equal(countAlpha(original).opaque,262144);
  assert.ok(compare(neutral,map)>500);
  for(let i=0;i<neutral.pixels.length;i+=4)
   assert.deepEqual([...neutral.pixels.subarray(i,i+4)],[128,128,0,255]);
  for(let i=0;i<affected.pixels.length;i+=4){
   const changed=affected.pixels.subarray(i,i+4)
    .some((byte,c)=>byte!==original.pixels[i+c]);
   if(changed)assert.ok(map.pixels[i+2]>0,
    'refraction changed an original pixel outside exact B coverage at '+i/4);
  }
  await set(defaults);await seek(0);
  const frame0=await snap('loop-start');
  await seek(1.5);await snap('loop-cooldown');
  await page.evaluate(()=>{HazeEditor.getFx().seek(2);HazeEditor.getApp().render()});
  const frame120=await snap('loop-period-boundary');
  assert.equal(compare(frame0,frame120),0,'loop seam changed background pixels');
  await seek(.5);const revisit=await snap('baseline-seek');
  await seek(1.75);await seek(.12);await seek(.5);
  assert.equal(compare(revisit,await snap('reverse-scrub')),0,'seek is non-deterministic');
  const zoomResult={};
  for(const z of ['.5','1','2']){
   await page.selectOption('#zoom',z);
   zoomResult[z]=compare(revisit,await snap('zoom-'+z));
   assert.equal(zoomResult[z],0,'DOM zoom contaminated logical PNG');
  }
  await page.selectOption('#zoom','1');
  // Browser captures are affected by scene pixels, not an inert CSS background.
  for(const name of ['dark','light']){
   await page.selectOption('#background',name);
   assert.notEqual(compare(revisit,await snap('scene-'+name)),0,
    'Changing captured Pixi scene did not change refraction output');
  }
  await page.selectOption('#background','checker');
  await seek(.5);
  const settings=await get();
  const layers={};
  for(const kind of ['refraction','thermalGlow']){
   const s=structuredClone(defaults);
   s.emitters[0].layers[kind].enabled=true;
   await set(s);await seek(.5);const on=await snap(kind+'-on');
   s.emitters[0].layers[kind].enabled=false;
   await set(s);const off=await snap(kind+'-off');
   layers[kind]=compare(on,off);
   assert.ok(layers[kind]>10,'Layer control inert '+kind);
   s.emitters[0].layers[kind].enabled=true;
   s.emitters[0].layers[kind].x+=26;
   await set(s);assert.ok(compare(on,await snap(kind+'-shifted'))>30,
    'Layer offset inert '+kind);
  }
  const allOff=structuredClone(defaults);
  for(const kind of ['refraction','thermalGlow'])
   allOff.emitters[0].layers[kind].enabled=false;
  await set(allOff);await seek(.5);
  assert.equal(compare(original,await snap('all-layers-off')),0,
   'All layers disabled must leave original scene intact');
  const independentGlow=structuredClone(defaults);
  independentGlow.emitters[0].layers.thermalGlow.enabled=true;
  independentGlow.emitters[0].layers.refraction.enabled=false;
  await set(independentGlow);await seek(.5);
  const glowOriginal=await snap('glow-only','glow');
  assert.ok(count(glowOriginal)>100);
  const magic=structuredClone(independentGlow);
  magic.palette.stops[1].rgba=[60,150,255,1];
  await set(magic);await seek(.5);
  assert.ok(compare(glowOriginal,await snap('glow-recolored','glow'))>0);
  await set(defaults);await seek(.5);
  // Move selected source, then use the same centerline path generator.
  const old=await get(),h=await page.locator('#originHandle').boundingBox();
  assert.ok(h);
  await page.mouse.move(h.x+h.width/2,h.y+h.height/2);
  await page.mouse.down();
  await page.mouse.move(h.x+h.width/2+28,h.y+h.height/2-12,{steps:6});
  await page.mouse.up();
  const moved=await get();
  assert.ok(Math.abs(moved.emitters[0].anchor.x-old.emitters[0].anchor.x)>10);
  assert.ok(compare(revisit,await snap('source-world-moved'))>100);
  await set(defaults);
  const pathHandle=await page.locator('#trajectoryHandles [data-handle="c1"]').boundingBox();
  assert.ok(pathHandle);
  await page.mouse.move(pathHandle.x+pathHandle.width/2,pathHandle.y+pathHandle.height/2);
  await page.mouse.down();
  await page.mouse.move(pathHandle.x+22,pathHandle.y-16,{steps:5});
  await page.mouse.up();
  assert.notDeepEqual((await get()).emitters[0].path,defaults.emitters[0].path);
  assert.ok(compare(revisit,await snap('centerline-modified'))>100);
  await set(defaults);await seek(.5);
  // Multiple stable independent emitters with bounded pool and no ghost regions.
  await page.click('#addEmitter');
  await page.click('#duplicateEmitter');
  await page.click('#addEmitter');
  assert.equal((await get()).emitters.length,4);
  assert.equal(await page.locator('#addEmitter').isDisabled(),true);
  await page.click('#removeEmitter');
  await page.click('#removeEmitter');
  await page.click('#removeEmitter');
  assert.equal((await get()).emitters.length,1);
  await set(defaults);
  // Editable style, quality and rate must impact actual image.
  const variants={};
  for(const [key,value] of [['style','stylized'],['quality','low'],
   ['pulseRate',4],['verticalFlow',80],['nodeGap',10],['noiseFrequency',.1]]){
   const s=structuredClone(defaults);s[key]=value;await set(s);await seek(.5);
   variants[key]=compare(revisit,await snap('param-'+key));
   assert.ok(variants[key]>5,'Artist parameter did not change visual output: '+key);
  }
  await set(defaults);
  // Last included STOP frame is fully transparent as displacement map, while
  // the original captured background is present and untouched.
  await page.selectOption('#mode','stop');
  const stop=await get();assert.equal(stop.durationFrames,120);
  await seek(90/60);assert.ok((await page.evaluate(()=>HazeEditor.getFx().snapshot.changedPixels))>0);
  await seek(119/60);
  const stopped=await snap('last-stop-map','displacement');
  assert.equal(compare(stopped,neutral),0);
  assert.equal(compare(await snap('last-stop-composite'),original),0);
  await set(defaults);await seek(.5);
  // Missing explicit background cannot falsely claim visible refraction.
  await page.selectOption('#background','none');
  assert.match(await page.locator('#status').textContent(),/NO REFRACTION INPUT/);
  const src=await page.evaluate(()=>HazeEditor.getFx().diagnostic);
  assert.match(src,/NO REFRACTION INPUT/);
  await assert.rejects(async()=>page.evaluate(()=>HazeExports.bake({download:false,kind:'composite'})),
   /needs an explicit Pixi scene source|NO REFRACTION INPUT/);
  await page.selectOption('#background','checker');
  const restored=await get();assert.deepEqual(restored,defaults);
  // PNG, ZIP and both Vite developer bundle artifacts use exact same source.
  const s=structuredClone(defaults);s.exportFrames=full?120:8;
  await set(s);
  const result=await page.evaluate(async()=>{
   const x=await HazeExports.bake({download:false,kind:'all'});
   return {manifest:x.manifest,entries:x.entries.length,blobSize:x.blob.size};
  });
  assert.equal(result.manifest.frameCount,full?120:8);
  assert.equal(result.manifest.frames.length,full?120:8);
  assert.deepEqual(Object.keys(result.manifest.representations),
   ['displacement','glow','composite']);
  assert.equal(result.manifest.representations.displacement.neutralByte,128);
  assert.equal(result.manifest.representations.displacement.displacementRangePx,32);
  assert.equal(result.entries,(full?120:8)*3+1);
  const developer=await page.evaluate(async()=>{
   const a=await HazeExports.buildPackage('webgl'),
    b=await HazeExports.buildPackage('webgpu');
   return [a,b].map(x=>({size:x.blob.size,names:x.entries.map(e=>e.name),
    compatibility:x.preset.compatibility,effectId:x.preset.effectId}));
  });
  for(const pkg of developer){
   assert.ok(pkg.size>50000);
   assert.equal(pkg.effectId,'fx.fire.heat-haze');
   assert.equal(pkg.compatibility.pixi,'8.22.0');
   assert.equal(pkg.compatibility.spine,'4.2.120');
   for(const f of ['FxHaze.mjs','HeatHaze.mjs','FxCurves.mjs',
    'FxSpacing.mjs','FxColors.mjs','FxTimeline.mjs','example.js'])
    assert.ok(pkg.names.includes(f),'Missing developer ESM '+f);
  }
  const downloads=[
   ['webglZip','Heat_Haze_WEBGL.zip'],
   ['webgpuZip','Heat_Haze_WEBGPU.zip']
  ];
  for(const [button,name] of downloads){
   const pending=page.waitForEvent('download');
   await page.click('#'+button);
   const file=await pending;await file.saveAs(path.join(dir,name));
   assert.ok(fs.statSync(path.join(dir,name)).size>50000);
  }
  if(full){
   const pending=page.waitForEvent('download',{timeout:120000});
   await page.click('#bake');
   const file=await pending;
   await file.saveAs(path.join(dir,'Heat_Haze_all_120frames_PNG.zip'));
   assert.ok(fs.statSync(path.join(dir,'Heat_Haze_all_120frames_PNG.zip')).size>100000);
  }
  await set(defaults);
  const saved=page.waitForEvent('download');
  await page.click('#savePreset');
  const presetDownload=await saved,presetPath=path.join(dir,'Heat_Haze_Preset.json');
  await presetDownload.saveAs(presetPath);
  const parsed=JSON.parse(fs.readFileSync(presetPath,'utf8'));
  assert.equal(parsed.effectId,'fx.fire.heat-haze');
  assert.equal(parsed.schemaVersion,1);
  assert.deepEqual(parsed.settings,defaults);
  await page.locator('#p-amplitude').evaluate(el=>{
   el.value='17';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal((await get()).amplitude,17);
  await page.locator('#presetFile').setInputFiles(presetPath);
  await page.waitForFunction(()=>HazeEditor.getSettings().amplitude===8);
  assert.deepEqual(await get(),defaults);
  const invalidPath=path.join(dir,'Heat_Haze_Unsupported.json');
  fs.writeFileSync(invalidPath,JSON.stringify({
   ...parsed,schemaVersion:6
  }));
  await page.locator('#presetFile').setInputFiles(invalidPath);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Preset rejected'));
  assert.deepEqual(await get(),defaults);
  assert.deepEqual(errors,[]);
  assert.deepEqual(remote,[]);
  const report={status:'PASS',backend,browser:browser.version(),full,
   layers,zoomResult,variants,affectedPixels:coverage,
   changedPixels:compare(affected,original),
   packages:developer.map(x=>x.size),frames:result.manifest.frames.length,
   representations:Object.keys(result.manifest.representations),externalRequests:remote.length};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  console.log('PASS FIRE-06 EDITOR',JSON.stringify(report));
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
