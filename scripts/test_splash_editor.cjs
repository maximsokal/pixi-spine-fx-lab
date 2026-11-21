#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const P=require('./fx_visual_png.cjs');
const backend=process.argv.includes('--backend')?
 process.argv[process.argv.indexOf('--backend')+1]:'webgl2';
const dir=path.resolve(process.env.TEMP||'.','fxlab_splash_'+backend);
const root=path.resolve(__dirname,'..');
const f=path.join(root,'assets/Water_Splash_Lab.html');
async function run(){
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:1440,height:1050},offline:true,acceptDownloads:true});
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
 page.on('request',req=>{if(/^https?:/.test(req.url()))requests.push(req.url())});
 fs.mkdirSync(dir,{recursive:true});
 const png=async name=>{
  const bytes=Buffer.from(await page.evaluate(async()=>Array.from(await SplashEditor.extractBytes())));
  const image=P.decodePng(bytes);A.equal(image.width,512);A.equal(image.height,512);
  fs.writeFileSync(path.join(dir,name+'.png'),bytes);return image;
 };
 const diff=(a,b)=>P.comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
 const get=()=>page.evaluate(()=>SplashEditor.getSettings());
 const set=v=>page.evaluate(cfg=>SplashEditor.setSettings(cfg),v);
 const seek=t=>page.evaluate(t=>SplashEditor.seek(t),t);
 try{
  await page.goto(pathToFileURL(f).href);
  await page.waitForFunction(()=>typeof SplashEditor!=='undefined'&&
   !!SplashEditor.getApp(),null,{timeout:60000});
  if(backend!=='webgl2'){
   await page.selectOption('#backend',backend);
   await page.waitForFunction(x=>SplashEditor.getActualBackend().actual===x,
    backend,{timeout:60000});
  }
  const actual=await page.evaluate(()=>SplashEditor.getActualBackend());
  A.equal(actual.actual,backend);A.equal(actual.pixi,'8.22.0');
  const c=await get();
  A.equal(c.droplets,24);A.equal(c.gravity,420);
  A.equal(c.durationFrames,40);A.equal(c.loop,false);
  A.equal(await page.locator('#curveMounts svg').count(),3);
  for(const frame of [0,4,16,32]){
   await seek(frame/60);await png('frame'+String(frame).padStart(2,'0'));
  }
  await seek(19.5/60);await png('midpoint-19half');
  await seek(8/60);const base=await png('default-mid');
  A.ok(P.countAlpha(base).partial+P.countAlpha(base).opaque>600);
  const changed=structuredClone(c);changed.gravity=900;await set(changed);
  const heavy=await png('heavy-gravity');
  A.ok(diff(base,heavy)>100,'gravity must visibly bend trajectories');
  const dropless=structuredClone(c);dropless.droplets=0;await set(dropless);
  A.ok(diff(base,await png('zero-droplets'))>70);
  A.ok((await page.evaluate(()=>SplashEditor.getFx().sample.emitters[0].layers.crown.length))>0);
  const nocrown=structuredClone(c);nocrown.emitters[0].layers.crown.enabled=false;
  await set(nocrown);
  const crownPixels=diff(base,await png('crown-off'));
  A.ok(crownPixels>30);
  const disabled=structuredClone(c);
  for(const kind of ['crown','droplets','mist','ripple'])
   disabled.emitters[0].layers[kind].enabled=false;
  await set(disabled);
  const blank=await png('all-disabled');
  A.equal(P.countAlpha(blank).partial+P.countAlpha(blank).opaque,0);
  await set(c);await seek(39/60);
  const last=await png('last-frame');
  A.equal(P.countAlpha(last).partial+P.countAlpha(last).opaque,0);
  await seek(0);const first=await png('first-frame');
  await page.evaluate(()=>{SplashEditor.getFx().seek(40/60);SplashEditor.getApp().render()});
  const afterOneShot=await png('post-one-shot');
  A.ok(diff(first,afterOneShot)>100,'one-shot must not silently repeat impact');
  A.equal(P.countAlpha(afterOneShot).partial+P.countAlpha(afterOneShot).opaque,0);
  const loop=structuredClone(c);loop.loop=true;await set(loop);
  await seek(0);const loop0=await png('loop0');
  await page.evaluate(()=>{SplashEditor.getFx().seek(40/60);SplashEditor.getApp().render()});
  A.equal(diff(loop0,await png('loop40')),0);
  await set(c);await seek(8/60);
  const zoom={};
  for(const v of ['.5','1','2']){
   await page.selectOption('#zoom',v);
   zoom[v]=diff(base,await png('zoom-'+v));
   A.equal(zoom[v],0,'zoom changed export '+v);
  }
  await page.selectOption('#zoom','1');
  await page.click('#addEmitter');A.equal((await get()).emitters.length,2);
  await page.click('#duplicateEmitter');A.equal((await get()).emitters.length,3);
  await page.click('#addEmitter');A.equal((await get()).emitters.length,4);
  A.equal(await page.locator('#addEmitter').isDisabled(),true);
  await set(c);
  const n=await page.evaluate(()=>SplashExports.bake({download:false,frames:8}).then(
   r=>({frames:r.manifest.frames.length,bytes:r.blob.size})));
  A.equal(n.frames,8);A.ok(n.bytes>1000);
  const dev=await page.evaluate(async()=>{
   const a=await SplashExports.buildPackage('webgl');
   const b=await SplashExports.buildPackage('webgpu');
   return [a,b].map(v=>({names:v.entries.map(x=>x.name),bytes:v.blob.size,preset:v.preset}));
  });
  for(const pkg of dev){
   A.ok(pkg.bytes>40000);
   A.equal(pkg.preset.effectId,'fx.water.water-splash');
   for(const file of ['FxSplash.mjs','WaterSplash.mjs','FxPath.mjs',
    'FxSpacing.mjs','FxCurves.mjs','FxColors.mjs','FxTimeline.mjs','example.js'])
    A.ok(pkg.names.includes(file),'missing '+file);
  }
  await set(c);await seek(8/60);
  const baseline=await png('baseline');
  const shifted=structuredClone(c);
  shifted.emitters[0].layers.droplets.x=22;
  await set(shifted);
  const shiftedPixels=diff(baseline,await png('layer-droplets-shifted'));
  A.ok(shiftedPixels>50,'Independent droplet layer X control inert');
  const ripple=structuredClone(c);
  ripple.emitters[0].layers.ripple.enabled=true;
  await set(ripple);
  const ripplePixels=diff(baseline,await png('ripple-on'));
  A.ok(ripplePixels>30,'Independent optional ripple not visible');
  const mist=structuredClone(c);
  mist.emitters[0].layers.mist.enabled=false;
  await set(mist);
  const mistPixels=diff(baseline,await png('mist-off'));
  A.ok(mistPixels>10,'Fine mist layer did not affect output');
  const moved=structuredClone(c);
  moved.emitters[0].anchor.x+=26;
  await set(moved);
  const movedPixels=diff(baseline,await png('source-moved'));
  A.ok(movedPixels>100,'Source world X control inert');
  await set(c);await seek(8/60);
  await page.locator('#p-gravity').evaluate(el=>{
   el.value='900';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  A.equal((await get()).gravity,900,'Artist slider is disconnected from runtime');
  const userSlidePixels=diff(baseline,await png('slider-gravity'));
  A.ok(userSlidePixels>100,'Actual gravity slider does not re-render');
  await set(c);await seek(8/60);
  const saving=page.waitForEvent('download');
  await page.click('#savePreset');
  const preset=await saving,presetPath=path.join(dir,'Water_Splash_Preset.json');
  await preset.saveAs(presetPath);
  const valid=JSON.parse(fs.readFileSync(presetPath,'utf8'));
  A.equal(valid.effectId,'fx.water.water-splash');
  A.equal(valid.schemaVersion,1);
  A.deepEqual(valid.settings,c);
  await page.locator('#p-gravity').evaluate(el=>{
   el.value='900';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  A.equal((await get()).gravity,900);
  await page.locator('#presetFile').setInputFiles(presetPath);
  await page.waitForFunction(()=>SplashEditor.getSettings().gravity===420);
  A.deepEqual(await get(),c,'Preset file round-trip lost settings');
  const invalidPath=path.join(dir,'invalid-water-preset.json');
  fs.writeFileSync(invalidPath,JSON.stringify({...valid,schemaVersion:900}));
  await page.locator('#presetFile').setInputFiles(invalidPath);
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Preset rejected'));
  A.deepEqual(await get(),c,'Unsupported version modified settings');
  const report={status:'PASS',backend:actual,zoom,crown:crownPixels,
   sampleCount:n.frames,developer:dev.map(x=>x.bytes),browser:browser.version(),
   shiftedPixels,ripplePixels,mistPixels,movedPixels,userSlidePixels,
   presetRoundtrip:true,presetUnknownVersionRejected:true,
   errors,requests};
  A.deepEqual(errors,[]);A.deepEqual(requests,[]);
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  console.log('PASS WATER-01 EDITOR',JSON.stringify(report));
 }finally{await browser.close()}
}
run().catch(e=>{console.error('FAIL WATER-01 EDITOR',e.stack||e);process.exitCode=1});
